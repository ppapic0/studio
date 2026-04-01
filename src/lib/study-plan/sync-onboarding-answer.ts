import { type OnboardingAnswer } from '@/lib/types';

function mapLearnerToGradeBand(learnerType: OnboardingAnswer['learnerType']): OnboardingAnswer['gradeBand'] {
  if (learnerType === 'middle_school_core') return 'middle';
  if (learnerType === 'n_susi' || learnerType === 'gongsi') return 'repeat';
  return 'high';
}

function mapLearnerToExamGoal(learnerType: OnboardingAnswer['learnerType']): OnboardingAnswer['examGoal'] {
  if (learnerType === 'middle_school_core') return 'balance-recovery';
  if (learnerType === 'high_school_internal') return 'school-rank';
  if (learnerType === 'high3_csat' || learnerType === 'n_susi') return 'college-sprint';
  if (learnerType === 'gongsi') return 'specific-test';
  return 'undecided';
}

function mapFocusPeakToLegacyFocus(focusPeak: OnboardingAnswer['focusPeak']): OnboardingAnswer['bestFocusTime'] {
  if (focusPeak === 'morning' || focusPeak === 'late-morning') return 'morning';
  if (focusPeak === 'afternoon') return 'afternoon';
  if (focusPeak === 'evening') return 'evening';
  if (focusPeak === 'night') return 'late-night';
  return 'variable';
}

function mapBreakPreferenceToLegacyBreak(
  breakPreference: OnboardingAnswer['breakPreference']
): OnboardingAnswer['preferredBreakStyle'] {
  if (breakPreference === '10-15') return 'short-often';
  if (breakPreference === '20' || breakPreference === '30') return 'fixed';
  if (breakPreference === '40+') return 'one-long';
  return 'unsure';
}

function mapPlanningStyleToLegacyStyle(
  planningStyle: OnboardingAnswer['planningStyle']
): OnboardingAnswer['preferredPlanStyle'] {
  if (planningStyle === 'time-table') return 'time-table';
  if (planningStyle === 'big-block' || planningStyle === 'subject-hours') return 'block';
  if (planningStyle === 'guided') return 'guided';
  return 'searching';
}

function mapBreakReasonToLegacyDerail(
  planBreakReason: OnboardingAnswer['planBreakReason']
): OnboardingAnswer['derailReason'] {
  if (planBreakReason === 'too-much-volume') return 'too-hard';
  if (planBreakReason === 'subject-avoidance') return 'subject-switch';
  if (planBreakReason === 'late-start') return 'slow-start';
  if (planBreakReason === 'concentration-drop') return 'phone';
  if (planBreakReason === 'break-overrun') return 'fatigue';
  if (planBreakReason === 'subject-imbalance') return 'unclear-priority';
  return 'execution-gap';
}

function mapReflectionStyle(
  reflectionStyle: OnboardingAnswer['reflectionStyle']
): OnboardingAnswer['legacyReflectionStyle'] {
  if (reflectionStyle === 'time-check' || reflectionStyle === 'memo') return 'daily-brief';
  if (reflectionStyle === 'subject-progress') return 'weekly-deep';
  if (reflectionStyle === 'auto-summary') return 'auto-summary';
  return 'not-yet';
}

function mapBlockLengthToLegacySession(
  mainBlockLength: OnboardingAnswer['mainBlockLength']
): OnboardingAnswer['preferredSessionLength'] {
  if (mainBlockLength === '90m') return '70-80';
  return 'flexible';
}

function deriveWeekdayAvailability(focusPeak: OnboardingAnswer['focusPeak']): OnboardingAnswer['weekdayAvailability'] {
  if (focusPeak === 'morning') return ['weekday-morning', 'weekday-after-school'];
  if (focusPeak === 'late-morning' || focusPeak === 'afternoon') return ['weekday-after-school', 'weekday-evening'];
  if (focusPeak === 'evening') return ['weekday-evening'];
  if (focusPeak === 'night') return ['weekday-evening', 'weekday-night'];
  return ['weekday-after-school', 'weekday-evening'];
}

function deriveWeekendAvailability(
  focusPeak: OnboardingAnswer['focusPeak'],
  dailyStudyHours: OnboardingAnswer['dailyStudyHours']
): OnboardingAnswer['weekendAvailability'] {
  if (dailyStudyHours === '10h' || dailyStudyHours === '12h-plus') {
    return ['weekend-morning', 'weekend-afternoon', 'weekend-evening'];
  }
  if (focusPeak === 'morning' || focusPeak === 'late-morning') return ['weekend-morning', 'weekend-afternoon'];
  if (focusPeak === 'evening' || focusPeak === 'night') return ['weekend-afternoon', 'weekend-evening'];
  return ['weekend-afternoon', 'weekend-evening'];
}

function deriveLaggingStudyTypes(answer: OnboardingAnswer): OnboardingAnswer['laggingStudyTypes'] {
  if (answer.planBreakReason === 'subject-avoidance') return ['concept'];
  if (answer.planBreakReason === 'subject-imbalance') return ['review'];
  if (answer.planBreakReason === 'concentration-drop') return ['problem-solving'];
  return ['review'];
}

function deriveDifficultSubjects(answer: OnboardingAnswer) {
  const values = [...answer.weakSubjects.filter((value) => value !== 'none')];
  for (const value of answer.subjectPriority) {
    if (value === 'none') continue;
    if (!values.includes(value)) values.push(value);
  }
  return values.slice(0, 2);
}

export function syncStudyPlanAnswerCompatibility(answer: OnboardingAnswer): OnboardingAnswer {
  const difficultSubjects = deriveDifficultSubjects(answer);
  return {
    ...answer,
    gradeBand: mapLearnerToGradeBand(answer.learnerType),
    examGoal: mapLearnerToExamGoal(answer.learnerType),
    weekdayAvailability: deriveWeekdayAvailability(answer.focusPeak),
    weekendAvailability: deriveWeekendAvailability(answer.focusPeak, answer.dailyStudyHours),
    difficultSubjects,
    laggingStudyTypes: deriveLaggingStudyTypes(answer),
    derailReason: mapBreakReasonToLegacyDerail(answer.planBreakReason),
    preferredSessionLength: mapBlockLengthToLegacySession(answer.mainBlockLength),
    preferredBreakStyle: mapBreakPreferenceToLegacyBreak(answer.breakPreference),
    preferredPlanStyle: mapPlanningStyleToLegacyStyle(answer.planningStyle),
    supportMode: 'solo',
    bestFocusTime: mapFocusPeakToLegacyFocus(answer.focusPeak),
    sharingPreference: answer.sharingPreference || 'private',
    legacyReflectionStyle: mapReflectionStyle(answer.reflectionStyle),
  };
}
