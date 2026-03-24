'use client';

import { useMemo } from 'react';
import { doc } from 'firebase/firestore';

import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import type {
  AttendanceCurrent,
  CenterMembership,
  ClassroomIncidentType,
  ClassroomOverlayMode,
  ClassroomQuickFilter,
  ClassroomSeatSignal,
  ClassroomSignalClassSummary,
  ClassroomSignalIncident,
  ClassroomSignalsDocument,
  ClassroomSignalPriority,
  ClassroomSignalRiskLevel,
  DailyStudentStat,
  StudentProfile,
} from '@/lib/types';

export type ClassroomLegendItem = {
  key: string;
  label: string;
  tone: string;
};

export type ClassroomIncidentFilter = {
  key: ClassroomQuickFilter;
  label: string;
  count: number;
};

export type ClassroomSeatOverlayState = {
  seatId: string;
  overlayMode: ClassroomOverlayMode;
  overlayTone: string;
  overlayLabel: string | null;
  dimmed: boolean;
  ringTone: string | null;
  incidentPriority?: ClassroomSignalPriority;
};

export type ClassroomStudentInsight = {
  highlightTitle: string;
  highlightReason: string;
  triggerBadges: string[];
  trendSummary: string;
  reportSummary: string;
  counselingSummary: string;
  penaltySummary: string;
  recommendedActions: Array<{
    key: string;
    label: string;
    tone: 'default' | 'primary' | 'warning';
  }>;
};

const QUICK_FILTER_LABELS: Record<ClassroomQuickFilter, string> = {
  all: '전체',
  studying: '학습 중',
  awayLong: '장기 외출',
  lateOrAbsent: '미입실/지각',
  atRisk: '리스크',
  unreadReports: '미열람 리포트',
  counselingPending: '상담 대기',
};

const INCIDENT_TYPE_LABELS: Record<ClassroomIncidentType, string> = {
  away_long: '장기 외출',
  late_or_absent: '미입실/지각',
  risk: '리스크',
  unread_report: '리포트 미열람',
  counseling_pending: '상담 대기',
  penalty_threshold: '벌점 임계',
  check_in: '입실',
  check_out: '퇴실',
};

const PRIORITY_WEIGHT: Record<ClassroomSignalPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function scoreToRiskLevel(score: number): ClassroomSignalRiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 55) return 'risk';
  if (score >= 30) return 'watch';
  return 'stable';
}

function minutesTone(minutes: number) {
  if (minutes >= 360) return 'bg-emerald-500 text-white';
  if (minutes >= 240) return 'bg-emerald-100 text-emerald-700';
  if (minutes >= 120) return 'bg-amber-100 text-amber-700';
  return 'bg-rose-100 text-rose-700';
}

