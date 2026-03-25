
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/contexts/app-context';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { AttendanceCurrent, 센터Membership, GrowthProgress, LeaderboardEntry, StudyLogDay, DailyReport } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  Loader2, 
  Zap, 
  Target, 
  RefreshCw, 
  CheckCircle2, 
  ShieldCheck, 
  Trophy, 
  Crown,
  TrendingUp,
  Sparkles,
  ArrowUpCircle,
  Flame,
  Info,
  ChevronRight,
  BookOpen,
  Check,
  Star,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { format, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getTierTheme } from '@/lib/tier-theme';
import Link from 'next/link';

const STAT_CONFIG = {
  focus: { 
    label: '집중력', 
    sub: '집중', 
    icon: Target, 
    color: 'text-blue-500', 
    bg: 'bg-blue-500', 
    accent: 'bg-blue-50',
    guide: '몰입 시간에 비례하여 상승 (1h당 +0.1)'
  },
  consistency: { 
    label: '꾸준함', 
    sub: '꾸준', 
    icon: RefreshCw, 
    color: 'text-emerald-500', 
    bg: 'bg-emerald-500', 
    accent: 'bg-emerald-50',
    guide: '매일 트랙 시작 시 상승 (일일 +0.5)'
  },
  achievement: { 
    label: '목표달성', 
    sub: '달성', 
    icon: CheckCircle2, 
    color: 'text-amber-500', 
    bg: 'bg-amber-500', 
    accent: 'bg-amber-50',
    guide: '할 일 완료 시 상승 (항목당 +0.1)'
  },
  resilience: { 
    label: '회복력', 
    sub: '회복', 
    icon: ShieldCheck, 
    color: 'text-rose-500', 
    bg: 'bg-rose-500', 
    accent: 'bg-rose-50',
    guide: '6시간 이상 달성 시 상승 (일일 +0.5)'
  },
};

type StatKey = keyof typeof STAT_CONFIG;
type SkillTrackHistoryItem = {
  dateKey: string;
  reason: string;
  detail: string;
  gained: number;
};

const SKILL_LABEL: Record<StatKey, string> = {
  focus: '집중력',
  consistency: '꾸준함',
  achievement: '목표달성',
  resilience: '회복력',
};


const TIER_MILESTONES = [
  { name: '브론즈', lp: 0 },
  { name: '실버', lp: 5000 },
  { name: '골드', lp: 10000 },
  { name: '플래티넘', lp: 15000 },
  { name: '다이아', lp: 20000 },
  { name: '마스터', lp: 26000 },
  { name: '그마', lp: 30000 },
  { name: '챌린저', lp: 35000 },
] as const;

function summarizeReportLine(content?: string | null) {
  if (!content) return '';
  return content
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 88);
}

function getNextTierInfo(currentLp: number) {
  const nextTier = TIER_MILESTONES.find((tier) => currentLp < tier.lp);
  if (!nextTier) {
    return { name: '챌린저 유지', remainingLp: 0 };
  }
  return {
    name: nextTier.name,
    remainingLp: Math.max(0, nextTier.lp - currentLp),
  };
}

function formatMinutesCompact(minutes: number) {
  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
  }
  return `${minutes}분`;
}

function isActiveStudentStatus(status: unknown): boolean {
  if (typeof status !== 'string') return true;
  const normalized = status.trim().toLowerCase();
  if (!normalized) return true;
  return normalized === 'active';
}

function isSyntheticStudentId(studentId: unknown): boolean {
  if (typeof studentId !== 'string') return true;
  const normalized = studentId.trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.startsWith('test-') ||
    normalized.startsWith('seed-') ||
    normalized.startsWith('mock-') ||
    normalized.includes('dummy')
  );
}

function SystemGuideDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full mt-2 rounded-xl text-[10px] font-black border-dashed border-2 h-10 hover:bg-primary/5 transition-all">
          <Info className="mr-1.5 h-3.5 w-3.5" /> 시즌 티어 및 리셋 가이드
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden w-[min(94vw,31rem)] max-h-[86svh]">
        <div className="bg-primary p-8 text-primary-foreground relative">
          <Sparkles className="pointer-events-none absolute top-4 right-4 h-10 w-10 opacity-20" />
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tighter">성장트랙 가이드</DialogTitle>
            <DialogDescription className="text-primary-foreground/70 font-bold mt-1 text-xs">
              활동량(포인트)으로 증명하는 시즌제 등급 시스템입니다.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-8 space-y-6 max-h-[50vh] overflow-y-auto custom-scrollbar bg-white">
          <div className="space-y-3">
            <h4 className="font-black text-primary flex items-center gap-2 text-sm">
              <Zap className="h-3.5 w-3.5 fill-current text-accent" /> 1. 행동 보상 포인트 (일일 보너스)
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {[
                { l: '출석 보너스', v: 100, d: '당일 3시간 이상 학습 시' },
                { l: '계획 보너스', v: 100, d: '3개 이상 계획 모두 완료' },
                { l: '루틴 보너스', v: 100, d: '등록된 루틴 모두 준수 시' }
              ].map(item => (
                <div key={item.l} className="p-3 rounded-xl bg-muted/30 border flex justify-between items-center">
                  <div className="grid">
                    <span className="text-[11px] font-black">{item.l}</span>
                    <span className="text-[9px] font-bold text-muted-foreground">{item.d}</span>
                  </div>
                  <span className="text-sm font-black text-primary">+{item.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-black text-primary flex items-center gap-2 text-sm">
              <Trophy className="h-3.5 w-3.5 text-emerald-500" /> 2. 티어 판정 (포인트 + 랭킹)
            </h4>
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
              <p className="text-[11px] font-bold text-emerald-900/70 leading-relaxed">
                - **브론즈 ~ 다이아몬드**: 0 ~ 25,000포인트 구간<br/>
                - **챌린저**: 25,000포인트 이상 중 **센터 1위**<br/>
                - **그랜드마스터**: 25,000포인트 이상 중 **2, 3위**
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function GrowthPage() {
  const { user } = useUser();
  const { activeMembership, viewMode, currentTier } = useAppContext();
  const firestore = useFirestore();
  const isMobile = viewMode === 'mobile';
  const periodKey = format(new Date(), 'yyyy-MM');

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
  }, [firestore, activeMembership?.id, user?.uid]);

  const { data: progress, isLoading } = useDoc<GrowthProgress>(progressRef);

  const seasonStudyLogsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days'),
      orderBy('dateKey', 'desc'),
      limit(62)
    );
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: seasonStudyLogs } = useCollection<StudyLogDay>(seasonStudyLogsQuery);

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'dailyReports'),
      where('studentId', '==', user.uid),
      where('status', '==', 'sent')
    );
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: teacherReportsRaw } = useCollection<DailyReport>(reportsQuery);

  const rankQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_lp`, 'entries'),
      where('studentId', '==', user.uid)
    );
  }, [firestore, activeMembership, user, periodKey]);
  const { data: rankEntries } = useCollection<LeaderboardEntry>(rankQuery);

  // 재원생 기준 랭킹 집계(퇴원/가상 계정 제외)
  const totalEntriesQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_lp`, 'entries');
  }, [firestore, activeMembership, periodKey]);
  const { data: totalRankEntries } = useCollection<LeaderboardEntry>(totalEntriesQuery);

  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'members'),
      where('role', '==', 'student'),
      where('status', '==', 'active')
    );
  }, [firestore, activeMembership]);
  const { data: activeStudentMembers, isLoading: activeMembersLoading } = useCollection<센터Membership>(membersQuery);

  const activeStudentIds = useMemo(() => {
    if (!activeStudentMembers) return null;
    return new Set(
      activeStudentMembers
        .filter((member) => isActiveStudentStatus(member.status))
        .map((member) => member.id)
    );
  }, [activeStudentMembers]);

  const attendanceCurrentQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return collection(firestore, 'centers', activeMembership.id, 'attendanceCurrent');
  }, [firestore, activeMembership]);
  const { data: attendanceCurrent, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceCurrentQuery);

  const assignedStudentIds = useMemo(() => {
    if (!attendanceCurrent) return null;
    return new Set(
      attendanceCurrent
        .map((seat) => (typeof seat.studentId === 'string' ? seat.studentId.trim() : ''))
        .filter((studentId) => studentId.length > 0 && !isSyntheticStudentId(studentId))
    );
  }, [attendanceCurrent]);

  const validRankEntries = useMemo(() => {
    if (!totalRankEntries) return [];
    let filtered = totalRankEntries.filter((entry) => !isSyntheticStudentId(entry.studentId));

    if (assignedStudentIds) {
      filtered = filtered.filter((entry) => assignedStudentIds.has(entry.studentId));
    }
    if (activeStudentIds) {
      filtered = filtered.filter((entry) => activeStudentIds.has(entry.studentId));
    }

    return filtered;
  }, [totalRankEntries, assignedStudentIds, activeStudentIds]);

  const totalCount = validRankEntries.length;
  const isRankContextLoading = activeMembersLoading || attendanceLoading;

  const currentRank = useMemo(() => {
    const snapshotEntry = rankEntries?.[0];
    const snapshotRank = snapshotEntry?.rank || 0;
    if (!user || validRankEntries.length === 0) return snapshotRank;

    const sorted = [...validRankEntries].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    const ownIndex = sorted.findIndex((entry) => entry.studentId === user.uid);
    if (ownIndex >= 0) return ownIndex + 1;

    const snapshotValue = Number(snapshotEntry?.value);
    if (!Number.isFinite(snapshotValue)) return snapshotRank;

    const higherCount = sorted.filter((entry) => (Number(entry.value) || 0) > snapshotValue).length;
    return Math.min(sorted.length, higherCount + 1);
  }, [rankEntries, validRankEntries, user?.uid]);

  const rankDisplay = useMemo(() => {
    if (isRankContextLoading) return '계산 중';
    if (currentRank === 0 || currentRank >= 999) return '집계 대기';
    if (currentRank <= 3) return `#${currentRank}`;

    if (totalCount <= 0) return `#${currentRank}`;
    if (totalCount < 10) return `#${currentRank} / ${totalCount}`;

    const safeRank = Math.min(currentRank, totalCount);
    const percent = Math.max(1, Math.ceil((safeRank / totalCount) * 100));
    return `상위 ${percent}%`;

  }, [isRankContextLoading, currentRank, totalCount]);

  const stats = useMemo(() => {
    const raw = progress?.stats || { focus: 0, consistency: 0, achievement: 0, resilience: 0 };
    return {
      focus: Math.min(100, raw.focus),
      consistency: Math.min(100, raw.consistency),
      achievement: Math.min(100, raw.achievement),
      resilience: Math.min(100, raw.resilience),
    };
  }, [progress?.stats]);

  const skillTrackHistory = useMemo<Record<StatKey, SkillTrackHistoryItem[]>>(() => {
    const result: Record<StatKey, SkillTrackHistoryItem[]> = {
      focus: [],
      consistency: [],
      achievement: [],
      resilience: [],
    };

    const isCurrentSeason = (dateKey: string) => dateKey.startsWith(periodKey);

    Object.entries(progress?.dailyLpStatus || {}).forEach(([dateKey, rawStatus]) => {
      if (!isCurrentSeason(dateKey)) return;
      const dayStatus = (rawStatus || {}) as Record<string, any>;

      if (dayStatus.checkedIn) {
        result.consistency.push({
          dateKey,
          reason: '입실 체크인',
          detail: '하루 첫 입실 시 +0.5',
          gained: 0.5,
        });
      }

      const achievementCount = Number(dayStatus.achievementCount || 0);
      if (achievementCount > 0) {
        result.achievement.push({
          dateKey,
          reason: '학습 할 일 완료',
          detail: `완료 ${achievementCount}회`,
          gained: Number((achievementCount * 0.1).toFixed(1)),
        });
      }

      if (dayStatus.bonus6h) {
        result.resilience.push({
          dateKey,
          reason: '6시간 학습 달성',
          detail: '장시간 집중 학습 보너스',
          gained: 0.5,
        });
      }
    });

    (seasonStudyLogs || []).forEach((log) => {
      if (!log?.dateKey || !isCurrentSeason(log.dateKey)) return;
      const totalMinutes = Math.max(0, Number(log.totalMinutes || 0));
      if (totalMinutes <= 0) return;
      result.focus.push({
        dateKey: log.dateKey,
        reason: '학습 시간 누적',
        detail: `실공부 ${totalMinutes}분`,
        gained: Number(((totalMinutes / 60) * 0.1).toFixed(2)),
      });
    });

    (Object.keys(result) as StatKey[]).forEach((key) => {
      result[key].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    });

    return result;
  }, [progress?.dailyLpStatus, seasonStudyLogs, periodKey]);

  const avgStat = useMemo(() => {
    const values = Object.values(stats);
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [stats]);

  const currentLp = progress?.seasonLp || 0;
  const totalBoost = 1 + (stats.focus/100 * 0.05) + (stats.consistency/100 * 0.05) + (stats.achievement/100 * 0.05) + (stats.resilience/100 * 0.05);
  const tierTheme = getTierTheme(currentTier);
  const seasonPercentile = useMemo(() => {
    if (isRankContextLoading || currentRank <= 0 || totalCount <= 0) return null;
    return Math.max(1, Math.ceil((currentRank / totalCount) * 100));
  }, [currentRank, totalCount, isRankContextLoading]);
  const nextTierInfo = useMemo(() => getNextTierInfo(currentLp), [currentLp]);
  const weeklyStudyMinutes = useMemo(() => {
    const recentKeys = Array.from({ length: 7 }, (_, index) => format(subDays(new Date(), 6 - index), 'yyyy-MM-dd'));
    const keySet = new Set(recentKeys);
    return (seasonStudyLogs || [])
      .filter((log) => keySet.has(log.dateKey))
      .reduce((sum, log) => sum + Math.max(0, Number(log.totalMinutes || 0)), 0);
  }, [seasonStudyLogs]);
  const previousWeekStudyMinutes = useMemo(() => {
    const recentKeys = Array.from({ length: 7 }, (_, index) => format(subDays(new Date(), 13 - index), 'yyyy-MM-dd'));
    const keySet = new Set(recentKeys);
    return (seasonStudyLogs || [])
      .filter((log) => keySet.has(log.dateKey))
      .reduce((sum, log) => sum + Math.max(0, Number(log.totalMinutes || 0)), 0);
  }, [seasonStudyLogs]);
  const weeklyDelta = weeklyStudyMinutes - previousWeekStudyMinutes;
  const bestSeasonMinutes = useMemo(
    () => (seasonStudyLogs || []).reduce((max, log) => Math.max(max, Math.max(0, Number(log.totalMinutes || 0))), 0),
    [seasonStudyLogs]
  );
  const latestSkillMoment = useMemo(() => {
    return (Object.entries(skillTrackHistory) as [StatKey, SkillTrackHistoryItem[]][])
      .flatMap(([key, items]) => items.slice(0, 2).map((item) => ({ ...item, statKey: key })))
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey))[0] || null;
  }, [skillTrackHistory]);
  const weakestStatKey = useMemo(() => {
    return (Object.entries(stats) as [StatKey, number][])
      .sort((a, b) => a[1] - b[1])[0]?.[0] || 'focus';
  }, [stats]);
  const nextActionCopy: Record<StatKey, string> = {
    focus: '60분 이상 한 번에 몰입하는 시간을 한 번 더 만들면 집중력이 가장 빠르게 올라가요.',
    consistency: '짧아도 좋으니 매일 첫 공부 시작 체크를 이어가면 꾸준함이 안정적으로 올라가요.',
    achievement: '오늘 계획에서 학습 미션 3개를 끝내면 목표달성이 바로 반응하기 시작해요.',
    resilience: '6시간 이상 공부한 날을 한 번 더 만들면 회복탄력이 크게 쌓여요.',
  };
  const teacherReports = useMemo(
    () => [...(teacherReportsRaw || [])].sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    [teacherReportsRaw]
  );
  const latestCoachReport = teacherReports[0] || null;
  const reportCoachLine = latestCoachReport?.aiMeta?.teacherOneLiner?.trim()
    || latestCoachReport?.nextAction?.trim()
    || summarizeReportLine(latestCoachReport?.content);
  const growthCoachInsight = useMemo(() => {
    if (reportCoachLine) {
      return {
        label: '리포트 기반 한마디',
        title: reportCoachLine,
        detail: latestCoachReport?.aiMeta?.metrics?.trendSummary?.trim()
          || '최근 코칭 리포트에서 지금 흐름에 맞는 핵심 한 줄을 골라 보여드리고 있어요.',
        chip: latestCoachReport?.dateKey ? `${latestCoachReport.dateKey} 리포트` : '최근 코칭',
        aside: latestCoachReport?.nextAction?.trim() || `${STAT_CONFIG[weakestStatKey].label}을 먼저 챙기면 다음 상승 폭이 더 커져요.`,
      };
    }

    if (weeklyDelta > 0) {
      return {
        label: 'AI 성장 한마디',
        title: `지난주보다 ${formatMinutesCompact(Math.abs(weeklyDelta))} 더 몰입했어요.`,
        detail: `${latestSkillMoment ? `${latestSkillMoment.reason} 흐름이 살아 있고, ` : ''}${STAT_CONFIG[weakestStatKey].label}만 더 챙기면 다음 구간 진입이 더 빨라져요.`,
        chip: seasonPercentile ? `센터 상위 ${seasonPercentile}%` : '페이스 상승 중',
        aside: nextTierInfo.remainingLp > 0 ? `${nextTierInfo.name}까지 ${nextTierInfo.remainingLp.toLocaleString()}점` : '현재 티어 유지 구간',
      };
    }

    if (weeklyStudyMinutes >= 360) {
      return {
        label: 'AI 성장 한마디',
        title: '이번 주 페이스는 안정적으로 유지되고 있어요.',
        detail: `${STAT_CONFIG[weakestStatKey].label}에 한 번만 더 힘을 주면 성장 카드가 더 선명해져요.`,
        chip: `이번 주 ${formatMinutesCompact(weeklyStudyMinutes)}`,
        aside: latestSkillMoment?.reason || '한 번의 깊은 세션이 다음 포인트를 만듭니다.',
      };
    }

    return {
      label: 'AI 성장 한마디',
      title: '오늘 한 번의 깊은 세션이 흐름을 바꿔요.',
      detail: `${STAT_CONFIG[weakestStatKey].label}부터 먼저 챙기면 이번 주 성장 그래프가 다시 살아납니다.`,
      chip: nextTierInfo.remainingLp > 0 ? `${nextTierInfo.name}까지 ${nextTierInfo.remainingLp.toLocaleString()}점` : '시즌 데이터 축적 중',
      aside: '가장 먼저 60분 한 번을 만들어 보세요.',
    };
  }, [
    reportCoachLine,
    latestCoachReport?.aiMeta?.metrics?.trendSummary,
    latestCoachReport?.dateKey,
    latestCoachReport?.nextAction,
    weakestStatKey,
    weeklyDelta,
    latestSkillMoment,
    seasonPercentile,
    nextTierInfo.name,
    nextTierInfo.remainingLp,
    weeklyStudyMinutes,
  ]);
  const growthInsightCards = useMemo(() => {
    return [
      {
        kicker: '이번 주 오른 이유',
        title: latestSkillMoment ? latestSkillMoment.reason : '이번 주 성장 로그를 쌓는 중이에요.',
        body: latestSkillMoment ? latestSkillMoment.detail : '공부 시간이 쌓이거나 계획을 완료하면 가장 먼저 잡힌 상승 이유가 이곳에 보입니다.',
        footer: latestSkillMoment
          ? `${SKILL_LABEL[latestSkillMoment.statKey]} 트랙 반응`
          : '최근 상승 요인 집계 중',
        icon: TrendingUp,
        pillClass: 'bg-sky-50/90 text-sky-700 ring-sky-100',
        iconClass: 'bg-white/80 text-sky-600 shadow-[0_16px_32px_-24px_rgba(14,165,233,0.75)]',
        footerClass: 'bg-white/80 text-sky-700 ring-sky-100',
        glowClass: 'from-sky-500/[0.18] via-cyan-500/[0.08] to-transparent',
      },
      {
        kicker: '다음 1점 올리기',
        title: STAT_CONFIG[weakestStatKey].label,
        body: nextActionCopy[weakestStatKey],
        footer: `현재 ${STAT_CONFIG[weakestStatKey].label} ${stats[weakestStatKey].toFixed(1)} / 100`,
        icon: BookOpen,
        pillClass: 'bg-emerald-50/90 text-emerald-700 ring-emerald-100',
        iconClass: 'bg-white/80 text-emerald-600 shadow-[0_16px_32px_-24px_rgba(16,185,129,0.8)]',
        footerClass: 'bg-white/80 text-emerald-700 ring-emerald-100',
        glowClass: 'from-emerald-500/[0.18] via-teal-500/[0.08] to-transparent',
      },
      {
        kicker: '기록 갱신 흐름',
        title: seasonPercentile ? `상위 ${seasonPercentile}% 구간` : '이번 시즌 흐름 정리 중',
        body: weeklyDelta > 0
          ? `지난주보다 ${formatMinutesCompact(Math.abs(weeklyDelta))} 더 공부했어요. 이번 시즌 최고는 ${formatMinutesCompact(bestSeasonMinutes)}입니다.`
          : weeklyDelta < 0
            ? `지난주보다 ${formatMinutesCompact(Math.abs(weeklyDelta))} 적었어요. ${nextTierInfo.name}까지 ${nextTierInfo.remainingLp.toLocaleString()}점 남아 있어요.`
            : `이번 주 누적 ${formatMinutesCompact(weeklyStudyMinutes)}로 페이스를 안정적으로 유지하고 있어요.`,
        footer: weeklyDelta > 0
          ? `지난주 대비 +${formatMinutesCompact(Math.abs(weeklyDelta))}`
          : seasonPercentile
            ? `센터 상위 ${seasonPercentile}%`
            : `${nextTierInfo.name}까지 ${nextTierInfo.remainingLp.toLocaleString()}점`,
        icon: Flame,
        pillClass: 'bg-rose-50/90 text-rose-700 ring-rose-100',
        iconClass: 'bg-white/80 text-rose-500 shadow-[0_16px_32px_-24px_rgba(244,63,94,0.8)]',
        footerClass: 'bg-white/80 text-rose-700 ring-rose-100',
        glowClass: 'from-rose-500/[0.18] via-orange-400/[0.08] to-transparent',
      },
    ] as const;
  }, [
    latestSkillMoment,
    weakestStatKey,
    nextActionCopy,
    stats,
    seasonPercentile,
    weeklyDelta,
    bestSeasonMinutes,
    nextTierInfo.name,
    nextTierInfo.remainingLp,
    weeklyStudyMinutes,
  ]);

  if (isLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" /></div>;

  return (
    <div className={cn("flex flex-col pb-24", isMobile ? "gap-4 px-0" : "gap-10")}>
      <header className={cn("flex flex-col px-1", isMobile ? "gap-0.5" : "gap-2")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("bg-primary rounded-xl shadow-lg", isMobile ? "p-1.5" : "p-2.5")}>
              <TrendingUp className="text-white h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <h1 className={cn("font-black tracking-tighter", isMobile ? "text-xl" : "text-4xl")}>성장트랙</h1>
          </div>
          <Badge variant="secondary" className={cn("rounded-full font-black gap-1.5 bg-accent/10 text-[#14295F] border-none", isMobile ? "h-7 px-3 text-[8px]" : "h-9 px-4 text-xs")}>
            <Sparkles className="h-3 w-3 sm:h-4 w-4" /> 포인트 부스트 x{totalBoost.toFixed(2)}
          </Badge>
        </div>
      </header>

      {/* 시즌 메인 대시보드 - 현재 티어 그라디언트 적용 */}
      <Card
        className={cn(
          "student-hero-enter tier-hero-card border-none !text-white shadow-2xl overflow-hidden relative group transition-all duration-700",
          isMobile ? "rounded-[1.25rem] p-6" : "rounded-[3rem] p-12"
        )}
        style={{ backgroundImage: tierTheme.heroGradient }}
      >
        <div className="pointer-events-none absolute top-0 right-0 p-8 opacity-20 rotate-12 transition-transform duration-1000 group-hover:scale-110">
          {currentTier.name === '챌린저' ? <Crown className={cn(isMobile ? "h-32 w-32" : "h-64 w-64")} /> : <Trophy className={cn(isMobile ? "h-32 w-32" : "h-64 w-64")} />}
        </div>
        <div className={cn("relative z-10 space-y-6", isMobile ? "space-y-4" : "space-y-10")}>
          <div className={cn("flex flex-col justify-between gap-4", isMobile ? "" : "md:flex-row md:items-end")}>
            <div className="space-y-1">
              <Badge className="bg-white/20 text-white border-none font-black text-[8px] sm:text-[10px] px-2 py-0.5 mb-1 sm:mb-2 tracking-widest">시즌 {format(new Date(), 'M월', { locale: ko })}</Badge>
              <h2 className={cn("font-black tracking-tighter leading-none break-keep", isMobile ? "text-[clamp(2.2rem,12vw,3.35rem)]" : "text-7xl")}>
                {currentLp.toLocaleString()}<span className={cn("opacity-80 ml-1 font-bold", isMobile ? "text-sm" : "text-2xl")}>점</span>
              </h2>
              <p className={cn("font-bold opacity-90", isMobile ? "text-[10px]" : "text-sm")}>이번 시즌 누적 포인트</p>
            </div>
            
            <div className={cn("p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] bg-white/20 backdrop-blur-xl border border-white/20 flex flex-col items-center shadow-2xl", isMobile ? "w-full items-start" : "min-w-[180px]")}>
              <span className={cn("font-black uppercase tracking-widest opacity-80 mb-1", isMobile ? "text-[7px]" : "text-[10px]")}>현재 티어</span>
              <span className={cn("font-black tracking-tighter", isMobile ? "text-xl" : "text-3xl")}>{currentTier.name}</span>
              <span className={cn("text-[10px] font-bold mt-1 opacity-80", isMobile ? "" : "")}>다음: {(25000 - currentLp).toLocaleString()}점</span>
            </div>
          </div>

          <div className={cn("grid gap-2", isMobile ? "grid-cols-2" : "grid-cols-4")}>
            {[
              { label: '센터 랭킹', val: rankDisplay, icon: Trophy, color: 'text-yellow-400' },
              { label: '실력 지수', val: avgStat.toFixed(1), icon: Activity, color: 'text-orange-400' },
              { label: '부스트', val: `x${totalBoost.toFixed(2)}`, icon: Zap, color: 'text-emerald-400' },
              { label: '시즌 리셋', val: '매월 1일', icon: RefreshCw, color: 'text-blue-400' }
            ].map((item, i) => (
              i === 0 ? (
                <Link
                  key={i}
                  href="/dashboard/leaderboards"
                  className={cn(
                    "touch-manipulation bg-white/15 p-3 sm:p-5 rounded-xl sm:rounded-3xl border border-white/20 flex flex-col gap-0.5 transition-all duration-200 hover:bg-white/20 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                    isMobile && "active:scale-[0.98]"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <item.icon className={cn(isMobile ? "h-2.5 w-2.5" : "h-3.5 w-3.5", item.color)} />
                    <span className={cn("font-black uppercase tracking-widest opacity-80", isMobile ? "text-[7px]" : "text-[9px]")}>{item.label}</span>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <div className={cn("font-black tracking-tight", isMobile ? "text-sm" : "text-xl")}>{item.val}</div>
                    <span className={cn("font-black text-white/80 whitespace-nowrap", isMobile ? "text-[8px]" : "text-[10px]")}>
                      보기 <ChevronRight className={cn("inline", isMobile ? "h-3 w-3" : "h-3.5 w-3.5")} />
                    </span>
                  </div>
                </Link>
              ) : (
                <div key={i} className={cn("bg-white/15 p-3 sm:p-5 rounded-xl sm:rounded-3xl border border-white/20 flex flex-col gap-0.5")}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <item.icon className={cn(isMobile ? "h-2.5 w-2.5" : "h-3.5 w-3.5", item.color)} />
                    <span className={cn("font-black uppercase tracking-widest opacity-80", isMobile ? "text-[7px]" : "text-[9px]")}>{item.label}</span>
                  </div>
                  <div className={cn("font-black tracking-tight", isMobile ? "text-sm" : "text-xl")}>{item.val}</div>
                </div>
              )
            ))}
          </div>
        </div>
      </Card>

      <section className={isMobile ? "space-y-3" : "space-y-4"}>
        <Card className="relative overflow-hidden rounded-[1.75rem] border-none bg-[linear-gradient(135deg,#fffdf7_0%,#ffffff_46%,#f6fbff_100%)] shadow-[0_24px_60px_-34px_rgba(15,23,42,0.3)] ring-1 ring-black/[0.05]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(253,224,71,0.2),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_34%)]" />
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
          <CardContent className={cn("relative", isMobile ? "p-5" : "p-6")}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 shadow-sm ring-1 ring-amber-100">
                {growthCoachInsight.label}
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-black tracking-[0.16em] text-white shadow-sm">
                {growthCoachInsight.chip}
              </span>
            </div>
            <div className={cn("mt-4 flex gap-4", isMobile ? "flex-col" : "items-end justify-between")}>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/85 shadow-[0_16px_32px_-22px_rgba(251,191,36,0.9)] ring-1 ring-white/80 backdrop-blur-sm">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="space-y-2">
                    <p className={cn("font-black tracking-tight text-slate-900 break-keep", isMobile ? "text-lg leading-7" : "text-[1.7rem] leading-10")}>
                      {growthCoachInsight.title}
                    </p>
                    <p className="max-w-3xl text-sm font-semibold leading-6 text-slate-600 break-keep">
                      {growthCoachInsight.detail}
                    </p>
                  </div>
                </div>
              </div>
              <div className={cn("shrink-0 rounded-[1.5rem] bg-white/82 p-4 shadow-[0_18px_36px_-26px_rgba(15,23,42,0.32)] ring-1 ring-white/90 backdrop-blur-sm", isMobile ? "w-full" : "max-w-[18rem]")}>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">다음 포인트</p>
                <p className="mt-2 text-sm font-black leading-6 text-slate-900 break-keep">{growthCoachInsight.aside}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-3")}>
          {growthInsightCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.kicker}
                className="group relative overflow-hidden rounded-[1.75rem] border-none bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] shadow-[0_20px_54px_-38px_rgba(15,23,42,0.38)] ring-1 ring-black/[0.05] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-34px_rgba(15,23,42,0.42)]"
              >
                <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", card.glowClass)} />
                <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
                <CardContent className={cn("relative flex h-full flex-col", isMobile ? "p-5" : "p-6")}>
                  <div className="flex items-start justify-between gap-3">
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] shadow-sm ring-1", card.pillClass)}>
                      {card.kicker}
                    </span>
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ring-white/80 backdrop-blur-sm", card.iconClass)}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <p className={cn("font-black tracking-tight text-slate-900 break-keep", isMobile ? "text-lg leading-7" : "text-[1.35rem] leading-8")}>
                      {card.title}
                    </p>
                    <p className="text-sm font-semibold leading-6 text-slate-600 break-keep">
                      {card.body}
                    </p>
                  </div>
                  <div className="mt-auto pt-4">
                    <span className={cn("inline-flex max-w-full items-center rounded-full px-3 py-1.5 text-[11px] font-black shadow-sm ring-1", card.footerClass)}>
                      {card.footer}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 4대 핵심 스킬트랙 */}
      <section className={isMobile ? "space-y-3" : "space-y-6"}>
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Target className={cn("text-primary opacity-40", isMobile ? "h-4 w-4" : "h-6 w-6")} />
            <h2 className={cn("font-black tracking-tighter", isMobile ? "text-lg" : "text-2xl")}>스킬트랙</h2>
          </div>
          <Badge variant="outline" className="rounded-full font-black text-[9px] border-primary/20 px-2 h-5">평균: {avgStat.toFixed(1)}</Badge>
        </div>

        <div className={cn("grid gap-3", isMobile ? "grid-cols-1 sm:grid-cols-2" : "md:grid-cols-4")}>
          {Object.entries(STAT_CONFIG).map(([key, config]) => {
            const statKey = key as StatKey;
            const val = stats[statKey] || 0;
            const history = skillTrackHistory[statKey] || [];
            const gainedTotal = history.reduce((sum, item) => sum + item.gained, 0);
            const Icon = config.icon;
            return (
              <Dialog key={key}>
                <DialogTrigger asChild>
                  <button type="button" className="text-left">
                    <Card className={cn("border-none bg-white shadow-lg overflow-hidden group ring-1 ring-black/[0.03] hover:-translate-y-0.5 transition-all cursor-pointer", isMobile ? "rounded-[1rem] p-4" : "rounded-[2.5rem] p-8")}>
                      <div className="flex items-center justify-between mb-3">
                        <div className={cn("rounded-lg", config.accent, isMobile ? "p-1.5" : "p-3")}>
                          <Icon className={cn(config.color, isMobile ? "h-4 w-4" : "h-6 w-6")} />
                        </div>
                        <span className={cn("font-black uppercase tracking-widest opacity-40", isMobile ? "text-[7px]" : "text-[9px]")}>{config.sub}</span>
                      </div>
                      <h3 className={cn("font-black tracking-tight mb-0.5", isMobile ? "text-xs" : "text-xl")}>{config.label}</h3>
                      <div className="flex items-baseline gap-1 mb-3">
                        <span className={cn("font-black tabular-nums", isMobile ? "text-xl" : "text-3xl")}>{val.toFixed(1)}</span>
                        <span className={cn("font-bold text-muted-foreground opacity-40", isMobile ? "text-[8px]" : "text-xs")}>/ 100</span>
                      </div>
                      <div className="relative h-1.5 w-full bg-muted rounded-full overflow-hidden shadow-inner mb-2">
                        <div className={cn("absolute inset-y-0 left-0 transition-all duration-1000 ease-out", config.bg)} style={{ width: `${val}%` }} />
                      </div>
                      {!isMobile && <p className="text-[10px] font-bold text-muted-foreground leading-tight mt-3 pt-3 border-t border-dashed">{config.guide}</p>}
                    </Card>
                  </button>
                </DialogTrigger>
                <DialogContent className={cn("border-none shadow-2xl p-0 overflow-hidden", isMobile ? "w-[min(94vw,28rem)] max-h-[86svh] rounded-[1.5rem]" : "sm:max-w-lg rounded-[2rem]")}>
                  <div className={cn("text-white", config.bg, isMobile ? "p-5" : "p-7")}>
                    <DialogHeader>
                      <DialogTitle className={cn("font-black tracking-tight", isMobile ? "text-xl" : "text-2xl")}>{SKILL_LABEL[statKey]} 점수 획득 이력</DialogTitle>
                      <DialogDescription className="text-white/80 font-semibold text-xs">
                        이번 시즌 누적 획득 +{gainedTotal.toFixed(2)}점
                      </DialogDescription>
                    </DialogHeader>
                  </div>
                  <div className={cn("bg-white overflow-y-auto custom-scrollbar", isMobile ? "max-h-[calc(86svh-9.5rem)] p-4" : "max-h-[60vh] p-6")}>
                    {history.length === 0 ? (
                      <div className="py-10 text-center text-sm font-bold text-muted-foreground">이번 시즌 획득 기록이 없습니다.</div>
                    ) : (
                      <div className="space-y-2">
                        {history.slice(0, 60).map((item, index) => (
                          <div key={`${item.dateKey}-${index}`} className="rounded-xl border bg-slate-50/70 px-3 py-2.5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[11px] font-black text-slate-500">{item.dateKey}</p>
                                <p className="text-sm font-black text-slate-900">{item.reason}</p>
                                <p className="text-xs font-semibold text-slate-600">{item.detail}</p>
                              </div>
                              <p className="shrink-0 text-sm font-black text-emerald-600">+{item.gained.toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            );
          })}
        </div>
      </section>

      {/* 가이드 섹션 - 모바일 최적화 */}
      <section className="px-1">
        <Card className={cn("border-none shadow-xl bg-white overflow-hidden ring-1 ring-black/[0.02]", isMobile ? "rounded-[1.25rem] p-5" : "rounded-[2.5rem] p-8")}>
          <CardTitle className={cn("font-black flex items-center gap-2 tracking-tighter mb-4", isMobile ? "text-sm" : "text-xl")}>
            <BookOpen className={cn("text-primary", isMobile ? "h-4 w-4" : "h-6 w-6")} /> 포인트 획득 가이드
          </CardTitle>
          <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-3")}>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 font-black text-[10px] text-primary uppercase"><Zap className="h-3 w-3 text-accent fill-current" /> 보너스 보상</div>
              <div className="grid gap-1.5">
                {[
                  { l: '출석 보너스 (3h↑)', v: '+100점' },
                  { l: '계획 보너스 (전부 완료)', v: '+100점' },
                  { l: '실시간 몰입 학습', v: '1분당 1점' }
                ].map(item => (
                  <div key={item.l} className="flex justify-between items-center px-3 py-2 rounded-lg bg-[#fafafa] border text-[9px] font-bold">
                    <span>{item.l}</span>
                    <span className="text-primary font-black">{item.v}</span>
                  </div>
                ))}
              </div>
            </div>
            {!isMobile && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-600"><TrendingUp className="h-3 w-3" /> 시즌 티어</div>
                  <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 h-full flex items-center"><p className="text-11px] font-bold leading-relaxed text-emerald-900/70">2.5만 포인트 이상은 센터 내 상대 순위로 결정됩니다. (1위: 챌린저, 2~3위: 그랜드마스터)</p></div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-purple-600"><Star className="h-3 w-3 fill-current" /> 감쇠 규칙</div>
                  <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 h-full flex items-center"><p className="text-[11px] font-bold leading-relaxed text-purple-900/70">매월 1일 시즌 종료 시 4대 스킬은 5%씩 감쇠합니다. 꾸준한 학습 품질 유지가 필수입니다.</p></div>
                </div>
              </>
            )}
          </div>
          <SystemGuideDialog />
        </Card>
      </section>
    </div>
  );
}
