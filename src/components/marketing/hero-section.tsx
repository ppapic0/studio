import Image from 'next/image';
import type { CSSProperties } from 'react';

import type { MarketingContent } from '@/lib/marketing-content';

type HeroSectionProps = {
  brand: MarketingContent['brand'];
};

type HeroToken = {
  text: string;
  highlight?: boolean;
  x: string;
  y: string;
  rotate: string;
  scale: string;
  delay: string;
};

function getHeroTokens(line: string, lineIndex: number): HeroToken[] {
  const motionByLine: HeroToken[][] = [
    [{ text: line, x: '-58px', y: '-22px', rotate: '-8deg', scale: '0.88', delay: '0s' }],
    line.includes('트랙')
      ? [
          { text: '성장의 길, ', x: '-34px', y: '30px', rotate: '8deg', scale: '0.92', delay: '0s' },
          { text: '트랙', highlight: true, x: '0px', y: '-52px', rotate: '-10deg', scale: '1.24', delay: '0.04s' },
          { text: '에서', x: '42px', y: '18px', rotate: '7deg', scale: '0.9', delay: '0.1s' },
        ]
      : [{ text: line, x: '-18px', y: '28px', rotate: '6deg', scale: '0.94', delay: '0s' }],
    [{ text: line, x: '46px', y: '42px', rotate: '-7deg', scale: '0.86', delay: '0s' }],
  ];

  return motionByLine[lineIndex] ?? [{ text: line, x: '0px', y: '20px', rotate: '0deg', scale: '0.94', delay: '0s' }];
}

