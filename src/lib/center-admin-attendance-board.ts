import type { DisplayAttendanceStatus } from '@/lib/attendance-auto';
import type { AttendanceCurrent } from '@/lib/types';

export type CenterAdminAttendanceRiskLevel = 'stable' | 'warning' | 'risk';
export type CenterAdminAttendanceOperationalExceptionKind = 'midday_leave' | 'returned' | 'early_checkout';

export type CenterAdminAttendanceBoardStatus =
  | 'present'
  | 'late'
  | 'routine_missing'
  | 'present_missing_routine'
  | 'away'
  | 'returned'
  | 'checked_out'
  | 'absent'
  | 'excused_absent'
  | 'planned';

export interface CenterAdminAttendanceSeatSignal {
  seatId: string;
  studentId: string;
  studentName: string;
  className?: string;
  roomId?: string;
  roomSeatNo?: number;
  seatStatus: AttendanceCurrent['status'];
  attendanceDisplayStatus: DisplayAttendanceStatus;
  boardStatus: CenterAdminAttendanceBoardStatus;
  boardLabel: string;
  todayStudyMinutes: number;
  todayStudyLabel: string;
  liveSessionMinutes: number;
  isNoAttendanceDay: boolean;
  routineExpectedArrivalTime: string | null;
  plannedDepartureTime: string | null;
  classScheduleName: string | null;
  hasExcursion: boolean;
  excursionStartAt: string | null;
  excursionEndAt: string | null;
  excursionReason: string | null;
  scheduleMovementLabel: string | null;
  scheduleMovementRange: string | null;
  scheduleMovementSummary: string | null;
  scheduleMovementCount: number;
  checkedAtLabel: string | null;
  firstCheckInLabel: string | null;
  lastCheckOutLabel: string | null;
  wasLateToday: boolean;
  hasCheckOutRecord: boolean;
  attendanceRiskLevel: CenterAdminAttendanceRiskLevel;
  attendanceRiskLabel: '정상' | '출석주의' | '출석위험';
  recentLateCount: number;
  recentAbsentCount: number;
  recentRoutineMissingCount: number;
  currentAwayMinutes: number;
  isLongAway: boolean;
  isReturned: boolean;
  isCheckedOut: boolean;
  hasAttendanceEvidence: boolean;
  operationalExceptionKind: CenterAdminAttendanceOperationalExceptionKind | null;
  operationalExceptionLabel: string | null;
  operationalExceptionNote: string | null;
  flags: string[];
  note: string;
}

export interface CenterAdminAttendanceBoardSummary {
  normalPresentCount: number;
  lateOrAbsentCount: number;
  routineMissingCount: number;
  awayCount: number;
  returnedCount: number;
  checkedOutCount: number;
  longAwayCount: number;
  excusedAbsentCount: number;
  plannedCount: number;
  studyingFamilyCount: number;
  attentionFamilyCount: number;
  restFamilyCount: number;
  exitFamilyCount: number;
}

type AttendanceBoardPresentation = {
  surfaceClass: string;
  chipClass: string;
  chipLabel: string;
  flagClass: string;
  isDark: boolean;
};

