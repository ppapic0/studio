import type { MarketingContent } from '@/lib/marketing-content';

import { StaggerChildren } from './stagger-children';

type ResultsSectionProps = {
  outcomes: MarketingContent['outcomes'];
  successStory: MarketingContent['successStory'];
};

export function ResultsSection({ outcomes, successStory }: ResultsSectionProps) {
  const universities = outcomes.filter((o) => o.label !== '성장 사례');

  return (
    <section
      id="results"
      className="scroll-mt-20 py-12 sm:py-16"
      style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f7f9fd 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg text-center">
          <span className="eyebrow-badge">2026 RESULT</span>
          <h2 className="font-aggro-display mt-3 break-keep text-[clamp(1.75rem,3.5vw,2.5rem)] font-black leading-[1.1] text-[#14295F]">
            결과가 먼저 보이되
            <br />
            과정의 신뢰가 함께 남습니다
          </h2>
          <p className="mt-3 break-keep text-[14px] font-bold leading-[1.7] text-[#445b75]">
            합격 실적과 성장 사례를 같은 문맥에서 보여주는 홈의 첫 신뢰 섹션입니다.
          </p>
        </div>

        <div className="mt-9">
          <p className="mb-5 text-center text-[10px] font-black uppercase tracking-[0.26em] text-[#14295F]/46">
            주요 합격 실적
          </p>
          <StaggerChildren stagger={80} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {universities.map((u) => (
              <article
                key={u.label}
                className="rounded-2xl border border-[#14295F]/10 bg-white px-4 py-5 text-center shadow-[0_10px_26px_rgba(20,41,95,0.06)]"
              >
                <p className="font-brand text-[2.2rem] font-black leading-none text-[#14295F]">{u.value}</p>
                <p className="mt-2 break-keep text-[12px] font-semibold text-[#47607B]">{u.label}</p>
                <p className="mt-1 text-[10px] font-semibold text-[#14295F]/42">{u.detail}</p>
              </article>
            ))}
          </StaggerChildren>
        </div>

        <div className="mt-5 rounded-2xl border border-[#FF7A16]/18 bg-[#FFF6ED] px-6 py-7 sm:px-8 sm:py-8">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FF9848]">Success Story</p>
          <p className="font-brand mt-3 break-keep text-[1.35rem] font-black leading-[1.24] text-[#14295F] sm:text-[1.55rem]">
            {successStory.summary}
          </p>
        </div>
      </div>
    </section>
  );
}
