
'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CalendarRange, Loader2, TrendingUp, Wallet } from 'lucide-react';
import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import { eachDayOfInterval, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';

import { useAppContext } from '@/contexts/app-context';
import { useCollection, useFirestore } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import {
  buildMonthlyTrackBuckets,
  getInvoiceMonth,
  INVOICE_TRACK_META,
  resolveInvoiceTrackCategory,
  type InvoiceTrackCategory,
  type MonthlyTrackBucket,
} from '@/lib/invoice-analytics';
import type { CenterMembership, Invoice } from '@/lib/types';
import { calculateSmsCost, formatSmsCost } from '@/lib/sms-cost';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  if (status === 'issued') return '청구됨';
  if (status === 'overdue') return '미납/연체';
  if (status === 'refunded') return '환불';
  if (status === 'void') return '무효';
  return status;
}

type SmsDeliveryLogRow = {
  id: string;
  dateKey?: string;
  status?: string;
  createdAt?: { toDate?: () => Date };
  sentAt?: { toDate?: () => Date };
};

function emptyBucket(month: string): MonthlyTrackBucket {
  return {
    month,
    byTrack: {
      studyRoom: {
        billed: 0,
        collected: 0,
        arrears: 0,
        invoiceCount: 0,
        paidInvoiceCount: 0,
        overdueInvoiceCount: 0,
      },
      academy: {
        billed: 0,
        collected: 0,
        arrears: 0,
        invoiceCount: 0,
        paidInvoiceCount: 0,
        overdueInvoiceCount: 0,
      },
    },
    total: {
      billed: 0,
      collected: 0,
      arrears: 0,
      invoiceCount: 0,
      paidInvoiceCount: 0,
      overdueInvoiceCount: 0,
    },
  };
}

