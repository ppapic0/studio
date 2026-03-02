'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/contexts/app-context';
import { useDoc, useFirestore, useUser } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { GrowthProgress } from '@/lib/types';
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
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const STAT_CONFIG = {
  focus: { label: '집중력', sub: 'FOCUS', icon: Target, color: 'text-blue-500', bg: 'bg-blue-500' },
  consistency: { label: '꾸준함', sub: 'CONSISTENCY', icon: RefreshCw, color: 'text-emerald-500', bg: 'bg-emerald-500' },
  achievement: { label: '목표달성', sub: 'ACHIEVEMENT', icon: CheckCircle2, color: 'text-amber-500', bg: 'bg-amber-500' },
  resilience: { label: '회복력', sub: 'RESILIENCE', icon: ShieldCheck, color: 'text-rose-500', bg: 'bg-rose-500' },
};

const TIERS = [
  { name: '아이언', min: 0, color: 'text-slate-400', bg: 'bg-slate-400' },
  { name: '브론즈', min: 20, color: 'text-orange-700', bg: 'bg-orange-700' },
  { name: '실버', min: 40, color: 'text-slate-300', bg: 'bg-slate-300' },
  { name: '골드', min: 60, color: 'text-yellow-500', bg: 'bg-yellow-500' },
  { name: '플래티넘', min: 75, color: 'text-emerald-400', bg: 'bg-emerald-400' },
  { name: '다이아몬드', min: 85, color: 'text-blue-400', bg: 'bg-blue-400' },
  { name: '마스터', min: 95, color: 'text-purple-500', bg: 'bg-purple-500' },
];

function SystemGuideDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full mt-4 rounded-2xl text-xs font-black border-dashed border-2 h-12 hover:bg-primary/5 transition-all">
          <Info className="mr-2 h-4 w-4" /> LP 및 마스터리 가이드 보기
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden">
        <div className="bg-primary p-10 text-primary-foreground relative">
          <Sparkles className="absolute top-4 right-4 h-12 w-12 opacity-20" />
          <DialogHeader>
            <DialogTitle className="text-3xl font-black tracking-tighter">LP 성장 시스템 가이드</DialogTitle>
            <DialogDescription className="text-primary-foreground/70 font-bold mt-2">
              행동 보상(LP)과 질적 평가(스탯)가 결합된 정밀 성장 시스템입니다.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-10 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            <h4 className="font-black text-primary flex items-center gap-2">
              <Zap className="h-4 w-4 fill-current" /> 하루 기본 LP (최대 1,000)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: '계획 수립', v: 200 }, { l: '출석 확인', v: 200 },
                { l: '목표 달성', v: 200 }, { l: '6시간 보너스', v: 200 }
              ].map(item => (
                <div key={item.l} className="p-4 rounded-2xl bg-muted/50 border flex justify-between items-center">
                  <span className="text-xs font-bold">{item.l}</span>
                  <span className="text-sm font-black text-primary">+{item.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-black text-primary flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> 강력한 부스트 시스템
            </h4>
            <div className="p-6 rounded-3xl bg-blue-50 border border-blue-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-blue-900">마스터리 부스트 (영구)</span>
                <span className="text-xs font-black text-blue-600">MAX +10%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-blue-900">4스탯 품질 배율 (현재)</span>
                <span className="text-xs font-black text-blue-600">MAX +10%</span>
              </div>
              <p className="text-[10px] font-bold text-blue-700/60 leading-relaxed pt-2 border-t border-blue-200">
                ※ 최종 부스트는 최대 1.20배까지 적용되며, 행동당 보너스는 25 LP를 초과할 수 없습니다.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-black text-primary flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> 시즌 리셋 규칙
            </h4>
            <p className="text-xs font-bold text-muted-foreground leading-relaxed">
              - 30일마다 시즌이 종료됩니다.<br/>
              - **LP는 0으로 리셋**되며, **4스탯은 5% 감쇠**됩니다.<br/>
              - **마스터리(누적 노력)**는 리셋 없이 영구적으로 유지됩니다.
            </p>
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

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
  }, [firestore, activeMembership?.id, user?.uid]);

  const { data: progress, isLoading } = useDoc<GrowthProgress>(progressRef);

  const stats = progress?.stats || { focus: 0, consistency: 0, achievement: 0, resilience: 0 };
  const avgStat = useMemo(() => {
    const values = Object.values(stats);
    return values.reduce((a, b) => a + b, 0) / values.length;
  }, [stats]);

  const currentTier = useMemo(() => {
    return TIERS.slice().reverse().find(t => avgStat >= t.min) || TIERS[0];
  }, [avgStat]);

  const masteryBoost = useMemo(() => 1 + ((progress?.mastery || 0) / 100) * 0.10, [progress?.mastery]);
  const statBoost = useMemo(() => 1 + (avgStat / 100) * 0.10, [avgStat]);
  const totalBoost = Math.min(1.20, masteryBoost * statBoost);

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className={cn("flex flex-col pb-24", isMobile ? "gap-5 px-1" : "gap-10")}>
      <header className={cn("flex flex-col", isMobile ? "gap-1" : "gap-2")}>
        <div className="flex items-center gap-3">
          <div className="bg-primary rounded-2xl p-2.5 shadow-lg shadow-primary/20">
            <TrendingUp className="text-white h-6 w-6" />
          </div>
          <h1 className={cn("font-black tracking-tighter", isMobile ? "text-2xl" : "text-4xl")}>성장 로드맵</h1>
        </div>
        <p className={cn("font-bold text-muted-foreground ml-1", isMobile ? "text-[10px] uppercase tracking-widest" : "text-sm")}>Season Mastery & Performance Engine</p>
      </header>

      {/* 시즌 메인 대시보드 */}
      <Card className="border-none bg-primary text-primary-foreground shadow-2xl rounded-[3rem] overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-700">
          <Trophy className={cn(isMobile ? "h-32 w-32" : "h-64 w-64")} />
        </div>
        <div className={cn("relative z-10 p-8 sm:p-12 space-y-10")}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <Badge className="bg-white/20 text-white border-none font-black text-[10px] px-3 py-1 mb-2">SEASON 2025-03</Badge>
              <h2 className={cn("font-black tracking-tighter leading-none", isMobile ? "text-5xl" : "text-7xl")}>
                {(progress?.seasonLp || 0).toLocaleString()}<span className="text-2xl opacity-40 ml-2">LP</span>
              </h2>
              <p className="text-sm font-bold opacity-60">현재 시즌 행동 보상 총계</p>
            </div>
            
            <div className="flex flex-col items-center md:items-end gap-2">
              <div className={cn("p-6 rounded-[2.5rem] bg-white/10 backdrop-blur-xl border border-white/10 flex flex-col items-center min-w-[180px] shadow-2xl")}>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-2">Current Tier</span>
                <span className={cn("text-3xl font-black tracking-tighter", currentTier.color)}>{currentTier.name}</span>
                <span className="text-[10px] font-bold mt-1 opacity-40">실력 지수: {avgStat.toFixed(1)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: '누적 마스터리', val: `Lv.${progress?.mastery || 0}`, sub: '노력의 보상', icon: Crown, color: 'text-amber-400' },
              { label: '통합 부스트', val: `x${totalBoost.toFixed(2)}`, sub: 'LP 가중치', icon: Zap, color: 'text-accent' },
              { label: '시즌 랭킹', val: '상위 12%', sub: '전체 기준', icon: Trophy, color: 'text-emerald-400' },
              { label: '시즌 남은 일수', val: '18일', sub: '3월 시즌 종료', icon: RefreshCw, color: 'text-blue-400' }
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

      {/* 4대 핵심 품질 스탯 */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-primary opacity-40" />
            <h2 className="text-2xl font-black tracking-tighter">품질 평가 스탯</h2>
          </div>
          <Badge variant="outline" className="rounded-full font-black text-[10px] border-primary/20 px-3">AVG: {avgStat.toFixed(1)}</Badge>
        </div>

        <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-4")}>
          {Object.entries(STAT_CONFIG).map(([key, config]) => {
            const val = stats[key as keyof typeof stats] || 0;
            const Icon = config.icon;
            return (
              <Card key={key} className="border-none bg-white shadow-xl rounded-[2.5rem] overflow-hidden group hover:-translate-y-1 transition-all duration-500">
                <CardHeader className="p-8 pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className={cn("p-3 rounded-2xl bg-opacity-10", config.bg)}>
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
                <CardContent className="px-8 pb-8">
                  <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner mb-4">
                    <div 
                      className={cn("absolute inset-y-0 left-0 transition-all duration-1000 ease-out rounded-full", config.bg)}
                      style={{ width: `${val}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground">
                    <span>품질 배율</span>
                    <span className={config.color}>x{(1 + (val/100)*0.10).toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 마스터리 상세 분석 */}
      <div className="grid gap-6 md:grid-cols-12 px-1">
        <Card className="md:col-span-7 rounded-[3rem] border-none shadow-2xl bg-white p-10 space-y-8">
          <div className="space-y-1">
            <h3 className="text-2xl font-black tracking-tighter flex items-center gap-2">
              <Crown className="h-6 w-6 text-amber-500" /> 영구 성장 마스터리
            </h3>
            <p className="text-sm font-bold text-muted-foreground">시즌이 바뀌어도 유지되는 당신의 정수입니다.</p>
          </div>
          
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <div className="grid gap-1">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Mastery Level</span>
                <span className="text-5xl font-black text-primary">Lv.{progress?.mastery || 0}</span>
              </div>
              <div className="text-right">
                <Badge className="bg-amber-100 text-amber-700 border-none font-black text-[10px] mb-2 px-3">PERMANENT BOOST</Badge>
                <p className="text-2xl font-black text-amber-600">+{( (progress?.mastery || 0) / 10 * 1 ).toFixed(1)}%</p>
              </div>
            </div>
            <Progress value={progress?.mastery || 0} className="h-3 bg-muted" />
            <p className="text-xs font-bold text-muted-foreground leading-relaxed bg-[#fafafa] p-5 rounded-2xl border border-dashed italic text-center">
              "Lv.100 마스터리는 하루 6시간 몰입을 300일간 지속해야 도달할 수 있는 전설적인 경지입니다."
            </p>
          </div>
        </Card>

        <Card className="md:col-span-5 rounded-[3rem] border-none shadow-2xl bg-[#fafafa] p-10 flex flex-col justify-center gap-6">
          <div className="p-6 rounded-[2rem] bg-white shadow-sm border space-y-4">
            <h4 className="font-black text-xs uppercase text-primary/40 flex items-center gap-2 tracking-widest">Next Tier Goal</h4>
            <div className="flex items-center justify-between">
              <span className="text-lg font-black text-muted-foreground">{currentTier.name}</span>
              <ChevronRight className="h-5 w-5 opacity-20" />
              <span className="text-lg font-black text-primary">
                {TIERS[TIERS.indexOf(currentTier) + 1]?.name || 'MAX'}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-black opacity-40 uppercase">
                <span>평균 스탯 달성률</span>
                <span>{Math.round((avgStat / (TIERS[TIERS.indexOf(currentTier) + 1]?.min || 100)) * 100)}%</span>
              </div>
              <Progress value={(avgStat / (TIERS[TIERS.indexOf(currentTier) + 1]?.min || 100)) * 100} className="h-1.5" />
            </div>
          </div>
          <SystemGuideDialog />
        </Card>
      </div>
    </div>
  );
}
