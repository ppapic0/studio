import {
  BREAK_STYLE_OPTIONS,
  EXAM_GOAL_OPTIONS,
  FOCUS_TIME_OPTIONS,
  GRADE_BAND_OPTIONS,
  PLAN_STYLE_OPTIONS,
  ROUTINE_ARCHETYPES,
  SESSION_LENGTH_OPTIONS,
  createDefaultOnboardingAnswers,
  generateRoutineRecommendationSet,
  getQuestionOptionLabel,
  getSubjectOption,
} from '@/lib/recommend-routine';
import {
  type OnboardingAnswer,
  type PeerSimilarityTag,
  type RecommendedRoutine,
  type RoutineReaction,
  type RoutineSocialProfile,
  type RoutineTemplateSave,
  type RoutineVisibility,
  type SharedRoutine,
  type StudyGroup,
  type UserStudyProfile,
} from '@/lib/types';

type SharedRoutineSeed = {
  id: string;
  source: SharedRoutine['source'];
  authorAlias: string;
  authorName?: string;
  authorMode: SharedRoutine['authorMode'];
  authorSchoolLabel?: string;
  visibility: SharedRoutine['visibility'];
  groupId?: string;
  groupName?: string;
  authorNote: string;
  reflectionTip: string;
  reactionCounts: Record<RoutineReaction['type'], number>;
  answerOverrides: Partial<OnboardingAnswer>;
};

export type RoutineExploreSection = {
  id: string;
  title: string;
  description: string;
  items: SharedRoutine[];
};

export type RoutineSocialInteractionState = {
  cheeredIds: string[];
  referencedIds: string[];
};

export const ROUTINE_VISIBILITY_LABELS: Record<RoutineVisibility, string> = {
  private: '나만 보기',
  friends: '친구만',
  group: '그룹만',
  anonymous: '익명 공개',
  profile: '프로필 공개',
};

export const ROUTINE_VISIBILITY_DESCRIPTIONS: Record<RoutineVisibility, string> = {
  private: '기본값입니다. 내 루틴은 다른 학생에게 보이지 않습니다.',
  friends: '친구로 연결된 학생에게만 루틴이 보입니다.',
  group: '선택한 스터디 그룹 안에서만 루틴을 참고할 수 있습니다.',
  anonymous: '이름과 학교 없이 익명 별칭, 학년, 목표 태그만 공개됩니다.',
  profile: '닉네임과 학교/학년 정보를 포함해 루틴을 공개합니다.',
};

export const PEER_SIMILARITY_LABELS: Record<PeerSimilarityTag, string> = {
  'same-grade': '같은 학년',
  'same-goal': '같은 목표',
  'same-weak-subject': '같은 약점 과목',
  'same-session': '비슷한 세션 길이',
  'same-focus-time': '비슷한 집중 시간대',
  'same-plan-style': '비슷한 계획 스타일',
};

export const MOCK_STUDY_GROUPS: StudyGroup[] = [
  {
    id: 'night-focus-lab',
    name: '야간 몰입 연구실',
    description: '저녁 집중형 학생들이 루틴 아이디어를 나누는 그룹',
    focusLabel: '저녁 몰입',
    memberCount: 18,
    accentLabel: '야간 피크',
  },
  {
    id: 'math-recovery-room',
    name: '수학 회복 스터디',
    description: '수학 약점을 하루 한 블록씩 회복하는 학생들',
    focusLabel: '약점 회복',
    memberCount: 12,
    accentLabel: '수학 회복',
  },
  {
    id: 'school-balance-club',
    name: '학교 병행 루틴클럽',
    description: '내신, 수행, 자습을 균형 있게 굴리는 루틴 모음',
    focusLabel: '내신 균형',
    memberCount: 15,
    accentLabel: '학교 병행',
  },
];

