
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
import { collection, query, where, doc, serverTimestamp, setDoc, getDoc, writeBatch } from 'firebase/firestore';
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
  ShieldCheck,
  Check,
  Zap,
  Activity,
  Target,
  RefreshCw,
  CheckCircle2,
  Timer,
  Clock,
  ChevronRight,
  Building2,
  Save
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
  
  const [editForm, setEditForm] = useState({
    displayName: '',
    password: '',
    schoolName: '',
    grade: '',
    parentLinkCode: '',
    className: '',
    seasonLp: 0,
    stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 },
    todayStudyMinutes: 0
  });

  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;
  const isAdmin = activeMembership?.role === 'centerAdmin';
  const periodKey = format(new Date(), 'yyyy-MM');
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'), 
      where('role', '==', 'student')
    );
  }, [firestore, centerId, isAdmin]);
  
  const { data: studentMembers, isLoading: membersLoading } = useCollection<CenterMembership>(membersQuery, { enabled: isAdmin });

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
      .filter(m => 
        m.displayName?.toLowerCase().includes(search) || 
        m.id.toLowerCase().includes(search)
      )
      .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  }, [studentMembers, searchTerm]);

  const handleOpenEditModal = async (member: CenterMembership) => {
    if (!firestore || !centerId) return;
    
    const progressRef = doc(firestore, 'centers', centerId, 'growthProgress', member.id);
    const progressSnap = await getDoc(progressRef);
    const progress = progressSnap.data() as GrowthProgress;

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
      parentLinkCode: profile?.parentLinkCode || '',
      className: member.className || '',
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
    if (!functions || !centerId || !selectedStudentForEdit || !firestore) return;
    
    setIsUpdating(selectedStudentForEdit.id);
    try {
      const updateFn = httpsCallable(functions, 'updateStudentAccount', { timeout: 600000 });
      
      const authPayload: any = {
        studentId: selectedStudentForEdit.id,
        centerId,
        displayName: editForm.displayName.trim() || undefined,
        schoolName: editForm.schoolName.trim() || undefined,
        grade: editForm.grade || undefined,
        parentLinkCode: editForm.parentLinkCode.trim() || undefined
      };

      if (editForm.password.trim().length >= 6) {
        authPayload.password = editForm.password.trim();
      }

      await updateFn(authPayload);

      const batch = writeBatch(firestore);
      const studentId = selectedStudentForEdit.id;

      const memberRef = doc(firestore, 'centers', centerId, 'members', studentId);
      const studentRef = doc(firestore, 'centers', centerId, 'students', studentId);
      const userCenterRef = doc(firestore, 'userCenters', studentId, 'centers', centerId);
      
      const classData = { className: editForm.className, updatedAt: serverTimestamp() };
      batch.update(memberRef, classData);
      batch.update(studentRef, classData);
      batch.update(userCenterRef, classData);

      const progRef = doc(firestore, 'centers', centerId, 'growthProgress', studentId);
      batch.set(progRef, {
        seasonLp: editForm.seasonLp,
        stats: editForm.stats,
        updatedAt: serverTimestamp()
      }, { merge: true });

      const statRef = doc(firestore, 'centers', centerId, 'dailyStudentStats', todayKey, 'students', studentId);
      batch.set(statRef, { 
        totalStudyMinutes: editForm.todayStudyMinutes,
        updatedAt: serverTimestamp()
      }, { merge: true });

      const rankRef = doc(firestore, 'centers', centerId, 'leaderboards', `${periodKey}_lp`, 'entries', studentId);
      batch.set(rankRef, {
        studentId,
        displayNameSnapshot: editForm.displayName,
        classNameSnapshot: editForm.className || null,
        value: editForm.seasonLp,
        updatedAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      toast({ title: "정보 수정 완료" });
      setIsEditModalOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "수정 실패", description: e.message });
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
        toast({ title: "삭제 완료", description: `${name} 학생의 모든 데이터가 정리되었습니다.` });
      } else {
        throw new Error(result.data?.message || "처리 실패");
      }
    } catch (e: any) {
      console.error("[Delete Error]", e);
      toast({ 
        variant: "destructive", 
        title: "삭제 실패 (서버 내부 오류)", 
        description: "데이터가 너무 많아 백그라운드에서 작업이 계속 진행 중일 수 있습니다."
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleMoveClass = async (studentId: string, newClassName: string) => {
    if (!firestore || !centerId) return;
    setIsUpdating(studentId);
    try {
      const finalClass = newClassName === 'none' ? '' : newClassName;
      const batch = writeBatch(firestore);
      const updateData = { className: finalClass, updatedAt: serverTimestamp() };
      batch.set(doc(firestore, 'centers', centerId, 'members', studentId), updateData, { merge: true });
      batch.set(doc(firestore, 'userCenters', studentId, 'centers', centerId), updateData, { merge: true });
      batch.set(doc(firestore, 'centers', centerId, 'students', studentId), updateData, { merge: true });
      await batch.commit();
      toast({ title: "반 이동 완료" });
    } catch (e) {
      toast({ variant: "destructive", title: "이동 실패" });
    } finally {
      setIsUpdating(null);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className={cn("flex flex-col gap-6 max-w-5xl mx-auto pb-24 px-4")}>
      <header className="flex flex-col gap-1">
        <h1 className={cn("font-black tracking-tighter flex items-center gap-2 text-primary text-4xl")}>
          <UserCog className="h-8 w-8" /> 학생 계정 관리 마스터
        </h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] ml-1">Lifecycle & Data Control</p>
      </header>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="학생 이름 또는 UID 검색..." 
          className="rounded-2xl border-2 pl-12 h-16 text-lg focus-visible:ring-primary/10 shadow-sm transition-all bg-white"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-black/[0.03]">
        <CardHeader className="bg-muted/5 border-b p-8">
          <CardTitle className="text-xl font-black flex items-center gap-2">
            <Users className="h-5 w-5 opacity-40" /> 관리 대상 학생 리스트
          </CardTitle>
          <CardDescription className="font-bold">계정 정보, LP, 스킬 지표 및 공부 시간을 직접 보정하거나 영구 삭제합니다.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {membersLoading ? (
            <div className="py-40 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 italic">Syncing Master Database...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-32 text-center opacity-20 italic font-black text-sm">
              <UserX className="h-16 w-16 mx-auto mb-4" /> 검색 결과가 없습니다.
            </div>
          ) : (
            <div className="divide-y divide-muted/10">
              {filteredStudents.map((member) => {
                const profile = studentsProfiles?.find(p => p.id === member.id);
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
                            member.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                          )}>{member.status === 'active' ? '재원' : '퇴원'}</Badge>
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground truncate">{profile?.schoolName || '학교 정보 없음'} · {profile?.grade}</p>
                        <p className="text-[8px] font-mono text-muted-foreground/40 mt-1 uppercase truncate">UID: {member.id}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <Select value={member.className || 'none'} onValueChange={(val) => handleMoveClass(member.id, val)}>
                        <SelectTrigger className="rounded-xl border-2 h-11 font-black text-xs bg-white w-32 shadow-sm">
                          <div className="flex items-center gap-2"><LayoutGrid className="h-3 w-3 opacity-40" /><SelectValue placeholder="반 미지정" /></div>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="none" className="font-bold">반 미지정</SelectItem>
                          {availableClasses.map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}
                        </SelectContent>
                      </Select>

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
                            <AlertDialogTitle className="text-2xl font-black text-center tracking-tighter">영구 강제 삭제 (Recursive)</AlertDialogTitle>
                            <AlertDialogDescription className="text-center font-bold pt-2 leading-relaxed">
                              [{member.displayName}] 학생의 모든 데이터와 하위 기록을 뿌리까지 찾아내어 삭제합니다. 절대 복구할 수 없습니다.
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
        <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col sm:max-w-2xl max-h-[95vh]")}>
          <div className="bg-primary p-8 text-white relative shrink-0">
            <UserCog className="absolute top-0 right-0 p-8 h-24 w-24 opacity-10 rotate-12" />
            <DialogHeader>
              <DialogTitle className="text-3xl font-black tracking-tighter">학생 데이터 마스터 보정</DialogTitle>
              <DialogDescription className="text-white/60 font-bold mt-1">계정 정보, 성장 지표, 공부 시간을 직접 제어합니다.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar p-8 space-y-10">
            <section className="space-y-5">
              <h4 className="text-[10px] font-black uppercase text-primary/60 tracking-widest ml-1 flex items-center gap-2"><Users className="h-3.5 w-3.5" /> 계정 및 소속</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">이름</Label><Input value={editForm.displayName} onChange={e => setEditForm({...editForm, displayName: e.target.value})} className="h-11 rounded-xl border-2 font-bold" /></div>
                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">비밀번호 (변경 시에만)</Label><Input type="password" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="h-11 rounded-xl border-2 font-bold" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">학교</Label><Input value={editForm.schoolName} onChange={e => setEditForm({...editForm, schoolName: e.target.value})} className="h-11 rounded-xl border-2 font-bold" /></div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">학년</Label>
                  <Select value={editForm.grade} onValueChange={v => setEditForm({...editForm, grade: v})}><SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl">{['1학년', '2학년', '3학년', 'N수생'].map(g => <SelectItem key={g} value={g} className="font-bold">{g}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">소속 반</Label>
                  <Select value={editForm.className || 'none'} onValueChange={v => setEditForm({...editForm, className: v === 'none' ? '' : v})}><SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="none" className="font-bold">미배정</SelectItem>{availableClasses.map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h4 className="text-[10px] font-black uppercase text-emerald-600 tracking-widest ml-1 flex items-center gap-2"><Zap className="h-3.5 w-3.5" /> 성장 지표 보정 (LP & Stats)</h4>
              <Card className="rounded-[1.5rem] border-2 border-emerald-100 bg-white p-6 space-y-6 shadow-sm">
                <div className="space-y-3">
                  <div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase text-primary/60">Season Points (LP)</Label><Badge className="bg-emerald-500 text-white font-black">{editForm.seasonLp.toLocaleString()} LP</Badge></div>
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
              <h4 className="text-[10px] font-black uppercase text-blue-600 tracking-widest ml-1 flex items-center gap-2"><Timer className="h-3.5 w-3.5" /> 오늘 공부 시간 강제 설정</h4>
              <div className="flex items-center gap-4 p-5 rounded-2xl bg-blue-50/50 border-2 border-blue-100 shadow-sm">
                <div className="bg-white p-3 rounded-xl shadow-md"><Clock className="h-5 w-5 text-blue-600" /></div>
                <div className="flex-1 grid gap-1">
                  <Label className="text-[10px] font-black text-blue-900/60 uppercase">Manual Minutes Override</Label>
                  <div className="flex items-center gap-2"><Input type="number" value={editForm.todayStudyMinutes} onChange={e => setEditForm({...editForm, todayStudyMinutes: Number(e.target.value)})} className="h-10 rounded-xl border-blue-200 font-black text-xl text-blue-600 text-center" /><span className="text-sm font-black text-blue-900/40">min</span></div>
                </div>
                <div className="text-right leading-none"><span className="text-[10px] font-bold text-blue-900/40 block mb-1">Total</span><span className="text-lg font-black text-blue-900/80">{Math.floor(editForm.todayStudyMinutes/60)}h {editForm.todayStudyMinutes%60}m</span></div>
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
