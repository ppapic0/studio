'use client';

import { useMemo, useState } from 'react';
import {
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Clock,
  Maximize2,
  MessageCircle,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { DailyReport } from '@/lib/types';

type DailyReportAiMeta = NonNullable<DailyReport['aiMeta']>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeHistoryDate(value: unknown) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  const isoMatch = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const compactMatch = trimmed.match(/(\d{2})[./-](\d{2})$/);
  if (compactMatch) return `0000-${compactMatch[1]}-${compactMatch[2]}`;

  return trimmed;
}

function normalizeAiMeta(aiMeta?: DailyReport['aiMeta'] | null): DailyReportAiMeta | null {
  if (!isRecord(aiMeta)) return null;

  const rawMetrics: Record<string, unknown> = isRecord(aiMeta.metrics) ? aiMeta.metrics : {};
  const rawHistory = Array.isArray(aiMeta.history7Days) ? aiMeta.history7Days : [];

  return {
    teacherOneLiner: readString(aiMeta.teacherOneLiner),
    strengths: readStringList(aiMeta.strengths),
    improvements: readStringList(aiMeta.improvements),
    level: readNumber(aiMeta.level) || undefined,
    levelName: readString(aiMeta.levelName) || undefined,
    internalStage: readNumber(aiMeta.internalStage) || undefined,
    generationAttempt: readNumber(aiMeta.generationAttempt) || undefined,
    attendanceLabel: readString(aiMeta.attendanceLabel) || undefined,
    totalStudyMinutes: readNumber(aiMeta.totalStudyMinutes),
    completionRate: readNumber(aiMeta.completionRate),
    history7Days: rawHistory
      .map((entry) => {
        if (!isRecord(entry)) return null;
        const date = normalizeHistoryDate(entry.date);
        if (!date) return null;
        return {
          date,
          minutes: Math.max(0, Math.round(readNumber(entry.minutes))),
        };
      })
      .filter((entry): entry is { date: string; minutes: number } => Boolean(entry))
      .slice(-7),
    pedagogyLens: (readString(aiMeta.pedagogyLens) || undefined) as DailyReportAiMeta['pedagogyLens'],
    secondaryLens: (readString(aiMeta.secondaryLens) || undefined) as DailyReportAiMeta['secondaryLens'],
    stateBucket: readString(aiMeta.stateBucket) || undefined,
    variationKey: readString(aiMeta.variationKey) || undefined,
    variationSignature: readString(aiMeta.variationSignature) || undefined,
    variationStyle: (readString(aiMeta.variationStyle) || undefined) as DailyReportAiMeta['variationStyle'],
    coachingFocus: readString(aiMeta.coachingFocus) || undefined,
    homeTip: readString(aiMeta.homeTip) || undefined,
    studyBand: (readString(aiMeta.studyBand) || undefined) as DailyReportAiMeta['studyBand'],
    growthBand: (readString(aiMeta.growthBand) || undefined) as DailyReportAiMeta['growthBand'],
    completionBand: (readString(aiMeta.completionBand) || undefined) as DailyReportAiMeta['completionBand'],
    routineBand: (readString(aiMeta.routineBand) || undefined) as DailyReportAiMeta['routineBand'],
    volatilityBand: (readString(aiMeta.volatilityBand) || undefined) as DailyReportAiMeta['volatilityBand'],
    continuityBand: (readString(aiMeta.continuityBand) || undefined) as DailyReportAiMeta['continuityBand'],
    metrics: {
      growthRate: readNumber(rawMetrics.growthRate),
      deltaMinutesFromAvg: readNumber(rawMetrics.deltaMinutesFromAvg),
      avg7StudyMinutes: Math.max(0, Math.round(readNumber(rawMetrics.avg7StudyMinutes))),
      isNewRecord: Boolean(rawMetrics.isNewRecord),
      alertLow: Boolean(rawMetrics.alertLow),
      streakBadge: Boolean(rawMetrics.streakBadge),
      trendSummary: readString(rawMetrics.trendSummary),
    },
  };
}

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

function formatTrendDateLabel(date: string, isToday: boolean) {
  if (isToday) return '오늘';

  if (typeof date !== 'string' || !date.trim()) return '기록';

  const normalized = date.trim();
  const [month, day] = normalized.slice(5).split('-');
  if (!month || !day) return date.slice(5);
  return `${Number(month)}/${Number(day)}`;
}

