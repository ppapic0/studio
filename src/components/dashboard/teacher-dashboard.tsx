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
  ArrowRight
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
    <div className="flex flex-col gap-5 w-full">
      <div className="flex flex-col gap-1 px-1">
        <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 text-primary">
          <Monitor className="h-5 w-5 text-primary" /> 실시간 관제 대시보드
        </h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Real-time Command</p>
      </div>

      <div className={cn("grid gap-3", isMobileView ? "grid-cols-2" : "grid-cols-4")}>
        {[
          { label: '학습 중', val: attendanceList?.filter(a => a.status === 'studying').length || 0, color: 'text-emerald-600', icon: Activity },
          { label: '미입실', val: attendanceList?.filter(a => a.studentId && a.status === 'absent').length || 0, color: 'text-rose-600', icon: AlertCircle },
          { label: '외출/휴식', val: attendanceList?.filter(a => ['away', 'break'].includes(a.status)).length || 0, color: 'text-amber-600', icon: Clock },
          { label: '배치 좌석', val: attendanceList?.length || 0, color: 'text-primary', icon: Armchair }
        ].map((item, i) => (
          <Card key={i} className="rounded-2xl border shadow-sm bg-white overflow-hidden p-4 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase text-muted-foreground/60">{item.label}</span>
              <item.icon className={cn("h-4 w-4", item.color)} />
            </div>
            <div className={cn("text-3xl font-black tracking-tighter", item.color)}>{item.val}</div>
          </Card>
        ))}
      </div>

      <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden bg-white ring-1 ring-border/50">
        <CardHeader className={cn("bg-muted/5 border-b", isMobileView ? "p-4" : "p-8")}>
          <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
            <div className="space-y-1">
              <CardTitle className="text-xl sm:text-2xl font-black flex items-center gap-2 tracking-tighter whitespace-nowrap">
                <Armchair className="h-5 w-5 text-primary" /> 실시간 좌석 도면
              </CardTitle>
              <CardDescription className="font-bold text-[10px] text-muted-foreground uppercase tracking-widest">Live Matrix View</CardDescription>
            </div>
            <div className="flex flex-row gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" className="flex-1 rounded-xl font-black h-10 px-4 text-[11px]" asChild><Link href="/dashboard/teacher/layout-view">전체화면</Link></Button>
              {!isMobileView && (
                <Button variant="outline" size="sm" className="flex-1 rounded-xl font-black h-10 px-4 gap-1.5 text-[11px]" onClick={openLayoutEditor}><Settings2 className="h-3.5 w-3.5" /> 도면 편집</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn("bg-[#fafafa]", isMobileView ? "p-0" : "p-6")}>
          {attendanceLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
          ) : !attendanceList || attendanceList.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center gap-4 bg-muted/5 rounded-3xl border-2 border-dashed">
              <Armchair className="h-12 w-12 text-muted-foreground opacity-10" />
              <p className="text-xs font-bold text-muted-foreground/40 italic">배치된 좌석이 없습니다.</p>
            </div>
          ) : (
            <div className={cn("w-full bg-white rounded-none border-none shadow-none relative", isMobileView ? "p-0" : "p-4 rounded-2xl border shadow-inner")}>
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
                        "aspect-square rounded-md border flex flex-col items-center justify-center transition-all relative cursor-pointer shadow-sm active:scale-90",
                        isStudying ? "bg-emerald-500 border-emerald-600 text-white" : 
                        isAlert ? "bg-rose-50 border-rose-400 text-rose-700" :
                        seat.status === 'away' ? "bg-amber-500 border-amber-600 text-white" :
                        seat.status === 'break' ? "bg-blue-500 border-blue-600 text-white" : 
                        occupant ? "bg-white border-primary/20 text-primary" : "bg-white border-primary/5 text-muted-foreground/5 hover:border-primary/20"
                      )}
                    >
                      <span className={cn("font-black absolute top-0.5 left-0.5 leading-none text-[6px] sm:text-[8px]", isStudying || seat.status === 'away' ? "opacity-60" : "opacity-30")}>{seat.seatNo}</span>
                      <span className={cn("font-black truncate w-full text-center leading-none tracking-tighter px-0.5", isMobileView ? "text-[10px]" : "text-[12px]")}>{occupant?.name}</span>
                      {isStudying && <div className="absolute bottom-0.5"><Activity className={cn("animate-pulse stroke-[3px]", isMobileView ? "h-1 w-1" : "h-2 w-2")} /></div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 상담 카드 */}
      <Card className="rounded-[2rem] border-none shadow-xl bg-white ring-1 ring-border/50 overflow-hidden">
        <CardHeader className="p-6 sm:p-8 border-b bg-muted/5">
          <CardTitle className="text-xl font-black flex items-center gap-2 text-primary">
            <MessageSquare className="h-5 w-5 text-primary" /> 오늘 상담 현황
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {aptLoading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div> :
           !appointments.length ? <p className="text-center py-10 text-muted-foreground text-xs font-bold italic">예정된 상담이 없습니다.</p> :
           <div className="space-y-2">
             {appointments.map((apt: any) => (
               <div key={apt.id} className="p-3.5 rounded-2xl bg-muted/10 border flex justify-between items-center group hover:bg-white transition-all shadow-sm">
                 <div className="grid gap-0.5">
                   <span className="text-[9px] font-black text-primary uppercase">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'p') : '-'}</span>
                   <span className="text-sm font-bold">{apt.studentName} 학생</span>
                 </div>
                 <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" asChild><Link href={`/dashboard/teacher/students/${apt.studentId}`}><ChevronRight className="h-4 w-4" /></Link></Button>
               </div>
             ))}
           </div>
          }
        </CardContent>
      </Card>

      {/* 모달들 */}
      <Dialog open={isLayoutModalOpen} onOpenChange={setIsLayoutModalOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <div className="bg-primary p-6 text-white shrink-0"><DialogTitle className="text-2xl font-black">도면 편집기</DialogTitle></div>
          <div className="flex-1 overflow-auto bg-[#fafafa] p-4 sm:p-10">
            <div className="grid gap-1 mx-auto bg-white p-4 rounded-3xl shadow-inner border relative" style={{ gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(0, 1fr))`, width: GRID_WIDTH * (isMobileView ? 18 : 40) }}>
              {Array.from({ length: GRID_HEIGHT * GRID_WIDTH }).map((_, idx) => {
                const x = idx % GRID_WIDTH; const y = Math.floor(idx / GRID_WIDTH);
                const seat = tempLayout.find(s => s.x === x && s.y === y);
                return (
                  <div key={idx} onClick={() => handleGridClick(x, y)} className={cn("aspect-square rounded-sm border flex items-center justify-center cursor-pointer transition-all", seat ? "bg-primary text-white border-primary scale-90" : "bg-white hover:bg-primary/5")}>
                    {seat && <span className="text-[7px] sm:text-[10px] font-black">{seat.seatNo}</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter className="p-6 bg-white border-t flex-row gap-2"><Button variant="outline" onClick={() => setIsLayoutModalOpen(false)} className="flex-1">취소</Button><Button onClick={saveLayout} disabled={isSaving} className="flex-1">레이아웃 저장</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="rounded-[2rem] sm:max-w-md p-0 overflow-hidden">
          <div className="bg-primary p-8 text-white"><DialogTitle className="text-3xl font-black">{selectedSeatForAssign?.seatNo}번 배정</DialogTitle></div>
          <div className="p-6 max-h-[400px] overflow-y-auto space-y-2">
            {students?.filter(s => !s.seatNo).map((s) => (
              <Button key={s.id} variant="ghost" className="w-full justify-start h-14 rounded-2xl font-black text-lg" onClick={() => assignStudentToSeat(s)}><CircleDot className="h-4 w-4 mr-3 opacity-20" /> {s.name}</Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isManagingSeatModalOpen} onOpenChange={setIsManagingSeatModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md p-0 overflow-hidden">
          {selectedSeatForManage && (
            <>
              <div className={cn("p-8 text-white", selectedSeatForManage.status === 'studying' ? "bg-emerald-600" : "bg-primary")}>
                <Badge className="bg-white/20 text-white mb-2">{selectedSeatForManage.seatNo}번 좌석</Badge>
                <DialogTitle className="text-3xl font-black">{students?.find(s => s.id === selectedSeatForManage.studentId)?.name || '학생'}</DialogTitle>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => handleStatusUpdate('studying')} className="h-12 rounded-xl font-black bg-emerald-500 gap-2"><Clock className="h-4 w-4" /> 입실</Button>
                  <Button onClick={() => handleStatusUpdate('away')} className="h-12 rounded-xl font-black bg-amber-500 gap-2"><MapPin className="h-4 w-4" /> 외출</Button>
                  <Button onClick={() => handleStatusUpdate('break')} className="h-12 rounded-xl font-black bg-blue-500 gap-2"><Maximize2 className="h-4 w-4" /> 휴식</Button>
                  <Button onClick={() => handleStatusUpdate('absent')} variant="outline" className="h-12 rounded-xl font-black border-rose-200 text-rose-600 gap-2"><AlertCircle className="h-4 w-4" /> 퇴실</Button>
                </div>
                <Button variant="secondary" asChild className="w-full h-11 rounded-xl font-black"><Link href={`/dashboard/teacher/students/${selectedSeatForManage.studentId}`}>상세 분석 리포트</Link></Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}