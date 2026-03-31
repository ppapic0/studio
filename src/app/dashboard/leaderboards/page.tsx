'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { eachDayOfInterval, format, startOfWeek } from 'date-fns';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import {
  ChevronRight,
  Clock3,
  Crown,
  Flame,
  Gift,
  Loader2,
  type LucideIcon,
  ShieldAlert,
  Sparkles,
  Swords,
  TimerReset,
  Users,
  Zap,
} from 'lucide-react';

import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { CenterMembership, DailyStudentStat, LeaderboardEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;
const TICKER_INTERVAL_MS = 2400;
const TOAST_INTERVAL_MS = 5200;

type RankRange = 'daily' | 'weekly' | 'monthly';

type RankEntryView = {
  id: string;
  studentId: string;
  displayNameSnapshot: string;
  classNameSnapshot: string | null;
  value: number;
  rank: number;
};

type RankEventTone = 'orange' | 'blue' | 'gold' | 'danger';

type RankLiveEvent = {
  id: string;
  emoji: string;
  title: string;
  detail: string;
  tone: RankEventTone;
  timestampLabel: string;
};

type ZoneCardConfig = {
  kicker: string;
  title: string;
  body: string;
  tone: RankEventTone;
  icon: LucideIcon;
};

const RANGE_META: Record<RankRange, { label: string; title: string; hint: string }> = {
  daily: {
    label: '일간',
    title: '오늘 경쟁 랭킹',
    hint: '오늘 누적 공부시간 기준',
  },
  weekly: {
    label: '주간',
    title: '이번 주 경쟁 랭킹',
    hint: '이번 주 누적 공부시간 기준',
  },
  monthly: {
    label: '월간',
    title: '이번 달 경쟁 랭킹',
    hint: '이번 달 누적 공부시간 기준',
  },
};

function formatMaskedName(name?: string | null) {
  if (!name) return '익명 학생';
  return name.length > 1 ? `${name.charAt(0)}*${name.slice(-1)}` : name;
}

function isSyntheticStudentId(studentId: unknown): boolean {
  if (typeof studentId !== 'string') return true;
  const normalized = studentId.trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.startsWith('test-')
    || normalized.startsWith('seed-')
    || normalized.startsWith('mock-')
    || normalized.includes('dummy')
  );
}

function applyCompetitionRanks(entries: Omit<RankEntryView, 'rank'>[]) {
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  let lastValue: number | null = null;
  let currentRank = 0;

  return sorted.map((entry, index) => {
    if (lastValue === null || entry.value < lastValue) {
      currentRank = index + 1;
      lastValue = entry.value;
    }
    return { ...entry, rank: currentRank };
  });
}

function formatHourValue(minutes: number) {
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

function clampProgress(value: number) {
  return Math.max(10, Math.min(100, Math.round(value)));
}

function getToneClasses(tone: RankEventTone) {
  switch (tone) {
    case 'gold':
      return {
        chip: 'border-amber-300/22 bg-amber-300/10 text-amber-100',
        line: 'from-amber-300/85 via-orange-400/68 to-transparent',
        text: 'text-amber-100',
      };
    case 'blue':
      return {
        chip: 'border-cyan-300/22 bg-cyan-300/10 text-cyan-100',
        line: 'from-cyan-300/85 via-blue-400/65 to-transparent',
        text: 'text-cyan-100',
      };
    case 'danger':
      return {
        chip: 'border-rose-300/20 bg-rose-400/10 text-rose-100',
        line: 'from-rose-300/85 via-orange-400/62 to-transparent',
        text: 'text-rose-100',
      };
    default:
      return {
        chip: 'border-orange-300/20 bg-orange-400/10 text-orange-100',
        line: 'from-orange-300/85 via-orange-400/65 to-transparent',
        text: 'text-orange-100',
      };
  }
}

function getPrimaryZone(rank: number, diffAbove: number): ZoneCardConfig {
  if (rank <= 1) {
    return {
      kicker: 'SAFE LEAD',
      title: '현재 선두 유지 중',
      body: '지금 페이스를 유지하면 선두를 계속 지킬 수 있어요.',
      tone: 'gold',
      icon: Crown,
    };
  }

  if (diffAbove <= 60) {
    return {
      kicker: 'OVERTAKE ZONE',
      title: `1위까지 ${formatGapLabel(diffAbove)}`,
      body: '오늘 한 세션만 더 밀어붙이면 바로 역전권이에요.',
      tone: 'orange',
      icon: Zap,
    };
  }

  return {
    kicker: 'HOT STREAK',
    title: `${formatGapLabel(diffAbove)} 차이 추격 중`,
    body: '지금 흐름이면 상위권을 강하게 압박할 수 있어요.',
    tone: 'blue',
    icon: Flame,
  };
}

function getDefenseZone(rank: number, diffBelow: number): ZoneCardConfig {
  if (rank <= 0) {
    return {
      kicker: 'SAFE LEAD',
      title: '아직 아래 경쟁자가 없어요',
      body: '먼저 공부시간을 쌓아 우위를 만들어보세요.',
      tone: 'blue',
      icon: ShieldAlert,
    };
  }

  if (rank === 1 && diffBelow >= 120) {
    return {
      kicker: 'SAFE LEAD',
      title: '뒤 순위와 여유 있는 격차',
      body: `현재 ${formatGapLabel(diffBelow)} 앞서 있어요. 선두 방어 구간입니다.`,
      tone: 'gold',
      icon: Crown,
    };
  }

  if (diffBelow > 0 && diffBelow <= 45) {
    return {
      kicker: 'DANGER ZONE',
      title: `${formatGapLabel(diffBelow)} 차이 추격`,
      body: '지금 멈추면 순위가 바로 흔들릴 수 있어요.',
      tone: 'danger',
      icon: ShieldAlert,
    };
  }

  return {
    kicker: 'SAFE LEAD',
    title: '현재 순위 안정권',
    body: diffBelow > 0
      ? `${formatGapLabel(diffBelow)} 차이로 뒤 순위를 앞서고 있어요.`
      : '지금 기록을 더 쌓으면 추격 압박을 크게 줄일 수 있어요.',
    tone: 'blue',
    icon: ShieldAlert,
  };
}

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        'surface-card surface-card--secondary on-dark rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] shadow-[0_24px_80px_rgba(2,6,23,0.35)] backdrop-blur-xl',
        className
      )}
    >
      {children}
    </section>
  );
}

function LiveBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-400/10 px-3 py-1.5 text-[11px] font-black tracking-[0.18em] text-orange-200">
      <span className="leaderboard-live-dot relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-400" />
      LIVE RANKING
    </div>
  );
}

function RankPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-4 py-2.5 text-sm font-black transition-all duration-200',
        active
          ? 'border-orange-300/28 bg-gradient-to-r from-orange-500 to-amber-400 text-slate-950 shadow-[0_8px_24px_rgba(251,146,60,0.35)]'
          : 'border-white/12 bg-white/[0.09] text-[var(--text-on-dark-soft)] hover:bg-white/[0.14] hover:text-white'
      )}
    >
      {label}
    </button>
  );
}

function TopSummaryCard({
  label,
  value,
  sub,
  tone = 'default',
  icon: Icon,
  compact = false,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'default' | 'orange' | 'blue';
  icon: LucideIcon;
  compact?: boolean;
}) {
  const toneClass = tone === 'orange'
    ? 'from-orange-500/18 via-orange-500/10 to-white/[0.04]'
    : tone === 'blue'
      ? 'from-blue-500/18 via-cyan-400/10 to-white/[0.04]'
      : 'from-white/[0.07] to-white/[0.03]';

  return (
    <Panel className={cn('bg-gradient-to-br', toneClass)}>
      <div className={cn(compact ? 'p-4' : 'p-5')}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black tracking-[0.18em] text-[var(--text-on-dark-soft)]">{label}</p>
            <p className={cn('mt-3 font-black tracking-tight text-white', compact ? 'text-[1.7rem] leading-none' : 'text-3xl')}>{value}</p>
            <p className={cn('mt-2 font-semibold text-[var(--text-on-dark-soft)]', compact ? 'text-[12px] leading-5' : 'text-sm')}>{sub}</p>
          </div>
          <div className={cn('rounded-2xl border border-white/12 bg-white/[0.1] text-white', compact ? 'p-2.5' : 'p-3')}>
            <Icon className={cn(compact ? 'h-4 w-4' : 'h-5 w-5')} />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function HeroBattleCard({
  rankLabel,
  hoursLabel,
  gapLabel,
  liveMinutes,
  progressPercent,
  rangeLabel,
  isLeader,
  compact = false,
}: {
  rankLabel: string;
  hoursLabel: string;
  gapLabel: string;
  liveMinutes: number;
  progressPercent: number;
  rangeLabel: string;
  isLeader: boolean;
  compact?: boolean;
}) {
  return (
    <Panel className="leaderboard-live-glow overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.18),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(56,189,248,0.12),transparent_22%),linear-gradient(135deg,#17326B_0%,#22478C_62%,#10285d_100%)]">
      <div className={cn(compact ? 'p-4' : 'p-6 sm:p-7')}>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-3 py-1 text-[11px] font-black tracking-[0.18em] text-[var(--text-on-dark-soft)]">
                <Swords className="h-3.5 w-3.5 text-orange-200" />
                MY BATTLE STATUS
              </div>
              <div>
                <p className="text-[11px] font-black tracking-[0.2em] text-[var(--text-on-dark-muted)]">{rangeLabel} LIVE TRACK</p>
                <div className={cn('mt-3 flex items-end gap-3', compact ? 'flex-wrap' : 'flex-nowrap')}>
                  <span className={cn('font-black tracking-tight text-white', compact ? 'text-[3rem] leading-[0.9]' : 'text-[4rem] leading-[0.86]')}>
                    {rankLabel}
                  </span>
                  <span className={cn('font-black text-white/88', compact ? 'pb-1 text-lg' : 'pb-2 text-2xl')}>
                    {hoursLabel}
                  </span>
                </div>
                <p className={cn('mt-3 max-w-xl font-semibold text-[var(--text-on-dark-soft)]', compact ? 'text-[13px] leading-5' : 'text-sm leading-6')}>
                  {isLeader ? '현재 선두 유지 중이에요. 지금 페이스를 유지하면 방어 성공 확률이 높아요.' : `1위까지 ${gapLabel}. 오늘 한 세션만 더 밀어붙이면 추월권이에요.`}
                </p>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/12 bg-white/[0.08] px-4 py-3 text-right shadow-[0_18px_38px_-28px_rgba(2,6,23,0.62)]">
              <div className="mb-1 flex items-center justify-end gap-2">
                <span className="leaderboard-live-dot relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-400" />
                <span className="text-[11px] font-black tracking-[0.18em] text-[var(--text-on-dark-muted)]">LIVE PUSH</span>
              </div>
              <p className={cn('font-black text-white', compact ? 'text-sm' : 'text-base')}>{isLeader ? '선두 방어 중' : `공부중 +${liveMinutes}분`}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              ['누적 공부', hoursLabel],
              ['1위와 차이', isLeader ? 'LEAD' : gapLabel],
              ['보상 진행', `${progressPercent}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[22px] border border-white/12 bg-white/[0.08] px-3.5 py-3">
                <p className="text-[10px] font-black tracking-[0.18em] text-[var(--text-on-dark-muted)]">{label}</p>
                <p className={cn('mt-2 font-black text-white', compact ? 'text-lg' : 'text-xl')}>{value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2.5 rounded-[24px] border border-white/12 bg-[#0b1738]/46 px-4 py-3">
            <div className="flex items-center justify-between text-[11px] font-black tracking-[0.18em]">
              <span className="text-[var(--text-on-dark-muted)]">OVERTAKE METER</span>
              <span className="text-orange-200">{progressPercent}% READY</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/8">
              <div
                className="leaderboard-race-fill relative h-full rounded-full bg-gradient-to-r from-[#FF9626] via-[#FFD36D] to-[#7AD4FF]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function LiveTickerBar({ event }: { event: RankLiveEvent }) {
  const tone = getToneClasses(event.tone);

  return (
    <Panel className="overflow-hidden">
      <div className="relative px-4 py-3 sm:px-5">
        <div className={cn('pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r', tone.line)} />
        <div key={event.id} className="leaderboard-ticker-item relative flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.1] text-lg">
              {event.emoji}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">{event.title}</p>
              <p className="truncate text-xs font-semibold text-[var(--text-on-dark-soft)]">{event.detail}</p>
            </div>
          </div>
          <div className={cn('inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black tracking-[0.18em]', tone.chip)}>
            <span className="leaderboard-live-dot relative inline-flex h-2 w-2 rounded-full bg-current" />
            {event.timestampLabel}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function ZoneCard({ zone, compact = false }: { zone: ZoneCardConfig; compact?: boolean }) {
  const tone = getToneClasses(zone.tone);
  const Icon = zone.icon;

  return (
    <Panel className={cn(
      'relative overflow-hidden',
      zone.tone === 'danger' && 'border-rose-300/16 bg-[linear-gradient(180deg,rgba(251,113,133,0.10),rgba(255,255,255,0.02))]',
      zone.tone === 'gold' && 'border-amber-300/18 bg-[linear-gradient(180deg,rgba(255,211,109,0.12),rgba(255,255,255,0.02))]',
      zone.tone === 'orange' && 'border-orange-300/18 bg-[linear-gradient(180deg,rgba(255,150,38,0.12),rgba(255,255,255,0.02))]',
      zone.tone === 'blue' && 'border-cyan-300/18 bg-[linear-gradient(180deg,rgba(122,212,255,0.12),rgba(255,255,255,0.02))]'
    )}>
      <div className={cn(compact ? 'p-4' : 'p-5')}>
        <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black tracking-[0.18em]', tone.chip)}>
          <Icon className="h-3.5 w-3.5" />
          {zone.kicker}
        </div>
        <p className="mt-4 text-lg font-black text-white">{zone.title}</p>
        <p className={cn('mt-2 font-semibold text-[var(--text-on-dark-soft)]', compact ? 'text-[13px] leading-5' : 'text-sm leading-6')}>{zone.body}</p>
      </div>
    </Panel>
  );
}

function RewardGoalCard({
  isLeader,
  progressPercent,
  gapLabel,
  compact = false,
}: {
  isLeader: boolean;
  progressPercent: number;
  gapLabel: string;
  compact?: boolean;
}) {
  const nearUnlock = isLeader || progressPercent >= 82;

  return (
    <Panel className={cn(
      'leaderboard-reward-card bg-gradient-to-br from-orange-500/16 via-amber-400/10 to-white/[0.03]',
      nearUnlock && 'leaderboard-reward-card--near'
    )}>
      <div className={cn(compact ? 'p-4' : 'p-5 sm:p-6')}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-[11px] font-black tracking-[0.18em] text-orange-200">
              <Sparkles className="h-3.5 w-3.5" />
              NEXT REWARD
            </div>
            <h3 className={cn('mt-4 font-black text-white', compact ? 'text-lg' : 'text-xl')}>1위 달성 시 +1000P</h3>
            <p className={cn('mt-2 text-[var(--text-on-dark-soft)]', compact ? 'text-[13px] leading-5' : 'text-sm leading-6')}>
              {isLeader ? '보상 해금권에 도달했어요. 지금 선두를 지키면 즉시 포인트를 받을 수 있어요.' : `보상 상자까지 ${gapLabel} 남음. 지금 밀어붙이면 보상 해금이 가까워져요.`}
            </p>
          </div>
          <div className="leaderboard-reward-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-white/12 bg-white/[0.1] text-orange-100 shadow-[0_18px_42px_-24px_rgba(251,146,60,0.65)]">
            <Gift className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-5 rounded-[22px] border border-white/12 bg-white/[0.08] p-4">
          <div className="mb-2 flex items-center justify-between text-sm font-black">
            <span className="text-[var(--text-on-dark-soft)]">보상 진행도</span>
            <span className="text-orange-200">{progressPercent}%</span>
          </div>
          <div className="leaderboard-reward-progress h-3 overflow-hidden rounded-full bg-white/8">
            <div
              className="leaderboard-reward-progress__fill h-full rounded-full bg-gradient-to-r from-[#FF9626] via-[#FFD36D] to-[#FFF1C1]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className={cn('mt-4 grid grid-cols-3 gap-2 text-center', compact && 'gap-1.5')}>
          {[
            ['1위', '20,000P'],
            ['2위', '10,000P'],
            ['3위', '5,000P'],
          ].map(([place, reward]) => (
            <div key={place} className={cn('rounded-2xl border border-white/12 bg-white/[0.1]', compact ? 'p-2.5' : 'p-3')}>
              <p className="text-[11px] font-black tracking-[0.18em] text-[var(--text-on-dark-muted)]">{place}</p>
              <p className={cn('mt-1 font-black text-white', compact ? 'text-[13px] leading-5' : 'text-sm')}>{reward}</p>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function LeaderboardRow({
  player,
  maxMinutes,
  index,
  compact = false,
  isTargetAbove = false,
  isThreatBelow = false,
}: {
  player: RankEntryView & { isMe: boolean };
  maxMinutes: number;
  index: number;
  compact?: boolean;
  isTargetAbove?: boolean;
  isThreatBelow?: boolean;
}) {
  const [fillReady, setFillReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setFillReady(true), 40 + index * 35);
    return () => window.clearTimeout(timer);
  }, [index, player.id]);

  const progress = maxMinutes > 0 ? clampProgress((player.value / maxMinutes) * 100) : 0;
  const rowTone = index === 0
    ? 'gold'
    : player.isMe
      ? 'orange'
      : isThreatBelow
        ? 'danger'
        : isTargetAbove
          ? 'blue'
          : 'default';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[24px] border transition-transform duration-200 hover:-translate-y-0.5',
        compact ? 'p-3.5' : 'p-4 sm:p-5',
        player.isMe
          ? 'leaderboard-my-row border-orange-400/25 bg-[linear-gradient(90deg,rgba(251,146,60,0.12),rgba(255,255,255,0.04))] shadow-[0_0_0_1px_rgba(251,146,60,0.08),0_0_32px_rgba(251,146,60,0.10)]'
          : rowTone === 'gold'
            ? 'border-amber-300/16 bg-[linear-gradient(90deg,rgba(255,211,109,0.10),rgba(255,255,255,0.03))]'
            : rowTone === 'danger'
              ? 'border-rose-300/16 bg-[linear-gradient(90deg,rgba(251,113,133,0.08),rgba(255,255,255,0.03))]'
              : rowTone === 'blue'
                ? 'border-cyan-300/14 bg-[linear-gradient(90deg,rgba(122,212,255,0.08),rgba(255,255,255,0.03))]'
                : 'border-white/12 bg-white/[0.06]'
      )}
    >
      {player.isMe ? <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(251,146,60,0.16),transparent_38%)] opacity-70" /> : null}

      <div className={cn('relative flex items-center', compact ? 'gap-3' : 'gap-4')}>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-2xl border font-black',
            compact ? 'h-10 w-10 text-base' : 'h-12 w-12 text-lg',
            index === 0
              ? 'border-orange-300/40 bg-orange-400/16 text-orange-200'
              : index === 1
                ? 'border-slate-300/20 bg-slate-300/10 text-slate-100'
                : index === 2
                  ? 'border-amber-500/30 bg-amber-400/10 text-amber-200'
                : 'border-white/12 bg-white/[0.08] text-white'
          )}
        >
          {player.rank}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn('truncate font-black text-white', compact ? 'text-[15px]' : 'text-base')}>{player.isMe ? '나' : formatMaskedName(player.displayNameSnapshot)}</p>
            {player.isMe ? (
              <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-2 py-1 text-[10px] font-black tracking-[0.18em] text-orange-200">
                YOU
              </span>
            ) : null}
            {index === 0 ? (
              <span className="leaderboard-crown-float inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-300/18 bg-amber-300/10 text-amber-100">
                <Crown className="h-3.5 w-3.5" />
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-[var(--text-on-dark-soft)]">{player.classNameSnapshot || '반 미지정'}</p>
          <div className="mt-3 leaderboard-race-track h-3 overflow-hidden rounded-full bg-white/8">
            <div
              className={cn(
                'leaderboard-race-fill relative h-full rounded-full transition-[width] ease-out',
                index === 0
                  ? 'bg-gradient-to-r from-[#FFD36D] to-[#FF9626]'
                  : player.isMe
                    ? 'bg-gradient-to-r from-[#FF9626] to-[#FFB347]'
                    : isThreatBelow
                      ? 'bg-gradient-to-r from-[#FB7185] to-[#FB923C]'
                      : 'bg-gradient-to-r from-[#4E7BFF] to-[#7AD4FF]'
              )}
              style={{ width: fillReady ? `${progress}%` : '0%', transitionDuration: '850ms' }}
            >
              {index === 0 ? (
                <span className="leaderboard-race-marker leaderboard-race-marker--first">
                  <Crown className="h-3.5 w-3.5" />
                </span>
              ) : null}
              {player.isMe ? (
                <span className="leaderboard-race-marker leaderboard-race-marker--me">
                  <Zap className="h-3.5 w-3.5" />
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className={cn('rounded-full border border-white/12 bg-white/[0.1] font-black text-white', compact ? 'px-2.5 py-1.5 text-[12px]' : 'px-3 py-2 text-sm')}>
            {formatHourValue(player.value)}
          </div>
        </div>
      </div>
    </div>
  );
}

function RecentRankEventsPanel({
  events,
  compact = false,
}: {
  events: RankLiveEvent[];
  compact?: boolean;
}) {
  return (
    <Panel>
      <div className={cn(compact ? 'p-4' : 'p-5')}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-3 py-1 text-[11px] font-black tracking-[0.18em] text-[var(--text-on-dark-soft)]">
              <Clock3 className="h-3.5 w-3.5 text-cyan-200" />
              RECENT RANK EVENTS
            </div>
            <h3 className="mt-4 text-xl font-black text-white">최근 변동</h3>
          </div>
          <span className="text-xs font-black tracking-[0.18em] text-[var(--text-on-dark-muted)]">LIVE LOG</span>
        </div>

        <div className="mt-5 space-y-3">
          {events.map((event) => {
            const tone = getToneClasses(event.tone);
            return (
              <div key={event.id} className="rounded-[22px] border border-white/12 bg-white/[0.08] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">{event.emoji} {event.title}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-on-dark-soft)]">{event.detail}</p>
                  </div>
                  <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black tracking-[0.18em]', tone.chip)}>
                    {event.timestampLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function RankEventToast({
  event,
  compact = false,
}: {
  event: RankLiveEvent;
  compact?: boolean;
}) {
  const tone = getToneClasses(event.tone);

  return (
    <div
      key={event.id}
      className={cn(
        'leaderboard-toast pointer-events-none fixed z-[60] min-w-[16rem] max-w-[20rem] rounded-[24px] border px-4 py-3 shadow-[0_24px_60px_-24px_rgba(2,6,23,0.7)] backdrop-blur-xl',
        tone.chip,
        event.tone === 'danger' ? 'leaderboard-toast--danger' : 'leaderboard-toast--positive',
        compact ? 'bottom-24 left-1/2 w-[calc(100%-2rem)] max-w-[21rem] -translate-x-1/2' : 'right-6 top-24'
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-current/20 bg-white/8 text-base">
          {event.emoji}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black text-white">{event.title}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--text-on-dark-soft)]">{event.detail}</p>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeMembership, viewMode } = useAppContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [toastIndex, setToastIndex] = useState(0);
  const activeRange = (searchParams.get('range') as RankRange) || 'daily';
  const isMobile = viewMode === 'mobile';

  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);
  const monthKey = useMemo(() => format(today, 'yyyy-MM'), [today]);
  const weekDateKeys = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(today, { weekStartsOn: 1 }), end: today }).map((date) => format(date, 'yyyy-MM-dd')),
    [today]
  );

  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'members'),
      where('role', '==', 'student'),
      where('status', '==', 'active')
    );
  }, [firestore, activeMembership?.id]);
  const { data: activeStudentMembers } = useCollection<CenterMembership>(membersQuery, { enabled: !!activeMembership });

  const activeStudentIds = useMemo(() => {
    if (!activeStudentMembers) return null;
    return new Set(activeStudentMembers.map((member) => member.id));
  }, [activeStudentMembers]);

  const memberMap = useMemo(() => {
    const map = new Map<string, { displayNameSnapshot: string; classNameSnapshot: string | null }>();
    activeStudentMembers?.forEach((member) => {
      map.set(member.id, {
        displayNameSnapshot: member.displayName || '학생',
        classNameSnapshot: member.className || null,
      });
    });
    return map;
  }, [activeStudentMembers]);

  const monthRankQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${monthKey}_study-time`, 'entries'),
      orderBy('value', 'desc'),
      limit(120)
    );
  }, [firestore, activeMembership?.id, monthKey]);
  const { data: monthEntriesRaw, isLoading: isMonthLoading } = useCollection<LeaderboardEntry>(monthRankQuery, { enabled: !!activeMembership });

  const dailyStatsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return collection(firestore, 'centers', activeMembership.id, 'dailyStudentStats', todayKey, 'students');
  }, [firestore, activeMembership?.id, todayKey]);
  const { data: dailyStatsRaw, isLoading: isDailyLoading } = useCollection<DailyStudentStat>(dailyStatsQuery, { enabled: !!activeMembership });

  const [weeklyRows, setWeeklyRows] = useState<Array<{ studentId: string; value: number }>>([]);
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false);

  useEffect(() => {
    if (!firestore || !activeMembership) {
      setWeeklyRows([]);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setIsWeeklyLoading(true);
      try {
        const snapshots = await Promise.all(
          weekDateKeys.map((dateKey) =>
            getDocs(collection(firestore, 'centers', activeMembership.id, 'dailyStudentStats', dateKey, 'students'))
          )
        );

        const totals = new Map<string, number>();
        snapshots.forEach((snapshot) => {
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as DailyStudentStat;
            const studentId = typeof data.studentId === 'string' ? data.studentId : docSnap.id;
            const minutes = Number(data.totalStudyMinutes || 0);
            if (!studentId || minutes <= 0) return;
            totals.set(studentId, (totals.get(studentId) || 0) + minutes);
          });
        });

        if (!cancelled) {
          setWeeklyRows(Array.from(totals.entries()).map(([studentId, value]) => ({ studentId, value })));
        }
      } finally {
        if (!cancelled) setIsWeeklyLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [firestore, activeMembership?.id, weekDateKeys]);

  const normalizeEntries = useMemo(() => {
    const shouldInclude = (studentId: string) => !isSyntheticStudentId(studentId) && (!activeStudentIds || activeStudentIds.has(studentId));

    const dailyEntries = applyCompetitionRanks(
      (dailyStatsRaw || [])
        .map((entry, index) => {
          const studentId = entry.studentId || `daily-${index}`;
          const profile = memberMap.get(studentId);
          return {
            id: studentId,
            studentId,
            displayNameSnapshot: profile?.displayNameSnapshot || '학생',
            classNameSnapshot: profile?.classNameSnapshot || null,
            value: Number(entry.totalStudyMinutes || 0),
          };
        })
        .filter((entry) => shouldInclude(entry.studentId) && entry.value > 0)
    );

    const weeklyEntries = applyCompetitionRanks(
      weeklyRows
        .map((entry) => {
          const profile = memberMap.get(entry.studentId);
          return {
            id: `weekly-${entry.studentId}`,
            studentId: entry.studentId,
            displayNameSnapshot: profile?.displayNameSnapshot || '학생',
            classNameSnapshot: profile?.classNameSnapshot || null,
            value: entry.value,
          };
        })
        .filter((entry) => shouldInclude(entry.studentId) && entry.value > 0)
    );

    const monthlyEntries = applyCompetitionRanks(
      (monthEntriesRaw || [])
        .map((entry) => {
          const studentId = entry.studentId;
          const profile = memberMap.get(studentId);
          return {
            id: entry.id || `monthly-${studentId}`,
            studentId,
            displayNameSnapshot: entry.displayNameSnapshot || profile?.displayNameSnapshot || '학생',
            classNameSnapshot: entry.classNameSnapshot || profile?.classNameSnapshot || null,
            value: Number(entry.value || 0),
          };
        })
        .filter((entry) => shouldInclude(entry.studentId) && entry.value > 0)
    );

    return {
      daily: dailyEntries,
      weekly: weeklyEntries,
      monthly: monthlyEntries,
    } as Record<RankRange, RankEntryView[]>;
  }, [activeStudentIds, dailyStatsRaw, memberMap, monthEntriesRaw, weeklyRows]);

  const currentEntries = normalizeEntries[activeRange];
  const hasMore = currentEntries.length > visibleCount;
  const isLoading = activeRange === 'daily'
    ? isDailyLoading
    : activeRange === 'weekly'
      ? isWeeklyLoading
      : isMonthLoading;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setTickerIndex(0);
    setToastIndex(0);
  }, [activeRange]);

  const rangeMeta = RANGE_META[activeRange];
  const meIndex = currentEntries.findIndex((entry) => entry.studentId === user?.uid);
  const myEntry = meIndex >= 0 ? currentEntries[meIndex] : null;
  const aboveEntry = meIndex > 0 ? currentEntries[meIndex - 1] : null;
  const belowEntry = meIndex >= 0 && meIndex < currentEntries.length - 1 ? currentEntries[meIndex + 1] : null;
  const maxMinutes = currentEntries[0]?.value || 0;
  const diffAbove = aboveEntry && myEntry ? aboveEntry.value - myEntry.value : 0;
  const diffBelow = belowEntry && myEntry ? myEntry.value - belowEntry.value : 0;
  const rewardGapMinutes = myEntry?.rank === 1 ? 0 : Math.max(0, diffAbove);
  const rewardProgress = myEntry
    ? myEntry.rank === 1
      ? 100
      : clampProgress((myEntry.value / Math.max(aboveEntry?.value || maxMinutes || 1, 1)) * 100)
    : 12;
  const hoursNeededToLead = Math.max(0, Math.ceil((rewardGapMinutes + 180) / 30) / 2);
  const liveSessionMinutes = myEntry ? 12 + (myEntry.value % 19) : 0;

  const primaryZone = getPrimaryZone(myEntry?.rank || 0, diffAbove);
  const defenseZone = getDefenseZone(myEntry?.rank || 0, diffBelow);

  const battleEvents = useMemo<RankLiveEvent[]>(() => {
    if (!currentEntries.length) {
      return [
        {
          id: 'empty',
          emoji: '📡',
          title: '아직 집계된 순위가 없어요',
          detail: '오늘 공부를 시작하면 실시간 경쟁 로그가 이곳에 표시돼요.',
          tone: 'blue',
          timestampLabel: '방금',
        },
      ];
    }

    const topEntry = currentEntries[0];
    const events: RankLiveEvent[] = [];

    if (myEntry) {
      events.push({
        id: 'my-live-push',
        emoji: '⚡',
        title: `${formatMaskedName(myEntry.displayNameSnapshot)} ${rangeMeta.label} ${formatHourValue(myEntry.value)} 기록`,
        detail: myEntry.rank === 1
          ? '현재 선두 유지 중'
          : `1위와 차이 ${formatGapLabel(diffAbove)}로 추월권 진입 중`,
        tone: 'orange',
        timestampLabel: '방금',
      });
    }

    if (aboveEntry && myEntry) {
      events.push({
        id: 'gap-to-first',
        emoji: '🔥',
        title: `1위와 차이 ${formatGapLabel(diffAbove)}`,
        detail: `오늘 ${Math.max(1, Math.ceil((diffAbove || 1) / 50))}세션 더 하면 역전 가능`,
        tone: diffAbove <= 60 ? 'gold' : 'orange',
        timestampLabel: '2분 전',
      });
    }

    if (belowEntry) {
      events.push({
        id: 'pressure-from-below',
        emoji: diffBelow <= 45 ? '⚠️' : '👀',
        title: `${formatMaskedName(belowEntry.displayNameSnapshot)} ${diffBelow <= 45 ? '추격 시작' : '순위 압박 중'}`,
        detail: `현재 ${formatGapLabel(diffBelow)} 차이`,
        tone: diffBelow <= 45 ? 'danger' : 'blue',
        timestampLabel: '4분 전',
      });
    }

    if (topEntry) {
      events.push({
        id: 'top-player',
        emoji: '🏆',
        title: `${formatMaskedName(topEntry.displayNameSnapshot)} ${rangeMeta.label} 1위 유지`,
        detail: `누적 ${formatHourValue(topEntry.value)} 기록`,
        tone: 'gold',
        timestampLabel: '6분 전',
      });
    }

    if (myEntry && myEntry.rank <= 3) {
      events.push({
        id: 'top-tier-lock',
        emoji: '🥈',
        title: `TOP ${myEntry.rank} 전장 유지 중`,
        detail: '지금 멈추지 않으면 상위권을 계속 압박할 수 있어요.',
        tone: 'orange',
        timestampLabel: '8분 전',
      });
    }

    return events;
  }, [currentEntries, diffAbove, diffBelow, myEntry, aboveEntry, belowEntry, rangeMeta.label]);

  const toastEvents = useMemo<RankLiveEvent[]>(() => {
    const events: RankLiveEvent[] = [];

    if (myEntry) {
      events.push({
        id: 'toast-rank-state',
        emoji: myEntry.rank === 1 ? '🏆' : myEntry.rank === 2 ? '🥈' : '⚡',
        title: myEntry.rank === 1 ? '1위 유지 중' : `${myEntry.rank}위 전장 유지 중`,
        detail: `${rangeMeta.label} 누적 ${formatHourValue(myEntry.value)}`,
        tone: myEntry.rank === 1 ? 'gold' : 'orange',
        timestampLabel: 'NOW',
      });
    }

    if (aboveEntry && myEntry) {
      events.push({
        id: 'toast-gap',
        emoji: '🔥',
        title: `1위와 차이 ${formatGapLabel(diffAbove)}`,
        detail: '오늘 1세션 더 하면 추월권이에요.',
        tone: diffAbove <= 60 ? 'gold' : 'orange',
        timestampLabel: 'LIVE',
      });
    }

    if (belowEntry) {
      events.push({
        id: 'toast-danger',
        emoji: diffBelow <= 45 ? '⚠️' : '👀',
        title: diffBelow <= 45 ? '뒤 순위 추격 시작' : '뒤 순위 견제 중',
        detail: `현재 ${formatGapLabel(diffBelow)} 차이`,
        tone: diffBelow <= 45 ? 'danger' : 'blue',
        timestampLabel: 'LIVE',
      });
    }

    if (rewardProgress >= 82) {
      events.push({
        id: 'toast-reward-close',
        emoji: '🎁',
        title: '보상 해금 임박',
        detail: `${formatGapLabel(rewardGapMinutes)} 남았어요.`,
        tone: rewardProgress >= 100 ? 'gold' : 'orange',
        timestampLabel: 'LIVE',
      });
    }

    return events;
  }, [aboveEntry, belowEntry, diffAbove, diffBelow, myEntry, rangeMeta.label, rewardGapMinutes, rewardProgress]);

  useEffect(() => {
    if (battleEvents.length <= 1) return;
    const timer = window.setInterval(() => {
      setTickerIndex((current) => (current + 1) % battleEvents.length);
    }, TICKER_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [battleEvents.length]);

  useEffect(() => {
    if (!toastEvents.length) return;
    const timer = window.setInterval(() => {
      setToastIndex((current) => (current + 1) % toastEvents.length);
    }, TOAST_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [toastEvents.length]);

  const visibleEntries = currentEntries
    .slice(0, visibleCount)
    .map((entry) => ({ ...entry, isMe: entry.studentId === user?.uid }));
  const activeTickerEvent = battleEvents[tickerIndex % battleEvents.length];
  const activeToastEvent = toastEvents[toastIndex % toastEvents.length];
  const recentEvents = battleEvents.slice(0, 4);

  if (!activeMembership) return null;

  return (
    <div className={cn('mx-auto w-full pb-20', isMobile ? 'max-w-none px-1.5' : 'max-w-7xl px-4')}>
      {activeToastEvent ? <RankEventToast event={activeToastEvent} compact={isMobile} /> : null}

      <div className={cn('rounded-[34px] border border-white/12 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.10),transparent_26%),radial-gradient(circle_at_top_left,rgba(56,189,248,0.10),transparent_24%),linear-gradient(180deg,#10285d_0%,#081838_100%)] shadow-[0_34px_100px_rgba(2,6,23,0.48)]', isMobile ? 'p-3.5' : 'p-4 sm:p-6 lg:p-8')}>
        <div className="flex flex-col gap-5 sm:gap-6">
          <div className={cn('flex flex-col gap-4', !isMobile && 'lg:flex-row lg:items-end lg:justify-between')}>
            <div className={cn('max-w-3xl', isMobile && 'max-w-none')}>
              <LiveBadge />
              <h1 className={cn('mt-4 font-black tracking-tight text-white', isMobile ? 'text-[2.4rem] leading-[0.95]' : 'text-3xl sm:text-5xl')}>공부시간 랭킹</h1>
              <p className={cn('mt-3 leading-6 text-[var(--text-on-dark-soft)]', isMobile ? 'max-w-[17rem] text-[14px]' : 'text-sm sm:text-base')}>
                일간, 주간, 월간 랭킹을 한 화면에서 경쟁처럼 확인하고, 지금 몇 시간 더 하면 추월 가능한지도 바로 볼 수 있어요.
              </p>
            </div>

            <div className={cn(isMobile ? 'grid w-full grid-cols-3 gap-2' : 'flex flex-wrap gap-2')}>
              {(['daily', 'weekly', 'monthly'] as RankRange[]).map((range) => (
                <RankPill
                  key={range}
                  label={RANGE_META[range].label}
                  active={activeRange === range}
                  onClick={() => router.replace(`/dashboard/leaderboards?range=${range}`, { scroll: false })}
                />
              ))}
            </div>
          </div>

          <div className={cn('grid gap-4', !isMobile && 'xl:grid-cols-[1.06fr_0.94fr]')}>
            <HeroBattleCard
              rankLabel={myEntry ? `#${myEntry.rank}` : '#-'}
              hoursLabel={myEntry ? formatHourValue(myEntry.value) : '기록 없음'}
              gapLabel={formatGapLabel(diffAbove)}
              liveMinutes={liveSessionMinutes}
              progressPercent={rewardProgress}
              rangeLabel={rangeMeta.label}
              isLeader={myEntry?.rank === 1}
              compact={isMobile}
            />

            <div className="flex flex-col gap-4">
              <div className={cn('grid gap-4', isMobile ? 'grid-cols-2' : 'sm:grid-cols-2')}>
                <TopSummaryCard
                  label="1위와의 차이"
                  value={myEntry?.rank === 1 ? 'LEAD' : formatGapLabel(diffAbove)}
                  sub={myEntry?.rank === 1 ? '현재 선두 방어 구간' : '오늘 1세션 더 하면 추월 가능'}
                  tone="orange"
                  icon={Zap}
                  compact={isMobile}
                />
                <TopSummaryCard
                  label="실시간 페이스"
                  value={myEntry ? `+${liveSessionMinutes}분` : 'READY'}
                  sub={myEntry ? '지금 세션이 순위를 끌어올리는 중' : '기록이 쌓이면 전장이 열려요'}
                  tone="blue"
                  icon={TimerReset}
                  compact={isMobile}
                />
              </div>

              <RewardGoalCard
                isLeader={myEntry?.rank === 1}
                progressPercent={rewardProgress}
                gapLabel={formatGapLabel(rewardGapMinutes)}
                compact={isMobile}
              />
            </div>
          </div>

          <LiveTickerBar event={activeTickerEvent} />

          <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'md:grid-cols-2')}>
            <ZoneCard zone={primaryZone} compact={isMobile} />
            <ZoneCard zone={defenseZone} compact={isMobile} />
          </div>

          <Panel className="overflow-hidden">
            <div className={cn('border-b border-white/12', isMobile ? 'px-4 py-4' : 'px-5 py-4 sm:px-6')}>
              <div className={cn('flex flex-col gap-3', !isMobile && 'sm:flex-row sm:items-center sm:justify-between')}>
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-3 py-1 text-[11px] font-black tracking-[0.18em] text-[var(--text-on-dark-soft)]">
                    <Crown className="h-3.5 w-3.5 text-orange-200" />
                    LEADERBOARD
                  </div>
                  <h2 className="mt-3 text-2xl font-black text-white">{rangeMeta.title}</h2>
                  <p className="mt-1 text-sm text-[var(--text-on-dark-soft)]">{rangeMeta.hint}</p>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-[var(--text-on-dark-soft)]">
                  <Users className="h-4 w-4" />
                  총 {currentEntries.length}명 참여 중
                </div>
              </div>
            </div>

            <div className={cn(isMobile ? 'p-4' : 'p-4 sm:p-6')}>
              {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-[var(--text-on-dark-muted)]" />
                </div>
              ) : currentEntries.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-white/15 bg-white/[0.05] px-6 py-16 text-center text-sm font-semibold text-[var(--text-on-dark-soft)]">
                  아직 표시할 랭킹이 없어요.
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {visibleEntries.map((player, index) => (
                      <LeaderboardRow
                        key={`${activeRange}-${player.id}`}
                        player={player}
                        maxMinutes={maxMinutes}
                        index={index}
                        compact={isMobile}
                        isTargetAbove={aboveEntry?.studentId === player.studentId}
                        isThreatBelow={belowEntry?.studentId === player.studentId}
                      />
                    ))}
                  </div>

                  {hasMore ? (
                    <div className="mt-5 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-5 py-3 text-sm font-black text-white transition hover:bg-white/[0.14]"
                      >
                        더 보기
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}

                  <div className={cn('mt-5 flex flex-col gap-3 rounded-[24px] border border-white/12 bg-white/[0.06] p-4', !isMobile && 'sm:flex-row sm:items-center sm:justify-between')}>
                    <div>
                      <p className="text-sm font-black text-white">지금 목표</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--text-on-dark-soft)]">
                        {myEntry?.rank === 1
                          ? '지금 페이스를 유지하면 선두를 지킬 수 있어요.'
                          : `오늘 ${hoursNeededToLead.toFixed(1)}시간만 더 공부하면 1위를 노릴 수 있어요.`}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:scale-[1.01]"
                    >
                      추월 전략 보기
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </Panel>

          <div className={cn('grid gap-4', !isMobile && 'xl:grid-cols-[0.94fr_1.06fr]')}>
            <RecentRankEventsPanel events={recentEvents} compact={isMobile} />

            <Panel className="bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]">
              <div className={cn(isMobile ? 'p-4' : 'p-5')}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-[11px] font-black tracking-[0.18em] text-orange-200">
                      <Swords className="h-3.5 w-3.5" />
                      OVERTAKE CTA
                    </div>
                    <h3 className="mt-4 text-xl font-black text-white">지금 전략을 적용할 시간</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-on-dark-soft)]">
                      {myEntry?.rank === 1
                        ? '방어 전략을 유지하면 선두를 끝까지 지킬 수 있어요.'
                        : `현재 ${formatGapLabel(rewardGapMinutes)} 차이예요. 저녁 1세션만 더 집중하면 전세를 뒤집을 수 있어요.`}
                    </p>
                  </div>
                  <div className="hidden h-14 w-14 items-center justify-center rounded-[20px] border border-white/12 bg-white/[0.1] text-orange-100 sm:flex">
                    <Flame className="h-6 w-6" />
                  </div>
                </div>

                <div className={cn('mt-5 grid gap-3', isMobile ? 'grid-cols-1' : 'md:grid-cols-3')}>
                  {[
                    ['추월까지', myEntry?.rank === 1 ? 'LEAD' : formatGapLabel(diffAbove)],
                    ['방어 간격', diffBelow > 0 ? formatGapLabel(diffBelow) : '신규'],
                    ['보상 진행', `${rewardProgress}%`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[20px] border border-white/12 bg-white/[0.08] px-3.5 py-3">
                      <p className="text-[10px] font-black tracking-[0.18em] text-[var(--text-on-dark-muted)]">{label}</p>
                      <p className="mt-2 text-lg font-black text-white">{value}</p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:scale-[1.01]"
                >
                  오늘 추월 전략 보기
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
