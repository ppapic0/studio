import { CheckCircle2, ShieldCheck } from "lucide-react";

import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type StudyCafeSectionProps = {
  studyCafe: MarketingContent["studyCafe"];
};

export function StudyCafeSection({ studyCafe }: StudyCafeSectionProps) {
  return (
    <section id="study-cafe" className="scroll-mt-28 bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Study Cafe First" title={studyCafe.heading} description={studyCafe.description} />

        <div className="marketing-card-soft mt-8 p-4 sm:p-5">
          <p className="inline-flex items-center gap-2 text-sm font-black text-[#14295F]">
            <ShieldCheck className="h-4 w-4 text-[#FF7A16]" />
            운영 안내
          </p>
          <div className="mt-3 grid gap-2 text-sm font-bold text-slate-700 sm:grid-cols-2">
            <p className="rounded-lg border border-[#14295F]/10 bg-white px-3 py-2">관리형 스터디카페는 학습환경 운영 중심 서비스입니다.</p>
            <p className="rounded-lg border border-[#14295F]/10 bg-white px-3 py-2">입시학원 수업은 별도 등록 학생 대상으로 선택 운영됩니다.</p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            {studyCafe.features.map((item) => (
              <article key={item.title} className="marketing-card-soft p-5">
                <p className="inline-flex items-center gap-2 text-xs font-black tracking-[0.08em] text-[#FF7A16]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  TRACK STANDARD
                </p>
                <h3 className="mt-2 break-keep text-xl font-black text-[#14295F]">{item.title}</h3>
                <p className="mt-2 break-keep text-sm font-bold leading-relaxed text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>

          <div className="marketing-card-soft p-6">
            <p className="text-xs font-black tracking-[0.18em] text-[#FF7A16]">PREMIUM SEAT</p>
            <h3 className="font-brand mt-3 break-keep text-2xl font-bold text-[#14295F]">집중을 높이는 좌석 설계</h3>

            <div className="mt-5 space-y-4">
              {studyCafe.seatTypes.map((seat) => (
                <article key={seat.title} className="marketing-card p-4">
                  <h4 className="text-lg font-black text-[#14295F]">{seat.title}</h4>
                  <p className="mt-2 break-keep text-sm font-bold leading-relaxed text-slate-600">{seat.description}</p>
                </article>
              ))}
            </div>

            <div className="marketing-card mt-5 p-4">
              <p className="text-sm font-black text-[#14295F]">이용 형태</p>
              <ul className="mt-2 space-y-1 text-sm font-bold text-slate-600">
                <li>• 스터디카페 단독 이용 가능</li>
                <li>• 입시학원 수업은 별도 선택 가능</li>
                <li>• 학생 상황에 맞춘 유연한 등록 구조</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
