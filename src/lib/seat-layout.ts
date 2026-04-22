import type {
  AttendanceCurrent,
  LayoutRoomConfig,
  LayoutSettings,
  SeatGenderPolicy,
  StudentProfile,
} from '@/lib/types';

type SeatIdentityInput = Partial<Pick<StudentProfile, 'seatId' | 'roomId' | 'roomSeatNo' | 'seatNo'>> &
  Partial<Pick<StudentProfile, 'seatLabel'>> &
  Partial<Pick<AttendanceCurrent, 'id' | 'roomId' | 'roomSeatNo' | 'seatNo' | 'seatLabel'>>;

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

export function normalizeSeatLabelValue(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim().slice(0, 12);
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

export function normalizeAisleSeatIds(layoutSettings?: LayoutSettings | Record<string, unknown> | null) {
  const source = (layoutSettings as LayoutSettings | undefined)?.aisleSeatIds;
  if (!Array.isArray(source)) return [];

  return Array.from(
    new Set(
      source
        .map((seatId) => (typeof seatId === 'string' ? seatId.trim() : ''))
        .filter(Boolean)
    )
  ).sort();
}

export function normalizeSeatLabelsBySeatId(layoutSettings?: LayoutSettings | Record<string, unknown> | null) {
  const source = (layoutSettings as LayoutSettings | undefined)?.seatLabelsBySeatId;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {} as Record<string, string>;

  return Object.fromEntries(
    Object.entries(source)
      .map(([seatId, label]) => [seatId.trim(), normalizeSeatLabelValue(label)] as const)
      .filter(([seatId, label]) => Boolean(seatId) && Boolean(label))
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

export function normalizeSeatGenderPolicy(value: unknown): SeatGenderPolicy {
  if (typeof value !== 'string') return 'all';

  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'all';

  if (
    normalized === 'male' ||
    normalized === 'man' ||
    normalized === 'boy' ||
    normalized === 'm' ||
    normalized === '남' ||
    normalized === '남자' ||
    normalized === '남학생'
  ) {
    return 'male';
  }

  if (
    normalized === 'female' ||
    normalized === 'woman' ||
    normalized === 'girl' ||
    normalized === 'f' ||
    normalized === '여' ||
    normalized === '여자' ||
    normalized === '여학생'
  ) {
    return 'female';
  }

  return 'all';
}

export function normalizeSeatGenderBySeatId(layoutSettings?: LayoutSettings | Record<string, unknown> | null) {
  const source = (layoutSettings as LayoutSettings | undefined)?.seatGenderBySeatId;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return {} as Record<string, SeatGenderPolicy>;
  }

  return Object.fromEntries(
    Object.entries(source)
      .map(([seatId, policy]) => [seatId.trim(), normalizeSeatGenderPolicy(policy)] as const)
      .filter(([seatId, policy]) => Boolean(seatId) && policy !== 'all')
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

export function getSeatGenderPolicyLabel(policy?: SeatGenderPolicy | null) {
  const normalized = normalizeSeatGenderPolicy(policy);
  if (normalized === 'male') return '남학생 전용';
  if (normalized === 'female') return '여학생 전용';
  return '공용';
}

export function getSeatGenderPolicyShortLabel(policy?: SeatGenderPolicy | null) {
  const normalized = normalizeSeatGenderPolicy(policy);
  if (normalized === 'male') return '남자';
  if (normalized === 'female') return '여자';
  return '공용';
}

export function normalizeLeadGender(value: unknown): 'male' | 'female' | null {
  const normalized = normalizeSeatGenderPolicy(value);
  if (normalized === 'all') return null;
  return normalized;
}

export function isSeatGenderPolicyCompatible(policy?: SeatGenderPolicy | null, leadGender?: unknown) {
  const normalizedPolicy = normalizeSeatGenderPolicy(policy);
  if (normalizedPolicy === 'all') return true;
  return normalizeLeadGender(leadGender) === normalizedPolicy;
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

export function parseSeatId(seatId?: string | null) {
  if (typeof seatId !== 'string') return null;
  const trimmed = seatId.trim();
  if (!trimmed) return null;

  const primaryMatch = /^seat_(\d+)$/.exec(trimmed);
  if (primaryMatch) {
    return {
      roomId: PRIMARY_ROOM_ID,
      roomSeatNo: Number(primaryMatch[1]),
    };
  }

  const roomMatch = /^(room_\d+)_seat_(\d+)$/.exec(trimmed);
  if (roomMatch) {
    return {
      roomId: roomMatch[1],
      roomSeatNo: Number(roomMatch[2]),
    };
  }

  return null;
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

export function getSeatDisplayLabel(
  input?: SeatIdentityInput | null,
  seatLabelsBySeatId?: Record<string, string>
) {
  if (!input) return '';

  const explicitLabel = normalizeSeatLabelValue(input.seatLabel);
  if (explicitLabel) return explicitLabel;

  const identity = resolveSeatIdentity(input);
  const configuredLabel = identity.seatId
    ? normalizeSeatLabelValue(seatLabelsBySeatId?.[identity.seatId])
    : '';

  if (configuredLabel) return configuredLabel;
  if (identity.roomSeatNo > 0) return String(identity.roomSeatNo);
  if (identity.seatNo > 0) return String(identity.seatNo);
  return '';
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
  fallbackLabel = '좌석 미지정',
  seatLabelsBySeatId?: Record<string, string>
) {
  if (!input) return fallbackLabel;
  const identity = resolveSeatIdentity(input);
  if (!identity.roomSeatNo) return fallbackLabel;
  const seatDisplayLabel = getSeatDisplayLabel(input, seatLabelsBySeatId) || String(identity.roomSeatNo);
  return `${getRoomLabel(identity.roomId, rooms)} ${seatDisplayLabel}번`;
}
