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
  TrendingUp
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { generateDailyReport } from '@/ai/flows/generate-daily-report';

export default function DailyReportsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();
  
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
    <div className="flex flex-col gap-8 max-w-6xl mx-auto pb-20">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            데일리 리포트 센터
          </h1>
          <p className="text-sm font-bold text-muted-foreground ml-1">전날의 학습 데이터를 분석하여 리포트를 생성합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <Input 
            type="date" 
            value={dateKey}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="w-[160px] font-black h-11 rounded-xl shadow-sm"
          />
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-1 rounded-[2rem] border-none shadow-lg bg-white overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4 border-b">
            <CardTitle className="text-sm font-black flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" /> 학생 목록
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex flex-col gap-4">
            <Input 
              placeholder="학생 이름 검색..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-xl border-2"
            />
            <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
              {filteredStudents.map((student) => (
                <div 
                  key={student.id} 
                  className="p-3 rounded-2xl border-2 border-transparent hover:border-primary/20 hover:bg-primary/5 cursor-pointer flex items-center gap-3 transition-all active:scale-95"
                  onClick={() => handleOpenWriteModal(student.id, student.displayName || '학생')}
                >
                  <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                    <AvatarFallback className="bg-primary/5 text-primary font-black">{student.displayName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black truncate">{student.displayName}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
          <CardContent className="p-0">
            <div className="divide-y border-t">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4">
                  <Loader2 className="animate-spin h-8 w-8 text-primary" />
                  <p className="font-bold text-muted-foreground animate-pulse">데이터 로드 중...</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-40 text-center flex flex-col items-center gap-4 text-muted-foreground/40">
                  <Search className="h-16 w-16 opacity-10" />
                  <p className="font-black italic">검색 결과가 없습니다.</p>
                </div>
              ) : filteredStudents.map((student) => {
                const report = dailyReports?.find(r => r.studentId === student.id);
                return (
                  <div key={student.id} className="p-8 flex items-center justify-between group hover:bg-muted/5 transition-colors">
                    <div className="flex items-center gap-6">
                      <Avatar className="h-16 w-16 ring-4 ring-muted/20">
                        <AvatarFallback className="text-xl font-black">{student.displayName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="grid gap-1.5">
                        <div className="flex items-center gap-2">
                          <h3 className="text-2xl font-black tracking-tighter">{student.displayName} 학생</h3>
                          {report?.status === 'sent' && (
                            <Badge className="bg-emerald-500 text-white font-black px-2 py-0.5 rounded-lg border-none shadow-sm">발송 완료</Badge>
                          )}
                        </div>
                        <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                          {report ? (
                            <>
                              <Zap className="h-3 w-3 text-amber-500" />
                              최종 작성: {format((report.updatedAt as any).toDate(), 'HH:mm')}
                            </>
                          ) : (
                            "작성된 리포트가 없습니다."
                          )}
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleOpenWriteModal(student.id, student.displayName || '학생')} 
                      className={cn(
                        "rounded-2xl font-black h-14 px-8 shadow-lg transition-all active:scale-95",
                        report?.status === 'sent' ? "bg-white text-primary border-2 border-primary/10 hover:bg-muted/10" : "bg-primary text-white"
                      )}
                    >
                      {report ? '리포트 수정' : '리포트 작성'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isWriteModalOpen} onOpenChange={setIsWriteModalOpen}>
        <DialogContent className="max-w-4xl rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col h-[90vh]">
          <div className="bg-primary p-10 text-white relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 p-10 opacity-10">
              <Sparkles className="h-40 w-40" />
            </div>
            <DialogHeader className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <Badge className="bg-white/20 text-white border-none font-black text-[10px] tracking-widest uppercase">Premium AI Analysis</Badge>
                <span className="text-white/60 font-bold text-xs">{dateKey} (대상 날짜)</span>
              </div>
              <DialogTitle className="text-4xl font-black tracking-tighter">{selectedStudent?.name} 학생 학습 분석</DialogTitle>
              <DialogDescription className="text-white/70 font-bold text-lg">10단계 마스터리 시스템 기반 리포트를 생성합니다.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar">
            <div className="p-8 sm:p-10 space-y-8">
              <div className="grid gap-6 md:grid-cols-2 items-start">
                <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden ring-1 ring-border/50">
                  <CardHeader className="bg-muted/30 pb-4 border-b">
                    <CardTitle className="text-xs font-black flex items-center gap-2 uppercase tracking-widest text-primary/70">
                      <FileText className="h-4 w-4" /> 선생님 관찰 노트
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <Textarea 
                      placeholder="오늘 학생의 몰입도나 태도에 대해 기록해 주세요. AI가 이 내용을 리포트에 반영합니다." 
                      value={teacherNote}
                      onChange={(e) => setTeacherNote(e.target.value)}
                      className="min-h-[120px] rounded-xl border-2 border-muted focus-visible:ring-primary/20 font-bold text-sm resize-none"
                    />
                    <Button 
                      onClick={handleGenerateAiReport} 
                      disabled={aiLoading} 
                      className="w-full mt-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl h-14 font-black text-base shadow-lg shadow-amber-100 gap-3 active:scale-95 transition-all"
                    >
                      {aiLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <Wand2 className="h-5 w-5" />}
                      AI 리포트 생성
                    </Button>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-5 rounded-[1.5rem] bg-white border-2 border-primary/5 shadow-sm">
                    <div className="p-3 rounded-2xl bg-blue-50">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase">7일 평균 비교</p>
                      <p className="text-sm font-bold">리포트 날짜 이전 1주일 성과 대조</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-5 rounded-[1.5rem] bg-white border-2 border-primary/5 shadow-sm">
                    <div className="p-3 rounded-2xl bg-emerald-50">
                      <Trophy className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase">데이터 기반 진단</p>
                      <p className="text-sm font-bold">학습 시간과 완수율 기반 10단계 분석</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-5 rounded-[1.5rem] bg-white border-2 border-primary/5 shadow-sm">
                    <div className="p-3 rounded-2xl bg-rose-50">
                      <AlertCircle className="h-5 w-5 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase">자동 알림 시스템</p>
                      <p className="text-sm font-bold">연속 저조 또는 기록 갱신 여부 탐지</p>
                    </div>
                  </div>
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
                    className="min-h-[450px] rounded-[2rem] border-2 border-muted focus-visible:ring-primary/20 p-8 font-bold leading-relaxed text-base resize-none shadow-inner bg-white"
                  />
                  {!reportContent && !aiLoading && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                      <p className="font-black text-lg">상단의 AI 리포트 생성을 눌러주세요.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-white border-t shrink-0 flex items-center justify-between gap-4">
            <div className="text-[10px] font-bold text-muted-foreground italic">
              ※ 전날 완료된 학습 데이터를 바탕으로 작성하는 것을 권장합니다.
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="rounded-xl h-12 px-6 font-black" onClick={() => handleSaveReport('draft')} disabled={isSaving}>임시 저장</Button>
              <Button className="rounded-xl h-12 px-10 font-black gap-2 shadow-xl" onClick={() => handleSaveReport('sent')} disabled={isSaving || !reportContent.trim()}>
                <Send className="h-4 w-4" /> 학부모님께 발송
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
