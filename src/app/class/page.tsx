import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { SectionHeading } from '@/components/marketing/section-heading';
import { marketingContent } from '@/lib/marketing-content';

export default function ClassPage() {
  const { classSystem } = marketingContent;

  return (
    <main className="min-h-screen bg-[#F4F7FF] text-slate-900">
      <MarketingHeader brand={marketingContent.brand} nav={marketingContent.nav} />

      <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-32 sm:px-6 lg:px-8">
        <Link
          href="/#class-system"
          className="mb-8 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#14295F]/60 transition-colors hover:text-[#14295F]"
        >
          <ChevronLeft className="h-4 w-4" />
          홈으로 돌아가기
        </Link>

        <SectionHeading
          eyebrow="Academy Program"
          title="국어 입시학원 수업 시스템"
          description="수능 대비 중심으로 설계된 수업 흐름 전체를 소개합니다. 관리형 스터디센터 이용과 별도로 선택할 수 있습니다."
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

        <div className="mt-5 grid gap-4">
          {classSystem.map((step, index) => (
            <article key={step.title} className="marketing-card flex gap-5 p-7">
              <div className="step-badge mt-0.5 shrink-0">{index + 1}</div>
              <div>
                <h3 className="break-keep text-[1.3rem] font-extrabold tracking-[-0.03em] text-[#14295F]">
                  {step.title}
                </h3>
                <p className="mt-2.5 break-keep text-[15px] font-medium leading-[1.85] text-slate-600">
                  {step.description}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-[1.5rem] border border-[rgba(20,41,95,0.08)] bg-white p-6 text-center">
          <p className="text-[15px] font-semibold text-slate-600">수업 등록 및 일정 문의는 상담을 통해 안내해 드립니다.</p>
          <Link
            href="/#consult"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#14295F] px-6 py-3 text-[14px] font-bold text-white shadow-sm transition-[transform,background-color] duration-100 hover:bg-[#1a3570] active:scale-[0.97] active:brightness-[0.93]"
          >
            상담 문의하기
          </Link>
        </div>
      </div>

      <MarketingFooter brand={marketingContent.brand} footer={marketingContent.footer} />
    </main>
  );
}
