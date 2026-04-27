'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, subDays } from 'date-fns';
import {
  collection,
  doc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  BookOpen,
  ChevronRight,
  Flame,
  Gift,
  Loader2,
  Search,
  Sparkles,
  Timer,
  Wallet,
} from 'lucide-react';

import {
  RewardHeroBox,
  RewardVaultSlot,
  type RewardBoxStage as BoxStage,
  type RewardBoxState as BoxState,
  type RewardVaultBox as RewardBox,
} from '@/components/dashboard/reward-box-visuals';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppContext } from '@/contexts/app-context';
import { useCollection, useDoc, useFirestore, useUser } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useToast } from '@/hooks/use-toast';
import { getSafeErrorMessage } from '@/lib/exposed-error';
import { createGiftishowOrderRequestSecure } from '@/lib/giftishow-actions';
import {
  formatGiftishowTimestamp,
  getGiftishowOrderStatusLabel,
  getGiftishowOrderStatusTone,
  getGiftishowProductAvailabilityReason,
  getGiftishowProductPointCost,
  isGiftishowProductAvailable,
  isGiftishowStudentCatalogProduct,
  sortGiftishowOrdersByRecent,
  sortGiftishowProducts,
} from '@/lib/giftishow';
import {
  buildDeterministicStudyBoxReward,
  getAvailableStudyBoxMilestones,
  getClaimedStudyBoxes,
  getDailyPointBreakdown,
  getOpenedStudyBoxes,
  getRemainingCarryoverStudyBoxHours,
  getRenderableTodayStudyBoxHours,
  getStudyBoxFallbackRarity,
  getStudyBoxRewardRangeByRarity,
  getStudyBoxRarityWeights,
  normalizeStoredStudyBoxRewardEntries,
  normalizeStudyBoxHourValues,
  upsertStudyBoxRewardEntry,
  type StudyBoxReward,
} from '@/lib/student-rewards';
import { getCurrentStudyDayLiveSeconds, getStudyDayContext, hasStudyBoxCarryoverExpired } from '@/lib/study-day';
import { readStudyBoxOpenedCache, writeStudyBoxOpenedCache } from '@/lib/study-box-opened-cache';
import { openStudyRewardBoxSecure } from '@/lib/study-box-actions';
import { GiftishowOrder, GiftishowProduct, GiftishowSettings, GrowthProgress, PointBoostEvent, StudyLogDay } from '@/lib/types';
import { cn } from '@/lib/utils';

const REWARD_BOX_BURST_DELAY_MS = 120;
const REWARD_TEXT_REVEAL_DELAY_MS = 220;
const POINT_BREAKDOWN_CHIP_CLASS = {
  box: 'bg-[#FFF3E2] text-[#915A1E]',
  rank: 'bg-[#EAF1FF] text-[#3357A5]',
  plan: 'bg-[#EAF8EF] text-[#1B7A52]',
  legacy: 'bg-[#F0F3FA] text-[#44546F]',
  adjustment: 'bg-[#F2F7EF] text-[#49733E]',
} as const;

type FloatingGain = {
  key: number;
  amount: number;
};

const STUDY_BOX_CLAIM_CACHE_PREFIX = 'point-track:claimed-boxes';
const STUDY_BOX_ARRIVAL_TOAST_PREFIX = 'point-track:arrival-toast';
const EMPTY_STUDY_BOX_CACHE_KEY = '__empty-claim-cache__';
const GIFTISHOW_PRODUCT_FETCH_LIMIT = 2500;
const GIFTISHOW_PRODUCT_PAGE_SIZE = 2;
const STUDY_BOX_DAILY_LIMIT = 8;

const STUDY_BOX_RARITY_LABELS: Record<'common' | 'rare' | 'epic', string> = {
  common: '기본 상자',
  rare: '레어 상자',
  epic: '에픽 상자',
};

const STUDY_BOX_RARITY_TONES: Record<'common' | 'rare' | 'epic', string> = {
  common: 'bg-slate-100 text-slate-700',
  rare: 'bg-sky-100 text-sky-700',
  epic: 'bg-violet-100 text-violet-700',
};

function normalizePhone(raw: string) {
  return raw.replace(/\D/g, '');
}

function extractPhoneNumber(source: unknown): string {
  if (!source || typeof source !== 'object') return '';
  const candidate = (source as { phoneNumber?: unknown }).phoneNumber;
  return typeof candidate === 'string' ? candidate : '';
}

function isValidKoreanMobilePhone(raw: string): boolean {
  return /^01\d{8,9}$/.test(raw);
}

function formatGiftishowPoints(value?: number | null) {
  return `${Math.max(0, Number(value || 0)).toLocaleString()}P`;
}

function toTimestampMs(value?: { toDate?: () => Date } | null) {
  try {
    return value?.toDate?.().getTime?.() ?? 0;
  } catch {
    return 0;
  }
}

function formatPointBoostMultiplierLabel(value: number) {
  const safe = Number(value);
  if (!Number.isFinite(safe) || safe <= 0) return '1배';
  const label = Number.isInteger(safe) ? safe.toFixed(0) : safe.toFixed(2).replace(/\.?0+$/, '');
  return `${label}배`;
}

function getEffectiveStudyLogMinutes(log?: Partial<StudyLogDay> | null) {
  if (!log) return 0;
  const baseMinutes = Number(log.totalMinutes ?? (log as Record<string, unknown>).totalStudyMinutes ?? 0);
  const adjustmentMinutes = Number(log.manualAdjustmentMinutes ?? 0);
  return Math.max(
    0,
    Math.round(
      (Number.isFinite(baseMinutes) ? baseMinutes : 0) +
      (Number.isFinite(adjustmentMinutes) ? adjustmentMinutes : 0)
    )
  );
}

function formatPointBoostWindowLabel(event: PointBoostEvent) {
  const startAtMs = toTimestampMs(event.startAt);
  const endAtMs = toTimestampMs(event.endAt);
  if (!startAtMs || !endAtMs) return '시간 정보 확인 중';

  const startAt = new Date(startAtMs);
  const endAt = new Date(endAtMs);
  const sameDay = format(startAt, 'yyyy-MM-dd') === format(endAt, 'yyyy-MM-dd');

  if (event.mode === 'day') {
    return `${format(startAt, 'M/d')} 하루 종일`;
  }
  if (sameDay) {
    return `${format(startAt, 'M/d HH:mm')} - ${format(endAt, 'HH:mm')}`;
  }
  return `${format(startAt, 'M/d HH:mm')} - ${format(endAt, 'M/d HH:mm')}`;
}

function getGiftishowProductImage(product?: GiftishowProduct | null) {
  return product?.goodsImgB || product?.goodsImgS || product?.mmsGoodsImg || product?.brandIconImg || '';
}

function getGiftishowRequestDisabledReason({
  settings,
  product,
  pointBalance,
  hasStudentPhone,
}: {
  settings?: GiftishowSettings | null;
  product?: GiftishowProduct | null;
  pointBalance: number;
  hasStudentPhone: boolean;
}) {
  if (settings?.enabled !== true) return '센터에서 보상샵을 준비 중이에요.';
  if (!hasStudentPhone) return '학생 휴대폰 번호를 등록해 주세요.';
  const availabilityReason = getGiftishowProductAvailabilityReason(product, settings);
  if (availabilityReason) return availabilityReason;
  if (Math.max(0, Number(pointBalance || 0)) < getGiftishowProductPointCost(product)) return '포인트가 부족해요.';
  return null;
}

function normalizeStudyBoxHours(values: unknown) {
  return normalizeStudyBoxHourValues(values);
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

function buildRewardBoxes({
  earnedHours,
  claimedHours,
  openedHours,
  rewardByHour,
  centerId,
  studentId,
  dateKey,
}: {
  earnedHours: number;
  claimedHours: number[];
  openedHours: number[];
  rewardByHour: Map<number, StudyBoxReward>;
  centerId?: string | null;
  studentId?: string | null;
  dateKey?: string | null;
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
    const storedReward = rewardByHour.get(hour);
    let fallbackReward: StudyBoxReward | null = null;

    if (!storedReward && (claimedSet.has(hour) || openedSet.has(hour)) && centerId && studentId && dateKey) {
      fallbackReward = buildDeterministicStudyBoxReward({
        centerId,
        studentId,
        dateKey,
        milestone: hour,
      });
    }

    const reward = storedReward ?? fallbackReward;

    return {
      id: `point-box-${hour}`,
      hour,
      state,
      rarity: reward?.rarity || getStudyBoxFallbackRarity(hour),
      reward: reward?.awardedPoints,
    } satisfies RewardBox;
  });
}

function HeroMetricChip({
  icon: Icon,
  label,
  value,
  accentClass,
  floatingGain,
  onClick,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  accentClass: string;
  floatingGain?: FloatingGain | null;
  onClick?: () => void;
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

  const content = (
    <>
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
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="surface-card point-track-panel on-dark relative min-w-0 rounded-[1.35rem] px-3 py-3 text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)]"
      >
        {content}
      </button>
    );
  }

  return <div className="surface-card point-track-panel on-dark relative min-w-0 rounded-[1.35rem] px-3 py-3">{content}</div>;
}

