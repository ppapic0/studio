'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, orderBy, limit, Timestamp, collectionGroup } from 'firebase/firestore';
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
import { AttendanceCurrent, StudentProfile, StudyLogDay } from '@/lib/types';
import { format, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

export default function TeacherHomePage() {
  const { activeMembership, viewMode } = useAppContext();
  const firestore = useFirestore();
  const isMobile = viewMode === 'mobile';

  const centerId = activeMembership?.id;
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    setToday(new Date());
  }, []);

  const todayKey = today ? format(today, 'yyyy-MM-dd') : '';

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

  // 3. 오늘 모든 학생의 학습 로그 조회 (공부 시간 표시용)
  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return query(
      collectionGroup(firestore, 'days'),
      where('centerId', '==', centerId),
      where('dateKey', '==', todayKey)
    );
  }, [firestore, centerId, todayKey]);
  const { data: todayLogs } = useCollection<StudyLogDay>(logsQuery);

  // 4. 오늘 상담 예약
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

  const formatMinutes = (minutes: number) => {
    const hh = Math.floor(minutes / 60);
    const mm = minutes % 60;
    return `${hh}h ${mm}m`;
  };

  return (
    <div className={cn("flex flex-col gap-5 max-w-5xl mx-auto", isMobile ? "gap-4" : "gap-8")}>
      <header className="flex flex-col gap-0.5 px-1">
        <h1 className={cn("font-black tracking-tighter text-primary", isMobile ? "text-2xl" : "text-3xl")}>
          센터 관제 홈
        </h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Real-time Command</p>
      </header>

      {/* 퀵 지표 섹션 */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border-none shadow-sm bg-emerald-50/40">
          <CardContent className="p-3.5 flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-emerald-600 mb-0.5">
              <Activity className="h-3 w-3" />
              <span className="text-[9px] font-black uppercase">학습 중</span>
            </div>
            <div className="text-xl font-black text-emerald-700">{stats.studying}<span className="text-[10px] ml-0.5 opacity-60">명</span></div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm bg-rose-50/40">
          <CardContent className="p-3.5 flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-rose-600 mb-0.5">
              <AlertCircle className="h-3 w-3" />
              <span className="text-[9px] font-black uppercase">미입실</span>
            </div>
            <div className="text-xl font-black text-rose-700">{stats.alert}<span className="text-[10px] ml-0.5 opacity-60">명</span></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5">
        {/* 좌석 및 실시간 출결 섹션 */}
        <Card className="rounded-[1.5rem] border-none shadow-md overflow-hidden bg-white ring-1 ring-border/50">
          <CardHeader className="bg-muted/5 border-b p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <CardTitle className="text-base sm:text-lg font-black flex items-center gap-2">
                  <Armchair className="h-4 w-4 text-primary" /> 좌석 상황판
                </CardTitle>
                <CardDescription className="text-[9px] font-bold text-muted-foreground">실시간 좌석 점유 및 누적 학습 시간</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="rounded-full h-7 px-3 text-[9px] font-black hover:bg-primary/5">
                <Link href="/dashboard/teacher/layout-view">전체 보기</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3.5 sm:p-6">
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin h-6 w-6 text-primary opacity-20" /></div>
            ) : !students || students.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground/40 font-black italic text-xs">등록된 학생이 없습니다.</div>
            ) : (
              <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {students.map((student) => {
                  const seatId = `seat_${student.seatNo.toString().padStart(3, '0')}`;
                  const currentStatus = attendanceList?.find(a => a.id === seatId);
                  const studentLog = todayLogs?.find(l => l.studentId === student.id);
                  const totalMinutes = studentLog?.totalMinutes || 0;

                  const isStudying = currentStatus?.status === 'studying';
                  const isAway = currentStatus?.status === 'away' || currentStatus?.status === 'break';

                  return (
                    <Link key={student.id} href={`/dashboard/teacher/students/${student.id}`}>
                      <div className={cn(
                        "aspect-square rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 relative overflow-hidden group shadow-sm p-1",
                        isStudying ? "bg-emerald-500 border-emerald-600 text-white" : 
                        isAway ? "bg-amber-500 border-amber-600 text-white" :
                        "bg-white border-muted-foreground/5 text-muted-foreground hover:border-primary/20"
                      )}>
                        <span className={cn("text-[7px] font-black absolute top-1 left-1.5", isStudying || isAway ? "opacity-60" : "opacity-30")}>{student.seatNo}</span>
                        
                        {isMobile ? (
                          <span className={cn("text-[8px] font-black tracking-tighter mt-1", isStudying || isAway ? "text-white" : "text-primary/80")}>
                            {totalMinutes > 0 ? formatMinutes(totalMinutes) : '-'}
                          </span>
                        ) : (
                          <>
                            <span className="text-[9px] font-black truncate px-0.5 w-full text-center leading-tight mb-0.5">{student.name}</span>
                            <span className={cn("text-[8px] font-bold opacity-80", isStudying || isAway ? "text-white" : "text-primary/60")}>
                              {totalMinutes > 0 ? formatMinutes(totalMinutes) : '0h 0m'}
                            </span>
                          </>
                        )}

                        {isStudying && (
                          <div className="absolute bottom-0.5 right-1">
                            <Activity className="h-1.5 w-1.5 animate-pulse" />
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
        <Card className="rounded-[1.5rem] border-none shadow-md bg-white overflow-hidden ring-1 ring-border/50">
          <CardHeader className="p-4 sm:p-6 border-b bg-muted/5">
            <CardTitle className="text-base sm:text-lg font-black flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> 오늘 상담 일정
            </CardTitle>
            <CardDescription className="text-[9px] font-bold opacity-60 uppercase tracking-widest">Appointment List</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {aptLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin h-5 w-5 text-primary opacity-20" /></div>
            ) : !appointments || appointments.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center gap-2">
                <MessageSquare className="h-8 w-8 text-muted-foreground opacity-10" />
                <p className="text-xs font-bold text-muted-foreground/40 italic">오늘 예정된 상담이 없습니다.</p>
              </div>
            ) : (
              <div className="divide-y divide-muted/10">
                {appointments.map((apt: any) => (
                  <Link key={apt.id} href={`/dashboard/teacher/students/${apt.studentId}`}>
                    <div className="p-4 sm:p-5 flex items-center justify-between hover:bg-muted/5 transition-colors group">
                      <div className="flex items-center gap-3.5">
                        <div className="h-10 w-10 rounded-xl bg-primary/5 flex flex-col items-center justify-center border border-primary/10 shadow-inner group-hover:bg-primary transition-all duration-300">
                          <span className="text-[7px] font-black text-primary/60 group-hover:text-white/60 uppercase leading-none">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'aaa') : ''}</span>
                          <span className="text-xs font-black text-primary group-hover:text-white">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'h:mm') : '-'}</span>
                        </div>
                        <div className="grid gap-0.5">
                          <h3 className="text-sm font-black group-hover:text-primary transition-colors">{apt.studentName}</h3>
                          <p className="text-[9px] font-bold text-muted-foreground truncate max-w-[150px]">{apt.studentNote || '상담 주제 미입력'}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:translate-x-1 group-hover:text-primary transition-all" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div className="p-3 bg-muted/5 border-t">
              <Button asChild variant="ghost" className="w-full h-10 rounded-xl text-[10px] font-black text-primary/60 hover:text-primary hover:bg-white transition-all gap-1.5">
                <Link href="/dashboard/appointments">상담 관리 전체보기 <ArrowRight className="h-3 w-3" /></Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
