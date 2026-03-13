import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type OutcomesSectionProps = {
  outcomes: MarketingContent["outcomes"];
  successStory: MarketingContent["successStory"];
};

export function OutcomesSection({ outcomes, successStory }: OutcomesSectionProps) {
  return (
    <section id="outcome" className="scroll-mt-28 bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Outcome"
          title="트랙은 실적으로 증명합니다"
          description="과장된 광고 문구 대신, 실제 합격 결과와 성장 사례를 중심으로 신뢰를 보여드립니다."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outcomes.map((item) => (
            <article
              key={item.label}
              className="relative overflow-hidden rounded-2xl border border-[#14295F]/10 bg-[#F8FAFF] p-6 shadow-[0_12px_28px_rgba(20,41,95,0.08)]"
            >
              <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-[#FF7A16]/10" />
              <p className="text-sm font-black text-[#14295F]/80">{item.label}</p>
              <p className="font-display mt-3 break-keep text-4xl font-bold text-[#14295F]">{item.value}</p>
              {item.detail ? <p className="mt-2 text-sm font-bold text-[#FF7A16]">{item.detail}</p> : null}
            </article>
          ))}
        </div>

        <article className="mt-6 rounded-2xl border border-[#FF7A16]/25 bg-[#FFF4EB] p-5">
          <p className="text-xs font-black tracking-[0.14em] text-[#B55200]">{successStory.title}</p>
          <p className="font-display mt-2 break-keep text-2xl font-bold text-[#14295F] sm:text-3xl">{successStory.summary}</p>
        </article>
      </div>
    </section>
  );
}
