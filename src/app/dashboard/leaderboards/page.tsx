'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
  Clock3,
  Crown,
  Gift,
  Loader2,
  ShieldAlert,
  Sparkles,
  Swords,
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

type RewardState = {
  progress: number;
  minutesToReward: number;
  currentReward: string;
  nextReward: string;
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

const LIVE_TICK_MS = 4200;
const HERO_ROTATE_MS = 3600;

const RANGE_META: Record<
  RankRange,
  { label: string; title: string; subtitle: string; rewardTitle: string }
> = {
  daily: {
    label: '일간',
    title: '오늘의 추월전',
    subtitle: '지금 쌓는 공부시간이 오늘 순위를 바로 흔듭니다.',
    rewardTitle: '오늘 배틀 보상',
  },
  weekly: {
    label: '주간',
    title: '실시간 경쟁 랭킹',
    subtitle: '이번 주 전장을 누가 밀고 있는지 한눈에 보세요.',
    rewardTitle: '주간 배틀 보상',
  },
  monthly: {
    label: '월간',
    title: '라이브 배틀 리더보드',
    subtitle: '장기전으로 끌고 가는 상위권 경쟁 흐름을 확인하세요.',
    rewardTitle: '월간 시즌 보상',
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
    chip: 'border-[#FFB15B]/70 bg-[#FFF1DC] text-[#C86A10]',
    glow: 'shadow-[0_0_28px_rgba(255,165,78,0.32)]',
    line: 'from-[#FFAC55] via-[#FFD5A5] to-transparent',
    text: 'text-[#C86A10]',
  },
  red: {
    chip: 'border-[#FF9A95]/70 bg-[#FFF0EF] text-[#C54E4E]',
    glow: 'shadow-[0_0_28px_rgba(255,106,106,0.28)]',
    line: 'from-[#FF7A68] via-[#FFD1C8] to-transparent',
    text: 'text-[#C54E4E]',
  },
  blue: {
    chip: 'border-[#9DD4FF]/70 bg-[#F1F8FF] text-[#3261B4]',
    glow: 'shadow-[0_0_28px_rgba(90,135,236,0.24)]',
    line: 'from-[#5A87EC] via-[#C2DBFF] to-transparent',
    text: 'text-[#3261B4]',
  },
  gold: {
    chip: 'border-[#F5D07B]/70 bg-[#FFF7E0] text-[#A16B0E]',
    glow: 'shadow-[0_0_28px_rgba(240,200,110,0.26)]',
    line: 'from-[#F0C86E] via-[#FFE6A7] to-transparent',
    text: 'text-[#A16B0E]',
  },
};

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
  if (minutes <= 0) return '0.0h';
  return `${(minutes / 60).toFixed(1)}h`;
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function assignRanks(entries: BattleEntry[]) {
  return [...entries]
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.displayNameSnapshot.localeCompare(b.displayNameSnapshot, 'ko');
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

function buildFallbackEntries(range: RankRange, viewerId: string) {
  const baseMap: Record<RankRange, BattleEntry[]> = {
    daily: [
      { id: 'fallback-top', studentId: 'rival-top', displayNameSnapshot: '성*민', classNameSnapshot: null, schoolNameSnapshot: '구성고등학교', value: 288, rank: 1 },
      { id: 'fallback-viewer', studentId: viewerId, displayNameSnapshot: '나', classNameSnapshot: null, schoolNameSnapshot: '현재 사용자', value: 252, rank: 2, isViewer: true },
      { id: 'fallback-rival', studentId: 'rival-under', displayNameSnapshot: '이*윤', classNameSnapshot: null, schoolNameSnapshot: '경희대학교', value: 234, rank: 3 },
      { id: 'fallback-4', studentId: 'rival-4', displayNameSnapshot: '박*준', classNameSnapshot: null, schoolNameSnapshot: '대성고등학교', value: 214, rank: 4 },
    ],
    weekly: [
      { id: 'fallback-top-w', studentId: 'rival-top-w', displayNameSnapshot: '성*민', classNameSnapshot: null, schoolNameSnapshot: '구성고등학교', value: 1740, rank: 1 },
      { id: 'fallback-viewer-w', studentId: viewerId, displayNameSnapshot: '나', classNameSnapshot: null, schoolNameSnapshot: '현재 사용자', value: 1620, rank: 2, isViewer: true },
      { id: 'fallback-rival-w', studentId: 'rival-under-w', displayNameSnapshot: '이*윤', classNameSnapshot: null, schoolNameSnapshot: '경희대학교', value: 1512, rank: 3 },
      { id: 'fallback-4-w', studentId: 'rival-4-w', displayNameSnapshot: '정*현', classNameSnapshot: null, schoolNameSnapshot: '중동고등학교', value: 1420, rank: 4 },
    ],
    monthly: [
      { id: 'fallback-top-m', studentId: 'rival-top-m', displayNameSnapshot: '성*민', classNameSnapshot: null, schoolNameSnapshot: '구성고등학교', value: 7360, rank: 1 },
      { id: 'fallback-viewer-m', studentId: viewerId, displayNameSnapshot: '나', classNameSnapshot: null, schoolNameSnapshot: '현재 사용자', value: 6840, rank: 2, isViewer: true },
      { id: 'fallback-rival-m', studentId: 'rival-under-m', displayNameSnapshot: '이*윤', classNameSnapshot: null, schoolNameSnapshot: '경희대학교', value: 6410, rank: 3 },
      { id: 'fallback-4-m', studentId: 'rival-4-m', displayNameSnapshot: '박*준', classNameSnapshot: null, schoolNameSnapshot: '대성고등학교', value: 6180, rank: 4 },
    ],
  };

  return assignRanks(baseMap[range]);
}

function ensureViewerEntry(entries: StudentRankEntry[], viewerId: string) {
  const hasViewer = entries.some((entry) => entry.studentId === viewerId);
  if (hasViewer) {
    return assignRanks(entries.map((entry) => ({ ...entry, isViewer: entry.studentId === viewerId })));
  }

  const fallbackViewer: BattleEntry = {
    id: `viewer-${viewerId}`,
    studentId: viewerId,
    displayNameSnapshot: '나',
    classNameSnapshot: null,
    schoolNameSnapshot: '현재 사용자',
    value: entries.length > 0 ? Math.max(120, entries[Math.min(1, entries.length - 1)].value - 24) : 252,
    rank: 0,
    isViewer: true,
  };

  return assignRanks([...entries.map((entry) => ({ ...entry, isViewer: entry.studentId === viewerId })), fallbackViewer]);
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

function buildRewardState(viewerValue: number): RewardState {
  const cycle = 90;
  const progress = clamp(Math.round(((viewerValue % cycle) / cycle) * 100), 8, 100);
  const minutesToReward = cycle - (viewerValue % cycle || cycle);
  return {
    progress,
    minutesToReward,
    currentReward: '상자 +1',
    nextReward: '20,000P',
  };
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
    messages.push(`지금 ${Math.max(8, Math.min(diffAbove + 1, 18))}분만 더 하면 1위 탈환 가능`);
    messages.push('조금만 더 하면 판이 바뀝니다');
  }

  if (mode === 'danger') {
    messages.push('뒤에서 따라오고 있어요. 방심 금지');
    messages.push(`지금 멈추면 ${Math.max(8, Math.min(diffBelow + 4, 16))}분 차이로 흔들릴 수 있어요`);
  }

  if (mode === 'defense') {
    messages.push('지금 페이스 좋습니다. 밀어붙이세요');
    messages.push('실드가 살아 있습니다. 선두를 지키는 중이에요');
  }

  if (mode === 'chase') {
    messages.push('오늘 1위, 아직 충분히 가능합니다');
    messages.push('지금 안 밀면 올라갈 수 있어요');
  }

  if (viewerRank > 2) {
    messages.push('상위권 진입 압박 구간입니다. 한 블록만 더 버텨보세요');
  }

  if (latestLog) {
    messages.push(latestLog.title);
  }

  return [...new Set(messages)].slice(0, 4);
}

function buildInitialLogs(entries: BattleEntry[], viewerId: string) {
  const top = entries[0];
  const viewer = entries.find((entry) => entry.studentId === viewerId) ?? entries[1] ?? entries[0];
  const rival = entries.find((entry) => entry.rank === viewer.rank + 1) ?? entries[2] ?? viewer;
  const diffAbove = Math.max(0, (top?.value ?? viewer.value) - viewer.value);

  return [
    {
      id: 'seed-1',
      tone: 'orange' as const,
      badge: 'LIVE PUSH',
      title: `${top?.displayNameSnapshot ?? '성*민'} 님이 25분 추가 기록`,
      detail: '선두 존에서 오렌지 파동이 더 강해졌어요.',
      target: 'top' as const,
    },
    {
      id: 'seed-2',
      tone: 'red' as const,
      badge: 'PRESSURE',
      title: `${rival.displayNameSnapshot} 님이 추격 중`,
      detail: `${Math.max(12, diffAbove)}분 차이 전장으로 압박이 올라오고 있어요.`,
      target: 'rival' as const,
    },
    {
      id: 'seed-3',
      tone: 'gold' as const,
      badge: 'OVERTAKE',
      title: `지금 ${Math.max(12, Math.min(diffAbove + 1, 24))}분 더 하면 역전권 진입`,
      detail: '이번 블록만 밀어붙이면 전장 중앙을 넘길 수 있어요.',
      target: 'viewer' as const,
    },
  ];
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
      title: '지금이 치고 올라갈 타이밍이에요',
      action: `오늘 다음 블록을 ${Math.max(40, Math.min(diffAbove + 12, 70))}분 이상으로 잡아보세요.`,
      reason: `현재 1위와 ${formatGapLabel(diffAbove)} 차이라, 한 블록만 잘 밀어도 전장 중앙을 넘길 수 있어요.`,
      explainWhy: '추격 거리가 짧을수록 첫 블록을 길게 가져가는 편이 순위 반전에 더 유리해요.',
      cta: '오늘 계획에 반영하기',
    });
  }

  if (below && diffBelow <= 18) {
    recommendations.push({
      id: 'defense-route',
      tone: 'mindset',
      title: '지금은 선두 방어가 먼저예요',
      action: '새 과목을 넓히기보다, 이미 잡은 핵심 과목 한 블록을 끝까지 지켜보세요.',
      reason: `${below.displayNameSnapshot} 님과 ${formatGapLabel(diffBelow)} 차이라 방어가 흔들리기 쉬운 구간입니다.`,
      explainWhy: '격차가 좁을 때는 과목을 늘리는 것보다 이미 잡은 블록을 끊기지 않게 마무리하는 편이 더 안전해요.',
      cta: '방어 루트 적용하기',
    });
  }

  if (recommendations.length < 2) {
    recommendations.push({
      id: 'review-slot',
      tone: 'review',
      title: '오늘 마지막 20분은 복습으로 남겨두는 걸 추천해요',
      action: '새 공부를 조금 줄이고, 오늘 한 내용을 오답이나 회상 형태로 짧게 정리해보세요.',
      reason: '바로 다시 꺼내보는 공부가 오늘 쌓은 시간을 실제 점수로 연결하는 데 도움이 됩니다.',
      explainWhy: '기록만 쌓는 날보다 마지막 복습 블록이 있는 날이 전투 로그에서도 더 안정적인 페이스를 만듭니다.',
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
      explainWhy: '전장 압박이 커질수록 계획을 크게 잡기보다 끝까지 수행 가능한 구조가 더 유리합니다.',
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
      'rounded-full border border-[#E5C7A8] bg-white/92 p-1 shadow-[0_14px_36px_rgba(17,39,88,0.08)] backdrop-blur',
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
              isMobile ? 'px-3 py-2 text-xs font-black tracking-[0.12em]' : 'px-4 py-2 text-sm font-semibold tracking-[0.18em]',
              isActive
                ? 'bg-gradient-to-r from-[#FF9A38] via-[#FFB861] to-[#FFD08B] text-[#3F2205] shadow-[0_10px_28px_rgba(255,150,56,0.34)]'
                : 'text-[#576C98] hover:text-[#132A63]'
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
  isMobile = false,
}: {
  range: RankRange;
  onRangeChange: (next: RankRange) => void;
  activeMessage: string;
  isMobile?: boolean;
}) {
  return (
    <section className={cn(
      'relative overflow-hidden rounded-[32px] border border-[#E7D2BE] bg-[radial-gradient(circle_at_top,_rgba(255,192,118,0.26),_transparent_34%),linear-gradient(155deg,#FFF9EF_0%,#FFF1DD_62%,#FFE6BD_100%)] text-[#132A63] shadow-[0_28px_80px_rgba(22,45,99,0.12)]',
      isMobile ? 'p-5' : 'p-6 md:p-8'
    )}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.72),transparent_44%,transparent_72%,rgba(255,170,85,0.08))]" />
      <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-[#FFB14B]/18 blur-3xl" />
      <div className={cn('relative flex flex-col', isMobile ? 'gap-5' : 'gap-6 lg:flex-row lg:items-start lg:justify-between')}>
        <div className={cn(isMobile ? 'max-w-none' : 'max-w-3xl')}>
          <div className={cn(
            'inline-flex items-center gap-2 rounded-full border border-[#F2C78F] bg-white/82 text-[#BA6815]',
            isMobile ? 'mb-3 px-3.5 py-2 text-[11px] font-black tracking-[0.18em]' : 'mb-4 px-4 py-2 text-xs font-black tracking-[0.28em]'
          )}>
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#FF9A38] shadow-[0_0_16px_rgba(255,154,56,0.95)]" />
            LIVE BATTLE
          </div>
          <h1 className={cn(
            'font-aggro-display font-black tracking-[-0.05em] text-[#132A63]',
            isMobile ? 'text-[2.1rem] leading-[0.92] whitespace-nowrap' : 'text-[2.2rem] leading-[0.94] md:text-[3.1rem]'
          )}>
            {RANGE_META[range].title}
          </h1>
          <p className={cn(
            'max-w-2xl font-semibold text-[#5B7098]',
            isMobile ? 'mt-3 text-base leading-8' : 'mt-3 text-sm leading-7 md:text-base'
          )}>
            {RANGE_META[range].subtitle}
          </p>
          <div className={cn(
            'max-w-2xl rounded-[24px] border border-[#EDD4BD] bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(255,249,240,0.92))] backdrop-blur-xl shadow-[0_18px_40px_rgba(20,41,95,0.08)]',
            isMobile ? 'mt-4 min-h-[116px] px-4 py-4' : 'mt-5 min-h-[72px] px-5 py-4'
          )}>
            <div className={cn('flex items-center gap-2 font-black text-[#BA6815]', isMobile ? 'mb-2 text-[10px] tracking-[0.16em]' : 'mb-2 text-[11px] tracking-[0.22em]')}>
              <Swords className="h-4 w-4" />
              전장 브리핑
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={activeMessage}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className={cn(
                  'font-black leading-snug tracking-[-0.03em] text-[#132A63]',
                  isMobile ? 'text-[1.05rem]' : 'text-xl md:text-2xl'
                )}
              >
                {activeMessage}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <div className={cn(isMobile ? 'w-full' : 'flex justify-end lg:min-w-[220px]')}>
          <PeriodTabs value={range} onChange={onRangeChange} isMobile={isMobile} />
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
  mode,
}: {
  leftLabel: string;
  rightLabel: string;
  leftValue: number;
  rightValue: number;
  mode: BattleMode;
}) {
  const difference = leftValue - rightValue;
  const marker = clamp(50 + (difference / Math.max(leftValue, rightValue, 1)) * 35, 10, 90);

  return (
    <div className="rounded-[28px] border border-[#E8D5C1] bg-[linear-gradient(180deg,#FFFCF5_0%,#FFF6E7_100%)] p-4 shadow-[0_18px_34px_rgba(20,41,95,0.08)]">
      <div className="mb-3 flex items-center justify-between text-[11px] font-black tracking-[0.2em] text-[#7A86A2]">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div className="relative h-14 overflow-hidden rounded-full border border-[#E6D8C8] bg-[#FFF0DD]">
        <div className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,rgba(255,143,38,0.95),rgba(255,193,113,0.92))]" style={{ width: `${marker}%` }} />
        <div
          className={cn(
            'absolute inset-y-0 right-0 bg-[linear-gradient(270deg,rgba(255,111,95,0.92),rgba(255,177,132,0.72))]',
            mode === 'defense' && 'bg-[linear-gradient(270deg,rgba(255,140,102,0.88),rgba(255,200,154,0.68))]'
          )}
          style={{ width: `${100 - marker}%` }}
        />
        <motion.div
          className="absolute inset-y-1 left-0 w-24 rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.62),transparent)] mix-blend-screen"
          animate={{ x: ['-10%', '120%'] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-y-0 w-[3px] bg-white shadow-[0_0_18px_rgba(255,255,255,0.92)]"
          style={{ left: `calc(${marker}% - 1px)` }}
          animate={{ opacity: [0.65, 1, 0.65], scaleY: [0.85, 1.08, 0.85] }}
          transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border border-white/30 bg-[radial-gradient(circle,_rgba(255,246,218,0.96)_0%,_rgba(255,178,84,0.92)_50%,_rgba(255,120,56,0.9)_100%)] shadow-[0_0_24px_rgba(255,169,88,0.85)]"
          style={{ left: `calc(${marker}% - 10px)` }}
          animate={{
            scale: [1, 1.15, 1],
            boxShadow: [
              '0 0 18px rgba(255,169,88,0.55)',
              '0 0 36px rgba(255,169,88,0.95)',
              '0 0 18px rgba(255,169,88,0.55)',
            ],
          }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm font-bold">
        <div className="rounded-2xl border border-[#FFC27A]/60 bg-[#FFF0D7] px-3 py-2 text-[#B96510]">
          내 압박 {formatStudyCompact(leftValue)}
        </div>
        <div className="rounded-2xl border border-[#E6D8C8] bg-white/92 px-3 py-2 text-right text-[#6E7893]">
          상대 압박 {formatStudyCompact(rightValue)}
        </div>
      </div>
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
    <div className="relative overflow-hidden rounded-[28px] border border-[#E7D6C4] bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(255,247,237,0.96)_100%)] p-4 shadow-[0_16px_32px_rgba(20,41,95,0.08)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.78),transparent_40%,transparent_74%,rgba(255,181,100,0.06))]" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-black tracking-[0.22em] text-[#7A86A2]">{label}</div>
          <div className={cn('rounded-[1rem] border px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]', toneClass.chip)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-4 text-[2.55rem] font-black leading-none tracking-[-0.06em] text-[#132A63]">{value}</div>
        <div className={cn('mt-3 text-[13px] font-black leading-6', toneClass.text)}>{hint}</div>
      </div>
    </div>
  );
}

function MyBattleCard({
  viewer,
  top,
  below,
  mode,
  pressure,
  rewardState,
  isMobile = false,
}: {
  viewer: BattleEntry;
  top: BattleEntry | null;
  below: BattleEntry | null;
  mode: BattleMode;
  pressure: PressureLevel;
  rewardState: RewardState;
  isMobile?: boolean;
}) {
  const diffAbove = Math.max(0, (top?.value ?? viewer.value) - viewer.value);
  const diffBelow = below ? Math.max(0, viewer.value - below.value) : 0;
  const statusLabel =
    mode === 'attack'
      ? '추월각'
      : mode === 'defense'
        ? '선두 방어'
        : mode === 'danger'
          ? '방어 경고'
          : '상위권 압박';
  const helperCopy =
    mode === 'attack'
      ? `1위까지 ${formatGapLabel(diffAbove)}. 지금 판을 밀고 있어요.`
      : mode === 'defense'
        ? `뒤 순위와 ${formatGapLabel(diffBelow)} 차이. 방어막이 유지 중입니다.`
        : mode === 'danger'
          ? `${below?.displayNameSnapshot ?? '뒤 경쟁자'} 님이 바로 아래에서 추격 중이에요.`
          : `상위권과 ${formatGapLabel(diffAbove)} 차이. 전진 구간입니다.`;

  return (
    <motion.section
      layout
      className={cn(
        'relative overflow-hidden rounded-[34px] border border-[#E7D1B9] bg-[radial-gradient(circle_at_top_right,rgba(255,187,108,0.24),transparent_28%),linear-gradient(180deg,#FFF9F1_0%,#FFF4E8_48%,#FFE7C8_100%)] text-[#132A63] shadow-[0_24px_60px_rgba(20,41,95,0.12)]',
        isMobile ? 'p-5' : 'p-6 md:p-7'
      )}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
    >
      <DefenseShieldEffect active={mode === 'defense' || mode === 'danger'} pressure={pressure} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.82),transparent_32%,transparent_66%,rgba(255,140,40,0.08))]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[33px] border border-white/55" />
      <div className="relative">
        <div className={cn('items-start justify-between gap-4', isMobile ? 'mb-4 space-y-4' : 'mb-5 flex flex-wrap')}>
          <div>
            <div className={cn(
              'inline-flex items-center gap-2 rounded-full border border-[#F2C78F] bg-white/88 font-black text-[#BA6815]',
              isMobile ? 'mb-2 px-3 py-2 text-[10px] tracking-[0.14em]' : 'mb-2 px-3 py-2 text-[11px] tracking-[0.2em]'
            )}>
              <Zap className="h-4 w-4" />
              {statusLabel}
            </div>
            <div className={cn('gap-3', isMobile ? 'space-y-3' : 'flex flex-wrap items-end')}>
              <div>
                <div className={cn('font-black text-[#7A86A2]', isMobile ? 'text-[10px] tracking-[0.15em]' : 'text-[11px] tracking-[0.22em]')}>일간 LIVE TRACK</div>
                <div className={cn('mt-2 font-black leading-none tracking-[-0.06em] text-[#132A63]', isMobile ? 'text-[3.4rem]' : 'text-6xl')}>
                  #{viewer.rank}
                </div>
              </div>
              <div className={cn(isMobile ? '' : 'pb-2')}>
                <div className={cn('font-bold text-[#6E7893]', isMobile ? 'text-sm' : 'text-sm')}>공부중 {formatStudyCompact(viewer.value)}</div>
                <div className={cn('mt-2 font-black text-[#C86A10]', isMobile ? 'text-base leading-7' : 'text-lg')}>{helperCopy}</div>
              </div>
            </div>
          </div>

          <motion.div
            className={cn(
              'rounded-[26px] border border-[#F0D8B7] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF6EA_100%)] text-right shadow-[0_18px_40px_rgba(20,41,95,0.08)]',
              isMobile ? 'w-full px-4 py-4 text-left' : 'px-5 py-4'
            )}
            animate={{ boxShadow: ['0 0 0 rgba(255,154,56,0.1)', '0 0 30px rgba(255,154,56,0.26)', '0 0 0 rgba(255,154,56,0.1)'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className={cn('font-black text-[#7A86A2]', isMobile ? 'text-[10px] tracking-[0.18em]' : 'text-[11px] tracking-[0.24em]')}>
              {mode === 'defense' ? 'DEFENSE HOLD' : 'LIVE PUSH'}
            </div>
            <div className={cn('mt-1 font-black text-[#132A63]', isMobile ? 'text-xl' : 'text-2xl')}>
              {mode === 'defense'
                ? `방어 ${formatGapLabel(diffBelow)}`
                : `공부중 +${Math.max(0, rewardState.minutesToReward - 28)}분`}
            </div>
          </motion.div>
        </div>

        <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'md:grid-cols-3')}>
          <BattleStatCard label="누적 공부" value={formatStudyCompact(viewer.value)} hint="현재 전투 누적" tone="orange" icon={Clock3} />
          <BattleStatCard label="1위와 차이" value={viewer.rank === 1 ? '선두' : formatGapLabel(diffAbove)} hint={viewer.rank === 1 ? '정상 점령 중' : '지금 한 세션 더'} tone="gold" icon={Crown} />
          <BattleStatCard label="바로 아래 차이" value={below ? formatGapLabel(diffBelow) : '여유'} hint={below ? `${below.displayNameSnapshot} 추격` : '아래 경쟁 없음'} tone={pressure === 'critical' ? 'red' : 'blue'} icon={ShieldAlert} />
        </div>

        <div className="mt-5">
          <BattleGauge
            leftLabel="내 전장"
            rightLabel={viewer.rank === 1 ? '추격 파동' : '1위 존'}
            leftValue={viewer.value}
            rightValue={viewer.rank === 1 ? (below?.value ?? viewer.value - 10) : (top?.value ?? viewer.value + 10)}
            mode={mode}
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
                  {entry.rank}위 LIVE
                </div>
                <div className="mt-3 truncate text-lg font-black tracking-[-0.03em] text-[#132A63]">
                  {entry.displayNameSnapshot}
                </div>
                <div className="mt-1 truncate text-xs font-semibold text-[#6E7893]">
                  {formatSchoolName(entry.schoolNameSnapshot)}
                </div>
              </div>
              {entry.rank === 1 ? <Crown className="h-5 w-5 text-[#FFD989]" /> : null}
            </div>

            <div className="mt-4 rounded-[18px] border border-[#E8D8C6] bg-[#FFF4E3] px-3 py-3">
              <div className="text-[11px] font-black tracking-[0.18em] text-[#7A86A2]">현재 공부중</div>
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
  isMobile = false,
}: {
  leaders: BattleEntry[];
  viewer: BattleEntry;
  isMobile?: boolean;
}) {
  const toneMap: Record<number, LogTone> = {
    1: 'gold',
    2: 'orange',
    3: 'red',
  };

  return (
    <aside className={cn(
      'rounded-[30px] border border-[#E6D2BE] bg-[radial-gradient(circle_at_top_right,rgba(255,192,120,0.16),transparent_26%),linear-gradient(180deg,#FFF9F1_0%,#FFF1DE_100%)] text-[#132A63] shadow-[0_20px_48px_rgba(20,41,95,0.1)]',
      isMobile ? 'p-4' : 'p-5 md:p-6'
    )}>
      <div className={cn(isMobile ? 'mb-3' : 'mb-4')}>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#F0D3B2] bg-white/88 px-3 py-2 text-[11px] font-black tracking-[0.2em] text-[#9A5B12]">
          <Trophy className="h-4 w-4" />
          현재 순위
        </div>
        <h3 className={cn('font-black tracking-[-0.04em] text-[#132A63]', isMobile ? 'text-xl' : 'text-2xl')}>실시간 TOP 3</h3>
        <p className={cn('mt-2 font-semibold leading-6 text-[#64779C]', isMobile ? 'text-[13px]' : 'text-sm')}>
          지금 올라와 있는 상위권과 내 현재 위치를 바로 확인해보세요.
        </p>
      </div>

      <div className={cn(isMobile ? 'space-y-2.5' : 'space-y-3')}>
        {leaders.map((entry) => {
          const toneClass = TONE_CLASS_MAP[toneMap[entry.rank] ?? 'blue'];
          return (
            <motion.div
              key={entry.studentId}
              layout
              className={cn(
                'rounded-[22px] border shadow-[0_14px_28px_rgba(20,41,95,0.08)]',
                entry.isViewer
                  ? 'border-[#FFBE77] bg-[linear-gradient(180deg,#FFF7EA_0%,#FFE8C3_100%)]'
                  : 'border-[#E8D5C1] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF8EE_100%)]'
              )}
              style={isMobile ? { padding: '14px 16px' } : { padding: '16px' }}
              whileHover={{ y: -2, scale: 1.01 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {isMobile ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black tracking-[0.18em]', toneClass.chip)}>
                        {entry.rank}위
                        {entry.rank === 1 ? <Crown className="h-3.5 w-3.5" /> : null}
                      </div>
                      {entry.isViewer ? (
                        <div className="rounded-full border border-[#FFBE77] bg-white/92 px-2.5 py-1 text-[10px] font-black tracking-[0.16em] text-[#C86A10]">
                          나
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-2 truncate text-base font-black tracking-[-0.03em] text-[#132A63]">
                      {entry.displayNameSnapshot}
                    </div>
                    <div className="mt-0.5 truncate text-[12px] font-semibold text-[#6E7893]">
                      {formatSchoolName(entry.schoolNameSnapshot)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] font-black tracking-[0.18em] text-[#7A86A2]">공부중</div>
                    <div className="mt-1 text-[1.6rem] font-black leading-none tracking-[-0.05em] text-[#132A63]">
                      {formatStudyCompact(entry.value)}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black tracking-[0.18em]', toneClass.chip)}>
                        {entry.rank}위
                        {entry.rank === 1 ? <Crown className="h-3.5 w-3.5" /> : null}
                      </div>
                      <div className="mt-3 truncate text-lg font-black tracking-[-0.03em] text-[#132A63]">
                        {entry.displayNameSnapshot}
                      </div>
                      <div className="mt-1 truncate text-xs font-semibold text-[#6E7893]">
                        {formatSchoolName(entry.schoolNameSnapshot)}
                      </div>
                    </div>
                    {entry.isViewer ? (
                      <div className="rounded-full border border-[#FFBE77] bg-white/92 px-3 py-1 text-[11px] font-black tracking-[0.18em] text-[#C86A10]">
                        나
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-4 text-3xl font-black tracking-[-0.05em] text-[#132A63]">
                    {formatStudyCompact(entry.value)}
                  </div>
                </>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className={cn(
        'rounded-[22px] border border-[#E8D5C1] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF7EC_100%)] shadow-[0_14px_28px_rgba(20,41,95,0.08)]',
        isMobile ? 'mt-3 px-4 py-3.5' : 'mt-4 px-4 py-4'
      )}>
        <div className="text-[11px] font-black tracking-[0.2em] text-[#7A86A2]">내 현재 순위</div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <div className={cn('font-black tracking-[-0.06em] text-[#132A63]', isMobile ? 'text-[2.2rem]' : 'text-4xl')}>#{viewer.rank}</div>
            <div className={cn('mt-1 font-semibold text-[#64779C]', isMobile ? 'text-[13px]' : 'text-sm')}>{formatStudyClock(viewer.value)} 공부중</div>
          </div>
          <div className="rounded-full border border-[#F0D3B2] bg-[#FFF5E5] px-3 py-2 text-[11px] font-black tracking-[0.18em] text-[#9A5B12]">
            LIVE
          </div>
        </div>
      </div>
    </aside>
  );
}

function LiveActivityLog({ logs, leaders }: { logs: LiveLog[]; leaders: BattleEntry[] }) {
  return (
    <section className="rounded-[30px] border border-[#E6D2BE] bg-[linear-gradient(180deg,#FFF9F0_0%,#FFF0DB_100%)] p-5 text-[#132A63] shadow-[0_20px_54px_rgba(20,41,95,0.1)] md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#F0D3B2] bg-white/88 px-3 py-2 text-[11px] font-black tracking-[0.2em] text-[#9A5B12]">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#FF6C57] shadow-[0_0_16px_rgba(255,108,87,0.9)]" />
            LIVE FEED
          </div>
          <h3 className="text-2xl font-black tracking-[-0.04em] text-[#132A63]">실시간 전투 로그</h3>
        </div>
        <div className="rounded-full border border-[#E7D5C0] bg-white/92 px-3 py-2 text-[11px] font-black tracking-[0.18em] text-[#6E7893]">
          3~5초 간격 갱신
        </div>
      </div>

      <LiveTopThreeBoard entries={leaders} />

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {logs.map((log) => {
            const toneClass = TONE_CLASS_MAP[log.tone];
            return (
              <motion.div
                key={log.id}
                layout
                initial={{ opacity: 0, x: -24, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 18, scale: 0.96 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="relative overflow-hidden rounded-[22px] border border-[#E8D5C1] bg-white p-4 shadow-[0_14px_28px_rgba(20,41,95,0.08)]"
              >
                <div className={cn('pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r opacity-60', toneClass.line)} />
                <div className="relative flex items-start gap-3">
                  <div className={cn('rounded-full border px-3 py-1 text-[11px] font-black tracking-[0.18em]', toneClass.chip)}>
                    {log.badge}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-black tracking-[-0.02em] text-[#132A63]">{log.title}</div>
                    <div className="mt-1 text-sm font-semibold leading-6 text-[#64779C]">{log.detail}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}

function RewardCard({
  rewardState,
  rewardTitle,
  viewerRank,
}: {
  rewardState: RewardState;
  rewardTitle: string;
  viewerRank: number;
}) {
  return (
    <motion.section
      className="relative overflow-hidden rounded-[30px] border border-[#FFB861]/22 bg-[linear-gradient(165deg,#FFF5E4_0%,#FFE7BF_48%,#FFD79A_100%)] p-5 text-[#162D63] shadow-[0_26px_60px_rgba(255,164,68,0.18)] md:p-6"
      animate={{ boxShadow: ['0 24px 60px rgba(255,164,68,0.16)', '0 28px 84px rgba(255,164,68,0.28)', '0 24px 60px rgba(255,164,68,0.16)'] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-[#FFB55A]/25 blur-3xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#F0C86E] bg-white/75 px-3 py-2 text-[11px] font-black tracking-[0.2em] text-[#A16B0E]">
            <Sparkles className="h-4 w-4" />
            {rewardTitle}
          </div>
          <h3 className="text-3xl font-black tracking-[-0.05em] text-[#102657]">
            {rewardState.minutesToReward}분 더 하면 {rewardState.currentReward} 오픈
          </h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#5E4B2D]">
            {viewerRank === 1
              ? '지금 밀어붙이면 선두 보상을 지키면서 상자까지 동시에 챙길 수 있어요.'
              : '지금 한 번 더 압박하면 보상 상자와 상위권 진입을 동시에 노릴 수 있어요.'}
          </p>
        </div>
        <motion.div
          className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-[#F0C86E] bg-white/88 text-[#C86A10]"
          animate={{ rotate: [0, 4, -4, 0], scale: [1, 1.04, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Gift className="h-8 w-8" />
        </motion.div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-sm font-black text-[#8B5A19]">
          <span>다음 보상 진행도</span>
          <span>{rewardState.progress}%</span>
        </div>
        <div className="relative h-4 overflow-hidden rounded-full bg-white/75">
          <motion.div className="h-full rounded-full bg-[linear-gradient(90deg,#FF9631_0%,#FFB85B_48%,#FFD895_100%)]" style={{ width: `${rewardState.progress}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
          <motion.div
            className="absolute inset-y-0 left-0 w-24 rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.7),transparent)]"
            animate={{ x: ['-10%', '120%'] }}
            transition={{ duration: 1.9, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-[22px] border border-[#F0C86E]/80 bg-white/75 p-4">
          <div className="text-[11px] font-black tracking-[0.2em] text-[#A16B0E]">상자 보상</div>
          <div className="mt-2 text-2xl font-black text-[#132A63]">{rewardState.currentReward}</div>
        </div>
        <div className="rounded-[22px] border border-[#F0C86E]/80 bg-white/75 p-4">
          <div className="text-[11px] font-black tracking-[0.2em] text-[#A16B0E]">1위 달성 시</div>
          <div className="mt-2 text-2xl font-black text-[#132A63]">{rewardState.nextReward}</div>
        </div>
      </div>
    </motion.section>
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
    <details className="group rounded-[24px] border border-[#E9D7C0] bg-white p-4 shadow-[0_18px_42px_rgba(16,38,87,0.08)]">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className={cn('mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-black tracking-[0.18em]', toneClass.chip)}>
              {chipMap[recommendation.tone]}
            </div>
            <h4 className="text-xl font-black tracking-[-0.03em] text-[#132A63]">{recommendation.title}</h4>
            <p className="mt-2 text-base font-bold text-[#23417B]">{recommendation.action}</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#64779C]">{recommendation.reason}</p>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              onApply(recommendation);
            }}
            className="rounded-full bg-[linear-gradient(90deg,#FF9A38,#FFB861)] px-4 py-3 text-sm font-black tracking-[0.04em] text-[#3F2205] shadow-[0_12px_26px_rgba(255,154,56,0.28)] transition hover:translate-y-[-1px]"
          >
            {recommendation.cta}
          </button>
        </div>
      </summary>
      <div className="mt-4 rounded-[20px] border border-[#E9D7C0] bg-[#FFF8ED] p-4 text-sm font-semibold leading-7 text-[#5E6F92]">
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
    <section className="rounded-[30px] border border-[#E2D1BC] bg-[linear-gradient(180deg,#FFF7EA_0%,#FFF3DE_100%)] p-5 text-[#132A63] shadow-[0_22px_60px_rgba(16,38,87,0.08)] md:p-6">
      <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#F0D8BF] bg-white/80 px-3 py-2 text-[11px] font-black tracking-[0.2em] text-[#9A5B12]">
            <Sparkles className="h-4 w-4" />
            오늘의 학습 추천
          </div>
          <h3 className="text-2xl font-black tracking-[-0.04em] text-[#132A63]">최근 기록을 보면 오늘은 이 정도만 바꾸면 됩니다</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#64779C]">
            최근 계획과 학습 기준을 바탕으로, 바로 오늘 계획에 넣을 수 있는 제안만 추렸어요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onReopenDiagnosis} className="rounded-full border border-[#E0C19D] bg-white/85 px-4 py-2 text-sm font-black text-[#132A63]">
            학습 기준 다시 진단하기
          </button>
          <button type="button" onClick={onViewDiagnosis} className="rounded-full border border-[#E0C19D] bg-[#FFF6E8] px-4 py-2 text-sm font-black text-[#9A5B12]">
            전체 진단 결과 보기
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

function simulateBattleTick(entries: BattleEntry[], viewerId: string): {
  entries: BattleEntry[];
  log: LiveLog;
  floatingEvent: FloatingEvent;
} {
  const current = assignRanks(entries);
  const viewer = current.find((entry) => entry.studentId === viewerId) ?? current[1] ?? current[0];
  const top = current[0] ?? viewer;
  const below = current.find((entry) => entry.rank === viewer.rank + 1) ?? current[current.length - 1];

  const actorPool: Array<{ id: string; weight: number }> = [];
  current.slice(0, 5).forEach((entry) => {
    const weight =
      entry.studentId === viewerId
        ? 0.42
        : entry.rank === 1
          ? 0.24
          : entry.studentId === below?.studentId
            ? 0.2
            : 0.14;
    actorPool.push({ id: entry.studentId, weight });
  });

  const totalWeight = actorPool.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * totalWeight;
  let actorId = actorPool[0]?.id ?? viewerId;
  for (const item of actorPool) {
    cursor -= item.weight;
    if (cursor <= 0) {
      actorId = item.id;
      break;
    }
  }

  const bonus =
    actorId === viewerId && top.value - viewer.value <= 36
      ? 6
      : actorId === below?.studentId && viewer.value - below.value <= 16
        ? 5
        : 0;
  const delta = 8 + Math.floor(Math.random() * 18) + bonus;

  const updated = current.map((entry) =>
    entry.studentId === actorId
      ? {
          ...entry,
          value: entry.value + delta,
        }
      : entry
  );

  const next = assignRanks(updated);
  const nextViewer = next.find((entry) => entry.studentId === viewerId) ?? viewer;
  const nextTop = next[0] ?? nextViewer;
  const nextBelow = next.find((entry) => entry.rank === nextViewer.rank + 1) ?? below;
  const actor = next.find((entry) => entry.studentId === actorId) ?? nextViewer;

  if (viewer.rank > nextViewer.rank) {
    return {
      entries: next,
      log: {
        id: `log-${Date.now()}`,
        tone: 'gold',
        badge: 'RANK UP',
        title: `나: 방금 ${nextViewer.rank}위 진입`,
        detail: '순위가 실제로 올라갔습니다. 지금 흐름을 더 밀어붙이세요.',
        target: 'viewer',
      },
      floatingEvent: {
        id: `float-${Date.now()}`,
        tone: 'gold',
        label: 'OVERTAKE',
        target: 'viewer',
      },
    };
  }

  if (actorId === viewerId) {
    const diffAbove = Math.max(0, nextTop.value - nextViewer.value);
    return {
      entries: next,
      log: {
        id: `log-${Date.now()}`,
        tone: 'orange',
        badge: 'LIVE PUSH',
        title: `나: ${delta}분 추가 기록`,
        detail:
          diffAbove > 0
            ? `지금 ${Math.max(10, Math.min(diffAbove + 1, 20))}분만 더 하면 역전권 진입이에요.`
            : '현재 선두를 밀어내고 방어막을 유지하고 있어요.',
        target: 'viewer',
      },
      floatingEvent: {
        id: `float-${Date.now()}`,
        tone: 'orange',
        label: `+${delta}m`,
        target: 'viewer',
      },
    };
  }

  if (actorId === nextTop.studentId) {
    return {
      entries: next,
      log: {
        id: `log-${Date.now()}`,
        tone: 'blue',
        badge: 'LEAD PUSH',
        title: `${actor.displayNameSnapshot} 님이 ${delta}분 추가 기록`,
        detail: '1위 존에서 방어막이 다시 두꺼워졌어요.',
        target: 'top',
      },
      floatingEvent: {
        id: `float-${Date.now()}`,
        tone: 'blue',
        label: `+${delta}m`,
        target: 'top',
      },
    };
  }

  return {
    entries: next,
    log: {
      id: `log-${Date.now()}`,
      tone: 'red',
      badge: 'PRESSURE',
      title: `${actor.displayNameSnapshot} 님이 ${delta}분 추가 기록`,
      detail:
        nextBelow && nextBelow.studentId === actor.studentId
          ? `지금 ${Math.max(8, Math.min(nextViewer.value - nextBelow.value, 18))}분 차이까지 추격해 왔어요.`
          : '아래 경쟁권에서도 파동이 올라오고 있어요.',
      target: 'rival',
    },
    floatingEvent: {
      id: `float-${Date.now()}`,
      tone: 'red',
      label: '추격 중',
      target: 'rival',
    },
  };
}

export default function RankingBattlePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { activeMembership, viewMode } = useAppContext();

  const range = (searchParams.get('range') as RankRange) || 'daily';
  const viewerId = user?.uid ?? 'viewer-local';
  const centerId = activeMembership?.id ?? null;

  const [snapshot, setSnapshot] = useState<StudentRankingSnapshot>(EMPTY_STUDENT_RANKING_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [battleEntries, setBattleEntries] = useState<BattleEntry[]>([]);
  const [logs, setLogs] = useState<LiveLog[]>([]);
  const [floatingEvents, setFloatingEvents] = useState<FloatingEvent[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);

  const entriesRef = useRef<BattleEntry[]>([]);

  useEffect(() => {
    entriesRef.current = battleEntries;
  }, [battleEntries]);

  useEffect(() => {
    let cancelled = false;

    if (!user || !centerId) {
      setSnapshot(EMPTY_STUDENT_RANKING_SNAPSHOT);
      setLoading(false);
      setFetchError(null);
      return;
    }

    setLoading(true);
    setFetchError(null);

    fetchStudentRankingSnapshot({ centerId, user })
      .then((result) => {
        if (!cancelled) setSnapshot(result);
      })
      .catch(() => {
        if (cancelled) return;
        setSnapshot(EMPTY_STUDENT_RANKING_SNAPSHOT);
        setFetchError('지금은 실시간 데이터를 불러오지 못해 샘플 전장으로 보여드리고 있어요.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [centerId, user]);

  const baseEntries = useMemo(() => {
    const currentRangeEntries = snapshot[range] ?? [];
    if (!currentRangeEntries.length) return buildFallbackEntries(range, viewerId);

    return ensureViewerEntry(currentRangeEntries, viewerId)
      .slice(0, 50)
      .map((entry) => ({
        ...entry,
        isViewer: entry.studentId === viewerId,
      }));
  }, [range, snapshot, viewerId]);

  useEffect(() => {
    setBattleEntries(baseEntries);
    setLogs(buildInitialLogs(baseEntries, viewerId));
    setFloatingEvents([]);
    setHeroIndex(0);
  }, [baseEntries, viewerId]);

  useEffect(() => {
    if (!battleEntries.length) return;

    const intervalId = window.setInterval(() => {
      const outcome = simulateBattleTick(entriesRef.current, viewerId);
      entriesRef.current = outcome.entries;
      setBattleEntries(outcome.entries);
      setLogs((prev) => [outcome.log, ...prev].slice(0, 7));
      setFloatingEvents((prev) => [...prev, outcome.floatingEvent].slice(-4));
    }, LIVE_TICK_MS);

    return () => window.clearInterval(intervalId);
  }, [battleEntries.length, viewerId, range]);

  useEffect(() => {
    if (!floatingEvents.length) return;
    const timeout = window.setTimeout(() => {
      setFloatingEvents((prev) => prev.slice(-2));
    }, 2200);
    return () => window.clearTimeout(timeout);
  }, [floatingEvents]);

  const viewer = useMemo(
    () => battleEntries.find((entry) => entry.studentId === viewerId) ?? battleEntries[1] ?? battleEntries[0] ?? null,
    [battleEntries, viewerId]
  );
  const top = battleEntries[0] ?? null;
  const liveLeaders = useMemo(() => battleEntries.slice(0, 3), [battleEntries]);
  const below = viewer ? battleEntries.find((entry) => entry.rank === viewer.rank + 1) ?? null : null;
  const diffAbove = viewer && top ? Math.max(0, top.value - viewer.value) : 0;
  const diffBelow = viewer && below ? Math.max(0, viewer.value - below.value) : 0;
  const mode = viewer ? getBattleMode(viewer.rank, diffAbove, diffBelow) : 'chase';
  const pressure = viewer ? getPressureLevel(viewer.rank, diffAbove, diffBelow) : 'stable';
  const rewardState = buildRewardState(viewer?.value ?? 0);
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
        : ['지금 전장을 준비하는 중입니다.'],
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
        badge: 'TACTIC',
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
        label: '작전 적용',
        target: 'viewer',
      },
    ]);
  }

  if (loading && !viewer) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,195,122,0.16),_transparent_24%),linear-gradient(180deg,#FFFDF9_0%,#FFF3E4_100%)] px-4 py-8 text-[#132A63]">
        <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center rounded-[32px] border border-[#E7D3C0] bg-white/92 shadow-[0_28px_80px_rgba(20,41,95,0.08)]">
          <div className="flex items-center gap-3 text-lg font-bold text-[#64779C]">
            <Loader2 className="h-5 w-5 animate-spin" />
            경쟁 전장을 불러오는 중입니다.
          </div>
        </div>
      </main>
    );
  }

  if (!viewer || !top) return null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,186,106,0.18),_transparent_22%),linear-gradient(180deg,#FFFCF8_0%,#FFF3E4_100%)] px-4 py-6 text-[#132A63] md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <HeroBattleHeader range={range} onRangeChange={handleRangeChange} activeMessage={heroMessages[heroIndex % Math.max(heroMessages.length, 1)]} isMobile={viewMode === 'mobile'} />

        {fetchError ? (
          <div className="rounded-[24px] border border-[#FFB15B]/30 bg-[#FFF4E5] px-4 py-3 text-sm font-semibold text-[#9A5B12]">
            {fetchError}
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_320px]">
          <div className="space-y-5">
            <MyBattleCard viewer={viewer} top={top} below={below} mode={mode} pressure={pressure} rewardState={rewardState} isMobile={viewMode === 'mobile'} />
          </div>
          <div className="space-y-5">
            <StandingsSidebar leaders={liveLeaders} viewer={viewer} isMobile={viewMode === 'mobile'} />
          </div>
        </div>
      </div>
    </main>
  );
}
