import { addDays, format, subDays } from 'date-fns';

import {
  type DailyRoutineBlock,
  type DailyRoutinePlan,
  type RecommendedRoutine,
  type RoutineReflectionEntry,
  type RoutineWorkspaceState,
  type UserStudyProfile,
  type WeeklyRoutineSummary,
} from '@/lib/types';

const BLOCK_KIND_LABEL_MAP: Record<DailyRoutineBlock['studyType'], string> = {
  concept: '개념',
  'problem-solving': '문풀',
  memorization: '암기',
  review: '복습',
  warmup: '시작',
  recovery: '회복',
};

export function buildDailyRoutineFromRecommendation(
  routine: RecommendedRoutine,
  dateKey: string
): DailyRoutinePlan {
  const blocks: DailyRoutineBlock[] = routine.studyBlocks.map((block, index) => ({
    id: `${dateKey}-${block.id}-${index}`,
    title: block.title,
    subjectId: block.subjectId,
    subjectLabel: block.subjectLabel,
    studyType: mapStudyType(block.kind),
    studyTypeLabel: BLOCK_KIND_LABEL_MAP[mapStudyType(block.kind)],
    startTime: block.startTime,
    sequence: index + 1,
    durationMinutes: block.durationMinutes,
    done: false,
    rewardLabel: buildRewardLabel(block.durationMinutes, index),
    feedbackMessage: buildFeedbackMessage(block.kind, block.subjectLabel),
    instruction: block.instruction,
    fallbackInstruction: block.fallbackInstruction,
  }));

  const totalMinutes = blocks.reduce((total, block) => total + block.durationMinutes, 0);

  return {
    dateKey,
    routineId: routine.id,
    routineName: routine.name,
    routineSummary: routine.oneLineDescription,
    archetypeName: routine.fitStudent,
    totalMinutes,
    targetFocus: routine.coreStrategies[0] || '가장 중요한 블록부터 시작하기',
    reminderMessage: routine.recommendationReasons[0] || '첫 블록만 시작해도 오늘 루틴은 열립니다.',
    tags: [routine.difficultyLabel, routine.studyBlocks[0]?.subjectLabel || '균형 루틴'],
    blocks,
    executionRules: routine.distractionRules,
    reviewRules: routine.reviewRules,
    recommendedAdjustments: routine.downgradeVersion,
    startedAt: null,
  };
}

export function buildInitialRoutineWorkspace(profile: UserStudyProfile, today = new Date()): RoutineWorkspaceState {
  const dateKey = format(today, 'yyyy-MM-dd');
  const activeRoutine = buildDailyRoutineFromRecommendation(profile.selectedRoutine, dateKey);
  const recentHistory = buildDummyRecentHistory(profile.selectedRoutine, today);
  const weeklySummary = buildWeeklyRoutineSummary(recentHistory, []);

  return {
    version: 1,
    activeDateKey: dateKey,
    activeRoutine,
    recentHistory,
    reflections: [],
    weeklySummary,
  };
}

export function refreshRoutineWorkspaceForToday(
  profile: UserStudyProfile,
  workspace: RoutineWorkspaceState | undefined,
  today = new Date()
): RoutineWorkspaceState {
  const dateKey = format(today, 'yyyy-MM-dd');
  if (!workspace) return buildInitialRoutineWorkspace(profile, today);
  if (workspace.activeDateKey === dateKey) return workspace;

  const nextRoutine =
    workspace.activeRoutine?.blocks?.length > 0
      ? cloneRoutineForDate(workspace.activeRoutine, dateKey)
      : buildDailyRoutineFromRecommendation(profile.selectedRoutine, dateKey);
  const recentHistory = [
    ...workspace.recentHistory.filter((entry) => entry.dateKey !== dateKey),
    {
      dateKey,
      subjectMinutes: summarizeSubjectMinutes(nextRoutine.blocks),
      completedMinutes: 0,
    },
  ].slice(-7);

  const weeklySummary = buildWeeklyRoutineSummary(recentHistory, workspace.reflections);

  return {
    ...workspace,
    activeDateKey: dateKey,
    activeRoutine: nextRoutine,
    recentHistory,
    weeklySummary,
  };
}

