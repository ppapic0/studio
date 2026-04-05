import { headers } from 'next/headers';

import { ConsultSection } from '@/components/marketing/consult-section';
import { CenterIntroSection } from '@/components/marketing/center-intro-section';
import { CenterOverviewStack } from '@/components/marketing/center-overview-stack';
import { FeedbackManagementSection } from '@/components/marketing/feedback-management-section';
import { FocusFirewallSection } from '@/components/marketing/focus-firewall-section';
import { HeroSection } from '@/components/marketing/hero-section';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { MarketingLaunchNoticeModal } from '@/components/marketing/marketing-launch-notice-modal';
import { MobileStudySystemSection } from '@/components/marketing/mobile-study-system-section';
import { MarketingPageTracker } from '@/components/marketing/marketing-page-tracker';
import { MockExamProgramSection } from '@/components/marketing/mock-exam-program-section';
import { PointRewardSection } from '@/components/marketing/point-reward-section';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { StickyConsultCTA } from '@/components/marketing/sticky-consult-cta';
import { marketingContent } from '@/lib/marketing-content';

async function isMobileRequest() {
  const requestHeaders = await headers();
  const secChUaMobile = requestHeaders.get('sec-ch-ua-mobile');
  if (secChUaMobile === '?1') {
    return true;
  }

  const userAgent = requestHeaders.get('user-agent') ?? '';
  return /iPhone|iPod|Android.+Mobile|Mobile/i.test(userAgent);
}

export default async function HomePage() {
  const isMobile = await isMobileRequest();

  return (
    <main className="min-h-screen overflow-x-clip bg-white pb-24 text-slate-900 sm:pb-0">
      <MarketingPageTracker pageType="landing" placement="landing_root" />
      <MarketingLaunchNoticeModal notice={marketingContent.launchNotice} />
      <MarketingHeader brand={marketingContent.brand} nav={marketingContent.nav} />
      <HeroSection brand={marketingContent.brand} />
      {isMobile ? (
        <>
          <CenterOverviewStack className="pt-8 sm:pt-10 lg:pt-12" />
          <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
            <ScrollReveal>
              <FeedbackManagementSection />
            </ScrollReveal>
          </div>
          <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
            <ScrollReveal>
              <MockExamProgramSection mockExamProgram={marketingContent.mockExamProgram} />
            </ScrollReveal>
          </div>
          <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
            <ScrollReveal>
              <PointRewardSection />
            </ScrollReveal>
          </div>
          <MobileStudySystemSection content={marketingContent.mobileStudySystem} />
        </>
      ) : (
        <>
          <section className="bg-white pt-8 sm:pt-10 lg:pt-12">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
              <ScrollReveal>
                <CenterIntroSection surface="flat-light" />
              </ScrollReveal>
            </div>
          </section>
          <section className="bg-[#14295F] py-14 lg:py-18">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
              <ScrollReveal>
                <FocusFirewallSection surface="flat-dark" />
              </ScrollReveal>
            </div>
          </section>
          <section className="bg-white py-14 lg:py-18">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
              <ScrollReveal>
                <FeedbackManagementSection surface="flat-light" />
              </ScrollReveal>
            </div>
          </section>
          <section className="bg-[#14295F] py-14 lg:py-18">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
              <ScrollReveal>
                <MockExamProgramSection mockExamProgram={marketingContent.mockExamProgram} surface="flat-dark" />
              </ScrollReveal>
            </div>
          </section>
          <section className="bg-white py-14 lg:py-18">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
              <ScrollReveal>
                <PointRewardSection surface="flat-light" />
              </ScrollReveal>
            </div>
          </section>
        </>
      )}
      <ScrollReveal>
        <ConsultSection consult={marketingContent.consult} trustMetrics={marketingContent.appSystem.trustMetrics} />
      </ScrollReveal>
      <MarketingFooter brand={marketingContent.brand} footer={marketingContent.footer} />
      <StickyConsultCTA />
    </main>
  );
}
