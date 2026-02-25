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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { mockLeaderboards } from '@/lib/data';

type LeaderboardTabProps = {
  title: string;
  description: string;
  data: { rank: number; name: string; value: string; avatarUrl: string }[];
};

function LeaderboardTab({ title, description, data }: LeaderboardTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">순위</TableHead>
              <TableHead>학생</TableHead>
              <TableHead className="text-right">값</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((entry) => (
              <TableRow key={entry.rank}>
                <TableCell>
                  <div className="font-medium text-lg">{entry.rank}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="hidden h-9 w-9 sm:flex">
                      <AvatarImage src={entry.avatarUrl} alt="Avatar" />
                      <AvatarFallback>{entry.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="font-medium">{entry.name}</div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {entry.value}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function LeaderboardsPage() {
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
          data={mockLeaderboards.completionMaster}
        />
      </TabsContent>
      <TabsContent value="consistency">
        <LeaderboardTab
          title="꾸준함 리더"
          description="연속 출석일수에 따른 순위입니다."
          data={mockLeaderboards.consistencyLeader}
        />
      </TabsContent>
      <TabsContent value="growth">
        <LeaderboardTab
          title="성장 챔피언"
          description="학습 시간 증가율에 따른 순위입니다."
          data={mockLeaderboards.growthChampion}
        />
      </TabsContent>
    </Tabs>
  );
}
