'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import {
  CalendarDays,
  Clock3,
  Crown,
  ListOrdered,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import {
  EMPTY_STUDENT_RANKING_SNAPSHOT,
  fetchStudentRankingSnapshot,
  type StudentRankEntry,
  type StudentRankingSnapshot,
} from '@/lib/student-ranking-client';
import { getDailyRankWindowState, toKstDateKey } from '@/lib/student-ranking-policy';
import {
  assignStudentRankingTrackRanks,
  getLiveAdjustedStudentRankValue,
} from '@/lib/student-ranking-live';
import { cn } from '@/lib/utils';

type RankRange = 'daily' | 'weekly' | 'monthly';
type BattleMode = 'attack' | 'defense' | 'danger' | 'chase';
type PressureLevel = 'stable' | 'warning' | 'critical';
type LogTone = 'orange' | 'red' | 'blue' | 'gold';

type BattleEntry = StudentRankEntry & {
  schoolNameSnapshot?: string | null;
  isViewer?: boolean;
};

type LiveLog = {
  id: string;
  tone: LogTone;
  badge: string;
  title: string;
  detail: string;
  target: 'top' | 'viewer' | 'rival' | 'board';
};

type FloatingEvent = {
  id: string;
  tone: LogTone;
  label: string;
  target: 'top' | 'viewer' | 'rival';
};

type RecommendationTone = 'plan' | 'review' | 'balance' | 'method' | 'mindset';

type BattleRecommendation = {
  id: string;
  tone: RecommendationTone;
  title: string;
  action: string;
  reason: string;
  explainWhy: string;
  cta: string;
};

const SNAPSHOT_REFRESH_MS = 30000;
const HERO_ROTATE_MS = 3600;

const RANGE_META: Record<
  RankRange,
  { label: string; title: string; subtitle: string }
> = {
  daily: {
    label: '일간',
    title: '실시간 경쟁 랭킹',
    subtitle: '오늘 상위권 흐름과 내 격차를 바로 읽을 수 있습니다.',
  },
  weekly: {
    label: '주간',
    title: '주간 랭킹',
    subtitle: '이번 주 누적 기준으로 선두권과 내 위치를 비교합니다.',
  },
  monthly: {
    label: '월간',
    title: '월간 랭킹',
    subtitle: '월간 페이스와 추격 여지를 확인합니다. 포인트는 2026년 5월 랭킹부터 지급됩니다.',
  },
};

const TONE_CLASS_MAP: Record<
  LogTone,
  {
    chip: string;
    glow: string;
    line: string;
    text: string;
  }
> = {
  orange: {
    chip: 'border-[#FFB66E]/35 bg-[rgba(255,182,110,0.12)] text-[#FFC98F]',
    glow: 'shadow-[0_0_28px_rgba(255,182,110,0.16)]',
    line: 'from-[#FFB76C] via-[#FFB76C]/40 to-transparent',
    text: 'text-[#FFC98F]',
  },
  red: {
    chip: 'border-[#FF928D]/35 bg-[rgba(255,124,124,0.12)] text-[#FFB4AE]',
    glow: 'shadow-[0_0_28px_rgba(255,124,124,0.16)]',
    line: 'from-[#FF8A82] via-[#FF8A82]/35 to-transparent',
    text: 'text-[#FFB4AE]',
  },
  blue: {
    chip: 'border-[#86B4FF]/35 bg-[rgba(116,164,255,0.12)] text-[#A9C7FF]',
    glow: 'shadow-[0_0_28px_rgba(116,164,255,0.16)]',
    line: 'from-[#7DA8FF] via-[#7DA8FF]/35 to-transparent',
    text: 'text-[#A9C7FF]',
  },
  gold: {
    chip: 'border-[#F5D07B]/35 bg-[rgba(245,208,123,0.12)] text-[#FFE39E]',
    glow: 'shadow-[0_0_28px_rgba(245,208,123,0.16)]',
    line: 'from-[#F5D07B] via-[#F5D07B]/38 to-transparent',
    text: 'text-[#FFE39E]',
  },
};

const RANKING_PAGE_SHELL_CLASS =
  'bg-[radial-gradient(circle_at_top,rgba(86,129,222,0.3),transparent_24%),radial-gradient(circle_at_86%_8%,rgba(255,190,104,0.14),transparent_20%),linear-gradient(180deg,#071120_0%,#0C1D3F_42%,#14295F_100%)] text-white';
const MOBILE_BATTLE_PANEL_CLASS =
  'rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(78,120,213,0.26),transparent_34%),linear-gradient(180deg,rgba(8,19,40,0.96)_0%,rgba(13,30,63,0.98)_100%)] shadow-[0_30px_64px_-34px_rgba(0,0,0,0.82)] backdrop-blur-xl';
const MOBILE_BATTLE_INSET_CLASS =
  'rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.03)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_38px_-30px_rgba(0,0,0,0.56)]';
const MOBILE_BATTLE_STRIP_CLASS =
  'rounded-[1.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.04)_100%)] shadow-[0_18px_34px_-28px_rgba(0,0,0,0.45)]';
const RANKING_SECTION_PANEL_CLASS =
  'rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,19,39,0.9)_0%,rgba(13,30,63,0.96)_100%)] shadow-[0_28px_70px_-36px_rgba(0,0,0,0.85)] backdrop-blur-xl';
const RANKING_KICKER_CLASS =
  'inline-flex items-center gap-2 rounded-full border border-[#F5C97B]/30 bg-[rgba(255,198,112,0.08)] px-3 py-2 text-[11px] font-black tracking-[0.2em] text-[#FFD89A]';
const RANKING_STATUS_BADGE_CLASS =
  'rounded-full border border-white/12 bg-[rgba(255,255,255,0.06)] px-3 py-1.5 text-[10px] font-black tracking-[0.18em] text-[#B7C7E8]';
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RANKING_HISTORY_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function isValidRankingDateKey(value: string | null | undefined) {
  return Boolean(value && DATE_KEY_PATTERN.test(value));
}

function isRankRange(value: string | null): value is RankRange {
  return value === 'daily' || value === 'weekly' || value === 'monthly';
}

function normalizeRankingRole(role?: string | null) {
  return role?.trim().toLowerCase().replace(/[\s_-]+/g, '') || '';
}

function canViewRankingHistory(role?: string | null) {
  return ['student', 'teacher', 'centeradmin', 'owner'].includes(normalizeRankingRole(role));
}

