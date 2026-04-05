import type { LucideIcon } from 'lucide-react';
import { BookOpenText, Crosshair, Gauge, Target } from 'lucide-react';

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

export function MockExamProgramSection({ mockExamProgram, surface = 'card' }: MockExamProgramSectionProps) {
  const isCard = surface === 'card';
  const isDark = surface === 'flat-dark';
  const spotlightTone = isDark
    ? {
        panel: 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.04)_100%)]',
        beam: 'bg-[linear-gradient(90deg,transparent_0%,rgba(194,214,255,0.08)_18%,rgba(229,237,255,0.22)_50%,rgba(194,214,255,0.08)_82%,transparent_100%)]',
        aura: 'bg-[radial-gradient(circle,rgba(201,219,255,0.18)_0%,rgba(112,140,198,0.11)_46%,transparent_78%)]',
        plaqueShell:
          'border-white/[0.16] bg-white/[0.08] shadow-[0_20px_46px_rgba(7,16,43,0.34)] backdrop-blur-sm',
        plaqueCore:
          'border-white/[0.16] bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(164,188,235,0.11)_48%,rgba(255,255,255,0.04)_100%)]',
        glint: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.36)_0%,rgba(255,255,255,0.02)_100%)]',
        divider: 'bg-white/[0.12]',
        text: 'text-white',
      }
    : {
        panel: 'border-[#DDE8FF] bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF4FF_100%)]',
        beam: 'bg-[linear-gradient(90deg,transparent_0%,rgba(205,221,247,0.34)_20%,rgba(242,246,255,0.94)_50%,rgba(205,221,247,0.34)_80%,transparent_100%)]',
        aura: 'bg-[radial-gradient(circle,rgba(220,232,255,0.80)_0%,rgba(192,211,245,0.34)_48%,transparent_78%)]',
        plaqueShell:
          'border-[#D6E3FB] bg-white/90 shadow-[0_20px_40px_rgba(20,41,95,0.10)] backdrop-blur-sm',
        plaqueCore: 'border-[#D9E5FB] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(237,244,255,0.94)_100%)]',
        glint: 'bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(255,255,255,0.12)_100%)]',
        divider: 'bg-[#D7E4FB]',
        text: 'text-[#18356F]',
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

        <div className={cn('mt-6 overflow-hidden rounded-[1.55rem] border', spotlightTone.panel)}>
          <div className="relative flex min-h-[11rem] items-center justify-center overflow-hidden px-5 py-7 sm:min-h-[12rem] sm:px-8">
            <div className={cn('pointer-events-none absolute inset-x-[4%] top-1/2 h-[4.8rem] -translate-y-1/2 rounded-full blur-[22px]', spotlightTone.beam)} />
            <div className={cn('pointer-events-none absolute h-[8.5rem] w-[15rem] rounded-full blur-[34px] sm:h-[9rem] sm:w-[16rem]', spotlightTone.aura)} />

            <div
              className={cn(
                'relative flex min-h-[11rem] w-[8.9rem] items-center justify-center rounded-[2rem] border p-2 text-center sm:min-h-[11.75rem] sm:w-[9.75rem] sm:rounded-[2.2rem]',
                spotlightTone.plaqueShell,
              )}
            >
              <div className={cn('absolute inset-[0.52rem] rounded-[1.55rem] border sm:rounded-[1.7rem]', spotlightTone.plaqueCore)} />
              <div className={cn('pointer-events-none absolute left-[1.15rem] right-[1.15rem] top-[1.05rem] h-px', spotlightTone.divider)} />
              <div className={cn('pointer-events-none absolute inset-x-[18%] top-[0.9rem] h-[26%] rounded-full blur-[14px]', spotlightTone.glint)} />

              <p
                className={cn(
                  'font-aggro-display relative max-w-[6.9rem] whitespace-pre-line break-keep text-[1.12rem] font-black leading-[1.25] tracking-[-0.03em] sm:text-[1.2rem]',
                  spotlightTone.text,
                )}
              >
                {mockExamProgram.spotlight}
              </p>
            </div>
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
