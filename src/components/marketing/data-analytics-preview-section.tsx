import Link from 'next/link';
import { AlertTriangle, ArrowRight, LineChart } from 'lucide-react';

const trendLabels = ['3/2', '3/4', '3/6', '3/8', '3/10', '3/12', '3/14', '3/16'];
const studyHours = [6.1, 6.5, 7.2, 8.4, 9.8, 11.6, 13.1, 14.4];
const goalRates = [52, 54, 57, 64, 69, 76, 80, 83];

const summaryMetrics = [
  {
    label: '주간 학습 시간',
    value: '14시간 23분',
    detail: '지난 7일 누적 기준으로 가장 먼저 보는 체류 시간입니다.',
  },
  {
    label: '평균 목표 달성률',
    value: '83%',
    detail: '계획 대비 실행률이 함께 회복되는지 같은 기간으로 비교합니다.',
  },
];

const signalItems = ['미제출', '하락 추세', '생활 리듬'];

const CHART = {
  width: 620,
  height: 264,
  padLeft: 44,
  padRight: 120,
  padTop: 28,
  padBottom: 42,
  maxStudy: 16,
  maxRate: 100,
};

type Point = {
  x: number;
  y: number;
};

function getSeriesPoints(values: number[], maxValue: number): Point[] {
  const plotWidth = CHART.width - CHART.padLeft - CHART.padRight;
  const plotHeight = CHART.height - CHART.padTop - CHART.padBottom;
  const lastIndex = Math.max(values.length - 1, 1);

  return values.map((value, index) => ({
    x: CHART.padLeft + (plotWidth / lastIndex) * index,
    y: CHART.padTop + plotHeight - (value / maxValue) * plotHeight,
  }));
}

function toPolyline(points: Point[]) {
  return points.map(({ x, y }) => `${x},${y}`).join(' ');
}

