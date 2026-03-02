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
  History,
  Calendar
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { DailyStudentStat, StudyPlanItem, WithId, StudyLogDay, GrowthProgress, StudentProfile, LeaderboardEntry, StudySession } from '@/lib/types';
import { doc, collection, query, where, updateDoc, setDoc, serverTimestamp, increment, writeBatch, Timestamp, getDoc, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { useEffect, useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '../ui/progress';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const TIERS = [
  { name: '아이언', min: 0, color: 'text-slate-400', bg: 'bg-slate-400', border: 'border-slate-200', gradient: 'from-slate-500 via-slate-600 to-slate-800', shadow: 'shadow-slate-200/50' },
  { name: '브론즈', min: 5000, color: 'text-orange-700', bg: 'bg-orange-700', border: 'border-orange-200', gradient: 'from-orange-600 via-orange-700 to-orange-900', shadow: 'shadow-orange-200/50' },
  { name: '실버', min: 10000, color: 'text-slate-300', bg: 'bg-slate-300', border: 'border-slate-100', gradient: 'from-blue-300 via-slate-400 to-slate-600', shadow: 'shadow-slate-100/50' },
  { name: '골드', min: 15000, color: 'text-yellow-500', bg: 'bg-yellow-500', border: 'border-yellow-200', gradient: 'from-amber-400 via-yellow-500 to-yellow-700', shadow: 'shadow-yellow-200/50' },
  { name: '플래티넘', min: 20000, color: 'text-emerald-400', bg: 'bg-emerald-400', border: 'border-emerald-200', gradient: 'from-emerald-400 via-teal-500 to-teal-700', shadow: 'shadow-emerald-200/50' },
  { name: '다이아몬드', min: 25000, color: 'text-blue-400', bg: 'bg-blue-400', border: 'border-blue-200', gradient: 'from-blue-400 via-indigo-500 to-indigo-700', shadow: 'shadow-blue-200/50' },
  { name: '마스터', min: 25000, color: 'text-purple-500', bg: 'bg-purple-500', border: 'border-purple-200', gradient: 'from-purple-500 via-violet-600 to-violet-800', shadow: 'shadow-purple-200/50' },
  { name: '그랜드마스터', min: 25000, color: 'text-rose-500', bg: 'bg-rose-500', border: 'border-rose-200', gradient: 'from-rose-500 via-pink-600 to-rose-800', shadow: 'shadow-rose-500/50' },
  { name: '챌린저', min: 25000, color: 'text-cyan-400', bg: 'bg-cyan-400', border: 'border-cyan-200', gradient: 'from-cyan-400 via-blue-500 to-indigo-600', shadow: 'shadow-cyan-400/50' },
];

const TIER_PRESETS = [
  { label: '아이언', lp: 0, stats: 10, rank: 999, color: 'bg-slate-400' },
  { label: '실버', lp: 10000, stats: 45, rank: 50, color: 'bg-slate-300' },
  { label: '골드', lp: 15000, stats: 65, rank: 20, color: 'bg-yellow-500' },
  { label: '플래티넘', lp: 20000, stats: 80, rank: 10, color: 'bg-emerald-400' },
  { label: '다이아', lp: 25000, stats: 90, rank: 5, color: 'bg-blue-400' },
  { label: '마스터', lp: 26000, stats: 95, rank: 4, color: 'bg-purple-500' },
  { label: '그마', lp: 30000, stats: 98, rank: 2, color: 'bg-rose-500' },
  { label: '챌린저', lp: 35000, stats: 100, rank: 1, color: 'bg-cyan-400' },
];

function JacobTierController({ progressRef, currentStats, currentLp, userId, centerId, periodKey, displayName }: { progressRef: any, currentStats: any, currentLp: number, userId: string, centerId: string, periodKey: string, displayName: string }) {
  const [stats, setStats] = useState(currentStats);
  const [lp, setLp] = useState(currentLp);
  const [mockRank, setMockRank] = useState(999);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  useEffect(() => {
    setStats(currentStats);
    setLp(currentLp);
  }, [currentStats, currentLp]);

  const handleUpdate = async () => {
    if (!firestore) return;
    setIsUpdating(true);
    try {
      const batch = writeBatch(firestore);
      batch.update(progressRef, { stats: stats, seasonLp: lp, updatedAt: serverTimestamp() });
      const rankRef = doc(firestore, 'centers', centerId, 'leaderboards', `${periodKey}_lp`, 'entries', userId);
      batch.set(rankRef, { studentId: userId, displayNameSnapshot: displayName, value: lp, rank: mockRank, updatedAt: serverTimestamp() }, { merge: true });
      await batch.commit();
      toast({ title: "테스트 데이터 반영 완료" });
    } catch (e) {
      toast({ variant: "destructive", title: "보정 실패" });
    } finally {
      setIsUpdating(false);
    }
  };

  const applyPreset = (preset: typeof TIER_PRESETS[0]) => {
    setLp(preset.lp);
    setMockRank(preset.rank);
    setStats({ focus: preset.stats, consistency: preset.stats, achievement: preset.stats, resilience: preset.stats });
  };

  return (
    <Card className="border-4 border-dashed border-primary/20 bg-white/20 backdrop-blur-xl rounded-[2.5rem] p-8 mt-10 animate-in fade-in slide-in-from-bottom-4 duration-1000 ring-1 ring-black/5 shadow-2xl">
      <CardHeader className="p-0 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl text-white shadow-lg"><Settings2 className="h-5 w-5" /></div>
            <div>
              <CardTitle className="text-xl font-black tracking-tighter">Jacob's Dev Stat Controller</CardTitle>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] mt-0.5 ml-1">Rank & Tier Simulator</p>
            </div>
          </div>
          <Badge className="bg-rose-500 text-white font-black px-3 py-1 rounded-full shadow-lg">TEST ACCOUNT ONLY</Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex flex-col lg:flex-row gap-10">
        <div className="flex-1 space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><Zap className="h-3 w-3" /> 시즌 누적 LP</span>
              <span className="text-sm font-black text-primary bg-white/80 px-3 py-1 rounded-lg shadow-sm border">{lp.toLocaleString()} LP</span>
            </div>
            <Slider value={[lp]} max={40000} step={500} onValueChange={([val]) => setLp(val)} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {Object.entries({ focus: '집중력', consistency: '꾸준함', achievement: '목표달성', resilience: '회복력' }).map(([key, label]) => (
              <div key={key} className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[9px] font-black uppercase text-muted-foreground">{label}</span>
                  <span className="text-[10px] font-black text-primary">{(stats[key as keyof typeof stats] || 0).toFixed(0)}</span>
                </div>
                <Slider value={[stats[key as keyof typeof stats] || 0]} max={100} step={1} onValueChange={([val]) => setStats({ ...stats, [key]: val })} />
              </div>
            ))}
          </div>
        </div>

        <div className="lg:w-[320px] flex flex-col gap-6 shrink-0">
          <div className="grid grid-cols-3 gap-2">
            {TIER_PRESETS.map((preset) => (
              <Button key={preset.label} variant="outline" size="sm" onClick={() => applyPreset(preset)} className="rounded-xl h-12 px-0 font-black text-[10px] border-2 transition-all hover:scale-105 shadow-sm bg-white/80 flex flex-col items-center justify-center leading-none gap-1">
                <div className={cn("w-2 h-2 rounded-full", preset.color)} />{preset.label}
              </Button>
            ))}
          </div>
          <Button onClick={handleUpdate} disabled={isUpdating} className="w-full h-16 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 gap-3 active:scale-95 transition-all">
            {isUpdating ? <Loader2 className="animate-spin h-6 w-6" /> : <Wand2 className="h-6 w-6" />}시스템 상태 즉시 반영
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LPHistoryDialog({ dailyLpStatus, totalBoost }: { dailyLpStatus?: GrowthProgress['dailyLpStatus'], totalBoost: number }) {
  const sortedDates = useMemo(() => {
    if (!dailyLpStatus) return [];
    return Object.entries(dailyLpStatus).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30);
  }, [dailyLpStatus]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="border-none shadow-[0_20px_50px_rgba(0,0,0,0.08)] bg-white/90 backdrop-blur-xl rounded-[2.5rem] overflow-hidden ring-1 ring-black/[0.03] group hover:-translate-y-1 transition-all duration-500 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-10 pt-10">
            <CardTitle className="font-black uppercase tracking-widest text-muted-foreground text-[10px]">시즌 러닝 포인트 (LP)</CardTitle>
            <div className="bg-amber-50 p-2.5 rounded-xl group-hover:bg-amber-500 group-hover:text-white transition-all shadow-md"><Zap className="h-6 w-6 text-amber-600 group-hover:text-white" /></div>
          </CardHeader>
          <CardContent className="px-10 pb-10">
            <div className="font-black tracking-tighter text-amber-600 text-6xl sm:text-7xl drop-shadow-sm">
              {Object.values(dailyLpStatus || {}).reduce((acc, curr) => acc + (curr.dailyLpAmount || 0), 0).toLocaleString()}<span className="text-2xl ml-1.5 opacity-40 font-bold uppercase">lp</span>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border border-amber-100 font-black text-[10px] px-4 py-1.5 rounded-full shadow-sm hover:bg-amber-100 transition-all">히스토리 분석하기 <ChevronRight className="ml-1 h-3 w-3" /></Badge>
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse ml-2" />
              <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Season Active Track</span>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md">
        <div className="bg-accent p-10 text-white relative">
          <Sparkles className="absolute top-0 right-0 p-8 h-32 w-32 opacity-20" />
          <DialogHeader>
            <DialogTitle className="text-3xl font-black tracking-tighter">LP 획득 히스토리</DialogTitle>
            <DialogDescription className="text-white/70 font-bold mt-1">최근 30일간의 러닝 포인트 획득 내역입니다.</DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-6 max-h-[50vh] overflow-y-auto custom-scrollbar bg-[#f5f5f5]">
          {sortedDates.length === 0 ? (<div className="py-20 text-center opacity-20 italic font-black text-sm">기록된 LP가 없습니다.</div>) : (
            <div className="space-y-3">
              {sortedDates.map(([date, data]) => {
                const discreteLp = (data.attendance ? 200 : 0) + (data.plan ? 200 : 0) + (data.growth ? 200 : 0);
                const boostedDiscrete = Math.round(discreteLp * totalBoost);
                const studyLp = Math.max(0, (data.dailyLpAmount || 0) - boostedDiscrete);

                return (
                  <div key={date} className="bg-white p-5 rounded-2xl border-2 border-primary/5 flex items-center justify-between shadow-sm group hover:border-accent/20 transition-all">
                    <div className="grid gap-1">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{date}</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {data.attendance && <Badge className="bg-blue-500 text-white border-none font-black text-[8px] px-1.5">출석</Badge>}
                        {data.plan && <Badge className="bg-emerald-500 text-white border-none font-black text-[8px] px-1.5">계획</Badge>}
                        {data.growth && <Badge className="bg-purple-500 text-white border-none font-black text-[8px] px-1.5">품질</Badge>}
                        {studyLp > 0 && <Badge className="bg-blue-600 text-white border-none font-black text-[8px] px-1.5">몰입 학습</Badge>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black text-primary tabular-nums">{(data.dailyLpAmount || 0).toLocaleString()}</span>
                      <span className="text-[10px] ml-1 font-bold text-muted-foreground/40">LP</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter className="p-6 bg-white border-t justify-center">
          <DialogClose asChild>
            <Button variant="ghost" className="font-bold text-muted-foreground">닫기</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StudySessionHistoryDialog({ studentId, centerId, todayKey, h, m }: { studentId: string, centerId: string, todayKey: string, h: number, m: number }) {
  const firestore = useFirestore();
  const sessionsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !todayKey) return null;
    return query(
      collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', todayKey, 'sessions'),
      orderBy('startTime', 'desc')
    );
  }, [firestore, centerId, studentId, todayKey]);

  const { data: sessions, isLoading } = useCollection<StudySession>(sessionsQuery);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="border-none shadow-[0_20px_50px_rgba(0,0,0,0.08)] bg-white/90 backdrop-blur-xl rounded-[2.5rem] overflow-hidden ring-1 ring-black/[0.03] group hover:-translate-y-1 transition-all duration-500 relative cursor-pointer">
          <div className="absolute top-0 left-0 w-2 h-full bg-blue-600" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-10 pt-10">
            <CardTitle className="font-black uppercase tracking-widest text-muted-foreground text-[10px]">오늘의 누적 트랙</CardTitle>
            <div className="bg-blue-50 p-2.5 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-md"><Clock className="h-6 w-6 text-blue-600 group-hover:text-white" /></div>
          </CardHeader>
          <CardContent className="px-10 pb-10">
            <div className="font-black tracking-tighter text-blue-600 text-6xl sm:text-7xl drop-shadow-sm">{h}<span className="text-2xl ml-1.5 opacity-40 font-bold uppercase">h</span> {m}<span className="text-2xl ml-1.5 opacity-40 font-bold uppercase">m</span></div>
            <div className="mt-6 flex items-center gap-2">
              <Badge variant="secondary" className="bg-blue-50 text-blue-700 border border-blue-100 font-black text-[10px] px-4 py-1.5 rounded-full shadow-sm hover:bg-blue-100 transition-all">몰입 세션 보기 <ChevronRight className="ml-1 h-3 w-3" /></Badge>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-2" />
              <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">Daily Goal: 6h Focus Target</span>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md">
        <div className="bg-blue-600 p-10 text-white relative">
          <Activity className="absolute top-0 right-0 p-8 h-32 w-32 opacity-20" />
          <DialogHeader>
            <DialogTitle className="text-3xl font-black tracking-tighter">오늘의 몰입 히스토리</DialogTitle>
            <DialogDescription className="text-white/70 font-bold mt-1">오늘 완료된 몰입 세션 기록입니다.</DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-6 max-h-[50vh] overflow-y-auto custom-scrollbar bg-[#f5f5f5]">
          {isLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
          ) : !sessions || sessions.length === 0 ? (
            <div className="py-20 text-center opacity-20 italic font-black text-sm">기록된 몰입 세션이 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="bg-white p-5 rounded-2xl border-2 border-primary/5 flex items-center justify-between shadow-sm group hover:border-blue-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Timer className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="grid leading-tight">
                      <span className="font-black text-sm">{format(session.startTime.toDate(), 'HH:mm')} ~ {format(session.endTime.toDate(), 'HH:mm')}</span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Study Session Captured</span>
                    </div>
                  </div>
                  <Badge className="bg-blue-50 text-blue-700 border-none font-black text-xs px-3">{session.durationMinutes}분</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="p-6 bg-white border-t justify-center">
          <DialogClose asChild>
            <Button variant="ghost" className="font-bold text-muted-foreground">닫기</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StudentDashboard({ isActive }: { isActive: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { activeMembership, isTimerActive, setIsTimerActive, startTime, setStartTime, viewMode } = useAppContext();
  
  const [today, setToday] = useState<Date | null>(null);
  const [localSeconds, setLocalSeconds] = useState(0);
  const isMobile = viewMode === 'mobile';
  
  useEffect(() => { setToday(new Date()); }, []);

  const todayKey = today ? format(today, 'yyyy-MM-dd') : '';
  const weekKey = today ? format(today, "yyyy-'W'II") : '';
  const periodKey = today ? format(today, 'yyyy-MM') : '';

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && startTime) {
      setLocalSeconds(Math.floor((Date.now() - startTime) / 1000));
      interval = setInterval(() => { setLocalSeconds(Math.floor((Date.now() - startTime) / 1000)); }, 1000);
    } else { setLocalSeconds(0); }
    return () => clearInterval(interval);
  }, [isTimerActive, startTime]);

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: progress } = useDoc<GrowthProgress>(progressRef, { enabled: isActive });

  const stats = useMemo(() => {
    const raw = progress?.stats || { focus: 0, consistency: 0, achievement: 0, resilience: 0 };
    return {
      focus: Math.min(100, raw.focus),
      consistency: Math.min(100, raw.consistency),
      achievement: Math.min(100, raw.achievement),
      resilience: Math.min(100, raw.resilience),
    };
  }, [progress?.stats]);

  const avgStat = useMemo(() => {
    const values = Object.values(stats);
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [stats]);

  const rankQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_lp`, 'entries'), where('studentId', '==', user.uid));
  }, [firestore, activeMembership?.id, user?.uid, periodKey]);
  const { data: rankEntries } = useCollection<LeaderboardEntry>(rankQuery);
  const currentRank = rankEntries?.[0]?.rank || 999;

  const currentLp = progress?.seasonLp || 0;
  const currentTier = useMemo(() => {
    if (currentLp >= 25000) {
      if (currentRank === 1) return TIERS.find(t => t.name === '챌린저')!;
      if (currentRank === 2 || currentRank === 3) return TIERS.find(t => t.name === '그랜드마스터')!;
      return TIERS.find(t => t.name === '마스터')!;
    }
    return TIERS.slice(0, 6).reverse().find(t => currentLp >= t.min) || TIERS[0];
  }, [currentLp, currentRank]);

  const totalBoost = Math.min(1.20, 1 + (avgStat / 100) * 0.10);

  const studyLogRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || !todayKey) return null;
    return doc(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days', todayKey);
  }, [firestore, activeMembership, user, todayKey]);
  const { data: todayStudyLog } = useDoc<StudyLogDay>(studyLogRef, { enabled: isActive });

  const allPlansRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || !weekKey || !todayKey) return null;
    return query(collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items'), where('dateKey', '==', todayKey));
  }, [firestore, activeMembership, user, weekKey, todayKey]);
  const { data: todayPlans } = useCollection<StudyPlanItem>(allPlansRef, { enabled: isActive });
  
  const scheduleItems = useMemo(() => todayPlans?.filter(p => p.category === 'schedule') || [], [todayPlans]);
  const studyTasks = useMemo(() => todayPlans?.filter(p => p.category === 'study' || !p.category) || [], [todayPlans]);

  const handleStudyStartStop = async () => {
    if (!firestore || !user || !activeMembership || !progressRef) return;
    
    if (isTimerActive) {
      const nowTs = Date.now();
      const sessionMinutes = Math.floor((nowTs - (startTime || nowTs)) / 60000);
      
      const batch = writeBatch(firestore);
      const updateData: any = { updatedAt: serverTimestamp() };
      
      if (sessionMinutes > 0) {
        // 1. 순수 공부 시간 LP 보상 (분당 1 LP * 부스트)
        const studyLpEarned = Math.round(sessionMinutes * totalBoost);
        
        // 2. 3시간(180분) 달성 시 출석 보너스 LP 로직 (200 LP * 부스트)
        const currentCumulativeMinutes = todayStudyLog?.totalMinutes || 0;
        const totalMinutesAfterSession = currentCumulativeMinutes + sessionMinutes;
        
        // 3시간 이상 공부했고, 아직 출석 보너스를 받지 않았다면 지급
        if (totalMinutesAfterSession >= 180 && !progress?.dailyLpStatus?.[todayKey]?.attendance) {
          const attendanceLp = Math.round(200 * totalBoost);
          updateData.seasonLp = increment(studyLpEarned + attendanceLp);
          updateData[`dailyLpStatus.${todayKey}.dailyLpAmount`] = increment(studyLpEarned + attendanceLp);
          updateData[`dailyLpStatus.${todayKey}.attendance`] = true;
          updateData['stats.consistency'] = increment(0.1);
          toast({ title: "3시간 달성! 출석 보너스 LP 획득 🎉" });
        } else {
          updateData.seasonLp = increment(studyLpEarned);
          updateData[`dailyLpStatus.${todayKey}.dailyLpAmount`] = increment(studyLpEarned);
        }

        // 스탯 업데이트
        updateData['stats.focus'] = increment(sessionMinutes / 100); 
        
        // 공부 로그 및 세션 기록 저장
        batch.set(studyLogRef!, { totalMinutes: increment(sessionMinutes), studentId: user.uid, centerId: activeMembership.id, dateKey: todayKey, updatedAt: serverTimestamp() }, { merge: true });
        
        const sessionRef = doc(collection(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days', todayKey, 'sessions'));
        batch.set(sessionRef, { startTime: Timestamp.fromMillis(startTime!), endTime: Timestamp.fromMillis(nowTs), durationMinutes: sessionMinutes, createdAt: serverTimestamp() });
        
        batch.update(progressRef, updateData);
        await batch.commit();
      }
      
      setIsTimerActive(false); 
      setStartTime(null); 
      toast({ title: "트랙 종료됨" });
    } else {
      // 공부 시작 (타이머 작동)
      setStartTime(Date.now()); 
      setIsTimerActive(true);
      toast({ title: "트랙 시작! 3시간 공부 시 보너스 LP가 지급됩니다." });
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
    }
  };

  if (!isActive) return null;
  const totalMinutes = (todayStudyLog?.totalMinutes || 0) + Math.floor(localSeconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const isJacob = user?.email === 'jacob444@naver.com';

  return (
    <div className={cn("flex flex-col gap-6 sm:gap-10 pb-24 relative z-10")}>
      <section className={cn("group relative overflow-hidden text-white shadow-2xl transition-all duration-700 rounded-[2.5rem] p-8 sm:rounded-[3rem] sm:p-12 bg-gradient-to-br", currentTier.gradient, currentTier.shadow)}>
        <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-10 rotate-12 transition-transform duration-1000 group-hover:scale-110 group-hover:rotate-45">
          {currentTier.name === '챌린저' ? <Crown className="h-48 w-48 sm:h-64 sm:w-64" /> : <Trophy className="h-48 w-48 sm:h-64 sm:w-64" />}
        </div>
        <div className={cn("relative z-10 flex flex-col gap-8", isMobile ? "items-center text-center" : "md:flex-row md:justify-between md:text-left")}>
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <Badge className="w-fit bg-white/20 text-white border-none font-black text-[10px] tracking-[0.3em] uppercase px-3 py-1 mb-2">{currentTier.name} Tier Active</Badge>
              <h2 className={cn("font-black tracking-tighter leading-[1.1] whitespace-pre-line", isMobile ? "text-4xl" : "text-6xl")}>{isTimerActive ? "트랙의 정점에\n도달하셨네요 !" : "오늘의 성장을 위해\n트랙을 시작하세요"}</h2>
            </div>
            <div className={cn("flex items-center gap-3 bg-white/10 backdrop-blur-xl w-fit px-5 py-2.5 rounded-full border border-white/20 shadow-2xl", isMobile ? "mx-auto" : "md:mx-0")}><span className="relative flex h-2.5 w-2.5"><span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", isTimerActive ? "bg-accent" : "bg-white")}></span><span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", isTimerActive ? "bg-accent" : "bg-white")}></span></span><span className="text-[11px] font-black uppercase tracking-[0.2em] opacity-90 whitespace-nowrap">Live Performance Engine</span></div>
          </div>
          <div className={cn("flex flex-col sm:flex-row items-center gap-5 sm:gap-8 w-full md:w-auto")}>
            {isTimerActive && (
              <div className={cn("flex flex-col items-center bg-black/20 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] shrink-0 w-full sm:w-auto px-10 py-6 sm:px-12 sm:py-8")}>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50 mb-2">Live Session</span>
                <span className="font-mono font-black tracking-tighter tabular-nums text-white text-6xl leading-none">{Math.floor(localSeconds / 60).toString().padStart(2, '0')}:{(localSeconds % 60).toString().padStart(2, '0')}</span>
              </div>
            )}
            <button className={cn("w-full rounded-[2.5rem] font-black transition-all md:w-auto shadow-2xl active:scale-95 border-none flex items-center justify-center gap-3 whitespace-nowrap", isMobile ? "h-20 text-2xl" : "h-24 px-16 text-3xl", isTimerActive ? "bg-rose-500 hover:bg-rose-600 text-white" : "bg-white text-primary hover:bg-slate-50")} onClick={handleStudyStartStop}>
              {isTimerActive ? <>트랙 종료 <Square className="h-8 w-8 fill-current" /></> : <>트랙 시작 <Play className="h-8 w-8 fill-current" /></>}
            </button>
          </div>
        </div>
      </section>

      <div className={cn("grid gap-4 sm:gap-6", isMobile ? "grid-cols-1" : "sm:grid-cols-2")}>
        <StudySessionHistoryDialog studentId={user!.uid} centerId={activeMembership!.id} todayKey={todayKey} h={h} m={m} />
        <LPHistoryDialog dailyLpStatus={progress?.dailyLpStatus} totalBoost={totalBoost} />
      </div>

      <Card className={cn("border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/[0.03]")}>
        <div className="grid grid-cols-1 lg:grid-cols-3">
          {/* Left Side: Study Plans (2/3 width) */}
          <div className="lg:col-span-2 border-r border-dashed border-muted">
            <CardHeader className="bg-emerald-50/30 border-b p-8 sm:p-10">
              <div className="flex items-center justify-between">
                <CardTitle className="font-black flex items-center gap-4 tracking-tighter text-3xl text-primary">
                  <ListTodo className="h-8 w-8 text-emerald-600" /> 오늘의 계획트랙
                </CardTitle>
                <Badge variant="secondary" className="bg-emerald-500 text-white border-none font-black text-[10px] px-3 h-7 uppercase tracking-widest">
                  {studyTasks.filter(t => t.done).length} / {studyTasks.length} DONE
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8 sm:p-10 bg-emerald-50/5">
              <div className="grid gap-4">
                {studyTasks.length === 0 ? (
                  <div className="py-20 text-center opacity-20 italic font-black text-sm border-2 border-dashed border-emerald-200 rounded-[2.5rem]">등록된 학습 계획이 없습니다.</div>
                ) : studyTasks.map((task) => (
                  <div key={task.id} className={cn(
                    "flex items-center gap-6 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border-2 transition-all duration-500 relative group", 
                    task.done ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white border-transparent shadow-sm hover:shadow-md hover:border-primary/10"
                  )}>
                    <div className="relative">
                      <Checkbox id={task.id} checked={task.done} onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} className="h-10 w-10 rounded-2xl border-2 transition-all data-[state=checked]:scale-110 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" />
                      {task.done && <Check className="absolute inset-0 m-auto h-6 w-6 text-white stroke-[4px]" />}
                    </div>
                    <div className="flex-1 grid gap-1.5">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[9px] px-2 py-0">STUDY</Badge>
                        {task.targetMinutes && <span className="text-[10px] font-black text-muted-foreground/40 uppercase flex items-center gap-1"><Clock className="h-3 w-3" /> {task.targetMinutes}m Goal</span>}
                      </div>
                      <Label htmlFor={task.id} className={cn("font-black text-lg sm:text-xl tracking-tight transition-all leading-snug", task.done ? "line-through text-muted-foreground/40 italic" : "text-primary/80")}>{task.title}</Label>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-all"><ChevronRight className="h-5 w-5 text-muted-foreground/20" /></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </div>

          {/* Right Side: Routines (1/3 width) */}
          <div className="lg:col-span-1 bg-amber-50/20">
            <CardHeader className="bg-amber-100/30 border-b p-8 sm:p-10">
              <CardTitle className="font-black flex items-center gap-4 tracking-tighter text-amber-700 text-2xl sm:text-3xl">
                <Timer className="h-8 w-8 text-amber-600" /> 오늘의 루틴
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 sm:p-10 flex flex-col gap-4">
              {scheduleItems.length === 0 ? (
                <div className="py-20 text-center opacity-20 italic font-black text-sm border-2 border-dashed border-amber-200 rounded-[2.5rem]">등록된 루틴이 없습니다.</div>
              ) : scheduleItems.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 p-6 sm:p-8 rounded-[2rem] bg-white border-2 border-transparent shadow-md group hover:border-amber-300 transition-all active:scale-[0.98] items-center text-center">
                  <div className="p-3 rounded-2xl bg-amber-50 group-hover:bg-amber-500 group-hover:text-white transition-all text-amber-600 shadow-sm shrink-0 mb-2">
                    <Timer className="h-6 w-6" />
                  </div>
                  <span className="font-black tracking-tight text-primary text-lg w-full break-keep">{item.title.split(': ')[0]}</span>
                  <Badge variant="outline" className="font-mono font-black text-amber-600 text-lg px-5 py-2 rounded-2xl border-amber-200 bg-amber-50/50 shadow-inner">
                    {item.title.split(': ')[1] || '--:--'}
                  </Badge>
                </div>
              ))}
              
              <div className="mt-auto p-6 rounded-[2rem] bg-white/50 border-2 border-dashed border-amber-200 flex flex-col items-center gap-2 text-center shadow-inner">
                <Sparkles className="h-6 w-6 text-amber-400 animate-pulse" />
                <p className="text-[11px] font-bold text-muted-foreground leading-relaxed">
                  모든 루틴을 지키면<br/>
                  <span className="text-amber-600 font-black text-sm">추가 보너스 LP</span>를 기대할 수 있습니다.
                </p>
              </div>
            </CardContent>
          </div>
        </div>
      </Card>

      {isJacob && progressRef && <JacobTierController progressRef={progressRef} currentStats={stats} currentLp={currentLp} userId={user.uid} centerId={activeMembership.id} periodKey={periodKey} displayName={user.displayName || 'Jacob'} />}
    </div>
  );
}
