
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
  Calendar,
  FileText,
  ClipboardPen,
  AlertOctagon,
  BellRing,
  Info,
  ShieldAlert,
  ArrowRight,
  ClipboardCheck,
  UserCheck,
  CalendarX,
  UserMinus,
  QrCode
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { useDoc, useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { doc, collection, query, where, updateDoc, setDoc, serverTimestamp, increment, writeBatch, Timestamp, getDoc, orderBy, addDoc, limit, getDocs } from 'firebase/firestore';
import { format, isSameDay } from 'date-fns';
import { useEffect, useState, useMemo, useCallback } from 'react';
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
import Link from 'next/link';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DailyStudentStat, StudyPlanItem, WithId, StudyLogDay, GrowthProgress, StudentProfile, LeaderboardEntry, StudySession, AttendanceRequest, 센터Membership, AttendanceCurrent } from '@/lib/types';
import { sendKakaoNotification } from '@/lib/kakao-service';
import { QRCodeSVG } from 'qrcode.react';

const 티어_PRESETS = [
  { label: '브론즈', lp: 0, stats: 10, rank: 999, color: 'bg-orange-700' },
  { label: '실버', lp: 5000, stats: 45, rank: 50, color: 'bg-slate-300' },
  { label: '골드', lp: 10000, stats: 65, rank: 20, color: 'bg-yellow-500' },
  { label: '플래티넘', lp: 15000, stats: 80, rank: 10, color: 'bg-emerald-400' },
  { label: '다이아', lp: 20000, stats: 90, rank: 5, color: 'bg-blue-400' },
  { label: '마스터', lp: 26000, stats: 95, rank: 4, color: 'bg-purple-500' },
  { label: '그마', lp: 30000, stats: 98, rank: 2, color: 'bg-rose-500' },
  { label: '챌린저', lp: 35000, stats: 100, rank: 1, color: 'bg-cyan-400' },
];

function JacobTierController({ progressRef, currentStats, currentLp, userId, centerId, periodKey, displayName, className }: { progressRef: any, currentStats: any, currentLp: number, userId: string, centerId: string, periodKey: string, displayName: string, className?: string }) {
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
      batch.set(rankRef, { 
        studentId: userId, 
        displayNameSnapshot: displayName, 
        classNameSnapshot: className || null, 
        value: lp, 
        rank: mockRank, 
        updatedAt: serverTimestamp() 
      }, { merge: true });
      await batch.commit();
      toast({ title: "테스트 데이터 반영 완료" });
    } catch (e) {
      toast({ variant: "destructive", title: "보정 실패" });
    } finally {
      setIsUpdating(false);
    }
  };

  const applyPreset = (preset: typeof 티어_PRESETS[0]) => {
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
              <CardTitle className="text-xl font-black tracking-tighter">개발용 스탯 컨트롤러</CardTitle>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] mt-0.5 ml-1">랭크·티어 시뮬레이터</p>
            </div>
          </div>
          <Badge className="bg-rose-500 text-white font-black px-3 py-1 rounded-full shadow-lg">테스트 계정 전용</Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex flex-col lg:flex-row gap-10">
        <div className="flex-1 space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black uppercase text-primary flex items-center gap-2"><Zap className="h-3 w-3" /> 시즌 누적 포인트</span>
              <span className="text-sm font-black text-primary bg-white/80 px-3 py-1 rounded-lg shadow-sm border">{lp.toLocaleString()}점</span>
            </div>
            <Slider value={[lp]} max={45000} step={500} onValueChange={([val]) => setLp(val)} />
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

