'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, setDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { StudentProfile, DailyReport, CenterMembership, StudyPlanItem, StudyLogDay } from '@/lib/types';
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
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, 
  Search, 
  Send, 
  CheckCircle2, 
  Loader2,
  ChevronRight,
  Sparkles,
  Zap,
  Wand2,
  Save
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { generateDailyReport } from '@/ai/flows/generate-daily-report';

export default function DailyReportsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateKey = format(selectedDate, 'yyyy-MM-dd');
  const weekKey = format(selectedDate, "yyyy-'W'II");
  const centerId = activeMembership?.id;

  // 작성 팝업 상태
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string, name: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 1. 센터 내 학생 목록 조회
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'student'));
  }, [firestore, centerId]);
  const { data: studentMembers, isLoading: membersLoading } = useCollection<CenterMembership>(studentsQuery);

  // 2. 오늘의 리포트 목록 조회
  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'dailyReports'), where('dateKey', '==', dateKey));
  }, [firestore, centerId, dateKey]);
  const { data: dailyReports, isLoading: reportsLoading } = useCollection<DailyReport>(reportsQuery);

  const filteredStudents = useMemo(() => {
    if (!studentMembers) return [];
    return studentMembers.filter(s => 
      s.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  }, [studentMembers, searchTerm]);

  // AI 리포트 생성 핸들러
  const handleOpenWriteModal = async (studentId: string, studentName: string) => {
    setSelectedStudent({ id: studentId, name: studentName });
    const existing = dailyReports?.find(r => r.studentId === studentId);
    setReportContent(existing?.content || '');
    setIsWriteModalOpen(true);
  };

  const handleGenerateAiReport = async () => {
    if (!selectedStudent || !firestore || !centerId) return;
    setAiLoading(true);
    try {
      // 1. 데이터 수집 (계획, 시간표, 공부시간)
      const plansRef = collection(firestore, 'centers', centerId, 'plans', selectedStudent.id, 'weeks', weekKey, 'items');
      const plansSnap = await getDocs(query(plansRef, where('dateKey', '==', dateKey)));
      const plans = plansSnap.docs.map(d => d.data() as StudyPlanItem);

      const logRef = doc(firestore, 'centers', centerId, 'studyLogs', selectedStudent.id, 'days', dateKey);
      const logSnap = await getDocs(query(collection(firestore, 'centers', centerId, 'studyLogs', selectedStudent.id, 'days'), where('dateKey', '==', dateKey)));
      const todayLog = logSnap.docs[0]?.data() as StudyLogDay;

      // 2. AI 요청 데이터 구성
      const aiInput = {
        studentName: selectedStudent.name,
        date: dateKey,
        totalStudyMinutes: todayLog?.totalMinutes || 0,
        plans: plans.filter(p => p.category === 'study' || !p.category).map(p => ({ title: p.title, done: p.done })),
        schedule: plans.filter(p => p.category === 'schedule').map(p => {
          const [title, time] = p.title.split(': ');
          return { title, time: time || '-' };
        }),
      };

      const result = await generateDailyReport(aiInput);
      setReportContent(result.content);
      toast({ title: "AI 리포트 생성 완료", description: "학생의 데이터를 기반으로 초안이 작성되었습니다." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "AI 생성 실패", description: e.message });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveReport = async (status: 'draft' | 'sent' = 'draft') => {
    if (!selectedStudent || !firestore || !centerId || !user) return;
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

      toast({ 
        title: status === 'sent' ? "리포트 발송 완료" : "리포트 저장 완료", 
        description: status === 'sent' ? "학부모님께 성공적으로 전송되었습니다." : "작성 중인 내용이 저장되었습니다."
      });
      setIsWriteModalOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "저장 실패", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = membersLoading || reportsLoading;

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto pb-20">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            데일리 리포트 관리 센터
          </h1>
          <p className="text-muted-foreground font-bold text-sm">AI를 활용하여 학생의 하루를 정교하게 분석하고 학부모님께 보고합니다.</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border shadow-sm">
          <Input 
            type="date" 
            value={dateKey}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="w-[160px] border-none font-black text-primary"
          />
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-1 rounded-[2rem] border-none shadow-lg bg-white overflow-hidden flex flex-col">
          <CardHeader className="bg-muted/30 border-b p-6">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" /> 학생 검색
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="학생 이름 검색..." 
                className="pl-9 h-11 rounded-xl border-2 focus-visible:ring-primary/20 font-bold"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-2 max-h-[500px]">
              {membersLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin h-6 w-6 text-primary/30" /></div>
              ) : filteredStudents.length === 0 ? (
                <p className="text-center py-10 text-xs font-bold text-muted-foreground">검색 결과가 없습니다.</p>
              ) : (
                filteredStudents.map((student) => {
                  const report = dailyReports?.find(r => r.studentId === student.id);
                  return (
                    <div 
                      key={student.id} 
                      className={cn(
                        "p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-3 group",
                        report?.status === 'sent' 
                          ? "bg-emerald-50 border-emerald-100" 
                          : "bg-white border-transparent hover:border-primary/20 hover:bg-primary/5"
                      )}
                      onClick={() => handleOpenWriteModal(student.id, student.displayName || '학생')}
                    >
                      <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                        <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">
                          {student.displayName?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black truncate">{student.displayName}</p>
                        <p className={cn("text-[9px] font-black uppercase tracking-tighter", report?.status === 'sent' ? "text-emerald-600" : "text-muted-foreground")}>
                          {report?.status === 'sent' ? '발송 완료' : '미발송'}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
          <CardHeader className="p-8 border-b bg-muted/10 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-black">데일리 리포트 현황</CardTitle>
              <CardDescription className="font-bold text-base mt-1">
                {format(selectedDate, 'yyyy년 M월 d일')} 기준
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">오늘의 발송율</p>
              <p className="text-3xl font-black text-primary">
                {Math.round(((dailyReports?.filter(r => r.status === 'sent').length || 0) / (studentMembers?.length || 1)) * 100)}%
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {isLoading ? (
                <div className="flex justify-center py-40"><Loader2 className="animate-spin h-10 w-10 text-primary/20" /></div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-40 text-center flex flex-col items-center gap-4 opacity-20">
                  <Sparkles className="h-16 w-16" />
                  <p className="text-xl font-black">등록된 학생이 없습니다.</p>
                </div>
              ) : (
                filteredStudents.map((student) => {
                  const report = dailyReports?.find(r => r.studentId === student.id);
                  return (
                    <div key={student.id} className="p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-muted/5 transition-colors group">
                      <div className="flex items-center gap-5">
                        <Avatar className="h-16 w-16 border-4 border-white shadow-xl group-hover:scale-110 transition-transform">
                          <AvatarFallback className="bg-primary/5 text-primary font-black text-xl">
                            {student.displayName?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid gap-1">
                          <h3 className="text-xl font-black">{student.displayName} 학생</h3>
                          <div className="flex items-center gap-2">
                            {report?.status === 'sent' ? (
                              <Badge className="bg-emerald-500 text-white border-none font-black px-3 py-0.5 rounded-full text-[10px]">발송 완료</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground border-2 font-black px-3 py-0.5 rounded-full text-[10px]">미발송</Badge>
                            )}
                            <span className="text-xs font-bold text-muted-foreground">
                              {report?.updatedAt ? `${format(report.updatedAt.toDate(), 'HH:mm')} 업데이트` : '작성 기록 없음'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Button 
                          variant="outline" 
                          className="rounded-xl font-black h-12 px-6 gap-2 border-2 hover:bg-primary hover:text-white transition-all shadow-sm"
                          onClick={() => handleOpenWriteModal(student.id, student.displayName || '학생')}
                        >
                          <FileText className="h-4 w-4" /> 리포트 작성
                        </Button>
                        <Button 
                          className={cn(
                            "rounded-xl font-black h-12 px-8 gap-2 shadow-lg active:scale-95 transition-all",
                            report?.status === 'sent' ? "bg-muted text-muted-foreground" : "bg-primary text-white"
                          )}
                          disabled={report?.status === 'sent'}
                          onClick={() => handleOpenWriteModal(student.id, student.displayName || '학생')}
                        >
                          <Send className="h-4 w-4" /> {report?.status === 'sent' ? '발송됨' : '지금 발송'}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 리포트 작성 모달 */}
      <Dialog open={isWriteModalOpen} onOpenChange={setIsWriteModalOpen}>
        <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
          <div className="bg-primary p-8 text-white relative shrink-0">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Wand2 className="h-24 w-24" />
            </div>
            <DialogHeader className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <Badge className="bg-white/20 text-white border-none font-black text-[10px] tracking-widest uppercase">Daily Analytical Report</Badge>
                <span className="text-white/60 font-bold text-xs">{dateKey}</span>
              </div>
              <DialogTitle className="text-4xl font-black tracking-tighter">{selectedStudent?.name} 학생 리포트</DialogTitle>
              <DialogDescription className="text-white/70 font-bold text-lg">AI가 오늘의 데이터를 분석하여 리포트를 초안을 작성합니다.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 flex flex-col p-8 gap-6 bg-white overflow-hidden">
            <div className="flex items-center justify-between bg-muted/30 p-4 rounded-2xl border border-dashed border-primary/20">
              <div className="flex items-center gap-3 text-sm font-bold text-primary">
                <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
                오늘의 학습 데이터를 기반으로 작성할까요?
              </div>
              <Button 
                onClick={handleGenerateAiReport} 
                disabled={aiLoading} 
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black gap-2 shadow-lg"
              >
                {aiLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
                AI 초안 생성하기
              </Button>
            </div>

            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
              <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">리포트 본문</Label>
              <Textarea 
                placeholder="이곳에 리포트 내용을 입력하거나 AI 초안 생성을 눌러주세요." 
                value={reportContent}
                onChange={(e) => setReportContent(e.target.value)}
                className="flex-1 rounded-2xl border-2 p-6 font-bold leading-relaxed resize-none focus-visible:ring-primary/20 custom-scrollbar"
              />
            </div>
          </div>

          <DialogFooter className="p-8 bg-muted/10 border-t flex flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <Zap className="h-4 w-4 text-amber-500" />
              마지막 자동 저장: {new Date().toLocaleTimeString()}
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => handleSaveReport('draft')} 
                disabled={isSaving}
                className="rounded-xl font-black h-12 px-6 border-2"
              >
                <Save className="h-4 w-4 mr-2" /> 임시 저장
              </Button>
              <Button 
                onClick={handleSaveReport('sent')} 
                disabled={isSaving || !reportContent.trim()}
                className="rounded-xl font-black h-12 px-10 gap-2 shadow-xl active:scale-95 transition-all"
              >
                {isSaving ? <Loader2 className="animate-spin" /> : <Send className="h-4 w-4" />} 학부모님께 지금 발송
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}