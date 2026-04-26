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
  buildSeatId,
  getGlobalSeatNo,
  normalizeLayoutRooms,
  normalizeSeatGenderBySeatId,
  normalizeSeatLabelsBySeatId,
} from '@/lib/seat-layout';
import { isAttendanceSeatOccupied } from '@/lib/website-consult';
import type { AttendanceCurrent, StudentProfile, WebsiteSeatHoldRequest } from '@/lib/types';
import * as admin from 'firebase-admin';

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
  nextStatus: z.enum(['held', 'pending_transfer', 'canceled']),
  seatAssignment: z
    .object({
      seatId: z.string().trim().min(1, '좌석 정보를 확인해 주세요.'),
      roomId: z.string().trim().min(1, '호실 정보를 확인해 주세요.'),
      roomSeatNo: z.number().int().positive('좌석 번호를 확인해 주세요.'),
      seatNo: z.number().int().positive('좌석 번호를 확인해 주세요.').optional(),
      seatLabel: z.string().trim().max(20).optional().nullable(),
      seatGenderPolicy: z.enum(['all', 'male', 'female']).optional().nullable(),
    })
    .optional(),
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

    const { centerId, seatHoldId, nextStatus, seatAssignment } = parsed.data;
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
      const releaseReservedAttendanceSeat = () => {
        const expectedManualName = `예약 ${seatHold.studentName}`;
        let releasedSeatCount = 0;

        attendanceSnap.docs.forEach((doc) => {
          const attendance = doc.data() as AttendanceCurrent;
          const manualName = typeof attendance.manualOccupantName === 'string' ? attendance.manualOccupantName.trim() : '';
          const requestId = (attendance as unknown as { seatHoldRequestId?: unknown }).seatHoldRequestId;
          const linkedToSeatHold =
            requestId === seatHold.id ||
            manualName === expectedManualName ||
            (doc.id === seatHold.seatId && manualName === seatHold.studentName);

          if (!linkedToSeatHold || attendance.studentId) return;

          transaction.delete(doc.ref);
          releasedSeatCount += 1;
        });

        return releasedSeatCount;
      };

      if (nextStatus === 'pending_transfer') {
        if (seatHold.status === 'canceled') {
          throw new ApiError(409, '취소된 좌석예약 요청은 다시 대기로 되돌릴 수 없습니다.');
        }

        if (seatHold.status !== 'held') {
          return {
            nextStatus,
            releasedSeatCount: 0,
            alreadyReleased: true,
            canceledCompetingCount: 0,
          };
        }

        const releasedSeatCount = releaseReservedAttendanceSeat();
        transaction.update(seatHoldRef, {
          status: 'pending_transfer',
          updatedAt: nowIso,
          confirmedAt: null,
          canceledAt: null,
          updatedByUid: session.uid,
        });

        return {
          nextStatus,
          releasedSeatCount,
          canceledCompetingCount: 0,
        };
      }

      if (nextStatus === 'canceled') {
        const releasedSeatCount = seatHold.status === 'held' ? releaseReservedAttendanceSeat() : 0;
        transaction.update(seatHoldRef, {
          status: 'canceled',
          updatedAt: nowIso,
          canceledAt: nowIso,
          confirmedAt: null,
          updatedByUid: session.uid,
        });

        return {
          nextStatus,
          releasedSeatCount,
          canceledCompetingCount: 0,
        };
      }

      if (seatHold.status === 'canceled') {
        throw new ApiError(409, '취소된 좌석예약 요청은 다시 확정할 수 없습니다.');
      }

      const centerData = centerSnap.data() || {};
      const rooms = normalizeLayoutRooms(centerData.layoutSettings || null);
      const fallbackRoomId = rooms[0]?.id || seatHold.roomId || 'room_1';
      const targetRoomId = seatAssignment?.roomId || seatHold.roomId || fallbackRoomId;
      const targetRoomSeatNo = Number(seatAssignment?.roomSeatNo || seatHold.roomSeatNo || 0);
      const targetSeatId = seatAssignment?.seatId || seatHold.seatId;
      const targetRoom = rooms.find((room) => room.id === targetRoomId);

      if (!targetRoom || targetRoomSeatNo <= 0 || targetRoomSeatNo > targetRoom.rows * targetRoom.cols) {
        throw new ApiError(400, '배정할 좌석이 현재 호실 배치 범위를 벗어났습니다.');
      }
      if (targetSeatId !== buildSeatId(targetRoomId, targetRoomSeatNo)) {
        throw new ApiError(400, '좌석 정보가 현재 배치와 맞지 않습니다.');
      }

      const seatLabelsBySeatId = normalizeSeatLabelsBySeatId(centerData.layoutSettings || null);
      const seatGenderBySeatId = normalizeSeatGenderBySeatId(centerData.layoutSettings || null);
      const targetSeatNo = seatAssignment?.seatNo || getGlobalSeatNo(targetRoomId, targetRoomSeatNo);
      const targetSeatLabel = seatAssignment?.seatLabel?.trim() || seatLabelsBySeatId[targetSeatId] || String(targetRoomSeatNo);
      const targetSeatGenderPolicy = seatAssignment?.seatGenderPolicy || seatGenderBySeatId[targetSeatId] || null;

      const occupiedByStudent = studentsSnap.docs.some((doc) => {
        const student = doc.data() as StudentProfile;
        const studentRoomId = student.roomId?.trim() || fallbackRoomId;
        return Number(student.roomSeatNo) === targetRoomSeatNo && studentRoomId === targetRoomId;
      });
      if (occupiedByStudent) {
        throw new ApiError(409, '이미 사용 중인 좌석이라 확정할 수 없습니다.');
      }

      const occupiedByAttendance = attendanceSnap.docs.some((doc) => {
        const attendance = doc.data() as AttendanceCurrent;
        if (doc.id === targetSeatId) {
          const manualName = typeof attendance.manualOccupantName === 'string' ? attendance.manualOccupantName.trim() : '';
          const isSameReservationHold =
            manualName === `예약 ${seatHold.studentName}` ||
            manualName === seatHold.studentName ||
            (attendance as unknown as Record<string, unknown>).seatHoldRequestId === seatHold.id;
          if (isSameReservationHold && !attendance.studentId) return false;
        }
        if (!isAttendanceSeatOccupied(attendance)) return false;
        const attendanceRoomId = attendance.roomId?.trim() || fallbackRoomId;
        return Number(attendance.roomSeatNo) === targetRoomSeatNo && attendanceRoomId === targetRoomId;
      });
      if (occupiedByAttendance) {
        throw new ApiError(409, '현재 사용 중으로 표시된 좌석이라 확정할 수 없습니다.');
      }

      const sameSeatQuery = centerRef
        .collection('websiteSeatHoldRequests')
        .where('seatId', '==', targetSeatId)
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
        seatId: targetSeatId,
        roomId: targetRoomId,
        roomSeatNo: targetRoomSeatNo,
        seatNo: targetSeatNo,
        seatLabel: targetSeatLabel,
        seatGenderPolicy: targetSeatGenderPolicy,
        updatedAt: nowIso,
        confirmedAt: nowIso,
        canceledAt: null,
        updatedByUid: session.uid,
      });

      if (seatAssignment) {
        transaction.set(
          centerRef.collection('attendanceCurrent').doc(targetSeatId),
          {
            studentId: null,
            manualOccupantName: `예약 ${seatHold.studentName}`,
            seatHoldRequestId: seatHold.id,
            type: 'seat',
            status: 'absent',
            seatNo: targetSeatNo,
            roomId: targetRoomId,
            roomSeatNo: targetRoomSeatNo,
            seatLabel: targetSeatLabel || admin.firestore.FieldValue.delete(),
            seatGenderPolicy: targetSeatGenderPolicy || admin.firestore.FieldValue.delete(),
            lastCheckInAt: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

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
