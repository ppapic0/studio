import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type CoreValuesSectionProps = {
  valueCards: MarketingContent["valueCards"];
};

export function CoreValuesSection({ valueCards }: CoreValuesSectionProps) {
  return (
    <section id="core-value" className="scroll-mt-28 bg-[#F8FAFF] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Core Value"
          title="한눈에 보이는 트랙의 차별점"
          description="관리형 스터디센터 중심. 수능 국어 수업 별도 선택. 학부모 앱 실시간 확인. 데이터 기반 관리."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {valueCards.map((card) => (
            <article
              key={card.title}
              className="marketing-card group p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(20,41,95,0.14)]"
            >
              <div className="h-1.5 w-12 rounded-full bg-[#FF7A16] transition group-hover:w-16" />
              <h3 className="font-brand mt-4 break-keep text-2xl font-bold text-[#14295F]">{card.title}</h3>
              <p className="mt-3 break-keep text-sm font-semibold leading-[1.72] text-slate-600">{card.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
