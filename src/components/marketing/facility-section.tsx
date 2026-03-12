import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type FacilitySectionProps = {
  facility: MarketingContent["facility"];
};

export function FacilitySection({ facility }: FacilitySectionProps) {
  return (
    <section id="facility" className="scroll-mt-28 bg-[#F7FAFF] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Facility" title={facility.heading} description={facility.description} />

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {facility.gallery.map((item) => (
            <article key={item.title} className="group overflow-hidden rounded-2xl border border-[#14295F]/10 bg-white">
              <div className="relative h-56 bg-[linear-gradient(160deg,#EDF3FF,#F8FBFF)] p-5">
                <div className="absolute inset-0 opacity-80 [background-image:radial-gradient(circle_at_26%_18%,rgba(20,41,95,0.14),transparent_42%),radial-gradient(circle_at_80%_78%,rgba(255,122,22,0.18),transparent_36%)]" />
                <div className="relative h-full rounded-xl border border-dashed border-[#14295F]/25 bg-white/70 p-4 backdrop-blur-sm">
                  <p className="text-xs font-black tracking-[0.16em] text-[#FF7A16]">PHOTO SLOT</p>
                  <p className="mt-2 text-sm font-bold text-[#14295F]/75">실제 시설 사진 업로드 시 자동 교체</p>
                </div>
              </div>

              <div className="p-5">
                <p className="text-xs font-black tracking-[0.14em] text-[#FF7A16]">{item.subtitle}</p>
                <h3 className="font-display mt-1 break-keep text-xl font-bold text-[#14295F]">{item.title}</h3>
                <p className="mt-2 break-keep text-sm font-bold leading-relaxed text-slate-600">{item.caption}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
