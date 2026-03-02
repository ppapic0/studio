
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
  Settings2,
  Wand2,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
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

/**
 * Jacob 전용 티어 컨트롤러 컴포넌트
 */
function JacobTierController({ progressRef, currentStats }: { progressRef: any, currentStats: any }) {
  const [stats, setStats] = useState(currentStats);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setStats(currentStats);
  }, [currentStats]);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await updateDoc(progressRef, {
        stats: stats,
        updatedAt: serverTimestamp()
      });
      toast({ title: "티어 보정 완료", description: "설정한 스탯이 실시간으로 반영되었습니다." });
    } catch (e) {
      toast({ variant: "destructive", title: "보정 실패" });
    } finally {
      setIsUpdating(false);
    }
  };

  const setTierValue = (val: number) => {
    setStats({ focus: val, consistency: val, achievement: val, resilience: val });
  };

  return (
    <Card className="border-4 border-dashed border-primary/20 bg-primary/5 rounded-[2.5rem] p-8 mt-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <CardHeader className="p-0 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl text-white"><Settings2 className="h-5 w-5" /></div>
            <CardTitle className="text-xl font-black tracking-tighter">Jacob's Dev Stat Controller</CardTitle>
          </div>
          <Badge className="bg-rose-500 text-white font-black">TEST ACCOUNT ONLY</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0 space-y-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {Object.entries({
            focus: '집중력',
            consistency: '꾸준함',
            achievement: '목표달성',
            resilience: '회복력'
          }).map(([key, label]) => (
            <div key={key} className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-black uppercase text-muted-foreground">{label}</span>
                <span className="text-xs font-black text-primary">{(stats[key] || 0).toFixed(0)}</span>
              </div>
              <Slider 
                value={[stats[key] || 0]} 
                max={100} 
                step={1} 
                onValueChange={([val]) => setStats({ ...stats, [key]: val })}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {[
            { l: '아이언(10)', v: 10 }, { l: '실버(45)', v: 45 }, 
            { l: '골드(65)', v: 65 }, { l: '플래티넘(80)', v: 80 }, 
            { l: '다이아(90)', v: 90 }, { l: '마스터(98)', v: 98 }
          ].map(t => (
            <Button key={t.v} variant="outline" size="sm" onClick={() => setTierValue(t.v)} className="rounded-lg font-black text-[10px] h-8 px-3 border-2">{t.l}</Button>
          ))}
        </div>

        <Button onClick={handleUpdate} disabled={isUpdating} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 gap-2">
          {isUpdating ? <Loader2 className="animate-spin h-5 w-5" /> : <Wand2 className="h-5 w-5" />}
          스탯 즉시 반영 및 티어 업데이트
        </Button>
      </CardContent>
    </Card>
  );
}

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

  const isJacob = user?.email === 'jacob444@naver.com';

  return (
    <div className={cn("flex flex-col gap-6 sm:gap-10 pb-24")}>
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

      {/* 2. 요약 지표 (공부시간, LP) */}
      <div className={cn("grid gap-4 sm:gap-6", isMobile ? "grid-cols-1" : "sm:grid-cols-2")}>
        <Card className="border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden ring-1 ring-black/[0.03] group hover:-translate-y-1 transition-all duration-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-10 pt-10">
            <CardTitle className="font-black uppercase tracking-widest text-muted-foreground text-[10px]">오늘의 누적 몰입</CardTitle>
            <div className="bg-primary/5 p-2.5 rounded-xl group-hover:bg-primary/10 transition-colors"><Clock className="h-6 w-6 text-primary/60" /></div>
          </CardHeader>
          <CardContent className="px-10 pb-10">
            <div className="font-black tracking-tighter text-primary text-6xl">
              {h}<span className="text-2xl ml-1.5 opacity-40 font-bold">h</span> {m}<span className="text-2xl ml-1.5 opacity-40 font-bold">m</span>
            </div>
            <p className="font-bold text-muted-foreground/60 text-xs mt-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Daily Goal: 6h (360m) Focus Target
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden ring-1 ring-black/[0.03] group hover:-translate-y-1 transition-all duration-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-10 pt-10">
            <CardTitle className="font-black uppercase tracking-widest text-muted-foreground text-[10px]">시즌 러닝 포인트 (LP)</CardTitle>
            <div className="bg-accent/5 p-2.5 rounded-xl group-hover:bg-accent/10 transition-colors"><Zap className="h-6 w-6 text-accent" /></div>
          </CardHeader>
          <CardContent className="px-10 pb-10">
            <div className="font-black tracking-tighter text-primary text-6xl">
              {(progress?.seasonLp || 0).toLocaleString()}<span className="text-2xl ml-1.5 opacity-40 font-bold">LP</span>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Badge variant="secondary" className="bg-accent/10 text-accent border-none font-black text-[10px] px-3 py-1">MAX BOOST x{totalBoost.toFixed(2)}</Badge>
              <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Season Active</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. 계획 및 루틴 */}
      <div className={cn("grid gap-6 grid-cols-1 lg:grid-cols-3")}>
        <Card className={cn("border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/[0.03] lg:col-span-2")}>
          <CardHeader className="bg-muted/5 border-b p-10 sm:p-12">
            <CardTitle className="font-black flex items-center gap-4 tracking-tighter text-3xl text-primary">
              <ListTodo className="h-8 w-8" /> 오늘의 계획트랙
            </CardTitle>
          </CardHeader>
          <CardContent className="p-10 sm:p-12">
            <div className="grid gap-4">
              {studyTasks.length === 0 ? (
                <div className="py-20 text-center opacity-20 italic font-black text-sm border-2 border-dashed rounded-[2.5rem]">등록된 학습 계획이 없습니다.</div>
              ) : studyTasks.map((task) => (
                <div key={task.id} className={cn(
                  "flex items-center gap-6 p-8 rounded-[2.5rem] border-2 transition-all duration-500", 
                  task.done ? "bg-emerald-50/20 border-emerald-100/50" : "bg-white border-transparent shadow-sm hover:shadow-md hover:border-primary/10"
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

        <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/[0.03]">
          <CardHeader className="bg-amber-50/30 border-b p-10">
            <CardTitle className="font-black flex items-center gap-4 tracking-tighter text-amber-700">
              <Timer className="h-8 w-8" /> 오늘의 루틴
            </CardTitle>
          </CardHeader>
          <CardContent className="p-10 bg-[#fafafa]">
            <div className="space-y-4">
              {scheduleItems.length === 0 ? (
                <div className="py-20 text-center opacity-20 italic font-black text-sm border-2 border-dashed border-amber-200 rounded-[2.5rem]">등록된 루틴이 없습니다.</div>
              ) : scheduleItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-8 rounded-[2.5rem] bg-white border shadow-sm group hover:border-amber-300 transition-all active:scale-[0.98]">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-amber-50 group-hover:bg-amber-500 group-hover:text-white transition-all text-amber-600 shadow-sm"><Timer className="h-4 w-4" /></div>
                    <span className="font-black tracking-tight text-primary">{item.title.split(': ')[0]}</span>
                  </div>
                  <Badge variant="outline" className="font-mono font-black text-amber-600 text-lg px-4 py-1.5 rounded-2xl border-amber-200 bg-amber-50/50">
                    {item.title.split(': ')[1] || '--:--'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Jacob 전용 티어 컨트롤러 패널 */}
      {isJacob && progressRef && (
        <JacobTierController progressRef={progressRef} currentStats={stats} />
      )}
    </div>
  );
}
