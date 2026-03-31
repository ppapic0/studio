import {
  type OnboardingAnswer,
  type RecommendedRoutine,
  type ReviewRule,
  type RoutineArchetype,
  type RoutineDifficulty,
  type SharingPreference,
  type StudyAvailabilitySlot,
  type StudyBlock,
} from '@/lib/types';

type ChoiceOption<T extends string = string> = {
  value: T;
  label: string;
  description: string;
  badge?: string;
};

type RoutineCustomizationDraft = {
  startTime?: string;
  sessionLength?: 30 | 50 | 80;
  dailyLoad?: 'light' | 'standard' | 'heavy';
  prioritySubject?: string;
};

type SubjectOption = {
  id: string;
  label: string;
  shortLabel: string;
};

type StudyBlueprint = {
  id: string;
  kind: StudyBlock['kind'];
  title: string;
  subjectId?: string;
  subjectLabel?: string;
  durationMinutes: number;
  instruction: string;
  fallbackInstruction?: string;
};

type AvailabilityMeta = {
  label: string;
  description: string;
  startTime: string;
  durationMinutes: number;
};

type ArchetypeScore = {
  archetype: RoutineArchetype;
  score: number;
};

type RoutineDefinition = {
  oneLineDescription: string;
  difficulty: RoutineDifficulty;
  fitStudent: (context: BuildContext) => string;
  coreStrategies: (context: BuildContext) => string[];
  subjectPlacement: (context: BuildContext) => string;
  buildStudyBlueprints: (context: BuildContext) => StudyBlueprint[];
  weekendExtension: (context: BuildContext) => string;
};

type BuildContext = {
  answers: OnboardingAnswer;
  mainSubject: SubjectOption;
  secondarySubject: SubjectOption;
  supportSubject: SubjectOption;
  sessionMinutes: number;
  breakMinutes: number;
  startTime: string;
  weekdayWindowLabel: string;
  weekdayWindowDuration: number;
  weekendWindowLabel: string;
  weekendWindowDuration: number;
  dailyLoad: 'light' | 'standard' | 'heavy';
};

export type { ChoiceOption, RoutineCustomizationDraft };

export const SUBJECT_OPTIONS: SubjectOption[] = [
  { id: 'kor', label: '국어', shortLabel: '국어' },
  { id: 'math', label: '수학', shortLabel: '수학' },
  { id: 'eng', label: '영어', shortLabel: '영어' },
  { id: 'social', label: '사탐', shortLabel: '사탐' },
  { id: 'science', label: '과탐', shortLabel: '과탐' },
  { id: 'history', label: '한국사', shortLabel: '한국사' },
  { id: 'memory-all', label: '탐구/암기 과목', shortLabel: '암기' },
  { id: 'assignment', label: '수행/과제', shortLabel: '과제' },
  { id: 'none', label: '특정 과목 없음', shortLabel: '없음' },
  { id: 'etc', label: '기타', shortLabel: '기타' },
];

export const GRADE_BAND_OPTIONS: ChoiceOption<OnboardingAnswer['gradeBand']>[] = [
  { value: 'middle', label: '중학생', description: '기초 습관과 과목 균형을 같이 잡고 싶어요.' },
  { value: 'high', label: '고등학생', description: '학교와 시험 흐름을 동시에 관리해야 해요.' },
  { value: 'repeat', label: 'N수생', description: '집중 시간과 회복 루틴이 특히 중요해요.' },
];

export const EXAM_GOAL_OPTIONS: ChoiceOption<OnboardingAnswer['examGoal']>[] = [
  { value: 'school-rank', label: '내신 안정', description: '학교 진도와 수행을 놓치지 않는 쪽이 우선이에요.' },
  { value: 'mock-improvement', label: '모의고사 상승', description: '실전 감각과 문제풀이 페이스를 끌어올리고 싶어요.' },
  { value: 'college-sprint', label: '수능/N수 집중', description: '핵심 과목에 오래 몰입하는 흐름이 필요해요.' },
  { value: 'balance-recovery', label: '과목 균형 회복', description: '한 과목만 파다 보면 다른 과목이 밀려요.' },
  { value: 'habit-reset', label: '공부 습관 리셋', description: '무너지지 않는 시작 루틴이 먼저 필요해요.' },
  { value: 'specific-test', label: '특정 시험/평가 준비', description: '짧은 기간 안에 필요한 범위를 빠르게 정리하고 싶어요.' },
  { value: 'undecided', label: '목표 탐색 중', description: '아직 뚜렷한 목표보다 꾸준한 루틴이 먼저 필요해요.' },
];

export const WEEKDAY_AVAILABILITY_OPTIONS: ChoiceOption<StudyAvailabilitySlot>[] = [
  { value: 'weekday-morning', label: '등교 전 06:30~07:30', description: '아침 1블록 정도는 낼 수 있어요.' },
  { value: 'weekday-after-school', label: '방과 후 16:30~18:30', description: '학교 끝나고 바로 공부하기 좋아요.' },
  { value: 'weekday-evening', label: '저녁 19:30~22:30', description: '가장 긴 몰입 시간을 만들 수 있어요.' },
  { value: 'weekday-night', label: '늦은 밤 22:00~23:30', description: '짧은 마무리 블록만 가능해요.' },
];

export const WEEKEND_AVAILABILITY_OPTIONS: ChoiceOption<StudyAvailabilitySlot>[] = [
  { value: 'weekend-morning', label: '오전 09:00~12:00', description: '주말은 아침부터 비교적 길게 가능해요.' },
  { value: 'weekend-afternoon', label: '오후 13:00~17:00', description: '주말 메인 학습 블록을 넣기 좋아요.' },
  { value: 'weekend-evening', label: '저녁 19:00~22:00', description: '주중 밀린 복습을 정리하기 좋아요.' },
];

export const DIFFICULT_SUBJECT_OPTIONS: ChoiceOption<string>[] = SUBJECT_OPTIONS.map((subject) => ({
  value: subject.id,
  label: subject.label,
  description: `${subject.label}이 자주 밀리거나 손이 잘 안 가요.`,
}));

export const LAGGING_STUDY_TYPE_OPTIONS: ChoiceOption<OnboardingAnswer['laggingStudyTypes'][number]>[] = [
  { value: 'concept', label: '개념', description: '이해가 약해서 뒤가 흔들려요.' },
  { value: 'problem-solving', label: '문제풀이', description: '알고도 적용이 잘 안 돼요.' },
  { value: 'memorization', label: '암기', description: '외워도 금방 흐려져요.' },
  { value: 'review', label: '복습', description: '한 번 한 걸 다시 보는 게 잘 안 돼요.' },
  { value: 'assignment', label: '수행/과제', description: '학교 일정이 끼면 루틴이 흔들려요.' },
];

export const DERAIL_REASON_OPTIONS: ChoiceOption<OnboardingAnswer['derailReason']>[] = [
  { value: 'slow-start', label: '시작이 느림', description: '앉아도 스타트가 늦어져요.' },
  { value: 'phone', label: '중간에 폰 봄', description: '세션이 자꾸 끊겨요.' },
  { value: 'too-hard', label: '너무 빡세게 짜서 실패', description: '첫날부터 과하게 잡아요.' },
  { value: 'subject-switch', label: '과목 전환이 어려움', description: '한 과목 하다 보면 다음 블록이 꼬여요.' },
  { value: 'fatigue', label: '피곤해서 밤에 무너짐', description: '저녁만 되면 난도가 확 떨어져요.' },
  { value: 'unclear-priority', label: '무엇부터 할지 모름', description: '우선순위가 안 잡혀서 멈춰요.' },
];

