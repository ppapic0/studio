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
  QrCode,
  Plus,
  Trash2
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { useDoc, useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { doc, collection, query, where, updateDoc, setDoc, serverTimestamp, increment, writeBatch, Timestamp, getCountFromServer, getDoc, orderBy, addDoc, limit, getDocs } from 'firebase/firestore';
import { addDays, subDays, format, isSameDay, parse, isAfter } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '../ui/progress';
import { cn } from '@/lib/utils';
import { getTierTheme } from '@/lib/tier-theme';
import { useRouter } from 'next/navigation';
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
import { DailyStudentStat, StudyPlanItem, WithId, StudyLogDay, GrowthProgress, StudentProfile, LeaderboardEntry, StudySession, AttendanceRequest, CenterMembership, AttendanceCurrent, DailyReport, PenaltyLog } from '@/lib/types';
import { sendKakaoNotification } from '@/lib/kakao-service';
import { QRCodeSVG } from 'qrcode.react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { VisualReportViewer } from '@/components/dashboard/visual-report-viewer';
import {
  ROUTINE_MISSING_PENALTY_POINTS,
  syncAutoAttendanceRecord,
  toDateSafe as toDateSafeAttendance,
} from '@/lib/attendance-auto';
import { resolveSeatIdentity } from '@/lib/seat-layout';

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

const ACTIVE_ATTENDANCE_STATUSES: AttendanceCurrent['status'][] = ['studying', 'away', 'break'];

const TIER_MILESTONES = [
  { name: '브론즈', lp: 0 },
  { name: '실버', lp: 5000 },
  { name: '골드', lp: 10000 },
  { name: '플래티넘', lp: 15000 },
  { name: '다이아', lp: 20000 },
  { name: '마스터', lp: 26000 },
  { name: '그마', lp: 30000 },
  { name: '챌린저', lp: 35000 },
] as const;

function summarizeReportLine(content?: string | null) {
  if (!content) return '오늘의 코칭이 도착하면 이곳에서 바로 확인할 수 있어요.';
  return content
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 84);
}

function getNextTierInfo(currentLp: number) {
  const nextTier = TIER_MILESTONES.find((tier) => currentLp < tier.lp);
  if (!nextTier) {
    return { name: '챌린저 유지', remainingLp: 0 };
  }
  return {
    name: nextTier.name,
    remainingLp: Math.max(0, nextTier.lp - currentLp),
  };
}

const REQUEST_PENALTY_POINTS: Record<'late' | 'absence', number> = {
  late: 1,
  absence: 2,
};

const REQUEST_TYPE_LABEL: Record<'late' | 'absence', string> = {
  late: '지각',
  absence: '결석',
};

const PENALTY_SOURCE_LABEL: Record<PenaltyLog['source'], string> = {
  attendance_request: '지각/결석 신청',
  manual: '수동/규정 부여',
  reset: '초기화',
  routine_missing: '루틴 미실행',
};

type ExamCountdownSetting = {
  id: string;
  title: string;
  date: string;
};

const DEFAULT_EXAM_COUNTDOWNS: ExamCountdownSetting[] = [
  { id: 'mock', title: '모의고사', date: '' },
  { id: 'school', title: '내신', date: '' },
];

function formatTimer(totalSecs: number) {
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatMinutesToKorean(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const remain = safe % 60;
  if (hours <= 0) return `${remain}분`;
  if (remain === 0) return `${hours}시간`;
  return `${hours}시간 ${remain}분`;
}

function toClockLabel(totalMinutes: number): string {
  const safe = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)));
  const h = Math.floor(safe / 60).toString().padStart(2, '0');
  const m = (safe % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function hourNumberToDate(dateKey: string, hourValue?: number | null): Date | null {
  if (typeof hourValue !== 'number' || !Number.isFinite(hourValue)) return null;
  const base = parse(dateKey, 'yyyy-MM-dd', new Date());
  if (Number.isNaN(base.getTime())) return null;
  const clamped = Math.max(0, Math.min(24, hourValue));
  const h = Math.floor(clamped);
  const m = Math.max(0, Math.min(59, Math.round((clamped - h) * 60)));
  base.setHours(h, m, 0, 0);
  return base;
}

function calculateRhythmScore(minutes: number[]): number {
  if (!minutes.length) return 0;
  const safeMinutes = minutes.map((value) => Math.max(0, Math.round(value)));
  const avg = safeMinutes.reduce((acc, value) => acc + value, 0) / safeMinutes.length;
  if (avg <= 0) return 0;
  const variance = safeMinutes.reduce((acc, value) => acc + (value - avg) ** 2, 0) / safeMinutes.length;
  const std = Math.sqrt(variance);
  return Math.max(0, Math.min(100, Math.round(100 - (std / avg) * 100)));
}

function normalizeExamCountdowns(input: unknown): ExamCountdownSetting[] {
  if (!Array.isArray(input)) return DEFAULT_EXAM_COUNTDOWNS;

  const normalized = input
    .map((item, index) => {
      const row = item as Partial<ExamCountdownSetting>;
      return {
        id: typeof row.id === 'string' && row.id.length > 0 ? row.id : `exam_${index + 1}`,
        title: typeof row.title === 'string' ? row.title.trim() : '',
        date: typeof row.date === 'string' ? row.date.trim() : '',
      };
    })
    .filter((item) => item.title.length > 0 || item.date.length > 0);

  return normalized.length > 0 ? normalized : DEFAULT_EXAM_COUNTDOWNS;
}

function getSeatActivityRank(status?: AttendanceCurrent['status'] | null): number {
  if (status === 'studying') return 0;
  if (status === 'away' || status === 'break') return 1;
  if (status === 'absent') return 3;
  return 2;
}

function pickPreferredSeatDoc<T extends { data: () => AttendanceCurrent | undefined }>(docs: T[]): T | null {
  if (!docs.length) return null;

  return [...docs].sort((a, b) => {
    const aSeat = a.data();
    const bSeat = b.data();
    const rankDiff = getSeatActivityRank(aSeat?.status) - getSeatActivityRank(bSeat?.status);
    if (rankDiff !== 0) return rankDiff;

    const aTime = aSeat?.lastCheckInAt?.toMillis?.() || aSeat?.updatedAt?.toMillis?.() || 0;
    const bTime = bSeat?.lastCheckInAt?.toMillis?.() || bSeat?.updatedAt?.toMillis?.() || 0;
    return bTime - aTime;
  })[0] || null;
}

function shouldShowDailyCheckInToast(centerId: string, userId: string, dateKey: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const storageKey = `track:checkin-toast:${centerId}:${userId}`;
    const lastShownDate = window.localStorage.getItem(storageKey);
    if (lastShownDate === dateKey) return false;
    window.localStorage.setItem(storageKey, dateKey);
    return true;
  } catch {
    return true;
  }
}

