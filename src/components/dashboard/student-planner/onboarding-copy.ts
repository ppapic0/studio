export const ONBOARDING_START_COPY = {
  title: '나에게 맞는 학습 계획 찾기',
  subtitle: '몇 가지 질문만 답하면\n내 목표와 공부 스타일에 맞는 계획을 추천해드릴게요.',
  description: '완벽하게 답하지 않아도 괜찮아요.\n지금 공부 패턴에 가장 가까운 걸 골라주세요.',
  primaryCta: '시작하기',
  secondaryCta: '나중에 할게요',
  footnote: '약 1~2분 걸려요',
} as const;

export const ONBOARDING_SURVEY_COPY = {
  progressLabel: '계획 찾는 중',
  nextCta: '다음',
  previousCta: '이전',
  skipCta: '잘 모르겠어요',
  submitCta: '내 기준 저장하기',
  helperText: '정답은 없어요. 지금 나와 가장 가까운 걸 골라주세요.',
} as const;

export const ONBOARDING_BRIDGE_COPY = {
  early: '좋아요, 목표와 공부 시간을 먼저 파악하고 있어요.',
  middle: '이제 과목별 배분과 공부 방식이 조금씩 보이고 있어요.',
  final: '거의 다 왔어요. 답변을 바탕으로 현실적인 계획을 정리할게요.',
} as const;

export const ONBOARDING_LOADING_COPY = {
  title: '기준을 정리하는 중이에요',
  lines: [
    '답변을 바탕으로\n앞으로 계획을 읽을 기준을 먼저 정리하고 있어요.',
    '우선 과목, 총량, 공부 블록 길이까지\n실제로 코칭에 쓸 기준으로 맞추고 있어요.',
    '조금만 기다리면\n오늘 계획에 바로 붙일 수 있게 저장해드릴게요.',
  ],
} as const;

export const ONBOARDING_RESULTS_COPY = {
  title: '이런 계획이 잘 맞을 것 같아요',
  subtitle: '답변을 바탕으로\n지금 가장 현실적으로 시작할 수 있는 계획을 먼저 추천해드릴게요.',
  reasonLabel: '왜 이렇게 추천했어요',
  dayPreviewLabel: '하루 배분 예시',
  fitLabel: '이런 학습자에게 맞아요',
  downgradeLabel: '너무 빡세면',
  upgradeLabel: '잘 맞으면',
  ruleLabel: '운영 규칙',
  primaryCta: '이 계획으로 시작하기',
  secondaryCta: '조금 수정해서 사용할래요',
} as const;

export const ONBOARDING_SAVED_COPY = {
  title: '내 기준을 저장했어요',
  subtitle: '이제 오늘 계획을 쓰면 부족한 점과 보강 포인트를 함께 보여드릴게요.',
  primaryCta: '오늘 계획 보러가기',
  secondaryCta: '답변 다시 보기',
  footnote: '기준은 언제든 다시 진단해서 내 공부 흐름에 맞게 바꿀 수 있어요.',
} as const;
