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
  Maximize2,
  Zap,
  Trophy,
  ClipboardCheck,
  CalendarDays,
  Activity,
  CircleDot,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Sparkles
} from 'lucide-react';
import { useCollection, useFirestore, useDoc } from '@/firebase';
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
import { StudentProfile, AttendanceCurrent, StudyLogDay, GrowthProgress, LeaderboardEntry, StudyPlanItem } from '@/lib/types';
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
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  BarChart, 
  Bar
} from 'recharts';

const GRID_WIDTH = 20;
const GRID_HEIGHT = 10;

const CustomTooltip = ({ active, payload, label, unit = '시간' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-xl border-2 border-primary/10 p-3 rounded-xl shadow-xl">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-black text-primary">{payload[0].value}</span>
          <span className="text-[9px] font-bold text-primary/60">{unit}</span>
        </div>
      </div>
    );
  }
  return null;
};

export function TeacherDashboard({ isActive }: { isActive: boolean }) {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const isMobile = viewMode === 'mobile';
  
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isManagingSeatModalOpen, setIsManagingSeatModalOpen] = useState(false);
  
  const [isDetailPopupOpen, setIsDetailOpen] = useState(false);
  const [isPlanPopupOpen, setIsPlanOpen] = useState(false);
  
  const [selectedSeatForAssign, setSelectedSeatForAssign] = useState<{id: string, seatNo: number} | null>(null);
  const [selectedSeatForManage, setSelectedSeatForManage] = useState<AttendanceCurrent | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [tempLayout, setTempLayout] = useState<{ x: number, y: number, seatNo: number }[]>([]);

  const centerId = activeMembership?.id;
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const weekKey = format(new Date(), "yyyy-'W'II");

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
    return [...rawAppointments].sort((a, b) => a.scheduledAt?.toMillis() - b.scheduledAt?.toMillis());
  }, [rawAppointments]);

  const studentDetailRef = useMemoFirebase(() => {
    if (!firestore || !centerId || !selectedStudentId) return null;
    return doc(firestore, 'centers', centerId, 'students', selectedStudentId);
  }, [firestore, centerId, selectedStudentId]);
  const { data: studentDetail } = useDoc<StudentProfile>(studentDetailRef);

  const studentLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !selectedStudentId) return null;
    return collection(firestore, 'centers', centerId, 'studyLogs', selectedStudentId, 'days');
  }, [firestore, centerId, selectedStudentId]);
  const { data: studentLogs } = useCollection<StudyLogDay>(studentLogsQuery);

  const studentProgressRef = useMemoFirebase(() => {
    if (!firestore || !centerId || !selectedStudentId) return null;
    return doc(firestore, 'centers', centerId, 'growthProgress', selectedStudentId);
  }, [firestore, centerId, selectedStudentId]);
  const { data: studentProgress } = useDoc<GrowthProgress>(studentProgressRef);

  const studentPlansQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !selectedStudentId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'plans', selectedStudentId, 'weeks', weekKey, 'items'),
      where('dateKey', '==', todayKey)
    );
  }, [firestore, centerId, selectedStudentId, weekKey, todayKey]);
  const { data: studentPlans } = useCollection<StudyPlanItem>(studentPlansQuery);

  const unassignedStudents = useMemo(() => {
    if (!students) return [];
    return students.filter(s => !s.seatNo || s.seatNo === 0);
  }, [students]);

  const detailStats = useMemo(() => {
    if (!studentLogs) return { today: 0, weeklyAvg: 0, chartData: [] };
    const todayLog = studentLogs.find(l => l.dateKey === todayKey);
    const last7DaysLogs = studentLogs.slice(0, 7);
    const weeklyAvg = last7DaysLogs.length > 0 ? Math.round(last7DaysLogs.reduce((acc, c) => acc + c.totalMinutes, 0) / 7) : 0;
    
    return {
      today: todayLog?.totalMinutes || 0,
      weeklyAvg,
      chartData: studentLogs.slice(0, 14).reverse().map(l => ({
        name: format(new Date(l.dateKey), 'MM/dd'),
        hours: Number((l.totalMinutes / 60).toFixed(1))
      }))
    };
  }, [studentLogs, todayKey]);

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

      <div className={cn("grid gap-3", isMobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4")}>
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

      <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-3")}>
        <Card className={cn("rounded-[2rem] border-none shadow-xl overflow-hidden bg-white ring-1 ring-border/50", isMobile ? "" : "lg:col-span-2")}>
          <CardHeader className="bg-muted/5 border-b p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-lg sm:text-2xl font-black flex items-center gap-2">
                  <Armchair className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> 실시간 좌석 도면
                </CardTitle>
                <CardDescription className="font-bold text-[10px] sm:text-xs text-muted-foreground">좌석을 클릭하여 관리하세요.</CardDescription>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none rounded-xl font-black border-2 h-9 px-3 text-[10px] border-primary/10" asChild>
                  <Link href="/dashboard/teacher/layout-view">전체화면</Link>
                </Button>
                <Button variant="outline" size="sm" className="flex-1 sm:flex-none rounded-xl font-black border-2 h-9 px-3 gap-1.5 border-primary/10 text-[10px]" onClick={openLayoutEditor}>
                  <Settings2 className="h-3.5 w-3.5" /> 도면 편집
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 bg-[#fdfdfd]">
            {attendanceLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
            ) : !attendanceList || attendanceList.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center gap-4 bg-muted/5 rounded-[2rem] border-2 border-dashed">
                <Armchair className="h-12 w-12 text-muted-foreground opacity-10" />
                <p className="text-xs font-bold text-muted-foreground/40">좌석이 없습니다.</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto pb-2 custom-scrollbar">
                <div 
                  className="grid gap-1.5 mx-auto p-4 sm:p-6 bg-white rounded-[1.5rem] border shadow-inner relative"
                  style={{ 
                    gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(32px, 38px))`, 
                    width: 'fit-content',
                    backgroundImage: 'radial-gradient(circle, #00000003 1px, transparent 1px)',
                    backgroundSize: '16px 18px'
                  }}
                >
                  {Array.from({ length: GRID_HEIGHT * GRID_WIDTH }).map((_, idx) => {
                    const x = idx % GRID_WIDTH;
                    const y = Math.floor(idx / GRID_WIDTH);
                    const seat = attendanceList.find(a => a.gridX === x && a.gridY === y);
                    const occupant = students?.find(s => s.id === seat?.studentId);

                    if (!seat) return <div key={idx} className="w-[32px] h-[32px] opacity-[0.01]" />;

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
                          "w-[32px] h-[32px] rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-all relative cursor-pointer group shadow-sm",
                          seat.status === 'studying' ? "bg-emerald-500 border-emerald-600 text-white animate-pulse-soft" : 
                          isLateOrAbsent ? "bg-rose-50 border-rose-500 text-rose-700" :
                          seat.status === 'away' ? "bg-amber-500 border-amber-600 text-white" :
                          seat.status === 'break' ? "bg-blue-500 border-blue-600 text-white" : 
                          occupant ? "bg-white border-primary text-primary" : "bg-white border-primary/20 text-muted-foreground/20 hover:border-primary/40"
                        )}
                      >
                        <span className="text-[7px] font-black absolute top-0.5 left-1 opacity-40">{seat.seatNo}</span>
                        <span className="text-[8px] font-black truncate px-0.5 w-full text-center mt-1">
                          {occupant ? occupant.name : ''}
                        </span>
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
            <Button asChild variant="ghost" className="w-full mt-2 font-black text-[10px] text-primary/60 hover:text-primary transition-colors">
              <Link href="/dashboard/appointments" className="flex items-center justify-center gap-1">
                전체보기 <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

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
                    <Clock className="h-4 w-4" /> 입실/학습
                  </Button>
                  <Button onClick={() => handleStatusUpdate('away')} className="h-12 rounded-xl font-black bg-amber-500 shadow-lg text-sm gap-2">
                    <MapPin className="h-4 w-4" /> 외출 처리
                  </Button>
                  <Button onClick={() => handleStatusUpdate('break')} className="h-12 rounded-xl font-black bg-blue-500 shadow-lg text-sm gap-2">
                    <Maximize2 className="h-4 w-4" /> 휴식 처리
                  </Button>
                  <Button onClick={() => handleStatusUpdate('absent')} variant="outline" className="h-12 rounded-xl font-black border-2 border-rose-200 text-rose-600 text-sm gap-2">
                    <AlertCircle className="h-4 w-4" /> 퇴실 처리
                  </Button>
                </div>
                <div className="pt-2 border-t border-dashed flex flex-col gap-2">
                  <Button variant="secondary" className="w-full h-11 rounded-xl font-black gap-2 text-xs" onClick={() => { setIsManagingSeatModalOpen(false); setIsDetailOpen(true); }}>
                    <BarChart3 className="h-4 w-4" /> 분석 리포트
                  </Button>
                  <Button variant="outline" className="w-full h-11 rounded-xl font-black gap-2 text-xs" onClick={() => { setIsManagingSeatModalOpen(false); setIsPlanOpen(true); }}>
                    <ClipboardCheck className="h-4 w-4" /> 학습계획
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 분석 리포트 팝업 */}
      <Dialog open={isDetailPopupOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2rem] p-0 border-none shadow-2xl">
          <div className="bg-primary p-8 text-white">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-white/20 text-white border-none font-black text-[9px] uppercase">Analysis</Badge>
                <span className="text-white/60 font-bold text-[10px]">{studentDetail?.seatNo}번 좌석</span>
              </div>
              <DialogTitle className="text-3xl font-black tracking-tighter">{studentDetail?.name} 학생 분석</DialogTitle>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-6 bg-white">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: '오늘 학습', val: `${Math.floor(detailStats.today / 60)}h ${detailStats.today % 60}m`, icon: Clock, color: 'text-emerald-500' },
                { label: '주간 평균', val: `${Math.floor(detailStats.weeklyAvg / 60)}h ${detailStats.weeklyAvg % 60}m`, icon: TrendingUp, color: 'text-blue-500' }
              ].map((stat, i) => (
                <div key={i} className="p-3.5 rounded-2xl bg-muted/20 border border-border/50 flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-muted-foreground uppercase">{stat.label}</span>
                    <stat.icon className={cn("h-3 w-3", stat.color)} />
                  </div>
                  <span className="text-lg font-black">{stat.val}</span>
                </div>
              ))}
            </div>
            <Card className="rounded-2xl border-none shadow-md overflow-hidden bg-muted/5 h-[250px] p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={detailStats.chartData}>
                  <defs>
                    <linearGradient id="barGradDash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="name" fontSize={9} fontWeight="900" axisLine={false} tickLine={false} />
                  <YAxis fontSize={9} fontWeight="900" axisLine={false} tickLine={false} unit="h" />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.03)'}} />
                  <Bar dataKey="hours" fill="url(#barGradDash)" radius={[6, 6, 0, 0]} barSize={25} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
          <DialogFooter className="p-4 bg-muted/10">
            <Button onClick={() => setIsDetailOpen(false)} className="w-full rounded-xl h-12 font-black shadow-lg">닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
