import Link from 'next/link';

import type { MarketingContent } from '@/lib/marketing-content';

import { SectionHeading } from './section-heading';

type ClassSystemSectionProps = {
  classSystem: MarketingContent['classSystem'];
};

export function ClassSystemSection({ classSystem }: ClassSystemSectionProps) {
  const preview = classSystem.slice(0, 2);

  return (
    <section id="class-system" className="scroll-mt-28 bg-[#F4F7FF] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Academy Program"
          title="국어 입시학원 수업 시스템 · 별도 선택 프로그램"
          description="그룹 수업으로 수능 대비를 진행합니다. 수능특강 독서, 평가원, 사설 모의고사 흐름까지 실전 중심으로 정리합니다."
        />

        <div className="marketing-card mt-6 flex items-center gap-3 px-5 py-3.5 text-[14px] font-semibold text-[#14295F]">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: 'linear-gradient(135deg, #FF7A16, #FF9848)' }}
          />
          관리형 스터디센터 이용과 국어 입시학원 수업은 각각 선택 가능합니다.
        </div>

        <div className="mt-5 grid gap-4">
          {preview.map((step, index) => (
            <article key={step.title} className="marketing-card flex gap-5 p-6">
              <div className="step-badge mt-0.5 shrink-0">{index + 1}</div>
              <div>
                <h3 className="break-keep text-[1.2rem] font-extrabold text-[#14295F]">
                  {step.title}
                </h3>
                <p className="mt-2 break-keep text-[15px] font-medium leading-[1.8] text-slate-600">
                  {step.description}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-5 text-center">
          <Link
            href="/class"
            className="inline-flex items-center gap-2 rounded-xl border border-[rgba(20,41,95,0.18)] bg-white px-6 py-3 text-[14px] font-bold text-[#14295F] shadow-sm transition-[transform,background-color] duration-100 hover:bg-[#f0f4ff] active:scale-[0.97] active:brightness-[0.93]"
          >
            수업 과정 전체 보기
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
