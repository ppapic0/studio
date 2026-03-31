'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

import { useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import {
  EMPTY_STUDENT_RANKING_SNAPSHOT,
  fetchStudentRankingSnapshot,
  type StudentRankingSnapshot,
} from '@/lib/student-ranking-client';
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
        chip: 'border-[#F0C86E] bg-[#FFF4D5] text-[#9B5A0A]',
        line: 'from-[#FFD36D]/85 via-[#FFB347]/60 to-transparent',
        text: 'text-[#9B5A0A]',
      };
    case 'blue':
      return {
        chip: 'border-[#F0D8BF] bg-[#FFF7ED] text-[#A05E17]',
        line: 'from-[#FFD4A6]/85 via-[#FFF1DE]/70 to-transparent',
        text: 'text-[#A05E17]',
      };
    case 'danger':
      return {
        chip: 'border-[#F6B4B4] bg-[#FFF1F1] text-[#B45353]',
        line: 'from-[#FFC4AE]/85 via-[#FFD5C7]/62 to-transparent',
        text: 'text-[#B45353]',
      };
    default:
      return {
        chip: 'border-[#FFCC9A] bg-[#FFF1E0] text-[#C86A10]',
        line: 'from-[#FFB761]/85 via-[#FFD29A]/70 to-transparent',
        text: 'text-[#C86A10]',
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
        'rounded-[28px] border border-[#F1D8BF] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF8F1_100%)] shadow-[0_22px_60px_rgba(196,99,16,0.12)] backdrop-blur-xl',
        className
      )}
    >
      {children}
    </section>
  );
}

function LiveBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#FFCC9A] bg-[#FFF1E0] px-3 py-1.5 text-[11px] font-black tracking-[0.18em] text-[#C86A10]">
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
          ? 'border-[#FF9A3D] bg-gradient-to-r from-[#FF9626] to-[#FFB347] text-white shadow-[0_10px_26px_rgba(251,146,60,0.28)]'
          : 'border-[#F1D4B4] bg-white text-[#A8651B] hover:bg-[#FFF6EC] hover:text-[#8C4F11]'
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
    ? 'from-[#FFF0DE] via-[#FFF7ED] to-white'
    : tone === 'blue'
      ? 'from-[#FFF6EC] via-[#FFF9F2] to-white'
      : 'from-white to-[#FFF9F4]';

  return (
    <Panel className={cn('bg-gradient-to-br', toneClass)}>
      <div className={cn(compact ? 'p-4' : 'p-5')}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black tracking-[0.18em] text-[#A3641B]">{label}</p>
            <p className={cn('mt-3 font-black tracking-tight text-[var(--text-primary)]', compact ? 'text-[1.7rem] leading-none' : 'text-3xl')}>{value}</p>
            <p className={cn('mt-2 font-semibold text-[var(--text-secondary)]', compact ? 'text-[12px] leading-5' : 'text-sm')}>{sub}</p>
          </div>
          <div className={cn('rounded-2xl border border-[#F2D7BF] bg-[#FFF5EA] text-[#C86A10]', compact ? 'p-2.5' : 'p-3')}>
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
    <Panel className="leaderboard-live-glow overflow-hidden border-[#FFD2A8] bg-[radial-gradient(circle_at_top_right,rgba(255,150,38,0.24),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(255,211,109,0.18),transparent_22%),linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_72%)]">
      <div className={cn(compact ? 'p-4' : 'p-6 sm:p-7')}>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#F2D7BF] bg-white/90 px-3 py-1 text-[11px] font-black tracking-[0.18em] text-[#A76A25]">
                <Swords className="h-3.5 w-3.5 text-[#FF9626]" />
                MY BATTLE STATUS
              </div>
              <div>
                <p className="text-[11px] font-black tracking-[0.2em] text-[#B57633]">{rangeLabel} LIVE TRACK</p>
                <div className={cn('mt-3 flex items-end gap-3', compact ? 'flex-wrap' : 'flex-nowrap')}>
                  <span className={cn('font-black tracking-tight text-[var(--text-primary)]', compact ? 'text-[3rem] leading-[0.9]' : 'text-[4rem] leading-[0.86]')}>
                    {rankLabel}
                  </span>
                  <span className={cn('font-black text-[#A8651B]', compact ? 'pb-1 text-lg' : 'pb-2 text-2xl')}>
                    {hoursLabel}
                  </span>
                </div>
                <p className={cn('mt-3 max-w-xl font-semibold text-[var(--text-secondary)]', compact ? 'text-[13px] leading-5' : 'text-sm leading-6')}>
                  {isLeader ? '현재 선두 유지 중이에요. 지금 페이스를 유지하면 방어 성공 확률이 높아요.' : `1위까지 ${gapLabel}. 오늘 한 세션만 더 밀어붙이면 추월권이에요.`}
                </p>
              </div>
            </div>

            <div className="rounded-[22px] border border-[#F2D7BF] bg-white/82 px-4 py-3 text-right shadow-[0_18px_38px_-28px_rgba(196,99,16,0.22)]">
              <div className="mb-1 flex items-center justify-end gap-2">
                <span className="leaderboard-live-dot relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-400" />
                <span className="text-[11px] font-black tracking-[0.18em] text-[#B57633]">LIVE PUSH</span>
              </div>
              <p className={cn('font-black text-[var(--text-primary)]', compact ? 'text-sm' : 'text-base')}>{isLeader ? '선두 방어 중' : `공부중 +${liveMinutes}분`}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              ['누적 공부', hoursLabel],
              ['1위와 차이', isLeader ? 'LEAD' : gapLabel],
              ['보상 진행', `${progressPercent}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[22px] border border-[#F2D7BF] bg-white/82 px-3.5 py-3">
                <p className="text-[10px] font-black tracking-[0.18em] text-[#B57633]">{label}</p>
                <p className={cn('mt-2 font-black text-[var(--text-primary)]', compact ? 'text-lg' : 'text-xl')}>{value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2.5 rounded-[24px] border border-[#F2D7BF] bg-[#FFF5EA] px-4 py-3">
            <div className="flex items-center justify-between text-[11px] font-black tracking-[0.18em]">
              <span className="text-[#A76A25]">OVERTAKE METER</span>
              <span className="text-[#C86A10]">{progressPercent}% READY</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#FFE6CF]">
              <div
                className="leaderboard-race-fill relative h-full rounded-full bg-gradient-to-r from-[#FF9626] via-[#FFB347] to-[#FFD36D]"
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
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#F2D7BF] bg-[#FFF7ED] text-lg">
              {event.emoji}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[var(--text-primary)]">{event.title}</p>
              <p className="truncate text-xs font-semibold text-[var(--text-secondary)]">{event.detail}</p>
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
      zone.tone === 'danger' && 'border-[#F6B4B4] bg-[linear-gradient(180deg,#FFF4F4,#FFFFFF)]',
      zone.tone === 'gold' && 'border-[#F0C86E] bg-[linear-gradient(180deg,#FFF7E3,#FFFFFF)]',
      zone.tone === 'orange' && 'border-[#FFCC9A] bg-[linear-gradient(180deg,#FFF2E3,#FFFFFF)]',
      zone.tone === 'blue' && 'border-[#F0D8BF] bg-[linear-gradient(180deg,#FFF8EF,#FFFFFF)]'
    )}>
      <div className={cn(compact ? 'p-4' : 'p-5')}>
        <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black tracking-[0.18em]', tone.chip)}>
          <Icon className="h-3.5 w-3.5" />
          {zone.kicker}
        </div>
        <p className="mt-4 text-lg font-black text-[var(--text-primary)]">{zone.title}</p>
        <p className={cn('mt-2 font-semibold text-[var(--text-secondary)]', compact ? 'text-[13px] leading-5' : 'text-sm leading-6')}>{zone.body}</p>
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
      'leaderboard-reward-card border-[#FFD2A8] bg-gradient-to-br from-[#FFF0DE] via-[#FFF7ED] to-white',
      nearUnlock && 'leaderboard-reward-card--near'
    )}>
      <div className={cn(compact ? 'p-4' : 'p-5 sm:p-6')}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FFCC9A] bg-[#FFF1E0] px-3 py-1 text-[11px] font-black tracking-[0.18em] text-[#C86A10]">
              <Sparkles className="h-3.5 w-3.5" />
              NEXT REWARD
            </div>
            <h3 className={cn('mt-4 font-black text-[var(--text-primary)]', compact ? 'text-lg' : 'text-xl')}>1위 달성 시 +1000P</h3>
            <p className={cn('mt-2 text-[var(--text-secondary)]', compact ? 'text-[13px] leading-5' : 'text-sm leading-6')}>
              {isLeader ? '보상 해금권에 도달했어요. 지금 선두를 지키면 즉시 포인트를 받을 수 있어요.' : `보상 상자까지 ${gapLabel} 남음. 지금 밀어붙이면 보상 해금이 가까워져요.`}
            </p>
          </div>
          <div className="leaderboard-reward-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-[#FFD3A8] bg-white text-[#FF9626] shadow-[0_18px_42px_-24px_rgba(251,146,60,0.38)]">
            <Gift className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-5 rounded-[22px] border border-[#F2D7BF] bg-white p-4">
          <div className="mb-2 flex items-center justify-between text-sm font-black">
            <span className="text-[var(--text-secondary)]">보상 진행도</span>
            <span className="text-[#C86A10]">{progressPercent}%</span>
          </div>
          <div className="leaderboard-reward-progress h-3 overflow-hidden rounded-full bg-[#FFE6CF]">
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
            <div key={place} className={cn('rounded-2xl border border-[#F2D7BF] bg-white', compact ? 'p-2.5' : 'p-3')}>
              <p className="text-[11px] font-black tracking-[0.18em] text-[#A76A25]">{place}</p>
              <p className={cn('mt-1 font-black text-[var(--text-primary)]', compact ? 'text-[13px] leading-5' : 'text-sm')}>{reward}</p>
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
          ? 'leaderboard-my-row border-[#FFB768] bg-[linear-gradient(90deg,#FFF2E1,white)] shadow-[0_0_0_1px_rgba(251,146,60,0.08),0_0_32px_rgba(251,146,60,0.10)]'
          : rowTone === 'gold'
            ? 'border-[#F0C86E] bg-[linear-gradient(90deg,#FFF7E3,white)]'
            : rowTone === 'danger'
              ? 'border-[#F6B4B4] bg-[linear-gradient(90deg,#FFF4F4,white)]'
              : rowTone === 'blue'
                ? 'border-[#F0D8BF] bg-[linear-gradient(90deg,#FFF8EF,white)]'
                : 'border-[#EED8C3] bg-white'
      )}
    >
      {player.isMe ? <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(251,146,60,0.16),transparent_38%)] opacity-70" /> : null}

      <div className={cn('relative flex items-center', compact ? 'gap-3' : 'gap-4')}>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-2xl border font-black',
            compact ? 'h-10 w-10 text-base' : 'h-12 w-12 text-lg',
            index === 0
              ? 'border-[#FFB768] bg-[#FFF1E0] text-[#C86A10]'
              : index === 1
                ? 'border-[#E9D8C3] bg-[#FFF8F1] text-[#9B6A36]'
                : index === 2
                  ? 'border-[#F0C86E] bg-[#FFF6DA] text-[#A05B0F]'
                : 'border-[#EED8C3] bg-[#FFF9F4] text-[var(--text-primary)]'
          )}
        >
          {player.rank}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn('truncate font-black text-[var(--text-primary)]', compact ? 'text-[15px]' : 'text-base')}>{player.isMe ? '나' : formatMaskedName(player.displayNameSnapshot)}</p>
            {player.isMe ? (
              <span className="rounded-full border border-[#FFCC9A] bg-[#FFF1E0] px-2 py-1 text-[10px] font-black tracking-[0.18em] text-[#C86A10]">
                YOU
              </span>
            ) : null}
            {index === 0 ? (
              <span className="leaderboard-crown-float inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#F0C86E] bg-[#FFF6DA] text-[#A05B0F]">
                <Crown className="h-3.5 w-3.5" />
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-[var(--text-secondary)]">{player.classNameSnapshot || '반 미지정'}</p>
          <div className="mt-3 leaderboard-race-track h-3 overflow-hidden rounded-full bg-[#FFE8D0]">
            <div
              className={cn(
                'leaderboard-race-fill relative h-full rounded-full transition-[width] ease-out',
                index === 0
                  ? 'bg-gradient-to-r from-[#FFD36D] to-[#FF9626]'
                  : player.isMe
                    ? 'bg-gradient-to-r from-[#FF9626] to-[#FFB347]'
                    : isThreatBelow
                      ? 'bg-gradient-to-r from-[#FB7185] to-[#FB923C]'
                      : 'bg-gradient-to-r from-[#FFB761] to-[#FFD7A8]'
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
          <div className={cn('rounded-full border border-[#F0D8BF] bg-[#FFF6EC] font-black text-[var(--text-primary)]', compact ? 'px-2.5 py-1.5 text-[12px]' : 'px-3 py-2 text-sm')}>
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
            <div className="inline-flex items-center gap-2 rounded-full border border-[#F2D7BF] bg-[#FFF5EA] px-3 py-1 text-[11px] font-black tracking-[0.18em] text-[#A76A25]">
              <Clock3 className="h-3.5 w-3.5 text-[#FF9626]" />
              RECENT RANK EVENTS
            </div>
            <h3 className="mt-4 text-xl font-black text-[var(--text-primary)]">최근 변동</h3>
          </div>
          <span className="text-xs font-black tracking-[0.18em] text-[#B57633]">LIVE LOG</span>
        </div>

        <div className="mt-5 space-y-3">
          {events.map((event) => {
            const tone = getToneClasses(event.tone);
            return (
              <div key={event.id} className="rounded-[22px] border border-[#F1D8BF] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[var(--text-primary)]">{event.emoji} {event.title}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-secondary)]">{event.detail}</p>
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
        'leaderboard-toast pointer-events-none fixed z-[60] min-w-[16rem] max-w-[20rem] rounded-[24px] border bg-white/96 px-4 py-3 shadow-[0_24px_60px_-24px_rgba(196,99,16,0.22)] backdrop-blur-xl',
        tone.chip,
        event.tone === 'danger' ? 'leaderboard-toast--danger' : 'leaderboard-toast--positive',
        compact ? 'bottom-24 left-1/2 w-[calc(100%-2rem)] max-w-[21rem] -translate-x-1/2' : 'right-6 top-24'
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-current/20 bg-[#FFF6EC] text-base">
          {event.emoji}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black text-[var(--text-primary)]">{event.title}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">{event.detail}</p>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardsPage() {
  const { user } = useUser();
  const { activeMembership, viewMode } = useAppContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [toastIndex, setToastIndex] = useState(0);
  const [rankSnapshot, setRankSnapshot] = useState<StudentRankingSnapshot>(EMPTY_STUDENT_RANKING_SNAPSHOT);
  const [rankSnapshotLoading, setRankSnapshotLoading] = useState(false);
  const activeRange = (searchParams.get('range') as RankRange) || 'daily';
  const isMobile = viewMode === 'mobile';

  useEffect(() => {
    if (!user || !activeMembership) {
      setRankSnapshot(EMPTY_STUDENT_RANKING_SNAPSHOT);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setRankSnapshotLoading(true);
      try {
        const nextSnapshot = await fetchStudentRankingSnapshot({
          centerId: activeMembership.id,
          user,
        });
        if (!cancelled) {
          setRankSnapshot(nextSnapshot);
        }
      } catch {
        if (!cancelled) {
          setRankSnapshot(EMPTY_STUDENT_RANKING_SNAPSHOT);
        }
      } finally {
        if (!cancelled) setRankSnapshotLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [activeMembership?.id, user]);

  const currentEntries = rankSnapshot[activeRange];
  const hasMore = currentEntries.length > visibleCount;
  const isLoading = rankSnapshotLoading;

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

      <div className={cn('rounded-[34px] border border-[#F1D8BF] bg-[radial-gradient(circle_at_top_right,rgba(255,150,38,0.18),transparent_26%),radial-gradient(circle_at_top_left,rgba(255,211,109,0.16),transparent_24%),linear-gradient(180deg,#FFFFFF_0%,#FFF8F1_100%)] shadow-[0_34px_100px_rgba(196,99,16,0.12)]', isMobile ? 'p-3.5' : 'p-4 sm:p-6 lg:p-8')}>
        <div className="flex flex-col gap-5 sm:gap-6">
          <div className={cn('flex flex-col gap-4', !isMobile && 'lg:flex-row lg:items-end lg:justify-between')}>
            <div className={cn('max-w-3xl', isMobile && 'max-w-none')}>
              <LiveBadge />
              <h1 className={cn('mt-4 font-black tracking-tight text-[var(--text-primary)]', isMobile ? 'text-[2.4rem] leading-[0.95]' : 'text-3xl sm:text-5xl')}>공부시간 랭킹</h1>
              <p className={cn('mt-3 leading-6 text-[var(--text-secondary)]', isMobile ? 'max-w-[17rem] text-[14px]' : 'text-sm sm:text-base')}>
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
            <div className={cn('border-b border-[#F1D8BF]', isMobile ? 'px-4 py-4' : 'px-5 py-4 sm:px-6')}>
              <div className={cn('flex flex-col gap-3', !isMobile && 'sm:flex-row sm:items-center sm:justify-between')}>
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#F2D7BF] bg-[#FFF5EA] px-3 py-1 text-[11px] font-black tracking-[0.18em] text-[#A76A25]">
                    <Crown className="h-3.5 w-3.5 text-[#FF9626]" />
                    LEADERBOARD
                  </div>
                  <h2 className="mt-3 text-2xl font-black text-[var(--text-primary)]">{rangeMeta.title}</h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{rangeMeta.hint}</p>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-[#F2D7BF] bg-white px-4 py-2 text-sm font-semibold text-[var(--text-secondary)]">
                  <Users className="h-4 w-4" />
                  총 {currentEntries.length}명 참여 중
                </div>
              </div>
            </div>

            <div className={cn(isMobile ? 'p-4' : 'p-4 sm:p-6')}>
              {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-[#C86A10]" />
                </div>
              ) : currentEntries.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[#F1D8BF] bg-[#FFF9F4] px-6 py-16 text-center text-sm font-semibold text-[var(--text-secondary)]">
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
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-[#F2D7BF] bg-white px-5 py-3 text-sm font-black text-[var(--text-primary)] transition hover:bg-[#FFF6EC]"
                      >
                        더 보기
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}

                  <div className={cn('mt-5 flex flex-col gap-3 rounded-[24px] border border-[#FFD2A8] bg-[linear-gradient(180deg,#FFF4E7_0%,#FFFFFF_100%)] p-4', !isMobile && 'sm:flex-row sm:items-center sm:justify-between')}>
                    <div>
                      <p className="text-sm font-black text-[var(--text-primary)]">지금 목표</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
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

            <Panel className="border-[#FFD2A8] bg-[linear-gradient(180deg,#FFF2E3_0%,#FFFFFF_100%)]">
              <div className={cn(isMobile ? 'p-4' : 'p-5')}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#FFCC9A] bg-[#FFF1E0] px-3 py-1 text-[11px] font-black tracking-[0.18em] text-[#C86A10]">
                      <Swords className="h-3.5 w-3.5" />
                      OVERTAKE CTA
                    </div>
                    <h3 className="mt-4 text-xl font-black text-[var(--text-primary)]">지금 전략을 적용할 시간</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                      {myEntry?.rank === 1
                        ? '방어 전략을 유지하면 선두를 끝까지 지킬 수 있어요.'
                        : `현재 ${formatGapLabel(rewardGapMinutes)} 차이예요. 저녁 1세션만 더 집중하면 전세를 뒤집을 수 있어요.`}
                    </p>
                  </div>
                  <div className="hidden h-14 w-14 items-center justify-center rounded-[20px] border border-[#FFD3A8] bg-white text-[#FF9626] sm:flex">
                    <Flame className="h-6 w-6" />
                  </div>
                </div>

                <div className={cn('mt-5 grid gap-3', isMobile ? 'grid-cols-1' : 'md:grid-cols-3')}>
                  {[
                    ['추월까지', myEntry?.rank === 1 ? 'LEAD' : formatGapLabel(diffAbove)],
                    ['방어 간격', diffBelow > 0 ? formatGapLabel(diffBelow) : '신규'],
                    ['보상 진행', `${rewardProgress}%`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[20px] border border-[#F2D7BF] bg-white px-3.5 py-3">
                      <p className="text-[10px] font-black tracking-[0.18em] text-[#A76A25]">{label}</p>
                      <p className="mt-2 text-lg font-black text-[var(--text-primary)]">{value}</p>
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
