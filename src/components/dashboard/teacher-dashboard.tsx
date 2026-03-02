
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  Armchair, 
  Loader2, 
  MessageSquare, 
  ChevronRight, 
  Activity, 
  ArrowRight,
  Clock,
  Zap,
  Users,
  AlertCircle
} from 'lucide-react';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { 
  collection, 
  query, 
  orderBy, 
  doc, 
  serverTimestamp,
  where,
  Timestamp,
  updateDoc,
  collectionGroup
} from 'firebase/firestore';
import { StudentProfile, AttendanceCurrent, CenterMembership, StudyLogDay } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay } from 'date-fns';

export function TeacherDashboard({ isActive }: { isActive: boolean }) {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const isMobile = viewMode === 'mobile';
  
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const centerId = activeMembership?.id;
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  // 데이터 로딩 로직
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'students'), orderBy('seatNo', 'asc'));
  }, [firestore, centerId]);
  const { data: students } = useCollection<StudentProfile>(studentsQuery, { enabled: isActive });

  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery, { enabled: isActive });

  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return query(collectionGroup(firestore, 'days'), where('centerId', '==', centerId), where('dateKey', '==', todayKey));
  }, [firestore, centerId, todayKey]);
  const { data: todayLogs } = useCollection<StudyLogDay>(logsQuery, { enabled: isActive });

  const appointmentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    const todayDate = new Date();
    return query(
      collection(firestore, 'centers', centerId, 'counselingReservations'), 
      where('scheduledAt', '>=', Timestamp.fromDate(startOfDay(todayDate))), 
      where('scheduledAt', '<=', Timestamp.fromDate(endOfDay(todayDate)))
    );
  }, [firestore, centerId]);
  const { data: rawAppointments, isLoading: aptLoading } = useCollection<any>(appointmentsQuery, { enabled: isActive });

  const appointments = useMemo(() => rawAppointments ? [...rawAppointments].sort((a,b)=>(b.scheduledAt?.toMillis()||0)-(a.scheduledAt?.toMillis()||0)) : [], [rawAppointments]);

  const getLiveTimeLabel = (seat: AttendanceCurrent) => {
    if (!seat.studentId) return '0h 0m';
    const studentLog = todayLogs?.find(l => l.studentId === seat.studentId);
    let totalMins = studentLog?.totalMinutes || 0;
    if (seat.status === 'studying' && seat.lastCheckInAt) {
      const startTime = seat.lastCheckInAt.toMillis();
      totalMins += Math.floor((now - startTime) / 60000);
    }
    const h = Math.floor(totalMins / 60); const m = totalMins % 60;
    return `${h}h ${m}m`;
  };

  const stats = useMemo(() => {
    if (!attendanceList) return { studying: 0, absent: 0, total: 48, registered: 0 };
    return {
      studying: attendanceList.filter(a => a.status === 'studying').length,
      absent: attendanceList.filter(a => a.studentId && a.status === 'absent').length,
      total: attendanceList.length || 48,
      registered: students?.length || 0
    };
  }, [attendanceList, students]);

  if (!isActive) return null;

  return (
    <div className="flex flex-col gap-10 w-full max-w-[1400px] mx-auto pb-24">
      {/* 1. 상단 타이틀 */}
      <header className="flex flex-col gap-1 px-2">
        <h1 className="text-[44px] font-black tracking-tighter text-[#5A4636] leading-none">실시간 관제 홈</h1>
        <p className="text-[13px] font-bold text-[#A07855] uppercase tracking-[0.2em] opacity-70">COMMAND & CONTROL DASHBOARD</p>
      </header>

      {/* 2. 4대 핵심 지표 카드 (이미지 스타일) */}
      <section className={cn("grid gap-6", isMobile ? "grid-cols-2" : "grid-cols-4")}>
        <Card className="rounded-[2.5rem] border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] bg-white p-8 group relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <Activity className="h-6 w-6 text-blue-500" />
            <span className="text-[11px] font-black text-blue-500 uppercase tracking-widest">학습 중</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-6xl font-black text-blue-600 tracking-tighter">{stats.studying}</span>
            <span className="text-xl font-bold text-blue-600/40 ml-1">명</span>
          </div>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] bg-[#FFF5F5] p-8 group relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <AlertCircle className="h-6 w-6 text-rose-500" />
            <span className="text-[11px] font-black text-rose-500 uppercase tracking-widest">미입실</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-6xl font-black text-rose-600 tracking-tighter">{stats.absent}</span>
            <span className="text-xl font-bold text-rose-600/40 ml-1">명</span>
          </div>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] bg-white p-8 group relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <Armchair className="h-6 w-6 text-[#A07855]" />
            <span className="text-[11px] font-black text-[#A07855] uppercase tracking-widest">총 좌석</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-6xl font-black text-[#5A4636] tracking-tighter">{stats.total}</span>
            <span className="text-xl font-bold text-[#5A4636]/40 ml-1">석</span>
          </div>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-[0_20px_50px_rgba(0,0,0,0.05)] bg-white p-8 group relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <Users className="h-6 w-6 text-[#2F2F2F]" />
            <span className="text-[11px] font-black text-[#2F2F2F] uppercase tracking-widest">등록 학생</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-6xl font-black text-[#2F2F2F] tracking-tighter">{stats.registered}</span>
            <span className="text-xl font-bold text-[#2F2F2F]/40 ml-1">명</span>
          </div>
        </Card>
      </section>

      {/* 3. 실시간 좌석 상황판 (이미지 스타일) */}
      <Card className="rounded-[3.5rem] border-none shadow-[0_30px_100px_rgba(0,0,0,0.08)] bg-white overflow-hidden">
        <CardHeader className="p-10 pb-6">
          <div className="flex justify-between items-center">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <Armchair className="h-7 w-7 text-[#5A4636]" />
                <CardTitle className="text-3xl font-black tracking-tighter text-[#5A4636]">실시간 좌석 상황판</CardTitle>
              </div>
              <p className="text-[11px] font-bold text-[#A07855] uppercase tracking-[0.2em] opacity-70 ml-10">LIVE SEAT MATRIX & STUDY PERFORMANCE</p>
            </div>
            <Button variant="outline" className="rounded-2xl h-14 px-10 font-black border-2 border-[#E3DFD8] text-[#5A4636] hover:bg-[#F8F6F2] transition-all" asChild>
              <Link href="/dashboard/teacher/layout-view">전체 도면 보기</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-10 pt-4 bg-[#F8F6F2]/30 min-h-[300px]">
          {attendanceLoading ? (
            <div className="py-24 flex flex-col items-center gap-4">
              <Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" />
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Syncing Matrix...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {students?.map((student) => {
                const seatId = `seat_${student.seatNo.toString().padStart(3, '0')}`;
                const seat = attendanceList?.find(a => a.id === seatId);
                const isStudying = seat?.status === 'studying';
                const isAbsent = student.id && seat?.status === 'absent';

                return (
                  <Link key={student.id} href={`/dashboard/teacher/students/${student.id}`}>
                    <div className={cn(
                      "aspect-[1.2/1] rounded-[1.5rem] border-2 flex flex-col items-center justify-center gap-1 transition-all duration-500 cursor-pointer relative overflow-hidden group shadow-sm active:scale-95",
                      isStudying 
                        ? "bg-blue-600 border-blue-700 text-white shadow-xl shadow-blue-200 scale-105 z-10" 
                        : isAbsent 
                          ? "bg-white border-[#E3DFD8] text-[#2F2F2F] hover:border-primary/30" 
                          : "bg-white border-[#E3DFD8] text-[#2F2F2F] opacity-40"
                    )}>
                      <span className={cn("text-[9px] font-black absolute top-2 left-3", isStudying ? "opacity-60" : "opacity-30")}>
                        {student.seatNo}
                      </span>
                      <span className="text-[15px] font-black truncate w-full text-center px-2 tracking-tighter">
                        {student.name}
                      </span>
                      <span className={cn("text-[10px] font-bold tracking-tight", isStudying ? "text-white/80" : "text-muted-foreground")}>
                        {seat ? getLiveTimeLabel(seat) : '0h 0m'}
                      </span>
                      {isStudying && (
                        <div className="absolute bottom-2 flex justify-center w-full">
                          <Zap className="h-3 w-3 fill-current animate-pulse text-white/50" />
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

      {/* 4. 오늘 상담 일정 (이미지 스타일) */}
      <Card className="rounded-[3.5rem] border-none shadow-[0_30px_100px_rgba(0,0,0,0.08)] bg-white overflow-hidden">
        <CardHeader className="p-10 pb-6 border-b border-[#E3DFD8]/50">
          <div className="flex justify-between items-center">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-7 w-7 text-[#5A4636]" />
                <CardTitle className="text-3xl font-black tracking-tighter text-[#5A4636]">오늘 상담 일정</CardTitle>
              </div>
              <p className="text-[11px] font-bold text-[#A07855] uppercase tracking-[0.2em] opacity-70 ml-10">TODAY'S APPOINTMENT QUEUE</p>
            </div>
            <Badge className="bg-[#F8F6F2] text-[#5A4636] border-none font-black text-xs px-4 py-1.5 rounded-xl">{appointments.length} 건</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {aptLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
          ) : appointments.length === 0 ? (
            <div className="py-24 text-center flex flex-col items-center gap-4 text-muted-foreground/30 font-black italic">
              <MessageSquare className="h-12 w-12 opacity-10" />
              <p className="text-base">오늘 예정된 상담이 없습니다.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E3DFD8]/30">
              {appointments.map((apt: any) => (
                <Link key={apt.id} href={`/dashboard/teacher/students/${apt.studentId}`}>
                  <div className="p-10 flex items-center justify-between hover:bg-[#F8F6F2]/50 transition-all group">
                    <div className="flex items-center gap-10">
                      <div className="h-20 w-20 rounded-full bg-white border-2 border-[#E3DFD8] flex flex-col items-center justify-center shrink-0 shadow-sm group-hover:border-primary group-hover:scale-105 transition-all duration-500">
                        <span className="text-[10px] font-black text-muted-foreground uppercase leading-none mb-0.5">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'aaa') : ''}</span>
                        <span className="text-xl font-black text-[#5A4636]">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'h:mm') : ''}</span>
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-2xl font-black text-[#2F2F2F] group-hover:text-primary transition-colors tracking-tight">{apt.studentName} 학생</h3>
                        <p className="text-[15px] font-bold text-muted-foreground">{apt.studentNote || '..'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      {apt.status === 'requested' ? (
                        <Badge className="bg-[#FFF9E6] text-[#D97706] border-none font-black text-xs px-4 py-1.5 rounded-lg shadow-sm">승인 대기</Badge>
                      ) : (
                        <Badge className="bg-[#E6FFFA] text-[#059669] border-none font-black text-xs px-4 py-1.5 rounded-lg shadow-sm">상담 확정</Badge>
                      )}
                      <ChevronRight className="h-6 w-6 text-[#E3DFD8] group-hover:translate-x-2 group-hover:text-primary transition-all" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div className="p-10 border-t border-[#E3DFD8]/30 text-center">
            <Link href="/dashboard/appointments" className="inline-flex items-center gap-3 text-sm font-black text-[#A07855] hover:text-[#5A4636] transition-colors group">
              상담 관리 센터 전체보기
              <ArrowRight className="h-4 w-4 group-hover:translate-x-2 transition-transform" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
