import { Smartphone } from "lucide-react";

import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type AppSystemSectionProps = {
  appSystem: MarketingContent["appSystem"];
};

export function AppSystemSection({ appSystem }: AppSystemSectionProps) {
  return (
    <section id="app-system" className="scroll-mt-28 bg-[#F6F9FF] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div>
            <SectionHeading eyebrow="Student App" title={appSystem.heading} description={appSystem.description} />
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {appSystem.features.map((item) => (
                <li key={item.title} className="rounded-xl border border-[#14295F]/10 bg-white p-4 shadow-[0_8px_20px_rgba(20,41,95,0.06)]">
                  <p className="text-base font-black text-[#14295F]">{item.title}</p>
                  <p className="mt-2 break-keep text-sm font-bold leading-relaxed text-slate-600">{item.description}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {appSystem.appScreens.map((screen) => (
              <article key={screen.title} className="rounded-[2rem] border border-[#14295F]/12 bg-white p-3 shadow-[0_16px_30px_rgba(20,41,95,0.12)]">
                <div className="rounded-[1.65rem] border border-[#14295F]/10 bg-[#F9FBFF] p-4">
                  <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-[#14295F]/30" />
                  <div className="rounded-2xl border border-dashed border-[#14295F]/25 bg-[linear-gradient(170deg,#EEF3FF,#F7FAFF)] p-4">
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#FF7A16]/15 text-[#FF7A16]">
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <p className="font-display mt-3 break-keep text-sm font-bold text-[#14295F]">{screen.title}</p>
                    <p className="mt-1 text-xs font-bold text-[#FF7A16]">{screen.subtitle}</p>
                    <p className="mt-3 break-keep text-xs font-bold leading-relaxed text-slate-600">{screen.caption}</p>
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
