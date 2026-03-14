import Image from 'next/image';
import Link from 'next/link';

import type { MarketingContent } from '@/lib/marketing-content';

type MarketingHeaderProps = {
  brand: MarketingContent['brand'];
  nav: MarketingContent['nav'];
};

export function MarketingHeader({ brand, nav }: MarketingHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#14295F]/8 bg-white/92 backdrop-blur-2xl">
      <div className="mx-auto flex h-[4.35rem] w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-3">
          <Image src={brand.logoMark} alt={`${brand.name} 로고`} width={36} height={36} className="h-9 w-9 rounded-md object-contain" />
          <div className="grid gap-0.5">
            <span className="font-body text-[1rem] font-extrabold tracking-[-0.04em] text-[#14295F] sm:text-[1.08rem]">{brand.name}</span>
            <span className="text-[10px] font-black tracking-[0.16em] text-[#14295F]/45">TRACK MANAGED STUDY CENTER</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="text-[13px] font-semibold tracking-[-0.01em] text-[#14295F]/72 transition hover:text-[#14295F]">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <a href="/go/login?placement=header" className="premium-cta premium-cta-muted h-10 px-4 text-xs">
            웹앱 로그인
          </a>
          <a href="/go/experience?placement=header" className="premium-cta premium-cta-primary h-10 px-4 text-xs">
            웹앱 체험
          </a>
        </div>
      </div>

      <div className="border-t border-[#14295F]/10 lg:hidden">
        <nav className="mx-auto flex h-10 w-full max-w-7xl items-center gap-4 overflow-x-auto px-4 sm:px-6">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="whitespace-nowrap text-[11px] font-bold text-[#14295F]/72">
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
