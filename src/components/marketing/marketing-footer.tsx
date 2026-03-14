import Image from 'next/image';

import type { MarketingContent } from '@/lib/marketing-content';

type MarketingFooterProps = {
  brand: MarketingContent['brand'];
  footer: MarketingContent['footer'];
};

export function MarketingFooter({ brand, footer }: MarketingFooterProps) {
  return (
    <footer className="border-t border-[#14295F]/10 bg-white py-10">
      <div className="mx-auto grid w-full max-w-7xl gap-7 px-4 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
        <div>
          <div className="inline-flex items-center gap-3">
            <Image src={brand.logoMark} alt={`${brand.name} 로고`} width={36} height={36} className="h-9 w-9 rounded-md object-contain" />
            <p className="font-body text-base font-extrabold tracking-[-0.04em] text-[#14295F]">{brand.name}</p>
          </div>
          <p className="mt-4 break-keep text-sm font-medium leading-[1.8] text-slate-600">{footer.line}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href="#consult"
              className="premium-cta premium-cta-primary h-10 px-4 text-xs"
            >
              상담 문의
            </a>
            <a
              href="/go/login?placement=footer"
              className="premium-cta premium-cta-muted h-10 px-4 text-xs"
            >
              웹앱 로그인
            </a>
            <a
              href="/go/experience?placement=footer"
              className="premium-cta premium-cta-secondary h-10 px-4 text-xs"
            >
              웹앱 체험
            </a>
          </div>
        </div>

        <div className="marketing-card-soft space-y-3 p-5">
          <p className="text-sm font-semibold text-[#14295F]/88">{footer.phone}</p>
          <p className="break-keep text-sm font-semibold text-[#14295F]/88">{footer.location}</p>
          <p className="text-sm font-semibold text-[#14295F]/88">{footer.hours}</p>
        </div>
      </div>
    </footer>
  );
}