function penaltyTone(points: number) {
  if (points >= 12) return 'bg-rose-600 text-white';
  if (points >= 7) return 'bg-orange-500 text-white';
  if (points >= 3) return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

function riskTone(level: ClassroomSignalRiskLevel) {
  switch (level) {
    case 'critical':
      return 'bg-rose-600 text-white';
    case 'risk':
      return 'bg-orange-500 text-white';
    case 'watch':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-emerald-100 text-emerald-700';
  }
}

function priorityRing(priority?: ClassroomSignalPriority) {
  switch (priority) {
    case 'critical':
      return 'ring-2 ring-rose-500';
    case 'high':
      return 'ring-2 ring-orange-400';
    case 'medium':
      return 'ring-2 ring-amber-300';
    default:
      return null;
  }
}

function sortIncidents(items: ClassroomSignalIncident[]) {
  return [...items].sort((a, b) => {
    const byPriority = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    if (byPriority !== 0) return byPriority;
    return (b.occurredAt?.toMillis?.() || 0) - (a.occurredAt?.toMillis?.() || 0);
  });
}

function normalizeIncidentType(type: ClassroomSignalIncident['type'] | 'report_unread'): ClassroomIncidentType {
  return type === 'report_unread' ? 'unread_report' : type;
}

function normalizeSignals(signals?: ClassroomSignalsDocument | null): ClassroomSignalsDocument | null {
  if (!signals) return null;
  return {
    ...signals,
    incidents: (signals.incidents || []).map((incident) => ({
      ...incident,
      type: normalizeIncidentType(incident.type as ClassroomSignalIncident['type'] | 'report_unread'),
    })),
  };
}

export function buildIncidentFilters(signals?: ClassroomSignalsDocument | null): ClassroomIncidentFilter[] {
  const summary = signals?.summary;
  return [
    { key: 'all', label: QUICK_FILTER_LABELS.all, count: signals?.seatSignals.length || 0 },
    { key: 'studying', label: QUICK_FILTER_LABELS.studying, count: summary?.studying || 0 },
    { key: 'awayLong', label: QUICK_FILTER_LABELS.awayLong, count: summary?.awayLong || 0 },
    { key: 'lateOrAbsent', label: QUICK_FILTER_LABELS.lateOrAbsent, count: summary?.lateOrAbsent || 0 },
    { key: 'atRisk', label: QUICK_FILTER_LABELS.atRisk, count: summary?.atRisk || 0 },
    { key: 'unreadReports', label: QUICK_FILTER_LABELS.unreadReports, count: summary?.unreadReports || 0 },
    { key: 'counselingPending', label: QUICK_FILTER_LABELS.counselingPending, count: summary?.counselingPending || 0 },
  ];
}

export function buildClassHealthView(
  classSummaries: ClassroomSignalClassSummary[] | undefined,
  selectedClass: string,
) {
  const list = classSummaries || [];
  if (selectedClass === 'all') return list;
  return list.filter((item) => item.className === selectedClass);
}

export function buildSeatOverlayState(params: {
  seat: AttendanceCurrent;
  seatSignal?: ClassroomSeatSignal;
  activeFilter: ClassroomQuickFilter;
  overlayMode: ClassroomOverlayMode;
  incidentsBySeatId: Map<string, ClassroomSignalIncident[]>;
}): ClassroomSeatOverlayState {
  const { seat, seatSignal, activeFilter, overlayMode, incidentsBySeatId } = params;
  const incidents = incidentsBySeatId.get(seat.id) || [];
  const incidentPriority = incidents[0]?.priority;

  const matchesFilter =
    activeFilter === 'all' ||
    (activeFilter === 'studying' && seat.status === 'studying') ||
    (activeFilter === 'awayLong' && seatSignal?.overlayFlags.includes('away_long')) ||
    (activeFilter === 'lateOrAbsent' && seatSignal?.overlayFlags.includes('late_or_absent')) ||
    (activeFilter === 'atRisk' && seatSignal?.overlayFlags.includes('risk')) ||
    (activeFilter === 'unreadReports' && seatSignal?.hasUnreadReport) ||
    (activeFilter === 'counselingPending' && seatSignal?.hasCounselingToday);

  if (!seatSignal) {
    return {
      seatId: seat.id,
      overlayMode,
      overlayTone: 'bg-slate-50 text-slate-400',
      overlayLabel: overlayMode === 'status' ? null : '-',
      dimmed: activeFilter !== 'all',
      ringTone: priorityRing(incidentPriority),
      incidentPriority,
    };
  }

  if (overlayMode === 'risk') {
    const labels: Record<ClassroomSignalRiskLevel, string> = {
      critical: '긴급',
      risk: '위험',
      watch: '주의',
      stable: '안정',
    };
    return {
      seatId: seat.id,
      overlayMode,
      overlayTone: riskTone(seatSignal.riskLevel),
      overlayLabel: labels[seatSignal.riskLevel],
      dimmed: !matchesFilter,
      ringTone: priorityRing(incidentPriority),
      incidentPriority,
    };
  }

  if (overlayMode === 'penalty') {
    return {
      seatId: seat.id,
      overlayMode,
      overlayTone: penaltyTone(seatSignal.effectivePenaltyPoints),
      overlayLabel: `${seatSignal.effectivePenaltyPoints}점`,
      dimmed: !matchesFilter,
      ringTone: priorityRing(incidentPriority),
      incidentPriority,
    };
  }

  if (overlayMode === 'minutes') {
    return {
      seatId: seat.id,
      overlayMode,
      overlayTone: minutesTone(seatSignal.todayMinutes),
      overlayLabel: `${seatSignal.todayMinutes}분`,
      dimmed: !matchesFilter,
      ringTone: priorityRing(incidentPriority),
      incidentPriority,
    };
  }

  if (overlayMode === 'counseling') {
    return {
      seatId: seat.id,
      overlayMode,
      overlayTone: seatSignal.hasCounselingToday ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500',
      overlayLabel: seatSignal.hasCounselingToday ? '상담' : '-',
      dimmed: !matchesFilter,
      ringTone: priorityRing(incidentPriority),
      incidentPriority,
    };
  }

  if (overlayMode === 'report') {
    return {
      seatId: seat.id,
      overlayMode,
      overlayTone: seatSignal.hasUnreadReport ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500',
      overlayLabel: seatSignal.hasUnreadReport ? '미열람' : '확인',
      dimmed: !matchesFilter,
      ringTone: priorityRing(incidentPriority),
      incidentPriority,
    };
  }

  return {
    seatId: seat.id,
    overlayMode,
    overlayTone:
      seat.status === 'studying'
        ? 'bg-blue-600 text-white'
        : seat.status === 'away' || seat.status === 'break'
          ? 'bg-amber-100 text-amber-700'
          : seat.studentId
            ? 'bg-white text-slate-800'
            : 'bg-slate-50 text-slate-400',
    overlayLabel: null,
    dimmed: !matchesFilter,
    ringTone: priorityRing(incidentPriority),
    incidentPriority,
  };
}

export function buildSeatLegend(mode: ClassroomOverlayMode): ClassroomLegendItem[] {
  switch (mode) {
    case 'risk':
      return [
        { key: 'critical', label: '긴급', tone: 'bg-rose-600 text-white' },
        { key: 'risk', label: '위험', tone: 'bg-orange-500 text-white' },
        { key: 'watch', label: '주의', tone: 'bg-amber-100 text-amber-700' },
        { key: 'stable', label: '안정', tone: 'bg-emerald-100 text-emerald-700' },
      ];
    case 'penalty':
      return [
        { key: 'critical', label: '12점 이상', tone: 'bg-rose-600 text-white' },
        { key: 'high', label: '7점 이상', tone: 'bg-orange-500 text-white' },
        { key: 'warning', label: '3점 이상', tone: 'bg-amber-100 text-amber-700' },
        { key: 'stable', label: '안정', tone: 'bg-slate-100 text-slate-700' },
      ];
    case 'minutes':
      return [
        { key: 'high', label: '360분 이상', tone: 'bg-emerald-500 text-white' },
        { key: 'mid', label: '240분 이상', tone: 'bg-emerald-100 text-emerald-700' },
        { key: 'warning', label: '120분 이상', tone: 'bg-amber-100 text-amber-700' },
        { key: 'low', label: '120분 미만', tone: 'bg-rose-100 text-rose-700' },
      ];
    case 'counseling':
      return [
        { key: 'yes', label: '오늘 상담', tone: 'bg-violet-600 text-white' },
        { key: 'no', label: '없음', tone: 'bg-slate-100 text-slate-700' },
      ];
    case 'report':
      return [
        { key: 'yes', label: '미열람', tone: 'bg-sky-600 text-white' },
        { key: 'no', label: '확인 완료', tone: 'bg-slate-100 text-slate-700' },
      ];
    default:
      return [
        { key: 'studying', label: '학습 중', tone: 'bg-blue-600 text-white' },
        { key: 'away', label: '외출/휴식', tone: 'bg-amber-100 text-amber-700' },
        { key: 'absent', label: '미입실', tone: 'bg-slate-100 text-slate-700' },
      ];
  }
}

export function buildStudentClassroomInsight(params: {
  seat?: AttendanceCurrent | null;
  student?: StudentProfile | null;
  membership?: CenterMembership | null;
  todayStat?: DailyStudentStat | null;
  seatSignal?: ClassroomSeatSignal | null;
  incidents: ClassroomSignalIncident[];
  recentHistoryMinutes: number[];
  penaltyPoints: number;
  hasRecentReport: boolean;
  hasUnreadReport: boolean;
  hasCounselingToday: boolean;
}): ClassroomStudentInsight {
  const {
    seat,
    membership,
    todayStat,
    seatSignal,
    incidents,
    recentHistoryMinutes,
    penaltyPoints,
    hasRecentReport,
    hasUnreadReport,
    hasCounselingToday,
  } = params;

  const [topIncident] = sortIncidents(incidents);
  const threeDayAverage =
    recentHistoryMinutes.length > 0
      ? Math.round(recentHistoryMinutes.reduce((sum, value) => sum + value, 0) / recentHistoryMinutes.length)
      : 0;
  const todayMinutes = Math.round(Number(todayStat?.totalStudyMinutes || seatSignal?.todayMinutes || 0));
  const delta = todayMinutes - threeDayAverage;
  const trendSummary =
    recentHistoryMinutes.length === 0
      ? '최근 3일 학습 데이터가 아직 충분하지 않습니다.'
      : delta >= 30
        ? `최근 3일 평균보다 ${delta}분 더 학습했습니다.`
        : delta <= -30
          ? `최근 3일 평균보다 ${Math.abs(delta)}분 적게 학습했습니다.`
          : '최근 3일 평균과 비슷한 학습 흐름을 유지하고 있습니다.';

  const triggerBadges = [
    seatSignal?.overlayFlags.includes('risk') ? '리스크' : null,
    seatSignal?.overlayFlags.includes('away_long') ? '장기 외출' : null,
    seatSignal?.overlayFlags.includes('late_or_absent') ? '미입실/지각' : null,
    hasUnreadReport ? '리포트 미열람' : null,
    hasCounselingToday ? '오늘 상담' : null,
    penaltyPoints >= 7 ? `벌점 ${penaltyPoints}점` : null,
    membership?.className || null,
  ].filter(Boolean) as string[];

  const recommendedActions: ClassroomStudentInsight['recommendedActions'] = [
    hasCounselingToday ? { key: 'counseling', label: '상담 열기', tone: 'primary' } : null,
    hasUnreadReport ? { key: 'report', label: '리포트 보기', tone: 'default' } : null,
    seat?.status !== 'studying'
      ? { key: 'status', label: '상태 변경', tone: 'warning' }
      : { key: 'status', label: '실시간 상태 보기', tone: 'default' },
    { key: 'detail', label: '학생 상세 이동', tone: 'default' },
  ].filter(Boolean) as ClassroomStudentInsight['recommendedActions'];

  return {
    highlightTitle: topIncident ? INCIDENT_TYPE_LABELS[topIncident.type] : '실시간 관찰',
    highlightReason:
      topIncident?.reason ||
      (seatSignal?.overlayFlags.includes('risk')
        ? '리스크 신호가 감지되어 우선 확인이 필요합니다.'
        : seat?.status === 'away' || seat?.status === 'break'
          ? '좌석 이탈 상태가 이어지고 있어 확인이 필요합니다.'
          : '현재는 큰 이상 없이 안정적으로 운영 중입니다.'),
    triggerBadges,
    trendSummary,
    reportSummary: hasRecentReport
      ? hasUnreadReport
        ? '최근 발송한 리포트가 아직 열람되지 않았습니다.'
        : '최근 리포트는 확인이 완료된 상태입니다.'
      : '최근 발송된 리포트가 없습니다.',
    counselingSummary: hasCounselingToday
      ? '오늘 상담 일정이 잡혀 있어 바로 연결할 수 있습니다.'
      : '오늘 예정된 상담은 없습니다.',
    penaltySummary:
      penaltyPoints >= 12
        ? `실효 벌점 ${penaltyPoints}점으로 긴급 개입 기준입니다.`
        : penaltyPoints >= 7
          ? `실효 벌점 ${penaltyPoints}점으로 우선 상담이 필요한 구간입니다.`
          : `실효 벌점 ${penaltyPoints}점으로 현재는 모니터링 중심입니다.`,
    recommendedActions,
  };
}

export function buildSeatSignalsFromLiveData(params: {
  attendanceList?: AttendanceCurrent[] | null;
  studentMembers?: CenterMembership[] | null;
  todayStats?: DailyStudentStat[] | null;
  riskStudentIds?: Set<string>;
  unreadReportStudentIds?: Set<string>;
  counselingTodayStudentIds?: Set<string>;
  effectivePenaltyByStudentId?: Map<string, number>;
}): ClassroomSeatSignal[] {
  const {
    attendanceList,
    studentMembers,
    todayStats,
    riskStudentIds,
    unreadReportStudentIds,
    counselingTodayStudentIds,
    effectivePenaltyByStudentId,
  } = params;
  if (!attendanceList) return [];

  const memberById = new Map((studentMembers || []).map((member) => [member.id, member]));
  const statByStudentId = new Map((todayStats || []).map((item) => [item.studentId, item]));

  return attendanceList
    .filter((seat) => seat.studentId)
    .map((seat) => {
      const studentId = seat.studentId as string;
      const todayMinutes = Math.round(Number(statByStudentId.get(studentId)?.totalStudyMinutes || 0));
      const penaltyPoints = Math.max(0, Math.round(Number(effectivePenaltyByStudentId?.get(studentId) || 0)));
      const riskScore =
        (riskStudentIds?.has(studentId) ? 60 : 0) +
        clamp((penaltyPoints / 12) * 25, 0, 25) +
        clamp(((180 - todayMinutes) / 180) * 15, 0, 15) +
        (seat.status === 'absent' ? 12 : 0);

      const overlayFlags = [
        riskStudentIds?.has(studentId) ? 'risk' : null,
        unreadReportStudentIds?.has(studentId) ? 'report' : null,
        counselingTodayStudentIds?.has(studentId) ? 'counseling' : null,
        seat.status === 'absent' ? 'late_or_absent' : null,
        seat.status === 'away' || seat.status === 'break' ? 'away_long' : null,
        memberById.get(studentId)?.className ? `class:${memberById.get(studentId)?.className}` : null,
      ].filter(Boolean) as string[];

      return {
        studentId,
        seatId: seat.id,
        overlayFlags,
        todayMinutes,
        riskLevel: scoreToRiskLevel(riskScore),
        effectivePenaltyPoints: penaltyPoints,
        hasUnreadReport: unreadReportStudentIds?.has(studentId) ?? false,
        hasCounselingToday: counselingTodayStudentIds?.has(studentId) ?? false,
      };
    });
}

export function useTeacherClassroomSignals(centerId?: string | null, dateKey?: string | null) {
  const firestore = useFirestore();
  const signalsRef = useMemoFirebase(() => {
    if (!firestore || !centerId || !dateKey) return null;
    return doc(firestore, 'centers', centerId, 'classroomSignals', dateKey);
  }, [firestore, centerId, dateKey]);
  const result = useDoc<ClassroomSignalsDocument>(signalsRef, { enabled: Boolean(centerId && dateKey) });

  const signals = useMemo(() => normalizeSignals(result.data), [result.data]);

  const incidentsBySeatId = useMemo(() => {
    const bucket = new Map<string, ClassroomSignalIncident[]>();
    (signals?.incidents || []).forEach((incident) => {
      if (!incident.seatId) return;
      const current = bucket.get(incident.seatId) || [];
      current.push(incident);
      bucket.set(incident.seatId, sortIncidents(current));
    });
    return bucket;
  }, [signals]);

  const incidentsByStudentId = useMemo(() => {
    const bucket = new Map<string, ClassroomSignalIncident[]>();
    (signals?.incidents || []).forEach((incident) => {
      const current = bucket.get(incident.studentId) || [];
      current.push(incident);
      bucket.set(incident.studentId, sortIncidents(current));
    });
    return bucket;
  }, [signals]);

  const seatSignalBySeatId = useMemo(
    () => new Map((signals?.seatSignals || []).map((item) => [item.seatId, item])),
    [signals],
  );

  return {
    ...result,
    signals,
    incidentsBySeatId,
    incidentsByStudentId,
    seatSignalBySeatId,
    incidentFilters: buildIncidentFilters(signals),
  };
}
