'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ArrowRight,
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
  Sparkles,
  StickyNote,
  Target,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  addMinutesToClock,
  BUILTIN_PLANNER_TEMPLATES,
  formatClockRange,
  formatDurationLabel,
  getNextAutoWindow,
  PLAN_DEFAULT_START_TIME,
  PLANNER_QUICK_TASK_SUGGESTIONS,
  timeToMinutes,
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

const QUEST_END_OPTIONS = ['21:00', '22:00', '23:00'];
const QUICK_STUDY_TYPES = ['문제풀이', '인강', '복습', '오답', '암기', '테스트'];
const QUICK_TIME_PRESETS = [30, 50, 80, 100];
const OUTING_REASON_OPTIONS = ['식사', '학원', '화장실', '기타'];
const OUTING_DURATION_OPTIONS = ['10', '20', '30', '45'];

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
  return task.targetMinutes ? `${task.targetMinutes}분 집중 목표` : '시간 자유';
}

function getChecklistBadge(task: any, subjectOptions: any[]) {
  if (task.category === 'personal') {
    return {
      label: task.tag || '메모',
      className: 'border border-[#FF9626]/15 bg-[#FFF5E8] text-[#FF9626]',
    };
  }

  const subject = subjectOptions.find((item) => item.id === (task.subject || 'etc'));
  return {
    label: `${subject?.label || '기타'} · ${resolveStudyPlanMode(task) === 'volume' ? '분량형' : '시간형'}`,
    className: 'border border-[#DDE7F6] bg-[#F6F8FC] text-[#17326B]',
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
      ? 'border-[#FF9626]/18 bg-[#FFF4E8] text-[#FF9626] hover:bg-[#FFE9CF]'
      : tone === 'white'
        ? 'border-[#DDE7F6] bg-white text-[#17326B] hover:bg-[#F8FBFF]'
        : 'border-[#17326B]/10 bg-[#17326B] text-white hover:bg-[#1E4087]';

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={cn('h-10 rounded-full px-4 text-xs font-black shadow-none', toneClass)}
    >
      <Icon className="mr-2 h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

function formatMinutesShort(minutes: number) {
  if (!minutes) return '0분';
  const hour = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hour && remainder) return `${hour}시간 ${remainder}분`;
  if (hour) return `${hour}시간`;
  return `${remainder}분`;
}

function estimateTaskReward(task: any) {
  let reward = 3;
  if ((task.targetMinutes || 0) >= 60) reward += 5;
  if (task.priority === 'high') reward += 2;
  return reward;
}

function createClockFromNow() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function computeTimeProgressPercent(task: any, isToday: boolean) {
  if (!isToday || task.done || !task.startTime || !task.endTime) return 0;
  const start = timeToMinutes(task.startTime);
  const end = timeToMinutes(task.endTime);
  const now = new Date();
  const current = (now.getHours() * 60) + now.getMinutes();
  if (end <= start || current <= start) return 0;
  if (current >= end) return 100;
  return Math.round(((current - start) / (end - start)) * 100);
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
    completionRate,
    todayPointGaugeLabel,
    todayCompletionLabel,
    todayStreakDays,
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
  const completionPercent = Math.round(completionRate * 100);
  const pointGaugeParts = todayPointGaugeLabel.split('/').map((part: string) => Number(part.trim()));
  const todayPointTotal = Number.isFinite(pointGaugeParts[0]) ? pointGaugeParts[0] : 0;
  const dailyPointCap = Number.isFinite(pointGaugeParts[1]) ? pointGaugeParts[1] : 100;
  const pointPercent = Math.min(100, Math.max(0, Math.round((todayPointTotal / Math.max(1, dailyPointCap)) * 100)));
  const quickRecentItems = recentStudyOptions.slice(0, isMobile ? 2 : 3);
  const plannedStudyMinutes = useMemo(
    () => studyTasks.reduce((sum: number, task: any) => sum + Math.max(0, task.targetMinutes || 0), 0),
    [studyTasks]
  );
  const actualStudyMinutes = useMemo(
    () => studyTasks.reduce((sum: number, task: any) => sum + (task.done ? Math.max(0, task.targetMinutes || 0) : 0), 0),
    [studyTasks]
  );
  const outingCount = useMemo(
    () => scheduleItems.filter((item: any) => String(item.title || '').startsWith('외출 예정')).length,
    [scheduleItems]
  );
  const subjectBalance = useMemo(() => {
    const totals = studyTasks.reduce((acc: Record<string, number>, task: any) => {
      const key = task.subject || 'etc';
      const minutes = Math.max(0, Number(task.targetMinutes || 0)) || (resolveStudyPlanMode(task) === 'volume' ? 30 : 0);
      acc[key] = (acc[key] || 0) + minutes;
      return acc;
    }, {});
    const totalMinutes = Object.values(totals).reduce((sum, value) => sum + value, 0);
    return Object.entries(totals)
      .map(([subjectKey, minutes]) => {
        const subject = subjectOptions.find((item: any) => item.id === subjectKey);
        const percent = totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0;
        return { key: subjectKey, label: subject?.label || '기타', minutes, percent };
      })
      .sort((left, right) => right.minutes - left.minutes);
  }, [studyTasks, subjectOptions]);

  const [isWrapUpOpen, setIsWrapUpOpen] = useState(false);
  const [isOutingModalOpen, setIsOutingModalOpen] = useState(false);
  const [questEndTimeChoice, setQuestEndTimeChoice] = useState(outTime || '22:00');
  const [questFocusSubjects, setQuestFocusSubjects] = useState<string[]>(newStudySubject ? [newStudySubject] : []);
  const [questMissionId, setQuestMissionId] = useState(PLANNER_QUICK_TASK_SUGGESTIONS[0]?.id || 'math-problem');
  const [quickStudyType, setQuickStudyType] = useState(QUICK_STUDY_TYPES[0]);
  const [outingDuration, setOutingDuration] = useState('20');

  useEffect(() => {
    setQuestEndTimeChoice(outTime || '22:00');
  }, [outTime]);

  useEffect(() => {
    if (questFocusSubjects.length === 0 && subjectBalance.length > 0) {
      setQuestFocusSubjects(subjectBalance.slice(0, 2).map((item) => item.key));
    }
  }, [questFocusSubjects.length, subjectBalance]);

  const missionSuggestion = useMemo(
    () => PLANNER_QUICK_TASK_SUGGESTIONS.find((item) => item.id === questMissionId),
    [questMissionId]
  );

  const recentTemplateCandidate = latestRecentTemplate || recentTemplates[0] || null;
  const resolvedSubjectValue = newStudySubject || questFocusSubjects[0] || missionSuggestion?.subject || 'etc';
  const resolvedSubjectLabel = subjectOptions.find((item: any) => item.id === resolvedSubjectValue)?.label || '기타';
  const resolvedTargetMinutes = Math.max(0, Number(newStudyMinutes) || missionSuggestion?.targetMinutes || 50);
  const resolvedWindowPreview = useMemo(() => {
    if (!(newStudyMode === 'time' || enableVolumeStudyMinutes) || resolvedTargetMinutes <= 0) return null;
    return getNextAutoWindow(studyTasks, resolvedTargetMinutes, PLAN_DEFAULT_START_TIME);
  }, [enableVolumeStudyMinutes, newStudyMode, resolvedTargetMinutes, studyTasks]);

  const questFocusSummary = questFocusSubjects.length > 0
    ? questFocusSubjects
      .map((subjectId) => subjectOptions.find((item: any) => item.id === subjectId)?.label || '기타')
      .join(' · ')
    : '메인 과목 2개를 골라주세요';

  const subjectBalanceFeedback = useMemo(() => {
    if (subjectBalance.length === 0) return '아직 과목 비중이 없어요. 오늘의 메인 과목부터 골라볼까요?';
    const [topSubject, nextSubject] = subjectBalance;
    if ((topSubject?.percent || 0) >= 55) return `${topSubject.label} 비중이 높아요. ${nextSubject?.label || '다른 과목'}를 조금 섞어보세요.`;
    if ((topSubject?.percent || 0) <= 35) return '과목 밸런스가 안정적이에요. 지금 흐름을 유지해보세요.';
    return `${topSubject.label}을 중심으로 잘 잡혀 있어요. 다음은 ${nextSubject?.label || '보조 과목'} 차례예요.`;
  }, [subjectBalance]);

  const toggleQuestSubject = (subjectId: string) => {
    setQuestFocusSubjects((current) => {
      if (current.includes(subjectId)) return current.filter((item) => item !== subjectId);
      if (current.length >= 2) return [current[1], subjectId];
      return [...current, subjectId];
    });
    setNewStudySubject(subjectId);
  };

  const handleQuestKickoff = () => {
    setOutTime(questEndTimeChoice);
    if (questFocusSubjects[0]) {
      setNewStudySubject(questFocusSubjects[0]);
    }
    if (missionSuggestion) {
      setNewStudyTask(missionSuggestion.title);
      setNewStudyMinutes(String(missionSuggestion.targetMinutes));
      setQuickStudyType(missionSuggestion.tag);
      setQuestMissionId(missionSuggestion.id);
    }
    setShowQuickAddCard(true);
  };

  const handleCreateQuickBlock = async () => {
    const title = newStudyTask.trim() || `${resolvedSubjectLabel} ${quickStudyType}`;
    if (!title.trim()) return;

    const taskBlueprint: any = {
      category: 'study',
      title,
      subject: resolvedSubjectValue,
      studyPlanMode: newStudyMode,
      priority: questFocusSubjects.includes(resolvedSubjectValue) ? 'high' : 'medium',
      tag: quickStudyType,
    };

    if (newStudyMode === 'time') {
      taskBlueprint.targetMinutes = resolvedTargetMinutes;
      if (resolvedWindowPreview) {
        taskBlueprint.startTime = resolvedWindowPreview.startTime;
        taskBlueprint.endTime = resolvedWindowPreview.endTime;
      }
    } else {
      taskBlueprint.targetAmount = Number(newStudyTargetAmount) || 0;
      taskBlueprint.amountUnit = newStudyAmountUnit;
      if (newStudyAmountUnit === '직접입력') {
        taskBlueprint.amountUnitLabel = newStudyCustomAmountUnit.trim() || '단위';
      }
      if (enableVolumeStudyMinutes && resolvedTargetMinutes > 0 && resolvedWindowPreview) {
        taskBlueprint.targetMinutes = resolvedTargetMinutes;
        taskBlueprint.startTime = resolvedWindowPreview.startTime;
        taskBlueprint.endTime = resolvedWindowPreview.endTime;
      }
    }

    const added = await handleAddTask(title, 'study', { taskBlueprint });
    if (added) {
      setShowQuickAddCard(false);
    }
  };

  const handleStartOutingPlan = () => {
    const startClock = createClockFromNow();
    setAwayStartTime(startClock);
    setAwayEndTime(addMinutesToClock(startClock, Number(outingDuration) || 20));
    if (!awayReason.trim()) {
      setAwayReason('식사');
    }
    setIsOutingModalOpen(false);
  };

  const clearAwayPlan = () => {
    setAwayStartTime('');
    setAwayEndTime('');
    setAwayReason('');
  };

  const heroStatus = isAbsentMode
    ? { label: '미등원 모드', summary: '오늘은 미등원으로 정리돼 있어요.' }
    : hasAwayPlan
      ? { label: '외출 중', summary: awayReason ? `${awayReason} 다녀오는 중이에요. 돌아오면 바로 이어서 시작할 수 있어요.` : '외출 루트를 기록 중이에요.' }
      : hasInPlan && hasOutPlan
        ? { label: '입실 완료', summary: '입실부터 퇴실까지 오늘의 흐름이 준비됐어요.' }
        : { label: '퀘스트 준비 전', summary: '메인 과목 두 개와 핵심 미션 하나만 고르면 바로 시작할 수 있어요.' };

  return (
    <>
      <div className={cn('mx-auto flex w-full max-w-5xl flex-col pb-24', isMobile ? 'gap-4 px-3 pt-3' : 'gap-6 px-4 pt-4')}>
        <header className="space-y-4">
          <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-end justify-between')}>
            <div className="min-w-0">
              <p className="text-[11px] font-black tracking-[0.24em] text-[#17326B]/45">PLAN</p>
              <h1 className="mt-2 text-[2rem] font-black tracking-tight text-[#17326B] md:text-[2.7rem]">계획</h1>
              <p className="mt-1 text-sm font-semibold text-[#17326B]/62">오늘의 퀘스트 보드</p>
            </div>
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[#DDE7F6] bg-white/92 px-4 py-2 text-sm font-black text-[#17326B] shadow-[0_18px_36px_-30px_rgba(23,50,107,0.24)]">
              <span>🔥 {todayPointTotal} / {dailyPointCap} pt</span>
              <span className="text-[#17326B]/25">|</span>
              <span>{completionPercent}% 완료</span>
              {todayStreakDays > 0 ? (
                <>
                  <span className="text-[#17326B]/25">|</span>
                  <span>{todayStreakDays}일 연속</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-[#DDE7F6] bg-white/92 p-3 shadow-[0_22px_44px_-36px_rgba(23,50,107,0.18)]">
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="ghost" onClick={() => moveWeek(-1)} className="h-10 w-10 rounded-full bg-[#F5F8FF] p-0 text-[#17326B] hover:bg-[#EAF0FF]">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="rounded-full bg-[#FFF4E8] px-4 py-2 text-xs font-black tracking-[0.18em] text-[#FF9626]">
                {weekRangeLabel}
              </div>
              <Button type="button" variant="ghost" onClick={() => moveWeek(1)} className="h-10 w-10 rounded-full bg-[#F5F8FF] p-0 text-[#17326B] hover:bg-[#EAF0FF]">
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
                      'rounded-[1rem] border px-1 py-2 text-center transition-all',
                      selected
                        ? 'border-[#17326B] bg-[#17326B] text-white shadow-[0_14px_28px_-18px_rgba(23,50,107,0.45)]'
                        : 'border-[#DDE7F6] bg-white text-[#17326B] hover:border-[#17326B]/30 hover:bg-[#F8FBFF]'
                    )}
                  >
                    <p className="text-[10px] font-black text-current/68">{format(day, 'EEE', { locale: ko })}</p>
                    <p className="mt-1 text-sm font-black">{format(day, 'd')}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-[2.2rem] border border-[#17326B]/12 bg-[linear-gradient(135deg,#17326B_0%,#28478F_58%,#FFB347_145%)] px-5 py-5 text-white shadow-[0_28px_60px_-34px_rgba(23,50,107,0.48)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,214,155,0.34),transparent_32%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_28%)]" />
          <div className="relative">
            {floatingPointBursts.map((burst: { id: number; label: string }, index: number) => (
              <div
                key={burst.id}
                className="absolute right-0 top-0 rounded-full bg-[#FFF4E8] px-3 py-1 text-xs font-black text-[#17326B] shadow-[0_18px_30px_-24px_rgba(6,12,34,0.4)] animate-[planner-point-burst_0.95s_ease-out_forwards]"
                style={{ marginTop: `${index * 8}px` }}
              >
                +{burst.label}P
              </div>
            ))}

            <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]')}>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1 text-[11px] font-black tracking-[0.18em] text-white/88">
                  <Sparkles className="h-3.5 w-3.5 text-[#FFD79F]" />
                  {heroStatus.label}
                </div>
                <h2 className="mt-4 text-[2rem] font-black tracking-tight md:text-[2.6rem]">
                  오늘의 성장 루트
                </h2>
                <p className="mt-2 max-w-xl break-keep text-sm font-semibold leading-6 text-white/74">
                  {heroStatus.summary}
                </p>

                <div className={cn('mt-5 grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
                  <div className="rounded-[1.2rem] border border-white/12 bg-white/[0.08] px-3 py-3 backdrop-blur-sm">
                    <p className="text-[10px] font-black tracking-[0.18em] text-white/58">입실</p>
                    <p className="mt-2 text-[1rem] font-black text-white">{isAbsentMode ? '미등원' : (inTime || '미정')}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/12 bg-white/[0.08] px-3 py-3 backdrop-blur-sm">
                    <p className="text-[10px] font-black tracking-[0.18em] text-white/58">목표 퇴실</p>
                    <p className="mt-2 text-[1rem] font-black text-[#FFD79F]">{isAbsentMode ? '--:--' : (questEndTimeChoice || outTime || '--:--')}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/12 bg-white/[0.08] px-3 py-3 backdrop-blur-sm">
                    <p className="text-[10px] font-black tracking-[0.18em] text-white/58">오늘 목표</p>
                    <p className="mt-2 text-[1rem] font-black text-white">{plannedStudyMinutes > 0 ? formatMinutesShort(plannedStudyMinutes) : studyGoalSummaryLabel}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/12 bg-white/[0.08] px-3 py-3 backdrop-blur-sm">
                    <p className="text-[10px] font-black tracking-[0.18em] text-white/58">진행률</p>
                    <p className="mt-2 text-[1rem] font-black text-[#FFD79F]">{completionPercent}%</p>
                  </div>
                </div>

                <div className="mt-5 rounded-[1.5rem] border border-white/12 bg-white/[0.08] p-4 backdrop-blur-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-black">
                    <span className="text-white/72">퀘스트 진행률</span>
                    <span className="text-[#FFD79F]">{todayCompletionLabel} · {completionPercent}%</span>
                  </div>
                  <div className="mt-3 rounded-full bg-white/10 p-1">
                    <div className="relative overflow-hidden rounded-full">
                      <Progress
                        value={completionPercent}
                        className="h-3 bg-white/10 [&>div]:bg-[linear-gradient(90deg,#FFD79F_0%,#FFB347_32%,#FF9626_62%,#2FAA7D_100%)]"
                      />
                      <div className="pointer-events-none absolute inset-y-0 w-20 animate-[planner-shimmer-slide_2.8s_linear_infinite] bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.42)_55%,rgba(255,255,255,0)_100%)]" />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-white/68">
                    <span>{selectedDateLabel}</span>
                    <span className="text-white/24">·</span>
                    <span>실제 공부 {formatMinutesShort(actualStudyMinutes)}</span>
                    <span className="text-white/24">·</span>
                    <span>계획 {formatMinutesShort(plannedStudyMinutes)}</span>
                  </div>
                </div>

                {!isPast ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => handleSetAttendance('attend')}
                      disabled={isSubmitting}
                      className={cn('h-11 rounded-full px-5 font-black text-white shadow-[0_18px_34px_-24px_rgba(255,150,38,0.6)] animate-[planner-cta-breathe_2.8s_ease-in-out_infinite]', rewardGradient)}
                    >
                      <CalendarCheck2 className="mr-2 h-4 w-4" />
                      출석 저장
                    </Button>
                    <ActionChipButton
                      icon={hasAwayPlan ? ArrowRight : Clock3}
                      label={hasAwayPlan ? '복귀하기' : '외출하기'}
                      onClick={() => (hasAwayPlan ? clearAwayPlan() : setIsOutingModalOpen(true))}
                      disabled={isSubmitting}
                      tone="white"
                    />
                    <ActionChipButton
                      icon={StickyNote}
                      label="미등원"
                      onClick={() => handleSetAttendance('absent')}
                      disabled={isSubmitting}
                      tone="orange"
                    />
                  </div>
                ) : null}
              </div>

              <div className="rounded-[1.9rem] border border-white/12 bg-white/[0.08] p-4 shadow-[0_22px_44px_-32px_rgba(6,12,34,0.32)] backdrop-blur-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black tracking-[0.18em] text-white/54">QUEST SETUP</p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-white">오늘의 퀘스트 시작</h3>
                  </div>
                  <Badge className="rounded-full border border-white/12 bg-white/10 px-3 py-1 text-[10px] font-black text-[#FFD79F] shadow-none">
                    {questFocusSubjects.length}/2 과목
                  </Badge>
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-[11px] font-black text-white/62">오늘은 몇 시까지 집중할까요?</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {QUEST_END_OPTIONS.map((clock) => (
                        <button
                          key={clock}
                          type="button"
                          onClick={() => setQuestEndTimeChoice(clock)}
                          className={cn(
                            'rounded-full border px-3 py-2 text-[11px] font-black transition-all',
                            questEndTimeChoice === clock
                              ? 'border-[#FFD79F] bg-[#FFF4E8] text-[#17326B]'
                              : 'border-white/12 bg-white/10 text-white'
                          )}
                        >
                          {clock}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-black text-white/62">오늘의 메인 과목</p>
                      <span className="text-[11px] font-bold text-[#FFD79F]">{questFocusSummary}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {subjectOptions.map((subject: any) => {
                        const selected = questFocusSubjects.includes(subject.id);
                        return (
                          <button
                            key={subject.id}
                            type="button"
                            onClick={() => toggleQuestSubject(subject.id)}
                            className={cn(
                              'rounded-full border px-3 py-2 text-[11px] font-black transition-all',
                              selected
                                ? 'border-[#FFD79F] bg-[#FFF4E8] text-[#17326B]'
                                : 'border-white/12 bg-white/10 text-white'
                            )}
                          >
                            {subject.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-black text-white/62">오늘의 핵심 미션</p>
                    <div className="mt-2 grid gap-2">
                      {PLANNER_QUICK_TASK_SUGGESTIONS.slice(0, 3).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setQuestMissionId(item.id)}
                          className={cn(
                            'rounded-[1.1rem] border px-3 py-3 text-left transition-all',
                            questMissionId === item.id
                              ? 'border-[#FFD79F] bg-[#FFF4E8] text-[#17326B]'
                              : 'border-white/12 bg-white/10 text-white'
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-black">{item.title}</p>
                              <p className={cn('mt-1 text-[11px] font-semibold', questMissionId === item.id ? 'text-[#17326B]/62' : 'text-white/64')}>
                                {item.tag} · {item.targetMinutes}분
                              </p>
                            </div>
                            <Target className={cn('h-4 w-4', questMissionId === item.id ? 'text-[#FF9626]' : 'text-[#FFD79F]')} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={handleQuestKickoff}
                    className={cn('h-12 w-full rounded-full px-5 font-black text-white shadow-[0_18px_34px_-24px_rgba(255,150,38,0.6)] animate-[planner-cta-breathe_2.8s_ease-in-out_infinite]', rewardGradient)}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    오늘 시작하기
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {!isPast ? (
              <>
                <ActionChipButton icon={Copy} label="어제 계획 그대로" onClick={handleCopyYesterdayPlan} disabled={isSubmitting} />
                <ActionChipButton icon={Sparkles} label="평일 루틴" onClick={() => applyTemplateToToday(weekdayTemplate)} disabled={isSubmitting} tone="orange" />
                <ActionChipButton icon={Flame} label="시험기간 루틴" onClick={() => applyTemplateToToday(examTemplate)} disabled={isSubmitting} tone="orange" />
                <ActionChipButton
                  icon={Layers3}
                  label={recentTemplateCandidate ? '최근 템플릿 불러오기' : '템플릿 보관함'}
                  onClick={() => (recentTemplateCandidate ? applyTemplateToToday(recentTemplateCandidate) : setIsTemplateSheetOpen(true))}
                  disabled={isSubmitting}
                  tone="white"
                />
                <button
                  type="button"
                  onClick={async () => {
                    await clearTodayPlans();
                    setShowQuickAddCard(true);
                  }}
                  disabled={isSubmitting}
                  className="rounded-full px-3 py-2 text-[11px] font-black text-[#17326B]/55 transition hover:text-[#17326B] disabled:opacity-45"
                >
                  빈 상태에서 새로 만들기
                </button>
              </>
            ) : (
              <div className="rounded-full border border-[#DDE7F6] bg-white/88 px-4 py-2 text-xs font-black text-[#17326B]/65">
                지난 날짜는 기록 확인 중심으로 보여드릴게요.
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-[#DDE7F6] bg-[linear-gradient(180deg,#FFFDF9_0%,#FFFFFF_100%)] shadow-[0_28px_50px_-38px_rgba(23,50,107,0.2)]">
          <div className="border-b border-[#E7EDF8] px-5 py-5">
            <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-end justify-between')}>
              <div className="min-w-0">
                <p className="text-[11px] font-black tracking-[0.18em] text-[#17326B]/42">TODAY QUEST</p>
                <h3 className="mt-1 text-[1.7rem] font-black tracking-tight text-[#17326B]">오늘 해야 할 것</h3>
                <p className="mt-2 max-w-2xl break-keep text-sm font-semibold leading-6 text-[#17326B]/58">
                  긴 설명 대신 오늘 블록만 먼저 체크하세요. 필요한 설정은 눌렀을 때만 펼쳐집니다.
                </p>
              </div>
              {!isPast ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => setShowQuickAddCard((prev: boolean) => !prev)}
                    className={cn('h-11 rounded-full px-5 font-black text-white shadow-[0_18px_34px_-24px_rgba(255,150,38,0.55)] animate-[planner-cta-breathe_2.8s_ease-in-out_infinite]', rewardGradient)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    + 할 일 추가
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsStudyPlanSheetOpen(true)}
                    className="h-10 rounded-full bg-[#F6F8FC] px-4 text-[11px] font-black text-[#17326B] hover:bg-[#ECF2FF]"
                  >
                    전체 편집
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          {showQuickAddCard && !isPast ? (
            <div className="mx-4 mt-4 overflow-hidden rounded-[1.7rem] border border-[#DDE7F6] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_58%,#FFF7EC_100%)] p-4 shadow-[0_20px_40px_-34px_rgba(23,50,107,0.18)] animate-[planner-fade-rise_0.22s_ease-out] md:mx-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black tracking-[0.18em] text-[#17326B]/42">QUICK CREATE</p>
                  <p className="mt-1 text-lg font-black tracking-tight text-[#17326B]">다음 공부 추가</p>
                  <p className="mt-1 break-keep text-[12px] font-semibold leading-5 text-[#17326B]/55">
                    직접 길게 쓰지 않아도 과목, 유형, 시간만 고르면 자동으로 오늘 루트에 붙어요.
                  </p>
                </div>
                {activeRecentStudyOption ? (
                  <button
                    type="button"
                    onClick={resetStudyComposerPrefill}
                    className="rounded-full bg-[#FFF4E8] px-3 py-1 text-[10px] font-black text-[#FF9626]"
                  >
                    불러온 계획 해제
                  </button>
                ) : null}
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-[11px] font-black text-[#17326B]/55">과목 선택</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {subjectOptions.map((subject: any) => (
                      <button
                        key={subject.id}
                        type="button"
                        onClick={() => setNewStudySubject(subject.id)}
                        className={cn(
                          'rounded-full border px-3 py-2 text-[11px] font-black transition-all',
                          resolvedSubjectValue === subject.id
                            ? 'border-[#17326B] bg-[#17326B] text-white'
                            : 'border-[#DDE7F6] bg-white text-[#17326B] hover:bg-[#F8FBFF]'
                        )}
                      >
                        {subject.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-black text-[#17326B]/55">공부 유형 선택</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {QUICK_STUDY_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setQuickStudyType(type);
                          if (!newStudyTask.trim()) setNewStudyTask(`${resolvedSubjectLabel} ${type}`);
                        }}
                        className={cn(
                          'rounded-full border px-3 py-2 text-[11px] font-black transition-all',
                          quickStudyType === type
                            ? 'border-[#FF9626] bg-[#FFF4E8] text-[#FF9626]'
                            : 'border-[#DDE7F6] bg-white text-[#17326B] hover:bg-[#F8FBFF]'
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-black text-[#17326B]/55">예상 시간 선택</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {QUICK_TIME_PRESETS.map((minute) => (
                      <button
                        key={minute}
                        type="button"
                        onClick={() => setNewStudyMinutes(String(minute))}
                        className={cn(
                          'rounded-full border px-3 py-2 text-[11px] font-black transition-all',
                          Number(newStudyMinutes || missionSuggestion?.targetMinutes || 0) === minute
                            ? 'border-[#17326B] bg-[#17326B] text-white'
                            : 'border-[#DDE7F6] bg-white text-[#17326B] hover:bg-[#F8FBFF]'
                        )}
                      >
                        {minute}분
                      </button>
                    ))}
                  </div>
                </div>

                <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]')}>
                  <div className="space-y-2">
                    <p className="text-[11px] font-black text-[#17326B]/55">할 일 제목</p>
                    <Input
                      value={newStudyTask}
                      onChange={(event) => setNewStudyTask(event.target.value)}
                      placeholder={`예: ${resolvedSubjectLabel} ${quickStudyType}`}
                      className="h-12 rounded-2xl border-[#DDE7F6] bg-white font-bold text-[#17326B] placeholder:text-[#17326B]/35"
                    />
                  </div>
                  {newStudyMode === 'volume' ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-black text-[#17326B]/55">목표 분량</p>
                      <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,0.75fr)] gap-2">
                        <Input
                          type="number"
                          min={0}
                          value={newStudyTargetAmount}
                          onChange={(event) => setNewStudyTargetAmount(event.target.value)}
                          placeholder="수치"
                          className="h-12 rounded-2xl border-[#DDE7F6] bg-white font-bold text-[#17326B] placeholder:text-[#17326B]/35"
                        />
                        <Select value={newStudyAmountUnit} onValueChange={setNewStudyAmountUnit}>
                          <SelectTrigger className="h-12 rounded-2xl border-[#DDE7F6] bg-white font-bold text-[#17326B]">
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
                          placeholder="예: 세트, 회차"
                          className="h-11 rounded-2xl border-[#DDE7F6] bg-white font-bold text-[#17326B] placeholder:text-[#17326B]/35"
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className={cn('rounded-[1.2rem] bg-[#FFF7EC] px-4 py-3', isMobile ? 'space-y-3' : 'flex items-center justify-between gap-3')}>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black tracking-[0.18em] text-[#FF9626]">AUTO SCHEDULE</p>
                    <p className="mt-1 break-keep text-[12px] font-bold text-[#17326B]">
                      {resolvedWindowPreview ? `${resolvedWindowPreview.startTime} - ${resolvedWindowPreview.endTime}` : '시간은 필요할 때만 적어도 괜찮아요'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleCreateQuickBlock}
                    disabled={isSubmitting || !resolvedSubjectValue}
                    className={cn('h-11 rounded-2xl px-5 font-black text-white shadow-[0_18px_30px_-20px_rgba(23,58,130,0.45)]', rewardGradient, isMobile && 'w-full')}
                  >
                    블록 추가
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {quickRecentItems.map((item: any) => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => handlePrefillRecentStudy(item)}
                      className={cn(
                        'rounded-full border border-[#DDE7F6] bg-[#F6F8FC] px-3 py-1.5 text-[11px] font-black text-[#17326B]',
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
                    className={cn('h-9 rounded-full px-3 text-[11px] font-black text-[#17326B]/70 hover:bg-[#F3F7FF]', isMobile && 'w-full justify-center')}
                  >
                    {isRecentStudyLoading ? '불러오는 중...' : '최근 더보기'}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className={cn('relative mt-4 px-4 pb-4 md:px-5 md:pb-5')}>
            <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:repeating-linear-gradient(180deg,transparent_0,transparent_67px,rgba(217,225,242,0.62)_68px)]" />
            <div className="relative space-y-3">
              {orderedChecklistTasks.length === 0 ? (
                <div className="rounded-[1.45rem] border border-dashed border-[#DDE7F6] bg-white/84 px-5 py-7 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EFF5FF] text-[#17326B]">
                    <ListTodo className="h-6 w-6" />
                  </div>
                  <p className="mt-4 text-lg font-black text-[#17326B]">오늘 할 일을 비워뒀어요</p>
                  <p className="mt-2 break-keep text-sm font-semibold leading-6 text-[#17326B]/58">
                    어제 계획이나 템플릿을 고르면 오늘 체크리스트가 바로 채워져요.
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
                  const timeProgress = computeTimeProgressPercent(task, isToday);
                  const rewardLabel = `+${estimateTaskReward(task)}P`;
                  const statusTone = task.done ? 'completed' : timeProgress > 0 ? 'active' : 'planned';
                  const statusLabel = task.done
                    ? '완료'
                    : timeProgress > 0
                      ? `${timeProgress}% 진행`
                      : '시작 전';
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
                        rewardLabel={rewardLabel}
                        statusLabel={statusLabel}
                        statusTone={statusTone}
                        progressPercent={isVolumeTask ? undefined : timeProgress}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {completionPercent >= 100 && checklistTasks.length > 0 ? (
            <div className="mx-4 mb-4 rounded-[1.35rem] border border-[#FF9626]/18 bg-[#FFF7EC] px-4 py-4 text-[#17326B] animate-[planner-fade-rise_0.24s_ease-out] md:mx-5 md:mb-5">
              <p className="text-lg font-black tracking-tight">오늘 계획을 다 끝냈어요</p>
              <p className="mt-1 text-sm font-semibold text-[#17326B]/60">포인트와 연속 달성이 바로 반영됐어요.</p>
            </div>
          ) : null}
        </section>

        <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]')}>
          <section className="rounded-[1.9rem] border border-[#DDE7F6] bg-white/92 p-5 shadow-[0_24px_48px_-38px_rgba(23,50,107,0.2)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black tracking-[0.18em] text-[#17326B]/42">SUBJECT FLOW</p>
                <h3 className="mt-1 text-xl font-black tracking-tight text-[#17326B]">과목 밸런스</h3>
              </div>
              <Badge className="rounded-full border border-[#DDE7F6] bg-[#F6F8FC] px-3 py-1 text-[10px] font-black text-[#17326B] shadow-none">
                {subjectBalance.length}과목
              </Badge>
            </div>

            <div className="mt-4 space-y-3">
              {subjectBalance.length === 0 ? (
                <div className="rounded-[1.3rem] border border-dashed border-[#DDE7F6] bg-[#F8FBFF] px-4 py-5 text-sm font-semibold text-[#17326B]/58">
                  오늘 공부 블록을 추가하면 과목 밸런스가 여기에 바로 보입니다.
                </div>
              ) : (
                subjectBalance.map((entry) => (
                  <div key={entry.key} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm font-black text-[#17326B]">
                      <span>{entry.label}</span>
                      <span>{entry.percent}% · {formatMinutesShort(entry.minutes)}</span>
                    </div>
                    <div className="rounded-full bg-[#EEF3FB] p-1">
                      <div
                        className="h-3 rounded-full bg-[linear-gradient(90deg,#17326B_0%,#28478F_55%,#FFB347_100%)] transition-[width] duration-300"
                        style={{ width: `${Math.max(12, entry.percent)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 rounded-[1.35rem] bg-[#FFF7EC] px-4 py-3 text-sm font-semibold leading-6 text-[#17326B]">
              {subjectBalanceFeedback}
            </div>
          </section>

          <section className="rounded-[1.9rem] border border-[#DDE7F6] bg-white/92 p-5 shadow-[0_24px_48px_-38px_rgba(23,50,107,0.2)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black tracking-[0.18em] text-[#17326B]/42">DAY SUMMARY</p>
                <h3 className="mt-1 text-xl font-black tracking-tight text-[#17326B]">오늘 요약</h3>
              </div>
              <Badge className="rounded-full border border-[#FF9626]/16 bg-[#FFF4E8] px-3 py-1 text-[10px] font-black text-[#FF9626] shadow-none">
                {todayCompletionLabel}
              </Badge>
            </div>

            <div className={cn('mt-4 grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-2')}>
              <div className="rounded-[1.25rem] bg-[#F6F8FC] px-4 py-4">
                <p className="text-[10px] font-black tracking-[0.18em] text-[#17326B]/42">계획 시간</p>
                <p className="mt-2 text-xl font-black text-[#17326B]">{formatMinutesShort(plannedStudyMinutes)}</p>
              </div>
              <div className="rounded-[1.25rem] bg-[#F6F8FC] px-4 py-4">
                <p className="text-[10px] font-black tracking-[0.18em] text-[#17326B]/42">실제 공부</p>
                <p className="mt-2 text-xl font-black text-[#17326B]">{formatMinutesShort(actualStudyMinutes)}</p>
              </div>
              <div className="rounded-[1.25rem] bg-[#F6F8FC] px-4 py-4">
                <p className="text-[10px] font-black tracking-[0.18em] text-[#17326B]/42">완료율</p>
                <p className="mt-2 text-xl font-black text-[#17326B]">{completionPercent}%</p>
              </div>
              <div className="rounded-[1.25rem] bg-[#F6F8FC] px-4 py-4">
                <p className="text-[10px] font-black tracking-[0.18em] text-[#17326B]/42">외출 횟수</p>
                <p className="mt-2 text-xl font-black text-[#17326B]">{outingCount}회</p>
              </div>
            </div>

            {!isPast ? (
              <div className="mt-4">
                <Button
                  type="button"
                  onClick={() => setIsWrapUpOpen(true)}
                  className={cn('h-11 w-full rounded-2xl px-5 font-black text-white shadow-[0_18px_30px_-20px_rgba(23,58,130,0.45)]', rewardGradient)}
                >
                  오늘 마감하기
                </Button>
              </div>
            ) : null}
          </section>
        </div>

        <Collapsible open={isRoutineSectionOpen} onOpenChange={setIsRoutineSectionOpen}>
          <section className="rounded-[1.9rem] border border-[#DDE7F6] bg-white/92 shadow-[0_24px_48px_-38px_rgba(23,50,107,0.22)]">
            <CollapsibleTrigger asChild>
              <button type="button" className={cn('flex w-full gap-3 p-5 text-left', isMobile ? 'flex-col items-start' : 'items-center justify-between')}>
                <div className="min-w-0">
                  <p className="text-[11px] font-black tracking-[0.18em] text-[#17326B]/42">ROUTINE</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-[#17326B]">루틴 관리</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#17326B]/58">
                    입실, 외출, 생활 루틴은 필요한 순간에만 펼쳐서 관리하세요.
                  </p>
                </div>
                <div className={cn('flex items-center gap-3', isMobile && 'w-full justify-between')}>
                  <Badge className="rounded-full border border-[#DDE7F6] bg-white px-3 py-1 text-[10px] font-black text-[#17326B] shadow-none">
                    {routineCountLabel}
                  </Badge>
                  <ChevronDown className={cn('h-5 w-5 text-[#17326B] transition-transform', isRoutineSectionOpen && 'rotate-180')} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className={cn('border-t border-[#DDE7F6] px-4 pb-4', !isMobile && 'px-5 pb-5')}>
              <div className={cn('mt-5 grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]')}>
                <div className="rounded-[1.6rem] border border-[#DDE7F6] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbff_100%)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-[#17326B]">오늘 출석 정보</p>
                      <p className="mt-1 text-[12px] font-semibold leading-5 text-[#17326B]/55">
                        등원, 하원, 외출 흐름을 기록해두면 원장도 실제 학습 흐름을 더 정확히 볼 수 있어요.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isAbsentMode ? (
                        <Badge className="rounded-full border-none bg-[#FFF1E1] px-3 py-1 text-[10px] font-black text-[#FF9626] shadow-none">
                          오늘 미등원
                        </Badge>
                      ) : null}
                      {hasInPlan && hasOutPlan ? (
                        <Badge className="rounded-full border-none bg-[#ECFDF5] px-3 py-1 text-[10px] font-black text-[#0F766E] shadow-none">
                          출석 계획 저장됨
                        </Badge>
                      ) : null}
                      {hasAwayPlan ? (
                        <Badge className="rounded-full border-none bg-[#FFF7EC] px-3 py-1 text-[10px] font-black text-[#FF9626] shadow-none">
                          외출 포함
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className={cn('mt-4 grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#17326B]/40">등원 예정</p>
                      <Input type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} disabled={isPast || isSubmitting} className="h-11 rounded-2xl border-[#DDE7F6] font-black text-[#17326B]" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#17326B]/40">하원 예정</p>
                      <Input type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} disabled={isPast || isSubmitting} className="h-11 rounded-2xl border-[#DDE7F6] font-black text-[#17326B]" />
                    </div>
                  </div>

                  <div className={cn('mt-4 grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#17326B]/40">외출 시작</p>
                      <Input type="time" value={awayStartTime} onChange={(e) => setAwayStartTime(e.target.value)} disabled={isPast || isSubmitting} className="h-11 rounded-2xl border-[#DDE7F6] font-black text-[#17326B]" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#17326B]/40">복귀 예정</p>
                      <Input type="time" value={awayEndTime} onChange={(e) => setAwayEndTime(e.target.value)} disabled={isPast || isSubmitting} className="h-11 rounded-2xl border-[#DDE7F6] font-black text-[#17326B]" />
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#17326B]/40">사유</p>
                    <Input
                      value={awayReason}
                      onChange={(e) => setAwayReason(e.target.value)}
                      placeholder="예: 학원, 병원, 저녁 식사"
                      disabled={isPast || isSubmitting}
                      className="h-11 rounded-2xl border-[#DDE7F6] font-bold text-[#17326B] placeholder:text-[#17326B]/35"
                    />
                  </div>

                  {!isPast ? (
                    <div className={cn('mt-4 gap-2', isMobile ? 'grid grid-cols-1' : 'flex flex-wrap')}>
                      <Button type="button" onClick={() => handleSetAttendance('attend')} disabled={isSubmitting} className="h-11 rounded-2xl bg-[#17326B] px-4 font-black text-white">
                        <CalendarCheck2 className="mr-2 h-4 w-4" />
                        오늘 출석 저장
                      </Button>
                      <Button type="button" variant="outline" onClick={() => handleSetAttendance('absent')} disabled={isSubmitting} className="h-11 rounded-2xl border-[#DDE7F6] bg-white px-4 font-black text-[#17326B]">
                        오늘 미등원
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsRoutineCopyDialogOpen(true)} disabled={isSubmitting || !hasCopyableRoutines} className="h-11 rounded-2xl border-[#DDE7F6] bg-white px-4 font-black text-[#17326B]">
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
                    <div className="rounded-[1.5rem] border border-dashed border-[#DDE7F6] bg-[#F7FAFF] p-5 text-center">
                      <p className="text-sm font-black text-[#17326B]">저장된 루틴이 아직 없어요</p>
                      <p className="mt-2 text-[12px] font-semibold leading-5 text-[#17326B]/55">
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
          <section className="rounded-[1.9rem] border border-[#DDE7F6] bg-white/92 shadow-[0_24px_48px_-38px_rgba(23,50,107,0.2)]">
            <CollapsibleTrigger asChild>
              <button type="button" className={cn('flex w-full gap-3 p-5 text-left', isMobile ? 'flex-col items-start' : 'items-center justify-between')}>
                <div className="min-w-0">
                  <p className="text-[11px] font-black tracking-[0.18em] text-[#17326B]/42">EXTRA</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-[#17326B]">기타 계획</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#17326B]/58">
                    메모, 준비물, 상담 같은 보조 일정만 따로 모아두고 필요할 때 펼쳐보세요.
                  </p>
                </div>
                <div className={cn('flex items-center gap-3', isMobile && 'w-full justify-between')}>
                  <Badge className="rounded-full border border-[#DDE7F6] bg-white px-3 py-1 text-[10px] font-black text-[#17326B] shadow-none">
                    {personalTasks.length}개
                  </Badge>
                  <ChevronDown className={cn('h-5 w-5 text-[#17326B] transition-transform', isMemoSectionOpen && 'rotate-180')} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className={cn('border-t border-[#DDE7F6] px-4 pb-4', !isMobile && 'px-5 pb-5')}>
              <div className="mt-5 rounded-[1.5rem] border border-[#DDE7F6] bg-[linear-gradient(180deg,#ffffff_0%,#fff7ec_100%)] p-4">
                <div className={cn('flex flex-col gap-3', !isMobile && 'md:flex-row md:items-center')}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-[#17326B]">짧은 메모나 일정 추가</p>
                    <p className="mt-1 text-[12px] font-semibold leading-5 text-[#17326B]/55">
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
                        className="h-11 flex-1 rounded-2xl border-[#DDE7F6] bg-white font-bold text-[#17326B] placeholder:text-[#17326B]/35"
                      />
                      <Button
                        type="button"
                        onClick={() => handleAddTask(newPersonalTask, 'personal')}
                        disabled={isSubmitting || !newPersonalTask.trim()}
                        className="h-11 rounded-2xl bg-[#FF9626] px-4 font-black text-white hover:bg-[#FF9626]/92"
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
                      className="h-10 rounded-2xl border-[#DDE7F6] bg-white px-4 text-[11px] font-black text-[#17326B]"
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      학습/기타 반복 복사
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                {personalTasks.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-[#DDE7F6] bg-[#F7FAFF] p-5 text-center">
                    <p className="text-sm font-black text-[#17326B]">기타 일정은 필요할 때만 적어도 충분해요</p>
                    <p className="mt-2 text-[12px] font-semibold leading-5 text-[#17326B]/55">
                      공부 흐름을 방해하지 않도록, 보조 일정은 간단하게 남기는 구조로 두었어요.
                    </p>
                  </div>
                ) : (
                  personalTasks.map((task: any) => (
                    <PlannerChecklistItem
                      key={task.id}
                      task={task}
                      badgeLabel={task.tag || '메모'}
                      badgeClassName="border border-[#FF9626]/15 bg-[#FFF7EC] text-[#FF9626]"
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
                      rewardLabel="+3P"
                      statusLabel={task.done ? '완료' : '메모'}
                      statusTone={task.done ? 'completed' : 'planned'}
                    />
                  ))
                )}
              </div>
            </CollapsibleContent>
          </section>
        </Collapsible>

        {!isPast ? (
          <Collapsible open={isWrapUpOpen} onOpenChange={setIsWrapUpOpen}>
            <section className="rounded-[1.9rem] border border-[#DDE7F6] bg-white/92 shadow-[0_24px_48px_-38px_rgba(23,50,107,0.18)]">
              <CollapsibleTrigger asChild>
                <button type="button" className={cn('flex w-full gap-3 p-5 text-left', isMobile ? 'flex-col items-start' : 'items-center justify-between')}>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black tracking-[0.18em] text-[#17326B]/42">WRAP UP</p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-[#17326B]">하루 정리</h3>
                    <p className="mt-2 text-sm font-semibold leading-6 text-[#17326B]/58">
                      남은 할 일은 내일로 미루거나, 템플릿에 반영하거나, 오늘 안에서 정리할 수 있어요.
                    </p>
                  </div>
                  <div className={cn('flex items-center gap-3', isMobile && 'w-full justify-between')}>
                    <Badge className="rounded-full border border-[#DDE7F6] bg-white px-3 py-1 text-[10px] font-black text-[#17326B] shadow-none">
                      {remainingStudyTasks.length + remainingPersonalTasks.length}개
                    </Badge>
                    <ChevronDown className={cn('h-5 w-5 text-[#17326B] transition-transform', isWrapUpOpen && 'rotate-180')} />
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className={cn('border-t border-[#E7EDF8] px-4 pb-4', !isMobile && 'px-5 pb-5')}>
                {remainingStudyTasks.length + remainingPersonalTasks.length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <ActionChipButton icon={ChevronRight} label="내일로 미루기" onClick={handleMoveUnfinishedToTomorrow} disabled={isSubmitting} />
                    <ActionChipButton icon={BookCopy} label="템플릿 반영" onClick={handleSaveUnfinishedAsTemplate} disabled={isSubmitting} tone="white" />
                    <ActionChipButton icon={StickyNote} label="삭제하기" onClick={handleDeleteUnfinished} disabled={isSubmitting} tone="orange" />
                  </div>
                ) : (
                  <div className="mt-5 rounded-[1.35rem] border border-dashed border-[#DDE7F6] bg-[#F7FAFF] p-5 text-center">
                    <p className="text-sm font-black text-[#17326B]">오늘 정리할 남은 항목이 없어요</p>
                    <p className="mt-2 text-[12px] font-semibold leading-5 text-[#17326B]/55">
                      체크리스트가 깔끔하게 정리되면 내일 계획도 훨씬 가벼워져요.
                    </p>
                  </div>
                )}
              </CollapsibleContent>
            </section>
          </Collapsible>
        ) : null}
      </div>

      <Dialog open={isOutingModalOpen} onOpenChange={setIsOutingModalOpen}>
        <DialogContent className="max-w-[26rem] rounded-[2rem] border-[#DDE7F6] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF7EC_100%)] p-0 shadow-[0_28px_60px_-30px_rgba(23,50,107,0.32)]">
          <div className="p-5">
            <DialogHeader className="text-left">
              <DialogTitle className="text-[1.4rem] font-black tracking-tight text-[#17326B]">외출 체크포인트</DialogTitle>
              <DialogDescription className="text-sm font-semibold leading-6 text-[#17326B]/58">
                어디 다녀오는지와 예상 복귀 시간만 고르면 바로 외출 루트가 저장돼요.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 space-y-4">
              <div>
                <p className="text-[11px] font-black text-[#17326B]/55">어디 다녀오나요?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OUTING_REASON_OPTIONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setAwayReason(reason)}
                      className={cn(
                        'rounded-full border px-3 py-2 text-[11px] font-black transition-all',
                        awayReason === reason
                          ? 'border-[#FF9626] bg-[#FFF4E8] text-[#FF9626]'
                          : 'border-[#DDE7F6] bg-white text-[#17326B]'
                      )}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-black text-[#17326B]/55">언제쯤 돌아오나요?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OUTING_DURATION_OPTIONS.map((duration) => (
                    <button
                      key={duration}
                      type="button"
                      onClick={() => setOutingDuration(duration)}
                      className={cn(
                        'rounded-full border px-3 py-2 text-[11px] font-black transition-all',
                        outingDuration === duration
                          ? 'border-[#17326B] bg-[#17326B] text-white'
                          : 'border-[#DDE7F6] bg-white text-[#17326B]'
                      )}
                    >
                      {duration}분
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.2rem] bg-[#F6F8FC] px-4 py-3 text-sm font-semibold text-[#17326B]/68">
                외출 시작 시각은 현재 시각으로 자동 기록되고, 복귀 예정 시간도 함께 저장돼요.
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOutingModalOpen(false)} className="h-11 flex-1 rounded-2xl border-[#DDE7F6] bg-white font-black text-[#17326B]">
                취소
              </Button>
              <Button type="button" onClick={handleStartOutingPlan} className={cn('h-11 flex-1 rounded-2xl font-black text-white', rewardGradient)}>
                외출 시작
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
        onSubmit={model.handleSubmitInlineStudyTask}
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
