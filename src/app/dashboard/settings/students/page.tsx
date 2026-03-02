
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
import { collection, query, where, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { 
  Search, 
  UserCog, 
  Trash2, 
  Loader2, 
  UserMinus,
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
  UserX
} from 'lucide-react';
import { StudentProfile, CenterMembership } from '@/lib/types';
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
import { useToast } from '@/hooks/use-toast';

export default function StudentAccountManagementPage() {
  const { activeMembership, viewMode } = useAppContext();
  const firestore = useFirestore();
  const functions = useFunctions();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;
  const isAdmin = activeMembership?.role === 'centerAdmin';

  // 1. 센터 모든 학생 멤버 조회
  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'), 
      where('role', '==', 'student')
    );
  }, [firestore, centerId, isAdmin]);
  
  const { data: studentMembers, isLoading: membersLoading } = useCollection<CenterMembership>(membersQuery, { enabled: isAdmin });

  // 2. 학생 상세 프로필 조회 (학교/학년 정보용)
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return collection(firestore, 'centers', centerId, 'students');
  }, [firestore, centerId, isAdmin]);
  
  const { data: studentsProfiles } = useCollection<StudentProfile>(studentsQuery, { enabled: isAdmin });

  const filteredStudents = useMemo(() => {
    if (!studentMembers) return [];
    const search = searchTerm.toLowerCase();
    return studentMembers
      .filter(m => 
        m.displayName?.toLowerCase().includes(search) || 
        m.id.toLowerCase().includes(search)
      )
      .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  }, [studentMembers, searchTerm]);

  const handleDeleteAccount = async (studentId: string) => {
    if (!functions || !centerId) return;
    
    setIsDeleting(studentId);
    try {
      const deleteFn = httpsCallable(functions, 'deleteStudentAccount');
      const result: any = await deleteFn({ studentId, centerId });
      
      if (result.data?.ok) {
        toast({ title: "삭제 완료", description: "학생 계정과 모든 데이터가 영구 삭제되었습니다." });
      }
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "삭제 실패", 
        description: e.message || "서버 오류가 발생했습니다." 
      });
    } finally {
      setIsDeleting(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md border-none shadow-xl rounded-[2rem]">
          <CardHeader className="text-center p-10">
            <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto mb-4" />
            <CardTitle className="text-2xl font-black">접근 권한 없음</CardTitle>
            <CardDescription className="font-bold">센터 관리자만 이 페이지를 이용할 수 있습니다.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6 max-w-5xl mx-auto pb-24", isMobile ? "px-1" : "gap-10 px-4")}>
      <header className="flex flex-col gap-1">
        <h1 className={cn("font-black tracking-tighter flex items-center gap-2 text-primary", isMobile ? "text-2xl" : "text-4xl")}>
          <UserCog className="h-8 w-8" />
          학생 계정 관리
        </h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] ml-1">Account Lifecycle Management</p>
      </header>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="삭제할 학생의 이름을 검색하세요..." 
          className={cn("rounded-2xl border-2 pl-12 focus-visible:ring-primary/10 shadow-sm transition-all bg-white", isMobile ? "h-14" : "h-16 text-lg")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-black/[0.03]">
        <CardHeader className="bg-muted/5 border-b p-8">
          <CardTitle className="text-xl font-black flex items-center gap-2">
            <Users className="h-5 w-5 opacity-40" /> 등록된 학생 리스트
          </CardTitle>
          <CardDescription className="font-bold">계정을 삭제하면 복구가 불가능하므로 주의해 주세요.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {membersLoading ? (
            <div className="py-40 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Loading Database...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-32 text-center opacity-20 italic font-black text-sm">
              <UserX className="h-16 w-16 mx-auto mb-4" />
              학생 정보가 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-muted/10">
              {filteredStudents.map((member) => {
                const profile = studentsProfiles?.find(p => p.id === member.id);
                return (
                  <div key={member.id} className="p-6 sm:p-8 flex items-center justify-between hover:bg-muted/5 transition-all group">
                    <div className="flex items-center gap-4 min-w-0">
                      <Avatar className="h-14 w-14 border-4 border-white shadow-xl ring-1 ring-border/50">
                        <AvatarFallback className="bg-primary/5 text-primary font-black text-xl">
                          {member.displayName?.charAt(0) || 'S'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid leading-tight min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-lg truncate tracking-tight">{member.displayName}</span>
                          <Badge variant="secondary" className={cn(
                            "font-black text-[8px] border-none h-4 px-1.5",
                            member.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                          )}>
                            {member.status === 'active' ? '재원' : member.status === 'onHold' ? '휴학' : '퇴원'}
                          </Badge>
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground truncate">{profile?.schoolName || '학교 정보 없음'} · {profile?.grade}</p>
                        <p className="text-[8px] font-mono text-muted-foreground/40 mt-1 uppercase">UID: {member.id}</p>
                      </div>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-12 w-12 rounded-2xl text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-95 shadow-sm bg-white border"
                          disabled={isDeleting === member.id}
                        >
                          {isDeleting === member.id ? <Loader2 className="animate-spin h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-10 max-w-[400px]">
                        <AlertDialogHeader>
                          <div className="mx-auto bg-rose-50 p-4 rounded-[1.5rem] mb-4">
                            <AlertTriangle className="h-10 w-10 text-rose-600" />
                          </div>
                          <AlertDialogTitle className="text-2xl font-black text-center tracking-tighter">계정을 영구 삭제하시겠습니까?</AlertDialogTitle>
                          <AlertDialogDescription className="text-center font-bold pt-2 leading-relaxed">
                            <span className="text-rose-600">[{member.displayName}]</span> 학생의 인증 정보, 학습 기록, 성장 데이터가 모두 삭제되며 **절대 복구할 수 없습니다.**
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-8 flex flex-col gap-2">
                          <AlertDialogAction 
                            onClick={() => handleDeleteAccount(member.id)}
                            className="h-14 rounded-2xl font-black bg-rose-600 text-white hover:bg-rose-700 shadow-xl active:scale-95 transition-all"
                          >
                            영구 삭제 승인
                          </AlertDialogAction>
                          <AlertDialogCancel className="h-14 rounded-2xl font-black border-2">취소</AlertDialogCancel>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <footer className="pt-10 flex flex-col items-center gap-4 opacity-30">
        <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-[0.4em] text-primary">
          Administrator Command Center
        </div>
        <p className="text-[9px] font-bold text-center leading-relaxed">
          계정 삭제 시 Firebase Auth 및 Firestore의 모든 연관 문서가 삭제됩니다.<br/>
          퇴원생의 기록을 남기려면 '상태 변경'에서 퇴원 처리를 하세요.
        </p>
      </footer>
    </div>
  );
}
