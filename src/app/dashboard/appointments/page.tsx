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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  AlertCircle,
  Sparkles,
  CalendarPlus,
  ArrowRight,
  UserCheck,
  Check,
  X,
  FileEdit,
  GraduationCap,
  Filter
} from 'lucide-react';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { collection, query, where, addDoc, serverTimestamp, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { CounselingReservation, CounselingLog, CenterMembership } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function AppointmentsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();

  const isMobile = viewMode === 'mobile';
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedResForLog, setSelectedResForLog] = useState<CounselingReservation | null>(null);
  
  const [aptDate, setAptDate] = useState('');
  const [aptTime, setAptTime] = useState('14:00');
  const [studentNote, setStudentNote] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  
  const [logType, setLogType] = useState<'academic' | 'life' | 'career'>('academic');
  const [logContent, setLogContent] = useState('');
  const [logImprovement, setLogImprovement] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string>('all');

  useEffect(() => {
    setAptDate(format(new Date(), 'yyyy-MM-dd'));
  }, []);

  // 시즌 판별 로직
  const getSeasonName = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    if (month <= 2) return `${year - 1}년 겨울방학`;
    if (month <= 6) return `${year}년 1학기`;
    if (month <= 8) return `${year}년 여름방학`;
    if (month <= 12) return `${year}년 2학기`;
    return `${year}년 겨울방학`;
  };

  // 종속성 안정화
  const centerId = activeMembership?.id;
  const userRole = activeMembership?.role;
  const studentUid = user?.uid;
  const linkedStudentIds = useMemo(() => activeMembership?.linkedStudentIds || [], [activeMembership?.linkedStudentIds]);
  const linkedIdsKey = JSON.stringify(linkedStudentIds);

  const isStudent = userRole === 'student';
  const isParent = userRole === 'parent';
  const isStaff = userRole === 'teacher' || userRole === 'centerAdmin';
  const isAdmin = userRole === 'centerAdmin';

  // 상담 희망 선생님 목록
  const teachersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'),
      where('role', '==', 'teacher')
    );
  }, [firestore, centerId]);
  const { data: allStaff } = useCollection<CenterMembership>(teachersQuery);

  const filteredTeachers = useMemo(() => {
    if (!allStaff) return [];
    return allStaff.filter(t => t.displayName !== '동백센터관리자');
  }, [allStaff]);

  // 예약 내역 쿼리
  const reservationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentUid || !userRole) return null;
    const baseRef = collection(firestore, 'centers', centerId, 'counselingReservations');
    
    if (isStaff) return query(baseRef);
    if (isStudent) return query(baseRef, where('studentId', '==', studentUid));
    if (isParent && linkedStudentIds.length > 0) return query(baseRef, where('studentId', 'in', linkedStudentIds));
    
    return null;
  }, [firestore, centerId, studentUid, userRole, isStaff, isStudent, isParent, linkedIdsKey]);

  const { data: rawReservations, isLoading: resLoading } = useCollection<CounselingReservation>(reservationsQuery);

  // 상담 일지 쿼리
  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentUid || !userRole) return null;
    const baseRef = collection(firestore, 'centers', centerId, 'counselingLogs');
    
    if (isStaff) return query(baseRef);
    if (isStudent) return query(baseRef, where('studentId', '==', studentUid));
    if (isParent && linkedStudentIds.length > 0) return query(baseRef, where('studentId', 'in', linkedStudentIds));
    
    return null;
  }, [firestore, centerId, studentUid, userRole, isStaff, isStudent, isParent, linkedIdsKey]);

  const { data: rawLogs, isLoading: logsLoading } = useCollection<CounselingLog>(logsQuery);

  const reservations = useMemo(() => {
    if (!rawReservations) return [];
    return [...rawReservations].sort((a, b) => (b.scheduledAt?.toMillis() || 0) - (a.scheduledAt?.toMillis() || 0));
  }, [rawReservations]);

  const availableSeasons = useMemo(() => {
    if (!rawLogs) return [];
    const seasons = new Set<string>();
    rawLogs.forEach(log => {
      if (log.createdAt) {
        seasons.add(getSeasonName(log.createdAt.toDate()));
      }
    });
    return Array.from(seasons).sort().reverse();
  }, [rawLogs]);

  const filteredLogs = useMemo(() => {
    if (!rawLogs) return [];
    let list = [...rawLogs];
    
    if (selectedSeason !== 'all') {
      list = list.filter(log => log.createdAt && getSeasonName(log.createdAt.toDate()) === selectedSeason);
    }
    
    return list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  }, [rawLogs, selectedSeason]);

  const handleRequestAppointment = async () => {
    if (!firestore || !centerId || !user) return;
    if (!aptDate) {
      toast({ variant: "destructive", title: "날짜를 선택해 주세요." });
      return;
    }
    if (!selectedTeacherId) {
      toast({ variant: "destructive", title: "선생님을 선택해 주세요." });
      return;
    }

    setIsSubmitting(true);
    try {
      const scheduledAt = new Date(`${aptDate}T${aptTime}`);
      if (scheduledAt < new Date()) {
        toast({ variant: "destructive", title: "예약 불가", description: "현재 시간보다 이전으로는 신청할 수 없습니다." });
        setIsSubmitting(false);
        return;
      }

      const teacher = filteredTeachers?.find(t => t.id === selectedTeacherId);

      await addDoc(collection(firestore, 'centers', centerId, 'counselingReservations'), {
        studentId: user.uid,
        studentName: user.displayName || '학생',
        centerId: centerId,
        teacherId: selectedTeacherId,
        teacherName: teacher?.displayName || '선생님',
        scheduledAt: Timestamp.fromDate(scheduledAt),
        status: 'requested',
        studentNote: studentNote.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast({ title: "상담 신청 완료" });
      setIsRequestModalOpen(false);
      setStudentNote('');
      setSelectedTeacherId('');
    } catch (e: any) {
      toast({ variant: "destructive", title: "신청 실패", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (resId: string, status: CounselingReservation['status']) => {
    if (!firestore || !centerId) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'counselingReservations', resId), {
        status,
        updatedAt: serverTimestamp()
      });
      
      let message = "";
      if (status === 'confirmed') message = "상담 승인 완료";
      else if (status === 'canceled') message = isStudent ? "상담 신청 취소 완료" : "상담 거절 완료";
      
      toast({ title: message });
    } catch (e: any) {
      toast({ variant: "destructive", title: "처리 실패" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenLogModal = (res: CounselingReservation) => {
    setSelectedResForLog(res);
    setLogContent('');
    setLogImprovement('');
    setLogType('academic');
    setIsLogModalOpen(true);
  };

  const handleSaveCounselLog = async () => {
    if (!firestore || !centerId || !user || !selectedResForLog || !logContent.trim()) return;
    setIsSubmitting(true);
    try {
      const logData = {
        studentId: selectedResForLog.studentId,
        studentName: selectedResForLog.studentName || '학생',
        teacherId: user.uid,
        teacherName: user.displayName || '선생님',
        type: logType,
        content: logContent.trim(),
        improvement: logImprovement.trim(),
        createdAt: serverTimestamp(),
        reservationId: selectedResForLog.id
      };

      await addDoc(collection(firestore, 'centers', centerId, 'counselingLogs'), logData);
      await updateDoc(doc(firestore, 'centers', centerId, 'counselingReservations', selectedResForLog.id), {
        status: 'done',
        updatedAt: serverTimestamp()
      });

      toast({ title: "상담 일지 저장 및 완료 처리됨" });
      setIsLogModalOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "저장 실패" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'requested': return <Badge variant="secondary" className="bg-amber-50 text-amber-600 border-amber-100 font-black text-[10px]">승인 대기</Badge>;
      case 'confirmed': return <Badge className="bg-emerald-500 text-white border-none font-black text-[10px] shadow-sm">예약 확정</Badge>;
      case 'done': return <Badge variant="outline" className="opacity-40 font-black text-[10px]">상담 완료</Badge>;
      case 'canceled': return <Badge variant="destructive" className="font-black text-[10px]">취소됨</Badge>;
      default: return <Badge variant="outline" className="font-black text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className={cn("flex flex-col gap-6 max-w-4xl mx-auto pb-20", isMobile ? "px-1" : "px-4")}>
      <header className={cn("flex justify-between items-center", isMobile ? "flex-col gap-4 items-start" : "flex-row")}>
        <div className="space-y-1">
          <h1 className={cn("font-black tracking-tighter text-primary", isMobile ? "text-3xl" : "text-4xl")}>상담 및 피드백</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] ml-1">
            {isAdmin ? 'All Center Appointments' : 'Appointment & Feedback Center'}
          </p>
        </div>
        {isStudent && (
          <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className={cn("rounded-2xl font-black gap-2 shadow-xl bg-primary text-white interactive-button", isMobile ? "w-full h-14" : "h-14 px-8")}>
                <CalendarPlus className="h-5 w-5" /> 새 상담 신청
              </Button>
            </DialogTrigger>
            <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl transition-all duration-500", isMobile ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[380px]" : "sm:max-w-md")}>
              <div className="bg-primary p-10 text-white relative">
                <Sparkles className="absolute top-0 right-0 p-10 h-40 w-40 opacity-10 rotate-12" />
                <DialogHeader>
                  <DialogTitle className="text-3xl font-black tracking-tighter text-left">상담 신청</DialogTitle>
                  <DialogDescription className="text-white/70 font-bold mt-1 text-left">상담 일시와 선생님을 선택해 주세요.</DialogDescription>
                </DialogHeader>
              </div>
              <div className="p-8 space-y-6 bg-white max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">희망 날짜</label>
                    <Input type="date" value={aptDate} onChange={(e) => setAptDate(e.target.value)} className="rounded-xl h-12 border-2" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">희망 시간</label>
                    <Input type="time" value={aptTime} onChange={(e) => setAptTime(e.target.value)} className="rounded-xl h-12 border-2" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1 flex items-center gap-1.5">
                    <UserCheck className="h-3 w-3" /> 상담 희망 선생님
                  </label>
                  <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                    <SelectTrigger className="h-12 rounded-xl border-2 font-bold">
                      <SelectValue placeholder="선생님을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      {filteredTeachers.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="font-bold py-2.5">
                          {t.displayName} (선생님)
                        </SelectItem>
                      ))}
                      {!filteredTeachers.length && <p className="p-4 text-center text-xs font-bold opacity-40">선택 가능한 선생님이 없습니다.</p>}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">상담 요청 내용 (선택)</label>
                  <Textarea 
                    placeholder="고민이나 질문하고 싶은 내용을 자유롭게 적어주세요." 
                    value={studentNote}
                    onChange={(e) => setStudentNote(e.target.value)}
                    className="rounded-xl min-h-[100px] resize-none text-sm font-bold border-2"
                  />
                </div>
              </div>
              <DialogFooter className="p-8 bg-muted/30">
                <Button onClick={handleRequestAppointment} disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">
                  {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : '상담 신청 완료'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </header>

      <Tabs defaultValue="reservations" className="w-full">
        <TabsList className={cn("grid w-full grid-cols-2 rounded-full p-1 bg-muted/30 border shadow-inner mb-8", isMobile ? "h-14" : "h-16 max-w-sm mx-auto")}>
          <TabsTrigger value="reservations" className="rounded-full font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all">
            <Calendar className="h-4 w-4" /> <span className="text-xs sm:text-sm">상담 예약</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="rounded-full font-black gap-2 data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all">
            <FileText className="h-4 w-4" /> <span className="text-xs sm:text-sm">상담 일지</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reservations" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
            <CardHeader className="bg-muted/5 border-b p-6 sm:p-8">
              <CardTitle className="text-xl font-black text-primary flex items-center gap-3">
                <History className="h-6 w-6 opacity-40" /> 예약 및 신청 내역
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {resLoading ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
              ) : reservations.length === 0 ? (
                <div className="py-32 text-center text-muted-foreground/30 font-black italic flex flex-col items-center gap-4">
                  <Calendar className="h-16 w-16 opacity-10" />
                  예약 내역이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-muted/10">
                  {reservations.map((res) => (
                    <div key={res.id} className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between group hover:bg-muted/5 transition-colors gap-4">
                      <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                        <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-primary/5 border-2 border-primary/10 flex flex-col items-center justify-center shrink-0 group-hover:bg-primary transition-all duration-500 shadow-inner">
                          <span className="text-[8px] sm:text-[10px] font-black text-primary/60 uppercase group-hover:text-white/60 tracking-tighter">{res.scheduledAt ? format(res.scheduledAt.toDate(), 'MMM') : ''}</span>
                          <span className="text-xl sm:text-2xl font-black text-primary group-hover:text-white leading-none mt-0.5">{res.scheduledAt ? format(res.scheduledAt.toDate(), 'd') : ''}</span>
                        </div>
                        <div className="grid gap-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-black tracking-tight">{res.scheduledAt ? format(res.scheduledAt.toDate(), 'p') : ''} 상담</h3>
                            {getStatusBadge(res.status)}
                          </div>
                          <p className="text-[10px] sm:text-xs font-bold text-muted-foreground flex items-center gap-1.5 truncate">
                            <User className="h-3.5 w-3.5 opacity-40 shrink-0" /> 
                            {isStudent ? (res.teacherName || '담당 교사 배정 중') : `${res.studentName} 학생 (담당: ${res.teacherName})`}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isStaff && res.status === 'requested' && (
                          <div className="flex gap-2 w-full sm:w-auto">
                            <Button size="sm" onClick={() => handleUpdateStatus(res.id, 'confirmed')} className="rounded-xl font-black bg-emerald-500 hover:bg-emerald-600 gap-1.5 h-10 px-4">
                              <Check className="h-4 w-4" /> 승인
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(res.id, 'canceled')} className="rounded-xl font-black border-rose-200 text-rose-600 hover:bg-rose-50 h-10 px-4">
                              <X className="h-4 w-4" /> 거절
                            </Button>
                          </div>
                        )}
                        {isStaff && res.status === 'confirmed' && (
                          <Button size="sm" onClick={() => handleOpenLogModal(res)} className="rounded-xl font-black bg-primary text-white gap-1.5 h-10 px-4 shadow-md">
                            <FileEdit className="h-4 w-4" /> 일지 작성
                          </Button>
                        )}
                        {isStudent && (res.status === 'requested' || res.status === 'confirmed') && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleUpdateStatus(res.id, 'canceled')} 
                            className="rounded-xl font-black border-rose-200 text-rose-600 hover:bg-rose-50 h-10 px-4 transition-all"
                          >
                            <X className="h-4 w-4" /> 신청 취소
                          </Button>
                        )}
                        {!isStaff && !isStudent && <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                          <ChevronRight className="h-5 w-5" />
                        </div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
            <CardHeader className="bg-emerald-50/30 border-b p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle className="text-xl font-black text-emerald-700 flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 opacity-60" /> 피드백 및 결과 일지
                </CardTitle>
                
                {/* 시즌 필터 드롭다운 */}
                <div className="flex items-center gap-2 w-full sm:w-auto bg-white/50 p-1.5 rounded-2xl border shadow-sm">
                  <Filter className="h-3.5 w-3.5 text-emerald-600 ml-2" />
                  <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                    <SelectTrigger className="h-9 w-full sm:w-[180px] border-none bg-transparent font-black text-xs shadow-none focus:ring-0">
                      <SelectValue placeholder="시즌 선택" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      <SelectItem value="all" className="font-bold">전체 시즌 보기</SelectItem>
                      {availableSeasons.map(season => (
                        <SelectItem key={season} value={season} className="font-bold">
                          {season}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {logsLoading ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
              ) : filteredLogs.length === 0 ? (
                <div className="py-32 text-center text-muted-foreground/30 font-black italic flex flex-col items-center gap-4">
                  <FileText className="h-16 w-16 opacity-10" />
                  해당 시즌의 기록이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-muted/10">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="p-6 sm:p-10 space-y-5 hover:bg-muted/5 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge variant="outline" className="rounded-lg font-black uppercase text-[9px] sm:text-[10px] px-2 py-1 border-primary/20 text-primary">
                            {log.type === 'academic' ? '학업' : log.type === 'life' ? '생활' : '진로'}
                          </Badge>
                          <span className="text-[10px] sm:text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3 w-3 opacity-40" />
                            {log.createdAt ? format(log.createdAt.toDate(), 'yyyy.MM.dd') : ''}
                          </span>
                          {!isStudent && (
                            <Badge variant="secondary" className="font-black text-[9px] gap-1.5 px-2 py-0.5">
                              <GraduationCap className="h-3 w-3" /> {log.studentName} 학생
                            </Badge>
                          )}
                          <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[9px] px-2 py-0.5">
                            {log.createdAt ? getSeasonName(log.createdAt.toDate()) : ''}
                          </Badge>
                        </div>
                        <span className="text-[8px] font-black text-primary/30 uppercase tracking-[0.3em] hidden sm:inline">Counseling Verified</span>
                      </div>
                      <div className="space-y-4">
                        <div className="p-5 rounded-[1.5rem] bg-[#fafafa] border shadow-inner">
                          <p className="text-sm sm:text-base font-bold leading-relaxed text-foreground/80 whitespace-pre-wrap">{log.content}</p>
                        </div>
                        {log.improvement && (
                          <div className="p-5 rounded-[1.5rem] bg-emerald-50 border border-emerald-100 flex items-start gap-4">
                            <div className="p-2 rounded-xl bg-white shadow-sm"><AlertCircle className="h-4 w-4 text-emerald-600" /></div>
                            <div className="space-y-1">
                              <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">실천 권고 사항</p>
                              <p className="text-sm font-bold text-emerald-900 leading-relaxed">{log.improvement}</p>
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

      <Dialog open={isLogModalOpen} onOpenChange={setIsLogModalOpen}>
        <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl sm:max-w-md">
          <div className="bg-emerald-600 p-8 text-white relative">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tighter">상담 일지 작성</DialogTitle>
              <DialogDescription className="text-white/70 font-bold">상담 후 피드백을 기록하세요.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-8 space-y-5 bg-white">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">상담 유형</label>
              <Select value={logType} onValueChange={(val: any) => setLogType(val)}>
                <SelectTrigger className="rounded-xl h-12 border-2 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="academic">학업/성적</SelectItem>
                  <SelectItem value="life">생활 습관</SelectItem>
                  <SelectItem value="career">진로/진학</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">상담 내용</label>
              <Textarea placeholder="핵심 내용을 상세히 기록하세요." value={logContent} onChange={(e) => setLogContent(e.target.value)} className="rounded-xl min-h-[120px] text-sm font-bold border-2" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-emerald-700 ml-1">개선 권고 사항</label>
              <Input placeholder="학생이 수행할 과제나 개선점" value={logImprovement} onChange={(e) => setLogImprovement(e.target.value)} className="rounded-xl h-12 border-2" />
            </div>
          </div>
          <DialogFooter className="p-8 bg-muted/30">
            <Button onClick={handleSaveCounselLog} disabled={isSubmitting || !logContent.trim()} className="w-full h-14 rounded-2xl font-black bg-emerald-600 text-white shadow-xl">
              {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : '상담 완료 및 일지 저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
