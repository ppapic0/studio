import { AppPreviewSection } from '@/components/marketing/app-preview-section';
import { ConsultSection } from '@/components/marketing/consult-section';
import { DataAnalyticsPreviewSection } from '@/components/marketing/data-analytics-preview-section';
import { DataManagementSection } from '@/components/marketing/data-management-section';
import { FeatureStepsSection } from '@/components/marketing/feature-steps-section';
import { HeroSection } from '@/components/marketing/hero-section';
import { HomeGrowthProofSection } from '@/components/marketing/home-growth-proof-section';
import { KoreanClassSection } from '@/components/marketing/korean-class-section';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { MarketingPageTracker } from '@/components/marketing/marketing-page-tracker';
import { ResultsSection } from '@/components/marketing/results-section';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { StickyConsultCTA } from '@/components/marketing/sticky-consult-cta';
import { marketingContent } from '@/lib/marketing-content';

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-white text-slate-900">
      <MarketingPageTracker pageType="landing" placement="landing_root" />
      <MarketingHeader brand={marketingContent.brand} nav={marketingContent.nav} />
      <HeroSection brand={marketingContent.brand} />
      <ScrollReveal><ResultsSection outcomes={marketingContent.outcomes} successStory={marketingContent.successStory} /></ScrollReveal>
      <ScrollReveal><HomeGrowthProofSection /></ScrollReveal>
      <ScrollReveal><FeatureStepsSection /></ScrollReveal>
      <ScrollReveal><DataManagementSection /></ScrollReveal>
      <ScrollReveal><DataAnalyticsPreviewSection /></ScrollReveal>
      <ScrollReveal><AppPreviewSection /></ScrollReveal>
      <ScrollReveal><KoreanClassSection /></ScrollReveal>
      <ScrollReveal><ConsultSection consult={marketingContent.consult} /></ScrollReveal>
      <MarketingFooter brand={marketingContent.brand} footer={marketingContent.footer} />
      <StickyConsultCTA />
    </main>
  );
}
