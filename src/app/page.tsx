import { ConsultSection } from '@/components/marketing/consult-section';
import { HeroSection } from '@/components/marketing/hero-section';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { MarketingLaunchNoticeModal } from '@/components/marketing/marketing-launch-notice-modal';
import { MarketingPageTracker } from '@/components/marketing/marketing-page-tracker';
import { PageGatewaySection } from '@/components/marketing/page-gateway-section';
import { ResultsSection } from '@/components/marketing/results-section';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { StickyConsultCTA } from '@/components/marketing/sticky-consult-cta';
import { marketingContent } from '@/lib/marketing-content';

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-white pb-24 text-slate-900 sm:pb-0">
      <MarketingPageTracker pageType="landing" placement="landing_root" />
      <MarketingLaunchNoticeModal notice={marketingContent.launchNotice} />
      <MarketingHeader brand={marketingContent.brand} nav={marketingContent.nav} />
      <HeroSection brand={marketingContent.brand} />
      <ScrollReveal>
        <ResultsSection outcomes={marketingContent.outcomes} successStory={marketingContent.successStory} />
      </ScrollReveal>
      <ScrollReveal>
        <PageGatewaySection />
      </ScrollReveal>
      <ScrollReveal>
        <ConsultSection consult={marketingContent.consult} trustMetrics={marketingContent.appSystem.trustMetrics} />
      </ScrollReveal>
      <MarketingFooter brand={marketingContent.brand} footer={marketingContent.footer} />
      <StickyConsultCTA />
    </main>
  );
}
