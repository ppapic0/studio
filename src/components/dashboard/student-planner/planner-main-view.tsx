'use client';

import { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { format, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  CalendarCheck2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Flame,
  Layers3,
  ListTodo,
  Pencil,
  Plus,
  Sparkles,
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
  type AttendanceAwaySlot,
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
      className: 'border border-[#FFB347]/28 bg-[#FF9626]/18 text-[var(--accent-orange-soft)]',
    };
  }

  const subject = subjectOptions.find((item) => item.id === (task.subject || 'etc'));
  return {
    label: `${subject?.label || '기타'} · ${resolveStudyPlanMode(task) === 'volume' ? '분량형' : '시간형'}`,
    className: 'border border-[#FFB347]/22 bg-[#FF9626]/14 text-[var(--accent-orange-soft)]',
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
      ? 'border-[#FFB347]/28 bg-[#FF9626]/18 text-[var(--accent-orange-soft)] hover:bg-[#FF9626]/24'
      : tone === 'white'
        ? 'border-white/12 bg-white/[0.1] text-[var(--text-on-dark)] hover:bg-white/[0.14]'
        : 'border-white/12 bg-[#17326B] text-white hover:bg-[#22479B]';

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
    handleToggleTask,
    handleDeleteTask,
    handleCommitStudyActualAmount,
    handleUpdateStudyWindow,
    isRoutineSectionOpen,
    setIsRoutineSectionOpen,
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
    extraAwayPlans,
    setExtraAwayPlans,
    isAbsentMode,
    hasAwayPlan,
    hasInPlan,
    hasOutPlan,
    handleSetAttendance,
    newRoutineTitle,
    setNewRoutineTitle,
    selectedRoutineTemplateKey,
    handleRoutineTemplateSelect,
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

  const [isOutingModalOpen, setIsOutingModalOpen] = useState(false);
  const [isRoutineEditOpen, setIsRoutineEditOpen] = useState(false);
  const [routineDraftInTime, setRoutineDraftInTime] = useState(inTime || '17:30');
  const [routineDraftOutTime, setRoutineDraftOutTime] = useState(outTime || '22:30');
  const [questEndTimeChoice, setQuestEndTimeChoice] = useState(outTime || '22:00');
  const [questFocusSubjects, setQuestFocusSubjects] = useState<string[]>(newStudySubject ? [newStudySubject] : []);
  const [questMissionId, setQuestMissionId] = useState(PLANNER_QUICK_TASK_SUGGESTIONS[0]?.id || 'math-problem');
  const [quickStudyType, setQuickStudyType] = useState(QUICK_BASE_STUDY_TYPES[0]);
  const [outingDuration, setOutingDuration] = useState('20');
  const selectedDateKey = format(selectedDate, 'M/d');
  const isFutureSelectedDate = useMemo(() => {
    const selectedDay = new Date(selectedDate);
    selectedDay.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDay.getTime() > today.getTime();
  }, [selectedDate]);
  const selectedDateModeLabel = isToday ? '오늘 퀘스트' : isFutureSelectedDate ? '미리 작성 중' : '기록 확인';
  const selectedAttendanceSaveLabel = isToday ? '오늘 출석 저장' : `${selectedDateKey} 일정 저장`;
  const selectedAbsentSaveLabel = isToday ? '오늘 미등원' : `${selectedDateKey} 미등원`;
  const selectedRoutineLabel = isToday ? '오늘 루틴' : isFutureSelectedDate ? '요일별 미리 작성' : '지난 루틴 기록';
  const routineEditLabel = isToday ? '⚡ 오늘만 수정' : '⚡ 선택 날짜 수정';

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
  const recommendedTasks = PLANNER_QUICK_TASK_SUGGESTIONS.slice(0, 4);
  const isRoutineActive = !isAbsentMode && (hasInPlan || hasOutPlan);

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

  const awayPlanEntries = useMemo(
    () => [
      { id: 'away-primary', startTime: awayStartTime, endTime: awayEndTime, reason: awayReason, isPrimary: true },
      ...(extraAwayPlans as AttendanceAwaySlot[]).map((slot) => ({ ...slot, isPrimary: false })),
    ],
    [awayEndTime, awayReason, awayStartTime, extraAwayPlans]
  );

  const editableAwayPlanCount = awayPlanEntries.filter(
    (slot) => slot.startTime || slot.endTime || slot.reason.trim()
  ).length;

  const appendAwayPlan = () => {
    setExtraAwayPlans((current: AttendanceAwaySlot[]) => [
      ...current,
      {
        id: `away-${Date.now()}-${current.length}`,
        startTime: '',
        endTime: '',
        reason: '',
      },
    ]);
  };

  const updateExtraAwayPlan = (awayId: string, patch: Partial<AttendanceAwaySlot>) => {
    setExtraAwayPlans((current: AttendanceAwaySlot[]) =>
      current.map((slot) => (slot.id === awayId ? { ...slot, ...patch } : slot))
    );
  };

  const removeExtraAwayPlan = (awayId: string) => {
    setExtraAwayPlans((current: AttendanceAwaySlot[]) => current.filter((slot) => slot.id !== awayId));
  };

  const handleStartOutingPlan = () => {
    const startClock = createClockFromNow();
    const nextEndClock = addMinutesToClock(startClock, Number(outingDuration) || 20);
    const nextReason = awayReason.trim() || '식사';

    if (!awayStartTime && !awayEndTime && !awayReason.trim()) {
      setAwayStartTime(startClock);
      setAwayEndTime(nextEndClock);
      setAwayReason(nextReason);
    } else {
      setExtraAwayPlans((current: AttendanceAwaySlot[]) => [
        ...current,
        {
          id: `away-${Date.now()}-${current.length}`,
          startTime: startClock,
          endTime: nextEndClock,
          reason: nextReason,
        },
      ]);
    }
    setIsOutingModalOpen(false);
  };

  const heroStatus = isAbsentMode
    ? { label: '미등원 모드', summary: '오늘은 미등원으로 정리돼 있어요.' }
    : hasAwayPlan
      ? {
          label: '외출 중',
          summary:
            editableAwayPlanCount > 1
              ? `외출 루트 ${editableAwayPlanCount}개가 잡혀 있어요. 돌아오면 바로 이어서 시작할 수 있어요.`
              : awayReason
                ? `${awayReason} 다녀오는 중이에요. 돌아오면 바로 이어서 시작할 수 있어요.`
                : '외출 루트를 기록 중이에요.',
        }
      : hasInPlan && hasOutPlan
        ? { label: '입실 완료', summary: '입실부터 퇴실까지 오늘의 흐름이 준비됐어요.' }
        : { label: '퀘스트 준비 전', summary: '메인 과목 두 개와 핵심 미션 하나만 고르면 바로 시작할 수 있어요.' };

  return (
    <>
      <div className={cn('planner-main-view student-night-page mx-auto flex w-full max-w-3xl flex-col pb-28', isMobile ? 'gap-4 px-3 pt-3' : 'gap-5 px-4 pt-4')}>
        <header className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6C7FA6]">PLAN</p>
              <h1 className="mt-2 text-[2rem] font-black tracking-tight text-[#17326B]">계획</h1>
            </div>
            <div className="rounded-full border border-[#FFD8B0] bg-[linear-gradient(180deg,#FFF8EE_0%,#FFF1DC_100%)] px-4 py-2 text-[13px] font-black text-[#17326B] shadow-[0_16px_30px_-24px_rgba(10,28,72,0.18)]">
              {todayHeaderSummary}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[1.3rem] border border-[#DCE5F4] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] px-3 py-2 shadow-[0_18px_34px_-28px_rgba(10,28,72,0.16)]">
            <Button
              type="button"
              variant="default"
              onClick={() => moveSelectedDate(-1)}
              className="h-9 w-9 rounded-full border border-[#DCE5F4] bg-white p-0 text-[#17326B] shadow-[0_14px_26px_-22px_rgba(10,28,72,0.16)] hover:bg-[#F5F8FF]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <p className="text-xs font-black text-[#17326B]">{selectedDateLabel}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-[#6C7FA6]">{selectedDateModeLabel}</p>
            </div>
            <Button
              type="button"
              variant="default"
              onClick={() => moveSelectedDate(1)}
              className="h-9 w-9 rounded-full border border-[#DCE5F4] bg-white p-0 text-[#17326B] shadow-[0_14px_26px_-22px_rgba(10,28,72,0.16)] hover:bg-[#F5F8FF]"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="rounded-[1.35rem] border border-[#DCE5F4] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] px-3 py-3 shadow-[0_16px_30px_-26px_rgba(10,28,72,0.14)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="default"
                onClick={() => moveWeek(-1)}
                className="h-8 rounded-full border border-[#DCE5F4] bg-white px-3 text-[11px] font-black text-[#17326B] hover:bg-[#F5F8FF]"
              >
                이전 주
              </Button>
              <p className="text-[11px] font-black text-[#6C7FA6]">{weekRangeLabel}</p>
              <Button
                type="button"
                variant="default"
                onClick={() => moveWeek(1)}
                className="h-8 rounded-full border border-[#DCE5F4] bg-white px-3 text-[11px] font-black text-[#17326B] hover:bg-[#F5F8FF]"
              >
                다음 주
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day: Date) => {
                const isSelected = isSameDay(day, selectedDate);
                const isTodayCell = isSameDay(day, new Date());
                const dayTime = new Date(day);
                dayTime.setHours(0, 0, 0, 0);
                const todayTime = new Date();
                todayTime.setHours(0, 0, 0, 0);
                const dayModeLabel = isTodayCell ? '오늘' : dayTime.getTime() > todayTime.getTime() ? '미리' : '기록';
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      'rounded-[1rem] border px-2 py-2 text-center transition-all',
                      isSelected
                        ? 'border-[#FFB347] bg-[#FFF2E3] shadow-[0_18px_28px_-24px_rgba(255,150,38,0.45)]'
                        : 'border-[#DCE5F4] bg-white hover:border-[#AFC3E8] hover:bg-[#F7FAFF]'
                    )}
                  >
                    <p className={cn('text-[10px] font-black', isSelected ? 'text-[#D96E12]' : isTodayCell ? 'text-[#17326B]' : 'text-[#6C7FA6]')}>
                      {format(day, 'EEE', { locale: ko })}
                    </p>
                    <p className={cn('mt-1 text-sm font-black', isSelected ? 'text-[#17326B]' : 'text-[#17326B]')}>
                      {format(day, 'd')}
                    </p>
                    <p className={cn('mt-1 text-[9px] font-semibold', isSelected ? 'text-[#D96E12]' : isTodayCell ? 'text-[#17326B]' : 'text-[#8AA0CC]')}>
                      {dayModeLabel}
                    </p>
                  </button>
                );
              })}
            </div>
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
                  {selectedRoutineLabel}
                </div>
                <p className="surface-caption mt-2 text-sm font-semibold">
                  {format(selectedDate, 'EEEE', { locale: ko })} · {isFutureSelectedDate ? '전날에도 미리 작성 가능' : isToday ? '자동 적용됨' : '기록 확인 중'}
                </p>
              </div>
              {!isPast ? (
                <button
                  type="button"
                  onClick={() => setIsRoutineEditOpen(true)}
                  className="surface-chip surface-chip--accent px-3 py-2 text-xs"
                >
                  {routineEditLabel}
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

            {!isPast && !isRoutineActive ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => handleSetAttendance('attend')}
                  disabled={isSubmitting}
                  className={cn('h-12 rounded-full px-5 font-black text-white shadow-[0_18px_34px_-24px_rgba(255,150,38,0.6)] animate-[planner-cta-breathe_2.8s_ease-in-out_infinite]', rewardGradient)}
                >
                  <CalendarCheck2 className="mr-2 h-4 w-4" />
                  등원 시작
                </Button>
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
                <button type="button" onClick={handleCopyYesterdayPlan} className="rounded-full border border-white/12 bg-white/[0.1] px-3 py-2 text-[11px] font-black text-white transition hover:bg-white/[0.14]">
                  어제 복사
                </button>
                <button type="button" onClick={() => setIsTemplateSheetOpen(true)} className="rounded-full border border-[#FFB347]/28 bg-[#FF9626]/18 px-3 py-2 text-[11px] font-black text-[var(--accent-orange-soft)] transition hover:bg-[#FF9626]/24">
                  템플릿
                </button>
              </div>
            ) : null}
          </div>

          {isPast ? (
            <div className="mt-4 rounded-full border border-white/12 bg-white/[0.1] px-4 py-2 text-xs font-black text-[var(--text-on-dark-soft)]">
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
                              : 'border-white/12 bg-white/[0.08]'
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
                          <div className="mt-3 rounded-[1.1rem] border border-white/12 bg-white/[0.08] p-3">
                            {isStudyTask && !isVolumeTask ? (
                              <div className={cn('grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                                <Input
                                  type="time"
                                  value={task.startTime || ''}
                                  onChange={(event) => handleUpdateStudyWindow(task, event.target.value, task.endTime || '')}
                                  className="h-10 rounded-xl border-white/12 bg-white/[0.1] font-bold text-white"
                                />
                                <Input
                                  type="time"
                                  value={task.endTime || ''}
                                  onChange={(event) => handleUpdateStudyWindow(task, task.startTime || '', event.target.value)}
                                  className="h-10 rounded-xl border-white/12 bg-white/[0.1] font-bold text-white"
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
                                    className="rounded-full border border-white/12 bg-white/[0.1] px-3 py-2 text-[11px] font-black text-white transition hover:bg-white/[0.14]"
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
                                className="rounded-full border border-white/12 bg-white/[0.1] px-4 py-2 text-[11px] font-black text-[var(--text-on-dark-soft)] transition hover:bg-white/[0.14]"
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
                      className="h-11 rounded-2xl border-white/12 bg-white/[0.1] font-bold text-white placeholder:text-white/55"
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
                              ? 'border-[#FFB347]/28 bg-[#FF9626]/18 text-[var(--accent-orange-soft)] shadow-[0_14px_26px_-20px_rgba(255,150,38,0.45)]'
                              : 'border-white/12 bg-white/[0.08] text-white hover:bg-white/[0.12]'
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
                            ? 'border-[#FFB347]/28 bg-[#FF9626]/18 text-[var(--accent-orange-soft)] shadow-[0_14px_26px_-20px_rgba(255,150,38,0.45)]'
                            : 'border-white/12 bg-white/[0.08] text-white hover:bg-white/[0.12]'
                        )}
                      >
                        {customSubjectLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => openPresetEditor('subject')}
                        className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.08] px-3 py-2 text-[10px] font-black text-[var(--text-on-dark-soft)] transition-all hover:bg-white/[0.12] hover:text-white"
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
                              ? 'border-[#FFB347]/28 bg-[#FF9626]/18 text-[var(--accent-orange-soft)] shadow-[0_14px_26px_-20px_rgba(255,150,38,0.45)]'
                              : 'border-white/12 bg-white/[0.08] text-white hover:bg-white/[0.12]'
                          )}
                        >
                          {minute}분
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => openPresetEditor('minute')}
                        className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.08] px-3 py-2 text-[10px] font-black text-[var(--text-on-dark-soft)] transition-all hover:bg-white/[0.12] hover:text-white"
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
                              ? 'border-[#FFB347]/28 bg-[#FF9626]/18 text-[var(--accent-orange-soft)] shadow-[0_14px_26px_-20px_rgba(255,150,38,0.45)]'
                              : 'border-white/12 bg-white/[0.08] text-white hover:bg-white/[0.12]'
                          )}
                        >
                          {type}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => openPresetEditor('studyType')}
                        className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.08] px-3 py-2 text-[10px] font-black text-[var(--text-on-dark-soft)] transition-all hover:bg-white/[0.12] hover:text-white"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        수정
                      </button>
                    </div>

                    <div className={cn('rounded-[1.1rem] border border-white/12 bg-white/[0.08] px-4 py-3', isMobile ? 'space-y-3' : 'flex items-center justify-between gap-3')}>
                      <div>
                        <p className="text-[10px] font-black tracking-[0.18em] text-[#FF9626]">AUTO SCHEDULE</p>
                        <p className="mt-1 text-[12px] font-bold text-white">{resolvedWindowPreview ? `${resolvedWindowPreview.startTime} → ${resolvedWindowPreview.endTime}` : '시간은 자동으로 이어 붙어요'}</p>
                        <p className="mt-2 text-[11px] font-semibold text-[var(--text-on-dark-soft)]">그날만 필요한 미션은 위에 직접 적고 바로 퀘스트로 넣어도 돼요.</p>
                      </div>
                      <Button
                        type="button"
                        variant="default"
                        onClick={handleCreateQuickBlock}
                        disabled={isSubmitting || !resolvedSubjectValue}
                        className={cn(
                          'h-11 rounded-2xl border border-[#DCE5F4] bg-white px-5 font-black text-[#17326B] shadow-[0_18px_30px_-20px_rgba(10,28,72,0.18)] hover:bg-[#F6F9FF] disabled:bg-white/75 disabled:text-[#8AA0C7]',
                          isMobile && 'w-full'
                        )}
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

        <Collapsible open={isRoutineSectionOpen} onOpenChange={setIsRoutineSectionOpen}>
          <section className="surface-card surface-card--secondary on-dark rounded-[1.9rem] shadow-[0_24px_48px_-38px_rgba(0,0,0,0.52)]">
            <CollapsibleTrigger asChild>
              <button type="button" className={cn('flex w-full gap-3 p-5 text-left !whitespace-normal', isMobile ? 'flex-col items-start' : 'items-center justify-between')}>
                <div className="min-w-0 whitespace-normal">
                  <p className="text-[11px] font-black tracking-[0.18em] text-[var(--text-on-dark-muted)]">ROUTINE</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-white">루틴 관리</h3>
                  <p className="mt-2 whitespace-normal break-words text-sm font-semibold leading-6 text-[var(--text-on-dark-soft)]">
                    입실, 외출, 생활 루틴은 필요한 순간에만 펼쳐서 관리하세요.
                  </p>
                </div>
                <div className={cn('flex items-center gap-3', isMobile && 'w-full justify-between')}>
                  <Badge variant="dark" className="rounded-full px-3 py-1 text-[10px] shadow-none">
                    {routineCountLabel}
                  </Badge>
                  <ChevronDown className={cn('h-5 w-5 text-white transition-transform', isRoutineSectionOpen && 'rotate-180')} />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className={cn('border-t border-white/12 px-4 pb-4', !isMobile && 'px-5 pb-5')}>
              <div className={cn('mt-5 grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]')}>
                <div className="surface-card surface-card--ghost on-dark rounded-[1.6rem] p-4 shadow-[0_18px_38px_-32px_rgba(0,0,0,0.55)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-white">{isToday ? '오늘 출석 정보' : `${selectedDateLabel} 출석 정보`}</p>
                      <p className="mt-1 text-[12px] font-semibold leading-5 text-[var(--text-on-dark-soft)]">
                        전날에도 다음 날 루틴을 미리 적어둘 수 있고, 월요일부터 일요일까지 요일별로 바로 이동하며 저장할 수 있어요.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isAbsentMode ? (
                        <Badge className="rounded-full border border-[#FFB347]/24 bg-[#FF9626]/16 px-3 py-1 text-[10px] font-black text-[var(--accent-orange-soft)] shadow-none">
                          {selectedAbsentSaveLabel}
                        </Badge>
                      ) : null}
                      {hasInPlan && hasOutPlan ? (
                        <Badge className="rounded-full border border-emerald-400/18 bg-emerald-500/12 px-3 py-1 text-[10px] font-black text-emerald-200 shadow-none">
                          출석 계획 저장됨
                        </Badge>
                      ) : null}
                      {hasAwayPlan ? (
                        <Badge className="rounded-full border border-[#FFB347]/24 bg-[#FF9626]/16 px-3 py-1 text-[10px] font-black text-[var(--accent-orange-soft)] shadow-none">
                          외출 {Math.max(1, editableAwayPlanCount)}건
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className={cn('mt-4 grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">등원 예정</p>
                      <Input type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} disabled={isPast || isSubmitting} className="h-11 rounded-2xl border-white/12 bg-white/[0.1] font-black text-white" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">하원 예정</p>
                      <Input type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} disabled={isPast || isSubmitting} className="h-11 rounded-2xl border-white/12 bg-white/[0.1] font-black text-white" />
                    </div>
                  </div>

                  <div className={cn('mt-4 grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">외출 시작</p>
                      <Input type="time" value={awayStartTime} onChange={(e) => setAwayStartTime(e.target.value)} disabled={isPast || isSubmitting} className="h-11 rounded-2xl border-white/12 bg-white/[0.1] font-black text-white" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">복귀 예정</p>
                      <Input type="time" value={awayEndTime} onChange={(e) => setAwayEndTime(e.target.value)} disabled={isPast || isSubmitting} className="h-11 rounded-2xl border-white/12 bg-white/[0.1] font-black text-white" />
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">사유</p>
                    <Input
                      value={awayReason}
                      onChange={(e) => setAwayReason(e.target.value)}
                      placeholder="예: 학원, 병원, 저녁 식사"
                      disabled={isPast || isSubmitting}
                      className="h-11 rounded-2xl border-white/12 bg-white/[0.1] font-bold text-white placeholder:text-white/55"
                    />
                  </div>

                  {extraAwayPlans.length > 0 ? (
                    <div className="mt-3 space-y-3">
                      {extraAwayPlans.map((slot: AttendanceAwaySlot, index: number) => (
                        <div key={slot.id} className="surface-card surface-card--ghost on-dark rounded-[1.35rem] p-3">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--accent-orange-soft)]">
                              추가 외출 {index + 2}
                            </p>
                            <Button
                              type="button"
                              variant="dark"
                              onClick={() => removeExtraAwayPlan(slot.id)}
                              disabled={isPast || isSubmitting}
                              className="h-8 rounded-full px-3 text-[10px] font-black"
                            >
                              삭제
                            </Button>
                          </div>
                          <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">외출 시작</p>
                              <Input
                                type="time"
                                value={slot.startTime}
                                onChange={(event) => updateExtraAwayPlan(slot.id, { startTime: event.target.value })}
                                disabled={isPast || isSubmitting}
                                className="h-11 rounded-2xl border-white/12 bg-white/[0.1] font-black text-white"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">복귀 예정</p>
                              <Input
                                type="time"
                                value={slot.endTime}
                                onChange={(event) => updateExtraAwayPlan(slot.id, { endTime: event.target.value })}
                                disabled={isPast || isSubmitting}
                                className="h-11 rounded-2xl border-white/12 bg-white/[0.1] font-black text-white"
                              />
                            </div>
                          </div>
                          <div className="mt-3 space-y-1.5">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">사유</p>
                            <Input
                              value={slot.reason}
                              onChange={(event) => updateExtraAwayPlan(slot.id, { reason: event.target.value })}
                              placeholder="예: 학원, 병원, 저녁 식사"
                              disabled={isPast || isSubmitting}
                              className="h-11 rounded-2xl border-white/12 bg-white/[0.1] font-bold text-white placeholder:text-white/55"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {!isPast ? (
                    <Button
                      type="button"
                      variant="dark"
                      onClick={appendAwayPlan}
                      disabled={isSubmitting}
                      className="mt-3 h-10 rounded-2xl px-4 font-black"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      외출/복귀 더 추가
                    </Button>
                  ) : null}

                  {!isPast ? (
                    <div className={cn('mt-4 gap-2', isMobile ? 'grid grid-cols-1' : 'flex flex-wrap')}>
                      <Button type="button" onClick={() => handleSetAttendance('attend')} disabled={isSubmitting} className="h-11 rounded-2xl bg-[linear-gradient(135deg,#173A82_0%,#22479B_60%,#FF7A16_170%)] px-4 font-black text-white shadow-[0_18px_30px_-20px_rgba(255,122,22,0.35)]">
                        <CalendarCheck2 className="mr-2 h-4 w-4" />
                        {selectedAttendanceSaveLabel}
                      </Button>
                      <Button type="button" variant="dark" onClick={() => handleSetAttendance('absent')} disabled={isSubmitting} className="h-11 rounded-2xl px-4 font-black">
                        {selectedAbsentSaveLabel}
                      </Button>
                      <Button type="button" variant="dark" onClick={() => setIsRoutineCopyDialogOpen(true)} disabled={isSubmitting || !hasCopyableRoutines} className="h-11 rounded-2xl px-4 font-black">
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
                    <div className="surface-card surface-card--ghost on-dark rounded-[1.5rem] border-dashed p-5 text-center">
                      <p className="text-sm font-black text-white">저장된 루틴이 아직 없어요</p>
                      <p className="mt-2 text-[12px] font-semibold leading-5 text-[var(--text-on-dark-soft)]">
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

      </div>

      <Dialog open={isRoutineEditOpen} onOpenChange={setIsRoutineEditOpen}>
        <DialogContent className="fixed inset-x-0 bottom-0 top-auto w-full max-w-none translate-x-0 translate-y-0 rounded-t-[2rem] rounded-b-none border-white/12 bg-[linear-gradient(180deg,#16284F_0%,#0F2149_100%)] p-0 text-white shadow-[0_-24px_60px_-30px_rgba(0,0,0,0.65)] sm:left-1/2 sm:max-w-md sm:-translate-x-1/2">
          <div className="p-5">
            <DialogHeader className="text-left">
              <DialogTitle className="text-[1.4rem] font-black tracking-tight text-white">오늘만 수정</DialogTitle>
              <DialogDescription className="text-sm font-semibold leading-6 text-[var(--text-on-dark-soft)]">
                오늘 등원과 하원 시간만 빠르게 바꾸고 바로 반영할 수 있어요.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-[11px] font-black text-[var(--text-on-dark-soft)]">등원</p>
                <Input
                  type="time"
                  value={routineDraftInTime}
                  onChange={(event) => setRoutineDraftInTime(event.target.value)}
                  className="h-12 rounded-2xl border-white/12 bg-white/[0.1] font-black text-white"
                />
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-black text-[var(--text-on-dark-soft)]">하원</p>
                <Input
                  type="time"
                  value={routineDraftOutTime}
                  onChange={(event) => setRoutineDraftOutTime(event.target.value)}
                  className="h-12 rounded-2xl border-white/12 bg-white/[0.1] font-black text-white"
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
                className="h-12 w-full rounded-2xl border-white/12 bg-white/[0.1] font-black text-white hover:bg-white/[0.14]"
              >
                기본 루틴 수정
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isOutingModalOpen} onOpenChange={setIsOutingModalOpen}>
        <DialogContent className="max-w-[26rem] rounded-[2rem] border-[#DCE5F8] bg-[radial-gradient(circle_at_top_right,rgba(255,179,71,0.18),transparent_26%),linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] p-0 text-[#17326B] shadow-[0_28px_60px_-30px_rgba(19,50,107,0.24)]">
          <div className="p-5">
            <DialogHeader className="text-left">
              <DialogTitle className="text-[1.4rem] font-black tracking-tight text-[#17326B]">외출 체크포인트</DialogTitle>
              <DialogDescription className="text-sm font-semibold leading-6 text-[#6B7EA8]">
                어디 다녀오는지와 예상 복귀 시간만 고르면 바로 외출 루트가 저장돼요.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 space-y-4">
              <div>
                <p className="text-[11px] font-black text-[#6B7EA8]">어디 다녀오나요?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OUTING_REASON_OPTIONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setAwayReason(reason)}
                      className={cn(
                        'rounded-full border px-3 py-2 text-[11px] font-black transition-all',
                        awayReason === reason
                          ? 'border-[#FFB347] bg-[#FFF2E3] text-[#D96E12] shadow-[0_12px_24px_-20px_rgba(255,150,38,0.4)]'
                          : 'border-[#D7E1F2] bg-white text-[#17326B] hover:border-[#AFC3E8] hover:bg-[#F6F9FF]'
                      )}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-black text-[#6B7EA8]">언제쯤 돌아오나요?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {OUTING_DURATION_OPTIONS.map((duration) => (
                    <button
                      key={duration}
                      type="button"
                      onClick={() => setOutingDuration(duration)}
                      className={cn(
                        'rounded-full border px-3 py-2 text-[11px] font-black transition-all',
                        outingDuration === duration
                          ? 'border-[#FFB347] bg-[#FFF2E3] text-[#D96E12] shadow-[0_12px_24px_-20px_rgba(255,150,38,0.4)]'
                          : 'border-[#D7E1F2] bg-white text-[#17326B] hover:border-[#AFC3E8] hover:bg-[#F6F9FF]'
                      )}
                    >
                      {duration}분
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.2rem] border border-[#D7E7FF] bg-[#F5F9FF] px-4 py-3 text-sm font-semibold text-[#6B7EA8]">
                외출 시작 시각은 현재 시각으로 자동 기록되고, 복귀 예정 시간도 함께 저장돼요.
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <Button type="button" variant="dark" onClick={() => setIsOutingModalOpen(false)} className="h-11 flex-1 rounded-2xl border-[#D7E1F2] bg-white font-black text-[#17326B] hover:bg-[#F6F9FF]">
                취소
              </Button>
              <Button type="button" onClick={handleStartOutingPlan} className={cn('h-11 flex-1 rounded-2xl font-black text-white shadow-[0_18px_32px_-22px_rgba(255,150,38,0.5)]', rewardGradient)}>
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
              <DialogDescription className="mt-1 text-[11px] font-semibold text-[var(--text-on-dark-soft)]">
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
                className="h-12 rounded-2xl border-white/12 bg-white/[0.1] text-center font-black text-white"
                placeholder="예: 100"
              />
            ) : (
              <Input
                value={presetEditorDraft}
                onChange={(event) => setPresetEditorDraft(event.target.value)}
                className="h-12 rounded-2xl border-white/12 bg-white/[0.1] font-black text-white placeholder:text-white/55"
                placeholder={presetEditorKind === 'subject' ? '예: 생명과학' : '예: 오답정리'}
                maxLength={12}
              />
            )}

            <div className="rounded-[1.15rem] border border-white/12 bg-white/[0.08] px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">preview</div>
              <div className="mt-2 inline-flex items-center rounded-full border border-[#FFB347]/28 bg-[#FF9626]/18 px-3 py-2 text-[11px] font-black text-[var(--accent-orange-soft)]">
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
                className="h-11 flex-1 rounded-2xl border border-white/12 bg-white/[0.1] text-white hover:bg-white/[0.14]"
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
