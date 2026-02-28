'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  MessageSquare, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  History, 
  Plus, 
  Loader2,
  FileText,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { CounselingReservation, CounselingLog } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function AppointmentsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [aptDate, setAptDate] = useState('');
  const [aptTime, setAptTime] = useState('14:00');
  const [studentNote, setStudentNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setAptDate(format(new Date(), 'yyyy-MM-dd'));
  }, []);

  const centerId = activeMembership?.id;
  const isStudent = activeMembership?.role === 'student';
  const roleConfirmed = !!activeMembership?.role;

  // 1. 상담 예약 쿼리 (인덱스 문제를 피하기 위해 orderBy 제거)
  const reservationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !user || !roleConfirmed) return null;
    const baseRef = collection(firestore, 'centers', centerId, 'counselingReservations');
    
    if (isStudent) {
      return query(baseRef, where('studentId', '==', user.uid));
    }
    return query(baseRef);
  }, [firestore, centerId, roleConfirmed, isStudent, user?.uid]);

  const { data: rawReservations, isLoading: resLoading } = useCollection<CounselingReservation>(reservationsQuery);

  // 2. 상담 일지 쿼리 (인덱스 문제를 피하기 위해 orderBy 제거)
  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !user || !roleConfirmed) return null;
    const baseRef = collection(firestore, 'centers', centerId, 'counselingLogs');
    
    if (isStudent) {
      return query(baseRef, where('studentId', '==', user.uid));
    }
    return query(baseRef);
  }, [firestore, centerId, roleConfirmed, isStudent, user?.uid]);

  const { data: rawLogs, isLoading: logsLoading } = useCollection<CounselingLog>(logsQuery);

  // 클라이언트 측 정렬
  const reservations = useMemo(() => {
    if (!rawReservations) return [];
    return [...rawReservations].sort((a, b) => b.scheduledAt.toMillis() - a.scheduledAt.toMillis());
  }, [rawReservations]);

  const logs = useMemo(() => {
    if (!rawLogs) return [];
    return [...rawLogs].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  }, [rawLogs]);

  const handleRequestAppointment = async () => {
    if (!firestore || !centerId || !user) return;
    if (!aptDate) {
      toast({ variant: "destructive", title: "날짜를 선택해 주세요." });
      return;
    }

    setIsSubmitting(true);
    try {
      const scheduledAt = new Date(`${aptDate}T${aptTime}`);
      await addDoc(collection(firestore, 'centers', centerId, 'counselingReservations'), {
        studentId: user.uid,
        studentName: user.displayName || '학생',
        centerId: centerId,
        scheduledAt: Timestamp.fromDate(scheduledAt),
        status: 'requested',
        studentNote: studentNote.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast({ title: "상담 신청이 완료되었습니다." });
      setIsRequestModalOpen(false);
      setStudentNote('');
    } catch (e: any) {
      toast({ variant: "destructive", title: "신청 실패", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'requested': return <Badge variant="secondary" className="bg-amber-100 text-amber-700">승인 대기</Badge>;
      case 'confirmed': return <Badge className="bg-emerald-500">예약 확정</Badge>;
      case 'done': return <Badge variant="outline" className="opacity-50">상담 완료</Badge>;
      case 'canceled': return <Badge variant="destructive">취소됨</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter text-primary">상담 및 피드백</h1>
          <p className="text-sm font-bold text-muted-foreground ml-1">오류 없이 본인만의 상담 현황을 조회할 수 있습니다.</p>
        </div>
        {isStudent && (
          <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="rounded-2xl font-black gap-2 h-14 px-8 shadow-xl bg-primary text-white interactive-button">
                <Plus className="h-5 w-5" /> 새 상담 신청
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md">
              <div className="bg-primary p-8 text-white relative">
                <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                  <MessageSquare className="h-24 w-24" />
                </div>
                <DialogHeader className="relative z-10">
                  <DialogTitle className="text-3xl font-black tracking-tighter">상담 신청</DialogTitle>
                  <DialogDescription className="text-white/70 font-bold">희망하시는 상담 일시를 선택해 주세요.</DialogDescription>
                </DialogHeader>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground">희망 날짜</label>
                    <Input type="date" value={aptDate} onChange={(e) => setAptDate(e.target.value)} className="rounded-xl h-12" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground">희망 시간</label>
                    <Input type="time" value={aptTime} onChange={(e) => setAptTime(e.target.value)} className="rounded-xl h-12" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-muted-foreground">상담 요청 내용 (선택)</label>
                  <Textarea 
                    placeholder="고민이나 질문하고 싶은 내용을 입력해 주세요." 
                    value={studentNote}
                    onChange={(e) => setStudentNote(e.target.value)}
                    className="rounded-xl min-h-[100px] resize-none"
                  />
                </div>
              </div>
              <DialogFooter className="p-6 bg-muted/20">
                <Button onClick={handleRequestAppointment} disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black text-lg">
                  {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : '신청하기'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="reservations" className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-full h-16 p-1.5 bg-muted/30 border max-w-md mx-auto mb-10 shadow-inner">
          <TabsTrigger value="reservations" className="rounded-full font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-lg">
            <Calendar className="h-4 w-4" /> 상담 예약
          </TabsTrigger>
          <TabsTrigger value="logs" className="rounded-full font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-lg">
            <FileText className="h-4 w-4" /> 상담 일지
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reservations">
          <Card className="rounded-[2rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
            <CardHeader className="bg-muted/30 border-b p-6 sm:p-8">
              <CardTitle className="text-2xl font-black text-primary flex items-center gap-3">
                <History className="h-6 w-6" /> 상담 신청 내역
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {resLoading ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" /></div>
              ) : reservations.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground/40 font-black italic flex flex-col items-center gap-4">
                  <Calendar className="h-12 w-12" />
                  예약 내역이 없습니다.
                </div>
              ) : (
                <div className="divide-y">
                  {reservations.map((res) => (
                    <div key={res.id} className="p-6 sm:p-8 flex items-center justify-between group hover:bg-muted/5 transition-colors">
                      <div className="flex items-center gap-6">
                        <div className="h-14 w-14 rounded-2xl bg-primary/5 border-2 border-primary/10 flex flex-col items-center justify-center">
                          <span className="text-[10px] font-black text-primary/60 uppercase">{format(res.scheduledAt.toDate(), 'MMM')}</span>
                          <span className="text-xl font-black text-primary">{format(res.scheduledAt.toDate(), 'd')}</span>
                        </div>
                        <div className="grid gap-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-black">{format(res.scheduledAt.toDate(), 'p')} 상담</h3>
                            {getStatusBadge(res.status)}
                          </div>
                          <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                            <User className="h-3 w-3" /> {isStudent ? (res.teacherName || '담당 교사 배정 중') : `${res.studentName} 학생`}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 opacity-20 group-hover:opacity-100 transition-all" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="rounded-[2rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
            <CardHeader className="bg-muted/30 border-b p-6 sm:p-8">
              <CardTitle className="text-2xl font-black text-emerald-600 flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6" /> 상담 피드백 및 결과
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {logsLoading ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" /></div>
              ) : logs.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground/40 font-black italic flex flex-col items-center gap-4">
                  <FileText className="h-12 w-12" />
                  아직 기록된 상담 일지가 없습니다.
                </div>
              ) : (
                <div className="divide-y">
                  {logs.map((log) => (
                    <div key={log.id} className="p-8 space-y-4 hover:bg-muted/5 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="rounded-lg font-black uppercase text-[10px]">
                            {log.type === 'academic' ? '성적/학업' : log.type === 'life' ? '생활 습관' : '진로/진학'}
                          </Badge>
                          <span className="text-xs font-bold text-muted-foreground">{format(log.createdAt.toDate(), 'yyyy년 M월 d일')}</span>
                        </div>
                        <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Counseling Done</span>
                      </div>
                      <div className="space-y-3">
                        <p className="text-base font-bold leading-relaxed text-foreground/80 whitespace-pre-wrap">{log.content}</p>
                        {log.improvement && (
                          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-3">
                            <AlertCircle className="h-4 w-4 text-emerald-600 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-black text-emerald-700 uppercase">개선 권고 사항</p>
                              <p className="text-sm font-bold text-emerald-900">{log.improvement}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}