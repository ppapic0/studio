
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
  Calendar,
  CheckCircle2,
  PenTool,
  Users
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { generateDailyReport } from '@/ai/flows/generate-daily-report';
import { sendKakaoNotification } from '@/lib/kakao-service';

export default function DailyReportsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  
  const isMobile = viewMode === 'mobile';
  const [searchTerm, setSearchTerm] = useState('');
  
  // 초기 날짜를 어제로 즉시 설정하여 로딩 지연 방지
  const [selectedDate, setSelectedDate] = useState<Date>(() => subDays(new Date(), 1));

  const dateKey = format(selectedDate, 'yyyy-MM-dd');
  const weekKey = format(selectedDate, "yyyy-'W'II");
  const centerId = activeMembership?.id;

  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string, name: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [teacherNote, setTeacherNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 재원생(active)이면서 역할이 student인 멤버만 조회
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'), 
      where('role', '==', 'student'),
      where('status', '==', 'active')
    );
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
      toast({ 
        variant: "destructive", 
        title: "AI 생성 실패", 
        description: e.message || "연결 상태를 확인해 주세요." 
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

      // 리포트 발송 시 카카오톡 알림
      if (status === 'sent') {
        sendKakaoNotification(firestore, centerId, {
          studentName: selectedStudent.name,
          type: 'report'
        });
      }

      toast({ title: status === 'sent' ? "발송 완료" : "저장 완료" });
      setIsWriteModalOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "저장 실패" });
    } finally {
      setIsSaving(false);
    }
  };

  const isFullLoading = membersLoading || reportsLoading;

  return (
    <div className={cn("flex flex-col gap-6 max-w-5xl mx-auto pb-20 px-1", isMobile ? "gap-4" : "gap-8")}>
      <header className={cn("flex justify-between gap-4", isMobile ? "flex-col" : "flex-row items-center")}>
        <div className="flex flex-col gap-1">
          <h1 className={cn("font-black tracking-tighter flex items-center gap-2", isMobile ? "text-2xl" : "text-4xl")}>
            <FileText className={cn("text-primary", isMobile ? "h-6 w-6" : "h-10 w-10")} />
            데일리 리포트 센터
          </h1>
          <p className={cn("font-bold text-muted-foreground ml-1 uppercase tracking-widest", isMobile ? "text-[9px]" : "text-xs")}>Yesterday Analysis & Reports</p>
        </div>
        <div className={cn("flex items-center gap-2", isMobile ? "w-full" : "")}>
          <div className="relative flex-1 sm:flex-none">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
            <Input 
              type="date" 
              value={dateKey}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className={cn("font-black rounded-[1.25rem] shadow-sm border-2 pl-11 focus-visible:ring-primary/20 transition-all", isMobile ? "h-12 w-full text-sm" : "h-14 w-[200px]")}
            />
          </div>
        </div>
      </header>

      <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "md:grid-cols-4")}>
        {!isMobile && (
          <Card className="rounded-[2.5rem] border-none shadow-lg bg-white overflow-hidden ring-1 ring-border/50">
            <CardHeader className="bg-muted/30 border-b p-6">
              <CardTitle className="text-xs font-black flex items-center gap-2 uppercase tracking-widest opacity-60">
                <Users className="h-3.5 w-3.5 text-primary" /> 학생 빠른 찾기
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                <Input 
                  placeholder="이름 검색..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="rounded-xl border-2 pl-10 h-11 text-xs font-bold"
                />
              </div>
              <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar max-h-[500px] pr-1">
                {filteredStudents.map((student) => (
                  <div 
                    key={student.id} 
                    className="p-3 rounded-2xl border-2 border-transparent hover:border-primary/10 hover:bg-primary/5 cursor-pointer flex items-center gap-3 transition-all active:scale-95"
                    onClick={() => handleOpenWriteModal(student.id, student.displayName || '학생')}
                  >
                    <Avatar className="h-10 w-10 border-2 border-white shadow-sm ring-1 ring-border/50">
                      <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">{student.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-black truncate flex-1">{student.displayName}</p>
                    <ChevronRight className="h-4 w-4 opacity-20" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className={cn("flex flex-col gap-4", isMobile ? "col-span-1" : "md:col-span-3")}>
          {isMobile && (
            <div className="px-1 relative">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-30" />
               <Input 
                placeholder="학생 검색..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-2xl h-12 text-sm font-bold border-none shadow-xl pl-11 bg-white"
              />
            </div>
          )}

          <div className="grid gap-4">
            {isFullLoading ? (
              <div className="flex flex-col items-center justify-center py-40 gap-4">
                <Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" />
                <p className="text-sm font-black text-muted-foreground/40 uppercase tracking-[0.2em]">Syncing Reports...</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center gap-6 bg-white/50 backdrop-blur-sm rounded-[3rem] border-2 border-dashed border-border/50">
                <Search className="h-16 w-16 text-muted-foreground opacity-10" />
                <div className="space-y-1">
                  <p className="text-xl font-black text-muted-foreground/40">학생을 찾을 수 없습니다.</p>
                  <p className="text-sm font-bold text-muted-foreground/20 uppercase">Try another name</p>
                </div>
              </div>
            ) : filteredStudents.map((student) => {
              const report = dailyReports?.find(r => r.studentId === student.id);
              const isSent = report?.status === 'sent';
              
              return (
                <Card 
                  key={student.id} 
                  className={cn(
                    "rounded-[2rem] border-none shadow-lg overflow-hidden group transition-all duration-500 active:scale-[0.98]",
                    isSent ? "bg-emerald-50/30 ring-1 ring-emerald-100" : "bg-white ring-1 ring-border/50"
                  )}
                >
                  <CardContent className="p-0">
                    <div className={cn("flex items-center justify-between p-5 sm:p-8", isMobile ? "gap-3" : "gap-8")}>
                      <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                        <div className="relative">
                          <Avatar className={cn("ring-4 transition-all duration-500", isSent ? "ring-emerald-500/20" : "ring-muted/20", isMobile ? "h-14 w-14" : "h-20 w-20")}>
                            <AvatarFallback className={cn("font-black", isMobile ? "text-xl" : "text-3xl")}>{student.displayName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          {isSent && (
                            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full shadow-lg border-2 border-white">
                              <CheckCircle2 className="h-3 w-3 sm:h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div className="grid gap-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={cn("font-black tracking-tighter truncate", isMobile ? "text-lg" : "text-3xl")}>{student.displayName}</h3>
                            {isSent && (
                              <Badge className="bg-emerald-500/10 text-emerald-600 font-black px-2 py-0.5 rounded-full border-none text-[9px] uppercase tracking-tighter">Report Sent</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="font-bold text-muted-foreground/60 text-[10px] sm:text-xs">
                              {report ? `Last Edit: ${format((report.updatedAt as any).toDate(), 'HH:mm')}` : "Not Started Yet"}
                            </p>
                            {report?.status === 'draft' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            )}
                          </div>
                        </div>
                      </div>
                      <Button 
                        onClick={() => handleOpenWriteModal(student.id, student.displayName || '학생')} 
                        className={cn(
                          "rounded-2xl font-black shrink-0 transition-all duration-300",
                          isMobile ? "h-12 w-12 p-0 shadow-lg" : "h-16 px-10 text-base shadow-xl",
                          isSent ? "bg-white text-emerald-600 border-2 border-emerald-100 hover:bg-emerald-50" : "bg-primary text-white hover:bg-primary/90"
                        )}
                      >
                        {isMobile ? (
                          isSent ? <CheckCircle2 className="h-6 w-6" /> : <PenTool className="h-6 w-6" />
                        ) : (
                          report ? '리포트 수정' : '리포트 작성'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={isWriteModalOpen} onOpenChange={setIsWriteModalOpen}>
        <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col transition-all duration-500", isMobile ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] h-[85vh] max-w-[450px] rounded-[2rem]" : "max-w-4xl h-[90vh]")}>
          <div className={cn("bg-primary text-white relative overflow-hidden shrink-0", isMobile ? "p-6" : "p-12")}>
            <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
              <Sparkles className={cn(isMobile ? "h-20 w-20" : "h-48 w-48")} />
            </div>
            <DialogHeader className="relative z-10">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge className="bg-white/20 text-white border-none font-black text-[9px] tracking-[0.2em] uppercase px-3 py-1">Premium AI Analysis</Badge>
                <span className="text-white/60 font-black text-[10px] tracking-widest">{dateKey}</span>
              </div>
              <DialogTitle className={cn("font-black tracking-tighter", isMobile ? "text-2xl" : "text-5xl")}>{selectedStudent?.name} 학생</DialogTitle>
              <DialogDescription className="text-white/70 font-bold text-sm mt-1">성장 데이터를 바탕으로 AI와 선생님의 정밀 리포트가 합쳐진 최적의 솔루션입니다.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar">
            <div className={cn("space-y-8", isMobile ? "p-5" : "p-12")}>
              <div className={cn("grid gap-6 items-start", isMobile ? "grid-cols-1" : "md:grid-cols-5")}>
                <Card className={cn("rounded-[2rem] border-none shadow-xl bg-white ring-1 ring-border/50", isMobile ? "" : "md:col-span-3")}>
                  <CardHeader className="bg-muted/10 pb-4 border-b py-5 px-6">
                    <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest text-primary/70">
                      <FileText className="h-4 w-4" /> 교사 특별 관찰 노트
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <Textarea 
                      placeholder="학습 태도나 특이사항을 기록해 주세요. AI 분석의 핵심 맥락으로 활용됩니다." 
                      value={teacherNote}
                      onChange={(e) => setTeacherNote(e.target.value)}
                      className="min-h-[100px] rounded-2xl border-2 font-bold text-sm resize-none shadow-inner"
                    />
                    <Button 
                      onClick={handleGenerateAiReport} 
                      disabled={aiLoading} 
                      className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-base gap-3 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                    >
                      {aiLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <Wand2 className="h-5 w-5" />}
                      AI 정밀 분석 리포트 생성
                    </Button>
                  </CardContent>
                </Card>

                {!isMobile && (
                  <div className="md:col-span-2 grid gap-4">
                    {[
                      { icon: TrendingUp, label: '최근 7일 비교', desc: '학습 추세 자동 대조', color: 'text-blue-600', bg: 'bg-blue-50' },
                      { icon: Trophy, label: '10단계 진단', desc: '정량적 성취 수준 분석', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { icon: Zap, label: '맞춤형 피드백', desc: '학생별 약점 보완 조언', color: 'text-amber-600', bg: 'bg-amber-50' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-[1.5rem] bg-white border border-primary/5 shadow-md hover:shadow-xl transition-all">
                        <div className={cn("p-2.5 rounded-2xl", item.bg)}><item.icon className={cn("h-5 w-5", item.color)} /></div>
                        <div>
                          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">{item.label}</p>
                          <p className="text-xs font-bold">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <Label className="text-[10px] font-black uppercase text-primary/70 tracking-widest ml-2 flex items-center gap-2">
                  <Zap className="h-4 w-4" /> 생성된 리포트 최종 검토 및 편집
                </Label>
                <div className="relative group">
                  <Textarea 
                    value={reportContent}
                    onChange={(e) => setReportContent(e.target.value)}
                    className={cn(
                      "rounded-[2.5rem] border-2 border-muted font-bold leading-relaxed text-base resize-none shadow-2xl bg-white group-hover:border-primary/20 focus-visible:ring-primary/10 transition-all",
                      isMobile ? "min-h-[300px] p-5" : "min-h-[500px] p-10"
                    )}
                  />
                  {!reportContent && !aiLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20 gap-4">
                      <Sparkles className="h-16 w-16" />
                      <p className="font-black text-xl tracking-tighter">AI 분석을 실행해 주세요.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className={cn("bg-white border-t shrink-0 backdrop-blur-xl bg-white/80", isMobile ? "p-5 flex-col gap-3" : "p-10 flex-row justify-between items-center")}>
            {!isMobile && (
              <div className="font-bold text-muted-foreground italic text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                ※ 생성된 리포트를 한 번 더 확인 후 발송해 주세요.
              </div>
            )}
            <div className={cn("flex gap-3", isMobile ? "w-full" : "")}>
              <Button variant="outline" className="rounded-2xl h-14 px-8 font-black flex-1 sm:flex-none border-2 shadow-sm" onClick={() => handleSaveReport('draft')} disabled={isSaving}>임시 저장</Button>
              <Button className="rounded-2xl h-14 px-12 font-black gap-3 shadow-xl flex-1 sm:flex-none active:scale-95 transition-all" onClick={() => handleSaveReport('sent')} disabled={isSaving || !reportContent.trim()}>
                <Send className="h-5 w-5" /> 발송
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
