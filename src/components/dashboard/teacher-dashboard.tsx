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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import Link from 'next/link';
import { ArrowUpRight, UserX, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, limit, collectionGroup } from 'firebase/firestore';
import { format } from 'date-fns';
import { type AIOutput, type CenterMembership, type AttendanceRecord } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

export function TeacherDashboard({ isActive }: { isActive: boolean }) {
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
  const { data: students, isLoading: studentsLoading } = useCollection<CenterMembership>(studentsQuery, { enabled: isActive });
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
  const { data: atRiskStudents, isLoading: atRiskLoading } = useCollection<AIOutput & { studentName?: string }>(atRiskQuery, { enabled: isActive });

  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'attendanceRecords', todayKey, 'students'),
      where('status', '!=', 'confirmed_present')
    );
  }, [firestore, activeMembership, todayKey]);
  const { data: missingAttendance, isLoading: attendanceLoading } = useCollection<AttendanceRecord>(attendanceQuery, { enabled: isActive });

  if (!isActive) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      {/* Stats Summary - Responsive columns */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-2">
            <CardDescription className="text-xs sm:text-sm">총 학생 수</CardDescription>
            {studentsLoading ? <Skeleton className="h-8 w-12" /> : <CardTitle className="text-2xl sm:text-3xl">{studentCount}</CardTitle>}
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-[10px] sm:text-xs text-muted-foreground">활성 멤버 기준</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-2">
            <CardDescription className="text-xs sm:text-sm">주의 학생</CardDescription>
            {atRiskLoading ? <Skeleton className="h-8 w-12" /> : 
              <CardTitle className="text-2xl sm:text-3xl text-destructive">
                {atRiskStudents?.length ?? 0}
              </CardTitle>
            }
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
             <div className="text-[10px] sm:text-xs text-muted-foreground">AI 식별됨</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-2">
            <CardDescription className="text-xs sm:text-sm">출석률</CardDescription>
             {attendanceLoading || studentsLoading ? <Skeleton className="h-8 w-16" /> : 
              <CardTitle className="text-2xl sm:text-3xl">
                {studentCount > 0 ? Math.round(((studentCount - (missingAttendance?.length ?? 0)) / studentCount) * 100) : 100}%
              </CardTitle>
            }
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-[10px] sm:text-xs text-muted-foreground">
              결/지 {missingAttendance?.length ?? 0}명
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-2">
            <CardDescription className="text-xs sm:text-sm">검토 대기</CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">2</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-[10px] sm:text-xs text-muted-foreground">
              개입 대기 중
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid - Tablet optimized */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-1">
              <CardTitle className="text-lg sm:text-xl">AI 주의 학생 식별</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                학업 부진 징후 학생입니다.
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost" className="ml-auto h-8 px-2">
                <Link href="#">
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-x-auto">
            {atRiskLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-10"/> :
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">학생</TableHead>
                  <TableHead className="text-xs">요인</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atRiskStudents?.map((risk) => (
                  <TableRow key={risk.id}>
                    <TableCell className="py-2 text-sm font-medium">
                      {students?.find(s => s.id === risk.studentId)?.displayName ?? '학생'}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className="text-[10px] border-destructive text-destructive whitespace-nowrap">
                        {risk.message.split('.')[0] || '위험 감지'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Button variant="outline" size="xs" className="h-7 text-[10px] px-2">개입</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            }
          </CardContent>
        </Card>
        
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-1">
              <CardTitle className="text-lg sm:text-xl">출석 누락 현황</CardTitle>
              <CardDescription className="text-xs sm:text-sm">오늘의 결석/지각 학생</CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost" className="ml-auto h-8 px-2">
                <Link href="/dashboard/attendance">
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex-1">
            {attendanceLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-10"/> :
              missingAttendance?.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">현재 누락된 출석이 없습니다.</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {missingAttendance?.slice(0, 4).map(student => (
                      <div key={student.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-[10px]">{student.studentName?.charAt(0) ?? '?'}</AvatarFallback>
                          </Avatar>
                          <div className="grid gap-0.5">
                              <p className="text-sm font-medium leading-none">{student.studentName ?? '알 수 없음'}</p>
                              <p className="text-[10px] text-muted-foreground uppercase">{student.status.replace('confirmed_', '')}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="ml-auto h-7 text-[10px]">확인</Button>
                      </div>
                  ))}
                </div>
              )
            }
          </CardContent>
        </Card>

        {/* Intervention Queue - Full width on tablet, half on desktop */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">AI 개입 제안 대기열</CardTitle>
            <CardDescription className="text-xs sm:text-sm">검토 후 실행 가능한 맞춤형 조치입니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Alert className="bg-warning/30 border-warning">
                <UserX className="h-4 w-4 text-accent" />
                <AlertTitle className="text-sm font-semibold">학습 계획 조정 권고</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                    <strong>김재윤:</strong> 최근 완수율 하락. 과제를 소분하도록 안내가 필요합니다.
                </AlertDescription>
            </Alert>
            <Alert className="bg-warning/30 border-warning">
                <UserX className="h-4 w-4 text-accent" />
                <AlertTitle className="text-sm font-semibold">출석 패턴 이상</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                    <strong>이소피아:</strong> 불규칙한 지각 빈도가 증가하고 있습니다. 면담을 권장합니다.
                </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}