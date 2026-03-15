import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type ComparisonSectionProps = {
  comparison: MarketingContent["comparison"];
};

export function ComparisonSection({ comparison }: ComparisonSectionProps) {
  return (
    <section id="why-track" className="scroll-mt-28 bg-[#F4F7FF] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Why TRACK" title={comparison.heading} description={comparison.description} />

        <div className="marketing-card mt-8 overflow-hidden">
          {/* Header row */}
          <div
            className="hidden grid-cols-[0.9fr_1fr_1fr] px-5 py-3.5 text-sm font-black text-white md:grid"
            style={{ background: 'linear-gradient(135deg, #1a3472, #14295f)' }}
          >
            <p className="text-white/60">항목</p>
            <p className="text-white/72">일반적인 방식</p>
            <p className="text-[#FFCD9F]">✓ 트랙 운영 방식</p>
          </div>

          <div className="divide-y divide-[#14295F]/8">
            {comparison.rows.map((row, i) => (
              <article
                key={row.topic}
                className={`grid gap-3 px-5 py-5 md:grid-cols-[0.9fr_1fr_1fr] md:items-center ${
                  i % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFF]'
                }`}
              >
                <p className="text-[1.05rem] font-extrabold tracking-[-0.03em] text-[#14295F]">{row.topic}</p>
                <p className="rounded-xl border border-[#14295F]/8 bg-[#F4F7FB] px-3.5 py-2.5 text-sm font-semibold leading-[1.74] text-slate-600">
                  {row.common}
                </p>
                <p
                  className="rounded-xl border px-3.5 py-2.5 text-sm font-extrabold leading-[1.66]"
                  style={{
                    borderColor: 'rgba(255,122,22,0.20)',
                    background: 'linear-gradient(160deg, #FFF4E8, #FFFAF5)',
                    color: '#B85A00',
                  }}
                >
                  {row.track}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
