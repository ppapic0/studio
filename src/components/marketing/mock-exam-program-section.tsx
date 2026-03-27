import type { LucideIcon } from 'lucide-react';
import { BookOpenText, Crosshair, Gauge, Target } from 'lucide-react';

import type { MarketingContent } from '@/lib/marketing-content';

type MockExamProgramSectionProps = {
  mockExamProgram: MarketingContent['mockExamProgram'];
};

const programIcons: Record<string, LucideIcon> = {
  '더프': Target,
  '더프리미엄': Gauge,
  '이감 · 한수': BookOpenText,
  '시대인재 서바이벌 프로': Crosshair,
};

export function MockExamProgramSection({ mockExamProgram }: MockExamProgramSectionProps) {
  return (
    <section
      id="mock-exam-program"
      className="scroll-mt-28 py-12 sm:py-20"
      style={{ background: 'linear-gradient(180deg, #f7f9fd 0%, #ffffff 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <article className="brand-sheen-panel relative overflow-hidden rounded-[1.7rem] border border-[#FF7A16]/12 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(255,245,238,0.98)_100%)] px-5 py-6 shadow-[0_22px_54px_rgba(20,41,95,0.08)] sm:rounded-[2rem] sm:px-8 sm:py-9 lg:px-10 lg:py-10">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[-4%] top-[12%] h-28 w-28 rounded-full bg-[#FFD3AF]/26 blur-3xl sm:h-36 sm:w-36" />
            <div className="absolute right-[4%] top-[8%] h-40 w-40 rounded-full bg-[#FFB878]/16 blur-[90px] sm:h-56 sm:w-56" />
            <div className="absolute right-[18%] bottom-[-18%] h-52 w-52 rounded-full border border-[#14295F]/8" />
            <div className="absolute left-[34%] top-[30%] hidden h-px w-[26%] border-t border-dashed border-[#FF7A16]/18 lg:block" />
          </div>

          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-8">
            <div className="max-w-3xl">
              <span className="eyebrow-badge">{mockExamProgram.eyebrow}</span>
              <h2 className="mt-4 break-keep text-[clamp(1.65rem,7vw,3rem)] font-black leading-[1.1] text-[#14295F]">
                {mockExamProgram.title}
              </h2>
              <p className="mt-4 break-keep text-[14px] font-semibold leading-[1.85] text-[#4E627A] sm:text-[15.5px]">
                {mockExamProgram.description}
              </p>

              <div className="mt-5 flex flex-wrap gap-2.5">
                {mockExamProgram.highlights.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-full border border-[#FF7A16]/14 bg-white/92 px-3 py-1.5 text-[11px] font-black text-[#C45A00] shadow-[0_8px_18px_rgba(255,122,22,0.08)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {mockExamProgram.programs.map((program, index) => {
                const Icon = programIcons[program.title] ?? Target;

                return (
                  <article
                    key={program.title}
                    className="brand-sheen-panel relative overflow-hidden rounded-[1.2rem] border border-[#14295F]/10 bg-white/94 p-4 shadow-[0_14px_30px_rgba(20,41,95,0.06)] sm:rounded-[1.35rem] sm:p-5"
                  >
                    <div className="brand-glow-drift absolute right-[-12%] top-[-8%] h-20 w-20 rounded-full bg-[#FFB878]/12 blur-3xl" />
                    <div className="relative">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[9px] font-black tracking-[0.18em] text-[#FF7A16]">
                            PROGRAM 0{index + 1}
                          </p>
                          <h3 className="mt-2 break-keep text-[1rem] font-black leading-[1.2] text-[#14295F] sm:text-[1.08rem]">
                            {program.title}
                          </h3>
                        </div>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#14295F]/7 text-[#14295F]">
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                      </div>

                      <p className="mt-4 break-keep text-[12.5px] font-semibold leading-[1.72] text-[#5A6E85] sm:text-[13px]">
                        {program.summary}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
