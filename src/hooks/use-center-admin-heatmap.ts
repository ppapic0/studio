'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { collection, getDocs, limit, orderBy, query, Timestamp, where } from 'firebase/firestore';

import { useCollection, useFirestore } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import {
  averageHealth,
  calculateCenterFocusScore,
  clampHealth,
  createHeatmapMetric,
  createHeatmapRow,
  formatCurrency,
  formatMinutes,
  formatPercent,
  formatRatio,
  scoreAwayHealth,
  scoreBreakevenHealth,
  scoreGrowthHealth,
  scoreParentVisitHealth,
  type CenterAdminHeatmapRow,
} from '@/lib/center-admin-heatmap';
import { getInvoiceMonth } from '@/lib/invoice-analytics';
import type {
  AttendanceCurrent,
  CenterMembership,
  DailyReport,
  DailyStudentStat,
  GrowthProgress,
  Invoice,
  KpiDaily,
  ParentActivityEvent,
} from '@/lib/types';

type ParentCommunicationEntry = {
  id: string;
  studentId?: string;
  type?: string;
  createdAt?: Timestamp;
};

type UseCenterAdminHeatmapOptions = {
  centerId?: string;
  isActive: boolean;
  selectedClass?: string;
};

function toMillis(value: unknown) {
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof value === 'object' && typeof (value as any).toMillis === 'function') {
    return (value as any).toMillis();
  }
  if (value && typeof value === 'object' && typeof (value as any).toDate === 'function') {
    return (value as any).toDate().getTime();
  }
  return 0;
}

function riskScoreFromDaily(stat?: DailyStudentStat | null, progress?: GrowthProgress | null) {
  let riskScore = 0;
  if (stat) {
    if ((stat.studyTimeGrowthRate || 0) <= -0.2) riskScore += 30;
    else if ((stat.studyTimeGrowthRate || 0) <= -0.1) riskScore += 15;
    if ((stat.todayPlanCompletionRate || 0) < 50) riskScore += 20;
  }
  if ((progress?.penaltyPoints || 0) >= 10) riskScore += 40;
  return riskScore;
}

function sumInvoiceWindow(invoices: Invoice[]) {
  return invoices.reduce(
    (acc, invoice) => {
      const amount = Math.max(0, Number(invoice.finalPrice) || 0);
      const isCollected = invoice.status === 'paid';
      const isArrears = invoice.status === 'issued' || invoice.status === 'overdue';
      acc.billed += amount;
      if (isCollected) acc.collected += amount;
      if (isArrears) acc.arrears += amount;
      return acc;
    },
    { billed: 0, collected: 0, arrears: 0 }
  );
}

