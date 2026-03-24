'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  CalendarCheck2,
  MessageSquare,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export type ClassroomTone = 'emerald' | 'amber' | 'orange' | 'rose' | 'blue' | 'slate';

export interface ClassroomTrendPoint {
  label: string;
  minutes: number;
  deltaMinutes?: number;
  note?: string;
}

export interface ClassroomPenaltyPoint {
  label: string;
  points: number;
  deltaPoints?: number;
  note?: string;
}

export interface ClassroomStatusBlock {
  label: string;
  value: string;
  helper?: string;
  tone?: ClassroomTone;
}

export interface ClassroomActionButton {
  label: string;
  description?: string;
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
  tone?: 'primary' | 'secondary' | 'outline' | 'destructive';
  disabled?: boolean;
}

export interface ClassroomStudentInterventionPanelProps {
  studentName: string;
  studentClassName?: string;
  schoolName?: string;
  seatLabel?: string;
  riskLevel?: string;
  priorityLabel?: string;
  attentionReason: string;
  attentionReasons?: string[];
  recentThreeDays: ClassroomTrendPoint[];
  penaltyTrend: ClassroomPenaltyPoint[];
  statusBlocks: ClassroomStatusBlock[];
  actions: ClassroomActionButton[];
  tags?: string[];
  summaryNote?: string;
  className?: string;
}

const TONE_CLASSES: Record<
  ClassroomTone,
  { soft: string }
> = {
  emerald: { soft: 'bg-emerald-100 text-emerald-700' },
  amber: { soft: 'bg-amber-100 text-amber-700' },
  orange: { soft: 'bg-orange-100 text-orange-700' },
  rose: { soft: 'bg-rose-100 text-rose-700' },
  blue: { soft: 'bg-blue-100 text-blue-700' },
  slate: { soft: 'bg-slate-100 text-slate-700' },
};

function formatMinutes(minutes: number) {
  const value = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(value / 60);
  const remainder = value % 60;
  return hours === 0 ? `${remainder}분` : `${hours}시간 ${remainder}분`;
}

function formatDelta(delta?: number) {
  if (typeof delta !== 'number' || Number.isNaN(delta)) return '변화 없음';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${Math.round(delta)}분`;
}

function formatPenaltyDelta(delta?: number) {
  if (typeof delta !== 'number' || Number.isNaN(delta)) return '변화 없음';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${Math.round(delta)}점`;
}

function toneForTrend(delta?: number): ClassroomTone {
  if (typeof delta !== 'number' || Number.isNaN(delta)) return 'slate';
  if (delta >= 30) return 'emerald';
  if (delta >= 0) return 'blue';
  if (delta <= -30) return 'rose';
  return 'amber';
}

function toneForPenalty(points: number): ClassroomTone {
  if (points >= 12) return 'rose';
  if (points >= 7) return 'orange';
  if (points > 0) return 'amber';
  return 'emerald';
}

function ActionIcon({
  action,
  className,
}: {
  action: ClassroomActionButton;
  className?: string;
}) {
  const Icon = action.icon ?? ArrowRight;
  return <Icon className={className} />;
}

function ToneBadge({
  tone,
  label,
}: {
  tone: ClassroomTone;
  label: string;
}) {
  return <Badge className={cn('border-none font-black', TONE_CLASSES[tone].soft)}>{label}</Badge>;
}