export const SESSION_LENGTH_OPTIONS: ChoiceOption<OnboardingAnswer['preferredSessionLength']>[] = [
  { value: '25-30', label: '25~30분', description: '짧게 시작하고 자주 끊는 편이 편해요.' },
  { value: '45-50', label: '45~50분', description: '가장 무난하게 유지되는 길이예요.' },
  { value: '70-80', label: '70~80분', description: '한 번 잡으면 길게 몰입하는 편이에요.' },
  { value: 'flexible', label: '상황 따라 유동적', description: '그날 컨디션에 맞게 길이를 바꾸고 싶어요.' },
];

export const BREAK_STYLE_OPTIONS: ChoiceOption<OnboardingAnswer['preferredBreakStyle']>[] = [
  { value: 'short-often', label: '짧고 자주', description: '5~10분씩 빠르게 쉬는 편이 맞아요.' },
  { value: 'one-long', label: '길게 한 번', description: '중간에 한 번 크게 쉬는 게 좋아요.' },
  { value: 'subject-switch', label: '과목 바꿔가며', description: '쉬는 대신 과목 전환으로 리듬을 바꿔요.' },
  { value: 'fixed', label: '쉬는 시간도 정해져야 해요', description: '쉬는 리듬이 정해져 있어야 마음이 편해요.' },
  { value: 'unsure', label: '아직 잘 모르겠어요', description: '지금은 추천 템포를 먼저 받아보고 싶어요.' },
];

export const PLAN_STYLE_OPTIONS: ChoiceOption<OnboardingAnswer['preferredPlanStyle']>[] = [
  { value: 'time-table', label: '촘촘한 시간표형', description: '몇 시에 무엇을 할지 정해져야 편해요.' },
  { value: 'block', label: '블록형', description: '큰 블록 몇 개만 잡혀 있어도 충분해요.' },
  { value: 'todo', label: '할 일 중심형', description: '시간보다 해야 할 일이 먼저예요.' },
  { value: 'guided', label: '추천받고 수정하는 형', description: '추천을 시작점으로 조금 고치고 싶어요.' },
  { value: 'searching', label: '아직 찾는 중', description: '지금은 나한테 맞는 방식을 탐색하는 단계예요.' },
];

export const SUPPORT_MODE_OPTIONS: ChoiceOption<OnboardingAnswer['supportMode']>[] = [
  { value: 'solo', label: '혼자 조용히', description: '간섭 없이 스스로 진행하는 편이 좋아요.' },
  { value: 'remind', label: '리마인드 알림', description: '시작/마감 신호가 있으면 좋아요.' },
  { value: 'peers', label: '친구/스터디룸과 함께', description: '같이 하는 분위기가 동기부여가 돼요.' },
  { value: 'teacher', label: '선생님/관리자 체크', description: '점검 포인트가 있으면 더 잘 지켜요.' },
  { value: 'adaptive', label: '상황에 따라 다르게', description: '고정된 방식보다 그날 맞는 도움을 받고 싶어요.' },
];

export const FOCUS_TIME_OPTIONS: ChoiceOption<OnboardingAnswer['bestFocusTime']>[] = [
  { value: 'morning', label: '아침', description: '머리가 맑을 때 먼저 치고 나가요.' },
  { value: 'afternoon', label: '오후', description: '학교 끝나고 바로 들어갈 때 제일 좋아요.' },
  { value: 'evening', label: '저녁', description: '조용해지는 시간에 집중이 올라와요.' },
  { value: 'late-night', label: '밤 늦게', description: '늦은 시간에 오히려 몰입이 잘 돼요.' },
  { value: 'variable', label: '들쑥날쑥', description: '집중 피크가 매일 달라요.' },
];

export const SHARING_PREFERENCE_OPTIONS: ChoiceOption<SharingPreference>[] = [
  { value: 'private', label: '나만 보기', description: '내 루틴은 나 혼자만 보고 싶어요.' },
  { value: 'friends', label: '친구까지만', description: '가까운 친구와만 공유해도 괜찮아요.' },
  { value: 'anonymous', label: '익명 공개 가능', description: '비슷한 학생에게는 익명 공유도 괜찮아요.' },
];

export const REFLECTION_STYLE_OPTIONS: ChoiceOption<OnboardingAnswer['reflectionStyle']>[] = [
  { value: 'daily-brief', label: '매일 짧게', description: '하루 마감 1~2문장 회고가 편해요.' },
  { value: 'weekly-deep', label: '주 1회 길게', description: '주간 정리 한 번에 깊게 보고 싶어요.' },
  { value: 'auto-summary', label: '자동 요약 선호', description: '직접 쓰기보다 자동 요약이 좋아요.' },
  { value: 'not-yet', label: '회고는 아직 부담', description: '처음에는 자동 요약이나 간단한 체크부터 시작하고 싶어요.' },
];

export const ROUTINE_SURVEY_STEPS = [
  { id: 'goal', title: '기본 방향', description: '학년과 공부 목표를 먼저 알려주세요.' },
  { id: 'availability', title: '가능 시간', description: '주중과 주말에 실제로 낼 수 있는 시간을 체크해요.' },
  { id: 'friction', title: '막히는 지점', description: '어느 과목과 공부 유형이 자주 밀리는지 볼게요.' },
  { id: 'focus', title: '집중 패턴', description: '무너지는 이유와 집중이 잘 되는 시간을 확인해요.' },
  { id: 'tempo', title: '세션 템포', description: '세션 길이와 쉬는 방식으로 루틴 밀도를 맞춥니다.' },
  { id: 'support', title: '유지 방식', description: '어떤 계획과 도움 방식이 맞는지 정리해요.' },
  { id: 'reflection', title: '공유와 회고', description: '공유 범위와 회고 리듬까지 정해두면 유지가 쉬워져요.' },
] as const;

const AVAILABILITY_META: Record<StudyAvailabilitySlot, AvailabilityMeta> = {
  'weekday-morning': { label: '등교 전 06:30~07:30', description: '아침 1블록', startTime: '06:30', durationMinutes: 60 },
  'weekday-after-school': { label: '방과 후 16:30~18:30', description: '하교 직후 2블록', startTime: '16:30', durationMinutes: 120 },
  'weekday-evening': { label: '저녁 19:30~22:30', description: '메인 집중 시간', startTime: '19:30', durationMinutes: 180 },
  'weekday-night': { label: '늦은 밤 22:00~23:30', description: '짧은 정리 블록', startTime: '22:00', durationMinutes: 90 },
  'weekend-morning': { label: '주말 오전 09:00~12:00', description: '주말 오전 메인', startTime: '09:00', durationMinutes: 180 },
  'weekend-afternoon': { label: '주말 오후 13:00~17:00', description: '주말 핵심 블록', startTime: '13:00', durationMinutes: 240 },
  'weekend-evening': { label: '주말 저녁 19:00~22:00', description: '주말 정리 블록', startTime: '19:00', durationMinutes: 180 },
};

