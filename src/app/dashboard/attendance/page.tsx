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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { mockAttendance } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';

export default function AttendancePage() {
  const today = format(new Date(), 'yyyy년 MM월 dd일');

  const getBadgeVariant = (status: string) => {
    switch (status) {
      case '출석':
        return 'default';
      case '결석':
        return 'destructive';
      case '지각':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>학생 출석</CardTitle>
        <CardDescription>
          {today}의 출석을 관리하고 검토합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>학생</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="hidden md:table-cell">출석 시간</TableHead>
              <TableHead>
                <span className="sr-only">작업</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockAttendance.map((student) => (
              <TableRow key={student.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="hidden h-9 w-9 sm:flex">
                      <AvatarImage src={student.avatarUrl} alt="Avatar" />
                      <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="font-medium">{student.name}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getBadgeVariant(student.status) as any}>
                    {student.status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {student.status === '출석' || student.status === '지각'
                    ? '9:05 AM'
                    : 'N/A'}
                </TableCell>
                <TableCell>
                  <Select defaultValue={student.status}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="상태 설정" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="출석">출석</SelectItem>
                      <SelectItem value="지각">지각</SelectItem>
                      <SelectItem value="결석">결석</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
