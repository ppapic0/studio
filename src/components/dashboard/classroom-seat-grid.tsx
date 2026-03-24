'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Armchair,
  BadgeAlert,
  CalendarCheck2,
  Clock3,
  FileText,
  LayoutGrid,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Users,
  Wifi,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export type ClassroomOverlayMode =
  | 'status'
  | 'risk'
  | 'penalty'
  | 'minutes'
  | 'counseling'
  | 'report';

export type ClassroomSeatKind = 'student' | 'empty' | 'aisle';
export type ClassroomSeatStatus = 'studying' | 'away' | 'break' | 'absent';
export type ClassroomTone = 'emerald' | 'amber' | 'orange' | 'rose' | 'blue' | 'slate';

export interface ClassroomSeatDatum {
  id: string;
  seatNo: number;
  kind?: ClassroomSeatKind;
  status?: ClassroomSeatStatus;
  studentId?: string;
  studentName?: string;
  className?: string;
  seatZone?: string;
  todayMinutes?: number;
  riskLevel?: '안정' | '주의' | '위험' | '긴급' | string;
  effectivePenaltyPoints?: number;
  hasUnreadReport?: boolean;
  hasCounselingToday?: boolean;
  overlayFlags?: string[];
  note?: string;
}

export interface ClassroomSeatFilterChip {
  id: string;
  label: string;
  count?: number;
  icon?: LucideIcon;
  tone?: ClassroomTone;
  description?: string;
}

export interface ClassroomSeatLegendItem {
  id: string;
  label: string;
  tone: ClassroomTone;
  icon?: LucideIcon;
  description?: string;
}

export interface ClassroomSeatGridProps {
  rows: number;
  cols: number;
  seats: ClassroomSeatDatum[];
  overlayMode: ClassroomOverlayMode;
  title?: string;
  description?: string;
  selectedSeatId?: string | null;
  activeFilterId?: string | null;
  filters?: ClassroomSeatFilterChip[];
  legendItems?: ClassroomSeatLegendItem[];
  onOverlayModeChange?: (mode: ClassroomOverlayMode) => void;
  onSeatSelect?: (seat: ClassroomSeatDatum) => void;
  onFilterChange?: (filterId: string | null) => void;
  seatMatchesActiveFilter?: (seat: ClassroomSeatDatum, activeFilterId: string | null) => boolean;
  className?: string;
}

type SeatPresentation = {
  tone: ClassroomTone;
  title: string;
  value: string;
  helper: string;
  icon: LucideIcon;
};

const OVERLAY_META: Record<
  ClassroomOverlayMode,
  { label: string; description: string; icon: LucideIcon }
> = {
  status: {
    label: '상태',
    description: '출결과 현재 흐름을 바로 확인합니다.',
    icon: Users,
  },
  risk: {
    label: '리스크',
    description: '즉시 봐야 할 고위험 좌석을 강조합니다.',
    icon: ShieldAlert,
  },
  penalty: {
    label: '벌점',
    description: '벌점 임계치와 누적 흐름을 드러냅니다.',
    icon: BadgeAlert,
  },
  minutes: {
    label: '학습량',
    description: '오늘 학습 시간을 상대 비교합니다.',
    icon: Clock3,
  },
  counseling: {
    label: '상담',
    description: '상담 예정과 미처리 대상을 표시합니다.',
    icon: CalendarCheck2,
  },
  report: {
    label: '리포트',
    description: '미열람 리포트와 피드백 흐름을 보여줍니다.',
    icon: FileText,
  },
};

const STATUS_META: Record<
  ClassroomSeatStatus,
  { tone: ClassroomTone; label: string; icon: LucideIcon; helper: string }
> = {
  studying: { tone: 'blue', label: '수업중', icon: Wifi, helper: '실시간 학습 중' },
  away: { tone: 'amber', label: '외출', icon: LayoutGrid, helper: '자리 비움' },
  break: { tone: 'orange', label: '휴식', icon: Sparkles, helper: '짧은 휴식' },
  absent: { tone: 'slate', label: '미입실', icon: Armchair, helper: '자리 비어 있음' },
};

const RISK_META: Record<
  '안정' | '주의' | '위험' | '긴급',
  { tone: ClassroomTone; label: string; icon: LucideIcon; helper: string }
