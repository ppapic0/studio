import { type OnboardingAnswer, type QuestionSection } from '@/lib/types';
import { syncStudyPlanAnswerCompatibility } from '@/lib/recommend-routine';

type OptionPatch = Partial<OnboardingAnswer>;

export type OnboardingQuestionOption = {
  id: string;
  label: string;
  patch?: OptionPatch;
  value?: string;
  exclusive?: boolean;
};

export type OnboardingQuestionConfig =
  | {
      id: string;
      section: QuestionSection;
      title: string;
      description: string;
      helperText?: string;
      type: 'single';
      options: OnboardingQuestionOption[];
    }
  | {
      id: string;
      section: QuestionSection;
      title: string;
      description: string;
      helperText?: string;
      type: 'multi';
      options: OnboardingQuestionOption[];
      maxSelect: number;
      fieldKey: 'subjectPriority' | 'weakSubjects';
    };

const commonHelperText = '정답은 없어요. 지금 나와 가장 가까운 걸 골라주세요.';

export const ONBOARDING_QUESTIONS: OnboardingQuestionConfig[] = [
  {
    id: 'learner_type',
    section: '목표 파악',
    title: '지금 가장 가까운 학습 유형은 무엇인가요?',
    description: '목표에 따라 계획의 구조가 달라져요.',
    helperText: commonHelperText,
    type: 'single',
    options: [
      { id: 'middle-school-core', label: '중학생 · 학교 공부 중심', patch: { learnerType: 'middle_school_core' } },
      { id: 'high-school-internal', label: '고등학생 · 내신 중심', patch: { learnerType: 'high_school_internal' } },
      { id: 'high3-csat', label: '고3 · 수능 중심', patch: { learnerType: 'high3_csat' } },
      { id: 'n-susi', label: 'N수생 · 수능 집중', patch: { learnerType: 'n_susi' } },
      { id: 'gongsi', label: '공시생 · 시험 준비 중심', patch: { learnerType: 'gongsi' } },
      { id: 'goal-searching', label: '아직 뚜렷한 목표를 정리하는 중이에요', patch: { learnerType: 'goal_searching' } },
    ],
  },
  {
    id: 'daily_study_hours',
    section: '공부시간 파악',
    title: '하루 공부 목표 시간은 어느 정도인가요?',
    description: '총 공부시간에 따라 과목별 배분이 달라져요.',
    helperText: commonHelperText,
    type: 'single',
    options: [
      { id: '4h', label: '4시간 내외', patch: { dailyStudyHours: '4h' } },
      { id: '6h', label: '6시간 내외', patch: { dailyStudyHours: '6h' } },
      { id: '8h', label: '8시간 내외', patch: { dailyStudyHours: '8h' } },
      { id: '10h', label: '10시간 내외', patch: { dailyStudyHours: '10h' } },
      { id: '12h-plus', label: '12시간 이상', patch: { dailyStudyHours: '12h-plus' } },
    ],
  },
  {
    id: 'main_block_length',
    section: '공부시간 파악',
    title: '한 번 집중하면 보통 얼마나 길게 공부하나요?',
    description: '기본 공부 블록 길이를 정할 때 사용돼요.',
    helperText: commonHelperText,
    type: 'single',
    options: [
      { id: '90m', label: '1시간~1시간 30분', patch: { mainBlockLength: '90m' } },
      { id: '120m', label: '2시간 정도', patch: { mainBlockLength: '120m' } },
      { id: '150m', label: '2시간 30분 정도', patch: { mainBlockLength: '150m' } },
      { id: '180m', label: '3시간 정도', patch: { mainBlockLength: '180m' } },
      { id: 'long-flex', label: '날마다 다르지만 긴 편이에요', patch: { mainBlockLength: 'long-flex' } },
    ],
  },
  {
    id: 'break_preference',
    section: '공부시간 파악',
    title: '긴 공부 뒤 쉬는 시간은 어느 정도가 잘 맞나요?',
    description: '공부 블록 사이의 휴식 길이를 정할 때 사용돼요.',
    helperText: commonHelperText,
    type: 'single',
    options: [
      { id: '10-15', label: '10~15분', patch: { breakPreference: '10-15' } },
      { id: '20', label: '20분', patch: { breakPreference: '20' } },
      { id: '30', label: '30분', patch: { breakPreference: '30' } },
      { id: '40+', label: '40분 이상', patch: { breakPreference: '40+' } },
      { id: 'variable', label: '상황에 따라 달라요', patch: { breakPreference: 'variable' } },
    ],
  },
  {
    id: 'subject_priority',
    section: '과목 배분 파악',
    title: '지금 가장 비중 있게 잡아야 하는 과목은 무엇인가요?',
    description: '최대 2개까지 선택 가능해요.',
    helperText: commonHelperText,
    type: 'multi',
    maxSelect: 2,
    fieldKey: 'subjectPriority',
    options: [
      { id: 'kor', label: '국어', value: 'kor' },
      { id: 'math', label: '수학', value: 'math' },
      { id: 'eng', label: '영어', value: 'eng' },
      { id: 'history', label: '한국사', value: 'history' },
      { id: 'social', label: '사회탐구', value: 'social' },
      { id: 'science', label: '과학탐구', value: 'science' },
      { id: 'major', label: '전공/직렬 과목', value: 'major' },
      { id: 'admin-law', label: '행정법/행정학 계열', value: 'admin-law' },
      { id: 'etc', label: '기타 시험 과목', value: 'etc' },
    ],
  },
  {
    id: 'weak_subjects',
    section: '과목 배분 파악',
    title: '가장 부담되거나 자꾸 밀리는 과목은 무엇인가요?',
    description: '최대 2개까지 선택 가능해요.',
    helperText: commonHelperText,
    type: 'multi',
    maxSelect: 2,
    fieldKey: 'weakSubjects',
    options: [
      { id: 'kor', label: '국어', value: 'kor' },
      { id: 'math', label: '수학', value: 'math' },
      { id: 'eng', label: '영어', value: 'eng' },
      { id: 'history', label: '한국사', value: 'history' },
      { id: 'social', label: '사회탐구', value: 'social' },
      { id: 'science', label: '과학탐구', value: 'science' },
      { id: 'major', label: '전공/직렬 과목', value: 'major' },
      { id: 'admin-law', label: '행정법/행정학 계열', value: 'admin-law' },
      { id: 'etc', label: '기타 시험 과목', value: 'etc' },
      { id: 'none', label: '아직 특정 과목은 없어요', value: 'none', exclusive: true },
    ],
  },
  {
    id: 'focus_peak',
    section: '계획 방식 파악',
    title: '가장 깊게 집중되는 시간대는 언제인가요?',
    description: '핵심 과목을 언제 배치할지 정할 때 사용돼요.',
    helperText: commonHelperText,
    type: 'single',
    options: [
      { id: 'morning', label: '아침', patch: { focusPeak: 'morning' } },
      { id: 'late-morning', label: '오전~점심', patch: { focusPeak: 'late-morning' } },
      { id: 'afternoon', label: '오후', patch: { focusPeak: 'afternoon' } },
      { id: 'evening', label: '저녁', patch: { focusPeak: 'evening' } },
      { id: 'night', label: '밤', patch: { focusPeak: 'night' } },
      { id: 'variable', label: '일정하지 않아요', patch: { focusPeak: 'variable' } },
    ],
  },
  {
    id: 'plan_break_reason',
    section: '계획 방식 파악',
    title: '계획이 무너질 때 가장 큰 이유는 무엇인가요?',
    description: '현실적으로 지킬 수 있는 계획을 추천하기 위해 필요해요.',
    helperText: commonHelperText,
    type: 'single',
    options: [
      { id: 'too-much-volume', label: '총량을 너무 크게 잡아요', patch: { planBreakReason: 'too-much-volume' } },
      { id: 'subject-avoidance', label: '특정 과목이 부담돼서 미루게 돼요', patch: { planBreakReason: 'subject-avoidance' } },
      { id: 'late-start', label: '시작 시간이 늦어져요', patch: { planBreakReason: 'late-start' } },
      { id: 'concentration-drop', label: '오래 앉아도 집중이 흔들려요', patch: { planBreakReason: 'concentration-drop' } },
      { id: 'break-overrun', label: '쉬는 시간이 길어져요', patch: { planBreakReason: 'break-overrun' } },
      { id: 'subject-imbalance', label: '과목 배분이 늘 한쪽으로 쏠려요', patch: { planBreakReason: 'subject-imbalance' } },
      { id: 'finish-gap', label: '계획은 세우는데 끝까지 못 지켜요', patch: { planBreakReason: 'finish-gap' } },
    ],
  },
  {
    id: 'planning_style',
    section: '계획 방식 파악',
    title: '어떤 계획 방식이 가장 잘 맞나요?',
    description: '계획 화면 구조와 추천 방식을 정하는 데 사용돼요.',
    helperText: commonHelperText,
    type: 'single',
    options: [
      { id: 'time-table', label: '시간표처럼 딱 나뉜 계획', patch: { planningStyle: 'time-table' } },
      { id: 'subject-hours', label: '과목별 총 시간 중심 계획', patch: { planningStyle: 'subject-hours' } },
      { id: 'big-block', label: '큰 블록만 정해두는 계획', patch: { planningStyle: 'big-block' } },
      { id: 'guided', label: '추천받고 조금 수정하는 방식', patch: { planningStyle: 'guided' } },
      { id: 'unknown', label: '아직 잘 모르겠어요', patch: { planningStyle: 'unknown' } },
    ],
  },
  {
    id: 'reflection_style',
    section: '계획 방식 파악',
    title: '하루 마무리는 어떤 방식이 가장 편한가요?',
    description: '계획 후 회고 방식을 정하는 데 사용돼요.',
    helperText: commonHelperText,
    type: 'single',
    options: [
      { id: 'time-check', label: '오늘 한 시간만 간단히 확인', patch: { reflectionStyle: 'time-check' } },
      { id: 'subject-progress', label: '과목별 달성률을 보고 싶어요', patch: { reflectionStyle: 'subject-progress' } },
      { id: 'memo', label: '짧게 메모만 남기면 돼요', patch: { reflectionStyle: 'memo' } },
      { id: 'auto-summary', label: '자동 요약이 좋습니다', patch: { reflectionStyle: 'auto-summary' } },
      { id: 'not-ready', label: '아직 회고는 부담돼요', patch: { reflectionStyle: 'not-ready' } },
    ],
  },
];

