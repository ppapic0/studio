'use client';

import { useEffect, useMemo, useState } from 'react';

import { BookmarkPlus, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Clock3, Copy, Loader2, RotateCcw, Save, Sparkles, Trash2, XCircle } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { validateScheduleDraft } from '@/features/schedules/lib/scheduleModel';
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
  hasSchedule?: boolean;
  isAbsent?: boolean;
};

type AttendanceScheduleSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: 'today' | 'weekday' | 'saved';
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
  onSaveToday: () => void | Promise<boolean>;
  onSetTodayAbsent: () => void;
  onResetToday: () => void;
  hasSelectedWeekdayTemplate: boolean;
  selectedDateWeekdayLabel: string;
  onApplySelectedWeekdayTemplateToToday: () => void;
  selectedWeekdays: number[];
  onToggleWeekday: (weekday: number) => void;
  weekdayOptions: WeekdayOption[];
  weekdayDraft: AttendanceScheduleDraft;
  onWeekdayChange: (patch: Partial<AttendanceScheduleDraft>) => void;
  onCopyTodayToWeekday: () => void;
  onSaveWeekday: () => void | Promise<boolean>;
  presetName: string;
  onPresetNameChange: (value: string) => void;
  onSavePreset: () => void;
  savedRoutines: SavedAttendanceRoutine[];
  onApplyPresetToToday: (preset: SavedAttendanceRoutine) => void;
  onApplyPresetToWeekday: (preset: SavedAttendanceRoutine) => void;
  onDeletePreset: (presetId: string) => void;
  onTogglePresetActive: (presetId: string, active: boolean) => void;
  note: string;
  onNoteChange: (value: string) => void;
  recommendationPrefillSummary?: {
    recommendedWeeklyDays: number;
    recommendedDailyStudyMinutes: number;
  } | null;
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
  const hasExcursionPlanned = Boolean(
    draft.awayStartTime ||
    draft.awayEndTime ||
    draft.awayReason ||
    (draft.awaySlots?.length || 0) > 0
  );

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
                ? 'border-[#D7E3FA] bg-white text-[#17326B] hover:bg-[#F7FAFF]'
                : 'border-[#FFB168] bg-[#FFF0DD] text-[#FF8A1F]'
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
                ? 'border-[#FFB168] bg-[#FFF0DD] text-[#FF8A1F]'
                : 'border-[#D7E3FA] bg-white text-[#17326B] hover:bg-[#F7FAFF]'
            )}
          >
            <XCircle className="mr-1.5 h-3.5 w-3.5" />
            미등원
          </Button>
      </div>

      <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
        <div className="space-y-1.5">
          <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#5F739F]">등원 예정</Label>
          <Input
            type="time"
            value={draft.inTime}
            onChange={(event) => onChange({ inTime: event.target.value })}
            disabled={disabled || isAbsent}
            className={cn('rounded-xl border-[#D6E1F6] bg-white font-black text-[#17326B] shadow-none', isMobile ? 'h-11 text-sm' : 'h-12 text-base')}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#5F739F]">하원 예정</Label>
          <Input
            type="time"
            value={draft.outTime}
            onChange={(event) => onChange({ outTime: event.target.value })}
            disabled={disabled || isAbsent}
            className={cn('rounded-xl border-[#D6E1F6] bg-white font-black text-[#17326B] shadow-none', isMobile ? 'h-11 text-sm' : 'h-12 text-base')}
          />
        </div>
      </div>

      <div className="rounded-[1.35rem] border border-[#FFD7AE] bg-[linear-gradient(180deg,#FFF9F1_0%,#FFFFFF_100%)] p-4 shadow-[0_14px_30px_-24px_rgba(255,138,31,0.32)]">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-[#FF8A1F]" />
          <Label className="text-[11px] font-black uppercase tracking-[0.18em] text-[#FF8A1F]">외출 일정</Label>
          <span className="text-[10px] font-bold text-[#5F739F]">학원/병원/식사 등</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onChange({
                awayStartTime: '',
                awayEndTime: '',
                awayReason: '',
                awaySlots: [],
              })
            }
            disabled={disabled || isAbsent}
            className={cn(
              'h-9 rounded-full px-4 text-[11px] font-black',
              !hasExcursionPlanned
                ? 'border-[#FFB168] bg-[#FFF0DD] text-[#FF8A1F]'
                : 'border-[#D7E3FA] bg-white text-[#5F739F] hover:bg-[#F7FAFF]'
            )}
          >
            외출 없음
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onChange({
                awayStartTime: draft.awayStartTime || draft.inTime || '18:00',
                awayEndTime: draft.awayEndTime || draft.outTime || '19:00',
              })
            }
            disabled={disabled || isAbsent}
            className={cn(
              'h-9 rounded-full px-4 text-[11px] font-black',
              hasExcursionPlanned
                ? 'border-[#FFB168] bg-[#FFF0DD] text-[#FF8A1F]'
                : 'border-[#D7E3FA] bg-white text-[#5F739F] hover:bg-[#F7FAFF]'
            )}
          >
            외출 있음
          </Button>
        </div>
        {hasExcursionPlanned ? (
          <div className={cn('mt-3 grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,0.75fr)_minmax(0,0.75fr)_minmax(0,1fr)]')}>
            <div className="space-y-1.5">
              <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#5F739F]">외출 시작</Label>
              <Input
                type="time"
                value={draft.awayStartTime}
                onChange={(event) => onChange({ awayStartTime: event.target.value })}
                disabled={disabled || isAbsent}
                className={cn('rounded-xl border-[#D6E1F6] bg-white font-black text-[#17326B] shadow-none', isMobile ? 'h-11 text-sm' : 'h-12 text-base')}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#5F739F]">복귀 예정</Label>
              <Input
                type="time"
                value={draft.awayEndTime}
                onChange={(event) => onChange({ awayEndTime: event.target.value })}
                disabled={disabled || isAbsent}
                className={cn('rounded-xl border-[#D6E1F6] bg-white font-black text-[#17326B] shadow-none', isMobile ? 'h-11 text-sm' : 'h-12 text-base')}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#5F739F]">사유</Label>
              <Input
                value={draft.awayReason}
                onChange={(event) => onChange({ awayReason: event.target.value })}
                disabled={disabled || isAbsent}
                placeholder="예: 영어학원, 병원, 저녁 식사"
                className={cn('rounded-xl border-[#D6E1F6] bg-white font-black text-[#17326B] shadow-none placeholder:text-[#8C9BBC]', isMobile ? 'h-11 text-sm' : 'h-12 text-sm')}
              />
            </div>
          </div>
        ) : (
          <p className="mt-3 text-[11px] font-semibold leading-5 text-[#5F739F]">
            외출이 없는 날이면 비워두면 돼요. 필요할 때만 시간과 사유를 적어요.
          </p>
        )}
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
  initialTab = 'today',
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
  selectedDateWeekdayLabel,
  onApplySelectedWeekdayTemplateToToday,
  selectedWeekdays,
  onToggleWeekday,
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
  onTogglePresetActive,
  note,
  onNoteChange,
  recommendationPrefillSummary,
}: AttendanceScheduleSheetProps) {
  const [activeTab, setActiveTab] = useState<'today' | 'weekday'>(initialTab === 'today' ? 'today' : 'weekday');
  const [isPresetLibraryOpen, setIsPresetLibraryOpen] = useState(initialTab === 'saved');
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [openedSnapshot, setOpenedSnapshot] = useState('');

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab === 'today' ? 'today' : 'weekday');
    setIsPresetLibraryOpen(initialTab === 'saved');
    setIsCloseConfirmOpen(false);
    setOpenedSnapshot(
      JSON.stringify({
        todayDraft,
        weekdayDraft,
        note,
        selectedWeekdays: [...selectedWeekdays].sort(),
        presetName,
      })
    );
  }, [initialTab, open]);

  const formatWeekdaySummary = (weekdays?: number[]) => {
    if (!weekdays?.length) return '';
    return weekdayOptions
      .filter((option) => weekdays.includes(option.value))
      .map((option) => option.label)
      .join(', ');
  };
  const selectedWeekdaysLabel = formatWeekdaySummary(selectedWeekdays);

  const hasUnsavedChanges =
    open &&
    openedSnapshot !== '' &&
    openedSnapshot !==
      JSON.stringify({
        todayDraft,
        weekdayDraft,
        note,
        selectedWeekdays: [...selectedWeekdays].sort(),
        presetName,
      });

  const activeDraftValidationMessage =
    activeTab === 'today'
      ? validateScheduleDraft(todayDraft, todayDraft.awaySlots || [])
      : validateScheduleDraft(weekdayDraft, weekdayDraft.awaySlots || []);

  const handleCloseRequest = () => {
    if (isSubmitting) return;
    if (hasUnsavedChanges) {
      setIsCloseConfirmOpen(true);
      return;
    }
    onOpenChange(false);
  };

  const handleSaveAndClose = async () => {
    if (isSubmitting) return;
    if (activeTab === 'weekday') {
      if (selectedWeekdays.length === 0 || activeDraftValidationMessage) {
        return;
      }
      const saved = await onSaveWeekday();
      if (saved) {
        setIsCloseConfirmOpen(false);
        onOpenChange(false);
      }
      return;
    }

    if (activeDraftValidationMessage) {
      return;
    }

    const saved = await onSaveToday();
    if (saved) {
      setIsCloseConfirmOpen(false);
      onOpenChange(false);
    }
  };

  const weekdayQuickGroups = useMemo(() => {
    const workdays = weekdayOptions.filter((option) => ['월', '화', '수', '목', '금'].includes(option.label)).map((option) => option.value);
    const weekends = weekdayOptions.filter((option) => ['토', '일'].includes(option.label)).map((option) => option.value);
    return {
      workdays,
      weekends,
      all: weekdayOptions.map((option) => option.value),
    };
  }, [weekdayOptions]);

  const setSelectedWeekdaysTo = (targetValues: number[]) => {
    const nextValues = weekdayOptions.filter((option) => targetValues.includes(option.value)).map((option) => option.value);
    weekdayOptions.forEach((option) => {
      const shouldSelect = nextValues.includes(option.value);
      const isSelected = selectedWeekdays.includes(option.value);
      if (shouldSelect !== isSelected) {
        onToggleWeekday(option.value);
      }
    });
  };

  const selectedDayMeta = calendarDays.find((day) => day.isSelected);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            onOpenChange(true);
            return;
          }
          handleCloseRequest();
        }}
      >
      <DialogContent
        motionPreset="dashboard-premium"
        className={cn(
          'overflow-hidden border border-[#E0E8F6] bg-[linear-gradient(180deg,#FFF8EE_0%,#FFFFFF_38%,#F8FBFF_100%)] p-0 shadow-[0_28px_70px_-38px_rgba(12,29,74,0.36)]',
          isMobile
            ? 'w-[min(94vw,34rem)] max-h-[90dvh] rounded-[2rem]'
            : 'w-[min(92vw,54rem)] max-w-[54rem] max-h-[88dvh] rounded-[2rem]'
        )}
      >
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(255,163,61,0.22),transparent_24%),linear-gradient(180deg,#FFFFFF_0%,#FFF6EA_100%)] p-6 text-[#17326B] border-b border-[#E4ECF9]">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[#FFD1A1] bg-[#FFF1DE] p-2.5 text-[#FF8A1F]">
                <CalendarClock className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-black tracking-tight text-[#17326B]">
                  출석 정보 수정
                </DialogTitle>
                <DialogDescription className="mt-1 text-[11px] font-semibold text-[#5F739F]">
                  주간 기본 일정과 특정 날짜 예외만 간단하게 정리해요.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className={cn('overflow-y-auto bg-[linear-gradient(180deg,#FFF8EE_0%,#FFFFFF_32%,#F7FAFF_100%)]', isMobile ? 'max-h-[calc(90dvh-9rem)] p-4' : 'max-h-[calc(88dvh-9rem)] p-5')}>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'today' | 'weekday')} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 rounded-2xl border border-[#DCE6F7] bg-white p-1 shadow-[0_12px_28px_-24px_rgba(15,33,73,0.22)]">
              <TabsTrigger value="weekday" className="rounded-xl text-[11px] font-black text-[#5F739F] data-[state=active]:bg-[#FF9626] data-[state=active]:text-white">주간 기본 일정</TabsTrigger>
              <TabsTrigger value="today" className="rounded-xl text-[11px] font-black text-[#5F739F] data-[state=active]:bg-[#FF9626] data-[state=active]:text-white">특정 날짜 예외</TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="space-y-4">
              <div className="rounded-[1.45rem] border border-[#E0E8F6] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] p-4 shadow-[0_18px_40px_-34px_rgba(15,33,73,0.16)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#5F739F]">특정 날짜 예외</p>
                    <h3 className="mt-1 text-lg font-black tracking-tight text-[#17326B]">하루만 따로 바꾸는 예외 수정</h3>
                    <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-[#5F739F]">
                      시험일, 병원, 휴일처럼 하루만 시간이나 상태를 바꿀 때 사용해요.
                    </p>
                  </div>
                  <Badge variant="secondary" className="rounded-full border border-[#FFD1A1] bg-[#FFF0DD] px-3 py-1 text-[10px] text-[#FF8A1F] shadow-none">
                    {selectedDateLabel}
                  </Badge>
                </div>

                <div className="mt-4 rounded-[1.2rem] border border-[#E4ECF9] bg-[#F9FBFF] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => onMoveWeek(-1)}
                      className="h-8 w-8 rounded-full border-[#D8E3F7] bg-white text-[#17326B]"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="min-w-0 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5F739F]">날짜 선택</p>
                      <p className="mt-1 text-[11px] font-black text-[#17326B]">{weekRangeLabel}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => onMoveWeek(1)}
                      className="h-8 w-8 rounded-full border-[#D8E3F7] bg-white text-[#17326B]"
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
                            ? 'border-[#FFB168] bg-[linear-gradient(180deg,#FFF4E3_0%,#FFE7C6_100%)] text-[#17326B] shadow-[0_10px_24px_-18px_rgba(255,138,31,0.28)]'
                            : 'border-[#DDE7FB] bg-white text-[#5F739F] hover:border-[#FFB168] hover:bg-[#FFF8EF]',
                          day.isToday && !day.isSelected && 'border-[#FFB168]'
                        )}
                      >
                        <span className={cn('block text-[8px] font-black uppercase tracking-[0.18em]', day.isSelected ? 'text-[#FF8A1F]' : 'text-[#8C9BBC]')}>
                          {day.weekdayLabel}
                        </span>
                        <span className="mt-1 block text-sm font-black leading-none">{day.dateLabel}</span>
                        {day.hasSchedule ? (
                          <span
                            className={cn(
                              'mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[8px] font-black',
                              day.isSelected
                                ? 'bg-white text-[#17326B]'
                                : day.isAbsent
                                  ? 'bg-rose-50 text-rose-500'
                                  : 'bg-emerald-50 text-emerald-600'
                            )}
                          >
                            {day.isAbsent ? '미등원' : '등록'}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className={cn(
                    'mt-4 rounded-[1.15rem] border px-4 py-3',
                    selectedDayMeta?.hasSchedule
                      ? 'border-[#FFD1A1] bg-[#FFF6E8] text-[#D86A11]'
                      : hasSelectedWeekdayTemplate
                        ? 'border-[#DCE6F7] bg-[#F8FBFF] text-[#17326B]'
                        : 'border-[#E4ECF9] bg-white text-[#5F739F]'
                  )}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.18em]">현재 상태</p>
                  <p className="mt-2 text-sm font-black">
                    {selectedDayMeta?.hasSchedule
                      ? selectedDayMeta.isAbsent
                        ? '이 날짜 예외 설정됨 · 미등원'
                        : '이 날짜 예외 설정됨'
                      : hasSelectedWeekdayTemplate
                        ? '기본 일정 적용 중'
                        : '아직 일정 없음'}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold leading-5 opacity-80">
                    {selectedDayMeta?.hasSchedule
                      ? '기본 일정 대신 이 날짜에만 별도 설정이 적용되고 있어요.'
                      : hasSelectedWeekdayTemplate
                        ? `${selectedDateWeekdayLabel} 기본값이 이 날짜에도 적용돼요.`
                        : '이 날짜는 아직 저장된 기본 일정이나 예외가 없어요.'}
                  </p>
                </div>

                {isToday ? (
                  <Badge className="mt-4 rounded-full border border-[#FFD1A1] bg-[#FFF0DD] px-3 py-1 text-[10px] font-black text-[#FF8A1F] shadow-none">
                    당일 수정 시 벌점 +{sameDayPenaltyPoints}
                  </Badge>
                ) : null}
              </div>

              {recommendationPrefillSummary ? (
                <div className="rounded-[1.35rem] border border-[#FFD1A1] bg-[#FFF6E9] p-4">
                  <p className="text-[11px] font-black text-[#FF8A1F]">학습 플랜 기준 추천값</p>
                  <p className="mt-2 break-keep text-[11px] font-semibold leading-5 text-[#17326B]">
                    이번 주 권장 등원 {recommendationPrefillSummary.recommendedWeeklyDays}일 · 하루 권장 공부 {Math.round(recommendationPrefillSummary.recommendedDailyStudyMinutes / 60)}시간
                  </p>
                </div>
              ) : null}

              {hasSelectedWeekdayTemplate ? (
                <div className="rounded-[1.35rem] border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-black text-emerald-700">{selectedDateWeekdayLabel} 기본 일정이 있어요</p>
                      <p className="mt-1 text-[11px] font-semibold leading-5 text-emerald-700/80">
                        예외를 지우거나 다시 불러오면 기본 일정 상태로 되돌릴 수 있어요.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onApplySelectedWeekdayTemplateToToday}
                      className="h-9 rounded-full border-emerald-200 bg-white px-4 text-[11px] font-black text-emerald-700 hover:bg-emerald-50"
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      기본 일정 불러오기
                    </Button>
                  </div>
                </div>
              ) : null}

              <AttendanceDraftFields draft={todayDraft} onChange={onTodayChange} isMobile={isMobile} disabled={isSubmitting} />

              <div className="rounded-[1.35rem] border border-[#E4ECF9] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] p-4">
                <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#5F739F]">메모</Label>
                <Input
                  value={note}
                  onChange={(event) => onNoteChange(event.target.value)}
                  disabled={isSubmitting}
                  placeholder="이 날짜에만 필요한 메모가 있으면 적어둘 수 있어요."
                  className={cn('mt-2 rounded-xl border-[#D6E1F6] bg-white font-black text-[#17326B] shadow-none placeholder:text-[#8C9BBC]', isMobile ? 'h-11 text-sm' : 'h-12 text-sm')}
                />
              </div>
            </TabsContent>

            <TabsContent value="weekday" className="space-y-4">
              <div className="rounded-[1.45rem] border border-[#E0E8F6] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] p-4 shadow-[0_18px_40px_-34px_rgba(15,33,73,0.16)]">
                <div className="mb-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#5F739F]">주간 등원 일정</p>
                  <h3 className="mt-1 text-lg font-black tracking-tight text-[#17326B]">월~일 기본 일정을 간단히 정해두세요</h3>
                  <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-[#5F739F]">
                    반복되는 등원 패턴을 먼저 정해두고, 필요한 날만 예외로 따로 바꿔요.
                  </p>
                </div>

                {recommendationPrefillSummary ? (
                  <div className="mb-3 rounded-[1rem] border border-[#FFD1A1] bg-[#FFF6E8] px-3 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FF8A1F]">권장 설정</p>
                    <p className="mt-1 text-[11px] font-semibold leading-5 text-[#17326B]">
                      이번 주 권장 등원 {recommendationPrefillSummary.recommendedWeeklyDays}일 · 하루 권장 공부 {Math.round(recommendationPrefillSummary.recommendedDailyStudyMinutes / 60)}시간
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {weekdayOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant="outline"
                      onClick={() => onToggleWeekday(option.value)}
                      className={cn(
                        'h-9 rounded-full px-4 text-[11px] font-black',
                        selectedWeekdays.includes(option.value)
                          ? 'border-[#FFB168] bg-[linear-gradient(180deg,#FFF4E3_0%,#FFE7C6_100%)] text-[#FF8A1F] shadow-[0_14px_26px_-20px_rgba(255,150,38,0.35)]'
                          : 'border-[#DCE6F7] bg-white text-[#5F739F] hover:border-[#FFB168] hover:bg-[#FFF8EF]'
                      )}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedWeekdaysTo(weekdayQuickGroups.workdays)}
                    className="h-10 rounded-xl border-[#DCE6F7] bg-white text-[11px] font-black text-[#17326B] hover:bg-[#FFF8EF]"
                  >
                    평일만 적용
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedWeekdaysTo(weekdayQuickGroups.weekends)}
                    className="h-10 rounded-xl border-[#DCE6F7] bg-white text-[11px] font-black text-[#17326B] hover:bg-[#FFF8EF]"
                  >
                    주말만 적용
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedWeekdaysTo(weekdayQuickGroups.all)}
                    className="h-10 rounded-xl border-[#DCE6F7] bg-white text-[11px] font-black text-[#17326B] hover:bg-[#FFF8EF]"
                  >
                    전체 동일 적용
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsPresetLibraryOpen((previous) => !previous)}
                    className="h-10 rounded-xl border-[#FFD1A1] bg-[#FFF6E8] text-[11px] font-black text-[#FF8A1F] hover:bg-[#FFF0DD]"
                  >
                    저장된 루틴 불러오기
                  </Button>
                </div>
                <div className="mt-3 rounded-[1rem] border border-[#E4ECF9] bg-[#F9FBFF] px-3 py-2 text-[11px] font-semibold text-[#5F739F]">
                  저장 대상: <span className="font-black text-[#17326B]">{selectedWeekdays.length > 0 ? `매주 ${selectedWeekdaysLabel}` : '요일을 먼저 선택해 주세요'}</span>
                </div>
              </div>

              <AttendanceDraftFields draft={weekdayDraft} onChange={onWeekdayChange} isMobile={isMobile} disabled={isSubmitting} />

              <div className={cn('grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCopyTodayToWeekday}
                  disabled={isSubmitting}
                  className="h-11 rounded-xl border-[#DCE6F7] bg-white font-black text-[#17326B] hover:bg-[#F8FBFF]"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  이 날짜 예외값 불러오기
                </Button>
                <Button
                  type="button"
                  onClick={onSaveWeekday}
                  disabled={isSubmitting || selectedWeekdays.length === 0 || Boolean(validateScheduleDraft(weekdayDraft, weekdayDraft.awaySlots || []))}
                  className="h-11 rounded-xl bg-[linear-gradient(135deg,#FF9A2B_0%,#FF7A16_100%)] font-black text-white shadow-[0_18px_30px_-20px_rgba(255,122,22,0.36)]"
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  주간 기본 일정 저장
                </Button>
              </div>

              {isPresetLibraryOpen ? (
                <div className="rounded-[1.45rem] border border-[#E0E8F6] bg-white p-4 shadow-[0_18px_40px_-34px_rgba(15,33,73,0.16)]">
                  <div className="mb-3 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-[#FF8A1F]" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-[#17326B]">저장된 루틴</p>
                      <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-[#5F739F]">
                        자주 쓰는 패턴은 선택한 요일이나 특정 날짜에 빠르게 적용할 수 있어요.
                      </p>
                    </div>
                  </div>
                  <div className={cn('grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_auto]')}>
                    <Input
                      value={presetName}
                      onChange={(event) => onPresetNameChange(event.target.value)}
                      placeholder="예: 평일 기본 루틴"
                      className="h-11 rounded-xl border-[#D6E1F6] bg-white font-black text-[#17326B] shadow-none placeholder:text-[#8C9BBC]"
                    />
                    <Button
                      type="button"
                      onClick={onSavePreset}
                      disabled={isSubmitting}
                      className="h-11 rounded-xl bg-[linear-gradient(135deg,#FF9A2B_0%,#FF7A16_100%)] font-black text-white shadow-[0_18px_30px_-20px_rgba(255,122,22,0.36)]"
                    >
                      <BookmarkPlus className="mr-2 h-4 w-4" />
                      루틴 저장
                    </Button>
                  </div>

                  {savedRoutines.length === 0 ? (
                    <div className="mt-4 rounded-[1.1rem] border border-dashed border-[#FFD1A1] bg-[#FFF8EF] px-4 py-5 text-center">
                      <p className="text-[11px] font-black text-[#FF8A1F]">저장한 루틴이 아직 없어요</p>
                      <p className="mt-2 text-[11px] font-semibold leading-5 text-[#5F739F]">
                        지금 설정을 먼저 저장해두면 다음부터는 더 빠르게 불러올 수 있어요.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {savedRoutines.map((preset) => (
                        <div key={preset.id} className="rounded-[1.15rem] border border-[#E4ECF9] bg-[#F9FBFF] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-[#FF8A1F]" />
                                <p className="truncate text-sm font-black tracking-tight text-[#17326B]">{preset.name}</p>
                                {preset.active === false ? (
                                  <Badge variant="outline" className="border-[#DCE6F7] bg-white text-[10px] font-black text-[#5F739F]">
                                    비활성
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mt-2 break-keep text-[11px] font-semibold leading-5 text-[#5F739F]">
                                {formatDraftSummary(preset)}
                              </p>
                              {preset.weekdays?.length ? (
                                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8C9BBC]">
                                  반복 요일: {formatWeekdaySummary(preset.weekdays)}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => onTogglePresetActive(preset.id, preset.active === false)}
                                className="h-9 rounded-full border-[#DCE6F7] bg-white px-3 text-[10px] font-black text-[#5F739F] hover:bg-[#F8FBFF]"
                              >
                                {preset.active === false ? '다시 사용' : '비활성'}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => onDeletePreset(preset.id)}
                                className="h-9 w-9 rounded-full text-[#8C9BBC] hover:bg-rose-50 hover:text-rose-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className={cn('mt-3 grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => onApplyPresetToWeekday(preset)}
                              disabled={preset.active === false}
                              className="h-10 rounded-xl border-[#DCE6F7] bg-white font-black text-[#17326B] hover:bg-[#FFF8EF]"
                            >
                              선택 요일에 적용
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => onApplyPresetToToday(preset)}
                              disabled={preset.active === false}
                              className="h-10 rounded-xl border-[#DCE6F7] bg-white font-black text-[#17326B] hover:bg-[#F8FBFF]"
                            >
                              특정 날짜 예외에 적용
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </TabsContent>

          </Tabs>
        </div>

        <div className={cn('border-t border-[#E4ECF9] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF7EC_100%)] p-4', isMobile ? 'space-y-2' : 'flex items-center justify-end gap-2')}>
          <Button
            type="button"
            variant="outline"
            onClick={handleCloseRequest}
            className={cn('h-11 rounded-xl border-[#DCE6F7] bg-white font-black text-[#17326B] hover:bg-[#F8FBFF]', isMobile ? 'w-full' : 'min-w-[9rem]')}
          >
            닫기
          </Button>

          {activeTab === 'today' ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onResetToday}
                disabled={isSubmitting}
                className={cn('h-11 rounded-xl border-rose-200 bg-white font-black text-rose-500 hover:bg-rose-50', isMobile ? 'w-full' : 'min-w-[9rem]')}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                예외 삭제
              </Button>
              <Button
                type="button"
                onClick={onSaveToday}
                disabled={isSubmitting || Boolean(validateScheduleDraft(todayDraft, todayDraft.awaySlots || []))}
                className={cn(
                  'h-11 rounded-xl bg-[linear-gradient(135deg,#FF9A2B_0%,#FF7A16_100%)] font-black text-white shadow-[0_18px_30px_-20px_rgba(255,122,22,0.36)]',
                  isMobile ? 'w-full' : 'min-w-[11rem]'
                )}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                이 날짜 예외 저장
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={onSaveWeekday}
              disabled={isSubmitting || selectedWeekdays.length === 0 || Boolean(validateScheduleDraft(weekdayDraft, weekdayDraft.awaySlots || []))}
              className={cn(
                'h-11 rounded-xl bg-[linear-gradient(135deg,#FF9A2B_0%,#FF7A16_100%)] font-black text-white shadow-[0_18px_30px_-20px_rgba(255,122,22,0.36)]',
                isMobile ? 'w-full' : 'min-w-[11rem]'
              )}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              주간 기본 일정 저장
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>

      <AlertDialog open={isCloseConfirmOpen} onOpenChange={setIsCloseConfirmOpen}>
        <AlertDialogContent className="border border-[#E0E8F6] bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#17326B]">저장하지 않은 변경사항이 있어요</AlertDialogTitle>
            <AlertDialogDescription className="text-[#5F739F]">
              지금 닫으면 방금 수정한 출석 일정이 사라질 수 있어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={cn(isMobile ? 'flex-col' : 'flex-row')}>
            <AlertDialogCancel className="border-[#DCE6F7] text-[#17326B]">계속 수정하기</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCloseConfirmOpen(false);
                onOpenChange(false);
              }}
              className="h-10 rounded-xl border-rose-200 bg-white font-black text-rose-500 hover:bg-rose-50"
            >
              버리고 닫기
            </Button>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleSaveAndClose();
              }}
              className="bg-[linear-gradient(135deg,#FF9A2B_0%,#FF7A16_100%)] text-white"
            >
              저장하고 닫기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
