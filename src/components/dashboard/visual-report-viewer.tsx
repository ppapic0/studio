'use client';

import { useMemo } from 'react';
import {
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Clock,
  MessageCircle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DailyReport } from '@/lib/types';

type DailyReportAiMeta = NonNullable<DailyReport['aiMeta']>;

function formatStudyTime(totalMinutes?: number | null) {
  const minutes = Math.max(0, Math.round(Number(totalMinutes || 0)));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

function formatSignedPercent(value?: number | null) {
  const safe = Math.round(Number(value || 0) * 10) / 10;
  return `${safe >= 0 ? '+' : ''}${safe}%`;
}

function formatSignedMinutes(value?: number | null) {
  const safe = Math.round(Number(value || 0));
  return `${safe >= 0 ? '+' : ''}${safe}분`;
}

function toSummaryTone(aiMeta?: DailyReportAiMeta | null) {
  if (!aiMeta?.growthBand && !aiMeta?.routineBand) return '차분한 흐름입니다.';
  if (aiMeta.growthBand === '급상승' || aiMeta.growthBand === '상승') {
    return aiMeta.routineBand === '정상'
      ? '좋은 흐름이 안정적으로 이어지고 있습니다.'
      : '학습량은 좋지만 생활 루틴 보정이 같이 필요합니다.';
  }
  if (aiMeta.growthBand === '급하락' || aiMeta.growthBand === '하락') {
    return '회복형 코칭이 필요한 구간입니다.';
  }
  if (aiMeta.routineBand && aiMeta.routineBand !== '정상') {
    return '학습량보다 먼저 리듬을 바로잡는 것이 중요합니다.';
  }
  return '안정적인 흐름을 조금 더 끌어올릴 수 있는 상태입니다.';
}

function getRoutineTone(routineBand?: DailyReportAiMeta['routineBand']) {
  switch (routineBand) {
    case '정상':
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case '지각':
      return 'bg-amber-50 text-amber-700 border-amber-100';
    case '루틴누락':
      return 'bg-orange-50 text-orange-700 border-orange-100';
    case '미입실':
      return 'bg-rose-50 text-rose-700 border-rose-100';
    case '퇴실불안정':
      return 'bg-sky-50 text-sky-700 border-sky-100';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-100';
  }
}

function getSectionIcon(text: string) {
  if (text.includes('출결')) return <Clock className="h-5 w-5 text-blue-600" />;
  if (text.includes('계획 완수율')) return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
  if (text.includes('인공지능 분석') || text.includes('AI 분석') || text.includes('교육학적 해석')) {
    return <TrendingUp className="h-5 w-5 text-purple-600" />;
  }
  if (text.includes('코멘트') || text.includes('내일 코칭')) return <MessageCircle className="h-5 w-5 text-amber-600" />;
  if (text.includes('인공지능 종합 피드백') || text.includes('AI 종합 피드백') || text.includes('가정 연계 팁')) {
    return <BrainCircuit className="h-5 w-5 text-rose-600" />;
  }
  return <Sparkles className="h-5 w-5 text-primary" />;
}

function getSectionColor(text: string) {
  if (text.includes('출결')) return 'bg-blue-50/50 border-blue-100';
  if (text.includes('계획 완수율')) return 'bg-emerald-50/50 border-emerald-100';
  if (text.includes('인공지능 분석') || text.includes('AI 분석') || text.includes('교육학적 해석')) {
    return 'bg-purple-50/50 border-purple-100';
  }
  if (text.includes('코멘트') || text.includes('내일 코칭')) return 'bg-amber-50/50 border-amber-100';
  if (text.includes('인공지능 종합 피드백') || text.includes('AI 종합 피드백') || text.includes('가정 연계 팁')) {
    return 'bg-rose-50/50 border-rose-100';
  }
  return 'bg-muted/30 border-border';
}

function buildOverallSummary({
  aiMeta,
  studentName,
  dateKey,
}: {
  aiMeta?: DailyReportAiMeta | null;
  studentName?: string;
  dateKey?: string;
}) {
  if (!aiMeta) return null;

  const headline = aiMeta.teacherOneLiner?.trim() || '오늘의 학습 흐름을 정리했습니다.';
  const subline = `${studentName || '학생'}의 ${dateKey || '오늘'} 리포트입니다. ${toSummaryTone(aiMeta)}`;

  return {
    headline,
    subline,
  };
}

function MiniTrendChart({
  aiMeta,
}: {
  aiMeta?: DailyReportAiMeta | null;
}) {
  if (!aiMeta) return null;

  const history = aiMeta.history7Days || [];
  const points = [...history, { date: 'today', minutes: aiMeta.totalStudyMinutes || 0 }];
  if (points.length === 0) return null;

  const maxMinutes = Math.max(1, ...points.map((point) => Math.max(0, point.minutes || 0)));

  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">학습시간 그래프</p>
          <p className="mt-1 text-sm font-black tracking-tight text-slate-900">최근 7일 + 오늘</p>
        </div>
        <Badge className="border-none bg-blue-50 text-blue-700 font-black">
          {formatStudyTime(aiMeta.totalStudyMinutes)}
        </Badge>
      </div>
      <div className="mt-4 flex items-end gap-2">
        {points.map((point, index) => {
          const height = Math.max(18, Math.round(((point.minutes || 0) / maxMinutes) * 88));
          const isToday = index === points.length - 1;
          return (
            <div key={`${point.date}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div
                className={cn(
                  'w-full rounded-t-2xl rounded-b-md transition-all',
                  isToday ? 'bg-gradient-to-t from-primary to-blue-400' : 'bg-slate-200'
                )}
                style={{ height }}
              />
              <div className="text-center">
                <p className={cn('text-[10px] font-black', isToday ? 'text-primary' : 'text-slate-400')}>
                  {isToday ? '오늘' : point.date.slice(5)}
                </p>
                <p className="text-[10px] font-bold text-slate-500">{Math.round(point.minutes || 0)}분</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiGraphGrid({
  aiMeta,
}: {
  aiMeta?: DailyReportAiMeta | null;
}) {
  if (!aiMeta) return null;

  const completionWidth = Math.max(6, Math.min(100, Math.round(aiMeta.completionRate || 0)));
  const todayMinutes = Math.max(0, Math.round(aiMeta.totalStudyMinutes || 0));
  const avgMinutes = Math.max(1, Math.round(aiMeta.metrics?.avg7StudyMinutes || 0));
  const studyRatio = Math.max(8, Math.min(100, Math.round((todayMinutes / Math.max(todayMinutes, avgMinutes)) * 100)));
  const avgRatio = Math.max(8, Math.min(100, Math.round((avgMinutes / Math.max(todayMinutes, avgMinutes)) * 100)));
  const growthPositive = Number(aiMeta.metrics?.growthRate || 0) >= 0;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">전체요약</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {aiMeta.levelName && (
            <Badge className="border-none bg-indigo-50 text-indigo-700 font-black">
              {`Lv.${aiMeta.level || '-'} ${aiMeta.levelName}`}
            </Badge>
          )}
          {aiMeta.pedagogyLens && (
            <Badge className="border-none bg-sky-50 text-sky-700 font-black">
              {aiMeta.pedagogyLens}
            </Badge>
          )}
          {aiMeta.routineBand && (
            <Badge className={cn('font-black border', getRoutineTone(aiMeta.routineBand))}>
              {aiMeta.routineBand}
            </Badge>
          )}
        </div>
        {aiMeta.attendanceLabel && (
          <p className="mt-3 text-sm font-bold leading-relaxed text-slate-700">{aiMeta.attendanceLabel}</p>
        )}
      </div>

      <div className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">학습시간 비교</p>
          <span className="text-xs font-black text-slate-600">{formatSignedMinutes(aiMeta.metrics?.deltaMinutesFromAvg)}</span>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-600">
              <span>오늘</span>
              <span>{formatStudyTime(todayMinutes)}</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100">
              <div className="h-3 rounded-full bg-primary" style={{ width: `${studyRatio}%` }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-600">
              <span>최근 7일 평균</span>
              <span>{formatStudyTime(avgMinutes)}</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100">
              <div className="h-3 rounded-full bg-slate-300" style={{ width: `${avgRatio}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">완료율 · 성장률</p>
          <span className={cn('text-xs font-black', growthPositive ? 'text-emerald-600' : 'text-rose-600')}>
            {formatSignedPercent(aiMeta.metrics?.growthRate)}
          </span>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-600">
            <span>계획 완료율</span>
            <span>{Math.round(aiMeta.completionRate || 0)}%</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100">
            <div
              className={cn(
                'h-3 rounded-full',
                completionWidth >= 80 ? 'bg-emerald-500' : completionWidth >= 60 ? 'bg-amber-500' : 'bg-rose-500'
              )}
              style={{ width: `${completionWidth}%` }}
            />
          </div>
          <p className="mt-3 text-xs font-bold leading-relaxed text-slate-600">
            {aiMeta.metrics?.trendSummary || '최근 흐름 요약이 없습니다.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export function VisualReportViewer({
  content,
  aiMeta,
  dateKey,
  studentName,
}: {
  content: string;
  aiMeta?: DailyReport['aiMeta'] | null;
  dateKey?: string;
  studentName?: string;
}) {
  const sections = useMemo(() => {
    if (!content) return [];
    const parts = content.split(/(?=🕒|✅|📊|💬|🧠)/g);
    return parts.map((part) => part.trim()).filter(Boolean);
  }, [content]);

  const overallSummary = useMemo(
    () => buildOverallSummary({ aiMeta: aiMeta || null, studentName, dateKey }),
    [aiMeta, dateKey, studentName]
  );

  if (!content) {
    return (
      <div className="py-20 text-center opacity-20 italic">
        <Sparkles className="mx-auto mb-4 h-12 w-12" />
        <p className="font-black">리포트 내용을 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-700">
      {overallSummary && (
        <Card className="overflow-hidden rounded-[1.75rem] border-none bg-gradient-to-br from-[#14295F] via-[#274690] to-[#3B82F6] text-white shadow-xl">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-none bg-white/15 text-white font-black">
                <CalendarDays className="mr-1 h-3.5 w-3.5" />
                전체요약
              </Badge>
              {dateKey && (
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/65">{dateKey}</span>
              )}
            </div>
            <p className="mt-4 text-xl font-black tracking-tight sm:text-2xl">{overallSummary.headline}</p>
            <p className="mt-2 text-sm font-bold leading-relaxed text-white/80">{overallSummary.subline}</p>
          </CardContent>
        </Card>
      )}

      {aiMeta && (
        <>
          <KpiGraphGrid aiMeta={aiMeta || null} />
          <MiniTrendChart aiMeta={aiMeta || null} />
        </>
      )}

      {sections.map((section, index) => {
        const lines = section.split('\n');
        const title = lines[0];
        const body = lines.slice(1).join('\n');

        return (
          <Card key={`${title}-${index}`} className={cn('overflow-hidden rounded-[1.5rem] border shadow-sm', getSectionColor(title))}>
            <CardHeader className="border-b border-white/20 p-5 pb-2">
              <div className="flex items-center gap-2">
                {getSectionIcon(title)}
                <span className="text-sm font-black tracking-tight">{title.replace(/^[^\s]+\s/, '')}</span>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <p className="whitespace-pre-wrap break-keep text-sm font-bold leading-relaxed text-foreground/80">
                {body}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
