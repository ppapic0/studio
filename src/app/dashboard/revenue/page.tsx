
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/contexts/app-context';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, doc, getDocs, orderBy, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  AttendanceCurrent,
  BusinessLedgerCategory,
  BusinessLedgerDirection,
  BusinessLedgerEntry,
  BusinessLedgerPaymentMethod,
  BusinessLedgerProofStatus,
  BusinessLedgerTrackScope,
  CenterMembership,
  Invoice,
  PaymentRecord,
} from '@/lib/types';
import {
  BUSINESS_LEDGER_CATEGORY_META,
  BUSINESS_LEDGER_CATEGORY_OPTIONS,
  BUSINESS_LEDGER_DIRECTION_META,
  BUSINESS_LEDGER_PAYMENT_METHOD_META,
  BUSINESS_LEDGER_PROOF_STATUS_META,
  BUSINESS_LEDGER_TRACK_SCOPE_META,
  formatBusinessLedgerCategoryLabel,
  formatBusinessLedgerPaymentMethodLabel,
  formatBusinessLedgerProofStatusLabel,
  getBusinessLedgerMonth,
  matchesBusinessLedgerTrackFilter,
} from '@/lib/business-ledger';
import { getPaymentMonth, INVOICE_TRACK_META, resolveInvoiceTrackCategory, type InvoiceTrackCategory } from '@/lib/invoice-analytics';
import {
  formatInvoiceCollectionInputDate,
  getInvoiceCollectionEndDate,
  getInvoiceCollectionSortTime,
  getInvoiceCollectionStartDate,
  isInvoiceCollectionOverdue,
} from '@/lib/invoice-collection-window';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
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
  CreditCard,
  Receipt,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  PlusCircle,
  BellRing,
  Megaphone,
  CheckCircle2,
  FileText,
  Clock,
  Filter,
  Armchair,
  Info,
  CalendarCheck,
  History,
  AlertTriangle,
  Search,
  PencilLine,
  Trash2,
  NotebookPen,
  Landmark
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subDays, addDays, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { RevenueAnalysis } from '@/components/dashboard/revenue-analysis';
import { useToast } from '@/hooks/use-toast';
import {
  clearLegacyInvoiceCollectionData,
  createBusinessLedgerEntry,
  deleteBusinessLedgerEntry,
  issueManualAcademyInvoice,
  issueInvoice,
  resetInvoiceCollectionState,
  updateBusinessLedgerEntry,
  updateInvoiceCollectionWindow,
  updateInvoiceStatus,
} from '@/lib/finance-actions';
import { formatSeatLabel, getSeatDisplayLabel, resolveSeatIdentity } from '@/lib/seat-layout';
import { useRouter, useSearchParams } from 'next/navigation';
import { autoCheckPaymentReminders } from '@/lib/kakao-service';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { AdminWorkbenchCommandBar } from '@/components/dashboard/admin-workbench-command-bar';
import { canReadFinance } from '@/lib/dashboard-access';

const OperationalIntelligencePanel = dynamic(
  () => import('@/components/dashboard/operational-intelligence').then((mod) => mod.OperationalIntelligence),
  {
    ssr: false,
    loading: () => (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
        <p className="text-xs font-bold text-muted-foreground/60">운영 인텔리전스를 불러오는 중입니다...</p>
      </div>
    ),
  }
);

const RiskIntelligencePanel = dynamic(
  () => import('@/components/dashboard/risk-intelligence').then((mod) => mod.RiskIntelligence),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="h-7 w-7 animate-spin text-rose-500/40" />
        <p className="text-xs font-bold text-[#9aa9c7]">리스크 분석을 준비하는 중입니다...</p>
      </div>
    ),
  }
);

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

type LedgerDraft = {
  entryDate: string;
  direction: BusinessLedgerDirection;
  trackScope: BusinessLedgerTrackScope;
  category: BusinessLedgerCategory;
  description: string;
  counterparty: string;
  amount: string;
  paymentMethod: BusinessLedgerPaymentMethod;
  proofStatus: BusinessLedgerProofStatus;
  memo: string;
};

type CollectionWindowDraft = {
  collectionStartDate: string;
  collectionEndDate: string;
};

function getDefaultLedgerEntryDate(selectedMonth: string) {
  const today = new Date();
  const currentMonth = format(today, 'yyyy-MM');
  if (selectedMonth === currentMonth) {
    return format(today, 'yyyy-MM-dd');
  }
  return `${selectedMonth}-01`;
}

function createDefaultLedgerDraft(selectedMonth: string): LedgerDraft {
  return {
    entryDate: getDefaultLedgerEntryDate(selectedMonth),
    direction: 'expense',
    trackScope: 'center',
    category: 'other_expense',
    description: '',
    counterparty: '',
    amount: '',
    paymentMethod: 'transfer',
    proofStatus: 'pending',
    memo: '',
  };
}

