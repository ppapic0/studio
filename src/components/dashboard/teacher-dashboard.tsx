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
import { mockAtRiskStudents, mockAttendance } from '@/lib/data';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import Link from 'next/link';
import { ArrowUpRight, UserCheck, UserX } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export function TeacherDashboard() {
  const missingAttendance = mockAttendance.filter(a => a.status === '결석' || a.status === '지각').slice(0, 3);
  return (
    <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>총 학생 수</CardDescription>
            <CardTitle className="text-4xl">125</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              지난달 이후 +5
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>주의 학생</CardDescription>
            <CardTitle className="text-4xl text-destructive-foreground dark:text-destructive">
              {mockAtRiskStudents.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              지난주 대비 -1
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>오늘 출석률</CardDescription>
            <CardTitle className="text-4xl">96%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              결석/지각 {mockAttendance.filter(a => a.status !== '출석').length}명
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>개입</CardDescription>
            <CardTitle className="text-4xl">5</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              검토 대기 중
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
                <CardTitle>AI가 식별한 주의 학생</CardTitle>
                <CardDescription>
                학업에 대한 관심 저하 또는 부진의 징후를 보이는 학생들입니다.
                </CardDescription>
            </div>
            <Button asChild size="sm" className="ml-auto gap-1">
                <Link href="#">
                전체 보기
                <ArrowUpRight className="h-4 w-4" />
                </Link>
            </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>학생</TableHead>
                <TableHead>위험 요인</TableHead>
                <TableHead className="hidden md:table-cell">사유</TableHead>
                <TableHead>
                  <span className="sr-only">작업</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockAtRiskStudents.map(({ student, risk, reason }) => (
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
                    <Badge variant="outline" className="border-destructive text-destructive-foreground dark:text-destructive">
                      {risk}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {reason}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      개입하기
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
            <CardHeader className="flex flex-row items-center">
                <div className="grid gap-2">
                    <CardTitle>출석 누락</CardTitle>
                    <CardDescription>
                    오늘 결석 또는 지각으로 표시된 학생들입니다.
                    </CardDescription>
                </div>
                 <Button asChild size="sm" className="ml-auto gap-1">
                    <Link href="/dashboard/attendance">
                    출석부로 가기
                    <ArrowUpRight className="h-4 w-4" />
                    </Link>
                </Button>
            </CardHeader>
            <CardContent>
                {missingAttendance.map(student => (
                    <div key={student.id} className="flex items-center gap-4 mb-4">
                        <Avatar className="hidden h-9 w-9 sm:flex">
                        <AvatarImage src={student.avatarUrl} alt="Avatar" />
                        <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                        <div className="grid gap-1">
                            <p className="text-sm font-medium leading-none">{student.name}</p>
                            <p className="text-sm text-muted-foreground">{student.status}</p>
                        </div>
                        <div className="ml-auto font-medium">
                            <Button variant="outline" size="sm">조정</Button>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
        <Card>
             <CardHeader>
                <CardTitle>개입 대기열</CardTitle>
                <CardDescription>
                AI가 제안한 개입이 검토를 기다리고 있습니다.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
                <Alert className="alert-warning">
                    <UserX className="h-4 w-4" />
                    <AlertTitle>낮은 완수율</AlertTitle>
                    <AlertDescription>
                        <strong>클로이 킴:</strong> 학습 계획을 단순화하도록 제안하세요.
                    </AlertDescription>
                </Alert>
                 <Alert className="alert-warning">
                    <UserX className="h-4 w-4" />
                    <AlertTitle>잦은 결석</AlertTitle>
                    <AlertDescription>
                       <strong>레오 마르티네즈:</strong> 확인 대화를 권장합니다.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
      </div>

    </div>
  );
}
