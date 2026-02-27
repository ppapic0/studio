'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowUpRight, Armchair, MessageSquare, TrendingUp, Users, Loader2, Zap, ChevronRight, AlertCircle } from 'lucide-react';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import { type StudentProfile, type AttendanceCurrent } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function TeacherDashboard({ isActive }: { isActive: boolean }) {
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();

  const centerId = activeMembership?.id;

  // 1. 학생 데이터 (실시간)
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'students'), orderBy('seatNo', 'asc'));
  }, [firestore, centerId]);
  const { data: students, isLoading: studentsLoading } = useCollection<StudentProfile>(studentsQuery, { enabled: isActive });

  // 2. 실시간 출결 상태
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery, { enabled: isActive });

  // 3. 오늘 상담 예약
  const reservationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    const start = Timestamp.fromDate(startOfDay(new Date()));
    const end = Timestamp.fromDate(endOfDay(new Date()));
    return query(
      collection(firestore, 'centers', centerId, 'counselingReservations'),
      where('scheduledAt', '>=', start),
      where('scheduledAt', '<=', end),
      orderBy('scheduledAt', 'asc')
    );
  }, [firestore, centerId]);
  const { data: reservations, isLoading: resLoading } = useCollection<any>(reservationsQuery, { enabled: isActive });

  if (!isActive) return null;

  const totalStudents = students?.length ?? 0;
  const studyingCount = attendanceList?.filter(a => a.status === 'studying').length ?? 0;

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* 주요 지표 카드 섹션 */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-3xl border-none shadow-md bg-white overflow-hidden group">
          <CardHeader className="p-6 pb-2">
            <div className="flex justify-between items-start">
              <CardDescription className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">현재 학습 중</CardDescription>
              <div className="p-2 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
                <Users className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <CardTitle className="text-4xl font-black text-emerald-500 mt-2">{studyingCount}</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-[10px] font-bold text-muted-foreground">정원 {totalStudents}명 대비 {totalStudents > 0 ? Math.round((studyingCount / totalStudents) * 100) : 0}%</div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-none shadow-md bg-white overflow-hidden">
          <CardHeader className="p-6 pb-2">
            <CardDescription className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">오늘 상담 예약</CardDescription>
            <CardTitle className="text-4xl font-black text-primary mt-2">{reservations?.length ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-[10px] font-bold text-primary/60">확정된 일정 기준</div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-none shadow-md bg-white overflow-hidden">
          <CardHeader className="p-6 pb-2">
            <CardDescription className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">평균 완수율</CardDescription>
            <CardTitle className="text-4xl font-black text-amber-500 mt-2">88%</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-[10px] font-bold text-amber-600/60">전주 대비 +4%</div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-none shadow-md bg-primary text-primary-foreground overflow-hidden">
          <CardHeader className="p-6 pb-2">
            <CardDescription className="text-xs font-black uppercase tracking-widest opacity-60">좌석 점유율</CardDescription>
            <CardTitle className="text-4xl font-black mt-2">92%</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-[10px] font-bold opacity-80">만석까지 4석 남음</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
          <CardHeader className="bg-muted/20 border-b p-8">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-black flex items-center gap-3">
                  <Armchair className="h-6 w-6 text-primary" /> 실시간 좌석 현황
                </CardTitle>
                <CardDescription className="font-bold mt-1 text-sm text-muted-foreground">좌석을 클릭하면 학생의 상세 학습 데이터를 확인합니다.</CardDescription>
              </div>
              <Button asChild variant="outline" className="rounded-2xl font-black border-2 h-12 px-6">
                <Link href="/dashboard/teacher/students">학생 전체 목록</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            {studentsLoading || attendanceLoading ? (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
                {[...Array(16)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
                {students?.map((student) => {
                  const status = attendanceList?.find(a => a.id === student.id)?.status || 'absent';
                  return (
                    <Link key={student.id} href={`/dashboard/teacher/students/${student.id}`}>
                      <div className={cn(
                        "aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all duration-300 hover:scale-110 active:scale-95 group relative shadow-sm",
                        status === 'studying' ? "bg-emerald-50 border-emerald-400 text-emerald-700" : 
                        status === 'away' ? "bg-amber-50 border-amber-400 text-amber-700" :
                        status === 'break' ? "bg-blue-50 border-blue-400 text-blue-700" :
                        "bg-muted/10 border-dashed border-muted text-muted-foreground"
                      )}>
                        <span className="text-[10px] font-black opacity-50">{student.seatNo}</span>
                        <span className="text-xs font-black">{student.name}</span>
                        {status === 'studying' && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
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
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl font-black flex items-center gap-3">
                <MessageSquare className="h-6 w-6 text-primary" /> 오늘 상담
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8 space-y-4">
              {resLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /> : 
               !reservations || reservations.length === 0 ? (
                <div className="py-12 text-center bg-muted/20 rounded-3xl border-2 border-dashed">
                  <p className="text-xs font-black text-muted-foreground/60">오늘 예정된 상담이 없습니다.</p>
                </div>
              ) : (
                reservations.map((res: any) => (
                  <div key={res.id} className="p-5 rounded-3xl bg-muted/20 border-2 border-transparent hover:border-primary/30 transition-all flex justify-between items-center group">
                    <div className="grid gap-1">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest">{res.scheduledAt ? format(res.scheduledAt.toDate(), 'p') : '시간 미정'}</span>
                      <span className="text-base font-black text-foreground">{res.studentName || '학생'}</span>
                    </div>
                    <Button size="icon" variant="ghost" className="rounded-2xl group-hover:bg-primary group-hover:text-white transition-all shadow-sm" asChild>
                      <Link href={`/dashboard/teacher/students/${res.studentId}`}>
                        <ChevronRight className="h-5 w-5" />
                      </Link>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border-none shadow-xl bg-gradient-to-br from-accent to-accent/80 text-white overflow-hidden relative group">
            <TrendingUp className="absolute bottom-[-30px] right-[-30px] h-48 w-48 opacity-10 group-hover:scale-110 transition-transform duration-700" />
            <CardHeader className="p-8">
              <div className="bg-white/20 w-fit p-2 rounded-xl mb-2">
                <Zap className="h-5 w-5 text-white fill-white" />
              </div>
              <CardTitle className="text-2xl font-black tracking-tighter">AI 학습 분석</CardTitle>
              <CardDescription className="text-white/70 font-bold mt-1">오늘 집중 관리가 필요한 학생</CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-5 mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-2 w-2 rounded-full bg-red-400 animate-ping" />
                  <span className="text-xs font-black">몰입 시간 급감 감지</span>
                </div>
                <p className="text-sm font-bold leading-relaxed">
                  일부 학생의 이번 주 집중도가 지난주 평균 대비 <span className="text-red-300">15% 하락</span>했습니다.
                </p>
              </div>
              <Button className="w-full h-12 bg-white text-accent hover:bg-white/90 rounded-2xl font-black text-sm shadow-lg">전체 리포트 확인</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}