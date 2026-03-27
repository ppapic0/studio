import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Activity, AlertTriangle, ArrowRight, BarChart3, Clock3, LineChart } from 'lucide-react';

import { StaggerChildren } from './stagger-children';

type Point = {
  x: number;
  y: number;
};

type ChartConfig = {
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
  min: number;
  max: number;
};

type LegendTone = 'navy' | 'orange' | 'green' | 'violet' | 'rose';

const chartLabels = ['3/2', '3/4', '3/6', '3/8', '3/10', '3/12', '3/14', '3/16'];

const overviewStudyHours = [5.4, 5.9, 6.5, 7.4, 8.3, 9.6, 10.8, 11.1];
const overviewGoalRates = [61, 64, 67, 74, 79, 86, 90, 93];

const growthHours = [3.1, 4.0, 5.2, 4.8, 6.3, 7.1, 7.5, 7.8];
const growthRates = [8, 14, 23, 18, 31, 40, 44, 46];

const rhythmScores = [74, 77, 83, 81, 87, 90, 89, 92];
const studyStartTimes = [9.1, 8.8, 8.7, 8.5, 8.4, 8.3, 8.2, 8.2];
const studyEndTimes = [23.2, 23.1, 23.1, 23.0, 23.0, 22.9, 23.0, 22.9];
const breakMinutes = [0.6, 0.3, 2.4, 0.2, 0.2, 0.1, 0.1, 0.1];

const heroMetrics = [
  {
    label: '주간 누적 학습',
    value: '14시간 23분',
    detail: '최근 7일 기준',
    tone: 'navy' as const,
  },
  {
    label: '평균 목표 달성률',
    value: '93%',
    detail: '후반부 안정화',
    tone: 'orange' as const,
  },
  {
    label: '리듬 안정도',
    value: '91점',
    detail: '상위권 유지',
    tone: 'green' as const,
  },
];

const LARGE_CHART: ChartConfig = {
  width: 720,
  height: 292,
  padLeft: 28,
  padRight: 28,
  padTop: 24,
  padBottom: 42,
  min: 0,
  max: 100,
};

const MOBILE_LARGE_CHART: ChartConfig = {
  width: 360,
  height: 220,
  padLeft: 16,
  padRight: 14,
  padTop: 18,
  padBottom: 30,
  min: 0,
  max: 100,
};

const MINI_CHART: ChartConfig = {
  width: 520,
  height: 220,
  padLeft: 28,
  padRight: 22,
  padTop: 22,
  padBottom: 34,
  min: 0,
  max: 100,
};

const MOBILE_MINI_CHART: ChartConfig = {
  width: 320,
  height: 184,
  padLeft: 18,
  padRight: 14,
  padTop: 16,
  padBottom: 28,
  min: 0,
  max: 100,
};

function getPlotBottom(config: ChartConfig) {
  return config.height - config.padBottom;
}

function getPlotRight(config: ChartConfig) {
  return config.width - config.padRight;
}

function getSeriesPoints(values: number[], config: ChartConfig): Point[] {
  const plotWidth = getPlotRight(config) - config.padLeft;
  const plotHeight = getPlotBottom(config) - config.padTop;
  const lastIndex = Math.max(values.length - 1, 1);

  return values.map((value, index) => ({
    x: config.padLeft + (plotWidth / lastIndex) * index,
    y:
      config.padTop +
      plotHeight -
      ((value - config.min) / (config.max - config.min || 1)) * plotHeight,
  }));
}

function toPolyline(points: Point[]) {
  return points.map(({ x, y }) => `${x},${y}`).join(' ');
}