export const ROUTINE_ARCHETYPES: RoutineArchetype[] = [
  { id: 'exam-sprint', name: '시험 집중형', shortLabel: '점수 압축', summary: '핵심 과목을 우선순위대로 배치해서 점수로 연결하는 루틴이에요.', fitDescription: '시험 압박이 크고, 한정된 시간에 성과를 압축하고 싶은 학생', strategyHeadline: '중요 과목을 먼저, 끝날 때는 반드시 회수' },
  { id: 'school-balance', name: '학교병행 안정형', shortLabel: '안정 유지', summary: '학교 일정과 과목 밸런스를 무리 없이 이어가는 기본형 루틴이에요.', fitDescription: '학교 진도, 과제, 시험 준비를 함께 굴려야 하는 학생', strategyHeadline: '학교 흐름과 루틴을 함께 유지' },
  { id: 'weak-subject-recovery', name: '약한 과목 회복형', shortLabel: '약점 회복', summary: '자꾸 미루는 약한 과목을 초반 블록에 고정해 회복하는 루틴이에요.', fitDescription: '1~2과목이 계속 밀려 전체 자신감이 흔들리는 학생', strategyHeadline: '약한 과목을 제일 먼저, 짧게라도 매일' },
  { id: 'concept-rebuild', name: '개념 누수 복구형', shortLabel: '개념 리빌드', summary: '개념 재정리와 확인 문제를 짝으로 묶어 누수를 막는 루틴이에요.', fitDescription: '문제보다 개념 이해가 먼저 필요하고 기본기를 다시 세워야 하는 학생', strategyHeadline: '개념 정리 후 즉시 체크' },
  { id: 'problem-solving-focus', name: '문제풀이 몰입형', shortLabel: '실전 밀도', summary: '문제풀이 비중을 높이고 오답 회수까지 포함한 실전형 루틴이에요.', fitDescription: '알고는 있는데 적용이 부족하고 실전 감각을 올리고 싶은 학생', strategyHeadline: '문제 풀이, 오답 회수, 재도전까지 한 흐름' },
  { id: 'memory-review-boost', name: '암기·복습 강화형', shortLabel: '기억 유지', summary: '회독과 짧은 회수 블록으로 잊는 속도를 늦추는 루틴이에요.', fitDescription: '암기 과목과 복습이 자주 밀려 누적이 안 되는 학생', strategyHeadline: '짧게 자주, 같은 날 다시 한 번' },
  { id: 'evening-focus', name: '저녁 집중형', shortLabel: '야간 피크', summary: '집중 피크가 늦게 오는 학생을 위해 저녁에 메인 블록을 모은 루틴이에요.', fitDescription: '오후~저녁에 집중이 올라오고 낮에는 페이스가 늦는 학생', strategyHeadline: '피크 시간에 핵심 과목 배치' },
  { id: 'routine-reset', name: '루틴 붕괴 회복형', shortLabel: '재시동', summary: '자꾸 무너지는 루틴을 다시 세우기 위한 재시동형 루틴이에요.', fitDescription: '시작이 늦거나 계획을 과하게 잡아 실패가 반복되는 학생', strategyHeadline: '작게 시작해서 끊기지 않게 유지' },
];

