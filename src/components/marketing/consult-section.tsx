import Link from "next/link";

import type { MarketingContent } from "@/lib/marketing-content";

import { ConsultForm } from "./consult-form";
import { SectionHeading } from "./section-heading";

type ConsultSectionProps = {
  consult: MarketingContent["consult"];
};

export function ConsultSection({ consult }: ConsultSectionProps) {
  return (
    <section id="consult" className="scroll-mt-28 bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-[#14295F]/10 bg-[linear-gradient(160deg,#F8FAFF,#ECF2FF)] p-7 sm:p-10">
          <SectionHeading eyebrow="Consulting" title={consult.heading} description={consult.description} />

          <div className="mt-7 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <ConsultForm />

            <div className="space-y-4">
              <article className="rounded-xl border border-[#14295F]/10 bg-white p-5">
                <p className="text-xs font-black tracking-[0.14em] text-[#FF7A16]">CONTACT</p>
                <p className="mt-2 break-keep text-lg font-black text-[#14295F]">{consult.contactLine}</p>
              </article>
              <article className="rounded-xl border border-[#14295F]/10 bg-white p-5">
                <p className="text-xs font-black tracking-[0.14em] text-[#FF7A16]">LOCATION</p>
                <p className="mt-2 break-keep text-lg font-black text-[#14295F]">{consult.locationLine}</p>
              </article>

              <div className="flex flex-wrap gap-3">
                <a
                  href="#consult-form"
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-[#FF7A16] px-6 text-sm font-black text-white transition hover:bg-[#f06905]"
                >
                  상담 폼 작성하기
                </a>
                <Link
                  href="/experience"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-[#14295F]/25 bg-white px-6 text-sm font-black text-[#14295F] transition hover:bg-[#F6F9FF]"
                >
                  웹앱 체험하기
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