export function applySingleOptionPatch(answers: OnboardingAnswer, option: OnboardingQuestionOption) {
  if (!option.patch) return answers;
  return syncStudyPlanAnswerCompatibility({
    ...answers,
    ...option.patch,
  });
}

export function toggleMultiQuestionValue(
  answers: OnboardingAnswer,
  question: Extract<OnboardingQuestionConfig, { type: 'multi' }>,
  option: OnboardingQuestionOption
) {
  const currentValues = answers[question.fieldKey];
  const optionValue = option.value;
  if (!optionValue) return answers;

  if (optionValue === 'none') {
    return syncStudyPlanAnswerCompatibility({
      ...answers,
      [question.fieldKey]: currentValues.includes('none') ? [] : ['none'],
    });
  }

  const withoutExclusive = currentValues.filter((value) => value !== 'none');
  const exists = withoutExclusive.includes(optionValue);
  const nextValues = exists
    ? withoutExclusive.filter((value) => value !== optionValue)
    : [...withoutExclusive, optionValue].slice(0, question.maxSelect);

  return syncStudyPlanAnswerCompatibility({
    ...answers,
    [question.fieldKey]: nextValues,
  });
}

export function getSelectedLabels(
  question: Extract<OnboardingQuestionConfig, { type: 'multi' }>,
  answers: OnboardingAnswer
) {
  const values = answers[question.fieldKey];
  return question.options
    .filter((option) => option.value && values.includes(option.value))
    .map((option) => option.label);
}