function getRankingDateKeyOffset(dateKey: string, offsetDays: number) {
  if (!isValidRankingDateKey(dateKey)) return dateKey;
  const date = new Date(`${dateKey}T12:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return toKstDateKey(new Date(date.getTime() + offsetDays * DAY_MS));
}

function clampRankingDateKey(dateKey: string, minDateKey: string, maxDateKey: string) {
  if (!isValidRankingDateKey(dateKey)) return null;
  if (dateKey < minDateKey) return minDateKey;
  if (dateKey > maxDateKey) return maxDateKey;
  return dateKey;
}

function formatRankingDateLabel(dateKey: string) {
  if (!isValidRankingDateKey(dateKey)) return '기준일 없음';
  const [, month, day] = dateKey.split('-');
  return `${dateKey} 기준 · ${Number(month)}/${Number(day)}`;
}

function getHistoryRangeLabel(range: RankRange) {
  if (range === 'daily') return '일간';
  if (range === 'weekly') return '주간';
  return '월간';
}

function getRankingHistorySummaryLabel(range: RankRange, dateKey: string) {
  const rangeLabel = getHistoryRangeLabel(range);
  if (range === 'daily') return `${formatRankingDateLabel(dateKey)} ${rangeLabel} 랭킹`;
  if (range === 'weekly') return `${formatRankingDateLabel(dateKey)} 포함 주간 랭킹`;
  return `${formatRankingDateLabel(dateKey)} 포함 월간 랭킹`;
}

function formatSchoolName(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return '학교 미지정';
  return trimmed;
}

function formatStudyClock(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours <= 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

function formatStudyCompact(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${hours}시간 ${mins}분`;
}

function formatGapLabel(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  if (safe <= 0) return '0분';
  if (safe < 60) return `${safe}분`;
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

function maskLeaderboardStudentName(name: string) {
  const normalized = name.trim();
  if (!normalized || normalized === '나' || normalized.includes('*')) return normalized;

  const chars = Array.from(normalized);
  if (chars.length <= 1) return normalized;
  if (chars.length === 2) return `${chars[0]}*`;
  return `${chars[0]}*${chars[chars.length - 1]}`;
}

function getBattleTrackLabel(range: RankRange) {
  return range === 'daily' ? '일간 랭킹' : range === 'weekly' ? '주간 랭킹' : '월간 랭킹';
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ensureViewerEntry(entries: StudentRankEntry[], viewerId: string) {
  const hasViewer = entries.some((entry) => entry.studentId === viewerId);
  if (hasViewer) {
    return assignStudentRankingTrackRanks(entries.map((entry) => ({ ...entry, isViewer: entry.studentId === viewerId })));
  }

  const fallbackViewer: BattleEntry = {
    id: `viewer-${viewerId}`,
    studentId: viewerId,
    displayNameSnapshot: '나',
    classNameSnapshot: null,
    schoolNameSnapshot: '현재 사용자',
    value: 0,
    rank: 0,
    isViewer: true,
    liveStatus: null,
    liveStartedAtMs: null,
  };

  return assignStudentRankingTrackRanks([...entries.map((entry) => ({ ...entry, isViewer: entry.studentId === viewerId })), fallbackViewer]);
}

function buildStudentRankingBattleEntries(entries: StudentRankEntry[], viewerId: string, shouldIncludeViewerFallback: boolean) {
  const limitedEntries = entries.slice(0, 50);

  if (shouldIncludeViewerFallback) {
    return ensureViewerEntry(limitedEntries, viewerId).map((entry) => ({
      ...entry,
      isViewer: entry.studentId === viewerId,
    }));
  }

  return assignStudentRankingTrackRanks(
    limitedEntries.map((entry) => ({
      ...entry,
      isViewer: false,
    }))
  );
}

function getBattleMode(rank: number, diffAbove: number, diffBelow: number): BattleMode {
  if (rank === 1) return diffBelow <= 24 ? 'danger' : 'defense';
  if (diffAbove <= 20) return 'attack';
  if (diffBelow <= 18) return 'danger';
  return 'chase';
}

function getPressureLevel(rank: number, diffAbove: number, diffBelow: number): PressureLevel {
  if ((rank === 1 && diffBelow <= 18) || diffAbove <= 12 || diffBelow <= 10) return 'critical';
  if ((rank === 1 && diffBelow <= 36) || diffAbove <= 36 || diffBelow <= 25) return 'warning';
  return 'stable';
}

function buildHeroMessages(params: {
  mode: BattleMode;
  diffAbove: number;
  diffBelow: number;
  viewerRank: number;
  latestLog?: LiveLog | null;
}) {
  const { mode, diffAbove, diffBelow, viewerRank, latestLog } = params;
  const messages: string[] = [];

  if (mode === 'attack') {
    messages.push(`지금 ${Math.max(8, Math.min(diffAbove + 1, 18))}분 더 쌓으면 상위권과 거의 같은 선에 섭니다`);
    messages.push('상위권과의 간격이 빠르게 줄고 있습니다');
  }

  if (mode === 'danger') {
    messages.push('바로 아래 순위와의 간격이 좁아졌습니다');
    messages.push(`지금 흐름이 끊기면 ${Math.max(8, Math.min(diffBelow + 4, 16))}분 차이까지 가까워질 수 있어요`);
  }

  if (mode === 'defense') {
    messages.push('현재 선두 흐름을 안정적으로 유지하고 있습니다');
    messages.push('지금 페이스를 유지하면 현재 위치를 안정적으로 지킬 수 있어요');
  }

  if (mode === 'chase') {
    messages.push('지금 블록이 순위 변화를 만들 수 있는 구간입니다');
    messages.push('상위권 흐름과의 간격을 먼저 확인해보세요');
  }

  if (viewerRank > 2) {
    messages.push('상위권 진입 여부가 이번 블록에 달려 있습니다');
  }

  if (latestLog) {
    messages.push(latestLog.title);
  }

  return [...new Set(messages)].slice(0, 4);
}

function buildInitialLogs(entries: BattleEntry[], viewerId: string) {
  if (!entries.length) return [];

  const top = entries[0];
  const viewer = entries.find((entry) => entry.studentId === viewerId) ?? entries[1] ?? entries[0];
  const rival = entries.find((entry) => entry.rank === viewer.rank + 1) ?? entries[2] ?? viewer;
  const diffAbove = Math.max(0, (top?.value ?? viewer.value) - viewer.value);
  const diffBelow = rival && rival.studentId !== viewer.studentId ? Math.max(0, viewer.value - rival.value) : 0;
  const logs: LiveLog[] = [
    {
      id: 'seed-top',
      tone: 'gold',
      badge: '현재 1위',
      title: `${top?.displayNameSnapshot ?? '학생'} 님이 선두입니다`,
      detail: `현재 기준 ${formatStudyClock(top?.value ?? 0)} 누적으로 가장 앞서 있습니다.`,
      target: 'top',
    },
    {
      id: 'seed-viewer',
      tone: viewer.rank === 1 ? 'blue' : 'orange',
      badge: '내 위치',
      title: viewer.rank === 1 ? '현재 내가 선두를 유지하고 있어요' : `현재 ${viewer.rank}위에서 추격 중입니다`,
      detail:
        viewer.rank === 1
          ? `바로 아래와 ${formatGapLabel(diffBelow)} 차이입니다.`
          : `1위와 ${formatGapLabel(diffAbove)} 차이입니다.`,
      target: 'viewer',
    },
  ];

  if (rival && rival.studentId !== viewer.studentId) {
    logs.push({
      id: 'seed-rival',
      tone: 'red',
      badge: '근접 순위',
      title: `${rival.displayNameSnapshot} 님이 바로 아래 순위에 있습니다`,
      detail: `현재 간격은 ${formatGapLabel(diffBelow)}입니다.`,
      target: 'rival',
    });
  }

  return logs;
}

function buildMainRecommendations(params: {
  viewer: BattleEntry;
  top: BattleEntry | null;
  below: BattleEntry | null;
  logs: LiveLog[];
}) {
  const { viewer, top, below, logs } = params;
  const recommendations: BattleRecommendation[] = [];
  const diffAbove = Math.max(0, (top?.value ?? viewer.value) - viewer.value);
  const diffBelow = below ? Math.max(0, viewer.value - below.value) : 0;
  const latestThreat = logs.find((log) => log.tone === 'red');

  if (viewer.rank > 1 && diffAbove <= 45) {
    recommendations.push({
      id: 'overtake-window',
      tone: 'plan',
      title: '지금은 순위를 끌어올릴 여지가 큰 구간입니다',
      action: `오늘 다음 블록을 ${Math.max(40, Math.min(diffAbove + 12, 70))}분 이상으로 잡아보세요.`,
      reason: `현재 1위와 ${formatGapLabel(diffAbove)} 차이라 한 번의 긴 블록으로도 간격을 크게 줄일 수 있습니다.`,
      explainWhy: '상위권과의 간격이 짧을수록 첫 블록을 길게 가져가는 편이 현재 흐름을 바꾸는 데 더 효과적입니다.',
      cta: '오늘 계획에 반영하기',
    });
  }

  if (below && diffBelow <= 18) {
    recommendations.push({
      id: 'defense-route',
      tone: 'mindset',
      title: '지금은 현재 위치를 안정적으로 유지하는 편이 좋습니다',
      action: '새 과목을 넓히기보다, 이미 잡은 핵심 과목 한 블록을 끝까지 지켜보세요.',
      reason: `${below.displayNameSnapshot} 님과 ${formatGapLabel(diffBelow)} 차이라 다음 한 블록에서 순위가 바뀔 수 있는 구간입니다.`,
      explainWhy: '격차가 좁을 때는 과목 수를 늘리는 것보다 이미 잡은 블록을 끊기지 않게 마무리하는 편이 더 안정적입니다.',
      cta: '현재 흐름 반영하기',
    });
  }

  if (recommendations.length < 2) {
    recommendations.push({
      id: 'review-slot',
      tone: 'review',
      title: '오늘 마지막 20분은 복습으로 남겨두는 걸 추천해요',
      action: '새 공부를 조금 줄이고, 오늘 한 내용을 오답이나 회상 형태로 짧게 정리해보세요.',
      reason: '바로 다시 꺼내보는 공부가 오늘 쌓은 시간을 실제 점수로 연결하는 데 도움이 됩니다.',
      explainWhy: '기록만 쌓는 날보다 마지막 복습 블록이 있는 날이 최근 흐름에서도 더 안정적인 패턴을 만듭니다.',
      cta: '복습 블록 추가하기',
    });
  }

  if (recommendations.length < 2 && latestThreat) {
    recommendations.push({
      id: 'stability',
      tone: 'balance',
      title: '오늘은 총량보다 끊기지 않는 계획이 더 중요해요',
      action: '핵심 과목 1개와 복습 1개만 확실히 끝내는 식으로 블록 수를 줄여보세요.',
      reason: latestThreat.detail,
      explainWhy: '간격 변화가 커질수록 계획을 크게 잡기보다 끝까지 수행 가능한 구조가 더 유리합니다.',
      cta: '간결한 계획으로 바꾸기',
    });
  }

  return recommendations.slice(0, 2);
}

function PeriodTabs({
  value,
  onChange,
  isMobile = false,
}: {
  value: RankRange;
  onChange: (next: RankRange) => void;
  isMobile?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] p-1 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.6)] backdrop-blur',
      isMobile ? 'grid w-full grid-cols-3 gap-1.5' : 'inline-flex'
    )}>
      {(Object.keys(RANGE_META) as RankRange[]).map((period) => {
        const isActive = value === period;
        return (
          <button
            key={period}
            type="button"
            onClick={() => onChange(period)}
            className={cn(
              'rounded-full transition-all',
              isMobile ? 'px-3 py-2 text-xs font-black tracking-[0.12em]' : 'px-4 py-2 text-sm font-black tracking-[0.18em]',
              isActive
                ? 'bg-[linear-gradient(135deg,#FFE09D_0%,#FFBE67_42%,#FF9D42_100%)] text-[#332005] shadow-[0_14px_30px_-18px_rgba(255,170,79,0.58)]'
                : 'text-[#A7B7D8] hover:bg-[rgba(255,255,255,0.06)] hover:text-white'
            )}
          >
            {RANGE_META[period].label}
          </button>
        );
      })}
    </div>
  );
}

function HeroBattleHeader({
  range,
  onRangeChange,
  activeMessage,
  isLive = true,
  statusLabel,
  subtitleOverride,
  isMobile = false,
}: {
  range: RankRange;
  onRangeChange: (next: RankRange) => void;
  activeMessage: string;
  isLive?: boolean;
  statusLabel?: string;
  subtitleOverride?: string;
  isMobile?: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const heroBadgeLabel = 'RANKING TRACK';
  const heroStatusLabel = statusLabel || (isLive ? '실시간 반영' : '집계 대기');
  const heroSubtitle = subtitleOverride || RANGE_META[range].subtitle;

  if (isMobile) {
    return (
      <section className={cn(MOBILE_BATTLE_PANEL_CLASS, 'student-utility-card relative overflow-hidden p-5 text-white')}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),transparent_36%,transparent_72%,rgba(255,191,106,0.08))]" />
        <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-[#4E7ADC]/18 blur-3xl" />
        <div className="pointer-events-none absolute left-0 top-10 h-32 w-32 rounded-full bg-[#FFB660]/12 blur-3xl" />
        <div className="relative space-y-4">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#F5C97B]/30 bg-[rgba(255,198,112,0.08)] px-3.5 py-2 text-[10px] font-black tracking-[0.18em] text-[#FFD89A]">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#FFBF69] shadow-[0_0_18px_rgba(255,191,105,0.75)]" />
              {heroBadgeLabel}
            </div>
            <div className="space-y-3">
              <div className="text-[10px] font-black tracking-[0.24em] text-[#AFC0E6]">{RANGE_META[range].label} PERFORMANCE</div>
              <h1 className="max-w-[8.5ch] text-[2.35rem] font-aggro-display font-black leading-[0.9] tracking-[-0.05em] text-white">
                {RANGE_META[range].title}
              </h1>
              <p className="max-w-[18rem] text-[14px] font-semibold leading-6 text-[#B7C7E8]">
                {heroSubtitle}
              </p>
            </div>
          </div>

          <div className={cn(MOBILE_BATTLE_STRIP_CLASS, 'flex items-center justify-between gap-3 px-4 py-3.5')}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.16em] text-[#FFD89A]">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                상위권 흐름
              </div>
              <p className="mt-1 text-[15px] font-semibold leading-6 text-white">
                {activeMessage}
              </p>
            </div>
            <div className="shrink-0 rounded-full border border-white/12 bg-[rgba(255,255,255,0.06)] px-2.5 py-1.5 text-[10px] font-black tracking-[0.16em] text-[#B7C7E8]">
              {heroStatusLabel}
            </div>
          </div>

          <PeriodTabs value={range} onChange={onRangeChange} isMobile />
        </div>
      </section>
    );
  }

  return (
    <section className={cn(
      'student-utility-card relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_12%_18%,rgba(82,126,220,0.28),transparent_22%),radial-gradient(circle_at_88%_12%,rgba(255,188,102,0.12),transparent_18%),linear-gradient(135deg,rgba(8,19,39,0.94)_0%,rgba(13,31,67,0.98)_58%,rgba(20,41,95,1)_100%)] text-white shadow-[0_34px_80px_-40px_rgba(0,0,0,0.9)]',
      isMobile ? 'p-5' : 'p-6 md:p-8'
    )}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_42%,transparent_72%,rgba(255,191,106,0.08))]" />
      <div className="pointer-events-none absolute right-0 top-0 h-52 w-52 rounded-full bg-[#4E7ADC]/18 blur-3xl" />
      <div className="pointer-events-none absolute left-10 top-16 h-40 w-40 rounded-full bg-[#FFB660]/12 blur-3xl" />
      <div className="relative space-y-5">
        <div className={cn('flex flex-col gap-4', isMobile ? '' : 'lg:flex-row lg:items-start lg:justify-between')}>
          <div className={cn(isMobile ? 'max-w-none' : 'max-w-3xl')}>
            <div className={cn(
              'inline-flex items-center gap-2 rounded-full border border-[#F5C97B]/30 bg-[rgba(255,198,112,0.08)] text-[#FFD89A]',
              isMobile ? 'mb-3 px-3.5 py-2 text-[11px] font-black tracking-[0.18em]' : 'mb-4 px-4 py-2 text-xs font-black tracking-[0.28em]'
            )}>
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#FFBF69] shadow-[0_0_18px_rgba(255,191,105,0.75)]" />
              {heroBadgeLabel}
            </div>
            <div className="mb-3 text-[11px] font-black tracking-[0.24em] text-[#AFC0E6]">{RANGE_META[range].label} PERFORMANCE</div>
            <h1 className={cn(
              'font-aggro-display font-black tracking-[-0.05em] text-white',
              isMobile ? 'text-[2.1rem] leading-[0.92]' : 'text-[2.1rem] leading-[0.94] md:text-[2.8rem]'
            )}>
              {RANGE_META[range].title}
            </h1>
            <p className={cn(
              'max-w-2xl font-semibold text-[#B7C7E8]',
              isMobile ? 'mt-3 text-base leading-8' : 'mt-3 text-sm leading-7 md:text-base'
            )}>
              {heroSubtitle}
            </p>
          </div>

          <div className={cn('flex flex-col gap-3', isMobile ? 'w-full' : 'items-start lg:min-w-[220px] lg:items-end')}>
            <PeriodTabs value={range} onChange={onRangeChange} isMobile={isMobile} />
            <div className={RANKING_STATUS_BADGE_CLASS}>
              {heroStatusLabel}
            </div>
          </div>
        </div>

        <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'md:grid-cols-[minmax(0,1fr)_220px]')}>
          <div className="rounded-[24px] border border-white/10 bg-[rgba(255,255,255,0.06)] px-5 py-4 backdrop-blur-xl shadow-[0_18px_40px_-30px_rgba(0,0,0,0.7)]">
            <div className={cn('flex items-center gap-2 font-black text-[#FFD89A]', isMobile ? 'mb-2 text-[10px] tracking-[0.16em]' : 'mb-2 text-[11px] tracking-[0.22em]')}>
              <Sparkles className="h-4 w-4" />
              상위권 흐름
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={activeMessage}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                animate={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, ease: 'easeOut' }}
                className={cn(
                  'font-aggro-display font-black leading-snug tracking-[-0.03em] text-white',
                  isMobile ? 'text-[1.05rem]' : 'text-xl md:text-[1.7rem]'
                )}
              >
                {activeMessage}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[rgba(255,255,255,0.06)] px-5 py-4 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.7)]">
            <div className="text-[10px] font-black tracking-[0.2em] text-[#AFC0E6]">집계 범위</div>
            <div className="mt-2 font-aggro-display text-[1.7rem] font-black leading-none tracking-[-0.05em] text-white">
              {RANGE_META[range].label}
            </div>
            <div className="mt-2 text-sm font-semibold text-[#B7C7E8]">
              {isLive ? '실시간 반영 중' : '다음 오픈 대기'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DefenseShieldEffect({
  active,
  pressure,
}: {
  active: boolean;
  pressure: PressureLevel;
}) {
  if (!active) return null;

  const tone =
    pressure === 'critical'
      ? 'rgba(255,111,95,0.68)'
      : pressure === 'warning'
        ? 'rgba(255,170,92,0.58)'
        : 'rgba(255,227,160,0.48)';

  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-2 rounded-[34px] border"
        style={{ borderColor: tone, boxShadow: `0 0 0 1px ${tone}, 0 0 42px ${tone}` }}
        animate={{ opacity: [0.55, 1, 0.55], scale: [1, 1.01, 1] }}
        transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-3 rounded-[38px] border border-white/15"
        style={{ boxShadow: `inset 0 0 20px ${tone}` }}
        animate={{ rotate: 360 }}
        transition={{ duration: pressure === 'critical' ? 5 : 10, repeat: Infinity, ease: 'linear' }}
      />
    </>
  );
}

