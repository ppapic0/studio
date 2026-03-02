'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/contexts/app-context';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc, setDoc, serverTimestamp, collection, query, where } from 'firebase/firestore';
import { GrowthProgress, LeaderboardEntry } from '@/lib/types';
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

const STAT_CONFIG = {
  focus: { 
    label: '집중력', 
    sub: 'FOCUS', 
    icon: Target, 
    color: 'text-blue-500', 
    bg: 'bg-blue-500', 
    accent: 'bg-blue-50',
    guide: '실시간 몰입 시간에 비례하여 상승합니다. (100분당 +1.0)'
  },
  consistency: { 
    label: '꾸준함', 
    sub: 'CONSISTENCY', 
    icon: RefreshCw, 
    color: 'text-emerald-500', 
    bg: 'bg-emerald-500', 
    accent: 'bg-emerald-50',
    guide: '매일 잊지 않고 출석 트랙을 시작하면 상승합니다. (일일 +0.1)'
  },
  achievement: { 
    label: '목표달성', 
    sub: 'ACHIEVEMENT', 
    icon: CheckCircle2, 
    color: 'text-amber-500', 
    bg: 'bg-amber-500', 
    accent: 'bg-amber-50',
    guide: '계획트랙의 To-do를 완료할 때마다 실시간으로 상승합니다. (항목당 +0.05)'
  },
  resilience: { 
    label: '회복력', 
    sub: 'RESILIENCE', 
    icon: ShieldCheck, 
    color: 'text-rose-500', 
    bg: 'bg-rose-500', 
    accent: 'bg-rose-50',
    guide: '6시간 이상의 초몰입 달성 시 가장 강력하게 상승합니다. (보너스 발생 시 +0.5)'
  },
};

const TIERS = [
  { name: '아이언', min: 0, color: 'text-slate-400', bg: 'bg-slate-400', border: 'border-slate-200', gradient: 'from-slate-500 via-slate-600 to-slate-800' },
  { name: '브론즈', min: 5000, color: 'text-orange-700', bg: 'bg-orange-700', border: 'border-orange-200', gradient: 'from-orange-600 via-orange-700 to-orange-900' },
  { name: '실버', min: 10000, color: 'text-slate-300', bg: 'bg-slate-300', border: 'border-slate-100', gradient: 'from-blue-300 via-slate-400 to-slate-600' },
  { name: '골드', min: 15000, color: 'text-yellow-500', bg: 'bg-yellow-500', border: 'border-yellow-200', gradient: 'from-amber-400 via-yellow-500 to-yellow-700' },
  { name: '플래티넘', min: 20000, color: 'text-emerald-400', bg: 'bg-emerald-400', border: 'border-emerald-200', gradient: 'from-emerald-400 via-teal-500 to-teal-700' },
  { name: '다이아몬드', min: 25000, color: 'text-blue-400', bg: 'bg-blue-400', border: 'border-blue-200', gradient: 'from-blue-400 via-indigo-500 to-indigo-700' },
  { name: '마스터', min: 25000, color: 'text-purple-500', bg: 'bg-purple-500', border: 'border-purple-200', gradient: 'from-purple-500 via-violet-600 to-violet-800' },
  { name: '그랜드마스터', min: 25000, color: 'text-rose-500', bg: 'bg-rose-500', border: 'border-rose-200', gradient: 'from-rose-500 via-pink-600 to-rose-800' },
  { name: '챌린저', min: 25000, color: 'text-cyan-400', bg: 'bg-cyan-400', border: 'border-cyan-200', gradient: 'from-cyan-400 via-blue-500 to-indigo-600' },
];

function SystemGuideDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full mt-4 rounded-2xl text-xs font-black border-dashed border-2 h-12 hover:bg-primary/5 transition-all">
          <Info className="mr-2 h-4 w-4" /> 시즌 티어 및 리셋 가이드 보기
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden">
        <div className="bg-primary p-10 text-primary-foreground relative">
          <Sparkles className="absolute top-4 right-4 h-12 w-12 opacity-20" />
          <DialogHeader>
            <DialogTitle className="text-3xl font-black tracking-tighter">성장트랙 가이드</DialogTitle>
            <DialogDescription className="text-primary-foreground/70 font-bold mt-2">
              활동량(LP)으로 증명하는 시즌제 등급 시스템입니다.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-10 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar bg-white">
          <div className="space-y-4">
            <h4 className="font-black text-primary flex items-center gap-2">
              <Zap className="h-4 w-4 fill-current text-accent" /> 1. 행동 보상 LP (일일 최대 보너스)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { l: '출석 보너스', v: 200, d: '당일 3시간 이상 학습 시' },
                { l: '계획 완료', v: 200, d: '모든 To-do 완료 시' },
                { l: '성장 보너스', v: 200, d: '품질 목표 도달 시' }
              ].map(item => (
                <div key={item.l} className="p-4 rounded-2xl bg-muted/30 border flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black">{item.l}</span>
                    <span className="text-sm font-black text-primary">+{item.v}</span>
                  </div>
                  <span className="text-[9px] font-bold text-muted-foreground">{item.d}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-black text-primary flex items-center gap-2">
              <Trophy className="h-4 w-4 text-emerald-500" /> 2. 티어 판정 (LP + 랭킹)
            </h4>
            <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-100">
              <p className="text-xs font-bold text-emerald-900/70 leading-relaxed">
                - **아이언 ~ 다이아몬드**: 0 ~ 25,000 LP 구간 (포인트로 결정)<br/>
                - **챌린저**: 25,000 LP 이상 중 **센터 1위**<br/>
                - **그랜드마스터**: 25,000 LP 이상 중 **센터 2, 3위**<br/>
                - **마스터**: 25,000 LP 이상 상위권
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h4 className="font-black text-primary flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-rose-500" /> 3. 시즌 리셋 규칙
            </h4>
            <div className="p-5 rounded-2xl bg-rose-50/50 border border-rose-100">
              <p className="text-xs font-bold text-rose-900/70 leading-relaxed">
                - **30일**마다 시즌이 종료됩니다.<br/>
                - **시즌 LP는 0으로 리셋**되어 모든 학생이 다시 시작합니다.<br/>
                - **스킬 스탯(집중/꾸준함 등)은 5% 감쇠**됩니다.
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
  const { activeMembership, viewMode } = useAppContext();
  const firestore = useFirestore();
  const isMobile = viewMode === 'mobile';
  const periodKey = format(new Date(), 'yyyy-MM');

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
  }, [firestore, activeMembership?.id, user?.uid]);

  const { data: progress, isLoading } = useDoc<GrowthProgress>(progressRef);

  // 실시간 랭킹 조회
  const rankQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'leaderboards', `${periodKey}_lp`, 'entries'),
      where('studentId', '==', user.uid)
    );
  }, [firestore, activeMembership?.id, user?.uid, periodKey]);
  const { data: rankEntries } = useCollection<LeaderboardEntry>(rankQuery);
  const currentRank = rankEntries?.[0]?.rank || 999;

  const stats = useMemo(() => {
    const raw = progress?.stats || { focus: 0, consistency: 0, achievement: 0, resilience: 0 };
    return {
      focus: Math.min(100, raw.focus),
      consistency: Math.min(100, raw.consistency),
      achievement: Math.min(100, raw.achievement),
      resilience: Math.min(100, raw.resilience),
    };
  }, [progress?.stats]);

  const avgStat = useMemo(() => {
    const values = Object.values(stats);
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [stats]);

  const currentLp = progress?.seasonLp || 0;
  const currentTier = useMemo(() => {
    if (currentLp >= 25000) {
      if (currentRank === 1) return TIERS.find(t => t.name === '챌린저')!;
      if (currentRank === 2 || currentRank === 3) return TIERS.find(t => t.name === '그랜드마스터')!;
      return TIERS.find(t => t.name === '마스터')!;
    }
    return TIERS.slice(0, 6).reverse().find(t => currentLp >= t.min) || TIERS[0];
  }, [currentLp, currentRank]);

  const statBoost = useMemo(() => 1 + (avgStat / 100) * 0.10, [avgStat]);
  const totalBoost = Math.min(1.20, statBoost);

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className={cn("flex flex-col pb-24", isMobile ? "gap-5 px-1" : "gap-10")}>
      <header className={cn("flex flex-col", isMobile ? "gap-1" : "gap-2")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary rounded-2xl p-2.5 shadow-lg shadow-primary/20">
              <TrendingUp className="text-white h-6 w-6" />
            </div>
            <h1 className={cn("font-black tracking-tighter", isMobile ? "text-2xl" : "text-4xl")}>성장트랙</h1>
          </div>
          <Badge variant="secondary" className="rounded-full font-black px-4 py-1 gap-2 bg-accent/10 text-accent border-none h-9">
            <Sparkles className="h-4 w-4" /> LP 부스트 x{totalBoost.toFixed(2)}
          </Badge>
        </div>
        <p className={cn("font-bold text-muted-foreground ml-1", isMobile ? "text-[10px] uppercase tracking-widest" : "text-sm")}>Season Tier & Skill Track Management</p>
      </header>

      {/* 시즌 메인 대시보드 - 프리미엄 강화 */}
      <Card className={cn(
        "border-none text-white shadow-2xl rounded-[3rem] overflow-hidden relative group transition-all duration-700",
        "bg-gradient-to-br", currentTier.gradient
      )}>
        <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-700">
          {currentTier.name === '챌린저' ? <Crown className={cn(isMobile ? "h-32 w-32" : "h-64 w-64")} /> : <Trophy className={cn(isMobile ? "h-32 w-32" : "h-64 w-64")} />}
        </div>
        <div className={cn("relative z-10 p-8 sm:p-12 space-y-10")}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <Badge className="bg-white/20 text-white border-none font-black text-[10px] px-3 py-1 mb-2 uppercase tracking-widest">SEASON {format(new Date(), 'MMM').toUpperCase()}</Badge>
              <h2 className={cn("font-black tracking-tighter leading-none", isMobile ? "text-5xl" : "text-7xl")}>
                {currentLp.toLocaleString()}<span className="text-2xl opacity-40 ml-2 uppercase font-bold">lp</span>
              </h2>
              <p className="text-sm font-bold opacity-60">이번 시즌 누적 포인트 (티어 결정 기준)</p>
            </div>
            
            <div className="flex flex-col items-center md:items-end gap-2">
              <div className={cn("p-6 rounded-[2.5rem] bg-white/10 backdrop-blur-xl border border-white/10 flex flex-col items-center min-w-[180px] shadow-2xl")}>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-2">Current Tier</span>
                <span className={cn("text-3xl font-black tracking-tighter")}>{currentTier.name}</span>
                <span className="text-[10px] font-bold mt-1 opacity-40">
                  {currentTier.name === '챌린저' ? '압도적 1위 유지 중' : 
                   currentTier.name === '그랜드마스터' ? '정상 탈환 도전 중' :
                   `다음 승급까지: ${Math.max(0, (TIERS.find(t => t.min > currentLp)?.min || 25000) - currentLp).toLocaleString()} LP`}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: '센터 랭킹', val: `${currentRank}위`, sub: '전체 재원생 기준', icon: Trophy, color: 'text-yellow-400' },
              { label: '실력 지수', val: avgStat.toFixed(1), sub: '품질 스탯 평균', icon: Activity, color: 'text-orange-400' },
              { label: '스킬 부스트', val: `x${statBoost.toFixed(2)}`, sub: '획득량 가중치', icon: Zap, color: 'text-emerald-400' },
              { label: '시즌 남은 일수', val: '18일', sub: '월간 리셋 예정', icon: RefreshCw, color: 'text-blue-400' }
            ].map((item, i) => (
              <div key={i} className="bg-white/5 p-5 rounded-3xl border border-white/5 flex flex-col gap-1">
                <div className="flex items-center gap-2 mb-1">
                  <item.icon className={cn("h-3.5 w-3.5", item.color)} />
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-40">{item.label}</span>
                </div>
                <div className="text-xl font-black tracking-tight">{item.val}</div>
                <span className="text-[9px] font-bold opacity-30">{item.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* 4대 핵심 스킬트랙 */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-primary opacity-40" />
            <h2 className="text-2xl font-black tracking-tighter">스킬트랙</h2>
          </div>
          <Badge variant="outline" className="rounded-full font-black text-[10px] border-primary/20 px-3">AVG: {avgStat.toFixed(1)}</Badge>
        </div>

        <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-4")}>
          {Object.entries(STAT_CONFIG).map(([key, config]) => {
            const val = stats[key as keyof typeof stats] || 0;
            const Icon = config.icon;
            return (
              <Card key={key} className="border-none bg-white shadow-xl rounded-[2.5rem] overflow-hidden group hover:-translate-y-1 transition-all duration-500 ring-1 ring-black/[0.03]">
                <CardHeader className="p-8 pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn("p-3 rounded-2xl", config.accent)}>
                      <Icon className={cn("h-6 w-6", config.color)} />
                    </div>
                    <span className={cn("font-black text-[9px] uppercase tracking-widest opacity-40")}>{config.sub}</span>
                  </div>
                  <CardTitle className={cn("text-xl font-black tracking-tight mb-1")}>{config.label}</CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black tabular-nums">{val.toFixed(1)}</span>
                    <span className="text-xs font-bold text-muted-foreground opacity-40">/ 100</span>
                  </div>
                </CardHeader>
                <CardContent className="px-8 pb-8 space-y-4">
                  <div>
                    <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner mb-2">
                      <div 
                        className={cn("absolute inset-y-0 left-0 transition-all duration-1000 ease-out rounded-full", config.bg)}
                        style={{ width: `${val}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground">
                      <span>부스트 기여</span>
                      <span className={cn("font-black", config.color)}>+{(val/100*10).toFixed(1)}%</span>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-dashed">
                    <p className="text-[10px] font-black text-primary/40 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3" /> 획득 가이드
                    </p>
                    <p className="text-[11px] font-bold text-muted-foreground leading-relaxed">
                      {config.guide}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 티어 목표 요약 */}
      <div className="px-1">
        <Card className="rounded-[3rem] border-none shadow-2xl bg-[#fafafa] p-10 flex flex-col md:flex-row items-center justify-between gap-8 ring-1 ring-black/[0.02]">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-2xl font-black tracking-tighter">상위 티어 도전</h3>
            <p className="text-sm font-bold text-muted-foreground">챌린저는 센터 1위, 그랜드마스터는 2~3위에게만 허락됩니다.</p>
          </div>
          
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-4">
              <span className="text-lg font-black text-muted-foreground">{currentTier.name}</span>
              <ChevronRight className="h-5 w-5 opacity-20" />
              <span className="text-lg font-black text-primary">
                {currentRank === 1 ? 'LEGEND' : currentRank <= 3 ? 'CHALLENGER' : 'TOP 3'}
              </span>
            </div>
            <div className="w-48 space-y-1.5">
              <div className="flex justify-between text-[10px] font-black opacity-40 uppercase">
                <span>랭킹 승급까지</span>
                <span>{currentRank > 3 ? `${currentRank - 3}명 추월 필요` : currentRank === 1 ? 'Champion' : '1위 도전 중'}</span>
              </div>
              <Progress value={currentRank <= 3 ? 100 : (10 / currentRank) * 100} className="h-1.5" />
            </div>
          </div>
        </Card>
      </div>

      {/* LP 성취 가이드 섹션 - 페이지 최하단 */}
      <section className="animate-in slide-in-from-top-4 duration-1000">
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/[0.02]">
          <CardHeader className="bg-muted/5 border-b p-8">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-black flex items-center gap-3 tracking-tighter">
                <BookOpen className="h-6 w-6 text-primary" /> LP 획득 및 성장 가이드
              </CardTitle>
              <Badge className="bg-primary/5 text-primary border-none font-black text-[9px] uppercase tracking-widest">Guide</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-black text-xs text-primary uppercase"><Zap className="h-4 w-4 text-accent fill-current" /> 행동 보상</div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 rounded-xl bg-[#fafafa] border">
                    <span className="text-[11px] font-bold">출석/계획/품질 보너스</span>
                    <span className="text-xs font-black text-primary">각 +200 LP</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-xl bg-[#fafafa] border">
                    <span className="text-[11px] font-bold">실시간 몰입 학습</span>
                    <span className="text-xs font-black text-primary">1분당 1 LP</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 ml-1">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <h4 className="text-[10px] font-black uppercase text-emerald-600 tracking-[0.2em]">Season Tier</h4>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 h-[88px] flex items-center">
                  <p className="text-[11px] font-bold leading-relaxed text-emerald-900/70">
                    2.5만 LP까지는 포인트로, 그 이상은 **센터 내 상대 순위**로 결정됩니다. (1위: 챌린저, 2~3위: 그랜드마스터)
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 ml-1">
                  <Star className="h-4 w-4 text-purple-600 fill-current" />
                  <h4 className="text-[10px] font-black uppercase text-purple-600 tracking-[0.2em]">Decay Rule</h4>
                </div>
                <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 h-[88px] flex items-center">
                  <p className="text-[11px] font-bold leading-relaxed text-purple-900/70">
                    시즌 종료 시 4대 스킬은 **5%씩 감쇠**합니다. 꾸준한 학습 품질 유지가 필수입니다.
                  </p>
                </div>
              </div>
            </div>
            <SystemGuideDialog />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
