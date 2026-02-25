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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import Link from 'next/link';
import { ArrowUpRight, UserCheck, UserX, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, limit, orderBy, collectionGroup } from 'firebase/firestore';
import { format } from 'date-fns';
import { type AIOutput, type WithId, type CenterMembership, type AttendanceRecord } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

export function TeacherDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();

  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'members'),
      where('role', '==', 'student'),
      where('status', '==', 'active')
    );
  }, [firestore, activeMembership]);
  const { data: students, isLoading: studentsLoading } = useCollection<CenterMembership>(studentsQuery);
  const studentCount = students?.length ?? 0;

  const atRiskQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collectionGroup(firestore, 'records'),
      where('centerId', '==', activeMembership.id),
      where('type', '==', 'riskFlag'),
      limit(5)
    );
  }, [firestore, activeMembership]);
  const { data: atRiskStudents, isLoading: atRiskLoading } = useCollection<AIOutput & { studentName?: string }>(atRiskQuery);

  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'attendanceRecords', todayKey, 'students'),
      where('status', '!=', 'confirmed_present')
    );
  }, [firestore, activeMembership, todayKey]);
  const { data: missingAttendance, isLoading: attendanceLoading } = useCollection<AttendanceRecord>(attendanceQuery);

  return (
    <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>총 학생 수</CardDescription>
            {studentsLoading ? <Skeleton className="h-10 w-16" /> : <CardTitle className="text-4xl">{studentCount}</CardTitle>}
          </CardHeader>
          <CardContent>
            {studentsLoading ? <Skeleton className="h-4 w-24" /> : <div className="text-xs text-muted-foreground">활성 멤버 기준</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>주의 학생</CardDescription>
            {atRiskLoading ? <Skeleton className="h-10 w-12" /> : 
              <CardTitle className="text-4xl text-destructive-foreground dark:text-destructive">
                {atRiskStudents?.length ?? 0}
              </CardTitle>
            }
          </CardHeader>
          <CardContent>
             {atRiskLoading ? <Skeleton className="h-4 w-24" /> : <div className="text-xs text-muted-foreground">AI 식별됨</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>오늘 출석률</CardDescription>
             {attendanceLoading || studentsLoading ? <Skeleton className="h-10 w-20" /> : 
              <CardTitle className="text-4xl">
                {studentCount > 0 ? Math.round(((studentCount - (missingAttendance?.length ?? 0)) / studentCount) * 100) : 100}%
              </CardTitle>
            }
          </CardHeader>
          <CardContent>
            {attendanceLoading ? <Skeleton className="h-4 w-28" /> : 
            <div className="text-xs text-muted-foreground">
              결석/지각 {missingAttendance?.length ?? 0}명
            </div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>개입</CardDescription>
            <CardTitle className="text-4xl">0</CardTitle>
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
          {atRiskLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto"/> :
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>학생</TableHead>
                <TableHead>위험 요인</TableHead>
                <TableHead>
                  <span className="sr-only">작업</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {atRiskStudents?.map((risk) => (
                <TableRow key={risk.id}>
                  <TableCell>
                    <div className="font-medium">{students?.find(s => s.id === risk.studentId)?.displayName ?? risk.studentId}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-destructive text-destructive-foreground dark:text-destructive">
                      {JSON.parse(risk.basedOnMetricsSnapshot).riskReasons?.[0] || '위험 감지'}
                    </Badge>
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
        }
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
                {attendanceLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto"/> :
                 missingAttendance?.map(student => (
                    <div key={student.id} className="flex items-center gap-4 mb-4">
                        <Avatar className="hidden h-9 w-9 sm:flex">
                        {/* <AvatarImage src={student.avatarUrl} alt="Avatar" /> */}
                        <AvatarFallback>{student.studentName?.charAt(0) ?? '?'}</AvatarFallback>
                      </Avatar>
                        <div className="grid gap-1">
                            <p className="text-sm font-medium leading-none">{student.studentName ?? student.id}</p>
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
