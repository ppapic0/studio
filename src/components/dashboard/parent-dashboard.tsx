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
  Info
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

const tabs: { value: ParentPortalTab; label: string }[] = [
  { value: 'home', label: '홈' },
  { value: 'reports', label: '분석 리포트' },
  { value: 'studyDetail', label: '학습 상세' },
  { value: 'life', label: '생활 관리' },
  { value: 'communication', label: '소통/상담' },
  { value: 'notifications', label: '알림' },
];

const tabMeta: Record<ParentPortalTab, { title: string; description: string }> = {
  home: { title: '오늘의 학습 스냅샷', description: '자녀의 현재 위치와 학습 현황을 실시간으로 확인합니다.' },
  reports: { title: '성장 분석 리포트', description: '주간 및 월간 학습 추이를 시각화하여 제공합니다.' },
  studyDetail: { title: '과목별 학습 상세', description: '어떤 과목을 얼마나 집중해서 공부했는지 분석합니다.' },
  life: { title: '생활 및 태도 관리', description: '출결 이력과 벌점 등 생활 태도를 종합 관리합니다.' },
  communication: { title: '선생님과 소통하기', description: '상담 예약이나 요청사항을 간편하게 전달합니다.' },
  notifications: { title: '중요 알림 내역', description: '센터에서 보낸 알림과 리포트 소식을 모아봅니다.' },
};

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
  const schedulePlans = (todayPlans || []).filter((item) => item.category === 'schedule');

  const totalMinutes = todayLog?.totalMinutes || 0;
  const pureMinutes = Math.round(totalMinutes * 0.86);
  const yesterdayMinutes = yesterdayLog?.totalMinutes || 0;
  const deltaMinutes = totalMinutes - yesterdayMinutes;

  const planTotal = studyPlans.length;
  const planDone = studyPlans.filter((item) => item.done).length;
  const planRate = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;

  const sessionCount = sessions?.length || 0;
  const avgSession = sessionCount > 0 ? Math.round(totalMinutes / sessionCount) : 0;

  const subjects = useMemo(() => {
    const map = new Map<string, number>();
    parentDashboardMockData.charts.subjectShare.forEach((item) => map.set(item.subject, item.minutes));
    studyPlans.forEach((plan) => {
      if (!plan.subject || !plan.targetMinutes) return;
      map.set(plan.subject, (map.get(plan.subject) || 0) + plan.targetMinutes);
    });
    return [...map.entries()].map(([subject, minutes]) => ({ subject, minutes }));
  }, [studyPlans]);

  const topSubject = subjects.length ? [...subjects].sort((a, b) => b.minutes - a.minutes)[0].subject : parentDashboardMockData.weeklyReport.topSubject;

  const penalty = growth?.penaltyPoints || parentDashboardMockData.monthlyReport.accumulatedPenaltyPoints;
  const behavior = statusByPenalty(penalty);

  const checkIn = attendanceTime(schedulePlans, '등원');
  const checkOut = attendanceTime(schedulePlans, '하원');
  const inCenter = ['studying', 'break', 'away'].includes(attendanceCurrent?.status || '');

  const insights = [
    `오늘은 계획한 학습의 ${planRate}%를 달성했습니다.`,
    deltaMinutes >= 0 ? `어제보다 공부시간이 ${deltaMinutes}분 늘어났습니다.` : `어제보다 공부시간이 ${Math.abs(deltaMinutes)}분 줄어들었습니다.`,
    `현재 생활 태도는 ${behavior.label} 상태로 유지되고 있습니다.`,
  ];

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

  useEffect(() => {
    const next: Record<string, boolean> = {};
    notifications.forEach((item) => (next[item.id] = item.isRead));
    setReadMap(next);
  }, [notifications]);

  const unreadCount = notifications.filter((item) => !readMap[item.id]).length;
  const weekly = parentDashboardMockData.weeklyReport;
  const monthly = parentDashboardMockData.monthlyReport;

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
      if (!body) {
        toast({ variant: 'destructive', title: '입력 확인', description: '상담 요청 내용을 입력해주세요.' });
        return;
      }
    }

    if (type === 'request') {
      title = parentDashboardMockData.quickRequestTemplates[quickType];
      body = requestText.trim() || title;
    }

    if (type === 'suggestion') {
      title = '건의사항';
      body = suggestionText.trim();
      if (!body) {
        toast({ variant: 'destructive', title: '입력 확인', description: '건의사항을 입력해주세요.' });
        return;
      }
    }

    setSubmitting(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'parentCommunications'), {
        studentId,
        parentUid: user.uid,
        parentName: user.displayName || '학부모',
        type,
        title,
        body,
        channel: type === 'consultation' ? channel : null,
        status: 'requested',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast({ title: '전송 완료', description: '선생님께 요청이 정상적으로 전달되었습니다.' });
      if (type === 'suggestion') setSuggestionText('');
      if (type !== 'suggestion') setRequestText('');
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '전송 실패', description: '통신 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (!isActive) return null;
  if (!studentId) {
    return (
      <Card className="overflow-hidden rounded-[2.5rem] border border-[#d9e3fb] bg-white shadow-2xl">
        <div className="h-2 w-full bg-[linear-gradient(90deg,#FF7A16_0%,#14295F_100%)]" />
        <CardContent className="p-12 text-center space-y-4">
          <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCheck className="h-10 w-10 text-slate-300" />
          </div>
          <CardTitle className="text-3xl font-black tracking-tight">연동된 자녀가 없습니다</CardTitle>
          <p className="text-base font-bold text-slate-500 max-w-xs mx-auto leading-relaxed">센터에서 제공한 자녀 코드를 사용하여 계정을 연동해 주세요.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6 pb-24", isMobile ? "px-1" : "max-w-5xl mx-auto")}>
      <Card className="overflow-hidden rounded-[2.5rem] border border-slate-200/60 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
        <div className="h-2 w-full bg-[linear-gradient(90deg,#FF7A16_0%,#14295F_100%)]" />
        <CardHeader className={cn(isMobile ? 'p-6' : 'p-10')}>
          <div className="flex items-center justify-between gap-3 mb-6">
            <TrackLogo className={cn(isMobile ? 'h-10' : 'h-12')} />
            <Badge className="rounded-full bg-primary/5 text-primary border-primary/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest">Parent Portal</Badge>
          </div>
          <div className="flex flex-col gap-1">
            <CardTitle className={cn('font-black tracking-tighter text-slate-900', isMobile ? 'text-3xl' : 'text-5xl')}>
              {student?.name || '자녀'} 학생 <span className="text-primary/40 font-bold">리포트</span>
            </CardTitle>
            <CardDescription className="font-bold text-slate-500 text-sm sm:text-base mt-2">오늘의 핵심 성과와 생활 지표를 분석합니다.</CardDescription>
          </div>
        </CardHeader>

        <CardContent className={cn('pt-0', isMobile ? 'px-6 pb-6' : 'px-10 pb-10')}>
          <Tabs value={tab} onValueChange={handleTabChange}>
            <div className="flex items-center justify-between mb-6 bg-slate-50/80 p-2 rounded-2xl border border-slate-100">
              <div className="grid leading-tight pl-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">{tab.toUpperCase()}</p>
                <p className="text-sm font-black text-slate-800">{tabMeta[tab].title}</p>
              </div>
              {tab === 'notifications' && unreadCount > 0 && (
                <Badge className="bg-rose-500 text-white border-none font-black text-[10px] animate-pulse">새 소식 {unreadCount}</Badge>
              )}
            </div>

            <TabsContent value="home" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                <Card className="rounded-[2rem] border-none shadow-sm bg-blue-50/30 p-6 flex flex-col justify-between group hover:bg-blue-50 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-black uppercase text-blue-600 tracking-widest">공부 시간</span>
                    <Clock3 className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="grid gap-1">
                    <h3 className="text-3xl font-black text-blue-900 tracking-tighter leading-none">{toHm(totalMinutes)}</h3>
                    <p className={cn('text-xs font-bold mt-1', deltaMinutes >= 0 ? 'text-emerald-600' : 'text-rose-600')}>어제 대비 {deltaMinutes >= 0 ? '+' : ''}{deltaMinutes}분</p>
                  </div>
                </Card>

                <Card className="rounded-[2rem] border-none shadow-sm bg-emerald-50/30 p-6 flex flex-col justify-between group hover:bg-emerald-50 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">계획 달성률</span>
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="grid gap-2">
                    <h3 className="text-3xl font-black text-emerald-900 tracking-tighter leading-none">{planRate}%</h3>
                    <Progress value={planRate} className="h-1.5 bg-emerald-100" />
                  </div>
                </Card>

                <Card className="rounded-[2rem] border-none shadow-sm bg-amber-50/30 p-6 flex flex-col justify-between group hover:bg-amber-50 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-black uppercase text-amber-600 tracking-widest">현재 상태</span>
                    <Activity className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="grid gap-1">
                    <h3 className="text-3xl font-black text-amber-900 tracking-tighter leading-none">{inCenter ? '입실 중' : '미재실'}</h3>
                    <p className="text-xs font-bold text-amber-700/60 uppercase">Real-time Status</p>
                  </div>
                </Card>
              </div>

              <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                <Card className="rounded-[2rem] border-none shadow-sm bg-white p-8 ring-1 ring-slate-100">
                  <CardTitle className="text-lg font-black tracking-tight mb-6 flex items-center gap-2"><Flame className="h-5 w-5 text-rose-500" /> 오늘 학습 결과</CardTitle>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="text-sm font-bold text-slate-600">집중 세션</span>
                      <span className="text-base font-black text-slate-900">{sessionCount}회 진행</span>
                    </div>
                    <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="text-sm font-bold text-slate-600">주요 집중 과목</span>
                      <Badge className="bg-primary text-white border-none font-black">{topSubject}</Badge>
                    </div>
                    <div className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="text-sm font-bold text-slate-600">생활 지표</span>
                      <Badge className={cn('font-black border-none', behavior.tone)}>{behavior.label}</Badge>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-[2rem] border-none shadow-sm bg-[#fafafa] p-8 ring-1 ring-slate-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12"><MessageCircle className="h-32 w-32" /></div>
                  <CardTitle className="text-lg font-black tracking-tight mb-6 flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500" /> 선생님의 분석 코멘트</CardTitle>
                  <div className="p-6 rounded-[1.5rem] bg-white border border-slate-200 shadow-sm relative z-10 min-h-[140px] flex flex-col justify-center">
                    <p className="text-sm font-bold text-slate-700 leading-relaxed break-keep">
                      "{report?.content || parentDashboardMockData.feedback.daily}"
                    </p>
                  </div>
                </Card>
              </div>

              <Card className="rounded-[2.5rem] border-none shadow-sm bg-[linear-gradient(135deg,#fff8f0_0%,#f3f7ff_100%)] p-8 ring-1 ring-blue-100/50">
                <CardHeader className="p-0 mb-6">
                  <CardTitle className="text-sm font-black text-[#14295F] flex items-center gap-2 uppercase tracking-widest"><TrendingUp className="h-4 w-4" /> AI 학습 인사이트 요약</CardTitle>
                </CardHeader>
                <CardContent className="p-0 space-y-3">
                  {insights.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white/60 p-3 rounded-xl border border-white/40 shadow-sm">
                      <div className="h-2 w-2 rounded-full bg-blue-500 shadow-sm" />
                      <p className="text-sm font-bold text-slate-700">{m}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports" className="mt-0 space-y-6 animate-in fade-in duration-500">
              <div className={cn('grid gap-4', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
                {[
                  { label: '주간 학습 총량', val: toHm(weekly.totalStudyMinutes), sub: `${weekly.studyTimeDeltaRate}% 성장`, color: 'text-blue-600' },
                  { label: '주간 계획 완료', val: `${weekly.avgPlanCompletionRate}%`, sub: `총 ${planTotal}개 과제`, color: 'text-emerald-600' },
                  { label: '출석 및 근태', val: `${monthly.attendanceRate}%`, sub: `지각 ${weekly.lateCount}회`, color: 'text-amber-600' },
                  { label: '생활 관리 점수', val: behavior.label, sub: `누적 벌점 ${penalty}점`, color: behavior.color }
                ].map((item, i) => (
                  <Card key={i} className="rounded-2xl border-none shadow-sm bg-white p-5 ring-1 ring-slate-100 flex flex-col justify-center text-center">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">{item.label}</p>
                    <p className={cn("text-xl font-black tracking-tight", item.color)}>{item.val}</p>
                    <p className="mt-1 text-[10px] font-bold text-slate-500">{item.sub}</p>
                  </Card>
                ))}
              </div>

              <div className={cn('grid gap-6', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-slate-100">
                  <CardHeader className="bg-slate-50/50 border-b p-8 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-black tracking-tighter">주간 성과 정밀 분석</CardTitle>
                    <Badge className="bg-blue-100 text-blue-700 border-none font-black text-[10px] px-3">WEEKLY</Badge>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                    <div className="h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsLineChart data={parentDashboardMockData.charts.dailyStudyMinutes}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="date" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                          <YAxis fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} width={30} />
                          <Tooltip contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)'}} />
                          <Line type="monotone" dataKey="minutes" name="공부시간(분)" stroke="#1b64da" strokeWidth={4} dot={{ r: 4, fill: '#fff', stroke: '#1b64da', strokeWidth: 2 }} />
                        </RechartsLineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-100">
                      <p className="text-[10px] font-black text-blue-600 uppercase mb-2 tracking-widest">Teacher's Insight</p>
                      <p className="text-sm font-bold text-slate-700 leading-relaxed">"{weekly.teacherFeedback}"</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-slate-100">
                  <CardHeader className="bg-amber-50/50 border-b p-8 flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-black tracking-tighter">월간 성실도 변화</CardTitle>
                    <Badge className="bg-amber-100 text-amber-700 border-none font-black text-[10px] px-3">MONTHLY</Badge>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                    <div className="h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={parentDashboardMockData.charts.attendancePenaltyTrend}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="week" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                          <YAxis fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} width={30} />
                          <Tooltip contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)'}} />
                          <Bar dataKey="attendanceRate" name="출석률(%)" fill="#1b64da" radius={[6,6,0,0]} barSize={20} />
                          <Bar dataKey="penalty" name="벌점" fill="#f59e0b" radius={[6,6,0,0]} barSize={20} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-4 rounded-xl text-center"><span className="text-[9px] font-black text-slate-400 block mb-1">성장 포인트</span><span className="text-xs font-bold text-slate-700">{monthly.growthPoint}</span></div>
                      <div className="bg-slate-50 p-4 rounded-xl text-center"><span className="text-[9px] font-black text-slate-400 block mb-1">보완 포인트</span><span className="text-xs font-bold text-slate-700">{monthly.improvementPoint}</span></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="studyDetail" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <Card className="rounded-[2rem] border-none shadow-sm bg-white p-8 ring-1 ring-slate-100">
                <CardTitle className="text-lg font-black tracking-tight mb-8 flex items-center gap-2"><PieChartIcon className="h-5 w-5 text-blue-600" /> 과목별 학습 비중</CardTitle>
                <div className={cn("grid gap-8 items-center", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={subjects} dataKey="minutes" nameKey="subject" innerRadius={60} outerRadius={90} paddingAngle={5}>
                          {subjects.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#1b64da', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][index % 5]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value}분`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-4">
                    {subjects.map((s, i) => (
                      <div key={s.subject} className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-sm font-bold text-slate-700">
                          <span className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#1b64da', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][i % 5] }} />
                            {s.subject}
                          </span>
                          <span>{s.minutes}분</span>
                        </div>
                        <Progress value={Math.min(100, Math.round((s.minutes / (totalMinutes || 1)) * 100))} className="h-1 bg-slate-100" />
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card className="rounded-[2rem] border-none shadow-sm bg-white p-8 ring-1 ring-slate-100">
                <CardTitle className="text-lg font-black tracking-tight mb-6"><BarChart3 className="h-5 w-5 text-primary inline-block mr-2" /> 시간대별 집중도 분포</CardTitle>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={parentDashboardMockData.charts.hourlyFocus}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="hour" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} width={25} />
                      <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} />
                      <Bar dataKey="minutes" name="집중(분)" fill="#1b64da" radius={[6,6,0,0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="life" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                <Card className="rounded-[2rem] border-none shadow-sm bg-rose-50/30 p-8 flex flex-col items-center text-center gap-2">
                  <ShieldAlert className="h-10 w-10 text-rose-500 mb-2" />
                  <span className="text-[10px] font-black uppercase text-rose-600 tracking-widest">현재 벌점</span>
                  <h3 className="text-5xl font-black text-rose-900 tracking-tighter leading-none">{penalty}<span className="text-xl opacity-40 ml-1">점</span></h3>
                  <Badge className={cn('mt-2 font-black border-none', behavior.tone)}>{behavior.label}</Badge>
                </Card>

                <Card className="rounded-[2rem] border-none shadow-sm bg-white p-8 lg:col-span-2 ring-1 ring-slate-100">
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">최근 벌점 사유 히스토리</CardTitle>
                  <div className="space-y-3">
                    {parentDashboardMockData.life.recentPenaltyReasons.map((r) => (
                      <div key={r.id} className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border border-slate-100 group hover:bg-rose-50 hover:border-rose-100 transition-all">
                        <div className="grid gap-0.5">
                          <span className="text-sm font-bold text-slate-800 group-hover:text-rose-900">{r.reason}</span>
                          <span className="text-[10px] font-black text-slate-400">{r.dateLabel}</span>
                        </div>
                        <Badge variant="destructive" className="bg-rose-100 text-rose-700 border-none font-black">+{r.points}점</Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <Card className="rounded-[2rem] border-none shadow-sm bg-white p-8 ring-1 ring-slate-100">
                <CardTitle className="text-lg font-black tracking-tight mb-6">출결 및 이탈 사고 기록</CardTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  {parentDashboardMockData.life.attendanceEvents.map((a) => (
                    <div key={a.id} className="flex justify-between items-center p-4 rounded-2xl border border-slate-100 bg-[#fafafa]">
                      <span className="text-sm font-bold text-slate-700">{a.label}</span>
                      <span className="text-xs font-black text-slate-400">{a.dateLabel}</span>
                    </div>
                  ))}
                  <div className="col-span-full p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-blue-900">최근 2주 무단 이탈 / 장기 자리 비움</span>
                    <Badge className="bg-blue-600 text-white font-black">{parentDashboardMockData.life.unauthorizedExitCount2Weeks + parentDashboardMockData.life.longAwayCount2Weeks}회</Badge>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="communication" className="mt-0 space-y-6 animate-in fade-in duration-500">
              <div className={cn('grid gap-6', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-slate-100">
                  <div className="bg-primary/5 w-12 h-12 rounded-2xl flex items-center justify-center mb-6"><MessageCircle className="h-6 w-6 text-primary" /></div>
                  <CardTitle className="text-xl font-black tracking-tight mb-2">상담 신청하기</CardTitle>
                  <CardDescription className="font-bold mb-6">원하시는 상담 채널을 선택해 주세요.</CardDescription>
                  <div className="space-y-4">
                    <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="visit" className="font-bold py-3">🏫 센터 방문 상담</SelectItem>
                        <SelectItem value="phone" className="font-bold py-3">📞 전화 상담</SelectItem>
                        <SelectItem value="online" className="font-bold py-3">💻 온라인(줌) 상담</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea className="min-h-[120px] rounded-2xl border-2 font-bold p-4 focus-visible:ring-primary/20" value={requestText} onChange={(e) => setRequestText(e.target.value)} placeholder="구체적인 상담 주제나 궁금하신 점을 남겨주세요." />
                    <Button className="w-full h-14 rounded-2xl bg-primary text-white font-black text-lg shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all" onClick={() => submit('consultation')} disabled={submitting}>상담 신청 완료</Button>
                  </div>
                </Card>

                <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-slate-100">
                  <div className="bg-amber-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-6"><Send className="h-6 w-6 text-amber-600" /></div>
                  <CardTitle className="text-xl font-black tracking-tight mb-2">빠른 요청사항</CardTitle>
                  <CardDescription className="font-bold mb-6">자녀를 위한 지원 사항을 빠르게 전달하세요.</CardDescription>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(parentDashboardMockData.quickRequestTemplates) as ParentQuickRequestKey[]).map((k) => (
                        <Button key={k} type="button" variant={quickType === k ? 'default' : 'outline'} className={cn("h-12 rounded-xl text-xs font-black transition-all", quickType === k ? "bg-amber-500 hover:bg-amber-600" : "border-2")} onClick={() => { setQuickType(k); setRequestText(parentDashboardMockData.quickRequestTemplates[k]); }}>{parentDashboardMockData.quickRequestTemplates[k]}</Button>
                      ))}
                    </div>
                    <Textarea className="min-h-[120px] rounded-2xl border-2 font-bold p-4" value={requestText} onChange={(e) => setRequestText(e.target.value)} placeholder="추가적인 요청사항을 입력해 주세요." />
                    <Button className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black text-lg shadow-xl hover:scale-[1.02] transition-all" onClick={() => submit('request')} disabled={submitting}>요청 전송하기</Button>
                  </div>
                </Card>
              </div>

              <Card className="rounded-[2.5rem] border-none shadow-lg bg-emerald-50/20 p-8 ring-1 ring-emerald-100/50">
                <CardTitle className="text-lg font-black tracking-tight mb-6 flex items-center gap-2"><Info className="h-5 w-5 text-emerald-600" /> 센터 건의사항</CardTitle>
                <div className="flex gap-3">
                  <Textarea className="flex-1 rounded-2xl border-2 font-bold bg-white" value={suggestionText} onChange={(e) => setSuggestionText(e.target.value)} placeholder="시설 이용이나 운영에 대한 의견을 자유롭게 남겨주세요." />
                  <Button className="h-auto w-24 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700" onClick={() => submit('suggestion')} disabled={submitting}>등록</Button>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <div className="grid gap-3">
                {notifications.length === 0 ? (
                  <div className="py-24 text-center opacity-20 italic font-black text-slate-400 flex flex-col items-center gap-4">
                    <Bell className="h-16 w-16" />
                    새로운 알림이 없습니다.
                  </div>
                ) : (
                  notifications.map((n) => {
                    const isRead = !!readMap[n.id];
                    return (
                      <div key={n.id} className={cn(
                        'rounded-[1.5rem] border p-5 flex items-start justify-between gap-4 transition-all',
                        n.isImportant ? 'border-primary/20 bg-primary/5 shadow-sm' : 'border-slate-100 bg-white hover:bg-slate-50',
                        !isRead && 'ring-2 ring-primary/10'
                      )}>
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            {!isRead && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                            <p className="text-sm font-black text-slate-900">{n.title}</p>
                            {n.isImportant && <Badge className="bg-rose-100 text-rose-700 border-none font-black text-[8px] h-4 px-1.5 uppercase">중요</Badge>}
                          </div>
                          <p className="text-sm font-bold text-slate-600 leading-relaxed">{n.body}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{n.createdAtLabel}</p>
                        </div>
                        <Button variant="ghost" className="h-10 px-3 text-[10px] font-black text-slate-400 hover:text-primary shrink-0" onClick={() => setReadMap((prev) => ({ ...prev, [n.id]: !isRead }))}>
                          {isRead ? '안읽음 처리' : '읽음 표시'}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50/50 px-6 py-4 flex items-center gap-3">
        <div className="p-2 rounded-full bg-white shadow-sm"><Info className="h-4 w-4 text-blue-600" /></div>
        <p className="text-[11px] font-bold text-blue-900/70 leading-snug">
          학부모 계정은 실시간 학습 현황 및 리포트 조회 전용입니다. <br/>
          학습 내용 수정이나 출결 조작은 센터 관리자만 가능합니다.
        </p>
      </div>
    </div>
  );
}
