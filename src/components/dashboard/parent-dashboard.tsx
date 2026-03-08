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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Textarea } from '../ui/textarea';

const tabs: { value: ParentPortalTab; label: string }[] = [
  { value: 'home', label: '홈' },
  { value: 'reports', label: '리포트' },
  { value: 'studyDetail', label: '학습 상세' },
  { value: 'life', label: '생활 관리' },
  { value: 'communication', label: '상담/소통' },
  { value: 'notifications', label: '알림' },
];

function toHm(minutes: number) {
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}

function statusByPenalty(points: number) {
  if (points >= 20) return { label: '주의', tone: 'bg-rose-50 text-rose-700 border-rose-100' };
  if (points >= 10) return { label: '보통', tone: 'bg-amber-50 text-amber-700 border-amber-100' };
  return { label: '좋음', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
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

  useEffect(() => setToday(new Date()), []);

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
  const weakSubject = subjects.length ? [...subjects].sort((a, b) => a.minutes - b.minutes)[0].subject : parentDashboardMockData.weeklyReport.weakSubject;

  const penalty = growth?.penaltyPoints || parentDashboardMockData.monthlyReport.accumulatedPenaltyPoints;
  const behavior = statusByPenalty(penalty);

  const checkIn = attendanceTime(schedulePlans, '등원');
  const checkOut = attendanceTime(schedulePlans, '하원');
  const inCenter = ['studying', 'break', 'away'].includes(attendanceCurrent?.status || '');

  const insights = [
    `오늘은 계획한 학습의 ${planRate}%를 완료했습니다.`,
    deltaMinutes >= 0 ? `어제보다 공부시간이 ${deltaMinutes}분 증가했습니다.` : `어제보다 공부시간이 ${Math.abs(deltaMinutes)}분 감소했습니다.`,
    `현재 생활 상태는 ${behavior.label === '좋음' ? '안정적' : behavior.label === '보통' ? '점검 필요' : '상담 권장'}입니다.`,
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

  async function submit(type: 'consultation' | 'request' | 'suggestion') {
    if (!firestore || !centerId || !studentId || !user) return;

    let title = '';
    let body = '';

    if (type === 'consultation') {
      title = `상담 신청 (${channel})`;
      body = requestText.trim();
      if (!body) {
        toast({ variant: 'destructive', title: '입력 필요', description: '상담 요청 내용을 입력해주세요.' });
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
        toast({ variant: 'destructive', title: '입력 필요', description: '건의사항을 입력해주세요.' });
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
      toast({ title: '등록 완료', description: '요청이 접수되었습니다.' });
      if (type === 'suggestion') setSuggestionText('');
      if (type !== 'suggestion') setRequestText('');
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '등록 실패', description: '잠시 후 다시 시도해주세요.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (!isActive) return null;
  if (!studentId) {
    return (
      <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-8 text-center space-y-2">
          <CardTitle className="text-2xl font-black">연동된 자녀가 없습니다</CardTitle>
          <p className="text-sm font-semibold text-slate-500">센터에 자녀-학부모 계정 연동을 요청해주세요.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className={cn(isMobile ? 'p-4' : 'p-6')}>
          <CardTitle className={cn('font-black tracking-tight', isMobile ? 'text-xl' : 'text-3xl')}>
            {student?.name || '자녀'} 학습 안심 리포트
          </CardTitle>
          <CardDescription className="font-semibold text-slate-500">복잡한 수치 대신 핵심 상태를 빠르게 확인할 수 있도록 구성했습니다.</CardDescription>
        </CardHeader>
        <CardContent className={cn('pt-0', isMobile ? 'px-4 pb-4' : 'px-6 pb-6')}>
          <Tabs value={tab} onValueChange={(v) => setTab(v as ParentPortalTab)}>
            <TabsList className="w-full h-auto justify-start overflow-x-auto rounded-2xl bg-slate-100 p-1">
              {tabs.map((item) => (
                <TabsTrigger key={item.value} value={item.value} className="rounded-xl px-3 py-2 text-xs font-black data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="home" className="mt-4 space-y-3">
              <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3')}>
                <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-[#1b64da]" /> 오늘 출결 상태</CardTitle></CardHeader><CardContent className="space-y-2 text-sm font-semibold text-slate-700"><div className="flex justify-between"><span>등원</span><span>{checkIn}</span></div><div className="flex justify-between"><span>하원</span><span>{checkOut}</span></div><div className="flex justify-between"><span>재실 여부</span><Badge className={inCenter ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-700 border border-slate-200'}>{inCenter ? '재실 중' : '미재실'}</Badge></div></CardContent></Card>
                <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#1b64da]" /> 오늘 공부시간</CardTitle></CardHeader><CardContent className="space-y-1"><div className="text-2xl font-black">{toHm(totalMinutes)}</div><div className="text-sm font-semibold text-slate-600">순공 {toHm(pureMinutes)}</div><div className={cn('text-xs font-bold', deltaMinutes >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{deltaMinutes >= 0 ? `+${deltaMinutes}분` : `-${Math.abs(deltaMinutes)}분`}</div></CardContent></Card>
                <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#1b64da]" /> 오늘 계획 달성률</CardTitle></CardHeader><CardContent className="space-y-2"><div className="text-2xl font-black">{planRate}%</div><div className="text-xs font-bold text-slate-500">{planDone}/{planTotal || 0} 완료</div><Progress value={planRate} className="h-2" /></CardContent></Card>
              </div>

              <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black">오늘 학습 요약</CardTitle></CardHeader><CardContent className="space-y-2 text-sm font-semibold text-slate-700"><div className="flex justify-between"><span>세션 수</span><span>{sessionCount}개</span></div><div className="flex justify-between"><span>평균 세션 길이</span><span>{avgSession}분</span></div><div className="flex justify-between"><span>주요 과목</span><span>{topSubject}</span></div></CardContent></Card>
                <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black">선생님 한 줄 피드백</CardTitle></CardHeader><CardContent className="space-y-2"><p className="text-sm font-semibold text-slate-700 leading-relaxed">{report?.content || parentDashboardMockData.feedback.daily}</p><div className="flex flex-wrap gap-2"><Badge className={behavior.tone}>생활 태도 {behavior.label}</Badge><Badge className="bg-blue-50 text-blue-700 border border-blue-100">집중력 안정</Badge></div></CardContent></Card>
              </div>

              <Card className="rounded-2xl border border-[#dbe8ff] bg-[#f8fbff]"><CardHeader className="pb-2"><CardTitle className="text-sm font-black text-[#1b64da] flex items-center gap-2"><Sparkles className="h-4 w-4" /> 해석형 요약</CardTitle></CardHeader><CardContent className="space-y-1">{insights.map((m, i) => <div key={i} className="text-sm font-semibold text-slate-700">- {m}</div>)}</CardContent></Card>
            </TabsContent>

            <TabsContent value="reports" className="mt-4 space-y-3">
              <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black">주간 리포트</CardTitle></CardHeader><CardContent className="space-y-1 text-sm font-semibold text-slate-700"><div>총 공부시간: {toHm(parentDashboardMockData.weeklyReport.totalStudyMinutes)}</div><div>일평균: {parentDashboardMockData.weeklyReport.averageDailyMinutes}분</div><div>증감률: +{parentDashboardMockData.weeklyReport.studyTimeDeltaRate}%</div><div>계획 달성률: {parentDashboardMockData.weeklyReport.avgPlanCompletionRate}%</div><div>출석률: {parentDashboardMockData.weeklyReport.attendanceRate}%</div><div>강점 과목: {parentDashboardMockData.weeklyReport.topSubject}</div><div>보완 과목: {parentDashboardMockData.weeklyReport.weakSubject}</div></CardContent></Card>
                <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black">월간 리포트</CardTitle></CardHeader><CardContent className="space-y-1 text-sm font-semibold text-slate-700"><div>총 공부시간: {toHm(parentDashboardMockData.monthlyReport.totalStudyMinutes)}</div><div>출석률: {parentDashboardMockData.monthlyReport.attendanceRate}%</div><div>평균 달성률: {parentDashboardMockData.monthlyReport.avgPlanCompletionRate}%</div><div>벌점 누적: {penalty}점</div><div>상담 횟수: {parentDashboardMockData.monthlyReport.counselingCount}회</div><div>성장 포인트: {parentDashboardMockData.monthlyReport.growthPoint}</div><div>보완 포인트: {parentDashboardMockData.monthlyReport.improvementPoint}</div></CardContent></Card>
              </div>

              <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black">일자별 공부시간 추이</CardTitle></CardHeader><CardContent className="h-52"><ResponsiveContainer width="100%" height="100%"><RechartsLineChart data={parentDashboardMockData.charts.dailyStudyMinutes}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="minutes" stroke="#1B64DA" strokeWidth={2.5} /></RechartsLineChart></ResponsiveContainer></CardContent></Card>
                <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black">계획 달성률 추이</CardTitle></CardHeader><CardContent className="h-52"><ResponsiveContainer width="100%" height="100%"><RechartsLineChart data={parentDashboardMockData.charts.planCompletionTrend}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis domain={[0,100]} tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="rate" stroke="#0EA5E9" strokeWidth={2.5} /></RechartsLineChart></ResponsiveContainer></CardContent></Card>
              </div>

              <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black">과목별 학습 비중</CardTitle></CardHeader><CardContent className="h-52"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={parentDashboardMockData.charts.subjectShare} dataKey="minutes" nameKey="subject" innerRadius={42} outerRadius={76}>{parentDashboardMockData.charts.subjectShare.map((s) => <Cell key={s.subject} fill={s.color} />)}</Pie><Tooltip formatter={(v) => `${v}분`} /></PieChart></ResponsiveContainer></CardContent></Card>
                <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black">출결/벌점 변화</CardTitle></CardHeader><CardContent className="h-52"><ResponsiveContainer width="100%" height="100%"><BarChart data={parentDashboardMockData.charts.attendancePenaltyTrend}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="week" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="attendanceRate" fill="#1B64DA" radius={[8,8,0,0]} /><Bar dataKey="penalty" fill="#F97316" radius={[8,8,0,0]} /></BarChart></ResponsiveContainer></CardContent></Card>
              </div>

              <Card className="rounded-2xl border border-[#dbe8ff] bg-[#f8fbff]"><CardHeader className="pb-2"><CardTitle className="text-sm font-black text-[#1b64da]">AI 해석</CardTitle></CardHeader><CardContent className="space-y-1">{parentDashboardMockData.aiInsights.map((m, i) => <div key={i} className="text-sm font-semibold text-slate-700">- {m}</div>)}</CardContent></Card>
            </TabsContent>

            <TabsContent value="studyDetail" className="mt-4 space-y-3">
              <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black">학습 상세 요약</CardTitle></CardHeader><CardContent className="text-sm font-semibold text-slate-700">오늘 {toHm(totalMinutes)} 학습, {sessionCount}세션, 계획 {planDone}/{planTotal || 0} 완료</CardContent></Card>
              <details className="rounded-2xl border border-slate-200 bg-white p-4" open><summary className="cursor-pointer font-black text-sm">공부 세션 기록</summary><div className="mt-3 space-y-2">{(sessions && sessions.length ? sessions : parentDashboardMockData.charts.dailyStudyMinutes.map((d, i) => ({ id: `m-${i}`, durationMinutes: Math.round(d.minutes / 3) } as any))).map((s, i) => <div key={s.id || i} className="flex justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><span>세션 {i + 1}</span><span>{s.durationMinutes}분</span></div>)}</div></details>
              <details className="rounded-2xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-black text-sm">과목별 공부시간</summary><div className="mt-3 space-y-2">{subjects.map((s) => <div key={s.subject} className="space-y-1"><div className="flex justify-between text-sm font-semibold text-slate-700"><span>{s.subject}</span><span>{s.minutes}분</span></div><Progress value={Math.min(100, Math.round((s.minutes / Math.max(1, subjects[0]?.minutes || 1)) * 100))} className="h-2" /></div>)}</div></details>
              <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black">시간대별 학습 분포</CardTitle></CardHeader><CardContent className="h-52"><ResponsiveContainer width="100%" height="100%"><BarChart data={parentDashboardMockData.charts.hourlyFocus}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="hour" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="minutes" fill="#1B64DA" radius={[8,8,0,0]} /></BarChart></ResponsiveContainer></CardContent></Card>
            </TabsContent>

            <TabsContent value="life" className="mt-4 space-y-3">
              <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-rose-500" /> 벌점 현황</CardTitle></CardHeader><CardContent className="space-y-2"><div className="text-3xl font-black">{penalty}점</div><Badge className={behavior.tone}>상태: {behavior.label}</Badge></CardContent></Card>
                <Card className="rounded-2xl border border-slate-200 lg:col-span-2"><CardHeader className="pb-2"><CardTitle className="text-sm font-black">최근 2주 생활관리 변화</CardTitle></CardHeader><CardContent className="h-52"><ResponsiveContainer width="100%" height="100%"><RechartsLineChart data={parentDashboardMockData.charts.lifeTrend2Weeks}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="behaviorScore" stroke="#1B64DA" strokeWidth={2.5} /><Line type="monotone" dataKey="penalty" stroke="#F97316" strokeWidth={2.5} /></RechartsLineChart></ResponsiveContainer></CardContent></Card>
              </div>
              <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black">최근 벌점 사유</CardTitle></CardHeader><CardContent className="space-y-2">{parentDashboardMockData.life.recentPenaltyReasons.map((r) => <div key={r.id} className="flex justify-between rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700"><span>{r.reason}</span><span>{r.points}점 · {r.dateLabel}</span></div>)}</CardContent></Card>
                <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black">출결/이탈 기록</CardTitle></CardHeader><CardContent className="space-y-2 text-sm font-semibold text-slate-700">{parentDashboardMockData.life.attendanceEvents.map((a) => <div key={a.id} className="flex justify-between rounded-xl border border-slate-200 p-3"><span>{a.label}</span><span>{a.dateLabel}</span></div>)}<div className="rounded-xl bg-slate-50 p-3">무단이탈 {parentDashboardMockData.life.unauthorizedExitCount2Weeks}회 · 장시간 자리비움 {parentDashboardMockData.life.longAwayCount2Weeks}회</div></CardContent></Card>
              </div>
            </TabsContent>

            <TabsContent value="communication" className="mt-4 space-y-3">
              <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black">상담 신청</CardTitle></CardHeader><CardContent className="space-y-3"><Select value={channel} onValueChange={(v) => setChannel(v as any)}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="visit">방문 상담</SelectItem><SelectItem value="phone">전화 상담</SelectItem><SelectItem value="online">온라인 상담</SelectItem></SelectContent></Select><Textarea className="min-h-[100px] rounded-xl" value={requestText} onChange={(e) => setRequestText(e.target.value)} placeholder="상담 요청 내용을 입력해주세요." /><Button className="w-full h-11 rounded-xl font-black" onClick={() => submit('consultation')} disabled={submitting}>상담 신청</Button></CardContent></Card>
                <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black">요청사항 전달</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-2">{(Object.keys(parentDashboardMockData.quickRequestTemplates) as ParentQuickRequestKey[]).map((k) => <Button key={k} type="button" variant={quickType === k ? 'default' : 'outline'} className="h-10 rounded-xl text-xs font-black" onClick={() => { setQuickType(k); setRequestText(parentDashboardMockData.quickRequestTemplates[k]); }}>{parentDashboardMockData.quickRequestTemplates[k]}</Button>)}</div><Textarea className="min-h-[100px] rounded-xl" value={requestText} onChange={(e) => setRequestText(e.target.value)} placeholder="요청사항을 입력해주세요." /><Button className="w-full h-11 rounded-xl font-black" onClick={() => submit('request')} disabled={submitting}><Send className="h-4 w-4 mr-1" /> 요청 전송</Button></CardContent></Card>
              </div>
              <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><CardTitle className="text-sm font-black">건의사항</CardTitle></CardHeader><CardContent className="space-y-3"><Textarea className="min-h-[100px] rounded-xl" value={suggestionText} onChange={(e) => setSuggestionText(e.target.value)} placeholder="건의사항을 입력해주세요." /><Button className="h-11 rounded-xl font-black" onClick={() => submit('suggestion')} disabled={submitting}>건의사항 등록</Button></CardContent></Card>
              <Card className="rounded-2xl border border-slate-200 bg-slate-50"><CardHeader className="pb-2"><CardTitle className="text-sm font-black">선생님 피드백 열람</CardTitle></CardHeader><CardContent className="space-y-2 text-sm font-semibold text-slate-700"><div>- 일일: {parentDashboardMockData.feedback.daily}</div><div>- 주간: {parentDashboardMockData.feedback.weekly}</div><div>- 월간: {parentDashboardMockData.feedback.monthly}</div></CardContent></Card>
            </TabsContent>

            <TabsContent value="notifications" className="mt-4 space-y-3">
              <Card className="rounded-2xl border border-slate-200"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-black flex items-center gap-2"><Bell className="h-4 w-4 text-[#1b64da]" /> 알림 목록</CardTitle><Badge className="bg-[#eaf2ff] text-[#1b64da] border border-[#dbe8ff]">안읽음 {unreadCount}</Badge></div></CardHeader><CardContent className="space-y-2">{notifications.map((n) => { const isRead = !!readMap[n.id]; return <div key={n.id} className={cn('rounded-xl border p-3 flex items-start justify-between gap-3', n.isImportant ? 'border-[#dbe8ff] bg-[#f8fbff]' : 'border-slate-200 bg-white')}><div className="space-y-1"><div className="flex items-center gap-2">{!isRead && <span className="h-2 w-2 rounded-full bg-[#1b64da]" />}<p className="text-sm font-black text-slate-900">{n.title}</p>{n.isImportant && <Badge className="bg-rose-50 text-rose-700 border border-rose-100">중요</Badge>}</div><p className="text-sm font-semibold text-slate-600">{n.body}</p><p className="text-xs font-bold text-slate-400">{n.createdAtLabel}</p></div><Button variant="ghost" className="h-8 px-2 text-xs font-black" onClick={() => setReadMap((prev) => ({ ...prev, [n.id]: !isRead }))}>{isRead ? '안읽음' : '읽음'}</Button></div>; })}</CardContent></Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-500">
        부모님 계정은 읽기 중심 권한이며, 상담 신청/요청사항/건의사항 작성만 허용됩니다.
      </div>
    </div>
  );
}
