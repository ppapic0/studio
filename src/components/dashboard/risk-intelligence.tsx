
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { DailyStudentStat, CenterMembership, GrowthProgress } from '@/lib/types';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  calcRiskDimensions,
  calcStudyVariance,
  dominantDimension,
  getInterventionGuide,
  getRiskLevel,
  getRiskLevelMeta,
  DIMENSION_LABELS,
  DIMENSION_COLORS,
  DIMENSION_BG,
  DIMENSION_LIGHT_BG,
  type RiskDimensions,
  type RiskLevel,
} from '@/lib/student-risk-engine';
import {
  AlertTriangle,
  TrendingDown,
  ShieldAlert,
  Zap,
  Clock,
  Activity,
  Users,
  ChevronRight,
  Loader2,
  Sparkles,
  Target,
  History,
  BrainCircuit,
  CheckCircle2,
  BarChart3,
  Gauge,
  Repeat2,
  TrendingUp,
  Siren,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import Link from 'next/link';

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

const LEVEL_SCORE_COLOR: Record<RiskLevel, string> = {
  긴급: 'bg-rose-600 text-white shadow-rose-200',
  위험: 'bg-orange-500 text-white shadow-orange-100',
  주의: 'bg-amber-400 text-white shadow-amber-100',
  안정: 'bg-emerald-500 text-white shadow-emerald-100',
};

const LEVEL_HEADER_COLOR: Record<RiskLevel, string> = {
  긴급: 'bg-rose-600',
  위험: 'bg-orange-500',
  주의: 'bg-amber-400',
  안정: 'bg-emerald-500',
};

const LEVEL_TEXT_COLOR: Record<RiskLevel, string> = {
  긴급: 'text-rose-600',
  위험: 'text-orange-500',
  주의: 'text-amber-500',
  안정: 'text-emerald-600',
};

const LEVEL_BG_LIGHT: Record<RiskLevel, string> = {
  긴급: 'bg-rose-50 border-rose-100',
  위험: 'bg-orange-50 border-orange-100',
  주의: 'bg-amber-50 border-amber-100',
  안정: 'bg-emerald-50 border-emerald-100',
};

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface RiskStudent {
  id: string;
  name: string;
  className?: string;
  dims: RiskDimensions;
  level: RiskLevel;
  penalty: number;
  lowStudyStreak: number;
  todayMinutes: number;
  completionRate: number;
  growthRate: number;
  studyVariance: number;
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export function RiskIntelligence() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const [selectedStudent, setSelectedStudent] = useState<RiskStudent | null>(null);
  const [recentStudyByStudent, setRecentStudyByStudent] = useState<Record<string, Record<string, number>>>({});
  const [studyLogsLoading, setStudyLogsLoading] = useState(false);

  // 1. 재원생 조회
  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'),
      where('role', '==', 'student'),
      where('status', '==', 'active'),
    );
  }, [firestore, centerId]);
  const { data: members, isLoading: membersLoading } = useCollection<CenterMembership>(membersQuery);

  // 2. 성장 프로필 (stats + 벌점)
  const progressQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'growthProgress');
  }, [firestore, centerId]);
  const { data: progressList } = useCollection<GrowthProgress>(progressQuery);

  // 3. 당일 통계
  const statsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return collection(firestore, 'centers', centerId, 'dailyStudentStats', todayKey, 'students');
  }, [firestore, centerId, todayKey]);
  const { data: todayStats } = useCollection<DailyStudentStat>(statsQuery);

  // 4. 7일 학습 로그 (분산 계산용)
  useEffect(() => {
    let disposed = false;
    if (!firestore || !centerId || !members || members.length === 0) {
      setRecentStudyByStudent({});
      return;
    }
    const loadLogs = async () => {
      setStudyLogsLoading(true);
      try {
        const fromKey = format(subDays(new Date(), 6), 'yyyy-MM-dd');
        const buckets: Record<string, Record<string, number>> = {};
        await Promise.all(
          members.map(async (member) => {
            const daysRef = collection(firestore, 'centers', centerId, 'studyLogs', member.id, 'days');
            const snap = await getDocs(query(daysRef, where('dateKey', '>=', fromKey)));
            const dayMap: Record<string, number> = {};
            snap.forEach((d) => {
              const raw = d.data() as any;
              const dateKey = typeof raw.dateKey === 'string' ? raw.dateKey : d.id;
              const mins = Number(raw.totalMinutes || 0);
              if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Number.isFinite(mins) || mins < 0) return;
              dayMap[dateKey] = mins;
            });
            buckets[member.id] = dayMap;
          }),
        );
        if (!disposed) setRecentStudyByStudent(buckets);
      } catch (err) {
        console.error('Risk study-log aggregation failed:', err);
        if (!disposed) setRecentStudyByStudent({});
      } finally {
        if (!disposed) setStudyLogsLoading(false);
      }
    };
    loadLogs();
    return () => { disposed = true; };
  }, [firestore, centerId, members]);

  // ─── 4차원 리스크 분석 엔진 ─────────────────────────────────────────────────
  const riskAnalysis = useMemo((): RiskStudent[] => {
    if (!members) return [];
    const today = new Date();
    const nowMs = Date.now();

    return members.map((m) => {
      const stat = todayStats?.find((s) => s.studentId === m.id);
      const progress = progressList?.find((p) => p.id === m.id);
      const dayMap = recentStudyByStudent[m.id] || {};

      const joinedAtMs = m.joinedAt?.toMillis?.() || nowMs;
      const observedDays = Math.min(7, Math.max(1, Math.floor((nowMs - joinedAtMs) / 86400000) + 1));

      // todayMinutes: dailyStat 또는 studyLog 중 더 큰 값
      const todayMinutes = Math.max(
        Number(stat?.totalStudyMinutes || 0),
        Number(dayMap[todayKey] || 0),
      );

      // 연속 저학습 일수 계산 (3시간 미만)
      let lowStudyStreak = 0;
      for (let i = 0; i < observedDays; i++) {
        const dk = format(subDays(today, i), 'yyyy-MM-dd');
        const mins = dk === todayKey ? todayMinutes : Number(dayMap[dk] || 0);
        if (mins < 180) { lowStudyStreak += 1; } else { break; }
      }

      // 7일 학습 분산
      const last7Keys = Array.from({ length: 7 }, (_, i) => format(subDays(today, i), 'yyyy-MM-dd'));
      const studyVariance = calcStudyVariance(dayMap, last7Keys);

      const growthRate = stat?.studyTimeGrowthRate ?? 0;
      const completionRate = stat?.todayPlanCompletionRate ?? 0;
      const penalty = progress?.penaltyPoints ?? 0;
      const focusStat = progress?.stats?.focus ?? 50;
      const consistency = progress?.stats?.consistency ?? 50;
      const achievement = progress?.stats?.achievement ?? 50;
      const resilience = progress?.stats?.resilience ?? 50;

      const dims = calcRiskDimensions({
        growthRate,
        lowStudyStreak,
        completionRate,
        penalty,
        focusStat,
        consistency,
        studyVariance,
        todayMinutes,
        achievement,
        resilience,
      });

      return {
        id: m.id,
        name: m.displayName ?? '',
        className: m.className,
        dims,
        level: getRiskLevel(dims.overall),
        penalty,
        lowStudyStreak,
        todayMinutes,
        completionRate,
        growthRate,
        studyVariance,
      };
    }).sort((a, b) => b.dims.overall - a.dims.overall);
  }, [members, todayStats, progressList, recentStudyByStudent, todayKey]);

  // ─── 요약 통계 ──────────────────────────────────────────────────────────────
  const summary = useMemo(() => ({
    긴급: riskAnalysis.filter((r) => r.level === '긴급').length,
    위험: riskAnalysis.filter((r) => r.level === '위험').length,
    주의: riskAnalysis.filter((r) => r.level === '주의').length,
    안정: riskAnalysis.filter((r) => r.level === '안정').length,
    total: riskAnalysis.length,
  }), [riskAnalysis]);

  const urgentList = useMemo(() => riskAnalysis.filter((r) => r.level === '긴급').slice(0, 5), [riskAnalysis]);

  if (membersLoading) {
    return (
      <div className="py-40 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin h-10 w-10 text-rose-500 opacity-20" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 italic whitespace-nowrap">
          4차원 리스크 분석 중...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {studyLogsLoading && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50/60 px-4 py-2.5 text-xs font-bold text-rose-700">
          최근 학습 로그를 보강 분석 중입니다. 현재 점수는 먼저 표시됩니다.
        </div>
      )}

      {/* ── 요약 카드 4종 ─────────────────────────────────────────────────────── */}
      <section className={cn('grid gap-4', isMobile ? 'grid-cols-2' : 'md:grid-cols-4')}>
        {(['긴급', '위험', '주의', '안정'] as RiskLevel[]).map((level) => {
          const meta = getRiskLevelMeta(level === '긴급' ? 100 : level === '위험' ? 65 : level === '주의' ? 40 : 10);
          const count = summary[level];
          const icons: Record<RiskLevel, typeof Siren> = { 긴급: Siren, 위험: AlertTriangle, 주의: Activity, 안정: CheckCircle2 };
          const Icon = icons[level];
          return (
            <Card key={level} className={cn(
              'rounded-[2.5rem] border shadow-xl bg-white p-8 relative overflow-hidden group',
              meta.border,
            )}>
              <Icon className={cn('absolute -right-3 -top-3 h-32 w-32 opacity-[0.06] group-hover:scale-110 transition-transform duration-700', meta.color)} />
              <div className="relative z-10 space-y-3">
                <p className={cn('text-[9px] font-black uppercase tracking-[0.2em]', meta.color)}>{level}</p>
                <h3 className={cn('text-5xl font-black tracking-tighter', meta.color)}>
                  {count}<span className="text-base opacity-40 ml-1">명</span>
                </h3>
                <p className="text-[10px] font-bold text-muted-foreground">
                  {level === '긴급' ? '즉각 개입 필요' : level === '위험' ? '조속 관찰 필요' : level === '주의' ? '주의 관찰 단계' : '안정적 학습 중'}
                </p>
              </div>
            </Card>
          );
        })}
      </section>

      <div className={cn('grid gap-6', isMobile ? 'grid-cols-1' : 'md:grid-cols-12')}>

        {/* ── 학생 랭킹 리스트 ─────────────────────────────────────────────────── */}
        <div className="md:col-span-8 space-y-6">
          <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-black/[0.03]">
            <CardHeader className="bg-muted/5 border-b p-10">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3">
                  <Gauge className="h-6 w-6 text-rose-600" /> 학생별 종합 위험도 랭킹
                </CardTitle>
                <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-60">
                  4차원 리스크 분석 (이탈 · 몰입 · 패턴 · 정체)
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="divide-y divide-muted/10">
                  {riskAnalysis.length === 0 && (
                    <div className="p-16 text-center">
                      <p className="text-sm font-bold text-muted-foreground/40">분석 대상 학생이 없습니다.</p>
                    </div>
                  )}
                  {riskAnalysis.slice(0, 40).map((r) => {
                    const dom = dominantDimension(r.dims);
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedStudent(r)}
                        className="p-7 hover:bg-muted/5 transition-all flex items-center justify-between group cursor-pointer"
                      >
                        <div className="flex items-center gap-5">
                          {/* 점수 뱃지 */}
                          <div className={cn(
                            'h-14 w-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg transition-all group-hover:scale-110',
                            LEVEL_SCORE_COLOR[r.level],
                          )}>
                            {r.dims.overall}
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-lg tracking-tight">{r.name} 학생</span>
                              <Badge variant="outline" className="text-[9px] font-black border-primary/20">{r.className || '반 미지정'}</Badge>
                              <Badge className={cn('text-[9px] font-black border-none text-white', getRiskLevelMeta(r.dims.overall).badge)}>
                                {r.level}
                              </Badge>
                            </div>
                            {/* 4차원 미니 바 */}
                            <div className="flex items-center gap-3">
                              {(['dropout', 'focus', 'pattern', 'stagnation'] as const).map((dim) => (
                                <div key={dim} className="flex items-center gap-1">
                                  <span className={cn('text-[8px] font-black', DIMENSION_COLORS[dim])}>{DIMENSION_LABELS[dim]}</span>
                                  <div className="w-10 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className={cn('h-full rounded-full', DIMENSION_BG[dim])}
                                      style={{ width: `${r.dims[dim]}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                              <span className={cn('text-[8px] font-black ml-1', DIMENSION_COLORS[dom])}>
                                주요: {DIMENSION_LABELS[dom]}
                              </span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground/20 group-hover:text-primary transition-all group-hover:translate-x-1 shrink-0" />
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* ── 사이드 패널 ──────────────────────────────────────────────────────── */}
        <div className="md:col-span-4 space-y-6">

          {/* 4차원 가이드 */}
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white text-[#14295F] p-8 overflow-hidden relative ring-1 ring-[#14295F]/15">
            <div className="absolute -right-4 -top-4 opacity-10">
              <BrainCircuit className="h-32 w-32" />
            </div>
            <div className="relative z-10 space-y-5">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#14295F]" />
                <h4 className="text-sm font-black uppercase tracking-widest">4차원 리스크 엔진</h4>
              </div>
              <div className="space-y-2.5">
                {[
                  { dim: 'dropout' as const, icon: TrendingDown, weight: '이탈×35% + 몰입×30%' },
                  { dim: 'focus' as const, icon: Activity, weight: '패턴×20% + 정체×15%' },
                  { dim: 'pattern' as const, icon: Repeat2, weight: '꾸준함×45% + 편차×35%' },
                  { dim: 'stagnation' as const, icon: TrendingUp, weight: '성장률×40% + 달성×30%' },
                ].map(({ dim, icon: Icon, weight }) => (
                  <div key={dim} className="flex items-center justify-between bg-[#F7FAFF] p-3 rounded-xl border border-[#14295F]/10">
                    <div className="flex items-center gap-2.5">
                      <Icon className={cn('h-4 w-4', DIMENSION_COLORS[dim])} />
                      <span className="text-xs font-black text-[#14295F]">{DIMENSION_LABELS[dim]} 리스크</span>
                    </div>
                    <span className="text-[9px] font-bold text-[#14295F]/50">{weight}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1 pt-1">
                {(['안정', '주의', '위험', '긴급'] as RiskLevel[]).map((lv) => {
                  const ranges = { 안정: '0~29', 주의: '30~54', 위험: '55~74', 긴급: '75~100' };
                  return (
                    <div key={lv} className="text-center">
                      <div className={cn('text-[9px] font-black', LEVEL_TEXT_COLOR[lv])}>{lv}</div>
                      <div className="text-[8px] font-bold text-[#14295F]/40">{ranges[lv]}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* 긴급 개입 필요 목록 */}
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-rose-100">
            <CardTitle className="text-base font-black flex items-center gap-2 mb-5">
              <Siren className="h-5 w-5 text-rose-600" /> 긴급 개입 필요
            </CardTitle>
            <div className="space-y-2.5">
              {urgentList.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-muted-foreground/40">긴급 학생이 없습니다.</p>
                </div>
              ) : urgentList.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedStudent(s)}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-50/50 border border-rose-100 cursor-pointer hover:bg-rose-50 transition-colors"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-sm">{s.name}</span>
                    <p className={cn('text-[9px] font-black', DIMENSION_COLORS[dominantDimension(s.dims)])}>
                      주요: {DIMENSION_LABELS[dominantDimension(s.dims)]} 리스크
                    </p>
                  </div>
                  <Badge className="bg-rose-600 text-white border-none font-black text-xs">{s.dims.overall}점</Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* 벌점 관리 대상 */}
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-black/[0.03]">
            <CardTitle className="text-base font-black flex items-center gap-2 mb-5">
              <Zap className="h-5 w-5 text-amber-500 fill-current" /> 벌점 관리 대상
            </CardTitle>
            <div className="space-y-2.5">
              {riskAnalysis.filter((r) => r.penalty > 0).slice(0, 5).length === 0 ? (
                <p className="text-xs font-bold text-muted-foreground/40 text-center py-4">관리 대상이 없습니다.</p>
              ) : riskAnalysis.filter((r) => r.penalty > 0).slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-50/30 border border-rose-100/50">
                  <span className="font-bold text-sm">{s.name}</span>
                  <Badge className="bg-rose-600 text-white border-none font-black">{s.penalty}점</Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* 저학습 연속 관리 */}
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-black/[0.03]">
            <CardTitle className="text-base font-black flex items-center gap-2 mb-5">
              <Clock className="h-5 w-5 text-blue-500" /> 저학습 연속 관리
            </CardTitle>
            <div className="space-y-2.5">
              {riskAnalysis.filter((r) => r.lowStudyStreak >= 2).slice(0, 5).length === 0 ? (
                <p className="text-xs font-bold text-muted-foreground/40 text-center py-4">관리 대상이 없습니다.</p>
              ) : riskAnalysis.filter((r) => r.lowStudyStreak >= 2).slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/30 border border-blue-100/50">
                  <span className="font-bold text-sm">{s.name}</span>
                  <Badge className="bg-blue-600 text-white border-none font-black">{s.lowStudyStreak}일 연속 &lt; 3h</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ── 상세 다이얼로그 ────────────────────────────────────────────────────── */}
      <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className={cn(
          'rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col transition-all duration-500',
          isMobile ? 'fixed inset-0 w-full h-full max-w-none rounded-none' : 'sm:max-w-xl max-h-[90vh]',
        )}>
          {selectedStudent && (
            <>
              {/* 헤더 */}
              <div className={cn('p-10 text-white relative shrink-0', LEVEL_HEADER_COLOR[selectedStudent.level])}>
                <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
                  <Gauge className="h-48 w-48" />
                </div>
                <DialogHeader className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-white/20 text-white border-none font-black text-[10px] px-2.5 py-0.5 uppercase tracking-widest">
                      4차원 위험도 분석
                    </Badge>
                    <Badge className="bg-white/30 text-white border-none font-black text-[10px] px-2.5 py-0.5">
                      {selectedStudent.level}
                    </Badge>
                  </div>
                  <DialogTitle className="text-4xl font-black tracking-tighter">
                    {selectedStudent.name} 학생
                  </DialogTitle>
                  <DialogDescription className="text-white/70 font-bold mt-1 text-sm">
                    실시간 Firestore 데이터 기반 · 4차원 가중 합산 위험도
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="flex-1 overflow-y-auto bg-[#fafafa] p-8 sm:p-10 space-y-8">

                {/* 종합 점수 */}
                <div className="text-center space-y-3">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">종합 위험도</span>
                  <h3 className={cn('text-8xl font-black tracking-tighter leading-none', LEVEL_TEXT_COLOR[selectedStudent.level])}>
                    {selectedStudent.dims.overall}<span className="text-3xl opacity-20 ml-1">/100</span>
                  </h3>
                  <Progress value={selectedStudent.dims.overall} className="h-3 bg-muted" />
                </div>

                {/* 4차원 스코어 분해 */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-primary/60 tracking-widest flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> 차원별 리스크 분해
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { dim: 'dropout' as const, icon: TrendingDown, kpis: '성장률·저학습연속·완료율·벌점' },
                      { dim: 'focus' as const, icon: Activity, kpis: '집중스탯·꾸준함·성장률·오늘학습' },
                      { dim: 'pattern' as const, icon: Repeat2, kpis: '꾸준함·학습편차·성장률' },
                      { dim: 'stagnation' as const, icon: TrendingUp, kpis: '성장률·달성스탯·완료율·회복력' },
                    ] as const).map(({ dim, icon: Icon, kpis }) => {
                      const score = selectedStudent.dims[dim];
                      const level = getRiskLevel(score);
                      const isDom = dominantDimension(selectedStudent.dims) === dim;
                      return (
                        <div key={dim} className={cn(
                          'p-4 rounded-2xl border-2 transition-all',
                          isDom ? `${DIMENSION_LIGHT_BG[dim]} border-current` : 'bg-white border-border/50',
                        )}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <Icon className={cn('h-4 w-4', DIMENSION_COLORS[dim])} />
                              <span className={cn('text-xs font-black', DIMENSION_COLORS[dim])}>
                                {DIMENSION_LABELS[dim]}
                                {isDom && <span className="ml-1 text-[8px] bg-current/10 px-1 py-0.5 rounded">주요</span>}
                              </span>
                            </div>
                            <span className={cn('font-black text-sm', LEVEL_TEXT_COLOR[level])}>{score}</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all duration-700', DIMENSION_BG[dim])}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <p className="text-[8px] font-bold text-muted-foreground/50 mt-1.5 leading-relaxed">{kpis}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* KPI 원시값 요약 */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-primary/60 tracking-widest flex items-center gap-2">
                    <Target className="h-4 w-4" /> 핵심 KPI 현황
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '성장률', value: `${(selectedStudent.growthRate * 100).toFixed(1)}%`, icon: TrendingDown },
                      { label: '오늘 학습', value: `${selectedStudent.todayMinutes}분`, icon: Clock },
                      { label: '완료율', value: `${selectedStudent.completionRate.toFixed(0)}%`, icon: Target },
                      { label: '벌점', value: `${selectedStudent.penalty}점`, icon: ShieldAlert },
                      { label: '저학습연속', value: `${selectedStudent.lowStudyStreak}일`, icon: History },
                      { label: '학습편차', value: `${selectedStudent.studyVariance.toFixed(0)}분`, icon: BarChart3 },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-border/50">
                        <Icon className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                        <div>
                          <p className="text-[9px] font-bold text-muted-foreground/50">{label}</p>
                          <p className="font-black text-sm">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 개입 가이드 */}
                <Card className="rounded-[2rem] border-none shadow-xl bg-white p-7 space-y-3 ring-1 ring-black/5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500 fill-current" />
                    <h4 className="text-sm font-black tracking-tight">운영자 권장 조치</h4>
                  </div>
                  <p className="text-xs font-semibold leading-relaxed text-foreground/70">
                    {getInterventionGuide(selectedStudent.dims, selectedStudent.dims.overall)}
                  </p>
                </Card>
              </div>

              <DialogFooter className="p-8 bg-white border-t shrink-0 flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="h-14 rounded-2xl font-black flex-1 border-2"
                  onClick={() => setSelectedStudent(null)}
                >
                  닫기
                </Button>
                <Button asChild className="h-14 rounded-2xl font-black flex-1 shadow-xl gap-2 active:scale-95 transition-all">
                  <Link href={`/dashboard/teacher/students/${selectedStudent.id}`}>
                    학생 상세 페이지 <ChevronRight className="h-5 w-5" />
                  </Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
