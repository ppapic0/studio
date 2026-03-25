import Image from 'next/image';

import type { MarketingContent } from '@/lib/marketing-content';

import { HeroShowcase } from './hero-showcase';

type HeroSectionProps = {
  brand: MarketingContent['brand'];
};

function renderTitleLine(line: string) {
  if (!line.includes('트랙')) {
    return line;
  }

  const [before, after] = line.split('트랙');

  return (
    <>
      {before}
      <span className="text-[#FF7A16]">트랙</span>
      {after}
    </>
  );
}

export function HeroSection({ brand }: HeroSectionProps) {
  const heroTitleLines = brand.heroTitle.split('\n');

  return (
    <section
      id="hero"
      className="on-dark relative flex min-h-[100svh] items-center overflow-hidden bg-[#0b1631]"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_15%_0%,rgba(25,65,170,0.52),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_40%_at_85%_8%,rgba(255,122,22,0.16),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_105%,rgba(8,18,52,0.65),transparent)]" />
      </div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute bottom-[-6%] right-[-12%] h-[320px] w-[320px] sm:bottom-[-8%] sm:right-[-8%] sm:h-[420px] sm:w-[420px] md:bottom-[-10%] md:right-[-5%] md:h-[520px] md:w-[520px] lg:bottom-[-12%] lg:right-[-3%] lg:h-[680px] lg:w-[680px]"
          style={{ opacity: 0.11 }}
        >
          <Image
            src={brand.logoMark}
            alt=""
            fill
            sizes="(max-width: 640px) 320px, (max-width: 1024px) 520px, 680px"
            className="object-contain"
            style={{ filter: 'blur(2px) saturate(0.15) brightness(0.55)' }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 75% 75% at 62% 58%, transparent 28%, rgba(11,22,49,0.72) 68%, rgba(11,22,49,1) 100%)',
            }}
          />
        </div>
        <div
          className="absolute inset-y-0 right-0 w-[75%] lg:w-[65%]"
          style={{
            background:
              'linear-gradient(to right, rgba(11,22,49,1) 0%, rgba(11,22,49,0.55) 28%, transparent 60%)',
          }}
        />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 md:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.96fr)] lg:items-center lg:gap-16 lg:px-8 lg:py-24">
        <div className="max-w-[35rem] space-y-7 sm:space-y-9">
          <div className="space-y-5">
            <span className="eyebrow-badge-light">TRACK STUDY CENTER</span>

            <div className="space-y-5">
              <h1 className="font-aggro-display text-[clamp(1.44rem,6.9vw,4.85rem)] font-black leading-[0.98] tracking-[-0.05em] text-white">
                {heroTitleLines.map((line, index) => (
                  <span key={`${line}-${index}`} className="block whitespace-nowrap break-keep">
                    {renderTitleLine(line)}
                  </span>
                ))}
              </h1>
              <p className="max-w-[32rem] break-keep text-[15px] font-semibold leading-[1.8] text-white/[0.82] sm:text-[16.5px]">
                {brand.heroDescription}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href="#consult"
              className="premium-cta premium-cta-primary h-12 justify-center px-7 text-[14px] sm:w-auto"
            >
              상담 문의하기
            </a>
            <a
              href="/go/experience?placement=hero_experience"
              className="premium-cta premium-cta-ghost h-12 justify-center px-7 text-[14px] sm:w-auto"
            >
              웹앱 체험하기
            </a>
          </div>

          <p className="break-keep text-[12px] font-semibold leading-[1.7] text-white/[0.58] sm:text-[12.5px]">
            관리형 스터디센터 · 국어학원 · 학부모 앱 연동
          </p>
        </div>

        <div className="lg:justify-self-end">
          <HeroShowcase />
        </div>
      </div>
    </section>
  );
}
