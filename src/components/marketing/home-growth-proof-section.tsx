import Link from 'next/link';
import { ArrowRight, TrendingUp } from 'lucide-react';

const growthProofCards = [
  {
    phase: '6월 모의평가',
    summary: '국어 3등급 · 백분위 82',
    image: '/marketing/proof/june-mock-redacted.jpg',
  },
  {
    phase: '9월 모의평가',
    summary: '국어 1등급 · 백분위 96',
    image: '/marketing/proof/september-mock-redacted.jpg',
  },
  {
    phase: '수능 본시험',
    summary: '국어 백분위 99',
    image: '/marketing/proof/csat-score-redacted.jpg',
  },
];

const proofSignals = [
  { label: '백분위 상승', value: '82 → 96 → 99', tone: 'bg-[#EEF3FF] text-[#14295F]' },
  { label: '주간 누적 공부시간', value: '21h → 34h', tone: 'bg-[#FFF4E9] text-[#C15D05]' },
  { label: '피드백 루프', value: '14회 누적', tone: 'bg-[#EEF9F2] text-[#0F8C57]' },
];

export function HomeGrowthProofSection() {
  return (
    <section
      id="growth-proof"
      className="scroll-mt-24 py-16 sm:py-20"
      style={{ background: 'linear-gradient(180deg, #f2f6ff 0%, #ffffff 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <article className="marketing-card p-6 sm:p-8">
            <span className="inline-flex items-center rounded-full bg-[#14295F]/8 px-3 py-1 text-[11px] font-black tracking-[0.14em] text-[#14295F] uppercase">
              성장 증명 데이터
            </span>
            <h2 className="mt-4 break-keep text-[clamp(1.45rem,3.1vw,2.2rem)] font-black leading-[1.2] text-[#14295F]">
              관리와 피드백이 쌓이면
              <br />
              결과도 데이터로 남습니다
            </h2>
            <p className="mt-4 break-keep text-[14px] font-semibold leading-[1.8] text-[#3f5874] sm:text-[14.5px]">
              단순히 문제를 많이 푸는 방식이 아니라, 루틴 회복과 공부시간 관리, 시험 구간별 분석까지 연결한 결과가 실제 성과로 이어진 사례입니다.
              이름과 학교명은 비공개 처리했습니다.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {proofSignals.map((signal) => (
                <article key={signal.label} className={`rounded-[1.2rem] px-4 py-4 ${signal.tone}`}>
                  <p className="text-[11px] font-black tracking-[0.14em] opacity-70">{signal.label}</p>
                  <p className="mt-2 break-keep text-[1rem] font-black leading-[1.35]">{signal.value}</p>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-[1.4rem] border border-[#14295F]/8 bg-[#F8FBFF] p-5">
              <div className="flex flex-wrap items-center gap-3">
                {['6월 3등급', '9월 1등급', '수능 백분위 99'].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-[#14295F]/12 bg-white px-3 py-1.5 text-[12px] font-black text-[#14295F]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <div className="mt-4 overflow-x-auto pb-2 custom-scrollbar">
                <div className="min-w-[26rem]">
                  <div className="flex items-end gap-3">
                    {[82, 96, 99].map((value, index) => (
                      <div key={value} className="flex flex-1 flex-col items-center gap-2">
                        <div className="flex h-40 w-full items-end rounded-[1.2rem] bg-[#E9EFFC] p-2">
                          <div
                            className={`w-full rounded-[0.9rem] ${
                              index === 2
                                ? 'bg-[linear-gradient(180deg,#38C59A_0%,#15916D_100%)]'
                                : 'bg-[linear-gradient(180deg,#FFBE70_0%,#FF8A00_100%)]'
                            }`}
                            style={{ height: `${value}%` }}
                          />
                        </div>
                        <p className="text-[11px] font-black text-[#14295F]/72">
                          {growthProofCards[index]?.phase}
                        </p>
                        <p className="dashboard-number text-[1.1rem] text-[#14295F]">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/class" className="premium-cta premium-cta-primary h-11 px-6 text-sm">
                국어 수업 자세히 보기
              </Link>
              <Link href="/class#class-consult" className="premium-cta premium-cta-muted h-11 px-6 text-sm">
                상담 문의하기
              </Link>
            </div>
          </article>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            {growthProofCards.map((card, index) => (
              <article
                key={card.phase}
                className="overflow-hidden rounded-[1.2rem] border border-[#14295F]/10 bg-white shadow-[0_10px_26px_-20px_rgba(20,41,95,0.42)]"
              >
                <div className="relative">
                  <img
                    src={card.image}
                    alt={`${card.phase} 성적표 블러 처리본`}
                    className="h-[300px] w-full object-cover object-top"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0d1732]/88 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/70">
                          {card.phase}
                        </p>
                        <p className="mt-1 text-[14px] font-black text-white">{card.summary}</p>
                      </div>
                      <span className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-black text-white">
                        STEP {index + 1}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-[1.2rem] border border-[#14295F]/10 bg-white/90 px-4 py-4 sm:px-5">
          <p className="flex flex-col items-start gap-3 break-keep text-[12.5px] font-semibold text-[#425b78] sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#FF7A16]" />
              과정 관리와 과목 코칭을 함께 설계하면, 성적의 변화도 구간별 데이터로 증명할 수 있습니다.
            </span>
            <Link href="/class" className="inline-flex items-center gap-1 font-black text-[#14295F]">
              국어 수업 방식 보기
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
