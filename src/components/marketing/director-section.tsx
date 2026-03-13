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
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#14295F]/15 bg-[#F8FAFF] px-4 py-2">
              <BadgeCheck className="h-4 w-4 text-[#FF7A16]" />
              <span className="text-sm font-black text-[#14295F]">교육학·국어국문 전공 기반 수업 설계</span>
            </div>
            <ul className="mt-6 space-y-3">
              {director.highlights.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-xl border border-[#14295F]/10 bg-[#F8FAFF] px-4 py-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#FF7A16]" />
                  <p className="break-keep text-sm font-bold text-slate-700">{item}</p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-black tracking-[0.2em] text-[#FF7A16]">TRACK METHOD</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {director.materialSamples.map((sample) => (
                <article
                  key={sample.title}
                  className="overflow-hidden rounded-2xl border border-[#14295F]/10 bg-white p-5 shadow-[0_12px_30px_rgba(20,41,95,0.08)]"
                >
                  <div className="relative h-28 rounded-xl bg-[linear-gradient(145deg,#14295F,#1E418F)] p-4 text-white">
                    <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_22%_26%,rgba(255,255,255,0.18),transparent_18%),radial-gradient(circle_at_80%_74%,rgba(255,122,22,0.42),transparent_22%),linear-gradient(135deg,transparent_0%,transparent_44%,rgba(255,255,255,0.12)_44%,rgba(255,255,255,0.12)_45%,transparent_45%)]" />
                    <div className="relative flex h-full flex-col justify-between">
                      <p className="text-[11px] font-black tracking-[0.16em] text-[#FFD5AE]">{sample.subtitle}</p>
                      <p className="font-display max-w-[12rem] break-keep text-xl font-bold leading-tight">{sample.title}</p>
                    </div>
                  </div>
                  <p className="mt-2 break-keep text-sm font-bold leading-relaxed text-slate-600">{sample.caption}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
