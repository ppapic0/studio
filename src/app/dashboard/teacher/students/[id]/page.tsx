
'use client';

import { use, useState, useMemo, useEffect, useRef } from 'react';
import { useDoc, useCollection, useFirestore, useFunctions, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc, collection, query, where, writeBatch, serverTimestamp, addDoc, Timestamp, updateDoc, orderBy, getDocs, limit, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
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
  ChevronLeft,
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
  School,
  ArrowRightLeft,
  LayoutGrid,
  Save,
  Wand2
} from 'lucide-react';
import Link from 'next/link';
import { StudentProfile, StudyLogDay, GrowthProgress, LeaderboardEntry, CenterMembership, CounselingLog, CounselingReservation, StudyPlanItem, WithId, InviteCode, StudySession } from '@/lib/types';
import { format, subDays, addDays, startOfDay, startOfWeek, isSameDay } from 'date-fns';
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

const STAT_CONFIG = {
  focus: { 
    label: '집중력', 
    sub: 'FOCUS', 
    icon: Target, 
    color: 'text-blue-500', 
    bg: 'bg-blue-500', 
    accent: 'bg-blue-50',
    guide: '몰입 시간에 비례하여 상승'
  },
  consistency: { 
    label: '꾸준함', 
    sub: 'CONSISTENCY', 
    icon: RefreshCw, 
    color: 'text-emerald-500', 
    bg: 'bg-emerald-500', 
    accent: 'bg-emerald-50',
    guide: '매일 트랙 시작 시 상승'
  },
  achievement: { 
    label: '목표달성', 
    sub: 'ACHIEVEMENT', 
    icon: CheckCircle2, 
    color: 'text-amber-500', 
    bg: 'bg-amber-500', 
    accent: 'bg-amber-50',
    guide: 'To-do 완료 시 상승'
  },
  resilience: { 
    label: '회복력', 
    sub: 'RESILIENCE', 
    icon: ShieldCheck, 
    color: 'text-rose-500', 
    bg: 'bg-rose-500', 
    accent: 'bg-rose-50',
    guide: '장기 학습 달성 시 상승'
  },
};

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

