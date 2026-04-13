export type ChartInsight = {
  trend: string;
  growth: string;
  improve: string;
};

export type StudentGrowthSummaryTone = 'good' | 'steady' | 'recovery';

export type StudentGrowthSummary = {
  tone: StudentGrowthSummaryTone;
  statusLabel: string;
  statusSummary: string;
  strengthTitle: string;
  strengthDetail: string;
  weaknessTitle: string;
  weaknessDetail: string;
  growthTitle: string;
  growthDetail: string;
  coachNote: string;
};

const EMPTY_INSIGHT: ChartInsight = {
  trend: '아직 분석할 데이터가 부족합니다.',
  growth: '최근 7~14일 학습 로그가 쌓이면 성장 추세를 더 정확하게 볼 수 있습니다.',
  improve: '등원 후 첫 공부 시작 시간과 일일 학습 시간을 먼저 안정적으로 기록해 주세요.',
};

function safeAvg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toSignedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${Math.round(value)}%`;
}

function formatMinutesLabel(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

export function buildStudentGrowthSummary(input: {
  data: Array<{ totalMinutes: number }>;
  weekDiffPct: number;
  maxStreak: number;
  completionRate: number;
  avgMinutes: number;
  studyDays: number;
}): StudentGrowthSummary {
  const values = input.data.map((item) => Math.max(0, Math.round(item.totalMinutes || 0)));
  const blankDays = values.filter((value) => value === 0).length;
  const avgMinutes = Math.max(0, Math.round(input.avgMinutes));
  const completionRate = Math.max(0, Math.round(input.completionRate));
  const weekDiffPct = Math.round(input.weekDiffPct);
  const studyDays = Math.max(0, Math.round(input.studyDays));
  const maxStreak = Math.max(0, Math.round(input.maxStreak));

  const tone: StudentGrowthSummaryTone =
    blankDays >= 3 || weekDiffPct <= -20
      ? 'recovery'
      : weekDiffPct >= 10 || maxStreak >= 5 || completionRate >= 85
        ? 'good'
        : 'steady';

  const statusLabel =
    tone === 'good' ? '좋은 흐름' : tone === 'recovery' ? '복구 필요' : '유지 중';

  const statusSummary =
    tone === 'good'
      ? `최근 흐름이 올라오고 있어요. 지금 패턴을 유지하면 이번 주도 안정적으로 쌓일 가능성이 높아요.`
      : tone === 'recovery'
        ? `좋은 날도 있었지만 흐름이 끊긴 날이 보여요. 이번 주는 다시 이어 붙이는 데 집중하면 돼요.`
        : `기본 흐름은 유지되고 있어요. 작은 보완 하나만 더하면 성장 속도가 더 분명해질 수 있어요.`;

  const strength =
    completionRate >= 85
      ? {
          title: '잘하고 있어요',
          detail: `시작한 공부를 끝까지 가져가는 힘이 좋아요. 최근 완료율이 ${completionRate}%예요.`,
        }
      : maxStreak >= 4
        ? {
            title: '잘하고 있어요',
            detail: `${maxStreak}일 연속으로 기록을 이어가고 있어요. 꾸준함이 가장 큰 강점이에요.`,
          }
        : weekDiffPct >= 10
          ? {
              title: '잘하고 있어요',
              detail: `지난주보다 공부시간이 ${Math.abs(weekDiffPct)}% 늘었어요. 성장 방향은 분명히 맞아요.`,
            }
          : avgMinutes >= 120
            ? {
                title: '잘하고 있어요',
                detail: `최근 14일 평균이 ${formatMinutesLabel(avgMinutes)}이에요. 기본 공부량이 꽤 잘 잡혀 있어요.`,
              }
            : {
                title: '잘하고 있어요',
                detail: `${studyDays}일의 기록이 쌓였어요. 아직 초반이지만 학습 리듬을 만드는 중이에요.`,
              };

  const weakness =
    blankDays > 0
      ? {
          title: '보완 포인트',
          detail: `최근 14일 중 기록이 비어 있는 날이 ${blankDays}일 있어요. 빈 날부터 줄이면 그래프가 훨씬 안정돼요.`,
        }
      : weekDiffPct < 0
        ? {
            title: '보완 포인트',
            detail: `지난주보다 공부시간이 ${Math.abs(weekDiffPct)}% 줄었어요. 이번 주는 다시 기본 공부량을 회복하는 게 먼저예요.`,
          }
        : completionRate < 70
          ? {
              title: '보완 포인트',
              detail: `계획을 끝까지 마무리하는 힘을 조금 더 키워볼 차례예요. 완료율 ${completionRate}%를 80% 이상으로 올려보세요.`,
            }
          : avgMinutes < 90
            ? {
                title: '보완 포인트',
                detail: `하루 기본 공부량을 조금만 더 올리면 성장 체감이 빨라질 거예요. 평균 ${formatMinutesLabel(avgMinutes)}에서 시작해보세요.`,
              }
            : {
                title: '보완 포인트',
                detail: `지금은 큰 약점보다 유지력이 중요해요. 잘되는 시간대를 계속 반복해보세요.`,
              };

  const growthDetail =
    weekDiffPct >= 10
      ? `지난주보다 ${Math.abs(weekDiffPct)}% 더 공부했어요. 분명한 상승 구간이에요.`
      : weekDiffPct <= -10
        ? `지난주보다 ${Math.abs(weekDiffPct)}% 줄었어요. 잠깐 주춤했지만 다시 올릴 수 있는 구간이에요.`
        : maxStreak >= 4
          ? `최근 ${maxStreak}일 연속 기록으로 성장 기반이 단단해지고 있어요.`
          : `최근 14일 평균 ${formatMinutesLabel(avgMinutes)}으로 기본 체력이 쌓이는 중이에요.`;

  const coachNote =
    blankDays > 0
      ? '이번 주 목표는 새로운 기술보다 공백일을 없애는 것 하나면 충분해요.'
      : completionRate < 70
        ? '공부 시작보다 마무리까지 가는 힘을 붙이면 성장 체감이 더 빨라질 거예요.'
        : '지금 잘되는 패턴을 같은 시간대에 반복하면 성장 속도가 더 안정됩니다.';

  return {
    tone,
    statusLabel,
    statusSummary,
    strengthTitle: strength.title,
    strengthDetail: strength.detail,
    weaknessTitle: weakness.title,
    weaknessDetail: weakness.detail,
    growthTitle: '성장 정도',
    growthDetail,
    coachNote,
  };
}

export function buildWeeklyStudyInsight(data: Array<{ totalMinutes: number }>): ChartInsight {
  const values = data.map((item) => Math.max(0, Math.round(item.totalMinutes || 0)));
  const valid = values.filter((value) => value > 0);
  if (valid.length < 2) return EMPTY_INSIGHT;

  const first = valid[0];
  const last = valid[valid.length - 1];
  const avg = Math.round(safeAvg(valid));
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
  const peak = Math.max(...valid);
  const low = Math.min(...valid);
  const volatilityPct = avg > 0 ? ((peak - low) / avg) * 100 : 0;

  return {
    trend:
      changePct >= 10
        ? `주간 누적 학습시간이 상승 흐름입니다 (${toSignedPercent(changePct)}).`
        : changePct <= -10
          ? `주간 누적 학습시간이 하락 흐름입니다 (${toSignedPercent(changePct)}).`
          : `주간 누적 학습시간이 큰 변동 없이 유지되고 있습니다 (${toSignedPercent(changePct)}).`,
    growth: `최근 주간 평균은 약 ${Math.round(avg / 60)}시간이며, 최고-최저 격차는 ${Math.round(Math.max(0, peak - low) / 60)}시간입니다.`,
    improve:
      volatilityPct >= 35
        ? '주간 편차가 큰 편입니다. 요일별 최소 공부시간 하한선을 정해 변동 폭을 줄여보세요.'
        : '현재 리듬을 유지하면서 주 1회 30분만 추가해도 성장 곡선을 더 가파르게 만들 수 있습니다.',
  };
}

export function buildDailyStudyInsight(data: Array<{ minutes: number }>): ChartInsight {
  const values = data.map((item) => Math.max(0, Math.round(item.minutes || 0)));
  const valid = values.filter((value) => value > 0);
  if (valid.length < 2) return EMPTY_INSIGHT;

  const first = valid[0];
  const last = valid[valid.length - 1];
  const avg = Math.round(safeAvg(valid));
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
  const recent3 = valid.slice(-3);
  const recent3Avg = Math.round(safeAvg(recent3));

  return {
    trend:
      changePct >= 8
        ? `일간 학습시간이 완만한 증가세입니다 (${toSignedPercent(changePct)}).`
        : changePct <= -8
          ? `일간 학습시간이 감소세입니다 (${toSignedPercent(changePct)}).`
          : `일간 학습시간이 횡보 구간입니다 (${toSignedPercent(changePct)}).`,
    growth: `최근 3일 평균은 ${Math.round(recent3Avg / 60)}시간 ${recent3Avg % 60}분, 전체 7일 평균은 ${Math.round(avg / 60)}시간입니다.`,
    improve:
      last < avg
        ? '최근 값이 평균보다 낮습니다. 오늘은 시작 30분을 가장 어려운 과목으로 고정해 반등을 만들어 보세요.'
        : '좋은 흐름입니다. 같은 시작 시간대를 유지하면 리듬 점수도 함께 올라갈 가능성이 큽니다.',
  };
}

export function buildRhythmInsight(data: Array<{ score: number }>): ChartInsight {
  const values = data.map((item) => Math.max(0, Math.round(item.score || 0))).filter((value) => value > 0);
  if (values.length < 2) return EMPTY_INSIGHT;

  const first = values[0];
  const last = values[values.length - 1];
  const avg = Math.round(safeAvg(values));
  const change = last - first;

  return {
    trend:
      change >= 5
        ? `학습 리듬 안정성이 개선되고 있습니다 (${change >= 0 ? '+' : ''}${change}점).`
        : change <= -5
          ? `학습 리듬 안정성이 흔들리고 있습니다 (${change >= 0 ? '+' : ''}${change}점).`
          : `학습 리듬 점수는 비교적 안정적입니다 (${change >= 0 ? '+' : ''}${change}점).`,
    growth: `최근 평균 리듬 점수는 ${avg}점이며, 리듬 점수가 80점 이상이면 학습 지속성이 높아지는 경향이 있습니다.`,
    improve:
      avg < 70
        ? '공부 시작 시각 오차를 30분 이내로 맞추면 리듬 점수 개선에 가장 효과적입니다.'
        : '현재 리듬이 좋습니다. 주말에도 평일과 비슷한 시작 시각을 유지하면 안정성이 더 높아집니다.',
  };
}

export function buildStartEndInsight(
  data: Array<{ startMinutes: number; endMinutes: number }>
): ChartInsight {
  const starts = data.map((item) => item.startMinutes).filter((value) => value > 0);
  const ends = data.map((item) => item.endMinutes).filter((value) => value > 0);
  if (!starts.length || !ends.length) return EMPTY_INSIGHT;

  const startAvg = Math.round(safeAvg(starts));
  const endAvg = Math.round(safeAvg(ends));
  const startSpread = Math.max(...starts) - Math.min(...starts);

  const startAvgHour = `${String(Math.floor(startAvg / 60)).padStart(2, '0')}:${String(startAvg % 60).padStart(2, '0')}`;
  const endAvgHour = `${String(Math.floor(endAvg / 60)).padStart(2, '0')}:${String(endAvg % 60).padStart(2, '0')}`;

  return {
    trend: `평균 시작 시각은 ${startAvgHour}, 평균 종료 시각은 ${endAvgHour}입니다.`,
    growth: `시작 시각 변동 폭은 약 ${Math.round(startSpread / 60)}시간 ${startSpread % 60}분입니다.`,
    improve:
      startSpread > 120
        ? '시작 시각 편차가 큽니다. 평일 기준 고정 시작 알람 1개를 만들어 편차를 줄여보세요.'
        : '시작 리듬이 안정적입니다. 종료 시각도 30분 내로 고정하면 수면-학습 루틴이 더 좋아집니다.',
  };
}

export function buildAwayTimeInsight(data: Array<{ awayMinutes: number }>): ChartInsight {
  const values = data.map((item) => Math.max(0, Math.round(item.awayMinutes || 0)));
  if (!values.length) return EMPTY_INSIGHT;

  const avg = Math.round(safeAvg(values));
  const last = values[values.length - 1] || 0;
  const prev = values.length > 1 ? values[values.length - 2] : 0;
  const diff = last - prev;

  return {
    trend:
      diff > 0
        ? `최근 외출시간이 직전 대비 ${diff}분 늘었습니다.`
        : diff < 0
          ? `최근 외출시간이 직전 대비 ${Math.abs(diff)}분 줄었습니다.`
          : '최근 외출시간은 직전과 유사합니다.',
    growth: `최근 평균 외출시간은 ${avg}분입니다. 일반적으로 20분 이하일 때 집중 유지에 유리합니다.`,
    improve:
      avg > 25
        ? '외출 전환 구간을 줄이기 위해 쉬는 시간을 1회 5~10분으로 짧게 쪼개 보세요.'
        : '외출시간 관리가 양호합니다. 쉬는 시간 시작/종료 시각만 기록하면 더 정밀한 코칭이 가능합니다.',
  };
}

export function buildSubjectInsight(data: Array<{ subject: string; minutes: number }>): ChartInsight {
  const valid = data
    .map((item) => ({ subject: item.subject, minutes: Math.max(0, Math.round(item.minutes || 0)) }))
    .filter((item) => item.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  if (!valid.length) return EMPTY_INSIGHT;

  const total = valid.reduce((sum, item) => sum + item.minutes, 0);
  const top = valid[0];
  const topRatio = total > 0 ? Math.round((top.minutes / total) * 100) : 0;
  const runner = valid[1];

  return {
    trend: `현재 학습 비중 1순위는 ${top.subject} (${topRatio}%)입니다.`,
    growth: runner
      ? `${top.subject} 다음으로는 ${runner.subject} 비중이 높아 과목 축이 2개로 형성되어 있습니다.`
      : `${top.subject} 단일 과목 중심 학습 패턴입니다.`,
    improve:
      topRatio >= 55
        ? `과목 편중이 큰 편입니다. ${top.subject} 학습시간의 15~20%를 보완 과목으로 분산하면 균형이 좋아집니다.`
        : '과목 분배가 비교적 균형적입니다. 주간 목표 대비 부족 과목만 소폭 보강해 주세요.',
  };
}
