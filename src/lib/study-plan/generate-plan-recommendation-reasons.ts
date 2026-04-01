import { type OnboardingAnswer, type RecommendationReason, type StudyPlanArchetype } from '@/lib/types';

export function generatePlanRecommendationReasons(options: {
  answers: OnboardingAnswer;
  archetype: StudyPlanArchetype;
  totalStudyMinutes: number;
  mainBlockMinutes: 120 | 150 | 180;
  breakMinutes: 20 | 30;
}): RecommendationReason[] {
  const { answers, archetype, totalStudyMinutes, mainBlockMinutes, breakMinutes } = options;
  const reasons: RecommendationReason[] = [];
  const totalHours = Math.round((totalStudyMinutes / 60) * 10) / 10;

  reasons.push({
    id: 'total-hours',
    label: '총 공부시간',
    text: `하루 공부 목표 시간이 ${totalHours}시간 안팎으로 잡혀 있어 총량 중심 계획이 잘 맞아요.`,
  });

  if (answers.subjectPriority.includes('math') || answers.weakSubjects.includes('math')) {
    reasons.push({
      id: 'math-priority',
      label: '우선 과목',
      text: '수학을 우선 과목으로 선택해서 수학 비중을 더 두껍게 배치했어요.',
    });
  }

  if (answers.weakSubjects.some((subject) => subject !== 'none')) {
    reasons.push({
      id: 'weak-subject',
      label: '부담 과목',
      text: `부담 과목이 분명해서 ${answers.focusPeak === 'morning' || answers.focusPeak === 'late-morning' ? '집중이 잘 되는 앞쪽 시간대' : '가장 집중되는 시간대'}에 먼저 배치했어요.`,
    });
  }

  if (answers.learnerType === 'high3_csat') {
    reasons.push({
      id: 'high3-csat',
      label: '고3 수능형',
      text: '고3 수능형 응답이 강해서 국어·수학·영어·탐구 기본 비중을 먼저 안정화했어요.',
    });
  }

  if (answers.learnerType === 'n_susi') {
    reasons.push({
      id: 'n-susi',
      label: 'N수형',
      text: '학교 일정 제약보다 장시간 몰입이 중요한 패턴이라, 하루 블록 수를 줄이고 긴 블록 중심으로 구성했어요.',
    });
  }

  if (answers.learnerType === 'gongsi') {
    reasons.push({
      id: 'gongsi',
      label: '공시형',
      text: '공시 준비는 과목별 누적 회독이 중요해서, 과목별 총시간과 긴 블록 운영을 함께 보도록 잡았어요.',
    });
  }

  reasons.push({
    id: 'block-length',
    label: '블록 길이',
    text: `한 번 앉으면 2~3시간 가까이 공부하는 패턴이 보여서 ${mainBlockMinutes}분 중심의 긴 블록으로 구성했어요.`,
  });

  reasons.push({
    id: 'break-rule',
    label: '휴식',
    text: `블록 사이 휴식은 ${breakMinutes}분 기준으로 두고, 쉬는 시간이 길어지지 않도록 운영 규칙을 함께 넣었어요.`,
  });

  if (answers.planBreakReason === 'too-much-volume' || answers.planBreakReason === 'finish-gap') {
    reasons.push({
      id: 'reality-check',
      label: '현실성',
      text: '계획이 자주 무너지는 이유를 반영해서, 보기 좋은 계획보다 실제로 끝까지 갈 수 있는 구조를 먼저 잡았어요.',
    });
  }

  if (archetype.id === 'long_block_stable') {
    reasons.push({
      id: 'stable-blocks',
      label: '안정성',
      text: '블록 수를 과하게 늘리지 않고, 긴 공부 블록을 안정적으로 이어가는 데 초점을 두었어요.',
    });
  }

  return reasons.slice(0, 4);
}
