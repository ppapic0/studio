
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/contexts/app-context';
import { useDoc, useFirestore, useUser } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc } from 'firebase/firestore';
import { GrowthProgress, SkillNode } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Flame,
  Medal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// 확장된 20개 스킬 로드맵 (레벨 30까지 고려)
const MOCK_SKILLS: SkillNode[] = [
  // --- FOCUS BRANCH ---
  { id: 'f1', branch: 'focus', name: '딥워크 25', description: '25분 집중 세션 3회 달성하여 몰입의 기초를 다집니다.', maxLevel: 3, prerequisites: [], unlockCondition: { stat: 'focus', value: 10 }, effects: { xp: 1.03 }, iconKey: 'Target' },
  { id: 'f2', branch: 'focus', name: '방해 금지', description: '중단 없는 세션 5회 연속 달성 시 해금됩니다.', maxLevel: 1, prerequisites: ['f1'], unlockCondition: { stat: 'focus', value: 25 }, effects: { xp: 1.05 }, iconKey: 'Target' },
  { id: 'f3', branch: 'focus', name: '몰입의 강도', description: '평균 집중도 90% 이상을 일주일간 유지하세요.', maxLevel: 3, prerequisites: ['f2'], unlockCondition: { stat: 'focus', value: 45 }, effects: { xp: 1.08 }, iconKey: 'Flame' },
  { id: 'f4', branch: 'focus', name: '하이퍼 포커스', description: '3시간 이상의 초몰입 세션을 성공적으로 마쳤습니다.', maxLevel: 5, prerequisites: ['f3'], unlockCondition: { stat: 'focus', value: 70 }, effects: { xp: 1.12 }, iconKey: 'Zap' },
  { id: 'f5', branch: 'focus', name: '몰입의 대가', description: '어떤 환경에서도 즉시 몰입 상태에 진입할 수 있습니다.', maxLevel: 1, prerequisites: ['f4'], unlockCondition: { stat: 'focus', value: 95 }, effects: { xp: 1.20 }, iconKey: 'Crown' },

  // --- CONSISTENCY BRANCH ---
  { id: 'c1', branch: 'consistency', name: '작심삼일 타파', description: '3일 동안 멈추지 않고 학습을 기록했습니다.', maxLevel: 1, prerequisites: [], unlockCondition: { stat: 'consistency', value: 10 }, effects: { xp: 1.03 }, iconKey: 'RefreshCw' },
  { id: 'c2', branch: 'consistency', name: '일주일의 기적', description: '7일 연속 출석 시 주간 보너스가 강화됩니다.', maxLevel: 1, prerequisites: ['c1'], unlockCondition: { stat: 'consistency', value: 25 }, effects: { xp: 1.07 }, iconKey: 'Medal' },
  { id: 'c3', branch: 'consistency', name: '루틴 정착', description: '30일 중 25일 이상 학습을 완료하는 습관을 형성합니다.', maxLevel: 3, prerequisites: ['c2'], unlockCondition: { stat: 'consistency', value: 50 }, effects: { xp: 1.10 }, iconKey: 'RefreshCw' },
  { id: 'c4', branch: 'consistency', name: '철의 의지', description: '100일 연속 학습이라는 경이로운 기록에 도전하세요.', maxLevel: 1, prerequisites: ['c3'], unlockCondition: { stat: 'consistency', value: 80 }, effects: { xp: 1.15 }, iconKey: 'Flame' },
  { id: 'c5', branch: 'consistency', name: '습관의 화신', description: '학습이 일상의 숨쉬기처럼 자연스러운 단계입니다.', maxLevel: 1, prerequisites: ['c4'], unlockCondition: { stat: 'consistency', value: 98 }, effects: { xp: 1.25 }, iconKey: 'Crown' },

  // --- ACHIEVEMENT BRANCH ---
  { id: 'a1', branch: 'achievement', name: '오늘 완벽', description: '오늘 설정한 자습 To-do를 100% 달성했습니다.', maxLevel: 3, prerequisites: [], unlockCondition: { stat: 'achievement', value: 15 }, effects: { xp: 1.05 }, iconKey: 'CheckCircle2' },
  { id: 'a2', branch: 'achievement', name: '과목 밸런스', description: '3개 이상의 과목을 편식 없이 고르게 학습했습니다.', maxLevel: 1, prerequisites: ['a1'], unlockCondition: { stat: 'achievement', value: 30 }, effects: { xp: 1.08 }, iconKey: 'Target' },
  { id: 'a3', branch: 'achievement', name: '주간 정복자', description: '한 주간 모든 목표 달성률 95% 이상을 기록하세요.', maxLevel: 3, prerequisites: ['a2'], unlockCondition: { stat: 'achievement', value: 55 }, effects: { xp: 1.12 }, iconKey: 'Trophy' },
  { id: 'a4', branch: 'achievement', name: '전략적 플래너', description: '자신에게 딱 맞는 학습량을 스스로 설계하고 달성합니다.', maxLevel: 1, prerequisites: ['a3'], unlockCondition: { stat: 'achievement', value: 75 }, effects: { xp: 1.18 }, iconKey: 'Zap' },
  { id: 'a5', branch: 'achievement', name: '성취의 정점', description: '설정한 모든 원대한 목표를 현실로 만들어냅니다.', maxLevel: 1, prerequisites: ['a4'], unlockCondition: { stat: 'achievement', value: 95 }, effects: { xp: 1.30 }, iconKey: 'Crown' },

  // --- RESILIENCE BRANCH ---
  { id: 'r1', branch: 'resilience', name: '빠른 회복', description: '슬럼프 감지 후 2일 이내에 다시 학습을 시작했습니다.', maxLevel: 1, prerequisites: [], unlockCondition: { stat: 'resilience', value: 15 }, effects: { xp: 1.05 }, iconKey: 'ShieldCheck' },
  { id: 'r2', branch: 'resilience', name: '역전의 발판', description: '성적이 하락한 과목에 더 많은 시간을 투자하여 극복합니다.', maxLevel: 1, prerequisites: ['r1'], unlockCondition: { stat: 'resilience', value: 35 }, effects: { xp: 1.08 }, iconKey: 'RefreshCw' },
  { id: 'r3', branch: 'resilience', name: '강철 멘탈', description: '어떤 외부 유혹에도 흔들리지 않고 자리를 지킵니다.', maxLevel: 3, prerequisites: ['r2'], unlockCondition: { stat: 'resilience', value: 60 }, effects: { xp: 1.12 }, iconKey: 'ShieldCheck' },
  { id: 'r4', branch: 'resilience', name: '슬럼프 파괴자', description: '슬럼프를 성장의 기회로 바꾸는 능력을 갖췄습니다.', maxLevel: 1, prerequisites: ['r3'], unlockCondition: { stat: 'resilience', value: 85 }, effects: { xp: 1.20 }, iconKey: 'Zap' },
  { id: 'r5', branch: 'resilience', name: '불굴의 마스터', description: '실패를 두려워하지 않으며 끊임없이 재도전합니다.', maxLevel: 1, prerequisites: ['r4'], unlockCondition: { stat: 'resilience', value: 98 }, effects: { xp: 1.30 }, iconKey: 'Crown' },
];