function toAreaPolygon(points: Point[], baseline: number) {
  if (!points.length) return '';
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${toPolyline(points)} ${last.x},${baseline} ${first.x},${baseline}`;
}

function formatHourLabel(value: number) {
  const wholeHour = Math.floor(value);
  const minutes = Math.round((value - wholeHour) * 60);
  return `${String(wholeHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getVisibleLabelIndexes(isMobile: boolean) {
  return isMobile ? [0, 2, 4, 6] : chartLabels.map((_, index) => index);
}

function ChartLegend({ label, tone }: { label: string; tone: LegendTone }) {
  const toneClassMap: Record<LegendTone, string> = {
    navy: 'bg-[#EEF3FF] text-[#14295F]',
    orange: 'bg-[#FFF3E8] text-[#B55200]',
    green: 'bg-[#EEF9F5] text-[#0C8F69]',
    violet: 'bg-[#F4EEFF] text-[#6D44C5]',
    rose: 'bg-[#FFF1F4] text-[#C43E68]',
  };

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[8.5px] font-black ${toneClassMap[tone]} sm:px-3 sm:text-[10px]`}>
      {label}
    </span>
  );
}

function DataBadge({ label, tone = 'navy' }: { label: string; tone?: LegendTone }) {
  const toneClassMap: Record<LegendTone, string> = {
    navy: 'border-[#14295F]/10 bg-[#F3F7FF] text-[#425A75]',
    orange: 'border-[#FF7A16]/16 bg-[#FFF5EC] text-[#B55200]',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
  };

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[8.5px] font-black ${toneClassMap[tone]} sm:px-3 sm:text-[10px]`}>
      {label}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: LegendTone;
}) {
  const toneClassMap: Record<LegendTone, string> = {
    navy: 'border-[#14295F]/10 bg-[#F7FAFF]',
    orange: 'border-[#FF7A16]/14 bg-[#FFF7F0]',
    green: 'border-emerald-200 bg-[#F4FBF8]',
    violet: 'border-violet-200 bg-violet-50',
    rose: 'border-rose-200 bg-rose-50',
  };

  return (
    <article
      className={`brand-sheen-panel relative min-w-0 overflow-hidden rounded-[1rem] border px-2.5 py-3 shadow-[0_10px_20px_rgba(20,41,95,0.04)] sm:rounded-[1.2rem] sm:px-4 sm:py-4 ${toneClassMap[tone]}`}
    >
      <div className="brand-glow-drift absolute -right-8 top-0 h-20 w-20 rounded-full bg-[#FFB878]/14 blur-2xl" />
      <div className="relative">
        <p className="text-[8.5px] font-black leading-[1.3] text-[#4D627A] sm:text-[11px]">{label}</p>
        <p className="brand-number-pop dashboard-number mt-1.5 break-keep text-[1rem] text-[#14295F] sm:mt-2 sm:text-[1.7rem]">{value}</p>
        <p className="mt-1 text-[8.5px] font-bold leading-[1.35] text-[#5A6E85] sm:mt-1.5 sm:text-[11px]">{detail}</p>
      </div>
    </article>
  );
}

function ChartPanel({
  icon: Icon,
  title,
  description,
  badge,
  legend,
  footer,
  children,
  className = '',
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  badge: ReactNode;
  legend?: ReactNode;
  footer: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`brand-panel-scan relative min-w-0 overflow-hidden rounded-[1.1rem] border border-[#14295F]/10 bg-white p-3 shadow-[0_14px_30px_rgba(20,41,95,0.08)] sm:rounded-[1.55rem] sm:p-6 ${className}`}
    >
      <div className="brand-glow-drift absolute -left-8 top-5 h-24 w-24 rounded-full bg-[#FF7A16]/8 blur-3xl" />
      <div
        className="brand-glow-drift absolute right-6 top-4 h-28 w-28 rounded-full bg-[#8AB2FF]/10 blur-3xl"
        style={{ animationDelay: '-2.4s' }}
      />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 shrink-0 text-[#14295F] sm:h-4 sm:w-4" />
              <h3 className="break-keep text-[0.86rem] font-black leading-[1.28] text-[#14295F] sm:text-[1.15rem]">{title}</h3>
            </div>
            <p className="mt-1.5 break-keep text-[11px] font-semibold leading-[1.6] text-[#50657D] sm:mt-2 sm:text-[13.5px] sm:leading-[1.68]">{description}</p>
          </div>
          {badge}
        </div>

        {legend ? <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">{legend}</div> : null}

        <div className="mt-3 sm:mt-4">{children}</div>

        <div className="mt-3 rounded-[0.9rem] border border-[#14295F]/10 bg-[#F8FBFF] px-2.5 py-2.5 sm:mt-4 sm:rounded-[1rem] sm:px-4 sm:py-3">
          <p className="break-keep text-[10px] font-semibold leading-[1.55] text-[#425A75] sm:text-[12.5px] sm:leading-[1.62]">{footer}</p>
        </div>
      </div>
    </article>
  );
}

function OverviewTrendChart({ mobile = false }: { mobile?: boolean }) {
  const baseConfig = mobile ? MOBILE_LARGE_CHART : LARGE_CHART;
  const studyConfig = { ...baseConfig, min: 4.5, max: 12 };
  const rateConfig = { ...baseConfig, min: 55, max: 95 };
  const studyPoints = getSeriesPoints(overviewStudyHours, studyConfig);
  const goalPoints = getSeriesPoints(overviewGoalRates, rateConfig);
  const baseline = getPlotBottom(baseConfig);
  const visibleLabelIndexes = getVisibleLabelIndexes(mobile);

  return (
    <svg
      viewBox={`0 0 ${baseConfig.width} ${baseConfig.height}`}
      className={mobile ? 'h-[184px] w-full' : 'h-[245px] w-full sm:h-[270px]'}
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map((index) => {
        const y =
          baseConfig.padTop +
          index * ((getPlotBottom(baseConfig) - baseConfig.padTop) / 3);
        return (
          <line
            key={index}
            x1={baseConfig.padLeft}
            y1={y}
            x2={getPlotRight(baseConfig)}
            y2={y}
            stroke="rgba(20,41,95,0.10)"
            strokeDasharray="4 8"
          />
        );
      })}

      <polygon points={toAreaPolygon(studyPoints, baseline)} fill="rgba(20,41,95,0.05)" />

      <polyline
        className="brand-chart-draw"
        fill="none"
        stroke="#14295F"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={toPolyline(studyPoints)}
        style={{ ['--brand-path-length' as string]: 1000 }}
      />
      <polyline
        className="brand-chart-draw"
        fill="none"
        stroke="#FF7A16"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={toPolyline(goalPoints)}
        style={{ ['--brand-path-length' as string]: 1000, animationDelay: '0.18s' }}
      />

      {studyPoints.map((point) => (
        <circle
          key={`study-${point.x}`}
          className="brand-pulse-dot"
          cx={point.x}
          cy={point.y}
          r="4.5"
          fill="#14295F"
          style={{ animationDelay: `${(point.x % 7) * 0.08}s` }}
        />
      ))}
      {goalPoints.map((point) => (
        <circle
          key={`goal-${point.x}`}
          className="brand-pulse-dot"
          cx={point.x}
          cy={point.y}
          r="4.5"
          fill="#FF7A16"
          style={{ animationDelay: `${(point.x % 5) * 0.1}s` }}
        />
      ))}

      {visibleLabelIndexes.map((index) => (
        <text
          key={chartLabels[index] ?? index}
          x={studyPoints[index]?.x ?? LARGE_CHART.padLeft}
          y={baseConfig.height - (mobile ? 10 : 12)}
          textAnchor="middle"
          fontSize={mobile ? '10' : '12'}
          fontWeight="700"
          fill="#51667D"
        >
          {chartLabels[index]}
        </text>
      ))}
    </svg>
  );
}

function WeeklyGrowthChart({ mobile = false }: { mobile?: boolean }) {
  const baseConfig = mobile ? MOBILE_MINI_CHART : MINI_CHART;
  const barConfig = { ...baseConfig, min: 0, max: 8.5 };
  const lineConfig = { ...baseConfig, min: 0, max: 50 };
  const barPoints = getSeriesPoints(growthHours, barConfig);
  const linePoints = getSeriesPoints(growthRates, lineConfig);
  const baseline = getPlotBottom(baseConfig);
  const visibleLabelIndexes = getVisibleLabelIndexes(mobile);

  return (
    <svg
      viewBox={`0 0 ${baseConfig.width} ${baseConfig.height}`}
      className={mobile ? 'h-[172px] w-full' : 'h-[200px] w-full'}
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map((index) => {
        const y = baseConfig.padTop + index * ((baseline - baseConfig.padTop) / 3);
        return (
          <line
            key={index}
            x1={baseConfig.padLeft}
            y1={y}
            x2={getPlotRight(baseConfig)}
            y2={y}
            stroke="rgba(20,41,95,0.09)"
            strokeDasharray="4 8"
          />
        );
      })}

      {barPoints.map((point, index) => {
        const barWidth = 28;
        return (
          <rect
            key={`bar-${chartLabels[index]}`}
            className="brand-bar-rise"
            x={point.x - barWidth / 2}
            y={point.y}
            width={barWidth}
            height={baseline - point.y}
            rx="8"
            fill="rgba(93, 148, 255, 0.32)"
            style={{ animationDelay: `${index * 0.08}s` }}
          />
        );
      })}

      <polyline
        className="brand-chart-draw"
        fill="none"
        stroke="#18B88A"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={toPolyline(linePoints)}
        style={{ ['--brand-path-length' as string]: 1000, animationDelay: '0.22s' }}
      />

      {linePoints.map((point, index) => (
        <circle
          key={`growth-${point.x}`}
          className="brand-pulse-dot"
          cx={point.x}
          cy={point.y}
          r="4"
          fill="#18B88A"
          style={{ animationDelay: `${index * 0.09}s` }}
        />
      ))}

      {visibleLabelIndexes.map((index) => (
        <text
          key={chartLabels[index] ?? index}
          x={barPoints[index]?.x ?? MINI_CHART.padLeft}
          y={baseConfig.height - 10}
          textAnchor="middle"
          fontSize={mobile ? '10' : '11'}
          fontWeight="700"
          fill="#5B7087"
        >
          {chartLabels[index]}
        </text>
      ))}
    </svg>
  );
}

