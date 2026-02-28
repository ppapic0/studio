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
  Save,
  Trash2,
  X,
  Plus,
  ArrowRight,
  Monitor,
  MessageSquare,
  ChevronRight,
  UserPlus,
  Check,
  AlertCircle,
  Clock,
  MapPin,
  Maximize2
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
import { type StudentProfile, type AttendanceCurrent } from '@/lib/types';
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
import { startOfDay, endOfDay } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

const GRID_WIDTH = 20;
const GRID_HEIGHT = 10;

export function TeacherDashboard({ isActive }: { isActive: boolean }) {
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();
  
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isManagingSeatModalOpen, setIsManagingSeatModalOpen] = useState(false);
  
  const [selectedSeatForAssign, setSelectedSeatForAssign] = useState<{id: string, seatNo: number} | null>(null);
  const [selectedSeatForManage, setSelectedSeatForManage] = useState<AttendanceCurrent | null>(null);
  
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
    const today = new Date();
    return query(
      collection(firestore, 'centers', centerId, 'counselingReservations'),
      where('scheduledAt', '>=', Timestamp.fromDate(startOfDay(today))),
      where('scheduledAt', '<=', Timestamp.fromDate(endOfDay(today))),
      orderBy('scheduledAt', 'asc')
    );
  }, [firestore, centerId]);
  const { data: appointments, isLoading: aptLoading } = useCollection<any>(appointmentsQuery, { enabled: isActive });

  const unassignedStudents = useMemo(() => {
    if (!students) return [];
    return students.filter(s => !s.seatNo || s.seatNo === 0);
  }, [students]);

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
    <div className="flex flex-col gap-6 sm:gap-8 w-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2 text-primary">
          <Monitor className="h-6 w-6 sm:h-8 sm:w-8" />
          실시간 관제 대시보드
        </h1>
        <p className="text-sm font-bold text-muted-foreground">센터 내 학생들의 학습 및 출결 상태를 실시간으로 모니터링합니다.</p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: '현재 학습 중', val: studyingCount, color: 'text-emerald-600', icon: Users, sub: '실시간 몰입도' },
          { label: '미입실/지각', val: alertCount, color: 'text-rose-600', icon: AlertCircle, sub: '즉각 관리 대상' },
          { label: '외출/휴식', val: attendanceList?.filter(a => ['away', 'break'].includes(a.status)).length || 0, color: 'text-amber-600', icon: Clock, sub: '이동 중' },
          { label: '전체 배치 좌석', val: attendanceList?.length || 0, color: 'text-primary', icon: Armchair, sub: '관리 중인 좌석' }
        ].map((item, i) => (
          <Card key={i} className="rounded-2xl border-none shadow-sm bg-white overflow-hidden group transition-all hover:shadow-md border border-border/50">
            <CardHeader className="p-4 sm:p-6 pb-1 sm:pb-2">
              <div className="flex justify-between items-start">
                <CardDescription className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground/60">{item.label}</CardDescription>
                <div className={cn("p-1.5 sm:p-2 rounded-xl bg-opacity-5", item.color.replace('text-', 'bg-'))}>
                  <item.icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", item.color)} />
                </div>
              </div>
              <CardTitle className={cn("text-2xl sm:text-4xl font-black mt-1 sm:mt-2", item.color)}>{item.val}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="text-[9px] sm:text-[10px] font-bold text-muted-foreground/60 uppercase">{item.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-[2rem] border-none shadow-xl overflow-hidden bg-white ring-1 ring-border/50">
          <CardHeader className="bg-muted/10 border-b p-5 sm:p-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl sm:text-2xl font-black flex items-center gap-2">
                  <Armchair className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> 실시간 좌석 도면
                </CardTitle>
                <CardDescription className="font-bold text-xs text-muted-foreground">좌석을 클릭하여 출결 상태를 즉시 관리하세요.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="rounded-xl font-black border-2 h-10 px-4 border-primary/10 hover:border-primary hover:bg-primary/5"
                  asChild
                >
                  <Link href="/dashboard/teacher/layout-view">전체화면 보기</Link>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="rounded-xl font-black border-2 h-10 px-4 gap-2 border-primary/10 hover:border-primary hover:bg-primary/5 transition-all text-xs"
                  onClick={openLayoutEditor}
                >
                  <Settings2 className="h-4 w-4" /> 도면 편집
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 bg-[#fdfdfd]">
            {attendanceLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
            ) : !attendanceList || attendanceList.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center gap-4 bg-muted/5 rounded-[2rem] border-2 border-dashed">
                <Armchair className="h-16 w-16 text-muted-foreground opacity-10" />
                <p className="text-sm font-bold text-muted-foreground/40">아직 배치된 좌석이 없습니다.</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
                <div 
                  className="grid gap-1.5 sm:gap-2 mx-auto p-4 sm:p-6 bg-white rounded-[1.5rem] border shadow-inner relative"
                  style={{ 
                    gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(35px, 42px))`, 
                    width: 'fit-content',
                    backgroundImage: 'radial-gradient(circle, #00000003 1px, transparent 1px)',
                    backgroundSize: '18px 18px'
                  }}
                >
                  {Array.from({ length: GRID_HEIGHT * GRID_WIDTH }).map((_, idx) => {
                    const x = idx % GRID_WIDTH;
                    const y = Math.floor(idx / GRID_WIDTH);
                    const seat = attendanceList.find(a => a.gridX === x && a.gridY === y);
                    const occupant = students?.find(s => s.id === seat?.studentId);

                    if (!seat) return <div key={idx} className="w-[35px] h-[35px] sm:w-[42px] sm:h-[42px] opacity-[0.01]" />;

                    const isLateOrAbsent = seat.studentId && seat.status === 'absent';

                    return (
                      <div 
                        key={seat.id} 
                        onClick={() => {
                          if (occupant) {
                            setSelectedSeatForManage(seat);
                            setIsManagingSeatModalOpen(true);
                          } else {
                            setSelectedSeatForAssign({id: seat.id, seatNo: seat.seatNo});
                            setIsAssignModalOpen(true);
                          }
                        }}
                        className={cn(
                          "w-[35px] h-[35px] sm:w-[42px] sm:h-[42px] rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-300 hover:scale-110 relative shadow-sm cursor-pointer group border-solid",
                          seat.status === 'studying' ? "bg-emerald-500 border-emerald-600 text-white shadow-md animate-pulse-soft" : 
                          isLateOrAbsent ? "bg-rose-50 border-rose-500 text-rose-700 shadow-inner" :
                          seat.status === 'away' ? "bg-amber-500 border-amber-600 text-white" :
                          seat.status === 'break' ? "bg-blue-500 border-blue-600 text-white" : 
                          occupant ? "bg-white border-primary text-primary" : "bg-white border-primary/40 text-muted-foreground/30 hover:border-primary"
                        )}
                      >
                        <span className={cn(
                          "text-[7px] sm:text-[9px] font-black absolute top-0.5 left-1 transition-opacity",
                          occupant ? "opacity-40" : "opacity-60 group-hover:opacity-100"
                        )}>{seat.seatNo}</span>
                        
                        <span className="text-[8px] sm:text-[10px] font-black truncate px-0.5 w-full text-center mt-1">
                          {occupant ? occupant.name : ''}
                        </span>
                        
                        {isLateOrAbsent && (
                          <div className="absolute -top-1 -right-1 bg-rose-600 text-white p-0.5 rounded-full shadow-lg border border-white animate-bounce">
                            <AlertCircle className="h-2 w-2" />
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

        <Card className="rounded-[2rem] border-none shadow-xl bg-white flex flex-col ring-1 ring-border/50">
          <CardHeader className="p-6 sm:p-8">
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> 오늘 상담 현황
            </CardTitle>
            <CardDescription className="font-bold text-xs opacity-60 uppercase tracking-tighter">Daily Appointment List</CardDescription>
          </CardHeader>
          <CardContent className="px-6 sm:px-8 flex-1 space-y-4">
            {aptLoading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div> :
             !appointments || appointments.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground/40 text-xs font-black border-2 border-dashed rounded-[2rem] flex flex-col items-center gap-2">
                <MessageSquare className="h-8 w-8 opacity-10" />
                <span>오늘 예정된 상담이 없습니다.</span>
              </div>
            ) : (
              appointments.map((apt: any) => (
                <div key={apt.id} className="p-4 rounded-2xl bg-muted/10 border border-border/50 flex justify-between items-center group hover:border-primary hover:bg-white transition-all shadow-sm hover:shadow-md">
                  <div className="grid gap-1">
                    <span className="text-[10px] font-black text-primary uppercase">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'p') : '-'}</span>
                    <span className="text-sm font-bold text-foreground/80">{apt.studentName} 학생</span>
                  </div>
                  <Button size="icon" variant="ghost" className="rounded-full group-hover:bg-primary group-hover:text-white transition-all" asChild>
                    <Link href={`/dashboard/teacher/students/${apt.studentId}`}>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ))
            )}
            <Button asChild variant="ghost" className="w-full mt-4 font-black text-xs text-primary/60 hover:text-primary transition-colors">
              <Link href="/dashboard/appointments" className="flex items-center justify-center gap-2">
                상담 관리 전체보기 <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isLayoutModalOpen} onOpenChange={setIsLayoutModalOpen}>
        <DialogContent className="max-w-[98vw] lg:max-w-7xl h-[95vh] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col">
          <DialogHeader className="p-6 sm:p-10 bg-primary text-primary-foreground shrink-0 relative">
            <Button variant="ghost" size="icon" onClick={() => setIsLayoutModalOpen(false)} className="absolute top-6 right-6 text-white hover:bg-white/10 rounded-full h-12 w-12">
              <X className="h-8 w-8" />
            </Button>
            <DialogTitle className="text-2xl sm:text-4xl font-black tracking-tighter">도면 배치 에디터</DialogTitle>
            <DialogDescription className="text-primary-foreground/60 font-bold text-xs sm:text-lg mt-2">격자를 클릭하여 좌석을 배치하세요. 실선 갈색으로 표시됩니다.</DialogDescription>
          </DialogHeader>
          <div className="p-4 sm:p-10 bg-background overflow-hidden flex flex-col gap-6 flex-1">
            <div className="flex flex-col sm:flex-row items-center justify-between p-5 bg-muted/20 rounded-[1.5rem] border border-dashed border-primary/20 gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary px-5 py-2.5 rounded-xl font-black text-sm sm:text-base border border-primary/10 shadow-inner">
                  총 좌석 수: <span className="text-primary font-black">{tempLayout.length}</span>
                </div>
              </div>
              <Button variant="ghost" onClick={() => setTempLayout([])} className="text-destructive font-black h-12 text-sm gap-2 hover:bg-destructive/5 rounded-xl"><Trash2 className="h-5 w-5" /> 도면 전체 초기화</Button>
            </div>
            <div className="relative overflow-auto border-2 border-border/50 rounded-[2.5rem] p-6 bg-muted/5 flex-1 custom-scrollbar shadow-inner">
              <div 
                className="grid gap-1.5 mx-auto" 
                style={{ 
                  gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(40px, 50px))`, 
                  width: 'fit-content',
                  backgroundImage: 'radial-gradient(circle, #00000008 1px, transparent 1px)',
                  backgroundSize: '18px 18px'
                }}
              >
                {Array.from({ length: GRID_HEIGHT * GRID_WIDTH }).map((_, idx) => {
                  const x = idx % GRID_WIDTH;
                  const y = Math.floor(idx / GRID_WIDTH);
                  const seat = tempLayout.find(s => s.x === x && s.y === y);
                  return (
                    <div key={idx} onClick={() => handleGridClick(x, y)} className={cn(
                      "w-[40px] h-[40px] sm:w-[50px] sm:h-[50px] rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group relative border-solid",
                      seat ? "bg-primary border-primary text-primary-foreground shadow-lg scale-105" : "bg-white/50 border-primary/20 hover:border-primary/60"
                    )}>
                      {seat ? <span className="text-[10px] sm:text-xs font-black">{seat.seatNo}</span> : <Plus className="h-4 w-4 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 sm:p-10 bg-muted/10 border-t flex flex-col sm:flex-row items-center justify-between gap-6 shrink-0">
            <div className="flex items-center gap-2 text-muted-foreground italic text-xs sm:text-sm font-bold">
              <Check className="h-4 w-4 text-emerald-500" />
              변경사항은 저장 버튼을 눌러야 실시간 도면에 반영됩니다.
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button variant="ghost" onClick={() => setIsLayoutModalOpen(false)} className="flex-1 sm:flex-none rounded-xl font-black h-14 px-8 text-base">취소</Button>
              <Button onClick={saveLayout} disabled={isSaving || tempLayout.length === 0} className="flex-[2] sm:flex-none rounded-2xl font-black px-12 h-14 shadow-xl gap-2 active:scale-95 transition-all text-base">
                {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} 레이아웃 설정 저장
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-8 bg-primary text-primary-foreground">
            <DialogTitle className="text-3xl font-black flex items-center gap-3 tracking-tighter">
              <UserPlus className="h-8 w-8" /> 좌석 배정
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/60 font-bold text-base mt-2">
              <span className="text-white underline underline-offset-4">{selectedSeatForAssign?.seatNo}번 좌석</span>에 입실할 학생을 선택해 주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="p-8">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mb-6 flex justify-between">
              <span>미배정 학생 목록</span>
              <span>총 {unassignedStudents.length}명</span>
            </h4>
            <ScrollArea className="h-[350px] pr-4">
              {studentsLoading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div> :
               unassignedStudents.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground/40 italic text-sm font-black bg-muted/10 rounded-[2rem] border-2 border-dashed flex flex-col items-center gap-3">
                  <Users className="h-10 w-10 opacity-10" />
                  <span>배정 가능한 학생이 없습니다.</span>
                </div>
              ) : (
                <div className="grid gap-3">
                  {unassignedStudents.map((student) => (
                    <div 
                      key={student.id} 
                      onClick={() => assignStudentToSeat(student)}
                      className="flex items-center justify-between p-5 rounded-2xl border-2 border-transparent hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group shadow-sm hover:shadow-md bg-white ring-1 ring-border/50"
                    >
                      <div className="flex flex-col">
                        <span className="font-black text-xl group-hover:text-primary transition-colors">{student.name}</span>
                        <span className="text-xs font-bold text-muted-foreground/60">{student.grade} · {student.schoolName}</span>
                      </div>
                      <div className="h-10 w-10 rounded-full bg-muted/30 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                        <Check className="h-5 w-5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
          <DialogFooter className="p-6 bg-muted/10 border-t">
            <Button variant="ghost" onClick={() => setIsAssignModalOpen(false)} className="w-full rounded-2xl font-black h-14 text-base">닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 좌석 직접 관리 다이얼로그 추가 */}
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
                <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
                  <Armchair className="h-32 w-32" />
                </div>
                <DialogHeader className="relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge className="bg-white/20 text-white border-none font-black text-[10px] tracking-widest uppercase">Quick Control</Badge>
                    <span className="text-white/60 font-bold text-xs">{selectedSeatForManage.seatNo}번 좌석</span>
                  </div>
                  <DialogTitle className="text-4xl font-black tracking-tighter">
                    {students?.find(s => s.id === selectedSeatForManage.studentId)?.name || '학생 정보 없음'}
                  </DialogTitle>
                  <DialogDescription className="text-white/70 font-bold text-lg">
                    현재 상태: <span className="text-white underline underline-offset-4">{
                      selectedSeatForManage.status === 'studying' ? '학습 중' :
                      selectedSeatForManage.status === 'away' ? '외출 중' :
                      selectedSeatForManage.status === 'break' ? '휴식 중' : '미입실'
                    }</span>
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={() => handleStatusUpdate('studying')} className="h-14 rounded-2xl font-black bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-100 gap-2">
                    <Clock className="h-4 w-4" /> 입실/학습
                  </Button>
                  <Button onClick={() => handleStatusUpdate('away')} className="h-14 rounded-2xl font-black bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-100 gap-2">
                    <MapPin className="h-4 w-4" /> 외출 처리
                  </Button>
                  <Button onClick={() => handleStatusUpdate('break')} className="h-14 rounded-2xl font-black bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-100 gap-2">
                    <Maximize2 className="h-4 w-4" /> 휴식 처리
                  </Button>
                  <Button onClick={() => handleStatusUpdate('absent')} variant="outline" className="h-14 rounded-2xl font-black border-2 border-rose-200 text-rose-600 hover:bg-rose-50 gap-2">
                    <AlertCircle className="h-4 w-4" /> 퇴실 처리
                  </Button>
                </div>

                <div className="pt-4 border-t border-dashed">
                  <Button variant="ghost" className="w-full h-12 rounded-xl font-black text-primary hover:bg-primary/5 gap-2" asChild>
                    <Link href={`/dashboard/teacher/students/${selectedSeatForManage.studentId}`}>
                      학생 상세 분석 보기 <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
              <DialogFooter className="p-6 bg-muted/10">
                <Button variant="ghost" onClick={() => setIsManagingSeatModalOpen(false)} className="w-full rounded-xl font-black">닫기</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