const ARCHETYPE_DEFINITIONS: Record<RoutineArchetype['id'], RoutineDefinition> = {
  'exam-sprint': {
    oneLineDescription: '점수로 바로 연결되는 과목을 초반에 몰아서 처리하는 압축형 루틴',
    difficulty: 'stretch',
    fitStudent: ({ mainSubject, secondarySubject, weekdayWindowLabel }) =>
      `${mainSubject.label}·${secondarySubject.label} 우선순위가 분명하고, ${weekdayWindowLabel}에 집중 블록을 몰아 넣을 수 있는 학생`,
    coreStrategies: ({ mainSubject, secondarySubject }) => [
      `${mainSubject.label}을 첫 메인 블록에 고정해 미루는 시간을 없앱니다.`,
      `${secondarySubject.label}은 두 번째 블록에서 점수형 문제풀이로 바로 이어 붙입니다.`,
      '마지막 20분은 그날 틀린 내용만 회수해 다음 날 부담을 줄입니다.',
    ],
    subjectPlacement: ({ mainSubject, secondarySubject, supportSubject }) =>
      `${mainSubject.label} → ${secondarySubject.label} → ${supportSubject.label} 정리 순서로 갑니다. 가장 불안한 과목을 초반에 넣고, 마지막은 가벼운 회수 블록으로 닫습니다.`,
    buildStudyBlueprints: ({ mainSubject, secondarySubject, supportSubject, sessionMinutes }) => [
      {
        id: 'warmup',
        kind: 'warmup',
        title: '엔진 켜기 15분',
        durationMinutes: 15,
        instruction: '전날 틀린 문제 2개나 쉬운 개념 확인으로 바로 시작합니다.',
        fallbackInstruction: '늦게 시작했으면 워밍업만 하고 곧바로 첫 메인 블록으로 넘어갑니다.',
      },
      {
        id: 'main-1',
        kind: 'problem',
        title: `${mainSubject.label} 점수 블록`,
        subjectId: mainSubject.id,
        subjectLabel: mainSubject.label,
        durationMinutes: sessionMinutes,
        instruction: '시험에 바로 연결되는 문제 세트를 집중해서 풉니다.',
        fallbackInstruction: '집중이 흔들리면 쉬운 유형 3문제로 난도를 낮춥니다.',
      },
      {
        id: 'main-2',
        kind: 'focus',
        title: `${secondarySubject.label} 핵심 보강`,
        subjectId: secondarySubject.id,
        subjectLabel: secondarySubject.label,
        durationMinutes: sessionMinutes,
        instruction: '두 번째 블록은 약한 단원 하나만 끝내는 방식으로 갑니다.',
        fallbackInstruction: '시간이 부족하면 개념 요약 + 확인 문제 5개만 남깁니다.',
      },
      {
        id: 'main-3',
        kind: 'review',
        title: `${supportSubject.label} 정리 회수`,
        subjectId: supportSubject.id,
        subjectLabel: supportSubject.label,
        durationMinutes: Math.max(20, sessionMinutes - 20),
        instruction: '오늘 푼 내용 중 남는 오답과 표시 문제만 다시 봅니다.',
        fallbackInstruction: '너무 피곤하면 오답 제목만 적고 내일 첫 블록으로 넘깁니다.',
      },
    ],
    weekendExtension: ({ mainSubject, secondarySubject, weekendWindowLabel }) =>
      `${weekendWindowLabel}에는 ${mainSubject.label} 실전 세트 1개와 ${secondarySubject.label} 회수 블록 1개를 추가합니다.`,
  },
  'school-balance': {
    oneLineDescription: '학교 일정과 과목 밸런스를 무리 없이 굴리는 안정형 루틴',
    difficulty: 'balanced',
    fitStudent: ({ weekdayWindowLabel }) =>
      `학교 진도와 수행, 시험 준비를 같이 챙겨야 하고 ${weekdayWindowLabel}에 꾸준히 앉을 수 있는 학생`,
    coreStrategies: ({ mainSubject, secondarySubject }) => [
      '첫 블록은 학교 진도와 가장 연결된 과목으로 진입 장벽을 낮춥니다.',
      `${mainSubject.label}과 ${secondarySubject.label}을 번갈아 넣어 한 과목 과몰입을 막습니다.`,
      '루틴 끝에는 다음 날 할 일 한 줄만 남겨 재시작 부담을 줄입니다.',
    ],
    subjectPlacement: ({ mainSubject, secondarySubject, supportSubject }) =>
      `${supportSubject.label} 학교 과제/확인 → ${mainSubject.label} 메인 → ${secondarySubject.label} 마감 구조입니다.`,
    buildStudyBlueprints: ({ mainSubject, secondarySubject, supportSubject, sessionMinutes }) => [
      {
        id: 'warmup',
        kind: 'warmup',
        title: `${supportSubject.label} 오늘 체크`,
        subjectId: supportSubject.id,
        subjectLabel: supportSubject.label,
        durationMinutes: 20,
        instruction: '학교 숙제나 오늘 배운 내용을 먼저 가볍게 확인합니다.',
      },
      {
        id: 'main-1',
        kind: 'focus',
        title: `${mainSubject.label} 기본 블록`,
        subjectId: mainSubject.id,
        subjectLabel: mainSubject.label,
        durationMinutes: sessionMinutes,
        instruction: '하루 메인 과목 1개를 끝내는 감각으로 공부합니다.',
      },
      {
        id: 'main-2',
        kind: 'concept',
        title: `${secondarySubject.label} 균형 블록`,
        subjectId: secondarySubject.id,
        subjectLabel: secondarySubject.label,
        durationMinutes: Math.max(30, sessionMinutes - 10),
        instruction: '다른 과목이 완전히 밀리지 않게 짧아도 꼭 한 블록 넣습니다.',
      },
      {
        id: 'review',
        kind: 'review',
        title: '내일 연결 메모',
        durationMinutes: 15,
        instruction: '내일 첫 블록 과목과 시작 문제를 한 줄로 적어둡니다.',
      },
    ],
    weekendExtension: ({ weekendWindowLabel }) =>
      `${weekendWindowLabel}에는 학교 과제 보정 1블록과 다음 주 예습 1블록을 붙이면 안정감이 커집니다.`,
  },
  'weak-subject-recovery': {
    oneLineDescription: '미루기 쉬운 약한 과목을 초반 고정 블록으로 회복하는 루틴',
    difficulty: 'balanced',
    fitStudent: ({ mainSubject, secondarySubject }) =>
      `${mainSubject.label}이나 ${secondarySubject.label}처럼 손이 잘 안 가는 과목 때문에 전체 페이스가 흔들리는 학생`,
    coreStrategies: ({ mainSubject, secondarySubject }) => [
      `${mainSubject.label}은 무조건 첫 메인 블록에 넣습니다.`,
      `${secondarySubject.label}도 같은 날 짧게라도 한 번 더 만져 밀림을 막습니다.`,
      '잘한 과목은 마지막 보상 블록으로 배치해 심리적 저항을 낮춥니다.',
    ],
    subjectPlacement: ({ mainSubject, secondarySubject, supportSubject }) =>
      `${mainSubject.label} 짧은 진입 → ${secondarySubject.label} 확인 → ${supportSubject.label} 마감으로 갑니다.`,
    buildStudyBlueprints: ({ mainSubject, secondarySubject, supportSubject, sessionMinutes }) => [
      {
        id: 'warmup',
        kind: 'warmup',
        title: `${mainSubject.label} 쉬운 진입`,
        subjectId: mainSubject.id,
        subjectLabel: mainSubject.label,
        durationMinutes: 25,
        instruction: '첫 25분은 쉬운 문제나 개념 정리로 시작해 회피를 줄입니다.',
        fallbackInstruction: '아예 손이 안 가면 문제집 목차와 오늘 할 페이지부터 표시합니다.',
      },
      {
        id: 'main-1',
        kind: 'concept',
        title: `${mainSubject.label} 회복 블록`,
        subjectId: mainSubject.id,
        subjectLabel: mainSubject.label,
        durationMinutes: sessionMinutes,
        instruction: '약한 단원 한 개만 끝낸다는 기준으로 범위를 쪼개 진행합니다.',
      },
      {
        id: 'main-2',
        kind: 'problem',
        title: `${secondarySubject.label} 연결 블록`,
        subjectId: secondarySubject.id,
        subjectLabel: secondarySubject.label,
        durationMinutes: Math.max(30, sessionMinutes - 10),
        instruction: '두 번째 약한 과목도 같은 날 한 번 더 만져 밀림을 막습니다.',
      },
      {
        id: 'reward',
        kind: 'recovery',
        title: `${supportSubject.label} 자신감 유지`,
        subjectId: supportSubject.id,
        subjectLabel: supportSubject.label,
        durationMinutes: Math.max(20, sessionMinutes - 20),
        instruction: '마지막은 비교적 잘 되는 과목으로 끝내 성공감을 남깁니다.',
      },
    ],
    weekendExtension: ({ mainSubject, secondarySubject, weekendWindowLabel }) =>
      `${weekendWindowLabel}에는 ${mainSubject.label}·${secondarySubject.label} 약한 단원만 모은 2블록 보정 루틴을 추천합니다.`,
  },
  'concept-rebuild': {
    oneLineDescription: '개념 재정리와 확인 문제를 붙여 누수를 복구하는 루틴',
    difficulty: 'balanced',
    fitStudent: ({ mainSubject }) =>
      `${mainSubject.label}에서 “알 듯 말 듯”한 상태가 자주 남고, 개념이 문제풀이로 잘 이어지지 않는 학생`,
    coreStrategies: () => [
      '개념 정리 블록 뒤에는 반드시 짧은 확인 문제를 붙입니다.',
      '새 개념은 그날 밤 한 번, 다음 날 짧게 한 번 더 회수합니다.',
      '범위를 넓히지 말고 단원을 잘게 쪼개 누수를 줄입니다.',
    ],
    subjectPlacement: ({ mainSubject, supportSubject }) =>
      `${mainSubject.label} 개념 → 확인 문제 → ${supportSubject.label} 복습 순으로 갑니다.`,
    buildStudyBlueprints: ({ mainSubject, supportSubject, sessionMinutes }) => [
      {
        id: 'concept',
        kind: 'concept',
        title: `${mainSubject.label} 개념 재정리`,
        subjectId: mainSubject.id,
        subjectLabel: mainSubject.label,
        durationMinutes: sessionMinutes,
        instruction: '오늘은 단원 하나를 설명할 수 있을 정도까지 정리합니다.',
      },
      {
        id: 'check',
        kind: 'problem',
        title: `${mainSubject.label} 확인 문제`,
        subjectId: mainSubject.id,
        subjectLabel: mainSubject.label,
        durationMinutes: Math.max(30, sessionMinutes - 15),
        instruction: '개념 직후 확인 문제 5~8개로 이해를 확인합니다.',
      },
      {
        id: 'review',
        kind: 'review',
        title: `${supportSubject.label} 1일 회수`,
        subjectId: supportSubject.id,
        subjectLabel: supportSubject.label,
        durationMinutes: 20,
        instruction: '이미 공부한 내용 중 빠르게 잊는 파트를 20분 회수합니다.',
      },
    ],
    weekendExtension: ({ mainSubject, weekendWindowLabel }) =>
      `${weekendWindowLabel}에는 ${mainSubject.label} 개념 노트 정리 1블록과 확인 문제 1블록을 추가합니다.`,
  },
  'problem-solving-focus': {
    oneLineDescription: '문제풀이 밀도와 오답 회수를 같이 끌어올리는 실전형 루틴',
    difficulty: 'stretch',
    fitStudent: ({ mainSubject, weekdayWindowLabel }) =>
      `${mainSubject.label} 문제풀이 속도와 정확도를 올리고 싶고, ${weekdayWindowLabel}에 꽤 긴 몰입 시간이 가능한 학생`,
    coreStrategies: ({ mainSubject }) => [
      `${mainSubject.label}은 시간 제한을 두고 풀어 실전 감각을 만듭니다.`,
      '오답은 그 자리에서 원인 한 줄을 남기고, 같은 날 다시 한 번 봅니다.',
      '쉬는 시간 이후에는 가장 비슷한 유형을 다시 풀어 전환 비용을 줄입니다.',
    ],
    subjectPlacement: ({ mainSubject, secondarySubject }) =>
      `${mainSubject.label} 실전 세트 → ${secondarySubject.label} 보정 → ${mainSubject.label} 오답 회수 구조입니다.`,
    buildStudyBlueprints: ({ mainSubject, secondarySubject, sessionMinutes }) => [
      {
        id: 'set',
        kind: 'problem',
        title: `${mainSubject.label} 실전 세트`,
        subjectId: mainSubject.id,
        subjectLabel: mainSubject.label,
        durationMinutes: sessionMinutes,
        instruction: '실전처럼 시간을 재고 한 세트를 풀어봅니다.',
      },
      {
        id: 'repair',
        kind: 'focus',
        title: `${secondarySubject.label} 균형 보정`,
        subjectId: secondarySubject.id,
        subjectLabel: secondarySubject.label,
        durationMinutes: Math.max(30, sessionMinutes - 10),
        instruction: '한 과목에만 쏠리지 않도록 다른 메인 과목을 짧게 넣습니다.',
      },
      {
        id: 'error-log',
        kind: 'review',
        title: `${mainSubject.label} 오답 회수`,
        subjectId: mainSubject.id,
        subjectLabel: mainSubject.label,
        durationMinutes: 25,
        instruction: '틀린 문제는 왜 틀렸는지 한 줄만 적고 비슷한 유형을 1개 더 풉니다.',
      },
    ],
    weekendExtension: ({ mainSubject, weekendWindowLabel }) =>
      `${weekendWindowLabel}에는 ${mainSubject.label} 실전 세트 2개와 오답 재도전 블록을 묶어 넣습니다.`,
  },
  'memory-review-boost': {
    oneLineDescription: '암기와 복습을 짧게 자주 회수해 기억을 붙잡는 루틴',
    difficulty: 'easy',
    fitStudent: ({ supportSubject }) =>
      `${supportSubject.label} 같은 암기성 과목이나 복습이 자꾸 밀려 한 번 한 내용을 오래 못 가져가는 학생`,
    coreStrategies: () => [
      '같은 날 짧은 회수 블록을 반드시 한 번 더 넣습니다.',
      '암기 과목은 읽기보다 말하기/가리기 회수로 진행합니다.',
      '주말에는 주중 표시한 것만 다시 보는 식으로 범위를 줄입니다.',
    ],
    subjectPlacement: ({ mainSubject, supportSubject }) =>
      `${supportSubject.label} 암기 → ${mainSubject.label} 메인 → 짧은 당일 복습 순서입니다.`,
    buildStudyBlueprints: ({ mainSubject, supportSubject, sessionMinutes }) => [
      {
        id: 'memory',
        kind: 'memorization',
        title: `${supportSubject.label} 회독 블록`,
        subjectId: supportSubject.id,
        subjectLabel: supportSubject.label,
        durationMinutes: 25,
        instruction: '읽기보다 가리고 말하기 방식으로 외운 내용을 확인합니다.',
      },
      {
        id: 'main',
        kind: 'focus',
        title: `${mainSubject.label} 메인 블록`,
        subjectId: mainSubject.id,
        subjectLabel: mainSubject.label,
        durationMinutes: sessionMinutes,
        instruction: '하루 메인 과목은 한 블록만 확실히 끝냅니다.',
      },
      {
        id: 'same-day',
        kind: 'review',
        title: '당일 10분 회수',
        durationMinutes: 15,
        instruction: '오늘 외운 것과 틀린 것을 잠들기 전 10~15분만 다시 봅니다.',
      },
    ],
    weekendExtension: ({ weekendWindowLabel }) =>
      `${weekendWindowLabel}에는 주중에 표시한 암기 카드와 오답만 다시 보는 회수 블록을 추천합니다.`,
  },
  'evening-focus': {
    oneLineDescription: '집중 피크가 오는 저녁 시간에 메인 블록을 모으는 루틴',
    difficulty: 'balanced',
    fitStudent: ({ weekdayWindowLabel }) =>
      `낮보다 저녁에 집중이 잘 올라오고, ${weekdayWindowLabel}에 메인 블록을 배치할 수 있는 학생`,
    coreStrategies: ({ mainSubject }) => [
      `${mainSubject.label} 고난도 블록은 집중 피크가 오는 시간대에 넣습니다.`,
      '저녁 말미에는 암기 대신 오답/복습으로 난도를 낮춰 마감합니다.',
      '늦게 시작해도 첫 20분 워밍업으로 진입 장벽을 줄입니다.',
    ],
    subjectPlacement: ({ mainSubject, secondarySubject }) =>
      `저녁 초반 워밍업 → ${mainSubject.label} 메인 → ${secondarySubject.label} 마감 구조입니다.`,
    buildStudyBlueprints: ({ mainSubject, secondarySubject, sessionMinutes }) => [
      {
        id: 'warmup',
        kind: 'warmup',
        title: '저녁 진입 워밍업',
        durationMinutes: 20,
        instruction: '책상 정리, 집중 모드, 쉬운 문제 2개로 진입 속도를 올립니다.',
      },
      {
        id: 'peak',
        kind: 'focus',
        title: `${mainSubject.label} 피크 블록`,
        subjectId: mainSubject.id,
        subjectLabel: mainSubject.label,
        durationMinutes: sessionMinutes,
        instruction: '집중이 가장 좋은 시간에 가장 중요한 과목을 배치합니다.',
      },
      {
        id: 'landing',
        kind: 'review',
        title: `${secondarySubject.label} 가벼운 마감`,
        subjectId: secondarySubject.id,
        subjectLabel: secondarySubject.label,
        durationMinutes: Math.max(25, sessionMinutes - 20),
        instruction: '밤에는 새 개념보다 오답/복습으로 마감해 피로 누적을 줄입니다.',
      },
    ],
    weekendExtension: ({ weekendWindowLabel }) =>
      `${weekendWindowLabel}에는 늦은 오후부터 시작해 저녁 피크에 맞춘 3블록 루틴으로 확장해보세요.`,
  },
  'routine-reset': {
    oneLineDescription: '작게 시작해서 무너지지 않도록 설계한 재시동형 루틴',
    difficulty: 'easy',
    fitStudent: ({ weekdayWindowLabel }) =>
      `계획을 세워도 자주 무너지고, ${weekdayWindowLabel} 안에서라도 다시 리듬을 만들고 싶은 학생`,
    coreStrategies: ({ mainSubject }) => [
      `${mainSubject.label}도 첫날부터 오래 하지 않고, 25분 착수 블록으로 시작합니다.`,
      '루틴이 무너져도 바로 복구할 수 있도록 대체 규칙을 미리 적어둡니다.',
      '매일 마감은 “내일 첫 블록 하나 정하기”로 끝내 다시 시작을 쉽게 만듭니다.',
    ],
    subjectPlacement: ({ mainSubject, supportSubject }) =>
      `쉬운 진입 블록 → ${mainSubject.label} 한 블록 → ${supportSubject.label} 회복 블록 구조입니다.`,
    buildStudyBlueprints: ({ mainSubject, supportSubject, sessionMinutes }) => [
      {
        id: 'starter',
        kind: 'warmup',
        title: '25분 재시동',
        durationMinutes: 25,
        instruction: '앉으면 바로 할 수 있는 가장 쉬운 페이지나 문제 3개로 시작합니다.',
        fallbackInstruction: '정말 못 앉겠으면 교재 펴기 + 목차 표시만 해도 성공으로 칩니다.',
      },
      {
        id: 'main',
        kind: 'focus',
        title: `${mainSubject.label} 한 블록`,
        subjectId: mainSubject.id,
        subjectLabel: mainSubject.label,
        durationMinutes: Math.max(30, sessionMinutes - 10),
        instruction: '오늘은 한 블록만 확실히 끝낸다는 기준으로 갑니다.',
      },
      {
        id: 'close',
        kind: 'recovery',
        title: `${supportSubject.label} 마감 정리`,
        subjectId: supportSubject.id,
        subjectLabel: supportSubject.label,
        durationMinutes: 15,
        instruction: '내일 첫 블록으로 이어질 체크 포인트만 남기고 가볍게 마감합니다.',
      },
    ],
    weekendExtension: ({ weekendWindowLabel }) =>
      `${weekendWindowLabel}에는 기본 루틴을 두 번 반복하는 정도까지만 확장해도 충분합니다.`,
  },
};

