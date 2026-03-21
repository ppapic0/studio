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
      className="on-dark scroll-mt-20 py-12 sm:py-16"
      style={{ background: 'linear-gradient(160deg, #0c1a40 0%, #14295f 55%, #0d1e4a 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <div className="mx-auto max-w-lg text-center">
          <span className="eyebrow-badge-light">2026 RESULT</span>
          <h2 className="font-aggro-display mt-3 break-keep text-[clamp(1.75rem,3.5vw,2.5rem)] font-black leading-[1.1] text-white">
            실력향상으로 이어진
            <br />
            트랙의 입시 데이터입니다
          </h2>
          <p className="mt-3 break-keep text-[14px] font-bold leading-[1.7] text-white/80">
            2026학년도 수능, 트랙의 운영 구조가 만들어 낸 결과입니다.
          </p>
        </div>

        {/* University data board */}
        <div className="mt-9">
          <p className="mb-5 text-center text-[10px] font-black uppercase tracking-[0.26em] text-white/60">
            2026학년도 주요 합격
          </p>
          <StaggerChildren stagger={80} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {universities.map((u) => (
              <article
                key={u.label}
                className="rounded-2xl border border-white/9 bg-white/5 px-4 py-5 text-center"
              >
                <p className="font-brand text-[2.2rem] font-black leading-none text-white">
                  {u.value}
                </p>
                <p className="mt-2 break-keep text-[12px] font-semibold text-white/70">
                  {u.label}
                </p>
                <p className="mt-1 text-[10px] font-semibold text-white/50">{u.detail}</p>
              </article>
            ))}
          </StaggerChildren>
        </div>

        {/* Success story */}
        <div className="mt-5 rounded-2xl border border-[#FF7A16]/22 bg-[#FF7A16]/7 px-6 py-7 sm:px-8 sm:py-8">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FF9848]">
            Success Story
          </p>
          <p className="font-brand mt-3 break-keep text-[1.35rem] font-black leading-[1.24] text-white sm:text-[1.55rem]">
            {successStory.summary}
          </p>
        </div>
      </div>
    </section>
  );
}
