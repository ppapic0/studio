'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import {
  AttendanceCurrent,
  CenterMembership,
  PaymentRecord,
  StudentProfile,
  StudyLogDay,
  StudySession,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Activity,
  Armchair,
  BarChart3,
  Clock3,
  Loader2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { eachDayOfInterval, format, subDays } from 'date-fns';

type TimestampLike = { toDate?: () => Date } | Date | string | null | undefined;

function toDateSafe(value: TimestampLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function createEmptyHourBuckets() {
  return Array.from({ length: 24 }, () => 0);
}

function addMinutesToHourBuckets(buckets: number[], start: Date, end: Date) {
  if (!(start instanceof Date) || !(end instanceof Date)) return;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
  if (start >= end) return;

  let cursor = new Date(start);
  while (cursor < end) {
    const hourStart = new Date(cursor);
    hourStart.setMinutes(0, 0, 0);

    const nextHour = new Date(hourStart);
    nextHour.setHours(hourStart.getHours() + 1);

    const segmentEnd = end < nextHour ? end : nextHour;
    const minutes = Math.max(0, (segmentEnd.getTime() - cursor.getTime()) / 60000);
    buckets[hourStart.getHours()] += minutes;
    cursor = segmentEnd;
  }
}

function toPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatWon(value: number) {
  return `${Math.round(value || 0).toLocaleString('ko-KR')}??;
}

export function OperationalIntelligence() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;

  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('status', '==', 'active'));
  }, [firestore, centerId]);
  const { data: allMembers, isLoading: membersLoading } = useCollection<CenterMembership>(membersQuery);

  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery);

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'students');
  }, [firestore, centerId]);
  const { data: studentProfiles, isLoading: studentsLoading } = useCollection<StudentProfile>(studentsQuery);

  const paymentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'payments'),
      orderBy('processedAt', 'desc'),
      limit(400)
    );
  }, [firestore, centerId]);
  const { data: payments, isLoading: paymentsLoading } = useCollection<PaymentRecord>(paymentsQuery);

  const [studyMinutesByStudent, setStudyMinutesByStudent] = useState<Record<string, number>>({});
  const [dailyStudyMinutesByDate, setDailyStudyMinutesByDate] = useState<Record<string, number>>({});
  const [todaySessionMinutesByHour, setTodaySessionMinutesByHour] = useState<number[]>(createEmptyHourBuckets());
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    let disposed = false;

    if (!firestore || !centerId || !allMembers) {
      setStudyMinutesByStudent({});
      setDailyStudyMinutesByDate({});
      setTodaySessionMinutesByHour(createEmptyHourBuckets());
      return;
    }

    const students = allMembers.filter((member) => member.role === 'student' && member.status === 'active');
    if (students.length === 0) {
      setStudyMinutesByStudent({});
      setDailyStudyMinutesByDate({});
      setTodaySessionMinutesByHour(createEmptyHourBuckets());
      return;
    }

    const loadStudyAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const now = new Date();
        const todayKey = format(now, 'yyyy-MM-dd');
        const from30DaysKey = format(subDays(now, 29), 'yyyy-MM-dd');
        const trendDateKeys = eachDayOfInterval({
          start: subDays(now, 13),
          end: now,
        }).map((date) => format(date, 'yyyy-MM-dd'));

        const minutesByStudent: Record<string, number> = {};
        const minutesByDate = trendDateKeys.reduce<Record<string, number>>((acc, key) => {
          acc[key] = 0;
          return acc;
        }, {});
        const hourlyMinutes = createEmptyHourBuckets();

        await Promise.all(
          students.map(async (student) => {
            const daysRef = collection(firestore, 'centers', centerId, 'studyLogs', student.id, 'days');
            const daysSnap = await getDocs(query(daysRef, where('dateKey', '>=', from30DaysKey)));

            let studentTotalMinutes = 0;
            let hasTodayLog = false;

            daysSnap.forEach((snap) => {
              const data = snap.data() as Partial<StudyLogDay>;
              const dateKey = typeof data.dateKey === 'string' ? data.dateKey : snap.id;
              const minutes = Number(data.totalMinutes || 0);
              if (!Number.isFinite(minutes) || minutes <= 0) return;

              studentTotalMinutes += minutes;
              if (Object.prototype.hasOwnProperty.call(minutesByDate, dateKey)) {
                minutesByDate[dateKey] += minutes;
              }
              if (dateKey === todayKey) hasTodayLog = true;
            });

            minutesByStudent[student.id] = studentTotalMinutes;

            if (!hasTodayLog) return;

            const sessionsRef = collection(
              firestore,
              'centers',
              centerId,
              'studyLogs',
              student.id,
              'days',
              todayKey,
              'sessions'
            );
            const sessionsSnap = await getDocs(sessionsRef);
            sessionsSnap.forEach((sessionDoc) => {
              const session = sessionDoc.data() as Partial<StudySession>;
              const startTime = toDateSafe(session.startTime as TimestampLike);
              const endTime = toDateSafe(session.endTime as TimestampLike);
              if (!startTime || !endTime) return;
              addMinutesToHourBuckets(hourlyMinutes, startTime, endTime);
            });
          })
        );

        if (!disposed) {
          setStudyMinutesByStudent(minutesByStudent);
          setDailyStudyMinutesByDate(minutesByDate);
          setTodaySessionMinutesByHour(hourlyMinutes);
        }
      } catch (error) {
        console.error('Operational analytics aggregation failed:', error);
        if (!disposed) {
          setStudyMinutesByStudent({});
          setDailyStudyMinutesByDate({});
          setTodaySessionMinutesByHour(createEmptyHourBuckets());
        }
      } finally {
        if (!disposed) {
          setAnalyticsLoading(false);
        }
      }
    };

    loadStudyAnalytics();
    return () => {
      disposed = true;
    };
  }, [firestore, centerId, allMembers]);

  const opsMetrics = useMemo(() => {
    if (!allMembers || !attendanceList) return null;

    const activeStudents = allMembers.filter((member) => member.role === 'student' && member.status === 'active');
    const activeTeachers = allMembers.filter(
      (member) => (member.role === 'teacher' || member.role === 'centerAdmin') && member.status === 'active'
    );
    const studentCount = activeStudents.length;
    const teacherCount = Math.max(1, activeTeachers.length);
    const studentTeacherRatio = Number((studentCount / teacherCount).toFixed(1));

    const totalSeats = Math.max(1, attendanceList.filter((seat) => seat.type !== 'aisle').length);
    const occupiedSeats = attendanceList.filter((seat) => seat.type !== 'aisle' && seat.status === 'studying').length;
    const currentOccupancyRate = toPercent((occupiedSeats / totalSeats) * 100);

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const mergedHourlyMinutes = [...todaySessionMinutesByHour];
    attendanceList.forEach((seat) => {
      if (seat.type === 'aisle' || seat.status !== 'studying') return;
      const checkInAt = toDateSafe(seat.lastCheckInAt as TimestampLike);
      if (!checkInAt) return;
      const clampedStart = checkInAt < todayStart ? todayStart : checkInAt;
      if (clampedStart >= now) return;
      addMinutesToHourBuckets(mergedHourlyMinutes, clampedStart, now);
    });

    const displayHours = Array.from({ length: 15 }, (_, index) => index + 9);
    const occupancyByHour = displayHours.map((hour) => {
      const minuteLoad = mergedHourlyMinutes[hour] || 0;
      const occupancyRate = toPercent((minuteLoad / (totalSeats * 60)) * 100);
      return {
        hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        occupancyRate,
      };
    });

    const recentStart = new Date(subDays(now, 29));
    recentStart.setHours(0, 0, 0, 0);
    const revenueByHourBuckets = createEmptyHourBuckets();
    let totalRecentRevenue = 0;

    (payments || []).forEach((payment) => {
      if (payment.status && payment.status !== 'success') return;
      const processedAt = toDateSafe(payment.processedAt as TimestampLike);
      if (!processedAt || processedAt < recentStart) return;
      const amount = Number(payment.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) return;
      revenueByHourBuckets[processedAt.getHours()] += amount;
      totalRecentRevenue += amount;
    });

    const revenueByHour = displayHours.map((hour) => ({
      hour,
      label: `${String(hour).padStart(2, '0')}:00`,
      amount: Math.round(revenueByHourBuckets[hour] || 0),
    }));

    const studentProfileMap = new Map((studentProfiles || []).map((profile) => [profile.id, profile]));
    let totalStudyMinutes30d = 0;
    let totalTargetMinutes = 0;
    let ratioAccumulator = 0;

    activeStudents.forEach((student) => {
      const totalMinutes = Number(studyMinutesByStudent[student.id] || 0);
      const targetDailyMinutes = Number(studentProfileMap.get(student.id)?.targetDailyMinutes || 180);
      const safeTargetMinutes = Number.isFinite(targetDailyMinutes) && targetDailyMinutes > 0 ? targetDailyMinutes : 180;
      const dailyAverageMinutes = totalMinutes / 30;

      totalStudyMinutes30d += totalMinutes;
      totalTargetMinutes += safeTargetMinutes;
      ratioAccumulator += (dailyAverageMinutes / safeTargetMinutes) * 100;
    });

    const averageDailyStudyMinutes = studentCount > 0 ? Math.round(totalStudyMinutes30d / studentCount / 30) : 0;
    const averageTargetMinutes = studentCount > 0 ? totalTargetMinutes / studentCount : 180;
    const averageStudyRatio = studentCount > 0 ? toPercent(ratioAccumulator / studentCount) : 0;

    const trendDates = eachDayOfInterval({ start: subDays(now, 13), end: now });
    const studyRatioTrend = trendDates.map((date) => {
      const key = format(date, 'yyyy-MM-dd');
      const totalMinutes = Number(dailyStudyMinutesByDate[key] || 0);
      const avgMinutes = studentCount > 0 ? totalMinutes / studentCount : 0;
      const ratio = averageTargetMinutes > 0 ? toPercent((avgMinutes / averageTargetMinutes) * 100) : 0;
      return {
        dateKey: key,
        label: format(date, 'M/d'),
        ratio,
        avgMinutes: Math.round(avgMinutes),
      };
    });

    const peakOccupancySlot = occupancyByHour.reduce(
      (best, slot) => (slot.occupancyRate > best.occupancyRate ? slot : best),
      occupancyByHour[0] || { hour: 9, label: '09:00', occupancyRate: 0 }
    );
    const lowOccupancySlot = occupancyByHour.reduce(
      (best, slot) => (slot.occupancyRate < best.occupancyRate ? slot : best),
      occupancyByHour[0] || { hour: 9, label: '09:00', occupancyRate: 0 }
    );
    const peakRevenueSlot = revenueByHour.reduce(
      (best, slot) => (slot.amount > best.amount ? slot : best),
      revenueByHour[0] || { hour: 9, label: '09:00', amount: 0 }
    );

    const lastStudyRatio = studyRatioTrend[studyRatioTrend.length - 1]?.ratio ?? 0;
    const prevStudyRatio = studyRatioTrend[studyRatioTrend.length - 2]?.ratio ?? 0;
    const studyTrendDelta = lastStudyRatio - prevStudyRatio;

    return {
      studentTeacherRatio,
      currentOccupancyRate,
      occupiedSeats,
      totalSeats,
      occupancyByHour,
      peakOccupancySlot,
      lowOccupancySlot,
      revenueByHour,
      peakRevenueSlot,
      totalRecentRevenue,
      averageStudyRatio,
      averageDailyStudyMinutes,
      averageTargetMinutes: Math.round(averageTargetMinutes),
      studyRatioTrend,
      studyTrendDelta,
    };
  }, [allMembers, attendanceList, dailyStudyMinutesByDate, payments, studyMinutesByStudent, studentProfiles, todaySessionMinutesByHour]);

  const isLoading = membersLoading || attendanceLoading || studentsLoading || paymentsLoading || analyticsLoading;

  if (isLoading) {
    return (
      <div className="py-40 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" />
        <p className="text-[10px] font-black tracking-[0.2em] text-muted-foreground/40 whitespace-nowrap">
          ?댁쁺 吏???곗씠?곕? 遺덈윭?ㅻ뒗 以묒엯?덈떎...
        </p>
      </div>
    );
  }

  if (!opsMetrics) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <section className={cn('grid gap-6', isMobile ? 'grid-cols-1' : 'md:grid-cols-4')}>
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-blue-600 p-8 relative overflow-hidden">
          <Armchair className="absolute -right-4 -top-4 h-40 w-40 opacity-10" />
          <div className="relative z-10 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-sky-100">?꾩옱 醫뚯꽍 ?먯쑀??/p>
            <h3 className="dashboard-number text-6xl text-amber-100">
              {opsMetrics.currentOccupancyRate}
              <span className="text-2xl text-sky-200/90 ml-1">%</span>
            </h3>
            <p className="text-xs font-bold text-sky-100/95">
              ?ㅼ떆媛?李⑹꽍 {opsMetrics.occupiedSeats} / ?꾩껜 醫뚯꽍 {opsMetrics.totalSeats}
            </p>
          </div>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-black/[0.03]">
          <div className="flex items-center gap-2 mb-4">
            <Clock3 className="h-5 w-5 text-amber-500" />
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">?쒓컙? ?쇳겕 ?먯쑀??/p>
          </div>
          <h4 className="dashboard-number text-4xl text-amber-600">
            {opsMetrics.peakOccupancySlot.occupancyRate}
            <span className="text-xl opacity-50 ml-1">%</span>
          </h4>
          <p className="text-xs font-bold text-muted-foreground mt-2">
            理쒓퀬 ?먯쑀 ?쒓컙?: {opsMetrics.peakOccupancySlot.label}
          </p>
          <Progress value={opsMetrics.peakOccupancySlot.occupancyRate} className="h-2 bg-amber-100 mt-4" />
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-black/[0.03]">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-emerald-500" />
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">?쒓컙? 留ㅼ텧 ?쇳겕</p>
          </div>
          <h4 className="dashboard-number text-3xl text-emerald-600">{formatWon(opsMetrics.peakRevenueSlot.amount)}</h4>
          <p className="text-xs font-bold text-muted-foreground mt-2">
            理쒓퀬 留ㅼ텧 ?쒓컙?: {opsMetrics.peakRevenueSlot.label} (理쒓렐 30??
          </p>
          <Badge variant="secondary" className="mt-4 bg-emerald-50 text-emerald-700 font-black text-[10px]">
            ?꾩쟻 {formatWon(opsMetrics.totalRecentRevenue)}
          </Badge>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-black/[0.03]">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-violet-500" />
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">?됯퇏 怨듬??쒓컙 ?ъ꽦瑜?/p>
          </div>
          <h4 className="dashboard-number text-4xl text-violet-600">
            {opsMetrics.averageStudyRatio}
            <span className="text-xl opacity-50 ml-1">%</span>
          </h4>
          <div className="mt-2 flex items-center gap-2 text-xs font-bold">
            {opsMetrics.studyTrendDelta > 0 ? (
              <>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-emerald-600">?꾩씪 ?鍮?+{opsMetrics.studyTrendDelta}%p</span>
              </>
            ) : opsMetrics.studyTrendDelta < 0 ? (
              <>
                <TrendingDown className="h-4 w-4 text-rose-500" />
                <span className="text-rose-600">?꾩씪 ?鍮?{opsMetrics.studyTrendDelta}%p</span>
              </>
            ) : (
              <span className="text-muted-foreground">?꾩씪 ?鍮?蹂???놁쓬</span>
            )}
          </div>
          <p className="text-[11px] font-bold text-muted-foreground mt-3">
            ?됯퇏 {opsMetrics.averageDailyStudyMinutes}遺?/ 紐⑺몴 {opsMetrics.averageTargetMinutes}遺?
          </p>
        </Card>
      </section>

      <section className={cn('grid gap-6', isMobile ? 'grid-cols-1' : 'md:grid-cols-12')}>
        <Card className="md:col-span-7 rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-black/[0.03]">
          <CardHeader className="bg-muted/5 border-b p-8">
            <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-2">
              <Armchair className="h-6 w-6 text-blue-600" /> ?쒓컙?蹂?醫뚯꽍 ?먯쑀??
            </CardTitle>
            <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-60">
              ?ㅻ뒛 / 09:00-23:00
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={opsMetrics.occupancyByHour} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, '醫뚯꽍 ?먯쑀??]}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}
                  />
                  <Area type="monotone" dataKey="occupancyRate" stroke="#2563eb" fill="#bfdbfe" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-5 rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-black/[0.03]">
          <CardHeader className="bg-emerald-50/30 border-b p-8">
            <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-emerald-600" /> ?쒓컙?蹂?留ㅼ텧 ?곹솴
            </CardTitle>
            <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-60">
              理쒓렐 30??/ 寃곗젣 湲곕줉
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={opsMetrics.revenueByHour} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ecfdf5" />
                  <XAxis dataKey="label" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${Math.round(value / 10000)}留?}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatWon(value), '留ㅼ텧']}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}
                  />
                  <Bar dataKey="amount" name="留ㅼ텧" fill="#10b981" radius={[10, 10, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className={cn('grid gap-6', isMobile ? 'grid-cols-1' : 'md:grid-cols-12')}>
        <Card className="md:col-span-8 rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-black/[0.03]">
          <CardHeader className="bg-violet-50/30 border-b p-8">
            <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-2">
              <Activity className="h-6 w-6 text-violet-600" /> ?됯퇏 怨듬??쒓컙 鍮꾩쑉 異붿꽭
            </CardTitle>
            <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-60">
              理쒓렐 14??/ 紐⑺몴 ?ъ꽦瑜?
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={opsMetrics.studyRatioTrend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f3ff" />
                  <XAxis dataKey="label" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                    fontSize={11}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, '?ъ꽦瑜?]}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}
                  />
                  <Area type="monotone" dataKey="ratio" stroke="#7c3aed" fill="#ddd6fe" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-4 rounded-[3rem] border-none shadow-2xl bg-white p-8 ring-1 ring-black/[0.03]">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">?댁쁺 ?몄궗?댄듃</p>
          <div className="space-y-4">
            <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
              <p className="text-xs font-black text-blue-700">醫뚯꽍 吏묒쨷 ?쒓컙</p>
              <p className="text-sm font-bold text-blue-900 mt-1">
                {opsMetrics.peakOccupancySlot.label}???먯쑀??{opsMetrics.peakOccupancySlot.occupancyRate}%
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
              <p className="text-xs font-black text-amber-700">?댁쁺 ?ъ쑀 ?쒓컙</p>
              <p className="text-sm font-bold text-amber-900 mt-1">
                {opsMetrics.lowOccupancySlot.label} ?먯쑀??{opsMetrics.lowOccupancySlot.occupancyRate}% (?띾낫/?곷떞 吏묒쨷 沅뚯옣)
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-xs font-black text-emerald-700">?щТ 吏묒쨷 ?쒓컙</p>
              <p className="text-sm font-bold text-emerald-900 mt-1">
                {opsMetrics.peakRevenueSlot.label} 留ㅼ텧 {formatWon(opsMetrics.peakRevenueSlot.amount)}
              </p>
            </div>
            <div className="rounded-2xl bg-muted/40 border p-4">
              <p className="text-xs font-black text-muted-foreground">?숈깮/援먯궗 鍮꾩쑉</p>
              <p className="text-sm font-bold text-primary mt-1">?꾩옱 {opsMetrics.studentTeacherRatio}:1</p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
