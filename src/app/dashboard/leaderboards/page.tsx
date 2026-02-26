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
import { Loader2, Trophy } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type LeaderboardTabProps = {
  title: string;
  description: string;
  entries: WithId<LeaderboardEntry>[] | null;
  isLoading: boolean;
};

function LeaderboardTab({ title, description, entries, isLoading }: LeaderboardTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !entries || entries.length === 0 ? (
          <div className="text-center text-muted-foreground p-8">
            이번 시즌 랭킹 데이터가 아직 없습니다. 첫 기록을 남겨보세요!
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">순위</TableHead>
              <TableHead>학생</TableHead>
              <TableHead className="text-right">점수</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries?.map((entry) => (
              <TableRow key={entry.id} className={entry.rank <= 3 ? "bg-accent/5" : ""}>
                <TableCell>
                  <div className={cn(
                    "font-bold text-lg flex items-center justify-center h-8 w-8 rounded-full",
                    entry.rank === 1 ? "bg-yellow-400 text-white" : 
                    entry.rank === 2 ? "bg-gray-300 text-white" : 
                    entry.rank === 3 ? "bg-orange-400 text-white" : ""
                  )}>
                    {entry.rank}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{entry.displayNameSnapshot.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="font-medium">{entry.displayNameSnapshot}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-primary">
                  {entry.value.toLocaleString()}
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
  // 매달 1일 초기화되는 월간 시즌 키 (YYYY-MM)
  const periodKey = format(new Date(), 'yyyy-MM');

  const completionQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', periodKey, 'monthlyCompletion', 'entries'),
      orderBy('rank', 'asc'),
      limit(20)
    );
  }, [firestore, activeMembership, periodKey]);
  const { data: completionEntries, isLoading: completionLoading } = useCollection<LeaderboardEntry>(completionQuery, { enabled: isMember });

  const consistencyQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', periodKey, 'monthlyAttendance', 'entries'),
      orderBy('rank', 'asc'),
      limit(20)
    );
  }, [firestore, activeMembership, periodKey]);
  const { data: consistencyEntries, isLoading: consistencyLoading } = useCollection<LeaderboardEntry>(consistencyQuery, { enabled: isMember });

  const growthQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', periodKey, 'monthlyGrowth', 'entries'),
      orderBy('rank', 'asc'),
      limit(20)
    );
  }, [firestore, activeMembership, periodKey]);
  const { data: growthEntries, isLoading: growthLoading } = useCollection<LeaderboardEntry>(growthQuery, { enabled: isMember });

  if (!isMember) {
    return (
        <Alert>
          <AlertTitle>멤버십 필요</AlertTitle>
          <AlertDescription>
            리더보드를 보려면 센터에 가입해야 합니다.
          </AlertDescription>
        </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-headline font-bold">시즌 랭킹</h1>
        <p className="text-muted-foreground">{format(new Date(), 'yyyy년 M월')} 시즌 명예의 전당입니다.</p>
      </div>

      <Tabs defaultValue="completion" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="completion">완수 마스터</TabsTrigger>
          <TabsTrigger value="consistency">출석 킹</TabsTrigger>
          <TabsTrigger value="growth">성장 챔피언</TabsTrigger>
        </TabsList>
        <TabsContent value="completion" className="mt-4">
          <LeaderboardTab
            title="월간 완수 마스터"
            description="이번 시즌 학습 계획 완수율이 가장 높은 학생들입니다."
            entries={completionEntries}
            isLoading={completionLoading}
          />
        </TabsContent>
        <TabsContent value="consistency" className="mt-4">
          <LeaderboardTab
            title="월간 출석 킹"
            description="이번 시즌 가장 성실하게 등원한 학생들입니다."
            entries={consistencyEntries}
            isLoading={consistencyLoading}
          />
        </TabsContent>
        <TabsContent value="growth" className="mt-4">
          <LeaderboardTab
            title="월간 성장 챔피언"
            description="지난 달 대비 학습 능력이 가장 비약적으로 상승한 학생들입니다."
            entries={growthEntries}
            isLoading={growthLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}