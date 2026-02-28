
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
  MessageSquare
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

// --- 커스텀 컴포넌트 ---

const CustomTooltip = ({ active, payload, label, unit = '시간' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md border border-white/40 p-4 rounded-2xl shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in duration-200">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-primary tracking-tighter">{payload[0].value}</span>
          <span className="text-xs font-bold text-muted-foreground">{unit}</span>
        </div>
      </div>
    );
  }
  return null;
};

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
      className="group cursor-pointer hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-500 border-none shadow-md overflow-hidden relative active:scale-95 bg-white/50 backdrop-blur-sm"
      onClick={onClick}
    >
      <div className={cn("absolute top-0 left-0 w-1.5 h-full transition-all duration-500 group-hover:w-2", colorClass.replace('text-', 'bg-'))} />
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{title}</CardTitle>
        <div className={cn("p-2 rounded-xl bg-opacity-10 group-hover:scale-110 transition-transform duration-500", colorClass.replace('text-', 'bg-'))}>
          <Icon className={cn("h-4 w-4", colorClass)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-black tracking-tighter group-hover:translate-x-1 transition-transform duration-500">{value}</div>
        <p className="text-[10px] font-bold text-muted-foreground mt-1 flex items-center gap-1">
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

  // 상담 데이터 조회
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

  // --- 데이터 정렬 (인덱스 방지) ---
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
          <Button variant="outline" className="rounded-xl font-bold h-12 px-6 shadow-sm gap-2" onClick={() => setIsEditModalOpen(true)}>
            <Settings2 className="h-4 w-4" /> 정보 수정
          </Button>
          <Button className="rounded-xl font-bold h-12 px-6 shadow-lg gap-2" onClick={() => setIsStatusModalOpen(true)}>
            <UserCheck className="h-4 w-4" /> 상태 변경
          </Button>
        </div>
      </div>

      {/* 대시보드 카드 섹션 */}
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
        <TabsList className="grid w-full grid-cols-3 rounded-[1.5rem] h-16 p-1.5 bg-muted/30 border border-border/50 shadow-inner">
          <TabsTrigger value="overview" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all text-sm">학습 리포트</TabsTrigger>
          <TabsTrigger value="plans" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all text-sm">공부 계획</TabsTrigger>
          <TabsTrigger value="counseling" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all text-sm">상담 관리</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-8">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
            <CardHeader className="bg-muted/10 p-8 border-b">
              <CardTitle className="text-xl font-black">최근 30일 학습 몰입 히스토리</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.chartData}>
                    <defs>
                      <linearGradient id="colorH" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} unit="h" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorH)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="counseling" className="mt-8 space-y-8">
          <div className="grid gap-6 md:grid-cols-2">
            {/* 상담 예약 섹션 */}
            <Card className="rounded-[2rem] border-none shadow-lg bg-white overflow-hidden">
              <CardHeader className="bg-blue-50/50 border-b pb-6">
                <CardTitle className="flex items-center gap-2 text-xl font-black text-blue-700">
                  <CalendarPlus className="h-5 w-5" /> 새 상담 예약
                </CardTitle>
                <CardDescription className="font-bold">선생님이 먼저 상담 일정을 잡을 수 있습니다.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-muted-foreground">날짜</Label>
                    <Input type="date" value={aptDate} onChange={(e) => setAptDate(e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase text-muted-foreground">시간</Label>
                    <Input type="time" value={aptTime} onChange={(e) => setAptTime(e.target.value)} className="rounded-xl" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-muted-foreground">상담 주제/메모</Label>
                  <Input placeholder="예: 3월 모의고사 피드백" value={aptNote} onChange={(e) => setAptNote(e.target.value)} className="rounded-xl" />
                </div>
                <Button onClick={handleAddAppointment} disabled={isSubmitting} className="w-full h-12 rounded-xl font-black bg-blue-600 hover:bg-blue-700 shadow-md">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "예약 확정하기"}
                </Button>
              </CardContent>
            </Card>

            {/* 상담 일지 작성 섹션 */}
            <Card className="rounded-[2rem] border-none shadow-lg bg-white overflow-hidden">
              <CardHeader className="bg-emerald-50/50 border-b pb-6">
                <CardTitle className="flex items-center gap-2 text-xl font-black text-emerald-700">
                  <FileEdit className="h-5 w-5" /> 상담 일지 작성
                </CardTitle>
                <CardDescription className="font-bold">상담 내용을 기록하여 체계적으로 관리하세요.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-muted-foreground">상담 유형</Label>
                  <Select value={logType} onValueChange={(val: any) => setLogType(val)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="academic">학업/성적</SelectItem>
                      <SelectItem value="life">생활 습관</SelectItem>
                      <SelectItem value="career">진로/진학</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-muted-foreground">상담 내용</Label>
                  <Textarea placeholder="상담한 핵심 내용을 적어주세요." value={logContent} onChange={(e) => setLogContent(e.target.value)} className="rounded-xl min-h-[100px]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-muted-foreground">개선 권고 사항</Label>
                  <Input placeholder="학생에게 전달할 실천 과제" value={logImprovement} onChange={(e) => setLogImprovement(e.target.value)} className="rounded-xl" />
                </div>
                <Button onClick={handleAddCounselLog} disabled={isSubmitting} className="w-full h-12 rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 shadow-md">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "상담 일지 저장"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* 최근 예약 리스트 */}
            <Card className="rounded-[2rem] border-none shadow-lg bg-white overflow-hidden">
              <CardHeader className="p-6 border-b">
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <History className="h-5 w-5 text-blue-500" /> 상담 예약 현황
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-[400px] overflow-y-auto custom-scrollbar">
                  {appointments.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground font-bold text-sm">예정된 상담이 없습니다.</div>
                  ) : (
                    appointments.map((apt: any) => (
                      <div key={apt.id} className="p-4 flex items-center justify-between hover:bg-muted/5">
                        <div className="grid gap-0.5">
                          <span className="text-xs font-black text-blue-600">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'M월 d일 p', { locale: ko }) : '-'}</span>
                          <span className="text-sm font-bold">{apt.teacherNote || '상담 주제 없음'}</span>
                        </div>
                        <Badge variant={apt.status === 'confirmed' ? 'default' : 'outline'} className="rounded-full text-[10px]">
                          {apt.status === 'confirmed' ? '확정' : apt.status}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 과거 상담 일지 리스트 */}
            <Card className="rounded-[2rem] border-none shadow-lg bg-white overflow-hidden">
              <CardHeader className="p-6 border-b">
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-emerald-500" /> 과거 상담 기록
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-[400px] overflow-y-auto custom-scrollbar">
                  {counselingLogs.length === 0 ? (
                    <div className="py-20 text-center text-muted-foreground font-bold text-sm">기록된 상담 일지가 없습니다.</div>
                  ) : (
                    counselingLogs.map((log: any) => (
                      <div key={log.id} className="p-5 hover:bg-muted/5 space-y-2">
                        <div className="flex justify-between items-center">
                          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter">
                            {log.type === 'academic' ? '학업' : log.type === 'life' ? '생활' : '진로'}
                          </Badge>
                          <span className="text-[10px] font-bold text-muted-foreground">{log.createdAt ? format(log.createdAt.toDate(), 'yyyy.MM.dd') : '-'}</span>
                        </div>
                        <p className="text-sm font-bold line-clamp-2 leading-relaxed">{log.content}</p>
                        {log.improvement && (
                          <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                            <p className="text-[10px] font-black text-emerald-700 flex items-center gap-1">
                              <Check className="h-3 w-3" /> 개선 과제: {log.improvement}
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

      {/* 분석 다이얼로그 (생략 - 기존과 동일) */}
      <Dialog open={!!activeAnalysis} onOpenChange={(open) => !open && setActiveAnalysis(null)}>
        <DialogContent className="sm:max-w-3xl rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-primary p-8 sm:p-12 text-primary-foreground relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-[0.03] rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-white/10 p-2 rounded-2xl border border-white/10">
                  <Sparkles className="h-5 w-5 text-amber-400 fill-amber-400" />
                </div>
                <Badge className="bg-white/20 text-white border-none font-black text-[10px] tracking-widest uppercase">Deep Insight</Badge>
              </div>
              <DialogTitle className="text-4xl font-black tracking-tighter">
                {activeAnalysis === 'today' && "오늘의 집중 몰입도"}
                {activeAnalysis === 'weekly' && "최근 7일 학습 모멘텀"}
                {activeAnalysis === 'monthly' && "30일 학습 일관성 분석"}
                {activeAnalysis === 'level' && "성장 스탯 밸런스"}
                {activeAnalysis === 'rank' && "시즌 경쟁력 분석"}
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/70 font-bold text-lg">
                {student?.name} 학생의 실제 데이터를 바탕으로 분석한 지표입니다.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-8 sm:p-12 bg-white min-h-[450px] flex flex-col items-center justify-center">
            {activeAnalysis === 'today' && (
              <div className="w-full h-[350px] flex flex-col items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="100%" barSize={40} data={analysisData as any}>
                    <RadialBar background dataKey="value" cornerRadius={20} />
                    <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-[10px] font-black text-muted-foreground uppercase">달성률</span>
                  <span className="text-5xl font-black text-primary">{Math.round((stats.today / (student?.targetDailyMinutes || 360)) * 100)}%</span>
                </div>
              </div>
            )}

            {activeAnalysis === 'weekly' && (
              <div className="w-full h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analysisData as any}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" fontSize={11} fontWeight="900" axisLine={false} tickLine={false} />
                    <YAxis fontSize={11} fontWeight="900" axisLine={false} tickLine={false} unit="h" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="step" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={4} fill="hsl(var(--primary))" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeAnalysis === 'monthly' && (
              <div className="w-full h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysisData as any}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" fontSize={9} fontWeight="bold" axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="hours" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeAnalysis === 'level' && (
              <div className="w-full h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={analysisData as any}>
                    <PolarGrid stroke="#e0e0e0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fontWeight: 900, fill: '#666' }} />
                    <Radar name="Student" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeAnalysis === 'rank' && (
              <div className="w-full h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={analysisData as any} margin={{ left: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontWeight: 900, fontSize: 14 }} />
                    <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip unit="%" />} />
                    <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={40}>
                      {(analysisData as any).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="mt-10 p-6 rounded-3xl bg-muted/20 border border-dashed border-muted-foreground/20 w-full">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-2 rounded-xl">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary/70 mb-1">데이터 분석 제언</h4>
                  <p className="text-sm font-bold text-muted-foreground leading-relaxed">
                    {activeAnalysis === 'today' && `오늘 목표인 ${student?.targetDailyMinutes}분 중 약 ${Math.round((stats.today / (student?.targetDailyMinutes || 360)) * 100)}%를 소화했습니다. 남은 시간 동안 집중력을 유지하도록 독려해 주세요.`}
                    {activeAnalysis === 'weekly' && "지난 7일간의 학습 곡선이 매우 안정적입니다. 특히 주 중반의 몰입도가 높게 나타나고 있습니다."}
                    {activeAnalysis === 'monthly' && "30일 장기 추세를 볼 때, 학습 시간이 점진적으로 우상향하고 있습니다. 성취 지표가 매우 긍정적입니다."}
                    {activeAnalysis === 'level' && "집중력과 회복력 스탯이 균형 있게 발달하고 있습니다. 부족한 꾸준함 영역을 보완하면 다음 레벨 진입이 빨라집니다."}
                    {activeAnalysis === 'rank' && "현재 시즌 리더보드에서 센터 상위권 수준의 퍼포먼스를 유지하고 있습니다. 평균 대비 약 15% 높은 성취도를 보입니다."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 bg-muted/10 border-t flex justify-end">
            <Button onClick={() => setActiveAnalysis(null)} className="rounded-2xl font-black h-14 px-12 shadow-xl active:scale-95 transition-all">분석 창 닫기</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 정보 수정 모달 */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="rounded-[2rem] sm:max-w-md border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tighter">학생 정보 수정</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-xs font-black uppercase text-primary/70">이름</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="rounded-xl" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-black uppercase text-primary/70">소속 학교</Label>
              <Input value={editForm.schoolName} onChange={(e) => setEditForm({...editForm, schoolName: e.target.value})} className="rounded-xl" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-black uppercase text-primary/70">학년</Label>
              <Select value={editForm.grade} onValueChange={(val) => setEditForm({...editForm, grade: val})}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1학년">1학년</SelectItem>
                  <SelectItem value="2학년">2학년</SelectItem>
                  <SelectItem value="3학년">3학년</SelectItem>
                  <SelectItem value="N수생">N수생</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 pt-2 border-t border-dashed">
              <Label className="text-xs font-black uppercase text-destructive flex items-center gap-1.5"><Lock className="h-3 w-3" /> 비밀번호 재설정</Label>
              <Input type="password" placeholder="새 비밀번호 입력 (공란 시 유지)" value={editForm.password} onChange={(e) => setEditForm({...editForm, password: e.target.value})} className="rounded-xl border-destructive/20" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateInfo} disabled={isUpdating} className="w-full rounded-2xl h-14 font-black shadow-lg">
              {isUpdating ? <Loader2 className="animate-spin" /> : "변경 내용 저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 상태 변경 모달 */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="rounded-[2rem] sm:max-w-md border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tighter">학생 상태 관리</DialogTitle>
            <DialogDescription className="font-bold">학생의 센터 소속 상태를 변경합니다.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
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
                    "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4",
                    statusForm === item.id ? "border-primary bg-white shadow-md scale-[1.02]" : "border-transparent bg-muted/10 hover:bg-muted/20"
                  )}
                >
                  <div className={cn("p-2 rounded-xl mt-0.5", statusForm === item.id ? "bg-primary text-white" : "bg-white text-muted-foreground")}>
                    {statusForm === item.id ? <Check className="h-4 w-4" /> : <div className="h-4 w-4" />}
                  </div>
                  <div className="grid gap-0.5">
                    <span className={cn("font-black text-lg", item.color)}>{item.label}</span>
                    <span className="text-xs font-bold text-muted-foreground">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateStatus} disabled={isUpdating} className="w-full rounded-2xl h-14 font-black shadow-lg">
              {isUpdating ? <Loader2 className="animate-spin" /> : "학생 상태 업데이트"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
