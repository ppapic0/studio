
'use client';

import { use, useState, useMemo, useEffect } from 'react';
import { useDoc, useCollection, useFirestore, useFunctions } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc, collection, query, where, addDoc, serverTimestamp, getDocs, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Send,
  History,
  Zap,
  Clock,
  Trophy,
  BarChart3,
  CalendarDays,
  Target,
  ChevronRight,
  Settings2,
  UserCheck,
  UserX,
  Lock,
  Sparkles,
  MousePointer2,
  Info
} from 'lucide-react';
import Link from 'next/link';
import { StudentProfile, CounselingLog, StudyLogDay, GrowthProgress, LeaderboardEntry, CenterMembership } from '@/lib/types';
import { format, subDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, BarChart, Bar, Cell, ResponsiveContainer as ReChartsResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

// 커스텀 툴팁 컴포넌트
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/80 backdrop-blur-md border border-white/40 p-4 rounded-2xl shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in duration-200">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{label} 기록</p>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-primary tracking-tighter">{payload[0].value}</span>
          <span className="text-xs font-bold text-muted-foreground">시간</span>
        </div>
        <div className="mt-2 pt-2 border-t border-black/5 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-bold text-emerald-600">안정적인 학습 페이스</span>
        </div>
      </div>
    );
  }
  return null;
};

