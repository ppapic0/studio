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
  Trophy,
  User,
  Sparkles,
  ArrowRight,
  Settings2,
  UserPlus,
  Search,
  Check,
  X
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
  collectionGroup,
  doc,
  updateDoc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { StudentProfile, AttendanceCurrent, StudyLogDay, CounselingReservation, CenterMembership } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay } from 'date-fns';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

export function TeacherDashboard({ isActive }: { isActive: boolean }) {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const isMobile = viewMode === 'mobile';
  
  const [now, setNow] = useState(Date.now());
  const [selectedSeat, setSelectedSeat] = useState<AttendanceCurrent | null>(null);
  const [isManaging, setIsManaging] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const centerId = activeMembership?.id;
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  // 1. 모든 학생 데이터
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'students'), orderBy('name', 'asc'));
  }, [firestore, centerId]);
  const { data: students, isLoading: studentsLoading } = useCollection<StudentProfile>(studentsQuery, { enabled: isActive });

  // 2. 학생들의 멤버십 정보
  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'student'));
  }, [firestore, centerId]);
  const { data: studentMembers } = useCollection<CenterMembership>(membersQuery, { enabled: isActive });

  // 3. 실시간 좌석 현황
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery, { enabled: isActive });

  // 4. 오늘 학습 로그
  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return query(collectionGroup(firestore, 'days'), where('centerId', '==', centerId), where('dateKey', '==', todayKey));
  }, [firestore, centerId, todayKey]);
  const { data: todayLogs } = useCollection<StudyLogDay>(logsQuery, { enabled: isActive });

  // 5. 오늘 상담 예약
  const appointmentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    const todayDate = new Date();
    return query(
      collection(firestore, 'centers', centerId, 'counselingReservations'), 
      where('scheduledAt', '>=', Timestamp.fromDate(startOfDay(todayDate))), 
      where('scheduledAt', '<=', Timestamp.fromDate(endOfDay(todayDate)))
    );
  }, [firestore, centerId]);
  const { data: rawAppointments, isLoading: aptLoading } = useCollection<CounselingReservation>(appointmentsQuery, { enabled: isActive });

  const appointments = useMemo(() => rawAppointments ? [...rawAppointments].sort((a,b)=>(b.scheduledAt?.toMillis()||0)-(a.scheduledAt?.toMillis()||0)) : [], [rawAppointments]);

  const unassignedStudents = useMemo(() => {
    if (!students || !studentMembers) return [];
    return students.filter(s => {
      const membership = studentMembers.find(m => m.id === s.id);
      return membership?.status === 'active' && (!s.seatNo || s.seatNo === 0);
    }).filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [students, studentMembers, searchTerm]);

  const getLiveTimeInMinutes = (seat: AttendanceCurrent) => {
    if (!seat.studentId) return 0;
    const studentLog = todayLogs?.find(l => l.studentId === seat.studentId);
    let totalMins = studentLog?.totalMinutes || 0;
    if (seat.status === 'studying' && seat.lastCheckInAt) {
      const startTime = seat.lastCheckInAt.toMillis();
      totalMins += Math.floor((now - startTime) / 60000);
    }
    return totalMins;
  };

  const getLiveTimeLabel = (seat: AttendanceCurrent) => {
    const totalMins = getLiveTimeInMinutes(seat);
    const hh = Math.floor(totalMins / 60);
    const mm = totalMins % 60;
    return `${hh}h ${mm}m`;
  };

  const metrics = useMemo(() => {
    if (!attendanceList || !students) return { totalCenterMinutes: 0, avgMinutes: 0, top20Avg: 0 };
    
    const allLiveMinutes = attendanceList
      .filter(a => !!a.studentId)
      .map(a => getLiveTimeInMinutes(a));
    
    const totalCenterMinutes = allLiveMinutes.reduce((acc, m) => acc + m, 0);
    const avgMinutes = allLiveMinutes.length > 0 ? Math.round(totalCenterMinutes / allLiveMinutes.length) : 0;
    
    const sortedMinutes = [...allLiveMinutes].sort((a, b) => b - a);
    const top20Count = Math.max(1, Math.ceil(sortedMinutes.length * 0.2));
    const top20Avg = Math.round(sortedMinutes.slice(0, top20Count).reduce((acc, m) => acc + m, 0) / top20Count);

    return { totalCenterMinutes, avgMinutes, top20Avg };
  }, [attendanceList, todayLogs, now, students]);

  const stats = useMemo(() => {
    if (!attendanceList) return { studying: 0, absent: 0, away: 0, total: 70 };
    return {
      studying: attendanceList.filter(a => a.status === 'studying').length,
      absent: attendanceList.filter(a => a.studentId && a.status === 'absent').length,
      away: attendanceList.filter(a => a.status === 'away' || a.status === 'break').length,
      total: Math.max(70, attendanceList.length)
    };
  }, [attendanceList]);

  const handleStatusUpdate = async (status: AttendanceCurrent['status']) => {
    if (!firestore || !centerId || !selectedSeat) return;
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id), { 
        status, 
        updatedAt: serverTimestamp(),
        ...(status === 'studying' ? { lastCheckInAt: serverTimestamp() } : {})
      });
      toast({ title: "상태 변경 완료" });
      setIsManaging(false);
    } catch (e) { toast({ variant: "destructive", title: "변경 실패" }); }
  };

  const assignStudentToSeat = async (student: StudentProfile) => {
    if (!firestore || !centerId || !selectedSeat) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const seatId = selectedSeat.id;
      batch.update(doc(firestore, 'centers', centerId, 'students', student.id), { seatNo: selectedSeat.seatNo, updatedAt: serverTimestamp() });
      batch.update(doc(firestore, 'centers', centerId, 'attendanceCurrent', seatId), { studentId: student.id, status: 'absent', updatedAt: serverTimestamp() });
      await batch.commit();
      toast({ title: `${student.name} 학생 배정 완료` });
      setIsAssigning(false);
      setSearchTerm('');
    } catch (e) { toast({ variant: "destructive", title: "배정 실패" }); } finally { setIsSaving(false); }
  };

  const unassignStudentFromSeat = async () => {
    if (!firestore || !centerId || !selectedSeat || !selectedSeat.studentId) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'centers', centerId, 'students', selectedSeat.studentId), { seatNo: 0, updatedAt: serverTimestamp() });
      batch.update(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id), { studentId: null, status: 'absent', updatedAt: serverTimestamp() });
      await batch.commit();
      toast({ title: "배정 해제 완료" });
      setIsManaging(false);
    } catch (e) { toast({ variant: "destructive", title: "해제 실패" }); } finally { setIsSaving(false); }
  };

  const handleSeatClick = (seat: AttendanceCurrent) => {
    setSelectedSeat(seat);
    if (isEditMode) {
      if (seat.studentId) setIsManaging(true);
      else setIsAssigning(true);
    } else {
      if (seat.studentId) setIsManaging(true);
    }
  };

  if (!isActive) return null;

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto pb-24 min-h-screen">
      <header className="flex flex-col md:flex-row md:items-center justify-between px-4 pt-6 gap-4">
        <div className="flex items-center gap-3">
          <Monitor className="h-8 w-8 text-primary" />
          <div className="grid">
            <h1 className="text-3xl font-black tracking-tight">실시간 관제 홈</h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] mt-0.5 ml-1">Command & Control Matrix</p>
          </div>
          <Badge className="bg-blue-600 text-white border-none font-black text-[10px] rounded-full px-2.5 h-5 tracking-tighter">LIVE</Badge>
        </div>
        
        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md p-2 rounded-[1.5rem] border shadow-sm">
          <div className="flex items-center gap-2 px-4 border-r">
            <Activity className="h-4 w-4 text-emerald-500" />
            <div className="grid leading-none">
              <span className="text-[8px] font-black text-muted-foreground uppercase">Center Total</span>
              <span className="text-sm font-black text-emerald-600">{Math.floor(metrics.totalCenterMinutes / 60)}h {metrics.totalCenterMinutes % 60}m</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 border-r">
            <Users className="h-4 w-4 text-blue-500" />
            <div className="grid leading-none">
              <span className="text-[8px] font-black text-muted-foreground uppercase">Avg Study</span>
              <span className="text-sm font-black text-blue-600">{Math.floor(metrics.avgMinutes / 60)}h {metrics.avgMinutes % 60}m</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4">
            <Trophy className="h-4 w-4 text-amber-500" />
            <div className="grid leading-none">
              <span className="text-[8px] font-black text-muted-foreground uppercase">Top 20% Avg</span>
              <span className="text-sm font-black text-amber-600">{Math.floor(metrics.top20Avg / 60)}h {metrics.top20Avg % 60}m</span>
            </div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4">
        {[
          { label: '학습 중', val: stats.studying, color: 'text-blue-600', icon: Activity, bg: 'bg-white' },
          { label: '미입실', val: stats.absent, color: 'text-rose-500', icon: AlertCircle, bg: 'bg-white' },
          { label: '외출/휴식', val: stats.away, color: 'text-amber-500', icon: Clock, bg: 'bg-white' },
          { label: '배치 좌석', val: stats.total, color: 'text-primary', icon: Armchair, bg: 'bg-white', hasEdit: true }
        ].map((item, i) => (
          <Card key={i} className="rounded-[2.5rem] border-none shadow-sm bg-white p-6 sm:p-8 transition-all hover:shadow-md relative overflow-hidden group">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{item.label}</span>
              <item.icon className={cn("h-5 w-5", item.color)} />
            </div>
            <div className="flex items-center gap-3">
              <div className={cn("text-4xl sm:text-5xl font-black tracking-tighter", item.color)}>{item.val}</div>
              {item.hasEdit && (
                <Button 
                  variant={isEditMode ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={cn(
                    "rounded-xl h-9 px-3 font-black text-[10px] gap-1.5 transition-all shadow-sm",
                    isEditMode ? "bg-primary text-white" : "border-2 hover:bg-primary/5"
                  )}
                >
                  <Settings2 className="h-3.5 w-3.5" /> {isEditMode ? '수정 완료' : '배치 수정하기'}
                </Button>
              )}
            </div>
            {item.hasEdit && isEditMode && (
              <div className="absolute top-0 left-0 w-full h-1 bg-primary animate-pulse" />
            )}
          </Card>
        ))}
      </section>

      <Card className={cn(
        "rounded-[3.5rem] border-none shadow-xl bg-white mx-4 overflow-hidden transition-all duration-500",
        isEditMode ? "ring-4 ring-primary/20" : ""
      )}>
        <CardHeader className="bg-muted/5 border-b px-10 py-6">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
              <Armchair className="h-5 w-5 opacity-40" /> 
              {isEditMode ? '좌석 배치 수정 모드' : '실시간 좌석 상황판 (70석)'}
            </CardTitle>
            {isEditMode && <Badge className="bg-primary text-white font-black text-[10px] px-3 py-1">좌석 클릭 시 학생 배정/해제 가능</Badge>}
          </div>
        </CardHeader>
        <CardContent className="p-6 sm:p-10">
          <ScrollArea className="w-full">
            <div className="rounded-[2.5rem] border-2 border-muted/30 p-6 sm:p-8 bg-[#fafafa] w-fit mx-auto">
              <div className="grid grid-cols-10 gap-2 sm:gap-3">
                {Array.from({ length: 10 }).map((_, colIndex) => (
                  <div key={colIndex} className="flex flex-col gap-2 sm:gap-3">
                    {Array.from({ length: 7 }).map((_, rowIndex) => {
                      const seatNo = colIndex * 7 + rowIndex + 1;
                      const seatId = `seat_${seatNo.toString().padStart(3, '0')}`;
                      const seat = attendanceList?.find(a => a.id === seatId) || { id: seatId, seatNo, status: 'absent' } as AttendanceCurrent;
                      const student = students?.find(s => s.id === seat?.studentId);
                      
                      const isStudying = seat?.status === 'studying';
                      const isAbsent = student && seat?.status === 'absent';
                      const isAway = seat?.status === 'away' || seat?.status === 'break';

                      return (
                        <div 
                          key={seatNo} 
                          onClick={() => handleSeatClick(seat)}
                          className={cn(
                            "aspect-[1.1/1] w-[92px] rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-500 relative overflow-hidden p-1.5 cursor-pointer shadow-sm",
                            isEditMode ? "hover:border-primary border-dashed" : "border-solid",
                            isStudying 
                              ? "bg-blue-600 border-blue-700 text-white shadow-xl scale-[1.03] z-10" 
                              : isAway
                                ? "bg-amber-500 border-amber-600 text-white"
                                : isAbsent 
                                  ? "bg-rose-50 border-rose-300 text-rose-600" 
                                  : student 
                                    ? "bg-white border-primary/20 text-primary" 
                                    : "bg-white border-muted/40 text-muted-foreground/20 hover:border-primary/20"
                          )}
                        >
                          <span className={cn("text-[8px] font-black absolute top-1 left-2", isStudying ? "opacity-60" : isAbsent ? "text-rose-300" : "opacity-40")}>
                            {seatNo}
                          </span>
                          
                          {student ? (
                            <div className="flex flex-col items-center gap-0 w-full px-1">
                              <span className="text-[10px] sm:text-[11px] font-black truncate w-full text-center tracking-tighter leading-none mb-0.5">{student.name}</span>
                              <span className={cn("text-[7px] sm:text-[8px] font-bold tracking-tight", isStudying ? "text-white/80" : "text-muted-foreground")}>
                                {getLiveTimeLabel(seat!)}
                              </span>
                              {isStudying && <Zap className="h-2 w-2 fill-current animate-pulse text-white/50 mt-0.5" />}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center opacity-40">
                              <span className="text-[8px] font-black">EMPTY</span>
                              {isEditMode && <UserPlus className="h-3 w-3 mt-1 text-primary" />}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <section className="px-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-black tracking-tighter">오늘 상담 현황</h2>
            <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-black h-6">{appointments.length}건</Badge>
          </div>
          <Button asChild variant="ghost" className="font-black text-xs text-muted-foreground hover:text-primary gap-2">
            <Link href="/dashboard/appointments">상담 관리 바로가기 <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {aptLoading ? <div className="col-span-full py-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div> : appointments.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white/50 rounded-[2.5rem] border-2 border-dashed border-muted-foreground/10">
              <p className="font-black text-muted-foreground/30 text-sm italic">오늘 예정된 상담이 없습니다.</p>
            </div>
          ) : appointments.map((apt) => (
            <Card key={apt.id} className="rounded-[2rem] border-none shadow-sm bg-white p-6 flex items-center justify-between group hover:shadow-md transition-all active:scale-[0.98]">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/5 border border-primary/10 flex flex-col items-center justify-center shrink-0">
                  <span className="text-[10px] font-black text-primary/60 leading-none">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'HH:mm') : ''}</span>
                </div>
                <div className="grid leading-tight">
                  <span className="font-black text-base">{apt.studentName} 학생</span>
                  <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[150px]">{apt.studentNote || '상담 주제 미입력'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn("font-black text-[9px] border-none", apt.status === 'requested' ? "bg-amber-50 text-amber-600" : "bg-emerald-500 text-white")}>
                  {apt.status === 'requested' ? '승인대기' : '예약확정'}
                </Badge>
                <ChevronRight className="h-4 w-4 opacity-20 group-hover:translate-x-1 transition-all" />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <Dialog open={isManaging} onOpenChange={setIsManaging}>
        <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl sm:max-w-md">
          {selectedSeat && (
            <>
              <div className={cn("p-10 text-white relative", selectedSeat.status === 'studying' ? "bg-blue-600" : "bg-primary")}>
                <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12"><Sparkles className="h-32 w-32" /></div>
                <DialogHeader className="relative z-10">
                  <DialogTitle className="text-4xl font-black tracking-tighter">{students?.find(s => s.id === selectedSeat.studentId)?.name || '학생'}</DialogTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-white/20 text-white border-none font-black px-3 py-1">SEAT {selectedSeat.seatNo}</Badge>
                    <Badge className="bg-white/20 text-white border-none font-black px-3 py-1 uppercase">{selectedSeat.status}</Badge>
                  </div>
                </DialogHeader>
              </div>
              <div className="p-8 space-y-6 bg-white">
                {isEditMode ? (
                  <Button variant="destructive" onClick={unassignStudentFromSeat} disabled={isSaving} className="w-full h-16 rounded-2xl font-black text-lg shadow-xl shadow-rose-200">
                    {isSaving ? <Loader2 className="animate-spin" /> : '좌석 배정 해제'}
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <Button onClick={() => handleStatusUpdate('studying')} className="h-24 rounded-[2rem] font-black bg-blue-600 hover:bg-blue-700 text-white gap-3 flex flex-col shadow-xl active:scale-95 transition-all">
                      <Zap className="h-6 w-6 fill-current" />
                      <span className="text-lg">입실 처리</span>
                    </Button>
                    <Button variant="outline" onClick={() => handleStatusUpdate('absent')} className="h-24 rounded-[2rem] font-black border-2 border-rose-100 text-rose-600 hover:bg-rose-50 gap-3 flex flex-col active:scale-95 transition-all">
                      <AlertCircle className="h-6 w-6" />
                      <span className="text-lg">퇴실 처리</span>
                    </Button>
                  </div>
                )}
                <div className="pt-4 border-t border-dashed">
                  <Button variant="secondary" className="w-full h-16 rounded-2xl font-black gap-4 text-primary bg-primary/5 hover:bg-primary/10 transition-all border border-primary/5" asChild>
                    <Link href={`/dashboard/teacher/students/${selectedSeat.studentId}`}><User className="h-5 w-5 opacity-40" />상세 분석 리포트 보기<ChevronRight className="ml-auto h-5 w-5 opacity-20" /></Link>
                  </Button>
                </div>
              </div>
              <DialogFooter className="p-6 bg-muted/20 border-t flex justify-center"><Button variant="ghost" onClick={() => setIsManaging(false)} className="font-bold text-muted-foreground">닫기</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAssigning} onOpenChange={setIsAssigning}>
        <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl sm:max-w-md">
          <div className="bg-primary p-8 text-white relative">
            <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><UserPlus className="h-24 w-24" /></div>
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3"><UserPlus className="h-7 w-7" /> 학생 좌석 배정</DialogTitle>
              <p className="text-white/60 font-bold mt-1 text-sm">SEAT NO. {selectedSeat?.seatNo}</p>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-4 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              <Input placeholder="이름으로 찾기..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="rounded-xl border-2 pl-10 h-11 text-sm font-bold" />
            </div>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {unassignedStudents.length === 0 ? <p className="text-center py-10 text-xs font-bold text-muted-foreground/40 italic">배정 가능한 미배정 학생이 없습니다.</p> : unassignedStudents.map((student) => (
                  <div key={student.id} onClick={() => assignStudentToSeat(student)} className="p-4 rounded-2xl border-2 border-transparent hover:border-primary/10 hover:bg-primary/5 cursor-pointer flex items-center justify-between group transition-all">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center font-black text-primary border border-primary/10 group-hover:bg-primary group-hover:text-white transition-colors">{student.name.charAt(0)}</div>
                      <div className="grid gap-0.5"><span className="font-black text-sm group-hover:text-primary transition-colors">{student.name}</span><span className="text-[10px] font-bold text-muted-foreground">{student.schoolName}</span></div>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter className="p-6 bg-muted/20 border-t flex justify-center"><Button variant="ghost" onClick={() => setIsAssigning(false)} className="font-bold text-muted-foreground">취소</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}