export function HeroSection({ brand }: HeroSectionProps) {
  const heroTitleLines = brand.heroTitle.split('\n');
  const heroFireworks = [
    {
      className: 'right-[10%] top-[7%] h-44 w-44 sm:h-56 sm:w-56 lg:h-72 lg:w-72',
      ringColor: 'rgba(255,188,126,0.34)',
      coreColor: 'rgba(255,136,48,0.28)',
      delay: '0.2s',
      duration: '7.8s',
      opacity: 0.28,
    },
    {
      className: 'left-[16%] top-[26%] h-20 w-20 sm:h-28 sm:w-28 lg:h-32 lg:w-32',
      ringColor: 'rgba(255,170,102,0.3)',
      coreColor: 'rgba(255,214,168,0.18)',
      delay: '1.8s',
      duration: '6.3s',
      opacity: 0.22,
    },
    {
      className: 'left-[9%] bottom-[18%] h-16 w-16 sm:h-24 sm:w-24 lg:h-28 lg:w-28',
      ringColor: 'rgba(112,162,255,0.2)',
      coreColor: 'rgba(255,160,84,0.16)',
      delay: '3.1s',
      duration: '8.6s',
      opacity: 0.14,
    },
  ];
  const heroParticles = [
    {
      className: 'left-[20%] top-[17%] h-1.5 w-1.5 sm:h-2 sm:w-2',
      color: 'rgba(255,206,160,0.92)',
      delay: '0.4s',
      duration: '3.8s',
    },
    {
      className: 'right-[23%] top-[20%] h-2 w-2 sm:h-2.5 sm:w-2.5',
      color: 'rgba(255,153,62,0.88)',
      delay: '1.4s',
      duration: '4.6s',
    },
    {
      className: 'left-[27%] bottom-[24%] h-1.5 w-1.5 sm:h-2 sm:w-2',
      color: 'rgba(158,199,255,0.72)',
      delay: '2.2s',
      duration: '4.1s',
    },
    {
      className: 'right-[15%] bottom-[28%] h-1.5 w-1.5 sm:h-2 sm:w-2',
      color: 'rgba(255,188,126,0.84)',
      delay: '0.9s',
      duration: '3.5s',
    },
    {
      className: 'right-[30%] top-[31%] h-1 w-1 sm:h-1.5 sm:w-1.5',
      color: 'rgba(255,255,255,0.82)',
      delay: '2.8s',
      duration: '4.9s',
    },
  ];

  return (
    <section
      id="hero"
      className="on-dark relative flex min-h-[100svh] items-center overflow-hidden bg-[#0b1631]"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_15%_0%,rgba(25,65,170,0.54),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_48%_40%_at_74%_10%,rgba(255,122,22,0.16),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_36%_28%_at_72%_18%,rgba(255,184,122,0.10),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_34%_30%_at_48%_76%,rgba(255,255,255,0.08),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_105%,rgba(8,18,52,0.65),transparent)]" />
      </div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="hero-orb-drift absolute left-[12%] top-[16%] h-28 w-28 rounded-full bg-[#FF7A16]/10 blur-3xl sm:h-36 sm:w-36"
          style={{ animationDelay: '-1.4s', animationDuration: '9.2s' }}
        />
        <div
          className="hero-orb-drift absolute right-[16%] top-[10%] h-36 w-36 rounded-full bg-[#FF9A47]/12 blur-3xl sm:h-44 sm:w-44 lg:h-56 lg:w-56"
          style={{ animationDelay: '-0.5s', animationDuration: '10.8s' }}
        />
        <div
          className="hero-orb-drift absolute right-[10%] top-[8%] h-40 w-40 rounded-full bg-[#FF7A16]/8 blur-[90px] sm:h-52 sm:w-52 lg:h-72 lg:w-72"
          style={{ animationDelay: '-2.2s', animationDuration: '12.4s' }}
        />
        {heroFireworks.map((firework) => (
          <div
            key={firework.className}
            className={`hero-firework absolute ${firework.className}`}
            style={{
              opacity: firework.opacity,
              animationDelay: firework.delay,
              animationDuration: firework.duration,
              background: `repeating-conic-gradient(from 0deg, ${firework.ringColor} 0deg 4deg, transparent 4deg 18deg)`,
              WebkitMaskImage:
                'radial-gradient(circle, transparent 0%, transparent 28%, black 42%, transparent 72%)',
              maskImage:
                'radial-gradient(circle, transparent 0%, transparent 28%, black 42%, transparent 72%)',
            }}
          >
            <div
              className="hero-firework-core absolute inset-[34%] rounded-full blur-md"
              style={{
                animationDelay: firework.delay,
                animationDuration: firework.duration,
                background: `radial-gradient(circle, ${firework.coreColor} 0%, transparent 76%)`,
              }}
            />
          </div>
        ))}
        {heroParticles.map((particle) => (
          <span
            key={particle.className}
            className={`hero-particle-twinkle absolute rounded-full ${particle.className}`}
            style={{
              background: particle.color,
              boxShadow: `0 0 18px ${particle.color}`,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
            }}
          />
        ))}
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
          className="absolute inset-y-0 right-0 w-full"
          style={{
            background:
              'linear-gradient(to right, rgba(11,22,49,0.98) 0%, rgba(11,22,49,0.76) 24%, rgba(11,22,49,0.34) 60%, transparent 100%)',
          }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl justify-center px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-[53rem] space-y-7 text-center sm:space-y-9">
          <div className="space-y-5">
            <span className="eyebrow-badge-light">TRACK STUDY CENTER</span>

            <div className="space-y-5">
              <div className="hero-headline-shell relative mx-auto inline-flex max-w-full justify-center">
                <div className="hero-headline-aura absolute inset-x-[14%] top-[14%] h-[58%] rounded-full bg-[radial-gradient(circle,rgba(255,122,22,0.22)_0%,rgba(255,184,122,0.12)_28%,transparent_72%)] blur-3xl" />
                <h1 className="font-aggro-display relative text-[clamp(1.52rem,7vw,4.95rem)] font-black tracking-[-0.038em] text-white">
                  <span className="flex flex-col items-center gap-[0.06em] sm:gap-[0.065em]">
                    {heroTitleLines.map((line, lineIndex) => (
                      <span
                        key={`${line}-${lineIndex}`}
                        className="hero-headline-line block whitespace-nowrap break-keep leading-[0.93]"
                        style={{ ['--hero-line-delay' as string]: `${0.06 + lineIndex * 0.1}s` }}
                      >
                        {getHeroTokens(line, lineIndex).map((token, tokenIndex) => (
                          <span
                            key={`${token.text}-${tokenIndex}`}
                            className={`hero-headline-token ${token.highlight ? 'hero-headline-token-highlight text-[#FF7A16]' : ''}`}
                            style={
                              {
                                ['--hero-token-delay' as string]: token.delay,
                                ['--hero-from-x' as string]: token.x,
                                ['--hero-from-y' as string]: token.y,
                                ['--hero-from-rotate' as string]: token.rotate,
                                ['--hero-from-scale' as string]: token.scale,
                              } as CSSProperties
                            }
                          >
                            {token.text}
                          </span>
                        ))}
                      </span>
                    ))}
                  </span>
                </h1>
              </div>
              <p className="hero-copy-enter mx-auto max-w-[38rem] break-keep text-[15px] font-semibold leading-[1.8] text-white/[0.82] sm:text-[16.5px]">
                {brand.heroDescription}
              </p>
            </div>
          </div>

          <div
            className="hero-cta-enter flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center"
            style={{ ['--hero-cta-delay' as string]: '0.48s' }}
          >
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

          <p
            className="hero-meta-enter mx-auto max-w-[32rem] break-keep text-[12px] font-semibold leading-[1.7] text-white/[0.58] sm:text-[12.5px]"
            style={{ ['--hero-meta-delay' as string]: '0.58s' }}
          >
            관리형 스터디센터 · 국어학원 · 학부모 앱 연동
          </p>
        </div>
      </div>
    </section>
  );
}