function RhythmChart({ mobile = false }: { mobile?: boolean }) {
  const baseConfig = mobile ? MOBILE_MINI_CHART : MINI_CHART;
  const rhythmConfig = { ...baseConfig, min: 68, max: 96 };
  const rhythmPoints = getSeriesPoints(rhythmScores, rhythmConfig);
  const baseline = getPlotBottom(baseConfig);
  const visibleLabelIndexes = getVisibleLabelIndexes(mobile);

  return (
    <svg
      viewBox={`0 0 ${baseConfig.width} ${baseConfig.height}`}
      className={mobile ? 'h-[172px] w-full' : 'h-[200px] w-full'}
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map((index) => {
        const y = baseConfig.padTop + index * ((baseline - baseConfig.padTop) / 3);
        return (
          <line
            key={index}
            x1={baseConfig.padLeft}
            y1={y}
            x2={getPlotRight(baseConfig)}
            y2={y}
            stroke="rgba(20,41,95,0.08)"
            strokeDasharray="4 8"
          />
        );
      })}

      <polygon points={toAreaPolygon(rhythmPoints, baseline)} fill="rgba(31, 179, 138, 0.10)" />
      <polyline
        className="brand-chart-draw"
        fill="none"
        stroke="#18B88A"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={toPolyline(rhythmPoints)}
        style={{ ['--brand-path-length' as string]: 1000 }}
      />

      {rhythmPoints.map((point) => (
        <circle
          key={`rhythm-${point.x}`}
          className="brand-pulse-dot"
          cx={point.x}
          cy={point.y}
          r="4"
          fill="#18B88A"
          style={{ animationDelay: `${(point.x % 6) * 0.09}s` }}
        />
      ))}

      {visibleLabelIndexes.map((index) => (
        <text
          key={chartLabels[index] ?? index}
          x={rhythmPoints[index]?.x ?? MINI_CHART.padLeft}
          y={baseConfig.height - 10}
          textAnchor="middle"
          fontSize={mobile ? '10' : '11'}
          fontWeight="700"
          fill="#5B7087"
        >
          {chartLabels[index]}
        </text>
      ))}
    </svg>
  );
}

