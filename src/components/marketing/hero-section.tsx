import Image from 'next/image';

import { HeroShowcase } from './hero-showcase';
import type { MarketingContent } from '@/lib/marketing-content';

type HeroSectionProps = {
  brand: MarketingContent['brand'];
};

export function HeroSection({ brand }: HeroSectionProps) {
  return (
    <section
      id="hero"
      className="relative flex min-h-[100svh] items-center overflow-hidden bg-[#0b1631]"
    >
      {/* ── Layer 1: base gradients ── */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_15%_0%,rgba(25,65,170,0.52),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_40%_at_85%_8%,rgba(255,122,22,0.08),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_105%,rgba(8,18,52,0.65),transparent)]" />
      </div>

      {/* ── Layer 2: logo watermark — embedded, not floating ── */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        {/* Logo image: desaturated + blurred → just a silhouette */}
        <div
          className="absolute bottom-[-8%] right-[-6%] h-[420px] w-[420px] sm:bottom-[-10%] sm:right-[-4%] sm:h-[540px] sm:w-[540px] lg:bottom-[-12%] lg:right-[-3%] lg:h-[680px] lg:w-[680px]"
          style={{ opacity: 0.11 }}
        >
          <Image
            src={brand.logoMark}
            alt=""
            fill
            sizes="680px"
            className="object-contain"
            style={{
              filter: 'blur(2px) saturate(0.15) brightness(0.55)',
            }}
          />
          {/* Gradient overlay fades edges back into navy */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 75% 75% at 62% 58%, transparent 28%, rgba(11,22,49,0.72) 68%, rgba(11,22,49,1) 100%)',
            }}
          />
        </div>
        {/* Left-side hard fade so watermark never intrudes on text */}
        <div
          className="absolute inset-y-0 right-0 w-[75%] lg:w-[65%]"
          style={{
            background:
              'linear-gradient(to right, rgba(11,22,49,1) 0%, rgba(11,22,49,0.55) 28%, transparent 60%)',
          }}
        />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_0.88fr] lg:items-center lg:gap-14 lg:px-8 lg:py-20">
        {/* LEFT: Headline + copy + CTA */}
        <div className="space-y-8">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <Image
              src={brand.logoMark}
              alt={brand.name}
              width={28}
              height={28}
              className="h-7 w-7 object-contain opacity-75"
            />
            <span className="text-[10.5px] font-black tracking-[0.24em] text-white/45 uppercase">
              Track
            </span>
          </div>

          {/* Headline */}
          <div className="space-y-5">
            <h1 className="font-brand break-keep text-[clamp(2.5rem,5.2vw,4rem)] leading-[1.04] text-white">
              관리의 중심은
              <br />
              <span className="text-[#FF7A16]">스터디센터</span>입니다
            </h1>
            <p className="max-w-[420px] break-keep text-[15px] font-semibold leading-[1.82] text-blue-100/58">
              루틴을 먼저 세우고, 데이터로 확인합니다.
              <br />
              수능 국어 수업은 필요할 때 별도로 선택합니다.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3">
            <a
              href="/go/experience?placement=hero_experience"
              className="premium-cta premium-cta-primary h-12 px-7 text-[14px]"
            >
              웹앱 체험하기
            </a>
            <a
              href="#consult"
              className="premium-cta premium-cta-ghost h-12 px-7 text-[14px]"
            >
              상담 신청하기
            </a>
          </div>

          {/* Trust signal */}
          <p className="text-[12px] font-semibold text-white/28">
            2026학년도 · 고려대 2명 포함 주요 대학 합격
          </p>
        </div>

        {/* RIGHT: Auto-rotating showcase */}
        <HeroShowcase />
      </div>
    </section>
  );
}
