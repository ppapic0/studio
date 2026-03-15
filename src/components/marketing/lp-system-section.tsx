import Link from 'next/link';

import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type LPSystemSectionProps = {
  lpSystem: MarketingContent["lpSystem"];
};

export function LPSystemSection({ lpSystem }: LPSystemSectionProps) {
  const preview = lpSystem.cycle.slice(0, 2);

  return (
    <section id="lp-system" className="scroll-mt-28 bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="LP System" title={lpSystem.heading} description={lpSystem.description} />

        <div className="mt-9 grid gap-4">
          {preview.map((step, index) => (
            <article key={step.title} className="marketing-card flex gap-5 p-6">
              <div className="step-badge mt-0.5 shrink-0">{index + 1}</div>
              <div>
                <h3 className="break-keep text-[1.2rem] font-extrabold leading-[1.22] text-[#14295F]">
                  {step.title}
                </h3>
                <p className="mt-2 break-keep text-[15px] font-semibold leading-[1.8] text-slate-600">
                  {step.description}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-5 text-center">
          <Link
            href="/lp"
            className="inline-flex items-center gap-2 rounded-xl border border-[rgba(20,41,95,0.18)] bg-white px-6 py-3 text-[14px] font-bold text-[#14295F] shadow-sm transition-[transform,background-color] duration-100 hover:bg-[#f0f4ff] active:scale-[0.97] active:brightness-[0.93]"
          >
            LP 사이클 전체 보기
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
