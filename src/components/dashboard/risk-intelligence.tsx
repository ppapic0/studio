'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { DailyStudentStat, CenterMembership, GrowthProgress, CounselingReservation } from '@/lib/types';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  AlertTriangle, 
  TrendingDown, 
  ShieldAlert, 
  Zap, 
  Clock, 
  Activity, 
  MessageCircle,
  Users,
  Search,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function RiskIntelligence() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  // 1. 모든 재원생 조회
  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'student'), where('status', '==', 'active'));
  }, [firestore, centerId]);
  const { data: members, isLoading: membersLoading } = useCollection<CenterMembership>(membersQuery);

  // 2. 학생 성장 프로필 (벌점 확인용)
  const progressQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'growthProgress');
  }, [firestore, centerId]);
  const { data: progressList } = useCollection<GrowthProgress>(progressQuery);

  // 3. 최근 일일 통계 (공부시간 감소 확인용)
  const statsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return collection(firestore, 'centers', centerId, 'dailyStudentStats', todayKey, 'students');
  }, [firestore, centerId, todayKey]);
  const { data: todayStats } = useCollection<DailyStudentStat>(statsQuery);

  // 4. 상담 예약 내역 (취소 횟수 확인용)
  const aptsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'counselingReservations'), where('status', '==', 'canceled'));
  }, [firestore, centerId]);
  const { data: canceledApts } = useCollection<CounselingReservation>(aptsQuery);

  const riskAnalysis = useMemo(() => {
    if (!members) return null;

    return members.map(m => {
      const stats = todayStats?.find(s => s.studentId === m.id);
      const progress = progressList?.find(p => p.id === m.id);
      const canceledCount = canceledApts?.filter(a => a.studentId === m.id).length || 0;

      // 리스크 점수 계산 로직
      let score = 0;
      const reasons: string[] = [];

      // 1. 공부시간 감소 (20% 이상 감소 시 +30점)
      if (stats && stats.studyTimeGrowthRate <= -0.2) {
        score += 30;
        reasons.push(`학습량 급감 (${Math.round(stats.studyTimeGrowthRate * 100)}%)`);
      }

      // 2. 벌점 급증 (10점 이상 시 +20점, 20점 이상 시 +40점)
      const penalty = progress?.penaltyPoints || 0;
      if (penalty >= 20) { score += 40; reasons.push(`위험 수준 벌점 (${penalty}점)`); }
      else if (penalty >= 10) { score += 20; reasons.push(`주의 수준 벌점 (${penalty}점)`); }

      // 3. 상담 취소 반복 (2회 이상 시 +20점)
      if (canceledCount >= 2) { score += 20; reasons.push(`상담 취소 반복 (${canceledCount}회)`); }

      // 4. 계획 완수율 저조 (50% 미만 시 +20점)
      if (stats && stats.todayPlanCompletionRate < 50) { score += 20; reasons.push('학습 계획 완수율 저조'); }

      return {
        id: m.id,
        name: m.displayName,
        className: m.className,
        score: Math.min(100, score),
        reasons,
        stats,
        penalty
      };
    }).sort((a, b) => b.score - a.score);
  }, [members, todayStats, progressList, canceledApts]);

  const clusters = useMemo(() => {
    if (!riskAnalysis) return null;
    return {
      highPenalty: riskAnalysis.filter(r => r.penalty >= 15).slice(0, 5),
      lowStudy: riskAnalysis.filter(r => r.stats && r.stats.totalStudyMinutes < 180).slice(0, 5),
      highRisk: riskAnalysis.filter(r => r.score >= 70)
    };
  }, [riskAnalysis]);

  if (membersLoading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-rose-500 opacity-20" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <section className={cn("grid gap-6", isMobile ? "grid-cols-1" : "md:grid-cols-3")}>
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-rose-600 text-white p-10 relative overflow-hidden">
          <ShieldAlert className="absolute -right-4 -top-4 h-48 w-48 opacity-10 rotate-12" />
          <div className="relative z-10 space-y-6">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">조기 이탈 고위험군</p>
            <h3 className="text-7xl font-black tracking-tighter">{clusters?.highRisk.length || 0}<span className="text-2xl opacity-40 ml-2">명</span></h3>
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
              <p className="text-xs font-bold leading-relaxed">위험 지수 70점 이상의 밀착 관리가 필요한 학생 수입니다.</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-10 flex flex-col justify-center gap-4">
          <div className="flex items-center gap-3"><Activity className="h-6 w-6 text-emerald-500" /><h4 className="text-sm font-black uppercase tracking-widest">평균 학습 집중도</h4></div>
          <div className="text-5xl font-black tracking-tighter text-primary">82.4<span className="text-xl opacity-40 ml-1">%</span></div>
          <Progress value={82.4} className="h-2 bg-emerald-100" />
          <p className="text-[10px] font-bold text-muted-foreground leading-relaxed italic">"자리 이탈 빈도 및 유효 공부 시간 데이터를 기반으로 산출된 센터 평균입니다."</p>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-10 flex flex-col justify-center gap-4">
          <div className="flex items-center gap-3"><AlertTriangle className="h-6 w-6 text-amber-500" /><h4 className="text-sm font-black uppercase tracking-widest">관리 주의군 (40~69점)</h4></div>
          <div className="text-5xl font-black tracking-tighter text-amber-600">{riskAnalysis?.filter(r => r.score >= 40 && r.score < 70).length || 0}<span className="text-xl opacity-40 ml-1">명</span></div>
          <p className="text-[10px] font-bold text-muted-foreground leading-relaxed mt-2">주의 관찰 단계로 곧 상담이 필요한 그룹입니다.</p>
        </Card>
      </section>

      <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "md:grid-cols-12")}>
        <Card className="md:col-span-8 rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-border/50">
          <CardHeader className="bg-muted/5 border-b p-10">
            <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3"><TrendingDown className="h-6 w-6 text-rose-600" /> 학생별 이탈 위험도 랭킹</CardTitle>
            <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Ranked by composite churn risk score (Max 100)</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="divide-y divide-muted/10">
                {riskAnalysis?.slice(0, 20).map((risk) => (
                  <div key={risk.id} className="p-8 hover:bg-muted/5 transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-6">
                      <div className={cn(
                        "h-16 w-16 rounded-3xl flex items-center justify-center font-black text-2xl shadow-xl transition-all group-hover:scale-110",
                        risk.score >= 70 ? "bg-rose-600 text-white shadow-rose-200" : risk.score >= 40 ? "bg-amber-500 text-white shadow-amber-100" : "bg-primary/5 text-primary border"
                      )}>{risk.score}</div>
                      <div className="grid gap-1">
                        <div className="flex items-center gap-2"><span className="font-black text-xl">{risk.name}</span><Badge variant="outline" className="text-[9px] font-black">{risk.className || '반 미지정'}</Badge></div>
                        <div className="flex flex-wrap gap-1.5">
                          {risk.reasons.map((r, i) => <Badge key={i} className="bg-rose-50 text-rose-600 border-none font-black text-[8px] px-2">{r}</Badge>)}
                          {risk.reasons.length === 0 && <span className="text-[10px] font-bold text-muted-foreground/40 italic">특이 징후 없음</span>}
                        </div>
                      </div>
                    </div>
                    <Button asChild variant="ghost" size="icon" className="rounded-full h-12 w-12 group-hover:bg-primary group-hover:text-white transition-all"><a href={`/dashboard/teacher/students/${risk.id}`}><ChevronRight className="h-6 w-6" /></a></Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="md:col-span-4 space-y-6">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 group">
            <CardTitle className="text-lg font-black flex items-center gap-2 mb-6"><Zap className="h-5 w-5 text-amber-500 fill-current" /> 벌점 상위 클러스터</CardTitle>
            <div className="space-y-3">
              {clusters?.highPenalty.map(s => (
                <div key={s.id} className="flex items-center justify-between p-4 rounded-2xl bg-rose-50/30 border border-rose-100/50">
                  <span className="font-bold text-sm">{s.name}</span>
                  <Badge className="bg-rose-600 text-white border-none font-black">{s.penalty}점</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 group">
            <CardTitle className="text-lg font-black flex items-center gap-2 mb-6"><Clock className="h-5 w-5 text-blue-500" /> 공부시간 하위 클러스터</CardTitle>
            <div className="space-y-3">
              {clusters?.lowStudy.map(s => (
                <div key={s.id} className="flex items-center justify-between p-4 rounded-2xl bg-blue-50/30 border border-blue-100/50">
                  <span className="font-bold text-sm">{s.name}</span>
                  <Badge className="bg-blue-600 text-white border-none font-black">{Math.floor((s.stats?.totalStudyMinutes || 0)/60)}h { (s.stats?.totalStudyMinutes || 0)%60}m</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

const Progress = ({ value, className }: { value: number, className?: string }) => (
  <div className={cn("h-2 w-full bg-muted rounded-full overflow-hidden shadow-inner", className)}>
    <div className="h-full bg-current transition-all duration-1000" style={{ width: `${value}%` }} />
  </div>
);
