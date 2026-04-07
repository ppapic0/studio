import Image from 'next/image';
import Link from 'next/link';

import { MarketingTrackingOptOutButton } from '@/components/marketing/marketing-tracking-opt-out-button';
import { PRIVACY_ROUTE, TERMS_ROUTE } from '@/lib/legal-documents';
import type { MarketingContent } from '@/lib/marketing-content';

type MarketingFooterProps = {
  brand: MarketingContent['brand'];
  footer: MarketingContent['footer'];
};

export function MarketingFooter({ brand, footer }: MarketingFooterProps) {
  const footerHourLines = footer.hours
    .split(/<br\s*\/?>/i)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <footer
      style={{
        background: 'linear-gradient(180deg, #0a1430 0%, #0c1840 100%)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex items-center gap-3">
              <Image
                src={brand.logoMark}
                alt={`${brand.name} 로고`}
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
              <p className="font-brand text-base text-white">{brand.name}</p>
            </div>
            <p className="mt-4 max-w-md break-keep text-sm font-semibold leading-[1.82] text-white/55">
              {footer.line}
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
              <a href="/#consult" className="premium-cta premium-cta-primary h-10 px-4 text-xs sm:w-auto">
                상담 문의
              </a>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-black text-white/62">
              <Link href={TERMS_ROUTE} className="transition hover:text-[#FFB273]">
                이용약관
              </Link>
              <Link href={PRIVACY_ROUTE} className="transition hover:text-[#FFB273]">
                개인정보처리방침
              </Link>
            </div>
          </div>

          <div
            className="space-y-3 rounded-2xl border p-4 sm:p-5"
            style={{
              borderColor: 'rgba(255,255,255,0.09)',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            <p className="text-sm font-semibold text-white/60">{footer.phone}</p>
            <p className="break-keep text-sm font-semibold text-white/60">{footer.location}</p>
            <div className="space-y-1.5">
              {footerHourLines.map((line) => (
                <p key={line} className="break-keep text-sm font-semibold text-white/60">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>

        <div
          className="mt-8 flex flex-col gap-4 pt-6 text-[12px] font-semibold text-white sm:flex-row sm:items-end sm:justify-between"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div>© {new Date().getFullYear()} {brand.name}. All rights reserved.</div>
          <MarketingTrackingOptOutButton theme="dark" compact className="sm:max-w-fit" />
        </div>
      </div>
    </footer>
  );
}
