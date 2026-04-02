import {
  type BreakRule,
  type DistractionRule,
  type OnboardingAnswer,
  type RecommendationFeedback,
  type RecommendedStudyPlan,
  type ReviewRule,
  type StudyBlock,
  type StudyPlanArchetype,
  type StudyPlanTemplate,
  type SubjectAllocation,
} from '@/lib/types';
import { generatePlanRecommendationReasons } from '@/lib/study-plan/generate-plan-recommendation-reasons';
import { getSubjectOption } from '@/lib/study-plan/study-plan-subjects';
import { STUDY_PLAN_RECOMMENDATION_COPY } from '@/lib/study-plan/study-plan-recommendation-config';

export type StudyPlanCustomizationDraft = {
  totalStudyMinutes?: number;
  mainBlockMinutes?: 120 | 150 | 180;
  breakMinutes?: 20 | 30;
  prioritySubject?: string;
};

const HALF_HOUR = 30;

function roundToThirty(minutes: number) {
  return Math.max(HALF_HOUR, Math.round(minutes / HALF_HOUR) * HALF_HOUR);
}

function formatMinutesAsHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours}시간`;
  return `${hours}시간 ${remainingMinutes}분`;
}

function formatClock(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function addMinutes(time: string, minutesToAdd: number) {
  const [hourString, minuteString] = time.split(':');
  const hour = Number(hourString);
  const minute = Number(minuteString);
  const total = hour * 60 + minute + minutesToAdd;
  const next = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  return formatClock(next);
}

function resolveStartTime(focusPeak: OnboardingAnswer['focusPeak']) {
  if (focusPeak === 'morning') return '06:30';
  if (focusPeak === 'late-morning') return '09:00';
  if (focusPeak === 'afternoon') return '13:00';
  if (focusPeak === 'evening') return '17:30';
  if (focusPeak === 'night') return '20:30';
  return '09:00';
}

export function resolveDailyStudyMinutes(dailyStudyHours: OnboardingAnswer['dailyStudyHours']) {
  if (dailyStudyHours === '4h') return 240;
  if (dailyStudyHours === '6h') return 360;
  if (dailyStudyHours === '8h') return 480;
  if (dailyStudyHours === '10h') return 600;
  return 720;
}

export function resolveMainBlockMinutes(mainBlockLength: OnboardingAnswer['mainBlockLength']) {
  if (mainBlockLength === '150m' || mainBlockLength === 'long-flex') return 150;
  if (mainBlockLength === '180m') return 180;
  return 120;
}

export function resolveBreakMinutes(breakPreference: OnboardingAnswer['breakPreference']) {
  if (breakPreference === '30' || breakPreference === '40+') return 30;
  return 20;
}

function resolveExploreSubjectId(answers: OnboardingAnswer) {
  if (answers.subjectPriority.includes('science') || answers.weakSubjects.includes('science')) return 'science';
  if (answers.subjectPriority.includes('social') || answers.weakSubjects.includes('social')) return 'social';
  return 'social';
}

function pickPrioritySubjects(answers: OnboardingAnswer, draft?: StudyPlanCustomizationDraft) {
  const picked = [
    ...(draft?.prioritySubject ? [draft.prioritySubject] : []),
    ...answers.subjectPriority,
    ...answers.weakSubjects.filter((value) => value !== 'none'),
  ].filter((value, index, array) => Boolean(value) && array.indexOf(value) === index);

  if (answers.learnerType === 'gongsi') {
    return [picked[0] || 'major', picked[1] || 'admin-law', picked[2] || 'eng'];
  }

  return [
    picked[0] || 'math',
    picked[1] || 'kor',
    picked[2] || resolveExploreSubjectId(answers),
  ];
}

function rebalanceAllocations(allocations: Array<Omit<SubjectAllocation, 'ratio' | 'hoursLabel'>>, totalMinutes: number): SubjectAllocation[] {
  const total = allocations.reduce((sum, item) => sum + item.minutes, 0) || 1;
  const scaled = allocations.map((item, index) => {
    const isLast = index === allocations.length - 1;
    if (isLast) return item;
    return {
      ...item,
      minutes: roundToThirty((item.minutes / total) * totalMinutes),
    };
  });
  const used = scaled.slice(0, -1).reduce((sum, item) => sum + item.minutes, 0);
  const last = scaled[scaled.length - 1];
  const final = scaled.length
    ? [...scaled.slice(0, -1), { ...last, minutes: Math.max(HALF_HOUR, totalMinutes - used) }]
    : [];

  return final.map((item) => ({
    ...item,
    ratio: totalMinutes > 0 ? item.minutes / totalMinutes : 0,
    hoursLabel: formatMinutesAsHours(item.minutes),
  }));
}

function buildAllocationTemplate(
  archetypeId: StudyPlanArchetype['id'],
  answers: OnboardingAnswer,
  totalMinutes: number,
  draft?: StudyPlanCustomizationDraft
): SubjectAllocation[] {
  const [primarySubjectId, secondarySubjectId, tertiarySubjectId] = pickPrioritySubjects(answers, draft);
  const exploreSubjectId = resolveExploreSubjectId(answers);
  const primary = getSubjectOption(primarySubjectId);
  const secondary = getSubjectOption(secondarySubjectId);
  const tertiary = getSubjectOption(tertiarySubjectId);
  const explore = getSubjectOption(exploreSubjectId);

  const templateMinutes = [
    { subjectId: 'kor', subjectLabel: '국어', minutes: 180, emphasis: 'core' as const, rationale: '수험 기본축 유지' },
    { subjectId: 'math', subjectLabel: '수학', minutes: 240, emphasis: 'core' as const, rationale: '점수 변동 폭이 큰 핵심 과목' },
    { subjectId: 'eng', subjectLabel: '영어', minutes: 60, emphasis: 'maintenance' as const, rationale: '매일 감각 유지' },
    { subjectId: explore.id, subjectLabel: explore.label, minutes: 120, emphasis: 'support' as const, rationale: '탐구 기본 비중 유지' },
  ];

  if (archetypeId === 'hs_balanced_exam') {
    return rebalanceAllocations(templateMinutes, totalMinutes);
  }

  if (archetypeId === 'math_heavy_exam') {
    return rebalanceAllocations(
      [
        { subjectId: 'kor', subjectLabel: '국어', minutes: 150, emphasis: 'support', rationale: '국어 유지' },
        { subjectId: 'math', subjectLabel: '수학', minutes: 270, emphasis: 'core', rationale: '수학 보완 비중 확대' },
        { subjectId: 'eng', subjectLabel: '영어', minutes: 60, emphasis: 'maintenance', rationale: '영어 최소 유지' },
        { subjectId: explore.id, subjectLabel: explore.label, minutes: 120, emphasis: 'support', rationale: '탐구 비중 유지' },
      ],
      totalMinutes
    );
  }

  if (archetypeId === 'korean_math_core') {
    return rebalanceAllocations(
      [
        { subjectId: 'kor', subjectLabel: '국어', minutes: 180, emphasis: 'core', rationale: '국어 체급 유지' },
        { subjectId: 'math', subjectLabel: '수학', minutes: 240, emphasis: 'core', rationale: '수학 핵심 시간 확보' },
        { subjectId: 'eng', subjectLabel: '영어', minutes: 60, emphasis: 'maintenance', rationale: '영어 기본 유지' },
        { subjectId: explore.id, subjectLabel: explore.label, minutes: 90, emphasis: 'support', rationale: '탐구 최소 유지' },
        { subjectId: 'review', subjectLabel: '복습', minutes: 30, emphasis: 'maintenance', rationale: '핵심 과목 회수' },
      ],
      totalMinutes
    );
  }

  if (archetypeId === 'n_susi_intensive') {
    return rebalanceAllocations(
      [
        { subjectId: 'kor', subjectLabel: '국어', minutes: 180, emphasis: 'core', rationale: '국어 실전 감각 유지' },
        { subjectId: 'math', subjectLabel: '수학', minutes: 240, emphasis: 'core', rationale: '수학 장시간 몰입' },
        { subjectId: 'eng', subjectLabel: '영어', minutes: 60, emphasis: 'maintenance', rationale: '영어 감각 유지' },
        { subjectId: explore.id, subjectLabel: explore.label, minutes: 120, emphasis: 'support', rationale: '탐구 누적' },
        { subjectId: 'review', subjectLabel: '복습/오답', minutes: 60, emphasis: 'maintenance', rationale: '오답 회수 마감' },
      ],
      totalMinutes
    );
  }

  if (archetypeId === 'gongsi_standard') {
    return rebalanceAllocations(
      [
        { subjectId: primary.id, subjectLabel: primary.label, minutes: 180, emphasis: 'core', rationale: '핵심 직렬 과목 1' },
        { subjectId: secondary.id, subjectLabel: secondary.label, minutes: 150, emphasis: 'core', rationale: '핵심 직렬 과목 2' },
        { subjectId: tertiary.id, subjectLabel: tertiary.label, minutes: 120, emphasis: 'support', rationale: '보조 과목 유지' },
        { subjectId: 'review', subjectLabel: '복습/회독', minutes: 90, emphasis: 'maintenance', rationale: '회독 흐름 유지' },
      ],
      totalMinutes
    );
  }

  if (archetypeId === 'weak_subject_repair') {
    return rebalanceAllocations(
      [
        { subjectId: primary.id, subjectLabel: primary.label, minutes: 240, emphasis: 'core', rationale: '부담 과목 우선 회복' },
        { subjectId: secondary.id, subjectLabel: secondary.label, minutes: 150, emphasis: 'support', rationale: '두 번째 약점 보강' },
        { subjectId: tertiary.id, subjectLabel: tertiary.label, minutes: 120, emphasis: 'support', rationale: '핵심 보조 과목 유지' },
        { subjectId: 'review', subjectLabel: '복습', minutes: 60, emphasis: 'maintenance', rationale: '같은 날 회수' },
      ],
      totalMinutes
    );
  }

  if (archetypeId === 'volume_recovery') {
    return rebalanceAllocations(
      [
        { subjectId: primary.id, subjectLabel: primary.label, minutes: 150, emphasis: 'core', rationale: '첫 블록 성공 경험' },
        { subjectId: secondary.id, subjectLabel: secondary.label, minutes: 120, emphasis: 'support', rationale: '핵심 과목 유지' },
        { subjectId: tertiary.id, subjectLabel: tertiary.label, minutes: 120, emphasis: 'support', rationale: '한 과목 쏠림 방지' },
        { subjectId: 'review', subjectLabel: '복습', minutes: 60, emphasis: 'maintenance', rationale: '짧은 마감 회수' },
      ],
      totalMinutes
    );
  }

  return rebalanceAllocations(
    [
      { subjectId: primary.id, subjectLabel: primary.label, minutes: 210, emphasis: 'core', rationale: '첫 메인 블록' },
      { subjectId: secondary.id, subjectLabel: secondary.label, minutes: 180, emphasis: 'core', rationale: '두 번째 메인 블록' },
      { subjectId: tertiary.id, subjectLabel: tertiary.label, minutes: 120, emphasis: 'support', rationale: '균형 유지' },
      { subjectId: 'review', subjectLabel: '복습', minutes: 60, emphasis: 'maintenance', rationale: '마감 회수' },
    ],
    totalMinutes
  );
}

function inferBlockKind(subjectId: string, emphasis: SubjectAllocation['emphasis']): StudyBlock['kind'] {
  if (subjectId === 'review') return 'review';
  if (subjectId === 'history' || subjectId === 'social' || subjectId === 'science') return 'memorization';
  if (subjectId === 'math') return 'problem';
  if (emphasis === 'core') return 'focus';
  return 'concept';
}

function buildStudyBlocks(
  allocations: SubjectAllocation[],
  startTime: string,
  mainBlockMinutes: 120 | 150 | 180,
  breakMinutes: 20 | 30,
  answers: OnboardingAnswer
) {
  const blocks: StudyBlock[] = [];
  let cursor = startTime;

  allocations.forEach((allocation, allocationIndex) => {
    let remaining = allocation.minutes;
    let localIndex = 0;
    while (remaining > 0) {
      const preferredLength =
        remaining > mainBlockMinutes ? mainBlockMinutes : remaining >= 90 ? remaining : Math.min(remaining, 90);
      const durationMinutes = roundToThirty(preferredLength);
      const titlePrefix =
        allocation.emphasis === 'core'
          ? `${allocation.subjectLabel} 핵심 블록`
          : allocation.subjectId === 'review'
            ? '복습 회수'
            : `${allocation.subjectLabel} 운영 블록`;
      const instruction =
        allocation.subjectId === 'review'
          ? '오늘 한 내용 중 표시한 문제와 메모만 다시 회수합니다.'
          : allocation.subjectId === 'math'
            ? '실전 감각이 떨어지지 않게 문제풀이와 오답 정리를 함께 가져갑니다.'
            : allocation.emphasis === 'core'
              ? '가장 중요한 범위를 이 블록 안에서 끝낸다는 기준으로 밀어붙입니다.'
              : '메인 과목을 받쳐줄 분량을 정리하고 다음 블록으로 연결합니다.';

      blocks.push({
        id: `${allocation.subjectId}-${allocationIndex}-${localIndex + 1}`,
        title: localIndex === 0 ? titlePrefix : `${allocation.subjectLabel} 이어서`,
        ...(allocation.subjectId === 'review' ? {} : { subjectId: allocation.subjectId }),
        subjectLabel: allocation.subjectLabel,
        kind: inferBlockKind(allocation.subjectId, allocation.emphasis),
        startTime: cursor,
        endTime: addMinutes(cursor, durationMinutes),
        durationMinutes,
        instruction,
        fallbackInstruction:
          answers.planBreakReason === 'late-start'
            ? '시작이 늦어졌다면 같은 과목에서 가장 쉬운 파트만 먼저 끝내고 다음 블록으로 넘어가세요.'
            : '끝까지 다 못 하더라도 가장 중요한 문제나 개념부터 먼저 회수하세요.',
      });

      cursor = addMinutes(cursor, durationMinutes);
      remaining -= durationMinutes;
      localIndex += 1;

      if (remaining > 0 || allocationIndex < allocations.length - 1) {
        cursor = addMinutes(cursor, breakMinutes);
      }
    }
  });

  return blocks;
}

function buildReviewRules(mainBlockMinutes: 120 | 150 | 180): ReviewRule[] {
  return [
    {
      id: 'same-day-review',
      title: '당일 회수',
      timing: `마지막 ${Math.min(60, mainBlockMinutes / 2)}분`,
      description: '그날 표시한 문제와 메모만 다시 보면서 다음 날 첫 블록의 부담을 줄입니다.',
    },
    {
      id: 'next-day-start',
      title: '다음날 첫 블록 연결',
      timing: '다음날 시작 전 10분',
      description: '전날 막힌 포인트 한 줄만 보고 바로 첫 메인 블록으로 들어갑니다.',
    },
  ];
}

function buildDistractionRules(answers: OnboardingAnswer, breakMinutes: 20 | 30): DistractionRule[] {
  const common: DistractionRule[] = [
    {
      id: 'late-start',
      trigger: '시작이 늦어지면',
      response: '첫 블록은 가장 쉬운 단원이나 익숙한 문제 세트로 60~90분만 먼저 시작합니다.',
      fallback: '첫 블록 성공을 만들고 두 번째 블록에서 원래 계획 총량으로 다시 맞춥니다.',
    },
  ];

  if (answers.planBreakReason === 'concentration-drop') {
    common.push({
      id: 'reset-block',
      trigger: '오래 앉아도 집중이 흔들리면',
      response: '자리에서 5분 리셋 후, 같은 과목의 쉬운 문제 3개만 다시 풀어 흐름을 되살립니다.',
      fallback: '그래도 안 붙으면 고난도 문풀 대신 복습 블록으로 전환합니다.',
    });
  } else if (answers.planBreakReason === 'break-overrun') {
    common.push({
      id: 'break-cap',
      trigger: '쉬는 시간이 길어지면',
      response: `${breakMinutes}분 타이머를 켜고, 끝나면 바로 다음 블록 교재를 책상 위에 펼칩니다.`,
      fallback: '복귀가 늦어지면 다음 블록 첫 30분은 가장 쉬운 파트부터 다시 시작합니다.',
    });
  } else if (answers.planBreakReason === 'subject-avoidance') {
    common.push({
      id: 'avoidance',
      trigger: '부담 과목이 자꾸 뒤로 밀리면',
      response: '가장 집중되는 시간대의 첫 블록에 최소 90분이라도 먼저 확보합니다.',
      fallback: '완주가 어렵다면 문제 수를 줄여서라도 첫 블록에 해당 과목을 남깁니다.',
    });
  } else {
    common.push({
      id: 'fatigue-swap',
      trigger: '예상보다 피곤하면',
      response: '고난도 문제풀이 대신 오답 회수나 복습 블록으로 바꿔 흐름을 유지합니다.',
      fallback: '완전히 쉬기보다 난도를 낮춰도 계획 흐름은 끊기지 않게 합니다.',
    });
  }

  return common;
}

function buildDayPreview(allocations: SubjectAllocation[], studyBlocks: StudyBlock[]) {
  const allocationLines = allocations.map((allocation) => `${allocation.subjectLabel} ${allocation.hoursLabel}`);
  const blockExample = studyBlocks
    .slice(0, 4)
    .map((block, index) => `${block.subjectLabel || block.title} ${formatMinutesAsHours(block.durationMinutes)}`)
    .join(' → 휴식 30분 → ');
  return [...allocationLines, `블록 예시: ${blockExample}`];
}

function buildFitStudentSummary(archetype: StudyPlanArchetype, answers: OnboardingAnswer) {
  if (archetype.id === 'gongsi_standard') {
    return `${archetype.fitDescription}. ${answers.dailyStudyHours === '12h-plus' ? '장시간 회독이 가능한 패턴까지 반영했어요.' : '핵심 과목 누적 시간이 끊기지 않게 설계했어요.'}`;
  }
  return archetype.fitDescription;
}

function buildSubjectPlacement(allocations: SubjectAllocation[]) {
  const ordered = allocations.map((allocation) => allocation.subjectLabel).join(' → ');
  return `${ordered} 순으로 두되, 핵심 과목은 앞쪽 블록에 먼저 배치합니다.`;
}

function buildSessionRule(mainBlockMinutes: 120 | 150 | 180) {
  return `${formatMinutesAsHours(mainBlockMinutes)} 메인 블록 중심으로 하루를 운영합니다.`;
}

function buildBreakRuleLabel(breakMinutes: 20 | 30) {
  return `메인 블록 사이에는 ${breakMinutes}분 휴식을 두고, 30분 이상 끌지 않도록 합니다.`;
}

function buildRecommendationFeedback(copy: typeof STUDY_PLAN_RECOMMENDATION_COPY[keyof typeof STUDY_PLAN_RECOMMENDATION_COPY]): RecommendationFeedback {
  return {
    downshift: copy.downshiftCopy,
    upshift: copy.upshiftCopy,
    operatingRules: copy.ruleCopy,
  };
}

export function buildRecommendedStudyPlan(options: {
  archetype: StudyPlanArchetype;
  answers: OnboardingAnswer;
  priority: 1 | 2 | 3;
  draft?: StudyPlanCustomizationDraft;
}): RecommendedStudyPlan {
  const { archetype, answers, priority, draft } = options;
  const copy = STUDY_PLAN_RECOMMENDATION_COPY[archetype.id];
  const totalStudyMinutes = draft?.totalStudyMinutes || resolveDailyStudyMinutes(answers.dailyStudyHours);
  const mainBlockMinutes = draft?.mainBlockMinutes || resolveMainBlockMinutes(answers.mainBlockLength);
  const breakMinutes = draft?.breakMinutes || resolveBreakMinutes(answers.breakPreference);
  const subjectAllocations = buildAllocationTemplate(archetype.id, answers, totalStudyMinutes, draft);
  const startTime = resolveStartTime(answers.focusPeak);
  const studyBlocks = buildStudyBlocks(subjectAllocations, startTime, mainBlockMinutes, breakMinutes, answers);
  const breakRuleDetail: BreakRule = {
    id: `${archetype.id}-break-rule`,
    label: `${breakMinutes}분 휴식`,
    minutes: breakMinutes,
    description: `메인 블록 사이 휴식은 ${breakMinutes}분을 기본으로 두고, 쉬는 시간이 길어지지 않도록 바로 다음 블록 교재를 먼저 펼쳐둡니다.`,
  };
  const reasonEntries = generatePlanRecommendationReasons({
    answers,
    archetype,
    totalStudyMinutes,
    mainBlockMinutes,
    breakMinutes,
  });
  const whyCopy = [...reasonEntries.map((reason) => reason.text), ...copy.whyCopy]
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 4);
  const fitCopy = copy.fitCopy;
  const dayPreview = buildDayPreview(subjectAllocations, studyBlocks);
  const difficulty: RecommendedStudyPlan['difficulty'] =
    totalStudyMinutes >= 660 || mainBlockMinutes === 180 ? 'stretch' : totalStudyMinutes <= 420 ? 'easy' : 'balanced';
  const totalStudyLabel = `총 ${Math.round(totalStudyMinutes / 60)}시간 기준`;
  const blockMeta = mainBlockMinutes === 120 ? '2시간 블록' : mainBlockMinutes === 150 ? '2시간 30분 블록' : '3시간 블록';
  const dayStructureSummary = `${startTime} 시작 · 순공 ${formatMinutesAsHours(totalStudyMinutes)} · 총 ${studyBlocks.length}블록`;

  return {
    id: archetype.id,
    archetypeId: archetype.id,
    priority,
    badge: copy.badge,
    name: copy.title,
    subtitle: copy.subtitle,
    oneLineDescription: copy.subtitle,
    totalStudyMinutes,
    totalStudyLabel,
    blockMeta,
    breakMeta: `휴식 ${breakMinutes}분`,
    typeMeta: copy.typeMeta,
    fitStudent: buildFitStudentSummary(archetype, answers),
    difficulty,
    difficultyLabel: totalStudyLabel,
    recommendationReasons: whyCopy,
    reasonEntries,
    coreStrategies: copy.ruleCopy,
    dayStructureSummary,
    dayPreviewTitle: copy.dayPreviewTitle,
    dayPreview,
    subjectPlacement: buildSubjectPlacement(subjectAllocations),
    subjectAllocations,
    sessionRule: buildSessionRule(mainBlockMinutes),
    breakRule: buildBreakRuleLabel(breakMinutes),
    breakRuleDetail,
    studyBlocks,
    reviewRules: buildReviewRules(mainBlockMinutes),
    distractionRules: buildDistractionRules(answers, breakMinutes),
    downgradeTitle: copy.downshiftTitle,
    downgradeVersion: copy.downshiftCopy,
    upgradeTitle: copy.upshiftTitle,
    upgradeVersion: copy.upshiftCopy,
    fitTitle: copy.fitTitle,
    fitCopy,
    ruleTitle: copy.ruleTitle,
    ruleCopy: copy.ruleCopy,
    whyTitle: copy.whyTitle,
    whyCopy,
    weekendExtension:
      answers.dailyStudyHours === '10h' || answers.dailyStudyHours === '12h-plus'
        ? '주말에는 핵심 과목 심화 블록 1개와 복습 블록 1개를 추가할 수 있어요.'
        : '주말에는 부족한 과목 한 개를 길게 보강하는 방식으로 운영해보세요.',
    recommendationFeedback: buildRecommendationFeedback(copy),
    primaryCta: copy.primaryCta,
    secondaryCta: copy.secondaryCta,
  };
}

export function buildRecommendedStudyPlans(options: {
  answers: OnboardingAnswer;
  rankedArchetypes: Array<{ archetype: StudyPlanArchetype; score: number }>;
  draftByArchetype?: Partial<Record<StudyPlanArchetype['id'], StudyPlanCustomizationDraft>>;
}) {
  const { answers, rankedArchetypes, draftByArchetype } = options;
  return rankedArchetypes.slice(0, 3).map((entry, index) =>
    buildRecommendedStudyPlan({
      answers,
      archetype: entry.archetype,
      priority: (index + 1) as 1 | 2 | 3,
      draft: draftByArchetype?.[entry.archetype.id],
    })
  );
}
