'use client';

import { clampHealth, getHeatmapTone } from '@/lib/center-admin-heatmap';
import type { AttendanceCurrent, Invoice } from '@/lib/types';

export type CenterAdminSeatOverlayMode =
  | 'composite'
  | 'risk'
  | 'penalty'
  | 'minutes'
  | 'parent'
  | 'billing'
  | 'efficiency'
  | 'status';

export type CenterAdminSeatDomainKey =
  | 'operational'
  | 'parent'
  | 'risk'
  | 'billing'
  | 'efficiency';

export type CenterAdminSeatDomainScores = Record<CenterAdminSeatDomainKey, number>;

export interface CenterAdminStudentSeatSignal {
  studentId: string;
  seatId: string;
  studentName: string;
  className?: string;
  roomId?: string;
  roomSeatNo?: number;
  attendanceStatus: AttendanceCurrent['status'];
  compositeHealth: number;
  domainScores: CenterAdminSeatDomainScores;
  todayMinutes: number;
  weeklyStudyMinutes: number;
  weeklyStudyLabel: string;
  effectivePenaltyPoints: number;
  hasUnreadReport: boolean;
  hasCounselingToday: boolean;
  currentAwayMinutes: number;
  invoiceStatus: Invoice['status'] | 'none';
  primaryChip: string;
  secondaryFlags: string[];
  topReason: string;
}

export interface CenterAdminDomainSummaryItem {
  key: CenterAdminSeatDomainKey;
  label: string;
  score: number;
  badgeClass: string;
  analysis: string;
  action: string;
}

export interface CenterAdminSeatOverlayLegendItem {
  key: string;
  label: string;
  tone: string;
}

export interface CenterAdminSeatOverlaySummary {
  healthyCount: number;
  warningCount: number;
  riskCount: number;
  unreadCount: number;
  counselingCount: number;
  overdueCount: number;
  awayCount: number;
}

export type CenterAdminSeatOverlayLegend = Record<
  CenterAdminSeatOverlayMode,
  CenterAdminSeatOverlayLegendItem[]
>;

export interface CenterAdminSeatOverlayPresentation {
  surfaceClass: string;
  chipClass: string;
  flagClass: string;
  chipLabel: string;
  isDark: boolean;
}

type FinancialVisibilityOptions = {
  includeFinancialSignals?: boolean;
};

type ScoreToneMeta = {
  surfaceClass: string;
  chipClass: string;
  flagClass: string;
  badgeClass: string;
  isDark: boolean;
};

const SCORE_TONE_META: Record<'stable' | 'good' | 'watch' | 'risk', ScoreToneMeta> = {
  stable: {
    surfaceClass: 'border-emerald-300 bg-emerald-500 text-white shadow-lg shadow-emerald-200/70',
    chipClass: 'border border-white/10 bg-white/15 text-white',
    flagClass: 'border border-white/10 bg-white/15 text-white/90',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    isDark: true,
  },
  good: {
    surfaceClass: 'border-cyan-300 bg-cyan-500 text-white shadow-lg shadow-cyan-200/70',
    chipClass: 'border border-white/10 bg-white/15 text-white',
    flagClass: 'border border-white/10 bg-white/15 text-white/90',
    badgeClass: 'bg-cyan-100 text-cyan-700',
    isDark: true,
  },
  watch: {
    surfaceClass: 'border-amber-300 bg-amber-100 text-amber-900 shadow-sm',
    chipClass: 'bg-amber-600 text-white',
    flagClass: 'border border-amber-200 bg-white/80 text-amber-700',
    badgeClass: 'bg-amber-100 text-amber-700',
    isDark: false,
  },
  risk: {
    surfaceClass: 'border-rose-400 bg-rose-600 text-white shadow-lg shadow-rose-200/70',
    chipClass: 'border border-white/10 bg-white/15 text-white',
    flagClass: 'border border-white/10 bg-white/15 text-white/90',
    badgeClass: 'bg-rose-100 text-rose-700',
    isDark: true,
  },
};

