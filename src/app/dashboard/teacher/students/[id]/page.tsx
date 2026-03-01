'use client';

import { use, useState, useMemo, useEffect, useRef } from 'react';
import { useDoc, useCollection, useFirestore, useFunctions, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc, collection, query, where, writeBatch, serverTimestamp, addDoc, Timestamp, updateDoc } from 'firebase/firestore';
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
  X
} from 'lucide-react';
import Link from 'next/link';
import { StudentProfile, StudyLogDay, GrowthProgress, LeaderboardEntry, CenterMembership, CounselingLog, CounselingReservation } from '@/lib/types';
import { format, subDays, startOfDay } from 'date-fns';
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
      today: todayMinutes,
      todayTarget: targetMins,
      todayPercent: Math.min(100, Math.round((todayMinutes / targetMins) * 100)),
      weeklyAvg,
      monthlyAvg,
      monthlyTotal,
      chartData: logs.slice(0, 30).reverse().map(l => ({
        name: format(new Date(l.dateKey), 'MM/dd'),
        hours: Number((l.totalMinutes / 60).toFixed(1)),
        minutes: l.totalMinutes
      })),
      weeklyChartData: logs.slice(0, 7).reverse().map(l => ({
        name: format(new Date(l.dateKey), 'EEE'),
        hours: Number((l.totalMinutes / 60).toFixed(1)),
        minutes: l.totalMinutes
      }))
    };
  }, [logs, todayKey, student?.targetDailyMinutes]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', schoolName: '', grade: '', password: '', parentLinkCode: '' });
  const [statusForm, setStatusForm] = useState<string>('active');

  useEffect(() => {
    if (student && !hasInitializedForm.current) {
      setEditForm({ 
        name: student.name, 
        schoolName: student.schoolName, 
        grade: student.grade, 
        password: '',
        parentLinkCode: student.parentLinkCode || ''
      });
      hasInitializedForm.current = true;
    } else if (studentMembership && !hasInitializedForm.current) {
      setEditForm(f => ({ ...f, name: studentMembership.displayName || '' }));
    }
  }, [student, studentMembership]);

  useEffect(() => {
    if (studentMembership) setStatusForm(studentMembership.status);
  }, [studentMembership]);

  const handleAddAppointment = () => {
    if (!firestore || !centerId || !currentUser || !aptDate || !aptTime) return;
    setIsSubmitting(true);
    try {
      const scheduledDate = new Date(`${aptDate}T${aptTime}`);
      if (scheduledDate < new Date()) {
        toast({ variant: "destructive", title: "예약 불가", description: "과거 시간으로는 예약할 수 없습니다." });
        setIsSubmitting(false);
        return;
      }
      const data = {
        centerId, studentId, studentName: student?.name || studentMembership?.displayName || '학생',
        teacherId: currentUser.uid, teacherName: currentUser.displayName || '선생님',
        scheduledAt: Timestamp.fromDate(scheduledDate), status: 'confirmed',
        teacherNote: aptNote.trim(), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      };
      addDoc(collection(firestore, `centers/${centerId}/counselingReservations`), data).then(() => {
        toast({ title: "상담 예약 완료" });
        setAptNote('');
      }).finally(() => setIsSubmitting(false));
    } catch (err) { setIsSubmitting(false); }
  };

  const handleUpdateAptStatus = async (resId: string, status: CounselingReservation['status']) => {
    if (!firestore || !centerId) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'counselingReservations', resId), {
        status,
        updatedAt: serverTimestamp()
      });
      toast({ title: status === 'confirmed' ? "승인 완료" : "거절 완료" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "상태 변경 실패" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenLogModalFromRes = (res: CounselingReservation) => {
    setSelectedResForLog(res);
    setLogContent('');
    setLogImprovement('');
    setLogType('academic');
    setIsLogModalOpen(true);
  };

  const handleAddCounselLog = () => {
    if (!firestore || !centerId || !currentUser || !logContent.trim()) return;
    setIsSubmitting(true);
    const data = { 
      studentId, 
      teacherId: currentUser.uid, 
      type: logType, 
      content: logContent.trim(), 
      improvement: logImprovement.trim(), 
      createdAt: serverTimestamp(),
      reservationId: selectedResForLog?.id || null
    };
    
    const logPromise = addDoc(collection(firestore, `centers/${centerId}/counselingLogs`), data);
    const resPromise = selectedResForLog 
      ? updateDoc(doc(firestore, 'centers', centerId, 'counselingReservations', selectedResForLog.id), { status: 'done', updatedAt: serverTimestamp() })
      : Promise.resolve();

    Promise.all([logPromise, resPromise]).then(() => {
      toast({ title: "상담 일지 기록 완료" });
      setLogContent(''); setLogImprovement('');
      setIsLogModalOpen(false);
      setSelectedResForLog(null);
    }).finally(() => setIsSubmitting(false));
  };

  const handleUpdateInfo = async () => {
    if (!functions || !centerId || !studentId) return;
    setIsUpdating(true);
    try {
      const updateFn = httpsCallable(functions, 'updateStudentAccount');
      const result: any = await updateFn({
        studentId, centerId, displayName: editForm.name, schoolName: editForm.schoolName, grade: editForm.grade, 
        password: editForm.password.length >= 6 ? editForm.password : undefined, parentLinkCode: editForm.parentLinkCode.trim() || null
      });
      if (result.data?.ok) { toast({ title: "정보 수정 완료" }); setIsEditModalOpen(false); }
    } catch (e: any) { toast({ variant: "destructive", title: "수정 실패" }); } finally { setIsUpdating(false); }
  };

  const handleUpdateStatus = async () => {
    if (!firestore || !centerId || !studentId) return;
    setIsUpdating(true);
    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'centers', centerId, 'members', studentId), { status: statusForm, updatedAt: serverTimestamp() });
      batch.update(doc(firestore, 'userCenters', studentId, 'centers', centerId), { status: statusForm, updatedAt: serverTimestamp() });
      await batch.commit();
      toast({ title: "상태 변경 완료" });
      setIsStatusModalOpen(false);
    } catch (e) { toast({ variant: "destructive", title: "상태 변경 실패" }); } finally { setIsUpdating(false); }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'requested': return <Badge variant="secondary" className="bg-amber-50 text-amber-600 border-amber-100 font-black text-[10px]">승인 대기</Badge>;
      case 'confirmed': return <Badge className="bg-emerald-500 text-white border-none font-black text-[10px] shadow-sm">예약 확정</Badge>;
      case 'done': return <Badge variant="outline" className="opacity-40 font-black text-[10px]">상담 완료</Badge>;
      case 'canceled': return <Badge variant="destructive" className="font-black text-[10px]">취소됨</Badge>;
      default: return <Badge variant="outline" className="font-black text-[10px]">{status}</Badge>;
    }
  };

  if (studentLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className={cn("flex flex-col gap-6 max-w-6xl mx-auto pb-20", isMobile ? "gap-4 px-1" : "gap-8")}>
      <div className={cn("flex justify-between gap-4", isMobile ? "flex-col items-start" : "flex-row items-end")}>
        <div className="flex items-start gap-3 sm:gap-4 w-full">
          <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 shrink-0 mt-1" asChild>
            <Link href="/dashboard/teacher/students"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className={cn("flex flex-wrap items-center gap-2", isMobile ? "items-start" : "items-center")}>
              <h1 className={cn("font-black tracking-tighter truncate leading-tight", isMobile ? "text-2xl" : "text-4xl")}>
                {student?.name || studentMembership?.displayName || '학생'}
              </h1>
              <Badge className="bg-primary text-white px-2 py-0.5 rounded-full font-black text-[10px] whitespace-nowrap">{student?.seatNo || '미배정'}번 좌석</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-bold">
              <span className="flex items-center gap-1 text-primary truncate max-w-[150px]"><Building2 className="h-3.5 w-3.5 shrink-0" /> {student?.schoolName || '학교 정보 없음'}</span>
              <span className="opacity-30">|</span>
              <span>{student?.grade || '학년 정보 없음'}</span>
            </div>
          </div>
        </div>
        <div className={cn("flex gap-2 w-full sm:w-auto", isMobile ? "px-1" : "")}>
          <Button variant="outline" className="rounded-2xl font-black h-11 flex-1 sm:px-6 shadow-sm gap-2 text-xs" onClick={() => setIsEditModalOpen(true)}><Settings2 className="h-4 w-4" /> 정보 수정</Button>
          <Button className="rounded-2xl font-black h-11 flex-1 sm:px-6 shadow-lg gap-2 text-xs" onClick={() => setIsStatusModalOpen(true)}><UserCheck className="h-4 w-4" /> 상태 변경</Button>
        </div>
      </div>

      <section className={cn("grid gap-3 sm:gap-4", isMobile ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-5")}>
        <StatAnalysisCard title="오늘 공부 시간" value={`${Math.floor(stats.today / 60)}h ${stats.today % 60}m`} subValue="목표 달성 트래킹" icon={Clock} colorClass="text-emerald-500" isMobile={isMobile} />
        <StatAnalysisCard title="주간 평균" value={`${Math.floor(stats.weeklyAvg / 60)}h ${stats.weeklyAvg % 60}m`} subValue="최근 학습 리듬" icon={TrendingUp} colorClass="text-blue-500" isMobile={isMobile} />
        <StatAnalysisCard title="월간 평균" value={`${Math.floor(stats.monthlyAvg / 60)}h ${stats.monthlyAvg % 60}m`} subValue="장기 집중도 분석" icon={CalendarDays} colorClass="text-amber-500" isMobile={isMobile} />
        
        <Dialog open={isMasteryModalOpen} onOpenChange={setIsMasteryModalOpen}>
          <DialogTrigger asChild>
            <StatAnalysisCard title="마스터리 레벨" value={`Lv.${progress?.level || 1}`} subValue="성장 능력치 분석" icon={Zap} colorClass="text-purple-500" isMobile={isMobile} onClick={() => setIsMasteryModalOpen(true)} />
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md">
            <div className="bg-purple-600 p-8 text-white relative">
              <Sparkles className="absolute top-0 right-0 p-8 h-32 w-32 opacity-10 animate-pulse" />
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tighter">학생 마스터리 분석</DialogTitle>
                <DialogDescription className="text-white/70 font-bold">성장의 4대 지표를 상세히 분석합니다.</DialogDescription>
              </DialogHeader>
            </div>
            <div className="p-8 space-y-6 bg-white">
              {[
                { label: '집중력 (Focus)', val: progress?.stats?.focus || 0, icon: Target, color: 'text-blue-500' },
                { label: '꾸준함 (Consistency)', val: progress?.stats?.consistency || 0, icon: RefreshCw, color: 'text-emerald-500' },
                { label: '목표달성 (Achievement)', val: progress?.stats?.achievement || 0, icon: CheckCircle2, color: 'text-amber-500' },
                { label: '회복력 (Resilience)', val: progress?.stats?.resilience || 0, icon: ShieldCheck, color: 'text-rose-500' },
              ].map((stat, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-black uppercase">
                    <span className="flex items-center gap-2"><stat.icon className={cn("h-3.5 w-3.5", stat.color)} /> {stat.label}</span>
                    <span className={stat.color}>{stat.val.toFixed(1)} / 100</span>
                  </div>
                  <Progress value={stat.val} className="h-1.5" />
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <StatAnalysisCard 
          title="시즌 랭킹" 
          value={rankEntry?.[0]?.rank ? `${rankEntry[0].rank}위` : '산정 중'} 
          subValue="센터 내 상대 위치" 
          icon={Trophy} 
          colorClass="text-rose-500" 
          isMobile={isMobile} 
          href="/dashboard/leaderboards"
        />
      </section>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className={cn("grid w-full grid-cols-3 rounded-[1.5rem] p-1 bg-muted/30 border border-border/50 shadow-inner", isMobile ? "h-14" : "h-16")}>
          <TabsTrigger value="overview" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-md text-xs sm:text-sm">학습 리포트</TabsTrigger>
          <TabsTrigger value="plans" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-md text-xs sm:text-sm">공부 계획</TabsTrigger>
          <TabsTrigger value="counseling" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-md text-xs sm:text-sm">상담 관리</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "md:grid-cols-3")}>
            <Card className="rounded-[2rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
              <CardHeader className="bg-emerald-50/30 border-b p-6">
                <CardTitle className="text-sm font-black flex items-center gap-2 text-emerald-700 uppercase tracking-widest"><Target className="h-4 w-4" /> 오늘 몰입 성과</CardTitle>
              </CardHeader>
              <CardContent className="p-8 flex flex-col items-center justify-center">
                <div className="relative h-40 w-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Done', value: stats.today },
                          { name: 'Rem', value: Math.max(0, stats.todayTarget - stats.today) }
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
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-base font-black text-primary">{Math.floor(stats.today/60)}h {stats.today%60}m 완료</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Target: {Math.floor(stats.todayTarget/60)}h</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
              <CardHeader className="bg-blue-50/30 border-b p-6">
                <CardTitle className="text-sm font-black flex items-center gap-2 text-blue-700 uppercase tracking-widest"><BarChart3 className="h-4 w-4" /> 주간 학습 리듬</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-40 w-full mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.weeklyChartData}>
                      <XAxis dataKey="name" fontSize={9} fontWeight="bold" axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontSize: '10px' }}
                        labelStyle={{ fontWeight: 'black' }}
                      />
                      <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex justify-between items-center px-2">
                  <div className="grid">
                    <span className="text-[9px] font-black text-muted-foreground uppercase">Weekly Avg</span>
                    <span className="text-sm font-black">{Math.floor(stats.weeklyAvg/60)}h {stats.weeklyAvg%60}m</span>
                  </div>
                  <Badge className="bg-blue-50 text-blue-600 border-none font-black text-[9px]">+5.2%</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
              <CardHeader className="bg-amber-50/30 border-b p-6">
                <CardTitle className="text-sm font-black flex items-center gap-2 text-amber-700 uppercase tracking-widest"><PieChartIcon className="h-4 w-4" /> 월간 집중 리포트</CardTitle>
              </CardHeader>
              <CardContent className="p-8 flex flex-col justify-center gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Monthly Study</p>
                  <h3 className="text-4xl font-black text-amber-600 tracking-tighter">{Math.floor(stats.monthlyTotal/60)}<span className="text-lg opacity-40 ml-1">h</span></h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black uppercase text-muted-foreground">Daily Average</span>
                    <span className="text-sm font-black">{Math.floor(stats.monthlyAvg/60)}h {stats.monthlyAvg%60}m</span>
                  </div>
                  <Progress value={(stats.monthlyAvg / stats.todayTarget) * 100} className="h-1.5 bg-amber-100" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
            <CardHeader className={cn("bg-muted/5 border-b", isMobile ? "p-5" : "p-8")}>
              <CardTitle className="text-lg sm:text-xl font-black flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> 최근 30일 학습 몰입 히스토리</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Long-term Performance Trend</CardDescription>
            </CardHeader>
            <CardContent className={cn(isMobile ? "p-4" : "p-10")}>
              <div className={cn("w-full", isMobile ? "h-[250px]" : "h-[350px]")}>
                {isMounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs><linearGradient id="colorH" x1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" fontSize={10} fontWeight="900" axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} fontWeight="900" axisLine={false} tickLine={false} unit="h" />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorH)" animationDuration={1500} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full bg-muted/10 animate-pulse rounded-lg flex items-center justify-center">
                    <Loader2 className="animate-spin h-8 w-8 opacity-20" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-6">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-10 text-center flex flex-col items-center gap-4">
            <ClipboardCheck className="h-16 w-16 text-muted-foreground opacity-10" />
            <div className="space-y-1">
              <p className="text-xl font-black text-muted-foreground/40">공부 계획 상세 데이터</p>
              <p className="text-sm font-bold text-muted-foreground/20 uppercase tracking-widest">Planned vs Actual Matrix</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="counseling" className="mt-6 space-y-10">
          <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "md:grid-cols-2")}>
            <Card className="rounded-[2.5rem] border-none shadow-lg bg-white overflow-hidden ring-1 ring-border/50 flex flex-col">
              <CardHeader className="bg-blue-50/50 border-b p-6 sm:p-8">
                <CardTitle className="flex items-center gap-2 text-lg font-black text-blue-700">
                  <CalendarPlus className="h-5 w-5" /> 새 상담 예약
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Schedule Next Session</CardDescription>
              </CardHeader>
              <CardContent className={cn("space-y-5 flex-1", isMobile ? "p-6" : "p-8")}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">날짜</Label>
                    <Input type="date" value={aptDate} onChange={(e) => setAptDate(e.target.value)} className="rounded-xl h-12 border-2" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">시간</Label>
                    <Input type="time" value={aptTime} onChange={(e) => setAptTime(e.target.value)} className="rounded-xl h-12 border-2" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">상담 주제</Label>
                  <Input placeholder="메모할 내용을 입력하세요" value={aptNote} onChange={(e) => setAptNote(e.target.value)} className="rounded-xl h-12 border-2" />
                </div>
                <Button 
                  onClick={handleAddAppointment} 
                  disabled={isSubmitting} 
                  className="w-full h-14 rounded-2xl font-black bg-blue-600 hover:bg-blue-700 shadow-xl text-base gap-2 active:scale-95 transition-all"
                >
                  {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : '예약 확정하기'} <ChevronRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-[2.5rem] border-none shadow-lg bg-white overflow-hidden ring-1 ring-border/50 flex flex-col">
              <CardHeader className="bg-emerald-50/50 border-b p-6 sm:p-8">
                <CardTitle className="flex items-center gap-2 text-lg font-black text-emerald-700">
                  <FileEdit className="h-5 w-5" /> 상담 일지 작성
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Record Counseling Feedback</CardDescription>
              </CardHeader>
              <CardContent className={cn("space-y-5 flex-1", isMobile ? "p-6" : "p-8")}>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">상담 유형</Label>
                  <Select value={logType} onValueChange={(val: any) => setLogType(val)}>
                    <SelectTrigger className="rounded-xl h-12 border-2 text-sm font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="academic">학업/성적</SelectItem>
                      <SelectItem value="life">생활 습관</SelectItem>
                      <SelectItem value="career">진로/진학</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">상담 내용</Label>
                  <Textarea placeholder="상담한 핵심 내용을 상세히 기록하세요." value={logContent} onChange={(e) => setLogContent(e.target.value)} className="rounded-xl min-h-[120px] text-sm font-bold border-2" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-emerald-700 ml-1 flex items-center gap-1.5"><Zap className="h-3 w-3 fill-current" /> 개선 권고 사항</Label>
                  <Input placeholder="학생이 수행할 과제나 개선점" value={logImprovement} onChange={(e) => setLogImprovement(e.target.value)} className="rounded-xl h-12 border-2 border-emerald-100 bg-emerald-50/20" />
                </div>
                <Button 
                  onClick={handleAddCounselLog} 
                  disabled={isSubmitting || !logContent.trim()} 
                  className="w-full h-14 rounded-2xl font-black bg-emerald-600 hover:bg-emerald-700 shadow-xl text-base active:scale-95 transition-all"
                >
                  {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : '상담 일지 저장'}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <History className="h-6 w-6 text-primary opacity-40" />
              <h2 className="text-2xl font-black tracking-tighter">상담 히스토리</h2>
              <Badge variant="outline" className="ml-auto font-black text-[10px] border-primary/20 opacity-60 px-3">{counselingLogs.length + appointments.length} 건</Badge>
            </div>

            <div className="grid gap-6">
              {counselingLogs.length === 0 && appointments.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed flex flex-col items-center gap-4">
                  <MessageSquare className="h-12 w-12 text-muted-foreground opacity-10" />
                  <p className="text-sm font-bold text-muted-foreground/40 italic">아직 기록된 상담 내역이 없습니다.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {appointments.map(apt => (
                    <Card key={apt.id} className={cn(
                      "rounded-3xl border-2 shadow-sm overflow-hidden group",
                      apt.status === 'confirmed' ? "border-blue-100 bg-blue-50/20" : 
                      apt.status === 'requested' ? "border-amber-100 bg-amber-50/20" : "opacity-60 grayscale bg-muted/5 border-muted"
                    )}>
                      <CardContent className="p-6 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-5">
                          <div className={cn(
                            "h-12 w-12 rounded-2xl flex flex-col items-center justify-center shrink-0 border",
                            apt.status === 'confirmed' ? "bg-blue-100 border-blue-200" : "bg-amber-100 border-amber-200"
                          )}>
                            <span className="text-[8px] font-black opacity-60 uppercase leading-none">DAY</span>
                            <span className="text-lg font-black">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'd') : ''}</span>
                          </div>
                          <div>
                            <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-0.5">{apt.status === 'requested' ? 'Pending Request' : 'Scheduled Appointment'}</p>
                            <h4 className="text-lg font-black tracking-tight">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'p') : ''} 상담</h4>
                            <p className="text-xs font-bold text-muted-foreground">{apt.studentNote || apt.teacherNote || '상담 주제 미입력'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {apt.status === 'requested' && (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleUpdateAptStatus(apt.id, 'confirmed')} className="rounded-xl font-black bg-emerald-500 h-9 px-3 gap-1"><Check className="h-3.5 w-3.5" /> 승인</Button>
                              <Button size="sm" variant="outline" onClick={() => handleUpdateAptStatus(apt.id, 'canceled')} className="rounded-xl font-black border-rose-200 text-rose-600 h-9 px-3 gap-1"><X className="h-3.5 w-3.5" /> 거절</Button>
                            </div>
                          )}
                          {apt.status === 'confirmed' && (
                            <Button size="sm" onClick={() => handleOpenLogModalFromRes(apt)} className="rounded-xl font-black bg-primary text-white h-9 px-4 gap-1.5 shadow-md">
                              <FileEdit className="h-3.5 w-3.5" /> 일지 작성
                            </Button>
                          )}
                          {apt.status !== 'requested' && apt.status !== 'confirmed' && getStatusBadge(apt.status)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {counselingLogs.map((log) => (
                    <Card key={log.id} className="rounded-3xl border-none shadow-md bg-white overflow-hidden ring-1 ring-border/50 hover:shadow-xl transition-all">
                      <CardContent className="p-6 sm:p-8 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="rounded-lg font-black uppercase text-[9px] border-primary/10 text-primary/60">
                              {log.type === 'academic' ? '학업' : log.type === 'life' ? '생활' : '진로'}
                            </Badge>
                            <span className="text-[10px] font-bold text-muted-foreground">{log.createdAt ? format(log.createdAt.toDate(), 'yyyy.MM.dd') : ''}</span>
                          </div>
                          <div className="flex items-center gap-1.5 opacity-30">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            <span className="text-[8px] font-black uppercase">DONE</span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <p className="text-sm font-bold text-foreground/80 leading-relaxed">{log.content}</p>
                          {log.improvement && (
                            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-start gap-3">
                              <AlertCircle className="h-3.5 w-3.5 text-emerald-600 mt-0.5" />
                              <p className="text-xs font-bold text-emerald-900 leading-tight">{log.improvement}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className={cn("rounded-[2.5rem] sm:max-w-md border-none shadow-2xl", isMobile ? "max-w-[95vw] w-[95vw]" : "")}>
          <DialogHeader>
            <DialogTitle className="text-3xl font-black tracking-tighter">학생 정보 수정</DialogTitle>
            <DialogDescription className="font-bold text-muted-foreground mt-1 text-sm">학업 기본 정보 및 연동 코드를 업데이트합니다.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/70">이름</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="rounded-xl h-11 border-2 text-sm" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/70">소속 학교</Label>
              <Input value={editForm.schoolName} onChange={(e) => setEditForm({...editForm, schoolName: e.target.value})} className="rounded-xl h-11 border-2 text-sm" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[10px] font-black uppercase text-primary/70">학년</Label>
              <Select value={editForm.grade} onValueChange={(val) => setEditForm({...editForm, grade: val})}>
                <SelectTrigger className="rounded-xl h-11 border-2 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1학년">1학년</SelectItem><SelectItem value="2학년">2학년</SelectItem><SelectItem value="3학년">3학년</SelectItem><SelectItem value="N수생">N수생</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <Label className="text-[10px] font-black uppercase text-primary flex items-center gap-2">
                <ShieldCheck className="h-3 w-3" /> 학부모 연동 코드 (4자리)
              </Label>
              <Input 
                value={editForm.parentLinkCode} 
                placeholder="4자리 숫자" 
                maxLength={4}
                onChange={(e) => setEditForm({...editForm, parentLinkCode: e.target.value.replace(/[^0-9]/g, '')})} 
                className="rounded-xl h-11 border-2 font-black tracking-[0.5em] text-center" 
              />
              <p className="text-[9px] font-bold text-muted-foreground">부모님이 가입할 때 필요한 코드입니다. 학생에게 전달해 주세요.</p>
            </div>
            <div className="grid gap-1.5 pt-2 border-t border-dashed">
              <Label className="text-[10px] font-black uppercase text-destructive flex items-center gap-1.5 ml-1"><Lock className="h-3 w-3" /> 비밀번호 재설정</Label>
              <Input type="password" placeholder="새 비밀번호 입력 (6자 이상)" value={editForm.password} onChange={(e) => setEditForm({...editForm, password: e.target.value})} className="rounded-xl h-11 border-destructive/20 focus-visible:ring-destructive/10 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateInfo} disabled={isUpdating} className="w-full rounded-2xl h-12 font-black shadow-xl text-base">
              {isUpdating ? <Loader2 className="animate-spin" /> : "변경 내용 저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className={cn("rounded-[2.5rem] sm:max-w-md border-none shadow-2xl", isMobile ? "max-w-[95vw] w-[95vw]" : "")}>
          <DialogHeader><DialogTitle className="text-2xl font-black tracking-tighter">학생 상태 관리</DialogTitle></DialogHeader>
          <div className="py-4 space-y-3">
            <div className="grid gap-2">
              {[
                { id: 'active', label: '재원생', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { id: 'onHold', label: '휴학생', color: 'text-amber-600', bg: 'bg-amber-50' },
                { id: 'withdrawn', label: '퇴원생', color: 'text-muted-foreground', bg: 'bg-muted/30' },
              ].map((item) => (
                <div key={item.id} onClick={() => setStatusForm(item.id)} className={cn("p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-3", statusForm === item.id ? "border-primary bg-white shadow-lg scale-[1.02]" : "border-transparent bg-muted/10")}>
                  <div className={cn("p-1.5 rounded-xl", statusForm === item.id ? "bg-primary text-white" : "bg-white")}>{statusForm === item.id && <CheckCircle2 className="h-4 w-4" />}</div>
                  <span className={cn("font-black text-lg", item.color)}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdateStatus} disabled={isUpdating} className="w-full rounded-2xl h-12 font-black shadow-xl text-base">{isUpdating ? <Loader2 className="animate-spin" /> : "학생 상태 업데이트 완료"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 상담 일지 작성 팝업 (예약 건 기반) */}
      <Dialog open={isLogModalOpen} onOpenChange={setIsLogModalOpen}>
        <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl sm:max-w-md">
          <div className="bg-emerald-600 p-8 text-white relative">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tighter">상담 일지 작성</DialogTitle>
              <DialogDescription className="text-white/70 font-bold">상담 후 학생에게 전달할 피드백을 기록하세요.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-8 space-y-5 bg-white">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">상담 유형</label>
              <Select value={logType} onValueChange={(val: any) => setLogType(val)}>
                <SelectTrigger className="rounded-xl h-12 border-2 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="academic">학업/성적</SelectItem>
                  <SelectItem value="life">생활 습관</SelectItem>
                  <SelectItem value="career">진로/진학</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">상담 내용</label>
              <Textarea placeholder="핵심 내용을 상세히 기록하세요." value={logContent} onChange={(e) => setLogContent(e.target.value)} className="rounded-xl min-h-[120px] text-sm font-bold border-2" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-emerald-700 ml-1">개선 권고 사항</label>
              <Input placeholder="학생이 수행할 과제나 개선점" value={logImprovement} onChange={(e) => setLogImprovement(e.target.value)} className="rounded-xl h-12 border-2" />
            </div>
          </div>
          <DialogFooter className="p-8 bg-muted/30">
            <Button onClick={handleAddCounselLog} disabled={isSubmitting || !logContent.trim()} className="w-full h-14 rounded-2xl font-black bg-emerald-600 text-white shadow-xl">
              {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : '상담 완료 및 일지 저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
