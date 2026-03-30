'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { eachDayOfInterval, format, startOfWeek } from 'date-fns';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import {
  ChevronRight,
  Crown,
  Flame,
  ShieldAlert,
  Sparkles,
  TimerReset,
  Trophy,
  Users,
  Zap,
  Loader2,
} from 'lucide-react';

import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { CenterMembership, DailyStudentStat, LeaderboardEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;

type RankRange = 'daily' | 'weekly' | 'monthly';

type RankEntryView = {
  id: string;
  studentId: string;
  displayNameSnapshot: string;
  classNameSnapshot: string | null;
  value: number;
  rank: number;
};

const RANGE_META: Record<RankRange, { label: string; title: string; hint: string; }> = {
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

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        'rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] shadow-[0_24px_80px_rgba(2,6,23,0.35)] backdrop-blur-xl',
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
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-65" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-400" />
      </span>
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
        'rounded-full px-4 py-2.5 text-sm font-black transition-all duration-200',
        active
          ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-slate-950 shadow-[0_8px_24px_rgba(251,146,60,0.35)]'
          : 'bg-white/6 text-white/72 hover:bg-white/10 hover:text-white'
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
  icon: typeof Trophy;
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
            <p className="text-[11px] font-black tracking-[0.18em] text-white/68">{label}</p>
            <p className={cn('mt-3 font-black tracking-tight text-white', compact ? 'text-[1.7rem] leading-none' : 'text-3xl')}>{value}</p>
            <p className={cn('mt-2 font-semibold text-white/68', compact ? 'text-[12px] leading-5' : 'text-sm')}>{sub}</p>
          </div>
          <div className={cn('rounded-2xl border border-white/10 bg-white/6 text-white/82', compact ? 'p-2.5' : 'p-3')}>
            <Icon className={cn(compact ? 'h-4 w-4' : 'h-5 w-5')} />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function RewardGoalCard({ compact = false }: { compact?: boolean }) {
  return (
    <Panel className="bg-gradient-to-br from-orange-500/16 via-amber-400/10 to-white/[0.03]">
      <div className={cn(compact ? 'p-4' : 'p-5 sm:p-6')}>
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-[11px] font-black tracking-[0.18em] text-orange-200">
          <Sparkles className="h-3.5 w-3.5" />
          RANK GOAL
        </div>
        <h3 className={cn('mt-4 font-black text-white', compact ? 'text-lg' : 'text-xl')}>1위 달성 시 +1000P</h3>
        <p className={cn('mt-2 leading-6 text-white/72', compact ? 'text-[13px]' : 'text-sm')}>
          일간 1등은 즉시 포인트를 받고, 월말 1~3등은 추가 보상으로 크게 앞서갈 수 있어요.
        </p>

        <div className={cn('mt-5 grid grid-cols-3 gap-2 text-center', compact && 'gap-1.5')}>
          {[
            ['1위', '20,000P'],
            ['2위', '10,000P'],
            ['3위', '5,000P'],
          ].map(([place, reward]) => (
            <div key={place} className={cn('rounded-2xl border border-white/10 bg-white/6', compact ? 'p-2.5' : 'p-3')}>
              <p className="text-[11px] font-black tracking-[0.18em] text-white/68">{place}</p>
              <p className={cn('mt-1 font-black text-white', compact ? 'text-[13px] leading-5' : 'text-sm')}>{reward}</p>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function CompetitionMessage({
  diffAbove,
  diffBelow,
  rank,
  compact = false,
}: {
  diffAbove: number;
  diffBelow: number;
  rank: number;
  compact?: boolean;
}) {
  const canOvertakeSoon = rank > 1 && diffAbove <= 180;
  const underThreat = rank > 0 && diffBelow > 0 && diffBelow <= 120;

  return (
    <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'md:grid-cols-2')}>
      <Panel className="border-orange-400/15 bg-[linear-gradient(180deg,rgba(251,146,60,0.11),rgba(255,255,255,0.02))]">
        <div className="p-5">
          <div className="flex items-center gap-2 text-orange-300">
            <Flame className="h-4 w-4" />
            <p className="text-[11px] font-black tracking-[0.18em]">추월 상태</p>
          </div>
          <p className="mt-3 text-lg font-black text-white">{rank === 1 ? '현재 선두 유지 중' : canOvertakeSoon ? '곧 1위 추월 가능' : '상위권 추격 중'}</p>
          <p className="mt-2 text-sm leading-6 text-white/72">
            {rank === 1 ? '지금 페이스만 유지해도 선두를 지킬 수 있어요.' : `1위까지 ${formatHourValue(diffAbove)} 차이. 오늘 한 세션만 더 집중하면 격차를 크게 줄일 수 있어요.`}
          </p>
        </div>
      </Panel>

      <Panel className="border-blue-400/15 bg-[linear-gradient(180deg,rgba(59,130,246,0.10),rgba(255,255,255,0.02))]">
        <div className="p-5">
          <div className="flex items-center gap-2 text-blue-300">
            <ShieldAlert className="h-4 w-4" />
            <p className="text-[11px] font-black tracking-[0.18em]">방어 상태</p>
          </div>
          <p className="mt-3 text-lg font-black text-white">{underThreat ? '뒤에서 바짝 추격 중' : '현재 순위 안정권'}</p>
          <p className="mt-2 text-sm leading-6 text-white/72">
            {diffBelow > 0 ? `${formatHourValue(diffBelow)} 차이로 뒤 순위를 앞서고 있어요. 오늘 기록을 멈추면 금방 좁혀질 수 있어요.` : '아직 아래 경쟁자가 보이지 않아요. 먼저 기록을 쌓아 우위를 만들어요.'}
          </p>
        </div>
      </Panel>
    </div>
  );
}

function LeaderboardRow({
  player,
  maxMinutes,
  index,
  compact = false,
}: {
  player: RankEntryView & { isMe: boolean };
  maxMinutes: number;
  index: number;
  compact?: boolean;
}) {
  const [fillReady, setFillReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setFillReady(true), 40 + index * 35);
    return () => window.clearTimeout(timer);
  }, [index, player.id]);

  const progress = maxMinutes > 0 ? Math.max(12, Math.round((player.value / maxMinutes) * 100)) : 0;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[24px] border transition-transform duration-200 hover:-translate-y-0.5',
        compact ? 'p-3.5' : 'p-4 sm:p-5',
        player.isMe
          ? 'border-orange-400/25 bg-[linear-gradient(90deg,rgba(251,146,60,0.12),rgba(255,255,255,0.04))] shadow-[0_0_0_1px_rgba(251,146,60,0.08),0_0_32px_rgba(251,146,60,0.10)]'
          : 'border-white/10 bg-white/[0.03]'
      )}
    >
      {player.isMe ? (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(251,146,60,0.16),transparent_38%)] opacity-70" />
      ) : null}

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
                  : 'border-white/10 bg-white/5 text-white/78'
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
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-white/68">{player.classNameSnapshot || '반 미지정'}</p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/8">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-700 ease-out',
                index === 0
                  ? 'bg-gradient-to-r from-[#FFD36D] to-[#FF9626]'
                  : player.isMe
                    ? 'bg-gradient-to-r from-[#FF9626] to-[#FFB347]'
                    : 'bg-gradient-to-r from-[#4E7BFF] to-[#7AD4FF]'
              )}
              style={{ width: fillReady ? `${progress}%` : '0%' }}
            />
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className={cn('rounded-full border border-white/10 bg-white/5 font-black text-white', compact ? 'px-2.5 py-1.5 text-[12px]' : 'px-3 py-2 text-sm')}>
            {formatHourValue(player.value)}
          </div>
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

  const myRanks = useMemo(() => {
    const findEntry = (entries: RankEntryView[]) => entries.find((entry) => entry.studentId === user?.uid) || null;
    return {
      daily: findEntry(normalizeEntries.daily),
      weekly: findEntry(normalizeEntries.weekly),
      monthly: findEntry(normalizeEntries.monthly),
    };
  }, [normalizeEntries, user?.uid]);

  const isLoading = activeRange === 'daily'
    ? isDailyLoading
    : activeRange === 'weekly'
      ? isWeeklyLoading
      : isMonthLoading;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeRange]);

  if (!activeMembership) return null;

  const rangeMeta = RANGE_META[activeRange];
  const meIndex = currentEntries.findIndex((entry) => entry.studentId === user?.uid);
  const myEntry = meIndex >= 0 ? currentEntries[meIndex] : null;
  const aboveEntry = meIndex > 0 ? currentEntries[meIndex - 1] : null;
  const belowEntry = meIndex >= 0 && meIndex < currentEntries.length - 1 ? currentEntries[meIndex + 1] : null;
  const maxMinutes = currentEntries[0]?.value || 0;
  const diffAbove = aboveEntry && myEntry ? aboveEntry.value - myEntry.value : 0;
  const diffBelow = belowEntry && myEntry ? myEntry.value - belowEntry.value : 0;
  const hoursNeededToLead = Math.max(0, Math.ceil(((diffAbove || 0) + 180) / 30) / 2);
  const visibleEntries = currentEntries
    .slice(0, visibleCount)
    .map((entry) => ({ ...entry, isMe: entry.studentId === user?.uid }));

  return (
    <div className={cn('mx-auto w-full pb-20', isMobile ? 'max-w-none px-1.5' : 'max-w-7xl px-4')}>
      <div className={cn('rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.10),transparent_26%),radial-gradient(circle_at_top_left,rgba(56,189,248,0.10),transparent_24%),linear-gradient(180deg,#10285d_0%,#081838_100%)] shadow-[0_34px_100px_rgba(2,6,23,0.48)]', isMobile ? 'p-3.5' : 'p-4 sm:p-6 lg:p-8')}>
        <div className="flex flex-col gap-5 sm:gap-6">
          <div className={cn('flex flex-col gap-4', !isMobile && 'lg:flex-row lg:items-end lg:justify-between')}>
            <div className={cn('max-w-3xl', isMobile && 'max-w-none')}>
              <LiveBadge />
              <h1 className={cn('mt-4 font-black tracking-tight text-white', isMobile ? 'text-[2.4rem] leading-[0.95]' : 'text-3xl sm:text-5xl')}>공부시간 랭킹</h1>
              <p className={cn('mt-3 leading-6 text-white/72', isMobile ? 'max-w-[17rem] text-[14px]' : 'text-sm sm:text-base')}>
                일간, 주간, 월간 랭킹을 한 화면에서 경쟁처럼 확인하고, 지금 몇 시간 더 하면 추월 가능한지도 바로 볼 수 있어요.
              </p>
            </div>

            <div className={cn(isMobile ? 'grid w-full grid-cols-3 gap-2' : 'flex flex-wrap gap-2')}>
              {(['daily', 'weekly', 'monthly'] as RankRange[]).map((range) => (
                <RankPill
                  key={range}
                  label={RANGE_META[range].label}
                  active={activeRange === range}
                  onClick={() => router.replace(`/dashboard/leaderboards?range=${range}`)}
                />
              ))}
            </div>
          </div>

          <div className={cn('grid gap-4', !isMobile && 'xl:grid-cols-[1.15fr_0.85fr]')}>
            <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'md:grid-cols-3 gap-4')}>
              <TopSummaryCard
                label="내 현재 순위"
                value={myEntry ? `#${myEntry.rank}` : '집계중'}
                sub={myEntry ? `${rangeMeta.label} 누적 ${formatHourValue(myEntry.value)}` : '아직 기록이 없어요'}
                tone="orange"
                icon={Trophy}
                compact={isMobile}
              />
              <TopSummaryCard
                label="1위와의 차이"
                value={myEntry?.rank === 1 ? '선두' : formatHourValue(diffAbove)}
                sub={myEntry?.rank === 1 ? '현재 선두 유지 중' : '지금 집중하면 추월 가능'}
                tone="blue"
                icon={Zap}
                compact={isMobile}
              />
              <TopSummaryCard
                label="업데이트 상태"
                value="LIVE"
                sub="마지막 업데이트: 방금 전"
                icon={TimerReset}
                compact={isMobile}
              />
            </div>

            <div className={cn(isMobile && 'col-span-full')}>
              <RewardGoalCard compact={isMobile} />
            </div>
          </div>

          <CompetitionMessage diffAbove={diffAbove} diffBelow={diffBelow} rank={myEntry?.rank || 0} compact={isMobile} />

          <Panel className="overflow-hidden">
            <div className={cn('border-b border-white/10', isMobile ? 'px-4 py-4' : 'px-5 py-4 sm:px-6')}>
              <div className={cn('flex flex-col gap-3', !isMobile && 'sm:flex-row sm:items-center sm:justify-between')}>
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black tracking-[0.18em] text-white/70">
                    <Crown className="h-3.5 w-3.5" />
                    LEADERBOARD
                  </div>
                  <h2 className="mt-3 text-2xl font-black text-white">{rangeMeta.title}</h2>
                  <p className="mt-1 text-sm text-white/62">{rangeMeta.hint}</p>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/62">
                  <Users className="h-4 w-4" />
                  총 {currentEntries.length}명 참여 중
                </div>
              </div>
            </div>

            <div className={cn(isMobile ? 'p-4' : 'p-4 sm:p-6')}>
              {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-white/30" />
                </div>
              ) : currentEntries.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center text-sm font-semibold text-white/58">
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
                      />
                    ))}
                  </div>

                  {hasMore ? (
                    <div className="mt-5 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
                      >
                        더 보기
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}

                  <div className={cn('mt-5 flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4', !isMobile && 'sm:flex-row sm:items-center sm:justify-between')}>
                    <div>
                      <p className="text-sm font-black text-white">지금 목표</p>
                      <p className="mt-1 text-sm leading-6 text-white/70">
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
        </div>
      </div>
    </div>
  );
}
