
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
import { collection, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { 
  Search, 
  UserPlus, 
  GraduationCap, 
  ChevronRight, 
  Loader2, 
  Armchair, 
  Building2, 
  UserCheck,
  UserMinus,
  PauseCircle,
  Users,
  Activity,
  UserCog,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { StudentProfile, AttendanceCurrent, CenterMembership } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatSeatLabel, resolveSeatIdentity } from '@/lib/seat-layout';
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

export default function StudentListPage() {
  const { activeMembership, viewMode } = useAppContext();
  const firestore = useFirestore();
  const functions = useFunctions();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusTab, setStatusTab] = useState<string>('active');
  
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
  const isTeacherOrAdmin = activeMembership?.role === 'teacher' || activeMembership?.role === 'centerAdmin';

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

  // 데이터 통합, 필터링 및 정렬
  const filteredStudents = useMemo(() => {
    if (!studentMembers) return [];
    
    const search = searchTerm.toLowerCase();
    
    return studentMembers
      .filter(member => {
        // 상태 필터링
        if (member.status !== statusTab) return false;

        // 검색어 필터링
        const profile = studentsProfiles?.find(p => p.id === member.id);
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
  }, [studentMembers, studentsProfiles, searchTerm, statusTab]);

  const counts = useMemo(() => {
    if (!studentMembers) return { active: 0, onHold: 0, withdrawn: 0 };
    return {
      active: studentMembers.filter(m => m.status === 'active').length,
      onHold: studentMembers.filter(m => m.status === 'onHold').length,
      withdrawn: studentMembers.filter(m => m.status === 'withdrawn').length,
    };
  }, [studentMembers]);

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
      let errorMsg = "계정 삭제 중 오류가 발생했습니다.";
      if (e.code === 'deadline-exceeded') {
        errorMsg = "서버 처리 시간이 너무 오래 걸립니다. 하지만 삭제 작업은 백그라운드에서 계속 진행될 수 있습니다. 잠시 후 확인해 보세요.";
      } else if (e.message) {
        errorMsg = e.message;
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

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'studying': return <Badge className="bg-emerald-500 font-black text-[9px] h-5">공부중</Badge>;
      case 'away': return <Badge variant="outline" className="text-amber-500 border-amber-500 font-black text-[9px] h-5">외출중</Badge>;
      case 'break': return <Badge variant="secondary" className="font-black text-[9px] h-5">휴식중</Badge>;
      default: return <Badge variant="outline" className="font-black text-[9px] h-5 opacity-40">미입실</Badge>;
    }
  };

  if (!isTeacherOrAdmin) {
    return <div className="flex items-center justify-center h-[60vh]"><p>권한이 없습니다.</p></div>;
  }

  return (
    <div className={cn("flex flex-col", isMobile ? "gap-4 pb-20" : "gap-8")}>
      <header className={cn("flex justify-between gap-4", isMobile ? "flex-col" : "flex-row items-center")}>
        <div className="flex flex-col gap-1">
          <h1 className={cn("font-black tracking-tighter flex items-center gap-2", isMobile ? "text-2xl" : "text-4xl")}>
            <GraduationCap className={cn("text-primary", isMobile ? "h-6 w-6" : "h-10 w-10")} />
            학생 관리 센터
          </h1>
          <p className={cn("font-bold text-muted-foreground ml-1 uppercase tracking-widest whitespace-nowrap", isMobile ? "text-[9px]" : "text-xs")}>학생 명단 및 관리</p>
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

      <Tabs defaultValue="active" className="w-full" onValueChange={setStatusTab}>
        <TabsList className={cn("grid grid-cols-3 bg-muted/30 p-1 rounded-2xl border border-border/50 shadow-inner", isMobile ? "h-14 mb-4" : "h-16 mb-8 max-w-2xl")}>
          <TabsTrigger value="active" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-md gap-2 transition-all"><UserCheck className="h-4 w-4" /><span className="hidden sm:inline">재원생</span><Badge variant="secondary" className="ml-1 h-5 px-1.5 rounded-md font-black text-[10px] bg-emerald-50 text-emerald-600">{counts.active}</Badge></TabsTrigger>
          <TabsTrigger value="onHold" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-md gap-2 transition-all"><PauseCircle className="h-4 w-4" /><span className="hidden sm:inline">휴학생</span><Badge variant="secondary" className="ml-1 h-5 px-1.5 rounded-md font-black text-[10px] bg-amber-50 text-amber-600">{counts.onHold}</Badge></TabsTrigger>
          <TabsTrigger value="withdrawn" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-md gap-2 transition-all"><UserMinus className="h-4 w-4" /><span className="hidden sm:inline">퇴원생</span><Badge variant="secondary" className="ml-1 h-5 px-1.5 rounded-md font-black text-[10px] bg-slate-100 text-slate-600">{counts.withdrawn}</Badge></TabsTrigger>
        </TabsList>

        <div className={cn("relative group mb-6", isMobile ? "px-1" : "")}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
          <Input placeholder="이름, 학교 또는 좌석 번호로 검색..." className={cn("rounded-2xl border-2 pl-12 focus-visible:ring-primary/10 shadow-sm transition-all bg-white", isMobile ? "h-14 text-base" : "h-16 text-lg")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        {membersLoading ? (<div className="flex flex-col items-center justify-center py-40"><Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" /></div>) : filteredStudents.length === 0 ? (
          <div className="text-center py-32 bg-white/50 rounded-[3rem] border-2 border-dashed"><Users className="h-16 w-16 mx-auto text-muted-foreground/10 mb-4" /><p className="font-black text-muted-foreground/40 uppercase">데이터가 없습니다.</p></div>
        ) : (
          <div className={cn("grid gap-4", isMobile ? "grid-cols-1 px-1" : "md:grid-cols-2 lg:grid-cols-3")}>
            {filteredStudents.map((member) => {
              const profile = studentsProfiles?.find(p => p.id === member.id);
              const attendance = attendanceList?.find(a => a.studentId === member.id);
              return (
                <Card key={member.id} className={cn("rounded-[2rem] border-none shadow-lg hover:shadow-2xl transition-all group overflow-hidden bg-white ring-1 ring-border/50", member.status === 'withdrawn' && "bg-muted/5")}>
                  <div className={cn("h-1.5 w-full", attendance?.status === 'studying' ? "bg-emerald-500" : "bg-muted")} />
                  <CardContent className={isMobile ? "p-5" : "p-6"}>
                    <Link href={`/dashboard/teacher/students/${member.id}`} className="block">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <Avatar className="h-14 w-14 border-4 border-white shadow-xl ring-1 ring-border/50"><AvatarFallback className="bg-primary/5 text-primary font-black text-xl">{member.displayName?.charAt(0) || 'S'}</AvatarFallback></Avatar>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2"><h3 className="text-lg font-black truncate tracking-tighter">{member.displayName}</h3>{member.status === 'active' && getStatusBadge(attendance?.status)}</div>
                            <div className="flex flex-col text-[10px] font-bold text-muted-foreground leading-tight"><span className="truncate">{profile?.schoolName || '학교 정보 없음'}</span><span className="opacity-60">{profile?.grade || '학년 정보 없음'}</span></div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 opacity-20 group-hover:opacity-100 transition-all" />
                      </div>
                    </Link>
                    
                    <div className="mt-5 flex items-center justify-between rounded-2xl border border-border/50 bg-muted/20 p-3.5">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-white p-1.5 shadow-sm"><Armchair className="h-3.5 w-3.5 text-primary/60" /></div>
                        <span className="text-xs font-black text-primary/80">{formatSeatLabel(profile)}</span>
                      </div>
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
    </div>
  );
}
