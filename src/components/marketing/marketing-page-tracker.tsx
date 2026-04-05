'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { trackMarketingClientEvent } from '@/lib/marketing-tracking-client';

type MarketingPageTrackerProps = {
  pageType: 'landing' | 'experience' | 'login' | 'center' | 'results';
  placement?: string;
};

export function MarketingPageTracker({
  pageType,
  placement,
}: MarketingPageTrackerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    if (hasTrackedRef.current) return;
    hasTrackedRef.current = true;

    const mode = searchParams.get('mode');
    const view = searchParams.get('view');

    void trackMarketingClientEvent({
      eventType: 'page_view',
      pageType,
      placement: placement || pathname,
      mode,
      view,
    });
  }, [pageType, pathname, placement, searchParams]);

  return null;
}
