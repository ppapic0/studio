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

const GRID_WIDTH = 20;
const GRID_HEIGHT = 10;

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

  // 2. 학생들의 멤버십 정보 (상태 확인용)
  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'student'));
  }, [firestore, centerId]);
  const { data: studentMembers } = useCollection<CenterMembership>(membersQuery);

  // 3. 실시간 좌석 상태 조회
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery);

  // 4. 오늘 모든 학생의 학습 로그 조회
  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return query(
      collectionGroup(firestore, 'days'),
      where('centerId', '==', centerId),
      where('dateKey', '==', todayKey)
    );
  }, [firestore, centerId, todayKey]);
  const { data: todayLogs } = useCollection<StudyLogDay>(logsQuery);

  const seatBounds = useMemo(() => {
    if (!attendanceList || attendanceList.length === 0) return null;
    let minX = GRID_WIDTH, maxX = 0, minY = GRID_HEIGHT, maxY = 0;
    attendanceList.forEach(s => {
      if (s.gridX !== undefined && s.gridY !== undefined) {
        minX = Math.min(minX, s.gridX); maxX = Math.max(maxX, s.gridX);
        minY = Math.min(minY, s.gridY); maxY = Math.max(maxY, s.gridY);
      }
    });
    return { minX, maxX, minY, maxY };
  }, [attendanceList]);

  const gridDimensions = useMemo(() => {
    if (!seatBounds) return { cols: GRID_WIDTH, rows: GRID_HEIGHT, startX: 0, startY: 0 };
    return {
      cols: seatBounds.maxX - seatBounds.minX + 1,
      rows: seatBounds.maxY - seatBounds.minY + 1,
      startX: seatBounds.minX,
      startY: seatBounds.minY
    };
  }, [seatBounds]);

  // 배정되지 않은 재원생만 필터링
  const unassignedStudents = useMemo(() => {
    if (!students || !studentMembers) return [];
    return students.filter(s => {
      const membership = studentMembers.find(m => m.id === s.id);
      const isActiveMember = membership?.status === 'active';
      const hasNoSeat = !s.seatNo || s.seatNo === 0;
      return isActiveMember && hasNoSeat;
    }).filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [students, studentMembers, searchTerm]);

  const handleStatusUpdate = async (status: AttendanceCurrent['status']) => {
    if (!firestore || !centerId || !selectedSeat) return;
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id), { status, updatedAt: serverTimestamp() });
      toast({ title: "변경 완료" });
      setIsManaging(false);
    } catch (e) { toast({ variant: "destructive", title: "변경 실패" }); }
  };

  const assignStudentToSeat = async (student: StudentProfile) => {
    if (!firestore || !centerId || !selectedSeat) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'centers', centerId, 'students', student.id), { 
        seatNo: selectedSeat.seatNo, 
        updatedAt: serverTimestamp() 
      });
      batch.update(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id), { 
        studentId: student.id, 
        status: 'absent',
        updatedAt: serverTimestamp() 
      });
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
      batch.update(doc(firestore, 'centers', centerId, 'students', selectedSeat.studentId), { 
        seatNo: 0, 
        updatedAt: serverTimestamp() 
      });
      batch.update(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id), { 
        studentId: null, 
        status: 'absent',
        updatedAt: serverTimestamp() 
      });
      await batch.commit();
      toast({ title: "배정 해제 완료" });
      setIsManaging(false);
    } catch (e) { toast({ variant: "destructive", title: "해제 실패" }); } finally { setIsSaving(false); }
  };

  const stats = useMemo(() => {
    if (!attendanceList) return { studying: 0, absent: 0, away: 0, total: 0 };
    return {
      studying: attendanceList.filter(a => a.status === 'studying').length,
      absent: attendanceList.filter(a => a.studentId && a.status === 'absent').length,
      away: attendanceList.filter(a => ['away', 'break'].includes(a.status)).length,
      total: attendanceList.length
    };
  }, [attendanceList]);

  const getLiveTimeLabel = (seat: AttendanceCurrent) => {
    if (!seat.studentId) return '0h 0m';
    
    const studentLog = todayLogs?.find(l => l.studentId === seat.studentId);
    let totalMins = studentLog?.totalMinutes || 0;

    if (seat.status === 'studying' && seat.lastCheckInAt) {
      const startTime = seat.lastCheckInAt.toMillis();
      const sessionMins = Math.floor((now - startTime) / 60000);
      totalMins += Math.max(0, sessionMins);
    }

    const hh = Math.floor(totalMins / 60);
    const mm = totalMins % 60;
    return `${hh}h ${mm}m`;
  };

  return (
    <div className={cn("flex flex-col w-full max-w-[1600px] mx-auto pb-24 min-h-screen transition-all", isMobile ? "gap-4 px-1 pt-1" : "gap-8 px-6 py-10")}>
      <header className={cn("flex justify-between items-center bg-white/80 backdrop-blur-xl border shadow-xl", isMobile ? "p-4 rounded-[1.5rem]" : "p-8 rounded-[2.5rem]")}>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Monitor className={cn("text-primary", isMobile ? "h-5 w-5" : "h-8 w-8")} />
            <h1 className={cn("font-black tracking-tighter text-primary whitespace-nowrap break-keep", isMobile ? "text-xl" : "text-4xl")}>실시간 관제</h1>
            <div className="flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">LIVE</span>
            </div>
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] mt-1 ml-1">Command & Control Matrix</p>
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

      <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white ring-1 ring-border/50 relative flex-1 flex flex-col group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent pointer-events-none" />
        <CardContent className={cn("relative z-10 flex items-center justify-center flex-1", isMobile ? "p-4" : "p-10")}>
          {studentsLoading || attendanceLoading ? (
            <div className="flex flex-col items-center gap-4 py-40">
              <Loader2 className="animate-spin h-12 w-12 text-primary opacity-20" />
              <p className="font-black text-[10px] uppercase tracking-[0.4em] text-muted-foreground/40 italic">Initializing live matrix...</p>
            </div>
          ) : !attendanceList?.length ? (
            <div className="text-center opacity-20 py-40 flex flex-col items-center gap-4">
              <Armchair className="h-20 w-20 mx-auto" />
              <p className="text-sm font-black uppercase tracking-widest italic">No Seats Configured</p>
            </div>
          ) : (
            <div className={cn("w-full bg-white relative", isMobile ? "p-2 rounded-2xl border" : "p-10 rounded-[2rem] border shadow-2xl")}>
              <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              <div 
                className="grid w-full mx-auto relative z-10 gap-1.5 sm:gap-2"
                style={{ gridTemplateColumns: `repeat(${gridDimensions.cols}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: gridDimensions.rows * gridDimensions.cols }).map((_, idx) => {
                  const x = gridDimensions.startX + (idx % gridDimensions.cols);
                  const y = gridDimensions.startY + Math.floor(idx / gridDimensions.cols);
                  const seat = attendanceList.find(a => a.gridX === x && a.gridY === y);
                  const occupant = students?.find(s => s.id === seat?.studentId);
                  if (!seat) return <div key={idx} className="aspect-square opacity-0" />;

                  const isStudying = seat.status === 'studying';
                  const isAlert = seat.studentId && seat.status === 'absent';

                  return (
                    <div 
                      key={seat.id} 
                      onClick={() => { 
                        setSelectedSeat(seat); 
                        if (occupant) setIsManaging(true);
                        else setIsAssigning(true);
                      }}
                      className={cn(
                        "aspect-square rounded-lg sm:rounded-xl border-2 flex flex-col items-center justify-center transition-all relative cursor-pointer shadow-sm active:scale-[0.85] hover:z-20 p-1",
                        isStudying ? "bg-blue-600 border-blue-700 text-white shadow-xl shadow-blue-600/20 z-10 scale-105" : 
                        isAlert ? "bg-rose-50 border-rose-400 text-rose-700" :
                        seat.status === 'away' || seat.status === 'break' ? "bg-amber-500 border-amber-600 text-white" : 
                        occupant ? "bg-white border-primary/20 text-primary hover:border-primary/50" : "bg-muted/5 border-transparent"
                      )}
                    >
                      <span className={cn("font-black absolute top-1 left-1.5 text-[8px] tracking-tighter", isStudying ? "opacity-60" : "opacity-30")}>{seat.seatNo}</span>
                      <span className="font-black truncate w-full text-center text-[11px] leading-tight px-1">{occupant?.name || ''}</span>
                      {occupant && <span className={cn("text-[9px] font-bold mt-1 tracking-tighter", isStudying ? "text-white" : "text-primary/60")}>{getLiveTimeLabel(seat)}</span>}
                      {isStudying && <Activity className="h-2 w-2 animate-pulse absolute bottom-1.5" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 좌석 상태 정보 범례 */}
      <section className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-3 border shadow-lg flex flex-wrap gap-2 justify-center items-center ring-1 ring-border/50">
        {[
          { label: '학습 중 (입실)', color: 'bg-blue-600' },
          { label: '미입실 (퇴실)', color: 'bg-rose-500' },
          { label: '외출/휴식', color: 'bg-amber-500' },
          { label: '미배정/공석', color: 'bg-muted/30 border border-muted' }
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 bg-white/80 px-4 py-2 rounded-2xl border border-white shadow-sm transition-all hover:scale-105">
            <div className={cn("w-2 h-2 rounded-full", item.color)} />
            <span className="text-[10px] font-black text-foreground/60 uppercase tracking-widest">{item.label}</span>
          </div>
        ))}
      </section>

      {/* 상태 관리 모달 */}
      <Dialog open={isManaging} onOpenChange={setIsManaging}>
        <DialogContent className={cn("border-none shadow-[0_-20px_80px_rgba(0,0,0,0.2)] p-0 overflow-hidden", isMobile ? "fixed bottom-0 top-auto translate-y-0 translate-x-0 left-0 right-0 max-w-none rounded-t-[3rem] rounded-b-none" : "rounded-[2.5rem] sm:max-w-md")}>
          {selectedSeat && (
            <>
              <div className={cn("p-10 text-white relative overflow-hidden transition-colors duration-500", selectedSeat.status === 'studying' ? "bg-blue-600" : "bg-primary")}>
                <Sparkles className="absolute -top-10 -right-10 h-48 w-48 opacity-10 rotate-12" />
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-white/20 text-white border-none font-black px-3 py-1">SEAT {selectedSeat.seatNo}</Badge>
                </div>
                <DialogTitle className="text-5xl font-black tracking-tighter">{students?.find(s => s.id === selectedSeat.studentId)?.name || '공석'}</DialogTitle>
                <p className="text-white/60 font-bold text-sm mt-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> 실시간 상태 업데이트 중
                </p>
              </div>
              <div className="p-10 space-y-5 bg-white">
                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={() => handleStatusUpdate('studying')} className="h-20 rounded-[1.75rem] font-black bg-blue-600 gap-3 text-lg shadow-xl hover:bg-blue-700 transition-all active:scale-90"><Zap className="h-5 w-5 fill-current" /> 입실 처리</Button>
                  <Button onClick={() => handleStatusUpdate('away')} className="h-20 rounded-[1.75rem] font-black bg-amber-500 gap-3 text-lg shadow-xl hover:bg-amber-600 transition-all active:scale-90"><MapPin className="h-5 w-5" /> 외출 중</Button>
                  <Button onClick={() => handleStatusUpdate('break')} className="h-20 rounded-[1.75rem] font-black bg-blue-400 gap-3 text-lg shadow-xl hover:bg-blue-500 transition-all active:scale-90"><Maximize2 className="h-5 w-5" /> 휴식 중</Button>
                  <Button onClick={() => handleStatusUpdate('absent')} variant="outline" className="h-20 rounded-[1.75rem] font-black border-rose-200 text-rose-600 gap-3 text-lg hover:bg-rose-50 transition-all active:scale-90"><AlertCircle className="h-5 w-5" /> 퇴실 처리</Button>
                </div>
                {selectedSeat.studentId && (
                  <div className="pt-4 border-t border-dashed space-y-3">
                    <Button variant="secondary" className="w-full h-16 rounded-[1.5rem] font-black gap-4 text-primary bg-primary/5 hover:bg-primary/10 transition-all" asChild>
                      <Link href={`/dashboard/teacher/students/${selectedSeat.studentId}`}>
                        <User className="h-5 w-5 opacity-40" />
                        학생 상세 분석 리포트
                        <ChevronRight className="ml-auto h-5 w-5 opacity-20" />
                      </a >
                    </Button>
                    <Button variant="ghost" onClick={unassignStudentFromSeat} disabled={isSaving} className="w-full h-14 rounded-2xl font-black text-rose-600 hover:bg-rose-50 gap-3">
                      <UserMinus className="h-4 w-4" /> 좌석 배정 해제
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 학생 배정 모달 */}
      <Dialog open={isAssigning} onOpenChange={setIsAssigning}>
        <DialogContent className={cn("border-none shadow-2xl p-0 overflow-hidden", isMobile ? "fixed bottom-0 top-auto translate-y-0 translate-x-0 left-0 right-0 max-w-none rounded-t-[3rem] rounded-b-none" : "rounded-[2.5rem] sm:max-w-md")}>
          <div className="bg-primary p-8 text-white relative overflow-hidden">
            <Sparkles className="absolute -top-10 -right-10 h-40 w-40 opacity-10 animate-pulse" />
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-white/20 text-white border-none font-black px-3 py-1">SEAT {selectedSeat?.seatNo}</Badge>
            </div>
            <DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
              <UserPlus className="h-7 w-7 text-accent" /> 학생 좌석 배정
            </DialogTitle>
            <DialogDescription className="text-white/60 font-bold mt-1">이 좌석에 배정할 학생을 선택해 주세요.</DialogDescription>
          </div>
          
          <div className="p-6 space-y-4 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              <Input 
                placeholder="이름으로 찾기..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-xl border-2 pl-10 h-11 text-sm font-bold"
              />
            </div>
            
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {studentsLoading ? (
                  <div className="py-10 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-primary/20" /></div>
                ) : unassignedStudents.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground/40 font-bold italic text-xs">배정 가능한 재원생이 없습니다.</div>
                ) : (
                  unassignedStudents.map((student) => (
                    <div 
                      key={student.id} 
                      onClick={() => assignStudentToSeat(student)}
                      className="p-4 rounded-2xl border-2 border-transparent hover:border-primary/10 hover:bg-primary/5 cursor-pointer flex items-center justify-between group transition-all active:scale-95"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center font-black text-primary">
                          {student.name.charAt(0)}
                        </div>
                        <div className="grid gap-0.5">
                          <span className="font-black text-sm">{student.name}</span>
                          <span className="text-[10px] font-bold text-muted-foreground">{student.schoolName} · {student.grade}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-40 transition-all" />
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter className="p-6 bg-muted/10 border-t">
            <Button variant="ghost" onClick={() => setIsAssigning(false)} className="w-full h-12 rounded-xl font-black">취소</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
