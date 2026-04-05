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

        <div className={cn('mt-6 overflow-hidden rounded-[1.55rem] border', isDark ? 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.04)_100%)]' : 'border-[#DDE8FF] bg-[linear-gradient(180deg,#F5F9FF_0%,#EDF4FF_100%)]')}>
          <div className="relative flex min-h-[10rem] items-center justify-center px-6 py-6">
            <div className={cn('absolute inset-x-0 top-1/2 h-10 -translate-y-1/2', isDark ? 'bg-white/[0.08]' : 'bg-[#E7F0FF]/82')} />
            <div
              className={cn(
                'pointer-events-none absolute h-44 w-44 rounded-full blur-[42px]',
                isDark
                  ? 'bg-[radial-gradient(circle,rgba(154,188,255,0.28)_0%,rgba(154,188,255,0.16)_36%,transparent_74%)]'
                  : 'bg-[radial-gradient(circle,rgba(167,198,255,0.28)_0%,rgba(167,198,255,0.14)_38%,transparent_76%)]',
              )}
            />

            <div className="relative flex h-[9.5rem] w-[9.5rem] items-center justify-center rounded-full px-6 text-center">
              <div
                className={cn(
                  'absolute inset-0 rounded-full border shadow-[0_24px_48px_rgba(40,82,150,0.22)]',
                  isDark
                    ? 'border-white/[0.18] bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.34)_0%,rgba(214,228,255,0.20)_18%,rgba(122,156,222,0.18)_52%,rgba(70,99,162,0.34)_100%)]'
                    : 'border-[#D3E2FF] bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.92)_0%,rgba(240,247,255,0.88)_24%,rgba(205,223,255,0.82)_58%,rgba(154,185,235,0.72)_100%)]',
                )}
              />
              <div
                className={cn(
                  'absolute inset-[0.38rem] rounded-full border',
                  isDark ? 'border-white/[0.22]' : 'border-white/[0.7]',
                )}
              />
              <div
                className={cn(
                  'pointer-events-none absolute left-[18%] top-[14%] h-[26%] w-[48%] rounded-full blur-[7px]',
                  isDark
                    ? 'bg-[radial-gradient(circle,rgba(255,255,255,0.54)_0%,rgba(255,255,255,0.18)_62%,transparent_100%)]'
                    : 'bg-[radial-gradient(circle,rgba(255,255,255,0.98)_0%,rgba(255,255,255,0.46)_58%,transparent_100%)]',
                )}
              />
              <div
                className={cn(
                  'pointer-events-none absolute inset-x-[19%] bottom-[13%] h-[18%] rounded-full blur-[10px]',
                  isDark
                    ? 'bg-[radial-gradient(circle_at_50%_0%,rgba(10,23,52,0.24),transparent_72%)]'
                    : 'bg-[radial-gradient(circle_at_50%_0%,rgba(72,103,150,0.16),transparent_74%)]',
                )}
              />

              <p
                className={cn(
                  'font-aggro-display relative max-w-[5.6rem] whitespace-pre-line break-keep text-[1.02rem] font-black leading-[1.32] tracking-[-0.03em]',
                  isDark ? 'text-white' : 'text-[#18356F]',
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
