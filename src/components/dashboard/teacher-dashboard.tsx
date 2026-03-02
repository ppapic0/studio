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
  Search,
  Monitor,
  Zap
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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const centerId = activeMembership?.id;
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'students'), orderBy('name', 'asc'));
  }, [firestore, centerId]);
  const { data: students } = useCollection<StudentProfile>(studentsQuery, { enabled: isActive });

  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'student'));
  }, [firestore, centerId]);
  const { data: studentMembers } = useCollection<CenterMembership>(membersQuery, { enabled: isActive });

  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery, { enabled: isActive });

  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return query(collectionGroup(firestore, 'days'), where('centerId', '==', centerId), where('dateKey', '==', todayKey));
  }, [firestore, centerId, todayKey]);
  const { data: todayLogs } = useCollection<StudyLogDay>(logsQuery, { enabled: isActive });

  const appointmentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    const todayDate = new Date();
    return query(collection(firestore, 'centers', centerId, 'counselingReservations'), where('scheduledAt', '>=', Timestamp.fromDate(startOfDay(todayDate))), where('scheduledAt', '<=', Timestamp.fromDate(endOfDay(todayDate))));
  }, [firestore, centerId]);
  const { data: rawAppointments, isLoading: aptLoading } = useCollection<any>(appointmentsQuery, { enabled: isActive });

  const appointments = useMemo(() => rawAppointments ? [...rawAppointments].sort((a,b)=>(b.scheduledAt?.toMillis()||0)-(a.scheduledAt?.toMillis()||0)) : [], [rawAppointments]);

  const seatBounds = useMemo(() => {
    if (!attendanceList || attendanceList.length === 0) return null;
    let minX = GRID_WIDTH, maxX = 0, minY = GRID_HEIGHT, maxY = 0;
    attendanceList.forEach(s => { if (s.gridX!==undefined&&s.gridY!==undefined){ minX=Math.min(minX,s.gridX); maxX=Math.max(maxX,s.gridX); minY=Math.min(minY,s.gridY); maxY=Math.max(maxY,s.gridY); }});
    return { minX, maxX, minY, maxY };
  }, [attendanceList]);

  const gridDimensions = useMemo(() => {
    if (!seatBounds) return { cols: GRID_WIDTH, rows: GRID_HEIGHT, startX: 0, startY: 0 };
    return { cols: seatBounds.maxX - seatBounds.minX + 1, rows: seatBounds.maxY - seatBounds.minY + 1, startX: seatBounds.minX, startY: seatBounds.minY };
  }, [seatBounds]);

  const getLiveTimeLabel = (seat: AttendanceCurrent) => {
    if (!seat.studentId) return '0h 0m';
    const studentLog = todayLogs?.find(l => l.studentId === seat.studentId);
    let totalMins = studentLog?.totalMinutes || 0;
    if (seat.status === 'studying' && seat.lastCheckInAt) {
      const startTime = seat.lastCheckInAt.toMillis();
      totalMins += Math.floor((now - startTime) / 60000);
    }
    const h = Math.floor(totalMins / 60); const m = totalMins % 60;
    return `${h}h ${m}m`;
  };

  const handleStatusUpdate = async (status: AttendanceCurrent['status']) => {
    if (!firestore || !centerId || !selectedSeatForManage) return;
    await updateDoc(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeatForManage.id), { status, updatedAt: serverTimestamp() });
    setIsManagingSeatModalOpen(false);
  };

  if (!isActive) return null;

  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto pb-20">
      <section className="space-y-6">
        <div className="flex items-center gap-2 px-1"><Monitor className="h-6 w-6 text-primary" /><h2 className="text-2xl font-black tracking-tighter">실시간 관제 홈</h2><Badge className="bg-blue-600 text-white border-none font-black text-[10px] animate-pulse">LIVE</Badge></div>
        <div className={cn("grid gap-4", isMobile ? "grid-cols-2" : "grid-cols-4")}>
          {[
            { label: '학습 중', val: attendanceList?.filter(a => a.status === 'studying').length || 0, color: 'text-blue-600', icon: Activity, bg: 'bg-blue-50/50' },
            { label: '미입실', val: attendanceList?.filter(a => a.studentId && a.status === 'absent').length || 0, color: 'text-rose-600', icon: AlertCircle, bg: 'bg-rose-50/50' },
            { label: '외출/휴식', val: attendanceList?.filter(a => ['away', 'break'].includes(a.status)).length || 0, color: 'text-amber-600', icon: Clock, bg: 'bg-amber-50/50' },
            { label: '배치 좌석', val: attendanceList?.length || 0, color: 'text-primary', icon: Armchair, bg: 'bg-muted/30' }
          ].map((item, i) => (
            <Card key={i} className={cn("rounded-[2rem] border-none shadow-md p-6 flex flex-col gap-1 transition-all hover:shadow-lg", item.bg)}>
              <div className="flex justify-between items-center mb-2"><span className="text-[10px] font-black uppercase text-muted-foreground/60">{item.label}</span><item.icon className="h-5 w-5" /></div>
              <div className={cn("text-4xl font-black tracking-tighter", item.color)}>{item.val}</div>
            </Card>
          ))}
        </div>
        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white ring-1 ring-border/50">
          <CardHeader className="bg-muted/5 border-b p-10"><div className="flex justify-between items-center"><div className="space-y-1"><CardTitle className="text-2xl font-black flex items-center gap-3"><Armchair className="h-6 w-6 text-primary" /> 실시간 좌석 상황판</CardTitle></div><Button variant="outline" size="sm" className="rounded-2xl h-11 px-6 border-2 shadow-sm bg-white" asChild><Link href="/dashboard/teacher/layout-view">도면 보기</Link></Button></div></CardHeader>
          <CardContent className="bg-[#fafafa] p-10">
            {attendanceLoading ? <div className="py-40 flex justify-center"><Loader2 className="animate-spin text-primary opacity-20" /></div> : (
              <div className="w-full bg-white p-8 rounded-[2.5rem] border shadow-inner relative">
                <div className="grid w-full gap-3" style={{ gridTemplateColumns: `repeat(${gridDimensions.cols}, minmax(0, 1fr))` }}>
                  {Array.from({ length: gridDimensions.rows * gridDimensions.cols }).map((_, idx) => {
                    const x = gridDimensions.startX + (idx % gridDimensions.cols); const y = gridDimensions.startY + Math.floor(idx / gridDimensions.cols);
                    const seat = attendanceList?.find(a => a.gridX === x && a.gridY === y); const occupant = students?.find(s => s.id === seat?.studentId);
                    if (!seat) return <div key={idx} className="aspect-square opacity-0" />;
                    const isStudying = seat.status === 'studying'; const isAlert = seat.studentId && seat.status === 'absent';
                    return (
                      <div key={seat.id} onClick={() => occupant ? (setSelectedSeatForManage(seat), setIsManagingSeatModalOpen(true)) : null}
                        className={cn("aspect-square rounded-xl border-2 flex flex-col items-center justify-center transition-all relative cursor-pointer active:scale-90 p-1",
                          isStudying ? "bg-blue-600 border-blue-700 text-white shadow-xl scale-105 z-10" : isAlert ? "bg-rose-50 border-rose-400 text-rose-700" : seat.status === 'away' || seat.status === 'break' ? "bg-amber-500 border-amber-600 text-white" : occupant ? "bg-white border-primary/20 text-primary" : "bg-white opacity-10")}>
                        <span className={cn("font-black absolute top-1 left-1.5 text-[8px]", isStudying ? "opacity-60" : "opacity-30")}>{seat.seatNo}</span>
                        <span className="font-black truncate w-full text-center text-[11px] leading-tight">{occupant?.name || ''}</span>
                        {occupant && <span className={cn("text-[9px] font-bold mt-1", isStudying ? "text-white" : "text-primary/60")}>{getLiveTimeLabel(seat)}</span>}
                        {isStudying && <Activity className="h-2 w-2 animate-pulse absolute bottom-1.5" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1"><MessageSquare className="h-6 w-6 text-primary" /><h2 className="text-2xl font-black tracking-tighter">오늘 상담 현황</h2></div>
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
          <CardContent className="p-0">
            {appointments.length === 0 ? <div className="py-24 text-center opacity-20 italic">오늘 예정된 상담 없음</div> : (
              <div className="divide-y">
                {appointments.map((apt: any) => (
                  <div key={apt.id} className="p-8 flex items-center justify-between hover:bg-muted/5 transition-colors group">
                    <div className="flex items-center gap-8"><div className="h-16 w-16 rounded-[1.5rem] bg-primary/5 border-2 border-primary/10 flex flex-col items-center justify-center shrink-0 group-hover:bg-primary transition-all duration-500 shadow-inner"><span className="text-[10px] font-black text-primary/60 group-hover:text-white/60 uppercase leading-none mb-0.5">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'aaa') : ''}</span><span className="text-xl font-black text-primary group-hover:text-white">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'h:mm') : ''}</span></div><div className="space-y-1"><h3 className="text-xl font-black group-hover:text-primary transition-colors">{apt.studentName} 학생</h3><p className="text-sm font-bold text-muted-foreground">{apt.studentNote || '상담 주제 미입력'}</p></div></div>
                    <Button variant="secondary" className="rounded-2xl font-black h-12 px-6 gap-2 bg-muted/50 hover:bg-primary hover:text-white transition-all shadow-sm" asChild><Link href={`/dashboard/teacher/students/${apt.studentId}`}>상세 분석 리포트 <ChevronRight className="h-4 w-4" /></Link></Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Dialog open={isManagingSeatModalOpen} onOpenChange={setIsManagingSeatModalOpen}>
        <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl sm:max-w-md">
          {selectedSeatForManage && (
            <>
              <div className={cn("p-10 text-white", selectedSeatForManage.status === 'studying' ? "bg-blue-600" : "bg-primary")}><DialogTitle className="text-4xl font-black tracking-tighter">{students?.find(s => s.id === selectedSeatForManage.studentId)?.name} 학생</DialogTitle><Badge className="bg-white/20 text-white border-none font-black px-3 py-1 mt-2">SEAT NO. {selectedSeatForManage.seatNo}</Badge></div>
              <div className="p-8 space-y-5 bg-white">
                <div className="grid grid-cols-2 gap-4"><Button onClick={() => handleStatusUpdate('studying')} className="h-20 rounded-[1.5rem] bg-blue-600 hover:bg-blue-700 font-black text-lg shadow-xl gap-3"><Activity className="h-5 w-5" /> 입실/학습</Button><Button onClick={() => handleStatusUpdate('absent')} variant="outline" className="h-20 rounded-[1.5rem] text-rose-600 border-rose-200 hover:bg-rose-50 font-black text-lg gap-3"><AlertCircle className="h-5 w-5" /> 하원/퇴실</Button></div>
                <div className="pt-4 border-t border-dashed space-y-3"><Button variant="secondary" className="w-full h-14 rounded-2xl font-black gap-2 bg-muted/50" asChild><Link href={`/dashboard/teacher/students/${selectedSeatForManage.studentId}`}><Activity className="h-4 w-4" /> 학생 상세 리포트</Link></Button></div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}