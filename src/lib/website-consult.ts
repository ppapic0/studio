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
  getSeatGenderPolicyLabel,
  getSeatGenderPolicyShortLabel,
  getSeatDisplayLabel,
  getGlobalSeatNo,
  getRoomLabel,
  normalizeAisleSeatIds,
  normalizeLayoutRooms,
  normalizeSeatGenderBySeatId,
  normalizeSeatLabelsBySeatId,
} from '@/lib/seat-layout';
import type { SeatGenderPolicy } from '@/lib/types';

export const WEBSITE_RESERVATION_SETTINGS_DOC_ID = 'default';
const LEGACY_WEBSITE_BANK_ACCOUNT_DISPLAY =
  '1005104905953 / 김재윤(트랙 관리형 스터디센터)';
export const DEFAULT_WEBSITE_BANK_ACCOUNT_DISPLAY =
  '1002461010935 / 김재윤';
export const DEFAULT_WEBSITE_DEPOSITOR_GUIDE = '학생이름(학교)로 보내주세요.';
export const DEFAULT_WEBSITE_DEPOSIT_AMOUNT = 50000;
const LEGACY_WEBSITE_NON_REFUNDABLE_NOTICE =
  '자리찜 예약금 5만원은 상담 취소 또는 단순 변심 시에도 환불되지 않습니다.';
export const DEFAULT_WEBSITE_NON_REFUNDABLE_NOTICE =
  '좌석예약 예약금 5만원은 방문 취소 또는 단순 변심 시에도 환불되지 않습니다.';
const LEGACY_WEBSITE_SLOT_GUIDE =
  '상담 시간은 센터가 미리 연 고정 슬롯만 예약할 수 있습니다.';
const SECONDARY_LEGACY_WEBSITE_SLOT_GUIDE =
  '홍보리드 DB에 등록된 연락처를 먼저 확인하고, 센터가 열어둔 문의 건만 방문예약과 좌석예약을 진행할 수 있습니다.';
const TERTIARY_LEGACY_WEBSITE_SLOT_GUIDE =
  '현재 방문 상담은 대기 순서에 따라 순차적으로 연락드리고 있습니다. 센터에서 연락을 드린 분에 한해 방문 상담 신청을 부탁드리며, 대기 순서에 맞지 않게 먼저 방문 상담을 신청해 주셔도 실제 방문 상담은 진행되지 않는 점 양해 부탁드립니다.';
export const DEFAULT_WEBSITE_SLOT_GUIDE =
  '현재 시설 방문 후 접수는 대기 순서에 따라 순차적으로 연락드리고 있습니다. 센터에서 연락을 드린 분에 한해 시설 방문 후 접수를 부탁드리며, 대기 순서에 맞지 않게 먼저 방문 후 접수를 신청해 주셔도 실제 방문 후 접수는 진행되지 않는 점 양해 부탁드립니다.';
const LEGACY_WEBSITE_SEAT_GUIDE =
  '빈 좌석번호를 확인한 뒤 원하는 자리를 선택해 자리찜을 신청할 수 있습니다.';
export const DEFAULT_WEBSITE_SEAT_GUIDE =
  '빈 좌석번호를 확인한 뒤 원하는 자리를 선택해 좌석예약을 신청할 수 있습니다.';

export type PublicSeatStatus = 'available' | 'occupied' | 'held';

export type PublicSeatCell = {
  cellType: 'seat' | 'aisle';
  seatId: string;
  roomId: string;
  roomName: string;
  roomSeatNo: number;
  seatNo: number;
  displayLabel: string;
  label: string;
  seatGenderPolicy: SeatGenderPolicy;
  seatGenderLabel: string;
  seatGenderShortLabel: string;
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
  // "completed" is used as an admin-side finalized reservation state, so it must
  // keep occupying the slot just like an active confirmed reservation.
  return status === 'confirmed' || status === 'completed';
}

export function isActiveWebsiteSeatHold(status?: WebsiteSeatHoldRequest['status'] | null) {
  // Seats should only be blocked after an admin confirms the deposit.
  return status === 'held';
}

