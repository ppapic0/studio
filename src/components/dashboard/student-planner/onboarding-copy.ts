export const ONBOARDING_START_COPY = {
  title: '나에게 맞는 학습 루틴 찾기',
  subtitle: '몇 가지 질문만 답하면\n내 공부 스타일에 맞는 루틴을 추천해드릴게요.',
  description: '완벽하게 답하지 않아도 괜찮아요.\n지금 상태 기준으로 가볍게 골라주세요.',
  primaryCta: '시작하기',
  secondaryCta: '나중에 할게요',
  footnote: '약 1~2분 걸려요',
} as const;

export const ONBOARDING_SURVEY_COPY = {
  progressLabel: '루틴 찾는 중',
  nextCta: '다음',
  previousCta: '이전',
  skipCta: '잘 모르겠어요',
  submitCta: '내 루틴 추천받기',
  helperText: '정답은 없어요. 지금 나와 가장 가까운 걸 골라주세요.',
} as const;

export const ONBOARDING_BRIDGE_COPY = {
  early: '좋아요, 공부 시간대를 조금씩 파악하고 있어요.',
  middle: '이제 어떤 루틴이 잘 맞을지 꽤 선명해지고 있어요.',
  final: '거의 다 왔어요. 마지막 답변까지 반영해서 추천할게요.',
} as const;

export const ONBOARDING_LOADING_COPY = {
  title: '루틴을 만드는 중이에요',
  lines: [
    '답변을 바탕으로\n내 공부 흐름에 맞는 루틴을 정리하고 있어요.',
    '과목 순서, 공부 블록 길이, 쉬는 방식까지 함께 보고 있어요.',
    '조금만 기다리면 바로 시작할 수 있는 추천 루틴을 보여드릴게요.',
  ],
} as const;

export const ONBOARDING_RESULTS_COPY = {
  title: '이런 루틴이 잘 맞을 것 같아요',
  subtitle: '완벽한 정답은 아니에요.\n가장 시작하기 쉬운 루틴부터 추천해드릴게요.',
  primaryCta: '이 루틴으로 시작하기',
  secondaryCta: '조금 수정해서 사용할래요',
  reasonLabel: '추천 이유',
  dayPreviewLabel: '하루 예시',
  fitLabel: '이런 학생에게 잘 맞아요',
  downgradeLabel: '너무 힘들면 이렇게 줄여보세요',
  badgeLabels: {
    primary: '가장 잘 맞아요',
    easy: '가볍게 시작하기 좋아요',
    exam: '시험 기간에 강해요',
    weakSubject: '약한 과목 보완형',
    resilient: '무너지기 쉬운 날에도 유지형',
  },
} as const;

export const ONBOARDING_SAVED_COPY = {
  title: '내 루틴으로 저장했어요',
  subtitle: '이제 오늘 계획에서 바로 시작할 수 있어요.',
  primaryCta: '오늘 루틴 보러가기',
  secondaryCta: '조금 더 수정하기',
  footnote: '루틴은 언제든 내 스타일에 맞게 바꿀 수 있어요.',
} as const;
