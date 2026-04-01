import {
  type GeneratedStudyPlan,
  type StudyPlanItem,
  type StudyPlannerDiagnosticRecord,
  type UserStudyProfile,
} from '@/lib/types';

type RecommendationBadge = '계획' | '복습' | '과목배분' | '학습방법' | '동기';

export type MainPlanRecommendation = {
  id: string;
  badge: RecommendationBadge;
  title: string;
  action: string;
  reason: string;
  explainWhy: string;
  applyPreset?: {
    title: string;
    subject?: string;
    studyMode?: 'time' | 'volume';
    targetMinutes?: number;
    tag?: string;
  };
};

type BuildMainPlanRecommendationsInput = {
  profile?: UserStudyProfile | null;
  diagnostic?: StudyPlannerDiagnosticRecord | null;
  latestStudyPlan?: {
    weekKey?: string;
    weeklyBalance?: GeneratedStudyPlan['weekly_balance'];
    dailyTodos?: GeneratedStudyPlan['daily_todos'];
    coachingMessage?: string | null;
  } | null;
  todayStudyTasks: StudyPlanItem[];
  recentStudyTasks: StudyPlanItem[];
};

const SUBJECT_LABEL_MAP: Record<string, string> = {
  kor: '국어',
  math: '수학',
  eng: '영어',
  social: '탐구',
  science: '탐구',
  history: '한국사',
  etc: '기타',
  major: '전공/직렬',
  'admin-law': '법·행정',
  국어: '국어',
  수학: '수학',
  영어: '영어',
  탐구: '탐구',
  기타: '기타',
};

function normalizeSubjectLabel(value?: string | null) {
  if (!value) return null;
  return SUBJECT_LABEL_MAP[value] || value;
}

function resolveTaskMinutes(task: StudyPlanItem) {
  if (task.studyPlanMode === 'time') return Math.max(0, task.targetMinutes || 0);
  if (task.studyPlanMode === 'volume' && task.targetMinutes) return Math.max(0, task.targetMinutes);
  if (task.studyPlanMode === 'volume') return 45;
  return Math.max(0, task.targetMinutes || 0);
}

function isReviewLikeTask(task: Pick<StudyPlanItem, 'title' | 'tag'>) {
  const title = task.title?.toLowerCase?.() || '';
  const tag = task.tag?.toLowerCase?.() || '';
  return ['복습', '오답', '회상', '정리', '테스트', '리뷰'].some((keyword) => title.includes(keyword) || tag.includes(keyword));
}

function hasRetrievalLikeActivity(tasks: StudyPlanItem[]) {
  return tasks.some((task) => isReviewLikeTask(task) || ['백지회상', '설명해보기'].some((keyword) => task.title?.includes(keyword)));
}

function buildSubjectMinutes(tasks: StudyPlanItem[]) {
  return tasks.reduce<Record<string, number>>((acc, task) => {
    const label = normalizeSubjectLabel(task.subject) || '기타';
    acc[label] = (acc[label] || 0) + resolveTaskMinutes(task);
    return acc;
  }, {});
}

function getMissingPrioritySubject(profile?: UserStudyProfile | null, todayStudyTasks: StudyPlanItem[] = []) {
  if (!profile) return null;
  const preferred = [...profile.answers.subjectPriority, ...profile.answers.weakSubjects]
    .map(normalizeSubjectLabel)
    .filter((value): value is string => Boolean(value) && value !== 'none');
  if (preferred.length === 0) return null;
  const included = new Set(
    todayStudyTasks
      .map((task) => normalizeSubjectLabel(task.subject))
      .filter((value): value is string => Boolean(value))
  );
  return preferred.find((subject) => !included.has(subject)) || null;
}

function clampRecommendations(items: MainPlanRecommendation[]) {
  const unique = new Map<string, MainPlanRecommendation>();
  items.forEach((item) => {
    if (!unique.has(item.id)) {
      unique.set(item.id, item);
    }
  });
  return Array.from(unique.values()).slice(0, 2);
}

