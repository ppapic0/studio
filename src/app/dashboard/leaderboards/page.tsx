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

type LeaderboardTabProps = {
  title: string;
  description: string;
  entries: WithId<LeaderboardEntry>[] | null;
  isLoading: boolean;
  metricType: 'completion' | 'attendance' | 'growth';
};

function LeaderboardTab({ title, description, entries, isLoading, metricType }: LeaderboardTabProps) {
  const getIcon = () => {
    switch(metricType) {
      case 'completion': return <Crown className="h-10 w-10 text-yellow-500 drop-shadow-lg" />;
      case 'attendance': return <Zap className="h-10 w-10 text-blue-500 drop-shadow-lg" />;
      case 'growth': return <TrendingUp className="h-10 w-10 text-emerald-500 drop-shadow-lg" />;
    }
  };

  const getRankBadge = (rank: number) => {
    switch(rank) {
      case 1: return <div className="bg-gradient-to-br from-yellow-300 to-amber-500 p-1.5 rounded-full shadow-lg"><Crown className="h-4 w-4 text-white" /></div>;
      case 2: return <div className="bg-gradient-to-br from-slate-200 to-slate-400 p-1.5 rounded-full shadow-lg"><Medal className="h-4 w-4 text-white" /></div>;
      case 3: return <div className="bg-gradient-to-br from-orange-300 to-orange-600 p-1.5 rounded-full shadow-lg"><Star className="h-4 w-4 text-white" /></div>;
      default: return <span className="font-black text-muted-foreground/40">{rank}</span>;
    }
  };

  return (
    <Card className="rounded-[3rem] border-none shadow-[0_30px_80px_rgba(0,0,0,0.1)] overflow-hidden bg-white/80 backdrop-blur-xl ring-1 ring-border/50">
      <CardHeader className="bg-gradient-to-b from-muted/30 to-transparent p-10 border-b relative">
        <div className="absolute top-10 right-10 opacity-10 rotate-12">
          {getIcon()}
        </div>
        <div className="flex items-center gap-5">
          <div className={cn(
            "p-4 rounded-[1.5rem] shadow-xl",
            metricType === 'completion' ? "bg-yellow-50 text-yellow-600" : 
            metricType === 'attendance' ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
          )}>
            {getIcon()}
          </div>
          <div className="space-y-1">
            <CardTitle className="text-4xl font-black tracking-tighter uppercase">
              {title}
            </CardTitle>
            <CardDescription className="text-lg font-bold text-muted-foreground/80">{description}</CardDescription>
          </div>
        </div>
        
        {metricType === 'attendance' && (
          <div className="mt-8 text-xs text-rose-600 flex items-center gap-3 bg-rose-50/50 p-4 rounded-2xl border border-rose-100 font-bold max-w-fit">
            <AlertCircle className="h-5 w-5" />
            일일 학습 3시간(180분) 이상 달성 시에만 출석 일수로 인정됩니다.
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
            <p className="font-black text-muted-foreground/40 italic uppercase tracking-widest">Calculating Rankings...</p>
          </div>
        ) : !entries || entries.length === 0 ? (
          <div className="text-center py-40 flex flex-col items-center gap-6">
            <div className="p-10 rounded-full bg-muted/20">
              <Trophy className="h-20 w-20 text-muted-foreground opacity-10" />
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-black text-muted-foreground/40">이번 시즌 랭킹 데이터가 아직 없습니다.</p>
              <p className="text-sm font-bold text-muted-foreground/30 uppercase tracking-[0.2em]">Be the first champion</p>
            </div>
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b bg-muted/5 h-16">
              <TableHead className="w-[120px] font-black text-center text-xs uppercase tracking-widest">RANK</TableHead>
              <TableHead className="font-black text-xs uppercase tracking-widest">STUDENT CHAMPION</TableHead>
              <TableHead className="text-right font-black text-xs uppercase tracking-widest pr-12">MASTERY SCORE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries?.map((entry) => (
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
  const { activeMembership } = useAppContext();
  
  const isMember = !!activeMembership;
  const periodKey = format(new Date(), 'yyyy-MM');

  const completionQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_completion`, 'entries'),
      orderBy('rank', 'asc'),
      limit(20)
    );
  }, [firestore, activeMembership, periodKey]);
  const { data: completionEntries, isLoading: completionLoading } = useCollection<LeaderboardEntry>(completionQuery, { enabled: isMember });

  const consistencyQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_attendance`, 'entries'),
      orderBy('rank', 'asc'),
      limit(20)
    );
  }, [firestore, activeMembership, periodKey]);
  const { data: consistencyEntries, isLoading: consistencyLoading } = useCollection<LeaderboardEntry>(consistencyQuery, { enabled: isMember });

  const growthQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_growth`, 'entries'),
      orderBy('rank', 'asc'),
      limit(20)
    );
  }, [firestore, activeMembership, periodKey]);
  const { data: growthEntries, isLoading: growthLoading } = useCollection<LeaderboardEntry>(growthQuery, { enabled: isMember });

  if (!isMember) {
    return (
        <div className="max-w-4xl mx-auto py-20">
          <Alert className="rounded-[3rem] border-none shadow-2xl bg-white p-12 text-center flex flex-col items-center">
            <Trophy className="h-20 w-20 text-muted-foreground opacity-20 mb-6" />
            <AlertTitle className="text-3xl font-black mb-4 tracking-tighter uppercase">Access Restricted</AlertTitle>
            <AlertDescription className="text-lg font-bold text-muted-foreground/70">
              리더보드를 확인하려면 먼저 센터에 가입해야 합니다.
            </AlertDescription>
          </Alert>
        </div>
    )
  }

  return (
    <div className="space-y-10 max-w-[1400px] mx-auto pb-20 px-4">
      <header className="flex flex-col gap-4 items-center text-center">
        <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-primary/5 border border-primary/10 shadow-sm">
          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60">Season Hall of Fame</span>
          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
        </div>
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight flex items-center gap-4">
          명예의 전당
        </h1>
        <p className="text-xl font-bold text-muted-foreground max-w-2xl leading-relaxed">
          {format(new Date(), 'yyyy년 M월')} 시즌, 센터 최고의 챔피언들을 소개합니다. <br/>
          데이터로 증명된 노력의 결실을 확인하세요.
        </p>
      </header>

      <Tabs defaultValue="completion" className="w-full">
        <div className="flex justify-center mb-12">
          <TabsList className="grid grid-cols-3 bg-muted/30 p-2 rounded-[2rem] h-20 w-full max-w-3xl border border-border/50 shadow-inner">
            <TabsTrigger value="completion" className="rounded-[1.5rem] font-black data-[state=active]:bg-white data-[state=active]:shadow-2xl transition-all text-base uppercase tracking-tighter gap-2">
              <Star className="h-4 w-4 text-yellow-500" /> 계획완수 챔피언
            </TabsTrigger>
            <TabsTrigger value="attendance" className="rounded-[1.5rem] font-black data-[state=active]:bg-white data-[state=active]:shadow-2xl transition-all text-base uppercase tracking-tighter gap-2">
              <Zap className="h-4 w-4 text-blue-500" /> 출석 챔피언
            </TabsTrigger>
            <TabsTrigger value="growth" className="rounded-[1.5rem] font-black data-[state=active]:bg-white data-[state=active]:shadow-2xl transition-all text-base uppercase tracking-tighter gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> 성장 챔피언
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="completion" className="mt-0 animate-in fade-in zoom-in-95 duration-500">
          <LeaderboardTab
            title="계획완수 챔피언"
            description="학습 계획 완수율이 가장 높은 최고의 전략가들입니다."
            entries={completionEntries}
            isLoading={completionLoading}
            metricType="completion"
          />
        </TabsContent>
        <TabsContent value="attendance" className="mt-0 animate-in fade-in zoom-in-95 duration-500">
          <LeaderboardTab
            title="출석 챔피언 (3H+)"
            description="일일 3시간 이상 초몰입 학습을 가장 꾸준히 기록한 학생들입니다."
            entries={consistencyEntries}
            isLoading={consistencyLoading}
            metricType="attendance"
          />
        </TabsContent>
        <TabsContent value="growth" className="mt-0 animate-in fade-in zoom-in-95 duration-500">
          <LeaderboardTab
            title="성장 챔피언"
            description="지난 달 대비 성취도가 가장 비약적으로 상승한 성장의 아이콘들입니다."
            entries={growthEntries}
            isLoading={growthLoading}
            metricType="growth"
          />
        </TabsContent>
      </Tabs>

      <footer className="pt-10 flex justify-center opacity-30">
        <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-[0.4em]">
          Powered by StudyTrack Analytical Engine
        </div>
      </footer>
    </div>
  );
}
