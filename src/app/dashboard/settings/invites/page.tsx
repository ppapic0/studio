'use client';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Loader2, RefreshCw, LayoutGrid, Eye, EyeOff, Filter } from 'lucide-react';
import { useCollection, useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, doc, setDoc, serverTimestamp, query, where, updateDoc } from 'firebase/firestore';
import { InviteCode } from '@/lib/types';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function InviteCodesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const isMobile = viewMode === 'mobile';
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showInactive, setShowInactive] = useState(false); // 비활성 코드 노출 여부
  
  const [newCode, setNewCode] = useState({
    code: '',
    role: 'student' as InviteCode['intendedRole'],
    className: '',
    maxUses: 100,
    expiresInDays: 30,
  });

  const inviteCodesQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(collection(firestore, 'inviteCodes'), where('centerId', '==', activeMembership.id));
  }, [firestore, activeMembership]);

  const { data: rawInviteCodes, isLoading } = useCollection<InviteCode>(inviteCodesQuery);

  // 필터링된 코드 목록
  const inviteCodes = useMemo(() => {
    if (!rawInviteCodes) return [];
    if (showInactive) return rawInviteCodes;
    // isActive가 명시적으로 false가 아닌 것들만 노출
    return rawInviteCodes.filter(code => code.isActive !== false);
  }, [rawInviteCodes, showInactive]);

  const hiddenCount = useMemo(() => {
    if (!rawInviteCodes) return 0;
    return rawInviteCodes.filter(code => code.isActive === false).length;
  }, [rawInviteCodes]);

  const getStatus = (invite: InviteCode) => {
    if (invite.isActive === false) {
      return { text: '비활성', variant: 'outline' as const };
    }
    if (invite.expiresAt && (invite.expiresAt as any).toDate() < new Date()) {
      return { text: '만료됨', variant: 'destructive' as const };
    }
    if (invite.usedCount >= invite.maxUses) {
      return { text: '소진됨', variant: 'secondary' as const };
    }
    return { text: '활성', variant: 'default' as const };
  };

  const handleCreateCode = async () => {
    if (!firestore || !user || !activeMembership || !newCode.code.trim()) return;
    setIsCreating(true);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + newCode.expiresInDays);

    const codeId = newCode.code.trim();
    const codeRef = doc(firestore, 'inviteCodes', codeId);

    // 학생이 아닐 경우 반 정보를 무시합니다.
    const finalClassName = newCode.role === 'student' ? newCode.className.trim() : '';

    const data: any = {
      intendedRole: newCode.role,
      maxUses: Number(newCode.maxUses),
      usedCount: 0,
      expiresAt: expiresAt,
      isActive: true,
      createdByUserId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      centerId: activeMembership.id,
    };

    // undefined 에러 방지를 위해 값이 있을 때만 필드 추가
    if (finalClassName) {
      data.targetClassName = finalClassName;
    }

    setDoc(codeRef, data, { merge: true })
      .then(() => {
        toast({ title: "초대 코드 생성 완료" });
        setIsDialogOpen(false);
        setNewCode({
          code: '',
          role: 'student',
          className: '',
          maxUses: 100,
          expiresInDays: 30,
        });
      })
      .catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: codeRef.path,
          operation: 'write',
          requestResourceData: data,
        }));
      })
      .finally(() => {
        setIsCreating(false);
      });
  };

  const handleToggleActive = (invite: InviteCode) => {
    if (!firestore) return;
    const nextState = invite.isActive === false ? true : false;
    const codeRef = doc(firestore, 'inviteCodes', invite.id);

    updateDoc(codeRef, { 
      isActive: nextState,
      updatedAt: serverTimestamp() 
    }).catch(async (serverError) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: codeRef.path,
        operation: 'update',
        requestResourceData: { isActive: nextState },
      }));
    });
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-border/50">
        <CardHeader className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between p-8 sm:p-10 bg-muted/5 border-b gap-6")}>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-black tracking-tighter">초대 코드 관리</CardTitle>
            <CardDescription className="font-bold text-xs uppercase tracking-widest opacity-60">
              Center Access Codes & Invitations
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={() => setShowInactive(!showInactive)}
              className={cn(
                "rounded-2xl font-black gap-2 h-12 px-5 border-2 transition-all shadow-sm flex-1 sm:flex-none",
                showInactive ? "bg-primary text-white border-primary" : "bg-white hover:bg-muted/50"
              )}
            >
              {showInactive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {showInactive ? '전체 보기' : '활성 코드만'}
              {!showInactive && hiddenCount > 0 && (
                <Badge className="ml-1 bg-primary text-white border-none h-5 px-1.5 min-w-[20px] justify-center">{hiddenCount}</Badge>
              )}
            </Button>
            <DialogTrigger asChild>
              <Button size="lg" className="rounded-2xl font-black gap-2 shadow-xl h-12 px-6 flex-1 sm:flex-none">
                <PlusCircle className="h-5 w-5" />
                새 코드 생성
              </Button>
            </DialogTrigger>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-40 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 italic">Syncing Access Keys...</p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow className="hover:bg-transparent border-none h-16">
                    <TableHead className="font-black text-[10px] uppercase pl-10">CODE</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">ROLE / CLASS</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">USAGE</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">EXPIRES</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">STATUS</TableHead>
                    <TableHead className="font-black text-[10px] uppercase text-right pr-10">ACTIVE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inviteCodes?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-80 text-center">
                        <div className="flex flex-col items-center gap-6 opacity-20">
                          <div className="p-6 bg-muted rounded-full">
                            <Filter className="h-16 w-16" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-black text-xl tracking-tight">표시할 코드가 없습니다.</p>
                            <p className="text-xs font-bold uppercase">No matching invite codes found</p>
                          </div>
                          {hiddenCount > 0 && !showInactive && (
                            <Button variant="link" onClick={() => setShowInactive(true)} className="font-black text-primary underline">
                              숨겨진 비활성 코드 {hiddenCount}개 보기
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    inviteCodes?.map((invite) => {
                      const status = getStatus(invite);
                      const isCodeActive = invite.isActive !== false;
                      return (
                        <TableRow key={invite.id} className={cn(
                          "transition-all duration-300 h-28 group",
                          !isCodeActive ? "bg-muted/5 opacity-60" : "hover:bg-primary/5"
                        )}>
                          <TableCell className="pl-10">
                            <div className="flex flex-col gap-1">
                              <code className={cn(
                                "px-4 py-2 rounded-xl font-black tracking-widest text-base border w-fit shadow-inner",
                                isCodeActive ? "bg-primary/5 text-primary border-primary/10" : "bg-muted text-muted-foreground border-muted-foreground/10"
                              )}>
                                {invite.id}
                              </code>
                              <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest ml-1">Unique Key</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-2">
                              <Badge variant="outline" className="w-fit font-black text-[10px] rounded-lg border-primary/20 text-primary/60 uppercase px-2.5 py-0.5">
                                {invite.intendedRole}
                              </Badge>
                              {invite.targetClassName ? (
                                <div className="flex items-center gap-2 text-emerald-600">
                                  <LayoutGrid className="h-3.5 w-3.5" />
                                  <span className="text-xs font-black tracking-tight">{invite.targetClassName} 배정</span>
                                </div>
                              ) : (
                                <span className="text-[10px] font-bold text-muted-foreground/40 italic">반 미지정</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-baseline justify-between w-24">
                                <span className="font-black text-sm">{invite.usedCount}</span>
                                <span className="text-[10px] font-bold text-muted-foreground/40">/ {invite.maxUses}</span>
                              </div>
                              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden shadow-inner">
                                <div 
                                  className={cn("h-full transition-all duration-1000", isCodeActive ? "bg-primary" : "bg-muted-foreground/30")} 
                                  style={{ width: `${Math.min(100, (invite.usedCount / invite.maxUses) * 100)}%` }} 
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-bold text-muted-foreground/80">
                            {invite.expiresAt ? format((invite.expiresAt as any).toDate(), 'yyyy.MM.dd') : '무기한'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant} className="font-black text-[10px] shadow-sm border-none px-3 py-1">
                              {status.text}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right pr-10">
                            <Switch 
                              checked={invite.isActive !== false} 
                              onCheckedChange={() => handleToggleActive(invite)}
                              className="data-[state=checked]:bg-primary ml-auto shadow-sm"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <DialogContent className={cn("rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden transition-all duration-500", isMobile ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-[400px] rounded-[2rem]" : "sm:max-w-[450px]")}>
        <div className="bg-primary p-10 text-white relative">
          <PlusCircle className="absolute top-0 right-0 p-10 h-48 w-48 opacity-10 rotate-12" />
          <DialogHeader className="relative z-10">
            <DialogTitle className="text-3xl font-black tracking-tighter">새 초대 코드 생성</DialogTitle>
            <DialogDescription className="font-bold text-sm text-white/70 pt-2 leading-relaxed">
              코드와 함께 배정될 역할을 설정하여 <br/>효율적으로 인원을 관리하세요.
            </DialogDescription>
          </DialogHeader>
        </div>
        
        <div className="grid gap-6 p-10 bg-white">
          <div className="grid gap-2">
            <Label htmlFor="code" className="text-[10px] font-black uppercase tracking-widest ml-1 text-primary/60">초대 코드 이름</Label>
            <Input id="code" value={newCode.code} onChange={(e) => setNewCode(c => ({...c, code: e.target.value}))} className="h-14 rounded-2xl border-2 font-black tracking-widest text-lg shadow-inner" placeholder="예: DONGBAEK2025" />
          </div>
          
          <div className={cn("grid gap-4", newCode.role === 'student' ? "grid-cols-2" : "grid-cols-1")}>
            <div className="grid gap-2">
              <Label htmlFor="role" className="text-[10px] font-black uppercase tracking-widest ml-1 text-primary/60">배정 역할</Label>
              <Select value={newCode.role} onValueChange={(value) => setNewCode(c => ({...c, role: value as any}))}>
                <SelectTrigger className="h-12 rounded-xl border-2 font-bold shadow-sm">
                  <SelectValue placeholder="역할 선택" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="student" className="font-bold">학생</SelectItem>
                  <SelectItem value="teacher" className="font-bold">선생님</SelectItem>
                  <SelectItem value="centerAdmin" className="font-bold">관리자</SelectItem>
                  <SelectItem value="parent" className="font-bold">학부모</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {newCode.role === 'student' && (
              <div className="grid gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                <Label htmlFor="className" className="text-[10px] font-black uppercase tracking-widest ml-1 text-primary/60">배정 반 (선택)</Label>
                <Input id="className" value={newCode.className} onChange={(e) => setNewCode(c => ({...c, className: e.target.value}))} className="h-12 rounded-xl border-2 font-black shadow-sm" placeholder="예: 의대반" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="maxUses" className="text-[10px] font-black uppercase tracking-widest ml-1 text-primary/60">최대 사용 횟수</Label>
              <Input id="maxUses" type="number" value={newCode.maxUses} onChange={(e) => setNewCode(c => ({...c, maxUses: Number(e.target.value)}))} className="h-12 rounded-xl border-2 font-bold shadow-sm" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expiresInDays" className="text-[10px] font-black uppercase tracking-widest ml-1 text-primary/60">만료 (일 단위)</Label>
              <Input id="expiresInDays" type="number" value={newCode.expiresInDays} onChange={(e) => setNewCode(c => ({...c, expiresInDays: Number(e.target.value)}))} className="h-12 rounded-xl border-2 font-bold shadow-sm" />
            </div>
          </div>
        </div>
        
        <DialogFooter className="p-10 bg-muted/20 border-t">
          <Button type="submit" onClick={handleCreateCode} disabled={isCreating} className="w-full h-16 rounded-[1.5rem] font-black text-xl shadow-xl shadow-primary/20 active:scale-95 transition-all">
            {isCreating ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : '초대 코드 발급 완료'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
