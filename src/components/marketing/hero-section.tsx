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
    [
      { text: '공부는', x: '-52px', y: '-18px', rotate: '-7deg', scale: '0.9', delay: '0s' },
      { text: '방향이', x: '14px', y: '-24px', rotate: '6deg', scale: '0.92', delay: '0.05s' },
      { text: '중요합니다.', x: '48px', y: '18px', rotate: '-8deg', scale: '0.9', delay: '0.1s' },
    ],
    [{ text: line, x: '-18px', y: '28px', rotate: '6deg', scale: '0.94', delay: '0s' }],
    [{ text: line, x: '0px', y: '-52px', rotate: '-10deg', scale: '1.02', delay: '0.04s' }],
    [{ text: line, x: '46px', y: '42px', rotate: '-7deg', scale: '0.86', delay: '0s' }],
  ];

  return motionByLine[lineIndex] ?? [{ text: line, x: '0px', y: '20px', rotate: '0deg', scale: '0.94', delay: '0s' }];
}

export function HeroSection({ brand }: HeroSectionProps) {
  const heroTitleLines = brand.heroTitle.split('\n');
  const heroDescriptionLines = brand.heroDescription
    .split(/<br\s*\/?>|\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  const mobileHeroLines = [
    '공부는 방향이 중요합니다.',
    '성장의 길,',
    '트랙에서',
    '시작됩니다.',
  ];
  const heroFireworks = [
    {
      className: 'right-[8%] top-[6%] h-48 w-48 sm:h-60 sm:w-60 lg:h-[21rem] lg:w-[21rem]',
      ringColor: 'rgba(255,188,126,0.34)',
      coreColor: 'rgba(255,136,48,0.28)',
      delay: '0.2s',
      duration: '7.8s',
      opacity: 0.34,
    },
    {
      className: 'left-[12%] top-[22%] h-24 w-24 sm:h-32 sm:w-32 lg:h-36 lg:w-36',
      ringColor: 'rgba(255,170,102,0.3)',
      coreColor: 'rgba(255,214,168,0.18)',
      delay: '1.8s',
      duration: '6.3s',
      opacity: 0.28,
    },
    {
      className: 'hidden sm:block left-[8%] bottom-[14%] h-20 w-20 sm:h-28 sm:w-28 lg:h-32 lg:w-32',
      ringColor: 'rgba(112,162,255,0.2)',
      coreColor: 'rgba(255,160,84,0.16)',
      delay: '3.1s',
      duration: '8.6s',
      opacity: 0.18,
    },
    {
      className: 'hidden sm:block right-[18%] bottom-[18%] h-24 w-24 sm:h-36 sm:w-36 lg:h-40 lg:w-40',
      ringColor: 'rgba(255,168,88,0.22)',
      coreColor: 'rgba(255,228,188,0.14)',
      delay: '4.2s',
      duration: '7.1s',
      opacity: 0.16,
    },
  ];
  const heroBursts = [
    {
      className: 'left-[6%] top-[14%] h-36 w-36 sm:h-44 sm:w-44 lg:h-56 lg:w-56',
      color: 'rgba(255,151,62,0.24)',
      delay: '0.6s',
      duration: '5.4s',
    },
    {
      className: 'right-[14%] top-[18%] h-28 w-28 sm:h-36 sm:w-36 lg:h-44 lg:w-44',
      color: 'rgba(255,214,168,0.18)',
      delay: '1.6s',
      duration: '6.2s',
    },
    {
      className: 'left-[18%] bottom-[16%] h-24 w-24 sm:h-32 sm:w-32 lg:h-36 lg:w-36',
      color: 'rgba(120,171,255,0.14)',
      delay: '2.6s',
      duration: '5.8s',
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
  const heroEmbers = [
    {
      className: 'left-[11%] top-[30%] h-2 w-2 sm:h-2.5 sm:w-2.5',
      color: 'rgba(255,173,98,0.82)',
      delay: '0.5s',
      duration: '4.4s',
    },
    {
      className: 'right-[20%] top-[28%] h-1.5 w-1.5 sm:h-2 sm:w-2',
      color: 'rgba(255,255,255,0.76)',
      delay: '1.1s',
      duration: '4.8s',
    },
    {
      className: 'left-[24%] bottom-[22%] h-1.5 w-1.5 sm:h-2 sm:w-2',
      color: 'rgba(255,193,126,0.8)',
      delay: '1.9s',
      duration: '5.1s',
    },
    {
      className: 'right-[11%] bottom-[20%] h-2 w-2 sm:h-2.5 sm:w-2.5',
      color: 'rgba(255,148,59,0.72)',
      delay: '2.8s',
      duration: '5.5s',
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_32%_24%_at_50%_33%,rgba(255,122,22,0.12),transparent)]" />
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
        {heroBursts.map((burst) => (
          <div
            key={burst.className}
            className={`hero-burst absolute ${burst.className}`}
            style={{
              ['--hero-burst-color' as string]: burst.color,
              animationDelay: burst.delay,
              animationDuration: burst.duration,
            }}
          >
            <span className="hero-burst-ring absolute inset-0 rounded-full" />
            <span className="hero-burst-core absolute inset-[34%] rounded-full" />
          </div>
        ))}
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
        {heroEmbers.map((ember) => (
          <span
            key={ember.className}
            className={`hero-ember-float absolute rounded-full ${ember.className}`}
            style={{
              background: ember.color,
              boxShadow: `0 0 20px ${ember.color}`,
              animationDelay: ember.delay,
              animationDuration: ember.duration,
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

      <div className="relative mx-auto flex w-full max-w-7xl justify-center px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="max-w-[23rem] space-y-7 text-center sm:max-w-[58rem] sm:space-y-10">
          <div className="space-y-5 sm:space-y-6">
            <span className="eyebrow-badge-light">TRACK STUDY CENTER</span>

            <div className="space-y-5 sm:space-y-6">
              <div className="hero-headline-shell relative mx-auto inline-flex w-full max-w-[22.5rem] justify-center sm:hidden">
                <div className="hero-headline-aura absolute inset-x-[10%] top-[10%] h-[64%] rounded-full bg-[radial-gradient(circle,rgba(255,122,22,0.26)_0%,rgba(255,184,122,0.14)_30%,transparent_74%)] blur-3xl" />
                <div className="hero-headline-flare absolute left-1/2 top-[18%] h-20 w-20 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,201,154,0.55)_0%,rgba(255,122,22,0.18)_40%,transparent_72%)] blur-2xl sm:h-28 sm:w-28" />
                <h1 className="font-aggro-display relative text-[clamp(2.05rem,12vw,5.35rem)] font-black tracking-[-0.04em] text-white">
                  <span className="flex flex-col items-center gap-[0.12em] leading-[0.94]">
                    {mobileHeroLines.map((line, lineIndex) => (
                      <span key={`mobile-${line}`} className="hero-headline-line flex justify-center">
                        <span
                          className="hero-headline-token inline-flex items-center justify-center break-keep text-center"
                          style={
                            {
                              ['--hero-token-delay' as string]: `${0.02 + lineIndex * 0.1}s`,
                              ['--hero-from-x' as string]: lineIndex === 0 ? '-34px' : lineIndex === 1 ? '12px' : '30px',
                              ['--hero-from-y' as string]: lineIndex === 0 ? '-16px' : lineIndex === 1 ? '20px' : '34px',
                              ['--hero-from-rotate' as string]: lineIndex === 0 ? '-5deg' : lineIndex === 1 ? '6deg' : '-4deg',
                              ['--hero-from-scale' as string]: lineIndex === 1 ? '0.92' : '0.9',
                            } as CSSProperties
                          }
                        >
                          {line === '트랙에서' ? (
                            <>
                              <span className="inline-flex items-center whitespace-nowrap">
                                <span className="hero-headline-token-highlight inline-block text-[#FF7A16]">트랙</span>에서
                              </span>
                            </>
                          ) : (
                            line
                          )}
                        </span>
                      </span>
                    ))}
                  </span>
                </h1>
              </div>

              <div className="hero-headline-shell relative mx-auto hidden w-full justify-center sm:inline-flex sm:max-w-full">
                <div className="hero-headline-aura absolute inset-x-[10%] top-[10%] h-[64%] rounded-full bg-[radial-gradient(circle,rgba(255,122,22,0.26)_0%,rgba(255,184,122,0.14)_30%,transparent_74%)] blur-3xl" />
                <div className="hero-headline-flare absolute left-1/2 top-[18%] h-20 w-20 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,201,154,0.55)_0%,rgba(255,122,22,0.18)_40%,transparent_72%)] blur-2xl sm:h-28 sm:w-28" />
                <h1 className="font-aggro-display relative text-[clamp(2.1rem,11.8vw,5.35rem)] font-black tracking-[-0.04em] text-white">
                  <span className="flex flex-col items-center gap-[0.11em] sm:gap-[0.07em]">
                    {heroTitleLines.map((line, lineIndex) => (
                      <span
                        key={`${line}-${lineIndex}`}
                        className="hero-headline-line flex max-w-full flex-wrap items-end justify-center gap-x-[0.045em] gap-y-[0.03em] break-keep leading-[0.94] sm:flex-nowrap sm:leading-[0.92]"
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
                            {line === '트랙에서' ? (
                              <span className="inline-flex items-center whitespace-nowrap">
                                <span className="hero-headline-token-highlight inline-block text-[#FF7A16]">트랙</span>에서
                              </span>
                            ) : (
                              token.text
                            )}
                          </span>
                        ))}
                      </span>
                    ))}
                  </span>
                </h1>
              </div>
              <p className="hero-copy-enter mx-auto max-w-[21rem] break-keep px-1 text-[14px] font-semibold leading-[1.8] text-white/[0.82] sm:max-w-[40rem] sm:px-2 sm:text-[16.5px]">
                {heroDescriptionLines.map((line, index) => (
                  <span key={`${line}-${index}`} className="block">
                    {line}
                  </span>
                ))}
              </p>
            </div>
          </div>

          <div
            className="hero-cta-enter flex flex-col gap-2.5 px-1 sm:flex-row sm:flex-wrap sm:justify-center"
            style={{ ['--hero-cta-delay' as string]: '0.48s' }}
          >
            <a
              href="#consult"
              className="premium-cta premium-cta-primary h-12 w-full justify-center px-7 text-[14px] sm:w-auto sm:min-w-[11rem]"
            >
              상담 문의하기
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
