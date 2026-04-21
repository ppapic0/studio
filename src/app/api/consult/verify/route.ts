import { NextRequest } from 'next/server';

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
  getWebsiteBookingAccess,
  isStudyCenterLead,
  normalizePhone,
  sortIsoLikeDesc,
  toDateMs,
} from '@/lib/website-consult';
import type {
  WebsiteBookingAccessStatus,
  WebsiteConsultReservation,
  WebsiteSeatHoldRequest,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

type LeadCandidate = {
  id: string;
  receiptId?: string | null;
  studentName: string;
  school?: string | null;
  grade?: string | null;
  gender?: string | null;
  consultPhone: string;
  serviceType?: string | null;
  requestType?: string | null;
  requestTypeLabel?: string | null;
  createdAt?: string | null;
  bookingAccessStatus: WebsiteBookingAccessStatus;
  canReserve: boolean;
  canSeatHold: boolean;
  bookingAccessNote?: string | null;
  latestConsultReservationStatus?: string | null;
  latestSeatHoldStatus?: string | null;
};

type MarketingLeadRecord = {
  id: string;
  centerId?: string | null;
  receiptId?: string | null;
  studentName?: string | null;
  school?: string | null;
  grade?: string | null;
  gender?: string | null;
  consultPhone?: string | null;
  serviceType?: string | null;
  requestType?: string | null;
  requestTypeLabel?: string | null;
  createdAt?: string | null;
};

export async function GET(request: NextRequest) {
  const rateLimit = applyIpRateLimit(request, 'consult:verify', {
    max: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return tooManyRequestsJson(rateLimit.retryAfterSeconds, '인증 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
  }

  if (!hasTrustedBrowserContext(request)) {
    return forbiddenJson('허용되지 않은 인증 경로입니다.');
  }

  const { searchParams } = new URL(request.url);
  const normalizedPhone = normalizePhone(searchParams.get('phone') || '');

  if (normalizedPhone.length < 8) {
    return noStoreJson(
      {
        ok: false,
        message: '연락처를 입력해 주세요.',
      },
      { status: 400 }
    );
  }

  try {
    const centerId = await resolveMarketingCenterId();
    if (!centerId) {
      return noStoreJson({ ok: true, leads: [] });
    }

    const leadSnapshot = await adminDb
      .collection('marketingConsultRequests')
      .where('consultPhone', '==', normalizedPhone)
      .limit(20)
      .get();

    const leads = sortIsoLikeDesc(
      leadSnapshot.docs
        .map((doc) => ({ ...(doc.data() as Record<string, unknown>), id: doc.id } as MarketingLeadRecord))
        .filter((lead) => !lead.centerId || lead.centerId === centerId),
      (lead) => String(lead.createdAt || '')
    ).slice(0, 8);

    if (!leads.length) {
      return noStoreJson({ ok: true, leads: [] });
    }

    const leadIds = new Set(leads.map((lead) => lead.id));
    const centerRef = adminDb.collection('centers').doc(centerId);
    const centerLeadRefs = leads.map((lead) => centerRef.collection('websiteConsultRequests').doc(lead.id));
    const [centerLeadSnapshots, reservationSnapshot, seatHoldSnapshot] = await Promise.all([
      centerLeadRefs.length ? adminDb.getAll(...centerLeadRefs) : Promise.resolve([]),
      centerRef.collection('websiteConsultReservations').limit(300).get(),
      centerRef.collection('websiteSeatHoldRequests').limit(300).get(),
    ]);
    const centerLeadById = new Map<string, Record<string, unknown>>();
    centerLeadSnapshots.forEach((snap: any) => {
      if (!snap?.exists) return;
      centerLeadById.set(snap.id, snap.data() as Record<string, unknown>);
    });

    const latestReservationByLead = new Map<string, WebsiteConsultReservation>();
    reservationSnapshot.docs.forEach((doc) => {
      const reservation = { ...(doc.data() as WebsiteConsultReservation), id: doc.id };
      if (!leadIds.has(reservation.leadId)) return;
      const current = latestReservationByLead.get(reservation.leadId);
      if (!current || toDateMs(reservation.createdAt) > toDateMs(current.createdAt)) {
        latestReservationByLead.set(reservation.leadId, reservation);
      }
    });

    const latestSeatHoldByLead = new Map<string, WebsiteSeatHoldRequest>();
    seatHoldSnapshot.docs.forEach((doc) => {
      const hold = { ...(doc.data() as WebsiteSeatHoldRequest), id: doc.id };
      if (!leadIds.has(hold.leadId)) return;
      const current = latestSeatHoldByLead.get(hold.leadId);
      if (!current || toDateMs(hold.createdAt) > toDateMs(current.createdAt)) {
        latestSeatHoldByLead.set(hold.leadId, hold);
      }
    });

    const results: LeadCandidate[] = leads.map((lead) => {
      const bookingAccess = getWebsiteBookingAccess(
        centerLeadById.get(lead.id)?.bookingAccess as Record<string, unknown> | null | undefined
      );
      const isSeatHoldEligible = isStudyCenterLead({
        serviceType: typeof lead.serviceType === 'string' ? lead.serviceType : null,
        requestType: typeof lead.requestType === 'string' ? lead.requestType : null,
      });
      const bookingAccessStatus: WebsiteBookingAccessStatus = bookingAccess.isEnabled ? 'enabled' : 'locked';
      return {
        id: lead.id,
        receiptId: typeof lead.receiptId === 'string' ? lead.receiptId : null,
        studentName: String(lead.studentName || '학생'),
        school: typeof lead.school === 'string' ? lead.school : null,
        grade: typeof lead.grade === 'string' ? lead.grade : null,
        gender: typeof lead.gender === 'string' ? lead.gender : null,
        consultPhone: String(lead.consultPhone || normalizedPhone),
        serviceType: typeof lead.serviceType === 'string' ? lead.serviceType : null,
        requestType: typeof lead.requestType === 'string' ? lead.requestType : null,
        requestTypeLabel: typeof lead.requestTypeLabel === 'string' ? lead.requestTypeLabel : null,
        createdAt: typeof lead.createdAt === 'string' ? lead.createdAt : null,
        bookingAccessStatus,
        canReserve: bookingAccessStatus === 'enabled',
        canSeatHold: bookingAccessStatus === 'enabled' && isSeatHoldEligible,
        bookingAccessNote: bookingAccess.note,
        latestConsultReservationStatus: latestReservationByLead.get(lead.id)?.status || null,
        latestSeatHoldStatus: latestSeatHoldByLead.get(lead.id)?.status || null,
      };
    });

    return noStoreJson({ ok: true, leads: results });
  } catch (error) {
    console.error('[consult/verify][GET] failed', error);
    return noStoreJson(
      {
        ok: false,
        message: '전화번호 인증 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      },
      { status: 500 }
    );
  }
}
