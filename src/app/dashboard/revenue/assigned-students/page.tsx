
'use client';

import { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/app-context';
import { useCollection, useFirestore } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, orderBy, where, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { AttendanceCurrent, Invoice, CenterMembership, StudentProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, 
  Search, 
  Armchair, 
  ChevronRight, 
  AlertTriangle, 
  PlusCircle,
  RefreshCw,
  Loader2,
  Filter,
  CheckCircle2,
  Receipt,
  History,
  Activity,
  CalendarCheck
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { issueInvoice, syncDailyKpi } from '@/lib/finance-actions';
import { useToast } from '@/hooks/use-toast';

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

  // 1. 실시간 좌석 배정 현황
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery);

  // 2. 인보이스 조회
  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'invoices'), orderBy('cycleEndDate', 'desc'));
  }, [firestore, centerId]);
  const { data: allInvoices, isLoading: invoicesLoading } = useCollection<Invoice>(invoicesQuery);

  // 3. 학생 정보 조회
  const studentMembersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'student'), where('status', '==', 'active'));
  }, [firestore, centerId]);
  const { data: studentMembers } = useCollection<CenterMembership>(studentMembersQuery);

  // --- 수납 시급도 기반 정렬 및 필터링 로직 ---
  const filteredAndSortedStudents = useMemo(() => {
    if (!attendanceList || !allInvoices || !studentMembers) return [];
    
    const assignedSeats = attendanceList.filter(a => a.studentId);
    
    let list = assignedSeats.map(seat => {
      const student = studentMembers.find(m => m.id === seat.studentId);
      const studentInvoices = allInvoices.filter(i => i.studentId === seat.studentId)
        .sort((a, b) => b.cycleEndDate.toMillis() - a.cycleEndDate.toMillis());
      const latestInvoice = studentInvoices?.[0];
      
      let priority = 0;
      let statusKey: 'unpaid' | 'paid' | 'overdue' | 'none' = 'unpaid';
      
      if (!latestInvoice) {
        priority = 100;
        statusKey = 'none';
      } else if (latestInvoice.status !== 'paid' && latestInvoice.cycleEndDate.toDate() < new Date()) {
        priority = 90;
        statusKey = 'overdue';
      } else if (latestInvoice.status !== 'paid') {
        priority = 80;
        statusKey = 'unpaid';
      } else {
        priority = 10;
        statusKey = 'paid';
      }
      
      return { seat, student, latestInvoice, priority, statusKey };
    });

    // 검색어 필터링
    if (searchTerm) {
      list = list.filter(item => item.student?.displayName?.toLowerCase().includes(searchTerm.toLowerCase()));
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
        return a.latestInvoice.cycleEndDate.toMillis() - b.latestInvoice.cycleEndDate.toMillis();
      }
      return 0;
    });
  }, [attendanceList, allInvoices, studentMembers, searchTerm, filterStatus]);

  const handleCreateInvoice = async (studentId: string, name: string) => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      await issueInvoice(firestore, centerId, studentId, 390000, "28일 정기 수강료");
      toast({ title: "28일 주기 인보이스가 생성되었습니다." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "생성 실패", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = attendanceLoading || invoicesLoading;

  return (
    <div className={cn("flex flex-col gap-8 w-full max-w-6xl mx-auto pb-24", isMobile ? "px-1" : "px-4 py-8")}>
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-12 w-12 border-2 shadow-sm bg-white hover:bg-primary hover:text-white transition-all">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <div className="grid">
            <h1 className="text-3xl font-black tracking-tighter text-primary">배정 재원생 수납 현황</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Full Enrollment & Revenue Management</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3 bg-blue-50 text-blue-700 px-4 py-2 rounded-2xl border border-blue-100 font-black text-xs">
          <Activity className="h-4 w-4" /> 총 {attendanceList?.filter(a => a.studentId).length || 0}명 배정됨
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
              <p className="font-black uppercase tracking-widest text-xs italic">Compiling Revenue Matrix...</p>
            </div>
          ) : filteredAndSortedStudents.length === 0 ? (
            <div className="py-32 text-center flex flex-col items-center gap-6 opacity-30">
              <Filter className="h-20 w-20" />
              <p className="font-black text-xl tracking-tight">해당하는 학생이 없습니다.</p>
            </div>
          ) : (
            <div className="divide-y divide-muted/10">
              {filteredAndSortedStudents.map(({ seat, student, latestInvoice, statusKey }: any) => {
                const isOverdue = statusKey === 'overdue';
                const overdueDays = isOverdue ? differenceInDays(new Date(), latestInvoice.cycleEndDate.toDate()) : 0;

                return (
                  <div key={seat.id} className="p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-8 hover:bg-muted/5 transition-all group animate-in fade-in duration-500">
                    <div className="flex items-center gap-6 min-w-0 flex-1">
                      <div className={cn(
                        "h-20 w-20 rounded-[2rem] flex items-center justify-center font-black text-2xl border-4 transition-all duration-500 shadow-xl shrink-0",
                        statusKey === 'paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : 
                        isOverdue ? "bg-rose-50 text-rose-600 border-rose-100 animate-pulse" : 
                        "bg-primary/5 text-primary border-primary/10 group-hover:bg-primary group-hover:text-white"
                      )}>
                        {seat.seatNo}
                      </div>
                      <div className="grid gap-1.5 min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="text-3xl font-black tracking-tighter truncate">{student?.displayName || '학생'}</h3>
                          <Badge variant="outline" className="font-black text-[10px] border-primary/20 text-primary/60 uppercase">{seat.seatZone || 'FLEX'}</Badge>
                          {statusKey === 'paid' && <Badge className="bg-emerald-500 text-white border-none font-black text-[10px] shadow-lg">수납 완료</Badge>}
                          {statusKey === 'overdue' && <Badge className="bg-rose-600 text-white border-none font-black text-[10px] shadow-lg animate-bounce">연체 중</Badge>}
                          {statusKey === 'unpaid' && <Badge className="bg-amber-500 text-white border-none font-black text-[10px] shadow-lg">결제 대기</Badge>}
                          {statusKey === 'none' && <Badge variant="secondary" className="bg-muted text-muted-foreground border-none font-black text-[10px]">인보이스 없음</Badge>}
                        </div>
                        <div className="flex items-center gap-4 text-sm font-bold text-muted-foreground/60">
                          <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4" /> {student?.schoolName || '학교 미정'}</span>
                          <span className="opacity-30">|</span>
                          <span className="flex items-center gap-1.5"><LayoutGrid className="h-4 w-4" /> {student?.className || '반 미정'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-6 shrink-0 w-full sm:w-auto">
                      <div className="text-center sm:text-right space-y-1">
                        {latestInvoice ? (
                          <>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Next Payment Due</p>
                            <div className="flex items-center justify-center sm:justify-end gap-2">
                              <CalendarCheck className={cn("h-4 w-4", isOverdue ? "text-rose-600" : "text-blue-600")} />
                              <span className={cn("text-xl font-black tabular-nums tracking-tight", isOverdue ? "text-rose-600" : "text-primary")}>
                                {format(latestInvoice.cycleEndDate.toDate(), 'yyyy.MM.dd')}
                              </span>
                            </div>
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

                      <div className="w-full sm:w-auto">
                        {latestInvoice ? (
                          <Button 
                            asChild 
                            variant={latestInvoice.status === 'paid' ? 'outline' : 'default'}
                            className={cn(
                              "h-14 rounded-2xl font-black px-8 gap-2 shadow-xl active:scale-95 transition-all w-full",
                              latestInvoice.status === 'paid' ? "border-2" : "bg-primary text-white"
                            )}
                          >
                            <Link href="/dashboard/revenue">
                              상세 관리 <ChevronRight className="h-5 w-5" />
                            </Link>
                          </Button>
                        ) : (
                          <Button 
                            onClick={() => handleCreateInvoice(seat.studentId!, student?.displayName || '학생')}
                            disabled={isSaving}
                            className="h-14 rounded-2xl font-black px-8 bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-xl shadow-blue-100 active:scale-95 transition-all w-full"
                          >
                            {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <PlusCircle className="h-5 w-5" />} 첫 인보이스 발행
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <footer className="pt-8 flex flex-col items-center gap-4 opacity-30">
        <div className="flex items-center gap-3 font-black text-[10px] uppercase tracking-[0.4em] text-primary">
          Analytical Track Unified Billing Control
        </div>
        <p className="text-[9px] font-bold text-center leading-relaxed">
          재원생의 좌석 배정 정보와 인보이스 상태를 대조하여 연체 리스크를 실시간으로 관리합니다.<br/>
          28일 주기가 자동으로 계산되며, 모든 수납 내역은 비즈니스 분석 리포트에 즉시 반영됩니다.
        </p>
      </footer>
    </div>
  );
}
