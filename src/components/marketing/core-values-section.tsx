import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type CoreValuesSectionProps = {
  valueCards: MarketingContent["valueCards"];
};

export function CoreValuesSection({ valueCards }: CoreValuesSectionProps) {
  return (
    <section id="core-value" className="scroll-mt-28 bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Core Value"
          title="한눈에 보이는 트랙의 차이"
          description="관리형 스터디센터 중심, 수능 국어 수업 별도 선택, 학부모 실시간 확인, 데이터 기반 운영 구조를 한 흐름으로 묶었습니다."
        />

        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {valueCards.map((card, i) => (
            <article
              key={card.title}
              className="marketing-card group relative overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1.5"
            >
              {/* Gradient number bg */}
              <div
                className="absolute right-4 top-4 text-[4.5rem] font-black leading-none tracking-tighter text-[#14295F] opacity-[0.04] select-none"
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, '0')}
              </div>

              {/* Orange accent bar */}
              <div
                className="h-1 w-10 rounded-full transition-all duration-300 group-hover:w-16"
                style={{ background: 'linear-gradient(90deg, #FF7A16, #FF9848)' }}
              />

              <h3 className="mt-5 break-keep text-[1.4rem] font-extrabold leading-[1.18] tracking-[-0.035em] text-[#14295F]">
                {card.title}
              </h3>
              <p className="mt-3 break-keep text-sm font-medium leading-[1.76] text-slate-600">
                {card.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
