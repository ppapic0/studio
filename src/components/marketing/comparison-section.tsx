import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type ComparisonSectionProps = {
  comparison: MarketingContent["comparison"];
};

export function ComparisonSection({ comparison }: ComparisonSectionProps) {
  return (
    <section id="why-track" className="scroll-mt-28 bg-[#F8FAFF] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Why TRACK" title={comparison.heading} description={comparison.description} />

        <div className="marketing-card mt-8 overflow-hidden">
          <div className="hidden grid-cols-[0.9fr_1fr_1fr] bg-[#14295F] px-5 py-3 text-sm font-black text-white md:grid">
            <p>항목</p>
            <p className="text-white/80">일반적인 방식</p>
            <p className="text-[#FFCD9F]">트랙 운영 방식</p>
          </div>

          <div className="divide-y divide-[#14295F]/10">
            {comparison.rows.map((row) => (
              <article key={row.topic} className="grid gap-3 px-5 py-4 md:grid-cols-[0.9fr_1fr_1fr] md:items-center">
                <p className="text-lg font-extrabold tracking-[-0.03em] text-[#14295F]">{row.topic}</p>
                <p className="rounded-lg bg-[#F5F7FB] px-3 py-2 text-sm font-medium leading-[1.74] text-slate-600">{row.common}</p>
                <p className="rounded-lg bg-[#FFF3E8] px-3 py-2 text-sm font-extrabold leading-[1.66] text-[#B85A00]">{row.track}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
