'use client';

import { useMemo } from 'react';
import { useAppContext } from '@/contexts/app-context';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { format, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { GrowthProgress, LeaderboardEntry, StudyLogDay, DailyReport } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Wallet, Timer, Trophy, TrendingUp, Gift, CalendarClock, BookOpen, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatStudyMinutes } from '@/lib/student-rewards';

function summarizeReportLine(content?: string | null) {
  if (!content) return '';
  return content
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 88);
}

export default function GrowthPage() {
  const { user } = useUser();
  const { activeMembership, viewMode } = useAppContext();
  const firestore = useFirestore();
  const isMobile = viewMode === 'mobile';
  const periodKey = format(new Date(), 'yyyy-MM');
  const todayKey = format(new Date(), 'yyyy-MM-dd');

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
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_study-time`, 'entries'),
      where('studentId', '==', user.uid),
      limit(1)
    );
  }, [firestore, activeMembership?.id, user?.uid, periodKey]);
  const { data: rankEntry } = useCollection<LeaderboardEntry>(rankQuery);

  const rankListQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_study-time`, 'entries'),
      orderBy('value', 'desc'),
      limit(120)
    );
  }, [firestore, activeMembership?.id, periodKey]);
  const { data: leaderboardEntries } = useCollection<LeaderboardEntry>(rankListQuery);

  const monthLogs = useMemo(
    () => (seasonStudyLogs || []).filter((log) => log.dateKey?.startsWith(periodKey)),
    [seasonStudyLogs, periodKey]
  );
  const monthTotalMinutes = useMemo(
    () => monthLogs.reduce((sum, log) => sum + Math.max(0, Number(log.totalMinutes || 0)), 0),
    [monthLogs]
  );
  const bestDayMinutes = useMemo(
    () => monthLogs.reduce((max, log) => Math.max(max, Math.max(0, Number(log.totalMinutes || 0))), 0),
    [monthLogs]
  );

  const recentWeekKeys = useMemo(
    () => Array.from({ length: 7 }, (_, index) => format(subDays(new Date(), 6 - index), 'yyyy-MM-dd')),
    []
  );
  const previousWeekKeys = useMemo(
    () => Array.from({ length: 7 }, (_, index) => format(subDays(new Date(), 13 - index), 'yyyy-MM-dd')),
    []
  );
  const weeklyStudyMinutes = useMemo(() => {
    const keySet = new Set(recentWeekKeys);
    return (seasonStudyLogs || [])
      .filter((log) => keySet.has(log.dateKey))
      .reduce((sum, log) => sum + Math.max(0, Number(log.totalMinutes || 0)), 0);
  }, [seasonStudyLogs, recentWeekKeys]);
  const previousWeekStudyMinutes = useMemo(() => {
    const keySet = new Set(previousWeekKeys);
    return (seasonStudyLogs || [])
      .filter((log) => keySet.has(log.dateKey))
      .reduce((sum, log) => sum + Math.max(0, Number(log.totalMinutes || 0)), 0);
  }, [seasonStudyLogs, previousWeekKeys]);
  const weeklyDelta = weeklyStudyMinutes - previousWeekStudyMinutes;

  const sortedLeaderboard = useMemo(
    () => [...(leaderboardEntries || [])].sort((a, b) => Number(b.value || 0) - Number(a.value || 0)),
    [leaderboardEntries]
  );
  const myRank = useMemo(() => {
    if (!user || !sortedLeaderboard.length) return 0;
    const index = sortedLeaderboard.findIndex((entry) => entry.studentId === user.uid);
    if (index >= 0) return index + 1;
    const ownValue = Number(rankEntry?.[0]?.value || 0);
    if (!ownValue) return 0;
    return sortedLeaderboard.filter((entry) => Number(entry.value || 0) > ownValue).length + 1;
  }, [sortedLeaderboard, user?.uid, rankEntry]);
  const participantCount = sortedLeaderboard.length;
  const myPercentile = useMemo(() => {
    if (!myRank || !participantCount) return null;
    return Math.max(1, Math.ceil((myRank / participantCount) * 100));
  }, [myRank, participantCount]);

  const teacherReports = useMemo(
    () => [...(teacherReportsRaw || [])].sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
    [teacherReportsRaw]
  );
  const latestReport = teacherReports[0] || null;
  const headline = latestReport?.aiMeta?.teacherOneLiner?.trim()
    || latestReport?.nextAction?.trim()
    || summarizeReportLine(latestReport?.content)
    || '오늘의 작은 몰입이 이번 달 전체 공부 흐름을 바꿔 줄 수 있어요.';

  const todayPointStatus = (progress?.dailyPointStatus?.[todayKey] || {}) as Record<string, any>;
  const claimedBoxes = Array.isArray(todayPointStatus.claimedStudyBoxes) ? todayPointStatus.claimedStudyBoxes.length : 0;
  const dailyPoints = Number(todayPointStatus.dailyPointAmount || 0);
  const pointWallet = Number(progress?.pointsBalance || 0);
  const totalPointsEarned = Number(progress?.totalPointsEarned || 0);

  const kpiCards = [
    {
      label: '포인트 지갑',
      value: `${pointWallet.toLocaleString()}P`,
      sub: '지금 바로 쓸 수 있는 누적 포인트',
      icon: Wallet,
    },
    {
      label: '이번 달 공부시간',
      value: formatStudyMinutes(monthTotalMinutes),
      sub: '월간 누적 공부시간 기준',
      icon: Timer,
    },
    {
      label: '월간 공부 랭킹',
      value: myRank ? `#${myRank}` : '집계중',
      sub: myPercentile ? `상위 ${myPercentile}%` : '랭킹 집계 대기',
      icon: Trophy,
    },
    {
      label: '오늘 상자 진행',
      value: `${claimedBoxes}/8`,
      sub: dailyPoints ? `오늘 ${dailyPoints.toLocaleString()}P 획득` : '1시간마다 포인트 상자 오픈',
      icon: Gift,
    },
  ] as const;

  if (isLoading) {
    return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;
  }

  return (
    <div className={cn('mx-auto flex w-full max-w-6xl flex-col pb-24', isMobile ? 'gap-4 px-1' : 'gap-8 px-4')}>
      <header className="space-y-2 px-1">
        <div className="flex items-center gap-2">
          <div className={cn('rounded-2xl bg-[#14295F] text-white shadow-lg', isMobile ? 'p-2' : 'p-3')}>
            <Sparkles className={cn(isMobile ? 'h-4 w-4' : 'h-5 w-5')} />
          </div>
          <div>
            <h1 className={cn('font-black tracking-tighter text-primary', isMobile ? 'text-2xl' : 'text-4xl')}>성장트랙</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/45">points & study time</p>
          </div>
        </div>
      </header>

      <Card className="overflow-hidden rounded-[2rem] border-none bg-[linear-gradient(135deg,#14295F_0%,#1B326D_55%,#233E86_100%)] text-white shadow-[0_34px_80px_-44px_rgba(20,41,95,0.9)]">
        <CardContent className={cn(isMobile ? 'p-5' : 'p-8')}>
          <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-end justify-between')}>
            <div className="space-y-3">
              <Badge className="border-none bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white">
                포인트 중심 성장
              </Badge>
              <h2 className={cn('font-black tracking-tight break-keep', isMobile ? 'text-2xl leading-9' : 'text-[2.7rem] leading-[1.1]')}>
                이번 달 공부시간을 쌓아<br className={isMobile ? 'hidden' : 'block'} /> 월간 랭킹과 포인트 보상을 함께 가져가요
              </h2>
              <p className={cn('font-semibold text-white/75', isMobile ? 'text-sm leading-6' : 'max-w-3xl text-base leading-7')}>
                보상은 포인트 지갑으로, 경쟁은 월간 공부시간 랭킹으로 정리됐습니다. 첫 공부 시작엔 운세가 뜨고, 누적 1시간마다 포인트 상자가 열립니다.
              </p>
            </div>
            <div className={cn('rounded-[1.5rem] border border-white/15 bg-white/10 backdrop-blur-sm', isMobile ? 'p-4' : 'min-w-[18rem] p-5')}>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">누적 포인트</p>
              <p className={cn('mt-2 font-black tracking-tight', isMobile ? 'text-3xl' : 'text-5xl')}>{pointWallet.toLocaleString()}<span className="ml-1 text-base opacity-70">P</span></p>
              <p className="mt-2 text-xs font-semibold text-white/70">총 획득 {totalPointsEarned.toLocaleString()}P · 최고 하루 {formatStudyMinutes(bestDayMinutes)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-4')}>
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="rounded-[1.75rem] border border-slate-100 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
              <CardContent className={cn(isMobile ? 'p-5' : 'p-6')}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary/45">{card.label}</span>
                  <div className="rounded-2xl bg-[#14295F]/6 p-2 text-[#14295F]">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <p className={cn('mt-4 font-black tracking-tight text-primary break-keep', isMobile ? 'text-2xl' : 'text-[2rem]')}>{card.value}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 break-keep">{card.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-[1.3fr_0.9fr]')}>
        <Card className="rounded-[2rem] border-none bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] shadow-[0_28px_70px_-46px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.04]">
          <CardContent className={cn(isMobile ? 'p-5' : 'p-7')}>
            <div className="flex items-center gap-2">
              <Badge className="border-none bg-[#14295F]/8 text-[#14295F]">학습 코치 한마디</Badge>
              {latestReport?.dateKey && <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">{latestReport.dateKey}</Badge>}
            </div>
            <p className={cn('mt-4 font-black tracking-tight text-slate-900 break-keep', isMobile ? 'text-xl leading-8' : 'text-[1.85rem] leading-[1.35]')}>
              {headline}
            </p>
            <div className={cn('mt-6 grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
              <div className="rounded-[1.5rem] border border-slate-100 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">이번 주 변화</p>
                <p className={cn('mt-2 font-black tracking-tight text-slate-900', isMobile ? 'text-xl' : 'text-2xl')}>
                  {weeklyDelta >= 0 ? '+' : '-'}{formatStudyMinutes(Math.abs(weeklyDelta))}
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-600">지난주 대비 공부시간 차이</p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-100 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">다음 상자까지</p>
                <p className={cn('mt-2 font-black tracking-tight text-slate-900', isMobile ? 'text-xl' : 'text-2xl')}>
                  {Math.max(0, 60 - (monthLogs.find((log) => log.dateKey === todayKey)?.totalMinutes || 0) % 60)}분
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-600">오늘 누적 공부시간 기준</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-none bg-[linear-gradient(180deg,#fffdf7_0%,#ffffff_100%)] shadow-[0_28px_70px_-46px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.04]">
          <CardHeader className={cn(isMobile ? 'p-5 pb-3' : 'p-6 pb-4')}>
            <CardTitle className="flex items-center gap-2 text-lg font-black tracking-tight text-primary">
              <BookOpen className="h-4 w-4" /> 포인트 획득 가이드
            </CardTitle>
            <CardDescription className="font-semibold text-slate-500">공부시간 상자와 작은 완료 보상 중심으로 운영됩니다.</CardDescription>
          </CardHeader>
          <CardContent className={cn(isMobile ? 'space-y-3 p-5 pt-0' : 'space-y-3 p-6 pt-0')}>
            {[
              ['1시간마다 상자', '1h~8h 누적 구간마다 포인트 상자 오픈'],
              ['학습 계획 완료', '+10 포인트'],
              ['출석/루틴 완료', '+10 포인트'],
              ['일간 공부시간 1등', '+1000 포인트'],
              ['월간 공부시간 랭킹', '1위 20,000 · 2위 10,000 · 3위 5,000'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-[1.3rem] border border-slate-100 bg-white px-4 py-3 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.3)]">
                <p className="text-sm font-black text-slate-900">{title}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{body}</p>
              </div>
            ))}
            <Button asChild className="mt-2 h-12 w-full rounded-2xl bg-[#14295F] font-black text-white hover:bg-[#1B326D]">
              <Link href="/dashboard/leaderboards">
                월간 공부 랭킹 보기
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
