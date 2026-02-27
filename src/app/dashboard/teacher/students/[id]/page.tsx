'use client';

import { use, useState } from 'react';
import { useDoc, useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc, collection, query, where, orderBy, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Loader2, 
  ArrowLeft, 
  Calendar, 
  ClipboardCheck, 
  MessageCircle, 
  Send,
  History,
  TrendingUp,
  Building2
} from 'lucide-react';
import Link from 'next/link';
import { StudentProfile, StudyPlan, CounselingLog, ParentFeedbackDraft } from '@/lib/types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = use(params);
  const { activeMembership } = useAppContext();
  const firestore = useFirestore();
  const { toast } = useToast();

  const centerId = activeMembership?.id;

  // 1. 학생 기본 정보
  const studentRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId, 'students', studentId);
  }, [firestore, centerId, studentId]);
  const { data: student, isLoading: studentLoading } = useDoc<StudentProfile>(studentRef);

  // 2. 공부 계획 리스트
  const plansQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'studyPlans'),
      where('studentId', '==', studentId),
      orderBy('startDate', 'desc')
    );
  }, [firestore, centerId, studentId]);
  const { data: plans, isLoading: plansLoading } = useCollection<StudyPlan>(plansQuery);

  // 3. 상담 기록 리스트
  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'counselingLogs'),
      where('studentId', '==', studentId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, centerId, studentId]);
  const { data: logs, isLoading: logsLoading } = useCollection<CounselingLog>(logsQuery);

  // 4. 피드백 초안 (오늘 날짜 기반)
  const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const draftRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId, 'parentFeedbackDrafts', `${studentId}_${todayStr}`);
  }, [firestore, centerId, studentId, todayStr]);
  const { data: draft } = useDoc<ParentFeedbackDraft>(draftRef);

  // --- 상담 작성 상태 ---
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [logForm, setLogLogForm] = useState({ content: '', improvement: '', type: 'academic' as CounselingLog['type'] });

  const handleAddLog = async () => {
    if (!firestore || !centerId || !activeMembership || !logForm.content) return;
    setIsSubmittingLog(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'counselingLogs'), {
        studentId,
        teacherId: activeMembership.id,
        type: logForm.type,
        content: logForm.content,
        improvement: logForm.improvement,
        createdAt: serverTimestamp(),
      });
      toast({ title: "상담 일지가 저장되었습니다." });
      setLogLogForm({ content: '', improvement: '', type: 'academic' });
    } catch (e) {
      toast({ variant: "destructive", title: "저장 실패" });
    } finally {
      setIsSubmittingLog(false);
    }
  };

  if (studentLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" asChild>
          <Link href="/dashboard/teacher/students">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black">{student?.name} 학생</h1>
            <Badge className="bg-primary text-white">{student?.seatNo || '미배정'}번 좌석</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-bold mt-1">
            <span className="flex items-center gap-1 text-primary">
              <Building2 className="h-3.5 w-3.5" /> {student?.schoolName || '학교 정보 없음'}
            </span>
            <span>·</span>
            <span>{student?.grade}</span>
            <span>·</span>
            <span>일일 목표 {student?.targetDailyMinutes}분</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-2xl h-14 p-1 bg-muted/50">
          <TabsTrigger value="overview" className="rounded-xl font-bold">학습 현황</TabsTrigger>
          <TabsTrigger value="plans" className="rounded-xl font-bold">공부 계획</TabsTrigger>
          <TabsTrigger value="counseling" className="rounded-xl font-bold">상담 관리</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="rounded-[2rem] border-none shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" /> 오늘 공부 시간
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black">180분</div>
                <p className="text-[10px] text-muted-foreground font-bold mt-1">목표 대비 65% 달성</p>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-[2rem] border-none shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" /> 학부모 피드백 작성
              </CardTitle>
              <CardDescription>오늘의 학습 태도와 특이사항을 학부모님께 전달합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                placeholder="피드백 내용을 입력하세요 (자동 초안 저장)" 
                className="min-h-[150px] rounded-2xl p-4 text-sm font-medium"
                defaultValue={draft?.contentDraft}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" className="rounded-xl font-bold">초안 저장</Button>
                <Button className="rounded-xl font-bold gap-2">
                  <Send className="h-4 w-4" /> 발송 요청
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="mt-6">
          <Card className="rounded-[2rem] border-none shadow-lg overflow-hidden">
            <CardHeader className="bg-muted/30 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle>진행 중인 계획</CardTitle>
                <CardDescription>학생의 과목별 목표와 진척도를 관리합니다.</CardDescription>
              </div>
              <Button size="sm" className="rounded-xl font-bold">계획 추가</Button>
            </CardHeader>
            <CardContent className="p-0">
              {plansLoading ? <Loader2 className="animate-spin mx-auto my-10" /> : (
                <div className="divide-y">
                  {plans?.map(plan => (
                    <div key={plan.id} className="p-6 flex items-center justify-between group hover:bg-muted/20 transition-all">
                      <div className="grid gap-1">
                        <span className="text-base font-black">{plan.subject}</span>
                        <span className="text-xs text-muted-foreground font-bold">
                          {format(plan.startDate.toDate(), 'MM.dd')} ~ {format(plan.endDate.toDate(), 'MM.dd')}
                        </span>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <span className="text-sm font-black text-primary">{plan.completedMinutes}분</span>
                          <span className="text-xs text-muted-foreground"> / {plan.targetMinutes}분</span>
                        </div>
                        <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                          {plan.status === 'active' ? '진행중' : '완료'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="counseling" className="mt-6 grid gap-6 md:grid-cols-2">
          <Card className="rounded-[2rem] border-none shadow-lg">
            <CardHeader>
              <CardTitle>새 상담 일지 작성</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label>상담 유형</Label>
                <div className="flex gap-2">
                  {(['academic', 'life', 'career'] as const).map(t => (
                    <Button 
                      key={t}
                      variant={logForm.type === t ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setLogLogForm({ ...logForm, type: t })}
                      className="rounded-xl text-xs font-bold"
                    >
                      {t === 'academic' ? '학업' : t === 'life' ? '생활' : '진로'}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>상담 내용</Label>
                <Textarea 
                  className="rounded-xl min-h-[100px]" 
                  value={logForm.content}
                  onChange={(e) => setLogLogForm({ ...logForm, content: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>개선 제안</Label>
                <Input 
                  className="rounded-xl" 
                  value={logForm.improvement}
                  onChange={(e) => setLogLogForm({ ...logForm, improvement: e.target.value })}
                />
              </div>
              <Button 
                className="w-full rounded-xl font-black h-12" 
                onClick={handleAddLog} 
                disabled={isSubmittingLog}
              >
                {isSubmittingLog ? <Loader2 className="animate-spin" /> : '저장하기'}
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-none shadow-lg overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" /> 과거 상담 기록
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
              {logsLoading ? <Loader2 className="animate-spin mx-auto my-10" /> : (
                <div className="divide-y">
                  {logs?.map(log => (
                    <div key={log.id} className="p-5 space-y-2">
                      <div className="flex justify-between items-start">
                        <Badge variant="outline" className="text-[10px] uppercase font-black">{log.type}</Badge>
                        <span className="text-[10px] text-muted-foreground font-bold">{format(log.createdAt.toDate(), 'yy.MM.dd')}</span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed">{log.content}</p>
                      {log.improvement && (
                        <div className="bg-primary/5 p-2 rounded-lg border border-primary/10">
                          <p className="text-[11px] font-black text-primary">💡 개선 제안</p>
                          <p className="text-xs font-bold text-muted-foreground">{log.improvement}</p>
                        </div>
                      )}
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
