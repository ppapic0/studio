import type {
  OnboardingAnswer,
  PlannerBurnoutReason,
  PlannerLearnerGrade,
  PlannerMainGoal,
  PlannerStudyActivity,
  PlannerStudyHoursBand,
  PlannerSubject,
  StudyPlanItem,
  StudyPlannerAnswers,
  StudyPlannerDiagnosticRecord,
  UserStudyProfile,
} from '@/lib/types';

function mapLearnerTypeToGrade(answers: OnboardingAnswer): PlannerLearnerGrade {
  switch (answers.learnerType) {
    case 'middle_school_core':
      return 'middle-3';
    case 'high_school_internal':
      return 'high-2';
    case 'high3_csat':
      return 'high-3';
    case 'n_susi':
      return 'n-susi';
    case 'gongsi':
      return 'gongsi';
    case 'goal_searching':
    default:
      return answers.gradeBand === 'middle' ? 'middle-3' : answers.gradeBand === 'repeat' ? 'n-susi' : 'high-1';
  }
}

function mapExamGoalToPlannerGoal(answers: OnboardingAnswer): PlannerMainGoal {
  if (answers.learnerType === 'gongsi') return 'gongsi';
  switch (answers.examGoal) {
    case 'school-rank':
      return 'school';
    case 'specific-test':
      return 'etc';
    case 'college-sprint':
    case 'mock-improvement':
      return 'csat';
    case 'balance-recovery':
    case 'habit-reset':
    case 'undecided':
    default:
      return answers.learnerType === 'high_school_internal' ? 'school' : 'both';
  }
}

function mapHoursToBand(hours: OnboardingAnswer['dailyStudyHours']): PlannerStudyHoursBand {
  if (hours === '4h') return '2-4';
  if (hours === '6h') return '4-6';
  return '6-plus';
}

function mapPlanStyleToLikert(style: OnboardingAnswer['planningStyle']) {
  switch (style) {
    case 'time-table':
      return 5 as const;
    case 'subject-hours':
    case 'guided':
      return 4 as const;
    case 'big-block':
      return 3 as const;
    case 'unknown':
    default:
      return 2 as const;
  }
}

function mapReflectionStyleToLikert(style: OnboardingAnswer['reflectionStyle']) {
  switch (style) {
    case 'time-check':
    case 'subject-progress':
      return 4 as const;
    case 'memo':
      return 3 as const;
    case 'auto-summary':
      return 2 as const;
    case 'not-ready':
    default:
      return 1 as const;
  }
}

function mapPlanBreakToUnknownHandling(reason: OnboardingAnswer['planBreakReason']): StudyPlannerAnswers['unknownHandling'] {
  if (reason === 'subject-avoidance' || reason === 'finish-gap') return '표시 후 나중에';
  if (reason === 'concentration-drop') return '그냥 넘김';
  return '바로 찾아봄';
}

function mapFocusPeakToExamWindow(answers: OnboardingAnswer): StudyPlannerAnswers['examWindow'] {
  if (answers.examGoal === 'college-sprint' || answers.examGoal === 'specific-test') return 'one-to-three-months';
  return 'over-three-months';
}

function mapWeakSubject(subject?: string): PlannerSubject | null {
  if (!subject || subject === 'none') return null;
  if (subject.includes('국어')) return '국어';
  if (subject.includes('수학')) return '수학';
  if (subject.includes('영어')) return '영어';
  if (subject.includes('탐구') || subject.includes('사탐') || subject.includes('과탐')) return '탐구';
  if (subject.includes('한국사')) return '한국사';
  return '기타';
}

function inferActivitiesFromTasks(tasks: StudyPlanItem[]): PlannerStudyActivity[] {
  const activitySet = new Set<PlannerStudyActivity>();
  tasks.forEach((task) => {
    const title = `${task.title} ${task.tag || ''}`.toLowerCase();
    if (title.includes('오답')) activitySet.add('오답정리');
    if (title.includes('암기') || title.includes('단어')) activitySet.add('암기');
    if (title.includes('회상') || title.includes('백지')) activitySet.add('백지회상');
    if (title.includes('설명')) activitySet.add('설명해보기');
    if (title.includes('개념')) activitySet.add('개념이해');
    if (title.includes('문제') || title.includes('독해') || title.includes('지문') || title.includes('세트')) {
      activitySet.add('문제풀이');
    }
  });
  if (activitySet.size === 0) {
    activitySet.add('문제풀이');
    activitySet.add('오답정리');
  }
  return Array.from(activitySet);
}