export function ClassroomStudentInterventionPanel({
  studentName,
  studentClassName,
  schoolName,
  seatLabel,
  riskLevel,
  priorityLabel,
  attentionReason,
  attentionReasons = [],
  recentThreeDays,
  penaltyTrend,
  statusBlocks,
  actions,
  tags = [],
  summaryNote,
  className,
}: ClassroomStudentInterventionPanelProps) {
  const watchTone: ClassroomTone =
    riskLevel === '긴급' ? 'rose' : riskLevel === '위험' ? 'orange' : riskLevel === '주의' ? 'amber' : 'emerald';

  return (
    <Card className={cn('overflow-hidden rounded-[2rem] border-none bg-white shadow-[0_18px_60px_rgba(20,41,95,0.08)]', className)}>
      <CardHeader className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(255,250,244,0.95),rgba(255,255,255,1))] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <ToneBadge tone={watchTone} label={priorityLabel || '주목 학생'} />
              {riskLevel && <Badge className="border-none bg-slate-900 text-white">{riskLevel}</Badge>}
              {seatLabel && <Badge className="border-none bg-white text-slate-700 shadow-sm">{seatLabel}</Badge>}
            </div>
            <div>
              <CardTitle className="text-3xl font-black tracking-tight text-slate-900">
                {studentName}
              </CardTitle>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {[studentClassName, schoolName].filter(Boolean).join(' · ') || '학생 정보 없음'}
              </p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 shadow-sm ring-1 ring-slate-100">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">왜 주목하나요</p>
            <p className="mt-2 max-w-xl text-sm font-semibold leading-relaxed text-slate-700">
              {attentionReason}
            </p>
          </div>
        </div>

        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="border-slate-200 bg-white text-[11px] font-black text-slate-600">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6 p-5 sm:p-6">
        {summaryNote && (
          <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">요약 메모</p>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-700">
              {summaryNote}
            </p>
          </div>
        )}

        {attentionReasons.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {attentionReasons.map((reason, index) => (
              <div
                key={`${reason}-${index}`}
                className={cn(
                  'rounded-[1.25rem] border p-4 shadow-sm',
                  index === 0 ? 'border-rose-200 bg-rose-50' : 'border-slate-100 bg-white',
                )}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-rose-500" />
                  <p className="text-sm font-black text-slate-900">핵심 근거 {index + 1}</p>
                </div>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
                  {reason}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="rounded-[1.5rem] border border-slate-100 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-black text-slate-900">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                최근 3일 변화
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentThreeDays.map((day) => {
                const tone = toneForTrend(day.deltaMinutes);
                return (
                  <div key={day.label} className="rounded-[1.1rem] border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{day.label}</p>
                        <p className="text-sm font-black text-slate-900">{formatMinutes(day.minutes)}</p>
                      </div>
                      <Badge className={cn('border-none', TONE_CLASSES[tone].soft)}>
                        {formatDelta(day.deltaMinutes)}
                      </Badge>
                    </div>
                    <Progress value={Math.min(100, Math.max(0, Math.round(day.minutes / 4)))} className="mt-3 h-2" />
                    {day.note && <p className="mt-2 text-[11px] font-semibold text-slate-500">{day.note}</p>}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="rounded-[1.5rem] border border-slate-100 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-black text-slate-900">
                <MessageSquare className="h-4 w-4 text-orange-500" />
                벌점 추이
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {penaltyTrend.map((point) => {
                const tone = toneForPenalty(point.points);
                return (
                  <div key={point.label} className="rounded-[1.1rem] border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{point.label}</p>
                        <p className="text-sm font-black text-slate-900">{point.points}점</p>
                      </div>
                      <Badge className={cn('border-none', TONE_CLASSES[tone].soft)}>
                        {formatPenaltyDelta(point.deltaPoints)}
                      </Badge>
                    </div>
                    <Progress value={Math.min(100, Math.max(0, point.points * 8))} className="mt-3 h-2" />
                    {point.note && <p className="mt-2 text-[11px] font-semibold text-slate-500">{point.note}</p>}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="rounded-[1.5rem] border border-slate-100 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-black text-slate-900">
                <CalendarCheck2 className="h-4 w-4 text-blue-500" />
                상담 / 리포트
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {statusBlocks.map((block) => {
                const tone = block.tone ?? 'slate';
                return (
                  <div key={block.label} className="rounded-[1.1rem] border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{block.label}</p>
                      <Badge className={cn('border-none', TONE_CLASSES[tone].soft)}>{block.value}</Badge>
                    </div>
                    {block.helper && <p className="mt-2 text-[11px] font-semibold text-slate-500">{block.helper}</p>}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="rounded-[1.75rem] border border-slate-100 bg-[linear-gradient(180deg,rgba(248,250,255,0.9),rgba(255,255,255,1))] p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-primary" />
            <p className="text-sm font-black text-slate-900">즉시 액션</p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {actions.map((action) => {
              const tone = action.tone ?? 'outline';
              const content = (
                <Button
                  type="button"
                  asChild={Boolean(action.href)}
                  variant={tone === 'destructive' ? 'destructive' : tone === 'secondary' ? 'secondary' : tone === 'outline' ? 'outline' : 'default'}
                  disabled={action.disabled}
                  onClick={action.onClick}
                  className="h-auto min-h-[92px] w-full flex-col items-start justify-start rounded-[1.4rem] border p-4 text-left shadow-sm transition-all"
                >
                  {action.href ? (
                    <Link href={action.href}>
                      <div className="flex items-center gap-2">
                        <ActionIcon action={action} className="h-4 w-4" />
                        <span className="text-sm font-black">{action.label}</span>
                      </div>
                      {action.description && (
                        <span className="mt-2 text-xs font-medium leading-relaxed opacity-80">
                          {action.description}
                        </span>
                      )}
                    </Link>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <ActionIcon action={action} className="h-4 w-4" />
                        <span className="text-sm font-black">{action.label}</span>
                      </div>
                      {action.description && (
                        <span className="mt-2 text-xs font-medium leading-relaxed opacity-80">
                          {action.description}
                        </span>
                      )}
                    </>
                  )}
                </Button>
              );

              return <div key={action.label}>{content}</div>;
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
