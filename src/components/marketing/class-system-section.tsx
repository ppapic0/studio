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
          eyebrow="Academy Program"
          title="국어 입시학원 수업 시스템 (별도 등록)"
          description="입시학원 프로그램은 별도 등록 학생 대상이며, 그룹 수업 방식으로 수능 대비 중심 커리큘럼을 운영합니다."
        />

        <div className="mt-8 rounded-2xl border border-[#14295F]/12 bg-white px-4 py-3 text-sm font-bold text-[#14295F] sm:px-5">
          ※ 관리형 스터디카페 이용과 입시학원 수강은 각각 선택 가능합니다.
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
                <span className="absolute -right-2 top-1/2 hidden h-0.5 w-4 -translate-y-1/2 bg-[#FF7A16] xl:block" />
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
