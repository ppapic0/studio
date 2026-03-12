import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type ClassSystemSectionProps = {
  classSystem: MarketingContent["classSystem"];
};

export function ClassSystemSection({ classSystem }: ClassSystemSectionProps) {
  return (
    <section id="class-system" className="scroll-mt-28 bg-[#F3F7FF] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Class System"
          title="국어 수업 운영 프로세스"
          description="진단부터 수업, 자료, 복습, 생활관리까지 연결되는 구조로 성과의 재현성을 높입니다."
        />

        <div className="mt-10 grid gap-4 md:grid-cols-5">
          {classSystem.map((step, index) => (
            <article
              key={step.title}
              className="relative rounded-2xl border border-[#14295F]/10 bg-white p-5 shadow-[0_10px_25px_rgba(20,41,95,0.08)]"
            >
              <div className="mb-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#14295F] text-sm font-black text-white">
                {index + 1}
              </div>
              <h3 className="font-display break-keep text-lg font-bold text-[#14295F]">{step.title}</h3>
              <p className="mt-2 break-keep text-sm font-bold leading-relaxed text-slate-600">{step.description}</p>
              {index < classSystem.length - 1 ? (
                <span className="absolute -right-2 top-1/2 hidden h-0.5 w-4 -translate-y-1/2 bg-[#FF7A16] md:block" />
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
