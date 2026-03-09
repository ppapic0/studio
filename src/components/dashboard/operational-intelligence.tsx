'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { CounselingLog, CenterMembership, AttendanceCurrent, StudyLogDay } from '@/lib/types';
import { cn } from '@/lib/utils';
import { 
  MessageCircle, 
  Users, 
  Clock, 
  Zap, 
  UserCheck, 
  PieChart,
  Loader2,
  Activity,
  ArrowRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid
} from 'recharts';
import { format, subDays } from 'date-fns';
import Link from 'next/link';

export function OperationalIntelligence() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;

  // 1. 재원생 멤버 정보 (선생님/학생 비율 계산용)
  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('status', '==', 'active'));
  }, [firestore, centerId]);
  const { data: allMembers, isLoading: membersLoading } = useCollection<CenterMembership>(membersQuery);

  // 2. 상담 일지 조회
  const counselLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'counselingLogs'), orderBy('createdAt', 'desc'), limit(200));
  }, [firestore, centerId]);
  const { data: counselLogs, isLoading: logsLoading } = useCollection<CounselingLog>(counselLogsQuery);

  // 3. 실시간 좌석 현황
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery);
  const [studyMinutesByStudent, setStudyMinutesByStudent] = useState<Record<string, number>>({});
  const [studyMinutesLoading, setStudyMinutesLoading] = useState(false);

  useEffect(() => {
    let disposed = false;
    if (!firestore || !centerId || !allMembers || allMembers.length === 0) {
      setStudyMinutesByStudent({});
      return;
    }

    const targetStudents = allMembers.filter((member) => member.role === 'student' && member.status === 'active');
    if (targetStudents.length === 0) {
      setStudyMinutesByStudent({});
      return;
    }

    const loadStudyMinutes = async () => {
      setStudyMinutesLoading(true);
      try {
        const fromKey = format(subDays(new Date(), 29), 'yyyy-MM-dd');
        const bucket: Record<string, number> = {};

        await Promise.all(
          targetStudents.map(async (student) => {
            const daysRef = collection(firestore, 'centers', centerId, 'studyLogs', student.id, 'days');
            const daysSnap = await getDocs(query(daysRef, where('dateKey', '>=', fromKey)));
            let totalMinutes = 0;
            daysSnap.forEach((snap) => {
              const data = snap.data() as Partial<StudyLogDay>;
              const mins = Number(data.totalMinutes || 0);
              if (Number.isFinite(mins) && mins > 0) totalMinutes += mins;
            });
            bucket[student.id] = totalMinutes;
          })
        );

        if (!disposed) {
          setStudyMinutesByStudent(bucket);
        }
      } catch (error) {
        console.error('Operational study aggregation failed:', error);
        if (!disposed) {
          setStudyMinutesByStudent({});
        }
      } finally {
        if (!disposed) {
          setStudyMinutesLoading(false);
        }
      }
    };

    loadStudyMinutes();
    return () => {
      disposed = true;
    };
  }, [firestore, centerId, allMembers]);

  const opsMetrics = useMemo(() => {
    if (!allMembers || !attendanceList) return null;

    const students = allMembers.filter(m => m.role === 'student');
    const teachers = allMembers.filter(m => m.role === 'teacher' || m.role === 'centerAdmin');

    const studentCount = students.length;
    const teacherCount = Math.max(1, teachers.length);
    const ratio = Number((studentCount / teacherCount).toFixed(1));

    const totalSeats = attendanceList.filter(a => a.type !== 'aisle').length || 1;
    const occupiedSeats = attendanceList.filter(a => a.status === 'studying').length;
    const occupancyRate = Math.round((occupiedSeats / totalSeats) * 100);

    const teacherStats: Record<string, { name: string; count: number; improvedCount: number }> = {};
    const timeSlots = {
      morning: { name: '?ㅼ쟾 (09-13)', counselCount: 0, improvedCount: 0 },
      afternoon: { name: '?ㅽ썑 (13-18)', counselCount: 0, improvedCount: 0 },
      evening: { name: '?쇨컙 (18-24)', counselCount: 0, improvedCount: 0 },
    };

    counselLogs?.forEach((log) => {
      const tId = log.teacherId;
      if (!teacherStats[tId]) {
        teacherStats[tId] = { name: log.teacherName || 'Teacher', count: 0, improvedCount: 0 };
      }
      teacherStats[tId].count += 1;

      const improved = (log.improvement || '').trim().length > 0;
      if (improved) {
        teacherStats[tId].improvedCount += 1;
      }

      const createdAt = (log as any).createdAt?.toDate?.();
      if (!createdAt) return;
      const hour = createdAt.getHours();
      const slot = hour >= 9 && hour < 13
        ? timeSlots.morning
        : hour >= 13 && hour < 18
          ? timeSlots.afternoon
          : hour >= 18 && hour <= 23
            ? timeSlots.evening
            : null;
      if (!slot) return;
      slot.counselCount += 1;
      if (improved) slot.improvedCount += 1;
    });

    const teacherChartData = Object.values(teacherStats)
      .map((t) => ({
        name: t.name,
        count: t.count,
        improvement: t.count > 0 ? Math.round((t.improvedCount / t.count) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const totalCounselCount = counselLogs?.length || 0;
    const totalImprovedCounsel = Object.values(teacherStats).reduce((sum, item) => sum + item.improvedCount, 0);
    const counselQualityRate = totalCounselCount > 0 ? Math.round((totalImprovedCounsel / totalCounselCount) * 100) : 0;

    const totalSlotCounsel = Object.values(timeSlots).reduce((sum, slot) => sum + slot.counselCount, 0);
    const timeSlotData = Object.values(timeSlots).map((slot) => ({
      name: slot.name,
      consultCount: slot.counselCount,
      share: totalSlotCounsel > 0 ? Math.round((slot.counselCount / totalSlotCounsel) * 100) : 0,
      improvementRate: slot.counselCount > 0 ? Math.round((slot.improvedCount / slot.counselCount) * 100) : 0,
    }));

    const totalStudyMinutes30d = students.reduce((sum, s) => sum + (studyMinutesByStudent[s.id] || 0), 0);
    const lowStudyStudentCount = students.filter((s) => (studyMinutesByStudent[s.id] || 0) < 540).length;
    const studyHealthRate = studentCount > 0 ? Math.round(((studentCount - lowStudyStudentCount) / studentCount) * 100) : 0;

    const efficiencyScore = Math.round((studyHealthRate * 0.6) + (counselQualityRate * 0.4));
    const lowestOccupancySlot = [...timeSlotData].sort((a, b) => a.consultCount - b.consultCount)[0] || null;

    return {
      ratio,
      occupancyRate,
      teacherChartData,
      timeSlotData,
      totalCounselCount,
      counselQualityRate,
      studyHealthRate,
      efficiencyScore,
      lowestOccupancySlot,
      lowStudyStudentCount,
      totalStudyMinutes30d,
    };
  }, [allMembers, attendanceList, counselLogs, studyMinutesByStudent]);

  const isLoading = membersLoading || logsLoading || attendanceLoading || studyMinutesLoading;

  if (isLoading) {
    return (
      <div className="py-40 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Calculating Operational Efficiency...</p>
      </div>
    );
  }

  if (!opsMetrics) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <section className={cn("grid gap-6", isMobile ? "grid-cols-1" : "md:grid-cols-3")}>
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-blue-600 text-white p-10 relative overflow-hidden group">
          <MessageCircle className="absolute -right-4 -top-4 h-48 w-48 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-1000" />
          <div className="relative z-10 space-y-6">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">상담 효율 지수 (Efficiency)</p>
            <h3 className="text-7xl font-black tracking-tighter">{opsMetrics.efficiencyScore}<span className="text-2xl opacity-40 ml-2">점</span></h3>
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
              <p className="text-xs font-bold leading-relaxed">최근 진행된 {opsMetrics.totalCounselCount}건의 상담 중 {opsMetrics.efficiencyScore}%가 개선 액션으로 기록되었습니다.</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-10 flex flex-col justify-center gap-4 group hover:shadow-2xl transition-all ring-1 ring-black/[0.03]">
          <div className="flex items-center gap-3">
            <UserCheck className="h-6 w-6 text-emerald-500" />
            <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground">강사당 관리 인원</h4>
          </div>
          <div className="text-5xl font-black tracking-tighter text-primary">{opsMetrics.ratio}<span className="text-xl opacity-40 ml-1">명</span></div>
          <Progress value={(opsMetrics.ratio / 25) * 100} className="h-2 bg-emerald-100" />
          <p className="text-[10px] font-bold text-muted-foreground leading-relaxed mt-2">
            권장 기준(20명) 대비 **{opsMetrics.ratio > 20 ? '과부하' : '안정적'}** 상태입니다.
          </p>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-10 flex flex-col justify-center gap-4 group hover:shadow-2xl transition-all ring-1 ring-black/[0.03]">
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-amber-500" />
            <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground">실시간 좌석 점유율</h4>
          </div>
          <div className="text-5xl font-black tracking-tighter text-amber-600">{opsMetrics.occupancyRate}<span className="text-xl opacity-40 ml-1">%</span></div>
          <Badge variant="secondary" className="w-fit bg-amber-50 text-amber-700 font-black text-[9px] px-3">CURRENT PEAK</Badge>
        </Card>
      </section>

      <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "md:grid-cols-12")}>
        <Card className="md:col-span-7 rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-black/[0.03]">
          <CardHeader className="bg-muted/5 border-b p-10">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3">
                  <Activity className="h-6 w-6 text-blue-600" /> 선생님별 상담 성과
                </CardTitle>
                <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-60">Consultation Count vs Performance Impact</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-10">
            <div className="h-[300px] w-full">
              {opsMetrics.teacherChartData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 italic font-black">
                  <MessageCircle className="h-12 w-12 mb-2" />
                  상담 기록이 부족합니다.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={opsMetrics.teacherChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" fontSize={11} fontWeight="bold" axisLine={false} tickLine={false} />
                    <YAxis fontSize={11} fontWeight="900" axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} contentStyle={{borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="count" name="상담 횟수" fill="hsl(var(--primary))" radius={[10, 10, 0, 0]} barSize={40} />
                    <Bar dataKey="improvement" name="개선율(%)" fill="#10b981" radius={[10, 10, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-5 rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-black/[0.03]">
          <CardHeader className="bg-amber-50/30 border-b p-10">
            <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3">
              <PieChart className="h-6 w-6 text-amber-600" /> 시간대별 운영 효율
            </CardTitle>
          </CardHeader>
          <CardContent className="p-10 space-y-8">
            {opsMetrics.timeSlotData.map((slot) => (
              <div key={slot.name} className="space-y-3">
                <div className="flex justify-between items-end">
                  <div className="grid gap-0.5">
                    <span className="text-xs font-black text-primary">{slot.name}</span>
                    <span className="text-lg font-black text-amber-600">상담 비율 {slot.share}%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-muted-foreground uppercase opacity-60">Consult Count</span>
                    <p className="text-base font-black text-primary">{slot.consultCount}건</p>
                  </div>
                </div>
                <Progress value={slot.share} className={cn("h-2 bg-muted", slot.share < 20 ? "text-rose-400" : "text-amber-500")} />
              </div>
            ))}
            
            <div className="p-6 rounded-[2rem] bg-muted/20 border-2 border-dashed flex flex-col items-center text-center gap-3">
              <Zap className="h-8 w-8 text-primary/20" />
              <p className="text-xs font-bold text-muted-foreground leading-relaxed">
                현재 **{opsMetrics.lowestOccupancySlot?.name || '해당 시간대'}** 효율이 가장 낮습니다. <br/>
                해당 시간대 집중 캠페인으로 출석/상담 전환율을 높여보세요.
              </p>
              <Button asChild variant="outline" className="rounded-xl h-9 px-4 text-[10px] font-black mt-2 bg-white">
                <Link href="/dashboard/settings/invites">프로모션 코드 생성 <ArrowRight className="ml-2 h-3 w-3" /></Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
