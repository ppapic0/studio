import type {
  PlannerBurnoutReason,
  PlannerLearnerGrade,
  PlannerLikert,
  PlannerMainGoal,
  PlannerStudyActivity,
  PlannerStudyHoursBand,
  PlannerSubject,
  StudyPlannerAnswers,
} from '@/lib/types';

export type PlannerQuestionBlock = 'A' | 'B' | 'C' | 'D';

export type PlannerQuestionOption<T extends string = string> = {
  value: T;
  label: string;
  helper?: string;
};

export type PlannerQuestionConfig =
  | {
      id: keyof Pick<
        StudyPlannerAnswers,
        | 'grade'
        | 'goal'
        | 'examWindow'
        | 'averageStudyHours'
        | 'planningScore'
        | 'reflectionScore'
        | 'unknownHandling'
        | 'lowEfficiencySubject'
        | 'motivationType'
        | 'lastSuccessRecency'
      >;
      block: PlannerQuestionBlock;
      title: string;
      description: string;
      type: 'single-select' | 'radio';
      options: PlannerQuestionOption[];
      multiSelect?: false;
      required: boolean;
      theoryTags: string[];
      rationale: string;
      scoringKey: string;
    }
  | {
      id: keyof Pick<StudyPlannerAnswers, 'topTimeSubjects' | 'studyActivities' | 'burnoutReasons'>;
      block: PlannerQuestionBlock;
      title: string;
      description: string;
      type: 'multi-select';
      options: PlannerQuestionOption[];
      multiSelect: true;
      maxSelect?: number;
      required: boolean;
      theoryTags: string[];
      rationale: string;
      scoringKey: string;
    }
  | {
      id: 'subjectGrades';
      block: PlannerQuestionBlock;
      title: string;
      description: string;
      type: 'subject-grades';
      options: PlannerQuestionOption[];
      required: boolean;
      theoryTags: string[];
      rationale: string;
      scoringKey: string;
    };

export const PLANNER_BLOCK_TITLES: Record<PlannerQuestionBlock, string> = {
  A: '기본 정보',
  B: '학습 패턴',
  C: '과목 투자·효율',
  D: '동기·번아웃',
};

const gradeOptions: PlannerQuestionOption<PlannerLearnerGrade>[] = [
  { value: 'middle-1', label: '중1' },
  { value: 'middle-2', label: '중2' },
  { value: 'middle-3', label: '중3' },
  { value: 'high-1', label: '고1' },
  { value: 'high-2', label: '고2' },
  { value: 'high-3', label: '고3' },
  { value: 'n-susi', label: 'N수생' } as PlannerQuestionOption<any>,
  { value: 'gongsi', label: '공시생' } as PlannerQuestionOption<any>,
];

const likertOptions: PlannerQuestionOption<`${PlannerLikert}`>[] = [
  { value: '1', label: '전혀 안 한다' },
  { value: '2', label: '거의 안 한다' },
  { value: '3', label: '가끔 한다' },
  { value: '4', label: '자주 한다' },
  { value: '5', label: '거의 항상 한다' },
];

const subjectOptions: PlannerQuestionOption<PlannerSubject>[] = [
  { value: '국어', label: '국어' },
  { value: '수학', label: '수학' },
  { value: '영어', label: '영어' },
  { value: '탐구', label: '탐구' },
  { value: '한국사', label: '한국사' },
  { value: '전공', label: '전공/직렬 과목' },
  { value: '행정법/행정학', label: '행정법/행정학 계열' },
];

export const PLANNER_SUBJECT_GRADE_FIELDS: Array<{ key: keyof StudyPlannerAnswers['subjectGrades']; label: string }> = [
  { key: '국어', label: '국어' },
  { key: '수학', label: '수학' },
  { key: '영어', label: '영어' },
  { key: '탐구', label: '탐구' },
];

export const PLANNER_GRADE_OPTIONS = Array.from({ length: 9 }, (_, index) => `${index + 1}등급`);

