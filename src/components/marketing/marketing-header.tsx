import Image from 'next/image';
import Link from 'next/link';

import type { MarketingContent } from '@/lib/marketing-content';

type MarketingHeaderProps = {
  brand: MarketingContent['brand'];
  nav: MarketingContent['nav'];
};

export function MarketingHeader({ brand, nav }: MarketingHeaderProps) {
  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(10, 20, 52, 0.88)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 8px 24px -4px rgba(0,0,0,0.28)',
      }}
    >
      <div className="mx-auto flex h-[4.25rem] w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-3 transition-opacity hover:opacity-85">
          <Image
            src="/track-logo-mark-white.png"
            alt={`${brand.name} 로고`}
            width={54}
            height={36}
            className="h-9 w-auto object-contain"
          />
          <div className="grid gap-0.5">
            <span className="text-[1rem] font-bold text-white sm:text-[1.05rem]">
              {brand.name}
            </span>
            <span className="text-[9.5px] font-black tracking-[0.18em] text-white/50">
              MANAGED STUDY CENTER
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[13px] font-semibold tracking-[-0.01em] text-white/60 transition-colors duration-150 hover:text-white/95"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a href="/go/login?placement=header" className="premium-cta premium-cta-ghost h-9 px-4 text-xs">
            웹앱 로그인
          </a>
          <a href="/go/experience?placement=header" className="premium-cta premium-cta-primary h-10 whitespace-nowrap px-5 text-[13.5px] font-extrabold tracking-[-0.005em] [text-shadow:0_1px_1px_rgba(0,0,0,0.28)]">
            웹앱 체험
          </a>
        </div>
      </div>

      {/* Mobile nav */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} className="lg:hidden">
        <nav className="mx-auto flex h-10 w-full max-w-7xl items-center gap-5 overflow-x-auto px-4 sm:px-6">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-[11px] font-bold text-white/55 transition-colors hover:text-white/90"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
