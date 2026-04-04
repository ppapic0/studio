'use client';

import { useEffect, useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';

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
  personalTasks?: Array<WithId<StudyPlanItem>>;
  personalTaskValue?: string;
  onPersonalTaskChange?: (value: string) => void;
  onAddPersonalTask?: () => void;
  onTogglePersonalTask?: (task: WithId<StudyPlanItem>) => void;
  onDeletePersonalTask?: (task: WithId<StudyPlanItem>) => void;
  modeOptions?: Array<{ value: StudyPlanMode; label: string; description: string }>;
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
  personalTasks = [],
  personalTaskValue = '',
  onPersonalTaskChange,
  onAddPersonalTask,
  onTogglePersonalTask,
  onDeletePersonalTask,
  modeOptions = STUDY_PLAN_MODE_OPTIONS,
}: StudyPlanSheetProps) {
  const [isStudySectionOpen, setIsStudySectionOpen] = useState(false);
  const [isPersonalSectionOpen, setIsPersonalSectionOpen] = useState(false);
  const completedPersonalCount = personalTasks.filter((task) => task.done).length;

  useEffect(() => {
    if (open) {
      setIsStudySectionOpen(false);
      setIsPersonalSectionOpen(false);
    }
  }, [open]);

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
              description="과목, 목표, 할 일을 순서대로 짧게 적고 바로 추가해보세요."
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
                      위 입력 카드에서 끝낼 분량 하나만 적어도 바로 시작할 수 있어요.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {studyTasks.map((task) => {
                      const subject = subjectOptions.find((item) => item.id === (task.subject || 'etc'));
                      const isVolumeTask = resolveStudyPlanMode(task) === 'volume';
                      const unitLabel = resolveAmountUnitLabel(task);

                      return (
                        <PlanItemCard
                          key={task.id}
                          id={task.id}
                          title={task.title}
                          checked={task.done}
                          onToggle={() => onToggleTask(task)}
                          onDelete={() => onDeleteTask(task)}
                          disabled={isPast}
                          isMobile={isMobile}
                          tone="emerald"
                          badgeLabel={`${task.subject === 'etc' ? task.subjectLabel?.trim() || subject?.label || '직접 입력' : subject?.label || '직접 입력'} · ${isVolumeTask ? '분량형' : '시간형'}`}
                          metaLabel={buildStudyTaskMeta(task)}
                          volumeMeta={
                            isVolumeTask
                              ? {
                                  targetAmount: Math.max(0, task.targetAmount || 0),
                                  actualAmount: Math.max(0, task.actualAmount || 0),
                                  unitLabel,
                                  onCommitActual: (value) => onCommitActual(task, value),
                                }
                              : null
                          }
                        />
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
                          <PlanItemCard
                            key={task.id}
                            id={task.id}
                            title={task.title}
                            checked={task.done}
                            onToggle={() => onTogglePersonalTask(task)}
                            onDelete={() => onDeletePersonalTask(task)}
                            disabled={isPast}
                            isMobile={isMobile}
                            tone="amber"
                            badgeLabel="기타 일정"
                            compact
                          />
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
