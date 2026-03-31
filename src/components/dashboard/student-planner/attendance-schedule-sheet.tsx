'use client';

import { BookmarkPlus, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Clock3, Copy, Loader2, Plus, RotateCcw, Save, Sparkles, Trash2, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { StudyPlanItem, WithId } from '@/lib/types';
import { cn } from '@/lib/utils';

import type { AttendanceScheduleDraft, SavedAttendanceRoutine } from './planner-constants';

type WeekdayOption = {
  value: number;
  label: string;
};

type CalendarDayOption = {
  key: string;
  weekdayLabel: string;
  dateLabel: string;
  isToday: boolean;
  isSelected: boolean;
  date: Date;
};

type AttendanceScheduleSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  isSubmitting: boolean;
  selectedDateLabel: string;
  isToday: boolean;
  sameDayPenaltyPoints: number;
  weekRangeLabel: string;
  calendarDays: CalendarDayOption[];
  onMoveWeek: (direction: -1 | 1) => void;
  onSelectDate: (date: Date) => void;
  todayDraft: AttendanceScheduleDraft;
  onTodayChange: (patch: Partial<AttendanceScheduleDraft>) => void;
  onSaveToday: () => void;
  onSetTodayAbsent: () => void;
  onResetToday: () => void;
  hasSelectedWeekdayTemplate: boolean;
  selectedWeekdayLabel: string;
  onApplySelectedWeekdayTemplateToToday: () => void;
  selectedWeekday: number;
  onSelectWeekday: (weekday: number) => void;
  weekdayOptions: WeekdayOption[];
  weekdayDraft: AttendanceScheduleDraft;
  onWeekdayChange: (patch: Partial<AttendanceScheduleDraft>) => void;
  onCopyTodayToWeekday: () => void;
  onSaveWeekday: () => void;
  presetName: string;
  onPresetNameChange: (value: string) => void;
  onSavePreset: () => void;
  savedRoutines: SavedAttendanceRoutine[];
  onApplyPresetToToday: (preset: SavedAttendanceRoutine) => void;
  onApplyPresetToWeekday: (preset: SavedAttendanceRoutine) => void;
  onDeletePreset: (presetId: string) => void;
  personalTasks: Array<WithId<StudyPlanItem>>;
  personalTaskDraft: string;
  onPersonalTaskDraftChange: (value: string) => void;
  onAddPersonalTask: () => void;
  onTogglePersonalTask: (task: WithId<StudyPlanItem>) => void;
  onDeletePersonalTask: (task: WithId<StudyPlanItem>) => void;
};

