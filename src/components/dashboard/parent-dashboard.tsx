'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { 
  FileText, 
  CheckCircle, 
  Loader2, 
  Clock, 
  MapPin, 
  LogOut, 
  TrendingUp, 
  Zap, 
  CalendarCheck,
  ArrowUpRight,
  Activity,
  Sparkles
} from 'lucide-react';
import { ResponsiveContainer, Bar, XAxis, YAxis, Tooltip, BarChart as RechartsBarChart, CartesianGrid } from 'recharts';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { type DailyStudentStat, type StudyLogDay, type StudyPlanItem } from '@/lib/types';
import { generateParentSummary, type ParentSummaryOutput, type ParentSummaryInput } from '@/ai/flows/parent-receives-weekly-summary';
import { Skeleton } from '../ui/skeleton';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

const chartData = [
  { name: '1주차', completion: 75, attendance: 95 },
  { name: '2주차', completion: 80, attendance: 100 },
  { name: '3주차', completion: 78, attendance: 100 },
  { name: '4주차', completion: 82, attendance: 100 },
];

export function ParentDashboard({ isActive }: { isActive: boolean }) {
  const { activeMembership, viewMode } = useAppContext();
  const firestore = useFirestore();
  const isMobile = viewMode === 'mobile';

  const [summary, setSummary] = useState<ParentSummaryOutput | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const studentId = activeMembership?.linkedStudentIds?.[0];
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const weekKey = format(new Date(), "yyyy-'W'II");

  // 1. 자녀의 전체 통계 데이터
  const studentStatRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !studentId) return null;
    return doc(firestore, 'centers', activeMembership.id, 'dailyStudentStats', todayKey, 'students', studentId);
  }, [firestore, activeMembership, studentId, todayKey]);
  const { data: studentStat, isLoading: studentStatLoading } = useDoc<DailyStudentStat>(studentStatRef, { enabled: isActive && !!studentId });

  // 2. 자녀의 오늘 공부 시간 로그
  const studyLogRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !studentId) return null;
    return doc(firestore, 'centers', activeMembership.id, 'studyLogs', studentId, 'days', todayKey);
  }, [firestore, activeMembership, studentId, todayKey]);
  const { data: todayStudyLog } = useDoc<StudyLogDay>(studyLogRef, { enabled: isActive && !!studentId });

  // 3. 자녀의 오늘 계획 (등/하원 시간 추출용)
  const plansQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !studentId) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'plans', studentId, 'weeks', weekKey, 'items'),
      where('dateKey', '==', todayKey),
      where('category', '==', 'schedule')
    );
  }, [firestore, activeMembership, studentId, weekKey, todayKey]);
  const { data: scheduleItems } = useCollection<StudyPlanItem>(plansQuery, { enabled: isActive && !!studentId });

  const attendanceTimes = useMemo(() => {
    if (!scheduleItems) return { in: '--:--', out: '--:--' };
    const inItem = scheduleItems.find(item => item.title.includes('등원'));
    const outItem = scheduleItems.find(item => item.title.includes('하원'));
    return {
      in: inItem ? inItem.title.split(': ')[1] || '--:--' : '--:--',
      out: outItem ? outItem.title.split(': ')[1] || '--:--' : '--:--',
    };
  }, [scheduleItems]);

  useEffect(() => {
    if (!isActive || !studentId || !studentStat || studentStatLoading) {
        if (!studentId) setSummaryLoading(false);
        return;
    }

    const fetchSummary = async () => {
        setSummaryLoading(true);
        try {
          const input: ParentSummaryInput = {
            studentName: '자녀',
            completionRate: Math.round((studentStat.weeklyPlanCompletionRate || 0) * 100),
            completionRateTrend: 0,
            attendanceRate: 100,
            attendanceTrend: 0,
            studyTimeGrowth: studentStat.studyTimeGrowthRate || 0,
            recentAchievements: [],
            potentialRisks: studentStat.riskDetected ? ['학습 불균형 또는 위험 요소가 감지되었습니다.'] : [],
          };
          const result = await generateParentSummary(input);
          setSummary(result);
        } catch (error) {
          console.error("Error generating parent summary:", error);
          setSummary(null);
        } finally {
          setSummaryLoading(false);
        }
    };
    
    fetchSummary();
  }, [isActive, studentId, studentStat, studentStatLoading]);

  if (!isActive) return null;
  
  if (!studentId) {
    return (
      <Card className="rounded-[2rem] border-none shadow-xl bg-white p-10 text-center">
        <CardContent className="flex flex-col items-center gap-4 pt-6">
          <div className="p-4 bg-muted rounded-full"><Clock className="h-10 w-10 text-muted-foreground opacity-20" /></div>
          <CardTitle className="text-2xl font-black tracking-tighter">학생 연결 필요</CardTitle>
          <p className="text-muted-foreground font-bold">학부모 계정에 연결된 자녀가 없습니다. 센터에 문의해 주세요.</p>
        </CardContent>
      </Card>
    );
  }
  
  const isLoading = studentStatLoading || summaryLoading;
  const totalMins = todayStudyLog?.totalMinutes || 0;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;

  return (
    <div className={cn("grid gap-6", isMobile ? "px-1" : "px-0")}>
      {/* 1. 실시간 학습 현황 섹션 (사용자 요청 반영) */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-[1.5rem] border-none shadow-md bg-white overflow-hidden group hover:shadow-xl transition-all duration-500">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <Zap className="h-3 w-3 text-emerald-500 fill-current" /> 오늘 총 몰입
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black tracking-tighter text-primary">{h}</span>
              <span className="text-sm font-bold text-muted-foreground/60 mr-2">h</span>
              <span className="text-4xl font-black tracking-tighter text-primary">{m}</span>
              <span className="text-sm font-bold text-muted-foreground/60">m</span>
            </div>
            <p className="text-[9px] font-bold text-muted-foreground mt-2">일일 학습 목표 360분 기준</p>
          </CardContent>
        </Card>

        <Card className="rounded-[1.5rem] border-none shadow-md bg-white overflow-hidden group hover:shadow-xl transition-all duration-500">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <MapPin className="h-3 w-3 text-blue-500" /> 오늘 출결 기록
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="grid gap-0.5">
                <span className="text-[8px] font-black text-blue-600 uppercase">등원</span>
                <span className="text-xl font-black tracking-tight">{attendanceTimes.in}</span>
              </div>
              <div className="h-8 w-px bg-muted mx-4" />
              <div className="grid gap-0.5 text-right">
                <span className="text-[8px] font-black text-muted-foreground uppercase">하원 예정</span>
                <span className="text-xl font-black tracking-tight">{attendanceTimes.out}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.5rem] border-none shadow-md bg-white overflow-hidden group hover:shadow-xl transition-all duration-500">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-purple-500" /> 학습 리듬
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="text-3xl font-black tracking-tighter text-primary">
                {Math.round((studentStat?.studyTimeGrowthRate || 0) * 100)}%
              </div>
              <Badge className={cn(
                "rounded-lg font-black text-[10px] border-none",
                (studentStat?.studyTimeGrowthRate || 0) >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
              )}>
                { (studentStat?.studyTimeGrowthRate || 0) >= 0 ? '페이스 유지' : '관리 주의' }
              </Badge>
            </div>
            <p className="text-[9px] font-bold text-muted-foreground mt-2">최근 7일 평균 공부시간 대비</p>
          </CardContent>
        </Card>
      </section>

      {/* 2. AI 정밀 분석 섹션 */}
      <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-border/50">
        <CardHeader className="bg-muted/5 border-b p-8">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" /> 주간 AI 정밀 분석
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Insight & Analysis</CardDescription>
            </div>
            <Badge variant="outline" className="font-black text-[10px] border-primary/20 px-3 py-1">Premium Report</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-10">
          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-32 w-full rounded-[1.5rem]" />
              <div className="grid grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-[1.5rem]" />)}
              </div>
            </div>
          ) : summary ? (
            <>
              <div className="p-6 rounded-[2rem] bg-primary/5 border border-primary/10 relative group">
                <div className="absolute -top-3 left-6 px-3 py-1 bg-primary text-white text-[9px] font-black rounded-lg shadow-lg">AI SUMMARY</div>
                <p className="text-base font-bold leading-relaxed text-foreground/80 italic">"{summary.message}"</p>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-3">
                {summary.keyMetrics.map((metric) => (
                  <div key={metric.name} className="p-5 rounded-[1.5rem] bg-[#fafafa] border shadow-inner flex flex-col gap-1">
                    <span className="text-[9px] font-black text-muted-foreground uppercase">{metric.name}</span>
                    <div className="text-2xl font-black tracking-tighter">{metric.value}</div>
                    <span className="text-[10px] font-bold text-emerald-600">{metric.trend}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-primary/60 tracking-widest ml-1 flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> 전문가 추천 가이드
                </h4>
                <div className="grid gap-3">
                  {summary.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-border/50 shadow-sm">
                      <div className="h-5 w-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <CheckCircle className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-sm font-bold text-foreground/70 leading-relaxed">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="py-20 text-center flex flex-col items-center gap-4 opacity-20">
              <FileText className="h-16 w-16" />
              <p className="font-black italic">충분한 학습 데이터가 쌓이면 분석이 시작됩니다.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. 성과 추이 차트 섹션 */}
      <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
        <CardHeader className="bg-muted/5 border-b p-8">
          <CardTitle className="text-xl font-black tracking-tighter flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> 학습 지표 추이 (4주)
          </CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Completion & Attendance Trends</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
           <div className="h-[350px] w-full">
             {isLoading || !isMounted ? (
               <div className="h-full w-full bg-muted/5 animate-pulse rounded-2xl flex items-center justify-center">
                 <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20"/>
               </div>
             ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="completion" name="완수율" fill="hsl(var(--primary))" radius={[10, 10, 0, 0]} barSize={24} />
                  <Bar dataKey="attendance" name="출석률" fill="hsl(var(--accent))" radius={[10, 10, 0, 0]} barSize={24} />
                </RechartsBarChart>
              </ResponsiveContainer>
             )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
