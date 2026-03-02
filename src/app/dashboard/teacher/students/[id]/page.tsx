'use client';

import { use, useState, useMemo, useEffect, useRef } from 'react';
import { useDoc, useCollection, useFirestore, useFunctions, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc, collection, query, where, writeBatch, serverTimestamp, addDoc, Timestamp, updateDoc, orderBy } from 'firebase/firestore';
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
  DialogTrigger,
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
  Activity,
  CalendarPlus,
  FileEdit,
  MessageSquare,
  BarChart3,
  Sparkles,
  History,
  CheckCircle2,
  AlertCircle,
  ClipboardCheck,
  Target,
  ShieldCheck,
  User,
  PieChart as PieChartIcon,
  Crown,
  Medal,
  Star,
  RefreshCw,
  Check,
  X,
  ListTodo,
  Timer,
  CalendarCheck,
  Coffee,
  School
} from 'lucide-react';
import Link from 'next/link';
import { StudentProfile, StudyLogDay, GrowthProgress, LeaderboardEntry, CenterMembership, CounselingLog, CounselingReservation, StudyPlanItem, WithId } from '@/lib/types';
import { format, subDays, startOfDay, startOfWeek, addDays, isSameDay } from 'date-fns';
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
  PieChart,
  Pie
} from 'recharts';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

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
      </div>
    );
  }
  return null;
};

