'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { format, subDays } from 'date-fns';
import {
  collection,
  doc,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Flame,
  Gift,
  MessageCircle,
  Sparkles,
  Timer,
  Trophy,
  Wallet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppContext } from '@/contexts/app-context';
import { useCollection, useDoc, useFirestore, useUser } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { GrowthProgress, LeaderboardEntry, StudyLogDay } from '@/lib/types';
import { cn } from '@/lib/utils';

type BoxState = 'locked' | 'charging' | 'ready' | 'opened';
type BoxRarity = 'common' | 'rare' | 'epic';
type BoxStage = 'idle' | 'shake' | 'burst' | 'revealed';

type BoxCurve = {
  min: number;
  max: number;
  rarity: BoxRarity;
};

type RewardBox = {
  id: string;
  hour: number;
  state: BoxState;
  rarity: BoxRarity;
  reward?: number;
};

const BOX_CURVES: Record<number, BoxCurve> = {
  1: { min: 10, max: 20, rarity: 'common' },
  2: { min: 15, max: 25, rarity: 'common' },
  3: { min: 20, max: 30, rarity: 'common' },
  4: { min: 25, max: 35, rarity: 'rare' },
  5: { min: 30, max: 40, rarity: 'rare' },
  6: { min: 35, max: 45, rarity: 'rare' },
  7: { min: 40, max: 50, rarity: 'epic' },
  8: { min: 45, max: 55, rarity: 'epic' },
};

const FORTUNE_MESSAGES = [
  '오늘은 한 상자만 열어도 흐름이 붙어요.',
  '집중이 붙는 날이에요. 1시간만 넘겨보세요.',
  '짧게 시작해도 상자가 기다리고 있어요.',
  '오늘은 꾸준함이 포인트로 바로 바뀌어요.',
  '지금 시작하면 다음 상자까지 더 빨라져요.',
  '작은 몰입이 큰 보상으로 이어지는 날이에요.',
  '한 시간만 더 채우면 리듬이 완전히 살아나요.',
];

function formatStudyMinutes(minutes: number) {
  if (minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatCompactProgress(current: number, total: number) {
  return `${current} / ${total} min`;
}

function formatRankTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins}분`;
  return `${hours}시간 ${mins}분`;
}

function getTodayKey() {
  return format(new Date(), 'yyyy-MM-dd');
}

function getFortuneMessage(studentId: string | undefined, todayKey: string) {
  const seed = `${studentId || 'student'}-${todayKey}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 2147483647;
  }
  return FORTUNE_MESSAGES[Math.abs(hash) % FORTUNE_MESSAGES.length];
}

function getRewardRange(hour: number, statAverage: number) {
  const curve = BOX_CURVES[hour] || BOX_CURVES[1];
  const skillBoost = 1 + Math.min(0.2, (statAverage / 100) * 0.2);
  return {
    min: Math.round(curve.min * skillBoost),
    max: Math.round(curve.max * skillBoost),
    rarity: curve.rarity,
  };
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildRewardBoxes({
  earnedHours,
  openedHours,
  storedRewards,
}: {
  earnedHours: number;
  openedHours: number[];
  storedRewards: Record<string, number>;
}) {
  const openedSet = new Set(openedHours);
  const cappedEarned = Math.min(8, Math.max(0, earnedHours));
  const nextHour = Math.min(8, cappedEarned + 1);

  return Array.from({ length: 8 }, (_, index) => {
    const hour = index + 1;
    const range = BOX_CURVES[hour];
    const state: BoxState = openedSet.has(hour)
      ? 'opened'
      : hour <= cappedEarned
        ? 'ready'
        : hour === nextHour && cappedEarned < 8
          ? 'charging'
          : 'locked';

    return {
      id: `point-box-${hour}`,
      hour,
      state,
      rarity: range.rarity,
      reward: storedRewards[String(hour)],
    } satisfies RewardBox;
  });
}

function RewardHeroChest({
  state,
  stage,
  label,
  onClick,
}: {
  state: 'ready' | 'charging';
  stage?: BoxStage;
  label: string;
  onClick?: () => void;
}) {
  const isReady = state === 'ready';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isReady || !onClick}
      className={cn(
        'point-track-hero-box',
        isReady ? 'point-track-hero-box--ready' : 'point-track-hero-box--charging',
        stage === 'shake' && 'point-track-hero-box--shake',
        stage === 'burst' && 'point-track-hero-box--burst',
        stage === 'revealed' && 'point-track-hero-box--revealed'
      )}
    >
      <div className="point-track-hero-box__glow" />
      <div className="point-track-hero-box__shadow" />
      <div className="point-track-hero-box__body">
        <div className="point-track-hero-box__lid" />
        <div className="point-track-hero-box__lock" />
        <div className="point-track-hero-box__shine" />
        <div className="point-track-hero-box__spark point-track-hero-box__spark--left" />
        <div className="point-track-hero-box__spark point-track-hero-box__spark--right" />
      </div>
      <span className="sr-only">{label}</span>
    </button>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accentClass,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  accentClass: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.06] px-3 py-3.5 shadow-[0_14px_32px_-24px_rgba(0,0,0,0.55)] backdrop-blur-xl">
      <div className="mb-2 flex items-center gap-2">
        <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10', accentClass)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">{label}</span>
      </div>
      <div className="text-[1.05rem] font-black tracking-tight text-white">{value}</div>
    </div>
  );
}