export function buildMainPlanRecommendations({
  profile,
  diagnostic,
  latestStudyPlan,
  todayStudyTasks,
  recentStudyTasks,
}: BuildMainPlanRecommendationsInput): MainPlanRecommendation[] {
  const items: MainPlanRecommendation[] = [];
  const scores = diagnostic?.result.scores;
  const flags = diagnostic?.result.flags;
  const diagnosticAnswers = diagnostic?.answers;
  const todayTotalMinutes = todayStudyTasks.reduce((sum, task) => sum + resolveTaskMinutes(task), 0);
  const recentAllTasks = [...recentStudyTasks, ...todayStudyTasks];
  const hasReviewToday = hasRetrievalLikeActivity(todayStudyTasks);
  const hasReviewRecently = hasRetrievalLikeActivity(recentAllTasks);
  const missingPrioritySubject = getMissingPrioritySubject(profile, todayStudyTasks);
  const recentSubjectMinutes = buildSubjectMinutes(recentStudyTasks);
  const recentEntries = Object.entries(recentSubjectMinutes).sort((left, right) => right[1] - left[1]);
  const topRecentSubject = recentEntries[0]?.[0] || null;
  const topRecentRatio =
    recentEntries.length > 0
      ? recentEntries[0][1] / Math.max(1, recentEntries.reduce((sum, [, minutes]) => sum + minutes, 0))
      : 0;
  const inefficientSubject = normalizeSubjectLabel(diagnosticAnswers?.lowEfficiencySubject || null);
  const topTimeSubjects = (diagnosticAnswers?.topTimeSubjects || [])
    .map(normalizeSubjectLabel)
    .filter((value): value is string => Boolean(value));

  if (
    (scores?.planning || 0) <= 40 &&
    (scores?.reflection || 0) <= 40 &&
    (todayStudyTasks.length === 0 || !todayStudyTasks.some((task) => Boolean(task.startTime)))
  ) {
    items.push({
      id: 'plan-structure-reset',
      badge: '계획',
      title: '시작 전에 1분만 정리해도 오늘 계획이 덜 흔들려요',
      action: '오늘 첫 공부 전에 과목 순서만 1분 정도 짧게 정하고 들어가보세요.',
      reason: '계획을 먼저 잡으면 중간에 뭘 할지 고민하는 시간이 줄어들어요.',
      explainWhy:
        '지금은 계획과 점검 흐름이 약한 편이라, 계획을 길게 쓰기보다 시작 전 1분과 끝난 뒤 3분 점검처럼 아주 짧은 루틴부터 고정하는 편이 더 잘 맞아요.',
    });
  }

  if ((flags?.efficiencyMismatchFlag || false) && inefficientSubject && topTimeSubjects.includes(inefficientSubject)) {
    items.push({
      id: `efficiency-mismatch-${inefficientSubject}`,
      badge: '학습방법',
      title: `${inefficientSubject}은 시간을 더 넣기보다 방법을 바꿔보는 게 좋아 보여요`,
      action: `오늘 ${inefficientSubject} 1블록은 개념 반복 대신 오답 원인 정리나 설명해보기로 바꿔보세요.`,
      reason: '같은 시간을 써도 활동 유형이 달라지면 효율이 바뀔 수 있어요.',
      explainWhy:
        '진단 기준으로 보면 이 과목은 시간을 많이 쓰는 편인데 성장이 더디게 느껴지는 패턴이 보여요. 그래서 총량을 더 늘리기보다 활동 방식을 바꾸는 쪽이 먼저예요.',
      applyPreset: {
        title: `${inefficientSubject} 오답 원인 정리`,
        subject: inefficientSubject,
        studyMode: 'time',
        targetMinutes: 40,
        tag: '오답',
      },
    });
  }

  if (!hasReviewToday && !hasReviewRecently) {
    const targetSubject = missingPrioritySubject || topRecentSubject || normalizeSubjectLabel(profile?.answers.weakSubjects?.[0]) || '복습';
    items.push({
      id: 'review-spacing',
      badge: '복습',
      title: '오늘 마지막 20분은 복습으로 남겨두는 걸 추천해요',
      action: '새 공부를 조금 줄이고, 오늘 한 내용을 짧게 다시 떠올리거나 오답만 정리해보세요.',
      reason: '바로 다시 꺼내보는 공부가 오래 남는 데 도움이 돼요.',
      explainWhy:
        '최근 계획을 보면 새 내용을 넣는 비중이 크고, 다시 꺼내보는 블록은 거의 없어요. 짧은 복습 블록 하나만 있어도 오늘 공부가 덜 흘러갑니다.',
      applyPreset: {
        title: `${targetSubject} 복습 20분`,
        subject: targetSubject === '복습' ? undefined : targetSubject,
        studyMode: 'time',
        targetMinutes: 20,
        tag: '복습',
      },
    });
  }

  if ((flags?.avoidanceMotivationFlag || flags?.burnoutRiskFlag) && todayTotalMinutes >= 0) {
    items.push({
      id: 'burnout-safe-plan',
      badge: '동기',
      title: '오늘은 총량보다 끊기지 않는 계획이 더 중요해요',
      action: '핵심 과목 1개와 복습 1개만 확실히 끝내는 식으로 먼저 줄여보세요.',
      reason: '너무 큰 계획은 오히려 끝까지 가기 어렵게 만들 수 있어요.',
      explainWhy:
        '최근 진단 기준으로 보면 압박이나 피로가 공부를 끌고 가는 비중이 조금 높아요. 그래서 오늘은 계획을 크게 잡기보다, 끝까지 이어질 수 있는 구조를 먼저 만드는 편이 좋아요.',
    });
  }

  if (topRecentSubject && topRecentRatio >= 0.58 && missingPrioritySubject) {
    items.push({
      id: `subject-balance-${missingPrioritySubject}`,
      badge: '과목배분',
      title: '이번 주는 비어 있는 과목을 최소 블록으로라도 넣어보세요',
      action: `오늘 계획에 빠진 ${missingPrioritySubject}이 있다면 30~40분만이라도 최소 블록으로 추가해보세요.`,
      reason: '완전히 비는 과목이 생기면 나중에 회복 비용이 더 커질 수 있어요.',
      explainWhy:
        `최근 계획은 ${topRecentSubject} 쪽으로 많이 몰려 있어요. 우선 과목이나 부담 과목 중 빠진 과목을 짧게라도 넣어두면 이번 주 밸런스가 덜 무너집니다.`,
      applyPreset: {
        title: `${missingPrioritySubject} 최소 블록`,
        subject: missingPrioritySubject,
        studyMode: 'time',
        targetMinutes: 40,
      },
    });
  }

  const compactItems = clampRecommendations(items);
  if (compactItems.length > 0) return compactItems;

  const latestTodo = latestStudyPlan?.dailyTodos?.[0];
  if (latestTodo) {
    return [
      {
        id: 'weekly-plan-fallback',
        badge: '계획',
        title: `${latestTodo.과목}은 오늘 짧게라도 먼저 넣어두는 편이 좋아요`,
        action: `${latestTodo.활동} 같은 형태로 ${latestTodo.시간}분 정도부터 시작해보세요.`,
        reason: latestStudyPlan?.coachingMessage || '최근 진단 기준을 보면 이번 주 플랜의 우선순위를 먼저 살리는 쪽이 좋아요.',
        explainWhy:
          '최근 진단 결과에서 만든 이번 주 플랜 기준으로 보면, 지금은 한 번에 큰 변경보다 오늘 한 블록을 먼저 맞춰보는 방식이 가장 현실적이에요.',
        applyPreset: {
          title: `${latestTodo.과목} ${latestTodo.활동}`,
          subject: latestTodo.과목,
          studyMode: 'time',
          targetMinutes: latestTodo.시간,
        },
      },
    ];
  }

  return [
    {
      id: 'generic-plan-start',
      badge: '계획',
      title: '오늘 계획은 2블록만 먼저 적어도 흐름이 잡혀요',
      action: '핵심 과목 1개와 마무리용 복습 1개부터 먼저 넣어보세요.',
      reason: '계획을 전부 다 짜기보다 시작할 블록 2개를 먼저 잡는 편이 훨씬 쉽게 이어져요.',
      explainWhy:
        '지금은 데이터를 더 쌓는 단계라, 과목과 시간대를 완벽하게 맞추기보다 오늘 바로 시작할 수 있는 최소 구조를 먼저 만드는 편이 좋아요.',
    },
  ];
}
