import { httpsCallable, type Functions } from 'firebase/functions';

import type { GeneratedStudyPlan, StudyPlannerAnswers, StudyPlannerFlags, StudyPlannerScores } from '@/lib/types';

type GenerateStudyPlanInput = {
  profile: {
    grade: StudyPlannerAnswers['grade'];
    goal: StudyPlannerAnswers['goal'];
    examWindow: StudyPlannerAnswers['examWindow'];
    avgStudyHours: StudyPlannerAnswers['averageStudyHours'];
    planningScore: number;
    reflectionScore: number;
    balanceScore: number;
    diversityScore: number;
    motivationScore: number;
    weakSubjects: string[];
    timeHeavySubjects: string[];
    leastEfficientSubject: string;
    activityTypes: string[];
    burnoutSignals: string[];
    theorySummary: string[];
    flags: StudyPlannerFlags;
  };
};

export async function callGenerateStudyPlan(params: {
  functions: Functions;
  answers: StudyPlannerAnswers;
  scores: StudyPlannerScores;
  flags: StudyPlannerFlags;
}) {
  const callable = httpsCallable<GenerateStudyPlanInput, GeneratedStudyPlan>(params.functions, 'generateStudyPlan', {
    timeout: 60000,
  });

  const payload: GenerateStudyPlanInput = {
    profile: {
      grade: params.answers.grade,
      goal: params.answers.goal,
      examWindow: params.answers.examWindow,
      avgStudyHours: params.answers.averageStudyHours,
      planningScore: params.scores.planning,
      reflectionScore: params.scores.reflection,
      balanceScore: params.scores.subjectBalance,
      diversityScore: params.scores.activityDiversity,
      motivationScore: params.scores.motivation,
      weakSubjects: params.answers.subjectGrades
        ? Object.entries(params.answers.subjectGrades)
            .filter(([, value]) => typeof value === 'number' && value >= 6)
            .map(([subject]) => subject)
        : [],
      timeHeavySubjects: params.answers.topTimeSubjects,
      leastEfficientSubject: params.answers.lowEfficiencySubject,
      activityTypes: params.answers.studyActivities,
      burnoutSignals: params.answers.burnoutReasons,
      theorySummary: [
        'Zimmerman 자기조절학습: 계획-수행-성찰 루프',
        'Bloom 활동 유형: 개념이해, 적용, 기억, 점검 활동의 균형',
        'Sweller 인지부하: 비효율 반복과 활동-과제 불일치 조정',
        'Dweck 동기 패턴: 숙달 지향과 회피 지향을 구분한 코칭',
      ],
      flags: params.flags,
    },
  };

  const result = await callable(payload);
  return result.data;
}
