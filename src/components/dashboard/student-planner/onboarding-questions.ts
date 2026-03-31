import { type OnboardingAnswer } from '@/lib/types';

type OptionPatch = Partial<OnboardingAnswer>;

export type OnboardingQuestionOption = {
  id: string;
  label: string;
  patch?: OptionPatch;
  value?: string;
  exclusive?: boolean;
};

export type OnboardingSubQuestionConfig = {
  id: string;
  title: string;
  type: 'single';
  helperText?: string;
  options: OnboardingQuestionOption[];
};

export type OnboardingQuestionConfig =
  | {
      id: string;
      title: string;
      description: string;
      helperText?: string;
      type: 'single';
      options: OnboardingQuestionOption[];
      multiSelect?: false;
    }
  | {
      id: string;
      title: string;
      description: string;
      helperText?: string;
      type: 'multi';
      options: OnboardingQuestionOption[];
      multiSelect: true;
      maxSelect: number;
      fieldKey: 'difficultSubjects';
    }
  | {
      id: string;
      title: string;
      description: string;
      helperText?: string;
      type: 'dual';
      subQuestions: OnboardingSubQuestionConfig[];
    };

const commonHelperText = '정답은 없어요. 지금 나와 가장 가까운 걸 골라주세요.';

export const ONBOARDING_QUESTIONS: OnboardingQuestionConfig[] = [
  {
    id: 'grade_goal',
    title: '지금 가장 가까운 목표가 뭐예요?',
    description: '학년과 목표에 따라 추천 루틴이 달라져요.',
    helperText: commonHelperText,
    type: 'single',
    options: [
      { id: 'middle-balance', label: '중학생 · 학교 공부 균형', patch: { gradeBand: 'middle', examGoal: 'balance-recovery' } },
      { id: 'high-school-rank', label: '고등학생 · 내신 관리', patch: { gradeBand: 'high', examGoal: 'school-rank' } },
      { id: 'high-college', label: '고등학생 · 수능 대비', patch: { gradeBand: 'high', examGoal: 'college-sprint' } },
      { id: 'repeat-exam', label: 'N수생 · 시험 집중', patch: { gradeBand: 'repeat', examGoal: 'college-sprint' } },
      { id: 'specific-test', label: '특정 시험/평가 준비 중', patch: { examGoal: 'specific-test' } },
      { id: 'undecided', label: '아직 뚜렷한 목표는 없어요', patch: { examGoal: 'undecided' } },
    ],
  },
  {
    id: 'weekday_time',
    title: '평일에는 언제 공부가 가장 잘 되나요?',
    description: '루틴의 시작 시간과 과목 순서를 정할 때 반영돼요.',
    helperText: commonHelperText,
    type: 'single',
    options: [
      { id: 'weekday-morning', label: '학교 가기 전 아침', patch: { weekdayAvailability: ['weekday-morning'] } },
      { id: 'weekday-after-school', label: '방과 후 오후', patch: { weekdayAvailability: ['weekday-after-school'] } },
      { id: 'weekday-evening', label: '저녁 시간대', patch: { weekdayAvailability: ['weekday-evening'] } },
      { id: 'weekday-night', label: '밤 늦게', patch: { weekdayAvailability: ['weekday-night'] } },
      { id: 'weekday-variable', label: '그날그날 달라요', patch: { weekdayAvailability: ['weekday-after-school', 'weekday-evening'] } },
    ],
  },
  {
    id: 'weekend_time',
    title: '주말에는 보통 어떤 식으로 공부하나요?',
    description: '주말 루틴은 평일보다 조금 다르게 추천할 수 있어요.',
    helperText: commonHelperText,
    type: 'single',
    options: [
      { id: 'weekend-long-morning', label: '오전부터 길게 공부해요', patch: { weekendAvailability: ['weekend-morning', 'weekend-afternoon'] } },
      { id: 'weekend-afternoon', label: '오후부터 시작하는 편이에요', patch: { weekendAvailability: ['weekend-afternoon'] } },
      { id: 'weekend-split', label: '짧게 여러 번 나눠 해요', patch: { weekendAvailability: ['weekend-morning', 'weekend-evening'] } },
      { id: 'weekend-one-push', label: '몰아서 한 번에 해요', patch: { weekendAvailability: ['weekend-afternoon', 'weekend-evening'] } },
      { id: 'weekend-variable', label: '주말도 아직 일정이 들쑥날쑥해요', patch: { weekendAvailability: ['weekend-morning', 'weekend-afternoon', 'weekend-evening'] } },
    ],
  },
  {
    id: 'weak_subjects',
    title: '요즘 가장 부담되는 과목을 골라주세요',
    description: '최대 2개까지 선택할 수 있어요.',
    helperText: commonHelperText,
    type: 'multi',
    multiSelect: true,
    maxSelect: 2,
    fieldKey: 'difficultSubjects',
    options: [
      { id: 'kor', label: '국어', value: 'kor' },
      { id: 'math', label: '수학', value: 'math' },
      { id: 'eng', label: '영어', value: 'eng' },
      { id: 'history', label: '한국사', value: 'history' },
      { id: 'social', label: '사회탐구', value: 'social' },
      { id: 'science', label: '과학탐구', value: 'science' },
      { id: 'memory-all', label: '탐구/암기 과목 전반', value: 'memory-all' },
      { id: 'assignment', label: '수행/과제', value: 'assignment' },
      { id: 'none', label: '아직 특정 과목은 없어요', value: 'none', exclusive: true },
    ],
  },
  {
    id: 'bottleneck_type',
    title: '가장 자주 밀리는 공부는 어떤 쪽인가요?',
    description: '어디서 막히는지에 따라 루틴의 구조가 달라져요.',
    helperText: commonHelperText,
    type: 'single',
    options: [
      { id: 'concept', label: '개념 공부가 자꾸 밀려요', patch: { laggingStudyTypes: ['concept'] } },
      { id: 'problem-solving', label: '문제풀이가 부족해요', patch: { laggingStudyTypes: ['problem-solving'] } },
      { id: 'memorization', label: '암기 과목을 자꾸 미뤄요', patch: { laggingStudyTypes: ['memorization'] } },
      { id: 'review', label: '복습을 거의 못 해요', patch: { laggingStudyTypes: ['review'] } },
      { id: 'wrong-answer', label: '오답 정리가 잘 안 돼요', patch: { laggingStudyTypes: ['review', 'problem-solving'] } },
      { id: 'assignment', label: '수행/과제가 쌓여요', patch: { laggingStudyTypes: ['assignment'] } },
    ],
  },
  {
    id: 'plan_break_reason',
    title: '하루 계획이 무너지는 가장 큰 이유는 뭐예요?',
    description: '실패를 줄이는 루틴으로 추천해드릴게요.',
    helperText: commonHelperText,
    type: 'single',
    options: [
      { id: 'slow-start', label: '시작이 너무 늦어져요', patch: { derailReason: 'slow-start' } },
      { id: 'phone', label: '폰이나 딴짓에 자주 끊겨요', patch: { derailReason: 'phone' } },
      { id: 'too-hard', label: '너무 빡세게 짜서 못 지켜요', patch: { derailReason: 'too-hard' } },
      { id: 'unclear-priority', label: '뭘 먼저 해야 할지 헷갈려요', patch: { derailReason: 'unclear-priority' } },
      { id: 'subject-switch', label: '과목 바꾸는 게 어려워요', patch: { derailReason: 'subject-switch' } },
      { id: 'fatigue', label: '저녁 되면 너무 지쳐요', patch: { derailReason: 'fatigue' } },
      { id: 'execution-gap', label: '계획은 세우는데 실천이 안 돼요', patch: { derailReason: 'execution-gap' } },
    ],
  },
  {
    id: 'session_length',
    title: '한 번 집중할 때, 어느 정도가 가장 잘 맞나요?',
    description: '공부 블록 길이와 쉬는 템포를 추천하는 데 사용돼요.',
    helperText: commonHelperText,
    type: 'single',
    options: [
      { id: '25-30', label: '25~30분이 좋아요', patch: { preferredSessionLength: '25-30' } },
      { id: '45-50', label: '45~50분이 가장 잘 맞아요', patch: { preferredSessionLength: '45-50' } },
      { id: '70-80', label: '70~80분까지 몰입 가능해요', patch: { preferredSessionLength: '70-80' } },
      { id: 'flexible', label: '상황 따라 유동적으로 하고 싶어요', patch: { preferredSessionLength: 'flexible' } },
    ],
  },
  {
    id: 'break_style',
    title: '쉬는 방식은 어떤 게 잘 맞나요?',
    description: '휴식 방식도 루틴 유지에 중요해요.',
    helperText: commonHelperText,
    type: 'single',
    options: [
      { id: 'short-often', label: '짧게 자주 쉬는 편이 좋아요', patch: { preferredBreakStyle: 'short-often' } },
      { id: 'one-long', label: '길게 한 번 쉬는 게 좋아요', patch: { preferredBreakStyle: 'one-long' } },
      { id: 'subject-switch', label: '과목을 바꾸는 게 쉬는 느낌이에요', patch: { preferredBreakStyle: 'subject-switch' } },
      { id: 'fixed', label: '쉬는 시간도 정해져 있어야 해요', patch: { preferredBreakStyle: 'fixed' } },
      { id: 'unsure', label: '아직 잘 모르겠어요', patch: { preferredBreakStyle: 'unsure' } },
    ],
  },
  {
    id: 'planning_style',
    title: '어떤 계획 방식이 가장 편한가요?',
    description: '루틴 화면의 구조와 추천 방식에 반영돼요.',
    helperText: commonHelperText,
    type: 'single',
    options: [
      { id: 'time-table', label: '시간표처럼 딱딱 정해진 게 좋아요', patch: { preferredPlanStyle: 'time-table' } },
      { id: 'block', label: '큰 블록만 정해두는 게 좋아요', patch: { preferredPlanStyle: 'block' } },
      { id: 'todo', label: '할 일 중심으로 보는 게 편해요', patch: { preferredPlanStyle: 'todo' } },
      { id: 'guided', label: '추천받고 조금 수정하는 게 좋아요', patch: { preferredPlanStyle: 'guided' } },
      { id: 'searching', label: '아직 나한테 맞는 방식을 찾는 중이에요', patch: { preferredPlanStyle: 'searching' } },
    ],
  },
  {
    id: 'support_style',
    title: '루틴을 지킬 때 어떤 도움이 있으면 좋겠나요?',
    description: '알림, 체크, 함께하기 방식에 반영돼요.',
    helperText: commonHelperText,
    type: 'single',
    options: [
      { id: 'solo', label: '혼자 조용히 하는 게 좋아요', patch: { supportMode: 'solo' } },
      { id: 'remind', label: '알림이나 리마인드가 있으면 좋아요', patch: { supportMode: 'remind' } },
      { id: 'peers', label: '친구/스터디처럼 함께하면 좋아요', patch: { supportMode: 'peers' } },
      { id: 'teacher', label: '선생님이나 관리자 체크가 있으면 좋아요', patch: { supportMode: 'teacher' } },
      { id: 'adaptive', label: '상황에 따라 다르게 쓰고 싶어요', patch: { supportMode: 'adaptive' } },
    ],
  },
  {
    id: 'focus_peak',
    title: '집중이 가장 잘 되는 시간대는 언제인가요?',
    description: '중요 과목을 언제 배치할지 정할 때 사용돼요.',
    helperText: commonHelperText,
    type: 'single',
    options: [
      { id: 'morning', label: '아침이 제일 잘 돼요', patch: { bestFocusTime: 'morning' } },
      { id: 'afternoon', label: '오후가 괜찮아요', patch: { bestFocusTime: 'afternoon' } },
      { id: 'evening', label: '저녁이 가장 집중돼요', patch: { bestFocusTime: 'evening' } },
      { id: 'late-night', label: '밤 늦게 몰입돼요', patch: { bestFocusTime: 'late-night' } },
      { id: 'variable', label: '일정하지 않아요', patch: { bestFocusTime: 'variable' } },
    ],
  },
  {
    id: 'sharing_reflection',
    title: '계획 공유와 회고는 어떻게 하고 싶나요?',
    description: '공유 범위와 회고 방식을 함께 정해볼게요.',
    helperText: commonHelperText,
    type: 'dual',
    subQuestions: [
      {
        id: 'sharing',
        title: '내 계획은 어떻게 보고 싶나요?',
        type: 'single',
        options: [
          { id: 'private', label: '나만 보고 싶어요', patch: { sharingPreference: 'private' } },
          { id: 'friends', label: '친구까지만 공유 가능하면 좋아요', patch: { sharingPreference: 'friends' } },
          { id: 'anonymous', label: '비슷한 학생에게 익명으로 공유할 수 있어요', patch: { sharingPreference: 'anonymous' } },
          { id: 'sharing-unsure', label: '아직은 잘 모르겠어요', patch: { sharingPreference: 'private' } },
        ],
      },
      {
        id: 'reflection',
        title: '하루를 돌아보는 방식은 뭐가 편한가요?',
        type: 'single',
        options: [
          { id: 'daily-brief', label: '매일 짧게 체크하고 싶어요', patch: { reflectionStyle: 'daily-brief' } },
          { id: 'weekly-deep', label: '주 1회 정리하는 게 좋아요', patch: { reflectionStyle: 'weekly-deep' } },
          { id: 'auto-summary', label: '자동 요약만 봐도 괜찮아요', patch: { reflectionStyle: 'auto-summary' } },
          { id: 'not-yet', label: '회고는 아직 부담돼요', patch: { reflectionStyle: 'not-yet' } },
        ],
      },
    ],
  },
];

