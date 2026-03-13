import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type LPSystemSectionProps = {
  lpSystem: MarketingContent["lpSystem"];
};

export function LPSystemSection({ lpSystem }: LPSystemSectionProps) {
  return (
    <section id="lp-system" className="scroll-mt-28 bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="LP System" title={lpSystem.heading} description={lpSystem.description} />

        <div className="mt-9 grid gap-4 lg:grid-cols-5">
          {lpSystem.cycle.map((step, index) => (
            <article
              key={step.title}
              className="relative rounded-2xl border border-[#14295F]/10 bg-[#F8FAFF] p-5 shadow-[0_10px_20px_rgba(20,41,95,0.08)]"
            >
              <p className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#14295F] text-xs font-black text-white">
                {index + 1}
              </p>
              <h3 className="font-display mt-3 break-keep text-xl font-bold text-[#14295F]">{step.title}</h3>
              <p className="mt-2 break-keep text-sm font-bold leading-relaxed text-slate-600">{step.description}</p>
              {index < lpSystem.cycle.length - 1 ? (
                <span className="absolute -right-2 top-1/2 hidden h-0.5 w-4 -translate-y-1/2 bg-[#FF7A16] lg:block" />
              ) : null}
            </article>
          ))}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {lpSystem.benefits.map((benefit) => (
            <article key={benefit} className="rounded-xl border border-[#14295F]/10 bg-[#F3F8FF] px-4 py-3 text-sm font-black text-[#14295F]">
              {benefit}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
