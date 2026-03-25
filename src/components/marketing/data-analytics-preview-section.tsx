import Link from 'next/link';
import { BarChart2, Calendar, LineChart, ShieldCheck, Smartphone, Users } from 'lucide-react';

import { SectionHeading } from './section-heading';

const trendLabels = ['3/2', '3/4', '3/6', '3/8', '3/10', '3/12', '3/14', '3/16'];

const weeklyRates = [71, 74, 68, 79, 83, 88, 83];
const weekLabels = ['1주', '2주', '3주', '4주', '5주', '6주', '7주'];

// 0=없음 1=낮음 2=보통 3=높음 4=매우높음
const activityData = [
  3, 4, 2, 4, 3, 1,
  4, 4, 3, 4, 4, 2,
  3, 3, 0, 4, 3, 4,
  4, 4, 2, 3, 4, 4,
  3, 4, 4, 2, 4, 3,
];

const metrics = [
  { label: '주간 학습 시간', value: '14h 23m', detail: '기록 캘린더 기준 누적' },
  { label: '평균 목표 달성률', value: '83%', detail: '주간 계획 대비 실행' },
  { label: '우선 확인 신호', value: '3건', detail: '미제출, 하락 추세, 생활 리듬' },
];

const roles = [
  {
    Icon: Smartphone,
    label: '학생',
    items: ['오늘의 루틴 확인', 'LP 누적 3,164', '주간 달성률 83%'],
    href: '/go/experience?placement=data_preview_cta&mode=student',
    cta: '학생 화면 체험',
    primary: true,
  },
  {
    Icon: Users,
    label: '학부모',
    items: ['실시간 출결 확인', '주간 그래프', '리포트 수신'],
    href: '/go/experience?placement=data_preview_cta&mode=parent',
    cta: '학부모 화면 보기',
    primary: false,
  },
  {
    Icon: ShieldCheck,
    label: '운영자',
    items: ['위험 신호 3건', '개입 우선순위', '피드백 발송'],
    href: '/go/experience?placement=data_preview_cta&mode=admin',
    cta: '운영자 화면 보기',
    primary: false,
  },
];

function TrendChart() {
  return (
    <svg viewBox="0 0 620 260" className="h-[200px] w-full min-w-[30rem]">
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1="0" y1={24 + i * 56} x2="620" y2={24 + i * 56}
          stroke="rgba(20,41,95,0.08)" strokeDasharray="4 8" />
      ))}
      <polyline fill="rgba(20,41,95,0.05)" stroke="none"
        points="16,220 90,208 162,196 236,170 312,150 388,118 464,82 540,62 604,56 604,244 16,244" />
      <polyline fill="none" stroke="#14295F" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
        points="16,220 90,208 162,196 236,170 312,150 388,118 464,82 540,62 604,56" />
      <polyline fill="none" stroke="#FF7A16" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
        points="16,232 90,226 162,220 236,194 312,172 388,140 464,108 540,92 604,78" />
      {([16, 90, 162, 236, 312, 388, 464, 540, 604] as number[]).map((x, i) => (
        <circle key={x} cx={x} cy={([220, 208, 196, 170, 150, 118, 82, 62, 56] as number[])[i]} r="5" fill="#14295F" />
      ))}
      {([16, 90, 162, 236, 312, 388, 464, 540, 604] as number[]).map((x, i) => (
        <circle key={`${x}-o`} cx={x} cy={([232, 226, 220, 194, 172, 140, 108, 92, 78] as number[])[i]} r="5" fill="#FF7A16" />
      ))}
    </svg>
  );
}