const PRESENTATION_BY_STATUS: Record<CenterAdminAttendanceBoardStatus, AttendanceBoardPresentation> = {
  present: {
    surfaceClass: 'border-[#5F90FF] bg-[#DCE8FF] text-[#14295F]',
    chipClass: 'bg-[#2554D7] text-white',
    chipLabel: '공부중',
    flagClass: 'bg-white/95 text-[#2554D7]',
    isDark: false,
  },
  late: {
    surfaceClass: 'border-[#FF9A42] bg-[#FFE5C8] text-[#14295F]',
    chipClass: 'bg-[#FF9A42] text-white',
    chipLabel: '지각 입실',
    flagClass: 'bg-white/95 text-[#C95A08]',
    isDark: false,
  },
  routine_missing: {
    surfaceClass: 'border-[#FF8A43] bg-[#FFE0D0] text-[#14295F]',
    chipClass: 'bg-[#FF7A16] text-white',
    chipLabel: '루틴 누락',
    flagClass: 'bg-white/95 text-[#C95A08]',
    isDark: false,
  },
  present_missing_routine: {
    surfaceClass: 'border-[#FF7A16] bg-[#FFD9BD] text-[#14295F]',
    chipClass: 'bg-[#FF7A16] text-white',
    chipLabel: '입실·루틴누락',
    flagClass: 'bg-white/95 text-[#C95A08]',
    isDark: false,
  },
  away: {
    surfaceClass: 'border-[#2DBA8C] bg-[#D8F4EA] text-[#14295F]',
    chipClass: 'bg-[#1F9E7A] text-white',
    chipLabel: '외출/휴식',
    flagClass: 'bg-white/95 text-[#1F9E7A]',
    isDark: false,
  },
  returned: {
    surfaceClass: 'border-[#4D7DFF] bg-[#E1EBFF] text-[#14295F]',
    chipClass: 'bg-[#2554D7] text-white',
    chipLabel: '복귀 후 공부',
    flagClass: 'bg-white/95 text-[#2554D7]',
    isDark: false,
  },
  checked_out: {
    surfaceClass: 'border-[#A7B7D3] bg-[#E8EEF7] text-[#14295F]',
    chipClass: 'bg-slate-800 text-white',
    chipLabel: '퇴실',
    flagClass: 'bg-white/95 text-slate-700',
    isDark: false,
  },
  absent: {
    surfaceClass: 'border-[#F45B35] bg-[#FFD9CF] text-[#14295F]',
    chipClass: 'bg-[#F45B35] text-white',
    chipLabel: '미입실',
    flagClass: 'bg-white/95 text-[#D54E2B]',
    isDark: false,
  },
  excused_absent: {
    surfaceClass: 'border-[#B7C4D8] bg-[#EDF2F8] text-[#14295F]',
    chipClass: 'bg-slate-600 text-white',
    chipLabel: '미등원',
    flagClass: 'bg-white/95 text-slate-700',
    isDark: false,
  },
  planned: {
    surfaceClass: 'border-[#C8D2E3] bg-[#F2F5F9] text-[#14295F]',
    chipClass: 'bg-slate-100 text-slate-700',
    chipLabel: '입실 예정',
    flagClass: 'bg-slate-100 text-slate-600',
    isDark: false,
  },
};

const BOARD_STATUS_LABELS: Record<CenterAdminAttendanceBoardStatus, string> = {
  present: '공부중',
  late: '지각 입실',
  routine_missing: '루틴 누락',
  present_missing_routine: '입실·루틴누락',
  away: '외출/휴식',
  returned: '복귀 후 공부',
  checked_out: '퇴실',
  absent: '미입실',
  excused_absent: '미등원',
  planned: '입실 예정',
};

function clampMinutes(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function parseBoardTimeToMinutes(value?: string | null) {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized)) return null;
  const [hourText, minuteText] = normalized.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function formatBoardTimeWindow(startAt?: string | null, endAt?: string | null) {
  if (!startAt || !endAt) return null;
  return `${startAt} ~ ${endAt}`;
}