export function applyRoutineBlockToggle(workspace: RoutineWorkspaceState, blockId: string): RoutineWorkspaceState {
  const nextBlocks = workspace.activeRoutine.blocks.map((block) =>
    block.id === blockId ? { ...block, done: !block.done } : block
  );
  const completedMinutes = nextBlocks.filter((block) => block.done).reduce((sum, block) => sum + block.durationMinutes, 0);
  const recentHistory = upsertHistoryEntry(workspace.recentHistory, {
    dateKey: workspace.activeDateKey,
    subjectMinutes: summarizeSubjectMinutes(nextBlocks),
    completedMinutes,
  });

  return {
    ...workspace,
    activeRoutine: {
      ...workspace.activeRoutine,
      blocks: nextBlocks,
      startedAt: workspace.activeRoutine.startedAt || new Date().toISOString(),
    },
    recentHistory,
    weeklySummary: buildWeeklyRoutineSummary(recentHistory, workspace.reflections),
  };
}

export function updateRoutineBlock(
  workspace: RoutineWorkspaceState,
  blockId: string,
  patch: Partial<DailyRoutineBlock>
): RoutineWorkspaceState {
  const nextBlocks = workspace.activeRoutine.blocks.map((block) =>
    block.id === blockId ? { ...block, ...patch } : block
  );
  return {
    ...workspace,
    activeRoutine: {
      ...workspace.activeRoutine,
      blocks: sortBlocks(nextBlocks),
      totalMinutes: nextBlocks.reduce((sum, block) => sum + block.durationMinutes, 0),
    },
  };
}

export function addRoutineBlock(
  workspace: RoutineWorkspaceState,
  block: Omit<DailyRoutineBlock, 'id' | 'sequence' | 'done'>
): RoutineWorkspaceState {
  const nextBlocks = sortBlocks([
    ...workspace.activeRoutine.blocks,
    {
      ...block,
      id: `${workspace.activeDateKey}-custom-${Date.now()}`,
      sequence: workspace.activeRoutine.blocks.length + 1,
      done: false,
    },
  ]);

  return {
    ...workspace,
    activeRoutine: {
      ...workspace.activeRoutine,
      blocks: nextBlocks.map((item, index) => ({ ...item, sequence: index + 1 })),
      totalMinutes: nextBlocks.reduce((sum, item) => sum + item.durationMinutes, 0),
    },
  };
}

export function removeRoutineBlock(workspace: RoutineWorkspaceState, blockId: string): RoutineWorkspaceState {
  const nextBlocks = workspace.activeRoutine.blocks
    .filter((block) => block.id !== blockId)
    .map((block, index) => ({ ...block, sequence: index + 1 }));

  return {
    ...workspace,
    activeRoutine: {
      ...workspace.activeRoutine,
      blocks: nextBlocks,
      totalMinutes: nextBlocks.reduce((sum, item) => sum + item.durationMinutes, 0),
    },
  };
}

export function applyRoutineEditor(workspace: RoutineWorkspaceState, routine: DailyRoutinePlan): RoutineWorkspaceState {
  return {
    ...workspace,
    activeRoutine: {
      ...routine,
      blocks: sortBlocks(routine.blocks).map((block, index) => ({ ...block, sequence: index + 1 })),
      totalMinutes: routine.blocks.reduce((sum, block) => sum + block.durationMinutes, 0),
    },
  };
}

export function addReflectionEntry(
  workspace: RoutineWorkspaceState,
  reflection: Omit<RoutineReflectionEntry, 'dateKey' | 'completedBlockCount' | 'totalBlockCount'>
): RoutineWorkspaceState {
  const nextEntry: RoutineReflectionEntry = {
    ...reflection,
    dateKey: workspace.activeDateKey,
    completedBlockCount: workspace.activeRoutine.blocks.filter((block) => block.done).length,
    totalBlockCount: workspace.activeRoutine.blocks.length,
  };
  const reflections = [
    ...workspace.reflections.filter((entry) => entry.dateKey !== workspace.activeDateKey),
    nextEntry,
  ].slice(-7);

  return {
    ...workspace,
    reflections,
    weeklySummary: buildWeeklyRoutineSummary(workspace.recentHistory, reflections),
  };
}

export function getNextPendingBlock(routine: DailyRoutinePlan) {
  return routine.blocks.find((block) => !block.done) || null;
}

