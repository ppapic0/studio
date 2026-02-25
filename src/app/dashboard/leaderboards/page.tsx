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
import { format, getISOWeek } from 'date-fns';
import { LeaderboardEntry, WithId } from '@/lib/types';
import { Loader2 } from 'lucide-react';
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
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !entries || entries.length === 0 ? (
          <div className="text-center text-muted-foreground p-8">
            이번 주 리더보드 데이터가 아직 없습니다.
          </div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">순위</TableHead>
              <TableHead>학생</TableHead>
              <TableHead className="text-right">값</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries?.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <div className="font-medium text-lg">{entry.rank}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="hidden h-9 w-9 sm:flex">
                      <AvatarFallback>{entry.displayNameSnapshot.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="font-medium">{entry.displayNameSnapshot}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold">
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
  const periodKey = `${format(new Date(), 'yyyy')}-W${getISOWeek(new Date())}`;

  const completionQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', periodKey, 'completionMaster', 'entries'),
      orderBy('rank', 'asc'),
      limit(10)
    );
  }, [firestore, activeMembership, periodKey]);
  const { data: completionEntries, isLoading: completionLoading } = useCollection<LeaderboardEntry>(completionQuery, { enabled: isMember });

  const consistencyQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', periodKey, 'consistencyLeader', 'entries'),
      orderBy('rank', 'asc'),
      limit(10)
    );
  }, [firestore, activeMembership, periodKey]);
  const { data: consistencyEntries, isLoading: consistencyLoading } = useCollection<LeaderboardEntry>(consistencyQuery, { enabled: isMember });

  const growthQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', periodKey, 'growthChampion', 'entries'),
      orderBy('rank', 'asc'),
      limit(10)
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
    <Tabs defaultValue="completion">
      <div className="flex items-center">
        <TabsList>
          <TabsTrigger value="completion">계획 완수 마스터</TabsTrigger>
          <TabsTrigger value="consistency">꾸준함 리더</TabsTrigger>
          <TabsTrigger value="growth">성장 챔피언</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="completion">
        <LeaderboardTab
          title="계획 완수 마스터"
          description="가중치가 적용된 학습 계획 완수율에 따른 순위입니다."
          entries={completionEntries}
          isLoading={completionLoading}
        />
      </TabsContent>
      <TabsContent value="consistency">
        <LeaderboardTab
          title="꾸준함 리더"
          description="연속 출석일수에 따른 순위입니다."
          entries={consistencyEntries}
          isLoading={consistencyLoading}
        />
      </TabsContent>
      <TabsContent value="growth">
        <LeaderboardTab
          title="성장 챔피언"
          description="학습 시간 증가율에 따른 순위입니다."
          entries={growthEntries}
          isLoading={growthLoading}
        />
      </TabsContent>
    </Tabs>
  );
}
