'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
} from 'firebase/firestore';
import {
  ChevronRight,
  Crown,
  Flame,
  Gift,
  Lock,
  Sparkles,
  Star,
  Timer,
  Wallet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppContext } from '@/contexts/app-context';
import { useCollection, useDoc, useFirestore, useUser } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useToast } from '@/hooks/use-toast';
import { getAvailableStudyBoxMilestones, getClaimedStudyBoxes, rollStudyBoxReward, type StudyBoxReward } from '@/lib/student-rewards';
import { GrowthProgress, LeaderboardEntry, StudyLogDay } from '@/lib/types';
import { cn } from '@/lib/utils';

type BoxState = 'locked' | 'charging' | 'ready' | 'opened';
type BoxRarity = 'common' | 'rare' | 'epic';
type BoxStage = 'idle' | 'shake' | 'burst' | 'revealed';

type RewardBox = {
  id: string;
  hour: number;
  state: BoxState;
  rarity: BoxRarity;
  reward?: number;
};

type FloatingGain = {
  key: number;
  amount: number;
};

const BOX_RARITIES: Record<number, BoxRarity> = {
  1: 'common',
  2: 'common',
  3: 'common',
  4: 'rare',
  5: 'rare',
  6: 'rare',
  7: 'epic',
  8: 'epic',
};

const RARITY_LABELS: Record<BoxRarity, string> = {
  common: '커먼',
  rare: '레어',
  epic: '에픽',
};