export function getRoutineProgress(routine: DailyRoutinePlan) {
  const totalBlocks = routine.blocks.length;
  const completedBlocks = routine.blocks.filter((block) => block.done).length;
  const completedMinutes = routine.blocks.filter((block) => block.done).reduce((sum, block) => sum + block.durationMinutes, 0);
  return {
    totalBlocks,
    completedBlocks,
    completedMinutes,
    percent: totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0,
  };
}

export function buildSubjectBalanceSummary(workspace: RoutineWorkspaceState) {
  const recentSubjectMinutes = workspace.recentHistory.reduce<Record<string, number>>((acc, entry) => {
    Object.entries(entry.subjectMinutes).forEach(([subject, minutes]) => {
      acc[subject] = (acc[subject] || 0) + minutes;
    });
    return acc;
  }, {});

  const todaySubjectMinutes = summarizeSubjectMinutes(workspace.activeRoutine.blocks);
  const orderedSubjects = Object.entries(todaySubjectMinutes)
    .sort((left, right) => right[1] - left[1])
    .map(([subject, minutes]) => ({
      subject,
      todayMinutes: minutes,
      recentMinutes: recentSubjectMinutes[subject] || 0,
    }));

  const totalRecentMinutes = Object.values(recentSubjectMinutes).reduce((sum, value) => sum + value, 0);
  const dominantSubject = orderedSubjects[0];
  const isSkewed = dominantSubject ? dominantSubject.recentMinutes / Math.max(totalRecentMinutes, 1) > 0.6 : false;

  return {
    subjects: orderedSubjects,
    insight: isSkewed && dominantSubject
      ? `${dominantSubject.subject} 비중이 최근 7일 기준으로 높아요. 오늘은 다른 과목 복습 블록 1개를 같이 가져가보세요.`
      : '오늘 과목 구성은 비교적 균형 있게 잡혀 있어요. 가장 어려운 과목만 초반에 놓치지 않으면 좋아요.',
    status: isSkewed ? 'skewed' : 'balanced',
  };
}

function mapStudyType(kind: RecommendedRoutine['studyBlocks'][number]['kind']): DailyRoutineBlock['studyType'] {
  if (kind === 'problem') return 'problem-solving';
  if (kind === 'memorization') return 'memorization';
  if (kind === 'review') return 'review';
  if (kind === 'warmup') return 'warmup';
  if (kind === 'recovery') return 'recovery';
  return 'concept';
}

function buildRewardLabel(durationMinutes: number, index: number) {
  const point = Math.max(2, Math.round(durationMinutes / 15) + (index === 0 ? 2 : 0));
  return `+${point}P`;
}

function buildFeedbackMessage(kind: RecommendedRoutine['studyBlocks'][number]['kind'], subjectLabel?: string) {
  if (kind === 'problem') return `${subjectLabel || '메인 과목'} 감각을 올리는 핵심 블록`;
  if (kind === 'review') return '하루를 닫기 전에 기억을 붙잡는 회수 블록';
  if (kind === 'memorization') return '짧게 자주 해야 효과가 큰 블록';
  if (kind === 'warmup') return '앉자마자 바로 시작하기 위한 진입 블록';
  if (kind === 'recovery') return '피로가 쌓였을 때도 유지하기 쉬운 회복 블록';
  return `${subjectLabel || '핵심 과목'} 이해도를 올리는 집중 블록`;
}

function summarizeSubjectMinutes(blocks: Array<Pick<DailyRoutineBlock, 'subjectLabel' | 'durationMinutes'>>) {
  return blocks.reduce<Record<string, number>>((acc, block) => {
    const subjectLabel = block.subjectLabel || '기타';
    acc[subjectLabel] = (acc[subjectLabel] || 0) + block.durationMinutes;
    return acc;
  }, {});
}

function buildDummyRecentHistory(routine: RecommendedRoutine, today: Date) {
  return Array.from({ length: 7 }, (_, offset) => {
    const currentDate = subDays(today, 6 - offset);
    const dateKey = format(currentDate, 'yyyy-MM-dd');
    const variance = [0.72, 0.94, 0.88, 1, 0.79, 0.91, 1.05][offset] || 1;
    const subjectMinutes = routine.studyBlocks.reduce<Record<string, number>>((acc, block) => {
      const subject = block.subjectLabel || '기타';
      const minutes = Math.max(10, Math.round(block.durationMinutes * variance));
      acc[subject] = (acc[subject] || 0) + minutes;
      return acc;
    }, {});
    return {
      dateKey,
      subjectMinutes,
      completedMinutes: Object.values(subjectMinutes).reduce((sum, value) => sum + value, 0),
    };
  });
}

