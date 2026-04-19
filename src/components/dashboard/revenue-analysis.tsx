'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, AlertTriangle, BellRing, CalendarRange, Loader2, TrendingUp, Users, Wallet } from 'lucide-react';
import { collection, limit, orderBy, query } from 'firebase/firestore';
import { eachDayOfInterval, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';

import { useAppContext } from '@/contexts/app-context';
import { useCollection, useFirestore } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import {
  buildMonthlyTrackBuckets,
  getInvoiceMonth,
  getPaymentMonth,
  INVOICE_TRACK_META,
  resolveInvoiceTrackCategory,
  type InvoiceTrackCategory,
  type MonthlyTrackBucket,
  type TrackMetrics,
} from '@/lib/invoice-analytics';
import type { CounselingLog, Invoice, PaymentRecord } from '@/lib/types';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatWon(value: number): string {
  return `₩${Math.round(value).toLocaleString()}`;
}

function toDateLabel(invoice: Invoice): string {
  const raw = invoice.cycleEndDate as any;
  if (raw && typeof raw.toDate === 'function') {
    const date = raw.toDate();
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return format(date, 'yyyy.MM.dd');
    }
  }
  return '-';
}

function getStatusBadgeClass(status: Invoice['status']) {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'overdue') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (status === 'issued') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (status === 'refunded') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function getStatusLabel(status: Invoice['status']) {
  if (status === 'paid') return '수납완료';
  if (status === 'issued') return '수납대기';
  if (status === 'overdue') return '미납/연체';
  if (status === 'refunded') return '환불';
  if (status === 'void') return '무효';
  return status;
}

function getInvoiceActionLabel(invoice: Invoice) {
  if (invoice.nextAction) return invoice.nextAction;
  if (invoice.status === 'overdue') return '즉시 확인';
  if (invoice.status === 'issued') return '수납 체크';
  if (invoice.status === 'paid') return '완료';
  if (invoice.status === 'void') return '정리 완료';
  if (invoice.status === 'refunded') return '환불 확인';
  return '확인 필요';
}

function emptyTrackMetrics(): TrackMetrics {
  return {
    billed: 0,
    collected: 0,
    arrears: 0,
    invoiceCount: 0,
    paidInvoiceCount: 0,
    overdueInvoiceCount: 0,
  };
}

function emptyBucket(month: string): MonthlyTrackBucket {
  return {
    month,
    byTrack: {
      studyRoom: emptyTrackMetrics(),
      academy: emptyTrackMetrics(),
    },
    total: emptyTrackMetrics(),
  };
}

type SmsDeliveryLogLite = {
  id: string;
  studentId?: string;
  status?: string;
  createdAt?: any;
  sentAt?: any;
};

type ConsultingLeadLite = {
  id: string;
  status?: 'new' | 'contacted' | 'consulted' | 'enrolled' | 'closed';
  createdAt?: any;
};

const SMS_UNIT_COST = 8.7;

function toMonthKey(value: any): string {
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return format(date, 'yyyy-MM');
    }
  }
  return '';
}

function isAcceptedSmsStatus(status?: string) {
  const normalized = String(status || '').toLowerCase();
  return !['failed', 'cancelled', 'suppressed_opt_out', 'pending_provider'].includes(normalized);
}

function getTimelinePriority(invoice: Invoice) {
  if (invoice.status === 'overdue') return 0;
  if (invoice.status === 'issued') return 1;
  if (invoice.status === 'paid') return 2;
  if (invoice.status === 'refunded') return 3;
  return 4;
}

function getMonthLabel(month: string) {
  const [year, monthPart] = month.split('-');
  return `${year}.${monthPart}`;
}

type RevenueAnalysisProps = {
  invoices: Invoice[];
  payments: PaymentRecord[];
  activeStudentCount: number;
  selectedMonth: string;
  onSelectedMonthChange: (month: string) => void;
  trackFilter: 'all' | InvoiceTrackCategory;
  onTrackFilterChange: (value: 'all' | InvoiceTrackCategory) => void;
  onSelectStudent?: (studentId: string) => void;
  focusedStudentId?: string | null;
  isMobile?: boolean;
};

