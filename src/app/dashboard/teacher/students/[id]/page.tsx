
'use client';

import { use, useState, useMemo } from 'react';
import { useDoc, useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc, collection, query, where, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
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
  DialogDescription,
} from "@/components/ui/dialog";
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
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { StudentProfile, StudyPlan, CounselingLog, ParentFeedbackDraft, StudyLogDay, GrowthProgress, LeaderboardEntry } from '@/lib/types';
import { format, subDays, startOfDay, isWithinInterval } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts';
import { cn } from '@/lib/utils';

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
      className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-none shadow-md overflow-hidden relative active:scale-95"
      onClick={onClick}
    >
      <div className={cn("absolute top-0 left-0 w-1 h-full", colorClass.replace('text-', 'bg-'))} />
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-black text-muted-foreground uppercase tracking-widest">{title}</CardTitle>
        <Icon className={cn("h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity", colorClass)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-black tracking-tighter">{value}</div>
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
  const { toast } = useToast();

  const centerId = activeMembership?.id;
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  // --- 데이터 조회 섹션 ---

  // 1. 학생 기본 정보
  const studentRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId, 'students', studentId);
  }, [firestore, centerId, studentId]);
  const { data: student, isLoading: studentLoading } = useDoc<StudentProfile>(studentRef);

  // 2. 학습 로그 (최근 30일치 통계용)
  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days'),
      orderBy('dateKey', 'desc'),
      limit(30)
    );
  }, [firestore, centerId, studentId]);
  const { data: logs, isLoading: logsLoading } = useCollection<StudyLogDay>(logsQuery);

  // 3. 성장 로드맵 (레벨용)
  const progressRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId, 'growthProgress', studentId);
  }, [firestore, centerId, studentId]);
  const { data: progress } = useDoc<GrowthProgress>(progressRef);

  // 4. 랭킹 정보 (간소화된 조회)
  const rankingQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    const periodKey = format(new Date(), 'yyyy-MM');
    return query(
      collection(firestore, 'centers', centerId, 'leaderboards', periodKey, 'monthlyCompletion', 'entries'),
      where('studentId', '==', studentId)
    );
  }, [firestore, centerId, studentId]);
  const { data: rankEntry } = useCollection<LeaderboardEntry>(rankingQuery);

  // 5. 상담 기록
  const counselingQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'counselingLogs'),
      where('studentId', '==', studentId)
    );
  }, [firestore, centerId, studentId]);
  const { data: counselingLogs } = useCollection<CounselingLog>(counselingQuery);

  // --- 통계 계산 로직 ---

  const stats = useMemo(() => {
    if (!logs) return { today: 0, weeklyAvg: 0, monthlyAvg: 0, chartData: [] };
    
    const todayLog = logs.find(l => l.dateKey === todayKey);
    const todayVal = todayLog?.totalMinutes || 0;

    const sevenDaysAgo = subDays(new Date(), 7);
    const weeklyLogs = logs.filter(l => new Date(l.dateKey) >= sevenDaysAgo);
    const weeklyAvg = weeklyLogs.length > 0 
      ? Math.round(weeklyLogs.reduce((acc, curr) => acc + curr.totalMinutes, 0) / 7)
      : 0;

    const monthlyAvg = logs.length > 0
      ? Math.round(logs.reduce((acc, curr) => acc + curr.totalMinutes, 0) / logs.length)
      : 0;

    // 그래프용 데이터 (날짜 오름차순)
    const chartData = [...logs].reverse().map(l => ({
      name: format(new Date(l.dateKey), 'MM/dd'),
      minutes: l.totalMinutes,
      hours: Number((l.totalMinutes / 60).toFixed(1))
    }));

    return { today: todayVal, weeklyAvg, monthlyAvg, chartData };
  }, [logs, todayKey]);

  // --- UI 상태 ---
  const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null);
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [logForm, setLogForm] = useState({ content: '', improvement: '', type: 'academic' as CounselingLog['type'] });

  const handleAddLog = async () => {
    if (!firestore || !centerId || !activeMembership || !logForm.content) return;
    setIsSubmittingLog(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'counselingLogs'), {
        studentId,
        teacherId: activeMembership.id,
        type: logForm.type,
        content: logForm.content,
        improvement: logForm.improvement,
        createdAt: serverTimestamp(),
      });
      toast({ title: "상담 일지가 저장되었습니다." });
      setLogForm({ content: '', improvement: '', type: 'academic' });
    } catch (e) {
      toast({ variant: "destructive", title: "저장 실패" });
    } finally {
      setIsSubmittingLog(false);
    }
  };

  if (studentLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto pb-20">
      {/* 헤더 섹션 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 hover:bg-primary/5" asChild>
            <Link href="/dashboard/teacher/students">
              <ArrowLeft className="h-6 w-6" />
            </Link>
          </Button>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black tracking-tighter">{student?.name} 학생</h1>
              <Badge className="bg-primary text-white px-3 py-1 rounded-full font-black text-xs">
                {student?.seatNo || '미배정'}번 좌석
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground font-bold">
              <span className="flex items-center gap-1.5 text-primary">
                <Building2 className="h-4 w-4" /> {student?.schoolName}
              </span>
              <span className="opacity-30">|</span>
              <span>{student?.grade}</span>
              <span className="opacity-30">|</span>
              <span className="flex items-center gap-1.5">
                <Target className="h-4 w-4 text-emerald-500" /> 일일 목표 {student?.targetDailyMinutes}분
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl font-bold h-12 px-6 shadow-sm">정보 수정</Button>
          <Button className="rounded-xl font-bold h-12 px-6 shadow-lg">상태 변경</Button>
        </div>
      </div>

      {/* 통계 요약 섹션 */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatAnalysisCard 
          title="오늘 공부 시간"
          value={`${Math.floor(stats.today / 60)}시간 ${stats.today % 60}분`}
          subValue={`목표 대비 ${Math.round((stats.today / (student?.targetDailyMinutes || 360)) * 100)}% 달성`}
          icon={Clock}
          colorClass="text-emerald-500"
          onClick={() => setActiveAnalysis('today')}
        />
        <StatAnalysisCard 
          title="주간 평균 (7일)"
          value={`${Math.floor(stats.weeklyAvg / 60)}시간 ${stats.weeklyAvg % 60}분`}
          subValue="최근 학습 안정성 지표"
          icon={TrendingUp}
          colorClass="text-blue-500"
          onClick={() => setActiveAnalysis('weekly')}
        />
        <StatAnalysisCard 
          title="월간 평균 (30일)"
          value={`${Math.floor(stats.monthlyAvg / 60)}시간 ${stats.monthlyAvg % 60}분`}
          subValue="장기 집중도 분석"
          icon={CalendarDays}
          colorClass="text-amber-500"
          onClick={() => setActiveAnalysis('monthly')}
        />
        <StatAnalysisCard 
          title="마스터리 레벨"
          value={`Lv.${progress?.level || 1}`}
          subValue={`상위 ${(100 - (progress?.level || 1) * 2).toFixed(1)}%의 숙련도`}
          icon={Zap}
          colorClass="text-purple-500"
          onClick={() => setActiveAnalysis('level')}
        />
        <StatAnalysisCard 
          title="시즌 랭킹"
          value={rankEntry?.[0]?.rank ? `${rankEntry[0].rank}위` : '순위 밖'}
          subValue={`${format(new Date(), 'M월')} 시즌 진행 현황`}
          icon={Trophy}
          colorClass="text-rose-500"
          onClick={() => setActiveAnalysis('rank')}
        />
      </section>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-[1.5rem] h-16 p-1.5 bg-muted/30 border border-border/50 shadow-inner">
          <TabsTrigger value="overview" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all text-sm">
            <BarChart3 className="h-4 w-4 mr-2" /> 학습 리포트
          </TabsTrigger>
          <TabsTrigger value="plans" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all text-sm">
            <History className="h-4 w-4 mr-2" /> 공부 계획
          </TabsTrigger>
          <TabsTrigger value="counseling" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all text-sm">
            <Send className="h-4 w-4 mr-2" /> 상담 및 피드백
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-8 space-y-8">
          <div className="grid gap-8 lg:grid-cols-12">
            {/* 최근 학습 추이 그래프 */}
            <Card className="lg:col-span-8 rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
              <CardHeader className="bg-muted/10 p-8 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-black">학습 몰입 추이 (최근 30회 기록)</CardTitle>
                    <CardDescription className="font-bold">일별 학습 시간의 변화를 분석합니다.</CardDescription>
                  </div>
                  <div className="bg-primary/5 px-4 py-2 rounded-xl text-primary font-black text-sm border border-primary/10">
                    평균 {Math.floor(stats.monthlyAvg / 60)}h {stats.monthlyAvg % 60}m
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.chartData}>
                      <defs>
                        <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} unit="h" />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                        labelStyle={{ fontWeight: 'black', marginBottom: '4px' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="hours" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={4} 
                        fillOpacity={1} 
                        fill="url(#colorMinutes)" 
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 오늘의 학습 활동 */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-primary text-primary-foreground overflow-hidden">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-black flex items-center gap-2">
                    <Send className="h-5 w-5" /> 학부모 데일리 리포트
                  </CardTitle>
                  <CardDescription className="text-primary-foreground/60 font-bold">오늘의 피드백을 즉시 발송합니다.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea 
                    placeholder="오늘의 특이사항을 입력하세요..." 
                    className="min-h-[120px] rounded-2xl p-4 text-sm font-medium bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:ring-white/30"
                  />
                  <Button className="w-full rounded-xl font-black bg-white text-primary hover:bg-white/90 h-12 shadow-lg">
                    리포트 발송하기
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-[2.5rem] border-none shadow-lg bg-white overflow-hidden flex-1 ring-1 ring-border/50">
                <CardHeader>
                  <CardTitle className="text-base font-black flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" /> 최근 학습 기록
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/50 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {logs?.slice(0, 5).map(log => (
                      <div key={log.id} className="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                        <span className="text-xs font-bold text-muted-foreground">{format(new Date(log.dateKey), 'MM.dd (EEE)')}</span>
                        <span className="text-sm font-black text-primary">{Math.floor(log.totalMinutes / 60)}h {log.totalMinutes % 60}m</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="plans" className="mt-8">
          <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden ring-1 ring-border/50 bg-white">
            <CardHeader className="bg-muted/10 border-b p-8 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black">진행 중인 학습 계획</CardTitle>
                <CardDescription className="font-bold">과목별 목표 달성률을 실시간으로 확인합니다.</CardDescription>
              </div>
              <Button size="sm" className="rounded-xl font-black h-10 px-5 shadow-lg">새 계획 추가</Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-8 flex items-center justify-between group hover:bg-muted/10 transition-all cursor-pointer">
                    <div className="grid gap-1">
                      <span className="text-lg font-black group-hover:text-primary transition-colors">수학 심화 - 미적분</span>
                      <span className="text-xs text-muted-foreground font-bold">03.01 ~ 03.15 · 쎈 C단계 정복</span>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <div className="text-sm font-black text-primary">1,240분</div>
                        <div className="text-[10px] text-muted-foreground font-bold">목표 2,000분 (62%)</div>
                      </div>
                      <div className="h-12 w-12 rounded-full border-4 border-muted flex items-center justify-center text-[10px] font-black relative overflow-hidden">
                        <div className="absolute bottom-0 left-0 w-full bg-emerald-500/20 h-[62%]" />
                        62%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="counseling" className="mt-8 grid gap-8 md:grid-cols-2">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white ring-1 ring-border/50">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-xl font-black">새 상담 일지 작성</CardTitle>
              <CardDescription className="font-bold">학생과의 면담 내용을 상세히 기록하세요.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
              <div className="grid gap-3">
                <Label className="text-xs font-black uppercase text-primary/70 tracking-widest">상담 유형</Label>
                <div className="flex flex-wrap gap-2">
                  {(['academic', 'life', 'career'] as const).map(t => (
                    <Button 
                      key={t}
                      variant={logForm.type === t ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setLogForm({ ...logForm, type: t })}
                      className="rounded-xl text-xs font-black h-9 px-4 transition-all"
                    >
                      {t === 'academic' ? '학업 성취' : t === 'life' ? '생활 태도' : '진로 상담'}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3">
                <Label className="text-xs font-black uppercase text-primary/70 tracking-widest">상담 내용</Label>
                <Textarea 
                  className="rounded-2xl min-h-[120px] p-4 text-sm font-medium border-2 focus:ring-primary/20" 
                  placeholder="구체적인 상담 내용을 입력하세요..."
                  value={logForm.content}
                  onChange={(e) => setLogForm({ ...logForm, content: e.target.value })}
                />
              </div>
              <div className="grid gap-3">
                <Label className="text-xs font-black uppercase text-primary/70 tracking-widest">핵심 개선 제안</Label>
                <Input 
                  className="rounded-xl h-12 px-4 border-2 font-bold" 
                  placeholder="다음 상담 전까지 해결할 과제"
                  value={logForm.improvement}
                  onChange={(e) => setLogForm({ ...logForm, improvement: e.target.value })}
                />
              </div>
              <Button 
                className="w-full rounded-2xl font-black h-14 shadow-lg interactive-button text-lg" 
                onClick={handleAddLog} 
                disabled={isSubmittingLog}
              >
                {isSubmittingLog ? <Loader2 className="animate-spin" /> : '상담 기록 저장'}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
            <CardHeader className="bg-muted/10 p-8 border-b">
              <CardTitle className="text-xl font-black flex items-center gap-2">
                <History className="h-5 w-5 text-primary" /> 히스토리 히스토리
              </CardTitle>
              <CardDescription className="font-bold">과거 모든 상담 및 기록을 확인합니다.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 max-h-[600px] overflow-y-auto custom-scrollbar">
              {!counselingLogs || counselingLogs.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
                  <History className="h-12 w-12" />
                  <p className="font-black">아직 기록된 상담 내역이 없습니다.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {counselingLogs.map(log => (
                    <div key={log.id} className="p-6 space-y-3 hover:bg-muted/10 transition-colors">
                      <div className="flex justify-between items-center">
                        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-2">
                          {log.type}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-bold">{format(log.createdAt.toDate(), 'yyyy.MM.dd (EEE)')}</span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed text-foreground/80">{log.content}</p>
                      {log.improvement && (
                        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                          <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">핵심 과제</p>
                          <p className="text-xs font-bold text-emerald-900">{log.improvement}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 분석 다이얼로그 (그래프 상세) */}
      <Dialog open={!!activeAnalysis} onOpenChange={(open) => !open && setActiveAnalysis(null)}>
        <DialogContent className="sm:max-w-2xl rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
          <div className="bg-primary p-8 text-primary-foreground">
            <DialogHeader>
              <DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-2">
                {activeAnalysis === 'today' && <><Clock className="h-8 w-8" /> 오늘 학습 상세 분석</>}
                {activeAnalysis === 'weekly' && <><TrendingUp className="h-8 w-8" /> 주간 학습 추이</>}
                {activeAnalysis === 'monthly' && <><CalendarDays className="h-8 w-8" /> 월간 누적 분석</>}
                {activeAnalysis === 'level' && <><Zap className="h-8 w-8" /> 마스터리 성장 곡선</>}
                {activeAnalysis === 'rank' && <><Trophy className="h-8 w-8" /> 시즌 성과 리포트</>}
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/60 font-bold text-lg">
                학생의 데이터를 시각화하여 학습 패턴을 심층 분석합니다.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-8">
            <div className="h-[300px] w-full mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData.slice(-14)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} unit="h" />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/30 p-5 rounded-2xl border-2 border-dashed">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">최대 집중 시간</p>
                <p className="text-2xl font-black">{Math.max(...stats.chartData.map(d => d.hours), 0)}시간</p>
              </div>
              <div className="bg-muted/30 p-5 rounded-2xl border-2 border-dashed">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">평균 몰입도</p>
                <p className="text-2xl font-black">{stats.weeklyAvg > 300 ? '최상' : '보통'}</p>
              </div>
            </div>
          </div>
          
          <div className="p-6 bg-muted/20 border-t flex justify-end">
            <Button onClick={() => setActiveAnalysis(null)} className="rounded-xl font-black h-12 px-8">닫기</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
