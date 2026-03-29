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
  Wand2,
  History,
  Calendar,
  FileText,
  ClipboardPen,
  AlertOctagon,
  BellRing,
  Info,
  ShieldAlert,
  ClipboardCheck,
  UserCheck,
  CalendarX,
  UserMinus,
  QrCode,
  Plus,
  Trash2
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { useDoc, useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { doc, collection, query, where, updateDoc, setDoc, serverTimestamp, increment, writeBatch, Timestamp, getDoc, orderBy, addDoc, limit, getDocs } from 'firebase/firestore';
import { addDays, subDays, format, isSameDay, parse, isAfter } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '../ui/progress';
import { cn } from '@/lib/utils';
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
import { DailyStudentStat, StudyPlanItem, StudyLogDay, GrowthProgress, StudentProfile, LeaderboardEntry, StudySession, AttendanceRequest, CenterMembership, AttendanceCurrent, DailyReport, PenaltyLog } from '@/lib/types';
import { sendKakaoNotification } from '@/lib/kakao-service';
import { QRCodeSVG } from 'qrcode.react';
import { VisualReportViewer } from '@/components/dashboard/visual-report-viewer';
import {
  ROUTINE_MISSING_PENALTY_POINTS,
  syncAutoAttendanceRecord,
  toDateSafe as toDateSafeAttendance,
} from '@/lib/attendance-auto';
import { resolveSeatIdentity } from '@/lib/seat-layout';
import {
  NAVY_REWARD_THEME,
  formatStudyMinutes,
  formatStudyMinutesShort,
  getAvailableStudyBoxMilestones,
  getClaimedStudyBoxes,
  getDailyFortuneMessage,
  rollStudyBoxReward,
  type StudyBoxReward,
} from '@/lib/student-rewards';

const ACTIVE_ATTENDANCE_STATUSES: AttendanceCurrent['status'][] = ['studying', 'away', 'break'];

function summarizeReportLine(content?: string | null) {
  if (!content) return '오늘의 코칭이 도착하면 이곳에서 바로 확인할 수 있어요.';
  return content
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 84);
}


function isActiveStudentStatus(status: unknown): boolean {
  if (typeof status !== 'string') return true;
  const normalized = status.trim().toLowerCase();
  if (!normalized) return true;
  return normalized === 'active';
}

function isSyntheticStudentId(studentId: unknown): boolean {
  if (typeof studentId !== 'string') return true;
  const normalized = studentId.trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.startsWith('test-') ||
    normalized.startsWith('seed-') ||
    normalized.startsWith('mock-') ||
    normalized.includes('dummy')
  );
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

function formatMinutesMini(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const remain = safe % 60;
  if (hours <= 0) return `${remain}m`;
  if (remain === 0) return `${hours}h`;
  return `${hours}h ${remain}m`;
}

