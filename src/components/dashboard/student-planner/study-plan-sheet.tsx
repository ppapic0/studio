'use client';

import { useEffect, useState } from 'react';
import { BookOpen, ChevronDown, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { StudyPlanItem, WithId } from '@/lib/types';
import { cn } from '@/lib/utils';

import { PlanItemCard } from './plan-item-card';
import {
  type RecentStudyOption,
  STUDY_AMOUNT_UNIT_OPTIONS,
  STUDY_PLAN_MODE_OPTIONS,
  type StudyAmountUnit,
  type StudyPlanMode,
} from './planner-constants';
import { StudyComposerCard } from './study-composer-card';

type SubjectOption = {
  id: string;
  label: string;
  color?: string;
  light?: string;
  text?: string;
};

type StudyPlanSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  isSubmitting: boolean;
  isPast: boolean;
  canCompleteTasks?: boolean;
  completedCount: number;
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
  isRecentLoading: boolean;
  recentOptions: RecentStudyOption[];
  onPrefillRecent: (item: RecentStudyOption) => void;
  onOpenRecentSheet: () => void;
  activeRecentTitle: string | null;
  onResetRecentPrefill: () => void;
  studyTasks: Array<WithId<StudyPlanItem>>;
  onToggleTask: (task: WithId<StudyPlanItem>) => void;
  onDeleteTask: (task: WithId<StudyPlanItem>) => void;
  onCommitActual: (task: WithId<StudyPlanItem>, value: number) => void;
  onUpdateStudyTask?: (
    task: WithId<StudyPlanItem>,
    patch: {
      title: string;
      subject: string;
      subjectLabel: string | null;
      studyPlanMode: StudyPlanMode;
      targetMinutes: number;
      targetAmount: number;
      amountUnit: StudyAmountUnit | null;
      amountUnitLabel: string | null;
    }
  ) => void | Promise<void>;
  personalTasks?: Array<WithId<StudyPlanItem>>;
  personalTaskValue?: string;
  onPersonalTaskChange?: (value: string) => void;
  onAddPersonalTask?: () => void;
  onTogglePersonalTask?: (task: WithId<StudyPlanItem>) => void;
  onDeletePersonalTask?: (task: WithId<StudyPlanItem>) => void;
  onUpdatePersonalTask?: (task: WithId<StudyPlanItem>, title: string) => void | Promise<void>;
  modeOptions?: Array<{ value: StudyPlanMode; label: string; description: string }>;
};

type TaskEditDraft =
  | {
      kind: 'study';
      id: string;
      title: string;
      subject: string;
      subjectLabel: string;
      studyPlanMode: StudyPlanMode;
      targetMinutes: string;
      targetAmount: string;
      amountUnit: StudyAmountUnit;
      amountUnitLabel: string;
      enableVolumeMinutes: boolean;
    }
  | {
      kind: 'personal';
      id: string;
      title: string;
    };

function resolveStudyPlanMode(
  task: Pick<StudyPlanItem, 'studyPlanMode' | 'targetAmount' | 'targetMinutes'>
): StudyPlanMode {
  if (task.studyPlanMode) return task.studyPlanMode;
  return typeof task.targetAmount === 'number' && task.targetAmount > 0 ? 'volume' : 'time';
}

function resolveAmountUnitLabel(task: Pick<StudyPlanItem, 'amountUnit' | 'amountUnitLabel'>) {
  if (task.amountUnit === '직접입력') return task.amountUnitLabel?.trim() || '단위';
  return task.amountUnit || '문제';
}

function resolveEditAmountUnit(unit: StudyPlanItem['amountUnit'] | null | undefined): StudyAmountUnit {
  return STUDY_AMOUNT_UNIT_OPTIONS.some((item) => item.value === unit) ? unit as StudyAmountUnit : '문제';
}

