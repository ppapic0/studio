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
              <TableHead className="w-[80px]">Rank</TableHead>
              <TableHead>Student</TableHead>
              <TableHead className="text-right">Value</TableHead>
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
          <TabsTrigger value="completion">Completion Master</TabsTrigger>
          <TabsTrigger value="consistency">Consistency Leader</TabsTrigger>
          <TabsTrigger value="growth">Growth Champion</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="completion">
        <LeaderboardTab
          title="Completion Master"
          description="Ranking based on weighted completion of study plans."
          data={mockLeaderboards.completionMaster}
        />
      </TabsContent>
      <TabsContent value="consistency">
        <LeaderboardTab
          title="Consistency Leader"
          description="Ranking based on attendance streaks."
          data={mockLeaderboards.consistencyLeader}
        />
      </TabsContent>
      <TabsContent value="growth">
        <LeaderboardTab
          title="Growth Champion"
          description="Ranking based on the growth of study time."
          data={mockLeaderboards.growthChampion}
        />
      </TabsContent>
    </Tabs>
  );
}
