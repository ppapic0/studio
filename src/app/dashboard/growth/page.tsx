'use client';

import { useAppContext } from '@/contexts/app-context';
import { useDoc, useFirestore, useUser } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc } from 'firebase/firestore';
import { GrowthProgress, SkillNode } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Zap, Lock, Unlock, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const MOCK_SKILLS: SkillNode[] = [
  { id: 'f1', branch: 'focus', name: '딥워크 25', description: '25분 집중 세션 3회 달성', maxLevel: 3, prerequisites: [], unlockCondition: { stat: 'focus', value: 10 }, effects: { xp: 1.03 }, iconKey: 'clock' },
  { id: 'c1', branch: 'consistency', name: '3일 연속', description: '3일 연속 학습 기록', maxLevel: 1, prerequisites: [], unlockCondition: { stat: 'consistency', value: 15 }, effects: { xp: 1.05 }, iconKey: 'calendar' },
  { id: 'a1', branch: 'achievement', name: '오늘 완벽', description: '오늘의 목표 100% 달성', maxLevel: 3, prerequisites: [], unlockCondition: { stat: 'achievement', value: 20 }, effects: { xp: 1.1 }, iconKey: 'check' },
  { id: 'r1', branch: 'resilience', name: '빠른 회복', description: '슬럼프 후 2일 내 복귀', maxLevel: 1, prerequisites: [], unlockCondition: { stat: 'resilience', value: 10 }, effects: { xp: 1.05 }, iconKey: 'heart' },
];

export default function GrowthPage() {
  const { user } = useUser();
  const { activeMembership } = useAppContext();
  const firestore = useFirestore();

  const targetUid = activeMembership?.role === 'parent' ? activeMembership.linkedStudentIds?.[0] : user?.uid;

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !targetUid) return null;
    return doc(firestore, 'centers', activeMembership.id, 'growthProgress', targetUid);
  }, [firestore, activeMembership, targetUid]);

  const { data: progress, isLoading } = useDoc<GrowthProgress>(progressRef);

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10" /></div>;

  const stats = progress?.stats || { focus: 0, consistency: 0, achievement: 0, resilience: 0 };

  return (
    <div className="flex flex-col gap-8 pb-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
          <Zap className="text-primary fill-primary" />
          나의 성장 트리
        </h1>
        <p className="text-muted-foreground">노력은 배신하지 않습니다. 당신의 스탯이 증명합니다.</p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(stats).map(([key, val]) => (
          <Card key={key} className="premium-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">{key}</CardTitle>
              <div className="text-2xl font-black">{Math.round(val)} <span className="text-sm font-normal text-muted-foreground">/ 100</span></div>
            </CardHeader>
            <CardContent>
              <Progress value={val} className="h-2" />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-8 shadow-xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black tracking-tighter">스킬 트리</h2>
            <p className="text-sm font-bold text-muted-foreground">성장을 가속화할 특수 효과를 잠금 해제하세요.</p>
          </div>
          <div className="bg-primary/10 px-6 py-3 rounded-2xl flex items-center gap-3 border border-primary/20">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-primary uppercase">Current Level</span>
              <span className="text-xl font-black text-primary">Lv.{progress?.level || 1}</span>
            </div>
            <div className="h-8 w-px bg-primary/20" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase">Next XP</span>
              <span className="text-xs font-bold">{progress?.currentXp || 0} / {progress?.nextLevelXp || 1000}</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="focus" className="w-full">
          <TabsList className="grid grid-cols-4 bg-muted/50 p-1 rounded-2xl h-14">
            <TabsTrigger value="focus" className="rounded-xl font-bold">집중력</TabsTrigger>
            <TabsTrigger value="consistency" className="rounded-xl font-bold">꾸준함</TabsTrigger>
            <TabsTrigger value="achievement" className="rounded-xl font-bold">목표달성</TabsTrigger>
            <TabsTrigger value="resilience" className="rounded-xl font-bold">회복력</TabsTrigger>
          </TabsList>

          {['focus', 'consistency', 'achievement', 'resilience'].map((branch) => (
            <TabsContent key={branch} value={branch} className="mt-8">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MOCK_SKILLS.filter(s => s.branch === branch).map((skill) => {
                  const isUnlocked = !!progress?.skills?.[skill.id];
                  return (
                    <Card key={skill.id} className={cn(
                      "relative overflow-hidden transition-all duration-300 border-2",
                      isUnlocked ? "border-primary bg-primary/5 shadow-lg" : "border-muted opacity-60 grayscale"
                    )}>
                      <CardHeader className="flex flex-row items-center gap-4">
                        <div className={cn(
                          "p-3 rounded-2xl",
                          isUnlocked ? "bg-primary text-primary-foreground shadow-xl" : "bg-muted text-muted-foreground"
                        )}>
                          {isUnlocked ? <Unlock className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
                        </div>
                        <div className="grid gap-0.5">
                          <CardTitle className="text-base font-black">{skill.name}</CardTitle>
                          <Badge variant={isUnlocked ? "default" : "secondary"} className="w-fit text-[9px]">
                            {isUnlocked ? `Level ${progress.skills[skill.id].level}` : "Locked"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-xs font-bold text-muted-foreground">{skill.description}</p>
                        <div className="pt-4 border-t border-border/50">
                          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-60">
                            <span>Effect</span>
                            <span className="text-primary">+{(skill.effects.xp - 1) * 100}% XP Bonus</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </section>
    </div>
  );
}