export function isQuestionAnswered(question: OnboardingQuestionConfig, answers: OnboardingAnswer) {
  if (question.type === 'multi') {
    return answers[question.fieldKey].length > 0;
  }
  if (question.type === 'dual') {
    return question.subQuestions.every((subQuestion) =>
      subQuestion.options.some((option) => isOptionSelected(answers, option))
    );
  }
  return question.options.some((option) => isOptionSelected(answers, option));
}

export function isOptionSelected(answers: OnboardingAnswer, option: OnboardingQuestionOption) {
  if (option.value) {
    if (option.value === 'none') {
      return answers.difficultSubjects.includes('none');
    }
    return answers.difficultSubjects.includes(option.value);
  }

  if (!option.patch) return false;

  return Object.entries(option.patch).every(([key, patchValue]) => {
    const answerValue = answers[key as keyof OnboardingAnswer];
    if (Array.isArray(patchValue) && Array.isArray(answerValue)) {
      return patchValue.length === answerValue.length && patchValue.every((item, index) => answerValue[index] === item);
    }
    return answerValue === patchValue;
  });
}

export function applySingleOptionPatch(
  answers: OnboardingAnswer,
  option: OnboardingQuestionOption
) {
  if (!option.patch) return answers;
  return {
    ...answers,
    ...option.patch,
  };
}

export function toggleMultiQuestionValue(
  answers: OnboardingAnswer,
  question: Extract<OnboardingQuestionConfig, { type: 'multi' }>,
  option: OnboardingQuestionOption
) {
  const nextValues = [...answers[question.fieldKey]];
  const optionValue = option.value;
  if (!optionValue) return answers;

  if (optionValue === 'none') {
    return {
      ...answers,
      [question.fieldKey]: nextValues.includes('none') ? [] : ['none'],
    };
  }

  const withoutNone = nextValues.filter((value) => value !== 'none');
  const exists = withoutNone.includes(optionValue);
  const updated = exists ? withoutNone.filter((value) => value !== optionValue) : [...withoutNone, optionValue];

  return {
    ...answers,
    [question.fieldKey]: updated.slice(0, question.maxSelect),
  };
}

export function getSelectedLabels(question: Extract<OnboardingQuestionConfig, { type: 'multi' }>, answers: OnboardingAnswer) {
  const values = answers[question.fieldKey];
  return question.options
    .filter((option) => option.value && values.includes(option.value))
    .map((option) => option.label);
}
