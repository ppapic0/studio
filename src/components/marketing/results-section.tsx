import type { MarketingContent } from '@/lib/marketing-content';

import { StaggerChildren } from './stagger-children';

type ResultsSectionProps = {
  outcomes: MarketingContent['outcomes'];
  successStory: MarketingContent['successStory'];
};

const mobileUniversityLabelMap: Record<string, string> = {
  고려대학교: '고려대',
  서강대학교: '서강대',
  성균관대학교: '성균관대',
  홍익대학교: '홍익대',
  아주대학교: '아주대',
};

export function ResultsSection({ outcomes, successStory }: ResultsSectionProps) {
  const universities = outcomes.filter((o) => o.label !== '성장 사례');

  return (
    <section id="results" className="scroll-mt-20 py-10 sm:py-16" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f7f9fd 100%)' }}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg text-center">
          <span className="eyebrow-badge">2026 RESULT</span>
          <h2 className="font-aggro-display mt-3 break-keep text-[clamp(1.58rem,8vw,2.5rem)] font-black leading-[1.08] text-[#14295F]">
            2026학년도 수능,
            <br />
            트랙의 운영 구조가 만들어 낸 결과입니다.
          </h2>
        </div>

        <div className="mt-9">
          <p className="mb-5 text-center text-[10px] font-black uppercase tracking-[0.26em] text-[#14295F]/46">
            주요 합격 실적
          </p>
          <StaggerChildren stagger={80} className="grid grid-cols-5 gap-1.5 sm:gap-3">
            {universities.map((u) => (
              <article
                key={u.label}
                className="brand-sheen-panel relative min-w-0 overflow-hidden rounded-[1rem] border border-[#14295F]/10 bg-white px-2.5 py-3 text-center shadow-[0_10px_26px_rgba(20,41,95,0.06)] sm:rounded-2xl sm:px-4 sm:py-5"
              >
                <div className="brand-glow-drift absolute -right-6 top-0 h-16 w-16 rounded-full bg-[#FFB878]/10 blur-2xl" />
                <div className="relative">
                  <p className="brand-number-pop font-brand text-[1.35rem] font-black leading-none text-[#14295F] sm:text-[2.2rem]">{u.value}</p>
                  <p className="mt-1.5 break-keep text-[8.5px] font-semibold leading-[1.32] text-[#47607B] sm:mt-2 sm:text-[12px]">
                    <span className="sm:hidden">{mobileUniversityLabelMap[u.label] ?? u.label}</span>
                    <span className="hidden sm:inline">{u.label}</span>
                  </p>
                  <p className="mt-1 hidden text-[10px] font-semibold text-[#14295F]/42 sm:block">{u.detail}</p>
                </div>
              </article>
            ))}
          </StaggerChildren>
        </div>

        <div className="brand-sheen-panel relative mt-5 overflow-hidden rounded-2xl border border-[#FF7A16]/18 bg-[#FFF6ED] px-4 py-5 sm:px-8 sm:py-8">
          <div className="brand-glow-drift absolute right-8 top-4 h-24 w-24 rounded-full bg-[#FFB878]/18 blur-3xl" />
          <p className="relative text-[10px] font-black uppercase tracking-[0.24em] text-[#FF9848]">Success Story</p>
          <div className="relative mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-full sm:max-w-[28rem]">
              <p className="text-[11px] font-black tracking-[0.16em] text-[#FF7A16]">{successStory.title}</p>
              <p className="font-brand mt-2 break-keep text-[1.18rem] font-black leading-[1.22] text-[#14295F] sm:text-[1.55rem]">
                {successStory.summary}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:min-w-[33rem] lg:flex-1">
              {successStory.timeline.map((item) => (
                <article
                  key={item.label}
                  className="rounded-[0.95rem] border border-white/70 bg-white/84 px-2.5 py-3 text-center shadow-[0_12px_28px_rgba(20,41,95,0.06)] backdrop-blur sm:rounded-[1.15rem] sm:px-4 sm:py-4"
                >
                  <p className="text-[9px] font-black tracking-[0.12em] text-[#FF7A16] sm:text-[10px]">{item.label}</p>
                  <p className="mt-1.5 break-keep text-[0.95rem] font-black leading-none text-[#14295F] sm:mt-2 sm:text-[1.15rem]">{item.value}</p>
                  <p className="mt-1.5 text-[9px] font-semibold leading-[1.35] text-[#52677F] sm:mt-2 sm:text-[11px]">{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
