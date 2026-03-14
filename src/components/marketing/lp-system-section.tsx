import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type LPSystemSectionProps = {
  lpSystem: MarketingContent["lpSystem"];
};

export function LPSystemSection({ lpSystem }: LPSystemSectionProps) {
  return (
    <section id="lp-system" className="scroll-mt-28 bg-[#F4F7FF] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="LP System" title={lpSystem.heading} description={lpSystem.description} />

        <div className="mt-9 grid gap-3 lg:grid-cols-5">
          {lpSystem.cycle.map((step, index) => (
            <article key={step.title} className="relative">
              {/* Connector line */}
              {index < lpSystem.cycle.length - 1 && (
                <div
                  className="absolute -right-1.5 top-8 z-10 hidden h-0.5 w-3 lg:block"
                  style={{ background: 'linear-gradient(90deg, #FF7A16, rgba(255,122,22,0.3))' }}
                />
              )}

              <div className="marketing-card h-full p-5">
                <div className="step-badge mb-4">{index + 1}</div>
                <h3 className="font-display break-keep text-[1.15rem] leading-[1.22] text-[#14295F]">
                  {step.title}
                </h3>
                <p className="mt-2.5 break-keep text-sm font-medium leading-[1.76] text-slate-600">
                  {step.description}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {lpSystem.benefits.map((benefit) => (
            <article
              key={benefit}
              className="flex items-center gap-3 rounded-[1.2rem] border border-[#14295F]/10 bg-white px-4 py-3.5"
              style={{
                boxShadow: '0 2px 8px -2px rgba(20,41,95,0.06)',
              }}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: 'linear-gradient(135deg, #FF7A16, #FF9848)' }}
              />
              <p className="text-sm font-extrabold text-[#14295F]">{benefit}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
