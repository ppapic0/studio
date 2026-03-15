import Link from 'next/link';
import { Activity, AlertTriangle, CheckCircle2, LineChart, MessageSquare } from 'lucide-react';

import { SectionHeading } from './section-heading';

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

function TrendLine() {
  return (
    <svg viewBox="0 0 620 260" className="h-[230px] w-full">
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1="0"
          y1={20 + i * 60}
          x2="620"
          y2={20 + i * 60}
          stroke="rgba(20,41,95,0.09)"
          strokeDasharray="4 6"
        />
      ))}
      <polyline
        fill="none"
        stroke="rgba(20,41,95,0.2)"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="8,238 70,238 126,238 180,236 228,112 276,88 322,138 366,72 410,198 460,56 508,144 560,226 612,246"
      />
      <polyline
        fill="none"
        stroke="#14295F"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="8,238 70,238 126,238 180,236 228,112 276,88 322,138 366,72 410,198 460,56 508,144 560,226 612,246"
      />
    </svg>
  );
}

function CompletionBars() {
  return (
    <div className="flex h-[230px] items-end gap-2 rounded-2xl border border-[#14295F]/8 bg-[#FBFCFF] px-4 pb-4 pt-6">
      {[
        { day: '3/2', v: 0 },
        { day: '3/3', v: 0 },
        { day: '3/4', v: 0 },
        { day: '3/5', v: 0 },
        { day: '3/6', v: 0 },
        { day: '3/7', v: 0 },
        { day: '3/8', v: 0 },
        { day: '3/9', v: 0 },
        { day: '3/10', v: 76 },
        { day: '3/11', v: 0 },
        { day: '3/12', v: 0 },
        { day: '3/13', v: 0 },
      ].map((item) => (
        <div key={item.day} className="flex flex-1 flex-col items-center justify-end gap-2">
          <div className="w-full rounded-t-lg bg-[#F2F4FA]">
            <div
              className="w-full rounded-t-lg bg-[linear-gradient(180deg,#FFB24E_0%,#FF8A00_100%)]"
              style={{ height: `${Math.max(item.v, 2)}px` }}
            />
          </div>
          <span className="text-[10px] font-black text-[#14295F]/45">{item.day}</span>
        </div>
      ))}
    </div>
  );
}

