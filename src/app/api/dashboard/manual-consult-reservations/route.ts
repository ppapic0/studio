import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  applyIpRateLimit,
  forbiddenJson,
  hasTrustedBrowserContext,
  noStoreJson,
  tooManyRequestsJson,
} from '@/lib/api-security';
import { isActiveMembershipStatus, isAdminRole } from '@/lib/dashboard-access';
import { adminDb, isMissingAdminCredentialsError } from '@/lib/firebase-admin';
import { getVerifiedServerSession } from '@/lib/server-auth-session';
import {
  formatSlotLabel,
  isActiveWebsiteConsultReservation,
  normalizePhone,
  toDateMs,
} from '@/lib/website-consult';
import type { WebsiteConsultReservation, WebsiteConsultSlot } from '@/lib/types';

export const dynamic = 'force-dynamic';

const MANUAL_CONSULT_SOURCE = 'center_phone_manual';
const MANUAL_CONSULT_SOURCE_LABEL = '센터 전화 수기 예약';
const STUDY_CENTER_REQUEST_TYPE = 'study_center_consult';
const STUDY_CENTER_REQUEST_TYPE_LABEL = '관리형 스터디센터 상담';

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const manualReservationSchema = z.object({
  centerId: z.string().trim().min(1, '센터 정보를 확인해 주세요.'),
  slotId: z.string().trim().min(1, '상담 시간을 선택해 주세요.'),
  consultPhone: z
    .string()
    .trim()
    .transform(normalizePhone)
    .refine((value) => value.length >= 8 && value.length <= 15, '학부모 연락처를 다시 확인해 주세요.'),
  studentName: z.string().trim().min(1, '학생 이름을 입력해 주세요.').max(40, '학생 이름이 너무 깁니다.'),
});

function getKoreaDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function getCenterMembership(uid: string, centerId: string) {
  const [memberSnap, userCenterSnap] = await Promise.all([
    adminDb.doc(`centers/${centerId}/members/${uid}`).get(),
    adminDb.doc(`userCenters/${uid}/centers/${centerId}`).get(),
  ]);

  const memberData = memberSnap.data() || {};
  const userCenterData = userCenterSnap.data() || {};

  return {
    role: memberData.role || userCenterData.role || null,
    status: memberData.status || userCenterData.status || null,
  };
}