export function RevenueAnalysis({
  invoices,
  payments,
  activeStudentCount,
  selectedMonth,
  onSelectedMonthChange,
  trackFilter,
  onTrackFilterChange,
  onSelectStudent,
  focusedStudentId,
  isMobile = false,
}: RevenueAnalysisProps) {
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();

  const centerId = activeMembership?.id;
  const invoiceById = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices]);

  const smsLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'smsDeliveryLogs'), limit(1500));
  }, [firestore, centerId]);
  const { data: smsDeliveryLogs } = useCollection<SmsDeliveryLogLite>(smsLogsQuery);

  const counselingLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'counselingLogs'), orderBy('createdAt', 'desc'), limit(1000));
  }, [firestore, centerId]);
  const { data: counselingLogs } = useCollection<CounselingLog>(counselingLogsQuery);

  const consultingLeadsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'consultingLeads'), limit(1000));
  }, [firestore, centerId]);
  const { data: consultingLeads } = useCollection<ConsultingLeadLite>(consultingLeadsQuery);

  const monthlyBuckets = useMemo(() => buildMonthlyTrackBuckets(invoices, payments), [invoices, payments]);

  const monthOptions = useMemo(() => {
    const recent = Array.from({ length: 18 }, (_, idx) => format(subMonths(new Date(), idx), 'yyyy-MM'));
    const fromBuckets = monthlyBuckets.map((bucket) => bucket.month);
    return Array.from(new Set([selectedMonth, ...recent, ...fromBuckets])).sort((a, b) => b.localeCompare(a));
  }, [monthlyBuckets, selectedMonth]);

  const selectedBucket = useMemo(
    () => monthlyBuckets.find((bucket) => bucket.month === selectedMonth) || emptyBucket(selectedMonth),
    [monthlyBuckets, selectedMonth]
  );

  const scopedSummary = trackFilter === 'all' ? selectedBucket.total : selectedBucket.byTrack[trackFilter];

  const selectedMonthInvoices = useMemo(() => {
    return invoices
      .filter((invoice) => {
        if (getInvoiceMonth(invoice) !== selectedMonth) return false;
        if (trackFilter !== 'all' && resolveInvoiceTrackCategory(invoice) !== trackFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const priorityDiff = getTimelinePriority(a) - getTimelinePriority(b);
        if (priorityDiff !== 0) return priorityDiff;

        const aEnd = a.cycleEndDate?.toDate?.()?.getTime?.() ?? 0;
        const bEnd = b.cycleEndDate?.toDate?.()?.getTime?.() ?? 0;
        if (aEnd !== bEnd) return aEnd - bEnd;

        const aUpdated = a.updatedAt?.toDate?.()?.getTime?.() ?? 0;
        const bUpdated = b.updatedAt?.toDate?.()?.getTime?.() ?? 0;
        return bUpdated - aUpdated;
      });
  }, [invoices, selectedMonth, trackFilter]);

  const selectedMonthPayments = useMemo(() => {
    return payments.filter((payment) => {
      if (payment.status !== 'success') return false;
      if (getPaymentMonth(payment) !== selectedMonth) return false;
      if (trackFilter === 'all') return true;
      const sourceInvoice = invoiceById.get(payment.invoiceId);
      return sourceInvoice ? resolveInvoiceTrackCategory(sourceInvoice) === trackFilter : false;
    });
  }, [payments, selectedMonth, trackFilter, invoiceById]);

  const selectedMonthCollected = useMemo(
    () => selectedMonthPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0),
    [selectedMonthPayments]
  );

  const collectionRate = scopedSummary.billed > 0 ? (selectedMonthCollected / scopedSummary.billed) * 100 : 0;
  const overdueInvoiceCount = selectedMonthInvoices.filter((invoice) => invoice.status === 'overdue').length;
  const actionRequiredInvoiceCount = selectedMonthInvoices.filter(
    (invoice) => invoice.status === 'issued' || invoice.status === 'overdue'
  ).length;

  const chartData = useMemo(() => {
    return monthlyBuckets.slice(-12).map((bucket) => {
      const trackMetrics = trackFilter === 'all' ? bucket.total : bucket.byTrack[trackFilter];
      return {
        month: getMonthLabel(bucket.month),
        billed: trackMetrics.billed,
        collected: trackMetrics.collected,
        arrears: trackMetrics.arrears,
        studyRoomBilled: bucket.byTrack.studyRoom.billed,
        studyRoomCollected: bucket.byTrack.studyRoom.collected,
        studyRoomArrears: bucket.byTrack.studyRoom.arrears,
        academyBilled: bucket.byTrack.academy.billed,
        academyCollected: bucket.byTrack.academy.collected,
        academyArrears: bucket.byTrack.academy.arrears,
      };
    });
  }, [monthlyBuckets, trackFilter]);

  const selectedMonthSmsLogs = useMemo(
    () => (smsDeliveryLogs || []).filter((log) => toMonthKey(log.sentAt || log.createdAt) === selectedMonth),
    [smsDeliveryLogs, selectedMonth]
  );
  const selectedMonthCounselings = useMemo(
    () => (counselingLogs || []).filter((log) => toMonthKey(log.createdAt) === selectedMonth),
    [counselingLogs, selectedMonth]
  );
  const selectedMonthLeads = useMemo(
    () => (consultingLeads || []).filter((lead) => toMonthKey(lead.createdAt) === selectedMonth),
    [consultingLeads, selectedMonth]
  );
  const acceptedSmsCount = selectedMonthSmsLogs.filter((log) => isAcceptedSmsStatus(log.status)).length;
  const monthlySmsCost = Math.round(acceptedSmsCount * SMS_UNIT_COST);
  const smsCostPerStudent = activeStudentCount > 0 ? Math.round((monthlySmsCost / activeStudentCount) * 10) / 10 : 0;
  const consultedLeadCount = selectedMonthLeads.filter((lead) => lead.status === 'consulted' || lead.status === 'enrolled').length;
  const enrolledLeadCount = selectedMonthLeads.filter((lead) => lead.status === 'enrolled').length;
  const leadConsultConversionRate = selectedMonthLeads.length > 0 ? (consultedLeadCount / selectedMonthLeads.length) * 100 : 0;
  const leadEnrollConversionRate = selectedMonthLeads.length > 0 ? (enrolledLeadCount / selectedMonthLeads.length) * 100 : 0;
  const operatingCostChartData = useMemo(() => {
    const monthStart = startOfMonth(new Date(`${selectedMonth}-01T00:00:00`));
    const monthEnd = endOfMonth(monthStart);
    const dayLabels = eachDayOfInterval({ start: monthStart, end: monthEnd }).map((date) => format(date, 'M.d'));
    const smsMap = new Map<string, number>();
    const counselingMap = new Map<string, number>();
    const leadsMap = new Map<string, number>();

    selectedMonthSmsLogs.forEach((log) => {
      const raw = (log.sentAt || log.createdAt) as any;
      if (!raw || typeof raw.toDate !== 'function') return;
      const label = format(raw.toDate(), 'M.d');
      if (isAcceptedSmsStatus(log.status)) {
        smsMap.set(label, (smsMap.get(label) || 0) + Math.round(SMS_UNIT_COST * 10) / 10);
      }
    });
    selectedMonthCounselings.forEach((log) => {
      if (!log.createdAt) return;
      const label = format(log.createdAt.toDate(), 'M.d');
      counselingMap.set(label, (counselingMap.get(label) || 0) + 1);
    });
    selectedMonthLeads.forEach((lead) => {
      const raw = lead.createdAt as any;
      if (!raw || typeof raw.toDate !== 'function') return;
      const label = format(raw.toDate(), 'M.d');
      leadsMap.set(label, (leadsMap.get(label) || 0) + 1);
    });

    return dayLabels.map((label) => ({
      day: label,
      smsCost: Number((smsMap.get(label) || 0).toFixed(1)),
      counselingCount: counselingMap.get(label) || 0,
      leadCount: leadsMap.get(label) || 0,
    }));
  }, [selectedMonth, selectedMonthCounselings, selectedMonthLeads, selectedMonthSmsLogs]);

  const monthScopeLabel = trackFilter === 'all' ? '센터 전체' : INVOICE_TRACK_META[trackFilter].label;

  if (!centerId && invoices.length === 0) {
    return (
      <div className="flex h-[36vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[2rem] border border-[#dbe7ff] bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_100%)] shadow-[0_24px_56px_-42px_rgba(20,41,95,0.28)]">
        <CardHeader className={cn('gap-5 border-b border-[#e7eefc]', isMobile ? 'p-5' : 'p-7')}>
          <div className={cn('flex items-start justify-between gap-4', isMobile ? 'flex-col' : 'flex-row')}>
            <div className="space-y-2">
              <Badge className="rounded-full border border-[#dbe7ff] bg-white px-3 py-1 text-[10px] font-black text-[#14295F] shadow-sm">
                월별 비즈니스 추이
              </Badge>
              <div className="space-y-1">
                <CardTitle className="text-[1.8rem] font-black tracking-tight text-[#14295F]">
                  실수납, 청구, 미납 흐름을 같은 월 기준으로 봅니다.
                </CardTitle>
                <CardDescription className="max-w-3xl text-sm font-semibold leading-relaxed text-[#5c6e97]">
                  청구·미납은 인보이스 기준, 실제 수납액은 결제 완료 기록 기준으로 집계합니다. 월을 바꾸면 차트와 KPI,
                  트랙 비교, 인보이스 흐름이 함께 움직입니다.
                </CardDescription>
              </div>
            </div>

            <div className={cn('grid gap-2', isMobile ? 'w-full' : 'min-w-[200px]')}>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8091bb]">기준 월</p>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(event) => onSelectedMonthChange(event.target.value || format(new Date(), 'yyyy-MM'))}
                className="h-11 rounded-xl border-[#d7e4ff] bg-white font-black text-[#14295F]"
              />
            </div>
          </div>

          <div className={cn('flex items-center justify-between gap-3', isMobile ? 'flex-col items-stretch' : 'flex-row')}>
            <div className="flex flex-wrap gap-2">
              {monthOptions.slice(0, 6).map((month) => (
                <Button
                  key={month}
                  type="button"
                  variant={month === selectedMonth ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onSelectedMonthChange(month)}
                  className={cn(
                    'h-8 rounded-full px-3 text-[11px] font-black',
                    month === selectedMonth
                      ? 'bg-[#14295F] text-white hover:bg-[#173D8B]'
                      : 'border-[#dbe7ff] bg-white text-[#5c6e97] hover:bg-[#f4f7ff]'
                  )}
                >
                  {month}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={trackFilter === 'all' ? 'default' : 'outline'}
                className={cn(
                  'h-8 rounded-full px-3 text-[11px] font-black',
                  trackFilter === 'all'
                    ? 'bg-[#14295F] text-white hover:bg-[#173D8B]'
                    : 'border-[#dbe7ff] bg-white text-[#5c6e97] hover:bg-[#f4f7ff]'
                )}
                onClick={() => onTrackFilterChange('all')}
              >
                전체 트랙
              </Button>
              {(['studyRoom', 'academy'] as InvoiceTrackCategory[]).map((track) => {
                const trackMeta = INVOICE_TRACK_META[track];
                return (
                  <Button
                    key={track}
                    type="button"
                    size="sm"
                    variant={trackFilter === track ? 'default' : 'outline'}
                    className={cn(
                      'h-8 rounded-full px-3 text-[11px] font-black',
                      trackFilter === track
                        ? track === 'academy'
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-[#2554D7] text-white hover:bg-[#173D8B]'
                        : 'border-[#dbe7ff] bg-white text-[#5c6e97] hover:bg-[#f4f7ff]'
                    )}
                    onClick={() => onTrackFilterChange(track)}
                  >
                    {trackMeta.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardHeader>

        <CardContent className={cn('space-y-5', isMobile ? 'p-5' : 'p-7')}>
          <div className="rounded-[1.75rem] border border-[#dbe7ff] bg-white/90 p-4 shadow-[0_20px_46px_-36px_rgba(20,41,95,0.22)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-[#14295F]">{selectedMonth} 흐름</p>
                <p className="text-[11px] font-semibold text-[#8091bb]">{monthScopeLabel} 기준 최근 12개월 비교</p>
              </div>
              <Badge className="rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-3 py-1 text-[10px] font-black text-[#14295F]">
                청구 vs 실수납 vs 미납
              </Badge>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#e7eefc" strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${Math.round(toNumber(value) / 10000)}만`}
                  />
                  <Tooltip formatter={(value: number) => formatWon(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="billed" name="청구" stroke="#2554D7" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="collected" name="실수납" stroke="#059669" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="arrears" name="미납" stroke="#E11D48" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <section className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'md:grid-cols-5')}>
            <Card className="rounded-[1.6rem] border-none bg-[linear-gradient(135deg,#14295F_0%,#2554D7_100%)] text-white shadow-[0_24px_56px_-42px_rgba(20,41,95,0.48)]">
              <CardContent className="p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/72">당월 청구금액</p>
                <p className="dashboard-number mt-2 text-2xl text-white">{formatWon(scopedSummary.billed)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-[1.6rem] border border-emerald-100 bg-white shadow-sm">
              <CardContent className="p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">당월 실제 수납금액</p>
                <p className="dashboard-number mt-2 text-2xl text-emerald-600">{formatWon(selectedMonthCollected)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-[1.6rem] border border-rose-100 bg-white shadow-sm">
              <CardContent className="p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-rose-600">당월 미납금액</p>
                <p className="dashboard-number mt-2 text-2xl text-rose-600">{formatWon(scopedSummary.arrears)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-[1.6rem] border border-[#dbe7ff] bg-white shadow-sm">
              <CardContent className="p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">수납률</p>
                <p className="dashboard-number mt-2 text-2xl text-[#14295F]">{collectionRate.toFixed(1)}%</p>
                <p className="mt-1 text-[11px] font-semibold text-[#8091bb]">수납 {selectedMonthPayments.length}건 기준</p>
              </CardContent>
            </Card>
            <Card className="rounded-[1.6rem] border border-[#dbe7ff] bg-white shadow-sm">
              <CardContent className="p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">연체 건수</p>
                <p className="dashboard-number mt-2 text-2xl text-[#14295F]">{overdueInvoiceCount}건</p>
                <p className="mt-1 text-[11px] font-semibold text-[#8091bb]">액션 필요 {actionRequiredInvoiceCount}건</p>
              </CardContent>
            </Card>
          </section>
        </CardContent>
      </Card>

      <section className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'md:grid-cols-2')}>
        {(['studyRoom', 'academy'] as InvoiceTrackCategory[]).map((track) => {
          const trackMetrics = selectedBucket.byTrack[track];
          const trackMeta = INVOICE_TRACK_META[track];
          const trackRate = trackMetrics.billed > 0 ? (trackMetrics.collected / trackMetrics.billed) * 100 : 0;
          const isActiveTrack = trackFilter === 'all' || trackFilter === track;

          return (
            <Card
              key={track}
              className={cn(
                'rounded-[1.75rem] border bg-white shadow-sm',
                isActiveTrack ? 'border-[#dbe7ff]' : 'border-slate-100 opacity-85'
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-black text-[#14295F]">{trackMeta.label}</CardTitle>
                    <CardDescription>청구·미납은 인보이스, 실수납은 결제 완료 기록으로 계산합니다.</CardDescription>
                  </div>
                  <Badge className={cn('border text-[10px] font-black', trackMeta.badgeClass)}>{trackMeta.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">청구</p>
                    <p className={cn('dashboard-number mt-2 text-lg', trackMeta.accentClass)}>{formatWon(trackMetrics.billed)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">실수납</p>
                    <p className="dashboard-number mt-2 text-lg text-emerald-600">{formatWon(trackMetrics.collected)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">미납</p>
                    <p className="dashboard-number mt-2 text-lg text-rose-600">{formatWon(trackMetrics.arrears)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">수납률</p>
                    <p className="dashboard-number mt-2 text-lg text-[#14295F]">{trackRate.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-[#e7eefc] bg-[#f8fbff] px-4 py-3 text-sm font-semibold text-[#5c6e97]">
                  <span>인보이스 수 {trackMetrics.invoiceCount}건</span>
                  <span>연체 {trackMetrics.overdueInvoiceCount}건</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card className="rounded-[1.9rem] border border-[#dbe7ff] bg-white shadow-sm">
        <CardHeader className="gap-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-black text-[#14295F]">
                <CalendarRange className="h-5 w-5 text-[#2554D7]" />
                {selectedMonth} 인보이스 운영 스트립
              </CardTitle>
              <CardDescription>상태, 금액, 트랙, 학생, 마감일, 다음 액션을 같은 줄에서 확인합니다.</CardDescription>
            </div>
            <Badge className="rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-3 py-1 text-[10px] font-black text-[#14295F]">
              {monthScopeLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {selectedMonthInvoices.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-[#dbe7ff] bg-[#f8fbff] py-12 text-center text-sm font-semibold text-[#8091bb]">
              해당 월에 표시할 인보이스가 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {selectedMonthInvoices.slice(0, 12).map((invoice) => {
                const track = resolveInvoiceTrackCategory(invoice);
                const trackMeta = INVOICE_TRACK_META[track];
                const isFocused = focusedStudentId === invoice.studentId;

                return (
                  <div
                    key={invoice.id}
                    className={cn(
                      'grid gap-3 rounded-[1.4rem] border px-4 py-4 transition-all',
                      isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,1.5fr)_110px_110px_120px_92px]',
                      isFocused ? 'border-[#2554D7] bg-[#f8fbff]' : 'border-slate-100 bg-white hover:bg-slate-50/70'
                    )}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-black text-slate-900">{invoice.studentName}</span>
                        <Badge className={cn('border text-[10px] font-black', trackMeta.badgeClass)}>{trackMeta.label}</Badge>
                        <Badge className={cn('border text-[10px] font-black', getStatusBadgeClass(invoice.status))}>
                          {getStatusLabel(invoice.status)}
                        </Badge>
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500">
                        마감일 {toDateLabel(invoice)} · 다음 액션 {getInvoiceActionLabel(invoice)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">금액</p>
                      <p className="dashboard-number text-sm text-slate-900">{formatWon(invoice.finalPrice)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">마감일</p>
                      <p className="text-sm font-black text-slate-900">{toDateLabel(invoice)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">다음 액션</p>
                      <p className="text-sm font-black text-[#14295F]">{getInvoiceActionLabel(invoice)}</p>
                    </div>
                    <div className="flex items-center justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full border-[#dbe7ff] px-3 text-[11px] font-black text-[#14295F] hover:bg-[#f4f7ff]"
                        onClick={() => onSelectStudent?.(invoice.studentId)}
                      >
                        학생 보기
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-black text-[#14295F]">보조 운영 분석</p>
            <p className="text-sm font-semibold text-[#8091bb]">
              실수납 판단 이후 참고하는 문자비, 상담, 리드 흐름입니다.
            </p>
          </div>
          <Badge className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black text-slate-600">
            Supporting Signals
          </Badge>
        </div>

        <section className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'md:grid-cols-4')}>
          <Card className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 shadow-none">
            <CardContent className="p-5">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                <BellRing className="h-4 w-4 text-sky-500" />
                당월 문자 비용
              </p>
              <p className="dashboard-number mt-2 text-2xl text-slate-900">{formatWon(monthlySmsCost)}</p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">알리고 접수 {acceptedSmsCount}건 기준</p>
            </CardContent>
          </Card>
          <Card className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 shadow-none">
            <CardContent className="p-5">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                <Users className="h-4 w-4 text-[#2554D7]" />
                학생 1인당 문자비
              </p>
              <p className="dashboard-number mt-2 text-2xl text-slate-900">₩{smsCostPerStudent.toLocaleString()}</p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">활성 학생 {activeStudentCount}명 기준</p>
            </CardContent>
          </Card>
          <Card className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 shadow-none">
            <CardContent className="p-5">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                리드 상담 전환율
              </p>
              <p className="dashboard-number mt-2 text-2xl text-slate-900">{leadConsultConversionRate.toFixed(1)}%</p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">등록 전환 {leadEnrollConversionRate.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 shadow-none">
            <CardContent className="p-5">
              <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                미수 운영 신호
              </p>
              <p className="dashboard-number mt-2 text-2xl text-slate-900">{actionRequiredInvoiceCount}건</p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">연체 {overdueInvoiceCount}건 · 상담 {selectedMonthCounselings.length}건</p>
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-[1.6rem] border border-slate-200 bg-white shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-black text-slate-800">
              <Activity className="h-4 w-4 text-[#2554D7]" />
              운영 비용 연결 분석
            </CardTitle>
            <CardDescription>문자 비용, 상담 터치, 신규 리드 흐름을 같은 날짜축으로 묶어 봅니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={operatingCostChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="cost" fontSize={11} tickFormatter={(value) => `₩${Math.round(toNumber(value))}`} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="count" orientation="right" fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  <Area yAxisId="cost" type="monotone" dataKey="smsCost" name="문자비용" stroke="#0ea5e9" fill="#bae6fd" strokeWidth={2} />
                  <Bar yAxisId="count" dataKey="counselingCount" name="상담 건수" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  <Line yAxisId="count" type="monotone" dataKey="leadCount" name="신규 리드" stroke="#10b981" strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
