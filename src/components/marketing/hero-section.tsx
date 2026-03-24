import Image from 'next/image';

import type { MarketingContent } from '@/lib/marketing-content';

import { HeroShowcase } from './hero-showcase';

type HeroSectionProps = {
  brand: MarketingContent['brand'];
  stats: MarketingContent['heroStats'];
};

export function HeroSection({ brand, stats }: HeroSectionProps) {
  return (
    <section
      id="hero"
      className="on-dark relative flex min-h-[100svh] items-center overflow-hidden bg-[#0b1631]"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_15%_0%,rgba(25,65,170,0.52),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_40%_at_85%_8%,rgba(255,122,22,0.08),transparent)]" />
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

      <div className="relative mx-auto grid w-full max-w-7xl gap-8 px-4 py-14 sm:px-6 md:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.88fr)] lg:items-center lg:gap-14 lg:px-8 lg:py-20">
        <div className="space-y-6 sm:space-y-8">
          <span className="eyebrow-badge-light">관리형 스터디센터</span>

          <div className="space-y-5">
            <h1 className="font-aggro-display max-w-[12ch] break-keep text-[clamp(2rem,3.8vw,3rem)] font-black leading-[1.12] text-white">
              공부의 방향이 보이면
              <br />
              성장의 기록도 <span className="text-[#FF7A16]">데이터</span>로 남습니다
            </h1>
            <p className="max-w-[33rem] break-keep text-[15px] font-bold leading-[1.78] text-white/85 sm:text-[15.5px]">
              루틴을 먼저 세우고, 실행을 기록하고, 결과를 다시 전략으로 연결합니다.
              <br />
              트랙은 과정과 결과가 모두 남는 관리형 스터디센터입니다.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href="/go/experience?placement=hero_experience"
              className="premium-cta premium-cta-primary h-12 justify-center px-7 text-[14px] sm:w-auto"
            >
              웹앱 체험하기
            </a>
            <a
              href="#consult"
              className="premium-cta premium-cta-ghost h-12 justify-center px-7 text-[14px] sm:w-auto"
            >
              상담 요청하기
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map((stat, index) => (
              <article
                key={`${stat.label}-${index}`}
                className="rounded-[1.4rem] border border-white/12 bg-white/8 px-4 py-4 shadow-[0_14px_32px_rgba(4,11,29,0.24)] backdrop-blur"
              >
                <p className="text-[10px] font-black tracking-[0.18em] text-white/55">{stat.label}</p>
                <p className="mt-2 break-keep text-[1rem] font-black leading-[1.35] text-white">{stat.value}</p>
                {stat.detail ? (
                  <p className="mt-1.5 break-keep text-[11.5px] font-semibold leading-[1.55] text-white/65">
                    {stat.detail}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </div>

        <HeroShowcase />
      </div>
    </section>
  );
}
