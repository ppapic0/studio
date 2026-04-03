import Link from 'next/link';
import type { ElementType, ReactNode } from 'react';
import { Activity, AlertTriangle, ArrowRight, ChartColumnBig, Clock3, ClipboardList, Sparkles, Target, TrendingUp } from 'lucide-react';

import type { MarketingContent } from '@/lib/marketing-content';

type MobileStudySystemSectionProps = {
  content: MarketingContent['mobileStudySystem'];
};

type Point = {
  x: number;
  y: number;
};

type CompactChartConfig = {
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
  min: number;
  max: number;
};

const compactLabels = ['3/2', '3/4', '3/6', '3/8', '3/10', '3/12', '3/14'];
const studyMinutesTrend = [4.4, 4.9, 5.5, 6.9, 7.8, 9.1, 9.6];
const goalRateTrend = [58, 62, 68, 80, 87, 94, 97];
const weeklyGrowthBars = [3.4, 4.6, 4.1, 5.8, 6.7, 7.1, 7.5];
const weeklyGrowthLine = [12, 18, 15, 26, 32, 35, 38];
const rhythmTrend = [71, 74, 82, 79, 88, 92, 95];
const startTimeTrend = [8.3, 8.2, 8.2, 8.1, 8.1, 8.0, 8.0];
const endTimeTrend = [22.2, 22.1, 22.1, 22.0, 22.0, 22.0, 21.9];
const awayTimeTrend = [1.2, 1.0, 2.7, 0.9, 0.8, 0.8, 0.7];

const LARGE_CHART: CompactChartConfig = {
  width: 320,
  height: 140,
  padLeft: 16,
  padRight: 12,
  padTop: 14,
  padBottom: 24,
  min: 0,
  max: 100,
};

const MINI_CHART: CompactChartConfig = {
  width: 144,
  height: 88,
  padLeft: 10,
  padRight: 8,
  padTop: 10,
  padBottom: 18,
  min: 0,
  max: 100,
};

function getPlotBottom(config: CompactChartConfig) {
  return config.height - config.padBottom;
}

function getPlotRight(config: CompactChartConfig) {
  return config.width - config.padRight;
}

