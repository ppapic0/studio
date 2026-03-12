import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type CoreValuesSectionProps = {
  valueCards: MarketingContent["valueCards"];
};

export function CoreValuesSection({ valueCards }: CoreValuesSectionProps) {
  return (
    <section id="core-value" className="scroll-mt-28 bg-[#F5F8FF] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Core Value"
          title="성과를 만드는 핵심 가치"
          description="트랙 학습센터는 수업 전문성과 관리 정교함, 학습 공간 품질을 하나의 시스템으로 운영합니다."
        />

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {valueCards.map((card) => (
            <article
              key={card.title}
              className="group rounded-2xl border border-[#14295F]/10 bg-white p-6 shadow-[0_12px_30px_rgba(20,41,95,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(20,41,95,0.14)]"
            >
              <div className="h-1.5 w-12 rounded-full bg-[#FF7A16] transition group-hover:w-16" />
              <h3 className="mt-4 break-keep text-2xl font-black text-[#14295F]">{card.title}</h3>
              <p className="mt-3 break-keep text-sm font-bold leading-relaxed text-slate-600">{card.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
