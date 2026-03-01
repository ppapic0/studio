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
  Activity,
  ArrowRight,
  History,
  Sparkles
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
  const isMobile = viewMode === 'mobile';
  
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

  const openLayoutEditor = () => {
    if (attendanceList && attendanceList.length > 0) {
      setTempLayout(attendanceList.map(a => ({ x: a.gridX || 0, y: a.gridY || 0, seatNo: a.seatNo })));
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
      if (attendanceList) attendanceList.forEach(a => batch.delete(doc(firestore, 'centers', centerId, 'attendanceCurrent', a.id)));
      tempLayout.forEach(s => {
        const seatId = `seat_${s.seatNo.toString().padStart(3, '0')}`;
        batch.set(doc(firestore, 'centers', centerId, 'attendanceCurrent', seatId), {
          seatNo: s.seatNo, gridX: s.x, gridY: s.y, status: 'absent', updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      toast({ title: "레이아웃 저장 완료" });
      setIsLayoutModalOpen(false);
    } catch (e) { toast({ variant: "destructive", title: "저장 실패" }); } finally { setIsSaving(false); }
  };

  const assignStudentToSeat = async (student: StudentProfile) => {
    if (!firestore || !centerId || !selectedSeatForAssign) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'centers', centerId, 'students', student.id), { seatNo: selectedSeatForAssign.seatNo, updatedAt: serverTimestamp() });
      batch.update(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeatForAssign.id), { studentId: student.id, updatedAt: serverTimestamp() });
      await batch.commit();
      toast({ title: `${student.name} 학생 배정 완료` });
      setIsAssignModalOpen(false);
    } catch (e) { toast({ variant: "destructive", title: "배정 실패" }); } finally { setIsSaving(false); }
  };

  const handleStatusUpdate = async (status: AttendanceCurrent['status']) => {
    if (!firestore || !centerId || !selectedSeatForManage) return;
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeatForManage.id), { status, updatedAt: serverTimestamp() });
      toast({ title: "상태 변경 완료" });
      setIsManagingSeatModalOpen(false);
    } catch (e) { toast({ variant: "destructive", title: "변경 실패" }); }
  };

  if (!isActive) return null;

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">
      <header className="flex flex-col gap-1 px-1">
        <h1 className={cn("font-black tracking-tighter text-primary", isMobile ? "text-2xl" : "text-4xl")}>
          센터 관제 홈
        </h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">Real-time Command Center</p>
      </header>

      {/* 퀵 지표 섹션 - 앱 스타일 */}
      <div className={cn("grid gap-3", isMobile ? "grid-cols-2" : "grid-cols-4")}>
        {[
          { label: '학습 중', val: attendanceList?.filter(a => a.status === 'studying').length || 0, color: 'text-emerald-600', icon: Activity, bg: 'bg-emerald-50/50' },
          { label: '미입실', val: attendanceList?.filter(a => a.studentId && a.status === 'absent').length || 0, color: 'text-rose-600', icon: AlertCircle, bg: 'bg-rose-50/50' },
          { label: '외출/휴식', val: attendanceList?.filter(a => ['away', 'break'].includes(a.status)).length || 0, color: 'text-amber-600', icon: Clock, bg: 'bg-amber-50/50' },
          { label: '배치 좌석', val: attendanceList?.length || 0, color: 'text-primary', icon: Armchair, bg: 'bg-muted/30' }
        ].map((item, i) => (
          <Card key={i} className={cn("rounded-[1.5rem] border-none shadow-sm overflow-hidden p-4 flex flex-col gap-1 transition-all active:scale-95", item.bg)}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">{item.label}</span>
              <item.icon className={cn("h-3.5 w-3.5", item.color)} />
            </div>
            <div className={cn("text-3xl font-black tracking-tighter", item.color)}>{item.val}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6">
        {/* 좌석 상황판 - 앱 스타일 */}
        <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white ring-1 ring-border/50">
          <CardHeader className={cn("bg-muted/5 border-b", isMobile ? "p-5" : "p-8")}>
            <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
              <div className="space-y-1">
                <CardTitle className="text-xl sm:text-2xl font-black flex items-center gap-2 tracking-tighter break-keep">
                  <Armchair className="h-5 w-5 text-primary" /> 실시간 좌석 도면
                </CardTitle>
                <CardDescription className="font-bold text-[10px] text-muted-foreground uppercase tracking-widest">Live Matrix Monitoring</CardDescription>
              </div>
              <div className="flex flex-row gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" className="flex-1 rounded-2xl font-black h-12 px-6 shadow-sm gap-2" asChild>
                  <Link href="/dashboard/teacher/layout-view"><Maximize2 className="h-4 w-4" /> 전체화면</Link>
                </Button>
                {!isMobile && (
                  <Button variant="outline" size="sm" className="flex-1 rounded-2xl font-black h-12 px-6 shadow-sm gap-2" onClick={openLayoutEditor}>
                    <Settings2 className="h-4 w-4" /> 도면 편집
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className={cn("bg-[#fafafa]", isMobile ? "p-0" : "p-6")}>
            {attendanceLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
            ) : !attendanceList || attendanceList.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center gap-4 bg-muted/5 rounded-3xl border-2 border-dashed mx-6 mb-6">
                <Armchair className="h-12 w-12 text-muted-foreground opacity-10" />
                <p className="text-xs font-bold text-muted-foreground/40 italic">배치된 좌석이 없습니다.</p>
              </div>
            ) : (
              <div className={cn("w-full bg-white relative", isMobile ? "p-0" : "p-6 rounded-3xl border shadow-inner")}>
                <div 
                  className="grid w-full gap-1 mx-auto relative"
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
                        onClick={() => occupant ? (setSelectedStudentId(occupant.id), setSelectedSeatForManage(seat), setIsManagingSeatModalOpen(true)) : (setSelectedSeatForAssign({id: seat.id, seatNo: seat.seatNo}), setIsAssignModalOpen(true))}
                        className={cn(
                          "aspect-square rounded-lg border flex flex-col items-center justify-center transition-all relative cursor-pointer shadow-sm active:scale-90",
                          isStudying ? "bg-emerald-500 border-emerald-600 text-white shadow-lg shadow-emerald-500/20" : 
                          isAlert ? "bg-rose-50 border-rose-400 text-rose-700" :
                          seat.status === 'away' ? "bg-amber-500 border-amber-600 text-white shadow-lg shadow-amber-500/20" :
                          seat.status === 'break' ? "bg-blue-500 border-blue-600 text-white shadow-lg shadow-blue-500/20" : 
                          occupant ? "bg-white border-primary/20 text-primary" : "bg-white border-primary/5 text-muted-foreground/5 hover:border-primary/20"
                        )}
                      >
                        <span className={cn("font-black absolute top-0.5 left-0.5 leading-none text-[6px] sm:text-[8px]", isStudying || seat.status === 'away' ? "opacity-60" : "opacity-30")}>{seat.seatNo}</span>
                        <span className={cn("font-black truncate w-full text-center leading-none tracking-tighter px-0.5", isMobile ? "text-[10px]" : "text-[12px]")}>{occupant?.name}</span>
                        {isStudying && <div className="absolute bottom-0.5"><Activity className={cn("animate-pulse stroke-[3px]", isMobile ? "h-1 w-1" : "h-2 w-2")} /></div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 오늘 상담 일정 - 상담 페이지 스타일로 개편 */}
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
          <CardHeader className={cn("bg-muted/5 border-b", isMobile ? "p-5" : "p-8")}>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-xl sm:text-2xl font-black flex items-center gap-2 text-primary tracking-tighter">
                  <MessageSquare className="h-5 w-5" /> 오늘 상담 현황
                </CardTitle>
                <CardDescription className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Active Appointments</CardDescription>
              </div>
              <Button asChild variant="ghost" className="rounded-full h-10 px-4 text-xs font-black gap-1.5 hover:bg-primary/5">
                <Link href="/dashboard/appointments">전체 관리 <ArrowRight className="h-3 w-3" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className={cn("p-0")}>
            {aptLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
            ) : appointments.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center gap-4 text-muted-foreground/30 font-black italic">
                <History className="h-12 w-12 opacity-10" />
                오늘 예정된 상담이 없습니다.
              </div>
            ) : (
              <div className="divide-y divide-muted/10">
                {appointments.map((apt: any) => (
                  <div key={apt.id} className={cn("flex items-center justify-between group hover:bg-muted/5 transition-colors", isMobile ? "p-5" : "p-8")}>
                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-primary/5 border-2 border-primary/10 flex flex-col items-center justify-center shrink-0 group-hover:bg-primary transition-all duration-500">
                        <span className="text-[8px] sm:text-[10px] font-black text-primary/60 uppercase group-hover:text-white/60 tracking-tighter">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'aaa') : ''}</span>
                        <span className="text-sm sm:text-base font-black text-primary group-hover:text-white">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'h:mm') : ''}</span>
                      </div>
                      <div className="grid gap-0.5">
                        <h3 className="text-base sm:text-lg font-black group-hover:text-primary transition-colors">{apt.studentName} 학생</h3>
                        <p className="text-[10px] sm:text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3 w-3" /> {apt.studentNote || '상담 주제 미입력'}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10 hover:text-primary group-hover:translate-x-1 transition-all" asChild>
                      <Link href={`/dashboard/teacher/students/${apt.studentId}`}><ChevronRight className="h-5 w-5" /></Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 모달 시스템 - 앱 최적화 */}
      <Dialog open={isManagingSeatModalOpen} onOpenChange={setIsManagingSeatModalOpen}>
        <DialogContent className={cn("border-none shadow-2xl p-0 overflow-hidden", isMobile ? "fixed bottom-0 top-auto translate-y-0 translate-x-0 left-0 right-0 max-w-none rounded-t-[3rem] rounded-b-none" : "rounded-[2.5rem] sm:max-w-md")}>
          {selectedSeatForManage && (
            <>
              <div className={cn("p-10 text-white relative overflow-hidden", selectedSeatForManage.status === 'studying' ? "bg-emerald-600" : "bg-primary")}>
                <Sparkles className="absolute -top-10 -right-10 h-40 w-40 opacity-10 animate-pulse" />
                <Badge className="bg-white/20 text-white border-none font-black px-3 py-1 mb-3">SEAT NO. {selectedSeatForManage.seatNo}</Badge>
                <DialogTitle className="text-4xl font-black tracking-tighter">{students?.find(s => s.id === selectedSeatForManage.studentId)?.name || '학생'}</DialogTitle>
              </div>
              <div className="p-8 space-y-4 bg-white">
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={() => handleStatusUpdate('studying')} className="h-16 rounded-[1.5rem] font-black bg-emerald-500 gap-2 shadow-lg hover:bg-emerald-600 transition-all"><Clock className="h-4 w-4" /> 입실</Button>
                  <Button onClick={() => handleStatusUpdate('away')} className="h-16 rounded-[1.5rem] font-black bg-amber-500 gap-2 shadow-lg hover:bg-amber-600 transition-all"><MapPin className="h-4 w-4" /> 외출</Button>
                  <Button onClick={() => handleStatusUpdate('break')} className="h-16 rounded-[1.5rem] font-black bg-blue-500 gap-2 shadow-lg hover:bg-blue-600 transition-all"><Maximize2 className="h-4 w-4" /> 휴식</Button>
                  <Button onClick={() => handleStatusUpdate('absent')} variant="outline" className="h-16 rounded-[1.5rem] font-black border-rose-200 text-rose-600 gap-2 hover:bg-rose-50 transition-all"><AlertCircle className="h-4 w-4" /> 퇴실</Button>
                </div>
                <Button variant="secondary" asChild className="w-full h-14 rounded-2xl font-black text-primary gap-3 mt-2">
                  <Link href={`/dashboard/teacher/students/${selectedSeatForManage.studentId}`}>상세 리포트 보기 <ChevronRight className="h-4 w-4 ml-auto opacity-20" /></Link>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
