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
import { normalizeLayoutRooms } from '@/lib/seat-layout';
import { isAttendanceSeatOccupied } from '@/lib/website-consult';
import type { AttendanceCurrent, StudentProfile, WebsiteSeatHoldRequest } from '@/lib/types';

export const dynamic = 'force-dynamic';

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const seatHoldStatusSchema = z.object({
  centerId: z.string().trim().min(1, '센터 정보를 확인해 주세요.'),
  seatHoldId: z.string().trim().min(1, '좌석예약 요청 정보를 확인해 주세요.'),
  nextStatus: z.enum(['held', 'canceled']),
});

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
  const rateLimit = applyIpRateLimit(request, 'dashboard:seat-hold-status', {
    max: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return tooManyRequestsJson(rateLimit.retryAfterSeconds, '좌석예약 상태 변경 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
  }

  if (!hasTrustedBrowserContext(request)) {
    return forbiddenJson('허용되지 않은 좌석예약 상태 변경 요청입니다.');
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

    const parsed = seatHoldStatusSchema.safeParse(await request.json());
    if (!parsed.success) {
      return noStoreJson(
        {
          ok: false,
          message: parsed.error.issues[0]?.message ?? '입력값을 확인해 주세요.',
        },
        { status: 400 }
      );
    }

    const { centerId, seatHoldId, nextStatus } = parsed.data;
    const membership = await getCenterMembership(session.uid, centerId);

    if (!isAdminRole(membership.role) || !isActiveMembershipStatus(membership.status)) {
      return noStoreJson(
        {
          ok: false,
          message: '센터관리자만 좌석예약 상태를 변경할 수 있습니다.',
        },
        { status: 403 }
      );
    }

    const centerRef = adminDb.collection('centers').doc(centerId);

    const result = await adminDb.runTransaction(async (transaction) => {
      const seatHoldRef = centerRef.collection('websiteSeatHoldRequests').doc(seatHoldId);
      const [seatHoldSnap, centerSnap, studentsSnap, attendanceSnap] = await Promise.all([
        transaction.get(seatHoldRef),
        transaction.get(centerRef),
        transaction.get(centerRef.collection('students')),
        transaction.get(centerRef.collection('attendanceCurrent')),
      ]);

      if (!seatHoldSnap.exists) {
        throw new ApiError(404, '좌석예약 요청을 찾을 수 없습니다.');
      }

      const seatHold = { ...(seatHoldSnap.data() as WebsiteSeatHoldRequest), id: seatHoldSnap.id };
      const nowIso = new Date().toISOString();

      if (nextStatus === 'canceled') {
        transaction.update(seatHoldRef, {
          status: 'canceled',
          updatedAt: nowIso,
          canceledAt: nowIso,
          confirmedAt: null,
          updatedByUid: session.uid,
        });

        return {
          nextStatus,
          canceledCompetingCount: 0,
        };
      }

      if (seatHold.status === 'canceled') {
        throw new ApiError(409, '취소된 좌석예약 요청은 다시 확정할 수 없습니다.');
      }

      const rooms = normalizeLayoutRooms(centerSnap.data()?.layoutSettings || null);
      const fallbackRoomId = rooms[0]?.id || seatHold.roomId || 'room_1';

      const occupiedByStudent = studentsSnap.docs.some((doc) => {
        const student = doc.data() as StudentProfile;
        const studentRoomId = student.roomId?.trim() || fallbackRoomId;
        return Number(student.roomSeatNo) === seatHold.roomSeatNo && studentRoomId === seatHold.roomId;
      });
      if (occupiedByStudent) {
        throw new ApiError(409, '이미 사용 중인 좌석이라 확정할 수 없습니다.');
      }

      const occupiedByAttendance = attendanceSnap.docs.some((doc) => {
        const attendance = doc.data() as AttendanceCurrent;
        if (!isAttendanceSeatOccupied(attendance)) return false;
        const attendanceRoomId = attendance.roomId?.trim() || fallbackRoomId;
        return Number(attendance.roomSeatNo) === seatHold.roomSeatNo && attendanceRoomId === seatHold.roomId;
      });
      if (occupiedByAttendance) {
        throw new ApiError(409, '현재 사용 중으로 표시된 좌석이라 확정할 수 없습니다.');
      }

      const sameSeatQuery = centerRef
        .collection('websiteSeatHoldRequests')
        .where('seatId', '==', seatHold.seatId)
        .limit(30);
      const sameSeatSnapshot = await transaction.get(sameSeatQuery);

      const alreadyConfirmed = sameSeatSnapshot.docs.some((doc) => {
        if (doc.id === seatHold.id) return false;
        const current = doc.data() as WebsiteSeatHoldRequest;
        return current.status === 'held';
      });
      if (alreadyConfirmed) {
        throw new ApiError(409, '이미 다른 요청이 확정된 좌석입니다.');
      }

      transaction.update(seatHoldRef, {
        status: 'held',
        updatedAt: nowIso,
        confirmedAt: nowIso,
        canceledAt: null,
        updatedByUid: session.uid,
      });

      let canceledCompetingCount = 0;
      sameSeatSnapshot.docs.forEach((doc) => {
        if (doc.id === seatHold.id) return;
        const current = doc.data() as WebsiteSeatHoldRequest;
        if (current.status !== 'pending_transfer') return;

        canceledCompetingCount += 1;
        transaction.update(doc.ref, {
          status: 'canceled',
          updatedAt: nowIso,
          canceledAt: nowIso,
          confirmedAt: null,
          updatedByUid: session.uid,
        });
      });

      return {
        nextStatus,
        canceledCompetingCount,
      };
    });

    return noStoreJson({
      ok: true,
      ...result,
    });
  } catch (error) {
    if (isMissingAdminCredentialsError(error)) {
      return noStoreJson(
        {
          ok: false,
          message: '관리자 인증 구성이 없어 좌석예약 상태를 저장할 수 없습니다.',
        },
        { status: 503 }
      );
    }

    const apiError = error instanceof ApiError ? error : null;
    if (!apiError) {
      console.error('[dashboard/seat-hold-status][POST] failed', error);
    }

    return noStoreJson(
      {
        ok: false,
        message: apiError?.message || '좌석예약 상태 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      },
      { status: apiError?.status || 500 }
    );
  }
}
