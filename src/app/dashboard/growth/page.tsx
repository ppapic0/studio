'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { format, subDays } from 'date-fns';
import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  ArrowRight,
  CalendarClock,
  Clock3,
  Gift,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
  Wallet,
} from 'lucide-react';

import { useAppContext } from '@/contexts/app-context';
import { useCollection, useDoc, useFirestore, useUser } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { DailyStudentStat, GrowthProgress, LeaderboardEntry, StudyLogDay } from '@/lib/types';
import { formatStudyMinutes, getClaimedStudyBoxes, getDailyFortuneMessage, type StudyBoxReward } from '@/lib/student-rewards';

type RankRow = {
  studentId: string;
  value: number;
};

type RankSnapshot = {
  rank: number | null;
  totalStudents: number;
  value: number;
  percentile: number | null;
};

function buildRankSnapshot(rows: RankRow[], studentId?: string | null): RankSnapshot {
  if (!studentId || rows.length === 0) {
    return { rank: null, totalStudents: rows.length, value: 0, percentile: null };
  }

  const own = rows.find((row) => row.studentId === studentId);
  if (!own) {
    return { rank: null, totalStudents: rows.length, value: 0, percentile: null };
  }

  const higherCount = rows.filter((row) => row.value > own.value).length;
  const rank = higherCount + 1;
  const percentile = Math.max(1, Math.ceil((rank / rows.length) * 100));
  return {
    rank,
    totalStudents: rows.length,
    value: own.value,
    percentile,
  };
}

function normalizeStudyBoxRewards(value: unknown): StudyBoxReward[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const reward = item as Partial<StudyBoxReward>;
      const milestone = Number(reward.milestone || 0);
      const awardedPoints = Number(reward.awardedPoints || 0);
      const minReward = Number(reward.minReward || 0);
      const maxReward = Number(reward.maxReward || 0);
      const multiplier = Number(reward.multiplier || 1);
      if (!Number.isFinite(milestone) || milestone <= 0) return null;
      return {
        milestone,
        awardedPoints: Number.isFinite(awardedPoints) ? awardedPoints : 0,
        minReward: Number.isFinite(minReward) ? minReward : 0,
        maxReward: Number.isFinite(maxReward) ? maxReward : 0,
        multiplier: Number.isFinite(multiplier) ? multiplier : 1,
      } satisfies StudyBoxReward;
    })
    .filter((reward): reward is StudyBoxReward => Boolean(reward))
    .sort((a, b) => a.milestone - b.milestone);
}

function getNextStudyBoxMilestone(claimedStudyBoxes: number[]) {
  for (let milestone = 1; milestone <= 8; milestone += 1) {
    if (!claimedStudyBoxes.includes(milestone)) return milestone;
  }
  return null;
}

function formatRankTitle(snapshot: RankSnapshot) {
  if (!snapshot.rank) return '집계 준비중';
  return `#${snapshot.rank}`;
}

function formatRankMeta(snapshot: RankSnapshot) {
  if (!snapshot.rank) return '공부시간이 쌓이면 순위가 보여요';
  return `${formatStudyMinutes(snapshot.value)} · 상위 ${snapshot.percentile}%`;
}

