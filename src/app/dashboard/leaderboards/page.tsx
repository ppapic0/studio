
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { LeaderboardEntry, WithId } from '@/lib/types';
import { Loader2, Trophy, AlertCircle, Medal, Crown, Star, Flame, TrendingUp, Zap } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

type LeaderboardTabProps = {
  title: string;
  description: string;
  entries: WithId<LeaderboardEntry>[] | null;
  isLoading: boolean;
  metricType: 'completion' | 'attendance' | 'growth';
  isMobile: boolean;
};

function LeaderboardTab({ title, description, entries, isLoading, metricType, isMobile }: LeaderboardTabProps) {
  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    // Only show top 3 ranks (including ties)
    return entries.filter(entry => entry.rank <= 3);
  }, [entries]);

  const getIcon = (size = "h-10 w-10") => {
    switch(metricType) {
      case 'completion': return <Crown className={cn(size, "text-yellow-500 drop-shadow-lg")} />;
      case 'attendance': return <Zap className={cn(size, "text-blue-500 drop-shadow-lg")} />;
      case 'growth': return <TrendingUp className={cn(size, "text-emerald-500 drop-shadow-lg")} />;
    }
  };

  const getRankBadge = (rank: number, size = "p-1.5") => {
    switch(rank) {
      case 1: return <div className={cn("bg-gradient-to-br from-yellow-300 to-amber-500 rounded-full shadow-lg", size)}><Crown className="h-3.5 w-3.5 text-white" /></div>;
      case 2: return <div className={cn("bg-gradient-to-br from-slate-200 to-slate-400 rounded-full shadow-lg", size)}><Medal className="h-3.5 w-3.5 text-white" /></div>;
      case 3: return <div className={cn("bg-gradient-to-br from-orange-300 to-orange-600 rounded-full shadow-lg", size)}><Star className="h-3.5 w-3.5 text-white" /></div>;
      default: return <span className="font-black text-muted-foreground/40 text-xs">{rank}</span>;
    }
  };

  return (
    <Card className={cn(
      "border-none shadow-[0_30px_80px_rgba(0,0,0,0.1)] overflow-hidden bg-white/80 backdrop-blur-xl ring-1 ring-border/50",
      isMobile ? "rounded-[2rem]" : "rounded-[3rem]"
    )}>
      <CardHeader className={cn(
        "bg-gradient-to-b from-muted/30 to-transparent relative",
        isMobile ? "p-6" : "p-10 border-b"
      )}>
        <div className="absolute top-6 right-6 opacity-10 rotate-12">
          {getIcon(isMobile ? "h-16 w-16" : "h-24 w-24")}
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <div className={cn(
            "rounded-[1.25rem] shadow-xl shrink-0 flex items-center justify-center",
            isMobile ? "p-3 h-12 w-12" : "p-4 h-16 w-16",
            metricType === 'completion' ? "bg-yellow-50 text-yellow-600" : 
            metricType === 'attendance' ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
          )}>
            {getIcon(isMobile ? "h-6 w-6" : "h-8 w-8")}
          </div>
          <div className="space-y-0.5">
            <CardTitle className={cn("font-black tracking-tighter uppercase leading-none", isMobile ? "text-xl" : "text-4xl")}>
              {title}
            </CardTitle>
            <CardDescription className={cn("font-bold text-muted-foreground/80", isMobile ? "text-xs" : "text-lg")}>{description}</CardDescription>
          </div>
        </div>
        
        {metricType === 'attendance' && (
          <div className={cn(
            "mt-4 text-rose-600 flex items-center gap-2 bg-rose-50/50 rounded-xl border border-rose-100 font-bold max-w-fit",
            isMobile ? "p-2.5 text-[9px]" : "p-4 text-xs"
          )}>
            <AlertCircle className={cn(isMobile ? "h-3.5 w-3.5" : "h-5 w-5")} />
            일일 학습 3시간 이상 달성 시에만 인정됩니다.
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            <p className="font-black text-[10px] text-muted-foreground/40 uppercase tracking-widest">Calculating...</p>
          </div>
        ) : !filteredEntries || filteredEntries.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center gap-4">
            <div className="p-6 rounded-full bg-muted/20">
              <Trophy className="h-12 w-12 text-muted-foreground opacity-10" />
            </div>
            <p className="text-sm font-black text-muted-foreground/40">랭킹 데이터가 아직 없습니다.</p>
          </div>
        ) : isMobile ? (
          <div className="divide-y divide-muted/10">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className={cn(
                "p-5 flex items-center justify-between transition-all",
                entry.rank === 1 ? "bg-yellow-50/20" : entry.rank === 2 ? "bg-slate-50/20" : entry.rank === 3 ? "bg-orange-50/20" : ""
              )}>
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-8 shrink-0 flex justify-center">
                    {getRankBadge(entry.rank, "p-1")}
                  </div>
                  <div className="relative shrink-0">
                    <Avatar className="h-11 w-11 border-2 border-white shadow-md">
                      <AvatarFallback className="bg-primary/5 text-primary font-black text-sm">
                        {entry.displayNameSnapshot?.charAt(0) || 'S'}
                      </AvatarFallback>
                    </Avatar>
                    {entry.rank === 1 && <Flame className="absolute -top-1 -right-1 h-4 w-4 text-orange-500 fill-orange-500" />}
                  </div>
                  <div className="grid min-w-0">
                    <span className="font-black text-sm truncate tracking-tight">{entry.displayNameSnapshot}</span>
                    <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-tighter">Verified Champion</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn(
                    "text-xl font-black tabular-nums tracking-tighter leading-none",
                    entry.rank === 1 ? "text-amber-600" : "text-primary"
                  )}>
                    {entry.value.toLocaleString()}{metricType === 'attendance' ? '일' : '%'}
                  </div>
                  <span className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-tighter">Season Score</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b bg-muted/5 h-16">
              <TableHead className="w-[120px] font-black text-center text-xs uppercase tracking-widest">RANK</TableHead>
              <TableHead className="font-black text-xs uppercase tracking-widest">STUDENT CHAMPION</TableHead>
              <TableHead className="text-right font-black text-xs uppercase tracking-widest pr-12">QUALITY SCORE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.map((entry) => (
              <TableRow key={entry.id} className={cn(
                "group transition-all duration-500 h-24 border-b", 
                entry.rank === 1 ? "bg-yellow-50/30 hover:bg-yellow-50/50" : 
                entry.rank === 2 ? "bg-slate-50/30 hover:bg-slate-50/50" : 
                entry.rank === 3 ? "bg-orange-50/30 hover:bg-orange-50/50" : "hover:bg-muted/5"
              )}>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center justify-center gap-1">
                    {getRankBadge(entry.rank)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-5">
                    <div className="relative">
                      <Avatar className="h-14 w-14 border-4 border-white shadow-xl group-hover:scale-110 transition-transform duration-500">
                        <AvatarFallback className={cn(
                          "font-black text-xl",
                          entry.rank <= 3 ? "bg-white" : "bg-primary/5 text-primary"
                        )}>
                          {entry.displayNameSnapshot?.charAt(0) || 'S'}
                        </AvatarFallback>
                      </Avatar>
                      {entry.rank === 1 && (
                        <div className="absolute -top-3 -right-3 rotate-12">
                          <Flame className="h-6 w-6 text-orange-500 fill-orange-500 animate-pulse" />
                        </div>
                      )}
                    </div>
                    <div className="grid gap-0.5">
                      <div className="text-xl font-black tracking-tighter group-hover:text-primary transition-colors">
                        {entry.displayNameSnapshot}
                      </div>
                      <span className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">Verified Mastery</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right pr-12">
                  <div className="flex flex-col items-end">
                    <span className={cn(
                      "text-3xl font-black tabular-nums tracking-tighter drop-shadow-sm",
                      entry.rank === 1 ? "text-amber-600" : "text-primary"
                    )}>
                      {entry.value.toLocaleString()}{metricType === 'attendance' ? '일' : '%'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", metricType === 'growth' ? "bg-emerald-500" : "bg-primary/30")} />
                      <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">SEASON SCORE</span>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function LeaderboardsPage() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  
  const isMember = !!activeMembership;
  const isMobile = viewMode === 'mobile';
  const periodKey = format(new Date(), 'yyyy-MM');

  const completionQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_completion`, 'entries'),
      orderBy('rank', 'asc'),
      limit(50) 
    );
  }, [firestore, activeMembership, periodKey]);
  const { data: completionEntries, isLoading: completionLoading } = useCollection<LeaderboardEntry>(completionQuery, { enabled: isMember });

  const consistencyQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_attendance`, 'entries'),
      orderBy('rank', 'asc'),
      limit(50)
    );
  }, [firestore, activeMembership, periodKey]);
  const { data: consistencyEntries, isLoading: consistencyLoading } = useCollection<LeaderboardEntry>(consistencyQuery, { enabled: isMember });

  const growthQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_growth`, 'entries'),
      orderBy('rank', 'asc'),
      limit(50)
    );
  }, [firestore, activeMembership, periodKey]);
  const { data: growthEntries, isLoading: growthLoading } = useCollection<LeaderboardEntry>(growthQuery, { enabled: isMember });

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
      <header className={cn("flex flex-col gap-3 items-center text-center", isMobile ? "px-2" : "")}>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/10 shadow-sm">
          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
          <span className="text-[9px] font-black uppercase tracking-[0.25em] text-primary/60">Season Hall of Fame</span>
          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
        </div>
        <h1 className={cn("font-black tracking-tight flex items-center gap-3", isMobile ? "text-3xl" : "text-6xl")}>
          랭킹트랙
        </h1>
        <p className={cn("font-bold text-muted-foreground leading-relaxed", isMobile ? "text-sm max-w-xs" : "text-xl max-w-2xl")}>
          {format(new Date(), 'yyyy년 M월')} 시즌 최고의 챔피언들입니다. <br/>
          데이터로 증명된 노력의 결실을 확인하세요.
        </p>
      </header>

      <Tabs defaultValue="completion" className="w-full">
        <div className="flex justify-center mb-8">
          <TabsList className={cn(
            "grid grid-cols-3 bg-muted/30 p-1.5 rounded-[1.5rem] border border-border/50 shadow-inner w-full",
            isMobile ? "h-14 max-w-sm" : "h-20 max-w-3xl rounded-[2rem]"
          )}>
            <TabsTrigger value="completion" className={cn(
              "font-black data-[state=active]:bg-white data-[state=active]:shadow-xl transition-all uppercase tracking-tighter gap-1.5",
              isMobile ? "text-[10px] rounded-xl px-1" : "text-base rounded-[1.5rem] px-4"
            )}>
              <Star className={cn(isMobile ? "h-3 w-3" : "h-4 w-4", "text-yellow-500")} /> <span className={cn(isMobile ? "truncate" : "")}>계획완수</span>
            </TabsTrigger>
            
            <TabsTrigger value="attendance" className={cn(
              "font-black data-[state=active]:bg-white data-[state=active]:shadow-xl transition-all uppercase tracking-tighter gap-1.5",
              isMobile ? "text-[10px] rounded-xl px-1" : "text-base rounded-[1.5rem] px-4"
            )}>
              <Zap className={cn(isMobile ? "h-3 w-3" : "h-4 w-4", "text-blue-500")} /> <span className={cn(isMobile ? "truncate" : "")}>출석</span>
            </TabsTrigger>

            <TabsTrigger value="growth" className={cn(
              "font-black data-[state=active]:bg-white data-[state=active]:shadow-xl transition-all uppercase tracking-tighter gap-1.5",
              isMobile ? "text-[10px] rounded-xl px-1" : "text-base rounded-[1.5rem] px-4"
            )}>
              <TrendingUp className={cn(isMobile ? "h-3 w-3" : "h-4 w-4", "text-emerald-500")} /> <span className={cn(isMobile ? "truncate" : "")}>성장</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="completion" className="mt-0 animate-in fade-in zoom-in-95 duration-500">
          <LeaderboardTab
            title="계획완수 챔피언"
            description="가장 높은 To-do 달성률을 기록했습니다."
            entries={completionEntries}
            isLoading={completionLoading}
            metricType="completion"
            isMobile={isMobile}
          />
        </TabsContent>

        <TabsContent value="attendance" className="mt-0 animate-in fade-in zoom-in-95 duration-500">
          <LeaderboardTab
            title="출석 챔피언"
            description="3시간 이상 몰입 학습을 가장 꾸준히 기록했습니다."
            entries={consistencyEntries}
            isLoading={consistencyLoading}
            metricType="attendance"
            isMobile={isMobile}
          />
        </TabsContent>

        <TabsContent value="growth" className="mt-0 animate-in fade-in zoom-in-95 duration-500">
          <LeaderboardTab
            title="성장 챔피언"
            description="지난 달 대비 성취도가 가장 비약적으로 상승했습니다."
            entries={growthEntries}
            isLoading={growthLoading}
            metricType="growth"
            isMobile={isMobile}
          />
        </TabsContent>
      </Tabs>

      <footer className="pt-6 flex justify-center opacity-30">
        <div className="flex items-center gap-2 font-black text-[8px] sm:text-[10px] uppercase tracking-[0.4em]">
          Analytical Track Engine
        </div>
      </footer>
    </div>
  );
}