export function createDefaultOnboardingAnswers(): OnboardingAnswer {
  return {
    gradeBand: 'high',
    examGoal: 'balance-recovery',
    weekdayAvailability: ['weekday-after-school', 'weekday-evening'],
    weekendAvailability: ['weekend-afternoon'],
    difficultSubjects: ['math'],
    laggingStudyTypes: ['problem-solving'],
    derailReason: 'unclear-priority',
    preferredSessionLength: '45-50',
    preferredBreakStyle: 'short-often',
    preferredPlanStyle: 'guided',
    supportMode: 'remind',
    bestFocusTime: 'evening',
    sharingPreference: 'private',
    reflectionStyle: 'daily-brief',
  };
}

export function getAvailabilityMeta(slot: StudyAvailabilitySlot) {
  return AVAILABILITY_META[slot];
}

export function getSubjectOption(subjectId?: string | null) {
  return SUBJECT_OPTIONS.find((subject) => subject.id === subjectId) || SUBJECT_OPTIONS[SUBJECT_OPTIONS.length - 1];
}

export function getQuestionOptionLabel<T extends string>(options: ChoiceOption<T>[], value: T) {
  return options.find((option) => option.value === value)?.label || value;
}

export function generateRoutineRecommendationSet(answers: OnboardingAnswer) {
  const rankedArchetypes = rankArchetypes(answers);
  const recommendations = rankedArchetypes.slice(0, 3).map((entry, index) =>
    buildRecommendedRoutine(entry.archetype.id, answers, (index + 1) as 1 | 2 | 3)
  );

  return {
    matchedArchetypes: rankedArchetypes,
    recommendations,
    primaryRoutine: recommendations[0],
    alternativeRoutines: recommendations.slice(1),
  };
}