export async function POST(request: NextRequest) {
  const rateLimit = applyIpRateLimit(request, 'dashboard:manual-consult-reservation', {
    max: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return tooManyRequestsJson(rateLimit.retryAfterSeconds, '상담 예약 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
  }

  if (!hasTrustedBrowserContext(request)) {
    return forbiddenJson('허용되지 않은 예약 요청입니다.');
  }

  try {
    const session = await getVerifiedServerSession();
    if (!session?.uid) {
      return noStoreJson(
        {
          ok: false,
          message: '로그인이 필요합니다.',
        },
        { status: 401 }
      );
    }

    const parsed = manualReservationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return noStoreJson(
        {
          ok: false,
          message: parsed.error.issues[0]?.message ?? '입력값을 확인해 주세요.',
        },
        { status: 400 }
      );
    }

    const { centerId, slotId, consultPhone, studentName } = parsed.data;
    const membership = await getCenterMembership(session.uid, centerId);

    if (!isAdminRole(membership.role) || !isActiveMembershipStatus(membership.status)) {
      return noStoreJson(
        {
          ok: false,
          message: '센터관리자만 수기 상담 예약을 등록할 수 있습니다.',
        },
        { status: 403 }
      );
    }

    const centerRef = adminDb.collection('centers').doc(centerId);
    const requestRef = adminDb.collection('marketingConsultRequests').doc();
    const centerRequestRef = centerRef.collection('websiteConsultRequests').doc(requestRef.id);
    const reservationRef = centerRef.collection('websiteConsultReservations').doc();
    const receiptId = requestRef.id.slice(0, 8).toUpperCase();

    const reservationData = await adminDb.runTransaction(async (transaction) => {
      const slotRef = centerRef.collection('websiteConsultSlots').doc(slotId);
      const reservationQuery = centerRef
        .collection('websiteConsultReservations')
        .where('slotId', '==', slotId)
        .limit(10);

      const [slotSnap, slotReservationsSnap] = await Promise.all([
        transaction.get(slotRef),
        transaction.get(reservationQuery),
      ]);

      if (!slotSnap.exists) {
        throw new ApiError(404, '선택한 상담 시간이 존재하지 않습니다.');
      }

      const slot = { ...(slotSnap.data() as WebsiteConsultSlot), id: slotSnap.id };
      if (toDateMs(slot.startsAt) <= Date.now()) {
        throw new ApiError(409, '이미 지난 상담 시간입니다. 다른 시간을 선택해 주세요.');
      }

      const activeReservations = slotReservationsSnap.docs
        .map((doc) => ({ ...(doc.data() as WebsiteConsultReservation), id: doc.id }))
        .filter((reservation) => isActiveWebsiteConsultReservation(reservation.status));

      if (activeReservations.length >= Math.max(1, Number(slot.capacity || 1))) {
        throw new ApiError(409, '방금 다른 상담이 먼저 잡혔습니다. 다른 시간을 선택해 주세요.');
      }

      const createdAt = new Date().toISOString();
      const consultationDate = getKoreaDateKey();
      const slotLabel = formatSlotLabel(slot);

      const requestPayload = {
        studentName,
        school: '',
        grade: '',
        consultPhone,
        centerId,
        consultationDate,
        serviceType: 'study_center',
        requestType: STUDY_CENTER_REQUEST_TYPE,
        requestTypeLabel: STUDY_CENTER_REQUEST_TYPE_LABEL,
        source: MANUAL_CONSULT_SOURCE,
        sourceLabel: MANUAL_CONSULT_SOURCE_LABEL,
        status: 'contacted',
        linkedLeadId: null,
        linkedConsultReservationId: reservationRef.id,
        linkedConsultReservationIds: [reservationRef.id],
        linkedSeatHoldRequestId: null,
        linkedSeatHoldRequestIds: [],
        receiptId,
        createdAt,
        updatedAt: createdAt,
        createdByUid: session.uid,
        updatedByUid: session.uid,
      };

      const reservationPayload: WebsiteConsultReservation = {
        id: reservationRef.id,
        centerId,
        leadId: requestRef.id,
        consultPhone,
        studentName,
        school: null,
        grade: null,
        receiptId,
        requestType: STUDY_CENTER_REQUEST_TYPE,
        requestTypeLabel: STUDY_CENTER_REQUEST_TYPE_LABEL,
        slotId: slot.id,
        scheduledAt: slot.startsAt,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        status: 'confirmed',
        createdAt,
        updatedAt: createdAt,
        createdByUid: session.uid,
        updatedByUid: session.uid,
      };

      transaction.set(requestRef, requestPayload);
      transaction.set(centerRequestRef, {
        ...requestPayload,
        bookingAccess: {
          isEnabled: true,
          unlockedAt: createdAt,
          unlockedByUid: session.uid,
          note: `${slotLabel} 전화 예약`,
        },
      });
      transaction.set(reservationRef, reservationPayload);

      return {
        reservationId: reservationRef.id,
        requestId: requestRef.id,
        receiptId,
        slotLabel,
        scheduledAt: slot.startsAt,
      };
    });

    return noStoreJson({
      ok: true,
      ...reservationData,
    });
  } catch (error) {
    if (isMissingAdminCredentialsError(error)) {
      return noStoreJson(
        {
          ok: false,
          message: '관리자 인증 구성이 없어 수기 예약을 저장할 수 없습니다.',
        },
        { status: 503 }
      );
    }

    const apiError = error instanceof ApiError ? error : null;
    if (!apiError) {
      console.error('[dashboard/manual-consult-reservations][POST] failed', error);
    }

    return noStoreJson(
      {
        ok: false,
        message: apiError?.message || '상담 예약 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      },
      { status: apiError?.status || 500 }
    );
  }
}
