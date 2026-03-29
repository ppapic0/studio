
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useCollection, useFirestore, useFunctions } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { 
  UserPlus, 
  GraduationCap, 
  ChevronRight, 
  Loader2, 
  UserCheck,
  UserMinus,
  PauseCircle,
  Users,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StudentProfile, AttendanceCurrent, CenterMembership } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatSeatLabel, resolveSeatIdentity } from '@/lib/seat-layout';
import { AdminWorkbenchCommandBar } from '@/components/dashboard/admin-workbench-command-bar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import dynamic from 'next/dynamic';
import { isTeacherOrAdminRole } from '@/lib/dashboard-access';

function resolveCallableErrorMessage(error: any, fallback: string): string {
  const detailMessage =
    typeof error?.details === 'string'
      ? error.details
      : typeof error?.details?.userMessage === 'string'
        ? error.details.userMessage
        : typeof error?.details?.message === 'string'
          ? error.details.message
          : '';

  const rawMessage = String(error?.message || '').replace(/^FirebaseError:\s*/i, '').trim();
  const cleanedRaw = rawMessage
    .replace(/^\d+\s+FAILED_PRECONDITION:\s*/i, '')
    .replace(/^\d+\s+INVALID_ARGUMENT:\s*/i, '')
    .replace(/^\d+\s+ALREADY_EXISTS:\s*/i, '')
    .replace(/^\d+\s+PERMISSION_DENIED:\s*/i, '')
    .replace(/^\d+\s+INTERNAL:\s*/i, '')
    .trim();

  const code = String(error?.code || '').toLowerCase();
  const isInternal = code.includes('internal') || /\b(functions\/internal|internal)\b/i.test(cleanedRaw);

  if (detailMessage) return detailMessage;
  if (!isInternal && cleanedRaw) return cleanedRaw;

  if (code.includes('permission-denied')) {
    return '삭제 권한이 없습니다. 센터관리자 계정인지 확인해 주세요.';
  }
  if (code.includes('failed-precondition')) {
    return '삭제할 학생 계정을 찾지 못했습니다. 학생 등록 상태를 다시 확인해 주세요.';
  }

  return fallback;
}

const RiskIntelligencePanel = dynamic(
  () => import('@/components/dashboard/risk-intelligence').then((mod) => mod.RiskIntelligence),
  {
    ssr: false,
    loading: () => (
      <div className="py-16 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-rose-500/40" />
        <p className="text-xs font-bold text-muted-foreground/60">리스크 분석을 준비하는 중입니다...</p>
      </div>
    ),
  }
);