export function customizeRecommendedRoutine(
  routine: RecommendedRoutine,
  answers: OnboardingAnswer,
  draft: RoutineCustomizationDraft
) {
  return buildRecommendedRoutine(routine.archetypeId, answers, routine.priority, draft);
}

function rankArchetypes(answers: OnboardingAnswer): ArchetypeScore[] {
  const scores: Record<RoutineArchetype['id'], number> = {
    'exam-sprint': 12,
    'school-balance': 12,
    'weak-subject-recovery': 12,
    'concept-rebuild': 12,
    'problem-solving-focus': 12,
    'memory-review-boost': 12,
    'evening-focus': 12,
    'routine-reset': 12,
  };

  if (answers.examGoal === 'college-sprint' || answers.examGoal === 'mock-improvement') scores['exam-sprint'] += 10;
  if (answers.examGoal === 'school-rank') scores['school-balance'] += 8;
  if (answers.examGoal === 'balance-recovery') scores['school-balance'] += 6;
  if (answers.examGoal === 'habit-reset') scores['routine-reset'] += 10;
  if (answers.examGoal === 'specific-test') {
    scores['exam-sprint'] += 7;
    scores['school-balance'] += 4;
  }
  if (answers.examGoal === 'undecided') {
    scores['routine-reset'] += 7;
    scores['school-balance'] += 5;
  }

  if (answers.difficultSubjects.length >= 2) scores['weak-subject-recovery'] += 8;
  if (answers.difficultSubjects.includes('math') || answers.difficultSubjects.includes('eng')) {
    scores['exam-sprint'] += 3;
    scores['problem-solving-focus'] += 3;
  }
  if (answers.difficultSubjects.includes('memory-all')) scores['memory-review-boost'] += 8;
  if (answers.difficultSubjects.includes('assignment')) scores['school-balance'] += 6;

  if (answers.laggingStudyTypes.includes('concept')) scores['concept-rebuild'] += 12;
  if (answers.laggingStudyTypes.includes('problem-solving')) scores['problem-solving-focus'] += 12;
  if (answers.laggingStudyTypes.includes('memorization') || answers.laggingStudyTypes.includes('review')) {
    scores['memory-review-boost'] += 12;
  }
  if (answers.laggingStudyTypes.includes('assignment')) scores['school-balance'] += 5;

  if (answers.derailReason === 'slow-start' || answers.derailReason === 'too-hard') scores['routine-reset'] += 9;
  if (answers.derailReason === 'unclear-priority') {
    scores['weak-subject-recovery'] += 4;
    scores['routine-reset'] += 6;
  }
  if (answers.derailReason === 'subject-switch') {
    scores['school-balance'] += 5;
    scores['concept-rebuild'] += 4;
  }
  if (answers.derailReason === 'fatigue') scores['evening-focus'] += 2;
  if (answers.derailReason === 'phone') {
    scores['routine-reset'] += 6;
    scores['problem-solving-focus'] += 2;
  }
  if (answers.derailReason === 'execution-gap') scores['routine-reset'] += 8;

  if (answers.preferredSessionLength === '70-80') {
    scores['exam-sprint'] += 4;
    scores['problem-solving-focus'] += 6;
  }
  if (answers.preferredSessionLength === '25-30') {
    scores['memory-review-boost'] += 4;
    scores['routine-reset'] += 6;
  }
  if (answers.preferredSessionLength === 'flexible') {
    scores['school-balance'] += 4;
    scores['routine-reset'] += 4;
  }

  if (answers.bestFocusTime === 'evening') scores['evening-focus'] += 10;
  if (answers.bestFocusTime === 'late-night') scores['evening-focus'] += 12;
  if (answers.bestFocusTime === 'morning') {
    scores['concept-rebuild'] += 3;
    scores['memory-review-boost'] += 2;
  }
  if (answers.bestFocusTime === 'variable') {
    scores['routine-reset'] += 5;
    scores['school-balance'] += 4;
  }

  if (answers.preferredPlanStyle === 'time-table') scores['exam-sprint'] += 4;
  if (answers.preferredPlanStyle === 'block') scores['school-balance'] += 4;
  if (answers.preferredPlanStyle === 'guided') scores['routine-reset'] += 4;
  if (answers.preferredPlanStyle === 'todo') scores['weak-subject-recovery'] += 3;
  if (answers.preferredPlanStyle === 'searching') scores['routine-reset'] += 6;

  if (answers.supportMode === 'teacher') scores['exam-sprint'] += 4;
  if (answers.supportMode === 'remind') scores['routine-reset'] += 3;
  if (answers.supportMode === 'peers') scores['evening-focus'] += 3;
  if (answers.supportMode === 'solo') scores['school-balance'] += 2;
  if (answers.supportMode === 'adaptive') {
    scores['school-balance'] += 3;
    scores['routine-reset'] += 3;
  }

  if (answers.weekdayAvailability.includes('weekday-evening') || answers.weekdayAvailability.includes('weekday-night')) {
    scores['evening-focus'] += 5;
  }
  if (answers.weekdayAvailability.includes('weekday-after-school')) {
    scores['school-balance'] += 3;
    scores['weak-subject-recovery'] += 3;
  }
  if (answers.weekdayAvailability.includes('weekday-morning')) {
    scores['concept-rebuild'] += 2;
    scores['memory-review-boost'] += 2;
  }

  return ROUTINE_ARCHETYPES.map((archetype) => ({
    archetype,
    score: scores[archetype.id],
  })).sort((left, right) => right.score - left.score);
}

