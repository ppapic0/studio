import type { StudyAmountUnit, StudyPlanMode } from '@/components/dashboard/student-planner/planner-constants';

export const PLAN_TRACK_DAILY_POINT_CAP = 100;
export const PLAN_DEFAULT_START_TIME = '18:00';

export type PlannerTaskDraft = {
  category: 'study' | 'personal';
  title: string;
  subject?: string;
  subjectLabel?: string;
  studyPlanMode?: StudyPlanMode;
  targetMinutes?: number;
  targetAmount?: number;
  amountUnit?: StudyAmountUnit;
  amountUnitLabel?: string;
  startTime?: string;
  endTime?: string;
  priority?: 'low' | 'medium' | 'high';
  tag?: string;
};

export type PlannerTemplateRecord = {
  id: string;
  name: string;
  description: string;
  kind: 'builtin' | 'custom';
  icon: 'spark' | 'weekday' | 'weekend' | 'exam' | 'recent' | 'custom';
  tasks: PlannerTaskDraft[];
  updatedAt: number;
};

export type PlannerQuickTaskSuggestion = {
  id: string;
  title: string;
  subject: string;
  subjectLabel?: string;
  targetMinutes: number;
  tag: string;
  priority?: 'low' | 'medium' | 'high';
};

export const PLANNER_QUICK_TASK_SUGGESTIONS: PlannerQuickTaskSuggestion[] = [
  { id: 'math-problem', title: '수학 문제풀이', subject: 'math', targetMinutes: 60, tag: '문제풀이', priority: 'high' },
  { id: 'english-vocab', title: '영어 단어', subject: 'eng', targetMinutes: 30, tag: '암기', priority: 'medium' },
  { id: 'reading-kor', title: '국어 독해', subject: 'kor', targetMinutes: 60, tag: '독해', priority: 'high' },
  { id: 'math-wrong', title: '오답노트', subject: 'math', targetMinutes: 45, tag: '복습', priority: 'medium' },
  { id: 'self-study', title: '자습', subject: 'etc', targetMinutes: 60, tag: '자습', priority: 'low' },
];

export const BUILTIN_PLANNER_TEMPLATES: PlannerTemplateRecord[] = [
  {
    id: 'builtin-weekday',
    name: '평일 루틴',
    description: '학교 끝난 뒤 바로 이어지는 기본 루틴',
    kind: 'builtin',
    icon: 'weekday',
    updatedAt: 1,
    tasks: [
      { category: 'study', title: '수학 문제풀이', subject: 'math', studyPlanMode: 'time', targetMinutes: 60, tag: '핵심', priority: 'high' },
      { category: 'study', title: '영어 단어', subject: 'eng', studyPlanMode: 'time', targetMinutes: 30, tag: '암기', priority: 'medium' },
      { category: 'study', title: '국어 독해', subject: 'kor', studyPlanMode: 'time', targetMinutes: 60, tag: '독해', priority: 'high' },
      { category: 'study', title: '오답노트', subject: 'math', studyPlanMode: 'time', targetMinutes: 45, tag: '복습', priority: 'medium' },
    ],
  },
  {
    id: 'builtin-weekend',
    name: '주말 루틴',
    description: '긴 집중 블록 위주의 주말 플랜',
    kind: 'builtin',
    icon: 'weekend',
    updatedAt: 2,
    tasks: [
      { category: 'study', title: '수학 실전 세트', subject: 'math', studyPlanMode: 'volume', targetAmount: 2, amountUnit: '세트', targetMinutes: 90, tag: '실전', priority: 'high' },
      { category: 'study', title: '영어 지문 분석', subject: 'eng', studyPlanMode: 'volume', targetAmount: 3, amountUnit: '지문', targetMinutes: 60, tag: '분석', priority: 'medium' },
      { category: 'study', title: '오답 복습', subject: 'etc', studyPlanMode: 'time', targetMinutes: 45, tag: '복습', priority: 'medium' },
    ],
  },
  {
    id: 'builtin-exam',
    name: '시험기간 루틴',
    description: '짧은 블록으로 자주 점검하는 시험기간용',
    kind: 'builtin',
    icon: 'exam',
    updatedAt: 3,
    tasks: [
      { category: 'study', title: '수학 오답 25문제', subject: 'math', studyPlanMode: 'volume', targetAmount: 25, amountUnit: '문제', targetMinutes: 70, tag: '오답', priority: 'high' },
      { category: 'study', title: '영어 단어 2회독', subject: 'eng', studyPlanMode: 'volume', targetAmount: 2, amountUnit: '회독', targetMinutes: 40, tag: '암기', priority: 'high' },
      { category: 'study', title: '국어 비문학 2지문', subject: 'kor', studyPlanMode: 'volume', targetAmount: 2, amountUnit: '지문', targetMinutes: 45, tag: '독해', priority: 'medium' },
      { category: 'study', title: '암기 과목 빠른 점검', subject: 'social', studyPlanMode: 'time', targetMinutes: 30, tag: '점검', priority: 'medium' },
    ],
  },
];

