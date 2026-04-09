'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  getAvailableStudyBoxMilestones,
  getClaimedStudyBoxes,
  getStudyBoxFallbackRarity,
  rollStudyBoxReward,
  type StudyBoxReward,
} from '@/lib/student-rewards';
import { openStudyRewardBoxSecure } from '@/lib/study-box-actions';
import { GrowthProgress, StudyLogDay } from '@/lib/types';
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

const RARITY_LABELS: Record<BoxRarity, string> = {
  common: '커먼',
  rare: '레어',
  epic: '에픽',
};

const STUDY_BOX_CLAIM_CACHE_PREFIX = 'point-track:claimed-boxes';
const STUDY_BOX_ARRIVAL_TOAST_PREFIX = 'point-track:arrival-toast';
const EMPTY_STUDY_BOX_CACHE_KEY = '__empty-claim-cache__';

function normalizeStudyBoxHours(values: number[]) {
  return Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= 1 && value <= 8)
    )
  ).sort((a, b) => a - b);
}

function readStudyBoxHoursCache(storageKey: string | null) {
  if (typeof window === 'undefined' || !storageKey) return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeStudyBoxHours(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

function writeStudyBoxHoursCache(storageKey: string | null, values: number[]) {
  if (typeof window === 'undefined' || !storageKey) return;

  const normalized = normalizeStudyBoxHours(values);

  try {
    if (normalized.length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(normalized));
  } catch {}
}

function hasSeenStudyBoxArrivalToast(storageKey: string | null) {
  if (typeof window === 'undefined' || !storageKey) return false;

  try {
    return window.localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

function markStudyBoxArrivalToastSeen(storageKey: string | null) {
  if (typeof window === 'undefined' || !storageKey) return;

  try {
    window.localStorage.setItem(storageKey, '1');
  } catch {}
}

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
      const rarity = entry?.rarity;
      if (!Number.isFinite(milestone) || milestone < 1 || milestone > 8) return null;
      if (!Number.isFinite(minReward) || !Number.isFinite(maxReward) || !Number.isFinite(awardedPoints)) return null;
      return {
        milestone,
        rarity: rarity === 'epic' || rarity === 'rare' || rarity === 'common' ? rarity : getStudyBoxFallbackRarity(milestone),
        minReward,
        maxReward,
        awardedPoints,
        multiplier: Number.isFinite(multiplier) ? multiplier : 1,
      } satisfies StudyBoxReward;
    })
    .filter((entry): entry is StudyBoxReward => Boolean(entry))
    .sort((a, b) => a.milestone - b.milestone);
}

function upsertStudyBoxRewardEntry(entries: StudyBoxReward[], reward: StudyBoxReward) {
  const next = new Map<number, StudyBoxReward>();
  entries.forEach((entry) => {
    next.set(entry.milestone, entry);
  });
  next.set(reward.milestone, reward);
  return Array.from(next.values()).sort((a, b) => a.milestone - b.milestone);
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
      rarity: rewardByHour.get(hour)?.rarity || getStudyBoxFallbackRarity(hour),
      reward: rewardByHour.get(hour)?.awardedPoints,
    } satisfies RewardBox;
  });
}