const SHARED_ROUTINE_SEEDS: SharedRoutineSeed[] = [
  {
    id: 'shared-night-exam-sprint',
    source: 'similar',
    authorAlias: '저녁몰입 고3',
    authorMode: 'anonymous',
    visibility: 'anonymous',
    authorNote: '학교 끝나고 바로 앉는 게 어렵다면, 첫 블록만 쉬운 문제로 열어도 루틴이 덜 무너집니다.',
    reflectionTip: '첫 블록을 무조건 25분 안에 시작하는 것만 지켜도 흐름이 붙어요.',
    reactionCounts: { cheer: 19, save: 42, reference: 13 },
    answerOverrides: {
      gradeBand: 'high',
      examGoal: 'college-sprint',
      difficultSubjects: ['math', 'eng'],
      laggingStudyTypes: ['problem-solving'],
      derailReason: 'fatigue',
      preferredSessionLength: '70-80',
      preferredPlanStyle: 'time-table',
      bestFocusTime: 'evening',
      preferredBreakStyle: 'one-long',
    },
  },
  {
    id: 'shared-math-recovery',
    source: 'goal',
    authorAlias: '회복루틴 메이커',
    authorMode: 'anonymous',
    visibility: 'anonymous',
    authorNote: '약한 과목은 길게 잡으면 더 미루게 돼서, 첫 블록을 짧게 쪼개는 방식으로 바꿨어요.',
    reflectionTip: '약한 과목을 25분만 해도 성공으로 체크하면 다음날 저항이 줄어요.',
    reactionCounts: { cheer: 14, save: 31, reference: 9 },
    answerOverrides: {
      examGoal: 'balance-recovery',
      difficultSubjects: ['math', 'science'],
      laggingStudyTypes: ['concept', 'problem-solving'],
      derailReason: 'unclear-priority',
      preferredSessionLength: '45-50',
      preferredPlanStyle: 'guided',
      bestFocusTime: 'afternoon',
    },
  },
  {
    id: 'shared-school-balance',
    source: 'goal',
    authorAlias: '차분한 고2',
    authorMode: 'profile',
    authorName: '차분한 고2',
    authorSchoolLabel: '문정고',
    visibility: 'profile',
    authorNote: '내신이랑 수행이 같이 있을 때는 과목 밸런스를 억지로 맞추기보다, 학교 일정이 끼는 과목을 먼저 반영하는 게 편했어요.',
    reflectionTip: '학교 과제 확인 블록을 앞에 두면 뒤 블록이 덜 흔들립니다.',
    reactionCounts: { cheer: 21, save: 38, reference: 16 },
    answerOverrides: {
      examGoal: 'school-rank',
      difficultSubjects: ['kor', 'eng'],
      laggingStudyTypes: ['assignment', 'review'],
      derailReason: 'subject-switch',
      preferredSessionLength: '45-50',
      preferredPlanStyle: 'block',
      bestFocusTime: 'afternoon',
    },
  },
  {
    id: 'shared-night-focus-group',
    source: 'group',
    authorAlias: '야간 피크형',
    authorMode: 'anonymous',
    visibility: 'group',
    groupId: 'night-focus-lab',
    groupName: '야간 몰입 연구실',
    authorNote: '낮에는 예열만 하고 저녁에 메인 블록을 몰아 두면 피로감이 덜했어요.',
    reflectionTip: '피곤한 날은 마지막 블록을 복습 블록으로 낮추는 규칙을 꼭 남겨두세요.',
    reactionCounts: { cheer: 11, save: 27, reference: 7 },
    answerOverrides: {
      examGoal: 'mock-improvement',
      difficultSubjects: ['math'],
      laggingStudyTypes: ['problem-solving', 'review'],
      derailReason: 'fatigue',
      preferredSessionLength: '70-80',
      preferredPlanStyle: 'guided',
      bestFocusTime: 'evening',
      supportMode: 'peers',
    },
  },
  {
    id: 'shared-friend-memory-boost',
    source: 'friend',
    authorAlias: '단어회수 루틴',
    authorMode: 'profile',
    authorName: '단어회수 루틴',
    authorSchoolLabel: '대송여고',
    visibility: 'friends',
    authorNote: '암기 블록은 길게 하기보다 하루 두 번 짧게 넣는 게 더 잘 남았어요.',
    reflectionTip: '짧은 암기 블록은 체크 기준을 “전부 외움”이 아니라 “한 번 더 봄”으로 두세요.',
    reactionCounts: { cheer: 9, save: 24, reference: 8 },
    answerOverrides: {
      gradeBand: 'high',
      examGoal: 'school-rank',
      difficultSubjects: ['eng', 'history'],
      laggingStudyTypes: ['memorization', 'review'],
      derailReason: 'slow-start',
      preferredSessionLength: '25-30',
      preferredPlanStyle: 'todo',
      bestFocusTime: 'morning',
      supportMode: 'peers',
    },
  },
  {
    id: 'shared-group-math-recovery',
    source: 'group',
    authorAlias: '수학회복 고2',
    authorMode: 'anonymous',
    visibility: 'group',
    groupId: 'math-recovery-room',
    groupName: '수학 회복 스터디',
    authorNote: '수학이 너무 밀릴 때는 매일 첫 블록을 고정하고, 마무리는 오답 회수로만 닫았어요.',
    reflectionTip: '문제풀이 블록 다음엔 오답 회수 15분을 붙여야 다음날 부담이 줄어요.',
    reactionCounts: { cheer: 16, save: 44, reference: 12 },
    answerOverrides: {
      gradeBand: 'high',
      examGoal: 'balance-recovery',
      difficultSubjects: ['math'],
      laggingStudyTypes: ['problem-solving'],
      derailReason: 'unclear-priority',
      preferredSessionLength: '45-50',
      preferredPlanStyle: 'guided',
      bestFocusTime: 'evening',
      supportMode: 'peers',
    },
  },
  {
    id: 'shared-popular-reset',
    source: 'popular',
    authorAlias: '재시동 루틴',
    authorMode: 'anonymous',
    visibility: 'anonymous',
    authorNote: '계획을 매일 새로 세우려 하지 않고, 첫 블록 하나만 성공 기준으로 두니까 루틴이 다시 살아났어요.',
    reflectionTip: '무너진 날엔 전체 수정 말고 첫 블록 난도만 낮추는 게 회복에 더 빨라요.',
    reactionCounts: { cheer: 28, save: 61, reference: 18 },
    answerOverrides: {
      examGoal: 'habit-reset',
      difficultSubjects: ['math'],
      laggingStudyTypes: ['review'],
      derailReason: 'too-hard',
      preferredSessionLength: '25-30',
      preferredPlanStyle: 'guided',
      bestFocusTime: 'variable',
      preferredBreakStyle: 'short-often',
    },
  },
];

