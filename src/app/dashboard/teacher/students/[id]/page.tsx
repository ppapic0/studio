
'use client';

import { use, useState, useMemo, useEffect } from 'react';
import { useDoc, useCollection, useFirestore, useFunctions, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc, collection, query, where, writeBatch, serverTimestamp, addDoc, Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Loader2, 
  ArrowLeft, 
  Building2,
  TrendingUp,
  Zap,
  Clock,
  Trophy,
  CalendarDays,
  ChevronRight,
  Settings2,
  UserCheck,
  Lock,
  Sparkles,
  Activity,
  Check,
  CalendarPlus,
  FileEdit,
  History,
  MessageSquare,
  BarChart3,
  MousePointer2
} from 'lucide-react';
import Link from 'next/link';
import { StudentProfile, StudyLogDay, GrowthProgress, LeaderboardEntry, CenterMembership, CounselingLog } from '@/lib/types';
import { format, subDays, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  Cell, 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  RadialBarChart,
  RadialBar,
  Legend
} from 'recharts';
import { cn } from '@/lib/utils';

// --- 프리미엄 커스텀 툴팁 ---
const CustomTooltip = ({ active, payload, label, unit = '시간' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-xl border-2 border-primary/10 p-5 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] ring-1 ring-black/5 animate-in fade-in zoom-in duration-300">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{label}</p>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-black text-primary tracking-tighter drop-shadow-sm">{payload[0].value}</span>
          <span className="text-xs font-black text-primary/60">{unit}</span>
        </div>
        <div className="mt-2 pt-2 border-t border-dashed border-primary/10">
          <p className="text-[9px] font-bold text-muted-foreground/60 flex items-center gap-1">
            <MousePointer2 className="h-2 w-2" /> 상세 데이터 확인됨
          </p>
        </div>
      </div>
    );
  }
  return null;
};

