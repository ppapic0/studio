'use client';

import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
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
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MessageCircle, 
  Plus, 
  User, 
  Loader2,
  CheckCircle2,
  XCircle,
  History,
  FileText
} from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
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
import { Appointment, CounselingNote } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function AppointmentsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, membershipsLoading } = useAppContext();
  const { toast } = useToast();

  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestData, setRequestData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '14:00',
    note: '',
  });

  const isStudent = activeMembership?.role === 'student';
  const isTeacher = activeMembership?.role === 'teacher';
  const isAdmin = activeMembership?.role === 'centerAdmin';
  const isParent = activeMembership?.role === 'parent';

  // --- 상담 예약 쿼리 ---
  const appointmentsQuery = useMemoFirebase(() => {
    if (!firestore || membershipsLoading || !activeMembership?.id || !user?.uid) return null;
    const baseRef = collection(firestore, 'centers', activeMembership.id, 'appointments');
    
    if (isStudent) return query(baseRef, where('studentId', '==', user.uid), orderBy('startAt', 'desc'));
    if (isParent) return query(baseRef, where('studentId', 'in', activeMembership.linkedStudentIds || []), orderBy('startAt', 'desc'));
    return query(baseRef, orderBy('startAt', 'desc'));
  }, [firestore, membershipsLoading, activeMembership, user?.uid]);

  const { data: appointments, isLoading: aptLoading } = useCollection<Appointment>(appointmentsQuery);

  // --- 상담 일지 쿼리 (보안 규칙 준수) ---
  const notesQuery = useMemoFirebase(() => {
    if (!firestore || membershipsLoading || !activeMembership?.id || !user?.uid) return null;
    const baseRef = collection(firestore, 'centers', activeMembership.id, 'counselingNotes');
    
    if (isStudent) {
      return query(
        baseRef, 
        where('studentId', '==', user.uid), 
        where('visibility', '==', 'student_and_parent'),
        orderBy('createdAt', 'desc')
      );
    }
    if (isParent) {
      return query(
        baseRef, 
        where('studentId', 'in', activeMembership.linkedStudentIds || []), 
        where('visibility', '==', 'student_and_parent'),
        orderBy('createdAt', 'desc')
      );
    }
    // 관리자/교사
    return query(baseRef, orderBy('createdAt', 'desc'));
  }, [firestore, membershipsLoading, activeMembership, user?.uid]);

  const { data: notes, isLoading: notesLoading } = useCollection<CounselingNote>(notesQuery);

  const handleRequestSubmit = async () => {
    if (!firestore || !user || !activeMembership) return;
    setIsSubmitting(true);
    try {
      const startAt = new Date(`${requestData.date}T${requestData.time}`);
      const endAt = new Date(startAt.getTime() + 30 * 60000); 
      await addDoc(collection(firestore, 'centers', activeMembership.id, 'appointments'), {
        centerId: activeMembership.id,
        studentId: isStudent ? user.uid : (activeMembership.linkedStudentIds?.[0] || ''),
        studentName: user.displayName || '학생',
        startAt: Timestamp.fromDate(startAt),
        endAt: Timestamp.fromDate(endAt),
        status: 'requested',
        createdByRole: activeMembership.role,
        teacherNote: requestData.note,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast({ title: "상담 신청 완료" });
      setIsRequestOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "신청 실패" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (appointmentId: string, status: Appointment['status']) => {
    if (!firestore || !activeMembership) return;
    await updateDoc(doc(firestore, 'centers', activeMembership.id, 'appointments', appointmentId), { 
      status, 
      updatedAt: serverTimestamp() 
    });
  };

  const getStatusBadge = (status: Appointment['status']) => {
    switch (status) {
      case 'requested': return <Badge variant="outline" className="bg-amber-50">신청됨</Badge>;
      case 'confirmed': return <Badge variant="secondary" className="bg-blue-50">확정됨</Badge>;
      case 'completed': return <Badge className="bg-emerald-50">완료</Badge>;
      case 'cancelled': return <Badge variant="destructive">취소됨</Badge>;
      default: return <Badge variant="outline">미참석</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-black tracking-tighter">상담 및 피드백</h1>
        {(isStudent || isParent) && (
          <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-2xl h-12 px-6 gap-2 font-black shadow-lg">
                <Plus className="h-5 w-5" /> 새 상담 신청
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2rem]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">상담 예약 신청</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid gap-2">
                  <Label>희망 날짜</Label>
                  <Input type="date" value={requestData.date} onChange={(e) => setRequestData({...requestData, date: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label>희망 시간</Label>
                  <Input type="time" value={requestData.time} onChange={(e) => setRequestData({...requestData, time: e.target.value})} />
                </div>
                <div className="grid gap-2">
                  <Label>상담 내용</Label>
                  <Textarea value={requestData.note} onChange={(e) => setRequestData({...requestData, note: e.target.value})} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleRequestSubmit} disabled={isSubmitting} className="w-full h-12 rounded-xl">신청하기</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* 상담 내역 테이블 */}
        <Card className="md:col-span-2 border-none shadow-xl rounded-[2.5rem] overflow-hidden">
          <CardHeader className="bg-muted/30 border-b pb-6">
            <CardTitle className="flex items-center gap-2 text-xl font-black">
              <History className="h-5 w-5 text-primary" /> 상담 예약 현황
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {aptLoading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div> : (
              <Table>
                <TableHeader><TableRow><TableHead>일시</TableHead><TableHead>학생</TableHead><TableHead>상태</TableHead><TableHead className="text-right">관리</TableHead></TableRow></TableHeader>
                <TableBody>
                  {appointments?.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell className="font-bold">
                        {apt.startAt ? format(apt.startAt.toDate(), 'M월 d일 p', { locale: ko }) : '-'}
                      </TableCell>
                      <TableCell className="font-bold">{apt.studentName}</TableCell>
                      <TableCell>{getStatusBadge(apt.status)}</TableCell>
                      <TableCell className="text-right">
                        {isStudent && apt.status === 'requested' && <Button variant="ghost" onClick={() => updateStatus(apt.id, 'cancelled')}>취소</Button>}
                        {(isTeacher || isAdmin) && apt.status === 'requested' && <Button variant="outline" onClick={() => updateStatus(apt.id, 'confirmed')}>확정</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 상담 일지 리스트 */}
        <div className="flex flex-col gap-6">
          <Card className="border-none shadow-lg rounded-[2rem] bg-white overflow-hidden">
            <CardHeader><CardTitle className="text-lg font-black flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> 최근 상담일지</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {notesLoading ? <Loader2 className="animate-spin mx-auto" /> : 
               !notes || notes.length === 0 ? (
                <div className="p-10 border-2 border-dashed rounded-3xl flex flex-col items-center gap-2 opacity-40">
                  <XCircle className="h-8 w-8" /><span className="text-[10px] font-black">일지 데이터 없음</span>
                </div>
              ) : (
                notes.map(note => (
                  <div key={note.id} className="p-4 rounded-2xl bg-muted/20 border border-border/50">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-primary">{note.studentName} 학생</span>
                      <span className="text-[9px] text-muted-foreground">{note.createdAt ? format(note.createdAt.toDate(), 'yy.MM.dd') : ''}</span>
                    </div>
                    <p className="text-xs font-medium line-clamp-3 leading-relaxed">{note.content}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}