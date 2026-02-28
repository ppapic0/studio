'use client';

import { use, useState, useMemo, useEffect, useRef } from 'react';
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
  Activity,
  Check,
  CalendarPlus,
  FileEdit,
  MessageSquare,
  BarChart3,
  ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { StudentProfile, StudyLogDay, GrowthProgress, LeaderboardEntry, CenterMembership, CounselingLog } from '@/lib/types';
import { format, subDays, startOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  AreaChart, 
  Area
} from 'recharts';
import { cn } from '@/lib/utils';

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

function StatAnalysisCard({ title, value, subValue, icon: Icon, colorClass, onClick }: any) {
  return (
    <Card className="group cursor-pointer hover:shadow-xl transition-all border-none shadow-md overflow-hidden relative active:scale-95 bg-white" onClick={onClick}>
      <div className={cn("absolute top-0 left-0 w-1 h-full", colorClass.replace('text-', 'bg-'))} />
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-[10px] font-black text-muted-foreground uppercase">{title}</CardTitle>
        <div className={cn("p-2 rounded-xl bg-opacity-10", colorClass.replace('text-', 'bg-'))}>
          <Icon className={cn("h-4 w-4", colorClass)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-black tracking-tighter">{value}</div>
        <p className="text-[9px] font-bold text-muted-foreground mt-1">{subValue}</p>
      </CardContent>
    </Card>
  );
}

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = use(params);
  const { user: currentUser } = useUser();
  const { activeMembership } = useAppContext();
  const firestore = useFirestore();
  const functions = useFunctions();
  const { toast } = useToast();

  const centerId = activeMembership?.id;
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const hasInitializedForm = useRef(false);

  const [aptDate, setAptDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [aptTime, setAptTime] = useState('14:00');
  const [aptNote, setAptNote] = useState('');
  
  const [logType, setLogType] = useState<'academic' | 'life' | 'career'>('academic');
  const [logContent, setLogContent] = useState('');
  const [logImprovement, setLogImprovement] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    return query(collection(firestore, 'centers', centerId, 'leaderboards', `${periodKey}_completion`, 'entries'), where('studentId', '==', studentId));
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

  const appointments = useMemo(() => rawApts ? [...rawApts].sort((a, b) => b.scheduledAt?.toMillis() - a.scheduledAt?.toMillis()) : [], [rawApts]);
  const counselingLogs = useMemo(() => rawCounselLogs ? [...rawCounselLogs].sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()) : [], [rawCounselLogs]);
  const logs = useMemo(() => rawLogs ? [...rawLogs].sort((a, b) => b.dateKey.localeCompare(a.dateKey)) : [], [rawLogs]);

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

  const [activeAnalysis, setActiveAnalysis] = useState<'today' | 'weekly' | 'monthly' | 'level' | 'rank' | null>(null);
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
    }
  }, [student]);

  useEffect(() => {
    if (studentMembership) setStatusForm(studentMembership.status);
  }, [studentMembership]);

  const handleAddAppointment = async () => {
    if (!firestore || !centerId || !student || !currentUser) return;
    setIsSubmitting(true);
    try {
      const scheduledAt = new Date(`${aptDate}T${aptTime}`);
      await addDoc(collection(firestore, 'centers', centerId, 'counselingReservations'), {
        centerId, studentId, studentName: student.name, teacherId: currentUser.uid,
        teacherName: currentUser.displayName || '선생님', scheduledAt: Timestamp.fromDate(scheduledAt),
        status: 'confirmed', teacherNote: aptNote, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      toast({ title: "상담 예약 완료" });
      setAptNote('');
    } catch (e) { toast({ variant: "destructive", title: "예약 실패" }); } finally { setIsSubmitting(false); }
  };

  const handleAddCounselLog = async () => {
    if (!firestore || !centerId || !currentUser) return;
    if (!logContent.trim()) { toast({ variant: "destructive", title: "내용을 입력해주세요." }); return; }
    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'counselingLogs'), {
        studentId, teacherId: currentUser.uid, type: logType, content: logContent,
        improvement: logImprovement, createdAt: serverTimestamp(),
      });
      toast({ title: "상담 일지 기록 완료" });
      setLogContent(''); setLogImprovement('');
    } catch (e) { toast({ variant: "destructive", title: "기록 실패" }); } finally { setIsSubmitting(false); }
  };

  const handleUpdateInfo = async () => {
    if (!functions || !centerId || !studentId) return;
    
    // 유효성 검사
    if (!editForm.name.trim()) {
      toast({ variant: "destructive", title: "수정 실패", description: "이름은 필수 입력 항목입니다." });
      return;
    }

    setIsUpdating(true);
    try {
      const updateFn = httpsCallable(functions, 'updateStudentAccount');
      const result: any = await updateFn({
        studentId, 
        centerId, 
        displayName: editForm.name,
        schoolName: editForm.schoolName, 
        grade: editForm.grade, 
        password: editForm.password.length >= 6 ? editForm.password : undefined,
        parentLinkCode: editForm.parentLinkCode.trim() || null
      });

      if (result.data?.ok) {
        toast({ title: "정보 수정 완료", description: "학생의 모든 정보가 안전하게 업데이트되었습니다." });
        setIsEditModalOpen(false);
      }
    } catch (e: any) {
      console.error("[handleUpdateInfo Error]", e);
      toast({ 
        variant: "destructive", 
        title: "수정 실패", 
        description: e.message || "서버 통신 중 오류가 발생했습니다." 
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!firestore || !centerId || !studentId) return;
    setIsUpdating(true);
    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'centers', centerId, 'members', studentId), { status: statusForm, updatedAt: serverTimestamp() });
      batch.update(doc(firestore, 'userCenters', studentId, 'centers', centerId), { status: statusForm, updatedAt: serverTimestamp() });
      await batch.commit();
      toast({ title: "학생 상태 변경 완료" });
      setIsStatusModalOpen(false);
    } catch (e: any) { toast({ variant: "destructive", title: "상태 변경 실패", description: e.message }); } finally { setIsUpdating(false); }
  };

  if (studentLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" className="rounded-full h-12 w-12" asChild><Link href="/dashboard/teacher/students"><ArrowLeft className="h-6 w-6" /></Link></Button>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black tracking-tighter">{student?.name} 학생</h1>
              <Badge className="bg-primary text-white px-3 py-1 rounded-full font-black text-xs">{student?.seatNo || '미배정'}번 좌석</Badge>
            </div>
            <div className="flex wrap items-center gap-3 text-sm text-muted-foreground font-bold">
              <span className="flex items-center gap-1.5 text-primary"><Building2 className="h-4 w-4" /> {student?.schoolName}</span>
              <span className="opacity-30">|</span>
              <span>{student?.grade}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-2xl font-black h-12 px-6 shadow-sm gap-2" onClick={() => setIsEditModalOpen(true)}><Settings2 className="h-4 w-4" /> 정보 수정</Button>
          <Button className="rounded-2xl font-black h-12 px-6 shadow-lg gap-2" onClick={() => setIsStatusModalOpen(true)}><UserCheck className="h-4 w-4" /> 상태 변경</Button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatAnalysisCard title="오늘 공부 시간" value={`${Math.floor(stats.today / 60)}h ${stats.today % 60}m`} subValue="목표 달성 트래킹" icon={Clock} colorClass="text-emerald-500" onClick={() => setActiveAnalysis('today')} />
        <StatAnalysisCard title="주간 평균" value={`${Math.floor(stats.weeklyAvg / 60)}h ${stats.weeklyAvg % 60}m`} subValue="최근 학습 리듬" icon={TrendingUp} colorClass="text-blue-500" onClick={() => setActiveAnalysis('weekly')} />
        <StatAnalysisCard title="월간 평균" value={`${Math.floor(stats.monthlyAvg / 60)}h ${stats.monthlyAvg % 60}m`} subValue="장기 집중도 분석" icon={CalendarDays} colorClass="text-amber-500" onClick={() => setActiveAnalysis('monthly')} />
        <StatAnalysisCard title="마스터리 레벨" value={`Lv.${progress?.level || 1}`} subValue="성장 능력치 분석" icon={Zap} colorClass="text-purple-500" onClick={() => setActiveAnalysis('level')} />
        <StatAnalysisCard title="시즌 랭킹" value={rankEntry?.[0]?.rank ? `${rankEntry[0].rank}위` : '순위 밖'} subValue="센터 내 상대 위치" icon={Trophy} colorClass="text-rose-500" onClick={() => setActiveAnalysis('rank')} />
      </section>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-[2rem] h-16 p-1.5 bg-muted/30 border border-border/50 shadow-inner">
          <TabsTrigger value="overview" className="rounded-2xl font-black data-[state=active]:bg-white data-[state=active]:shadow-lg">학습 리포트</TabsTrigger>
          <TabsTrigger value="plans" className="rounded-2xl font-black data-[state=active]:bg-white data-[state=active]:shadow-lg">공부 계획</TabsTrigger>
          <TabsTrigger value="counseling" className="rounded-2xl font-black data-[state=active]:bg-white data-[state=active]:shadow-lg">상담 관리</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-8">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
            <CardHeader className="bg-muted/10 p-8 border-b transition-colors">
              <CardTitle className="text-xl font-black flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> 최근 30일 학습 몰입 히스토리</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="colorH" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" fontSize={10} fontWeight="900" axisLine={false} tickLine={false} />
                    <YAxis fontSize={10} fontWeight="900" axisLine={false} tickLine={false} unit="h" />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorH)" animationDuration={1500} />
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
                <CardTitle className="flex items-center gap-2 text-xl font-black text-blue-700"><CalendarPlus className="h-5 w-5" /> 새 상담 예약</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">예약 날짜</Label><Input type="date" value={aptDate} onChange={(e) => setAptDate(e.target.value)} className="rounded-xl h-12" /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground">예약 시간</Label><Input type="time" value={aptTime} onChange={(e) => setAptTime(e.target.value)} className="rounded-xl h-12" /></div>
                </div>
                <Input placeholder="상담 주제 / 메모" value={aptNote} onChange={(e) => setAptNote(e.target.value)} className="rounded-xl h-12" />
                <Button onClick={handleAddAppointment} disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black bg-blue-600 hover:bg-blue-700 shadow-xl">예약 확정하기</Button>
              </CardContent>
            </Card>
            <Card className="rounded-[2.5rem] border-none shadow-lg bg-white overflow-hidden ring-1 ring-border/50">
              <CardHeader className="bg-emerald-50/50 border-b pb-6">
                <CardTitle className="flex items-center gap-2 text-xl font-black text-emerald-700"><FileEdit className="h-5 w-5" /> 상담 일지 작성</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-5">
                <Select value={logType} onValueChange={(val: any) => setLogType(val)}><SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="academic">학업/성적</SelectItem><SelectItem value="life">생활 습관</SelectItem><SelectItem value="career">진로/진학</SelectItem></SelectContent></Select>
                <Textarea placeholder="상담한 핵심 내용을 상세히 기록해 주세요." value={logContent} onChange={(e) => setLogContent(e.target.value)} className="rounded-xl min-h-[120px]" />
                <Input placeholder="개선 권고 사항 (학생 과제)" value={logImprovement} onChange={(e) => setLogImprovement(e.target.value)} className="rounded-xl h-12" />
                <Button onClick={handleAddCounselLog} disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black bg-emerald-600 hover:bg-emerald-700 shadow-xl">상담 일지 저장</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* 정보 수정 모달 */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black tracking-tighter">학생 정보 수정</DialogTitle>
            <DialogDescription className="font-bold text-muted-foreground mt-1">학업 기본 정보 및 연동 코드를 업데이트합니다.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-6">
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase text-primary/70">이름</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="rounded-xl h-12 border-2" />
            </div>
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase text-primary/70">소속 학교</Label>
              <Input value={editForm.schoolName} onChange={(e) => setEditForm({...editForm, schoolName: e.target.value})} className="rounded-xl h-12 border-2" />
            </div>
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase text-primary/70">학년</Label>
              <Select value={editForm.grade} onValueChange={(val) => setEditForm({...editForm, grade: val})}>
                <SelectTrigger className="rounded-xl h-12 border-2"><SelectValue /></SelectTrigger>
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
                className="rounded-xl h-12 border-2 font-black tracking-[0.5em] text-center" 
              />
              <p className="text-[9px] font-bold text-muted-foreground">부모님이 가입할 때 필요한 코드입니다. 학생에게 전달해 주세요.</p>
            </div>
            <div className="grid gap-2 pt-4 border-t border-dashed">
              <Label className="text-[10px] font-black uppercase text-destructive flex items-center gap-1.5 ml-1"><Lock className="h-3 w-3" /> 비밀번호 재설정</Label>
              <Input type="password" placeholder="새 비밀번호 입력 (6자 이상)" value={editForm.password} onChange={(e) => setEditForm({...editForm, password: e.target.value})} className="rounded-xl h-12 border-destructive/20 focus-visible:ring-destructive/10" />
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
          <DialogHeader><DialogTitle className="text-3xl font-black tracking-tighter">학생 상태 관리</DialogTitle></DialogHeader>
          <div className="py-8 space-y-4">
            <div className="grid gap-3">
              {[
                { id: 'active', label: '재원생', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { id: 'onHold', label: '휴학생', color: 'text-amber-600', bg: 'bg-amber-50' },
                { id: 'withdrawn', label: '퇴원생', color: 'text-muted-foreground', bg: 'bg-muted/30' },
              ].map((item) => (
                <div key={item.id} onClick={() => setStatusForm(item.id)} className={cn("p-5 rounded-3xl border-2 transition-all cursor-pointer flex items-center gap-4", statusForm === item.id ? "border-primary bg-white shadow-xl scale-[1.03]" : "border-transparent bg-muted/10")}>
                  <div className={cn("p-2 rounded-2xl", statusForm === item.id ? "bg-primary text-white" : "bg-white")}>{statusForm === item.id && <Check className="h-5 w-5" />}</div>
                  <span className={cn("font-black text-xl", item.color)}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdateStatus} disabled={isUpdating} className="w-full rounded-2xl h-14 font-black shadow-xl text-lg">{isUpdating ? <Loader2 className="animate-spin" /> : "학생 상태 업데이트 완료"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