function WeeklyBarChart() {
  const chartH = 130;
  const barW = 34;
  const gap = 18;
  const totalW = weeklyRates.length * (barW + gap) - gap;

  return (
    <svg viewBox={`0 0 ${totalW + 8} ${chartH + 28}`} className="h-[140px] w-full">
      {weeklyRates.map((rate, i) => {
        const x = i * (barW + gap);
        const barH = (rate / 100) * chartH;
        const y = chartH - barH;
        const isHighlight = rate === Math.max(...weeklyRates);
        return (
          <g key={i}>
            <rect x={x} y={chartH} width={barW} height={0} rx="7" ry="7"
              fill={isHighlight ? '#FF7A16' : 'rgba(255,122,22,0.22)'} />
            <rect x={x} y={y} width={barW} height={barH} rx="7" ry="7"
              fill={isHighlight ? '#FF7A16' : 'rgba(255,122,22,0.22)'} />
            <text x={x + barW / 2} y={y - 4} textAnchor="middle"
              fontSize="9" fontWeight="800"
              fill={isHighlight ? '#D96809' : 'rgba(20,41,95,0.45)'}>
              {rate}%
            </text>
            <text x={x + barW / 2} y={chartH + 16} textAnchor="middle"
              fontSize="9" fontWeight="800" fill="rgba(20,41,95,0.40)">
              {weekLabels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ActivityHeatmap() {
  const cols = 6;
  const cellSize = 26;
  const gap = 5;
  const opacities = [0.05, 0.18, 0.38, 0.62, 1];

  return (
    <svg
      viewBox={`0 0 ${cols * (cellSize + gap) - gap} ${5 * (cellSize + gap) - gap}`}
      className="w-full max-w-[200px]"
    >
      {activityData.map((level, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return (
          <rect
            key={i}
            x={col * (cellSize + gap)}
            y={row * (cellSize + gap)}
            width={cellSize}
            height={cellSize}
            rx="6"
            fill={`rgba(20,41,95,${opacities[level] ?? 0.05})`}
          />
        );
      })}
    </svg>
  );
}

export function DataAnalyticsPreviewSection() {
  return (
    <section id="data-approach" className="scroll-mt-28 bg-[#F7F9FD] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center [&_.eyebrow-badge]:mx-auto">
          <SectionHeading
            eyebrow="Data Driven"
            title="많이 보여주기보다 바로 읽히는 데이터만 남겼습니다"
            description="공부시간과 결과 지표를 같은 축으로 보고, 먼저 개입해야 할 신호만 짧고 선명하게 확인합니다."
          />
        </div>

        {/* Row 1: 꺾은선 차트 + 메트릭 카드 */}
        <div className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <article className="rounded-[1.8rem] border border-[#14295F]/10 bg-white p-5 shadow-[0_12px_34px_rgba(20,41,95,0.08)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <LineChart className="h-4 w-4 text-[#14295F]" />
                <h3 className="text-[1.05rem] font-black text-[#14295F]">공부시간 × 국어 백분위 추이</h3>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-black">
                <span className="rounded-full bg-[#EEF3FF] px-3 py-1 text-[#14295F]">공부시간</span>
                <span className="rounded-full bg-[#FFF2E5] px-3 py-1 text-[#D96809]">국어 백분위</span>
              </div>
            </div>
            <p className="mt-2 break-keep text-[12.5px] font-semibold leading-[1.7] text-[#48607B]">
              시간 흐름 안에서 무엇이 좋아지고 무엇이 흔들리는지 보게 만듭니다.
            </p>
            <div className="mt-4 overflow-x-auto pb-2 custom-scrollbar">
              <div className="min-w-[30rem]">
                <TrendChart />
                <div className="mt-1 flex justify-between px-1 text-[10px] font-black text-[#14295F]/42">
                  {trendLabels.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <div className="space-y-4">
            {metrics.map((metric) => (
              <article
                key={metric.label}
                className="rounded-[1.45rem] border border-[#14295F]/10 bg-white px-5 py-4 shadow-[0_12px_28px_rgba(20,41,95,0.06)]"
              >
                <p className="text-[10px] font-black tracking-[0.18em] text-[#14295F]/42">{metric.label}</p>
                <p className="dashboard-number mt-1.5 text-[1.7rem] text-[#14295F]">{metric.value}</p>
                <p className="mt-0.5 text-[12px] font-semibold text-[#50657D]">{metric.detail}</p>
              </article>
            ))}
          </div>
        </div>

        {/* Row 2: 주간 달성률 바차트 + 활동 히트맵 */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <article className="rounded-[1.8rem] border border-[#14295F]/10 bg-white p-5 shadow-[0_12px_34px_rgba(20,41,95,0.08)] sm:p-6">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-[#FF7A16]" />
              <h3 className="text-[1.05rem] font-black text-[#14295F]">주간 목표 달성률 추이</h3>
            </div>
            <p className="mt-2 break-keep text-[12.5px] font-semibold leading-[1.7] text-[#48607B]">
              7주 연속 기록. 루틴이 안정될수록 달성률이 올라가는 흐름입니다.
            </p>
            <div className="mt-5 px-2">
              <WeeklyBarChart />
            </div>
          </article>

          <article className="rounded-[1.8rem] border border-[#14295F]/10 bg-white p-5 shadow-[0_12px_34px_rgba(20,41,95,0.08)] sm:p-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#14295F]" />
              <h3 className="text-[1.05rem] font-black text-[#14295F]">30일 학습 활동 기록</h3>
            </div>
            <p className="mt-2 break-keep text-[12.5px] font-semibold leading-[1.7] text-[#48607B]">
              빠진 날 없이 쌓인 루틴이 데이터로 남습니다.
            </p>
            <div className="mt-4 flex justify-center">
              <ActivityHeatmap />
            </div>
            <div className="mt-3 flex items-center justify-end gap-1.5">
              <span className="text-[10px] font-black text-[#14295F]/40">낮음</span>
              {[0.06, 0.22, 0.44, 0.68, 1].map((o) => (
                <span
                  key={o}
                  className="inline-block h-3 w-3 rounded-[3px]"
                  style={{ background: `rgba(20,41,95,${o})` }}
                />
              ))}
              <span className="text-[10px] font-black text-[#14295F]/40">높음</span>
            </div>
          </article>
        </div>

        {/* Row 3: 3역할 데이터 스트립 */}
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {roles.map(({ Icon, label, items, href, cta, primary }) => (
            <article
              key={label}
              className="rounded-[1.55rem] border border-[#14295F]/10 bg-white p-5 shadow-[0_10px_24px_rgba(20,41,95,0.05)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF3FF]">
                    <Icon className="h-4 w-4 text-[#14295F]" />
                  </div>
                  <p className="text-[13px] font-black text-[#14295F]">{label} 확인 데이터</p>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[13px] font-semibold text-[#3A5470]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF7A16]" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Link
                  href={href}
                  className={`premium-cta h-9 w-full justify-center px-4 text-[13px] ${
                    primary ? 'premium-cta-primary' : 'premium-cta-muted'
                  }`}
                >
                  {cta}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}