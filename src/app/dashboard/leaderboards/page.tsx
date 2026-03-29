'use client';

import { useMemo, useState } from 'react';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { format, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LeaderboardEntry, WithId } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Trophy, Medal, Crown, ChevronRight, Clock3, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatStudyMinutes } from '@/lib/student-rewards';

const PAGE_SIZE = 50;

function formatMaskedName(name?: string | null) {
  if (!name) return '익명 학생';
  return name.length > 1 ? `${name.charAt(0)}*${name.slice(-1)}` : name;
}

export default function LeaderboardsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeMembership, viewMode } = useAppContext();
  const isMobile = viewMode === 'mobile';
  const [seasonOffset, setSeasonOffset] = useState<0 | -1>(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const targetDate = useMemo(() => seasonOffset === 0 ? new Date() : subMonths(new Date(), 1), [seasonOffset]);
  const periodKey = useMemo(() => format(targetDate, 'yyyy-MM'), [targetDate]);

  const rankQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_study-time`, 'entries'),
      orderBy('value', 'desc'),
      limit(120)
    );
  }, [firestore, activeMembership?.id, periodKey]);
  const { data: rawEntries, isLoading } = useCollection<LeaderboardEntry>(rankQuery, { enabled: !!activeMembership });

  const entries = useMemo(
    () => [...(rawEntries || [])].sort((a, b) => Number(b.value || 0) - Number(a.value || 0)),
    [rawEntries]
  );
  const topThree = entries.slice(0, 3);
  const restEntries = entries.slice(3, visibleCount);
  const hasMore = entries.length > visibleCount;
  const myRank = useMemo(() => {
    if (!user) return 0;
    const index = entries.findIndex((entry) => entry.studentId === user.uid);
    return index >= 0 ? index + 1 : 0;
  }, [entries, user?.uid]);
  const myEntry = useMemo(
    () => entries.find((entry) => entry.studentId === user?.uid) || null,
    [entries, user?.uid]
  );

  if (!activeMembership) return null;

  return (
    <div className={cn('mx-auto flex w-full max-w-6xl flex-col pb-20', isMobile ? 'gap-5 px-1' : 'gap-8 px-4')}>
      <header className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#14295F]/10 bg-[#14295F]/5 px-4 py-1.5 shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-[#14295F]" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#14295F]/70">monthly study ranking</span>
        </div>
        <div className="space-y-2">
          <h1 className={cn('font-black tracking-tighter text-primary', isMobile ? 'text-3xl' : 'text-5xl')}>월간 공부 랭킹</h1>
          <p className={cn('mx-auto font-semibold text-slate-600', isMobile ? 'max-w-xs text-sm leading-6' : 'max-w-3xl text-lg leading-8')}>
            센터 전체 학생의 월간 누적 공부시간을 기준으로 집계합니다. 월말에는 1위 20,000P, 2위 10,000P, 3위 5,000P가 지급됩니다.
          </p>
        </div>
        <div className="inline-flex rounded-2xl border bg-white p-1.5 shadow-sm">
          <Button onClick={() => setSeasonOffset(0)} className={cn('h-10 rounded-xl px-4 font-black', seasonOffset === 0 ? 'bg-[#14295F] text-white hover:bg-[#1B326D]' : 'bg-transparent text-slate-500 shadow-none hover:bg-slate-50')}>
            이번 달
          </Button>
          <Button onClick={() => setSeasonOffset(-1)} className={cn('h-10 rounded-xl px-4 font-black', seasonOffset === -1 ? 'bg-[#14295F] text-white hover:bg-[#1B326D]' : 'bg-transparent text-slate-500 shadow-none hover:bg-slate-50')}>
            지난 달
          </Button>
        </div>
      </header>

      <section className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-[1.2fr_0.8fr]')}>
        <Card className="rounded-[2rem] border-none bg-[linear-gradient(135deg,#14295F_0%,#1B326D_55%,#233E86_100%)] text-white shadow-[0_36px_80px_-42px_rgba(20,41,95,0.92)]">
          <CardContent className={cn(isMobile ? 'p-5' : 'p-7')}>
            <Badge className="border-none bg-white/15 text-white">내 위치</Badge>
            <div className={cn('mt-5 flex gap-4', isMobile ? 'flex-col' : 'items-end justify-between')}>
              <div>
                <p className={cn('font-black tracking-tight', isMobile ? 'text-3xl' : 'text-5xl')}>
                  {myRank ? `#${myRank}` : '집계중'}
                </p>
                <p className="mt-2 text-sm font-semibold text-white/72">
                  {myEntry ? `${formatStudyMinutes(Number(myEntry.value || 0))} 누적` : '이번 달 공부시간이 쌓이면 순위가 보입니다.'}
                </p>
              </div>
              <div className={cn('rounded-[1.4rem] border border-white/15 bg-white/10', isMobile ? 'p-4' : 'min-w-[15rem] p-5')}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/58">월말 보상</p>
                <div className="mt-3 space-y-2 text-sm font-black">
                  <div className="flex items-center justify-between"><span>1위</span><span>20,000P</span></div>
                  <div className="flex items-center justify-between"><span>2위</span><span>10,000P</span></div>
                  <div className="flex items-center justify-between"><span>3위</span><span>5,000P</span></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-2')}>
          <Card className="rounded-[1.6rem] border border-slate-100 bg-white shadow-[0_18px_54px_-38px_rgba(15,23,42,0.32)]">
            <CardContent className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">집계 기준</p>
              <p className="mt-3 text-2xl font-black tracking-tight text-primary">공부시간</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">월간 누적 공부시간 순으로 정렬</p>
            </CardContent>
          </Card>
          <Card className="rounded-[1.6rem] border border-slate-100 bg-white shadow-[0_18px_54px_-38px_rgba(15,23,42,0.32)]">
            <CardContent className="p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">일간 보너스</p>
              <p className="mt-3 text-2xl font-black tracking-tight text-primary">+1000P</p>
              <p className="mt-2 text-sm font-semibold text-slate-600">전날 공부시간 1등, 동점 모두 지급</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="overflow-hidden rounded-[2rem] border-none bg-white shadow-[0_32px_70px_-44px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.04]">
        <CardHeader className={cn(isMobile ? 'p-5' : 'p-7')}>
          <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight text-primary">
            <Trophy className="h-5 w-5 text-[#14295F]" /> {format(targetDate, 'yyyy년 M월', { locale: ko })} 랭킹
          </CardTitle>
          <CardDescription className="font-semibold text-slate-500">
            공부시간이 길수록 위로 올라갑니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-0 pb-6">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            </div>
          ) : entries.length === 0 ? (
            <div className="px-6 py-20 text-center text-sm font-bold text-slate-400">아직 집계된 공부시간 랭킹이 없습니다.</div>
          ) : (
            <>
              <div className={cn('grid gap-3 px-5', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                {topThree.map((entry, index) => {
                  const rank = index + 1;
                  const rankIcon = rank === 1 ? Crown : rank === 2 ? Medal : Trophy;
                  const RankIcon = rankIcon;
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
                      <p className="mt-5 text-2xl font-black tracking-tight text-primary">{formatStudyMinutes(Number(entry.value || 0))}</p>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2 px-5">
                {restEntries.map((entry, index) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-[1.4rem] border border-slate-100 bg-white px-4 py-3 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.2)]">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-8 text-center text-sm font-black text-slate-400">{index + 4}</span>
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
                      <p className="text-sm font-black text-primary">{formatStudyMinutes(Number(entry.value || 0))}</p>
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