export default function GrowthPage() {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { activeMembership, activeStudentId, viewMode, isTimerActive, startTime } = useAppContext();
  const firestore = useFirestore();
  const isMobile = viewMode === 'mobile';
  const authUid = user?.uid || null;
  const studentDocId = activeStudentId || authUid || null;
  const studentUid = studentDocId || authUid || null;
  const studyBoxCacheUid = studentUid || authUid || null;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const studyDayContext = useMemo(() => getStudyDayContext(new Date(nowMs)), [nowMs]);
  const activeStudyDayKey = studyDayContext.dateKey;
  const previousStudyDayKey = studyDayContext.previousDateKey;
  const activeStudyDayDate = studyDayContext.studyDayDate;
  const periodKey = format(activeStudyDayDate, 'yyyy-MM');
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [selectedBoxHour, setSelectedBoxHour] = useState<number | null>(null);
  const [boxStage, setBoxStage] = useState<BoxStage>('idle');
  const [revealedReward, setRevealedReward] = useState<number | null>(null);
  const [openingBoxHours, setOpeningBoxHours] = useState<number[]>([]);
  const [floatingGain, setFloatingGain] = useState<FloatingGain | null>(null);
  const [arrivalEvent, setArrivalEvent] = useState<{ key: number; count: number } | null>(null);
  const [freshReadyHours, setFreshReadyHours] = useState<number[]>([]);
  const [claimedBoxes, setClaimedBoxes] = useState<number[]>([]);
  const [rewardEntries, setRewardEntries] = useState<StudyBoxReward[]>([]);
  const [openedBoxes, setOpenedBoxes] = useState<number[]>([]);
  const [carryoverOpenedBoxes, setCarryoverOpenedBoxes] = useState<number[]>([]);
  const [pointBalance, setPointBalance] = useState(0);
  const [isPointHistoryOpen, setIsPointHistoryOpen] = useState(false);
  const [requestingGoodsCode, setRequestingGoodsCode] = useState<string | null>(null);
  const [isGiftishowShopOpen, setIsGiftishowShopOpen] = useState(false);
  const [giftishowSearch, setGiftishowSearch] = useState('');
  const [giftishowFilterMode, setGiftishowFilterMode] = useState<'available' | 'all'>('available');
  const [giftishowPage, setGiftishowPage] = useState(1);
  const [isPointTrackManualOpen, setIsPointTrackManualOpen] = useState(false);
  const timeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const liveClaimKeyRef = useRef<string | null>(null);
  const activeRevealTokenRef = useRef(0);
  const openingBoxHoursRef = useRef<Set<number>>(new Set());
  const [hydratedClaimCacheKey, setHydratedClaimCacheKey] = useState<string | null>(null);

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !studentUid) return null;
    return doc(firestore, 'centers', activeMembership.id, 'growthProgress', studentUid);
  }, [firestore, activeMembership?.id, studentUid]);
  const { data: progress, isLoading } = useDoc<GrowthProgress>(progressRef);

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userProfile } = useDoc<{ phoneNumber?: string }>(userProfileRef, { enabled: Boolean(user) });

  const studentProfileRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !studentDocId) return null;
    return doc(firestore, 'centers', activeMembership.id, 'students', studentDocId);
  }, [firestore, activeMembership?.id, studentDocId]);
  const { data: studentProfile } = useDoc<{ phoneNumber?: string }>(studentProfileRef, {
    enabled: Boolean(activeMembership && user),
  });

  const giftishowSettingsRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'settings', 'giftishow');
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: giftishowSettings } = useDoc<GiftishowSettings>(giftishowSettingsRef, {
    enabled: Boolean(activeMembership && user),
  });

  const giftishowProductsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(collection(firestore, 'centers', activeMembership.id, 'giftishowProducts'), limit(GIFTISHOW_PRODUCT_FETCH_LIMIT));
  }, [firestore, activeMembership?.id, user?.uid]);
  const {
    data: giftishowProductsRaw,
    isLoading: isGiftishowProductsLoading,
    error: giftishowProductsError,
  } = useCollection<GiftishowProduct>(giftishowProductsQuery, {
    enabled: Boolean(activeMembership && user),
  });

  const giftishowOrdersQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !studentUid) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'giftishowOrders'),
      where('studentId', '==', studentUid),
      limit(50)
    );
  }, [firestore, activeMembership?.id, studentUid]);
  const { data: giftishowOrdersRaw } = useCollection<GiftishowOrder>(giftishowOrdersQuery, {
    enabled: Boolean(activeMembership && user),
  });

  const pointBoostEventsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(collection(firestore, 'centers', activeMembership.id, 'pointBoostEvents'), limit(24));
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: pointBoostEvents } = useCollection<PointBoostEvent>(pointBoostEventsQuery, {
    enabled: Boolean(activeMembership && user),
  });

  const seasonStudyLogsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !studentUid) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'studyLogs', studentUid, 'days'),
      orderBy('dateKey', 'desc'),
      limit(62)
    );
  }, [firestore, activeMembership?.id, studentUid]);
  const { data: seasonStudyLogs } = useCollection<StudyLogDay>(seasonStudyLogsQuery);

  const todayLog = useMemo(() => {
    return (seasonStudyLogs || []).find((log) => log.dateKey === activeStudyDayKey) || null;
  }, [activeStudyDayKey, seasonStudyLogs]);

  const todayMinutes = getEffectiveStudyLogMinutes(todayLog);
  const weeklyMinutes = useMemo(() => {
    const keys = new Set(Array.from({ length: 7 }, (_, index) => format(subDays(activeStudyDayDate, index), 'yyyy-MM-dd')));
    return (seasonStudyLogs || [])
      .filter((log) => keys.has(log.dateKey))
      .reduce((sum, log) => sum + getEffectiveStudyLogMinutes(log), 0);
  }, [activeStudyDayDate, seasonStudyLogs]);
  const monthlyMinutes = useMemo(() => {
    return (seasonStudyLogs || [])
      .filter((log) => log.dateKey.startsWith(periodKey))
      .reduce((sum, log) => sum + getEffectiveStudyLogMinutes(log), 0);
  }, [seasonStudyLogs, periodKey]);

  const todayStatus = useMemo(() => {
    return ((progress?.dailyPointStatus || {})[activeStudyDayKey] || {}) as Record<string, any>;
  }, [activeStudyDayKey, progress?.dailyPointStatus]);
  const previousStudyDayStatus = useMemo(() => {
    return ((progress?.dailyPointStatus || {})[previousStudyDayKey] || {}) as Record<string, any>;
  }, [previousStudyDayKey, progress?.dailyPointStatus]);
  const recentPointHistory = useMemo(() => {
    const dailyPointStatus = progress?.dailyPointStatus || {};

    return Array.from({ length: 7 }, (_, index) => {
      const studyDayDate = subDays(activeStudyDayDate, index);
      const dateKey = format(studyDayDate, 'yyyy-MM-dd');
      const breakdown = getDailyPointBreakdown((dailyPointStatus[dateKey] || {}) as Record<string, any>);

      return {
        dateKey,
        dateLabel: format(studyDayDate, 'M월 d일'),
        relativeLabel: index === 0 ? '오늘' : index === 1 ? '어제' : `${index + 1}일 전`,
        ...breakdown,
      };
    });
  }, [activeStudyDayDate, progress?.dailyPointStatus]);
  const recentPointTotal = useMemo(
    () => recentPointHistory.reduce((sum, entry) => sum + entry.totalPoints, 0),
    [recentPointHistory]
  );
  const recentPointActiveDays = useMemo(
    () => recentPointHistory.filter((entry) => entry.totalPoints > 0).length,
    [recentPointHistory]
  );

  const claimCacheKey = useMemo(() => {
    if (!activeMembership?.id || !user?.uid) return null;
    return `${STUDY_BOX_CLAIM_CACHE_PREFIX}:${activeMembership.id}:${user.uid}:${activeStudyDayKey}`;
  }, [activeMembership?.id, activeStudyDayKey, user?.uid]);

  const persistedClaimedBoxes = useMemo(() => getClaimedStudyBoxes(todayStatus), [todayStatus]);
  const persistedRewardEntries = useMemo(
    () => normalizeStoredStudyBoxRewardEntries(todayStatus.studyBoxRewards),
    [todayStatus]
  );
  const persistedOpenedBoxes = useMemo(() => getOpenedStudyBoxes(todayStatus), [todayStatus]);
  const persistedCarryoverClaimedBoxes = useMemo(
    () => getClaimedStudyBoxes(previousStudyDayStatus),
    [previousStudyDayStatus]
  );
  const persistedCarryoverRewardEntries = useMemo(
    () => normalizeStoredStudyBoxRewardEntries(previousStudyDayStatus.studyBoxRewards),
    [previousStudyDayStatus]
  );
  const persistedCarryoverOpenedBoxes = useMemo(
    () => getOpenedStudyBoxes(previousStudyDayStatus),
    [previousStudyDayStatus]
  );
  const isCarryoverExpired = useMemo(
    () => hasStudyBoxCarryoverExpired(previousStudyDayKey, new Date(nowMs)),
    [nowMs, previousStudyDayKey]
  );

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
    const cachedOpenedBoxes = readStudyBoxOpenedCache(studyBoxCacheUid, activeStudyDayKey);
    const nextOpenedBoxes = normalizeStudyBoxHours([...persistedOpenedBoxes, ...cachedOpenedBoxes]);

    setOpenedBoxes(nextOpenedBoxes);
    writeStudyBoxOpenedCache(studyBoxCacheUid, activeStudyDayKey, nextOpenedBoxes);
  }, [activeStudyDayKey, persistedOpenedBoxes, studyBoxCacheUid]);

  useEffect(() => {
    const cachedOpenedBoxes = readStudyBoxOpenedCache(studyBoxCacheUid, previousStudyDayKey);
    setCarryoverOpenedBoxes(normalizeStudyBoxHours([...persistedCarryoverOpenedBoxes, ...cachedOpenedBoxes]));
  }, [persistedCarryoverOpenedBoxes, previousStudyDayKey, studyBoxCacheUid]);

  useEffect(() => {
    setPointBalance(Math.max(0, Number(progress?.pointsBalance || 0)));
  }, [progress?.pointsBalance]);

  const resolvedStudentPhone = useMemo(() => {
    return normalizePhone(
      extractPhoneNumber(studentProfile) || userProfile?.phoneNumber || activeMembership?.phoneNumber || ''
    );
  }, [activeMembership?.phoneNumber, studentProfile, userProfile?.phoneNumber]);

  const hasStudentPhone = useMemo(() => isValidKoreanMobilePhone(resolvedStudentPhone), [resolvedStudentPhone]);

  const syncedGiftishowProducts = useMemo(
    () => sortGiftishowProducts(giftishowProductsRaw || []),
    [giftishowProductsRaw]
  );
  const studentCatalogGiftishowProducts = useMemo(
    () => syncedGiftishowProducts.filter(isGiftishowStudentCatalogProduct),
    [syncedGiftishowProducts]
  );
  const isUsingGiftishowCatalogFallback = syncedGiftishowProducts.length > 0 && studentCatalogGiftishowProducts.length === 0;
  const giftishowProducts = useMemo(
    () => (isUsingGiftishowCatalogFallback ? syncedGiftishowProducts : studentCatalogGiftishowProducts),
    [isUsingGiftishowCatalogFallback, syncedGiftishowProducts, studentCatalogGiftishowProducts]
  );
  const giftishowOrders = useMemo(
    () => sortGiftishowOrdersByRecent(giftishowOrdersRaw || []),
    [giftishowOrdersRaw]
  );
  const studyBoxManualRows = useMemo(() => {
    const earlyWeights = new Map(getStudyBoxRarityWeights(1).map((entry) => [entry.rarity, entry.weight]));
    const lateWeights = new Map(getStudyBoxRarityWeights(5).map((entry) => [entry.rarity, entry.weight]));

    return (['common', 'rare', 'epic'] as const).map((rarity) => {
      const [minReward, maxReward] = getStudyBoxRewardRangeByRarity(rarity);
      return {
        rarity,
        label: STUDY_BOX_RARITY_LABELS[rarity],
        earlyWeight: earlyWeights.get(rarity) ?? 0,
        lateWeight: lateWeights.get(rarity) ?? 0,
        rewardLabel: `${minReward}P ~ ${maxReward}P`,
      };
    });
  }, []);
  const pointBoostGuide = useMemo(() => {
    const active: Array<PointBoostEvent & { startAtMs: number; endAtMs: number; label: string; multiplierLabel: string }> = [];
    const upcoming: Array<PointBoostEvent & { startAtMs: number; endAtMs: number; label: string; multiplierLabel: string }> = [];

    (pointBoostEvents || []).forEach((event) => {
      const startAtMs = toTimestampMs(event.startAt);
      const endAtMs = toTimestampMs(event.endAt);
      const cancelledAtMs = toTimestampMs(event.cancelledAt);
      if (!startAtMs || !endAtMs || cancelledAtMs > 0) return;

      const normalizedEvent = {
        ...event,
        startAtMs,
        endAtMs,
        label: formatPointBoostWindowLabel(event),
        multiplierLabel: formatPointBoostMultiplierLabel(event.multiplier),
      };

      if (startAtMs <= nowMs && nowMs < endAtMs) {
        active.push(normalizedEvent);
      } else if (startAtMs > nowMs) {
        upcoming.push(normalizedEvent);
      }
    });

    active.sort((left, right) => left.startAtMs - right.startAtMs);
    upcoming.sort((left, right) => left.startAtMs - right.startAtMs);

    return {
      active,
      upcoming,
      heroLabel: active[0]
        ? `지금 ${active[0].multiplierLabel} 부스트 적용 중`
        : upcoming[0]
          ? `다음 부스트 ${upcoming[0].label}`
          : '시간대 부스트가 없으면 기본 1배로 적용돼요',
    };
  }, [nowMs, pointBoostEvents]);
  const pointBoostCardGuide = useMemo(() => {
    const currentBoost = pointBoostGuide.active[0];
    if (currentBoost) {
      return {
        badge: currentBoost.multiplierLabel,
        title: '지금 시간대 부스트 진행 중',
        detail: currentBoost.label,
      };
    }

    const nextBoost = pointBoostGuide.upcoming[0];
    if (nextBoost) {
      return {
        badge: 'NEXT',
        title: `다음 ${nextBoost.multiplierLabel} 부스트`,
        detail: nextBoost.label,
      };
    }

    return {
      badge: '기본 1배',
      title: '부스트 없음',
      detail: '지금은 상자 pt가 기본 1배예요.',
    };
  }, [pointBoostGuide]);
  const studyBoxExampleGuide = useMemo(() => {
    const lateCommon = studyBoxManualRows.find((row) => row.rarity === 'common')?.lateWeight ?? 0;
    const lateRare = studyBoxManualRows.find((row) => row.rarity === 'rare')?.lateWeight ?? 0;
    const lateEpic = studyBoxManualRows.find((row) => row.rarity === 'epic')?.lateWeight ?? 0;
    const boostPreview = pointBoostGuide.active[0] ?? pointBoostGuide.upcoming[0] ?? null;
    const rawMultiplier = Number(boostPreview?.multiplier);
    const previewMultiplier = Number.isFinite(rawMultiplier) && rawMultiplier > 0 ? rawMultiplier : 2;
    const previewMultiplierLabel = boostPreview?.multiplierLabel ?? formatPointBoostMultiplierLabel(previewMultiplier);
    const previewBoostLabel = boostPreview
      ? `${pointBoostGuide.active[0] ? '현재 진행 중' : '다음 예정'} ${boostPreview.label}`
      : '예시 시간대 부스트';
    const [rareMin, rareMax] = getStudyBoxRewardRangeByRarity('rare');
    const [epicMin, epicMax] = getStudyBoxRewardRangeByRarity('epic');

    return [
      {
        key: 'carryover',
        eyebrow: '예시 1',
        title: '3시간 20분 공부하면',
        highlight: '상자 3개 + 다음 상자까지 40분',
        description: '상자는 1시간 단위로 생기고, 남은 20분은 사라지지 않고 다음 상자 시간에 이어져요.',
      },
      {
        key: 'late-box',
        eyebrow: '예시 2',
        title: '오늘 6번째 상자를 열면',
        highlight: `기본 ${lateCommon}% · 레어 ${lateRare}% · 에픽 ${lateEpic}%`,
        description: '5번째 상자부터는 후반 확률표가 적용돼서 레어와 에픽을 만날 가능성이 조금 더 올라가요.',
      },
      {
        key: 'boost',
        eyebrow: '예시 3',
        title: `${previewMultiplierLabel} 부스트 시간에 레어 상자를 열면`,
        highlight: `레어 ${rareMin}~${rareMax}P -> ${Math.round(rareMin * previewMultiplier)}~${Math.round(rareMax * previewMultiplier)}P`,
        description: `${previewBoostLabel}에는 확률이 아니라 지급 pt 배수가 올라가고, 에픽도 ${epicMin}~${epicMax}P -> ${Math.round(epicMin * previewMultiplier)}~${Math.round(epicMax * previewMultiplier)}P로 같이 커져요.`,
      },
    ] as const;
  }, [pointBoostGuide, studyBoxManualRows]);
  const availableGiftishowProducts = useMemo(
    () => giftishowProducts.filter((product) => isGiftishowProductAvailable(product, giftishowSettings)),
    [giftishowProducts, giftishowSettings]
  );
  const giftishowPreviewProducts = useMemo(
    () => (availableGiftishowProducts.length > 0 ? availableGiftishowProducts : giftishowProducts).slice(0, 3),
    [availableGiftishowProducts, giftishowProducts]
  );
  const giftishowSearchQuery = useMemo(() => giftishowSearch.trim().toLowerCase(), [giftishowSearch]);
  const giftishowBrowseProducts = useMemo(
    () => (giftishowFilterMode === 'available' ? availableGiftishowProducts : giftishowProducts),
    [availableGiftishowProducts, giftishowFilterMode, giftishowProducts]
  );
  const filteredGiftishowProducts = useMemo(() => {
    if (!giftishowSearchQuery) return giftishowBrowseProducts;
    return giftishowBrowseProducts.filter((product) => {
      const haystack = [
        product.goodsName,
        product.brandName,
        product.affiliate,
        product.goodsTypeNm,
        product.goodsTypeDtlNm,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(giftishowSearchQuery);
    });
  }, [giftishowBrowseProducts, giftishowSearchQuery]);
  const totalGiftishowPages = useMemo(
    () => Math.max(1, Math.ceil(filteredGiftishowProducts.length / GIFTISHOW_PRODUCT_PAGE_SIZE)),
    [filteredGiftishowProducts.length]
  );
  const currentGiftishowPage = Math.min(giftishowPage, totalGiftishowPages);
  const visibleGiftishowProducts = useMemo(() => {
    const startIndex = (currentGiftishowPage - 1) * GIFTISHOW_PRODUCT_PAGE_SIZE;
    return filteredGiftishowProducts.slice(startIndex, startIndex + GIFTISHOW_PRODUCT_PAGE_SIZE);
  }, [currentGiftishowPage, filteredGiftishowProducts]);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, isTimerActive && startTime ? 1000 : 30000);
    return () => window.clearInterval(timer);
  }, [isTimerActive, startTime]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, []);

  useEffect(() => {
    setGiftishowPage(1);
  }, [giftishowFilterMode, giftishowSearchQuery, isGiftishowShopOpen]);

  useEffect(() => {
    if (
      giftishowFilterMode === 'available' &&
      giftishowProducts.length > 0 &&
      availableGiftishowProducts.length === 0
    ) {
      setGiftishowFilterMode('all');
    }
  }, [availableGiftishowProducts.length, giftishowFilterMode, giftishowProducts.length]);

  useEffect(() => {
    if (giftishowPage > totalGiftishowPages) {
      setGiftishowPage(totalGiftishowPages);
    }
  }, [giftishowPage, totalGiftishowPages]);

  const liveSessionSeconds = isTimerActive && startTime ? Math.max(0, Math.floor((nowMs - startTime) / 1000)) : 0;
  const liveStudyDaySeconds = useMemo(() => {
    if (!isTimerActive || !startTime) return 0;
    return getCurrentStudyDayLiveSeconds(startTime, new Date(nowMs));
  }, [isTimerActive, nowMs, startTime]);
  const liveTodaySeconds = Math.max(0, todayMinutes * 60 + liveStudyDaySeconds);
  const liveTodayMinutes = Math.floor(liveTodaySeconds / 60);
  const rewardByHour = useMemo(() => {
    const map = new Map<number, StudyBoxReward>();
    rewardEntries.forEach((entry) => {
      map.set(entry.milestone, entry);
    });
    return map;
  }, [rewardEntries]);
  const carryoverRewardByHour = useMemo(() => {
    const map = new Map<number, StudyBoxReward>();
    persistedCarryoverRewardEntries.forEach((entry) => {
      map.set(entry.milestone, entry);
    });
    return map;
  }, [persistedCarryoverRewardEntries]);
  const earnedBoxes = Math.min(8, Math.floor(liveTodaySeconds / 3600));
  const currentCycleSeconds = earnedBoxes >= 8 ? 3600 : liveTodaySeconds % 3600;
  const nextBoxSecondsLeft = earnedBoxes >= 8 ? 0 : Math.max(0, 3600 - currentCycleSeconds);
  const progressPercent = earnedBoxes >= 8 ? 100 : Math.max(4, (currentCycleSeconds / 3600) * 100);
  const isNearNextBox = progressPercent >= 80 && progressPercent < 100;
  const renderableTodayStudyBoxState = useMemo(
    () => getRenderableTodayStudyBoxHours({
      earnedHours: earnedBoxes,
      claimedHours: claimedBoxes,
      openedHours: openedBoxes,
    }),
    [claimedBoxes, earnedBoxes, openedBoxes]
  );

  const boxes = useMemo(
    () =>
      buildRewardBoxes({
        earnedHours: renderableTodayStudyBoxState.earnedHours,
        claimedHours: renderableTodayStudyBoxState.claimedHours,
        openedHours: renderableTodayStudyBoxState.openedHours,
        rewardByHour,
        centerId: activeMembership?.id,
        studentId: studentUid,
        dateKey: activeStudyDayKey,
      }),
    [activeMembership?.id, activeStudyDayKey, renderableTodayStudyBoxState, rewardByHour, studentUid]
  );
  const carryoverReadyHours = useMemo(
    () => {
      if (isCarryoverExpired) return [];
      return getRemainingCarryoverStudyBoxHours({
        claimedHours: persistedCarryoverClaimedBoxes,
        openedHours: carryoverOpenedBoxes,
      });
    },
    [carryoverOpenedBoxes, isCarryoverExpired, persistedCarryoverClaimedBoxes]
  );
  const hasCarryoverReadyBoxes = !isCarryoverExpired && carryoverReadyHours.length > 0;
  const carryoverBoxes = useMemo(
    () => {
      if (isCarryoverExpired) return [] as RewardBox[];
      return buildRewardBoxes({
        earnedHours: persistedCarryoverClaimedBoxes.at(-1) || 0,
        claimedHours: persistedCarryoverClaimedBoxes,
        openedHours: carryoverOpenedBoxes,
        rewardByHour: carryoverRewardByHour,
        centerId: activeMembership?.id,
        studentId: studentUid,
        dateKey: previousStudyDayKey,
      });
    },
    [activeMembership?.id, carryoverOpenedBoxes, carryoverRewardByHour, isCarryoverExpired, persistedCarryoverClaimedBoxes, previousStudyDayKey, studentUid]
  );
  const activeBoxes = hasCarryoverReadyBoxes ? carryoverBoxes : boxes;
  const readyBoxes = activeBoxes.filter((box) => box.state === 'ready');
  const totalAvailableBoxes = readyBoxes.length;
  const heroBoxRarity =
    readyBoxes[0]?.rarity ??
    activeBoxes.find((box) => box.state === 'charging')?.rarity ??
    activeBoxes[0]?.rarity ??
    'common';
  const todayOpenedCount = hasCarryoverReadyBoxes
    ? carryoverOpenedBoxes.length
    : renderableTodayStudyBoxState.openedHours.length;
  const activeVaultDateKey = hasCarryoverReadyBoxes ? previousStudyDayKey : activeStudyDayKey;
  const activeRewardByHour = hasCarryoverReadyBoxes ? carryoverRewardByHour : rewardByHour;
  const activeRewardEntries = hasCarryoverReadyBoxes ? persistedCarryoverRewardEntries : rewardEntries;
  const activeClaimedBoxes = hasCarryoverReadyBoxes ? persistedCarryoverClaimedBoxes : claimedBoxes;
  const activeOpenedBoxes = hasCarryoverReadyBoxes ? carryoverOpenedBoxes : openedBoxes;
  const activeDayStatus = hasCarryoverReadyBoxes ? previousStudyDayStatus : todayStatus;

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

  const selectedBox = selectedBoxHour ? activeBoxes.find((box) => box.hour === selectedBoxHour) || null : null;
  const isRewardRevealed = boxStage === 'revealed' && revealedReward !== null;
  const selectedBoxIsOpening = selectedBoxHour !== null && openingBoxHours.includes(selectedBoxHour);
  const isOpeningReward = selectedBoxIsOpening && !isRewardRevealed;
  const isSelectedBoxVisuallyReady = selectedBox?.state === 'ready' || selectedBoxIsOpening || isRewardRevealed;

  useEffect(() => {
    if (!isTimerActive || !progressRef || !activeMembership?.id || !studentUid) return;
    if ((claimCacheKey || EMPTY_STUDY_BOX_CACHE_KEY) !== hydratedClaimCacheKey) return;

    const availableMilestones = getAvailableStudyBoxMilestones(liveTodayMinutes, claimedBoxes, openedBoxes);
    if (availableMilestones.length === 0) return;

    const claimKey = `${activeStudyDayKey}:${availableMilestones.join(',')}:${liveTodayMinutes}`;
    if (liveClaimKeyRef.current === claimKey) return;
    liveClaimKeyRef.current = claimKey;

    const nextRewards = availableMilestones.map((milestone) =>
      buildDeterministicStudyBoxReward({
        centerId: activeMembership.id,
        studentId: studentUid,
        dateKey: activeStudyDayKey,
        milestone,
      })
    );
    const nextClaimedBoxes = Array.from(new Set([...claimedBoxes, ...availableMilestones])).sort((a, b) => a - b);
    const nextRewardEntries = nextRewards.reduce(
      (entries, reward) => upsertStudyBoxRewardEntry(entries, reward),
      rewardEntries
    );
    const nextDayStatus = {
      ...todayStatus,
      claimedStudyBoxes: nextClaimedBoxes,
      openedStudyBoxes: normalizeStudyBoxHours(openedBoxes),
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
          [activeStudyDayKey]: nextDayStatus,
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )
      .then(() => {
        writeStudyBoxHoursCache(claimCacheKey, nextClaimedBoxes);

        const arrivalToastKey =
          activeMembership?.id && user?.uid
            ? `${STUDY_BOX_ARRIVAL_TOAST_PREFIX}:${activeMembership.id}:${user.uid}:${activeStudyDayKey}:${availableMilestones.join(',')}`
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
    openedBoxes,
    activeMembership?.id,
    persistedClaimedBoxes,
    persistedRewardEntries,
    progress?.pointsBalance,
    progressRef,
    rewardEntries,
    activeStudyDayKey,
    todayStatus,
    toast,
    studentUid,
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
    activeRevealTokenRef.current += 1;
    openingBoxHoursRef.current.clear();
    timeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    timeoutsRef.current = [];
    setBoxStage('idle');
    setRevealedReward(null);
    setOpeningBoxHours([]);
  };

  const handleVaultChange = (open: boolean) => {
    setIsVaultOpen(open);
    if (!open) {
      resetRevealState();
      setSelectedBoxHour(null);
    }
  };

  const handleRevealBox = (hourOverride?: number) => {
    const targetBox =
      typeof hourOverride === 'number'
        ? activeBoxes.find((box) => box.hour === hourOverride) || null
        : selectedBox;
    if (!targetBox || targetBox.state !== 'ready' || !activeMembership?.id || !studentUid) return;
    const targetHour = targetBox.hour;
    if (openingBoxHoursRef.current.has(targetHour)) return;

    const revealToken = activeRevealTokenRef.current + 1;
    activeRevealTokenRef.current = revealToken;
    openingBoxHoursRef.current.add(targetHour);
    setOpeningBoxHours(Array.from(openingBoxHoursRef.current).sort((a, b) => a - b));
    setSelectedBoxHour(targetHour);
    setRevealedReward(null);
    setBoxStage('shake');

    const currentDayStatus = {
      ...activeDayStatus,
      claimedStudyBoxes: activeClaimedBoxes,
      openedStudyBoxes: activeOpenedBoxes,
      studyBoxRewards: activeRewardEntries,
    };
    const rewardOpenPromise = openStudyRewardBoxSecure({
      centerId: activeMembership.id,
      studentId: studentUid,
      dateKey: activeVaultDateKey,
      hour: targetHour,
      reward: activeRewardByHour.get(targetHour) || buildDeterministicStudyBoxReward({
        centerId: activeMembership.id,
        studentId: studentUid,
        dateKey: activeVaultDateKey,
        milestone: targetHour,
      }),
      dayStatus: currentDayStatus,
      currentPointsBalance: pointBalance,
      currentTotalPointsEarned: Number(progress?.totalPointsEarned || 0),
    })
      .then((result) => ({ ok: true as const, result }))
      .catch((error) => ({ ok: false as const, error }));

    const shakeTimeout = setTimeout(() => {
      if (activeRevealTokenRef.current === revealToken) {
        setBoxStage('burst');
      }
    }, REWARD_BOX_BURST_DELAY_MS);
    timeoutsRef.current.push(shakeTimeout);

    const revealTimeout = setTimeout(() => {
      const optimisticReward = activeRewardByHour.get(targetHour)?.awardedPoints ?? targetBox.reward ?? 0;

      if (activeVaultDateKey === activeStudyDayKey) {
        setOpenedBoxes((prev) => {
          const nextOpenedBoxes = normalizeStudyBoxHours([...prev, targetHour]);
          writeStudyBoxOpenedCache(studyBoxCacheUid, activeStudyDayKey, nextOpenedBoxes);
          return nextOpenedBoxes;
        });
      } else {
        setCarryoverOpenedBoxes((prev) => {
          const nextOpenedBoxes = normalizeStudyBoxHours([...prev, targetHour]);
          writeStudyBoxOpenedCache(studyBoxCacheUid, activeVaultDateKey, nextOpenedBoxes);
          return nextOpenedBoxes;
        });
      }

      openingBoxHoursRef.current.delete(targetHour);
      setOpeningBoxHours(Array.from(openingBoxHoursRef.current).sort((a, b) => a - b));

      if (activeRevealTokenRef.current === revealToken) {
        const floatingKey = Date.now();
        setRevealedReward(optimisticReward);
        setBoxStage('revealed');
        setFloatingGain({ key: floatingKey, amount: optimisticReward });
        const clearFloating = setTimeout(() => {
          setFloatingGain((current) => (current?.key === floatingKey ? null : current));
        }, 1800);
        timeoutsRef.current.push(clearFloating);
      }

      void rewardOpenPromise.then((rewardResult) => {
        if (!rewardResult.ok) throw rewardResult.error;
        const result = rewardResult.result;
        if (!Array.isArray(result.openedStudyBoxes) || !Array.isArray(result.claimedStudyBoxes)) {
          throw new Error('Missing canonical study box state.');
        }

        const nextOpenedBoxes = result.openedStudyBoxes;
        const nextClaimedBoxes = result.claimedStudyBoxes;
        const nextRewardEntry = result.reward;
        const reward =
          nextRewardEntry?.awardedPoints
          ?? activeRewardByHour.get(targetHour)?.awardedPoints
          ?? targetBox.reward
          ?? 0;

        if (activeVaultDateKey === activeStudyDayKey) {
          setOpenedBoxes(nextOpenedBoxes);
          setClaimedBoxes(nextClaimedBoxes);
          writeStudyBoxOpenedCache(studyBoxCacheUid, activeStudyDayKey, nextOpenedBoxes);
          if (nextRewardEntry) {
            setRewardEntries((prev) => upsertStudyBoxRewardEntry(prev, nextRewardEntry));
          }
        } else {
          setCarryoverOpenedBoxes(nextOpenedBoxes);
          writeStudyBoxOpenedCache(studyBoxCacheUid, activeVaultDateKey, nextOpenedBoxes);
        }
        if (typeof result.pointsBalance === 'number') {
          setPointBalance((current) => Math.max(current, result.pointsBalance || 0));
        }

        if (activeRevealTokenRef.current === revealToken) {
          setRevealedReward(reward);
          setFloatingGain((current) => current ? { ...current, amount: reward } : current);
        }
      }).catch((error) => {
        console.error('[point-track] reward box open failed', error);

        if (activeVaultDateKey === activeStudyDayKey) {
          setOpenedBoxes((prev) => {
            const nextOpenedBoxes = normalizeStudyBoxHours(prev.filter((hour) => hour !== targetHour));
            writeStudyBoxOpenedCache(studyBoxCacheUid, activeStudyDayKey, nextOpenedBoxes);
            return nextOpenedBoxes;
          });
        } else {
          setCarryoverOpenedBoxes((prev) => {
            const nextOpenedBoxes = normalizeStudyBoxHours(prev.filter((hour) => hour !== targetHour));
            writeStudyBoxOpenedCache(studyBoxCacheUid, activeVaultDateKey, nextOpenedBoxes);
            return nextOpenedBoxes;
          });
        }

        if (activeRevealTokenRef.current === revealToken) {
          setBoxStage('idle');
          setRevealedReward(null);
          setFloatingGain(null);
        }
      }).finally(() => {
        openingBoxHoursRef.current.delete(targetHour);
        setOpeningBoxHours(Array.from(openingBoxHoursRef.current).sort((a, b) => a - b));
      });
    }, REWARD_TEXT_REVEAL_DELAY_MS);

    timeoutsRef.current.push(revealTimeout);
  };

  const handleNextBox = () => {
    const nextReady = activeBoxes.find((box) => box.state === 'ready' && box.hour !== selectedBoxHour);
    if (!nextReady) {
      handleVaultChange(false);
      return;
    }
    handleRevealBox(nextReady.hour);
  };

  const handleHeroCta = () => {
    if (totalAvailableBoxes > 0) {
      openVault();
      return;
    }
    router.push('/dashboard');
  };

  const handleGiftishowRequest = async (product: GiftishowProduct) => {
    if (!activeMembership?.id || !product.goodsCode) return;
    if (requestingGoodsCode) return;

    const disabledReason = getGiftishowRequestDisabledReason({
      settings: giftishowSettings,
      product,
      pointBalance,
      hasStudentPhone,
    });
    if (disabledReason) {
      toast({
        variant: 'destructive',
        title: '교환 요청 불가',
        description: disabledReason,
      });
      return;
    }

    const productName = product.goodsName?.trim() || '선택한 상품';
    const confirmed = window.confirm(`${productName}을(를) 요청하시겠습니까?\n센터 관리자 승인 전에는 포인트가 차감되지 않습니다.`);
    if (!confirmed) return;

    setRequestingGoodsCode(product.goodsCode);
    try {
      await createGiftishowOrderRequestSecure({
        centerId: activeMembership.id,
        goodsCode: product.goodsCode,
      });
      toast({
        title: '교환 요청을 보냈어요.',
        description: '센터 관리자 승인 후 MMS 쿠폰이 발송됩니다.',
      });
      setIsGiftishowShopOpen(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '교환 요청 실패',
        description: getSafeErrorMessage(error, '교환 요청 중 오류가 발생했습니다.'),
      });
    } finally {
      setRequestingGoodsCode(null);
    }
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
              <h1 className="font-aggro-display text-[2rem] font-black tracking-tight text-white">포인트트랙</h1>
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
                  onClick={() => setIsPointHistoryOpen(true)}
                />
              </div>
            </div>
          </div>

          <div className="relative mt-5 flex flex-col items-center gap-4">
            <RewardHeroBox
              state={totalAvailableBoxes > 0 ? 'ready' : 'charging'}
              stage={boxStage}
              intense={totalAvailableBoxes > 0 || isNearNextBox || Boolean(arrivalEvent)}
              rarity={heroBoxRarity}
              label={totalAvailableBoxes > 0 ? '지금 열기' : `${nextBoxSecondsLeft}초 남음`}
              onClick={totalAvailableBoxes > 0 ? () => openVault() : undefined}
            />

            <div className="text-center">
              <p className="font-aggro-display text-sm font-black text-[var(--text-accent-soft-fixed)]">
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
                  <p className="font-aggro-display mt-2 text-sm font-black text-[var(--text-accent-soft-fixed)]">{totalAvailableBoxes > 0 ? 'OPEN' : formatCountdown(nextBoxSecondsLeft)}</p>
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

        <section className="surface-card point-track-panel on-dark rounded-[1.7rem] px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-[var(--text-accent-soft-fixed)]" />
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

        <section className="surface-card point-track-panel on-dark rounded-[1.8rem] px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black tracking-tight text-white">보관함</h2>
            </div>
            <div className="surface-chip surface-chip--accent px-3 py-1 text-[11px]">
              READY {totalAvailableBoxes}
            </div>
          </div>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {activeBoxes.map((box) => (
              <RewardVaultSlot
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

        <section className="overflow-hidden rounded-[1.9rem] border border-[#FFD9A8]/70 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),transparent_34%),linear-gradient(180deg,#fffaf1_0%,#ffe9ca_100%)] px-4 py-4 shadow-[0_24px_56px_-34px_rgba(20,41,95,0.24)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white/80 text-[var(--text-accent-fixed)] shadow-[0_16px_28px_-22px_rgba(0,0,0,0.32)]">
                  <Gift className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-aggro-display text-[1.05rem] font-black tracking-tight text-[#14295F]">트랙 상점</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge className={cn('border-none font-black', giftishowSettings?.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700')}>
                {giftishowSettings?.enabled ? 'OPEN' : 'PREP'}
              </Badge>
              <p className="text-[11px] font-bold text-[#6E7FA7]">
                {formatGiftishowTimestamp(giftishowSettings?.lastCatalogSyncedAt)}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <div className="w-full max-w-[10rem] rounded-[1.3rem] border border-white/70 bg-white/88 px-3 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6E7FA7]">내 포인트</p>
              <p className="mt-2 text-lg font-black tracking-tight text-[#14295F]">{formatGiftishowPoints(pointBalance)}</p>
            </div>
          </div>

          {!hasStudentPhone ? (
            <div className="mt-4 rounded-[1.3rem] border border-rose-100 bg-rose-50 px-3 py-3 text-xs font-bold leading-5 text-rose-700">
              학생 휴대폰 번호가 아직 등록되지 않았어요. 프로필 설정에서 번호를 저장하면 보상샵 요청 버튼이 활성화돼요.
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setIsGiftishowShopOpen(true)}
            className="mt-4 w-full rounded-[1.55rem] border border-white/75 bg-white/90 px-4 py-4 text-left shadow-[0_22px_36px_-28px_rgba(20,41,95,0.24)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-orange)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-black tracking-tight text-[#14295F]">상품 고르기</p>
              </div>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D7E4FF] bg-white text-[#14295F]">
                <ChevronRight className="h-4 w-4" />
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {isGiftishowProductsLoading ? (
                <span className="col-span-3 inline-flex items-center justify-center rounded-full border border-dashed border-[#D7E4FF] bg-white/88 px-3 py-2 text-[11px] font-black text-[#6E7FA7]">
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  상품을 불러오는 중이에요.
                </span>
              ) : giftishowPreviewProducts.length > 0 ? (
                giftishowPreviewProducts.map((product) => {
                  const previewImage = getGiftishowProductImage(product);
                  return (
                    <div
                      key={`giftishow-preview-${product.id || product.goodsCode}`}
                      className="overflow-hidden rounded-[1.2rem] border border-[#FFE1B7] bg-[#FFF8EF] shadow-[0_16px_28px_-24px_rgba(20,41,95,0.22)]"
                    >
                      <div className="aspect-square bg-[linear-gradient(180deg,#ffffff_0%,#fff6e7_100%)]">
                        {previewImage ? (
                          <img src={previewImage} alt={product.goodsName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] font-black tracking-[0.2em] text-[#A67C45]">GIFT</div>
                        )}
                      </div>
                      <div className="px-2.5 py-2">
                        <p className="line-clamp-2 text-[11px] font-black leading-4 text-[#14295F]">{product.goodsName}</p>
                        <p className="mt-1 text-[11px] font-black text-[var(--text-accent-fixed)]">
                          {formatGiftishowPoints(getGiftishowProductPointCost(product))}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <span className="col-span-3 inline-flex rounded-full border border-dashed border-[#FFD39E] bg-[#FFF8EE] px-3 py-1 text-[11px] font-black text-[#915A1E]">
                  동기화된 상품을 불러오면 여기서 바로 고를 수 있어요.
                </span>
              )}
            </div>
          </button>
        </section>

        <section className="surface-card surface-card--light rounded-[1.8rem] px-4 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black tracking-tight text-[var(--text-primary)]">내 요청 히스토리</h2>
            </div>
            <Badge className="border-none bg-slate-100 text-slate-700 font-black">{giftishowOrders.length}건</Badge>
          </div>

          {giftishowOrders.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-bold text-muted-foreground">
              아직 보상샵 요청 내역이 없어요. 포인트가 모이면 첫 상품을 요청해 보세요.
            </div>
          ) : (
            <div className="space-y-3">
              {giftishowOrders.slice(0, 6).map((order) => (
                <div key={order.id || `${order.goodsCode}-${order.createdAt?.seconds || 0}`} className="rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-slate-900">{order.goodsName}</p>
                        <Badge className={cn('border-none font-black', getGiftishowOrderStatusTone(order.status))}>
                          {getGiftishowOrderStatusLabel(order.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {order.brandName || '브랜드'} · {order.recipientPhoneMasked || '번호 미등록'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-[#14295F]">{formatGiftishowPoints(order.pointCost)}</p>
                      <p className="mt-1 text-[11px] font-bold text-slate-500">
                        {formatGiftishowTimestamp(order.updatedAt || order.createdAt || order.requestedAt)}
                      </p>
                    </div>
                  </div>

                  {order.lastErrorMessage || order.rejectionReason || order.cancelledReason ? (
                    <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-xs font-bold leading-5 text-slate-600">
                      {order.lastErrorMessage || order.rejectionReason || order.cancelledReason}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="relative overflow-hidden rounded-[1.9rem] border border-[#D7E4FF] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.94),transparent_34%),linear-gradient(180deg,#F8FBFF_0%,#EEF4FF_100%)] px-4 py-4 shadow-[0_24px_56px_-34px_rgba(20,41,95,0.18)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-6 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.84),transparent_72%)]"
          />
          <button
            type="button"
            onClick={() => setIsPointTrackManualOpen(true)}
            className="group relative w-full pr-11 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A16]"
          >
            <span className="absolute right-0 top-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#D7E4FF] bg-white text-[#14295F] shadow-[0_14px_24px_-22px_rgba(20,41,95,0.42)] transition-transform duration-200 group-hover:translate-x-0.5">
              <ChevronRight className="h-4 w-4" />
            </span>

            <div className="min-w-0">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white text-[#14295F] shadow-[0_16px_28px_-22px_rgba(0,0,0,0.24)]">
                  <BookOpen className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col items-start gap-1.5">
                    <p className="font-aggro-display text-[1.05rem] font-black tracking-tight text-[#14295F]">메뉴얼 보기</p>
                    <span className="inline-flex rounded-full border border-white/80 bg-white/85 px-2.5 py-1 text-[10px] font-black tracking-[0.14em] text-[#6E7FA7]">
                      QUICK GUIDE
                    </span>
                  </div>
                  <p className="mt-2 text-[10.5px] font-bold leading-[1.3rem] text-[#5F729B]">
                    상자 확률과 보상 규칙, 시간대 부스트를 빠르게 확인해요.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <span className="rounded-[1rem] border border-white/85 bg-white/88 px-2.5 py-2 text-center text-[10px] font-black leading-tight text-[#17326B] shadow-sm">
                1시간마다 상자
              </span>
              <span className="rounded-[1rem] border border-white/85 bg-white/88 px-2.5 py-2 text-center text-[10px] font-black leading-tight text-[#17326B] shadow-sm">
                하루 최대 {STUDY_BOX_DAILY_LIMIT}개
              </span>
              <span className="col-span-2 rounded-[1rem] border border-white/85 bg-white/88 px-2.5 py-2 text-center text-[10px] font-black leading-tight text-[#17326B] shadow-sm">
                5시간부터 레어 확률 상승
              </span>
            </div>

            <div className="mt-3.5 rounded-[1.3rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(244,248,255,0.94)_100%)] px-4 py-4 shadow-[0_18px_28px_-24px_rgba(20,41,95,0.28)]">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDF4FF] text-[#17326B]">
                <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6E7FA7]">시간대 부스트</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="inline-flex max-w-full rounded-full bg-[#EAF1FF] px-2 py-1 text-[10px] font-black text-[#2554D7]">
                      {pointBoostCardGuide.badge}
                    </span>
                  </div>
                  <p className="mt-2 break-keep text-[13px] font-black leading-5 text-[#14295F]">
                    {pointBoostCardGuide.title}
                  </p>
                  <p className="mt-1 break-keep text-[11px] font-bold leading-5 text-[#5F729B]">
                    {pointBoostCardGuide.detail}
                  </p>
                </div>
              </div>
            </div>
          </button>
        </section>
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
                  <RewardHeroBox
                    state={isSelectedBoxVisuallyReady ? 'ready' : 'charging'}
                    stage={boxStage}
                    intense={isSelectedBoxVisuallyReady}
                    rarity={selectedBox?.rarity ?? null}
                    label={selectedBox ? `${selectedBox.hour}시간 상자` : '상자'}
                    onClick={selectedBox?.state === 'ready' && boxStage === 'idle' ? () => handleRevealBox() : undefined}
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
                {isRewardRevealed && readyBoxes.filter((box) => box.hour !== selectedBoxHour).length > 0 ? (
                  <Button
                    className="h-12 flex-1 rounded-[1.2rem] bg-[linear-gradient(180deg,#ffb24d_0%,#ff8a20_100%)] text-sm font-black text-white hover:brightness-105"
                    onClick={handleNextBox}
                  >
                    다음 상자 열기
                  </Button>
                ) : (
                  <Button
                    className="h-12 flex-1 rounded-[1.2rem] bg-[linear-gradient(180deg,#ffb24d_0%,#ff8a20_100%)] text-sm font-black text-white hover:brightness-105"
                    onClick={selectedBox?.state === 'ready' && boxStage === 'idle' ? () => handleRevealBox() : () => handleVaultChange(false)}
                    disabled={isOpeningReward}
                  >
                    {selectedBox?.state === 'ready' && boxStage === 'idle'
                      ? '지금 열기'
                      : isRewardRevealed
                        ? '확인했어요'
                        : '열고 있어요'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPointHistoryOpen} onOpenChange={setIsPointHistoryOpen}>
        <DialogContent className="w-[min(94vw,28rem)] overflow-hidden rounded-[2rem] border-none bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),transparent_30%),linear-gradient(180deg,#fffaf1_0%,#fff0dc_100%)] p-0 shadow-[0_40px_100px_-36px_rgba(0,0,0,0.32)]">
          <DialogHeader className="border-b border-[#FFE1B7]/70 px-5 pb-0 pt-5 text-left">
            <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-tight text-[#14295F]">
              <Wallet className="h-5 w-5 text-[var(--text-accent-fixed)]" />
              최근 7일 포인트
            </DialogTitle>
            <DialogDescription className="pb-4 text-sm font-bold leading-5 text-[#4D679F]">
              날짜별로 얻은 포인트를 한 번에 확인해 보세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-[1.2rem] border border-white/70 bg-white/88 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6E7FA7]">최근 7일 합계</p>
                <p className="mt-2 text-lg font-black tracking-tight text-[#14295F]">{recentPointTotal.toLocaleString()}P</p>
              </div>
              <div className="rounded-[1.2rem] border border-white/70 bg-white/88 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6E7FA7]">포인트 얻은 날</p>
                <p className="mt-2 text-lg font-black tracking-tight text-[#14295F]">{recentPointActiveDays}일</p>
              </div>
            </div>

            <ScrollArea className="max-h-[min(60vh,30rem)] pr-1">
              <div className="space-y-3">
                {recentPointHistory.map((entry) => (
                  <div
                    key={`point-history-${entry.dateKey}`}
                    className="rounded-[1.35rem] border border-white/75 bg-white/82 px-4 py-4 shadow-[0_20px_34px_-30px_rgba(20,41,95,0.24)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[#14295F]">{entry.dateLabel}</p>
                        <p className="mt-1 text-[11px] font-bold text-[#6E7FA7]">{entry.relativeLabel}</p>
                      </div>
                      <p className="text-lg font-black tracking-tight text-[var(--text-accent-fixed)]">
                        {entry.totalPoints.toLocaleString()}P
                      </p>
                    </div>

                    {entry.totalPoints > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {entry.pointItems.map((item) => (
                          <span
                            key={`${entry.dateKey}-${item.key}`}
                            className={cn(
                              'inline-flex rounded-full px-3 py-1 text-[11px] font-black',
                              POINT_BREAKDOWN_CHIP_CLASS[item.tone]
                            )}
                          >
                            {item.label} {item.points.toLocaleString()}P
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs font-bold text-[#7A89A5]">이 날에는 얻은 포인트가 없어요.</p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPointTrackManualOpen} onOpenChange={setIsPointTrackManualOpen}>
        <DialogContent className="flex max-h-[min(92dvh,46rem)] w-[min(94vw,30rem)] flex-col overflow-hidden rounded-[2rem] border-none bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),transparent_30%),linear-gradient(180deg,#F8FBFF_0%,#EFF5FF_100%)] p-0 shadow-[0_40px_100px_-36px_rgba(0,0,0,0.32)]">
          <DialogHeader className="shrink-0 border-b border-[#DCE7FB] px-5 pb-0 pt-5 text-left">
            <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-tight text-[#14295F]">
              <BookOpen className="h-5 w-5 text-[#14295F]" />
              포인트트랙 메뉴얼
            </DialogTitle>
            <DialogDescription className="pb-4 text-sm font-bold leading-5 text-[#4D679F]">
              상자 생성 규칙과 확률은 고정 규칙으로, 시간대에 따라 달라지는 건 부스트 배수예요.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
            <div className="space-y-4 px-5 py-4 pb-6">
              <section className="rounded-[1.4rem] border border-white/80 bg-white/90 px-4 py-4 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6E7FA7]">상자 생성 규칙</p>
                <div className="mt-3 grid gap-2.5">
                  <div className="rounded-[1.1rem] bg-[#F6F9FF] px-3.5 py-3">
                    <p className="text-sm font-black text-[#14295F]">공부 누적 1시간마다 상자 1개</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-[#5F729B]">
                      타이머가 켜진 실제 공부 시간 기준으로 채워지고, 하루에 최대 {STUDY_BOX_DAILY_LIMIT}개까지 열 수 있어요.
                    </p>
                  </div>
                  <div className="rounded-[1.1rem] bg-[#F6F9FF] px-3.5 py-3">
                    <p className="text-sm font-black text-[#14295F]">전날 상자는 새벽 1시 30분까지</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-[#5F729B]">
                      못 연 상자는 다음 공부일 초반까지 남아 있지만, 리셋 이후 1시 30분까지만 유지돼요.
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.4rem] border border-white/80 bg-white/90 px-4 py-4 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6E7FA7]">예시로 보면</p>
                <p className="mt-1 text-sm font-black text-[#14295F]">헷갈리는 부분만 실제 상황처럼 짧게 정리했어요.</p>

                <div className="mt-4 space-y-3">
                  {studyBoxExampleGuide.map((example) => (
                    <div key={example.key} className="rounded-[1.15rem] border border-[#E1E9F8] bg-[#F8FBFF] px-3.5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6E7FA7]">{example.eyebrow}</p>
                          <p className="mt-1 text-sm font-black text-[#14295F]">{example.title}</p>
                        </div>
                        <Badge className="border-none bg-white text-[#17326B] shadow-sm">바로 이해</Badge>
                      </div>
                      <p className="mt-3 text-base font-black tracking-tight text-[#17326B]">{example.highlight}</p>
                      <p className="mt-2 text-xs font-bold leading-5 text-[#5F729B]">{example.description}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[1.4rem] border border-white/80 bg-white/90 px-4 py-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6E7FA7]">희귀도 확률</p>
                    <p className="mt-1 text-sm font-black text-[#14295F]">1~4번째 상자와 5~8번째 상자의 확률이 달라져요.</p>
                  </div>
                  <Badge className="border-none bg-[#14295F] text-white font-black">실제 규칙</Badge>
                </div>

                <div className="mt-4 space-y-3">
                  {studyBoxManualRows.map((row) => (
                    <div key={`manual-row-${row.rarity}`} className="rounded-[1.15rem] border border-[#E1E9F8] bg-[#F8FBFF] px-3.5 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-black', STUDY_BOX_RARITY_TONES[row.rarity])}>
                            {row.label}
                          </span>
                          <span className="text-xs font-black text-[#14295F]">{row.rewardLabel}</span>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-[1rem] bg-white px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6E7FA7]">1~4번째 상자</p>
                          <p className="mt-1 text-base font-black tracking-tight text-[#14295F]">{row.earlyWeight}%</p>
                        </div>
                        <div className="rounded-[1rem] bg-white px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#6E7FA7]">5~8번째 상자</p>
                          <p className="mt-1 text-base font-black tracking-tight text-[#14295F]">{row.lateWeight}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-xs font-bold leading-5 text-[#5F729B]">
                  즉, 시간대에 따라 희귀도 확률이 바뀌는 구조는 아니고, 오늘 몇 번째 상자인지에 따라 레어/에픽 확률이 올라가요.
                </p>
              </section>

              <section className="rounded-[1.4rem] border border-white/80 bg-white/90 px-4 py-4 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6E7FA7]">시간대 부스트</p>
                <p className="mt-1 text-sm font-black text-[#14295F]">시간에 따라 달라질 수 있는 건 상자 pt 배수예요.</p>
                <p className="mt-2 text-xs font-bold leading-5 text-[#5F729B]">
                  상자를 획득한 시각에 센터가 설정한 부스트 이벤트가 있으면, 상자에서 나온 기본 pt에 배수가 적용됩니다.
                </p>

                <div className="mt-4 space-y-3">
                  <div className="rounded-[1.15rem] border border-[#E1E9F8] bg-[#F8FBFF] px-3.5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-[#14295F]">현재 진행 중</p>
                      <Badge className={cn('border-none font-black', pointBoostGuide.active.length > 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700')}>
                        {pointBoostGuide.active.length > 0 ? `${pointBoostGuide.active.length}개` : '없음'}
                      </Badge>
                    </div>
                    {pointBoostGuide.active.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {pointBoostGuide.active.map((event) => (
                          <div key={`active-boost-${event.id}`} className="rounded-[1rem] bg-white px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-black text-[#14295F]">{event.multiplierLabel}</p>
                              <span className="text-[11px] font-bold text-[#5F729B]">{event.label}</span>
                            </div>
                            {event.message ? (
                              <p className="mt-1 text-xs font-bold leading-5 text-[#5F729B]">{event.message}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs font-bold leading-5 text-[#5F729B]">지금은 부스트가 없어 상자 pt가 기본 1배로 적용돼요.</p>
                    )}
                  </div>

                  <div className="rounded-[1.15rem] border border-[#E1E9F8] bg-[#F8FBFF] px-3.5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-[#14295F]">예정된 부스트</p>
                      <Badge className={cn('border-none font-black', pointBoostGuide.upcoming.length > 0 ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-700')}>
                        {pointBoostGuide.upcoming.length > 0 ? `${pointBoostGuide.upcoming.length}개` : '없음'}
                      </Badge>
                    </div>
                    {pointBoostGuide.upcoming.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {pointBoostGuide.upcoming.slice(0, 3).map((event) => (
                          <div key={`upcoming-boost-${event.id}`} className="rounded-[1rem] bg-white px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-black text-[#14295F]">{event.multiplierLabel}</p>
                              <span className="text-[11px] font-bold text-[#5F729B]">{event.label}</span>
                            </div>
                            {event.message ? (
                              <p className="mt-1 text-xs font-bold leading-5 text-[#5F729B]">{event.message}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs font-bold leading-5 text-[#5F729B]">예정된 시간대 부스트가 없어요. 필요하면 센터에서 추가로 설정할 수 있어요.</p>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="shrink-0 border-t border-[#DCE7FB] bg-white px-5 py-4">
            <Button onClick={() => setIsPointTrackManualOpen(false)} className="h-12 w-full rounded-[1.2rem] font-black">
              확인했어요
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isGiftishowShopOpen} onOpenChange={setIsGiftishowShopOpen}>
        <DialogContent className="flex max-h-[min(92svh,46rem)] w-[min(94vw,34rem)] flex-col overflow-hidden rounded-[2rem] border-none bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),transparent_30%),linear-gradient(180deg,#fffaf1_0%,#fff0dc_100%)] p-0 shadow-[0_40px_100px_-36px_rgba(0,0,0,0.32)]">
          <DialogHeader className="shrink-0 border-b border-[#FFE1B7]/70 px-5 pb-0 pt-5 text-left">
            <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-tight text-[#14295F]">
              <Gift className="h-5 w-5 text-[var(--text-accent-fixed)]" />
              트랙 상점
            </DialogTitle>
            <DialogDescription className="pb-4 text-sm font-bold leading-5 text-[#4D679F]">
              검색으로 원하는 상품을 빠르게 찾고, 필요한 순간 바로 교환 요청해 보세요.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col space-y-4 px-5 py-4">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-[1.2rem] border border-white/70 bg-white/88 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6E7FA7]">동기화 상품</p>
                <p className="mt-2 text-lg font-black tracking-tight text-[#14295F]">{syncedGiftishowProducts.length.toLocaleString()}개</p>
              </div>
              <div className="rounded-[1.2rem] border border-white/70 bg-white/88 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6E7FA7]">교환 가능</p>
                <p className="mt-2 text-lg font-black tracking-tight text-[#14295F]">{availableGiftishowProducts.length.toLocaleString()}개</p>
              </div>
              <div className="rounded-[1.2rem] border border-white/70 bg-white/88 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6E7FA7]">내 포인트</p>
                <p className="mt-2 text-lg font-black tracking-tight text-[#14295F]">{formatGiftishowPoints(pointBalance)}</p>
              </div>
            </div>

            <div className="space-y-3 rounded-[1.35rem] border border-white/70 bg-white/72 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6E7FA7]" />
                <Input
                  value={giftishowSearch}
                  onChange={(event) => setGiftishowSearch(event.target.value)}
                  placeholder="상품명, 브랜드명으로 검색"
                  className="h-11 rounded-[1rem] border-[#E5D7BF] bg-white pl-10 font-bold text-[#14295F] placeholder:text-[#8AA0C8]"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={giftishowFilterMode === 'available' ? 'secondary' : 'outline'}
                  className={cn(
                    'rounded-full font-black',
                    giftishowFilterMode === 'available'
                      ? 'bg-[var(--accent-orange)] text-white hover:bg-[var(--accent-orange)]/90'
                      : 'border-[#E5D7BF] bg-white text-[#6E7FA7]'
                  )}
                  onClick={() => setGiftishowFilterMode('available')}
                >
                  교환 가능만
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={giftishowFilterMode === 'all' ? 'secondary' : 'outline'}
                  className={cn(
                    'rounded-full font-black',
                    giftishowFilterMode === 'all'
                      ? 'bg-[#14295F] text-white hover:bg-[#14295F]/90'
                      : 'border-[#E5D7BF] bg-white text-[#6E7FA7]'
                  )}
                  onClick={() => setGiftishowFilterMode('all')}
                >
                  전체 보기
                </Button>
                <span className="inline-flex items-center rounded-full bg-[#FFF3E2] px-3 py-1 text-[11px] font-black text-[#915A1E]">
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  {filteredGiftishowProducts.length.toLocaleString()}개 찾음
                </span>
              </div>
            </div>

            {!isGiftishowProductsLoading && isUsingGiftishowCatalogFallback ? (
              <div className="rounded-[1.2rem] border border-[#D7E4FF] bg-[#F4F8FF] px-3 py-3 text-xs font-bold leading-5 text-[#4D679F]">
                학생용 추천 필터로 표시할 상품이 비어 있어서, 지금은 동기화된 전체 상품을 먼저 보여드리고 있어요.
              </div>
            ) : null}

            {!isGiftishowProductsLoading &&
            giftishowFilterMode === 'all' &&
            giftishowProducts.length > 0 &&
            availableGiftishowProducts.length === 0 ? (
              <div className="rounded-[1.2rem] border border-[#FFE0B2] bg-[#FFF7EC] px-3 py-3 text-xs font-bold leading-5 text-[#915A1E]">
                지금 바로 요청 가능한 상품이 없어 전체 상품을 먼저 보여드리고 있어요. 요청 버튼은 준비가 끝난 상품부터 자동으로 열립니다.
              </div>
            ) : null}

            {!hasStudentPhone ? (
              <div className="rounded-[1.2rem] border border-rose-100 bg-rose-50 px-3 py-3 text-xs font-bold leading-5 text-rose-700">
                학생 휴대폰 번호가 아직 등록되지 않았어요. 프로필 설정에서 번호를 저장하면 상품 요청 버튼이 활성화돼요.
              </div>
            ) : null}

            <ScrollArea className="min-h-0 flex-1 pr-1">
              <div className="space-y-3">
                {isGiftishowProductsLoading ? (
                  <div className="rounded-[1.4rem] border border-dashed border-[#D7E4FF] bg-white/70 px-4 py-10 text-center text-sm font-bold text-[#6E7FA7]">
                    <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
                    상품 목록을 불러오는 중이에요.
                  </div>
                ) : giftishowProductsError ? (
                  <div className="rounded-[1.4rem] border border-dashed border-rose-200 bg-rose-50/90 px-4 py-10 text-center text-sm font-bold text-rose-700">
                    상품 목록을 불러오지 못했어요. 잠시 뒤 다시 열어보거나 센터에 알려 주세요.
                  </div>
                ) : filteredGiftishowProducts.length === 0 ? (
                  <div className="rounded-[1.4rem] border border-dashed border-[#FFD39E] bg-white/70 px-4 py-10 text-center text-sm font-bold text-[#7B5A2A]">
                    {syncedGiftishowProducts.length === 0
                      ? '아직 동기화된 상품이 없어요. 센터에서 카탈로그를 연결하면 이곳에서 바로 고를 수 있어요.'
                      : giftishowSearchQuery
                        ? '검색 결과가 없어요. 다른 키워드로 다시 찾아보세요.'
                        : '지금 조건에 맞는 상품이 없어요. 전체 보기로 바꾸거나 잠시 후 다시 확인해 주세요.'}
                  </div>
                ) : (
                  <>
                    {visibleGiftishowProducts.map((product) => {
                      const disabledReason = getGiftishowRequestDisabledReason({
                        settings: giftishowSettings,
                        product,
                        pointBalance,
                        hasStudentPhone,
                      });
                      const productImage = getGiftishowProductImage(product);
                      const isRequesting = requestingGoodsCode === product.goodsCode;

                      return (
                        <div
                          key={`giftishow-dialog-${product.id || product.goodsCode}`}
                          className="overflow-hidden rounded-[1.3rem] border border-white/70 bg-white/92 shadow-[0_18px_32px_-24px_rgba(20,41,95,0.22)]"
                        >
                          <div className="flex gap-3 p-3">
                            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[1rem] border border-[#F0E2CA] bg-[linear-gradient(180deg,#f8fafc_0%,#fff6e8_100%)]">
                              {productImage ? (
                                <img src={productImage} alt={product.goodsName} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full items-center justify-center text-[10px] font-black tracking-[0.2em] text-[#7D8FB3]">GIFT</div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge className={cn('border-none px-2 py-0.5 text-[9px] font-black', isGiftishowProductAvailable(product, giftishowSettings) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700')}>
                                      {product.goodsStateCd || 'UNKNOWN'}
                                    </Badge>
                                    <p className="truncate text-[11px] font-bold text-[#6E7FA7]">
                                      {product.brandName || product.affiliate || '브랜드'}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={disabledReason ? 'outline' : 'secondary'}
                                  className="h-8 shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-black"
                                  disabled={Boolean(disabledReason) || isRequesting}
                                  onClick={() => void handleGiftishowRequest(product)}
                                >
                                  {isRequesting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                                  요청하기
                                </Button>
                              </div>

                              <p className="mt-1.5 line-clamp-1 text-sm font-black leading-5 text-[#14295F]">{product.goodsName}</p>

                              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#6E7FA7]">교환 포인트</p>
                              <p className="mt-0.5 text-lg font-black tracking-tight text-[var(--text-accent-fixed)]">
                                {formatGiftishowPoints(getGiftishowProductPointCost(product))}
                              </p>

                              {disabledReason ? (
                                <p className="mt-1 text-[10px] font-bold leading-4 text-[#915A1E]">{disabledReason}</p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  </>
                )}
              </div>
            </ScrollArea>

            {totalGiftishowPages > 1 ? (
              <div className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-[#E5D7BF] bg-white/88 px-3 py-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-full border-[#E5D7BF] bg-white px-4 font-black text-[#14295F] disabled:opacity-40"
                  disabled={currentGiftishowPage <= 1}
                  onClick={() => setGiftishowPage((page) => Math.max(1, page - 1))}
                >
                  이전
                </Button>
                <div className="text-center">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7D8FB3]">페이지 이동하기</p>
                  <p className="mt-1 text-sm font-black text-[#14295F]">
                    {currentGiftishowPage} / {totalGiftishowPages}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-full border-[#E5D7BF] bg-white px-4 font-black text-[#14295F] disabled:opacity-40"
                  disabled={currentGiftishowPage >= totalGiftishowPages}
                  onClick={() => setGiftishowPage((page) => Math.min(totalGiftishowPages, page + 1))}
                >
                  다음
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