function getChartPoints(values: number[], config: CompactChartConfig): Point[] {
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

function CompactTrendChart() {
  const studyPoints = getChartPoints(studyMinutesTrend, { ...LARGE_CHART, min: 3.5, max: 10.5 });
  const goalPoints = getChartPoints(goalRateTrend, { ...LARGE_CHART, min: 50, max: 100 });
  const baseline = getPlotBottom(LARGE_CHART);

  return (
    <svg viewBox={`0 0 ${LARGE_CHART.width} ${LARGE_CHART.height}`} className="h-[8.75rem] w-full" aria-hidden="true">
      {[0, 1, 2, 3].map((index) => {
        const y = LARGE_CHART.padTop + index * ((baseline - LARGE_CHART.padTop) / 3);
        return (
          <line
            key={index}
            x1={LARGE_CHART.padLeft}
            y1={y}
            x2={getPlotRight(LARGE_CHART)}
            y2={y}
            stroke="rgba(20,41,95,0.08)"
            strokeDasharray="4 6"
          />
        );
      })}

      <polygon points={toAreaPolygon(studyPoints, baseline)} fill="rgba(20,41,95,0.06)" />
      <polyline fill="none" stroke="#14295F" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" points={toPolyline(studyPoints)} />
      <polyline fill="none" stroke="#FF7A16" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" points={toPolyline(goalPoints)} />

      {studyPoints.map((point) => (
        <circle key={`study-${point.x}`} cx={point.x} cy={point.y} r="3.2" fill="#14295F" />
      ))}
      {goalPoints.map((point) => (
        <circle key={`goal-${point.x}`} cx={point.x} cy={point.y} r="3.2" fill="#FF7A16" />
      ))}

      {compactLabels.map((label, index) => (
        <text key={label} x={studyPoints[index]?.x ?? LARGE_CHART.padLeft} y={LARGE_CHART.height - 8} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#667A95">
          {label}
        </text>
      ))}
    </svg>
  );
}

function CompactGrowthChart() {
  const bars = getChartPoints(weeklyGrowthBars, { ...MINI_CHART, min: 0, max: 8 });
  const line = getChartPoints(weeklyGrowthLine, { ...MINI_CHART, min: 0, max: 40 });
  const baseline = getPlotBottom(MINI_CHART);

  return (
    <svg viewBox={`0 0 ${MINI_CHART.width} ${MINI_CHART.height}`} className="h-[5.5rem] w-full" aria-hidden="true">
      {[0, 1, 2].map((index) => {
        const y = MINI_CHART.padTop + index * ((baseline - MINI_CHART.padTop) / 2);
        return <line key={index} x1={MINI_CHART.padLeft} y1={y} x2={getPlotRight(MINI_CHART)} y2={y} stroke="rgba(20,41,95,0.08)" strokeDasharray="3 5" />;
      })}

      {bars.map((point, index) => (
        <rect key={index} x={point.x - 5} y={point.y} width="10" height={baseline - point.y} rx="5" fill="rgba(125,171,255,0.36)" />
      ))}

      <polyline fill="none" stroke="#18B88A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" points={toPolyline(line)} />
      {line.map((point) => (
        <circle key={`line-${point.x}`} cx={point.x} cy={point.y} r="2.4" fill="#18B88A" />
      ))}
    </svg>
  );
}

function CompactRhythmChart() {
  const points = getChartPoints(rhythmTrend, { ...MINI_CHART, min: 68, max: 100 });
  const baseline = getPlotBottom(MINI_CHART);

  return (
    <svg viewBox={`0 0 ${MINI_CHART.width} ${MINI_CHART.height}`} className="h-[5.5rem] w-full" aria-hidden="true">
      {[0, 1, 2].map((index) => {
        const y = MINI_CHART.padTop + index * ((baseline - MINI_CHART.padTop) / 2);
        return <line key={index} x1={MINI_CHART.padLeft} y1={y} x2={getPlotRight(MINI_CHART)} y2={y} stroke="rgba(20,41,95,0.08)" strokeDasharray="3 5" />;
      })}

      <polygon points={toAreaPolygon(points, baseline)} fill="rgba(31,184,138,0.10)" />
      <polyline fill="none" stroke="#16B67A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" points={toPolyline(points)} />
      {points.map((point) => (
        <circle key={`rhythm-${point.x}`} cx={point.x} cy={point.y} r="2.4" fill="#16B67A" />
      ))}
    </svg>
  );
}

function CompactTimeChart() {
  const startPoints = getChartPoints(startTimeTrend, { ...MINI_CHART, min: 7.5, max: 24, padLeft: 12 });
  const endPoints = getChartPoints(endTimeTrend, { ...MINI_CHART, min: 7.5, max: 24, padLeft: 12 });

  return (
    <svg viewBox={`0 0 ${MINI_CHART.width} ${MINI_CHART.height}`} className="h-[5.5rem] w-full" aria-hidden="true">
      {[0, 1, 2].map((index) => {
        const y = MINI_CHART.padTop + index * ((getPlotBottom(MINI_CHART) - MINI_CHART.padTop) / 2);
        return <line key={index} x1={12} y1={y} x2={getPlotRight(MINI_CHART)} y2={y} stroke="rgba(20,41,95,0.08)" strokeDasharray="3 5" />;
      })}

      <polyline fill="none" stroke="#3B82F6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" points={toPolyline(startPoints)} />
      <polyline fill="none" stroke="#8B5CF6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" points={toPolyline(endPoints)} />
    </svg>
  );
}

function CompactAwayChart() {
  const points = getChartPoints(awayTimeTrend, { ...MINI_CHART, min: 0, max: 3 });
  const baseline = getPlotBottom(MINI_CHART);

  return (
    <svg viewBox={`0 0 ${MINI_CHART.width} ${MINI_CHART.height}`} className="h-[5.5rem] w-full" aria-hidden="true">
      {[0, 1, 2].map((index) => {
        const y = MINI_CHART.padTop + index * ((baseline - MINI_CHART.padTop) / 2);
        return <line key={index} x1={MINI_CHART.padLeft} y1={y} x2={getPlotRight(MINI_CHART)} y2={y} stroke="rgba(20,41,95,0.08)" strokeDasharray="3 5" />;
      })}

      <polygon points={toAreaPolygon(points, baseline)} fill="rgba(255,105,123,0.12)" />
      <polyline fill="none" stroke="#FF6574" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" points={toPolyline(points)} />
      {points.map((point) => (
        <circle key={`away-${point.x}`} cx={point.x} cy={point.y} r="2.2" fill="#FF6574" />
      ))}
    </svg>
  );
}

function AnalyticsPreviewCard({
  title,
  badge,
  footer,
  icon,
  children,
  compact = false,
}: {
  title: string;
  badge: string;
  footer: string;
  icon: ElementType;
  children: ReactNode;
  compact?: boolean;
}) {
  const Icon = icon;

  return (
    <article className={`rounded-[1.3rem] border border-[#D9E5F7] bg-white p-3 shadow-[0_12px_28px_rgba(20,41,95,0.06)] ${compact ? '' : 'sm:p-4'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F3F7FF] text-[#14295F]">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <p className={`break-keep font-black text-[#14295F] ${compact ? 'text-[0.78rem] leading-[1.3]' : 'text-[0.92rem] leading-[1.35]'}`}>{title}</p>
        </div>
        <span className={`inline-flex rounded-full border px-2 py-0.5 font-black ${compact ? 'text-[9px]' : 'text-[9.5px]'} ${
          badge.includes('상승') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
          badge.includes('리듬') ? 'border-cyan-200 bg-cyan-50 text-cyan-700' :
          badge.includes('시간') ? 'border-violet-200 bg-violet-50 text-violet-700' :
          'border-rose-200 bg-rose-50 text-rose-700'
        }`}>
          {badge}
        </span>
      </div>

      <div className="mt-3">{children}</div>

      <div className="mt-3 rounded-[0.9rem] border border-[#DCE7F7] bg-[#F8FBFF] px-2.5 py-2">
        <p className="break-keep text-[10px] font-semibold leading-[1.5] text-[#5A6F89]">{footer}</p>
      </div>
    </article>
  );
}

function AnalyticsPreviewDashboard() {
  return (
    <div className="rounded-[1.6rem] border border-[#D6E2F6] bg-[linear-gradient(180deg,#F8FBFF_0%,#F1F6FE_100%)] p-3">
      <AnalyticsPreviewCard
        title="공부시간 × 목표 달성률 추이"
        badge="최근 2주"
        icon={TrendingUp}
        footer="공부시간과 목표 달성률이 함께 올라가는 흐름을 앱에서도 같은 문맥으로 확인합니다."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full bg-[#F3F7FF] px-2.5 py-1 text-[9px] font-black text-[#14295F]">공부시간</span>
            <span className="inline-flex rounded-full bg-[#FFF4EA] px-2.5 py-1 text-[9px] font-black text-[#B55200]">목표 달성률</span>
          </div>
          <CompactTrendChart />
        </div>
      </AnalyticsPreviewCard>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <AnalyticsPreviewCard
          title="주간 학습시간 성장률"
          badge="+ 성장 유지"
          icon={ChartColumnBig}
          footer="주간 학습시간과 성장률 흐름을 같이 읽습니다."
          compact
        >
          <CompactGrowthChart />
        </AnalyticsPreviewCard>

        <AnalyticsPreviewCard
          title="학습 리듬 추이"
          badge="최근 리듬 안정"
          icon={Activity}
          footer="학습 리듬이 회복되는 흐름을 빠르게 확인합니다."
          compact
        >
          <CompactRhythmChart />
        </AnalyticsPreviewCard>

        <AnalyticsPreviewCard
          title="공부 시작/종료 시간 추이"
          badge="시간 안정화"
          icon={Clock3}
          footer="시작과 종료 시간이 일정한지 같이 봅니다."
          compact
        >
          <CompactTimeChart />
        </AnalyticsPreviewCard>

        <AnalyticsPreviewCard
          title="학습 중간 이탈시간 추이"
          badge="낮음 유지"
          icon={AlertTriangle}
          footer="집중 흐름을 끊는 이탈 시간이 짧은지 확인합니다."
          compact
        >
          <CompactAwayChart />
        </AnalyticsPreviewCard>
      </div>
    </div>
  );
}

const toneStyles = {
  navy: {
    panel: 'border-white/8 bg-white/[0.04]',
    accent: 'text-[#AFC6FF]',
    iconWrap: 'bg-white/10 text-white',
    badge: 'bg-white/10 text-white/70',
  },
  slate: {
    panel: 'border-[#243A74] bg-[#10204A]',
    accent: 'text-[#C6D8FF]',
    iconWrap: 'bg-[#1A2F63] text-[#DCE8FF]',
    badge: 'bg-[#1A2F63] text-[#DCE8FF]/72',
  },
  orange: {
    panel: 'border-[#FF9A47]/18 bg-[linear-gradient(180deg,rgba(255,122,22,0.16)_0%,rgba(255,122,22,0.08)_100%)]',
    accent: 'text-[#FFD2A9]',
    iconWrap: 'bg-[#FF7A16]/18 text-[#FFD8B6]',
    badge: 'bg-white/10 text-[#FFD2A9]',
  },
  violet: {
    panel: 'border-[#6D61D9]/16 bg-[linear-gradient(180deg,rgba(101,84,214,0.14)_0%,rgba(101,84,214,0.08)_100%)]',
    accent: 'text-[#DDD8FF]',
    iconWrap: 'bg-[#3F2F95]/40 text-[#F0EDFF]',
    badge: 'bg-white/10 text-[#E4DFFF]',
  },
} as const;

const sectionIcons = [Target, ChartColumnBig, ClipboardList, Sparkles] as const;

function renderPrimaryPanel(
  section: MarketingContent['mobileStudySystem']['sections'][number],
) {
  const panelBody = (
    <article className="relative overflow-hidden rounded-[2.2rem] border border-[#FF9A47]/18 bg-[linear-gradient(180deg,rgba(255,122,22,0.2)_0%,rgba(255,122,22,0.1)_100%)] p-6 shadow-[0_28px_56px_rgba(2,10,29,0.26)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-10 top-0 h-32 w-32 rounded-full bg-[rgba(255,122,22,0.18)] blur-3xl" />
        <div className="absolute left-[-10%] top-[20%] h-24 w-24 rounded-full bg-[rgba(255,214,169,0.18)] blur-3xl" />
      </div>

      <div className="relative space-y-5">
        <div className="flex justify-center">
          <div className="w-full max-w-[16.75rem] rounded-[1.8rem] bg-white px-5 py-4 text-center shadow-[0_24px_44px_rgba(20,41,95,0.12)]">
            <span className="inline-flex rounded-full bg-[#14295F] px-4 py-1.5 text-[12px] font-black tracking-[0.2em] text-white">
              SECTION 01
            </span>
            <p className="mt-4 break-keep text-[1.18rem] font-black leading-[1.45] text-[#14295F]">
              {section.body}
            </p>
            <div className="mt-4 flex justify-center pt-1">
              <span className="inline-flex items-center gap-2 text-[14px] font-black text-[#14295F]">
                트랙러닝시스템 보러가기
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 text-center">
          <h3 className="break-keep text-[2rem] font-black leading-[1.08] tracking-[-0.04em] text-white">
            {section.title}
          </h3>
        </div>
      </div>
    </article>
  );

  if (section.href) {
    return (
      <Link key={section.title} href={section.href} className="block">
        {panelBody}
      </Link>
    );
  }

  return <div key={section.title}>{panelBody}</div>;
}

function renderSecondaryPanel(
  section: MarketingContent['mobileStudySystem']['sections'][number],
) {
  const Icon = sectionIcons[1] ?? ChartColumnBig;
  const panelBody = (
    <article className="relative overflow-hidden rounded-[2rem] border border-[#DCE7FF] bg-white p-5 shadow-[0_24px_48px_rgba(20,41,95,0.10)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-8 top-0 h-28 w-28 rounded-full bg-[rgba(20,41,95,0.06)] blur-3xl" />
      </div>

      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <span className="inline-flex rounded-full bg-[#14295F] px-3 py-1 text-[10px] font-black tracking-[0.18em] text-white">
              SECTION 02
            </span>
            <h3 className="break-keep text-[1.7rem] font-black leading-[1.12] text-[#14295F]">
              {section.title}
            </h3>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EEF3FF] text-[#14295F]">
            <Icon className="h-5 w-5" />
          </span>
        </div>

        <div className="space-y-3">
          <p className="break-keep text-[1rem] font-bold leading-[1.7] text-[#1F3D7A]">{section.body}</p>
          {section.secondaryBody ? (
            <p className="break-keep text-[0.96rem] font-semibold leading-[1.72] text-[#425A75]">
              {section.secondaryBody}
            </p>
          ) : null}
        </div>

        <AnalyticsPreviewDashboard />
      </div>
    </article>
  );

  return <div key={section.title}>{panelBody}</div>;
}

function renderPanel(
  section: MarketingContent['mobileStudySystem']['sections'][number],
  index: number,
) {
  if (index === 0) {
    return renderPrimaryPanel(section);
  }

  if (index === 1) {
    return renderSecondaryPanel(section);
  }

  const Icon = sectionIcons[index] ?? Sparkles;
  const tone = toneStyles[section.tone];
  const panelBody = (
    <article
      className={`relative overflow-hidden rounded-[2rem] border p-5 shadow-[0_24px_48px_rgba(2,10,29,0.22)] ${tone.panel}`}
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -right-10 top-0 h-28 w-28 rounded-full blur-3xl"
          style={{
            background:
              section.tone === 'orange'
                ? 'rgba(255,122,22,0.16)'
                : section.tone === 'violet'
                  ? 'rgba(120,102,255,0.16)'
                  : 'rgba(142,173,255,0.14)',
          }}
        />
      </div>

      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black tracking-[0.18em] ${tone.badge}`}>
              SECTION {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="break-keep text-[1.7rem] font-black leading-[1.08] text-white">
              {section.title}
            </h3>
          </div>
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone.iconWrap}`}>
            <Icon className="h-5 w-5" />
          </span>
        </div>

        <div className="space-y-2.5">
          <p className={`break-keep text-[1rem] font-semibold leading-[1.7] ${tone.accent}`}>{section.body}</p>
          {section.detailPoints?.length ? (
            <div className="space-y-2.5 pt-1">
              {section.detailPoints.map((point, pointIndex) => (
                <div key={point} className="flex items-start gap-3 rounded-[1.15rem] border border-white/10 bg-white/[0.06] px-3.5 py-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black text-[#14295F]">
                    {pointIndex + 1}
                  </span>
                  <p className="break-keep pt-0.5 text-[0.92rem] font-semibold leading-[1.65] text-white/82">
                    {point}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          {section.secondaryBody ? (
            <p className="break-keep text-[0.96rem] font-semibold leading-[1.72] text-white/72">{section.secondaryBody}</p>
          ) : null}
        </div>

        {index === 3 ? (
          <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.05] p-3">
            <div className="flex h-[16rem] items-center justify-center rounded-[1.4rem] border border-dashed border-white/14 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.12),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] px-6 text-center">
              <div className="space-y-3">
                <span className="inline-flex rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-white/68">
                  APP PREVIEW
                </span>
                <p className="break-keep text-[1.35rem] font-black leading-[1.2] text-white">실제 앱 화면 예정</p>
                <p className="break-keep text-[0.88rem] font-semibold leading-[1.7] text-white/60">
                  포인트와 상벌점 운영이 어떻게 보이는지
                  <br />
                  추후 실제 화면으로 연결됩니다.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {section.href ? (
          <div className="pt-1">
            <span className="inline-flex items-center gap-2 text-[13px] font-black text-white">
              트랙러닝시스템 보러가기
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        ) : null}
      </div>
    </article>
  );

  if (section.href) {
    return (
      <Link key={section.title} href={section.href} className="block">
        {panelBody}
      </Link>
    );
  }

  return <div key={section.title}>{panelBody}</div>;
}

export function MobileStudySystemSection({ content }: MobileStudySystemSectionProps) {
  return (
    <section className="bg-[#07142F] px-4 py-8 text-white sm:hidden">
      <div className="mx-auto max-w-[28rem]">
        <div className="space-y-4">
          {content.sections.map((section, index) => renderPanel(section, index))}
        </div>
      </div>
    </section>
  );
}