function JacobTierController({ progressRef, currentStats, currentLp, userId, centerId, periodKey, displayName, className, schoolName }: { progressRef: any, currentStats: any, currentLp: number, userId: string, centerId: string, periodKey: string, displayName: string, className?: string, schoolName?: string }) {
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
        schoolNameSnapshot: schoolName || null,
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
    <Card className="border-2 border-dashed border-primary/20 bg-white rounded-[2.5rem] p-8 mt-10">
      <CardHeader className="p-0 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl text-white"><Settings2 className="h-5 w-5" /></div>
            <div>
              <CardTitle className="text-xl font-black tracking-tighter">개발 지표 컨트롤러</CardTitle>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] mt-0.5 ml-1">랭크·티어 시뮬레이터</p>
            </div>
          </div>
          <Badge className="bg-rose-500 text-white font-black px-3 py-1 rounded-full">테스트 계정 전용</Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex flex-col lg:flex-row gap-10">
        <div className="flex-1 space-y-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black uppercase text-primary flex items-center gap-2 whitespace-nowrap"><Zap className="h-3 w-3" /> 시즌 누적 포인트</span>
              <span className="text-sm font-black text-primary bg-white px-3 py-1 rounded-lg border">{lp.toLocaleString()}점</span>
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
              <Button key={preset.label} variant="outline" size="sm" onClick={() => applyPreset(preset)} className="rounded-xl h-12 px-0 font-black text-[10px] border-2 bg-white flex flex-col items-center justify-center leading-none gap-1">
                <div className={cn("w-2 h-2 rounded-full", preset.color)} />{preset.label}
              </Button>
            ))}
          </div>
          <Button onClick={handleUpdate} disabled={isUpdating} className="w-full h-16 rounded-2xl font-black text-lg gap-3">
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
          "group relative h-full min-w-0 overflow-hidden border border-slate-200/80 bg-white transition-all duration-300 cursor-pointer",
          isMobile
            ? "rounded-[1.4rem] bg-[radial-gradient(circle_at_top_right,#fde68a_0%,#ffffff_58%,#fffbeb_100%)] shadow-[0_18px_40px_-28px_rgba(245,158,11,0.5)]"
            : "rounded-[1.75rem]"
        )}>
          {isMobile && <div className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-amber-200/60 blur-2xl" />}
          <CardHeader className={cn("flex flex-row items-center justify-between pb-2 px-8 pt-8", isMobile ? "px-5 pt-5" : "")}>
            <CardTitle className={cn("font-aggro-display font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap", isMobile ? "text-[9px]" : "text-[10px]")}>시즌 LP</CardTitle>
            <div className={cn("bg-amber-50 rounded-xl text-amber-600", isMobile ? "p-2" : "p-2.5")}>
              <Zap className={cn("text-amber-600", isMobile ? "h-4 w-4" : "h-6 w-6")} />
            </div>
          </CardHeader>
          <CardContent className={cn("relative z-10 px-10 pb-10", isMobile ? "px-4 pb-4" : "")}>
            <div className={cn("dashboard-number text-amber-600", isMobile ? "text-4xl" : "text-6xl sm:text-7xl")}>
              {Object.values(dailyLpStatus || {}).reduce((acc, curr) => acc + (curr.dailyLpAmount || 0), 0).toLocaleString()}<span className={cn("opacity-40 font-bold uppercase", isMobile ? "text-sm ml-1" : "text-xl ml-1.5")}>포인트</span>
            </div>
            <div className={cn("flex items-center gap-2 mt-4", isMobile ? "mt-3" : "mt-6")}>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-aggro-display border border-[#FF7A16] bg-[#FF7A16] text-white font-extrabold leading-none",
                    isMobile ? "h-7 px-2.5 text-[11px]" : "h-8 px-3.5 text-[12px]"
                  )}
                >
                  히스토리 분석 <ChevronRight className={cn("ml-1", isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} />
                </Badge>
                {isMobile && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black tracking-wide text-amber-700">
                    +{Math.max(0, Math.round((totalBoost - 1) * 100))}%
                  </span>
                )}
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className={cn("rounded-[3rem] border border-slate-200 p-0 overflow-hidden sm:max-w-md", isMobile ? "max-w-[90vw] rounded-[2rem]" : "")}>
        <div className={cn("bg-accent text-white relative", isMobile ? "p-6" : "p-10")}>
          <Sparkles className="pointer-events-none absolute top-0 right-0 p-8 h-32 w-32 opacity-20" />
          <DialogHeader>
            <DialogTitle className={cn("font-black tracking-tighter whitespace-nowrap", isMobile ? "text-xl" : "text-3xl")}>포인트 획득 기록</DialogTitle>
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
                  <div key={date} className="bg-white p-4 rounded-xl border border-primary/10 flex items-center justify-between">
                    <div className="grid gap-0.5">
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{date}</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {data.attendance && <Badge variant="outline" className="bg-blue-500 text-white border-none font-black text-[8px] px-1.5 py-0.5">출석</Badge>}
                        {data.plan && <Badge variant="outline" className="bg-emerald-500 text-white border-none font-black text-[8px] px-1.5 py-0.5">계획</Badge>}
                        {data.routine && <Badge variant="outline" className="bg-amber-500 text-white border-none font-black text-[8px] px-1.5 py-0.5">루틴</Badge>}
                        {studyLp > 0 && <Badge variant="outline" className="bg-blue-600 text-white border-none font-black text-[8px] px-1.5 py-0.5">몰입</Badge>}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="dashboard-number text-sm text-primary">{(data.dailyLpAmount || 0).toLocaleString()}</span>
                      <span className="text-[9px] ml-0.5 font-bold text-muted-foreground/40 whitespace-nowrap">포인트</span>
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
  const [isOpen, setIsOpen] = useState(false);
  const sessionsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !todayKey) return null;
    return query(
      collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', todayKey, 'sessions'),
      orderBy('startTime', 'desc')
    );
  }, [firestore, centerId, studentId, todayKey]);

  const { data: sessions, isLoading } = useCollection<StudySession>(sessionsQuery, { enabled: isOpen });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className={cn(
          "group relative h-full min-w-0 overflow-hidden border border-slate-200/80 bg-white transition-all duration-300 cursor-pointer",
          isMobile
            ? "rounded-[1.4rem] bg-[radial-gradient(circle_at_top_right,#dbeafe_0%,#ffffff_58%,#f7fbff_100%)] shadow-[0_18px_40px_-28px_rgba(37,99,235,0.55)]"
            : "rounded-[1.75rem]"
        )}>
          {isMobile && <div className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-sky-200/60 blur-2xl" />}
          <CardHeader className={cn("relative z-10 flex flex-row items-center justify-between pb-2 px-8 pt-8", isMobile ? "px-4 pt-4" : "")}>
            <CardTitle className={cn("font-aggro-display font-black uppercase tracking-widest text-muted-foreground", isMobile ? "text-[9px]" : "text-[10px]")}>오늘의 트랙</CardTitle>
            <div className={cn("rounded-xl text-blue-600 transition-colors duration-300", isMobile ? "bg-white/80 p-2 shadow-sm" : "bg-blue-50 p-2.5")}>
              <Clock className={cn("text-blue-600", isMobile ? "h-4 w-4" : "h-6 w-6")} />
            </div>
          </CardHeader>
          <CardContent className={cn("relative z-10 px-10 pb-10", isMobile ? "px-4 pb-4" : "")}>
            <div className={cn("dashboard-number text-blue-600", isMobile ? "text-4xl" : "text-6xl sm:text-7xl")}>
              {h}<span className={cn("opacity-40 font-bold uppercase", isMobile ? "text-sm ml-1" : "text-xl ml-1.5")}>h</span> {m}<span className={cn("opacity-40 font-bold uppercase", isMobile ? "text-sm ml-1" : "text-xl ml-1.5")}>m</span>
            </div>
            <div className={cn("mt-4 flex items-center gap-2", isMobile ? "mt-2.5 flex-wrap" : "mt-6")}>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-aggro-display border border-[#FF7A16] bg-[#FF7A16] text-white font-extrabold leading-none shadow-[0_12px_24px_-18px_rgba(255,122,22,0.9)]",
                    isMobile ? "h-7 px-2.5 text-[11px]" : "h-8 px-3.5 text-[12px]"
                  )}
                >
                  세션 보기 <ChevronRight className={cn("ml-1", isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} />
                </Badge>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className={cn("rounded-[3rem] border border-slate-200 p-0 overflow-hidden sm:max-w-md", isMobile ? "max-w-[90vw] rounded-[2rem]" : "")}>
        <div className={cn("bg-blue-600 text-white relative", isMobile ? "p-6" : "p-10")}>
          <Activity className="pointer-events-none absolute top-0 right-0 p-8 h-32 w-32 opacity-20" />
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
                <div key={session.id} className="bg-white p-4 rounded-xl border border-primary/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Timer className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="grid leading-tight">
                      <span className="font-black text-xs">{format(session.startTime.toDate(), 'HH:mm')} ~ {format(session.endTime.toDate(), 'HH:mm')}</span>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter whitespace-nowrap">기록됨</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-none font-black text-[10px] px-2.5">{session.durationMinutes}분</Badge>
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

function StudyTimeTrendDialog({
  studyTimeTrend,
  rhythmScoreTrend,
  rhythmScoreAverage,
  startEndTrend,
  awayTimeTrend,
  hasRhythmScoreTrend,
  hasStartEndTrend,
  hasAwayTrend,
  rhythmYAxisDomain,
  isMobile,
}: {
  studyTimeTrend: Array<{ date: string; minutes: number }>;
  rhythmScoreTrend: Array<{ date: string; score: number }>;
  rhythmScoreAverage: number;
  startEndTrend: Array<{ date: string; startMinutes: number; endMinutes: number }>;
  awayTimeTrend: Array<{ date: string; awayMinutes: number }>;
  hasRhythmScoreTrend: boolean;
  hasStartEndTrend: boolean;
  hasAwayTrend: boolean;
  rhythmYAxisDomain: [number, number];
  isMobile: boolean;
}) {
  const avgMinutes = useMemo(() => {
    if (!studyTimeTrend.length) return 0;
    return Math.round(studyTimeTrend.reduce((sum, item) => sum + item.minutes, 0) / studyTimeTrend.length);
  }, [studyTimeTrend]);
  const totalMinutes = useMemo(() => studyTimeTrend.reduce((sum, item) => sum + item.minutes, 0), [studyTimeTrend]);
  const latestMinutes = studyTimeTrend[studyTimeTrend.length - 1]?.minutes || 0;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className={cn(
          "border border-slate-200/80 bg-white rounded-[1.75rem] overflow-hidden transition-colors duration-200 cursor-pointer",
          isMobile ? "rounded-[1.25rem]" : ""
        )}>
          <CardHeader className={cn("flex flex-row items-center justify-between pb-2 px-8 pt-8", isMobile ? "px-5 pt-5" : "")}>
            <CardTitle className={cn("font-aggro-display font-black uppercase tracking-widest text-muted-foreground", isMobile ? "text-[9px]" : "text-[10px]")}>
              최근 7일 공부시간 추이
            </CardTitle>
            <div className={cn("bg-sky-50 rounded-xl text-sky-600", isMobile ? "p-2" : "p-2.5")}>
              <Clock className={cn("text-sky-600", isMobile ? "h-4 w-4" : "h-6 w-6")} />
            </div>
          </CardHeader>
          <CardContent className={cn("px-8 pb-6", isMobile ? "px-5 pb-5" : "")}>
            <div className={cn("dashboard-number text-sky-700", isMobile ? "text-2xl" : "text-4xl sm:text-5xl")}>
              {formatMinutesToKorean(avgMinutes)}
            </div>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">최근 7일 평균 공부시간</p>
            <div className={cn("mt-3 h-20 w-full", isMobile ? "h-16" : "h-20")}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={studyTimeTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Line
                    type="monotone"
                    dataKey="minutes"
                    stroke="#0ea5e9"
                    strokeWidth={2.5}
                    dot={{ r: 2.5, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 1 }}
                    activeDot={{ r: 4, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 1 }}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className={cn("rounded-[3rem] border border-slate-200 p-0 overflow-hidden sm:max-w-lg", isMobile ? "max-w-[95vw] rounded-[2rem]" : "")}>
        <div className={cn("bg-[#14295F] text-white relative", isMobile ? "p-6" : "p-10")}>
          <Activity className="pointer-events-none absolute top-0 right-0 p-8 h-32 w-32 opacity-20" />
          <DialogHeader>
            <DialogTitle className={cn("font-black tracking-tighter", isMobile ? "text-xl" : "text-3xl")}>최근 7일 공부시간 추이</DialogTitle>
            <DialogDescription className="text-white/70 font-bold mt-1 text-xs">
              일자별 실제 공부시간 흐름을 확인할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className={cn("p-6 space-y-6 bg-white max-h-[70vh] overflow-y-auto custom-scrollbar", isMobile ? "p-4" : "")}>
          <div className={cn("grid gap-2", isMobile ? "grid-cols-2" : "grid-cols-3")}>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">최근 7일 총 공부시간</p>
              <p className="dashboard-number text-2xl text-[#14295F]">{formatMinutesToKorean(totalMinutes)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">평균 학습시간</p>
              <p className="dashboard-number text-2xl text-[#14295F]">{formatMinutesToKorean(avgMinutes)}</p>
            </div>
            <div className={cn("rounded-2xl border border-slate-200 bg-slate-50 p-3", isMobile ? "col-span-2" : "")}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">오늘 공부시간</p>
              <p className="text-xs font-bold text-slate-700 mt-1">{formatMinutesToKorean(latestMinutes)}</p>
            </div>
          </div>

          <div className={cn("w-full", isMobile ? "h-56" : "h-64")}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLineChart data={studyTimeTrend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf5" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  tickFormatter={(value: number) => `${Math.round(value / 60)}h`}
                />
                <Tooltip
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                  contentStyle={{ borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: 'none' }}
                  formatter={(value: number) => {
                    return [formatMinutesToKorean(Number(value || 0)), '공부시간'];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="minutes"
                  stroke="#0ea5e9"
                  strokeWidth={3}
                  dot={{ r: 3.5, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 1.5 }}
                  activeDot={{ r: 5, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 2 }}
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          </div>

          <Card className="rounded-[1.25rem] border border-[#dbe7ff] bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] p-4 shadow-none">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#1f4fbf]">안내</p>
            <p className="mt-1 text-xs font-bold leading-relaxed text-slate-700">
              리듬 점수, 시작/종료 시각, 외출시간 그래프는 분석트랙에서 확인할 수 있습니다.
            </p>
          </Card>
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
  const router = useRouter();
  const { toast } = useToast();
  const { activeMembership, isTimerActive, setIsTimerActive, startTime, setStartTime, viewMode, currentTier } = useAppContext();
  const tierTheme = getTierTheme(currentTier);
  
  const [today, setToday] = useState<Date | null>(null);
  const [localSeconds, setLocalSeconds] = useState(0);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const actionLockAtRef = useRef<number | null>(null);
  const isMobile = viewMode === 'mobile';
  
  // 지각/결석 신청서 상태
  const [requestType, setRequestType] = useState<'late' | 'absence'>('late');
  const [requestDate, setRequestDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [requestReason, setRequestReason] = useState('');
  const [isRequestSubmitting, setIsRequestSubmitting] = useState(false);
  const [selectedTeacherReport, setSelectedTeacherReport] = useState<DailyReport | null>(null);
  const [isTeacherReportDialogOpen, setIsTeacherReportDialogOpen] = useState(false);
  const [isExamDialogOpen, setIsExamDialogOpen] = useState(false);
  const [isExamSaving, setIsExamSaving] = useState(false);
  const [examDrafts, setExamDrafts] = useState<ExamCountdownSetting[]>(DEFAULT_EXAM_COUNTDOWNS);
  const [studyStartByDateKey, setStudyStartByDateKey] = useState<Record<string, Date | null>>({});
  const [studyEndByDateKey, setStudyEndByDateKey] = useState<Record<string, Date | null>>({});
  const [awayMinutesByDateKey, setAwayMinutesByDateKey] = useState<Record<string, number>>({});
  const [seasonParticipantCount, setSeasonParticipantCount] = useState(0);

  useEffect(() => { setToday(new Date()); }, []);

  const todayKey = today ? format(today, 'yyyy-MM-dd') : '';
  const yesterdayKey = today ? format(subDays(today, 1), 'yyyy-MM-dd') : '';
  const tomorrowKey = today ? format(addDays(today, 1), 'yyyy-MM-dd') : '';
  const weekKey = today ? format(today, "yyyy-'W'II") : '';
  const periodKey = today ? format(today, 'yyyy-MM') : '';

  // 1. 성장 및 통계 데이터 조회
  const progressRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: progress } = useDoc<GrowthProgress>(progressRef, { enabled: isActive });

  const studentProfileRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'students', user.uid);
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: studentProfile } = useDoc<StudentProfile>(studentProfileRef, { enabled: isActive });

  useEffect(() => {
    setExamDrafts(normalizeExamCountdowns(studentProfile?.examCountdowns));
  }, [studentProfile?.examCountdowns]);

  const studyLogRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || !todayKey) return null;
    return doc(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days', todayKey);
  }, [firestore, activeMembership?.id, user?.uid, todayKey]);
  const { data: todayStudyLog } = useDoc<StudyLogDay>(studyLogRef, { enabled: isActive });

  const recentLogsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days'),
      orderBy('dateKey', 'desc'),
      limit(30)
    );
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: recentLogs } = useCollection<StudyLogDay>(recentLogsQuery, { enabled: isActive });

  // 2. 계획 데이터 조회 (어제, 오늘, 내일)
  const targetDays = useMemo(() => isMobile ? [todayKey] : [yesterdayKey, todayKey, tomorrowKey], [isMobile, yesterdayKey, todayKey, tomorrowKey]);
  const allPlansRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || !weekKey) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items'),
      where('dateKey', 'in', targetDays)
    );
  }, [firestore, activeMembership?.id, user?.uid, weekKey, targetDays]);
  const { data: fetchedPlans } = useCollection<StudyPlanItem>(allPlansRef, { enabled: isActive });

  const weeklyPlansRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || !weekKey) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items'),
    );
  }, [firestore, activeMembership?.id, user?.uid, weekKey]);
  const { data: weeklyPlans } = useCollection<StudyPlanItem>(weeklyPlansRef, { enabled: isActive });

  const plansByDay = useMemo(() => {
    const map: Record<string, StudyPlanItem[]> = {};
    fetchedPlans?.forEach(p => {
      if (!map[p.dateKey]) map[p.dateKey] = [];
      map[p.dateKey].push(p);
    });
    return map;
  }, [fetchedPlans]);

  const logMinutesByDateKey = useMemo(() => {
    const map = new Map<string, number>();
    (recentLogs || []).forEach((log) => {
      map.set(log.dateKey, Math.max(0, Math.round(log.totalMinutes || 0)));
    });
    return map;
  }, [recentLogs]);

  useEffect(() => {
    if (!isActive || !firestore || !activeMembership?.id || !user?.uid || !today) {
      setStudyStartByDateKey({});
      setStudyEndByDateKey({});
      setAwayMinutesByDateKey({});
      return;
    }

    let cancelled = false;
    const centerId = activeMembership.id;
    const studentId = user.uid;
    const targetDateKeys = Array.from({ length: 7 }, (_, index) => {
      const day = subDays(today, 6 - index);
      return format(day, 'yyyy-MM-dd');
    });

    const loadRhythmTrends = async () => {
      try {
        const pairs = await Promise.all(
          targetDateKeys.map(async (dateKey) => {
            try {
              const statRef = doc(firestore, 'centers', centerId, 'dailyStudentStats', dateKey, 'students', studentId);
              const statSnap = await getDoc(statRef);
              const statData = statSnap.exists() ? (statSnap.data() as Record<string, unknown>) : null;
              const statStartHourRaw = statData?.startHour ?? statData?.firstStudyHour;
              const statEndHourRaw = statData?.endHour ?? statData?.lastStudyHour;
              const statAwayMinutesRaw = statData?.awayMinutes ?? statData?.breakMinutes;
              const statStart = hourNumberToDate(dateKey, typeof statStartHourRaw === 'number' ? statStartHourRaw : null);
              const statEnd = hourNumberToDate(dateKey, typeof statEndHourRaw === 'number' ? statEndHourRaw : null);
              const hasAwayMinutesStat = typeof statAwayMinutesRaw === 'number' && Number.isFinite(statAwayMinutesRaw);
              const statAwayMinutes = hasAwayMinutesStat
                ? Math.max(0, Math.round(statAwayMinutesRaw))
                : 0;

              if (statStart && statEnd && hasAwayMinutesStat) {
                return [
                  dateKey,
                  {
                    start: statStart,
                    end: statEnd,
                    awayMinutes: statAwayMinutes,
                  },
                ] as const;
              }

              const sessionsRef = collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', dateKey, 'sessions');
              const sessionsSnap = await getDocs(query(sessionsRef, orderBy('startTime', 'asc')));
              const sessions = sessionsSnap.docs
                .map((item) => item.data() as StudySession)
                .filter((item) => !!item.startTime)
                .map((item) => ({
                  startTime: toDateSafeAttendance(item.startTime as any),
                  endTime: toDateSafeAttendance(item.endTime as any),
                }))
                .filter((item) => item.startTime) as Array<{ startTime: Date; endTime: Date | null }>;

              const firstSession = sessions[0] || null;
              const lastSession = sessions[sessions.length - 1] || null;
              const sessionStart = firstSession?.startTime || null;
              const sessionEnd = lastSession?.endTime || lastSession?.startTime || null;
              let sessionAwayMinutes = 0;
              for (let i = 1; i < sessions.length; i += 1) {
                const prevEnd = sessions[i - 1].endTime;
                const currStart = sessions[i].startTime;
                if (!prevEnd || !currStart) continue;
                const gap = Math.round((currStart.getTime() - prevEnd.getTime()) / 60000);
                if (gap > 0 && gap < 180) sessionAwayMinutes += gap;
              }

              return [
                dateKey,
                {
                  start: sessionStart || statStart,
                  end: sessionEnd || statEnd,
                  awayMinutes: sessionAwayMinutes > 0 ? sessionAwayMinutes : statAwayMinutes,
                },
              ] as const;
            } catch {
              return [
                dateKey,
                { start: null, end: null, awayMinutes: 0 },
              ] as const;
            }
          })
        );

        if (cancelled) return;
        const nextStart: Record<string, Date | null> = {};
        const nextEnd: Record<string, Date | null> = {};
        const nextAway: Record<string, number> = {};
        pairs.forEach(([dateKey, value]) => {
          nextStart[dateKey] = value.start || null;
          nextEnd[dateKey] = value.end || null;
          nextAway[dateKey] = Math.max(0, Math.round(value.awayMinutes || 0));
        });
        setStudyStartByDateKey(nextStart);
        setStudyEndByDateKey(nextEnd);
        setAwayMinutesByDateKey(nextAway);
      } catch {
        if (cancelled) return;
        setStudyStartByDateKey({});
        setStudyEndByDateKey({});
        setAwayMinutesByDateKey({});
      }
    };

    void loadRhythmTrends();
    return () => {
      cancelled = true;
    };
  }, [isActive, firestore, activeMembership?.id, user?.uid, today]);

  // 3. 나의 신청 내역 조회
  const myRequestsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'attendanceRequests'),
      where('studentId', '==', user.uid)
    );
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: myRequestsRaw } = useCollection<AttendanceRequest>(myRequestsQuery, { enabled: isActive });

  const myRequests = useMemo(() => {
    if (!myRequestsRaw) return [];
    return [...myRequestsRaw]
      .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
      .slice(0, 5);
  }, [myRequestsRaw]);

  const myPenaltyLogsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'penaltyLogs'),
      where('studentId', '==', user.uid)
    );
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: myPenaltyLogsRaw } = useCollection<PenaltyLog>(myPenaltyLogsQuery, { enabled: isActive });

  const myPenaltyLogs = useMemo(() => {
    if (!myPenaltyLogsRaw) return [];
    return [...myPenaltyLogsRaw].sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  }, [myPenaltyLogsRaw]);

  // 4. 선생님 리포트 조회 (학생 본인 발송 완료본)
  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'dailyReports'),
      where('studentId', '==', user.uid),
      where('status', '==', 'sent')
    );
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: teacherReportsRaw, isLoading: isTeacherReportsLoading } = useCollection<DailyReport>(reportsQuery, { enabled: isActive });

  const teacherReports = useMemo(() => {
    if (!teacherReportsRaw) return [];
    return [...teacherReportsRaw].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [teacherReportsRaw]);

  const leaderboardEntryRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || !periodKey) return null;
    return doc(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_lp`, 'entries', user.uid);
  }, [firestore, activeMembership?.id, periodKey, user?.uid]);
  const { data: leaderboardEntry } = useDoc<LeaderboardEntry>(leaderboardEntryRef, { enabled: isActive });

  const centerAnnouncementsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'centerAnnouncements'),
      orderBy('createdAt', 'desc'),
      limit(12)
    );
  }, [firestore, activeMembership?.id]);
  const { data: centerAnnouncements } = useCollection<any>(centerAnnouncementsQuery, { enabled: isActive });

  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return;

    const prefetchRoutes = () => {
      router.prefetch('/dashboard/plan');
      router.prefetch('/dashboard/student-reports');
      router.prefetch('/dashboard/leaderboards');
      router.prefetch('/dashboard/appointments/inquiries');
    };

    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(prefetchRoutes, { timeout: 2000 });
      return () => window.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(prefetchRoutes, 800);
    return () => window.clearTimeout(timeoutId);
  }, [isActive, router]);

  useEffect(() => {
    if (!isActive || !firestore || !activeMembership || !periodKey) {
      setSeasonParticipantCount(0);
      return;
    }

    let cancelled = false;

    const loadParticipantCount = async () => {
      try {
        const entriesRef = collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_lp`, 'entries');
        const countSnapshot = await getCountFromServer(entriesRef);
        if (!cancelled) {
          setSeasonParticipantCount(countSnapshot.data().count);
        }
      } catch {
        if (!cancelled) {
          setSeasonParticipantCount(0);
        }
      }
    };

    void loadParticipantCount();

    return () => {
      cancelled = true;
    };
  }, [isActive, firestore, activeMembership?.id, periodKey]);

  useEffect(() => {
    if (!isActive || !user?.uid || isTeacherReportsLoading || teacherReports.length === 0) return;

    const latestUnviewed = teacherReports.find((report) => !report.viewedAt);
    if (!latestUnviewed) return;

    const storageKey = `student-report-auto-open:${user.uid}`;
    const lastOpenedReportId = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
    if (lastOpenedReportId === latestUnviewed.id) return;

    setSelectedTeacherReport(latestUnviewed);
    setIsTeacherReportDialogOpen(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, latestUnviewed.id);
    }
  }, [isActive, isTeacherReportsLoading, teacherReports, user?.uid]);

  // 5. 스탯 계산
  const stats = useMemo(() => {
    const raw = progress?.stats || { focus: 0, consistency: 0, achievement: 0, resilience: 0 };
    return {
      focus: Math.min(100, raw.focus),
      consistency: Math.min(100, raw.consistency),
      achievement: Math.min(100, raw.achievement),
      resilience: Math.min(100, raw.resilience),
    };
  }, [progress?.stats]);

  const studyTimeTrend = useMemo(() => {
    if (!today) return [] as Array<{ date: string; minutes: number }>;
    return Array.from({ length: 7 }, (_, index) => {
      const day = subDays(today, 6 - index);
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        date: format(day, 'MM/dd', { locale: ko }),
        minutes: logMinutesByDateKey.get(dateKey) || 0,
      };
    });
  }, [today, logMinutesByDateKey]);

  const dailyRhythmTrend = useMemo(() => {
    if (!today) return [] as { date: string; rhythmMinutes: number | null }[];
    return Array.from({ length: 7 }, (_, index) => {
      const day = subDays(today, 6 - index);
      const dateKey = format(day, 'yyyy-MM-dd');
      const studyStart = studyStartByDateKey[dateKey] || null;
      return {
        date: format(day, 'MM/dd', { locale: ko }),
        rhythmMinutes: studyStart ? studyStart.getHours() * 60 + studyStart.getMinutes() : null,
      };
    });
  }, [today, studyStartByDateKey]);

  const rhythmScoreTrend = useMemo(() => {
    const values = dailyRhythmTrend.map((point) => point.rhythmMinutes);
    return dailyRhythmTrend.map((point, index) => {
      const windowValues = values
        .slice(0, index + 1)
        .filter((value): value is number => typeof value === 'number');
      const score = windowValues.length >= 2 ? calculateRhythmScore(windowValues) : windowValues.length === 1 ? 100 : 0;
      return { date: point.date, score };
    });
  }, [dailyRhythmTrend]);

  const rhythmScoreAverage = useMemo(() => {
    const valid = rhythmScoreTrend.filter((item) => item.score > 0);
    if (!valid.length) return 0;
    return Math.round(valid.reduce((sum, item) => sum + item.score, 0) / valid.length);
  }, [rhythmScoreTrend]);

  const startEndTrend = useMemo(() => {
    if (!today) return [] as Array<{ date: string; startMinutes: number; endMinutes: number }>;
    return Array.from({ length: 7 }, (_, index) => {
      const day = subDays(today, 6 - index);
      const dateKey = format(day, 'yyyy-MM-dd');
      const start = studyStartByDateKey[dateKey];
      const end = studyEndByDateKey[dateKey];
      return {
        date: format(day, 'MM/dd', { locale: ko }),
        startMinutes: start ? start.getHours() * 60 + start.getMinutes() : 0,
        endMinutes: end ? end.getHours() * 60 + end.getMinutes() : 0,
      };
    });
  }, [today, studyStartByDateKey, studyEndByDateKey]);

  const awayTimeTrend = useMemo(() => {
    if (!today) return [] as Array<{ date: string; awayMinutes: number }>;
    return Array.from({ length: 7 }, (_, index) => {
      const day = subDays(today, 6 - index);
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        date: format(day, 'MM/dd', { locale: ko }),
        awayMinutes: Math.max(0, awayMinutesByDateKey[dateKey] || 0),
      };
    });
  }, [today, awayMinutesByDateKey]);

  const hasRhythmScoreTrend = useMemo(
    () => rhythmScoreTrend.some((item) => item.score > 0),
    [rhythmScoreTrend]
  );
  const hasStartEndTrend = useMemo(
    () => startEndTrend.some((item) => item.startMinutes > 0 || item.endMinutes > 0),
    [startEndTrend]
  );
  const hasAwayTrend = useMemo(
    () => awayTimeTrend.some((item) => item.awayMinutes > 0),
    [awayTimeTrend]
  );

  const rhythmYAxisDomain = useMemo(() => {
    const values = startEndTrend
      .flatMap((point) => [point.startMinutes, point.endMinutes])
      .filter((value) => value > 0);
    if (values.length === 0) return [420, 1320] as [number, number];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max(30, Math.round((max - min) * 0.25));
    const lower = Math.max(0, Math.floor((min - padding) / 30) * 30);
    const upper = Math.min(24 * 60, Math.ceil((max + padding) / 30) * 30);
    if (lower === upper) return [Math.max(0, lower - 60), Math.min(24 * 60, upper + 60)] as [number, number];
    return [lower, upper] as [number, number];
  }, [startEndTrend]);

  const examCountdowns = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    return normalizeExamCountdowns(studentProfile?.examCountdowns)
      .map((item) => {
        const parsed = item.date ? new Date(`${item.date}T00:00:00`) : null;
        const targetMs = parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : null;
        if (!targetMs) return { ...item, dLabel: '날짜 미설정', daysLeft: null as number | null };

        const diffDays = Math.ceil((targetMs - todayMs) / (1000 * 60 * 60 * 24));
        const dLabel = diffDays > 0 ? `D-${diffDays}` : diffDays === 0 ? 'D-Day' : `D+${Math.abs(diffDays)}`;
        return { ...item, dLabel, daysLeft: diffDays };
      })
      .sort((a, b) => {
        const aSort = a.daysLeft === null ? 9999 : Math.abs(a.daysLeft);
        const bSort = b.daysLeft === null ? 9999 : Math.abs(b.daysLeft);
        return aSort - bSort;
      });
  }, [studentProfile?.examCountdowns]);

  const subjectProgress = useMemo(() => {
    const bucket = new Map<string, { total: number; done: number }>();
    (weeklyPlans || [])
      .filter((item) => (item.category || 'study') === 'study')
      .forEach((item) => {
        const subject = item.subject?.trim() || '기타';
        const current = bucket.get(subject) || { total: 0, done: 0 };
        current.total += 1;
        if (item.done) current.done += 1;
        bucket.set(subject, current);
      });

    return Array.from(bucket.entries())
      .map(([subject, values]) => ({
        subject,
        total: values.total,
        done: values.done,
        rate: values.total > 0 ? Math.round((values.done / values.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [weeklyPlans]);

  const totalBoost = 1 + (stats.focus/100 * 0.05) + (stats.consistency/100 * 0.05) + (stats.achievement/100 * 0.05) + (stats.resilience/100 * 0.05);
  const penaltyPoints = progress?.penaltyPoints || 0;
  const penaltyRate = useMemo(() => {
    if (penaltyPoints >= 30) return 0.15; 
    if (penaltyPoints >= 20) return 0.10; 
    if (penaltyPoints >= 10) return 0.06; 
    if (penaltyPoints >= 5) return 0.03;  
    return 0; 
  }, [penaltyPoints]);
  const penaltyMultiplierPercent = Math.round((1 - penaltyRate) * 100);
  const finalMultiplier = totalBoost * (1 - penaltyRate);

  const handleStudyStartStop = useCallback(async () => {
    if (!firestore || !user || !activeMembership || !progressRef || !todayKey || !periodKey) return;
    if (isProcessingAction) {
      const lockAgeMs = actionLockAtRef.current ? Date.now() - actionLockAtRef.current : 0;
      if (lockAgeMs < 15000) return;
      console.warn('[student-track] action lock timed out; force unlock');
      setIsProcessingAction(false);
      actionLockAtRef.current = null;
      toast({
        variant: 'destructive',
        title: '버튼 잠금 해제',
        description: '처리가 지연되어 잠금을 해제했습니다. 한 번 더 눌러주세요.',
      });
      return;
    }

    actionLockAtRef.current = Date.now();
    setIsProcessingAction(true);
    try {
      const centerId = activeMembership.id;
      let seatDoc: any = null;
      let fallbackSeatRef: any = null;
      let fallbackSeatIdentity: ReturnType<typeof resolveSeatIdentity> | null = null;
      let fallbackSeatZone: string | null = null;
      try {
        const studentRef = doc(firestore, 'centers', centerId, 'students', user.uid);
        const studentSnap = await getDoc(studentRef);
        if (studentSnap.exists()) {
          const studentData = studentSnap.data() as Partial<StudentProfile>;
          const identity = resolveSeatIdentity(studentData);
          if (identity.seatId && identity.seatNo > 0) {
            fallbackSeatIdentity = identity;
            fallbackSeatZone = studentData?.seatZone || null;
            fallbackSeatRef = doc(firestore, 'centers', centerId, 'attendanceCurrent', identity.seatId);
          }
        }

        const attendanceCurrentRef = collection(firestore, 'centers', centerId, 'attendanceCurrent');
        const seatQuery = query(attendanceCurrentRef, where('studentId', '==', user.uid));
        const seatSnap = await getDocs(seatQuery);
        seatDoc = !seatSnap.empty ? pickPreferredSeatDoc(seatSnap.docs as any[]) : null;

        if (!seatDoc && fallbackSeatRef) {
          const fallbackSeatSnap = await getDoc(fallbackSeatRef);
          if (fallbackSeatSnap.exists()) {
            seatDoc = fallbackSeatSnap;
          }
        }
      } catch (seatError: any) {
        console.warn('[student-track] seat lookup skipped', seatError?.message || seatError);
      }

      if (isTimerActive) {
        const nowTs = Date.now();
        const safeStartTs = startTime || nowTs;
        const seatStatus = seatDoc?.data?.()?.status as AttendanceCurrent['status'] | undefined;
        if (seatStatus && !ACTIVE_ATTENDANCE_STATUSES.includes(seatStatus)) {
          setIsTimerActive(false);
          setStartTime(null);
          toast({
            title: '이미 종료된 세션입니다.',
            description: '중복 집계를 막기 위해 추가 합산을 건너뛰었습니다.',
          });
          return;
        }

        const safeSeatStart = seatDoc?.data?.()?.lastCheckInAt || Timestamp.fromMillis(safeStartTs);
        const sessionStartAt = toDateSafeAttendance(safeSeatStart) || new Date(safeStartTs);
        const sessionDateKey = format(sessionStartAt, 'yyyy-MM-dd');
        const sessionStudyLogRef = doc(firestore, 'centers', centerId, 'studyLogs', user.uid, 'days', sessionDateKey);
        const sessionId = `session_${safeSeatStart.toMillis()}`;
        const sessionSeconds = Math.max(0, Math.floor((nowTs - safeStartTs) / 1000));
        const sessionMinutes = Math.max(1, Math.ceil(sessionSeconds / 60));

        const batch = writeBatch(firestore);
        const progressUpdate: Record<string, any> = { updatedAt: serverTimestamp() };
        const existingSessionDayStatus = (progress?.dailyLpStatus?.[sessionDateKey] || {}) as Record<string, any>;
        const dailyStatusUpdate: Record<string, any> = { ...existingSessionDayStatus };
        const statsUpdate: Record<string, any> = {};
        let finalNewLp = progress?.seasonLp || 0;
        let earnedLpThisSession = false;
        let wroteSomething = false;

        if (sessionSeconds > 0) {
          const currentCumulativeMinutes = sessionDateKey === todayKey
            ? Number(todayStudyLog?.totalMinutes || 0)
            : 0;
          let existingSessionDayMinutes = currentCumulativeMinutes;
          if (sessionDateKey !== todayKey) {
            const sessionDaySnap = await getDoc(sessionStudyLogRef);
            existingSessionDayMinutes = Number(sessionDaySnap.data()?.totalMinutes || 0);
          }

          let studyLpEarned = Math.round(sessionMinutes * finalMultiplier);
          statsUpdate.focus = increment((sessionMinutes / 60) * 0.1);

          const totalMinutesAfterSession = existingSessionDayMinutes + sessionMinutes;

          if (totalMinutesAfterSession >= 180 && !progress?.dailyLpStatus?.[sessionDateKey]?.attendance) {
            studyLpEarned += Math.round(100 * finalMultiplier);
            dailyStatusUpdate.attendance = true;
            toast({ title: '\u0033\uC2DC\uAC04 \uB2EC\uC131! \uCD9C\uC11D \uBCF4\uB108\uC2A4 \uD3EC\uC778\uD2B8 \uD68D\uB4DD' });
          }

          if (totalMinutesAfterSession >= 360 && !progress?.dailyLpStatus?.[sessionDateKey]?.bonus6h) {
            statsUpdate.resilience = increment(0.5);
            dailyStatusUpdate.bonus6h = true;
            toast({ title: '\u0036\uC2DC\uAC04 \uC5F0\uC18D \uD559\uC2B5! \uD68C\uBCF5\uB825 \uC2A4\uD0EF \uC0C1\uC2B9' });
          }

          finalNewLp += studyLpEarned;
          earnedLpThisSession = studyLpEarned > 0;
          progressUpdate.seasonLp = increment(studyLpEarned);
          dailyStatusUpdate.dailyLpAmount = increment(studyLpEarned);

          if (Object.keys(statsUpdate).length > 0) {
            progressUpdate.stats = statsUpdate;
          }
          if (Object.keys(dailyStatusUpdate).length > 0) {
            progressUpdate.dailyLpStatus = {
              [sessionDateKey]: dailyStatusUpdate,
            };
          }

          batch.set(sessionStudyLogRef, {
            totalMinutes: increment(sessionMinutes),
            studentId: user.uid,
            centerId: activeMembership.id,
            dateKey: sessionDateKey,
            updatedAt: serverTimestamp(),
          }, { merge: true });
          wroteSomething = true;

          const statRef = doc(firestore, 'centers', centerId, 'dailyStudentStats', sessionDateKey, 'students', user.uid);
          const statSnap = await getDoc(statRef);
          const currentLongest = Number(statSnap.data()?.longestSessionMinutes ?? 0);
          batch.set(statRef, {
            totalStudyMinutes: increment(sessionMinutes),
            sessionCount: increment(1),
            longestSessionMinutes: Math.max(sessionMinutes, currentLongest),
            studentId: user.uid,
            centerId,
            dateKey: sessionDateKey,
            updatedAt: serverTimestamp(),
          }, { merge: true });
          wroteSomething = true;

          const sessionRef = doc(firestore, 'centers', centerId, 'studyLogs', user.uid, 'days', sessionDateKey, 'sessions', sessionId);
          batch.set(sessionRef, {
            startTime: safeSeatStart,
            endTime: Timestamp.fromMillis(nowTs),
            durationMinutes: sessionMinutes,
            sessionId,
            createdAt: serverTimestamp(),
          });
          wroteSomething = true;

          batch.set(progressRef, progressUpdate, { merge: true });
          wroteSomething = true;
        }
        const stopSeatRef = seatDoc?.ref || fallbackSeatRef;
        let stopSeatPayload: Record<string, any> | null = null;
        if (stopSeatRef) {
          stopSeatPayload = {
            studentId: user.uid,
            status: 'absent',
            updatedAt: serverTimestamp(),
          };
          if (fallbackSeatIdentity) {
            stopSeatPayload.seatNo = fallbackSeatIdentity.seatNo;
            stopSeatPayload.roomId = fallbackSeatIdentity.roomId;
            stopSeatPayload.roomSeatNo = fallbackSeatIdentity.roomSeatNo;
            stopSeatPayload.type = 'seat';
          }
          if (fallbackSeatZone) {
            stopSeatPayload.seatZone = fallbackSeatZone;
          }
          batch.set(stopSeatRef, stopSeatPayload, { merge: true });
          wroteSomething = true;
        }

        if (!wroteSomething) {
          batch.set(progressRef, { updatedAt: serverTimestamp() }, { merge: true });
        }

        let stopCommitError: any = null;
        let usedStopFallback = false;
        let stopRequestDeduped = false;
        try {
          await batch.commit();
        } catch (commitError: any) {
          const code = String(commitError?.code || '').toLowerCase();
          const message = String(commitError?.message || '').toLowerCase();
          const duplicateSession = code.includes('already-exists') || message.includes('already exists');
          if (duplicateSession) {
            stopCommitError = null;
            stopRequestDeduped = true;
            usedStopFallback = true;
            earnedLpThisSession = false;
            if (stopSeatRef && stopSeatPayload) {
              await setDoc(stopSeatRef, stopSeatPayload, { merge: true });
            }
            console.warn('[student-track] duplicated stop request ignored', { centerId, userId: user.uid, sessionId });
          } else {
            stopCommitError = commitError;
            console.error('[student-track] stop commit failed', commitError);
          }
        }

        if (stopCommitError && sessionStudyLogRef) {
          try {
            const fallbackSessionRef = doc(firestore, 'centers', centerId, 'studyLogs', user.uid, 'days', sessionDateKey, 'sessions', sessionId);
            const existingSessionSnap = await getDoc(fallbackSessionRef);
            if (existingSessionSnap.exists()) {
              if (stopSeatRef && stopSeatPayload) {
                await setDoc(stopSeatRef, stopSeatPayload, { merge: true });
              }
              stopRequestDeduped = true;
              usedStopFallback = true;
              earnedLpThisSession = false;
              stopCommitError = null;
              console.warn('[student-track] stop fallback skipped because session already existed');
            } else {
            const fallbackStudyLogData: any = {
              studentId: user.uid,
              centerId: activeMembership.id,
              dateKey: sessionDateKey,
              updatedAt: serverTimestamp(),
            };

            if (sessionSeconds > 0) {
              fallbackStudyLogData.totalMinutes = increment(sessionMinutes);
            }

            await setDoc(sessionStudyLogRef, fallbackStudyLogData, { merge: true });
            if (sessionSeconds > 0) {
              await setDoc(progressRef, progressUpdate, { merge: true });
            }

            if (sessionSeconds > 0) {
              await setDoc(fallbackSessionRef, {
                startTime: safeSeatStart,
                endTime: Timestamp.fromMillis(nowTs),
                durationMinutes: sessionMinutes,
                sessionId,
                createdAt: serverTimestamp(),
              });
            }

            usedStopFallback = true;
            stopCommitError = null;
            console.warn('[student-track] stop fallback saved core study logs while optional writes were skipped');
            }
          } catch (fallbackError: any) {
            console.error('[student-track] stop fallback failed', fallbackError);
          }
        }

        if (!stopCommitError && earnedLpThisSession && !stopRequestDeduped) {
          try {
            const rankRef = doc(firestore, 'centers', centerId, 'leaderboards', `${periodKey}_lp`, 'entries', user.uid);
            await setDoc(rankRef, {
              studentId: user.uid,
              displayNameSnapshot: user.displayName || '학생',
              classNameSnapshot: activeMembership.className || null,
              schoolNameSnapshot: studentProfile?.schoolName || null,
              value: finalNewLp,
              updatedAt: serverTimestamp(),
            }, { merge: true });
          } catch (rankError: any) {
            console.warn('[student-track] leaderboard sync skipped', rankError?.message || rankError);
          }
        }

        if (!stopCommitError && !stopRequestDeduped) {
          const checkInAtForAttendance = toDateSafeAttendance(safeSeatStart) || new Date(safeStartTs);
          void syncAutoAttendanceRecord({
            firestore,
            centerId,
            studentId: user.uid,
            studentName: user.displayName || '학생',
            targetDate: new Date(nowTs),
            checkInAt: checkInAtForAttendance,
            confirmedByUserId: user.uid,
          }).catch((syncError: any) => {
            console.warn('[student-track] auto attendance sync skipped', syncError?.message || syncError);
          });
        }

        if (!stopRequestDeduped) {
          void sendKakaoNotification(firestore, centerId, { studentName: user.displayName || '\uD559\uC0DD', type: 'exit' })
            .catch((notifyError: any) => {
              console.warn('[student-track] exit notification skipped', notifyError?.message || notifyError);
            });
        }

        setIsTimerActive(false);
        setStartTime(null);
        if (stopCommitError) {
          toast({
            variant: 'destructive',
            title: '공부 종료 저장 실패',
            description: '기록 저장 중 일부 권한 오류가 발생했습니다. 관리자에게 문의해 주세요.',
          });
        } else {
          const _newTotalMin = Number(todayStudyLog?.totalMinutes || 0) + sessionMinutes;
          const _fmtMin = (m: number) => m >= 60 ? `${Math.floor(m / 60)}시간${m % 60 > 0 ? ` ${m % 60}분` : ''}` : `${m}분`;
          toast({ title: '집중 종료됨', description: `이번 세션 ${_fmtMin(sessionMinutes)} · 오늘 총 ${_fmtMin(_newTotalMin)}` });
        }
      } else {
        const nowTs = Date.now();
        const batch = writeBatch(firestore);
        const checkInProgressUpdate: Record<string, any> = {
          updatedAt: serverTimestamp(),
          stats: { consistency: increment(0.5) },
          dailyLpStatus: { [todayKey]: { checkedIn: true } },
        };
        const needsCheckInSync = !progress?.dailyLpStatus?.[todayKey]?.checkedIn;
        let wroteSomething = false;

        if (needsCheckInSync) {
          batch.set(progressRef, checkInProgressUpdate, { merge: true });
          if (shouldShowDailyCheckInToast(centerId, user.uid, todayKey)) {
            toast({ title: '\uC785\uC2E4 \uD655\uC778! \uAFB8\uC900\uD568 \uC2A4\uD0EF +0.5 \uC0C1\uC2B9' });
          }
          wroteSomething = true;
        }
        const startSeatRef = seatDoc?.ref || fallbackSeatRef;
        if (startSeatRef) {
          const startSeatPayload: Record<string, any> = {
            studentId: user.uid,
            status: 'studying',
            lastCheckInAt: Timestamp.fromMillis(nowTs),
            updatedAt: serverTimestamp(),
          };
          if (fallbackSeatIdentity) {
            startSeatPayload.seatNo = fallbackSeatIdentity.seatNo;
            startSeatPayload.roomId = fallbackSeatIdentity.roomId;
            startSeatPayload.roomSeatNo = fallbackSeatIdentity.roomSeatNo;
            startSeatPayload.type = 'seat';
          }
          if (fallbackSeatZone) {
            startSeatPayload.seatZone = fallbackSeatZone;
          }
          batch.set(startSeatRef, startSeatPayload, { merge: true });
          wroteSomething = true;
        }

        if (!wroteSomething) {
          batch.set(progressRef, { updatedAt: serverTimestamp() }, { merge: true });
        }

        let startCommitError: any = null;
        let usedStartFallback = false;
        try {
          await batch.commit();
        } catch (commitError: any) {
          startCommitError = commitError;
          console.error('[student-track] start commit failed', commitError);
        }

        if (startCommitError && studyLogRef) {
          try {
            await setDoc(studyLogRef, {
              studentId: user.uid,
              centerId: activeMembership.id,
              dateKey: todayKey,
              updatedAt: serverTimestamp(),
            }, { merge: true });
            if (needsCheckInSync) {
              await setDoc(progressRef, checkInProgressUpdate, { merge: true });
            }
            usedStartFallback = true;
            startCommitError = null;
            console.warn('[student-track] start fallback kept study-day doc in sync');
          } catch (fallbackError: any) {
            console.error('[student-track] start fallback failed', fallbackError);
          }
        }

        if (!startCommitError) {
          void syncAutoAttendanceRecord({
            firestore,
            centerId,
            studentId: user.uid,
            studentName: user.displayName || '학생',
            targetDate: new Date(nowTs),
            checkInAt: new Date(nowTs),
            confirmedByUserId: user.uid,
          }).catch((syncError: any) => {
            console.warn('[student-track] auto attendance sync skipped', syncError?.message || syncError);
          });
        }

        void sendKakaoNotification(firestore, centerId, { studentName: user.displayName || '\uD559\uC0DD', type: 'entry' })
          .catch((notifyError: any) => {
            console.warn('[student-track] entry notification skipped', notifyError?.message || notifyError);
          });

        setStartTime(nowTs);
        setIsTimerActive(true);
        if (startCommitError) {
          toast({
            variant: 'destructive',
            title: '트랙 시작 실패',
            description: '학생 데이터 저장 권한을 확인해 주세요.',
          });
        } else if (!seatDoc && !fallbackSeatRef) {
          toast({
            variant: 'destructive',
            title: '트랙 시작됨 (좌석 연동 대기)',
            description: '좌석이 아직 배정되지 않았습니다. 선생님/관리자에게 좌석 배정을 요청해 주세요.',
          });
        } else if (usedStartFallback) {
          toast({
            title: '트랙 시작됨',
            description: '핵심 학습 데이터 저장은 완료되었고, 출결 연동은 건너뛰었습니다.',
          });
        }
      }
    } catch (e: any) {
      const detail = typeof e?.message === 'string' ? e.message : '\uC54C \uC218 \uC5C6\uB294 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.';
      console.error('[student-track] start/stop failed', e);
      toast({ variant: 'destructive', title: '\uACF5\uBD80 \uC0C1\uD0DC \uBCC0\uACBD \uC2E4\uD328', description: detail });
    } finally {
      setIsProcessingAction(false);
      actionLockAtRef.current = null;
    }
  }, [
    firestore,
    user,
    activeMembership,
    progressRef,
    isTimerActive,
    startTime,
    progress,
    todayStudyLog,
    todayKey,
    periodKey,
    studyLogRef,
    setIsTimerActive,
    setStartTime,
    toast,
    finalMultiplier,
    isProcessingAction,
  ]);

  useEffect(() => {
    if (!isProcessingAction) return;
    const timeout = setTimeout(() => {
      if (!isProcessingAction) return;
      setIsProcessingAction(false);
      actionLockAtRef.current = null;
      toast({
        variant: 'destructive',
        title: '버튼 잠금 해제',
        description: '처리가 길어져 버튼 잠금을 자동 해제했습니다.',
      });
    }, 15000);

    return () => clearTimeout(timeout);
  }, [isProcessingAction, toast]);

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

  const handleToggleTask = async (item: WithId<StudyPlanItem>) => {
    if (!firestore || !user || !activeMembership || !progressRef || !weekKey) return;
    const itemRef = doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id);
    const nextState = !item.done;
    
    await updateDoc(itemRef, { done: nextState, updatedAt: serverTimestamp() });
    
    if (nextState) {
      const batch = writeBatch(firestore);
      const achievementCount = progress?.dailyLpStatus?.[item.dateKey]?.achievementCount || 0;
      const progressUpdate: Record<string, any> = { updatedAt: serverTimestamp() };
      const existingDayStatus = (progress?.dailyLpStatus?.[item.dateKey] || {}) as Record<string, any>;
      const dayStatusUpdate: Record<string, any> = { ...existingDayStatus };
      const statsUpdate: Record<string, any> = {};
      let shouldCommitProgress = false;
      let shouldSyncRank = false;

      if (achievementCount < 5) {
        statsUpdate.achievement = increment(0.1);
        dayStatusUpdate.achievementCount = increment(1);
        shouldCommitProgress = true;
      }

      const dailyItems = plansByDay[item.dateKey] || [];
      const studyTasks = dailyItems.filter(p => p.category === 'study' || !p.category);
      const doneCount = studyTasks.filter(t => t.done).length + (item.category !== 'schedule' ? 1 : 0);
      
      let finalNewLp = progress?.seasonLp || 0;

      if (studyTasks.length >= 3 && doneCount === studyTasks.length && !progress?.dailyLpStatus?.[item.dateKey]?.plan) {
        const planLp = Math.round(100 * finalMultiplier);
        finalNewLp += planLp;
        progressUpdate.seasonLp = increment(planLp);
        dayStatusUpdate.plan = true;
        dayStatusUpdate.dailyLpAmount = increment(planLp);
        shouldCommitProgress = true;
        shouldSyncRank = true;
        toast({ title: "모든 계획 완료! 계획 보너스 포인트 획득 🎉" });
      }

      if (Object.keys(statsUpdate).length > 0) {
        progressUpdate.stats = statsUpdate;
      }
      if (Object.keys(dayStatusUpdate).length > 0) {
        progressUpdate.dailyLpStatus = {
          [item.dateKey]: dayStatusUpdate,
        };
      }

      if (shouldCommitProgress) {
        batch.set(progressRef, progressUpdate, { merge: true });
        await batch.commit();
      }

      if (shouldSyncRank) {
        try {
          const rankRef = doc(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_lp`, 'entries', user.uid);
          await setDoc(rankRef, {
            studentId: user.uid,
            displayNameSnapshot: user.displayName || '학생',
            classNameSnapshot: activeMembership.className || null,
            schoolNameSnapshot: studentProfile?.schoolName || null,
            value: finalNewLp,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch (rankError: any) {
          console.warn('[student-track] plan leaderboard sync skipped', rankError?.message || rankError);
        }
      }
    }
  };

  const handleRequestSubmit = async () => {
    if (!firestore || !activeMembership || !user || !progressRef) return;

    const trimmedReason = requestReason.trim();
    if (!requestDate) {
      toast({
        variant: 'destructive',
        title: '요청 날짜를 선택해 주세요.',
      });
      return;
    }
    if (trimmedReason.length < 10) {
      toast({
        variant: 'destructive',
        title: '사유는 10자 이상 입력해 주세요.',
      });
      return;
    }

    const penaltyDelta = REQUEST_PENALTY_POINTS[requestType] ?? 1;

    setIsRequestSubmitting(true);
    try {
      const requestRef = doc(collection(firestore, 'centers', activeMembership.id, 'attendanceRequests'));
      const penaltyLogRef = doc(collection(firestore, 'centers', activeMembership.id, 'penaltyLogs'));
      const batch = writeBatch(firestore);

      batch.set(requestRef, {
        studentId: user.uid,
        studentName: user.displayName || '학생',
        centerId: activeMembership.id,
        type: requestType,
        date: requestDate,
        reason: trimmedReason,
        status: 'requested',
        penaltyApplied: true,
        penaltyPointsDelta: penaltyDelta,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.set(progressRef, {
        penaltyPoints: increment(penaltyDelta),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      batch.set(penaltyLogRef, {
        centerId: activeMembership.id,
        studentId: user.uid,
        studentName: user.displayName || '학생',
        pointsDelta: penaltyDelta,
        reason: `${REQUEST_TYPE_LABEL[requestType]} 신청 - ${trimmedReason}`,
        source: 'attendance_request',
        requestId: requestRef.id,
        requestType,
        createdByUserId: user.uid,
        createdByName: user.displayName || '학생',
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      toast({
        title: `${REQUEST_TYPE_LABEL[requestType]} 신청이 접수되었습니다.`,
        description: `벌점 ${penaltyDelta}점이 자동 반영되었습니다.`,
      });
      setRequestReason('');
    } catch (e: any) {
      const errorMessage = typeof e?.message === 'string' && e.message.trim().length > 0
        ? e.message
        : '요청 처리 중 오류가 발생했습니다.';
      toast({
        variant: 'destructive',
        title: '신청 저장 실패',
        description: errorMessage,
      });
    } finally {
      setIsRequestSubmitting(false);
    }
  };

  const handleRequestSubmitInternal = async () => {
    await handleRequestSubmit();
  };

  const handleOpenTeacherReport = async (report: DailyReport) => {
    setSelectedTeacherReport(report);
    if (report.viewedAt || !firestore || !activeMembership?.id || !report.id || !user) return;

    const reportRef = doc(firestore, 'centers', activeMembership.id, 'dailyReports', report.id);
    updateDoc(reportRef, {
      viewedAt: serverTimestamp(),
      viewedByUid: user.uid,
      viewedByName: user.displayName || activeMembership.displayName || '학생',
    }).catch(() => {
      toast({
        variant: 'destructive',
        title: '읽음 표시 실패',
        description: '리포트는 열렸지만 읽음 상태를 저장하지 못했습니다.',
      });
    });
  };

  const handleExamDraftChange = (id: string, field: 'title' | 'date', value: string) => {
    setExamDrafts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const handleAddExamDraft = () => {
    if (examDrafts.length >= 6) return;
    setExamDrafts((prev) => [
      ...prev,
      {
        id: `exam_${Date.now()}`,
        title: '',
        date: '',
      },
    ]);
  };

  const handleRemoveExamDraft = (id: string) => {
    setExamDrafts((prev) => {
      const next = prev.filter((item) => item.id !== id);
      return next.length > 0 ? next : DEFAULT_EXAM_COUNTDOWNS;
    });
  };

  const handleSaveExamCountdowns = async () => {
    if (!studentProfileRef) return;
    setIsExamSaving(true);
    try {
      const payload = examDrafts
        .map((item) => ({
          id: item.id,
          title: item.title.trim(),
          date: item.date.trim(),
        }))
        .filter((item) => item.title.length > 0 && item.date.length > 0);

      await setDoc(
        studentProfileRef,
        {
          examCountdowns: payload,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      toast({
        title: '시험 디데이 설정 완료',
        description: '개인 시험 일정이 저장되었습니다.',
      });
      setIsExamDialogOpen(false);
    } catch (error) {
      console.error('[student-dashboard] save exam countdowns failed', error);
      toast({
        variant: 'destructive',
        title: '시험 설정 저장 실패',
        description: '잠시 후 다시 시도해주세요.',
      });
    } finally {
      setIsExamSaving(false);
    }
  };

  const PlanColumn = ({ dateKey, label }: { dateKey: string, label: string }) => {
    const items = plansByDay[dateKey] || [];
    const studyTasks = items.filter(p => p.category === 'study' || !p.category);
    const routineItems = items.filter(p => p.category === 'schedule');
    const isTodayCol = dateKey === todayKey;

    return (
      <div className={cn("flex flex-col gap-4 h-full", !isTodayCol && "opacity-60")}>
        <div className="flex items-center justify-between px-2">
          <div className="grid">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
            <span className="text-xs font-black text-[#14295F]">{dateKey}</span>
          </div>
          <Badge variant="outline" className="h-5 px-2 font-black text-[9px] border-primary/20">{studyTasks.filter(t => t.done).length}/{studyTasks.length} 완료</Badge>
        </div>
        
        <div className="flex-1 space-y-2.5">
          {studyTasks.length === 0 ? (
            <div className="py-10 text-center opacity-20 italic font-black text-[10px] border-2 border-dashed border-slate-200 rounded-3xl">계획 없음</div>
          ) : studyTasks.map(task => (
            <div key={task.id} className={cn(
              "flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-colors",
              task.done ? "bg-[#f8faff] border-primary/5" : "bg-white border-slate-100"
            )}>
              <Checkbox 
                checked={task.done} 
                onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} 
                className="h-5 w-5 rounded-md border-2" 
              />
              <Label className={cn(
                "flex-1 text-sm font-black tracking-tight leading-tight whitespace-nowrap truncate break-keep",
                task.done ? "line-through text-slate-400 italic" : "text-slate-800"
              )}>
                {task.title}
              </Label>
            </div>
          ))}
        </div>

        {routineItems.length > 0 && (
          <div className="pt-4 border-t border-dashed">
            <div className="flex flex-wrap gap-1.5">
              {routineItems.map(item => (
                <Badge key={item.id} variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-black text-[8px] h-5 px-2">
                  <Timer className="h-2.5 w-2.5 mr-1" /> {item.title.split(': ')[0]}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const qrData = user ? `ATTENDANCE_QR:${activeMembership?.id}:${user.uid}` : '';

  if (!isActive) return null;
  const totalMinutesCount = (todayStudyLog?.totalMinutes || 0) + Math.ceil(localSeconds / 60);
  const hDisplay = Math.floor(totalMinutesCount / 60);
  const mDisplay = totalMinutesCount % 60;
  const isJacob = user?.email === 'jacob444@naver.com';

  // dynamic hero message based on study state
  const heroMessage = (() => {
    if (isTimerActive) {
      if (totalMinutesCount >= 360) return '6시간 돌파! 오늘의 챔피언';
      if (totalMinutesCount >= 240) return '놀라운 집중력이에요';
      if (totalMinutesCount >= 120) return '좋은 흐름을 이어가세요';
      return '트랙 위를 달리고 있어요';
    }
    if (totalMinutesCount > 0) return '오늘도 성장한 하루였어요';
    return '오늘의 트랙을 시작해 보세요';
  })();

  // yesterday comparison percentage
  const studyVsYesterday = (() => {
    const yMin = logMinutesByDateKey.get(yesterdayKey) || 0;
    if (yMin === 0) return totalMinutesCount > 0 ? 100 : 0;
    return Math.round(((totalMinutesCount - yMin) / yMin) * 100);
  })();

  // today plan completion rate
  const todayStudyTasks = fetchedPlans?.filter((p) => p.dateKey === todayKey && (p.category === 'study' || !p.category)) || [];
  const todayDoneTaskCount = todayStudyTasks.filter((p) => p.done).length;
  const todayTaskCount = todayStudyTasks.length;
  const todayPlanRate = (() => {
    if (todayTaskCount === 0) return 0;
    return Math.round((todayDoneTaskCount / todayTaskCount) * 100);
  })();

  // unread teacher reports
  const unreadReportCount = teacherReports.filter(r => !r.viewedAt).length;
  const latestUnreadReport = teacherReports.find((report) => !report.viewedAt) || null;
  const latestCoachReport = teacherReports[0] || null;

  const weeklyStudyMinutes = useMemo(
    () => studyTimeTrend.reduce((sum, item) => sum + item.minutes, 0),
    [studyTimeTrend]
  );
  const previousWeekStudyMinutes = useMemo(() => {
    if (!today) return 0;
    return Array.from({ length: 7 }, (_, index) => {
      const day = subDays(today, 13 - index);
      const dateKey = format(day, 'yyyy-MM-dd');
      return logMinutesByDateKey.get(dateKey) || 0;
    }).reduce((sum, minutes) => sum + minutes, 0);
  }, [today, logMinutesByDateKey]);
  const weeklyStudyDelta = weeklyStudyMinutes - previousWeekStudyMinutes;
  const weeklyBestMinutes = useMemo(
    () => studyTimeTrend.reduce((max, item) => Math.max(max, item.minutes), 0),
    [studyTimeTrend]
  );
  const monthlyBestMinutes = useMemo(
    () => (recentLogs || []).reduce((max, item) => Math.max(max, Math.max(0, Number(item.totalMinutes || 0))), 0),
    [recentLogs]
  );
  const currentStreakDays = useMemo(() => {
    if (!today) return 0;
    let streak = 0;
    for (let offset = 0; offset < 30; offset += 1) {
      const dateKey = format(subDays(today, offset), 'yyyy-MM-dd');
      const minutes = logMinutesByDateKey.get(dateKey) || 0;
      if (minutes > 0) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  }, [today, logMinutesByDateKey]);
  const recentFivePlanWins = useMemo(() => {
    if (!today) return 0;
    return Array.from({ length: 5 }, (_, index) => {
      const dateKey = format(subDays(today, 4 - index), 'yyyy-MM-dd');
      return progress?.dailyLpStatus?.[dateKey]?.plan ? 1 : 0;
    }).reduce<number>((sum, count) => sum + count, 0);
  }, [today, progress?.dailyLpStatus]);
  const todayRemainingTasks = useMemo(
    () => todayStudyTasks.filter((item) => !item.done),
    [todayStudyTasks]
  );
  const todayMissionList = useMemo(
    () => todayRemainingTasks.slice(0, 3),
    [todayRemainingTasks]
  );
  const todayPotentialPlanBonus = useMemo(() => {
    const alreadyEarnedPlanBonus = !!progress?.dailyLpStatus?.[todayKey]?.plan;
    if (alreadyEarnedPlanBonus || todayStudyTasks.length < 3 || todayRemainingTasks.length === 0) return 0;
    return Math.round(100 * finalMultiplier);
  }, [progress?.dailyLpStatus, todayKey, todayStudyTasks.length, todayRemainingTasks.length, finalMultiplier]);
  const seasonRank = leaderboardEntry?.rank || 0;
  const seasonPercentile = useMemo(() => {
    if (!seasonRank || seasonParticipantCount <= 0) return null;
    return Math.max(1, Math.ceil((seasonRank / seasonParticipantCount) * 100));
  }, [seasonRank, seasonParticipantCount]);
  const nextTierInfo = useMemo(
    () => getNextTierInfo(progress?.seasonLp || 0),
    [progress?.seasonLp]
  );
  const latestAnnouncement = useMemo(() => {
    return (centerAnnouncements || []).find((item) => {
      const status = item?.status || 'published';
      const audience = item?.audience || 'student';
      return status === 'published' && (audience === 'student' || audience === 'all');
    }) || null;
  }, [centerAnnouncements]);
  const coachSummary = latestCoachReport?.aiMeta?.teacherOneLiner?.trim()
    || latestCoachReport?.nextAction?.trim()
    || summarizeReportLine(latestCoachReport?.content);
  const missionAction = useMemo(() => {
    if (isTimerActive) {
      return {
        title: '집중 흐름을 이어갈 시간',
        description: `${formatTimer(localSeconds)} 동안 몰입 중이에요. 지금 리듬을 유지하면 오늘 목표에 가장 빨리 도달할 수 있어요.`,
        cta: '집중 종료',
        meta: '공부 중',
        accent: `${todayDoneTaskCount}/${todayTaskCount || 0}개 완료`,
        mode: 'timer' as const,
      };
    }
    if (todayRemainingTasks.length > 0 && totalMinutesCount === 0) {
      return {
        title: '오늘의 첫 몰입을 시작해요',
        description: `남은 미션 ${todayRemainingTasks.length}개가 기다리고 있어요. 첫 세션을 열면 오늘의 흐름이 바로 시작됩니다.`,
        cta: '공부 시작',
        meta: '공부 전',
        accent: todayPotentialPlanBonus > 0 ? `완료 시 +${todayPotentialPlanBonus} LP 예상` : '오늘 목표부터 가볍게 시작',
        mode: 'start' as const,
      };
    }
    if (todayRemainingTasks.length > 0) {
      return {
        title: '남은 미션을 정리할 차례예요',
        description: `지금 ${todayRemainingTasks.length}개만 더 끝내면 오늘 계획이 한층 선명해져요.`,
        cta: '계획 보기',
        meta: '공부 후반',
        accent: todayPotentialPlanBonus > 0 ? `완료 시 +${todayPotentialPlanBonus} LP 예상` : '남은 목표를 마무리해요',
        mode: 'plan' as const,
      };
    }
    if (unreadReportCount > 0) {
      return {
        title: '오늘 성과를 선생님 코칭으로 마무리해요',
        description: `읽지 않은 리포트 ${unreadReportCount}건이 있어요. 지금 보면 오늘의 흐름을 더 잘 정리할 수 있어요.`,
        cta: '리포트 보기',
        meta: '공부 후',
        accent: coachSummary,
        mode: 'report' as const,
      };
    }
    return {
      title: '오늘의 루틴을 잘 마무리했어요',
      description: '이제 성과를 가볍게 돌아보고, 내일 목표를 준비해 두면 다음 집중이 더 쉬워집니다.',
      cta: '계획트랙 열기',
      meta: '마무리',
      accent: `이번 주 ${formatMinutesToKorean(weeklyStudyMinutes)} 공부`,
      mode: 'review' as const,
    };
  }, [
    isTimerActive,
    localSeconds,
    todayDoneTaskCount,
    todayTaskCount,
    todayRemainingTasks.length,
    totalMinutesCount,
    todayPotentialPlanBonus,
    unreadReportCount,
    coachSummary,
    weeklyStudyMinutes,
  ]);

  const handleMissionAction = useCallback(async () => {
    if (missionAction.mode === 'timer' || missionAction.mode === 'start') {
      await handleStudyStartStop();
      return;
    }
    if (missionAction.mode === 'report') {
      router.push('/dashboard/student-reports');
      return;
    }
    router.push('/dashboard/plan');
  }, [handleStudyStartStop, missionAction.mode, router]);

  return (
    <div className={cn("flex flex-col relative z-10", isMobile ? "gap-3" : "gap-6")}>
      <section className={cn(
        "relative overflow-hidden text-white border transition-colors duration-200",
        isMobile ? "rounded-[1.5rem] p-5" : "rounded-[2.5rem] p-8"
      )}
      style={{
        borderColor: tierTheme.heroBorder,
        backgroundImage: tierTheme.heroGradient,
      }}>
        <div className="pointer-events-none absolute top-0 right-0 p-8 sm:p-12 opacity-[0.08] rotate-12">
          {currentTier.name === '챌린저' ? <Crown className={cn(isMobile ? "h-20 w-20" : "h-64 w-64")} /> : <Trophy className={cn(isMobile ? "h-20 w-20" : "h-64 w-64")} />}
        </div>
        <div className={cn("relative z-10 flex flex-col", isMobile ? "items-center text-center gap-3" : "gap-5")}>
          {/* Row 1: Tier badge + dynamic message */}
          <div className={cn("flex items-center gap-2 flex-wrap", isMobile ? "justify-center" : "")}>
            <Badge
              variant="outline"
              className={cn("text-white border font-black tracking-[0.14em] uppercase px-2.5 py-1 shrink-0", isMobile ? "text-[8px]" : "text-[10px]")}
              style={{ backgroundColor: tierTheme.chipBg, borderColor: tierTheme.chipBorder }}
            >
              {currentTier.name} 티어
            </Badge>
            <span className={cn("font-black text-white/80", isMobile ? "text-xs" : "text-sm")}>{heroMessage}</span>
          </div>

          {/* Row 2: Today study time (large) + yesterday delta */}
          <div>
            <div className={cn("dashboard-number text-white tabular-nums leading-none", isMobile ? "text-5xl" : "text-7xl")}>
              {hDisplay}<span className={cn("opacity-50 font-bold ml-1", isMobile ? "text-base" : "text-xl")}>h</span>
              {' '}{mDisplay}<span className={cn("opacity-50 font-bold ml-1", isMobile ? "text-base" : "text-xl")}>m</span>
            </div>
            <div className={cn("flex items-center gap-2 mt-1.5", isMobile ? "justify-center" : "")}>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/60">오늘 공부</span>
              {totalMinutesCount > 0 && (
                <span className={cn(
                  "text-[10px] font-black px-2 py-0.5 rounded-full",
                  studyVsYesterday >= 0 ? "bg-white/20 text-white" : "bg-rose-500/30 text-white"
                )}>
                  어제 대비 {studyVsYesterday >= 0 ? '+' : ''}{studyVsYesterday}%
                </span>
              )}
            </div>
          </div>

          {/* Row 3: Timer (when active) + Start/Stop button */}
          <div className={cn("flex items-center gap-3", isMobile ? "flex-col w-full" : "flex-row")}>
            {isTimerActive && (
              <div
                className={cn("flex items-center gap-2 rounded-2xl border px-4 py-2", isMobile ? "w-full justify-center" : "")}
                style={{ backgroundColor: tierTheme.sessionBg, borderColor: tierTheme.subtleBorder }}
              >
                <span className="text-[9px] font-black uppercase tracking-widest opacity-50">세션</span>
                <span className={cn("dashboard-number text-white tabular-nums", isMobile ? "text-3xl" : "text-4xl")}>
                  {formatTimer(localSeconds)}
                </span>
              </div>
            )}
            <button
              type="button"
              disabled={isProcessingAction}
              className={cn(
                "rounded-2xl font-aggro-display font-black border flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed",
                isMobile ? "h-14 text-xl px-8 w-full" : "h-16 px-12 text-2xl",
                isTimerActive ? "bg-[#D34A4A] border-[#D34A4A] text-white" : "bg-[#F8FAFF] border-[#E5EBF5] text-primary"
              )}
              onClick={handleStudyStartStop}
            >
              {isProcessingAction ? (
                <Loader2 className={cn("animate-spin", isMobile ? "h-5 w-5" : "h-7 w-7")} />
              ) : isTimerActive ? (
                <>집중 종료 <Square className={cn(isMobile ? "h-4 w-4" : "h-6 w-6")} fill="currentColor" /></>
              ) : (
                <>집중 시작 <Play className={cn(isMobile ? "h-4 w-4" : "h-6 w-6")} fill="currentColor" /></>
              )}
            </button>
          </div>
        </div>
      </section>

      <section className={cn("grid gap-3 [&>*]:min-w-0", isMobile ? "grid-cols-2" : "grid-cols-12")}>
        <Card className={cn(
          "relative overflow-hidden border-none bg-white shadow-xl ring-1 ring-black/[0.04]",
          isMobile ? "col-span-2 mt-3 rounded-[1.5rem]" : "col-span-7 rounded-[2.5rem]"
        )}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r" style={{ backgroundImage: tierTheme.heroGradient }} />
          <CardContent className={cn("relative", isMobile ? "p-5 pt-8" : "p-8 pt-9")}>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <Badge className="border-none bg-primary/10 text-primary font-black text-[10px] tracking-[0.18em] uppercase">
                  {missionAction.meta}
                </Badge>
                <div>
                  <h2 className={cn("font-black tracking-tight text-slate-900", isMobile ? "text-[1.3rem] leading-[1.35] break-keep" : "text-[2.5rem] leading-[1.1]")}>
                    {missionAction.title}
                  </h2>
                  <p className={cn("mt-2 font-semibold text-slate-600 break-keep", isMobile ? "text-sm leading-6" : "text-base leading-7 max-w-2xl")}>
                    {missionAction.description}
                  </p>
                </div>
              </div>
              {!isMobile && (
                <div className="rounded-2xl bg-primary/5 text-primary shrink-0 p-3">
                  {missionAction.mode === 'report' ? <FileText className="h-6 w-6" /> : missionAction.mode === 'plan' || missionAction.mode === 'review' ? <ListTodo className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
                </div>
              )}
            </div>

            <div className={cn("mt-5 grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_auto] items-end")}>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="h-7 rounded-full border-primary/15 bg-primary/5 px-3 text-[10px] font-black text-primary">
                    오늘 목표 {todayDoneTaskCount}/{todayTaskCount || 0}
                  </Badge>
                  <Badge variant="outline" className="h-7 rounded-full border-emerald-200 bg-emerald-50 px-3 text-[10px] font-black text-emerald-700">
                    {missionAction.accent}
                  </Badge>
                  {weeklyStudyDelta !== 0 && (
                    <Badge variant="outline" className={cn(
                      "h-7 rounded-full px-3 text-[10px] font-black",
                      weeklyStudyDelta > 0 ? "border-sky-200 bg-sky-50 text-sky-700" : "border-slate-200 bg-slate-50 text-slate-600"
                    )}>
                      {weeklyStudyDelta > 0 ? '▲' : '▼'} {formatMinutesToKorean(Math.abs(weeklyStudyDelta))}
                    </Badge>
                  )}
                </div>
                {todayMissionList.length > 0 ? (
                  <div className="grid gap-2">
                    {todayMissionList.map((task, index) => (
                      <div key={task.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                        <div className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl font-black",
                          index === 0 ? "bg-primary text-white" : "bg-white text-primary ring-1 ring-slate-200"
                        )}>
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-900">{task.title}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {task.targetMinutes ? `${task.targetMinutes}분 목표` : '오늘의 미션'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={cn("rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50/70", isMobile ? "px-3 py-3" : "px-4 py-4")}>
                    <p className="text-sm font-black text-slate-800">오늘의 미션을 거의 마무리했어요.</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">지금 흐름을 유지하면 오늘 하루를 아주 깔끔하게 끝낼 수 있어요.</p>
                  </div>
                )}
              </div>

              <Button
                type="button"
                onClick={() => void handleMissionAction()}
                disabled={isProcessingAction && (missionAction.mode === 'timer' || missionAction.mode === 'start')}
                className={cn(
                  "rounded-2xl font-black shadow-lg transition-all",
                  isMobile ? "h-12 w-full text-sm" : "h-14 px-8 text-base"
                )}
              >
                {missionAction.cta} <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className={cn("grid gap-3", isMobile ? "col-span-2 grid-cols-2" : "col-span-5 grid-cols-2")}>
          <Card className="border-none bg-white shadow-lg ring-1 ring-black/[0.04] rounded-[1.5rem]">
            <CardContent className={cn("p-4", !isMobile && "p-5")}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">연속 성장</span>
                <RefreshCw className="h-4 w-4 text-rose-400" />
              </div>
              <div className="mt-3">
                <p className={cn("font-black tracking-tight text-slate-900", isMobile ? "text-2xl" : "text-3xl")}>
                  {currentStreakDays}<span className="ml-1 text-xs font-bold text-slate-400">일</span>
                </p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">최근 5일 목표 달성 {recentFivePlanWins}/5일</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none bg-white shadow-lg ring-1 ring-black/[0.04] rounded-[1.5rem]">
            <CardContent className={cn("p-4", !isMobile && "p-5")}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-sky-600">개인 최고</span>
                <Trophy className="h-4 w-4 text-sky-500" />
              </div>
              <div className="mt-3">
                <p className={cn("font-black tracking-tight text-slate-900", isMobile ? "text-xl leading-7" : "text-2xl leading-8")}>
                  {formatMinutesToKorean(weeklyBestMinutes || monthlyBestMinutes)}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                  {weeklyBestMinutes > 0 ? '최근 7일 최고 몰입' : '이번 달 최고 기록 준비 중'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Link href="/dashboard/leaderboards" className="block touch-manipulation">
            <Card className="h-full border-none bg-white shadow-lg ring-1 ring-black/[0.04] rounded-[1.5rem] transition-transform duration-200 hover:-translate-y-0.5">
              <CardContent className={cn("p-4", !isMobile && "p-5")}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">시즌 구간</span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </div>
                <div className="mt-3">
                  <p className={cn("font-black tracking-tight text-slate-900", isMobile ? "text-xl" : "text-2xl")}>
                    {seasonPercentile ? `상위 ${seasonPercentile}%` : '기록 준비중'}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    {nextTierInfo.remainingLp > 0 ? `${nextTierInfo.name}까지 ${nextTierInfo.remainingLp.toLocaleString()}점` : '지금 티어를 멋지게 유지 중'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {latestUnreadReport ? (
            <Link href="/dashboard/student-reports" className="block touch-manipulation">
              <Card className="h-full border-none bg-white shadow-lg ring-1 ring-black/[0.04] rounded-[1.5rem] transition-transform duration-200 hover:-translate-y-0.5">
                <CardContent className={cn("p-4", !isMobile && "p-5")}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">놓치면 아쉬운 것</span>
                    <Badge className="h-5 border-none bg-[#FF7A16] px-2 text-[9px] font-black text-white">리포트</Badge>
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-black leading-6 text-slate-900">{latestUnreadReport.dateKey} 코칭 도착</p>
                    <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500 line-clamp-3">{coachSummary}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ) : latestAnnouncement ? (
            <Link href="/dashboard/appointments/inquiries" className="block touch-manipulation">
              <Card className="h-full border-none bg-white shadow-lg ring-1 ring-black/[0.04] rounded-[1.5rem] transition-transform duration-200 hover:-translate-y-0.5">
                <CardContent className={cn("p-4", !isMobile && "p-5")}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">센터 공지</span>
                    <BellRing className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-black leading-6 text-slate-900 line-clamp-2">{latestAnnouncement.title || '센터 공지사항'}</p>
                    <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500 line-clamp-3">
                      {summarizeReportLine(latestAnnouncement.body)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ) : (
            <Card className="border-none bg-white shadow-lg ring-1 ring-black/[0.04] rounded-[1.5rem]">
              <CardContent className={cn("p-4", !isMobile && "p-5")}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-violet-600">시험 디데이</span>
                  <Calendar className="h-4 w-4 text-violet-500" />
                </div>
                <div className="mt-3">
                  <p className="text-sm font-black leading-6 text-slate-900">
                    {examCountdowns[0]?.title || '시험 일정 준비'}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    {examCountdowns[0]?.dLabel || '날짜를 등록하면 홈에서 바로 보여드릴게요.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <div className={cn("grid gap-2.5 [&>*]:min-w-0", isMobile ? "grid-cols-2 auto-rows-fr" : "grid-cols-3")}>
        <div className={cn(isMobile ? "col-span-2" : "")}>
          <StudySessionHistoryDialog studentId={user!.uid} centerId={activeMembership!.id} todayKey={todayKey} h={hDisplay} m={mDisplay} isMobile={isMobile} />
        </div>

        {/* Plan completion rate card */}
        <Card className={cn(
          "relative h-full min-w-0 overflow-hidden border border-emerald-200/80",
          isMobile
            ? "rounded-[1.4rem] bg-[radial-gradient(circle_at_top_right,#bbf7d0_0%,#ffffff_58%,#f0fdf4_100%)] p-4 shadow-[0_18px_40px_-28px_rgba(16,185,129,0.5)]"
            : "rounded-[2rem] bg-[linear-gradient(135deg,#f0fdf4_0%,#f7fffe_100%)] p-5"
        )}>
          {isMobile && <div className="pointer-events-none absolute -right-5 -top-7 h-16 w-16 rounded-full bg-emerald-200/70 blur-2xl" />}
          <div className="relative z-10 flex items-center justify-between gap-3 mb-2">
            <span className={cn("font-black uppercase tracking-widest text-emerald-600", isMobile ? "text-[8px]" : "text-[10px]")}>계획 달성</span>
            <div className={cn("rounded-xl flex items-center justify-center", isMobile ? "bg-white/85 p-1.5 shadow-sm" : "bg-emerald-100 p-2")}>
              <Target className={cn("text-emerald-600", isMobile ? "h-3 w-3" : "h-4 w-4")} />
            </div>
          </div>
          <div className="relative z-10 flex items-end justify-between gap-3">
            <div className={cn("dashboard-number text-emerald-600", isMobile ? "text-[2rem]" : "text-4xl")}>
              {todayPlanRate}<span className="opacity-40 font-bold text-xs ml-0.5">%</span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "border-emerald-200 bg-white/90 font-black text-emerald-700",
                isMobile ? "h-6 px-2 text-[10px]" : "h-7 px-2.5 text-[11px]"
              )}
            >
              {todayDoneTaskCount}/{todayTaskCount}
            </Badge>
          </div>
          <div className={cn("relative z-10 w-full rounded-full bg-emerald-100 overflow-hidden", isMobile ? "h-2 mt-3" : "h-2 mt-2")}>
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.min(todayPlanRate, 100)}%` }} />
          </div>
        </Card>

        {/* Penalty card with Dialog */}
        <div>
          <Dialog>
          <DialogTrigger asChild>
          <button type="button" className="text-left h-full w-full touch-manipulation">
              <Card className={cn(
                "relative h-full min-w-0 border overflow-hidden cursor-pointer transition-all duration-300",
                penaltyPoints === 0
                  ? "border-emerald-200 bg-[radial-gradient(circle_at_top_right,#bbf7d0_0%,#ffffff_58%,#f0fdf4_100%)]"
                  : penaltyPoints < 10
                    ? "border-slate-200/80 bg-[radial-gradient(circle_at_top_right,#f8fafc_0%,#ffffff_58%,#f8fafc_100%)]"
                    : "border-rose-200 bg-[radial-gradient(circle_at_top_right,#fecdd3_0%,#ffffff_58%,#fff1f2_100%)]",
                isMobile
                  ? "rounded-[1.4rem] p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]"
                  : "rounded-[2rem] p-5"
              )}>
                {isMobile && (
                  <div
                    className={cn(
                      "pointer-events-none absolute -right-5 -top-7 h-16 w-16 rounded-full blur-2xl",
                      penaltyPoints === 0 ? "bg-emerald-200/70" : penaltyPoints < 10 ? "bg-slate-200/70" : "bg-rose-200/70"
                    )}
                  />
                )}
                <div className="relative z-10 flex items-center justify-between gap-3 mb-2">
                  <span className={cn(
                    "font-black uppercase tracking-widest",
                    isMobile ? "text-[8px]" : "text-[10px]",
                    penaltyPoints === 0 ? "text-emerald-600" : penaltyPoints < 10 ? "text-slate-500" : "text-rose-600"
                  )}>벌점</span>
                  <div className={cn(
                    "rounded-xl flex items-center justify-center",
                    isMobile ? "bg-white/85 p-1.5 shadow-sm" : "p-2",
                    !isMobile && (penaltyPoints === 0 ? "bg-emerald-100" : penaltyPoints < 10 ? "bg-slate-100" : "bg-rose-100")
                  )}>
                    <ShieldAlert className={cn(
                      isMobile ? "h-3 w-3" : "h-4 w-4",
                      penaltyPoints === 0 ? "text-emerald-600" : penaltyPoints < 10 ? "text-slate-500" : "text-rose-600"
                    )} />
                  </div>
                </div>
                <div className="relative z-10 flex items-end justify-between gap-3">
                  <div className={cn(
                    "dashboard-number",
                    isMobile ? "text-[2rem]" : "text-4xl",
                    penaltyPoints === 0 ? "text-emerald-600" : penaltyPoints < 10 ? "text-slate-700" : "text-rose-600"
                  )}>
                  {penaltyPoints}<span className="opacity-40 font-bold text-xs ml-0.5">점</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "bg-white/90 font-black",
                      isMobile ? "h-6 px-2 text-[10px]" : "h-7 px-2.5 text-[11px]",
                      penaltyPoints === 0
                        ? "border-emerald-200 text-emerald-700"
                        : penaltyPoints < 10
                          ? "border-slate-200 text-slate-600"
                          : "border-rose-200 text-rose-700"
                    )}
                  >
                    {penaltyMultiplierPercent}%
                  </Badge>
                </div>
                <p className={cn(
                  "relative z-10 font-bold mt-2",
                  isMobile ? "text-[9px]" : "text-[10px]",
                  penaltyPoints === 0 ? "text-emerald-500" : penaltyPoints < 10 ? "text-slate-400" : "text-rose-500"
                )}>
                  {penaltyPoints === 0 ? '안정' : penaltyPoints < 10 ? '양호' : '주의'}
                </p>
              </Card>
            </button>
          </DialogTrigger>
          <DialogContent className={cn("rounded-[3rem] border border-slate-200 p-0 overflow-hidden sm:max-w-2xl flex flex-col", isMobile ? "max-w-[95vw] rounded-[2rem] h-[85vh]" : "max-h-[90vh]")}>
            <div className={cn("bg-rose-600 text-white relative shrink-0", isMobile ? "p-6" : "p-10")}>
          <ShieldAlert className="pointer-events-none absolute top-0 right-0 p-8 h-32 w-32 opacity-20 rotate-12" />
              <DialogHeader>
                <DialogTitle className={cn("font-black tracking-tighter", isMobile ? "text-3xl" : "text-4xl")}>벌점 및 규정 가이드</DialogTitle>
                <DialogDescription className="text-white/70 font-bold mt-1 text-sm">벌점은 쌓이지 않게, 성장은 끊기지 않게 관리하세요.</DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar">
              <div className={cn("p-10 text-center space-y-6", isMobile ? "p-5" : "")}>
                <div className="inline-flex flex-col items-center gap-1">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">벌점 점수</span>
                  <h3 className={cn("dashboard-number text-8xl", penaltyPoints < 10 ? "text-emerald-500" : "text-rose-600")}>{penaltyPoints}</h3>
                </div>
                <Progress value={penaltyPoints * 3.3} className="h-3 bg-muted" />
                <p className="text-sm font-bold text-slate-600">{penaltyPoints < 10 ? "안정적인 학습 상태입니다!" : "주의가 필요한 단계입니다."}</p>

                <div className={cn("grid gap-3 text-left mx-auto", isMobile ? "max-w-full" : "max-w-2xl")}>
                  <div className="rounded-2xl border border-rose-100 bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-rose-600">벌점이 발생하는 경우</p>
                    <ul className="mt-2 space-y-1.5 text-xs font-semibold text-slate-700 leading-relaxed">
                      <li>지각 신청 접수 시 +1점이 반영됩니다.</li>
                      <li>결석 신청 접수 시 +2점이 반영됩니다.</li>
                      <li>당일 출석 루틴을 작성하거나 수정하면 +1점이 반영됩니다.</li>
                      <li>루틴이 없는 날은 +{ROUTINE_MISSING_PENALTY_POINTS}점이 자동 반영됩니다.</li>
                      <li>센터 관리자/선생님이 생활 기록 벌점을 부여하면 누적 점수에 추가됩니다.</li>
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">누적 시 적용되는 규정</p>
                    <div className="mt-2 space-y-1.5 text-xs font-semibold text-slate-700">
                      <div className="flex items-center justify-between"><span>0~4점</span><span>포인트 감점 없음 (100%)</span></div>
                      <div className="flex items-center justify-between"><span>5~9점</span><span>포인트 3% 감소 (97%)</span></div>
                      <div className="flex items-center justify-between"><span>10~19점</span><span>포인트 6% 감소 (94%)</span></div>
                      <div className="flex items-center justify-between"><span>20~29점</span><span>포인트 10% 감소 (90%)</span></div>
                      <div className="flex items-center justify-between"><span>30점 이상</span><span>포인트 15% 감소 (85%)</span></div>
                    </div>
                    <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">
                      현재 {penaltyPoints}점 → 이번 포인트 배율 {penaltyMultiplierPercent}% 적용
                    </div>
                  </div>

                  <div className="rounded-2xl border border-rose-100 bg-white p-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-rose-600">벌점 부여 사유 내역</p>
                    {myPenaltyLogs.length === 0 ? (
                      <p className="mt-2 text-xs font-semibold text-slate-500">현재 기록된 벌점 사유가 없습니다.</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {myPenaltyLogs.map((log) => {
                          const createdAtDate = log.createdAt?.toDate?.();
                          const createdAtLabel = createdAtDate ? format(createdAtDate, 'yyyy-MM-dd HH:mm') : '시간 미기록';
                          const sourceLabel = PENALTY_SOURCE_LABEL[log.source] ?? '기타';
                          return (
                            <div key={log.id} className="rounded-xl border border-rose-100 bg-rose-50/40 px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] font-black text-slate-800">{log.reason || '사유 미입력'}</p>
                                <Badge variant="outline" className="shrink-0 border-rose-200 bg-white text-rose-700 text-[10px] font-black">
                                  +{log.pointsDelta}점
                                </Badge>
                              </div>
                              <p className="mt-1 text-[10px] font-semibold text-slate-500">
                                {createdAtLabel} · {sourceLabel}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="p-6 bg-white border-t shrink-0 flex justify-center"><DialogClose asChild><Button className="w-full h-14 rounded-2xl font-black text-lg">확인했습니다</Button></DialogClose></DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className={cn("border border-slate-200/80 rounded-[2.25rem] bg-white overflow-hidden", isMobile ? "rounded-[1.5rem]" : "")}>
        <CardHeader className={cn("bg-slate-50/50 border-b flex flex-row items-center justify-between", isMobile ? "p-5" : "p-8")}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/5 text-primary">
              <ListTodo className="h-6 w-6" />
            </div>
            <div className="grid">
              <CardTitle className="font-aggro-display font-black text-2xl tracking-tighter text-slate-900 leading-none">계획트랙</CardTitle>
              <p className="font-aggro-display text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">학습 루틴 보드</p>
            </div>
          </div>
          {isMobile ? (
            <Badge variant="outline" className="bg-[#eef4ff] text-primary border-[#dbe8ff] font-black h-6 px-3">{fetchedPlans?.filter(p => p.dateKey === todayKey && p.done).length || 0} 완료</Badge>
          ) : (
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border">
              <span className="text-[11px] font-black text-primary uppercase tracking-widest whitespace-nowrap">3일 아카이브 보기</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </div>
          )}
        </CardHeader>
        
        <CardContent className={cn(isMobile ? "p-5" : "p-10")}>
          {isMobile ? (
            <div className="max-w-xl mx-auto">
              <PlanColumn dateKey={todayKey} label="오늘의 목표" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-10">
              <div className="relative">
                <PlanColumn dateKey={yesterdayKey} label="어제의 복기" />
                    <div className="pointer-events-none absolute top-0 -right-5 h-full w-px bg-slate-200" />
              </div>
              <div className="relative">
                <PlanColumn dateKey={todayKey} label="오늘의 집중" />
                    <div className="pointer-events-none absolute top-0 -right-5 h-full w-px bg-slate-200" />
              </div>
              <PlanColumn dateKey={tomorrowKey} label="내일의 준비" />
            </div>
          )}
        </CardContent>
      </Card>

      <section className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-3")}>
        {isMobile ? (
          <Dialog
            open={isTeacherReportDialogOpen}
            onOpenChange={(open) => {
              setIsTeacherReportDialogOpen(open);
              if (!open) setSelectedTeacherReport(null);
            }}
          >
            <DialogTrigger asChild>
              <button className="group text-left h-full w-full touch-manipulation">
                <Card className={cn(
                  "h-full bg-white transition-colors duration-200 flex flex-row items-center gap-4",
                  "rounded-2xl p-4",
                  unreadReportCount > 0 ? "border-[#FF7A16] ring-1 ring-[#FF7A16]/30" : "border border-slate-200/80"
                )}>
                  <div className="rounded-2xl bg-primary/5 flex items-center justify-center shrink-0 h-12 w-12">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="grid min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black tracking-tighter whitespace-nowrap truncate text-sm">선생님 리포트</span>
                      {unreadReportCount > 0 && (
                        <Badge className="bg-[#FF7A16] text-white border-none font-black text-[8px] h-5 px-2 shrink-0">
                          {unreadReportCount} 새 리포트
                        </Badge>
                      )}
                    </div>
                    <span className="font-bold text-muted-foreground uppercase tracking-widest text-[8px] whitespace-nowrap">학습 피드백</span>
                  </div>
                  <ChevronRight className="ml-auto h-5 w-5 opacity-20" />
                </Card>
              </button>
            </DialogTrigger>
            <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border border-slate-200 flex flex-col", "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] h-[85vh] max-w-[450px] rounded-[2rem]")}>
              <div className="bg-primary p-8 text-white relative shrink-0">
          <FileText className="pointer-events-none absolute top-0 right-0 p-8 h-24 w-24 opacity-20" />
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black">{selectedTeacherReport ? `${selectedTeacherReport.dateKey} 리포트` : '선생님 리포트'}</DialogTitle>
                  <DialogDescription className="text-white/70 font-bold">
                    {selectedTeacherReport ? '선생님이 발송한 리포트 상세 내용입니다.' : '최근에 발송된 리포트를 바로 확인할 수 있어요.'}
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar p-6">
                {selectedTeacherReport ? (
                  <div className="bg-white rounded-2xl border border-border/50 p-4">
                    <VisualReportViewer content={selectedTeacherReport.content} />
                  </div>
                ) : isTeacherReportsLoading ? (
                  <div className="py-16 flex justify-center">
                    <Loader2 className="animate-spin h-8 w-8 text-primary opacity-30" />
                  </div>
                ) : teacherReports.length === 0 ? (
                  <div className="py-14 text-center rounded-2xl border-2 border-dashed border-muted-foreground/10 italic text-[10px] font-black text-muted-foreground">
                    아직 받은 선생님 리포트가 없습니다.
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {teacherReports.slice(0, 10).map((report) => (
                      <button
                        key={report.id}
                        type="button"
                        onClick={() => handleOpenTeacherReport(report)}
                        className="w-full text-left p-4 rounded-2xl bg-white border border-border/50 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary/50">{report.dateKey}</span>
                            <Badge variant="outline" className={cn(
                              "font-black text-[8px] border-none px-2 h-4",
                              report.viewedAt ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                            )}>
                              {report.viewedAt ? '읽음' : '미확인'}
                            </Badge>
                          </div>
                          <p className="text-[11px] font-bold text-muted-foreground line-clamp-1 mt-1">
                            {report.content.replace(/[🕒✅📊💬🧠]/g, '').trim()}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="p-4 border-t shrink-0 bg-white flex items-center gap-2">
                {selectedTeacherReport && (
                  <Button
                    variant="outline"
                    className="flex-1 h-12 rounded-xl font-black"
                    onClick={() => setSelectedTeacherReport(null)}
                  >
                    목록으로
                  </Button>
                )}
                <DialogClose asChild>
                  <Button className={cn("h-12 rounded-xl font-black", selectedTeacherReport ? "flex-1" : "w-full")}>
                    닫기
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
            <Link href="/dashboard/student-reports" className="group h-full touch-manipulation">
            <Card className={cn(
              "h-full bg-white transition-colors duration-200 flex flex-row items-center gap-4 rounded-[2rem] p-6",
              unreadReportCount > 0 ? "border-[#FF7A16] ring-1 ring-[#FF7A16]/30" : "border border-slate-200/80"
            )}>
              <div className="rounded-2xl bg-primary/5 flex items-center justify-center shrink-0 h-16 w-16">
                <FileText className="h-8 w-8" />
              </div>
              <div className="grid text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-black tracking-tighter whitespace-nowrap truncate text-xl">선생님 리포트</span>
                  {unreadReportCount > 0 && (
                    <Badge className="bg-[#FF7A16] text-white border-none font-black text-[9px] h-5 px-2 shrink-0">
                      {unreadReportCount} 새 리포트
                    </Badge>
                  )}
                </div>
                <span className="font-bold text-muted-foreground uppercase tracking-widest text-[10px] whitespace-nowrap">학습 피드백</span>
              </div>
              <ChevronRight className="ml-auto h-5 w-5 opacity-20" />
            </Card>
          </Link>
        )}

        <Dialog>
          <DialogTrigger asChild>
              <button className="group text-left h-full w-full touch-manipulation">
              <Card className={cn(
                "h-full border border-slate-200/80 bg-white transition-colors duration-200 flex flex-row items-center gap-4",
                isMobile ? "rounded-2xl p-4" : "rounded-[2rem] p-6"
              )}>
                <div className={cn("rounded-2xl bg-amber-50 flex items-center justify-center shrink-0", isMobile ? "h-12 w-12" : "h-16 w-16")}>
                  <ClipboardPen className={cn("text-amber-600", isMobile ? "h-6 w-6" : "h-8 w-8")} />
                </div>
                <div className="grid min-w-0">
                  <span className={cn("font-black tracking-tighter whitespace-nowrap truncate", isMobile ? "text-sm" : "text-xl")}>지각/결석 신청</span>
                  <span className={cn("font-bold text-muted-foreground uppercase tracking-widest text-[8px] sm:text-[10px] whitespace-nowrap")}>빠른 요청</span>
                </div>
                <ChevronRight className="ml-auto h-5 w-5 opacity-20" />
              </Card>
            </button>
          </DialogTrigger>
          <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border border-slate-200 flex flex-col", isMobile ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] h-[85vh] max-w-[450px] rounded-[2rem]" : "sm:max-w-2xl max-h-[90vh]")}>
            <div className="bg-amber-500 p-8 text-white relative shrink-0">
          <BellRing className="pointer-events-none absolute top-0 right-0 p-8 h-24 w-24 opacity-20" />
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">신청서 작성</DialogTitle>
                <DialogDescription className="text-white/70 font-bold">지각 또는 결석 사유를 입력하여 제출하세요.</DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar">
              <div className="p-8 space-y-8">
                <div className="grid gap-6 bg-white p-6 rounded-[2rem] border">
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
                    <Textarea placeholder="사유를 상세히 입력해 주세요." value={requestReason} onChange={e => setRequestReason(e.target.value)} className="rounded-2xl border-2 min-h-[100px] font-bold text-sm resize-none" />
                  </div>
                  {requestDate === format(new Date(), 'yyyy-MM-dd') && (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-3"><AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" /><p className="text-[11px] font-bold text-rose-900">당일 신청도 먼저 접수되며, 담당 선생님 승인 후 센터 규정에 따라 반영됩니다.</p></div>
                  )}
                  <Button onClick={handleRequestSubmitInternal} disabled={isRequestSubmitting || requestReason.length < 10} className="w-full h-14 rounded-2xl font-black bg-amber-500 hover:bg-amber-600 text-white">
                    {isRequestSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : '신청서 제출하기'}
                  </Button>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-primary/60 tracking-widest ml-1 flex items-center gap-2"><History className="h-3.5 w-3.5" /> 최근 신청 내역</h4>
                  <div className="grid gap-2">
                    {myRequests.length === 0 ? <div className="py-10 text-center rounded-2xl border-2 border-dashed border-muted-foreground/10 italic text-[10px]">내역이 없습니다.</div> : myRequests.map(req => (
                      <div key={req.id} className="p-4 rounded-2xl bg-white border border-border/50 flex items-center justify-between"><div className="flex items-center gap-3"><div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", req.type === 'late' ? "bg-amber-50" : "bg-rose-50")}>{req.type === 'late' ? <Clock className="h-4 w-4 text-amber-600" /> : <CalendarX className="h-4 w-4 text-rose-600" />}</div><div className="grid leading-tight"><span className="font-black text-xs">{req.date} {req.type === 'late' ? '지각' : '결석'}</span><span className="text-[9px] font-bold text-muted-foreground line-clamp-1 max-w-[150px]">{req.reason}</span></div></div><Badge variant="outline" className={cn("font-black text-[9px] border-none px-2", req.status === 'requested' ? "bg-muted text-muted-foreground" : req.status === 'approved' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")}>{req.status === 'requested' ? '승인대기' : req.status === 'approved' ? '승인완료' : '반려'}</Badge></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="p-6 border-t shrink-0 bg-white"><DialogClose asChild><Button variant="ghost" className="w-full font-black">닫기</Button></DialogClose></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* LP, Trend, QR column */}
        <div className={cn("flex flex-col gap-3", isMobile ? "" : "")}>
          <LPHistoryDialog dailyLpStatus={progress?.dailyLpStatus} totalBoost={totalBoost} isMobile={isMobile} />
          <StudyTimeTrendDialog
            studyTimeTrend={studyTimeTrend}
            rhythmScoreTrend={rhythmScoreTrend}
            rhythmScoreAverage={rhythmScoreAverage}
            startEndTrend={startEndTrend}
            awayTimeTrend={awayTimeTrend}
            hasRhythmScoreTrend={hasRhythmScoreTrend}
            hasStartEndTrend={hasStartEndTrend}
            hasAwayTrend={hasAwayTrend}
            rhythmYAxisDomain={rhythmYAxisDomain}
            isMobile={isMobile}
          />
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className={cn(
                  "w-full rounded-2xl border border-slate-200/80 bg-white font-black gap-2 flex items-center justify-center text-primary transition-colors hover:bg-slate-50",
                  isMobile ? "h-12 text-sm" : "h-14 text-base"
                )}
              >
                <QrCode className="h-4 w-4" /> 나의 출입 QR
              </button>
            </DialogTrigger>
            <DialogContent className="rounded-[3rem] p-0 overflow-hidden border border-slate-200 sm:max-w-sm">
              <div className="bg-primary p-8 text-white text-center">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black tracking-tighter text-white">나의 출입 QR</DialogTitle>
                  <DialogDescription className="text-white/70 font-bold mt-1">센터 입구 카메라에 스캔해 주세요.</DialogDescription>
                </DialogHeader>
              </div>
              <div className="p-10 bg-white flex flex-col items-center gap-6">
                <div className="p-6 rounded-[2rem] bg-[#fafafa] border border-primary/15">
                  <QRCodeSVG value={qrData} size={200} level="H" includeMargin={false} />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-black text-primary text-xl tracking-tight">{user?.displayName}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">출입 인증용</p>
                </div>
              </div>
              <DialogFooter className="p-6 bg-muted/30">
                <DialogClose asChild><Button className="w-full h-12 rounded-xl font-black">닫기</Button></DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      {isJacob && !isMobile && progressRef && activeMembership && <JacobTierController progressRef={progressRef} currentStats={stats} currentLp={progress?.seasonLp || 0} userId={user.uid} centerId={activeMembership.id} periodKey={periodKey} displayName={user.displayName || 'Jacob'} className={activeMembership.className} schoolName={studentProfile?.schoolName} />}
    </div>
  );
}

