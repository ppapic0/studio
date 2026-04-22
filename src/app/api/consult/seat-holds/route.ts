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
  getWebsiteBookingAccess,
  getWebsiteReservationSettings,
  isAttendanceSeatOccupied,
  isActiveWebsiteSeatHold,
  isStudyCenterLead,
  normalizePhone,
  WEBSITE_RESERVATION_SETTINGS_DOC_ID,
} from '@/lib/website-consult';
import {
  buildSeatId,
  getSeatDisplayLabel,
  getSeatGenderPolicyLabel,
  getGlobalSeatNo,
  getRoomLabel,
  isSeatGenderPolicyCompatible,
  normalizeLayoutRooms,
  normalizeSeatGenderBySeatId,
  normalizeSeatLabelsBySeatId,
  normalizeLeadGender,
  PRIMARY_ROOM_ID,
} from '@/lib/seat-layout';
import type {
  AttendanceCurrent,
  StudentProfile,
  WebsiteReservationSettings,
  WebsiteSeatHoldRequest,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const seatHoldSchema = z.object({
  leadId: z.string().trim().min(1, '연결할 접수 건을 선택해 주세요.'),
  consultPhone: z
    .string()
    .trim()
    .transform(normalizePhone)
    .refine((value) => value.length >= 8 && value.length <= 15, '연락처를 다시 확인해 주세요.'),
  roomId: z.string().trim().min(1, '호실 정보가 필요합니다.'),
  roomSeatNo: z.number().int().positive('좌석 번호가 올바르지 않습니다.'),
  seatId: z.string().trim().min(1, '좌석 정보를 다시 선택해 주세요.'),
  policyAccepted: z.boolean().refine((value) => value, '환불 불가 안내 동의가 필요합니다.'),
});

export async function POST(request: NextRequest) {
  const rateLimit = applyIpRateLimit(request, 'consult:seat-hold-create', {
    max: 8,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return tooManyRequestsJson(rateLimit.retryAfterSeconds, '좌석예약 신청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
  }

  if (!hasTrustedBrowserContext(request)) {
    return forbiddenJson('허용되지 않은 좌석예약 요청입니다.');
  }

  try {
    const parsed = seatHoldSchema.safeParse(await request.json());
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
      throw new ApiError(503, '센터 정보가 아직 준비되지 않았습니다.');
    }

    const { leadId, consultPhone, roomId, roomSeatNo, seatId } = parsed.data;
    const centerRef = adminDb.collection('centers').doc(centerId);
    const seatHoldRef = centerRef.collection('websiteSeatHoldRequests').doc();
    const createdAt = new Date().toISOString();

    const seatHold = await adminDb.runTransaction(async (transaction) => {
      const leadRef = adminDb.collection('marketingConsultRequests').doc(leadId);
      const centerLeadRef = centerRef.collection('websiteConsultRequests').doc(leadId);
      const settingsRef = centerRef
        .collection('websiteReservationSettings')
        .doc(WEBSITE_RESERVATION_SETTINGS_DOC_ID);
      const seatHoldQuery = centerRef
        .collection('websiteSeatHoldRequests')
        .where('seatId', '==', seatId)
        .limit(10);

      const [leadSnap, centerLeadSnap, centerSnap, settingsSnap, studentsSnap, attendanceSnap, seatHoldSnap] =
        await Promise.all([
          transaction.get(leadRef),
          transaction.get(centerLeadRef),
          transaction.get(centerRef),
          transaction.get(settingsRef),
          transaction.get(centerRef.collection('students')),
          transaction.get(centerRef.collection('attendanceCurrent')),
          transaction.get(seatHoldQuery),
        ]);

      if (!leadSnap.exists) {
        throw new ApiError(404, '연결된 접수 건을 찾을 수 없습니다.');
      }

      const lead = leadSnap.data() as Record<string, any>;
      if (normalizePhone(String(lead.consultPhone || '')) !== consultPhone) {
        throw new ApiError(403, '입력한 연락처와 접수된 연락처가 일치하지 않습니다.');
      }
      if (!isStudyCenterLead(lead)) {
        throw new ApiError(409, '관리형 스터디센터 문의 건만 좌석예약을 신청할 수 있습니다.');
      }
      if (lead.centerId && lead.centerId !== centerId) {
        throw new ApiError(403, '다른 센터 문의 건으로는 좌석예약을 신청할 수 없습니다.');
      }
      if (!centerLeadSnap.exists) {
        throw new ApiError(403, '아직 순차 안내 전인 문의 건입니다. 센터에서 예약 가능 상태로 열어드린 뒤 다시 시도해주세요.');
      }

      const centerLead = centerLeadSnap.data() as Record<string, any>;
      const bookingAccess = getWebsiteBookingAccess(centerLead.bookingAccess);
      if (!bookingAccess.isEnabled) {
        throw new ApiError(403, '아직 순차 안내 전인 문의 건입니다. 센터에서 예약 가능 상태로 열어드린 뒤 다시 시도해주세요.');
      }

      const rooms = normalizeLayoutRooms(centerSnap.data()?.layoutSettings || null);
      const primaryRoom = rooms.find((item) => item.id === PRIMARY_ROOM_ID) || rooms[0];
      if (!primaryRoom) {
        throw new ApiError(503, '좌석 배치 정보가 아직 준비되지 않았습니다.');
      }
      if (roomId !== primaryRoom.id) {
        throw new ApiError(400, '현재 공개 좌석은 1호실만 신청할 수 있습니다.');
      }
      const room = rooms.find((item) => item.id === roomId);
      if (!room) {
        throw new ApiError(400, '존재하지 않는 호실입니다.');
      }
      const maxSeats = Math.max(1, room.rows * room.cols);
      if (roomSeatNo > maxSeats) {
        throw new ApiError(400, '존재하지 않는 좌석입니다.');
      }
      if (seatId !== buildSeatId(roomId, roomSeatNo)) {
        throw new ApiError(400, '좌석 정보가 일치하지 않습니다. 다시 선택해 주세요.');
      }

      const seatGenderBySeatId = normalizeSeatGenderBySeatId(centerSnap.data()?.layoutSettings || null);
      const seatGenderPolicy = seatGenderBySeatId[seatId] || 'all';
      const normalizedLeadGender = normalizeLeadGender(lead.gender);
      if (!isSeatGenderPolicyCompatible(seatGenderPolicy, lead.gender)) {
        const seatGenderLabel = getSeatGenderPolicyLabel(seatGenderPolicy);
        throw new ApiError(
          403,
          normalizedLeadGender
            ? `${seatGenderLabel} 좌석입니다. 학생 성별에 맞는 좌석을 선택해 주세요.`
            : `${seatGenderLabel} 좌석은 학생 성별 확인 후에만 예약할 수 있습니다. 공용 좌석을 선택해 주세요.`
        );
      }

      const isAisleSeat = attendanceSnap.docs.some((doc) => {
        const attendance = doc.data() as AttendanceCurrent;
        if (attendance.type !== 'aisle') return false;
        const attendanceRoomId = attendance.roomId?.trim() || rooms[0]?.id || 'room_1';
        return Number(attendance.roomSeatNo) === roomSeatNo && attendanceRoomId === roomId;
      });
      if (isAisleSeat) {
        throw new ApiError(400, '통로로 설정된 칸은 좌석예약을 신청할 수 없습니다.');
      }

      const occupiedByStudent = studentsSnap.docs.some((doc) => {
        const student = doc.data() as StudentProfile;
        const studentRoomId = student.roomId?.trim() || rooms[0]?.id || 'room_1';
        return Number(student.roomSeatNo) === roomSeatNo && studentRoomId === roomId;
      });
      if (occupiedByStudent) {
        throw new ApiError(409, '이미 사용 중인 좌석입니다. 다른 자리를 선택해 주세요.');
      }

      const occupiedByAttendance = attendanceSnap.docs.some((doc) => {
        const attendance = doc.data() as AttendanceCurrent;
        if (!isAttendanceSeatOccupied(attendance)) return false;
        const attendanceRoomId = attendance.roomId?.trim() || rooms[0]?.id || 'room_1';
        return Number(attendance.roomSeatNo) === roomSeatNo && attendanceRoomId === roomId;
      });
      if (occupiedByAttendance) {
        throw new ApiError(409, '현재 사용 중으로 표시된 좌석입니다. 다른 자리를 선택해 주세요.');
      }

      const alreadyHeld = seatHoldSnap.docs.some((doc) => {
        const currentHold = doc.data() as WebsiteSeatHoldRequest;
        return isActiveWebsiteSeatHold(currentHold.status);
      });
      if (alreadyHeld) {
        throw new ApiError(409, '방금 다른 보호자가 먼저 좌석예약을 신청했습니다. 다른 자리를 선택해 주세요.');
      }

      const settings = getWebsiteReservationSettings(
        settingsSnap.exists ? ({ id: settingsSnap.id, ...settingsSnap.data() } as WebsiteReservationSettings) : null
      );
      const displaySeatLabel =
        getSeatDisplayLabel(
          {
            roomId,
            roomSeatNo,
            seatId,
          },
          normalizeSeatLabelsBySeatId(centerSnap.data()?.layoutSettings || null)
        ) || String(roomSeatNo);
      const seatLabel = `${getRoomLabel(roomId, rooms)} ${displaySeatLabel}번`;
      const seatNo = getGlobalSeatNo(roomId, roomSeatNo);

      const hold: WebsiteSeatHoldRequest = {
        id: seatHoldRef.id,
        centerId,
        leadId,
        consultPhone,
        studentName: String(lead.studentName || '학생'),
        school: typeof lead.school === 'string' ? lead.school : null,
        grade: typeof lead.grade === 'string' ? lead.grade : null,
        receiptId: typeof lead.receiptId === 'string' ? lead.receiptId : null,
        requestType: typeof lead.requestType === 'string' ? lead.requestType : null,
        requestTypeLabel: typeof lead.requestTypeLabel === 'string' ? lead.requestTypeLabel : null,
        seatId,
        roomId,
        roomSeatNo,
        seatNo,
        seatLabel,
        seatGenderPolicy,
        seatGenderLabel: getSeatGenderPolicyLabel(seatGenderPolicy),
        status: 'pending_transfer',
        depositAmount: settings.depositAmount,
        bankAccountDisplay: settings.bankAccountDisplay,
        depositorGuide: settings.depositorGuide,
        nonRefundableNotice: settings.nonRefundableNotice,
        policyAcceptedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
        createdByUid: null,
        updatedByUid: null,
      };

      transaction.set(seatHoldRef, hold);
      transaction.set(
        leadRef,
        {
          linkedSeatHoldRequestId: hold.id,
          linkedSeatHoldRequestIds: buildLeadLinkPatch(
            hold.id,
            Array.isArray(lead.linkedSeatHoldRequestIds)
              ? (lead.linkedSeatHoldRequestIds as string[])
              : []
          ),
          updatedAt: createdAt,
        },
        { merge: true }
      );

      transaction.set(
        centerLeadRef,
        {
          linkedSeatHoldRequestId: hold.id,
          linkedSeatHoldRequestIds: buildLeadLinkPatch(
            hold.id,
            Array.isArray(centerLead.linkedSeatHoldRequestIds)
              ? (centerLead.linkedSeatHoldRequestIds as string[])
              : []
          ),
          updatedAt: createdAt,
        },
        { merge: true }
      );

      return hold;
    });

    return noStoreJson({
      ok: true,
      seatHoldRequestId: seatHold.id,
      seatLabel: seatHold.seatLabel,
      depositAmount: seatHold.depositAmount,
      bankAccountDisplay: seatHold.bankAccountDisplay,
      depositorGuide: seatHold.depositorGuide,
    });
  } catch (error) {
    const apiError = error instanceof ApiError ? error : null;
    if (!apiError) {
      console.error('[consult/seat-holds][POST] failed', error);
    }
    return noStoreJson(
      {
        ok: false,
        message: apiError?.message || '좌석예약 신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      },
      { status: apiError?.status || 500 }
    );
  }
}
