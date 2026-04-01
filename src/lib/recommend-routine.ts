import {
  type OnboardingAnswer,
  type RecommendedRoutine,
  type StudyPlanArchetype,
} from '@/lib/types';
import { buildRecommendedStudyPlan, buildRecommendedStudyPlans, type StudyPlanCustomizationDraft } from '@/lib/study-plan/build-recommended-study-plans';
import { calculatePlanArchetypeScores } from '@/lib/study-plan/calculate-plan-archetype-scores';
import { SUBJECT_OPTIONS, getSubjectOption } from '@/lib/study-plan/study-plan-subjects';
import { STUDY_PLAN_ARCHETYPES } from '@/lib/study-plan/study-plan-recommendation-config';
import { syncStudyPlanAnswerCompatibility } from '@/lib/study-plan/sync-onboarding-answer';

type ChoiceOption<T extends string = string> = {
  value: T;
  label: string;
  description: string;
};

export type { ChoiceOption, StudyPlanCustomizationDraft as RoutineCustomizationDraft };

export const ROUTINE_ARCHETYPES = STUDY_PLAN_ARCHETYPES;

export const GRADE_BAND_OPTIONS: ChoiceOption<OnboardingAnswer['gradeBand']>[] = [
  { value: 'middle', label: '중학생', description: '학교 공부 중심' },
  { value: 'high', label: '고등학생', description: '내신/수능형' },
  { value: 'repeat', label: 'N수/공시', description: '장시간 집중형' },
];

export const EXAM_GOAL_OPTIONS: ChoiceOption<OnboardingAnswer['examGoal']>[] = [
  { value: 'school-rank', label: '내신 중심', description: '학교 시험과 수행 관리' },
  { value: 'mock-improvement', label: '모의고사 상승', description: '실전 감각 회복' },
  { value: 'college-sprint', label: '수능/N수 집중', description: '장시간 수험형 배분' },
  { value: 'balance-recovery', label: '과목 균형 회복', description: '편중 완화' },
  { value: 'habit-reset', label: '루틴 재정비', description: '유지 가능한 총량 회복' },
  { value: 'specific-test', label: '특정 시험 준비', description: '공시/자격/기타 시험' },
  { value: 'undecided', label: '목표 탐색 중', description: '방향 정리 단계' },
];

export const SESSION_LENGTH_OPTIONS: ChoiceOption<OnboardingAnswer['preferredSessionLength']>[] = [
  { value: '25-30', label: '70~90분 진입형', description: '이전 호환용 라벨입니다.' },
  { value: '45-50', label: '유동형', description: '이전 호환용 라벨입니다.' },
  { value: '70-80', label: '긴 블록 선호', description: '이전 호환용 라벨입니다.' },
  { value: 'flexible', label: '긴 블록 가변형', description: '이전 호환용 라벨입니다.' },
];

export const BREAK_STYLE_OPTIONS: ChoiceOption<OnboardingAnswer['preferredBreakStyle']>[] = [
  { value: 'short-often', label: '짧게 빠른 휴식', description: '20분 안쪽 복귀' },
  { value: 'one-long', label: '길게 한 번', description: '30분 전후 휴식' },
  { value: 'subject-switch', label: '과목 전환형', description: '이전 호환용 라벨입니다.' },
  { value: 'fixed', label: '고정 휴식', description: '20~30분 고정' },
  { value: 'unsure', label: '아직 탐색 중', description: '상황에 따라 달라짐' },
];

export const PLAN_STYLE_OPTIONS: ChoiceOption<OnboardingAnswer['preferredPlanStyle']>[] = [
  { value: 'time-table', label: '시간표형', description: '시간 축이 분명한 계획' },
  { value: 'block', label: '블록형', description: '큰 공부 블록 중심' },
  { value: 'todo', label: '할 일형', description: '이전 호환용 라벨입니다.' },
  { value: 'guided', label: '추천 후 수정형', description: '추천 기반 시작' },
  { value: 'searching', label: '아직 찾는 중', description: '계획 방식 탐색 중' },
];

export const FOCUS_TIME_OPTIONS: ChoiceOption<OnboardingAnswer['bestFocusTime']>[] = [
  { value: 'morning', label: '아침/오전', description: '초반 몰입형' },
  { value: 'afternoon', label: '오후', description: '낮 중심형' },
  { value: 'evening', label: '저녁', description: '야간 집중형' },
  { value: 'late-night', label: '밤', description: '늦은 시간 몰입형' },
  { value: 'variable', label: '일정하지 않음', description: '그날그날 달라짐' },
];

export function createDefaultOnboardingAnswers(): OnboardingAnswer {
  return syncStudyPlanAnswerCompatibility({
    learnerType: 'high3_csat',
    dailyStudyHours: '10h',
    mainBlockLength: '150m',
    breakPreference: '30',
    subjectPriority: ['math'],
    weakSubjects: ['math'],
    focusPeak: 'evening',
    planBreakReason: 'subject-imbalance',
    planningStyle: 'subject-hours',
    reflectionStyle: 'subject-progress',
    sharingPreference: 'private',
    gradeBand: 'high',
    examGoal: 'college-sprint',
    weekdayAvailability: ['weekday-evening'],
    weekendAvailability: ['weekend-afternoon', 'weekend-evening'],
    difficultSubjects: ['math'],
    laggingStudyTypes: ['review'],
    derailReason: 'unclear-priority',
    preferredSessionLength: 'flexible',
    preferredBreakStyle: 'fixed',
    preferredPlanStyle: 'block',
    supportMode: 'solo',
    bestFocusTime: 'evening',
    legacyReflectionStyle: 'weekly-deep',
  });
}

export function generateRoutineRecommendationSet(answers: OnboardingAnswer) {
  const normalizedAnswers = syncStudyPlanAnswerCompatibility(answers);
  const matchedArchetypes = calculatePlanArchetypeScores(normalizedAnswers);
  const recommendations = buildRecommendedStudyPlans({
    answers: normalizedAnswers,
    rankedArchetypes: matchedArchetypes,
  });

  return {
    matchedArchetypes,
    recommendations,
    primaryRoutine: recommendations[0],
  };
}

export function customizeRecommendedRoutine(
  routine: RecommendedRoutine,
  answers: OnboardingAnswer,
  draft: Partial<StudyPlanCustomizationDraft>
) {
  const normalizedAnswers = syncStudyPlanAnswerCompatibility(answers);
  const archetype = ROUTINE_ARCHETYPES.find((item) => item.id === routine.archetypeId) || ROUTINE_ARCHETYPES[0];
  return buildRecommendedStudyPlan({
    answers: normalizedAnswers,
    archetype,
    priority: routine.priority,
    draft,
  });
}

export function getQuestionOptionLabel<T extends string>(options: ChoiceOption<T>[], value?: T | null) {
  if (!value) return '';
  return options.find((option) => option.value === value)?.label || '';
}

export { SUBJECT_OPTIONS, getSubjectOption, syncStudyPlanAnswerCompatibility };