function InventorySlot({
  box,
  onSelect,
}: {
  box: RewardBox;
  onSelect: (hour: number) => void;
}) {
  const rarityClass =
    box.rarity === 'epic'
      ? 'point-track-slot--epic'
      : box.rarity === 'rare'
        ? 'point-track-slot--rare'
        : 'point-track-slot--common';

  return (
    <button
      type="button"
      disabled={box.state !== 'ready'}
      onClick={() => onSelect(box.hour)}
      className={cn(
        'point-track-slot',
        rarityClass,
        box.state === 'ready' && 'point-track-slot--ready',
        box.state === 'charging' && 'point-track-slot--charging',
        box.state === 'opened' && 'point-track-slot--opened',
        box.state === 'locked' && 'point-track-slot--locked'
      )}
    >
      <div className="point-track-slot__box">
        <div className="point-track-slot__lid" />
        <div className="point-track-slot__lock" />
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-white/55">
        <span>{box.hour}h</span>
        <span>
          {box.state === 'opened'
            ? 'done'
            : box.state === 'ready'
              ? 'open'
              : box.state === 'charging'
                ? 'soon'
                : 'lock'}
        </span>
      </div>
    </button>
  );
}

function PodiumCard({
  rank,
  name,
  value,
  highlight = false,
}: {
  rank: number;
  name: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-end rounded-[1.4rem] border px-3 pb-4 pt-3 text-center shadow-[0_18px_42px_-30px_rgba(0,0,0,0.45)]',
        highlight ? 'border-orange-300/35 bg-orange-300/12' : 'border-white/10 bg-white/[0.05]'
      )}
    >
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-black text-white/80">
        #{rank}
      </div>
      <div className={cn('text-sm font-black tracking-tight', highlight && 'text-orange-100')}>{name}</div>
      <div className="mt-1 text-xs font-bold text-white/55">{value}</div>
    </div>
  );
}