export function buildInitialRoutineSocialProfile(options: {
  studyProfile?: UserStudyProfile | null;
  socialProfile?: RoutineSocialProfile | null;
  studentName?: string | null;
  gradeLabel?: string | null;
}) {
  const { studyProfile, socialProfile, studentName, gradeLabel } = options;
  if (socialProfile) return socialProfile;

  return {
    visibility: studyProfile?.sharingPreference || 'private',
    previewAlias: buildPreviewAlias(studentName || undefined, gradeLabel || undefined, studyProfile),
    selectedGroupIds: [],
    allowCheer: true,
    allowTemplateSave: true,
  } satisfies RoutineSocialProfile;
}

export function buildRoutineVisibilityPreview(options: {
  socialProfile: RoutineSocialProfile;
  studyProfile?: UserStudyProfile | null;
  studentName?: string | null;
  schoolName?: string | null;
  gradeLabel?: string | null;
}) {
  const { socialProfile, studyProfile, studentName, schoolName, gradeLabel } = options;
  const focusLabel = studyProfile
    ? getQuestionOptionLabel(FOCUS_TIME_OPTIONS, studyProfile.answers.bestFocusTime)
    : '집중 시간대';
  const goalLabel = studyProfile
    ? getQuestionOptionLabel(EXAM_GOAL_OPTIONS, studyProfile.answers.examGoal)
    : '목표 미정';

  if (socialProfile.visibility === 'private') {
    return {
      title: '나만 보기',
      subtitle: '현재 루틴은 다른 학생에게 보이지 않습니다.',
      authorLabel: studentName || '내 루틴',
      metaLabel: '공개 전 미리보기만 가능합니다.',
    };
  }

  if (socialProfile.visibility === 'anonymous') {
    return {
      title: '익명 공개 미리보기',
      subtitle: '닉네임 대신 익명 별칭과 학년/목표 태그만 보입니다.',
      authorLabel: socialProfile.previewAlias,
      metaLabel: `${gradeLabel || '학생'} · ${goalLabel} · ${focusLabel}`,
    };
  }

  if (socialProfile.visibility === 'group') {
    return {
      title: '그룹 공개 미리보기',
      subtitle: '선택한 스터디 그룹 학생만 이 루틴을 참고할 수 있습니다.',
      authorLabel: socialProfile.previewAlias || studentName || '루틴 메이커',
      metaLabel: `${gradeLabel || '학생'} · ${goalLabel}`,
    };
  }

  if (socialProfile.visibility === 'friends') {
    return {
      title: '친구 공개 미리보기',
      subtitle: '친구 연결 학생에게만 루틴 카드가 보입니다.',
      authorLabel: socialProfile.previewAlias || studentName || '친구 공개 루틴',
      metaLabel: `${gradeLabel || '학생'} · ${goalLabel}`,
    };
  }

  return {
    title: '프로필 공개 미리보기',
    subtitle: '닉네임과 학교/학년 정보를 포함해 루틴을 공유합니다.',
    authorLabel: studentName || socialProfile.previewAlias || '공개 루틴',
    metaLabel: `${schoolName || '학교 미정'} · ${gradeLabel || '학년 미정'} · ${goalLabel}`,
  };
}

