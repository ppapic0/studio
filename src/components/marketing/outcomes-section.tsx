import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type OutcomesSectionProps = {
  outcomes: MarketingContent["outcomes"];
};

export function OutcomesSection({ outcomes }: OutcomesSectionProps) {
  return (
    <section id="outcome" className="scroll-mt-28 bg-[#0B1E52] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          light
          eyebrow="Outcome"
          title="숫자로 확인되는 입시 성과"
          description="과장된 문구보다 실제 결과로 증명합니다. 학생 맞춤 수업과 정밀한 관리가 만든 기록입니다."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outcomes.map((item) => (
            <article
              key={item.label}
              className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-[0_16px_35px_rgba(0,0,0,0.18)] backdrop-blur-sm"
            >
              <p className="text-sm font-black text-white/80">{item.label}</p>
              <p className="mt-3 break-keep text-4xl font-black text-white sm:text-5xl">{item.value}</p>
              {item.detail ? <p className="mt-2 text-sm font-bold text-[#FFB273]">{item.detail}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
