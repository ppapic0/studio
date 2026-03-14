import { BadgeCheck } from "lucide-react";

import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type DirectorSectionProps = {
  director: MarketingContent["director"];
};

export function DirectorSection({ director }: DirectorSectionProps) {
  return (
    <section id="director" className="scroll-mt-28 bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <SectionHeading eyebrow="Director" title={director.heading} description={director.description} />
            <div
              className="mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-2"
              style={{
                borderColor: 'rgba(20,41,95,0.12)',
                background: 'linear-gradient(135deg, #F4F7FF, #EEF3FF)',
              }}
            >
              <BadgeCheck className="h-4 w-4 text-[#FF7A16]" />
              <span className="text-sm font-black text-[#14295F]">교육학 · 국어국문 전공 기반 수업 설계</span>
            </div>
            <ul className="mt-6 space-y-2.5">
              {director.highlights.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border bg-white px-4 py-3.5"
                  style={{
                    borderColor: 'rgba(20,41,95,0.09)',
                    boxShadow: '0 2px 8px -2px rgba(20,41,95,0.07)',
                  }}
                >
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: 'linear-gradient(135deg, #FF7A16, #FF9848)' }}
                  />
                  <p className="break-keep text-sm font-medium leading-[1.72] text-slate-600">{item}</p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <span className="eyebrow-badge">TRACK METHOD</span>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {director.materialSamples.map((sample) => (
                <article key={sample.title} className="marketing-card overflow-hidden p-5">
                  <div
                    className="relative h-28 overflow-hidden rounded-2xl p-4 text-white"
                    style={{ background: 'linear-gradient(145deg, #14295F, #1E418F)' }}
                  >
                    <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_22%_26%,rgba(255,255,255,0.18),transparent_18%),radial-gradient(circle_at_80%_74%,rgba(255,122,22,0.42),transparent_22%),linear-gradient(135deg,transparent_0%,transparent_44%,rgba(255,255,255,0.12)_44%,rgba(255,255,255,0.12)_45%,transparent_45%)]" />
                    <div className="relative flex h-full flex-col justify-between">
                      <p className="text-[11px] font-black tracking-[0.16em] text-[#FFD5AE]">{sample.subtitle}</p>
                      <p className="max-w-[12rem] break-keep text-xl font-extrabold leading-[1.15] tracking-[-0.04em]">
                        {sample.title}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 break-keep text-sm font-medium leading-[1.74] text-slate-600">{sample.caption}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
