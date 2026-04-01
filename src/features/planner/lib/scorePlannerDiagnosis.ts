import type {
  PlannerSubject,
  StudyPlannerAnswers,
  StudyPlannerFlags,
  StudyPlannerMetric,
  StudyPlannerScores,
} from '@/lib/types';

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function scoreLikert(value: number) {
  return clamp(value * 20);
}

function getGradeVariancePenalty(answers: StudyPlannerAnswers) {
  const values = Object.values(answers.subjectGrades)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length < 2) return 0;

  const spread = Math.max(...values) - Math.min(...values);
  if (spread >= 5) return 20;
  if (spread >= 3) return 10;
  return 0;
}

function getHeavySubjectPenalty(topSubjects: PlannerSubject[]) {
  const unique = new Set(topSubjects);
  return unique.size <= 1 ? 10 : unique.size === 2 ? 5 : 0;
}

export function scorePlannerDiagnosis(answers: StudyPlannerAnswers) {
  const planning = scoreLikert(answers.planningScore);
  const reflection = scoreLikert(answers.reflectionScore);

  let subjectBalance = 80;
  if (
    answers.lowEfficiencySubject !== '없음' &&
    answers.topTimeSubjects.includes(answers.lowEfficiencySubject)
  ) {
    subjectBalance -= 35;
  }
  subjectBalance -= getGradeVariancePenalty(answers);
  subjectBalance -= getHeavySubjectPenalty(
    answers.topTimeSubjects.filter((subject): subject is PlannerSubject => subject !== '기타')
  );
  subjectBalance = clamp(subjectBalance);

  let activityDiversity = clamp(answers.studyActivities.length * 25);
  if (
    answers.studyActivities.some((activity) => activity === '백지회상' || activity === '설명해보기' || activity === '오답정리')
  ) {
    activityDiversity = clamp(activityDiversity + 10);
  }

  let motivationBase = 10;
  if (answers.motivationType === '더 잘하고 싶어서') motivationBase = 40;
  if (answers.motivationType === '못하면 안 될 것 같아서') motivationBase = 20;

  const burnoutWeight = answers.burnoutReasons.includes('특별히 없음')
    ? 50
    : Math.min(
        ...answers.burnoutReasons.map((reason) => {
          if (reason === '너무 어려워서') return 25;
          if (reason === '왜 해야 하는지 모르겠어서') return 15;
          if (reason === '그냥 지쳐서') return 20;
          return 50;
        })
      );

  const motivation = clamp(motivationBase + burnoutWeight);

  const flags: StudyPlannerFlags = {
    lowPlanningFlag: planning <= 40,
    lowReflectionFlag: reflection <= 40,
    lowMotivationFlag: motivation <= 35,
    efficiencyMismatchFlag:
      answers.lowEfficiencySubject !== '없음' &&
      answers.topTimeSubjects.includes(answers.lowEfficiencySubject),
    burnoutRiskFlag:
      answers.burnoutReasons.includes('그냥 지쳐서') ||
      answers.burnoutReasons.includes('왜 해야 하는지 모르겠어서') ||
      (answers.burnoutReasons.length > 1 && !answers.burnoutReasons.includes('특별히 없음')),
    avoidanceMotivationFlag: answers.motivationType === '못하면 안 될 것 같아서',
  };

  const scores: StudyPlannerScores = {
    planning,
    reflection,
    subjectBalance,
    activityDiversity,
    motivation,
  };

  const metrics: StudyPlannerMetric[] = [
    { label: '학습 계획성', value: planning },
    { label: '자기성찰', value: reflection },
    { label: '과목 밸런스', value: subjectBalance },
    { label: '학습 활동 다양성', value: activityDiversity },
    { label: '동기 수준', value: motivation },
  ];

  return {
    scores,
    flags,
    metrics,
  };
}
