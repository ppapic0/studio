import { DisplayAttendanceStatus } from '@/lib/attendance-auto';
import { AttendanceRequest } from '@/lib/types';

export type AttendanceKpiPeriod = 7 | 14 | 30 | 90;

export interface AttendanceKpiDay {
  dateKey: string;
  dateLabel: string;
  status: DisplayAttendanceStatus;
  checkedAt: Date | null;
  expectedArrivalTime: string | null;
  expectedArrivalAt: Date | null;
  lateMinutes: number;
  isScheduledDay: boolean;
  isOffDay: boolean;
  isRoutineMissing: boolean;
  studyMinutes: number;
  awayMinutes: number;
  awayCount: number;
  hasCheckoutRecord: boolean;
  checkOutAt: Date | null;
  requestType: AttendanceRequest['type'] | null;
  requestStatus: AttendanceRequest['status'] | null;
}

export type AttendanceRiskLevel = 'stable' | 'watch' | 'risk' | 'critical';

export interface AttendanceStudentKpiRow {
  studentId: string;
  studentName: string;
  className: string;
  roomId: string | null;
  roomLabel: string;
  attendanceRate: number;
  lateRate: number;
  absenceRate: number;
  excusedAbsenceRate: number;
  averageArrivalOffsetMinutes: number;
  averageAwayMinutes: number;
  awayDayCount: number;
  awayCount: number;
  checkoutCompletionRate: number;
  stabilityScore: number;
  riskLevel: AttendanceRiskLevel;
  lateCount: number;
  absenceCount: number;
  excusedAbsenceCount: number;
  routineMissingCount: number;
  scheduledDays: number;
  presentDays: number;
  latestCheckOutLabel: string;
  recentRequestStatus: AttendanceRequest['status'] | 'none';
  recentRequestCount: number;
  topIssue: string;
  suggestions: string[];
  timeline: AttendanceKpiDay[];
  requestHistory: AttendanceRequest[];
}

export interface AttendanceCenterSummary {
  attendanceRate: number;
  lateRate: number;
  unexcusedAbsenceRate: number;
  averageAwayMinutes: number;
  checkoutCompletionRate: number;
  requestSlaComplianceRate: number;
  pendingRequestsToday: number;
  overduePendingCount: number;
  averageProcessingHours: number;
  repeatRequesterCount: number;
  stableCount: number;
  watchCount: number;
  riskCount: number;
  criticalCount: number;
}

export interface AttendanceRequestOperationsSummary {
  pendingTodayCount: number;
  overduePendingCount: number;
  averageProcessingHours: number;
  repeatRequesterCount: number;
}

export const ATTENDANCE_KPI_PERIOD_OPTIONS: Array<{
  value: AttendanceKpiPeriod;
  label: string;
}> = [
  { value: 7, label: '최근 7일' },
  { value: 14, label: '최근 14일' },
  { value: 30, label: '최근 30일' },
  { value: 90, label: '최근 90일' },
];

export const ATTENDANCE_STATUS_LABELS: Record<DisplayAttendanceStatus, string> = {
  requested: '미확인',
  confirmed_present: '출석',
  confirmed_present_missing_routine: '출석(미작성)',
  confirmed_late: '지각',
  confirmed_absent: '무단결석',
  excused_absent: '사유결석',
  missing_routine: '루틴 미작성',
};