function BattleGauge({
  leftLabel,
  rightLabel,
  leftValue,
  rightValue,
  leftSummaryLabel = '내 현재 누적',
  isMobile = false,
}: {
  leftLabel: string;
  rightLabel: string;
  leftValue: number;
  rightValue: number;
  leftSummaryLabel?: string;
  isMobile?: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const difference = leftValue - rightValue;
  const marker = clamp(50 + (difference / Math.max(leftValue, rightValue, 1)) * 35, 10, 90);

  return (
    <div className={cn(
      'rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.03)_100%)] shadow-[0_18px_34px_-24px_rgba(0,0,0,0.56)]',
      isMobile ? 'p-3.5' : 'p-4'
    )}>
      <div className={cn(
        'mb-3 flex items-center justify-between font-black tracking-[0.2em] text-[#AFC0E6]',
        isMobile ? 'text-[10px]' : 'text-[11px]'
      )}>
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div className={cn(
        'relative overflow-hidden rounded-full border border-white/10 bg-[rgba(255,255,255,0.06)]',
        isMobile ? 'h-12' : 'h-14'
      )}>
        <div className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,rgba(255,160,70,0.95),rgba(255,214,132,0.92))]" style={{ width: `${marker}%` }} />
        <div
          className="absolute inset-y-0 right-0 bg-[linear-gradient(270deg,rgba(132,174,255,0.14),rgba(40,67,120,0.42))]"
          style={{ width: `${100 - marker}%` }}
        />
        <motion.div
          className="absolute inset-y-1 left-0 w-24 rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.62),transparent)] mix-blend-screen"
          animate={shouldReduceMotion ? { opacity: 0.35, x: '0%' } : { x: ['-10%', '120%'] }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 3.4, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-y-0 w-[3px] bg-white shadow-[0_0_18px_rgba(255,255,255,0.92)]"
          style={{ left: `calc(${marker}% - 1px)` }}
          animate={shouldReduceMotion ? { opacity: 0.85, scaleY: 1 } : { opacity: [0.7, 0.95, 0.7], scaleY: [0.92, 1.02, 0.92] }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-white/30 bg-[radial-gradient(circle,_rgba(255,246,218,0.96)_0%,_rgba(255,178,84,0.92)_50%,_rgba(255,120,56,0.9)_100%)] shadow-[0_0_24px_rgba(255,169,88,0.85)]"
          style={{ left: `calc(${marker}% - 10px)` }}
          animate={shouldReduceMotion
            ? {
                scale: 1,
                boxShadow: '0 0 16px rgba(255,169,88,0.45)',
              }
            : {
                scale: [1, 1.04, 1],
                boxShadow: [
                  '0 0 16px rgba(255,169,88,0.45)',
                  '0 0 22px rgba(255,169,88,0.62)',
                  '0 0 16px rgba(255,169,88,0.45)',
                ],
              }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <div className={cn(
        'mt-3 grid grid-cols-2 font-bold',
        isMobile ? 'gap-2.5 text-[12px]' : 'gap-3 text-sm'
      )}>
        <div className={cn(
          'rounded-2xl border border-[#FFC97C]/25 bg-[rgba(255,201,124,0.08)] text-[#FFE09E]',
          isMobile ? 'px-3 py-2.5' : 'px-3 py-2'
        )}>
          {leftSummaryLabel} {formatStudyCompact(leftValue)}
        </div>
        <div className={cn(
          'rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.05)] text-right text-[#B7C7E8]',
          isMobile ? 'px-3 py-2.5' : 'px-3 py-2'
        )}>
          비교 기준 {formatStudyCompact(rightValue)}
        </div>
      </div>
    </div>
  );
}

function CompactBattleMetric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: LogTone;
}) {
  const toneClass = TONE_CLASS_MAP[tone];

  return (
    <div className={cn(MOBILE_BATTLE_INSET_CLASS, 'student-utility-card relative overflow-hidden px-3.5 py-3')}>
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r', toneClass.line)} />
      <div className="text-[10px] font-black tracking-[0.18em] text-[#AFC0E6]">{label}</div>
      <div className="font-aggro-display mt-2 text-[1.35rem] font-black leading-none tracking-[-0.05em] text-white">{value}</div>
      <div className={cn('mt-2 text-[12px] font-semibold leading-5', toneClass.text)}>{hint}</div>
    </div>
  );
}

function BattleStatCard({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone: LogTone;
  icon: LucideIcon;
}) {
  const toneClass = TONE_CLASS_MAP[tone];
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.03)_100%)] p-4 shadow-[0_16px_32px_-24px_rgba(0,0,0,0.56)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),transparent_40%,transparent_74%,rgba(255,181,100,0.04))]" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-black tracking-[0.22em] text-[#AFC0E6]">{label}</div>
          <div className={cn('rounded-[1rem] border px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]', toneClass.chip)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="font-aggro-display mt-4 text-[2.55rem] font-black leading-none tracking-[-0.06em] text-white">{value}</div>
        <div className={cn('mt-3 text-[13px] font-semibold leading-6', toneClass.text)}>{hint}</div>
      </div>
    </div>
  );
}