function toPositiveIntegerDraft(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function buildStudyTaskMeta(
  task: Pick<
    StudyPlanItem,
    'studyPlanMode' | 'targetMinutes' | 'targetAmount' | 'actualAmount' | 'amountUnit' | 'amountUnitLabel'
  >
) {
  if (resolveStudyPlanMode(task) === 'volume') {
    const unitLabel = resolveAmountUnitLabel(task);
    const targetAmount = Math.max(0, task.targetAmount || 0);
    const actualAmount = Math.max(0, task.actualAmount || 0);
    if (targetAmount <= 0) {
      return '자율 계획';
    }
    const progressRate = targetAmount > 0 ? Math.round((actualAmount / targetAmount) * 100) : 0;
    return `목표 ${targetAmount}${unitLabel} · 실제 ${actualAmount}${unitLabel} · ${progressRate}%`;
  }
  return task.targetMinutes ? `${task.targetMinutes}분 목표` : '시간 자유';
}

export function StudyPlanSheet({
  open,
  onOpenChange,
  isMobile,
  isSubmitting,
  isPast,
  canCompleteTasks = true,
  completedCount,
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
  isRecentLoading,
  recentOptions,
  onPrefillRecent,
  onOpenRecentSheet,
  activeRecentTitle,
  onResetRecentPrefill,
  studyTasks,
  onToggleTask,
  onDeleteTask,
  onCommitActual,
  onUpdateStudyTask,
  personalTasks = [],
  personalTaskValue = '',
  onPersonalTaskChange,
  onAddPersonalTask,
  onTogglePersonalTask,
  onDeletePersonalTask,
  onUpdatePersonalTask,
  modeOptions = STUDY_PLAN_MODE_OPTIONS,
}: StudyPlanSheetProps) {
  const [isStudySectionOpen, setIsStudySectionOpen] = useState(false);
  const [isPersonalSectionOpen, setIsPersonalSectionOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<TaskEditDraft | null>(null);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const completedPersonalCount = personalTasks.filter((task) => task.done).length;
  const fallbackCustomSubjectLabel = subjectOptions.find((item) => item.id === 'etc')?.label || '기타';

  useEffect(() => {
    if (open) {
      setIsStudySectionOpen(false);
      setIsPersonalSectionOpen(false);
      setEditDraft(null);
    }
  }, [open]);

  useEffect(() => {
    if (isPast) {
      setEditDraft(null);
    }
  }, [isPast]);

  const openStudyTaskEdit = (task: WithId<StudyPlanItem>) => {
    const studyPlanMode = resolveStudyPlanMode(task);
    const targetMinutes = Math.max(0, Number(task.targetMinutes || 0));
    const targetAmount = Math.max(0, Number(task.targetAmount || 0));
    setEditDraft({
      kind: 'study',
      id: task.id,
      title: task.title || '',
      subject: task.subject || 'etc',
      subjectLabel: task.subject === 'etc' ? task.subjectLabel?.trim() || fallbackCustomSubjectLabel : '',
      studyPlanMode,
      targetMinutes: targetMinutes > 0 ? String(targetMinutes) : '',
      targetAmount: targetAmount > 0 ? String(targetAmount) : '',
      amountUnit: resolveEditAmountUnit(task.amountUnit),
      amountUnitLabel: task.amountUnitLabel?.trim() || '',
      enableVolumeMinutes: studyPlanMode === 'volume' && targetMinutes > 0,
    });
  };

  const openPersonalTaskEdit = (task: WithId<StudyPlanItem>) => {
    setEditDraft({
      kind: 'personal',
      id: task.id,
      title: task.title || '',
    });
  };

  const updateStudyEditDraft = (patch: Partial<Extract<TaskEditDraft, { kind: 'study' }>>) => {
    setEditDraft((previous) => previous?.kind === 'study' ? { ...previous, ...patch } : previous);
  };

  const updatePersonalEditDraft = (patch: Partial<Extract<TaskEditDraft, { kind: 'personal' }>>) => {
    setEditDraft((previous) => previous?.kind === 'personal' ? { ...previous, ...patch } : previous);
  };

  const saveEditDraft = async () => {
    if (!editDraft || isPast || isEditSaving) return;
    const trimmedTitle = editDraft.title.trim();
    if (!trimmedTitle) return;

    setIsEditSaving(true);
    try {
      if (editDraft.kind === 'study') {
        const task = studyTasks.find((item) => item.id === editDraft.id);
        if (!task || !onUpdateStudyTask) return;
        const isVolumeMode = editDraft.studyPlanMode === 'volume';
        const targetMinutes = toPositiveIntegerDraft(editDraft.targetMinutes);
        const targetAmount = toPositiveIntegerDraft(editDraft.targetAmount);
        const subjectLabel = editDraft.subject === 'etc'
          ? editDraft.subjectLabel.trim() || fallbackCustomSubjectLabel
          : null;

        await onUpdateStudyTask(task, {
          title: trimmedTitle,
          subject: editDraft.subject || 'etc',
          subjectLabel,
          studyPlanMode: editDraft.studyPlanMode,
          targetMinutes: isVolumeMode
            ? editDraft.enableVolumeMinutes ? targetMinutes : 0
            : targetMinutes,
          targetAmount: isVolumeMode ? targetAmount : 0,
          amountUnit: isVolumeMode && targetAmount > 0 ? editDraft.amountUnit : null,
          amountUnitLabel: isVolumeMode && targetAmount > 0 && editDraft.amountUnit === '직접입력'
            ? editDraft.amountUnitLabel.trim() || '단위'
            : null,
        });
      } else {
        const task = personalTasks.find((item) => item.id === editDraft.id);
        if (!task || !onUpdatePersonalTask) return;
        await onUpdatePersonalTask(task, trimmedTitle);
      }
      setEditDraft(null);
    } finally {
      setIsEditSaving(false);
    }
  };

  const isSaveEditDisabled =
    !editDraft ||
    isEditSaving ||
    !editDraft.title.trim() ||
    (editDraft.kind === 'study' ? !onUpdateStudyTask : !onUpdatePersonalTask);

  const renderStudyEditPanel = (task: WithId<StudyPlanItem>) => {
    if (editDraft?.kind !== 'study' || editDraft.id !== task.id) return null;
    const isVolumeMode = editDraft.studyPlanMode === 'volume';
    const needsCustomSubject = editDraft.subject === 'etc';
    const needsCustomUnit = isVolumeMode && editDraft.amountUnit === '직접입력';

    return (
      <div className="rounded-[1.2rem] border border-[#FFB347]/24 bg-[#FF7A16]/10 p-3">
        <div className={cn('gap-3', isMobile ? 'space-y-3' : 'grid grid-cols-[minmax(0,1fr)_10rem]')}>
          <div className="space-y-1.5">
            <p className="text-[10px] font-black text-[#FFD4AA]">실시할 내용</p>
            <Input
              value={editDraft.title}
              onChange={(event) => updateStudyEditDraft({ title: event.target.value })}
              disabled={isEditSaving}
              className="h-10 rounded-xl border-white/12 bg-white/[0.1] text-sm font-black text-white placeholder:text-white/55"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-black text-[#FFD4AA]">계획 유형</p>
            <div className="grid grid-cols-2 gap-1.5">
              {STUDY_PLAN_MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={isEditSaving}
                  onClick={() => updateStudyEditDraft({
                    studyPlanMode: option.value,
                    enableVolumeMinutes: option.value === 'volume' ? editDraft.enableVolumeMinutes : true,
                  })}
                  className={cn(
                    'h-10 rounded-xl border text-[11px] font-black transition-all',
                    editDraft.studyPlanMode === option.value
                      ? 'border-[#FFB347]/50 bg-[#FF7A16]/28 text-white'
                      : 'border-white/12 bg-white/[0.08] text-[var(--text-on-dark-soft)] hover:bg-white/[0.12]'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <p className="text-[10px] font-black text-[#FFD4AA]">과목</p>
          <div className="flex flex-wrap gap-1.5">
            {subjectOptions.map((subject) => (
              <button
                key={subject.id}
                type="button"
                disabled={isEditSaving}
                onClick={() => updateStudyEditDraft({
                  subject: subject.id,
                  subjectLabel: subject.id === 'etc' ? editDraft.subjectLabel || fallbackCustomSubjectLabel : '',
                })}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-[10px] font-black transition-all',
                  editDraft.subject === subject.id
                    ? 'border-[#FFB347]/50 bg-[#FF7A16]/28 text-white'
                    : 'border-white/12 bg-white/[0.08] text-[var(--text-on-dark-soft)] hover:bg-white/[0.12]'
                )}
              >
                {subject.label}
              </button>
            ))}
          </div>
          {needsCustomSubject ? (
            <Input
              value={editDraft.subjectLabel}
              onChange={(event) => updateStudyEditDraft({ subjectLabel: event.target.value })}
              disabled={isEditSaving}
              placeholder="과목 이름"
              className="h-10 rounded-xl border-white/12 bg-white/[0.1] text-sm font-black text-white placeholder:text-white/55"
            />
          ) : null}
        </div>

        {isVolumeMode ? (
          <div className="mt-3 space-y-3">
            <div className={cn('gap-3', isMobile ? 'space-y-3' : 'grid grid-cols-[8rem_minmax(0,1fr)]')}>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-[#FFD4AA]">목표 분량</p>
                <Input
                  type="number"
                  min={0}
                  value={editDraft.targetAmount}
                  onChange={(event) => updateStudyEditDraft({ targetAmount: event.target.value })}
                  disabled={isEditSaving}
                  placeholder="예: 30"
                  className="h-10 rounded-xl border-white/12 bg-white/[0.1] text-center text-sm font-black text-white placeholder:text-white/55"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black text-[#FFD4AA]">단위</p>
                <div className="flex flex-wrap gap-1.5">
                  {STUDY_AMOUNT_UNIT_OPTIONS.map((unit) => (
                    <button
                      key={unit.value}
                      type="button"
                      disabled={isEditSaving}
                      onClick={() => updateStudyEditDraft({ amountUnit: unit.value })}
                      className={cn(
                        'rounded-full border px-2.5 py-1.5 text-[10px] font-black transition-all',
                        editDraft.amountUnit === unit.value
                          ? 'border-[#FFB347]/50 bg-[#FF7A16]/28 text-white'
                          : 'border-white/12 bg-white/[0.08] text-[var(--text-on-dark-soft)] hover:bg-white/[0.12]'
                      )}
                    >
                      {unit.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {needsCustomUnit ? (
              <Input
                value={editDraft.amountUnitLabel}
                onChange={(event) => updateStudyEditDraft({ amountUnitLabel: event.target.value })}
                disabled={isEditSaving}
                placeholder="직접 입력 단위"
                className="h-10 rounded-xl border-white/12 bg-white/[0.1] text-sm font-black text-white placeholder:text-white/55"
              />
            ) : null}
            <button
              type="button"
              disabled={isEditSaving}
              onClick={() => updateStudyEditDraft({ enableVolumeMinutes: !editDraft.enableVolumeMinutes })}
              className="text-[10px] font-black text-[#FFD4AA] transition hover:text-white"
            >
              {editDraft.enableVolumeMinutes ? '예상 시간 빼기' : '예상 시간 추가'}
            </button>
            {editDraft.enableVolumeMinutes ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={editDraft.targetMinutes}
                  onChange={(event) => updateStudyEditDraft({ targetMinutes: event.target.value })}
                  disabled={isEditSaving}
                  placeholder="예: 60"
                  className="h-10 max-w-[7rem] rounded-xl border-white/12 bg-white/[0.1] text-center text-sm font-black text-white placeholder:text-white/55"
                />
                <span className="text-[10px] font-black text-[var(--text-on-dark-soft)]">분 정도</span>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 space-y-1.5">
            <p className="text-[10px] font-black text-[#FFD4AA]">목표 시간</p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={editDraft.targetMinutes}
                onChange={(event) => updateStudyEditDraft({ targetMinutes: event.target.value })}
                disabled={isEditSaving}
                placeholder="예: 60"
                className="h-10 max-w-[7rem] rounded-xl border-white/12 bg-white/[0.1] text-center text-sm font-black text-white placeholder:text-white/55"
              />
              <span className="text-[10px] font-black text-[var(--text-on-dark-soft)]">분 목표</span>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setEditDraft(null)}
            disabled={isEditSaving}
            className="h-9 rounded-full border border-white/12 bg-white/[0.06] px-4 text-[11px] font-black text-white hover:bg-white/[0.12]"
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={() => void saveEditDraft()}
            disabled={isSaveEditDisabled}
            className="h-9 rounded-full bg-[#FF7A16] px-4 text-[11px] font-black text-white hover:bg-[#FF8C32]"
          >
            {isEditSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '수정 저장'}
          </Button>
        </div>
      </div>
    );
  };

  const renderPersonalEditPanel = (task: WithId<StudyPlanItem>) => {
    if (editDraft?.kind !== 'personal' || editDraft.id !== task.id) return null;

    return (
      <div className="rounded-[1.2rem] border border-[#FFB347]/24 bg-[#FF7A16]/10 p-3">
        <p className="text-[10px] font-black text-[#FFD4AA]">기타 일정 내용</p>
        <Input
          value={editDraft.title}
          onChange={(event) => updatePersonalEditDraft({ title: event.target.value })}
          disabled={isEditSaving}
          className="mt-2 h-10 rounded-xl border-white/12 bg-white/[0.1] text-sm font-black text-white placeholder:text-white/55"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setEditDraft(null)}
            disabled={isEditSaving}
            className="h-9 rounded-full border border-white/12 bg-white/[0.06] px-4 text-[11px] font-black text-white hover:bg-white/[0.12]"
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={() => void saveEditDraft()}
            disabled={isSaveEditDisabled}
            className="h-9 rounded-full bg-[#FF7A16] px-4 text-[11px] font-black text-white hover:bg-[#FF8C32]"
          >
            {isEditSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '수정 저장'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        motionPreset="dashboard-premium"
        className={cn(
          'overflow-hidden border-none bg-[linear-gradient(180deg,#13285A_0%,#0E1B3D_100%)] p-0 shadow-2xl',
          isMobile
            ? 'max-h-[90dvh] w-[min(94vw,35rem)] rounded-[2rem]'
            : 'max-h-[88dvh] w-[min(92vw,56rem)] max-w-[56rem] rounded-[2rem]'
        )}
      >
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(255,179,71,0.14),transparent_28%),linear-gradient(135deg,#10295f_0%,#17326B_46%,#0f2149_100%)] p-6 text-white">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/16 p-2.5">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-black tracking-tight text-white">
                  오늘 계획 수정
                </DialogTitle>
                <DialogDescription className="mt-1 text-[11px] font-semibold text-[var(--text-on-dark-soft)]">
                  먼저 새 계획을 짧게 적고, 기존 계획은 필요할 때만 펼쳐보세요.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div
          className={cn(
            'overflow-y-auto bg-[linear-gradient(180deg,#13285A_0%,#0E1B3D_100%)]',
            isMobile ? 'max-h-[calc(90dvh-9rem)] p-4' : 'max-h-[calc(88dvh-9rem)] p-5'
          )}
        >
          {!isPast ? (
            <StudyComposerCard
              title="새 계획 작성"
              description="과목 분류와 오늘 할 내용을 자유롭게 적으면 바로 추가할 수 있어요."
              subjectOptions={subjectOptions}
              subjectValue={subjectValue}
              onSubjectChange={onSubjectChange}
              customSubjectValue={customSubjectValue}
              onCustomSubjectChange={onCustomSubjectChange}
              studyModeValue={studyModeValue}
              onStudyModeChange={onStudyModeChange}
              minuteValue={minuteValue}
              onMinuteChange={onMinuteChange}
              amountValue={amountValue}
              onAmountChange={onAmountChange}
              amountUnitValue={amountUnitValue}
              onAmountUnitChange={onAmountUnitChange}
              customAmountUnitValue={customAmountUnitValue}
              onCustomAmountUnitChange={onCustomAmountUnitChange}
              enableVolumeMinutes={enableVolumeMinutes}
              onEnableVolumeMinutesChange={onEnableVolumeMinutesChange}
              taskValue={taskValue}
              onTaskChange={onTaskChange}
              onSubmit={onSubmit}
              isSubmitting={isSubmitting}
              isMobile={isMobile}
              isRecentLoading={isRecentLoading}
              recentOptions={recentOptions}
              onPrefillRecent={onPrefillRecent}
              onOpenRecentSheet={onOpenRecentSheet}
              activeRecentTitle={activeRecentTitle}
              onResetRecentPrefill={onResetRecentPrefill}
              modeOptions={modeOptions}
            />
          ) : null}

          <Collapsible open={isStudySectionOpen} onOpenChange={setIsStudySectionOpen}>
            <div className="mt-4 rounded-[1.45rem] border border-white/12 bg-white/[0.06] p-3">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-[1.1rem] bg-white/[0.04] px-4 py-3 text-left transition-all hover:bg-white/[0.08]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white">오늘 계획</p>
                    <p className="mt-1 text-[11px] font-semibold text-[var(--text-on-dark-soft)]">
                      총 {studyTasks.length}개 · 완료 {completedCount}개
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-[var(--text-on-dark-soft)] transition-transform',
                      isStudySectionOpen && 'rotate-180'
                    )}
                  />
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent className="pt-3">
                {studyTasks.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-dashed border-white/12 bg-white/[0.04] px-4 py-5 text-center">
                    <p className="text-sm font-black text-white">아직 등록된 학습 계획이 없어요</p>
                    <p className="mt-2 text-[11px] font-semibold leading-5 text-[var(--text-on-dark-soft)]">
                      위 입력 카드에서 오늘 할 내용 하나만 적어도 바로 시작할 수 있어요.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {studyTasks.map((task) => {
                      const subject = subjectOptions.find((item) => item.id === (task.subject || 'etc'));
                      const isVolumeTask = resolveStudyPlanMode(task) === 'volume';
                      const targetAmount = Math.max(0, task.targetAmount || 0);
                      const unitLabel = resolveAmountUnitLabel(task);

                      return (
                        <div key={task.id} className="space-y-2">
                          <PlanItemCard
                            id={task.id}
                            title={task.title}
                            checked={task.done}
                            onToggle={() => onToggleTask(task)}
                            onDelete={() => onDeleteTask(task)}
                            onEdit={onUpdateStudyTask ? () => openStudyTaskEdit(task) : undefined}
                            isEditing={editDraft?.kind === 'study' && editDraft.id === task.id}
                            disabled={isPast}
                            completionDisabled={!canCompleteTasks}
                            isMobile={isMobile}
                            tone="emerald"
                            badgeLabel={task.subject === 'etc' ? task.subjectLabel?.trim() || subject?.label || '직접 입력' : subject?.label || '직접 입력'}
                            metaLabel={buildStudyTaskMeta(task)}
                            volumeMeta={
                              isVolumeTask && targetAmount > 0
                                ? {
                                    targetAmount,
                                    actualAmount: Math.max(0, task.actualAmount || 0),
                                    unitLabel,
                                    onCommitActual: (value) => onCommitActual(task, value),
                                    onRequestCompletion: () => onToggleTask(task),
                                  }
                                : null
                            }
                          />
                          {renderStudyEditPanel(task)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>

          {onPersonalTaskChange && onAddPersonalTask && onTogglePersonalTask && onDeletePersonalTask ? (
            <Collapsible open={isPersonalSectionOpen} onOpenChange={setIsPersonalSectionOpen}>
              <div className="mt-4 rounded-[1.45rem] border border-white/12 bg-white/[0.06] p-3">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-[1.1rem] bg-white/[0.04] px-4 py-3 text-left transition-all hover:bg-white/[0.08]"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white">기타 일정</p>
                      <p className="mt-1 text-[11px] font-semibold text-[var(--text-on-dark-soft)]">
                        총 {personalTasks.length}개 · 완료 {completedPersonalCount}개
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 text-[var(--text-on-dark-soft)] transition-transform',
                        isPersonalSectionOpen && 'rotate-180'
                      )}
                    />
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent className="pt-3">
                  {!isPast ? (
                    <div className="rounded-[1.2rem] border border-white/12 bg-white/[0.08] p-2">
                      <div className={cn('gap-2', isMobile ? 'space-y-2' : 'grid grid-cols-[minmax(0,1fr)_5.4rem]')}>
                        <Input
                          placeholder="예: 병원, 상담, 준비물 챙기기"
                          value={personalTaskValue}
                          onChange={(event) => onPersonalTaskChange(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              onAddPersonalTask();
                            }
                          }}
                          disabled={isSubmitting}
                          className="h-11 border-none bg-transparent text-sm font-bold text-white shadow-none focus-visible:ring-0 placeholder:text-white/55"
                        />
                        <Button
                          type="button"
                          onClick={onAddPersonalTask}
                          disabled={isSubmitting || !personalTaskValue.trim()}
                          className="h-11 rounded-[1rem] bg-[linear-gradient(135deg,#14295F_0%,#254A9C_56%,#FF7A16_150%)] text-sm font-black text-white hover:brightness-105"
                        >
                          추가
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3">
                    {personalTasks.length === 0 ? (
                      <div className="rounded-[1.2rem] border border-dashed border-white/12 bg-white/[0.04] px-4 py-5 text-center">
                        <p className="text-[12px] font-black text-white">기타 일정은 필요할 때만 적어도 충분해요</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {personalTasks.map((task) => (
                          <div key={task.id} className="space-y-2">
                            <PlanItemCard
                              id={task.id}
                              title={task.title}
                              checked={task.done}
                              onToggle={() => onTogglePersonalTask(task)}
                              onDelete={() => onDeletePersonalTask(task)}
                              onEdit={onUpdatePersonalTask ? () => openPersonalTaskEdit(task) : undefined}
                              isEditing={editDraft?.kind === 'personal' && editDraft.id === task.id}
                              disabled={isPast}
                              completionDisabled={!canCompleteTasks}
                              isMobile={isMobile}
                              tone="amber"
                              badgeLabel="기타 일정"
                              compact
                            />
                            {renderPersonalEditPanel(task)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ) : null}

          <div className="mt-4 rounded-[1.1rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-[11px] font-semibold leading-5 text-[var(--text-on-dark-soft)]">
            최근 계획은 버튼 한 번으로 불러오고, 기존 목록은 필요할 때만 펼쳐서 확인할 수 있게 정리했어요.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
