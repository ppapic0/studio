'use client';

import { useEffect, useState } from 'react';
import { History, Loader2, Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  type RecentStudyOption,
  type StudyAmountUnit,
  STUDY_AMOUNT_UNIT_OPTIONS,
  type StudyPlanMode,
  STUDY_PLAN_MODE_OPTIONS,
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
  onOpenRecentSheet,
  activeRecentTitle = null,
  onResetRecentPrefill,
  compact = false,
  disabled = false,
  submitLabel = '계획 추가',
  modeOptions = STUDY_PLAN_MODE_OPTIONS,
}: StudyComposerCardProps) {
  const hasSingleMode = modeOptions.length === 1;
  const effectiveStudyMode = hasSingleMode ? modeOptions[0].value : studyModeValue;
  const isVolumeMode = effectiveStudyMode === 'volume';
  const [showOptionalMinutes, setShowOptionalMinutes] = useState(enableVolumeMinutes || !isVolumeMode);

  useEffect(() => {
    if (hasSingleMode && studyModeValue !== modeOptions[0].value) {
      onStudyModeChange(modeOptions[0].value);
    }
  }, [hasSingleMode, modeOptions, onStudyModeChange, studyModeValue]);

  useEffect(() => {
    if (!isVolumeMode) {
      setShowOptionalMinutes(true);
      return;
    }
    if (enableVolumeMinutes) {
      setShowOptionalMinutes(true);
    }
  }, [enableVolumeMinutes, isVolumeMode]);

  const activeSubjectLabel =
    subjectOptions.find((subject) => subject.id === subjectValue)?.label || '과목 선택';
  const needsCustomSubject = subjectValue === 'etc';
  const canSubmit =
    !disabled &&
    !isSubmitting &&
    taskValue.trim().length > 0 &&
    (!isVolumeMode ||
      (amountValue.trim().length > 0 &&
        (amountUnitValue !== '직접입력' || customAmountUnitValue.trim().length > 0)));

  return (
    <Card
      variant="secondary"
      className={cn(
        'overflow-hidden border border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(174,194,235,0.06)_100%)] shadow-[0_22px_48px_-38px_rgba(0,0,0,0.55)]',
        compact ? 'rounded-[1.4rem]' : 'rounded-[1.85rem]'
      )}
    >
      <CardHeader className={cn(compact ? 'p-4 pb-3' : isMobile ? 'p-5 pb-4' : 'p-6 pb-4')}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={cn('rounded-[1rem] bg-[#FF7A16]/16 text-[#FFB36B]', compact ? 'p-2' : 'p-2.5')}>
              <Target className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <CardTitle
                className={cn(
                  'font-black tracking-tight text-white',
                  compact ? 'text-sm' : isMobile ? 'text-base' : 'text-lg'
                )}
              >
                {title}
              </CardTitle>
              <CardDescription
                className={cn(
                  'break-keep text-[var(--text-on-dark-soft)]',
                  compact ? 'mt-0.5 text-[10px] leading-4' : 'mt-0.5 text-[11px] leading-5'
                )}
              >
                {description}
              </CardDescription>
            </div>
          </div>
          {onOpenRecentSheet ? (
            <Button
              type="button"
              variant="ghost"
              disabled={disabled || isSubmitting || isRecentLoading}
              onClick={onOpenRecentSheet}
              className="h-9 shrink-0 rounded-full border border-white/14 bg-white/[0.08] px-3 text-[11px] font-black text-white hover:bg-white/[0.14]"
            >
              <History className="mr-1.5 h-3.5 w-3.5" />
              {isRecentLoading ? '불러오는 중' : `최근 계획${recentOptions.length > 0 ? ` ${recentOptions.length}개` : ''}`}
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className={cn(compact ? 'space-y-3 p-4 pt-0' : isMobile ? 'space-y-3 p-5 pt-0' : 'space-y-4 p-6 pt-0')}>
        <div className="rounded-[1.55rem] border border-white/12 bg-[linear-gradient(180deg,#FFFFFF_0%,#F4F7FF_100%)] p-4 text-[#14295F] shadow-[0_18px_42px_-34px_rgba(20,41,95,0.45)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-keep text-sm font-black leading-6">
                과목을 고르고 끝낼 양만 적으면 바로 오늘 계획에 추가돼요.
              </p>
            </div>
            <div className="rounded-full border border-[#D7E1F2] bg-white px-3 py-1 text-[11px] font-black text-[#14295F]">
              {activeSubjectLabel}
            </div>
          </div>

          <div className="mt-3 rounded-[1rem] border border-[#DCE6F5] bg-[#F8FBFF] px-3.5 py-3">
            <p className="text-[11px] font-black text-[#355185]">입력 순서</p>
            <div className="mt-2 space-y-1.5 text-[11px] font-semibold leading-5 text-[#5C73A0]">
              <p><span className="font-black text-[#14295F]">과목 분류</span> : 국어, 수학, 영어처럼 큰 과목 이름</p>
              <p><span className="font-black text-[#14295F]">실시할 내용</span> : 오늘 실제로 할 강의, 단원, 문제 유형</p>
              <p><span className="font-black text-[#14295F]">분량</span> : 몇 강, 몇 단원, 몇 문제인지 숫자로 입력</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {subjectOptions.map((subject) => {
              const isActive = subject.id === subjectValue;
              return (
                <button
                  key={subject.id}
                  type="button"
                  disabled={disabled || isSubmitting}
                  onClick={() => onSubjectChange(subject.id)}
                  className={cn(
                    'rounded-full border px-3 py-2 text-[11px] font-black transition-all',
                    isActive
                      ? 'border-[#14295F] bg-[#14295F] text-white shadow-[0_16px_28px_-22px_rgba(20,41,95,0.55)]'
                      : 'border-[#D7E1F2] bg-white text-[#355185] hover:border-[#B2C4E8] hover:bg-[#F6F9FF]'
                  )}
                >
                  {subject.label}
                </button>
              );
            })}
          </div>

          {needsCustomSubject && onCustomSubjectChange ? (
            <div className="mt-3 space-y-1.5">
              <p className="text-[11px] font-black text-[#5C73A0]">과목 분류</p>
              <Input
                value={customSubjectValue}
                onChange={(event) => onCustomSubjectChange(event.target.value)}
                disabled={disabled || isSubmitting}
                placeholder="예: 국어, 한국사, 영어"
                className="h-11 rounded-[1rem] border-[#D7E1F2] bg-white text-sm font-black text-[#14295F] shadow-none placeholder:text-[#7E93BB]"
              />
            </div>
          ) : null}

          {isVolumeMode ? (
            <>
              <div className="mt-3 space-y-1.5">
                <p className="text-[11px] font-black text-[#5C73A0]">실시할 내용</p>
                <Input
                  value={taskValue}
                  onChange={(event) => onTaskChange(event.target.value)}
                  placeholder="예: 트랙 국어 1강 보기"
                  disabled={disabled || isSubmitting}
                  className="h-12 rounded-[1rem] border-[#D7E1F2] bg-white text-sm font-black text-[#14295F] shadow-none placeholder:text-[#7E93BB]"
                />
              </div>

              <div className="mt-3 space-y-1.5">
                <p className="text-[11px] font-black text-[#5C73A0]">분량</p>
                <div className={cn('grid gap-2', isMobile ? 'grid-cols-[minmax(0,1fr)_7.4rem]' : 'grid-cols-[minmax(0,1fr)_8rem]')}>
                  <Input
                    type="number"
                    min={1}
                    value={amountValue}
                    onChange={(event) => onAmountChange(event.target.value)}
                    disabled={disabled || isSubmitting}
                    placeholder="예: 3"
                    className="h-11 rounded-[1rem] border-[#D7E1F2] bg-white text-center text-sm font-black text-[#14295F] shadow-none placeholder:text-[#7E93BB]"
                  />
                  <Select
                    value={amountUnitValue}
                    onValueChange={(value) => onAmountUnitChange(value as StudyAmountUnit)}
                    disabled={disabled || isSubmitting}
                  >
                    <SelectTrigger className="h-11 rounded-[1rem] border-[#D7E1F2] bg-white text-sm font-black text-[#14295F] shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-[#D7E1F2]">
                      {STUDY_AMOUNT_UNIT_OPTIONS.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {amountUnitValue === '직접입력' ? (
                <Input
                  value={customAmountUnitValue}
                  onChange={(event) => onCustomAmountUnitChange(event.target.value)}
                  disabled={disabled || isSubmitting}
                  placeholder="예: 강, 단원, 문제, 지문"
                  className="mt-3 h-11 rounded-[1rem] border-[#D7E1F2] bg-white text-sm font-black text-[#14295F] shadow-none placeholder:text-[#7E93BB]"
                />
              ) : null}

              <div className="mt-3">
                <button
                  type="button"
                  disabled={disabled || isSubmitting}
                  onClick={() => {
                    const nextValue = !showOptionalMinutes;
                    setShowOptionalMinutes(nextValue);
                    onEnableVolumeMinutesChange(nextValue);
                  }}
                  className={cn(
                    'text-[11px] font-black transition-colors',
                    showOptionalMinutes ? 'text-[#14295F]' : 'text-[#5C73A0]',
                    !disabled && !isSubmitting && 'hover:text-[#14295F]'
                  )}
                >
                  {showOptionalMinutes ? '예상 시간 숨기기' : '예상 시간 추가'}
                </button>
                {showOptionalMinutes ? (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={minuteValue}
                      onChange={(event) => onMinuteChange(event.target.value)}
                      disabled={disabled || isSubmitting}
                      placeholder="예: 60"
                      className="h-10 max-w-[7rem] rounded-full border-[#D7E1F2] bg-white text-center text-sm font-black text-[#14295F] shadow-none placeholder:text-[#7E93BB]"
                    />
                    <span className="text-[11px] font-black text-[#6E83AB]">분 정도</span>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="mt-3 space-y-1.5">
              <p className="text-[11px] font-black text-[#5C73A0]">예상 시간</p>
              <Input
                type="number"
                min={0}
                value={minuteValue}
                onChange={(event) => onMinuteChange(event.target.value)}
                disabled={disabled || isSubmitting}
                placeholder="예: 60"
                className="h-11 rounded-[1rem] border-[#D7E1F2] bg-white text-center text-sm font-black text-[#14295F] shadow-none placeholder:text-[#7E93BB]"
              />
            </div>
          )}

          <div className={cn('mt-3 gap-2', isMobile || isVolumeMode ? 'space-y-2' : 'grid grid-cols-[minmax(0,1fr)_8.5rem]')}>
            {!isVolumeMode ? (
              <div className="space-y-1.5">
                <p className="text-[11px] font-black text-[#5C73A0]">실시할 내용</p>
                <Input
                  value={taskValue}
                  onChange={(event) => onTaskChange(event.target.value)}
                  placeholder="예: 트랙 국어 1강 보기"
                  disabled={disabled || isSubmitting}
                  className="h-12 rounded-[1rem] border-[#D7E1F2] bg-white text-sm font-black text-[#14295F] shadow-none placeholder:text-[#7E93BB]"
                />
              </div>
            ) : null}
            <Button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className={cn(
                'h-12 rounded-[1rem] bg-[linear-gradient(135deg,#14295F_0%,#254A9C_54%,#FF7A16_150%)] font-black text-white shadow-[0_20px_32px_-24px_rgba(20,41,95,0.6)] hover:brightness-105',
                isMobile ? 'w-full' : 'w-full'
              )}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