function toClockLabel(totalMinutes: number): string {
  const safe = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)));
  const h = Math.floor(safe / 60).toString().padStart(2, '0');
  const m = (safe % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
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

function getTrackPaceMeta(totalMinutes: number) {
  if (totalMinutes >= 240) {
    return {
      mode: 'plane',
      eyebrow: '플라이트 페이스',
      title: '비행기처럼 높은 고도로 올라가고 있어요',
      badge: 'FLY',
      window: '4시간+ 구간',
    } as const;
  }
  if (totalMinutes >= 180) {
    return {
      mode: 'car',
      eyebrow: '드라이브 페이스',
      title: '자동차처럼 안정된 속도로 밀고 있어요',
      badge: 'DRIVE',
      window: '3~4시간 구간',
    } as const;
  }
  if (totalMinutes >= 120) {
    return {
      mode: 'bike',
      eyebrow: '라이드 페이스',
      title: '자전거처럼 리듬을 타며 전진하고 있어요',
      badge: 'RIDE',
      window: '2~3시간 구간',
    } as const;
  }
  if (totalMinutes >= 60) {
    return {
      mode: 'run',
      eyebrow: '러닝 페이스',
      title: '뛰는 흐름으로 공부가 붙고 있어요',
      badge: 'RUN',
      window: '1~2시간 구간',
    } as const;
  }
  return {
    mode: 'walk',
    eyebrow: '워밍업 트랙',
    title: '걷는 페이스로 리듬을 만들고 있어요',
    badge: 'WALK',
    window: '0~1시간 구간',
  } as const;
}

function TrackRunnerIllustration({ isMobile, totalMinutes }: { isMobile: boolean; totalMinutes: number }) {
  const pace = getTrackPaceMeta(totalMinutes);

  const vehicle = (() => {
    switch (pace.mode) {
      case 'walk':
        return (
          <g className="track-pace-vehicle track-pace-vehicle--walk" transform="translate(56 34)">
            <ellipse className="track-pace-walker-shadow" cx="30" cy="61" rx="15" ry="4.2" fill="rgba(255,236,211,0.16)" />
            <circle className="track-pace-walker-head" cx="28" cy="11" r="6.8" fill="#FFE0BC" />
            <path
              className="track-pace-walker-torso"
              d="M25 20L31 29L29 42"
              stroke="#FFF9F3"
              strokeWidth="5.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M28 18L24 24" stroke="#FFF2E2" strokeWidth="4.1" strokeLinecap="round" />
            <path className="track-pace-limb-a" d="M29 27L40 32" stroke="#FFE4C7" strokeWidth="4.7" strokeLinecap="round" />
            <path className="track-pace-limb-b" d="M28 28L17 35" stroke="#FFDAB0" strokeWidth="4.7" strokeLinecap="round" />
            <path
              className="track-pace-limb-c"
              d="M29 42L40 53L49 52"
              stroke="#FFBF77"
              strokeWidth="5.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              className="track-pace-limb-d"
              d="M29 42L21 54L14 50"
              stroke="#FFCF8C"
              strokeWidth="5.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      case 'run':
        return (
          <g className="track-pace-vehicle track-pace-vehicle--run" transform="translate(58 39)">
            <ellipse className="track-pace-runner-shadow" cx="23" cy="59" rx="15.5" ry="4.4" fill="rgba(255,236,211,0.18)" />
            <circle className="track-pace-runner-head" cx="18" cy="10" r="6.9" fill="#FFE0BC" />
            <path
              className="track-pace-runner-torso"
              d="M15 19L26 30L21 41"
              stroke="#FFF9F3"
              strokeWidth="5.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M23 27L31 22" stroke="#FFF4E8" strokeWidth="4.6" strokeLinecap="round" />
            <path
              className="track-pace-runner-arm-front"
              d="M25 29L38 23L45 29"
              stroke="#FFE2C0"
              strokeWidth="4.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              className="track-pace-runner-arm-back"
              d="M20 25L8 31"
              stroke="#FFD9AF"
              strokeWidth="4.7"
              strokeLinecap="round"
            />
            <path
              className="track-pace-runner-leg-front"
              d="M21 41L35 50L45 47"
              stroke="#FFBF77"
              strokeWidth="5.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              className="track-pace-runner-leg-back"
              d="M21 41L13 54L5 50"
              stroke="#FFCF8C"
              strokeWidth="5.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      case 'bike':
        return (
          <g className="track-pace-vehicle track-pace-vehicle--bike" transform="translate(42 34)">
            <circle className="track-pace-wheel" cx="24" cy="42" r="11.5" stroke="#E4EFFF" strokeWidth="4" fill="rgba(255,255,255,0.08)" />
            <circle className="track-pace-wheel" cx="64" cy="42" r="11.5" stroke="#E4EFFF" strokeWidth="4" fill="rgba(255,255,255,0.08)" />
            <circle cx="24" cy="42" r="2.8" fill="#FFF9F3" opacity="0.9" />
            <circle cx="64" cy="42" r="2.8" fill="#FFF9F3" opacity="0.9" />
            <path d="M24 42L41 23L54 42H40L32 31" stroke="#FFF9F3" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M54 42L64 42L70 28" stroke="#FFF9F3" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M38 21H47" stroke="#FFF9F3" strokeWidth="4" strokeLinecap="round" />
            <circle cx="47" cy="8" r="6.1" fill="#FFE0BC" />
            <path d="M45 14L53 24L44 29L37 24" stroke="#FFF9F3" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M44 16L35 23" stroke="#FFE0BC" strokeWidth="4.1" strokeLinecap="round" />
            <path d="M44 29L52 41" stroke="#FFCF8C" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M38 27L30 42" stroke="#FFCF8C" strokeWidth="4.2" strokeLinecap="round" />
            <path className="track-pace-streak" d="M-10 34H6" stroke="rgba(255,255,255,0.2)" strokeWidth="3" strokeLinecap="round" />
            <path className="track-pace-streak delay-1" d="M-4 27H10" stroke="rgba(255,255,255,0.14)" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        );
      case 'car':
        return (
          <g className="track-pace-vehicle track-pace-vehicle--car" transform="translate(54 46)">
            <path className="track-pace-streak" d="M-8 26H12" stroke="rgba(255,255,255,0.3)" strokeWidth="3.5" strokeLinecap="round" />
            <path className="track-pace-streak delay-1" d="M-14 20H2" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M14 10H42L54 20V34H8V20L14 10Z" fill="#FFF9F3" />
            <path d="M18 14H39L47 22H14L18 14Z" fill="#BFD3FF" />
            <circle cx="18" cy="35" r="6.5" fill="#233B74" />
            <circle cx="44" cy="35" r="6.5" fill="#233B74" />
            <circle cx="18" cy="35" r="3" fill="#ECF3FF" />
            <circle cx="44" cy="35" r="3" fill="#ECF3FF" />
          </g>
        );
      case 'plane':
        return (
          <g className="track-pace-vehicle track-pace-vehicle--plane" transform="translate(54 24)">
            <path className="track-pace-contrail" d="M0 38C18 40 32 38 46 30" stroke="rgba(255,255,255,0.32)" strokeWidth="3.5" strokeLinecap="round" />
            <path className="track-pace-contrail delay-1" d="M8 46C24 48 38 46 52 38" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M16 38L46 26L68 16L78 20L58 31L78 34L74 42L54 37L40 48L30 46L40 35L16 38Z" fill="#FFF9F3" />
            <path d="M49 24L57 14L66 16L60 26" fill="#FFD26C" />
          </g>
        );
      default:
        return null;
    }
  })();

  return (
    <div
      aria-hidden="true"
      className={cn(
        "track-pace-shell rounded-[1.5rem] border border-white/15 bg-white/12 backdrop-blur-md",
        isMobile ? "w-full p-3" : "min-w-[210px] p-4"
      )}
      data-pace={pace.mode}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[9px] font-black uppercase tracking-[0.28em] text-white/65">{pace.eyebrow}</p>
          <p className={cn("font-black tracking-tight text-white break-keep", isMobile ? "text-sm leading-5" : "text-base leading-6")}>{pace.title}</p>
        </div>
        <div className="track-pace-spark mt-1 h-2.5 w-2.5 rounded-full bg-[#FFD26C] shadow-[0_0_0_6px_rgba(255,210,108,0.18)]" />
      </div>
      <svg
        viewBox="0 0 220 120"
        className={cn("w-full", isMobile ? "h-[74px]" : "h-[90px]")}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="trackPaceGlow" x1="22" y1="82" x2="198" y2="54" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(255,255,255,0.2)" />
            <stop offset="0.48" stopColor="rgba(255,255,255,0.8)" />
            <stop offset="1" stopColor="rgba(255,210,108,0.9)" />
          </linearGradient>
        </defs>
        <path d="M18 88C46 88 60 86 74 80C94 72 112 54 134 52C157 50 174 63 198 63" stroke="rgba(255,255,255,0.16)" strokeWidth="12" strokeLinecap="round" />
        <path d="M18 88C46 88 60 86 74 80C94 72 112 54 134 52C157 50 174 63 198 63" stroke="rgba(255,255,255,0.28)" strokeWidth="2.6" strokeLinecap="round" className="track-pace-lane" />
        <path d="M18 88C46 88 60 86 74 80C94 72 112 54 134 52C157 50 174 63 198 63" stroke="url(#trackPaceGlow)" strokeWidth="3.4" strokeLinecap="round" className="track-pace-dash" />
        <circle cx="18" cy="88" r="5" fill="#FFF5EA" opacity="0.72" />
        <circle cx="78" cy="77" r="3.5" fill="#FFF5EA" opacity="0.45" />
        <circle cx="136" cy="52" r="3.5" fill="#FFF5EA" opacity="0.45" />
        <circle cx="198" cy="63" r="5.5" fill="#FFD26C" />
        <circle cx="198" cy="63" r="11" fill="#FFD26C" opacity="0.18" className="track-pace-node-glow" />
        {vehicle}
      </svg>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/72">{pace.window}</span>
        <span className="rounded-full border border-white/22 bg-white/12 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/88">
          {pace.badge}
        </span>
      </div>
    </div>
  );
}

function PointHistoryDialog({
  dailyPointStatus,
  isMobile,
  variant = 'compact',
}: {
  dailyPointStatus?: GrowthProgress['dailyPointStatus'],
  isMobile: boolean,
  variant?: 'compact' | 'featured',
}) {
  const isFeatured = variant === 'featured';
  const sortedDates = useMemo(() => {
    if (!dailyPointStatus) return [];
    return Object.entries(dailyPointStatus).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30);
  }, [dailyPointStatus]);

  const totalPoints = useMemo(
    () => Object.values(dailyPointStatus || {}).reduce((acc, curr) => acc + Number(curr.dailyPointAmount || 0), 0),
    [dailyPointStatus]
  );

  const pointTrendPoints = useMemo(() => {
    if (!dailyPointStatus) return [];

    const ascending = Object.entries(dailyPointStatus)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date,
        amount: Math.max(0, Number(data?.dailyPointAmount || 0)),
      }));

    let cumulative = 0;
    return ascending.map((item) => {
      cumulative += item.amount;
      return { date: item.date, total: cumulative };
    }).slice(-8);
  }, [dailyPointStatus]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className={cn(
          "student-cta student-cta-card group relative h-full min-w-0 overflow-hidden border transition-all duration-300 cursor-pointer",
          isFeatured
            ? "border-amber-200/80 bg-[radial-gradient(circle_at_top_right,#ffe7a8_0%,#fffdf5_40%,#fff8e1_100%)] shadow-[0_26px_70px_-42px_rgba(245,158,11,0.6)] ring-1 ring-amber-100/80"
            : "border-slate-200/80 bg-white",
          isMobile
            ? isFeatured
              ? "rounded-[1.5rem] shadow-[0_24px_54px_-38px_rgba(245,158,11,0.62)]"
              : "rounded-[1.4rem] bg-[radial-gradient(circle_at_top_right,#fde68a_0%,#ffffff_58%,#fffbeb_100%)] shadow-[0_18px_40px_-28px_rgba(245,158,11,0.5)]"
            : isFeatured
              ? "rounded-[2.5rem]"
              : "rounded-[1.75rem]"
        )}>
          <div
            className={cn(
              "pointer-events-none absolute rounded-full bg-amber-200/60 blur-2xl",
              isFeatured
                ? isMobile
                  ? "-right-6 -top-8 h-24 w-24"
                  : "-right-10 -top-10 h-36 w-36"
                : isMobile
                  ? "-right-6 -top-8 h-20 w-20"
                  : "-right-8 -top-8 h-24 w-24"
            )}
          />
          {isFeatured && (
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0)_42%)]" />
          )}
          <CardHeader className={cn(
            "flex flex-row items-center justify-between pb-2",
            isFeatured
              ? isMobile
                ? "px-5 pt-5"
                : "px-8 pt-8"
              : isMobile
                ? "px-5 pt-5"
                : "px-8 pt-8"
          )}>
            <CardTitle className={cn("font-aggro-display font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap", isMobile ? "text-[9px]" : "text-[10px]")}>포인트 지갑</CardTitle>
            <div className={cn(
              "rounded-xl text-amber-600",
              isFeatured ? "bg-white/80 shadow-[0_14px_32px_-24px_rgba(245,158,11,0.8)]" : "bg-amber-50",
              isMobile ? "p-2" : "p-2.5"
            )}>
              <Zap className={cn("text-amber-600", isMobile ? "h-4 w-4" : "h-6 w-6")} />
            </div>
          </CardHeader>
          <CardContent className={cn(
            "relative z-10",
            isFeatured
              ? isMobile
                ? "px-5 pb-5 pt-1"
                : "px-8 pb-8 pt-1"
              : isMobile
                ? "px-5 pb-5"
                : "px-10 pb-10"
          )}>
            <div className={cn(
              "grid items-end gap-3",
              isFeatured
                ? isMobile
                  ? "grid-cols-[minmax(0,1fr)_7.6rem]"
                  : "grid-cols-[minmax(0,1fr)_10rem] gap-5"
                : isMobile
                  ? "grid-cols-[minmax(0,1fr)_6.8rem]"
                  : "grid-cols-[minmax(0,1fr)_8.4rem] gap-4"
            )}>
              <div className="min-w-0">
                <div className={cn(
                  "dashboard-number text-amber-600 leading-none tracking-tight",
                  isFeatured
                    ? isMobile
                      ? "text-[clamp(2.35rem,12vw,3rem)]"
                      : "text-[clamp(3.2rem,5vw,4.8rem)]"
                    : isMobile
                      ? "text-[clamp(2rem,10vw,2.7rem)]"
                      : "text-6xl sm:text-7xl"
                )}>
                  {totalPoints.toLocaleString()}<span className={cn("opacity-40 font-bold uppercase", isMobile ? "text-sm ml-1" : "text-xl ml-1.5")}>포인트</span>
                </div>
                <div className={cn("flex items-center gap-2", isMobile ? "mt-3 flex-wrap" : isFeatured ? "mt-5" : "mt-6")}>
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-aggro-display border border-[#FF7A16] bg-[#FF7A16] text-white font-extrabold leading-none",
                      isMobile ? "h-7 px-2.5 text-[11px]" : isFeatured ? "h-9 px-4 text-[12px]" : "h-8 px-3.5 text-[12px]"
                    )}
                  >
                    획득 내역 <ChevronRight className={cn("ml-1", isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} />
                  </Badge>
                </div>
              </div>

              <div className="self-stretch flex items-end justify-end">
                <MiniLpTrendSparkline data={pointTrendPoints} isMobile={isMobile} />
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className={cn("rounded-[3rem] border border-slate-200 p-0 overflow-hidden sm:max-w-md", isMobile ? "w-[min(94vw,26rem)] max-h-[86svh] rounded-[2rem]" : "")}>
        <div className={cn("bg-accent text-white relative", isMobile ? "p-6" : "p-10")}>
          <Sparkles className="pointer-events-none absolute top-0 right-0 p-8 h-32 w-32 opacity-20" />
          <DialogHeader>
            <DialogTitle className={cn("font-black tracking-tighter break-keep", isMobile ? "text-xl" : "text-3xl")}>포인트 획득 기록</DialogTitle>
            <DialogDescription className="text-white/70 font-bold mt-1 text-xs">최근 30일간의 러닝 포인트 내역입니다.</DialogDescription>
          </DialogHeader>
        </div>
        <div className={cn("p-6 max-h-[50vh] overflow-y-auto custom-scrollbar bg-[#f5f5f5]", isMobile ? "max-h-[calc(86svh-10.5rem)] p-4" : "")}>
          {sortedDates.length === 0 ? (<div className="py-20 text-center opacity-20 italic font-black text-sm">기록된 포인트가 없습니다.</div>) : (
            <div className="space-y-2">
              {sortedDates.map(([date, data]) => {
                const studyBoxes = Array.isArray(data.claimedStudyBoxes) ? data.claimedStudyBoxes.length : 0;

                return (
                  <div key={date} className="bg-white p-4 rounded-xl border border-primary/10 flex items-center justify-between">
                    <div className="grid gap-0.5">
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{date}</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {data.attendance && <Badge variant="outline" className="bg-blue-500 text-white border-none font-black text-[8px] px-1.5 py-0.5">출석</Badge>}
                        {data.plan && <Badge variant="outline" className="bg-emerald-500 text-white border-none font-black text-[8px] px-1.5 py-0.5">계획</Badge>}
                        {data.routine && <Badge variant="outline" className="bg-amber-500 text-white border-none font-black text-[8px] px-1.5 py-0.5">루틴</Badge>}
                        {studyBoxes > 0 && <Badge variant="outline" className="bg-[#14295F] text-white border-none font-black text-[8px] px-1.5 py-0.5">상자 {studyBoxes}</Badge>}
                        {data.dailyTopRewardAmount ? <Badge variant="outline" className="bg-violet-600 text-white border-none font-black text-[8px] px-1.5 py-0.5">일간 1위</Badge> : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="dashboard-number text-sm text-primary">{Number(data.dailyPointAmount || 0).toLocaleString()}</span>
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

function MiniLpTrendSparkline({
  data,
  isMobile,
}: {
  data: Array<{ date: string; total: number }>;
  isMobile: boolean;
}) {
  const width = isMobile ? 108 : 132;
  const height = isMobile ? 72 : 82;
  const chartHeight = isMobile ? 38 : 44;
  const paddingX = 5;
  const paddingY = 5;
  const gradientId = isMobile ? 'season-lp-fill-mobile' : 'season-lp-fill-desktop';

  const normalizedData = data.length > 1
    ? data
    : data.length === 1
      ? [data[0], data[0]]
      : [
          { date: 'start', total: 0 },
          { date: 'end', total: 0 },
        ];

  const values = normalizedData.map((item) => item.total);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(1, maxValue - minValue);

  const getX = (index: number) => {
    if (normalizedData.length <= 1) return width / 2;
    return paddingX + (index / (normalizedData.length - 1)) * (width - paddingX * 2);
  };

  const getY = (value: number) => {
    const usableHeight = chartHeight - paddingY * 2;
    return chartHeight - paddingY - ((value - minValue) / range) * usableHeight;
  };

  const linePath = normalizedData
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(point.total)}`)
    .join(' ');
  const areaPath = `${linePath} L ${getX(normalizedData.length - 1)} ${chartHeight} L ${getX(0)} ${chartHeight} Z`;
  const lastPoint = normalizedData[normalizedData.length - 1];
  const lastPointX = getX(normalizedData.length - 1);
  const lastPointY = getY(lastPoint.total);

  return (
    <div className={cn(
      "pointer-events-none w-full rounded-[1.2rem] border border-amber-100/80 bg-white/85 px-2.5 py-2 shadow-[0_16px_36px_-30px_rgba(245,158,11,0.55)]",
      isMobile ? "min-h-[4.6rem]" : "min-h-[5.2rem]"
    )}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[8px] font-black uppercase tracking-[0.24em] text-amber-600/60">누적</span>
        <span className="text-[9px] font-black text-amber-600">{lastPoint.total.toLocaleString()}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={cn("mt-1 w-full", isMobile ? "h-[3rem]" : "h-[3.4rem]")}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FDBA74" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#FDBA74" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke="#F59E0B" strokeWidth={isMobile ? 2.6 : 2.8} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastPointX} cy={lastPointY} r={isMobile ? 3.2 : 3.6} fill="#F59E0B" />
        <circle cx={lastPointX} cy={lastPointY} r={isMobile ? 1.4 : 1.6} fill="#FFF7ED" />
      </svg>
    </div>
  );
}

function MiniBestStudySparkline({
  data,
  isMobile,
  modeLabel,
  peakMinutes,
}: {
  data: Array<{ date: string; minutes: number }>;
  isMobile: boolean;
  modeLabel: string;
  peakMinutes: number;
}) {
  const width = isMobile ? 104 : 124;
  const height = isMobile ? 66 : 76;
  const chartHeight = isMobile ? 36 : 42;
  const paddingX = 5;
  const paddingY = 5;
  const gradientId = isMobile ? 'best-study-fill-mobile' : 'best-study-fill-desktop';

  const normalizedData = data.length > 1
    ? data
    : data.length === 1
      ? [data[0], data[0]]
      : [
          { date: 'start', minutes: 0 },
          { date: 'end', minutes: 0 },
        ];

  const values = normalizedData.map((item) => item.minutes);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(1, maxValue - minValue);

  const getX = (index: number) => {
    if (normalizedData.length <= 1) return width / 2;
    return paddingX + (index / (normalizedData.length - 1)) * (width - paddingX * 2);
  };

  const getY = (value: number) => {
    const usableHeight = chartHeight - paddingY * 2;
    return chartHeight - paddingY - ((value - minValue) / range) * usableHeight;
  };

  const linePath = normalizedData
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(point.minutes)}`)
    .join(' ');
  const areaPath = `${linePath} L ${getX(normalizedData.length - 1)} ${chartHeight} L ${getX(0)} ${chartHeight} Z`;
  const peakIndex = normalizedData.reduce((bestIndex, point, index, arr) => (
    point.minutes >= arr[bestIndex].minutes ? index : bestIndex
  ), 0);
  const peakPoint = normalizedData[peakIndex];
  const peakPointX = getX(peakIndex);
  const peakPointY = getY(peakPoint.minutes);

  return (
    <div className={cn(
      "pointer-events-none w-full rounded-[1.1rem] border border-sky-100/90 bg-[linear-gradient(180deg,rgba(248,252,255,0.96)_0%,rgba(255,255,255,0.9)_100%)] px-2.5 py-2 shadow-[0_16px_36px_-30px_rgba(14,165,233,0.5)]",
      isMobile ? "min-h-[4.35rem]" : "min-h-[4.9rem]"
    )}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[8px] font-black uppercase tracking-[0.24em] text-sky-600/60">{modeLabel}</span>
        <span className="text-[9px] font-black text-sky-700">{formatMinutesMini(peakMinutes)}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={cn("mt-1 w-full", isMobile ? "h-[2.8rem]" : "h-[3.15rem]")}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke="#0EA5E9" strokeWidth={isMobile ? 2.4 : 2.6} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={peakPointX} cy={peakPointY} r={isMobile ? 3.1 : 3.5} fill="#0EA5E9" />
        <circle cx={peakPointX} cy={peakPointY} r={isMobile ? 1.35 : 1.6} fill="#EFF6FF" />
      </svg>
    </div>
  );
}

function StudySessionHistoryDialog({
  studentId,
  centerId,
  todayKey,
  h,
  m,
  isMobile,
  triggerMode = 'card',
}: {
  studentId: string;
  centerId: string;
  todayKey: string;
  h: number;
  m: number;
  isMobile: boolean;
  triggerMode?: 'card' | 'button';
}) {
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
        {triggerMode === 'button' ? (
          <button
            type="button"
            className={cn(
              "student-cta inline-flex items-center justify-center gap-2 rounded-full border border-white/18 bg-white/12 font-black text-white backdrop-blur-sm",
              isMobile ? "h-9 px-3 text-[11px] shadow-[0_14px_30px_-22px_rgba(15,23,42,0.5)]" : "h-10 px-4 text-xs"
            )}
          >
            <Clock className={cn(isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} />
            세션 확인
          </button>
        ) : (
          <Card className={cn(
            "student-cta student-cta-card group relative h-full min-w-0 overflow-hidden border border-slate-200/80 bg-white transition-all duration-300 cursor-pointer",
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
            <CardContent className={cn("relative z-10 px-10 pb-10", isMobile ? "px-5 pb-5" : "")}>
              <div className={cn("dashboard-number text-blue-600 leading-none", isMobile ? "text-[clamp(2rem,10vw,2.7rem)]" : "text-6xl sm:text-7xl")}>
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
        )}
      </DialogTrigger>
      <DialogContent className={cn("rounded-[3rem] border border-slate-200 p-0 overflow-hidden sm:max-w-md", isMobile ? "w-[min(94vw,26rem)] max-h-[86svh] rounded-[2rem]" : "")}>
        <div className={cn("bg-blue-600 text-white relative", isMobile ? "p-6" : "p-10")}>
          <Activity className="pointer-events-none absolute top-0 right-0 p-8 h-32 w-32 opacity-20" />
          <DialogHeader>
            <DialogTitle className={cn("font-black tracking-tighter", isMobile ? "text-xl" : "text-3xl")}>몰입 히스토리</DialogTitle>
            <DialogDescription className="text-white/70 font-bold mt-1 text-xs">오늘 완료된 몰입 세션입니다.</DialogDescription>
          </DialogHeader>
        </div>
        <div className={cn("p-6 max-h-[50vh] overflow-y-auto custom-scrollbar bg-[#f5f5f5]", isMobile ? "max-h-[calc(86svh-10.5rem)] p-4" : "")}>
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
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">기록됨</span>
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

export function StudentDashboard({ isActive }: { isActive: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { activeMembership, isTimerActive, setIsTimerActive, startTime, setStartTime, viewMode } = useAppContext();
  const rewardTheme = NAVY_REWARD_THEME;
  
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
  const [fortuneMessage, setFortuneMessage] = useState<string | null>(null);
  const [isFortuneDialogOpen, setIsFortuneDialogOpen] = useState(false);
  const [claimedStudyBoxRewards, setClaimedStudyBoxRewards] = useState<StudyBoxReward[]>([]);
  const [isStudyBoxDialogOpen, setIsStudyBoxDialogOpen] = useState(false);
  const studyBoxClaimKeyRef = useRef<string | null>(null);

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

  const logMinutesByDateKey = useMemo(() => {
    const map = new Map<string, number>();
    (recentLogs || []).forEach((log) => {
      map.set(log.dateKey, Math.max(0, Math.round(log.totalMinutes || 0)));
    });
    return map;
  }, [recentLogs]);

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
    return doc(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_study-time`, 'entries', user.uid);
  }, [firestore, activeMembership?.id, periodKey, user?.uid]);
  const { data: leaderboardEntry } = useDoc<LeaderboardEntry>(leaderboardEntryRef, { enabled: isActive });

  const totalEntriesQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !periodKey) return null;
    return collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_study-time`, 'entries');
  }, [firestore, activeMembership?.id, periodKey]);
  const { data: totalRankEntries } = useCollection<LeaderboardEntry>(totalEntriesQuery, { enabled: isActive });

  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'members'),
      where('role', '==', 'student'),
      where('status', '==', 'active')
    );
  }, [firestore, activeMembership?.id]);
  const { data: activeStudentMembers, isLoading: activeMembersLoading } = useCollection<CenterMembership>(membersQuery, { enabled: isActive });

  const attendanceCurrentQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return collection(firestore, 'centers', activeMembership.id, 'attendanceCurrent');
  }, [firestore, activeMembership?.id]);
  const { data: attendanceCurrent, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceCurrentQuery, { enabled: isActive });

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

  const penaltyPoints = progress?.penaltyPoints || 0;
  const boxRewardBoostPercent = Math.round(
    (((stats.focus / 100) * 0.05) + ((stats.consistency / 100) * 0.05) + ((stats.achievement / 100) * 0.05) + ((stats.resilience / 100) * 0.05)) * 100
  );

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
        const existingSessionDayStatus = (progress?.dailyPointStatus?.[sessionDateKey] || {}) as Record<string, any>;
        const dailyStatusUpdate: Record<string, any> = { ...existingSessionDayStatus };
        const statsUpdate: Record<string, any> = {};
        let earnedPointsThisSession = 0;
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

          statsUpdate.focus = increment((sessionMinutes / 60) * 0.1);

          const totalMinutesAfterSession = existingSessionDayMinutes + sessionMinutes;

          if (totalMinutesAfterSession >= 180 && !progress?.dailyPointStatus?.[sessionDateKey]?.attendance) {
            earnedPointsThisSession += 20;
            dailyStatusUpdate.attendance = true;
            toast({ title: '3시간 달성! 출석 포인트가 반영됐어요.' });
          }

          if (totalMinutesAfterSession >= 360 && !progress?.dailyPointStatus?.[sessionDateKey]?.bonus6h) {
            statsUpdate.resilience = increment(0.5);
            dailyStatusUpdate.bonus6h = true;
            earnedPointsThisSession += 15;
            toast({ title: '6시간 몰입 달성! 회복력과 보너스 포인트가 반영됐어요.' });
          }

          if (earnedPointsThisSession > 0) {
            progressUpdate.pointsBalance = increment(earnedPointsThisSession);
            progressUpdate.totalPointsEarned = increment(earnedPointsThisSession);
            dailyStatusUpdate.dailyPointAmount = Number(existingSessionDayStatus.dailyPointAmount || 0) + earnedPointsThisSession;
          }

          if (Object.keys(statsUpdate).length > 0) {
            progressUpdate.stats = statsUpdate;
          }
          if (Object.keys(dailyStatusUpdate).length > 0) {
            progressUpdate.dailyPointStatus = {
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

          const studyTimeRankRef = doc(firestore, 'centers', centerId, 'leaderboards', `${periodKey}_study-time`, 'entries', user.uid);
          batch.set(studyTimeRankRef, {
            studentId: user.uid,
            displayNameSnapshot: user.displayName || '학생',
            classNameSnapshot: activeMembership.className || null,
            schoolNameSnapshot: studentProfile?.schoolName || null,
            value: increment(sessionMinutes),
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
              await setDoc(doc(firestore, 'centers', centerId, 'leaderboards', `${periodKey}_study-time`, 'entries', user.uid), {
                studentId: user.uid,
                displayNameSnapshot: user.displayName || '학생',
                classNameSnapshot: activeMembership.className || null,
                schoolNameSnapshot: studentProfile?.schoolName || null,
                value: increment(sessionMinutes),
                updatedAt: serverTimestamp(),
              }, { merge: true });
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
          toast({ title: '집중 종료됨', description: `이번 세션 ${_fmtMin(sessionMinutes)} · 오늘 총 ${_fmtMin(_newTotalMin)} · 상자를 확인해 보세요.` });
        }
      } else {
        const nowTs = Date.now();
        const batch = writeBatch(firestore);
        const todayPointStatus = (progress?.dailyPointStatus?.[todayKey] || {}) as Record<string, any>;
        const isFirstCheckInToday = !todayPointStatus.checkedIn;
        const shouldShowFortune = !todayPointStatus.fortuneShown;
        const checkInProgressUpdate: Record<string, any> = {
          updatedAt: serverTimestamp(),
          dailyPointStatus: {
            [todayKey]: {
              ...todayPointStatus,
              checkedIn: true,
              fortuneShown: shouldShowFortune ? true : todayPointStatus.fortuneShown,
              fortuneMessage: shouldShowFortune ? getDailyFortuneMessage(user.uid, todayKey) : todayPointStatus.fortuneMessage,
            },
          },
        };
        let wroteSomething = false;

        if (isFirstCheckInToday) {
          checkInProgressUpdate.stats = { consistency: increment(0.5) };
          batch.set(progressRef, checkInProgressUpdate, { merge: true });
          if (shouldShowDailyCheckInToast(centerId, user.uid, todayKey)) {
            toast({ title: '\uC785\uC2E4 \uD655\uC778! \uAFB8\uC900\uD568 \uC2A4\uD0EF +0.5 \uC0C1\uC2B9' });
          }
          wroteSomething = true;
        } else if (shouldShowFortune) {
          batch.set(progressRef, checkInProgressUpdate, { merge: true });
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
            if (isFirstCheckInToday || shouldShowFortune) {
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
        if (shouldShowFortune) {
          setFortuneMessage(getDailyFortuneMessage(user.uid, todayKey));
          setIsFortuneDialogOpen(true);
        }
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
    isProcessingAction,
    stats,
    studentProfile?.schoolName,
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
  const personalBestMinutes = weeklyBestMinutes || monthlyBestMinutes;
  const personalBestTrend = useMemo(() => {
    const hasWeeklyFlow = studyTimeTrend.some((item) => item.minutes > 0);
    if (hasWeeklyFlow) {
      return {
        modeLabel: '7일 흐름',
        data: studyTimeTrend,
      };
    }

    const recentLoggedDays = [...(recentLogs || [])]
      .slice(0, 7)
      .reverse()
      .map((item) => ({
        date: item.dateKey?.slice(5).replace('-', '/') || '',
        minutes: Math.max(0, Number(item.totalMinutes || 0)),
      }));

    return {
      modeLabel: recentLoggedDays.length > 0 ? '최근 로그' : '7일 흐름',
      data: recentLoggedDays,
    };
  }, [studyTimeTrend, recentLogs]);
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
      return progress?.dailyPointStatus?.[dateKey]?.plan ? 1 : 0;
    }).reduce<number>((sum, count) => sum + count, 0);
  }, [today, progress?.dailyPointStatus]);
  const todayRemainingTasks = useMemo(
    () => todayStudyTasks.filter((item) => !item.done),
    [todayStudyTasks]
  );
  const todayMissionList = useMemo(
    () => todayRemainingTasks.slice(0, 3),
    [todayRemainingTasks]
  );
  const todayRemainingStudyMinutesToNextBox = useMemo(() => {
    const totalTodayMinutes = Number(todayStudyLog?.totalMinutes || 0);
    const nextMilestoneMinutes = (Math.floor(totalTodayMinutes / 60) + 1) * 60;
    return Math.max(0, nextMilestoneMinutes - totalTodayMinutes);
  }, [todayStudyLog?.totalMinutes]);

  const activeStudentIds = useMemo(() => {
    if (!activeStudentMembers) return null;
    return new Set(
      activeStudentMembers
        .filter((member) => isActiveStudentStatus(member.status))
        .map((member) => member.id)
    );
  }, [activeStudentMembers]);

  const assignedStudentIds = useMemo(() => {
    if (!attendanceCurrent) return null;
    return new Set(
      attendanceCurrent
        .map((seat) => (typeof seat.studentId === 'string' ? seat.studentId.trim() : ''))
        .filter((studentId) => studentId.length > 0 && !isSyntheticStudentId(studentId))
    );
  }, [attendanceCurrent]);

  const validRankEntries = useMemo(() => {
    if (!totalRankEntries) return [];
    let filtered = totalRankEntries.filter((entry) => !isSyntheticStudentId(entry.studentId));

    if (assignedStudentIds && assignedStudentIds.size > 0) {
      filtered = filtered.filter((entry) => assignedStudentIds.has(entry.studentId));
    }
    if (activeStudentIds && activeStudentIds.size > 0) {
      filtered = filtered.filter((entry) => activeStudentIds.has(entry.studentId));
    }

    return filtered;
  }, [totalRankEntries, assignedStudentIds, activeStudentIds]);

  const studyRankParticipantCount = validRankEntries.length;
  const isRankContextLoading = activeMembersLoading || attendanceLoading;

  const monthlyStudyRank = useMemo(() => {
    const snapshotRank = leaderboardEntry?.rank || 0;
    if (!user || validRankEntries.length === 0) return snapshotRank;

    const sorted = [...validRankEntries].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
    const ownIndex = sorted.findIndex((entry) => entry.studentId === user.uid);
    if (ownIndex >= 0) return ownIndex + 1;

    const snapshotValue = Number(leaderboardEntry?.value);
    if (!Number.isFinite(snapshotValue)) return snapshotRank;

    const higherCount = sorted.filter((entry) => (Number(entry.value) || 0) > snapshotValue).length;
    return Math.min(sorted.length, higherCount + 1);
  }, [leaderboardEntry?.rank, leaderboardEntry?.value, validRankEntries, user?.uid]);

  const monthlyStudyPercentile = useMemo(() => {
    if (isRankContextLoading) return null;
    if (!monthlyStudyRank || studyRankParticipantCount <= 0) return null;
    const safeRank = Math.min(monthlyStudyRank, studyRankParticipantCount);
    return Math.max(1, Math.ceil((safeRank / studyRankParticipantCount) * 100));
  }, [isRankContextLoading, monthlyStudyRank, studyRankParticipantCount]);
  const latestAnnouncement = useMemo(() => {
    return (centerAnnouncements || []).find((item) => {
      const normalizedStatus = item?.status?.trim?.().toLowerCase?.();
      const isPublished = normalizedStatus
        ? normalizedStatus === 'published'
        : typeof item?.isPublished === 'boolean'
          ? item.isPublished
          : true;
      const audience = item?.audience || 'student';
      return isPublished && (audience === 'student' || audience === 'all' || !item?.audience);
    }) || null;
  }, [centerAnnouncements]);
  useEffect(() => {
    if (!isActive || isTimerActive || !progressRef || !todayKey || !todayStudyLog) return;

    const totalTodayMinutes = Number(todayStudyLog.totalMinutes || 0);
    if (totalTodayMinutes < 60) return;

    const dayStatus = (progress?.dailyPointStatus?.[todayKey] || {}) as Record<string, any>;
    const claimedStudyBoxes = getClaimedStudyBoxes(dayStatus);
    const availableMilestones = getAvailableStudyBoxMilestones(totalTodayMinutes, claimedStudyBoxes);
    if (availableMilestones.length === 0) return;

    const claimKey = `${todayKey}:${availableMilestones.join(',')}:${totalTodayMinutes}`;
    if (studyBoxClaimKeyRef.current === claimKey) return;
    studyBoxClaimKeyRef.current = claimKey;

    const rewards = availableMilestones.map((milestone) => rollStudyBoxReward(milestone, stats));
    const awardedPoints = rewards.reduce((sum, reward) => sum + reward.awardedPoints, 0);
    const nextClaimedStudyBoxes = [...claimedStudyBoxes, ...availableMilestones];
    const nextDayStatus = {
      ...dayStatus,
      claimedStudyBoxes: nextClaimedStudyBoxes,
      dailyPointAmount: Number(dayStatus.dailyPointAmount || 0) + awardedPoints,
    };

    void setDoc(progressRef, {
      pointsBalance: increment(awardedPoints),
      totalPointsEarned: increment(awardedPoints),
      dailyPointStatus: {
        [todayKey]: nextDayStatus,
      },
      updatedAt: serverTimestamp(),
    }, { merge: true }).then(() => {
      setClaimedStudyBoxRewards(rewards);
      setIsStudyBoxDialogOpen(true);
    }).catch((error: any) => {
      studyBoxClaimKeyRef.current = null;
      console.warn('[student-track] study box claim skipped', error?.message || error);
    });
  }, [isActive, isTimerActive, progressRef, todayKey, todayStudyLog, progress?.dailyPointStatus, stats]);
  const coachSummary = latestCoachReport?.aiMeta?.teacherOneLiner?.trim()
    || latestCoachReport?.nextAction?.trim()
    || summarizeReportLine(latestCoachReport?.content);
  return (
    <div
      className={cn(
        "flex flex-col relative z-10",
        isMobile ? "gap-3 pb-[calc(env(safe-area-inset-bottom)+8.5rem)]" : "gap-6"
      )}
    >
      <section className={cn(
        "student-hero-enter relative overflow-hidden text-white border transition-colors duration-200",
        isMobile ? "rounded-[1.5rem] p-5" : "rounded-[2.5rem] p-10"
      )}
      style={{
        borderColor: '#223B7A',
        backgroundImage: 'linear-gradient(135deg,#14295F 0%,#1B326D 55%,#233E86 100%)',
      }}>
        <div className="pointer-events-none absolute top-0 right-0 p-8 sm:p-12 opacity-[0.08] rotate-12">
          <Sparkles className={cn(isMobile ? "h-20 w-20" : "h-64 w-64")} />
        </div>
        <div className={cn("relative z-10 flex flex-col", isMobile ? "items-center text-center gap-3" : "gap-5")}>
          {/* Row 1: Tier badge + dynamic message */}
          <div className={cn("flex items-center gap-2 flex-wrap", isMobile ? "justify-center" : "")}>
            <Badge
              variant="outline"
              className={cn("text-white border font-black tracking-[0.14em] uppercase px-2.5 py-1 shrink-0", isMobile ? "text-[8px]" : "text-[10px]")}
              style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.2)' }}
            >
              포인트 지갑
            </Badge>
            <span className={cn("font-black text-white/80", isMobile ? "text-xs" : "text-sm")}>{heroMessage}</span>
          </div>

          {/* Row 2: Today study time (large) + yesterday delta */}
          <div className={cn("w-full", isMobile ? "" : "max-w-[34rem]")}>
            <div className={cn("flex gap-3", isMobile ? "items-start justify-between" : "items-end justify-between")}>
              <div className={cn("min-w-0", isMobile ? "text-left" : "")}>
                <div className={cn("dashboard-number text-white tabular-nums leading-none", isMobile ? "text-5xl" : "text-7xl")}>
                  {hDisplay}<span className={cn("opacity-50 font-bold ml-1", isMobile ? "text-base" : "text-xl")}>h</span>
                  {' '}{mDisplay}<span className={cn("opacity-50 font-bold ml-1", isMobile ? "text-base" : "text-xl")}>m</span>
                </div>
                <div className={cn("flex items-center gap-2 mt-1.5", isMobile ? "flex-wrap" : "")}>
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
              <div className={cn("shrink-0", isMobile ? "pt-1" : "pb-1")}>
                <StudySessionHistoryDialog
                  studentId={user!.uid}
                  centerId={activeMembership!.id}
                  todayKey={todayKey}
                  h={hDisplay}
                  m={mDisplay}
                  isMobile={isMobile}
                  triggerMode="button"
                />
              </div>
            </div>
          </div>

          {/* Row 3: Timer (when active) + Start/Stop button */}
          <div className={cn("flex items-center gap-3", isMobile ? "flex-col w-full" : "flex-row")}>
            {isTimerActive && (
              <div
                className={cn("flex items-center gap-2 rounded-2xl border px-4 py-2", isMobile ? "w-full justify-center" : "")}
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.12)' }}
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
                "student-cta rounded-2xl font-aggro-display font-black border flex items-center justify-center gap-2.5 text-center leading-none disabled:opacity-50 disabled:cursor-not-allowed",
                isMobile ? "min-h-[3.85rem] w-full px-6 text-[1.15rem]" : "h-16 px-12 text-2xl",
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
          {isTimerActive && (
            <div className={cn("mt-3", isMobile ? "w-full" : "mx-auto w-full max-w-[18rem]")}>
              <TrackRunnerIllustration isMobile={isMobile} totalMinutes={totalMinutesCount} />
            </div>
          )}
        </div>
      </section>

      <section className={cn("grid gap-3 [&>*]:min-w-0", isMobile ? "grid-cols-2" : "grid-cols-12")}>
        <div className={cn(isMobile ? "col-span-2" : "col-span-7")}>
          <PointHistoryDialog
            dailyPointStatus={progress?.dailyPointStatus}
            isMobile={isMobile}
            variant="featured"
          />
        </div>

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
              <div className={cn("mt-3 gap-3", isMobile ? "flex flex-col" : "flex items-end justify-between")}>
                <div className="min-w-0 flex-1">
                  <p className={cn("font-black tracking-tight text-slate-900 whitespace-normal break-keep", isMobile ? "text-xl leading-7" : "text-2xl leading-8")}>
                    {formatMinutesToKorean(personalBestMinutes)}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    {weeklyBestMinutes > 0 ? '최근 7일 최고 몰입' : monthlyBestMinutes > 0 ? '이번 달 최근 기록 기준' : '이번 달 최고 기록 준비 중'}
                  </p>
                </div>
                <div className={cn("shrink-0", isMobile ? "w-full max-w-[6.2rem] self-end" : "w-[7rem]")}>
                  <MiniBestStudySparkline
                    data={personalBestTrend.data}
                    isMobile={isMobile}
                    modeLabel={personalBestTrend.modeLabel}
                    peakMinutes={personalBestMinutes}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Link href="/dashboard/leaderboards" className="block touch-manipulation">
            <Card className="h-full border-none bg-white shadow-lg ring-1 ring-black/[0.04] rounded-[1.5rem] transition-transform duration-200 hover:-translate-y-0.5">
              <CardContent className={cn("p-4", !isMobile && "p-5")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                      <Trophy className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">시즌 구간</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </div>
                <div className="mt-3 min-w-0">
                  <p className={cn("font-black tracking-tight text-slate-900 break-keep", isMobile ? "text-xl leading-7" : "text-2xl leading-8")}>
                    {monthlyStudyPercentile ? `상위 ${monthlyStudyPercentile}%` : '집계 준비중'}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500 break-keep">
                    {monthlyStudyRank > 0 ? `${formatStudyMinutes(Math.max(0, Number(leaderboardEntry?.value || 0)))} 누적` : '이번 달 공부시간이 모이면 순위가 보여요'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700 ring-1 ring-amber-100">
                      현재 {monthlyStudyRank > 0 ? `${monthlyStudyRank}위` : '집계중'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
                      월간 공부시간
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {latestUnreadReport ? (
            <Link href="/dashboard/student-reports" className="block touch-manipulation">
              <Card className="h-full border-none bg-white shadow-lg ring-1 ring-black/[0.04] rounded-[1.5rem] transition-transform duration-200 hover:-translate-y-0.5">
                <CardContent className={cn("p-4", !isMobile && "p-5")}>
                  <div className={cn("flex justify-between gap-2", isMobile ? "flex-col items-start" : "items-center")}>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/10">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <span className="min-w-0 text-[10px] font-black uppercase tracking-widest text-primary break-keep">놓치면 아쉬운 것</span>
                    </div>
                    <Badge className="h-5 shrink-0 border-none bg-[#FF7A16] px-2 text-[9px] font-black text-white">리포트</Badge>
                  </div>
                  <div className="mt-3 min-w-0">
                    <p className="text-sm font-black leading-6 text-slate-900 break-keep line-clamp-2">{latestUnreadReport.dateKey} 코칭 도착</p>
                    <div className="mt-2 rounded-[1rem] bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-primary ring-1 ring-slate-200">
                          코칭 한마디
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
                          미확인
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-600 line-clamp-3 break-keep">{coachSummary}</p>
                    </div>
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

      <div className={cn("grid gap-2.5 [&>*]:min-w-0", isMobile ? "grid-cols-2 auto-rows-fr" : "grid-cols-2")}>
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
                "student-cta student-cta-card relative h-full min-w-0 border overflow-hidden cursor-pointer transition-all duration-300",
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
                    +{boxRewardBoostPercent}%
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
          <DialogContent className={cn("rounded-[3rem] border border-slate-200 p-0 overflow-hidden sm:max-w-2xl flex flex-col", isMobile ? "w-[min(94vw,28rem)] max-h-[88svh] rounded-[2rem]" : "max-h-[90vh]")}>
            <div className={cn("bg-rose-600 text-white relative shrink-0", isMobile ? "p-6" : "p-10")}>
          <ShieldAlert className="pointer-events-none absolute top-0 right-0 p-8 h-32 w-32 opacity-20 rotate-12" />
              <DialogHeader>
                <DialogTitle className={cn("font-black tracking-tighter break-keep", isMobile ? "text-[1.85rem]" : "text-4xl")}>벌점 및 규정 가이드</DialogTitle>
                <DialogDescription className="text-white/70 font-bold mt-1 text-sm">벌점은 쌓이지 않게, 성장은 끊기지 않게 관리하세요.</DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar">
              <div className={cn("p-10 text-center space-y-6", isMobile ? "max-h-[calc(88svh-10.5rem)] p-5" : "")}>
                <div className="inline-flex flex-col items-center gap-1">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">벌점 점수</span>
                  <h3 className={cn("dashboard-number leading-none", isMobile ? "text-[clamp(2.75rem,18vw,4.25rem)]" : "text-8xl", penaltyPoints < 10 ? "text-emerald-500" : "text-rose-600")}>{penaltyPoints}</h3>
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
                      <div className="flex items-center justify-between"><span>0~4점</span><span>경고 없이 유지</span></div>
                      <div className="flex items-center justify-between"><span>5~9점</span><span>학습 흐름 점검 권장</span></div>
                      <div className="flex items-center justify-between"><span>10~19점</span><span>루틴 재정비 필요</span></div>
                      <div className="flex items-center justify-between"><span>20~29점</span><span>출석/루틴 관리 강화</span></div>
                      <div className="flex items-center justify-between"><span>30점 이상</span><span>센터 상담 권장</span></div>
                    </div>
                    <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">
                      현재 {penaltyPoints}점 · 포인트는 상자와 완료 보상 중심으로 집계돼요.
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
                  "student-cta student-cta-card h-full bg-white transition-colors duration-200 flex flex-row items-center gap-4",
                  "rounded-2xl p-4",
                  unreadReportCount > 0 ? "border-[#FF7A16] ring-1 ring-[#FF7A16]/30" : "border border-slate-200/80"
                )}>
                  <div className="rounded-2xl bg-primary/5 flex items-center justify-center shrink-0 h-12 w-12">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="grid min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black tracking-tighter text-sm break-keep">선생님 리포트</span>
                      {unreadReportCount > 0 && (
                        <Badge className="bg-[#FF7A16] text-white border-none font-black text-[8px] h-5 px-2 shrink-0">
                          {unreadReportCount} 새 리포트
                        </Badge>
                      )}
                    </div>
                    <span className="font-bold text-muted-foreground uppercase tracking-widest text-[8px]">학습 피드백</span>
                  </div>
                  <ChevronRight className="ml-auto h-5 w-5 opacity-20" />
                </Card>
              </button>
            </DialogTrigger>
            <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border border-slate-200 flex flex-col", isMobile ? "w-[min(94vw,28rem)] max-h-[88svh] rounded-[2rem]" : "sm:max-w-[450px] max-h-[90vh]")}>
              <div className="bg-primary p-8 text-white relative shrink-0">
          <FileText className="pointer-events-none absolute top-0 right-0 p-8 h-24 w-24 opacity-20" />
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black break-keep">{selectedTeacherReport ? `${selectedTeacherReport.dateKey} 리포트` : '선생님 리포트'}</DialogTitle>
                  <DialogDescription className="text-white/70 font-bold">
                    {selectedTeacherReport ? '선생님이 발송한 리포트 상세 내용입니다.' : '최근에 발송된 리포트를 바로 확인할 수 있어요.'}
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className={cn("flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar p-6", isMobile ? "max-h-[calc(88svh-10.5rem)] p-4" : "")}>
                {selectedTeacherReport ? (
                  <div className="bg-white rounded-2xl border border-border/50 p-4">
                    <VisualReportViewer
                      content={selectedTeacherReport.content}
                      aiMeta={selectedTeacherReport.aiMeta}
                      dateKey={selectedTeacherReport.dateKey}
                      studentName={selectedTeacherReport.studentName}
                    />
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
              "student-cta student-cta-card h-full bg-white transition-colors duration-200 flex flex-row items-center gap-4 rounded-[2rem] p-6",
              unreadReportCount > 0 ? "border-[#FF7A16] ring-1 ring-[#FF7A16]/30" : "border border-slate-200/80"
            )}>
              <div className="rounded-2xl bg-primary/5 flex items-center justify-center shrink-0 h-16 w-16">
                <FileText className="h-8 w-8" />
              </div>
              <div className="grid text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-black tracking-tighter text-xl break-keep">선생님 리포트</span>
                  {unreadReportCount > 0 && (
                    <Badge className="bg-[#FF7A16] text-white border-none font-black text-[9px] h-5 px-2 shrink-0">
                      {unreadReportCount} 새 리포트
                    </Badge>
                  )}
                </div>
                <span className="font-bold text-muted-foreground uppercase tracking-widest text-[10px]">학습 피드백</span>
              </div>
              <ChevronRight className="ml-auto h-5 w-5 opacity-20" />
            </Card>
          </Link>
        )}

        <Dialog>
          <DialogTrigger asChild>
              <button className="group text-left h-full w-full touch-manipulation">
              <Card className={cn(
                "student-cta student-cta-card h-full border border-slate-200/80 bg-white transition-colors duration-200 flex flex-row items-center gap-4",
                isMobile ? "rounded-2xl p-4" : "rounded-[2rem] p-6"
              )}>
                <div className={cn("rounded-2xl bg-amber-50 flex items-center justify-center shrink-0", isMobile ? "h-12 w-12" : "h-16 w-16")}>
                  <ClipboardPen className={cn("text-amber-600", isMobile ? "h-6 w-6" : "h-8 w-8")} />
                </div>
                <div className="grid min-w-0">
                  <span className={cn("font-black tracking-tighter break-keep", isMobile ? "text-sm" : "text-xl")}>지각/결석 신청</span>
                  <span className={cn("font-bold text-muted-foreground uppercase tracking-widest text-[8px] sm:text-[10px]")}>빠른 요청</span>
                </div>
                <ChevronRight className="ml-auto h-5 w-5 opacity-20" />
              </Card>
            </button>
          </DialogTrigger>
          <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border border-slate-200 flex flex-col", isMobile ? "w-[min(94vw,28rem)] max-h-[88svh] rounded-[2rem]" : "sm:max-w-2xl max-h-[90vh]")}>
            <div className="bg-amber-500 p-8 text-white relative shrink-0">
          <BellRing className="pointer-events-none absolute top-0 right-0 p-8 h-24 w-24 opacity-20" />
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">신청서 작성</DialogTitle>
                <DialogDescription className="text-white/70 font-bold">지각 또는 결석 사유를 입력하여 제출하세요.</DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar">
              <div className={cn("p-8 space-y-8", isMobile ? "max-h-[calc(88svh-10.5rem)] p-4 space-y-5" : "")}>
                <div className="grid gap-6 bg-white p-6 rounded-[2rem] border">
                  <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
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
            <DialogFooter className={cn("border-t shrink-0 bg-white", isMobile ? "p-4" : "p-6")}><DialogClose asChild><Button variant="ghost" className="w-full font-black">닫기</Button></DialogClose></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Utility column */}
        <div className={cn("flex flex-col gap-3", isMobile ? "" : "")}>
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className={cn(
                  "student-cta w-full rounded-2xl border border-slate-200/80 bg-white font-black gap-2 flex items-center justify-center text-primary transition-colors hover:bg-slate-50",
                  isMobile ? "h-12 text-sm" : "h-14 text-base"
                )}
              >
                <QrCode className="h-4 w-4" /> 나의 출입 QR
              </button>
            </DialogTrigger>
            <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border border-slate-200 sm:max-w-sm", isMobile ? "w-[min(94vw,26rem)] max-h-[86svh] rounded-[2rem]" : "")}>
              <div className={cn("bg-primary p-8 text-white text-center", isMobile ? "p-6" : "")}>
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black tracking-tighter text-white">나의 출입 QR</DialogTitle>
                  <DialogDescription className="text-white/70 font-bold mt-1">센터 입구 카메라에 스캔해 주세요.</DialogDescription>
                </DialogHeader>
              </div>
              <div className={cn("bg-white flex flex-col items-center gap-6", isMobile ? "p-5" : "p-10")}>
                <div className={cn("rounded-[2rem] bg-[#fafafa] border border-primary/15", isMobile ? "p-4" : "p-6")}>
                  <QRCodeSVG value={qrData} size={isMobile ? 176 : 200} level="H" includeMargin={false} />
                </div>
                <div className="text-center space-y-1">
                  <p className={cn("font-black text-primary tracking-tight break-keep", isMobile ? "text-lg" : "text-xl")}>{user?.displayName}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">출입 인증용</p>
                </div>
              </div>
              <DialogFooter className={cn("bg-muted/30", isMobile ? "p-4" : "p-6")}>
                <DialogClose asChild><Button className="w-full h-12 rounded-xl font-black">닫기</Button></DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <Dialog open={isFortuneDialogOpen} onOpenChange={setIsFortuneDialogOpen}>
        <DialogContent className={cn("border border-[#223B7A]/10 p-0 overflow-hidden bg-white", isMobile ? "w-[min(92vw,26rem)] rounded-[2rem]" : "sm:max-w-md rounded-[2.5rem]")}>
          <div className={cn("bg-[#14295F] text-white", isMobile ? "p-6" : "p-8")}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">오늘의 학업 운세</DialogTitle>
              <DialogDescription className="text-white/70 font-bold">첫 공부 시작을 응원하는 오늘의 한마디예요.</DialogDescription>
            </DialogHeader>
          </div>
          <div className={cn("space-y-4 bg-[radial-gradient(circle_at_top,#eef4ff_0%,#ffffff_72%)]", isMobile ? "p-5" : "p-6")}>
            <div className="rounded-[1.5rem] border border-[#D8E2F5] bg-white px-4 py-5 shadow-[0_24px_40px_-32px_rgba(20,41,95,0.35)]">
              <div className="flex items-center gap-2 text-[#14295F]">
                <Sparkles className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.18em]">Good Study Signal</span>
              </div>
              <p className="mt-3 text-base font-black leading-7 text-slate-900 break-keep">
                {fortuneMessage || getDailyFortuneMessage(user?.uid || 'student', todayKey)}
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-[#F6F8FC] px-4 py-3 text-sm font-semibold leading-6 text-slate-600">
              오늘은 누적 공부시간이 1시간을 넘을 때마다 포인트 상자가 열려요.
            </div>
            <DialogFooter className="p-0">
              <Button className="h-12 w-full rounded-[1rem] bg-[#14295F] text-white hover:bg-[#10214D]">좋아, 시작할게</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isStudyBoxDialogOpen} onOpenChange={setIsStudyBoxDialogOpen}>
        <DialogContent className={cn("border border-[#223B7A]/10 p-0 overflow-hidden bg-white", isMobile ? "w-[min(92vw,27rem)] rounded-[2rem]" : "sm:max-w-lg rounded-[2.5rem]")}>
          <div className={cn("bg-[#14295F] text-white", isMobile ? "p-6" : "p-8")}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">포인트 상자 오픈</DialogTitle>
              <DialogDescription className="text-white/70 font-bold">누적 공부시간을 채워 보상을 열었어요.</DialogDescription>
            </DialogHeader>
          </div>
          <div className={cn("space-y-5 bg-[radial-gradient(circle_at_top,#eef4ff_0%,#ffffff_72%)]", isMobile ? "p-5" : "p-6")}>
            <div className="grid gap-3">
              {claimedStudyBoxRewards.map((reward) => (
                <div key={`${reward.milestone}-${reward.awardedPoints}`} className="rounded-[1.5rem] border border-[#D8E2F5] bg-white px-4 py-4 shadow-[0_24px_40px_-32px_rgba(20,41,95,0.35)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]">{reward.milestone}시간 상자</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">기본 {reward.minReward}~{reward.maxReward} 포인트</p>
                    </div>
                    <div className="text-right">
                      <p className="dashboard-number text-2xl text-[#14295F]">{reward.awardedPoints}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">포인트</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-[1.25rem] bg-[#F6F8FC] px-4 py-3 text-sm font-semibold leading-6 text-slate-600">
              현재 포인트 지갑 {Number(progress?.pointsBalance || 0).toLocaleString()}점 · 다음 상자까지 {formatStudyMinutes(Math.max(0, todayRemainingStudyMinutesToNextBox))} 남았어요.
            </div>
            <DialogFooter className="p-0">
              <Button className="h-12 w-full rounded-[1rem] bg-[#14295F] text-white hover:bg-[#10214D]">확인했어요</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

