'use client';

import { BookmarkPlus, CalendarClock, Clock3, Copy, Loader2, RotateCcw, Save, Sparkles, Trash2, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import type { AttendanceScheduleDraft, SavedAttendanceRoutine } from './planner-constants';

type WeekdayOption = {
  value: number;
  label: string;
};

type AttendanceScheduleSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  isSubmitting: boolean;
  selectedDateLabel: string;
  isToday: boolean;
  sameDayPenaltyPoints: number;
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
            !isAbsent && 'border-primary/20 text-primary'
          )}
        >
          등원 예정
        </Button>
        <Button
          type="button"
          variant={isAbsent ? 'destructive' : 'outline'}
          onClick={() => onChange({ isAbsent: true })}
          disabled={disabled}
          className="h-9 rounded-full px-4 text-[11px] font-black"
        >
          <XCircle className="mr-1.5 h-3.5 w-3.5" />
          미등원
        </Button>
      </div>

      <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
        <div className="space-y-1.5">
          <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">등원 예정</Label>
          <Input
            type="time"
            value={draft.inTime}
            onChange={(event) => onChange({ inTime: event.target.value })}
            disabled={disabled || isAbsent}
            className={cn('rounded-xl border-2 font-black shadow-inner', isMobile ? 'h-11 text-sm' : 'h-12 text-base')}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">하원 예정</Label>
          <Input
            type="time"
            value={draft.outTime}
            onChange={(event) => onChange({ outTime: event.target.value })}
            disabled={disabled || isAbsent}
            className={cn('rounded-xl border-2 font-black shadow-inner', isMobile ? 'h-11 text-sm' : 'h-12 text-base')}
          />
        </div>
      </div>

      <div className="rounded-[1.35rem] border border-primary/10 bg-primary/[0.03] p-4">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-primary" />
          <Label className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">외출 일정</Label>
          <span className="text-[10px] font-bold text-slate-500">학원/병원/식사 등</span>
        </div>
        <div className={cn('mt-3 grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,0.75fr)_minmax(0,0.75fr)_minmax(0,1fr)]')}>
          <div className="space-y-1.5">
            <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">외출 시작</Label>
            <Input
              type="time"
              value={draft.awayStartTime}
              onChange={(event) => onChange({ awayStartTime: event.target.value })}
              disabled={disabled || isAbsent}
              className={cn('rounded-xl border-2 font-black shadow-inner', isMobile ? 'h-11 text-sm' : 'h-12 text-base')}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">복귀 예정</Label>
            <Input
              type="time"
              value={draft.awayEndTime}
              onChange={(event) => onChange({ awayEndTime: event.target.value })}
              disabled={disabled || isAbsent}
              className={cn('rounded-xl border-2 font-black shadow-inner', isMobile ? 'h-11 text-sm' : 'h-12 text-base')}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">사유</Label>
            <Input
              value={draft.awayReason}
              onChange={(event) => onChange({ awayReason: event.target.value })}
              disabled={disabled || isAbsent}
              placeholder="예: 영어학원, 병원, 저녁 식사"
              className={cn('rounded-xl border-2 font-black shadow-inner', isMobile ? 'h-11 text-sm' : 'h-12 text-sm')}
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
}: AttendanceScheduleSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        motionPreset="dashboard-premium"
        className={cn(
          'overflow-hidden border-none bg-white p-0 shadow-2xl',
          isMobile
            ? 'h-auto max-h-[90dvh] rounded-t-[2rem] pb-[calc(1rem+env(safe-area-inset-bottom))]'
            : 'w-[34rem] max-w-[34rem] rounded-l-[2rem]'
        )}
      >
        <div className="bg-[linear-gradient(135deg,#14295F_0%,#1d4ed8_48%,#10b981_100%)] p-6 text-white">
          <SheetHeader className="text-left">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/12 p-2.5">
                <CalendarClock className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-xl font-black tracking-tight text-white">
                  출석 정보 수정
                </SheetTitle>
                <SheetDescription className="mt-1 text-[11px] font-semibold text-white/76">
                  오늘 수정, 요일별 기본값, 저장한 루틴을 한 곳에서 함께 관리해요.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
        </div>

        <div className={cn('overflow-y-auto bg-white', isMobile ? 'max-h-[calc(90dvh-9rem)] p-4' : 'h-full p-5')}>
          <Tabs defaultValue="today" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-slate-100 p-1">
              <TabsTrigger value="today" className="rounded-xl text-[11px] font-black">오늘 수정</TabsTrigger>
              <TabsTrigger value="weekday" className="rounded-xl text-[11px] font-black">요일별 기본값</TabsTrigger>
              <TabsTrigger value="saved" className="rounded-xl text-[11px] font-black">저장한 루틴</TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="space-y-4">
              <div className="rounded-[1.45rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,250,255,0.94)_100%)] p-4 shadow-[0_18px_40px_-34px_rgba(20,41,95,0.2)]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full border border-primary/10 bg-white px-3 py-1 text-[10px] font-black text-primary shadow-none">
                    {selectedDateLabel}
                  </Badge>
                  {isToday ? (
                    <Badge className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black text-amber-700 shadow-none">
                      당일 수정 시 벌점 +{sameDayPenaltyPoints}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-3 break-keep text-[11px] font-semibold leading-5 text-slate-500">
                  앞 화면엔 요약만 보여주고, 실제 수정은 여기서 한 번에 끝내요.
                </p>
              </div>

              {hasSelectedWeekdayTemplate ? (
                <div className="rounded-[1.35rem] border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-black text-emerald-800">{selectedWeekdayLabel} 기본값이 있어요</p>
                      <p className="mt-1 text-[11px] font-semibold leading-5 text-emerald-800/80">
                        기본 출석 정보를 오늘 입력칸으로 바로 불러올 수 있어요.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onApplySelectedWeekdayTemplateToToday}
                      className="h-9 rounded-full border-emerald-200 bg-white px-4 text-[11px] font-black text-emerald-700"
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      기본값 불러오기
                    </Button>
                  </div>
                </div>
              ) : null}

              <AttendanceDraftFields draft={todayDraft} onChange={onTodayChange} isMobile={isMobile} disabled={isSubmitting} />

              <div className={cn('grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                <Button
                  type="button"
                  onClick={onSaveToday}
                  disabled={isSubmitting}
                  className="h-11 rounded-xl bg-[#14295F] font-black text-white hover:bg-[#10224d]"
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  오늘 저장
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onSetTodayAbsent}
                  disabled={isSubmitting}
                  className="h-11 rounded-xl border-rose-200 font-black text-rose-600"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  미등원
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onResetToday}
                  disabled={isSubmitting}
                  className="h-11 rounded-xl border-slate-200 font-black text-slate-600"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  오늘 초기화
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="weekday" className="space-y-4">
              <div className="rounded-[1.45rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,250,255,0.94)_100%)] p-4 shadow-[0_18px_40px_-34px_rgba(20,41,95,0.2)]">
                <div className="flex flex-wrap gap-2">
                  {weekdayOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={selectedWeekday === option.value ? 'default' : 'outline'}
                      onClick={() => onSelectWeekday(option.value)}
                      className="h-9 rounded-full px-4 text-[11px] font-black"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <p className="mt-3 break-keep text-[11px] font-semibold leading-5 text-slate-500">
                  한 번 저장해두면 같은 요일 날짜에서는 기본 출석 정보로 바로 불러와 쓸 수 있어요.
                </p>
              </div>

              <AttendanceDraftFields draft={weekdayDraft} onChange={onWeekdayChange} isMobile={isMobile} disabled={isSubmitting} />

              <div className={cn('grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCopyTodayToWeekday}
                  disabled={isSubmitting}
                  className="h-11 rounded-xl border-primary/15 font-black text-primary"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  오늘 입력 복사
                </Button>
                <Button
                  type="button"
                  onClick={onSaveWeekday}
                  disabled={isSubmitting}
                  className="h-11 rounded-xl bg-emerald-500 font-black text-white hover:bg-emerald-600"
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {selectedWeekdayLabel} 저장
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="saved" className="space-y-4">
              <div className="rounded-[1.45rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,250,255,0.94)_100%)] p-4 shadow-[0_18px_40px_-34px_rgba(20,41,95,0.2)]">
                <div className={cn('grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_auto]')}>
                  <Input
                    value={presetName}
                    onChange={(event) => onPresetNameChange(event.target.value)}
                    placeholder="예: 월수금 학원 있는 날"
                    className="h-11 rounded-xl border-2 font-black shadow-inner"
                  />
                  <Button
                    type="button"
                    onClick={onSavePreset}
                    disabled={isSubmitting}
                    className="h-11 rounded-xl bg-[#14295F] font-black text-white hover:bg-[#10224d]"
                  >
                    <BookmarkPlus className="mr-2 h-4 w-4" />
                    현재 입력 저장
                  </Button>
                </div>
                <p className="mt-3 break-keep text-[11px] font-semibold leading-5 text-slate-500">
                  자주 쓰는 출석 패턴을 저장해두면 오늘 수정이나 요일 기본값에 바로 불러올 수 있어요.
                </p>
              </div>

              {savedRoutines.length === 0 ? (
                <div className="rounded-[1.45rem] border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
                  <p className="text-sm font-black text-slate-700">저장한 출석 루틴이 아직 없어요</p>
                  <p className="mt-2 break-keep text-[11px] font-semibold leading-5 text-slate-500">
                    오늘 입력이나 요일 기본값을 먼저 만든 뒤 저장하면 다음부터는 바로 불러올 수 있어요.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedRoutines.map((preset) => (
                    <div
                      key={preset.id}
                      className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_-34px_rgba(20,41,95,0.18)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <p className="truncate text-sm font-black tracking-tight text-slate-900">{preset.name}</p>
                          </div>
                          <p className="mt-2 break-keep text-[11px] font-semibold leading-5 text-slate-500">
                            {formatDraftSummary(preset)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => onDeletePreset(preset.id)}
                          className="h-9 w-9 rounded-full text-slate-400 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className={cn('mt-4 grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onApplyPresetToToday(preset)}
                          className="h-10 rounded-xl border-primary/15 font-black text-primary"
                        >
                          오늘에 불러오기
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => onApplyPresetToWeekday(preset)}
                          className="h-10 rounded-xl border-emerald-200 font-black text-emerald-700"
                        >
                          요일 기본값으로 불러오기
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <SheetFooter className="border-t bg-slate-50/70 p-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 w-full rounded-xl border-2 font-black"
          >
            닫기
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
