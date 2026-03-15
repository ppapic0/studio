
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/contexts/app-context';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { AttendanceCurrent, 센터Membership, GrowthProgress, LeaderboardEntry, StudyLogDay } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  Loader2, 
  Zap, 
  Target, 
  RefreshCw, 
  CheckCircle2, 
  ShieldCheck, 
  Trophy, 
  Crown,
  TrendingUp,
  Sparkles,
  ArrowUpCircle,
  Flame,
  Info,
  ChevronRight,
  BookOpen,
  Check,
  Star,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const STAT_CONFIG = {
  focus: { 
    label: '집중력', 
    sub: '집중', 
    icon: Target, 
    color: 'text-blue-500', 
    bg: 'bg-blue-500', 
    accent: 'bg-blue-50',
    guide: '몰입 시간에 비례하여 상승 (1h당 +0.1)'
  },
  consistency: { 
    label: '꾸준함', 
    sub: '꾸준', 
    icon: RefreshCw, 
    color: 'text-emerald-500', 
    bg: 'bg-emerald-500', 
    accent: 'bg-emerald-50',
    guide: '매일 트랙 시작 시 상승 (일일 +0.5)'
  },
  achievement: { 
    label: '목표달성', 
    sub: '달성', 
    icon: CheckCircle2, 
    color: 'text-amber-500', 
    bg: 'bg-amber-500', 
    accent: 'bg-amber-50',
    guide: '할 일 완료 시 상승 (항목당 +0.1)'
  },
  resilience: { 
    label: '회복력', 
    sub: '회복', 
    icon: ShieldCheck, 
    color: 'text-rose-500', 
    bg: 'bg-rose-500', 
    accent: 'bg-rose-50',
    guide: '6시간 이상 달성 시 상승 (일일 +0.5)'
  },
};

type StatKey = keyof typeof STAT_CONFIG;
type SkillTrackHistoryItem = {
  dateKey: string;
  reason: string;
  detail: string;
  gained: number;
};

const SKILL_LABEL: Record<StatKey, string> = {
  focus: '집중력',
  consistency: '꾸준함',
  achievement: '목표달성',
  resilience: '회복력',
};


function isActiveStudentStatus(status: unknown): boolean {
  if (typeof status !== 'string') return true;
  const normalized = status.trim().toLowerCase();
  if (!normalized) return true;
  return normalized === 'active';
}

function isSyntheticStudentId(studentId: unknown): boolean {
  if (typeof studentId !== 'string') return true;
  const normalized = studentId.trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.startsWith('test-') ||
    normalized.startsWith('seed-') ||
    normalized.startsWith('mock-') ||
    normalized.includes('dummy')
  );
}

function SystemGuideDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full mt-2 rounded-xl text-[10px] font-black border-dashed border-2 h-10 hover:bg-primary/5 transition-all">
          <Info className="mr-1.5 h-3.5 w-3.5" /> 시즌 티어 및 리셋 가이드
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden max-w-[90vw]">
        <div className="bg-primary p-8 text-primary-foreground relative">
          <Sparkles className="absolute top-4 right-4 h-10 w-10 opacity-20" />
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tighter">성장트랙 가이드</DialogTitle>
            <DialogDescription className="text-primary-foreground/70 font-bold mt-1 text-xs">
              활동량(포인트)으로 증명하는 시즌제 등급 시스템입니다.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-8 space-y-6 max-h-[50vh] overflow-y-auto custom-scrollbar bg-white">
          <div className="space-y-3">
            <h4 className="font-black text-primary flex items-center gap-2 text-sm">
              <Zap className="h-3.5 w-3.5 fill-current text-accent" /> 1. 행동 보상 포인트 (일일 보너스)
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {[
                { l: '출석 보너스', v: 100, d: '당일 3시간 이상 학습 시' },
                { l: '계획 보너스', v: 100, d: '3개 이상 계획 모두 완료' },
                { l: '루틴 보너스', v: 100, d: '등록된 루틴 모두 준수 시' }
              ].map(item => (
                <div key={item.l} className="p-3 rounded-xl bg-muted/30 border flex justify-between items-center">
                  <div className="grid">
                    <span className="text-[11px] font-black">{item.l}</span>
                    <span className="text-[9px] font-bold text-muted-foreground">{item.d}</span>
                  </div>
                  <span className="text-sm font-black text-primary">+{item.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-black text-primary flex items-center gap-2 text-sm">
              <Trophy className="h-3.5 w-3.5 text-emerald-500" /> 2. 티어 판정 (포인트 + 랭킹)
            </h4>
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
              <p className="text-[11px] font-bold text-emerald-900/70 leading-relaxed">
                - **브론즈 ~ 다이아몬드**: 0 ~ 25,000포인트 구간<br/>
                - **챌린저**: 25,000포인트 이상 중 **센터 1위**<br/>
                - **그랜드마스터**: 25,000포인트 이상 중 **2, 3위**
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function GrowthPage() {
  const { user } = useUser();
  const { activeMembership, viewMode, currentTier } = useAppContext();
  const firestore = useFirestore();
  const isMobile = viewMode === 'mobile';
  const periodKey = format(new Date(), 'yyyy-MM');

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
  }, [firestore, activeMembership?.id, user?.uid]);

  const { data: progress, isLoading } = useDoc<GrowthProgress>(progressRef);

  const seasonStudyLogsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days'),
      orderBy('dateKey', 'desc'),
      limit(62)
    );
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: seasonStudyLogs } = useCollection<StudyLogDay>(seasonStudyLogsQuery);

  const rankQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_lp`, 'entries'),
      where('studentId', '==', user.uid)
    );
  }, [firestore, activeMembership, user, periodKey]);
  const { data: rankEntries } = useCollection<LeaderboardEntry>(rankQuery);

  // 재원생 기준 랭킹 집계(퇴원/가상 계정 제외)
  const totalEntriesQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_lp`, 'entries');
  }, [firestore, activeMembership, periodKey]);
  const { data: totalRankEntries } = useCollection<LeaderboardEntry>(totalEntriesQuery);

  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'members'),
      where('role', '==', 'student'),
      where('status', '==', 'active')
    );
  }, [firestore, activeMembership]);
  const { data: activeStudentMembers, isLoading: activeMembersLoading } = useCollection<센터Membership>(membersQuery);

  const activeStudentIds = useMemo(() => {
    if (!activeStudentMembers) return null;
    return new Set(
      activeStudentMembers
        .filter((member) => isActiveStudentStatus(member.status))
        .map((member) => member.id)
    );
  }, [activeStudentMembers]);

  const attendanceCurrentQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return collection(firestore, 'centers', activeMembership.id, 'attendanceCurrent');
  }, [firestore, activeMembership]);
  const { data: attendanceCurrent, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceCurrentQuery);

  const assignedStudentIds = useMemo(() => {
    if (!attendanceCurrent) return null;
    return new Set(
      attendanceCurrent
        .map((seat) => (typeof seat.studentId === 'string' ? seat.studentId.trim() : ''))
        .filter((studentId) => studentId.length > 0 && !isSyntheticStudentId(studentId))
    );
  }, [attendanceCurrent]);

  const validRankEntries = useMemo(() => {
    if (!totalRankEntries) return [];
    let filtered = totalRankEntries.filter((entry) => !isSyntheticStudentId(entry.studentId));

    if (assignedStudentIds) {
      filtered = filtered.filter((entry) => assignedStudentIds.has(entry.studentId));
    }
    if (activeStudentIds) {
      filtered = filtered.filter((entry) => activeStudentIds.has(entry.studentId));
    }

    return filtered;
  }, [totalRankEntries, assignedStudentIds, activeStudentIds]);

  const totalCount = validRankEntries.length;
  const isRankContextLoading = activeMembersLoading || attendanceLoading;

  const currentRank = useMemo(() => {
    const snapshotRank = rankEntries?.[0]?.rank || 0;
    if (!user || validRankEntries.length === 0) return snapshotRank;

    const sorted = [...validRankEntries].sort((a, b) => (b.value || 0) - (a.value || 0));
    const ownIndex = sorted.findIndex((entry) => entry.studentId === user.uid);
    if (ownIndex >= 0) return ownIndex + 1;
    return snapshotRank;
  }, [rankEntries, validRankEntries, user?.uid]);

  const rankDisplay = useMemo(() => {
    if (isRankContextLoading) return '계산 중';
    if (currentRank === 0 || currentRank >= 999) return '집계 대기';
    if (currentRank <= 3) return `#${currentRank}`;

    if (totalCount <= 0) return `#${currentRank}`;
    if (totalCount < 10) return `#${currentRank} / ${totalCount}`;

    const percent = Math.max(1, Math.ceil((currentRank / totalCount) * 100));
    return `상위 ${percent}%`;

  }, [isRankContextLoading, currentRank, totalCount]);

  const stats = useMemo(() => {
    const raw = progress?.stats || { focus: 0, consistency: 0, achievement: 0, resilience: 0 };
    return {
      focus: Math.min(100, raw.focus),
      consistency: Math.min(100, raw.consistency),
      achievement: Math.min(100, raw.achievement),
      resilience: Math.min(100, raw.resilience),
    };
  }, [progress?.stats]);

  const skillTrackHistory = useMemo<Record<StatKey, SkillTrackHistoryItem[]>>(() => {
    const result: Record<StatKey, SkillTrackHistoryItem[]> = {
      focus: [],
      consistency: [],
      achievement: [],
      resilience: [],
    };

    const isCurrentSeason = (dateKey: string) => dateKey.startsWith(periodKey);

    Object.entries(progress?.dailyLpStatus || {}).forEach(([dateKey, rawStatus]) => {
      if (!isCurrentSeason(dateKey)) return;
      const dayStatus = (rawStatus || {}) as Record<string, any>;

      if (dayStatus.checkedIn) {
        result.consistency.push({
          dateKey,
          reason: '입실 체크인',
          detail: '하루 첫 입실 시 +0.5',
          gained: 0.5,
        });
      }

      const achievementCount = Number(dayStatus.achievementCount || 0);
      if (achievementCount > 0) {
        result.achievement.push({
          dateKey,
          reason: '학습 할 일 완료',
          detail: `완료 ${achievementCount}회`,
          gained: Number((achievementCount * 0.1).toFixed(1)),
        });
      }

      if (dayStatus.bonus6h) {
        result.resilience.push({
          dateKey,
          reason: '6시간 학습 달성',
          detail: '장시간 집중 학습 보너스',
          gained: 0.5,
        });
      }
    });

    (seasonStudyLogs || []).forEach((log) => {
      if (!log?.dateKey || !isCurrentSeason(log.dateKey)) return;
      const totalMinutes = Math.max(0, Number(log.totalMinutes || 0));
      if (totalMinutes <= 0) return;
      result.focus.push({
        dateKey: log.dateKey,
        reason: '학습 시간 누적',
        detail: `실공부 ${totalMinutes}분`,
        gained: Number(((totalMinutes / 60) * 0.1).toFixed(2)),
      });
    });

    (Object.keys(result) as StatKey[]).forEach((key) => {
      result[key].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    });

    return result;
  }, [progress?.dailyLpStatus, seasonStudyLogs, periodKey]);

  const avgStat = useMemo(() => {
    const values = Object.values(stats);
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [stats]);

  const currentLp = progress?.seasonLp || 0;
  const totalBoost = 1 + (stats.focus/100 * 0.05) + (stats.consistency/100 * 0.05) + (stats.achievement/100 * 0.05) + (stats.resilience/100 * 0.05);
  const heroGradient = useMemo(() => {
    const tierTone = currentTier?.bg ?? '';
    if (tierTone.includes('cyan')) return 'linear-gradient(145deg, #1A5CCF 0%, #143F9A 45%, #0B2358 100%)';
    if (tierTone.includes('rose')) return 'linear-gradient(145deg, #E55185 0%, #B43663 45%, #611C40 100%)';
    if (tierTone.includes('purple')) return 'linear-gradient(145deg, #7B3FC4 0%, #5A2F98 45%, #2E1952 100%)';
    if (tierTone.includes('blue')) return 'linear-gradient(145deg, #2D61D8 0%, #2047A3 45%, #102557 100%)';
    if (tierTone.includes('emerald')) return 'linear-gradient(145deg, #14A76D 0%, #0E7E54 45%, #0A4B33 100%)';
    if (tierTone.includes('yellow')) return 'linear-gradient(145deg, #D79B1B 0%, #A77315 45%, #5E410E 100%)';
    if (tierTone.includes('slate')) return 'linear-gradient(145deg, #607287 0%, #475A72 45%, #24374B 100%)';
    return 'linear-gradient(145deg, #E56817 0%, #BE4D11 45%, #672D0E 100%)';
  }, [currentTier?.bg]);

  if (isLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" /></div>;

  return (
    <div className={cn("flex flex-col pb-24", isMobile ? "gap-4 px-0" : "gap-10")}>
      <header className={cn("flex flex-col px-1", isMobile ? "gap-0.5" : "gap-2")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("bg-primary rounded-xl shadow-lg", isMobile ? "p-1.5" : "p-2.5")}>
              <TrendingUp className="text-white h-4 w-4 sm:h-6 sm:w-6" />
            </div>
            <h1 className={cn("font-black tracking-tighter", isMobile ? "text-xl" : "text-4xl")}>성장트랙</h1>
          </div>
          <Badge variant="secondary" className={cn("rounded-full font-black gap-1.5 bg-accent/10 text-accent border-none", isMobile ? "h-7 px-3 text-[8px]" : "h-9 px-4 text-xs")}>
            <Sparkles className="h-3 w-3 sm:h-4 w-4" /> 포인트 부스트 x{totalBoost.toFixed(2)}
          </Badge>
        </div>
      </header>

      {/* 시즌 메인 대시보드 - 현재 티어 그라디언트 적용 */}
      <Card
        className={cn(
          "tier-hero-card border-none !text-white shadow-2xl overflow-hidden relative group transition-all duration-700",
          isMobile ? "rounded-[1.25rem] p-6" : "rounded-[3rem] p-12"
        )}
        style={{ backgroundImage: heroGradient }}
      >
        <div className="absolute top-0 right-0 p-8 opacity-20 rotate-12 transition-transform duration-1000 group-hover:scale-110">
          {currentTier.name === '챌린저' ? <Crown className={cn(isMobile ? "h-32 w-32" : "h-64 w-64")} /> : <Trophy className={cn(isMobile ? "h-32 w-32" : "h-64 w-64")} />}
        </div>
        <div className={cn("relative z-10 space-y-6", isMobile ? "space-y-4" : "space-y-10")}>
          <div className={cn("flex flex-col justify-between gap-4", isMobile ? "" : "md:flex-row md:items-end")}>
            <div className="space-y-1">
              <Badge className="bg-white/20 text-white border-none font-black text-[8px] sm:text-[10px] px-2 py-0.5 mb-1 sm:mb-2 tracking-widest whitespace-nowrap">시즌 {format(new Date(), 'M월', { locale: ko })}</Badge>
              <h2 className={cn("font-black tracking-tighter leading-none", isMobile ? "text-4xl" : "text-7xl")}>
                {currentLp.toLocaleString()}<span className={cn("opacity-80 ml-1 font-bold whitespace-nowrap", isMobile ? "text-sm" : "text-2xl")}>점</span>
              </h2>
              <p className={cn("font-bold opacity-90", isMobile ? "text-[10px]" : "text-sm")}>이번 시즌 누적 포인트</p>
            </div>
            
            <div className={cn("p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] bg-white/20 backdrop-blur-xl border border-white/20 flex flex-col items-center shadow-2xl", isMobile ? "w-fit" : "min-w-[180px]")}>
              <span className={cn("font-black uppercase tracking-widest opacity-80 mb-1", isMobile ? "text-[7px]" : "text-[10px]")}>현재 티어</span>
              <span className={cn("font-black tracking-tighter", isMobile ? "text-xl" : "text-3xl")}>{currentTier.name}</span>
              {!isMobile && <span className="text-[10px] font-bold mt-1 opacity-80">다음: {(25000 - currentLp).toLocaleString()}점</span>}
            </div>
          </div>

          <div className={cn("grid gap-2", isMobile ? "grid-cols-2" : "grid-cols-4")}>
            {[
              { label: '센터 랭킹', val: rankDisplay, icon: Trophy, color: 'text-yellow-400' },
              { label: '실력 지수', val: avgStat.toFixed(1), icon: Activity, color: 'text-orange-400' },
              { label: '부스트', val: `x${totalBoost.toFixed(2)}`, icon: Zap, color: 'text-emerald-400' },
              { label: '시즌 리셋', val: '매월 1일', icon: RefreshCw, color: 'text-blue-400' }
            ].map((item, i) => (
              <div key={i} className={cn("bg-white/15 p-3 sm:p-5 rounded-xl sm:rounded-3xl border border-white/20 flex flex-col gap-0.5")}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <item.icon className={cn(isMobile ? "h-2.5 w-2.5" : "h-3.5 w-3.5", item.color)} />
                  <span className={cn("font-black uppercase tracking-widest opacity-80", isMobile ? "text-[7px]" : "text-[9px]")}>{item.label}</span>
                </div>
                <div className={cn("font-black tracking-tight", isMobile ? "text-sm" : "text-xl")}>{item.val}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* 4대 핵심 스킬트랙 */}
      <section className={isMobile ? "space-y-3" : "space-y-6"}>
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Target className={cn("text-primary opacity-40", isMobile ? "h-4 w-4" : "h-6 w-6")} />
            <h2 className={cn("font-black tracking-tighter", isMobile ? "text-lg" : "text-2xl")}>스킬트랙</h2>
          </div>
          <Badge variant="outline" className="rounded-full font-black text-[9px] border-primary/20 px-2 h-5">평균: {avgStat.toFixed(1)}</Badge>
        </div>

        <div className={cn("grid gap-3", isMobile ? "grid-cols-2" : "md:grid-cols-4")}>
          {Object.entries(STAT_CONFIG).map(([key, config]) => {
            const statKey = key as StatKey;
            const val = stats[statKey] || 0;
            const history = skillTrackHistory[statKey] || [];
            const gainedTotal = history.reduce((sum, item) => sum + item.gained, 0);
            const Icon = config.icon;
            return (
              <Dialog key={key}>
                <DialogTrigger asChild>
                  <button type="button" className="text-left">
                    <Card className={cn("border-none bg-white shadow-lg overflow-hidden group ring-1 ring-black/[0.03] hover:-translate-y-0.5 transition-all cursor-pointer", isMobile ? "rounded-[1rem] p-4" : "rounded-[2.5rem] p-8")}>
                      <div className="flex items-center justify-between mb-3">
                        <div className={cn("rounded-lg", config.accent, isMobile ? "p-1.5" : "p-3")}>
                          <Icon className={cn(config.color, isMobile ? "h-4 w-4" : "h-6 w-6")} />
                        </div>
                        <span className={cn("font-black uppercase tracking-widest opacity-40", isMobile ? "text-[7px]" : "text-[9px]")}>{config.sub}</span>
                      </div>
                      <h3 className={cn("font-black tracking-tight mb-0.5", isMobile ? "text-xs" : "text-xl")}>{config.label}</h3>
                      <div className="flex items-baseline gap-1 mb-3">
                        <span className={cn("font-black tabular-nums", isMobile ? "text-xl" : "text-3xl")}>{val.toFixed(1)}</span>
                        <span className={cn("font-bold text-muted-foreground opacity-40", isMobile ? "text-[8px]" : "text-xs")}>/ 100</span>
                      </div>
                      <div className="relative h-1.5 w-full bg-muted rounded-full overflow-hidden shadow-inner mb-2">
                        <div className={cn("absolute inset-y-0 left-0 transition-all duration-1000 ease-out", config.bg)} style={{ width: `${val}%` }} />
                      </div>
                      {!isMobile && <p className="text-[10px] font-bold text-muted-foreground leading-tight mt-3 pt-3 border-t border-dashed">{config.guide}</p>}
                    </Card>
                  </button>
                </DialogTrigger>
                <DialogContent className={cn("border-none shadow-2xl p-0 overflow-hidden", isMobile ? "max-w-[92vw] rounded-[1.5rem]" : "sm:max-w-lg rounded-[2rem]")}>
                  <div className={cn("text-white", config.bg, isMobile ? "p-5" : "p-7")}>
                    <DialogHeader>
                      <DialogTitle className={cn("font-black tracking-tight", isMobile ? "text-xl" : "text-2xl")}>{SKILL_LABEL[statKey]} 점수 획득 이력</DialogTitle>
                      <DialogDescription className="text-white/80 font-semibold text-xs">
                        이번 시즌 누적 획득 +{gainedTotal.toFixed(2)}점
                      </DialogDescription>
                    </DialogHeader>
                  </div>
                  <div className={cn("bg-white overflow-y-auto custom-scrollbar", isMobile ? "max-h-[52vh] p-4" : "max-h-[60vh] p-6")}>
                    {history.length === 0 ? (
                      <div className="py-10 text-center text-sm font-bold text-muted-foreground">이번 시즌 획득 기록이 없습니다.</div>
                    ) : (
                      <div className="space-y-2">
                        {history.slice(0, 60).map((item, index) => (
                          <div key={`${item.dateKey}-${index}`} className="rounded-xl border bg-slate-50/70 px-3 py-2.5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[11px] font-black text-slate-500">{item.dateKey}</p>
                                <p className="text-sm font-black text-slate-900">{item.reason}</p>
                                <p className="text-xs font-semibold text-slate-600">{item.detail}</p>
                              </div>
                              <p className="shrink-0 text-sm font-black text-emerald-600">+{item.gained.toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            );
          })}
        </div>
      </section>

      {/* 가이드 섹션 - 모바일 최적화 */}
      <section className="px-1">
        <Card className={cn("border-none shadow-xl bg-white overflow-hidden ring-1 ring-black/[0.02]", isMobile ? "rounded-[1.25rem] p-5" : "rounded-[2.5rem] p-8")}>
          <CardTitle className={cn("font-black flex items-center gap-2 tracking-tighter mb-4", isMobile ? "text-sm" : "text-xl")}>
            <BookOpen className={cn("text-primary", isMobile ? "h-4 w-4" : "h-6 w-6")} /> 포인트 획득 가이드
          </CardTitle>
          <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-3")}>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 font-black text-[10px] text-primary uppercase"><Zap className="h-3 w-3 text-accent fill-current" /> 보너스 보상</div>
              <div className="grid gap-1.5">
                {[
                  { l: '출석 보너스 (3h↑)', v: '+100점' },
                  { l: '계획 보너스 (전부 완료)', v: '+100점' },
                  { l: '실시간 몰입 학습', v: '1분당 1점' }
                ].map(item => (
                  <div key={item.l} className="flex justify-between items-center px-3 py-2 rounded-lg bg-[#fafafa] border text-[9px] font-bold">
                    <span>{item.l}</span>
                    <span className="text-primary font-black">{item.v}</span>
                  </div>
                ))}
              </div>
            </div>
            {!isMobile && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-600"><TrendingUp className="h-3 w-3" /> 시즌 티어</div>
                  <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 h-full flex items-center"><p className="text-11px] font-bold leading-relaxed text-emerald-900/70">2.5만 포인트 이상은 센터 내 상대 순위로 결정됩니다. (1위: 챌린저, 2~3위: 그랜드마스터)</p></div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-purple-600"><Star className="h-3 w-3 fill-current" /> 감쇠 규칙</div>
                  <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 h-full flex items-center"><p className="text-[11px] font-bold leading-relaxed text-purple-900/70">매월 1일 시즌 종료 시 4대 스킬은 5%씩 감쇠합니다. 꾸준한 학습 품질 유지가 필수입니다.</p></div>
                </div>
              </>
            )}
          </div>
          <SystemGuideDialog />
        </Card>
      </section>
    </div>
  );
}
