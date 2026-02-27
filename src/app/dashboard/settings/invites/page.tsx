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
import { PlusCircle, Loader2 } from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, doc, setDoc, serverTimestamp, query, where } from 'firebase/firestore';
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

export default function InviteCodesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCode, setNewCode] = useState({
    code: '',
    role: 'student' as InviteCode['intendedRole'],
    maxUses: 100,
    expiresInDays: 30,
  });

  const inviteCodesQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(collection(firestore, 'inviteCodes'), where('centerId', '==', activeMembership.id));
  }, [firestore, activeMembership]);

  const { data: inviteCodes, isLoading } = useCollection<InviteCode>(inviteCodesQuery);

  const getStatus = (invite: InviteCode) => {
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

    try {
        await setDoc(codeRef, {
            intendedRole: newCode.role,
            maxUses: Number(newCode.maxUses),
            usedCount: 0,
            expiresAt: expiresAt,
            createdByUserId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            centerId: activeMembership.id,
        });
        setIsDialogOpen(false);
        setNewCode({
          code: '',
          role: 'student',
          maxUses: 100,
          expiresInDays: 30,
        });
    } catch(e) {
        console.error("Failed to create invite code", e);
    } finally {
        setIsCreating(false);
    }
  }


  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>초대 코드</CardTitle>
            <CardDescription>
              신규 회원 등록을 위한 초대 코드를 관리합니다.
            </CardDescription>
          </div>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <PlusCircle className="h-4 w-4" />
              새 코드 생성
            </Button>
          </DialogTrigger>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>코드</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>사용 횟수</TableHead>
                  <TableHead>만료일</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inviteCodes?.map((invite) => {
                  const status = getStatus(invite);
                  return (
                    <TableRow key={invite.id}>
                      <TableCell className="font-mono">{invite.id}</TableCell>
                      <TableCell>{invite.intendedRole}</TableCell>
                      <TableCell>{`${invite.usedCount}/${invite.maxUses}`}</TableCell>
                      <TableCell>{format((invite.expiresAt as any).toDate(), 'yyyy-MM-dd')}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>
                          {status.text}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>새 초대 코드 생성</DialogTitle>
          <DialogDescription>
            초대 코드의 세부 정보를 입력하세요. 이 코드가 문서 ID가 됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="code" className="text-right">
              코드
            </Label>
            <Input id="code" value={newCode.code} onChange={(e) => setNewCode(c => ({...c, code: e.target.value}))} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">
              역할
            </Label>
            <Select value={newCode.role} onValueChange={(value) => setNewCode(c => ({...c, role: value as any}))}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="역할 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">학생</SelectItem>
                <SelectItem value="teacher">교사</SelectItem>
                <SelectItem value="centerAdmin">센터 관리자</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="maxUses" className="text-right">
              최대 사용
            </Label>
            <Input id="maxUses" type="number" value={newCode.maxUses} onChange={(e) => setNewCode(c => ({...c, maxUses: Number(e.target.value)}))} className="col-span-3" />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="expiresInDays" className="text-right">
              만료 (일)
            </Label>
            <Input id="expiresInDays" type="number" value={newCode.expiresInDays} onChange={(e) => setNewCode(c => ({...c, expiresInDays: Number(e.target.value)}))} className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleCreateCode} disabled={isCreating}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            생성
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}