function StatAnalysisCard({ title, value, subValue, icon: Icon, colorClass, isMobile, onClick, href }: any) {
  const content = (
    <Card className={cn(
      "border-none shadow-md overflow-hidden relative bg-white rounded-[1.5rem] sm:rounded-[2rem] transition-all",
      (onClick || href) && "hover:shadow-xl active:scale-95 cursor-pointer hover:bg-muted/5"
    )}>
      <div className={cn("absolute top-0 left-0 w-1 h-full", colorClass.replace('text-', 'bg-'))} />
      <CardHeader className={cn("pb-1 flex flex-row items-center justify-between", isMobile ? "px-3 pt-3" : "px-6 pt-6")}>
        <CardTitle className={cn("font-black text-muted-foreground uppercase", isMobile ? "text-[8px]" : "text-[10px]")}>{title}</CardTitle>
        <div className={cn("rounded-lg bg-opacity-10", isMobile ? "p-1.5" : "p-2", colorClass.replace('text-', 'bg-'))}>
          <Icon className={cn(isMobile ? "h-3.5 w-3.5" : "h-4 w-4", colorClass)} />
        </div>
      </CardHeader>
      <CardContent className={cn(isMobile ? "px-3 pb-3" : "px-6 pb-6")}>
        <div className={cn("font-black tracking-tighter", isMobile ? "text-lg leading-tight" : "text-2xl")}>{value}</div>
        <p className={cn("font-bold text-muted-foreground mt-0.5", isMobile ? "text-[8px]" : "text-[9px]")}>{subValue}</p>
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href}>{content}</Link>;
  if (onClick) return <div onClick={onClick}>{content}</div>;
  return content;
}

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = use(params);
  const { user: currentUser } = useUser();
  const { activeMembership, viewMode } = useAppContext();
  const firestore = useFirestore();
  const functions = useFunctions();
  const { toast } = useToast();

  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const hasInitializedForm = useRef(false);
  const [isMounted, setIsMounted] = useState(false);

  // 계획 탭을 위한 일자 선택 상태
  const [selectedDateForPlan, setSelectedDateForPlan] = useState<Date>(new Date());

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [aptDate, setAptDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [aptTime, setAptTime] = useState('14:00');
  const [aptNote, setAptNote] = useState('');
  
  const [logType, setLogType] = useState<'academic' | 'life' | 'career'>('academic');
  const [logContent, setLogContent] = useState('');
  const [logImprovement, setLogImprovement] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMasteryModalOpen, setIsMasteryModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedResForLog, setSelectedResForLog] = useState<CounselingReservation | null>(null);

  const studentRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId, 'students', studentId);
  }, [firestore, centerId, studentId]);
  const { data: student, isLoading: studentLoading } = useDoc<StudentProfile>(studentRef);

  const membershipRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId, 'members', studentId);
  }, [firestore, centerId, studentId]);
  const { data: studentMembership } = useDoc<CenterMembership>(membershipRef);

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
    return query(collection(firestore, 'centers', centerId, 'leaderboards', `${periodKey}_completion`, 'entries'), where('studentId', '==', studentId));
  }, [firestore, centerId, studentId]);
  const { data: rankEntry } = useCollection<LeaderboardEntry>(rankingQuery);

  const aptsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'counselingReservations'), where('studentId', '==', studentId));
  }, [firestore, centerId, studentId]);
  const { data: rawApts } = useCollection<CounselingReservation>(aptsQuery);

  const counselLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'counselingLogs'), where('studentId', '==', studentId));
  }, [firestore, centerId, studentId]);
  const { data: rawCounselLogs } = useCollection<CounselingLog>(counselLogsQuery);

  // 계획 데이터 조회 로직 (상세 분석용)
  const selectedDateKey = format(selectedDateForPlan, 'yyyy-MM-dd');
  const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
  const plansQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !weekKey) return null;
    return query(
      collection(firestore, 'centers', centerId, 'plans', studentId, 'weeks', weekKey, 'items'),
      where('dateKey', '==', selectedDateKey)
    );
  }, [firestore, centerId, studentId, weekKey, selectedDateKey]);
  const { data: dailyPlans, isLoading: plansLoading } = useCollection<StudyPlanItem>(plansQuery);

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDateForPlan, { weekStartsOn: 1 });
    return [...Array(7)].map((_, i) => addDays(start, i));
  }, [selectedDateForPlan]);

  const scheduleItems = useMemo(() => dailyPlans?.filter(p => p.category === 'schedule') || [], [dailyPlans]);
  const studyTasks = useMemo(() => dailyPlans?.filter(p => p.category === 'study' || !p.category) || [], [dailyPlans]);
  const personalTasks = useMemo(() => dailyPlans?.filter(p => p.category === 'personal') || [], [dailyPlans]);

  const appointments = useMemo(() => rawApts ? [...rawApts].sort((a, b) => (b.scheduledAt?.toMillis() || 0) - (a.scheduledAt?.toMillis() || 0)) : [], [rawApts]);
  const counselingLogs = useMemo(() => rawCounselLogs ? [...rawCounselLogs].sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)) : [], [rawCounselLogs]);
  const logs = useMemo(() => rawLogs ? [...rawLogs].sort((a, b) => b.dateKey.localeCompare(a.dateKey)) : [], [rawLogs]);

  const stats = useMemo(() => {
    const todayLog = logs.find(l => l.dateKey === todayKey);
    const last7Days = subDays(new Date(), 7);
    const weeklyLogs = logs.filter(l => new Date(l.dateKey) >= startOfDay(last7Days));
    const weeklyAvg = weeklyLogs.length > 0 ? Math.round(weeklyLogs.reduce((acc, c) => acc + c.totalMinutes, 0) / 7) : 0;
    const monthlyAvg = logs.length > 0 ? Math.round(logs.slice(0, 30).reduce((acc, c) => acc + c.totalMinutes, 0) / Math.min(30, logs.length)) : 0;
    const monthlyTotal = logs.slice(0, 30).reduce((acc, c) => acc + c.totalMinutes, 0);
    const targetMins = student?.targetDailyMinutes || 360;
    const todayMinutes = todayLog?.totalMinutes || 0;
    return {
      today: todayMinutes, todayTarget: targetMins, todayPercent: Math.min(100, Math.round((todayMinutes / targetMins) * 100)),
      weeklyAvg, monthlyAvg, monthlyTotal,
      chartData: logs.slice(0, 30).reverse().map(l => ({ name: format(new Date(l.dateKey), 'MM/dd'), hours: Number((l.totalMinutes / 60).toFixed(1)), minutes: l.totalMinutes })),
      weeklyChartData: logs.slice(0, 7).reverse().map(l => ({ name: format(new Date(l.dateKey), 'EEE'), hours: Number((l.totalMinutes / 60).toFixed(1)), minutes: l.totalMinutes }))
    };
  }, [logs, todayKey, student?.targetDailyMinutes]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', schoolName: '', grade: '', password: '', parentLinkCode: '' });
  const [statusForm, setStatusForm] = useState<string>('active');

  useEffect(() => {
    if (student && !hasInitializedForm.current) {
      setEditForm({ name: student.name, schoolName: student.schoolName, grade: student.grade, password: '', parentLinkCode: student.parentLinkCode || '' });
      hasInitializedForm.current = true;
    } else if (studentMembership && !hasInitializedForm.current) {
      setEditForm(f => ({ ...f, name: studentMembership.displayName || '' }));
    }
  }, [student, studentMembership]);

  useEffect(() => { if (studentMembership) setStatusForm(studentMembership.status); }, [studentMembership]);

  const handleAddAppointment = () => {
    if (!firestore || !centerId || !currentUser || !aptDate || !aptTime) return;
    setIsSubmitting(true);
    const scheduledDate = new Date(`${aptDate}T${aptTime}`);
    const data = {
      centerId, studentId, studentName: student?.name || studentMembership?.displayName || '학생',
      teacherId: currentUser.uid, teacherName: currentUser.displayName || '선생님',
      scheduledAt: Timestamp.fromDate(scheduledDate), status: 'confirmed',
      teacherNote: aptNote.trim(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    addDoc(collection(firestore, `centers/${centerId}/counselingReservations`), data).then(() => {
      toast({ title: "상담 예약 완료" }); setAptNote('');
    }).finally(() => setIsSubmitting(false));
  };

  const handleUpdateAptStatus = async (resId: string, status: CounselingReservation['status']) => {
    if (!firestore || !centerId) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'counselingReservations', resId), { status, updatedAt: serverTimestamp() });
      toast({ title: status === 'confirmed' ? "승인 완료" : "거절 완료" });
    } catch (e) { toast({ variant: "destructive", title: "실패" }); } finally { setIsSubmitting(false); }
  };

  const handleAddCounselLog = () => {
    if (!firestore || !centerId || !currentUser || !logContent.trim()) return;
    setIsSubmitting(true);
    const data = { studentId, teacherId: currentUser.uid, type: logType, content: logContent.trim(), improvement: logImprovement.trim(), createdAt: serverTimestamp(), reservationId: selectedResForLog?.id || null };
    const logPromise = addDoc(collection(firestore, `centers/${centerId}/counselingLogs`), data);
    const resPromise = selectedResForLog ? updateDoc(doc(firestore, 'centers', centerId, 'counselingReservations', selectedResForLog.id), { status: 'done', updatedAt: serverTimestamp() }) : Promise.resolve();
    Promise.all([logPromise, resPromise]).then(() => {
      toast({ title: "기록 완료" }); setLogContent(''); setLogImprovement(''); setIsLogModalOpen(false); setSelectedResForLog(null);
    }).finally(() => setIsSubmitting(false));
  };

  const handleUpdateInfo = async () => {
    if (!functions || !centerId || !studentId) return;
    setIsUpdating(true);
    try {
      const updateFn = httpsCallable(functions, 'updateStudentAccount');
      const result: any = await updateFn({ studentId, centerId, displayName: editForm.name, schoolName: editForm.schoolName, grade: editForm.grade, password: editForm.password.length >= 6 ? editForm.password : undefined, parentLinkCode: editForm.parentLinkCode.trim() || null });
      if (result.data?.ok) { toast({ title: "수정 완료" }); setIsEditModalOpen(false); }
    } catch (e) { toast({ variant: "destructive", title: "실패" }); } finally { setIsUpdating(false); }
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
      toast({ title: "상태가 업데이트되었습니다." });
      setIsStatusModalOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "업데이트 실패", description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };

  if (studentLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className={cn("flex flex-col gap-6 max-w-6xl mx-auto pb-20", isMobile ? "gap-4 px-1" : "gap-8")}>
      <div className={cn("flex justify-between gap-4", isMobile ? "flex-col items-start" : "flex-row items-end")}>
        <div className="flex items-start gap-3 sm:gap-4 w-full">
          <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 shrink-0 mt-1" asChild><Link href="/dashboard/teacher/students"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className={cn("font-black tracking-tighter truncate leading-tight", isMobile ? "text-2xl" : "text-4xl")}>{student?.name || studentMembership?.displayName}</h1>
              <Badge className="bg-primary text-white px-2 py-0.5 rounded-full font-black text-[10px]">{student?.seatNo || '미배정'}번 좌석</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold">
              <span className="flex items-center gap-1 text-primary"><Building2 className="h-3.5 w-3.5" /> {student?.schoolName}</span>
              <span className="opacity-30">|</span><span>{student?.grade}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" className="rounded-2xl font-black h-11 flex-1 sm:px-6 text-xs gap-2" onClick={() => setIsEditModalOpen(true)}><Settings2 className="h-4 w-4" /> 정보 수정</Button>
          <Button className="rounded-2xl font-black h-11 flex-1 sm:px-6 text-xs gap-2" onClick={() => setIsStatusModalOpen(true)}><UserCheck className="h-4 w-4" /> 상태 변경</Button>
        </div>
      </div>

      <section className={cn("grid gap-3 sm:gap-4", isMobile ? "grid-cols-2" : "lg:grid-cols-5")}>
        <StatAnalysisCard title="오늘 공부" value={`${Math.floor(stats.today / 60)}h ${stats.today % 60}m`} subValue="목표 달성 추적" icon={Clock} colorClass="text-emerald-500" isMobile={isMobile} />
        <StatAnalysisCard title="주간 평균" value={`${Math.floor(stats.weeklyAvg / 60)}h ${stats.weeklyAvg % 60}m`} subValue="최근 학습 리듬" icon={TrendingUp} colorClass="text-blue-500" isMobile={isMobile} />
        <StatAnalysisCard title="월간 평균" value={`${Math.floor(stats.monthlyAvg / 60)}h ${stats.monthlyAvg % 60}m`} subValue="장기 집중 분석" icon={CalendarDays} colorClass="text-amber-500" isMobile={isMobile} />
        <StatAnalysisCard title="마스터리" value={`Lv.${progress?.level || 1}`} subValue="성장 능력치" icon={Zap} colorClass="text-purple-500" isMobile={isMobile} onClick={() => setIsMasteryModalOpen(true)} />
        <StatAnalysisCard title="시즌 랭킹" value={rankEntry?.[0]?.rank ? `${rankEntry[0].rank}위` : '산정 중'} subValue="상대 위치" icon={Trophy} colorClass="text-rose-500" isMobile={isMobile} href="/dashboard/leaderboards" />
      </section>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-[1.5rem] p-1 bg-muted/30 border h-16">
          <TabsTrigger value="overview" className="rounded-xl font-black text-xs sm:text-sm">학습 리포트</TabsTrigger>
          <TabsTrigger value="plans" className="rounded-xl font-black text-xs sm:text-sm">공부 계획</TabsTrigger>
          <TabsTrigger value="counseling" className="rounded-xl font-black text-xs sm:text-sm">상담 관리</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="rounded-[2rem] border-none shadow-xl bg-white p-8 flex flex-col items-center justify-center">
              <div className="relative h-40 w-40"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'Done', value: stats.today }, { name: 'Rem', value: Math.max(0, stats.todayTarget - stats.today) }]} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" startAngle={90} endAngle={-270}><Cell fill="#10b981" /><Cell fill="#f1f5f9" /></Pie></PieChart></ResponsiveContainer><div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl font-black text-emerald-600">{stats.todayPercent}%</span></div></div>
              <p className="mt-4 font-black">{Math.floor(stats.today/60)}h {stats.today%60}m 완료</p>
            </Card>
            <Card className="rounded-[2rem] border-none shadow-xl bg-white p-6"><CardTitle className="text-sm font-black mb-4 uppercase tracking-widest text-blue-700">주간 학습 리듬</CardTitle><div className="h-40 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.weeklyChartData}><XAxis dataKey="name" fontSize={9} fontWeight="bold" axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={12} /></BarChart></ResponsiveContainer></div></Card>
            <Card className="rounded-[2rem] border-none shadow-xl bg-white p-8"><CardTitle className="text-sm font-black mb-4 uppercase tracking-widest text-amber-700">월간 총 몰입</CardTitle><h3 className="text-4xl font-black text-amber-600 tracking-tighter">{Math.floor(stats.monthlyTotal/60)}h</h3><Progress value={(stats.monthlyAvg / stats.todayTarget) * 100} className="h-1.5 bg-amber-100 mt-6" /></Card>
          </div>
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-10"><CardTitle className="text-xl font-black mb-6">최근 30일 학습 몰입 히스토리</CardTitle><div className="h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={stats.chartData}><defs><linearGradient id="colorH" x1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" /><XAxis dataKey="name" fontSize={10} fontWeight="900" /><YAxis fontSize={10} unit="h" /><Tooltip content={<CustomTooltip />} /><Area type="monotone" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorH)" /></AreaChart></ResponsiveContainer></div></Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-6 space-y-6">
          <div className="grid grid-cols-7 gap-2 mb-6">
            {weekDays.map((day) => {
              const isSelected = isSameDay(day, selectedDateForPlan);
              return (
                <Button key={day.toISOString()} variant={isSelected ? "default" : "outline"} className={cn("flex flex-col h-auto py-3 rounded-2xl", isSelected && "bg-primary shadow-lg scale-105")} onClick={() => setSelectedDateForPlan(day)}>
                  <span className={cn("text-[8px] font-black uppercase", isSelected ? "text-white/60" : "text-muted-foreground/40")}>{format(day, 'EEE', { locale: ko })}</span>
                  <span className={cn("text-lg font-black", isSelected ? "text-white" : "text-primary")}>{format(day, 'd')}</span>
                </Button>
              );
            })}
          </div>

          <div className="grid gap-6 md:grid-cols-12">
            <Card className="md:col-span-5 rounded-[2rem] border-none shadow-lg overflow-hidden">
              <CardHeader className="bg-muted/5 border-b p-6"><CardTitle className="text-lg font-black flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> 생활 루틴</CardTitle></CardHeader>
              <CardContent className="p-6 space-y-3 bg-[#fafafa]">
                {plansLoading ? <Loader2 className="animate-spin mx-auto opacity-20" /> : scheduleItems.length === 0 ? <p className="text-center text-xs opacity-30 italic py-10">등록된 루틴 없음</p> : scheduleItems.map(item => (
                  <div key={item.id} className="p-4 rounded-xl bg-white border flex justify-between items-center shadow-sm">
                    <span className="font-bold text-sm">{item.title.split(': ')[0]}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">{item.title.split(': ')[1] || '--:--'}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="md:col-span-7 rounded-[2rem] border-none shadow-lg overflow-hidden">
              <CardHeader className="bg-muted/5 border-b p-6"><CardTitle className="text-lg font-black flex items-center gap-2"><ListTodo className="h-5 w-5 text-emerald-500" /> 자습 To-do 및 일정</CardTitle></CardHeader>
              <CardContent className="p-6 space-y-6 bg-[#fafafa]">
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-emerald-600 tracking-widest ml-1">Study To-do</h4>
                  {studyTasks.map(task => (
                    <div key={task.id} className={cn("flex items-center gap-4 p-4 rounded-xl border-2 transition-all", task.done ? "bg-emerald-50/30 border-emerald-100/50" : "bg-white shadow-sm")}>
                      <div className={cn("h-5 w-5 rounded-md border-2 flex items-center justify-center", task.done ? "bg-emerald-500 text-white" : "border-muted")}>{task.done && <Check className="h-3 w-3" />}</div>
                      <span className={cn("flex-1 text-sm font-bold", task.done && "line-through opacity-40")}>{task.title}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-amber-600 tracking-widest ml-1">Personal Schedule</h4>
                  {personalTasks.map(task => (
                    <div key={task.id} className={cn("flex items-center gap-4 p-4 rounded-xl border-2", task.done ? "bg-amber-50/30" : "bg-white shadow-sm")}>
                      <div className={cn("h-5 w-5 rounded-md border-2", task.done ? "bg-amber-500 text-white" : "border-muted")}>{task.done && <Check className="h-3 w-3" />}</div>
                      <span className={cn("flex-1 text-sm font-bold", task.done && "line-through opacity-40")}>{task.title}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="counseling" className="mt-6 space-y-10">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-[2rem] p-8 space-y-5 shadow-lg"><CardTitle className="text-lg font-black text-blue-700 flex items-center gap-2"><CalendarPlus className="h-5 w-5" /> 상담 예약</CardTitle><div className="grid grid-cols-2 gap-4"><div><Label className="text-[10px] font-black uppercase">날짜</Label><Input type="date" value={aptDate} onChange={e => setAptDate(e.target.value)} className="rounded-xl border-2" /></div><div><Label className="text-[10px] font-black uppercase">시간</Label><Input type="time" value={aptTime} onChange={e => setAptTime(e.target.value)} className="rounded-xl border-2" /></div></div><Input placeholder="상담 주제" value={aptNote} onChange={e => setAptNote(e.target.value)} className="rounded-xl border-2" /><Button onClick={handleAddAppointment} className="w-full h-14 rounded-2xl font-black bg-blue-600 shadow-xl">예약 확정</Button></Card>
            <Card className="rounded-[2rem] p-8 space-y-5 shadow-lg"><CardTitle className="text-lg font-black text-emerald-700 flex items-center gap-2"><FileEdit className="h-5 w-5" /> 상담 일지</CardTitle><Select value={logType} onValueChange={(v:any) => setLogType(v)}><SelectTrigger className="rounded-xl h-12 border-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="academic">학업/성적</SelectItem><SelectItem value="life">생활 습관</SelectItem><SelectItem value="career">진로/진학</SelectItem></SelectContent></Select><Textarea placeholder="내용" value={logContent} onChange={e => setLogContent(e.target.value)} className="rounded-xl h-24 border-2" /><Input placeholder="개선 권고" value={logImprovement} onChange={e => setLogImprovement(e.target.value)} className="rounded-xl h-12 border-2" /><Button onClick={handleAddCounselLog} className="w-full h-14 rounded-2xl font-black bg-emerald-600 shadow-xl">저장</Button></Card>
          </div>
          <div className="space-y-4">
            <h2 className="text-2xl font-black tracking-tighter px-2">상담 히스토리</h2>
            <div className="grid gap-4">
              {appointments.map(apt => (
                <Card key={apt.id} className={cn("rounded-3xl border-2 p-6 flex justify-between items-center", apt.status === 'confirmed' ? "bg-blue-50/20" : "bg-muted/5 opacity-60")}>
                  <div className="flex gap-4 items-center"><div className="h-12 w-12 rounded-xl bg-white border flex flex-col items-center justify-center"><span className="text-[8px] font-black opacity-40">DAY</span><span className="text-lg font-black">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'd') : ''}</span></div><div><h4 className="font-black">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'p') : ''} 상담</h4><p className="text-xs text-muted-foreground">{apt.studentNote || '내용 없음'}</p></div></div>
                  {apt.status === 'requested' && <div className="flex gap-2"><Button size="sm" onClick={() => handleUpdateAptStatus(apt.id, 'confirmed')} className="bg-emerald-500 h-9 px-3">승인</Button><Button size="sm" variant="outline" onClick={() => handleUpdateAptStatus(apt.id, 'canceled')} className="text-rose-600 h-9 px-3">거절</Button></div>}
                  {apt.status === 'confirmed' && <Button size="sm" onClick={() => { setSelectedResForLog(apt); setIsLogModalOpen(true); }} className="bg-primary h-9 px-4">일지 작성</Button>}
                </Card>
              ))}
              {counselingLogs.map(log => (
                <Card key={log.id} className="rounded-3xl p-6 space-y-3 shadow-md bg-white">
                  <div className="flex justify-between items-center"><Badge variant="outline" className="rounded-lg">{log.type === 'academic' ? '학업' : log.type === 'life' ? '생활' : '진로'}</Badge><span className="text-[10px] opacity-40">{log.createdAt ? format(log.createdAt.toDate(), 'yyyy.MM.dd') : ''}</span></div>
                  <p className="text-sm font-bold">{log.content}</p>
                  {log.improvement && <div className="p-3 rounded-xl bg-emerald-50 text-xs font-bold text-emerald-900 leading-tight flex gap-2"><AlertCircle className="h-3 w-3" /> {log.improvement}</div>}
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md p-8">
          <DialogHeader><DialogTitle className="text-3xl font-black">정보 수정</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder="이름" className="rounded-xl border-2" />
            <Input value={editForm.schoolName} onChange={e => setEditForm({...editForm, schoolName: e.target.value})} placeholder="학교" className="rounded-xl border-2" />
            <Select value={editForm.grade} onValueChange={v => setEditForm({...editForm, grade: v})}>
              <SelectTrigger className="rounded-xl border-2"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1학년">1학년</SelectItem>
                <SelectItem value="2학년">2학년</SelectItem>
                <SelectItem value="3학년">3학년</SelectItem>
                <SelectItem value="N수생">N수생</SelectItem>
              </SelectContent>
            </Select>
            <Input value={editForm.parentLinkCode} onChange={e => setEditForm({...editForm, parentLinkCode: e.target.value})} placeholder="학부모 연동 코드" maxLength={4} className="rounded-xl border-2" />
            <Input type="password" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} placeholder="새 비밀번호 (선택)" className="rounded-xl border-2" />
          </div>
          <DialogFooter><Button onClick={handleUpdateInfo} disabled={isUpdating} className="w-full h-12 rounded-2xl font-black shadow-xl">저장</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md p-8">
          <DialogHeader><DialogTitle className="text-2xl font-black">상태 관리</DialogTitle></DialogHeader>
          <div className="py-4 space-y-2">
            {[{id:'active',l:'재원'},{id:'onHold',l:'휴학'},{id:'withdrawn',l:'퇴원'}].map(i=>(
              <div key={i.id} onClick={()=>setStatusForm(i.id)} className={cn("p-4 rounded-xl border-2 cursor-pointer", statusForm===i.id?"border-primary bg-primary/5":"border-transparent bg-muted/10")}>
                <span className="font-black">{i.l}</span>
              </div>
            ))}
          </div>
          <DialogFooter><Button onClick={handleUpdateStatus} disabled={isUpdating} className="w-full h-12 rounded-2xl font-black">업데이트</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
