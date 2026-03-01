
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { 
  Users, 
  Clock, 
  MessageSquare, 
  Armchair, 
  ChevronRight, 
  Loader2, 
  AlertCircle,
  Monitor,
  Activity,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { AttendanceCurrent, StudentProfile } from '@/lib/types';
import { format, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

export default function TeacherHomePage() {
  const { activeMembership } = useAppContext();
  const firestore = useFirestore();

  const centerId = activeMembership?.id;

  // 1. 오늘 출결 현황
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery);

  // 2. 학생 리스트
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'students'), orderBy('seatNo', 'asc'));
  }, [firestore, centerId]);
  const { data: students, isLoading: studentsLoading } = useCollection<StudentProfile>(studentsQuery);

  // 3. 오늘 상담 예약
  const appointmentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    const todayDate = new Date();
    return query(
      collection(firestore, 'centers', centerId, 'counselingReservations'),
      where('scheduledAt', '>=', Timestamp.fromDate(startOfDay(todayDate))),
      where('scheduledAt', '<=', Timestamp.fromDate(endOfDay(todayDate)))
    );
  }, [firestore, centerId]);
  const { data: rawAppointments, isLoading: aptLoading } = useCollection<any>(appointmentsQuery);

  const appointments = useMemo(() => {
    if (!rawAppointments) return [];
    return [...rawAppointments].sort((a, b) => a.scheduledAt?.toMillis() - b.scheduledAt?.toMillis());
  }, [rawAppointments]);

  const isLoading = attendanceLoading || studentsLoading || aptLoading;

  const stats = useMemo(() => {
    const studying = attendanceList?.filter(a => a.status === 'studying').length || 0;
    const alert = attendanceList?.filter(a => a.studentId && a.status === 'absent').length || 0;
    return { studying, alert };
  }, [attendanceList]);

  return (
    <div className="flex flex-col gap-6 md:gap-8 max-w-5xl mx-auto">
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-3xl font-black tracking-tighter text-primary">센터 관제 센터</h1>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60">Real-time Dashboard</p>
      </header>

      {/* 퀵 지표 섹션 */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border-none shadow-md bg-emerald-50/50">
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <Activity className="h-3 w-3" />
              <span className="text-[10px] font-black uppercase">학습 중</span>
            </div>
            <div className="text-2xl font-black text-emerald-700">{stats.studying}<span className="text-xs ml-0.5 opacity-60">명</span></div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-md bg-rose-50/50">
          <CardContent className="p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-rose-600 mb-1">
              <AlertCircle className="h-3 w-3" />
              <span className="text-[10px] font-black uppercase">미입실</span>
            </div>
            <div className="text-2xl font-black text-rose-700">{stats.alert}<span className="text-xs ml-0.5 opacity-60">명</span></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6">
        {/* 좌석 및 실시간 출결 섹션 - 모바일 최우선 */}
        <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white ring-1 ring-border/50">
          <CardHeader className="bg-muted/10 border-b p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <Armchair className="h-5 w-5 text-primary" /> 좌석 및 실시간 출결
                </CardTitle>
                <CardDescription className="text-[10px] font-bold text-muted-foreground">센터 좌석 현황을 실시간으로 확인합니다.</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="rounded-full h-8 px-3 text-[10px] font-black hover:bg-primary/5">
                <Link href="/dashboard/teacher/layout-view">전체 도면 보기</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-5 sm:p-8">
            {isLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
            ) : !students || students.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground/40 font-black italic">등록된 학생이 없습니다.</div>
            ) : (
              <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {students.map((student) => {
                  const seatId = `seat_${student.seatNo.toString().padStart(3, '0')}`;
                  const currentStatus = attendanceList?.find(a => a.id === seatId);
                  const isStudying = currentStatus?.status === 'studying';
                  const isAway = currentStatus?.status === 'away' || currentStatus?.status === 'break';
                  const isAbsent = !currentStatus || currentStatus.status === 'absent';

                  return (
                    <Link key={student.id} href={`/dashboard/teacher/students/${student.id}`}>
                      <div className={cn(
                        "aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all active:scale-90 relative overflow-hidden group",
                        isStudying ? "bg-emerald-500 border-emerald-600 text-white shadow-lg" : 
                        isAway ? "bg-amber-500 border-amber-600 text-white" :
                        "bg-white border-muted-foreground/10 text-muted-foreground hover:border-primary/30"
                      )}>
                        <span className={cn("text-[8px] font-black absolute top-1.5 left-2", isStudying || isAway ? "opacity-60" : "opacity-30")}>{student.seatNo}</span>
                        <span className="text-[10px] font-black truncate px-1 w-full text-center">{student.name}</span>
                        {isStudying && (
                          <div className="absolute bottom-1 right-1">
                            <Activity className="h-2 w-2 animate-pulse" />
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 오늘 상담 예약 섹션 */}
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
          <CardHeader className="p-6 sm:p-8 border-b bg-muted/5">
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> 오늘 상담 예약
            </CardTitle>
            <CardDescription className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Today's Schedule</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {aptLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6 text-primary opacity-20" /></div>
            ) : !appointments || appointments.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center gap-3">
                <MessageSquare className="h-10 w-10 text-muted-foreground opacity-10" />
                <p className="text-sm font-bold text-muted-foreground/40 italic">오늘 예정된 상담이 없습니다.</p>
              </div>
            ) : (
              <div className="divide-y border-t border-muted/10">
                {appointments.map((apt: any) => (
                  <Link key={apt.id} href={`/dashboard/teacher/students/${apt.studentId}`}>
                    <div className="p-5 sm:p-6 flex items-center justify-between hover:bg-muted/5 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-primary/5 flex flex-col items-center justify-center border border-primary/10 shadow-inner group-hover:bg-primary transition-all duration-500">
                          <span className="text-[8px] font-black text-primary/60 group-hover:text-white/60 uppercase">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'aaa') : ''}</span>
                          <span className="text-sm font-black text-primary group-hover:text-white">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'h:mm') : '-'}</span>
                        </div>
                        <div className="grid gap-0.5">
                          <h3 className="text-base font-black group-hover:text-primary transition-colors">{apt.studentName} 학생</h3>
                          <p className="text-[10px] font-bold text-muted-foreground truncate max-w-[180px]">{apt.studentNote || '상담 요청 내용 없음'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] font-black h-6 border-2 hidden xs:inline-flex">확정됨</Badge>
                        <ChevronRight className="h-5 w-5 text-muted-foreground/20 group-hover:translate-x-1 group-hover:text-primary transition-all" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div className="p-4 bg-muted/5 border-t">
              <Button asChild variant="ghost" className="w-full h-12 rounded-xl text-xs font-black text-primary/60 hover:text-primary hover:bg-white transition-all gap-2">
                <Link href="/dashboard/appointments">상담 관리 센터 바로가기 <ArrowRight className="h-3 w-3" /></Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
