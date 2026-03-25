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
  roomId?: string;
  roomSeatNo?: number;
  attendanceStatus: AttendanceCurrent['status'];
  compositeHealth: number;
  domainScores: CenterAdminSeatDomainScores;
  todayMinutes: number;
  effectivePenaltyPoints: number;
  hasUnreadReport: boolean;
  hasCounselingToday: boolean;
  currentAwayMinutes: number;
  invoiceStatus: Invoice['status'] | 'none';
  primaryChip: string;
  secondaryFlags: string[];
  topReason: string;
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
}) {
  const { hasUnreadReport, hasCounselingToday, invoiceStatus, currentAwayMinutes, status } = params;

  return [
    hasUnreadReport ? '미열람' : null,
    hasCounselingToday ? '상담' : null,
    invoiceStatus === 'issued' || invoiceStatus === 'overdue' ? '미수금' : null,
    currentAwayMinutes >= 20 ? '장기외출' : null,
    status === 'absent' ? '미입실' : null,
  ].filter(Boolean) as string[];
}

export function buildCenterAdminTopReason(signal: Omit<CenterAdminStudentSeatSignal, 'topReason'>) {
  if (signal.invoiceStatus === 'overdue') {
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

export function buildCenterAdminSeatLegend(): CenterAdminSeatOverlayLegend {
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
    billing: [
      { key: 'paid', label: '완납', tone: 'bg-emerald-500 text-white' },
      { key: 'issued', label: '청구', tone: 'bg-amber-100 text-amber-700' },
      { key: 'overdue', label: '연체', tone: 'bg-rose-600 text-white' },
      { key: 'none', label: '중립', tone: 'bg-slate-100 text-slate-700' },
    ],
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
): CenterAdminSeatOverlaySummary {
  return signals.reduce<CenterAdminSeatOverlaySummary>(
    (acc, signal) => {
      if (signal.compositeHealth >= 85) acc.healthyCount += 1;
      else if (signal.compositeHealth >= 50) acc.warningCount += 1;
      else acc.riskCount += 1;

      if (signal.hasUnreadReport) acc.unreadCount += 1;
      if (signal.hasCounselingToday) acc.counselingCount += 1;
      if (signal.invoiceStatus === 'overdue') acc.overdueCount += 1;
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

export function getCenterAdminDomainSummary(signal?: CenterAdminStudentSeatSignal | null) {
  if (!signal) return [];
  return (Object.keys(CENTER_ADMIN_SEAT_DOMAIN_LABELS) as CenterAdminSeatDomainKey[]).map((key) => ({
    key,
    label: CENTER_ADMIN_SEAT_DOMAIN_LABELS[key],
    score: signal.domainScores[key],
    badgeClass: getCenterAdminScoreBadgeClass(signal.domainScores[key]),
  }));
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
