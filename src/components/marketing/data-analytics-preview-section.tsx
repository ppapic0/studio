import Link from 'next/link';
import { AlertTriangle, LineChart, TrendingUp } from 'lucide-react';

import { SectionHeading } from './section-heading';

const trendLabels = ['3/2', '3/4', '3/6', '3/8', '3/10', '3/12', '3/14', '3/16'];

const metrics = [
  {
    label: '주간 학습 시간',
    value: '14h 23m',
    detail: '기록 캘린더 기준 누적',
  },
  {
    label: '평균 목표 달성률',
    value: '83%',
    detail: '주간 계획 대비 실행',
  },
  {
    label: '우선 확인 신호',
    value: '3건',
    detail: '미제출, 하락 추세, 생활 리듬',
  },
];

function TrendChart() {
  return (
    <svg viewBox="0 0 620 260" className="h-[220px] w-full min-w-[34rem]">
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1="0"
          y1={24 + i * 56}
          x2="620"
          y2={24 + i * 56}
          stroke="rgba(20,41,95,0.08)"
          strokeDasharray="4 8"
        />
      ))}
      <polyline
        fill="rgba(20,41,95,0.05)"
        stroke="none"
        points="16,220 90,208 162,196 236,170 312,150 388,118 464,82 540,62 604,56 604,244 16,244"
      />
      <polyline
        fill="none"
        stroke="#14295F"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="16,220 90,208 162,196 236,170 312,150 388,118 464,82 540,62 604,56"
      />
      <polyline
        fill="none"
        stroke="#FF7A16"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="16,232 90,226 162,220 236,194 312,172 388,140 464,108 540,92 604,78"
      />
      {[16, 90, 162, 236, 312, 388, 464, 540, 604].map((x, index) => (
        <circle
          key={x}
          cx={x}
          cy={[220, 208, 196, 170, 150, 118, 82, 62, 56][index]}
          r="5"
          fill="#14295F"
        />
      ))}
      {[16, 90, 162, 236, 312, 388, 464, 540, 604].map((x, index) => (
        <circle
          key={`${x}-orange`}
          cx={x}
          cy={[232, 226, 220, 194, 172, 140, 108, 92, 78][index]}
          r="5"
          fill="#FF7A16"
        />
      ))}
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

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <article className="rounded-[1.8rem] border border-[#14295F]/10 bg-white p-5 shadow-[0_12px_34px_rgba(20,41,95,0.08)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <LineChart className="h-4 w-4 text-[#14295F]" />
                <h3 className="text-[1.15rem] font-black text-[#14295F]">운영 데이터와 결과 흐름</h3>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-black">
                <span className="rounded-full bg-[#EEF3FF] px-3 py-1 text-[#14295F]">공부시간</span>
                <span className="rounded-full bg-[#FFF2E5] px-3 py-1 text-[#D96809]">국어 백분위</span>
              </div>
            </div>
            <p className="mt-3 break-keep text-[13px] font-semibold leading-[1.72] text-[#48607B]">
              학생의 현재를 숫자로만 나열하지 않고, 시간 흐름 안에서 무엇이 좋아지고 무엇이 흔들리는지 보게 만듭니다.
            </p>
            <div className="mt-4 overflow-x-auto pb-2 custom-scrollbar">
              <div className="min-w-[34rem]">
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
                className="rounded-[1.45rem] border border-[#14295F]/10 bg-white px-5 py-5 shadow-[0_12px_28px_rgba(20,41,95,0.06)]"
              >
                <p className="text-[10px] font-black tracking-[0.18em] text-[#14295F]/42">{metric.label}</p>
                <p className="dashboard-number mt-2 text-[1.8rem] text-[#14295F]">{metric.value}</p>
                <p className="mt-1 text-[12px] font-semibold text-[#50657D]">{metric.detail}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-[1.55rem] border border-[#FF7A16]/16 bg-[#FFF6ED] p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#FF7A16]" />
              <p className="text-[13px] font-black text-[#14295F]">먼저 보는 신호</p>
            </div>
            <p className="mt-3 break-keep text-[14px] font-semibold leading-[1.75] text-[#425A75]">
              미제출, 하락 추세, 생활 리듬처럼 바로 행동으로 이어질 신호만 따로 보여줘서 관리가 길어지지 않습니다.
            </p>
          </article>

          <article className="rounded-[1.55rem] border border-[#14295F]/10 bg-white p-5 shadow-[0_10px_24px_rgba(20,41,95,0.05)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[#FF7A16]" />
                <p className="text-[13px] font-black text-[#14295F]">체험으로 연결되는 핵심 요약</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/go/experience?placement=data_preview_cta&mode=student"
                  className="premium-cta premium-cta-primary h-10 px-5 text-sm"
                >
                  학생 화면 체험
                </Link>
                <Link
                  href="/go/experience?placement=data_preview_cta&mode=parent"
                  className="premium-cta premium-cta-muted h-10 px-5 text-sm"
                >
                  학부모 화면 보기
                </Link>
              </div>
            </div>
            <p className="mt-3 break-keep text-[13px] font-semibold leading-[1.7] text-[#50657D]">
              홈에서는 핵심만 보여주고, 학생·학부모·운영자 화면별 자세한 흐름은 체험 페이지에서 이어서 확인할 수 있게 구성합니다.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