function formatStudyMinutes(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours <= 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

function formatStudyMinutesShort(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}.${Math.round((mins / 60) * 10)}h`;
}

function formatProgressCounter(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')} / 60:00`;
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

function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}분 ${secs.toString().padStart(2, '0')}초`;
}

function formatHeroTimer(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const mins = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function coerceStudyBoxRewards(dayStatus: Record<string, any>): StudyBoxReward[] {
  const raw = Array.isArray(dayStatus.studyBoxRewards) ? dayStatus.studyBoxRewards : [];
  return raw
    .map((entry) => {
      const milestone = Number(entry?.milestone);
      const minReward = Number(entry?.minReward);
      const maxReward = Number(entry?.maxReward);
      const awardedPoints = Number(entry?.awardedPoints);
      const multiplier = Number(entry?.multiplier ?? 1);
      if (!Number.isFinite(milestone) || milestone < 1 || milestone > 8) return null;
      if (!Number.isFinite(minReward) || !Number.isFinite(maxReward) || !Number.isFinite(awardedPoints)) return null;
      return {
        milestone,
        minReward,
        maxReward,
        awardedPoints,
        multiplier: Number.isFinite(multiplier) ? multiplier : 1,
      } satisfies StudyBoxReward;
    })
    .filter((entry): entry is StudyBoxReward => Boolean(entry))
    .sort((a, b) => a.milestone - b.milestone);
}

function buildRewardBoxes({
  earnedHours,
  claimedHours,
  openedHours,
  rewardByHour,
}: {
  earnedHours: number;
  claimedHours: number[];
  openedHours: number[];
  rewardByHour: Map<number, StudyBoxReward>;
}) {
  const claimedSet = new Set(claimedHours);
  const openedSet = new Set(openedHours);
  const cappedEarned = Math.min(8, Math.max(0, earnedHours));
  const nextHour = Math.min(8, cappedEarned + 1);

  return Array.from({ length: 8 }, (_, index) => {
    const hour = index + 1;
    const state: BoxState = openedSet.has(hour)
      ? 'opened'
      : claimedSet.has(hour)
        ? 'ready'
      : hour === nextHour && cappedEarned < 8
          ? 'charging'
          : 'locked';

    return {
      id: `point-box-${hour}`,
      hour,
      state,
      rarity: BOX_RARITIES[hour] || 'common',
      reward: rewardByHour.get(hour)?.awardedPoints,
    } satisfies RewardBox;
  });
}

function RewardHeroChest({
  state,
  stage,
  label,
  intense = false,
  onClick,
}: {
  state: 'ready' | 'charging';
  stage?: BoxStage;
  label: string;
  intense?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'point-track-hero-box',
        state === 'ready' ? 'point-track-hero-box--ready' : 'point-track-hero-box--charging',
        intense && 'point-track-hero-box--intense',
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

function RewardCountUp({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frameId = 0;
    const duration = 780;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * eased));
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    setDisplayValue(0);
    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return <>{displayValue.toLocaleString()}</>;
}

function HeroMetricChip({
  icon: Icon,
  label,
  value,
  accentClass,
  floatingGain,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  accentClass: string;
  floatingGain?: FloatingGain | null;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-[1.35rem] border border-[#FFE0B7]/14 bg-[linear-gradient(180deg,rgba(11,24,58,0.95),rgba(23,58,130,0.84))] px-3 py-3 shadow-[0_18px_30px_-24px_rgba(0,0,0,0.58)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-[radial-gradient(circle_at_top,rgba(255,208,137,0.18),transparent_72%)]" />
      {floatingGain ? (
        <div key={floatingGain.key} className="point-track-floating-gain">
          +{floatingGain.amount}P
        </div>
      ) : null}
      <div className="flex items-center gap-2.5">
        <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 shadow-[0_10px_20px_-14px_rgba(0,0,0,0.45)]', accentClass)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-white/72">{label}</div>
          <div className="mt-1 truncate text-[0.98rem] font-black tracking-[-0.04em] text-white sm:text-[1.2rem]">{value}</div>
        </div>
      </div>
    </div>
  );
}

function InventorySlot({
  box,
  onSelect,
  chargingLabel,
  chargingPercent,
  isFresh,
}: {
  box: RewardBox;
  onSelect: (hour: number) => void;
  chargingLabel?: string;
  chargingPercent?: number;
  isFresh?: boolean;
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
        box.state === 'locked' && 'point-track-slot--locked',
        isFresh && 'point-track-slot--fresh'
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            'rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em]',
            box.rarity === 'epic'
              ? 'bg-violet-300/18 text-violet-100'
              : box.rarity === 'rare'
                ? 'bg-orange-300/18 text-orange-100'
                : 'bg-sky-200/14 text-sky-100'
          )}
        >
          {RARITY_LABELS[box.rarity]}
        </span>
        {box.state === 'ready' ? (
          <Star className="h-3.5 w-3.5 text-orange-100" />
        ) : box.state === 'locked' ? (
          <Lock className="h-3.5 w-3.5 text-white/35" />
        ) : null}
      </div>
      <div className="point-track-slot__box">
        <div className="point-track-slot__lid" />
        <div className="point-track-slot__lock" />
      </div>
      <div className="mt-3">
        <div className="text-[11px] font-black tracking-tight text-white">{box.hour}시간 상자</div>
        {box.state === 'charging' ? (
          <>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="point-track-slot__meter-fill" style={{ width: `${Math.max(4, Math.min(100, chargingPercent || 0))}%` }} />
            </div>
            <div className="mt-1 text-[10px] font-black text-white/55">{chargingLabel}</div>
          </>
        ) : (
          <div className="mt-1 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-white/55">
            <span>
              {box.state === 'opened'
                ? `+${box.reward || 0}P`
                : box.state === 'ready'
                  ? 'READY'
                  : 'LOCK'}
            </span>
            <span>{box.state === 'opened' ? '완료' : box.state === 'ready' ? '열기' : '잠김'}</span>
          </div>
        )}
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
        'flex flex-col items-center justify-end rounded-[1.55rem] border px-3 pb-4 pt-3 text-center shadow-[0_20px_42px_-28px_rgba(0,0,0,0.48)]',
        highlight
          ? 'border-orange-300/45 bg-[linear-gradient(180deg,rgba(255,176,76,0.2),rgba(255,176,76,0.08))]'
          : 'border-white/10 bg-[linear-gradient(180deg,rgba(12,27,63,0.88),rgba(20,41,95,0.78))]'
      )}
    >
      <div className={cn('mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-black', highlight ? 'bg-orange-300/20 text-orange-100' : 'bg-white/10 text-white/88')}>
        {highlight ? <Crown className="h-4 w-4" /> : `#${rank}`}
      </div>
      <div className={cn('text-sm font-black tracking-tight text-white', highlight && 'text-orange-100')}>{name}</div>
      <div className={cn('mt-1 text-sm font-black', highlight ? 'text-[#FFE2B6]' : 'text-white/82')}>{value}</div>
    </div>
  );
}

