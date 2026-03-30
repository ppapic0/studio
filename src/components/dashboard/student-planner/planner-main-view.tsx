'use client';

import { format, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  BookCopy,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Flame,
  Layers3,
  ListTodo,
  Plus,
  Star,
  StickyNote,
  Target,
  Trophy,
  Zap,
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

function SummaryMetric({
  icon: Icon,
  label,
  value,
  accent = 'navy',
  valueClassName,
}: {
  icon: any;
  label: string;
  value: string;
  accent?: 'navy' | 'orange' | 'blue';
  valueClassName?: string;
}) {
  const accentClass =
    accent === 'orange'
      ? 'bg-[#FFF1E1] text-[#FF7A16]'
      : accent === 'blue'
        ? 'bg-[#EFF5FF] text-[#173A82]'
        : 'bg-[#173A82] text-white';

  return (
    <div className="rounded-[1.35rem] border border-[#D9E1F2] bg-white/90 p-3 shadow-[0_18px_30px_-28px_rgba(23,58,130,0.18)]">
      <div className="flex items-center gap-2 text-[11px] font-black text-[#173A82]/72">
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-2xl', accentClass)}>
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </div>
      <p className={cn('mt-3 text-2xl font-black tracking-tight text-[#173A82]', valueClassName)}>{value}</p>
    </div>
  );
}

function QuickStartButton({
  icon: Icon,
  title,
  hint,
  onClick,
  disabled,
  accent = 'navy',
}: {
  icon: any;
  title: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: 'navy' | 'orange' | 'mint';
}) {
  const accentClass =
    accent === 'orange'
      ? 'bg-[#FFF1E1] text-[#FF7A16]'
      : accent === 'mint'
        ? 'bg-[#ECFDF5] text-[#0F766E]'
        : 'bg-[#EFF5FF] text-[#173A82]';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex min-h-[6.2rem] flex-col items-start rounded-[1.35rem] border border-[#D9E1F2] bg-white/90 p-3 text-left shadow-[0_18px_30px_-28px_rgba(23,58,130,0.16)] transition-all',
        disabled
          ? 'cursor-not-allowed opacity-55'
          : 'hover:-translate-y-0.5 hover:border-[#173A82]/20 hover:shadow-[0_20px_40px_-30px_rgba(23,58,130,0.24)]'
      )}
    >
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-2xl', accentClass)}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 text-sm font-black tracking-tight text-[#173A82]">{title}</p>
      <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-[#173A82]/58">{hint}</p>
    </button>
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
    completedPersonalCount,
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
    latestRecentTemplate,
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
  const checklistRemainingCount = checklistTasks.length - completedChecklistCount;
  const completionPercent = Math.round(completionRate * 100);
  const pointPercent = Math.min(100, Math.max(0, planTrackPointTotal));
  const quickRecentItems = recentStudyOptions.slice(0, isMobile ? 2 : 3);

  const heroStatus = checklistTasks.length === 0
    ? '빠른 시작'
    : completionPercent >= 100
      ? '오늘 계획 완료'
      : completedChecklistCount > 0
        ? '진행 중'
        : '시작 전';

  return (
    <>
      <div className={cn('mx-auto flex w-full max-w-5xl flex-col pb-24', isMobile ? 'gap-4 px-3' : 'gap-8 px-4')}>
        <header className="space-y-4 pt-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Badge className="rounded-full border border-[#D9E1F2] bg-white px-3 py-1 text-[10px] font-black text-[#173A82] shadow-none">
                오늘 해야 할 것
              </Badge>
              <h1 className={cn('mt-3 font-black tracking-tight text-[#173A82]', isMobile ? 'text-[1.95rem]' : 'text-[2.8rem]')}>
                {selectedDateLabel}
              </h1>
              <p className="mt-2 break-keep text-sm font-semibold leading-6 text-[#173A82]/66">
                폼을 길게 채우지 않아도 돼요. 복사하고, 고르고, 체크하면서 오늘 계획을 가볍게 완성해요.
              </p>
            </div>
            {!isPast ? (
              <Button
                type="button"
                onClick={() => setIsTemplateSheetOpen(true)}
                className="h-11 rounded-2xl bg-[#173A82] px-4 text-sm font-black text-white shadow-[0_18px_32px_-22px_rgba(23,58,130,0.55)] hover:bg-[#173A82]/95"
              >
                <BookCopy className="mr-2 h-4 w-4" />
                템플릿
              </Button>
            ) : null}
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

        <section className="relative overflow-hidden rounded-[2rem] border border-[#D9E1F2] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_60%,#fff7ec_100%)] p-5 shadow-[0_28px_60px_-44px_rgba(23,58,130,0.35)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,122,22,0.16),transparent_34%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(217,225,242,0.46),transparent_36%)]" />
          <div className="relative flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge className="rounded-full border border-[#FF7A16]/15 bg-[#FFF7EC] px-3 py-1 text-[10px] font-black text-[#FF7A16] shadow-none">
                    {heroStatus}
                  </Badge>
                  {todayStreakDays > 0 ? (
                    <Badge className="rounded-full border border-[#D9E1F2] bg-white px-3 py-1 text-[10px] font-black text-[#173A82] shadow-none">
                      <Flame className="mr-1 h-3 w-3 text-[#FF7A16]" />
                      {todayStreakDays}일 연속
                    </Badge>
                  ) : null}
                </div>
                <h2 className={cn('mt-3 font-black tracking-tight text-[#173A82]', isMobile ? 'text-2xl' : 'text-[2.2rem]')}>
                  {checklistTasks.length === 0 ? '빠르게 오늘 계획 시작하기' : '종이 플래너처럼 가볍게 체크해요'}
                </h2>
                <p className="mt-2 max-w-2xl break-keep text-sm font-semibold leading-6 text-[#173A82]/62">
                  오늘 해야 할 것만 먼저 보여주고, 완료할 때마다 포인트와 게이지가 바로 반응하도록 정리했어요.
                </p>
              </div>

              <div className={cn('grid gap-3', isMobile ? 'w-full grid-cols-3' : 'min-w-[18rem] grid-cols-3')}>
                <SummaryMetric icon={Zap} label="오늘 포인트" value={todayPointGaugeLabel} accent="orange" />
                <SummaryMetric icon={Target} label="완료율" value={todayCompletionLabel} accent="navy" />
                <SummaryMetric icon={CalendarCheck2} label="연속 달성" value={`${todayStreakDays}일`} accent="blue" />
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[1.7rem] bg-[#173A82] px-4 py-4 text-white shadow-[0_22px_40px_-30px_rgba(23,58,130,0.68)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,122,22,0.22),transparent_35%)]" />
              <div className="relative space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black tracking-[0.18em] text-white/62">TODAY SCORE</p>
                    <p className="mt-1 text-2xl font-black tracking-tight">{Math.min(planTrackPointTotal, 100)} / 100</p>
                  </div>
                  <div className="rounded-[1rem] bg-white/10 px-3 py-2 text-right">
                    <p className="text-[10px] font-black tracking-[0.18em] text-white/55">남은 체크</p>
                    <p className="mt-1 text-lg font-black">{checklistRemainingCount}개</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-[11px] font-black text-white/70">
                      <span>오늘 포인트 게이지</span>
                      <span>{Math.min(planTrackPointTotal, 100)} / 100</span>
                    </div>
                    <div className="rounded-full bg-white/12 p-1">
                      <Progress value={pointPercent} className="h-3 bg-transparent [&>div]:bg-[linear-gradient(90deg,#FFD089_0%,#FFB357_45%,#FF7A16_100%)]" />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-[11px] font-black text-white/70">
                      <span>오늘 계획 완료율</span>
                      <span>{completionPercent}%</span>
                    </div>
                    <div className="rounded-full bg-white/12 p-1">
                      <Progress value={completionPercent} className="h-3 bg-transparent [&>div]:bg-[linear-gradient(90deg,#D9E1F2_0%,#9EB4E8_100%)]" />
                    </div>
                  </div>
                </div>

                {floatingPointBursts.map((burst: { id: number; label: string }, index: number) => (
                  <div
                    key={burst.id}
                    className="absolute right-4 top-4 rounded-full bg-[#FFF7EC] px-3 py-1 text-xs font-black text-[#FF7A16] shadow-[0_12px_24px_-18px_rgba(255,122,22,0.85)] animate-[planner-point-burst_0.95s_ease-out_forwards]"
                    style={{ marginTop: `${index * 6}px` }}
                  >
                    {burst.label}P
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {!isPast ? (
          <section className="rounded-[1.85rem] border border-[#D9E1F2] bg-white/92 p-5 shadow-[0_22px_40px_-34px_rgba(23,58,130,0.2)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge className="rounded-full border border-[#D9E1F2] bg-[#F5F8FF] px-3 py-1 text-[10px] font-black text-[#173A82] shadow-none">
                  빠른 시작
                </Badge>
                <h3 className="mt-3 text-xl font-black tracking-tight text-[#173A82]">입력보다 복사와 선택</h3>
                <p className="mt-2 break-keep text-[13px] font-semibold leading-6 text-[#173A82]/60">
                  어제 계획, 자주 쓰는 루틴, 최근 템플릿을 눌러 오늘 계획을 바로 채워보세요.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTemplateSheetOpen(true)}
                className="h-11 rounded-2xl border-[#D9E1F2] bg-white px-4 font-black text-[#173A82] hover:bg-[#F7FAFF]"
              >
                <Layers3 className="mr-2 h-4 w-4" />
                템플릿 보관함
              </Button>
            </div>

            <div className={cn('mt-5 grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-5')}>
              <QuickStartButton
                icon={Copy}
                title="어제 복사"
                hint="전날 계획 그대로 시작"
                onClick={handleCopyYesterdayPlan}
                disabled={isSubmitting}
              />
              <QuickStartButton
                icon={CalendarDays}
                title="평일 루틴"
                hint="학교 끝난 뒤 기본 흐름"
                onClick={() => applyTemplateToToday(weekdayTemplate)}
                disabled={isSubmitting}
                accent="mint"
              />
              <QuickStartButton
                icon={Flame}
                title="시험기간"
                hint="짧고 밀도 높은 플랜"
                onClick={() => applyTemplateToToday(examTemplate)}
                disabled={isSubmitting}
                accent="orange"
              />
              <QuickStartButton
                icon={Star}
                title="최근 템플릿"
                hint={latestRecentTemplate ? latestRecentTemplate.name : '최근 사용 템플릿 보기'}
                onClick={() => latestRecentTemplate ? applyTemplateToToday(latestRecentTemplate) : setIsTemplateSheetOpen(true)}
                disabled={isSubmitting}
              />
              <QuickStartButton
                icon={Plus}
                title="새로 만들기"
                hint="비워두고 오늘만 직접 구성"
                onClick={async () => {
                  await clearTodayPlans();
                  setShowQuickAddCard(true);
                }}
                disabled={isSubmitting}
                accent="orange"
              />
            </div>
          </section>
        ) : null}

        <section className="rounded-[2rem] border border-[#D9E1F2] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,247,236,0.74)_100%)] p-5 shadow-[0_28px_50px_-38px_rgba(23,58,130,0.24)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Badge className="rounded-full border border-[#D9E1F2] bg-white px-3 py-1 text-[10px] font-black text-[#173A82] shadow-none">
                오늘 계획
              </Badge>
              <h3 className="mt-3 text-[1.6rem] font-black tracking-tight text-[#173A82]">종이 투두리스트처럼 체크해요</h3>
              <p className="mt-2 break-keep text-sm font-semibold leading-6 text-[#173A82]/62">
                처음에는 단순하게 보이고, 필요한 항목만 눌러서 자세히 열리도록 정리했어요.
              </p>
            </div>
            <div className={cn('grid gap-2', isMobile ? 'w-full grid-cols-2' : 'grid-cols-4')}>
              <SummaryMetric icon={CheckCircle2} label="완료" value={`${completedChecklistCount}개`} accent="orange" />
              <SummaryMetric icon={BookOpen} label="학습" value={`${completedStudyCount}/${studyTasks.length}`} accent="navy" />
              <SummaryMetric icon={StickyNote} label="기타" value={`${completedPersonalCount}/${personalTasks.length}`} accent="blue" />
              <SummaryMetric icon={Clock3} label="예상" value={studyGoalSummaryLabel} accent="orange" valueClassName="text-base leading-6 break-keep" />
            </div>
          </div>

          {!isPast ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => setShowQuickAddCard((prev: boolean) => !prev)}
                className="h-11 rounded-2xl bg-[#173A82] px-4 font-black text-white shadow-[0_18px_32px_-22px_rgba(23,58,130,0.46)] hover:bg-[#173A82]/95"
              >
                <Plus className="mr-2 h-4 w-4" />
                + 할 일 추가
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsStudyPlanSheetOpen(true)}
                className="h-11 rounded-2xl border-[#D9E1F2] bg-white px-4 font-black text-[#173A82] hover:bg-[#F7FAFF]"
              >
                <BookOpen className="mr-2 h-4 w-4" />
                학습 계획 수정
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTemplateSheetOpen(true)}
                className="h-11 rounded-2xl border-[#D9E1F2] bg-white px-4 font-black text-[#173A82] hover:bg-[#F7FAFF]"
              >
                <Layers3 className="mr-2 h-4 w-4" />
                템플릿 저장/불러오기
              </Button>
            </div>
          ) : null}

          {showQuickAddCard && !isPast ? (
            <div className="mt-5 rounded-[1.7rem] border border-[#D9E1F2] bg-white/92 p-4 shadow-[0_20px_40px_-34px_rgba(23,58,130,0.18)] animate-[planner-fade-rise_0.22s_ease-out]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#173A82]">빠르게 할 일 추가</p>
                  <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-[#173A82]/55">
                    과목과 시간만 고르면 자동으로 시간표처럼 이어 붙어요.
                  </p>
                </div>
                {activeRecentStudyOption ? (
                  <button
                    type="button"
                    onClick={resetStudyComposerPrefill}
                    className="rounded-full bg-[#FFF7EC] px-3 py-1 text-[10px] font-black text-[#FF7A16]"
                  >
                    불러온 계획 해제
                  </button>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
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
                    className="h-9 rounded-full border-[#D9E1F2] bg-white px-3 text-[11px] font-black text-[#173A82] hover:bg-[#F7FAFF]"
                  >
                    {suggestion.label}
                  </Button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {quickRecentItems.map((item: any) => (
                  <button
                    type="button"
                    key={item.key}
                    onClick={() => handlePrefillRecentStudy(item)}
                    className="rounded-full border border-[#D9E1F2] bg-[#F5F8FF] px-3 py-1.5 text-[11px] font-black text-[#173A82]"
                  >
                    최근 · {item.title}
                  </button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsRecentStudySheetOpen(true)}
                  className="h-9 rounded-full px-3 text-[11px] font-black text-[#173A82]/70 hover:bg-[#F3F7FF]"
                >
                  {isRecentStudyLoading ? '불러오는 중...' : '최근 기록 더보기'}
                </Button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
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
                      <p className={cn('mt-1 text-[11px] font-semibold', newStudyMode === 'time' ? 'text-white/75' : 'text-[#173A82]/60')}>
                        예: 1시간 집중
                      </p>
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
                      <p className="mt-1 text-[11px] font-semibold text-[#173A82]/60">
                        예: 30문제, 2지문
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
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
                    <div className="grid grid-cols-4 gap-2">
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
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] gap-2">
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
                    <div className="flex items-center justify-between rounded-[1rem] bg-[#F7FAFF] px-3 py-2">
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
                      <div className="grid grid-cols-4 gap-2">
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

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1rem] bg-[#FFF7EC] px-4 py-3">
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
                    rewardGradient
                  )}
                >
                  {isSubmitting ? '저장 중...' : '오늘 계획에 추가'}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {orderedChecklistTasks.length === 0 ? (
              <div className="rounded-[1.8rem] border border-dashed border-[#D9E1F2] bg-white/80 p-7 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EFF5FF] text-[#173A82]">
                  <ListTodo className="h-6 w-6" />
                </div>
                <p className="mt-4 text-lg font-black text-[#173A82]">오늘 계획이 비어 있어요</p>
                <p className="mt-2 break-keep text-sm font-semibold leading-6 text-[#173A82]/58">
                  위 빠른 시작 버튼으로 어제 계획을 복사하거나, 템플릿을 불러와서 바로 시작해보세요.
                </p>
                {!isPast ? (
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      onClick={() => applyTemplateToToday(weekdayTemplate)}
                      className="h-11 rounded-2xl bg-[#173A82] px-4 font-black text-white"
                    >
                      평일 루틴 적용
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowQuickAddCard(true)}
                      className="h-11 rounded-2xl border-[#D9E1F2] bg-white px-4 font-black text-[#173A82]"
                    >
                      직접 한 개 추가
                    </Button>
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

          {completionPercent >= 100 && checklistTasks.length > 0 ? (
            <div className="mt-5 rounded-[1.6rem] border border-[#FF7A16]/18 bg-[linear-gradient(135deg,#FFF7EC_0%,#FFFFFF_100%)] p-4 animate-[planner-fade-rise_0.24s_ease-out]">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#173A82] text-white">
                  <Trophy className="h-5 w-5 text-[#FFD089]" />
                </div>
                <div>
                  <p className="text-lg font-black tracking-tight text-[#173A82]">오늘 계획을 모두 끝냈어요</p>
                  <p className="mt-1 break-keep text-[13px] font-semibold leading-6 text-[#173A82]/62">
                    오늘 포인트와 연속 달성이 반영됐어요. 필요하면 내일용 템플릿으로 바로 저장할 수 있어요.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <Collapsible open={isRoutineSectionOpen} onOpenChange={setIsRoutineSectionOpen}>
          <section className="rounded-[1.9rem] border border-[#D9E1F2] bg-white/92 shadow-[0_24px_48px_-38px_rgba(23,58,130,0.22)]">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-center justify-between gap-3 p-5 text-left">
                <div>
                  <Badge className="rounded-full border border-[#D9E1F2] bg-[#F5F8FF] px-3 py-1 text-[10px] font-black text-[#173A82] shadow-none">
                    루틴 관리
                  </Badge>
                  <h3 className="mt-3 text-xl font-black tracking-tight text-[#173A82]">출석과 반복 루틴은 접어두기</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#173A82]/58">
                    기본 화면은 오늘 계획만 보고, 루틴은 필요할 때만 펼쳐서 정리해요.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="rounded-full border border-[#D9E1F2] bg-white px-3 py-1 text-[10px] font-black text-[#173A82] shadow-none">
                    {routineCountLabel}
                  </Badge>
                  <ChevronDown className={cn('h-5 w-5 text-[#173A82] transition-transform', isRoutineSectionOpen && 'rotate-180')} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-[#D9E1F2] px-5 pb-5">
              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
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

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#173A82]/40">등원 예정</p>
                      <Input type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} disabled={isPast || isSubmitting} className="h-11 rounded-2xl border-[#D9E1F2] font-black text-[#173A82]" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#173A82]/40">하원 예정</p>
                      <Input type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} disabled={isPast || isSubmitting} className="h-11 rounded-2xl border-[#D9E1F2] font-black text-[#173A82]" />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
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
                    <div className="mt-4 flex flex-wrap gap-2">
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
              <button type="button" className="flex w-full items-center justify-between gap-3 p-5 text-left">
                <div>
                  <Badge className="rounded-full border border-[#FF7A16]/15 bg-[#FFF7EC] px-3 py-1 text-[10px] font-black text-[#FF7A16] shadow-none">
                    기타 계획 / 메모
                  </Badge>
                  <h3 className="mt-3 text-xl font-black tracking-tight text-[#173A82]">보조 일정은 접어서 관리하기</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#173A82]/58">
                    메모, 준비물, 상담 같은 보조 일정은 필요할 때만 펼쳐서 정리해요.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="rounded-full border border-[#D9E1F2] bg-white px-3 py-1 text-[10px] font-black text-[#173A82] shadow-none">
                    {personalTasks.length}개
                  </Badge>
                  <ChevronDown className={cn('h-5 w-5 text-[#173A82] transition-transform', isMemoSectionOpen && 'rotate-180')} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-[#D9E1F2] px-5 pb-5">
              <div className="mt-5 rounded-[1.5rem] border border-[#D9E1F2] bg-[linear-gradient(180deg,#ffffff_0%,#fff7ec_100%)] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-[#173A82]">짧은 메모나 일정 추가</p>
                    <p className="mt-1 text-[12px] font-semibold leading-5 text-[#173A82]/55">
                      병원, 상담, 준비물처럼 보조 일정만 짧게 적어도 오늘 리스트에 바로 들어가요.
                    </p>
                  </div>
                  {!isPast ? (
                    <div className="flex w-full gap-2 md:w-auto md:min-w-[22rem]">
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

        {!isPast && (remainingStudyTasks.length + remainingPersonalTasks.length > 0) ? (
          <section className="rounded-[1.85rem] border border-[#FF7A16]/16 bg-[linear-gradient(180deg,#FFF7EC_0%,#FFFFFF_100%)] p-5 shadow-[0_18px_36px_-32px_rgba(255,122,22,0.18)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge className="rounded-full border border-[#FF7A16]/15 bg-white px-3 py-1 text-[10px] font-black text-[#FF7A16] shadow-none">
                  하루 정리
                </Badge>
                <h3 className="mt-3 text-xl font-black tracking-tight text-[#173A82]">남은 할 일 정리하기</h3>
                <p className="mt-2 break-keep text-sm font-semibold leading-6 text-[#173A82]/58">
                  미완료 항목은 내일로 미루거나, 템플릿으로 저장하거나, 오늘 계획에서 바로 정리할 수 있어요.
                </p>
              </div>
              <Badge className="rounded-full border border-[#D9E1F2] bg-white px-3 py-1 text-[10px] font-black text-[#173A82] shadow-none">
                {remainingStudyTasks.length + remainingPersonalTasks.length}개 남음
              </Badge>
            </div>

            <div className={cn('mt-5 grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
              <QuickStartButton icon={ChevronRight} title="내일로 미루기" hint="남은 계획을 그대로 이어서" onClick={handleMoveUnfinishedToTomorrow} disabled={isSubmitting} accent="navy" />
              <QuickStartButton icon={BookCopy} title="템플릿 반영" hint="이번 주 기본 템플릿으로 저장" onClick={handleSaveUnfinishedAsTemplate} disabled={isSubmitting} accent="mint" />
              <QuickStartButton icon={StickyNote} title="삭제하기" hint="오늘 계획에서 깔끔하게 정리" onClick={handleDeleteUnfinished} disabled={isSubmitting} accent="orange" />
            </div>
          </section>
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
