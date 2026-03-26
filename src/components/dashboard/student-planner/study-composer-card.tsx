'use client';

import { Loader2, Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import {
  STUDY_AMOUNT_UNIT_OPTIONS,
  STUDY_MINUTE_PRESETS,
  STUDY_PLAN_MODE_OPTIONS,
  type StudyAmountUnit,
  type StudyPlanMode,
} from './planner-constants';

type SubjectOption = {
  id: string;
  label: string;
  color?: string;
  light?: string;
  text?: string;
};

type StudyComposerCardProps = {
  title: string;
  description: string;
  subjectOptions: SubjectOption[];
  subjectValue: string;
  onSubjectChange: (value: string) => void;
  minuteValue: string;
  onMinuteChange: (value: string) => void;
  taskValue: string;
  onTaskChange: (value: string) => void;
  studyModeValue: StudyPlanMode;
  onStudyModeChange: (value: StudyPlanMode) => void;
  amountValue: string;
  onAmountChange: (value: string) => void;
  amountUnitValue: StudyAmountUnit;
  onAmountUnitChange: (value: StudyAmountUnit) => void;
  customAmountUnitValue: string;
  onCustomAmountUnitChange: (value: string) => void;
  enableVolumeMinutes: boolean;
  onEnableVolumeMinutesChange: (value: boolean) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isMobile: boolean;
  compact?: boolean;
  disabled?: boolean;
  submitLabel?: string;
};

export function StudyComposerCard({
  title,
  description,
  subjectOptions,
  subjectValue,
  onSubjectChange,
  minuteValue,
  onMinuteChange,
  taskValue,
  onTaskChange,
  studyModeValue,
  onStudyModeChange,
  amountValue,
  onAmountChange,
  amountUnitValue,
  onAmountUnitChange,
  customAmountUnitValue,
  onCustomAmountUnitChange,
  enableVolumeMinutes,
  onEnableVolumeMinutesChange,
  onSubmit,
  isSubmitting,
  isMobile,
  compact = false,
  disabled = false,
  submitLabel = '계획 추가',
}: StudyComposerCardProps) {
  const isVolumeMode = studyModeValue === 'volume';

  return (
    <Card className={cn(
      "overflow-hidden border-none bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(244,253,248,0.96)_100%)] ring-1 ring-emerald-100/80 shadow-[0_18px_44px_-34px_rgba(16,185,129,0.28)]",
      compact ? "rounded-[1.35rem]" : "rounded-[1.85rem]"
    )}>
      <CardHeader className={cn(compact ? "p-4 pb-3" : isMobile ? "p-5 pb-4" : "p-6 pb-4")}>
        <div className="flex items-center gap-2">
          <div className={cn("rounded-2xl bg-emerald-500/10 text-emerald-600", compact ? "p-2" : "p-2.5")}>
            <Target className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className={cn("font-black tracking-tight text-slate-900", compact ? "text-sm" : isMobile ? "text-base" : "text-lg")}>
              {title}
            </CardTitle>
            <CardDescription className={cn("break-keep text-slate-500", compact ? "mt-0.5 text-[10px] leading-4" : "mt-0.5 text-[11px] leading-5")}>
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(compact ? "space-y-3 p-4 pt-0" : isMobile ? "space-y-3 p-5 pt-0" : "space-y-4 p-6 pt-0")}>
        <div className="grid grid-cols-2 gap-2">
          {STUDY_PLAN_MODE_OPTIONS.map((option) => {
            const isActive = option.value === studyModeValue;
            return (
              <Button
                key={option.value}
                type="button"
                variant="outline"
                disabled={disabled || isSubmitting}
                onClick={() => onStudyModeChange(option.value)}
                className={cn(
                  "h-auto flex-col items-start rounded-2xl border px-3 py-3 text-left transition-all",
                  isActive
                    ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-500"
                    : "border-emerald-100 bg-white/88 text-emerald-700 hover:bg-emerald-50"
                )}
              >
                <span className="text-xs font-black">{option.label}</span>
                <span className={cn("mt-1 text-[10px] leading-4", isActive ? "text-white/88" : "text-emerald-700/72")}>
                  {option.description}
                </span>
              </Button>
            );
          })}
        </div>

        <div className={cn("grid gap-2", isVolumeMode ? "grid-cols-1" : compact ? "grid-cols-2" : "grid-cols-[minmax(0,1fr)_7.2rem]")}>
          <Select value={subjectValue} onValueChange={onSubjectChange} disabled={disabled || isSubmitting}>
            <SelectTrigger className={cn("rounded-xl border-slate-200 bg-white/92 font-black shadow-none", compact ? "h-10 text-[11px]" : "h-11 text-xs")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none shadow-2xl">
              {subjectOptions.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!isVolumeMode ? (
            <Input
              type="number"
              value={minuteValue}
              onChange={(event) => onMinuteChange(event.target.value)}
              disabled={disabled || isSubmitting}
              className={cn("rounded-xl border-slate-200 bg-white/92 text-center font-black shadow-none", compact ? "h-10 text-[11px]" : "h-11 text-xs")}
            />
          ) : null}
        </div>

        {!isVolumeMode ? (
          <div className="flex flex-wrap gap-2">
            {STUDY_MINUTE_PRESETS.map((preset) => {
              const isActive = minuteValue === String(preset);
              return (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  disabled={disabled || isSubmitting}
                  onClick={() => onMinuteChange(String(preset))}
                  className={cn(
                    "rounded-full border transition-all active:scale-[0.98]",
                    compact ? "h-7 px-3 text-[10px]" : "h-8 px-3.5 text-[10px]",
                    isActive
                      ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-500"
                      : "border-emerald-100 bg-white/88 text-emerald-700 hover:bg-emerald-50"
                  )}
                >
                  <span className="font-black">{preset}분</span>
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
              <Input
                type="number"
                min={1}
                value={amountValue}
                onChange={(event) => onAmountChange(event.target.value)}
                disabled={disabled || isSubmitting}
                placeholder="목표 수치"
                className={cn("rounded-xl border-slate-200 bg-white/92 text-center font-black shadow-none", compact ? "h-10 text-[11px]" : "h-11 text-xs")}
              />
              <Select value={amountUnitValue} onValueChange={(value) => onAmountUnitChange(value as StudyAmountUnit)} disabled={disabled || isSubmitting}>
                <SelectTrigger className={cn("rounded-xl border-slate-200 bg-white/92 font-black shadow-none", compact ? "h-10 text-[11px]" : "h-11 text-xs")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl">
                  {STUDY_AMOUNT_UNIT_OPTIONS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {amountUnitValue === '직접입력' ? (
              <Input
                value={customAmountUnitValue}
                onChange={(event) => onCustomAmountUnitChange(event.target.value)}
                disabled={disabled || isSubmitting}
                placeholder="예: 강, 주제, 단원"
                className={cn("rounded-xl border-slate-200 bg-white/92 font-bold shadow-none", compact ? "h-10 text-[11px]" : "h-11 text-xs")}
              />
            ) : null}

            <div className="flex flex-wrap items-center gap-2 rounded-[1.15rem] border border-emerald-100 bg-white/92 p-2">
              <Button
                type="button"
                variant="outline"
                disabled={disabled || isSubmitting}
                onClick={() => onEnableVolumeMinutesChange(!enableVolumeMinutes)}
                className={cn(
                  "h-8 rounded-full border px-3 text-[10px] font-black",
                  enableVolumeMinutes
                    ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-500"
                    : "border-emerald-100 bg-white text-emerald-700 hover:bg-emerald-50"
                )}
              >
                예상 시간(선택)
              </Button>
              {enableVolumeMinutes ? (
                <>
                  <Input
                    type="number"
                    min={0}
                    value={minuteValue}
                    onChange={(event) => onMinuteChange(event.target.value)}
                    disabled={disabled || isSubmitting}
                    className="h-8 w-[5.5rem] rounded-full border-slate-200 bg-white text-center text-[11px] font-black shadow-none"
                  />
                  <span className="text-[10px] font-black text-slate-400">분 예상</span>
                </>
              ) : (
                <span className="text-[10px] font-semibold text-slate-400">시간은 나중에 대략 적어도 돼요.</span>
              )}
            </div>
          </div>
        )}

        <div className={cn(
          "flex items-center gap-2 rounded-[1.15rem] border border-emerald-100 bg-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
          compact ? "p-1.5" : "p-2"
        )}>
          <Input
            value={taskValue}
            onChange={(event) => onTaskChange(event.target.value)}
            placeholder={isVolumeMode ? "예: 수학 3점 문항 30문제" : "예: 수학 오답 정리"}
            disabled={disabled || isSubmitting}
            className={cn(
              "border-none bg-transparent shadow-none focus-visible:ring-0",
              compact ? "h-9 text-sm font-bold" : "h-10 text-sm font-bold"
            )}
          />
          <Button
            type="button"
            onClick={onSubmit}
            disabled={
              disabled ||
              isSubmitting ||
              !taskValue.trim() ||
              (isVolumeMode && (!amountValue.trim() || (amountUnitValue === '직접입력' && !customAmountUnitValue.trim())))
            }
            className={cn(
              "rounded-xl bg-emerald-500 font-black text-white shadow-[0_14px_26px_-18px_rgba(16,185,129,0.55)] hover:bg-emerald-600",
              compact ? "h-9 px-3 text-[11px]" : isMobile ? "h-10 px-4 text-xs" : "h-10 px-4 text-sm"
            )}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
