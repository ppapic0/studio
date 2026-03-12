import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type StudyCafeSectionProps = {
  studyCafe: MarketingContent["studyCafe"];
};

export function StudyCafeSection({ studyCafe }: StudyCafeSectionProps) {
  return (
    <section id="study-cafe" className="scroll-mt-28 bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Study Cafe" title={studyCafe.heading} description={studyCafe.description} />

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="grid gap-4">
            {studyCafe.features.map((item) => (
              <article key={item.title} className="rounded-2xl border border-[#14295F]/10 bg-[#F8FAFF] p-6">
                <h3 className="break-keep text-xl font-black text-[#14295F]">{item.title}</h3>
                <p className="mt-2 break-keep text-sm font-bold leading-relaxed text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>

          <div className="rounded-2xl border border-[#14295F]/10 bg-[#0D235D] p-6 text-white shadow-[0_18px_40px_rgba(7,20,57,0.28)]">
            <p className="text-xs font-black tracking-[0.2em] text-[#FFB273]">PREMIUM SEAT</p>
            <h3 className="mt-3 break-keep text-2xl font-black">집중도를 높이는 좌석 설계</h3>

            <div className="mt-5 space-y-4">
              {studyCafe.seatTypes.map((seat) => (
                <article key={seat.title} className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                  <h4 className="text-lg font-black">{seat.title}</h4>
                  <p className="mt-2 break-keep text-sm font-bold leading-relaxed text-white/80">{seat.description}</p>
                </article>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-dashed border-white/25 bg-white/5 px-4 py-6 text-center">
              <p className="text-sm font-bold text-white/75">좌석/공간 실제 사진 교체 영역</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
