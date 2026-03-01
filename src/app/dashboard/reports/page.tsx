'use client';

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, setDoc, doc, serverTimestamp, getDocs, getDoc, orderBy, limit } from 'firebase/firestore';
import { DailyReport, CenterMembership, StudyPlanItem, StudyLogDay } from '@/lib/types';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, 
  Search, 
  Send, 
  Loader2,
  ChevronRight,
  Sparkles,
  Zap,
  Wand2,
  Save,
  Trophy,
  AlertCircle,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { generateDailyReport } from '@/ai/flows/generate-daily-report';

export default function DailyReportsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  
  const isMobile = viewMode === 'mobile';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  useEffect(() => {
    // 하이드레이션 오류 방지를 위해 클라이언트 마운트 후 날짜 설정
    setSelectedDate(subDays(new Date(), 1));
  }, []);

  const dateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const weekKey = selectedDate ? format(selectedDate, "yyyy-'W'II") : '';
  const centerId = activeMembership?.id;

  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string, name: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [teacherNote, setTeacherNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'student'));
  }, [firestore, centerId]);
  const { data: studentMembers, isLoading: membersLoading } = useCollection<CenterMembership>(studentsQuery);

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !dateKey) return null;
    return query(collection(firestore, 'centers', centerId, 'dailyReports'), where('dateKey', '==', dateKey));
  }, [firestore, centerId, dateKey]);
  const { data: dailyReports, isLoading: reportsLoading } = useCollection<DailyReport>(reportsQuery);

  const filteredStudents = useMemo(() => {
    if (!studentMembers) return [];
    return studentMembers.filter(s => 
      s.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  }, [studentMembers, searchTerm]);

  const handleOpenWriteModal = async (studentId: string, studentName: string) => {
    setSelectedStudent({ id: studentId, name: studentName });
    const existing = dailyReports?.find(r => r.studentId === studentId);
    setReportContent(existing?.content || '');
    setTeacherNote('');
    setIsWriteModalOpen(true);
  };

  const handleGenerateAiReport = async () => {
    if (!selectedStudent || !firestore || !centerId || !dateKey) return;
    setAiLoading(true);
    try {
      const plansRef = collection(firestore, 'centers', centerId, 'plans', selectedStudent.id, 'weeks', weekKey, 'items');
      const plansSnap = await getDocs(query(plansRef, where('dateKey', '==', dateKey)));
      const plans = plansSnap.docs.map(d => d.data() as StudyPlanItem);

      const logRef = doc(firestore, 'centers', centerId, 'studyLogs', selectedStudent.id, 'days', dateKey);
      const logSnap = await getDoc(logRef);
      const todayLog = logSnap.exists() ? (logSnap.data() as StudyLogDay) : null;

      const lastLogsRef = collection(firestore, 'centers', centerId, 'studyLogs', selectedStudent.id, 'days');
      const historySnap = await getDocs(query(lastLogsRef, orderBy('dateKey', 'desc'), limit(14)));
      const history7Days = historySnap.docs
        .map(d => ({
          date: d.data().dateKey,
          minutes: d.data().totalMinutes || 0
        }))
        .filter(h => h.date < dateKey)
        .slice(0, 7);

      const studyTasks = plans.filter(p => p.category === 'study' || !p.category);
      const completionRate = studyTasks.length > 0 
        ? Math.round((studyTasks.filter(t => t.done).length / studyTasks.length) * 100)
        : 0;

      const aiInput = {
        studentName: selectedStudent.name,
        date: dateKey,
        totalStudyMinutes: todayLog?.totalMinutes || 0,
        completionRate,
        plans: studyTasks.map(p => ({ title: p.title, done: p.done })),
        schedule: plans
          .filter(p => p.category === 'schedule')
          .map(p => {
            const parts = p.title.split(': ');
            return { title: parts[0], time: parts[1] || '-' };
          }),
        history7Days,
        teacherNote: teacherNote.trim() || undefined
      };

      const result = await generateDailyReport(aiInput);
      setReportContent(result.content);
      toast({ title: `AI 리포트 생성 완료 (진단: Lv.${result.level})` });
    } catch (e: any) {
      console.error("Gemini AI Flow Error:", e);
      toast({ 
        variant: "destructive", 
        title: "AI 생성 실패", 
        description: e.message || "연결 상태 또는 API 키를 확인해 주세요." 
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveReport = async (status: 'draft' | 'sent' = 'draft') => {
    if (!selectedStudent || !firestore || !centerId || !user || !dateKey) return;
    setIsSaving(true);
    try {
      const reportId = `${dateKey}_${selectedStudent.id}`;
      const reportRef = doc(firestore, 'centers', centerId, 'dailyReports', reportId);
      
      await setDoc(reportRef, {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        teacherId: user.uid,
        dateKey,
        content: reportContent,
        status,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });

      toast({ title: status === 'sent' ? "발송 완료" : "저장 완료" });
      setIsWriteModalOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "저장 실패" });
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = !selectedDate || membersLoading || reportsLoading;

  if (!selectedDate) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-6 max-w-6xl mx-auto pb-20 px-1", isMobile ? "gap-4" : "gap-8")}>
      <header className={cn("flex justify-between gap-4", isMobile ? "flex-col" : "flex-row items-center")}>
        <div className="flex flex-col gap-1">
          <h1 className={cn("font-black tracking-tighter flex items-center gap-2", isMobile ? "text-2xl" : "text-3xl")}>
            <FileText className={cn("text-primary", isMobile ? "h-6 w-6" : "h-8 w-8")} />
            데일리 리포트 센터
          </h1>
          <p className={cn("font-bold text-muted-foreground ml-1", isMobile ? "text-[10px]" : "text-sm")}>전날의 학습 데이터를 분석하여 리포트를 생성합니다.</p>
        </div>
        <div className={cn("flex items-center gap-2", isMobile ? "w-full" : "")}>
          <div className="relative flex-1 sm:flex-none">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input 
              type="date" 
              value={dateKey}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className={cn("font-black rounded-xl shadow-sm pl-9", isMobile ? "h-10 w-full text-xs" : "h-11 w-[180px]")}
            />
          </div>
        </div>
      </header>

      <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "md:grid-cols-4")}>
        <Card className={cn("rounded-[2rem] border-none shadow-lg bg-white overflow-hidden", isMobile ? "col-span-1" : "md:col-span-1")}>
          <CardHeader className={cn("bg-muted/30 border-b", isMobile ? "p-4" : "p-6 pb-4")}>
            <CardTitle className="text-xs font-black flex items-center gap-2 uppercase tracking-widest opacity-60">
              <Search className="h-3.5 w-3.5 text-primary" /> 학생 목록
            </CardTitle>
          </CardHeader>
          <CardContent className={cn("flex flex-col gap-4", isMobile ? "p-3" : "p-4")}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
              <Input 
                placeholder="이름 검색..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-xl border-2 pl-9 h-10 text-xs"
              />
            </div>
            <div className={cn("flex flex-col gap-1 overflow-y-auto custom-scrollbar pr-1", isMobile ? "max-h-[200px]" : "max-h-[500px]")}>
              {filteredStudents.map((student) => (
                <div 
                  key={student.id} 
                  className="p-2.5 rounded-xl border-2 border-transparent hover:border-primary/20 hover:bg-primary/5 cursor-pointer flex items-center gap-3 transition-all active:scale-95"
                  onClick={() => handleOpenWriteModal(student.id, student.displayName || '학생')}
                >
                  <Avatar className="h-8 w-8 border-2 border-white shadow-sm">
                    <AvatarFallback className="bg-primary/5 text-primary font-black text-[10px]">{student.displayName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <p className="text-[11px] font-black truncate flex-1">{student.displayName}</p>
                  <ChevronRight className="h-3 w-3 opacity-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={cn("rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden", isMobile ? "col-span-1" : "md:col-span-3")}>
          <CardContent className="p-0">
            <div className="divide-y border-t border-muted/10">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4">
                  <Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" />
                  <p className="text-xs font-bold text-muted-foreground animate-pulse">데이터 로드 중...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-40 text-center flex flex-col items-center gap-4 text-muted-foreground/40">
                  <Search className="h-16 w-16 opacity-10" />
                  <p className="font-black italic text-xs">검색 결과가 없습니다.</p>
                </div>
              ) : filteredStudents.map((student) => {
                const report = dailyReports?.find(r => r.studentId === student.id);
                return (
                  <div key={student.id} className={cn("flex items-center justify-between group hover:bg-muted/5 transition-colors", isMobile ? "p-4 gap-3" : "p-8")}>
                    <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                      <Avatar className={cn("ring-4 ring-muted/20 shrink-0", isMobile ? "h-10 w-10" : "h-16 w-16")}>
                        <AvatarFallback className={cn("font-black", isMobile ? "text-xs" : "text-xl")}>{student.displayName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="grid gap-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={cn("font-black tracking-tighter truncate", isMobile ? "text-sm" : "text-2xl")}>{student.displayName} 학생</h3>
                          {report?.status === 'sent' && (
                            <Badge className="bg-emerald-500 text-white font-black px-1.5 py-0 rounded-md border-none shadow-sm text-[8px] sm:text-[10px]">발송 완료</Badge>
                          )}
                        </div>
                        <p className={cn("font-bold text-muted-foreground flex items-center gap-1.5", isMobile ? "text-[9px]" : "text-xs")}>
                          {report ? (
                            <>
                              <Zap className="h-2.5 w-2.5 text-amber-500" />
                              작성: {format((report.updatedAt as any).toDate(), 'HH:mm')}
                            </>
                          ) : (
                            "리포트 없음"
                          )}
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleOpenWriteModal(student.id, student.displayName || '학생')} 
                      size={isMobile ? "sm" : "default"}
                      className={cn(
                        "rounded-xl font-black transition-all active:scale-95 shrink-0",
                        isMobile ? "h-9 px-3 text-[10px]" : "h-14 px-8 text-sm shadow-lg",
                        report?.status === 'sent' ? "bg-white text-primary border-2 border-primary/10 hover:bg-muted/10" : "bg-primary text-white"
                      )}
                    >
                      {report ? '수정' : '작성'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isWriteModalOpen} onOpenChange={setIsWriteModalOpen}>
        <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col", isMobile ? "w-full h-full max-w-none rounded-none" : "max-w-4xl h-[90vh]")}>
          <div className={cn("bg-primary text-white relative overflow-hidden shrink-0", isMobile ? "p-6" : "p-10")}>
            <div className="absolute top-0 right-0 p-10 opacity-10">
              <Sparkles className={cn(isMobile ? "h-20 w-20" : "h-40 w-40")} />
            </div>
            <DialogHeader className="relative z-10">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <Badge className="bg-white/20 text-white border-none font-black text-[8px] sm:text-[10px] tracking-widest uppercase">Premium AI Analysis</Badge>
                <span className="text-white/60 font-bold text-[10px] sm:text-xs">{dateKey} (대상 날짜)</span>
              </div>
              <DialogTitle className={cn("font-black tracking-tighter", isMobile ? "text-2xl" : "text-4xl")}>{selectedStudent?.name} 학생 학습 분석</DialogTitle>
              <DialogDescription className={cn("text-white/70 font-bold", isMobile ? "text-xs" : "text-lg")}>10단계 마스터리 시스템 기반 리포트를 생성합니다.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar">
            <div className={cn("space-y-8", isMobile ? "p-5" : "p-10")}>
              <div className={cn("grid gap-6 items-start", isMobile ? "grid-cols-1" : "md:grid-cols-2")}>
                <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden ring-1 ring-border/50">
                  <CardHeader className="bg-muted/30 pb-3 border-b">
                    <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest text-primary/70">
                      <FileText className="h-3.5 w-3.5" /> 선생님 관찰 노트
                    </CardTitle>
                  </CardHeader>
                  <CardContent className={cn("space-y-4", isMobile ? "p-4" : "p-6")}>
                    <Textarea 
                      placeholder="학생의 태도나 특이사항을 기록해 주세요. AI가 리포트에 반영합니다." 
                      value={teacherNote}
                      onChange={(e) => setTeacherNote(e.target.value)}
                      className="min-h-[100px] rounded-xl border-2 border-muted focus-visible:ring-primary/20 font-bold text-xs resize-none"
                    />
                    <Button 
                      onClick={handleGenerateAiReport} 
                      disabled={aiLoading} 
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl h-12 font-black text-sm shadow-lg shadow-amber-100 gap-3 active:scale-95 transition-all"
                    >
                      {aiLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
                      AI 리포트 생성
                    </Button>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  {[
                    { icon: TrendingUp, label: '7일 평균 비교', desc: '이전 1주일 성과 대조', color: 'text-blue-600', bg: 'bg-blue-50' },
                    { icon: Trophy, label: '데이터 기반 진단', desc: '학습 및 완수율 10단계 분석', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { icon: AlertCircle, label: '자동 알림 시스템', desc: '연속 저조 또는 기록 갱신 탐지', color: 'text-rose-600', bg: 'bg-rose-50' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-primary/5 shadow-sm">
                      <div className={cn("p-2 rounded-xl", item.bg)}>
                        <item.icon className={cn("h-4 w-4", item.color)} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-muted-foreground uppercase">{item.label}</p>
                        <p className="text-[11px] font-bold">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-[10px] font-black uppercase text-primary/70 tracking-widest ml-1 flex items-center gap-2">
                  <Zap className="h-3 w-3" /> 최종 리포트 본문 편집
                </Label>
                <div className="relative group">
                  <Textarea 
                    value={reportContent}
                    onChange={(e) => setReportContent(e.target.value)}
                    className={cn("rounded-[2rem] border-2 border-muted focus-visible:ring-primary/20 font-bold leading-relaxed text-sm resize-none shadow-inner bg-white", isMobile ? "min-h-[300px] p-5" : "min-h-[450px] p-8")}
                  />
                  {!reportContent && !aiLoading && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                      <p className="font-black text-sm sm:text-lg">상단의 AI 리포트 생성을 눌러주세요.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className={cn("bg-white border-t shrink-0 flex items-center gap-3", isMobile ? "p-4 flex-col" : "p-8 justify-between")}>
            <div className={cn("font-bold text-muted-foreground italic", isMobile ? "text-[8px]" : "text-[10px]")}>
              ※ 전날 완료된 학습 데이터를 바탕으로 작성하는 것을 권장합니다.
            </div>
            <div className={cn("flex gap-2", isMobile ? "w-full" : "")}>
              <Button variant="outline" className="rounded-xl h-11 px-4 font-black flex-1 sm:flex-none" onClick={() => handleSaveReport('draft')} disabled={isSaving}>임시 저장</Button>
              <Button className="rounded-xl h-11 px-8 font-black gap-2 shadow-xl flex-1 sm:flex-none" onClick={() => handleSaveReport('sent')} disabled={isSaving || !reportContent.trim()}>
                <Send className="h-3.5 w-3.5" /> 발송
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