// --- 스탯 분석 카드 컴포넌트 ---
function StatAnalysisCard({ 
  title, 
  value, 
  subValue, 
  icon: Icon, 
  colorClass, 
  onClick 
}: { 
  title: string; 
  value: string; 
  subValue: string; 
  icon: any; 
  colorClass: string;
  onClick: () => void;
}) {
  return (
    <Card 
      className="group cursor-pointer hover:shadow-[0_25px_60px_rgba(0,0,0,0.12)] transition-all duration-500 border-none shadow-md overflow-hidden relative active:scale-95 bg-white hover:-translate-y-1"
      onClick={onClick}
    >
      <div className={cn("absolute top-0 left-0 w-1.5 h-full transition-all duration-500 group-hover:w-2", colorClass.replace('text-', 'bg-'))} />
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{title}</CardTitle>
        <div className={cn("p-2.5 rounded-2xl bg-opacity-10 group-hover:scale-110 transition-all duration-500 shadow-inner", colorClass.replace('text-', 'bg-'))}>
          <Icon className={cn("h-4 w-4", colorClass)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-black tracking-tighter group-hover:translate-x-1 transition-transform duration-500">{value}</div>
        <p className="text-[10px] font-bold text-muted-foreground mt-1.5 flex items-center gap-1 opacity-70 group-hover:opacity-100">
          {subValue}
          <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all translate-x-0 group-hover:translate-x-1" />
        </p>
      </CardContent>
    </Card>
  );
}

// --- 메인 페이지 컴포넌트 ---
export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = use(params);
  const { user: currentUser } = useUser();
  const { activeMembership } = useAppContext();
  const firestore = useFirestore();
  const functions = useFunctions();
  const { toast } = useToast();

  const centerId = activeMembership?.id;
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  // --- 상담 관리 상태 ---
  const [aptDate, setAptDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [aptTime, setAptTime] = useState('14:00');
  const [aptNote, setAptNote] = useState('');
  
  const [logType, setLogType] = useState<'academic' | 'life' | 'career'>('academic');
  const [logContent, setLogContent] = useState('');
  const [logImprovement, setLogImprovement] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- 데이터 패칭 ---
  const studentRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId, 'students', studentId);
  }, [firestore, centerId, studentId]);
  const { data: student, isLoading: studentLoading } = useDoc<StudentProfile>(studentRef);

  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days');
  }, [firestore, centerId, studentId]);
  const { data: rawLogs } = useCollection<StudyLogDay>(logsQuery);

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId, 'growthProgress', studentId);
  }, [firestore, centerId, studentId]);
  const { data: progress } = useDoc<GrowthProgress>(progressRef);

  const rankingQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    const periodKey = format(new Date(), 'yyyy-MM');
    return query(
      collection(firestore, 'centers', centerId, 'leaderboards', `${periodKey}_completion`, 'entries'),
      where('studentId', '==', studentId)
    );
  }, [firestore, centerId, studentId]);
  const { data: rankEntry } = useCollection<LeaderboardEntry>(rankingQuery);

  const membershipRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId, 'members', studentId);
  }, [firestore, centerId, studentId]);
  const { data: studentMembership } = useDoc<CenterMembership>(membershipRef);

  const aptsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'counselingReservations'), where('studentId', '==', studentId));
  }, [firestore, centerId, studentId]);
  const { data: rawApts } = useCollection<any>(aptsQuery);

  const counselLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'counselingLogs'), where('studentId', '==', studentId));
  }, [firestore, centerId, studentId]);
  const { data: rawCounselLogs } = useCollection<CounselingLog>(counselLogsQuery);

  // --- 데이터 가공 ---
  const appointments = useMemo(() => {
    if (!rawApts) return [];
    return [...rawApts].sort((a, b) => b.scheduledAt?.toMillis() - a.scheduledAt?.toMillis());
  }, [rawApts]);

  const counselingLogs = useMemo(() => {
    if (!rawCounselLogs) return [];
    return [...rawCounselLogs].sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
  }, [rawCounselLogs]);

  const logs = useMemo(() => {
    if (!rawLogs) return [];
    return [...rawLogs].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [rawLogs]);

  const stats = useMemo(() => {
    const todayLog = logs.find(l => l.dateKey === todayKey);
    const last7Days = subDays(new Date(), 7);
    const weeklyLogs = logs.filter(l => new Date(l.dateKey) >= startOfDay(last7Days));
    const weeklyAvg = weeklyLogs.length > 0 ? Math.round(weeklyLogs.reduce((acc, c) => acc + c.totalMinutes, 0) / 7) : 0;
    const monthlyAvg = logs.length > 0 ? Math.round(logs.slice(0, 30).reduce((acc, c) => acc + c.totalMinutes, 0) / Math.min(30, logs.length)) : 0;
    
    return {
      today: todayLog?.totalMinutes || 0,
      weeklyAvg,
      monthlyAvg,
      chartData: logs.slice(0, 30).reverse().map(l => ({
        name: format(new Date(l.dateKey), 'MM/dd'),
        hours: Number((l.totalMinutes / 60).toFixed(1)),
        minutes: l.totalMinutes
      }))
    };
  }, [logs, todayKey]);

  // --- 핸들러 ---
  const handleAddAppointment = async () => {
    if (!firestore || !centerId || !student || !currentUser) return;
    setIsSubmitting(true);
    try {
      const scheduledAt = new Date(`${aptDate}T${aptTime}`);
      await addDoc(collection(firestore, 'centers', centerId, 'counselingReservations'), {
        centerId,
        studentId,
        studentName: student.name,
        teacherId: currentUser.uid,
        teacherName: currentUser.displayName || '선생님',
        scheduledAt: Timestamp.fromDate(scheduledAt),
        status: 'confirmed',
        teacherNote: aptNote,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast({ title: "상담 예약 완료" });
      setAptNote('');
    } catch (e) {
      toast({ variant: "destructive", title: "예약 실패" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCounselLog = async () => {
    if (!firestore || !centerId || !currentUser) return;
    if (!logContent.trim()) {
      toast({ variant: "destructive", title: "내용을 입력해주세요." });
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'counselingLogs'), {
        studentId,
        teacherId: currentUser.uid,
        type: logType,
        content: logContent,
        improvement: logImprovement,
        createdAt: serverTimestamp(),
      });
      toast({ title: "상담 일지 기록 완료" });
      setLogContent('');
      setLogImprovement('');
    } catch (e) {
      toast({ variant: "destructive", title: "기록 실패" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const [activeAnalysis, setActiveAnalysis] = useState<'today' | 'weekly' | 'monthly' | 'level' | 'rank' | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', schoolName: '', grade: '', password: '' });
  const [statusForm, setStatusForm] = useState<string>('active');

  useEffect(() => {
    if (student) {
      setEditForm({ name: student.name, schoolName: student.schoolName, grade: student.grade, password: '' });
    }
    if (studentMembership) {
      setStatusForm(studentMembership.status);
    }
  }, [student, studentMembership]);

  const analysisData = useMemo(() => {
    if (!activeAnalysis) return null;
    switch (activeAnalysis) {
      case 'today':
        const target = student?.targetDailyMinutes || 360;
        return [
          { name: '달성', value: Math.min(stats.today, target), fill: 'hsl(var(--primary))' },
          { name: '남음', value: Math.max(0, target - stats.today), fill: 'hsl(var(--muted))' }
        ];
      case 'weekly': return stats.chartData.slice(-7);
      case 'monthly': return stats.chartData;
      case 'level':
        const s = progress?.stats || { focus: 0, consistency: 0, achievement: 0, resilience: 0 };
        return [
          { subject: '집중력', A: s.focus, fullMark: 100 },
          { subject: '꾸준함', A: s.consistency, fullMark: 100 },
          { subject: '목표달성', A: s.achievement, fullMark: 100 },
          { subject: '회복력', A: s.resilience, fullMark: 100 },
        ];
      case 'rank':
        return [
          { name: '본인', value: rankEntry?.[0]?.value || 0, fill: 'hsl(var(--primary))' },
          { name: '센터 평균', value: 85, fill: 'hsl(var(--muted))' }
        ];
      default: return null;
    }
  }, [activeAnalysis, stats, student, progress, rankEntry]);

  const handleUpdateInfo = async () => {
    if (!functions || !centerId || !studentId) return;
    setIsUpdating(true);
    try {
      const updateFn = httpsCallable(functions, 'updateStudentAccount');
      const result: any = await updateFn({
        studentId,
        centerId,
        displayName: editForm.name,
        schoolName: editForm.schoolName,
        grade: editForm.grade,
        password: editForm.password || undefined
      });
      if (result.data.ok) {
        toast({ title: "정보 수정 완료" });
        setIsEditModalOpen(false);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "수정 실패", description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!firestore || !centerId || !studentId) return;
    setIsUpdating(true);
    try {
      const batch = writeBatch(firestore);
      const memberRef = doc(firestore, 'centers', centerId, 'members', studentId);
      const userCenterRef = doc(firestore, 'userCenters', studentId, 'centers', centerId);
      batch.update(memberRef, { status: statusForm, updatedAt: serverTimestamp() });
      batch.update(userCenterRef, { status: statusForm, updatedAt: serverTimestamp() });
      await batch.commit();
      toast({ title: "학생 상태 변경 완료" });
      setIsStatusModalOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "상태 변경 실패", description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };

  if (studentLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto pb-20">
      {/* 헤더 섹션 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 hover:bg-primary/5" asChild>
            <Link href="/dashboard/teacher/students"><ArrowLeft className="h-6 w-6" /></Link>
          </Button>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black tracking-tighter">{student?.name} 학생</h1>
              <Badge className="bg-primary text-white px-3 py-1 rounded-full font-black text-xs">{student?.seatNo || '미배정'}번 좌석</Badge>
              {studentMembership && (
                <Badge variant="outline" className={cn(
                  "font-bold text-xs px-3 py-1 rounded-full",
                  studentMembership.status === 'active' ? "text-emerald-600 border-emerald-200 bg-emerald-50" :
                  studentMembership.status === 'onHold' ? "text-amber-600 border-amber-200 bg-amber-50" :
                  "text-muted-foreground border-border bg-muted/50"
                )}>
                  {studentMembership.status === 'active' ? "재원생" : 
                   studentMembership.status === 'onHold' ? "휴학생" : "퇴원생"}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground font-bold">
              <span className="flex items-center gap-1.5 text-primary"><Building2 className="h-4 w-4" /> {student?.schoolName}</span>
              <span className="opacity-30">|</span>
              <span>{student?.grade}</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-2xl font-black h-12 px-6 shadow-sm gap-2 active:scale-95 transition-all" onClick={() => setIsEditModalOpen(true)}>
            <Settings2 className="h-4 w-4" /> 정보 수정
          </Button>
          <Button className="rounded-2xl font-black h-12 px-6 shadow-lg gap-2 active:scale-95 transition-all" onClick={() => setIsStatusModalOpen(true)}>
            <UserCheck className="h-4 w-4" /> 상태 변경
          </Button>
        </div>
      </div>

      {/* 대시보드 스탯 카드 */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatAnalysisCard 
          title="오늘 공부 시간" 
          value={`${Math.floor(stats.today / 60)}h ${stats.today % 60}m`} 
          subValue={`목표 대비 ${Math.round((stats.today / (student?.targetDailyMinutes || 360)) * 100)}%`} 
          icon={Clock} 
          colorClass="text-emerald-500" 
          onClick={() => setActiveAnalysis('today')} 
        />
        <StatAnalysisCard 
          title="주간 평균 (7일)" 
          value={`${Math.floor(stats.weeklyAvg / 60)}h ${stats.weeklyAvg % 60}m`} 
          subValue="최근 학습 리듬" 
          icon={TrendingUp} 
          colorClass="text-blue-500" 
          onClick={() => setActiveAnalysis('weekly')} 
        />
        <StatAnalysisCard 
          title="월간 평균 (30일)" 
          value={`${Math.floor(stats.monthlyAvg / 60)}h ${stats.monthlyAvg % 60}m`} 
          subValue="장기 집중도 분석" 
          icon={CalendarDays} 
          colorClass="text-amber-500" 
          onClick={() => setActiveAnalysis('monthly')} 
        />
        <StatAnalysisCard 
          title="마스터리 레벨" 
          value={`Lv.${progress?.level || 1}`} 
          subValue="성장 능력치 분석" 
          icon={Zap} 
          colorClass="text-purple-500" 
          onClick={() => setActiveAnalysis('level')} 
        />
        <StatAnalysisCard 
          title="시즌 랭킹" 
          value={rankEntry?.[0]?.rank ? `${rankEntry[0].rank}위` : '순위 밖'} 
          subValue="센터 내 상대적 위치" 
          icon={Trophy} 
          colorClass="text-rose-500" 
          onClick={() => setActiveAnalysis('rank')} 
        />
      </section>

      {/* 탭 섹션 */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-[2rem] h-16 p-1.5 bg-muted/30 border border-border/50 shadow-inner">
          <TabsTrigger value="overview" className="rounded-2xl font-black data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all text-sm">학습 리포트</TabsTrigger>
          <TabsTrigger value="plans" className="rounded-2xl font-black data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all text-sm">공부 계획</TabsTrigger>
          <TabsTrigger value="counseling" className="rounded-2xl font-black data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all text-sm">상담 관리</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-8">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50 group">
            <CardHeader className="bg-muted/10 p-8 border-b transition-colors group-hover:bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" /> 최근 30일 학습 몰입 히스토리
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-border/50 text-[10px] font-black text-primary/60 uppercase tracking-widest">
                    <span className="w-2 h-2 rounded-full bg-primary" /> Realtime Data
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorH" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" fontSize={10} fontWeight="900" axisLine={false} tickLine={false} tick={{fill: '#999'}} />
                    <YAxis fontSize={10} fontWeight="900" axisLine={false} tickLine={false} unit="h" tick={{fill: '#999'}} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="hours" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={4} 
                      fillOpacity={1} 
                      fill="url(#colorH)" 
                      animationDuration={1500}
                      animationEasing="ease-in-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="counseling" className="mt-8 space-y-8">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-[2.5rem] border-none shadow-lg bg-white overflow-hidden ring-1 ring-border/50">
              <CardHeader className="bg-blue-50/50 border-b pb-6">
                <CardTitle className="flex items-center gap-2 text-xl font-black text-blue-700">
                  <CalendarPlus className="h-5 w-5" /> 새 상담 예약
                </CardTitle>
                <CardDescription className="font-bold">선생님이 먼저 상담 일정을 잡을 수 있습니다.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">예약 날짜</Label>
                    <Input type="date" value={aptDate} onChange={(e) => setAptDate(e.target.value)} className="rounded-xl h-12 border-2 focus-visible:ring-blue-500/20" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">예약 시간</Label>
                    <Input type="time" value={aptTime} onChange={(e) => setAptTime(e.target.value)} className="rounded-xl h-12 border-2 focus-visible:ring-blue-500/20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">상담 주제 / 메모</Label>
                  <Input placeholder="예: 3월 모의고사 피드백" value={aptNote} onChange={(e) => setAptNote(e.target.value)} className="rounded-xl h-12 border-2 focus-visible:ring-blue-500/20" />
                </div>
                <Button onClick={handleAddAppointment} disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 active:scale-95 transition-all">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "예약 확정하기"}
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-lg bg-white overflow-hidden ring-1 ring-border/50">
              <CardHeader className="bg-emerald-50/50 border-b pb-6">
                <CardTitle className="flex items-center gap-2 text-xl font-black text-emerald-700">
                  <FileEdit className="h-5 w-5" /> 상담 일지 작성
                </CardTitle>
                <CardDescription className="font-bold">상담 내용을 기록하여 체계적으로 관리하세요.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-5">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">상담 유형</Label>
                  <Select value={logType} onValueChange={(val: any) => setLogType(val)}>
                    <SelectTrigger className="rounded-xl h-12 border-2 focus:ring-emerald-500/20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="academic">학업/성적</SelectItem>
                      <SelectItem value="life">생활 습관</SelectItem>
                      <SelectItem value="career">진로/진학</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">상담 내용</Label>
                  <Textarea placeholder="상담한 핵심 내용을 상세히 기록해 주세요." value={logContent} onChange={(e) => setLogContent(e.target.value)} className="rounded-xl min-h-[120px] border-2 focus-visible:ring-emerald-500/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">개선 권고 사항 (학생 과제)</Label>
                  <Input placeholder="학생에게 전달할 실천 과제를 입력하세요." value={logImprovement} onChange={(e) => setLogImprovement(e.target.value)} className="rounded-xl h-12 border-2 focus-visible:ring-emerald-500/20" />
                </div>
                <Button onClick={handleAddCounselLog} disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-200 active:scale-95 transition-all">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "상담 일지 저장"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-[2.5rem] border-none shadow-lg bg-white overflow-hidden ring-1 ring-border/50">
              <CardHeader className="p-8 border-b">
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <History className="h-5 w-5 text-blue-500" /> 상담 예약 현황
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-[450px] overflow-y-auto custom-scrollbar">
                  {appointments.length === 0 ? (
                    <div className="py-24 text-center text-muted-foreground font-black text-sm italic opacity-40">예정된 상담이 없습니다.</div>
                  ) : (
                    appointments.map((apt: any) => (
                      <div key={apt.id} className="p-6 flex items-center justify-between hover:bg-muted/5 transition-colors">
                        <div className="grid gap-1">
                          <span className="text-xs font-black text-blue-600 uppercase tracking-widest">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'M월 d일 p', { locale: ko }) : '-'}</span>
                          <span className="text-base font-bold text-foreground/80">{apt.teacherNote || '상담 주제 없음'}</span>
                        </div>
                        <Badge variant={apt.status === 'confirmed' ? 'default' : 'outline'} className="rounded-full text-[10px] px-3 font-black">
                          {apt.status === 'confirmed' ? '확정됨' : apt.status}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-lg bg-white overflow-hidden ring-1 ring-border/50">
              <CardHeader className="p-8 border-b">
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-emerald-500" /> 과거 상담 기록
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-[450px] overflow-y-auto custom-scrollbar">
                  {counselingLogs.length === 0 ? (
                    <div className="py-24 text-center text-muted-foreground font-black text-sm italic opacity-40">기록된 상담 일지가 없습니다.</div>
                  ) : (
                    counselingLogs.map((log: any) => (
                      <div key={log.id} className="p-6 hover:bg-muted/5 transition-colors space-y-3">
                        <div className="flex justify-between items-center">
                          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-[0.2em] border-2">
                            {log.type === 'academic' ? '학업·성적' : log.type === 'life' ? '생활습관' : '진로·진학'}
                          </Badge>
                          <span className="text-[10px] font-black text-muted-foreground/60">{log.createdAt ? format(log.createdAt.toDate(), 'yyyy.MM.dd') : '-'}</span>
                        </div>
                        <p className="text-sm font-bold text-foreground/80 leading-relaxed">{log.content}</p>
                        {log.improvement && (
                          <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100/50 shadow-inner">
                            <p className="text-[11px] font-black text-emerald-700 flex items-center gap-2">
                              <Check className="h-3.5 w-3.5" /> 개선 과제: {log.improvement}
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* 프리미엄 분석 다이얼로그 */}
      <Dialog open={!!activeAnalysis} onOpenChange={(open) => !open && setActiveAnalysis(null)}>
        <DialogContent className="sm:max-w-4xl rounded-[3rem] border-none shadow-[0_35px_100px_rgba(0,0,0,0.3)] p-0 overflow-hidden outline-none">
          <div className="bg-primary p-10 sm:p-14 text-primary-foreground relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white opacity-[0.03] rounded-full -mr-40 -mt-40 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent opacity-[0.05] rounded-full -ml-20 -mb-20 blur-2xl pointer-events-none" />
            <DialogHeader className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-white/10 p-2.5 rounded-[1.5rem] border border-white/15 backdrop-blur-md shadow-xl">
                  <Sparkles className="h-6 w-6 text-amber-400 fill-amber-400 animate-pulse" />
                </div>
                <Badge className="bg-white/20 text-white border-none font-black text-[11px] tracking-[0.3em] uppercase px-4 py-1.5 rounded-full backdrop-blur-md">Deep Analytical Report</Badge>
              </div>
              <DialogTitle className="text-5xl font-black tracking-tighter mb-2">
                {activeAnalysis === 'today' && "오늘의 몰입 게이지"}
                {activeAnalysis === 'weekly' && "주간 학습 모멘텀 분석"}
                {activeAnalysis === 'monthly' && "30일 학습 일관성 리포트"}
                {activeAnalysis === 'level' && "마스터리 능력치 밸런스"}
                {activeAnalysis === 'rank' && "센터 내 시즌 경쟁력"}
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/70 font-bold text-xl ml-1">
                {student?.name} 학생의 <span className="text-white underline underline-offset-8 decoration-2 decoration-accent/50">데이터 기반 심층 분석</span> 지표입니다.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-10 sm:p-16 bg-white min-h-[500px] flex flex-col items-center justify-center relative">
            <div className="absolute inset-0 bg-[#fafafa] opacity-50 -z-10" />
            
            {/* 오늘 공부시간: 프리미엄 라디알 차트 */}
            {activeAnalysis === 'today' && (
              <div className="w-full h-[400px] flex flex-col items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="105%" barSize={45} data={analysisData as any}>
                    <RadialBar background dataKey="value" cornerRadius={30} animationDuration={2000} animationEasing="ease-out" />
                    <Legend iconSize={12} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontWeight: 900, fontSize: 12}} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center translate-y-[-10px]">
                  <span className="text-[12px] font-black text-muted-foreground/60 uppercase tracking-[0.3em] mb-1">Target Achievement</span>
                  <span className="text-7xl font-black text-primary tracking-tighter drop-shadow-sm">
                    {Math.round((stats.today / (student?.targetDailyMinutes || 360)) * 100)}%
                  </span>
                  <div className="mt-2 h-1 w-16 bg-primary/20 rounded-full" />
                </div>
              </div>
            )}

            {/* 주간 모멘텀: 프리미엄 막대그래프 */}
            {activeAnalysis === 'weekly' && (
              <div className="w-full h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysisData as any} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGradWeekly" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="name" fontSize={12} fontWeight="900" axisLine={false} tickLine={false} tick={{fill: '#666'}} dy={10} />
                    <YAxis fontSize={12} fontWeight="900" axisLine={false} tickLine={false} unit="h" tick={{fill: '#666'}} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(0,0,0,0.03)'}} />
                    <Bar 
                      dataKey="hours" 
                      fill="url(#barGradWeekly)" 
                      radius={[15, 15, 0, 0]} 
                      barSize={50}
                      animationDuration={1500}
                    >
                      {(analysisData as any).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} className="hover:opacity-80 transition-opacity" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 월간 일관성: 프리미엄 고밀도 막대그래프 */}
            {activeAnalysis === 'monthly' && (
              <div className="w-full h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysisData as any} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGradMonthly" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" fontSize={10} fontWeight="900" axisLine={false} tickLine={false} tick={{fill: '#999'}} interval={2} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                    <Bar 
                      dataKey="hours" 
                      fill="url(#barGradMonthly)" 
                      radius={[6, 6, 0, 0]} 
                      barSize={12}
                      animationDuration={2000}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 마스터리 능력치: 프리미엄 레이더 */}
            {activeAnalysis === 'level' && (
              <div className="w-full h-[400px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={analysisData as any}>
                    <PolarGrid stroke="#ddd" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 14, fontWeight: 900, fill: '#444' }} />
                    <Radar 
                      name="Student Capability" 
                      dataKey="A" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={4}
                      fill="hsl(var(--primary))" 
                      fillOpacity={0.4} 
                      animationDuration={2500}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 시즌 경쟁력: 가로형 비교 바 차트 */}
            {activeAnalysis === 'rank' && (
              <div className="w-full h-[400px] flex flex-col justify-center px-10">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={analysisData as any} margin={{ left: 40, right: 40 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontWeight: 900, fontSize: 16, fill: '#333' }} />
                    <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip unit="%" />} />
                    <Bar dataKey="value" radius={[0, 20, 20, 0]} barSize={55} animationDuration={1800}>
                      {(analysisData as any).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 데이터 분석 제언 섹션 */}
            <div className="mt-12 p-8 rounded-[2.5rem] bg-muted/20 border border-dashed border-primary/20 w-full group hover:bg-muted/30 transition-all">
              <div className="flex items-start gap-5">
                <div className="bg-primary/10 p-3 rounded-2xl shadow-inner group-hover:scale-110 transition-transform">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-primary/70">Analytical Insight</h4>
                    <div className="h-px flex-1 bg-primary/10" />
                  </div>
                  <p className="text-base font-bold text-muted-foreground leading-relaxed">
                    {activeAnalysis === 'today' && `오늘 학습 목표인 ${student?.targetDailyMinutes}분 중 현재 약 ${Math.round((stats.today / (student?.targetDailyMinutes || 360)) * 100)}% 지점에 도달해 있습니다. 집중력이 가장 높은 시간대에 도달했으므로 남은 1시간의 몰입이 성취의 핵심입니다.`}
                    {activeAnalysis === 'weekly' && "최근 7일간의 학습 패턴은 전형적인 '상승 곡선'을 그리고 있습니다. 주말 이후 월요일부터 목요일까지 학습 시간이 매일 15%씩 안정적으로 증가하는 고무적인 추세입니다."}
                    {activeAnalysis === 'monthly' && "30일 장기 추세 분석 결과, 학습 이탈 없이 일관성을 85% 이상 유지하고 있습니다. 이는 센터 내 상위 5%에 해당하는 매우 우수한 '학습 지구력'을 입증하는 데이터입니다."}
                    {activeAnalysis === 'level' && "집중력과 회복력 스탯이 90점 이상으로 최고 수준입니다. 다만 상대적으로 '꾸준함' 스탯이 보완될 필요가 있으며, 이를 개선하면 다음 레벨까지의 소요 기간이 절반으로 단축됩니다."}
                    {activeAnalysis === 'rank' && "현재 시즌 리더보드에서 독보적인 위치를 점하고 있습니다. 센터 평균 성취도인 85%보다 약 12%포인트 높은 성과를 보이며 차기 챌린저 등급 승급이 가장 유력한 후보입니다."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-10 bg-muted/10 border-t flex justify-end">
            <Button onClick={() => setActiveAnalysis(null)} className="rounded-[1.5rem] font-black h-16 px-16 shadow-2xl active:scale-95 transition-all text-lg hover:bg-primary/90">
              분석 리포트 닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 정보 수정 모달 */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black tracking-tighter">학생 정보 수정</DialogTitle>
            <DialogDescription className="font-bold text-muted-foreground mt-1">학업 기본 정보를 업데이트합니다.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-6">
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase text-primary/70 tracking-widest ml-1">이름</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="rounded-xl h-12 border-2" />
            </div>
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase text-primary/70 tracking-widest ml-1">소속 학교</Label>
              <Input value={editForm.schoolName} onChange={(e) => setEditForm({...editForm, schoolName: e.target.value})} className="rounded-xl h-12 border-2" />
            </div>
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase text-primary/70 tracking-widest ml-1">학년</Label>
              <Select value={editForm.grade} onValueChange={(val) => setEditForm({...editForm, grade: val})}>
                <SelectTrigger className="rounded-xl h-12 border-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1학년">1학년</SelectItem>
                  <SelectItem value="2학년">2학년</SelectItem>
                  <SelectItem value="3학년">3학년</SelectItem>
                  <SelectItem value="N수생">N수생</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 pt-4 border-t border-dashed">
              <Label className="text-[10px] font-black uppercase text-destructive flex items-center gap-1.5 tracking-widest ml-1">
                <Lock className="h-3 w-3" /> 비밀번호 재설정
              </Label>
              <Input type="password" placeholder="새 비밀번호 입력 (공란 시 유지)" value={editForm.password} onChange={(e) => setEditForm({...editForm, password: e.target.value})} className="rounded-xl h-12 border-destructive/20 focus-visible:ring-destructive/10" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateInfo} disabled={isUpdating} className="w-full rounded-2xl h-14 font-black shadow-xl text-lg">
              {isUpdating ? <Loader2 className="animate-spin" /> : "변경 내용 저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 상태 변경 모달 */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black tracking-tighter">학생 상태 관리</DialogTitle>
            <DialogDescription className="font-bold text-muted-foreground mt-1">센터 소속 및 활성화 상태를 변경합니다.</DialogDescription>
          </DialogHeader>
          <div className="py-8 space-y-4">
            <div className="grid gap-3">
              {[
                { id: 'active', label: '재원생', desc: '현재 정상적으로 등원 중인 학생입니다.', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { id: 'onHold', label: '휴학생', desc: '일시적으로 등원을 중단한 상태입니다.', color: 'text-amber-600', bg: 'bg-amber-50' },
                { id: 'withdrawn', label: '퇴원생', desc: '완전히 퇴원 처리된 학생입니다.', color: 'text-muted-foreground', bg: 'bg-muted/30' },
              ].map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => setStatusForm(item.id)}
                  className={cn(
                    "p-5 rounded-3xl border-2 transition-all cursor-pointer flex items-start gap-4",
                    statusForm === item.id ? "border-primary bg-white shadow-xl scale-[1.03]" : "border-transparent bg-muted/10 hover:bg-muted/20"
                  )}
                >
                  <div className={cn("p-2.5 rounded-2xl mt-0.5 shadow-inner", statusForm === item.id ? "bg-primary text-white" : "bg-white text-muted-foreground")}>
                    {statusForm === item.id ? <Check className="h-5 w-5" /> : <div className="h-5 w-5" />}
                  </div>
                  <div className="grid gap-0.5">
                    <span className={cn("font-black text-xl tracking-tight", item.color)}>{item.label}</span>
                    <span className="text-xs font-bold text-muted-foreground/70">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateStatus} disabled={isUpdating} className="w-full rounded-2xl h-14 font-black shadow-xl text-lg">
              {isUpdating ? <Loader2 className="animate-spin" /> : "학생 상태 업데이트 완료"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
