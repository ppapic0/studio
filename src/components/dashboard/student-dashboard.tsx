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
  ChevronLeft,
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
import { addWeeks, endOfWeek, format, isSameDay, startOfWeek } from 'date-fns';
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
import { DailyStudentStat, StudyPlanItem, WithId, StudyLogDay, GrowthProgress, StudentProfile, LeaderboardEntry, StudySession, AttendanceRequest, CenterMembership, AttendanceCurrent } from '@/lib/types';
import { sendKakaoNotification } from '@/lib/kakao-service';
import { QRCodeSVG } from 'qrcode.react';

const TIER_PRESETS = [
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
          "border border-slate-200/80 shadow-[0_8px_20px_rgba(15,23,42,0.06)] bg-white rounded-[1.75rem] overflow-hidden group hover:-translate-y-0.5 transition-all duration-300 cursor-pointer",
          isMobile ? "rounded-[1.25rem]" : ""
        )}>
          <CardHeader className={cn("flex flex-row items-center justify-between pb-2 px-8 pt-8", isMobile ? "px-5 pt-5" : "")}>
            <CardTitle className={cn("font-black uppercase tracking-widest text-muted-foreground", isMobile ? "text-[9px]" : "text-[10px]")}>시즌 러닝 포인트 (LP)</CardTitle>
            <div className={cn("bg-amber-50 rounded-xl group-hover:bg-amber-500 group-hover:text-white transition-all shadow-md", isMobile ? "p-2" : "p-2.5")}>
              <Zap className={cn("text-amber-600 group-hover:text-white", isMobile ? "h-4 w-4" : "h-6 w-6")} />
            </div>
          </CardHeader>
          <CardContent className={cn("px-10 pb-10", isMobile ? "px-5 pb-6" : "")}>
            <div className={cn("font-black tracking-tighter text-amber-600 drop-shadow-sm leading-none", isMobile ? "text-4xl" : "text-6xl sm:text-7xl")}>
              {Object.values(dailyLpStatus || {}).reduce((acc, curr) => acc + (curr.dailyLpAmount || 0), 0).toLocaleString()}<span className={cn("opacity-40 font-bold uppercase", isMobile ? "text-sm ml-1" : "text-xl ml-1.5")}>lp</span>
            </div>
            <div className={cn("flex items-center gap-2 mt-4", isMobile ? "mt-3" : "mt-6")}>
              <Badge variant="secondary" className={cn("bg-amber-50 text-amber-700 border border-amber-100 font-black px-4 py-1.5 rounded-full shadow-sm hover:bg-amber-100 transition-all", isMobile ? "text-[9px] px-2.5 py-1" : "text-[10px]")}>히스토리 분석 <ChevronRight className="ml-1 h-3 w-3" /></Badge>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className={cn("rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md", isMobile ? "max-w-[90vw] rounded-[2rem]" : "")}>
        <div className={cn("bg-accent text-white relative", isMobile ? "p-6" : "p-10")}>
          <Sparkles className="absolute top-0 right-0 p-8 h-32 w-32 opacity-20" />
          <DialogHeader>
            <DialogTitle className={cn("font-black tracking-tighter", isMobile ? "text-xl" : "text-3xl")}>LP 획득 히스토리</DialogTitle>
            <DialogDescription className="text-white/70 font-bold mt-1 text-xs">최근 30일간의 러닝 포인트 내역입니다.</DialogDescription>
          </DialogHeader>
        </div>
        <div className={cn("p-6 max-h-[50vh] overflow-y-auto custom-scrollbar bg-[#f5f5f5]", isMobile ? "p-4" : "")}>
          {sortedDates.length === 0 ? (<div className="py-20 text-center opacity-20 italic font-black text-sm">기록된 LP가 없습니다.</div>) : (
            <div className="space-y-2">
              {sortedDates.map(([date, data]) => {
                const discreteLp = (data.attendance ? 100 : 0) + (data.plan ? 100 : 0) + (data.routine ? 100 : 0);
                const boostedDiscrete = Math.round(discreteLp * totalBoost);
                const studyLp = Math.max(0, (data.dailyLpAmount || 0) - boostedDiscrete);

                return (
                  <div key={date} className="bg-white p-4 rounded-xl border-2 border-primary/5 flex items-center justify-between shadow-sm group">
                    <div className="grid gap-0.5">
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{date}</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {data.attendance && <Badge className="bg-blue-500 text-white border-none font-black text-[8px] px-1.5 py-0.5">출석</Badge>}
                        {data.plan && <Badge className="bg-emerald-500 text-white border-none font-black text-[8px] px-1.5 py-0.5">계획</Badge>}
                        {data.routine && <Badge className="bg-amber-500 text-white border-none font-black text-[8px] px-1.5 py-0.5">루틴</Badge>}
                        {studyLp > 0 && <Badge className="bg-blue-600 text-white border-none font-black text-[8px] px-1.5 py-0.5">몰입</Badge>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-primary tabular-nums">{(data.dailyLpAmount || 0).toLocaleString()}</span>
                      <span className="text-[9px] ml-0.5 font-bold text-muted-foreground/40">LP</span>
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
          "border border-slate-200/80 shadow-[0_8px_20px_rgba(15,23,42,0.06)] bg-white rounded-[1.75rem] overflow-hidden group hover:-translate-y-0.5 transition-all duration-300 cursor-pointer",
          isMobile ? "rounded-[1.25rem]" : ""
        )}>
          
          <CardHeader className={cn("flex flex-row items-center justify-between pb-2 px-8 pt-8", isMobile ? "px-5 pt-5" : "")}>
            <CardTitle className={cn("font-black uppercase tracking-widest text-muted-foreground", isMobile ? "text-[9px]" : "text-[10px]")}>오늘의 누적 트랙</CardTitle>
            <div className={cn("bg-blue-50 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-md", isMobile ? "p-2" : "p-2.5")}>
              <Clock className={cn("text-blue-600 group-hover:text-white", isMobile ? "h-4 w-4" : "h-6 w-6")} />
            </div>
          </CardHeader>
          <CardContent className={cn("px-10 pb-10", isMobile ? "px-5 pb-6" : "")}>
            <div className={cn("font-black tracking-tighter text-blue-600 drop-shadow-sm leading-none", isMobile ? "text-4xl" : "text-6xl sm:text-7xl")}>
              {h}<span className={cn("opacity-40 font-bold uppercase", isMobile ? "text-sm ml-1" : "text-xl ml-1.5")}>h</span> {m}<span className={cn("opacity-40 font-bold uppercase", isMobile ? "text-sm ml-1" : "text-xl ml-1.5")}>m</span>
            </div>
            <div className={cn("mt-4 flex items-center gap-2", isMobile ? "mt-3" : "mt-6")}>
              <Badge variant="secondary" className={cn("bg-blue-50 text-blue-700 border border-blue-100 font-black px-4 py-1.5 rounded-full shadow-sm hover:bg-blue-100 transition-all", isMobile ? "text-[9px] px-2.5 py-1" : "text-[10px]")}>세션 보기 <ChevronRight className="ml-1 h-3 w-3" /></Badge>
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
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Captured</span>
                    </div>
                  </div>
                  <Badge className="bg-blue-50 text-blue-700 border-none font-black text-[10px] px-2.5">{session.durationMinutes}분</Badge>
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
  const [planWeekOffset, setPlanWeekOffset] = useState(0);

  useEffect(() => { setToday(new Date()); }, []);

  const todayKey = today ? format(today, 'yyyy-MM-dd') : '';
  const weekKey = today ? format(today, "yyyy-'W'II") : '';
  const periodKey = today ? format(today, 'yyyy-MM') : '';
  const planViewDate = today ? addWeeks(today, planWeekOffset) : null;
  const planViewDateKey = planViewDate ? format(planViewDate, 'yyyy-MM-dd') : '';
  const planViewWeekKey = planViewDate ? format(planViewDate, "yyyy-'W'II") : '';
  const isViewingOtherWeek = planWeekOffset !== 0;
  const planViewLabel = planWeekOffset === 0
    ? '\uC774\uBC88 \uC8FC'
    : planWeekOffset === -1
      ? '\uC9C0\uB09C \uC8FC'
      : planWeekOffset === 1
        ? '\uB2E4\uC74C \uC8FC'
        : planWeekOffset < 0
          ? `${Math.abs(planWeekOffset)}\uC8FC \uC804`
          : `${planWeekOffset}\uC8FC \uD6C4`;
  const planWeekRangeLabel = planViewDate
    ? `${format(startOfWeek(planViewDate, { weekStartsOn: 1 }), 'M/d')} ~ ${format(endOfWeek(planViewDate, { weekStartsOn: 1 }), 'M/d')}`
    : '';

  const handleStudyStartStop = useCallback(async () => {
    if (!firestore || !user || !activeMembership || !progressRef || isProcessingAction) return;
    
    setIsProcessingAction(true);
    try {
      const centerId = activeMembership.id;
      const attendanceCurrentRef = collection(firestore, 'centers', centerId, 'attendanceCurrent');
      const seatQuery = query(attendanceCurrentRef, where('studentId', '==', user.uid));
      const seatSnap = await getDocs(seatQuery);
      const seatDoc = !seatSnap.empty ? seatSnap.docs[0] : null;

      if (isTimerActive) {
        const nowTs = Date.now();
        const sessionSeconds = Math.max(0, Math.floor((nowTs - (startTime || nowTs)) / 1000));
        const sessionMinutes = Math.max(1, Math.ceil(sessionSeconds / 60));
        
        const batch = writeBatch(firestore);
        const updateData: any = { updatedAt: serverTimestamp() };
        let finalNewLp = progress?.seasonLp || 0;
        
        if (sessionSeconds > 0) {
          let studyLpEarned = Math.round(sessionMinutes * finalMultiplier);
          updateData['stats.focus'] = increment((sessionMinutes / 60) * 0.1); 

          const currentCumulativeMinutes = todayStudyLog?.totalMinutes || 0;
          const totalMinutesAfterSession = currentCumulativeMinutes + sessionMinutes;
          
          if (totalMinutesAfterSession >= 180 && !progress?.dailyLpStatus?.[todayKey]?.attendance) {
            studyLpEarned += Math.round(100 * finalMultiplier);
            updateData[`dailyLpStatus.${todayKey}.attendance`] = true;
            toast({ title: "3시간 달성! 출석 보너스 LP 획득 🎉" });
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
          
          batch.update(progressRef!, updateData);

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
        sendKakaoNotification(firestore, centerId, { studentName: user.displayName || '학생', type: 'exit' });
        setIsTimerActive(false); 
        setStartTime(null); 
        toast({ title: "트랙 종료됨" });
      } else {
        const nowTs = Date.now();
        const batch = writeBatch(firestore);
        if (!progress?.dailyLpStatus?.[todayKey]?.checkedIn) {
          batch.update(progressRef!, { 'stats.consistency': increment(0.5), [`dailyLpStatus.${todayKey}.checkedIn`]: true, updatedAt: serverTimestamp() });
          toast({ title: "입실 확인! 꾸준함 스탯 +0.5 상승 🎉" });
        }
        if (seatDoc) {
          batch.update(seatDoc.ref, { status: 'studying', lastCheckInAt: Timestamp.fromMillis(nowTs), updatedAt: serverTimestamp() });
        }
        await batch.commit();
        sendKakaoNotification(firestore, centerId, { studentName: user.displayName || '학생', type: 'entry' });
        setStartTime(nowTs); 
        setIsTimerActive(true);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "처리 중 오류 발생", description: "잠시 후 다시 시도해 주세요." });
    } finally {
      setIsProcessingAction(false);
    }
  }, [firestore, user, activeMembership, isTimerActive, startTime, progress, todayStudyLog, todayKey, periodKey, setIsTimerActive, setStartTime, toast, finalMultiplier]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && startTime) {
      const updateSeconds = () => {
        const diff = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
        setLocalSeconds(diff);
      };
      updateSeconds();
      interval = setInterval(updateSeconds, 1000);
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

  const studyLogRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || !todayKey) return null;
    return doc(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days', todayKey);
  }, [firestore, activeMembership, user, todayKey]);
  const { data: todayStudyLog } = useDoc<StudyLogDay>(studyLogRef, { enabled: isActive });

  const allPlansRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || !planViewWeekKey || !planViewDateKey) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', planViewWeekKey, 'items'),
      where('dateKey', '==', planViewDateKey)
    );
  }, [firestore, activeMembership, user, planViewWeekKey, planViewDateKey]);
  const { data: todayPlans } = useCollection<StudyPlanItem>(allPlansRef, { enabled: isActive });
  
  const studyTasks = useMemo(() => todayPlans?.filter(p => p.category === 'study' || !p.category) || [], [todayPlans]);
  const scheduleItems = useMemo(() => todayPlans?.filter(p => p.category === 'schedule') || [], [todayPlans]);

  const myRequestsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'attendanceRequests'),
      where('studentId', '==', user.uid)
    );
  }, [firestore, activeMembership, user]);
  const { data: rawRequests } = useCollection<AttendanceRequest>(myRequestsQuery, { enabled: isActive });

  const myRequests = useMemo(() => {
    if (!rawRequests) return [];
    return [...rawRequests]
      .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
      .slice(0, 5);
  }, [rawRequests]);

  const handleToggleTask = async (item: WithId<StudyPlanItem>) => {
    if (!firestore || !user || !activeMembership || !progressRef || !planViewWeekKey || !todayPlans) return;
    if (isViewingOtherWeek) {
      toast({ title: '\uC77D\uAE30 \uC804\uC6A9 \uD654\uBA74', description: '\uC9C0\uB09C \uC8FC/\uB2E4\uC74C \uC8FC \uACC4\uD68D\uC740 \uD655\uC778\uB9CC \uAC00\uB2A5\uD569\uB2C8\uB2E4.' });
      return;
    }
    const itemRef = doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', planViewWeekKey, 'items', item.id);
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
        toast({ title: "모든 계획 완료! 계획 보너스 LP 획득 🎉" });

        const rankRef = doc(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_lp`, 'entries', user.uid);
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
    <div className={cn("flex flex-col relative z-10", isMobile ? "gap-3" : "gap-6")}>
      <section className={cn(
        "group relative overflow-hidden text-white shadow-xl transition-all duration-500 bg-gradient-to-br ring-1 ring-white/15",
        currentTier.gradient, "shadow-primary/20",
        isMobile ? "rounded-[1.25rem] p-5" : "rounded-[2.25rem] p-8"
      )}>
        <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-[0.08] rotate-12 transition-transform duration-700 group-hover:scale-110">
          {currentTier.name === '챌린저' ? <Crown className={cn(isMobile ? "h-20 w-20" : "h-64 w-64")} /> : <Trophy className={cn(isMobile ? "h-20 w-20" : "h-64 w-64")} />}
        </div>
        <div className={cn("relative z-10 flex flex-col gap-3", isMobile ? "items-center text-center" : "md:flex-row md:justify-between md:text-left")}>
          <div className={isMobile ? "space-y-1.5" : "space-y-4"}>
            <div className="flex flex-col gap-0.5">
              <Badge className={cn("w-fit bg-white/20 text-white border border-white/20 font-black tracking-[0.14em] uppercase px-2.5 py-1", isMobile ? "mx-auto text-[8px]" : "text-[10px]")}>{currentTier.name} Tier Active</Badge>
              <h2 className={cn("font-black tracking-tighter leading-[1.1] whitespace-pre-line", isMobile ? "text-xl" : "text-5xl")}>
                {isTimerActive ? "트랙의 정점에\n도달하셨네요 !" : "오늘의 성장을 위해\n트랙을 시작하세요"}
              </h2>
            </div>
            <div className={cn("flex items-center gap-1.5 bg-white/10 w-fit px-2.5 py-1 rounded-full border border-white/20", isMobile ? "mx-auto" : "md:mx-0")}>
              <span className="relative flex h-1.5 w-1.5"><span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", isTimerActive ? "bg-accent" : "bg-white")}></span><span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", isTimerActive ? "bg-accent" : "bg-white")}></span></span>
              <span className={cn("font-black uppercase tracking-[0.1em] opacity-90 whitespace-nowrap", isMobile ? "text-[7px]" : "text-[11px]")}>Performance Engine</span>
            </div>
          </div>
          <div className={cn("flex items-center gap-2.5", isMobile ? "flex-col w-full" : "flex-row")}>
            {isTimerActive && (
              <div className={cn("flex flex-col items-center bg-black/25 rounded-2xl border border-white/20 shadow-lg px-4 py-2", isMobile ? "w-full" : "")}>
                <span className="text-[8px] font-black uppercase tracking-widest opacity-50 mb-0.5">Live Session</span>
                <span className={cn("font-mono font-black tracking-tighter tabular-nums text-white leading-none", isMobile ? "text-2xl" : "text-6xl")}>
                  {formatTimer(localSeconds)}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-2 w-full md:w-auto">
              <button 
                disabled={isProcessingAction}
                className={cn(
                  "w-full rounded-2xl font-black transition-all md:w-auto shadow-lg active:scale-[0.98] border border-white/20 flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed",
                  isMobile ? "h-14 text-lg px-8" : "h-24 px-16 text-3xl",
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
                  <button className="w-full h-11 rounded-2xl bg-white/15 border border-white/25 text-white font-black hover:bg-white hover:text-primary gap-2 shadow-lg flex items-center justify-center transition-all active:scale-95">
                    <QrCode className="h-4 w-4" /> 나의 출입 QR
                  </button>
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
                      <QRCodeSVG value={qrData} size={200} level="H" includeMargin={false} />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="font-black text-primary text-xl tracking-tight">{user?.displayName}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">Attendance Authentication</p>
                    </div>
                  </div>
                  <DialogFooter className="p-6 bg-muted/30">
                    <DialogClose asChild><Button className="w-full h-12 rounded-xl font-black">닫기</Button></DialogClose>
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

      <Card className={cn("border border-slate-200/80 shadow-[0_12px_26px_rgba(15,23,42,0.06)] rounded-[2.25rem] bg-white overflow-hidden", isMobile ? "rounded-[1.25rem]" : "")}>
        <CardHeader className={cn("bg-slate-50 border-b flex flex-col items-center gap-4", isMobile ? "p-5" : "p-8")}>
          <div className="flex items-center justify-between w-full max-w-2xl">
            <CardTitle className={cn("font-black flex items-center gap-2.5 tracking-tighter text-slate-900", isMobile ? "text-lg" : "text-3xl")}>
              <ListTodo className={cn("text-primary")} /> 계획트랙
            </CardTitle>
            <Badge variant="secondary" className={cn("bg-[#eaf2ff] text-primary border border-[#dbe8ff] font-black h-6 uppercase tracking-widest px-3")}>
              {studyTasks.filter(t => t.done).length} / {studyTasks.length} DONE
            </Badge>
          </div>
          
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border shadow-sm">
            <button className="text-slate-400 hover:text-primary transition-all" onClick={() => setPlanWeekOffset(prev => prev - 1)}><ChevronLeft className="h-5 w-5" /></button>
            <span className="text-[11px] font-black min-w-[100px] text-center">{planViewLabel} ({planWeekRangeLabel})</span>
            <button className="text-slate-400 hover:text-primary transition-all" onClick={() => setPlanWeekOffset(prev => prev + 1)}><ChevronRight className="h-5 w-5" /></button>
          </div>
        </CardHeader>
        
        <CardContent className={cn("p-6 flex flex-col items-center gap-8", isMobile ? "p-5" : "p-10")}>
          <div className="w-full max-w-2xl space-y-4">
            {studyTasks.length === 0 ? (
              <div className="py-16 text-center opacity-20 italic font-black text-xs border-2 border-dashed border-slate-200 rounded-3xl w-full">계획이 없습니다.</div>
            ) : (
              studyTasks.map((task) => (
                <div key={task.id} className={cn(
                  "flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-300 group shadow-sm", 
                  task.done ? "bg-[#f8faff] border-primary/10 opacity-60" : "bg-white border-slate-100 hover:border-primary/20 hover:shadow-md"
                )}>
                  <Checkbox 
                    id={task.id} 
                    checked={task.done} 
                    onCheckedChange={() => !isViewingOtherWeek && handleToggleTask(task as WithId<StudyPlanItem>)} 
                    disabled={isViewingOtherWeek}
                    className="h-7 w-7 rounded-lg border-2" 
                  />
                  <div className="flex-1 min-w-0">
                    <Label 
                      htmlFor={task.id} 
                      className={cn("font-black tracking-tight leading-snug break-keep cursor-pointer block", isMobile ? "text-base" : "text-xl", task.done ? "line-through text-slate-400 italic" : "text-slate-800")}
                    >
                      {task.title}
                    </Label>
                    {task.targetMinutes && <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {task.targetMinutes}m Goal</span>}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="w-full max-w-2xl pt-8 border-t border-dashed">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Timer className="h-5 w-5 text-primary" />
              <h3 className="font-black text-slate-900 text-lg sm:text-xl">생활 루틴</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {scheduleItems.length === 0 ? (
                <div className="col-span-full py-8 text-center opacity-30 italic font-black text-[10px] border border-dashed border-slate-200 rounded-2xl">루틴이 없습니다.</div>
              ) : (
                scheduleItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100 shadow-sm transition-all hover:bg-white hover:border-primary/20">
                    <div className="p-2 rounded-lg bg-white shadow-sm text-primary"><Timer className="h-4 w-4" /></div>
                    <div className="grid leading-tight">
                      <span className="font-black text-xs text-slate-800 truncate">{item.title.split(': ')[0]}</span>
                      <span className="text-[10px] font-mono font-black text-primary/60">{item.title.split(': ')[1] || '--:--'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <section className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-3")}>
        <Link href="/dashboard/student-reports" className="group">
          <Card className={cn(
            "h-full border border-slate-200/80 shadow-sm bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-95 flex flex-row items-center gap-4",
            isMobile ? "rounded-2xl p-4" : "rounded-[2rem] p-6"
          )}>
            <div className={cn("rounded-2xl bg-primary/5 flex items-center justify-center shrink-0 transition-all group-hover:bg-primary group-hover:text-white", isMobile ? "h-12 w-12" : "h-16 w-16")}>
              <FileText className={cn(isMobile ? "h-6 w-6" : "h-8 w-8")} />
            </div>
            <div className="grid text-left">
              <span className={cn("font-black tracking-tighter", isMobile ? "text-sm" : "text-xl")}>데일리 리포트</span>
              <span className={cn("font-bold text-muted-foreground uppercase tracking-widest text-[8px] sm:text-[10px]")}>Analysis Archive</span>
            </div>
            <ChevronRight className="ml-auto h-5 w-5 opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </Card>
        </Link>

        <Dialog>
          <DialogTrigger asChild>
            <button className="group text-left">
              <Card className={cn(
                "h-full border border-slate-200/80 shadow-sm bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-95 flex flex-row items-center gap-4",
                isMobile ? "rounded-2xl p-4" : "rounded-[2rem] p-6"
              )}>
                <div className={cn("rounded-2xl bg-amber-50 flex items-center justify-center shrink-0 transition-all group-hover:bg-amber-500 group-hover:text-white", isMobile ? "h-12 w-12" : "h-16 w-16")}>
                  <ClipboardPen className={cn("text-amber-600 group-hover:text-white", isMobile ? "h-6 w-6" : "h-8 w-8")} />
                </div>
                <div className="grid">
                  <span className={cn("font-black tracking-tighter", isMobile ? "text-sm" : "text-xl")}>지각/결석 신청</span>
                  <span className={cn("font-bold text-muted-foreground uppercase tracking-widest text-[8px] sm:text-[10px]")}>Quick Requests</span>
                </div>
                <ChevronRight className="ml-auto h-5 w-5 opacity-20 group-hover:opacity-100 transition-all" />
              </Card>
            </button>
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
                          <SelectItem value="late">지각 (Late)</SelectItem>
                          <SelectItem value="absence">결석 (Absence)</SelectItem>
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
                    <Textarea placeholder="사유를 상세히 입력해 주세요." value={requestReason} onChange={e => setRequestReason(e.target.value)} className="rounded-2xl border-2 min-h-[100px] font-bold text-sm resize-none" />
                  </div>
                  {requestDate === format(new Date(), 'yyyy-MM-dd') && (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-3"><AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" /><p className="text-[11px] font-bold text-rose-900">**당일 신청 알림**: 당일 신청 시 규정에 따라 **벌점(지각 +3, 결석 +5)**이 즉시 부과됩니다.</p></div>
                  )}
                  <Button onClick={handleRequestSubmit} disabled={isRequestSubmitting || requestReason.length < 10} className="w-full h-14 rounded-2xl font-black bg-amber-500 hover:bg-amber-600 text-white shadow-xl shadow-amber-200">
                    {isRequestSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : '신청서 제출하기'}
                  </Button>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-primary/60 tracking-widest ml-1 flex items-center gap-2"><History className="h-3.5 w-3.5" /> 최근 신청 내역</h4>
                  <div className="grid gap-2">
                    {myRequests?.length === 0 ? <div className="py-10 text-center rounded-2xl border-2 border-dashed border-muted-foreground/10 italic text-[10px]">내역이 없습니다.</div> : myRequests?.map(req => (
                      <div key={req.id} className="p-4 rounded-2xl bg-white border border-border/50 shadow-sm flex items-center justify-between"><div className="flex items-center gap-3"><div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", req.type === 'late' ? "bg-amber-50" : "bg-rose-50")}>{req.type === 'late' ? <Clock className="h-4 w-4 text-amber-600" /> : <CalendarX className="h-4 w-4 text-rose-600" />}</div><div className="grid leading-tight"><span className="font-black text-xs">{req.date} {req.type === 'late' ? '지각' : '결석'}</span><span className="text-[9px] font-bold text-muted-foreground line-clamp-1 max-w-[150px]">{req.reason}</span></div></div><Badge className={cn("font-black text-[9px] border-none px-2", req.status === 'requested' ? "bg-muted text-muted-foreground" : req.status === 'approved' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")}>{req.status === 'requested' ? '승인대기' : req.status === 'approved' ? '승인완료' : '반려'}</Badge></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="p-6 border-t shrink-0 bg-white"><DialogClose asChild><Button variant="ghost" className="w-full font-black">닫기</Button></DialogClose></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <button className="group text-left">
              <Card className={cn(
                "h-full border border-slate-200/80 shadow-sm bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:scale-95 flex flex-row items-center gap-4",
                isMobile ? "rounded-2xl p-4" : "rounded-[2rem] p-6"
              )}>
                <div className={cn("rounded-2xl bg-rose-50 flex items-center justify-center shrink-0 transition-all group-hover:bg-rose-600 group-hover:text-white", isMobile ? "h-12 w-12" : "h-16 w-16")}>
                  <AlertOctagon className={cn("text-rose-600 group-hover:text-white", isMobile ? "h-6 w-6" : "h-8 w-8")} />
                </div>
                <div className="grid">
                  <span className={cn("font-black tracking-tighter", isMobile ? "text-sm" : "text-xl")}>벌점 현황</span>
                  <span className={cn("font-bold text-muted-foreground uppercase tracking-widest text-[8px] sm:text-[10px]")}>Growth Guard</span>
                </div>
                <ChevronRight className="ml-auto h-5 w-5 opacity-20 group-hover:opacity-100 transition-all" />
              </Card>
            </button>
          </DialogTrigger>
          <DialogContent className={cn("rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-2xl flex flex-col", isMobile ? "max-w-[95vw] rounded-[2rem] h-[85vh]" : "max-h-[90vh]")}>
            <div className={cn("bg-rose-600 text-white relative shrink-0", isMobile ? "p-6" : "p-10")}>
              <ShieldAlert className="absolute top-0 right-0 p-8 h-32 w-32 opacity-20 rotate-12" />
              <DialogHeader>
                <DialogTitle className={cn("font-black tracking-tighter", isMobile ? "text-3xl" : "text-4xl")}>벌점 및 규정 가이드</DialogTitle>
                <DialogDescription className="text-white/70 font-bold mt-1 text-sm">벌점은 쌓이지 않게, 성장은 끊기지 않게 관리하세요.</DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar">
              <div className={cn("p-10 text-center space-y-6")}>
                <div className="inline-flex flex-col items-center gap-1">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Penalty Score</span>
                  <h3 className={cn("text-8xl font-black tracking-tighter leading-none", penaltyPoints < 10 ? "text-emerald-500" : "text-rose-600")}>{penaltyPoints}</h3>
                </div>
                <Progress value={penaltyPoints * 3.3} className="h-3 bg-muted" />
                <p className="text-sm font-bold text-slate-600">{penaltyPoints < 10 ? "안정적인 학습 상태입니다! ✨" : "주의가 필요한 단계입니다. ⚠️"}</p>
              </div>
            </div>
            <DialogFooter className="p-6 bg-white border-t shrink-0 flex justify-center"><DialogClose asChild><Button className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">확인했습니다</Button></DialogClose></DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      {isJacob && !isMobile && progressRef && <JacobTierController progressRef={progressRef} currentStats={stats} currentLp={progress?.seasonLp || 0} userId={user.uid} centerId={activeMembership.id} periodKey={periodKey} displayName={user.displayName || 'Jacob'} className={activeMembership?.className} />}
    </div>
  );
}
