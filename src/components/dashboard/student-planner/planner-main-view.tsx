'use client';

import { useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  BookCopy,
  CalendarCheck2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Flame,
  Layers3,
  ListTodo,
  Plus,
  StickyNote,
  Sparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { PlannerChecklistItem } from './planner-checklist-item';
import { PlannerTemplateSheet } from './planner-template-sheet';
import { RecentStudySheet } from './recent-study-sheet';
import { RepeatCopySheet } from './repeat-copy-sheet';
import { RoutineComposerCard } from './routine-composer-card';
import { ScheduleItemCard } from './schedule-item-card';
import { StudyPlanSheet } from './study-plan-sheet';
import {
  ROUTINE_TEMPLATE_OPTIONS,
  STUDY_AMOUNT_UNIT_OPTIONS,
  type StudyPlanMode,
} from './planner-constants';
import {
  BUILTIN_PLANNER_TEMPLATES,
  formatClockRange,
  formatDurationLabel,
} from '@/lib/plan-track';

type PlannerMainViewProps = {
  model: any;
};

const LOCAL_WEEKDAY_OPTIONS = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' },
];

function resolveStudyPlanMode(task: any): StudyPlanMode {
  if (task.studyPlanMode) return task.studyPlanMode;
  return typeof task.targetAmount === 'number' && task.targetAmount > 0 ? 'volume' : 'time';
}

function resolveAmountUnitLabel(task: any) {
  if (task.amountUnit === '직접입력') return task.amountUnitLabel?.trim() || '단위';
  return task.amountUnit || '문제';
}

function buildStudyTaskMeta(task: any) {
  if (resolveStudyPlanMode(task) === 'volume') {
    const unitLabel = resolveAmountUnitLabel(task);
    const targetAmount = Math.max(0, task.targetAmount || 0);
    const actualAmount = Math.max(0, task.actualAmount || 0);
    const progressRate = targetAmount > 0 ? Math.round((actualAmount / targetAmount) * 100) : 0;
    return `목표 ${targetAmount}${unitLabel} · 실제 ${actualAmount}${unitLabel} · ${progressRate}%`;
  }
  return task.targetMinutes ? `${task.targetMinutes}분 목표` : '시간 자유';
}

function getChecklistBadge(task: any, subjectOptions: any[]) {
  if (task.category === 'personal') {
    return {
      label: task.tag || '메모',
      className: 'border border-[#FF7A16]/15 bg-[#FFF7EC] text-[#FF7A16]',
    };
  }

  const subject = subjectOptions.find((item) => item.id === (task.subject || 'etc'));
  return {
    label: `${subject?.label || '기타'} · ${resolveStudyPlanMode(task) === 'volume' ? '분량형' : '시간형'}`,
    className: 'border border-[#D9E1F2] bg-[#F5F8FF] text-[#173A82]',
  };
}

function extractRoutineItems(scheduleItems: any[]) {
  return scheduleItems.filter((item) => {
    const title = String(item.title || '');
    return !title.startsWith('등원 예정:')
      && !title.startsWith('하원 예정:')
      && !title.startsWith('외출 예정')
      && !title.includes('등원하지 않습니다');
  });
}

function ActionChipButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = 'navy',
}: {
  icon: any;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'navy' | 'orange' | 'white';
}) {
  const toneClass =
    tone === 'orange'
      ? 'border-[#FF7A16]/14 bg-[#FFF7EC] text-[#FF7A16] hover:bg-[#FFF1E1]'
      : tone === 'white'
        ? 'border-[#D9E1F2] bg-white text-[#173A82] hover:bg-[#F7FAFF]'
        : 'border-[#D9E1F2] bg-[#173A82] text-white hover:bg-[#143272]';

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-10 rounded-full px-4 text-xs font-black shadow-none',
        toneClass
      )}
    >
      <Icon className="mr-2 h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