function MyBattleCard({
  viewer,
  top,
  below,
  range,
  mode,
  pressure,
  isStudentPerspective = true,
  isMobile = false,
}: {
  viewer: BattleEntry;
  top: BattleEntry | null;
  below: BattleEntry | null;
  range: RankRange;
  mode: BattleMode;
  pressure: PressureLevel;
  isStudentPerspective?: boolean;
  isMobile?: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const diffAbove = Math.max(0, (top?.value ?? viewer.value) - viewer.value);
  const diffBelow = below ? Math.max(0, viewer.value - below.value) : 0;
  const focusedStudentName = maskLeaderboardStudentName(viewer.displayNameSnapshot);
  const rankLabel = isStudentPerspective ? '내 현재 순위' : '현재 기준 순위';
  const gaugeLeftLabel = isStudentPerspective ? '내 현재 누적' : '기준 학생 누적';
  const gaugeRightLabel = viewer.rank === 1 ? '바로 아래 기준' : '1위 기준';
  const summaryLeftLabel = isStudentPerspective ? '내 현재 누적' : '기준 학생 누적';
  const positionBadgeLabel = isStudentPerspective ? '현재 위치' : '기준 학생';
  const statusLabel =
    mode === 'attack'
      ? '상승 구간'
      : mode === 'defense'
        ? '선두 유지'
        : mode === 'danger'
          ? '간격 주의'
          : '간격 축소';
  const helperCopy = isStudentPerspective
    ? mode === 'attack'
      ? `1위와 ${formatGapLabel(diffAbove)} 차이입니다. 지금 흐름이면 간격을 크게 줄일 수 있어요.`
      : mode === 'defense'
        ? `2위와 ${formatGapLabel(diffBelow)} 차이입니다. 현재 페이스를 유지하면 선두를 지킬 수 있어요.`
        : mode === 'danger'
          ? `${below?.displayNameSnapshot ?? '바로 아래 학생'} 님과 ${formatGapLabel(diffBelow)} 차이입니다. 다음 블록 집중이 필요해요.`
          : `상위권과 ${formatGapLabel(diffAbove)} 차이입니다. 지금 한 블록이 순위를 바꿀 수 있어요.`
    : viewer.rank === 1
      ? `${focusedStudentName} 학생이 현재 ${formatStudyClock(viewer.value)} 누적으로 선두입니다.${below ? ` 2위와 ${formatGapLabel(diffBelow)} 차이입니다.` : ''}`
      : `${focusedStudentName} 학생은 현재 ${viewer.rank}위이고, 1위와 ${formatGapLabel(diffAbove)} 차이입니다.`;

  if (isMobile) {
    return (
      <motion.section
        layout
        className={cn(MOBILE_BATTLE_PANEL_CLASS, 'student-utility-card relative overflow-hidden p-4 text-white')}
        whileHover={shouldReduceMotion ? undefined : { y: -2 }}
        transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 24 }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),transparent_36%,transparent_72%,rgba(255,156,56,0.08))]" />
        <div className="pointer-events-none absolute inset-[1px] rounded-[1.72rem] border border-white/10" />

        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#F5C97B]/30 bg-[rgba(255,198,112,0.08)] px-3 py-1.5 text-[10px] font-black tracking-[0.16em] text-[#FFD89A]">
              <Zap className="h-3.5 w-3.5" />
              {statusLabel}
            </div>
            <div className={RANKING_STATUS_BADGE_CLASS}>
              {positionBadgeLabel}
            </div>
          </div>

          <div className={cn(MOBILE_BATTLE_INSET_CLASS, 'mt-3 px-4 py-4')}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black tracking-[0.18em] text-[#AFC0E6]">{rankLabel}</div>
                <div className="font-aggro-display mt-2 text-[3.1rem] font-black leading-none tracking-[-0.07em] text-white">
                  #{viewer.rank}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black tracking-[0.18em] text-[#AFC0E6]">현재 공부시간</div>
                <div className="font-aggro-display mt-2 text-[1.85rem] font-black leading-none tracking-[-0.05em] text-white">
                  {formatStudyCompact(viewer.value)}
                </div>
                <div className="mt-1 text-[12px] font-black text-[#FFC98F]">
                  {viewer.rank === 1 ? `2위와 ${formatGapLabel(diffBelow)}` : `1위와 ${formatGapLabel(diffAbove)}`}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[14px] font-semibold leading-6 text-[#B7C7E8]">
              {helperCopy}
            </p>
          </div>

          <div className="mt-3">
            <BattleGauge
              leftLabel={gaugeLeftLabel}
              rightLabel={gaugeRightLabel}
              leftValue={viewer.value}
              rightValue={viewer.rank === 1 ? (below?.value ?? viewer.value - 10) : (top?.value ?? viewer.value + 10)}
              leftSummaryLabel={summaryLeftLabel}
              isMobile
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <CompactBattleMetric
              label="1위와 차이"
              value={viewer.rank === 1 ? '선두' : formatGapLabel(diffAbove)}
              hint={viewer.rank === 1 ? '현재 선두 유지' : '상위권 기준'}
              tone="gold"
            />
            <CompactBattleMetric
              label="바로 아래"
              value={below ? formatGapLabel(diffBelow) : '여유'}
              hint={below ? `${maskLeaderboardStudentName(below.displayNameSnapshot)} 기준` : '아래 경쟁 없음'}
              tone={pressure === 'critical' ? 'red' : 'blue'}
            />
          </div>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      layout
      className={cn(
        'student-utility-card relative overflow-hidden rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(82,126,220,0.22),transparent_28%),linear-gradient(180deg,rgba(8,19,39,0.92)_0%,rgba(14,31,67,0.98)_100%)] text-white shadow-[0_30px_72px_-36px_rgba(0,0,0,0.84)]',
        isMobile ? 'p-5' : 'p-6 md:p-7'
      )}
      whileHover={shouldReduceMotion ? undefined : { y: -4 }}
      transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 24 }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),transparent_32%,transparent_66%,rgba(255,140,40,0.08))]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[33px] border border-white/10" />
      <div className="relative">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(255,255,255,0.04)_100%)] px-5 py-5 shadow-[0_18px_40px_-26px_rgba(0,0,0,0.58)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#F5C97B]/30 bg-[rgba(255,198,112,0.08)] px-3 py-2 text-[11px] font-black tracking-[0.2em] text-[#FFD89A]">
                <Zap className="h-4 w-4" />
                {statusLabel}
              </div>
              <div className="mt-4 text-[11px] font-black tracking-[0.22em] text-[#AFC0E6]">{getBattleTrackLabel(range)}</div>
            </div>
            <div className={RANKING_STATUS_BADGE_CLASS}>
              {positionBadgeLabel}
            </div>
          </div>

          <div className="mt-4 grid gap-5 md:grid-cols-[180px_minmax(0,1fr)] md:items-end">
            <div>
              <div className="text-[11px] font-black tracking-[0.2em] text-[#AFC0E6]">{rankLabel}</div>
              <div className="font-aggro-display mt-3 text-6xl font-black leading-none tracking-[-0.06em] text-white">#{viewer.rank}</div>
            </div>
            <div>
              <div className="text-[11px] font-black tracking-[0.2em] text-[#AFC0E6]">현재 공부시간</div>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div className="font-aggro-display text-[2.5rem] font-black leading-none tracking-[-0.06em] text-white">{formatStudyClock(viewer.value)}</div>
                <div className="rounded-full border border-[#FFC97C]/25 bg-[rgba(255,201,124,0.08)] px-3 py-1.5 text-[11px] font-black text-[#FFE09E]">
                  {viewer.rank === 1 ? `바로 아래와 ${formatGapLabel(diffBelow)}` : `1위와 ${formatGapLabel(diffAbove)}`}
                </div>
              </div>
              <div className="mt-3 max-w-2xl text-[15px] font-semibold leading-7 text-[#B7C7E8]">
                {helperCopy}
              </div>
            </div>
          </div>
        </div>

        <div className={cn('mt-4 grid gap-3', isMobile ? 'grid-cols-1' : 'md:grid-cols-3')}>
          <BattleStatCard label="현재 누적" value={formatStudyCompact(viewer.value)} hint="현재 범위 기준 누적" tone="orange" icon={Clock3} />
          <BattleStatCard label="1위와 차이" value={viewer.rank === 1 ? '선두' : formatGapLabel(diffAbove)} hint={viewer.rank === 1 ? '현재 상위 유지' : '상위권 기준'} tone="gold" icon={Crown} />
          <BattleStatCard label="바로 아래 차이" value={below ? formatGapLabel(diffBelow) : '여유'} hint={below ? `${maskLeaderboardStudentName(below.displayNameSnapshot)} 기준` : '아래 경쟁 없음'} tone={pressure === 'critical' ? 'red' : 'blue'} icon={ShieldAlert} />
        </div>

        <div className="mt-5">
          <BattleGauge
            leftLabel={gaugeLeftLabel}
            rightLabel={gaugeRightLabel}
            leftValue={viewer.value}
            rightValue={viewer.rank === 1 ? (below?.value ?? viewer.value - 10) : (top?.value ?? viewer.value + 10)}
            leftSummaryLabel={summaryLeftLabel}
          />
        </div>
      </div>
    </motion.section>
  );
}

