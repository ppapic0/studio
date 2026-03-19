
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/contexts/app-context';
import { useCollection, useFirestore, useDoc, useUser } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, doc, getDoc, getDocs, limit, orderBy, setDoc, serverTimestamp, addDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { KpiDaily, Invoice, AttendanceCurrent, CenterMembership } from '@/lib/types';
import { INVOICE_TRACK_META, resolveInvoiceTrackCategory, type InvoiceTrackCategory } from '@/lib/invoice-analytics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight,
  Target,
  Calculator,
  CalendarDays,
  Sparkles,
  PieChart,
  Settings,
  Loader2,
  RefreshCw,
  Wallet,
  Building2,
  Activity,
  ShieldAlert,
  CreditCard,
  Receipt,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  PlusCircle,
  BellRing,
  CheckCircle2,
  FileText,
  Clock,
  Filter,
  Armchair,
  Info,
  CalendarCheck,
  History,
  AlertTriangle,
  CalendarX,
  Search
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subDays, addDays, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { RevenueAnalysis } from '@/components/dashboard/revenue-analysis';
import { RiskIntelligence } from '@/components/dashboard/risk-intelligence';
import { OperationalIntelligence } from '@/components/dashboard/operational-intelligence';
import { useToast } from '@/hooks/use-toast';
import { updateInvoiceStatus, issueInvoice } from '@/lib/finance-actions';
import { useRouter, useSearchParams } from 'next/navigation';
import { autoCheckPaymentReminders } from '@/lib/kakao-service';
import Link from 'next/link';

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

function getTimelineInvoiceMonth(invoice: Invoice): string | null {
  const monthBaseDate =
    toDateSafe((invoice as any).issuedAt) ||
    toDateSafe((invoice as any).cycleStartDate) ||
    toDateSafe((invoice as any).cycleEndDate);
  if (!monthBaseDate) return null;
  return format(monthBaseDate, 'yyyy-MM');
}