export function PlannerMainView({ model }: PlannerMainViewProps) {
  const {
    isMobile,
    isPast,
    isToday,
    isSubmitting,
    selectedDate,
    setSelectedDate,
    weekDays,
    moveWeek,
    weekRangeLabel,
    checklistTasks,
    orderedChecklistTasks,
    completedChecklistCount,
    completionRate,
    todayPointGaugeLabel,
    todayCompletionLabel,
    todayStreakDays,
    planTrackPointTotal,
    rewardGradient,
    floatingPointBursts,
    showQuickAddCard,
    setShowQuickAddCard,
    expandedTaskId,
    setExpandedTaskId,
    studyTasks,
    personalTasks,
    scheduleItems,
    remainingStudyTasks,
    remainingPersonalTasks,
    completedStudyCount,
    routineCountLabel,
    studyGoalSummaryLabel,
    subjectOptions,
    newStudyTask,
    setNewStudyTask,
    newStudySubject,
    setNewStudySubject,
    newStudyMode,
    setNewStudyMode,
    newStudyMinutes,
    setNewStudyMinutes,
    newStudyTargetAmount,
    setNewStudyTargetAmount,
    newStudyAmountUnit,
    setNewStudyAmountUnit,
    newStudyCustomAmountUnit,
    setNewStudyCustomAmountUnit,
    enableVolumeStudyMinutes,
    setEnableVolumeStudyMinutes,
    handleSubmitInlineStudyTask,
    handleQuickAddSuggestion,
    recentStudyOptions,
    activeRecentStudyOption,
    handlePrefillRecentStudy,
    handleQuickAddRecentStudy,
    resetStudyComposerPrefill,
    isRecentStudyLoading,
    isRecentStudySheetOpen,
    setIsRecentStudySheetOpen,
    isStudyPlanSheetOpen,
    setIsStudyPlanSheetOpen,
    isTemplateSheetOpen,
    setIsTemplateSheetOpen,
    customTemplates,
    recentTemplates,
    templateNameDraft,
    setTemplateNameDraft,
    editingTemplateId,
    setEditingTemplateId,
    saveCurrentPlanTemplate,
    startEditingTemplate,
    deleteTemplate,
    applyTemplateToToday,
    weekdayTemplate,
    examTemplate,
    handleCopyYesterdayPlan,
    clearTodayPlans,
    handleMoveUnfinishedToTomorrow,
    handleSaveUnfinishedAsTemplate,
    handleDeleteUnfinished,
    handleToggleTask,
    handleDeleteTask,
    handleCommitStudyActualAmount,
    handleUpdateStudyWindow,
    isRoutineSectionOpen,
    setIsRoutineSectionOpen,
    isMemoSectionOpen,
    setIsMemoSectionOpen,
    inTime,
    setInTime,
    outTime,
    setOutTime,
    awayStartTime,
    setAwayStartTime,
    awayEndTime,
    setAwayEndTime,
    awayReason,
    setAwayReason,
    isAbsentMode,
    hasAwayPlan,
    hasInPlan,
    hasOutPlan,
    handleSetAttendance,
    newRoutineTitle,
    setNewRoutineTitle,
    selectedRoutineTemplateKey,
    handleRoutineTemplateSelect,
    newPersonalTask,
    setNewPersonalTask,
    handleAddTask,
    handleUpdateScheduleRange,
    routineCopyWeeks,
    setRoutineCopyWeeks,
    routineCopyDays,
    routineCopyOptions,
    routineCopyItemIds,
    setRoutineCopyItemIds,
    handleApplyRoutineToAllWeekdays,
    isRoutineCopyDialogOpen,
    setIsRoutineCopyDialogOpen,
    hasCopyableRoutines,
    taskCopyWeeks,
    setTaskCopyWeeks,
    taskCopyDays,
    taskCopyOptions,
    taskCopyItemIds,
    setTaskCopyItemIds,
    handleApplyTasksToAllWeekdays,
    isTaskCopyDialogOpen,
    setIsTaskCopyDialogOpen,
    hasCopyableTasks,
    toggleCopyDay,
    toggleCopyItem,
  } = model;

  const selectedDateLabel = format(selectedDate, 'M월 d일 EEEE', { locale: ko });
  const routineItems = extractRoutineItems(scheduleItems);
  const completionPercent = Math.round(completionRate * 100);
  const pointPercent = Math.min(100, Math.max(0, planTrackPointTotal));
  const quickRecentItems = recentStudyOptions.slice(0, isMobile ? 2 : 3);
  const [isWrapUpOpen, setIsWrapUpOpen] = useState(false);

  return (
    <>
      <div className={cn('mx-auto flex w-full max-w-5xl flex-col pb-24', isMobile ? 'gap-4 px-3' : 'gap-8 px-4')}>
        <header className="space-y-4 pt-2">
          <div className="relative overflow-hidden rounded-[2rem] border border-[#D9E1F2] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_55%,#fff8f0_100%)] p-5 shadow-[0_24px_44px_-34px_rgba(23,58,130,0.24)]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,122,22,0.14),transparent_34%)]" />
            <div className="relative">
              {floatingPointBursts.map((burst: { id: number; label: string }, index: number) => (
                <div
                  key={burst.id}
                  className="absolute right-0 top-0 rounded-full bg-[#173A82] px-3 py-1 text-xs font-black text-white shadow-[0_14px_28px_-20px_rgba(23,58,130,0.35)] animate-[planner-point-burst_0.95s_ease-out_forwards]"
                  style={{ marginTop: `${index * 8}px` }}
                >
                  +{burst.label}P
                </div>
              ))}

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black tracking-[0.2em] text-[#173A82]/42">PLAN TRACK</p>
                  <h1 className={cn('mt-2 font-black tracking-tight text-[#173A82]', isMobile ? 'text-[1.95rem]' : 'text-[2.8rem]')}>
                    {selectedDateLabel}
                  </h1>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-black text-[#173A82]">
                    <span>🔥 {todayPointGaugeLabel} pt</span>
                    <span className="text-[#173A82]/35">|</span>
                    <span>{completionPercent}% 완료</span>
                    {todayStreakDays > 0 ? (
                      <Badge className="rounded-full border border-[#FF7A16]/14 bg-[#FFF7EC] px-2.5 py-1 text-[10px] font-black text-[#FF7A16] shadow-none">
                        <Flame className="mr-1 h-3 w-3" />
                        {todayStreakDays}일 연속
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-[1rem] bg-[#173A82] px-3 py-2 text-right text-white shadow-[0_16px_28px_-22px_rgba(23,58,130,0.55)]">
                  <p className="text-[10px] font-black tracking-[0.16em] text-white/62">TODAY</p>
                  <p className="mt-1 text-lg font-black">{todayCompletionLabel}</p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-black text-[#173A82]/55">
                  <span>오늘 포인트</span>
                  <span>{Math.min(planTrackPointTotal, 100)} / 100</span>
                </div>
                <div className="rounded-full bg-[#D9E1F2]/70 p-1">
                  <Progress value={pointPercent} className="h-2.5 bg-transparent [&>div]:bg-[linear-gradient(90deg,#FFD089_0%,#FFB357_45%,#FF7A16_100%)]" />
                </div>
              </div>

              {!isPast ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <ActionChipButton icon={Copy} label="어제 복사" onClick={handleCopyYesterdayPlan} disabled={isSubmitting} />
                  <ActionChipButton icon={Layers3} label="템플릿" onClick={() => setIsTemplateSheetOpen(true)} disabled={isSubmitting} tone="white" />
                  <button
                    type="button"
                    onClick={async () => {
                      await clearTodayPlans();
                      setShowQuickAddCard(true);
                    }}
                    disabled={isSubmitting}
                    className="rounded-full px-1.5 py-2 text-xs font-black text-[#173A82]/58 transition hover:text-[#173A82] disabled:opacity-45"
                  >
                    빈 상태로 시작
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[1.7rem] border border-[#D9E1F2] bg-white/92 p-3 shadow-[0_24px_48px_-36px_rgba(23,58,130,0.24)]">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => moveWeek(-1)}
                className="h-10 w-10 rounded-full bg-[#F5F8FF] p-0 text-[#173A82] hover:bg-[#EAF0FF]"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="rounded-full bg-[#FFF7EC] px-4 py-2 text-xs font-black tracking-[0.18em] text-[#FF7A16]">
                {weekRangeLabel}
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => moveWeek(1)}
                className="h-10 w-10 rounded-full bg-[#F5F8FF] p-0 text-[#173A82] hover:bg-[#EAF0FF]"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-2">
              {weekDays.map((day: Date) => {
                const selected = isSameDay(day, selectedDate);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      'rounded-[1.1rem] border px-1 py-2 text-center transition-all',
                      selected
                        ? 'border-[#173A82] bg-[#173A82] text-white shadow-[0_14px_28px_-18px_rgba(23,58,130,0.45)]'
                        : 'border-[#D9E1F2] bg-white text-[#173A82] hover:border-[#173A82]/30 hover:bg-[#F7FAFF]'
                    )}
                  >
                    <p className="text-[10px] font-black text-current/70">{format(day, 'EEE', { locale: ko })}</p>
                    <p className="mt-1 text-sm font-black">{format(day, 'd')}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <section className="overflow-hidden rounded-[2rem] border border-[#D9E1F2] bg-[linear-gradient(180deg,#fffdfa_0%,#ffffff_100%)] shadow-[0_28px_50px_-38px_rgba(23,58,130,0.22)]">
          <div className={cn('border-b border-[#E3EAF4] px-4 py-4', !isMobile && 'md:px-5')}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-black tracking-[0.18em] text-[#173A82]/42">TODAY LIST</p>
                <h3 className="mt-1 text-[1.7rem] font-black tracking-tight text-[#173A82]">한눈에 봐요</h3>
                <p className="mt-2 break-keep text-sm font-semibold leading-6 text-[#173A82]/60">
                  {orderedChecklistTasks.length === 0
                    ? '어제 계획이나 템플릿을 불러오면 오늘 할 일이 바로 채워져요.'
                    : '오늘 할 일만 먼저 체크하고, 자세한 설정은 눌렀을 때만 펼쳐서 보세요.'}
                </p>
              </div>
              {!isPast ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsStudyPlanSheetOpen(true)}
                  className="h-10 rounded-full bg-[#F5F8FF] px-4 text-[11px] font-black text-[#173A82] hover:bg-[#EAF0FF]"
                >
                  전체 편집
                </Button>
              ) : null}
            </div>
          </div>

          {!isPast ? (
            <div className={cn('px-4 pt-4', !isMobile && 'md:px-5')}>
              <div className={cn(isMobile ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap items-center gap-2')}>
                <button
                  type="button"
                  onClick={() => setShowQuickAddCard((prev: boolean) => !prev)}
                  className={cn(
                    'rounded-full bg-[#173A82] px-4 py-2.5 text-sm font-black text-white shadow-[0_18px_26px_-20px_rgba(23,58,130,0.45)] transition hover:bg-[#143272]',
                    isMobile && 'flex w-full items-center justify-center text-[13px]'
                  )}
                >
                  <Plus className="mr-2 inline h-4 w-4" />
                  + 할 일 추가
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsRecentStudySheetOpen(true)}
                  className={cn(
                    'h-10 rounded-full bg-[#F5F8FF] px-4 text-[11px] font-black text-[#173A82] hover:bg-[#EAF0FF]',
                    isMobile && 'w-full'
                  )}
                >
                  최근 불러오기
                </Button>
                {activeRecentStudyOption ? (
                  <button
                    type="button"
                    onClick={resetStudyComposerPrefill}
                    className={cn(
                      'rounded-full px-2 py-2 text-[11px] font-black text-[#FF7A16]',
                      isMobile && 'col-span-2 justify-self-start'
                    )}
                  >
                    불러온 계획 해제
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {showQuickAddCard && !isPast ? (
            <div className="relative mt-5 overflow-hidden rounded-[1.7rem] border border-[#D9E1F2] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_58%,#fff7ec_100%)] p-4 shadow-[0_20px_40px_-34px_rgba(23,58,130,0.18)] animate-[planner-fade-rise_0.22s_ease-out]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,122,22,0.12),transparent_32%)]" />
              <div className={cn('relative flex items-start justify-between gap-3', isMobile && 'flex-col')}>
                <div className="min-w-0">
                  <p className="text-sm font-black text-[#173A82]">빠르게 할 일 추가</p>
                  <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-[#173A82]/55">
                    과목과 시간만 고르면 자동으로 시간표처럼 이어 붙어요.
                  </p>
                </div>
                {activeRecentStudyOption ? (
                  <button
                    type="button"
                    onClick={resetStudyComposerPrefill}
                    className={cn(
                      'rounded-full bg-[#FFF7EC] px-3 py-1 text-[10px] font-black text-[#FF7A16]',
                      isMobile && 'self-start'
                    )}
                  >
                    불러온 계획 해제
                  </button>
                ) : null}
              </div>

              <div className={cn('mt-4 gap-2', isMobile ? 'grid grid-cols-2' : 'flex flex-wrap')}>
                {[
                  { id: 'math-problem', label: '수학 문제풀이' },
                  { id: 'english-vocab', label: '영어 단어' },
                  { id: 'reading-kor', label: '국어 독해' },
                  { id: 'math-wrong', label: '오답노트' },
                  { id: 'self-study', label: '자습' },
                ].map((suggestion) => (
                  <Button
                    key={suggestion.id}
                    type="button"
                    variant="outline"
                    onClick={() => handleQuickAddSuggestion(suggestion.id)}
                    className={cn(
                      'h-9 rounded-full border-[#D9E1F2] bg-white px-3 text-[11px] font-black text-[#173A82] hover:bg-[#F7FAFF]',
                      isMobile && 'w-full px-2 text-[10px]'
                    )}
                  >
                    {suggestion.label}
                  </Button>
                ))}
              </div>

              <div className={cn('mt-4 gap-2', isMobile ? 'grid grid-cols-1' : 'flex flex-wrap')}>
                {quickRecentItems.map((item: any) => (
                  <button
                    type="button"
                    key={item.key}
                    onClick={() => handlePrefillRecentStudy(item)}
                    className={cn(
                      'rounded-full border border-[#D9E1F2] bg-[#F5F8FF] px-3 py-1.5 text-[11px] font-black text-[#173A82]',
                      isMobile && 'w-full text-left'
                    )}
                  >
                    최근 · {item.title}
                  </button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsRecentStudySheetOpen(true)}
                  className={cn(
                    'h-9 rounded-full px-3 text-[11px] font-black text-[#173A82]/70 hover:bg-[#F3F7FF]',
                    isMobile && 'w-full justify-center'
                  )}
                >
                  {isRecentStudyLoading ? '불러오는 중...' : '최근 기록 더보기'}
                </Button>
              </div>

              <div className={cn('mt-5 grid gap-3', isMobile ? 'grid-cols-1' : 'md:grid-cols-2')}>
                <div className="space-y-2">
                  <p className="text-[11px] font-black text-[#173A82]/55">과목</p>
                  <div className="flex flex-wrap gap-2">
                    {subjectOptions.map((subject: any) => (
                      <button
                        key={subject.id}
                        type="button"
                        onClick={() => setNewStudySubject(subject.id)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-[11px] font-black transition-all',
                          newStudySubject === subject.id
                            ? 'border-[#173A82] bg-[#173A82] text-white'
                            : 'border-[#D9E1F2] bg-white text-[#173A82]'
                        )}
                      >
                        {subject.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-black text-[#173A82]/55">계획 방식</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewStudyMode('time')}
                      className={cn(
                        'rounded-[1rem] border px-3 py-3 text-left',
                        newStudyMode === 'time'
                          ? 'border-[#173A82] bg-[#173A82] text-white'
                          : 'border-[#D9E1F2] bg-white text-[#173A82]'
                      )}
                    >
                      <p className="text-sm font-black">시간형</p>
                      {!isMobile ? (
                        <p className={cn('mt-1 text-[11px] font-semibold', newStudyMode === 'time' ? 'text-white/75' : 'text-[#173A82]/60')}>
                          예: 1시간 집중
                        </p>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewStudyMode('volume')}
                      className={cn(
                        'rounded-[1rem] border px-3 py-3 text-left',
                        newStudyMode === 'volume'
                          ? 'border-[#FF7A16] bg-[#FFF1E1] text-[#173A82]'
                          : 'border-[#D9E1F2] bg-white text-[#173A82]'
                      )}
                    >
                      <p className="text-sm font-black">분량형</p>
                      {!isMobile ? (
                        <p className="mt-1 text-[11px] font-semibold text-[#173A82]/60">
                          예: 30문제, 2지문
                        </p>
                      ) : null}
                    </button>
                  </div>
                </div>
              </div>

              <div className={cn('mt-5 grid gap-3', isMobile ? 'grid-cols-1' : 'md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]')}>
                <div className="space-y-2">
                  <p className="text-[11px] font-black text-[#173A82]/55">할 일 제목</p>
                  <Input
                    value={newStudyTask}
                    onChange={(event) => setNewStudyTask(event.target.value)}
                    placeholder="예: 수학 오답 30문제"
                    className="h-12 rounded-2xl border-[#D9E1F2] bg-white font-bold text-[#173A82] placeholder:text-[#173A82]/35"
                  />
                </div>

                {newStudyMode === 'time' ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-black text-[#173A82]/55">예상 시간</p>
                    <div className={cn('grid gap-2', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
                      {[30, 60, 90, 120].map((minute) => (
                        <button
                          key={minute}
                          type="button"
                          onClick={() => setNewStudyMinutes(String(minute))}
                          className={cn(
                            'rounded-xl border px-2 py-3 text-center text-[11px] font-black',
                            newStudyMinutes === String(minute)
                              ? 'border-[#173A82] bg-[#173A82] text-white'
                              : 'border-[#D9E1F2] bg-white text-[#173A82]'
                          )}
                        >
                          {minute}분
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] font-black text-[#173A82]/55">목표 분량</p>
                    <div className={cn('grid gap-2', isMobile ? 'grid-cols-[minmax(0,0.9fr)_minmax(0,0.75fr)]' : 'grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]')}>
                      <Input
                        type="number"
                        min={0}
                        value={newStudyTargetAmount}
                        onChange={(event) => setNewStudyTargetAmount(event.target.value)}
                        placeholder="수치"
                        className="h-12 rounded-2xl border-[#D9E1F2] bg-white font-bold text-[#173A82] placeholder:text-[#173A82]/35"
                      />
                      <Select value={newStudyAmountUnit} onValueChange={setNewStudyAmountUnit}>
                        <SelectTrigger className="h-12 rounded-2xl border-[#D9E1F2] bg-white font-bold text-[#173A82]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STUDY_AMOUNT_UNIT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {newStudyAmountUnit === '직접입력' ? (
                      <Input
                        value={newStudyCustomAmountUnit}
                        onChange={(event) => setNewStudyCustomAmountUnit(event.target.value)}
                        placeholder="예: 회차, 파트"
                        className="h-11 rounded-2xl border-[#D9E1F2] bg-white font-bold text-[#173A82] placeholder:text-[#173A82]/35"
                      />
                    ) : null}
                    <div className={cn('rounded-[1rem] bg-[#F7FAFF] px-3 py-2', isMobile ? 'flex flex-col items-start gap-2' : 'flex items-center justify-between')}>
                      <p className="text-[11px] font-bold text-[#173A82]/60">예상 시간도 함께 적을까요?</p>
                      <button
                        type="button"
                        onClick={() => setEnableVolumeStudyMinutes(!enableVolumeStudyMinutes)}
                        className={cn(
                          'rounded-full px-3 py-1 text-[10px] font-black',
                          enableVolumeStudyMinutes ? 'bg-[#173A82] text-white' : 'bg-white text-[#173A82]'
                        )}
                      >
                        {enableVolumeStudyMinutes ? '시간 포함' : '시간 생략'}
                      </button>
                    </div>
                    {enableVolumeStudyMinutes ? (
                      <div className={cn('grid gap-2', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
                        {[30, 60, 90, 120].map((minute) => (
                          <button
                            key={minute}
                            type="button"
                            onClick={() => setNewStudyMinutes(String(minute))}
                            className={cn(
                              'rounded-xl border px-2 py-3 text-center text-[11px] font-black',
                              newStudyMinutes === String(minute)
                                ? 'border-[#173A82] bg-[#173A82] text-white'
                                : 'border-[#D9E1F2] bg-white text-[#173A82]'
                            )}
                          >
                            {minute}분
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className={cn('mt-4 rounded-[1rem] bg-[#FFF7EC] px-4 py-3', isMobile ? 'flex flex-col items-stretch gap-3' : 'flex flex-wrap items-center justify-between gap-3')}>
                <div className="min-w-0">
                  <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">AUTO SCHEDULE</p>
                  <p className="mt-1 break-keep text-[12px] font-bold text-[#173A82]">
                    {newStudyMode === 'time' || enableVolumeStudyMinutes
                      ? `${formatClockRange(model.autoSchedulePreview?.startTime, model.autoSchedulePreview?.endTime) || '다음 슬롯 자동 배치'}`
                      : '시간은 필요할 때만 적어도 괜찮아요'}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleSubmitInlineStudyTask}
                  disabled={isSubmitting || !newStudyTask.trim()}
                  className={cn(
                    'h-11 rounded-2xl px-5 font-black text-white shadow-[0_18px_30px_-20px_rgba(23,58,130,0.45)] bg-gradient-to-r',
                    isMobile && 'w-full',
                    rewardGradient
                  )}
                >
                  {isSubmitting ? '저장 중...' : '오늘 계획에 추가'}
                </Button>
              </div>
            </div>
          ) : null}

          <div className={cn('relative mt-4 px-4 pb-4', !isMobile && 'md:px-5 md:pb-5')}>
            <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:repeating-linear-gradient(180deg,transparent_0,transparent_67px,rgba(217,225,242,0.62)_68px)]" />
            <div className="relative space-y-3">
            {orderedChecklistTasks.length === 0 ? (
              <div className="rounded-[1.45rem] border border-dashed border-[#D9E1F2] bg-white/84 px-5 py-7 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EFF5FF] text-[#173A82]">
                  <ListTodo className="h-6 w-6" />
                </div>
                <p className="mt-4 text-lg font-black text-[#173A82]">오늘 할 일을 비워뒀어요</p>
                <p className="mt-2 break-keep text-sm font-semibold leading-6 text-[#173A82]/58">
                  복사하거나 템플릿을 고르면 오늘 체크리스트가 바로 채워져요.
                </p>
                {!isPast ? (
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <ActionChipButton icon={Copy} label="어제 복사" onClick={handleCopyYesterdayPlan} disabled={isSubmitting} />
                    <ActionChipButton icon={Sparkles} label="평일 루틴" onClick={() => applyTemplateToToday(weekdayTemplate)} disabled={isSubmitting} tone="orange" />
                    <ActionChipButton icon={Flame} label="시험기간" onClick={() => applyTemplateToToday(examTemplate)} disabled={isSubmitting} tone="orange" />
                    <ActionChipButton icon={Plus} label="직접 추가" onClick={() => setShowQuickAddCard(true)} disabled={isSubmitting} tone="white" />
                  </div>
                ) : null}
              </div>
              ) : (
                orderedChecklistTasks.map((task: any) => {
                const badge = getChecklistBadge(task, subjectOptions);
                const isVolumeTask = resolveStudyPlanMode(task) === 'volume';
                const durationLabel = task.startTime && task.endTime
                  ? formatClockRange(task.startTime, task.endTime)
                  : task.targetMinutes
                    ? formatDurationLabel(task.targetMinutes)
                    : '오늘 안에';
                const detailLabel = task.category === 'study'
                  ? buildStudyTaskMeta(task)
                  : task.tag || null;
                return (
                  <div key={task.id} className="animate-[planner-fade-rise_0.18s_ease-out]">
                    <PlannerChecklistItem
                      task={task}
                      badgeLabel={badge.label}
                      badgeClassName={badge.className}
                      durationLabel={durationLabel}
                      detailLabel={detailLabel}
                      isVolumeTask={isVolumeTask}
                      isMobile={isMobile}
                      disabled={isPast}
                      expanded={expandedTaskId === task.id}
                      onExpandedChange={(expanded) => setExpandedTaskId(expanded ? task.id : null)}
                      onToggle={() => handleToggleTask(task)}
                      onDelete={() => handleDeleteTask(task)}
                      onCommitActual={(value) => handleCommitStudyActualAmount(task, value)}
                      onUpdateWindow={(startTime, endTime) => handleUpdateStudyWindow(task, startTime, endTime)}
                    />
                  </div>
                );
              })
            )}
            </div>
          </div>

          {completionPercent >= 100 && checklistTasks.length > 0 ? (
            <div className={cn('mx-4 mb-4 rounded-[1.35rem] border border-[#FF7A16]/18 bg-[#FFF7EC] px-4 py-4 text-[#173A82] animate-[planner-fade-rise_0.24s_ease-out]', !isMobile && 'md:mx-5 md:mb-5')}>
              <p className="text-lg font-black tracking-tight">오늘 계획을 다 끝냈어요</p>
              <p className="mt-1 text-sm font-semibold text-[#173A82]/60">포인트와 연속 달성이 바로 반영됐어요.</p>
            </div>
          ) : null}
        </section>

        <Collapsible open={isRoutineSectionOpen} onOpenChange={setIsRoutineSectionOpen}>
          <section className="rounded-[1.9rem] border border-[#D9E1F2] bg-white/92 shadow-[0_24px_48px_-38px_rgba(23,58,130,0.22)]">
            <CollapsibleTrigger asChild>
              <button type="button" className={cn('flex w-full gap-3 p-5 text-left', isMobile ? 'flex-col items-start' : 'items-center justify-between')}>
                <div className="min-w-0">
                  <p className="text-[11px] font-black tracking-[0.18em] text-[#173A82]/42">ROUTINE</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-[#173A82]">루틴 관리</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#173A82]/58">
                    등원, 학원, 식사처럼 반복되는 흐름은 필요할 때만 펼쳐서 정리해요.
                  </p>
                </div>
                <div className={cn('flex items-center gap-3', isMobile && 'w-full justify-between')}>
                  <Badge className="rounded-full border border-[#D9E1F2] bg-white px-3 py-1 text-[10px] font-black text-[#173A82] shadow-none">
                    {routineCountLabel}
                  </Badge>
                  <ChevronDown className={cn('h-5 w-5 text-[#173A82] transition-transform', isRoutineSectionOpen && 'rotate-180')} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className={cn('border-t border-[#D9E1F2] px-4 pb-4', !isMobile && 'px-5 pb-5')}>
              <div className={cn('mt-5 grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]')}>
                <div className="rounded-[1.6rem] border border-[#D9E1F2] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-[#173A82]">오늘 출석 정보</p>
                      <p className="mt-1 text-[12px] font-semibold leading-5 text-[#173A82]/55">
                        등원/하원과 외출 시간을 한 번에 저장해두면 루틴 카드도 자동으로 정리돼요.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isAbsentMode ? (
                        <Badge className="rounded-full border-none bg-[#FFF1E1] px-3 py-1 text-[10px] font-black text-[#FF7A16] shadow-none">
                          오늘 미등원
                        </Badge>
                      ) : null}
                      {hasInPlan && hasOutPlan ? (
                        <Badge className="rounded-full border-none bg-[#ECFDF5] px-3 py-1 text-[10px] font-black text-[#0F766E] shadow-none">
                          출석 계획 저장됨
                        </Badge>
                      ) : null}
                      {hasAwayPlan ? (
                        <Badge className="rounded-full border-none bg-[#FFF7EC] px-3 py-1 text-[10px] font-black text-[#FF7A16] shadow-none">
                          외출 포함
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className={cn('mt-4 grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#173A82]/40">등원 예정</p>
                      <Input type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} disabled={isPast || isSubmitting} className="h-11 rounded-2xl border-[#D9E1F2] font-black text-[#173A82]" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#173A82]/40">하원 예정</p>
                      <Input type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} disabled={isPast || isSubmitting} className="h-11 rounded-2xl border-[#D9E1F2] font-black text-[#173A82]" />
                    </div>
                  </div>

                  <div className={cn('mt-4 grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#173A82]/40">외출 시작</p>
                      <Input type="time" value={awayStartTime} onChange={(e) => setAwayStartTime(e.target.value)} disabled={isPast || isSubmitting} className="h-11 rounded-2xl border-[#D9E1F2] font-black text-[#173A82]" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#173A82]/40">복귀 예정</p>
                      <Input type="time" value={awayEndTime} onChange={(e) => setAwayEndTime(e.target.value)} disabled={isPast || isSubmitting} className="h-11 rounded-2xl border-[#D9E1F2] font-black text-[#173A82]" />
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#173A82]/40">사유</p>
                    <Input
                      value={awayReason}
                      onChange={(e) => setAwayReason(e.target.value)}
                      placeholder="예: 학원, 병원, 저녁 식사"
                      disabled={isPast || isSubmitting}
                      className="h-11 rounded-2xl border-[#D9E1F2] font-bold text-[#173A82] placeholder:text-[#173A82]/35"
                    />
                  </div>

                  {!isPast ? (
                    <div className={cn('mt-4 gap-2', isMobile ? 'grid grid-cols-1' : 'flex flex-wrap')}>
                      <Button type="button" onClick={() => handleSetAttendance('attend')} disabled={isSubmitting} className="h-11 rounded-2xl bg-[#173A82] px-4 font-black text-white">
                        <CalendarCheck2 className="mr-2 h-4 w-4" />
                        오늘 출석 저장
                      </Button>
                      <Button type="button" variant="outline" onClick={() => handleSetAttendance('absent')} disabled={isSubmitting} className="h-11 rounded-2xl border-[#D9E1F2] bg-white px-4 font-black text-[#173A82]">
                        오늘 미등원
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsRoutineCopyDialogOpen(true)} disabled={isSubmitting || !hasCopyableRoutines} className="h-11 rounded-2xl border-[#D9E1F2] bg-white px-4 font-black text-[#173A82]">
                        <Copy className="mr-2 h-4 w-4" />
                        루틴 반복 복사
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  {!isPast ? (
                    <RoutineComposerCard
                      title="생활 루틴 추가"
                      description="등원, 학원, 식사처럼 반복되는 흐름은 짧게 추가해두면 계속 재사용할 수 있어요."
                      value={newRoutineTitle}
                      onValueChange={setNewRoutineTitle}
                      onSubmit={() => handleAddTask(newRoutineTitle, 'schedule')}
                      isSubmitting={isSubmitting}
                      isMobile={isMobile}
                      selectedTemplateKey={selectedRoutineTemplateKey}
                      onTemplateSelect={handleRoutineTemplateSelect}
                      templateOptions={ROUTINE_TEMPLATE_OPTIONS}
                    />
                  ) : null}

                  {routineItems.length === 0 ? (
                    <div className="rounded-[1.5rem] border border-dashed border-[#D9E1F2] bg-[#F7FAFF] p-5 text-center">
                      <p className="text-sm font-black text-[#173A82]">저장된 루틴이 아직 없어요</p>
                      <p className="mt-2 text-[12px] font-semibold leading-5 text-[#173A82]/55">
                        자주 반복되는 흐름은 한 번만 적어두면 다음부터 훨씬 빨라져요.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {routineItems.map((item: any) => (
                        <ScheduleItemCard
                          key={item.id}
                          item={item}
                          onUpdateRange={handleUpdateScheduleRange}
                          onDelete={handleDeleteTask}
                          isPast={isPast}
                          isToday={isToday}
                          isMobile={isMobile}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleContent>
          </section>
        </Collapsible>

        <Collapsible open={isMemoSectionOpen} onOpenChange={setIsMemoSectionOpen}>
          <section className="rounded-[1.9rem] border border-[#D9E1F2] bg-white/92 shadow-[0_24px_48px_-38px_rgba(23,58,130,0.2)]">
            <CollapsibleTrigger asChild>
              <button type="button" className={cn('flex w-full gap-3 p-5 text-left', isMobile ? 'flex-col items-start' : 'items-center justify-between')}>
                <div className="min-w-0">
                  <p className="text-[11px] font-black tracking-[0.18em] text-[#173A82]/42">EXTRA</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-[#173A82]">기타 계획</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#173A82]/58">
                    메모, 준비물, 상담 같은 보조 일정만 따로 모아두고 필요할 때 펼쳐보세요.
                  </p>
                </div>
                <div className={cn('flex items-center gap-3', isMobile && 'w-full justify-between')}>
                  <Badge className="rounded-full border border-[#D9E1F2] bg-white px-3 py-1 text-[10px] font-black text-[#173A82] shadow-none">
                    {personalTasks.length}개
                  </Badge>
                  <ChevronDown className={cn('h-5 w-5 text-[#173A82] transition-transform', isMemoSectionOpen && 'rotate-180')} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className={cn('border-t border-[#D9E1F2] px-4 pb-4', !isMobile && 'px-5 pb-5')}>
              <div className="mt-5 rounded-[1.5rem] border border-[#D9E1F2] bg-[linear-gradient(180deg,#ffffff_0%,#fff7ec_100%)] p-4">
                <div className={cn('flex flex-col gap-3', !isMobile && 'md:flex-row md:items-center')}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-[#173A82]">짧은 메모나 일정 추가</p>
                    <p className="mt-1 text-[12px] font-semibold leading-5 text-[#173A82]/55">
                      병원, 상담, 준비물처럼 보조 일정만 짧게 적어도 오늘 리스트에 바로 들어가요.
                    </p>
                  </div>
                  {!isPast ? (
                    <div className={cn('w-full gap-2', isMobile ? 'flex flex-col' : 'flex md:w-auto md:min-w-[22rem]')}>
                      <Input
                        value={newPersonalTask}
                        onChange={(event) => setNewPersonalTask(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            handleAddTask(newPersonalTask, 'personal');
                          }
                        }}
                        placeholder="예: 상담, 준비물 챙기기"
                        disabled={isSubmitting}
                        className="h-11 flex-1 rounded-2xl border-[#D9E1F2] bg-white font-bold text-[#173A82] placeholder:text-[#173A82]/35"
                      />
                      <Button
                        type="button"
                        onClick={() => handleAddTask(newPersonalTask, 'personal')}
                        disabled={isSubmitting || !newPersonalTask.trim()}
                        className="h-11 rounded-2xl bg-[#FF7A16] px-4 font-black text-white hover:bg-[#FF7A16]/92"
                      >
                        추가
                      </Button>
                    </div>
                  ) : null}
                </div>

                {!isPast ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsTaskCopyDialogOpen(true)}
                      disabled={isSubmitting || !hasCopyableTasks}
                      className="h-10 rounded-2xl border-[#D9E1F2] bg-white px-4 text-[11px] font-black text-[#173A82]"
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      학습/기타 반복 복사
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                {personalTasks.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-[#D9E1F2] bg-[#F7FAFF] p-5 text-center">
                    <p className="text-sm font-black text-[#173A82]">기타 일정은 필요할 때만 적어도 충분해요</p>
                    <p className="mt-2 text-[12px] font-semibold leading-5 text-[#173A82]/55">
                      공부 흐름을 방해하지 않도록, 보조 일정은 간단하게 남기는 구조로 두었어요.
                    </p>
                  </div>
                ) : (
                  personalTasks.map((task: any) => (
                    <PlannerChecklistItem
                      key={task.id}
                      task={task}
                      badgeLabel={task.tag || '메모'}
                      badgeClassName="border border-[#FF7A16]/15 bg-[#FFF7EC] text-[#FF7A16]"
                      durationLabel={task.startTime && task.endTime ? formatClockRange(task.startTime, task.endTime) : '오늘 안에'}
                      detailLabel={task.tag || null}
                      isVolumeTask={false}
                      isMobile={isMobile}
                      disabled={isPast}
                      expanded={expandedTaskId === task.id}
                      onExpandedChange={(expanded) => setExpandedTaskId(expanded ? task.id : null)}
                      onToggle={() => handleToggleTask(task)}
                      onDelete={() => handleDeleteTask(task)}
                      onCommitActual={() => undefined}
                      onUpdateWindow={(startTime, endTime) => handleUpdateStudyWindow(task, startTime, endTime)}
                    />
                  ))
                )}
              </div>
            </CollapsibleContent>
          </section>
        </Collapsible>

        {!isPast ? (
          <Collapsible open={isWrapUpOpen} onOpenChange={setIsWrapUpOpen}>
            <section className="rounded-[1.9rem] border border-[#D9E1F2] bg-white/92 shadow-[0_24px_48px_-38px_rgba(23,58,130,0.18)]">
              <CollapsibleTrigger asChild>
              <button type="button" className={cn('flex w-full gap-3 p-5 text-left', isMobile ? 'flex-col items-start' : 'items-center justify-between')}>
                <div className="min-w-0">
                    <p className="text-[11px] font-black tracking-[0.18em] text-[#173A82]/42">WRAP UP</p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-[#173A82]">하루 정리</h3>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[#173A82]/58">
                      남은 할 일은 내일로 미루거나, 템플릿에 반영하거나, 오늘 안에서 정리할 수 있어요.
                    </p>
                  </div>
                  <div className={cn('flex items-center gap-3', isMobile && 'w-full justify-between')}>
                    <Badge className="rounded-full border border-[#D9E1F2] bg-white px-3 py-1 text-[10px] font-black text-[#173A82] shadow-none">
                      {remainingStudyTasks.length + remainingPersonalTasks.length}개
                    </Badge>
                    <ChevronDown className={cn('h-5 w-5 text-[#173A82] transition-transform', isWrapUpOpen && 'rotate-180')} />
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className={cn('border-t border-[#E3EAF4] px-4 pb-4', !isMobile && 'px-5 pb-5')}>
                {remainingStudyTasks.length + remainingPersonalTasks.length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <ActionChipButton icon={ChevronRight} label="내일로 미루기" onClick={handleMoveUnfinishedToTomorrow} disabled={isSubmitting} />
                    <ActionChipButton icon={BookCopy} label="템플릿 반영" onClick={handleSaveUnfinishedAsTemplate} disabled={isSubmitting} tone="white" />
                    <ActionChipButton icon={StickyNote} label="삭제하기" onClick={handleDeleteUnfinished} disabled={isSubmitting} tone="orange" />
                  </div>
                ) : (
                  <div className="mt-5 rounded-[1.35rem] border border-dashed border-[#D9E1F2] bg-[#F7FAFF] p-5 text-center">
                    <p className="text-sm font-black text-[#173A82]">오늘 정리할 남은 항목이 없어요</p>
                    <p className="mt-2 text-[12px] font-semibold leading-5 text-[#173A82]/55">
                      체크리스트가 깔끔하게 정리되면 내일 계획도 훨씬 가벼워져요.
                    </p>
                  </div>
                )}
              </CollapsibleContent>
            </section>
          </Collapsible>
        ) : null}
      </div>

      <StudyPlanSheet
        open={isStudyPlanSheetOpen}
        onOpenChange={setIsStudyPlanSheetOpen}
        isMobile={isMobile}
        isSubmitting={isSubmitting}
        isPast={isPast}
        selectedDateLabel={selectedDateLabel}
        totalCount={studyTasks.length}
        completedCount={completedStudyCount}
        remainingCount={Math.max(0, studyTasks.length - completedStudyCount)}
        goalSummaryLabel={studyGoalSummaryLabel}
        subjectOptions={subjectOptions}
        subjectValue={newStudySubject}
        onSubjectChange={setNewStudySubject}
        minuteValue={newStudyMinutes}
        onMinuteChange={setNewStudyMinutes}
        taskValue={newStudyTask}
        onTaskChange={setNewStudyTask}
        studyModeValue={newStudyMode}
        onStudyModeChange={setNewStudyMode}
        amountValue={newStudyTargetAmount}
        onAmountChange={setNewStudyTargetAmount}
        amountUnitValue={newStudyAmountUnit}
        onAmountUnitChange={setNewStudyAmountUnit}
        customAmountUnitValue={newStudyCustomAmountUnit}
        onCustomAmountUnitChange={setNewStudyCustomAmountUnit}
        enableVolumeMinutes={enableVolumeStudyMinutes}
        onEnableVolumeMinutesChange={setEnableVolumeStudyMinutes}
        onSubmit={handleSubmitInlineStudyTask}
        isRecentLoading={isRecentStudyLoading}
        recentOptions={recentStudyOptions}
        onPrefillRecent={handlePrefillRecentStudy}
        onOpenRecentSheet={() => setIsRecentStudySheetOpen(true)}
        activeRecentTitle={activeRecentStudyOption?.title || null}
        onResetRecentPrefill={resetStudyComposerPrefill}
        studyTasks={studyTasks}
        onToggleTask={handleToggleTask}
        onDeleteTask={handleDeleteTask}
        onCommitActual={handleCommitStudyActualAmount}
      />

      <PlannerTemplateSheet
        open={isTemplateSheetOpen}
        onOpenChange={setIsTemplateSheetOpen}
        isMobile={isMobile}
        currentTaskCount={studyTasks.length + personalTasks.length}
        templateName={templateNameDraft}
        onTemplateNameChange={setTemplateNameDraft}
        onSaveCurrent={saveCurrentPlanTemplate}
        isSaving={isSubmitting}
        editingTemplateId={editingTemplateId}
        onCancelEditing={() => {
          setEditingTemplateId(null);
          setTemplateNameDraft('');
        }}
        recentTemplates={recentTemplates}
        builtinTemplates={BUILTIN_PLANNER_TEMPLATES}
        customTemplates={customTemplates}
        onApplyTemplate={applyTemplateToToday}
        onStartEditing={startEditingTemplate}
        onDeleteTemplate={deleteTemplate}
      />

      <RecentStudySheet
        open={isRecentStudySheetOpen}
        onOpenChange={setIsRecentStudySheetOpen}
        items={recentStudyOptions}
        onPrefill={handlePrefillRecentStudy}
        onQuickAdd={handleQuickAddRecentStudy}
        isSubmitting={isSubmitting}
        isMobile={isMobile}
      />

      <RepeatCopySheet
        open={isTaskCopyDialogOpen}
        onOpenChange={setIsTaskCopyDialogOpen}
        title="계획 반복 복사"
        description="선택한 학습 계획과 메모를 같은 요일 라인으로 몇 주간 복사해요."
        itemLabel="복사할 계획"
        weeksValue={taskCopyWeeks}
        onWeeksChange={setTaskCopyWeeks}
        selectedDays={taskCopyDays}
        onToggleDay={(day, checked) => toggleCopyDay('task', day, checked)}
        itemOptions={taskCopyOptions}
        selectedItemIds={taskCopyItemIds}
        onToggleItem={(id, checked) => toggleCopyItem('task', id, checked)}
        onSelectAllItems={() => setTaskCopyItemIds(taskCopyOptions.map((item: any) => item.id))}
        onClearItems={() => setTaskCopyItemIds([])}
        onConfirm={handleApplyTasksToAllWeekdays}
        isSubmitting={isSubmitting}
        isMobile={isMobile}
        weekdayOptions={LOCAL_WEEKDAY_OPTIONS}
      />

      <RepeatCopySheet
        open={isRoutineCopyDialogOpen}
        onOpenChange={setIsRoutineCopyDialogOpen}
        title="루틴 반복 복사"
        description="출석과 생활 루틴을 같은 요일 흐름으로 몇 주간 이어붙여요."
        itemLabel="복사할 루틴"
        weeksValue={routineCopyWeeks}
        onWeeksChange={setRoutineCopyWeeks}
        selectedDays={routineCopyDays}
        onToggleDay={(day, checked) => toggleCopyDay('routine', day, checked)}
        itemOptions={routineCopyOptions}
        selectedItemIds={routineCopyItemIds}
        onToggleItem={(id, checked) => toggleCopyItem('routine', id, checked)}
        onSelectAllItems={() => setRoutineCopyItemIds(routineCopyOptions.map((item: any) => item.id))}
        onClearItems={() => setRoutineCopyItemIds([])}
        onConfirm={handleApplyRoutineToAllWeekdays}
        isSubmitting={isSubmitting}
        isMobile={isMobile}
        weekdayOptions={LOCAL_WEEKDAY_OPTIONS}
      />
    </>
  );
}