function buildRecommendedRoutine(
  archetypeId: RoutineArchetype['id'],
  answers: OnboardingAnswer,
  priority: 1 | 2 | 3,
  draft: RoutineCustomizationDraft = {}
): RecommendedRoutine {
  const weekdayWindow = getBestAvailabilityWindow(
    answers.weekdayAvailability,
    answers.bestFocusTime,
    answers.preferredSessionLength
  );
  const weekendWindow = getBestWeekendWindow(answers.weekendAvailability, answers.bestFocusTime);
  const sessionMinutes = draft.sessionLength || getPreferredSessionMinutes(answers.preferredSessionLength);
  const breakMinutes = getBreakMinutes(answers.preferredBreakStyle, sessionMinutes);
  const dailyLoad = draft.dailyLoad || getDefaultDailyLoad(answers);
  const subjects = resolveCoreSubjects(answers, draft.prioritySubject);
  const startTime = draft.startTime || weekdayWindow.startTime;

  const context: BuildContext = {
    answers,
    mainSubject: subjects[0],
    secondarySubject: subjects[1],
    supportSubject: subjects[2],
    sessionMinutes,
    breakMinutes,
    startTime,
    weekdayWindowLabel: weekdayWindow.label,
    weekdayWindowDuration: weekdayWindow.durationMinutes,
    weekendWindowLabel: weekendWindow.label,
    weekendWindowDuration: weekendWindow.durationMinutes,
    dailyLoad,
  };

  const archetype = ROUTINE_ARCHETYPES.find((entry) => entry.id === archetypeId) || ROUTINE_ARCHETYPES[0];
  const definition = ARCHETYPE_DEFINITIONS[archetypeId];
  const blueprints = applyDailyLoad(definition.buildStudyBlueprints(context), dailyLoad);
  const studyBlocks = materializeStudyBlocks(blueprints, startTime, breakMinutes);
  const recommendationReasons = buildRecommendationReasons(context, archetype);
  const reviewRules = buildReviewRules(context);
  const distractionRules = buildDistractionRules(context);
  const difficultyLabel = getDifficultyLabel(definition.difficulty);
  const downgradeVersion = buildDowngradeVersion(context);
  const upgradeVersion = buildUpgradeVersion(context);
  const totalStudyMinutes = studyBlocks.reduce((total, block) => total + block.durationMinutes, 0);
  const studyMinutesExcludingWarmup = studyBlocks
    .filter((block) => block.kind !== 'warmup')
    .reduce((total, block) => total + block.durationMinutes, 0);
  const lastStudyBlock = studyBlocks[studyBlocks.length - 1];

  return {
    id: `${archetypeId}-${priority}`,
    archetypeId,
    priority,
    name: priority === 1 ? `${archetype.name} 루틴` : `${archetype.name} 대안`,
    oneLineDescription: definition.oneLineDescription,
    fitStudent: definition.fitStudent(context),
    difficulty: definition.difficulty,
    difficultyLabel,
    recommendationReasons,
    coreStrategies: definition.coreStrategies(context),
    dayStructureSummary: `${startTime} 시작 · 순공 ${studyMinutesExcludingWarmup}분 · 총 ${studyBlocks.length}블록`,
    subjectPlacement: definition.subjectPlacement(context),
    sessionRule: `${sessionMinutes}분 집중 블록 기준으로 가고, 하루 총 학습량은 약 ${totalStudyMinutes}분으로 맞춥니다.`,
    breakRule: getBreakRuleLabel(answers.preferredBreakStyle, breakMinutes, lastStudyBlock?.endTime || startTime),
    studyBlocks,
    reviewRules,
    distractionRules,
    downgradeVersion,
    upgradeVersion,
    weekendExtension: definition.weekendExtension(context),
  };
}

function getBestAvailabilityWindow(
  slots: StudyAvailabilitySlot[],
  bestFocusTime: OnboardingAnswer['bestFocusTime'],
  preferredSessionLength: OnboardingAnswer['preferredSessionLength']
) {
  const candidateSlots: StudyAvailabilitySlot[] = slots.length > 0 ? slots : ['weekday-evening'];
  const weighted = candidateSlots.map((slot) => {
    const meta = AVAILABILITY_META[slot];
    let score = meta.durationMinutes;
    if (bestFocusTime === 'morning' && slot === 'weekday-morning') score += 80;
    if (bestFocusTime === 'afternoon' && slot === 'weekday-after-school') score += 80;
    if (bestFocusTime === 'evening' && (slot === 'weekday-evening' || slot === 'weekday-night')) score += 80;
    if (bestFocusTime === 'late-night' && slot === 'weekday-night') score += 110;
    if (bestFocusTime === 'variable' && slot === 'weekday-after-school') score += 40;
    if (preferredSessionLength === '70-80' && meta.durationMinutes >= 150) score += 30;
    return { meta, score };
  });

  return weighted.sort((left, right) => right.score - left.score)[0].meta;
}

function getBestWeekendWindow(slots: StudyAvailabilitySlot[], bestFocusTime: OnboardingAnswer['bestFocusTime']) {
  const candidateSlots: StudyAvailabilitySlot[] = slots.length > 0 ? slots : ['weekend-afternoon'];
  const weighted = candidateSlots.map((slot) => {
    const meta = AVAILABILITY_META[slot];
    let score = meta.durationMinutes;
    if (bestFocusTime === 'morning' && slot === 'weekend-morning') score += 60;
    if (bestFocusTime === 'afternoon' && slot === 'weekend-afternoon') score += 60;
    if (bestFocusTime === 'evening' && slot === 'weekend-evening') score += 60;
    if (bestFocusTime === 'late-night' && slot === 'weekend-evening') score += 80;
    return { meta, score };
  });

  return weighted.sort((left, right) => right.score - left.score)[0].meta;
}

function getPreferredSessionMinutes(preference: OnboardingAnswer['preferredSessionLength']) {
  if (preference === '25-30') return 30;
  if (preference === '70-80') return 80;
  if (preference === 'flexible') return 45;
  return 50;
}

function getBreakMinutes(preference: OnboardingAnswer['preferredBreakStyle'], sessionMinutes: number) {
  if (preference === 'short-often') return 7;
  if (preference === 'one-long') return Math.max(10, Math.round(sessionMinutes * 0.25));
  if (preference === 'fixed') return Math.max(8, Math.round(sessionMinutes * 0.18));
  if (preference === 'unsure') return 8;
  return 5;
}

function getDefaultDailyLoad(answers: OnboardingAnswer): 'light' | 'standard' | 'heavy' {
  const totalWeekdayMinutes = answers.weekdayAvailability.reduce((total, slot) => total + AVAILABILITY_META[slot].durationMinutes, 0);
  if (answers.derailReason === 'too-hard' || answers.derailReason === 'slow-start') return 'light';
  if (answers.preferredSessionLength === '70-80' && totalWeekdayMinutes >= 180) return 'heavy';
  if (totalWeekdayMinutes >= 210) return 'heavy';
  return 'standard';
}

function resolveCoreSubjects(answers: OnboardingAnswer, prioritySubject?: string) {
  const normalizedDifficult = answers.difficultSubjects.filter((subject) =>
    ['kor', 'math', 'eng', 'history', 'social', 'science', 'etc'].includes(subject)
  );
  const difficult = normalizedDifficult.length > 0 ? normalizedDifficult : ['math'];
  const preferredPrimary = prioritySubject ? [prioritySubject, ...difficult.filter((subject) => subject !== prioritySubject)] : difficult;
  const mainSubject = getSubjectOption(preferredPrimary[0]);
  const secondarySubject = getSubjectOption(preferredPrimary[1] || pickSupportSubject(answers, mainSubject.id));
  const supportSubject = getSubjectOption(pickSupportSubject(answers, secondarySubject.id, mainSubject.id));
  return [mainSubject, secondarySubject, supportSubject] as const;
}

function pickSupportSubject(answers: OnboardingAnswer, ...excludedSubjectIds: string[]) {
  const excluded = new Set(excludedSubjectIds);
  if (answers.laggingStudyTypes.includes('memorization')) {
    const memorySubject = ['eng', 'history', 'social'].find((subject) => !excluded.has(subject));
    if (memorySubject) return memorySubject;
  }
  return SUBJECT_OPTIONS.find((subject) => !excluded.has(subject.id))?.id || 'etc';
}

function applyDailyLoad(blueprints: StudyBlueprint[], dailyLoad: 'light' | 'standard' | 'heavy') {
  if (dailyLoad === 'light') return blueprints.slice(0, Math.min(3, blueprints.length));
  if (dailyLoad === 'heavy') return blueprints;
  return blueprints.slice(0, Math.min(4, blueprints.length));
}

function materializeStudyBlocks(blueprints: StudyBlueprint[], startTime: string, breakMinutes: number) {
  let cursor = startTime;

  return blueprints.map((blueprint, index) => {
    const nextTime = addMinutesToTime(cursor, blueprint.durationMinutes);
    const block: StudyBlock = {
      id: blueprint.id,
      title: blueprint.title,
      subjectId: blueprint.subjectId,
      subjectLabel: blueprint.subjectLabel,
      kind: blueprint.kind,
      startTime: cursor,
      endTime: nextTime,
      durationMinutes: blueprint.durationMinutes,
      instruction: blueprint.instruction,
      fallbackInstruction: blueprint.fallbackInstruction,
    };

    cursor = index === blueprints.length - 1 ? nextTime : addMinutesToTime(nextTime, breakMinutes);
    return block;
  });
}