const STATUS_TONE_META: Record<'studying' | 'away' | 'break' | 'absent' | 'empty', ScoreToneMeta> = {
  studying: {
    surfaceClass: 'border-blue-700 bg-blue-600 text-white shadow-xl shadow-blue-200/70',
    chipClass: 'border border-white/10 bg-white/15 text-white',
    flagClass: 'border border-white/10 bg-white/15 text-white/90',
    badgeClass: 'bg-blue-100 text-blue-700',
    isDark: true,
  },
  away: {
    surfaceClass: 'border-amber-300 bg-amber-100 text-amber-900 shadow-sm',
    chipClass: 'bg-amber-600 text-white',
    flagClass: 'border border-amber-200 bg-white/80 text-amber-700',
    badgeClass: 'bg-amber-100 text-amber-700',
    isDark: false,
  },
  break: {
    surfaceClass: 'border-amber-300 bg-amber-100 text-amber-900 shadow-sm',
    chipClass: 'bg-amber-600 text-white',
    flagClass: 'border border-amber-200 bg-white/80 text-amber-700',
    badgeClass: 'bg-amber-100 text-amber-700',
    isDark: false,
  },
  absent: {
    surfaceClass: 'border-slate-200 bg-white text-slate-900 shadow-sm',
    chipClass: 'bg-slate-900 text-white',
    flagClass: 'border border-slate-200 bg-slate-50 text-slate-600',
    badgeClass: 'bg-slate-100 text-slate-700',
    isDark: false,
  },
  empty: {
    surfaceClass: 'border-primary/40 bg-white text-primary/5 shadow-sm',
    chipClass: 'bg-primary/10 text-primary',
    flagClass: 'border border-primary/10 bg-primary/5 text-primary/60',
    badgeClass: 'bg-primary/10 text-primary',
    isDark: false,
  },
};

export const CENTER_ADMIN_SEAT_DOMAIN_LABELS: Record<CenterAdminSeatDomainKey, string> = {
  operational: '운영',
  parent: '학부모',
  risk: '리스크',
  billing: '수납',
  efficiency: '효율',
};