function StudyWindowChart({ mobile = false }: { mobile?: boolean }) {
  const baseConfig = mobile ? MOBILE_MINI_CHART : MINI_CHART;
  const timeConfig = { ...baseConfig, padLeft: mobile ? 36 : 52, min: 8, max: 24 };
  const startPoints = getSeriesPoints(studyStartTimes, timeConfig);
  const endPoints = getSeriesPoints(studyEndTimes, timeConfig);
  const baseline = getPlotBottom(timeConfig);
  const yTicks = mobile ? [8, 12, 16, 20, 24] : [8, 12, 16, 20, 24];
  const visibleLabelIndexes = getVisibleLabelIndexes(mobile);

  return (
    <svg
      viewBox={`0 0 ${timeConfig.width} ${timeConfig.height}`}
      className={mobile ? 'h-[176px] w-full' : 'h-[200px] w-full'}
      aria-hidden="true"
    >
      {yTicks.map((tick) => {
        const [{ y }] = getSeriesPoints([tick], { ...timeConfig, padRight: timeConfig.width - timeConfig.padLeft });
        return (
          <g key={tick}>
            <line
              x1={timeConfig.padLeft}
              y1={y}
              x2={getPlotRight(timeConfig)}
              y2={y}
              stroke="rgba(20,41,95,0.08)"
              strokeDasharray="4 8"
            />
            <text x={mobile ? '4' : '8'} y={y + 4} fontSize={mobile ? '9.5' : '11'} fontWeight="700" fill="#5B7087">
              {formatHourLabel(tick)}
            </text>
          </g>
        );
      })}

      <polyline
        className="brand-chart-draw"
        fill="none"
        stroke="#3292FF"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={toPolyline(startPoints)}
        style={{ ['--brand-path-length' as string]: 1000 }}
      />
      <polyline
        className="brand-chart-draw"
        fill="none"
        stroke="#8B5CF6"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={toPolyline(endPoints)}
        style={{ ['--brand-path-length' as string]: 1000, animationDelay: '0.2s' }}
      />

      {startPoints.map((point) => (
        <circle
          key={`start-${point.x}`}
          className="brand-pulse-dot"
          cx={point.x}
          cy={point.y}
          r="4"
          fill="#3292FF"
          style={{ animationDelay: `${(point.x % 8) * 0.07}s` }}
        />
      ))}
      {endPoints.map((point) => (
        <circle
          key={`end-${point.x}`}
          className="brand-pulse-dot"
          cx={point.x}
          cy={point.y}
          r="4"
          fill="#8B5CF6"
          style={{ animationDelay: `${(point.x % 9) * 0.06}s` }}
        />
      ))}

      {visibleLabelIndexes.map((index) => (
        <text
          key={chartLabels[index] ?? index}
          x={startPoints[index]?.x ?? timeConfig.padLeft}
          y={timeConfig.height - 10}
          textAnchor="middle"
          fontSize={mobile ? '10' : '11'}
          fontWeight="700"
          fill="#5B7087"
        >
          {chartLabels[index]}
        </text>
      ))}
    </svg>
  );
}