export default function GrowthPage() {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { activeMembership, viewMode, isTimerActive, startTime } = useAppContext();
  const firestore = useFirestore();
  const isMobile = viewMode === 'mobile';
  const todayKey = getTodayKey();
  const periodKey = format(new Date(), 'yyyy-MM');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [selectedBoxHour, setSelectedBoxHour] = useState<number | null>(null);
  const [boxStage, setBoxStage] = useState<BoxStage>('idle');
  const [revealedReward, setRevealedReward] = useState<number | null>(null);
  const [isClaimingBox, setIsClaimingBox] = useState(false);
  const [floatingGain, setFloatingGain] = useState<FloatingGain | null>(null);
  const [arrivalEvent, setArrivalEvent] = useState<{ key: number; count: number } | null>(null);
  const [freshReadyHours, setFreshReadyHours] = useState<number[]>([]);
  const [claimedBoxes, setClaimedBoxes] = useState<number[]>([]);
  const [rewardEntries, setRewardEntries] = useState<StudyBoxReward[]>([]);
  const [openedBoxes, setOpenedBoxes] = useState<number[]>([]);
  const [pointBalance, setPointBalance] = useState(0);
  const timeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const liveClaimKeyRef = useRef<string | null>(null);

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
    return doc(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_study-time`, 'entries', user.uid);
  }, [firestore, activeMembership?.id, periodKey, user?.uid]);
  const { data: ownRankEntry } = useDoc<LeaderboardEntry>(leaderboardEntryRef);

  const leaderboardTopQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_study-time`, 'entries'),
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

  const todayStatus = useMemo(() => {
    return ((progress?.dailyPointStatus || {})[todayKey] || {}) as Record<string, any>;
  }, [progress?.dailyPointStatus, todayKey]);

  const persistedClaimedBoxes = useMemo(() => getClaimedStudyBoxes(todayStatus), [todayStatus]);
  const persistedRewardEntries = useMemo(() => coerceStudyBoxRewards(todayStatus), [todayStatus]);
  const persistedOpenedBoxes = useMemo(() => {
    const raw = Array.isArray(todayStatus.openedStudyBoxes) ? todayStatus.openedStudyBoxes : [];
    return raw
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 1 && value <= 8)
      .sort((a, b) => a - b);
  }, [todayStatus]);

  const stats = useMemo(() => {
    const raw = progress?.stats || { focus: 0, consistency: 0, achievement: 0, resilience: 0 };
    return {
      focus: Math.min(100, Number(raw.focus || 0)),
      consistency: Math.min(100, Number(raw.consistency || 0)),
      achievement: Math.min(100, Number(raw.achievement || 0)),
      resilience: Math.min(100, Number(raw.resilience || 0)),
    };
  }, [progress?.stats]);

  useEffect(() => {
    setClaimedBoxes(persistedClaimedBoxes);
  }, [persistedClaimedBoxes]);

  useEffect(() => {
    setRewardEntries(persistedRewardEntries);
  }, [persistedRewardEntries]);

  useEffect(() => {
    setOpenedBoxes(persistedOpenedBoxes);
  }, [persistedOpenedBoxes]);

  useEffect(() => {
    setPointBalance(Math.max(0, Number(progress?.pointsBalance || 0)));
  }, [progress?.pointsBalance]);

  useEffect(() => {
    if (!isTimerActive || !startTime) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isTimerActive, startTime]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, []);

  const liveSessionSeconds = isTimerActive && startTime ? Math.max(0, Math.floor((nowMs - startTime) / 1000)) : 0;
  const liveTodaySeconds = Math.max(0, todayMinutes * 60 + liveSessionSeconds);
  const liveTodayMinutes = Math.floor(liveTodaySeconds / 60);
  const rewardByHour = useMemo(() => {
    const map = new Map<number, StudyBoxReward>();
    rewardEntries.forEach((entry) => {
      map.set(entry.milestone, entry);
    });
    return map;
  }, [rewardEntries]);
  const earnedBoxes = Math.min(8, Math.floor(liveTodaySeconds / 3600));
  const currentCycleSeconds = earnedBoxes >= 8 ? 3600 : liveTodaySeconds % 3600;
  const nextBoxSecondsLeft = earnedBoxes >= 8 ? 0 : Math.max(0, 3600 - currentCycleSeconds);
  const progressPercent = earnedBoxes >= 8 ? 100 : Math.max(4, (currentCycleSeconds / 3600) * 100);
  const isNearNextBox = progressPercent >= 80 && progressPercent < 100;

  const boxes = useMemo(
    () =>
      buildRewardBoxes({
        earnedHours: earnedBoxes,
        claimedHours: claimedBoxes,
        openedHours: openedBoxes,
        rewardByHour,
      }),
    [earnedBoxes, claimedBoxes, openedBoxes, rewardByHour]
  );

  const readyBoxes = boxes.filter((box) => box.state === 'ready');
  const totalAvailableBoxes = readyBoxes.length;
  const todayPointGain = rewardEntries.reduce((sum, reward) => sum + Number(reward.awardedPoints || 0), 0);
  const todayOpenedCount = openedBoxes.length;

  const topEntries = useMemo(() => {
    return (leaderboardTopRaw || [])
      .filter((entry) => typeof entry.studentId === 'string' && !entry.studentId.toLowerCase().startsWith('test-'))
      .slice(0, 3);
  }, [leaderboardTopRaw]);

  const myRankLabel = ownRankEntry?.rank ? `#${ownRankEntry.rank}` : '집계중';
  const heroMode = totalAvailableBoxes > 0 ? 'ready' : isTimerActive ? 'studying' : 'idle';
  const heroPrimaryLabel =
    totalAvailableBoxes > 1
      ? `${totalAvailableBoxes}개 대기`
      : totalAvailableBoxes === 1
        ? '지금 열기'
        : isTimerActive
          ? formatHeroTimer(liveSessionSeconds)
          : formatCountdown(nextBoxSecondsLeft);
  const heroSecondaryLabel =
    totalAvailableBoxes > 0
      ? '보관함에서 한 개씩 열어보세요'
      : isTimerActive
        ? `계속 공부하면 ${formatCountdown(nextBoxSecondsLeft)} 뒤 상자 도착`
        : '공부를 시작하면 누적 1시간마다 상자가 도착해요';
  const heroCtaLabel =
    totalAvailableBoxes > 1
      ? `상자 ${totalAvailableBoxes}개 열기`
      : totalAvailableBoxes === 1
        ? '상자 열기'
        : isTimerActive
          ? `계속 공부 중 · ${formatCountdown(nextBoxSecondsLeft)}`
          : '공부 시작하고 상자 채우기';

  const selectedBox = selectedBoxHour ? boxes.find((box) => box.hour === selectedBoxHour) || null : null;

  useEffect(() => {
    if (!isTimerActive || !progressRef) return;

    const availableMilestones = getAvailableStudyBoxMilestones(liveTodayMinutes, claimedBoxes);
    if (availableMilestones.length === 0) return;

    const claimKey = `${todayKey}:${availableMilestones.join(',')}:${liveTodayMinutes}`;
    if (liveClaimKeyRef.current === claimKey) return;
    liveClaimKeyRef.current = claimKey;

    const nextRewards = availableMilestones.map((milestone) => rollStudyBoxReward(milestone, stats));
    const awardedPoints = nextRewards.reduce((sum, reward) => sum + reward.awardedPoints, 0);
    const nextClaimedBoxes = Array.from(new Set([...claimedBoxes, ...availableMilestones])).sort((a, b) => a - b);
    const nextRewardEntries = [...rewardEntries, ...nextRewards].sort((a, b) => a.milestone - b.milestone);
    const nextDayStatus = {
      ...todayStatus,
      claimedStudyBoxes: nextClaimedBoxes,
      studyBoxRewards: nextRewardEntries,
      dailyPointAmount: Number(todayStatus.dailyPointAmount || 0) + awardedPoints,
    };

    setClaimedBoxes(nextClaimedBoxes);
    setRewardEntries(nextRewardEntries);
    setPointBalance((prev) => prev + awardedPoints);
    setArrivalEvent({ key: Date.now(), count: availableMilestones.length });
    setFreshReadyHours(availableMilestones);

    const clearFresh = setTimeout(() => {
      setFreshReadyHours((prev) => prev.filter((hour) => !availableMilestones.includes(hour)));
    }, 1800);
    timeoutsRef.current.push(clearFresh);

    void setDoc(
      progressRef,
      {
        pointsBalance: increment(awardedPoints),
        totalPointsEarned: increment(awardedPoints),
        dailyPointStatus: {
          [todayKey]: nextDayStatus,
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )
      .then(() => {
        toast({
          title: availableMilestones.length > 1 ? `상자 ${availableMilestones.length}개 도착!` : '상자 도착!',
          description: `+${availableMilestones.length} BOX · 보관함에서 열어보세요.`,
        });
      })
      .catch((error: any) => {
        console.warn('[point-track] live study box claim failed', error?.message || error);
        liveClaimKeyRef.current = null;
        setClaimedBoxes(persistedClaimedBoxes);
        setRewardEntries(persistedRewardEntries);
        setPointBalance(Math.max(0, Number(progress?.pointsBalance || 0)));
        setFreshReadyHours([]);
      });
  }, [
    claimedBoxes,
    isTimerActive,
    liveTodayMinutes,
    persistedClaimedBoxes,
    persistedRewardEntries,
    progress?.pointsBalance,
    progressRef,
    rewardEntries,
    stats,
    todayKey,
    todayStatus,
    toast,
  ]);

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
    if (!selectedBox || selectedBox.state !== 'ready' || isClaimingBox || !progressRef) return;

    setIsClaimingBox(true);
    setBoxStage('shake');

    const shakeTimeout = setTimeout(() => {
      setBoxStage('burst');
    }, 380);
    timeoutsRef.current.push(shakeTimeout);

    const revealTimeout = setTimeout(async () => {
      try {
        const reward = rewardByHour.get(selectedBox.hour)?.awardedPoints ?? selectedBox.reward ?? 0;
        const nextOpenedBoxes = Array.from(new Set([...openedBoxes, selectedBox.hour])).sort((a, b) => a - b);

        setOpenedBoxes(nextOpenedBoxes);
        await setDoc(
          progressRef,
          {
            dailyPointStatus: {
              [todayKey]: {
                ...todayStatus,
                claimedStudyBoxes: claimedBoxes,
                studyBoxRewards: rewardEntries,
                openedStudyBoxes: nextOpenedBoxes,
              },
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        setRevealedReward(reward);
        setBoxStage('revealed');
        setFloatingGain({ key: Date.now(), amount: reward });

        const clearFloating = setTimeout(() => {
          setFloatingGain(null);
        }, 1800);
        timeoutsRef.current.push(clearFloating);
      } catch (error) {
        console.error('[point-track] reward box open failed', error);
        setOpenedBoxes(persistedOpenedBoxes);
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

  const handleHeroCta = () => {
    if (totalAvailableBoxes > 0) {
      openVault();
      return;
    }
    router.push('/dashboard');
  };

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/15 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="point-track-game-screen pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[max(0.35rem,env(safe-area-inset-top))]">
      <div className={cn('mx-auto flex w-full max-w-md flex-col gap-4', isMobile ? 'px-3' : 'px-1')}>
        <section className={cn('point-track-hero-stage', arrivalEvent && 'point-track-hero-stage--arrival')}>
          {arrivalEvent ? (
            <div key={arrivalEvent.key} className="point-track-arrival-banner">
              +{arrivalEvent.count} BOX
            </div>
          ) : null}

          <div className={cn("gap-4", isMobile ? "flex flex-col" : "flex items-center justify-between gap-3")}>
            <div className={cn(isMobile ? "w-full" : "")}>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-white/45">POINT TRACK</p>
              <h1 className="mt-2 text-[2rem] font-black tracking-tight text-white">포인트트랙</h1>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <HeroMetricChip
                  icon={Flame}
                  label="오늘 공부"
                  value={formatStudyMinutesShort(liveTodayMinutes)}
                  accentClass="text-orange-200"
                />
                <HeroMetricChip
                  icon={Wallet}
                  label="포인트"
                  value={`${pointBalance.toLocaleString()}P`}
                  accentClass="text-amber-200"
                  floatingGain={floatingGain}
                />
              </div>
            </div>
            <div
              className={cn(
                'rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em]',
                isMobile ? "self-start" : "",
                totalAvailableBoxes > 0
                  ? 'border border-orange-300/25 bg-orange-300/12 text-[#FFD089]'
                  : isTimerActive
                    ? 'border border-sky-200/20 bg-sky-200/10 text-white/80'
                    : 'border border-white/10 bg-white/8 text-white/55'
              )}
            >
              {totalAvailableBoxes > 0 ? 'BOX READY' : heroMode === 'studying' ? '집중 중' : '대기'}
            </div>
          </div>

          <div className="relative mt-5 flex flex-col items-center gap-4">
            <RewardHeroChest
              state={totalAvailableBoxes > 0 ? 'ready' : 'charging'}
              stage={boxStage}
              intense={totalAvailableBoxes > 0 || isNearNextBox || Boolean(arrivalEvent)}
              label={totalAvailableBoxes > 0 ? '지금 열기' : `${nextBoxSecondsLeft}초 남음`}
              onClick={totalAvailableBoxes > 0 ? () => openVault() : undefined}
            />

            <div className="text-center">
              <p className="text-sm font-black text-[#FFD089]">
                {totalAvailableBoxes > 0 ? '상자 도착' : heroMode === 'studying' ? '집중 중' : '다음 상자'}
              </p>
              <div className="mt-1 text-[2rem] font-black tracking-tight text-white">{heroPrimaryLabel}</div>
              <p className="mt-1 text-xs font-bold text-white/55">{heroSecondaryLabel}</p>
            </div>

            {isTimerActive ? (
              <div className="grid w-full grid-cols-3 gap-2">
                <div className="rounded-[1.1rem] border border-white/10 bg-white/8 px-3 py-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">상태</p>
                  <p className="mt-2 text-sm font-black text-white">집중 중</p>
                </div>
                <div className="rounded-[1.1rem] border border-white/10 bg-white/8 px-3 py-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">세션</p>
                  <p className="mt-2 text-sm font-black text-white">{formatHeroTimer(liveSessionSeconds)}</p>
                </div>
                <div className="rounded-[1.1rem] border border-white/10 bg-white/8 px-3 py-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">도착</p>
                  <p className="mt-2 text-sm font-black text-[#FFD089]">{totalAvailableBoxes > 0 ? 'OPEN' : formatCountdown(nextBoxSecondsLeft)}</p>
                </div>
              </div>
            ) : null}

            <Button
              type="button"
              onClick={handleHeroCta}
              className={cn(
                'point-track-hero-cta mt-2 h-14 w-full rounded-[1.4rem] text-base font-black text-white',
                totalAvailableBoxes > 0
                  ? 'bg-[linear-gradient(180deg,#ffd089_0%,#ffb357_35%,#ff8a1f_100%)]'
                  : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.08))]'
              )}
            >
              {heroCtaLabel}
            </Button>
          </div>
        </section>

        <section className="rounded-[1.7rem] border border-[#FFE0B7]/12 bg-[linear-gradient(180deg,rgba(11,24,58,0.92),rgba(23,58,130,0.84))] px-4 py-4 shadow-[0_18px_44px_-30px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-[#FFD089]" />
              <span className="text-sm font-black text-white">다음 상자</span>
            </div>
            <div className="flex items-center gap-2">
              {isNearNextBox && totalAvailableBoxes === 0 ? (
                <span className="rounded-full bg-orange-300/14 px-2 py-1 text-[10px] font-black text-[#FFD089]">곧 도착</span>
              ) : null}
              <span className="text-sm font-black text-white/70">{formatProgressCounter(currentCycleSeconds)}</span>
            </div>
          </div>
          <div className="rounded-full bg-[#091633]/68 p-1 ring-1 ring-white/10">
            <div
              className={cn(
                'point-track-progress-track',
                isNearNextBox && totalAvailableBoxes === 0 && 'point-track-progress-track--near',
                arrivalEvent && 'point-track-progress-track--charged'
              )}
            >
              <div className="point-track-progress-fill" style={{ width: `${progressPercent}%` }} />
              <div className="point-track-progress-orb" style={{ left: `calc(${progressPercent}% - 0.65rem)` }} />
              <div className="point-track-progress-node point-track-progress-node--one" />
              <div className="point-track-progress-node point-track-progress-node--two" />
              <div className="point-track-progress-node point-track-progress-node--three" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] font-black text-white/60">
            <span>0분</span>
            <span>{earnedBoxes >= 8 ? '오늘 상자 완료' : `${formatCountdown(nextBoxSecondsLeft)} 남음`}</span>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="rounded-[1.2rem] border border-[#FFE0B7]/12 bg-[linear-gradient(180deg,rgba(12,27,63,0.92),rgba(26,52,117,0.84))] px-3 py-3 text-center backdrop-blur-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/68">오늘 획득</p>
            <p className="mt-2 text-base font-black text-white">+{todayPointGain}P</p>
          </div>
          <div className="rounded-[1.2rem] border border-[#FFE0B7]/12 bg-[linear-gradient(180deg,rgba(12,27,63,0.92),rgba(26,52,117,0.84))] px-3 py-3 text-center backdrop-blur-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/68">연 상자</p>
            <p className="mt-2 text-base font-black text-white">{todayOpenedCount}개</p>
          </div>
          <div className="rounded-[1.2rem] border border-[#FFBE73]/24 bg-[radial-gradient(circle_at_top,rgba(255,176,76,0.2),transparent_62%),linear-gradient(180deg,rgba(18,43,103,0.96),rgba(39,73,151,0.92))] px-3 py-3 text-center backdrop-blur-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FFE1B7]">이번 달</p>
            <p className="mt-2 text-base font-black text-[#FFD089]">{formatStudyMinutesShort(monthlyMinutes)}</p>
          </div>
        </section>

        <section className="rounded-[1.8rem] border border-[#FFE0B7]/12 bg-[linear-gradient(180deg,rgba(12,27,63,0.93),rgba(20,41,95,0.84))] px-4 py-4 shadow-[0_20px_52px_-34px_rgba(0,0,0,0.54)] backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/58">VAULT</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-white">보관함</h2>
            </div>
            <div className="rounded-full border border-orange-300/25 bg-orange-300/10 px-3 py-1 text-[11px] font-black text-[#FFD089]">
              READY {totalAvailableBoxes}
            </div>
          </div>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {boxes.map((box) => (
              <InventorySlot
                key={box.id}
                box={box}
                onSelect={openVault}
                chargingLabel={box.state === 'charging' ? `${Math.round(progressPercent)}% · ${formatCountdown(nextBoxSecondsLeft)}` : undefined}
                chargingPercent={box.state === 'charging' ? progressPercent : undefined}
                isFresh={freshReadyHours.includes(box.hour)}
              />
            ))}
          </div>
        </section>

        <section className="rounded-[1.8rem] border border-[#FFE0B7]/12 bg-[linear-gradient(180deg,rgba(12,27,63,0.93),rgba(20,41,95,0.84))] px-4 py-4 shadow-[0_20px_52px_-34px_rgba(0,0,0,0.54)] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/58">LEADERBOARD</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-white">이번 달 TOP</h2>
            </div>
            <Link
              href="/dashboard/leaderboards"
              className="inline-flex items-center rounded-full border border-[#FFBE73]/28 bg-orange-300/12 px-3 py-1 text-[11px] font-black text-[#FFE1B7] shadow-[0_10px_24px_-18px_rgba(0,0,0,0.55)]"
            >
              더 보기
            </Link>
          </div>

          <div className="grid grid-cols-3 items-end gap-3">
            {topEntries.length > 0 ? (
              topEntries.map((entry, index) => (
                <PodiumCard
                  key={entry.id}
                  rank={index + 1}
                  name={entry.displayNameSnapshot || '학생'}
                  value={formatRankTime(Number(entry.value || 0))}
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

          <div className="mt-4 rounded-[1.55rem] border border-orange-300/18 bg-[radial-gradient(circle_at_top,rgba(255,176,76,0.16),transparent_62%),linear-gradient(180deg,rgba(18,43,103,0.96),rgba(34,62,132,0.88))] px-4 py-4 shadow-[0_16px_34px_-26px_rgba(255,138,31,0.38)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/58">MY RANK</p>
                <p className="mt-1 text-[1.45rem] font-black tracking-tight text-white">{myRankLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/58">MONTH</p>
                <p className="mt-1 text-sm font-black text-[#FFD089]">{formatRankTime(monthlyMinutes)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-[1.5rem] border border-[#FFE0B7]/12 bg-[linear-gradient(180deg,rgba(12,27,63,0.92),rgba(20,41,95,0.8))] px-4 py-4 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/62">이번 주</p>
            <p className="mt-2 text-[1.2rem] font-black tracking-tight text-white">{formatStudyMinutes(weeklyMinutes)}</p>
          </div>
          <div className="rounded-[1.5rem] border border-[#FFE0B7]/12 bg-[linear-gradient(180deg,rgba(12,27,63,0.92),rgba(20,41,95,0.8))] px-4 py-4 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/62">오늘 총합</p>
            <p className="mt-2 text-[1.2rem] font-black tracking-tight text-white">{formatStudyMinutes(liveTodayMinutes)}</p>
          </div>
        </section>

        <Link
          href="/dashboard/appointments/inquiries"
          className="rounded-[1.8rem] border border-[#FFE1B7]/50 bg-[linear-gradient(180deg,#fffaf1_0%,#fff0dc_100%)] px-4 py-4 shadow-[0_20px_48px_-34px_rgba(0,0,0,0.28)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#173A82]/55">REWARD SHOP</p>
              <p className="mt-2 text-base font-black tracking-tight text-[#14295F]">갖고 싶은 선물 문의</p>
              <p className="mt-1 text-xs font-bold text-[#173A82]/78">카카오톡 선물하기로 받을 수 있는 선물을 문의해보세요.</p>
            </div>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,#ffcb82_0%,#ff9b2b_100%)] text-[#173A82] shadow-[0_12px_24px_-16px_rgba(255,138,31,0.55)]">
              <ChevronRight className="h-5 w-5" />
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
                  intense={selectedBox?.state === 'ready'}
                  label={selectedBox ? `${selectedBox.hour}시간 상자` : '상자'}
                  onClick={selectedBox?.state === 'ready' ? handleRevealBox : undefined}
                />

                <div className="point-track-modal-particles" aria-hidden="true">
                  {Array.from({ length: 7 }, (_, index) => (
                    <span key={`particle-${index}`} className={cn('point-track-modal-particle', boxStage === 'revealed' && 'point-track-modal-particle--visible')} />
                  ))}
                </div>

                <div className="mt-4 text-center">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/45">
                    {selectedBox ? `${selectedBox.hour}시간 상자` : '상자'}
                  </p>
                  {boxStage === 'revealed' && revealedReward !== null ? (
                    <div className="point-track-reward-burst">
                      <p className="text-[2.6rem] font-black tracking-tight text-orange-100">
                        +<RewardCountUp value={revealedReward} />P
                      </p>
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
                  <span>{earnedBoxes >= 8 ? '오늘 상자 완료' : formatCountdown(nextBoxSecondsLeft)}</span>
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