export function useCenterAdminHeatmap({
  centerId,
  isActive,
  selectedClass = 'all',
}: UseCenterAdminHeatmapOptions) {
  const firestore = useFirestore();
  const today = useMemo(() => new Date(), []);
  const todayKey = format(today, 'yyyy-MM-dd');
  const historyKeys = useMemo(
    () => Array.from({ length: 13 }, (_, index) => format(subDays(today, 12 - index), 'yyyy-MM-dd')),
    [today]
  );
  const displayKeys = useMemo(() => historyKeys.slice(-7), [historyKeys]);
  const historyStartKey = historyKeys[0];
  const currentMonth = format(today, 'yyyy-MM');
  const thirtyDaysAgoMs = useMemo(() => subDays(today, 30).getTime(), [today]);

  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isActive) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'),
      where('role', '==', 'student'),
      where('status', '==', 'active')
    );
  }, [firestore, centerId, isActive]);
  const { data: activeMembers, isLoading: membersLoading } = useCollection<CenterMembership>(membersQuery, { enabled: isActive });

  const progressQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isActive) return null;
    return collection(firestore, 'centers', centerId, 'growthProgress');
  }, [firestore, centerId, isActive]);
  const { data: progressList, isLoading: progressLoading } = useCollection<GrowthProgress>(progressQuery, { enabled: isActive });

  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isActive) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId, isActive]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery, { enabled: isActive });

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isActive) return null;
    return query(
      collection(firestore, 'centers', centerId, 'dailyReports'),
      where('dateKey', '>=', historyStartKey),
      where('dateKey', '<=', todayKey),
      orderBy('dateKey', 'asc')
    );
  }, [firestore, centerId, isActive, historyStartKey, todayKey]);
  const { data: dailyReports, isLoading: reportsLoading } = useCollection<DailyReport>(reportsQuery, { enabled: isActive });

  const parentEventsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isActive) return null;
    return collection(firestore, 'centers', centerId, 'parentActivityEvents');
  }, [firestore, centerId, isActive]);
  const { data: parentActivityEvents, isLoading: parentEventsLoading } = useCollection<ParentActivityEvent>(parentEventsQuery, { enabled: isActive });

  const parentCommunicationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isActive) return null;
    return collection(firestore, 'centers', centerId, 'parentCommunications');
  }, [firestore, centerId, isActive]);
  const { data: parentCommunications, isLoading: parentCommunicationsLoading } = useCollection<ParentCommunicationEntry>(parentCommunicationsQuery, { enabled: isActive });

  const kpiQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isActive) return null;
    return query(
      collection(firestore, 'centers', centerId, 'kpiDaily'),
      where('date', '>=', historyStartKey),
      where('date', '<=', todayKey),
      orderBy('date', 'asc')
    );
  }, [firestore, centerId, isActive, historyStartKey, todayKey]);
  const { data: kpiHistory, isLoading: kpiLoading } = useCollection<KpiDaily>(kpiQuery, { enabled: isActive });

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isActive) return null;
    return query(
      collection(firestore, 'centers', centerId, 'invoices'),
      orderBy('cycleEndDate', 'desc'),
      limit(1000)
    );
  }, [firestore, centerId, isActive]);
  const { data: invoices, isLoading: invoicesLoading } = useCollection<Invoice>(invoicesQuery, { enabled: isActive });

  const [statsByDate, setStatsByDate] = useState<Record<string, DailyStudentStat[]>>({});
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (!firestore || !centerId || !isActive) {
      setStatsByDate({});
      return;
    }

    let disposed = false;
    const loadStats = async () => {
      setStatsLoading(true);
      try {
        const entries = await Promise.all(
          historyKeys.map(async (dateKey) => {
            try {
              const snap = await getDocs(collection(firestore, 'centers', centerId, 'dailyStudentStats', dateKey, 'students'));
              return [dateKey, snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as DailyStudentStat))] as const;
            } catch {
              return [dateKey, []] as const;
            }
          })
        );

        if (!disposed) {
          const nextState: Record<string, DailyStudentStat[]> = {};
          entries.forEach(([dateKey, rows]) => {
            nextState[dateKey] = rows;
          });
          setStatsByDate(nextState);
        }
      } finally {
        if (!disposed) setStatsLoading(false);
      }
    };

    void loadStats();
    return () => {
      disposed = true;
    };
  }, [firestore, centerId, isActive, historyKeys]);

  const filteredMembers = useMemo(() => {
    return (activeMembers || []).filter((member) => selectedClass === 'all' || member.className === selectedClass);
  }, [activeMembers, selectedClass]);

  const targetMemberIds = useMemo(() => new Set(filteredMembers.map((member) => member.id)), [filteredMembers]);
  const progressById = useMemo(
    () =>
      new Map(
        ((progressList || []) as Array<GrowthProgress & { id: string }>).map((progress) => [progress.id, progress])
      ),
    [progressList]
  );

  const reportsByDate = useMemo(() => {
    const nextMap = new Map<string, DailyReport[]>();
    (dailyReports || []).forEach((report) => {
      if (!targetMemberIds.has(report.studentId)) return;
      const bucket = nextMap.get(report.dateKey) || [];
      bucket.push(report);
      nextMap.set(report.dateKey, bucket);
    });
    return nextMap;
  }, [dailyReports, targetMemberIds]);

  const kpiByDate = useMemo(() => new Map((kpiHistory || []).map((item) => [item.date, item])), [kpiHistory]);

  const currentMonthInvoices = useMemo(() => {
    return (invoices || []).filter((invoice) => getInvoiceMonth(invoice) === currentMonth);
  }, [invoices, currentMonth]);

  const summary = useMemo(() => {
    const totalStudents = filteredMembers.length;
    const todayStats = (statsByDate[todayKey] || []).filter((item) => targetMemberIds.has(item.studentId));
    const todayReports = (reportsByDate.get(todayKey) || []).filter((report) => report.status === 'sent');
    const checkedInCount = (attendanceList || []).filter(
      (seat) => seat.studentId && targetMemberIds.has(seat.studentId) && seat.status === 'studying'
    ).length;
    const awayDurations = (attendanceList || [])
      .filter(
        (seat) =>
          seat.studentId &&
          targetMemberIds.has(seat.studentId) &&
          (seat.status === 'away' || seat.status === 'break') &&
          seat.lastCheckInAt
      )
      .map((seat) => Math.max(0, Math.floor((Date.now() - seat.lastCheckInAt!.toMillis()) / 60000)));

    const focusScores = filteredMembers.map((member) => {
      const stat = todayStats.find((item) => item.studentId === member.id);
      const progress = progressById.get(member.id);
      return calculateCenterFocusScore(
        Math.round(stat?.totalStudyMinutes || 0),
        Math.round(stat?.todayPlanCompletionRate || 0),
        Number(stat?.studyTimeGrowthRate || 0),
        Number(progress?.stats?.focus || 0),
        Number(progress?.penaltyPoints || 0)
      );
    });

    const avgCompletion = todayStats.length > 0
      ? clampHealth(todayStats.reduce((sum, item) => sum + (item.todayPlanCompletionRate || 0), 0) / todayStats.length)
      : 0;
    const avgGrowthRate = todayStats.length > 0
      ? Number((todayStats.reduce((sum, item) => sum + Number(item.studyTimeGrowthRate || 0), 0) / todayStats.length).toFixed(2))
      : 0;
    const riskCount = filteredMembers.filter((member) => {
      const stat = todayStats.find((item) => item.studentId === member.id);
      const progress = progressById.get(member.id);
      return riskScoreFromDaily(stat, progress) >= 70;
    }).length;
    const highPenaltyCount = filteredMembers.filter((member) => (progressById.get(member.id)?.penaltyPoints || 0) >= 10).length;
    const readRate = todayReports.length > 0
      ? clampHealth((todayReports.filter((report) => report.viewedAt).length / todayReports.length) * 100)
      : 0;
    const commentWriteRate = todayReports.length > 0
      ? clampHealth((todayReports.filter((report) => (report.content || '').trim().length > 200).length / todayReports.length) * 100)
      : 0;
    const regularityRate = totalStudents > 0 ? clampHealth((todayReports.length / totalStudents) * 100) : 0;
    const seatOccupancy = totalStudents > 0 ? clampHealth((checkedInCount / totalStudents) * 100) : 0;
    const avgAwayMinutes = awayDurations.length > 0
      ? Math.round(awayDurations.reduce((sum, value) => sum + value, 0) / awayDurations.length)
      : 0;

    const recentParentEvents = (parentActivityEvents || []).filter((event) => {
      if (!targetMemberIds.has(event.studentId)) return false;
      return toMillis(event.createdAt) >= thirtyDaysAgoMs;
    });
    const recentParentCommunications = (parentCommunications || []).filter((item) => {
      if (!item.studentId || !targetMemberIds.has(item.studentId)) return false;
      return toMillis(item.createdAt) >= thirtyDaysAgoMs;
    });

    const appVisits30d = recentParentEvents.filter((event) => event.eventType === 'app_visit').length;
    const activeParents30d = new Set(
      recentParentEvents
        .filter((event) => event.eventType === 'app_visit')
        .map((event) => event.parentUid)
        .filter((parentUid) => typeof parentUid === 'string' && parentUid.length > 0)
    ).size;
    const consultationEvents30d = recentParentEvents.filter((event) => event.eventType === 'consultation_request').length;
    const consultationDocs30d = recentParentCommunications.filter((item) => item.type === 'consultation').length;
    const consultationRequestCount30d = Math.max(consultationEvents30d, consultationDocs30d);
    const avgVisitsPerStudent30d = totalStudents > 0 ? Number((appVisits30d / totalStudents).toFixed(1)) : 0;
    const consultationStability = activeParents30d > 0
      ? clampHealth(100 - (consultationRequestCount30d / activeParents30d) * 100)
      : 85;

    const latestKpi = (kpiHistory || [])[Math.max(0, (kpiHistory || []).length - 1)];
    const billingSummary = sumInvoiceWindow(currentMonthInvoices);
    const collectionRate = billingSummary.billed > 0
      ? clampHealth((billingSummary.collected / billingSummary.billed) * 100)
      : 0;
    const receivableHealth = billingSummary.billed > 0
      ? clampHealth(100 - (billingSummary.arrears / billingSummary.billed) * 100)
      : 100;
    const activeStudentCount = latestKpi?.activeStudentCount || totalStudents;
    const breakevenStudents = latestKpi?.breakevenStudents ?? null;

    return {
      totalStudents,
      focusScore: averageHealth(focusScores),
      avgCompletion,
      seatOccupancy,
      avgVisitsPerStudent30d,
      readRate,
      consultationStability,
      riskCount,
      highPenaltyCount,
      avgGrowthRate,
      collectionRate,
      receivableHealth,
      activeStudentCount,
      breakevenStudents,
      regularityRate,
      commentWriteRate,
      avgAwayMinutes,
      billingSummary,
    };
  }, [
    attendanceList,
    currentMonthInvoices,
    filteredMembers,
    kpiHistory,
    parentActivityEvents,
    parentCommunications,
    progressById,
    reportsByDate,
    statsByDate,
    targetMemberIds,
    thirtyDaysAgoMs,
    todayKey,
  ]);

  const trendByArea = useMemo(() => {
    const totalStudents = summary.totalStudents;
    const result: Record<string, { label: string; score: number }[]> = {
      operational: [],
      parent: [],
      risk: [],
      billing: [],
      efficiency: [],
    };

    displayKeys.forEach((dateKey) => {
      const endIndex = historyKeys.indexOf(dateKey);
      const windowKeys = endIndex >= 6 ? historyKeys.slice(endIndex - 6, endIndex + 1) : historyKeys.slice(0, endIndex + 1);
      const windowStats = windowKeys.flatMap((key) => (statsByDate[key] || []).filter((row) => targetMemberIds.has(row.studentId)));
      const windowReports = windowKeys.flatMap((key) => (reportsByDate.get(key) || []).filter((row) => row.status === 'sent'));
      const windowKpis = windowKeys.map((key) => kpiByDate.get(key)).filter(Boolean) as KpiDaily[];
      const isTodayPoint = dateKey === todayKey;

      const focusScores = filteredMembers.map((member) => {
        const matchingStats = windowStats.filter((row) => row.studentId === member.id);
        if (matchingStats.length === 0) {
          const progress = progressById.get(member.id);
          return calculateCenterFocusScore(0, 0, 0, Number(progress?.stats?.focus || 0), Number(progress?.penaltyPoints || 0));
        }

        const avgMinutes = matchingStats.reduce((sum, row) => sum + (row.totalStudyMinutes || 0), 0) / matchingStats.length;
        const avgCompletion = matchingStats.reduce((sum, row) => sum + (row.todayPlanCompletionRate || 0), 0) / matchingStats.length;
        const avgGrowth = matchingStats.reduce((sum, row) => sum + Number(row.studyTimeGrowthRate || 0), 0) / matchingStats.length;
        const progress = progressById.get(member.id);
        return calculateCenterFocusScore(
          Math.round(avgMinutes),
          Math.round(avgCompletion),
          Number(avgGrowth.toFixed(2)),
          Number(progress?.stats?.focus || 0),
          Number(progress?.penaltyPoints || 0)
        );
      });

      const completionScore = windowStats.length > 0
        ? clampHealth(windowStats.reduce((sum, row) => sum + (row.todayPlanCompletionRate || 0), 0) / windowStats.length)
        : 0;
      const occupancySamples = windowKeys.map((key) => {
        if (key === todayKey) return summary.seatOccupancy;
        const dayRows = (statsByDate[key] || []).filter((row) => targetMemberIds.has(row.studentId));
        const activeCount = new Set(dayRows.filter((row) => (row.totalStudyMinutes || 0) > 0).map((row) => row.studentId)).size;
        return totalStudents > 0 ? clampHealth((activeCount / totalStudents) * 100) : 0;
      });
      const operationalScore = averageHealth([
        averageHealth(focusScores),
        completionScore,
        averageHealth(occupancySamples),
      ]);

      const windowEvents = (parentActivityEvents || []).filter((event) => {
        if (!targetMemberIds.has(event.studentId)) return false;
        const eventKey = format(new Date(toMillis(event.createdAt) || 0), 'yyyy-MM-dd');
        return windowKeys.includes(eventKey);
      });
      const windowCommunications = (parentCommunications || []).filter((item) => {
        if (!item.studentId || !targetMemberIds.has(item.studentId)) return false;
        const itemKey = format(new Date(toMillis(item.createdAt) || 0), 'yyyy-MM-dd');
        return windowKeys.includes(itemKey);
      });
      const windowVisits = windowEvents.filter((event) => event.eventType === 'app_visit').length;
      const windowActiveParents = new Set(
        windowEvents
          .filter((event) => event.eventType === 'app_visit')
          .map((event) => event.parentUid)
          .filter((parentUid) => typeof parentUid === 'string' && parentUid.length > 0)
      ).size;
      const visitScore = totalStudents > 0
        ? scoreParentVisitHealth((windowVisits / totalStudents) * (30 / windowKeys.length))
        : 0;
      const reportReadScore = windowReports.length > 0
        ? clampHealth((windowReports.filter((report) => report.viewedAt).length / windowReports.length) * 100)
        : 0;
      const windowConsultationCount = Math.max(
        windowEvents.filter((event) => event.eventType === 'consultation_request').length,
        windowCommunications.filter((item) => item.type === 'consultation').length
      );
      const consultationScore = windowActiveParents > 0
        ? clampHealth(100 - (windowConsultationCount / windowActiveParents) * 100)
        : 85;
      const parentScore = averageHealth([visitScore, reportReadScore, consultationScore]);

      const riskDailyScores = windowKeys.map((key) => {
        const dayRows = (statsByDate[key] || []).filter((row) => targetMemberIds.has(row.studentId));
        const riskCount = filteredMembers.filter((member) => {
          const stat = dayRows.find((row) => row.studentId === member.id);
          const progress = progressById.get(member.id);
          return riskScoreFromDaily(stat, progress) >= 70;
        }).length;
        return totalStudents > 0 ? clampHealth(100 - (riskCount / totalStudents) * 100) : 100;
      });
      const penaltyScore = totalStudents > 0
        ? clampHealth(100 - (summary.highPenaltyCount / totalStudents) * 100)
        : 100;
      const growthScore = windowStats.length > 0
        ? averageHealth(windowStats.map((row) => scoreGrowthHealth(Number(row.studyTimeGrowthRate || 0))))
        : 0;
      const riskScore = averageHealth([averageHealth(riskDailyScores), penaltyScore, growthScore]);

      const collectedWindow = windowKpis.reduce((sum, row) => sum + (row.collectedRevenue || 0), 0);
      const revenueWindow = windowKpis.reduce((sum, row) => sum + (row.totalRevenue || 0), 0);
      const collectionScore = revenueWindow > 0 ? clampHealth((collectedWindow / revenueWindow) * 100) : 0;
      const receivableScore = revenueWindow > 0 ? clampHealth(100 - ((revenueWindow - collectedWindow) / revenueWindow) * 100) : 100;
      const latestWindowKpi = windowKpis[Math.max(0, windowKpis.length - 1)];
      const breakevenScore = scoreBreakevenHealth(
        latestWindowKpi?.activeStudentCount || summary.activeStudentCount,
        latestWindowKpi?.breakevenStudents ?? summary.breakevenStudents
      );
      const billingScore = averageHealth([collectionScore, receivableScore, breakevenScore]);

      const regularityScore = totalStudents > 0 ? clampHealth((windowReports.length / (totalStudents * windowKeys.length)) * 100 * 2) : 0;
      const commentScore = windowReports.length > 0
        ? clampHealth((windowReports.filter((report) => (report.content || '').trim().length > 200).length / windowReports.length) * 100)
        : 0;
      const awayScore = isTodayPoint ? scoreAwayHealth(summary.avgAwayMinutes) : 75;
      const efficiencyScore = averageHealth([regularityScore, commentScore, awayScore]);

      result.operational.push({ label: format(new Date(`${dateKey}T00:00:00`), 'M/d'), score: operationalScore });
      result.parent.push({ label: format(new Date(`${dateKey}T00:00:00`), 'M/d'), score: parentScore });
      result.risk.push({ label: format(new Date(`${dateKey}T00:00:00`), 'M/d'), score: riskScore });
      result.billing.push({ label: format(new Date(`${dateKey}T00:00:00`), 'M/d'), score: billingScore });
      result.efficiency.push({ label: format(new Date(`${dateKey}T00:00:00`), 'M/d'), score: efficiencyScore });
    });

    return result;
  }, [
    displayKeys,
    filteredMembers,
    historyKeys,
    kpiByDate,
    parentActivityEvents,
    parentCommunications,
    progressById,
    reportsByDate,
    statsByDate,
    summary.activeStudentCount,
    summary.avgAwayMinutes,
    summary.breakevenStudents,
    summary.highPenaltyCount,
    summary.seatOccupancy,
    summary.totalStudents,
    targetMemberIds,
    todayKey,
  ]);

  const rows = useMemo<CenterAdminHeatmapRow[]>(() => {
    const totalStudents = summary.totalStudents;
    const highRiskStability = totalStudents > 0 ? clampHealth(100 - (summary.riskCount / totalStudents) * 100) : 100;
    const penaltyStability = totalStudents > 0 ? clampHealth(100 - (summary.highPenaltyCount / totalStudents) * 100) : 100;
    const growthHealth = scoreGrowthHealth(summary.avgGrowthRate);
    const visitHealth = scoreParentVisitHealth(summary.avgVisitsPerStudent30d);
    const awayHealth = scoreAwayHealth(summary.avgAwayMinutes);
    const breakevenHealth = scoreBreakevenHealth(summary.activeStudentCount, summary.breakevenStudents);

    return [
      createHeatmapRow({
        id: 'operational',
        label: '운영 KPI',
        description: '센터 몰입도와 실시간 교실 활성도를 함께 보는 핵심 온도계입니다.',
        metrics: [
          createHeatmapMetric({
            id: 'focus-score',
            label: '집중도 점수',
            value: `${summary.focusScore}점`,
            score: summary.focusScore,
            hint: '오늘 기준 센터 평균 집중 품질입니다.',
          }),
          createHeatmapMetric({
            id: 'completion-rate',
            label: '계획 완료율',
            value: formatPercent(summary.avgCompletion),
            score: summary.avgCompletion,
            hint: '학생별 오늘 계획 실행률 평균입니다.',
          }),
          createHeatmapMetric({
            id: 'seat-occupancy',
            label: '실시간 착석률',
            value: formatPercent(summary.seatOccupancy),
            score: summary.seatOccupancy,
            hint: '실시간 입실 좌석 비중입니다.',
          }),
        ],
        trend: trendByArea.operational,
      }),
      createHeatmapRow({
        id: 'parent',
        label: '학부모 KPI',
        description: '방문 빈도, 리포트 반응, 상담 안정도를 같은 체계로 묶었습니다.',
        metrics: [
          createHeatmapMetric({
            id: 'parent-visits',
            label: '30일 방문 활성도',
            value: `${summary.avgVisitsPerStudent30d}회/인`,
            score: visitHealth,
            hint: '학생 1인당 최근 30일 평균 방문 횟수입니다.',
          }),
          createHeatmapMetric({
            id: 'report-read-rate',
            label: '리포트 열람률',
            value: formatPercent(summary.readRate),
            score: summary.readRate,
            hint: '오늘 발송된 리포트의 열람 반응입니다.',
          }),
          createHeatmapMetric({
            id: 'consultation-stability',
            label: '상담 안정도',
            value: `${summary.consultationStability}점`,
            score: summary.consultationStability,
            hint: '상담 요청 빈도를 안정 점수로 바꾼 값입니다.',
          }),
        ],
        trend: trendByArea.parent,
      }),
      createHeatmapRow({
        id: 'risk',
        label: '위험 인텔리전스',
        description: '고위험 학생, 벌점 누적, 성장률 둔화를 한 번에 확인합니다.',
        metrics: [
          createHeatmapMetric({
            id: 'high-risk-stability',
            label: '고위험 안정도',
            value: `${summary.riskCount}명 위험`,
            score: highRiskStability,
            hint: '즉시 개입 학생 비중을 안정도로 역변환했습니다.',
          }),
          createHeatmapMetric({
            id: 'penalty-stability',
            label: '벌점 누적 안정도',
            value: `${summary.highPenaltyCount}명 주의`,
            score: penaltyStability,
            hint: '벌점 10점 이상 학생 비중입니다.',
          }),
          createHeatmapMetric({
            id: 'growth-health',
            label: '성장 흐름 안정도',
            value: `${Math.round(summary.avgGrowthRate * 100)}%`,
            score: growthHealth,
            hint: '학습 성장률을 건강도 점수로 환산했습니다.',
          }),
        ],
        trend: trendByArea.risk,
      }),
      createHeatmapRow({
        id: 'billing',
        label: '수납',
        description: '현재 월 수납률, 미수금 건전도, 손익분기 커버리지를 묶은 운영 수치입니다.',
        href: '/dashboard/revenue',
        metrics: [
          createHeatmapMetric({
            id: 'collection-rate',
            label: '당월 수납률',
            value: formatPercent(summary.collectionRate),
            score: summary.collectionRate,
            hint: '이번 달 인보이스 기준 수납 달성률입니다.',
            href: '/dashboard/revenue',
          }),
          createHeatmapMetric({
            id: 'arrears-health',
            label: '미수금 건전도',
            value: formatCurrency(summary.billingSummary.arrears),
            score: summary.receivableHealth,
            hint: '미수금 규모를 건강도 점수로 역변환했습니다.',
            href: '/dashboard/revenue',
          }),
          createHeatmapMetric({
            id: 'breakeven-coverage',
            label: '손익분기 커버리지',
            value: formatRatio(summary.activeStudentCount, summary.breakevenStudents),
            score: breakevenHealth,
            hint: '현재 활성 인원이 손익분기를 얼마나 덮는지 보여줍니다.',
            href: '/dashboard/revenue',
          }),
        ],
        trend: trendByArea.billing,
      }),
      createHeatmapRow({
        id: 'efficiency',
        label: '운영 효율',
        description: '리포트 발송, 코멘트 밀도, 외출시간 안정도를 운영 효율 관점으로 묶었습니다.',
        metrics: [
          createHeatmapMetric({
            id: 'report-regularity',
            label: '리포트 발송률',
            value: formatPercent(summary.regularityRate),
            score: summary.regularityRate,
            hint: '오늘 발송이 필요한 학생 대비 발송 비율입니다.',
          }),
          createHeatmapMetric({
            id: 'comment-density',
            label: '코멘트 밀도',
            value: formatPercent(summary.commentWriteRate),
            score: summary.commentWriteRate,
            hint: '충분히 구체적인 리포트 비중입니다.',
          }),
          createHeatmapMetric({
            id: 'away-stability',
            label: '외출시간 안정도',
            value: formatMinutes(summary.avgAwayMinutes),
            score: awayHealth,
            hint: '외출/휴식 시간을 안정도 점수로 환산했습니다.',
          }),
        ],
        trend: trendByArea.efficiency,
      }),
    ];
  }, [summary, trendByArea]);

  const isLoading =
    membersLoading ||
    progressLoading ||
    attendanceLoading ||
    reportsLoading ||
    parentEventsLoading ||
    parentCommunicationsLoading ||
    kpiLoading ||
    invoicesLoading ||
    statsLoading;

  return {
    rows,
    isLoading,
  };
}
