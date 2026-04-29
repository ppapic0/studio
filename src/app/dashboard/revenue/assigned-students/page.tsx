
'use client';

import { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/app-context';
import { useCollection, useFirestore } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { AttendanceCurrent, Invoice, CenterMembership } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft, 
  Search, 
  Building2,
  ChevronRight, 
  AlertTriangle, 
  PlusCircle,
  Loader2,
  Filter,
  Activity,
  CalendarCheck,
  LayoutGrid
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { addDays, format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { issueInvoice, issueManualAcademyInvoice } from '@/lib/finance-actions';
import { INVOICE_TRACK_META, type InvoiceTrackCategory } from '@/lib/invoice-analytics';
import { getInvoiceCollectionEndDate, getInvoiceCollectionSortTime, isInvoiceCollectionOverdue } from '@/lib/invoice-collection-window';
import { useToast } from '@/hooks/use-toast';
import { formatSeatLabel, getSeatDisplayLabel, resolveSeatIdentity } from '@/lib/seat-layout';

type BillingStatusKey = 'unpaid' | 'paid' | 'overdue' | 'none';
type AssignedBillingRow = {
  type: 'assigned';
  id: string;
  seat: AttendanceCurrent;
  student?: CenterMembership;
  latestInvoice?: Invoice;
  priority: number;
  statusKey: BillingStatusKey;
  displayName: string;
  metaLabel: string;
  trackLabel: string;
  seatLabel: string;
  badgeLabel: string;
};
type ManualAcademyBillingRow = {
  type: 'manualAcademy';
  id: string;
  latestInvoice: Invoice;
  priority: number;
  statusKey: Exclude<BillingStatusKey, 'none'>;
  displayName: string;
  metaLabel: string;
  trackLabel: string;
  seatLabel: string;
  badgeLabel: string;
};
type BillingRow = AssignedBillingRow | ManualAcademyBillingRow;

const createDefaultManualDueDate = () => format(addDays(new Date(), 28), 'yyyy-MM-dd');

function parseInputDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveInvoiceStatusKey(invoice?: Invoice | null): BillingStatusKey {
  if (!invoice) return 'none';
  if (invoice.status !== 'paid' && isInvoiceCollectionOverdue(invoice)) return 'overdue';
  if (invoice.status !== 'paid') return 'unpaid';
  return 'paid';
}

function getBillingPriority(statusKey: BillingStatusKey) {
  if (statusKey === 'none') return 100;
  if (statusKey === 'overdue') return 90;
  if (statusKey === 'unpaid') return 80;
  return 10;
}

export default function AssignedStudentsPage() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const router = useRouter();
  const { toast } = useToast();
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'paid' | 'overdue'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [isManualAcademyDialogOpen, setIsManualAcademyDialogOpen] = useState(false);
  const [manualAcademyStudentName, setManualAcademyStudentName] = useState('');
  const [manualAcademyDueDate, setManualAcademyDueDate] = useState(createDefaultManualDueDate);
  const [manualAcademyAmount, setManualAcademyAmount] = useState('390000');

  // 1. 실시간 좌석 배정 현황
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading, error: attendanceError } = useCollection<AttendanceCurrent>(attendanceQuery);

  // 2. 인보이스 조회
  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'invoices'), orderBy('cycleEndDate', 'desc'));
  }, [firestore, centerId]);
  const { data: allInvoices, isLoading: invoicesLoading, error: invoicesError } = useCollection<Invoice>(invoicesQuery);

  // 3. 학생 정보 조회
  const studentMembersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'student'), where('status', '==', 'active'));
  }, [firestore, centerId]);
  const { data: studentMembers, error: studentMembersError } = useCollection<CenterMembership>(studentMembersQuery);

  const queryErrors = useMemo(
    () => [attendanceError, invoicesError, studentMembersError].filter((error): error is Error => !!error),
    [attendanceError, invoicesError, studentMembersError]
  );

  const hasPermissionIssue = useMemo(
    () =>
      queryErrors.some((error) => {
        const message = (error?.message || '').toLowerCase();
        return (
          message.includes('permission-denied') ||
          message.includes('insufficient permissions') ||
          message.includes('missing or insufficient permissions')
        );
      }),
    [queryErrors]
  );

  const billingRows = useMemo<BillingRow[]>(() => {
    if (!attendanceList || !allInvoices || !studentMembers) return [];

    const assignedRows = attendanceList.filter(a => a.studentId).map<BillingRow>(seat => {
      const student = studentMembers.find(m => m.id === seat.studentId);
      const studentInvoices = allInvoices.filter(i => i.studentId === seat.studentId && i.status !== 'void')
        .sort((a, b) => getInvoiceCollectionSortTime(b) - getInvoiceCollectionSortTime(a));
      const latestInvoice = studentInvoices?.[0];
      const statusKey = resolveInvoiceStatusKey(latestInvoice);
      const seatLabel = formatSeatLabel(seat);

      return {
        type: 'assigned',
        id: `assigned-${seat.id}`,
        seat,
        student,
        latestInvoice,
        priority: getBillingPriority(statusKey),
        statusKey,
        displayName: student?.displayName || latestInvoice?.studentName || '학생',
        metaLabel: (student as any)?.schoolName || '학교 미정',
        trackLabel: student?.className || '반 미정',
        seatLabel,
        badgeLabel: seat.seatZone || '미정',
      };
    });

    const manualRows = allInvoices
      .filter((invoice) => invoice.status !== 'void' && invoice.studentSource === 'manualAcademy')
      .sort((a, b) => getInvoiceCollectionSortTime(b) - getInvoiceCollectionSortTime(a))
      .map<BillingRow>((invoice) => {
        const statusKey = resolveInvoiceStatusKey(invoice) as Exclude<BillingStatusKey, 'none'>;
        return {
          type: 'manualAcademy',
          id: `manual-academy-${invoice.id}`,
          latestInvoice: invoice,
          priority: getBillingPriority(statusKey),
          statusKey,
          displayName: invoice.studentName || '계정 없는 원생',
          metaLabel: invoice.manualStudentPhone ? `연락처 ${invoice.manualStudentPhone}` : '연락처 미등록',
          trackLabel: '트랙 국어',
          seatLabel: '계정 없음',
          badgeLabel: '수기 등록',
        };
      });

    return [...assignedRows, ...manualRows];
  }, [attendanceList, allInvoices, studentMembers]);

  // --- 수납 시급도 기반 정렬 및 필터링 로직 ---
  const filteredAndSortedStudents = useMemo(() => {
    let list = billingRows;

    // 검색어 필터링
    if (searchTerm) {
      const normalizedSearchTerm = searchTerm.toLowerCase();
      list = list.filter(item => item.displayName.toLowerCase().includes(normalizedSearchTerm));
    }

    // 상태 필터링
    if (filterStatus !== 'all') {
      list = list.filter(item => {
        if (filterStatus === 'unpaid') return item.statusKey === 'unpaid' || item.statusKey === 'none';
        return item.statusKey === filterStatus;
      });
    }

    // 우선순위 정렬
    return list.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (a.latestInvoice && b.latestInvoice) {
        return getInvoiceCollectionSortTime(a.latestInvoice) - getInvoiceCollectionSortTime(b.latestInvoice);
      }
      return 0;
    });
  }, [billingRows, searchTerm, filterStatus]);

  const handleCreateInvoice = async (studentId: string, _name: string, trackCategory: InvoiceTrackCategory) => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      const trackMeta = INVOICE_TRACK_META[trackCategory];
      const title = `28일 정기 ${trackMeta.label} 이용료`;
      await issueInvoice(firestore, centerId, studentId, 390000, title, { trackCategory });
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
    const dueDate = parseInputDate(manualAcademyDueDate);
    const amount = Math.round(Number(manualAcademyAmount) || 0);

    if (!studentName) {
      toast({ variant: 'destructive', title: '학생 이름을 입력해 주세요.' });
      return;
    }
    if (!dueDate) {
      toast({ variant: 'destructive', title: '결제 예정일을 입력해 주세요.' });
      return;
    }
    if (amount <= 0) {
      toast({ variant: 'destructive', title: '금액을 입력해 주세요.' });
      return;
    }

    setIsSaving(true);
    try {
      await issueManualAcademyInvoice(firestore, centerId, {
        studentName,
        amount,
        dueDate,
      });
      toast({
        title: '계정 없는 원생 수납 항목을 추가했습니다.',
        description: `${studentName} · ${format(dueDate, 'yyyy.MM.dd')} · ₩${amount.toLocaleString()}`,
      });
      setManualAcademyStudentName('');
      setManualAcademyDueDate(createDefaultManualDueDate());
      setManualAcademyAmount('390000');
      setIsManualAcademyDialogOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: '수기 추가 실패', description: e?.message || '다시 시도해 주세요.' });
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = attendanceLoading || invoicesLoading;

  if (hasPermissionIssue) {
    return (
      <div className={cn("flex w-full justify-center px-4 py-10", isMobile ? "min-h-[48vh]" : "min-h-[56vh]")}>
        <Card className="w-full max-w-xl rounded-[2rem] border border-rose-100 bg-white shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-black text-rose-600">권한 확인이 필요합니다</CardTitle>
            <CardDescription className="font-bold text-slate-600">
              전체 배정 학생 보기는 선생님/센터관리자 권한에서만 접근할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-xl border border-rose-100 bg-rose-50/70 px-4 py-3 text-xs font-bold leading-relaxed text-rose-700">
              계정의 센터 역할(role)과 활성 상태(status)를 확인해 주세요.
            </p>
            <Button type="button" onClick={() => router.push('/dashboard/revenue')} className="h-11 rounded-xl font-black">
              비즈니스 분석으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-8 w-full max-w-6xl mx-auto pb-24", isMobile ? "px-1" : "px-4 py-8")}>
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-12 w-12 border-2 shadow-sm bg-white hover:bg-primary hover:text-white transition-all">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="grid">
            <h1 className="text-3xl font-black tracking-tighter text-primary">배정 재원생 수납 현황</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">전체 등록 및 매출 관리</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700">
            <Activity className="h-4 w-4" /> 총 {billingRows.length || 0}명 관리중
          </div>
          <Button
            type="button"
            onClick={() => setIsManualAcademyDialogOpen(true)}
            className="h-11 rounded-2xl bg-emerald-600 px-4 text-xs font-black text-white shadow-sm hover:bg-emerald-700"
          >
            <PlusCircle className="mr-1.5 h-4 w-4" />
            계정 없는 원생 추가
          </Button>
        </div>
      </header>

      <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-black/5">
        <CardHeader className="bg-muted/5 border-b p-8 sm:p-10">
          <div className={cn("flex flex-col sm:flex-row justify-between items-center gap-6")}>
            <div className="relative w-full sm:w-[350px] group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="학생 이름 검색..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-14 rounded-2xl border-2 pl-12 font-bold text-lg shadow-sm focus-visible:ring-primary/10 transition-all bg-[#fafafa]"
              />
            </div>

            <Button
              type="button"
              onClick={() => setIsManualAcademyDialogOpen(true)}
              className="h-12 w-full rounded-2xl bg-emerald-600 text-xs font-black text-white shadow-sm hover:bg-emerald-700 sm:hidden"
            >
              <PlusCircle className="mr-1.5 h-4 w-4" />
              계정 없는 원생 추가
            </Button>
            
            <div className="flex items-center gap-2 bg-muted/20 p-1.5 rounded-2xl border shadow-inner w-full sm:w-auto overflow-x-auto custom-scrollbar">
              <Button 
                variant={filterStatus === 'all' ? 'default' : 'ghost'} 
                onClick={() => setFilterStatus('all')}
                className="rounded-xl h-10 font-black text-xs px-4"
              >전체</Button>
              <Button 
                variant={filterStatus === 'overdue' ? 'destructive' : 'ghost'} 
                onClick={() => setFilterStatus('overdue')}
                className={cn("rounded-xl h-10 font-black text-xs px-4", filterStatus !== 'overdue' && "text-rose-600")}
              >미납/연체</Button>
              <Button 
                variant={filterStatus === 'unpaid' ? 'default' : 'ghost'} 
                onClick={() => setFilterStatus('unpaid')}
                className={cn("rounded-xl h-10 font-black text-xs px-4", filterStatus !== 'unpaid' && "text-amber-600 bg-amber-50")}
              >수납 대기</Button>
              <Button 
                variant={filterStatus === 'paid' ? 'default' : 'ghost'} 
                onClick={() => setFilterStatus('paid')}
                className={cn("rounded-xl h-10 font-black text-xs px-4", filterStatus !== 'paid' && "text-emerald-600 bg-emerald-50")}
              >수납 완료</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-40 flex flex-col items-center justify-center gap-4 opacity-20">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="font-black uppercase tracking-widest text-xs italic whitespace-nowrap">매출 데이터를 집계하는 중...</p>
            </div>
          ) : filteredAndSortedStudents.length === 0 ? (
            <div className="py-32 text-center flex flex-col items-center gap-6 opacity-30">
              <Filter className="h-20 w-20" />
              <p className="font-black text-xl tracking-tight">해당하는 학생이 없습니다.</p>
            </div>
          ) : (
            <div className="divide-y divide-muted/10">
              {filteredAndSortedStudents.map((row) => {
                const { latestInvoice, statusKey } = row;
                const isOverdue = statusKey === 'overdue';
                const latestInvoiceCollectionEndDate = latestInvoice ? getInvoiceCollectionEndDate(latestInvoice) : null;
                const overdueDays = isOverdue && latestInvoiceCollectionEndDate
                  ? differenceInDays(new Date(), latestInvoiceCollectionEndDate)
                  : 0;
                const isManualAcademy = row.type === 'manualAcademy';
                const seatIdentity = row.type === 'assigned' ? resolveSeatIdentity(row.seat) : null;
                const avatarLabel = row.type === 'assigned'
                  ? getSeatDisplayLabel(row.seat) || seatIdentity?.roomSeatNo || row.seat.seatNo
                  : '국어';

                return (
                  <div key={row.id} className="p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-8 hover:bg-muted/5 transition-all group animate-in fade-in duration-500">
                    <div className="flex items-center gap-6 min-w-0 flex-1">
                      <div className={cn(
                        "h-20 w-20 rounded-[2rem] flex items-center justify-center font-black text-2xl border-4 transition-all duration-500 shadow-xl shrink-0",
                        statusKey === 'paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                        isOverdue ? "bg-rose-50 text-rose-600 border-rose-100 animate-pulse" : 
                        "bg-primary/5 text-primary border-primary/10 group-hover:bg-primary group-hover:text-white"
                      )}>
                        {avatarLabel}
                      </div>
                      <div className="grid gap-1.5 min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="text-3xl font-black tracking-tighter truncate">{row.displayName}</h3>
                          <Badge variant="outline" className="font-black text-[10px] border-primary/20 text-primary/60 whitespace-nowrap">{row.badgeLabel}</Badge>
                          {isManualAcademy && <Badge className="border-none bg-emerald-50 text-emerald-700 font-black text-[10px]">계정 없음</Badge>}
                          {statusKey === 'paid' && <Badge className="bg-emerald-500 text-white border-none font-black text-[10px] shadow-lg">수납 완료</Badge>}
                          {statusKey === 'overdue' && <Badge className="bg-rose-600 text-white border-none font-black text-[10px] shadow-lg animate-bounce">연체 중</Badge>}
                          {statusKey === 'unpaid' && <Badge className="bg-amber-500 text-white border-none font-black text-[10px] shadow-lg">결제 대기</Badge>}
                          {statusKey === 'none' && <Badge variant="secondary" className="bg-muted text-muted-foreground border-none font-black text-[10px]">인보이스 없음</Badge>}
                        </div>
                        <div className="flex items-center gap-4 text-sm font-bold text-muted-foreground/60">
                          <span className="flex items-center gap-1.5 text-primary"><LayoutGrid className="h-4 w-4" /> {row.seatLabel}</span>
                          <span className="opacity-30">|</span>
                          <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4" /> {row.metaLabel}</span>
                          <span className="opacity-30">|</span>
                          <span className="flex items-center gap-1.5"><Activity className="h-4 w-4" /> {row.trackLabel}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-6 shrink-0 w-full sm:w-auto">
                      <div className="text-center sm:text-right space-y-1">
                        {latestInvoice ? (
                          <>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60 whitespace-nowrap">다음 결제 예정일</p>
                            <div className="flex items-center justify-center sm:justify-end gap-2">
                              <CalendarCheck className={cn("h-4 w-4", isOverdue ? "text-rose-600" : "text-blue-600")} />
                              <span className={cn("text-xl font-black tabular-nums tracking-tight", isOverdue ? "text-rose-600" : "text-primary")}>
                              {latestInvoiceCollectionEndDate ? format(latestInvoiceCollectionEndDate, 'yyyy.MM.dd') : '-'}
                              </span>
                            </div>
                            <p className="text-[11px] font-black text-muted-foreground/60">
                              청구 금액 ₩{Math.round(Number(latestInvoice.finalPrice) || 0).toLocaleString()}
                            </p>
                            {isOverdue && (
                              <div className="flex items-center justify-center sm:justify-end gap-1.5 text-rose-600 font-black text-[10px] uppercase animate-pulse">
                                <AlertTriangle className="h-3 w-3" /> 미납 D+{overdueDays}일 경과
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-xs font-bold text-muted-foreground/40 italic">결제 이력 없음</p>
                        )}
                      </div>

                      <div className="w-px h-12 bg-border/50 hidden sm:block" />

                      <div className="w-full sm:w-auto space-y-2">
                        {latestInvoice && (
                          <Button
                            asChild
                            variant={latestInvoice.status === 'paid' ? 'outline' : 'default'}
                            className={cn(
                              "h-11 rounded-xl font-black px-6 gap-2 shadow-lg active:scale-95 transition-all w-full",
                              latestInvoice.status === 'paid' ? "border-2" : "bg-primary text-white"
                            )}
                          >
                            <Link href={`/dashboard/revenue?studentId=${encodeURIComponent(latestInvoice.studentId)}`}>
                              상세 관리 <ChevronRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                        {row.type === 'assigned' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Button
                              onClick={() => handleCreateInvoice(row.seat.studentId!, row.displayName, 'studyRoom')}
                              disabled={isSaving}
                              variant="outline"
                              className="h-11 rounded-xl font-black px-4 border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
                            >
                              {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-1" /> : <PlusCircle className="h-4 w-4 mr-1" />} 트랙 스터디센터 추가 발급
                            </Button>
                            <Button
                              onClick={() => handleCreateInvoice(row.seat.studentId!, row.displayName, 'academy')}
                              disabled={isSaving}
                              variant="outline"
                              className="h-11 rounded-xl font-black px-4 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                            >
                              {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-1" /> : <PlusCircle className="h-4 w-4 mr-1" />} 트랙 국어 추가 발급
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isManualAcademyDialogOpen} onOpenChange={setIsManualAcademyDialogOpen}>
        <DialogContent motionPreset="dashboard-premium" className="overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-lg">
          <div className="bg-[linear-gradient(135deg,#052E2B_0%,#047857_52%,#10B981_100%)] px-6 py-6 text-white">
            <DialogHeader className="text-left">
              <Badge className="w-fit border-none bg-white/18 px-2.5 py-1 text-[10px] font-black text-white">
                트랙 국어
              </Badge>
              <DialogTitle className="mt-3 text-2xl font-black tracking-tight">
                계정 없는 원생 수납 추가
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm font-bold leading-6 text-white/75">
                센터 좌석 계정이 없어도 이름, 결제 예정일, 금액만으로 수납 항목을 만들 수 있습니다.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] px-6 py-6">
            <div className="grid gap-2">
              <Label htmlFor="manualAcademyStudentName" className="text-xs font-black uppercase tracking-wide text-emerald-800">
                학생 이름
              </Label>
              <Input
                id="manualAcademyStudentName"
                value={manualAcademyStudentName}
                onChange={(event) => setManualAcademyStudentName(event.target.value.slice(0, 30))}
                placeholder="예: 김트랙"
                className="h-12 rounded-xl border-emerald-100 bg-white font-black"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="manualAcademyDueDate" className="text-xs font-black uppercase tracking-wide text-emerald-800">
                결제 예정일
              </Label>
              <Input
                id="manualAcademyDueDate"
                type="date"
                value={manualAcademyDueDate}
                onChange={(event) => setManualAcademyDueDate(event.target.value)}
                className="h-12 rounded-xl border-emerald-100 bg-white font-black"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="manualAcademyAmount" className="text-xs font-black uppercase tracking-wide text-emerald-800">
                금액
              </Label>
              <Input
                id="manualAcademyAmount"
                type="text"
                inputMode="numeric"
                value={manualAcademyAmount}
                onChange={(event) => setManualAcademyAmount(event.target.value.replace(/[^\d]/g, '').slice(0, 10))}
                placeholder="예: 390000"
                className="h-12 rounded-xl border-emerald-100 bg-white font-black"
              />
              <p className="text-[11px] font-bold text-muted-foreground">
                저장 후 이 목록과 수익 분석 인보이스 타임라인에 함께 표시됩니다.
              </p>
            </div>
          </div>

          <DialogFooter className="border-t bg-white px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl font-black"
              onClick={() => setIsManualAcademyDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleManualAcademyInvoiceCreate}
              disabled={isSaving}
              className="h-11 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              수납 항목 추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <footer className="pt-8 flex flex-col items-center gap-4 opacity-30">
        <div className="flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.4em] text-primary">
          통합 수납 관리 트랙
        </div>
        <p className="text-[9px] font-bold text-center leading-relaxed">
          재원생의 좌석 배정 정보와 인보이스 상태를 대조하여 연체 리스크를 실시간으로 관리합니다.<br/>
          28일 주기가 자동으로 계산되며, 모든 수납 내역은 비즈니스 분석 리포트에 즉시 반영됩니다.
        </p>
      </footer>
    </div>
  );
}