export default function RevenuePage() {
  const { user } = useUser();
  const { activeMembership, viewMode, membershipsLoading } = useAppContext();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;
  const focusedStudentId = searchParams.get('studentId');

  const [activeTab, setActiveTab] = useState('payments'); 
  const [paymentSubTab, setPaymentSubTab] = useState('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [quickIssueAmount, setQuickIssueAmount] = useState('390000');
  const [currentChartMonth, setCurrentChartMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [timelineMonth, setTimelineMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [timelineTrackFilter, setTimelineTrackFilter] = useState<'all' | InvoiceTrackCategory>('all');
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});

  // 1. KPI 이력 조회
  const kpiQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'kpiDaily'),
      where('date', '>=', `${currentChartMonth}-01`),
      where('date', '<=', `${currentChartMonth}-31`),
      orderBy('date', 'asc')
    );
  }, [firestore, centerId, currentChartMonth]);
  const { data: kpiHistory, isLoading: isKpiLoading } = useCollection<KpiDaily>(kpiQuery);

  // 2. 인보이스 전체 조회
  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'invoices'),
      orderBy('cycleEndDate', 'desc')
    );
  }, [firestore, centerId]);
  const { data: allInvoices, isLoading: isInvoicesLoading } = useCollection<Invoice>(invoicesQuery);

  // 3. 현재 좌석/출결 상태 조회
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList } = useCollection<AttendanceCurrent>(attendanceQuery);

  // 4. 활성 학생 멤버 목록 조회
  const studentMembersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'),
      where('role', '==', 'student'),
      where('status', '==', 'active')
    );
  }, [firestore, centerId]);
  const { data: studentMembers } = useCollection<CenterMembership>(studentMembersQuery);

  // --- 배정 학생 우선순위 계산 (미납/연체 우선) ---
  const sortedAssignedStudents = useMemo(() => {
    if (!attendanceList || !allInvoices || !studentMembers) return [];
    
    const assignedSeats = attendanceList.filter(a => a.studentId);
    
    const list = assignedSeats.map(seat => {
      const student = studentMembers.find(m => m.id === seat.studentId);
      const studentInvoices = allInvoices.filter(i => i.studentId === seat.studentId)
        .sort((a, b) => b.cycleEndDate.toMillis() - a.cycleEndDate.toMillis());
      const latestInvoice = studentInvoices?.[0];
      
      let priority = 0;
      let overdueDays = 0;
      
      if (!latestInvoice) {
        priority = 100; // 배정 학생인데 인보이스가 없으면 최우선
      } else if (latestInvoice.status !== 'paid' && latestInvoice.cycleEndDate.toDate() < new Date()) {
        priority = 90; // 미납/연체 상태는 높은 우선순위
        overdueDays = differenceInDays(new Date(), latestInvoice.cycleEndDate.toDate());
      } else if (latestInvoice.status !== 'paid') {
        priority = 80; // 청구됨(수납 대기) 상태
      } else {
        priority = 10; // 수납 완료 상태
      }
      
      return { 
        seat, 
        student, 
        latestInvoice, 
        priority, 
        overdueDays 
      };
    });

    // 우선순위 높은 순 -> 마감일 임박 순
    return list.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.latestInvoice && b.latestInvoice) {
        return a.latestInvoice.cycleEndDate.toMillis() - b.latestInvoice.cycleEndDate.toMillis();
      }
      return 0;
    });
  }, [attendanceList, allInvoices, studentMembers]);

  const top3Assigned = useMemo(() => sortedAssignedStudents.slice(0, 3), [sortedAssignedStudents]);

  const focusedStudent = useMemo(() => {
    if (!focusedStudentId) return null;
    return studentMembers?.find((member) => member.id === focusedStudentId) || null;
  }, [studentMembers, focusedStudentId]);

  const focusedStudentInvoices = useMemo(() => {
    if (!focusedStudentId) return [];
    return (allInvoices || [])
      .filter((invoice) => invoice.studentId === focusedStudentId)
      .sort((a, b) => {
        const aEnd = a.cycleEndDate?.toDate?.()?.getTime?.() ?? 0;
        const bEnd = b.cycleEndDate?.toDate?.()?.getTime?.() ?? 0;
        if (bEnd !== aEnd) return bEnd - aEnd;
        const aUpdated = a.updatedAt?.toDate?.()?.getTime?.() ?? 0;
        const bUpdated = b.updatedAt?.toDate?.()?.getTime?.() ?? 0;
        return bUpdated - aUpdated;
      });
  }, [allInvoices, focusedStudentId]);

  const focusedLatestInvoice = focusedStudentInvoices[0] || null;

  useEffect(() => {
    if (!focusedStudentId) return;
    setActiveTab('payments');
    if (!allInvoices || allInvoices.length === 0) return;
    const latest = allInvoices.find((invoice) => invoice.studentId === focusedStudentId);
    const month = latest ? getTimelineInvoiceMonth(latest) : null;
    if (month) setTimelineMonth(month);
  }, [focusedStudentId, allInvoices]);

  const timelineMonthOptions = useMemo(() => {
    const recent = Array.from({ length: 18 }, (_, idx) => format(subDays(new Date(), idx * 28), 'yyyy-MM'));
    const fromInvoices = (allInvoices || [])
      .map((invoice) => getTimelineInvoiceMonth(invoice))
      .filter(Boolean) as string[];
    return Array.from(new Set([timelineMonth, ...recent, ...fromInvoices])).sort((a, b) => b.localeCompare(a));
  }, [allInvoices, timelineMonth]);

  const timelineRows = useMemo(() => {
    const rows = (allInvoices || []).filter((invoice) => getTimelineInvoiceMonth(invoice) === timelineMonth);
    const trackFiltered = timelineTrackFilter === 'all'
      ? rows
      : rows.filter((invoice) => resolveInvoiceTrackCategory(invoice) === timelineTrackFilter);

    return [...trackFiltered].sort((a, b) => {
      const aEnd = a.cycleEndDate?.toDate?.()?.getTime?.() ?? 0;
      const bEnd = b.cycleEndDate?.toDate?.()?.getTime?.() ?? 0;
      if (bEnd !== aEnd) return bEnd - aEnd;

      const aUpdated = a.updatedAt?.toDate?.()?.getTime?.() ?? 0;
      const bUpdated = b.updatedAt?.toDate?.()?.getTime?.() ?? 0;
      return bUpdated - aUpdated;
    });
  }, [allInvoices, timelineMonth, timelineTrackFilter]);

  const filteredInvoices = useMemo(() => {
    const baseRows = focusedStudentId
      ? timelineRows.filter((invoice) => invoice.studentId === focusedStudentId)
      : timelineRows;
    if (paymentSubTab === 'all') return baseRows;
    if (paymentSubTab === 'unpaid') return baseRows.filter((invoice) => invoice.status === 'issued' || invoice.status === 'overdue');
    if (paymentSubTab === 'paid') return baseRows.filter((invoice) => invoice.status === 'paid');
    if (paymentSubTab === 'overdue') return baseRows.filter((invoice) => invoice.status === 'overdue');
    return baseRows;
  }, [timelineRows, paymentSubTab, focusedStudentId]);

  const timelineSummary = useMemo(() => {
    return timelineRows.reduce(
      (acc, invoice) => {
        const amount = Number(invoice.finalPrice) || 0;
        const isCollected = invoice.status === 'paid';
        const isArrears = invoice.status === 'issued' || invoice.status === 'overdue';
        acc.billed += amount;
        if (isCollected) acc.collected += amount;
        if (isArrears) acc.arrears += amount;
        return acc;
      },
      { billed: 0, collected: 0, arrears: 0 }
    );
  }, [timelineRows]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayKpi = useMemo(() => kpiHistory?.find(k => k.date === todayStr) || kpiHistory?.[kpiHistory.length - 1], [kpiHistory, todayStr]);
  
  const metrics = useMemo(() => {
    if (!kpiHistory) return null;
    const collected = kpiHistory.reduce((acc, k) => acc + (k.collectedRevenue || 0), 0);
    const accrued = kpiHistory.reduce((acc, k) => acc + (k.totalRevenue || 0), 0);
    return { collected, accrued, uncollected: Math.max(0, accrued - collected) };
  }, [kpiHistory]);

  const formatWon = (value: number) => '₩' + Math.round(value || 0).toLocaleString();

  const handleStatusChange = async (invoiceId: string, status: Invoice['status'], method: any = 'none') => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      await updateInvoiceStatus(firestore, centerId, invoiceId, status, method);
      toast({ title: '수납 상태가 변경되었습니다.' });
      router.refresh();
    } catch (e: any) {
      toast({ variant: 'destructive', title: '변경 실패', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTrackCategoryChange = async (invoiceId: string, trackCategory: InvoiceTrackCategory) => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'invoices', invoiceId), {
        trackCategory,
        updatedAt: serverTimestamp(),
      });
      toast({ title: '인보이스 구분이 ' + INVOICE_TRACK_META[trackCategory].label + '(으)로 변경되었습니다.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '구분 변경 실패', description: e?.message || '다시 시도해 주세요.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePriceDraftChange = (invoiceId: string, nextValue: string) => {
    const digitsOnly = nextValue.replace(/[^\d]/g, '').slice(0, 10);
    setPriceDrafts((prev) => ({ ...prev, [invoiceId]: digitsOnly }));
  };

  const parseDraftPrice = (draft: string) => {
    if (!draft) return null;
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return Math.round(parsed);
  };

  const handlePriceSave = async (invoice: Invoice) => {
    if (!firestore || !centerId) return;
    const draft = priceDrafts[invoice.id] ?? String(Math.round(Number(invoice.finalPrice) || 0));
    const nextPrice = parseDraftPrice(draft);
    if (nextPrice === null) {
      toast({ variant: 'destructive', title: '금액 형식 오류', description: '숫자만 입력해 주세요.' });
      return;
    }
    if (nextPrice === Number(invoice.finalPrice || 0)) {
      toast({ title: '변경된 금액이 없습니다.' });
      return;
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'invoices', invoice.id), {
        finalPrice: nextPrice,
        'priceSnapshot.basePrice': nextPrice,
        updatedAt: serverTimestamp(),
      });

      // 완납 건은 결제 로그 금액도 함께 맞춰서 KPI와 카드 금액 불일치를 최소화한다.
      if (invoice.status === 'paid') {
        const paymentsQuery = query(
          collection(firestore, 'centers', centerId, 'payments'),
          where('invoiceId', '==', invoice.id)
        );
        const paymentsSnap = await getDocs(paymentsQuery);
        if (!paymentsSnap.empty) {
          await Promise.all(
            paymentsSnap.docs.map((paymentDoc) =>
              updateDoc(paymentDoc.ref, { amount: nextPrice, updatedAt: serverTimestamp() })
            )
          );
        }
      }

      setPriceDrafts((prev) => ({ ...prev, [invoice.id]: String(nextPrice) }));
      toast({ title: '학생별 수납 금액이 저장되었습니다.' });
      router.refresh();
    } catch (e: any) {
      toast({ variant: 'destructive', title: '금액 저장 실패', description: e?.message || '다시 시도해 주세요.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRealPayment = (invoiceId: string) => {
    router.push('/payment/checkout/' + invoiceId);
  };

  const handleSendPaymentReminders = async () => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      const count = await autoCheckPaymentReminders(firestore, centerId);
      toast({ title: '알림 발송 완료', description: '결제일 3일 전인 ' + count + '명의 학생에게 알림을 보냈습니다.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '발송 실패', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const createAutoInvoice = async (
    studentId: string,
    _name: string,
    trackCategory: InvoiceTrackCategory = 'studyRoom',
    amount: number = 390000
  ) => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      const trackMeta = INVOICE_TRACK_META[trackCategory];
      const title = trackCategory === 'academy' ? '28일 정기 학원 수강료' : '28일 정기 독서실 이용료';
      await issueInvoice(firestore, centerId, studentId, amount, title, { trackCategory });
      toast({ title: `${trackMeta.label} 인보이스가 추가 발급되었습니다.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '생성 실패', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-500 text-white border-none font-black text-[10px] px-2 py-0.5">수납 완료</Badge>;
      case 'issued':
        return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 font-black text-[10px] px-2 py-0.5">수납 대기</Badge>;
      case 'overdue':
        return <Badge variant="destructive" className="font-black text-[10px] px-2 py-0.5 shadow-sm">연체/미납</Badge>;
      default:
        return <Badge variant="secondary" className="font-black text-[10px] px-2 py-0.5">{status}</Badge>;
    }
  };

  if (membershipsLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" /></div>;

  return (
    <div className={cn("flex flex-col gap-8 w-full max-w-[1400px] mx-auto pb-20", isMobile ? "px-1" : "px-4 py-6")}>
      <header className={cn("flex justify-between items-end", isMobile ? "px-2 flex-col gap-4 items-start" : "")}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary/60">
            <Calculator className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">고급 수납 관리 센터</span>
          </div>
          <h1 className={cn("font-black tracking-tighter text-primary leading-none", isMobile ? "text-3xl" : "text-5xl")}>
            센터관리자 실전 수납·수익 통합 분석
          </h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSendPaymentReminders} disabled={isSaving} variant="outline" className="rounded-2xl font-black gap-2 h-12 border-2 bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all">
            <BellRing className="h-4 w-4" /> 미납 알림 즉시 발송
          </Button>
          <Button onClick={() => setIsSettingsOpen(true)} variant="outline" className="rounded-2xl font-black gap-2 h-12 border-2 bg-white shadow-sm hover:bg-primary hover:text-white transition-all">
            <Settings className="h-4 w-4" /> 수납/인보이스 설정
          </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 bg-muted/30 p-1.5 rounded-[1.5rem] border border-border/50 shadow-inner h-16 max-w-3xl mb-8">
          <TabsTrigger value="payments" className="rounded-xl font-black gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <CreditCard className="h-4 w-4" /> 수납 및 미납 관리
          </TabsTrigger>
          <TabsTrigger value="revenue" className="rounded-xl font-black gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <TrendingUp className="h-4 w-4" /> 수익 분석
          </TabsTrigger>
          <TabsTrigger value="risk" className="rounded-xl font-black gap-2 data-[state=active]:bg-rose-600 data-[state=active]:text-white">
            <ShieldAlert className="h-4 w-4" /> 리스크 인텔리전스
          </TabsTrigger>
          <TabsTrigger value="ops" className="rounded-xl font-black gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Activity className="h-4 w-4" /> 운영 인텔리전스
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-8 animate-in fade-in duration-500">
          {focusedStudentId && (
            <Card className="rounded-[2.5rem] border-none bg-white shadow-xl ring-1 ring-primary/10">
              <CardHeader className={cn('gap-4 border-b bg-primary/5', isMobile ? 'p-5' : 'p-7')}>
                <div className={cn('flex items-start justify-between gap-3', isMobile ? 'flex-col' : 'flex-row')}>
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
                      <Settings className="h-5 w-5 text-primary/60" /> 선택 학생 상세 수납 관리
                    </CardTitle>
                    <CardDescription>
                      {focusedStudent
                        ? `${focusedStudent.displayName || '학생'} 학생의 인보이스를 보고 추가 발행할 수 있습니다.`
                        : '선택된 학생 정보를 불러오는 중입니다.'}
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 rounded-xl font-black"
                    onClick={() => router.push('/dashboard/revenue?tab=payments')}
                  >
                    학생 선택 해제
                  </Button>
                </div>
              </CardHeader>
              <CardContent className={cn('space-y-4', isMobile ? 'p-5' : 'p-7')}>
                <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'md:grid-cols-3')}>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <p className="text-[11px] font-bold text-slate-500">학생 이름</p>
                    <p className="mt-1 text-xl font-black text-slate-900">{focusedStudent?.displayName || '학생'}</p>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                    <p className="text-[11px] font-bold text-blue-700">최근 결제 마감일</p>
                    <p className="mt-1 text-xl font-black text-blue-700">
                      {focusedLatestInvoice?.cycleEndDate ? format(focusedLatestInvoice.cycleEndDate.toDate(), 'yyyy.MM.dd') : '-'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                    <p className="text-[11px] font-bold text-emerald-700">최근 상태</p>
                    <div className="mt-1">{focusedLatestInvoice ? getStatusBadge(focusedLatestInvoice.status) : <Badge variant="outline">인보이스 없음</Badge>}</div>
                  </div>
                </div>

                <div className={cn('grid gap-2', isMobile ? 'grid-cols-1' : 'sm:grid-cols-2')}>
                  <Button
                    type="button"
                    onClick={() =>
                      createAutoInvoice(
                        focusedStudentId,
                        focusedStudent?.displayName || '학생',
                        'studyRoom',
                        Number(quickIssueAmount || 390000) || 390000
                      )
                    }
                    disabled={isSaving}
                    variant="outline"
                    className="h-11 rounded-xl font-black border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 gap-2"
                  >
                    {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <PlusCircle className="h-4 w-4" />} 독서실 인보이스 추가 발행
                  </Button>
                  <Button
                    type="button"
                    onClick={() =>
                      createAutoInvoice(
                        focusedStudentId,
                        focusedStudent?.displayName || '학생',
                        'academy',
                        Number(quickIssueAmount || 390000) || 390000
                      )
                    }
                    disabled={isSaving}
                    variant="outline"
                    className="h-11 rounded-xl font-black border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 gap-2"
                  >
                    {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <PlusCircle className="h-4 w-4" />} 학원 인보이스 추가 발행
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-[2.5rem] border-none bg-white shadow-xl ring-1 ring-border/50">
            <CardHeader className={cn('gap-4', isMobile ? 'p-5' : 'p-7')}>
              <div className={cn('flex items-start justify-between gap-3', isMobile ? 'flex-col' : 'flex-row')}>
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
                    <History className="h-5 w-5 text-primary/60" /> 수납 및 미납 관리 · 월별 자동 집계
                  </CardTitle>
                  <CardDescription>
                    수납/미납 관리에서 입력한 인보이스를 월별·트랙별로 자동 집계합니다. 독서실/학원 데이터를 같은 화면에서 비교할 수 있습니다.
                  </CardDescription>
                </div>
              </div>

              <div className={cn('flex items-center gap-2', isMobile ? 'flex-col items-stretch' : 'flex-row')}>
                <Input
                  type="month"
                  value={timelineMonth}
                  onChange={(event) => setTimelineMonth(event.target.value || format(new Date(), 'yyyy-MM'))}
                  className={cn('h-10 rounded-xl', isMobile ? 'w-full' : 'w-[180px]')}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={timelineTrackFilter === 'all' ? 'default' : 'outline'}
                    className="rounded-lg font-black"
                    onClick={() => setTimelineTrackFilter('all')}
                  >
                    전체 트랙
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={timelineTrackFilter === 'studyRoom' ? 'default' : 'outline'}
                    className="rounded-lg font-black"
                    onClick={() => setTimelineTrackFilter('studyRoom')}
                  >
                    독서실
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={timelineTrackFilter === 'academy' ? 'default' : 'outline'}
                    className="rounded-lg font-black"
                    onClick={() => setTimelineTrackFilter('academy')}
                  >
                    학원
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {timelineMonthOptions.slice(0, 6).map((month) => (
                    <Button
                      key={month}
                      type="button"
                      size="sm"
                      variant={month === timelineMonth ? 'default' : 'outline'}
                      className="h-7 rounded-lg px-2 text-[10px] font-bold"
                      onClick={() => setTimelineMonth(month)}
                    >
                      {month}
                    </Button>
                  ))}
                </div>

                {focusedStudentId && (
                  <div className="rounded-xl border border-primary/10 bg-primary/5 px-3 py-2 text-[11px] font-bold text-primary">
                    현재 선택 학생 필터가 적용되어 이 학생의 인보이스만 표시됩니다.
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className={cn('space-y-4', isMobile ? 'px-5 pb-5' : 'px-7 pb-7')}>
              <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'md:grid-cols-3')}>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-bold text-slate-500">청구금액</p>
                  <p className="mt-1 text-xl font-black text-slate-900">{formatWon(timelineSummary.billed)}</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <p className="text-[11px] font-bold text-emerald-700">수납금액</p>
                  <p className="mt-1 text-xl font-black text-emerald-700">{formatWon(timelineSummary.collected)}</p>
                </div>
                <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
                  <p className="text-[11px] font-bold text-rose-700">미납금액</p>
                  <p className="mt-1 text-xl font-black text-rose-700">{formatWon(timelineSummary.arrears)}</p>
                </div>
              </div>

              {timelineRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed py-8 text-center text-sm font-semibold text-muted-foreground">
                  선택한 월/트랙에 해당하는 인보이스가 없습니다. 수납/미납 관리에서 먼저 인보이스를 등록해 주세요.
                </div>
              ) : (
                <div className="space-y-2">
                  {timelineRows.slice(0, 12).map((invoice) => {
                    const track = resolveInvoiceTrackCategory(invoice);
                    const trackMeta = INVOICE_TRACK_META[track];
                    return (
                      <div key={`timeline-${invoice.id}`} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-black text-slate-800">{invoice.studentName}</span>
                            <Badge className={cn('border text-[10px] font-black', trackMeta.badgeClass)}>{trackMeta.label}</Badge>
                            {getStatusBadge(invoice.status)}
                          </div>
                          <p className="text-[11px] font-bold text-slate-400">
                            마감일 {invoice.cycleEndDate ? format(invoice.cycleEndDate.toDate(), 'yyyy.MM.dd') : '-'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900">{formatWon(invoice.finalPrice)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-12">
            <div className="md:col-span-8 space-y-6">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
                <CardHeader className="bg-muted/5 border-b p-8">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-2">
                        <History className="h-6 w-6 opacity-40" /> 인보이스 타임라인</CardTitle>
                      <CardDescription className="font-bold text-xs tracking-widest text-muted-foreground/60 whitespace-nowrap">28일 결제 주기 기준</CardDescription>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Badge variant="outline" className="font-black text-[10px]">
                          조회월 {timelineMonth}
                        </Badge>
                        <Badge variant="outline" className="font-black text-[10px]">
                          {timelineTrackFilter === 'all' ? '전체 트랙' : timelineTrackFilter === 'studyRoom' ? '독서실' : '학원'}
                        </Badge>
                      </div>
                    </div>
                    <Tabs value={paymentSubTab} onValueChange={setPaymentSubTab} className="w-full sm:w-auto">
                      <TabsList className="bg-muted/50 p-1 rounded-xl h-10 border shadow-inner">
                        <TabsTrigger value="all" className="rounded-lg text-[10px] font-black px-3">전체</TabsTrigger>
                        <TabsTrigger value="unpaid" className="rounded-lg text-[10px] font-black px-3 text-amber-600">대기</TabsTrigger>
                        <TabsTrigger value="paid" className="rounded-lg text-[10px] font-black px-3 text-emerald-600">완료</TabsTrigger>
                        <TabsTrigger value="overdue" className="rounded-lg text-[10px] font-black px-3 text-rose-600">미납</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-muted/10">
                    {isInvoicesLoading ? (
                      <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
                    ) : filteredInvoices.length === 0 ? (
                      <div className="py-24 text-center flex flex-col items-center gap-6">
                        <div className="p-8 rounded-full bg-muted/20">
                          <Receipt className="h-16 w-16 text-muted-foreground opacity-10" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-lg font-black text-muted-foreground/40 uppercase tracking-widest">조회된 인보이스가 없습니다.</p>
                          <p className="text-xs font-bold text-muted-foreground/30">{timelineMonth} · {timelineTrackFilter === 'all' ? '전체 트랙' : timelineTrackFilter === 'studyRoom' ? '독서실' : '학원'} 조건에서 인보이스를 찾지 못했습니다.</p>
                        </div>
                      </div>
                    ) : filteredInvoices.map((inv) => {
                      const studentSeat = attendanceList?.find(a => a.studentId === inv.studentId);
                      const invoiceTrack = resolveInvoiceTrackCategory(inv);
                      const trackMeta = INVOICE_TRACK_META[invoiceTrack];
                      const draftPrice = priceDrafts[inv.id] ?? String(Math.round(Number(inv.finalPrice) || 0));
                      const parsedDraftPrice = parseDraftPrice(draftPrice);
                      const canSavePrice = parsedDraftPrice !== null && parsedDraftPrice !== Number(inv.finalPrice || 0);
                      return (
                        <div key={inv.id} className={cn(
                          "p-8 flex flex-col gap-6 hover:bg-muted/5 transition-all group",
                          inv.status === 'paid' ? "bg-emerald-50/5" : ""
                        )}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-5">
                              <div className={cn(
                                "h-14 w-14 rounded-2xl flex items-center justify-center font-black text-xl border-2 transition-all duration-500 shadow-inner shrink-0",
                                inv.status === 'paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-primary/5 text-primary border-primary/10 group-hover:bg-primary group-hover:text-white"
                              )}>
                                {inv.studentName?.charAt(0)}
                              </div>
                              <div className="grid gap-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-black text-xl tracking-tight truncate">{inv.studentName} 학생</span>
                                  {studentSeat && <Badge variant="outline" className="font-black text-[8px] border-primary/20 text-primary/60 whitespace-nowrap">{studentSeat.seatZone || '미정'}</Badge>}
                                  <Badge className={cn("border text-[9px] font-black", trackMeta.badgeClass)}>{trackMeta.label}</Badge>
                                  {getStatusBadge(inv.status)}
                                </div>
                                <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground">
                                  <span className="flex items-center gap-1 bg-muted/30 px-2 py-0.5 rounded-md whitespace-nowrap"><CalendarCheck className="h-3 w-3" /> 기간: {inv.cycleStartDate ? format(inv.cycleStartDate.toDate(), 'MM.dd') : '--.--'} ~ {inv.cycleEndDate ? format(inv.cycleEndDate.toDate(), 'MM.dd') : '--.--'} (28일)</span>
                                  {inv.paidAt && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> 완료: {format(inv.paidAt.toDate(), 'MM.dd HH:mm')}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={cn(
                                "text-2xl font-black tracking-tighter",
                                inv.status === 'paid' ? "text-emerald-600" : "text-primary"
                              )}>{formatWon(inv.finalPrice)}</p>
                              <div className="mt-2 flex items-center justify-end gap-1.5">
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  value={draftPrice}
                                  onChange={(event) => handlePriceDraftChange(inv.id, event.target.value)}
                                  disabled={isSaving}
                                  placeholder="금액"
                                  className="h-7 w-[112px] rounded-md px-2 text-right text-[11px] font-black"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handlePriceSave(inv)}
                                  disabled={isSaving || !canSavePrice}
                                  className="h-7 rounded-md px-2 text-[10px] font-black"
                                >
                                  금액 저장
                                </Button>
                              </div>
                              <Select 
                                value={inv.status} 
                                onValueChange={(val: any) => handleStatusChange(inv.id, val)}
                                disabled={isSaving}
                              >
                                <SelectTrigger className="border-none shadow-none focus:ring-0 h-6 p-0 text-right font-black text-[9px] uppercase tracking-widest text-primary/40 hover:text-primary transition-all">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-2xl">
                                  <SelectItem value="issued" className="font-bold">대기</SelectItem>
                                  <SelectItem value="paid" className="font-bold">완료</SelectItem>
                                  <SelectItem value="overdue" className="font-bold">미납</SelectItem>
                                  <SelectItem value="void" className="font-bold">무효</SelectItem>
                                </SelectContent>
                              </Select>
                              <Select
                                value={invoiceTrack}
                                onValueChange={(val: InvoiceTrackCategory) => handleTrackCategoryChange(inv.id, val)}
                                disabled={isSaving}
                              >
                                <SelectTrigger className="mt-1 border-none shadow-none focus:ring-0 h-6 p-0 text-right font-black text-[9px] uppercase tracking-widest text-primary/40 hover:text-primary transition-all">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-2xl">
                                  <SelectItem value="studyRoom" className="font-bold">독서실</SelectItem>
                                  <SelectItem value="academy" className="font-bold">학원</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          {inv.status !== 'paid' && (
                            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
                              <Button 
                                onClick={() => handleRealPayment(inv.id)}
                                className="flex-1 h-12 rounded-xl font-black text-sm gap-3 text-white bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 active:scale-[0.98] transition-all"
                              >
                                <CreditCard className="h-5 w-5" /> 실제 카드 결제 진행 (토스 연동)
                              </Button>
                              <Select onValueChange={(val) => handleStatusChange(inv.id, 'paid', val)}>
                                <SelectTrigger className="w-[160px] h-12 rounded-xl font-black text-xs border-2 bg-white text-emerald-600 border-emerald-100 shadow-md">
                                  <div className="flex items-center gap-2"><RefreshCw className="h-4 w-4" /><SelectValue placeholder="수동 수납 처리" /></div>
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-2xl p-2">
                                  <SelectItem value="card" className="font-bold py-3 rounded-xl">카드 결제 수동 완료</SelectItem>
                                  <SelectItem value="transfer" className="font-bold py-3 rounded-xl">계좌 이체 수동 완료</SelectItem>
                                  <SelectItem value="cash" className="font-bold py-3 rounded-xl">현금 수납 수동 완료</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-4 space-y-6">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 overflow-hidden relative group ring-1 ring-border/50">
                <div className="absolute -right-4 -top-4 opacity-5 rotate-12 group-hover:scale-110 transition-transform duration-1000"><Armchair className="h-32 w-32" /></div>
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-black tracking-tighter">배정 학생 우선순위</CardTitle>
                    <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-black text-[9px]">우선순위</Badge>
                  </div>
                  <div className="space-y-3">
                    {top3Assigned.map(({ seat, student, latestInvoice, isOverdue, overdueDays }: any) => {
                      return (
                        <div key={seat.id} className="flex flex-col p-5 rounded-3xl bg-[#fafafa] border border-border/50 hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group/seat">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-2xl bg-white border-2 border-primary/5 flex items-center justify-center font-black text-xs text-primary/40 shadow-inner group-hover/seat:bg-primary group-hover/seat:text-white transition-all">
                                {seat.seatNo}
                              </div>
                              <div className="grid">
                                <span className="font-black text-base tracking-tight">{student?.displayName || '학생'}</span>
                                <span className="text-[8px] font-bold text-muted-foreground uppercase opacity-60">{seat.seatZone || '자유석'}</span>
                              </div>
                            </div>
                            {latestInvoice ? (
                              <Badge className={cn(
                                "font-black text-[9px] border-none px-2 h-5",
                                latestInvoice.status === 'paid' ? "bg-emerald-500" : (latestInvoice.cycleEndDate.toDate() < new Date() ? "bg-rose-500 animate-pulse" : "bg-amber-500")
                              )}>
                                {latestInvoice.status === 'paid' ? '수납 완료' : (latestInvoice.cycleEndDate.toDate() < new Date() ? '미납/연체' : '수납 대기')}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="font-black text-[9px] opacity-40">미청구</Badge>
                            )}
                          </div>

                          {latestInvoice && (
                            <div className="space-y-2.5">
                              <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-muted-foreground">이전 수납</span>
                                <span className="text-primary">{latestInvoice.paidAt ? format(latestInvoice.paidAt.toDate(), 'yyyy.MM.dd') : '기록 없음'}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-muted-foreground">다음 결제 예정</span>
                                <span className="text-blue-600">{format(latestInvoice.cycleEndDate.toDate(), 'yyyy.MM.dd')}</span>
                              </div>
                              {latestInvoice.status !== 'paid' && latestInvoice.cycleEndDate.toDate() < new Date() && (
                                <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  <span className="text-[10px] font-black uppercase">미납 D+{differenceInDays(new Date(), latestInvoice.cycleEndDate.toDate())}</span>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="grid grid-cols-1 gap-2">
                            <Button
                              size="sm"
                              onClick={() => createAutoInvoice(seat.studentId!, student?.displayName || '학생', 'studyRoom')}
                              disabled={isSaving}
                              variant="outline"
                              className="w-full h-10 rounded-xl font-black text-xs border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 gap-2"
                            >
                              {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <PlusCircle className="h-4 w-4" />} 독서실 추가 발급
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => createAutoInvoice(seat.studentId!, student?.displayName || '학생', 'academy')}
                              disabled={isSaving}
                              variant="outline"
                              className="w-full h-10 rounded-xl font-black text-xs border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 gap-2"
                            >
                              {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <PlusCircle className="h-4 w-4" />} 학원 추가 발급
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    
                    {sortedAssignedStudents.length > 3 && (
                      <Button asChild variant="ghost" className="w-full h-12 rounded-2xl font-black text-xs text-muted-foreground hover:text-primary border-2 border-dashed">
                        <Link href="/dashboard/revenue/assigned-students">
                          전체 배정 학생 보기 ({sortedAssignedStudents.length}명) <ChevronRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    )}

                    {(!attendanceList || attendanceList.filter(a => a.studentId).length === 0) && (
                      <div className="py-20 text-center flex flex-col items-center gap-4 opacity-20">
                        <Users className="h-12 w-12" />
                        <p className="text-[10px] font-black uppercase">현재 활성 배정 학생이 없습니다.</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="rounded-[2.5rem] border-none shadow-xl bg-primary text-primary-foreground p-8 overflow-hidden relative">
                <Sparkles className="absolute -right-4 -top-4 h-32 w-32 opacity-20 rotate-12" />
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 opacity-60" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60 whitespace-nowrap">매출 건전성 지수</span>
                  </div>
                  <div className="grid gap-1">
                    <h3 className="text-5xl font-black tracking-tighter">{(metrics?.collected && metrics?.accrued) ? Math.round((metrics.collected / metrics.accrued) * 100) : 0}%</h3>
                    <p className="text-xs font-bold opacity-60">당월 수납 달성률 (수납액/발생액)</p>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-60"><span>발생 매출</span><span>{formatWon(metrics?.accrued || 0)}</span></div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-60"><span>수납 매출</span><span>{formatWon(metrics?.collected || 0)}</span></div>
                  </div>
                </div>
              </Card>

              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 group ring-1 ring-border/50">
                <CardTitle className="text-base font-black mb-6 uppercase tracking-widest text-primary/40 flex items-center gap-2"><PieChart className="h-4 w-4" /> 결제 수단 비중</CardTitle>
                <div className="space-y-4">
                  <div className="flex justify-between items-end"><span className="text-xs font-bold text-muted-foreground whitespace-nowrap">카드 결제 연동</span><span className="text-lg font-black text-blue-600">72%</span></div>
                  <Progress value={72} className="h-1.5" />
                  <div className="flex justify-between items-end"><span className="text-xs font-bold text-muted-foreground">계좌/현금</span><span className="text-lg font-black text-emerald-600">28%</span></div>
                  <Progress value={28} className="h-1.5 bg-muted" />
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-8 animate-in fade-in duration-500">
          <section className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-4")}>
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-primary text-primary-foreground p-8 overflow-hidden relative">
              <DollarSign className="absolute -right-4 -top-4 h-32 w-32 opacity-10 rotate-12" />
              <div className="relative z-10 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">당월 발생 매출</p>
                <h3 className="text-4xl font-black tracking-tighter text-[#14295F]">{formatWon(metrics?.accrued || 0)}</h3>
                <Badge className="bg-white/20 border-none text-[10px] px-3 text-emerald-400 whitespace-nowrap">발생 기준</Badge>
              </div>
            </Card>
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-emerald-600 text-white p-8 overflow-hidden relative">
              <Wallet className="absolute -right-4 -top-4 h-32 w-32 opacity-10 rotate-12" />
              <div className="relative z-10 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">실제 수납 금액</p>
                <h3 className="text-4xl font-black tracking-tighter text-[#14295F]">{formatWon(metrics?.collected || 0)}</h3>
                <Badge className="bg-white/20 border-none text-[10px] px-3 text-white whitespace-nowrap">수납 기준</Badge>
              </div>
            </Card>
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-border/50">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2"><Receipt className="h-3 w-3 text-rose-500" /> 미수금 합계</p>
              <h3 className="text-4xl font-black tracking-tighter text-rose-600">{formatWon(metrics?.uncollected || 0)}</h3>
              <p className="text-[10px] font-bold text-muted-foreground mt-1 whitespace-nowrap">미수 잔액</p>
            </Card>
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-border/50">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2"><Users className="h-3 w-3 text-blue-500" /> 수납 인원</p>
              <h3 className="text-4xl font-black tracking-tighter text-primary">{todayKpi?.activeStudentCount || 0}<span className="text-lg opacity-40 ml-1">명</span></h3>
              <p className="text-[10px] font-bold text-muted-foreground mt-1 whitespace-nowrap">수납 인원</p>
            </Card>
          </section>

          <RevenueAnalysis />
        </TabsContent>

        <TabsContent value="risk" className="animate-in fade-in duration-500">
          <RiskIntelligence />
        </TabsContent>

        <TabsContent value="ops" className="animate-in fade-in duration-500">
          <OperationalIntelligence />
        </TabsContent>
      </Tabs>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="rounded-[2rem] border-none shadow-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">수납/인보이스 설정</DialogTitle>
            <DialogDescription className="font-semibold">
              인보이스 발행 기본값을 조정하고 배정 학생 상세 수납 화면으로 이동할 수 있습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid gap-2">
              <Label htmlFor="quickIssueAmount" className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                기본 발행 금액
              </Label>
              <Input
                id="quickIssueAmount"
                type="text"
                inputMode="numeric"
                value={quickIssueAmount}
                onChange={(event) => setQuickIssueAmount(event.target.value.replace(/[^\d]/g, '').slice(0, 10))}
                placeholder="예: 390000"
                className="h-11 rounded-xl font-black"
              />
              <p className="text-[11px] font-semibold text-muted-foreground">
                상세 관리로 들어간 뒤 추가 발행할 때 이 금액이 기본값으로 사용됩니다.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-semibold text-slate-600">
              상세 관리 버튼으로 진입하면 이미 인보이스가 있는 학생도 독서실/학원 인보이스를 추가 발행할 수 있습니다.
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl font-black"
              onClick={() => {
                setIsSettingsOpen(false);
                router.push('/dashboard/revenue/assigned-students');
              }}
            >
              배정 재원생 수납 화면 열기
            </Button>
            <Button type="button" className="rounded-xl font-black" onClick={() => setIsSettingsOpen(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