function parseLedgerDate(value: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function createCollectionWindowDraft(invoice: Invoice): CollectionWindowDraft {
  return {
    collectionStartDate: formatInvoiceCollectionInputDate(
      getInvoiceCollectionStartDate(invoice),
      formatInvoiceCollectionInputDate(toDateSafe((invoice as any).issuedAt))
    ),
    collectionEndDate: formatInvoiceCollectionInputDate(
      getInvoiceCollectionEndDate(invoice),
      formatInvoiceCollectionInputDate(toDateSafe((invoice as any).cycleEndDate))
    ),
  };
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
  const isFinanceViewer = canReadFinance(activeMembership?.role);
  const focusedStudentId = searchParams.get('studentId');

  const [activeTab, setActiveTab] = useState('payments'); 
  const [paymentSubTab, setPaymentSubTab] = useState('all');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [timelineDeleteTarget, setTimelineDeleteTarget] = useState<Invoice | null>(null);
  const [showRiskPanel, setShowRiskPanel] = useState(false);
  const [quickIssueAmount, setQuickIssueAmount] = useState('390000');
  const [manualAcademyStudentName, setManualAcademyStudentName] = useState('');
  const [manualAcademyPhone, setManualAcademyPhone] = useState('');
  const [manualAcademyMemo, setManualAcademyMemo] = useState('');
  const [timelineMonth, setTimelineMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [timelineTrackFilter, setTimelineTrackFilter] = useState<'all' | InvoiceTrackCategory>('all');
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [collectionWindowDrafts, setCollectionWindowDrafts] = useState<Record<string, CollectionWindowDraft>>({});
  const [ledgerDraft, setLedgerDraft] = useState<LedgerDraft>(() => createDefaultLedgerDraft(format(new Date(), 'yyyy-MM')));
  const [editingLedgerEntryId, setEditingLedgerEntryId] = useState<string | null>(null);

  // 1. 인보이스 전체 조회
  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isFinanceViewer) return null;
    return query(
      collection(firestore, 'centers', centerId, 'invoices'),
      orderBy('cycleEndDate', 'desc')
    );
  }, [firestore, centerId, isFinanceViewer]);
  const { data: allInvoices, isLoading: isInvoicesLoading } = useCollection<Invoice>(invoicesQuery, { enabled: isFinanceViewer });

  // 2. 실제 수납 로그 조회
  const paymentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isFinanceViewer) return null;
    return query(
      collection(firestore, 'centers', centerId, 'payments'),
      orderBy('processedAt', 'desc')
    );
  }, [firestore, centerId, isFinanceViewer]);
  const { data: paymentRecords } = useCollection<PaymentRecord>(paymentsQuery, { enabled: isFinanceViewer });

  const ledgerEntriesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isFinanceViewer) return null;
    return query(
      collection(firestore, 'centers', centerId, 'businessLedgerEntries'),
      orderBy('entryDate', 'desc')
    );
  }, [firestore, centerId, isFinanceViewer]);
  const { data: businessLedgerEntries } = useCollection<BusinessLedgerEntry>(ledgerEntriesQuery, { enabled: isFinanceViewer });

  // 3. 현재 좌석/출결 상태 조회
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isFinanceViewer) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId, isFinanceViewer]);
  const { data: attendanceList } = useCollection<AttendanceCurrent>(attendanceQuery, { enabled: isFinanceViewer });

  // 4. 활성 학생 멤버 목록 조회
  const studentMembersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isFinanceViewer) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'),
      where('role', '==', 'student'),
      where('status', '==', 'active')
    );
  }, [firestore, centerId, isFinanceViewer]);
  const { data: studentMembers } = useCollection<CenterMembership>(studentMembersQuery, { enabled: isFinanceViewer });

  const invoiceById = useMemo(() => new Map((allInvoices || []).map((invoice) => [invoice.id, invoice])), [allInvoices]);
  const seatByStudentId = useMemo(
    () =>
      new Map(
        (attendanceList || [])
          .filter((seat) => !!seat.studentId)
          .map((seat) => [seat.studentId as string, seat])
      ),
    [attendanceList]
  );

  const studentActionQueue = useMemo(() => {
    if (!allInvoices || !studentMembers) return [];

    return studentMembers
      .map((student) => {
        const seat = seatByStudentId.get(student.id) || null;
        const studentInvoices = allInvoices
          .filter((invoice) => invoice.studentId === student.id)
          .sort((a, b) => {
            const aEnd = getInvoiceCollectionSortTime(a);
            const bEnd = getInvoiceCollectionSortTime(b);
            if (bEnd !== aEnd) return bEnd - aEnd;
            const aUpdated = a.updatedAt?.toDate?.()?.getTime?.() ?? 0;
            const bUpdated = b.updatedAt?.toDate?.()?.getTime?.() ?? 0;
            return bUpdated - aUpdated;
          });

        const latestInvoice = studentInvoices[0] || null;
        const totalOutstanding = studentInvoices.reduce((sum, invoice) => {
          if (invoice.status === 'issued' || invoice.status === 'overdue') {
            return sum + (Number(invoice.finalPrice) || 0);
          }
          return sum;
        }, 0);

        let priority = 10;
        let overdueDays = 0;
        let statusTone: 'critical' | 'warning' | 'neutral' | 'stable' = 'stable';
        let statusLabel = '수납 완료';
        let nextAction = '완료 상태 유지';

        if (!latestInvoice) {
          priority = 100;
          statusTone = 'neutral';
          statusLabel = '청구 필요';
          nextAction = '첫 인보이스를 발행해 주세요.';
        } else if (latestInvoice.status !== 'paid' && isInvoiceCollectionOverdue(latestInvoice)) {
          priority = 90;
          const collectionEndDate = getInvoiceCollectionEndDate(latestInvoice);
          overdueDays = collectionEndDate ? differenceInDays(new Date(), collectionEndDate) : 0;
          statusTone = 'critical';
          statusLabel = '미납/연체';
          nextAction = latestInvoice.nextAction || '즉시 확인 후 학부모 상담이 필요합니다.';
        } else if (latestInvoice.status !== 'paid') {
          priority = 80;
          statusTone = 'warning';
          statusLabel = '수납 대기';
          nextAction = latestInvoice.nextAction || '마감일 전에 수납 상태를 확인해 주세요.';
        }

        return {
          student,
          seat,
          latestInvoice,
          studentInvoices,
          priority,
          overdueDays,
          totalOutstanding,
          statusTone,
          statusLabel,
          nextAction,
        };
      })
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        const aLatest = a.latestInvoice ? getInvoiceCollectionSortTime(a.latestInvoice) : Number.MAX_SAFE_INTEGER;
        const bLatest = b.latestInvoice ? getInvoiceCollectionSortTime(b.latestInvoice) : Number.MAX_SAFE_INTEGER;
        return aLatest - bLatest;
      });
  }, [allInvoices, seatByStudentId, studentMembers]);

  const topActionStudents = useMemo(() => studentActionQueue.slice(0, 3), [studentActionQueue]);
  const studentById = useMemo(() => new Map((studentMembers || []).map((member) => [member.id, member])), [studentMembers]);

  const focusedStudent = useMemo(() => {
    if (!focusedStudentId) return null;
    return studentMembers?.find((member) => member.id === focusedStudentId) || null;
  }, [studentMembers, focusedStudentId]);

  const focusedStudentInvoices = useMemo(() => {
    if (!focusedStudentId) return [];
    return (allInvoices || [])
      .filter((invoice) => invoice.studentId === focusedStudentId)
      .sort((a, b) => {
        const aEnd = getInvoiceCollectionSortTime(a);
        const bEnd = getInvoiceCollectionSortTime(b);
        if (bEnd !== aEnd) return bEnd - aEnd;
        const aUpdated = a.updatedAt?.toDate?.()?.getTime?.() ?? 0;
        const bUpdated = b.updatedAt?.toDate?.()?.getTime?.() ?? 0;
        return bUpdated - aUpdated;
      });
  }, [allInvoices, focusedStudentId]);

  const focusedLatestInvoice = focusedStudentInvoices[0] || null;
  const revenueFocusedStudentId = focusedStudentId || studentActionQueue[0]?.student.id || null;
  const revenueFocusedStudent = revenueFocusedStudentId ? studentById.get(revenueFocusedStudentId) || null : null;
  const revenueFocusedStudentSeat = revenueFocusedStudentId ? seatByStudentId.get(revenueFocusedStudentId) || null : null;
  const revenueFocusedStudentInvoices = useMemo(() => {
    if (!revenueFocusedStudentId) return [];
    return (allInvoices || [])
      .filter((invoice) => invoice.studentId === revenueFocusedStudentId)
      .sort((a, b) => {
        const aEnd = getInvoiceCollectionSortTime(a);
        const bEnd = getInvoiceCollectionSortTime(b);
        if (bEnd !== aEnd) return bEnd - aEnd;
        const aUpdated = a.updatedAt?.toDate?.()?.getTime?.() ?? 0;
        const bUpdated = b.updatedAt?.toDate?.()?.getTime?.() ?? 0;
        return bUpdated - aUpdated;
      });
  }, [allInvoices, revenueFocusedStudentId]);
  const revenueFocusedLatestInvoice = revenueFocusedStudentInvoices[0] || null;
  const revenueScopedInvoices = useMemo(() => {
    return revenueFocusedStudentInvoices.filter((invoice) => {
      if (getTimelineInvoiceMonth(invoice) !== timelineMonth) return false;
      if (timelineTrackFilter === 'all') return true;
      return resolveInvoiceTrackCategory(invoice) === timelineTrackFilter;
    });
  }, [revenueFocusedStudentInvoices, timelineMonth, timelineTrackFilter]);
  const revenueFocusedOutstandingAmount = useMemo(
    () =>
      revenueFocusedStudentInvoices.reduce((sum, invoice) => {
        if (invoice.status === 'issued' || invoice.status === 'overdue') {
          return sum + (Number(invoice.finalPrice) || 0);
        }
        return sum;
      }, 0),
    [revenueFocusedStudentInvoices]
  );
  const revenueFocusedMonthPayments = useMemo(() => {
    return (paymentRecords || []).filter((payment) => {
      if (payment.status !== 'success') return false;
      if (payment.studentId !== revenueFocusedStudentId) return false;
      if (getPaymentMonth(payment) !== timelineMonth) return false;
      if (timelineTrackFilter === 'all') return true;
      const sourceInvoice = invoiceById.get(payment.invoiceId);
      return sourceInvoice ? resolveInvoiceTrackCategory(sourceInvoice) === timelineTrackFilter : false;
    });
  }, [invoiceById, paymentRecords, revenueFocusedStudentId, timelineMonth, timelineTrackFilter]);
  const revenueFocusedCollectedAmount = useMemo(
    () => revenueFocusedMonthPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
    [revenueFocusedMonthPayments]
  );
  const selectedMonthLedgerEntries = useMemo(() => {
    return (businessLedgerEntries || []).filter((entry) => getBusinessLedgerMonth(entry) === timelineMonth);
  }, [businessLedgerEntries, timelineMonth]);
  const scopedLedgerEntries = useMemo(() => {
    return selectedMonthLedgerEntries.filter((entry) => matchesBusinessLedgerTrackFilter(entry.trackScope, timelineTrackFilter));
  }, [selectedMonthLedgerEntries, timelineTrackFilter]);
  const ledgerSummary = useMemo(
    () =>
      scopedLedgerEntries.reduce(
        (acc, entry) => {
          const amount = Math.max(0, Number(entry.amount) || 0);
          if (entry.direction === 'income') {
            acc.income += amount;
          } else {
            acc.expense += amount;
            if (entry.proofStatus === 'pending') {
              acc.proofPendingCount += 1;
            }
          }
          return acc;
        },
        { income: 0, expense: 0, proofPendingCount: 0 }
      ),
    [scopedLedgerEntries]
  );

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'payments' || tab === 'revenue' || tab === 'ops') {
      setActiveTab(tab);
    }

    const showRisk = searchParams.get('showRisk');
    if (showRisk === '1' || showRisk === 'true') {
      setShowRiskPanel(true);
      setTimeout(() => {
        if (typeof window === 'undefined') return;
        const target = document.getElementById('risk-analysis');
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!focusedStudentId) return;
    if (!allInvoices || allInvoices.length === 0) return;
    const latest = allInvoices.find((invoice) => invoice.studentId === focusedStudentId);
    const month = latest ? getTimelineInvoiceMonth(latest) : null;
    if (month) setTimelineMonth(month);
  }, [focusedStudentId, allInvoices]);

  useEffect(() => {
    setLedgerDraft((prev) => {
      if (editingLedgerEntryId) return prev;
      if (prev.entryDate.startsWith(timelineMonth)) return prev;
      return {
        ...prev,
        entryDate: getDefaultLedgerEntryDate(timelineMonth),
      };
    });
  }, [editingLedgerEntryId, timelineMonth]);

  const timelineMonthOptions = useMemo(() => {
    const recent = Array.from({ length: 18 }, (_, idx) => format(subDays(new Date(), idx * 28), 'yyyy-MM'));
    const fromInvoices = (allInvoices || [])
      .map((invoice) => getTimelineInvoiceMonth(invoice))
      .filter(Boolean) as string[];
    const fromPayments = (paymentRecords || [])
      .map((payment) => getPaymentMonth(payment))
      .filter(Boolean) as string[];
    const fromLedger = (businessLedgerEntries || [])
      .map((entry) => getBusinessLedgerMonth(entry))
      .filter(Boolean) as string[];
    return Array.from(new Set([timelineMonth, ...recent, ...fromInvoices, ...fromPayments, ...fromLedger])).sort((a, b) => b.localeCompare(a));
  }, [allInvoices, businessLedgerEntries, paymentRecords, timelineMonth]);

  const timelineRows = useMemo(() => {
    const rows = (allInvoices || []).filter(
      (invoice) => getTimelineInvoiceMonth(invoice) === timelineMonth && invoice.status !== 'void'
    );
    const trackFiltered = timelineTrackFilter === 'all'
      ? rows
      : rows.filter((invoice) => resolveInvoiceTrackCategory(invoice) === timelineTrackFilter);

    return [...trackFiltered].sort((a, b) => {
      const aEnd = getInvoiceCollectionSortTime(a);
      const bEnd = getInvoiceCollectionSortTime(b);
      if (bEnd !== aEnd) return bEnd - aEnd;

      const aUpdated = a.updatedAt?.toDate?.()?.getTime?.() ?? 0;
      const bUpdated = b.updatedAt?.toDate?.()?.getTime?.() ?? 0;
      return bUpdated - aUpdated;
    });
  }, [allInvoices, timelineMonth, timelineTrackFilter]);

  const scopedTimelineRows = useMemo(() => {
    if (!focusedStudentId) return timelineRows;
    return timelineRows.filter((invoice) => invoice.studentId === focusedStudentId);
  }, [timelineRows, focusedStudentId]);

  const selectedPaymentRows = useMemo(() => {
    return (paymentRecords || []).filter((payment) => {
      if (payment.status !== 'success') return false;
      if (getPaymentMonth(payment) !== timelineMonth) return false;
      if (focusedStudentId && payment.studentId !== focusedStudentId) return false;
      if (timelineTrackFilter === 'all') return true;

      const sourceInvoice = invoiceById.get(payment.invoiceId);
      return sourceInvoice ? resolveInvoiceTrackCategory(sourceInvoice) === timelineTrackFilter : false;
    });
  }, [focusedStudentId, invoiceById, paymentRecords, timelineMonth, timelineTrackFilter]);

  const timelineTrackLabel = useMemo(() => {
    if (timelineTrackFilter === 'all') return '전체 트랙';
    return INVOICE_TRACK_META[timelineTrackFilter].label;
  }, [timelineTrackFilter]);

  const filteredInvoices = useMemo(() => {
    const baseRows = scopedTimelineRows;
    if (paymentSubTab === 'all') return baseRows;
    if (paymentSubTab === 'unpaid') return baseRows.filter((invoice) => invoice.status === 'issued' || invoice.status === 'overdue');
    if (paymentSubTab === 'paid') return baseRows.filter((invoice) => invoice.status === 'paid');
    if (paymentSubTab === 'overdue') return baseRows.filter((invoice) => invoice.status === 'overdue');
    return baseRows;
  }, [paymentSubTab, scopedTimelineRows]);

  const selectedMonthCollectedAmount = useMemo(
    () => selectedPaymentRows.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
    [selectedPaymentRows]
  );

  const timelineSummary = useMemo(() => {
    const summary = scopedTimelineRows.reduce(
      (acc, invoice) => {
        const amount = Number(invoice.finalPrice) || 0;
        const isArrears = invoice.status === 'issued' || invoice.status === 'overdue';
        acc.billed += amount;
        if (isArrears) acc.arrears += amount;
        return acc;
      },
      { billed: 0, collected: 0, arrears: 0 }
    );
    summary.collected = selectedMonthCollectedAmount;
    return summary;
  }, [scopedTimelineRows, selectedMonthCollectedAmount]);

  const paymentMethodShare = useMemo(() => {
    const total = selectedPaymentRows.length;
    if (total === 0) return { card: 0, manual: 0 };
    const cardCount = selectedPaymentRows.filter((payment) => payment.method === 'card').length;
    const manualCount = total - cardCount;
    return {
      card: Math.round((cardCount / total) * 100),
      manual: Math.round((manualCount / total) * 100),
    };
  }, [selectedPaymentRows]);

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

  const handleSingleCollectionReset = async (invoiceId: string) => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      await resetInvoiceCollectionState(firestore, centerId, invoiceId);
      toast({ title: '선택 인보이스를 수납 대기로 복원했습니다.' });
      router.refresh();
    } catch (e: any) {
      toast({ variant: 'destructive', title: '복원 실패', description: e?.message || '다시 시도해 주세요.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTimelineDelete = async () => {
    if (!firestore || !centerId || !timelineDeleteTarget) return;
    setIsSaving(true);
    try {
      await clearLegacyInvoiceCollectionData(firestore, centerId, timelineDeleteTarget.id);
      toast({
        title: '잘못 생성한 인보이스를 타임라인에서 제거했습니다.',
        description:
          timelineDeleteTarget.status === 'paid'
            ? '연결된 결제 로그도 함께 정리했습니다.'
            : '무효 처리되어 타임라인과 합계에서 바로 제외됩니다.',
      });
      setTimelineDeleteTarget(null);
      router.refresh();
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: '타임라인 삭제 실패',
        description: e?.message || '다시 시도해 주세요.',
      });
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

  const getCollectionWindowDraft = (invoice: Invoice) => {
    return collectionWindowDrafts[invoice.id] || createCollectionWindowDraft(invoice);
  };

  const handleCollectionWindowDraftChange = (
    invoice: Invoice,
    field: keyof CollectionWindowDraft,
    nextValue: string
  ) => {
    const currentDraft = getCollectionWindowDraft(invoice);
    setCollectionWindowDrafts((prev) => ({
      ...prev,
      [invoice.id]: {
        ...currentDraft,
        [field]: nextValue,
      },
    }));
  };

  const handleCollectionWindowSave = async (invoice: Invoice) => {
    if (!firestore || !centerId) return;

    const draft = getCollectionWindowDraft(invoice);
    const collectionStartDate = parseLedgerDate(draft.collectionStartDate);
    const collectionEndDate = parseLedgerDate(draft.collectionEndDate);
    if (!collectionStartDate || !collectionEndDate) {
      toast({ variant: 'destructive', title: '수납 기간을 확인해 주세요.' });
      return;
    }
    if (collectionStartDate.getTime() > collectionEndDate.getTime()) {
      toast({ variant: 'destructive', title: '수납 시작일은 마감일보다 늦을 수 없습니다.' });
      return;
    }

    const currentStart = formatInvoiceCollectionInputDate(getInvoiceCollectionStartDate(invoice));
    const currentEnd = formatInvoiceCollectionInputDate(getInvoiceCollectionEndDate(invoice));
    if (draft.collectionStartDate === currentStart && draft.collectionEndDate === currentEnd) {
      toast({ title: '변경된 수납 기간이 없습니다.' });
      return;
    }

    setIsSaving(true);
    try {
      await updateInvoiceCollectionWindow(firestore, centerId, invoice.id, {
        collectionStartDate,
        collectionEndDate,
      });
      setCollectionWindowDrafts((prev) => {
        const next = { ...prev };
        delete next[invoice.id];
        return next;
      });
      toast({ title: '수납 기간을 저장했습니다.' });
      router.refresh();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '수납 기간 저장 실패',
        description: error?.message || '다시 시도해 주세요.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetLedgerComposer = (month = timelineMonth) => {
    setEditingLedgerEntryId(null);
    setLedgerDraft(createDefaultLedgerDraft(month));
  };

  const handleLedgerDirectionChange = (direction: BusinessLedgerDirection) => {
    setLedgerDraft((prev) => {
      const nextCategory = BUSINESS_LEDGER_CATEGORY_META[prev.category]?.direction === direction
        ? prev.category
        : BUSINESS_LEDGER_CATEGORY_OPTIONS[direction][BUSINESS_LEDGER_CATEGORY_OPTIONS[direction].length - 1];
      const nextProofStatus =
        direction === 'income'
          ? 'not_needed'
          : prev.proofStatus === 'not_needed'
            ? 'pending'
            : prev.proofStatus;
      return {
        ...prev,
        direction,
        category: nextCategory,
        proofStatus: nextProofStatus,
      };
    });
  };

  const handleLedgerSubmit = async () => {
    if (!firestore || !centerId || !user?.uid) return;

    const parsedDate = parseLedgerDate(ledgerDraft.entryDate);
    if (!parsedDate) {
      toast({ variant: 'destructive', title: '거래일을 확인해 주세요.' });
      return;
    }
    if (format(parsedDate, 'yyyy-MM') !== timelineMonth) {
      toast({ variant: 'destructive', title: '선택 월 안에서만 장부를 입력할 수 있습니다.' });
      return;
    }

    const amount = Math.round(Number(ledgerDraft.amount.replace(/[^\d]/g, '')) || 0);
    if (amount <= 0) {
      toast({ variant: 'destructive', title: '금액을 입력해 주세요.' });
      return;
    }
    if (!ledgerDraft.description.trim()) {
      toast({ variant: 'destructive', title: '항목명을 입력해 주세요.' });
      return;
    }

    const payload = {
      entryDate: parsedDate,
      direction: ledgerDraft.direction,
      trackScope: ledgerDraft.trackScope,
      category: ledgerDraft.category,
      description: ledgerDraft.description.trim(),
      counterparty: ledgerDraft.counterparty.trim() || null,
      amount,
      paymentMethod: ledgerDraft.paymentMethod,
      proofStatus: ledgerDraft.direction === 'income' ? 'not_needed' : ledgerDraft.proofStatus,
      memo: ledgerDraft.memo.trim() || null,
    } as const;

    setIsSaving(true);
    try {
      if (editingLedgerEntryId) {
        await updateBusinessLedgerEntry(firestore, centerId, editingLedgerEntryId, user.uid, payload);
        toast({ title: '장부 항목을 수정했습니다.' });
      } else {
        await createBusinessLedgerEntry(firestore, centerId, user.uid, payload);
        toast({ title: '장부 항목을 저장했습니다.' });
      }
      resetLedgerComposer(timelineMonth);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: editingLedgerEntryId ? '장부 수정 실패' : '장부 저장 실패',
        description: error?.message || '다시 시도해 주세요.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLedgerEdit = (entry: BusinessLedgerEntry) => {
    const entryDate = toDateSafe(entry.entryDate);
    setEditingLedgerEntryId(entry.id);
    setLedgerDraft({
      entryDate: entryDate ? format(entryDate, 'yyyy-MM-dd') : getDefaultLedgerEntryDate(timelineMonth),
      direction: entry.direction,
      trackScope: entry.trackScope,
      category: entry.category,
      description: entry.description || '',
      counterparty: entry.counterparty || '',
      amount: String(Math.round(Number(entry.amount) || 0)),
      paymentMethod: entry.paymentMethod,
      proofStatus: entry.proofStatus,
      memo: entry.memo || '',
    });
  };

  const handleLedgerDelete = async (entry: BusinessLedgerEntry) => {
    if (!firestore || !centerId) return;
    if (typeof window !== 'undefined' && !window.confirm('이 장부 항목을 삭제할까요?')) return;

    setIsSaving(true);
    try {
      await deleteBusinessLedgerEntry(firestore, centerId, entry.id);
      if (editingLedgerEntryId === entry.id) {
        resetLedgerComposer(timelineMonth);
      }
      toast({ title: '장부 항목을 삭제했습니다.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: '장부 삭제 실패', description: error?.message || '다시 시도해 주세요.' });
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
      const title = `28일 정기 ${trackMeta.label} 이용료`;
      await issueInvoice(firestore, centerId, studentId, amount, title, { trackCategory });
      toast({ title: `${trackMeta.label} 인보이스가 추가 발급되었습니다.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: '생성 실패', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualAcademyInvoiceCreate = async () => {
    if (!firestore || !centerId) return;

    const studentName = manualAcademyStudentName.trim();
    const amount = parseDraftPrice(quickIssueAmount);
    if (!studentName) {
      toast({ variant: 'destructive', title: '학생 이름을 입력해 주세요.' });
      return;
    }
    if (!amount || amount <= 0) {
      toast({ variant: 'destructive', title: '금액을 입력해 주세요.', description: '기본 발행 금액에 숫자를 입력하면 됩니다.' });
      return;
    }

    setIsSaving(true);
    try {
      await issueManualAcademyInvoice(firestore, centerId, {
        studentName,
        amount,
        phoneNumber: manualAcademyPhone,
        memo: manualAcademyMemo,
      });
      toast({
        title: '트랙 국어 수기 인보이스를 발행했습니다.',
        description: `${studentName} 학생 청구가 인보이스 타임라인에 추가되었습니다.`,
      });
      setManualAcademyStudentName('');
      setManualAcademyPhone('');
      setManualAcademyMemo('');
      setTimelineMonth(format(new Date(), 'yyyy-MM'));
      setTimelineTrackFilter('academy');
      setPaymentSubTab('all');
      setActiveTab('payments');
      setIsSettingsOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: '수기 발행 실패', description: e?.message || '다시 시도해 주세요.' });
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

  const updateRevenueRoute = (next: { studentId?: string | null; tab?: 'payments' | 'revenue' | 'ops' }) => {
    const params = new URLSearchParams(searchParams.toString());
    const nextTab = next.tab || activeTab;
    params.set('tab', nextTab);

    if (next.studentId) {
      params.set('studentId', next.studentId);
    } else {
      params.delete('studentId');
    }

    router.push(`/dashboard/revenue?${params.toString()}`);
  };

  if (membershipsLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" /></div>;
  if (!isFinanceViewer) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="font-bold text-muted-foreground">센터 관리자만 수익 분석에 접근할 수 있습니다.</p>
      </div>
    );
  }

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

      <AdminWorkbenchCommandBar
        eyebrow="매출/수납 워크벤치"
        title="수납 운영 워크벤치"
        description="수납, 수익 분석, 운영 인텔리전스를 같은 빠른 실행과 월 기준으로 이어서 확인합니다."
        quickActions={[
          { label: '학생 관리', icon: <Users className="h-4 w-4" />, href: '/dashboard/teacher/students' },
          { label: '리드상담', icon: <Megaphone className="h-4 w-4" />, href: '/dashboard/leads' },
          { label: '문자 콘솔', icon: <BellRing className="h-4 w-4" />, href: '/dashboard/settings/notifications' },
          { label: '출결 이동', icon: <CalendarCheck className="h-4 w-4" />, href: '/dashboard/attendance' },
        ]}
      >
        <div className="grid gap-1">
          <Label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">매출 기준 월</Label>
          <Input
            type="month"
            value={timelineMonth}
            onChange={(event) => setTimelineMonth(event.target.value || format(new Date(), 'yyyy-MM'))}
            className="h-11 min-w-[180px] rounded-xl border-2 font-black"
          />
        </div>
      </AdminWorkbenchCommandBar>

      <Card
        id="risk-analysis"
        className="rounded-[2rem] border border-[#dbe7ff] bg-white p-5 shadow-[0_24px_56px_-42px_rgba(20,41,95,0.28)]"
      >
        <div className={cn('flex items-center justify-between gap-3', isMobile ? 'flex-col items-stretch' : 'flex-row')}>
          <div className="space-y-1">
            <Badge className="rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-3 py-1 text-[10px] font-black text-[#14295F]">
              관리자 전용
            </Badge>
            <p className="pt-2 text-sm font-black tracking-tight text-[#14295F]">리스크 인텔리전스</p>
            <p className="text-sm font-semibold text-[#5c6e97]">비즈니스 분석에서 바로 리스크 분석 패널을 열고 운영 리스크를 함께 확인합니다.</p>
          </div>
          <Button
            type="button"
            variant={showRiskPanel ? 'default' : 'outline'}
            className={cn(
              'h-10 rounded-xl font-black',
              showRiskPanel
                ? 'bg-[#14295F] text-white hover:bg-[#173D8B]'
                : 'border-[#dbe7ff] bg-white text-[#14295F] hover:bg-[#f4f7ff]'
            )}
            onClick={() => setShowRiskPanel((prev) => !prev)}
          >
            {showRiskPanel ? '리스크 분석 닫기' : '리스크 분석 열기'}
          </Button>
        </div>
        {showRiskPanel ? (
          <div className="pt-5">
            <RiskIntelligencePanel />
          </div>
        ) : null}
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 bg-muted/30 p-1.5 rounded-[1.5rem] border border-border/50 shadow-inner h-16 max-w-3xl mb-8">
          <TabsTrigger value="payments" className="rounded-xl font-black gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <CreditCard className="h-4 w-4" /> 수납 및 미납 관리
          </TabsTrigger>
          <TabsTrigger value="revenue" className="rounded-xl font-black gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <TrendingUp className="h-4 w-4" /> 수익 분석
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
                    <p className="text-[11px] font-bold text-blue-700">최근 수납 마감일</p>
                    <p className="mt-1 text-xl font-black text-blue-700">
                      {focusedLatestInvoice ? (getInvoiceCollectionEndDate(focusedLatestInvoice) ? format(getInvoiceCollectionEndDate(focusedLatestInvoice)!, 'yyyy.MM.dd') : '-') : '-'}
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
                    {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <PlusCircle className="h-4 w-4" />} 트랙 스터디센터 인보이스 추가 발행
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
                    {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <PlusCircle className="h-4 w-4" />} 트랙 국어 인보이스 추가 발행
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
                    인보이스 타임라인에서 수납 기간과 상태를 관리하고 월별 수납 흐름을 확인합니다.
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
                    트랙 스터디센터
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={timelineTrackFilter === 'academy' ? 'default' : 'outline'}
                    className="rounded-lg font-black"
                    onClick={() => setTimelineTrackFilter('academy')}
                  >
                    트랙 국어
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

              {scopedTimelineRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed py-8 text-center text-sm font-semibold text-muted-foreground">
                  선택한 월/트랙에 해당하는 인보이스가 없습니다. 수납/미납 관리에서 먼저 인보이스를 등록해 주세요.
                </div>
              ) : (
                <div className="space-y-2">
                  {scopedTimelineRows.slice(0, 12).map((invoice) => {
                    const track = resolveInvoiceTrackCategory(invoice);
                    const trackMeta = INVOICE_TRACK_META[track];
                    const collectionWindowDraft = getCollectionWindowDraft(invoice);
                    const currentCollectionStart = formatInvoiceCollectionInputDate(getInvoiceCollectionStartDate(invoice));
                    const currentCollectionEnd = formatInvoiceCollectionInputDate(getInvoiceCollectionEndDate(invoice));
                    const canSaveCollectionWindow =
                      collectionWindowDraft.collectionStartDate !== currentCollectionStart ||
                      collectionWindowDraft.collectionEndDate !== currentCollectionEnd;
                    const collectionStartDate = getInvoiceCollectionStartDate(invoice);
                    const collectionEndDate = getInvoiceCollectionEndDate(invoice);
                    return (
                      <div key={`timeline-${invoice.id}`} className="rounded-xl border border-slate-100 px-4 py-3">
                        <div className={cn('flex items-start justify-between gap-4', isMobile ? 'flex-col' : 'flex-row')}>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-black text-slate-800">{invoice.studentName}</span>
                              <Badge className={cn('border text-[10px] font-black', trackMeta.badgeClass)}>{trackMeta.label}</Badge>
                              {invoice.isManualInvoice ? (
                                <Badge className="border border-emerald-200 bg-white text-[10px] font-black text-emerald-700">수기</Badge>
                              ) : null}
                              {getStatusBadge(invoice.status)}
                            </div>
                            <p className="mt-1 text-[11px] font-bold text-slate-400">
                              수납 기간 {collectionStartDate ? format(collectionStartDate, 'yyyy.MM.dd') : '-'} ~ {collectionEndDate ? format(collectionEndDate, 'yyyy.MM.dd') : '-'}
                            </p>
                            <p className="mt-1 text-[11px] font-bold text-slate-400">
                              이용 기간 {invoice.cycleStartDate ? format(invoice.cycleStartDate.toDate(), 'yyyy.MM.dd') : '-'} ~ {invoice.cycleEndDate ? format(invoice.cycleEndDate.toDate(), 'yyyy.MM.dd') : '-'}
                            </p>
                          </div>
                          <div className={cn('text-right', isMobile ? 'w-full' : 'shrink-0')}>
                            <p className="text-sm font-black text-slate-900">{formatWon(invoice.finalPrice)}</p>
                          </div>
                        </div>
                        <div className={cn('mt-3 grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]')}>
                          <Input
                            type="date"
                            value={collectionWindowDraft.collectionStartDate}
                            onChange={(event) => handleCollectionWindowDraftChange(invoice, 'collectionStartDate', event.target.value)}
                            disabled={isSaving}
                            className="h-9 rounded-xl text-xs font-bold"
                          />
                          <div className={cn('flex items-center gap-2', isMobile ? 'flex-col' : 'flex-row')}>
                            <Input
                              type="date"
                              value={collectionWindowDraft.collectionEndDate}
                              onChange={(event) => handleCollectionWindowDraftChange(invoice, 'collectionEndDate', event.target.value)}
                              disabled={isSaving}
                              className="h-9 rounded-xl text-xs font-bold"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant={canSaveCollectionWindow ? 'default' : 'outline'}
                              onClick={() => handleCollectionWindowSave(invoice)}
                              disabled={isSaving || !canSaveCollectionWindow}
                              className="h-9 rounded-xl px-4 text-[11px] font-black"
                            >
                              수납 기간 저장
                            </Button>
                          </div>
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
                      <CardDescription className="font-bold text-xs tracking-widest text-muted-foreground/60 whitespace-nowrap">수납 기간 직접 설정 가능</CardDescription>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Badge variant="outline" className="font-black text-[10px]">
                          조회월 {timelineMonth}
                        </Badge>
                        <Badge variant="outline" className="font-black text-[10px]">
                          {timelineTrackLabel}
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
                          <p className="text-xs font-bold text-muted-foreground/30">{timelineMonth} · {timelineTrackLabel} 조건에서 인보이스를 찾지 못했습니다.</p>
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
                                  {inv.isManualInvoice ? (
                                    <Badge className="border border-emerald-200 bg-white text-[9px] font-black text-emerald-700">수기</Badge>
                                  ) : null}
                                  {getStatusBadge(inv.status)}
                                </div>
                                <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground">
                                  <span className="flex items-center gap-1 bg-muted/30 px-2 py-0.5 rounded-md whitespace-nowrap"><CalendarCheck className="h-3 w-3" /> 수납: {getInvoiceCollectionStartDate(inv) ? format(getInvoiceCollectionStartDate(inv)!, 'MM.dd') : '--.--'} ~ {getInvoiceCollectionEndDate(inv) ? format(getInvoiceCollectionEndDate(inv)!, 'MM.dd') : '--.--'}</span>
                                  <span className="flex items-center gap-1 bg-muted/20 px-2 py-0.5 rounded-md whitespace-nowrap">이용: {inv.cycleStartDate ? format(inv.cycleStartDate.toDate(), 'MM.dd') : '--.--'} ~ {inv.cycleEndDate ? format(inv.cycleEndDate.toDate(), 'MM.dd') : '--.--'}</span>
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
                                  <SelectItem value="studyRoom" className="font-bold">트랙 스터디센터</SelectItem>
                                  <SelectItem value="academy" className="font-bold">트랙 국어</SelectItem>
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

                          <div className="flex items-center justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setTimelineDeleteTarget(inv)}
                              disabled={isSaving}
                              className="h-8 rounded-lg px-2 text-[11px] font-black text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              잘못 입력 삭제
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-4 space-y-6">
              <Card className="rounded-[2rem] border border-[#dbe7ff] bg-white shadow-[0_24px_56px_-42px_rgba(20,41,95,0.24)]">
                <CardHeader className="gap-3 border-b border-[#e7eefc]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <Badge className="rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-3 py-1 text-[10px] font-black text-[#14295F]">
                        월별 장부 입력
                      </Badge>
                      <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight text-[#14295F]">
                        <NotebookPen className="h-5 w-5 text-[#2554D7]" />
                        수입 · 지출 원장 관리
                      </CardTitle>
                      <CardDescription>
                        {timelineMonth} · {timelineTrackLabel} 기준 거래를 바로 입력하고 세무 정리용 증빙 상태까지 함께 관리합니다.
                      </CardDescription>
                    </div>
                    <div className="rounded-[1.1rem] border border-slate-100 bg-slate-50/80 px-3 py-2 text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">증빙 대기</p>
                      <p className="dashboard-number mt-1 text-lg text-amber-700">{ledgerSummary.proofPendingCount}건</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 p-5">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(['expense', 'income'] as BusinessLedgerDirection[]).map((direction) => {
                      const isActive = ledgerDraft.direction === direction;
                      return (
                        <Button
                          key={direction}
                          type="button"
                          variant="outline"
                          onClick={() => handleLedgerDirectionChange(direction)}
                          className={cn(
                            'h-10 rounded-xl font-black',
                            isActive
                              ? direction === 'income'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-rose-200 bg-rose-50 text-rose-600'
                              : 'border-[#dbe7ff] bg-white text-[#5c6e97]'
                          )}
                        >
                          {BUSINESS_LEDGER_DIRECTION_META[direction].label}
                        </Button>
                      );
                    })}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">거래일</Label>
                      <Input
                        type="date"
                        value={ledgerDraft.entryDate}
                        onChange={(event) => setLedgerDraft((prev) => ({ ...prev, entryDate: event.target.value }))}
                        disabled={isSaving}
                        className="h-10 rounded-xl font-black"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">트랙 범위</Label>
                      <Select
                        value={ledgerDraft.trackScope}
                        onValueChange={(value: BusinessLedgerTrackScope) => setLedgerDraft((prev) => ({ ...prev, trackScope: value }))}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="h-10 rounded-xl border-[#dbe7ff] bg-white font-black text-[#14295F]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          {(['center', 'studyRoom', 'academy'] as BusinessLedgerTrackScope[]).map((trackScope) => (
                            <SelectItem key={trackScope} value={trackScope} className="font-bold">
                              {BUSINESS_LEDGER_TRACK_SCOPE_META[trackScope].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">분류</Label>
                      <Select
                        value={ledgerDraft.category}
                        onValueChange={(value: BusinessLedgerCategory) => setLedgerDraft((prev) => ({ ...prev, category: value }))}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="h-10 rounded-xl border-[#dbe7ff] bg-white font-black text-[#14295F]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          {BUSINESS_LEDGER_CATEGORY_OPTIONS[ledgerDraft.direction].map((category) => (
                            <SelectItem key={category} value={category} className="font-bold">
                              {BUSINESS_LEDGER_CATEGORY_META[category].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">결제수단</Label>
                      <Select
                        value={ledgerDraft.paymentMethod}
                        onValueChange={(value: BusinessLedgerPaymentMethod) => setLedgerDraft((prev) => ({ ...prev, paymentMethod: value }))}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="h-10 rounded-xl border-[#dbe7ff] bg-white font-black text-[#14295F]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          {(['transfer', 'card', 'cash', 'auto_debit', 'other'] as BusinessLedgerPaymentMethod[]).map((method) => (
                            <SelectItem key={method} value={method} className="font-bold">
                              {BUSINESS_LEDGER_PAYMENT_METHOD_META[method].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">증빙상태</Label>
                      <Select
                        value={ledgerDraft.direction === 'income' ? 'not_needed' : ledgerDraft.proofStatus}
                        onValueChange={(value: BusinessLedgerProofStatus) => setLedgerDraft((prev) => ({ ...prev, proofStatus: value }))}
                        disabled={isSaving || ledgerDraft.direction === 'income'}
                      >
                        <SelectTrigger className="h-10 rounded-xl border-[#dbe7ff] bg-white font-black text-[#14295F]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          {(['not_needed', 'pending', 'card_receipt', 'cash_receipt', 'tax_invoice', 'simple_receipt'] as BusinessLedgerProofStatus[]).map((status) => (
                            <SelectItem key={status} value={status} className="font-bold">
                              {BUSINESS_LEDGER_PROOF_STATUS_META[status].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">항목명</Label>
                      <Input
                        value={ledgerDraft.description}
                        onChange={(event) => setLedgerDraft((prev) => ({ ...prev, description: event.target.value }))}
                        disabled={isSaving}
                        placeholder="예: 4월 센터 월세"
                        className="h-10 rounded-xl font-black"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">거래처</Label>
                      <Input
                        value={ledgerDraft.counterparty}
                        onChange={(event) => setLedgerDraft((prev) => ({ ...prev, counterparty: event.target.value }))}
                        disabled={isSaving}
                        placeholder="예: 건물주, 공급업체"
                        className="h-10 rounded-xl font-black"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">금액</Label>
                      <Input
                        inputMode="numeric"
                        value={ledgerDraft.amount}
                        onChange={(event) => setLedgerDraft((prev) => ({ ...prev, amount: event.target.value.replace(/[^\d]/g, '').slice(0, 10) }))}
                        disabled={isSaving}
                        placeholder="예: 850000"
                        className="h-10 rounded-xl text-right font-black"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">메모</Label>
                      <Textarea
                        value={ledgerDraft.memo}
                        onChange={(event) => setLedgerDraft((prev) => ({ ...prev, memo: event.target.value }))}
                        disabled={isSaving}
                        placeholder="세무 메모나 내부 참고 내용을 남겨 주세요."
                        className="min-h-[92px] rounded-xl font-semibold"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-slate-100 bg-slate-50/80 px-4 py-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">현재 입력 범위</p>
                      <p className="text-sm font-black text-slate-900">{timelineMonth} · {timelineTrackLabel}</p>
                      <p className="text-[11px] font-semibold text-slate-500">센터 공통 항목은 전체 트랙에서만 다시 보입니다.</p>
                    </div>
                    <p className="dashboard-number text-lg text-[#14295F]">
                      {ledgerDraft.amount ? formatWon(Number(ledgerDraft.amount)) : '₩0'}
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      onClick={handleLedgerSubmit}
                      disabled={isSaving}
                      className="h-11 rounded-xl bg-[#14295F] font-black text-white hover:bg-[#173D8B]"
                    >
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Landmark className="mr-2 h-4 w-4" />}
                      {editingLedgerEntryId ? '장부 수정 저장' : '장부 항목 저장'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => resetLedgerComposer(timelineMonth)}
                      disabled={isSaving}
                      className="h-11 rounded-xl border-[#dbe7ff] bg-white font-black text-[#14295F] hover:bg-[#f4f7ff]"
                    >
                      입력 초기화
                    </Button>
                  </div>

                  <div className="space-y-3 border-t border-[#e7eefc] pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-[#14295F]">선택 월 장부</p>
                        <p className="text-[11px] font-semibold text-slate-500">{timelineMonth} · {timelineTrackLabel} 기준 최신순</p>
                      </div>
                      <Badge className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black text-slate-600">
                        {scopedLedgerEntries.length}건
                      </Badge>
                    </div>

                    {scopedLedgerEntries.length === 0 ? (
                      <div className="rounded-[1.4rem] border border-dashed border-[#dbe7ff] bg-[#f8fbff] px-4 py-8 text-center text-[12px] font-semibold text-[#8091bb]">
                        선택 월에 등록된 장부 항목이 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {scopedLedgerEntries.map((entry) => {
                          const entryDate = toDateSafe(entry.entryDate);
                          return (
                            <div key={entry.id} className="rounded-[1.4rem] border border-slate-100 bg-slate-50/70 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge className={cn('border text-[10px] font-black', BUSINESS_LEDGER_DIRECTION_META[entry.direction].badgeClass)}>
                                      {BUSINESS_LEDGER_DIRECTION_META[entry.direction].label}
                                    </Badge>
                                    <Badge className={cn('border text-[10px] font-black', BUSINESS_LEDGER_TRACK_SCOPE_META[entry.trackScope].badgeClass)}>
                                      {BUSINESS_LEDGER_TRACK_SCOPE_META[entry.trackScope].label}
                                    </Badge>
                                  </div>
                                  <p className="text-sm font-black text-slate-900">{entry.description}</p>
                                  <p className="text-[11px] font-semibold text-slate-500">
                                    {entryDate ? format(entryDate, 'yyyy.MM.dd') : '-'} · {formatBusinessLedgerCategoryLabel(entry.category)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className={cn('dashboard-number text-lg', entry.direction === 'income' ? 'text-emerald-700' : 'text-rose-600')}>
                                    {formatWon(entry.amount)}
                                  </p>
                                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    {formatBusinessLedgerPaymentMethodLabel(entry.paymentMethod)}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 rounded-[1rem] border border-white/80 bg-white/70 px-3 py-2">
                                <p className="text-[11px] font-semibold text-slate-600">
                                  거래처 {entry.counterparty || '-'} · 증빙 {formatBusinessLedgerProofStatusLabel(entry.proofStatus)}
                                </p>
                                {entry.memo ? <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-500">{entry.memo}</p> : null}
                              </div>

                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleLedgerEdit(entry)}
                                  disabled={isSaving}
                                  className="h-9 rounded-xl border-[#dbe7ff] bg-white font-black text-[#14295F] hover:bg-[#f4f7ff]"
                                >
                                  <PencilLine className="mr-2 h-4 w-4" />
                                  수정
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleLedgerDelete(entry)}
                                  disabled={isSaving}
                                  className="h-9 rounded-xl border-rose-200 bg-rose-50 font-black text-rose-600 hover:bg-rose-100"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  삭제
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 overflow-hidden relative group ring-1 ring-border/50">
                <div className="absolute -right-4 -top-4 opacity-5 rotate-12 group-hover:scale-110 transition-transform duration-1000">
                  <Armchair className="h-32 w-32" />
                </div>
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-black tracking-tighter">학생 실수납 액션 큐</CardTitle>
                    <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-black text-[9px]">
                      우선순위
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {topActionStudents.map((item) => {
                      const seatIdentity = item.seat ? resolveSeatIdentity(item.seat) : null;
                      const seatLabel = item.seat ? formatSeatLabel(item.seat) : '좌석 미배정';
                      const toneClass =
                        item.statusTone === 'critical'
                          ? 'bg-rose-500'
                          : item.statusTone === 'warning'
                            ? 'bg-amber-500'
                            : item.statusTone === 'neutral'
                              ? 'bg-slate-500'
                              : 'bg-emerald-500';

                      return (
                        <div
                          key={item.student.id}
                          className="flex flex-col gap-4 rounded-3xl border border-border/50 bg-[#fafafa] p-5 transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-xl"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-2xl bg-white border-2 border-primary/5 flex items-center justify-center font-black text-xs text-primary/50 shadow-inner">
                                {getSeatDisplayLabel(item.seat) || seatIdentity?.roomSeatNo || item.seat?.seatNo || item.student.displayName?.charAt(0) || '학'}
                              </div>
                              <div className="grid gap-0.5">
                                <span className="font-black text-base tracking-tight">{item.student.displayName || '학생'}</span>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">
                                  {seatLabel} · {item.seat?.seatZone || '미배정'}
                                </span>
                              </div>
                            </div>
                            <Badge className={cn('font-black text-[9px] border-none px-2 h-5 text-white', toneClass)}>
                              {item.statusLabel}
                            </Badge>
                          </div>

                          <div className="space-y-2.5">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className="text-muted-foreground">최근 수납 마감</span>
                              <span className="text-primary">
                            {item.latestInvoice ? (getInvoiceCollectionEndDate(item.latestInvoice) ? format(getInvoiceCollectionEndDate(item.latestInvoice)!, 'yyyy.MM.dd') : '인보이스 없음') : '인보이스 없음'}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className="text-muted-foreground">현재 미납 잔액</span>
                              <span className="text-rose-600">{formatWon(item.totalOutstanding)}</span>
                            </div>
                            <p className="rounded-xl bg-white px-3 py-2 text-[10px] font-bold leading-relaxed text-slate-600">
                              {item.nextAction}
                            </p>
                            {item.overdueDays > 0 ? (
                              <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span className="text-[10px] font-black uppercase">미납 D+{item.overdueDays}</span>
                              </div>
                            ) : null}
                          </div>

                          <div className="grid grid-cols-1 gap-2">
                            <Button
                              size="sm"
                              type="button"
                              onClick={() => updateRevenueRoute({ studentId: item.student.id, tab: 'payments' })}
                              className="w-full h-10 rounded-xl font-black text-xs gap-2"
                            >
                              상세 수납 관리 열기
                            </Button>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                size="sm"
                                onClick={() => createAutoInvoice(item.student.id, item.student.displayName || '학생', 'studyRoom')}
                                disabled={isSaving}
                                variant="outline"
                                className="h-10 rounded-xl font-black text-xs border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 gap-2"
                              >
                                {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <PlusCircle className="h-4 w-4" />} 트랙 스터디센터
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => createAutoInvoice(item.student.id, item.student.displayName || '학생', 'academy')}
                                disabled={isSaving}
                                variant="outline"
                                className="h-10 rounded-xl font-black text-xs border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 gap-2"
                              >
                                {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <PlusCircle className="h-4 w-4" />} 트랙 국어
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {studentActionQueue.length > 3 && (
                      <Button asChild variant="ghost" className="w-full h-12 rounded-2xl font-black text-xs text-muted-foreground hover:text-primary border-2 border-dashed">
                        <Link href="/dashboard/revenue/assigned-students">
                          전체 재원생 보기 ({studentActionQueue.length}명) <ChevronRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    )}

                    {studentActionQueue.length === 0 && (
                      <div className="py-20 text-center flex flex-col items-center gap-4 opacity-20">
                        <Users className="h-12 w-12" />
                        <p className="text-[10px] font-black uppercase">현재 관리할 재원생이 없습니다.</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="rounded-[2.5rem] border-none bg-[linear-gradient(135deg,#14295F_0%,#1E4DB7_62%,#4F7CFF_100%)] p-8 text-white shadow-[0_28px_60px_-38px_rgba(20,41,95,0.52)] overflow-hidden relative ring-1 ring-white/10">
                <Sparkles className="absolute -right-4 -top-4 h-32 w-32 opacity-15 rotate-12 text-white" />
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-white/80" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/80 whitespace-nowrap">수납 건전성 스냅샷</span>
                  </div>
                  <div className="grid gap-1">
                    <h3 className="text-5xl font-black tracking-tighter text-white">
                      {timelineSummary.billed > 0 ? Math.round((timelineSummary.collected / timelineSummary.billed) * 100) : 0}%
                    </h3>
                    <p className="text-xs font-bold text-white/88">선택 월 수납 달성률 (실수납 / 청구)</p>
                  </div>
                  <div className="space-y-3 pt-4 border-t border-white/12">
                    <div className="flex justify-between items-center rounded-xl bg-white/10 px-3 py-2 text-[10px] font-black uppercase text-white/88">
                      <span>청구 금액</span>
                      <span className="text-white">{formatWon(timelineSummary.billed)}</span>
                    </div>
                    <div className="flex justify-between items-center rounded-xl bg-white/10 px-3 py-2 text-[10px] font-black uppercase text-white/88">
                      <span>실수납 금액</span>
                      <span className="text-white">{formatWon(timelineSummary.collected)}</span>
                    </div>
                    <div className="flex justify-between items-center rounded-xl bg-white/10 px-3 py-2 text-[10px] font-black uppercase text-white/88">
                      <span>미납 금액</span>
                      <span className="text-white">{formatWon(timelineSummary.arrears)}</span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 group ring-1 ring-border/50">
                <CardTitle className="mb-6 flex items-center gap-2 text-base font-black uppercase tracking-widest text-[#5c6e97]">
                  <PieChart className="h-4 w-4 text-[#2554D7]" /> 결제 수단 비중
                </CardTitle>
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">카드 결제</span>
                    <span className="text-lg font-black text-blue-600">{paymentMethodShare.card}%</span>
                  </div>
                  <Progress value={paymentMethodShare.card} className="h-1.5" />
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold text-muted-foreground">계좌/현금</span>
                    <span className="text-lg font-black text-emerald-600">{paymentMethodShare.manual}%</span>
                  </div>
                  <Progress value={paymentMethodShare.manual} className="h-1.5 bg-muted" />
                  <p className="text-[11px] font-semibold text-muted-foreground">선택 월 실수납 {selectedPaymentRows.length}건 기준</p>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-8 animate-in fade-in duration-500">
          <div className={cn('grid gap-6', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.7fr)_380px]')}>
            <RevenueAnalysis
              invoices={allInvoices || []}
              payments={paymentRecords || []}
              ledgerEntries={businessLedgerEntries || []}
              activeStudentCount={(studentMembers || []).length}
              selectedMonth={timelineMonth}
              onSelectedMonthChange={setTimelineMonth}
              trackFilter={timelineTrackFilter}
              onTrackFilterChange={setTimelineTrackFilter}
              onSelectStudent={(studentId) => updateRevenueRoute({ studentId, tab: 'revenue' })}
              focusedStudentId={revenueFocusedStudentId}
              isMobile={isMobile}
            />

            <div className="space-y-6">
              <Card className="rounded-[2rem] border border-[#dbe7ff] bg-white shadow-[0_24px_56px_-42px_rgba(20,41,95,0.24)]">
                <CardHeader className="gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-black tracking-tight text-[#14295F]">학생별 실수납 액션 큐</CardTitle>
                      <CardDescription>미납, 연체, 수납 대기 학생을 먼저 보고 바로 상세 패널로 연결합니다.</CardDescription>
                    </div>
                    <Badge className="rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-3 py-1 text-[10px] font-black text-[#14295F]">
                      {timelineMonth}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {studentActionQueue.slice(0, 8).map((item) => {
                    const isSelected = revenueFocusedStudentId === item.student.id;
                    const seatLabel = item.seat ? formatSeatLabel(item.seat) : '좌석 미배정';
                    const badgeTone =
                      item.statusTone === 'critical'
                        ? 'bg-rose-50 text-rose-600 border-rose-100'
                        : item.statusTone === 'warning'
                          ? 'bg-amber-50 text-amber-700 border-amber-100'
                          : item.statusTone === 'neutral'
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100';

                    return (
                      <button
                        key={item.student.id}
                        type="button"
                        onClick={() => updateRevenueRoute({ studentId: item.student.id, tab: 'revenue' })}
                        className={cn(
                          'w-full rounded-[1.4rem] border px-4 py-4 text-left transition-all',
                          isSelected
                            ? 'border-[#2554D7] bg-[#f8fbff] shadow-[0_16px_30px_-24px_rgba(37,84,215,0.45)]'
                            : 'border-slate-100 bg-white hover:border-[#dbe7ff] hover:bg-[#f8fbff]'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-black text-slate-900">{item.student.displayName || '학생'}</span>
                              <Badge className={cn('border text-[10px] font-black', badgeTone)}>{item.statusLabel}</Badge>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-500">{seatLabel} · {item.seat?.seatZone || '미배정'}</p>
                            <p className="text-[11px] font-semibold leading-relaxed text-slate-600">{item.nextAction}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">미납 잔액</p>
                            <p className="dashboard-number mt-1 text-sm text-rose-600">{formatWon(item.totalOutstanding)}</p>
                            {item.overdueDays > 0 ? (
                              <p className="mt-1 text-[10px] font-black text-rose-500">D+{item.overdueDays}</p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] border border-[#dbe7ff] bg-white shadow-[0_24px_56px_-42px_rgba(20,41,95,0.24)]">
                <CardHeader className="gap-4 border-b border-[#e7eefc]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <Badge className="rounded-full border border-[#dbe7ff] bg-[#f8fbff] px-3 py-1 text-[10px] font-black text-[#14295F]">
                        선택 학생 실수납 패널
                      </Badge>
                      <CardTitle className="text-xl font-black tracking-tight text-[#14295F]">
                        {revenueFocusedStudent?.displayName || '학생'} 수납 관리
                      </CardTitle>
                      <CardDescription>
                        월 {timelineMonth} · {timelineTrackLabel} 기준 상세와 최근 인보이스를 같이 봅니다.
                      </CardDescription>
                    </div>
                    {focusedStudentId ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 rounded-xl font-black text-[#14295F]"
                        onClick={() => updateRevenueRoute({ studentId: null, tab: 'revenue' })}
                      >
                        선택 해제
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">현재 필터</p>
                      <p className="mt-2 text-sm font-black text-slate-900">{timelineMonth} · {timelineTrackLabel}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">{revenueFocusedStudentSeat ? formatSeatLabel(revenueFocusedStudentSeat) : '좌석 미배정'}</p>
                    </div>
                    <div className="rounded-[1.4rem] border border-slate-100 bg-slate-50/80 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">최근 상태</p>
                      <div className="mt-2">{revenueFocusedLatestInvoice ? getStatusBadge(revenueFocusedLatestInvoice.status) : <Badge variant="outline">인보이스 없음</Badge>}</div>
                      <p className="mt-2 text-[11px] font-semibold text-slate-500">
                        최근 수납 마감 {revenueFocusedLatestInvoice ? (getInvoiceCollectionEndDate(revenueFocusedLatestInvoice) ? format(getInvoiceCollectionEndDate(revenueFocusedLatestInvoice)!, 'yyyy.MM.dd') : '-') : '-'}
                      </p>
                    </div>
                    <div className="rounded-[1.4rem] border border-rose-100 bg-rose-50/60 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-600">현재 미납 잔액</p>
                      <p className="dashboard-number mt-2 text-xl text-rose-600">{formatWon(revenueFocusedOutstandingAmount)}</p>
                    </div>
                    <div className="rounded-[1.4rem] border border-emerald-100 bg-emerald-50/60 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">선택 월 실수납</p>
                      <p className="dashboard-number mt-2 text-xl text-emerald-700">{formatWon(revenueFocusedCollectedAmount)}</p>
                      <p className="mt-1 text-[11px] font-semibold text-emerald-700/80">{revenueFocusedMonthPayments.length}건 완료</p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      onClick={() =>
                        revenueFocusedStudentId &&
                        createAutoInvoice(
                          revenueFocusedStudentId,
                          revenueFocusedStudent?.displayName || '학생',
                          'studyRoom',
                          Number(quickIssueAmount || 390000) || 390000
                        )
                      }
                      disabled={isSaving || !revenueFocusedStudentId}
                      variant="outline"
                      className="h-11 rounded-xl font-black border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 gap-2"
                    >
                      {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <PlusCircle className="h-4 w-4" />} 트랙 스터디센터 추가 발행
                    </Button>
                    <Button
                      type="button"
                      onClick={() =>
                        revenueFocusedStudentId &&
                        createAutoInvoice(
                          revenueFocusedStudentId,
                          revenueFocusedStudent?.displayName || '학생',
                          'academy',
                          Number(quickIssueAmount || 390000) || 390000
                        )
                      }
                      disabled={isSaving || !revenueFocusedStudentId}
                      variant="outline"
                      className="h-11 rounded-xl font-black border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 gap-2"
                    >
                      {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <PlusCircle className="h-4 w-4" />} 트랙 국어 추가 발행
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-[#14295F]">학생 인보이스 상세</p>
                      <Badge className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black text-slate-600">
                        {revenueScopedInvoices.length > 0 ? `${revenueScopedInvoices.length}건` : `최근 ${Math.min(revenueFocusedStudentInvoices.length, 4)}건`}
                      </Badge>
                    </div>

                    {(revenueScopedInvoices.length > 0 ? revenueScopedInvoices : revenueFocusedStudentInvoices.slice(0, 4)).map((invoice) => {
                      const invoiceTrack = resolveInvoiceTrackCategory(invoice);
                      const trackMeta = INVOICE_TRACK_META[invoiceTrack];
                      const draftPrice = priceDrafts[invoice.id] ?? String(Math.round(Number(invoice.finalPrice) || 0));
                      const parsedDraftPrice = parseDraftPrice(draftPrice);
                      const canSavePrice = parsedDraftPrice !== null && parsedDraftPrice !== Number(invoice.finalPrice || 0);

                      return (
                        <div key={invoice.id} className="rounded-[1.5rem] border border-slate-100 bg-slate-50/60 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={cn('border text-[10px] font-black', trackMeta.badgeClass)}>{trackMeta.label}</Badge>
                                {invoice.isManualInvoice ? (
                                  <Badge className="border border-emerald-200 bg-white text-[10px] font-black text-emerald-700">수기</Badge>
                                ) : null}
                                {getStatusBadge(invoice.status)}
                              </div>
                              <p className="text-sm font-black text-slate-900">
                                {getInvoiceCollectionStartDate(invoice) ? format(getInvoiceCollectionStartDate(invoice)!, 'MM.dd') : '--.--'} ~{' '}
                                {getInvoiceCollectionEndDate(invoice) ? format(getInvoiceCollectionEndDate(invoice)!, 'MM.dd') : '--.--'}
                              </p>
                              <p className="text-[11px] font-semibold text-slate-500">
                                수납 마감 {getInvoiceCollectionEndDate(invoice) ? format(getInvoiceCollectionEndDate(invoice)!, 'yyyy.MM.dd') : '-'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={cn('dashboard-number text-lg', invoice.status === 'paid' ? 'text-emerald-600' : 'text-[#14295F]')}>
                                {formatWon(invoice.finalPrice)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center gap-1.5">
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={draftPrice}
                              onChange={(event) => handlePriceDraftChange(invoice.id, event.target.value)}
                              disabled={isSaving}
                              placeholder="금액"
                              className="h-9 rounded-xl px-3 text-right text-[11px] font-black"
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handlePriceSave(invoice)}
                              disabled={isSaving || !canSavePrice}
                              className="h-9 rounded-xl px-3 text-[11px] font-black"
                            >
                              금액 저장
                            </Button>
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <Select
                              value={invoice.status}
                              onValueChange={(val: any) => handleStatusChange(invoice.id, val)}
                              disabled={isSaving}
                            >
                              <SelectTrigger className="h-10 rounded-xl border-[#dbe7ff] bg-white text-[11px] font-black text-[#14295F]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-none shadow-2xl">
                                <SelectItem value="issued" className="font-bold">수납 대기</SelectItem>
                                <SelectItem value="paid" className="font-bold">수납 완료</SelectItem>
                                <SelectItem value="overdue" className="font-bold">미납/연체</SelectItem>
                                <SelectItem value="void" className="font-bold">무효</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select
                              value={invoiceTrack}
                              onValueChange={(val: InvoiceTrackCategory) => handleTrackCategoryChange(invoice.id, val)}
                              disabled={isSaving}
                            >
                              <SelectTrigger className="h-10 rounded-xl border-[#dbe7ff] bg-white text-[11px] font-black text-[#14295F]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-none shadow-2xl">
                                <SelectItem value="studyRoom" className="font-bold">트랙 스터디센터</SelectItem>
                                <SelectItem value="academy" className="font-bold">트랙 국어</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {invoice.status !== 'paid' ? (
                              <>
                                <Button
                                  type="button"
                                  onClick={() => handleRealPayment(invoice.id)}
                                  className="h-10 rounded-xl font-black text-xs gap-2 bg-blue-600 text-white hover:bg-blue-700"
                                >
                                  <CreditCard className="h-4 w-4" /> 실제 카드 결제
                                </Button>
                                <Select onValueChange={(val) => handleStatusChange(invoice.id, 'paid', val)}>
                                  <SelectTrigger className="h-10 rounded-xl border-emerald-200 bg-white text-xs font-black text-emerald-700">
                                    <div className="flex items-center gap-2"><RefreshCw className="h-4 w-4" /><SelectValue placeholder="수동 수납 완료" /></div>
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl border-none shadow-2xl p-2">
                                    <SelectItem value="card" className="font-bold py-3 rounded-xl">카드 결제 완료</SelectItem>
                                    <SelectItem value="transfer" className="font-bold py-3 rounded-xl">계좌 이체 완료</SelectItem>
                                    <SelectItem value="cash" className="font-bold py-3 rounded-xl">현금 수납 완료</SelectItem>
                                  </SelectContent>
                                </Select>
                              </>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleSingleCollectionReset(invoice.id)}
                                disabled={isSaving}
                                className="h-10 rounded-xl border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 sm:col-span-2"
                              >
                                <RefreshCw className="mr-2 h-4 w-4" /> 수납 완료 복원
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ops" className="animate-in fade-in duration-500">
          {activeTab === 'ops' ? <OperationalIntelligencePanel /> : null}
        </TabsContent>
      </Tabs>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <DialogContent motionPreset="dashboard-premium" className="max-h-[90vh] overflow-y-auto rounded-[2rem] border-none shadow-2xl sm:max-w-lg">
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
              상세 관리 버튼으로 진입하면 이미 인보이스가 있는 학생도 트랙 스터디센터/트랙 국어 인보이스를 추가 발행할 수 있습니다.
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <Badge className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[10px] font-black text-emerald-700">
                    트랙 국어
                  </Badge>
                  <p className="text-sm font-black text-emerald-900">국어 전용 수기 인보이스</p>
                </div>
                <FileText className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="manualAcademyStudentName" className="text-xs font-black uppercase tracking-wide text-emerald-800">
                    학생 이름
                  </Label>
                  <Input
                    id="manualAcademyStudentName"
                    value={manualAcademyStudentName}
                    onChange={(event) => setManualAcademyStudentName(event.target.value.slice(0, 30))}
                    placeholder="예: 김트랙"
                    className="h-11 rounded-xl border-emerald-100 bg-white font-black"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manualAcademyPhone" className="text-xs font-black uppercase tracking-wide text-emerald-800">
                    연락처
                  </Label>
                  <Input
                    id="manualAcademyPhone"
                    type="text"
                    inputMode="numeric"
                    value={manualAcademyPhone}
                    onChange={(event) => setManualAcademyPhone(event.target.value.replace(/[^\d]/g, '').slice(0, 15))}
                    placeholder="선택 입력"
                    className="h-11 rounded-xl border-emerald-100 bg-white font-black"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manualAcademyMemo" className="text-xs font-black uppercase tracking-wide text-emerald-800">
                    메모
                  </Label>
                  <Textarea
                    id="manualAcademyMemo"
                    value={manualAcademyMemo}
                    onChange={(event) => setManualAcademyMemo(event.target.value.slice(0, 300))}
                    placeholder="선택 입력"
                    className="min-h-[80px] rounded-xl border-emerald-100 bg-white text-xs font-bold"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleManualAcademyInvoiceCreate}
                  disabled={isSaving}
                  className="h-11 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700"
                >
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  트랙 국어 수기 발행
                </Button>
              </div>
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

      <AlertDialog open={Boolean(timelineDeleteTarget)} onOpenChange={(open) => !open && setTimelineDeleteTarget(null)}>
        <AlertDialogContent className="overflow-hidden rounded-[2rem] border-none bg-[linear-gradient(180deg,#ffffff_0%,#fff8fb_100%)] p-0 shadow-[0_32px_90px_-42px_rgba(148,27,75,0.42)] sm:max-w-[560px]">
          <div className="relative overflow-hidden border-b border-rose-100/80 bg-[radial-gradient(circle_at_top_right,rgba(255,122,22,0.12),transparent_36%),linear-gradient(135deg,#fff7fa_0%,#ffffff_68%)] px-6 pb-6 pt-6 sm:px-8">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-rose-200/35 blur-3xl" />
            <div className="absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-amber-100/60 blur-2xl" />
            <AlertDialogHeader className="relative space-y-4 text-left">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.4rem] border border-rose-100 bg-white text-rose-600 shadow-[0_18px_30px_-24px_rgba(225,29,72,0.55)]">
                  {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Trash2 className="h-6 w-6" />}
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-500/80">Timeline Delete</p>
                  <AlertDialogTitle className="text-[1.5rem] font-black tracking-tight text-slate-950">
                    잘못 만든 인보이스를 타임라인에서 제거할까요?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="max-w-xl text-sm font-semibold leading-relaxed text-slate-600">
                    인보이스 문서는 `void`로 바뀌고 타임라인/합계에서는 숨겨집니다. 이미 수납 완료된 항목이면 연결 결제 로그도 함께 정리됩니다.
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>
          </div>

          <div className="space-y-4 px-6 pb-6 pt-5 sm:px-8">
            <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_44px_-36px_rgba(15,23,42,0.26)]">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">삭제 대상</p>
                  <p className="text-base font-black tracking-tight text-slate-900">
                    {timelineDeleteTarget?.studentName || '학생'} 학생
                  </p>
                  <p className="text-[11px] font-semibold leading-relaxed text-slate-500">
                    이용 기간 {timelineDeleteTarget?.cycleStartDate ? format(timelineDeleteTarget.cycleStartDate.toDate(), 'yyyy.MM.dd') : '-'} ~ {timelineDeleteTarget?.cycleEndDate ? format(timelineDeleteTarget.cycleEndDate.toDate(), 'yyyy.MM.dd') : '-'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">금액</p>
                  <p className="mt-1 text-lg font-black tracking-tight text-slate-900">
                    {formatWon(Number(timelineDeleteTarget?.finalPrice || 0))}
                  </p>
                  {timelineDeleteTarget ? getStatusBadge(timelineDeleteTarget.status) : null}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-[1.4rem] border border-amber-200 bg-amber-50/80 p-4 text-left">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="space-y-1">
                <p className="text-xs font-black tracking-tight text-amber-900">실수로 만든 항목 정리용입니다.</p>
                <p className="text-[11px] font-semibold leading-relaxed text-amber-800">
                  학생, 금액, 기간이 맞는지 확인한 뒤 실행해 주세요. 삭제 후에는 이 타임라인 월의 카드와 합계에서도 바로 제외됩니다.
                </p>
              </div>
            </div>

            <AlertDialogFooter className="gap-2 border-t border-slate-100 pt-4 sm:gap-2">
              <AlertDialogCancel className="rounded-2xl border-slate-200 bg-white font-black text-slate-600 hover:bg-slate-50">
                취소
              </AlertDialogCancel>
              <Button
                type="button"
                onClick={handleTimelineDelete}
                disabled={isSaving || !timelineDeleteTarget}
                className="rounded-2xl bg-[linear-gradient(135deg,#E11D48_0%,#F43F5E_100%)] px-5 font-black text-white shadow-[0_18px_36px_-20px_rgba(225,29,72,0.6)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_44px_-20px_rgba(225,29,72,0.7)]"
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                타임라인에서 제거
              </Button>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