function TrendChart() {
  const studyPoints = getSeriesPoints(studyHours, CHART.maxStudy);
  const goalPoints = getSeriesPoints(goalRates, CHART.maxRate);
  const plotBottom = CHART.height - CHART.padBottom;
  const studyLastPoint = studyPoints[studyPoints.length - 1]!;
  const goalLastPoint = goalPoints[goalPoints.length - 1]!;

  return (
    <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="h-[248px] w-full" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => {
        const y = CHART.padTop + index * ((plotBottom - CHART.padTop) / 3);
        return (
          <line
            key={index}
            x1={CHART.padLeft}
            y1={y}
            x2={CHART.width - CHART.padRight}
            y2={y}
            stroke="rgba(20,41,95,0.12)"
            strokeDasharray="4 8"
          />
        );
      })}

      <text x={CHART.padLeft} y="16" fontSize="12" fontWeight="700" fill="#425A75">
        공부시간 (h)
      </text>
      <text x={CHART.width - CHART.padRight} y="16" fontSize="12" fontWeight="700" fill="#8A4B0F">
        목표 달성률 (%)
      </text>

      <polyline
        fill="rgba(20,41,95,0.05)"
        stroke="none"
        points={`${toPolyline(studyPoints)} ${studyLastPoint.x},${plotBottom} ${CHART.padLeft},${plotBottom}`}
      />
      <polyline
        fill="none"
        stroke="#14295F"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={toPolyline(studyPoints)}
      />
      <polyline
        fill="none"
        stroke="#FF7A16"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={toPolyline(goalPoints)}
      />

      {studyPoints.map((point) => (
        <circle key={`study-${point.x}`} cx={point.x} cy={point.y} r="4.5" fill="#14295F" />
      ))}
      {goalPoints.map((point) => (
        <circle key={`goal-${point.x}`} cx={point.x} cy={point.y} r="4.5" fill="#FF7A16" />
      ))}

      <g transform={`translate(${studyLastPoint.x + 14} ${studyLastPoint.y - 12})`}>
        <rect width="86" height="26" rx="13" fill="#EEF3FF" />
        <text x="12" y="17" fontSize="12" fontWeight="700" fill="#14295F">
          공부시간 14.4h
        </text>
      </g>

      <g transform={`translate(${goalLastPoint.x + 14} ${goalLastPoint.y - 12})`}>
        <rect width="88" height="26" rx="13" fill="#FFF3E8" />
        <text x="12" y="17" fontSize="12" fontWeight="700" fill="#B55200">
          달성률 83%
        </text>
      </g>

      {trendLabels.map((label, index) => (
        <text
          key={label}
          x={studyPoints[index]?.x ?? CHART.padLeft}
          y={CHART.height - 10}
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill="#5D7189"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

export function DataAnalyticsPreviewSection() {
  return (
    <section id="data-approach" className="scroll-mt-28 bg-[#F7F9FD] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="eyebrow-badge">DATA DRIVEN</span>
          <h2 className="font-aggro-display mt-4 break-keep text-[clamp(2rem,4.6vw,3rem)] font-black leading-[1.06] text-[#14295F]">
            많이 보여주기보다 바로 읽히는
            <br />
            데이터만 남겼습니다
          </h2>
          <p className="mt-4 break-keep text-[15px] font-bold leading-[1.8] text-[#2F4662] sm:text-[15.5px]">
            결과를 늘어놓기보다, 같은 기간의 공부시간과 목표 달성률을 먼저 보고 어디서 개입해야 하는지 바로 읽게
            구성했습니다.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.18fr_0.82fr]">
          <article className="rounded-[1.6rem] border border-[#14295F]/10 bg-white p-5 shadow-[0_12px_30px_rgba(20,41,95,0.08)] sm:p-6">
            <div className="flex items-center gap-2">
              <LineChart className="h-4 w-4 text-[#14295F]" />
              <p className="text-[1.05rem] font-black text-[#14295F]">같은 기간 흐름에서 먼저 읽는 신호</p>
            </div>
            <p className="mt-3 break-keep text-[14px] font-semibold leading-[1.72] text-[#425A75]">
              공부시간과 목표 달성률을 겹쳐 보면, 좋아지는 구간과 먼저 손봐야 할 구간이 한 번에 드러납니다.
            </p>

            <div className="mt-4">
              <TrendChart />
            </div>

            <div className="mt-4 rounded-[1.1rem] border border-[#14295F]/10 bg-[#F8FBFF] px-4 py-4">
              <p className="text-[12px] font-bold text-[#425A75]">읽는 포인트</p>
              <p className="mt-1.5 break-keep text-[14px] font-semibold leading-[1.7] text-[#14295F]">
                기록이 늘어난 주간부터 달성률도 함께 회복되는지를 먼저 확인하고, 꺾이는 시점에서 바로 개입합니다.
              </p>
            </div>
          </article>

          <div className="space-y-4">
            {summaryMetrics.map((metric) => (
              <article
                key={metric.label}
                className="rounded-[1.4rem] border border-[#14295F]/10 bg-white px-5 py-5 shadow-[0_10px_24px_rgba(20,41,95,0.06)]"
              >
                <p className="text-[12px] font-bold text-[#425A75]">{metric.label}</p>
                <p className="dashboard-number mt-2 text-[1.9rem] text-[#14295F]">{metric.value}</p>
                <p className="mt-2 break-keep text-[14px] font-semibold leading-[1.65] text-[#5A6E85]">{metric.detail}</p>
              </article>
            ))}

            <article className="rounded-[1.4rem] border border-[#FF7A16]/18 bg-[#FFF6ED] px-5 py-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#FF7A16]" />
                <p className="text-[13px] font-black text-[#B55200]">먼저 개입할 신호</p>
              </div>
              <p className="mt-3 break-keep text-[14px] font-semibold leading-[1.7] text-[#6D5A48]">
                점수 자체보다 먼저 행동이 필요한 신호만 따로 분리해 관리가 길어지지 않게 만듭니다.
              </p>
              <ul className="mt-4 space-y-2.5">
                {signalItems.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[14px] font-bold text-[#7A5327]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FF7A16]" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>

        <article className="mt-6 rounded-[1.45rem] border border-[#14295F]/10 bg-white px-5 py-5 shadow-[0_10px_24px_rgba(20,41,95,0.05)] sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[12px] font-bold text-[#FF7A16]">NEXT VIEW</p>
              <p className="mt-1.5 break-keep text-[1.05rem] font-black leading-[1.42] text-[#14295F]">
                같은 신호를 누가 어떻게 읽는지는 아래 역할별 화면에서 이어집니다.
              </p>
              <p className="mt-2 break-keep text-[14px] font-semibold leading-[1.7] text-[#52667D]">
                학생은 행동, 학부모는 상태, 운영자는 개입 우선순위를 먼저 보도록 화면 흐름을 나눴습니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="#app" className="premium-cta premium-cta-primary h-11 gap-1.5 px-5 text-sm">
                역할별 화면 이어보기
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/experience" className="premium-cta premium-cta-muted h-11 px-5 text-sm">
                전체 체험 보기
              </Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
