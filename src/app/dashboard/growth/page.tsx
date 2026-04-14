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
  isGiftishowProductAvailable,
  sortGiftishowOrdersByRecent,
  sortGiftishowProducts,
} from '@/lib/giftishow';
import {
  getAvailableStudyBoxMilestones,
  getClaimedStudyBoxes,
  getOpenedStudyBoxes,
  getStudyBoxFallbackRarity,
  normalizeStoredStudyBoxRewardEntries,
  normalizeStudyBoxHourValues,
  rollStudyBoxReward,
  upsertStudyBoxRewardEntry,
  type StudyBoxReward,
} from '@/lib/student-rewards';
import { readStudyBoxOpenedCache, writeStudyBoxOpenedCache } from '@/lib/study-box-opened-cache';
import { openStudyRewardBoxSecure } from '@/lib/study-box-actions';
import { GiftishowOrder, GiftishowProduct, GiftishowSettings, GrowthProgress, StudyLogDay } from '@/lib/types';
import { cn } from '@/lib/utils';

type FloatingGain = {
  key: number;
  amount: number;
};

const STUDY_BOX_CLAIM_CACHE_PREFIX = 'point-track:claimed-boxes';
const STUDY_BOX_ARRIVAL_TOAST_PREFIX = 'point-track:arrival-toast';
const EMPTY_STUDY_BOX_CACHE_KEY = '__empty-claim-cache__';
const GIFTISHOW_PRODUCT_FETCH_LIMIT = 2500;
const GIFTISHOW_PRODUCT_PAGE_SIZE = 32;

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
  if (!isGiftishowProductAvailable(product, settings)) return '현재 교환할 수 없는 상품이에요.';
  if (Math.max(0, Number(pointBalance || 0)) < Math.max(0, Number(product?.pointCost || 0))) return '포인트가 부족해요.';
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
    <div className="surface-card point-track-panel on-dark relative min-w-0 rounded-[1.35rem] px-3 py-3">
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
  const [requestingGoodsCode, setRequestingGoodsCode] = useState<string | null>(null);
  const [isGiftishowShopOpen, setIsGiftishowShopOpen] = useState(false);
  const [giftishowSearch, setGiftishowSearch] = useState('');
  const [giftishowFilterMode, setGiftishowFilterMode] = useState<'available' | 'all'>('available');
  const [visibleGiftishowCount, setVisibleGiftishowCount] = useState(GIFTISHOW_PRODUCT_PAGE_SIZE);
  const timeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const liveClaimKeyRef = useRef<string | null>(null);
  const [hydratedClaimCacheKey, setHydratedClaimCacheKey] = useState<string | null>(null);

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: progress, isLoading } = useDoc<GrowthProgress>(progressRef);

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userProfile } = useDoc<{ phoneNumber?: string }>(userProfileRef, { enabled: Boolean(user) });

  const studentProfileRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'students', user.uid);
  }, [firestore, activeMembership?.id, user?.uid]);
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
  const { data: giftishowProductsRaw } = useCollection<GiftishowProduct>(giftishowProductsQuery, {
    enabled: Boolean(activeMembership && user),
  });

  const giftishowOrdersQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'giftishowOrders'),
      where('studentId', '==', user.uid),
      limit(50)
    );
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: giftishowOrdersRaw } = useCollection<GiftishowOrder>(giftishowOrdersQuery, {
    enabled: Boolean(activeMembership && user),
  });

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
  const persistedRewardEntries = useMemo(
    () => normalizeStoredStudyBoxRewardEntries(todayStatus.studyBoxRewards),
    [todayStatus]
  );
  const persistedOpenedBoxes = useMemo(() => getOpenedStudyBoxes(todayStatus), [todayStatus]);

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
    const cachedOpenedBoxes = readStudyBoxOpenedCache(user?.uid, todayKey);
    const nextOpenedBoxes = normalizeStudyBoxHours([...persistedOpenedBoxes, ...cachedOpenedBoxes]);

    setOpenedBoxes(nextOpenedBoxes);
    writeStudyBoxOpenedCache(user?.uid, todayKey, nextOpenedBoxes);
  }, [persistedOpenedBoxes, todayKey, user?.uid]);

  useEffect(() => {
    setPointBalance(Math.max(0, Number(progress?.pointsBalance || 0)));
  }, [progress?.pointsBalance]);

  const resolvedStudentPhone = useMemo(() => {
    return normalizePhone(
      extractPhoneNumber(studentProfile) || userProfile?.phoneNumber || activeMembership?.phoneNumber || ''
    );
  }, [activeMembership?.phoneNumber, studentProfile, userProfile?.phoneNumber]);

  const hasStudentPhone = useMemo(() => isValidKoreanMobilePhone(resolvedStudentPhone), [resolvedStudentPhone]);

  const giftishowProducts = useMemo(
    () => sortGiftishowProducts(giftishowProductsRaw || []),
    [giftishowProductsRaw]
  );
  const giftishowOrders = useMemo(
    () => sortGiftishowOrdersByRecent(giftishowOrdersRaw || []),
    [giftishowOrdersRaw]
  );
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
  const visibleGiftishowProducts = useMemo(
    () => filteredGiftishowProducts.slice(0, visibleGiftishowCount),
    [filteredGiftishowProducts, visibleGiftishowCount]
  );
  const hasMoreGiftishowProducts = filteredGiftishowProducts.length > visibleGiftishowProducts.length;

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

  useEffect(() => {
    setVisibleGiftishowCount(GIFTISHOW_PRODUCT_PAGE_SIZE);
  }, [giftishowFilterMode, giftishowSearchQuery, isGiftishowShopOpen]);

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
  const heroBoxRarity =
    readyBoxes[0]?.rarity ??
    boxes.find((box) => box.state === 'charging')?.rarity ??
    boxes[0]?.rarity ??
    'common';
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
    if (!selectedBox || selectedBox.state !== 'ready' || isClaimingBox || !activeMembership?.id || !user?.uid) return;
    const targetHour = selectedBox.hour;
    const currentDayStatus = {
      ...todayStatus,
      claimedStudyBoxes: claimedBoxes,
      openedStudyBoxes: openedBoxes,
      studyBoxRewards: rewardEntries,
    };
    const rewardOpenPromise = openStudyRewardBoxSecure({
      centerId: activeMembership.id,
      studentId: user.uid,
      dateKey: todayKey,
      hour: targetHour,
      reward: rewardByHour.get(targetHour) || rollStudyBoxReward(targetHour),
      dayStatus: currentDayStatus,
      currentPointsBalance: pointBalance,
      currentTotalPointsEarned: Number(progress?.totalPointsEarned || 0),
    })
      .then((result) => ({ ok: true as const, result }))
      .catch((error) => ({ ok: false as const, error }));

    setIsClaimingBox(true);
    setBoxStage('shake');

    const shakeTimeout = setTimeout(() => {
      setBoxStage('burst');
    }, 380);
    timeoutsRef.current.push(shakeTimeout);

    const revealTimeout = setTimeout(async () => {
      try {
        const rewardResult = await rewardOpenPromise;
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
          ?? rewardByHour.get(targetHour)?.awardedPoints
          ?? selectedBox.reward
          ?? 0;

        setOpenedBoxes(nextOpenedBoxes);
        setClaimedBoxes(nextClaimedBoxes);
        writeStudyBoxOpenedCache(user.uid, todayKey, nextOpenedBoxes);
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
    }, 520);

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

  const handleGiftishowRequest = async (product: GiftishowProduct) => {
    if (!activeMembership?.id || !product.goodsCode) return;

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
            {boxes.map((box) => (
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
                  <p className="font-aggro-display text-[1.05rem] font-black tracking-tight text-[#14295F]">Giftishow 보상샵</p>
                  <p className="mt-0.5 text-[11px] font-black tracking-[0.18em] text-[#C77718]">POINT EXCHANGE</p>
                </div>
              </div>
              <p className="mt-3 text-sm font-bold leading-5 text-[#24457f]">
                관리자 승인 후 학생 번호로 MMS 쿠폰이 발송돼요. 검색해서 원하는 상품을 바로 골라볼 수 있어요.
              </p>
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

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <div className="rounded-[1.3rem] border border-white/70 bg-white/88 px-3 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6E7FA7]">내 포인트</p>
              <p className="mt-2 text-lg font-black tracking-tight text-[#14295F]">{formatGiftishowPoints(pointBalance)}</p>
            </div>
            <div className="rounded-[1.3rem] border border-white/70 bg-white/88 px-3 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6E7FA7]">동기화 상품</p>
              <p className="mt-2 text-lg font-black tracking-tight text-[#14295F]">{giftishowProducts.length.toLocaleString()}개</p>
            </div>
            <div className="col-span-2 rounded-[1.3rem] border border-white/70 bg-white/88 px-3 py-3 sm:col-span-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6E7FA7]">교환 가능</p>
              <p className="mt-2 text-lg font-black tracking-tight text-[#14295F]">{availableGiftishowProducts.length.toLocaleString()}개</p>
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
                <p className="mt-1 text-[12px] font-bold leading-5 text-[#4D679F]">
                  전체 {giftishowProducts.length.toLocaleString()}개 상품을 검색하고, 포인트에 맞는 상품만 골라 요청할 수 있어요.
                </p>
              </div>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D7E4FF] bg-white text-[#14295F]">
                <ChevronRight className="h-4 w-4" />
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {giftishowPreviewProducts.length > 0 ? (
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
                        <p className="mt-1 text-[11px] font-black text-[var(--text-accent-fixed)]">{formatGiftishowPoints(product.pointCost)}</p>
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

      <Dialog open={isGiftishowShopOpen} onOpenChange={setIsGiftishowShopOpen}>
        <DialogContent className="w-[min(94vw,34rem)] overflow-hidden rounded-[2rem] border-none bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.96),transparent_30%),linear-gradient(180deg,#fffaf1_0%,#fff0dc_100%)] p-0 shadow-[0_40px_100px_-36px_rgba(0,0,0,0.32)]">
          <DialogHeader className="border-b border-[#FFE1B7]/70 px-5 pb-0 pt-5 text-left">
            <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-tight text-[#14295F]">
              <Gift className="h-5 w-5 text-[var(--text-accent-fixed)]" />
              Giftishow 상품 고르기
            </DialogTitle>
            <DialogDescription className="pb-4 text-sm font-bold leading-5 text-[#4D679F]">
              검색으로 원하는 상품을 빠르게 찾고, 필요한 순간 바로 교환 요청해 보세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-[1.2rem] border border-white/70 bg-white/88 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6E7FA7]">동기화 상품</p>
                <p className="mt-2 text-lg font-black tracking-tight text-[#14295F]">{giftishowProducts.length.toLocaleString()}개</p>
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

            {!hasStudentPhone ? (
              <div className="rounded-[1.2rem] border border-rose-100 bg-rose-50 px-3 py-3 text-xs font-bold leading-5 text-rose-700">
                학생 휴대폰 번호가 아직 등록되지 않았어요. 프로필 설정에서 번호를 저장하면 상품 요청 버튼이 활성화돼요.
              </div>
            ) : null}

            <ScrollArea className="max-h-[min(62vh,34rem)] pr-1">
              <div className="space-y-3">
                {filteredGiftishowProducts.length === 0 ? (
                  <div className="rounded-[1.4rem] border border-dashed border-[#FFD39E] bg-white/70 px-4 py-10 text-center text-sm font-bold text-[#7B5A2A]">
                    {giftishowProducts.length === 0
                      ? '아직 동기화된 상품이 없어요. 센터에서 카탈로그를 연결하면 이곳에서 바로 고를 수 있어요.'
                      : '검색 결과가 없어요. 다른 키워드로 다시 찾아보세요.'}
                  </div>
                ) : (
                  visibleGiftishowProducts.map((product) => {
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
                        className="overflow-hidden rounded-[1.45rem] border border-white/70 bg-white/92 shadow-[0_18px_32px_-24px_rgba(20,41,95,0.22)]"
                      >
                        <div className="flex gap-3 p-3.5">
                          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[1.15rem] border border-[#F0E2CA] bg-[linear-gradient(180deg,#f8fafc_0%,#fff6e8_100%)]">
                            {productImage ? (
                              <img src={productImage} alt={product.goodsName} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-[10px] font-black tracking-[0.2em] text-[#7D8FB3]">GIFT</div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={cn('border-none font-black', isGiftishowProductAvailable(product, giftishowSettings) ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700')}>
                                {product.goodsStateCd || 'UNKNOWN'}
                              </Badge>
                              <p className="truncate text-[11px] font-bold text-[#6E7FA7]">
                                {product.brandName || product.affiliate || '브랜드'}
                              </p>
                            </div>

                            <p className="mt-2 line-clamp-2 text-sm font-black leading-5 text-[#14295F]">{product.goodsName}</p>

                            <div className="mt-3 flex items-end justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6E7FA7]">교환 포인트</p>
                                <p className="mt-1 text-lg font-black tracking-tight text-[var(--text-accent-fixed)]">
                                  {formatGiftishowPoints(product.pointCost)}
                                </p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant={disabledReason ? 'outline' : 'secondary'}
                                className="rounded-full font-black"
                                disabled={Boolean(disabledReason) || isRequesting}
                                onClick={() => void handleGiftishowRequest(product)}
                              >
                                {isRequesting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                                요청하기
                              </Button>
                            </div>

                            {disabledReason ? (
                              <p className="mt-2 text-[11px] font-bold leading-5 text-[#915A1E]">{disabledReason}</p>
                            ) : (
                              <p className="mt-2 text-[11px] font-bold leading-5 text-[#4D679F]">
                                승인되면 {resolvedStudentPhone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3')} 번호로 발송돼요.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {hasMoreGiftishowProducts ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full rounded-[1.2rem] border-[#E5D7BF] bg-white/88 font-black text-[#14295F]"
                    onClick={() => setVisibleGiftishowCount((current) => current + GIFTISHOW_PRODUCT_PAGE_SIZE)}
                  >
                    상품 더 보기 ({Math.min(GIFTISHOW_PRODUCT_PAGE_SIZE, filteredGiftishowProducts.length - visibleGiftishowProducts.length)}개)
                  </Button>
                ) : null}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
