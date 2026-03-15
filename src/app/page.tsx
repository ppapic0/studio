import { AppSystemSection } from '@/components/marketing/app-system-section';
import { ClassSystemSection } from '@/components/marketing/class-system-section';
import { ComparisonSection } from '@/components/marketing/comparison-section';
import { ConsultSection } from '@/components/marketing/consult-section';
import { CoreValuesSection } from '@/components/marketing/core-values-section';
import { DirectorSection } from '@/components/marketing/director-section';
import { EntryGatewaySection } from '@/components/marketing/entry-gateway-section';
import { FacilitySection } from '@/components/marketing/facility-section';
import { HeroSection } from '@/components/marketing/hero-section';
import { LPSystemSection } from '@/components/marketing/lp-system-section';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { MarketingPageTracker } from '@/components/marketing/marketing-page-tracker';
import { OutcomesSection } from '@/components/marketing/outcomes-section';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { StudyCafeSection } from '@/components/marketing/study-cafe-section';
import { marketingContent } from '@/lib/marketing-content';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <MarketingPageTracker pageType="landing" placement="landing_root" />
      <MarketingHeader brand={marketingContent.brand} nav={marketingContent.nav} />
      <HeroSection brand={marketingContent.brand} heroStats={marketingContent.heroStats} />
      <ScrollReveal><EntryGatewaySection /></ScrollReveal>
      <ScrollReveal><StudyCafeSection studyCafe={marketingContent.studyCafe} /></ScrollReveal>
      <ScrollReveal><AppSystemSection appSystem={marketingContent.appSystem} /></ScrollReveal>
      <ScrollReveal><LPSystemSection lpSystem={marketingContent.lpSystem} /></ScrollReveal>
      <ScrollReveal><OutcomesSection outcomes={marketingContent.outcomes} successStory={marketingContent.successStory} /></ScrollReveal>
      <ScrollReveal><ComparisonSection comparison={marketingContent.comparison} /></ScrollReveal>
      <ScrollReveal><CoreValuesSection valueCards={marketingContent.valueCards} /></ScrollReveal>
      <ScrollReveal><DirectorSection director={marketingContent.director} /></ScrollReveal>
      <ScrollReveal><ClassSystemSection classSystem={marketingContent.classSystem} /></ScrollReveal>
      <ScrollReveal><FacilitySection facility={marketingContent.facility} /></ScrollReveal>
      <ScrollReveal><ConsultSection consult={marketingContent.consult} /></ScrollReveal>
      <MarketingFooter brand={marketingContent.brand} footer={marketingContent.footer} />
    </main>
  );
}
