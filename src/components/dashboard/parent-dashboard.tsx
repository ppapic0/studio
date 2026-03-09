'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Send,
  Sparkles,
  TrendingUp,
  Activity,
  History,
  BookOpen,
  ChevronRight,
  PieChart as PieChartIcon,
  BarChart3,
  Flame,
  Info,
  Maximize2,
  FileText,
  Clock,
  Zap,
  Coffee,
  AlertTriangle
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import { addDoc, collection, doc, limit, query, serverTimestamp, where } from 'firebase/firestore';
import { format, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useAppContext } from '@/contexts/app-context';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  parentDashboardMockData,
  type ParentPortalTab,
  type ParentQuickRequestKey,
  type ParentNotificationItem,
} from '@/lib/parent-dashboard-model';
import {
  type AttendanceCurrent,
  type DailyReport,
  type GrowthProgress,
  type StudyLogDay,
  type StudyPlanItem,
  type StudentProfile,
} from '@/lib/types';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

const tabs: { value: ParentPortalTab; label: string }[] = [
  { value: 'home', label: '홈' },
  { value: 'reports', label: '리포트' },
  { value: 'studyDetail', label: '학습' },
  { value: 'life', label: '생활' },
  { value: 'communication', label: '소통' },
  { value: 'notifications', label: '알림' },
];

function toHm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

