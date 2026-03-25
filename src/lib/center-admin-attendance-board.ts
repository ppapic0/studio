import type { DisplayAttendanceStatus } from '@/lib/attendance-auto';
import type { AttendanceCurrent } from '@/lib/types';

export type CenterAdminAttendanceRiskLevel = 'stable' | 'warning' | 'risk';

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
  routineExpectedArrivalTime: string | null;
  checkedAtLabel: string | null;
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
    surfaceClass: 'border-sky-200 bg-sky-50 text-sky-900',
    chipClass: 'bg-sky-600 text-white',
    chipLabel: '정상 입실',
    flagClass: 'bg-white/90 text-sky-700',
    isDark: false,
  },
  late: {
    surfaceClass: 'border-amber-200 bg-amber-50 text-amber-900',
    chipClass: 'bg-amber-500 text-white',
    chipLabel: '지각 입실',
    flagClass: 'bg-white/90 text-amber-700',
    isDark: false,
  },
  routine_missing: {
    surfaceClass: 'border-rose-200 bg-rose-50 text-rose-900',
    chipClass: 'bg-rose-500 text-white',
    chipLabel: '루틴 누락',
    flagClass: 'bg-white/90 text-rose-700',
    isDark: false,
  },
  present_missing_routine: {
    surfaceClass: 'border-orange-200 bg-orange-50 text-orange-900',
    chipClass: 'bg-orange-500 text-white',
    chipLabel: '입실·루틴누락',
    flagClass: 'bg-white/90 text-orange-700',
    isDark: false,
  },
  away: {
    surfaceClass: 'border-amber-200 bg-amber-50 text-amber-900',
    chipClass: 'bg-amber-500 text-white',
    chipLabel: '외출/휴식',
    flagClass: 'bg-white/90 text-amber-700',
    isDark: false,
  },
  returned: {
    surfaceClass: 'border-cyan-200 bg-cyan-50 text-cyan-900',
    chipClass: 'bg-cyan-600 text-white',
    chipLabel: '복귀/재입실',
    flagClass: 'bg-white/90 text-cyan-700',
    isDark: false,
  },
  checked_out: {
    surfaceClass: 'border-slate-200 bg-slate-100 text-slate-800',
    chipClass: 'bg-slate-700 text-white',
    chipLabel: '퇴실',
    flagClass: 'bg-white/90 text-slate-700',
    isDark: false,
  },
  absent: {
    surfaceClass: 'border-rose-200 bg-rose-50 text-rose-900',
    chipClass: 'bg-rose-600 text-white',
    chipLabel: '미입실',
    flagClass: 'bg-white/90 text-rose-700',
    isDark: false,
  },
  excused_absent: {
    surfaceClass: 'border-slate-200 bg-slate-50 text-slate-700',
    chipClass: 'bg-slate-500 text-white',
    chipLabel: '예정 결석',
    flagClass: 'bg-white/90 text-slate-600',
    isDark: false,
  },
  planned: {
    surfaceClass: 'border-slate-200 bg-white text-slate-700',
    chipClass: 'bg-slate-100 text-slate-700',
    chipLabel: '입실 예정',
    flagClass: 'bg-slate-100 text-slate-600',
    isDark: false,
  },
};

const BOARD_STATUS_LABELS: Record<CenterAdminAttendanceBoardStatus, string> = {
  present: '정상 입실',
  late: '지각 입실',
  routine_missing: '루틴 누락',
  present_missing_routine: '입실·루틴누락',
  away: '외출/휴식',
  returned: '복귀/재입실',
  checked_out: '퇴실',
  absent: '미입실',
  excused_absent: '예정 결석',
  planned: '입실 예정',
};

function clampMinutes(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
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

  if (displayStatus === 'excused_absent') return 'excused_absent';
  if (seatStatus === 'away' || seatStatus === 'break') return 'away';
  if (seatStatus === 'studying' && isReturned) return 'returned';
  if (displayStatus === 'confirmed_late') return 'late';
  if (displayStatus === 'confirmed_present_missing_routine') return 'present_missing_routine';
  if (displayStatus === 'missing_routine') return 'routine_missing';
  if (seatStatus === 'studying' || displayStatus === 'confirmed_present') return 'present';
  if (seatStatus === 'absent' && hasAttendanceEvidence) return 'checked_out';
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
    displayStatus === 'missing_routine' || displayStatus === 'confirmed_present_missing_routine' ? '루틴누락' : null,
    isLongAway ? '장기외출' : null,
    displayStatus === 'excused_absent' ? '예정결석' : null,
  ].filter(Boolean) as string[];
}

export function buildAttendanceBoardNote(params: {
  boardStatus: CenterAdminAttendanceBoardStatus;
  expectedArrivalTime?: string | null;
  currentAwayMinutes?: number;
  attendanceRiskLabel: '정상' | '출석주의' | '출석위험';
}) {
  const { boardStatus, expectedArrivalTime, currentAwayMinutes = 0, attendanceRiskLabel } = params;

  switch (boardStatus) {
    case 'late':
      return expectedArrivalTime
        ? `루틴 예정 ${expectedArrivalTime} 대비 늦게 입실한 상태입니다.`
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
      return '오늘 누적 공부 기록이 있어 재입실 또는 복귀 상태로 판단됩니다.';
    case 'checked_out':
      return '오늘 출석 증거는 있으나 현재는 퇴실 상태입니다.';
    case 'absent':
      return expectedArrivalTime
        ? `루틴 예정 ${expectedArrivalTime} 이후에도 오늘 입실 증거가 없습니다.`
        : '오늘 입실 증거가 없어 미입실로 보고 있습니다.';
    case 'excused_absent':
      return '오늘은 루틴상 등원하지 않는 날로 기록되어 있습니다.';
    case 'planned':
      return '아직 루틴 예정 시각 전이거나 입실 대기 상태입니다.';
    default:
      return attendanceRiskLabel === '정상'
        ? '현재는 정상 출석 흐름으로 보입니다.'
        : `최근 7일 기준 ${attendanceRiskLabel} 학생입니다.`;
  }
}

export function getAttendanceBoardPresentation(signal: CenterAdminAttendanceSeatSignal) {
  return PRESENTATION_BY_STATUS[signal.boardStatus];
}

export function buildAttendanceBoardSummary(signals: CenterAdminAttendanceSeatSignal[]): CenterAdminAttendanceBoardSummary {
  return signals.reduce<CenterAdminAttendanceBoardSummary>(
    (acc, signal) => {
      if (signal.boardStatus === 'present') acc.normalPresentCount += 1;
      if (signal.boardStatus === 'late' || signal.boardStatus === 'absent') acc.lateOrAbsentCount += 1;
      if (signal.boardStatus === 'routine_missing' || signal.boardStatus === 'present_missing_routine') acc.routineMissingCount += 1;
      if (signal.boardStatus === 'away') acc.awayCount += 1;
      if (signal.boardStatus === 'returned') acc.returnedCount += 1;
      if (signal.boardStatus === 'checked_out') acc.checkedOutCount += 1;
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
    }
  );
}