function buildRecommendationReasons(context: BuildContext, archetype: RoutineArchetype) {
  const reasons = [
    `${getFocusTimeLabel(context.answers.bestFocusTime)}에 맞춰 ${context.weekdayWindowLabel} 중심으로 루틴을 잡았어요.`,
    `${context.mainSubject.label}${context.answers.difficultSubjects.length > 1 ? `·${context.secondarySubject.label}` : ''}이 자주 밀리는 패턴을 반영해 초반 블록에 배치했어요.`,
    `${context.sessionMinutes}분 세션과 ${getBreakStyleLabel(context.answers.preferredBreakStyle)} 휴식 템포로 실제 지속 가능성을 맞췄어요.`,
  ];

  if (context.answers.derailReason === 'phone') {
    reasons[0] = '중간에 폰을 보게 되는 패턴을 막기 위해 세션 시작 전 환경 고정 규칙을 같이 넣었어요.';
  }
  if (context.answers.derailReason === 'slow-start') {
    reasons[1] = '첫 시작이 느린 패턴을 고려해 25분 착수 블록이나 워밍업 블록부터 들어가게 설계했어요.';
  }
  if (archetype.id === 'evening-focus') {
    reasons[0] = '집중 피크가 늦게 오는 패턴을 반영해 저녁 메인 블록 중심으로 설계했어요.';
  }

  return reasons;
}

function buildReviewRules(context: BuildContext): ReviewRule[] {
  const primaryTiming =
    context.answers.reflectionStyle === 'weekly-deep'
      ? '주말 30분'
      : context.answers.reflectionStyle === 'not-yet'
        ? '자동 요약 10분'
        : '당일 마감 직전 15~20분';
  const secondaryTiming =
    context.answers.reflectionStyle === 'daily-brief'
      ? '다음 날 첫 5분'
      : context.answers.reflectionStyle === 'not-yet'
        ? '주 1회 10분'
        : '주 1회 20분';

  return [
    {
      id: 'same-day-review',
      title: '당일 회수',
      timing: primaryTiming,
      description: '그날 틀린 문제, 표시한 개념, 외운 것 중 다시 볼 항목만 추려 바로 회수합니다.',
    },
    {
      id: 'next-review',
      title: '다음 회수 포인트',
      timing: secondaryTiming,
      description: '다음 날 첫 블록이나 주간 정리 시간에 전날 막힌 포인트를 다시 연결합니다.',
    },
  ];
}

function buildDistractionRules(context: BuildContext) {
  const baseRules = [
    {
      id: 'late-start',
      trigger: '만약 공부 시작이 늦어지면',
      response: `첫 블록은 ${context.mainSubject.label} 쉬운 진입 25분으로 줄여서 바로 시작합니다.`,
      fallback: '첫 블록만 성공하면 그날 루틴은 이어가는 것으로 간주합니다.',
    },
  ];

  if (context.answers.derailReason === 'phone') {
    baseRules.push({
      id: 'phone',
      trigger: '만약 세션 중간에 폰을 자주 보게 되면',
      response: '세션 시작 전에 집중모드를 켜고, 폰은 손 닿지 않는 곳에 둡니다.',
      fallback: '그래도 끊기면 남은 시간은 쉬운 문제 3개만 끝내고 바로 세션을 닫습니다.',
    });
  }

  if (context.answers.derailReason === 'fatigue' || context.answers.bestFocusTime === 'evening') {
    baseRules.push({
      id: 'fatigue',
      trigger: '만약 밤에 집중력이 급격히 떨어지면',
      response: '새 개념 대신 오답 정리나 복습 블록으로 전환합니다.',
      fallback: '마지막 10분 체크만 하고 종료해도 루틴 유지로 인정합니다.',
    });
  } else if (context.answers.derailReason === 'execution-gap') {
    baseRules.push({
      id: 'execution-gap',
      trigger: '만약 계획은 세웠는데 시작이 안 되면',
      response: '첫 블록을 절반 길이로 줄이고, 완료 기준을 “앉아서 시작하기”로 낮춥니다.',
      fallback: '첫 블록 성공만 체크해도 그날 루틴은 이어진 것으로 간주합니다.',
    });
  } else {
    baseRules.push({
      id: 'priority',
      trigger: '만약 무엇부터 할지 막히면',
      response: `무조건 ${context.mainSubject.label} 블록부터 시작하고, 다음 블록은 이미 정해둔 과목으로 이어갑니다.`,
      fallback: '결정이 안 날 때는 “쉬운 문제 3개”를 기본 시작 규칙으로 씁니다.',
    });
  }

  return baseRules;
}

function buildDowngradeVersion(context: BuildContext) {
  return [
    `너무 빡세면 ${context.mainSubject.label} 메인 블록만 남기고 나머지는 15분 회수 블록으로 줄입니다.`,
    '하루를 통째로 포기하지 말고, “첫 블록 하나 + 마감 10분”만 지켜도 성공으로 기록합니다.',
  ];
}

function buildUpgradeVersion(context: BuildContext) {
  return [
    `루틴이 잘 맞으면 주말 ${context.weekendWindowLabel}에 약한 과목 1블록을 추가합니다.`,
    '메인 블록이 안정되면 같은 과목의 심화 블록이나 실전 세트를 한 개 더 붙입니다.',
  ];
}

function getDifficultyLabel(difficulty: RoutineDifficulty) {
  if (difficulty === 'easy') return '가볍게 시작';
  if (difficulty === 'stretch') return '밀도 높음';
  return '기본형';
}

function getBreakRuleLabel(
  breakStyle: OnboardingAnswer['preferredBreakStyle'],
  breakMinutes: number,
  lastEndTime: string
) {
  if (breakStyle === 'fixed') {
    return `블록 사이 쉬는 시간도 ${breakMinutes}분으로 고정해 예측 가능한 템포를 유지합니다.`;
  }
  if (breakStyle === 'unsure') {
    return `처음에는 ${breakMinutes}분 정도의 짧은 휴식으로 시작하고, 필요하면 다음 주에 다시 조정합니다.`;
  }
  if (breakStyle === 'subject-switch') {
    return `쉬는 시간을 길게 두기보다 과목 전환으로 리듬을 바꾸고, 마감은 ${lastEndTime} 전후로 가볍게 닫습니다.`;
  }
  if (breakStyle === 'one-long') {
    return `앞 블록은 이어서 가고, 중간에 ${breakMinutes}분 정도 크게 쉬는 방식으로 갑니다.`;
  }
  return `블록 사이마다 ${breakMinutes}분 내외로 짧게 쉬며 호흡을 유지합니다.`;
}

function getFocusTimeLabel(bestFocusTime: OnboardingAnswer['bestFocusTime']) {
  if (bestFocusTime === 'morning') return '아침 집중 흐름';
  if (bestFocusTime === 'afternoon') return '오후 집중 흐름';
  if (bestFocusTime === 'evening') return '저녁 집중 흐름';
  if (bestFocusTime === 'late-night') return '야간 몰입 흐름';
  return '변동형 집중 흐름';
}

function getBreakStyleLabel(preference: OnboardingAnswer['preferredBreakStyle']) {
  if (preference === 'short-often') return '짧고 자주';
  if (preference === 'one-long') return '길게 한 번';
  if (preference === 'fixed') return '고정 휴식';
  if (preference === 'unsure') return '추천 템포 기준';
  return '과목 전환형';
}

function addMinutesToTime(time: string, deltaMinutes: number) {
  const [hour, minute] = time.split(':').map(Number);
  const totalMinutes = hour * 60 + minute + deltaMinutes;
  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const nextHour = Math.floor(normalized / 60);
  const nextMinute = normalized % 60;
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
}
