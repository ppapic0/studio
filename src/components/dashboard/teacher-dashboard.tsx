
'use client';

import { useState, useMemo, useEffect } from 'react';
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
  Loader2, 
  MessageSquare, 
  ChevronRight, 
  AlertCircle, 
  Clock, 
  MapPin, 
  Maximize2, 
  Activity, 
  ArrowRight,
  History,
  UserPlus,
  UserMinus,
  Search
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
  updateDoc,
  collectionGroup
} from 'firebase/firestore';
import { StudentProfile, AttendanceCurrent, CenterMembership, StudyLogDay } from '@/lib/types';
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
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

const GRID_WIDTH = 20;
const GRID_HEIGHT = 10;

export function TeacherDashboard({ isActive }: { isActive: boolean }) {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const isMobile = viewMode === 'mobile';
  
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isManagingSeatModalOpen, setIsManagingSeatModalOpen] = useState(false);
  
  const [selectedSeatForAssign, setSelectedSeatForAssign] = useState<{id: string, seatNo: number} | null>(null);
  const [selectedSeatForManage, setSelectedSeatForManage] = useState<AttendanceCurrent | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [now, setNow] = useState(Date.now());

  // 실시간 시간 업데이트 (1분마다)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const centerId = activeMembership?.id;
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  // 1. 모든 학생 상세 프로필
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'students'), orderBy('name', 'asc'));
  }, [firestore, centerId]);
  const { data: students } = useCollection<StudentProfile>(studentsQuery, { enabled: isActive });

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

  // 4. 오늘 학습 로그 (누적 시간용)
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
  const { data: rawAppointments, isLoading: aptLoading } = useCollection<any>(appointmentsQuery, { enabled: isActive });

  const appointments = useMemo(() => {
    if (!rawAppointments) return [];
    return [...rawAppointments].sort((a, b) => (b.scheduledAt?.toMillis() || 0) - (a.scheduledAt?.toMillis() || 0));
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

  const unassignedStudents = useMemo(() => {
    if (!students || !studentMembers) return [];
    return students.filter(s => {
      const membership = studentMembers.find(m => m.id === s.id);
      return membership?.status === 'active' && (!s.seatNo || s.seatNo === 0);
    }).filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [students, studentMembers, searchTerm]);

  const handleStatusUpdate = async (status: AttendanceCurrent['status']) => {
    if (!firestore || !centerId || !selectedSeatForManage) return;
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeatForManage.id), { status, updatedAt: serverTimestamp() });
      toast({ title: "상태 변경 완료" });
      setIsManagingSeatModalOpen(false);
    } catch (e) { toast({ variant: "destructive", title: "변경 실패" }); }
  };

  const assignStudentToSeat = async (student: StudentProfile) => {
    if (!firestore || !centerId || !selectedSeatForAssign) return;
    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'centers', centerId, 'students', student.id), { seatNo: selectedSeatForAssign.seatNo, updatedAt: serverTimestamp() });
      batch.update(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeatForAssign.id), { studentId: student.id, status: 'absent', updatedAt: serverTimestamp() });
      await batch.commit();
      toast({ title: `${student.name} 학생 좌석 배정 완료` });
      setIsAssignModalOpen(false);
    } catch (e) { toast({ variant: "destructive", title: "배정 실패" }); }
  };

  const unassignStudentFromSeat = async () => {
    if (!firestore || !centerId || !selectedSeatForManage?.studentId) return;
    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'centers', centerId, 'students', selectedSeatForManage.studentId), { seatNo: 0, updatedAt: serverTimestamp() });
      batch.update(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeatForManage.id), { studentId: null, status: 'absent', updatedAt: serverTimestamp() });
      await batch.commit();
      toast({ title: "좌석 배정 해제 완료" });
      setIsManagingSeatModalOpen(false);
    } catch (e) { toast({ variant: "destructive", title: "해제 실패" }); }
  };

  const getLiveTimeLabel = (seat: AttendanceCurrent) => {
    const studentLog = todayLogs?.find(l => l.studentId === seat.studentId);
    let totalMins = studentLog?.totalMinutes || 0;

    if (seat.status === 'studying' && seat.lastCheckInAt) {
      const startTime = seat.lastCheckInAt.toMillis();
      const sessionMins = Math.floor((now - startTime) / 60000);
      totalMins += Math.max(0, sessionMins);
    }

    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h}h ${m}m`;
  };

  if (!isActive) return null;

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">
      {/* 1. 실시간 관제 섹션 (퀵 지표 + 도면) */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 px-1">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-black tracking-tighter">실시간 관제 홈</h2>
          <Badge className="bg-emerald-500 text-white border-none font-black text-[10px]">LIVE</Badge>
        </div>

        <div className={cn("grid gap-3", isMobile ? "grid-cols-2" : "grid-cols-4")}>
          {[
            { label: '학습 중', val: attendanceList?.filter(a => a.status === 'studying').length || 0, color: 'text-emerald-600', icon: Activity, bg: 'bg-emerald-50/50' },
            { label: '미입실', val: attendanceList?.filter(a => a.studentId && a.status === 'absent').length || 0, color: 'text-rose-600', icon: AlertCircle, bg: 'bg-rose-50/50' },
            { label: '외출/휴식', val: attendanceList?.filter(a => ['away', 'break'].includes(a.status)).length || 0, color: 'text-amber-600', icon: Clock, bg: 'bg-amber-50/50' },
            { label: '배치 좌석', val: attendanceList?.length || 0, color: 'text-primary', icon: Armchair, bg: 'bg-muted/30' }
          ].map((item, i) => (
            <Card key={i} className={cn("rounded-[1.5rem] border-none shadow-sm p-4 flex flex-col gap-1", item.bg)}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-black uppercase text-muted-foreground/60">{item.label}</span>
                <item.icon className={cn("h-3.5 w-3.5", item.color)} />
              </div>
              <div className={cn("text-3xl font-black tracking-tighter", item.color)}>{item.val}</div>
            </Card>
          ))}
        </div>

        <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white ring-1 ring-border/50">
          <CardHeader className={cn("bg-muted/5 border-b", isMobile ? "p-5" : "p-8")}>
            <div className="flex justify-between gap-4 items-center">
              <CardTitle className="text-xl sm:text-2xl font-black flex items-center gap-2 tracking-tighter">
                <Armchair className="h-5 w-5 text-primary shrink-0" /> 실시간 좌석 상황판
              </CardTitle>
              <Button variant="outline" size="sm" className="rounded-2xl font-black h-10 px-4" asChild>
                <Link href="/dashboard/teacher/layout-view">전체 도면 보기</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className={cn("bg-[#fafafa]", isMobile ? "p-4" : "p-8")}>
            {attendanceLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
            ) : !attendanceList?.length ? (
              <div className="py-20 text-center text-muted-foreground/40 font-black italic">배치된 좌석이 없습니다.</div>
            ) : (
              <div className={cn("w-full bg-white p-6 rounded-3xl border shadow-inner overflow-hidden")}>
                <div 
                  className="grid w-full gap-2 mx-auto"
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
                        onClick={() => occupant ? (setSelectedSeatForManage(seat), setIsManagingSeatModalOpen(true)) : (setSelectedSeatForAssign({id: seat.id, seatNo: seat.seatNo}), setIsAssignModalOpen(true))}
                        className={cn(
                          "aspect-square rounded-lg border flex flex-col items-center justify-center transition-all relative cursor-pointer shadow-sm active:scale-90 p-1",
                          isStudying ? "bg-emerald-500 border-emerald-600 text-white shadow-lg" : 
                          isAlert ? "bg-rose-50 border-rose-400 text-rose-700" :
                          seat.status === 'away' || seat.status === 'break' ? "bg-amber-500 border-amber-600 text-white" : 
                          occupant ? "bg-white border-primary/20 text-primary" : "bg-white border-primary/5 opacity-30"
                        )}
                      >
                        <span className="font-black absolute top-0.5 left-0.5 text-[7px] opacity-40">{seat.seatNo}</span>
                        <span className="font-black truncate w-full text-center text-[10px] leading-tight">{occupant?.name || ''}</span>
                        {occupant && <span className="text-[8px] font-bold opacity-80 mt-0.5">{getLiveTimeLabel(seat)}</span>}
                        {isStudying && <Activity className="h-1.5 w-1.5 animate-pulse absolute bottom-1" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 2. 오늘 상담 현황 섹션 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-black tracking-tighter">오늘 상담 현황</h2>
        </div>
        
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
          <CardContent className="p-0">
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
                  <div key={apt.id} className="p-6 flex items-center justify-between hover:bg-muted/5 transition-colors group">
                    <div className="flex items-center gap-6">
                      <div className="h-14 w-14 rounded-2xl bg-primary/5 border-2 border-primary/10 flex flex-col items-center justify-center shrink-0 group-hover:bg-primary transition-all duration-500">
                        <span className="text-[10px] font-black text-primary/60 group-hover:text-white/60 uppercase">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'aaa') : ''}</span>
                        <span className="text-lg font-black text-primary group-hover:text-white">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'h:mm') : ''}</span>
                      </div>
                      <div>
                        <h3 className="text-lg font-black group-hover:text-primary transition-colors">{apt.studentName} 학생</h3>
                        <p className="text-xs font-bold text-muted-foreground">{apt.studentNote || '상담 주제 미입력'}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10 transition-all" asChild>
                      <Link href={`/dashboard/teacher/students/${apt.studentId}`}><ChevronRight className="h-5 w-5" /></Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 좌석 관리 및 배정 모달 (기존 로직 유지) */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden sm:max-w-md">
          <div className="bg-primary p-8 text-white"><DialogTitle className="text-2xl font-black">학생 배정 (SEAT {selectedSeatForAssign?.seatNo})</DialogTitle></div>
          <div className="p-6 space-y-4">
            <Input placeholder="이름 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="rounded-xl border-2" />
            <ScrollArea className="h-64">
              {unassignedStudents.map(s => (
                <div key={s.id} onClick={() => assignStudentToSeat(s)} className="p-4 rounded-xl hover:bg-primary/5 cursor-pointer flex justify-between items-center group">
                  <span className="font-bold">{s.name} ({s.schoolName})</span>
                  <UserPlus className="h-4 w-4 opacity-0 group-hover:opacity-100" />
                </div>
              ))}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isManagingSeatModalOpen} onOpenChange={setIsManagingSeatModalOpen}>
        <DialogContent className="rounded-[2.5rem] p-0 overflow-hidden sm:max-w-md">
          {selectedSeatForManage && (
            <>
              <div className="bg-primary p-8 text-white">
                <DialogTitle className="text-3xl font-black">{students?.find(s => s.id === selectedSeatForManage.studentId)?.name} 학생</DialogTitle>
                <p className="opacity-60 text-xs font-bold mt-1">SEAT NO. {selectedSeatForManage.seatNo}</p>
              </div>
              <div className="p-8 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={() => handleStatusUpdate('studying')} className="h-16 rounded-2xl bg-emerald-500 font-black"><Clock className="mr-2 h-4 w-4" /> 입실</Button>
                  <Button onClick={() => handleStatusUpdate('absent')} variant="outline" className="h-16 rounded-2xl text-rose-600 border-rose-200 font-black"><AlertCircle className="mr-2 h-4 w-4" /> 퇴실</Button>
                </div>
                <Button variant="ghost" onClick={unassignStudentFromSeat} className="w-full text-rose-600 font-bold"><UserMinus className="mr-2 h-4 w-4" /> 좌석 배정 해제</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
