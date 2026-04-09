'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BookOpenText, ChevronLeft, ChevronRight, Crosshair, Gauge, Target } from 'lucide-react';

import type { MarketingContent } from '@/lib/marketing-content';
import { cn } from '@/lib/utils';

type MockExamProgramSectionProps = {
  mockExamProgram: MarketingContent['mockExamProgram'];
  surface?: 'card' | 'flat-light' | 'flat-dark';
};

const programIcons: Record<string, LucideIcon> = {
  '더프리미엄 모의고사': Target,
  '이감': BookOpenText,
  '한수': Gauge,
  '시대인재 서바이벌 프로': Crosshair,
};

const mockExamProofImages = [
  {
    src: '/marketing/mock-exams/duf-premium-cover.png',
    alt: '더프리미엄 모의고사 표지 이미지',
    label: '더프리미엄',
  },
  {
    src: '/marketing/mock-exams/hansu-cover.png',
    alt: '한수 모의고사 표지 이미지',
    label: '한수',
  },
  {
    src: '/marketing/mock-exams/igam-season-cover.png',
    alt: '이감 국어 모의고사 시즌1 표지 이미지',
    label: '이감 시즌',
  },
  {
    src: '/marketing/mock-exams/igam-classic-cover.png',
    alt: '이감 클래식 독서 표지 이미지',
    label: '이감 클래식',
  },
  {
    src: '/marketing/mock-exams/survival-cover.png',
    alt: '시대인재 서바이벌 표지 이미지',
    label: '서바이벌',
  },
] as const;

function getWrappedProofIndex(currentIndex: number, step: number) {
  return (currentIndex + step + mockExamProofImages.length) % mockExamProofImages.length;
}