function statusByPenalty(points: number) {
  if (points >= 20) return { label: '주의 필요', tone: 'bg-rose-50 text-rose-700 border-rose-100', color: '#e11d48' };
  if (points >= 10) return { label: '보통', tone: 'bg-amber-50 text-amber-700 border-amber-100', color: '#d97706' };
  return { label: '매우 좋음', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100', color: '#059669' };
}

export function ParentDashboard({ isActive }: { isActive: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();

  const isMobile = viewMode === 'mobile';
  const [today, setToday] = useState<Date | null>(null);
  const [tab, setTab] = useState<ParentPortalTab>('home');

  const [channel, setChannel] = useState<'visit' | 'phone' | 'online'>('visit');
  const [quickType, setQuickType] = useState<ParentQuickRequestKey>('math_support');
  const [requestText, setRequestText] = useState('');
  const [suggestionText, setSuggestionText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [readMap, setReadMap] = useState<Record<string, boolean>>({});

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => setToday(new Date()), []);

  useEffect(() => {
    const requestedTab = searchParams.get('parentTab') as ParentPortalTab | null;
    if (requestedTab && tabs.some((item) => item.value === requestedTab)) {
      setTab(requestedTab);
    }
  }, [searchParams]);

  const centerId = activeMembership?.id;
  const studentId = activeMembership?.linkedStudentIds?.[0];
  const todayKey = today ? format(today, 'yyyy-MM-dd') : '';
  const yesterdayKey = today ? format(subDays(today, 1), 'yyyy-MM-dd') : '';
  const weekKey = today ? format(today, "yyyy-'W'II") : '';

  const studentRef = useMemoFirebase(() => (!firestore || !centerId || !studentId ? null : doc(firestore, 'centers', centerId, 'students', studentId)), [firestore, centerId, studentId]);
  const { data: student } = useDoc<StudentProfile>(studentRef, { enabled: isActive && !!studentId });

  const todayLogRef = useMemoFirebase(() => (!firestore || !centerId || !studentId || !todayKey ? null : doc(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', todayKey)), [firestore, centerId, studentId, todayKey]);
  const { data: todayLog } = useDoc<StudyLogDay>(todayLogRef, { enabled: isActive && !!studentId });

  const plansQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !todayKey || !weekKey) return null;
    return query(collection(firestore, 'centers', centerId, 'plans', studentId, 'weeks', weekKey, 'items'), where('dateKey', '==', todayKey));
  }, [firestore, centerId, studentId, todayKey, weekKey]);
  const { data: todayPlans } = useCollection<StudyPlanItem>(plansQuery, { enabled: isActive && !!studentId });

  const attendanceCurrentRef = useMemoFirebase(() => (!firestore || !centerId || !studentId ? null : doc(firestore, 'centers', centerId, 'attendanceCurrent', studentId)), [firestore, centerId, studentId]);
  const { data: attendanceCurrent } = useDoc<AttendanceCurrent>(attendanceCurrentRef, { enabled: isActive && !!studentId });

  const growthRef = useMemoFirebase(() => (!firestore || !centerId || !studentId ? null : doc(firestore, 'centers', centerId, 'growthProgress', studentId)), [firestore, centerId, studentId]);
  const { data: growth } = useDoc<GrowthProgress>(growthRef, { enabled: isActive && !!studentId });

  const reportRef = useMemoFirebase(() => (!firestore || !centerId || !studentId || !yesterdayKey ? null : doc(firestore, 'centers', centerId, 'dailyReports', `${yesterdayKey}_${studentId}`)), [firestore, centerId, studentId, yesterdayKey]);
  const { data: report } = useDoc<DailyReport>(reportRef, { enabled: isActive && !!studentId });

  const remoteNotificationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(collection(firestore, 'centers', centerId, 'parentNotifications'), where('studentId', '==', studentId), limit(20));
  }, [firestore, centerId, studentId]);
  const { data: remoteNotifications } = useCollection<any>(remoteNotificationsQuery, { enabled: isActive && !!studentId });

  const studyPlans = (todayPlans || []).filter((item) => item.category === 'study' || !item.category);
  const totalMinutes = todayLog?.totalMinutes || 0;
  
  const planTotal = studyPlans.length;
  const planDone = studyPlans.filter((item) => item.done).length;
  const planRate = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;

  const inCenter = ['studying', 'break', 'away'].includes(attendanceCurrent?.status || '');
  const penalty = growth?.penaltyPoints || 0;
  const behavior = statusByPenalty(penalty);

  const notifications: ParentNotificationItem[] = useMemo(() => {
    if (remoteNotifications && remoteNotifications.length > 0) {
      return remoteNotifications.map((item: any) => ({
        id: item.id,
        type: item.type || 'weekly_report',
        title: item.title || '새 알림',
        body: item.body || '',
        createdAtLabel: item.createdAtLabel || '최근',
        isRead: !!item.isRead,
        isImportant: !!item.isImportant,
      }));
    }
    return parentDashboardMockData.notifications;
  }, [remoteNotifications]);

  const unreadCount = notifications.filter((item) => !readMap[item.id]).length;
  const weekly = parentDashboardMockData.weeklyReport;

  const subjects = useMemo(() => {
    const map = new Map<string, number>();
    studyPlans.forEach((plan) => {
      if (!plan.subject || !plan.targetMinutes) return;
      map.set(plan.subject, (map.get(plan.subject) || 0) + plan.targetMinutes);
    });
    if (map.size === 0) return parentDashboardMockData.charts.subjectShare;
    return [...map.entries()].map(([subject, minutes]) => ({ subject, minutes }));
  }, [studyPlans]);

  const handleTabChange = (value: string) => {
    const nextTab = value as ParentPortalTab;
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('parentTab', nextTab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  async function submit(type: 'consultation' | 'request' | 'suggestion') {
    if (!firestore || !centerId || !studentId || !user) return;
    let title = '';
    let body = '';
    if (type === 'consultation') {
      title = `상담 신청 (${channel === 'visit' ? '방문' : channel === 'phone' ? '전화' : '온라인'})`;
      body = requestText.trim();
      if (!body) { toast({ variant: 'destructive', title: '입력 확인', description: '상담 요청 내용을 입력해주세요.' }); return; }
    }
    if (type === 'request') {
      title = parentDashboardMockData.quickRequestTemplates[quickType];
      body = requestText.trim() || title;
    }
    if (type === 'suggestion') {
      title = '건의사항';
      body = suggestionText.trim();
      if (!body) { toast({ variant: 'destructive', title: '입력 확인', description: '건의사항을 입력해주세요.' }); return; }
    }
    setSubmitting(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'parentCommunications'), {
        studentId, parentUid: user.uid, parentName: user.displayName || '학부모',
        type, title, body, channel: type === 'consultation' ? channel : null,
        status: 'requested', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      toast({ title: '전송 완료', description: '선생님께 요청이 정상적으로 전달되었습니다.' });
      setRequestText(''); setSuggestionText('');
    } catch (error) {
      toast({ variant: 'destructive', title: '전송 실패', description: '통신 오류가 발생했습니다.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (!isActive) return null;

  return (
    <div className={cn("space-y-4 pb-24", isMobile ? "px-0" : "max-w-4xl mx-auto px-4")}>
      <Card className="overflow-hidden rounded-[2.5rem] border-none bg-white shadow-2xl ring-1 ring-slate-200/60">
        <CardContent className={cn('p-6 space-y-6')}>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-2xl font-black tracking-tighter text-primary leading-none">
              {student?.name || '자녀'} 학생 스냅샷
            </CardTitle>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              {format(new Date(), 'yyyy. MM. dd (EEEE)', {locale: ko})}
            </p>
          </div>

          <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
            <TabsContent value="home" className="mt-0 space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-3 gap-3">
                <Card className="rounded-2xl border-none bg-slate-50 p-4 text-center space-y-1 shadow-sm">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">공부 시간</span>
                  <p className="text-xl font-black text-primary leading-tight">{toHm(totalMinutes)}</p>
                </Card>
                <Card className="rounded-2xl border-none bg-[#fff7ed] p-4 text-center space-y-1 shadow-sm border border-orange-100">
                  <span className="text-[8px] font-black text-orange-600 uppercase tracking-widest">계획 달성</span>
                  <p className="text-xl font-black text-primary leading-tight">{planRate}%</p>
                </Card>
                <Card className={cn(
                  "rounded-2xl border-none p-4 text-center space-y-1 shadow-sm border",
                  inCenter ? "bg-[#eaf2ff] border-blue-100" : "bg-slate-100 border-slate-200"
                )}>
                  <span className={cn("text-[8px] font-black uppercase tracking-widest", inCenter ? "text-blue-600" : "text-slate-400")}>재실 상태</span>
                  <p className="text-xl font-black text-primary leading-tight">{inCenter ? '입실 중' : '미재실'}</p>
                </Card>
              </div>

              <Card className="rounded-[2rem] border-none bg-slate-50 p-6 ring-1 ring-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:rotate-12 transition-transform duration-700">
                  <MessageCircle className="h-20 w-20 text-primary" />
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-[#FF7A16] fill-current" />
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">오늘의 집중 분석 요약</span>
                </div>
                <p className="text-sm font-bold text-slate-700 leading-relaxed break-keep relative z-10">
                  "{report?.content || '오늘의 학습 피드백을 AI와 선생님이 정밀 분석 중입니다.'}"
                </p>
              </Card>

              <Dialog>
                <DialogTrigger asChild>
                  <Button className="w-full h-14 rounded-2xl bg-primary text-white hover:bg-primary/90 font-black gap-2 text-base shadow-xl active:scale-[0.98] transition-all">
                    <TrendingUp className="h-5 w-5" /> 상세 분석 리포트 확인 <ChevronRight className="h-4 w-4 ml-auto opacity-40" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md">
                  <div className="bg-primary p-10 text-white relative">
                    <Sparkles className="absolute top-0 right-0 p-8 h-32 w-32 opacity-20" />
                    <DialogTitle className="text-2xl font-black tracking-tighter">AI 학습 인사이트</DialogTitle>
                    <DialogDescription className="text-white/70 font-bold mt-1 text-xs">자녀의 학습 패턴을 인공지능이 정밀 분석했습니다.</DialogDescription>
                  </div>
                  <div className="p-6 space-y-3 bg-[#fafafa]">
                    {parentDashboardMockData.aiInsights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-orange-200">
                        <div className="h-2 w-2 rounded-full bg-[#FF7A16] mt-2 shrink-0" />
                        <p className="text-sm font-bold text-slate-700 leading-relaxed">{insight}</p>
                      </div>
                    ))}
                  </div>
                  <DialogFooter className="p-6 bg-white border-t">
                    <DialogClose asChild><Button className="w-full h-14 rounded-2xl font-black text-lg bg-primary">확인했습니다</Button></DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="reports" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <div className="grid grid-cols-2 gap-3">
                <Card className="rounded-[1.5rem] border-none bg-white p-6 ring-1 ring-slate-100 text-center shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 block mb-2 uppercase tracking-widest">주간 누적 몰입</span>
                  <p className="text-2xl font-black text-primary">{toHm(weekly.totalStudyMinutes)}</p>
                </Card>
                <Card className="rounded-[1.5rem] border-none bg-white p-6 ring-1 ring-slate-100 text-center shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 block mb-2 uppercase tracking-widest">평균 목표 달성</span>
                  <p className="text-2xl font-black text-[#FF7A16]">{weekly.avgPlanCompletionRate}%</p>
                </Card>
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full h-14 rounded-2xl border-2 border-slate-100 bg-slate-50/30 hover:bg-slate-50 font-black gap-2 text-sm text-primary shadow-sm">
                    <BarChart3 className="h-5 w-5 text-[#FF7A16]" /> 주간 성과 정밀 분석 보기 <Maximize2 className="h-4 w-4 opacity-30 ml-auto" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-lg">
                  <div className="bg-primary p-10 text-white relative">
                    <DialogTitle className="text-3xl font-black tracking-tighter text-left">주간 성과 데이터</DialogTitle>
                    <DialogDescription className="text-white/70 font-bold mt-1 text-sm">최근 7일간의 학습 지표 및 피드백입니다.</DialogDescription>
                  </div>
                  <div className="p-8 space-y-10 bg-white overflow-y-auto max-h-[60vh] custom-scrollbar">
                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase text-primary tracking-[0.2em] ml-1">일별 집중 시간 (분)</h4>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsLineChart data={parentDashboardMockData.charts.dailyStudyMinutes}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="date" fontSize={10} fontWeights="800" axisLine={false} tickLine={false} />
                            <YAxis fontSize={10} fontWeights="800" axisLine={false} tickLine={false} width={30} />
                            <Tooltip contentStyle={{borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)'}} />
                            <Line type="monotone" dataKey="minutes" stroke="#FF7A16" strokeWidth={4} dot={{ r: 4, fill: '#fff', stroke: '#FF7A16', strokeWidth: 2 }} />
                          </RechartsLineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="p-6 rounded-[2rem] bg-orange-50/50 border border-orange-100">
                      <p className="text-[10px] font-black text-[#FF7A16] uppercase mb-2 tracking-widest">선생님 종합 피드백</p>
                      <p className="text-base font-bold text-slate-700 leading-relaxed">"{weekly.teacherFeedback}"</p>
                    </div>
                  </div>
                  <DialogFooter className="p-6 bg-white border-t">
                    <DialogClose asChild><Button className="w-full h-14 rounded-2xl font-black text-lg bg-primary">확인 완료</Button></DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="studyDetail" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <Card className="rounded-[2rem] border-none shadow-sm bg-white p-6 ring-1 ring-slate-100">
                <CardTitle className="text-base font-black tracking-tight mb-6 flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-[#FF7A16]" /> 과목별 학습 비중
                </CardTitle>
                <div className="space-y-5">
                  {subjects.slice(0, 4).map((s, i) => (
                    <div key={s.subject} className="flex flex-col gap-2">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#14295F', '#FF7A16', '#10b981', '#8b5cf6'][i % 4] }} />
                          {s.subject}
                        </span>
                        <span className="font-black text-primary">{s.minutes}분</span>
                      </div>
                      <Progress value={Math.min(100, Math.round((s.minutes / (totalMinutes || 1)) * 100))} className="h-1.5 bg-slate-100" />
                    </div>
                  ))}
                </div>
              </Card>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="w-full h-12 rounded-2xl font-black text-xs text-slate-400 hover:text-primary transition-all">
                    <BarChart3 className="h-4 w-4 mr-2" /> 시간대별 집중도 정밀 분석
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8 sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-black mb-2">시간대별 집중 분포</DialogTitle>
                    <DialogDescription className="text-xs font-bold text-muted-foreground leading-relaxed">
                      자녀가 하루 중 가장 고도의 몰입을 보이는 시간대입니다. <br/>이 시간대에 고난도 과목을 배치하는 것을 권장합니다.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="h-56 w-full mt-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={parentDashboardMockData.charts.hourlyFocus}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="hour" fontSize={10} fontWeights="800" axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} fontWeights="800" axisLine={false} tickLine={false} width={25} />
                        <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} contentStyle={{borderRadius: '1rem', border: 'none'}} />
                        <Bar dataKey="minutes" name="집중(분)" fill="#14295F" radius={[6,6,0,0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="life" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <Card className="rounded-[2rem] border-none shadow-sm bg-rose-50/30 p-6 flex items-center justify-between group transition-colors border border-rose-100">
                <div className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-rose-600 tracking-widest">누적 벌점 지수</span>
                  <h3 className="text-4xl font-black text-rose-900 tracking-tighter">{penalty}<span className="text-lg opacity-40 ml-1">점</span></h3>
                </div>
                <Badge className={cn('font-black border-none px-4 h-8 text-xs rounded-full shadow-sm', behavior.tone)}>{behavior.label}</Badge>
              </Card>

              <div className="space-y-3">
                <div className="flex items-center gap-2 ml-1">
                  <Activity className="h-4 w-4 text-slate-400" />
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">실시간 관리 기록</span>
                </div>
                {parentDashboardMockData.life.recentPenaltyReasons.length === 0 ? (
                  <div className="py-16 text-center opacity-20 italic font-black text-xs border-2 border-dashed rounded-[2rem]">기록된 특이사항이 없습니다. ✨</div>
                ) : (
                  <div className="grid gap-2">
                    {parentDashboardMockData.life.recentPenaltyReasons.map((r) => (
                      <div key={r.id} className="flex justify-between items-center p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:border-rose-200 transition-all">
                        <div className="grid gap-1">
                          <span className="text-sm font-bold text-slate-800">{r.reason}</span>
                          <span className="text-[10px] font-black text-slate-400">{r.dateLabel} · 규정 준수 안내됨</span>
                        </div>
                        <Badge variant="destructive" className="bg-rose-100 text-rose-700 border-none font-black text-xs px-3 py-1">+{r.points}점</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="communication" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-slate-100">
                <CardTitle className="text-lg font-black tracking-tighter mb-6 flex items-center gap-2"><Send className="h-5 w-5 text-primary" /> 상담 및 지원 요청</CardTitle>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">상담 채널</Label>
                    <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold text-sm shadow-sm"><SelectValue placeholder="상담 채널 선택" /></SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="visit" className="font-bold py-3 text-sm">🏫 센터 방문 상담</SelectItem>
                        <SelectItem value="phone" className="font-bold py-3 text-sm">📞 전화 상담</SelectItem>
                        <SelectItem value="online" className="font-bold py-3 text-sm">💻 온라인 상담</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">상담 내용</Label>
                    <Textarea className="min-h-[120px] rounded-[1.5rem] border-2 font-bold p-4 text-sm shadow-inner" value={requestText} onChange={(e) => setRequestText(e.target.value)} placeholder="자녀의 학습이나 생활에 대해 궁금하신 점을 자유롭게 입력해 주세요." />
                  </div>
                  <Button className="w-full h-16 rounded-[1.5rem] bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-all" onClick={() => submit('consultation')} disabled={submitting}>요청 보내기</Button>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="mt-0 space-y-3 animate-in fade-in duration-500">
              {notifications.length === 0 ? (
                <div className="py-32 text-center opacity-20 italic font-black text-slate-400 flex flex-col items-center gap-4">
                  <Bell className="h-16 w-16" /> <span className="text-sm uppercase tracking-widest">새로운 알림이 없습니다.</span>
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={cn(
                    'rounded-2xl border p-5 flex flex-col gap-1 transition-all bg-white cursor-pointer active:scale-[0.98]',
                    !readMap[n.id] ? 'border-primary/20 shadow-lg ring-1 ring-primary/5' : 'border-slate-100 opacity-60'
                  )} onClick={() => setReadMap(prev => ({...prev, [n.id]: true}))}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{n.createdAtLabel}</span>
                      {n.isImportant && <Badge className="bg-orange-100 text-[#FF7A16] border-none font-black text-[8px] h-5 px-2">중요</Badge>}
                    </div>
                    <p className="text-base font-black text-primary tracking-tight">{n.title}</p>
                    <p className="text-xs font-bold text-slate-500 leading-relaxed">{n.body}</p>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50/50 px-6 py-4 flex items-start gap-3 mx-1">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-[10px] font-bold text-blue-900/70 leading-relaxed break-keep">
          학부모 모드는 실시간 조회 전용입니다. 정보 수정이나 학생의 상세 설정 변경은 센터 관리자 또는 자녀 계정을 통해 가능합니다.
        </p>
      </div>
    </div>
  );
}
