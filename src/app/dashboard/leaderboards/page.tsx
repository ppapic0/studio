'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { eachDayOfInterval, format, startOfMonth, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useRouter, useSearchParams } from 'next/navigation';
import { CenterMembership, DailyStudentStat, LeaderboardEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Trophy, Medal, Crown, ChevronRight, Clock3, Sparkles, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatStudyMinutes } from '@/lib/student-rewards';

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
    title: '오늘 공부 랭킹',
    hint: '오늘 누적 공부시간 기준',
  },
  weekly: {
    label: '주간',
    title: '이번 주 공부 랭킹',
    hint: '이번 주 누적 공부시간 기준',
  },
  monthly: {
    label: '월간',
    title: '이번 달 공부 랭킹',
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

function SummaryRankCard({
  label,
  rank,
  value,
  active,
  onClick,
}: {
  label: string;
  rank: number;
  value: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-[1.45rem] border p-4 text-left transition-all',
        active
          ? 'border-[#FFB357]/45 bg-[linear-gradient(135deg,#173A82_0%,#234B9A_100%)] text-white shadow-[0_22px_44px_-30px_rgba(23,58,130,0.55)]'
          : 'border-slate-100 bg-white text-[#173A82] shadow-[0_16px_38px_-32px_rgba(15,23,42,0.26)] hover:-translate-y-0.5'
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn('text-[10px] font-black tracking-[0.18em]', active ? 'text-white/62' : 'text-[#173A82]/45')}>
          {label}
        </span>
        <Clock3 className={cn('h-4 w-4', active ? 'text-[#FFD089]' : 'text-[#173A82]/45')} />
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight">{rank > 0 ? `#${rank}` : '집계중'}</p>
      <p className={cn('mt-1 text-xs font-semibold', active ? 'text-white/72' : 'text-[#173A82]/58')}>
        {value > 0 ? formatStudyMinutes(value) : '아직 기록이 없어요'}
      </p>
    </button>
  );
}