export default function GrowthPage() {
  const { user } = useUser();
  const { activeMembership, viewMode } = useAppContext();
  const firestore = useFirestore();
  const isMobile = viewMode === 'mobile';
  const todayKey = getTodayKey();
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

  const leaderboardEntryRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_lp`, 'entries', user.uid);
  }, [firestore, activeMembership?.id, periodKey, user?.uid]);
  const { data: ownRankEntry } = useDoc<LeaderboardEntry>(leaderboardEntryRef);

  const leaderboardTopQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_lp`, 'entries'),
      orderBy('value', 'desc'),
      limit(12)
    );
  }, [firestore, activeMembership?.id, periodKey]);
  const { data: leaderboardTopRaw } = useCollection<LeaderboardEntry>(leaderboardTopQuery);

  const todayLog = useMemo(() => {
    return (seasonStudyLogs || []).find((log) => log.dateKey === todayKey) || null;
  }, [seasonStudyLogs, todayKey]);

  const todayMinutes = Math.max(0, Number(todayLog?.totalMinutes || 0));
  const weeklyMinutes = useMemo(() => {
    const keys = new Set(Array.from({ length: 7 }, (_, index) => format(subDays(new Date(), index), 'yyyy-MM-dd')));
    return (seasonStudyLogs || [])
      .filter((log) => keys.has(log.dateKey))
      .reduce((sum, log) => sum + Math.max(0, Number(log.totalMinutes || 0)), 0);
  }, [seasonStudyLogs]);
  const monthlyMinutes = useMemo(() => {
    return (seasonStudyLogs || [])
      .filter((log) => log.dateKey.startsWith(periodKey))
      .reduce((sum, log) => sum + Math.max(0, Number(log.totalMinutes || 0)), 0);
  }, [seasonStudyLogs, periodKey]);

  const statAverage = useMemo(() => {
    const values = [
      Number(progress?.stats?.focus || 0),
      Number(progress?.stats?.consistency || 0),
      Number(progress?.stats?.achievement || 0),
      Number(progress?.stats?.resilience || 0),
    ];
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [progress?.stats]);

  const todayStatus = useMemo(() => {
    return ((progress?.dailyLpStatus || {})[todayKey] || {}) as Record<string, any>;
  }, [progress?.dailyLpStatus, todayKey]);

  const persistedClaimedBoxes = useMemo(() => {
    return Array.isArray(todayStatus.claimedPointBoxes)
      ? todayStatus.claimedPointBoxes
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value >= 1 && value <= 8)
      : [];
  }, [todayStatus.claimedPointBoxes]);

  const persistedRewards = useMemo(() => {
    const rewards = todayStatus.pointBoxRewards;
    if (!rewards || typeof rewards !== 'object') return {} as Record<string, number>;
    return Object.entries(rewards).reduce<Record<string, number>>((acc, [key, value]) => {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) acc[key] = numeric;
      return acc;
    }, {});
  }, [todayStatus.pointBoxRewards]);

  const [claimedBoxes, setClaimedBoxes] = useState<number[]>(persistedClaimedBoxes);
  const [rewardMap, setRewardMap] = useState<Record<string, number>>(persistedRewards);
  const [pointBalance, setPointBalance] = useState<number>(Math.max(0, Number(progress?.seasonLp || 0)));
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [selectedBoxHour, setSelectedBoxHour] = useState<number | null>(null);
  const [boxStage, setBoxStage] = useState<BoxStage>('idle');
  const [revealedReward, setRevealedReward] = useState<number | null>(null);
  const [isClaimingBox, setIsClaimingBox] = useState(false);
  const timeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    setClaimedBoxes(persistedClaimedBoxes);
  }, [persistedClaimedBoxes]);

  useEffect(() => {
    setRewardMap(persistedRewards);
  }, [persistedRewards]);

  useEffect(() => {
    setPointBalance(Math.max(0, Number(progress?.seasonLp || 0)));
  }, [progress?.seasonLp]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, []);

  const earnedBoxes = Math.min(8, Math.floor(todayMinutes / 60));
  const currentCycleMinutes = earnedBoxes >= 8 ? 60 : todayMinutes % 60;
  const nextBoxMinutesLeft = earnedBoxes >= 8 ? 0 : Math.max(0, 60 - currentCycleMinutes);
  const progressPercent = earnedBoxes >= 8 ? 100 : Math.max(6, (currentCycleMinutes / 60) * 100);

  const boxes = useMemo(
    () =>
      buildRewardBoxes({
        earnedHours: earnedBoxes,
        openedHours: claimedBoxes,
        storedRewards: rewardMap,
      }),
    [earnedBoxes, claimedBoxes, rewardMap]
  );

  const readyBoxes = boxes.filter((box) => box.state === 'ready');
  const topEntries = useMemo(() => {
    return (leaderboardTopRaw || [])
      .filter((entry) => typeof entry.studentId === 'string' && !entry.studentId.toLowerCase().startsWith('test-'))
      .slice(0, 3);
  }, [leaderboardTopRaw]);

  const myRankLabel = ownRankEntry?.rank ? `#${ownRankEntry.rank}` : '집계중';
  const todayPointGain = Object.values(rewardMap).reduce((sum, value) => sum + Number(value || 0), 0);
  const fortuneMessage = getFortuneMessage(user?.uid, todayKey);
  const totalAvailableBoxes = readyBoxes.length;

  const selectedBox = selectedBoxHour
    ? boxes.find((box) => box.hour === selectedBoxHour) || null
    : null;

  const openVault = (hour?: number) => {
    if (totalAvailableBoxes <= 0) return;
    const targetHour = hour || readyBoxes[0]?.hour;
    if (!targetHour) return;
    setSelectedBoxHour(targetHour);
    setBoxStage('idle');
    setRevealedReward(null);
    setIsVaultOpen(true);
  };

  const resetRevealState = () => {
    timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutsRef.current = [];
    setBoxStage('idle');
    setRevealedReward(null);
    setIsClaimingBox(false);
  };

  const handleVaultChange = (open: boolean) => {
    setIsVaultOpen(open);
    if (!open) {
      resetRevealState();
      setSelectedBoxHour(null);
    }
  };

  const handleRevealBox = async () => {
    if (!selectedBox || selectedBox.state !== 'ready' || isClaimingBox || !progressRef || !user || !activeMembership || !firestore) return;

    setIsClaimingBox(true);
    setBoxStage('shake');

    const shakeTimeout = setTimeout(() => {
      setBoxStage('burst');
    }, 380);
    timeoutsRef.current.push(shakeTimeout);

    const revealTimeout = setTimeout(async () => {
      try {
        const storedReward = rewardMap[String(selectedBox.hour)];
        const { min, max } = getRewardRange(selectedBox.hour, statAverage);
        const reward = Number.isFinite(storedReward) ? storedReward : randomBetween(min, max);

        const nextClaimedBoxes = Array.from(new Set([...claimedBoxes, selectedBox.hour])).sort((a, b) => a - b);
        const nextRewardMap = { ...rewardMap, [String(selectedBox.hour)]: reward };
        const nextPointBalance = pointBalance + reward;

        setClaimedBoxes(nextClaimedBoxes);
        setRewardMap(nextRewardMap);
        setPointBalance(nextPointBalance);

        await updateDoc(progressRef, {
          [`dailyLpStatus.${todayKey}.claimedPointBoxes`]: nextClaimedBoxes,
          [`dailyLpStatus.${todayKey}.pointBoxRewards.${selectedBox.hour}`]: reward,
          seasonLp: increment(reward),
          totalLpEarned: increment(reward),
          updatedAt: serverTimestamp(),
        });

        const rankRef = doc(
          firestore,
          'centers',
          activeMembership.id,
          'leaderboards',
          `${periodKey}_lp`,
          'entries',
          user.uid
        );
        await setDoc(
          rankRef,
          {
            studentId: user.uid,
            displayNameSnapshot: user.displayName || activeMembership.displayName || '학생',
            classNameSnapshot: activeMembership.className || null,
            schoolNameSnapshot: null,
            value: nextPointBalance,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        setRevealedReward(reward);
        setBoxStage('revealed');
      } catch (error) {
        console.error('[point-track] reward box open failed', error);
        setBoxStage('idle');
      } finally {
        setIsClaimingBox(false);
      }
    }, 980);

    timeoutsRef.current.push(revealTimeout);
  };

  const handleNextBox = () => {
    const nextReady = boxes.find((box) => box.state === 'ready' && box.hour !== selectedBoxHour);
    if (!nextReady) {
      handleVaultChange(false);
      return;
    }
    setSelectedBoxHour(nextReady.hour);
    setBoxStage('idle');
    setRevealedReward(null);
  };

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/15 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="point-track-game-screen pb-24">
      <div className={cn('mx-auto flex w-full max-w-md flex-col gap-4', isMobile ? 'px-0' : 'px-1')}>
        <section className="point-track-hero-stage">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/45">POINT TRACK</p>
              <h1 className="mt-2 text-[2rem] font-black tracking-tight text-white">포인트트랙</h1>
            </div>
            <Link
              href="/dashboard/appointments/inquiries"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/75 shadow-[0_14px_28px_-18px_rgba(0,0,0,0.55)]"
            >
              <MessageCircle className="h-4 w-4" />
            </Link>
          </div>

          <div className="relative mt-5 flex flex-col items-center gap-4">
            <RewardHeroChest
              state={totalAvailableBoxes > 0 ? 'ready' : 'charging'}
              label={totalAvailableBoxes > 0 ? '지금 열기' : `${nextBoxMinutesLeft}분 남음`}
              onClick={totalAvailableBoxes > 0 ? () => openVault() : undefined}
            />

            <div className="text-center">
              <p className="text-sm font-black text-orange-200/90">{totalAvailableBoxes > 0 ? '지금 열기' : '다음 상자'}</p>
              <div className="mt-1 text-[2rem] font-black tracking-tight text-white">
                {totalAvailableBoxes > 0 ? `${totalAvailableBoxes}개 대기 중` : `${nextBoxMinutesLeft}분 남음`}
              </div>
              <p className="mt-1 text-xs font-bold text-white/45">
                {totalAvailableBoxes > 0 ? '한 개씩 눌러서 열어보세요' : '1시간 누적마다 상자가 열려요'}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[1.7rem] border border-white/10 bg-white/[0.06] px-4 py-4 shadow-[0_18px_44px_-30px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-orange-200" />
              <span className="text-sm font-black text-white">다음 상자</span>
            </div>
            <span className="text-sm font-black text-white/70">{formatCompactProgress(currentCycleMinutes, 60)}</span>
          </div>
          <div className="rounded-full bg-white/10 p-1">
            <div className="point-track-progress-track">
              <div className="point-track-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] font-black text-white/48">
            <span>0분</span>
            <span>1시간 상자</span>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <StatCard icon={Flame} label="오늘 공부" value={formatStudyMinutes(todayMinutes)} accentClass="text-orange-200" />
          <StatCard icon={Gift} label="열 수 있는 상자" value={`${totalAvailableBoxes}`} accentClass="text-sky-200" />
          <StatCard icon={Wallet} label="총 포인트" value={pointBalance.toLocaleString()} accentClass="text-amber-200" />
        </section>

        <section className="rounded-[1.8rem] border border-white/10 bg-white/[0.06] px-4 py-4 shadow-[0_20px_52px_-34px_rgba(0,0,0,0.54)] backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/45">VAULT</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-white">보관함</h2>
            </div>
            <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-black text-orange-100">
              +{todayPointGain} 오늘
            </div>
          </div>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {boxes.map((box) => (
              <InventorySlot key={box.id} box={box} onSelect={openVault} />
            ))}
          </div>
        </section>

        <section className="rounded-[1.8rem] border border-white/10 bg-white/[0.06] px-4 py-4 shadow-[0_20px_52px_-34px_rgba(0,0,0,0.54)] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/45">LEADERBOARD</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-white">이번 달 TOP</h2>
            </div>
            <Link
              href="/dashboard/leaderboards"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-black text-white/75"
            >
              더 보기
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {topEntries.length > 0 ? (
              topEntries.map((entry, index) => (
                <PodiumCard
                  key={entry.id}
                  rank={index + 1}
                  name={entry.displayNameSnapshot || '학생'}
                  value={entry.value.toLocaleString()}
                  highlight={index === 0}
                />
              ))
            ) : (
              <>
                <PodiumCard rank={2} name="준비중" value="--" />
                <PodiumCard rank={1} name="랭킹" value="--" highlight />
                <PodiumCard rank={3} name="준비중" value="--" />
              </>
            )}
          </div>

          <div className="mt-4 rounded-[1.35rem] border border-white/10 bg-black/15 px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">MY RANK</p>
                <p className="mt-1 text-[1.35rem] font-black tracking-tight text-white">{myRankLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">MONTH</p>
                <p className="mt-1 text-sm font-black text-orange-100">{formatRankTime(monthlyMinutes)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-full border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white/85 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-300/20 text-orange-100">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          {fortuneMessage}
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] px-4 py-4 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">이번 주</p>
            <p className="mt-2 text-[1.2rem] font-black tracking-tight text-white">{formatStudyMinutes(weeklyMinutes)}</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] px-4 py-4 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">이번 달</p>
            <p className="mt-2 text-[1.2rem] font-black tracking-tight text-white">{formatStudyMinutes(monthlyMinutes)}</p>
          </div>
        </section>

        <Link
          href="/dashboard/appointments/inquiries"
          className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.05))] px-4 py-4 shadow-[0_20px_48px_-34px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">REWARD SHOP</p>
              <p className="mt-2 text-base font-black tracking-tight text-white">갖고 싶은 선물 문의</p>
              <p className="mt-1 text-xs font-bold text-white/50">카카오톡 선물하기 상품을 센터 관리자에게 문의할 수 있어요.</p>
            </div>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-300/20 text-orange-100">
              <MessageCircle className="h-5 w-5" />
            </div>
          </div>
        </Link>
      </div>

      <Dialog open={isVaultOpen} onOpenChange={handleVaultChange}>
        <DialogContent className="w-[min(92vw,24rem)] overflow-hidden rounded-[2rem] border-none bg-[linear-gradient(180deg,#14295F_0%,#0d1c45_100%)] p-0 shadow-[0_40px_100px_-36px_rgba(0,0,0,0.78)]">
          <div className="point-track-modal-shell">
            <DialogHeader className="px-5 pb-0 pt-5">
              <DialogTitle className="text-left text-xl font-black tracking-tight text-white">포인트 상자 오픈</DialogTitle>
              <DialogDescription className="text-left text-sm font-bold text-white/55">
                한 개씩 눌러서 열어보세요.
              </DialogDescription>
            </DialogHeader>

            <div className="px-5 pb-5 pt-4">
              <div className="point-track-modal-stage">
                <RewardHeroChest
                  state={selectedBox?.state === 'ready' ? 'ready' : 'charging'}
                  stage={boxStage}
                  label={selectedBox ? `${selectedBox.hour}시간 상자` : '상자'}
                  onClick={selectedBox?.state === 'ready' ? handleRevealBox : undefined}
                />

                <div className="mt-4 text-center">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/45">
                    {selectedBox ? `${selectedBox.hour}시간 상자` : '상자'}
                  </p>
                  {boxStage === 'revealed' && revealedReward !== null ? (
                    <div className="point-track-reward-burst">
                      <p className="text-[2.4rem] font-black tracking-tight text-orange-100">+{revealedReward}</p>
                      <p className="mt-1 text-xs font-black text-white/55">현재 포인트 {pointBalance.toLocaleString()}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm font-black text-white/78">
                      {selectedBox?.state === 'ready' ? '터치해서 열기' : '다음 상자를 준비 중이에요'}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-white/[0.05] px-4 py-4">
                <div className="flex items-center justify-between text-sm font-black text-white/78">
                  <span>오늘 획득</span>
                  <span>{todayPointGain.toLocaleString()}P</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs font-bold text-white/45">
                  <span>다음 상자까지</span>
                  <span>{earnedBoxes >= 8 ? '오늘 상자 완료' : `${nextBoxMinutesLeft}분`}</span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                {boxStage === 'revealed' && readyBoxes.filter((box) => box.hour !== selectedBoxHour).length > 0 ? (
                  <Button
                    className="h-12 flex-1 rounded-[1.2rem] bg-[linear-gradient(180deg,#ffb24d_0%,#ff8a20_100%)] text-sm font-black text-white hover:brightness-105"
                    onClick={handleNextBox}
                  >
                    다음 상자 열기
                  </Button>
                ) : (
                  <Button
                    className="h-12 flex-1 rounded-[1.2rem] bg-[linear-gradient(180deg,#ffb24d_0%,#ff8a20_100%)] text-sm font-black text-white hover:brightness-105"
                    onClick={selectedBox?.state === 'ready' && boxStage === 'idle' ? handleRevealBox : () => handleVaultChange(false)}
                    disabled={isClaimingBox}
                  >
                    {selectedBox?.state === 'ready' && boxStage === 'idle' ? '지금 열기' : '확인했어요'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
