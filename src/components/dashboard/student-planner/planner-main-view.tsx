'use client';

import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
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
  Pencil,
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
const QUICK_PRESET_STORAGE_KEY = 'planner:quick-preset-custom:v1';
const DEFAULT_CUSTOM_SUBJECT_LABEL = '기타';
const DEFAULT_CUSTOM_TIME_PRESET = 100;
const DEFAULT_CUSTOM_STUDY_TYPE = '오답';
const QUICK_BASE_TIME_PRESETS = [30, 50, 80];
const QUICK_BASE_STUDY_TYPES = ['문제풀이', '인강', '복습'];
const OUTING_REASON_OPTIONS = ['식사', '학원', '화장실', '기타'];
const OUTING_DURATION_OPTIONS = ['10', '20', '30', '45'];

type QuickPresetEditorKind = 'subject' | 'minute' | 'studyType' | null;

function sanitizePresetLabel(value: string, fallback: string) {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed.slice(0, 12) : fallback;
}

function sanitizeMinutePreset(value: string | number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_CUSTOM_TIME_PRESET;
  return Math.max(10, Math.min(300, Math.round(parsed)));
}

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
    className: 'border border-white/10 bg-white/10 text-[#FFD79F]',
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
      ? 'border-[#FF9626]/22 bg-[#FF9626]/14 text-[#FFD79F] hover:bg-[#FF9626]/18'
      : tone === 'white'
        ? 'border-white/10 bg-white/8 text-white hover:bg-white/12'
        : 'border-white/10 bg-[#17326B] text-white hover:bg-[#1E4087]';

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
  const [customSubjectLabel, setCustomSubjectLabel] = useState(DEFAULT_CUSTOM_SUBJECT_LABEL);
  const [customMinutePreset, setCustomMinutePreset] = useState(DEFAULT_CUSTOM_TIME_PRESET);
  const [customStudyTypeLabel, setCustomStudyTypeLabel] = useState(DEFAULT_CUSTOM_STUDY_TYPE);
  const [presetEditorKind, setPresetEditorKind] = useState<QuickPresetEditorKind>(null);
  const [presetEditorDraft, setPresetEditorDraft] = useState('');
  const quickSubjectOptions = useMemo(
    () =>
      subjectOptions.map((subject: any) =>
        subject.id === 'etc' ? { ...subject, label: customSubjectLabel } : subject
      ),
    [customSubjectLabel, subjectOptions]
  );
  const quickTimePresets = useMemo(() => [...QUICK_BASE_TIME_PRESETS, customMinutePreset], [customMinutePreset]);
  const quickStudyTypes = useMemo(() => [...QUICK_BASE_STUDY_TYPES, customStudyTypeLabel], [customStudyTypeLabel]);
  const subjectBalance = useMemo(() => {
    const totals = studyTasks.reduce((acc: Record<string, number>, task: any) => {
      const key = task.subject || 'etc';
      const minutes = Math.max(0, Number(task.targetMinutes || 0)) || (resolveStudyPlanMode(task) === 'volume' ? 30 : 0);
      acc[key] = (acc[key] || 0) + minutes;
      return acc;
    }, {} as Record<string, number>);
    const totalMinutes = Object.values(totals as Record<string, number>).reduce(
      (sum: number, value) => sum + (Number(value) || 0),
      0
    );
    return Object.entries(totals as Record<string, number>)
      .map(([subjectKey, minutes]) => {
        const subject = quickSubjectOptions.find((item: any) => item.id === subjectKey);
        const safeMinutes = Number(minutes) || 0;
        const percent = totalMinutes > 0 ? Math.round((safeMinutes / totalMinutes) * 100) : 0;
        return { key: subjectKey, label: subject?.label || '기타', minutes: safeMinutes, percent };
      })
      .sort((left, right) => right.minutes - left.minutes);
  }, [quickSubjectOptions, studyTasks]);

  const [isWrapUpOpen, setIsWrapUpOpen] = useState(false);
  const [isOutingModalOpen, setIsOutingModalOpen] = useState(false);
  const [isRoutineEditOpen, setIsRoutineEditOpen] = useState(false);
  const [routineDraftInTime, setRoutineDraftInTime] = useState(inTime || '17:30');
  const [routineDraftOutTime, setRoutineDraftOutTime] = useState(outTime || '22:30');
  const [questEndTimeChoice, setQuestEndTimeChoice] = useState(outTime || '22:00');
  const [questFocusSubjects, setQuestFocusSubjects] = useState<string[]>(newStudySubject ? [newStudySubject] : []);
  const [questMissionId, setQuestMissionId] = useState(PLANNER_QUICK_TASK_SUGGESTIONS[0]?.id || 'math-problem');
  const [quickStudyType, setQuickStudyType] = useState(QUICK_BASE_STUDY_TYPES[0]);
  const [outingDuration, setOutingDuration] = useState('20');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(QUICK_PRESET_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<{
        subjectLabel: string;
        minutePreset: number;
        studyTypeLabel: string;
      }>;
      if (typeof parsed.subjectLabel === 'string') {
        setCustomSubjectLabel(sanitizePresetLabel(parsed.subjectLabel, DEFAULT_CUSTOM_SUBJECT_LABEL));
      }
      if (typeof parsed.minutePreset === 'number') {
        setCustomMinutePreset(sanitizeMinutePreset(parsed.minutePreset));
      }
      if (typeof parsed.studyTypeLabel === 'string') {
        setCustomStudyTypeLabel(sanitizePresetLabel(parsed.studyTypeLabel, DEFAULT_CUSTOM_STUDY_TYPE));
      }
    } catch {
      // ignore malformed local preset data
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        QUICK_PRESET_STORAGE_KEY,
        JSON.stringify({
          subjectLabel: customSubjectLabel,
          minutePreset: customMinutePreset,
          studyTypeLabel: customStudyTypeLabel,
        })
      );
    } catch {
      // ignore local preset persistence errors
    }
  }, [customMinutePreset, customStudyTypeLabel, customSubjectLabel]);

  useEffect(() => {
    setQuestEndTimeChoice(outTime || '22:00');
  }, [outTime]);

  useEffect(() => {
    setRoutineDraftInTime(inTime || '17:30');
    setRoutineDraftOutTime(outTime || '22:30');
  }, [inTime, outTime]);

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
  const resolvedSubjectLabel = quickSubjectOptions.find((item: any) => item.id === resolvedSubjectValue)?.label || customSubjectLabel;
  const resolvedTargetMinutes = Math.max(0, Number(newStudyMinutes) || missionSuggestion?.targetMinutes || 50);
  const resolvedWindowPreview = useMemo(() => {
    if (!(newStudyMode === 'time' || enableVolumeStudyMinutes) || resolvedTargetMinutes <= 0) return null;
    return getNextAutoWindow(studyTasks, resolvedTargetMinutes, PLAN_DEFAULT_START_TIME);
  }, [enableVolumeStudyMinutes, newStudyMode, resolvedTargetMinutes, studyTasks]);

  const questFocusSummary = questFocusSubjects.length > 0
    ? questFocusSubjects
      .map((subjectId) => quickSubjectOptions.find((item: any) => item.id === subjectId)?.label || '기타')
      .join(' · ')
    : '메인 과목 2개를 골라주세요';

  const subjectBalanceFeedback = useMemo(() => {
    if (subjectBalance.length === 0) return '아직 과목 비중이 없어요. 오늘의 메인 과목부터 골라볼까요?';
    const [topSubject, nextSubject] = subjectBalance;
    if ((topSubject?.percent || 0) >= 55) return `${topSubject.label} 비중이 높아요. ${nextSubject?.label || '다른 과목'}를 조금 섞어보세요.`;
    if ((topSubject?.percent || 0) <= 35) return '과목 밸런스가 안정적이에요. 지금 흐름을 유지해보세요.';
    return `${topSubject.label}을 중심으로 잘 잡혀 있어요. 다음은 ${nextSubject?.label || '보조 과목'} 차례예요.`;
  }, [subjectBalance]);

  const routineWindowLabel = isAbsentMode
    ? '--:--'
    : `${inTime || '17:30'} → ${outTime || questEndTimeChoice || '22:30'}`;
  const todayHeaderSummary = `🔥 ${todayPointTotal} / ${dailyPointCap} pt · ${Math.max(1, todayStreakDays || 0)}일 연속`;
  const totalMissionReward = Math.min(
    dailyPointCap,
    orderedChecklistTasks.reduce((sum: number, task: any) => sum + estimateTaskReward(task), 0)
  );
  const startCtaCaption = orderedChecklistTasks.length === 0
    ? '미션을 추가해주세요'
    : `예상 ${plannedStudyMinutes > 0 ? formatMinutesShort(plannedStudyMinutes) : '자율'} · +${totalMissionReward}P`;
  const routineStateLabel = isAbsentMode
    ? '미등원'
    : hasAwayPlan
      ? '외출 중'
      : hasInPlan || hasOutPlan
        ? `입장 ${inTime || '미정'}`
        : '등원 전';
  const moveSelectedDate = (offset: number) => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + offset);
    setSelectedDate(nextDate);
  };
  const taskCount = orderedChecklistTasks.length;
  const unfinishedCount = remainingStudyTasks.length + remainingPersonalTasks.length;
  const recommendedTasks = PLANNER_QUICK_TASK_SUGGESTIONS.slice(0, 4);
  const isRoutineActive = !isAbsentMode && (hasInPlan || hasOutPlan);
  const startButtonLabel = isAbsentMode
    ? '등원 시작 ▶'
    : taskCount === 0
      ? '미션을 추가해주세요'
      : '시작하기 ▶';

  const openPresetEditor = (kind: Exclude<QuickPresetEditorKind, null>) => {
    setPresetEditorKind(kind);
    setPresetEditorDraft(
      kind === 'subject'
        ? customSubjectLabel
        : kind === 'minute'
          ? String(customMinutePreset)
          : customStudyTypeLabel
    );
  };

  const closePresetEditor = () => {
    setPresetEditorKind(null);
    setPresetEditorDraft('');
  };

  const savePresetEditor = () => {
    if (presetEditorKind === 'subject') {
      const nextLabel = sanitizePresetLabel(presetEditorDraft, DEFAULT_CUSTOM_SUBJECT_LABEL);
      setCustomSubjectLabel(nextLabel);
      if ((newStudySubject || 'etc') === 'etc' && !newStudyTask.trim()) {
        setNewStudyTask(`${nextLabel} ${quickStudyType}`);
      }
    }
    if (presetEditorKind === 'minute') {
      const previousMinute = customMinutePreset;
      const nextMinute = sanitizeMinutePreset(presetEditorDraft);
      setCustomMinutePreset(nextMinute);
      if (Number(newStudyMinutes || 0) === previousMinute) {
        setNewStudyMinutes(String(nextMinute));
      }
    }
    if (presetEditorKind === 'studyType') {
      const previousType = customStudyTypeLabel;
      const nextType = sanitizePresetLabel(presetEditorDraft, DEFAULT_CUSTOM_STUDY_TYPE);
      setCustomStudyTypeLabel(nextType);
      if (quickStudyType === previousType) {
        setQuickStudyType(nextType);
      }
      if (!newStudyTask.trim() || newStudyTask.trim() === `${resolvedSubjectLabel} ${previousType}`) {
        setNewStudyTask(`${resolvedSubjectLabel} ${nextType}`);
      }
    }
    closePresetEditor();
  };

  const handleApplyRoutineEdit = async () => {
    flushSync(() => {
      setInTime(routineDraftInTime);
      setOutTime(routineDraftOutTime);
    });
    await handleSetAttendance('attend');
    setIsRoutineEditOpen(false);
  };

  const handleExtendRoutine = async () => {
    const nextOutTime = addMinutesToClock(outTime || routineDraftOutTime || '22:30', 30);
    flushSync(() => {
      setOutTime(nextOutTime);
      setRoutineDraftOutTime(nextOutTime);
    });
    await handleSetAttendance('attend');
  };

  const handleFinishRoutineNow = async () => {
    const currentClock = createClockFromNow();
    flushSync(() => {
      setOutTime(currentClock);
      setRoutineDraftOutTime(currentClock);
    });
    await handleSetAttendance('attend');
  };

  const handleAddSuggestedTask = async (item: any) => {
    setNewStudySubject(item.subject || 'etc');
    setNewStudyMode('time');
    setNewStudyMinutes(String(item.targetMinutes || 60));
    setNewStudyTask(item.title);
    setQuickStudyType(item.tag || '문제풀이');

    const windowPreview = getNextAutoWindow(studyTasks, item.targetMinutes || 60, PLAN_DEFAULT_START_TIME);
    await handleAddTask(item.title, 'study', {
      taskBlueprint: {
        category: 'study',
        title: item.title,
        subject: item.subject || 'etc',
        studyPlanMode: 'time',
        targetMinutes: item.targetMinutes || 60,
        priority: questFocusSubjects.includes(item.subject || 'etc') ? 'high' : 'medium',
        tag: item.tag || '문제풀이',
        startTime: windowPreview?.startTime,
        endTime: windowPreview?.endTime,
      },
    });
  };

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

  const handleStartCustomQuest = () => {
    setShowQuickAddCard(true);
    setNewStudySubject('etc');
    setNewStudyMode('time');
    setNewStudyMinutes(String(customMinutePreset));
    setQuickStudyType(customStudyTypeLabel);
    setNewStudyTask('');
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
      <div className={cn('planner-main-view student-night-page mx-auto flex w-full max-w-3xl flex-col pb-28', isMobile ? 'gap-4 px-3 pt-3' : 'gap-5 px-4 pt-4')}>
        <header className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="surface-kicker text-[11px]">PLAN</p>
              <h1 className="mt-2 text-[2rem] font-black tracking-tight text-white">계획</h1>
            </div>
            <div className="surface-chip surface-chip--dark px-4 py-2 text-[13px]">
              {todayHeaderSummary}
            </div>
          </div>

          <div className="surface-card surface-card--ghost on-dark flex items-center justify-between rounded-[1.3rem] px-3 py-2">
            <Button type="button" variant="dark" onClick={() => moveSelectedDate(-1)} className="h-9 w-9 rounded-full p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <p className="text-xs font-black text-white">{selectedDateLabel}</p>
              <p className="surface-caption mt-0.5 text-[11px] font-semibold">{isToday ? '오늘 퀘스트' : '다른 날짜 보기'}</p>
            </div>
            <Button type="button" variant="dark" onClick={() => moveSelectedDate(1)} className="h-9 w-9 rounded-full p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <section className="surface-card surface-card--primary on-dark relative rounded-[2rem] px-5 py-5 text-white animate-[planner-fade-rise_0.22s_ease-out]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,179,71,0.22),transparent_34%)]" />
          <div className="relative">
            {floatingPointBursts.map((burst: { id: number; label: string }, index: number) => (
              <div
                key={burst.id}
                className="absolute right-0 top-0 rounded-full border border-[rgba(255,138,31,0.16)] bg-[rgba(255,248,238,0.95)] px-3 py-1 text-xs font-black text-[var(--text-primary)] shadow-[0_18px_30px_-24px_rgba(6,12,34,0.4)] animate-[planner-point-burst_0.95s_ease-out_forwards]"
                style={{ marginTop: `${index * 8}px` }}
              >
                +{burst.label}P
              </div>
            ))}

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="surface-chip surface-chip--dark gap-2 px-3 py-1 text-[11px]">
                  오늘 루틴
                </div>
                <p className="surface-caption mt-2 text-sm font-semibold">
                  {format(selectedDate, 'EEEE', { locale: ko })} · 자동 적용됨
                </p>
              </div>
              {!isPast ? (
                <button
                  type="button"
                  onClick={() => setIsRoutineEditOpen(true)}
                  className="surface-chip surface-chip--accent px-3 py-2 text-xs"
                >
                  ⚡ 오늘만 수정
                </button>
              ) : null}
            </div>

            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-[2.2rem] font-black tracking-tight text-white md:text-[2.8rem]">{routineWindowLabel}</p>
                <p className="surface-caption mt-2 text-sm font-semibold">{routineStateLabel}</p>
              </div>
              <div className="surface-card surface-card--ghost on-dark rounded-2xl px-4 py-3 text-right">
                <p className="text-[10px] font-black tracking-[0.18em] text-[var(--text-on-dark-muted)]">오늘 목표</p>
                <p className="mt-2 text-lg font-black text-[var(--accent-orange-soft)]">{plannedStudyMinutes > 0 ? formatMinutesShort(plannedStudyMinutes) : studyGoalSummaryLabel}</p>
              </div>
            </div>

            <div className="mt-5 rounded-full bg-white/10 p-1">
              <div className="relative overflow-hidden rounded-full">
                <Progress
                  value={completionPercent}
                  className="h-3 bg-white/10 [&>div]:bg-[linear-gradient(90deg,#FFD79F_0%,#FFB347_32%,#FF9626_72%,#2FAA7D_100%)]"
                />
                <div className="pointer-events-none absolute inset-y-0 w-20 animate-[planner-shimmer-slide_2.8s_linear_infinite] bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.42)_55%,rgba(255,255,255,0)_100%)]" />
              </div>
            </div>

            {!isPast ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {!isRoutineActive ? (
                  <Button
                    type="button"
                    onClick={() => handleSetAttendance('attend')}
                    disabled={isSubmitting}
                    className={cn('h-12 rounded-full px-5 font-black text-white shadow-[0_18px_34px_-24px_rgba(255,150,38,0.6)] animate-[planner-cta-breathe_2.8s_ease-in-out_infinite]', rewardGradient)}
                  >
                    <CalendarCheck2 className="mr-2 h-4 w-4" />
                    등원 시작
                  </Button>
                ) : null}
                {hasAwayPlan ? (
                  <ActionChipButton icon={ArrowRight} label="복귀하기" onClick={clearAwayPlan} disabled={isSubmitting} tone="white" />
                ) : null}
                {isRoutineActive && !hasAwayPlan ? (
                  <>
                    <ActionChipButton icon={Clock3} label="+30분 연장" onClick={handleExtendRoutine} disabled={isSubmitting} tone="white" />
                    <ActionChipButton icon={CalendarCheck2} label="하원 완료" onClick={handleFinishRoutineNow} disabled={isSubmitting} tone="orange" />
                  </>
                ) : null}
                {!hasAwayPlan ? (
                  <ActionChipButton icon={Clock3} label="외출하기" onClick={() => setIsOutingModalOpen(true)} disabled={isSubmitting} tone="white" />
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="surface-card surface-card--secondary on-dark rounded-[1.8rem] px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="surface-kicker text-[11px]">TODAY MISSION</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">오늘 미션</h2>
            </div>
            {!isPast ? (
              <div className="flex gap-2">
                <button type="button" onClick={handleCopyYesterdayPlan} className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-[11px] font-black text-white">
                  어제 복사
                </button>
                <button type="button" onClick={() => setIsTemplateSheetOpen(true)} className="rounded-full border border-[#FFB347]/22 bg-[#FF9626]/12 px-3 py-2 text-[11px] font-black text-[#FFD79F]">
                  템플릿
                </button>
              </div>
            ) : null}
          </div>

          {isPast ? (
            <div className="mt-4 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-black text-white/65">
              지난 날짜는 기록 확인 중심으로 보여드릴게요.
            </div>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                {recommendedTasks.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddSuggestedTask(item)}
                    disabled={isSubmitting}
                    className="surface-chip surface-chip--dark px-3 py-2 text-[12px] transition hover:bg-white/12 disabled:opacity-45"
                  >
                    {item.title}
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-2.5">
                {taskCount === 0 ? (
                  <div className="surface-card surface-card--ghost on-dark rounded-[1.3rem] border-dashed px-4 py-5 text-center">
                    <p className="text-sm font-black text-white">아직 미션이 없어요</p>
                    <p className="surface-caption mt-2 text-[12px] font-semibold">추천을 누르거나 어제 계획을 바로 불러오세요.</p>
                  </div>
                ) : (
                  orderedChecklistTasks.map((task: any) => {
                    const isStudyTask = task.category === 'study';
                    const isDone = task.done;
                    const isVolumeTask = resolveStudyPlanMode(task) === 'volume';
                    const durationLabel = task.startTime && task.endTime
                      ? formatClockRange(task.startTime, task.endTime)
                      : task.targetMinutes
                        ? formatDurationLabel(task.targetMinutes)
                        : '자율';
                    const detailLabel = isStudyTask ? buildStudyTaskMeta(task) : (task.tag || '보조 일정');
                    const rewardLabel = `+${estimateTaskReward(task)}P`;
                    const progressPercent = isVolumeTask ? 0 : computeTimeProgressPercent(task, isToday);
                    const badge = getChecklistBadge(task, quickSubjectOptions);

                    return (
                      <div
                        key={task.id}
                        className={cn(
                          'rounded-[1.35rem] border px-4 py-3 transition-all animate-[planner-fade-rise_0.18s_ease-out]',
                          isDone
                            ? 'border-emerald-400/18 bg-emerald-500/8'
                            : progressPercent > 0
                              ? 'border-[#FFB347]/24 bg-[#FF9626]/10'
                              : 'border-white/10 bg-white/8'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleTask(task)}
                            className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-black transition',
                              isDone ? 'border-emerald-300/40 bg-emerald-400/20 text-emerald-100' : 'border-white/16 bg-white/10 text-white'
                            )}
                          >
                            {isDone ? '✔' : ''}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                            <p className={cn('truncate text-[15px] font-black', isDone ? 'text-white/88 line-through decoration-white/30' : 'text-white')}>
                                {task.title}
                              </p>
                              <Badge className={cn('rounded-full px-2 py-0.5 text-[10px] font-black shadow-none', badge.className)}>
                                {badge.label}
                              </Badge>
                            </div>
                            <p className="surface-caption mt-1 text-[12px] font-semibold">{durationLabel} · {detailLabel}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[11px] font-black text-[var(--accent-orange-soft)]">{rewardLabel}</p>
                            <button
                              type="button"
                              onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                              className="mt-1 text-[11px] font-black text-[var(--text-on-dark-soft)]"
                            >
                              {isDone ? '완료됨' : progressPercent > 0 ? '진행 중' : '시작 ▶'}
                            </button>
                          </div>
                        </div>

                        {progressPercent > 0 && !isDone ? (
                          <div className="mt-3 rounded-full bg-white/10 p-1">
                            <div className="relative overflow-hidden rounded-full">
                              <Progress
                                value={progressPercent}
                                className="h-2.5 bg-white/10 [&>div]:bg-[linear-gradient(90deg,#FFD79F_0%,#FFB347_40%,#FF9626_100%)]"
                              />
                              <div className="pointer-events-none absolute inset-y-0 w-14 animate-[planner-shimmer-slide_2.4s_linear_infinite] bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.36)_52%,rgba(255,255,255,0)_100%)]" />
                            </div>
                          </div>
                        ) : null}

                        {expandedTaskId === task.id ? (
                          <div className="mt-3 rounded-[1.1rem] border border-white/10 bg-[#0F2149]/80 p-3">
                            {isStudyTask && !isVolumeTask ? (
                              <div className={cn('grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                                <Input
                                  type="time"
                                  value={task.startTime || ''}
                                  onChange={(event) => handleUpdateStudyWindow(task, event.target.value, task.endTime || '')}
                                  className="h-10 rounded-xl border-white/10 bg-white/8 font-bold text-white"
                                />
                                <Input
                                  type="time"
                                  value={task.endTime || ''}
                                  onChange={(event) => handleUpdateStudyWindow(task, task.startTime || '', event.target.value)}
                                  className="h-10 rounded-xl border-white/10 bg-white/8 font-bold text-white"
                                />
                              </div>
                            ) : null}

                            {isStudyTask && isVolumeTask ? (
                              <div className="flex flex-wrap gap-2">
                                {[10, 20, 30, 50].map((value) => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => handleCommitStudyActualAmount(task, value)}
                                    className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-[11px] font-black text-white"
                                  >
                                    +{value}
                                  </button>
                                ))}
                              </div>
                            ) : null}

                            <div className="mt-3 flex flex-wrap gap-2">
                              {!isDone ? (
                                <button
                                  type="button"
                                  onClick={() => handleToggleTask(task)}
                                  className="rounded-full bg-[linear-gradient(135deg,#173A82_0%,#22479B_55%,#FF7A16_170%)] px-4 py-2 text-[11px] font-black text-white"
                                >
                                  완료
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(task)}
                                className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-[11px] font-black text-white/72"
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAddCard((prev: boolean) => !prev)}
                  className="surface-chip surface-chip--dark px-4 py-2 text-[12px]"
                >
                  + 추가
                </button>
                <button
                  type="button"
                  onClick={handleStartCustomQuest}
                  className="surface-chip surface-chip--accent px-4 py-2 text-[12px]"
                >
                  오늘만 직접 쓰기
                </button>
                <button
                  type="button"
                  onClick={handleCopyYesterdayPlan}
                  className="surface-chip surface-chip--dark px-4 py-2 text-[12px] text-[var(--text-on-dark-soft)]"
                >
                  어제 불러오기
                </button>
              </div>

              {showQuickAddCard ? (
                <div className="surface-card surface-card--ghost on-dark mt-4 rounded-[1.45rem] p-4 animate-[planner-fade-rise_0.22s_ease-out]">
                  <div className="space-y-3">
                    <Input
                      value={newStudyTask}
                      onChange={(event) => setNewStudyTask(event.target.value)}
                      placeholder={`예: ${resolvedSubjectLabel} ${quickStudyType}`}
                      className="h-11 rounded-2xl border-white/10 bg-white/8 font-bold text-white placeholder:text-white/35"
                    />

                    <div className="flex flex-wrap gap-2">
                      {quickSubjectOptions.filter((subject: any) => subject.id !== 'etc').map((subject: any) => (
                        <button
                          key={subject.id}
                          type="button"
                          onClick={() => setNewStudySubject(subject.id)}
                          className={cn(
                            'rounded-full border px-3 py-2 text-[11px] font-black transition-all',
                            resolvedSubjectValue === subject.id
                              ? 'border-[#FFB347]/24 bg-[#FF9626]/16 text-[#FFD79F]'
                              : 'border-white/10 bg-white/8 text-white'
                          )}
                        >
                          {subject.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setNewStudySubject('etc')}
                        className={cn(
                          'rounded-full border px-3 py-2 text-[11px] font-black transition-all',
                          resolvedSubjectValue === 'etc'
                            ? 'border-[#FFB347]/24 bg-[#FF9626]/16 text-[#FFD79F]'
                            : 'border-white/10 bg-white/8 text-white'
                        )}
                      >
                        {customSubjectLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => openPresetEditor('subject')}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/8 px-3 py-2 text-[10px] font-black text-white/82 transition-all hover:bg-white/12"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        수정
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {quickTimePresets.map((minute, index) => (
                        <button
                          key={`${minute}-${index}`}
                          type="button"
                          onClick={() => setNewStudyMinutes(String(minute))}
                          className={cn(
                            'rounded-full border px-3 py-2 text-[11px] font-black transition-all',
                            Number(newStudyMinutes || missionSuggestion?.targetMinutes || 0) === minute
                              ? 'border-[#FFB347]/24 bg-[#FF9626]/16 text-[#FFD79F]'
                              : 'border-white/10 bg-white/8 text-white'
                          )}
                        >
                          {minute}분
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => openPresetEditor('minute')}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/8 px-3 py-2 text-[10px] font-black text-white/82 transition-all hover:bg-white/12"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        수정
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {quickStudyTypes.map((type) => (
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
                              ? 'border-[#FFB347]/24 bg-[#FF9626]/16 text-[#FFD79F]'
                              : 'border-white/10 bg-white/8 text-white'
                          )}
                        >
                          {type}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => openPresetEditor('studyType')}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/8 px-3 py-2 text-[10px] font-black text-white/82 transition-all hover:bg-white/12"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        수정
                      </button>
                    </div>

                    <div className={cn('rounded-[1.1rem] border border-white/10 bg-white/6 px-4 py-3', isMobile ? 'space-y-3' : 'flex items-center justify-between gap-3')}>
                      <div>
                        <p className="text-[10px] font-black tracking-[0.18em] text-[#FF9626]">AUTO SCHEDULE</p>
                        <p className="mt-1 text-[12px] font-bold text-white">{resolvedWindowPreview ? `${resolvedWindowPreview.startTime} → ${resolvedWindowPreview.endTime}` : '시간은 자동으로 이어 붙어요'}</p>
                        <p className="mt-2 text-[11px] font-semibold text-white/58">그날만 필요한 미션은 위에 직접 적고 바로 퀘스트로 넣어도 돼요.</p>
                      </div>
                      <Button
                        type="button"
                        onClick={handleCreateQuickBlock}
                        disabled={isSubmitting || !resolvedSubjectValue}
                        className={cn('h-11 rounded-2xl px-5 font-black text-white shadow-[0_18px_30px_-20px_rgba(23,58,130,0.45)]', rewardGradient, isMobile && 'w-full')}
                      >
                        퀘스트로 넣기
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        {!isPast ? (
          <section className="sticky bottom-24 z-20 rounded-[1.7rem] border border-[#FFB347]/18 bg-[linear-gradient(135deg,rgba(255,179,71,0.16)_0%,rgba(22,40,79,0.96)_38%,rgba(12,27,63,0.94)_100%)] px-4 py-4 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.58)] backdrop-blur-sm">
            <p className="text-[12px] font-black tracking-[0.18em] text-[#FFD79F]">🔥 오늘 플레이 시작</p>
            <p className="mt-2 text-sm font-semibold text-white/72">{startCtaCaption}</p>
            <Button
              type="button"
              disabled={isSubmitting || taskCount === 0}
              onClick={async () => {
                if (!isAbsentMode && !hasInPlan && !hasOutPlan) {
                  await handleSetAttendance('attend');
                }
                const nextTask = orderedChecklistTasks.find((task: any) => !task.done) || orderedChecklistTasks[0];
                if (nextTask) setExpandedTaskId(nextTask.id);
              }}
              className={cn('mt-4 h-12 w-full rounded-[1.4rem] px-5 font-black text-white shadow-[0_20px_36px_-24px_rgba(255,150,38,0.55)]', rewardGradient)}
            >
              {startButtonLabel}
            </Button>
          </section>
        ) : null}

        <Collapsible open={isWrapUpOpen} onOpenChange={setIsWrapUpOpen}>
          <section className="rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(22,40,79,0.96)_0%,rgba(12,27,63,0.92)_100%)] shadow-[0_20px_44px_-36px_rgba(0,0,0,0.5)]">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left">
                <div>
                  <p className="text-[11px] font-black tracking-[0.18em] text-white/42">SUMMARY</p>
                  <p className="mt-1 text-lg font-black text-white">오늘 요약</p>
                </div>
                <ChevronDown className={cn('h-5 w-5 text-white transition-transform', isWrapUpOpen && 'rotate-180')} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-white/10 px-4 pb-4">
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-[1.1rem] border border-white/10 bg-white/8 px-3 py-3">
                  <p className="text-[10px] font-black tracking-[0.16em] text-white/42">계획 시간</p>
                  <p className="mt-2 text-lg font-black text-white">{formatMinutesShort(plannedStudyMinutes)}</p>
                </div>
                <div className="rounded-[1.1rem] border border-white/10 bg-white/8 px-3 py-3">
                  <p className="text-[10px] font-black tracking-[0.16em] text-white/42">실제 공부</p>
                  <p className="mt-2 text-lg font-black text-white">{formatMinutesShort(actualStudyMinutes)}</p>
                </div>
                <div className="rounded-[1.1rem] border border-white/10 bg-white/8 px-3 py-3">
                  <p className="text-[10px] font-black tracking-[0.16em] text-white/42">완료율</p>
                  <p className="mt-2 text-lg font-black text-white">{completionPercent}%</p>
                </div>
                <div className="rounded-[1.1rem] border border-white/10 bg-white/8 px-3 py-3">
                  <p className="text-[10px] font-black tracking-[0.16em] text-white/42">외출 횟수</p>
                  <p className="mt-2 text-lg font-black text-white">{outingCount}회</p>
                </div>
              </div>

              {unfinishedCount > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <ActionChipButton icon={ChevronRight} label="내일로 미루기" onClick={handleMoveUnfinishedToTomorrow} disabled={isSubmitting} />
                  <ActionChipButton icon={BookCopy} label="템플릿 반영" onClick={handleSaveUnfinishedAsTemplate} disabled={isSubmitting} tone="white" />
                  <ActionChipButton icon={StickyNote} label="삭제하기" onClick={handleDeleteUnfinished} disabled={isSubmitting} tone="orange" />
                </div>
              ) : (
                <div className="mt-4 rounded-[1.2rem] border border-dashed border-white/10 bg-white/6 px-4 py-4 text-sm font-semibold text-white/58">
                  오늘 정리할 남은 미션이 없어요.
                </div>
              )}
            </CollapsibleContent>
          </section>
        </Collapsible>

        <Collapsible open={isRoutineSectionOpen} onOpenChange={setIsRoutineSectionOpen}>
          <section className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(22,40,79,0.96)_0%,rgba(12,27,63,0.92)_100%)] shadow-[0_24px_48px_-38px_rgba(0,0,0,0.52)]">
            <CollapsibleTrigger asChild>
              <button type="button" className={cn('flex w-full gap-3 p-5 text-left', isMobile ? 'flex-col items-start' : 'items-center justify-between')}>
                <div className="min-w-0">
                  <p className="text-[11px] font-black tracking-[0.18em] text-white/42">ROUTINE</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-white">루틴 관리</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-white/58">
                    입실, 외출, 생활 루틴은 필요한 순간에만 펼쳐서 관리하세요.
                  </p>
                </div>
                <div className={cn('flex items-center gap-3', isMobile && 'w-full justify-between')}>
                  <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-black text-white shadow-none">
                    {routineCountLabel}
                  </Badge>
                  <ChevronDown className={cn('h-5 w-5 text-white transition-transform', isRoutineSectionOpen && 'rotate-180')} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className={cn('border-t border-white/10 px-4 pb-4', !isMobile && 'px-5 pb-5')}>
              <div className={cn('mt-5 grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]')}>
                <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(29,53,101,0.96)_0%,rgba(15,33,73,0.9)_100%)] p-4 shadow-[0_18px_38px_-32px_rgba(0,0,0,0.55)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-white">오늘 출석 정보</p>
                      <p className="mt-1 text-[12px] font-semibold leading-5 text-white/58">
                        등원, 하원, 외출 흐름을 기록해두면 원장도 실제 학습 흐름을 더 정확히 볼 수 있어요.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isAbsentMode ? (
                        <Badge className="rounded-full border border-[#FFB347]/18 bg-[#FF9626]/12 px-3 py-1 text-[10px] font-black text-[#FFD79F] shadow-none">
                          오늘 미등원
                        </Badge>
                      ) : null}
                      {hasInPlan && hasOutPlan ? (
                        <Badge className="rounded-full border border-emerald-400/18 bg-emerald-500/12 px-3 py-1 text-[10px] font-black text-emerald-200 shadow-none">
                          출석 계획 저장됨
                        </Badge>
                      ) : null}
                      {hasAwayPlan ? (
                        <Badge className="rounded-full border border-[#FFB347]/18 bg-[#FF9626]/10 px-3 py-1 text-[10px] font-black text-[#FFD79F] shadow-none">
                          외출 포함
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className={cn('mt-4 grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">등원 예정</p>
                      <Input type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} disabled={isPast || isSubmitting} className="h-11 rounded-2xl border-white/10 bg-white/8 font-black text-white" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">하원 예정</p>
                      <Input type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} disabled={isPast || isSubmitting} className="h-11 rounded-2xl border-white/10 bg-white/8 font-black text-white" />
                    </div>
                  </div>

                  <div className={cn('mt-4 grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">외출 시작</p>
                      <Input type="time" value={awayStartTime} onChange={(e) => setAwayStartTime(e.target.value)} disabled={isPast || isSubmitting} className="h-11 rounded-2xl border-white/10 bg-white/8 font-black text-white" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">복귀 예정</p>
                      <Input type="time" value={awayEndTime} onChange={(e) => setAwayEndTime(e.target.value)} disabled={isPast || isSubmitting} className="h-11 rounded-2xl border-white/10 bg-white/8 font-black text-white" />
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">사유</p>
                    <Input
                      value={awayReason}
                      onChange={(e) => setAwayReason(e.target.value)}
                      placeholder="예: 학원, 병원, 저녁 식사"
                      disabled={isPast || isSubmitting}
                      className="h-11 rounded-2xl border-white/10 bg-white/8 font-bold text-white placeholder:text-white/35"
                    />
                  </div>

                  {!isPast ? (
                    <div className={cn('mt-4 gap-2', isMobile ? 'grid grid-cols-1' : 'flex flex-wrap')}>
                      <Button type="button" onClick={() => handleSetAttendance('attend')} disabled={isSubmitting} className="h-11 rounded-2xl bg-[linear-gradient(135deg,#173A82_0%,#22479B_60%,#FF7A16_170%)] px-4 font-black text-white shadow-[0_18px_30px_-20px_rgba(255,122,22,0.35)]">
                        <CalendarCheck2 className="mr-2 h-4 w-4" />
                        오늘 출석 저장
                      </Button>
                      <Button type="button" variant="outline" onClick={() => handleSetAttendance('absent')} disabled={isSubmitting} className="h-11 rounded-2xl border-white/10 bg-white/8 px-4 font-black text-white">
                        오늘 미등원
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsRoutineCopyDialogOpen(true)} disabled={isSubmitting || !hasCopyableRoutines} className="h-11 rounded-2xl border-white/10 bg-white/8 px-4 font-black text-white">
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
                    <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/6 p-5 text-center">
                      <p className="text-sm font-black text-white">저장된 루틴이 아직 없어요</p>
                      <p className="mt-2 text-[12px] font-semibold leading-5 text-white/55">
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
          <section className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(22,40,79,0.96)_0%,rgba(12,27,63,0.92)_100%)] shadow-[0_24px_48px_-38px_rgba(0,0,0,0.5)]">
            <CollapsibleTrigger asChild>
              <button type="button" className={cn('flex w-full gap-3 p-5 text-left', isMobile ? 'flex-col items-start' : 'items-center justify-between')}>
                <div className="min-w-0">
                  <p className="text-[11px] font-black tracking-[0.18em] text-white/42">EXTRA</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-white">기타 계획</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-white/58">
                    메모, 준비물, 상담 같은 보조 일정만 따로 모아두고 필요할 때 펼쳐보세요.
                  </p>
                </div>
                <div className={cn('flex items-center gap-3', isMobile && 'w-full justify-between')}>
                  <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-black text-white shadow-none">
                    {personalTasks.length}개
                  </Badge>
                  <ChevronDown className={cn('h-5 w-5 text-white transition-transform', isMemoSectionOpen && 'rotate-180')} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className={cn('border-t border-white/10 px-4 pb-4', !isMobile && 'px-5 pb-5')}>
              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(29,53,101,0.96)_0%,rgba(18,36,79,0.9)_100%)] p-4 shadow-[0_18px_40px_-34px_rgba(0,0,0,0.46)]">
                <div className={cn('flex flex-col gap-3', !isMobile && 'md:flex-row md:items-center')}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-white">짧은 메모나 일정 추가</p>
                    <p className="mt-1 text-[12px] font-semibold leading-5 text-white/58">
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
                        className="h-11 flex-1 rounded-2xl border-white/10 bg-white/8 font-bold text-white placeholder:text-white/35"
                      />
                      <Button
                        type="button"
                        onClick={() => handleAddTask(newPersonalTask, 'personal')}
                        disabled={isSubmitting || !newPersonalTask.trim()}
                        className="h-11 rounded-2xl bg-[linear-gradient(135deg,#173A82_0%,#22479B_55%,#FF7A16_170%)] px-4 font-black text-white shadow-[0_18px_30px_-22px_rgba(255,122,22,0.35)]"
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
                      className="h-10 rounded-2xl border-white/10 bg-white/8 px-4 text-[11px] font-black text-white"
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      학습/기타 반복 복사
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                {personalTasks.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/6 p-5 text-center">
                    <p className="text-sm font-black text-white">기타 일정은 필요할 때만 적어도 충분해요</p>
                    <p className="mt-2 text-[12px] font-semibold leading-5 text-white/55">
                      공부 흐름을 방해하지 않도록, 보조 일정은 간단하게 남기는 구조로 두었어요.
                    </p>
                  </div>
                ) : (
                  personalTasks.map((task: any) => (
                    <PlannerChecklistItem
                      key={task.id}
                      task={task}
                      badgeLabel={task.tag || '메모'}
                      badgeClassName="border border-white/10 bg-white/10 text-[#FFD79F]"
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
            <section className="rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(22,40,79,0.96)_0%,rgba(12,27,63,0.92)_100%)] shadow-[0_24px_48px_-38px_rgba(0,0,0,0.5)]">
              <CollapsibleTrigger asChild>
                <button type="button" className={cn('flex w-full gap-3 p-5 text-left', isMobile ? 'flex-col items-start' : 'items-center justify-between')}>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black tracking-[0.18em] text-white/42">WRAP UP</p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-white">하루 정리</h3>
                    <p className="mt-2 text-sm font-semibold leading-6 text-white/58">
                      남은 할 일은 내일로 미루거나, 템플릿에 반영하거나, 오늘 안에서 정리할 수 있어요.
                    </p>
                  </div>
                  <div className={cn('flex items-center gap-3', isMobile && 'w-full justify-between')}>
                    <Badge className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-black text-white shadow-none">
                      {remainingStudyTasks.length + remainingPersonalTasks.length}개
                    </Badge>
                    <ChevronDown className={cn('h-5 w-5 text-white transition-transform', isWrapUpOpen && 'rotate-180')} />
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className={cn('border-t border-white/10 px-4 pb-4', !isMobile && 'px-5 pb-5')}>
                {remainingStudyTasks.length + remainingPersonalTasks.length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <ActionChipButton icon={ChevronRight} label="내일로 미루기" onClick={handleMoveUnfinishedToTomorrow} disabled={isSubmitting} />
                    <ActionChipButton icon={BookCopy} label="템플릿 반영" onClick={handleSaveUnfinishedAsTemplate} disabled={isSubmitting} tone="white" />
                    <ActionChipButton icon={StickyNote} label="삭제하기" onClick={handleDeleteUnfinished} disabled={isSubmitting} tone="orange" />
                  </div>
                ) : (
                  <div className="mt-5 rounded-[1.35rem] border border-dashed border-white/10 bg-white/6 p-5 text-center">
                    <p className="text-sm font-black text-white">오늘 정리할 남은 항목이 없어요</p>
                    <p className="mt-2 text-[12px] font-semibold leading-5 text-white/55">
                      체크리스트가 깔끔하게 정리되면 내일 계획도 훨씬 가벼워져요.
                    </p>
                  </div>
                )}
              </CollapsibleContent>
            </section>
          </Collapsible>
        ) : null}
      </div>

      <Dialog open={isRoutineEditOpen} onOpenChange={setIsRoutineEditOpen}>
        <DialogContent className="fixed inset-x-0 bottom-0 top-auto w-full max-w-none translate-x-0 translate-y-0 rounded-t-[2rem] rounded-b-none border-white/10 bg-[linear-gradient(180deg,#16284F_0%,#0F2149_100%)] p-0 text-white shadow-[0_-24px_60px_-30px_rgba(0,0,0,0.65)] sm:left-1/2 sm:max-w-md sm:-translate-x-1/2">
          <div className="p-5">
            <DialogHeader className="text-left">
              <DialogTitle className="text-[1.4rem] font-black tracking-tight text-white">오늘만 수정</DialogTitle>
              <DialogDescription className="text-sm font-semibold leading-6 text-white/58">
                오늘 등원과 하원 시간만 빠르게 바꾸고 바로 반영할 수 있어요.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-[11px] font-black text-white/55">등원</p>
                <Input
                  type="time"
                  value={routineDraftInTime}
                  onChange={(event) => setRoutineDraftInTime(event.target.value)}
                  className="h-12 rounded-2xl border-white/10 bg-white/8 font-black text-white"
                />
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-black text-white/55">하원</p>
                <Input
                  type="time"
                  value={routineDraftOutTime}
                  onChange={(event) => setRoutineDraftOutTime(event.target.value)}
                  className="h-12 rounded-2xl border-white/10 bg-white/8 font-black text-white"
                />
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <Button type="button" onClick={handleApplyRoutineEdit} className={cn('h-12 w-full rounded-2xl font-black text-white', rewardGradient)}>
                오늘만 적용
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsRoutineEditOpen(false);
                  setIsRoutineSectionOpen(true);
                }}
                className="h-12 w-full rounded-2xl border-white/10 bg-white/8 font-black text-white"
              >
                기본 루틴 수정
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isOutingModalOpen} onOpenChange={setIsOutingModalOpen}>
        <DialogContent className="max-w-[26rem] rounded-[2rem] border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(255,179,71,0.12),transparent_24%),linear-gradient(180deg,#16284F_0%,#0F2149_100%)] p-0 text-white shadow-[0_28px_60px_-30px_rgba(0,0,0,0.58)]">
          <div className="p-5">
            <DialogHeader className="text-left">
              <DialogTitle className="text-[1.4rem] font-black tracking-tight text-white">외출 체크포인트</DialogTitle>
              <DialogDescription className="text-sm font-semibold leading-6 text-white/58">
                어디 다녀오는지와 예상 복귀 시간만 고르면 바로 외출 루트가 저장돼요.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 space-y-4">
              <div>
                <p className="text-[11px] font-black text-white/55">어디 다녀오나요?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OUTING_REASON_OPTIONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setAwayReason(reason)}
                      className={cn(
                        'rounded-full border px-3 py-2 text-[11px] font-black transition-all',
                        awayReason === reason
                          ? 'border-[#FFB347]/18 bg-[#FF9626]/14 text-[#FFD79F]'
                          : 'border-white/10 bg-white/8 text-white'
                      )}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-black text-white/55">언제쯤 돌아오나요?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OUTING_DURATION_OPTIONS.map((duration) => (
                    <button
                      key={duration}
                      type="button"
                      onClick={() => setOutingDuration(duration)}
                      className={cn(
                        'rounded-full border px-3 py-2 text-[11px] font-black transition-all',
                        outingDuration === duration
                          ? 'border-[#FFB347]/18 bg-[#FF9626]/14 text-[#FFD79F]'
                          : 'border-white/10 bg-white/8 text-white'
                      )}
                    >
                      {duration}분
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-white/10 bg-white/8 px-4 py-3 text-sm font-semibold text-white/62">
                외출 시작 시각은 현재 시각으로 자동 기록되고, 복귀 예정 시간도 함께 저장돼요.
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOutingModalOpen(false)} className="h-11 flex-1 rounded-2xl border-white/10 bg-white/8 font-black text-white">
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
        subjectOptions={quickSubjectOptions}
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

      <Dialog open={presetEditorKind !== null} onOpenChange={(open) => !open && closePresetEditor()}>
        <DialogContent
          motionPreset="dashboard-premium"
          className={cn(
            'overflow-hidden border-none bg-[linear-gradient(180deg,#13285A_0%,#0E1B3D_100%)] p-0 shadow-2xl',
            isMobile ? 'w-[min(92vw,24rem)] rounded-[1.6rem]' : 'w-[min(28rem,92vw)] rounded-[1.8rem]'
          )}
        >
          <div className="bg-[radial-gradient(circle_at_top_right,rgba(255,179,71,0.18),transparent_30%),linear-gradient(135deg,#10295f_0%,#17326B_46%,#0f2149_100%)] p-5 text-white">
            <DialogHeader className="text-left">
              <DialogTitle className="text-xl font-black tracking-tight">
                {presetEditorKind === 'subject'
                  ? '과목 버튼 수정'
                  : presetEditorKind === 'minute'
                    ? '시간 버튼 수정'
                    : '유형 버튼 수정'}
              </DialogTitle>
              <DialogDescription className="mt-1 text-[11px] font-semibold text-white/72">
                자주 쓰는 마지막 버튼을 내 스타일로 바꿔둘 수 있어요.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 p-5 text-white">
            {presetEditorKind === 'minute' ? (
              <Input
                type="number"
                min={10}
                max={300}
                step={5}
                value={presetEditorDraft}
                onChange={(event) => setPresetEditorDraft(event.target.value)}
                className="h-12 rounded-2xl border-white/10 bg-white/8 text-center font-black text-white"
                placeholder="예: 100"
              />
            ) : (
              <Input
                value={presetEditorDraft}
                onChange={(event) => setPresetEditorDraft(event.target.value)}
                className="h-12 rounded-2xl border-white/10 bg-white/8 font-black text-white placeholder:text-white/35"
                placeholder={presetEditorKind === 'subject' ? '예: 생명과학' : '예: 오답정리'}
                maxLength={12}
              />
            )}

            <div className="rounded-[1.15rem] border border-white/10 bg-white/6 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/55">preview</div>
              <div className="mt-2 inline-flex items-center rounded-full border border-[#FFB347]/24 bg-[#FF9626]/16 px-3 py-2 text-[11px] font-black text-[#FFD79F]">
                {presetEditorKind === 'minute'
                  ? `${sanitizeMinutePreset(presetEditorDraft || customMinutePreset)}분`
                  : sanitizePresetLabel(
                      presetEditorDraft || (presetEditorKind === 'subject' ? customSubjectLabel : customStudyTypeLabel),
                      presetEditorKind === 'subject' ? DEFAULT_CUSTOM_SUBJECT_LABEL : DEFAULT_CUSTOM_STUDY_TYPE
                    )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={closePresetEditor}
                className="h-11 flex-1 rounded-2xl border border-white/10 bg-white/8 text-white hover:bg-white/12"
              >
                취소
              </Button>
              <Button
                type="button"
                onClick={savePresetEditor}
                className="h-11 flex-1 rounded-2xl bg-[linear-gradient(135deg,#173A82_0%,#22479B_58%,#FF7A16_170%)] font-black text-white shadow-[0_18px_30px_-20px_rgba(23,58,130,0.45)]"
              >
                저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
