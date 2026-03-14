import type { MarketingContent } from "@/lib/marketing-content";

import { SectionHeading } from "./section-heading";

type OutcomesSectionProps = {
  outcomes: MarketingContent["outcomes"];
  successStory: MarketingContent["successStory"];
};

export function OutcomesSection({ outcomes, successStory }: OutcomesSectionProps) {
  return (
    <section
      id="outcome"
      className="scroll-mt-28 py-16 sm:py-20"
      style={{
        background: 'linear-gradient(160deg, #0c1a40 0%, #14295f 50%, #0d1e4a 100%)',
      }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Decorative */}
        <div className="pointer-events-none absolute left-0 right-0 overflow-hidden" aria-hidden="true">
          <div className="mx-auto max-w-7xl px-4">
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>
        </div>

        <SectionHeading
          eyebrow="Outcome"
          title="트랙은 결과로 설명합니다"
          description="과장보다 실적, 수치보다 과정입니다. 실제 합격 결과와 성장 사례를 또렷하게 보여드립니다."
          light
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outcomes.map((item, i) => (
            <article
              key={item.label}
              className="relative overflow-hidden rounded-[1.5rem] border p-6 transition-transform duration-200 hover:-translate-y-0.5"
              style={{
                borderColor: i === 0 ? 'rgba(255,122,22,0.28)' : 'rgba(255,255,255,0.10)',
                background: i === 0
                  ? 'linear-gradient(145deg, rgba(255,122,22,0.18), rgba(200,80,0,0.10))'
                  : 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div
                className="absolute right-0 top-0 h-20 w-20 rounded-bl-full opacity-20"
                style={{ background: i === 0 ? '#FF7A16' : 'rgba(255,255,255,0.3)' }}
              />
              <p className="text-[11px] font-black tracking-[0.18em] text-white/48">{item.label}</p>
              <p className="stat-number mt-3 break-keep text-[2.4rem] text-white">{item.value}</p>
              {item.detail ? (
                <p className="mt-2 text-sm font-semibold text-[#FFB273]">{item.detail}</p>
              ) : null}
            </article>
          ))}
        </div>

        <article
          className="mt-6 overflow-hidden rounded-[1.5rem] border p-6"
          style={{
            borderColor: 'rgba(255,122,22,0.32)',
            background: 'linear-gradient(135deg, rgba(255,122,22,0.14) 0%, rgba(255,60,0,0.08) 100%)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <p className="text-xs font-black tracking-[0.18em] text-[#FFB273]/70">{successStory.title}</p>
          <p className="font-brand mt-3 break-keep text-[1.7rem] leading-[1.18] text-white sm:text-[2rem]">
            {successStory.summary}
          </p>
        </article>
      </div>
    </section>
  );
}