export function buildRoutineExploreSections(options: {
  studyProfile?: UserStudyProfile | null;
  socialProfile?: RoutineSocialProfile | null;
  savedTemplates?: RoutineTemplateSave[] | null;
}) {
  const viewerProfile = options.studyProfile;
  const viewerAnswers = viewerProfile?.answers || createDefaultOnboardingAnswers();
  const socialProfile = buildInitialRoutineSocialProfile({
    studyProfile: viewerProfile,
    socialProfile: options.socialProfile,
  });
  const savedRoutineIds = new Set((options.savedTemplates || []).map((item) => item.routineId));

  const routines = SHARED_ROUTINE_SEEDS.map((seed) =>
    applyViewerStateToRoutine(buildSharedRoutineFromSeed(seed), viewerAnswers, socialProfile, savedRoutineIds)
  );

  const sortedBySimilarity = [...routines].sort((left, right) => getSimilarityScore(right) - getSimilarityScore(left));
  const sortedBySaveCount = [...routines].sort(
    (left, right) => getReactionCount(right, 'save') - getReactionCount(left, 'save')
  );
  const savedItems = routines.filter((routine) => savedRoutineIds.has(routine.id)).slice(0, 3);
  const excludedIds = new Set(savedItems.map((item) => item.id));

  const similarItems = sortedBySimilarity.filter((item) => !excludedIds.has(item.id)).slice(0, 3);
  const sameGoalItems = routines
    .filter(
      (routine) =>
        routine.sourceAnswers.examGoal === viewerAnswers.examGoal &&
        !excludedIds.has(routine.id) &&
        !similarItems.some((item) => item.id === routine.id)
    )
    .slice(0, 3);

  const groupIds = socialProfile.selectedGroupIds.length > 0 ? socialProfile.selectedGroupIds : MOCK_STUDY_GROUPS.slice(0, 2).map((group) => group.id);
  const groupItems = routines
    .filter(
      (routine) =>
        !excludedIds.has(routine.id) &&
        !similarItems.some((item) => item.id === routine.id) &&
        !sameGoalItems.some((item) => item.id === routine.id) &&
        (routine.source === 'friend' || (routine.groupId && groupIds.includes(routine.groupId)))
    )
    .slice(0, 3);

  const popularItems = sortedBySaveCount
    .filter(
      (routine) =>
        !excludedIds.has(routine.id) &&
        !similarItems.some((item) => item.id === routine.id) &&
        !sameGoalItems.some((item) => item.id === routine.id) &&
        !groupItems.some((item) => item.id === routine.id)
    )
    .slice(0, 3);

  const sections: RoutineExploreSection[] = [
    ...(savedItems.length > 0
      ? [
          {
            id: 'saved',
            title: '내가 저장한 참고 루틴',
            description: '예전에 담아둔 루틴을 다시 보고, 오늘 루틴으로 바로 바꿔 쓸 수 있어요.',
            items: savedItems,
          } satisfies RoutineExploreSection,
        ]
      : []),
    {
      id: 'similar',
      title: '비슷한 학생 루틴',
      description: '같은 학년, 목표, 약점 과목, 집중 시간대를 먼저 반영한 추천입니다.',
      items: similarItems,
    },
    {
      id: 'goal',
      title: '같은 목표에서 많이 저장한 루틴',
      description: '내신, 모의고사, 습관 회복처럼 비슷한 목표를 가진 학생들이 자주 저장한 루틴입니다.',
      items: sameGoalItems,
    },
    {
      id: 'group',
      title: '친구/스터디 그룹 루틴',
      description: '비교보다 참고용으로 보기 좋은 가까운 루틴만 모았습니다.',
      items: groupItems,
    },
    {
      id: 'popular',
      title: '저장 많이 된 루틴 템플릿',
      description: '부담이 적고 바로 가져다 쓰기 쉬워서 저장 수가 높은 템플릿입니다.',
      items: popularItems,
    },
  ].filter((section) => section.items.length > 0);

  return {
    routines,
    sections,
  };
}