const STAT_CONFIG = {
  focus: { label: '집중력', sub: 'FOCUS', icon: Target, color: 'text-blue-500' },
  consistency: { label: '꾸준함', sub: 'CONSISTENCY', icon: RefreshCw, color: 'text-emerald-500' },
  achievement: { label: '목표달성', sub: 'ACHIEVEMENT', icon: CheckCircle2, color: 'text-amber-500' },
  resilience: { label: '회복력', sub: 'RESILIENCE', icon: ShieldCheck, color: 'text-rose-500' },
};

const MAX_LEVEL = 30;

export default function GrowthPage() {
  const { user } = useUser();
  const { activeMembership } = useAppContext();
  const firestore = useFirestore();
  const [activeBranch, setActiveBranch] = useState<'focus' | 'consistency' | 'achievement' | 'resilience'>('focus');
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  const targetUid = activeMembership?.role === 'parent' ? activeMembership.linkedStudentIds?.[0] : user?.uid;

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !targetUid) return null;
    return doc(firestore, 'centers', activeMembership.id, 'growthProgress', targetUid);
  }, [firestore, activeMembership, targetUid]);

  const { data: progress, isLoading } = useDoc<GrowthProgress>(progressRef);

  const selectedSkill = useMemo(() => 
    MOCK_SKILLS.find(s => s.id === selectedSkillId) || MOCK_SKILLS.find(s => s.branch === activeBranch),
  [selectedSkillId, activeBranch]);

  // 자동 선택 로직: 브랜치 변경 시 해당 브랜치의 첫 번째 스킬 선택
  useEffect(() => {
    const firstSkill = MOCK_SKILLS.find(s => s.branch === activeBranch);
    if (firstSkill) setSelectedSkillId(firstSkill.id);
  }, [activeBranch]);

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  const stats = progress?.stats || { focus: 0, consistency: 0, achievement: 0, resilience: 0 };
  const SelectedBranchIcon = STAT_CONFIG[activeBranch].icon;

  return (
    <div className="flex flex-col gap-8 pb-20">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
            <Zap className="h-6 w-6 text-white fill-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter">성장 로드맵</h1>
        </div>
        <p className="text-sm font-bold text-muted-foreground ml-1">입시 트랙의 끝, Lv.30 마스터를 향한 당신의 여정입니다.</p>
      </header>

      {/* 1. 고대비 스탯 카드 섹션 */}
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
                  <span className="text-3xl font-black tabular-nums">{Math.round(val)}</span>
                  <span className="text-xs font-bold text-muted-foreground">/ 100점</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn("absolute inset-y-0 left-0 transition-all duration-1000 ease-out rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]", config.color.replace('text', 'bg'))}
                    style={{ width: `${Math.min(100, val)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">
                  <span>숙련도</span>
                  <span className="flex items-center gap-1">
                    최근 7일 <span className="text-primary">+{(val * 0.05).toFixed(1)}</span>
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {/* 2. 스킬 트리 메인 영역 */}
      <section className="bg-white/50 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h2 className="text-2xl font-black tracking-tighter flex items-center gap-2">
              마스터리 진행 상태
              <Badge variant="secondary" className="bg-primary text-white border-none font-black px-3">CORE ROADMAP</Badge>
            </h2>
            <p className="text-sm font-bold text-muted-foreground mt-1">지속적인 학습으로 30레벨 궁극의 마스터리에 도달하세요.</p>
          </div>
          
          {/* 레벨/XP 통합 박스 */}
          <div className="bg-white p-4 rounded-3xl flex items-center gap-5 border border-border/50 shadow-sm min-w-[260px]">
            <div className="relative flex items-center justify-center">
              <svg className="h-16 w-14 transform -rotate-90">
                <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-muted/30" />
                <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-primary" 
                  style={{ strokeDasharray: 150.8, strokeDashoffset: 150.8 - (150.8 * (progress?.currentXp || 0) / (progress?.nextLevelXp || 1000)) }} 
                />
              </svg>
              <div className="absolute flex flex-col items-center leading-none">
                <span className="text-[10px] font-black text-muted-foreground">LV</span>
                <span className="text-xl font-black text-primary">{progress?.level || 1}</span>
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Next Milestone</span>
                <span className="text-[10px] font-bold">{progress?.currentXp || 0} / {progress?.nextLevelXp || 1000} XP</span>
              </div>
              <Progress value={((progress?.currentXp || 0) / (progress?.nextLevelXp || 1000)) * 100} className="h-2" />
              <div className="flex justify-between items-center mt-0.5">
                <span className="text-[9px] font-black text-primary/60">GOAL: Lv.{MAX_LEVEL}</span>
                <span className="text-[9px] font-black text-muted-foreground">상위 {(100 - (progress?.level || 1) * 3).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="focus" className="w-full" onValueChange={(val) => setActiveBranch(val as any)}>
          <TabsList className="grid grid-cols-4 bg-muted/30 p-1.5 rounded-2xl h-16 mb-8 border border-border/50">
            <TabsTrigger value="focus" className="rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all gap-2">
              <Target className="h-4 w-4" /> <span className="hidden sm:inline">집중력</span>
            </TabsTrigger>
            <TabsTrigger value="consistency" className="rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all gap-2">
              <RefreshCw className="h-4 w-4" /> <span className="hidden sm:inline">꾸준함</span>
            </TabsTrigger>
            <TabsTrigger value="achievement" className="rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all gap-2">
              <CheckCircle2 className="h-4 w-4" /> <span className="hidden sm:inline">목표달성</span>
            </TabsTrigger>
            <TabsTrigger value="resilience" className="rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all gap-2">
              <ShieldCheck className="h-4 w-4" /> <span className="hidden sm:inline">회복력</span>
            </TabsTrigger>
          </TabsList>

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* 왼쪽: 노드 그리드 - 세로형 트리 구조 */}
            <div className="lg:col-span-7 flex flex-col gap-10">
              {MOCK_SKILLS.filter(s => s.branch === activeBranch).map((skill, idx) => {
                const isUnlocked = !!progress?.skills?.[skill.id];
                const canUnlock = !isUnlocked && stats[activeBranch] >= (skill.unlockCondition.value || 0);
                const isSelected = selectedSkillId === skill.id;
                
                return (
                  <div key={skill.id} className="relative flex flex-col items-center">
                    {/* 트리 연결선 */}
                    {idx < 4 && (
                      <div className={cn(
                        "absolute top-full w-0.5 h-10 border-l-2 border-dashed transition-colors",
                        isUnlocked ? "border-primary/50" : "border-muted"
                      )} />
                    )}
                    
                    <Card 
                      onClick={() => setSelectedSkillId(skill.id)}
                      className={cn(
                        "relative overflow-hidden cursor-pointer transition-all duration-300 border-2 w-full max-w-[400px]",
                        isSelected ? "border-primary ring-4 ring-primary/10 scale-105 z-10" : "border-border/50",
                        isUnlocked ? "bg-white shadow-xl" : canUnlock ? "bg-primary/5 border-primary/30 animate-pulse-soft" : "bg-muted/50 grayscale opacity-60"
                      )}
                    >
                      <CardHeader className="flex flex-row items-center gap-4 p-5">
                        <div className={cn(
                          "p-3 rounded-2xl transition-all duration-500",
                          isUnlocked ? "bg-primary text-white shadow-lg rotate-[360deg]" : canUnlock ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          {isUnlocked ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                        </div>
                        <div className="grid gap-0.5">
                          <CardTitle className="text-base font-black leading-tight">{skill.name}</CardTitle>
                          <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60">
                            {isUnlocked ? `MASTERY LEVEL ${progress?.skills?.[skill.id].level}` : canUnlock ? "해금 대기 중" : "잠겨있음"}
                          </span>
                        </div>
                        {isUnlocked && <Star className="ml-auto h-4 w-4 text-amber-400 fill-current" />}
                      </CardHeader>
                    </Card>
                  </div>
                );
              })}
            </div>

            {/* 오른쪽: 상세 패널 */}
            <div className="lg:col-span-5 h-full">
              {selectedSkill ? (
                <Card className="sticky top-24 border-none bg-primary text-primary-foreground shadow-2xl rounded-[2.5rem] overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <SelectedBranchIcon className="h-32 w-32" />
                  </div>
                  <CardHeader className="p-8 pb-4">
                    <Badge className="w-fit mb-4 bg-white/20 hover:bg-white/30 text-white border-none font-black">
                      {STAT_CONFIG[activeBranch].label} 로드맵
                    </Badge>
                    <CardTitle className="text-3xl font-black tracking-tighter mb-2">{selectedSkill.name}</CardTitle>
                    <p className="text-primary-foreground/80 font-bold leading-relaxed">{selectedSkill.description}</p>
                  </CardHeader>
                  <CardContent className="p-8 space-y-8">
                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-widest opacity-60">잠금 해제 조건</h4>
                      <div className="flex items-center justify-between bg-white/10 p-4 rounded-2xl border border-white/10">
                        <div className="flex items-center gap-3">
                          <div className="bg-white/20 p-2 rounded-lg">
                            <SelectedBranchIcon className="h-4 w-4" />
                          </div>
                          <span className="text-sm font-bold">{STAT_CONFIG[activeBranch].label} {selectedSkill.unlockCondition.value}점 달성</span>
                        </div>
                        {stats[activeBranch] >= (selectedSkill.unlockCondition.value || 0) ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <span className="text-xs font-black opacity-60">{Math.round(stats[activeBranch])} / {selectedSkill.unlockCondition.value}</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-widest opacity-60">마스터리 효과</h4>
                      <div className="grid gap-3">
                        {Object.entries(selectedSkill.effects).map(([key, val]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-sm font-medium opacity-80">학습 경험치(XP) 획득 배율</span>
                            <span className="text-sm font-black text-emerald-400">
                              x{Number(val).toFixed(2)} 보너스
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4">
                      {!!progress?.skills?.[selectedSkill.id] ? (
                        <Button className="w-full h-14 rounded-2xl bg-white text-primary hover:bg-white/90 font-black text-base shadow-xl gap-2">
                          <Star className="h-5 w-5 fill-current" />
                          마스터리 레벨업 (준비 중)
                        </Button>
                      ) : stats[activeBranch] >= (selectedSkill.unlockCondition.value || 0) ? (
                        <Button className="w-full h-14 rounded-2xl bg-emerald-500 text-white hover:bg-emerald-600 font-black text-base shadow-xl gap-2">
                          <Unlock className="h-5 w-5" />
                          지금 해금하기
                        </Button>
                      ) : (
                        <Button disabled className="w-full h-14 rounded-2xl bg-white/10 text-white/40 font-black text-base border border-white/5 gap-2">
                          <Lock className="h-5 w-5" />
                          성장하여 잠금 해제
                        </Button>
                      )}
                      <p className="text-[10px] text-center mt-4 font-bold opacity-50 uppercase tracking-widest">
                        Lv.{MAX_LEVEL} 궁극의 마스터리를 향해 전진하세요.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-[2.5rem] border border-dashed border-border/50">
                  <Trophy className="h-12 w-12 mb-4 opacity-20" />
                  <p className="font-bold">노드를 선택하여 상세 정보를 확인하세요.</p>
                </div>
              )}
            </div>
          </div>
        </Tabs>
      </section>

      {/* 하단 안내 가이드 */}
      <footer className="grid sm:grid-cols-3 gap-6">
        <div className="flex gap-4 p-6 bg-muted/20 rounded-[2rem] border border-border/50 items-start">
          <div className="bg-white p-2 rounded-xl border border-border/50 shadow-sm">
            <Medal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h5 className="font-black text-sm mb-1">궁극의 목표: 레벨 30</h5>
            <p className="text-xs font-medium text-muted-foreground leading-relaxed">입시 트랙의 최종 목적지는 30레벨입니다. 각 단계마다 당신의 학습 능력은 비약적으로 상승합니다.</p>
          </div>
        </div>
        <div className="flex gap-4 p-6 bg-muted/20 rounded-[2rem] border border-border/50 items-start">
          <div className="bg-white p-2 rounded-xl border border-border/50 shadow-sm">
            <Zap className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h5 className="font-black text-sm mb-1">장기 성장의 가치</h5>
            <p className="text-xs font-medium text-muted-foreground leading-relaxed">이 트리는 시즌이 바뀌어도 초기화되지 않습니다. 당신이 쌓아온 모든 노력은 데이터로 보존됩니다.</p>
          </div>
        </div>
        <div className="flex gap-4 p-6 bg-muted/20 rounded-[2rem] border border-border/50 items-start">
          <div className="bg-white p-2 rounded-xl border border-border/50 shadow-sm">
            <Crown className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h5 className="font-black text-sm mb-1">마스터리 보너스</h5>
            <p className="text-xs font-medium text-muted-foreground leading-relaxed">스킬을 해금할수록 XP 획득 배율이 영구적으로 증가하여 더 높은 레벨에 더 빠르게 도달할 수 있습니다.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