function LPHistoryDialog({ dailyLpStatus, totalBoost, isMobile }: { dailyLpStatus?: GrowthProgress['dailyLpStatus'], totalBoost: number, isMobile: boolean }) {
  const sortedDates = useMemo(() => {
    if (!dailyLpStatus) return [];
    return Object.entries(dailyLpStatus).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30);
  }, [dailyLpStatus]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className={cn(
          "border-none shadow-[0_20px_50px_rgba(0,0,0,0.08)] bg-white/90 backdrop-blur-xl rounded-[2.5rem] overflow-hidden ring-1 ring-black/[0.03] group hover:-translate-y-1 transition-all duration-500 cursor-pointer",
          isMobile ? "rounded-[1.5rem]" : ""
        )}>
          <CardHeader className={cn("flex flex-row items-center justify-between pb-2 px-10 pt-10", isMobile ? "px-5 pt-5" : "")}>
            <CardTitle className={cn("font-black uppercase tracking-widest text-muted-foreground", isMobile ? "text-[8px]" : "text-[10px]")}>시즌 러닝 포인트</CardTitle>
            <div className={cn("bg-amber-50 rounded-xl group-hover:bg-amber-500 group-hover:text-white transition-all shadow-md", isMobile ? "p-1.5" : "p-2.5")}>
              <Zap className={cn("text-amber-600 group-hover:text-white", isMobile ? "h-4 w-4" : "h-6 w-6")} />
            </div>
          </CardHeader>
          <CardContent className={cn("px-10 pb-10", isMobile ? "px-5 pb-5" : "")}>
            <div className={cn("font-black tracking-tighter text-amber-600 drop-shadow-sm leading-none", isMobile ? "text-3xl" : "text-6xl sm:text-7xl")}>
              {Object.values(dailyLpStatus || {}).reduce((acc, curr) => acc + (curr.dailyLpAmount || 0), 0).toLocaleString()}<span className={cn("opacity-40 font-bold uppercase", isMobile ? "text-xs ml-1" : "text-xl ml-1.5")}>점</span>
            </div>
            <div className={cn("flex items-center gap-2 mt-4", isMobile ? "mt-3" : "mt-6")}>
                <Badge
                  variant="secondary"
                  className={cn(
                    "font-body border-[#e87010]/60 bg-[linear-gradient(180deg,#ff9a48,#ff7a16)] text-white font-extrabold leading-none shadow-[0_1px_0_rgba(255,255,255,0.28)_inset,0_2px_8px_rgba(255,122,22,0.25)] transition-all hover:brightness-105",
                    isMobile ? "h-7 px-2.5 text-[11px]" : "h-8 px-3.5 text-[12px]"
                  )}
                >
                  히스토리 분석 <ChevronRight className={cn("ml-1", isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} />
                </Badge>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className={cn("rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md", isMobile ? "max-w-[90vw] rounded-[2rem]" : "")}>
        <div className={cn("bg-accent text-white relative", isMobile ? "p-6" : "p-10")}>
          <Sparkles className="absolute top-0 right-0 p-8 h-32 w-32 opacity-20" />
          <DialogHeader>
            <DialogTitle className={cn("font-black tracking-tighter", isMobile ? "text-xl" : "text-3xl")}>포인트 획득 기록</DialogTitle>
            <DialogDescription className="text-white/70 font-bold mt-1 text-xs">최근 30일간의 러닝 포인트 내역입니다.</DialogDescription>
          </DialogHeader>
        </div>
        <div className={cn("p-6 max-h-[50vh] overflow-y-auto custom-scrollbar bg-[#f5f5f5]", isMobile ? "p-4" : "")}>
          {sortedDates.length === 0 ? (<div className="py-20 text-center opacity-20 italic font-black text-sm">기록된 포인트가 없습니다.</div>) : (
            <div className="space-y-2">
              {sortedDates.map(([date, data]) => {
                const discreteLp = (data.attendance ? 100 : 0) + (data.plan ? 100 : 0) + (data.routine ? 100 : 0);
                const boostedDiscrete = Math.round(discreteLp * totalBoost);
                const studyLp = Math.max(0, (data.dailyLpAmount || 0) - boostedDiscrete);

                return (
                  <div key={date} className="bg-white p-4 rounded-xl border-2 border-primary/5 flex items-center justify-between shadow-sm group">
                    <div className="grid gap-0.5">
                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{date}</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {data.attendance && <Badge className="bg-blue-500 text-white border-none font-black text-[7px] px-1 py-0">출석</Badge>}
                        {data.plan && <Badge className="bg-emerald-500 text-white border-none font-black text-[7px] px-1 py-0">계획</Badge>}
                        {data.routine && <Badge className="bg-amber-500 text-white border-none font-black text-[7px] px-1 py-0">루틴</Badge>}
                        {studyLp > 0 && <Badge className="bg-blue-600 text-white border-none font-black text-[7px] px-1 py-0">몰입</Badge>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-primary tabular-nums">{(data.dailyLpAmount || 0).toLocaleString()}</span>
                      <span className="text-[8px] ml-0.5 font-bold text-muted-foreground/40">점</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter className={cn("bg-white border-t justify-center", isMobile ? "p-4" : "p-6")}>
          <DialogClose asChild>
            <Button variant="ghost" className="font-bold text-muted-foreground h-10">닫기</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StudySessionHistoryDialog({ studentId, centerId, todayKey, h, m, isMobile }: { studentId: string, centerId: string, todayKey: string, h: number, m: number, isMobile: boolean }) {
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
        <Card className={cn(
          "border-none shadow-[0_20px_50px_rgba(0,0,0,0.08)] bg-white/90 backdrop-blur-xl rounded-[2.5rem] overflow-hidden ring-1 ring-black/[0.03] group hover:-translate-y-1 transition-all duration-500 cursor-pointer",
          isMobile ? "rounded-[1.5rem]" : ""
        )}>
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600" />
          <CardHeader className={cn("flex flex-row items-center justify-between pb-2 px-10 pt-10", isMobile ? "px-5 pt-5" : "")}>
            <CardTitle className={cn("font-black uppercase tracking-widest text-muted-foreground", isMobile ? "text-[8px]" : "text-[10px]")}>오늘의 누적 트랙</CardTitle>
            <div className={cn("bg-blue-50 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-md", isMobile ? "p-1.5" : "p-2.5")}>
              <Clock className={cn("text-blue-600 group-hover:text-white", isMobile ? "h-4 w-4" : "h-6 w-6")} />
            </div>
          </CardHeader>
          <CardContent className={cn("px-10 pb-10", isMobile ? "px-5 pb-5" : "")}>
            <div className={cn("font-black tracking-tighter text-blue-600 drop-shadow-sm leading-none", isMobile ? "text-3xl" : "text-6xl sm:text-7xl")}>
              {h}<span className={cn("opacity-40 font-bold uppercase", isMobile ? "text-xs ml-1" : "text-xl ml-1.5")}>시간</span> {m}<span className={cn("opacity-40 font-bold uppercase", isMobile ? "text-xs ml-1" : "text-xl ml-1.5")}>분</span>
            </div>
            <div className={cn("mt-4 flex items-center gap-2", isMobile ? "mt-3" : "mt-6")}>
                <Badge
                  variant="secondary"
                  className={cn(
                    "font-body border-[#e87010]/60 bg-[linear-gradient(180deg,#ff9a48,#ff7a16)] text-white font-extrabold leading-none shadow-[0_1px_0_rgba(255,255,255,0.28)_inset,0_2px_8px_rgba(255,122,22,0.25)] transition-all hover:brightness-105",
                    isMobile ? "h-7 px-2.5 text-[11px]" : "h-8 px-3.5 text-[12px]"
                  )}
                >
                  세션 보기 <ChevronRight className={cn("ml-1", isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} />
                </Badge>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className={cn("rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md", isMobile ? "max-w-[90vw] rounded-[2rem]" : "")}>
        <div className={cn("bg-blue-600 text-white relative", isMobile ? "p-6" : "p-10")}>
          <Activity className="absolute top-0 right-0 p-8 h-32 w-32 opacity-20" />
          <DialogHeader>
            <DialogTitle className={cn("font-black tracking-tighter", isMobile ? "text-xl" : "text-3xl")}>몰입 히스토리</DialogTitle>
            <DialogDescription className="text-white/70 font-bold mt-1 text-xs">오늘 완료된 몰입 세션입니다.</DialogDescription>
          </DialogHeader>
        </div>
        <div className={cn("p-6 max-h-[50vh] overflow-y-auto custom-scrollbar bg-[#f5f5f5]", isMobile ? "p-4" : "")}>
          {isLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
          ) : !sessions || sessions.length === 0 ? (
            <div className="py-20 text-center opacity-20 italic font-black text-sm">기록된 세션이 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div key={session.id} className="bg-white p-4 rounded-xl border-2 border-primary/5 flex items-center justify-between shadow-sm group">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Timer className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="grid leading-tight">
                      <span className="font-black text-xs">{format(session.startTime.toDate(), 'HH:mm')} ~ {format(session.endTime.toDate(), 'HH:mm')}</span>
                      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter">기록됨</span>
                    </div>
                  </div>
                  <Badge className="bg-blue-50 text-blue-700 border-none font-black text-[9px] px-2">{session.durationMinutes}분</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className={cn("bg-white border-t justify-center", isMobile ? "p-4" : "p-6")}>
          <DialogClose asChild>
            <Button variant="ghost" className="font-bold text-muted-foreground h-10">닫기</Button>
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
  const { activeMembership, isTimerActive, setIsTimerActive, startTime, setStartTime, viewMode, currentTier } = useAppContext();
  
  const [today, setToday] = useState<Date | null>(null);
  const [localSeconds, setLocalSeconds] = useState(0);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const isMobile = viewMode === 'mobile';
  
  // 지각/결석 신청서 상태
  const [requestType, setRequestType] = useState<'late' | 'absence'>('late');
  const [requestDate, setRequestDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [requestReason, setRequestReason] = useState('');
  const [isRequestSubmitting, setIsRequestSubmitting] = useState(false);

  useEffect(() => { setToday(new Date()); }, []);

  const todayKey = today ? format(today, 'yyyy-MM-dd') : '';
  const weekKey = today ? format(today, "yyyy-'W'II") : '';
  const periodKey = today ? format(today, 'yyyy-MM') : '';

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: progress } = useDoc<GrowthProgress>(progressRef, { enabled: isActive });

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

  const handleStudyStartStop = useCallback(async () => {
    if (!firestore || !user || !activeMembership || !progressRef || isProcessingAction) return;
    
    setIsProcessingAction(true);
    try {
      const centerId = activeMembership.id;
      let seatDoc: any = null;
      try {
        const attendanceCurrentRef = collection(firestore, 'centers', centerId, 'attendanceCurrent');
        const seatQuery = query(attendanceCurrentRef, where('studentId', '==', user.uid));
        const seatSnap = await getDocs(seatQuery);
        seatDoc = !seatSnap.empty ? seatSnap.docs[0] : null;
      } catch (seatError: any) {
        console.warn('[student-track] seat lookup skipped', seatError?.message || seatError);
      }

      if (isTimerActive) {
        const nowTs = Date.now();
        const sessionSeconds = Math.max(0, Math.floor((nowTs - (startTime || nowTs)) / 1000));
        const sessionMinutes = Math.max(1, Math.ceil(sessionSeconds / 60));
        
        const batch = writeBatch(firestore);
        const updateData: any = { updatedAt: serverTimestamp() };
        let finalNewLp = progress?.seasonLp || 0;
        
        if (sessionSeconds > 0) {
          const stats = progress?.stats || { focus: 0, consistency: 0, achievement: 0, resilience: 0 };
          const totalBoost = 1 + (stats.focus/100 * 0.05) + (stats.consistency/100 * 0.05) + (stats.achievement/100 * 0.05) + (stats.resilience/100 * 0.05);
          const penaltyPoints = progress?.penaltyPoints || 0;
          const penaltyRate = penaltyPoints >= 30 ? 0.15 : penaltyPoints >= 20 ? 0.10 : penaltyPoints >= 10 ? 0.06 : penaltyPoints >= 5 ? 0.03 : 0;
          const finalMultiplier = totalBoost * (1 - penaltyRate);

          let studyLpEarned = Math.round(sessionMinutes * finalMultiplier);
          updateData['stats.focus'] = increment((sessionMinutes / 60) * 0.1); 

          const currentCumulativeMinutes = todayStudyLog?.totalMinutes || 0;
          const totalMinutesAfterSession = currentCumulativeMinutes + sessionMinutes;
          
          if (totalMinutesAfterSession >= 180 && !progress?.dailyLpStatus?.[todayKey]?.attendance) {
            studyLpEarned += Math.round(100 * finalMultiplier);
            updateData[`dailyLpStatus.${todayKey}.attendance`] = true;
            toast({ title: "3시간 달성! 출석 보너스 포인트 획득 🎉" });
          }

          if (totalMinutesAfterSession >= 360 && !progress?.dailyLpStatus?.[todayKey]?.bonus6h) {
            updateData['stats.resilience'] = increment(0.5);
            updateData[`dailyLpStatus.${todayKey}.bonus6h`] = true;
            toast({ title: "6시간 몰입 달성! 회복력 스탯 상승 🎉" });
          }

          finalNewLp += studyLpEarned;
          updateData.seasonLp = increment(studyLpEarned);
          updateData[`dailyLpStatus.${todayKey}.dailyLpAmount`] = increment(studyLpEarned);
          
          batch.set(studyLogRef!, { totalMinutes: increment(sessionMinutes), studentId: user.uid, centerId: activeMembership.id, dateKey: todayKey, updatedAt: serverTimestamp() }, { merge: true });
          
          const statRef = doc(firestore, 'centers', centerId, 'dailyStudentStats', todayKey, 'students', user.uid);
          batch.set(statRef, { 
            totalStudyMinutes: increment(sessionMinutes), 
            studentId: user.uid, 
            centerId, 
            dateKey: todayKey, 
            updatedAt: serverTimestamp() 
          }, { merge: true });

          const sessionRef = doc(collection(firestore, 'centers', centerId, 'studyLogs', user.uid, 'days', todayKey, 'sessions'));
          batch.set(sessionRef, { startTime: Timestamp.fromMillis(startTime!), endTime: Timestamp.fromMillis(nowTs), durationMinutes: sessionMinutes, createdAt: serverTimestamp() });
          
          batch.update(progressRef, updateData);

          // 랭킹 보드 스냅샷 업데이트
          const rankRef = doc(firestore, 'centers', centerId, 'leaderboards', `${periodKey}_lp`, 'entries', user.uid);
          batch.set(rankRef, {
            studentId: user.uid,
            displayNameSnapshot: user.displayName || '학생',
            classNameSnapshot: activeMembership.className || null,
            value: finalNewLp,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }

        if (seatDoc) {
          batch.update(seatDoc.ref, { status: 'absent', updatedAt: serverTimestamp() });
        }
        
        await batch.commit();

        // 카카오 알림톡 발송 (퇴실)
        sendKakaoNotification(firestore, centerId, {
          studentName: user.displayName || '학생',
          type: 'exit'
        });

        setIsTimerActive(false); 
        setStartTime(null); 
        toast({ title: "트랙 종료됨" });
      } else {
        const nowTs = Date.now();
        const batch = writeBatch(firestore);

        if (!progress?.dailyLpStatus?.[todayKey]?.checkedIn) {
          batch.update(progressRef, {
            'stats.consistency': increment(0.5),
            [`dailyLpStatus.${todayKey}.checkedIn`]: true,
            updatedAt: serverTimestamp()
          });
          toast({ title: "입실 확인! 꾸준함 스탯 +0.5 상승 🎉" });
        }

        if (seatDoc) {
          batch.update(seatDoc.ref, { 
            status: 'studying', 
            lastCheckInAt: Timestamp.fromMillis(nowTs),
            updatedAt: serverTimestamp() 
          });
        }

        await batch.commit();

        // 카카오 알림톡 발송 (입실)
        sendKakaoNotification(firestore, centerId, {
          studentName: user.displayName || '학생',
          type: 'entry'
        });

        setStartTime(nowTs); 
        setIsTimerActive(true);
      }
    } catch (e: any) {
      console.error("Action error:", e);
      toast({ variant: "destructive", title: "처리 중 오류 발생", description: "잠시 후 다시 시도해 주세요." });
    } finally {
      setIsProcessingAction(false);
    }
  }, [firestore, user, activeMembership, progressRef, isTimerActive, startTime, progress, todayStudyLog, todayKey, periodKey, setIsTimerActive, setStartTime, toast]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && startTime) {
      const updateSeconds = () => {
        const diff = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
        
        // 4시간 (14400초) 초과 시 자동 종료
        if (diff >= 14400) {
          handleStudyStartStop();
          toast({ 
            variant: "destructive", 
            title: "학습 세션 자동 종료", 
            description: "집중 보호를 위해 4시간이 경과하여 세션이 자동으로 종료되었습니다." 
          });
          return;
        }
        
        setLocalSeconds(diff);
      };
      updateSeconds();
      interval = setInterval(updateSeconds, 1000);
    } else { 
      setLocalSeconds(0); 
    }
    return () => clearInterval(interval);
  }, [isTimerActive, startTime, handleStudyStartStop, toast]);

  const stats = useMemo(() => {
    const raw = progress?.stats || { focus: 0, consistency: 0, achievement: 0, resilience: 0 };
    return {
      focus: Math.min(100, raw.focus),
      consistency: Math.min(100, raw.consistency),
      achievement: Math.min(100, raw.achievement),
      resilience: Math.min(100, raw.resilience),
    };
  }, [progress?.stats]);

  const totalBoost = 1 + (stats.focus/100 * 0.05) + (stats.consistency/100 * 0.05) + (stats.achievement/100 * 0.05) + (stats.resilience/100 * 0.05);
  const penaltyPoints = progress?.penaltyPoints || 0;
  const penaltyRate = useMemo(() => {
    if (penaltyPoints >= 30) return 0.15; 
    if (penaltyPoints >= 20) return 0.10; 
    if (penaltyPoints >= 10) return 0.06; 
    if (penaltyPoints >= 5) return 0.03;  
    return 0; 
  }, [penaltyPoints]);
  const finalMultiplier = totalBoost * (1 - penaltyRate);

  const studyTasks = useMemo(() => todayPlans?.filter(p => p.category === 'study' || !p.category) || [], [todayPlans]);
  const scheduleItems = useMemo(() => todayPlans?.filter(p => p.category === 'schedule') || [], [todayPlans]);

  const my요청Query = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'attendance요청'),
      where('studentId', '==', user.uid)
    );
  }, [firestore, activeMembership, user]);
  const { data: raw요청 } = useCollection<AttendanceRequest>(my요청Query, { enabled: isActive });

  const my요청 = useMemo(() => {
    if (!raw요청) return [];
    return [...raw요청]
      .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
      .slice(0, 5);
  }, [raw요청]);

  const handleRequestSubmit = async () => {
    if (!firestore || !activeMembership || !user || !requestReason.trim() || !requestDate) return;
    if (requestReason.trim().length < 10) {
      toast({ variant: "destructive", title: "사유 부족", description: "사유를 10자 이상 구체적으로 적어주세요." });
      return;
    }

    setIsRequestSubmitting(true);
    try {
      const requestData: any = {
        studentId: user.uid,
        studentName: user.displayName || '학생',
        centerId: activeMembership.id,
        type: requestType,
        date: requestDate,
        reason: requestReason.trim(),
        status: 'requested',
        penaltyApplied: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(firestore, 'centers', activeMembership.id, 'attendance요청'), requestData);
      toast({ title: "신청서가 제출되었습니다. 선생님의 승인을 기다려주세요." });
      setRequestReason('');
    } catch (e: any) {
      toast({ variant: "destructive", title: "제출 실패", description: e.message });
    } finally {
      setIsRequestSubmitting(false);
    }
  };

  const handleToggleTask = async (item: WithId<StudyPlanItem>) => {
    if (!firestore || !user || !activeMembership || !progressRef || !weekKey || !todayPlans) return;
    const itemRef = doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id);
    const nextState = !item.done;
    
    await updateDoc(itemRef, { done: nextState, updatedAt: serverTimestamp() });
    
    if (nextState) {
      const batch = writeBatch(firestore);
      const achievementCount = progress?.dailyLpStatus?.[todayKey]?.achievementCount || 0;
      if (achievementCount < 5) {
        batch.update(progressRef, { 
          'stats.achievement': increment(0.1),
          [`dailyLpStatus.${todayKey}.achievementCount`]: increment(1)
        });
      }

      const currentStudyTasks = todayPlans.filter(p => p.category === 'study' || !p.category);
      const willBeDoneCount = currentStudyTasks.filter(t => t.done).length + (item.category !== 'schedule' ? 1 : 0);
      
      let finalNewLp = progress?.seasonLp || 0;

      if (currentStudyTasks.length >= 3 && willBeDoneCount === currentStudyTasks.length && !progress?.dailyLpStatus?.[todayKey]?.plan) {
        const planLp = Math.round(100 * finalMultiplier);
        finalNewLp += planLp;
        batch.update(progressRef, {
          seasonLp: increment(planLp),
          [`dailyLpStatus.${todayKey}.plan`]: true,
          [`dailyLpStatus.${todayKey}.dailyLpAmount`]: increment(planLp),
        });
        toast({ title: "모든 계획 완료! 계획 보너스 포인트 획득 🎉" });

        // 랭킹 보드 스냅샷 업데이트
        const rankRef = doc(firestore, 'centers', centerId, 'leaderboards', `${periodKey}_lp`, 'entries', user.uid);
        batch.set(rankRef, {
          studentId: user.uid,
          displayNameSnapshot: user.displayName || '학생',
          classNameSnapshot: activeMembership.className || null,
          value: finalNewLp,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      await batch.commit();
    }
  };

  if (!isActive) return null;
  const totalMinutes = (todayStudyLog?.totalMinutes || 0) + Math.ceil(localSeconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const isJacob = user?.email === 'jacob444@naver.com';

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const qrData = user ? `ATTENDANCE_QR:${activeMembership?.id}:${user.uid}` : '';

  return (
    <div className={cn("flex flex-col relative z-10", isMobile ? "gap-2.5" : "gap-10")}>
      <section className={cn(
        "group relative overflow-hidden text-white shadow-2xl transition-all duration-700 bg-gradient-to-br",
        currentTier.gradient, "shadow-primary/20",
        isMobile ? "rounded-[1.25rem] p-4" : "rounded-[3rem] p-12"
      )}>
        <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-10 rotate-12 transition-transform duration-1000 group-hover:scale-110">
          {currentTier.name === '챌린저' ? <Crown className={cn(isMobile ? "h-20 w-20" : "h-64 w-64")} /> : <Trophy className={cn(isMobile ? "h-20 w-20" : "h-64 w-64")} />}
        </div>
        <div className={cn("relative z-10 flex flex-col gap-3", isMobile ? "items-center text-center" : "md:flex-row md:justify-between md:text-left")}>
          <div className={isMobile ? "space-y-1.5" : "space-y-4"}>
            <div className="flex flex-col gap-0.5">
              <Badge className={cn("w-fit bg-white/20 text-white border-none font-black tracking-[0.2em] uppercase px-2 py-0.5", isMobile ? "mx-auto text-[6px]" : "text-[10px]")}>{currentTier.name} 티어 활성</Badge>
              <h2 className={cn("font-body font-extrabold leading-[1.18] whitespace-pre-line", isMobile ? "text-[1.9rem] tracking-[-0.018em]" : "text-6xl tracking-[-0.02em]")}>
                {isTimerActive ? "트랙의 정점에\n도달하셨네요 !" : "오늘의 성장을 위해\n트랙을 시작하세요"}
              </h2>
            </div>
            <div className={cn("flex items-center gap-1.5 bg-white/10 backdrop-blur-xl w-fit px-2.5 py-1 rounded-full border border-white/20 shadow-2xl", isMobile ? "mx-auto" : "md:mx-0")}>
              <span className="relative flex h-1.5 w-1.5"><span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", isTimerActive ? "bg-accent" : "bg-white")}></span><span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", isTimerActive ? "bg-accent" : "bg-white")}></span></span>
              <span className={cn("font-black uppercase tracking-[0.1em] opacity-90 whitespace-nowrap", isMobile ? "text-[7px]" : "text-[11px]")}>성장 엔진</span>
            </div>
          </div>
          <div className={cn("flex items-center gap-2.5", isMobile ? "flex-col w-full" : "flex-row")}>
            {isTimerActive && (
              <div className={cn("flex flex-col items-center bg-black/20 backdrop-blur-3xl rounded-xl border border-white/10 shadow-2xl px-4 py-2", isMobile ? "w-full" : "")}>
                <span className="text-[7px] font-black uppercase tracking-widest opacity-50 mb-0.5">실시간 세션</span>
                <span className={cn("font-mono font-black tracking-tighter tabular-nums text-white leading-none", isMobile ? "text-2xl" : "text-6xl")}>
                  {formatTimer(localSeconds)}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <button 
                disabled={isProcessingAction}
                className={cn(
                  "w-full rounded-xl font-black transition-all md:w-auto shadow-2xl active:scale-95 border-none flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed",
                  isMobile ? "h-12 text-base px-6" : "h-24 px-16 text-3xl",
                  isTimerActive ? "bg-rose-500 text-white" : "bg-white text-primary"
                )} 
                onClick={handleStudyStartStop}
              >
                {isProcessingAction ? (
                  <Loader2 className={cn("animate-spin", isMobile ? "h-5 w-5" : "h-10 w-10")} />
                ) : isTimerActive ? (
                  <>트랙 종료 <Square className={cn(isMobile ? "h-4 w-4" : "h-8 w-8")} fill="currentColor" /></>
                ) : (
                  <>트랙 시작 <Play className={cn(isMobile ? "h-4 w-4" : "h-8 w-8")} fill="currentColor" /></>
                )}
              </button>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full h-10 rounded-xl bg-white/10 border-white/20 text-white font-black hover:bg-white hover:text-primary gap-2 backdrop-blur-sm shadow-xl">
                    <QrCode className="h-4 w-4" /> 나의 출입 QR
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl sm:max-w-sm">
                  <div className="bg-primary p-8 text-white text-center">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-black tracking-tighter">나의 출입 QR</DialogTitle>
                      <DialogDescription className="text-white/70 font-bold">센터 입구 카메라에 스캔해 주세요.</DialogDescription>
                    </DialogHeader>
                  </div>
                  <div className="p-10 bg-white flex flex-col items-center gap-6">
                    <div className="p-6 rounded-[2.5rem] bg-[#fafafa] border-4 border-primary/5 shadow-inner">
                      <QRCodeSVG 
                        value={qrData}
                        size={200}
                        level="H"
                        includeMargin={false}
                        imageSettings={{
                          src: "/track-logo-mark.png",
                          x: undefined,
                          y: undefined,
                          height: 40,
                          width: 40,
                          excavate: true,
                        }}
                      />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="font-black text-primary text-xl tracking-tight">{user?.displayName}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">출입 인증</p>
                    </div>
                  </div>
                  <DialogFooter className="p-6 bg-muted/30">
                    <DialogClose asChild>
                      <Button className="w-full h-12 rounded-xl font-black">닫기</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </section>

      <div className={cn("grid gap-2.5", isMobile ? "grid-cols-2" : "sm:grid-cols-2")}>
        <StudySessionHistoryDialog studentId={user!.uid} centerId={activeMembership!.id} todayKey={todayKey} h={h} m={m} isMobile={isMobile} />
        <LPHistoryDialog dailyLpStatus={progress?.dailyLpStatus} totalBoost={totalBoost} isMobile={isMobile} />
      </div>

      <Card className={cn("border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/[0.03]", isMobile ? "rounded-[1.25rem]" : "")}>
        <div className="grid grid-cols-1 lg:grid-cols-3">
          <div className={cn("lg:col-span-2 border-r border-dashed border-muted", isMobile && "border-r-0")}>
            <CardHeader className={cn("bg-emerald-50/30 border-b", isMobile ? "p-4" : "p-10")}>
              <div className="flex items-center justify-between">
                <CardTitle className={cn("font-black flex items-center gap-2.5 tracking-tighter text-primary", isMobile ? "text-lg" : "text-3xl")}>
                  <ListTodo className={cn("text-emerald-600", isMobile ? "h-5 w-5" : "h-8 w-8")} /> 계획트랙
                </CardTitle>
                <Badge variant="secondary" className={cn("bg-emerald-500 text-white border-none font-black h-5 uppercase tracking-widest", isMobile ? "text-[8px] px-1.5" : "text-[10px] px-3")}>
                  {studyTasks.filter(t => t.done).length} / {studyTasks.length} 완료
                </Badge>
              </div>
            </CardHeader>
            <CardContent className={cn("bg-emerald-50/5", isMobile ? "p-4" : "p-10")}>
              <div className="grid gap-3 sm:gap-4">
                {studyTasks.length === 0 ? (
                  <div className="py-12 text-center opacity-20 italic font-black text-xs border-2 border-dashed border-emerald-200 rounded-xl">오늘의 학습 계획이 없습니다.</div>
                ) : studyTasks.map((task) => (
                  <div key={task.id} className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-500 relative group", 
                    task.done ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white border-transparent shadow-sm hover:shadow-md",
                    isMobile ? "p-4" : ""
                  )}>
                    <Checkbox 
                      id={task.id} 
                      checked={task.done} 
                      onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} 
                      className={cn("rounded-md border-2", isMobile ? "h-6 w-6" : "h-8 w-8")} 
                    />
                    <div className="flex-1 grid gap-1">
                      <Label 
                        htmlFor={task.id} 
                        className={cn("font-black tracking-tight leading-snug break-keep", isMobile ? "text-sm" : "text-lg", task.done ? "line-through text-muted-foreground/40 italic" : "text-primary/80")}
                      >
                        {task.title}
                      </Label>
                      {task.targetMinutes && <span className={cn("font-black text-muted-foreground/40 uppercase flex items-center gap-1", isMobile ? "text-[8px]" : "text-[10px]")}><Clock className="h-2.5 w-2.5" /> {task.targetMinutes}분 목표</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </div>

          {!isMobile && (
            <div className="lg:col-span-1 bg-amber-50/20">
              <CardHeader className="p-10 bg-amber-100/30 border-b">
                <CardTitle className="font-black flex items-center gap-2.5 tracking-tighter text-amber-700 text-2xl sm:text-3xl">
                  <Timer className="h-8 w-8 text-amber-600" /> 루틴
                </CardTitle>
              </CardHeader>
              <CardContent className="p-10 flex flex-col gap-4">
                {scheduleItems.length === 0 ? (
                  <div className="py-8 text-center opacity-20 italic font-black text-[10px] border-2 border-dashed border-amber-200 rounded-xl">루틴이 없습니다.</div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {scheduleItems.map((item) => (
                      <div key={item.id} className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white border-2 border-amber-100/50 shadow-sm text-center group hover:border-amber-300 transition-all">
                        <div className="p-3 rounded-2xl bg-amber-50 group-hover:bg-amber-500 group-hover:text-white transition-all text-amber-600 mb-2">
                          <Timer className="h-6 w-6" />
                        </div>
                        <span className="font-black tracking-tighter text-primary truncate w-full px-1 text-lg">
                          {item.title.split(': ')[0]}
                        </span>
                        <Badge variant="outline" className="font-mono font-black text-amber-600 border-amber-200 bg-amber-50/50 mt-2 h-8 px-4 text-sm rounded-xl">
                          {item.title.split(': ')[1] || '--:--'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </div>
          )}
        </div>
      </Card>

      <section className={cn("grid gap-2.5", isMobile ? "grid-cols-3" : "grid-cols-3")}>
        <Link href="/dashboard/student-reports">
          <Card className={cn(
            "border-none shadow-lg bg-white/80 backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] active:scale-95 flex flex-col items-center text-center",
            isMobile ? "rounded-[1.25rem] p-3 gap-1.5" : "rounded-[2rem] p-8 gap-4"
          )}>
            <div className={cn("rounded-2xl bg-primary/5 flex items-center justify-center", isMobile ? "h-10 w-10" : "h-16 w-16")}>
              <FileText className={cn("text-primary", isMobile ? "h-5 w-5" : "h-8 w-8")} />
            </div>
            <div className="grid">
              <span className={cn("font-black tracking-tighter", isMobile ? "text-[10px]" : "text-lg")}>데일리 리포트</span>
              <span className={cn("font-bold text-muted-foreground uppercase tracking-widest", isMobile ? "text-[6px]" : "text-[10px]")}>분석</span>
            </div>
          </Card>
        </Link>

        <Dialog>
          <DialogTrigger asChild>
            <Card className={cn(
              "border-none shadow-lg bg-white/80 backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] active:scale-95 flex flex-col items-center text-center cursor-pointer",
              isMobile ? "rounded-[1.25rem] p-3 gap-1.5" : "rounded-[2rem] p-8 gap-4"
            )}>
              <div className={cn("rounded-2xl bg-amber-50 flex items-center justify-center", isMobile ? "h-10 w-10" : "h-16 w-16")}>
                <ClipboardPen className={cn("text-amber-600", isMobile ? "h-5 w-5" : "h-8 w-8")} />
              </div>
              <div className="grid">
                <span className={cn("font-black tracking-tighter", isMobile ? "text-[10px]" : "text-lg")}>지각/결석 신청</span>
                <span className={cn("font-bold text-muted-foreground uppercase tracking-widest", isMobile ? "text-[6px]" : "text-[10px]")}>요청</span>
              </div>
            </Card>
          </DialogTrigger>
          <DialogContent className={cn("rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col", isMobile ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] h-[85vh] max-w-[450px] rounded-[2rem]" : "sm:max-w-2xl max-h-[90vh]")}>
            <div className="bg-amber-500 p-8 text-white relative shrink-0">
              <BellRing className="absolute top-0 right-0 p-8 h-24 w-24 opacity-20" />
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">신청서 작성</DialogTitle>
                <DialogDescription className="text-white/70 font-bold">지각 또는 결석 사유를 입력하여 제출하세요.</DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar">
              <div className="p-8 space-y-8">
                <div className="grid gap-6 bg-white p-6 rounded-[2rem] border shadow-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">신청 종류</Label>
                      <Select value={requestType} onValueChange={(v:any) => setRequestType(v)}>
                        <SelectTrigger className="rounded-xl border-2 h-12 font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="late">지각</SelectItem>
                          <SelectItem value="absence">결석</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">날짜</Label>
                      <Input type="date" value={requestDate} onChange={e => setRequestDate(e.target.value)} className="rounded-xl border-2 h-12 font-bold" />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center ml-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">사유 (최소 10자)</Label>
                      <span className={cn("text-[9px] font-bold", requestReason.length < 10 ? "text-rose-500" : "text-emerald-500")}>{requestReason.length}/10자</span>
                    </div>
                    <Textarea 
                      placeholder="사유를 상세히 입력해 주세요. (예: 병원 진료, 학교 행사 참여 등)" 
                      value={requestReason}
                      onChange={e => setRequestReason(e.target.value)}
                      className="rounded-2xl border-2 min-h-[100px] font-bold text-sm resize-none"
                    />
                  </div>

                  {requestDate === format(new Date(), 'yyyy-MM-dd') && (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-3">
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] font-bold text-rose-900 leading-relaxed">
                        당일 신청도 먼저 접수되며, 담당 선생님 승인 후 센터 규정에 따라 반영됩니다.
                      </p>
                    </div>
                  )}

                  <Button 
                    onClick={handleRequestSubmit} 
                    disabled={isRequestSubmitting || requestReason.length < 10} 
                    className="w-full h-14 rounded-2xl font-black bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-200 active:scale-95 transition-all"
                  >
                    {isRequestSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : '신청서 제출하기'}
                  </Button>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-primary/60 tracking-widest ml-1 flex items-center gap-2">
                    <History className="h-3.5 w-3.5" /> 최근 신청 내역 (최근 5건)
                  </h4>
                  <div className="grid gap-2">
                    {my요청?.length === 0 ? (
                      <div className="py-10 text-center rounded-2xl border-2 border-dashed border-muted-foreground/10 italic text-[10px] text-muted-foreground">신청 내역이 없습니다.</div>
                    ) : (
                      my요청?.map(req => (
                        <div key={req.id} className="p-4 rounded-2xl bg-white border border-border/50 shadow-sm flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", req.type === 'late' ? "bg-amber-50" : "bg-rose-50")}>
                              {req.type === 'late' ? <Clock className="h-4 w-4 text-amber-600" /> : <CalendarX className="h-4 w-4 text-rose-600" />}
                            </div>
                            <div className="grid leading-tight">
                              <span className="font-black text-xs">{req.date} {req.type === 'late' ? '지각' : '결석'}</span>
                              <span className="text-[9px] font-bold text-muted-foreground line-clamp-1 max-w-[150px]">{req.reason}</span>
                            </div>
                          </div>
                          <Badge className={cn(
                            "font-black text-[9px] border-none px-2",
                            req.status === 'requested' ? "bg-muted text-muted-foreground" : 
                            req.status === 'approved' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                          )}>
                            {req.status === 'requested' ? '승인대기' : req.status === 'approved' ? '승인완료' : '반려'}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="p-6 border-t shrink-0 bg-white"><DialogClose asChild><Button variant="ghost" className="w-full font-black">닫기</Button></DialogClose></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Card className={cn(
              "border-none shadow-lg bg-white/80 backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] active:scale-95 flex flex-col items-center text-center cursor-pointer",
              isMobile ? "rounded-[1.25rem] p-3 gap-1.5" : "rounded-[2rem] p-8 gap-4"
            )}>
              <div className={cn("rounded-2xl bg-rose-50 flex items-center justify-center", isMobile ? "h-10 w-10" : "h-16 w-16")}>
                <AlertOctagon className={cn("text-rose-600", isMobile ? "h-5 w-5" : "h-8 w-8")} />
              </div>
              <div className="grid">
                <span className={cn("font-black tracking-tighter", isMobile ? "text-[10px]" : "text-lg")}>벌점 현황</span>
                <span className={cn("font-bold text-muted-foreground uppercase tracking-widest", isMobile ? "text-[6px]" : "text-[10px]")}>벌점</span>
              </div>
            </Card>
          </DialogTrigger>
          <DialogContent className={cn("rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-2xl flex flex-col", isMobile ? "max-w-[95vw] rounded-[2rem] h-[85vh]" : "max-h-[90vh]")}>
            <div className={cn("bg-rose-600 text-white relative shrink-0", isMobile ? "p-6" : "p-10")}>
              <ShieldAlert className="absolute top-0 right-0 p-8 h-32 w-32 opacity-20 rotate-12" />
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-white/20 text-white border-none font-black text-[10px] px-2 py-0.5 uppercase tracking-widest">벌점 가이드</Badge>
                </div>
                <DialogTitle className={cn("font-black tracking-tighter", isMobile ? "text-3xl" : "text-4xl")}>벌점 및 규정 가이드</DialogTitle>
                <DialogDescription className="text-white/70 font-bold mt-1 text-sm">벌점은 쌓이지 않게, 성장은 끊기지 않게 관리하세요.</DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar">
              <div className={cn("space-y-10", isMobile ? "p-5" : "p-10")}>
                <section className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <Activity className="h-4 w-4 text-rose-600" />
                    <h4 className="text-xs font-black uppercase text-rose-600 tracking-widest">현재 나의 규정 점수</h4>
                  </div>
                  <Card className="rounded-[2rem] border-none shadow-xl bg-white p-8 flex flex-col items-center text-center gap-4 ring-1 ring-black/5">
                    <div className={cn(
                      "text-7xl font-black tracking-tighter leading-none",
                      penaltyPoints < 10 ? "text-emerald-500" : penaltyPoints < 20 ? "text-amber-500" : "text-rose-600"
                    )}>
                      {penaltyPoints}<span className="text-lg opacity-40 ml-1">점</span>
                    </div>
                    <div className="grid gap-1">
                      <p className="font-black text-lg text-primary tracking-tight">
                        {penaltyPoints < 10 ? "안정적인 학습 상태입니다! ✨" : penaltyPoints < 30 ? "주의 및 강등 위험 상태입니다. ⚠️" : "강등 및 즉시 면담 대상입니다. 🔥"}
                      </p>
                      {penaltyRate > 0 && (
                        <Badge variant="destructive" className="mx-auto rounded-full px-4 py-1 font-black shadow-lg">
                          포인트 획득량 -{(penaltyRate * 100).toFixed(0)}% 패널티 적용 중
                        </Badge>
                      )}
                    </div>
                  </Card>
                </section>
              </div>
            </div>

            <DialogFooter className={cn("p-6 bg-white border-t shrink-0 flex justify-center", isMobile ? "p-4" : "p-6")}>
              <DialogClose asChild>
                <Button className="w-full h-14 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all">규정을 준수하겠습니다</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      {isJacob && !isMobile && progressRef && <JacobTierController progressRef={progressRef} currentStats={stats} currentLp={progress?.seasonLp || 0} userId={user.uid} centerId={activeMembership.id} periodKey={periodKey} displayName={user.displayName || 'Jacob'} className={activeMembership?.className} />}
    </div>
  );
}