export function findSharedRoutineById(
  routineId: string,
  options: {
    studyProfile?: UserStudyProfile | null;
    socialProfile?: RoutineSocialProfile | null;
    savedTemplates?: RoutineTemplateSave[] | null;
  }
) {
  const { routines } = buildRoutineExploreSections(options);
  return routines.find((routine) => routine.id === routineId) || null;
}

export function buildProfileFromSharedRoutine(profile: UserStudyProfile, sharedRoutine: SharedRoutine): UserStudyProfile {
  const selectedRoutine = sharedRoutine.routine;
  const archetypeName =
    ROUTINE_ARCHETYPES.find((item) => item.id === selectedRoutine.archetypeId)?.name || profile.archetypeName;

  return {
    ...profile,
    archetypeId: selectedRoutine.archetypeId,
    archetypeName,
    selectedRoutineId: selectedRoutine.id,
    selectedRoutine,
    recommendedRoutines: [
      selectedRoutine,
      ...profile.recommendedRoutines.filter((routine) => routine.id !== selectedRoutine.id),
    ].slice(0, 6),
  };
}

export function createRoutineTemplateSaveRecord(
  routine: SharedRoutine,
  source: RoutineTemplateSave['source']
): RoutineTemplateSave {
  return {
    routineId: routine.id,
    routineName: routine.title,
    authorAlias: routine.authorAlias,
    source,
    savedAtISO: new Date().toISOString(),
  };
}

export function upsertSavedRoutineTemplate(
  currentTemplates: RoutineTemplateSave[] | undefined,
  nextTemplate: RoutineTemplateSave
) {
  const nextTemplates = [
    nextTemplate,
    ...(currentTemplates || []).filter((item) => item.routineId !== nextTemplate.routineId),
  ];
  return nextTemplates.slice(0, 24);
}

export function createRoutineInteractionStorageKey(userId: string) {
  return `routine-social-interactions:${userId}`;
}