export default function LeaderboardsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeMembership, viewMode } = useAppContext();
  const isMobile = viewMode === 'mobile';
  const router = useRouter();
  const searchParams = useSearchParams();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const activeRange = (searchParams.get('range') as RankRange) || 'daily';
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
        .map((entry: any) => {
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
  const topThree = currentEntries.slice(0, 3);
  const restEntries = currentEntries.slice(3, visibleCount);
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

  return (
    <div className={cn('mx-auto flex w-full max-w-6xl flex-col pb-20', isMobile ? 'gap-5 px-1' : 'gap-8 px-4')}>
      <header className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#14295F]/10 bg-[#14295F]/5 px-4 py-1.5 shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-[#14295F]" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#14295F]/70">study time leaderboard</span>
        </div>
        <div className="space-y-2">
          <h1 className={cn('font-black tracking-tighter text-primary', isMobile ? 'text-3xl' : 'text-5xl')}>공부시간 랭킹</h1>
          <p className={cn('mx-auto font-semibold text-slate-600', isMobile ? 'max-w-xs text-sm leading-6' : 'max-w-3xl text-lg leading-8')}>
            일간, 주간, 월간 공부시간 순위를 한 번에 확인해요. 일간 1등은 +1000P, 월말 1~3등은 추가 포인트 보상을 받아요.
          </p>
        </div>
      </header>

      <section className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-[1.15fr_0.85fr]')}>
        <Card className="rounded-[2rem] border-none bg-[linear-gradient(135deg,#14295F_0%,#1B326D_55%,#234A99_100%)] text-white shadow-[0_36px_80px_-42px_rgba(20,41,95,0.92)]">
          <CardContent className={cn(isMobile ? 'p-5' : 'p-7')}>
            <Badge className="border-none bg-white/15 text-white">내 랭킹</Badge>
            <div className={cn('mt-5 grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
              <SummaryRankCard label="일간" rank={myRanks.daily?.rank || 0} value={Number(myRanks.daily?.value || 0)} active={activeRange === 'daily'} onClick={() => router.replace('/dashboard/leaderboards?range=daily')} />
              <SummaryRankCard label="주간" rank={myRanks.weekly?.rank || 0} value={Number(myRanks.weekly?.value || 0)} active={activeRange === 'weekly'} onClick={() => router.replace('/dashboard/leaderboards?range=weekly')} />
              <SummaryRankCard label="월간" rank={myRanks.monthly?.rank || 0} value={Number(myRanks.monthly?.value || 0)} active={activeRange === 'monthly'} onClick={() => router.replace('/dashboard/leaderboards?range=monthly')} />
            </div>
          </CardContent>
        </Card>

        <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-2')}>
          <Card className="rounded-[1.6rem] border border-slate-100 bg-white shadow-[0_18px_54px_-38px_rgba(15,23,42,0.32)]">
            <CardContent className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">일간 보너스</p>
              <p className="mt-3 text-2xl font-black tracking-tight text-primary">+1000P</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">전날 공부시간 1등, 동점 모두 지급</p>
            </CardContent>
          </Card>
          <Card className="rounded-[1.6rem] border border-slate-100 bg-white shadow-[0_18px_54px_-38px_rgba(15,23,42,0.32)]">
            <CardContent className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">월말 보상</p>
              <div className="mt-3 space-y-1 text-sm font-black text-primary">
                <div className="flex items-center justify-between"><span>1위</span><span>20,000P</span></div>
                <div className="flex items-center justify-between"><span>2위</span><span>10,000P</span></div>
                <div className="flex items-center justify-between"><span>3위</span><span>5,000P</span></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        {(['daily', 'weekly', 'monthly'] as RankRange[]).map((range) => (
          <Button
            key={range}
            onClick={() => router.replace(`/dashboard/leaderboards?range=${range}`)}
            className={cn(
              'h-11 rounded-2xl px-4 font-black',
              activeRange === range
                ? 'bg-[#14295F] text-white hover:bg-[#1B326D]'
                : 'border border-slate-200 bg-white text-slate-500 shadow-none hover:bg-slate-50'
            )}
          >
            {RANGE_META[range].label}
          </Button>
        ))}
      </section>

      <Card className="overflow-hidden rounded-[2rem] border-none bg-white shadow-[0_32px_70px_-44px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.04]">
        <CardHeader className={cn(isMobile ? 'p-5' : 'p-7')}>
          <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight text-primary">
            {activeRange === 'monthly' ? <Trophy className="h-5 w-5 text-[#14295F]" /> : <CalendarDays className="h-5 w-5 text-[#14295F]" />}
            {rangeMeta.title}
          </CardTitle>
          <CardDescription className="font-semibold text-slate-500">
            {rangeMeta.hint}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-0 pb-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            </div>
          ) : currentEntries.length === 0 ? (
            <div className="px-6 py-20 text-center text-sm font-bold text-slate-400">아직 집계된 공부시간 랭킹이 없습니다.</div>
          ) : (
            <>
              <div className={cn('grid gap-3 px-5', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                {topThree.map((entry) => {
                  const rank = entry.rank;
                  const RankIcon = rank === 1 ? Crown : rank === 2 ? Medal : Trophy;
                  const glow = rank === 1 ? 'from-amber-100 to-orange-50' : rank === 2 ? 'from-slate-100 to-white' : 'from-orange-100 to-white';
                  return (
                    <div key={entry.id} className={cn('rounded-[1.6rem] border border-slate-100 bg-gradient-to-br p-5 shadow-[0_18px_54px_-38px_rgba(15,23,42,0.32)]', glow)}>
                      <div className="flex items-center justify-between">
                        <Badge className="border-none bg-[#14295F] text-white">#{rank}</Badge>
                        <RankIcon className="h-5 w-5 text-[#14295F]" />
                      </div>
                      <div className="mt-5 flex items-center gap-3">
                        <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                          <AvatarFallback className="bg-[#14295F]/7 font-black text-[#14295F]">
                            {(entry.displayNameSnapshot || 'S').charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-lg font-black tracking-tight text-slate-900">{formatMaskedName(entry.displayNameSnapshot)}</p>
                          <p className="truncate text-xs font-semibold text-slate-500">{entry.classNameSnapshot || '반 미지정'}</p>
                        </div>
                      </div>
                      <p className="mt-5 text-2xl font-black tracking-tight text-primary">{formatStudyMinutes(entry.value)}</p>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2 px-5">
                {restEntries.map((entry) => (
                  <div key={entry.id} className={cn('flex items-center justify-between rounded-[1.4rem] border px-4 py-3 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.2)]', entry.studentId === user?.uid ? 'border-[#FFB357]/35 bg-[#FFF7EC]' : 'border-slate-100 bg-white')}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-8 text-center text-sm font-black text-slate-400">{entry.rank}</span>
                      <Avatar className="h-10 w-10 border border-slate-100">
                        <AvatarFallback className="bg-[#14295F]/6 font-black text-[#14295F]">
                          {(entry.displayNameSnapshot || 'S').charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">{formatMaskedName(entry.displayNameSnapshot)}</p>
                        <p className="truncate text-[11px] font-semibold text-slate-500">{entry.classNameSnapshot || '반 미지정'}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-black text-primary">{formatStudyMinutes(entry.value)}</p>
                    </div>
                  </div>
                ))}
                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <Button variant="outline" className="h-11 rounded-2xl font-black" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                      더 보기 <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
