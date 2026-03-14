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
          title="트랙은 결과로 설명합니다"
          description="과장보다 실적, 수치보다 과정입니다. 실제 합격 결과와 성장 사례를 또렷하게 보여드립니다."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outcomes.map((item) => (
            <article key={item.label} className="marketing-card-soft relative overflow-hidden p-6">
              <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-[#FF7A16]/10" />
              <p className="text-sm font-extrabold text-[#14295F]/80">{item.label}</p>
              <p className="dashboard-number mt-3 break-keep text-[2.2rem] text-[#14295F]">{item.value}</p>
              {item.detail ? <p className="mt-2 text-sm font-medium text-[#FF7A16]">{item.detail}</p> : null}
            </article>
          ))}
        </div>

        <article className="marketing-card-warm mt-6 p-5">
          <p className="text-xs font-black tracking-[0.14em] text-[#B55200]">{successStory.title}</p>
          <p className="mt-2 break-keep text-[1.7rem] font-black leading-[1.18] tracking-[-0.04em] text-[#14295F] sm:text-[2rem]">
            {successStory.summary}
          </p>
        </article>
      </div>
    </section>
  );
}