export default function StudentListPage() {
  const { activeMembership, membershipsLoading, viewMode } = useAppContext();
  const firestore = useFirestore();
  const functions = useFunctions();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusTab, setStatusTab] = useState<string>('active');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [liveStatusFilter, setLiveStatusFilter] = useState<string>('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  
  const isMobile = viewMode === 'mobile';

  // 신규 학생 등록 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [newStudent, setNewStudent] = useState({
    name: '',
    email: '',
    password: '',
    schoolName: '',
    grade: '1학년',
  });

  const centerId = activeMembership?.id;
  const isTeacherOrAdmin = isTeacherOrAdminRole(activeMembership?.role);
  const canViewRiskPanel = isTeacherOrAdmin;
  const [showRiskPanel, setShowRiskPanel] = useState(false);

  useEffect(() => {
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

  // 1. 센터 멤버 중 '학생' 역할인 사용자들 조회
  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isTeacherOrAdmin) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'), 
      where('role', '==', 'student')
    );
  }, [firestore, centerId, isTeacherOrAdmin]);
  
  const { data: studentMembers, isLoading: membersLoading } = useCollection<CenterMembership>(membersQuery, { enabled: isTeacherOrAdmin });

  // 2. 학생 상세 프로필 조회
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isTeacherOrAdmin) return null;
    return collection(firestore, 'centers', centerId, 'students');
  }, [firestore, centerId, isTeacherOrAdmin]);
  
  const { data: studentsProfiles } = useCollection<StudentProfile>(studentsQuery, { enabled: isTeacherOrAdmin });

  // 3. 실시간 출결 상태 조회
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isTeacherOrAdmin) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId, isTeacherOrAdmin]);
  
  const { data: attendanceList } = useCollection<AttendanceCurrent>(attendanceQuery, { enabled: isTeacherOrAdmin });

  const availableClasses = useMemo(() => {
    const classes = Array.from(
      new Set(
        (studentMembers || [])
          .map((member) => member.className?.trim())
          .filter((value): value is string => Boolean(value))
      )
    );
    return classes.sort((a, b) => a.localeCompare(b, 'ko'));
  }, [studentMembers]);

  // 데이터 통합, 필터링 및 정렬
  const filteredStudents = useMemo(() => {
    if (!studentMembers) return [];
    
    const search = searchTerm.toLowerCase();
    
    return studentMembers
      .filter(member => {
        // 상태 필터링
        if (member.status !== statusTab) return false;

        const profile = studentsProfiles?.find(p => p.id === member.id);
        const attendance = attendanceList?.find((item) => item.studentId === member.id);
        const currentLiveStatus =
          attendance?.status === 'studying'
            ? 'studying'
            : attendance?.status === 'away' || attendance?.status === 'break'
              ? 'away'
              : 'absent';

        if (classFilter !== 'all' && (member.className || '') !== classFilter) return false;
        if (liveStatusFilter !== 'all' && currentLiveStatus !== liveStatusFilter) return false;

        // 검색어 필터링
        const seatLabel = formatSeatLabel(profile);
        const seatIdentity = resolveSeatIdentity(profile || {});
        return (
          member.displayName?.toLowerCase().includes(search) || 
          profile?.schoolName?.toLowerCase().includes(search) ||
          seatLabel.toLowerCase().includes(search) ||
          profile?.seatNo?.toString().includes(search) ||
          (seatIdentity.roomSeatNo > 0 && seatIdentity.roomSeatNo.toString().includes(search))
        );
      })
      .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  }, [studentMembers, studentsProfiles, attendanceList, searchTerm, statusTab, classFilter, liveStatusFilter]);

  const selectedStudentPreview = useMemo(() => {
    if (!selectedStudentId) return null;
    const member = studentMembers?.find((item) => item.id === selectedStudentId);
    if (!member) return null;

    const profile = studentsProfiles?.find((item) => item.id === selectedStudentId);
    const attendance = attendanceList?.find((item) => item.studentId === selectedStudentId);
    const seatLabel = formatSeatLabel(profile);
    const attendanceLabel =
      attendance?.status === 'studying'
        ? '공부중'
        : attendance?.status === 'away' || attendance?.status === 'break'
          ? '외출'
          : attendance?.status === 'absent'
            ? '미입실'
            : '확인중';
    const attendanceTone =
      attendance?.status === 'studying'
        ? 'bg-emerald-100 text-emerald-700'
        : attendance?.status === 'away' || attendance?.status === 'break'
          ? 'bg-amber-100 text-amber-700'
          : 'bg-slate-100 text-slate-700';

    return {
      member,
      profile,
      attendance,
      seatLabel,
      attendanceLabel,
      attendanceTone,
    };
  }, [selectedStudentId, studentMembers, studentsProfiles, attendanceList]);

  const counts = useMemo(() => {
    if (!studentMembers) return { active: 0, onHold: 0, withdrawn: 0 };
    return {
      active: studentMembers.filter(m => m.status === 'active').length,
      onHold: studentMembers.filter(m => m.status === 'onHold').length,
      withdrawn: studentMembers.filter(m => m.status === 'withdrawn').length,
    };
  }, [studentMembers]);

  const operationalSummary = useMemo(() => {
    const activeIds = new Set((studentMembers || []).filter((member) => member.status === 'active').map((member) => member.id));
    const activeAttendance = (attendanceList || []).filter((item) => item.studentId && activeIds.has(item.studentId));
    const studyingCount = activeAttendance.filter((item) => item.status === 'studying').length;
    const awayCount = activeAttendance.filter((item) => item.status === 'away' || item.status === 'break').length;
    const absentCount = Math.max(0, activeIds.size - studyingCount - awayCount);
    const assignedSeatCount = (studentsProfiles || []).filter((profile) => {
      const identity = resolveSeatIdentity(profile || {});
      return identity.roomSeatNo > 0 || identity.seatNo > 0;
    }).length;

    return {
      activeStudents: counts.active,
      studyingCount,
      awayCount,
      absentCount,
      assignedSeatCount,
      riskOpenCount: showRiskPanel ? 1 : 0,
    };
  }, [attendanceList, counts.active, showRiskPanel, studentMembers, studentsProfiles]);

  const handleAddStudent = async () => {
    if (!centerId || !functions) return;
    if (!newStudent.name || !newStudent.email || !newStudent.password || !newStudent.schoolName) {
      toast({ variant: "destructive", title: "정보 미입력", description: "모든 필수 정보를 입력해 주세요." });
      return;
    }

    setIsSubmitting(true);
    try {
      const registerStudentFn = httpsCallable(functions, 'registerStudent');
      const result: any = await registerStudentFn({
        email: newStudent.email,
        password: newStudent.password,
        displayName: newStudent.name,
        schoolName: newStudent.schoolName,
        grade: newStudent.grade,
        centerId: centerId
      });

      if (result.data?.ok) {
        toast({ title: "등록 완료", description: `${newStudent.name} 학생의 계정이 생성되었습니다.` });
        setIsAddModalOpen(false);
        setNewStudent({ name: '', email: '', password: '', schoolName: '', grade: '1학년' });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "등록 실패", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async (studentId: string, name: string) => {
    if (!functions || !centerId) return;
    
    setIsDeleting(studentId);
    try {
      // 대량 데이터 삭제를 위해 클라이언트 측 제한 시간을 10분으로 연장
      const deleteFn = httpsCallable(functions, 'deleteStudentAccount', { timeout: 600000 });
      const result: any = await deleteFn({ studentId, centerId });
      
      if (result.data?.ok) {
        toast({ title: "삭제 완료", description: `${name} 학생의 모든 데이터가 영구적으로 삭제되었습니다.` });
      } else {
        throw new Error(result.data?.message || "삭제 처리 실패");
      }
    } catch (e: any) {
      console.error("[Delete Student Error]", e);
      let errorMsg = resolveCallableErrorMessage(e, "계정 삭제 중 오류가 발생했습니다.");
      if (e.code === 'deadline-exceeded') {
        errorMsg = "서버 처리 시간이 너무 오래 걸립니다. 하지만 삭제 작업은 백그라운드에서 계속 진행될 수 있습니다. 잠시 후 확인해 보세요.";
      }
      toast({ 
        variant: "destructive", 
        title: "삭제 실패", 
        description: errorMsg
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleOpenStudent360 = (studentId: string) => {
    if (!studentId) return;
    router.push(`/dashboard/teacher/students/${encodeURIComponent(studentId)}`);
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'studying': return <Badge className="bg-emerald-500 font-black text-[9px] h-5">공부중</Badge>;
      case 'away': return <Badge variant="outline" className="text-amber-500 border-amber-500 font-black text-[9px] h-5">외출중</Badge>;
      case 'break': return <Badge variant="secondary" className="font-black text-[9px] h-5">휴식중</Badge>;
      default: return <Badge variant="outline" className="font-black text-[9px] h-5 opacity-40">미입실</Badge>;
    }
  };

  if (membershipsLoading && !activeMembership) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-30" />
      </div>
    );
  }

  if (!isTeacherOrAdmin) {
    return <div className="flex items-center justify-center h-[60vh]"><p>권한이 없습니다.</p></div>;
  }

  return (
    <div className={cn("flex flex-col", isMobile ? "gap-4 pb-20" : "gap-8")}>
      <header className={cn("flex justify-between gap-4", isMobile ? "flex-col" : "flex-row items-center")}>
        <div className="flex flex-col gap-1">
          <h1 className={cn("font-black tracking-tighter flex items-center gap-2", isMobile ? "text-2xl" : "text-4xl")}>
            <GraduationCap className={cn("text-primary", isMobile ? "h-6 w-6" : "h-10 w-10")} />
            학생 운영 인덱스
          </h1>
          <p className={cn("font-bold text-muted-foreground ml-1 uppercase tracking-widest whitespace-nowrap", isMobile ? "text-[9px]" : "text-xs")}>
            학생 360 진입 전, 상태와 반별 운영 신호를 먼저 좁혀봅니다.
          </p>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className={cn("rounded-2xl font-black gap-2 shadow-lg interactive-button", isMobile ? "h-12 flex-1" : "h-14 px-8 text-base")}>
                <UserPlus className="h-5 w-5" /> 신규 가입
              </Button>
            </DialogTrigger>
            <DialogContent className={cn("rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden", isMobile ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] h-[80vh] max-w-[400px] rounded-[2rem]" : "sm:max-w-md")}>
              <div className="bg-primary p-10 text-white relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><UserPlus className="h-32 w-32" /></div>
                 <DialogHeader className="relative z-10">
                   <DialogTitle className="text-3xl font-black">학생 등록</DialogTitle>
                   <DialogDescription className="text-white/70 font-bold">센터에 학생 계정을 직접 생성합니다.</DialogDescription>
                 </DialogHeader>
              </div>
              <div className="p-8 space-y-5 bg-white overflow-y-auto custom-scrollbar max-h-[50vh]">
                <div className="grid gap-2"><Label className="text-[10px] font-black uppercase text-primary/70">이름</Label><Input placeholder="홍길동" value={newStudent.name} onChange={(e) => setNewStudent({...newStudent, name: e.target.value})} className="rounded-xl h-12 border-2" /></div>
                <div className="grid gap-2"><Label className="text-[10px] font-black uppercase text-primary/70">이메일 (아이디)</Label><Input type="email" placeholder="이메일을 입력하세요" value={newStudent.email} onChange={(e) => setNewStudent({...newStudent, email: e.target.value})} className="rounded-xl h-12 border-2" /></div>
                <div className="grid gap-2"><Label className="text-[10px] font-black uppercase text-primary/70">비밀번호 (8자 이상)</Label><Input type="password" placeholder="••••••••" value={newStudent.password} onChange={(e) => setNewStudent({...newStudent, password: e.target.value})} className="rounded-xl h-12 border-2" /></div>
                <div className="grid gap-2"><Label className="text-[10px] font-black uppercase text-primary/70">소속 학교</Label><Input placeholder="예: 동백고등학교" value={newStudent.schoolName} onChange={(e) => setNewStudent({...newStudent, schoolName: e.target.value})} className="rounded-xl h-12 border-2" /></div>
                <div className="grid gap-2"><Label className="text-[10px] font-black uppercase text-primary/70">학년</Label><Select value={newStudent.grade} onValueChange={(val) => setNewStudent({...newStudent, grade: val})}><SelectTrigger className="rounded-xl h-12 border-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1학년">1학년</SelectItem><SelectItem value="2학년">2학년</SelectItem><SelectItem value="3학년">3학년</SelectItem><SelectItem value="N수생">N수생</SelectItem></SelectContent></Select></div>
              </div>
              <DialogFooter className="bg-muted/30 p-8 border-t"><Button onClick={handleAddStudent} disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">{isSubmitting ? <Loader2 className="animate-spin" /> : '학생 계정 생성 완료'}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {canViewRiskPanel && (
        <Card className="rounded-[2rem] border-none bg-white p-5 shadow-lg ring-1 ring-border/50">
          <div className={cn('flex items-center justify-between gap-3', isMobile ? 'flex-col items-stretch' : 'flex-row')}>
            <div className="space-y-1">
              <p className="text-xs font-black tracking-widest text-muted-foreground">리스크 인텔리전스</p>
              <p className="text-sm font-bold text-muted-foreground">센터관리자 전용 리스크 분석을 학생관리 센터에서 확인합니다.</p>
            </div>
            <Button
              type="button"
              variant={showRiskPanel ? 'default' : 'outline'}
              className="h-10 rounded-xl font-black"
              onClick={() => setShowRiskPanel((prev) => !prev)}
            >
              {showRiskPanel ? '리스크 분석 닫기' : '리스크 분석 열기'}
            </Button>
          </div>
          {showRiskPanel && (
            <div id="risk-analysis" className="pt-5">
              <RiskIntelligencePanel />
            </div>
          )}
        </Card>
      )}

      <section className={cn('grid gap-4', isMobile ? 'grid-cols-2' : 'md:grid-cols-3 xl:grid-cols-6')}>
        {[
          { label: '재원생', value: `${operationalSummary.activeStudents}명`, sub: '현재 관리 대상', tone: 'text-[#14295F] bg-[#eef4ff]' },
          { label: '공부중', value: `${operationalSummary.studyingCount}명`, sub: '실시간 좌석 기준', tone: 'text-emerald-700 bg-emerald-50' },
          { label: '외출', value: `${operationalSummary.awayCount}명`, sub: '복귀 확인 필요', tone: 'text-amber-700 bg-amber-50' },
          { label: '미입실', value: `${operationalSummary.absentCount}명`, sub: '도착 전 / 퇴실 포함', tone: 'text-rose-700 bg-rose-50' },
          { label: '좌석배정', value: `${operationalSummary.assignedSeatCount}명`, sub: '도면 연동 가능', tone: 'text-sky-700 bg-sky-50' },
          { label: '리스크', value: canViewRiskPanel ? (showRiskPanel ? '열림' : '대기') : '-', sub: '센터관리자 분석 패널', tone: 'text-violet-700 bg-violet-50' },
        ].map((item) => (
          <Card key={item.label} className="rounded-[1.75rem] border-none bg-white shadow-md ring-1 ring-black/[0.03]">
            <CardContent className="p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">{item.value}</p>
              <div className={cn('mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black', item.tone)}>
                {item.sub}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <AdminWorkbenchCommandBar
        eyebrow="학생/상담 워크벤치"
        title="학생 운영 워크벤치"
        description="같은 필터와 같은 빠른 실행으로 학생 관리, 상담, 문자, 출결 흐름을 빠르게 묶습니다."
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="이름, 학교 또는 좌석 번호 검색"
        selectValue={classFilter}
        onSelectChange={setClassFilter}
        selectOptions={[
          { value: 'all', label: '반 전체' },
          ...availableClasses.map((className) => ({ value: className, label: className })),
        ]}
        selectLabel="반 필터"
        quickActions={[
          { label: '신규 가입', icon: <UserPlus className="h-4 w-4" />, onClick: () => setIsAddModalOpen(true) },
          { label: '상담 등록', icon: <Users className="h-4 w-4" />, href: '/dashboard/leads' },
          { label: '문자 보내기', icon: <ChevronRight className="h-4 w-4" />, href: '/dashboard/settings/notifications' },
          { label: '출결 이동', icon: <UserCheck className="h-4 w-4" />, href: '/dashboard/attendance' },
        ]}
      >
        <div className="grid gap-1">
          <Label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">실시간 상태</Label>
          <Select value={liveStatusFilter} onValueChange={setLiveStatusFilter}>
            <SelectTrigger className="h-11 min-w-[180px] rounded-xl border-2 font-black">
              <SelectValue placeholder="실시간 상태 전체" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all" className="font-black">실시간 상태 전체</SelectItem>
              <SelectItem value="studying" className="font-black">공부중</SelectItem>
              <SelectItem value="away" className="font-black">외출/휴식</SelectItem>
              <SelectItem value="absent" className="font-black">미입실/퇴실</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </AdminWorkbenchCommandBar>

      <Tabs defaultValue="active" className="w-full" onValueChange={setStatusTab}>
        <TabsList className={cn("grid grid-cols-3 bg-muted/30 p-1 rounded-2xl border border-border/50 shadow-inner", isMobile ? "h-14 mb-4" : "h-16 mb-8 max-w-2xl")}>
          <TabsTrigger value="active" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-md gap-2 transition-all"><UserCheck className="h-4 w-4" /><span className="hidden sm:inline">재원생</span><Badge variant="secondary" className="ml-1 h-5 px-1.5 rounded-md font-black text-[10px] bg-emerald-50 text-emerald-600">{counts.active}</Badge></TabsTrigger>
          <TabsTrigger value="onHold" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-md gap-2 transition-all"><PauseCircle className="h-4 w-4" /><span className="hidden sm:inline">휴학생</span><Badge variant="secondary" className="ml-1 h-5 px-1.5 rounded-md font-black text-[10px] bg-amber-50 text-amber-600">{counts.onHold}</Badge></TabsTrigger>
          <TabsTrigger value="withdrawn" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-md gap-2 transition-all"><UserMinus className="h-4 w-4" /><span className="hidden sm:inline">퇴원생</span><Badge variant="secondary" className="ml-1 h-5 px-1.5 rounded-md font-black text-[10px] bg-slate-100 text-slate-600">{counts.withdrawn}</Badge></TabsTrigger>
        </TabsList>

        {membersLoading ? (<div className="flex flex-col items-center justify-center py-40"><Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" /></div>) : filteredStudents.length === 0 ? (
          <div className="text-center py-32 bg-white/50 rounded-[3rem] border-2 border-dashed"><Users className="h-16 w-16 mx-auto text-muted-foreground/10 mb-4" /><p className="font-black text-muted-foreground/40 uppercase">데이터가 없습니다.</p></div>
        ) : (
          <div className={cn("grid gap-4", isMobile ? "grid-cols-1 px-1" : "xl:grid-cols-2")}>
            {filteredStudents.map((member) => {
              const profile = studentsProfiles?.find(p => p.id === member.id);
              const attendance = attendanceList?.find(a => a.studentId === member.id);
              const seatLabel = formatSeatLabel(profile);
              const attendanceLabel = attendance?.status === 'studying'
                ? '공부중'
                : attendance?.status === 'away' || attendance?.status === 'break'
                  ? '외출'
                  : attendance?.status === 'absent'
                    ? '미입실'
                    : '확인중';
              return (
                <Card key={member.id} className={cn("rounded-[2rem] border-none shadow-lg hover:shadow-2xl transition-all group overflow-hidden bg-white ring-1 ring-border/50", member.status === 'withdrawn' && "bg-muted/5")}>
                  <div className={cn("h-1.5 w-full", attendance?.status === 'studying' ? "bg-emerald-500" : "bg-muted")} />
                  <CardContent className={isMobile ? "p-5" : "p-6"}>
                    <button
                      type="button"
                      onClick={() => setSelectedStudentId(member.id)}
                      className="block w-full text-left rounded-[1.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 min-w-0">
                          <Avatar className="h-14 w-14 border-4 border-white shadow-xl ring-1 ring-border/50"><AvatarFallback className="bg-primary/5 text-primary font-black text-xl">{member.displayName?.charAt(0) || 'S'}</AvatarFallback></Avatar>
                          <div className="flex flex-col min-w-0 gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-black truncate tracking-tighter">{member.displayName}</h3>
                              {member.className ? (
                                <Badge className="h-5 rounded-full border-none bg-slate-100 px-2 text-[10px] font-black text-slate-700">{member.className}</Badge>
                              ) : null}
                              {member.status === 'active' && getStatusBadge(attendance?.status)}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge className="h-6 rounded-full border-none bg-[#eef4ff] px-2.5 text-[10px] font-black text-[#244b90]">
                                {profile?.schoolName || '학교 정보 없음'}
                              </Badge>
                              <Badge className="h-6 rounded-full border-none bg-slate-100 px-2.5 text-[10px] font-black text-slate-700">
                                {profile?.grade || '학년 정보 없음'}
                              </Badge>
                              <Badge className="h-6 rounded-full border-none bg-white ring-1 ring-slate-200 px-2.5 text-[10px] font-black text-slate-600">
                                {seatLabel}
                              </Badge>
                            </div>
                            <div className="grid gap-2 text-[11px] font-bold text-slate-500 sm:grid-cols-3">
                              <div className="rounded-xl bg-slate-50 px-3 py-2">
                                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">현재 상태</p>
                                <p className="mt-1 text-sm font-black text-[#14295F]">{attendanceLabel}</p>
                              </div>
                              <div className="rounded-xl bg-slate-50 px-3 py-2">
                                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">계정 상태</p>
                                <p className="mt-1 text-sm font-black text-[#14295F]">
                                  {member.status === 'active' ? '재원중' : member.status === 'onHold' ? '휴원' : '퇴원'}
                                </p>
                              </div>
                              <div className="rounded-xl bg-slate-50 px-3 py-2">
                                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">운영 이동</p>
                                <p className="mt-1 text-sm font-black text-[#14295F]">운영 그래프 확인하기</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 opacity-20 group-hover:opacity-100 transition-all" />
                      </div>
                    </button>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="h-10 rounded-xl px-4 text-xs font-black" onClick={() => setSelectedStudentId(member.id)}>
                        요약 보기
                      </Button>
                      <Button type="button" className="h-10 rounded-xl px-4 text-xs font-black" onClick={() => handleOpenStudent360(member.id)}>
                        운영 그래프 확인하기
                      </Button>
                    </div>

                    {statusTab === 'withdrawn' && (
                      <div className="mt-4 pt-4 border-t border-dashed border-rose-100">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" disabled={isDeleting === member.id} className="w-full h-11 rounded-xl font-black text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 gap-2 transition-all">
                              {isDeleting === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} 강제 삭제 실행
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-10 max-w-[400px]">
                            <AlertDialogHeader>
                              <div className="mx-auto bg-rose-50 p-4 rounded-[1.5rem] mb-4"><AlertTriangle className="h-10 w-10 text-rose-600" /></div>
                              <AlertDialogTitle className="text-2xl font-black text-center tracking-tighter leading-tight">데이터 강제 삭제</AlertDialogTitle>
                              <AlertDialogDescription className="text-center font-bold pt-2 leading-relaxed text-sm">
                                <span className="text-rose-600 font-black">[{member.displayName}]</span> 학생의 계정과 <span className="font-black text-primary">학습 로그, 계획 등 모든 하위 데이터</span>를 강제로 삭제합니다. 복구가 불가능합니다.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="mt-8 flex flex-col gap-2">
                              <AlertDialogAction onClick={() => handleDeleteAccount(member.id, member.displayName || '학생')} className="h-14 rounded-2xl font-black bg-rose-600 text-white hover:bg-rose-700 shadow-xl active:scale-95 transition-all">{isDeleting === member.id ? <Loader2 className="animate-spin h-5 w-5" /> : '강제 삭제 승인'}</AlertDialogAction>
                              <AlertDialogCancel className="h-14 rounded-2xl font-black border-2">취소</AlertDialogCancel>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </Tabs>

      <Sheet open={!!selectedStudentPreview} onOpenChange={(open) => !open && setSelectedStudentId(null)}>
        <SheetContent side="right" className="w-[96vw] max-w-2xl overflow-y-auto border-none bg-[#f8fbff] px-0 py-0 sm:max-w-2xl">
          {selectedStudentPreview ? (
            <>
              <div className="bg-gradient-to-br from-[#17306f] via-[#2046ab] to-[#2f66ff] px-6 py-6 text-white">
                <SheetHeader className="space-y-2 text-left">
                  <SheetTitle className="text-2xl font-black tracking-tight text-white">
                    {selectedStudentPreview.member.displayName}
                  </SheetTitle>
                  <SheetDescription className="text-sm font-bold text-white/80">
                    학생 360으로 들어가기 전에 현재 상태와 운영 액션을 먼저 확인합니다.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedStudentPreview.member.className ? (
                    <Badge className="border-none bg-white/20 text-white font-black">
                      {selectedStudentPreview.member.className}
                    </Badge>
                  ) : null}
                  <Badge className={cn('border-none font-black', selectedStudentPreview.attendanceTone)}>
                    {selectedStudentPreview.attendanceLabel}
                  </Badge>
                  <Badge className="border-none bg-white/20 text-white font-black">
                    {selectedStudentPreview.seatLabel}
                  </Badge>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">학교 / 학년</p>
                    <p className="mt-2 text-lg font-black tracking-tight text-[#14295F]">
                      {selectedStudentPreview.profile?.schoolName || '학교 미등록'}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {selectedStudentPreview.profile?.grade || '학년 미등록'}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">계정 상태</p>
                    <p className="mt-2 text-lg font-black tracking-tight text-[#14295F]">
                      {selectedStudentPreview.member.status === 'active'
                        ? '재원중'
                        : selectedStudentPreview.member.status === 'onHold'
                          ? '휴원'
                          : '퇴원'}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">학생 운영 인덱스 기준 상태</p>
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">바로 할 일</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Button asChild className="h-11 rounded-xl font-black">
                      <Link href={`/dashboard/teacher/students/${selectedStudentPreview.member.id}`}>학생 360 열기</Link>
                    </Button>
                    <Button asChild variant="outline" className="h-11 rounded-xl font-black">
                      <Link href="/dashboard/attendance">출결 처리</Link>
                    </Button>
                    <Button asChild variant="outline" className="h-11 rounded-xl font-black">
                      <Link href="/dashboard/leads">상담 기록</Link>
                    </Button>
                    <Button asChild variant="outline" className="h-11 rounded-xl font-black">
                      <Link href="/dashboard/settings/notifications">문자 보내기</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