export function readRoutineInteractionState(storageKey: string): RoutineSocialInteractionState {
  if (!storageKey || typeof window === 'undefined') {
    return { cheeredIds: [], referencedIds: [] };
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { cheeredIds: [], referencedIds: [] };
    const parsed = JSON.parse(raw) as RoutineSocialInteractionState;
    return {
      cheeredIds: Array.isArray(parsed.cheeredIds) ? parsed.cheeredIds : [],
      referencedIds: Array.isArray(parsed.referencedIds) ? parsed.referencedIds : [],
    };
  } catch {
    return { cheeredIds: [], referencedIds: [] };
  }
}

export function writeRoutineInteractionState(storageKey: string, state: RoutineSocialInteractionState) {
  if (!storageKey || typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

export function toggleRoutineInteraction(
  state: RoutineSocialInteractionState,
  type: 'cheeredIds' | 'referencedIds',
  routineId: string
) {
  const currentSet = new Set(state[type]);
  if (currentSet.has(routineId)) currentSet.delete(routineId);
  else currentSet.add(routineId);
  return {
    ...state,
    [type]: Array.from(currentSet),
  };
}

export function applyInteractionStateToRoutine(
  routine: SharedRoutine,
  state: RoutineSocialInteractionState
) {
  return {
    ...routine,
    reactions: routine.reactions.map((reaction) => {
      if (reaction.type === 'cheer') {
        return { ...reaction, viewerReacted: state.cheeredIds.includes(routine.id) || reaction.viewerReacted };
      }
      if (reaction.type === 'reference') {
        return { ...reaction, viewerReacted: state.referencedIds.includes(routine.id) };
      }
      return reaction;
    }),
  };
}

export function getReactionCount(routine: SharedRoutine, type: RoutineReaction['type']) {
  const reaction = routine.reactions.find((item) => item.type === type);
  return reaction ? reaction.count + (reaction.viewerReacted ? 1 : 0) : 0;
}

function buildSharedRoutineFromSeed(seed: SharedRoutineSeed): SharedRoutine {
  const answers = {
    ...createDefaultOnboardingAnswers(),
    ...seed.answerOverrides,
  } satisfies OnboardingAnswer;
  const primaryRoutine = generateRoutineRecommendationSet(answers).primaryRoutine;

  return {
    id: seed.id,
    source: seed.source,
    title: primaryRoutine.name,
    summary: primaryRoutine.oneLineDescription,
    authorAlias: seed.authorAlias,
    authorName: seed.authorName,
    authorMode: seed.authorMode,
    authorSchoolLabel: seed.authorSchoolLabel,
    gradeLabel: getQuestionOptionLabel(GRADE_BAND_OPTIONS, answers.gradeBand),
    goalLabel: getQuestionOptionLabel(EXAM_GOAL_OPTIONS, answers.examGoal),
    styleTags: [
      getQuestionOptionLabel(PLAN_STYLE_OPTIONS, answers.preferredPlanStyle),
      getQuestionOptionLabel(SESSION_LENGTH_OPTIONS, answers.preferredSessionLength),
      getQuestionOptionLabel(FOCUS_TIME_OPTIONS, answers.bestFocusTime),
    ],
    weakSubjectTags: answers.difficultSubjects.slice(0, 2).map((subjectId) => getSubjectOption(subjectId).label),
    similarityTags: [],
    fitSummary: primaryRoutine.fitStudent,
    authorNote: seed.authorNote,
    reflectionTip: seed.reflectionTip,
    dayStructureLabel: primaryRoutine.dayStructureSummary,
    subjectBalanceLabel: primaryRoutine.subjectPlacement,
    breakRuleLabel: primaryRoutine.breakRule,
    reviewRuleLabel: primaryRoutine.reviewRules.map((rule) => `${rule.title} · ${rule.timing}`).join(' / '),
    reactions: buildReactions(seed.reactionCounts),
    visibility: seed.visibility,
    groupId: seed.groupId,
    groupName: seed.groupName,
    sourceAnswers: {
      gradeBand: answers.gradeBand,
      examGoal: answers.examGoal,
      difficultSubjects: answers.difficultSubjects,
      preferredSessionLength: answers.preferredSessionLength,
      bestFocusTime: answers.bestFocusTime,
      preferredPlanStyle: answers.preferredPlanStyle,
    },
    routine: primaryRoutine,
  };
}

function buildReactions(reactionCounts: SharedRoutineSeed['reactionCounts']): RoutineReaction[] {
  return [
    { type: 'cheer', label: '응원', count: reactionCounts.cheer },
    { type: 'save', label: '저장', count: reactionCounts.save },
    { type: 'reference', label: '참고', count: reactionCounts.reference },
  ];
}

function applyViewerStateToRoutine(
  routine: SharedRoutine,
  viewerAnswers: OnboardingAnswer,
  socialProfile: RoutineSocialProfile,
  savedRoutineIds: Set<string>
) {
  const similarityTags = buildSimilarityTags(viewerAnswers, routine.sourceAnswers);
  return {
    ...routine,
    similarityTags,
    reactions: routine.reactions.map((reaction) =>
      reaction.type === 'save'
        ? { ...reaction, viewerReacted: savedRoutineIds.has(routine.id) && socialProfile.allowTemplateSave }
        : reaction
    ),
  };
}

function buildSimilarityTags(
  viewerAnswers: OnboardingAnswer,
  sourceAnswers: SharedRoutine['sourceAnswers']
) {
  const tags: PeerSimilarityTag[] = [];
  if (viewerAnswers.gradeBand === sourceAnswers.gradeBand) tags.push('same-grade');
  if (viewerAnswers.examGoal === sourceAnswers.examGoal) tags.push('same-goal');
  if (viewerAnswers.preferredSessionLength === sourceAnswers.preferredSessionLength) tags.push('same-session');
  if (viewerAnswers.bestFocusTime === sourceAnswers.bestFocusTime) tags.push('same-focus-time');
  if (viewerAnswers.preferredPlanStyle === sourceAnswers.preferredPlanStyle) tags.push('same-plan-style');
  if (viewerAnswers.difficultSubjects.some((subject) => sourceAnswers.difficultSubjects.includes(subject))) {
    tags.push('same-weak-subject');
  }
  return tags;
}

function getSimilarityScore(routine: SharedRoutine) {
  return routine.similarityTags.reduce((score, tag) => {
    if (tag === 'same-goal') return score + 7;
    if (tag === 'same-weak-subject') return score + 6;
    if (tag === 'same-grade') return score + 5;
    return score + 3;
  }, 0);
}

function buildPreviewAlias(
  studentName: string | undefined,
  gradeLabel: string | undefined,
  studyProfile?: UserStudyProfile | null
) {
  if (studentName && studentName.trim().length > 0) {
    const sanitized = studentName.trim().slice(0, 2);
    if (studyProfile) {
      const goalLabel = getQuestionOptionLabel(EXAM_GOAL_OPTIONS, studyProfile.answers.examGoal);
      return `${sanitized} · ${goalLabel}`;
    }
    return `${sanitized} 루틴`;
  }

  if (studyProfile) {
    const focusLabel = getQuestionOptionLabel(FOCUS_TIME_OPTIONS, studyProfile.answers.bestFocusTime);
    return `${gradeLabel || '학생'} ${focusLabel}`;
  }

  return `${gradeLabel || '학생'} 루틴`;
}

export function getSimilarityTagLabel(tag: PeerSimilarityTag) {
  return PEER_SIMILARITY_LABELS[tag];
}

export function getVisibilityLabel(visibility: RoutineVisibility) {
  return ROUTINE_VISIBILITY_LABELS[visibility];
}

export function getStudyGroupName(groupId?: string | null) {
  return MOCK_STUDY_GROUPS.find((group) => group.id === groupId)?.name || null;
}

export function getBreakStyleLabel(routine: RecommendedRoutine, answers: OnboardingAnswer) {
  return `${getQuestionOptionLabel(BREAK_STYLE_OPTIONS, answers.preferredBreakStyle)} · ${routine.breakRule}`;
}
