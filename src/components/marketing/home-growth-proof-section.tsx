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

export function HomeGrowthProofSection() {
  return (
    <section id="growth-proof" className="scroll-mt-24 py-16 sm:py-20" style={{ background: 'linear-gradient(180deg, #f2f6ff 0%, #ffffff 100%)' }}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <article className="marketing-card p-6 sm:p-8">
            <span className="inline-flex items-center rounded-full bg-[#14295F]/8 px-3 py-1 text-[11px] font-black tracking-[0.14em] text-[#14295F] uppercase">
              전과목 코칭 성적 상승 사례
            </span>
            <h2 className="mt-4 break-keep text-[clamp(1.45rem,3.1vw,2.2rem)] font-black leading-[1.2] text-[#14295F]">
              관리와 코칭을 함께 설계했을 때,
              <br />
              성적은 데이터로 올라갑니다
            </h2>
            <p className="mt-4 break-keep text-[14px] font-semibold leading-[1.8] text-[#3f5874] sm:text-[14.5px]">
              단순히 문제를 많이 푸는 방식이 아니라, 학습 루틴·피드백·과목별 코칭을 함께 설계해 성적을 끌어올린 실제 사례입니다.
              이름과 학교는 비공개 처리했습니다.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {['6월 3등급', '9월 1등급', '수능 백분위 99'].map((chip) => (
                <span key={chip} className="rounded-full border border-[#14295F]/12 bg-[#f3f7ff] px-3 py-1.5 text-[12px] font-black text-[#14295F]">
                  {chip}
                </span>
              ))}
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

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {growthProofCards.map((card) => (
              <article key={card.phase} className="overflow-hidden rounded-[1.2rem] border border-[#14295F]/10 bg-white shadow-[0_10px_26px_-20px_rgba(20,41,95,0.42)]">
                <img src={card.image} alt={`${card.phase} 성적표 익명 처리본`} className="h-[300px] w-full object-cover object-top" />
                <div className="space-y-1 border-t border-[#14295F]/8 px-4 py-3.5">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#FF7A16]">{card.phase}</p>
                  <p className="text-[14px] font-black text-[#14295F]">{card.summary}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-[1.1rem] border border-[#14295F]/10 bg-white/85 px-4 py-3">
          <p className="flex items-center gap-2 break-keep text-[12.5px] font-semibold text-[#425b78]">
            <TrendingUp className="h-4 w-4 text-[#FF7A16]" />
            전과목 코칭과 학습 관리 구조를 먼저 세우고, 국어를 핵심 과목으로 밀도 있게 연결했습니다.
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
