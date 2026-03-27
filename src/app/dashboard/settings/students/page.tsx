
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useCollection, useFirestore, useFunctions } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { 
  Search, 
  UserCog, 
  Trash2, 
  Loader2, 
  AlertTriangle, 
  UserX,
  Users,
  LayoutGrid,
  Edit2,
  Save,
  Zap,
  Timer,
  Clock,
  Building2,
  Target,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { StudentProfile, CenterMembership, InviteCode, GrowthProgress } from '@/lib/types';
import { cn } from '@/lib/utils';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { format } from 'date-fns';
import Link from 'next/link';

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

  if (code.includes('failed-precondition')) {
    return '사전 조건이 맞지 않습니다. 학생 코드 중복이나 연동 상태를 확인해 주세요.';
  }
  if (code.includes('invalid-argument')) {
    return '입력값이 올바르지 않습니다. 필수 항목을 확인해 주세요.';
  }
  if (code.includes('permission-denied')) {
    return '수정 권한이 없습니다. 관리자 계정으로 다시 시도해 주세요.';
  }
  if (code.includes('already-exists')) {
    return '이미 등록된 정보입니다. 다른 값으로 시도해 주세요.';
  }

  return fallback;
}
function normalizeParentLinkCode(value: unknown): string {
  if (typeof value === 'string') {
    return value.replace(/\D/g, '').slice(0, 6);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value)).replace(/\D/g, '').slice(0, 6);
  }
  return '';
}

type StudentMembershipStatus = 'active' | 'onHold' | 'withdrawn';

function normalizeStudentMembershipStatus(value: unknown): StudentMembershipStatus {
  if (typeof value !== 'string') return 'active';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'onhold' || normalized === 'on_hold' || normalized === 'pending') return 'onHold';
  if (normalized === 'withdrawn' || normalized === 'inactive') return 'withdrawn';
  return 'active';
}

function studentStatusLabel(status: StudentMembershipStatus): string {
  if (status === 'onHold') return '휴원';
  if (status === 'withdrawn') return '퇴원';
  return '재원';
}

