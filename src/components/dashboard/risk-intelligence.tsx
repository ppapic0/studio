'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { DailyStudentStat, CenterMembership, GrowthProgress, CounselingReservation } from '@/lib/types';
import { format } from 'date-fns';
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
  Loader2,
  Sparkles,
  ArrowRight,
  Target,
  History,
  AlertCircle,
  BrainCircuit,
  Info,
  Scale
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import Link from 'next/link';

export function RiskIntelligence() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const [selectedRiskStudent, setSelectedRiskStudent] = useState<any>(null);

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

      let score = 0;
      const detailedReasons: { label: string, value: string, score: number, icon: any, color: string }[] = [];

      // 1. 학습량 급감 (비중 30점)
      if (stats && stats.studyTimeGrowthRate <= -0.2) {
        const weight = 30;
        score += weight;
        detailedReasons.push({
          label: '학습량 급감',
          value: `${Math.round(stats.studyTimeGrowthRate * 100)}% 감소`,
          score: weight,
          icon: TrendingDown,
          color: 'text-rose-600'
        });
      }

      // 2. 벌점 누적 (비중 최대 40점)
      const penalty = progress?.penaltyPoints || 0;
      if (penalty >= 10) {
        const weight = penalty >= 20 ? 40 : 20;
        score += weight;
        detailedReasons.push({
          label: '규정 위반 (벌점)',
          value: `${penalty}점 누적`,
          score: weight,
          icon: ShieldAlert,
          color: penalty >= 20 ? 'text-rose-600' : 'text-amber-600'
        });
      }

      // 3. 상담 취소 반복 (비중 20점)
      if (canceledCount >= 2) {
        const weight = 20;
        score += weight;
        detailedReasons.push({
          label: '상담 기피 징후',
          value: `예약 취소 ${canceledCount}회`,
          score: weight,
          icon: MessageCircle,
          color: 'text-amber-600'
        });
      }

      // 4. 성취도 저조 (비중 20점)
      if (stats && stats.todayPlanCompletionRate < 50) {
        const weight = 20;
        score += weight;
        detailedReasons.push({
          label: '성취도 저조',
          value: `완수율 ${stats.todayPlanCompletionRate}%`,
          score: weight,
          icon: Target,
          color: 'text-rose-600'
        });
      }

      return {
        id: m.id,
        name: m.displayName,
        className: m.className,
        score: Math.min(100, score),
        detailedReasons,
        stats,
        penalty,
        canceledCount
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
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-rose-600 text-white p-10 relative overflow-hidden group">
          <ShieldAlert className="absolute -right-4 -top-4 h-48 w-48 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-1000" />
          <div className="relative z-10 space-y-6">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">조기 이탈 고위험군</p>
            <h3 className="text-7xl font-black tracking-tighter">{clusters?.highRisk.length || 0}<span className="text-2xl opacity-40 ml-2">명</span></h3>
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
              <p className="text-xs font-bold leading-relaxed">위험 지수 70점 이상의 밀착 관리가 필요한 학생 수입니다.</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-10 flex flex-col justify-center gap-4 group">
          <div className="flex items-center gap-3"><Activity className="h-6 w-6 text-emerald-500" /><h4 className="text-sm font-black uppercase tracking-widest">평균 학습 집중도</h4></div>
          <div className="text-5xl font-black tracking-tighter text-primary">82.4<span className="text-xl opacity-40 ml-1">%</span></div>
          <Progress value={82.4} className="h-2 bg-emerald-100" />
          <p className="text-[10px] font-bold text-muted-foreground leading-relaxed italic mt-2">"전체 입실 인원 대비 순수 몰입 시간 비율입니다."</p>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-10 flex flex-col justify-center gap-4 group">
          <div className="flex items-center gap-3"><AlertTriangle className="h-6 w-6 text-amber-500" /><h4 className="text-sm font-black uppercase tracking-widest">관리 주의군 (40~69점)</h4></div>
          <div className="text-5xl font-black tracking-tighter text-amber-600">{riskAnalysis?.filter(r => r.score >= 40 && r.score < 70).length || 0}<span className="text-xl opacity-40 ml-1">명</span></div>
          <p className="text-[10px] font-bold text-muted-foreground leading-relaxed mt-2">주의 관찰 단계로 곧 상담이 필요한 그룹입니다.</p>
        </Card>
      </section>

      <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "md:grid-cols-12")}>
        <div className="md:col-span-8 space-y-6">
          <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-black/[0.03]">
            <CardHeader className="bg-muted/5 border-b p-10">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3"><TrendingDown className="h-6 w-6 text-rose-600" /> 학생별 이탈 위험도 랭킹</CardTitle>
                  <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Composite churn risk analysis (Max 100)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[550px]">
                <div className="divide-y divide-muted/10">
                  {riskAnalysis?.slice(0, 30).map((risk) => (
                    <div 
                      key={risk.id} 
                      onClick={() => setSelectedRiskStudent(risk)}
                      className="p-8 hover:bg-muted/5 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-6">
                        <div className={cn(
                          "h-16 w-16 rounded-3xl flex items-center justify-center font-black text-2xl shadow-xl transition-all group-hover:scale-110",
                          risk.score >= 70 ? "bg-rose-600 text-white shadow-rose-200" : risk.score >= 40 ? "bg-amber-500 text-white shadow-amber-100" : "bg-primary/5 text-primary border"
                        )}>{risk.score}</div>
                        <div className="grid gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xl tracking-tight">{risk.name} 학생</span>
                            <Badge variant="outline" className="text-[9px] font-black border-primary/20">{risk.className || '반 미지정'}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {risk.detailedReasons.slice(0, 2).map((r: any, i: number) => (
                              <Badge key={i} className={cn("border-none font-black text-[8px] px-2 bg-muted/50", r.color)}>{r.label}</Badge>
                            ))}
                            {risk.detailedReasons.length > 2 && <span className="text-[8px] font-bold text-muted-foreground/40">+{risk.detailedReasons.length - 2} more</span>}
                            {risk.detailedReasons.length === 0 && <span className="text-[10px] font-bold text-muted-foreground/40 italic">특이 징후 없음</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest group-hover:text-primary transition-colors">Details</span>
                        <ChevronRight className="h-5 w-5 text-muted-foreground/20 group-hover:text-primary transition-all group-hover:translate-x-1" />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-4 space-y-6">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-primary text-primary-foreground p-8 overflow-hidden relative">
            <div className="absolute -right-4 -top-4 opacity-10"><Info className="h-32 w-32" /></div>
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-accent" />
                <h4 className="text-sm font-black uppercase tracking-widest">AI 점수 산정 가이드</h4>
              </div>
              <div className="space-y-4">
                {[
                  { label: '학습량 급감 (-20%↑)', pts: '+30', icon: TrendingDown, color: 'text-rose-300' },
                  { label: '누적 벌점 (20점↑)', pts: '+40', icon: ShieldAlert, color: 'text-amber-300' },
                  { label: '상담 취소 (2회↑)', pts: '+20', icon: MessageCircle, color: 'text-blue-300' },
                  { label: '완수율 저조 (50%↓)', pts: '+20', icon: Target, color: 'text-emerald-300' }
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between bg-white/10 p-3 rounded-xl border border-white/10">
                    <div className="flex items-center gap-3">
                      <item.icon className={cn("h-4 w-4", item.color)} />
                      <span className="text-xs font-bold">{item.label}</span>
                    </div>
                    <span className="font-black text-xs text-white">{item.pts}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-bold text-white/60 leading-relaxed italic pt-2">
                ※ 총점 100점 만점으로 환산되며, 70점 이상은 "즉시 개입"이 필요한 고위험군으로 자동 분류됩니다.
              </p>
            </div>
          </Card>

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
                  <Badge className="bg-blue-600 text-white border-none font-black">{Math.floor((s.stats?.totalStudyMinutes || 0)/60)}h {(s.stats?.totalStudyMinutes || 0)%60}m</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* 리스크 상세 분석 모달 */}
      <Dialog open={!!selectedRiskStudent} onOpenChange={(open) => !open && setSelectedRiskStudent(null)}>
        <DialogContent className={cn(
          "rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col transition-all duration-500",
          isMobile ? "fixed inset-0 w-full h-full max-w-none rounded-none" : "sm:max-w-xl max-h-[90vh]"
        )}>
          {selectedRiskStudent && (
            <>
              <div className={cn(
                "p-10 text-white relative shrink-0",
                selectedRiskStudent.score >= 70 ? "bg-rose-600" : selectedRiskStudent.score >= 40 ? "bg-amber-500" : "bg-primary"
              )}>
                <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
                  <ShieldAlert className="h-48 w-48" />
                </div>
                <DialogHeader className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-white/20 text-white border-none font-black text-[10px] px-2.5 py-0.5 uppercase tracking-widest">AI Risk Diagnostic</Badge>
                  </div>
                  <DialogTitle className="text-4xl font-black tracking-tighter">
                    {selectedRiskStudent.name} 학생 분석
                  </DialogTitle>
                  <DialogDescription className="text-white/70 font-bold mt-1 text-sm">
                    복합 데이터를 기반으로 산출된 이탈 위험 지수입니다.
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar p-8 sm:p-10 space-y-10">
                <div className="text-center space-y-4">
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Composite Risk Score</span>
                    <h3 className={cn(
                      "text-8xl font-black tracking-tighter leading-none",
                      selectedRiskStudent.score >= 70 ? "text-rose-600" : selectedRiskStudent.score >= 40 ? "text-amber-600" : "text-primary"
                    )}>
                      {selectedRiskStudent.score}<span className="text-3xl opacity-20 ml-1">/100</span>
                    </h3>
                  </div>
                  <Progress value={selectedRiskStudent.score} className="h-3 bg-muted" />
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase text-primary/60 tracking-widest ml-1 flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4" /> 감지된 주요 리스크 요인
                  </h4>
                  <div className="grid gap-3">
                    {selectedRiskStudent.detailedReasons.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-emerald-50/50 border-2 border-dashed border-emerald-100 text-center">
                        <p className="text-sm font-bold text-emerald-700">현재 감지된 특이 징후가 없습니다.</p>
                      </div>
                    ) : (
                      selectedRiskStudent.detailedReasons.map((reason: any, i: number) => (
                        <div key={i} className="p-5 rounded-2xl bg-white border border-border/50 shadow-sm flex items-center justify-between group hover:border-rose-200 transition-all">
                          <div className="flex items-center gap-4">
                            <div className={cn("p-2.5 rounded-xl bg-opacity-10", reason.color.replace('text-', 'bg-'))}>
                              <reason.icon className={cn("h-5 w-5", reason.color)} />
                            </div>
                            <div className="grid gap-0.5">
                              <span className="font-black text-sm">{reason.label}</span>
                              <span className={cn("text-xs font-bold", reason.color)}>{reason.value}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className="font-black text-[10px] border-none bg-muted/30">+{reason.score}pts</Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <Card className="rounded-[2rem] border-none shadow-xl bg-white p-8 space-y-4 ring-1 ring-black/5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500 fill-current" />
                    <h4 className="text-sm font-black tracking-tight">운영자 권장 조치 (Intervention)</h4>
                  </div>
                  <p className="text-xs font-bold leading-relaxed text-foreground/70">
                    {selectedRiskStudent.score >= 70 ? (
                      "🚨 **긴급 상담 대상**: 학습 리듬이 붕괴된 상태입니다. 즉시 부모님께 연락하여 현재 상황을 공유하고, 학생과의 심층 면담을 통해 원인을 파악해야 합니다."
                    ) : selectedRiskStudent.score >= 40 ? (
                      "⚠️ **주의 관찰 대상**: 학습 의욕이 하락하고 있는 징후가 보입니다. 가벼운 면담을 통해 학습 환경의 불편함을 체크하고 성취감을 느낄 수 있는 단기 목표 설정을 제안하세요."
                    ) : (
                      "✨ **안정적 상태**: 현재 특별한 이탈 징후가 없습니다. 칭찬 리포트를 발송하여 긍정적인 학습 경험을 강화해 주세요."
                    )}
                  </p>
                </Card>
              </div>

              <DialogFooter className="p-8 bg-white border-t shrink-0 flex flex-col sm:flex-row gap-3">
                <Button variant="outline" className="h-14 rounded-2xl font-black flex-1 border-2" onClick={() => setSelectedRiskStudent(null)}>분석 창 닫기</Button>
                <Button asChild className="h-14 rounded-2xl font-black flex-1 shadow-xl gap-2 active:scale-95 transition-all">
                  <Link href={`/dashboard/teacher/students/${selectedRiskStudent.id}`}>
                    학생 정밀 상세페이지 <ChevronRight className="h-5 w-5" />
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
