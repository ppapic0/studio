import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  applyIpRateLimit,
  forbiddenJson,
  hasTrustedBrowserContext,
  noStoreJson,
  tooManyRequestsJson,
} from '@/lib/api-security';
import { adminDb } from '@/lib/firebase-admin';
import { resolveMarketingCenterId } from '@/lib/marketing-center';
import {
  buildLeadLinkPatch,
  formatSlotLabel,
  getWebsiteBookingAccess,
  getWebsiteReservationSettings,
  isActiveWebsiteConsultReservation,
  normalizePhone,
  sortIsoLikeDesc,
  toDateMs,
  WEBSITE_RESERVATION_SETTINGS_DOC_ID,
} from '@/lib/website-consult';
import type {
  WebsiteConsultReservation,
  WebsiteConsultSlot,
  WebsiteReservationSettings,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const reservationSchema = z.object({
  leadId: z.string().trim().min(1, '연결할 접수 건을 선택해 주세요.'),
  slotId: z.string().trim().min(1, '상담 시간을 선택해 주세요.'),
  consultPhone: z
    .string()
    .trim()
    .transform(normalizePhone)
    .refine((value) => value.length >= 8 && value.length <= 15, '연락처를 다시 확인해 주세요.'),
});

export async function GET(request: NextRequest) {
  const rateLimit = applyIpRateLimit(request, 'consult:reservation-read', {
    max: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return tooManyRequestsJson(rateLimit.retryAfterSeconds, '예약 가능 시간 조회가 너무 많습니다. 잠시 후 다시 시도해주세요.');
  }

  if (!hasTrustedBrowserContext(request)) {
    return forbiddenJson('허용되지 않은 조회 경로입니다.');
  }

  try {
    const centerId = await resolveMarketingCenterId();
    if (!centerId) {
      return noStoreJson({ ok: true, settings: getWebsiteReservationSettings(null), slots: [] });
    }

    const centerRef = adminDb.collection('centers').doc(centerId);
    const [settingsSnap, slotSnapshot, reservationSnapshot] = await Promise.all([
      centerRef
        .collection('websiteReservationSettings')
        .doc(WEBSITE_RESERVATION_SETTINGS_DOC_ID)
        .get(),
      centerRef.collection('websiteConsultSlots').limit(200).get(),
      centerRef.collection('websiteConsultReservations').limit(300).get(),
    ]);

    const settings = getWebsiteReservationSettings(
      settingsSnap.exists ? ({ ...(settingsSnap.data() as WebsiteReservationSettings), id: settingsSnap.id } as WebsiteReservationSettings) : null
    );

    const activeReservationCountBySlot = new Map<string, number>();
    reservationSnapshot.docs.forEach((doc) => {
      const reservation = { ...(doc.data() as WebsiteConsultReservation), id: doc.id };
      if (!isActiveWebsiteConsultReservation(reservation.status)) return;
      const current = activeReservationCountBySlot.get(reservation.slotId) || 0;
      activeReservationCountBySlot.set(reservation.slotId, current + 1);
    });

    const nowMs = Date.now();
    const slots = sortIsoLikeDesc(
      slotSnapshot.docs
        .map((doc) => ({ ...(doc.data() as WebsiteConsultSlot), id: doc.id }))
        .filter((slot) => slot.isPublished)
        .filter((slot) => toDateMs(slot.endsAt) >= nowMs)
        .map((slot) => {
          const reservationCount = activeReservationCountBySlot.get(slot.id) || 0;
          return {
            ...slot,
            label: formatSlotLabel(slot),
            reservationCount,
            isAvailable: reservationCount < Math.max(1, Number(slot.capacity || 1)),
          };
        }),
      (slot) => slot.startsAt
    ).reverse();

    return noStoreJson({
      ok: true,
      settings,
      slots,
    });
  } catch (error) {
    console.error('[consult/reservations][GET] failed', error);
    return noStoreJson(
      {
        ok: false,
        message: '예약 가능 시간 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = applyIpRateLimit(request, 'consult:reservation-create', {
    max: 8,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return tooManyRequestsJson(rateLimit.retryAfterSeconds, '상담 예약 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.');
  }

  if (!hasTrustedBrowserContext(request)) {
    return forbiddenJson('허용되지 않은 예약 요청입니다.');
  }

  try {
    const parsed = reservationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return noStoreJson(
        {
          ok: false,
          message: parsed.error.issues[0]?.message ?? '입력값을 확인해 주세요.',
        },
        { status: 400 }
      );
    }

    const centerId = await resolveMarketingCenterId();
    if (!centerId) {
      throw new ApiError(503, '상담 예약 센터를 아직 찾을 수 없습니다.');
    }

    const { leadId, slotId, consultPhone } = parsed.data;
    const centerRef = adminDb.collection('centers').doc(centerId);
    const createdAt = new Date().toISOString();
    const reservationRef = centerRef.collection('websiteConsultReservations').doc();

    const reservationData = await adminDb.runTransaction(async (transaction) => {
      const leadRef = adminDb.collection('marketingConsultRequests').doc(leadId);
      const centerLeadRef = centerRef.collection('websiteConsultRequests').doc(leadId);
      const slotRef = centerRef.collection('websiteConsultSlots').doc(slotId);
      const reservationQuery = centerRef
        .collection('websiteConsultReservations')
        .where('slotId', '==', slotId)
        .limit(10);

      const [leadSnap, centerLeadSnap, slotSnap, slotReservationsSnap] = await Promise.all([
        transaction.get(leadRef),
        transaction.get(centerLeadRef),
        transaction.get(slotRef),
        transaction.get(reservationQuery),
      ]);

      if (!leadSnap.exists) {
        throw new ApiError(404, '연결된 접수 건을 찾을 수 없습니다.');
      }

      const lead = leadSnap.data() as Record<string, any>;
      if (normalizePhone(String(lead.consultPhone || '')) !== consultPhone) {
        throw new ApiError(403, '입력한 연락처와 접수된 연락처가 일치하지 않습니다.');
      }
      if (lead.centerId && lead.centerId !== centerId) {
        throw new ApiError(403, '다른 센터 문의 건으로는 예약할 수 없습니다.');
      }
      if (!centerLeadSnap.exists) {
        throw new ApiError(403, '아직 순차 안내 전인 문의 건입니다. 센터에서 예약 가능 상태로 열어드린 뒤 다시 시도해주세요.');
      }

      const centerLead = centerLeadSnap.data() as Record<string, any>;
      const bookingAccess = getWebsiteBookingAccess(centerLead.bookingAccess);
      if (!bookingAccess.isEnabled) {
        throw new ApiError(403, '아직 순차 안내 전인 문의 건입니다. 센터에서 예약 가능 상태로 열어드린 뒤 다시 시도해주세요.');
      }

      if (!slotSnap.exists) {
        throw new ApiError(404, '선택한 상담 시간이 존재하지 않습니다.');
      }

      const slot = { ...(slotSnap.data() as WebsiteConsultSlot), id: slotSnap.id };
      if (!slot.isPublished) {
        throw new ApiError(409, '현재 공개되지 않은 상담 시간입니다.');
      }
      if (toDateMs(slot.startsAt) <= Date.now()) {
        throw new ApiError(409, '이미 지난 상담 시간입니다. 다른 시간을 선택해 주세요.');
      }

      const activeReservations = slotReservationsSnap.docs
        .map((doc) => ({ ...(doc.data() as WebsiteConsultReservation), id: doc.id }))
        .filter((reservation) => isActiveWebsiteConsultReservation(reservation.status));

      if (activeReservations.length >= Math.max(1, Number(slot.capacity || 1))) {
        throw new ApiError(409, '방금 다른 보호자가 먼저 예약했습니다. 다른 시간을 선택해 주세요.');
      }

      const reservation: WebsiteConsultReservation = {
        id: reservationRef.id,
        centerId,
        leadId,
        consultPhone,
        studentName: String(lead.studentName || '학생'),
        school: typeof lead.school === 'string' ? lead.school : null,
        grade: typeof lead.grade === 'string' ? lead.grade : null,
        receiptId: typeof lead.receiptId === 'string' ? lead.receiptId : null,
        requestType: typeof lead.requestType === 'string' ? lead.requestType : null,
        requestTypeLabel: typeof lead.requestTypeLabel === 'string' ? lead.requestTypeLabel : null,
        slotId,
        scheduledAt: slot.startsAt,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        status: 'confirmed',
        createdAt,
        updatedAt: createdAt,
        createdByUid: null,
        updatedByUid: null,
      };

      transaction.set(reservationRef, reservation);
      transaction.set(
        leadRef,
        {
          linkedConsultReservationId: reservation.id,
          linkedConsultReservationIds: buildLeadLinkPatch(
            reservation.id,
            Array.isArray(lead.linkedConsultReservationIds)
              ? (lead.linkedConsultReservationIds as string[])
              : []
          ),
          updatedAt: createdAt,
        },
        { merge: true }
      );

      transaction.set(
        centerLeadRef,
        {
          linkedConsultReservationId: reservation.id,
          linkedConsultReservationIds: buildLeadLinkPatch(
            reservation.id,
            Array.isArray(centerLead.linkedConsultReservationIds)
              ? (centerLead.linkedConsultReservationIds as string[])
              : []
          ),
          updatedAt: createdAt,
        },
        { merge: true }
      );

      return {
        reservation,
        slotLabel: formatSlotLabel(slot),
      };
    });

    return noStoreJson({
      ok: true,
      reservationId: reservationData.reservation.id,
      scheduledAt: reservationData.reservation.scheduledAt,
      studentName: reservationData.reservation.studentName,
      slotLabel: reservationData.slotLabel,
    });
  } catch (error) {
    const apiError = error instanceof ApiError ? error : null;
    if (!apiError) {
      console.error('[consult/reservations][POST] failed', error);
    }
    return noStoreJson(
      {
        ok: false,
        message: apiError?.message || '상담 예약 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      },
      { status: apiError?.status || 500 }
    );
  }
}