function formatDurationLabel(totalMinutes: number) {
  if (totalMinutes <= 0) return '0분';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}분`;
  if (minutes <= 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

export function formatCenterAdminWeeklyStudyLabel(totalMinutes: number | null | undefined) {
  if (!Number.isFinite(totalMinutes) || totalMinutes == null || totalMinutes < 0) {
    return '주간 확인중';
  }

  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `주간 ${hours}h ${minutes}m`;
}

function resolveScoreToneMeta(score: number) {
  const tone = getHeatmapTone(score);
  return SCORE_TONE_META[tone];
}

function getStatusToneMeta(status?: AttendanceCurrent['status']) {
  if (!status) return STATUS_TONE_META.empty;
  return STATUS_TONE_META[status];
}

function getRiskUrgencyScore(riskHealth: number) {
  return clampHealth(100 - riskHealth);
}

function getRiskUrgencyLabel(riskHealth: number) {
  const score = getRiskUrgencyScore(riskHealth);
  if (score >= 75) return '긴급';
  if (score >= 55) return '위험';
  if (score >= 30) return '주의';
  return '안정';
}

export function scoreStudentInvoiceHealth(status: Invoice['status'] | 'none') {
  switch (status) {
    case 'paid':
      return 95;
    case 'issued':
      return 65;
    case 'overdue':
      return 25;
    case 'void':
    case 'refunded':
      return 80;
    default:
      return 85;
  }
}

export function buildCenterAdminPrimaryChip(compositeHealth: number) {
  return `건강 ${compositeHealth}`;
}

export function buildCenterAdminSecondaryFlags(params: {
  hasUnreadReport: boolean;
  hasCounselingToday: boolean;
  invoiceStatus: Invoice['status'] | 'none';
  currentAwayMinutes: number;
  status: AttendanceCurrent['status'];
}, options: FinancialVisibilityOptions = {}) {
  const { hasUnreadReport, hasCounselingToday, invoiceStatus, currentAwayMinutes, status } = params;
  const includeFinancialSignals = options.includeFinancialSignals ?? true;

  return [
    hasUnreadReport ? '미열람' : null,
    hasCounselingToday ? '상담' : null,
    includeFinancialSignals && (invoiceStatus === 'issued' || invoiceStatus === 'overdue') ? '미수금' : null,
    currentAwayMinutes >= 20 ? '장기외출' : null,
    status === 'absent' ? '미입실' : null,
  ].filter(Boolean) as string[];
}

export function buildCenterAdminTopReason(
  signal: Omit<CenterAdminStudentSeatSignal, 'topReason'>,
  options: FinancialVisibilityOptions = {},
) {
  const includeFinancialSignals = options.includeFinancialSignals ?? true;

  if (includeFinancialSignals && signal.invoiceStatus === 'overdue') {
    return '당월 수납이 overdue 상태라 재확인이 필요합니다.';
  }
  if (signal.hasCounselingToday) {
    return '오늘 상담 일정이 잡혀 있어 바로 연결할 수 있습니다.';
  }
  if (signal.hasUnreadReport) {
    return '최근 발송한 리포트가 아직 미열람 상태입니다.';
  }
  if (signal.currentAwayMinutes >= 20) {
    return `외출/휴식이 ${signal.currentAwayMinutes}분 이어져 확인이 필요합니다.`;
  }
  if (signal.domainScores.risk < 50) {
    return '리스크 신호가 높아 우선 모니터링이 필요한 학생입니다.';
  }
  if (signal.domainScores.operational < 60) {
    return '오늘 몰입도와 계획 실행 흐름이 낮아 회복 코칭이 필요합니다.';
  }
  if (signal.domainScores.parent < 60) {
    return '학부모 반응 신호가 약해 커뮤니케이션 보강이 필요합니다.';
  }
  if (signal.domainScores.efficiency < 60) {
    return '리포트/운영 효율 신호가 약해 운영 밀도를 점검해야 합니다.';
  }
  return '현재는 전반적으로 안정적인 운영 흐름을 유지하고 있습니다.';
}

export function buildCenterAdminSeatLegend(
  options: FinancialVisibilityOptions = {},
): CenterAdminSeatOverlayLegend {
  const includeFinancialSignals = options.includeFinancialSignals ?? true;
  return {
    composite: [
      { key: 'stable', label: '85+ 안정', tone: 'bg-emerald-500 text-white' },
      { key: 'good', label: '70-84 양호', tone: 'bg-cyan-500 text-white' },
      { key: 'watch', label: '50-69 주의', tone: 'bg-amber-100 text-amber-700' },
      { key: 'risk', label: '50 미만 위험', tone: 'bg-rose-600 text-white' },
    ],
    risk: [
      { key: 'critical', label: '긴급', tone: 'bg-rose-600 text-white' },
      { key: 'risk', label: '위험', tone: 'bg-orange-500 text-white' },
      { key: 'watch', label: '주의', tone: 'bg-amber-100 text-amber-700' },
      { key: 'stable', label: '안정', tone: 'bg-emerald-100 text-emerald-700' },
    ],
    penalty: [
      { key: 'critical', label: '12점+', tone: 'bg-rose-600 text-white' },
      { key: 'risk', label: '7점+', tone: 'bg-orange-500 text-white' },
      { key: 'watch', label: '3점+', tone: 'bg-amber-100 text-amber-700' },
      { key: 'stable', label: '0-2점', tone: 'bg-slate-100 text-slate-700' },
    ],
    minutes: [
      { key: 'high', label: '360분+', tone: 'bg-emerald-500 text-white' },
      { key: 'good', label: '240분+', tone: 'bg-cyan-500 text-white' },
      { key: 'watch', label: '120분+', tone: 'bg-amber-100 text-amber-700' },
      { key: 'low', label: '120분 미만', tone: 'bg-rose-600 text-white' },
    ],
    parent: [
      { key: 'stable', label: '반응 안정', tone: 'bg-emerald-500 text-white' },
      { key: 'good', label: '양호', tone: 'bg-cyan-500 text-white' },
      { key: 'watch', label: '관심 필요', tone: 'bg-amber-100 text-amber-700' },
      { key: 'risk', label: '개입 필요', tone: 'bg-rose-600 text-white' },
    ],
    billing: includeFinancialSignals
      ? [
          { key: 'paid', label: '완납', tone: 'bg-emerald-500 text-white' },
          { key: 'issued', label: '청구', tone: 'bg-amber-100 text-amber-700' },
          { key: 'overdue', label: '연체', tone: 'bg-rose-600 text-white' },
          { key: 'none', label: '중립', tone: 'bg-slate-100 text-slate-700' },
        ]
      : [],
    efficiency: [
      { key: 'stable', label: '효율 안정', tone: 'bg-emerald-500 text-white' },
      { key: 'good', label: '양호', tone: 'bg-cyan-500 text-white' },
      { key: 'watch', label: '주의', tone: 'bg-amber-100 text-amber-700' },
      { key: 'risk', label: '밀도 낮음', tone: 'bg-rose-600 text-white' },
    ],
    status: [
      { key: 'studying', label: '입실', tone: 'bg-blue-600 text-white' },
      { key: 'away', label: '외출/휴식', tone: 'bg-amber-100 text-amber-700' },
      { key: 'absent', label: '미입실', tone: 'bg-slate-100 text-slate-700' },
    ],
  };
}

export function buildCenterAdminSeatOverlaySummary(
  signals: CenterAdminStudentSeatSignal[],
  options: FinancialVisibilityOptions = {},
): CenterAdminSeatOverlaySummary {
  const includeFinancialSignals = options.includeFinancialSignals ?? true;
  return signals.reduce<CenterAdminSeatOverlaySummary>(
    (acc, signal) => {
      if (signal.compositeHealth >= 85) acc.healthyCount += 1;
      else if (signal.compositeHealth >= 50) acc.warningCount += 1;
      else acc.riskCount += 1;

      if (signal.hasUnreadReport) acc.unreadCount += 1;
      if (signal.hasCounselingToday) acc.counselingCount += 1;
      if (includeFinancialSignals && signal.invoiceStatus === 'overdue') acc.overdueCount += 1;
      if (signal.currentAwayMinutes >= 20) acc.awayCount += 1;
      return acc;
    },
    {
      healthyCount: 0,
      warningCount: 0,
      riskCount: 0,
      unreadCount: 0,
      counselingCount: 0,
      overdueCount: 0,
      awayCount: 0,
    },
  );
}

export function getCenterAdminScoreBadgeClass(score: number) {
  return resolveScoreToneMeta(score).badgeClass;
}

export function getCenterAdminScoreSurfaceClass(score: number) {
  return resolveScoreToneMeta(score).surfaceClass;
}

export function getCenterAdminDomainInsight(
  signal: CenterAdminStudentSeatSignal,
  key: CenterAdminSeatDomainKey,
): CenterAdminDomainSummaryItem {
  const score = signal.domainScores[key];
  const label = CENTER_ADMIN_SEAT_DOMAIN_LABELS[key];
  const badgeClass = getCenterAdminScoreBadgeClass(score);
  let analysis = '';
  let action = '';

  if (key === 'operational') {
    if (signal.attendanceStatus === 'absent') {
      if (signal.todayMinutes >= 1) {
        analysis = `오늘 ${formatDurationLabel(signal.todayMinutes)} 학습 후 현재 퇴실 상태라 운영 점수가 ${score}점으로 보수적으로 잡혔습니다.`;
        action = '다음 입실 예정 시각을 확인하고 남은 학습 블록 목표를 다시 짧게 잡아주세요.';
      } else {
        analysis = `아직 입실 신호가 없어 오늘 학습 루틴이 시작되지 않아 운영 점수가 ${score}점입니다.`;
        action = '루틴 시각과 첫 공부 블록을 바로 확인해 입실 코칭부터 넣어주는 것이 좋습니다.';
      }
    } else if (signal.currentAwayMinutes >= 20) {
      analysis = `현재 외출/휴식이 ${signal.currentAwayMinutes}분 이어져 오늘 학습 흐름 점수가 ${score}점으로 내려갔습니다.`;
      action = '복귀 시각을 체크하고 바로 이어갈 다음 30~60분 집중 과제를 하나만 확정해 주세요.';
    } else if (signal.todayMinutes < 120) {
      analysis = `오늘 누적 공부시간이 ${formatDurationLabel(signal.todayMinutes)} 수준이라 운영 점수가 ${score}점으로 아직 낮게 보입니다.`;
      action = '첫 완료 과제를 작게 다시 잡아 빠르게 공부 리듬을 회복시키는 대응이 좋습니다.';
    } else if (score >= 85) {
      analysis = `오늘 입실과 학습 흐름이 안정적이라 운영 점수가 ${score}점으로 높게 유지되고 있습니다.`;
      action = '지금 페이스를 유지하면서 다음 체크 시점만 짧게 확인해 주면 충분합니다.';
    } else {
      analysis = `오늘 학습 흐름은 유지되고 있지만 집중도나 계획 실행 밀도가 완전히 올라오지 않아 운영 점수가 ${score}점입니다.`;
      action = '현재 과제를 더 작게 쪼개고 다음 완료 기준을 명확히 잡아 점수를 끌어올리는 것이 좋습니다.';
    }
  } else if (key === 'parent') {
    if (signal.hasUnreadReport && signal.hasCounselingToday) {
      analysis = `최근 리포트 미열람이 있지만 오늘 상담 일정이 있어 학부모 반응 점수는 ${score}점으로 회복 여지가 있습니다.`;
      action = '상담에서 오늘 변화 한 가지와 다음 행동 한 가지를 짧게 공유해 열람과 응답을 동시에 끌어올려 주세요.';
    } else if (signal.hasUnreadReport) {
      analysis = `최근 발송한 리포트가 아직 미열람 상태라 학부모 반응 점수가 ${score}점으로 낮아졌습니다.`;
      action = '핵심 변화 한 줄만 다시 보내고 확인 회신을 받아 반응 신호를 회복하는 것이 좋습니다.';
    } else if (signal.hasCounselingToday) {
      analysis = `오늘 상담 연결 포인트가 잡혀 있어 학부모 소통 점수는 ${score}점으로 안정적으로 유지되고 있습니다.`;
      action = '상담 후 바로 짧은 요약 메시지를 남겨 다음 열람과 응답까지 이어지게 해주세요.';
    } else if (score >= 85) {
      analysis = `최근 열람과 소통 흐름이 안정적이라 학부모 점수가 ${score}점으로 높게 유지되고 있습니다.`;
      action = '특이사항만 짧게 이어가면 충분하고, 과도한 추가 연락보다는 리듬 유지가 더 좋습니다.';
    } else {
      analysis = `학부모 반응 데이터가 아주 약한 것은 아니지만 최근 상호작용 밀도가 낮아 ${score}점으로 보입니다.`;
      action = '이번 주 변화 포인트를 한 줄 요약으로 먼저 보내고, 필요 시 짧은 상담 제안을 붙여 주세요.';
    }
  } else if (key === 'risk') {
    if (signal.effectivePenaltyPoints >= 7 && signal.currentAwayMinutes >= 20) {
      analysis = `벌점 ${signal.effectivePenaltyPoints}점과 ${signal.currentAwayMinutes}분 장기 외출이 함께 보여 리스크 점수가 ${score}점까지 낮아졌습니다.`;
      action = '오늘은 자리 이탈 원인과 다음 행동 약속 한 가지를 바로 합의해 재발 가능성을 먼저 줄여 주세요.';
    } else if (signal.effectivePenaltyPoints >= 7) {
      analysis = `누적 벌점이 ${signal.effectivePenaltyPoints}점이라 행동 리스크 신호가 커져 현재 점수는 ${score}점입니다.`;
      action = '최근 벌점 원인을 짧게 복기하고 오늘 바로 지킬 행동 기준 하나만 다시 잡아 주세요.';
    } else if (signal.currentAwayMinutes >= 20) {
      analysis = `현재 외출/휴식이 ${signal.currentAwayMinutes}분 이어져 이탈 리스크가 커졌고 점수도 ${score}점으로 내려갔습니다.`;
      action = '복귀 즉시 다음 체크 시각과 착석 목표를 확정해 흐름이 끊기지 않게 관리해 주세요.';
    } else if (score >= 85) {
      analysis = `현재 큰 위험 신호가 적고 운영 흐름도 안정적이라 리스크 점수가 ${score}점으로 높습니다.`;
      action = '지금 상태를 유지하면서 갑작스러운 이탈만 가볍게 모니터링하면 충분합니다.';
    } else {
      analysis = `즉시 큰 경보는 아니지만 최근 행동 안정도가 완전히 올라오지 않아 리스크 점수가 ${score}점입니다.`;
      action = '오늘 기준으로 지켜야 할 핵심 한 가지를 짧게 다시 확인해 안정 구간으로 올리는 것이 좋습니다.';
    }
  } else if (key === 'billing') {
    if (signal.invoiceStatus === 'overdue') {
      analysis = `당월 수납이 연체 상태라 수납 건강도가 크게 깎이면서 점수가 ${score}점으로 떨어졌습니다.`;
      action = '보호자에게 금일 확인 메시지를 보내고 실제 결제 예정일을 확정해 두는 대응이 가장 좋습니다.';
    } else if (signal.invoiceStatus === 'issued') {
      analysis = `청구는 나갔지만 아직 미납 상태라 수납 점수가 ${score}점으로 보수적으로 잡혀 있습니다.`;
      action = '안내 메시지 한 번 더 보내고 결제 예정 시점을 체크해 연체 전환을 막아 주세요.';
    } else if (signal.invoiceStatus === 'paid') {
      analysis = `당월 수납이 정상 완료되어 수납 점수가 ${score}점으로 안정적으로 유지되고 있습니다.`;
      action = '추가 대응은 거의 필요 없고 다음 청구 주기만 놓치지 않게 관리하면 충분합니다.';
    } else if (signal.invoiceStatus === 'void' || signal.invoiceStatus === 'refunded') {
      analysis = `이번 달 수납 상태가 예외 처리되어 있어 수납 점수는 ${score}점의 중립에 가깝게 보입니다.`;
      action = '환불이나 무효 사유가 운영 기록과 맞는지만 한 번 확인해 두면 좋습니다.';
    } else {
      analysis = `현재 수납 이슈 데이터가 없어 수납 점수는 ${score}점의 중립값으로 표시되고 있습니다.`;
      action = '실제 청구 예정 여부만 한 번 확인해 두면 이후 점수 해석이 더 정확해집니다.';
    }
  } else {
    if (signal.hasUnreadReport && signal.currentAwayMinutes >= 20) {
      analysis = `리포트 미열람과 ${signal.currentAwayMinutes}분 장기 외출이 겹쳐 운영 후속조치 효율 점수가 ${score}점입니다.`;
      action = '복귀 확인 후 오늘 리포트 핵심 한 줄과 다음 체크 시각을 바로 남겨 운영 밀도를 높여 주세요.';
    } else if (signal.hasUnreadReport) {
      analysis = `최근 리포트 후속 확인이 닿지 않아 운영 효율 점수가 ${score}점으로 내려가 있습니다.`;
      action = '오늘 변화 포인트를 한 줄로 다시 전달하고 확인 여부를 바로 체크해 주세요.';
    } else if (signal.currentAwayMinutes >= 20) {
      analysis = `장기 외출로 현장 팔로업이 길어지면서 운영 효율 점수가 ${score}점까지 낮아졌습니다.`;
      action = '복귀 즉시 다음 행동과 체크 시각을 짧게 확정해 운영 공백을 줄여 주세요.';
    } else if (score >= 85) {
      analysis = `팔로업과 운영 흐름이 안정적으로 유지돼 효율 점수가 ${score}점으로 좋습니다.`;
      action = '현재 방식 그대로 유지하면서 예외 상황만 빠르게 닫아주면 충분합니다.';
    } else {
      analysis = `운영 후속조치 밀도가 아주 낮지는 않지만 더 촘촘하게 관리할 여지가 있어 효율 점수가 ${score}점입니다.`;
      action = '오늘 꼭 남겨야 할 코멘트와 다음 확인 시각을 짧게 남겨 운영 리듬을 정리해 주세요.';
    }
  }

  return {
    key,
    label,
    score,
    badgeClass,
    analysis,
    action,
  };
}

export function getCenterAdminDomainSummary(
  signal?: CenterAdminStudentSeatSignal | null,
  options: FinancialVisibilityOptions = {},
): CenterAdminDomainSummaryItem[] {
  if (!signal) return [];
  const includeFinancialSignals = options.includeFinancialSignals ?? true;
  return (Object.keys(CENTER_ADMIN_SEAT_DOMAIN_LABELS) as CenterAdminSeatDomainKey[])
    .filter((key) => includeFinancialSignals || key !== 'billing')
    .map((key) =>
    getCenterAdminDomainInsight(signal, key),
    );
}

export function getCenterAdminSeatOverlayPresentation(params: {
  signal?: CenterAdminStudentSeatSignal | null;
  mode: CenterAdminSeatOverlayMode;
  status?: AttendanceCurrent['status'];
  isEditMode?: boolean;
}): CenterAdminSeatOverlayPresentation {
  const { signal, mode, status, isEditMode = false } = params;

  if (isEditMode || mode === 'status' || !signal) {
    const statusTone = getStatusToneMeta(status);
    const chipLabel =
      status === 'studying'
        ? '입실'
        : status === 'away'
          ? '외출'
          : status === 'break'
            ? '휴식'
            : '미입실';

    return {
      surfaceClass: statusTone.surfaceClass,
      chipClass: statusTone.chipClass,
      flagClass: statusTone.flagClass,
      chipLabel,
      isDark: statusTone.isDark,
    };
  }

  if (mode === 'risk') {
    const urgencyScore = getRiskUrgencyScore(signal.domainScores.risk);
    const urgencyLabel = getRiskUrgencyLabel(signal.domainScores.risk);
    if (urgencyScore >= 75) {
      return {
        surfaceClass: 'border-rose-400 bg-rose-600 text-white shadow-lg shadow-rose-200/70',
        chipClass: 'border border-white/10 bg-white/15 text-white',
        flagClass: 'border border-white/10 bg-white/15 text-white/90',
        chipLabel: urgencyLabel,
        isDark: true,
      };
    }
    if (urgencyScore >= 55) {
      return {
        surfaceClass: 'border-orange-400 bg-orange-500 text-white shadow-lg shadow-orange-200/70',
        chipClass: 'border border-white/10 bg-white/15 text-white',
        flagClass: 'border border-white/10 bg-white/15 text-white/90',
        chipLabel: urgencyLabel,
        isDark: true,
      };
    }
    if (urgencyScore >= 30) {
      return {
        surfaceClass: 'border-amber-300 bg-amber-100 text-amber-900 shadow-sm',
        chipClass: 'bg-amber-600 text-white',
        flagClass: 'border border-amber-200 bg-white/80 text-amber-700',
        chipLabel: urgencyLabel,
        isDark: false,
      };
    }

    return {
      surfaceClass: 'border-emerald-300 bg-emerald-100 text-emerald-900 shadow-sm',
      chipClass: 'bg-emerald-600 text-white',
      flagClass: 'border border-emerald-200 bg-white/80 text-emerald-700',
      chipLabel: urgencyLabel,
      isDark: false,
    };
  }

  if (mode === 'penalty') {
    if (signal.effectivePenaltyPoints >= 12) {
      return {
        surfaceClass: 'border-rose-400 bg-rose-600 text-white shadow-lg shadow-rose-200/70',
        chipClass: 'border border-white/10 bg-white/15 text-white',
        flagClass: 'border border-white/10 bg-white/15 text-white/90',
        chipLabel: `${signal.effectivePenaltyPoints}점`,
        isDark: true,
      };
    }
    if (signal.effectivePenaltyPoints >= 7) {
      return {
        surfaceClass: 'border-orange-400 bg-orange-500 text-white shadow-lg shadow-orange-200/70',
        chipClass: 'border border-white/10 bg-white/15 text-white',
        flagClass: 'border border-white/10 bg-white/15 text-white/90',
        chipLabel: `${signal.effectivePenaltyPoints}점`,
        isDark: true,
      };
    }
    if (signal.effectivePenaltyPoints >= 3) {
      return {
        surfaceClass: 'border-amber-300 bg-amber-100 text-amber-900 shadow-sm',
        chipClass: 'bg-amber-600 text-white',
        flagClass: 'border border-amber-200 bg-white/80 text-amber-700',
        chipLabel: `${signal.effectivePenaltyPoints}점`,
        isDark: false,
      };
    }

    return {
      surfaceClass: 'border-slate-200 bg-white text-slate-900 shadow-sm',
      chipClass: 'bg-slate-900 text-white',
      flagClass: 'border border-slate-200 bg-slate-50 text-slate-600',
      chipLabel: `${signal.effectivePenaltyPoints}점`,
      isDark: false,
    };
  }

  if (mode === 'minutes') {
    const minuteScore =
      signal.todayMinutes >= 360 ? 95 : signal.todayMinutes >= 240 ? 80 : signal.todayMinutes >= 120 ? 60 : 35;
    const tone = resolveScoreToneMeta(minuteScore);
    return {
      surfaceClass: tone.surfaceClass,
      chipClass: tone.chipClass,
      flagClass: tone.flagClass,
      chipLabel: `${signal.todayMinutes}분`,
      isDark: tone.isDark,
    };
  }

  if (mode === 'billing') {
    const billingScore = signal.domainScores.billing;
    const tone = resolveScoreToneMeta(billingScore);
    const chipLabel =
      signal.invoiceStatus === 'paid'
        ? '완납'
        : signal.invoiceStatus === 'issued'
          ? '청구'
          : signal.invoiceStatus === 'overdue'
            ? '연체'
            : signal.invoiceStatus === 'void' || signal.invoiceStatus === 'refunded'
              ? '정리'
              : '중립';

    return {
      surfaceClass: tone.surfaceClass,
      chipClass: tone.chipClass,
      flagClass: tone.flagClass,
      chipLabel,
      isDark: tone.isDark,
    };
  }

  if (mode === 'parent') {
    const tone = resolveScoreToneMeta(signal.domainScores.parent);
    return {
      surfaceClass: tone.surfaceClass,
      chipClass: tone.chipClass,
      flagClass: tone.flagClass,
      chipLabel: `부모 ${signal.domainScores.parent}`,
      isDark: tone.isDark,
    };
  }

  if (mode === 'efficiency') {
    const tone = resolveScoreToneMeta(signal.domainScores.efficiency);
    return {
      surfaceClass: tone.surfaceClass,
      chipClass: tone.chipClass,
      flagClass: tone.flagClass,
      chipLabel: `효율 ${signal.domainScores.efficiency}`,
      isDark: tone.isDark,
    };
  }

  const tone = resolveScoreToneMeta(signal.compositeHealth);
  return {
    surfaceClass: tone.surfaceClass,
    chipClass: tone.chipClass,
    flagClass: tone.flagClass,
    chipLabel: signal.primaryChip,
    isDark: tone.isDark,
  };
}