function RewardHeroChest({
  state,
  stage,
  label,
  intense = false,
  rarity,
  onClick,
}: {
  state: 'ready' | 'charging';
  stage?: BoxStage;
  label: string;
  intense?: boolean;
  rarity?: BoxRarity | null;
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
        rarity === 'rare' && 'point-track-hero-box--rare',
        rarity === 'epic' && 'point-track-hero-box--epic',
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
  const valueLength = value.length;
  const valueClass =
    valueLength >= 11
      ? 'text-[0.76rem] tracking-[-0.08em] sm:text-[0.92rem]'
      : valueLength >= 9
        ? 'text-[0.82rem] tracking-[-0.07em] sm:text-[1rem]'
        : valueLength >= 7
          ? 'text-[0.9rem] tracking-[-0.06em] sm:text-[1.08rem]'
          : 'text-[0.98rem] tracking-[-0.04em] sm:text-[1.2rem]';

  return (
    <div className="surface-card surface-card--secondary on-dark relative min-w-0 rounded-[1.35rem] px-3 py-3">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-[radial-gradient(circle_at_top,rgba(255,208,137,0.18),transparent_72%)]" />
      {floatingGain ? (
        <div key={floatingGain.key} className="point-track-floating-gain">
          +{floatingGain.amount}P
        </div>
      ) : null}
      <div className="flex items-center gap-2.5">
        <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/10 shadow-[0_10px_20px_-14px_rgba(0,0,0,0.45)]', accentClass)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-on-dark-soft)]">{label}</div>
          <div className={cn("font-aggro-display mt-1 whitespace-nowrap leading-none font-black text-white", valueClass)}>{value}</div>
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
  const isRolledBox = box.state === 'ready' || box.state === 'opened';
  const rarityClass =
    isRolledBox && box.rarity === 'epic'
      ? 'point-track-slot--epic'
      : isRolledBox && box.rarity === 'rare'
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
            'rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em]',
            isRolledBox && box.rarity === 'epic'
              ? 'border-violet-300/30 bg-violet-300/18 text-violet-100'
              : isRolledBox && box.rarity === 'rare'
                ? 'border-orange-300/30 bg-orange-300/18 text-orange-100'
                : 'border-sky-200/24 bg-sky-200/14 text-sky-100'
          )}
        >
          {isRolledBox ? RARITY_LABELS[box.rarity] : '랜덤'}
        </span>
        {box.state === 'ready' ? (
          <Star className="h-3.5 w-3.5 text-orange-100" />
        ) : box.state === 'locked' ? (
          <Lock className="h-3.5 w-3.5 text-[var(--text-on-dark-soft)]" />
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
          <div className="mt-1 text-[10px] font-black text-[var(--text-on-dark-soft)]">{chargingLabel}</div>
          </>
        ) : (
          <div className="mt-1 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-on-dark-soft)]">
            <span>
              {box.state === 'opened'
                ? '확인완료'
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
  const [hydratedClaimCacheKey, setHydratedClaimCacheKey] = useState<string | null>(null);

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

  const claimCacheKey = useMemo(() => {
    if (!activeMembership?.id || !user?.uid) return null;
    return `${STUDY_BOX_CLAIM_CACHE_PREFIX}:${activeMembership.id}:${user.uid}:${todayKey}`;
  }, [activeMembership?.id, todayKey, user?.uid]);

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
    const cachedClaimedBoxes = readStudyBoxHoursCache(claimCacheKey);
    const nextClaimedBoxes = normalizeStudyBoxHours([...persistedClaimedBoxes, ...cachedClaimedBoxes]);

    setClaimedBoxes(nextClaimedBoxes);
    writeStudyBoxHoursCache(claimCacheKey, nextClaimedBoxes);
    setHydratedClaimCacheKey(claimCacheKey || EMPTY_STUDY_BOX_CACHE_KEY);
  }, [claimCacheKey, persistedClaimedBoxes]);

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
  const todayOpenedCount = openedBoxes.length;

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
    if ((claimCacheKey || EMPTY_STUDY_BOX_CACHE_KEY) !== hydratedClaimCacheKey) return;

    const availableMilestones = getAvailableStudyBoxMilestones(liveTodayMinutes, claimedBoxes);
    if (availableMilestones.length === 0) return;

    const claimKey = `${todayKey}:${availableMilestones.join(',')}:${liveTodayMinutes}`;
    if (liveClaimKeyRef.current === claimKey) return;
    liveClaimKeyRef.current = claimKey;

    const nextRewards = availableMilestones.map((milestone) => rollStudyBoxReward(milestone));
    const nextClaimedBoxes = Array.from(new Set([...claimedBoxes, ...availableMilestones])).sort((a, b) => a - b);
    const nextRewardEntries = [...rewardEntries, ...nextRewards].sort((a, b) => a.milestone - b.milestone);
    const nextDayStatus = {
      ...todayStatus,
      claimedStudyBoxes: nextClaimedBoxes,
      studyBoxRewards: nextRewardEntries,
    };

    setClaimedBoxes(nextClaimedBoxes);
    setRewardEntries(nextRewardEntries);
    setArrivalEvent({ key: Date.now(), count: availableMilestones.length });
    setFreshReadyHours(availableMilestones);

    const clearFresh = setTimeout(() => {
      setFreshReadyHours((prev) => prev.filter((hour) => !availableMilestones.includes(hour)));
    }, 1800);
    timeoutsRef.current.push(clearFresh);

    void setDoc(
      progressRef,
      {
        dailyPointStatus: {
          [todayKey]: nextDayStatus,
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )
      .then(() => {
        writeStudyBoxHoursCache(claimCacheKey, nextClaimedBoxes);

        const arrivalToastKey =
          activeMembership?.id && user?.uid
            ? `${STUDY_BOX_ARRIVAL_TOAST_PREFIX}:${activeMembership.id}:${user.uid}:${todayKey}:${availableMilestones.join(',')}`
            : null;

        if (!hasSeenStudyBoxArrivalToast(arrivalToastKey)) {
          toast({
            title: availableMilestones.length > 1 ? `상자 ${availableMilestones.length}개 도착!` : '상자 도착!',
            description: `+${availableMilestones.length} BOX · 보관함에서 열어보세요.`,
          });
          markStudyBoxArrivalToastSeen(arrivalToastKey);
        }
      })
      .catch((error: any) => {
        console.warn('[point-track] live study box claim failed', error?.message || error);
        liveClaimKeyRef.current = null;
        setClaimedBoxes(persistedClaimedBoxes);
        setRewardEntries(persistedRewardEntries);
        setFreshReadyHours([]);
      });
  }, [
    claimedBoxes,
    claimCacheKey,
    hydratedClaimCacheKey,
    isTimerActive,
    liveTodayMinutes,
    activeMembership?.id,
    persistedClaimedBoxes,
    persistedRewardEntries,
    progress?.pointsBalance,
    progressRef,
    rewardEntries,
    todayKey,
    todayStatus,
    toast,
    user?.uid,
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
    if (!selectedBox || selectedBox.state !== 'ready' || isClaimingBox || !activeMembership?.id) return;
    const targetHour = selectedBox.hour;

    setIsClaimingBox(true);
    setBoxStage('shake');

    const shakeTimeout = setTimeout(() => {
      setBoxStage('burst');
    }, 380);
    timeoutsRef.current.push(shakeTimeout);

    const revealTimeout = setTimeout(async () => {
      try {
        const result = await openStudyRewardBoxSecure({
          centerId: activeMembership.id,
          dateKey: todayKey,
          hour: targetHour,
        });
        const nextOpenedBoxes = Array.isArray(result.openedStudyBoxes)
          ? result.openedStudyBoxes
          : Array.from(new Set([...openedBoxes, targetHour])).sort((a, b) => a - b);
        const nextClaimedBoxes = Array.isArray(result.claimedStudyBoxes)
          ? result.claimedStudyBoxes
          : Array.from(new Set([...claimedBoxes, targetHour])).sort((a, b) => a - b);
        const nextRewardEntry = result.reward;
        const reward =
          nextRewardEntry?.awardedPoints
          ?? rewardByHour.get(targetHour)?.awardedPoints
          ?? selectedBox.reward
          ?? 0;

        setOpenedBoxes(nextOpenedBoxes);
        setClaimedBoxes(nextClaimedBoxes);
        if (nextRewardEntry) {
          setRewardEntries((prev) => upsertStudyBoxRewardEntry(prev, nextRewardEntry));
        }
        if (typeof result.pointsBalance === 'number') {
          setPointBalance(Math.max(0, result.pointsBalance));
        }

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
        setClaimedBoxes(persistedClaimedBoxes);
        setRewardEntries(persistedRewardEntries);
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
    <div className="student-night-page pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[max(0.35rem,env(safe-area-inset-top))]">
      <div className={cn('mx-auto flex w-full max-w-md flex-col gap-4', isMobile ? 'px-3' : 'px-1')}>
        <section className={cn('point-track-hero-stage', arrivalEvent && 'point-track-hero-stage--arrival')}>
          {arrivalEvent ? (
            <div key={arrivalEvent.key} className="point-track-arrival-banner">
              +{arrivalEvent.count} BOX
            </div>
          ) : null}

          <div className={cn("gap-4", isMobile ? "flex flex-col" : "flex items-center justify-between gap-3")}>
            <div className={cn(isMobile ? "w-full" : "")}>
              <p className="surface-kicker text-[11px]">POINT TRACK</p>
              <h1 className="font-aggro-display mt-2 text-[2rem] font-black tracking-tight text-white">포인트트랙</h1>
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
                'surface-chip px-3 py-1 text-[10px] uppercase tracking-[0.22em]',
                isMobile ? "self-start" : "",
                totalAvailableBoxes > 0
                  ? 'surface-chip--accent'
                  : isTimerActive
                    ? 'border border-sky-200/20 bg-sky-200/10 text-white'
                    : 'surface-chip--dark text-[var(--text-on-dark-soft)]'
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
              <p className="font-aggro-display text-sm font-black text-[var(--accent-orange-soft)]">
                {totalAvailableBoxes > 0 ? '상자 도착' : heroMode === 'studying' ? '집중 중' : '다음 상자'}
              </p>
              <div className="font-aggro-display mt-1 text-[2rem] font-black tracking-tight text-white">{heroPrimaryLabel}</div>
              <p className="mt-1 text-sm font-bold text-white">{heroSecondaryLabel}</p>
            </div>

            {isTimerActive ? (
              <div className="grid w-full grid-cols-3 gap-2">
                <div className="surface-card surface-card--ghost on-dark rounded-[1.1rem] px-3 py-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">상태</p>
                  <p className="font-aggro-display mt-2 text-sm font-black text-white">집중 중</p>
                </div>
                <div className="surface-card surface-card--ghost on-dark rounded-[1.1rem] px-3 py-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">세션</p>
                  <p className="font-aggro-display mt-2 text-sm font-black text-white">{formatHeroTimer(liveSessionSeconds)}</p>
                </div>
                <div className="surface-card surface-card--ghost on-dark rounded-[1.1rem] px-3 py-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">도착</p>
                  <p className="font-aggro-display mt-2 text-sm font-black text-[var(--accent-orange-soft)]">{totalAvailableBoxes > 0 ? 'OPEN' : formatCountdown(nextBoxSecondsLeft)}</p>
                </div>
              </div>
            ) : null}

            <Button
              type="button"
              onClick={handleHeroCta}
              variant={totalAvailableBoxes > 0 ? 'secondary' : 'dark'}
              className={cn(
                'point-track-hero-cta font-aggro-display mt-2 h-14 w-full rounded-[1.4rem] text-base font-black',
                totalAvailableBoxes > 0
                  ? ''
                  : 'border border-white/12 bg-[rgba(255,255,255,0.94)] text-[var(--text-on-light)]'
              )}
            >
              {heroCtaLabel}
            </Button>
          </div>
        </section>

        <section className="surface-card surface-card--secondary on-dark rounded-[1.7rem] px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-[var(--accent-orange-soft)]" />
              <span className="text-sm font-black text-white">다음 상자</span>
            </div>
            <div className="flex items-center gap-2">
              {isNearNextBox && totalAvailableBoxes === 0 ? (
                <span className="surface-chip surface-chip--accent px-2 py-1 text-[10px]">곧 도착</span>
              ) : null}
              <span className="text-sm font-black text-[var(--text-on-dark-soft)]">{formatProgressCounter(currentCycleSeconds)}</span>
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
          <div className="mt-3 flex items-center justify-between text-[11px] font-black text-[var(--text-on-dark-soft)]">
            <span>0분</span>
            <span>{earnedBoxes >= 8 ? '오늘 상자 완료' : `${formatCountdown(nextBoxSecondsLeft)} 남음`}</span>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="surface-card surface-card--light rounded-[1.2rem] px-3 py-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)]">오늘 연 상자</p>
            <p className="mt-2 text-base font-black text-[var(--text-primary)]">{todayOpenedCount}개</p>
          </div>
          <div className="surface-card surface-card--ivory rounded-[1.2rem] px-3 py-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)]">연 상자</p>
            <p className="mt-2 text-base font-black text-[var(--text-primary)]">{todayOpenedCount}개</p>
          </div>
          <div className="surface-card surface-card--highlight rounded-[1.2rem] px-3 py-3 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-accent)]">이번 달</p>
            <p className="mt-2 text-base font-black text-[var(--text-on-accent)]">{formatStudyMinutesShort(monthlyMinutes)}</p>
          </div>
        </section>

        <section className="surface-card surface-card--secondary on-dark rounded-[1.8rem] px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="surface-kicker text-[11px]">VAULT</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-white">보관함</h2>
            </div>
            <div className="surface-chip surface-chip--accent px-3 py-1 text-[11px]">
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

        <section className="grid grid-cols-2 gap-3">
          <div className="surface-card surface-card--light rounded-[1.5rem] px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--text-secondary)]">이번 주</p>
            <p className="mt-2 text-[1.2rem] font-black tracking-tight text-[var(--text-primary)]">{formatStudyMinutes(weeklyMinutes)}</p>
          </div>
          <div className="surface-card surface-card--ivory rounded-[1.5rem] px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--text-secondary)]">오늘 총합</p>
            <p className="mt-2 text-[1.2rem] font-black tracking-tight text-[var(--text-primary)]">{formatStudyMinutes(liveTodayMinutes)}</p>
          </div>
        </section>

        <div className="rounded-[1.8rem] border border-[#FFE1B7]/50 bg-[linear-gradient(180deg,#fffaf1_0%,#fff0dc_100%)] px-4 py-4 shadow-[0_20px_48px_-34px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#4D679F]">REWARD SHOP</p>
              <p className="font-aggro-display mt-2 text-base font-black tracking-tight text-[#14295F]">기프티콘샵 추후 오픈</p>
              <p className="mt-1 text-sm font-bold leading-5 text-[#24457f]">추후 기프티콘샵이 연동되면 이곳에서 보상 교환이 가능해져요.</p>
            </div>
            <div className="inline-flex h-12 min-w-[3rem] items-center justify-center rounded-full border border-[#FFBE77] bg-white/92 px-3 text-[11px] font-black tracking-[0.18em] text-[#C86A10] shadow-[0_12px_24px_-18px_rgba(255,138,31,0.35)]">
              SOON
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isVaultOpen} onOpenChange={handleVaultChange}>
        <DialogContent className="w-[min(92vw,24rem)] overflow-hidden rounded-[2rem] border-none bg-[linear-gradient(180deg,#14295F_0%,#0d1c45_100%)] p-0 shadow-[0_40px_100px_-36px_rgba(0,0,0,0.78)]">
          <div
            className={cn(
              'point-track-modal-shell',
              selectedBox?.rarity === 'rare' && 'point-track-modal-shell--rare',
              selectedBox?.rarity === 'epic' && 'point-track-modal-shell--epic',
            )}
          >
            <DialogHeader className="px-5 pb-0 pt-5">
              <DialogTitle className="text-left text-xl font-black tracking-tight text-white">보상 상자 오픈</DialogTitle>
              <DialogDescription className="text-left text-sm font-bold text-[var(--text-on-dark-soft)]">
                한 개씩 눌러서 열어보세요.
              </DialogDescription>
            </DialogHeader>

            <div className="px-5 pb-5 pt-4">
              <div
                className={cn(
                  'point-track-modal-stage text-center',
                  selectedBox?.rarity === 'rare' && 'point-track-modal-stage--rare',
                  selectedBox?.rarity === 'epic' && 'point-track-modal-stage--epic',
                )}
              >
                <div className="flex justify-center">
                  <RewardHeroChest
                    state={selectedBox?.state === 'ready' ? 'ready' : 'charging'}
                    stage={boxStage}
                    intense={selectedBox?.state === 'ready'}
                    rarity={selectedBox?.rarity ?? null}
                    label={selectedBox ? `${selectedBox.hour}시간 상자` : '상자'}
                    onClick={selectedBox?.state === 'ready' ? handleRevealBox : undefined}
                  />
                </div>

                <div className="point-track-modal-particles" aria-hidden="true">
                  {Array.from({ length: 7 }, (_, index) => (
                    <span key={`particle-${index}`} className={cn('point-track-modal-particle', boxStage === 'revealed' && 'point-track-modal-particle--visible')} />
                  ))}
                </div>

                <div className="mt-4 text-center">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-on-dark-muted)]">
                    {selectedBox ? `${selectedBox.hour}시간 상자` : '상자'}
                  </p>
                  {boxStage === 'revealed' && revealedReward !== null ? (
                    <div className="point-track-reward-burst">
                      <p className="text-[2.35rem] font-black tracking-tight text-orange-100">
                        +{revealedReward.toLocaleString()}P
                      </p>
                      <p className="mt-1 text-xs font-black text-[var(--text-on-dark-soft)]">이번 상자 보상이에요.</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm font-black text-[var(--text-on-dark)]">
                      {selectedBox?.state === 'ready' ? '터치해서 열기' : '다음 상자를 준비 중이에요'}
                    </p>
                  )}
                </div>
              </div>

              <div className="surface-card surface-card--ghost on-dark mt-4 rounded-[1.4rem] px-4 py-4">
                <div className="flex items-center justify-between text-sm font-black text-[var(--text-on-dark)]">
                  <span>오늘 연 상자</span>
                  <span>{todayOpenedCount}개</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs font-bold text-[var(--text-on-dark-soft)]">
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