function buildWeeklyRoutineSummary(
  recentHistory: RoutineWorkspaceState['recentHistory'],
  reflections: RoutineReflectionEntry[]
): WeeklyRoutineSummary {
  const totalCompletedMinutes = recentHistory.reduce((sum, entry) => sum + entry.completedMinutes, 0);
  const totalPlannedMinutes = recentHistory.reduce(
    (sum, entry) => sum + Object.values(entry.subjectMinutes).reduce((entrySum, value) => entrySum + value, 0),
    0
  );
  const completionRate = totalPlannedMinutes > 0 ? Math.round((totalCompletedMinutes / totalPlannedMinutes) * 100) : 0;

  const subjectTotals = recentHistory.reduce<Record<string, number>>((acc, entry) => {
    Object.entries(entry.subjectMinutes).forEach(([subject, value]) => {
      acc[subject] = (acc[subject] || 0) + value;
    });
    return acc;
  }, {});

  const orderedSubjects = Object.entries(subjectTotals).sort((left, right) => right[1] - left[1]);
  const topSubject = orderedSubjects[0]?.[0] || '균형';
  const totalSubjectMinutes = Object.values(subjectTotals).reduce((sum, value) => sum + value, 0);
  const balanceStatus: WeeklyRoutineSummary['balanceStatus'] =
    orderedSubjects[0] && orderedSubjects[0][1] / Math.max(totalSubjectMinutes, 1) > 0.58
      ? 'skewed'
      : completionRate >= 70
        ? 'balanced'
        : 'recovery';

  const latestReflection = reflections[reflections.length - 1];
  const reflectionHeadline =
    latestReflection?.keepOneThing ||
    (completionRate >= 70
      ? '루틴이 비교적 안정적으로 굴러가고 있어요.'
      : '완벽하게 지키는 것보다 다시 시작하는 속도를 먼저 챙겨봐요.');

  const coachingTip =
    balanceStatus === 'skewed'
      ? `${topSubject} 편중이 보여요. 다음 주에는 다른 과목 복습 블록 1개를 먼저 붙여보세요.`
      : completionRate < 55
        ? '루틴 강도를 한 단계 낮추고 첫 블록 성공률부터 올려보세요.'
        : '지금 흐름을 유지하면서 복습 블록만 조금 더 고정하면 좋아요.';

  return {
    weekKey: format(new Date(), "yyyy-'W'II"),
    completionRate,
    consistencyLabel: completionRate >= 70 ? '유지 흐름' : completionRate >= 50 ? '회복 중' : '재정렬 필요',
    topSubject,
    balanceStatus,
    reflectionHeadline,
    coachingTip,
  };
}

function upsertHistoryEntry(
  history: RoutineWorkspaceState['recentHistory'],
  nextEntry: RoutineWorkspaceState['recentHistory'][number]
) {
  return [...history.filter((entry) => entry.dateKey !== nextEntry.dateKey), nextEntry]
    .sort((left, right) => left.dateKey.localeCompare(right.dateKey))
    .slice(-7);
}

function sortBlocks(blocks: DailyRoutineBlock[]) {
  return [...blocks].sort((left, right) => {
    const leftTime = left.startTime || `99:${String(left.sequence).padStart(2, '0')}`;
    const rightTime = right.startTime || `99:${String(right.sequence).padStart(2, '0')}`;
    return leftTime.localeCompare(rightTime);
  });
}

function cloneRoutineForDate(routine: DailyRoutinePlan, dateKey: string): DailyRoutinePlan {
  return {
    ...routine,
    dateKey,
    blocks: routine.blocks.map((block, index) => ({
      ...block,
      id: `${dateKey}-${index}-${block.title.replace(/\s+/g, '-').slice(0, 18)}`,
      sequence: index + 1,
      done: false,
    })),
    startedAt: null,
  };
}

export function buildNextDayRoutinePreview(routine: DailyRoutinePlan) {
  return {
    dateKey: format(addDays(new Date(routine.dateKey), 1), 'yyyy-MM-dd'),
    firstBlockTitle: routine.blocks[0]?.title || '첫 블록 미정',
  };
}
