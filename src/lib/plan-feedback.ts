import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

import { type OnboardingAnswer, type StudyPlanItem, type UserStudyProfile } from '@/lib/types';

type PlanFeedbackInput = {
  profile?: UserStudyProfile | null;
  studyTasks: StudyPlanItem[];
  scheduleItems: StudyPlanItem[];
  selectedDate?: Date | null;
};

export type PlanCoachFeedback = {
  dateLabel: string;
  recommendedMinutes: number;
  totalPlannedMinutes: number;
  prioritySubjects: string[];
  includedSubjects: string[];
  strengths: string[];
  suggestions: string[];
  headline: string;
  summary: string;
};

const DAILY_STUDY_MINUTES_MAP: Record<OnboardingAnswer['dailyStudyHours'], number> = {
  '4h': 240,
  '6h': 360,
  '8h': 480,
  '10h': 600,
  '12h-plus': 720,
};

const LONG_BLOCK_MINUTES_MAP: Record<OnboardingAnswer['mainBlockLength'], number> = {
  '90m': 90,
  '120m': 120,
  '150m': 150,
  '180m': 180,
  'long-flex': 150,
};

const SUBJECT_LABEL_MAP: Record<string, string> = {
  kor: '국어',
  math: '수학',
  eng: '영어',
  social: '탐구',
  science: '탐구',
  history: '한국사',
  etc: '기타',
  major: '전공/직렬',
  'admin-law': '법·행정',
};

function normalizeSubjectLabel(value: string) {
  return SUBJECT_LABEL_MAP[value] || value;
}

function resolveTaskMinutes(task: StudyPlanItem) {
  if (task.studyPlanMode === 'time') {
    return Math.max(0, task.targetMinutes || 0);
  }
  if (task.studyPlanMode === 'volume' && task.targetMinutes) {
    return Math.max(0, task.targetMinutes);
  }
  if (task.studyPlanMode === 'volume') {
    return 45;
  }
  return Math.max(0, task.targetMinutes || 0);
}

function isReviewTask(task: StudyPlanItem) {
  const title = task.title?.toLowerCase?.() || '';
  const tag = task.tag?.toLowerCase?.() || '';
  return ['복습', '오답', '회상', '정리', '테스트'].some((keyword) => title.includes(keyword) || tag.includes(keyword));
}

function buildDateLabel(selectedDate?: Date | null) {
  if (!selectedDate) return '오늘';
  return format(selectedDate, 'M월 d일 계획', { locale: ko });
}

