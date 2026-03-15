import Image from 'next/image';

import type { MarketingContent } from '@/lib/marketing-content';

type MarketingFooterProps = {
  brand: MarketingContent['brand'];
  footer: MarketingContent['footer'];
};

export function MarketingFooter({ brand, footer }: MarketingFooterProps) {
  return (
    <footer
      style={{
        background: 'linear-gradient(180deg, #0a1430 0%, #0c1840 100%)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
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
            <div className="mt-6 flex flex-wrap gap-2.5">
              <a href="#consult" className="premium-cta premium-cta-primary h-10 px-4 text-xs">
                상담 문의
              </a>
              <a href="/go/login?placement=footer" className="premium-cta premium-cta-ghost h-10 px-4 text-xs">
                웹앱 로그인
              </a>
              <a href="/go/experience?placement=footer" className="premium-cta premium-cta-ghost h-10 px-4 text-xs">
                웹앱 체험
              </a>
            </div>
          </div>

          <div
            className="rounded-2xl border p-5 space-y-3"
            style={{
              borderColor: 'rgba(255,255,255,0.09)',
              background: 'rgba(255,255,255,0.04)',
            }}
          >
            <p className="text-sm font-semibold text-white/60">{footer.phone}</p>
            <p className="break-keep text-sm font-semibold text-white/60">{footer.location}</p>
            <p className="text-sm font-semibold text-white/60">{footer.hours}</p>
          </div>
        </div>

        <div
          className="mt-10 pt-6 text-[12px] font-semibold text-white/28"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          © {new Date().getFullYear()} {brand.name}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
