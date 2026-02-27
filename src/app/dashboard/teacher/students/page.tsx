'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useCollection, useFirestore, useFunctions } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Search, UserPlus, GraduationCap, ChevronRight, Loader2, Armchair, Building2, Mail, Lock } from 'lucide-react';
import Link from 'next/link';
import { StudentProfile, AttendanceCurrent } from '@/lib/types';
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
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function StudentListPage() {
  const { activeMembership } = useAppContext();
  const firestore = useFirestore();
  const functions = useFunctions();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  
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

  // 1. 학생 전체 목록 조회
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'students'), orderBy('name', 'asc'));
  }, [firestore, centerId]);
  const { data: students, isLoading: studentsLoading } = useCollection<StudentProfile>(studentsQuery);

  // 2. 실시간 출결 상태 조회
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList } = useCollection<AttendanceCurrent>(attendanceQuery);

  const filteredStudents = students?.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.schoolName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.seatNo?.toString().includes(searchTerm)
  );

  const handleAddStudent = async () => {
    if (!centerId || !functions) return;
    
    // 필수 값 검증
    if (!newStudent.name || !newStudent.email || !newStudent.password || !newStudent.schoolName) {
      toast({ variant: "destructive", title: "정보 미입력", description: "모든 필수 정보를 입력해 주세요." });
      return;
    }

    if (newStudent.password.length < 8) {
      toast({ variant: "destructive", title: "비밀번호 취약", description: "비밀번호는 최소 8자 이상이어야 합니다." });
      return;
    }

    setIsSubmitting(true);
    try {
      // Cloud Functions 호출
      const registerStudentFn = httpsCallable(functions, 'registerStudent');
      const result: any = await registerStudentFn({
        email: newStudent.email,
        password: newStudent.password,
        displayName: newStudent.name,
        schoolName: newStudent.schoolName,
        grade: newStudent.grade,
        centerId: centerId
      });

      if (result.data.ok) {
        toast({ title: "등록 완료", description: `${newStudent.name} 학생의 계정과 데이터가 생성되었습니다.` });
        setIsAddModalOpen(false);
        setNewStudent({ name: '', email: '', password: '', schoolName: '', grade: '1학년' });
      }
    } catch (e: any) {
      console.error("Add Student Function Error:", e);
      // HttpsError의 상세 메시지를 사용자에게 전달
      const message = e.details?.message || e.message || "서버 오류가 발생했습니다.";
      toast({ 
        variant: "destructive", 
        title: "등록 실패", 
        description: message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'studying': return <Badge className="bg-emerald-500 hover:bg-emerald-600">공부중</Badge>;
      case 'away': return <Badge variant="outline" className="text-amber-500 border-amber-500">외출중</Badge>;
      case 'break': return <Badge variant="secondary">휴식중</Badge>;
      case 'absent': return <Badge variant="destructive">결석</Badge>;
      default: return <Badge variant="outline">미입실</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            학생 관리
          </h1>
          <p className="text-muted-foreground font-bold">센터에 등록된 모든 학생을 관리합니다.</p>
        </div>
        
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl font-black gap-2 h-12 shadow-lg interactive-button">
              <UserPlus className="h-5 w-5" /> 신규 학생 등록
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2rem] sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tighter">신규 학생 가입 및 등록</DialogTitle>
              <DialogDescription className="font-bold text-muted-foreground">학생의 계정을 즉시 생성하고 센터에 배정합니다.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name" className="font-black text-xs uppercase text-primary/70">이름</Label>
                <Input id="name" placeholder="홍길동" value={newStudent.name} onChange={(e) => setNewStudent({...newStudent, name: e.target.value})} className="rounded-xl h-11" />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="email" className="font-black text-xs uppercase text-primary/70 flex items-center gap-1.5"><Mail className="h-3 w-3" /> 이메일 (아이디)</Label>
                <Input id="email" type="email" placeholder="student@example.com" value={newStudent.email} onChange={(e) => setNewStudent({...newStudent, email: e.target.value})} className="rounded-xl h-11" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="pw" className="font-black text-xs uppercase text-primary/70 flex items-center gap-1.5"><Lock className="h-3 w-3" /> 비밀번호 (8자 이상)</Label>
                <Input id="pw" type="password" placeholder="••••••••" value={newStudent.password} onChange={(e) => setNewStudent({...newStudent, password: e.target.value})} className="rounded-xl h-11" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="school" className="font-black text-xs uppercase text-primary/70 flex items-center gap-1.5"><Building2 className="h-3 w-3" /> 소속 학교 (풀네임)</Label>
                <Input id="school" placeholder="예: 동백고등학교" value={newStudent.schoolName} onChange={(e) => setNewStudent({...newStudent, schoolName: e.target.value})} className="rounded-xl h-11" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="grade" className="font-black text-xs uppercase text-primary/70">학년</Label>
                <Select value={newStudent.grade} onValueChange={(val) => setNewStudent({...newStudent, grade: val})}>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue placeholder="학년 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1학년">1학년</SelectItem>
                    <SelectItem value="2학년">2학년</SelectItem>
                    <SelectItem value="3학년">3학년</SelectItem>
                    <SelectItem value="N수생">N수생</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-4 border-t">
              <Button onClick={handleAddStudent} disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black text-lg shadow-lg interactive-button">
                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : '학생 계정 생성 및 등록'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="이름, 학교 또는 좌석 번호로 검색..." 
            className="pl-10 h-11 border-none focus-visible:ring-0 text-base"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {studentsLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-bold text-muted-foreground">학생 데이터를 불러오고 있습니다...</p>
        </div>
      ) : !filteredStudents || filteredStudents.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-[2rem] border-2 border-dashed">
          <p className="font-bold text-muted-foreground">검색 결과가 없거나 등록된 학생이 없습니다.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((student) => {
            const currentStatus = attendanceList?.find(a => a.studentId === student.id);
            return (
              <Link key={student.id} href={`/dashboard/teacher/students/${student.id}`}>
                <Card className="rounded-3xl border-none shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden bg-white">
                  <div className={cn(
                    "h-2 w-full transition-colors",
                    currentStatus?.status === 'studying' ? "bg-emerald-500" : "bg-muted"
                  )} />
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14 border-2 border-primary/10">
                        <AvatarFallback className="bg-primary/5 text-primary font-black text-xl">
                          {student.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-black truncate">{student.name}</h3>
                          {getStatusBadge(currentStatus?.status)}
                        </div>
                        <div className="flex flex-col text-sm text-muted-foreground font-bold">
                          <span className="flex items-center gap-1 text-[11px] text-primary/70">
                            <Building2 className="h-3 w-3" /> {student.schoolName || '학교 정보 없음'}
                          </span>
                          <span>{student.grade}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                    </div>
                    
                    <div className="mt-6 flex items-center justify-between p-3 bg-muted/30 rounded-2xl">
                      <div className="flex items-center gap-2">
                        <Armchair className="h-4 w-4 text-primary/60" />
                        <span className="text-sm font-black text-primary/80">
                          {student.seatNo > 0 ? `${student.seatNo}번 좌석` : '좌석 미지정'}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">관리 페이지 이동</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
