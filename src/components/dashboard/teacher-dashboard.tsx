
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
  X,
  Map,
  ArrowRightLeft,
  Grid3X3,
  Save
} from 'lucide-react';
import { useCollection, useFirestore, useDoc } from '@/firebase';
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
  writeBatch,
  setDoc
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

  // 그리드 설정 상태
  const [gridRows, setGridRows] = useState(7);
  const [gridCols, setGridCols] = useState(10);

  useEffect(() => {
    // 1초마다 현재 시간을 업데이트하여 실시간 타이머 구현
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const centerId = activeMembership?.id;
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  // 0. 센터 설정 (그리드 크기 등)
  const centerRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId);
  }, [firestore, centerId]);
  const { data: centerData } = useDoc<any>(centerRef);

  useEffect(() => {
    if (centerData?.layoutSettings) {
      setGridRows(centerData.layoutSettings.rows || 7);
      setGridCols(centerData.layoutSettings.cols || 10);
    }
  }, [centerData]);

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

  // 4. 오늘 학습 로그 (실시간 합산용)
  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return query(
      collectionGroup(firestore, 'days'),
      where('centerId', '==', centerId),
      where('dateKey', '==', todayKey)
    );
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

  const getLiveTimeInMinutes = (studentId: string, status: string, lastCheckInAt?: Timestamp) => {
    const studentLog = todayLogs?.find(l => l.studentId === studentId);
    let totalMins = studentLog?.totalMinutes || 0;
    
    // 만약 학생의 로그가 1분 이내에 업데이트되었다면 강제로 studying 상태인 것으로 간주하여 라이브 합산 (김재윤 학생 케이스 해결)
    const logUpdatedAt = studentLog?.updatedAt?.toMillis() || 0;
    const isRecentlyActive = (now - logUpdatedAt) < 60000;

    if ((status === 'studying' || isRecentlyActive) && lastCheckInAt) {
      const startTime = lastCheckInAt.toMillis();
      // 세션 시작 이후 흐른 시간 합산
      const elapsed = Math.floor((now - startTime) / 60000);
      if (elapsed > 0) totalMins += elapsed;
    }
    return totalMins;
  };

  const getLiveTimeLabel = (studentId: string, status: string, lastCheckInAt?: Timestamp) => {
    const totalMins = getLiveTimeInMinutes(studentId, status, lastCheckInAt);
    const hh = Math.floor(totalMins / 60);
    const mm = totalMins % 60;
    return `${hh}h ${mm}m`;
  };

  const metrics = useMemo(() => {
    if (!attendanceList || !students) return { totalCenterMinutes: 0, avgMinutes: 0, top20Avg: 0 };
    
    const activeSeats = attendanceList.filter(a => !!a.studentId && a.type !== 'aisle');
    const allLiveMinutes = activeSeats.map(a => getLiveTimeInMinutes(a.studentId!, a.status, a.lastCheckInAt));
    
    const totalCenterMinutes = allLiveMinutes.reduce((acc, m) => acc + m, 0);
    const avgMinutes = allLiveMinutes.length > 0 ? Math.round(totalCenterMinutes / allLiveMinutes.length) : 0;
    
    const sortedMinutes = [...allLiveMinutes].sort((a, b) => b - a);
    const top20Count = Math.max(1, Math.ceil(sortedMinutes.length * 0.2));
    const top20Avg = Math.round(sortedMinutes.slice(0, top20Count).reduce((acc, m) => acc + m, 0) / top20Count);

    return { totalCenterMinutes, avgMinutes, top20Avg };
  }, [attendanceList, todayLogs, now, students]);

  const stats = useMemo(() => {
    if (!attendanceList) return { studying: 0, absent: 0, away: 0, total: 0 };
    const actualSeats = attendanceList.filter(a => a.type !== 'aisle');
    return {
      studying: actualSeats.filter(a => a.status === 'studying').length,
      absent: actualSeats.filter(a => a.studentId && a.status === 'absent').length,
      away: actualSeats.filter(a => a.status === 'away' || a.status === 'break').length,
      total: actualSeats.length
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

  const handleSaveGridSettings = async () => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      await setDoc(doc(firestore, 'centers', centerId), {
        layoutSettings: {
          rows: gridRows,
          cols: gridCols,
          updatedAt: serverTimestamp()
        }
      }, { merge: true });
      toast({ title: "그리드 크기가 저장되었습니다." });
    } catch (e) {
      toast({ variant: "destructive", title: "저장 실패" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleCellType = async () => {
    if (!firestore || !centerId || !selectedSeat) return;
    const nextType = selectedSeat.type === 'aisle' ? 'seat' : 'aisle';
    
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const seatRef = doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id);
      
      if (nextType === 'aisle' && selectedSeat.studentId) {
        batch.update(doc(firestore, 'centers', centerId, 'students', selectedSeat.studentId), { seatNo: 0, updatedAt: serverTimestamp() });
        batch.set(seatRef, { type: 'aisle', studentId: null, status: 'absent', updatedAt: serverTimestamp() }, { merge: true });
      } else {
        batch.set(seatRef, { type: nextType, updatedAt: serverTimestamp() }, { merge: true });
      }

      await batch.commit();
      toast({ title: nextType === 'aisle' ? "통로로 변경됨" : "좌석으로 변경됨" });
      setIsManaging(false);
      setIsAssigning(false);
    } catch (e) { toast({ variant: "destructive", title: "변경 실패" }); } finally { setIsSaving(false); }
  };

  const assignStudentToSeat = async (student: StudentProfile) => {
    if (!firestore || !centerId || !selectedSeat) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const seatId = selectedSeat.id;
      batch.update(doc(firestore, 'centers', centerId, 'students', student.id), { seatNo: selectedSeat.seatNo, updatedAt: serverTimestamp() });
      batch.set(doc(firestore, 'centers', centerId, 'attendanceCurrent', seatId), { studentId: student.id, status: 'absent', type: 'seat', updatedAt: serverTimestamp() }, { merge: true });
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
      batch.set(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id), { studentId: null, status: 'absent', updatedAt: serverTimestamp() }, { merge: true });
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
      if (seat.studentId && seat.type !== 'aisle') setIsManaging(true);
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

      {isEditMode && (
        <Card className="mx-4 rounded-[2.5rem] border-none shadow-xl bg-primary text-primary-foreground p-8 flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl"><Grid3X3 className="h-6 w-6 text-white" /></div>
            <div className="grid">
              <h3 className="text-xl font-black tracking-tight">그리드 크기 설정</h3>
              <p className="text-xs font-bold opacity-60">센터 규모에 맞춰 가로/세로 좌석 수를 조절하세요.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="grid gap-1.5">
              <Label className="text-[10px] font-black uppercase opacity-60 ml-1">가로 (열)</Label>
              <Input type="number" value={gridCols} onChange={e => setGridCols(Number(e.target.value))} className="w-24 h-12 bg-white text-primary rounded-xl font-black text-center" />
            </div>
            <X className="h-4 w-4 opacity-40 mt-6" />
            <div className="grid gap-1.5">
              <Label className="text-[10px] font-black uppercase opacity-60 ml-1">세로 (행)</Label>
              <Input type="number" value={gridRows} onChange={e => setGridRows(Number(e.target.value))} className="w-24 h-12 bg-white text-primary rounded-xl font-black text-center" />
            </div>
            <Button onClick={handleSaveGridSettings} disabled={isSaving} className="h-12 rounded-xl px-6 bg-white text-primary font-black hover:bg-white/90 gap-2 mt-6 shadow-xl active:scale-95 transition-all">
              {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />} 설정 저장
            </Button>
          </div>
        </Card>
      )}

      <Card className={cn(
        "rounded-[3.5rem] border-none shadow-xl bg-white mx-4 overflow-hidden transition-all duration-500",
        isEditMode ? "ring-4 ring-primary/20" : ""
      )}>
        <CardHeader className="bg-muted/5 border-b px-10 py-6">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
              <Armchair className="h-5 w-5 opacity-40" /> 
              {isEditMode ? '공간 배치 및 통로 수정' : '실시간 좌석 상황판'}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/40 font-black text-[9px] px-3 h-6 uppercase">Seat Plan: {gridCols}x{gridRows}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 sm:p-10">
          <ScrollArea className="w-full max-w-full">
            <div className="rounded-[2.5rem] border-2 border-muted/30 p-6 sm:p-8 bg-[#fafafa] w-max mx-auto">
              <div 
                className="grid gap-2 sm:gap-3" 
                style={{ 
                  gridTemplateColumns: `repeat(${gridCols}, minmax(85px, 1fr))`,
                }}
              >
                {Array.from({ length: gridCols }).map((_, colIndex) => (
                  <div key={colIndex} className="flex flex-col gap-2 sm:gap-3">
                    {Array.from({ length: gridRows }).map((_, rowIndex) => {
                      const seatNo = colIndex * gridRows + rowIndex + 1;
                      const seatId = `seat_${seatNo.toString().padStart(3, '0')}`;
                      const seat = attendanceList?.find(a => a.id === seatId) || { id: seatId, seatNo, status: 'absent', type: 'seat' } as AttendanceCurrent;
                      const student = students?.find(s => s.id === seat?.studentId);
                      
                      // 김재윤 학생 케이스 보정: 로그가 최근 갱신되었다면 강제로 studying 상태로 간주
                      const studentLog = todayLogs?.find(l => l.studentId === student?.id);
                      const logUpdatedAt = studentLog?.updatedAt?.toMillis() || 0;
                      const isRecentlyActive = (now - logUpdatedAt) < 60000;

                      const isAisle = seat?.type === 'aisle';
                      const isStudying = seat?.status === 'studying' || (student && isRecentlyActive);
                      const isAbsent = student && !isStudying && seat?.status === 'absent';
                      const isAway = seat?.status === 'away' || seat?.status === 'break';

                      return (
                        <div 
                          key={seatNo} 
                          onClick={() => handleSeatClick(seat)}
                          className={cn(
                            "aspect-square min-w-[85px] rounded-2xl flex flex-col items-center justify-center transition-all duration-500 relative overflow-hidden p-2 cursor-pointer shadow-sm border-2",
                            isAisle 
                              ? "bg-transparent border-transparent text-transparent hover:bg-muted/10 hover:border-dashed hover:border-muted-foreground/20" 
                              : isStudying 
                                ? "bg-blue-600 border-blue-700 text-white shadow-xl scale-[1.03] z-10" 
                                : isAway
                                  ? "bg-amber-500 border-amber-600 text-white"
                                  : isAbsent 
                                    ? "bg-rose-50 border-rose-300 text-rose-600" 
                                    : student 
                                      ? "bg-white border-primary/30 text-primary" 
                                      : "bg-white border-primary/40 text-primary/10 hover:border-primary/60",
                            isEditMode && isAisle && "border-dashed border-muted-foreground/20 text-muted-foreground/20 bg-muted/5"
                          )}
                        >
                          {!isAisle && (
                            <span className={cn("text-[8px] font-black absolute top-1 left-2", isStudying ? "opacity-60" : isAbsent ? "text-rose-300" : "opacity-40")}>
                              {seatNo}
                            </span>
                          )}
                          
                          {isAisle ? (
                            isEditMode && <Map className="h-4 w-4 opacity-40" />
                          ) : student ? (
                            <div className="flex flex-col items-center gap-0 w-full px-1">
                              <span className="text-[10px] sm:text-[11px] font-black truncate w-full text-center tracking-tighter leading-none mb-0.5">{student.name}</span>
                              <span className={cn("text-[7px] sm:text-[8px] font-bold tracking-tight", isStudying ? "text-white/80" : "text-muted-foreground")}>
                                {getLiveTimeLabel(student.id, isStudying ? 'studying' : seat.status, seat.lastCheckInAt)}
                              </span>
                              {isStudying && <Zap className="h-2 w-2 fill-current animate-pulse text-white/50 mt-0.5" />}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <span className="text-[8px] font-black tracking-tighter opacity-100 uppercase">Empty</span>
                              {isEditMode && <UserPlus className="h-3 w-3 mt-1 text-primary/40" />}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
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
        <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl sm:max-w-md")}>
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
                  <div className="grid gap-3">
                    <Button variant="destructive" onClick={unassignStudentFromSeat} disabled={isSaving} className="w-full h-16 rounded-2xl font-black text-lg shadow-xl shadow-rose-200">
                      {isSaving ? <Loader2 className="animate-spin" /> : '좌석 배정 해제'}
                    </Button>
                    <Button variant="outline" onClick={handleToggleCellType} disabled={isSaving} className="w-full h-12 rounded-xl font-black gap-2 border-2">
                      <ArrowRightLeft className="h-4 w-4" /> 통로로 전환하기
                    </Button>
                  </div>
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
        <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl sm:max-w-md")}>
          <div className="bg-primary p-8 text-white relative">
            <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><UserPlus className="h-24 w-24" /></div>
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
                {selectedSeat?.type === 'aisle' ? <Map className="h-7 w-7" /> : <UserPlus className="h-7 w-7" />}
                {selectedSeat?.type === 'aisle' ? '공간 설정' : '학생 좌석 배정'}
              </DialogTitle>
              <p className="text-white/60 font-bold mt-1 text-sm">GRID ID: {selectedSeat?.seatNo}</p>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-6 bg-white">
            {isEditMode && (
              <div className="p-4 rounded-2xl bg-muted/30 border-2 border-dashed border-primary/20">
                <Button 
                  onClick={handleToggleCellType} 
                  className={cn(
                    "w-full h-14 rounded-xl font-black gap-2 transition-all",
                    selectedSeat?.type === 'aisle' ? "bg-primary text-white" : "bg-white text-primary border-2"
                  )}
                >
                  <ArrowRightLeft className="h-4 w-4" /> 
                  {selectedSeat?.type === 'aisle' ? '좌석으로 사용하기' : '통로로 전환하기'}
                </Button>
                <p className="text-[10px] font-bold text-center mt-3 text-muted-foreground">
                  통로로 전환 시 해당 칸은 번호가 부여되지 않으며 좌석 수에서 제외됩니다.
                </p>
              </div>
            )}

            {selectedSeat?.type !== 'aisle' && (
              <div className="space-y-4">
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
            )}
          </div>
          <DialogFooter className="p-6 bg-muted/20 border-t flex justify-center"><Button variant="ghost" onClick={() => setIsAssigning(false)} className="font-bold text-muted-foreground">취소</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
