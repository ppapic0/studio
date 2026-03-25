'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck2,
  FileText,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import type { ClassroomStudentInsight } from '@/lib/teacher-classroom-model';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export interface ClassroomStudentInterventionPanelProps {
  studentName: string;
  className?: string;
  schoolName?: string;
  seatLabel?: string;
  riskLabel?: string;
  recentThreeDayMinutes: number[];
  penaltyPoints: number;
  insight: ClassroomStudentInsight;
  reportLink?: string;
  studentDetailLink?: string;
  onOpenCounseling?: () => void;
  onOpenStatusPanel?: () => void;
  onOpenReport?: () => void;
}

function toneClass(points: number) {
  if (points >= 12) return 'bg-rose-100 text-rose-700';
  if (points >= 7) return 'bg-orange-100 text-orange-700';
  if (points > 0) return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function ClassroomStudentInterventionPanel({
  studentName,
  className,
  schoolName,
  seatLabel,
  riskLabel,
  recentThreeDayMinutes,
  penaltyPoints,
  insight,
  reportLink,
  studentDetailLink,
  onOpenCounseling,
  onOpenStatusPanel,
  onOpenReport,
}: ClassroomStudentInterventionPanelProps) {
  const avgMinutes = average(recentThreeDayMinutes);

  return (
    <Card className="rounded-[2rem] border-none bg-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)]">
      <CardHeader className="space-y-4 border-b bg-[radial-gradient(circle_at_top_left,rgba(255,122,22,0.10),transparent_24%),linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge className="border-none bg-slate-900 text-white">우선 개입</Badge>
              <Badge className="border-none bg-orange-100 text-orange-700">{insight.highlightTitle}</Badge>
              {riskLabel && <Badge className="border-none bg-rose-100 text-rose-700">{riskLabel}</Badge>}
              {seatLabel && <Badge variant="outline">{seatLabel}</Badge>}
            </div>
            <div>
              <CardTitle className="text-3xl font-black tracking-tight text-slate-900">{studentName}</CardTitle>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {[className, schoolName].filter(Boolean).join(' · ') || '학생 정보 없음'}
              </p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-100 bg-white/90 p-4 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">왜 지금 봐야 하나</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{insight.highlightReason}</p>
          </div>
        </div>

        {insight.triggerBadges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {insight.triggerBadges.map((badge) => (
              <Badge key={badge} variant="outline" className="border-slate-200 bg-white text-slate-700">
                {badge}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="rounded-[1.5rem] border border-slate-100 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-black text-slate-900">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                최근 3일 학습 변화
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">3일 평균</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{avgMinutes}분</p>
                <Progress value={Math.min(100, Math.round(avgMinutes / 4.8))} className="mt-3 h-2" />
              </div>
              <p className="text-sm font-semibold leading-6 text-slate-600">{insight.trendSummary}</p>
            </CardContent>
          </Card>

          <Card className="rounded-[1.5rem] border border-slate-100 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-black text-slate-900">
                <ShieldAlert className="h-4 w-4 text-rose-500" />
                벌점 / 운영 상태
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">실효 벌점</p>
                  <Badge className={cn('border-none', toneClass(penaltyPoints))}>{penaltyPoints}점</Badge>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{insight.penaltySummary}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.5rem] border border-slate-100 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-black text-slate-900">
                <CalendarCheck2 className="h-4 w-4 text-blue-500" />
                상담 / 리포트 상태
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold leading-6 text-slate-600">{insight.counselingSummary}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold leading-6 text-slate-600">{insight.reportSummary}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {insight.recommendedActions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {insight.recommendedActions.map((action) => (
              <Badge
                key={action.key}
                variant="outline"
                className={cn(
                  'border-none',
                  action.tone === 'primary'
                    ? 'bg-blue-50 text-blue-700'
                    : action.tone === 'warning'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-100 text-slate-700',
                )}
              >
                {action.label}
              </Badge>
            ))}
          </div>
        )}

        <div className="rounded-[1.6rem] border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-orange-500" />
            <p className="text-sm font-black text-slate-900">즉시 액션</p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Button type="button" className="h-auto min-h-[84px] rounded-2xl" onClick={onOpenCounseling}>
              상담 열기
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-[84px] rounded-2xl"
              onClick={onOpenStatusPanel}
            >
              상태 변경
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-[84px] rounded-2xl"
              onClick={onOpenReport}
              disabled={!reportLink && !onOpenReport}
            >
              <FileText className="mr-2 h-4 w-4" />
              리포트 보기
            </Button>
            {studentDetailLink ? (
              <Button asChild variant="outline" className="h-auto min-h-[84px] rounded-2xl">
                <Link href={studentDetailLink}>
                  학생 상세 이동
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button type="button" variant="outline" className="h-auto min-h-[84px] rounded-2xl" disabled>
                학생 상세 이동
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
