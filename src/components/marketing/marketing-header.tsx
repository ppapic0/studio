import Image from "next/image";
import Link from "next/link";

import type { MarketingContent } from "@/lib/marketing-content";

type MarketingHeaderProps = {
  brand: MarketingContent["brand"];
  nav: MarketingContent["nav"];
};

export function MarketingHeader({ brand, nav }: MarketingHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/15 bg-[#0A1C4D]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-3">
          <Image
            src={brand.logoMark}
            alt={`${brand.name} 로고`}
            width={34}
            height={34}
            className="h-[34px] w-[34px] rounded-md object-cover"
          />
          <span className="text-sm font-black tracking-tight text-white">{brand.name}</span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="text-xs font-bold text-white/80 transition hover:text-white">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="#consult"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-[#FF7A16] px-3.5 text-xs font-black text-white transition hover:bg-[#f16803]"
          >
            상담 문의
          </a>
          <Link
            href="/app"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-white/30 px-3.5 text-xs font-black text-white transition hover:bg-white/10"
          >
            앱 바로가기
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10 lg:hidden">
        <nav className="mx-auto flex h-10 w-full max-w-7xl items-center gap-4 overflow-x-auto px-4 sm:px-6">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="whitespace-nowrap text-[11px] font-bold text-white/75">
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
