'use client';
import { useState } from 'react';
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
import { PlusCircle, Loader2, RefreshCw, LayoutGrid } from 'lucide-react';
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

export default function InviteCodesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCode, setNewCode] = useState({
    code: '',
    role: 'student' as InviteCode['intendedRole'],
    className: '', // 반 이름 추가
    maxUses: 100,
    expiresInDays: 30,
  });

  const inviteCodesQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(collection(firestore, 'inviteCodes'), where('centerId', '==', activeMembership.id));
  }, [firestore, activeMembership]);

  const { data: inviteCodes, isLoading } = useCollection<InviteCode>(inviteCodesQuery);

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

    const data = {
      intendedRole: newCode.role,
      targetClassName: newCode.className.trim() || undefined,
      maxUses: Number(newCode.maxUses),
      usedCount: 0,
      expiresAt: expiresAt,
      isActive: true,
      createdByUserId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      centerId: activeMembership.id,
    };

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
      <Card className="rounded-[2rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
        <CardHeader className="flex flex-row items-center justify-between p-8 bg-muted/5 border-b">
          <div>
            <CardTitle className="text-2xl font-black tracking-tighter">초대 코드 관리</CardTitle>
            <CardDescription className="font-bold text-xs uppercase tracking-widest opacity-60">
              Center Access Codes & Invitations
            </CardDescription>
          </div>
          <DialogTrigger asChild>
            <Button size="lg" className="rounded-2xl font-black gap-2 shadow-lg">
              <PlusCircle className="h-5 w-5" />
              새 코드 생성
            </Button>
          </DialogTrigger>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Loading Codes...</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow className="hover:bg-transparent border-none h-14">
                  <TableHead className="font-black text-[10px] uppercase pl-8">CODE</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">ROLE / CLASS</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">USAGE</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">EXPIRES</TableHead>
                  <TableHead className="font-black text-[10px] uppercase">STATUS</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-right pr-8">ACTIVE</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inviteCodes?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-20">
                        <RefreshCw className="h-12 w-12" />
                        <p className="font-black italic">생성된 초대 코드가 없습니다.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  inviteCodes?.map((invite) => {
                    const status = getStatus(invite);
                    return (
                      <TableRow key={invite.id} className="hover:bg-muted/5 transition-colors h-24 group">
                        <TableCell className="pl-8">
                          <code className="bg-primary/5 px-3 py-1.5 rounded-lg text-primary font-black tracking-widest text-sm border border-primary/10">
                            {invite.id}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1.5">
                            <Badge variant="outline" className="w-fit font-black text-[10px] rounded-md border-primary/20 text-primary/60 uppercase">
                              {invite.intendedRole}
                            </Badge>
                            {invite.targetClassName && (
                              <div className="flex items-center gap-1.5 text-emerald-600">
                                <LayoutGrid className="h-3 w-3" />
                                <span className="text-[11px] font-black">{invite.targetClassName} 배정</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-black text-sm">{invite.usedCount} / {invite.maxUses}</span>
                            <div className="w-16 h-1 bg-muted rounded-full mt-1 overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${(invite.usedCount / invite.maxUses) * 100}%` }} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-muted-foreground">
                          {invite.expiresAt ? format((invite.expiresAt as any).toDate(), 'yyyy-MM-dd') : '무기한'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="font-black text-[10px] shadow-sm border-none">
                            {status.text}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          <Switch 
                            checked={invite.isActive !== false} 
                            onCheckedChange={() => handleToggleActive(invite)}
                            className="data-[state=checked]:bg-primary ml-auto"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <DialogContent className="sm:max-w-[425px] rounded-[2.5rem] border-none shadow-2xl p-8">
        <DialogHeader>
          <DialogTitle className="text-3xl font-black tracking-tighter">새 초대 코드 생성</DialogTitle>
          <DialogDescription className="font-bold text-sm text-muted-foreground pt-2">
            코드와 함께 배정될 반을 설정할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-6">
          <div className="grid gap-2">
            <Label htmlFor="code" className="text-[10px] font-black uppercase tracking-widest ml-1">초대 코드 이름</Label>
            <Input id="code" value={newCode.code} onChange={(e) => setNewCode(c => ({...c, code: e.target.value}))} className="h-12 rounded-xl border-2 font-black tracking-widest" placeholder="예: DONGBAEK2025" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="role" className="text-[10px] font-black uppercase tracking-widest ml-1">배정 역할</Label>
              <Select value={newCode.role} onValueChange={(value) => setNewCode(c => ({...c, role: value as any}))}>
                <SelectTrigger className="h-12 rounded-xl border-2 font-bold">
                  <SelectValue placeholder="역할 선택" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="student">학생</SelectItem>
                  <SelectItem value="teacher">교사</SelectItem>
                  <SelectItem value="centerAdmin">관리자</SelectItem>
                  <SelectItem value="parent">학부모</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="className" className="text-[10px] font-black uppercase tracking-widest ml-1">배정될 반 (선택)</Label>
              <Input id="className" value={newCode.className} onChange={(e) => setNewCode(c => ({...c, className: e.target.value}))} className="h-12 rounded-xl border-2 font-black" placeholder="예: 의대반" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="maxUses" className="text-[10px] font-black uppercase tracking-widest ml-1">최대 사용 횟수</Label>
              <Input id="maxUses" type="number" value={newCode.maxUses} onChange={(e) => setNewCode(c => ({...c, maxUses: Number(e.target.value)}))} className="h-12 rounded-xl border-2 font-bold" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expiresInDays" className="text-[10px] font-black uppercase tracking-widest ml-1">만료일 (일 단위)</Label>
              <Input id="expiresInDays" type="number" value={newCode.expiresInDays} onChange={(e) => setNewCode(c => ({...c, expiresInDays: Number(e.target.value)}))} className="h-12 rounded-xl border-2 font-bold" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleCreateCode} disabled={isCreating} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">
            {isCreating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : '초대 코드 생성 확정'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