export function isAttendanceSeatOccupied(attendance?: Partial<AttendanceCurrent> | null) {
  if (!attendance || attendance.type === 'aisle') return false;
  const manualOccupantName =
    typeof attendance.manualOccupantName === 'string' ? attendance.manualOccupantName.trim() : '';

  if (manualOccupantName) return true;
  if (typeof attendance.studentId === 'string' && attendance.studentId.trim()) return true;

  return (
    attendance.status === 'studying' ||
    attendance.status === 'away' ||
    attendance.status === 'break'
  );
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
  const normalizedBankAccountDisplay =
    settings?.bankAccountDisplay?.trim() === LEGACY_WEBSITE_BANK_ACCOUNT_DISPLAY
      ? DEFAULT_WEBSITE_BANK_ACCOUNT_DISPLAY
      : settings?.bankAccountDisplay?.trim();
  const normalizedNonRefundableNotice =
    settings?.nonRefundableNotice?.trim() === LEGACY_WEBSITE_NON_REFUNDABLE_NOTICE
      ? DEFAULT_WEBSITE_NON_REFUNDABLE_NOTICE
      : settings?.nonRefundableNotice?.trim();
  const normalizedSlotGuideText =
    settings?.slotGuideText?.trim() === LEGACY_WEBSITE_SLOT_GUIDE ||
    settings?.slotGuideText?.trim() === SECONDARY_LEGACY_WEBSITE_SLOT_GUIDE ||
    settings?.slotGuideText?.trim() === TERTIARY_LEGACY_WEBSITE_SLOT_GUIDE
      ? DEFAULT_WEBSITE_SLOT_GUIDE
      : settings?.slotGuideText?.trim();
  const normalizedSeatGuideText =
    settings?.seatGuideText?.trim() === LEGACY_WEBSITE_SEAT_GUIDE
      ? DEFAULT_WEBSITE_SEAT_GUIDE
      : settings?.seatGuideText?.trim();

  return {
    id: WEBSITE_RESERVATION_SETTINGS_DOC_ID,
    centerId: settings?.centerId ?? null,
    isPublicEnabled: settings?.isPublicEnabled ?? true,
    bankAccountDisplay: normalizedBankAccountDisplay || DEFAULT_WEBSITE_BANK_ACCOUNT_DISPLAY,
    depositAmount:
      Number.isFinite(settings?.depositAmount) && Number(settings?.depositAmount) > 0
        ? Number(settings?.depositAmount)
        : DEFAULT_WEBSITE_DEPOSIT_AMOUNT,
    depositorGuide: settings?.depositorGuide?.trim() || DEFAULT_WEBSITE_DEPOSITOR_GUIDE,
    nonRefundableNotice:
      normalizedNonRefundableNotice || DEFAULT_WEBSITE_NON_REFUNDABLE_NOTICE,
    slotGuideText: normalizedSlotGuideText || DEFAULT_WEBSITE_SLOT_GUIDE,
    seatGuideText: normalizedSeatGuideText || DEFAULT_WEBSITE_SEAT_GUIDE,
    createdAt: settings?.createdAt,
    updatedAt: settings?.updatedAt,
    updatedByUid: settings?.updatedByUid ?? null,
  };
}

function getSeatStatusLabel(status: PublicSeatStatus) {
  if (status === 'occupied') return '사용 중';
  if (status === 'held') return '좌석예약 확정';
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
  const aisleSeatIds = new Set<string>(normalizeAisleSeatIds(params.layoutSettings));
  const seatLabelsBySeatId = normalizeSeatLabelsBySeatId(params.layoutSettings);
  const seatGenderBySeatId = normalizeSeatGenderBySeatId(params.layoutSettings);

  (params.students || []).forEach((student) => {
    if (!Number.isFinite(student.roomSeatNo) || Number(student.roomSeatNo) <= 0) return;
    const roomId = student.roomId?.trim() || rooms[0]?.id || 'room_1';
    occupiedSeatIds.add(buildSeatId(roomId, Number(student.roomSeatNo)));
  });

  (params.attendanceCurrent || []).forEach((attendance) => {
    if (!Number.isFinite(attendance.roomSeatNo) || Number(attendance.roomSeatNo) <= 0) return;
    const roomId = attendance.roomId?.trim() || rooms[0]?.id || 'room_1';
    const seatId = buildSeatId(roomId, Number(attendance.roomSeatNo));
    if (attendance.type === 'aisle') {
      aisleSeatIds.add(seatId);
      return;
    }
    if (isAttendanceSeatOccupied(attendance)) {
      occupiedSeatIds.add(seatId);
    }
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
      if (aisleSeatIds.has(seatId)) {
        seats.push({
          cellType: 'aisle',
          seatId: '',
          roomId: room.id,
          roomName: getRoomLabel(room.id, rooms),
          roomSeatNo,
          seatNo: 0,
          displayLabel: '',
          label: `${getRoomLabel(room.id, rooms)} 통로`,
          seatGenderPolicy: 'all',
          seatGenderLabel: '',
          seatGenderShortLabel: '',
          status: 'available',
          statusLabel: '',
        });
        continue;
      }

      const isOccupied = occupiedSeatIds.has(seatId);
      const isHeld = !isOccupied && heldSeatIds.has(seatId);
      const status: PublicSeatStatus = isOccupied ? 'occupied' : isHeld ? 'held' : 'available';
      const seatNo = getGlobalSeatNo(room.id, roomSeatNo);
      const seatGenderPolicy = seatGenderBySeatId[seatId] || 'all';
      const displayLabel =
        getSeatDisplayLabel(
          {
            roomId: room.id,
            roomSeatNo,
            seatId,
          },
          seatLabelsBySeatId
        ) || String(roomSeatNo);

      seats.push({
        cellType: 'seat',
        seatId,
        roomId: room.id,
        roomName: getRoomLabel(room.id, rooms),
        roomSeatNo,
        seatNo,
        displayLabel,
        label: `${getRoomLabel(room.id, rooms)} ${displayLabel}번`,
        seatGenderPolicy,
        seatGenderLabel: getSeatGenderPolicyLabel(seatGenderPolicy),
        seatGenderShortLabel: getSeatGenderPolicyShortLabel(seatGenderPolicy),
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
  const allSeats = rooms.flatMap((room) => room.seats).filter((seat) => seat.cellType === 'seat');
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
  return [startLabel, endLabel].filter(Boolean).join(' - ') || '방문 시간';
}