function EnergyLink({
  direction,
  tone,
  label,
}: {
  direction: 'up' | 'down';
  tone: LogTone;
  label: string;
}) {
  const toneClass = TONE_CLASS_MAP[tone];
  const animation = direction === 'up' ? ['100%', '-100%'] : ['-100%', '100%'];

  return (
    <div className="relative mx-auto flex h-16 w-20 flex-col items-center justify-center">
      <div className="mb-2 text-[11px] font-black tracking-[0.18em] text-[#7A86A2]">{label}</div>
      <div className="relative h-full w-[2px] rounded-full bg-[#E8D7C4]">
        <motion.div
          className={cn('absolute left-1/2 h-10 w-[10px] -translate-x-1/2 rounded-full bg-gradient-to-b', toneClass.line)}
          animate={{ y: animation }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className={cn('absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full', toneClass.text.replace('text', 'bg'))}
          animate={{ scale: [0.9, 1.35, 0.9], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </div>
  );
}

function RivalCard({
  entry,
  title,
  tone,
  highlighted,
  floatingEvent,
  shieldActive,
  pressure,
}: {
  entry: BattleEntry;
  title: string;
  tone: LogTone;
  highlighted?: boolean;
  floatingEvent?: FloatingEvent | null;
  shieldActive?: boolean;
  pressure?: PressureLevel;
}) {
  const toneClass = TONE_CLASS_MAP[tone];

  return (
    <motion.div
      layout
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={cn(
        'relative overflow-hidden rounded-[30px] border p-5 shadow-[0_18px_42px_rgba(20,41,95,0.1)]',
        highlighted
          ? 'border-[#FFBB75]/55 bg-[linear-gradient(160deg,#FFF0D8_0%,#FFE2B5_48%,#FFD39B_100%)] text-[#182D63]'
          : 'border-[#E8D6C1] bg-[linear-gradient(165deg,#FFFFFF_0%,#FFF6EA_72%,#FFECD1_100%)] text-[#132A63]'
      )}
    >
      {shieldActive ? <DefenseShieldEffect active pressure={pressure ?? 'stable'} /> : null}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.7),transparent_34%,transparent_66%,rgba(255,173,85,0.08))]" />

      <AnimatePresence>
        {floatingEvent ? (
          <motion.div
            key={floatingEvent.id}
            initial={{ opacity: 0, y: 8, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.92 }}
            transition={{ duration: 0.22 }}
            className={cn(
              'absolute right-4 top-4 rounded-full border px-3 py-1 text-[11px] font-black tracking-[0.18em]',
              TONE_CLASS_MAP[floatingEvent.tone].chip,
              TONE_CLASS_MAP[floatingEvent.tone].glow
            )}
          >
            {floatingEvent.label}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="relative">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className={cn('text-[11px] font-black tracking-[0.24em]', highlighted ? 'text-[#8B5A19]' : 'text-[#7A86A2]')}>
              {title}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className={cn('text-4xl font-black tracking-[-0.05em]', highlighted ? 'text-[#132A63]' : 'text-[#132A63]')}>
                #{entry.rank}
              </div>
              {entry.rank === 1 ? <Crown className={cn('h-5 w-5', highlighted ? 'text-[#C97E19]' : 'text-[#FFD47D]')} /> : null}
            </div>
          </div>

          <div className={cn('rounded-full border px-3 py-1 text-[11px] font-black tracking-[0.18em]', toneClass.chip)}>
            {entry.rank === 1 ? 'TOP ZONE' : highlighted ? 'MY PUSH' : 'CHASE'}
          </div>
        </div>

        <div className={cn('text-2xl font-black tracking-[-0.04em]', highlighted ? 'text-[#132A63]' : 'text-[#132A63]')}>
          {entry.displayNameSnapshot}
        </div>
        <div className={cn('mt-1 text-sm font-bold', highlighted ? 'text-[#47618E]' : 'text-[#6E7893]')}>
          {formatSchoolName(entry.schoolNameSnapshot)}
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <div className={cn('text-[11px] font-black tracking-[0.2em]', highlighted ? 'text-[#8B5A19]' : 'text-[#7A86A2]')}>
              현재 누적
            </div>
            <div className={cn('mt-2 text-4xl font-black tracking-[-0.05em]', highlighted ? 'text-[#132A63]' : 'text-[#132A63]')}>
              {formatStudyCompact(entry.value)}
            </div>
          </div>
          <div className={cn('text-right text-sm font-bold', highlighted ? 'text-[#C86A10]' : toneClass.text)}>
            {entry.rank === 1 ? '선두 방어 중' : highlighted ? '공격 중심' : '아래에서 압박'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function RivalBattleArea({
  top,
  viewer,
  below,
  mode,
  pressure,
  floatingEvents,
}: {
  top: BattleEntry;
  viewer: BattleEntry;
  below: BattleEntry | null;
  mode: BattleMode;
  pressure: PressureLevel;
  floatingEvents: FloatingEvent[];
}) {
  const floatingMap = floatingEvents.reduce<Record<string, FloatingEvent>>((acc, item) => {
    acc[item.target] = item;
    return acc;
  }, {});

  const viewerIsTop = viewer.studentId === top.studentId;

  return (
    <section className="rounded-[32px] border border-[#E8D1B7] bg-[linear-gradient(180deg,#FFF9F1_0%,#FFF1DD_100%)] p-5 text-[#132A63] shadow-[0_20px_48px_rgba(20,41,95,0.1)] md:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#F2C78F] bg-white/88 px-4 py-2 text-[11px] font-black tracking-[0.22em] text-[#BA6815]">
            <Trophy className="h-4 w-4" />
            1위 존
          </div>
          <h2 className="text-3xl font-black tracking-[-0.05em] text-[#132A63]">정상 점령 구역</h2>
          <p className="mt-2 text-sm font-semibold text-[#64779C]">
            {viewerIsTop
              ? '지금은 당신이 정상입니다. 아래 추격선을 밀어내며 버텨야 해요.'
              : '지금 전투는 정상 점령 구역을 두고 위아래가 동시에 밀어붙이는 상태예요.'}
          </p>
        </div>
      </div>

      <LayoutGroup>
        <div className="space-y-2">
          <RivalCard
            entry={top}
            title="선두 존"
            tone="gold"
            shieldActive
            pressure={viewerIsTop ? pressure : top.value - viewer.value <= 24 ? 'warning' : 'stable'}
            floatingEvent={floatingMap.top}
          />

          {!viewerIsTop ? <EnergyLink direction="up" tone={mode === 'attack' ? 'orange' : 'blue'} label="공격 파동" /> : null}

          {!viewerIsTop ? (
            <RivalCard
              entry={viewer}
              title="내 전장"
              tone="orange"
              highlighted
              floatingEvent={floatingMap.viewer}
              shieldActive={mode === 'danger'}
              pressure={pressure}
            />
          ) : null}

          {below ? (
            <>
              <EnergyLink direction="down" tone={mode === 'danger' || viewerIsTop ? 'red' : 'orange'} label={viewerIsTop ? '방어 파동' : '추격 라인'} />
              <RivalCard entry={below} title={viewerIsTop ? '바로 아래 추격자' : '바로 아래 경쟁자'} tone="red" floatingEvent={floatingMap.rival} />
            </>
          ) : null}
        </div>
      </LayoutGroup>
    </section>
  );
}

function LiveTopThreeBoard({ entries }: { entries: BattleEntry[] }) {
  if (!entries.length) return null;

  const toneMap: Record<number, LogTone> = {
    1: 'gold',
    2: 'orange',
    3: 'red',
  };

  return (
    <div className="mb-4 grid gap-3 md:grid-cols-3">
      {entries.map((entry) => {
        const tone = toneMap[entry.rank] ?? 'blue';
        const toneClass = TONE_CLASS_MAP[tone];
        return (
          <motion.div
            key={entry.studentId}
            layout
            className="relative overflow-hidden rounded-[22px] border border-[#E8D5C1] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF7EC_100%)] p-4 shadow-[0_14px_28px_rgba(20,41,95,0.08)]"
            whileHover={{ y: -2, scale: 1.01 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r', toneClass.line)} />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black tracking-[0.18em]', toneClass.chip)}>
                  <span className="inline-flex h-2 w-2 rounded-full bg-current opacity-80" />
                  {entry.rank}위 누적
                </div>
                <div className="mt-3 truncate text-lg font-black tracking-[-0.03em] text-[#132A63]">
                  {maskLeaderboardStudentName(entry.displayNameSnapshot)}
                </div>
                <div className="mt-1 truncate text-xs font-semibold text-[#6E7893]">
                  {formatSchoolName(entry.schoolNameSnapshot)}
                </div>
              </div>
              {entry.rank === 1 ? <Crown className="h-5 w-5 text-[#FFD989]" /> : null}
            </div>

            <div className="mt-4 rounded-[18px] border border-[#E8D8C6] bg-[#FFF4E3] px-3 py-3">
              <div className="text-[11px] font-black tracking-[0.18em] text-[#7A86A2]">오늘 누적</div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${entry.studentId}-${entry.value}`}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#132A63]"
                >
                  {formatStudyClock(entry.value)}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function StandingsSidebar({
  leaders,
  viewer,
  isStudentPerspective = true,
  isMobile = false,
}: {
  leaders: BattleEntry[];
  viewer: BattleEntry;
  isStudentPerspective?: boolean;
  isMobile?: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const toneMap: Record<number, LogTone> = {
    1: 'gold',
    2: 'orange',
    3: 'red',
  };
  const topLeader = leaders[0] ?? null;
  const secondaryLeaders = leaders.slice(1, 3);
  const viewerSummaryLabel = viewer.rank <= 3 ? '상위권' : viewer.rank <= 5 ? '근접권' : '현재 위치';

  return (
    <aside className={cn(
      MOBILE_BATTLE_PANEL_CLASS,
      'student-utility-card relative overflow-hidden text-white',
      isMobile ? 'p-4' : 'p-5 md:p-6'
    )}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),transparent_36%,transparent_72%,rgba(255,174,90,0.08))]" />

      <div className="relative">
        <div className={cn(isMobile ? 'mb-3' : 'mb-4')}>
          <div className={cn(RANKING_KICKER_CLASS, 'mb-2')}>
            <Trophy className="h-4 w-4" />
            상위권 인사이트
          </div>
          <h3 className={cn('font-aggro-display font-black tracking-[-0.04em] text-white', isMobile ? 'text-xl' : 'text-2xl')}>
            상위권 인사이트
          </h3>
          <p className={cn('mt-2 font-semibold leading-6 text-[#B7C7E8]', isMobile ? 'text-[13px]' : 'text-sm')}>
            현재 누적 공부시간 기준으로 상위권 흐름과 {isStudentPerspective ? '내 위치' : '기준 학생 위치'}를 빠르게 읽을 수 있습니다.
          </p>
        </div>

        {topLeader ? (
          <motion.div
            key={topLeader.studentId}
            layout
            className={cn(
              MOBILE_BATTLE_INSET_CLASS,
              'relative overflow-hidden px-4 py-4',
              topLeader.isViewer && 'border-[#F5C97B]/35 bg-[linear-gradient(180deg,rgba(255,209,132,0.14)_0%,rgba(255,255,255,0.04)_100%)]'
            )}
            whileHover={shouldReduceMotion ? undefined : { y: -2, scale: 1.01 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
          >
            <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r', TONE_CLASS_MAP.gold.line)} />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black tracking-[0.18em]', TONE_CLASS_MAP.gold.chip)}>
                  1위
                  <Crown className="h-3.5 w-3.5" />
                </div>
                <div className="font-aggro-display mt-3 truncate text-[1.45rem] font-black tracking-[-0.04em] text-white">
                  {maskLeaderboardStudentName(topLeader.displayNameSnapshot)}
                </div>
                <div className="mt-1 truncate text-[12px] font-semibold text-[#AFC0E6]">
                  {formatSchoolName(topLeader.schoolNameSnapshot)}
                </div>
              </div>
              <div className="rounded-full border border-white/12 bg-[rgba(255,255,255,0.06)] px-3 py-1.5 text-[10px] font-black tracking-[0.16em] text-[#B7C7E8]">
                {topLeader.isViewer ? '나' : '현재 기준'}
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div>
                <div className="text-[10px] font-black tracking-[0.18em] text-[#AFC0E6]">현재 공부시간</div>
                <div className="font-aggro-display mt-2 text-[2rem] font-black leading-none tracking-[-0.05em] text-white">
                  {formatStudyCompact(topLeader.value)}
                </div>
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-[#F5C97B]/25 bg-[rgba(255,198,112,0.08)] text-[#FFD89A]">
                <Trophy className="h-5 w-5" />
              </div>
            </div>
          </motion.div>
        ) : null}

        {secondaryLeaders.length ? (
          <div className={cn(isMobile ? 'mt-3 grid grid-cols-2 gap-2.5' : 'mt-3 space-y-3')}>
            {secondaryLeaders.map((entry) => {
              const toneClass = TONE_CLASS_MAP[toneMap[entry.rank] ?? 'blue'];

              return (
                <motion.div
                  key={entry.studentId}
                  layout
                  className={cn(
                    MOBILE_BATTLE_INSET_CLASS,
                    'relative overflow-hidden px-3.5 py-3',
                    !isMobile && 'flex items-center justify-between gap-3 px-4 py-4',
                    entry.isViewer && 'border-[#F5C97B]/35 bg-[linear-gradient(180deg,rgba(255,209,132,0.14)_0%,rgba(255,255,255,0.04)_100%)]'
                  )}
                  whileHover={shouldReduceMotion ? undefined : { y: -2, scale: 1.01 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
                >
                  <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r', toneClass.line)} />
                  {isMobile ? (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black tracking-[0.16em]', toneClass.chip)}>
                          {entry.rank}위
                        </div>
                        {entry.isViewer ? (
                          <div className="rounded-full border border-white/12 bg-[rgba(255,255,255,0.06)] px-2 py-1 text-[9px] font-black tracking-[0.14em] text-[#B7C7E8]">
                            나
                          </div>
                        ) : null}
                      </div>
                      <div className="font-aggro-display mt-3 truncate text-[1rem] font-black tracking-[-0.03em] text-white">
                        {maskLeaderboardStudentName(entry.displayNameSnapshot)}
                      </div>
                      <div className="mt-1 truncate text-[11px] font-semibold text-[#AFC0E6]">
                        {formatSchoolName(entry.schoolNameSnapshot)}
                      </div>
                      <div className="font-aggro-display mt-3 text-[1.45rem] font-black leading-none tracking-[-0.05em] text-white">
                        {formatStudyCompact(entry.value)}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <div className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black tracking-[0.16em]', toneClass.chip)}>
                          {entry.rank}위
                        </div>
                        <div className="font-aggro-display mt-3 truncate text-[1rem] font-black tracking-[-0.03em] text-white">
                          {maskLeaderboardStudentName(entry.displayNameSnapshot)}
                        </div>
                        <div className="mt-1 truncate text-[11px] font-semibold text-[#AFC0E6]">
                          {formatSchoolName(entry.schoolNameSnapshot)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[10px] font-black tracking-[0.18em] text-[#AFC0E6]">현재 공부시간</div>
                        <div className="font-aggro-display mt-2 text-[1.45rem] font-black leading-none tracking-[-0.05em] text-white">
                          {formatStudyCompact(entry.value)}
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : null}

        <div className={cn(
          MOBILE_BATTLE_STRIP_CLASS,
          isMobile ? 'mt-3 flex items-center justify-between gap-3 px-4 py-3.5' : 'mt-4 flex items-center justify-between gap-3 px-4 py-4'
        )}>
          <div className="min-w-0">
            <div className="text-[10px] font-black tracking-[0.18em] text-[#AFC0E6]">{isStudentPerspective ? '내 현재 순위' : '기준 학생 순위'}</div>
            <div className="mt-1 flex items-end gap-2">
              <div className={cn('font-aggro-display font-black leading-none tracking-[-0.06em] text-white', isMobile ? 'text-[1.8rem]' : 'text-[2.2rem]')}>
                #{viewer.rank}
              </div>
              <div className="pb-0.5 text-[12px] font-black text-[#B7C7E8]">{formatStudyCompact(viewer.value)} 누적</div>
            </div>
          </div>
          <div className="rounded-full border border-[#F5C97B]/25 bg-[rgba(255,198,112,0.08)] px-3 py-1.5 text-[10px] font-black tracking-[0.16em] text-[#FFD89A]">
            {viewerSummaryLabel}
          </div>
        </div>
      </div>
    </aside>
  );
}

function DailyWaitingCard({
  windowLabel,
  nextOpensAtLabel,
  yesterdayTopMinutes,
  isSettlementPending,
}: {
  windowLabel: string;
  nextOpensAtLabel: string;
  yesterdayTopMinutes: number;
  isSettlementPending: boolean;
}) {
  return (
    <section className={cn(RANKING_SECTION_PANEL_CLASS, 'student-utility-card relative overflow-hidden p-5 text-white md:p-6')}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.08),transparent_36%,transparent_74%,rgba(255,165,78,0.08))]" />
      <div className="relative space-y-4">
        <div className={RANKING_KICKER_CLASS}>
          <Clock3 className="h-4 w-4" />
          {isSettlementPending ? '일간 랭킹 집계 중' : '일간 랭킹 집계 대기'}
        </div>
        <div>
          <h2 className="font-aggro-display text-[2rem] font-black leading-[0.95] tracking-[-0.05em] text-white md:text-[2.4rem]">
            {isSettlementPending ? '마감 결과를' : '오픈 시간에만'}
            <br />
            {isSettlementPending ? '정산하고 있어요' : '일간 랭킹이 열려요'}
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-[#B7C7E8] md:text-base">
            {isSettlementPending
              ? `${windowLabel} 기록 집계가 끝났고, 01:05에 랭킹 포인트가 지급됩니다.`
              : `${windowLabel}에 공부한 기록만 일간 순위에 실시간 반영됩니다. 지금은 대기 상태라서 다음 오픈 시간에 다시 집계가 시작돼요.`}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-[22px] border border-white/10 bg-[rgba(255,255,255,0.05)] p-4 shadow-[0_14px_28px_-24px_rgba(0,0,0,0.56)]">
            <div className="text-[11px] font-black tracking-[0.18em] text-[#AFC0E6]">
              {isSettlementPending ? '포인트 지급' : '다음 오픈'}
            </div>
            <div className="font-aggro-display mt-2 text-[1.7rem] font-black tracking-[-0.04em] text-white">{nextOpensAtLabel}</div>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-[rgba(255,255,255,0.05)] p-4 shadow-[0_14px_28px_-24px_rgba(0,0,0,0.56)]">
            <div className="text-[11px] font-black tracking-[0.18em] text-[#AFC0E6]">어제 1위</div>
            <div className="font-aggro-display mt-2 text-[1.7rem] font-black tracking-[-0.04em] text-white">
              {yesterdayTopMinutes > 0 ? formatStudyCompact(yesterdayTopMinutes) : '기록 없음'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyRankingState({
  range,
}: {
  range: RankRange;
}) {
  const title =
    range === 'daily'
      ? '오늘 반영된 공부 기록이 아직 없어요'
      : range === 'weekly'
        ? '이번 주 누적 기록이 아직 없어요'
        : '이번 달 누적 기록이 아직 없어요';
  const description =
    range === 'daily'
      ? '첫 공부 기록이 들어오면 실제 학생 기준으로 일간 랭킹이 바로 열립니다.'
      : range === 'weekly'
        ? '주간 누적이 쌓이면 실제 학생 흐름으로 랭킹이 자동 갱신됩니다.'
        : '월간 누적이 쌓이면 실제 학생 기준으로 상위권이 바로 보입니다.';

  return (
    <section className={cn(RANKING_SECTION_PANEL_CLASS, 'student-utility-card relative overflow-hidden p-5 text-white md:p-6')}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.08),transparent_36%,transparent_74%,rgba(255,165,78,0.08))]" />
      <div className="relative space-y-4">
        <div className={RANKING_KICKER_CLASS}>
          <Clock3 className="h-4 w-4" />
          집계 준비 중
        </div>
        <div>
          <h2 className="font-aggro-display text-[2rem] font-black leading-[0.95] tracking-[-0.05em] text-white md:text-[2.4rem]">
            실제 기록이 들어오면
            <br />
            여기서 바로 보입니다
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-[#B7C7E8] md:text-base">
            {title}. {description}
          </p>
        </div>
      </div>
    </section>
  );
}

function MonthlyRewardPolicyNotice({ isMobile }: { isMobile: boolean }) {
  return (
    <section className={cn(
      'relative overflow-hidden border border-[#F5C97B]/28 bg-[linear-gradient(135deg,rgba(255,198,112,0.14),rgba(255,255,255,0.055))] text-white shadow-[0_20px_48px_-34px_rgba(245,201,123,0.55)]',
      isMobile ? 'mx-4 rounded-[1.4rem] px-4 py-3.5' : 'rounded-[26px] px-5 py-4'
    )}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#F5C97B] via-[#FFB660]/70 to-transparent" />
      <div className={cn('relative flex gap-3', isMobile ? 'items-start' : 'items-center justify-between')}>
        <div className="min-w-0 space-y-1">
          <div className="text-[10px] font-black tracking-[0.2em] text-[#FFD89A]">MONTHLY REWARD NOTICE</div>
          <p className={cn('font-black leading-snug text-white', isMobile ? 'text-sm' : 'text-base')}>
            2026년 4월 월간 랭킹은 포인트 지급 없이 순위 확인용으로 운영됩니다.
          </p>
          <p className="text-xs font-semibold leading-relaxed text-[#D8E4FF]">
            월간 랭킹 포인트는 2026년 5월 랭킹부터 지급됩니다.
          </p>
        </div>
        {!isMobile ? (
          <div className="shrink-0 rounded-full border border-[#F5C97B]/35 bg-[rgba(255,198,112,0.12)] px-4 py-2 text-xs font-black text-[#FFE0A6]">
            5월부터 지급
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RankingHistoryControls({
  selectedDateKey,
  minDateKey,
  maxDateKey,
  isHistorical,
  isMobile,
  onDateChange,
  onReset,
}: {
  selectedDateKey: string;
  minDateKey: string;
  maxDateKey: string;
  isHistorical: boolean;
  isMobile: boolean;
  onDateChange: (dateKey: string) => void;
  onReset: () => void;
}) {
  return (
    <section className={cn(
      'student-utility-card border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.075)_0%,rgba(255,255,255,0.035)_100%)] text-white shadow-[0_22px_52px_-34px_rgba(0,0,0,0.72)] backdrop-blur-xl',
      isMobile ? 'mx-0 rounded-[1.4rem] p-4' : 'rounded-[26px] px-5 py-4'
    )}>
      <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-center justify-between')}>
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#F5C97B]/25 bg-[rgba(255,198,112,0.08)] px-3 py-1.5 text-[10px] font-black tracking-[0.18em] text-[#FFD89A]">
            <CalendarDays className="h-3.5 w-3.5" />
            기준일 조회
          </div>
          <div className="mt-2 font-aggro-display text-[1.4rem] font-black tracking-[-0.04em] text-white">
            {isHistorical ? '과거 랭킹 트랙' : '현재 랭킹 트랙'}
          </div>
          <p className="mt-1 text-sm font-semibold leading-6 text-[#B7C7E8]">
            {formatRankingDateLabel(selectedDateKey)}
          </p>
        </div>

        <div className={cn('flex gap-2', isMobile ? 'w-full flex-col' : 'items-center')}>
          <label className={cn(
            'flex items-center gap-2 rounded-[1rem] border border-white/12 bg-[rgba(255,255,255,0.06)] px-3 py-2 text-sm font-black text-white',
            isMobile ? 'w-full' : 'min-w-[190px]'
          )}>
            <CalendarDays className="h-4 w-4 shrink-0 text-[#FFD89A]" />
            <input
              type="date"
              value={selectedDateKey}
              min={minDateKey}
              max={maxDateKey}
              onChange={(event) => onDateChange(event.target.value)}
              className="min-w-0 flex-1 bg-transparent font-black text-white outline-none [color-scheme:dark]"
            />
          </label>
          <button
            type="button"
            onClick={onReset}
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-[1rem] border border-[#F5C97B]/25 bg-[rgba(255,198,112,0.08)] px-4 py-3 text-sm font-black text-[#FFD89A] transition hover:bg-[rgba(255,198,112,0.14)]',
              isMobile ? 'w-full' : 'shrink-0'
            )}
          >
            <RotateCcw className="h-4 w-4" />
            현재 보기
          </button>
        </div>
      </div>
    </section>
  );
}

function RankingHistoryBoard({
  entries,
  range,
  dateKey,
  isMobile,
}: {
  entries: StudentRankEntry[];
  range: RankRange;
  dateKey: string;
  isMobile: boolean;
}) {
  const topEntry = entries[0] ?? null;
  const totalMinutes = entries.reduce((sum, entry) => sum + Math.max(0, Math.round(entry.value || 0)), 0);

  return (
    <section className={cn(RANKING_SECTION_PANEL_CLASS, 'student-utility-card relative overflow-hidden p-5 text-white md:p-6')}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.08),transparent_36%,transparent_74%,rgba(255,165,78,0.08))]" />
      <div className="relative space-y-5">
        <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-start justify-between')}>
          <div className="min-w-0">
            <div className={RANKING_KICKER_CLASS}>
              <ListOrdered className="h-4 w-4" />
              전체 순위
            </div>
            <h2 className="font-aggro-display mt-3 text-[2rem] font-black leading-[0.95] tracking-[-0.05em] text-white md:text-[2.45rem]">
              {getRankingHistorySummaryLabel(range, dateKey)}
            </h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-[#B7C7E8]">
              {entries.length.toLocaleString()}명 집계 · 총 {formatStudyCompact(totalMinutes)}
            </p>
          </div>
          {topEntry ? (
            <div className={cn(
              'rounded-[1.25rem] border border-[#F5C97B]/25 bg-[rgba(255,198,112,0.08)] px-4 py-3',
              isMobile ? 'w-full' : 'min-w-[220px] text-right'
            )}>
              <div className="text-[10px] font-black tracking-[0.18em] text-[#FFD89A]">1위</div>
              <div className="mt-1 truncate text-lg font-black text-white">{topEntry.displayNameSnapshot}</div>
              <div className="mt-1 text-sm font-bold text-[#B7C7E8]">{formatStudyCompact(topEntry.value)}</div>
            </div>
          ) : null}
        </div>

        {entries.length > 0 ? (
          <div className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-[rgba(255,255,255,0.04)]">
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full min-w-[660px] border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-[#10244F]/95 backdrop-blur">
                  <tr className="border-b border-white/10 text-[11px] font-black tracking-[0.18em] text-[#AFC0E6]">
                    <th className="w-[86px] px-4 py-3">순위</th>
                    <th className="px-4 py-3">학생</th>
                    <th className="px-4 py-3">반</th>
                    <th className="px-4 py-3">학교</th>
                    <th className="px-4 py-3 text-right">공부시간</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={`${entry.studentId}-${entry.rank}`} className="border-b border-white/8 text-sm font-bold text-white last:border-b-0">
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex min-w-[3rem] justify-center rounded-full border px-2.5 py-1 text-xs font-black',
                          entry.rank === 1
                            ? 'border-[#F5C97B]/35 bg-[rgba(245,201,123,0.16)] text-[#FFE0A6]'
                            : 'border-white/12 bg-[rgba(255,255,255,0.06)] text-[#D8E4FF]'
                        )}>
                          {entry.rank}위
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-black">{entry.displayNameSnapshot}</div>
                        <div className="mt-0.5 text-xs font-semibold text-[#AFC0E6]">{entry.studentId}</div>
                      </td>
                      <td className="px-4 py-3 text-[#D8E4FF]">{entry.classNameSnapshot || '-'}</td>
                      <td className="px-4 py-3 text-[#D8E4FF]">{formatSchoolName(entry.schoolNameSnapshot)}</td>
                      <td className="px-4 py-3 text-right font-aggro-display text-lg font-black tracking-[-0.04em] text-[#FFE09E]">
                        {formatStudyCompact(entry.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-[1.25rem] border border-dashed border-white/14 bg-[rgba(255,255,255,0.035)] px-5 py-8 text-center text-sm font-bold text-[#B7C7E8]">
            해당 기준일에 집계된 랭킹 기록이 없습니다.
          </div>
        )}
      </div>
    </section>
  );
}

function RecommendationChip({
  recommendation,
  onApply,
}: {
  recommendation: BattleRecommendation;
  onApply: (item: BattleRecommendation) => void;
}) {
  const chipMap: Record<RecommendationTone, string> = {
    plan: '계획',
    review: '복습',
    balance: '과목배분',
    method: '학습방법',
    mindset: '동기',
  };
  const toneClass =
    recommendation.tone === 'mindset'
      ? TONE_CLASS_MAP.red
      : recommendation.tone === 'review'
        ? TONE_CLASS_MAP.gold
        : recommendation.tone === 'balance'
          ? TONE_CLASS_MAP.blue
          : TONE_CLASS_MAP.orange;

  return (
    <details className="group rounded-[24px] border border-white/10 bg-[rgba(255,255,255,0.05)] p-4 shadow-[0_18px_42px_-30px_rgba(0,0,0,0.64)]">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className={cn('mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-black tracking-[0.18em]', toneClass.chip)}>
              {chipMap[recommendation.tone]}
            </div>
            <h4 className="font-aggro-display text-xl font-black tracking-[-0.03em] text-white">{recommendation.title}</h4>
            <p className="mt-2 text-base font-bold text-[#FFE09E]">{recommendation.action}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#B7C7E8]">{recommendation.reason}</p>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              onApply(recommendation);
            }}
            className="rounded-full bg-[linear-gradient(90deg,#FFE09D,#FFBE67,#FF9D42)] px-4 py-3 text-sm font-black tracking-[0.04em] text-[#332005] shadow-[0_14px_28px_-16px_rgba(255,170,79,0.52)] transition hover:translate-y-[-1px]"
          >
            {recommendation.cta}
          </button>
        </div>
      </summary>
      <div className="mt-4 rounded-[20px] border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 text-sm font-semibold leading-7 text-[#B7C7E8]">
        {recommendation.explainWhy}
      </div>
    </details>
  );
}

function RecommendationPanel({
  recommendations,
  onApply,
  onReopenDiagnosis,
  onViewDiagnosis,
}: {
  recommendations: BattleRecommendation[];
  onApply: (item: BattleRecommendation) => void;
  onReopenDiagnosis: () => void;
  onViewDiagnosis: () => void;
}) {
  return (
    <section className={cn(RANKING_SECTION_PANEL_CLASS, 'p-5 text-white md:p-6')}>
      <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className={cn(RANKING_KICKER_CLASS, 'mb-2')}>
            <Sparkles className="h-4 w-4" />
            다음 집중 포인트
          </div>
          <h3 className="font-aggro-display text-2xl font-black tracking-[-0.04em] text-white">오늘 계획에서 이 정도만 조정하면 됩니다</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#B7C7E8]">
            최근 계획과 학습 기준을 바탕으로, 바로 오늘 계획에 넣을 수 있는 제안만 추렸어요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onReopenDiagnosis} className="rounded-full border border-white/12 bg-[rgba(255,255,255,0.06)] px-4 py-2 text-sm font-black text-white transition hover:bg-[rgba(255,255,255,0.1)]">
            계획 페이지 열기
          </button>
          <button type="button" onClick={onViewDiagnosis} className="rounded-full border border-[#F5C97B]/25 bg-[rgba(255,198,112,0.08)] px-4 py-2 text-sm font-black text-[#FFD89A] transition hover:bg-[rgba(255,198,112,0.14)]">
            진단 결과 보기
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {recommendations.map((item) => (
          <RecommendationChip key={item.id} recommendation={item} onApply={onApply} />
        ))}
      </div>
    </section>
  );
}

export default function RankingBattlePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { activeMembership, viewMode, isTimerActive, startTime } = useAppContext();
  const isMobile = viewMode === 'mobile';

  const rangeParam = searchParams.get('range');
  const range = isRankRange(rangeParam) ? rangeParam : 'daily';
  const authViewerId = user?.uid ?? 'viewer-local';
  const centerId = activeMembership?.id ?? null;
  const isStudentPerspective = activeMembership?.role === 'student';
  const canUseRankingHistory = canViewRankingHistory(activeMembership?.role);

  const [snapshot, setSnapshot] = useState<StudentRankingSnapshot>(EMPTY_STUDENT_RANKING_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LiveLog[]>([]);
  const [floatingEvents, setFloatingEvents] = useState<FloatingEvent[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [clockNowMs, setClockNowMs] = useState(() => Date.now());

  useEffect(() => {
    setClockNowMs(Date.now());
    const intervalId = window.setInterval(() => {
      setClockNowMs(Date.now());
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  const dailyRankWindow = useMemo(
    () => getDailyRankWindowState(new Date(clockNowMs)),
    [clockNowMs]
  );
  const currentCompetitionDateKey = dailyRankWindow.competitionDateKey;
  const minHistoryDateKey = useMemo(
    () => getRankingDateKeyOffset(currentCompetitionDateKey, -RANKING_HISTORY_DAYS),
    [currentCompetitionDateKey]
  );
  const requestedDateParam = searchParams.get('date');
  const requestedDateKey = requestedDateParam && isValidRankingDateKey(requestedDateParam)
    ? requestedDateParam
    : null;
  const selectedDateKey = canUseRankingHistory && requestedDateKey && requestedDateKey >= minHistoryDateKey && requestedDateKey <= currentCompetitionDateKey
    ? requestedDateKey
    : currentCompetitionDateKey;
  const snapshotDateKey = canUseRankingHistory && selectedDateKey !== currentCompetitionDateKey
    ? selectedDateKey
    : null;
  const isHistoricalSnapshot = Boolean(snapshotDateKey);
  const selfLiveStartedAtMs = !isHistoricalSnapshot && isStudentPerspective && isTimerActive && startTime ? startTime : 0;

  useEffect(() => {
    if (!canUseRankingHistory || !requestedDateParam) return;

    const boundedDateKey = requestedDateKey
      ? clampRankingDateKey(requestedDateKey, minHistoryDateKey, currentCompetitionDateKey)
      : null;
    const nextParams = new URLSearchParams(searchParams.toString());

    if (!boundedDateKey || boundedDateKey === currentCompetitionDateKey) {
      nextParams.delete('date');
    } else if (boundedDateKey !== requestedDateParam) {
      nextParams.set('date', boundedDateKey);
    } else {
      return;
    }

    const queryString = nextParams.toString();
    router.replace(`/dashboard/leaderboards${queryString ? `?${queryString}` : ''}`, { scroll: false });
  }, [canUseRankingHistory, currentCompetitionDateKey, minHistoryDateKey, requestedDateKey, requestedDateParam, router, searchParams]);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    if (!user || !centerId) {
      setSnapshot(EMPTY_STUDENT_RANKING_SNAPSHOT);
      setLoading(false);
      setFetchError(null);
      return;
    }

    const loadSnapshot = async (isInitialLoad: boolean) => {
      if (isInitialLoad) setLoading(true);

      try {
        const result = await fetchStudentRankingSnapshot({ centerId, user, dateKey: snapshotDateKey });
        if (cancelled) return;
        setSnapshot(result);
        setFetchError(null);
      } catch {
        if (cancelled) return;
        if (isInitialLoad) {
          setSnapshot(EMPTY_STUDENT_RANKING_SNAPSHOT);
        }
        setFetchError('실시간 랭킹 데이터를 잠시 불러오지 못하고 있어요. 잠시 후 자동으로 다시 불러옵니다.');
      } finally {
        if (!cancelled && isInitialLoad) {
          setLoading(false);
        }
      }
    };

    void loadSnapshot(true);
    if (!snapshotDateKey) {
      intervalId = window.setInterval(() => {
        void loadSnapshot(false);
      }, SNAPSHOT_REFRESH_MS);
    }

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [centerId, snapshotDateKey, user]);

  const currentRangeEntries = snapshot[range] ?? [];
  const dailyWaitingTopMinutes = Math.max(0, Number(snapshot.dailyWaitingTopMinutes || 0));
  const viewerId = isStudentPerspective ? authViewerId : currentRangeEntries[0]?.studentId ?? authViewerId;

  const baseEntries = useMemo(() => {
    return buildStudentRankingBattleEntries(currentRangeEntries, viewerId, isStudentPerspective);
  }, [currentRangeEntries, isStudentPerspective, viewerId]);

  const battleEntries = useMemo(() => {
    return assignStudentRankingTrackRanks(
      baseEntries.map((entry) => ({
        ...entry,
        value: getLiveAdjustedStudentRankValue({
          entry,
          range,
          nowMs: clockNowMs,
          viewerId,
          selfLiveStartedAtMs,
          dailyRankWindow,
        }),
      }))
    );
  }, [baseEntries, clockNowMs, dailyRankWindow, range, selfLiveStartedAtMs, viewerId]);

  const shouldShowEmptyState = !loading && currentRangeEntries.length === 0 && selfLiveStartedAtMs <= 0;

  useEffect(() => {
    if (shouldShowEmptyState) {
      setLogs([]);
      setFloatingEvents([]);
      setHeroIndex(0);
      return;
    }

    setLogs(buildInitialLogs(battleEntries, viewerId));
    setFloatingEvents([]);
    setHeroIndex(0);
  }, [battleEntries, shouldShowEmptyState, viewerId]);

  useEffect(() => {
    if (!floatingEvents.length) return;
    const timeout = window.setTimeout(() => {
      setFloatingEvents((prev) => prev.slice(-2));
    }, 2200);
    return () => window.clearTimeout(timeout);
  }, [floatingEvents]);

  const viewer = useMemo(
    () => (isStudentPerspective ? battleEntries.find((entry) => entry.studentId === viewerId) : null) ?? battleEntries[0] ?? null,
    [battleEntries, isStudentPerspective, viewerId]
  );
  const top = battleEntries[0] ?? null;
  const liveLeaders = useMemo(() => battleEntries.slice(0, 3), [battleEntries]);
  const below = viewer ? battleEntries.find((entry) => entry.rank === viewer.rank + 1) ?? null : null;
  const diffAbove = viewer && top ? Math.max(0, top.value - viewer.value) : 0;
  const diffBelow = viewer && below ? Math.max(0, viewer.value - below.value) : 0;
  const mode = viewer ? getBattleMode(viewer.rank, diffAbove, diffBelow) : 'chase';
  const pressure = viewer ? getPressureLevel(viewer.rank, diffAbove, diffBelow) : 'stable';
  const isDailyWaiting = !isHistoricalSnapshot && range === 'daily' && !dailyRankWindow.isLive;
  const shouldShowRankingHistoryBoard = canUseRankingHistory && !isStudentPerspective && !isDailyWaiting;
  const recommendations = useMemo(
    () => (viewer ? buildMainRecommendations({ viewer, top, below, logs }) : []),
    [viewer, top, below, logs]
  );
  const heroMessages = useMemo(
    () =>
      viewer
        ? buildHeroMessages({
            mode,
            diffAbove,
            diffBelow,
            viewerRank: viewer.rank,
            latestLog: logs[0] ?? null,
          })
        : ['실시간 경쟁 흐름을 준비하는 중입니다.'],
    [mode, diffAbove, diffBelow, logs, viewer]
  );

  useEffect(() => {
    if (!heroMessages.length) return;
    const intervalId = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroMessages.length);
    }, HERO_ROTATE_MS);
    return () => window.clearInterval(intervalId);
  }, [heroMessages]);

  function handleRangeChange(nextRange: RankRange) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('range', nextRange);
    router.replace(`/dashboard/leaderboards?${nextParams.toString()}`, { scroll: false });
  }

  function handleRankingDateChange(nextDateKey: string) {
    if (!canUseRankingHistory || !isValidRankingDateKey(nextDateKey)) return;
    const boundedDateKey = clampRankingDateKey(nextDateKey, minHistoryDateKey, currentCompetitionDateKey);
    if (!boundedDateKey) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    if (boundedDateKey === currentCompetitionDateKey) {
      nextParams.delete('date');
    } else {
      nextParams.set('date', boundedDateKey);
    }
    const queryString = nextParams.toString();
    router.replace(`/dashboard/leaderboards${queryString ? `?${queryString}` : ''}`, { scroll: false });
  }

  function handleResetRankingDate() {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('date');
    const queryString = nextParams.toString();
    router.replace(`/dashboard/leaderboards${queryString ? `?${queryString}` : ''}`, { scroll: false });
  }

  function handleApplyRecommendation(item: BattleRecommendation) {
    const toneMap: Record<RecommendationTone, LogTone> = {
      plan: 'orange',
      review: 'gold',
      balance: 'blue',
      method: 'orange',
      mindset: 'red',
    };
    setLogs((prev) => [
      {
        id: `manual-${Date.now()}`,
        badge: '추천 반영',
        tone: toneMap[item.tone],
        title: item.title,
        detail: `${item.action} 이제 오늘 계획에 바로 반영해보세요.`,
        target: 'viewer' as const,
      },
      ...prev,
    ].slice(0, 7));
    setFloatingEvents((prev) => [
      ...prev,
      {
        id: `manual-float-${Date.now()}`,
        tone: toneMap[item.tone],
        label: '반영',
        target: 'viewer',
      },
    ]);
  }

  function handleOpenPlanPage() {
    router.push('/dashboard/plan');
  }

  function handleViewDiagnosis() {
    router.push('/dashboard/plan/diagnosis');
  }

  const rankingHistoryControls = canUseRankingHistory ? (
    <RankingHistoryControls
      selectedDateKey={selectedDateKey}
      minDateKey={minHistoryDateKey}
      maxDateKey={currentCompetitionDateKey}
      isHistorical={isHistoricalSnapshot}
      isMobile={isMobile}
      onDateChange={handleRankingDateChange}
      onReset={handleResetRankingDate}
    />
  ) : null;

  if (loading && currentRangeEntries.length === 0 && selfLiveStartedAtMs <= 0 && !isDailyWaiting) {
    return (
      <main className={cn('student-font-shell min-h-screen px-4 py-8', RANKING_PAGE_SHELL_CLASS)}>
        <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,19,39,0.88)_0%,rgba(13,30,63,0.94)_100%)] shadow-[0_32px_72px_-36px_rgba(0,0,0,0.88)]">
          <div className="flex items-center gap-3 text-lg font-bold text-[#B7C7E8]">
            <Loader2 className="h-5 w-5 animate-spin" />
            실시간 랭킹을 불러오는 중입니다.
          </div>
        </div>
      </main>
    );
  }

  if (isDailyWaiting) {
    return (
      <main className={cn(
        'student-font-shell',
        RANKING_PAGE_SHELL_CLASS,
        isMobile ? 'min-h-0 px-0 py-0' : 'min-h-screen px-4 py-6 md:px-6 md:py-8'
      )}>
        <div className={cn('mx-auto', isMobile ? 'max-w-none space-y-4' : 'max-w-7xl space-y-5')}>
          <HeroBattleHeader
            range={range}
            onRangeChange={handleRangeChange}
            activeMessage={
              dailyRankWindow.isSettlementPending
                ? '마감된 일간 랭킹을 정산하고 있어요. 01:05에 포인트가 지급됩니다.'
                : `다음 오픈 ${dailyRankWindow.nextOpensAtLabel}부터 일간 랭킹이 다시 실시간으로 열려요.`
            }
            isLive={false}
            statusLabel={dailyRankWindow.isSettlementPending ? '집계 중' : '집계 대기'}
            subtitleOverride={`${dailyRankWindow.windowLabel}에 공부한 기록만 일간 랭킹에 반영됩니다.`}
            isMobile={isMobile}
          />

          {rankingHistoryControls}

          {fetchError ? (
            <div className="rounded-[24px] border border-[#F5C97B]/20 bg-[rgba(255,198,112,0.08)] px-4 py-3 text-sm font-semibold text-[#FFD89A]">
              {fetchError}
            </div>
          ) : null}

          <div className={cn(isMobile ? 'space-y-4' : 'grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_320px]')}>
            <div className="space-y-5">
              <DailyWaitingCard
                windowLabel={dailyRankWindow.windowLabel}
                nextOpensAtLabel={dailyRankWindow.isSettlementPending ? '01:05' : dailyRankWindow.nextOpensAtLabel}
                yesterdayTopMinutes={dailyWaitingTopMinutes}
                isSettlementPending={dailyRankWindow.isSettlementPending}
              />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (shouldShowRankingHistoryBoard) {
    return (
      <main className={cn(
        'student-font-shell',
        RANKING_PAGE_SHELL_CLASS,
        isMobile ? 'min-h-0 px-0 py-0' : 'min-h-screen px-4 py-6 md:px-6 md:py-8'
      )}>
        <div className={cn('mx-auto', isMobile ? 'max-w-none space-y-4' : 'max-w-7xl space-y-5')}>
          <HeroBattleHeader
            range={range}
            onRangeChange={handleRangeChange}
            activeMessage={isHistoricalSnapshot ? getRankingHistorySummaryLabel(range, selectedDateKey) : `${getHistoryRangeLabel(range)} 전체 순위`}
            isLive={!isHistoricalSnapshot}
            statusLabel={isHistoricalSnapshot ? '과거 조회' : '실시간 반영'}
            subtitleOverride={isHistoricalSnapshot ? '학생별 순위와 누적 공부시간을 전체 목록으로 확인합니다.' : '진행 중인 세션 시간을 포함해 학생별 순위와 누적 공부시간을 확인합니다.'}
            isMobile={isMobile}
          />

          {rankingHistoryControls}

          {fetchError ? (
            <div className="rounded-[24px] border border-[#F5C97B]/20 bg-[rgba(255,198,112,0.08)] px-4 py-3 text-sm font-semibold text-[#FFD89A]">
              {fetchError}
            </div>
          ) : null}

          {range === 'monthly' ? <MonthlyRewardPolicyNotice isMobile={isMobile} /> : null}

          <RankingHistoryBoard
            entries={battleEntries}
            range={range}
            dateKey={selectedDateKey}
            isMobile={isMobile}
          />
        </div>
      </main>
    );
  }

  if (shouldShowEmptyState) {
    return (
      <main className={cn(
        'student-font-shell',
        RANKING_PAGE_SHELL_CLASS,
        isMobile ? 'min-h-0 px-0 py-0' : 'min-h-screen px-4 py-6 md:px-6 md:py-8'
      )}>
        <div className={cn('mx-auto', isMobile ? 'max-w-none space-y-4' : 'max-w-7xl space-y-5')}>
          <HeroBattleHeader
            range={range}
            onRangeChange={handleRangeChange}
            activeMessage={isHistoricalSnapshot ? '해당 기준일에 집계된 랭킹 기록이 없습니다.' : '실제 공부 기록이 들어오면 랭킹이 바로 반영됩니다.'}
            isLive={!isHistoricalSnapshot && (range !== 'daily' || dailyRankWindow.isLive)}
            statusLabel={isHistoricalSnapshot ? '과거 조회' : '실시간 조회'}
            subtitleOverride={isHistoricalSnapshot ? `${formatRankingDateLabel(selectedDateKey)} 기록 기준으로 순위와 격차를 확인합니다.` : undefined}
            isMobile={isMobile}
          />

          {rankingHistoryControls}

          {fetchError ? (
            <div className="rounded-[24px] border border-[#F5C97B]/20 bg-[rgba(255,198,112,0.08)] px-4 py-3 text-sm font-semibold text-[#FFD89A]">
              {fetchError}
            </div>
          ) : null}

          {range === 'monthly' ? <MonthlyRewardPolicyNotice isMobile={isMobile} /> : null}

          <div className={cn(isMobile ? 'space-y-4' : 'grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_320px]')}>
            <div className="space-y-5">
              <EmptyRankingState range={range} />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!viewer || !top) return null;

  return (
    <main className={cn(
      'student-font-shell',
      RANKING_PAGE_SHELL_CLASS,
      isMobile ? 'min-h-0 px-0 py-0' : 'min-h-screen px-4 py-6 md:px-6 md:py-8'
    )}>
      <div className={cn('mx-auto', isMobile ? 'max-w-none space-y-4' : 'max-w-7xl space-y-5')}>
        <HeroBattleHeader
          range={range}
          onRangeChange={handleRangeChange}
          activeMessage={isHistoricalSnapshot ? getRankingHistorySummaryLabel(range, selectedDateKey) : heroMessages[heroIndex % Math.max(heroMessages.length, 1)]}
          isLive={!isHistoricalSnapshot}
          statusLabel={isHistoricalSnapshot ? '과거 조회' : '실시간 반영'}
          subtitleOverride={isHistoricalSnapshot ? `${formatRankingDateLabel(selectedDateKey)} 기록 기준으로 순위와 격차를 확인합니다.` : undefined}
          isMobile={isMobile}
        />

        {rankingHistoryControls}

        {fetchError ? (
          <div className="rounded-[24px] border border-[#F5C97B]/20 bg-[rgba(255,198,112,0.08)] px-4 py-3 text-sm font-semibold text-[#FFD89A]">
            {fetchError}
          </div>
        ) : null}

        {range === 'monthly' ? <MonthlyRewardPolicyNotice isMobile={isMobile} /> : null}

        {isMobile ? (
          <div className="space-y-4">
            <MyBattleCard viewer={viewer} top={top} below={below} range={range} mode={mode} pressure={pressure} isStudentPerspective={isStudentPerspective} isMobile />
            <StandingsSidebar leaders={liveLeaders} viewer={viewer} isStudentPerspective={isStudentPerspective} isMobile />
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_320px]">
            <div className="space-y-5">
              <MyBattleCard viewer={viewer} top={top} below={below} range={range} mode={mode} pressure={pressure} isStudentPerspective={isStudentPerspective} />
            </div>
            <div className="space-y-5">
              <StandingsSidebar leaders={liveLeaders} viewer={viewer} isStudentPerspective={isStudentPerspective} />
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
