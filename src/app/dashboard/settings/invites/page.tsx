import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { mockInviteCodes } from '@/lib/data';
import { PlusCircle } from 'lucide-react';

export default function InviteCodesPage() {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case '활성':
        return 'default';
      case '만료됨':
        return 'destructive';
      case '소진됨':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>초대 코드</CardTitle>
          <CardDescription>
            신규 회원 등록을 위한 초대 코드를 관리합니다.
          </CardDescription>
        </div>
        <Button size="sm" className="gap-1">
          <PlusCircle className="h-4 w-4" />
          새 코드 생성
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>코드</TableHead>
              <TableHead>역할</TableHead>
              <TableHead>사용 횟수</TableHead>
              <TableHead>만료일</TableHead>
              <TableHead>상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockInviteCodes.map((invite) => (
              <TableRow key={invite.code}>
                <TableCell className="font-mono">{invite.code}</TableCell>
                <TableCell>{invite.role}</TableCell>
                <TableCell>{invite.uses}</TableCell>
                <TableCell>{invite.expires}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(invite.status) as any}>
                    {invite.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
