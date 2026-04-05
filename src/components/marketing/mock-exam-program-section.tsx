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
  const moonTone = isDark
    ? {
        panel: 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.04)_100%)]',
        mist: 'bg-[radial-gradient(ellipse_at_center,rgba(211,226,255,0.18)_0%,rgba(154,188,255,0.10)_38%,rgba(94,125,194,0.06)_58%,transparent_80%)]',
        halo: 'bg-[radial-gradient(circle,rgba(154,188,255,0.28)_0%,rgba(154,188,255,0.16)_34%,rgba(154,188,255,0.06)_54%,transparent_76%)]',
        orbit: 'border-white/[0.18]',
        body: 'border-white/[0.16] bg-[radial-gradient(circle_at_30%_26%,rgba(255,255,255,0.96)_0%,rgba(222,234,255,0.32)_20%,rgba(110,145,214,0.30)_58%,rgba(45,69,121,0.80)_100%)]',
        shade: 'bg-[radial-gradient(circle_at_72%_54%,rgba(10,23,52,0.26)_0%,rgba(10,23,52,0.14)_36%,transparent_74%)]',
        highlight: 'bg-[radial-gradient(circle,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0.14)_62%,transparent_100%)]',
        speck: 'bg-white/[0.76] shadow-[0_0_14px_rgba(255,255,255,0.42)]',
        text: 'text-white',
      }
    : {
        panel: 'border-[#DDE8FF] bg-[linear-gradient(180deg,#F6FAFF_0%,#EEF4FF_100%)]',
        mist: 'bg-[radial-gradient(ellipse_at_center,rgba(223,235,255,0.95)_0%,rgba(210,226,255,0.62)_34%,rgba(190,211,245,0.30)_58%,transparent_82%)]',
        halo: 'bg-[radial-gradient(circle,rgba(167,198,255,0.26)_0%,rgba(167,198,255,0.14)_38%,rgba(167,198,255,0.05)_56%,transparent_78%)]',
        orbit: 'border-[#D6E3FB]',
        body: 'border-[#D3E2FF] bg-[radial-gradient(circle_at_30%_24%,rgba(255,255,255,1)_0%,rgba(243,248,255,0.96)_26%,rgba(214,228,255,0.88)_58%,rgba(171,194,236,0.76)_100%)]',
        shade: 'bg-[radial-gradient(circle_at_72%_54%,rgba(97,124,172,0.15)_0%,rgba(97,124,172,0.08)_38%,transparent_74%)]',
        highlight: 'bg-[radial-gradient(circle,rgba(255,255,255,1)_0%,rgba(255,255,255,0.46)_56%,transparent_100%)]',
        speck: 'bg-[#A8BFE7]/90 shadow-[0_0_12px_rgba(149,179,232,0.34)]',
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

        <div className={cn('mt-6 overflow-hidden rounded-[1.55rem] border', moonTone.panel)}>
          <div className="relative flex min-h-[10.75rem] items-center justify-center overflow-hidden px-6 py-7">
            <div className={cn('pointer-events-none absolute inset-x-[4%] top-1/2 h-[4.4rem] -translate-y-1/2 rounded-full blur-[24px]', moonTone.mist)} />
            <div className={cn('pointer-events-none absolute left-[24%] top-[28%] h-1.5 w-1.5 rounded-full', moonTone.speck)} />
            <div className={cn('pointer-events-none absolute right-[26%] top-[30%] h-1 w-1 rounded-full', moonTone.speck)} />
            <div className={cn('pointer-events-none absolute right-[31%] bottom-[30%] h-1.5 w-1.5 rounded-full', moonTone.speck)} />

            <div className={cn('pointer-events-none absolute h-[11.75rem] w-[11.75rem] rounded-full blur-[46px]', moonTone.halo)} />

            <div className="relative flex h-[10.25rem] w-[10.25rem] items-center justify-center rounded-full text-center">
              <div className={cn('absolute inset-0 rounded-full border', moonTone.orbit)} />
              <div
                className={cn(
                  'absolute inset-[0.6rem] rounded-full border shadow-[0_24px_50px_rgba(34,67,129,0.24)]',
                  moonTone.body,
                )}
              />
              <div className={cn('pointer-events-none absolute inset-[1rem] rounded-full', moonTone.shade)} />
              <div className={cn('pointer-events-none absolute left-[25%] top-[18%] h-[24%] w-[34%] rounded-full blur-[10px]', moonTone.highlight)} />

              <p
                className={cn(
                  'font-aggro-display relative max-w-[5.9rem] whitespace-pre-line break-keep text-[1.02rem] font-black leading-[1.32] tracking-[-0.03em]',
                  moonTone.text,
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