function BreakTimeChart({ mobile = false }: { mobile?: boolean }) {
  const baseConfig = mobile ? MOBILE_MINI_CHART : MINI_CHART;
  const breakConfig = { ...baseConfig, min: 0, max: 3 };
  const breakPoints = getSeriesPoints(breakMinutes, breakConfig);
  const baseline = getPlotBottom(breakConfig);
  const visibleLabelIndexes = getVisibleLabelIndexes(mobile);

  return (
    <svg
      viewBox={`0 0 ${breakConfig.width} ${breakConfig.height}`}
      className={mobile ? 'h-[172px] w-full' : 'h-[200px] w-full'}
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map((index) => {
        const y = breakConfig.padTop + index * ((baseline - breakConfig.padTop) / 3);
        return (
          <line
            key={index}
            x1={breakConfig.padLeft}
            y1={y}
            x2={getPlotRight(breakConfig)}
            y2={y}
            stroke="rgba(20,41,95,0.08)"
            strokeDasharray="4 8"
          />
        );
      })}

      <polygon points={toAreaPolygon(breakPoints, baseline)} fill="rgba(255, 98, 127, 0.14)" />
      <polyline
        className="brand-chart-draw"
        fill="none"
        stroke="#FF6B7A"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={toPolyline(breakPoints)}
        style={{ ['--brand-path-length' as string]: 1000 }}
      />

      {breakPoints.map((point) => (
        <circle
          key={`break-${point.x}`}
          className="brand-pulse-dot"
          cx={point.x}
          cy={point.y}
          r="4"
          fill="#FF6B7A"
          style={{ animationDelay: `${(point.x % 4) * 0.1}s` }}
        />
      ))}

      {visibleLabelIndexes.map((index) => (
        <text
          key={chartLabels[index] ?? index}
          x={breakPoints[index]?.x ?? breakConfig.padLeft}
          y={breakConfig.height - 10}
          textAnchor="middle"
          fontSize={mobile ? '10' : '11'}
          fontWeight="700"
          fill="#5B7087"
        >
          {chartLabels[index]}
        </text>
      ))}
    </svg>
  );
}

