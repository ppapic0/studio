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
  buildPublicSeatRooms,
  getWebsiteReservationSettings,
  isActiveWebsiteSeatHold,
  summarizePublicSeats,
  WEBSITE_RESERVATION_SETTINGS_DOC_ID,
} from '@/lib/website-consult';
import type {
  AttendanceCurrent,
  StudentProfile,
  WebsiteReservationSettings,
  WebsiteSeatHoldRequest,
} from '@/lib/types';
import { PRIMARY_ROOM_ID } from '@/lib/seat-layout';

export const dynamic = 'force-dynamic';

function normalizePublicRoomName(value?: string | null) {
  return typeof value === 'string' ? value.replace(/\s+/g, '') : '';
}

function getPublicRoomPriority(room: {
  roomId: string;
  roomName: string;
  seats: Array<{ seatNo: number }>;
}) {
  if (room.roomId === PRIMARY_ROOM_ID) return 0;

  const normalizedRoomName = normalizePublicRoomName(room.roomName);
  if (normalizedRoomName === '1호실') return 1;

  const namedRoomMatch = normalizedRoomName.match(/^(\d+)호실$/);
  if (namedRoomMatch) {
    return 10 + Number.parseInt(namedRoomMatch[1] || '999', 10);
  }

  const lowestSeatNo = room.seats.reduce((best, seat) => {
    if (!Number.isFinite(seat.seatNo) || seat.seatNo <= 0) return best;
    return Math.min(best, seat.seatNo);
  }, Number.MAX_SAFE_INTEGER);

  return lowestSeatNo === Number.MAX_SAFE_INTEGER ? 9999 : 100 + lowestSeatNo;
}

export async function GET(request: NextRequest) {
  const rateLimit = applyIpRateLimit(request, 'consult:seat-read', {
    max: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return tooManyRequestsJson(rateLimit.retryAfterSeconds, '좌석 현황 조회가 너무 많습니다. 잠시 후 다시 시도해주세요.');
  }

  if (!hasTrustedBrowserContext(request)) {
    return forbiddenJson('허용되지 않은 조회 경로입니다.');
  }

  try {
    const centerId = await resolveMarketingCenterId();
    if (!centerId) {
      return noStoreJson({
        ok: true,
        settings: getWebsiteReservationSettings(null),
        summary: { availableCount: 0, occupiedCount: 0, heldCount: 0, totalCount: 0 },
        rooms: [],
      });
    }

    const centerRef = adminDb.collection('centers').doc(centerId);
    const [centerSnap, studentSnapshot, attendanceSnapshot, seatHoldSnapshot, settingsSnap] =
      await Promise.all([
        centerRef.get(),
        centerRef.collection('students').get(),
        centerRef.collection('attendanceCurrent').get(),
        centerRef.collection('websiteSeatHoldRequests').limit(300).get(),
        centerRef
          .collection('websiteReservationSettings')
          .doc(WEBSITE_RESERVATION_SETTINGS_DOC_ID)
          .get(),
      ]);

    const students = studentSnapshot.docs.map((doc) => ({ ...(doc.data() as StudentProfile), id: doc.id }));
    const attendanceCurrent = attendanceSnapshot.docs.map((doc) => ({
      ...(doc.data() as AttendanceCurrent),
      id: doc.id,
    }));
    const seatHolds = seatHoldSnapshot.docs
      .map((doc) => ({ ...(doc.data() as WebsiteSeatHoldRequest), id: doc.id }))
      .filter((hold) => isActiveWebsiteSeatHold(hold.status));
    const settings = getWebsiteReservationSettings(
      settingsSnap.exists ? ({ ...(settingsSnap.data() as WebsiteReservationSettings), id: settingsSnap.id } as WebsiteReservationSettings) : null
    );

    const allRooms = buildPublicSeatRooms({
      layoutSettings: centerSnap.data()?.layoutSettings || null,
      students,
      attendanceCurrent,
      seatHoldRequests: seatHolds,
    });
    const rooms = (() => {
      const sortedRooms = [...allRooms].sort((left, right) => getPublicRoomPriority(left) - getPublicRoomPriority(right));
      const primaryRoom = sortedRooms[0];
      if (!primaryRoom) return [];

      const shouldExposeAsPrimaryRoom =
        primaryRoom.roomId === PRIMARY_ROOM_ID ||
        normalizePublicRoomName(primaryRoom.roomName) === '1호실' ||
        primaryRoom.seats.some((seat) => seat.seatNo === 1);

      return [
        {
          ...primaryRoom,
          roomName: shouldExposeAsPrimaryRoom ? '1호실' : primaryRoom.roomName,
        },
      ];
    })();
    const summary = summarizePublicSeats(rooms);

    return noStoreJson({
      ok: true,
      settings,
      summary,
      rooms,
    });
  } catch (error) {
    console.error('[consult/seats][GET] failed', error);
    return noStoreJson(
      {
        ok: false,
        message: '좌석 현황을 불러오는 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