type TrendPoint = {
  date: string;
  minutes: number;
};

function isNormalizedTrendDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^0000-\d{2}-\d{2}$/.test(value);
}

function buildMiniTrendPoints(aiMeta: DailyReportAiMeta, reportDateKey?: string): TrendPoint[] {
  const normalizedReportDate = normalizeHistoryDate(reportDateKey);
  const historyMap = new Map<string, TrendPoint>();

  [...(aiMeta.history7Days || [])]
    .map((entry) => ({
      date: normalizeHistoryDate(entry.date),
      minutes: Math.max(0, Math.round(Number(entry.minutes || 0))),
    }))
    .filter((entry) => isNormalizedTrendDate(entry.date))
    .sort((left, right) => left.date.localeCompare(right.date))
    .forEach((entry) => {
      if (normalizedReportDate && entry.date === normalizedReportDate) return;
      historyMap.set(entry.date, entry);
    });

  return [
    ...historyMap.values(),
    {
      date: normalizedReportDate || 'today',
      minutes: Math.max(0, Math.round(aiMeta.totalStudyMinutes || 0)),
    },
  ];
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

function buildContentSummarySnippet(content: string) {
  const cleaned = content
    .replace(/🕒|✅|📊|💬|🧠/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !['오늘 관찰', '교육학적 해석', '내일 코칭', '가정 연계 팁'].includes(line));

  const flattened = cleaned
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!flattened) return '오늘의 학습 흐름을 짧게 정리했습니다.';

  const sentenceCandidates = flattened
    .split(/(?<=[.!?])\s+|(?<=다\.)\s+|(?<=요\.)\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const deduped = sentenceCandidates.filter((item, index, array) => {
    if (index === 0) return true;
    return item.replace(/\s+/g, '') !== array[index - 1]?.replace(/\s+/g, '');
  });

  const joined = deduped.slice(0, 2).join(' ').trim() || deduped[0] || flattened;
  return joined.length > 72 ? `${joined.slice(0, 71).trimEnd()}…` : joined;
}

function toCompactCopy(value?: string | null, maxLength = 92) {
  const cleaned = (value || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  const sentenceCandidates = cleaned
    .split(/(?<=[.!?])\s+|(?<=다\.)\s+|(?<=요\.)\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const joined = (sentenceCandidates.slice(0, 2).join(' ').trim() || cleaned).replace(/\s+/g, ' ');
  return joined.length > maxLength ? `${joined.slice(0, maxLength - 1).trimEnd()}…` : joined;
}

function buildOverallSummary({
  aiMeta,
  studentName,
  dateKey,
  content,
}: {
  aiMeta?: DailyReportAiMeta | null;
  studentName?: string;
  dateKey?: string;
  content: string;
}) {
  const headline = aiMeta?.teacherOneLiner?.trim() || buildContentSummarySnippet(content);
  const subline = aiMeta
    ? `${studentName || '학생'}의 ${dateKey || '오늘'} 리포트입니다. ${toSummaryTone(aiMeta)} ${aiMeta.pedagogyLens ? `${aiMeta.pedagogyLens} 관점으로 핵심만 먼저 정리했습니다.` : ''}`.trim()
    : `${studentName || '학생'}의 ${dateKey || '오늘'} 리포트입니다. 핵심 흐름을 먼저 보고 아래에서 자세한 코칭을 확인할 수 있어요.`;

  return {
    headline,
    subline,
  };
}

function buildInterpretationCopy(aiMeta: DailyReportAiMeta) {
  const parts = [
    aiMeta.metrics?.trendSummary,
    aiMeta.growthBand && aiMeta.completionBand
      ? `오늘 흐름은 ${aiMeta.growthBand}, 실행 밀도는 ${aiMeta.completionBand} 구간으로 읽힙니다.`
      : null,
    aiMeta.routineBand && aiMeta.routineBand !== '정상'
      ? `생활 리듬은 ${aiMeta.routineBand} 상태라 학습량보다 시작 루틴을 먼저 바로잡는 것이 중요합니다.`
      : aiMeta.attendanceLabel || null,
  ]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));

  return parts.join(' ');
}

function buildFamilyQuestion(aiMeta: DailyReportAiMeta, studentName?: string) {
  const subject = studentName ? `${studentName} 학생에게` : '학생에게';

  if (aiMeta.routineBand && aiMeta.routineBand !== '정상') {
    return `${subject} 내일 시작을 더 편하게 만들려면 무엇이 필요할지 가볍게 물어봐 주세요.`;
  }

  if (aiMeta.coachingFocus) {
    return `${subject} 내일 ${aiMeta.coachingFocus}부터 어떻게 시작해 보고 싶은지 짧게 확인해 주세요.`;
  }

  return `${subject} 오늘 가장 잘 풀렸던 순간이 언제였는지 먼저 물어봐 주세요.`;
}

function SummaryHeroMetrics({
  aiMeta,
  compactMode = false,
}: {
  aiMeta?: DailyReportAiMeta | null;
  compactMode?: boolean;
}) {
  if (!aiMeta) return null;

  const metrics = [
    {
      label: '오늘 학습',
      value: formatStudyTime(aiMeta.totalStudyMinutes),
      detail: aiMeta.studyBand || '학습 흐름',
    },
    {
      label: '계획 완료',
      value: `${Math.round(aiMeta.completionRate || 0)}%`,
      detail: aiMeta.completionBand || '실행 밀도',
    },
    {
      label: '평균 대비',
      value: formatSignedMinutes(aiMeta.metrics?.deltaMinutesFromAvg),
      detail: formatSignedPercent(aiMeta.metrics?.growthRate),
    },
  ];

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {metrics.map((item) => (
        <div key={item.label} className="rounded-[1.35rem] border border-white/12 bg-white/10 px-4 py-3 backdrop-blur-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">{item.label}</p>
          <p className="mt-2 text-lg font-black tracking-tight text-white">{item.value}</p>
          <p className={cn('mt-1 text-xs font-bold text-white/68 break-keep', compactMode && 'leading-relaxed')}>{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

function ReportInsightBoard({
  aiMeta,
  displayHeadingsOnly = false,
  compactMode = false,
}: {
  aiMeta?: DailyReportAiMeta | null;
  displayHeadingsOnly?: boolean;
  compactMode?: boolean;
}) {
  if (!aiMeta) return null;

  const bandBadges = [
    aiMeta.pedagogyLens,
    aiMeta.secondaryLens,
    aiMeta.studyBand,
    aiMeta.continuityBand,
    aiMeta.variationStyle,
  ].filter(Boolean) as string[];

  if (compactMode) {
    return (
      <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="rounded-2xl bg-blue-50 p-2 text-blue-600">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">핵심 흐름</p>
            <p className={cn('mt-1 text-sm font-black tracking-tight text-slate-900', displayHeadingsOnly && 'font-aggro-display')}>
              오늘 리포트 한눈 요약
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm font-black leading-relaxed tracking-tight text-slate-900 break-keep">
          {buildInterpretationCopy(aiMeta)}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">출결</p>
            <p className="mt-2 text-sm font-black text-slate-900">{aiMeta.routineBand || '확인 중'}</p>
            <p className="mt-1 text-xs font-bold leading-relaxed text-slate-600 break-keep">
              {aiMeta.attendanceLabel || '오늘 출결 흐름 기준으로 분석했습니다.'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">성장</p>
            <p className="mt-2 text-sm font-black text-slate-900">{aiMeta.growthBand || '분석 중'}</p>
            <p className="mt-1 text-xs font-bold leading-relaxed text-slate-600 break-keep">
              평균 대비 {formatSignedMinutes(aiMeta.metrics?.deltaMinutesFromAvg)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {bandBadges.slice(0, 2).map((item) => (
            <Badge key={item} variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black text-slate-700">
              {item}
            </Badge>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="rounded-2xl bg-blue-50 p-2 text-blue-600">
          <TrendingUp className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">오늘 해석</p>
          <p className={cn('mt-1 text-sm font-black tracking-tight text-slate-900', displayHeadingsOnly && 'font-aggro-display')}>리포트가 읽어낸 핵심 흐름</p>
        </div>
      </div>

      <p className={cn('mt-4 font-black leading-relaxed tracking-tight text-slate-900', compactMode ? 'line-clamp-3 text-sm' : 'text-base')}>
        {compactMode ? toCompactCopy(buildInterpretationCopy(aiMeta), 108) : buildInterpretationCopy(aiMeta)}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(compactMode ? bandBadges.slice(0, 3) : bandBadges).map((item) => (
          <Badge key={item} variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black text-slate-700">
            {item}
          </Badge>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">출결 리듬</p>
          <p className="mt-2 text-sm font-black text-slate-900">{aiMeta.routineBand || '확인 중'}</p>
          <p className={cn('mt-1 text-xs font-bold leading-relaxed text-slate-600 break-keep', compactMode && 'whitespace-normal')}>
            {aiMeta.attendanceLabel || '오늘 출결 흐름 기준으로 분석했습니다.'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">성장 흐름</p>
          <p className="mt-2 text-sm font-black text-slate-900">{aiMeta.growthBand || '분석 중'}</p>
          <p className={cn('mt-1 text-xs font-bold leading-relaxed text-slate-600 break-keep', compactMode && 'whitespace-normal')}>
            평균 대비 {formatSignedMinutes(aiMeta.metrics?.deltaMinutesFromAvg)} / {formatSignedPercent(aiMeta.metrics?.growthRate)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ReportActionBoard({
  aiMeta,
  studentName,
  displayHeadingsOnly = false,
  compactMode = false,
}: {
  aiMeta?: DailyReportAiMeta | null;
  studentName?: string;
  displayHeadingsOnly?: boolean;
  compactMode?: boolean;
}) {
  if (!aiMeta) return null;

  const improvementLead = aiMeta.improvements?.[0] || aiMeta.metrics?.trendSummary || '내일은 한 가지 행동만 먼저 고정해 흐름을 지키겠습니다.';
  const strengthLead = aiMeta.strengths?.[0] || aiMeta.teacherOneLiner || '오늘 남은 강점을 먼저 인정한 뒤 다음 행동으로 연결해 주세요.';

  if (compactMode) {
    return (
      <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="rounded-2xl bg-amber-50 p-2 text-amber-600">
            <BrainCircuit className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">다음 액션</p>
            <p className={cn('mt-1 text-sm font-black tracking-tight text-slate-900', displayHeadingsOnly && 'font-aggro-display')}>
              내일 바로 쓰는 코칭
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="rounded-[1.35rem] border border-[#14295F]/10 bg-[#14295F] px-4 py-4 text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">내일 교실 코칭</p>
            <p className="mt-2 text-sm font-black leading-relaxed tracking-tight break-keep">
              {aiMeta.coachingFocus || '내일 첫 행동을 짧고 선명하게 잡겠습니다.'}
            </p>
            <p className="mt-2 text-xs font-bold leading-relaxed text-white/75 break-keep">
              {improvementLead}
            </p>
          </div>

          <div className="rounded-[1.35rem] border border-amber-100 bg-amber-50/60 px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700/70">가정 한마디</p>
            <p className="mt-2 text-sm font-black leading-relaxed tracking-tight text-slate-900 break-keep">
              {aiMeta.homeTip || '오늘의 흐름을 짧고 편안하게 확인해 주세요.'}
            </p>
            <p className="mt-2 text-xs font-bold leading-relaxed text-slate-700 break-keep">
              {`${strengthLead} ${buildFamilyQuestion(aiMeta, studentName)}`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="rounded-2xl bg-amber-50 p-2 text-amber-600">
          <BrainCircuit className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">다음 액션</p>
          <p className={cn('mt-1 text-sm font-black tracking-tight text-slate-900', displayHeadingsOnly && 'font-aggro-display')}>교실 코칭과 가정 대화를 한 번에</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="rounded-[1.35rem] border border-[#14295F]/10 bg-[#14295F] px-4 py-4 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">내일 교실 코칭</p>
          <p className={cn('mt-2 font-black leading-relaxed tracking-tight', compactMode ? 'line-clamp-2 text-sm' : 'text-base')}>
            {compactMode
              ? toCompactCopy(aiMeta.coachingFocus || '내일 첫 행동을 짧고 선명하게 잡겠습니다.', 60)
              : aiMeta.coachingFocus || '내일 첫 행동을 짧고 선명하게 잡겠습니다.'}
          </p>
          <p className={cn('mt-2 font-bold leading-relaxed text-white/75', compactMode ? 'line-clamp-2 text-xs' : 'text-sm')}>
            {compactMode ? toCompactCopy(improvementLead, 76) : improvementLead}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {aiMeta.pedagogyLens && (
              <Badge className="border-none bg-white/12 px-3 py-1 text-[10px] font-black text-white">{aiMeta.pedagogyLens}</Badge>
            )}
            {!compactMode && aiMeta.secondaryLens && (
              <Badge className="border-none bg-white/12 px-3 py-1 text-[10px] font-black text-white/85">{aiMeta.secondaryLens}</Badge>
            )}
          </div>
        </div>

        <div className="rounded-[1.35rem] border border-amber-100 bg-amber-50/60 px-4 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700/70">가정 대화 포인트</p>
          <p className={cn('mt-2 font-black leading-relaxed tracking-tight text-slate-900', compactMode ? 'line-clamp-2 text-sm' : 'text-base')}>
            {compactMode
              ? toCompactCopy(aiMeta.homeTip || '오늘의 흐름을 짧고 편안하게 확인해 주세요.', 68)
              : aiMeta.homeTip || '오늘의 흐름을 짧고 편안하게 확인해 주세요.'}
          </p>
          {compactMode ? (
            <div className="mt-3 rounded-2xl border border-white/70 bg-white/80 px-3 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700/70">짧게 한마디</p>
              <p className="mt-1 line-clamp-3 text-sm font-bold leading-relaxed text-slate-700">
                {toCompactCopy(`${strengthLead} ${buildFamilyQuestion(aiMeta, studentName)}`, 92)}
              </p>
            </div>
          ) : (
            <div className="mt-3 grid gap-2">
              <div className="rounded-2xl border border-white/70 bg-white/80 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700/70">먼저 인정</p>
                <p className="mt-1 text-sm font-bold leading-relaxed text-slate-700">{strengthLead}</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700/70">짧게 질문</p>
                <p className="mt-1 text-sm font-bold leading-relaxed text-slate-700">{buildFamilyQuestion(aiMeta, studentName)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniTrendChart({
  aiMeta,
  displayHeadingsOnly = false,
  reportDateKey,
  interactive = false,
  onExpand,
}: {
  aiMeta?: DailyReportAiMeta | null;
  displayHeadingsOnly?: boolean;
  reportDateKey?: string;
  interactive?: boolean;
  onExpand?: () => void;
}) {
  if (!aiMeta) return null;

  const points = buildMiniTrendPoints(aiMeta, reportDateKey);
  if (points.length === 0) return null;

  const maxMinutes = Math.max(1, ...points.map((point) => Math.max(0, point.minutes || 0)));

  return (
    <div className="min-w-0 overflow-hidden rounded-[1.5rem] border border-slate-100 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">학습시간 그래프</p>
          <p className={cn('mt-1 text-sm font-black tracking-tight text-slate-900 break-keep', displayHeadingsOnly && 'font-aggro-display')}>최근 7일 + 오늘</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Badge className="shrink-0 border-none bg-blue-50 text-blue-700 font-black">
            {formatStudyTime(aiMeta.totalStudyMinutes)}
          </Badge>
          {interactive && onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <Maximize2 className="h-3 w-3" />
              크게 보기
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 overflow-x-auto pb-1">
        <div className="relative min-w-[22rem] sm:min-w-0">
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-slate-200"
            style={{
              top: `${Math.max(10, Math.min(86, 100 - (Math.max(0, Math.round(aiMeta.metrics?.avg7StudyMinutes || 0)) / maxMinutes) * 88))}%`,
            }}
          />
          <div className="mb-2 flex justify-start sm:justify-end">
            <span className="max-w-full rounded-full bg-slate-100 px-2 py-0.5 text-[8px] font-black text-slate-500 sm:text-[10px]">
              평균 {formatStudyTime(aiMeta.metrics?.avg7StudyMinutes)}
            </span>
          </div>
          <div className="flex min-w-0 items-end gap-2 sm:grid sm:grid-cols-8 sm:gap-2">
            {points.map((point, index) => {
              const height = Math.max(18, Math.round(((point.minutes || 0) / maxMinutes) * 88));
              const isToday = index === points.length - 1;
              return (
                <div key={`${point.date}-${index}`} className="flex min-w-[2.25rem] flex-1 flex-col items-center gap-1.5 sm:gap-2">
                  <div
                    className={cn(
                      'w-full rounded-t-2xl rounded-b-md transition-all',
                      isToday ? 'bg-gradient-to-t from-primary to-blue-400' : 'bg-slate-200'
                    )}
                    style={{ height }}
                  />
                  <div className="w-full text-center">
                    <p className={cn('whitespace-nowrap text-[8px] font-black leading-tight sm:text-[10px]', isToday ? 'text-primary' : 'text-slate-400')}>
                      {formatTrendDateLabel(point.date, isToday)}
                    </p>
                    <p className="hidden whitespace-nowrap text-[8px] font-bold leading-tight text-slate-500 sm:block sm:text-[10px]">
                      {Math.round(point.minutes || 0)}분
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function toRoutineScore(routineBand?: DailyReportAiMeta['routineBand']) {
  switch (routineBand) {
    case '정상':
      return 92;
    case '지각':
      return 72;
    case '퇴실불안정':
      return 58;
    case '루틴누락':
      return 42;
    case '미입실':
      return 18;
    default:
      return 55;
  }
}

function toGrowthScore(growthRate?: number | null) {
  const safe = Number(growthRate || 0);
  return Math.max(10, Math.min(100, Math.round(50 + safe * 2)));
}

function toStudyScore(todayMinutes?: number | null, avgMinutes?: number | null) {
  const today = Math.max(0, Math.round(Number(todayMinutes || 0)));
  const avg = Math.max(1, Math.round(Number(avgMinutes || 0)));
  return Math.max(10, Math.min(100, Math.round((today / Math.max(today, avg)) * 100)));
}

function buildRadarPoint(value: number, angle: number, radius: number, center: number) {
  const radians = (Math.PI / 180) * angle;
  const distance = (radius * value) / 100;
  return {
    x: center + Math.cos(radians) * distance,
    y: center + Math.sin(radians) * distance,
  };
}

function SignalRadarCard({
  aiMeta,
  displayHeadingsOnly = false,
}: {
  aiMeta?: DailyReportAiMeta | null;
  displayHeadingsOnly?: boolean;
}) {
  if (!aiMeta) return null;

  const series = [
    { label: '학습', value: toStudyScore(aiMeta.totalStudyMinutes, aiMeta.metrics?.avg7StudyMinutes), angle: -90 },
    { label: '완료', value: Math.max(10, Math.min(100, Math.round(aiMeta.completionRate || 0))), angle: 0 },
    { label: '성장', value: toGrowthScore(aiMeta.metrics?.growthRate), angle: 90 },
    { label: '루틴', value: toRoutineScore(aiMeta.routineBand), angle: 180 },
  ];
  const center = 72;
  const radius = 54;
  const polygon = series
    .map((item) => buildRadarPoint(item.value, item.angle, radius, center))
    .map((point) => `${point.x},${point.y}`)
    .join(' ');

  return (
    <div className="min-w-0 rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">핵심 상태 그래프</p>
          <p className={cn('mt-1 text-sm font-black tracking-tight text-slate-900', displayHeadingsOnly && 'font-aggro-display')}>학습 · 완료 · 성장 · 루틴</p>
        </div>
        <Badge className="border-none bg-indigo-50 text-indigo-700 font-black">
          {aiMeta.pedagogyLens || '학습 해석'}
        </Badge>
      </div>
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
        <svg viewBox="0 0 144 144" className="h-36 w-36 shrink-0">
          {[18, 36, 54].map((ring) => (
            <circle key={ring} cx="72" cy="72" r={ring} fill="none" stroke="rgba(148,163,184,0.18)" strokeDasharray="3 4" />
          ))}
          {series.map((item) => {
            const point = buildRadarPoint(100, item.angle, radius, center);
            return (
              <line
                key={item.label}
                x1="72"
                y1="72"
                x2={point.x}
                y2={point.y}
                stroke="rgba(148,163,184,0.24)"
                strokeWidth="1"
              />
            );
          })}
          <polygon points={polygon} fill="rgba(37,99,235,0.18)" stroke="#2563EB" strokeWidth="2.5" />
          {series.map((item) => {
            const point = buildRadarPoint(item.value, item.angle, radius, center);
            return <circle key={`${item.label}-point`} cx={point.x} cy={point.y} r="4" fill="#14295F" />;
          })}
        </svg>
        <div className="grid min-w-0 flex-1 gap-2">
          {series.map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-2">
              <div className="mb-1 flex items-center justify-between text-xs font-black text-slate-600">
                <span>{item.label}</span>
                <span>{item.value}%</span>
              </div>
              <div className="h-2 rounded-full bg-white">
                <div className="h-2 rounded-full bg-gradient-to-r from-[#14295F] via-[#2563EB] to-[#60A5FA]" style={{ width: `${item.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiGraphGrid({
  aiMeta,
  displayHeadingsOnly = false,
  compactMode = false,
}: {
  aiMeta?: DailyReportAiMeta | null;
  displayHeadingsOnly?: boolean;
  compactMode?: boolean;
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
        <p className={cn('text-[10px] font-black uppercase tracking-[0.2em] text-slate-400', displayHeadingsOnly && 'font-aggro-display')}>상태 요약</p>
        <div className="mt-3 flex flex-wrap gap-2">
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
          <p className={cn('text-[10px] font-black uppercase tracking-[0.2em] text-slate-400', displayHeadingsOnly && 'font-aggro-display')}>학습시간 비교</p>
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
          <p className={cn('text-[10px] font-black uppercase tracking-[0.2em] text-slate-400', displayHeadingsOnly && 'font-aggro-display')}>완료율 · 성장률</p>
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
          <p className={cn('mt-3 text-xs font-bold leading-relaxed text-slate-600 break-keep', compactMode && 'whitespace-normal')}>
            {aiMeta.metrics?.trendSummary || '최근 흐름 요약이 없습니다.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function StrengthImprovementGrid({
  aiMeta,
  displayHeadingsOnly = false,
  compactMode = false,
}: {
  aiMeta?: DailyReportAiMeta | null;
  displayHeadingsOnly?: boolean;
  compactMode?: boolean;
}) {
  if (!aiMeta) return null;

  const strengths = aiMeta.strengths?.slice(0, compactMode ? 2 : 3) || [];
  const improvements = aiMeta.improvements?.slice(0, compactMode ? 2 : 3) || [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-[1.5rem] border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="rounded-2xl bg-emerald-50 p-2 text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600/70">오늘 잘한 점</p>
            <p className={cn('mt-1 text-sm font-black tracking-tight text-slate-900', displayHeadingsOnly && 'font-aggro-display')}>유지할 강점</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          {strengths.length > 0 ? strengths.map((item, index) => (
            <div key={`${item}-${index}`} className="rounded-2xl border border-emerald-100 bg-emerald-50/45 px-3 py-3">
              <div className="mb-2 h-1.5 w-full rounded-full bg-emerald-100">
                <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${88 - index * 16}%` }} />
              </div>
              <p className={cn('text-sm font-bold leading-relaxed text-slate-700', compactMode && 'line-clamp-2')}>
                {compactMode ? toCompactCopy(item, 72) : item}
              </p>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/35 px-3 py-4 text-sm font-semibold text-slate-500">
              아직 강점 요약이 없습니다.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-amber-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="rounded-2xl bg-amber-50 p-2 text-amber-600">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600/70">코칭 포인트</p>
            <p className={cn('mt-1 text-sm font-black tracking-tight text-slate-900', displayHeadingsOnly && 'font-aggro-display')}>먼저 보완할 점</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          {improvements.length > 0 ? improvements.map((item, index) => (
            <div key={`${item}-${index}`} className="rounded-2xl border border-amber-100 bg-amber-50/45 px-3 py-3">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-amber-100">
                  <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${76 - index * 12}%` }} />
                </div>
                <span className="text-[10px] font-black text-amber-700">우선</span>
              </div>
              <p className={cn('text-sm font-bold leading-relaxed text-slate-700', compactMode && 'line-clamp-2')}>
                {compactMode ? toCompactCopy(item, 72) : item}
              </p>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-amber-100 bg-amber-50/35 px-3 py-4 text-sm font-semibold text-slate-500">
              아직 보완 포인트가 없습니다.
            </div>
          )}
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
  displayHeadingsOnly = false,
  compactMode = false,
}: {
  content: string;
  aiMeta?: DailyReport['aiMeta'] | null;
  dateKey?: string;
  studentName?: string;
  displayHeadingsOnly?: boolean;
  compactMode?: boolean;
}) {
  const [isTrendChartDialogOpen, setIsTrendChartDialogOpen] = useState(false);
  const normalizedAiMeta = useMemo(() => normalizeAiMeta(aiMeta), [aiMeta]);
  const sections = useMemo(() => {
    if (!content) return [];
    const parts = content.split(/(?=🕒|✅|📊|💬|🧠)/g);
    return parts.map((part) => part.trim()).filter(Boolean);
  }, [content]);

  const overallSummary = useMemo(
    () => buildOverallSummary({ aiMeta: normalizedAiMeta, studentName, dateKey, content }),
    [normalizedAiMeta, content, dateKey, studentName]
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
              {normalizedAiMeta?.variationStyle && (
                <Badge className="border-none bg-white/10 text-white/85 font-black">{normalizedAiMeta.variationStyle}</Badge>
              )}
            </div>
            {!compactMode && (
              <p className={cn('mt-4 font-black tracking-tight leading-snug break-keep text-xl sm:text-2xl', displayHeadingsOnly && 'font-aggro-display')}>
                {overallSummary.headline}
              </p>
            )}
            <p className={cn('font-bold leading-relaxed text-white/80 break-keep', compactMode ? 'mt-4 text-xs sm:text-sm' : 'mt-2 text-sm')}>
              {overallSummary.subline}
            </p>
            <SummaryHeroMetrics aiMeta={normalizedAiMeta} compactMode={compactMode} />
          </CardContent>
        </Card>
      )}

      {normalizedAiMeta && (
        compactMode ? (
          <>
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
              <MiniTrendChart
                aiMeta={normalizedAiMeta}
                displayHeadingsOnly={displayHeadingsOnly}
                reportDateKey={dateKey}
                interactive
                onExpand={() => setIsTrendChartDialogOpen(true)}
              />
              <SignalRadarCard aiMeta={normalizedAiMeta} displayHeadingsOnly={displayHeadingsOnly} />
            </div>
            <KpiGraphGrid aiMeta={normalizedAiMeta} displayHeadingsOnly={displayHeadingsOnly} compactMode />
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <ReportInsightBoard aiMeta={normalizedAiMeta} displayHeadingsOnly={displayHeadingsOnly} compactMode />
              <ReportActionBoard aiMeta={normalizedAiMeta} studentName={studentName} displayHeadingsOnly={displayHeadingsOnly} compactMode />
            </div>
          </>
        ) : (
          <>
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <ReportInsightBoard aiMeta={normalizedAiMeta} displayHeadingsOnly={displayHeadingsOnly} />
              <ReportActionBoard aiMeta={normalizedAiMeta} studentName={studentName} displayHeadingsOnly={displayHeadingsOnly} />
            </div>
            <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
              <MiniTrendChart aiMeta={normalizedAiMeta} displayHeadingsOnly={displayHeadingsOnly} reportDateKey={dateKey} />
              <SignalRadarCard aiMeta={normalizedAiMeta} displayHeadingsOnly={displayHeadingsOnly} />
            </div>
            <KpiGraphGrid aiMeta={normalizedAiMeta} displayHeadingsOnly={displayHeadingsOnly} />
            <StrengthImprovementGrid aiMeta={normalizedAiMeta} displayHeadingsOnly={displayHeadingsOnly} />
          </>
        )
      )}

      {!compactMode && sections.map((section, index) => {
        const lines = section.split('\n');
        const title = lines[0];
        const body = lines.slice(1).join('\n');

        return (
          <Card key={`${title}-${index}`} className={cn('overflow-hidden rounded-[1.5rem] border shadow-sm', getSectionColor(title))}>
            <CardHeader className="border-b border-white/20 p-5 pb-2">
              <div className="flex items-center gap-2">
                {getSectionIcon(title)}
                <span className={cn('text-sm font-black tracking-tight', displayHeadingsOnly && 'font-aggro-display')}>{title.replace(/^[^\s]+\s/, '')}</span>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <p className={cn('whitespace-pre-wrap break-keep text-sm font-bold leading-relaxed text-foreground/80', compactMode && 'line-clamp-3')}>
                {compactMode ? toCompactCopy(body.replace(/\n+/g, ' '), 110) : body}
              </p>
            </CardContent>
          </Card>
        );
      })}

      {compactMode && normalizedAiMeta && (
        <Dialog open={isTrendChartDialogOpen} onOpenChange={setIsTrendChartDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden rounded-[2rem] border-none p-0">
            <DialogHeader className="border-b bg-white px-6 py-5 text-left sm:px-8">
              <DialogTitle className="text-xl font-black tracking-tight text-[#14295F]">학습시간 그래프</DialogTitle>
              <DialogDescription className="font-bold text-slate-500">
                최근 7일과 오늘 흐름을 크게 확인할 수 있어요.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[calc(90vh-5.5rem)] overflow-y-auto bg-[#fafafa] p-4 sm:p-6">
              <MiniTrendChart
                aiMeta={normalizedAiMeta}
                displayHeadingsOnly={displayHeadingsOnly}
                reportDateKey={dateKey}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
