import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type OutcomesSectionProps = {
  outcomes: MarketingContent["outcomes"];
};

export function OutcomesSection({ outcomes }: OutcomesSectionProps) {
  return (
    <section id="outcome" className="scroll-mt-28 bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Outcome"
          title="숫자로 증명되는 입시 성과"
          description="자극적인 문구보다 실제 결과를 중심으로 성과를 설명합니다."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outcomes.map((item) => (
            <article
              key={item.label}
              className="relative overflow-hidden rounded-2xl border border-[#14295F]/10 bg-[#F8FAFF] p-6 shadow-[0_12px_28px_rgba(20,41,95,0.1)]"
            >
              <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-[#FF7A16]/12" />
              <p className="text-sm font-black text-[#14295F]/80">{item.label}</p>
              <p className="font-display mt-3 break-keep text-4xl font-bold text-[#14295F]">{item.value}</p>
              {item.detail ? <p className="mt-2 text-sm font-bold text-[#FF7A16]">{item.detail}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
