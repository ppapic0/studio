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
          {facility.gallery.map((item, index) => (
            <article key={item.title} className="group overflow-hidden rounded-2xl border border-[#14295F]/10 bg-white">
              <div className="relative h-56 p-5">
                <div
                  className={`absolute inset-0 ${
                    index === 0
                      ? "bg-[linear-gradient(160deg,#EEF4FF,#F8FBFF)]"
                      : index === 1
                        ? "bg-[linear-gradient(160deg,#FFF7F0,#FFFFFF)]"
                        : "bg-[linear-gradient(160deg,#F3F6FF,#FFFFFF)]"
                  }`}
                />
                <div className="absolute inset-0 opacity-80 [background-image:radial-gradient(circle_at_26%_18%,rgba(20,41,95,0.14),transparent_42%),radial-gradient(circle_at_80%_78%,rgba(255,122,22,0.18),transparent_36%)]" />
                <div className="relative flex h-full flex-col justify-between rounded-[1.4rem] border border-white/70 bg-white/65 p-4 backdrop-blur-sm">
                  <p className="text-xs font-black tracking-[0.16em] text-[#FF7A16]">{item.subtitle}</p>
                  <div className="space-y-2">
                    <div className="h-2 w-16 rounded-full bg-[#14295F]" />
                    <div className="h-2 w-24 rounded-full bg-[#14295F]/30" />
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="h-14 rounded-2xl bg-[#14295F]/10" />
                      <div className="h-14 rounded-2xl bg-[#FF7A16]/15" />
                      <div className="h-14 rounded-2xl bg-[#14295F]/10" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5">
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