function StatAnalysisCard({ title, value, subValue, icon: Icon, colorClass, isMobile, onClick, href, isActive }: any) {
  const content = (
    <Card className={cn(
      "border-none shadow-md overflow-hidden relative bg-white rounded-[1.5rem] sm:rounded-[2rem] transition-all",
      (onClick || href) && "hover:shadow-xl active:scale-[0.98] cursor-pointer hover:bg-muted/5",
      isActive && "ring-4 ring-primary ring-offset-4 scale-[1.02] shadow-2xl z-10"
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
  const periodKey = format(new Date(), 'yyyy-MM');
  const hasInitializedForm = useRef(false);
  const [isMounted, setIsMounted] = useState(false);

  const [activeTab, setActiveTab] = useState('overview');
  const [focusedChartView, setFocusedChartView] = useState<'today' | 'weekly' | 'monthly'>('monthly');
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

  // 성장 지표 수정 상태
  const [isEditStats, setIsEditStats] = useState(false);
  const [editLp, setEditLp] = useState(0);
  const [editStats, setEditStats] = useState({ focus: 0, consistency: 0, achievement: 0, resilience: 0 });

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

  const allMembersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'student'));
  }, [firestore, centerId]);
  const { data: allMembers } = useCollection<CenterMembership>(allMembersQuery);

  const invitesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'inviteCodes'), where('centerId', '==', centerId));
  }, [firestore, centerId]);
  const { data: inviteCodes } = useCollection<InviteCode>(invitesQuery);

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

  useEffect(() => {
    if (progress) {
      setEditLp(progress.seasonLp || 0);
      setEditStats({
        focus: progress.stats?.focus || 0,
        consistency: progress.stats?.consistency || 0,
        achievement: progress.stats?.achievement || 0,
        resilience: progress.stats?.resilience || 0,
      });
    }
  }, [progress]);

  const rankingQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'leaderboards', `${periodKey}_lp`, 'entries'), where('studentId', '==', studentId));
  }, [firestore, centerId, studentId, periodKey]);
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

  const appointments = useMemo(() => rawApts ? [...rawApts].sort((a, b) => (b.scheduledAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)) : [], [rawApts]);
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
  const [editForm, setEditForm] = useState({ name: '', schoolName: '', grade: '', password: '', parentLinkCode: '', className: '' });
  const [statusForm, setStatusForm] = useState<string>('active');

  useEffect(() => {
    if (student && !hasInitializedForm.current) {
      setEditForm({ 
        name: student.name, 
        schoolName: student.schoolName, 
        grade: student.grade, 
        password: '', 
        parentLinkCode: student.parentLinkCode || '',
        className: student.className || studentMembership?.className || ''
      });
      hasInitializedForm.current = true;
    } else if (studentMembership && !hasInitializedForm.current) {
      setEditForm(f => ({ ...f, name: studentMembership.displayName || '', className: studentMembership.className || '' }));
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
    if (!functions || !centerId || !studentId || !firestore) return;
    setIsUpdating(true);
    try {
      const updateFn = httpsCallable(functions, 'updateStudentAccount');
      await updateFn({ 
        studentId, 
        centerId, 
        displayName: editForm.name, 
        schoolName: editForm.schoolName, 
        grade: editForm.grade, 
        password: editForm.password.length >= 6 ? editForm.password : undefined, 
        parentLinkCode: editForm.parentLinkCode.trim() || null 
      });

      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'centers', centerId, 'members', studentId), { className: editForm.className, updatedAt: serverTimestamp() });
      batch.update(doc(firestore, 'centers', centerId, 'students', studentId), { className: editForm.className, updatedAt: serverTimestamp() });
      batch.update(doc(firestore, 'userCenters', studentId, 'centers', centerId), { className: editForm.className, updatedAt: serverTimestamp() });
      
      await batch.commit();
      
      toast({ title: "정보 수정 완료" });
      setIsEditModalOpen(false);
    } catch (e) { toast({ variant: "destructive", title: "수정 실패" }); } finally { setIsUpdating(false); }
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

  const handleUpdateGrowthData = async () => {
    if (!firestore || !centerId || !studentId) return;
    setIsUpdating(true);
    try {
      const batch = writeBatch(firestore);
      const progRef = doc(firestore, 'centers', centerId, 'growthProgress', studentId);
      const rankRef = doc(firestore, 'centers', centerId, 'leaderboards', `${periodKey}_lp`, 'entries', studentId);

      // 1. 성장 데이터 업데이트
      batch.update(progRef, {
        seasonLp: editLp,
        stats: editStats,
        updatedAt: serverTimestamp()
      });

      // 2. 랭킹 데이터 동기화
      batch.set(rankRef, {
        studentId,
        displayNameSnapshot: student?.name || studentMembership?.displayName || '학생',
        classNameSnapshot: student?.className || studentMembership?.className || null,
        value: editLp,
        updatedAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      toast({ title: "성장 지표가 수정되었습니다." });
      setIsEditStats(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "수정 실패", description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFocusChart = (view: 'today' | 'weekly' | 'monthly') => {
    setActiveTab('overview');
    setFocusedChartView(view);
    if (!isMobile) {
      setTimeout(() => {
        const chartArea = document.getElementById('analytics-chart-area');
        chartArea?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
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
              <span className="opacity-30">|</span><span className="flex items-center gap-1 text-emerald-600"><LayoutGrid className="h-3 w-3" /> {student?.className || studentMembership?.className || '반 미지정'}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" className="rounded-2xl font-black h-11 flex-1 sm:px-6 text-xs gap-2" onClick={() => setIsEditModalOpen(true)}><Settings2 className="h-4 w-4" /> 정보 수정</Button>
          <Button className="rounded-2xl font-black h-11 flex-1 sm:px-6 text-xs gap-2" onClick={() => setIsStatusModalOpen(true)}><UserCheck className="h-4 w-4" /> 상태 변경</Button>
        </div>
      </div>

      <section className={cn("grid gap-3 sm:gap-4", isMobile ? "grid-cols-2" : "lg:grid-cols-5")}>
        <StatAnalysisCard title="오늘 공부" value={`${Math.floor(stats.today / 60)}h ${stats.today % 60}m`} subValue="목표 달성 추적" icon={Clock} colorClass="text-emerald-500" isMobile={isMobile} onClick={() => handleFocusChart('today')} isActive={focusedChartView === 'today' && activeTab === 'overview'} />
        <StatAnalysisCard title="주간 평균" value={`${Math.floor(stats.weeklyAvg / 60)}h ${stats.weeklyAvg % 60}m`} subValue="최근 학습 리듬" icon={TrendingUp} colorClass="text-blue-500" isMobile={isMobile} onClick={() => handleFocusChart('weekly')} isActive={focusedChartView === 'weekly' && activeTab === 'overview'} />
        <StatAnalysisCard title="월간 평균" value={`${Math.floor(stats.monthlyAvg / 60)}h ${stats.monthlyAvg % 60}m`} subValue="장기 집중 분석" icon={CalendarDays} colorClass="text-amber-500" isMobile={isMobile} onClick={() => handleFocusChart('monthly')} isActive={focusedChartView === 'monthly' && activeTab === 'overview'} />
        <StatAnalysisCard title="성장 지표" value="스킬 트랙" subValue="4대 핵심 역량" icon={Zap} colorClass="text-purple-500" isMobile={isMobile} onClick={() => setIsMasteryModalOpen(true)} />
        <StatAnalysisCard title="시즌 랭킹" value={rankEntry?.[0]?.rank ? `${rankEntry[0].rank}위` : '산정 중'} subValue="상대 위치" icon={Trophy} colorClass="text-rose-500" isMobile={isMobile} href="/dashboard/leaderboards" />
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-[1.5rem] p-1 bg-muted/30 border h-16">
          <TabsTrigger value="overview" className="rounded-xl font-black text-xs sm:text-sm">학습 리포트</TabsTrigger>
          <TabsTrigger value="plans" className="rounded-xl font-black text-xs sm:text-sm">공부 계획</TabsTrigger>
          <TabsTrigger value="counseling" className="rounded-xl font-black text-xs sm:text-sm">상담 관리</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div id="analytics-chart-area" className="grid gap-6 md:grid-cols-3">
            <Card className={cn(
              "rounded-[2rem] border-none shadow-xl bg-white p-8 flex flex-col items-center justify-center transition-all duration-500",
              focusedChartView === 'today' ? "ring-4 ring-emerald-500/20 bg-emerald-50/10 scale-[1.02]" : ""
            )}>
              <CardTitle className="text-[10px] font-black mb-4 uppercase tracking-widest text-emerald-700">오늘 목표 달성률</CardTitle>
              <div className="relative h-40 w-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                      data={[
                        { name: 'Done', value: stats.today }, 
                        { name: 'Remaining', value: Math.max(0, stats.todayTarget - stats.today) }
                      ]} 
                      innerRadius={50} 
                      outerRadius={70} 
                      paddingAngle={5} 
                      dataKey="value" 
                      startAngle={90} 
                      endAngle={-270}
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f1f5f9" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-emerald-600">{stats.todayPercent}%</span>
                  <span className="text-[8px] font-bold text-muted-foreground uppercase">of target</span>
                </div>
              </div>
              <p className="mt-4 font-black text-sm">{Math.floor(stats.today/60)}h {stats.today%60}m 완료</p>
            </Card>

            <Card className={cn(
              "rounded-[2rem] border-none shadow-xl bg-white p-6 transition-all duration-500",
              focusedChartView === 'weekly' ? "ring-4 ring-blue-500/20 bg-blue-50/10 scale-[1.02]" : ""
            )}>
              <CardTitle className="text-sm font-black mb-4 uppercase tracking-widest text-blue-700">최근 7일 학습 리듬</CardTitle>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.weeklyChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" fontSize={9} fontWeight="bold" axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} />
                    <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex justify-between items-center px-2">
                <div className="grid">
                  <span className="text-[8px] font-black text-muted-foreground uppercase">Weekly Avg</span>
                  <span className="text-sm font-black">{Math.floor(stats.weeklyAvg / 60)}h {stats.weeklyAvg % 60}m</span>
                </div>
                <div className="h-8 w-px bg-border/50" />
                <div className="grid text-right">
                  <span className="text-[8px] font-black text-muted-foreground uppercase">Consistency</span>
                  <span className="text-sm font-black text-blue-600">Stable</span>
                </div>
              </div>
            </Card>

            <Card className={cn(
              "rounded-[2rem] border-none shadow-xl bg-white p-8 transition-all duration-500",
              focusedChartView === 'monthly' ? "ring-4 ring-amber-500/20 bg-amber-50/10 scale-[1.02]" : ""
            )}>
              <CardTitle className="text-sm font-black mb-4 uppercase tracking-widest text-amber-700">30일 누적 성과</CardTitle>
              <div className="space-y-6">
                <div>
                  <h3 className="text-4xl font-black text-amber-600 tracking-tighter">{Math.floor(stats.monthlyTotal/60)}<span className="text-lg opacity-40 ml-1">시간</span></h3>
                  <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase">Total Focus Minutes</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase opacity-60">
                    <span>Target Efficiency</span>
                    <span>{Math.round((stats.monthlyAvg / stats.todayTarget) * 100)}%</span>
                  </div>
                  <Progress value={(stats.monthlyAvg / stats.todayTarget) * 100} className="h-2 bg-amber-100" />
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-[9px] font-bold text-amber-900/60 leading-relaxed italic">
                    "최근 30일간 하루 평균 {Math.floor(stats.monthlyAvg/60)}시간 {stats.monthlyAvg%60}분 몰입하며 안정적인 페이스를 유지하고 있습니다."
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-10 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none"><Sparkles className="h-40 w-40 rotate-12" /></div>
            <CardHeader className="p-0 mb-8">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-black text-[9px] uppercase tracking-widest px-2">Trend Analysis</Badge>
              </div>
              <CardTitle className="text-2xl font-black tracking-tighter">최근 30일 학습 몰입 히스토리</CardTitle>
              <CardDescription className="text-xs font-bold text-muted-foreground">일일 순공 시간 변화 추이를 정밀 분석합니다.</CardDescription>
            </CardHeader>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorH" x1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={10} fontWeight="900" axisLine={false} tickLine={false} tick={{fill: '#999'}} />
                  <YAxis fontSize={10} unit="h" axisLine={false} tickLine={false} tick={{fill: '#999'}} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '5 5' }} />
                  <Area type="monotone" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorH)" animationDuration={1500} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-center gap-3 mb-8 bg-white/50 p-2 rounded-[2rem] border shadow-sm">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setSelectedDateForPlan(prev => addDays(prev, -7))} 
              className="rounded-2xl h-14 w-14 shrink-0 border-2 shadow-sm hover:bg-primary hover:text-white transition-all active:scale-[0.9]"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            
            <div className="grid grid-cols-7 gap-2 flex-1">
              {weekDays.map((day) => {
                const isSelected = isSameDay(day, selectedDateForPlan);
                const isToday = isSameDay(day, new Date());
                return (
                  <Button 
                    key={day.toISOString()} 
                    variant={isSelected ? "default" : "outline"} 
                    className={cn(
                      "flex flex-col h-auto py-3.5 rounded-2xl transition-all duration-300 border-2", 
                      isSelected ? "bg-primary border-primary shadow-lg scale-105 z-10" : "bg-white border-transparent hover:border-primary/20",
                      isToday && !isSelected && "border-emerald-200"
                    )} 
                    onClick={() => setSelectedDateForPlan(day)}
                  >
                    <span className={cn("text-[8px] font-black uppercase tracking-widest mb-1", isSelected ? "text-white/60" : "text-muted-foreground/40")}>{format(day, 'EEE', { locale: ko })}</span>
                    <span className={cn("text-xl font-black tracking-tighter", isSelected ? "text-white" : "text-primary")}>{format(day, 'd')}</span>
                  </Button>
                );
              })}
            </div>

            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setSelectedDateForPlan(prev => addDays(prev, 7))} 
              className="rounded-2xl h-14 w-14 shrink-0 border-2 shadow-sm hover:bg-primary hover:text-white transition-all active:scale-[0.9]"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-12">
            <Card className="md:col-span-5 rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white ring-1 ring-border/50">
              <CardHeader className="bg-muted/5 border-b p-8">
                <CardTitle className="text-xl font-black flex items-center gap-3 tracking-tighter">
                  <Clock className="h-6 w-6 text-primary" /> 생활 루틴
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-4 bg-[#fafafa]">
                {plansLoading ? (
                  <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
                ) : scheduleItems.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center gap-4 opacity-20 italic">
                    <History className="h-12 w-12" />
                    <p className="font-black text-sm">등록된 생활 루틴이 없습니다.</p>
                  </div>
                ) : (
                  scheduleItems.sort((a,b) => (a.title.split(': ')[1] || '').localeCompare(b.title.split(': ')[1] || '')).map(item => (
                    <div key={item.id} className="p-5 rounded-[1.5rem] bg-white border-2 border-transparent shadow-sm hover:border-primary/10 transition-all flex justify-between items-center group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/5 group-hover:bg-primary group-hover:text-white transition-all"><Timer className="h-4 w-4" /></div>
                        <span className="font-black text-base tracking-tight">{item.title.split(': ')[0]}</span>
                      </div>
                      <Badge className="font-mono font-black text-xs bg-muted text-primary px-3 py-1 rounded-lg border-none shadow-inner">{item.title.split(': ')[1] || '--:--'}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-7 rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white ring-1 ring-border/50">
              <CardHeader className="bg-emerald-50/30 border-b p-8">
                <CardTitle className="text-xl font-black flex items-center gap-3 tracking-tighter">
                  <ListTodo className="h-6 w-6 text-emerald-600" /> 학습 To-do
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8 bg-[#fafafa]">
                {plansLoading ? (
                  <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-emerald-500 opacity-20" /></div>
                ) : (
                  <div className="grid gap-3">
                    {studyTasks.map(task => (
                      <div key={task.id} className={cn(
                        "flex items-start gap-5 p-5 rounded-[1.75rem] border-2 transition-all group", 
                        task.done ? "bg-emerald-50/30 border-emerald-100/50" : "bg-white border-transparent shadow-sm hover:shadow-md"
                      )}>
                        <div className={cn(
                          "h-7 w-7 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all", 
                          task.done ? "bg-emerald-500 border-emerald-500 text-white shadow-lg" : "bg-muted"
                        )}>
                          {task.done ? <Check className="h-4 w-4 stroke-[3px]" /> : <CircleDot className="h-3 w-3 opacity-20" />}
                        </div>
                        <div className="grid gap-1.5 min-w-0">
                          <Label className={cn("text-base font-bold tracking-tight leading-snug transition-all break-keep", task.done && "line-through text-muted-foreground/40 italic")}>
                            {task.title}
                          </Label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="counseling" className="mt-6 space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-[2rem] border-none shadow-xl bg-white p-8 space-y-5 overflow-hidden group">
              <CardTitle className="text-xl font-black text-blue-700 flex items-center gap-2"><CalendarPlus className="h-6 w-6" /> 상담 예약 확정</CardTitle>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">상담 날짜</Label><Input type="date" value={aptDate} onChange={e => setAptDate(e.target.value)} className="rounded-xl border-2 h-12 font-bold" /></div>
                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">시간 설정</Label><Input type="time" value={aptTime} onChange={e => setAptTime(e.target.value)} className="rounded-xl border-2 h-12 font-bold" /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">상담 주제 / 메모</Label><Input placeholder="상담 주제 입력" value={aptNote} onChange={e => setAptNote(e.target.value)} className="rounded-xl border-2 h-12 font-bold" /></div>
              <Button onClick={handleAddAppointment} disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black bg-blue-600 text-white shadow-xl active:scale-95 transition-all">약속 잡기</Button>
            </Card>

            <Card className="rounded-[2rem] border-none shadow-xl bg-white p-8 space-y-5 overflow-hidden group">
              <CardTitle className="text-xl font-black text-emerald-700 flex items-center gap-2"><FileEdit className="h-6 w-6" /> 상담 일지 작성</CardTitle>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">상담 카테고리</Label>
                <Select value={logType} onValueChange={(v:any) => setLogType(v)}>
                  <SelectTrigger className="rounded-xl border-2 h-12 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl"><SelectItem value="academic" className="font-bold">학업 및 성적</SelectItem><SelectItem value="life" className="font-bold">생활 및 멘탈</SelectItem><SelectItem value="career" className="font-bold">진로 및 진학</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">상담 상세 내용</Label><Textarea placeholder="내용 기록" value={logContent} onChange={e => setLogContent(e.target.value)} className="rounded-xl h-24 border-2 font-bold resize-none" /></div>
              <Button onClick={handleAddCounselLog} disabled={isSubmitting || !logContent.trim()} className="w-full h-14 rounded-2xl font-black bg-emerald-600 text-white shadow-xl active:scale-95 transition-all">일지 저장</Button>
            </Card>
          </div>

          <div className="grid gap-4">
            {counselingLogs.map(log => (
              <Card key={log.id} className="rounded-[2rem] border-none shadow-md p-8 bg-white relative">
                <div className="flex items-center gap-3 mb-4">
                  <Badge className="bg-blue-50 text-blue-600 border-none font-black">{log.type === 'academic' ? '학업' : log.type === 'life' ? '생활' : '진로'}</Badge>
                  <span className="text-[10px] font-black text-muted-foreground/40">{log.createdAt ? format(log.createdAt.toDate(), 'yyyy.MM.dd') : ''}</span>
                </div>
                <p className="text-base font-bold text-foreground/80 leading-relaxed whitespace-pre-wrap">{log.content}</p>
                {log.improvement && (
                  <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <p className="text-xs font-bold text-emerald-900">{log.improvement}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* 스킬트랙 및 LP 상세 관리 모달 */}
      <Dialog open={isMasteryModalOpen} onOpenChange={setIsMasteryModalOpen}>
        <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col transition-all", isMobile ? "w-[95vw] h-[85vh] rounded-[2rem]" : "sm:max-w-xl max-h-[90vh]")}>
          <div className="bg-purple-600 p-10 text-white relative shrink-0">
            <Zap className="absolute top-0 right-0 p-8 h-32 w-32 opacity-20 rotate-12" />
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-white/20 text-white border-none font-black text-[10px] px-2.5 py-0.5 uppercase tracking-widest">Growth Management</Badge>
                </div>
                {!isEditStats && (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditStats(true)} className="text-white hover:bg-white/10 gap-2 h-8 rounded-lg font-black text-xs">
                    <Settings2 className="h-3.5 w-3.5" /> 수동 보정 모드
                  </Button>
                )}
              </div>
              <DialogTitle className="text-3xl font-black tracking-tighter">성장 및 스킬 관리</DialogTitle>
              <DialogDescription className="text-white/70 font-bold mt-1 text-sm">학생의 학습 포인트(LP)와 4대 핵심 역량 지표를 관리합니다.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
            <div className="p-10 space-y-10">
              {/* 시즌 LP 관리 섹션 */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-primary/60 tracking-widest flex items-center gap-2"><Trophy className="h-4 w-4" /> 시즌 러닝 포인트 (LP)</h4>
                  {isEditStats && <Badge className="bg-primary text-white border-none font-black">수정 중</Badge>}
                </div>
                <Card className="rounded-[1.5rem] border-2 border-primary/5 bg-muted/5 p-6 flex flex-col items-center text-center gap-2 group">
                  {isEditStats ? (
                    <div className="w-full space-y-4">
                      <div className="flex justify-between items-center px-1">
                        <Label className="text-[10px] font-black uppercase opacity-40">Set Season LP</Label>
                        <span className="text-xs font-black text-primary bg-white px-3 py-1 rounded-lg border shadow-sm">{editLp.toLocaleString()} LP</span>
                      </div>
                      <Slider value={[editLp]} max={50000} step={100} onValueChange={([v]) => setEditLp(v)} />
                      <Input type="number" value={editLp} onChange={(e) => setEditLp(Number(e.target.value))} className="h-12 rounded-xl text-center font-black text-xl border-2" />
                    </div>
                  ) : (
                    <>
                      <div className="text-5xl font-black tracking-tighter text-primary">{(progress?.seasonLp || 0).toLocaleString()}<span className="text-xl opacity-20 ml-1">LP</span></div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Current Season Points</p>
                    </>
                  )}
                </Card>
              </section>

              {/* 4대 스킬 관리 섹션 */}
              <section className="space-y-6">
                <h4 className="text-xs font-black uppercase text-primary/60 tracking-widest flex items-center gap-2"><Activity className="h-4 w-4" /> 핵심 역량 분석 (Stats)</h4>
                <div className="grid gap-8">
                  {Object.entries(STAT_CONFIG).map(([key, config]) => {
                    const val = isEditStats ? (editStats[key as keyof typeof editStats] || 0) : (progress?.stats?.[key as keyof typeof progress.stats] || 0);
                    const Icon = config.icon;
                    return (
                      <div key={key} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-xl", config.accent)}>
                              <Icon className={cn("h-5 w-5", config.color)} />
                            </div>
                            <div>
                              <p className="text-sm font-black tracking-tight">{config.label}</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">{config.sub}</p>
                            </div>
                          </div>
                          <div className="text-right flex items-baseline gap-1">
                            <span className="text-2xl font-black tabular-nums">{val.toFixed(1)}</span>
                            <span className="text-[10px] font-bold text-muted-foreground/40">/ 100</span>
                          </div>
                        </div>
                        {isEditStats ? (
                          <div className="space-y-4 px-1">
                            <Slider value={[val]} max={100} step={0.5} onValueChange={([v]) => setEditStats({...editStats, [key]: v})} />
                          </div>
                        ) : (
                          <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                            <div className={cn("h-full transition-all duration-1000", config.bg)} style={{ width: `${val}%` }} />
                          </div>
                        )}
                        {!isEditStats && <p className="text-[9px] font-bold text-muted-foreground/60 ml-1">{config.guide}</p>}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>

          <DialogFooter className="p-8 bg-muted/20 border-t shrink-0">
            {isEditStats ? (
              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={() => { setIsEditStats(false); if (progress) setEditLp(progress.seasonLp); }} className="flex-1 h-14 rounded-2xl font-black border-2">취소</Button>
                <Button onClick={handleUpdateGrowthData} disabled={isUpdating} className="flex-2 h-14 px-10 rounded-2xl font-black text-lg shadow-xl gap-2">
                  {isUpdating ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />} 정보 저장
                </Button>
              </div>
            ) : (
              <DialogClose asChild>
                <Button className="w-full h-14 rounded-2xl font-black text-lg">상세 분석 종료</Button>
              </DialogClose>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 정보 수정 모달 */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary p-10 text-white">
            <DialogTitle className="text-3xl font-black tracking-tighter">정보 수정</DialogTitle>
            <DialogDescription className="text-white/60 font-bold mt-1">프로필 및 소속 반을 업데이트합니다.</DialogDescription>
          </div>
          <div className="p-10 space-y-5 bg-white">
            <div className="grid gap-4">
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">이름</Label><Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="rounded-xl border-2 h-12 font-bold" /></div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">소속 반</Label>
                <Select value={editForm.className || 'none'} onValueChange={v => setEditForm({...editForm, className: v === 'none' ? '' : v})}>
                  <SelectTrigger className="rounded-xl border-2 h-12 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="none" className="font-bold">반 미배정</SelectItem>
                    {availableClasses.map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">학교</Label><Input value={editForm.schoolName} onChange={e => setEditForm({...editForm, schoolName: e.target.value})} className="rounded-xl border-2 h-12 font-bold" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">학년</Label><Select value={editForm.grade} onValueChange={v => setEditForm({...editForm, grade: v})}><SelectTrigger className="rounded-xl border-2 h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1학년">1학년</SelectItem><SelectItem value="2학년">2학년</SelectItem><SelectItem value="3학년">3학년</SelectItem><SelectItem value="N수생">N수생</SelectItem></SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter className="p-8 bg-muted/20 border-t">
            <Button onClick={handleUpdateInfo} disabled={isUpdating} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">정보 저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 상태 변경 모달 */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary p-10 text-white">
            <DialogTitle className="text-3xl font-black tracking-tighter">재원 상태 변경</DialogTitle>
          </div>
          <div className="p-10 space-y-3 bg-white">
            {[{id:'active',l:'재원 중',i:UserCheck}, {id:'onHold',l:'휴학 중',i:Clock}, {id:'withdrawn',l:'퇴원',i:X}].map(item => (
              <div key={item.id} onClick={() => setStatusForm(item.id)} className={cn("p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between", statusForm === item.id ? "border-primary bg-primary/5" : "border-transparent bg-[#fafafa]")}>
                <div className="flex items-center gap-4"><item.i className="h-5 w-5" /><span className="font-black">{item.l}</span></div>
                {statusForm === item.id && <Check className="h-5 w-5 text-primary" />}
              </div>
            ))}
          </div>
          <DialogFooter className="p-8 bg-muted/20 border-t">
            <Button onClick={handleUpdateStatus} disabled={isUpdating} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">상태 반영</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
