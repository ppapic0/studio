import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { CenterOverviewStack } from '@/components/marketing/center-overview-stack';
import { FeedbackManagementSection } from '@/components/marketing/feedback-management-section';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { MarketingPageTracker } from '@/components/marketing/marketing-page-tracker';
import { MockExamProgramSection } from '@/components/marketing/mock-exam-program-section';
import { PointRewardSection } from '@/components/marketing/point-reward-section';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { marketingContent } from '@/lib/marketing-content';

export default function CenterPage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-[linear-gradient(180deg,#F7F9FD_0%,#FFFFFF_18%,#F8FAFE_100%)] text-[#14295F]">
      <MarketingPageTracker pageType="center" placement="center_page" />
      <MarketingHeader brand={marketingContent.brand} nav={marketingContent.nav} />

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            href="/#consult"
            className="inline-flex items-center gap-2 rounded-full bg-[#FF7A16] px-4 py-2 text-[13px] font-black text-white shadow-[0_14px_24px_rgba(255,122,22,0.26)] transition-transform hover:-translate-y-0.5"
          >
            상담 문의
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <CenterOverviewStack className="mt-7" />

      <div className="mx-auto mt-10 w-full max-w-7xl space-y-8 px-4 sm:space-y-10 sm:px-6 lg:px-8">
        <ScrollReveal>
          <FeedbackManagementSection />
        </ScrollReveal>

        <ScrollReveal>
          <MockExamProgramSection mockExamProgram={marketingContent.mockExamProgram} />
        </ScrollReveal>

        <ScrollReveal>
          <PointRewardSection />
        </ScrollReveal>

        <ScrollReveal>
            <section className="relative overflow-hidden rounded-[2.1rem] border border-[#14295F]/10 bg-white px-6 py-7 text-center shadow-[0_20px_46px_rgba(20,41,95,0.08)] sm:px-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,122,22,0.10),transparent_32%)]" />
              <div className="relative mx-auto max-w-3xl">
                <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">NEXT STEP</p>
                <h2 className="mt-3 break-keep text-[clamp(1.55rem,3vw,2.2rem)] font-black leading-[1.2] text-[#14295F]">
                  트랙 시스템과 국어 수업 구조도 이어서 확인해보세요
                </h2>
                <p className="mt-3 break-keep text-[14px] font-semibold leading-[1.8] text-[#425A75]">
                  센터 소개를 먼저 봤다면, 트랙 시스템과 국어 수업 페이지까지 이어서 보면 실제 운영 구조가 더 또렷하게 읽힙니다.
                </p>
                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link href="/experience" className="premium-cta premium-cta-muted h-11 px-6 text-sm">
                    트랙 시스템 보기
                  </Link>
                  <Link href="/class" className="premium-cta premium-cta-primary h-11 px-6 text-sm">
                    국어 수업 보기
                  </Link>
                </div>
              </div>
            </section>
        </ScrollReveal>
      </div>

      <MarketingFooter brand={marketingContent.brand} footer={marketingContent.footer} />
    </main>
  );
}
