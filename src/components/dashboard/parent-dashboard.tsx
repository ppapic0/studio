
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
  Sparkles,
  History,
  ArrowRightLeft
} from 'lucide-react';
import { ResponsiveContainer, Bar, XAxis, YAxis, Tooltip, BarChart as RechartsBarChart, CartesianGrid } from 'recharts';
import { useUser, useFirestore, useDoc, useCollection } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc, collection, query, where, getDocs, limit, orderBy, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { type DailyStudentStat, type StudyLogDay, type StudyPlanItem, type ParentAiCache } from '@/lib/types';
import { generateParentSummary, type ParentSummaryOutput, type ParentSummaryInput } from '@/ai/flows/parent-receives-weekly-summary';
import { Skeleton } from '../ui/skeleton';
import { format, subDays } from 'date-fns';
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
  const yesterdayKey = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const weekKey = format(new Date(), "yyyy-'W'II");

  // 1. 자녀의 전체 통계 데이터
  const studentStatRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !studentId) return null;
    return doc(firestore, 'centers', activeMembership.id, 'dailyStudentStats', todayKey, 'students', studentId);
  }, [firestore, activeMembership, studentId, todayKey]);
  const { data: studentStat, isLoading: studentStatLoading } = useDoc<DailyStudentStat>(studentStatRef, { enabled: isActive && !!studentId });

  // 2. 자녀의 오늘/어제 공부 시간 로그
  const todayStudyLogRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !studentId) return null;
    return doc(firestore, 'centers', activeMembership.id, 'studyLogs', studentId, 'days', todayKey);
  }, [firestore, activeMembership, studentId, todayKey]);
  const { data: todayStudyLog } = useDoc<StudyLogDay>(todayStudyLogRef, { enabled: isActive && !!studentId });

  const yesterdayStudyLogRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !studentId) return null;
    return doc(firestore, 'centers', activeMembership.id, 'studyLogs', studentId, 'days', yesterdayKey);
  }, [firestore, activeMembership, studentId, yesterdayKey]);
  const { data: yesterdayStudyLog } = useDoc<StudyLogDay>(yesterdayStudyLogRef, { enabled: isActive && !!studentId });

  // 3. 자녀의 오늘 계획 (등/하원 시간 추출용)
  const todayPlansQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !studentId) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'plans', studentId, 'weeks', weekKey, 'items'),
      where('dateKey', '==', todayKey),
      where('category', '==', 'schedule')
    );
  }, [firestore, activeMembership, studentId, weekKey, todayKey]);
  const { data: todayScheduleItems } = useCollection<StudyPlanItem>(todayPlansQuery, { enabled: isActive && !!studentId });

  // 4. 자녀의 어제 계획 (등/하원 기록 추출용)
  const yesterdayPlansQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !studentId) return null;
    const yestWeekKey = format(subDays(new Date(), 1), "yyyy-'W'II");
    return query(
      collection(firestore, 'centers', activeMembership.id, 'plans', studentId, 'weeks', yestWeekKey, 'items'),
      where('dateKey', '==', yesterdayKey),
      where('category', '==', 'schedule')
    );
  }, [firestore, activeMembership, studentId, yesterdayKey]);
  const { data: yesterdayScheduleItems } = useCollection<StudyPlanItem>(yesterdayPlansQuery, { enabled: isActive && !!studentId });

  const attendanceTimes = useMemo(() => {
    const extract = (items: StudyPlanItem[] | null) => {
      if (!items) return { in: '--:--', out: '--:--' };
      const inItem = items.find(item => item.title.includes('등원'));
      const outItem = items.find(item => item.title.includes('하원'));
      return {
        in: inItem ? inItem.title.split(': ')[1] || '--:--' : '--:--',
        out: outItem ? outItem.title.split(': ')[1] || '--:--' : '--:--',
      };
    };
    return {
      today: extract(todayScheduleItems || null),
      yesterday: extract(yesterdayScheduleItems || null)
    };
  }, [todayScheduleItems, yesterdayScheduleItems]);

  useEffect(() => {
    if (!isActive || !studentId || !isMounted || !firestore || !activeMembership) return;

    const fetchSummary = async () => {
        setSummaryLoading(true);
        try {
          // 1. 먼저 오늘자 캐시된 요약이 있는지 확인
          const cacheRef = doc(firestore, 'centers', activeMembership.id, 'parentAiCache', studentId, 'days', todayKey);
          const cacheSnap = await getDoc(cacheRef);

          if (cacheSnap.exists()) {
            const cachedData = cacheSnap.data() as ParentAiCache;
            setSummary(cachedData.content);
            setSummaryLoading(false);
            return;
          }

          // 2. 캐시가 없으면 어제 데이터를 분석하여 AI 호출
          let yestCompletion = 0;
          const yestPlansRef = collection(firestore, 'centers', activeMembership.id, 'plans', studentId, 'weeks', format(subDays(new Date(), 1), "yyyy-'W'II"), 'items');
          const snap = await getDocs(query(yestPlansRef, where('dateKey', '==', yesterdayKey)));
          const items = snap.docs.map(d => d.data() as StudyPlanItem);
          const studyItems = items.filter(i => i.category === 'study' || !i.category);
          if (studyItems.length > 0) {
            yestCompletion = Math.round((studyItems.filter(i => i.done).length / studyItems.length) * 100);
          }

          const input: ParentSummaryInput = {
            studentName: '자녀',
            completionRate: yestCompletion || Math.round((studentStat?.weeklyPlanCompletionRate || 0) * 100),
            completionRateTrend: 0,
            attendanceRate: 100,
            attendanceTrend: 0,
            studyTimeGrowth: studentStat?.studyTimeGrowthRate || 0,
            recentAchievements: yesterdayStudyLog && yesterdayStudyLog.totalMinutes >= 360 ? ['어제 6시간 이상의 초몰입 학습을 달성했습니다.'] : [],
            potentialRisks: studentStat?.riskDetected ? ['최근 학습 리듬이 다소 불규칙합니다.'] : [],
            parentFeedbackContext: "전날 학습 데이터를 기반으로 한 AI 자동 분석 리포트입니다."
          };
          
          const result = await generateParentSummary(input);
          
          // 3. 생성된 결과를 Firestore에 캐싱 (오늘 다시 실행되지 않도록)
          await setDoc(cacheRef, {
            content: result,
            dateKey: todayKey,
            createdAt: serverTimestamp()
          });

          setSummary(result);
        } catch (error) {
          console.error("Error generating parent summary:", error);
          setSummary(null);
        } finally {
          setSummaryLoading(false);
        }
    };
    
    fetchSummary();
  }, [isActive, studentId, studentStat, yesterdayStudyLog, isMounted, firestore, activeMembership, todayKey, yesterdayKey]);

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
  const todayMins = todayStudyLog?.totalMinutes || 0;
  const yestMins = yesterdayStudyLog?.totalMinutes || 0;

  return (
    <div className={cn("grid gap-6", isMobile ? "px-0" : "px-0")}>
      {/* 1. 실시간/전날 학습 현황 섹션 - 수직 최적화 */}
      <section className={cn("grid gap-4", isMobile ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {/* 오늘 현황 */}
        <Card className="rounded-[1.5rem] border-none shadow-md bg-white overflow-hidden group hover:shadow-xl transition-all duration-500 relative">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
          <CardHeader className="pb-2 px-6 pt-6">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center justify-between">
              <span className="flex items-center gap-2"><Zap className="h-3 w-3 text-emerald-500 fill-current" /> 오늘 총 몰입</span>
              <Badge variant="secondary" className="text-[8px] bg-emerald-50 text-emerald-600 border-none font-black px-1.5 py-0">LIVE</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="flex items-baseline gap-1">
              <span className={cn("font-black tracking-tighter text-primary", isMobile ? "text-5xl" : "text-4xl")}>{Math.floor(todayMins / 60)}</span>
              <span className="text-sm font-bold text-muted-foreground/60 mr-2">h</span>
              <span className={cn("font-black tracking-tighter text-primary", isMobile ? "text-5xl" : "text-4xl")}>{todayMins % 60}</span>
              <span className="text-sm font-bold text-muted-foreground/60">m</span>
            </div>
            <div className="flex items-center justify-between mt-4 p-3 bg-muted/20 rounded-xl">
               <div className="grid gap-0.5">
                 <span className="text-[8px] font-black text-blue-600 uppercase">등원</span>
                 <span className="text-sm font-black tracking-tight">{attendanceTimes.today.in}</span>
               </div>
               <div className="h-6 w-px bg-border/50" />
               <div className="grid gap-0.5 text-right">
                 <span className="text-[8px] font-black text-muted-foreground uppercase">하원 예정</span>
                 <span className="text-sm font-black tracking-tight">{attendanceTimes.today.out}</span>
               </div>
            </div>
          </CardContent>
        </Card>

        {/* 어제 기록 */}
        <Card className="rounded-[1.5rem] border-none shadow-md bg-muted/20 overflow-hidden group hover:shadow-xl transition-all duration-500 relative">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-400" />
          <CardHeader className="pb-2 px-6 pt-6">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <History className="h-3 w-3 text-slate-500" /> 어제 학습 요약
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="flex items-baseline gap-1 opacity-80">
              <span className={cn("font-black tracking-tighter text-primary", isMobile ? "text-4xl" : "text-3xl")}>{Math.floor(yestMins / 60)}</span>
              <span className="text-xs font-bold text-muted-foreground/60 mr-2">h</span>
              <span className={cn("font-black tracking-tighter text-primary", isMobile ? "text-4xl" : "text-3xl")}>{yestMins % 60}</span>
              <span className="text-xs font-bold text-muted-foreground/60">m</span>
            </div>
            <div className="flex items-center justify-between mt-4 p-3 bg-white/50 rounded-xl opacity-80">
               <div className="grid gap-0.5">
                 <span className="text-[8px] font-black text-slate-500 uppercase">등원 기록</span>
                 <span className="text-sm font-black tracking-tight">{attendanceTimes.yesterday.in}</span>
               </div>
               <div className="h-6 w-px bg-border/50" />
               <div className="grid gap-0.5 text-right">
                 <span className="text-[8px] font-black text-slate-500 uppercase">하원 기록</span>
                 <span className="text-sm font-black tracking-tight">{attendanceTimes.yesterday.out}</span>
               </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.5rem] border-none shadow-md bg-white overflow-hidden group hover:shadow-xl transition-all duration-500 relative">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500" />
          <CardHeader className="pb-2 px-6 pt-6">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-purple-500" /> 학습 리듬
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="flex items-center gap-3">
              <div className={cn("font-black tracking-tighter text-primary", isMobile ? "text-4xl" : "text-3xl")}>
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

      {/* 2. AI 정밀 분석 섹션 - 수직 정렬 최적화 */}
      <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-border/50">
        <CardHeader className={cn("bg-muted/5 border-b", isMobile ? "p-6" : "p-8")}>
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <CardTitle className={cn("font-black tracking-tighter flex items-center gap-2", isMobile ? "text-xl" : "text-2xl")}>
                <Sparkles className="h-6 w-6 text-primary" /> AI 정밀 데이터 분석
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Daily Automated 브리핑</CardDescription>
            </div>
            <Badge variant="outline" className="font-black text-[9px] border-primary/20 px-2 py-0.5">CACHED</Badge>
          </div>
        </CardHeader>
        <CardContent className={cn("space-y-8", isMobile ? "p-6" : "p-8")}>
          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-32 w-full rounded-[1.5rem]" />
              <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-3")}>
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-[1.5rem]" />)}
              </div>
            </div>
          ) : summary ? (
            <>
              <div className="p-6 rounded-[2rem] bg-primary/5 border border-primary/10 relative group">
                <div className="absolute -top-3 left-6 px-3 py-1 bg-primary text-white text-[9px] font-black rounded-lg shadow-lg">SUMMARY</div>
                <p className="text-base font-bold leading-relaxed text-foreground/80 italic">"{summary.message}"</p>
              </div>
              
              {/* 지표 리스트 - 모바일 수직 전환 */}
              <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-3")}>
                {summary.keyMetrics.map((metric) => (
                  <div key={metric.name} className="p-5 rounded-[1.5rem] bg-[#fafafa] border shadow-inner flex items-center justify-between group hover:bg-white transition-all">
                    <div className="grid gap-0.5">
                      <span className="text-[9px] font-black text-muted-foreground uppercase">{metric.name}</span>
                      <div className="text-xl font-black tracking-tighter">{metric.value}</div>
                    </div>
                    <Badge variant="secondary" className="text-[9px] bg-white border font-bold text-emerald-600 shadow-sm">{metric.trend}</Badge>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-primary/60 tracking-widest ml-1 flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> 전문가 맞춤형 권장 사항
                </h4>
                <div className="grid gap-3">
                  {summary.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-border/50 shadow-sm hover:border-primary/20 transition-colors">
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
              <p className="font-black italic">데이터 분석을 생성할 수 있는 정보가 부족합니다.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. 성과 추이 차트 섹션 */}
      <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
        <CardHeader className={cn("bg-muted/5 border-b", isMobile ? "p-6" : "p-8")}>
          <CardTitle className={cn("font-black tracking-tighter flex items-center gap-2", isMobile ? "text-xl" : "text-2xl")}>
            <Activity className="h-5 w-5 text-primary" /> 학습 지표 추이 (4주)
          </CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Completion & Attendance Trends</CardDescription>
        </CardHeader>
        <CardContent className={cn(isMobile ? "p-4" : "p-8")}>
           <div className={cn("w-full", isMobile ? "h-[250px]" : "h-[350px]")}>
             {!isMounted ? (
               <div className="h-full w-full bg-muted/5 animate-pulse rounded-2xl flex items-center justify-center">
                 <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20"/>
               </div>
             ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} fontWeight="900" tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="completion" name="완수율" fill="hsl(var(--primary))" radius={[10, 10, 0, 0]} barSize={isMobile ? 16 : 24} />
                  <Bar dataKey="attendance" name="출석률" fill="hsl(var(--accent))" radius={[10, 10, 0, 0]} barSize={isMobile ? 16 : 24} />
                </RechartsBarChart>
              </ResponsiveContainer>
             )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
