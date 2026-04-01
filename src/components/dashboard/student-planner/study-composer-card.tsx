'use client';

import { History, Loader2, RotateCcw, Target } from 'lucide-react';

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
  type StudyAmountUnit,
  type StudyPlanMode,
  STUDY_PLAN_MODE_OPTIONS,
  type RecentStudyOption,
  STUDY_AMOUNT_UNIT_OPTIONS,
  STUDY_MINUTE_PRESETS,
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
  customSubjectValue?: string;
  onCustomSubjectChange?: (value: string) => void;
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
  isRecentLoading?: boolean;
  recentOptions?: RecentStudyOption[];
  onPrefillRecent?: (value: RecentStudyOption) => void;
  onOpenRecentSheet?: () => void;
  activeRecentTitle?: string | null;
  onResetRecentPrefill?: () => void;
  compact?: boolean;
  disabled?: boolean;
  submitLabel?: string;
  modeOptions?: Array<{ value: StudyPlanMode; label: string; description: string }>;
};

export function StudyComposerCard({
  title,
  description,
  subjectOptions,
  subjectValue,
  onSubjectChange,
  customSubjectValue = '',
  onCustomSubjectChange,
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
  isRecentLoading = false,
  recentOptions = [],
  onPrefillRecent,
  onOpenRecentSheet,
  activeRecentTitle = null,
  onResetRecentPrefill,
  compact = false,
  disabled = false,
  submitLabel = '계획 추가',
  modeOptions = STUDY_PLAN_MODE_OPTIONS,
}: StudyComposerCardProps) {
  const isVolumeMode = studyModeValue === 'volume';
  const visibleRecentOptions = recentOptions.slice(0, isMobile ? 2 : 5);

  return (
    <Card variant="secondary" className={cn(
      "overflow-hidden shadow-[0_18px_44px_-34px_rgba(0,0,0,0.5)]",
      compact ? "rounded-[1.35rem]" : "rounded-[1.85rem]"
    )}>
      <CardHeader className={cn(compact ? "p-4 pb-3" : isMobile ? "p-5 pb-4" : "p-6 pb-4")}>
        <div className="flex items-center gap-2">
          <div className={cn("surface-chip surface-chip--accent", compact ? "p-2" : "p-2.5")}>
            <Target className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className={cn("font-black tracking-tight text-white", compact ? "text-sm" : isMobile ? "text-base" : "text-lg")}>
              {title}
            </CardTitle>
            <CardDescription className={cn("break-keep text-[var(--text-on-dark-soft)]", compact ? "mt-0.5 text-[10px] leading-4" : "mt-0.5 text-[11px] leading-5")}>
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(compact ? "space-y-3 p-4 pt-0" : isMobile ? "space-y-3 p-5 pt-0" : "space-y-4 p-6 pt-0")}>
        {recentOptions.length > 0 || isRecentLoading ? (
          <div className="surface-card surface-card--ghost on-dark rounded-[1.3rem] p-3 shadow-[0_18px_40px_-36px_rgba(0,0,0,0.42)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="rounded-2xl bg-white/[0.1] p-2 text-[var(--accent-orange-soft)]">
                    <History className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black tracking-tight text-white">최근 불러오기</p>
                    <p className="mt-0.5 break-keep text-[10px] font-semibold leading-4 text-[var(--text-on-dark-soft)]">
                      전에 쓰던 계획을 불러와서 말만 조금 바꿔도 돼요.
                    </p>
                  </div>
                </div>
              </div>
              {onOpenRecentSheet ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disabled || isSubmitting || isRecentLoading}
                  onClick={onOpenRecentSheet}
                  className="h-8 rounded-full border border-white/12 bg-white/[0.1] px-3 text-[10px] font-black text-white hover:bg-white/[0.14]"
                >
                  {isRecentLoading ? '불러오는 중' : '더 보기'}
                </Button>
              ) : null}
            </div>
            <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
              {isRecentLoading ? (
                <div className="flex h-[6.5rem] min-w-full items-center justify-center rounded-[1.15rem] border border-dashed border-white/12 bg-white/[0.08]">
                  <span className="text-[11px] font-semibold text-[var(--text-on-dark-soft)]">최근 계획을 불러오는 중이에요.</span>
                </div>
              ) : null}
              {visibleRecentOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  disabled={disabled || isSubmitting}
                  onClick={() => onPrefillRecent?.(option)}
                  className={cn(
                    'shrink-0 rounded-[1.15rem] border border-white/12 bg-white/[0.08] p-3 text-left shadow-[0_18px_32px_-26px_rgba(0,0,0,0.38)] transition-all hover:border-[#FFB347]/25 hover:bg-white/[0.14] snap-start',
                    isMobile ? 'min-w-[9.25rem]' : 'min-w-[11rem]'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#FF9626]/18 px-2 py-0.5 text-[9px] font-black text-[var(--accent-orange-soft)]">
                      {option.subjectLabel}
                    </span>
                    <span className="text-[9px] font-black text-[var(--text-on-dark-muted)]">{option.studyModeLabel}</span>
                  </div>
                  <p className="mt-2 line-clamp-1 break-keep text-[11px] font-black tracking-tight text-white">
                    {option.title}
                  </p>
                  <p className="mt-1 line-clamp-2 break-keep text-[10px] font-semibold leading-4 text-[var(--text-on-dark-soft)]">
                    {option.metaLabel}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {activeRecentTitle ? (
          <div className="flex items-center justify-between gap-3 rounded-[1.2rem] border border-[#FFB347]/28 bg-[#FF9626]/16 p-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent-orange-soft)]">불러온 계획 수정 중</p>
              <p className="mt-1 line-clamp-1 break-keep text-xs font-black text-white">{activeRecentTitle}</p>
            </div>
            {onResetRecentPrefill ? (
              <Button
                type="button"
                variant="ghost"
                disabled={disabled || isSubmitting}
                onClick={onResetRecentPrefill}
                className="h-8 shrink-0 rounded-full border border-white/12 bg-white/[0.1] px-3 text-[10px] font-black text-white hover:bg-white/[0.14]"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                초기화
              </Button>
            ) : null}
          </div>
        ) : null}

        {modeOptions.length > 1 ? (
          <div className="grid grid-cols-2 gap-2">
          {modeOptions.map((option) => {
            const isActive = option.value === studyModeValue;
            return (
              <Button
                key={option.value}
                type="button"
                variant="outline"
                disabled={disabled || isSubmitting}
                onClick={() => onStudyModeChange(option.value)}
                className={cn(
                  "h-auto rounded-2xl border px-3 py-3 text-left transition-all",
                  isMobile ? "flex items-center justify-center" : "flex-col items-start",
                  isActive
                    ? "border-[#FFB347]/24 bg-[linear-gradient(180deg,#17326B_0%,#28478F_100%)] text-white hover:bg-[#28478F]"
                    : "border-white/12 bg-white/[0.08] text-white hover:bg-white/[0.14]"
                )}
              >
                <span className="text-xs font-black">{option.label}</span>
                {!isMobile ? (
                  <span className={cn("mt-1 text-[10px] leading-4", isActive ? "text-white" : "text-[var(--text-on-dark-soft)]")}>
                    {option.description}
                  </span>
                ) : null}
              </Button>
            );
          })}
          </div>
        ) : null}

        <div className={cn("grid gap-2", isVolumeMode ? "grid-cols-1" : isMobile ? "grid-cols-1" : compact ? "grid-cols-2" : "grid-cols-[minmax(0,1fr)_7.2rem]")}>
          <Select value={subjectValue} onValueChange={onSubjectChange} disabled={disabled || isSubmitting}>
            <SelectTrigger className={cn("rounded-xl border-white/12 bg-white/[0.1] font-black text-white shadow-none", compact ? "h-10 text-[11px]" : "h-11 text-xs")}>
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
              className={cn("rounded-xl border-white/12 bg-white/[0.1] text-center font-black text-white shadow-none", compact ? "h-10 text-[11px]" : "h-11 text-xs")}
            />
          ) : null}
        </div>

        {subjectValue === 'etc' && onCustomSubjectChange ? (
          <Input
            value={customSubjectValue}
            onChange={(event) => onCustomSubjectChange(event.target.value)}
            disabled={disabled || isSubmitting}
            placeholder="예: 생윤, 물리, 미적분, 전공 과목"
            className={cn(
              "rounded-xl border-white/12 bg-white/[0.1] font-bold text-white shadow-none placeholder:text-white/55",
              compact ? "h-10 text-[11px]" : "h-11 text-xs"
            )}
          />
        ) : null}

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
                      ? "border-[#FFB347]/24 bg-[#FF9626]/16 text-[var(--accent-orange-soft)] hover:bg-[#FF9626]/18"
                    : "border-white/12 bg-white/[0.08] text-white hover:bg-white/[0.14]"
                  )}
                >
                  <span className="font-black">{preset}분</span>
                </Button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            <div className={cn('grid gap-2', isMobile ? 'grid-cols-[minmax(0,0.92fr)_minmax(0,0.78fr)]' : 'grid-cols-[minmax(0,1fr)_8rem]')}>
              <Input
                type="number"
                min={1}
                value={amountValue}
                onChange={(event) => onAmountChange(event.target.value)}
                disabled={disabled || isSubmitting}
                placeholder="목표 수치"
                className={cn("rounded-xl border-white/12 bg-white/[0.1] text-center font-black text-white shadow-none", compact ? "h-10 text-[11px]" : "h-11 text-xs")}
              />
              <Select value={amountUnitValue} onValueChange={(value) => onAmountUnitChange(value as StudyAmountUnit)} disabled={disabled || isSubmitting}>
                <SelectTrigger className={cn("rounded-xl border-white/12 bg-white/[0.1] font-black text-white shadow-none", compact ? "h-10 text-[11px]" : "h-11 text-xs")}>
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
                className={cn("rounded-xl border-white/12 bg-white/[0.1] font-bold text-white shadow-none placeholder:text-white/55", compact ? "h-10 text-[11px]" : "h-11 text-xs")}
              />
            ) : null}

            <div className={cn('rounded-[1.15rem] border border-white/12 bg-white/[0.08] p-2', isMobile ? 'flex flex-col items-start gap-2' : 'flex flex-wrap items-center gap-2')}>
              <Button
                type="button"
                variant="outline"
                disabled={disabled || isSubmitting}
                onClick={() => onEnableVolumeMinutesChange(!enableVolumeMinutes)}
                className={cn(
                  "h-8 rounded-full border px-3 text-[10px] font-black",
                  enableVolumeMinutes
                    ? "border-[#FFB347]/24 bg-[#FF9626]/16 text-[var(--accent-orange-soft)] hover:bg-[#FF9626]/18"
                    : "border-white/12 bg-white/[0.08] text-white hover:bg-white/[0.14]"
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
                    className="h-8 w-[5.5rem] rounded-full border-white/12 bg-white/[0.1] text-center text-[11px] font-black text-white shadow-none"
                  />
                  <span className="text-[10px] font-black text-[var(--text-on-dark-soft)]">분 예상</span>
                </>
              ) : (
                <span className="text-[10px] font-semibold text-[var(--text-on-dark-soft)]">시간은 나중에 대략 적어도 돼요.</span>
              )}
            </div>
          </div>
        )}

        <div className={cn(
          "rounded-[1.15rem] border border-white/12 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
          compact ? "p-1.5" : "p-2",
          isMobile ? 'flex flex-col items-stretch gap-2' : 'flex items-center gap-2'
        )}>
          <Input
            value={taskValue}
            onChange={(event) => onTaskChange(event.target.value)}
            placeholder={isVolumeMode ? "예: 수학 3점 문항 30문제" : "예: 수학 오답 정리"}
            disabled={disabled || isSubmitting}
            className={cn(
              "border-none bg-transparent text-white shadow-none focus-visible:ring-0 placeholder:text-white/55",
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
              "rounded-xl bg-[linear-gradient(135deg,#173A82_0%,#22479B_58%,#FF7A16_160%)] font-black text-white shadow-[0_14px_26px_-18px_rgba(20,41,95,0.55)] hover:brightness-105",
              compact ? "h-9 px-3 text-[11px]" : isMobile ? "h-10 w-full px-4 text-xs" : "h-10 px-4 text-sm"
            )}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
