import type {
  GeneratedStudyPlan,
  StudyPlannerAnswers,
  StudyPlannerFlags,
} from '@/lib/types';
import { addMinutesToTime } from '@/features/schedules/lib/scheduleModel';

export interface PlannerSchedulePrefill {
  recommendedWeeklyDays: number;
  recommendedDailyStudyMinutes: number;
  recommendedArrivalTime: string;
  recommendedDepartureTime: string;
  repeatWeekdays: number[];
  weeklyBalance: GeneratedStudyPlan['weekly_balance'];
}

function resolveBaseDays(averageStudyHours: StudyPlannerAnswers['averageStudyHours']) {
  if (averageStudyHours === 'under-2') return 4;
  if (averageStudyHours === '2-4') return 5;
  if (averageStudyHours === '4-6') return 6;
  return 6;
}

function resolveDailyMinutes(averageStudyHours: StudyPlannerAnswers['averageStudyHours']) {
  if (averageStudyHours === 'under-2') return 120;
  if (averageStudyHours === '2-4') return 180;
  if (averageStudyHours === '4-6') return 300;
  return 420;
}

export function deriveSchedulePrefill(params: {
  answers: StudyPlannerAnswers;
  flags: StudyPlannerFlags;
  generatedPlan: GeneratedStudyPlan;
}) {
  const { answers, flags, generatedPlan } = params;

  let recommendedWeeklyDays = resolveBaseDays(answers.averageStudyHours);
  let recommendedDailyStudyMinutes = resolveDailyMinutes(answers.averageStudyHours);

  if (answers.examWindow === 'under-1-month') recommendedWeeklyDays += 1;
  if (answers.goal === 'csat' || answers.goal === 'both' || answers.goal === 'gongsi') {
    recommendedWeeklyDays += 1;
    recommendedDailyStudyMinutes += 30;
  }
  if (flags.burnoutRiskFlag) {
    recommendedWeeklyDays = Math.max(4, recommendedWeeklyDays - 1);
    recommendedDailyStudyMinutes = Math.max(120, recommendedDailyStudyMinutes - 30);
  }

  const clampedWeeklyDays = Math.min(7, Math.max(3, recommendedWeeklyDays));
  const arrivalTime = answers.grade.startsWith('high') || answers.grade === 'middle-3' ? '16:00' : '15:00';
  const departureTime = addMinutesToTime(arrivalTime, recommendedDailyStudyMinutes);
  const weekdayPool = [1, 2, 3, 4, 5, 6, 0];

  return {
    recommendedWeeklyDays: clampedWeeklyDays,
    recommendedDailyStudyMinutes,
    recommendedArrivalTime: arrivalTime,
    recommendedDepartureTime: departureTime,
    repeatWeekdays: weekdayPool.slice(0, clampedWeeklyDays),
    weeklyBalance: generatedPlan.weekly_balance,
  } satisfies PlannerSchedulePrefill;
}
