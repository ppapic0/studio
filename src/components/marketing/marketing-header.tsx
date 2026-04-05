import Image from 'next/image';
import Link from 'next/link';

import type { MarketingContent } from '@/lib/marketing-content';

type MarketingHeaderProps = {
  brand: MarketingContent['brand'];
  nav: MarketingContent['nav'];
};

export function MarketingHeader({ brand, nav }: MarketingHeaderProps) {
  const mobileBrandLines = brand.name
    .split('/')
    .map((line, index, lines) => `${line.trim()}${index < lines.length - 1 ? ' /' : ''}`)
    .filter(Boolean);
  const englishBrandLabel = 'MANAGED STUDY CENTER / KOREAN ACADEMY';

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(10, 20, 52, 0.92)',
        backdropFilter: 'blur(12px) saturate(1.15)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 8px 24px -4px rgba(0,0,0,0.28)',
      }}
    >
      <div className="mx-auto flex h-[3.9rem] w-full max-w-7xl items-center justify-between gap-2 px-3 sm:h-[4.25rem] sm:gap-3 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex min-w-0 flex-1 items-center gap-2 transition-opacity hover:opacity-85 sm:gap-2.5">
          <Image
            src="/track-logo-mark-white.png"
            alt={`${brand.name} 로고`}
            width={54}
            height={36}
            className="h-6 w-auto shrink-0 object-contain sm:h-9"
          />
          <div className="grid min-w-0 gap-0.5">
            <div className="grid min-w-0 gap-0.5 sm:hidden">
              {mobileBrandLines.map((line) => (
                <span key={line} className="truncate text-[0.75rem] font-bold leading-[1.1] text-white">
                  {line}
                </span>
              ))}
            </div>
            <span className="hidden max-w-[18rem] break-keep text-[0.72rem] font-bold leading-[1.18] text-white sm:block sm:text-[0.86rem] lg:max-w-[22rem] lg:text-[0.92rem]">
              {brand.name}
            </span>
            <span className="hidden text-[8px] font-black tracking-[0.12em] text-white/50 md:block lg:text-[8.5px]">
              {englishBrandLabel}
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

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <a
            href="/go/login?placement=header"
            className="premium-cta premium-cta-ghost h-8 min-w-[4rem] whitespace-nowrap px-2.5 text-[10.5px] font-extrabold tracking-[-0.01em] sm:h-9 sm:min-w-0 sm:px-4 sm:text-xs"
          >
            <span className="sm:hidden">로그인</span>
            <span className="hidden sm:inline">웹앱 로그인</span>
          </a>
        </div>
      </div>

      {/* Mobile nav */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} className="lg:hidden">
        <nav className="mx-auto flex h-9 w-full max-w-7xl items-center gap-4 overflow-x-auto px-3.5 sm:h-10 sm:gap-5 sm:px-6">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-[10.5px] font-bold text-white/55 transition-colors hover:text-white/90 sm:text-[11px]"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
