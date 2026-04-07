'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, LogIn, MousePointerClick, Smartphone } from 'lucide-react';
import { format } from 'date-fns';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useAuth } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type WebsiteEntryEvent = {
  id: string;
  eventType?: 'entry_click' | 'page_view' | 'login_success' | null;
  pageType?: 'landing' | 'experience' | 'login' | null;
  target?: 'login' | 'experience' | null;
  placement?: string | null;
  mode?: string | null;
  view?: string | null;
  sessionId?: string | null;
  visitorId?: string | null;
  createdAt?: string | null; // ISO string from API
};

type VisitTrendPoint = {
  dateKey: string;
  label: string;
  visits: number;
};

function toDateMs(value: unknown): number {
  if (!value) return 0;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function formatDateTime(value: unknown) {
  const ms = toDateMs(value);
  if (!ms) return '-';
  return format(new Date(ms), 'MM.dd HH:mm');
}

function placementLabel(value?: string | null) {
  const map: Record<string, string> = {
    header: '헤더',
    hero_login: '메인 로그인 버튼',
    hero_experience: '메인 체험 버튼',
    hero_student_demo: '학생 체험 카드',
    hero_parent_demo: '학부모 체험 카드',
    app_section: '앱 소개 섹션',
    footer: '푸터',
    consult_section: '상담 섹션',
    experience_page: '체험 페이지',
    feature_card: '\uAE30\uB2A5 \uCE74\uB4DC',
    experience_header: '\uCCB4\uD5D8 \uD398\uC774\uC9C0 \uD5E4\uB354',
    experience_hero_student: '\uCCB4\uD5D8 \uD788\uC5B4\uB85C(\uD559\uC0DD)',
    data_preview_cta: '\uB370\uC774\uD130 \uBBF8\uB9AC\uBCF4\uAE30 \uBC84\uD2BC',
  };

  if (!value) return '기타';
  return map[value] || value;
}

export function WebsiteEntryAnalytics({ centerId }: { centerId?: string }) {
  const auth = useAuth();
  const [events, setEvents] = useState<WebsiteEntryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [visitPeriod, setVisitPeriod] = useState<1 | 7 | 30>(7);

  useEffect(() => {
    if (!centerId || !auth) return;

    let cancelled = false;
    setIsLoading(true);

    const fetchEvents = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        const token = await currentUser.getIdToken();

        const params = new URLSearchParams({ centerId });
        const res = await fetch(`/api/website-analytics?${params.toString()}`, {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { events: WebsiteEntryEvent[] };

        if (!cancelled) {
          const sorted = json.events.sort(
            (a, b) => toDateMs(b.createdAt) - toDateMs(a.createdAt),
          );
          setEvents(sorted);
        }
      } catch (error) {
        console.error('[website-analytics] fetch failed', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void fetchEvents();
    return () => { cancelled = true; };
  }, [centerId, auth]);

  const summary = useMemo(() => {
    const pageViewEvents = events.filter((event) => event.eventType === 'page_view');
    const landingViews = pageViewEvents.filter((event) => event.pageType === 'landing');
    const experienceViews = pageViewEvents.filter((event) => event.pageType === 'experience');
    const loginClickEvents = events.filter(
      (event) => event.eventType === 'entry_click' && event.target === 'login',
    );
    const experienceClickEvents = events.filter(
      (event) => event.eventType === 'entry_click' && event.target === 'experience',
    );
    const loginSuccessEvents = events.filter((event) => event.eventType === 'login_success');
    const placementCount = new Map<string, number>();
    const loginClickSessions = new Set(
      loginClickEvents
        .map((event) => event.sessionId)
        .filter((sessionId): sessionId is string => !!sessionId),
    );
    const loginSuccessSessions = new Set(
      loginSuccessEvents
        .map((event) => event.sessionId)
        .filter((sessionId): sessionId is string => !!sessionId),
    );
    const convertedSessions = Array.from(loginClickSessions).filter((sessionId) =>
      loginSuccessSessions.has(sessionId),
    ).length;

    events
      .filter((event) => event.eventType === 'entry_click')
      .forEach((event) => {
      const label = placementLabel(event.placement);
      placementCount.set(label, (placementCount.get(label) || 0) + 1);
    });

    const topPlacements = Array.from(placementCount.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const totalEntryClicks = events.filter((event) => event.eventType === 'entry_click').length;

    return {
      totalEvents: events.length,
      totalEntryClicks,
      landingViews: landingViews.length,
      experienceViews: experienceViews.length,
      loginClickCount: loginClickEvents.length,
      experienceClickCount: experienceClickEvents.length,
      loginSuccessCount: loginSuccessEvents.length,
      convertedSessions,
      conversionRate:
        loginClickSessions.size > 0
          ? Math.round((convertedSessions / loginClickSessions.size) * 100)
          : 0,
      latestEvent: events[0] || null,
      topPlacements,
    };
  }, [events]);

  const visitTrends = useMemo(() => {
    const pageViewEvents = events.filter(
      (event) => event.eventType === 'page_view' && toDateMs(event.createdAt) > 0,
    );
    const dailyCountMap = new Map<string, number>();

    pageViewEvents.forEach((event) => {
      const dateKey = format(new Date(toDateMs(event.createdAt)), 'yyyy-MM-dd');
      dailyCountMap.set(dateKey, (dailyCountMap.get(dateKey) || 0) + 1);
    });

    const buildTrend = (days: 1 | 7 | 30): VisitTrendPoint[] => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return Array.from({ length: days }, (_, index) => {
        const offset = days - 1 - index;
        const date = new Date(today);
        date.setDate(today.getDate() - offset);
        const dateKey = format(date, 'yyyy-MM-dd');

        return {
          dateKey,
          label: days === 1 ? '오늘' : format(date, 'MM.dd'),
          visits: dailyCountMap.get(dateKey) || 0,
        };
      });
    };

    return {
      daily: buildTrend(1),
      weekly: buildTrend(7),
      monthly: buildTrend(30),
    };
  }, [events]);

  const selectedTrend =
    visitPeriod === 1 ? visitTrends.daily : visitPeriod === 7 ? visitTrends.weekly : visitTrends.monthly;

  const periodVisitTotal = selectedTrend.reduce((sum, item) => sum + item.visits, 0);

  if (!centerId) return null;

  return (
    <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border/50">
      <CardHeader className="p-6 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-black">
              <BarChart3 className="h-5 w-5 text-primary" />
              웹사이트 입구 방문 추적
            </CardTitle>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              기존 재원생의 로그인 직행 유입과 홍보용 체험 유입을 따로 집계해 볼 수 있습니다.
            </p>
          </div>
          <Badge className="border-none bg-primary/10 px-3 py-1 text-[11px] font-black text-primary">
            입구 클릭 집계
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-6 pt-2">
        <div className="rounded-2xl border border-[#14295F]/10 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[#14295F]">일자별 웹사이트 방문수</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                기간 내 날짜별 페이지 방문(`page_view`) 수를 보여줍니다.
              </p>
            </div>
            <div className="inline-flex rounded-full bg-[#EEF2F8] p-1">
              {([
                { value: 1, label: '일간' },
                { value: 7, label: '7일간' },
                { value: 30, label: '한달간' },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setVisitPeriod(option.value)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-black transition-colors',
                    visitPeriod === option.value
                      ? 'bg-[#14295F] text-white'
                      : 'text-[#14295F]/65 hover:text-[#14295F]',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#14295F]/10 bg-[#F7FAFF] p-3">
              <p className="text-[11px] font-black tracking-[0.08em] text-[#14295F]/55">오늘 방문</p>
              <p className="dashboard-number mt-1 text-2xl text-[#14295F]">{visitTrends.daily[0]?.visits ?? 0}</p>
            </div>
            <div className="rounded-xl border border-[#14295F]/10 bg-[#F7FAFF] p-3">
              <p className="text-[11px] font-black tracking-[0.08em] text-[#14295F]/55">최근 7일 방문</p>
              <p className="dashboard-number mt-1 text-2xl text-[#14295F]">
                {visitTrends.weekly.reduce((sum, item) => sum + item.visits, 0)}
              </p>
            </div>
            <div className="rounded-xl border border-[#14295F]/10 bg-[#F7FAFF] p-3">
              <p className="text-[11px] font-black tracking-[0.08em] text-[#14295F]/55">최근 30일 방문</p>
              <p className="dashboard-number mt-1 text-2xl text-[#14295F]">
                {visitTrends.monthly.reduce((sum, item) => sum + item.visits, 0)}
              </p>
            </div>
          </div>

          <div className="mt-4 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={selectedTrend} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="visitTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14295F" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#14295F" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF2" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700, fill: '#667085' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#667085' }} tickLine={false} axisLine={false} width={28} />
                <Tooltip
                  cursor={{ stroke: '#14295F33' }}
                  formatter={(value: number) => [`${value}회`, '방문수']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.dateKey || '-'}
                />
                <Area
                  type="monotone"
                  dataKey="visits"
                  stroke="#14295F"
                  strokeWidth={2}
                  fill="url(#visitTrendGradient)"
                  dot={{ r: 3, fill: '#14295F', strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: '#FF7A16', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
            선택 기간 합계: <span className="font-black text-[#14295F]">{periodVisitTotal}회</span>
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[#14295F]/10 bg-[#F7FAFF] p-4 shadow-sm">
            <p className="text-xs font-black tracking-[0.12em] text-[#14295F]/50">랜딩 방문수</p>
            <p className="dashboard-number mt-2 text-3xl text-[#14295F]">{summary.landingViews}</p>
            <p className="mt-2 text-[11px] font-black text-[#14295F]/45">
              체험 페이지 방문 {summary.experienceViews}회
            </p>
          </div>

          <div className="rounded-2xl border border-[#FF7A16]/15 bg-[#FFF5EC] p-4 shadow-sm">
            <p className="flex items-center gap-2 text-xs font-black tracking-[0.12em] text-[#B85A00]">
              <LogIn className="h-3.5 w-3.5" />
              웹앱 로그인
            </p>
            <p className="dashboard-number mt-2 text-3xl text-[#14295F]">{summary.loginClickCount}</p>
            <p className="mt-2 text-[11px] font-black text-[#B85A00]/72">
              실제 로그인 완료 {summary.loginSuccessCount}회
            </p>
          </div>

          <div className="rounded-2xl border border-[#14295F]/10 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-xs font-black tracking-[0.12em] text-[#14295F]/55">
              <Smartphone className="h-3.5 w-3.5 text-[#FF7A16]" />
              로그인 전환율
            </p>
            <p className="dashboard-number mt-2 text-3xl text-[#14295F]">{summary.conversionRate}%</p>
            <p className="mt-2 text-[11px] font-black text-[#14295F]/48">
              체험 클릭 {summary.experienceClickCount}회
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-[#14295F]/10 bg-white p-4 shadow-sm">
            <p className="text-sm font-black text-[#14295F]">최근 클릭</p>
            {summary.latestEvent ? (
              <div className="mt-3 space-y-2 text-sm font-bold text-slate-600">
                <p>
                  유형:{' '}
                  <span className="font-black text-[#14295F]">
                    {summary.latestEvent.eventType === 'page_view'
                      ? `${summary.latestEvent.pageType === 'landing' ? '랜딩' : summary.latestEvent.pageType === 'experience' ? '체험' : '로그인'} 방문`
                      : summary.latestEvent.eventType === 'login_success'
                        ? '로그인 완료'
                        : summary.latestEvent.target === 'login'
                          ? '웹앱 로그인'
                          : '웹앱 체험'}
                  </span>
                </p>
                <p>
                  위치:{' '}
                  <span className="font-black text-[#14295F]">
                    {summary.latestEvent.eventType === 'page_view'
                      ? summary.latestEvent.pageType === 'landing'
                        ? '메인 랜딩'
                        : summary.latestEvent.pageType === 'experience'
                          ? '체험 페이지'
                          : '로그인 페이지'
                      : placementLabel(summary.latestEvent.placement)}
                  </span>
                </p>
                <p>
                  시간:{' '}
                  <span className="font-black text-[#14295F]">
                    {formatDateTime(summary.latestEvent.createdAt)}
                  </span>
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm font-semibold text-slate-500">
                아직 집계된 입구 클릭 기록이 없습니다.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[#14295F]/10 bg-white p-4 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-black text-[#14295F]">
              <MousePointerClick className="h-4 w-4 text-[#FF7A16]" />
              상위 클릭 위치
            </p>

            <div className="mt-3 space-y-3">
              {isLoading ? (
                <p className="text-sm font-semibold text-slate-500">불러오는 중...</p>
              ) : summary.topPlacements.length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">
                  아직 집계된 위치 데이터가 없습니다.
                </p>
              ) : (
                summary.topPlacements.map((item) => (
                  <div key={item.label} className="grid grid-cols-[112px_1fr_48px] items-center gap-3">
                    <span className="text-sm font-black text-[#14295F]/78">{item.label}</span>
                    <div className="h-2.5 rounded-full bg-[#EEF2F8]">
                      <div
                        className={cn(
                          'h-2.5 rounded-full bg-[linear-gradient(90deg,#FFB16D_0%,#FF7A16_100%)]',
                        )}
                        style={{
                          width: `${summary.totalEntryClicks > 0 ? Math.max(12, (item.count / summary.totalEntryClicks) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <span className="dashboard-number text-right text-sm text-[#14295F]">
                      {item.count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
