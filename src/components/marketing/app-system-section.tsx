import Image from "next/image";
import { ChartColumnBig, CircleAlert, Clock3, Smartphone, Sparkles } from "lucide-react";

import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type AppSystemSectionProps = {
  appSystem: MarketingContent["appSystem"];
};

export function AppSystemSection({ appSystem }: AppSystemSectionProps) {
  const toneClassMap: Record<NonNullable<(typeof appSystem.dataMetrics)[number]["tone"]>, string> = {
    navy: "border-[#14295F]/20 bg-[#F1F5FF] text-[#14295F]",
    orange: "border-[#FF7A16]/25 bg-[#FFF4EB] text-[#B55200]",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-rose-200 bg-rose-50 text-rose-700",
  };

  const hasImageScreens = appSystem.appScreens.some((screen) => Boolean(screen.image));

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

            <div className="mt-8 rounded-2xl border border-[#14295F]/10 bg-white p-5 shadow-[0_10px_24px_rgba(20,41,95,0.08)]">
              <p className="text-xs font-black tracking-[0.16em] text-[#FF7A16]">DATA SNAPSHOT</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {appSystem.dataMetrics.map((metric) => (
                  <article
                    key={`${metric.label}-${metric.value}`}
                    className={`rounded-xl border px-3 py-3 ${
                      metric.tone ? toneClassMap[metric.tone] : "border-[#14295F]/10 bg-[#F8FAFF] text-[#14295F]"
                    }`}
                  >
                    <p className="text-xs font-black">{metric.label}</p>
                    <p className="font-display mt-1 text-xl font-bold">{metric.value}</p>
                    <p className="mt-1 text-[11px] font-bold opacity-80">{metric.detail}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className={`grid gap-4 ${hasImageScreens ? "md:grid-cols-1" : "md:grid-cols-3"}`}>
            {appSystem.appScreens.map((screen, index) => (
              <article
                key={screen.title}
                className="overflow-hidden rounded-[1.8rem] border border-[#14295F]/12 bg-white p-3 shadow-[0_16px_30px_rgba(20,41,95,0.12)]"
              >
                {screen.image ? (
                  <div className="overflow-hidden rounded-[1.2rem] border border-[#14295F]/10 bg-[#EEF3FF]">
                    <div className="relative aspect-[16/9] w-full">
                      <Image
                        src={screen.image}
                        alt={`${screen.title} 화면`}
                        fill
                        sizes="(max-width: 1024px) 100vw, 42vw"
                        className="object-cover object-top"
                        priority={index === 0}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[1.65rem] border border-[#14295F]/10 bg-[#F9FBFF] p-4">
                    <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-[#14295F]/30" />
                    <div className="rounded-2xl border border-dashed border-[#14295F]/25 bg-[linear-gradient(170deg,#EEF3FF,#F7FAFF)] p-4">
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#FF7A16]/15 text-[#FF7A16]">
                        {index === 0 ? <Sparkles className="h-4 w-4" /> : null}
                        {index === 1 ? <ChartColumnBig className="h-4 w-4" /> : null}
                        {index === 2 ? <Smartphone className="h-4 w-4" /> : null}
                      </div>
                      <p className="font-display mt-3 break-keep text-sm font-bold text-[#14295F]">{screen.title}</p>
                      <p className="mt-1 text-xs font-bold text-[#FF7A16]">{screen.subtitle}</p>
                      <p className="mt-3 break-keep text-xs font-bold leading-relaxed text-slate-600">{screen.caption}</p>

                      <div className="mt-3 rounded-xl border border-[#14295F]/10 bg-white px-2.5 py-2">
                        {index === 0 ? (
                          <div className="grid grid-cols-2 gap-2 text-[11px] font-black text-[#14295F]">
                            <span className="rounded-md bg-[#F2F6FF] px-2 py-1">LP 3,164</span>
                            <span className="rounded-md bg-[#F2F6FF] px-2 py-1">평균 98.2</span>
                            <span className="rounded-md bg-[#F2F6FF] px-2 py-1">시즌 #4/4</span>
                            <span className="rounded-md bg-[#F2F6FF] px-2 py-1">부스트 x1.20</span>
                          </div>
                        ) : null}
                        {index === 1 ? (
                          <div className="space-y-1.5 text-[11px] font-black text-[#14295F]">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3 w-3 text-[#FF7A16]" />
                                주간 누적
                              </span>
                              <span>47:23</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[#E5ECFF]">
                              <div className="h-full w-4/5 rounded-full bg-[#14295F]" />
                            </div>
                            <p className="text-[10px] text-[#14295F]/70">일별 학습 시간 추이 자동 분석</p>
                          </div>
                        ) : null}
                        {index === 2 ? (
                          <div className="space-y-1.5 text-[11px] font-black text-[#14295F]">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1">
                                <CircleAlert className="h-3 w-3 text-rose-500" />
                                누적 벌점
                              </span>
                              <span>5점</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[#FFE2E6]">
                              <div className="h-full w-1/3 rounded-full bg-rose-500" />
                            </div>
                            <p className="text-[10px] text-[#14295F]/70">학부모 알림·AI 인사이트 연동</p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}

                <div className="px-2 pb-2 pt-4">
                  <p className="font-display break-keep text-base font-bold text-[#14295F]">{screen.title}</p>
                  <p className="mt-1 break-keep text-xs font-black text-[#FF7A16]">{screen.subtitle}</p>
                  <p className="mt-2 break-keep text-xs font-bold leading-relaxed text-slate-600">{screen.caption}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
