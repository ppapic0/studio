
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
  Monitor,
  AlertCircle,
  Clock,
  Zap,
  Users,
  Info,
  Pulse
} from 'lucide-react';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { 
  collection, 
  query, 
  orderBy, 
  where,
  Timestamp,
  collectionGroup
} from 'firebase/firestore';
import { StudentProfile, AttendanceCurrent, StudyLogDay } from '@/lib/types';
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

  // 데이터 로딩
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
  const { data: rawAppointments } = useCollection<any>(appointmentsQuery, { enabled: isActive });

  const appointments = useMemo(() => rawAppointments ? [...rawAppointments].sort((a,b)=>(b.scheduledAt?.toMillis()||0)-(a.scheduledAt?.toMillis()||0)) : [], [rawAppointments]);

  const getLiveTimeLabel = (seat: AttendanceCurrent) => {
    if (!seat.studentId) return '0h 0m';
    const studentLog = todayLogs?.find(l => l.studentId === seat.studentId);
    let totalMins = studentLog?.totalMinutes || 0;
    if (seat.status === 'studying' && seat.lastCheckInAt) {
      const startTime = seat.lastCheckInAt.toMillis();
      totalMins += Math.floor((now - startTime) / 60000);
    }
    return `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`;
  };

  const stats = useMemo(() => {
    if (!attendanceList) return { studying: 0, absent: 0, away: 0, total: 48 };
    return {
      studying: attendanceList.filter(a => a.status === 'studying').length,
      absent: attendanceList.filter(a => a.studentId && a.status === 'absent').length,
      away: attendanceList.filter(a => a.status === 'away' || a.status === 'break').length,
      total: Math.max(48, attendanceList.length)
    };
  }, [attendanceList]);

  if (!isActive) return null;

  return (
    <div className="flex flex-col gap-8 w-full max-w-[1400px] mx-auto pb-24 bg-[#F8F7F4]/30 min-h-screen">
      {/* 1. 상단 타이틀 섹션 */}
      <header className="flex items-center gap-3 px-4 pt-6">
        <Monitor className="h-8 w-8 text-[#4A3F35]" />
        <h1 className="text-3xl font-black tracking-tight text-[#4A3F35]">실시간 관제 홈</h1>
        <Badge className="bg-blue-500 text-white border-none font-black text-[10px] rounded-full px-2.5 h-5 flex items-center justify-center tracking-tighter">LIVE</Badge>
      </header>

      {/* 2. 4대 핵심 지표 카드 (이미지 디자인) */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4">
        {[
          { label: '학습 중', val: stats.studying, color: 'text-blue-600', icon: Activity, bg: 'bg-white' },
          { label: '미입실', val: stats.absent, color: 'text-rose-500', icon: Info, bg: 'bg-white' },
          { label: '외출/휴식', val: stats.away, color: 'text-amber-500', icon: Clock, bg: 'bg-white' },
          { label: '배치 좌석', val: stats.total, color: 'text-[#4A3F35]', icon: Armchair, bg: 'bg-white' }
        ].map((item, i) => (
          <Card key={i} className="rounded-[2.5rem] border-none shadow-[0_15px_40px_rgba(0,0,0,0.04)] bg-white p-8 group transition-all hover:shadow-xl">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{item.label}</span>
              <item.icon className={cn("h-5 w-5", item.color)} />
            </div>
            <div className={cn("text-5xl font-black tracking-tighter", item.color)}>{item.val}</div>
          </Card>
        ))}
      </section>

      {/* 3. 실시간 좌석 상황판 (이미지 디자인의 6x8 그리드) */}
      <Card className="rounded-[3.5rem] border-none shadow-[0_20px_60px_rgba(0,0,0,0.06)] bg-white mx-4 overflow-hidden">
        <CardHeader className="p-10 pb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Armchair className="h-6 w-6 text-[#4A3F35]" />
              <CardTitle className="text-2xl font-black tracking-tighter text-[#4A3F35]">실시간 좌석 상황판</CardTitle>
            </div>
            <Button variant="outline" className="rounded-2xl h-12 px-8 font-black border-2 border-[#EAE6E1] text-[#4A3F35] hover:bg-muted/10 transition-all">
              도면 보기
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-10 pt-4">
          <div className="rounded-[2.5rem] border-2 border-[#F0EDE8] p-10 bg-white">
            {/* 6행 8열 그리드 구현 (1-6번이 첫 열) */}
            <div className="grid grid-cols-8 gap-4">
              {Array.from({ length: 8 }).map((_, colIndex) => (
                <div key={colIndex} className="flex flex-col gap-4">
                  {Array.from({ length: 6 }).map((_, rowIndex) => {
                    const seatNo = colIndex * 6 + rowIndex + 1;
                    const seatId = `seat_${seatNo.toString().padStart(3, '0')}`;
                    const seat = attendanceList?.find(a => a.id === seatId);
                    const student = students?.find(s => s.id === seat?.studentId);
                    
                    const isStudying = seat?.status === 'studying';
                    const isAbsent = student && seat?.status === 'absent';

                    return (
                      <div 
                        key={seatNo} 
                        className={cn(
                          "aspect-[1.1/1] rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-500 relative overflow-hidden p-2",
                          isStudying 
                            ? "bg-blue-600 border-blue-700 text-white shadow-xl shadow-blue-200" 
                            : isAbsent 
                              ? "bg-[#FFF5F5] border-rose-300 text-rose-600" 
                              : "bg-transparent border-[#F5F2EE] text-[#EAE6E1]"
                        )}
                      >
                        <span className={cn("text-[8px] font-black absolute top-1.5 left-2.5", isStudying ? "opacity-60" : isAbsent ? "text-rose-300" : "opacity-40")}>
                          {seatNo}
                        </span>
                        
                        {student ? (
                          <div className="flex flex-col items-center gap-0.5 w-full">
                            <span className="text-[13px] font-black truncate w-full text-center tracking-tighter">{student.name}</span>
                            <span className={cn("text-[9px] font-bold tracking-tight", isStudying ? "text-white/80" : "text-muted-foreground")}>
                              {getLiveTimeLabel(seat!)}
                            </span>
                            {isStudying && <Zap className="h-2.5 w-2.5 fill-current animate-pulse text-white/50 mt-1" />}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. 하단 섹션 타이틀 (오늘 상담 현황) */}
      <section className="px-6 flex items-center gap-3 opacity-80">
        <MessageSquare className="h-6 w-6 text-[#4A3F35]" />
        <h2 className="text-2xl font-black tracking-tighter text-[#4A3F35]">오늘 상담 현황</h2>
      </section>
    </div>
  );
}