function AttendanceDraftFields({
  draft,
  onChange,
  isMobile,
  disabled = false,
}: {
  draft: AttendanceScheduleDraft;
  onChange: (patch: Partial<AttendanceScheduleDraft>) => void;
  isMobile: boolean;
  disabled?: boolean;
}) {
  const isAbsent = Boolean(draft.isAbsent);

  return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={isAbsent ? 'default' : 'outline'}
            onClick={() => onChange({ isAbsent: false })}
            disabled={disabled}
            className={cn(
              'h-9 rounded-full px-4 text-[11px] font-black',
              isAbsent
                ? 'border-white/12 bg-white/[0.08] text-white hover:bg-white/[0.14]'
                : 'border-[#FFB347]/28 bg-[#FF9626]/18 text-[var(--accent-orange-soft)]'
            )}
          >
            등원 예정
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange({ isAbsent: true })}
            disabled={disabled}
            className={cn(
              'h-9 rounded-full px-4 text-[11px] font-black',
              isAbsent
                ? 'border-[#FFB347]/28 bg-[#FF9626]/18 text-[var(--accent-orange-soft)]'
                : 'border-white/12 bg-white/[0.08] text-white hover:bg-white/[0.14]'
            )}
          >
            <XCircle className="mr-1.5 h-3.5 w-3.5" />
            미등원
        </Button>
      </div>

      <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
        <div className="space-y-1.5">
          <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">등원 예정</Label>
          <Input
            type="time"
            value={draft.inTime}
            onChange={(event) => onChange({ inTime: event.target.value })}
            disabled={disabled || isAbsent}
            className={cn('rounded-xl border-white/12 bg-white/[0.1] font-black text-white shadow-none', isMobile ? 'h-11 text-sm' : 'h-12 text-base')}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">하원 예정</Label>
          <Input
            type="time"
            value={draft.outTime}
            onChange={(event) => onChange({ outTime: event.target.value })}
            disabled={disabled || isAbsent}
            className={cn('rounded-xl border-white/12 bg-white/[0.1] font-black text-white shadow-none', isMobile ? 'h-11 text-sm' : 'h-12 text-base')}
          />
        </div>
      </div>

      <div className="rounded-[1.35rem] border border-white/12 bg-white/[0.08] p-4">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-[var(--accent-orange-soft)]" />
          <Label className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--accent-orange-soft)]">외출 일정</Label>
          <span className="text-[10px] font-bold text-[var(--text-on-dark-soft)]">학원/병원/식사 등</span>
        </div>
        <div className={cn('mt-3 grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,0.75fr)_minmax(0,0.75fr)_minmax(0,1fr)]')}>
          <div className="space-y-1.5">
            <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">외출 시작</Label>
            <Input
              type="time"
              value={draft.awayStartTime}
              onChange={(event) => onChange({ awayStartTime: event.target.value })}
              disabled={disabled || isAbsent}
              className={cn('rounded-xl border-white/12 bg-white/[0.1] font-black text-white shadow-none', isMobile ? 'h-11 text-sm' : 'h-12 text-base')}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">복귀 예정</Label>
            <Input
              type="time"
              value={draft.awayEndTime}
              onChange={(event) => onChange({ awayEndTime: event.target.value })}
              disabled={disabled || isAbsent}
              className={cn('rounded-xl border-white/12 bg-white/[0.1] font-black text-white shadow-none', isMobile ? 'h-11 text-sm' : 'h-12 text-base')}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">사유</Label>
            <Input
              value={draft.awayReason}
              onChange={(event) => onChange({ awayReason: event.target.value })}
              disabled={disabled || isAbsent}
              placeholder="예: 영어학원, 병원, 저녁 식사"
              className={cn('rounded-xl border-white/12 bg-white/[0.1] font-black text-white shadow-none placeholder:text-white/55', isMobile ? 'h-11 text-sm' : 'h-12 text-sm')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDraftSummary(draft: AttendanceScheduleDraft) {
  if (draft.isAbsent) {
    return '이날은 등원하지 않아요';
  }
  const range = `${draft.inTime || '--:--'} ~ ${draft.outTime || '--:--'}`;
  if (draft.awayStartTime && draft.awayEndTime) {
    const reason = draft.awayReason.trim();
    return `${range} · 외출 ${draft.awayStartTime} ~ ${draft.awayEndTime}${reason ? ` · ${reason}` : ''}`;
  }
  return range;
}

export function AttendanceScheduleSheet({
  open,
  onOpenChange,
  isMobile,
  isSubmitting,
  selectedDateLabel,
  isToday,
  sameDayPenaltyPoints,
  weekRangeLabel,
  calendarDays,
  onMoveWeek,
  onSelectDate,
  todayDraft,
  onTodayChange,
  onSaveToday,
  onSetTodayAbsent,
  onResetToday,
  hasSelectedWeekdayTemplate,
  selectedWeekdayLabel,
  onApplySelectedWeekdayTemplateToToday,
  selectedWeekday,
  onSelectWeekday,
  weekdayOptions,
  weekdayDraft,
  onWeekdayChange,
  onCopyTodayToWeekday,
  onSaveWeekday,
  presetName,
  onPresetNameChange,
  onSavePreset,
  savedRoutines,
  onApplyPresetToToday,
  onApplyPresetToWeekday,
  onDeletePreset,
  personalTasks,
  personalTaskDraft,
  onPersonalTaskDraftChange,
  onAddPersonalTask,
  onTogglePersonalTask,
  onDeletePersonalTask,
}: AttendanceScheduleSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        motionPreset="dashboard-premium"
        className={cn(
          'overflow-hidden border-none bg-[linear-gradient(180deg,#13285A_0%,#0E1B3D_100%)] p-0 shadow-2xl',
          isMobile
            ? 'w-[min(94vw,34rem)] max-h-[90dvh] rounded-[2rem]'
            : 'w-[min(92vw,54rem)] max-w-[54rem] max-h-[88dvh] rounded-[2rem]'
        )}
      >
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(255,179,71,0.16),transparent_28%),linear-gradient(135deg,#10295f_0%,#17326B_46%,#0f2149_100%)] p-6 text-white">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/16 p-2.5">
                <CalendarClock className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-black tracking-tight text-white">
                  출석 정보 수정
                </DialogTitle>
                <DialogDescription className="mt-1 text-[11px] font-semibold text-[var(--text-on-dark-soft)]">
                  오늘 수정, 요일별 기본값, 저장한 루틴을 한 곳에서 함께 관리해요.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className={cn('overflow-y-auto bg-[linear-gradient(180deg,#13285A_0%,#0E1B3D_100%)]', isMobile ? 'max-h-[calc(90dvh-9rem)] p-4' : 'max-h-[calc(88dvh-9rem)] p-5')}>
          <div className="mb-4 surface-card surface-card--secondary on-dark rounded-[1.45rem] p-4 shadow-[0_18px_40px_-34px_rgba(0,0,0,0.42)]">
            <p className="text-[11px] font-black text-white">세 가지 방식으로 관리해요</p>
            <div className={cn('mt-3 grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
              <div className="surface-card surface-card--ghost on-dark rounded-[1rem] px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent-orange-soft)]">특정 날짜</p>
                <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-[var(--text-on-dark-soft)]">
                  오늘이나 특정 일자만 따로 바꿔요.
                </p>
              </div>
              <div className="surface-card surface-card--ghost on-dark rounded-[1rem] px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent-orange-soft)]">매주 반복</p>
                <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-[var(--text-on-dark-soft)]">
                  월요일, 화요일처럼 같은 요일 기본값을 저장해요.
                </p>
              </div>
              <div className="surface-card surface-card--ghost on-dark rounded-[1rem] px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent-orange-soft)]">저장한 루틴</p>
                <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-[var(--text-on-dark-soft)]">
                  자주 쓰는 패턴을 저장해두고 날짜나 반복값에 복사해요.
                </p>
              </div>
            </div>
          </div>

          <Tabs defaultValue="today" className="space-y-4">
          <TabsList className={cn('grid w-full rounded-2xl border border-white/12 bg-white/[0.08] p-1', isMobile ? 'grid-cols-1 gap-1' : 'grid-cols-3')}>
              <TabsTrigger value="today" className="rounded-xl text-[11px] font-black text-[var(--text-on-dark-soft)] data-[state=active]:bg-[#FF9626] data-[state=active]:text-white">특정 날짜</TabsTrigger>
              <TabsTrigger value="weekday" className="rounded-xl text-[11px] font-black text-[var(--text-on-dark-soft)] data-[state=active]:bg-[#FF9626] data-[state=active]:text-white">매주 반복</TabsTrigger>
              <TabsTrigger value="saved" className="rounded-xl text-[11px] font-black text-[var(--text-on-dark-soft)] data-[state=active]:bg-[#FF9626] data-[state=active]:text-white">저장한 루틴</TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="space-y-4">
              <div className="surface-card surface-card--secondary on-dark rounded-[1.45rem] p-4 shadow-[0_18px_40px_-34px_rgba(0,0,0,0.46)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-white">특정 날짜만 변경</p>
                    <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-[var(--text-on-dark-soft)]">
                      선택한 날짜에만 적용되고, 매주 반복 기본값은 그대로 유지돼요.
                    </p>
                  </div>
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-[10px] shadow-none">
                    {selectedDateLabel}
                  </Badge>
                </div>

                <div className="mt-4 rounded-[1.2rem] border border-white/12 bg-white/[0.08] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => onMoveWeek(-1)}
                      className="h-8 w-8 rounded-full border-white/12 bg-white/[0.1] text-white"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="min-w-0 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">바로 날짜 선택</p>
                      <p className="mt-1 text-[11px] font-black text-white">{weekRangeLabel}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => onMoveWeek(1)}
                      className="h-8 w-8 rounded-full border-white/12 bg-white/[0.1] text-white"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-3 grid grid-cols-7 gap-1.5">
                    {calendarDays.map((day) => (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => onSelectDate(day.date)}
                        className={cn(
                          'rounded-[1rem] border px-1 py-2 text-center transition-all',
                          day.isSelected
                            ? 'border-transparent bg-[linear-gradient(135deg,#173A82_0%,#22479B_58%,#FF7A16_180%)] text-white shadow-[0_10px_24px_-18px_rgba(255,122,22,0.38)]'
                            : 'border-white/12 bg-white/[0.08] text-[var(--text-on-dark-soft)] hover:border-[#FFB347]/18 hover:bg-white/[0.12]',
                          day.isToday && !day.isSelected && 'border-[#FFB347]/18'
                        )}
                      >
                        <span className={cn('block text-[8px] font-black uppercase tracking-[0.18em]', day.isSelected ? 'text-white' : 'text-[var(--text-on-dark-muted)]')}>
                          {day.weekdayLabel}
                        </span>
                        <span className="mt-1 block text-sm font-black leading-none">{day.dateLabel}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {isToday ? (
                  <Badge className="mt-4 rounded-full border border-[#FFB347]/24 bg-[#FF9626]/16 px-3 py-1 text-[10px] font-black text-[var(--accent-orange-soft)] shadow-none">
                    당일 수정 시 벌점 +{sameDayPenaltyPoints}
                  </Badge>
                ) : null}
              </div>

              {hasSelectedWeekdayTemplate ? (
                <div className="rounded-[1.35rem] border border-emerald-400/18 bg-emerald-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-black text-emerald-200">{selectedWeekdayLabel} 반복 기본값이 있어요</p>
                      <p className="mt-1 text-[11px] font-semibold leading-5 text-emerald-100/90">
                        저장해둔 반복 스케줄을 이 날짜 입력칸으로 바로 가져올 수 있어요.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onApplySelectedWeekdayTemplateToToday}
                      className="h-9 rounded-full border-emerald-300/24 bg-white/[0.12] px-4 text-[11px] font-black text-emerald-100 hover:bg-white/[0.16]"
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      이 날짜에 복사
                    </Button>
                  </div>
                </div>
              ) : null}

              <AttendanceDraftFields draft={todayDraft} onChange={onTodayChange} isMobile={isMobile} disabled={isSubmitting} />

              <div className="surface-card surface-card--secondary on-dark rounded-[1.35rem] p-4 shadow-[0_18px_40px_-34px_rgba(0,0,0,0.46)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-white">기타 일정도 여기서 같이 관리</p>
                    <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-[var(--text-on-dark-soft)]">
                      병원, 상담, 준비물처럼 오늘만 챙길 일은 여기서 같이 적고 저장해요.
                    </p>
                  </div>
                  <Badge variant="secondary" className="rounded-full px-3 py-1 text-[10px] shadow-none">
                    {personalTasks.length}개
                  </Badge>
                </div>

                <div className={cn('mt-4 rounded-[1.1rem] border border-white/12 bg-white/[0.08] p-2', isMobile ? 'flex flex-col items-stretch gap-2' : 'flex items-center gap-2')}>
                  <Input
                    placeholder="예: 병원, 상담, 준비물 챙기기"
                    value={personalTaskDraft}
                    onChange={(event) => onPersonalTaskDraftChange(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && onAddPersonalTask()}
                    disabled={isSubmitting}
                    className="h-10 border-none bg-transparent text-sm font-bold text-white shadow-none focus-visible:ring-0 placeholder:text-white/55"
                  />
                  <Button
                    type="button"
                    onClick={onAddPersonalTask}
                    disabled={isSubmitting || !personalTaskDraft.trim()}
                    className={cn('h-10 rounded-xl bg-[linear-gradient(135deg,#173A82_0%,#22479B_55%,#FF7A16_170%)] px-4 text-xs font-black text-white shadow-[0_16px_26px_-18px_rgba(255,122,22,0.36)]', isMobile && 'w-full')}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    추가
                  </Button>
                </div>

                {personalTasks.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {personalTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 rounded-[1rem] border border-white/12 bg-white/[0.08] px-3 py-3"
                      >
                        <Checkbox
                          id={`sheet-personal-${task.id}`}
                          checked={task.done}
                          onCheckedChange={() => onTogglePersonalTask(task)}
                          className="rounded-lg border-2"
                        />
                        <Label
                          htmlFor={`sheet-personal-${task.id}`}
                          className={cn(
                            'min-w-0 flex-1 break-keep text-sm font-black text-white',
                            task.done && 'text-[var(--text-on-dark-muted)] line-through'
                          )}
                        >
                          {task.title}
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeletePersonalTask(task)}
                          className="h-8 w-8 shrink-0 text-[var(--text-on-dark-soft)] hover:text-rose-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1rem] border border-dashed border-white/12 bg-white/[0.08] px-4 py-4 text-center">
                    <p className="text-[11px] font-black text-[var(--accent-orange-soft)]">필요한 날만 짧게 추가하면 충분해요</p>
                  </div>
                )}
              </div>

              <div className={cn('grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                <Button
                  type="button"
                  onClick={onSaveToday}
                  disabled={isSubmitting}
                  className="h-11 rounded-xl bg-[linear-gradient(135deg,#173A82_0%,#22479B_55%,#FF7A16_170%)] font-black text-white shadow-[0_18px_30px_-20px_rgba(255,122,22,0.36)]"
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  이 날짜만 저장
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onSetTodayAbsent}
                  disabled={isSubmitting}
                  className="h-11 rounded-xl border-white/12 bg-white/[0.1] font-black text-white"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  이 날짜만 미등원
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onResetToday}
                  disabled={isSubmitting}
                  className="h-11 rounded-xl border-white/12 bg-white/[0.1] font-black text-white"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  이 날짜만 초기화
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="weekday" className="space-y-4">
              <div className="surface-card surface-card--secondary on-dark rounded-[1.45rem] p-4 shadow-[0_18px_40px_-34px_rgba(0,0,0,0.46)]">
                <div className="mb-3">
                  <p className="text-[11px] font-black text-white">매주 반복 스케줄</p>
                  <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-[var(--text-on-dark-soft)]">
                    한 번 저장해두면 같은 요일 날짜에서는 자동 기본값처럼 불러와서 쓸 수 있어요.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {weekdayOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant="outline"
                      onClick={() => onSelectWeekday(option.value)}
                      className={cn(
                        'h-9 rounded-full px-4 text-[11px] font-black',
                        selectedWeekday === option.value
                          ? 'border-[#FFB347]/28 bg-[#FF9626]/18 text-[var(--accent-orange-soft)] shadow-[0_14px_26px_-20px_rgba(255,150,38,0.45)]'
                          : 'border-white/12 bg-white/[0.08] text-[var(--text-on-dark-soft)] hover:bg-white/[0.12]'
                      )}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <div className="mt-3 rounded-[1rem] border border-white/12 bg-white/[0.08] px-3 py-2 text-[11px] font-semibold text-[var(--text-on-dark-soft)]">
                  저장 대상: <span className="font-black text-white">매주 {selectedWeekdayLabel}</span>
                </div>
              </div>

              <AttendanceDraftFields draft={weekdayDraft} onChange={onWeekdayChange} isMobile={isMobile} disabled={isSubmitting} />

              <div className={cn('grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCopyTodayToWeekday}
                  disabled={isSubmitting}
                  className="h-11 rounded-xl border-white/12 bg-white/[0.1] font-black text-white hover:bg-white/[0.14]"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  이 날짜 입력 복사
                </Button>
                <Button
                  type="button"
                  onClick={onSaveWeekday}
                  disabled={isSubmitting}
                  className="h-11 rounded-xl bg-[linear-gradient(135deg,#173A82_0%,#22479B_55%,#FF7A16_170%)] font-black text-white shadow-[0_18px_30px_-20px_rgba(255,122,22,0.36)]"
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  매주 {selectedWeekdayLabel} 저장
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="saved" className="space-y-4">
              <div className="surface-card surface-card--secondary on-dark rounded-[1.45rem] p-4 shadow-[0_18px_40px_-34px_rgba(0,0,0,0.46)]">
                <div className="mb-3 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-[var(--accent-orange-soft)]" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-white">자주 쓰는 루틴 저장/복사</p>
                    <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-[var(--text-on-dark-soft)]">
                      학원 있는 날처럼 자주 쓰는 출석 패턴을 저장해두고 이 날짜나 매주 반복값으로 바로 복사해요.
                    </p>
                  </div>
                </div>
                <div className={cn('grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_auto]')}>
                  <Input
                    value={presetName}
                    onChange={(event) => onPresetNameChange(event.target.value)}
                    placeholder="예: 월수금 학원 있는 날"
                    className="h-11 rounded-xl border-white/12 bg-white/[0.1] font-black text-white shadow-none placeholder:text-white/55"
                  />
                  <Button
                    type="button"
                    onClick={onSavePreset}
                    disabled={isSubmitting}
                    className="h-11 rounded-xl bg-[linear-gradient(135deg,#173A82_0%,#22479B_55%,#FF7A16_170%)] font-black text-white shadow-[0_18px_30px_-20px_rgba(255,122,22,0.36)]"
                  >
                    <BookmarkPlus className="mr-2 h-4 w-4" />
                    루틴으로 저장
                  </Button>
                </div>
              </div>

              {savedRoutines.length === 0 ? (
                <div className="surface-card surface-card--ghost on-dark rounded-[1.45rem] border-dashed p-6 text-center">
                  <p className="text-sm font-black text-white">저장한 출석 루틴이 아직 없어요</p>
                  <p className="mt-2 break-keep text-[11px] font-semibold leading-5 text-[var(--text-on-dark-soft)]">
                    오늘 입력이나 요일 기본값을 먼저 만든 뒤 저장하면 다음부터는 바로 불러올 수 있어요.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedRoutines.map((preset) => (
                    <div
                      key={preset.id}
                      className="surface-card surface-card--ghost on-dark rounded-[1.35rem] p-4 shadow-[0_18px_40px_-34px_rgba(0,0,0,0.42)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-[var(--accent-orange-soft)]" />
                            <p className="truncate text-sm font-black tracking-tight text-white">{preset.name}</p>
                          </div>
                          <p className="mt-2 break-keep text-[11px] font-semibold leading-5 text-[var(--text-on-dark-soft)]">
                            {formatDraftSummary(preset)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => onDeletePreset(preset.id)}
                          className="h-9 w-9 rounded-full text-[var(--text-on-dark-soft)] hover:bg-white/[0.1] hover:text-rose-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className={cn('mt-4 grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => onApplyPresetToToday(preset)}
                          className="h-10 rounded-xl font-black"
                        >
                          이 날짜에 복사
                        </Button>
                        <Button
                          type="button"
                          variant="dark"
                          onClick={() => onApplyPresetToWeekday(preset)}
                          className="h-10 rounded-xl font-black"
                        >
                          매주 {selectedWeekdayLabel}에 복사
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

          <DialogFooter className="border-t border-white/12 bg-white/[0.06] p-4">
          <Button
            type="button"
            variant="dark"
            onClick={() => onOpenChange(false)}
            className="h-11 w-full rounded-xl font-black"
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
