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
    surfaceClass: 'border-sky-400 bg-sky-200 text-sky-950',
    chipClass: 'bg-sky-700 text-white',
    chipLabel: '공부중',
    flagClass: 'bg-white/95 text-sky-800',
    isDark: false,
  },
  late: {
    surfaceClass: 'border-amber-400 bg-amber-200 text-amber-950',
    chipClass: 'bg-amber-600 text-white',
    chipLabel: '지각 입실',
    flagClass: 'bg-white/95 text-amber-800',
    isDark: false,
  },
  routine_missing: {
    surfaceClass: 'border-rose-400 bg-rose-200 text-rose-950',
    chipClass: 'bg-rose-600 text-white',
    chipLabel: '루틴 누락',
    flagClass: 'bg-white/95 text-rose-800',
    isDark: false,
  },
  present_missing_routine: {
    surfaceClass: 'border-orange-400 bg-orange-200 text-orange-950',
    chipClass: 'bg-orange-600 text-white',
    chipLabel: '입실·루틴누락',
    flagClass: 'bg-white/95 text-orange-800',
    isDark: false,
  },
  away: {
    surfaceClass: 'border-amber-400 bg-amber-200 text-amber-950',
    chipClass: 'bg-amber-600 text-white',
    chipLabel: '외출/휴식',
    flagClass: 'bg-white/95 text-amber-800',
    isDark: false,
  },
  returned: {
    surfaceClass: 'border-cyan-400 bg-cyan-200 text-cyan-950',
    chipClass: 'bg-cyan-700 text-white',
    chipLabel: '복귀 후 공부',
    flagClass: 'bg-white/95 text-cyan-800',
    isDark: false,
  },
  checked_out: {
    surfaceClass: 'border-slate-400 bg-slate-300 text-slate-950',
    chipClass: 'bg-slate-800 text-white',
    chipLabel: '퇴실',
    flagClass: 'bg-white/95 text-slate-800',
    isDark: false,
  },
  absent: {
    surfaceClass: 'border-rose-500 bg-rose-200 text-rose-950',
    chipClass: 'bg-rose-700 text-white',
    chipLabel: '미입실',
    flagClass: 'bg-white/95 text-rose-800',
    isDark: false,
  },
  excused_absent: {
    surfaceClass: 'border-slate-300 bg-slate-200 text-slate-800',
    chipClass: 'bg-slate-600 text-white',
    chipLabel: '예정 결석',
    flagClass: 'bg-white/95 text-slate-700',
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
  present: '공부중',
  late: '지각 입실',
  routine_missing: '루틴 누락',
  present_missing_routine: '입실·루틴누락',
  away: '외출/휴식',
  returned: '복귀 후 공부',
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

  if (seatStatus === 'away' || seatStatus === 'break') return 'away';
  if (seatStatus === 'studying' && isReturned) return 'returned';
  if (seatStatus === 'studying') return 'present';
  if (displayStatus === 'excused_absent') return 'excused_absent';
  if (displayStatus === 'confirmed_late') return 'late';
  if (displayStatus === 'confirmed_present_missing_routine') return 'present_missing_routine';
  if (displayStatus === 'missing_routine') return 'routine_missing';
  if (displayStatus === 'confirmed_present') return 'present';
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
    displayStatus === 'confirmed_late' ? '지각' : null,
    displayStatus === 'missing_routine' || displayStatus === 'confirmed_present_missing_routine' ? '루틴누락' : null,
    isLongAway ? '장기외출' : null,
    displayStatus === 'excused_absent' ? '예정결석' : null,
  ].filter(Boolean) as string[];
}

export function buildAttendanceBoardNote(params: {
  boardStatus: CenterAdminAttendanceBoardStatus;
  displayStatus: DisplayAttendanceStatus;
  expectedArrivalTime?: string | null;
  currentAwayMinutes?: number;
  attendanceRiskLabel: '정상' | '출석주의' | '출석위험';
}) {
  const { boardStatus, displayStatus, expectedArrivalTime, currentAwayMinutes = 0, attendanceRiskLabel } = params;

  switch (boardStatus) {
    case 'present':
      if (displayStatus === 'confirmed_late') {
        return expectedArrivalTime
          ? `현재 공부중이며 오늘은 루틴 예정 ${expectedArrivalTime}보다 늦게 입실했습니다.`
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
      return '현재 공부에 복귀한 상태이며, 오늘 누적 공부 기록이 함께 확인됩니다.';
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
      if (signal.seatStatus === 'studying') acc.normalPresentCount += 1;
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
