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
  Mail, 
  Lock,
  UserCheck,
  UserMinus,
  PauseCircle,
  Users,
  Activity,
  UserCog
} from 'lucide-react';
import Link from 'next/link';
import { StudentProfile, AttendanceCurrent, CenterMembership } from '@/lib/types';
import { cn } from '@/lib/utils';
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
        return (
          member.displayName?.toLowerCase().includes(search) || 
          profile?.schoolName?.toLowerCase().includes(search) ||
          profile?.seatNo?.toString().includes(search)
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
    if (!centerId || !functions) {
      toast({ variant: "destructive", title: "시스템 오류", description: "센터 정보 또는 서버 함수를 불러올 수 없습니다." });
      return;
    }
    
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
      toast({ 
        variant: "destructive", 
        title: "등록 실패", 
        description: e.message || "학생 등록 중 오류가 발생했습니다."
      });
    } finally {
      setIsSubmitting(false);
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
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>접근 권한 없음</CardTitle>
            <CardDescription>선생님 또는 관리자 계정만 이 페이지를 볼 수 있습니다.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", isMobile ? "gap-4 pb-20" : "gap-8")}>
      <header className={cn("flex justify-between gap-4", isMobile ? "flex-col" : "flex-row items-center")}>
        <div className="flex flex-col gap-1">
          <h1 className={cn("font-black tracking-tighter flex items-center gap-2", isMobile ? "text-2xl" : "text-4xl")}>
            <GraduationCap className={cn("text-primary", isMobile ? "h-6 w-6" : "h-10 w-10")} />
            학생 관리 센터
          </h1>
          <p className={cn("font-bold text-muted-foreground ml-1 uppercase tracking-widest", isMobile ? "text-[9px]" : "text-xs")}>Student Roster & Management</p>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          {activeMembership?.role === 'centerAdmin' && (
            <Button variant="outline" className={cn("rounded-2xl font-black gap-2 border-2", isMobile ? "h-12 flex-1" : "h-14 px-6")} asChild>
              <Link href="/dashboard/settings/students">
                <UserCog className="h-5 w-5" /> 계정 통합 관리
              </Link>
            </Button>
          )}
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className={cn("rounded-2xl font-black gap-2 shadow-lg interactive-button", isMobile ? "h-12 flex-1" : "h-14 px-8 text-base")}>
                <UserPlus className="h-5 w-5" /> 신규 가입
              </Button>
            </DialogTrigger>
            <DialogContent className={cn("rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden transition-all duration-500", isMobile ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] h-[80vh] max-w-[400px] rounded-[2rem]" : "sm:max-w-md")}>
              <div className={cn("bg-primary p-8 text-white relative overflow-hidden shrink-0", isMobile ? "p-6" : "p-10")}>
                 <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                   <UserPlus className={isMobile ? "h-20 w-20" : "h-32 w-32"} />
                 </div>
                 <DialogHeader className="relative z-10">
                   <DialogTitle className={cn("font-black tracking-tighter", isMobile ? "text-2xl" : "text-3xl")}>학생 등록</DialogTitle>
                   <DialogDescription className="text-white/70 font-bold">센터에 학생 계정을 직접 생성합니다.</DialogDescription>
                 </DialogHeader>
              </div>
              
              <div className={cn("grid gap-5 overflow-y-auto custom-scrollbar flex-1", isMobile ? "p-6" : "p-8 max-h-[60vh]")}>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-black uppercase text-primary/70">이름</Label>
                  <Input placeholder="홍길동" value={newStudent.name} onChange={(e) => setNewStudent({...newStudent, name: e.target.value})} className="rounded-xl h-12 border-2" />
                </div>
                
                <div className="grid gap-2">
                  <Label className="text-[10px] font-black uppercase text-primary/70">이메일 (아이디)</Label>
                  <Input type="email" placeholder="student@example.com" value={newStudent.email} onChange={(e) => setNewStudent({...newStudent, email: e.target.value})} className="rounded-xl h-12 border-2" />
                </div>

                <div className="grid gap-2">
                  <Label className="text-[10px] font-black uppercase text-primary/70">비밀번호 (8자 이상)</Label>
                  <Input type="password" placeholder="••••••••" value={newStudent.password} onChange={(e) => setNewStudent({...newStudent, password: e.target.value})} className="rounded-xl h-12 border-2" />
                </div>

                <div className="grid gap-2">
                  <Label className="text-[10px] font-black uppercase text-primary/70">소속 학교</Label>
                  <Input placeholder="예: 동백고등학교" value={newStudent.schoolName} onChange={(e) => setNewStudent({...newStudent, schoolName: e.target.value})} className="rounded-xl h-12 border-2" />
                </div>

                <div className="grid gap-2">
                  <Label className="text-[10px] font-black uppercase text-primary/70">학년</Label>
                  <Select value={newStudent.grade} onValueChange={(val) => setNewStudent({...newStudent, grade: val})}>
                    <SelectTrigger className="rounded-xl h-12 border-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1학년">1학년</SelectItem>
                      <SelectItem value="2학년">2학년</SelectItem>
                      <SelectItem value="3학년">3학년</SelectItem>
                      <SelectItem value="N수생">N수생</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className={cn("bg-muted/30 border-t shrink-0", isMobile ? "p-5" : "p-8")}>
                <Button onClick={handleAddStudent} disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : '학생 계정 생성 완료'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <Tabs defaultValue="active" className="w-full" onValueChange={setStatusTab}>
        <TabsList className={cn("grid grid-cols-3 bg-muted/30 p-1 rounded-2xl border border-border/50 shadow-inner", isMobile ? "h-14 mb-4" : "h-16 mb-8 max-w-2xl")}>
          <TabsTrigger value="active" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-md gap-2 transition-all">
            <UserCheck className="h-4 w-4" /> 
            <span className="hidden sm:inline">재원생</span>
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 rounded-md font-black text-[10px] bg-emerald-50 text-emerald-600">{counts.active}</Badge>
          </TabsTrigger>
          <TabsTrigger value="onHold" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-md gap-2 transition-all">
            <PauseCircle className="h-4 w-4" /> 
            <span className="hidden sm:inline">휴학생</span>
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 rounded-md font-black text-[10px] bg-amber-50 text-amber-600">{counts.onHold}</Badge>
          </TabsTrigger>
          <TabsTrigger value="withdrawn" className="rounded-xl font-black data-[state=active]:bg-white data-[state=active]:shadow-md gap-2 transition-all">
            <UserMinus className="h-4 w-4" /> 
            <span className="hidden sm:inline">퇴원생</span>
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 rounded-md font-black text-[10px] bg-slate-100 text-slate-600">{counts.withdrawn}</Badge>
          </TabsTrigger>
        </TabsList>

        <div className={cn("relative group mb-6", isMobile ? "px-1" : "")}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="이름, 학교 또는 좌석 번호로 검색..." 
            className={cn("rounded-2xl border-2 pl-12 focus-visible:ring-primary/10 shadow-sm transition-all", isMobile ? "h-14 text-base" : "h-16 text-lg")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {membersLoading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
            <p className="font-black text-muted-foreground/40 uppercase tracking-[0.2em] italic">Accessing Student Records...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-32 bg-white/50 backdrop-blur-sm rounded-[3rem] border-2 border-dashed border-border/50">
            <Users className="h-16 w-16 mx-auto text-muted-foreground/10 mb-4" />
            <p className="font-black text-muted-foreground/40 uppercase">해당 상태의 학생이 없습니다.</p>
          </div>
        ) : (
          <div className={cn("grid gap-4", isMobile ? "grid-cols-1 px-1" : "md:grid-cols-2 lg:grid-cols-3")}>
            {filteredStudents.map((member) => {
              const profile = studentsProfiles?.find(p => p.id === member.id);
              const attendance = attendanceList?.find(a => a.studentId === member.id);
              
              return (
                <Link key={member.id} href={`/dashboard/teacher/students/${member.id}`}>
                  <Card className={cn(
                    "rounded-[2rem] border-none shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group overflow-hidden bg-white ring-1 ring-border/50",
                    member.status === 'withdrawn' && "opacity-60 grayscale"
                  )}>
                    <div className={cn(
                      "h-1.5 w-full transition-colors duration-500",
                      attendance?.status === 'studying' ? "bg-emerald-500" : "bg-muted"
                    )} />
                    <CardContent className={isMobile ? "p-5" : "p-6"}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="relative">
                            <Avatar className="h-14 w-14 border-4 border-white shadow-xl ring-1 ring-border/50">
                              <AvatarFallback className="bg-primary/5 text-primary font-black text-xl">
                                {member.displayName?.charAt(0) || 'S'}
                              </AvatarFallback>
                            </Avatar>
                            {attendance?.status === 'studying' && member.status === 'active' && (
                              <div className="absolute -top-1 -right-1">
                                <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-black truncate tracking-tighter">{member.displayName}</h3>
                              {member.status === 'active' && getStatusBadge(attendance?.status)}
                            </div>
                            <div className="flex flex-col text-[10px] font-bold text-muted-foreground leading-tight">
                              <span className="truncate">{profile?.schoolName || '학교 정보 없음'}</span>
                              <span className="opacity-60">{profile?.grade || '학년 정보 없음'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                          <ChevronRight className="h-5 w-5" />
                        </div>
                      </div>
                      
                      <div className="mt-5 flex items-center justify-between p-3.5 bg-muted/20 rounded-2xl border border-border/50">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-white shadow-sm">
                            <Armchair className="h-3.5 w-3.5 text-primary/60" />
                          </div>
                          <span className="text-xs font-black text-primary/80">
                            {profile?.seatNo && profile.seatNo > 0 ? `${profile.seatNo}번 좌석` : '좌석 미지정'}
                          </span>
                        </div>
                        <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest group-hover:text-primary transition-colors">Manage Data</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </Tabs>
    </div>
  );
}
