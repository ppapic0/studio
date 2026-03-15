import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type FacilitySectionProps = {
  facility: MarketingContent["facility"];
};

export function FacilitySection({ facility }: FacilitySectionProps) {
  const cardGradients = [
    { bg: 'linear-gradient(155deg, #EDF2FF, #F8FBFF)', accent: 'rgba(20,41,95,0.12)', dot: '#14295F' },
    { bg: 'linear-gradient(155deg, #FFF5EC, #FFFAF7)', accent: 'rgba(255,122,22,0.18)', dot: '#FF7A16' },
    { bg: 'linear-gradient(155deg, #F0F4FF, #F8FBFF)', accent: 'rgba(20,41,95,0.10)', dot: '#14295F' },
  ];

  return (
    <section id="facility" className="scroll-mt-28 bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Facility" title={facility.heading} description={facility.description} />

        <div className="mt-10 mx-auto max-w-3xl grid gap-5 sm:grid-cols-2">
          {facility.gallery.map((item, index) => {
            const g = cardGradients[index % cardGradients.length];
            return (
              <article key={item.title} className="marketing-card group overflow-hidden transition-transform duration-300 hover:-translate-y-1">
                {/* Visual preview block */}
                <div className="relative h-52 overflow-hidden" style={{ background: g.bg }}>
                  <div
                    className="absolute inset-0 opacity-60"
                    style={{
                      backgroundImage: `radial-gradient(circle at 24% 20%, rgba(20,41,95,0.12), transparent 40%), radial-gradient(circle at 78% 76%, ${g.accent}, transparent 36%)`,
                    }}
                  />
                  {/* Decorative shapes */}
                  <div className="absolute inset-4 flex flex-col items-stretch justify-between rounded-2xl border border-white/70 bg-white/65 p-4 backdrop-blur-sm">
                    <p className="text-[10.5px] font-black tracking-[0.18em] text-[#FF7A16]">{item.subtitle}</p>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: g.dot }} />
                        <div className="h-2 flex-1 rounded-full" style={{ background: `${g.dot}22` }} />
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="h-2.5 w-2.5 rounded-full opacity-40" style={{ background: g.dot }} />
                        <div className="h-2 w-4/5 rounded-full" style={{ background: `${g.dot}14` }} />
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="h-12 rounded-xl" style={{ background: `${g.dot}12` }} />
                        <div className="h-12 rounded-xl" style={{ background: 'rgba(255,122,22,0.14)' }} />
                        <div className="h-12 rounded-xl" style={{ background: `${g.dot}10` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="break-keep text-[1.28rem] font-extrabold text-[#14295F]">
                    {item.title}
                  </h3>
                  <p className="mt-2 break-keep text-sm font-medium leading-[1.76] text-slate-600">
                    {item.caption}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
