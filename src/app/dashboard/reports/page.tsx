'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, setDoc, doc, serverTimestamp, getDocs, getDoc } from 'firebase/firestore';
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

  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string, name: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'student'));
  }, [firestore, centerId]);
  const { data: studentMembers, isLoading: membersLoading } = useCollection<CenterMembership>(studentsQuery);

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
      const plansRef = collection(firestore, 'centers', centerId, 'plans', selectedStudent.id, 'weeks', weekKey, 'items');
      const plansSnap = await getDocs(query(plansRef, where('dateKey', '==', dateKey)));
      const plans = plansSnap.docs.map(d => d.data() as StudyPlanItem);

      const logRef = doc(firestore, 'centers', centerId, 'studyLogs', selectedStudent.id, 'days', dateKey);
      const logSnap = await getDoc(logRef);
      const todayLog = logSnap.exists() ? (logSnap.data() as StudyLogDay) : null;

      const aiInput = {
        studentName: selectedStudent.name,
        date: dateKey,
        totalStudyMinutes: todayLog?.totalMinutes || 0,
        plans: plans
          .filter(p => p.category === 'study' || !p.category)
          .map(p => ({ title: p.title, done: p.done, category: 'study' })),
        schedule: plans
          .filter(p => p.category === 'schedule')
          .map(p => {
            const parts = p.title.split(': ');
            return { title: parts[0], time: parts[1] || '-' };
          }),
      };

      const result = await generateDailyReport(aiInput);
      setReportContent(result.content);
      toast({ title: "AI 리포트 생성 완료" });
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

      toast({ title: status === 'sent' ? "발송 완료" : "저장 완료" });
      setIsWriteModalOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "저장 실패" });
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
            데일리 리포트 센터
          </h1>
        </div>
        <Input 
          type="date" 
          value={dateKey}
          onChange={(e) => setSelectedDate(new Date(e.target.value))}
          className="w-[160px] font-black"
        />
      </header>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-1 rounded-[2rem] border-none shadow-lg">
          <CardContent className="p-4 flex flex-col gap-4">
            <Input 
              placeholder="학생 이름 검색..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-xl"
            />
            <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto">
              {filteredStudents.map((student) => (
                <div 
                  key={student.id} 
                  className="p-3 rounded-2xl border hover:bg-primary/5 cursor-pointer flex items-center gap-3"
                  onClick={() => handleOpenWriteModal(student.id, student.displayName || '학생')}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{student.displayName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black truncate">{student.displayName}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-30" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 rounded-[2.5rem] border-none shadow-xl">
          <CardContent className="p-0">
            <div className="divide-y">
              {isLoading ? (
                <div className="flex justify-center py-40"><Loader2 className="animate-spin" /></div>
              ) : filteredStudents.map((student) => {
                const report = dailyReports?.find(r => r.studentId === student.id);
                return (
                  <div key={student.id} className="p-8 flex items-center justify-between group">
                    <div className="flex items-center gap-5">
                      <Avatar className="h-16 w-16">
                        <AvatarFallback className="text-xl">{student.displayName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="grid gap-1">
                        <h3 className="text-xl font-black">{student.displayName} 학생</h3>
                        <Badge variant={report?.status === 'sent' ? 'default' : 'outline'}>
                          {report?.status === 'sent' ? '발송 완료' : '미발송'}
                        </Badge>
                      </div>
                    </div>
                    <Button onClick={() => handleOpenWriteModal(student.id, student.displayName || '학생')} className="rounded-xl font-black">
                      리포트 작성
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isWriteModalOpen} onOpenChange={setIsWriteModalOpen}>
        <DialogContent className="max-w-3xl rounded-[2.5rem] p-0 overflow-hidden flex flex-col h-[80vh]">
          <div className="bg-primary p-8 text-white">
            <DialogTitle className="text-3xl font-black">{selectedStudent?.name} 학생 리포트</DialogTitle>
            <DialogDescription className="text-white/70">{dateKey} 학습 분석</DialogDescription>
          </div>
          <div className="flex-1 p-8 flex flex-col gap-6 bg-white overflow-hidden">
            <Button onClick={handleGenerateAiReport} disabled={aiLoading} className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black gap-2">
              {aiLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
              AI 초안 생성하기
            </Button>
            <div className="flex-1 flex flex-col gap-2">
              <Label className="text-xs font-black uppercase text-muted-foreground ml-1">리포트 본문</Label>
              <Textarea 
                value={reportContent}
                onChange={(e) => setReportContent(e.target.value)}
                className="flex-1 rounded-2xl border-2 p-6 font-bold leading-relaxed resize-none"
              />
            </div>
          </div>
          <DialogFooter className="p-8 bg-muted/10 border-t">
            <Button variant="outline" onClick={() => handleSaveReport('draft')} disabled={isSaving}>임시 저장</Button>
            <Button onClick={() => handleSaveReport('sent')} disabled={isSaving || !reportContent.trim()}>학부모 발송</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