export const PLANNER_QUESTIONS: PlannerQuestionConfig[] = [
  {
    id: 'grade',
    block: 'A',
    title: '지금 가장 가까운 학습 단계는 무엇인가요?',
    description: '학습 맥락에 따라 계획의 밀도와 구조가 달라져요.',
    type: 'single-select',
    options: gradeOptions,
    required: true,
    theoryTags: ['context', 'goal-setting'],
    rationale: '학습 맥락과 목표 유형에 따라 계획 구조와 난이도가 달라진다.',
    scoringKey: 'context',
  },
  {
    id: 'goal',
    block: 'A',
    title: '주요 목표는 무엇인가요?',
    description: '시간 배분과 우선순위를 정할 때 기준이 돼요.',
    type: 'radio',
    options: [
      { value: 'csat' as PlannerMainGoal, label: '수능' },
      { value: 'school' as PlannerMainGoal, label: '내신' },
      { value: 'both' as PlannerMainGoal, label: '둘 다' },
      { value: 'gongsi' as PlannerMainGoal, label: '공시' } as PlannerQuestionOption<any>,
      { value: 'etc' as PlannerMainGoal, label: '기타 시험' } as PlannerQuestionOption<any>,
    ],
    required: true,
    theoryTags: ['Zimmerman:forethought', 'MSLQ:goal orientation'],
    rationale: '목표 지향은 시간 배분과 계획 전략의 출발점이다.',
    scoringKey: 'goal',
  },
  {
    id: 'examWindow',
    block: 'A',
    title: '시험까지 남은 기간은 어느 정도인가요?',
    description: '가까운 평가일수록 계획 단위와 압축도가 달라져요.',
    type: 'single-select',
    options: [
      { value: 'under-1-month', label: '1개월 이내' },
      { value: 'one-to-three-months', label: '1~3개월' },
      { value: 'over-three-months', label: '3개월 이상' },
    ],
    required: true,
    theoryTags: ['time perspective', 'planning horizon'],
    rationale: '가까운 평가일수록 계획 단위와 압축도가 달라진다.',
    scoringKey: 'time-horizon',
  },
  {
    id: 'averageStudyHours',
    block: 'B',
    title: '하루 평균 공부 시간은 어느 정도인가요?',
    description: '학습 총량과 자원 관리 패턴을 함께 봐요.',
    type: 'single-select',
    options: [
      { value: 'under-2' as PlannerStudyHoursBand, label: '2시간 이하' },
      { value: '2-4' as PlannerStudyHoursBand, label: '2~4시간' },
      { value: '4-6' as PlannerStudyHoursBand, label: '4~6시간' },
      { value: '6-plus' as PlannerStudyHoursBand, label: '6시간 이상' },
    ],
    required: true,
    theoryTags: ['resource management', 'time management'],
    rationale: '시간 자원 배분은 자기조절학습과 실제 실행 가능성을 가르는 핵심 변수다.',
    scoringKey: 'study-hours',
  },
  {
    id: 'planningScore',
    block: 'B',
    title: '공부를 시작하기 전에 계획을 세우는 편인가요?',
    description: '짧아도 괜찮아요. 시작 전 계획 습관을 보고 있어요.',
    type: 'single-select',
    options: likertOptions,
    required: true,
    theoryTags: ['Zimmerman:forethought', 'MSLQ:self-regulation planning'],
    rationale: '계획 수립은 자기조절학습의 forethought 단계 핵심 요소다.',
    scoringKey: 'planning',
  },
  {
    id: 'reflectionScore',
    block: 'B',
    title: '공부가 끝난 뒤 오늘 한 걸 돌아보는 편인가요?',
    description: '짧은 점검이라도 있는지 확인해볼게요.',
    type: 'single-select',
    options: likertOptions,
    required: true,
    theoryTags: ['Zimmerman:self-reflection', 'MAI:evaluation'],
    rationale: '성찰과 자기평가는 다음 계획의 품질을 높이는 핵심 루프다.',
    scoringKey: 'reflection',
  },
  {
    id: 'unknownHandling',
    block: 'B',
    title: '모르는 부분이 나오면 보통 어떻게 하나요?',
    description: '막힐 때 전략을 바꾸는 패턴을 보기 위한 질문이에요.',
    type: 'radio',
    options: [
      { value: '바로 찾아봄', label: '바로 찾아봄' },
      { value: '표시 후 나중에', label: '표시 후 나중에' },
      { value: '그냥 넘김', label: '그냥 넘김' },
    ],
    required: true,
    theoryTags: ['MAI:monitoring', 'help-seeking', 'metacognitive regulation'],
    rationale: '막힐 때 전략을 전환하거나 도움을 구하는 능력은 메타인지 조절의 일부다.',
    scoringKey: 'unknown-handling',
  },
  {
    id: 'subjectGrades',
    block: 'C',
    title: '과목별 현재 성적대를 입력해볼까요?',
    description: '선택사항이에요. 비워둬도 괜찮아요.',
    type: 'subject-grades',
    options: [],
    required: false,
    theoryTags: ['performance baseline', 'subject diagnostic'],
    rationale: '현재 성취 수준이 있으면 과목 간 편차와 보정이 더 정교해진다.',
    scoringKey: 'subject-grade-baseline',
  },
  {
    id: 'topTimeSubjects',
    block: 'C',
    title: '가장 많은 시간을 쓰는 과목 TOP 3는 무엇인가요?',
    description: '최대 3개까지 선택해 주세요.',
    type: 'multi-select',
    options: [
      { value: '국어', label: '국어' },
      { value: '수학', label: '수학' },
      { value: '영어', label: '영어' },
      { value: '탐구', label: '탐구' },
      { value: '기타', label: '기타' } as PlannerQuestionOption<any>,
    ],
    multiSelect: true,
    maxSelect: 3,
    required: true,
    theoryTags: ['resource allocation', 'time distribution'],
    rationale: '어떤 과목에 자원이 몰리는지 파악해야 효율 불일치를 해석할 수 있다.',
    scoringKey: 'time-heavy-subjects',
  },
  {
    id: 'studyActivities',
    block: 'C',
    title: '주로 하는 학습 활동은 무엇인가요?',
    description: '여러 개 골라도 괜찮아요.',
    type: 'multi-select',
    options: [
      { value: '개념이해' as PlannerStudyActivity, label: '개념이해' },
      { value: '문제풀이' as PlannerStudyActivity, label: '문제풀이' },
      { value: '암기' as PlannerStudyActivity, label: '암기' },
      { value: '오답정리' as PlannerStudyActivity, label: '오답정리' },
      { value: '백지회상' as PlannerStudyActivity, label: '백지회상' } as PlannerQuestionOption<any>,
      { value: '설명해보기' as PlannerStudyActivity, label: '설명해보기' } as PlannerQuestionOption<any>,
    ],
    multiSelect: true,
    required: true,
    theoryTags: ['Bloom:activity type', 'retrieval practice', 'strategy diversity'],
    rationale: '읽기/반복만이 아니라 회상과 설명 활동이 섞이는지 보는 것이 활동 다양성 판단에 중요하다.',
    scoringKey: 'activity-diversity',
  },
  {
    id: 'lowEfficiencySubject',
    block: 'C',
    title: '시간 대비 가장 안 느는 과목은 무엇인가요?',
    description: '효율이 떨어지는 과목이 있다면 함께 조정할게요.',
    type: 'single-select',
    options: [
      { value: '국어', label: '국어' },
      { value: '수학', label: '수학' },
      { value: '영어', label: '영어' },
      { value: '탐구', label: '탐구' },
      { value: '기타', label: '기타' } as PlannerQuestionOption<any>,
    ],
    required: true,
    theoryTags: ['efficiency diagnostic', 'cognitive load mismatch'],
    rationale: '시간이 많이 들어가는데 효율이 낮으면 활동 방식과 과제 난도의 불일치를 의심할 수 있다.',
    scoringKey: 'efficiency-mismatch',
  },
  {
    id: 'burnoutReasons',
    block: 'D',
    title: '요즘 공부하기 싫은 이유가 있나요?',
    description: '해당되는 걸 모두 골라주세요.',
    type: 'multi-select',
    options: [
      { value: '너무 어려워서' as PlannerBurnoutReason, label: '너무 어려워서' },
      { value: '왜 해야 하는지 모르겠어서' as PlannerBurnoutReason, label: '왜 해야 하는지 모르겠어서' },
      { value: '그냥 지쳐서' as PlannerBurnoutReason, label: '그냥 지쳐서' },
      { value: '특별히 없음' as PlannerBurnoutReason, label: '특별히 없음' },
    ],
    multiSelect: true,
    required: true,
    theoryTags: ['Dweck:helpless pattern', 'amotivation', 'burnout risk'],
    rationale: '회피·무기력 신호는 단순 의지 부족이 아니라 코칭 방식과 계획 강도 조정의 기준이 된다.',
    scoringKey: 'burnout-signals',
  },
  {
    id: 'motivationType',
    block: 'D',
    title: '공부하는 주된 이유는 무엇에 더 가깝나요?',
    description: '요즘 마음에 가장 가까운 걸 골라주세요.',
    type: 'radio',
    options: [
      { value: '더 잘하고 싶어서', label: '더 잘하고 싶어서' },
      { value: '못하면 안 될 것 같아서', label: '못하면 안 될 것 같아서' },
      { value: '모르겠음', label: '모르겠음' },
    ],
    required: true,
    theoryTags: ['mastery orientation', 'performance-avoidance'],
    rationale: '숙달 지향과 회피 지향은 같은 공부량이라도 번아웃 위험과 유지력에 차이를 만든다.',
    scoringKey: 'motivation',
  },
  {
    id: 'lastSuccessRecency',
    block: 'D',
    title: '마지막으로 “잘했다” 느낀 시점은 언제인가요?',
    description: '최근의 성공 기억은 자기효능감과 연결돼요.',
    type: 'single-select',
    options: [
      { value: '최근 1주', label: '최근 1주' },
      { value: '1개월 내', label: '1개월 내' },
      { value: '기억 안 남', label: '기억 안 남' },
    ],
    required: true,
    theoryTags: ['self-efficacy', 'competence memory'],
    rationale: '최근의 성공 기억은 다음 시도에 대한 기대감과 회복탄력성에 영향을 준다.',
    scoringKey: 'competence-memory',
  },
];

export const PLANNER_TOTAL_QUESTION_COUNT = PLANNER_QUESTIONS.length;
