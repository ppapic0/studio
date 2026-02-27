
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowUpRight, UserX, Loader2, Armchair, MessageSquare, TrendingUp, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { type StudentProfile, type AttendanceCurrent, type Appointment } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function TeacherDashboard({ isActive }: { isActive: boolean }) {
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();

  const centerId = activeMembership?.id;
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  // 1. 학생 데이터 조회
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'students'), orderBy('seatNo', 'asc'));
  }, [firestore, centerId]);
  const { data: students, isLoading: studentsLoading } = useCollection<StudentProfile>(studentsQuery, { enabled: isActive });

  // 2. 실시간 출결 데이터 조회
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery, { enabled: isActive });

  // 3. 오늘 상담 예약 조회
  const appointmentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'appointments'),
      where('status', '==', 'confirmed'),
      limit(5)
    );
  }, [firestore, centerId]);
  const { data: appointments, isLoading: aptLoading } = useCollection<Appointment>(appointmentsQuery, { enabled: isActive });

  if (!isActive) return null;

  const totalStudents = students?.length ?? 0;
  const studyingCount = attendanceList?.filter(a => a.status === 'studying').length ?? 0;

  return (
    <div className="flex flex-col gap-8">
      {/* 주요 지표 요약 */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-3xl border-none shadow-md bg-white">
          <CardHeader className="p-6 pb-2">
            <CardDescription className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">현재 학습 중</CardDescription>
            <CardTitle className="text-3xl font-black text-emerald-500">{studyingCount}</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-[10px] font-bold text-muted-foreground">총 {totalStudents}명 중</div>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-none shadow-md bg-white">
          <CardHeader className="p-6 pb-2">
            <CardDescription className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">평균 완수율</CardDescription>
            <CardTitle className="text-3xl font-black text-primary">82%</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-[10px] font-bold text-emerald-500">+5% vs 어제</div>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-none shadow-md bg-white">
          <CardHeader className="p-6 pb-2">
            <CardDescription className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">상담 대기</CardDescription>
            <CardTitle className="text-3xl font-black text-amber-500">3</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-[10px] font-bold text-muted-foreground">확정된 일정 기준</div>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-none shadow-md bg-primary text-primary-foreground">
          <CardHeader className="p-6 pb-2">
            <CardDescription className="text-xs font-black uppercase tracking-widest opacity-60">오늘의 피드백</CardDescription>
            <CardTitle className="text-3xl font-black">12/45</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-[10px] font-bold opacity-80">발송 완료 현황</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* 실시간 좌석 현황 */}
        <Card className="lg:col-span-2 rounded-[2rem] border-none shadow-xl overflow-hidden bg-white">
          <CardHeader className="bg-muted/20 border-b p-8">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <Armchair className="h-5 w-5 text-primary" /> 실시간 좌석 현황
                </CardTitle>
                <CardDescription className="font-bold">현재 센터 내 학생들의 활동 상태입니다.</CardDescription>
              </div>
              <Button asChild variant="outline" className="rounded-xl font-bold border-2">
                <Link href="/dashboard/attendance">상세 출석부</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            {studentsLoading || attendanceLoading ? (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {[...Array(16)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {students?.map((student) => {
                  const status = attendanceList?.find(a => a.id === student.id)?.status || 'absent';
                  return (
                    <Link key={student.id} href={`/dashboard/teacher/students/${student.id}`}>
                      <div className={cn(
                        "aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95 group relative",
                        status === 'studying' ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm" : 
                        status === 'away' ? "bg-amber-50 border-amber-200 text-amber-700" :
                        "bg-muted/20 border-dashed border-muted text-muted-foreground"
                      )}>
                        <span className="text-[9px] font-black opacity-60">{student.seatNo}</span>
                        <span className="text-xs font-black">{student.name}</span>
                        {status === 'studying' && (
                          <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          {/* 오늘 상담 일정 */}
          <Card className="rounded-[2rem] border-none shadow-xl bg-white overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-black flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" /> 오늘 상담 예약
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {aptLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : 
               !appointments || appointments.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-xs font-bold">오늘 예정된 상담이 없습니다.</div>
              ) : (
                appointments.map((apt) => (
                  <div key={apt.id} className="p-4 rounded-2xl bg-muted/20 border flex justify-between items-center group hover:border-primary transition-all">
                    <div className="grid gap-0.5">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest">{format(apt.startAt.toDate(), 'p')}</span>
                      <span className="text-sm font-bold text-foreground">{apt.studentName} 학생</span>
                    </div>
                    <Button size="icon" variant="ghost" className="rounded-xl group-hover:bg-primary group-hover:text-white" asChild>
                      <Link href={`/dashboard/teacher/students/${apt.studentId}`}>
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* AI 분석 요약 */}
          <Card className="rounded-[2rem] border-none shadow-xl bg-gradient-to-br from-accent to-accent/80 text-white overflow-hidden relative group">
            <TrendingUp className="absolute bottom-[-20px] right-[-20px] h-32 w-32 opacity-10 group-hover:scale-110 transition-transform duration-700" />
            <CardHeader>
              <CardTitle className="text-lg font-black">AI 학습 분석</CardTitle>
              <CardDescription className="text-white/70 font-bold">현재 주의가 필요한 학생</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-white/10 border-white/20 text-white rounded-2xl">
                <UserX className="h-4 w-4 text-white" />
                <AlertTitle className="text-xs font-black">집중도 하락 감지</AlertTitle>
                <AlertDescription className="text-[10px] font-bold opacity-90 mt-1">
                  이소피아 학생의 이번 주 평균 몰입 시간이 전주 대비 15% 감소했습니다.
                </AlertDescription>
              </Alert>
              <Button className="w-full bg-white text-accent hover:bg-white/90 rounded-xl font-black text-xs">전체 분석 보기</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
