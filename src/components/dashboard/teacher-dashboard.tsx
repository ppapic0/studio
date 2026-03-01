'use client';

import { useState, useMemo } from 'react';
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
import { 
  Armchair, 
  Users, 
  Loader2, 
  Settings2,
  Monitor,
  MessageSquare,
  ChevronRight,
  AlertCircle,
  Clock,
  MapPin,
  Maximize2,
  CircleDot,
  CheckCircle2,
  BarChart3,
  ArrowRight,
  Activity
} from 'lucide-react';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { 
  collection, 
  query, 
  orderBy, 
  writeBatch, 
  doc, 
  serverTimestamp,
  where,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { StudentProfile, AttendanceCurrent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format, startOfDay, endOfDay } from 'date-fns';

const GRID_WIDTH = 20;
const GRID_HEIGHT = 10;

export function TeacherDashboard({ isActive }: { isActive: boolean }) {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const isMobileView = viewMode === 'mobile';
  
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isManagingSeatModalOpen, setIsManagingSeatModalOpen] = useState(false);
  
  const [selectedSeatForAssign, setSelectedSeatForAssign] = useState<{id: string, seatNo: number} | null>(null);
  const [selectedSeatForManage, setSelectedSeatForManage] = useState<AttendanceCurrent | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [tempLayout, setTempLayout] = useState<{ x: number, y: number, seatNo: number }[]>([]);

  const centerId = activeMembership?.id;

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'students'), orderBy('name', 'asc'));
  }, [firestore, centerId]);
  const { data: students, isLoading: studentsLoading } = useCollection<StudentProfile>(studentsQuery, { enabled: isActive });

  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery, { enabled: isActive });

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

  const appointments = useMemo(() => {
    if (!rawAppointments) return [];
    return [...rawAppointments].sort((a, b) => (a.scheduledAt?.toMillis() || 0) - (b.scheduledAt?.toMillis() || 0));
  }, [rawAppointments]);

  const seatBounds = useMemo(() => {
    if (!attendanceList || attendanceList.length === 0) return null;
    
    let minX = GRID_WIDTH, maxX = 0, minY = GRID_HEIGHT, maxY = 0;
    attendanceList.forEach(s => {
      if (s.gridX !== undefined && s.gridY !== undefined) {
        minX = Math.min(minX, s.gridX);
        maxX = Math.max(maxX, s.gridX);
        minY = Math.min(minY, s.gridY);
        maxY = Math.max(maxY, s.gridY);
      }
    });

    const padding = 1;
    return {
      minX: Math.max(0, minX - padding),
      maxX: Math.min(GRID_WIDTH - 1, maxX + padding),
      minY: Math.max(0, minY - padding),
      maxY: Math.min(GRID_HEIGHT - 1, maxY + padding),
    };
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

  const openLayoutEditor = () => {
    if (attendanceList && attendanceList.length > 0) {
      const sorted = [...attendanceList].sort((a, b) => a.seatNo - b.seatNo);
      setTempLayout(sorted.map((a) => ({
        x: a.gridX || 0,
        y: a.gridY || 0,
        seatNo: a.seatNo
      })));
    } else {
      setTempLayout([]);
    }
    setIsLayoutModalOpen(true);
  };

  const handleGridClick = (x: number, y: number) => {
    const existingIndex = tempLayout.findIndex(s => s.x === x && s.y === y);
    if (existingIndex !== -1) {
      const newList = tempLayout.filter((_, i) => i !== existingIndex);
      setTempLayout(newList.map((s, i) => ({ ...s, seatNo: i + 1 })));
    } else {
      setTempLayout([...tempLayout, { x, y, seatNo: tempLayout.length + 1 }]);
    }
  };

  const saveLayout = async () => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      if (attendanceList) {
        attendanceList.forEach(a => batch.delete(doc(firestore, 'centers', centerId, 'attendanceCurrent', a.id)));
      }
      tempLayout.forEach(s => {
        const seatId = `seat_${s.seatNo.toString().padStart(3, '0')}`;
        batch.set(doc(firestore, 'centers', centerId, 'attendanceCurrent', seatId), {
          seatNo: s.seatNo,
          gridX: s.x,
          gridY: s.y,
          status: 'absent',
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      toast({ title: "레이아웃 저장 완료" });
      setIsLayoutModalOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "저장 실패" });
    } finally {
      setIsSaving(false);
    }
  };

  const assignStudentToSeat = async (student: StudentProfile) => {
    if (!firestore || !centerId || !selectedSeatForAssign) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'centers', centerId, 'students', student.id), {
        seatNo: selectedSeatForAssign.seatNo,
        updatedAt: serverTimestamp()
      });
      batch.update(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeatForAssign.id), {
        studentId: student.id,
        updatedAt: serverTimestamp()
      });
      await batch.commit();
      toast({ title: `${student.name} 학생이 ${selectedSeatForAssign.seatNo}번 좌석에 배정되었습니다.` });
      setIsAssignModalOpen(false);
      setSelectedSeatForAssign(null);
    } catch (e) {
      toast({ variant: "destructive", title: "배정 실패" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusUpdate = async (status: AttendanceCurrent['status']) => {
    if (!firestore || !centerId || !selectedSeatForManage) return;
    try {
      const seatRef = doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeatForManage.id);
      await updateDoc(seatRef, {
        status,
        updatedAt: serverTimestamp()
      });
      toast({ title: `상태가 ${status}로 변경되었습니다.` });
      setIsManagingSeatModalOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "변경 실패" });
    }
  };

  if (!isActive) return null;

  const studyingCount = attendanceList?.filter(a => a.status === 'studying').length ?? 0;
  const alertCount = attendanceList?.filter(a => a.studentId && a.status === 'absent').length ?? 0;

  return (
    <div className="flex flex-col gap-5 w-full">
      <div className="flex flex-col gap-1 px-1">
        <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 text-primary">
          <Monitor className="h-5 w-5 text-primary" />
          실시간 관제 대시보드
        </h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Real-time Command</p>
      </div>

      <div className={cn("grid gap-3", isMobileView ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4")}>
        {[
          { label: '현재 학습 중', val: studyingCount, color: 'text-emerald-600', icon: Users, sub: '실시간 몰입도' },
          { label: '미입실/지각', val: alertCount, color: 'text-rose-600', icon: AlertCircle, sub: '즉각 관리 대상' },
          { label: '외출/휴식', val: attendanceList?.filter(a => ['away', 'break'].includes(a.status)).length || 0, color: 'text-amber-600', icon: Clock, sub: '이동 중' },
          { label: '전체 배치 좌석', val: attendanceList?.length || 0, color: 'text-primary', icon: Armchair, sub: '관리 중인 좌석' }
        ].map((item, i) => (
          <Card key={i} className="rounded-2xl border-none shadow-sm bg-white overflow-hidden group transition-all hover:shadow-md border border-border/50">
            <CardHeader className="p-3.5 pb-1">
              <div className="flex justify-between items-start">
                <CardDescription className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{item.label}</CardDescription>
                <div className={cn("p-1 rounded-lg bg-opacity-5", item.color.replace('text-', 'bg-'))}>
                  <item.icon className={cn("h-3 w-3", item.color)} />
                </div>
              </div>
              <CardTitle className={cn("text-lg font-black mt-0.5", item.color)}>{item.val}</CardTitle>
            </CardHeader>
            <CardContent className="px-3.5 pb-2.5">
              <div className="text-[8px] font-bold text-muted-foreground/60 uppercase">{item.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className={cn("grid gap-6", isMobileView ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3")}>
        <Card className={cn("rounded-[2rem] border-none shadow-xl overflow-hidden bg-white ring-1 ring-border/50", isMobileView ? "" : "lg:col-span-2")}>
          <CardHeader className={cn("bg-muted/5 border-b", isMobileView ? "p-5" : "sm:p-8")}>
            <div className={cn("flex justify-between gap-4", isMobileView ? "flex-col" : "sm:flex-row sm:items-center")}>
              <div className="space-y-1">
                <CardTitle className="text-xl sm:text-2xl font-black flex items-center gap-2 tracking-tighter break-keep whitespace-nowrap">
                  <Armchair className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> 실시간 좌석 도면
                </CardTitle>
                <CardDescription className="font-bold text-[10px] sm:text-xs text-muted-foreground">유효 구역 중심 스마트 뷰</CardDescription>
              </div>
              <div className={cn("flex gap-2", isMobileView ? "flex-col w-full" : "sm:flex-row sm:w-auto")}>
                <Button variant="outline" size="sm" className="w-full sm:w-auto rounded-xl font-black border-2 h-10 px-4 text-[11px] border-primary/10 bg-white" asChild>
                  <Link href="/dashboard/teacher/layout-view">전체화면</Link>
                </Button>
                <Button variant="outline" size="sm" className="w-full sm:w-auto rounded-xl font-black border-2 h-10 px-4 gap-1.5 border-primary/10 text-[11px] bg-white" onClick={openLayoutEditor}>
                  <Settings2 className="h-3.5 w-3.5" /> 도면 편집
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 bg-[#fdfdfd] overflow-hidden">
            {attendanceLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
            ) : !attendanceList || attendanceList.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center gap-4 bg-muted/5 rounded-[2rem] border-2 border-dashed">
                <Armchair className="h-12 w-12 text-muted-foreground opacity-10" />
                <p className="text-xs font-bold text-muted-foreground/40">배치된 좌석이 없습니다.</p>
              </div>
            ) : (
              <div className="w-full bg-white rounded-[1.5rem] border shadow-inner overflow-hidden p-3 sm:p-6">
                <div 
                  className="grid gap-1.5 sm:gap-2 w-full mx-auto relative"
                  style={{ 
                    gridTemplateColumns: `repeat(${gridDimensions.cols}, minmax(0, 1fr))`,
                    gridAutoRows: '1fr',
                    backgroundImage: 'radial-gradient(circle, #00000008 1px, transparent 1px)',
                    backgroundSize: '16px 16px'
                  }}
                >
                  {Array.from({ length: gridDimensions.rows * gridDimensions.cols }).map((_, idx) => {
                    const x = gridDimensions.startX + (idx % gridDimensions.cols);
                    const y = gridDimensions.startY + Math.floor(idx / gridDimensions.cols);
                    const seat = attendanceList.find(a => a.gridX === x && a.gridY === y);
                    const occupant = students?.find(s => s.id === seat?.studentId);

                    if (!seat) return <div key={idx} className="aspect-square opacity-0" />;

                    const isLateOrAbsent = seat.studentId && seat.status === 'absent';

                    return (
                      <div 
                        key={seat.id} 
                        onClick={() => {
                          if (occupant) {
                            setSelectedStudentId(occupant.id);
                            setSelectedSeatForManage(seat);
                            setIsManagingSeatModalOpen(true);
                          } else {
                            setSelectedSeatForAssign({id: seat.id, seatNo: seat.seatNo});
                            setIsAssignModalOpen(true);
                          }
                        }}
                        className={cn(
                          "aspect-square rounded-lg sm:rounded-xl border-2 flex flex-col items-center justify-center transition-all relative cursor-pointer group shadow-sm active:scale-95",
                          seat.status === 'studying' ? "bg-emerald-500 border-emerald-600 text-white animate-pulse-soft" : 
                          isLateOrAbsent ? "bg-rose-50 border-rose-500 text-rose-700" :
                          seat.status === 'away' ? "bg-amber-500 border-amber-600 text-white" :
                          seat.status === 'break' ? "bg-blue-500 border-blue-600 text-white" : 
                          occupant ? "bg-white border-primary/40 text-primary" : "bg-white border-primary/5 text-muted-foreground/10 hover:border-primary/30"
                        )}
                      >
                        <span className={cn(
                          "font-black absolute top-0.5 left-1 leading-none",
                          isMobileView ? "text-[6px]" : "text-[9px]",
                          seat.status === 'studying' || seat.status === 'away' || seat.status === 'break' ? "opacity-60" : "opacity-30"
                        )}>{seat.seatNo}</span>
                        
                        <span className={cn(
                          "font-black truncate px-0.5 w-full text-center leading-tight tracking-tighter",
                          isMobileView ? "text-[8px]" : "text-[11px]"
                        )}>
                          {occupant ? occupant.name : ''}
                        </span>
                        
                        {isLateOrAbsent && (
                          <div className="absolute -top-1 -right-1 bg-rose-600 text-white p-0.5 rounded-full shadow-lg border border-white">
                            <div className="rounded-full bg-white w-1.5 h-1.5" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-xl bg-white flex flex-col ring-1 ring-border/50 overflow-hidden">
          <CardHeader className="p-6 sm:p-8">
            <CardTitle className="text-lg sm:text-xl font-black flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> 오늘 상담 현황
            </CardTitle>
            <CardDescription className="font-bold text-[10px] opacity-60 uppercase tracking-widest">Appointment List</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-8 flex-1 space-y-3">
            {aptLoading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div> :
             !appointments || appointments.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground/40 text-[11px] font-black border-2 border-dashed rounded-2xl flex flex-col items-center gap-2">
                <span>예정된 상담이 없습니다.</span>
              </div>
            ) : (
              appointments.map((apt: any) => (
                <div key={apt.id} className="p-3.5 rounded-2xl bg-muted/10 border border-border/50 flex justify-between items-center group hover:bg-white transition-all shadow-sm">
                  <div className="grid gap-0.5">
                    <span className="text-[9px] font-black text-primary uppercase">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'p') : '-'}</span>
                    <span className="text-sm font-bold text-foreground/80">{apt.studentName} 학생</span>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full group-hover:bg-primary group-hover:text-white transition-all" asChild>
                    <Link href={`/dashboard/teacher/students/${apt.studentId}`}>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ))
            )}
            <div className="pt-2 border-t border-dashed mt-auto">
              <Button asChild variant="ghost" className="w-full font-black text-[10px] text-primary/60 hover:text-primary transition-all gap-1.5">
                <Link href="/dashboard/appointments" className="flex items-center justify-center gap-1">
                  전체보기 <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 레이아웃 편집 다이얼로그 */}
      <Dialog open={isLayoutModalOpen} onOpenChange={setIsLayoutModalOpen}>
        <DialogContent className="max-w-[100vw] sm:max-w-4xl h-[100vh] sm:h-[90vh] flex flex-col p-0 rounded-none sm:rounded-[2.5rem] overflow-hidden border-none shadow-2xl">
          <div className="bg-primary p-6 text-white shrink-0">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black">좌석 도면 편집기</DialogTitle>
              <DialogDescription className="text-white/70 font-bold text-xs sm:text-sm">그리드를 터치하여 좌석을 배치하세요. (가로 스크롤 가능)</DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-auto bg-[#fafafa] p-4 sm:p-10 custom-scrollbar">
            <div 
              className="grid gap-1 mx-auto bg-white p-4 rounded-3xl shadow-inner border border-border/50 relative"
              style={{ 
                gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(0, 1fr))`,
                width: GRID_WIDTH * (isMobileView ? 20 : 40),
                minWidth: isMobileView ? GRID_WIDTH * 18 : 'none'
              }}
            >
              {Array.from({ length: GRID_HEIGHT * GRID_WIDTH }).map((_, idx) => {
                const x = idx % GRID_WIDTH;
                const y = Math.floor(idx / GRID_WIDTH);
                const seat = tempLayout.find(s => s.x === x && s.y === y);
                return (
                  <div 
                    key={idx}
                    onClick={() => handleGridClick(x, y)}
                    className={cn(
                      "aspect-square rounded-md sm:rounded-lg border flex items-center justify-center cursor-pointer transition-all",
                      seat ? "bg-primary text-white border-primary shadow-lg scale-90" : "bg-white border-muted hover:bg-primary/5"
                    )}
                  >
                    {seat && <span className="text-[8px] sm:text-[10px] font-black">{seat.seatNo}</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter className="p-6 bg-white border-t shrink-0 flex-row justify-between sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setIsLayoutModalOpen(false)} className="rounded-xl font-black flex-1 sm:flex-none">취소</Button>
            <Button onClick={saveLayout} disabled={isSaving} className="rounded-xl font-black px-10 gap-2 flex-1 sm:flex-none">
              {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              레이아웃 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 학생 좌석 배정 다이얼로그 */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-primary p-8 text-white">
            <DialogHeader>
              <DialogTitle className="text-3xl font-black tracking-tighter">{selectedSeatForAssign?.seatNo}번 좌석 배정</DialogTitle>
              <DialogDescription className="text-white/70 font-bold">이 좌석에 앉을 학생을 선택해 주세요.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-6 max-h-[400px] overflow-y-auto">
            {studentsLoading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div> :
             students?.filter(s => !s.seatNo).length === 0 ? (
               <p className="text-center py-10 text-muted-foreground font-bold">배정 가능한 미지정 학생이 없습니다.</p>
             ) : (
               <div className="grid gap-2">
                 {students?.filter(s => !s.seatNo).map((s) => (
                   <Button 
                    key={s.id} 
                    variant="ghost" 
                    className="justify-start h-14 rounded-2xl font-black text-lg hover:bg-primary/5 hover:text-primary transition-all px-4"
                    onClick={() => assignStudentToSeat(s)}
                   >
                     <CircleDot className="h-4 w-4 mr-3 opacity-20" /> {s.name} ({s.grade})
                   </Button>
                 ))}
               </div>
             )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 좌석 관리 팝업 */}
      <Dialog open={isManagingSeatModalOpen} onOpenChange={setIsManagingSeatModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md border-none shadow-2xl p-0 overflow-hidden">
          {selectedSeatForManage && (
            <>
              <div className={cn(
                "p-8 text-white relative overflow-hidden",
                selectedSeatForManage.status === 'studying' ? "bg-emerald-600" : 
                selectedSeatForManage.studentId && selectedSeatForManage.status === 'absent' ? "bg-rose-600" : 
                "bg-primary"
              )}>
                <DialogHeader className="relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge className="bg-white/20 text-white border-none font-black text-[10px] tracking-widest uppercase">Quick Control</Badge>
                    <span className="text-white/60 font-bold text-xs">{selectedSeatForManage.seatNo}번 좌석</span>
                  </div>
                  <DialogTitle className="text-3xl font-black tracking-tighter">
                    {students?.find(s => s.id === selectedSeatForManage.studentId)?.name || '학생'}
                  </DialogTitle>
                </DialogHeader>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => handleStatusUpdate('studying')} className="h-12 rounded-xl font-black bg-emerald-500 shadow-lg text-sm gap-2">
                    <Clock className="h-4 w-4" /> 입실
                  </Button>
                  <Button onClick={() => handleStatusUpdate('away')} className="h-12 rounded-xl font-black bg-amber-500 shadow-lg text-sm gap-2">
                    <MapPin className="h-4 w-4" /> 외출
                  </Button>
                  <Button onClick={() => handleStatusUpdate('break')} className="h-12 rounded-xl font-black bg-blue-500 shadow-lg text-sm gap-2">
                    <Maximize2 className="h-4 w-4" /> 휴식
                  </Button>
                  <Button onClick={() => handleStatusUpdate('absent')} variant="outline" className="h-12 rounded-xl font-black border-2 border-rose-200 text-rose-600 text-sm gap-2">
                    <AlertCircle className="h-4 w-4" /> 퇴실
                  </Button>
                </div>
                <div className="pt-2 border-t border-dashed flex flex-col gap-2">
                  <Button variant="secondary" asChild className="w-full h-11 rounded-xl font-black gap-2 text-xs">
                    <Link href={`/dashboard/teacher/students/${selectedSeatForManage.studentId}`}>
                      <BarChart3 className="h-4 w-4" /> 분석 리포트 및 상세 관리
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}