function PointVaultStage({
  reward,
  isMobile,
  isOpening = false,
  isRevealed = false,
  empty = false,
}: {
  reward?: StudyBoxReward | null;
  isMobile: boolean;
  isOpening?: boolean;
  isRevealed?: boolean;
  empty?: boolean;
}) {
  const milestoneLabel = reward ? `${reward.milestone}시간 상자` : '다음 포인트 상자';
  const rangeLabel = reward
    ? `기본 ${reward.minReward}~${reward.maxReward} 포인트`
    : '누적 1시간마다 새 상자가 보관함에 도착해요';

  return (
    <div className={cn('point-box-stage', isMobile && 'is-mobile', empty && 'is-empty')}>
      <div className={cn('point-box-scene', isOpening ? 'is-opening' : isRevealed ? 'is-revealed' : 'is-idle', isMobile && 'is-mobile')}>
        <div className="point-box-aura point-box-aura--left" />
        <div className="point-box-aura point-box-aura--right" />
        <div className="point-box-floor" />
        <div className="point-box-shadow" />
        <div className="point-box-light" />
        <span className="point-box-particle point-box-particle--1" />
        <span className="point-box-particle point-box-particle--2" />
        <span className="point-box-particle point-box-particle--3" />
        <span className="point-box-particle point-box-particle--4" />
        <div className="point-box">
          <div className="point-box-lid">
            <span className="point-box-lid-highlight" />
            <span className="point-box-latch" />
          </div>
          <div className="point-box-body">
            <span className="point-box-ribbon point-box-ribbon--v" />
            <span className="point-box-ribbon point-box-ribbon--h" />
            <span className="point-box-core" />
          </div>
        </div>
        <div className="point-box-copy">
          <p className="point-box-kicker">{milestoneLabel}</p>
          <p className="point-box-caption">{isRevealed ? '상자가 열리며 포인트가 공개됐어요' : rangeLabel}</p>
        </div>
        <div className={cn('point-box-hint', isRevealed && 'is-hidden')}>
          {empty ? '누적 공부시간을 채워 상자를 모아보세요' : '터치해서 열기'}
        </div>
        <div className={cn('point-box-reward', isRevealed && 'is-visible')}>
          <span className="point-box-reward-value">+{reward?.awardedPoints ?? 0}</span>
          <span className="point-box-reward-unit">포인트</span>
        </div>
      </div>
    </div>
  );
}