export function RevenueAnalysis() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();

  const centerId = activeMembership?.id;
  const isMobile = viewMode === 'mobile';
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'student'), where('status', '==', 'active'));
  }, [firestore, centerId]);
  const { data: activeStudents } = useCollection<CenterMembership>(membersQuery);

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'invoices'), orderBy('cycleEndDate', 'desc'), limit(1000));
  }, [firestore, centerId]);
  const { data: invoices, isLoading: invoicesLoading } = useCollection<Invoice>(invoicesQuery);

  const selectedMonthStart = useMemo(() => startOfMonth(new Date(`${selectedMonth}-01T00:00:00`)), [selectedMonth]);
  const selectedMonthEnd = useMemo(() => endOfMonth(selectedMonthStart), [selectedMonthStart]);
  const selectedMonthStartKey = format(selectedMonthStart, 'yyyy-MM-dd');
  const selectedMonthEndKey = format(selectedMonthEnd, 'yyyy-MM-dd');

  const smsLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'smsDeliveryLogs'),
      where('dateKey', '>=', selectedMonthStartKey),
      where('dateKey', '<=', selectedMonthEndKey),
      orderBy('dateKey', 'asc'),
      limit(10000)
    );
  }, [firestore, centerId, selectedMonthEndKey, selectedMonthStartKey]);
  const { data: smsDeliveryLogs } = useCollection<SmsDeliveryLogRow>(smsLogsQuery);

  const monthlyBuckets = useMemo(() => buildMonthlyTrackBuckets(invoices || []), [invoices]);

  const monthOptions = useMemo(() => {
    const recent = Array.from({ length: 18 }, (_, idx) => format(subMonths(new Date(), idx), 'yyyy-MM'));
    const fromInvoices = monthlyBuckets.map((bucket) => bucket.month);
    return Array.from(new Set([selectedMonth, ...recent, ...fromInvoices])).sort((a, b) => b.localeCompare(a));
  }, [monthlyBuckets, selectedMonth]);

  const selectedBucket = useMemo(
    () => monthlyBuckets.find((bucket) => bucket.month === selectedMonth) || emptyBucket(selectedMonth),
    [monthlyBuckets, selectedMonth]
  );

  const selectedTimeline = useMemo(
    () => (invoices || []).filter((invoice) => getInvoiceMonth(invoice) === selectedMonth).slice(0, 30),
    [invoices, selectedMonth]
  );

  const smsDailyCostRows = useMemo(() => {
    const baseRows = eachDayOfInterval({ start: selectedMonthStart, end: selectedMonthEnd }).map((date) => ({
      key: format(date, 'yyyy-MM-dd'),
      label: format(date, 'M.d'),
      sentCount: 0,
      smsCost: 0,
    }));
    const rowMap = new Map(baseRows.map((row) => [row.key, row] as const));
    (smsDeliveryLogs || []).forEach((row) => {
      const key =
        row.dateKey ||
        (row.sentAt?.toDate ? format(row.sentAt.toDate(), 'yyyy-MM-dd') : '') ||
        (row.createdAt?.toDate ? format(row.createdAt.toDate(), 'yyyy-MM-dd') : '');
      if (!key || row.status !== 'sent') return;
      const bucket = rowMap.get(key);
      if (!bucket) return;
      bucket.sentCount += 1;
    });
    return baseRows.map((row) => ({
      ...row,
      smsCost: calculateSmsCost(row.sentCount),
    }));
  }, [selectedMonthEnd, selectedMonthStart, smsDeliveryLogs]);

  const selectedMonthSmsCount = useMemo(
    () => smsDailyCostRows.reduce((sum, row) => sum + row.sentCount, 0),
    [smsDailyCostRows]
  );
  const selectedMonthSmsCost = useMemo(
    () => smsDailyCostRows.reduce((sum, row) => sum + row.smsCost, 0),
    [smsDailyCostRows]
  );

  const chartData = useMemo(
    () =>
      monthlyBuckets
        .slice(-12)
        .map((bucket) => ({
          month: bucket.month,
          billed: bucket.total.billed,
          collected: bucket.total.collected,
          arrears: bucket.total.arrears,
          studyRoomCollected: bucket.byTrack.studyRoom.collected,
          academyCollected: bucket.byTrack.academy.collected,
        })),
    [monthlyBuckets]
  );

  const summary = selectedBucket.total;
  const collectionRate = summary.billed > 0 ? (summary.collected / summary.billed) * 100 : 0;
  const arrearsRate = summary.billed > 0 ? (summary.arrears / summary.billed) * 100 : 0;

  const activeStudentCount = (activeStudents || []).length;
  const smsCostPerStudent = activeStudentCount > 0 ? selectedMonthSmsCost / activeStudentCount : 0;
  const netCollectedAfterSms = summary.collected - selectedMonthSmsCost;

  const byTrackCards: Array<{ key: InvoiceTrackCategory; title: string }> = [
    { key: 'studyRoom', title: '독서실' },
    { key: 'academy', title: '학원' },
  ];

  if (invoicesLoading) {
    return (
      <div className="flex h-[36vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <Card className="rounded-3xl border-none shadow-lg ring-1 ring-border/60">
        <CardHeader className={cn('gap-4', isMobile ? 'p-5' : 'p-8')}>
          <div className={cn('flex items-start justify-between gap-4', isMobile ? 'flex-col' : 'flex-row')}>
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-2xl font-black tracking-tight">
                <TrendingUp className="h-6 w-6 text-primary" />
                수익분석 자동 리포트
              </CardTitle>
              <CardDescription className="font-medium">
                수납/미납 관리에서 작성된 인보이스 데이터를 월별로 자동 집계합니다.
              </CardDescription>
            </div>
          </div>

          <div className={cn('flex items-center gap-2', isMobile ? 'flex-col items-stretch' : 'flex-row')}>
            <Label htmlFor="analytics-month" className="text-xs font-black text-muted-foreground">
              조회 월
            </Label>
            <Input
              id="analytics-month"
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value || format(new Date(), 'yyyy-MM'))}
              className={cn('h-10 rounded-lg', isMobile ? 'w-full' : 'w-[180px]')}
            />
            <div className="flex flex-wrap gap-2">
              {monthOptions.slice(0, 6).map((month) => (
                <Button
                  key={month}
                  type="button"
                  variant={month === selectedMonth ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 rounded-lg px-3 text-xs font-bold"
                  onClick={() => setSelectedMonth(month)}
                >
                  {month}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      <section className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'md:grid-cols-5')}>
        <Card className="rounded-2xl border-none bg-primary shadow-md">
          <CardContent className="p-5">
            <p className="text-[11px] font-bold text-[#14295F]">당월 청구금액</p>
            <p className="dashboard-number mt-2 text-2xl text-[#14295F]">{formatWon(summary.billed)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
          <CardContent className="p-5">
            <p className="text-[11px] font-bold text-muted-foreground">당월 수납금액</p>
            <p className="dashboard-number mt-2 text-2xl text-emerald-600">{formatWon(summary.collected)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
          <CardContent className="p-5">
            <p className="text-[11px] font-bold text-muted-foreground">당월 미납금액</p>
            <p className="dashboard-number mt-2 text-2xl text-rose-600">{formatWon(summary.arrears)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
          <CardContent className="p-5">
            <p className="text-[11px] font-bold text-muted-foreground">수납률 / 미납률</p>
            <p className="dashboard-number mt-2 text-xl">{collectionRate.toFixed(1)}% / {arrearsRate.toFixed(1)}%</p>
            <p className="mt-1 text-[11px] font-bold text-muted-foreground">활성 학생 {activeStudentCount}명</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
          <CardContent className="p-5">
            <p className="text-[11px] font-bold text-muted-foreground">당월 문자비용</p>
            <p className="dashboard-number mt-2 text-2xl text-violet-600">{formatSmsCost(selectedMonthSmsCost)}</p>
            <p className="mt-1 text-[11px] font-bold text-muted-foreground">전송 접수 {selectedMonthSmsCount}건</p>
          </CardContent>
        </Card>
      </section>

      <section className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'md:grid-cols-2')}>
        {byTrackCards.map(({ key, title }) => {
          const trackMetrics = selectedBucket.byTrack[key];
          const trackMeta = INVOICE_TRACK_META[key];
          const trackRate = trackMetrics.billed > 0 ? (trackMetrics.collected / trackMetrics.billed) * 100 : 0;
          return (
            <Card key={key} className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-lg font-black">
                  <span>{title} 월별 현황</span>
                  <Badge className={cn('border text-xs font-black', trackMeta.badgeClass)}>{trackMeta.label}</Badge>
                </CardTitle>
                <CardDescription>청구/수납/미납이 인보이스 기준으로 자동 계산됩니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm font-bold text-muted-foreground">
                  <span>청구</span>
                  <span className={cn("tabular-nums", trackMeta.accentClass)}>{formatWon(trackMetrics.billed)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-bold text-muted-foreground">
                  <span>수납</span>
                  <span className="tabular-nums text-emerald-600">{formatWon(trackMetrics.collected)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-bold text-muted-foreground">
                  <span>미납</span>
                  <span className="tabular-nums text-rose-600">{formatWon(trackMetrics.arrears)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-bold text-muted-foreground">
                  <span>인보이스</span>
                  <span>{trackMetrics.invoiceCount}건</span>
                </div>
                <div className="flex items-center justify-between text-sm font-bold text-muted-foreground">
                  <span>수납률</span>
                  <span>{trackRate.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'md:grid-cols-12')}>
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50 md:col-span-7">
          <CardHeader>
            <CardTitle className="text-lg font-black">월별 수납 추이</CardTitle>
            <CardDescription>최근 12개월 청구/수납/미납 흐름</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(value) => `${Math.round(toNumber(value) / 10000)}만`} />
                  <Tooltip formatter={(value: number) => formatWon(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="billed" name="청구" stroke="#1d4ed8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="collected" name="수납" stroke="#059669" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="arrears" name="미납" stroke="#dc2626" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50 md:col-span-5">
          <CardHeader>
            <CardTitle className="text-lg font-black">트랙별 수납 비중</CardTitle>
            <CardDescription>독서실/학원 수납금액 비교</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(value) => `${Math.round(toNumber(value) / 10000)}만`} />
                  <Tooltip formatter={(value: number) => formatWon(value)} />
                  <Legend />
                  <Area type="monotone" dataKey="studyRoomCollected" name="독서실 수납" stackId="1" stroke="#2563eb" fill="#93c5fd" />
                  <Area type="monotone" dataKey="academyCollected" name="학원 수납" stackId="1" stroke="#059669" fill="#86efac" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'md:grid-cols-12')}>
        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50 md:col-span-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-black">
              <Wallet className="h-5 w-5 text-violet-600" />
              {selectedMonth} 일자별 문자비용
            </CardTitle>
            <CardDescription>전송 접수 기준으로 하루에 얼마나 비용이 나갔는지 바로 확인합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={smsDailyCostRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={11} interval={Math.max(0, Math.floor(smsDailyCostRows.length / 8))} />
                  <YAxis fontSize={11} tickFormatter={(value) => formatSmsCost(toNumber(value))} />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === '문자비용'
                        ? formatSmsCost(toNumber(value))
                        : `${Math.round(toNumber(value)).toLocaleString()}건`
                    }
                  />
                  <Legend />
                  <Line type="monotone" dataKey="smsCost" name="문자비용" stroke="#7c3aed" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="sentCount" name="전송 접수" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="8 6" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50 md:col-span-4">
          <CardHeader>
            <CardTitle className="text-lg font-black">문자 비용 분석</CardTitle>
            <CardDescription>CFO/COO 관점에서 문자 운영비를 별도 추적합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-violet-50 px-4 py-3">
              <span className="text-sm font-black text-violet-900">당월 문자비용</span>
              <span className="text-base font-black text-violet-700">{formatSmsCost(selectedMonthSmsCost)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
              <span className="text-sm font-black text-emerald-900">문자 반영 순수납</span>
              <span className="text-base font-black text-emerald-700">{formatWon(netCollectedAfterSms)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-sm font-black text-slate-800">학생 1인당 문자비</span>
              <span className="text-base font-black text-slate-700">{formatSmsCost(smsCostPerStudent)}</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-black text-slate-500">운영 메모</p>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
                문자 단가는 건당 8.7원 기준이며, 실제 비용은 전송 접수 건수 기준으로 집계했습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-black">
            <CalendarRange className="h-5 w-5 text-primary" />
            {selectedMonth} 인보이스 타임라인
          </CardTitle>
          <CardDescription>수납/미납 관리에서 작성된 인보이스를 시간순으로 보여줍니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedTimeline.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center text-sm font-semibold text-muted-foreground">
              해당 월 인보이스가 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {selectedTimeline.map((invoice) => {
                const track = resolveInvoiceTrackCategory(invoice);
                const trackMeta = INVOICE_TRACK_META[track];
                return (
                  <div
                    key={invoice.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-800">{invoice.studentName}</span>
                        <Badge className={cn('border text-[10px] font-black', trackMeta.badgeClass)}>{trackMeta.label}</Badge>
                        <Badge className={cn('border text-[10px] font-black', getStatusBadgeClass(invoice.status))}>
                          {getStatusLabel(invoice.status)}
                        </Badge>
                      </div>
                      <p className="text-xs font-bold text-slate-400">마감일 {toDateLabel(invoice)}</p>
                    </div>
                    <div className="text-right">
                      <p className="dashboard-number text-base text-slate-900">{formatWon(invoice.finalPrice)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