export function MockExamProgramSection({ mockExamProgram, surface = 'card' }: MockExamProgramSectionProps) {
  const isCard = surface === 'card';
  const isDark = surface === 'flat-dark';
  const [activeProofIndex, setActiveProofIndex] = useState(0);
  const activeProofImage = mockExamProofImages[activeProofIndex] ?? mockExamProofImages[0];
  const spotlightMessage = mockExamProgram.spotlight.replace(/\n+/g, ' ').trim();
  const spotlightTone = isDark
    ? {
        panel: 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.04)_100%)]',
        beam: 'bg-[linear-gradient(90deg,transparent_0%,rgba(194,214,255,0.08)_18%,rgba(229,237,255,0.22)_50%,rgba(194,214,255,0.08)_82%,transparent_100%)]',
        aura: 'bg-[radial-gradient(circle,rgba(201,219,255,0.18)_0%,rgba(112,140,198,0.11)_46%,transparent_78%)]',
      }
    : {
        panel: 'border-[#DDE8FF] bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF4FF_100%)]',
        beam: 'bg-[linear-gradient(90deg,transparent_0%,rgba(205,221,247,0.34)_20%,rgba(242,246,255,0.94)_50%,rgba(205,221,247,0.34)_80%,transparent_100%)]',
        aura: 'bg-[radial-gradient(circle,rgba(220,232,255,0.80)_0%,rgba(192,211,245,0.34)_48%,transparent_78%)]',
      };

  const controlTone = isDark
    ? {
        button: 'border-white/16 bg-white/10 text-white hover:bg-white/16',
        dotIdle: 'bg-white/24',
        dotActive: 'bg-white',
        card: 'border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)]',
      }
    : {
        button: 'border-[#D6E3FB] bg-white/88 text-[#18356F] hover:bg-[#F4F8FF]',
        dotIdle: 'bg-[#C8D7F2]',
        dotActive: 'bg-[#2F63E3]',
        card: 'border-[#D6E3FB] bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(243,247,255,0.86)_100%)]',
      };

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveProofIndex((currentIndex) => getWrappedProofIndex(currentIndex, 1));
    }, 3200);

    return () => window.clearInterval(intervalId);
  }, []);

  const moveProofIndex = (direction: 'prev' | 'next') => {
    const step = direction === 'prev' ? -1 : 1;
    setActiveProofIndex((currentIndex) => getWrappedProofIndex(currentIndex, step));
  };

  return (
    <section
      className={cn(
        'overflow-hidden',
        isCard && 'rounded-[2.3rem] border border-[#14295F]/10 bg-white shadow-[0_22px_52px_rgba(20,41,95,0.08)]',
      )}
    >
      <div className="px-6 py-7 sm:px-8 sm:py-8">
        <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">SECTION 03</p>
        <h2 className={cn('font-aggro-display mt-4 break-keep text-[clamp(1.55rem,3.1vw,2.25rem)] font-black leading-[1.12] tracking-[-0.03em]', isDark ? 'text-white' : 'text-[#14295F]')}>
          {mockExamProgram.title}
        </h2>
        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black tracking-[0.12em]',
              isDark ? 'border-[#FFB878]/30 bg-[#FF7A16]/18 text-[#FFE0C2]' : 'border-[#FFB878]/55 bg-[#FFF3E8] text-[#C35C00]',
            )}
          >
            유료 이용 가능
          </span>
          <p className={cn('break-keep text-[13px] font-semibold leading-[1.7]', isDark ? 'text-white' : 'text-[#53687F]')}>
            {spotlightMessage}
          </p>
        </div>

        <div
          className={cn(
            'relative mt-6 overflow-hidden rounded-[1.7rem] border px-5 pb-14 pt-6 sm:px-8 sm:pb-16 sm:pt-7',
            spotlightTone.panel,
            controlTone.card,
          )}
        >
          <div className={cn('pointer-events-none absolute inset-x-[6%] top-1/2 h-[4.8rem] -translate-y-1/2 rounded-full blur-[22px]', spotlightTone.beam)} />
          <div className={cn('pointer-events-none absolute left-[18%] top-[18%] h-[8.5rem] w-[15rem] rounded-full blur-[34px] sm:h-[9rem] sm:w-[16rem]', spotlightTone.aura)} />
          <div className={cn('pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r sm:w-20', isDark ? 'from-[#1A3471]/85 via-[#1A3471]/45 to-transparent' : 'from-white via-white/55 to-transparent')} />
          <div className={cn('pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l sm:w-20', isDark ? 'from-[#1A3471]/85 via-[#1A3471]/45 to-transparent' : 'from-white via-white/55 to-transparent')} />

          <div className="relative flex min-h-[12.5rem] items-center justify-center sm:min-h-[14.5rem]">
            <div className={cn('pointer-events-none absolute left-1/2 top-1/2 h-[11rem] w-[11rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[48px] sm:h-[13rem] sm:w-[13rem]', spotlightTone.aura)} />
            <div className="relative flex h-[10.8rem] w-full max-w-[16rem] items-center justify-center sm:h-[13rem] sm:max-w-[19rem]">
              <Image
                key={activeProofImage.src}
                src={activeProofImage.src}
                alt={activeProofImage.alt}
                fill
                sizes="(min-width: 1024px) 24vw, 54vw"
                className="object-contain object-center drop-shadow-[0_26px_30px_rgba(15,27,58,0.22)] transition-all duration-500"
              />
            </div>

            <div className="absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 items-center justify-between">
              <button
                type="button"
                onClick={() => moveProofIndex('prev')}
                aria-label="이전 모의고사 표지 보기"
                className={cn(
                  'inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_12px_24px_rgba(20,41,95,0.14)] transition-colors sm:h-11 sm:w-11',
                  controlTone.button,
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveProofIndex('next')}
                aria-label="다음 모의고사 표지 보기"
                className={cn(
                  'inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_12px_24px_rgba(20,41,95,0.14)] transition-colors sm:h-11 sm:w-11',
                  controlTone.button,
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-4 z-20 flex items-center justify-center gap-2 sm:bottom-5">
            {mockExamProofImages.map((image, index) => (
              <button
                key={image.src}
                type="button"
                onClick={() => setActiveProofIndex(index)}
                aria-label={`${image.label} 표지 보기`}
                className="inline-flex h-5 w-5 items-center justify-center"
              >
                <span
                  className={cn(
                    'h-2.5 rounded-full transition-all duration-200',
                    index === activeProofIndex ? `w-7 ${controlTone.dotActive}` : `w-2.5 ${controlTone.dotIdle}`,
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {mockExamProgram.programs.map((program, index) => {
            const Icon = programIcons[program.title] ?? Target;

            return (
              <article
                key={program.title}
                className={cn(
                  'rounded-[1.35rem] border px-4 py-4 shadow-[0_12px_30px_rgba(20,41,95,0.06)]',
                  isDark ? 'border-white/10 bg-white/[0.08] text-white backdrop-blur-sm' : 'border-[#14295F]/8 bg-white',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={cn('text-[10px] font-black tracking-[0.18em]', isDark ? 'text-white/[0.78]' : 'text-[#FF7A16]')}>
                      PROGRAM {String(index + 1).padStart(2, '0')}
                    </p>
                    <h3 className={cn('font-aggro-display mt-3 break-keep text-[1rem] font-black leading-[1.34] tracking-[-0.03em]', isDark ? 'text-white' : 'text-[#14295F]')}>
                      {program.title}
                    </h3>
                  </div>
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-white', isDark ? 'bg-white/[0.12]' : 'bg-[#14295F]')}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>

                <p className={cn('mt-2 break-keep text-[13px] font-semibold leading-[1.7]', isDark ? 'text-white/[0.9]' : 'text-[#53687F]')}>
                  {program.summary}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