export function DataAnalyticsPreviewSection() {
  return (
    <section id="data-approach" className="relative scroll-mt-28 overflow-hidden bg-[#F7F9FD] py-12 sm:py-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="brand-glow-drift absolute left-[-8%] top-[14%] h-44 w-44 rounded-full bg-[#7AA7FF]/10 blur-[90px]" />
        <div
          className="brand-glow-drift absolute right-[-4%] top-[22%] h-56 w-56 rounded-full bg-[#FFB878]/14 blur-[110px]"
          style={{ animationDelay: '-2.8s' }}
        />
        <div
          className="brand-glow-drift absolute left-[20%] bottom-[10%] h-36 w-36 rounded-full bg-[#FF7A16]/8 blur-[90px]"
          style={{ animationDelay: '-4.1s' }}
        />
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="eyebrow-badge">DATA DRIVEN</span>
          <h2 className="font-aggro-display mt-4 break-keep text-[clamp(1.58rem,8vw,3rem)] font-black leading-[1.08] text-[#14295F]">
            실제 앱처럼 누적되는 그래프를
            <br />
            홈에서도 먼저 보여드립니다
          </h2>
          <p className="mt-4 break-keep text-[14px] font-bold leading-[1.74] text-[#2F4662] sm:text-[15.5px]">
            공부시간, 목표 달성률, 성장률, 리듬, 시작·종료 시간, 중간 이탈시간까지 한 화면에서 읽을 수 있도록
            실제 운영 구조를 홈페이지용으로 다시 정리했습니다.
          </p>
        </div>

        <StaggerChildren stagger={90} className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          {heroMetrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              detail={metric.detail}
              tone={metric.tone}
            />
          ))}
        </StaggerChildren>

        <div className="mt-8">
          <ChartPanel
            icon={LineChart}
            title="공부시간 × 목표 달성률 추이"
            description="공부시간이 늘수록 목표 달성률도 함께 올라가는 흐름을 한 눈에 읽게 구성했습니다."
            badge={<DataBadge label="최근 2주 흐름" tone="navy" />}
            legend={
              <>
                <ChartLegend label="공부시간" tone="navy" />
                <ChartLegend label="목표 달성률" tone="orange" />
              </>
            }
            footer="후반부로 갈수록 공부시간과 목표 달성률이 함께 안정화되는 모습이 보이도록 설계했습니다."
          >
            <div className="sm:hidden">
              <OverviewTrendChart mobile />
            </div>
            <div className="hidden sm:block">
              <OverviewTrendChart />
            </div>
          </ChartPanel>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-2">
          <ChartPanel
            icon={BarChart3}
            title="주간 학습시간 성장률"
            description="주간 누적 학습시간과 전주 대비 성장률을 같이 봐서 실제 개선 속도를 읽습니다."
            badge={<DataBadge label="상승세 유지" tone="green" />}
            legend={
              <>
                <ChartLegend label="주간 학습시간" tone="navy" />
                <ChartLegend label="전주 대비 성장률" tone="green" />
              </>
            }
            footer="학습시간이 늘어나는 구간에서 성장률도 같이 받쳐주는 흐름으로 보이게 구성했습니다."
          >
            <div className="sm:hidden">
              <WeeklyGrowthChart mobile />
            </div>
            <div className="hidden sm:block">
              <WeeklyGrowthChart />
            </div>
          </ChartPanel>

          <ChartPanel
            icon={Activity}
            title="학습 리듬 추이"
            description="매일 비슷한 흐름으로 공부를 시작하고 유지하는 안정감을 점수로 확인합니다."
            badge={<DataBadge label="최근 평균 89점" tone="green" />}
            footer="중간에 작은 흔들림이 있어도 다시 회복되는 패턴이 보여 학습 태도가 안정적으로 보입니다."
          >
            <div className="sm:hidden">
              <RhythmChart mobile />
            </div>
            <div className="hidden sm:block">
              <RhythmChart />
            </div>
          </ChartPanel>

          <ChartPanel
            icon={Clock3}
            title="공부 시작/종료 시간 추이"
            description="시작 시간은 당겨지고 종료 시간은 일정하게 유지되는지 함께 확인합니다."
            badge={<DataBadge label="시간 안정화" tone="violet" />}
            legend={
              <>
                <ChartLegend label="공부 시작" tone="navy" />
                <ChartLegend label="공부 종료" tone="violet" />
              </>
            }
            footer="시작 시각 편차가 줄고 종료 시각도 크게 흔들리지 않아 루틴이 단단해진 인상을 줍니다."
          >
            <div className="sm:hidden">
              <StudyWindowChart mobile />
            </div>
            <div className="hidden sm:block">
              <StudyWindowChart />
            </div>
          </ChartPanel>

          <ChartPanel
            icon={AlertTriangle}
            title="학습 중간 이탈시간 추이"
            description="집중 흐름을 끊는 중간 이탈시간이 짧고 빠르게 회복되는지 확인합니다."
            badge={<DataBadge label="낮음 유지" tone="rose" />}
            footer="초반 1회 이탈 이후에는 짧고 안정적인 수준으로 유지돼 관리가 잘 되고 있는 흐름으로 보입니다."
          >
            <div className="sm:hidden">
              <BreakTimeChart mobile />
            </div>
            <div className="hidden sm:block">
              <BreakTimeChart />
            </div>
          </ChartPanel>
        </div>

        <article className="mt-6 rounded-[1.45rem] border border-[#14295F]/10 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(20,41,95,0.05)] sm:px-6 sm:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[12px] font-bold text-[#FF7A16]">NEXT VIEW</p>
              <p className="mt-1.5 break-keep text-[1.05rem] font-black leading-[1.42] text-[#14295F]">
                같은 데이터도 학생, 학부모, 운영자는 서로 다르게 읽습니다.
              </p>
              <p className="mt-2 break-keep text-[13.5px] font-semibold leading-[1.68] text-[#52667D] sm:text-[14px]">
                아래 역할별 화면에서 누가 어떤 그래프를 먼저 보는지 이어서 확인할 수 있게 연결합니다.
              </p>
            </div>

            <div className="grid gap-2.5 sm:flex sm:flex-wrap sm:gap-3">
              <Link href="#app" className="premium-cta premium-cta-primary h-11 w-full gap-1.5 px-5 text-sm sm:w-auto">
                역할별 화면 이어보기
                <ArrowRight className="brand-cta-arrow h-3.5 w-3.5" />
              </Link>
              <Link href="/experience" className="premium-cta premium-cta-muted h-11 w-full px-5 text-sm sm:w-auto">
                전체 체험 보기
              </Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
