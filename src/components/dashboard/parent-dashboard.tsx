'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Send,
  Sparkles,
  TrendingUp,
  Activity,
  History,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  PieChart as PieChartIcon,
  BarChart3,
  Flame,
  Info,
  Maximize2,
  FileText,
  Clock,
  Zap,
  Coffee,
  AlertTriangle,
  UserCheck,
  Home,
  AlertCircle,
  CalendarX,
  MapPin,
  CalendarDays,
  Loader2,
  CreditCard,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { 
  format, 
  subDays, 
  isAfter, 
  parse, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths 
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { useAppContext } from '@/contexts/app-context';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  type ParentPortalTab,
  type ParentQuickRequestKey,
  type ParentNotificationItem,
} from '@/lib/parent-dashboard-model';
import {
  type AttendanceCurrent,
  type AttendanceRequest,
  type DailyReport,
  type GrowthProgress,
  type Invoice,
  type PenaltyLog,
  type ParentActivityEvent,
  type StudyLogDay,
  type StudySession,
  type StudyPlanItem,
  type StudentProfile,
} from '@/lib/types';
import { ROUTINE_MISSING_PENALTY_POINTS } from '@/lib/attendance-auto';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
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

function toHm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}\uBD84`;
  if (m === 0) return `${h}\uC2DC\uAC04`;
  return `${h}\uC2DC\uAC04\u00A0${m}\uBD84`;
}

function toClockLabel(totalMinutes: number) {
  const safe = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)));
  const hours = Math.floor(safe / 60).toString().padStart(2, '0');
  const minutes = (safe % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
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

function toKoreanSubjectLabel(raw: string): string {
  const source = (raw || '').trim();
  if (!source) return '\uAE30\uD0C0';
  const key = source.toLowerCase();

  if (key === 'math' || key.includes('\uC218\uD559')) return '\uC218\uD559';
  if (key === 'english' || key.includes('\uC601\uC5B4')) return '\uC601\uC5B4';
  if (key === 'korean' || key.includes('\uAD6D\uC5B4')) return '\uAD6D\uC5B4';
  if (key === 'science' || key.includes('\uACFC\uD559')) return '\uACFC\uD559';
  if (key === 'social' || key.includes('\uC0AC\uD68C')) return '\uC0AC\uD68C';
  if (key === 'history' || key.includes('\uD55C\uAD6D\uC0AC') || key.includes('\uC5ED\uC0AC')) return '\uD55C\uAD6D\uC0AC';
  if (key === 'essay' || key.includes('\uB17C\uC220')) return '\uB17C\uC220';
  if (key === 'coding' || key.includes('\uCF54\uB529')) return '\uCF54\uB529';
  if (key === 'etc' || key.includes('\uAE30\uD0C0')) return '\uAE30\uD0C0';

  return source;
}

type ParentCommunicationRecord = {
  id: string;
  studentId: string;
  parentUid?: string;
  parentName?: string;
  senderRole?: 'parent' | 'student';
  senderUid?: string;
  senderName?: string;
  type: 'consultation' | 'request' | 'suggestion';
  requestCategory?: 'question' | 'request' | 'suggestion';
  title?: string;
  body?: string;
  channel?: 'visit' | 'phone' | 'online' | null;
  status?: string;
  createdAt?: { toDate?: () => Date; toMillis?: () => number };
  updatedAt?: { toDate?: () => Date; toMillis?: () => number };
  replyBody?: string;
  repliedAt?: { toDate?: () => Date };
  repliedByName?: string;
};

function RhythmTimeChartDialog({
  trend,
  hasTrend,
  yAxisDomain,
  rhythmScoreTrend,
  rhythmScore,
}: {
  trend: Array<{ date: string; rhythmMinutes: number | null }>;
  hasTrend: boolean;
  yAxisDomain: [number, number];
  rhythmScoreTrend: Array<{ date: string; score: number }>;
  rhythmScore: number;
}) {
  const latestRhythm = trend.slice().reverse().find((item) => typeof item.rhythmMinutes === 'number');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer">
          <div className="mb-3 flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
              <TrendingUp className="h-4 w-4 text-[#FF7A16]" />
              {'\uD559\uC2B5 \uB9AC\uB4EC \uC2DC\uAC04'}
            </CardTitle>
            <Maximize2 className="h-4 w-4 text-slate-300" />
          </div>
          <div className="w-full rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{'\uD074\uB9AD \uD6C4 \uC0C1\uC138 \uADF8\uB798\uD504'}</p>
            <p className="mt-2 text-base font-black text-[#14295F]">
              {'\uC624\uB298 \uD559\uC2B5\uB9AC\uB4EC \uC810\uC218: '}
              {String(Math.max(0, Math.min(99, rhythmScore))).padStart(2, '0')}
              {'\uC810'}
            </p>
          </div>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] rounded-[2rem] border border-slate-200 p-0 overflow-hidden sm:max-w-3xl">
        <div className="bg-[#14295F] p-6 text-white sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">{'\uD559\uC2B5 \uB9AC\uB4EC \uC2DC\uAC04'}</DialogTitle>
            <DialogDescription className="text-white/70 font-bold">
              理쒓렐 7??湲곗? 泥?怨듬? ?몄뀡 ?쒖옉 ?쒓컖?낅땲??
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-5 bg-white p-5 sm:p-8">
          <div className="h-[320px] w-full">
            {hasTrend ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={trend} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf5" />
                  <XAxis dataKey="date" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    domain={yAxisDomain}
                    tickFormatter={(value) => toClockLabel(Number(value))}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '1rem', border: '1px solid #e5e7eb' }}
                    formatter={(value) =>
                      typeof value === 'number'
                        ? [toClockLabel(value), '?숈뒿 ?쒖옉']
                        : ['湲곕줉 ?놁쓬', '?숈뒿 ?쒖옉']
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="rhythmMinutes"
                    stroke="#14295F"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#FF7A16', stroke: '#14295F', strokeWidth: 1 }}
                    activeDot={{ r: 6, fill: '#FF7A16', stroke: '#14295F', strokeWidth: 2 }}
                    connectNulls={false}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-400">
                理쒓렐 ?숈뒿 ?쒖옉 湲곕줉???놁뒿?덈떎.
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-[#14295F]">{'\uB9AC\uB4EC \uC810\uC218 \uADF8\uB798\uD504'}</h4>
              <Badge variant="outline" className="font-black text-[10px]">
                {'\uD3C9\uADE0'} {rhythmScore}{'\uC810'}
              </Badge>
            </div>
            <div className="h-[220px] w-full rounded-2xl border border-slate-100 bg-slate-50/40 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={rhythmScoreTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf5" />
                  <XAxis dataKey="date" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis fontSize={11} axisLine={false} tickLine={false} width={30} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ borderRadius: '1rem', border: '1px solid #e5e7eb' }}
                    formatter={(value) => [`${Number(value || 0)}\uC810`, '\uB9AC\uB4EC \uC810\uC218']}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#FF7A16"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#14295F' }}
                    activeDot={{ r: 5, fill: '#14295F' }}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {trend.map((point) => (
              <div key={point.date} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{point.date}</p>
                <p className="mt-1 text-base font-black text-slate-800">
                  {typeof point.rhythmMinutes === 'number' ? toClockLabel(point.rhythmMinutes) : '湲곕줉 ?놁쓬'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SubjectStudyChartDialog({
  subjects,
  subjectTotalMinutes,
}: {
  subjects: Array<{ subject: string; minutes: number; color: string }>;
  subjectTotalMinutes: number;
}) {
  const previewData = subjects.slice(0, 5);
  const topSubject = subjects[0];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer">
          <div className="mb-3 flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
              <BarChart3 className="h-4 w-4 text-[#14295F]" />
                            {'\uC9D1\uC911 KPI'}
            </CardTitle>
            <Maximize2 className="h-4 w-4 text-slate-300" />
          </div>
          <div className="w-full rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{'\uC694\uC57D \uC548\uB0B4'}</p>
            <p className="mt-2 text-base font-black text-[#14295F]">
              {'\uCE74\uB4DC\uB97C \uB204\uB974\uBA74 \uC9D1\uC911 KPI \uADF8\uB798\uD504\uB97C \uBCFC \uC218 \uC788\uC5B4\uC694.'}
            </p>
          </div>
        </Card>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] rounded-[2rem] border border-slate-200 p-0 overflow-hidden sm:max-w-3xl">
        <div className="bg-[#FF7A16] p-6 text-white sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">{'\uC9D1\uC911 KPI'}</DialogTitle>
            <DialogDescription className="text-white/80 font-bold">{'\uC624\uB298 \uD559\uC2B5 \uD750\uB984\uC744 \uC9D1\uC911 \uC9C0\uD45C\uB85C \uD655\uC778\uD560 \uC218 \uC788\uC5B4\uC694.'}</DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-5 bg-white p-5 sm:p-8">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">珥?怨듬??쒓컙</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{toHm(subjectTotalMinutes)}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{'\uACFC\uBAA9 \uC218'}</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{subjects.length}{'\uAC1C'}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">理쒕떎 鍮꾩쨷</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{subjects[0]?.subject || '-'}</p>
            </div>
          </div>
          <div className="h-[320px] w-full">
            {previewData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={previewData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf5" />
                  <XAxis dataKey="subject" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis fontSize={11} axisLine={false} tickLine={false} width={36} />
                  <Tooltip
                    contentStyle={{ borderRadius: '1rem', border: '1px solid #e5e7eb' }}
                    formatter={(value) => [`${Number(value || 0)}\uBD84`, '\uD559\uC2B5\uC2DC\uAC04']}
                  />
                  <Bar dataKey="minutes" radius={[10, 10, 0, 0]} fill="#FF7A16" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm font-bold text-slate-400">
                怨쇰ぉ蹂??숈뒿 怨꾪쉷???놁뒿?덈떎.
              </div>
            )}
          </div>
          <div className="grid gap-2">
            {subjects.map((item) => {
              const ratio = Math.round((item.minutes / Math.max(subjectTotalMinutes, 1)) * 100);
              return (
                <div key={item.subject} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm font-black text-slate-800">{item.subject}</span>
                    </div>
                    <span className="text-sm font-black text-slate-500">{item.minutes}{'\uBD84'}</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(6, ratio)}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

function getFocusProgress(minutes: number) {
  return Math.min(100, Math.round((minutes / 360) * 100));
}

function formatWon(value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  return `??{safe.toLocaleString()}`;
}

type InvoiceStatusMeta = {
  label: string;
  mobileLabel: string;
  className: string;
};

function getInvoiceStatusMeta(status: Invoice['status']): InvoiceStatusMeta | null {
  if (status === 'paid') {
    return {
      label: '?섎궔 ?꾨즺',
      mobileLabel: '?꾨궔',
      className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    };
  }
  if (status === 'overdue') {
    return {
      label: '誘몃궔',
      mobileLabel: '誘몃궔',
      className: 'bg-rose-100 text-rose-700 border-rose-200',
    };
  }
  if (status === 'issued') {
    return {
      label: '泥?뎄',
      mobileLabel: '誘몃궔',
      className: 'bg-amber-100 text-amber-700 border-amber-200',
    };
  }
  return null;
}

function getInvoiceTrackLabel(category?: Invoice['trackCategory']) {
  if (category === 'academy') return '?숈썝 ?섎궔';
  if (category === 'studyRoom') return '?낆꽌???섎궔';
  return '?쇳꽣 ?섎궔';
}

const QUICK_REQUEST_TEMPLATES: Record<ParentQuickRequestKey, string> = {
  math_support: '?섑븰 吏묒쨷 愿由??붿껌',
  english_support: '?곸뼱 蹂댁셿 ?붿껌',
  habit_coaching: '?숈뒿 ?듦? 肄붿묶 ?붿껌',
  career_consulting: '吏꾨줈/吏꾪븰 ?곷떞 ?붿껌',
};

const SUBJECT_COLORS = ['#FF7A16', '#14295F', '#10B981', '#0EA5E9', '#A855F7'];
const REQUEST_PENALTY_POINTS: Record<'late' | 'absence', number> = { late: 1, absence: 2 };
const PENALTY_RECOVERY_INTERVAL_DAYS = 7;

type TimestampLike = { toDate?: () => Date } | Date | string | null | undefined;

function toDateSafe(value: TimestampLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function toRelativeLabel(value: TimestampLike, now = new Date()) {
  const date = toDateSafe(value);
  if (!date) return '\uCD5C\uADFC';
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return '\uBC29\uAE08 \uC804';
  if (diffMinutes < 60) return `${diffMinutes}\uBD84 \uC804`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}\uC2DC\uAC04 \uC804`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}\uC77C \uC804`;
  return format(date, 'MM/dd', { locale: ko });
}

function formatDateLabel(dateText?: string, fallbackTimestamp?: TimestampLike) {
  if (dateText && /^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    const parsed = parse(dateText, 'yyyy-MM-dd', new Date());
    if (!Number.isNaN(parsed.getTime())) {
      return format(parsed, 'MM/dd', { locale: ko });
    }
  }
  const fallbackDate = toDateSafe(fallbackTimestamp);
  if (fallbackDate) {
    return format(fallbackDate, 'MM/dd', { locale: ko });
  }
  return '理쒓렐';
}
export function ParentDashboard({ isActive }: { isActive: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { memberships, activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();

  const isMobile = activeMembership?.role === 'parent' || viewMode === 'mobile';
  const [today, setToday] = useState<Date | null>(null);
  const [tab, setTab] = useState<ParentPortalTab>('home');
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date());

  const [channel, setChannel] = useState<'visit' | 'phone' | 'online'>('visit');
  const [quickType, setQuickType] = useState<ParentQuickRequestKey>('math_support');
  const [requestText, setRequestText] = useState('');
  const [suggestionText, setSuggestionText] = useState('');
  const [parentInquiryType, setParentInquiryType] = useState<'question' | 'request' | 'suggestion'>('question');
  const [parentInquiryTitle, setParentInquiryTitle] = useState('');
  const [parentInquiryBody, setParentInquiryBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [readMap, setReadMap] = useState<Record<string, boolean>>({});
  const [selectedNotification, setSelectedNotification] = useState<ParentNotificationItem | null>(null);
  const [isReportArchiveOpen, setIsReportArchiveOpen] = useState(false);
  const [selectedChildReport, setSelectedChildReport] = useState<DailyReport | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [isPenaltyGuideOpen, setIsPenaltyGuideOpen] = useState(false);
  const [checkInByDateKey, setCheckInByDateKey] = useState<Record<string, Date | null>>({});
  const [studyStartByDateKey, setStudyStartByDateKey] = useState<Record<string, Date | null>>({});
  const visitLoggedRef = useRef(false);
  const reportReadLoggedRef = useRef<Record<string, boolean>>({});

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => setToday(new Date()), []);

  useEffect(() => {
    const requestedTab = searchParams.get('parentTab');
    if (!requestedTab) return;

    if (requestedTab === 'life') {
      setTab('data');
      const params = new URLSearchParams(searchParams.toString());
      params.set('parentTab', 'data');
      router.replace(`${pathname}?${params.toString()}`);
      return;
    }

    const normalizedTab = requestedTab as ParentPortalTab;
    if (normalizedTab) {
      setTab(normalizedTab);
    }
  }, [searchParams, pathname, router]);

  const activeCenterMembership = useMemo(() => {
    if (activeMembership) {
      return memberships.find((membership) => membership.id === activeMembership.id) || activeMembership;
    }
    return memberships.find((membership) => membership.status === 'active') || memberships[0] || null;
  }, [activeMembership, memberships]);

  const centerId = activeCenterMembership?.id;
  const studentId = activeCenterMembership?.linkedStudentIds?.[0];
  const todayKey = today ? format(today, 'yyyy-MM-dd') : '';
  const yesterdayKey = today ? format(subDays(today, 1), 'yyyy-MM-dd') : '';
  const weekKey = today ? format(today, "yyyy-'W'II") : '';
  const logParentActivity = async (
    eventType: ParentActivityEvent['eventType'],
    metadata?: Record<string, any>
  ) => {
    if (!firestore || !centerId || !studentId || !user) return;

    try {
      await addDoc(collection(firestore, 'centers', centerId, 'parentActivityEvents'), {
        centerId,
        studentId,
        parentUid: user.uid,
        eventType,
        createdAt: serverTimestamp(),
        metadata: metadata || {},
      });
    } catch (error) {
      console.warn('[parent-activity] failed to log event', eventType, error);
    }
  };

  useEffect(() => {
    if (!isActive || !centerId || !studentId || !user || visitLoggedRef.current) return;

    visitLoggedRef.current = true;
    void logParentActivity('app_visit', { source: 'dashboard_open', tab });
  }, [isActive, centerId, studentId, user, tab]);

  const studentRef = useMemoFirebase(() => (!firestore || !centerId || !studentId ? null : doc(firestore, 'centers', centerId, 'students', studentId)), [firestore, centerId, studentId]);
  const { data: student } = useDoc<StudentProfile>(studentRef, { enabled: isActive && !!studentId });

  const todayLogRef = useMemoFirebase(() => (!firestore || !centerId || !studentId || !todayKey ? null : doc(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', todayKey)), [firestore, centerId, studentId, todayKey]);
  const { data: todayLog } = useDoc<StudyLogDay>(todayLogRef, { enabled: isActive && !!studentId });

  // 罹섎┛?붿슜 紐⑤뱺 濡쒓렇 議고쉶
  const allLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days'), orderBy('dateKey', 'desc'));
  }, [firestore, centerId, studentId]);
  const { data: allLogs, isLoading: logsLoading } = useCollection<StudyLogDay>(allLogsQuery, { enabled: isActive && !!studentId });

  const plansQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !todayKey || !weekKey) return null;
    return query(collection(firestore, 'centers', centerId, 'plans', studentId, 'weeks', weekKey, 'items'), where('dateKey', '==', todayKey));
  }, [firestore, centerId, studentId, todayKey, weekKey]);
  const { data: todayPlans } = useCollection<StudyPlanItem>(plansQuery, { enabled: isActive && !!studentId });

  const weeklyPlansQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !weekKey) return null;
    return query(collection(firestore, 'centers', centerId, 'plans', studentId, 'weeks', weekKey, 'items'));
  }, [firestore, centerId, studentId, weekKey]);
  const { data: weeklyPlans } = useCollection<StudyPlanItem>(weeklyPlansQuery, { enabled: isActive && !!studentId });

  const selectedDateKey = selectedCalendarDate ? format(selectedCalendarDate, 'yyyy-MM-dd') : '';
  const selectedDateWeekKey = selectedCalendarDate ? format(selectedCalendarDate, "yyyy-'W'II") : '';
  const selectedDatePlansQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !selectedDateKey || !selectedDateWeekKey) return null;
    return query(
      collection(firestore, 'centers', centerId, 'plans', studentId, 'weeks', selectedDateWeekKey, 'items'),
      where('dateKey', '==', selectedDateKey),
    );
  }, [firestore, centerId, studentId, selectedDateKey, selectedDateWeekKey]);
  const { data: selectedDatePlans, isLoading: isSelectedDatePlansLoading } = useCollection<StudyPlanItem>(selectedDatePlansQuery, {
    enabled: isActive && !!studentId && !!selectedDateKey,
  });

  const attendanceCurrentQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'attendanceCurrent'),
      where('studentId', '==', studentId),
      limit(1)
    );
  }, [firestore, centerId, studentId]);
  const { data: attendanceCurrentDocs } = useCollection<AttendanceCurrent>(attendanceCurrentQuery, { enabled: isActive && !!studentId });
  const attendanceCurrent = attendanceCurrentDocs?.[0];

  useEffect(() => {
    if (!isActive || !firestore || !centerId || !studentId || !today) {
      setCheckInByDateKey({});
      return;
    }

    let cancelled = false;
    const targetDateKeys = Array.from({ length: 7 }, (_, index) => {
      const day = subDays(today, 6 - index);
      return format(day, 'yyyy-MM-dd');
    });

    const loadCheckInRecords = async () => {
      try {
        const pairs = await Promise.all(
          targetDateKeys.map(async (dateKey) => {
            const recordRef = doc(firestore, 'centers', centerId, 'attendanceRecords', dateKey, 'students', studentId);
            const snap = await getDoc(recordRef);
            if (!snap.exists()) return [dateKey, null] as const;
            const payload = snap.data() as Record<string, unknown>;
            const checkInAt = toDateSafe((payload?.checkInAt as TimestampLike) || (payload?.updatedAt as TimestampLike));
            return [dateKey, checkInAt] as const;
          })
        );

        if (!cancelled) {
          const next = Object.fromEntries(pairs) as Record<string, Date | null>;
          setCheckInByDateKey(next);
        }
      } catch (error) {
        console.warn('[parent-dashboard] failed to load check-in trend', error);
        if (!cancelled) setCheckInByDateKey({});
      }
    };

    void loadCheckInRecords();
    return () => {
      cancelled = true;
    };
  }, [isActive, firestore, centerId, studentId, today]);

  useEffect(() => {
    if (!isActive || !firestore || !centerId || !studentId || !today) {
      setStudyStartByDateKey({});
      return;
    }

    let cancelled = false;
    const targetDateKeys = Array.from({ length: 7 }, (_, index) => {
      const day = subDays(today, 6 - index);
      return format(day, 'yyyy-MM-dd');
    });

    const loadStudyStartTrend = async () => {
      try {
        const pairs = await Promise.all(
          targetDateKeys.map(async (dateKey) => {
            const sessionsRef = collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', dateKey, 'sessions');
            const firstSessionQuery = query(sessionsRef, orderBy('startTime', 'asc'), limit(1));
            const snapshot = await getDocs(firstSessionQuery);
            const firstSession = snapshot.docs[0]?.data() as StudySession | undefined;
            const sessionStart = firstSession?.startTime ? toDateSafe(firstSession.startTime as TimestampLike) : null;
            const todayFallback =
              dateKey === todayKey && attendanceCurrent?.status === 'studying' && attendanceCurrent?.lastCheckInAt
                ? toDateSafe(attendanceCurrent.lastCheckInAt as TimestampLike)
                : null;
            return [dateKey, sessionStart || todayFallback] as const;
          })
        );

        if (!cancelled) {
          setStudyStartByDateKey(Object.fromEntries(pairs) as Record<string, Date | null>);
        }
      } catch (error) {
        console.warn('[parent-dashboard] failed to load study rhythm trend', error);
        if (!cancelled) setStudyStartByDateKey({});
      }
    };

    void loadStudyStartTrend();
    return () => {
      cancelled = true;
    };
  }, [isActive, firestore, centerId, studentId, today, todayKey, attendanceCurrent?.lastCheckInAt, attendanceCurrent?.status]);

  const reportRef = useMemoFirebase(() => (!firestore || !centerId || !studentId || !yesterdayKey ? null : doc(firestore, 'centers', centerId, 'dailyReports', `${yesterdayKey}_${studentId}`)), [firestore, centerId, studentId, yesterdayKey]);
  const { data: report } = useDoc<DailyReport>(reportRef, { enabled: isActive && !!studentId });
  useEffect(() => {
    if (!isActive || !firestore || !centerId || !studentId || !report?.content) return;

    const reportDocId = report.id || `${yesterdayKey}_${studentId}`;
    if (reportReadLoggedRef.current[reportDocId]) return;
    reportReadLoggedRef.current[reportDocId] = true;

    if (!(report as any).viewedAt) {
      const targetRef = doc(firestore, 'centers', centerId, 'dailyReports', reportDocId);
      updateDoc(targetRef, {
        viewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch((error) => {
        console.warn('[parent-report] viewedAt update failed', error);
      });
    }

    void logParentActivity('report_read', {
      reportId: reportDocId,
      dateKey: report.dateKey || yesterdayKey,
    });
  }, [isActive, firestore, centerId, studentId, report, yesterdayKey]);

  const reportsArchiveQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'dailyReports'),
      where('studentId', '==', studentId),
      where('status', '==', 'sent'),
      limit(50),
    );
  }, [firestore, centerId, studentId]);
  const { data: rawReportsArchive } = useCollection<DailyReport>(reportsArchiveQuery, { enabled: isActive && !!studentId });
  const reportsArchive = useMemo(
    () => [...(rawReportsArchive || [])].sort((a, b) => String(b.dateKey || '').localeCompare(String(a.dateKey || ''))),
    [rawReportsArchive]
  );

  const growthRef = useMemoFirebase(() => (!firestore || !centerId || !studentId ? null : doc(firestore, 'centers', centerId, 'growthProgress', studentId)), [firestore, centerId, studentId]);
  const { data: growth } = useDoc<GrowthProgress>(growthRef, { enabled: isActive && !!studentId });

  const remoteNotificationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !user) return null;
    return query(
      collection(firestore, 'centers', centerId, 'parentNotifications'),
      where('parentUid', '==', user.uid),
      where('studentId', '==', studentId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
  }, [firestore, centerId, studentId, user?.uid]);
  const { data: remoteNotifications } = useCollection<any>(remoteNotificationsQuery, { enabled: isActive && !!studentId && !!user });

  const attendance?붿껌Query = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(collection(firestore, 'centers', centerId, 'attendance?붿껌'), where('studentId', '==', studentId), limit(30));
  }, [firestore, centerId, studentId]);
  const { data: attendance?붿껌 } = useCollection<AttendanceRequest>(attendance?붿껌Query, { enabled: isActive && !!studentId });

  const parentCommunicationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !user) return null;
    return query(
      collection(firestore, 'centers', centerId, 'parentCommunications'),
      where('parentUid', '==', user.uid),
      limit(30),
    );
  }, [firestore, centerId, user]);
  const { data: rawParentCommunications, isLoading: parentCommunicationsLoading } = useCollection<ParentCommunicationRecord>(parentCommunicationsQuery, {
    enabled: isActive && !!centerId && !!user,
  });

  const penaltyLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(collection(firestore, 'centers', centerId, 'penaltyLogs'), where('studentId', '==', studentId), limit(120));
  }, [firestore, centerId, studentId]);
  const { data: penaltyLogs } = useCollection<PenaltyLog>(penaltyLogsQuery, { enabled: isActive && !!studentId });

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'invoices'),
      where('studentId', '==', studentId),
      limit(120)
    );
  }, [firestore, centerId, studentId]);
  const { data: studentInvoices } = useCollection<Invoice>(invoicesQuery, { enabled: isActive && !!studentId });

  const sortedInvoices = useMemo(() => {
    return [...(studentInvoices || [])].sort((a, b) => {
      const aDate =
        toDateSafe((a as any).cycleEndDate)?.getTime() ??
        toDateSafe((a as any).createdAt)?.getTime() ??
        0;
      const bDate =
        toDateSafe((b as any).cycleEndDate)?.getTime() ??
        toDateSafe((b as any).createdAt)?.getTime() ??
        0;
      return bDate - aDate;
    });
  }, [studentInvoices]);

  const displayInvoices = useMemo(
    () => sortedInvoices.filter((invoice) => invoice.status !== 'void' && invoice.status !== 'refunded'),
    [sortedInvoices]
  );
  const latestInvoice = displayInvoices[0];

  const billingSummary = useMemo(() => {
    return displayInvoices.reduce(
      (acc, invoice) => {
        const amount = Number(invoice.finalPrice || 0);
        if (!Number.isFinite(amount) || amount <= 0) return acc;

        acc.billed += amount;
        if (invoice.status === 'paid') {
          acc.paid += amount;
        }
        if (invoice.status === 'overdue') {
          acc.overdue += amount;
        }
        return acc;
      },
      { billed: 0, paid: 0, overdue: 0 }
    );
  }, [displayInvoices]);

  const mobileBillingStatusMeta = useMemo(() => {
    if (displayInvoices.length === 0) return null;
    const hasUnpaidInvoice = displayInvoices.some(
      (invoice) => invoice.status === 'issued' || invoice.status === 'overdue'
    );
    if (!hasUnpaidInvoice) {
      return {
        label: '?꾨궔',
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      };
    }
    return {
      label: '誘몃궔',
      className: 'bg-rose-100 text-rose-700 border-rose-200',
    };
  }, [displayInvoices]);

  const studyPlans = (todayPlans || []).filter((item) => item.category === 'study' || !item.category);
  const totalMinutes = todayLog?.totalMinutes || 0;
  
  const planTotal = studyPlans.length;
  const planDone = studyPlans.filter((item) => item.done).length;
  const planRate = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;

  const logMinutesByDateKey = useMemo(() => {
    const map = new Map<string, number>();
    (allLogs || []).forEach((log) => {
      map.set(log.dateKey, log.totalMinutes || 0);
    });
    return map;
  }, [allLogs]);

  const dailyStudyTrend = useMemo(() => {
    if (!today) return [] as { date: string; minutes: number }[];
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

  const hasRhythmTrend = useMemo(
    () => dailyRhythmTrend.some((point) => typeof point.rhythmMinutes === 'number'),
    [dailyRhythmTrend]
  );

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

  const rhythmScore = useMemo(() => {
    const validScores = rhythmScoreTrend.filter((item) => item.score > 0);
    if (!validScores.length) return 0;
    return Math.round(validScores.reduce((sum, item) => sum + item.score, 0) / validScores.length);
  }, [rhythmScoreTrend]);

  const rhythmYAxisDomain = useMemo(() => {
    const values = dailyRhythmTrend
      .map((point) => point.rhythmMinutes)
      .filter((value): value is number => typeof value === 'number');

    if (values.length === 0) return [420, 1320] as [number, number];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max(30, Math.round((max - min) * 0.25));
    const lower = Math.max(0, Math.floor((min - padding) / 30) * 30);
    const upper = Math.min(24 * 60, Math.ceil((max + padding) / 30) * 30);
    if (lower === upper) return [Math.max(0, lower - 60), Math.min(24 * 60, upper + 60)] as [number, number];
    return [lower, upper] as [number, number];
  }, [dailyRhythmTrend]);

  const weeklyTotalStudyMinutes = useMemo(
    () => dailyStudyTrend.reduce((sum, day) => sum + day.minutes, 0),
    [dailyStudyTrend]
  );

  const weeklyStudyPlans = (weeklyPlans || []).filter((item) => item.category === 'study' || !item.category);
  const weeklyPlanTotal = weeklyStudyPlans.length;
  const weeklyPlanDone = weeklyStudyPlans.filter((item) => item.done).length;
  const weeklyPlanCompletionRate = weeklyPlanTotal > 0 ? Math.round((weeklyPlanDone / weeklyPlanTotal) * 100) : 0;

  const subjectsData = useMemo(() => {
    const source = weeklyStudyPlans.length > 0 ? weeklyStudyPlans : studyPlans;
    const minutesBySubject = new Map<string, number>();

    source.forEach((item) => {
      const inferredSubject = item.subject?.trim() || (item.title.match(/?섑븰|?곸뼱|援?뼱|怨쇳븰|?ы쉶|?쒓뎅???쇱닠|肄붾뵫/)?.[0] ?? '湲고?');
      const weight = item.targetMinutes && item.targetMinutes > 0 ? item.targetMinutes : item.done ? 50 : 30;
      minutesBySubject.set(inferredSubject, (minutesBySubject.get(inferredSubject) || 0) + weight);
    });

    if (minutesBySubject.size === 0 && weeklyTotalStudyMinutes > 0) {
      minutesBySubject.set('?꾩껜 ?숈뒿', weeklyTotalStudyMinutes);
    }

    return Array.from(minutesBySubject.entries())
      .map(([subject, minutes], index) => ({
        subject: toKoreanSubjectLabel(subject),
        minutes,
        color: SUBJECT_COLORS[index % SUBJECT_COLORS.length],
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [studyPlans, weeklyStudyPlans, weeklyTotalStudyMinutes]);

  const subjectTotalMinutes = subjectsData.reduce((sum, subject) => sum + subject.minutes, 0);

  const recentPenaltyReasons = useMemo(() => {
    const sorted?붿껌 = [...(attendance?붿껌 || [])].sort((a, b) => {
      const aDate = toDateSafe((a as any).createdAt)?.getTime() ?? 0;
      const bDate = toDateSafe((b as any).createdAt)?.getTime() ?? 0;
      return bDate - aDate;
    });

    return sorted?붿껌
      .filter((request) => request.penaltyApplied)
      .slice(0, 5)
      .map((request) => ({
        id: request.id,
        reason: request.reason || (request.type === 'late' ? '吏媛??좎껌 泥섎━' : '寃곗꽍 ?좎껌 泥섎━'),
        points: request.type === 'absence' ? REQUEST_PENALTY_POINTS.absence : REQUEST_PENALTY_POINTS.late,
        dateLabel: formatDateLabel(request.date, (request as any).createdAt),
      }));
  }, [attendance?붿껌]);

  const penaltyRecovery = useMemo(() => {
    const basePoints = Math.max(0, Math.round(Number(growth?.penaltyPoints || 0)));
    const nowMs = Date.now();
    const latestPositiveLog = [...(penaltyLogs || [])]
      .filter((log) => Number(log.pointsDelta || 0) > 0)
      .sort((a, b) => {
        const aMs = toDateSafe((a as any).createdAt)?.getTime() || 0;
        const bMs = toDateSafe((b as any).createdAt)?.getTime() || 0;
        return bMs - aMs;
      })[0];

    const latestPositiveMs = latestPositiveLog ? toDateSafe((latestPositiveLog as any).createdAt)?.getTime() || 0 : 0;
    const daysSinceLatestPositive = latestPositiveMs > 0 ? Math.max(0, Math.floor((nowMs - latestPositiveMs) / (24 * 60 * 60 * 1000))) : 0;
    const recoveredPoints = latestPositiveMs > 0 ? Math.min(basePoints, Math.floor(daysSinceLatestPositive / PENALTY_RECOVERY_INTERVAL_DAYS)) : 0;
    const effectivePoints = Math.max(0, basePoints - recoveredPoints);

    return {
      basePoints,
      recoveredPoints,
      effectivePoints,
      daysSinceLatestPositive,
      latestPositiveDateLabel: latestPositiveMs > 0 ? format(new Date(latestPositiveMs), 'yyyy.MM.dd', { locale: ko }) : '-',
    };
  }, [growth?.penaltyPoints, penaltyLogs]);
  const penaltyHistoryItems = useMemo(() => {
    return [...(penaltyLogs || [])]
      .map((log) => {
        const createdAtMs = toDateSafe((log as any).createdAt)?.getTime() || 0;
        const pointsDelta = Number(log.pointsDelta || 0);
        const sourceLabel =
          log.source === 'attendance_request'
            ? '\uCD9C\uACB0'
            : log.source === 'routine_missing'
              ? '\uB8E8\uD2F4'
              : log.source === 'reset'
                ? '\uCD08\uAE30\uD654'
                : '\uC0DD\uD65C\uAE30\uB85D';

        return {
          id: log.id,
          createdAtMs,
          dateLabel: createdAtMs > 0 ? format(new Date(createdAtMs), 'yyyy.MM.dd HH:mm', { locale: ko }) : '-',
          pointsDelta,
          reason: log.reason || '\uBC8C\uC810 \uBCC0\uB3D9',
          sourceLabel,
        };
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, 20);
  }, [penaltyLogs]);

  const aiInsights = useMemo(() => {
    const insights: string[] = [];
    const targetWeeklyMinutes = (student?.targetDailyMinutes || 360) * 5;

    if (weeklyTotalStudyMinutes > 0) {
      const progressRate = Math.round((weeklyTotalStudyMinutes / Math.max(targetWeeklyMinutes, 1)) * 100);
      if (progressRate >= 100) {
        insights.push(`?대쾲 二?紐⑺몴 ?숈뒿?쒓컙???ъ꽦?덉뒿?덈떎. (${toHm(weeklyTotalStudyMinutes)})`);
      } else {
        insights.push(`?대쾲 二??꾩쟻 ?숈뒿? ${toHm(weeklyTotalStudyMinutes)}?쇰줈 紐⑺몴 ?鍮?${progressRate}%?낅땲??`);
      }
    } else {
      insights.push('?숈뒿 濡쒓렇媛 ?볦씠硫??멸났吏???몄궗?댄듃媛 ?먮룞?쇰줈 ?뺢탳?댁쭛?덈떎.');
    }

    insights.push(
      weeklyPlanTotal > 0
        ? `二쇨컙 怨꾪쉷 ?ъ꽦瑜좎? ${weeklyPlanCompletionRate}%?낅땲?? ${weeklyPlanCompletionRate >= 80 ? '?꾩＜ ?덉젙?곸엯?덈떎.' : '?꾨즺?⑥쓣 議곌툑留????뚯뼱?щ젮 蹂댁꽭??'}`
        : '?대쾲 二?怨꾪쉷 ?곗씠?곌? ?꾩쭅 ?깅줉?섏? ?딆븯?듬땲??'
    );

    if (subjectsData.length > 0) {
      const topSubject = subjectsData[0];
      insights.push(`媛??留롮씠 ?ъ옄??怨쇰ぉ? ${topSubject.subject} (${topSubject.minutes}遺??낅땲??`);
    }

    if (penaltyRecovery.effectivePoints > 0) {
      insights.push(`?앺솢 踰뚯젏??${penaltyRecovery.effectivePoints}???뚮났 諛섏쁺) ?꾩쟻?섏뼱 ?덉뼱 ?앺솢 愿由ш? ?꾩슂?⑸땲??`);
    }

    return insights.slice(0, 4);
  }, [student?.targetDailyMinutes, weeklyTotalStudyMinutes, weeklyPlanTotal, weeklyPlanCompletionRate, subjectsData, penaltyRecovery.effectivePoints]);

  const weeklyFeedback = report?.content?.trim() || aiInsights[0] || '?좎깮???쇰뱶諛깆씠 ?깅줉?섎㈃ ???곸뿭?먯꽌 ?뺤씤?????덉뒿?덈떎.';

  const attendanceStatus = useMemo(() => {
    if (!attendanceCurrent) return { label: '?곹깭 誘명솗??, color: 'bg-slate-100 text-slate-400', icon: Clock };

    const status = attendanceCurrent.status;
    const isStudying = ['studying', 'away', 'break'].includes(status);
    const hasRecord = (todayLog?.totalMinutes || 0) > 0;

    if (isStudying) {
      return { label: '?깆썝 (?숈뒿 以?', color: 'bg-[#eaf2ff] text-[#14295F] border-blue-100', icon: UserCheck };
    }

    if (!isStudying && hasRecord) {
      return { label: '?섏썝 (洹媛 ?꾨즺)', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: Home };
    }

    const routineItems = todayPlans?.filter(p => p.category === 'schedule') || [];
    const isAbsentDay = routineItems.some(p => p.title.includes('?깆썝?섏? ?딆뒿?덈떎'));
    
    if (isAbsentDay) {
      return { label: '寃곗꽍 (?대Т)', color: 'bg-rose-50 text-rose-600 border-rose-100', icon: CalendarX };
    }

    const inTimePlan = routineItems.find(p => p.title.includes('?깆썝 ?덉젙'));
    if (inTimePlan) {
      const timeStr = inTimePlan.title.split(': ')[1];
      if (timeStr) {
        try {
          const now = new Date();
          const scheduledTime = parse(timeStr, 'HH:mm', now);
          if (isAfter(now, scheduledTime)) {
            return { label: '吏媛?二쇱쓽', color: 'bg-orange-50 text-[#FF7A16] border-orange-100', icon: AlertCircle };
          }
        } catch (e) {}
      }
    }

    return { label: '誘몄엯??(?낆떎 ??', color: 'bg-slate-100 text-slate-400 border-slate-200', icon: Clock };
  }, [attendanceCurrent, todayLog, todayPlans]);

  // 罹섎┛???곗씠???앹꽦
  const calendarData = useMemo(() => {
    const start = startOfMonth(currentCalendarDate);
    const end = endOfMonth(currentCalendarDate);
    const calendarStart = startOfWeek(start, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(end, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentCalendarDate]);

  const getHeatmapColor = (minutes: number) => {
    if (minutes === 0) return 'bg-white text-slate-400';
    if (minutes < 60) return 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700';
    if (minutes < 180) return 'bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-800';
    if (minutes < 300) return 'bg-gradient-to-br from-emerald-200 to-emerald-300 text-emerald-900';
    if (minutes < 480) return 'bg-gradient-to-br from-emerald-400 to-emerald-500 text-white';
    return 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white';
  };

  const notifications: ParentNotificationItem[] = useMemo(() => {
    if (remoteNotifications && remoteNotifications.length > 0) {
      return remoteNotifications.map((item: any) => ({
        id: item.id,
        type: item.type || 'weekly_report',
        title: item.title || '???뚮┝',
        body: item.body || '',
        createdAtLabel: item.createdAtLabel || toRelativeLabel(item.createdAt),
        createdAtMs: toDateSafe(item.createdAt)?.getTime() || 0,
        isRead: !!item.isRead,
        isImportant: !!item.isImportant,
      }));
    }

    const fallback: ParentNotificationItem[] = [];

    if (attendanceCurrent) {
      fallback.push({
        id: `attendance-${attendanceCurrent.id || 'current'}`,
        type: attendanceCurrent.status === 'studying' ? 'check_in' : 'check_out',
        title: attendanceCurrent.status === 'studying' ? '?깆썝 ?곹깭 ?뺤씤' : '異쒓껐 ?곹깭 ?낅뜲?댄듃',
        body: attendanceStatus.label,
        createdAtLabel: toRelativeLabel((attendanceCurrent as any).updatedAt),
        createdAtMs: toDateSafe((attendanceCurrent as any).updatedAt)?.getTime() || 0,
        isRead: false,
        isImportant: attendanceCurrent.status !== 'studying',
      });
    }

    if (report?.content) {
      fallback.push({
        id: report.id || `${yesterdayKey}-${studentId}`,
        type: 'weekly_report',
        title: '?숈뒿 由ы룷???꾩갑',
        body: report.content,
        createdAtLabel: toRelativeLabel((report as any).updatedAt || (report as any).createdAt),
        createdAtMs: toDateSafe((report as any).updatedAt || (report as any).createdAt)?.getTime() || 0,
        isRead: !!report.viewedAt,
        isImportant: true,
      });
    }

    if (recentPenaltyReasons.length > 0) {
      const latest = recentPenaltyReasons[0];
      fallback.push({
        id: `penalty-${latest.id}`,
        type: 'penalty',
        title: '?앺솢 湲곕줉 ?뚮┝',
        body: `${latest.reason} (+${latest.points}??`,
        createdAtLabel: latest.dateLabel,
        createdAtMs: 0,
        isRead: false,
        isImportant: true,
      });
    }

    return fallback;
  }, [remoteNotifications, attendanceCurrent, attendanceStatus.label, report, recentPenaltyReasons, studentId, yesterdayKey]);

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  }, [notifications]);

  const recentNotifications = useMemo(() => sortedNotifications.slice(0, 3), [sortedNotifications]);
  const unreadRecentCount = useMemo(
    () => recentNotifications.filter((notification) => !(notification.isRead || !!readMap[notification.id])).length,
    [recentNotifications, readMap]
  );

  const latestStudySnapshot = useMemo(() => {
    const sorted = [...(allLogs || [])]
      .filter((log) => (log.totalMinutes || 0) > 0)
      .sort((a, b) => (b.dateKey || '').localeCompare(a.dateKey || ''));
    const latest = sorted[0];
    if (!latest) return null;

    const parsed = parse(latest.dateKey, 'yyyy-MM-dd', new Date());
    const studyDateLabel = Number.isNaN(parsed.getTime())
      ? latest.dateKey
      : format(parsed, 'MM/dd (EEE)', { locale: ko });
    const studyStartAt = studyStartByDateKey[latest.dateKey] || null;
    const studyStartLabel = studyStartAt ? format(studyStartAt, 'HH:mm') : '湲곕줉 ?놁쓬';

    return {
      dateKey: latest.dateKey,
      studyDateLabel,
      studyStartLabel,
    };
  }, [allLogs, studyStartByDateKey]);

  const latestAwayNotification = useMemo(
    () => sortedNotifications.find((notification) => notification.type === 'away_long' || notification.type === 'unauthorized_exit') || null,
    [sortedNotifications]
  );

  const latestCheckOutNotification = useMemo(
    () => sortedNotifications.find((notification) => notification.type === 'check_out') || null,
    [sortedNotifications]
  );

  const recentLifeAttendanceSummary = useMemo(() => {
    const isAwayNow = attendanceCurrent?.status === 'away' || attendanceCurrent?.status === 'break';
    const hasAwayRecord = isAwayNow || !!latestAwayNotification;
    const hasCheckOutRecord =
      !!latestCheckOutNotification ||
      (attendanceCurrent?.status !== 'studying' && (todayLog?.totalMinutes || 0) > 0);

    return {
      recentStudyDate: latestStudySnapshot?.studyDateLabel || '湲곕줉 ?놁쓬',
      recentStudyStart: latestStudySnapshot?.studyStartLabel || '湲곕줉 ?놁쓬',
      awayStatus: isAwayNow
        ? '?꾩옱 ?몄텧/?댁떇 以?
        : hasAwayRecord
          ? `理쒓렐 ?몄텧 湲곕줉 (${latestAwayNotification?.createdAtLabel || '?뺤씤??})`
          : '?몄텧 湲곕줉 ?놁쓬',
      checkOutStatus: hasCheckOutRecord
        ? `?댁떎 湲곕줉 ?덉쓬 (${latestCheckOutNotification?.createdAtLabel || '?뺤씤??})`
        : '?댁떎 湲곕줉 ?놁쓬',
    };
  }, [
    attendanceCurrent?.status,
    latestAwayNotification?.createdAtLabel,
    latestCheckOutNotification?.createdAtLabel,
    latestStudySnapshot?.studyDateLabel,
    latestStudySnapshot?.studyStartLabel,
    todayLog?.totalMinutes,
  ]);

  const penaltyMeta = useMemo(() => {
    const points = penaltyRecovery.effectivePoints;
    if (points >= 20) return { label: '?댁썝', badge: 'bg-rose-200 text-rose-800 border-rose-300' };
    if (points >= 12) return { label: '?숇?紐??곷떞', badge: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (points >= 7) return { label: '?좎깮?섍낵 ?곷떞', badge: 'bg-orange-100 text-orange-800 border-orange-300' };
    return { label: '?뺤긽', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  }, [penaltyRecovery.effectivePoints]);

  const selectedDateLog = useMemo(() => {
    if (!selectedDateKey) return null;
    return (allLogs || []).find((log) => log.dateKey === selectedDateKey) || null;
  }, [allLogs, selectedDateKey]);

  const parentCommunications = useMemo(() => {
    if (!rawParentCommunications) return [];
    return [...rawParentCommunications].sort((a, b) => {
      const aMs = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
      const bMs = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
      return bMs - aMs;
    });
  }, [rawParentCommunications]);

  const selectedDateStudyPlans = useMemo(
    () => (selectedDatePlans || []).filter((item) => item.category === 'study' || !item.category),
    [selectedDatePlans]
  );
  const selectedDatePlanTotal = selectedDateStudyPlans.length;
  const selectedDatePlanDone = selectedDateStudyPlans.filter((item) => item.done).length;
  const selectedDatePlanRate = selectedDatePlanTotal > 0 ? Math.round((selectedDatePlanDone / selectedDatePlanTotal) * 100) : 0;
  const selectedDateLp = Number(growth?.dailyLpStatus?.[selectedDateKey]?.dailyLpAmount || 0);
  const selectedDateRequest = useMemo(
    () => (attendance?붿껌 || []).find((request) => request.date === selectedDateKey),
    [attendance?붿껌, selectedDateKey]
  );

  const readNotification = async (notification: ParentNotificationItem) => {
    setReadMap((prev) => ({ ...prev, [notification.id]: true }));
    void logParentActivity('app_visit', { source: 'notification_read', notificationId: notification.id, notificationType: notification.type });
  };

  const openNotificationDetail = async (notification: ParentNotificationItem) => {
    await readNotification(notification);
    setSelectedNotification(notification);
  };

  const handleTabChange = (value: string) => {
    const nextTab = (value === 'life' ? 'data' : value) as ParentPortalTab;
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('parentTab', nextTab);
    router.replace(`${pathname}?${params.toString()}`);
    void logParentActivity('app_visit', { source: 'tab_change', tab: nextTab });
  };

  const handleOpenReportsArchive = () => {
    setSelectedChildReport(reportsArchive[0] || null);
    setIsReportArchiveOpen(true);
  };

  const handleSelectChildReport = async (target: DailyReport) => {
    setSelectedChildReport(target);
    if (!firestore || !centerId || !target?.id || target.viewedAt) return;
    updateDoc(doc(firestore, 'centers', centerId, 'dailyReports', target.id), {
      viewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch((error) => {
      console.warn('[parent-dashboard] report viewed update failed', error);
    });
  };

  async function submit(type: 'consultation' | 'request' | 'suggestion') {
    if (!firestore || !centerId || !studentId || !user) return;
    let title = '';
    let body = '';
    if (type === 'consultation') {
      title = `?곷떞 ?좎껌 (${channel === 'visit' ? '諛⑸Ц' : channel === 'phone' ? '?꾪솕' : '?⑤씪??})`;
      body = requestText.trim();
      if (!body) { toast({ variant: 'destructive', title: '?낅젰 ?뺤씤', description: '?곷떞 ?붿껌 ?댁슜???낅젰?댁＜?몄슂.' }); return; }
    }
    if (type === 'request') {
      title = QUICK_REQUEST_TEMPLATES[quickType];
      body = requestText.trim() || title;
    }
    if (type === 'suggestion') {
      title = '嫄댁쓽?ы빆';
      body = suggestionText.trim();
      if (!body) { toast({ variant: 'destructive', title: '?낅젰 ?뺤씤', description: '嫄댁쓽?ы빆???낅젰?댁＜?몄슂.' }); return; }
    }
    setSubmitting(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'parentCommunications'), {
        studentId, parentUid: user.uid, parentName: user.displayName || '?숇?紐?,
        senderRole: 'parent', senderUid: user.uid, senderName: user.displayName || '?숇?紐?,
        type, title, body, channel: type === 'consultation' ? channel : null,
        requestCategory: type === 'suggestion' ? 'suggestion' : 'request',
        status: 'requested', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });

      const eventType: ParentActivityEvent['eventType'] =
        type === 'consultation' ? 'consultation_request' : type;
      await logParentActivity(eventType, {
        title,
        channel: type === 'consultation' ? channel : null,
        quickType: type === 'request' ? quickType : null,
      });

      toast({ title: '?꾩넚 ?꾨즺', description: '?좎깮?섍퍡 ?붿껌???뺤긽?곸쑝濡??꾨떖?섏뿀?듬땲??' });
      setRequestText(''); setSuggestionText('');
    } catch (error) {
      toast({ variant: 'destructive', title: '?꾩넚 ?ㅽ뙣', description: '?듭떊 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitParentInquiry() {
    if (!firestore || !centerId || !studentId || !user) return;
    const body = parentInquiryBody.trim();
    if (!body) {
      toast({ variant: 'destructive', title: '?낅젰 ?뺤씤', description: '臾몄쓽 ?댁슜???낅젰??二쇱꽭??' });
      return;
    }

    const type: ParentCommunicationRecord['type'] = parentInquiryType === 'suggestion' ? 'suggestion' : 'request';
    const fallbackTitle =
      parentInquiryType === 'question'
        ? '?숇?紐?吏덉쓽'
        : parentInquiryType === 'request'
          ? '?숇?紐??붿껌?ы빆'
          : '?숇?紐?嫄댁쓽?ы빆';

    setSubmitting(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'parentCommunications'), {
        studentId,
        parentUid: user.uid,
        parentName: user.displayName || '?숇?紐?,
        senderRole: 'parent',
        senderUid: user.uid,
        senderName: user.displayName || '?숇?紐?,
        type,
        requestCategory: parentInquiryType,
        title: parentInquiryTitle.trim() || fallbackTitle,
        body,
        status: 'requested',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      void logParentActivity(parentInquiryType === 'suggestion' ? 'suggestion' : 'request', {
        title: parentInquiryTitle.trim() || fallbackTitle,
        requestCategory: parentInquiryType,
      });

      toast({ title: '?깅줉 ?꾨즺', description: '?좎깮???먮뒗 ?쇳꽣愿由ъ옄?먭쾶 ?꾨떖?섏뿀?듬땲??' });
      setParentInquiryType('question');
      setParentInquiryTitle('');
      setParentInquiryBody('');
    } catch (error) {
      toast({ variant: 'destructive', title: '?깅줉 ?ㅽ뙣', description: '?듭떊 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.' });
    } finally {
      setSubmitting(false);
    }
  }

  const getParentCommunicationTypeBadge = (item: ParentCommunicationRecord) => {
    if (item.type === 'consultation') {
      return <Badge variant="outline" className="border-none bg-blue-100 text-blue-700 font-black text-[10px]">?곷떞 ?붿껌</Badge>;
    }
    if (item.requestCategory === 'question') {
      return <Badge variant="outline" className="border-none bg-sky-100 text-sky-700 font-black text-[10px]">吏덉쓽?ы빆</Badge>;
    }
    if (item.type === 'suggestion' || item.requestCategory === 'suggestion') {
      return <Badge variant="outline" className="border-none bg-violet-100 text-violet-700 font-black text-[10px]">嫄댁쓽?ы빆</Badge>;
    }
    return <Badge variant="outline" className="border-none bg-amber-100 text-amber-700 font-black text-[10px]">?붿껌?ы빆</Badge>;
  };

  const getParentCommunicationStatusBadge = (status?: string) => {
    if (status === 'done') {
      return <Badge variant="outline" className="border-none bg-emerald-100 text-emerald-700 font-black text-[10px]">?듬? ?꾨즺</Badge>;
    }
    if (status === 'in_progress') {
      return <Badge variant="outline" className="border-none bg-blue-100 text-blue-700 font-black text-[10px]">泥섎━ 以?/Badge>;
    }
    if (status === 'in_review') {
      return <Badge variant="outline" className="border-none bg-amber-100 text-amber-700 font-black text-[10px]">寃??以?/Badge>;
    }
    return <Badge variant="secondary" className="font-black text-[10px]">?묒닔??/Badge>;
  };

  if (!isActive) return null;

  return (
    <div className={cn("space-y-4 pb-24", isMobile ? "px-0" : "max-w-4xl mx-auto px-4")}>
      <Card className="overflow-hidden rounded-[2.5rem] border-none bg-white shadow-2xl ring-1 ring-slate-200/60 transition-all duration-500">
        <CardContent className={cn('p-6 space-y-6')}>
          <div className="flex flex-col gap-1 px-1">
            <CardTitle className="font-aggro-display text-[1.85rem] font-black tracking-[-0.02em] text-[#14295F] leading-[1.1]">
              {student?.name || '\uC790\uB140'} {'\uD559\uC2B5 \uD604\uD669'}
            </CardTitle>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              {today && format(today, 'yyyy. MM. dd (EEEE)', {locale: ko})}
              <span className="opacity-30">|</span>
              <span className="text-[#FF7A16]">{'\uC2E4\uC2DC\uAC04 \uC5C5\uB370\uC774\uD2B8 \uC911'}</span>
            </p>
          </div>

          <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
            <TabsContent value="home" className="mt-0 space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-2 gap-3">
                <Card className="rounded-2xl border border-[#cfdcf8] bg-[linear-gradient(135deg,#e8f1ff_0%,#f6f9ff_100%)] p-4 text-center space-y-1 shadow-sm group hover:shadow-md hover:ring-1 hover:ring-[#c4d5ff] transition-all">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">?ㅻ뒛 怨듬?</span>
                  <p className="dashboard-number text-xl text-[#14295F] leading-tight whitespace-nowrap">{toHm(totalMinutes)}</p>
                </Card>
                <Card className="rounded-2xl border border-[#ffcfa0] bg-[linear-gradient(135deg,#fff2e4_0%,#fff9f2_100%)] p-4 text-center space-y-1 shadow-sm group hover:shadow-md hover:ring-1 hover:ring-[#ffbf8a] transition-all">
                  <span className="text-[10px] font-black text-[#FF7A16] uppercase tracking-widest">怨꾪쉷 ?ъ꽦</span>
                  <p className="dashboard-number text-2xl text-[#14295F] leading-tight">{planRate}%</p>
                </Card>
                <Card className={cn(
                  "rounded-2xl border border-[#d7e3fb] bg-[linear-gradient(135deg,#eef4ff_0%,#ffffff_100%)] p-4 text-center space-y-1 shadow-sm transition-all",
                  attendanceStatus.color
                )}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">異쒓껐 ?곹깭</span>
                  <p className="text-lg font-black leading-tight">{attendanceStatus.label.split(' ')[0]}</p>
                </Card>
                <Card
                  className="rounded-2xl border border-[#ffcfa0] bg-[linear-gradient(135deg,#fff3e6_0%,#fff9f4_100%)] p-4 text-center space-y-1 shadow-sm transition-all hover:ring-1 hover:ring-[#ffc593] cursor-pointer"
                  role="button"
                  onClick={() => setIsPenaltyGuideOpen(true)}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">踰뚯젏 吏??/span>
                  <div className="flex items-center justify-center gap-1">
                    <p className="dashboard-number text-xl text-rose-700 leading-tight">{penaltyRecovery.effectivePoints}</p>
                    <span className="text-xs font-black text-rose-500/70">??/span>
                  </div>
                  <Badge variant="outline" className={cn('h-5 border px-2 text-[10px] font-black', penaltyMeta.badge)}>{penaltyMeta.label}</Badge>
                  {penaltyRecovery.recoveredPoints > 0 && (
                    <p className="text-[10px] font-bold text-rose-500/80">?먮룞 ?뚮났 -{penaltyRecovery.recoveredPoints}??諛섏쁺</p>
                  )}
                </Card>
              </div>

              <Card
                role="button"
                tabIndex={0}
                onClick={handleOpenReportsArchive}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleOpenReportsArchive();
                  }
                }}
                className="rounded-[2rem] border border-[#d7e3fb] bg-[linear-gradient(145deg,#eef4ff_0%,#f5f9ff_55%,#fff4e8_100%)] p-6 ring-1 ring-[#d7e3fb]/70 relative overflow-hidden group shadow-sm cursor-pointer active:scale-[0.99] transition-transform"
              >
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:rotate-12 transition-transform duration-700">
                  <MessageCircle className="h-20 w-20 text-[#14295F]" />
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#FF7A16] fill-current" />
                    <span className="text-[10px] font-black text-[#14295F] uppercase tracking-widest">?댁젣??遺꾩꽍 寃곌낵</span>
                  </div>
                  {report?.viewedAt && <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-none font-black text-[10px] h-4 px-1.5">?쎌쓬</Badge>}
                </div>
                <p className="text-sm font-bold text-slate-800 leading-relaxed break-keep relative z-10 line-clamp-2">
                  {'\uCE74\uB4DC\uB97C \uB204\uB974\uBA74, \uACFC\uAC70 \uB9AC\uD3EC\uD2B8\uB97C \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}
                </p>
              </Card>

              <Card className="rounded-[2rem] border border-[#d7e3fb] bg-[linear-gradient(145deg,#f7faff_0%,#ffffff_70%,#fff7ef_100%)] p-5 shadow-sm">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-[#14295F]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">理쒓렐 ?뚮┝ 3媛?/span>
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadRecentCount > 0 && (
                      <Badge variant="outline" className="h-5 border-none bg-[#FF7A16]/15 px-2 text-[10px] font-black text-[#FF7A16] animate-pulse">
                        誘몄씫??{unreadRecentCount}
                      </Badge>
                    )}
                    <Badge variant="outline" className="h-5 border border-slate-200 bg-slate-50 px-2 text-[10px] font-black text-slate-500">
                      {recentNotifications.length}嫄?
                    </Badge>
                  </div>
                </div>
                <p className="mb-3 text-[11px] font-bold text-slate-500">?뚮┝ 移대뱶瑜??꾨Ⅴ硫??곸꽭 ?댁슜???쎌쓣 ???덉뼱??</p>
                {recentNotifications.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-[11px] font-bold text-slate-400">
                    理쒓렐 ?뚮┝???놁뒿?덈떎.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentNotifications.map((notification) => {
                      const isRead = notification.isRead || !!readMap[notification.id];
                      return (
                        <button
                          type="button"
                          key={notification.id}
                          className={cn(
                            'relative w-full overflow-hidden rounded-2xl border p-3 text-left transition-all',
                            isRead
                              ? 'border-[#dbe4f8] bg-[#f3f7ff]'
                              : 'border-[#ffcf9e] bg-[linear-gradient(135deg,#fff5ea_0%,#eef4ff_100%)] shadow-sm ring-1 ring-[#ffd29f]/80 hover:shadow-md'
                          )}
                          onClick={() => void openNotificationDetail(notification)}
                        >
                          {!isRead && (
                            <>
                              <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-[#FF7A16]/20 blur-xl animate-pulse" />
                              <Sparkles className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 text-[#FF7A16] animate-pulse" />
                            </>
                          )}
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="truncate pr-6 text-sm font-black tracking-tight text-[#14295F]">{notification.title}</p>
                            <div className="flex shrink-0 items-center gap-1">
                              {!isRead && (
                                <span className="relative inline-flex h-2.5 w-2.5">
                                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#FF7A16] opacity-70 animate-ping" />
                                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#FF7A16]" />
                                </span>
                              )}
                              {notification.isImportant && (
                                <Badge variant="outline" className="h-5 shrink-0 border-none bg-orange-100 px-2 text-[10px] font-black text-[#FF7A16]">
                                  以묒슂
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {notification.createdAtLabel} 쨌 {isRead ? '?쎌쓬' : '誘명솗??}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
              <div className="grid grid-cols-1 gap-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="w-full h-14 rounded-2xl bg-[#14295F] text-white hover:bg-[#14295F]/90 font-black gap-2 text-base shadow-xl active:scale-[0.98] transition-all">
                      <TrendingUp className="h-5 w-5" /> ?멸났吏???숈뒿 ?몄궗?댄듃 蹂닿린 <ChevronRight className="h-4 w-4 ml-auto opacity-40" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md">
                    <div className="bg-[#14295F] p-10 text-white relative">
                      <Sparkles className="absolute top-0 right-0 p-8 h-32 w-32 opacity-20" />
                      <DialogTitle className="text-2xl font-black tracking-tighter text-white">?멸났吏???숈뒿 ?몄궗?댄듃</DialogTitle>
                      <DialogDescription className="text-white/70 font-bold mt-1 text-xs">?먮????숈뒿 ?⑦꽩???멸났吏?μ씠 ?뺣? 遺꾩꽍?덉뒿?덈떎.</DialogDescription>
                    </div>
                    <div className="p-6 space-y-3 bg-[#fafafa]">
                      {aiInsights.map((insight, i) => (
                        <div key={i} className="flex items-start gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-orange-200">
                          <div className="h-2 w-2 rounded-full bg-[#FF7A16] mt-2 shrink-0" />
                          <p className="text-sm font-bold text-slate-700 leading-relaxed">{insight}</p>
                        </div>
                      ))}
                    </div>
                    <DialogFooter className="p-6 bg-white border-t">
                      <DialogClose asChild><Button className="w-full h-14 rounded-2xl font-black text-lg bg-[#14295F] text-white">?뺤씤?덉뒿?덈떎</Button></DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>

            <TabsContent value="studyDetail" className="mt-0 space-y-6 animate-in fade-in duration-500">
              {/* 二쇨컙 ?깃낵 ?붿빟 (湲곗〈 由ы룷???댁슜 ?듯빀) */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="rounded-[1.5rem] border-none bg-white p-4 ring-1 ring-slate-100 text-center shadow-sm">
                  <span className="text-[10px] font-black text-slate-500 block mb-2 uppercase tracking-widest">二쇨컙 ?꾩쟻 ?몃옓</span>
                  <div className="flex items-baseline justify-center gap-0.5 flex-wrap leading-tight">
                    {Math.floor(weeklyTotalStudyMinutes / 60) > 0 && (
                      <>
                        <span className="dashboard-number text-2xl text-[#14295F] tabular-nums leading-none">{Math.floor(weeklyTotalStudyMinutes / 60)}</span>
                        <span className="text-[11px] font-black text-[#14295F]/50 mr-0.5">?쒓컙</span>
                      </>
                    )}
                    <span className="dashboard-number text-2xl text-[#14295F] tabular-nums leading-none">{(weeklyTotalStudyMinutes % 60).toString().padStart(2, '0')}</span>
                    <span className="text-[11px] font-black text-[#14295F]/50">遺?/span>
                  </div>
                </Card>
                <Card className="rounded-[1.5rem] border-none bg-white p-6 ring-1 ring-slate-100 text-center shadow-sm">
                  <span className="text-[10px] font-black text-slate-500 block mb-2 uppercase tracking-widest">?됯퇏 紐⑺몴 ?ъ꽦</span>
                  <p className="dashboard-number text-2xl text-[#FF7A16]">{weeklyPlanCompletionRate}%</p>
                </Card>
              </div>

              <div className="flex items-center justify-between px-1">
                <div className="flex flex-col">
                  <h3 className="text-xl font-black tracking-tighter text-[#14295F]">湲곕줉?몃옓</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">?숈뒿 ?쇨???留?/p>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentCalendarDate(subMonths(currentCalendarDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-[11px] font-black min-w-[80px] text-center">{format(currentCalendarDate, 'yyyy??M??)}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentCalendarDate(addMonths(currentCalendarDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>

              <Card className="rounded-[2.5rem] border-2 border-[#14295F]/5 bg-white shadow-xl ring-1 ring-black/[0.03] overflow-hidden">
                <div className={cn(
                  "grid grid-cols-7 border-b-2 border-[#14295F]/10",
                  isMobile ? "bg-slate-50" : "bg-gradient-to-r from-slate-50 via-white to-slate-50"
                )}>
                  {['??, '??, '??, '紐?, '湲?, '??, '??].map((day, i) => (
                    <div key={day} className={cn(
                      isMobile ? "py-3 text-[10px]" : "py-4 text-[11px]",
                      "text-center font-black uppercase tracking-widest",
                      i === 5 ? "text-blue-600" : i === 6 ? "text-rose-600" : "text-[#14295F]/75"
                    )}>{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 auto-rows-fr bg-[radial-gradient(circle_at_top_left,rgba(20,41,95,0.02),transparent_45%)]">
                  {logsLoading ? (
                    <div className="col-span-7 h-[300px] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#14295F] opacity-20" /></div>
                  ) : calendarData.map((day, idx) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const log = allLogs?.find(l => l.dateKey === dateKey);
                    const minutes = log?.totalMinutes || 0;
                    const isCurrentMonth = isSameMonth(day, currentCalendarDate);
                    const isTodayCalendar = isSameDay(day, new Date());
                    const hasPlans = (weeklyPlans || []).some((plan) => plan.dateKey === dateKey);
                    const progressPercent = getFocusProgress(minutes);
                    const hour = Math.floor(minutes / 60);
                    const minuteRemainder = minutes % 60;

                    return (
                      <button
                        type="button"
                        key={dateKey}
                        onClick={() => setSelectedCalendarDate(day)}
                        className={cn(
                          "relative text-left border-r-2 border-b-2 border-[#14295F]/5 transition-all cursor-pointer group overflow-hidden",
                          isMobile ? "aspect-square p-1.5" : "min-h-[156px] p-3.5",
                          !isCurrentMonth ? "opacity-[0.14] grayscale bg-slate-100" : getHeatmapColor(minutes),
                          isTodayCalendar && "ring-4 ring-inset ring-[#FF7A16]/35 z-10 shadow-lg scale-[1.01] rounded-xl"
                        )}
                      >
                        {!isMobile && isCurrentMonth && minutes > 0 && (
                          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/35 to-transparent pointer-events-none" />
                        )}
                        <div className={cn("flex justify-between items-start", isMobile ? "mb-1" : "mb-2.5")}>
                          <span
                            className={cn(
                              "font-black tracking-tighter tabular-nums rounded-full",
                              isMobile ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1",
                              idx % 7 === 5 && isCurrentMonth ? "text-blue-700 bg-blue-50/90" : idx % 7 === 6 && isCurrentMonth ? "text-rose-700 bg-rose-50/90" : "text-[#14295F]/80 bg-white/85",
                              isTodayCalendar && "text-[#14295F] scale-110"
                            )}
                          >
                            {format(day, 'd')}
                          </span>
                          <div className="flex flex-col items-end gap-1">
                            {minutes >= 180 && <Zap className={cn("text-orange-500 fill-orange-500", isMobile ? "h-2.5 w-2.5" : "h-3.5 w-3.5")} />}
                            {hasPlans && <div className={cn("rounded-full bg-[#14295F]/35", isMobile ? "h-1.5 w-1.5" : "h-2 w-2")} />}
                          </div>
                        </div>
                        {isMobile ? (
                          <div className="absolute inset-x-0.5 bottom-1">
                            <div
                              className={cn(
                                "rounded-md border text-center font-mono font-black tabular-nums py-0.5 leading-tight text-[10px] tracking-tighter whitespace-nowrap",
                                minutes > 0 ? "text-[#14295F] bg-white/90 border-white/80 shadow-sm" : "text-slate-500 bg-white/75 border-white/60"
                              )}
                            >
                              {isCurrentMonth ? formatMinutes(minutes) : '--'}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2.5 flex flex-col gap-2">
                            {isCurrentMonth && minutes > 0 ? (
                              <>
                                <span className="dashboard-number text-2xl text-[#14295F]">
                                  {formatMinutes(minutes)}
                                </span>
                                <div className="h-1.5 w-full rounded-full bg-white/55 overflow-hidden">
                                  <div className="h-full rounded-full bg-[#14295F]/80" style={{ width: progressPercent + '%' }} />
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-black text-[#14295F]/85">
                                  <span>{progressPercent}% 吏묒쨷??/span>
                                  <span>{hour}?쒓컙 {minuteRemainder.toString().padStart(2, '0')}遺?/span>
                                </div>
                              </>
                            ) : (
                              <span className="mt-auto text-[11px] font-bold text-slate-500">湲곕줉 ?놁쓬</span>
                            )}
                          </div>
                        )}
                        {isTodayCalendar && (
                          <div className="absolute bottom-1 right-1">
                            <div className="bg-[#14295F] text-white p-0.5 rounded-full shadow-lg">
                              <Activity className="h-1.5 w-1.5" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Card>
              <div className="grid grid-cols-2 gap-3">
                <Card className="rounded-[1.5rem] border-none shadow-sm bg-white p-5 ring-1 ring-slate-100">
                  <CardTitle className="text-[10px] font-black tracking-tight mb-4 flex items-center gap-2 text-slate-500 uppercase">
                    <PieChartIcon className="h-3.5 w-3.5 text-[#FF7A16]" /> 怨쇰ぉ蹂??숈뒿 鍮꾩쨷
                  </CardTitle>
                  <div className="space-y-4">
                    {subjectsData.slice(0, 2).map((s) => {
                      const ratio = Math.min(100, Math.round((s.minutes / (subjectTotalMinutes || 1)) * 100));
                      return (
                        <div key={s.subject} className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                            <span>{s.subject}</span>
                            <span className="font-black">{ratio}%</span>
                          </div>
                          <Progress value={ratio} className="h-1 bg-slate-100" />
                        </div>
                      );
                    })}
                  </div>
                </Card>

                <Dialog>
                  <DialogTrigger asChild>
                    <Card className="rounded-[1.5rem] border border-orange-200 bg-orange-50 p-5 flex flex-col justify-center items-center text-center gap-2 cursor-pointer active:scale-95 transition-all">
                      <BarChart3 className="h-6 w-6 text-[#FF7A16]" />
                      <div className="grid gap-0.5 text-[#14295F]">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#B85A00]">二쇨컙 ?곸꽭</span>
                        <span className="text-xs font-black">?깃낵 ?곸꽭 遺꾩꽍</span>
                      </div>
                    </Card>
                  </DialogTrigger>
                  <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-lg">
                    <div className="bg-[#14295F] p-10 text-white relative">
                      <DialogTitle className="text-3xl font-black tracking-tighter text-left text-white">二쇨컙 ?깃낵 ?곗씠??/DialogTitle>
                      <DialogDescription className="text-white/70 font-bold mt-1 text-sm">理쒓렐 7?쇨컙???숈뒿 吏??諛??쇰뱶諛깆엯?덈떎.</DialogDescription>
                    </div>
                    <div className="p-8 space-y-10 bg-white overflow-y-auto max-h-[60vh] custom-scrollbar">
                      <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase text-[#14295F] tracking-[0.2em] ml-1">?쇰퀎 吏묒쨷 ?쒓컙 (遺?</h4>
                        <div className="h-48 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsLineChart data={dailyStudyTrend}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                              <XAxis dataKey="date" fontSize={10} fontWeight="800" axisLine={false} tickLine={false} />
                              <YAxis fontSize={10} fontWeight="800" axisLine={false} tickLine={false} width={30} />
                              <Tooltip contentStyle={{borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)'}} />
                              <Line type="monotone" dataKey="minutes" stroke="#FF7A16" strokeWidth={4} dot={{ r: 4, fill: '#fff', stroke: '#FF7A16', strokeWidth: 2 }} />
                            </RechartsLineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="p-6 rounded-[2rem] bg-orange-50/50 border border-orange-100">
                        <p className="text-[10px] font-black text-[#FF7A16] uppercase mb-2 tracking-widest">?좎깮??醫낇빀 ?쇰뱶諛?/p>
                        <p className="text-base font-bold text-slate-700 leading-relaxed">"{weeklyFeedback}"</p>
                      </div>
                    </div>
                    <DialogFooter className="p-6 bg-white border-t">
                      <DialogClose asChild><Button className="w-full h-14 rounded-2xl font-black text-lg bg-[#14295F] text-white">?뺤씤 ?꾨즺</Button></DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>

            <TabsContent value="data" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <Card
                className="rounded-[2rem] border border-rose-100 bg-rose-50/30 p-6 shadow-sm cursor-pointer"
                role="button"
                onClick={() => setIsPenaltyGuideOpen(true)}
              >
                <div className="flex items-center justify-between">
                  <div className="grid gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">?꾩쟻 踰뚯젏 吏??/span>
                    <h3 className="dashboard-number text-4xl text-rose-900">
                      {penaltyRecovery.effectivePoints}
                      <span className="ml-1 text-lg opacity-40">??/span>
                    </h3>
                    <p className="text-[11px] font-bold text-rose-700/80">
                      ?먯젏??{penaltyRecovery.basePoints}??쨌 ?뚮났 {penaltyRecovery.recoveredPoints}??
                    </p>
                  </div>
                  <Badge variant="outline" className={cn('h-8 rounded-full border px-4 text-xs font-black shadow-sm', penaltyMeta.badge)}>
                    {penaltyMeta.label}
                  </Badge>
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <RhythmTimeChartDialog
                  trend={dailyRhythmTrend}
                  hasTrend={hasRhythmTrend}
                  yAxisDomain={rhythmYAxisDomain}
                  rhythmScoreTrend={rhythmScoreTrend}
                  rhythmScore={rhythmScore}
                />

                <SubjectStudyChartDialog
                  subjects={subjectsData}
                  subjectTotalMinutes={subjectTotalMinutes}
                />
              </div>

              <div className="space-y-3 px-1">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-slate-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">理쒓렐 ?앺솢/異쒓껐 ?댁뒋</span>
                </div>
                <div className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">理쒓렐 怨듬??쇱옄</p>
                    <p className="mt-1 text-sm font-black text-slate-800">{recentLifeAttendanceSummary.recentStudyDate}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">怨듬? ?쒖옉 ?쒓컖</p>
                    <p className="mt-1 text-sm font-black text-slate-800">{recentLifeAttendanceSummary.recentStudyStart}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">?몄텧 ?щ?</p>
                    <p className="mt-1 text-sm font-black text-slate-800">{recentLifeAttendanceSummary.awayStatus}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">?댁떎 ?щ?</p>
                    <p className="mt-1 text-sm font-black text-slate-800">{recentLifeAttendanceSummary.checkOutStatus}</p>
                  </div>
                </div>
                {recentPenaltyReasons.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-center text-xs font-bold text-slate-400">
                    湲곕줉???뱀씠?ы빆???놁뒿?덈떎.
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {recentPenaltyReasons.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:border-rose-200">
                        <div className="grid gap-1">
                          <span className="text-sm font-bold text-slate-800">{r.reason}</span>
                          <span className="text-[10px] font-black text-slate-400">{r.dateLabel} 쨌 洹쒖젙 以???덈궡</span>
                        </div>
                        <Badge variant="outline" className="border-none bg-rose-100 px-3 py-1 text-xs font-black text-rose-700">
                          <span className="font-numeric">+{r.points}</span>??
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="communication" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-slate-100">
                <CardTitle className="text-lg font-black tracking-tighter mb-6 flex items-center gap-2 text-[#14295F]"><Send className="h-5 w-5 text-[#14295F]" /> ?곷떞 諛?吏???붿껌</CardTitle>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">?곷떞 梨꾨꼸</Label>
                    <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold text-sm shadow-sm"><SelectValue placeholder="?곷떞 梨꾨꼸 ?좏깮" /></SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="visit" className="font-bold py-3 text-sm">?룶 ?쇳꽣 諛⑸Ц ?곷떞</SelectItem>
                        <SelectItem value="phone" className="font-bold py-3 text-sm">?뱸 ?꾪솕 ?곷떞</SelectItem>
                        <SelectItem value="online" className="font-bold py-3 text-sm">?뮲 ?⑤씪???곷떞</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">?곷떞 ?댁슜</Label>
                    <Textarea className="min-h-[120px] rounded-[1.5rem] border-2 font-bold p-4 text-sm shadow-inner" value={requestText} onChange={(e) => setRequestText(e.target.value)} placeholder="?먮????숈뒿?대굹 ?앺솢?????沅곴툑?섏떊 ?먯쓣 ?먯쑀濡?쾶 ?낅젰??二쇱꽭??" />
                  </div>
                  <Button className="w-full h-16 rounded-[1.5rem] bg-[#14295F] text-white font-black text-lg shadow-xl shadow-[#14295F]/20 active:scale-[0.98] transition-all" onClick={() => submit('consultation')} disabled={submitting}>?붿껌 蹂대궡湲?/Button>
                </div>
              </Card>

              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-slate-100">
                <CardTitle className="text-lg font-black tracking-tighter mb-2 flex items-center gap-2 text-[#14295F]">
                  <MessageCircle className="h-5 w-5 text-[#FF7A16]" />
                  嫄댁쓽?ы빆 쨌 吏덉쓽 쨌 ?붿껌?ы빆
                </CardTitle>
                <CardDescription className="mb-6 font-bold text-sm text-slate-500">
                  ?숇?紐⑤떂???④릿 ?댁슜???좎깮???먮뒗 ?쇳꽣愿由ъ옄媛 ?뺤씤?섍퀬 ?듬??쒕┰?덈떎.
                </CardDescription>
                <div className="space-y-4">
                  <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-[180px_minmax(0,1fr)]')}>
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">?좏삎 ?좏깮</Label>
                      <Select value={parentInquiryType} onValueChange={(value: 'question' | 'request' | 'suggestion') => setParentInquiryType(value)}>
                        <SelectTrigger className="h-12 rounded-xl border-2 font-bold text-sm shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          <SelectItem value="question" className="font-bold py-3 text-sm">吏덉쓽?ы빆</SelectItem>
                          <SelectItem value="request" className="font-bold py-3 text-sm">?붿껌?ы빆</SelectItem>
                          <SelectItem value="suggestion" className="font-bold py-3 text-sm">嫄댁쓽?ы빆</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid min-w-0 gap-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">?쒕ぉ</Label>
                      <Input
                        className="h-12 w-full rounded-xl border-2 font-bold text-sm shadow-sm"
                        value={parentInquiryTitle}
                        onChange={(e) => setParentInquiryTitle(e.target.value)}
                        placeholder={
                          parentInquiryType === 'question'
                            ? '?? ?꾩씠 ?숈젣 吏꾪뻾 諛⑹떇??沅곴툑?⑸땲??
                            : parentInquiryType === 'request'
                              ? '?? ?곷떞 ?쇱젙 議곗젙 ?붿껌'
                              : '?? ???뚮┝ 諛⑹떇 媛쒖꽑 嫄댁쓽'
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">?댁슜</Label>
                    <Textarea
                      className="min-h-[140px] rounded-[1.5rem] border-2 font-bold p-4 text-sm shadow-inner"
                      value={parentInquiryBody}
                      onChange={(e) => setParentInquiryBody(e.target.value)}
                      placeholder={
                        parentInquiryType === 'question'
                          ? '沅곴툑?섏떊 ?먯쓣 ?먯꽭???④꺼 二쇱꽭??'
                          : parentInquiryType === 'request'
                            ? '?꾩슂???붿껌 ?댁슜??援ъ껜?곸쑝濡??곸뼱 二쇱꽭??'
                            : '媛쒖꽑?섎㈃ 醫뗭쓣 ?먯씠??嫄댁쓽?ы빆???④꺼 二쇱꽭??'
                      }
                    />
                  </div>
                  <Button
                    className="w-full h-14 rounded-[1.5rem] bg-[#FF7A16] text-white font-black text-base shadow-xl shadow-[#FF7A16]/20 active:scale-[0.98] transition-all"
                    onClick={submitParentInquiry}
                    disabled={submitting || !parentInquiryBody.trim()}
                  >
                    ?꾨떖?섍린
                  </Button>
                </div>
              </Card>

              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-slate-100">
                <CardTitle className="text-lg font-black tracking-tighter mb-2 flex items-center gap-2 text-[#14295F]">
                  <Bell className="h-5 w-5 text-[#14295F]" />
                  臾몄쓽 ?댁뿭怨??듬?
                </CardTitle>
                <CardDescription className="mb-6 font-bold text-sm text-slate-500">
                  理쒓렐 臾몄쓽 ?댁뿭怨??좎깮???쇳꽣愿由ъ옄???듬????ш린??諛붾줈 ?뺤씤?????덉뼱??
                </CardDescription>

                {parentCommunicationsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                  </div>
                ) : parentCommunications.length === 0 ? (
                  <div className="rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50/60 py-16 text-center">
                    <p className="text-sm font-black text-slate-400">?깅줉??臾몄쓽 ?댁뿭???놁뒿?덈떎.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {parentCommunications.map((item) => {
                      const createdAt = item.createdAt?.toDate?.() || item.updatedAt?.toDate?.();
                      const repliedAt = item.repliedAt?.toDate?.();
                      return (
                        <div key={item.id} className="rounded-[1.75rem] border border-slate-100 bg-slate-50/50 p-5 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {getParentCommunicationTypeBadge(item)}
                                {getParentCommunicationStatusBadge(item.status)}
                              </div>
                              <h3 className="text-base font-black text-[#14295F]">{item.title || '?숇?紐?臾몄쓽'}</h3>
                              <p className="text-[11px] font-bold text-slate-400">
                                {createdAt ? format(createdAt, 'yyyy.MM.dd HH:mm') : '?쒓컙 ?뺣낫 ?놁쓬'}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
                            <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-slate-700">
                              {item.body?.trim() || '?댁슜???놁뒿?덈떎.'}
                            </p>
                          </div>

                          {item.replyBody ? (
                            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                              <p className="mb-1 text-[10px] font-black text-emerald-700">
                                {'\uB2F5\uBCC0'}
                                {item.repliedByName ? ` \u00B7 ${item.repliedByName}` : ''}
                                {repliedAt ? ` \u00B7 ${format(repliedAt, 'yyyy.MM.dd HH:mm')}` : ''}
                              </p>
                              <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-emerald-900">
                                {item.replyBody}
                              </p>
                            </div>
                          ) : (
                            <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-[11px] font-bold text-slate-400">
                              ?꾩쭅 ?듬????깅줉?섏? ?딆븯?듬땲??
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <Card className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h3 className="text-4xl font-black tracking-tight text-[#14295F] leading-none">?섎궔</h3>
                      <p className="text-[15px] font-bold text-slate-700 leading-snug">
                        <span className="block">?쇳꽣?섎궔?붿껌嫄댁쓣 鍮꾨?硫댁쑝濡?/span>
                        <span className="block">寃곗젣?????덉뼱??</span>
                      </p>
                    </div>
                    <span className="shrink-0 text-[14px] font-black text-[#14295F]">?ㅼ떆媛??곕룞</span>
                  </div>

                  {isMobile ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-black text-[#14295F]">泥?뎄湲덉븸</p>
                        {mobileBillingStatusMeta && (
                          <Badge variant="outline" className={cn('h-6 border px-2 text-[11px] font-black', mobileBillingStatusMeta.className)}>
                            {mobileBillingStatusMeta.label}
                          </Badge>
                        )}
                      </div>
                      <p className="dashboard-number mt-2 text-[1.05rem] leading-none text-[#14295F] whitespace-nowrap">
                        {formatWon(billingSummary.billed)}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3.5 text-center shadow-sm">
                        <p className="text-[12px] font-black text-[#14295F]">泥?뎄</p>
                        <p className="dashboard-number mt-1 text-[1.2rem] leading-none text-[#14295F] whitespace-nowrap">
                          {formatWon(billingSummary.billed)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 px-3 py-3.5 text-center shadow-sm">
                        <p className="text-[12px] font-black text-emerald-700">?섎궔</p>
                        <p className="dashboard-number mt-1 text-[1.2rem] leading-none text-emerald-700 whitespace-nowrap">
                          {formatWon(billingSummary.paid)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-rose-200 bg-rose-50/40 px-3 py-3.5 text-center shadow-sm">
                        <p className="text-[12px] font-black text-rose-700">誘몃궔</p>
                        <p className="dashboard-number mt-1 text-[1.2rem] leading-none text-rose-700 whitespace-nowrap">
                          {formatWon(billingSummary.overdue)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {latestInvoice ? (
                <div className="space-y-3">
                  {displayInvoices.map((invoice) => {
                    const invoiceDueDate = toDateSafe((invoice as any).cycleEndDate);
                    const statusMeta = getInvoiceStatusMeta(invoice.status);

                    return (
                      <Card key={invoice.id} className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm">
                        <div className={cn("flex justify-between gap-3", isMobile ? "items-center" : "items-start")}>
                          <div className="space-y-2 min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <p className={cn("font-black tracking-tight text-[#14295F] min-w-0 truncate whitespace-nowrap", isMobile ? "text-[1.45rem] leading-none" : "text-[20px]")}>
                                {invoice.studentName || student?.name || '?숈깮'}
                              </p>
                              <Badge variant="outline" className="h-6 border border-slate-200 bg-slate-50 px-2 text-[10px] font-black text-slate-600">
                                {getInvoiceTrackLabel(invoice.trackCategory)}
                              </Badge>
                              {statusMeta && (
                                <Badge variant="outline" className={cn('h-6 border px-2 text-[10px] font-black shrink-0', statusMeta.className)}>
                                  {isMobile ? statusMeta.mobileLabel : statusMeta.label}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[15px] font-bold text-slate-600">
                              寃곗젣 留덇컧??{invoiceDueDate ? format(invoiceDueDate, 'yyyy.MM.dd', { locale: ko }) : '-'}
                            </p>
                          </div>
                          <p className={cn("dashboard-number leading-none text-[#14295F] whitespace-nowrap shrink-0", isMobile ? "text-[1.9rem]" : "text-[2.05rem]")}>
                            {formatWon(Number(invoice.finalPrice || 0))}
                          </p>
                        </div>

                        {(invoice.status === 'issued' || invoice.status === 'overdue') && (
                          <Link
                            href={`/payment/checkout/${invoice.id}`}
                            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#14295F] text-[15px] font-black text-white shadow-sm transition-colors hover:bg-[#10224f]"
                          >
                            <CreditCard className="h-4 w-4" />
                            寃곗젣?섍린
                          </Link>
                        )}
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[14px] font-bold text-slate-500">?꾩옱 諛쒗뻾???몃낫?댁뒪媛 ?놁뒿?덈떎.</p>
                </Card>
              )}

              <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50/50 px-4 py-3">
                <p className="text-[15px] font-black text-emerald-700">媛먯궗?⑸땲?? 理쒖꽑???ㅽ빐 愿由ы븯寃좎뒿?덈떎!</p>
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="mt-0 space-y-3 animate-in fade-in duration-500">
              {notifications.length === 0 ? (
                <div className="py-32 text-center opacity-20 italic font-black text-slate-400 flex flex-col items-center gap-4">
                  <Bell className="h-16 w-16" /> <span className="text-sm uppercase tracking-widest">?덈줈???뚮┝???놁뒿?덈떎.</span>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={cn(
                      'w-full rounded-2xl border bg-white p-5 text-left transition-all active:scale-[0.98]',
                      !(n.isRead || readMap[n.id]) ? 'border-[#14295F]/20 shadow-lg ring-1 ring-[#14295F]/5' : 'border-slate-100 opacity-60'
                    )}
                    onClick={() => void openNotificationDetail(n)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{n.createdAtLabel}</span>
                      {n.isImportant && <Badge variant="outline" className="bg-orange-100 text-[#FF7A16] border-none font-black text-[10px] h-5 px-2">以묒슂</Badge>}
                    </div>
                    <p className="text-base font-black text-[#14295F] tracking-tight">{n.title}</p>
                  </button>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isReportArchiveOpen} onOpenChange={setIsReportArchiveOpen}>
        <DialogContent className={cn("overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl flex flex-col", isMobile ? "fixed left-1/2 top-1/2 w-[94vw] h-[82vh] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[1.5rem]" : "sm:max-w-4xl max-h-[90vh]")}>
          <div className="bg-[#14295F] p-6 text-white">
            <DialogTitle className="text-xl font-black tracking-tight">?곕━ ?꾩씠 ?숈뒿 由ы룷??/DialogTitle>
            <DialogDescription className="mt-1 text-xs font-bold text-white/70">諛쏆? 由ы룷?몃? ?좎쭨蹂꾨줈 ?뺤씤?????덉뼱??</DialogDescription>
          </div>
          <div className={cn("bg-white min-h-0 flex-1", isMobile ? "space-y-3 p-4 overflow-y-auto" : "grid grid-cols-[260px_1fr] gap-4 p-6")}>
            <div className={cn("space-y-2", isMobile ? "max-h-[220px] overflow-y-auto" : "max-h-[62vh] overflow-y-auto pr-1")}>
              {reportsArchive.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-xs font-bold text-slate-400">
                  ?꾩쭅 諛쏆? 由ы룷?멸? ?놁뒿?덈떎.
                </div>
              ) : (
                reportsArchive.map((item) => {
                  const isActiveItem = selectedChildReport?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void handleSelectChildReport(item)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2.5 text-left transition-all",
                        isActiveItem ? "border-[#14295F] bg-[#EEF4FF]" : "border-slate-200 bg-white hover:bg-slate-50"
                      )}
                    >
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.dateKey || '-'}</p>
                      <p className="mt-1 line-clamp-2 text-xs font-bold text-slate-700">{item.content || '由ы룷???댁슜 ?놁쓬'}</p>
                    </button>
                  );
                })
              )}
            </div>
            <div className={cn("rounded-xl border border-slate-200 bg-slate-50", isMobile ? "max-h-[42vh] overflow-y-auto p-4" : "max-h-[62vh] overflow-y-auto p-5")}>
              {selectedChildReport ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black uppercase tracking-widest text-[#14295F]/60">{selectedChildReport.dateKey}</p>
                    <Badge variant="outline" className="h-5 border-slate-200 bg-white px-2 text-[10px] font-black text-slate-600">
                      {selectedChildReport.viewedAt ? '?쎌쓬' : '??由ы룷??}
                    </Badge>
                  </div>
                  <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-slate-800">
                    {selectedChildReport.content || '由ы룷???댁슜???놁뒿?덈떎.'}
                  </p>
                </div>
              ) : (
                <div className="flex h-full min-h-[180px] items-center justify-center text-center text-sm font-bold text-slate-400">
                  ?쇱そ?먯꽌 由ы룷?몃? ?좏깮??二쇱꽭??
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPenaltyGuideOpen} onOpenChange={setIsPenaltyGuideOpen}>
        <DialogContent className="overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-lg">
          <div className="bg-gradient-to-r from-rose-600 to-rose-500 p-6 text-white">
            <DialogTitle className="text-xl font-black tracking-tight">踰뚯젏 ?꾪솴 ?덈궡</DialogTitle>
            <DialogDescription className="mt-1 text-xs font-bold text-white/80">
              踰뚯젏 遺??湲곗?, ?꾩쟻 ?④퀎, ?먮룞 ?뚮났 洹쒖튃
            </DialogDescription>
          </div>

          <div className="space-y-3 bg-white p-6">
            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-rose-600">踰뚯젏 遺??湲곗?</p>
              <div className="mt-2 space-y-1.5 text-sm font-bold text-slate-700">
                <p>吏媛?異쒖꽍: +{REQUEST_PENALTY_POINTS.late}??/p>
                <p>寃곗꽍: +{REQUEST_PENALTY_POINTS.absence}??/p>
                <p>猷⑦떞 誘몄옉?? +{ROUTINE_MISSING_PENALTY_POINTS}??/p>
                <p>?쇳꽣 ?섎룞 遺?? 愿由ъ옄媛 ?ㅼ젙???먯닔</p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-amber-700">?꾩쟻 ?④퀎 湲곗?</p>
              <div className="mt-2 space-y-1.5 text-sm font-bold text-slate-700">
                <p>7???댁긽: ?좎깮?섍낵 ?곷떞</p>
                <p>12???댁긽: ?숇?紐??곷떞</p>
                <p>20???댁긽: ?댁썝</p>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700">?먮룞 ?뚮났 洹쒖튃</p>
              <div className="mt-2 space-y-1.5 text-sm font-bold text-slate-700">
                <p>理쒓렐 踰뚯젏 ?댄썑 {PENALTY_RECOVERY_INTERVAL_DAYS}???숈븞 ?좉퇋 踰뚯젏???놁쑝硫?1???뚮났</p>
                <p>?꾩옱 ?먯젏??{penaltyRecovery.basePoints}??쨌 ?뚮났 {penaltyRecovery.recoveredPoints}??쨌 ?곸슜 {penaltyRecovery.effectivePoints}??/p>
                <p>理쒓렐 踰뚯젏 諛섏쁺?? {penaltyRecovery.latestPositiveDateLabel}</p>
              </div>
            </div>


            <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-widest text-rose-700">{'\uBC8C\uC810 \uC774\uB825'}</p>
                <Badge variant="outline" className="h-6 border-rose-200 bg-white px-2 text-[10px] font-black text-rose-700">{penaltyHistoryItems.length}{'\uAC74'}</Badge>
              </div>
              {penaltyHistoryItems.length === 0 ? (
                <p className="mt-3 text-sm font-bold text-slate-500">{'\uCD5C\uADFC \uBC8C\uC810 \uC774\uB825\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'}</p>
              ) : (
                <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
                  {penaltyHistoryItems.map((item) => (
                    <div key={item.id} className="rounded-xl border border-rose-100 bg-white/90 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.dateLabel}</p>
                        <Badge variant="outline" className={cn('h-5 border-none px-2 text-[10px] font-black', item.pointsDelta > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700')}>
                          {item.pointsDelta > 0 ? `+${item.pointsDelta}${'\uC810'}` : `${item.pointsDelta}${'\uC810'}`}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs font-bold text-slate-700">{item.reason}</p>
                      <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-slate-400">{item.sourceLabel}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">?꾩옱 議곗튂 ?④퀎</p>
              <Badge variant="outline" className={cn('mt-2 h-7 rounded-full border px-3 text-xs font-black', penaltyMeta.badge)}>{penaltyMeta.label}</Badge>
            </div>
          </div>

          <DialogFooter className="border-t bg-white p-4">
            <DialogClose asChild>
              <Button className="h-11 w-full rounded-xl bg-[#14295F] text-sm font-black">?뺤씤</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedNotification} onOpenChange={(open) => { if (!open) setSelectedNotification(null); }}>
        <DialogContent className="overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-md">
          <div className="bg-[#14295F] p-6 text-white">
            <DialogTitle className="text-xl font-black tracking-tight">?뚮┝ ?곸꽭</DialogTitle>
            <DialogDescription className="mt-1 text-xs font-bold text-white/70">
              {selectedNotification?.createdAtLabel || '理쒓렐'} 쨌 ?쎌쓬 ?뺤씤 媛??
            </DialogDescription>
          </div>
          <div className="space-y-4 bg-white p-6">
            <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-base font-black tracking-tight text-[#14295F]">{selectedNotification?.title}</p>
                {selectedNotification?.isImportant && (
                  <Badge variant="outline" className="h-5 border-none bg-orange-100 px-2 text-[10px] font-black text-[#FF7A16]">以묒슂</Badge>
                )}
              </div>
              <p className="whitespace-pre-line text-sm font-bold leading-relaxed text-slate-700">{selectedNotification?.body}</p>
            </div>
            {selectedNotification && (
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600">
                {(selectedNotification.isRead || readMap[selectedNotification.id]) ? '?쎌쓬 ?뺤씤?? : '誘명솗???뚮┝'}
              </p>
            )}
          </div>
          <DialogFooter className="border-t bg-white p-4">
            <DialogClose asChild>
              <Button className="h-11 w-full rounded-xl bg-[#14295F] text-sm font-black">?リ린</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedCalendarDate} onOpenChange={(open) => { if (!open) setSelectedCalendarDate(null); }}>
        <DialogContent className="overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-lg">
          <div className="bg-gradient-to-r from-[#14295F] to-[#1f3e87] p-6 text-white">
            <DialogTitle className="text-xl font-black tracking-tight">
              {selectedCalendarDate ? format(selectedCalendarDate, 'yyyy.MM.dd (EEE)', { locale: ko }) : '?좎쭨 ?곸꽭'}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs font-bold text-white/70">?대떦 ?좎쭨???숈뒿 ?곗씠???붿빟</DialogDescription>
          </div>
          <div className="space-y-4 bg-white p-6">
            <div className="grid grid-cols-2 gap-2">
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">怨듬? ?쒓컙</p>
                <p className="dashboard-number mt-1 text-xl text-[#14295F]">{toHm(selectedDateLog?.totalMinutes || 0)}</p>
              </Card>
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">怨꾪쉷 ?ъ꽦</p>
                <p className="dashboard-number mt-1 text-xl text-[#FF7A16]">{selectedDatePlanRate}%</p>
              </Card>
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">?띾뱷 ?ъ씤??/p>
                <p className="dashboard-number mt-1 text-xl text-emerald-600">{selectedDateLp.toLocaleString()}??/p>
              </Card>
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">異쒓껐 ?붿껌</p>
                <p className="mt-1 text-sm font-black text-[#14295F]">
                  {selectedDateRequest ? (selectedDateRequest.type === 'late' ? '吏媛??좎껌' : '寃곗꽍 ?좎껌') : '湲곕줉 ?놁쓬'}
                </p>
              </Card>
            </div>

            <Card className="rounded-xl border border-slate-100 p-4 shadow-none">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">?숈뒿 怨꾪쉷 ?댁뿭</p>
                <Badge variant="outline" className="h-5 border border-slate-200 bg-slate-50 px-2 text-[10px] font-black text-slate-500">
                  {selectedDatePlanDone}/{selectedDatePlanTotal}
                </Badge>
              </div>
              {isSelectedDatePlansLoading ? (
                <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-300" /></div>
              ) : selectedDateStudyPlans.length === 0 ? (
                <p className="py-6 text-center text-xs font-bold text-slate-400">?깅줉???숈뒿 怨꾪쉷???놁뒿?덈떎.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedDateStudyPlans.slice(0, 6).map((plan) => (
                    <div key={plan.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <p className="line-clamp-1 text-xs font-bold text-slate-700">{plan.title}</p>
                      <Badge variant="outline" className={cn('h-5 border-none px-2 text-[10px] font-black', plan.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600')}>
                        {plan.done ? '?꾨즺' : '吏꾪뻾以?}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
          <DialogFooter className="border-t bg-white p-4">
            <DialogClose asChild>
              <Button className="h-11 w-full rounded-xl bg-[#14295F] text-sm font-black">?뺤씤</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50/50 px-6 py-4 flex items-start gap-3 mx-1">
        <Info className="h-4 w-4 text-[#14295F] mt-0.5 shrink-0" />
        <p className="text-[10px] font-bold text-[#14295F]/70 leading-relaxed break-keep">
          ?숇?紐?紐⑤뱶???ㅼ떆媛?議고쉶 ?꾩슜?낅땲?? ?뺣낫 ?섏젙?대굹 ?곸꽭 ?ㅼ젙 蹂寃쎌? ?쇳꽣 愿由ъ옄 ?먮뒗 ?먮? 怨꾩젙???듯빐 媛?ν빀?덈떎.
        </p>
      </div>
    </div>
  );
}