> = {
  안정: { tone: 'emerald', label: '안정', icon: Sparkles, helper: '관찰 유지' },
  주의: { tone: 'amber', label: '주의', icon: BadgeAlert, helper: '변화 관찰' },
  위험: { tone: 'orange', label: '위험', icon: ShieldAlert, helper: '개입 필요' },
  긴급: { tone: 'rose', label: '긴급', icon: ShieldAlert, helper: '즉시 확인' },
};

const TONE_CLASSES: Record<
  ClassroomTone,
  { border: string; soft: string; ring: string }
> = {
  emerald: { border: 'border-emerald-200', soft: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-400/20' },
  amber: { border: 'border-amber-200', soft: 'bg-amber-100 text-amber-700', ring: 'ring-amber-400/20' },
  orange: { border: 'border-orange-200', soft: 'bg-orange-100 text-orange-700', ring: 'ring-orange-400/20' },
  rose: { border: 'border-rose-200', soft: 'bg-rose-100 text-rose-700', ring: 'ring-rose-400/20' },
  blue: { border: 'border-blue-200', soft: 'bg-blue-100 text-blue-700', ring: 'ring-blue-400/20' },
  slate: { border: 'border-slate-200', soft: 'bg-slate-100 text-slate-700', ring: 'ring-slate-400/20' },
};

function formatMinutes(minutes?: number) {
  const value = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(value / 60);
  const remainder = value % 60;
  return hours === 0 ? `${remainder}분` : `${hours}시간 ${remainder}분`;
}

function formatPenalty(points?: number) {
  return `${Math.max(0, Math.round(Number(points || 0)))}점`;
}

function getRiskKey(level?: string): '안정' | '주의' | '위험' | '긴급' {
  if (level === '주의' || level === '위험' || level === '긴급') return level;
  return '안정';
}

function getSeatPresentation(seat: ClassroomSeatDatum, overlayMode: ClassroomOverlayMode): SeatPresentation {
  if (seat.kind === 'empty') {
    return {
      tone: 'slate',
      title: '빈좌석',
      value: '대기',
      helper: '아직 배정되지 않았습니다.',
      icon: Armchair,
    };
  }

  if (seat.kind === 'aisle') {
    return {
      tone: 'slate',
      title: '통로',
      value: '동선',
      helper: '배치 보조 영역입니다.',
      icon: LayoutGrid,
    };
  }

  if (overlayMode === 'risk') {
    const riskKey = getRiskKey(seat.riskLevel);
    const meta = RISK_META[riskKey];
    return {
      tone: meta.tone,
      title: meta.label,
      value: meta.label,
      helper: meta.helper,
      icon: meta.icon,
    };
  }

  if (overlayMode === 'penalty') {
    const penalty = Math.max(0, Number(seat.effectivePenaltyPoints || 0));
    const tone: ClassroomTone = penalty >= 12 ? 'rose' : penalty >= 7 ? 'orange' : penalty > 0 ? 'amber' : 'emerald';
    return {
      tone,
      title: '벌점',
      value: formatPenalty(penalty),
      helper: penalty >= 12 ? '학부모/상담 우선' : penalty >= 7 ? '교사 확인 필요' : '안정 구간',
      icon: BadgeAlert,
    };
  }

  if (overlayMode === 'minutes') {
    const minutes = Math.max(0, Number(seat.todayMinutes || 0));
    const tone: ClassroomTone = minutes >= 240 ? 'emerald' : minutes >= 120 ? 'blue' : minutes >= 60 ? 'amber' : 'slate';
    return {
      tone,
      title: '학습량',
      value: formatMinutes(minutes),
      helper: minutes >= 240 ? '충분한 누적' : '관찰 필요',
      icon: Clock3,
    };
  }

  if (overlayMode === 'counseling') {
    const tone: ClassroomTone = seat.hasCounselingToday ? 'rose' : seat.overlayFlags?.includes('counselingPending') ? 'amber' : 'emerald';
    return {
      tone,
      title: '상담',
      value: seat.hasCounselingToday ? '오늘' : seat.overlayFlags?.includes('counselingPending') ? '예정' : '없음',
      helper: seat.hasCounselingToday ? '오늘 상담 일정이 있습니다.' : '상담 흐름을 점검하세요.',
      icon: CalendarCheck2,
    };
  }

  if (overlayMode === 'report') {
    const tone: ClassroomTone = seat.hasUnreadReport ? 'amber' : 'emerald';
    return {
      tone,
      title: '리포트',
      value: seat.hasUnreadReport ? '미열람' : '열람',
      helper: seat.hasUnreadReport ? '최근 리포트를 확인해야 합니다.' : '열람 완료',
      icon: FileText,
    };
  }

  const status = seat.status ?? 'absent';
  const meta = STATUS_META[status];
  return {
    tone: meta.tone,
    title: meta.label,
    value: meta.label,
    helper: meta.helper,
    icon: meta.icon,
  };
}

function getDefaultLegend(mode: ClassroomOverlayMode): ClassroomSeatLegendItem[] {
  if (mode === 'risk') {
    return [
      { id: 'risk-safe', label: '안정', tone: 'emerald', icon: Sparkles, description: '추적 관찰' },
      { id: 'risk-watch', label: '주의', tone: 'amber', icon: BadgeAlert, description: '점검 필요' },
      { id: 'risk-high', label: '위험', tone: 'orange', icon: ShieldAlert, description: '개입 권장' },
      { id: 'risk-critical', label: '긴급', tone: 'rose', icon: ShieldAlert, description: '즉시 확인' },
    ];
  }

  if (mode === 'penalty') {
    return [
      { id: 'penalty-none', label: '0점', tone: 'emerald', icon: Sparkles, description: '안정' },
      { id: 'penalty-mid', label: '1~6점', tone: 'amber', icon: BadgeAlert, description: '누적 관찰' },
      { id: 'penalty-high', label: '7~11점', tone: 'orange', icon: ShieldAlert, description: '교사 확인' },
      { id: 'penalty-critical', label: '12점+', tone: 'rose', icon: ShieldAlert, description: '상담 우선' },
    ];
  }

  if (mode === 'minutes') {
    return [
      { id: 'minutes-low', label: '낮음', tone: 'slate', icon: Clock3, description: '60분 미만' },
      { id: 'minutes-mid', label: '보통', tone: 'blue', icon: Clock3, description: '60~239분' },
      { id: 'minutes-high', label: '높음', tone: 'emerald', icon: Clock3, description: '240분 이상' },
    ];
  }

  if (mode === 'counseling') {
    return [
      { id: 'counseling-today', label: '오늘 상담', tone: 'rose', icon: CalendarCheck2, description: '확인 필요' },
      { id: 'counseling-pending', label: '대기', tone: 'amber', icon: MessageSquare, description: '일정 조율' },
      { id: 'counseling-none', label: '없음', tone: 'emerald', icon: Sparkles, description: '정상' },
    ];
  }

  if (mode === 'report') {
    return [
      { id: 'report-unread', label: '미열람', tone: 'amber', icon: FileText, description: '읽기 필요' },
      { id: 'report-read', label: '열람', tone: 'emerald', icon: FileText, description: '확인 완료' },
    ];
  }

  return [
    { id: 'status-studying', label: '수업중', tone: 'blue', icon: Wifi, description: '실시간 활동' },
    { id: 'status-away', label: '외출', tone: 'amber', icon: LayoutGrid, description: '자리 비움' },
    { id: 'status-break', label: '휴식', tone: 'orange', icon: Sparkles, description: '짧은 휴식' },
    { id: 'status-absent', label: '미입실', tone: 'slate', icon: Armchair, description: '빈자리' },
  ];
}

function defaultSeatMatchesFilter(seat: ClassroomSeatDatum, activeFilterId: string | null) {
  if (!activeFilterId || activeFilterId === 'all') return true;
  if (seat.kind === 'empty' || seat.kind === 'aisle') return activeFilterId === 'empty' || activeFilterId === 'aisle';

  const riskKey = getRiskKey(seat.riskLevel);
  switch (activeFilterId) {
    case 'studying':
      return seat.status === 'studying';
    case 'away':
      return seat.status === 'away' || seat.status === 'break';
    case 'absent':
      return seat.status === 'absent';
    case 'atRisk':
      return riskKey === '주의' || riskKey === '위험' || riskKey === '긴급';
    case 'critical':
      return riskKey === '긴급';
    case 'awayLong':
      return seat.status === 'away' || seat.status === 'break';
    case 'unreadReport':
      return Boolean(seat.hasUnreadReport);
    case 'counseling':
      return Boolean(seat.hasCounselingToday || seat.overlayFlags?.includes('counselingPending'));
    case 'highPenalty':
      return Number(seat.effectivePenaltyPoints || 0) >= 7;
    case 'lowMinutes':
      return Number(seat.todayMinutes || 0) < 120;
    default:
      return true;
  }
}

function toneChipClass(tone: ClassroomTone, selected?: boolean) {
  const meta = TONE_CLASSES[tone];
  return selected
    ? cn(meta.soft, 'ring-2 ring-offset-2 ring-offset-white', meta.ring)
    : cn('bg-white/90 text-slate-700 border-slate-200 hover:bg-white', meta.border);
}

function MetricPill({
  tone,
  label,
  value,
  icon: Icon,
}: {
  tone: ClassroomTone;
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className={cn('inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5', TONE_CLASSES[tone].soft)}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <div className="leading-none">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{label}</p>
        <p className="text-[11px] font-black">{value}</p>
      </div>
    </div>
  );
}

function SeatCard({
  seat,
  overlayMode,
  selected,
  dimmed,
  onClick,
}: {
  seat: ClassroomSeatDatum;
  overlayMode: ClassroomOverlayMode;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}) {
  const presentation = getSeatPresentation(seat, overlayMode);
  const Icon = presentation.icon;
  const statusTone = TONE_CLASSES[presentation.tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex min-h-[108px] flex-col justify-between overflow-hidden rounded-[1.5rem] border bg-white p-3 text-left transition-all duration-300',
        'shadow-[0_10px_35px_rgba(20,41,95,0.06)] hover:-translate-y-0.5 hover:shadow-[0_16px_45px_rgba(20,41,95,0.12)]',
        statusTone.border,
        selected && 'ring-4 ring-offset-2 ring-offset-white',
        selected && statusTone.ring,
        dimmed && 'opacity-35 grayscale',
        seat.kind === 'empty' && 'border-dashed bg-slate-50',
        seat.kind === 'aisle' && 'border-dashed bg-transparent',
      )}
      aria-pressed={selected}
    >
      <div className={cn('absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r', statusTone.soft)} />
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <Badge className={cn('border-none text-[10px] font-black', statusTone.soft)}>#{seat.seatNo}</Badge>
          <p className="text-[11px] font-black tracking-tight text-slate-400">
            {seat.seatZone || seat.className || '구역 미지정'}
          </p>
        </div>
        <div className={cn('rounded-full p-2', statusTone.soft)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <p className="truncate text-sm font-black tracking-tight text-slate-900">
            {seat.kind === 'student' || seat.studentName ? seat.studentName || '학생' : presentation.title}
          </p>
          <p className="truncate text-[11px] font-bold text-slate-500">{presentation.helper}</p>
        </div>

        {seat.kind === 'student' && (
          <div className="flex flex-wrap gap-1.5">
            {overlayMode === 'status' && <MetricPill tone={presentation.tone} label="상태" value={presentation.value} icon={presentation.icon} />}
            {overlayMode === 'risk' && <MetricPill tone={presentation.tone} label="리스크" value={presentation.value} icon={presentation.icon} />}
            {overlayMode === 'penalty' && <MetricPill tone={presentation.tone} label="벌점" value={presentation.value} icon={presentation.icon} />}
            {overlayMode === 'minutes' && <MetricPill tone={presentation.tone} label="학습량" value={presentation.value} icon={presentation.icon} />}
            {overlayMode === 'counseling' && <MetricPill tone={presentation.tone} label="상담" value={presentation.value} icon={presentation.icon} />}
            {overlayMode === 'report' && <MetricPill tone={presentation.tone} label="리포트" value={presentation.value} icon={presentation.icon} />}
          </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {seat.overlayFlags?.slice(0, 2).map((flag) => (
            <Badge key={flag} variant="outline" className="border-slate-200 bg-white/90 text-[10px] font-black text-slate-600">
              {flag}
            </Badge>
          ))}
        </div>
        {seat.status === 'studying' && (
          <Badge className="border-none bg-blue-600 text-white">
            <Wifi className="mr-1 h-3 w-3" />
            집중
          </Badge>
        )}
      </div>
    </button>
  );
}

export function ClassroomSeatGrid({
  rows,
  cols,
  seats,
  overlayMode,
  title = '좌석 오버레이',
  description,
  selectedSeatId,
  activeFilterId = 'all',
  filters,
  legendItems,
  onOverlayModeChange,
  onSeatSelect,
  onFilterChange,
  seatMatchesActiveFilter,
  className,
}: ClassroomSeatGridProps) {
  const overlayMeta = OVERLAY_META[overlayMode];
  const OverlayIcon = overlayMeta.icon;
  const effectiveLegend = legendItems ?? getDefaultLegend(overlayMode);
  const effectiveFilters =
    filters ??
    [
      { id: 'all', label: '전체', count: seats.length, icon: LayoutGrid, tone: 'slate', description: '전체 좌석 보기' },
      { id: 'atRisk', label: '위험', count: seats.filter((seat) => getRiskKey(seat.riskLevel) !== '안정').length, icon: ShieldAlert, tone: 'rose', description: '리스크 학생' },
      { id: 'awayLong', label: '외출', count: seats.filter((seat) => seat.status === 'away' || seat.status === 'break').length, icon: Wifi, tone: 'amber', description: '자리 이탈' },
      { id: 'unreadReport', label: '미열람 리포트', count: seats.filter((seat) => seat.hasUnreadReport).length, icon: FileText, tone: 'orange', description: '리포트 확인' },
      { id: 'counseling', label: '상담 예정', count: seats.filter((seat) => seat.hasCounselingToday || seat.overlayFlags?.includes('counselingPending')).length, icon: CalendarCheck2, tone: 'blue', description: '상담 대기' },
    ];

  const matchesFilter = seatMatchesActiveFilter ?? defaultSeatMatchesFilter;

  return (
    <Card className={cn('overflow-hidden rounded-[2rem] border-none bg-white shadow-[0_18px_60px_rgba(20,41,95,0.08)]', className)}>
      <CardHeader className="border-b border-slate-100 bg-[linear-gradient(180deg,rgba(248,250,255,0.98),rgba(255,255,255,1))] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-900">
              <LayoutGrid className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            <p className="text-sm font-medium text-slate-500">{description || overlayMeta.description}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(OVERLAY_META) as ClassroomOverlayMode[]).map((mode) => {
              const meta = OVERLAY_META[mode];
              const Icon = meta.icon;
              const selected = overlayMode === mode;
              return (
                <Button
                  key={mode}
                  type="button"
                  variant={selected ? 'default' : 'outline'}
                  onClick={() => onOverlayModeChange?.(mode)}
                  className={cn(
                    'h-10 rounded-full px-4 text-[11px] font-black shadow-none transition-all',
                    selected ? 'border-transparent bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600',
                  )}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {meta.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {effectiveFilters.map((chip) => {
            const Icon = chip.icon ?? LayoutGrid;
            const selected = chip.id === activeFilterId || (chip.id === 'all' && (!activeFilterId || activeFilterId === 'all'));
            return (
              <Button
                key={chip.id}
                type="button"
                variant="outline"
                onClick={() => onFilterChange?.(chip.id === 'all' ? null : chip.id)}
                className={cn(
                  'h-9 rounded-full px-3.5 text-[11px] font-black shadow-none transition-all',
                  toneChipClass(chip.tone ?? 'slate', selected),
                )}
              >
                <Icon className="mr-1.5 h-3.5 w-3.5" />
                {chip.label}
                {typeof chip.count === 'number' && (
                  <span className="ml-1 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-black">
                    {chip.count}
                  </span>
                )}
              </Button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {effectiveLegend.map((legend) => {
            const Icon = legend.icon ?? Sparkles;
            return (
              <div
                key={legend.id}
                className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black', TONE_CLASSES[legend.tone].soft)}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{legend.label}</span>
                {legend.description && <span className="font-semibold opacity-70">{legend.description}</span>}
              </div>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">현재 모드</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge className={cn('border-none', TONE_CLASSES.blue.soft)}>
                <OverlayIcon className="mr-1 h-3.5 w-3.5" />
                {overlayMeta.label}
              </Badge>
              <p className="text-sm font-bold text-slate-600">{overlayMeta.description}</p>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">선택 유지</p>
            <p className="mt-2 text-sm font-bold text-slate-700">좌석을 눌러도 현재 필터는 유지됩니다.</p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">그리드</p>
            <p className="mt-2 text-sm font-bold text-slate-700">
              {rows}행 · {cols}열
            </p>
          </div>
        </div>

        <ScrollArea className="w-full">
          <div
            className="grid min-w-max gap-2.5"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {seats.map((seat) => {
              const selected = selectedSeatId === seat.id;
              const dimmed = !matchesFilter(seat, activeFilterId);
              return (
                <SeatCard
                  key={seat.id}
                  seat={seat}
                  overlayMode={overlayMode}
                  selected={selected}
                  dimmed={dimmed}
                  onClick={() => onSeatSelect?.(seat)}
                />
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
