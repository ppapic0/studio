import type {
  AttendanceCurrent,
  LayoutSettings,
  StudentProfile,
  WebsiteBookingAccess,
  WebsiteConsultReservation,
  WebsiteConsultSlot,
  WebsiteReservationSettings,
  WebsiteSeatHoldRequest,
} from '@/lib/types';
import {
  buildSeatId,
  getGlobalSeatNo,
  getRoomLabel,
  normalizeLayoutRooms,
} from '@/lib/seat-layout';

export const WEBSITE_RESERVATION_SETTINGS_DOC_ID = 'default';
export const DEFAULT_WEBSITE_BANK_ACCOUNT_DISPLAY =
  '1005104905953 / 김재윤(트랙 관리형 스터디센터)';
export const DEFAULT_WEBSITE_DEPOSITOR_GUIDE = '학생이름(학교)로 보내주세요.';
export const DEFAULT_WEBSITE_DEPOSIT_AMOUNT = 50000;
export const DEFAULT_WEBSITE_NON_REFUNDABLE_NOTICE =
  '자리찜 예약금 5만원은 상담 취소 또는 단순 변심 시에도 환불되지 않습니다.';
export const DEFAULT_WEBSITE_SLOT_GUIDE =
  '상담 시간은 센터가 미리 연 고정 슬롯만 예약할 수 있습니다.';
export const DEFAULT_WEBSITE_SEAT_GUIDE =
  '빈 좌석번호를 확인한 뒤 원하는 자리를 선택해 자리찜을 신청할 수 있습니다.';

export type PublicSeatStatus = 'available' | 'occupied' | 'held';

export type PublicSeatCell = {
  seatId: string;
  roomId: string;
  roomName: string;
  roomSeatNo: number;
  seatNo: number;
  label: string;
  status: PublicSeatStatus;
  statusLabel: string;
};

export type PublicSeatRoom = {
  roomId: string;
  roomName: string;
  rows: number;
  cols: number;
  seats: PublicSeatCell[];
};

export type PublicSeatSummary = {
  availableCount: number;
  occupiedCount: number;
  heldCount: number;
  totalCount: number;
};

type TimestampLike = { toDate?: () => Date } | Date | string | null | undefined;

export function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

export function toDateMs(value: TimestampLike) {
  if (!value) return 0;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  }
  if (typeof value.toDate === 'function') {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
  }
  return 0;
}

export function sortIsoLikeDesc<T>(items: T[], getValue: (item: T) => TimestampLike) {
  return [...items].sort((a, b) => toDateMs(getValue(b)) - toDateMs(getValue(a)));
}

export function isActiveWebsiteConsultReservation(
  status?: WebsiteConsultReservation['status'] | null
) {
  return status === 'confirmed';
}

export function isActiveWebsiteSeatHold(status?: WebsiteSeatHoldRequest['status'] | null) {
  return status === 'pending_transfer' || status === 'held';
}

export function isStudyCenterLead(input: {
  serviceType?: string | null;
  requestType?: string | null;
}) {
  return input.serviceType === 'study_center' || input.requestType?.startsWith('study_center') === true;
}

export function getWebsiteBookingAccess(
  access?: Partial<WebsiteBookingAccess> | null
): WebsiteBookingAccess {
  return {
    isEnabled: access?.isEnabled === true,
    unlockedAt: typeof access?.unlockedAt === 'string' ? access.unlockedAt : null,
    unlockedByUid: typeof access?.unlockedByUid === 'string' ? access.unlockedByUid : null,
    note: typeof access?.note === 'string' && access.note.trim() ? access.note.trim() : null,
  };
}

export function getWebsiteReservationSettings(
  settings?: Partial<WebsiteReservationSettings> | null
): WebsiteReservationSettings {
  return {
    id: WEBSITE_RESERVATION_SETTINGS_DOC_ID,
    centerId: settings?.centerId ?? null,
    isPublicEnabled: settings?.isPublicEnabled ?? true,
    bankAccountDisplay: settings?.bankAccountDisplay?.trim() || DEFAULT_WEBSITE_BANK_ACCOUNT_DISPLAY,
    depositAmount:
      Number.isFinite(settings?.depositAmount) && Number(settings?.depositAmount) > 0
        ? Number(settings?.depositAmount)
        : DEFAULT_WEBSITE_DEPOSIT_AMOUNT,
    depositorGuide: settings?.depositorGuide?.trim() || DEFAULT_WEBSITE_DEPOSITOR_GUIDE,
    nonRefundableNotice:
      settings?.nonRefundableNotice?.trim() || DEFAULT_WEBSITE_NON_REFUNDABLE_NOTICE,
    slotGuideText: settings?.slotGuideText?.trim() || DEFAULT_WEBSITE_SLOT_GUIDE,
    seatGuideText: settings?.seatGuideText?.trim() || DEFAULT_WEBSITE_SEAT_GUIDE,
    createdAt: settings?.createdAt,
    updatedAt: settings?.updatedAt,
    updatedByUid: settings?.updatedByUid ?? null,
  };
}

