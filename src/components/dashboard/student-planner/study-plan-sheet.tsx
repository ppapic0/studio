'use client';

import { BookOpen, Loader2, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { StudyPlanItem, WithId } from '@/lib/types';
import { cn } from '@/lib/utils';

import { PlanItemCard } from './plan-item-card';
import {
  type RecentStudyOption,
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
  selectedDateLabel: string;
  totalCount: number;
  completedCount: number;
  remainingCount: number;
  goalSummaryLabel: string;
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
};

function resolveStudyPlanMode(task: Pick<StudyPlanItem, 'studyPlanMode' | 'targetAmount' | 'targetMinutes'>): StudyPlanMode {
  if (task.studyPlanMode) return task.studyPlanMode;
  return typeof task.targetAmount === 'number' && task.targetAmount > 0 ? 'volume' : 'time';
}

function resolveAmountUnitLabel(task: Pick<StudyPlanItem, 'amountUnit' | 'amountUnitLabel'>) {
  if (task.amountUnit === '직접입력') return task.amountUnitLabel?.trim() || '단위';
  return task.amountUnit || '문제';
}

function buildStudyTaskMeta(task: Pick<StudyPlanItem, 'studyPlanMode' | 'targetMinutes' | 'targetAmount' | 'actualAmount' | 'amountUnit' | 'amountUnitLabel'>) {
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
  selectedDateLabel,
  totalCount,
  completedCount,
  remainingCount,
  goalSummaryLabel,
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
}: StudyPlanSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        motionPreset="dashboard-premium"
        className={cn(
          'overflow-hidden border-none bg-[linear-gradient(180deg,#13285A_0%,#0E1B3D_100%)] p-0 shadow-2xl',
          isMobile
            ? 'w-[min(94vw,35rem)] max-h-[90dvh] rounded-[2rem]'
            : 'w-[min(92vw,56rem)] max-w-[56rem] max-h-[88dvh] rounded-[2rem]'
        )}
      >
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(255,179,71,0.16),transparent_28%),linear-gradient(135deg,#10295f_0%,#17326B_46%,#0f2149_100%)] p-6 text-white">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/12 p-2.5">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-black tracking-tight text-white">
                  학습 계획 수정
                </DialogTitle>
                <DialogDescription className="mt-1 text-[11px] font-semibold text-white/76">
                  최근 계획 불러오기부터 분량형·시간형 추가, 체크까지 한 번에 관리해요.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className={cn('overflow-y-auto bg-[linear-gradient(180deg,#13285A_0%,#0E1B3D_100%)]', isMobile ? 'max-h-[calc(90dvh-9rem)] p-4' : 'max-h-[calc(88dvh-9rem)] p-5')}>
          <div className="rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(29,53,101,0.96)_0%,rgba(13,28,69,0.92)_100%)] p-4 shadow-[0_18px_40px_-34px_rgba(0,0,0,0.42)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-black text-white">이 날짜 학습 계획 관리</p>
                <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-white/55">
                  추가와 수정은 여기서 하고, 메인 화면에서는 요약만 빠르게 확인해요.
                </p>
              </div>
              <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-black text-[#FFD79F] shadow-none">
                {selectedDateLabel}
              </Badge>
            </div>
            <div className={cn('mt-4 grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
              <div className="rounded-[1rem] border border-white/10 bg-white/8 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/52">완료 흐름</p>
                <p className="mt-2 text-lg font-black tracking-tight text-white">
                  {completedCount}/{totalCount}
                </p>
              </div>
              <div className="rounded-[1rem] border border-white/10 bg-white/8 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/52">남은 계획</p>
                <p className="mt-2 text-lg font-black tracking-tight text-white">{remainingCount}개</p>
              </div>
              <div className="rounded-[1rem] border border-white/10 bg-white/8 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/52">오늘 목표</p>
                <p className="mt-2 break-keep text-sm font-black text-white">{goalSummaryLabel}</p>
              </div>
            </div>
          </div>

          {!isPast ? (
            <div className="mt-4">
              <StudyComposerCard
                title="학습 계획 추가"
                description="최근 계획을 먼저 불러오거나, 시간형과 분량형 중 편한 방식으로 바로 적어보세요."
                subjectOptions={subjectOptions}
                subjectValue={subjectValue}
                onSubjectChange={onSubjectChange}
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
              />
            </div>
          ) : null}

          <div className="mt-4">
            {studyTasks.length === 0 ? (
              <div className="rounded-[1.45rem] border border-dashed border-white/10 bg-white/6 p-6 text-center">
                <p className="text-sm font-black text-white">첫 학습 계획을 추가해보세요</p>
                <p className="mt-2 break-keep text-[11px] font-semibold leading-5 text-white/52">
                  시간을 먼저 정하지 않아도 괜찮아요. 오늘 끝낼 분량부터 적어도 바로 시작할 수 있어요.
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
                      badgeLabel={`${subject?.label || '기타'} · ${isVolumeTask ? '분량형' : '시간형'}`}
                      metaLabel={buildStudyTaskMeta(task)}
                      volumeMeta={isVolumeTask ? {
                        targetAmount: Math.max(0, task.targetAmount || 0),
                        actualAmount: Math.max(0, task.actualAmount || 0),
                        unitLabel,
                        onCommitActual: (value) => onCommitActual(task, value),
                      } : null}
                    />
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-[1.1rem] border border-white/10 bg-white/6 px-4 py-3 text-[11px] font-semibold leading-5 text-white/55">
            최근 계획을 불러와서 살짝 수정하거나, 분량형/시간형 중 편한 방식으로 새 계획을 짧게 추가해보세요.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
