import type { MarketingContent } from '@/lib/marketing-content';

import { SectionHeading } from './section-heading';

type ClassSystemSectionProps = {
  classSystem: MarketingContent['classSystem'];
};

export function ClassSystemSection({ classSystem }: ClassSystemSectionProps) {
  return (
    <section id="class-system" className="scroll-mt-28 bg-[#F3F7FF] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Academy Program"
          title="국어 입시학원 수업 시스템 · 별도 선택 프로그램"
          description="그룹 수업으로 수능 대비를 진행합니다. 수능특강 독서, 평가원, 사설 모의고사 흐름까지 실전 중심으로 정리합니다."
        />

        <div className="marketing-card mt-8 px-4 py-3 text-sm font-semibold text-[#14295F] sm:px-5">
          • 관리형 스터디센터 이용과 국어 입시학원 수업은 각각 선택 가능합니다.
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {classSystem.map((step, index) => (
            <article key={step.title} className="marketing-card relative p-5">
              <div className="mb-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#14295F] text-sm font-black text-white">
                {index + 1}
              </div>
              <h3 className="break-keep text-[1.18rem] font-extrabold tracking-[-0.035em] text-[#14295F]">{step.title}</h3>
              <p className="mt-2 break-keep text-sm font-medium leading-[1.76] text-slate-600">{step.description}</p>
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