export default function StudentAccountManagementPage() {
  const { activeMembership, viewMode } = useAppContext();
  const firestore = useFirestore();
  const functions = useFunctions();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | StudentMembershipStatus>('all');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState<any>(null);
  
  const [editForm, setEditForm] = useState({
    displayName: '',
    password: '',
    schoolName: '',
    grade: '',
    parentLinkCode: '',
    className: '',
    memberStatus: 'active' as StudentMembershipStatus,
    seasonLp: 0,
    stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 },
    todayStudyMinutes: 0
  });

  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;
  const isAdmin = activeMembership?.role === 'centerAdmin' || activeMembership?.role === 'owner';
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  // 1. 센터 모든 학생 멤버 조회
  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'), 
      where('role', '==', 'student')
    );
  }, [firestore, centerId, isAdmin]);
  
  const { data: studentMembers, isLoading: membersLoading } = useCollection<CenterMembership>(membersQuery, { enabled: isAdmin });

  // 2. 가용 반 리스트 추출
  const invitesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(collection(firestore, 'inviteCodes'), where('centerId', '==', centerId));
  }, [firestore, centerId, isAdmin]);
  const { data: inviteCodes } = useCollection<InviteCode>(invitesQuery, { enabled: isAdmin });

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return collection(firestore, 'centers', centerId, 'students');
  }, [firestore, centerId, isAdmin]);
  const { data: studentsProfiles } = useCollection<StudentProfile>(studentsQuery, { enabled: isAdmin });

  const availableClasses = useMemo(() => {
    const classes = new Set<string>();
    studentMembers?.forEach(m => { if (m.className) classes.add(m.className); });
    inviteCodes?.forEach(i => { if (i.targetClassName) classes.add(i.targetClassName); });
    studentsProfiles?.forEach(p => { if (p.className) classes.add(p.className); });
    return Array.from(classes).sort();
  }, [studentMembers, inviteCodes, studentsProfiles]);

  const filteredStudents = useMemo(() => {
    if (!studentMembers) return [];
    const search = searchTerm.toLowerCase();
    return studentMembers
      .filter((m) => {
        const normalizedStatus = normalizeStudentMembershipStatus(m.status);
        const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;
        const matchesSearch =
          m.displayName?.toLowerCase().includes(search) ||
          m.id.toLowerCase().includes(search);
        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  }, [studentMembers, searchTerm, statusFilter]);

  const statusCounts = useMemo(() => {
    const initial = { all: 0, active: 0, onHold: 0, withdrawn: 0 };
    if (!studentMembers) return initial;
    return studentMembers.reduce((acc, member) => {
      const normalized = normalizeStudentMembershipStatus(member.status);
      acc.all += 1;
      acc[normalized] += 1;
      return acc;
    }, initial);
  }, [studentMembers]);

  const handleOpenEditModal = async (member: CenterMembership) => {
    if (!firestore || !centerId) return;
    
    // 성장 지표 로드
    const progressRef = doc(firestore, 'centers', centerId, 'growthProgress', member.id);
    const progressSnap = await getDoc(progressRef);
    const progress = progressSnap.data() as GrowthProgress;

    // 오늘 공부 시간 로드
    const statRef = doc(firestore, 'centers', centerId, 'dailyStudentStats', todayKey, 'students', member.id);
    const statSnap = await getDoc(statRef);
    const dailyStat = statSnap.data() as any;

    const profile = studentsProfiles?.find(p => p.id === member.id);
    
    setSelectedStudentForEdit(member);
    setEditForm({
      displayName: member.displayName || '',
      password: '',
      schoolName: profile?.schoolName || '',
      grade: profile?.grade || '1학년',
      parentLinkCode: normalizeParentLinkCode(profile?.parentLinkCode),
      className: member.className || '',
      memberStatus: normalizeStudentMembershipStatus(member.status),
      seasonLp: progress?.seasonLp || 0,
      stats: {
        focus: progress?.stats?.focus || 0,
        consistency: progress?.stats?.consistency || 0,
        achievement: progress?.stats?.achievement || 0,
        resilience: progress?.stats?.resilience || 0,
      },
      todayStudyMinutes: dailyStat?.totalStudyMinutes || 0
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateStudent = async () => {
    if (!functions || !centerId || !selectedStudentForEdit) return;

    const normalizedParentLinkCode = normalizeParentLinkCode(editForm.parentLinkCode);
    const currentParentLinkCode = normalizeParentLinkCode(studentsProfiles?.find((profile) => profile.id === selectedStudentForEdit.id)?.parentLinkCode);
    if (normalizedParentLinkCode && !/^\d{6}$/.test(normalizedParentLinkCode)) {
      toast({
        variant: 'destructive',
        title: '\uBD80\uBAA8 \uC5F0\uB3D9\uCF54\uB4DC \uD615\uC2DD \uC624\uB958',
        description: '\uBD80\uBAA8 \uC5F0\uB3D9\uCF54\uB4DC\uB294 6\uC790\uB9AC \uC22B\uC790\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694.',
      });
      return;
    }

    setIsUpdating(selectedStudentForEdit.id);
    try {
      const updateFn = httpsCallable(functions, 'updateStudentAccount', { timeout: 600000 });
      const payload: any = {
        studentId: selectedStudentForEdit.id,
        centerId,
        displayName: editForm.displayName.trim() || undefined,
        schoolName: editForm.schoolName.trim() || undefined,
        grade: editForm.grade || undefined,
        parentLinkCode: normalizedParentLinkCode !== currentParentLinkCode ? (normalizedParentLinkCode || null) : undefined,
        className: editForm.className || null,
        memberStatus: editForm.memberStatus,
        seasonLp: editForm.seasonLp,
        stats: editForm.stats,
        todayStudyMinutes: editForm.todayStudyMinutes,
        dateKey: todayKey,
      };

      if (editForm.password.trim().length >= 6) {
        payload.password = editForm.password.trim();
      }

      await updateFn(payload);
      toast({ title: '학생 데이터가 업데이트되었습니다.' });
      setIsEditModalOpen(false);
    } catch (e: any) {
      const message = resolveCallableErrorMessage(e, '학생 정보 수정 중 오류가 발생했습니다.');
      toast({ variant: 'destructive', title: '수정 실패', description: message });
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDeleteAccount = async (studentId: string, name: string) => {
    if (!functions || !centerId) return;
    
    setIsDeleting(studentId);
    try {
      const deleteFn = httpsCallable(functions, 'deleteStudentAccount', { timeout: 600000 });
      const result: any = await deleteFn({ studentId, centerId });
      
      if (result.data?.ok) {
        toast({ title: "영구 삭제 완료", description: `${name} 학생의 모든 데이터가 정리되었습니다.` });
      } else {
        throw new Error(result.data?.message || "처리 실패");
      }
    } catch (e: any) {
      const message = resolveCallableErrorMessage(e, "학생 계정 삭제 중 오류가 발생했습니다.");
      toast({ variant: "destructive", title: "삭제 실패", description: message });
    } finally {
      setIsDeleting(null);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className={cn("flex flex-col gap-6 max-w-5xl mx-auto pb-24 px-4")}>
      <header className="flex flex-col gap-1">
        <h1 className="font-black tracking-tighter flex items-center gap-2 text-primary text-4xl">
          <UserCog className="h-8 w-8" /> 학생 계정 관리 마스터
        </h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] ml-1 whitespace-nowrap">전체 이력 및 데이터 관리</p>
      </header>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="학생 이름 또는 사용자번호 검색..." 
          className="rounded-2xl border-2 pl-12 h-16 text-lg focus-visible:ring-primary/10 shadow-sm transition-all bg-white"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-muted/20 p-2 shadow-inner">
        <Button
          type="button"
          size="sm"
          variant={statusFilter === 'all' ? 'default' : 'ghost'}
          className="rounded-xl font-black"
          onClick={() => setStatusFilter('all')}
        >
          전체 {statusCounts.all}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={statusFilter === 'active' ? 'default' : 'ghost'}
          className={cn('rounded-xl font-black', statusFilter !== 'active' && 'text-emerald-700 bg-emerald-50')}
          onClick={() => setStatusFilter('active')}
        >
          재원생 {statusCounts.active}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={statusFilter === 'onHold' ? 'default' : 'ghost'}
          className={cn('rounded-xl font-black', statusFilter !== 'onHold' && 'text-amber-700 bg-amber-50')}
          onClick={() => setStatusFilter('onHold')}
        >
          휴원생 {statusCounts.onHold}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={statusFilter === 'withdrawn' ? 'default' : 'ghost'}
          className={cn('rounded-xl font-black', statusFilter !== 'withdrawn' && 'text-slate-700 bg-slate-100')}
          onClick={() => setStatusFilter('withdrawn')}
        >
          퇴원생 {statusCounts.withdrawn}
        </Button>
      </div>

      <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-black/[0.03]">
        <CardHeader className="bg-muted/5 border-b p-8">
          <CardTitle className="text-xl font-black flex items-center gap-2">
            <Users className="h-5 w-5 opacity-40" /> 학생 관리 센터 (재원·휴원·퇴원)
          </CardTitle>
          <CardDescription className="font-bold text-sm">모든 학생의 계정 정보와 성장 지표를 정밀하게 조작하거나 영구히 삭제할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {membersLoading ? (
            <div className="py-40 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 italic whitespace-nowrap">마스터 데이터 동기화 중...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-32 text-center opacity-20 italic font-black text-sm">
              <UserX className="h-16 w-16 mx-auto mb-4" /> 검색 결과가 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-muted/10">
              {filteredStudents.map((member) => {
                const profile = studentsProfiles?.find(p => p.id === member.id);
                const normalizedStatus = normalizeStudentMembershipStatus(member.status);
                return (
                  <div key={member.id} className="p-8 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/5 transition-all group gap-6">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <Avatar className="h-14 w-14 border-4 border-white shadow-xl ring-1 ring-border/50">
                        <AvatarFallback className="bg-primary/5 text-primary font-black text-xl">{member.displayName?.charAt(0) || 'S'}</AvatarFallback>
                      </Avatar>
                      <div className="grid leading-tight min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-lg truncate tracking-tight">{member.displayName}</span>
                          <Badge variant="secondary" className={cn(
                            "font-black text-[8px] border-none h-4 px-1.5",
                            normalizedStatus === 'active'
                              ? "bg-emerald-50 text-emerald-600"
                              : normalizedStatus === 'onHold'
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-700"
                          )}>{studentStatusLabel(normalizedStatus)}</Badge>
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground truncate">{profile?.schoolName || '학교 정보 없음'} · {profile?.grade}</p>
                        <p className="text-[8px] font-mono text-muted-foreground/40 mt-1 uppercase truncate">사용자번호: {member.id}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <Button asChild variant="outline" size="icon" className="h-11 w-11 rounded-xl border-2 shadow-sm bg-white hover:bg-primary hover:text-white transition-all">
                        <Link href={`/dashboard/teacher/students/${member.id}`}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => handleOpenEditModal(member)} className="h-11 w-11 rounded-xl border-2 shadow-sm bg-white hover:bg-primary hover:text-white transition-all"><Edit2 className="h-4 w-4" /></Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm bg-white border shrink-0" disabled={isDeleting === member.id}>
                            {isDeleting === member.id ? <Loader2 className="animate-spin h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-10 max-w-[400px]">
                          <AlertDialogHeader>
                            <div className="mx-auto bg-rose-50 p-4 rounded-[1.5rem] mb-4"><AlertTriangle className="h-10 w-10 text-rose-600" /></div>
                            <AlertDialogTitle className="text-2xl font-black text-center tracking-tighter">영구 강제 삭제</AlertDialogTitle>
                            <AlertDialogDescription className="text-center font-bold pt-2 leading-relaxed">
                              [{member.displayName}] 학생의 모든 데이터와 하위 기록(로그, 계획 등)을 뿌리까지 찾아내어 삭제합니다. 절대 복구할 수 없습니다.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="mt-8 flex flex-col gap-2">
                            <AlertDialogAction onClick={() => handleDeleteAccount(member.id, member.displayName || '학생')} className="h-14 rounded-2xl font-black bg-rose-600 text-white hover:bg-rose-700 shadow-xl active:scale-95 transition-all">강제 삭제 승인</AlertDialogAction>
                            <AlertDialogCancel className="h-14 rounded-2xl font-black border-2">취소</AlertDialogCancel>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col sm:max-w-2xl max-h-[95vh]">
          <div className="bg-primary p-8 text-white relative shrink-0">
            <UserCog className="absolute top-0 right-0 p-8 h-24 w-24 opacity-10 rotate-12" />
            <DialogHeader>
              <DialogTitle className="text-3xl font-black tracking-tighter">학생 데이터 통합 보정</DialogTitle>
              <DialogDescription className="text-white/60 font-bold mt-1 text-sm">계정, 소속, 성장 지표, 공부 시간을 정밀하게 제어합니다.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar p-8 space-y-10">
            <section className="space-y-5">
              <h4 className="text-[10px] font-black uppercase text-primary/60 tracking-widest ml-1 flex items-center gap-2"><Users className="h-3.5 w-3.5" /> {'\uAE30\uBCF8 \uC815\uBCF4 \uBC0F \uC18C\uC18D'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">{'\uC774\uB984'}</Label><Input value={editForm.displayName} onChange={e => setEditForm({...editForm, displayName: e.target.value})} className="h-11 rounded-xl border-2 font-bold" /></div>
                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">{'\uBE44\uBC00\uBC88\uD638 (\uBCC0\uACBD \uC2DC\uC5D0\uB9CC)'}</Label><Input type="password" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="h-11 rounded-xl border-2 font-bold" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">{'\uD559\uAD50'}</Label><Input value={editForm.schoolName} onChange={e => setEditForm({...editForm, schoolName: e.target.value})} className="h-11 rounded-xl border-2 font-bold" /></div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">{'\uD559\uB144'}</Label>
                  <Select value={editForm.grade} onValueChange={v => setEditForm({...editForm, grade: v})}>
                    <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {['1\uD559\uB144', '2\uD559\uB144', '3\uD559\uB144', 'N\uC218\uC0DD'].map(g => <SelectItem key={g} value={g} className="font-bold">{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">{'\uC18C\uC18D \uBC18'}</Label>
                  <Select value={editForm.className || 'none'} onValueChange={v => setEditForm({...editForm, className: v === 'none' ? '' : v})}>
                    <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="none" className="font-bold">{'\uBBF8\uBC30\uC815'}</SelectItem>
                      {availableClasses.map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">상태</Label>
                  <Select value={editForm.memberStatus} onValueChange={(v: StudentMembershipStatus) => setEditForm({...editForm, memberStatus: v})}>
                    <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="active" className="font-bold">재원생</SelectItem>
                      <SelectItem value="onHold" className="font-bold">휴원생</SelectItem>
                      <SelectItem value="withdrawn" className="font-bold">퇴원생</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">{'\uBD80\uBAA8 \uC5F0\uB3D9\uCF54\uB4DC (6\uC790\uB9AC)'}</Label>
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="예: 123456"
                    value={editForm.parentLinkCode}
                    onChange={e => setEditForm({...editForm, parentLinkCode: e.target.value.replace(/\D/g, '').slice(0, 6)})}
                    className="h-11 rounded-xl border-2 font-bold tracking-[0.2em]"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <p className="text-[10px] font-bold text-muted-foreground leading-relaxed">
                    {'\uD559\uC0DD-\uD559\uBD80\uBAA8 \uC5F0\uB3D9\uC5D0 \uC0AC\uC6A9\uD558\uB294 \uCF54\uB4DC\uC785\uB2C8\uB2E4. \uC800\uC7A5 \uC2DC \uC911\uBCF5/\uD615\uC2DD \uAC80\uC99D\uC774 \uC790\uB3D9\uC73C\uB85C \uC801\uC6A9\uB429\uB2C8\uB2E4.'}
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h4 className="text-[10px] font-black uppercase text-emerald-600 tracking-widest ml-1 flex items-center gap-2"><Zap className="h-3.5 w-3.5" /> 성장 지표 보정 (포인트 & 역량)</h4>
              <Card className="rounded-[1.5rem] border-2 border-emerald-100 bg-white p-6 space-y-6 shadow-sm">
                <div className="space-y-3">
                  <div className="flex justify-between items-center"><Label className="text-[10px] font-black text-primary/60 whitespace-nowrap">시즌 포인트</Label><Badge className="bg-emerald-500 text-white font-black whitespace-nowrap">{editForm.seasonLp.toLocaleString()}점</Badge></div>
                  <Slider value={[editForm.seasonLp]} max={50000} step={100} onValueChange={([v]) => setEditForm({...editForm, seasonLp: v})} />
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                  {Object.entries({ focus: '집중력', consistency: '꾸준함', achievement: '목표달성', resilience: '회복력' }).map(([key, label]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground"><span>{label}</span><span className="text-primary">{editForm.stats[key as keyof typeof editForm.stats].toFixed(1)}</span></div>
                      <Slider value={[editForm.stats[key as keyof typeof editForm.stats]]} max={100} step={0.5} onValueChange={([v]) => setEditForm({...editForm, stats: {...editForm.stats, [key]: v}})} />
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            <section className="space-y-4">
              <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest ml-1 flex items-center gap-2"><Timer className="h-3.5 w-3.5" /> 오늘 공부 시간 강제 보정</h4>
              <div className="flex items-center gap-4 p-5 rounded-2xl bg-blue-50/50 border-2 border-blue-100 shadow-sm">
                <div className="bg-white p-3 rounded-xl shadow-md"><Clock className="h-5 w-5 text-blue-600" /></div>
                <div className="flex-1 grid gap-1">
                  <Label className="text-[10px] font-black text-blue-900/60 uppercase whitespace-nowrap">수동 시간 보정(분)</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" value={editForm.todayStudyMinutes} onChange={e => setEditForm({...editForm, todayStudyMinutes: Number(e.target.value)})} className="h-10 rounded-xl border-blue-200 font-black text-xl text-blue-600 text-center" />
                    <span className="text-sm font-black text-blue-900/40 whitespace-nowrap">분</span>
                  </div>
                </div>
                <div className="text-right leading-none">
                  <span className="text-[10px] font-bold text-blue-900/40 block mb-1 whitespace-nowrap">표시 시간</span>
                  <span className="text-lg font-black text-blue-900/80 whitespace-nowrap">{Math.floor(editForm.todayStudyMinutes/60)}시간 {editForm.todayStudyMinutes%60}분</span>
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="p-8 bg-muted/20 border-t shrink-0">
            <Button onClick={handleUpdateStudent} disabled={!!isUpdating} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 gap-2">
              {isUpdating ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />} 전체 데이터 통합 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