export function buildPlanCoachFeedback({
  profile,
  studyTasks,
  scheduleItems,
  selectedDate,
}: PlanFeedbackInput): PlanCoachFeedback | null {
  if (!profile) return null;

  const answers = profile.answers;
  const recommendedMinutes = DAILY_STUDY_MINUTES_MAP[answers.dailyStudyHours] || 480;
  const preferredMainBlockMinutes = LONG_BLOCK_MINUTES_MAP[answers.mainBlockLength] || 150;
  const totalPlannedMinutes = studyTasks.reduce((sum, task) => sum + resolveTaskMinutes(task), 0);
  const includedSubjects = Array.from(
    new Set(
      studyTasks
        .map((task) => task.subject)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map(normalizeSubjectLabel)
    )
  );
  const prioritySubjects = Array.from(
    new Set(
      [...answers.subjectPriority, ...answers.weakSubjects]
        .filter((value) => value && value !== 'none')
        .map(normalizeSubjectLabel)
    )
  );
  const hasReview = studyTasks.some(isReviewTask);
  const longestBlockMinutes = studyTasks.reduce((max, task) => Math.max(max, resolveTaskMinutes(task)), 0);
  const hasArrivalSchedule = scheduleItems.some((item) => item.title.includes('등원 예정'));
  const suggestions: string[] = [];
  const strengths: string[] = [];

  if (studyTasks.length === 0) {
    return {
      dateLabel: buildDateLabel(selectedDate),
      recommendedMinutes,
      totalPlannedMinutes: 0,
      prioritySubjects,
      includedSubjects: [],
      strengths: [],
      suggestions: [
        '먼저 오늘 공부할 과목과 시간부터 적어보세요. 과목 2개와 대략 시간만 있어도 코칭을 더 정확하게 붙일 수 있어요.',
        '우선 과목이나 부담 과목을 하나라도 먼저 넣어두면 뒤로 밀릴 가능성이 줄어요.',
      ],
      headline: '아직 오늘 계획이 비어 있어요',
      summary: '설문 기준은 저장돼 있어요. 이제 직접 적은 계획을 바탕으로 부족한 점과 보강 포인트를 같이 볼 수 있어요.',
    };
  }

  if (totalPlannedMinutes >= recommendedMinutes * 0.85) {
    strengths.push(`총량이 ${Math.round(totalPlannedMinutes / 60)}시간으로 잡혀 있어서 오늘 기준 공부량은 꽤 잘 잡혀 있어요.`);
  } else {
    suggestions.push(`지금 계획은 총 ${Math.round(totalPlannedMinutes / 60)}시간 정도라 기준보다 조금 가벼워요. 가능하면 ${Math.max(30, recommendedMinutes - totalPlannedMinutes)}분 정도를 더 보태보세요.`);
  }

  const missingPrioritySubjects = prioritySubjects.filter((subject) => !includedSubjects.includes(subject));
  if (missingPrioritySubjects.length === 0 && prioritySubjects.length > 0) {
    strengths.push(`우선 과목 ${prioritySubjects.join(', ')}이 오늘 계획에 들어가 있어서 방향은 잘 잡혀 있어요.`);
  } else if (missingPrioritySubjects.length > 0) {
    suggestions.push(`우선 과목 ${missingPrioritySubjects.join(', ')}이 오늘 계획에 아직 없어요. 짧게라도 먼저 넣어두면 밀림이 줄어요.`);
  }

  if (hasReview) {
    strengths.push('복습/오답 성격의 블록이 같이 들어가 있어서 오늘 한 공부를 그냥 흘리지 않게 잡고 있어요.');
  } else {
    suggestions.push('마지막에 복습이나 오답 정리 20~30분을 하나 넣어두면 같은 시간을 써도 남는 게 더 많아져요.');
  }

  if (longestBlockMinutes >= preferredMainBlockMinutes) {
    strengths.push(`가장 긴 블록이 ${Math.round(longestBlockMinutes / 60)}시간 정도라, 평소 선호하는 긴 공부 흐름과도 잘 맞아요.`);
  } else {
    suggestions.push(`지금은 계획이 조금 잘게 쪼개져 있어요. 핵심 과목 하나는 ${Math.round(preferredMainBlockMinutes / 60)}시간 안팎의 메인 블록으로 묶어보면 더 안정적일 수 있어요.`);
  }

  if (!hasArrivalSchedule) {
    suggestions.push('등원 예정 시간도 같이 적어두면 오늘 공부 시작이 늦어지는 패턴을 줄이는 데 도움이 돼요.');
  }

  if (answers.planBreakReason === 'subject-imbalance' && includedSubjects.length <= 1) {
    suggestions.push('지금은 한 과목 쏠림이 커 보여요. 오늘 안에 유지 과목 하나를 짧게라도 넣어두면 밸런스가 덜 무너져요.');
  }

  if (answers.planBreakReason === 'finish-gap' && totalPlannedMinutes > 0 && totalPlannedMinutes < recommendedMinutes) {
    suggestions.push('끝까지 못 지키는 패턴이 있다면 마지막 1블록은 욕심내지 말고 짧은 마무리 블록으로 두는 편이 더 좋아요.');
  }

  return {
    dateLabel: buildDateLabel(selectedDate),
    recommendedMinutes,
    totalPlannedMinutes,
    prioritySubjects,
    includedSubjects,
    strengths: strengths.slice(0, 3),
    suggestions: suggestions.slice(0, 4),
    headline: suggestions.length === 0 ? '오늘 계획 흐름이 꽤 안정적으로 잡혀 있어요' : '오늘 계획에 몇 가지만 보강하면 더 좋아질 것 같아요',
    summary:
      suggestions.length === 0
        ? '설문에서 잡힌 공부 패턴과 오늘 적은 계획이 크게 어긋나지 않아요. 그대로 실행하면서 끝나고 짧게 점검만 붙이면 좋아요.'
        : '설문에서 잡힌 공부 패턴을 기준으로 보면, 총량·과목 배치·복습 흐름 중 몇 군데를 조금만 손보면 더 현실적인 계획이 될 수 있어요.',
  };
}