export default function GrowthPage() {
  const { user } = useUser();
  const { activeMembership, viewMode } = useAppContext();
  const firestore = useFirestore();
  const isMobile = viewMode === 'mobile';
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);
  const recentWeekKeys = useMemo(
    () => Array.from({ length: 7 }, (_, index) => format(subDays(today, 6 - index), 'yyyy-MM-dd')),
    [today]
  );
  const periodKey = useMemo(() => format(today, 'yyyy-MM'), [today]);

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: progress } = useDoc<GrowthProgress>(progressRef);

  const seasonStudyLogsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days'),
      orderBy('dateKey', 'desc'),
      limit(62)
    );
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: seasonStudyLogs } = useCollection<StudyLogDay>(seasonStudyLogsQuery);

  const rankListQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_study-time`, 'entries'),
      orderBy('value', 'desc'),
      limit(150)
    );
  }, [firestore, activeMembership?.id, periodKey]);
  const { data: leaderboardEntries, isLoading: monthlyRankLoading } = useCollection<LeaderboardEntry>(rankListQuery);

  const [dailyRank, setDailyRank] = useState<RankSnapshot>({ rank: null, totalStudents: 0, value: 0, percentile: null });
  const [weeklyRank, setWeeklyRank] = useState<RankSnapshot>({ rank: null, totalStudents: 0, value: 0, percentile: null });
  const [rankLoading, setRankLoading] = useState(true);
  const [openedStudyBoxes, setOpenedStudyBoxes] = useState<number[]>([]);
  const [isVaultDialogOpen, setIsVaultDialogOpen] = useState(false);
  const [isBoxOpening, setIsBoxOpening] = useState(false);
  const [isBoxRevealed, setIsBoxRevealed] = useState(false);
  const [revealedReward, setRevealedReward] = useState<StudyBoxReward | null>(null);
  const boxRevealTimeoutRef = useRef<number | null>(null);

  const monthLogs = useMemo(
    () => (seasonStudyLogs || []).filter((log) => log.dateKey?.startsWith(periodKey)),
    [seasonStudyLogs, periodKey]
  );
  const todayStudyMinutes = useMemo(
    () => Number(monthLogs.find((log) => log.dateKey === todayKey)?.totalMinutes || 0),
    [monthLogs, todayKey]
  );
  const weeklyStudyMinutes = useMemo(() => {
    const keySet = new Set(recentWeekKeys);
    return (seasonStudyLogs || [])
      .filter((log) => keySet.has(log.dateKey))
      .reduce((sum, log) => sum + Math.max(0, Number(log.totalMinutes || 0)), 0);
  }, [seasonStudyLogs, recentWeekKeys]);

  const todayPointStatus = (progress?.dailyPointStatus?.[todayKey] || {}) as Record<string, any>;
  const pointWallet = Number(progress?.pointsBalance || 0);
  const totalPointsEarned = Number(progress?.totalPointsEarned || 0);
  const todayPoints = Number(todayPointStatus.dailyPointAmount || 0);
  const claimedStudyBoxes = useMemo(() => getClaimedStudyBoxes(todayPointStatus), [todayPointStatus]);
  const todayStudyBoxRewards = useMemo(
    () => normalizeStudyBoxRewards(todayPointStatus.studyBoxRewards),
    [todayPointStatus.studyBoxRewards]
  );
  const persistedOpenedStudyBoxes = useMemo(() => {
    const raw = todayPointStatus.openedStudyBoxes;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 1 && value <= 8)
      .sort((a, b) => a - b);
  }, [todayPointStatus.openedStudyBoxes]);

  useEffect(() => {
    setOpenedStudyBoxes(persistedOpenedStudyBoxes);
  }, [persistedOpenedStudyBoxes]);

  useEffect(() => {
    return () => {
      if (boxRevealTimeoutRef.current) {
        window.clearTimeout(boxRevealTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!firestore || !activeMembership || !user) return;
    let cancelled = false;

    const loadRanks = async () => {
      setRankLoading(true);
      try {
        const dailySnap = await getDocs(collection(firestore, 'centers', activeMembership.id, 'dailyStudentStats', todayKey, 'students'));
        const dailyRows = dailySnap.docs.map((docSnap) => ({
          studentId: docSnap.id,
          value: Math.max(0, Number((docSnap.data() as DailyStudentStat).totalStudyMinutes || 0)),
        }));

        const weeklyMap = new Map<string, number>();
        await Promise.all(
          recentWeekKeys.map(async (dateKey) => {
            const snap = await getDocs(collection(firestore, 'centers', activeMembership.id, 'dailyStudentStats', dateKey, 'students'));
            snap.forEach((docSnap) => {
              const current = weeklyMap.get(docSnap.id) || 0;
              const nextValue = current + Math.max(0, Number((docSnap.data() as DailyStudentStat).totalStudyMinutes || 0));
              weeklyMap.set(docSnap.id, nextValue);
            });
          })
        );

        const weeklyRows = Array.from(weeklyMap.entries()).map(([studentId, value]) => ({ studentId, value }));
        if (!cancelled) {
          setDailyRank(buildRankSnapshot(dailyRows, user.uid));
          setWeeklyRank(buildRankSnapshot(weeklyRows, user.uid));
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[points-track] rank snapshot load failed', error);
          setDailyRank({ rank: null, totalStudents: 0, value: 0, percentile: null });
          setWeeklyRank({ rank: null, totalStudents: 0, value: 0, percentile: null });
        }
      } finally {
        if (!cancelled) setRankLoading(false);
      }
    };

    void loadRanks();
    return () => {
      cancelled = true;
    };
  }, [firestore, activeMembership?.id, user?.uid, todayKey, recentWeekKeys]);

  const monthlyRank = useMemo(() => {
    const rows = (leaderboardEntries || []).map((entry) => ({
      studentId: entry.studentId,
      value: Math.max(0, Number(entry.value || 0)),
    }));
    return buildRankSnapshot(rows, user?.uid);
  }, [leaderboardEntries, user?.uid]);

  const fortuneMessage = useMemo(
    () => String(todayPointStatus.fortuneMessage || getDailyFortuneMessage(user?.uid || 'student', todayKey)),
    [todayPointStatus.fortuneMessage, user?.uid, todayKey]
  );
  const nextStudyBoxMilestone = useMemo(
    () => getNextStudyBoxMilestone(claimedStudyBoxes),
    [claimedStudyBoxes]
  );
  const nextStudyBoxMinutesLeft = useMemo(() => {
    if (!nextStudyBoxMilestone) return 0;
    return Math.max(0, nextStudyBoxMilestone * 60 - todayStudyMinutes);
  }, [nextStudyBoxMilestone, todayStudyMinutes]);
  const pendingStudyBoxes = useMemo(
    () => todayStudyBoxRewards.filter((reward) => !openedStudyBoxes.includes(reward.milestone)),
    [todayStudyBoxRewards, openedStudyBoxes]
  );
  const currentStudyBox = revealedReward || pendingStudyBoxes[0] || null;
  const previewStudyBox = pendingStudyBoxes[0] || todayStudyBoxRewards[todayStudyBoxRewards.length - 1] || null;
  const hasCompletedTodayBoxes = todayStudyBoxRewards.length > 0 && pendingStudyBoxes.length === 0;

  const persistOpenedStudyBox = useCallback(
    (milestone: number) => {
      if (!progressRef) return;
      const nextOpenedStudyBoxes = Array.from(new Set([...openedStudyBoxes, milestone])).sort((a, b) => a - b);
      setOpenedStudyBoxes(nextOpenedStudyBoxes);

      void setDoc(progressRef, {
        dailyPointStatus: {
          [todayKey]: {
            ...todayPointStatus,
            openedStudyBoxes: nextOpenedStudyBoxes,
          },
        },
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch((error) => {
        console.warn('[points-track] study box open persist skipped', error);
      });
    },
    [openedStudyBoxes, progressRef, todayKey, todayPointStatus]
  );

  const handleVaultDialogChange = useCallback((open: boolean) => {
    setIsVaultDialogOpen(open);
    if (!open) {
      if (boxRevealTimeoutRef.current) {
        window.clearTimeout(boxRevealTimeoutRef.current);
        boxRevealTimeoutRef.current = null;
      }
      setIsBoxOpening(false);
      setIsBoxRevealed(false);
      setRevealedReward(null);
      return;
    }
    setIsBoxOpening(false);
    setIsBoxRevealed(false);
    setRevealedReward(null);
  }, []);

  const handleRevealCurrentStudyBox = useCallback(() => {
    const reward = pendingStudyBoxes[0];
    if (!reward || isBoxOpening || isBoxRevealed) return;

    setIsBoxOpening(true);
    boxRevealTimeoutRef.current = window.setTimeout(() => {
      setRevealedReward(reward);
      persistOpenedStudyBox(reward.milestone);
      setIsBoxOpening(false);
      setIsBoxRevealed(true);
      boxRevealTimeoutRef.current = null;
    }, 920);
  }, [isBoxOpening, isBoxRevealed, pendingStudyBoxes, persistOpenedStudyBox]);

  const handleNextStudyBox = useCallback(() => {
    setIsBoxOpening(false);
    setIsBoxRevealed(false);
    setRevealedReward(null);
  }, []);

  const topKpis = [
    {
      label: '포인트 지갑',
      value: `${pointWallet.toLocaleString()}P`,
      meta: `총 획득 ${totalPointsEarned.toLocaleString()}P`,
      icon: Wallet,
    },
    {
      label: '오늘 공부시간',
      value: formatStudyMinutes(todayStudyMinutes),
      meta: todayPoints ? `오늘 ${todayPoints.toLocaleString()}P 획득` : '1시간마다 상자를 열 수 있어요',
      icon: Timer,
    },
    {
      label: '이번 주 누적',
      value: formatStudyMinutes(weeklyStudyMinutes),
      meta: '최근 7일 누적 공부시간',
      icon: CalendarClock,
    },
    {
      label: '오늘 상자 진행',
      value: `${claimedStudyBoxes.length}/8`,
      meta: nextStudyBoxMilestone ? `다음 상자까지 ${formatStudyMinutes(nextStudyBoxMinutesLeft)}` : '오늘 상자를 모두 모았어요',
      icon: Gift,
    },
  ] as const;

  return (
    <div className={cn('mx-auto flex w-full max-w-6xl flex-col pb-24', isMobile ? 'gap-4 px-1' : 'gap-6 px-4')}>
      <header className="space-y-2 px-1">
        <div className="flex items-center gap-2">
          <div className={cn('rounded-2xl bg-[#14295F] text-white shadow-lg', isMobile ? 'p-2' : 'p-3')}>
            <Wallet className={cn(isMobile ? 'h-4 w-4' : 'h-5 w-5')} />
          </div>
          <div>
            <h1 className={cn('font-black tracking-tighter text-primary', isMobile ? 'text-2xl' : 'text-4xl')}>포인트트랙</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/45">points & study ranking</p>
          </div>
        </div>
      </header>

      <Card className="overflow-hidden rounded-[2rem] border-none bg-[linear-gradient(135deg,#14295F_0%,#1B326D_55%,#233E86_100%)] text-white shadow-[0_34px_80px_-44px_rgba(20,41,95,0.9)]">
        <CardContent className={cn(isMobile ? 'p-5' : 'p-8')}>
          <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-end justify-between')}>
            <div className={cn('rounded-[1.7rem] border border-white/65 bg-white/95 text-[#14295F] shadow-[0_28px_60px_-42px_rgba(9,19,46,0.58)]', isMobile ? 'p-4' : 'max-w-3xl p-6')}>
              <Badge className="border-none bg-[#14295F] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-sm">
                포인트 중심 학습
              </Badge>
              <h2 className={cn('mt-4 font-black tracking-tight break-keep text-[#14295F]', isMobile ? 'text-[1.85rem] leading-[1.35]' : 'text-[2.7rem] leading-[1.12]')}>
                공부시간을 쌓고<br className={isMobile ? 'hidden' : 'block'} /> 상자를 열고 포인트를 모아보세요
              </h2>
              <p className={cn('mt-3 font-semibold text-slate-600', isMobile ? 'text-sm leading-6' : 'max-w-3xl text-base leading-7')}>
                첫 공부 시작에는 오늘의 학업 운세가 뜨고, 누적 공부시간 1시간마다 포인트 상자를 열 수 있어요. 경쟁은 월간 공부시간 랭킹으로만 정리됩니다.
              </p>
            </div>
            <div className={cn('rounded-[1.5rem] border border-white/15 bg-white/10 backdrop-blur-sm', isMobile ? 'p-4' : 'min-w-[17rem] p-5')}>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">현재 포인트 지갑</p>
              <p className={cn('mt-2 font-black tracking-tight', isMobile ? 'text-3xl' : 'text-5xl')}>
                {pointWallet.toLocaleString()}<span className="ml-1 text-base opacity-70">P</span>
              </p>
              <p className="mt-2 text-xs font-semibold text-white/70">
                오늘 {todayPoints.toLocaleString()}P · 상자 {claimedStudyBoxes.length}/8개 적립
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
        {topKpis.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="rounded-[1.6rem] border border-slate-100 bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)]">
              <CardContent className={cn(isMobile ? 'p-4' : 'p-5')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-primary/45">{card.label}</span>
                  <div className="rounded-2xl bg-[#14295F]/6 p-2 text-[#14295F]">
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <p className={cn('mt-4 font-black tracking-tight text-primary break-keep', isMobile ? 'text-xl leading-7' : 'text-[1.9rem]')}>
                  {card.value}
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 break-keep">{card.meta}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-[1.2fr_0.8fr]')}>
        <Card className="rounded-[2rem] border-none bg-white shadow-[0_32px_70px_-44px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.04]">
          <CardContent className={cn(isMobile ? 'p-5' : 'p-7')}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Badge className="border-none bg-[#14295F]/8 text-[#14295F]">포인트 상자 보관함</Badge>
                <p className="mt-3 text-lg font-black tracking-tight text-slate-900 break-keep">
                  도착한 상자를 큰 무대에서 한 개씩 집중해서 열어보세요
                </p>
              </div>
              <div className="rounded-[1.2rem] bg-[#F4F7FD] px-3 py-2 text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]/50">열 수 있는 상자</p>
                <p className="text-lg font-black text-[#14295F]">{pendingStudyBoxes.length}개</p>
              </div>
            </div>

            <div className={cn('mt-5 grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
              <div className="rounded-[1.35rem] border border-[#D8E2F5] bg-[#F8FAFF] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]/45">오늘 획득 포인트</p>
                <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">{todayPoints.toLocaleString()}P</p>
              </div>
              <div className="rounded-[1.35rem] border border-[#D8E2F5] bg-[#F8FAFF] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]/45">다음 상자까지</p>
                <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">
                  {nextStudyBoxMilestone ? formatStudyMinutes(nextStudyBoxMinutesLeft) : '완료'}
                </p>
              </div>
              <div className="rounded-[1.35rem] border border-[#D8E2F5] bg-[#F8FAFF] px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]/45">오늘 열린 상자</p>
                <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">{openedStudyBoxes.length}개</p>
              </div>
            </div>

            <div className="mt-5 rounded-[1.8rem] border border-[#D7E0F2] bg-[linear-gradient(180deg,#F8FBFF_0%,#EEF4FF_100%)] p-4 shadow-[0_24px_44px_-34px_rgba(20,41,95,0.2)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#14295F]/45">point vault</p>
                  <p className="mt-2 text-base font-black tracking-tight text-slate-900 break-keep">
                    {pendingStudyBoxes.length > 0
                      ? `${pendingStudyBoxes.length}개의 상자가 도착했어요`
                      : hasCompletedTodayBoxes
                        ? '오늘 도착한 상자를 모두 열었어요'
                        : '누적 공부시간을 채우면 상자가 도착해요'}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                    {pendingStudyBoxes.length > 0
                      ? `보상은 이미 적립됐고, 보관함에서 한 개씩 리얼하게 열 수 있어요.`
                      : nextStudyBoxMilestone
                        ? `다음 상자까지 ${formatStudyMinutes(nextStudyBoxMinutesLeft)} 남았어요.`
                        : '오늘의 상자를 모두 적립했고, 다음 공부 때 새 상자가 이어집니다.'}
                  </p>
                </div>
                <div className="hidden rounded-[1rem] border border-[#D8E2F5] bg-white px-3 py-2 text-right md:block">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]/50">현재 포인트 지갑</p>
                  <p className="mt-1 text-xl font-black text-[#14295F]">{pointWallet.toLocaleString()}P</p>
                </div>
              </div>

              <div className="mt-4">
                <PointVaultStage
                  reward={previewStudyBox}
                  isMobile={isMobile}
                  empty={!previewStudyBox && !hasCompletedTodayBoxes}
                />
              </div>

              <div className={cn('mt-4 flex gap-3', isMobile ? 'flex-col' : 'items-center justify-between')}>
                <div className="rounded-[1rem] bg-white/80 px-4 py-3 text-sm font-semibold leading-6 text-slate-600 ring-1 ring-[#D8E2F5]">
                  {pendingStudyBoxes.length > 0
                    ? '보상은 지급 완료됐고, 연출만 보관함에서 직접 여는 구조예요.'
                    : hasCompletedTodayBoxes
                      ? '오늘의 상자는 전부 열었어요. 다음 공부시간 상자를 기다려주세요.'
                      : '아직 상자는 없지만, 공부시간이 쌓이면 보관함에 차곡차곡 도착합니다.'}
                </div>
                <Button
                  type="button"
                  onClick={() => handleVaultDialogChange(true)}
                  className="h-11 rounded-[1rem] bg-[#14295F] px-5 font-black text-white hover:bg-[#10214D]"
                >
                  {pendingStudyBoxes.length > 0 ? '상자 열기' : '보관함 보기'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="rounded-[1.8rem] border-none bg-[linear-gradient(180deg,#ffffff_0%,#f6f9ff_100%)] shadow-[0_24px_56px_-40px_rgba(15,23,42,0.34)] ring-1 ring-black/[0.04]">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-[#14295F]">
                <Sparkles className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.18em]">오늘의 학업 운세</span>
              </div>
              <p className="mt-4 text-base font-black leading-7 text-slate-900 break-keep">
                {fortuneMessage}
              </p>
              <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">
                오늘 첫 공부 시작 때 딱 한 번만 보여주는 응원 메시지예요.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-[1.8rem] border-none bg-[linear-gradient(180deg,#ffffff_0%,#f6f9ff_100%)] shadow-[0_24px_56px_-40px_rgba(15,23,42,0.34)] ring-1 ring-black/[0.04]">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-[#14295F]">
                <MessageCircle className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.18em]">원하는 선물 문의</span>
              </div>
              <p className="mt-4 text-base font-black leading-7 text-slate-900 break-keep">
                카카오톡 선물하기에 있는 상품이면 센터 관리자에게 바로 문의할 수 있어요
              </p>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                예: 편의점, 카페, 간식, 문구, 문화상품권. 원하는 상품명과 링크를 함께 남기면 확인이 빨라요.
              </p>
              <Button asChild className="mt-5 h-11 rounded-[1rem] bg-[#14295F] px-4 font-black text-white hover:bg-[#10214D]">
                <Link href="/dashboard/appointments/inquiries">
                  센터 관리자에게 문의하기
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-xl font-black tracking-tight text-primary">나의 공부시간 랭킹</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">포인트 보상과 연결되는 일간·주간·월간 순위를 함께 봐요.</p>
          </div>
          {(rankLoading || monthlyRankLoading) && <Loader2 className="h-5 w-5 animate-spin text-primary/30" />}
        </div>

        <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
          {[
            {
              label: '일간 랭킹',
              snapshot: dailyRank,
              meta: '오늘 공부시간 기준',
              icon: Clock3,
            },
            {
              label: '주간 랭킹',
              snapshot: weeklyRank,
              meta: '최근 7일 누적 공부시간',
              icon: CalendarClock,
            },
            {
              label: '월간 랭킹',
              snapshot: monthlyRank,
              meta: '이번 달 누적 공부시간',
              icon: Trophy,
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className="rounded-[1.75rem] border-none bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.04]">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="rounded-[1rem] bg-[#14295F]/8 p-2.5 text-[#14295F]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <Badge className="border-none bg-[#14295F] text-white">{card.label}</Badge>
                  </div>
                  <p className="mt-5 text-3xl font-black tracking-tight text-slate-900">{formatRankTitle(card.snapshot)}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{formatRankMeta(card.snapshot)}</p>
                  <div className="mt-4 flex items-center justify-between rounded-[1rem] bg-[#F6F8FC] px-3 py-2 text-xs font-bold text-slate-500">
                    <span>{card.meta}</span>
                    <span>{card.snapshot.totalStudents > 0 ? `${card.snapshot.totalStudents}명 집계` : '집계 대기'}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
        <Card className="rounded-[1.75rem] border-none bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.04]">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-[#14295F]">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.18em]">포인트 운영 기준</span>
            </div>
            <div className="mt-4 space-y-3 text-sm font-semibold leading-6 text-slate-600">
              <p>누적 공부시간이 1시간을 넘을 때마다 상자를 적립하고, 상자는 포인트트랙에서 직접 열 수 있어요.</p>
              <p>당일 계획 완료와 출석/루틴 완료는 작은 고정 포인트로 더해지고, 경쟁은 월간 공부시간 랭킹으로만 정리됩니다.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-none bg-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.04]">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-[#14295F]">
              <Trophy className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.18em]">랭킹 보상</span>
            </div>
            <div className="mt-4 space-y-3 text-sm font-semibold leading-6 text-slate-600">
              <p>전날 센터 공부시간 1등은 +1000P, 동점자도 모두 받아요.</p>
              <p>월말에는 공부시간 랭킹 1위 20,000P, 2위 10,000P, 3위 5,000P가 지급됩니다.</p>
            </div>
            <Button asChild variant="outline" className="mt-5 h-11 rounded-[1rem] border-[#D6DDF0] bg-[#F8FAFF] font-black text-[#14295F] hover:bg-[#EEF3FF]">
              <Link href="/dashboard/leaderboards">
                월간 공부 랭킹 보기
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <Dialog open={isVaultDialogOpen} onOpenChange={handleVaultDialogChange}>
        <DialogContent className={cn('overflow-hidden border border-[#223B7A]/10 bg-white p-0', isMobile ? 'w-[min(92vw,27rem)] rounded-[2rem]' : 'sm:max-w-2xl rounded-[2.5rem]')}>
          <div className={cn('bg-[#14295F] text-white', isMobile ? 'p-6' : 'p-8')}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">포인트 상자 보관함</DialogTitle>
              <DialogDescription className="text-white/72 font-bold">
                네이비 보드 위에서 상자를 한 개씩 직접 열어보세요.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className={cn('space-y-5 bg-[radial-gradient(circle_at_top,#eef4ff_0%,#ffffff_72%)]', isMobile ? 'p-5' : 'p-6')}>
            {currentStudyBox ? (
              <>
                <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                  <div className="rounded-[1.2rem] border border-[#D8E2F5] bg-[#F8FAFF] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]/45">현재 포인트 지갑</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">{pointWallet.toLocaleString()}P</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-[#D8E2F5] bg-[#F8FAFF] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]/45">오늘 누적</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">{todayPoints.toLocaleString()}P</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-[#D8E2F5] bg-[#F8FAFF] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]/45">남은 상자</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">
                      {isBoxRevealed ? pendingStudyBoxes.length : Math.max(pendingStudyBoxes.length, 1)}개
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRevealCurrentStudyBox}
                  disabled={isBoxOpening || isBoxRevealed}
                  className="w-full text-left disabled:cursor-default"
                >
                  <PointVaultStage
                    reward={currentStudyBox}
                    isMobile={isMobile}
                    isOpening={isBoxOpening}
                    isRevealed={isBoxRevealed}
                  />
                </button>

                <div className="rounded-[1.25rem] bg-[#F6F8FC] px-4 py-3 text-sm font-semibold leading-6 text-slate-600">
                  {isBoxRevealed
                    ? pendingStudyBoxes.length > 0
                      ? `다음 상자 ${pendingStudyBoxes[0].milestone}시간 상자가 준비됐어요. 이어서 열 수 있어요.`
                      : nextStudyBoxMilestone
                        ? `현재 포인트 지갑 ${pointWallet.toLocaleString()}P · 다음 상자까지 ${formatStudyMinutes(nextStudyBoxMinutesLeft)} 남았어요.`
                        : `현재 포인트 지갑 ${pointWallet.toLocaleString()}P · 오늘의 상자를 모두 열었어요.`
                    : `상자를 터치하면 뚜껑이 열리고 보상이 공개돼요. 보상은 이미 적립됐고, 지금은 오픈 연출만 진행됩니다.`}
                </div>

                <DialogFooter className={cn('p-0', isMobile ? 'flex-col' : 'items-center')}>
                  {isBoxRevealed ? (
                    <Button
                      type="button"
                      onClick={pendingStudyBoxes.length > 0 ? handleNextStudyBox : () => handleVaultDialogChange(false)}
                      className="h-12 w-full rounded-[1rem] bg-[#14295F] font-black text-white hover:bg-[#10214D]"
                    >
                      {pendingStudyBoxes.length > 0 ? '다음 상자 열기' : '보관함 닫기'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => handleVaultDialogChange(false)}
                      variant="outline"
                      className="h-12 w-full rounded-[1rem] border-[#D6DFF1] bg-white font-black text-[#14295F]"
                    >
                      다음에 열기
                    </Button>
                  )}
                </DialogFooter>
              </>
            ) : (
              <>
                <PointVaultStage reward={previewStudyBox} isMobile={isMobile} empty />
                <div className="rounded-[1.25rem] bg-[#F6F8FC] px-4 py-3 text-sm font-semibold leading-6 text-slate-600">
                  아직 열 수 있는 상자가 없어요. {nextStudyBoxMilestone ? `다음 상자까지 ${formatStudyMinutes(nextStudyBoxMinutesLeft)} 남았어요.` : '오늘은 모든 상자를 이미 열었어요.'}
                </div>
                <DialogFooter className="p-0">
                  <Button
                    type="button"
                    onClick={() => handleVaultDialogChange(false)}
                    className="h-12 w-full rounded-[1rem] bg-[#14295F] font-black text-white hover:bg-[#10214D]"
                  >
                    확인했어요
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