function inferTopSubjects(tasks: StudyPlanItem[], profile?: UserStudyProfile | null): PlannerSubject[] {
  const totals = new Map<PlannerSubject, number>();
  tasks
    .filter((task) => task.category === 'study' || !task.category)
    .forEach((task) => {
      const mapped = mapWeakSubject(task.subjectLabel || task.subject || '');
      const subject = mapped || '기타';
      totals.set(subject, (totals.get(subject) || 0) + Number(task.targetMinutes || 0));
    });
  const ranked = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([subject]) => subject)
    .slice(0, 3);

  if (ranked.length > 0) return ranked;

  const priority = (profile?.answers.subjectPriority || [])
    .map((subject) => mapWeakSubject(subject))
    .filter((subject): subject is PlannerSubject => Boolean(subject));
  return priority.slice(0, 3);
}

function inferBurnoutReasons(answers: OnboardingAnswer): PlannerBurnoutReason[] {
  switch (answers.planBreakReason) {
    case 'subject-avoidance':
      return ['너무 어려워서'];
    case 'late-start':
      return ['왜 해야 하는지 모르겠어서'];
    case 'concentration-drop':
    case 'break-overrun':
      return ['그냥 지쳐서'];
    default:
      return ['특별히 없음'];
  }
}

export function buildSeedPlannerAnswers(params: {
  profile?: UserStudyProfile | null;
  latestDiagnostic?: StudyPlannerDiagnosticRecord | null;
  recentStudyTasks?: StudyPlanItem[];
}): StudyPlannerAnswers | null {
  const { latestDiagnostic, profile, recentStudyTasks = [] } = params;

  if (latestDiagnostic?.answers) {
    const seeded = {
      ...latestDiagnostic.answers,
      topTimeSubjects: inferTopSubjects(recentStudyTasks, profile).length > 0
        ? inferTopSubjects(recentStudyTasks, profile)
        : latestDiagnostic.answers.topTimeSubjects,
      studyActivities: inferActivitiesFromTasks(recentStudyTasks).length > 0
        ? inferActivitiesFromTasks(recentStudyTasks)
        : latestDiagnostic.answers.studyActivities,
    };
    return seeded;
  }

  if (!profile?.answers) return null;

  const base = profile.answers;
  const weakSubjects = [
    ...(base.weakSubjects || []),
    ...(base.difficultSubjects || []),
  ]
    .map((subject) => mapWeakSubject(subject))
    .filter((subject): subject is PlannerSubject => Boolean(subject));
  const topSubjects = inferTopSubjects(recentStudyTasks, profile);
  const activities = inferActivitiesFromTasks(recentStudyTasks);

  return {
    grade: mapLearnerTypeToGrade(base),
    goal: mapExamGoalToPlannerGoal(base),
    examWindow: mapFocusPeakToExamWindow(base),
    averageStudyHours: mapHoursToBand(base.dailyStudyHours),
    planningScore: mapPlanStyleToLikert(base.planningStyle),
    reflectionScore: mapReflectionStyleToLikert(base.reflectionStyle),
    unknownHandling: mapPlanBreakToUnknownHandling(base.planBreakReason),
    subjectGrades: {},
    topTimeSubjects: topSubjects.length > 0 ? topSubjects : ['수학', '영어'],
    studyActivities: activities,
    lowEfficiencySubject: weakSubjects[0] || '없음',
    burnoutReasons: inferBurnoutReasons(base),
    motivationType: base.examGoal === 'undecided' ? '모르겠음' : '더 잘하고 싶어서',
    lastSuccessRecency: base.reflectionStyle === 'not-ready' ? '기억 안 남' : '1개월 내',
  };
}
