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
            <p className="text-xs font-black tracking-[0.2em] text-[#FF7A16]">MATERIAL PREVIEW</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {director.materialSamples.map((sample) => (
                <article
                  key={sample.title}
                  className="rounded-2xl border border-[#14295F]/10 bg-white p-5 shadow-[0_12px_30px_rgba(20,41,95,0.08)]"
                >
                  <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-[#14295F]/25 bg-[#F4F7FF] text-center">
                    <p className="px-4 text-xs font-bold leading-relaxed text-[#14295F]/70">자료 샘플 영역 (개원 후 실자료로 교체 가능)</p>
                  </div>
                  <p className="mt-4 text-[11px] font-black tracking-[0.12em] text-[#FF7A16]">{sample.subtitle}</p>
                  <h3 className="font-display mt-1 break-keep text-lg font-bold text-[#14295F]">{sample.title}</h3>
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
