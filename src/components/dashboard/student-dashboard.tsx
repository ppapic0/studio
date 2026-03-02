
'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Activity,
  Clock,
  Loader2,
  Play,
  Zap,
  Square,
  Timer,
  CalendarClock,
  AlertCircle,
  Check,
  CircleDot,
  ListTodo,
  Sparkles,
  Target,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Trophy,
  Crown,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { DailyStudentStat, StudyPlanItem, WithId, StudyLogDay, GrowthProgress, StudentProfile } from '@/lib/types';
import { doc, collection, query, where, updateDoc, setDoc, serverTimestamp, increment, writeBatch, Timestamp, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { useEffect, useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '../ui/progress';
import { cn } from '@/lib/utils';

const TIERS = [
  { name: '아이언', min: 0, color: 'text-slate-400', bg: 'bg-slate-400', border: 'border-slate-200', gradient: 'from-slate-500 via-slate-600 to-slate-800', shadow: 'shadow-slate-200/50' },
  { name: '브론즈', min: 20, color: 'text-orange-700', bg: 'bg-orange-700', border: 'border-orange-200', gradient: 'from-orange-600 via-orange-700 to-orange-900', shadow: 'shadow-orange-200/50' },
  { name: '실버', min: 40, color: 'text-slate-300', bg: 'bg-slate-300', border: 'border-slate-100', gradient: 'from-blue-300 via-slate-400 to-slate-600', shadow: 'shadow-slate-100/50' },
  { name: '골드', min: 60, color: 'text-yellow-500', bg: 'bg-yellow-500', border: 'border-yellow-200', gradient: 'from-amber-400 via-yellow-500 to-yellow-700', shadow: 'shadow-yellow-200/50' },
  { name: '플래티넘', min: 75, color: 'text-emerald-400', bg: 'bg-emerald-400', border: 'border-emerald-200', gradient: 'from-emerald-400 via-teal-500 to-teal-700', shadow: 'shadow-emerald-200/50' },
  { name: '다이아몬드', min: 85, color: 'text-blue-400', bg: 'bg-blue-400', border: 'border-blue-200', gradient: 'from-blue-400 via-indigo-500 to-indigo-700', shadow: 'shadow-blue-200/50' },
  { name: '마스터', min: 95, color: 'text-purple-500', bg: 'bg-purple-500', border: 'border-purple-200', gradient: 'from-purple-500 via-violet-600 to-violet-800', shadow: 'shadow-purple-200/50' },
];

const STAT_CONFIG = {
  focus: { label: '집중력', sub: 'FOCUS', icon: Target, color: 'text-blue-500', bg: 'bg-blue-500', accent: 'bg-blue-50' },
  consistency: { label: '꾸준함', sub: 'CONSISTENCY', icon: RefreshCw, color: 'text-emerald-500', bg: 'bg-emerald-500', accent: 'bg-emerald-50' },
  achievement: { label: '목표달성', sub: 'ACHIEVEMENT', icon: CheckCircle2, color: 'text-amber-500', bg: 'bg-amber-500', accent: 'bg-amber-50' },
  resilience: { label: '회복력', sub: 'RESILIENCE', icon: ShieldCheck, color: 'text-rose-500', bg: 'bg-rose-500', accent: 'bg-rose-50' },
};

export function StudentDashboard({ isActive }: { isActive: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { 
    activeMembership, 
    isTimerActive, 
    setIsTimerActive, 
    startTime,
    setStartTime,
    viewMode
  } = useAppContext();
  
  const [today, setToday] = useState<Date | null>(null);
  const [localSeconds, setLocalSeconds] = useState(0);
  const isMobile = viewMode === 'mobile';
  
  useEffect(() => {
    setToday(new Date());
  }, []);

  const todayKey = today ? format(today, 'yyyy-MM-dd') : '';
  const weekKey = today ? format(today, "yyyy-'W'II") : '';

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && startTime) {
      setLocalSeconds(Math.floor((Date.now() - startTime) / 1000));
      interval = setInterval(() => {
        setLocalSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setLocalSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, startTime]);

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: progress } = useDoc<GrowthProgress>(progressRef, { enabled: isActive });

  const stats = progress?.stats || { focus: 0, consistency: 0, achievement: 0, resilience: 0 };
  const avgStat = useMemo(() => {
    const values = Object.values(stats);
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [stats]);

  const currentTier = useMemo(() => {
    return TIERS.slice().reverse().find(t => avgStat >= t.min) || TIERS[0];
  }, [avgStat]);

  const masteryBoost = useMemo(() => 1 + ((progress?.mastery || 0) / 100) * 0.10, [progress?.mastery]);
  const statBoost = useMemo(() => 1 + (avgStat / 100) * 0.10, [avgStat]);
  const totalBoost = Math.min(1.20, masteryBoost * statBoost);

  const studyLogRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || !todayKey) return null;
    return doc(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days', todayKey);
  }, [firestore, activeMembership, user, todayKey]);
  const { data: todayStudyLog } = useDoc<StudyLogDay>(studyLogRef, { enabled: isActive });

  const allPlansRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || !weekKey || !todayKey) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items'),
      where('dateKey', '==', todayKey)
    );
  }, [firestore, activeMembership, user, weekKey, todayKey]);
  const { data: todayPlans } = useCollection<StudyPlanItem>(allPlansRef, { enabled: isActive });
  
  const scheduleItems = useMemo(() => todayPlans?.filter(p => p.category === 'schedule') || [], [todayPlans]);
  const studyTasks = useMemo(() => todayPlans?.filter(p => p.category === 'study' || !p.category) || [], [todayPlans]);

  const calculateFinalLp = (base: number) => {
    const bonus = Math.min(25, base * (totalBoost - 1));
    return Math.round(base + bonus);
  };

  const handleStudyStartStop = async () => {
    if (!firestore || !user || !activeMembership || !progressRef) return;

    if (isTimerActive) {
      const nowTs = Date.now();
      const sessionMinutes = Math.floor((nowTs - (startTime || nowTs)) / 60000);
      
      const updateData: any = {
        updatedAt: serverTimestamp()
      };

      if (sessionMinutes > 0) {
        const lpEarned = calculateFinalLp(sessionMinutes);
        updateData.seasonLp = increment(lpEarned);
        updateData.totalLpEarned = increment(lpEarned);
        updateData['stats.focus'] = increment(sessionMinutes / 100); 
        
        const totalNow = (todayStudyLog?.totalMinutes || 0) + sessionMinutes;
        if (totalNow >= 360 && !progress?.dailyLpStatus?.[todayKey]?.bonus6h) {
          const bonusLp = calculateFinalLp(200);
          updateData.seasonLp = increment(bonusLp);
          updateData[`dailyLpStatus.${todayKey}.bonus6h`] = true;
          updateData['stats.resilience'] = increment(0.5);
          toast({ title: "🏆 6시간 초몰입 보너스!", description: `+${bonusLp} LP 획득` });
        }

        const batch = writeBatch(firestore);
        batch.set(studyLogRef!, { totalMinutes: increment(sessionMinutes), updatedAt: serverTimestamp() }, { merge: true });
        const sessionRef = doc(collection(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days', todayKey, 'sessions'));
        batch.set(sessionRef, { startTime: Timestamp.fromMillis(startTime!), endTime: Timestamp.fromMillis(nowTs), durationMinutes: sessionMinutes, createdAt: serverTimestamp() });
        batch.update(progressRef, updateData);
        
        const studentProfileRef = doc(firestore, 'centers', activeMembership.id, 'students', user.uid);
        const profileSnap = await getDoc(studentProfileRef);
        if (profileSnap.exists()) {
          const seatNo = profileSnap.data().seatNo;
          if (seatNo) {
            const seatRef = doc(firestore, 'centers', activeMembership.id, 'attendanceCurrent', `seat_${seatNo.toString().padStart(3, '0')}`);
            batch.set(seatRef, { status: 'absent', updatedAt: serverTimestamp() }, { merge: true });
          }
        }
        
        await batch.commit();
      }

      setIsTimerActive(false);
      setStartTime(null);
      toast({ title: "트랙 종료 및 학습 데이터가 동기화되었습니다." });
    } else {
      const nowTs = Date.now();
      setStartTime(nowTs);
      setIsTimerActive(true);

      const batch = writeBatch(firestore);
      
      const studentProfileRef = doc(firestore, 'centers', activeMembership.id, 'students', user.uid);
      const profileSnap = await getDoc(studentProfileRef);
      if (profileSnap.exists()) {
        const seatNo = profileSnap.data().seatNo;
        if (seatNo) {
          const seatRef = doc(firestore, 'centers', activeMembership.id, 'attendanceCurrent', `seat_${seatNo.toString().padStart(3, '0')}`);
          batch.set(seatRef, { status: 'studying', studentId: user.uid, lastCheckInAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
        }
      }

      if (!progress?.dailyLpStatus?.[todayKey]?.attendance) {
        const attendanceLp = calculateFinalLp(200);
        batch.update(progressRef, {
          seasonLp: increment(attendanceLp),
          totalLpEarned: increment(attendanceLp),
          [`dailyLpStatus.${todayKey}.attendance`]: true,
          'stats.consistency': increment(0.1),
          updatedAt: serverTimestamp()
        });
        toast({ title: "✅ 오늘 첫 입실 완료!", description: `+${attendanceLp} LP가 적립되었습니다.` });
      }
      await batch.commit();
    }
  };

  const handleToggleTask = async (item: WithId<StudyPlanItem>) => {
    if (!firestore || !user || !activeMembership || !progressRef || !weekKey) return;
    const itemRef = doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id);
    const nextState = !item.done;
    
    updateDoc(itemRef, { done: nextState, updatedAt: serverTimestamp() });
    
    if (nextState) {
      updateDoc(progressRef, { 
        'stats.achievement': increment(0.05),
        updatedAt: serverTimestamp() 
      });

      const allDone = studyTasks.every(t => t.id === item.id ? true : t.done);
      if (allDone && !progress?.dailyLpStatus?.[todayKey]?.plan) {
        const planLp = calculateFinalLp(200);
        updateDoc(progressRef, {
          seasonLp: increment(planLp),
          totalLpEarned: increment(planLp),
          [`dailyLpStatus.${todayKey}.plan`]: true,
          updatedAt: serverTimestamp()
        });
        toast({ title: "🎯 오늘의 계획 완벽 달성!", description: `+${planLp} LP 획득` });
      }
    }
  };

  if (!isActive) return null;

  const totalMinutes = (todayStudyLog?.totalMinutes || 0) + Math.floor(localSeconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  return (
    <div className={cn("flex flex-col gap-6 sm:gap-8 pb-24")}>
      {/* 1. 티어 기반 프리미엄 트래커 카드 */}
      <section className={cn(
        "group relative overflow-hidden text-white shadow-2xl transition-all duration-700 rounded-[2.5rem] p-8 sm:rounded-[3rem] sm:p-12",
        "bg-gradient-to-br", currentTier.gradient, currentTier.shadow
      )}>
        <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-10 rotate-12 transition-transform duration-1000 group-hover:scale-110 group-hover:rotate-45">
          <Trophy className="h-48 w-48 sm:h-64 sm:w-64" />
        </div>
        
        <div className={cn("relative z-10 flex flex-col gap-8", isMobile ? "items-center text-center" : "md:flex-row md:justify-between md:text-left")}>
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <Badge className="w-fit bg-white/20 text-white border-none font-black text-[10px] tracking-[0.3em] uppercase px-3 py-1 mb-2">
                {currentTier.name} Tier Active
              </Badge>
              <h2 className={cn("font-black tracking-tighter leading-[1.1]", isMobile ? "text-4xl" : "text-6xl")}>
                {isTimerActive ? "몰입의 정점에\n도착하셨네요!" : "오늘의 성장을 위해\n트랙을 시작하세요"}
              </h2>
            </div>
            
            <div className={cn("flex items-center gap-3 bg-white/10 backdrop-blur-xl w-fit px-5 py-2.5 rounded-full border border-white/20 shadow-2xl", isMobile ? "mx-auto" : "md:mx-0")}>
              <span className="relative flex h-2.5 w-2.5">
                <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", isTimerActive ? "bg-accent" : "bg-white")}></span>
                <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", isTimerActive ? "bg-accent" : "bg-white")}></span>
              </span>
              <span className="text-[11px] font-black uppercase tracking-[0.2em] opacity-90 whitespace-nowrap">Live Performance Engine</span>
            </div>
          </div>
          
          <div className={cn("flex flex-col sm:flex-row items-center gap-5 sm:gap-8 w-full md:w-auto")}>
            {isTimerActive && (
              <div className={cn("flex flex-col items-center bg-black/20 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] shrink-0 w-full sm:w-auto px-10 py-6 sm:px-12 sm:py-8")}>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50 mb-2">Live Session</span>
                <span className="font-mono font-black tracking-tighter tabular-nums text-white text-6xl leading-none">
                  {Math.floor(localSeconds / 60).toString().padStart(2, '0')}:{(localSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}
            
            <Button 
              size="lg" 
              className={cn(
                "w-full rounded-[2.5rem] font-black transition-all md:w-auto shadow-2xl active:scale-95 border-none", 
                isMobile ? "h-20 text-2xl" : "h-24 px-16 text-3xl", 
                isTimerActive ? "bg-rose-500 hover:bg-rose-600" : "bg-white text-primary hover:bg-slate-50"
              )} 
              onClick={handleStudyStartStop}
            >
              {isTimerActive ? <>트랙 종료 <Square className="ml-3 h-8 w-8 fill-current" /></> : <>트랙 시작 <Play className="ml-3 h-8 w-8 fill-current" /></>}
            </Button>
          </div>
        </div>
      </section>

      {/* 2. 요약 지표 (공부시간, LP) - 마스터리 삭제 */}
      <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "sm:grid-cols-2")}>
        <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden ring-1 ring-black/[0.03]">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-8 pt-8">
            <CardTitle className="font-black uppercase tracking-widest text-muted-foreground text-[10px]">오늘의 누적 몰입</CardTitle>
            <div className="bg-primary/5 p-2 rounded-xl"><Clock className="h-5 w-5 text-primary/60" /></div>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <div className="font-black tracking-tighter text-primary text-5xl">
              {h}<span className="text-xl ml-1.5 opacity-40 font-bold">h</span> {m}<span className="text-xl ml-1.5 opacity-40 font-bold">m</span>
            </div>
            <p className="font-bold text-muted-foreground/60 text-[11px] mt-3">Daily Goal: 6h (360m)</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden ring-1 ring-black/[0.03]">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-8 pt-8">
            <CardTitle className="font-black uppercase tracking-widest text-muted-foreground text-[10px]">시즌 러닝 포인트 (LP)</CardTitle>
            <div className="bg-accent/5 p-2 rounded-xl"><Zap className="h-5 w-5 text-accent" /></div>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <div className="font-black tracking-tighter text-primary text-5xl">
              {(progress?.seasonLp || 0).toLocaleString()}<span className="text-xl ml-1.5 opacity-40 font-bold">LP</span>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Badge variant="secondary" className="bg-accent/10 text-accent border-none font-black text-[10px]">MAX BOOST x{totalBoost.toFixed(2)}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. 4대 핵심 품질 스탯 */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary opacity-40" />
            <h2 className="text-2xl font-black tracking-tighter uppercase tracking-widest">Quality Stats</h2>
          </div>
          <Badge variant="outline" className="rounded-full font-black text-[10px] border-primary/20 px-4 py-1">TIER AVG: {avgStat.toFixed(1)}</Badge>
        </div>

        <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-4")}>
          {Object.entries(STAT_CONFIG).map(([key, config]) => {
            const val = stats[key as keyof typeof stats] || 0;
            const Icon = config.icon;
            return (
              <Card key={key} className="border-none bg-white shadow-xl rounded-[2.5rem] overflow-hidden group hover:-translate-y-1 transition-all duration-500 ring-1 ring-black/[0.03]">
                <CardHeader className="p-8 pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn("p-3 rounded-2xl", config.accent)}>
                      <Icon className={cn("h-6 w-6", config.color)} />
                    </div>
                    <span className={cn("font-black text-[9px] uppercase tracking-widest opacity-40")}>{config.sub}</span>
                  </div>
                  <CardTitle className={cn("text-xl font-black tracking-tight mb-1")}>{config.label}</CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black tabular-nums">{val.toFixed(1)}</span>
                    <span className="text-xs font-bold text-muted-foreground opacity-40">/ 100</span>
                  </div>
                </CardHeader>
                <CardContent className="px-8 pb-8">
                  <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner mb-4">
                    <div 
                      className={cn("absolute inset-y-0 left-0 transition-all duration-1000 ease-out rounded-full", config.bg)}
                      style={{ width: `${val}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground">
                    <span>품질 가중치</span>
                    <span className={cn("font-black", config.color)}>x{(1 + (val/100)*0.10).toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 4. 계획 및 루틴 */}
      <div className={cn("grid gap-6 grid-cols-1 lg:grid-cols-3")}>
        <Card className={cn("border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/[0.03] lg:col-span-2")}>
          <CardHeader className="bg-muted/5 border-b p-10">
            <CardTitle className="font-black flex items-center gap-4 tracking-tighter text-3xl text-primary">
              <ListTodo className="h-8 w-8" /> 오늘의 계획트랙
            </CardTitle>
          </CardHeader>
          <CardContent className="p-10">
            <div className="grid gap-4">
              {studyTasks.length === 0 ? (
                <div className="py-16 text-center opacity-20 italic font-black text-sm">등록된 학습 계획이 없습니다.</div>
              ) : studyTasks.map((task) => (
                <div key={task.id} className={cn(
                  "flex items-center gap-6 p-8 rounded-[2.5rem] border-2 transition-all duration-500", 
                  task.done ? "bg-emerald-50/20 border-emerald-100/50" : "bg-white border-transparent shadow-sm hover:shadow-md"
                )}>
                  <Checkbox 
                    id={task.id} 
                    checked={task.done} 
                    onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} 
                    className="h-10 w-10 rounded-2xl border-2 transition-all data-[state=checked]:scale-110" 
                  />
                  <div className="flex-1 grid gap-1">
                    <Label htmlFor={task.id} className={cn("font-black text-xl tracking-tight transition-all", task.done && "line-through text-muted-foreground/40 italic")}>
                      {task.title}
                    </Label>
                    {task.targetMinutes && (
                      <span className="text-[11px] font-bold text-muted-foreground/60 flex items-center gap-1.5 uppercase tracking-widest">
                        <Clock className="h-3 w-3" /> {task.targetMinutes} minutes Goal
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/[0.03]">
          <CardHeader className="bg-amber-50/30 border-b p-10">
            <CardTitle className="font-black flex items-center gap-4 tracking-tighter text-amber-700">
              <Timer className="h-8 w-8" /> 오늘의 루틴
            </CardTitle>
          </CardHeader>
          <CardContent className="p-10 bg-[#fafafa]">
            <div className="space-y-4">
              {scheduleItems.length === 0 ? (
                <div className="py-16 text-center opacity-20 italic font-black text-sm">등록된 루틴이 없습니다.</div>
              ) : scheduleItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-8 rounded-[2.5rem] bg-white border shadow-sm group hover:border-amber-300 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-amber-50 group-hover:bg-amber-500 group-hover:text-white transition-all text-amber-600"><Timer className="h-4 w-4" /></div>
                    <span className="font-black tracking-tight text-primary">{item.title.split(': ')[0]}</span>
                  </div>
                  <Badge variant="outline" className="font-mono font-black text-amber-600 text-lg px-4 py-1.5 rounded-2xl border-amber-200 bg-amber-50">
                    {item.title.split(': ')[1] || '--:--'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