// 통계 카드 컴포넌트
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

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = use(params);
  const { activeMembership } = useAppContext();
  const firestore = useFirestore();
  const functions = useFunctions();
  const { toast } = useToast();

  const centerId = activeMembership?.id;
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  // --- 데이터 조회 섹션 ---
  const studentRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId, 'students', studentId);
  }, [firestore, centerId, studentId]);
  const { data: student, isLoading: studentLoading } = useDoc<StudentProfile>(studentRef);

  const memberRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId, 'members', studentId);
  }, [firestore, centerId, studentId]);
  const { data: membership } = useDoc<CenterMembership>(memberRef);

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

  const counselingQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'counselingLogs'),
      where('studentId', '==', studentId)
    );
  }, [firestore, centerId, studentId]);
  const { data: rawCounselingLogs } = useCollection<CounselingLog>(counselingQuery);

  // --- 클라이언트 측 정렬 및 통계 계산 ---
  const logs = useMemo(() => {
    if (!rawLogs) return [];
    return [...rawLogs].sort((a, b) => b.dateKey.localeCompare(a.dateKey)).slice(0, 30);
  }, [rawLogs]);

  const counselingLogs = useMemo(() => {
    if (!rawCounselingLogs) return [];
    return [...rawCounselingLogs].sort((a, b) => {
      const timeA = a.createdAt?.toMillis() || 0;
      const timeB = b.createdAt?.toMillis() || 0;
      return timeB - timeA;
    });
  }, [rawCounselingLogs]);

  const stats = useMemo(() => {
    if (logs.length === 0) return { today: 0, weeklyAvg: 0, monthlyAvg: 0, chartData: [] };
    const todayLog = logs.find(l => l.dateKey === todayKey);
    const sevenDaysAgo = subDays(new Date(), 7);
    const weeklyLogs = logs.filter(l => new Date(l.dateKey) >= sevenDaysAgo);
    const weeklyAvg = weeklyLogs.length > 0 ? Math.round(weeklyLogs.reduce((acc, c) => acc + c.totalMinutes, 0) / 7) : 0;
    const monthlyAvg = Math.round(logs.reduce((acc, c) => acc + c.totalMinutes, 0) / logs.length);
    
    const chartData = [...logs].reverse().map(l => ({
      name: format(new Date(l.dateKey), 'MM/dd'),
      hours: Number((l.totalMinutes / 60).toFixed(1))
    }));
    return { today: todayLog?.totalMinutes || 0, weeklyAvg, monthlyAvg, chartData };
  }, [logs, todayKey]);

  // --- 정보 수정 및 상태 변경 상태 ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', schoolName: '', grade: '', password: '' });
  const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null);

  useEffect(() => {
    if (student) {
      setEditForm({ name: student.name, schoolName: student.schoolName, grade: student.grade, password: '' });
    }
  }, [student]);

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
        toast({ title: "정보 수정 완료", description: "학생의 프로필과 계정 정보가 업데이트되었습니다." });
        setIsEditModalOpen(false);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "수정 실패", description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!firestore || !centerId || !studentId) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'members', studentId), { status, updatedAt: serverTimestamp() });
      await updateDoc(doc(firestore, 'userCenters', studentId, 'centers', centerId), { status, updatedAt: serverTimestamp() });
      toast({ title: "상태 변경 완료", description: `학생의 상태가 변경되었습니다.` });
      setIsStatusModalOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "변경 실패", description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'active': return '재원생';
      case 'onHold': return '휴학생';
      case 'withdrawn': return '퇴원생';
      default: return '정보 없음';
    }
  };

  if (studentLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 hover:bg-primary/5" asChild>
            <Link href="/dashboard/teacher/students"><ArrowLeft className="h-6 w-6" /></Link>
          </Button>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black tracking-tighter">{student?.name} 학생</h1>
              <Badge className="bg-primary text-white px-3 py-1 rounded-full font-black text-xs">{student?.seatNo || '미배정'}번 좌석</Badge>
              <Badge variant="outline" className="font-black text-[10px] uppercase border-2">{getStatusLabel(membership?.status)}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground font-bold">
              <span className="flex items-center gap-1.5 text-primary"><Building2 className="h-4 w-4" /> {student?.schoolName}</span>
              <span className="opacity-30">|</span>
              <span>{student?.grade}</span>
              <span className="opacity-30">|</span>
              <span className="flex items-center gap-1.5"><Target className="h-4 w-4 text-emerald-500" /> 일일 목표 {student?.targetDailyMinutes}분</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-xl font-bold h-12 px-6 shadow-sm gap-2"><Settings2 className="h-4 w-4" /> 정보 수정</Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2rem] sm:max-w-md border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tighter">학생 정보 수정</DialogTitle>
                <DialogDescription className="font-bold">이름, 학교, 학년 및 계정 비밀번호를 변경합니다.</DialogDescription>
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
                  <p className="text-[10px] font-bold text-muted-foreground">※ 비밀번호를 입력하면 해당 학생의 접속 비밀번호가 즉시 변경됩니다.</p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleUpdateInfo} disabled={isUpdating} className="w-full rounded-2xl h-14 font-black shadow-lg">
                  {isUpdating ? <Loader2 className="animate-spin" /> : "변경 내용 저장"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl font-bold h-12 px-6 shadow-lg gap-2"><UserCheck className="h-4 w-4" /> 상태 변경</Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] sm:max-w-sm border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tighter">학생 상태 관리</DialogTitle>
                <DialogDescription className="font-bold">학생의 센터 등록 상태를 변경합니다.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-6">
                <Button variant={membership?.status === 'active' ? 'default' : 'outline'} onClick={() => handleUpdateStatus('active')} className="rounded-2xl h-16 justify-between px-6 font-black group">
                  <span className="flex items-center gap-3"><UserCheck className="h-5 w-5" /> 재원생</span>
                  {membership?.status === 'active' && <Zap className="h-4 w-4 fill-current text-amber-400" />}
                </Button>
                <Button variant={membership?.status === 'onHold' ? 'default' : 'outline'} onClick={() => handleUpdateStatus('onHold')} className="rounded-2xl h-16 justify-between px-6 font-black">
                  <span className="flex items-center gap-3"><Clock className="h-5 w-5" /> 휴학생</span>
                </Button>
                <Button variant={membership?.status === 'withdrawn' ? 'destructive' : 'outline'} onClick={() => handleUpdateStatus('withdrawn')} className="rounded-2xl h-16 justify-between px-6 font-black hover:bg-destructive hover:text-white">
                  <span className="flex items-center gap-3"><UserX className="h-5 w-5" /> 퇴원생</span>
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatAnalysisCard title="오늘 공부 시간" value={`${Math.floor(stats.today / 60)}시간 ${stats.today % 60}분`} subValue={`목표 대비 ${Math.round((stats.today / (student?.targetDailyMinutes || 360)) * 100)}% 달성`} icon={Clock} colorClass="text-emerald-500" onClick={() => setActiveAnalysis('today')} />
        <StatAnalysisCard title="주간 평균 (7일)" value={`${Math.floor(stats.weeklyAvg / 60)}시간 ${stats.weeklyAvg % 60}분`} subValue="최근 학습 안정성 지표" icon={TrendingUp} colorClass="text-blue-500" onClick={() => setActiveAnalysis('weekly')} />
        <StatAnalysisCard title="월간 평균 (30일)" value={`${Math.floor(stats.monthlyAvg / 60)}시간 ${stats.monthlyAvg % 60}분`} subValue="장기 집중도 분석" icon={CalendarDays} colorClass="text-amber-500" onClick={() => setActiveAnalysis('monthly')} />
        <StatAnalysisCard title="마스터리 레벨" value={`Lv.${progress?.level || 1}`} subValue={`상위 ${(100 - (progress?.level || 1) * 2).toFixed(1)}%의 숙련도`} icon={Zap} colorClass="text-purple-500" onClick={() => setActiveAnalysis('level')} />
        <StatAnalysisCard title="시즌 랭킹" value={rankEntry?.[0]?.rank ? `${rankEntry[0].rank}위` : '순위 밖'} subValue={`${format(new Date(), 'M월')} 시즌 진행 현황`} icon={Trophy} colorClass="text-rose-500" onClick={() => setActiveAnalysis('rank')} />
      </section>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-[1.5rem] h-16 p-1.5 bg-muted/30 border border-border/50 shadow-inner">
          <TabsTrigger value="overview" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all text-sm"><BarChart3 className="h-4 w-4 mr-2" /> 학습 리포트</TabsTrigger>
          <TabsTrigger value="plans" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all text-sm"><History className="h-4 w-4 mr-2" /> 공부 계획</TabsTrigger>
          <TabsTrigger value="counseling" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all text-sm"><Send className="h-4 w-4 mr-2" /> 상담 및 피드백</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-8 space-y-8">
          <div className="grid gap-8 lg:grid-cols-12">
            <Card className="lg:col-span-8 rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
              <CardHeader className="bg-muted/10 p-8 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-black">학습 몰입 추이 (최근 30회 기록)</CardTitle>
                    <CardDescription className="font-bold">일별 학습 시간의 변화를 분석합니다.</CardDescription>
                  </div>
                  <div className="bg-primary/5 px-4 py-2 rounded-xl text-primary font-black text-sm border border-primary/10">평균 {Math.floor(stats.monthlyAvg / 60)}h {stats.monthlyAvg % 60}m</div>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.chartData}>
                      <defs><linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} unit="h" />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                      <Area type="monotone" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorMinutes)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="lg:col-span-4 flex flex-col gap-6">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-primary text-primary-foreground overflow-hidden">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-black flex items-center gap-2"><Send className="h-5 w-5" /> 학부모 데일리 리포트</CardTitle>
                  <CardDescription className="text-primary-foreground/60 font-bold">오늘의 피드백을 즉시 발송합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea placeholder="오늘의 특이사항을 입력하세요..." className="min-h-[120px] rounded-2xl p-4 text-sm font-medium bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:ring-white/30" />
                  <Button className="w-full rounded-xl font-black bg-white text-primary hover:bg-white/90 h-12 shadow-lg">리포트 발송하기</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="counseling" className="mt-8 grid gap-8 md:grid-cols-2">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white ring-1 ring-border/50 flex flex-col">
            <CardHeader className="p-8 pb-4"><CardTitle className="text-xl font-black">상담 히스토리</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-y-auto max-h-[500px] custom-scrollbar">
              {counselingLogs.length === 0 ? (
                <div className="py-20 text-center opacity-30 italic font-black text-sm">상담 내역이 없습니다.</div>
              ) : (
                <div className="divide-y">
                  {counselingLogs.map(log => (
                    <div key={log.id} className="p-6 space-y-2">
                      <div className="flex justify-between items-center">
                        <Badge variant="outline" className="text-[9px] font-black uppercase">{log.type}</Badge>
                        <span className="text-[10px] font-bold text-muted-foreground">{log.createdAt ? format(log.createdAt.toDate(), 'yyyy.MM.dd') : ''}</span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed">{log.content}</p>
                      {log.improvement && <div className="bg-emerald-50 p-2 rounded-lg text-[11px] font-bold text-emerald-700">과제: {log.improvement}</div>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 분석 다이얼로그 - 고급 막대 그래프 디자인 적용 */}
      <Dialog open={!!activeAnalysis} onOpenChange={(open) => !open && setActiveAnalysis(null)}>
        <DialogContent className="sm:max-w-3xl rounded-[3rem] border-none shadow-[0_30px_100px_rgba(0,0,0,0.3)] p-0 overflow-hidden transform-gpu transition-all">
          <div className="bg-primary p-8 sm:p-12 text-primary-foreground relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-[0.03] rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent opacity-[0.05] rounded-full -ml-10 -mb-10 blur-2xl pointer-events-none" />
            
            <DialogHeader className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-white/10 backdrop-blur-xl p-2.5 rounded-2xl border border-white/10 shadow-inner">
                  <Sparkles className="h-6 w-6 text-amber-400 fill-amber-400" />
                </div>
                <Badge className="bg-white/20 hover:bg-white/30 text-white border-none font-black text-[10px] tracking-widest uppercase py-1">Deep Data Analysis</Badge>
              </div>
              <DialogTitle className="text-4xl sm:text-5xl font-black tracking-tighter mb-2 leading-none">학습 심층 분석 리포트</DialogTitle>
              <DialogDescription className="text-primary-foreground/70 font-bold text-lg max-w-md leading-relaxed">
                데이터로 증명되는 {student?.name} 학생의 최근 학습 몰입도와 성취 지표입니다.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-8 sm:p-12 bg-white flex flex-col gap-10">
            <div className="h-[350px] w-full group/chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData.slice(-14)} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                    </linearGradient>
                    <filter id="barShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
                      <feOffset dx="0" dy="4" result="offsetblur" />
                      <feComponentTransfer>
                        <feFuncA type="linear" slope="0.2" />
                      </feComponentTransfer>
                      <feMerge>
                        <feMergeNode />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                  <XAxis 
                    dataKey="name" 
                    fontSize={11} 
                    fontWeight="900" 
                    axisLine={false} 
                    tickLine={false} 
                    dy={15}
                    tick={{ fill: 'rgba(0,0,0,0.4)' }}
                  />
                  <YAxis 
                    fontSize={11} 
                    fontWeight="900" 
                    axisLine={false} 
                    tickLine={false} 
                    unit="h"
                    tick={{ fill: 'rgba(0,0,0,0.4)' }}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.02)', radius: 12 }} 
                    content={<CustomTooltip />}
                  />
                  <Bar 
                    dataKey="hours" 
                    radius={[10, 10, 0, 0]} 
                    barSize={32}
                    animationDuration={1500}
                    animationBegin={200}
                  >
                    {stats.chartData.slice(-14).map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill="url(#barGradient)" 
                        filter="url(#barShadow)"
                        className="transition-all duration-500 hover:opacity-80"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 pt-4 border-t border-dashed border-muted-foreground/20">
              <div className="flex items-start gap-4 p-5 rounded-3xl bg-muted/20 hover:bg-primary/5 transition-colors duration-300">
                <div className="bg-primary/10 p-2.5 rounded-2xl">
                  <MousePointer2 className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-widest text-primary/70">데이터 인사이트</h4>
                  <p className="text-sm font-bold text-muted-foreground leading-relaxed">
                    지난 14일간의 평균 학습량은 <span className="text-primary font-black">{(stats.chartData.slice(-14).reduce((acc, c) => acc + c.hours, 0) / 14).toFixed(1)}시간</span>입니다. 상위권 도약을 위한 안정적인 구간입니다.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-5 rounded-3xl bg-emerald-50 hover:bg-emerald-100/50 transition-colors duration-300">
                <div className="bg-emerald-500/10 p-2.5 rounded-2xl">
                  <Target className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-widest text-emerald-600/70">다음 목표 권장</h4>
                  <p className="text-sm font-bold text-muted-foreground leading-relaxed">
                    주간 평균 <span className="text-emerald-600 font-black">{(stats.weeklyAvg / 60 + 0.5).toFixed(1)}시간</span> 몰입을 달성하면 시즌 랭킹이 대폭 상승할 것으로 예상됩니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 bg-muted/10 border-t flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground italic">
              <Info className="h-4 w-4 text-primary opacity-50" />
              모든 데이터는 실시간 학습 로그를 기반으로 자동 생성되었습니다.
            </div>
            <Button 
              onClick={() => setActiveAnalysis(null)} 
              className="w-full sm:w-auto rounded-2xl font-black h-14 px-12 shadow-xl hover:scale-105 active:scale-95 transition-all text-base"
            >
              분석 창 닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