export function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function averageOf(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function toPercent(numerator: number, denominator: number) {
  if (!denominator || denominator <= 0) return 0;
  return clampPercent((numerator / denominator) * 100);
}

export function getAttendanceRiskMeta(score: number): {
  level: AttendanceRiskLevel;
  label: string;
  tone: string;
} {
  if (score >= 85) {
    return { level: 'stable', label: '안정', tone: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  }
  if (score >= 70) {
    return { level: 'watch', label: '주의', tone: 'bg-sky-100 text-sky-700 border-sky-200' };
  }
  if (score >= 55) {
    return { level: 'risk', label: '위험', tone: 'bg-amber-100 text-amber-700 border-amber-200' };
  }
  return { level: 'critical', label: '긴급', tone: 'bg-rose-100 text-rose-700 border-rose-200' };
}

export function getAttendanceStatusTone(status: DisplayAttendanceStatus) {
  switch (status) {
    case 'confirmed_present':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'confirmed_present_missing_routine':
      return 'bg-sky-100 text-sky-700 border-sky-200';
    case 'confirmed_late':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'confirmed_absent':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'excused_absent':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'missing_routine':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    default:
      return 'bg-slate-100 text-slate-500 border-slate-200';
  }
}

export function formatMinutesAsLabel(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const remain = safeMinutes % 60;
  if (hours === 0) return `${remain}분`;
  if (remain === 0) return `${hours}시간`;
  return `${hours}시간 ${remain}분`;
}

export function formatSignedMinutes(minutes: number) {
  const rounded = Math.round(Number(minutes) || 0);
  if (rounded === 0) return '정시';
  const direction = rounded > 0 ? '+' : '-';
  return `${direction}${Math.abs(rounded)}분`;
}

export function calculateAwayHealthScore(averageAwayMinutes: number) {
  const safeMinutes = Math.max(0, Math.round(averageAwayMinutes));
  if (safeMinutes <= 10) return 95;
  if (safeMinutes <= 20) return 85;
  if (safeMinutes <= 30) return 72;
  if (safeMinutes <= 45) return 58;
  if (safeMinutes <= 60) return 42;
  return 26;
}

export function calculateAttendanceStabilityScore(input: {
  attendanceRate: number;
  lateRate: number;
  absenceRate: number;
  averageAwayMinutes: number;
  checkoutCompletionRate: number;
}) {
  const attendanceScore = clampPercent(input.attendanceRate);
  const lateScore = clampPercent(100 - input.lateRate * 1.3);
  const absenceScore = clampPercent(100 - input.absenceRate * 2.1);
  const awayScore = calculateAwayHealthScore(input.averageAwayMinutes);
  const checkoutScore = clampPercent(input.checkoutCompletionRate);

  return clampPercent(
    attendanceScore * 0.34 +
      lateScore * 0.16 +
      absenceScore * 0.22 +
      awayScore * 0.14 +
      checkoutScore * 0.14
  );
}

export function buildAttendanceTopIssue(input: {
  absenceCount: number;
  lateCount: number;
  averageAwayMinutes: number;
  checkoutCompletionRate: number;
  routineMissingCount: number;
  recentRequestStatus: AttendanceRequest['status'] | 'none';
}) {
  if (input.absenceCount >= 2) return '무단결석 누적이 높아 즉시 상담 우선순위입니다.';
  if (input.lateCount >= 2) return '반복 지각 패턴이 보여 등원 루틴 보정이 필요합니다.';
  if (input.averageAwayMinutes >= 30) return '외출 시간이 길어 학습 흐름 이탈 가능성이 큽니다.';
  if (input.checkoutCompletionRate < 80) return '하원 기록 누락이 있어 보호자 커뮤니케이션 리스크가 있습니다.';
  if (input.routineMissingCount >= 2) return '출결 루틴 미작성 일수가 있어 KPI 신뢰도가 떨어집니다.';
  if (input.recentRequestStatus === 'requested') return '미처리 신청이 남아 있어 운영 후속 조치가 필요합니다.';
  return '최근 출결 흐름은 비교적 안정적입니다.';
}

export function buildAttendanceRecommendations(input: {
  absenceCount: number;
  lateCount: number;
  averageArrivalOffsetMinutes: number;
  averageAwayMinutes: number;
  checkoutCompletionRate: number;
  recentRequestStatus: AttendanceRequest['status'] | 'none';
  routineMissingCount: number;
}) {
  const recommendations: string[] = [];

  if (input.absenceCount >= 2) {
    recommendations.push('무단결석 사유를 오늘 바로 확인하고 학부모 상담 우선순위에 올리세요.');
  }

  if (input.lateCount >= 2 || input.averageArrivalOffsetMinutes >= 15) {
    recommendations.push('등원 예정 시각과 실제 체크인 차이를 보고 사전 알림 또는 루틴 시간을 재조정하세요.');
  }

  if (input.averageAwayMinutes >= 30) {
    recommendations.push('외출 길이가 긴 날의 사유를 점검하고 복귀 기준 시간을 선생님 체크 항목으로 고정하세요.');
  }

  if (input.checkoutCompletionRate < 80) {
    recommendations.push('하원 기록 누락이 있는 날을 먼저 정리해 보호자 안내와 운영 마감 루틴을 맞추세요.');
  }

  if (input.recentRequestStatus === 'requested') {
    recommendations.push('미처리 신청을 오늘 안에 승인 또는 반려해 출결 상태를 닫아 주세요.');
  }

  if (input.routineMissingCount >= 2) {
    recommendations.push('등원/하원 루틴 미작성일을 보완해 KPI 분모와 자동 판정 정확도를 높이세요.');
  }

  return recommendations.slice(0, 2);
}

export function deriveRequestOperationsSummary(
  requests: AttendanceRequest[],
  now = new Date()
): AttendanceRequestOperationsSummary {
  const nowMs = now.getTime();
  const pendingRequests = requests.filter((request) => request.status === 'requested');
  const pendingTodayCount = pendingRequests.length;
  const overduePendingCount = pendingRequests.filter((request) => {
    const dueAt =
      request.slaDueAt?.toDate?.()?.getTime() ??
      request.createdAt?.toDate?.()?.getTime() + 24 * 60 * 60 * 1000;
    return Number.isFinite(dueAt) ? dueAt < nowMs : false;
  }).length;

  const processedDurations = requests
    .filter((request) => request.status !== 'requested')
    .map((request) => {
      const createdAtMs = request.createdAt?.toDate?.()?.getTime() || 0;
      const resolvedAtMs =
        request.statusUpdatedAt?.toDate?.()?.getTime() ||
        request.updatedAt?.toDate?.()?.getTime() ||
        0;
      if (!createdAtMs || !resolvedAtMs || resolvedAtMs < createdAtMs) return null;
      return (resolvedAtMs - createdAtMs) / (1000 * 60 * 60);
    })
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  const repeatRequesterCount = Object.values(
    requests.reduce<Record<string, number>>((acc, request) => {
      acc[request.studentId] = (acc[request.studentId] || 0) + 1;
      return acc;
    }, {})
  ).filter((count) => count >= 2).length;

  return {
    pendingTodayCount,
    overduePendingCount,
    averageProcessingHours: processedDurations.length ? Math.round((processedDurations.reduce((sum, value) => sum + value, 0) / processedDurations.length) * 10) / 10 : 0,
    repeatRequesterCount,
  };
}