function getSeatStatusLabel(status: PublicSeatStatus) {
  if (status === 'occupied') return '사용 중';
  if (status === 'held') return '자리찜 진행';
  return '빈자리';
}

export function buildPublicSeatRooms(params: {
  layoutSettings?: LayoutSettings | Record<string, unknown> | null;
  students?: StudentProfile[] | null;
  attendanceCurrent?: AttendanceCurrent[] | null;
  seatHoldRequests?: WebsiteSeatHoldRequest[] | null;
}) {
  const rooms = normalizeLayoutRooms(params.layoutSettings);
  const occupiedSeatIds = new Set<string>();
  const heldSeatIds = new Set<string>();

  (params.students || []).forEach((student) => {
    if (!Number.isFinite(student.roomSeatNo) || Number(student.roomSeatNo) <= 0) return;
    const roomId = student.roomId?.trim() || rooms[0]?.id || 'room_1';
    occupiedSeatIds.add(buildSeatId(roomId, Number(student.roomSeatNo)));
  });

  (params.attendanceCurrent || []).forEach((attendance) => {
    if (attendance.type === 'aisle') return;
    if (!Number.isFinite(attendance.roomSeatNo) || Number(attendance.roomSeatNo) <= 0) return;
    const roomId = attendance.roomId?.trim() || rooms[0]?.id || 'room_1';
    occupiedSeatIds.add(buildSeatId(roomId, Number(attendance.roomSeatNo)));
  });

  (params.seatHoldRequests || []).forEach((hold) => {
    if (!isActiveWebsiteSeatHold(hold.status)) return;
    heldSeatIds.add(hold.seatId);
  });

  const publicRooms: PublicSeatRoom[] = rooms.map((room) => {
    const totalSeats = Math.max(1, room.rows * room.cols);
    const seats: PublicSeatCell[] = [];

    for (let roomSeatNo = 1; roomSeatNo <= totalSeats; roomSeatNo += 1) {
      const seatId = buildSeatId(room.id, roomSeatNo);
      const isOccupied = occupiedSeatIds.has(seatId);
      const isHeld = !isOccupied && heldSeatIds.has(seatId);
      const status: PublicSeatStatus = isOccupied ? 'occupied' : isHeld ? 'held' : 'available';
      const seatNo = getGlobalSeatNo(room.id, roomSeatNo);

      seats.push({
        seatId,
        roomId: room.id,
        roomName: getRoomLabel(room.id, rooms),
        roomSeatNo,
        seatNo,
        label: `${getRoomLabel(room.id, rooms)} ${roomSeatNo}번`,
        status,
        statusLabel: getSeatStatusLabel(status),
      });
    }

    return {
      roomId: room.id,
      roomName: getRoomLabel(room.id, rooms),
      rows: room.rows,
      cols: room.cols,
      seats,
    };
  });

  return publicRooms;
}

export function summarizePublicSeats(rooms: PublicSeatRoom[]): PublicSeatSummary {
  const allSeats = rooms.flatMap((room) => room.seats);
  const availableCount = allSeats.filter((seat) => seat.status === 'available').length;
  const occupiedCount = allSeats.filter((seat) => seat.status === 'occupied').length;
  const heldCount = allSeats.filter((seat) => seat.status === 'held').length;

  return {
    availableCount,
    occupiedCount,
    heldCount,
    totalCount: allSeats.length,
  };
}

export function buildLeadLinkPatch(
  nextId: string,
  currentIds?: string[] | null
) {
  return Array.from(new Set([...(currentIds || []), nextId]));
}

export function formatSlotLabel(slot: Pick<WebsiteConsultSlot, 'label' | 'startsAt' | 'endsAt'>) {
  if (slot.label?.trim()) return slot.label.trim();
  const start = new Date(slot.startsAt);
  const end = new Date(slot.endsAt);
  const startLabel = Number.isNaN(start.getTime())
    ? ''
    : new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        minute: '2-digit',
      }).format(start);
  const endLabel = Number.isNaN(end.getTime())
    ? ''
    : new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        minute: '2-digit',
      }).format(end);
  return [startLabel, endLabel].filter(Boolean).join(' - ') || '상담 슬롯';
}
