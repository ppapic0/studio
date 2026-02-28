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
import { Loader2, Trophy, AlertCircle } from 'lucide-react';
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
  return (
    <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden bg-white">
      <CardHeader className="bg-muted/10 pb-6 border-b">
        <CardTitle className="flex items-center gap-2 text-xl font-black">
          <Trophy className={cn("h-6 w-6", 
            metricType === 'completion' ? "text-yellow-500" : 
            metricType === 'attendance' ? "text-blue-500" : "text-emerald-500"
          )} />
          {title}
        </CardTitle>
        <CardDescription className="font-bold">{description}</CardDescription>
        {metricType === 'attendance' && (
          <div className="mt-4 text-[11px] text-destructive flex items-center gap-2 bg-destructive/5 p-3 rounded-xl border border-destructive/10 font-bold">
            <AlertCircle className="h-4 w-4" />
            일일 학습 3시간(180분) 이상 달성 시에만 출석 일수로 인정됩니다.
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
          </div>
        ) : !entries || entries.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center gap-4">
            <Trophy className="h-16 w-16 text-muted-foreground opacity-10" />
            <p className="text-sm font-bold text-muted-foreground/40">이번 시즌 랭킹 데이터가 아직 없습니다.<br/>첫 기록을 남겨보세요!</p>
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b">
              <TableHead className="w-[100px] font-black text-center">순위</TableHead>
              <TableHead className="font-black">학생</TableHead>
              <TableHead className="text-right font-black pr-8">성취도</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries?.map((entry) => (
              <TableRow key={entry.id} className={cn("hover:bg-muted/5 transition-colors border-b", entry.rank <= 3 ? "bg-primary/5" : "")}>
                <TableCell className="text-center">
                  <div className={cn(
                    "mx-auto font-black text-sm flex items-center justify-center h-8 w-8 rounded-xl shadow-sm",
                    entry.rank === 1 ? "bg-yellow-400 text-white" : 
                    entry.rank === 2 ? "bg-slate-300 text-white" : 
                    entry.rank === 3 ? "bg-orange-400 text-white" : "bg-muted/50 text-muted-foreground"
                  )}>
                    {entry.rank}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                      <AvatarFallback className="font-black text-primary bg-primary/5">
                        {entry.displayNameSnapshot?.charAt(0) || 'S'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="font-black tracking-tight">{entry.displayNameSnapshot}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right pr-8">
                  <div className="flex flex-col items-end">
                    <span className="text-lg font-black text-primary tabular-nums">
                      {entry.value.toLocaleString()}{metricType === 'attendance' ? '일' : '%'}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Mastery Value</span>
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

  // Segments count check: 1(centers) 2(id) 3(leaderboards) 4(docId) 5(entries) = 5 (Valid Odd Number)
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
        <Alert className="rounded-[2rem] border-none shadow-xl bg-white p-8">
          <AlertTitle className="text-xl font-black mb-2">멤버십 확인 필요</AlertTitle>
          <AlertDescription className="font-bold text-muted-foreground">
            리더보드를 확인하려면 먼저 센터에 가입해야 합니다.
          </AlertDescription>
        </Alert>
    )
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter">시즌 명예의 전당</h1>
        </div>
        <p className="text-muted-foreground font-bold ml-1">{format(new Date(), 'yyyy년 M월')} 시즌 실시간 랭킹입니다.</p>
      </div>

      <Tabs defaultValue="completion" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-muted/30 p-1.5 rounded-[1.5rem] h-16 mb-8 border border-border/50 shadow-inner">
          <TabsTrigger value="completion" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all text-sm">완수 마스터</TabsTrigger>
          <TabsTrigger value="consistency" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all text-sm">출석 킹</TabsTrigger>
          <TabsTrigger value="growth" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all text-sm">성장 챔피언</TabsTrigger>
        </TabsList>
        <TabsContent value="completion" className="mt-0">
          <LeaderboardTab
            title="월간 완수 마스터"
            description="학습 계획 완수율이 가장 높은 학생들입니다."
            entries={completionEntries}
            isLoading={completionLoading}
            metricType="completion"
          />
        </TabsContent>
        <TabsContent value="consistency" className="mt-0">
          <LeaderboardTab
            title="월간 출석 킹 (3h+)"
            description="3시간 이상 몰입한 날이 가장 많은 학생들입니다."
            entries={consistencyEntries}
            isLoading={consistencyLoading}
            metricType="attendance"
          />
        </TabsContent>
        <TabsContent value="growth" className="mt-0">
          <LeaderboardTab
            title="월간 성장 챔피언"
            description="지난 달 대비 성취도가 가장 비약적으로 상승한 학생들입니다."
            entries={growthEntries}
            isLoading={growthLoading}
            metricType="growth"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
