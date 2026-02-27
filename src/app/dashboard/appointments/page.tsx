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
  History
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
import { Appointment } from '@/lib/types';
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

  // 상담 데이터 쿼리 설정 - 보안 규칙과 1:1 매칭되도록 필터 강화
  const appointmentsQuery = useMemoFirebase(() => {
    // 필수 정보가 모두 존재하고, 로딩이 끝났을 때만 쿼리 생성
    if (!firestore || membershipsLoading || !activeMembership?.id || !user?.uid || !activeMembership.role) {
      return null;
    }
    
    const baseRef = collection(firestore, 'centers', activeMembership.id, 'appointments');
    const role = activeMembership.role;
    const uid = user.uid;
    
    // 1. 학생: 본인 예약만 조회 ( studentId 필터 필수 - 규칙 allow list: if resource.data.studentId == request.auth.uid )
    if (role === 'student') {
      return query(
        baseRef, 
        where('studentId', '==', uid), 
        orderBy('startAt', 'desc')
      );
    } 
    
    // 2. 학부모: 연결된 자녀 데이터 조회 ( isParentOf 규칙 대응 )
    if (role === 'parent') {
      const studentIds = activeMembership.linkedStudentIds || [];
      if (studentIds.length === 0) return null;
      // Note: 'in' query supports up to 10 IDs.
      return query(
        baseRef, 
        where('studentId', 'in', studentIds), 
        orderBy('startAt', 'desc')
      );
    } 
    
    // 3. 교사: 본인에게 배정된 상담 조회 ( teacherId 필터 필수 )
    if (role === 'teacher') {
      return query(
        baseRef, 
        where('teacherId', '==', uid), 
        orderBy('startAt', 'desc')
      );
    } 
    
    // 4. 관리자: 센터 전체 조회 ( hasRole 규칙 대응 )
    if (role === 'centerAdmin') {
      return query(baseRef, orderBy('startAt', 'desc'));
    }
    
    return null;
  }, [firestore, membershipsLoading, activeMembership?.id, activeMembership?.role, user?.uid, activeMembership?.linkedStudentIds]);

  const { data: appointments, isLoading: isQueryLoading } = useCollection<Appointment>(appointmentsQuery);

  const isStudent = activeMembership?.role === 'student';
  const isTeacher = activeMembership?.role === 'teacher';
  const isAdmin = activeMembership?.role === 'centerAdmin';
  const isParent = activeMembership?.role === 'parent';

  const handleRequestSubmit = async () => {
    if (!firestore || !user || !activeMembership) return;
    
    setIsSubmitting(true);
    try {
      const startAt = new Date(`${requestData.date}T${requestData.time}`);
      const endAt = new Date(startAt.getTime() + 30 * 60000); 

      const data = {
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
      };

      await addDoc(collection(firestore, 'centers', activeMembership.id, 'appointments'), data);
      
      toast({ title: "상담 신청 완료", description: "선생님 확인 후 일정이 확정됩니다." });
      setIsRequestOpen(false);
      setRequestData({ date: format(new Date(), 'yyyy-MM-dd'), time: '14:00', note: '' });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "신청 실패", description: "오류가 발생했습니다." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (appointmentId: string, status: Appointment['status']) => {
    if (!firestore || !activeMembership) return;
    const docRef = doc(firestore, 'centers', activeMembership.id, 'appointments', appointmentId);
    await updateDoc(docRef, { status, updatedAt: serverTimestamp() });
    toast({ title: "상태 변경 완료", description: `상담 상태가 변경되었습니다.` });
  };

  const getStatusBadge = (status: Appointment['status']) => {
    switch (status) {
      case 'requested': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">신청됨</Badge>;
      case 'confirmed': return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">확정됨</Badge>;
      case 'completed': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">상담 완료</Badge>;
      case 'cancelled': return <Badge variant="destructive" className="bg-rose-50 text-rose-700 border-rose-200">취소됨</Badge>;
      case 'no_show': return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">미참석</Badge>;
      default: return <Badge variant="outline">기타</Badge>;
    }
  };

  const isLoading = membershipsLoading || isQueryLoading;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tighter">상담 관리</h1>
          <p className="text-muted-foreground text-sm font-bold">체계적인 피드백으로 학습의 방향을 잡으세요.</p>
        </div>
        
        {(isStudent || isParent) && (
          <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-2xl h-12 px-6 gap-2 font-black shadow-lg hover:scale-105 transition-all">
                <Plus className="h-5 w-5" />
                새 상담 신청하기
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-[2rem]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">상담 예약 신청</DialogTitle>
                <DialogDescription className="font-bold">희망하시는 상담 날짜와 시간을 선택해주세요.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="date" className="font-black text-xs uppercase tracking-widest text-primary/70">희망 날짜</Label>
                  <Input 
                    id="date" 
                    type="date" 
                    value={requestData.date} 
                    onChange={(e) => setRequestData({...requestData, date: e.target.value})}
                    className="rounded-xl border-2 h-12"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="time" className="font-black text-xs uppercase tracking-widest text-primary/70">희망 시간</Label>
                  <Input 
                    id="time" 
                    type="time" 
                    value={requestData.time} 
                    onChange={(e) => setRequestData({...requestData, time: e.target.value})}
                    className="rounded-xl border-2 h-12"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="note" className="font-black text-xs uppercase tracking-widest text-primary/70">상담 내용 (선택)</Label>
                  <Textarea 
                    id="note" 
                    placeholder="상담하고 싶은 내용을 간단히 적어주세요." 
                    value={requestData.note}
                    onChange={(e) => setRequestData({...requestData, note: e.target.value})}
                    className="rounded-xl border-2 min-h-[100px]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handleRequestSubmit} 
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl font-black"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "상담 신청하기"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 border-none shadow-xl rounded-[2.5rem] overflow-hidden">
          <CardHeader className="bg-muted/30 border-b pb-6">
            <CardTitle className="flex items-center gap-2 text-xl font-black">
              <History className="h-5 w-5 text-primary" />
              상담 내역
            </CardTitle>
            <CardDescription className="font-bold">신청하거나 진행된 상담 리스트입니다.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
            ) : !appointments || appointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
                <MessageCircle className="h-12 w-12 opacity-20" />
                <p className="font-bold">기록된 상담 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="font-black text-[11px] uppercase tracking-widest py-4">일시</TableHead>
                      <TableHead className="font-black text-[11px] uppercase tracking-widest py-4">참석자</TableHead>
                      <TableHead className="font-black text-[11px] uppercase tracking-widest py-4">상태</TableHead>
                      <TableHead className="font-black text-[11px] uppercase tracking-widest py-4 text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((apt) => {
                      const startDate = apt.startAt?.toDate();
                      return (
                        <TableRow key={apt.id} className="group hover:bg-muted/5 transition-colors">
                          <TableCell className="py-5">
                            <div className="flex flex-col">
                              <span className="font-bold text-sm">{startDate ? format(startDate, 'M월 d일 (eee)', { locale: ko }) : '-'}</span>
                              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {startDate ? format(startDate, 'p') : '-'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-5">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center">
                                <User className="h-4 w-4 text-primary/60" />
                              </div>
                              <span className="font-bold text-sm">{apt.studentName || '학생'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-5">
                            {getStatusBadge(apt.status)}
                          </TableCell>
                          <TableCell className="py-5 text-right">
                            {isStudent && apt.status === 'requested' && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-destructive hover:text-destructive hover:bg-destructive/5 font-bold text-xs"
                                onClick={() => updateStatus(apt.id, 'cancelled')}
                              >
                                취소
                              </Button>
                            )}
                            {(isTeacher || isAdmin) && apt.status === 'requested' && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="border-blue-200 text-blue-600 hover:bg-blue-50 font-bold text-xs"
                                onClick={() => updateStatus(apt.id, 'confirmed')}
                              >
                                승인
                              </Button>
                            )}
                            {(isTeacher || isAdmin) && apt.status === 'confirmed' && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-bold text-xs"
                                onClick={() => updateStatus(apt.id, 'completed')}
                              >
                                상담완료
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="border-none shadow-lg rounded-[2rem] bg-primary text-primary-foreground overflow-hidden relative">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <CalendarIcon className="h-20 w-20" />
            </div>
            <CardHeader className="relative z-10">
              <CardTitle className="text-lg font-black tracking-tight">상담 안내</CardTitle>
            </CardHeader>
            <CardContent className="relative z-10 space-y-4">
              <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 space-y-2">
                <p className="text-xs font-bold leading-relaxed">
                  • 모든 상담은 기본 30분간 진행됩니다.<br/>
                  • 일정이 확정되면 알림이 발송됩니다.<br/>
                  • 당일 취소는 선생님께 미리 말씀해주세요.
                </p>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-black/20 text-[11px] font-black uppercase tracking-widest">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>누적 상담 횟수: {appointments?.filter(a => a.status === 'completed').length || 0}회</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg rounded-[2rem] bg-white overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg font-black flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                최근 상담일지
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground font-bold leading-relaxed">
                상담이 완료된 후 선생님이 작성하신 상세 일지를 여기서 확인할 수 있습니다.
              </p>
              <div className="p-10 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-center gap-2 opacity-40">
                <XCircle className="h-8 w-8 text-muted-foreground" />
                <span className="text-[10px] font-black uppercase tracking-widest">일지 데이터 없음</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}