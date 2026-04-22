import type {
  AttendanceCurrent,
  LayoutRoomConfig,
  LayoutSettings,
  StudentProfile,
} from '@/lib/types';

type SeatIdentityInput = Partial<Pick<StudentProfile, 'seatId' | 'roomId' | 'roomSeatNo' | 'seatNo'>> &
  Partial<Pick<AttendanceCurrent, 'id' | 'roomId' | 'roomSeatNo' | 'seatNo'>>;

export const PRIMARY_ROOM_ID = 'room_1';
export const SECONDARY_ROOM_ID = 'room_2';
export const ROOM_SEAT_BLOCK_START: Record<string, number> = {
  [PRIMARY_ROOM_ID]: 1,
  [SECONDARY_ROOM_ID]: 1001,
};

const DEFAULT_ROWS = 7;
const DEFAULT_COLS = 10;
const MIN_GRID_SIZE = 1;
const MAX_GRID_SIZE = 24;

function clampGridSize(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_GRID_SIZE, Math.max(MIN_GRID_SIZE, parsed));
}

function padSeatNo(value: number) {
  return value.toString().padStart(3, '0');
}

export function getDefaultLayoutRooms(rows = DEFAULT_ROWS, cols = DEFAULT_COLS): LayoutRoomConfig[] {
  const safeRows = clampGridSize(rows, DEFAULT_ROWS);
  const safeCols = clampGridSize(cols, DEFAULT_COLS);

  return [
    { id: PRIMARY_ROOM_ID, name: '1호실', rows: safeRows, cols: safeCols, order: 1 },
    { id: SECONDARY_ROOM_ID, name: '2호실', rows: safeRows, cols: safeCols, order: 2 },
  ];
}

export function normalizeLayoutRooms(layoutSettings?: LayoutSettings | Record<string, unknown> | null) {
  if (layoutSettings && Array.isArray((layoutSettings as LayoutSettings).rooms)) {
    const source = (layoutSettings as LayoutSettings).rooms || [];
    const normalized = source
      .map((room, index) => ({
        id: typeof room.id === 'string' && room.id.trim() ? room.id.trim() : getDefaultLayoutRooms()[index]?.id || `room_${index + 1}`,
        name: typeof room.name === 'string' && room.name.trim() ? room.name.trim() : `${index + 1}호실`,
        rows: clampGridSize(room.rows, DEFAULT_ROWS),
        cols: clampGridSize(room.cols, DEFAULT_COLS),
        order: Number.isFinite(room.order) ? Number(room.order) : index + 1,
      }))
      .sort((a, b) => a.order - b.order);

    if (normalized.length > 0) {
      return normalized;
    }
  }

  const legacyRows = clampGridSize((layoutSettings as LayoutSettings | undefined)?.rows, DEFAULT_ROWS);
  const legacyCols = clampGridSize((layoutSettings as LayoutSettings | undefined)?.cols, DEFAULT_COLS);
  return getDefaultLayoutRooms(legacyRows, legacyCols);
}

export function normalizeRoomId(roomId?: string | null, seatNo?: number | null) {
  if (typeof roomId === 'string' && roomId.trim()) {
    return roomId.trim();
  }
  if (Number.isFinite(seatNo) && Number(seatNo) >= ROOM_SEAT_BLOCK_START[SECONDARY_ROOM_ID]) {
    return SECONDARY_ROOM_ID;
  }
  return PRIMARY_ROOM_ID;
}

export function getRoomSeatNo(input: SeatIdentityInput) {
  if (Number.isFinite(input.roomSeatNo) && Number(input.roomSeatNo) > 0) {
    return Number(input.roomSeatNo);
  }

  const seatNo = Number(input.seatNo || 0);
  if (!Number.isFinite(seatNo) || seatNo <= 0) {
    return 0;
  }

  const roomId = normalizeRoomId(input.roomId, seatNo);
  if (roomId === SECONDARY_ROOM_ID) {
    return Math.max(0, seatNo - ROOM_SEAT_BLOCK_START[SECONDARY_ROOM_ID] + 1);
  }
  return seatNo;
}

export function getGlobalSeatNo(roomId: string, roomSeatNo: number) {
  if (!Number.isFinite(roomSeatNo) || roomSeatNo <= 0) return 0;
  if (roomId === SECONDARY_ROOM_ID) {
    return ROOM_SEAT_BLOCK_START[SECONDARY_ROOM_ID] + roomSeatNo - 1;
  }
  return roomSeatNo;
}

export function buildSeatId(roomId: string, roomSeatNo: number) {
  if (!Number.isFinite(roomSeatNo) || roomSeatNo <= 0) return '';
  if (roomId === PRIMARY_ROOM_ID) {
    return `seat_${padSeatNo(roomSeatNo)}`;
  }
  return `${roomId}_seat_${padSeatNo(roomSeatNo)}`;
}

function isSeatDocumentId(value?: string | null) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^seat_\d+$/.test(trimmed) || /^room_\d+_seat_\d+$/.test(trimmed);
}

export function resolveSeatIdentity(input: SeatIdentityInput) {
  const fallbackSeatNo = Number(input.seatNo || 0);
  const roomId = normalizeRoomId(input.roomId, fallbackSeatNo);
  const roomSeatNo = getRoomSeatNo(input);
  const seatNo = roomSeatNo > 0 ? getGlobalSeatNo(roomId, roomSeatNo) : fallbackSeatNo;
  const seatId =
    (typeof input.seatId === 'string' && input.seatId.trim()) ||
    (typeof input.id === 'string' && input.id.trim()) ||
    buildSeatId(roomId, roomSeatNo);

  return {
    roomId,
    roomSeatNo,
    seatNo,
    seatId,
  };
}

export function hasAssignedSeat(input?: SeatIdentityInput | null) {
  if (!input) return false;
  const identity = resolveSeatIdentity(input);
  const explicitSeatId =
    (typeof input.seatId === 'string' && input.seatId.trim()) ||
    (typeof input.id === 'string' && isSeatDocumentId(input.id) ? input.id.trim() : '');
  return identity.roomSeatNo > 0 || identity.seatNo > 0 || Boolean(explicitSeatId);
}

export function getRoomLabel(roomId?: string | null, rooms?: LayoutRoomConfig[]) {
  const normalizedRoomId = normalizeRoomId(roomId);
  const matched = rooms?.find((room) => room.id === normalizedRoomId);
  if (matched?.name) return matched.name;
  if (normalizedRoomId === SECONDARY_ROOM_ID) return '2호실';
  return '1호실';
}

export function formatSeatLabel(
  input?: SeatIdentityInput | null,
  rooms?: LayoutRoomConfig[],
  fallbackLabel = '좌석 미지정'
) {
  if (!input) return fallbackLabel;
  const identity = resolveSeatIdentity(input);
  if (!identity.roomSeatNo) return fallbackLabel;
  return `${getRoomLabel(identity.roomId, rooms)} ${identity.roomSeatNo}번`;
}
