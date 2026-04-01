import type { StudyPlannerAnswers, StudyPlannerFlags, StudyPlannerInsight, StudyPlannerScores } from '@/lib/types';

type InsightBuilderInput = {
  answers: StudyPlannerAnswers;
  scores: StudyPlannerScores;
  flags: StudyPlannerFlags;
};

function hasRetrievalActivity(activities: StudyPlannerAnswers['studyActivities']) {
  return activities.includes('백지회상') || activities.includes('설명해보기') || activities.includes('오답정리');
}

export function buildPlannerInsights({ answers, scores, flags }: InsightBuilderInput): StudyPlannerInsight[] {
  const insights: StudyPlannerInsight[] = [];

  if (
    answers.lowEfficiencySubject !== '없음' &&
    answers.topTimeSubjects.includes(answers.lowEfficiencySubject)
  ) {
    insights.push({
      id: 'efficiency-mismatch',
      text: '가장 많은 시간을 쓰는데 효율이 낮다면 학습 방법을 바꿔야 할 신호예요. 같은 시간이라도 어떤 활동을 하느냐가 결과를 바꿀 수 있어요. 이번 주에는 그 과목에서 개념 반복만 하지 말고 오답 정리나 설명해보기, 회상 활동을 꼭 섞어보세요.',
    });
  }

  if (answers.motivationType === '못하면 안 될 것 같아서') {
    insights.push({
      id: 'avoidance-motivation',
      text: '지금은 불안이나 압박이 공부를 끌고 가는 비중이 커 보여요. 단기적으로는 버틸 수 있지만, 오래가면 번아웃으로 이어질 수 있어요. 이번 주 계획은 덜 불안하게 오래 가는 방식으로 조정하는 게 좋아요.',
    });
  }

  if (answers.planningScore <= 2 && answers.reflectionScore <= 2) {
    insights.push({
      id: 'low-planning-reflection',
      text: '계획과 성찰이 모두 약한 패턴이에요. 공부를 오래 하는 것만으로는 누수가 생길 수 있어요. 이번 주에는 시작 전 간단한 계획 1분, 끝난 뒤 점검 3분만이라도 고정해보세요.',
    });
  }

  if (scores.activityDiversity <= 50) {
    insights.push({
      id: 'low-diversity',
      text: '지금은 학습 활동이 조금 단조롭게 반복될 가능성이 보여요. 개념 이해, 문제풀이, 오답정리, 백지회상 중 두세 가지를 섞으면 같은 시간에도 더 오래 남는 공부가 되기 쉬워요.',
    });
  }

  if (flags.burnoutRiskFlag) {
    insights.push({
      id: 'burnout-risk',
      text: '지금은 의지보다 회복과 유지 전략이 더 중요해 보여요. 이번 주 계획은 총량을 무조건 늘리기보다, 끊기지 않게 이어가는 구조로 잡는 게 좋겠어요.',
    });
  }

  if (flags.lowMotivationFlag) {
    insights.push({
      id: 'low-motivation',
      text: '공부를 밀어붙이는 힘이 약해진 신호가 보여요. 너무 큰 목표보다 “오늘 이 블록만 끝내기”처럼 바로 실행 가능한 단위로 쪼개면 다시 붙기 쉬워요.',
    });
  }

  if (!hasRetrievalActivity(answers.studyActivities)) {
    insights.push({
      id: 'no-retrieval',
      text: '지금 선택한 활동에는 회상형 공부가 거의 보이지 않아요. 읽고 끝내는 방식만 반복하면 남는 양이 줄 수 있어서, 이번 주에는 백지회상이나 설명해보기 같은 꺼내 쓰는 활동을 한 번이라도 넣어보는 걸 추천해요.',
    });
  }

  if (
    answers.lowEfficiencySubject !== '없음' &&
    Object.values(answers.subjectGrades).some((value) => typeof value === 'number') &&
    !answers.topTimeSubjects.includes(answers.lowEfficiencySubject)
  ) {
    insights.push({
      id: 'weak-ignored',
      text: '성적대 정보를 보면 부담 과목이 있는데, 실제 시간 배분에서는 앞쪽 우선순위로 잘 안 들어오는 것 같아요. 이번 주에는 그 과목을 가장 집중 잘 되는 시간에 먼저 1블록만이라도 확보해보세요.',
    });
  }

  return insights.slice(0, 5);
}
