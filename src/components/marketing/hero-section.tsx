import Image from 'next/image';

import type { MarketingContent } from '@/lib/marketing-content';

type HeroSectionProps = {
  brand: MarketingContent['brand'];
  heroStats: MarketingContent['heroStats'];
};

export function HeroSection({ brand, heroStats }: HeroSectionProps) {
  const [resultStat] = heroStats;

  return (
    <section
      id="hero"
      className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-[#0b1631] px-6 pb-24 pt-10 text-center"
    >
      {/* Background gradients */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_20%_0%,rgba(30,72,180,0.50),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_80%_10%,rgba(255,122,22,0.14),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_110%,rgba(10,22,60,0.7),transparent)]" />
      </div>

      {/* Brand mark */}
      <div className="relative mb-8 flex items-center gap-3 opacity-60">
        <Image
          src={brand.logoMark}
          alt={brand.name}
          width={28}
          height={28}
          className="h-7 w-7 object-contain"
        />
        <span className="text-[11px] font-black tracking-[0.22em] text-white/70 uppercase">
          Track Managed Study Center
        </span>
      </div>

      {/* Result — main focus */}
      <div className="relative max-w-3xl">
        <p className="mb-5 text-[11px] font-black tracking-[0.26em] text-[#FF9848] uppercase">
          {resultStat?.label}
        </p>

        <h1 className="font-brand break-keep text-[clamp(2.6rem,6.5vw,5rem)] leading-[1.04] text-white">
          {resultStat?.value}
        </h1>

        <p className="mt-6 text-base font-semibold text-white/50">
          {resultStat?.detail}
        </p>
      </div>

      {/* CTAs */}
      <div className="relative mt-12 flex flex-wrap items-center justify-center gap-3">
        <a
          href="/go/experience?placement=hero_experience_primary"
          className="premium-cta premium-cta-primary h-12 px-7 text-[14px]"
        >
          웹앱 체험하기
        </a>
        <a
          href="#intro"
          className="premium-cta premium-cta-ghost h-12 px-7 text-[14px]"
        >
          트랙 소개
        </a>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
        <span className="text-[10px] font-black tracking-[0.24em] text-white uppercase">Scroll</span>
        <div className="h-10 w-px bg-gradient-to-b from-white to-transparent" />
      </div>
    </section>
  );
}
