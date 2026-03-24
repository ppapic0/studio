import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  LineChart,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import { SectionHeading } from './section-heading';

const trendLabels = ['3/2', '3/4', '3/6', '3/8', '3/10', '3/12', '3/14', '3/16'];
const rhythmDays = [
  { label: '월', hours: '3h 40m', focus: 46 },
  { label: '화', hours: '4h 15m', focus: 58 },
  { label: '수', hours: '4h 52m', focus: 66 },
  { label: '목', hours: '5h 18m', focus: 74 },
  { label: '금', hours: '5h 42m', focus: 82 },
  { label: '토', hours: '6h 10m', focus: 94 },
  { label: '일', hours: '5h 26m', focus: 78 },
];
const riskSignals = [
  { label: '미제출 LP', detail: '48시간 내 미제출', tone: 'rose' as const },
  { label: '공부시간 하락', detail: '최근 3일 평균 -18%', tone: 'amber' as const },
  { label: '생활 관리', detail: '벌점 5점 이후 회복 필요', tone: 'navy' as const },
];
const proofMetrics = [
  { label: '6월 모의평가', value: '백분위 82', note: '3등급 시작' },
  { label: '9월 모의평가', value: '백분위 96', note: '1등급 안착' },
  { label: '수능 본시험', value: '백분위 99', note: '고려대 합격' },
];

function MiniStat({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note: string;
  accent: 'blue' | 'green' | 'orange' | 'rose';
}) {
  const accentMap = {
    blue: 'bg-[#2F63E3]',
    green: 'bg-emerald-500',
    orange: 'bg-amber-500',
    rose: 'bg-rose-500',
  };

  return (
    <article className="relative overflow-hidden rounded-3xl border border-[#14295F]/10 bg-white p-4 shadow-[0_10px_26px_rgba(20,41,95,0.09)]">
      <span className={`absolute right-4 top-4 h-5 w-5 rounded-full ${accentMap[accent]}`} />
      <p className="text-[11px] font-black tracking-[0.14em] text-[#14295F]/45">{label}</p>
      <p className="dashboard-number mt-2 text-[2rem] leading-none text-[#14295F]">{value}</p>
      <p className="mt-1 text-[11px] font-bold text-[#14295F]/55">{note}</p>
    </article>
  );
}

function MixedTrendChart() {
  return (
    <svg viewBox="0 0 620 260" className="h-[220px] w-full min-w-[36rem]">
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1="0"
          y1={24 + i * 56}
          x2="620"
          y2={24 + i * 56}
          stroke="rgba(20,41,95,0.09)"
          strokeDasharray="4 6"
        />
      ))}
      <polyline
        fill="rgba(20,41,95,0.06)"
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
        stroke="#FF8A00"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="16,232 90,228 162,220 236,194 312,168 388,134 464,102 540,88 604,74"
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
          key={`${x}-accent`}
          cx={x}
          cy={[232, 228, 220, 194, 168, 134, 102, 88, 74][index]}
          r="5"
          fill="#FF8A00"
        />
      ))}
    </svg>
  );
}

