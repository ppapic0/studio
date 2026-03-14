import type { MarketingContent } from '@/lib/marketing-content';

import { SectionHeading } from './section-heading';

type ClassSystemSectionProps = {
  classSystem: MarketingContent['classSystem'];
};

export function ClassSystemSection({ classSystem }: ClassSystemSectionProps) {
  return (
    <section id="class-system" className="scroll-mt-28 bg-[#F4F7FF] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Academy Program"
          title="국어 입시학원 수업 시스템 · 별도 선택 프로그램"
          description="그룹 수업으로 수능 대비를 진행합니다. 수능특강 독서, 평가원, 사설 모의고사 흐름까지 실전 중심으로 정리합니다."
        />

        <div
          className="marketing-card mt-6 flex items-center gap-3 px-5 py-3.5 text-[14px] font-semibold text-[#14295F]"
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: 'linear-gradient(135deg, #FF7A16, #FF9848)' }}
          />
          관리형 스터디센터 이용과 국어 입시학원 수업은 각각 선택 가능합니다.
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {classSystem.map((step, index) => (
            <article key={step.title} className="relative">
              {index < classSystem.length - 1 && (
                <div
                  className="absolute -right-1.5 top-9 z-10 hidden h-0.5 w-3 xl:block"
                  style={{ background: 'linear-gradient(90deg, #FF7A16, rgba(255,122,22,0.3))' }}
                />
              )}
              <div className="marketing-card h-full p-5">
                <div className="step-badge mb-4">{index + 1}</div>
                <h3 className="font-display break-keep text-[1.12rem] text-[#14295F]">
                  {step.title}
                </h3>
                <p className="mt-2 break-keep text-sm font-medium leading-[1.76] text-slate-600">
                  {step.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