export function buildPlannerTemplateStorageKey(centerId: string, userId: string) {
  return `planner-templates:${centerId}:${userId}`;
}

export function buildPlannerTemplateRecentKey(centerId: string, userId: string) {
  return `planner-templates:recent:${centerId}:${userId}`;
}

export function timeToMinutes(clock: string) {
  if (!clock || !clock.includes(':')) return 0;
  const [hour, minute] = clock.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;
  return (hour * 60) + minute;
}

export function minutesToClock(totalMinutes: number) {
  const normalized = Math.max(0, Math.round(totalMinutes));
  const hour = Math.floor(normalized / 60) % 24;
  const minute = normalized % 60;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

export function addMinutesToClock(clock: string, minutes: number) {
  return minutesToClock(timeToMinutes(clock) + Math.max(0, minutes));
}

export function formatDurationLabel(minutes?: number | null) {
  const safeMinutes = Math.max(0, minutes || 0);
  if (!safeMinutes) return '시간 자유';
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  if (hour && minute) return `${hour}시간 ${minute}분`;
  if (hour) return `${hour}시간`;
  return `${minute}분`;
}

export function formatClockRange(startTime?: string | null, endTime?: string | null) {
  if (!startTime || !endTime) return '';
  return `${startTime} - ${endTime}`;
}

export function assignAutoWindowsToTasks<T extends PlannerTaskDraft>(
  tasks: T[],
  baseStartTime = PLAN_DEFAULT_START_TIME
) {
  let nextStart = baseStartTime;
  return tasks.map((task) => {
    if (task.startTime && task.endTime) {
      nextStart = task.endTime;
      return task;
    }

    const duration = Math.max(0, task.targetMinutes || 0);
    if (!duration) return task;

    const startTime = nextStart;
    const endTime = addMinutesToClock(startTime, duration);
    nextStart = endTime;
    return {
      ...task,
      startTime,
      endTime,
    };
  });
}

export function getNextAutoWindow(existingTasks: Array<{ startTime?: string; endTime?: string; targetMinutes?: number }>, targetMinutes: number, baseStartTime = PLAN_DEFAULT_START_TIME) {
  const lastTaskEnd = existingTasks
    .map((task) => task.endTime || (task.startTime && task.targetMinutes ? addMinutesToClock(task.startTime, task.targetMinutes) : null))
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  const startTime = lastTaskEnd || baseStartTime;
  const endTime = addMinutesToClock(startTime, Math.max(0, targetMinutes));
  return { startTime, endTime };
}

export function computePlannerStreak(dailyPointStatus: Record<string, any> | undefined, selectedDateKey: string) {
  if (!dailyPointStatus || !selectedDateKey) return 0;
  const targetDate = new Date(`${selectedDateKey}T00:00:00`);
  if (Number.isNaN(targetDate.getTime())) return 0;

  let streak = 0;
  for (let offset = 0; offset < 60; offset += 1) {
    const current = new Date(targetDate);
    current.setDate(targetDate.getDate() - offset);
    const key = current.toISOString().slice(0, 10);
    if (dailyPointStatus[key]?.planTrackCompleted) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}
