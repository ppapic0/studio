import { cn } from '@/lib/utils';

import { CenterIntroSection } from './center-intro-section';
import { FocusFirewallSection } from './focus-firewall-section';
import { ScrollReveal } from './scroll-reveal';

type CenterOverviewStackProps = {
  className?: string;
};

export function CenterOverviewStack({ className }: CenterOverviewStackProps) {
  return (
    <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>
      <ScrollReveal>
        <CenterIntroSection />
      </ScrollReveal>
      <ScrollReveal className="mt-6 sm:mt-8 lg:mt-10">
        <FocusFirewallSection />
      </ScrollReveal>
    </div>
  );
}
