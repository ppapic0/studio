import { type OnboardingAnswer, type StudyPlanArchetype } from '@/lib/types';
import { STUDY_PLAN_ARCHETYPES } from '@/lib/study-plan/study-plan-recommendation-config';

export type ArchetypeScoreEntry = {
  archetype: StudyPlanArchetype;
  score: number;
};

function hasSubject(answer: OnboardingAnswer, subjectId: string) {
  return answer.subjectPriority.includes(subjectId) || answer.weakSubjects.includes(subjectId);
}

export function calculatePlanArchetypeScores(answers: OnboardingAnswer): ArchetypeScoreEntry[] {
  const scores: Record<StudyPlanArchetype['id'], number> = {
    hs_balanced_exam: 0,
    math_heavy_exam: 0,
    korean_math_core: 0,
    n_susi_intensive: 0,
    gongsi_standard: 0,
    weak_subject_repair: 0,
    volume_recovery: 0,
    long_block_stable: 0,
  };

  switch (answers.learnerType) {
    case 'middle_school_core':
      scores.volume_recovery += 12;
      scores.weak_subject_repair += 8;
      break;
    case 'high_school_internal':
      scores.hs_balanced_exam += 12;
      scores.weak_subject_repair += 8;
      scores.long_block_stable += 6;
      break;
    case 'high3_csat':
      scores.hs_balanced_exam += 28;
      scores.korean_math_core += 14;
      scores.long_block_stable += 8;
      break;
    case 'n_susi':
      scores.n_susi_intensive += 34;
      scores.long_block_stable += 14;
      scores.korean_math_core += 8;
      break;
    case 'gongsi':
      scores.gongsi_standard += 38;
      scores.long_block_stable += 10;
      break;
    case 'goal_searching':
      scores.volume_recovery += 16;
      scores.long_block_stable += 8;
      break;
  }

  switch (answers.dailyStudyHours) {
    case '4h':
      scores.volume_recovery += 18;
      break;
    case '6h':
      scores.volume_recovery += 12;
      scores.weak_subject_repair += 6;
      break;
    case '8h':
      scores.hs_balanced_exam += 8;
      scores.long_block_stable += 8;
      break;
    case '10h':
      scores.hs_balanced_exam += 16;
      scores.math_heavy_exam += 8;
      scores.korean_math_core += 8;
      scores.long_block_stable += 10;
      break;
    case '12h-plus':
      scores.n_susi_intensive += 18;
      scores.long_block_stable += 14;
      scores.gongsi_standard += 8;
      break;
  }

  switch (answers.mainBlockLength) {
    case '90m':
      scores.volume_recovery += 10;
      break;
    case '120m':
      scores.hs_balanced_exam += 8;
      scores.long_block_stable += 8;
      break;
    case '150m':
      scores.long_block_stable += 12;
      scores.n_susi_intensive += 8;
      break;
    case '180m':
      scores.n_susi_intensive += 18;
      scores.long_block_stable += 14;
      break;
    case 'long-flex':
      scores.long_block_stable += 12;
      scores.n_susi_intensive += 10;
      break;
  }

  if (hasSubject(answers, 'math')) {
    scores.math_heavy_exam += 22;
    scores.korean_math_core += 10;
  }

  if (hasSubject(answers, 'kor') && hasSubject(answers, 'math')) {
    scores.korean_math_core += 18;
  }

  if (answers.weakSubjects.some((subject) => subject !== 'none')) {
    scores.weak_subject_repair += 18;
  }

  if (answers.learnerType === 'gongsi' || hasSubject(answers, 'major') || hasSubject(answers, 'admin-law')) {
    scores.gongsi_standard += 16;
  }

  switch (answers.planBreakReason) {
    case 'too-much-volume':
      scores.volume_recovery += 20;
      break;
    case 'subject-avoidance':
      scores.weak_subject_repair += 16;
      break;
    case 'late-start':
      scores.volume_recovery += 12;
      break;
    case 'concentration-drop':
      scores.long_block_stable += 10;
      break;
    case 'break-overrun':
      scores.long_block_stable += 12;
      break;
    case 'subject-imbalance':
      scores.hs_balanced_exam += 10;
      scores.korean_math_core += 8;
      break;
    case 'finish-gap':
      scores.volume_recovery += 14;
      scores.long_block_stable += 8;
      break;
  }

  switch (answers.planningStyle) {
    case 'time-table':
      scores.hs_balanced_exam += 8;
      scores.korean_math_core += 4;
      break;
    case 'subject-hours':
      scores.hs_balanced_exam += 10;
      scores.gongsi_standard += 10;
      break;
    case 'big-block':
      scores.long_block_stable += 10;
      scores.n_susi_intensive += 8;
      break;
    case 'guided':
      scores.hs_balanced_exam += 6;
      scores.volume_recovery += 4;
      break;
    case 'unknown':
      scores.volume_recovery += 6;
      break;
  }

  if (answers.focusPeak === 'morning' || answers.focusPeak === 'late-morning') {
    scores.korean_math_core += 6;
    scores.weak_subject_repair += 4;
  }

  if (answers.focusPeak === 'evening' || answers.focusPeak === 'night') {
    scores.n_susi_intensive += 4;
    scores.long_block_stable += 4;
  }

  return STUDY_PLAN_ARCHETYPES.map((archetype) => ({
    archetype,
    score: scores[archetype.id],
  })).sort((left, right) => right.score - left.score);
}
