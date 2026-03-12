import { Smartphone } from "lucide-react";

import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type AppSystemSectionProps = {
  appSystem: MarketingContent["appSystem"];
};

export function AppSystemSection({ appSystem }: AppSystemSectionProps) {
  return (
    <section id="app-system" className="scroll-mt-28 bg-[#0A1C4D] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div>
            <SectionHeading light eyebrow="Student App" title={appSystem.heading} description={appSystem.description} />
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {appSystem.features.map((item) => (
                <li key={item.title} className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-base font-black text-white">{item.title}</p>
                  <p className="mt-2 break-keep text-sm font-bold leading-relaxed text-white/75">{item.description}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {appSystem.appScreens.map((screen) => (
              <article key={screen.title} className="rounded-[2rem] border border-white/20 bg-white/10 p-3 shadow-xl backdrop-blur-sm">
                <div className="rounded-[1.65rem] border border-white/15 bg-[#09173D] p-4">
                  <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/40" />
                  <div className="rounded-2xl border border-dashed border-white/25 bg-[#112A66] p-4">
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#FF7A16]/20 text-[#FFB273]">
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <p className="mt-3 break-keep text-sm font-black text-white">{screen.title}</p>
                    <p className="mt-1 text-xs font-bold text-[#FFB273]">{screen.subtitle}</p>
                    <p className="mt-3 break-keep text-xs font-bold leading-relaxed text-white/70">{screen.caption}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