export function DataAnalyticsPreviewSection() {
  return (
    <section id="data-approach" className="scroll-mt-28 bg-[#EEF2FA] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Data Driven"
          title="데이터로 학습을 해석하는 화면을 먼저 보여드립니다"
          description="학생의 공부시간, 루틴, 계획완수율, 위험신호를 한 화면에서 읽을 수 있는 구조입니다. 단순한 ‘좋은 분위기’가 아니라, 어떤 근거로 지도하는지 바로 전달합니다."
        />

        <div className="mt-8 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="평균 공부시간" value="4시간 12분" note="최근 14일 기준" accent="blue" />
            <MiniStat label="평균 공부 리듬" value="0점" note="릴듬 유지 개선 필요" accent="green" />
            <MiniStat label="계획 완수율" value="83%" note="실행 기반 분석" accent="orange" />
            <MiniStat label="성장 연동도" value="0/0" note="분석 포인트 설계 상태" accent="rose" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.8fr_1fr]">
            <article className="rounded-[1.9rem] border border-[#14295F]/12 bg-white p-5 shadow-[0_12px_34px_rgba(20,41,95,0.11)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <LineChart className="h-4 w-4 text-[#14295F]" />
                  <h3 className="text-xl font-black tracking-tight text-[#14295F]">공부시간 추이</h3>
                </div>
                <div className="inline-flex rounded-full bg-[#14295F] px-3 py-1 text-[11px] font-black text-white">
                  14일
                </div>
              </div>
              <p className="mb-2 text-[12px] font-bold text-[#14295F]/55">
                집중 시간의 고저패턴을 한 화면에 담아 전략을 파악합니다.
              </p>
              <TrendLine />
              <div className="mt-1 flex justify-between px-1 text-[10px] font-black text-[#14295F]/45">
                {['3/2', '3/3', '3/4', '3/5', '3/6', '3/7', '3/8', '3/9', '3/10', '3/11', '3/12', '3/13', '3/14', '3/15'].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
            </article>

            <article className="rounded-[1.9rem] border border-[#14295F]/12 bg-white p-5 shadow-[0_12px_34px_rgba(20,41,95,0.11)]">
              <div className="mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#FF8A00]" />
                <h3 className="text-xl font-black tracking-tight text-[#14295F]">계획 완수율</h3>
              </div>
              <p className="mb-3 text-[12px] font-bold text-[#14295F]/55">
                일별 완료율로 실행력의 안정성을 검증합니다.
              </p>
              <CompletionBars />
            </article>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_2.1fr]">
            <article className="rounded-[1.9rem] border border-[#14295F]/12 bg-white p-5 shadow-[0_12px_34px_rgba(20,41,95,0.11)]">
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#14295F]" />
                <h3 className="text-xl font-black tracking-tight text-[#14295F]">인지 리듬 지표</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-[12px] font-black text-[#14295F]/72">
                    <span>리듬 안정성</span>
                    <span>0점</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#E7ECF7]" />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[12px] font-black text-[#14295F]/72">
                    <span>집중 성장률 (평균)</span>
                    <span className="text-emerald-600">+0%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#E7ECF7]">
                    <div className="h-2 w-1/2 rounded-full bg-[#14295F]" />
                  </div>
                </div>
                <div className="inline-flex rounded-full bg-[#FF8A00] px-3 py-1 text-[11px] font-black text-white">
                  학습 시간 고정 필요
                </div>
              </div>
            </article>

            <article className="rounded-[1.9rem] border border-[#14295F]/12 bg-white p-5 shadow-[0_12px_34px_rgba(20,41,95,0.11)]">
              <div className="mb-4 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#2F63E3]" />
                <h3 className="text-xl font-black tracking-tight text-[#14295F]">인지과학 코칭 포인트</h3>
              </div>
              <div className="space-y-2.5">
                {[
                  '최근 14일 평균 공부시간은 4시간 12분입니다.',
                  '완수율이 안정적입니다. 난이도 상향 과제를 단계적으로 추가해도 좋습니다.',
                  '학습 리듬 변동이 큽니다. 매일 같은 시작 시간을 고정하세요.',
                ].map((item, i) => (
                  <div key={item} className="flex items-start gap-3 rounded-xl border border-[#14295F]/12 bg-[#F8FAFF] px-4 py-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#14295F] text-[10px] font-black text-white">
                      {i + 1}
                    </span>
                    <p className="text-[13px] font-bold leading-relaxed text-[#14295F]/82">{item}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <article className="rounded-[1.6rem] border border-[#14295F]/10 bg-white p-4 shadow-[0_10px_24px_rgba(20,41,95,0.08)]">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <h4 className="text-sm font-black tracking-tight text-[#14295F]">위험 신호 및 지원 우선순위</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-black text-rose-700">학습 리듬 불안정</span>
              <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-black text-rose-700">최근 30일 성장 기록 부족</span>
            </div>
          </article>

          <div className="rounded-[1.7rem] bg-[linear-gradient(100deg,#19B38F_0%,#15B59A_44%,#1CB3A2_100%)] p-5 text-white shadow-[0_18px_36px_rgba(16,145,121,0.25)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black tracking-[0.18em] text-white/72">GROWTH OUTPUT</p>
                <p className="mt-2 text-2xl font-black tracking-tight">포인트 4,253 · 스킬 평균 3점</p>
              </div>
              <Link
                href="/go/experience?placement=data_preview_cta&mode=student&view=desktop"
                className="premium-cta premium-cta-ghost h-11 px-5 text-sm"
              >
                성장지표 상세 보기
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
