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
  TrendingUp,
  Monitor,
  MessageSquare,
  ChevronRight,
  UserPlus,
  Check
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
import { format, startOfDay, endOfDay } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

const GRID_WIDTH = 20;
const GRID_HEIGHT = 10;

export function TeacherDashboard({ isActive }: { isActive: boolean }) {
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();
  
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedSeatForAssign, setSelectedSeatForAssign] = useState<{id: string, seatNo: number} | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [tempLayout, setTempLayout] = useState<{ x: number, y: number, seatNo: number }[]>([]);

  const centerId = activeMembership?.id;

  // 1. 학생 데이터
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'students'), orderBy('name', 'asc'));
  }, [firestore, centerId]);
  const { data: students, isLoading: studentsLoading } = useCollection<StudentProfile>(studentsQuery, { enabled: isActive });

  // 2. 실시간 좌석 현황
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery, { enabled: isActive });

  // 3. 오늘 상담 예약
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

  // 좌석이 없는 학생들 필터링
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
      // 번호 재정렬 (요청에 따라 1번부터 순차적으로)
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
      
      // 1. 학생 문서 업데이트 (좌석 번호 부여)
      batch.update(doc(firestore, 'centers', centerId, 'students', student.id), {
        seatNo: selectedSeatForAssign.seatNo,
        updatedAt: serverTimestamp()
      });

      // 2. 실시간 좌석 정보 업데이트 (배정된 학생 ID 기록)
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

  if (!isActive) return null;

  const studyingCount = attendanceList?.filter(a => a.status === 'studying').length ?? 0;

  return (
    <div className="flex flex-col gap-6 sm:gap-8 w-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
          <Monitor className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          실시간 관제 센터
        </h1>
        <p className="text-sm font-bold text-muted-foreground">센터의 흐름을 실시간으로 모니터링합니다.</p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: '현재 학습 중', val: studyingCount, color: 'text-emerald-500', icon: Users, sub: '실시간 입실' },
          { label: '전체 좌석', val: attendanceList?.length || 0, color: 'text-primary', icon: Armchair, sub: '배치 완료' },
          { label: '대기 학생', val: unassignedStudents.length, color: 'text-amber-500', icon: UserPlus, sub: '미배정 학생' },
          { label: '오늘의 상담', val: appointments?.length || 0, color: 'text-blue-500', icon: MessageSquare, sub: '예약된 상담' }
        ].map((item, i) => (
          <Card key={i} className="rounded-2xl sm:rounded-3xl border-none shadow-md bg-white overflow-hidden group transition-all hover:shadow-lg">
            <CardHeader className="p-4 sm:p-6 pb-1 sm:pb-2">
              <div className="flex justify-between items-start">
                <CardDescription className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground/60">{item.label}</CardDescription>
                <div className={cn("p-1.5 sm:p-2 rounded-xl bg-opacity-10", item.color.replace('text-', 'bg-'))}>
                  <item.icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", item.color)} />
                </div>
              </div>
              <CardTitle className={cn("text-2xl sm:text-4xl font-black mt-1 sm:mt-2", item.color)}>{item.val}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="text-[9px] sm:text-[10px] font-bold text-muted-foreground">{item.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-[1.5rem] sm:rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
          <CardHeader className="bg-muted/20 border-b p-5 sm:p-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl sm:text-2xl font-black flex items-center gap-2">
                  <Armchair className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> 실시간 좌석 도면
                </CardTitle>
                <CardDescription className="font-bold text-xs sm:text-sm text-muted-foreground">빈 좌석을 클릭하여 학생을 배정할 수 있습니다.</CardDescription>
              </div>
              <Button 
                variant="outline" 
                className="rounded-xl font-black border-2 h-10 sm:h-12 px-4 gap-2 border-primary/20 hover:border-primary transition-all text-xs sm:text-sm"
                onClick={openLayoutEditor}
              >
                <Settings2 className="h-4 w-4" /> 도면 배치 수정
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-8">
            {attendanceLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
            ) : !attendanceList || attendanceList.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center gap-4 bg-muted/10 rounded-[1.5rem] border-2 border-dashed">
                <Armchair className="h-12 w-12 text-muted-foreground opacity-20" />
                <p className="text-sm font-bold text-muted-foreground/60">'도면 배치 수정' 버튼을 눌러 좌석을 배치해 주세요.</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
                <div 
                  className="grid gap-2 sm:gap-3 mx-auto p-3 sm:p-4 bg-muted/5 rounded-[1.5rem] border shadow-inner"
                  style={{ gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(45px, 65px))`, width: 'fit-content' }}
                >
                  {Array.from({ length: GRID_HEIGHT * GRID_WIDTH }).map((_, idx) => {
                    const x = idx % GRID_WIDTH;
                    const y = Math.floor(idx / GRID_WIDTH);
                    const seat = attendanceList.find(a => a.gridX === x && a.gridY === y);
                    const occupant = students?.find(s => s.seatNo === seat?.seatNo);

                    if (!seat) return <div key={idx} className="w-[45px] h-[45px] sm:w-[60px] sm:h-[60px] opacity-10 bg-muted/20 rounded-lg" />;

                    return (
                      <div 
                        key={seat.id} 
                        onClick={() => {
                          if (occupant) {
                            window.location.href = `/dashboard/teacher/students/${occupant.id}`;
                          } else {
                            setSelectedSeatForAssign({id: seat.id, seatNo: seat.seatNo});
                            setIsAssignModalOpen(true);
                          }
                        }}
                        className={cn(
                          "w-[45px] h-[45px] sm:w-[60px] sm:h-[60px] rounded-lg sm:rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-300 hover:scale-110 relative shadow-sm cursor-pointer",
                          seat.status === 'studying' ? "bg-emerald-50 border-emerald-400 text-emerald-700 ring-4 ring-emerald-500/10" : 
                          seat.status === 'away' ? "bg-amber-50 border-amber-400 text-amber-700" :
                          seat.status === 'break' ? "bg-blue-50 border-blue-400 text-blue-700" : 
                          occupant ? "bg-white border-primary/40 text-primary" : "bg-white border-dashed border-border text-muted-foreground/30"
                        )}
                      >
                        <span className="text-[8px] sm:text-[10px] font-black opacity-40">{seat.seatNo}</span>
                        <span className="text-[9px] sm:text-[11px] font-black truncate px-1 w-full text-center">
                          {occupant ? occupant.name : ''}
                        </span>
                        {seat.status === 'studying' && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />}
                        {!occupant && <Plus className="absolute inset-0 m-auto h-3 w-3 opacity-0 group-hover:opacity-100 text-muted-foreground" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[1.5rem] sm:rounded-[2.5rem] border-none shadow-xl bg-white flex flex-col">
          <CardHeader className="p-6 sm:p-8">
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> 오늘 상담 현황
            </CardTitle>
            <CardDescription className="font-bold text-xs">확인 및 확정이 필요한 상담 목록입니다.</CardDescription>
          </CardHeader>
          <CardContent className="px-6 sm:px-8 flex-1 space-y-4">
            {aptLoading ? <div className="flex justify-center"><Loader2 className="animate-spin" /></div> :
             !appointments || appointments.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-xs font-bold border-2 border-dashed rounded-3xl">오늘 예정된 상담이 없습니다.</div>
            ) : (
              appointments.map((apt: any) => (
                <div key={apt.id} className="p-4 rounded-2xl bg-muted/20 border flex justify-between items-center group hover:border-primary transition-all">
                  <div className="grid gap-1">
                    <span className="text-xs font-black text-primary">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'p') : '-'}</span>
                    <span className="text-sm font-bold">{apt.studentName} 학생</span>
                  </div>
                  <Button size="icon" variant="ghost" className="rounded-full group-hover:bg-primary group-hover:text-white" asChild>
                    <Link href={`/dashboard/teacher/students/${apt.studentId}`}>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ))
            )}
            <Button asChild variant="ghost" className="w-full mt-4 font-bold text-xs">
              <Link href="/dashboard/appointments">상담 관리 전체보기 <ArrowRight className="ml-2 h-3 w-3" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 좌석 배치 에디터 모달 */}
      <Dialog open={isLayoutModalOpen} onOpenChange={setIsLayoutModalOpen}>
        <DialogContent className="max-w-[98vw] sm:max-w-[95vw] lg:max-w-6xl h-[95vh] sm:h-auto rounded-xl sm:rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col">
          <DialogHeader className="p-5 sm:p-8 bg-primary text-primary-foreground shrink-0 relative">
            <Button variant="ghost" size="icon" onClick={() => setIsLayoutModalOpen(false)} className="absolute top-4 right-4 text-white hover:bg-white/10 rounded-full h-10 w-10">
              <X className="h-6 w-6" />
            </Button>
            <DialogTitle className="text-xl sm:text-3xl font-black tracking-tighter">도면 에디터</DialogTitle>
            <DialogDescription className="text-primary-foreground/70 font-bold text-xs sm:text-base">클릭하여 좌석을 배치하세요. 1번부터 순차적으로 부여됩니다.</DialogDescription>
          </DialogHeader>
          <div className="p-4 sm:p-8 bg-background overflow-hidden flex flex-col gap-4 flex-1">
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-muted/30 rounded-2xl border border-dashed gap-4 shrink-0">
              <div className="text-sm font-black bg-primary/10 text-primary px-4 py-2 rounded-xl border border-primary/20">배치된 좌석: {tempLayout.length}개</div>
              <Button variant="ghost" onClick={() => setTempLayout([])} className="text-destructive font-black h-10 text-sm gap-2"><Trash2 className="h-4 w-4" /> 전체 삭제</Button>
            </div>
            <div className="relative overflow-auto border-2 border-border/50 rounded-[1.5rem] p-4 bg-muted/5 flex-1 custom-scrollbar">
              <div className="grid gap-1 mx-auto" style={{ gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(40px, 50px))`, width: 'fit-content' }}>
                {Array.from({ length: GRID_HEIGHT * GRID_WIDTH }).map((_, idx) => {
                  const x = idx % GRID_WIDTH;
                  const y = Math.floor(idx / GRID_WIDTH);
                  const seat = tempLayout.find(s => s.x === x && s.y === y);
                  return (
                    <div key={idx} onClick={() => handleGridClick(x, y)} className={cn(
                      "w-[40px] h-[40px] sm:w-[50px] sm:h-[50px] rounded-lg border-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group",
                      seat ? "bg-primary border-primary text-primary-foreground shadow-lg scale-105" : "bg-white border-dashed border-border/40 hover:border-primary/30"
                    )}>
                      {seat ? <span className="text-[10px] sm:text-xs font-black">{seat.seatNo}</span> : <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="p-4 sm:p-8 bg-muted/30 border-t flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground italic text-center sm:text-left">※ 저장 시 기존의 도면 데이터가 현재 배치로 완전히 대체됩니다.</p>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="ghost" onClick={() => setIsLayoutModalOpen(false)} className="flex-1 sm:flex-none rounded-xl font-bold h-12 px-6">취소</Button>
              <Button onClick={saveLayout} disabled={isSaving || tempLayout.length === 0} className="flex-[2] sm:flex-none rounded-2xl font-black px-10 h-12 shadow-xl gap-2 active:scale-95 transition-all">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} 레이아웃 설정 저장
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 학생 배정 모달 */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-md rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-accent text-accent-foreground">
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <UserPlus className="h-6 w-6" /> 좌석 배정
            </DialogTitle>
            <DialogDescription className="text-accent-foreground/80 font-bold">
              {selectedSeatForAssign?.seatNo}번 좌석에 배정할 학생을 선택하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-4">미배정 학생 목록 ({unassignedStudents.length})</h4>
            <ScrollArea className="h-[300px] pr-4">
              {studentsLoading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div> :
               unassignedStudents.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground italic text-sm font-bold bg-muted/20 rounded-2xl">
                  좌석을 기다리는 학생이 없습니다.
                </div>
              ) : (
                <div className="grid gap-2">
                  {unassignedStudents.map((student) => (
                    <div 
                      key={student.id} 
                      onClick={() => assignStudentToSeat(student)}
                      className="flex items-center justify-between p-4 rounded-2xl border-2 border-transparent hover:border-accent hover:bg-accent/5 transition-all cursor-pointer group"
                    >
                      <div className="flex flex-col">
                        <span className="font-black text-lg group-hover:text-accent">{student.name}</span>
                        <span className="text-xs font-bold text-muted-foreground">{student.grade} · 일일 {student.targetDailyMinutes}분</span>
                      </div>
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-colors">
                        <Check className="h-4 w-4" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
          <DialogFooter className="p-4 bg-muted/30 border-t">
            <Button variant="ghost" onClick={() => setIsAssignModalOpen(false)} className="w-full rounded-xl font-bold">닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
