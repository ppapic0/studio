
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
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setToday(new Date());
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
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
    return [...rawAppointments].sort((a, b) => (b.scheduledAt?.toMillis() || 0) - (a.scheduledAt?.toMillis() || 0));
  }, [rawAppointments]);

  const isLoading = attendanceLoading || studentsLoading || aptLoading;

  const stats = useMemo(() => {
    const studying = attendanceList?.filter(a => a.status === 'studying').length || 0;
    const alert = attendanceList?.filter(a => a.studentId && a.status === 'absent').length || 0;
    return { studying, alert };
  }, [attendanceList]);

  const getLiveTimeLabel = (seatId: string, studentId: string) => {
    const seat = attendanceList?.find(a => a.id === seatId);
    const studentLog = todayLogs?.find(l => l.studentId === studentId);
    let totalMins = studentLog?.totalMinutes || 0;

    if (seat?.status === 'studying' && seat.lastCheckInAt) {
      const startTime = seat.lastCheckInAt.toMillis();
      const sessionMins = Math.floor((now - startTime) / 60000);
      totalMins += Math.max(0, sessionMins);
    }

    const hh = Math.floor(totalMins / 60);
    const mm = totalMins % 60;
    return `${hh}h ${mm}m`;
  };

  return (
    <div className={cn("flex flex-col gap-8 max-w-6xl mx-auto pb-20", isMobile ? "gap-4 px-1" : "gap-10 px-4 py-6")}>
      <header className="flex flex-col gap-1 px-1">
        <h1 className={cn("font-black tracking-tighter text-primary", isMobile ? "text-2xl" : "text-4xl")}>
          실시간 관제 홈
        </h1>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60">Command & Control Dashboard</p>
      </header>

      {/* 퀵 지표 섹션 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-[2rem] border-none shadow-lg bg-blue-50/50 group">
          <CardContent className="p-6 flex flex-col gap-1">
            <div className="flex items-center justify-between text-blue-600 mb-2">
              <Activity className="h-5 w-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">학습 중</span>
            </div>
            <div className="text-4xl font-black text-blue-700 tracking-tighter">{stats.studying}<span className="text-lg ml-1 opacity-40">명</span></div>
          </CardContent>
        </Card>
        <Card className="rounded-[2rem] border-none shadow-lg bg-rose-50/50">
          <CardContent className="p-6 flex flex-col gap-1">
            <div className="flex items-center justify-between text-rose-600 mb-2">
              <AlertCircle className="h-5 w-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">미입실</span>
            </div>
            <div className="text-4xl font-black text-rose-700 tracking-tighter">{stats.alert}<span className="text-lg ml-1 opacity-40">명</span></div>
          </CardContent>
        </Card>
        <Card className="rounded-[2rem] border-none shadow-lg bg-white hidden md:flex">
          <CardContent className="p-6 flex flex-col gap-1 w-full">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <Armchair className="h-5 w-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">총 좌석</span>
            </div>
            <div className="text-4xl font-black text-primary tracking-tighter">{attendanceList?.length || 0}<span className="text-lg ml-1 opacity-40">석</span></div>
          </CardContent>
        </Card>
        <Card className="rounded-[2rem] border-none shadow-lg bg-white hidden md:flex">
          <CardContent className="p-6 flex flex-col gap-1 w-full">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <Users className="h-5 w-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">등록 학생</span>
            </div>
            <div className="text-4xl font-black text-primary tracking-tighter">{students?.length || 0}<span className="text-lg ml-1 opacity-40">명</span></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8">
        {/* 좌석 및 실시간 출결 섹션 */}
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white ring-1 ring-border/50">
          <CardHeader className="bg-muted/5 border-b p-8 sm:p-10">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-black flex items-center gap-3 tracking-tighter">
                  <Armchair className="h-6 w-6 text-primary" /> 실시간 좌석 상황판
                </CardTitle>
                <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60">Live Seat Matrix & Study Performance</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm" className="rounded-2xl h-11 px-6 font-black border-2 shadow-sm bg-white" >
                <Link href="/dashboard/teacher/layout-view">전체 도면 보기</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className={cn("p-6 sm:p-10 bg-[#fafafa]")}>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-40 gap-4">
                <Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/40 italic">Syncing live data...</p>
              </div>
            ) : !students || students.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground/40 font-black italic text-sm">등록된 학생이 없습니다.</div>
            ) : (
              <div className="grid grid-cols-4 xs:grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                {students.map((student) => {
                  const seatId = `seat_${student.seatNo.toString().padStart(3, '0')}`;
                  const currentStatus = attendanceList?.find(a => a.id === seatId);
                  
                  const isStudying = currentStatus?.status === 'studying';
                  const isAway = currentStatus?.status === 'away' || currentStatus?.status === 'break';

                  return (
                    <Link key={student.id} href={`/dashboard/teacher/students/${student.id}`}>
                      <div className={cn(
                        "aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-90 relative overflow-hidden group shadow-sm p-2",
                        isStudying ? "bg-blue-600 border-blue-700 text-white shadow-xl shadow-blue-600/20 scale-105 z-10" : 
                        isAway ? "bg-amber-500 border-amber-600 text-white shadow-lg" :
                        "bg-white border-muted-foreground/5 text-muted-foreground hover:border-primary/20"
                      )}>
                        <span className={cn("text-[8px] font-black absolute top-1.5 left-2", isStudying || isAway ? "opacity-60" : "opacity-30")}>{student.seatNo}</span>
                        
                        <span className="text-[11px] font-black truncate px-1 w-full text-center leading-tight mb-0.5">{student.name}</span>
                        <span className={cn("text-[9px] font-bold tracking-tighter opacity-80", isStudying || isAway ? "text-white" : "text-primary/60")}>
                          {getLiveTimeLabel(seatId, student.id)}
                        </span>

                        {isStudying && (
                          <div className="absolute bottom-1.5">
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
        <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-border/50">
          <CardHeader className="p-8 sm:p-10 border-b bg-muted/5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-black flex items-center gap-3 tracking-tighter">
                  <MessageSquare className="h-6 w-6 text-primary" /> 오늘 상담 일정
                </CardTitle>
                <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60">Today's Appointment Queue</CardDescription>
              </div>
              <Badge variant="outline" className="font-black text-[10px] border-primary/20 bg-white px-3">{appointments.length} 건</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {aptLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
            ) : !appointments || appointments.length === 0 ? (
              <div className="py-24 text-center flex flex-col items-center gap-4">
                <div className="p-6 rounded-full bg-muted/20">
                  <MessageSquare className="h-12 w-12 text-muted-foreground opacity-10" />
                </div>
                <p className="text-sm font-black text-muted-foreground/40 italic">오늘 예정된 상담이 없습니다.</p>
              </div>
            ) : (
              <div className="divide-y divide-muted/10">
                {appointments.map((apt: any) => (
                  <Link key={apt.id} href={`/dashboard/teacher/students/${apt.studentId}`}>
                    <div className="p-8 flex items-center justify-between hover:bg-muted/5 transition-all group">
                      <div className="flex items-center gap-8">
                        <div className="h-16 w-16 rounded-[1.5rem] bg-primary/5 border-2 border-primary/10 flex flex-col items-center justify-center shrink-0 group-hover:bg-primary transition-all duration-500 shadow-inner">
                          <span className="text-[10px] font-black text-primary/60 group-hover:text-white/60 uppercase leading-none mb-0.5">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'aaa') : ''}</span>
                          <span className="text-xl font-black text-primary group-hover:text-white">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'h:mm') : '-'}</span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-xl font-black group-hover:text-primary transition-colors">{apt.studentName} 학생</h3>
                          <p className="text-sm font-bold text-muted-foreground">{apt.studentNote || '상담 주제 미입력'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={cn(
                          "font-black text-[10px] border-none shadow-sm",
                          apt.status === 'confirmed' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                        )}>
                          {apt.status === 'confirmed' ? '예약확정' : '승인대기'}
                        </Badge>
                        <ChevronRight className="h-6 w-6 text-muted-foreground/20 group-hover:translate-x-1 group-hover:text-primary transition-all" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div className="p-4 bg-muted/5 border-t">
              <Button asChild variant="ghost" className="w-full h-12 rounded-2xl text-xs font-black text-muted-foreground hover:text-primary hover:bg-white transition-all gap-2">
                <Link href="/dashboard/appointments">상담 관리 센터 전체보기 <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
