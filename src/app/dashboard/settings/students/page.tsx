
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
import { collection, query, where, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
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
  ArrowRightLeft
} from 'lucide-react';
import { StudentProfile, CenterMembership, InviteCode } from '@/lib/types';
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
import { useToast } from '@/hooks/use-toast';

export default function StudentAccountManagementPage() {
  const { activeMembership, viewMode } = useAppContext();
  const firestore = useFirestore();
  const functions = useFunctions();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  
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

  // 2. 초대 코드 조회 (반 목록 추출용)
  const invitesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(collection(firestore, 'inviteCodes'), where('centerId', '==', centerId));
  }, [firestore, centerId, isAdmin]);
  const { data: inviteCodes } = useCollection<InviteCode>(invitesQuery, { enabled: isAdmin });

  // 3. 학생 상세 프로필 조회 (학교/학년 정보용)
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return collection(firestore, 'centers', centerId, 'students');
  }, [firestore, centerId, isAdmin]);
  
  const { data: studentsProfiles } = useCollection<StudentProfile>(studentsQuery, { enabled: isAdmin });

  const availableClasses = useMemo(() => {
    const classes = new Set<string>();
    studentMembers?.forEach(m => { if (m.className) classes.add(m.className); });
    inviteCodes?.forEach(i => { if (i.targetClassName) classes.add(i.targetClassName); });
    return Array.from(classes).sort();
  }, [studentMembers, inviteCodes]);

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
      } else {
        throw new Error(result.data?.message || "삭제 요청이 거절되었습니다.");
      }
    } catch (e: any) {
      console.error("[Delete Error Details]", e);
      toast({ 
        variant: "destructive", 
        title: "삭제 실패", 
        description: e.message || "서버 오류가 발생했습니다. 권한을 확인해 주세요." 
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleMoveClass = async (studentId: string, newClassName: string) => {
    if (!firestore || !centerId) return;
    setIsUpdating(studentId);
    try {
      const batch = writeBatch(firestore);
      const finalClass = newClassName === 'none' ? '' : newClassName;
      
      // 1. members 컬렉션 업데이트
      const memberRef = doc(firestore, 'centers', centerId, 'members', studentId);
      batch.update(memberRef, { className: finalClass, updatedAt: serverTimestamp() });
      
      // 2. userCenters 컬렉션 업데이트
      const userCenterRef = doc(firestore, 'userCenters', studentId, 'centers', centerId);
      batch.update(userCenterRef, { className: finalClass, updatedAt: serverTimestamp() });
      
      // 3. students 컬렉션 업데이트
      const studentRef = doc(firestore, 'centers', centerId, 'students', studentId);
      batch.update(studentRef, { className: finalClass, updatedAt: serverTimestamp() });

      await batch.commit();
      toast({ title: "반 이동 완료", description: finalClass ? `선택한 학생을 [${finalClass}]으로 배정했습니다.` : "배정을 해제했습니다." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "이동 실패", description: e.message });
    } finally {
      setIsUpdating(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Card className="max-w-md border-none shadow-xl rounded-[2rem]">
          <CardHeader className="text-center p-10">
            <LayoutGrid className="h-12 w-12 text-rose-500 mx-auto mb-4" />
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
          학생 계정 및 반 관리
        </h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] ml-1">Lifecycle & Class Management</p>
      </header>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="학생 이름으로 검색..." 
          className={cn("rounded-2xl border-2 pl-12 focus-visible:ring-primary/10 shadow-sm transition-all bg-white", isMobile ? "h-14" : "h-16 text-lg")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-black/[0.03]">
        <CardHeader className="bg-muted/5 border-b p-8">
          <CardTitle className="text-xl font-black flex items-center gap-2">
            <Users className="h-5 w-5 opacity-40" /> 관리 대상 학생 리스트
          </CardTitle>
          <CardDescription className="font-bold">소속 반을 변경하거나 계정을 영구적으로 삭제할 수 있습니다.</CardDescription>
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
              검색 결과가 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-muted/10">
              {filteredStudents.map((member) => {
                const profile = studentsProfiles?.find(p => p.id === member.id);
                return (
                  <div key={member.id} className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/5 transition-all group gap-6">
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
                            member.status === 'active' ? "bg-emerald-50 text-emerald-600" : member.status === 'onHold' ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"
                          )}>
                            {member.status === 'active' ? '재원' : member.status === 'onHold' ? '휴학' : '퇴원'}
                          </Badge>
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground truncate">{profile?.schoolName || '학교 정보 없음'} · {profile?.grade}</p>
                        <p className="text-[8px] font-mono text-muted-foreground/40 mt-1 uppercase">UID: {member.id}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      {/* 반 이동 셀렉터 */}
                      <div className="flex-1 sm:w-48">
                        <Select 
                          value={member.className || 'none'} 
                          onValueChange={(val) => handleMoveClass(member.id, val)}
                          disabled={isUpdating === member.id}
                        >
                          <SelectTrigger className="rounded-xl border-2 h-11 font-black text-xs bg-white shadow-sm">
                            <div className="flex items-center gap-2">
                              {isUpdating === member.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRightLeft className="h-3 w-3 opacity-40" />}
                              <SelectValue placeholder="반 미배정" />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-none shadow-2xl">
                            <SelectItem value="none" className="font-bold">반 미배정</SelectItem>
                            {availableClasses.map(c => (
                              <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 계정 삭제 */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-11 w-11 rounded-xl text-rose-400 hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-95 shadow-sm bg-white border shrink-0"
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
                              <span className="text-rose-600">[{member.displayName}]</span> 학생의 모든 데이터가 삭제되며 **절대 복구할 수 없습니다.**
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
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <footer className="pt-10 flex flex-col items-center gap-4 opacity-30">
        <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-[0.4em] text-primary">
          Administrator Control Panel
        </div>
        <p className="text-[9px] font-bold text-center leading-relaxed">
          학생의 반 정보는 초대 코드 설정 및 멤버십 데이터와 실시간 연동됩니다.<br/>
          반 이동 시 기존의 학습 리포트 기록은 유지됩니다.
        </p>
      </footer>
    </div>
  );
}
