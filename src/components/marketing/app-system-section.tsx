import type { MarketingContent } from '@/lib/marketing-content';

import { SectionHeading } from './section-heading';

type AppSystemSectionProps = {
  appSystem: MarketingContent['appSystem'];
};

const toneClassMap: Record<NonNullable<MarketingContent['appSystem']['trustMetrics'][number]['tone']>, string> = {
  navy: 'border-[#14295F]/12 bg-[#F8FBFF] text-[#14295F]',
  orange: 'border-[#FF7A16]/18 bg-[#FFF6ED] text-[#B55200]',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  red: 'border-rose-200 bg-rose-50 text-rose-700',
};

export function AppSystemSection({ appSystem }: AppSystemSectionProps) {
  return (
    <section id="app" className="scroll-mt-28 bg-[#F7F9FD] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center [&_.eyebrow-badge]:mx-auto">
          <SectionHeading
            eyebrow="Track Web App"
            title={appSystem.heading}
            description={appSystem.description}
          />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {appSystem.guides.map((guide) => (
            <article
              key={guide.mode}
              className="rounded-[1.5rem] border border-[#14295F]/10 bg-white p-5 shadow-[0_10px_28px_rgba(20,41,95,0.06)]"
            >
              <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">{guide.mode}</p>
              <p className="mt-2 break-keep text-[1.05rem] font-black leading-[1.42] text-[#14295F]">
                {guide.headline}
              </p>
              <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.72] text-[#53687F]">
                {guide.summary}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {guide.checkpoints.map((checkpoint) => (
                  <span
                    key={`${guide.mode}-${checkpoint}`}
                    className="rounded-full border border-[#14295F]/10 bg-[#F8FBFF] px-3 py-1 text-[11px] font-black text-[#14295F]/68"
                  >
                    {checkpoint}
                  </span>
                ))}
              </div>
              <a href={guide.href} className="premium-cta premium-cta-muted mt-5 h-10 px-5 text-sm">
                {guide.label}
              </a>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[1.6rem] border border-[#14295F]/10 bg-white p-6 shadow-[0_10px_28px_rgba(20,41,95,0.06)]">
            <span className="eyebrow-badge">ROLE SUMMARY</span>
            <p className="mt-4 break-keep text-[1.2rem] font-black leading-[1.4] text-[#14295F]">
              홈에서는 역할별 핵심만 보여주고, 실제 체험은 `/experience`에서 이어집니다.
            </p>
            <div className="mt-5 grid gap-3">
              {appSystem.features.map((feature) => (
                <div key={feature.title} className="rounded-[1.1rem] border border-[#14295F]/8 bg-[#F8FBFF] px-4 py-4">
                  <p className="text-[14px] font-black text-[#14295F]">{feature.title}</p>
                  <p className="mt-1 break-keep text-[12px] font-semibold leading-[1.65] text-[#566B81]">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.6rem] border border-[#14295F]/10 bg-white p-6 shadow-[0_10px_28px_rgba(20,41,95,0.06)]">
            <span className="eyebrow-badge">TRUST METRICS</span>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {appSystem.trustMetrics.map((metric) => (
                <div
                  key={`${metric.label}-${metric.value}`}
                  className={`rounded-[1.2rem] border px-4 py-4 ${
                    metric.tone ? toneClassMap[metric.tone] : 'border-[#14295F]/10 bg-[#F8FBFF] text-[#14295F]'
                  }`}
                >
                  <p className="text-[11px] font-black">{metric.label}</p>
                  <p className="dashboard-number mt-2 text-[1.4rem]">{metric.value}</p>
                  <p className="mt-1 text-[11px] font-semibold opacity-78">{metric.detail}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
