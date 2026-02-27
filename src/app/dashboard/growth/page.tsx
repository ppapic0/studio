'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/contexts/app-context';
import { useDoc, useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { GrowthProgress, SkillNode } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Lock, 
  Unlock, 
  Star, 
  Target, 
  RefreshCw, 
  CheckCircle2, 
  ShieldCheck, 
  Info,
  Trophy,
  Crown,
  Medal,
  ArrowRight,
  TrendingUp,
  CalendarDays,
  Sparkles,
  ArrowUpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

// 확장된 20개 스킬 로드맵
const MOCK_SKILLS: (SkillNode & { link: string })[] = [
  // --- FOCUS BRANCH ---
  { id: 'f1', branch: 'focus', name: '딥워크 25', description: '25분 집중 세션 3회 달성하여 몰입의 기초를 다집니다.', maxLevel: 3, prerequisites: [], unlockCondition: { stat: 'focus', value: 10 }, effects: { xp: 1.03 }, iconKey: 'Target', link: '/dashboard' },
  { id: 'f2', branch: 'focus', name: '방해 금지', description: '중단 없는 세션 5회 연속 달성 시 해금됩니다.', maxLevel: 1, prerequisites: ['f1'], unlockCondition: { stat: 'focus', value: 25 }, effects: { xp: 1.05 }, iconKey: 'Target', link: '/dashboard' },
  { id: 'f3', branch: 'focus', name: '몰입의 강도', description: '평균 집중도 90% 이상을 일주일간 유지하세요.', maxLevel: 3, prerequisites: ['f2'], unlockCondition: { stat: 'focus', value: 45 }, effects: { xp: 1.08 }, iconKey: 'Flame', link: '/dashboard' },
  { id: 'f4', branch: 'focus', name: '하이퍼 포커스', description: '3시간 이상의 초몰입 세션을 성공적으로 마쳤습니다.', maxLevel: 5, prerequisites: ['f3'], unlockCondition: { stat: 'focus', value: 70 }, effects: { xp: 1.12 }, iconKey: 'Zap', link: '/dashboard' },
  { id: 'f5', branch: 'focus', name: '몰입의 대가', description: '어떤 환경에서도 즉시 몰입 상태에 진입할 수 있습니다.', maxLevel: 1, prerequisites: ['f4'], unlockCondition: { stat: 'focus', value: 95 }, effects: { xp: 1.20 }, iconKey: 'Crown', link: '/dashboard' },

  // --- CONSISTENCY BRANCH ---
  { id: 'c1', branch: 'consistency', name: '작심삼일 타파', description: '3일 동안 멈추지 않고 학습을 기록했습니다.', maxLevel: 1, prerequisites: [], unlockCondition: { stat: 'consistency', value: 10 }, effects: { xp: 1.03 }, iconKey: 'RefreshCw', link: '/dashboard' },
  { id: 'c2', branch: 'consistency', name: '일주일의 기적', description: '7일 연속 출석 시 주간 보너스가 강화됩니다.', maxLevel: 1, prerequisites: ['c1'], unlockCondition: { stat: 'consistency', value: 25 }, effects: { xp: 1.07 }, iconKey: 'Medal', link: '/dashboard' },
  { id: 'c3', branch: 'consistency', name: '루틴 정착', description: '30일 중 25일 이상 학습을 완료하는 습관을 형성합니다.', maxLevel: 3, prerequisites: ['c2'], unlockCondition: { stat: 'consistency', value: 50 }, effects: { xp: 1.10 }, iconKey: 'RefreshCw', link: '/dashboard' },
  { id: 'c4', branch: 'consistency', name: '철의 의지', description: '100일 연속 학습이라는 경이로운 기록에 도전하세요.', maxLevel: 1, prerequisites: ['c3'], unlockCondition: { stat: 'consistency', value: 80 }, effects: { xp: 1.15 }, iconKey: 'Flame', link: '/dashboard' },
  { id: 'c5', branch: 'consistency', name: '습관의 화신', description: '학습이 일상의 숨쉬기처럼 자연스러운 단계입니다.', maxLevel: 1, prerequisites: ['c4'], unlockCondition: { stat: 'consistency', value: 98 }, effects: { xp: 1.25 }, iconKey: 'Crown', link: '/dashboard' },

  // --- ACHIEVEMENT BRANCH ---
  { id: 'a1', branch: 'achievement', name: '오늘 완벽', description: '오늘 설정한 자습 To-do를 100% 달성했습니다.', maxLevel: 3, prerequisites: [], unlockCondition: { stat: 'achievement', value: 15 }, effects: { xp: 1.05 }, iconKey: 'CheckCircle2', link: '/dashboard/plan' },
  { id: 'a2', branch: 'achievement', name: '과목 밸런스', description: '3개 이상의 과목을 편식 없이 고르게 학습했습니다.', maxLevel: 1, prerequisites: ['a1'], unlockCondition: { stat: 'achievement', value: 30 }, effects: { xp: 1.08 }, iconKey: 'Target', link: '/dashboard/plan' },
  { id: 'a3', branch: 'achievement', name: '주간 정복자', description: '한 주간 모든 목표 달성률 95% 이상을 기록하세요.', maxLevel: 3, prerequisites: ['a2'], unlockCondition: { stat: 'achievement', value: 55 }, effects: { xp: 1.12 }, iconKey: 'Trophy', link: '/dashboard/plan' },
  { id: 'a4', branch: 'achievement', name: '전략적 플래너', description: '자신에게 딱 맞는 학습량을 스스로 설계하고 달성합니다.', maxLevel: 1, prerequisites: ['a3'], unlockCondition: { stat: 'achievement', value: 75 }, effects: { xp: 1.18 }, iconKey: 'Zap', link: '/dashboard/plan' },
  { id: 'a5', branch: 'achievement', name: '성취의 정점', description: '설정한 모든 원대한 목표를 현실로 만들어냅니다.', maxLevel: 1, prerequisites: ['a4'], unlockCondition: { stat: 'achievement', value: 95 }, effects: { xp: 1.30 }, iconKey: 'Crown', link: '/dashboard/plan' },

  // --- RESILIENCE BRANCH ---
  { id: 'r1', branch: 'resilience', name: '빠른 회복', description: '슬럼프 감지 후 2일 이내에 다시 학습을 시작했습니다.', maxLevel: 1, prerequisites: [], unlockCondition: { stat: 'resilience', value: 15 }, effects: { xp: 1.05 }, iconKey: 'ShieldCheck', link: '/dashboard/study-history' },
  { id: 'r2', branch: 'resilience', name: '역전의 발판', description: '성적이 하락한 과목에 더 많은 시간을 투자하여 극복합니다.', maxLevel: 1, prerequisites: ['r1'], unlockCondition: { stat: 'resilience', value: 35 }, effects: { xp: 1.08 }, iconKey: 'RefreshCw', link: '/dashboard/study-history' },
  { id: 'r3', branch: 'resilience', name: '강철 멘탈', description: '어떤 외부 유혹에도 흔들리지 않고 자리를 지킵니다.', maxLevel: 3, prerequisites: ['r2'], unlockCondition: { stat: 'resilience', value: 60 }, effects: { xp: 1.12 }, iconKey: 'ShieldCheck', link: '/dashboard/study-history' },
  { id: 'r4', branch: 'resilience', name: '슬럼프 파괴자', description: '슬럼프를 성장의 기회로 바꾸는 능력을 갖췄습니다.', maxLevel: 1, prerequisites: ['r3'], unlockCondition: { stat: 'resilience', value: 85 }, effects: { xp: 1.20 }, iconKey: 'Zap', link: '/dashboard/study-history' },
  { id: 'r5', branch: 'resilience', name: '불굴의 마스터', description: '실패를 두려워하지 않으며 끊임없이 재도전합니다.', maxLevel: 1, prerequisites: ['r4'], unlockCondition: { stat: 'resilience', value: 98 }, effects: { xp: 1.30 }, iconKey: 'Crown', link: '/dashboard/study-history' },
];

const STAT_CONFIG = {
  focus: { label: '집중력', sub: 'FOCUS', icon: Target, color: 'text-blue-500', bg: 'bg-blue-500' },
  consistency: { label: '꾸준함', sub: 'CONSISTENCY', icon: RefreshCw, color: 'text-emerald-500', bg: 'bg-emerald-500' },
  achievement: { label: '목표달성', sub: 'ACHIEVEMENT', icon: CheckCircle2, color: 'text-amber-500', bg: 'bg-amber-500' },
  resilience: { label: '회복력', sub: 'RESILIENCE', icon: ShieldCheck, color: 'text-rose-500', bg: 'bg-rose-500' },
};

const MAX_LEVEL = 30;
const TOTAL_MASTER_XP = 150000; 

function SystemGuideDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full mt-2 rounded-xl text-xs font-black border-dashed border-2 h-10 hover:bg-primary/5 transition-colors">
          성장 시스템 가이드 보기
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
        <div className="bg-primary p-8 text-primary-foreground relative">
          <Sparkles className="absolute top-4 right-4 h-12 w-12 opacity-20 animate-pulse" />
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tighter">성장 시스템 마스터 가이드</DialogTitle>
            <DialogDescription className="text-primary-foreground/70 font-bold">
              입시트랙의 성장은 단순한 시간이 아닌 '밀도'로 결정됩니다.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
          <div className="space-y-4">
            <h4 className="flex items-center gap-2 font-black text-sm text-primary">
              <ArrowUpCircle className="h-4 w-4" /> 4대 핵심 스탯 획득법
            </h4>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-blue-50 border border-blue-100">
                <Target className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-blue-900">집중력 (Focus)</p>
                  <p className="text-[10px] font-bold text-blue-700/70">학습 몰입 60분당 1점이 부여됩니다. 연속성이 중요합니다.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                <RefreshCw className="h-5 w-5 text-emerald-600 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-emerald-900">꾸준함 (Consistency)</p>
                  <p className="text-[10px] font-bold text-emerald-700/70">세션을 완료하고 학습 기록을 남길 때마다 0.2점이 누적됩니다.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-100">
                <CheckCircle2 className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-amber-900">목표달성 (Achievement)</p>
                  <p className="text-[10px] font-bold text-amber-700/70">플래너 To-do 항목을 하나 완료할 때마다 0.2점이 상승합니다.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-rose-50 border border-rose-100">
                <ShieldCheck className="h-5 w-5 text-rose-600 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-rose-900">회복력 (Resilience)</p>
                  <p className="text-[10px] font-bold text-rose-700/70">3시간(180분) 이상의 딥워크 세션을 성공하면 1점이 부여됩니다.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="flex items-center gap-2 font-black text-sm text-primary">
              <Zap className="h-4 w-4 fill-current" /> 경험치(XP)와 레벨업
            </h4>
            <div className="p-4 rounded-2xl bg-muted/50 border border-border/50 text-[11px] font-bold leading-relaxed text-muted-foreground">
              - 모든 학습 활동은 <span className="text-primary">1분당 1XP</span>를 기본으로 제공합니다.<br/>
              - 스킬을 해금하면 <span className="text-emerald-600">XP 획득 배율(Multiplier)</span>이 영구적으로 상승합니다.<br/>
              - Lv.30 달성은 상위 0.1%의 증거이며, 약 300일의 꾸준한 노력이 필요합니다.
            </div>
          </div>
        </div>
        <div className="p-6 bg-muted/30 border-t flex justify-end">
          <Button onClick={() => (document.querySelector('[data-state="open"]') as any)?.click()} className="rounded-xl font-black">확인했습니다</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function GrowthPage() {
  const { user } = useUser();
  const { activeMembership } = useAppContext();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeBranch, setActiveBranch] = useState<'focus' | 'consistency' | 'achievement' | 'resilience'>('focus');
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const targetUid = user?.uid;

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !targetUid) return null;
    return doc(firestore, 'centers', activeMembership.id, 'growthProgress', targetUid);
  }, [firestore, activeMembership, targetUid]);

  const { data: progress, isLoading } = useDoc<GrowthProgress>(progressRef);

  const selectedSkill = useMemo(() => 
    MOCK_SKILLS.find(s => s.id === selectedSkillId) || MOCK_SKILLS.find(s => s.branch === activeBranch),
  [selectedSkillId, activeBranch]);

  useEffect(() => {
    const firstSkill = MOCK_SKILLS.find(s => s.branch === activeBranch);
    if (firstSkill) setSelectedSkillId(firstSkill.id);
  }, [activeBranch]);

  const handleUnlockSkill = (skillId: string) => {
    if (!progressRef || !user) return;
    
    const updateData = {
      skills: {
        [skillId]: {
          level: 1,
          unlockedAt: serverTimestamp()
        }
      },
      updatedAt: serverTimestamp()
    };

    setDoc(progressRef, updateData, { merge: true })
      .then(() => {
        toast({
          title: "스킬 해금 완료!",
          description: "새로운 마스터리 능력이 활성화되었습니다.",
        });
      })
      .catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: progressRef.path,
          operation: 'write',
          requestResourceData: updateData,
        }));
      });
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  const stats = progress?.stats || { focus: 0, consistency: 0, achievement: 0, resilience: 0 };
  const SelectedBranchIcon = STAT_CONFIG[activeBranch].icon;

  const currentTotalXp = (progress?.level || 1) * (progress?.nextLevelXp || 1000) + (progress?.currentXp || 0); 
  const estimatedDaysToMax = Math.ceil((TOTAL_MASTER_XP - currentTotalXp) / 500);
  const daysSpent = Math.max(1, 300 - estimatedDaysToMax);

  return (
    <div className="flex flex-col gap-8 pb-20">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
            <Zap className="h-6 w-6 text-white fill-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter">성장 로드맵</h1>
        </div>
        <div className="flex items-center gap-2 ml-1">
          <Badge variant="outline" className="border-primary/20 text-primary font-bold px-2 py-0">핵심 로드맵</Badge>
          <p className="text-sm font-bold text-muted-foreground">최종 목표인 Lv.30 마스터를 향한 300일의 험난한 여정입니다.</p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(STAT_CONFIG).map(([key, config]) => {
          const val = stats[key as keyof typeof stats] || 0;
          const Icon = config.icon;
          return (
            <Card key={key} className="premium-card border-none bg-white shadow-sm overflow-hidden group">
              <CardHeader className="pb-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-muted-foreground/60 leading-none mb-1">{config.sub}</span>
                    <span className={cn("text-base font-black tracking-tight", config.color)}>{config.label}</span>
                  </div>
                  <Icon className={cn("h-5 w-5 opacity-20 group-hover:opacity-100 transition-all group-hover:scale-110", config.color)} />
                </div>
                <div className="flex items-baseline gap-1 pt-2">
                  <span className="text-3xl font-black tabular-nums">{val.toFixed(1)}점</span>
                  <span className="text-xs font-bold text-muted-foreground">/ 목표 100</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn("absolute inset-y-0 left-0 transition-all duration-1000 ease-out rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]", config.bg)}
                    style={{ width: `${Math.min(100, val)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">
                  <span>숙련도 측정 중</span>
                  <span className="flex items-center gap-1">
                    난이도 <span className="text-destructive">어려움</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 border-none bg-gradient-to-br from-primary to-primary/90 text-primary-foreground shadow-xl rounded-[2rem] overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <TrendingUp className="h-40 w-40" />
          </div>
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400 fill-current" />
              성장 페이스 분석 (300일 가이드)
            </CardTitle>
            <CardDescription className="text-primary-foreground/60 font-bold">기계적인 공부가 아닌, 진짜 성장을 측정합니다.</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                <p className="text-[10px] font-black uppercase opacity-60 mb-1">여정 진행</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black">{daysSpent}</span>
                  <span className="text-xs opacity-60">일차</span>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                <p className="text-[10px] font-black uppercase opacity-60 mb-1">일일 목표</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black">500</span>
                  <span className="text-xs opacity-60">XP/일</span>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                <p className="text-[10px] font-black uppercase opacity-60 mb-1">남은 일수</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-amber-400">{estimatedDaysToMax > 0 ? estimatedDaysToMax : '-'}</span>
                  <span className="text-xs opacity-60">일 예상</span>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                <p className="text-[10px] font-black uppercase opacity-60 mb-1">마스터리 보너스</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-emerald-400">x1.00</span>
                  <span className="text-xs opacity-60">기본</span>
                </div>
              </div>
            </div>
            <div className="mt-6 p-4 bg-black/20 rounded-2xl border border-white/5">
              <p className="text-xs font-bold leading-relaxed opacity-90">
                ⚠️ <span className="text-amber-400">주의:</span> 현재 스탯 획득 가중치가 매우 정교하게 설정되어 있습니다. **하루 6시간 공부와 플래너 완성을 300일간 지속**해야만 Lv.30 마스터리에 도달할 수 있습니다. 쉬운 길은 없습니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <Medal className="h-5 w-5 text-primary" />
              오늘의 성장 가이드
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 group hover:bg-primary/5 transition-colors cursor-pointer">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Target className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-black">집중력은 1시간 단위</p>
                <p className="text-[10px] font-bold text-muted-foreground">연속 60분 몰입 시 집중력 점수 1점이 부여됩니다.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 group hover:bg-primary/5 transition-colors cursor-pointer">
              <div className="bg-emerald-100 p-2 rounded-lg">
                <RefreshCw className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-black">꾸준함의 가치</p>
                <p className="text-[10px] font-bold text-muted-foreground">세션 완료 시마다 0.2점의 꾸준함 점수가 누적됩니다.</p>
              </div>
            </div>
            <SystemGuideDialog />
          </CardContent>
        </Card>
      </section>

      <section className="bg-white/50 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl relative overflow-hidden">
        {/* 장식용 배경 요소 */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 relative z-10">
          <div>
            <h2 className="text-2xl font-black tracking-tighter flex items-center gap-2">
              마스터리 진행 상태
              <Badge variant="secondary" className="bg-primary text-white border-none font-black px-3">핵심 로드맵</Badge>
            </h2>
            <p className="text-sm font-bold text-muted-foreground mt-1">Lv.30은 상위 0.1%의 증거입니다. 당신의 한계에 도전하세요.</p>
          </div>
          
          <div className="bg-white p-4 rounded-[2rem] flex items-center gap-5 border border-border/50 shadow-xl min-w-[280px] hover:scale-105 transition-transform duration-500">
            <div className="relative flex items-center justify-center">
              <svg className="h-20 w-20 transform -rotate-90">
                <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-muted/30" />
                <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-primary" 
                  style={{ strokeDasharray: 213.6, strokeDashoffset: 213.6 - (213.6 * (progress?.currentXp || 0) / (progress?.nextLevelXp || 1000)) }} 
                />
              </svg>
              <div className="absolute flex flex-col items-center leading-none">
                <span className="text-[10px] font-black text-muted-foreground">LV</span>
                <span className="text-2xl font-black text-primary">{progress?.level || 1}</span>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">마스터리 숙련도</span>
                <span className="text-[10px] font-bold">{progress?.currentXp || 0} / {progress?.nextLevelXp || 1000} XP</span>
              </div>
              <Progress value={((progress?.currentXp || 0) / (progress?.nextLevelXp || 1000)) * 100} className="h-2.5 rounded-full shadow-inner" />
              <div className="flex justify-between items-center mt-0.5">
                <span className="text-[9px] font-black text-primary/60">목표: Lv.{MAX_LEVEL}</span>
                <span className="text-[9px] font-black text-muted-foreground flex items-center gap-1">
                  <Star className="h-2 w-2 fill-current" /> 마스터 랭크
                </span>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="focus" className="w-full relative z-10" onValueChange={(val) => setActiveBranch(val as any)}>
          <TabsList className="grid grid-cols-4 bg-muted/30 p-1.5 rounded-[1.5rem] h-16 mb-8 border border-border/50 shadow-inner">
            <TabsTrigger value="focus" className="rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all gap-2 data-[state=active]:text-blue-600">
              <Target className="h-4 w-4" /> <span className="hidden sm:inline">집중력</span>
            </TabsTrigger>
            <TabsTrigger value="consistency" className="rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all gap-2 data-[state=active]:text-emerald-600">
              <RefreshCw className="h-4 w-4" /> <span className="hidden sm:inline">꾸준함</span>
            </TabsTrigger>
            <TabsTrigger value="achievement" className="rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all gap-2 data-[state=active]:text-amber-600">
              <CheckCircle2 className="h-4 w-4" /> <span className="hidden sm:inline">목표달성</span>
            </TabsTrigger>
            <TabsTrigger value="resilience" className="rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all gap-2 data-[state=active]:text-rose-600">
              <ShieldCheck className="h-4 w-4" /> <span className="hidden sm:inline">회복력</span>
            </TabsTrigger>
          </TabsList>

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 flex flex-col gap-10">
              {MOCK_SKILLS.filter(s => s.branch === activeBranch).map((skill, idx) => {
                const isUnlocked = !!progress?.skills?.[skill.id];
                const canUnlock = !isUnlocked && stats[activeBranch] >= (skill.unlockCondition.value || 0);
                const isSelected = selectedSkillId === skill.id;
                
                return (
                  <div key={skill.id} className="relative flex flex-col items-center">
                    {idx < 4 && (
                      <div className={cn(
                        "absolute top-full w-0.5 h-10 border-l-2 border-dashed transition-colors duration-500",
                        isUnlocked ? "border-primary/50" : "border-muted"
                      )} />
                    )}
                    
                    <Card 
                      onClick={() => setSelectedSkillId(skill.id)}
                      className={cn(
                        "relative overflow-hidden cursor-pointer transition-all duration-500 border-2 w-full max-w-[400px] rounded-[1.5rem]",
                        isSelected ? "border-primary ring-8 ring-primary/5 scale-105 z-10 shadow-2xl" : "border-border/50",
                        isUnlocked ? "bg-white shadow-xl" : canUnlock ? "bg-primary/5 border-primary/30 animate-pulse-soft" : "bg-muted/50 grayscale opacity-60"
                      )}
                    >
                      <CardHeader className="flex flex-row items-center gap-4 p-5">
                        <div className={cn(
                          "p-3 rounded-2xl transition-all duration-700",
                          isUnlocked ? "bg-primary text-white shadow-lg rotate-[360deg]" : canUnlock ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          {isUnlocked ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                        </div>
                        <div className="grid gap-0.5">
                          <CardTitle className="text-base font-black leading-tight">{skill.name}</CardTitle>
                          <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60">
                            {isUnlocked ? `마스터리 LV.${progress?.skills?.[skill.id].level}` : canUnlock ? "해금 가능" : "잠김"}
                          </span>
                        </div>
                        {isUnlocked && <Star className="ml-auto h-4 w-4 text-amber-400 fill-current animate-bounce" />}
                      </CardHeader>
                    </Card>
                  </div>
                );
              })}
            </div>

            <div className="lg:col-span-5 h-full">
              {selectedSkill ? (
                <Card className="sticky top-24 border-none bg-primary text-primary-foreground shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-[2.5rem] overflow-hidden transform-gpu">
                  <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none animate-float">
                    <SelectedBranchIcon className="h-32 w-32" />
                  </div>
                  <CardHeader className="p-8 pb-4">
                    <Badge className="w-fit mb-4 bg-white/20 hover:bg-white/30 text-white border-none font-black backdrop-blur-sm">
                      {STAT_CONFIG[activeBranch].label} 로드맵
                    </Badge>
                    <CardTitle className="text-3xl font-black tracking-tighter mb-2">{selectedSkill.name}</CardTitle>
                    <p className="text-primary-foreground/80 font-bold leading-relaxed">{selectedSkill.description}</p>
                  </CardHeader>
                  <CardContent className="p-8 space-y-8">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest opacity-60">해금 조건</h4>
                      <div className="flex items-center justify-between bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                          <div className="bg-white/20 p-2 rounded-lg">
                            <SelectedBranchIcon className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-bold">{STAT_CONFIG[activeBranch].label} {selectedSkill.unlockCondition.value}점</span>
                        </div>
                        {(stats[activeBranch] || 0) >= (selectedSkill.unlockCondition.value || 0) ? (
                          <div className="flex items-center gap-1.5 text-emerald-400">
                            <span className="text-[10px] font-black uppercase">달성 완료</span>
                            <CheckCircle2 className="h-5 w-5 fill-current" />
                          </div>
                        ) : (
                          <span className="text-xs font-black opacity-60">{(stats[activeBranch] || 0).toFixed(1)} / {selectedSkill.unlockCondition.value}</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest opacity-60">마스터리 효과</h4>
                      <div className="grid gap-3">
                        {Object.entries(selectedSkill.effects).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between group">
                            <span className="text-sm font-medium opacity-80 group-hover:opacity-100 transition-opacity">경험치 획득 배율</span>
                            <span className="text-sm font-black text-emerald-400 flex items-center gap-1">
                              <ArrowUpCircle className="h-3 w-3" />
                              x{Number(val).toFixed(2)} 보너스
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 flex flex-col gap-3">
                      <Button asChild className="w-full h-14 rounded-2xl bg-white text-primary hover:bg-white/90 font-black text-base shadow-xl gap-2 active:scale-95 transition-all">
                        <Link href={selectedSkill.link}>
                          <Zap className="h-5 w-5 fill-current" />
                          지금 수행하기
                          <ArrowRight className="ml-auto h-5 w-5" />
                        </Link>
                      </Button>

                      {!!progress?.skills?.[selectedSkill.id] ? (
                        <Button variant="ghost" className="w-full h-12 rounded-xl text-white/60 font-black text-sm gap-2 hover:bg-white/10">
                          <Star className="h-4 w-4 fill-current text-amber-400" />
                          마스터리 레벨업 (준비 중)
                        </Button>
                      ) : (stats[activeBranch] || 0) >= (selectedSkill.unlockCondition.value || 0) ? (
                        <Button 
                          onClick={() => handleUnlockSkill(selectedSkill.id)}
                          className="w-full h-14 rounded-2xl bg-emerald-500 text-white hover:bg-emerald-600 font-black text-base shadow-xl gap-2 animate-pulse-soft"
                        >
                          <Unlock className="h-5 w-5" />
                          지금 해금하기
                        </Button>
                      ) : (
                        <Button disabled className="w-full h-14 rounded-2xl bg-white/10 text-white/40 font-black text-base border border-white/5 gap-2">
                          <Lock className="h-5 w-5" />
                          조건 미충족
                        </Button>
                      )}
                      <p className="text-[9px] text-center mt-2 font-bold opacity-50 uppercase tracking-[0.2em]">
                        궁극의 마스터리 여정: Lv.{MAX_LEVEL}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-[2.5rem] border border-dashed border-border/50">
                  <Trophy className="h-12 w-12 mb-4 opacity-20" />
                  <p className="font-bold">노드를 선택하여 마스터리 정보를 확인하세요.</p>
                </div>
              )}
            </div>
          </div>
        </Tabs>
      </section>

      <footer className="grid sm:grid-cols-3 gap-6">
        <div className="flex gap-4 p-6 bg-muted/20 rounded-[2rem] border border-border/50 items-start hover:bg-white transition-colors duration-300 shadow-sm">
          <div className="bg-white p-2 rounded-xl border border-border/50 shadow-sm">
            <Medal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h5 className="font-black text-sm mb-1">궁극의 목표: 레벨 30</h5>
            <p className="text-xs font-medium text-muted-foreground leading-relaxed">입시 트랙의 최종 목적지는 30레벨입니다. 데이터로 당신의 노력을 증명하세요.</p>
          </div>
        </div>
        <div className="flex gap-4 p-6 bg-muted/20 rounded-[2rem] border border-border/50 items-start hover:bg-white transition-colors duration-300 shadow-sm">
          <div className="bg-white p-2 rounded-xl border border-border/50 shadow-sm">
            <CalendarDays className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h5 className="font-black text-sm mb-1">데이터 기반 성장</h5>
            <p className="text-xs font-medium text-muted-foreground leading-relaxed">스탯 가중치는 엄격하게 관리됩니다. 단순한 접속이 아닌 몰입의 질이 핵심입니다.</p>
          </div>
        </div>
        <div className="flex gap-4 p-6 bg-muted/20 rounded-[2rem] border border-border/50 items-start hover:bg-white transition-colors duration-300 shadow-sm">
          <div className="bg-white p-2 rounded-xl border border-border/50 shadow-sm">
            <Crown className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h5 className="font-black text-sm mb-1">마스터리 보너스</h5>
            <p className="text-xs font-medium text-muted-foreground leading-relaxed">스킬 해금 시 XP 배율이 영구 상승하여, 후반부의 거대한 요구량을 충족할 수 있습니다.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
