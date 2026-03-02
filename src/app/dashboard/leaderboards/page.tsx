'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { format, subMonths } from 'date-fns';
import { LeaderboardEntry, WithId, StudentProfile } from '@/lib/types';
import { Loader2, Trophy, AlertCircle, Medal, Crown, Star, Flame, TrendingUp, Zap, CalendarDays, History } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type LeaderboardTabProps = {
  title: string;
  description: string;
  entries: WithId<LeaderboardEntry>[] | null;
  isLoading: boolean;
  metricType: 'lp' | 'completion' | 'attendance';
  isMobile: boolean;
  studentsMap: Record<string, StudentProfile>;
};

function LeaderboardTab({ title, description, entries, isLoading, metricType, isMobile, studentsMap }: LeaderboardTabProps) {
  // 오직 1, 2, 3등만 필터링
  const topThree = useMemo(() => {
    if (!entries) return [];
    return entries.filter(entry => entry.rank <= 3).sort((a, b) => a.rank - b.rank);
  }, [entries]);

  const getIcon = (size = "h-10 w-10") => {
    switch(metricType) {
      case 'lp': return <Zap className={cn(size, "text-amber-500 drop-shadow-lg")} />;
      case 'completion': return <Crown className={cn(size, "text-yellow-500 drop-shadow-lg")} />;
      case 'attendance': return <Star className={cn(size, "text-blue-500 drop-shadow-lg")} />;
    }
  };

  const getRankBadge = (rank: number) => {
    switch(rank) {
      case 1: return <div className="bg-gradient-to-br from-yellow-300 to-amber-500 p-2 rounded-full shadow-lg"><Crown className="h-5 w-5 text-white" /></div>;
      case 2: return <div className="bg-gradient-to-br from-slate-200 to-slate-400 p-2 rounded-full shadow-lg"><Medal className="h-5 w-5 text-white" /></div>;
      case 3: return <div className="bg-gradient-to-br from-orange-300 to-orange-600 p-2 rounded-full shadow-lg"><Star className="h-5 w-5 text-white" /></div>;
      default: return null;
    }
  };

  const formatName = (name: string) => {
    if (!name) return "";
    return name.charAt(0) + "*O"; // 성만 노출
  };

  return (
    <Card className={cn(
      "border-none shadow-2xl overflow-hidden bg-white/80 backdrop-blur-xl ring-1 ring-border/50",
      isMobile ? "rounded-[2rem]" : "rounded-[3.5rem]"
    )}>
      <CardHeader className={cn(
        "bg-gradient-to-b from-muted/30 to-transparent relative border-b",
        isMobile ? "p-8" : "p-12"
      )}>
        <div className="absolute top-8 right-8 opacity-5 rotate-12">
          {getIcon(isMobile ? "h-24 w-24" : "h-40 w-40")}
        </div>
        <div className="flex items-center gap-6 relative z-10">
          <div className={cn(
            "rounded-[1.5rem] shadow-xl shrink-0 flex items-center justify-center p-4",
            isMobile ? "h-14 w-14" : "h-20 w-20",
            metricType === 'lp' ? "bg-amber-50 text-amber-600" : 
            metricType === 'completion' ? "bg-yellow-50 text-yellow-600" : "bg-blue-50 text-blue-600"
          )}>
            {getIcon(isMobile ? "h-8 w-8" : "h-10 w-10")}
          </div>
          <div className="space-y-1">
            <CardTitle className={cn("font-black tracking-tighter uppercase leading-none", isMobile ? "text-2xl" : "text-5xl")}>
              {title}
            </CardTitle>
            <CardDescription className={cn("font-bold text-muted-foreground/80", isMobile ? "text-xs" : "text-xl")}>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("p-0 bg-[#fafafa]/50")}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
            <p className="font-black text-[10px] text-muted-foreground/40 uppercase tracking-widest italic">Authenticating Champions...</p>
          </div>
        ) : !topThree || topThree.length === 0 ? (
          <div className="text-center py-32 flex flex-col items-center gap-6">
            <div className="p-8 rounded-full bg-muted/20">
              <Trophy className="h-16 w-16 text-muted-foreground opacity-10" />
            </div>
            <p className="text-sm font-black text-muted-foreground/40 uppercase tracking-widest">데이터 집계 중입니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-muted/10">
            {topThree.map((entry) => {
              const profile = studentsMap[entry.studentId];
              return (
                <div key={entry.id} className={cn(
                  "p-8 sm:p-12 flex items-center justify-between transition-all duration-500 group relative overflow-hidden",
                  entry.rank === 1 ? "bg-amber-50/20" : entry.rank === 2 ? "bg-slate-50/20" : "bg-orange-50/20"
                )}>
                  {entry.rank === 1 && (
                    <div className="absolute -left-10 top-1/2 -translate-y-1/2 opacity-5 pointer-events-none">
                      <Crown className="h-40 w-40 -rotate-12" />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-8 sm:gap-12 relative z-10 min-w-0">
                    <div className="w-12 shrink-0 flex flex-col items-center justify-center gap-2">
                      {getRankBadge(entry.rank)}
                      <span className="text-xs font-black opacity-20 uppercase tracking-widest">Rank</span>
                    </div>
                    
                    <div className="relative shrink-0">
                      <Avatar className={cn(
                        "border-4 border-white shadow-2xl transition-transform duration-700 group-hover:scale-110",
                        isMobile ? "h-16 w-16" : "h-24 w-24"
                      )}>
                        <AvatarFallback className="bg-primary/5 text-primary font-black text-xl">
                          {entry.displayNameSnapshot?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {entry.rank === 1 && (
                        <div className="absolute -top-3 -right-3">
                          <Flame className="h-8 w-8 text-orange-500 fill-orange-500 animate-pulse" />
                        </div>
                      )}
                    </div>

                    <div className="grid gap-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className={cn("font-black tracking-tighter truncate", isMobile ? "text-2xl" : "text-4xl")}>
                          {formatName(entry.displayNameSnapshot)}
                        </span>
                        <Badge className="bg-white/80 text-primary border-none shadow-sm font-black text-[9px] uppercase h-5 px-2">Verified</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground font-bold">
                        <History className="h-3.5 w-3.5 opacity-40" />
                        <span className={cn("truncate", isMobile ? "text-xs" : "text-lg")}>{profile?.schoolName || "비공개 학교"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 relative z-10">
                    <div className={cn(
                      "font-black tabular-nums tracking-tighter leading-none drop-shadow-sm",
                      isMobile ? "text-3xl" : "text-6xl",
                      entry.rank === 1 ? "text-amber-600" : "text-primary"
                    )}>
                      {entry.value.toLocaleString()}<span className="text-sm sm:text-2xl ml-1.5 opacity-30 uppercase">{metricType === 'attendance' ? '일' : metricType === 'lp' ? 'lp' : '%'}</span>
                    </div>
                    <span className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.2em] mt-2 block">Season Achievement</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LeaderboardsPage() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  
  const [seasonOffset, setSeasonOffset] = useState<0 | -1>(0); // 0: 이번 시즌, -1: 지난 시즌
  const isMember = !!activeMembership;
  const isMobile = viewMode === 'mobile';
  
  const targetDate = useMemo(() => {
    return seasonOffset === 0 ? new Date() : subMonths(new Date(), 1);
  }, [seasonOffset]);

  const periodKey = useMemo(() => format(targetDate, 'yyyy-MM'), [targetDate]);

  // 학생 프로필 정보 (학교명 조회를 위함)
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return collection(firestore, 'centers', activeMembership.id, 'students');
  }, [firestore, activeMembership]);
  const { data: studentProfiles } = useCollection<StudentProfile>(studentsQuery, { enabled: isMember });

  const studentsMap = useMemo(() => {
    const map: Record<string, StudentProfile> = {};
    studentProfiles?.forEach(p => { map[p.id] = p; });
    return map;
  }, [studentProfiles]);

  const lpQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_lp`, 'entries'),
      orderBy('rank', 'asc'),
      limit(3) 
    );
  }, [firestore, activeMembership, periodKey]);
  const { data: lpEntries, isLoading: lpLoading } = useCollection<LeaderboardEntry>(lpQuery, { enabled: isMember });

  const completionQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_completion`, 'entries'),
      orderBy('rank', 'asc'),
      limit(3) 
    );
  }, [firestore, activeMembership, periodKey]);
  const { data: completionEntries, isLoading: completionLoading } = useCollection<LeaderboardEntry>(completionQuery, { enabled: isMember });

  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_attendance`, 'entries'),
      orderBy('rank', 'asc'),
      limit(3)
    );
  }, [firestore, activeMembership, periodKey]);
  const { data: attendanceEntries, isLoading: attendanceLoading } = useCollection<LeaderboardEntry>(attendanceQuery, { enabled: isMember });

  if (!isMember) {
    return (
        <div className="max-w-4xl mx-auto py-20 px-4">
          <Alert className="rounded-[3rem] border-none shadow-2xl bg-white p-12 text-center flex flex-col items-center">
            <Trophy className="h-20 w-20 text-muted-foreground opacity-20 mb-6" />
            <AlertTitle className="text-3xl font-black mb-4 tracking-tighter uppercase">Access Restricted</AlertTitle>
            <AlertDescription className="text-lg font-bold text-muted-foreground/70">
              랭킹트랙을 확인하려면 먼저 센터에 가입해야 합니다.
            </AlertDescription>
          </Alert>
        </div>
    )
  }

  return (
    <div className={cn("flex flex-col mx-auto pb-20", isMobile ? "gap-6 px-1" : "gap-10 px-4 max-w-[1400px]")}>
      <header className={cn("flex flex-col gap-4 items-center text-center", isMobile ? "px-2" : "")}>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 shadow-sm">
          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
          <span className="text-[9px] font-black uppercase tracking-[0.25em] text-primary/60">Season Hall of Fame</span>
          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
        </div>
        <h1 className={cn("font-black tracking-tight flex items-center gap-3", isMobile ? "text-3xl" : "text-6xl")}>
          랭킹트랙
        </h1>
        
        <div className="flex gap-2 p-1.5 bg-white/50 backdrop-blur-md rounded-2xl border shadow-xl mt-2">
          <Button 
            onClick={() => setSeasonOffset(0)}
            className={cn(
              "rounded-xl h-11 px-6 font-black text-xs transition-all",
              seasonOffset === 0 ? "bg-primary text-white shadow-lg" : "bg-transparent text-muted-foreground hover:bg-muted/50"
            )}
          >이번 시즌 (LIVE)</Button>
          <Button 
            onClick={() => setSeasonOffset(-1)}
            className={cn(
              "rounded-xl h-11 px-6 font-black text-xs transition-all",
              seasonOffset === -1 ? "bg-primary text-white shadow-lg" : "bg-transparent text-muted-foreground hover:bg-muted/50"
            )}
          >지난 시즌 (ARCHIVE)</Button>
        </div>

        <p className={cn("font-bold text-muted-foreground leading-relaxed mt-4", isMobile ? "text-sm max-w-xs" : "text-xl max-w-2xl")}>
          {format(targetDate, 'yyyy년 M월')} 시즌 최정상에 오른 챔피언들입니다. <br/>
          각 분야 Top 3만이 누릴 수 있는 명예의 전당입니다.
        </p>
      </header>

      <Tabs defaultValue="lp" className="w-full">
        <div className="flex justify-center mb-8">
          <TabsList className={cn(
            "grid grid-cols-3 bg-muted/30 p-1.5 rounded-[1.5rem] border border-border/50 shadow-inner w-full",
            isMobile ? "h-14 max-w-sm" : "h-20 max-w-3xl rounded-[2.5rem]"
          )}>
            <TabsTrigger value="lp" className={cn(
              "font-black data-[state=active]:bg-white data-[state=active]:shadow-xl transition-all uppercase tracking-tighter gap-1.5",
              isMobile ? "text-[10px] rounded-xl" : "text-base rounded-[2rem] px-4"
            )}>
              <Zap className={cn(isMobile ? "h-3 w-3" : "h-4 w-4", "text-amber-500")} /> <span className={cn(isMobile ? "truncate" : "")}>종합 LP</span>
            </TabsTrigger>
            
            <TabsTrigger value="completion" className={cn(
              "font-black data-[state=active]:bg-white data-[state=active]:shadow-xl transition-all uppercase tracking-tighter gap-1.5",
              isMobile ? "text-[10px] rounded-xl" : "text-base rounded-[2rem] px-4"
            )}>
              <Crown className={cn(isMobile ? "h-3 w-3" : "h-4 w-4", "text-yellow-500")} /> <span className={cn(isMobile ? "truncate" : "")}>계획완수</span>
            </TabsTrigger>

            <TabsTrigger value="attendance" className={cn(
              "font-black data-[state=active]:bg-white data-[state=active]:shadow-xl transition-all uppercase tracking-tighter gap-1.5",
              isMobile ? "text-[10px] rounded-xl" : "text-base rounded-[2rem] px-4"
            )}>
              <Star className={cn(isMobile ? "h-3 w-3" : "h-4 w-4", "text-blue-500")} /> <span className={cn(isMobile ? "truncate" : "")}>출석왕</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="lp" className="mt-0 animate-in fade-in zoom-in-95 duration-500">
          <LeaderboardTab
            title="시즌 LP 챔피언"
            description="가장 높은 러닝 포인트를 획득한 상위 3명입니다."
            entries={lpEntries}
            isLoading={lpLoading}
            metricType="lp"
            isMobile={isMobile}
            studentsMap={studentsMap}
          />
        </TabsContent>

        <TabsContent value="completion" className="mt-0 animate-in fade-in zoom-in-95 duration-500">
          <LeaderboardTab
            title="계획완수 마스터"
            description="3개 이상 계획을 가장 성실히 완수한 상위 3명입니다."
            entries={completionEntries}
            isLoading={completionLoading}
            metricType="completion"
            isMobile={isMobile}
            studentsMap={studentsMap}
          />
        </TabsContent>

        <TabsContent value="attendance" className="mt-0 animate-in fade-in zoom-in-95 duration-500">
          <LeaderboardTab
            title="몰입 출석왕"
            description="3시간 이상 몰입 학습을 가장 많이 기록한 상위 3명입니다."
            entries={attendanceEntries}
            isLoading={attendanceLoading}
            metricType="attendance"
            isMobile={isMobile}
            studentsMap={studentsMap}
          />
        </TabsContent>
      </Tabs>

      <footer className="pt-12 flex flex-col items-center gap-4 opacity-30">
        <div className="flex items-center gap-2 font-black text-[8px] sm:text-[10px] uppercase tracking-[0.4em]">
          Analytical Track Hall of Fame
        </div>
        <p className="text-[9px] font-bold max-w-md text-center leading-relaxed">
          개인정보 보호를 위해 성명은 마스킹 처리되며,<br/>
          학교 대항전 느낌을 살리기 위해 소속 학교가 강조됩니다.
        </p>
      </footer>
    </div>
  );
}