function WeeklyRhythmChart() {
  return (
    <div className="overflow-x-auto pb-2 custom-scrollbar">
      <div className="flex min-w-[28rem] gap-3">
        {rhythmDays.map((day) => (
          <article
            key={day.label}
            className="flex min-w-[5.6rem] flex-1 flex-col justify-between rounded-[1.35rem] border border-[#14295F]/8 bg-[#FBFCFF] p-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-black text-[#14295F]">{day.label}</p>
              <span className="text-[10px] font-black text-[#14295F]/45">{day.hours}</span>
            </div>
            <div className="mt-4 flex h-28 items-end">
              <div className="w-full rounded-[1rem] bg-[#ECF1FB] p-1">
                <div
                  className="w-full rounded-[0.85rem] bg-[linear-gradient(180deg,#FFBE70_0%,#FF8A00_100%)]"
                  style={{ height: `${Math.max(day.focus, 12)}%` }}
                />
              </div>
            </div>
            <p className="mt-3 text-[10px] font-black text-[#14295F]/55">루틴 안정성 {day.focus}%</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function RiskChip({
  label,
  detail,
  tone,
}: {
  label: string;
  detail: string;
  tone: 'rose' | 'amber' | 'navy';
}) {
  const toneMap = {
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    navy: 'border-[#14295F]/12 bg-[#F5F8FF] text-[#14295F]',
  };

  return (
    <div className={`rounded-2xl border px-3.5 py-3 ${toneMap[tone]}`}>
      <p className="text-[12px] font-black">{label}</p>
      <p className="mt-1 text-[11px] font-semibold opacity-80">{detail}</p>
    </div>
  );
}

function ProofTimeline() {
  return (
    <div className="overflow-x-auto pb-2 custom-scrollbar">
      <div className="min-w-[32rem] rounded-[1.5rem] border border-[#14295F]/8 bg-[#FBFCFF] p-5">
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-[#D8E3FF]" />
          <div className="h-2 flex-1 rounded-full bg-[#C7D7FF]" />
          <div className="h-2 flex-1 rounded-full bg-[#FFB874]" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {proofMetrics.map((metric, index) => (
            <article
              key={metric.label}
              className={`rounded-[1.2rem] border p-4 ${
                index === 2
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-[#14295F]/8 bg-white'
              }`}
            >
              <p className="text-[11px] font-black tracking-[0.14em] text-[#14295F]/45">{metric.label}</p>
              <p className="dashboard-number mt-2 text-[1.7rem] text-[#14295F]">{metric.value}</p>
              <p className="mt-1 text-[11px] font-semibold text-[#14295F]/65">{metric.note}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DataAnalyticsPreviewSection() {
  return (
    <section id="data-approach" className="scroll-mt-28 bg-[#EEF2FA] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center [&_.eyebrow-badge]:mx-auto [&>div]:max-w-none [&_p]:mx-auto">
          <SectionHeading
            eyebrow="Data Driven"
            title="운영 데이터와 성장 증명이 함께 보이도록 설계했습니다"
            description="공부시간, 목표 달성률, 루틴 안정성, 위험 신호, 시험 결과까지 같은 화면 문법으로 읽을 수 있어야 관리가 실제 행동으로 이어집니다."
          />
        </div>

        <div className="mx-auto mt-8 max-w-[71rem] space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="주간 학습 시간" value="14h 23m" note="기록 캘린더 기준 누적" accent="blue" />
            <MiniStat label="평균 목표 달성률" value="83%" note="계획 대비 실행 비율" accent="green" />
            <MiniStat label="루틴 안정성" value="78%" note="주간 리듬 회복 구간 포함" accent="orange" />
            <MiniStat label="위험 신호" value="3건" note="조기 개입 우선 대상 감지" accent="rose" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
            <article className="rounded-[1.9rem] border border-[#14295F]/12 bg-white p-5 shadow-[0_12px_34px_rgba(20,41,95,0.11)]">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <LineChart className="h-4 w-4 text-[#14295F]" />
                  <h3 className="text-xl font-black tracking-tight text-[#14295F]">상승 추이</h3>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] font-black">
                  <span className="rounded-full bg-[#EEF3FF] px-3 py-1 text-[#14295F]">공부시간</span>
                  <span className="rounded-full bg-[#FFF2E5] px-3 py-1 text-[#D96809]">국어 백분위</span>
                </div>
              </div>
              <p className="mb-3 break-keep text-[12px] font-bold leading-[1.65] text-[#14295F]/55">
                운영 데이터와 결과 데이터가 따로 놀지 않도록, 공부시간의 증가와 성과 지표의 상승을 같은 흐름 안에서 확인합니다.
              </p>
              <div className="overflow-x-auto pb-2 custom-scrollbar">
                <div className="min-w-[36rem]">
                  <MixedTrendChart />
                  <div className="mt-1 flex justify-between px-1 text-[10px] font-black text-[#14295F]/45">
                    {trendLabels.map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                </div>
              </div>
            </article>

            <article className="rounded-[1.9rem] border border-[#14295F]/12 bg-white p-5 shadow-[0_12px_34px_rgba(20,41,95,0.11)]">
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#FF8A00]" />
                <h3 className="text-xl font-black tracking-tight text-[#14295F]">주간 리듬</h3>
              </div>
              <p className="mb-3 break-keep text-[12px] font-bold leading-[1.65] text-[#14295F]/55">
                하루 기록을 쌓아 주간 리듬으로 보고, 어느 요일에 흔들리는지 먼저 찾습니다.
              </p>
              <WeeklyRhythmChart />
            </article>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr]">
            <article className="rounded-[1.9rem] border border-[#14295F]/12 bg-white p-5 shadow-[0_12px_34px_rgba(20,41,95,0.11)]">
              <div className="mb-4 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-500" />
                <h3 className="text-xl font-black tracking-tight text-[#14295F]">위험 신호</h3>
              </div>
              <div className="space-y-3">
                {riskSignals.map((signal) => (
                  <RiskChip
                    key={signal.label}
                    label={signal.label}
                    detail={signal.detail}
                    tone={signal.tone}
                  />
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-[#14295F]/8 bg-[#F8FBFF] p-4">
                <div className="flex items-center justify-between text-[12px] font-black text-[#14295F]/75">
                  <span>개입 우선도</span>
                  <span>72%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[#E7ECF7]">
                  <div className="h-2 w-[72%] rounded-full bg-[linear-gradient(90deg,#14295F_0%,#FF8A00_100%)]" />
                </div>
                <p className="mt-2 break-keep text-[11px] font-semibold leading-[1.6] text-[#14295F]/55">
                  하락 추세가 길어지기 전에 상담, 루틴 조정, 과제 밀도 조절을 먼저 실행합니다.
                </p>
              </div>
            </article>

            <article className="rounded-[1.9rem] border border-[#14295F]/12 bg-white p-5 shadow-[0_12px_34px_rgba(20,41,95,0.11)]">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <h3 className="text-xl font-black tracking-tight text-[#14295F]">성과 증명</h3>
              </div>
              <p className="mb-3 break-keep text-[12px] font-bold leading-[1.65] text-[#14295F]/55">
                운영 과정이 실제 성과로 이어졌는지, 시험 구간별 변화와 합격 결과를 함께 남겨 증명합니다.
              </p>
              <ProofTimeline />
            </article>
          </div>

          <div className="rounded-[1.7rem] bg-[linear-gradient(102deg,#14295F_0%,#183A8B_42%,#FF8A00_100%)] p-5 text-white shadow-[0_18px_36px_rgba(20,41,95,0.24)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-[10px] font-black tracking-[0.18em] text-white/72">DATA TRUST SIGNAL</p>
                <p className="mt-2 break-keep text-2xl font-black tracking-tight">
                  학생의 현재를 숫자로 읽고, 다음 전략까지 바로 연결합니다
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black text-white/82">
                  <span className="rounded-full border border-white/18 bg-white/10 px-3 py-1">주간 누적 그래프</span>
                  <span className="rounded-full border border-white/18 bg-white/10 px-3 py-1">위험 신호 감지</span>
                  <span className="rounded-full border border-white/18 bg-white/10 px-3 py-1">합격 사례 데이터</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/go/experience?placement=data_preview_cta&mode=student&view=desktop"
                  className="premium-cta premium-cta-ghost h-11 px-5 text-sm"
                >
                  학생 화면 체험하기
                </Link>
                <Link
                  href="/go/experience?placement=data_preview_cta&mode=parent&view=desktop"
                  className="premium-cta premium-cta-muted h-11 border-white/24 bg-white/12 px-5 text-sm text-white hover:bg-white/18"
                >
                  학부모 화면 보기
                </Link>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] font-black text-white/78">
                  <TrendingUp className="h-3.5 w-3.5" />
                  공부시간 상승
                </div>
                <p className="mt-1 text-[15px] font-black">14일 기준 +31%</p>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] font-black text-white/78">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  계획 실행률
                </div>
                <p className="mt-1 text-[15px] font-black">83% 유지</p>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/10 px-4 py-3">
                <div className="flex items-center gap-2 text-[11px] font-black text-white/78">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  조기 개입 대상
                </div>
                <p className="mt-1 text-[15px] font-black">3건 실시간 표시</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
