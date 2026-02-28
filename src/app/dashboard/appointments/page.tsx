
'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Loader2,
  XCircle,
  History,
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare
} from 'lucide-react';
import { useCollection, useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc,
  Timestamp 
} from 'firebase/firestore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CounselingLog } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function AppointmentsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, membershipsLoading } = useAppContext();
  const { toast } = useToast();

  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestData, setRequestData] = useState({
    date: '',
    time: '14:00',
    reason: '',
  });

  useEffect(() => {
    setRequestData(prev => ({ ...prev, date: format(new Date(), 'yyyy-MM-dd') }));
  }, []);

  const role = activeMembership?.role;
  const isStudent = role === 'student';
  const isStaff = role === 'teacher' || role === 'centerAdmin';

  // --- 상담 예약 쿼리 (학생은 본인 데이터만 필터링) ---
  const appointmentsQuery = useMemoFirebase(() => {
    if (!firestore || membershipsLoading || !activeMembership?.id || !user?.uid || !role) return null;
    const baseRef = collection(firestore, 'centers', activeMembership.id, 'counselingReservations');
    
    if (isStudent) {
      // 보안 규칙 리스트(List) 허용을 위해 필터링 필수
      return query(baseRef, where('studentId', '==', user.uid), orderBy('scheduledAt', 'desc'));
    }
    if (isStaff) {
      return query(baseRef, orderBy('scheduledAt', 'desc'));
    }
    
    return null;
  }, [firestore, membershipsLoading, activeMembership?.id, user?.uid, isStudent, isStaff, role]);

  const { data: appointments, isLoading: aptLoading } = useCollection<any>(appointmentsQuery);

  // --- 상담 일지 쿼리 (학생은 본인 데이터만 필터링) ---
  const notesQuery = useMemoFirebase(() => {
    if (!firestore || membershipsLoading || !activeMembership?.id || !user?.uid || !role) return null;
    const baseRef = collection(firestore, 'centers', activeMembership.id, 'counselingLogs');
    
    if (isStudent) {
      // 보안 규칙 리스트(List) 허용을 위해 필터링 필수
      return query(
        baseRef, 
        where('studentId', '==', user.uid), 
        orderBy('createdAt', 'desc')
      );
    }
    if (isStaff) {
      return query(baseRef, orderBy('createdAt', 'desc'));
    }

    return null;
  }, [firestore, membershipsLoading, activeMembership?.id, user?.uid, isStudent, isStaff, role]);

  const { data: notes, isLoading: notesLoading } = useCollection<CounselingLog>(notesQuery);

  const handleRequestSubmit = () => {
    if (!firestore || !user || !activeMembership || !requestData.reason.trim() || !requestData.date) {
      toast({ variant: "destructive", title: "모든 정보를 입력해 주세요." });
      return;
    }
    
    setIsSubmitting(true);
    const scheduledAt = new Date(`${requestData.date}T${requestData.time}`);
    const resCollectionRef = collection(firestore, 'centers', activeMembership.id, 'counselingReservations');
    
    const docData = {
      centerId: activeMembership.id,
      studentId: user.uid,
      studentName: user.displayName || '학생',
      scheduledAt: Timestamp.fromDate(scheduledAt),
      status: 'requested',
      studentNote: requestData.reason,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    addDoc(resCollectionRef, docData)
      .then(() => {
        toast({ title: "상담 신청이 완료되었습니다." });
        setIsRequestOpen(false);
        setRequestData(prev => ({ ...prev, reason: '' }));
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: resCollectionRef.path,
          operation: 'create',
          requestResourceData: docData,
        }));
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const updateStatus = (reservationId: string, status: string) => {
    if (!firestore || !activeMembership) return;
    const resDocRef = doc(firestore, 'centers', activeMembership.id, 'counselingReservations', reservationId);
    
    updateDoc(resDocRef, { 
      status, 
      updatedAt: serverTimestamp() 
    }).catch(async (error) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: resDocRef.path,
        operation: 'update',
        requestResourceData: { status },
      }));
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'requested': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">신청됨</Badge>;
      case 'confirmed': return <Badge className="bg-blue-500 text-white border-none">확정됨</Badge>;
      case 'done': return <Badge className="bg-emerald-500 text-white border-none">완료</Badge>;
      case 'canceled': return <Badge variant="destructive">취소됨</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter">상담 및 피드백</h1>
          <p className="text-sm font-bold text-muted-foreground ml-1">선생님과 함께 학습 고민을 나누고 피드백을 받으세요.</p>
        </div>
        {isStudent && (
          <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-2xl h-14 px-8 gap-2 font-black shadow-xl interactive-button">
                <Plus className="h-5 w-5" /> 새 상담 신청
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] sm:max-w-md p-0 overflow-hidden border-none shadow-2xl">
              <div className="bg-primary p-8 text-white relative">
                <DialogHeader>
                  <DialogTitle className="text-3xl font-black tracking-tighter">상담 예약 신청</DialogTitle>
                  <DialogDescription className="text-white/70 font-bold text-base mt-1">원하는 시간과 고민 내용을 적어주세요.</DialogDescription>
                </DialogHeader>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3 w-3" /> 희망 날짜</Label>
                    <Input type="date" value={requestData.date} onChange={(e) => setRequestData({...requestData, date: e.target.value})} className="rounded-xl h-12 border-2" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5"><Clock className="h-3 w-3" /> 희망 시간</Label>
                    <Input type="time" value={requestData.time} onChange={(e) => setRequestData({...requestData, time: e.target.value})} className="rounded-xl h-12 border-2" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> 어떤 부분 때문에 상담을 요청하시나요?</Label>
                  <Textarea 
                    placeholder="예: 학습 계획 수립이 어려워요, 특정 과목 성적이 안 나와요 등" 
                    value={requestData.reason} 
                    onChange={(e) => setRequestData({...requestData, reason: e.target.value})}
                    className="rounded-2xl min-h-[120px] border-2 resize-none"
                  />
                </div>
              </div>
              <DialogFooter className="p-8 bg-muted/10 border-t">
                <Button onClick={handleRequestSubmit} disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black text-lg shadow-lg">
                  {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : '상담 신청하기'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <Card className="md:col-span-2 border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white ring-1 ring-border/50">
          <CardHeader className="bg-muted/30 border-b p-6 sm:p-8">
            <CardTitle className="flex items-center gap-3 text-2xl font-black tracking-tight">
              <History className="h-6 w-6 text-primary" /> 나의 상담 예약 현황
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {aptLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
                <p className="font-bold text-muted-foreground">예약 정보를 불러오고 있습니다...</p>
              </div>
            ) : !appointments || appointments.length === 0 ? (
              <div className="py-32 text-center flex flex-col items-center gap-4 text-muted-foreground/40">
                <Calendar className="h-16 w-16 opacity-10" />
                <p className="font-black italic">예약된 상담 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/10 h-14">
                      <TableHead className="font-black text-center w-[180px]">일시</TableHead>
                      <TableHead className="font-black text-center">학생</TableHead>
                      <TableHead className="font-black">상담 요청 내용</TableHead>
                      <TableHead className="font-black text-center">상태</TableHead>
                      <TableHead className="text-right font-black pr-8">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((apt: any) => (
                      <TableRow key={apt.id} className="h-20 group hover:bg-muted/5 transition-colors">
                        <TableCell className="text-center font-bold text-primary">
                          {apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'M월 d일 p', { locale: ko }) : '-'}
                        </TableCell>
                        <TableCell className="text-center font-black">{apt.studentName || '학생'}</TableCell>
                        <TableCell>
                          <p className="text-sm font-medium line-clamp-2 text-muted-foreground group-hover:text-foreground transition-colors">
                            {apt.studentNote || apt.teacherNote || '-'}
                          </p>
                        </TableCell>
                        <TableCell className="text-center">{getStatusBadge(apt.status)}</TableCell>
                        <TableCell className="text-right pr-8">
                          {isStudent && apt.status === 'requested' && (
                            <Button variant="ghost" size="sm" className="text-destructive font-bold hover:bg-destructive/5 rounded-xl" onClick={() => updateStatus(apt.id, 'canceled')}>취소</Button>
                          )}
                          {isStaff && apt.status === 'requested' && (
                            <Button variant="outline" size="sm" className="font-black border-2 rounded-xl border-primary/20 hover:border-primary" onClick={() => updateStatus(apt.id, 'confirmed')}>확정</Button>
                          )}
                          {isStaff && apt.status === 'confirmed' && (
                            <Button variant="outline" size="sm" className="font-black border-2 rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50" onClick={() => updateStatus(apt.id, 'done')}>완료 처리</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-8">
          <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-border/50">
            <CardHeader className="p-6 pb-4">
              <CardTitle className="text-xl font-black flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" /> 나의 상담 일지
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-4">
              {notesLoading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div> : 
               !notes || notes.length === 0 ? (
                <div className="py-12 border-2 border-dashed rounded-3xl flex flex-col items-center gap-3 opacity-30">
                  <XCircle className="h-10 w-10 text-muted-foreground" />
                  <span className="text-xs font-black uppercase tracking-widest text-center">작성된 일지가 없습니다.</span>
                </div>
              ) : (
                notes.map(note => (
                  <div key={note.id} className="p-5 rounded-2xl bg-muted/20 border border-border/50 hover:bg-white hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <Badge variant="outline" className={cn(
                        "text-[9px] font-black uppercase px-2 py-0.5 border-none",
                        note.type === 'academic' ? "bg-blue-100 text-blue-700" : 
                        note.type === 'life' ? "bg-amber-100 text-amber-700" : "bg-purple-100 text-purple-700"
                      )}>
                        {note.type === 'academic' ? '학업' : note.type === 'life' ? '생활' : '진로'}
                      </Badge>
                      <span className="text-[10px] font-bold text-muted-foreground/60">{note.createdAt ? format(note.createdAt.toDate(), 'yy.MM.dd') : ''}</span>
                    </div>
                    <p className="text-sm font-bold leading-relaxed text-foreground/80 line-clamp-3 mb-3 group-hover:line-clamp-none transition-all">{note.content}</p>
                    {note.improvement && (
                      <div className="pt-3 border-t border-dashed border-primary/10">
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-primary mb-1 uppercase tracking-widest">
                          <CheckCircle2 className="h-3 w-3" /> 선생님 피드백
                        </div>
                        <p className="text-xs font-bold text-primary/70">{note.improvement}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg rounded-[2rem] bg-accent/5 overflow-hidden">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="p-2 bg-accent/10 rounded-xl">
                <AlertCircle className="h-5 w-5 text-accent" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-accent-foreground">상담 안내</h4>
                <p className="text-[11px] font-bold text-muted-foreground leading-relaxed">
                  본인의 상담 내역만 조회할 수 있습니다. 타인의 정보는 보호되며, 상담 신청은 선생님 승인 후 확정됩니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
