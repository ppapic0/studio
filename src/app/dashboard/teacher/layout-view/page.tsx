
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, doc, updateDoc, serverTimestamp, query, where, collectionGroup, writeBatch } from 'firebase/firestore';
import { type StudentProfile, type AttendanceCurrent, type StudyLogDay, type CenterMembership } from '@/lib/types';
import { cn } from '@/lib/utils';
import { 
  Armchair, 
  Loader2, 
  Monitor, 
  RefreshCw,
  Clock,
  MapPin,
  Maximize2,
  AlertCircle,
  Activity,
  Zap,
  User,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserMinus,
  Search
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';

export default function LayoutViewPage() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const centerId = activeMembership?.id;
  const isMobile = viewMode === 'mobile';

  const [selectedSeat, setSelectedSeat] = useState<AttendanceCurrent | null>(null);
  const [isManaging, setIsManaging] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const todayKey = format(new Date(), 'yyyy-MM-dd');

  // 1. 모든 학생 상세 프로필
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'students');
  }, [firestore, centerId]);
  const { data: students, isLoading: studentsLoading } = useCollection<StudentProfile>(studentsQuery);

  // 2. 학생들의 멤버십 정보
  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'student'));
  }, [firestore, centerId]);
  const { data: studentMembers } = useCollection<CenterMembership>(membersQuery);

  // 3. 실시간 좌석 상태
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery);

  // 4. 오늘 모든 학생의 학습 로그 조회 (실시간 합산용)
  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return query(
      collectionGroup(firestore, 'days'),
      where('centerId', '==', centerId),
      where('dateKey', '==', todayKey)
    );
  }, [firestore, centerId, todayKey]);
  const { data: todayLogs } = useCollection<StudyLogDay>(logsQuery);

  const unassignedStudents = useMemo(() => {
    if (!students || !studentMembers) return [];
    return students.filter(s => {
      const membership = studentMembers.find(m => m.id === s.id);
      return membership?.status === 'active' && (!s.seatNo || s.seatNo === 0);
    }).filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [students, studentMembers, searchTerm]);

  const handleStatusUpdate = async (status: AttendanceCurrent['status']) => {
    if (!firestore || !centerId || !selectedSeat) return;
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id), { 
        status, 
        updatedAt: serverTimestamp(),
        ...(status === 'studying' ? { lastCheckInAt: serverTimestamp() } : {})
      });
      toast({ title: "변경 완료" });
      setIsManaging(false);
    } catch (e) { toast({ variant: "destructive", title: "변경 실패" }); }
  };

  const assignStudentToSeat = async (student: StudentProfile) => {
    if (!firestore || !centerId || !selectedSeat) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'centers', centerId, 'students', student.id), { seatNo: selectedSeat.seatNo, updatedAt: serverTimestamp() });
      batch.update(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id), { studentId: student.id, status: 'absent', updatedAt: serverTimestamp() });
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

  const getLiveTimeLabel = (seat: AttendanceCurrent) => {
    if (!seat.studentId) return '0h 0m';
    const studentLog = todayLogs?.find(l => l.studentId === seat.studentId);
    let totalMins = studentLog?.totalMinutes || 0;
    if (seat.status === 'studying' && seat.lastCheckInAt) {
      const startTime = seat.lastCheckInAt.toMillis();
      totalMins += Math.floor((now - startTime) / 60000);
    }
    const hh = Math.floor(totalMins / 60);
    const mm = totalMins % 60;
    return `${hh}h ${mm}m`;
  };

  const stats = useMemo(() => {
    if (!attendanceList) return { studying: 0, absent: 0, away: 0, total: 70 };
    return {
      studying: attendanceList.filter(a => a.status === 'studying').length,
      absent: attendanceList.filter(a => a.studentId && a.status === 'absent').length,
      away: attendanceList.filter(a => ['away', 'break'].includes(a.status)).length,
      total: Math.max(70, attendanceList.length)
    };
  }, [attendanceList]);

  return (
    <div className={cn("flex flex-col w-full max-w-[1600px] mx-auto pb-24 min-h-screen transition-all", isMobile ? "gap-4 px-1 pt-1" : "gap-8 px-6 py-10")}>
      <header className={cn("flex justify-between items-center bg-white/80 backdrop-blur-xl border shadow-xl", isMobile ? "p-4 rounded-[1.5rem]" : "p-8 rounded-[2.5rem]")}>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Monitor className={cn("text-primary", isMobile ? "h-5 w-5" : "h-8 w-8")} />
            <h1 className={cn("font-black tracking-tighter text-primary whitespace-nowrap break-keep", isMobile ? "text-xl" : "text-4xl")}>전체 도면 및 배치</h1>
            <Badge className="bg-blue-600 text-white border-none font-black text-[10px] rounded-full px-2.5 h-5 tracking-tighter">CONFIG</Badge>
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] mt-1 ml-1">Spatial Assignment Matrix</p>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 hover:bg-primary/5 transition-all" onClick={() => window.location.reload()}>
          <RefreshCw className="h-5 w-5 opacity-40 group-hover:opacity-100" />
        </Button>
      </header>

      <div className={cn("grid gap-3", isMobile ? "grid-cols-2 px-1" : "grid-cols-4")}>
        {[
          { label: '학습 중', val: stats.studying, color: 'text-blue-600', icon: Activity, bg: 'bg-blue-50/50' },
          { label: '미입실', val: stats.absent, color: 'text-rose-600', icon: AlertCircle, bg: 'bg-rose-50/50' },
          { label: '외출/휴식', val: stats.away, color: 'text-amber-600', icon: Clock, bg: 'bg-amber-50/50' },
          { label: '배치 좌석', val: stats.total, color: 'text-primary', icon: Armchair, bg: 'bg-muted/30' }
        ].map((item, i) => (
          <Card key={i} className={cn("rounded-[1.5rem] border-none shadow-lg p-5 flex flex-col gap-1 transition-all active:scale-95", item.bg)}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{item.label}</span>
              <item.icon className={cn(isMobile ? "h-4 w-4" : "h-6 w-6", item.color)} />
            </div>
            <div className={cn("font-black tracking-tighter", isMobile ? "text-3xl" : "text-5xl", item.color)}>{item.val}</div>
          </Card>
        ))}
      </div>

      <Card className="rounded-[3.5rem] border-none shadow-2xl overflow-hidden bg-white ring-1 ring-border/50 relative flex-1 flex flex-col group">
        <CardContent className={cn("relative z-10 flex items-center justify-center flex-1", isMobile ? "p-4" : "p-10")}>
          <div className="rounded-[2.5rem] border-2 border-muted/30 p-6 sm:p-8 bg-[#fafafa] overflow-x-auto custom-scrollbar w-full">
            <div className="grid grid-cols-10 gap-2 sm:gap-3 min-w-[1000px]">
              {Array.from({ length: 10 }).map((_, colIndex) => (
                <div key={colIndex} className="flex flex-col gap-2 sm:gap-3">
                  {Array.from({ length: 7 }).map((_, rowIndex) => {
                    const seatNo = colIndex * 7 + rowIndex + 1;
                    const seatId = `seat_${seatNo.toString().padStart(3, '0')}`;
                    const seat = attendanceList?.find(a => a.id === seatId);
                    const occupant = students?.find(s => s.id === seat?.studentId);
                    
                    const isStudying = seat?.status === 'studying';
                    const isAlert = occupant && seat?.status === 'absent';
                    const isAway = seat?.status === 'away' || seat?.status === 'break';

                    return (
                      <div 
                        key={seatNo} 
                        onClick={() => occupant && seat ? (setSelectedSeat(seat), setIsManaging(true)) : (setSelectedSeat({ id: seatId, seatNo, status: 'absent', updatedAt: serverTimestamp() } as any), setIsAssigning(true))}
                        className={cn(
                          "aspect-[1.1/1] rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-500 relative overflow-hidden p-1.5 cursor-pointer shadow-sm",
                          isStudying 
                            ? "bg-blue-600 border-blue-700 text-white shadow-xl scale-[1.03] z-10" 
                            : isAway
                              ? "bg-amber-500 border-amber-600 text-white"
                              : isAlert 
                                ? "bg-rose-50 border-rose-300 text-rose-600" 
                                : occupant 
                                  ? "bg-white border-primary/20 text-primary" 
                                  : "bg-transparent border-muted/20 text-muted-foreground/30 hover:border-primary/10"
                        )}
                      >
                        <span className={cn("text-[8px] font-black absolute top-1 left-2", isStudying ? "opacity-60" : isAlert ? "text-rose-300" : "opacity-40")}>
                          {seatNo}
                        </span>
                        
                        {occupant ? (
                          <div className="flex flex-col items-center gap-0 w-full px-1">
                            <span className="text-[10px] sm:text-[12px] font-black truncate w-full text-center tracking-tighter leading-none mb-0.5">{occupant.name}</span>
                            <span className={cn("text-[7px] sm:text-[8px] font-bold tracking-tight", isStudying ? "text-white/80" : "text-muted-foreground")}>
                              {getLiveTimeLabel(seat!)}
                            </span>
                            {isStudying && <Zap className="h-2 w-2 fill-current animate-pulse text-white/50 mt-0.5" />}
                          </div>
                        ) : (
                          <span className="text-[10px] font-black opacity-10">EMPTY</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isManaging} onOpenChange={setIsManaging}>
        <DialogContent className={cn("border-none shadow-2xl p-0 overflow-hidden", isMobile ? "fixed bottom-0 top-auto translate-y-0 translate-x-0 left-0 right-0 max-w-none rounded-t-[3rem] rounded-b-none" : "rounded-[2.5rem] sm:max-w-md")}>
          {selectedSeat && (
            <>
              <div className={cn("p-10 text-white relative", selectedSeat.status === 'studying' ? "bg-blue-600" : "bg-primary")}>
                <DialogTitle className="text-4xl font-black tracking-tighter">{students?.find(s => s.id === selectedSeat.studentId)?.name || '공석'}</DialogTitle>
                <Badge className="bg-white/20 text-white border-none font-black px-3 py-1 mt-2">SEAT {selectedSeat.seatNo}</Badge>
              </div>
              <div className="p-10 space-y-5 bg-white">
                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={() => handleStatusUpdate('studying')} className="h-20 rounded-[1.75rem] font-black bg-blue-600 gap-3 text-lg"><Zap className="h-5 w-5 fill-current" /> 입실 처리</Button>
                  <Button onClick={() => handleStatusUpdate('absent')} variant="outline" className="h-20 rounded-[1.75rem] font-black border-rose-200 text-rose-600 gap-3 text-lg"><AlertCircle className="h-5 w-5" /> 퇴실 처리</Button>
                </div>
                {selectedSeat.studentId && (
                  <div className="pt-4 border-t border-dashed space-y-3">
                    <Button variant="secondary" className="w-full h-16 rounded-[1.5rem] font-black gap-4 text-primary bg-primary/5 hover:bg-primary/10 transition-all" asChild>
                      <Link href={`/dashboard/teacher/students/${selectedSeat.studentId}`}>
                        <User className="h-5 w-5 opacity-40" />
                        학생 상세 분석 리포트
                        <ChevronRight className="ml-auto h-5 w-5 opacity-20" />
                      </Link>
                    </Button>
                    <Button variant="ghost" onClick={unassignStudentFromSeat} disabled={isSaving} className="w-full h-12 rounded-2xl font-black text-rose-600 hover:bg-rose-50">좌석 배정 해제</Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAssigning} onOpenChange={setIsAssigning}>
        <DialogContent className={cn("border-none shadow-2xl p-0 overflow-hidden", isMobile ? "fixed bottom-0 top-auto translate-y-0 translate-x-0 left-0 right-0 max-w-none rounded-t-[3rem] rounded-b-none" : "rounded-[2.5rem] sm:max-w-md")}>
          <div className="bg-primary p-8 text-white relative">
            <DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3"><UserPlus className="h-7 w-7" /> 학생 좌석 배정</DialogTitle>
            <p className="text-white/60 font-bold mt-1 text-sm">SEAT NO. {selectedSeat?.seatNo}</p>
          </div>
          <div className="p-6 space-y-4 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              <Input placeholder="이름으로 찾기..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="rounded-xl border-2 pl-10 h-11 text-sm font-bold" />
            </div>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {unassignedStudents.map((student) => (
                  <div key={student.id} onClick={() => assignStudentToSeat(student)} className="p-4 rounded-2xl border-2 border-transparent hover:border-primary/10 hover:bg-primary/5 cursor-pointer flex items-center justify-between group transition-all">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center font-black text-primary">{student.name.charAt(0)}</div>
                      <div className="grid gap-0.5"><span className="font-black text-sm">{student.name}</span><span className="text-[10px] font-bold text-muted-foreground">{student.schoolName}</span></div>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-40 group-hover:opacity-100" />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
