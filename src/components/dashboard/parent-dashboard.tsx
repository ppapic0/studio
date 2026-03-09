'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Activity,
  History,
  BookOpen,
  UserCheck,
  ChevronRight,
  PieChart as PieChartIcon,
  BarChart3,
  Flame,
  Info,
  Maximize2,
  CalendarDays,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { addDoc, collection, doc, limit, query, serverTimestamp, where } from 'firebase/firestore';
import { format, subDays } from 'date-fns';
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
  type StudySession,
  type StudentProfile,
} from '@/lib/types';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { TrackLogo } from '../ui/track-logo';
import {
  Dialog,
  DialogContent,
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

function attendanceTime(items: StudyPlanItem[] | undefined, keyword: string) {
  const target = items?.find((item) => item.title.includes(keyword));
  if (!target) return '--:--';
  return target.title.split(': ')[1] || '--:--';
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

  const yesterdayLogRef = useMemoFirebase(() => (!firestore || !centerId || !studentId || !yesterdayKey ? null : doc(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', yesterdayKey)), [firestore, centerId, studentId, yesterdayKey]);
  const { data: yesterdayLog } = useDoc<StudyLogDay>(yesterdayLogRef, { enabled: isActive && !!studentId });

  const plansQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !todayKey || !weekKey) return null;
    return query(collection(firestore, 'centers', centerId, 'plans', studentId, 'weeks', weekKey, 'items'), where('dateKey', '==', todayKey));
  }, [firestore, centerId, studentId, todayKey, weekKey]);
  const { data: todayPlans } = useCollection<StudyPlanItem>(plansQuery, { enabled: isActive && !!studentId });

  const sessionsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !todayKey) return null;
    return query(collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', todayKey, 'sessions'), limit(30));
  }, [firestore, centerId, studentId, todayKey]);
  const { data: sessions } = useCollection<StudySession>(sessionsQuery, { enabled: isActive && !!studentId });

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
  const yesterdayMinutes = yesterdayLog?.totalMinutes || 0;
  const deltaMinutes = totalMinutes - yesterdayMinutes;

  const planTotal = studyPlans.length;
  const planDone = studyPlans.filter((item) => item.done).length;
  const planRate = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;

  const inCenter = ['studying', 'break', 'away'].includes(attendanceCurrent?.status || '');
  const penalty = growth?.penaltyPoints || parentDashboardMockData.monthlyReport.accumulatedPenaltyPoints;
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
  const monthly = parentDashboardMockData.monthlyReport;

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
    <div className={cn("space-y-4 pb-20", isMobile ? "px-0" : "max-w-4xl mx-auto px-4")}>
      <Card className="overflow-hidden rounded-[2rem] border-none bg-white shadow-xl ring-1 ring-slate-200/60">
        <CardHeader className={cn('p-5 border-b bg-slate-50/50')}>
          <div className="flex items-center justify-between">
            <TrackLogo className="h-8" />
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full bg-white border-slate-200 text-slate-500 font-black text-[9px] uppercase h-6">Parent Portal</Badge>
              {unreadCount > 0 && <Badge className="bg-rose-500 text-white border-none font-black text-[9px] h-6 px-2">{unreadCount}</Badge>}
            </div>
          </div>
        </CardHeader>

        <CardContent className={cn('p-5 space-y-6')}>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-2xl font-black tracking-tighter text-slate-900 leading-none">
              {student?.name || '자녀'} 학생 스냅샷
            </CardTitle>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{format(new Date(), 'yyyy. MM. dd (EEEE)', {locale: ko})}</p>
          </div>

          <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
            <TabsContent value="home" className="mt-0 space-y-4 animate-in fade-in duration-500">
              {/* 핵심 지표 요약 - 콤팩트 카드 */}
              <div className="grid grid-cols-3 gap-2">
                <Card className="rounded-2xl border-none bg-blue-50/50 p-4 text-center space-y-1">
                  <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest">학습 시간</span>
                  <p className="text-lg font-black text-blue-900 leading-none">{toHm(totalMinutes)}</p>
                </Card>
                <Card className="rounded-2xl border-none bg-emerald-50/50 p-4 text-center space-y-1">
                  <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">달성률</span>
                  <p className="text-lg font-black text-emerald-900 leading-none">{planRate}%</p>
                </Card>
                <Card className="rounded-2xl border-none bg-amber-50/50 p-4 text-center space-y-1">
                  <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest">상태</span>
                  <p className="text-lg font-black text-amber-900 leading-none">{inCenter ? '입실' : '미재실'}</p>
                </Card>
              </div>

              {/* 오늘의 피드백 요약 */}
              <Card className="rounded-2xl border-none bg-slate-50 p-5 ring-1 ring-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12"><MessageCircle className="h-16 w-16" /></div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Teacher's Daily Note</span>
                </div>
                <p className="text-sm font-bold text-slate-700 leading-relaxed break-keep relative z-10">
                  "{report?.content || parentDashboardMockData.feedback.daily}"
                </p>
              </Card>

              {/* AI 인사이트 팝업으로 유도 */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full h-14 rounded-2xl border-2 border-primary/10 bg-white hover:bg-slate-50 transition-all font-black gap-2 shadow-sm">
                    <TrendingUp className="h-4 w-4 text-primary" /> AI 종합 분석 결과 보기 <ChevronRight className="h-4 w-4 opacity-30" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md">
                  <div className="bg-primary p-8 text-white relative">
                    <Sparkles className="absolute top-0 right-0 p-8 h-32 w-32 opacity-20" />
                    <DialogTitle className="text-2xl font-black tracking-tighter">AI 학습 인사이트</DialogTitle>
                    <DialogDescription className="text-white/70 font-bold mt-1">자녀의 학습 패턴을 인공지능이 분석했습니다.</DialogDescription>
                  </div>
                  <div className="p-8 space-y-4 bg-[#fafafa]">
                    {parentDashboardMockData.aiInsights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                        <p className="text-sm font-bold text-slate-700 leading-relaxed">{insight}</p>
                      </div>
                    ))}
                  </div>
                  <DialogFooter className="p-6 bg-white border-t">
                    <DialogClose asChild><Button className="w-full h-12 rounded-xl font-black">닫기</Button></DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="reports" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <div className="grid grid-cols-2 gap-3">
                <Card className="rounded-2xl border-none bg-white p-5 ring-1 ring-slate-100 text-center">
                  <span className="text-[9px] font-black text-slate-400 block mb-1">주간 공부 시간</span>
                  <p className="text-xl font-black text-blue-600">{toHm(weekly.totalStudyMinutes)}</p>
                </Card>
                <Card className="rounded-2xl border-none bg-white p-5 ring-1 ring-slate-100 text-center">
                  <span className="text-[9px] font-black text-slate-400 block mb-1">계획 완료율</span>
                  <p className="text-xl font-black text-emerald-600">{weekly.avgPlanCompletionRate}%</p>
                </Card>
              </div>

              {/* 주간 그래프 팝업 */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full h-14 rounded-2xl border-2 border-blue-100 bg-blue-50/30 hover:bg-blue-50 font-black gap-2 transition-all">
                    <BarChart3 className="h-4 w-4 text-blue-600" /> 주간 성과 정밀 그래프 분석 <Maximize2 className="h-3 w-3 opacity-30" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-lg">
                  <div className="bg-blue-600 p-8 text-white relative">
                    <DialogTitle className="text-2xl font-black tracking-tighter">주간 성과 분석</DialogTitle>
                  </div>
                  <div className="p-8 space-y-8 bg-white">
                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase text-blue-600 tracking-widest ml-1">일별 집중 시간 (분)</h4>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsLineChart data={parentDashboardMockData.charts.dailyStudyMinutes}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="date" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                            <YAxis fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} width={30} />
                            <Tooltip />
                            <Line type="monotone" dataKey="minutes" stroke="#1b64da" strokeWidth={4} dot={{ r: 4, fill: '#fff', stroke: '#1b64da', strokeWidth: 2 }} />
                          </RechartsLineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100">
                      <p className="text-[10px] font-black text-blue-600 uppercase mb-2 tracking-widest">선생님의 주간 평가</p>
                      <p className="text-sm font-bold text-slate-700 leading-relaxed">"{weekly.teacherFeedback}"</p>
                    </div>
                  </div>
                  <DialogFooter className="p-6 bg-white border-t">
                    <DialogClose asChild><Button className="w-full h-12 rounded-xl font-black">확인</Button></DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="studyDetail" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <Card className="rounded-2xl border-none shadow-sm bg-white p-6 ring-1 ring-slate-100">
                <CardTitle className="text-base font-black tracking-tight mb-6 flex items-center gap-2"><PieChartIcon className="h-4 w-4 text-blue-600" /> 과목별 학습 비중</CardTitle>
                <div className="space-y-3">
                  {subjects.slice(0, 4).map((s, i) => (
                    <div key={s.subject} className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ['#1b64da', '#10b981', '#f59e0b', '#8b5cf6'][i % 4] }} />
                          {s.subject}
                        </span>
                        <span>{s.minutes}분</span>
                      </div>
                      <Progress value={Math.min(100, Math.round((s.minutes / (totalMinutes || 1)) * 100))} className="h-1 bg-slate-50" />
                    </div>
                  ))}
                </div>
              </Card>

              {/* 시간대별 분포 팝업 */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="w-full h-12 rounded-xl font-black text-xs text-slate-400 hover:text-primary transition-all">
                    <BarChart3 className="h-4 w-4 mr-2" /> 시간대별 집중도 상세 보기
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[2rem] border-none shadow-2xl p-8 sm:max-w-md">
                  <DialogHeader><DialogTitle className="text-xl font-black mb-4">시간대별 집중 분포</DialogTitle></DialogHeader>
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={parentDashboardMockData.charts.hourlyFocus}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="hour" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} width={25} />
                        <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} />
                        <Bar dataKey="minutes" name="집중(분)" fill="#1b64da" radius={[4,4,0,0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="life" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <Card className="rounded-2xl border-none shadow-sm bg-rose-50/30 p-6 flex items-center justify-between group transition-colors">
                <div className="grid gap-1">
                  <span className="text-[10px] font-black uppercase text-rose-600 tracking-widest">현재 누적 벌점</span>
                  <h3 className="text-3xl font-black text-rose-900 tracking-tighter">{penalty}<span className="text-sm opacity-40 ml-1">점</span></h3>
                </div>
                <Badge className={cn('font-black border-none px-3 py-1', behavior.tone)}>{behavior.label}</Badge>
              </Card>

              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">최근 벌점 기록</span>
                {parentDashboardMockData.life.recentPenaltyReasons.map((r) => (
                  <div key={r.id} className="flex justify-between items-center p-4 rounded-xl bg-white border border-slate-100 shadow-sm">
                    <div className="grid gap-0.5">
                      <span className="text-sm font-bold text-slate-800">{r.reason}</span>
                      <span className="text-[10px] font-black text-slate-400">{r.dateLabel}</span>
                    </div>
                    <Badge variant="destructive" className="bg-rose-100 text-rose-700 border-none font-black">+{r.points}점</Badge>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="communication" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <Card className="rounded-2xl border-none shadow-sm bg-white p-6 ring-1 ring-slate-100">
                <CardTitle className="text-lg font-black tracking-tight mb-4">상담 및 요청사항</CardTitle>
                <div className="space-y-4">
                  <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                    <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="상담 채널 선택" /></SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      <SelectItem value="visit" className="font-bold py-3">🏫 센터 방문 상담</SelectItem>
                      <SelectItem value="phone" className="font-bold py-3">📞 전화 상담</SelectItem>
                      <SelectItem value="online" className="font-bold py-3">💻 온라인(줌) 상담</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea className="min-h-[100px] rounded-xl border-2 font-bold p-4 text-sm" value={requestText} onChange={(e) => setRequestText(e.target.value)} placeholder="요청사항이나 상담 내용을 입력해 주세요." />
                  <Button className="w-full h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 active:scale-[0.98] transition-all" onClick={() => submit('consultation')} disabled={submitting}>전달하기</Button>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="mt-0 space-y-3 animate-in fade-in duration-500">
              {notifications.length === 0 ? (
                <div className="py-20 text-center opacity-20 italic font-black text-slate-400 flex flex-col items-center gap-4">
                  <Bell className="h-12 w-12" /> 새로운 소식이 없습니다.
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={cn(
                    'rounded-2xl border p-4 flex flex-col gap-1 transition-all bg-white',
                    !readMap[n.id] ? 'border-primary/20 shadow-md ring-1 ring-primary/5' : 'border-slate-100 opacity-70'
                  )} onClick={() => setReadMap(prev => ({...prev, [n.id]: true}))}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{n.createdAtLabel}</span>
                      {n.isImportant && <Badge className="bg-rose-100 text-rose-700 border-none font-black text-[8px] h-4">중요</Badge>}
                    </div>
                    <p className="text-sm font-black text-slate-900">{n.title}</p>
                    <p className="text-xs font-bold text-slate-500 leading-snug">{n.body}</p>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/50 px-5 py-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-[11px] font-bold text-blue-900/70 leading-relaxed">
          학부모 모드는 조회 전용입니다. 정보 수정이나 설정 변경은 <br/>자녀 계정 또는 센터 관리자를 통해 가능합니다.
        </p>
      </div>
    </div>
  );
}
