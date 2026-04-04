import type { LucideIcon } from 'lucide-react';
import { BookOpenText, Crosshair, Gauge, Target } from 'lucide-react';

import type { MarketingContent } from '@/lib/marketing-content';

type MockExamProgramSectionProps = {
  mockExamProgram: MarketingContent['mockExamProgram'];
};

const programIcons: Record<string, LucideIcon> = {
  '더프리미엄 모의고사': Target,
  '이감': BookOpenText,
  '한수': Gauge,
  '시대인재 서바이벌 프로': Crosshair,
};

export function MockExamProgramSection({ mockExamProgram }: MockExamProgramSectionProps) {
  return (
    <section className="overflow-hidden rounded-[2.3rem] border border-[#14295F]/10 bg-white shadow-[0_22px_52px_rgba(20,41,95,0.08)]">
      <div className="px-6 py-7 sm:px-8 sm:py-8">
        <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">SECTION 03</p>
        <h2 className="mt-4 break-keep text-[clamp(1.55rem,3.1vw,2.25rem)] font-black leading-[1.12] text-[#14295F]">
          {mockExamProgram.title}
        </h2>

        <div className="mt-6 overflow-hidden rounded-[1.55rem] border border-[#E8D9C8] bg-[linear-gradient(180deg,#F5EDE1_0%,#FFF8F1_100%)]">
          <div className="relative flex min-h-[9.5rem] items-center justify-center px-6 py-6">
            <div className="absolute inset-x-0 top-1/2 h-10 -translate-y-1/2 bg-[#E8DCCB]/72" />
            <div className="relative flex h-36 w-36 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#FFE6CA_0%,#F4C896_100%)] px-6 text-center shadow-[0_18px_40px_rgba(201,150,92,0.28)]">
              <p className="whitespace-pre-line break-keep text-[0.98rem] font-black leading-[1.35] text-[#14295F]">
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
                className="rounded-[1.35rem] border border-[#14295F]/8 bg-white px-4 py-4 shadow-[0_12px_30px_rgba(20,41,95,0.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">
                      PROGRAM {String(index + 1).padStart(2, '0')}
                    </p>
                    <h3 className="mt-3 break-keep text-[1rem] font-black leading-[1.34] text-[#14295F]">
                      {program.title}
                    </h3>
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#14295F] text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>

                <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.7] text-[#53687F]">
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
