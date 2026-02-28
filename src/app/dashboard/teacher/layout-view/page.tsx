
'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useDoc } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, doc, updateDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { type StudentProfile, type AttendanceCurrent, StudyLogDay, GrowthProgress, StudyPlanItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { 
  Armchair, 
  Loader2, 
  Monitor, 
  Users, 
  MapPin,
  Maximize2,
  RefreshCw,
  AlertCircle,
  Clock,
  ChevronRight,
  Settings2,
  Zap,
  Trophy,
  Activity,
  ClipboardCheck,
  Check,
  CheckCircle2,
  CircleDot,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

// --- 프리미엄 차트 툴팁 ---
const CustomTooltip = ({ active, payload, label, unit = '시간' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-xl border-2 border-primary/10 p-4 rounded-2xl shadow-xl">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-primary">{payload[0].value}</span>
          <span className="text-[10px] font-bold text-primary/60">{unit}</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function LayoutViewPage() {
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();
  const centerId = activeMembership?.id;
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const weekKey = format(new Date(), "yyyy-'W'II");

  const [selectedSeat, setSelectedSeat] = useState<AttendanceCurrent | null>(null);
  const [isManaging, setIsManaging] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  
  const [isDetailPopupOpen, setIsDetailOpen] = useState(false);
  const [isPlanPopupOpen, setIsPlanOpen] = useState(false);

  // 데이터 조회
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'students');
  }, [firestore, centerId]);
  const { data: students, isLoading: studentsLoading } = useCollection<StudentProfile>(studentsQuery);

  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery);

  // 팝업용 데이터 조회
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

  const isLoading = studentsLoading || attendanceLoading;
  
  const studyingCount = attendanceList?.filter(a => a.status === 'studying').length ?? 0;
  const alertCount = attendanceList?.filter(a => a.studentId && a.status === 'absent').length ?? 0;

  const detailStats = useMemo(() => {
    if (!studentLogs) return { today: 0, weeklyAvg: 0, chartData: [] };
    const todayLog = studentLogs.find(l => l.dateKey === todayKey);
    const last7Days = studentLogs.slice(0, 7);
    const weeklyAvg = last7Days.length > 0 ? Math.round(last7Days.reduce((acc, c) => acc + c.totalMinutes, 0) / 7) : 0;
    
    return {
      today: todayLog?.totalMinutes || 0,
      weeklyAvg,
      chartData: studentLogs.slice(0, 14).reverse().map(l => ({
        name: format(new Date(l.dateKey), 'MM/dd'),
        hours: Number((l.totalMinutes / 60).toFixed(1))
      }))
    };
  }, [studentLogs, todayKey]);

  const handleStatusUpdate = async (status: AttendanceCurrent['status']) => {
    if (!firestore || !centerId || !selectedSeat) return;
    
    try {
      const seatRef = doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id);
      await updateDoc(seatRef, {
        status,
        updatedAt: serverTimestamp()
      });
      toast({ title: `좌석 ${selectedSeat.seatNo}번 상태가 ${status}로 변경되었습니다.` });
      setIsManaging(false);
    } catch (e) {
      toast({ variant: "destructive", title: "상태 변경 실패" });
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto pb-10">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
            <Monitor className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            실시간 관제 커맨드 센터
          </h1>
          <p className="text-xs font-bold text-muted-foreground">센터 내 모든 좌석의 실시간 상태를 감시하고 즉각적으로 대응합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-xl font-bold h-10 gap-2 bg-white shadow-sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" /> 새로고침
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '현재 학습 중', val: studyingCount, color: 'text-emerald-600', icon: Users, bg: 'bg-emerald-50/50' },
          { label: '미입실/지각', val: alertCount, color: 'text-rose-600', icon: AlertCircle, bg: 'bg-rose-50/50' },
          { label: '전체 좌석 점유', val: attendanceList?.filter(a => a.studentId).length || 0, color: 'text-primary', icon: Armchair, bg: 'bg-white' },
          { label: '실시간 가동률', val: `${attendanceList && attendanceList.length > 0 ? Math.round((studyingCount / attendanceList.length) * 100) : 0}%`, color: 'text-primary', icon: Monitor, bg: 'bg-white' }
        ].map((item, i) => (
          <Card key={i} className={cn("rounded-xl border-none shadow-lg overflow-hidden relative group", item.bg, i < 2 && "ring-1 ring-opacity-20", i === 0 && "ring-emerald-500", i === 1 && "ring-rose-500")}>
            <CardContent className="p-3 sm:p-4">
              <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">{item.label}</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className={cn("text-xl sm:text-2xl font-black", item.color)}>{item.val}</span>
                {typeof item.val === 'number' && <span className="text-[10px] font-bold opacity-40">명</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white ring-1 ring-border/50">
        <CardContent className="p-4 sm:p-10 bg-[#f8f9fa]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
              <Loader2 className="animate-spin h-12 w-12 text-primary" />
              <p className="font-bold text-muted-foreground">실시간 관제 시스템 연결 중...</p>
            </div>
          ) : !attendanceList || attendanceList.length === 0 ? (
            <div className="py-40 text-center flex flex-col items-center gap-4">
              <Armchair className="h-20 w-20 text-muted-foreground opacity-10" />
              <p className="text-xl font-bold text-muted-foreground/40">배치된 좌석이 없습니다.</p>
            </div>
          ) : (
            <div className="w-full overflow-auto custom-scrollbar bg-white rounded-[2rem] border shadow-2xl p-6 sm:p-12">
              <div 
                className="grid gap-2 sm:gap-3 mx-auto relative"
                style={{ 
                  gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(40px, 50px))`, 
                  width: 'fit-content',
                  backgroundImage: 'radial-gradient(circle, #00000008 1px, transparent 1px)',
                  backgroundSize: '20px 20px'
                }}
              >
                {Array.from({ length: GRID_HEIGHT * GRID_WIDTH }).map((_, idx) => {
                  const x = idx % GRID_WIDTH;
                  const y = Math.floor(idx / GRID_WIDTH);
                  const seat = attendanceList.find(a => a.gridX === x && a.gridY === y);
                  const occupant = students?.find(s => s.id === seat?.studentId);

                  if (!seat) return <div key={idx} className="w-[40px] h-[40px] sm:w-[50px] sm:h-[50px] opacity-[0.01]" />;

                  const isLateOrAbsent = seat.studentId && seat.status === 'absent';

                  return (
                    <div 
                      key={seat.id} 
                      onClick={() => {
                        if (occupant) {
                          setSelectedStudentId(occupant.id);
                        }
                        setSelectedSeat(seat);
                        setIsManaging(true);
                      }}
                      className={cn(
                        "w-[40px] h-[40px] sm:w-[50px] sm:h-[50px] rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-500 relative cursor-pointer group border-solid",
                        seat.status === 'studying' ? "bg-emerald-500 border-emerald-600 text-white shadow-md scale-110 z-10 animate-pulse-soft" : 
                        isLateOrAbsent ? "bg-rose-50 border-rose-500 text-rose-700 shadow-inner" :
                        seat.status === 'away' ? "bg-amber-500 border-amber-600 text-white" :
                        seat.status === 'break' ? "bg-blue-500 border-blue-600 text-white" : 
                        occupant ? "bg-white border-primary/40 text-primary hover:border-primary" : "bg-white border-primary/10 text-muted-foreground/10 hover:border-primary/30"
                      )}
                    >
                      <span className={cn(
                        "text-[7px] sm:text-[9px] font-black absolute top-1 left-1.5",
                        seat.status === 'studying' || seat.status === 'away' || seat.status === 'break' ? "opacity-60" : "opacity-30"
                      )}>{seat.seatNo}</span>
                      
                      <span className={cn(
                        "text-[9px] sm:text-[11px] font-black truncate px-1 w-full text-center mt-1",
                        isLateOrAbsent ? "text-rose-600" : ""
                      )}>
                        {occupant ? occupant.name : ''}
                      </span>
                      
                      {isLateOrAbsent && (
                        <div className="absolute -top-1 -right-1 bg-rose-600 text-white p-0.5 rounded-full shadow-lg border border-white animate-bounce">
                          <AlertCircle className="h-2.5 w-2.5" />
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

      <footer className="flex flex-wrap gap-4 sm:gap-8 items-center justify-center p-6 bg-white rounded-[2rem] border shadow-sm ring-1 ring-border/50">
        {[
          { label: '집중 학습', color: 'bg-emerald-500', desc: '몰입 중' },
          { label: '미입실/지각', color: 'bg-rose-500', desc: '경고 상태' },
          { label: '외출 중', color: 'bg-amber-500', desc: '일시 이탈' },
          { label: '휴식 중', color: 'bg-blue-500', desc: '공식 휴식' },
          { label: '빈 좌석', color: 'bg-white border-2 border-primary/10', desc: '배정 가능' }
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-xl border border-border/50">
            <div className={cn("w-3.5 h-3.5 rounded-md shadow-sm", item.color)} />
            <div className="flex flex-col leading-none">
              <span className="text-[10px] font-black text-foreground">{item.label}</span>
              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter">{item.desc}</span>
            </div>
          </div>
        ))}
      </footer>

      <Dialog open={isManaging} onOpenChange={setIsManaging}>
        <DialogContent className="rounded-[2rem] sm:max-w-md border-none shadow-2xl p-0 overflow-hidden">
          {selectedSeat && (
            <>
              <div className={cn(
                "p-8 text-white relative overflow-hidden",
                selectedSeat.status === 'studying' ? "bg-emerald-600" : 
                selectedSeat.studentId && selectedSeat.status === 'absent' ? "bg-rose-600" : 
                "bg-primary"
              )}>
                <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
                  <Armchair className="h-32 w-32" />
                </div>
                <DialogHeader className="relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge className="bg-white/20 text-white border-none font-black text-[10px] tracking-widest uppercase">Seat Control</Badge>
                    <span className="text-white/60 font-bold text-xs">{selectedSeat.seatNo}번 좌석</span>
                  </div>
                  <DialogTitle className="text-4xl font-black tracking-tighter">
                    {students?.find(s => s.id === selectedSeat.studentId)?.name || '공석'}
                  </DialogTitle>
                  <DialogDescription className="text-white/70 font-bold text-lg">
                    현재 상태: <span className="text-white underline underline-offset-4">{
                      selectedSeat.status === 'studying' ? '학습 중' :
                      selectedSeat.status === 'away' ? '외출 중' :
                      selectedSeat.status === 'break' ? '휴식 중' : '미입실'
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

                {selectedSeat.studentId && (
                  <div className="pt-4 border-t border-dashed flex flex-col gap-2">
                    <Button 
                      variant="secondary" 
                      className="w-full h-12 rounded-xl font-black gap-2 transition-all active:scale-95" 
                      onClick={() => {
                        setIsManaging(false);
                        setIsDetailOpen(true);
                      }}
                    >
                      <BarChart3 className="h-4 w-4" /> 상세정보 리포트 보기
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full h-12 rounded-xl font-black gap-2 transition-all active:scale-95" 
                      onClick={() => {
                        setIsManaging(false);
                        setIsPlanOpen(true);
                      }}
                    >
                      <ClipboardCheck className="h-4 w-4" /> 학습계획 확인하기
                    </Button>
                  </div>
                )}
              </div>
              <DialogFooter className="p-6 bg-muted/10">
                <Button variant="ghost" onClick={() => setIsManaging(false)} className="w-full rounded-xl font-black">닫기</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 학생 상세 정보 리포트 팝업 */}
      <Dialog open={isDetailPopupOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-[3rem] p-0 border-none shadow-2xl">
          <div className="bg-primary p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-10">
              <Zap className="h-40 w-40" />
            </div>
            <DialogHeader className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <Badge className="bg-white/20 text-white border-none font-black text-[10px] tracking-widest uppercase">Analytical Report</Badge>
                <span className="text-white/60 font-bold text-xs">{studentDetail?.seatNo}번 좌석</span>
              </div>
              <DialogTitle className="text-4xl font-black tracking-tighter">{studentDetail?.name} 학생 심층 분석</DialogTitle>
              <DialogDescription className="text-white/70 font-bold text-lg">최근 14일간의 학습 데이터와 성장 지표입니다.</DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-8 space-y-8 bg-white">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: '오늘 학습', val: `${Math.floor(detailStats.today / 60)}h ${detailStats.today % 60}m`, icon: Clock, color: 'text-emerald-500' },
                { label: '주간 평균', val: `${Math.floor(detailStats.weeklyAvg / 60)}h ${detailStats.weeklyAvg % 60}m`, icon: TrendingUp, color: 'text-blue-500' },
                { label: '마스터리', val: `Lv.${studentProgress?.level || 1}`, icon: Zap, color: 'text-purple-500' },
                { label: '시즌 랭킹', val: '준비 중', icon: Trophy, color: 'text-amber-500' }
              ].map((stat, i) => (
                <div key={i} className="p-4 rounded-3xl bg-muted/20 border border-border/50 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-muted-foreground uppercase">{stat.label}</span>
                    <stat.icon className={cn("h-3 w-3", stat.color)} />
                  </div>
                  <span className="text-xl font-black tracking-tight">{stat.val}</span>
                </div>
              ))}
            </div>

            <Card className="rounded-[2rem] border-none shadow-lg overflow-hidden bg-muted/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" /> 최근 학습 몰입 추이
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={detailStats.chartData}>
                    <defs>
                      <linearGradient id="barGradLayout" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="name" fontSize={10} fontWeight="900" axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} fontWeight="900" axisLine={false} tickLine={false} unit="h" />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.03)'}} />
                    <Bar dataKey="hours" fill="url(#barGradLayout)" radius={[10, 10, 0, 0]} barSize={35} animationDuration={1500} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <DialogFooter className="p-6 bg-muted/10">
            <Button onClick={() => setIsDetailOpen(false)} className="w-full rounded-2xl h-14 font-black shadow-xl">분석 리포트 닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 학습 계획 확인 팝업 */}
      <Dialog open={isPlanPopupOpen} onOpenChange={setIsPlanOpen}>
        <DialogContent className="max-w-lg rounded-[3rem] p-0 border-none shadow-2xl overflow-hidden">
          <div className="bg-emerald-600 p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-10">
              <ClipboardCheck className="h-40 w-40" />
            </div>
            <DialogHeader className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <Badge className="bg-white/20 text-white border-none font-black text-[10px] tracking-widest uppercase">Study Planner</Badge>
                <span className="text-white/60 font-bold text-xs">{studentDetail?.name} 학생</span>
              </div>
              <DialogTitle className="text-4xl font-black tracking-tighter">오늘의 학습 계획</DialogTitle>
              <DialogDescription className="text-white/70 font-bold text-lg">{format(new Date(), 'yyyy년 M월 d일')}</DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-6 bg-white max-h-[500px] overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <CircleDot className="h-3 w-3 text-emerald-500" /> 자습 To-do 리스트
              </h4>
              <div className="grid gap-3">
                {!studentPlans || studentPlans.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground/40 italic text-sm font-bold border-2 border-dashed rounded-3xl">작성된 계획이 없습니다.</div>
                ) : (
                  studentPlans.filter(p => p.category === 'study' || !p.category).map((task) => (
                    <div key={task.id} className="flex items-center gap-4 p-4 rounded-2xl border-2 border-border/50 bg-muted/5 group">
                      <div className={cn(
                        "h-6 w-6 rounded-lg flex items-center justify-center border-2 transition-all",
                        task.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/30"
                      )}>
                        {task.done && <Check className="h-4 w-4" />}
                      </div>
                      <span className={cn(
                        "flex-1 font-bold text-sm transition-all",
                        task.done ? "line-through text-muted-foreground opacity-50" : "text-foreground"
                      )}>{task.title}</span>
                      {task.done && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-dashed">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3 text-emerald-500" /> 생활 시간표
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {studentPlans?.filter(p => p.category === 'schedule').map((task) => {
                  const [title, time] = task.title.split(': ');
                  return (
                    <div key={task.id} className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 flex flex-col gap-0.5">
                      <span className="text-[9px] font-black text-emerald-700/60 uppercase">{title}</span>
                      <span className="text-base font-black text-emerald-900">{time}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="p-6 bg-muted/10">
            <Button onClick={() => setIsPlanOpen(false)} className="w-full rounded-2xl h-14 font-black shadow-xl bg-emerald-600 hover:bg-emerald-700">확인 완료</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
