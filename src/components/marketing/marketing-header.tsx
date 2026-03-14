import Image from 'next/image';
import Link from 'next/link';

import type { MarketingContent } from '@/lib/marketing-content';

type MarketingHeaderProps = {
  brand: MarketingContent['brand'];
  nav: MarketingContent['nav'];
};

export function MarketingHeader({ brand, nav }: MarketingHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-[#14295F]/10 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-3">
          <Image src={brand.logoMark} alt={`${brand.name} 로고`} width={34} height={34} className="h-[34px] w-[34px] rounded-md object-contain" />
          <span className="font-brand text-base text-[#14295F] sm:text-[1.05rem]">{brand.name}</span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="text-[13px] font-bold text-[#14295F]/80 transition hover:text-[#14295F]">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/go/login?placement=header"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-[#FF7A16] px-3.5 text-xs font-black text-white transition hover:bg-[#f16803]"
          >
            웹앱 로그인
          </Link>
          <Link
            href="/go/experience?placement=header"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#14295F]/12 bg-[#14295F] px-3.5 text-xs font-black text-white shadow-[0_10px_18px_rgba(20,41,95,0.2)] transition hover:bg-[#10224B]"
          >
            웹앱 체험
          </Link>
        </div>
      </div>

      <div className="border-t border-[#14295F]/10 lg:hidden">
        <nav className="mx-auto flex h-10 w-full max-w-7xl items-center gap-4 overflow-x-auto px-4 sm:px-6">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="whitespace-nowrap text-[11px] font-bold text-[#14295F]/70">
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}