export function formatAttendanceBoardMinutes(minutes: number) {
  const safeMinutes = clampMinutes(minutes);
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${hours}h ${mins}m`;
}

export function formatAttendanceBoardClockLabel(value?: Date | null) {
  if (!value) return null;
  const hours = value.getHours().toString().padStart(2, '0');
  const minutes = value.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function resolveAttendanceRiskLevel(params: {
  lateCount: number;
  absentCount: number;
  routineMissingCount: number;
}) {
  const { lateCount, absentCount, routineMissingCount } = params;
  if (absentCount >= 2 || lateCount + routineMissingCount >= 3) {
    return { level: 'risk' as const, label: '출석위험' as const };
  }
  if (lateCount >= 2 || absentCount >= 1 || routineMissingCount >= 2) {
    return { level: 'warning' as const, label: '출석주의' as const };
  }
  return { level: 'stable' as const, label: '정상' as const };
}

export function resolveAttendanceBoardStatus(params: {
  seatStatus: AttendanceCurrent['status'];
  displayStatus: DisplayAttendanceStatus;
  hasAttendanceEvidence: boolean;
  isReturned: boolean;
}) {
  const { seatStatus, displayStatus, hasAttendanceEvidence, isReturned } = params;

  if (seatStatus === 'away' || seatStatus === 'break') return 'away';
  if (seatStatus === 'studying' && isReturned) return 'returned';
  if (seatStatus === 'studying') return 'present';
  if (displayStatus === 'excused_absent') return 'excused_absent';
  if (seatStatus === 'absent' && hasAttendanceEvidence) return 'checked_out';
  if (displayStatus === 'confirmed_late') return 'late';
  if (displayStatus === 'confirmed_present_missing_routine') return 'present_missing_routine';
  if (displayStatus === 'missing_routine') return 'routine_missing';
  if (displayStatus === 'confirmed_present') return 'present';
  if (displayStatus === 'confirmed_absent') return 'absent';
  return 'planned';
}

export function getAttendanceBoardStatusLabel(status: CenterAdminAttendanceBoardStatus) {
  return BOARD_STATUS_LABELS[status];
}

export function buildAttendanceBoardFlags(params: {
  displayStatus: DisplayAttendanceStatus;
  attendanceRiskLevel: CenterAdminAttendanceRiskLevel;
  isLongAway: boolean;
}) {
  const { displayStatus, attendanceRiskLevel, isLongAway } = params;
  return [
    attendanceRiskLevel === 'risk' ? '출석위험' : attendanceRiskLevel === 'warning' ? '출석주의' : null,
    displayStatus === 'confirmed_late' ? '오늘 지각O' : null,
    displayStatus === 'missing_routine' || displayStatus === 'confirmed_present_missing_routine' ? '루틴누락' : null,
    isLongAway ? '장기외출' : null,
    displayStatus === 'excused_absent' ? '미등원' : null,
  ].filter(Boolean) as string[];
}

export function buildAttendanceBoardNote(params: {
  boardStatus: CenterAdminAttendanceBoardStatus;
  displayStatus: DisplayAttendanceStatus;
  expectedArrivalTime?: string | null;
  currentAwayMinutes?: number;
  attendanceRiskLabel: '정상' | '출석주의' | '출석위험';
  firstCheckInLabel?: string | null;
  lastCheckOutLabel?: string | null;
  wasLateToday?: boolean;
}) {
  const {
    boardStatus,
    displayStatus,
    expectedArrivalTime,
    currentAwayMinutes = 0,
    attendanceRiskLabel,
    firstCheckInLabel,
    lastCheckOutLabel,
    wasLateToday = false,
  } = params;

  switch (boardStatus) {
    case 'present':
      if (displayStatus === 'confirmed_late') {
        return expectedArrivalTime
          ? `현재 공부중이며 오늘은 예정 등원 ${expectedArrivalTime}보다 늦게 입실했습니다.`
          : '현재 공부중이며 오늘은 지각 입실로 기록돼 있습니다.';
      }
      if (displayStatus === 'missing_routine' || displayStatus === 'confirmed_present_missing_routine') {
        return '현재 공부중이지만 오늘 루틴 기록이 비어 있어 먼저 점검이 필요합니다.';
      }
      return attendanceRiskLabel === '정상'
        ? '현재 실제 좌석 상태는 공부중으로 확인됩니다.'
        : `현재는 공부중이지만 최근 7일 기준 ${attendanceRiskLabel} 학생입니다.`;
    case 'late':
      return expectedArrivalTime
        ? `예정 등원 ${expectedArrivalTime} 대비 늦게 입실한 상태입니다.`
        : '오늘 지각 입실로 확인된 상태입니다.';
    case 'routine_missing':
      return '오늘 루틴 기록이 없어 출석 확인 전에 먼저 점검이 필요합니다.';
    case 'present_missing_routine':
      return '입실은 확인됐지만 오늘 루틴이 비어 있어 생활기록 점검이 필요합니다.';
    case 'away':
      return currentAwayMinutes >= 20
        ? `외출/휴식이 ${currentAwayMinutes}분 이어져 복귀 확인이 필요합니다.`
        : '현재 외출 또는 휴식 중입니다.';
    case 'returned':
      return '현재 공부에 복귀한 상태이며, 오늘 누적 공부 기록이 함께 확인됩니다.';
    case 'checked_out':
      return [
        '퇴실 완료 상태입니다.',
        wasLateToday ? '오늘 지각O' : '오늘 지각X',
        firstCheckInLabel ? `최초입실 ${firstCheckInLabel}` : null,
        lastCheckOutLabel ? `마지막퇴실 ${lastCheckOutLabel}` : null,
      ].filter(Boolean).join(' · ');
    case 'absent':
      return expectedArrivalTime
        ? `예정 등원 ${expectedArrivalTime} 이후에도 오늘 입실 증거가 없습니다.`
        : '오늘 입실 증거가 없어 미입실로 보고 있습니다.';
    case 'excused_absent':
      return '오늘은 미등원으로 등록되어 있습니다.';
    case 'planned':
      return '아직 루틴 예정 시각 전이거나 입실 대기 상태입니다.';
    default:
      return attendanceRiskLabel === '정상'
        ? '현재는 정상 출석 흐름으로 보입니다.'
        : `최근 7일 기준 ${attendanceRiskLabel} 학생입니다.`;
  }
}

export function resolveAttendanceOperationalException(params: {
  boardStatus: CenterAdminAttendanceBoardStatus;
  expectedArrivalTime?: string | null;
  plannedDepartureTime?: string | null;
  hasExcursion?: boolean;
  excursionStartAt?: string | null;
  excursionEndAt?: string | null;
  excursionReason?: string | null;
  currentAwayMinutes?: number;
  nowMs?: number;
}) {
  const {
    boardStatus,
    expectedArrivalTime,
    plannedDepartureTime,
    hasExcursion = false,
    excursionStartAt,
    excursionEndAt,
    excursionReason,
    currentAwayMinutes = 0,
    nowMs = Date.now(),
  } = params;

  const timeWindow = formatBoardTimeWindow(excursionStartAt, excursionEndAt);
  const trimmedReason = typeof excursionReason === 'string' ? excursionReason.trim() : '';

  if (boardStatus === 'away') {
    const scheduleLabel = hasExcursion
      ? [timeWindow, trimmedReason].filter(Boolean).join(' · ')
      : null;

    return {
      kind: 'midday_leave' as const,
      label: '중간 외출',
      note: scheduleLabel
        ? `${scheduleLabel} 일정으로 현재 자리를 비우고 있어 복귀 여부만 확인하면 됩니다.`
        : currentAwayMinutes >= 20
          ? `현재 ${currentAwayMinutes}분째 자리를 비우고 있어 복귀 확인이 필요합니다.`
          : '현재 자리를 비우고 있어 복귀 여부를 확인하면 됩니다.',
    };
  }

  if (boardStatus === 'returned') {
    const scheduleLabel = hasExcursion
      ? [timeWindow, trimmedReason].filter(Boolean).join(' · ')
      : null;

    return {
      kind: 'returned' as const,
      label: '재등원 완료',
      note: scheduleLabel
        ? `${scheduleLabel} 이후 다시 등원해 현재 공부 중입니다.`
        : '중간 이동 이후 다시 등원해 현재 공부 중입니다.',
    };
  }

  if (boardStatus === 'checked_out') {
    const arrivalMinutes = parseBoardTimeToMinutes(expectedArrivalTime);
    const departureMinutes = parseBoardTimeToMinutes(plannedDepartureTime);
    const now = new Date(nowMs);
    let nowMinutes = now.getHours() * 60 + now.getMinutes();
    let normalizedDepartureMinutes = departureMinutes;

    if (
      arrivalMinutes !== null &&
      departureMinutes !== null &&
      departureMinutes <= arrivalMinutes
    ) {
      normalizedDepartureMinutes = departureMinutes + 24 * 60;
      if (nowMinutes < arrivalMinutes) {
        nowMinutes += 24 * 60;
      }
    }

    if (normalizedDepartureMinutes !== null && nowMinutes + 15 < normalizedDepartureMinutes) {
      return {
        kind: 'early_checkout' as const,
        label: '중간 하원',
        note: `${plannedDepartureTime} 기본 하원 전이라 중간 하원으로 보고 확인이 필요합니다.`,
      };
    }
  }

  return null;
}

export function getAttendanceBoardPresentation(signal: CenterAdminAttendanceSeatSignal) {
  return PRESENTATION_BY_STATUS[signal.boardStatus];
}

export function buildAttendanceBoardSummary(signals: CenterAdminAttendanceSeatSignal[]): CenterAdminAttendanceBoardSummary {
  const summary = signals.reduce<CenterAdminAttendanceBoardSummary>(
    (acc, signal) => {
      if (signal.boardStatus === 'present') acc.normalPresentCount += 1;
      if (signal.attendanceDisplayStatus === 'confirmed_late' || signal.boardStatus === 'absent') acc.lateOrAbsentCount += 1;
      if (
        signal.attendanceDisplayStatus === 'missing_routine' ||
        signal.attendanceDisplayStatus === 'confirmed_present_missing_routine'
      ) {
        acc.routineMissingCount += 1;
      }
      if (signal.boardStatus === 'away') acc.awayCount += 1;
      if (signal.boardStatus === 'returned') acc.returnedCount += 1;
      if (signal.boardStatus === 'checked_out') acc.checkedOutCount += 1;
      if (signal.boardStatus === 'excused_absent') acc.excusedAbsentCount += 1;
      if (signal.boardStatus === 'planned') acc.plannedCount += 1;
      if (signal.isLongAway) acc.longAwayCount += 1;
      return acc;
    },
    {
      normalPresentCount: 0,
      lateOrAbsentCount: 0,
      routineMissingCount: 0,
      awayCount: 0,
      returnedCount: 0,
      checkedOutCount: 0,
      longAwayCount: 0,
      excusedAbsentCount: 0,
      plannedCount: 0,
      studyingFamilyCount: 0,
      attentionFamilyCount: 0,
      restFamilyCount: 0,
      exitFamilyCount: 0,
    }
  );

  summary.studyingFamilyCount = summary.normalPresentCount + summary.returnedCount;
  summary.attentionFamilyCount = summary.lateOrAbsentCount + summary.routineMissingCount;
  summary.restFamilyCount = summary.awayCount;
  summary.exitFamilyCount = summary.checkedOutCount + summary.excusedAbsentCount + summary.plannedCount;

  return summary;
}
