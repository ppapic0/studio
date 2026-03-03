
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
import { collection, query, where, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
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
  ArrowRightLeft,
  Edit2,
  Lock,
  School,
  Hash,
  ShieldCheck,
  Check
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

export default function StudentAccountManagementPage() {
  const { activeMembership, viewMode } = useAppContext();
  const firestore = useFirestore();
  const functions = useFunctions();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState<any>(null);
  
  // 수정 폼 상태
  const [editForm, setEditForm] = useState({
    displayName: '',
    password: '',
    schoolName: '',
    grade: '',
    parentLinkCode: ''
  });

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

  // 3. 학생 상세 프로필 조회
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
      .filter(m => 
        m.displayName?.toLowerCase().includes(search) || 
        m.id.toLowerCase().includes(search)
      )
      .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  }, [studentMembers, searchTerm]);

  const handleOpenEditModal = (member: CenterMembership) => {
    const profile = studentsProfiles?.find(p => p.id === member.id);
    setSelectedStudentForEdit(member);
    setEditForm({
      displayName: member.displayName || '',
      password: '',
      schoolName: profile?.schoolName || '',
      grade: profile?.grade || '1학년',
      parentLinkCode: profile?.parentLinkCode || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateStudent = async () => {
    if (!functions || !centerId || !selectedStudentForEdit) return;
    
    setIsUpdating(selectedStudentForEdit.id);
    try {
      const updateFn = httpsCallable(functions, 'updateStudentAccount');
      const result: any = await updateFn({
        studentId: selectedStudentForEdit.id,
        centerId,
        displayName: editForm.displayName,
        password: editForm.password.length >= 6 ? editForm.password : undefined,
        schoolName: editForm.schoolName,
        grade: editForm.grade,
        parentLinkCode: editForm.parentLinkCode
      });

      if (result.data?.ok) {
        toast({ title: "정보 수정 완료", description: "학생의 계정 정보가 업데이트되었습니다." });
        setIsEditModalOpen(false);
      } else {
        throw new Error(result.data?.message || "수정 실패");
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "수정 실패", description: e.message });
    } finally {
      setIsUpdating(null);
    }
  };

  const handleDeleteAccount = async (studentId: string) => {
    if (!functions || !centerId) return;
    
    setIsDeleting(studentId);
    try {
      const deleteFn = httpsCallable(functions, 'deleteStudentAccount');
      const result: any = await deleteFn({ studentId, centerId });
      
      if (result.data?.ok) {
        toast({ title: "삭제 완료", description: result.data.message });
      } else {
        throw new Error(result.data?.message || "삭제 실패");
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "삭제 실패", description: e.message });
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
      
      const memberRef = doc(firestore, 'centers', centerId, 'members', studentId);
      const userCenterRef = doc(firestore, 'userCenters', studentId, 'centers', centerId);
      const studentRef = doc(firestore, 'centers', centerId, 'students', studentId);

      batch.update(memberRef, { className: finalClass, updatedAt: serverTimestamp() });
      batch.update(userCenterRef, { className: finalClass, updatedAt: serverTimestamp() });
      batch.update(studentRef, { className: finalClass, updatedAt: serverTimestamp() });

      await batch.commit();
      toast({ title: "반 이동 완료" });
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
          <CardDescription className="font-bold">상세 정보 수정, 반 이동, 또는 계정 삭제를 수행할 수 있습니다.</CardDescription>
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
                      <div className="flex-1 sm:w-40">
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

                      <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => handleOpenEditModal(member)}
                        className="h-11 w-11 rounded-xl text-primary border-2 shadow-sm bg-white hover:bg-primary hover:text-white transition-all active:scale-95"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>

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

      {/* 계정 정보 수정 모달 */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col", isMobile ? "w-[95vw] h-[85vh] rounded-[2rem]" : "sm:max-w-lg max-h-[90vh]")}>
          <div className="bg-primary p-10 text-white relative shrink-0">
            <UserCog className="absolute top-0 right-0 p-8 h-32 w-32 opacity-10 rotate-12" />
            <DialogHeader>
              <DialogTitle className="text-3xl font-black tracking-tighter">계정 상세 관리</DialogTitle>
              <DialogDescription className="text-white/60 font-bold mt-1">학생의 주요 정보 및 비밀번호를 관리합니다.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar p-8 space-y-6">
            <div className="grid gap-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-primary/60 ml-1">이름</Label>
                <div className="relative">
                  <UserCog className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                  <Input value={editForm.displayName} onChange={e => setEditForm({...editForm, displayName: e.target.value})} className="h-12 pl-10 rounded-xl border-2 font-bold" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-primary/60 ml-1">비밀번호 재설정 (선택)</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                  <Input type="password" placeholder="새 비밀번호 (6자 이상)" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="h-12 pl-10 rounded-xl border-2 font-bold" />
                </div>
                <p className="text-[9px] font-bold text-muted-foreground ml-1">※ 입력 시에만 해당 비밀번호로 강제 변경됩니다.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-primary/60 ml-1">소속 학교</Label>
                  <div className="relative">
                    <School className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                    <Input value={editForm.schoolName} onChange={e => setEditForm({...editForm, schoolName: e.target.value})} className="h-12 pl-10 rounded-xl border-2 font-bold" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-primary/60 ml-1">학년</Label>
                  <Select value={editForm.grade} onValueChange={v => setEditForm({...editForm, grade: v})}>
                    <SelectTrigger className="h-12 rounded-xl border-2 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      <SelectItem value="1학년">1학년</SelectItem>
                      <SelectItem value="2학년">2학년</SelectItem>
                      <SelectItem value="3학년">3학년</SelectItem>
                      <SelectItem value="N수생">N수생</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-primary/60 ml-1 flex items-center gap-2">부모님 연동 코드 <ShieldCheck className="h-3 w-3" /></Label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                  <Input maxLength={6} value={editForm.parentLinkCode} onChange={e => setEditForm({...editForm, parentLinkCode: e.target.value})} className="h-12 pl-10 rounded-xl border-2 font-black tracking-widest text-lg" placeholder="6자리 숫자" />
                </div>
                <p className="text-[9px] font-bold text-muted-foreground ml-1">부모님 가입 시 자녀 연동을 위한 코드입니다.</p>
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-muted/20 border-t shrink-0">
            <Button onClick={handleUpdateStudent} disabled={!!isUpdating} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 gap-2">
              {isUpdating === selectedStudentForEdit?.id ? <Loader2 className="animate-spin h-5 w-5" /> : <Check className="h-5 w-5" />}
              관리자 권한으로 정보 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <footer className="pt-10 flex flex-col items-center gap-4 opacity-30">
        <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-[0.4em] text-primary">
          Administrator Control Panel
        </div>
        <p className="text-[9px] font-bold text-center leading-relaxed">
          관리자 모드에서는 학생의 인증 정보 및 연동 코드를 강제 제어할 수 있습니다.<br/>
          민감한 정보 수정을 시도할 때는 반드시 학생/학부모의 동의를 구하세요.
        </p>
      </footer>
    </div>
  );
}
