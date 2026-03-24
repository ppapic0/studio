import Image from 'next/image';

import type { MarketingContent } from '@/lib/marketing-content';

import { SectionHeading } from './section-heading';

type AppSystemSectionProps = {
  appSystem: MarketingContent['appSystem'];
};

export function AppSystemSection({ appSystem }: AppSystemSectionProps) {
  const toneClassMap: Record<NonNullable<(typeof appSystem.trustMetrics)[number]['tone']>, string> = {
    navy: 'border-[#14295F]/15 bg-[#EEF3FF] text-[#14295F]',
    orange: 'border-[#FF7A16]/20 bg-[#FFF3E8] text-[#B55200]',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-rose-200 bg-rose-50 text-rose-700',
  };

  return (
    <section id="app-system" className="scroll-mt-28 bg-[#F4F7FF] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Track Web App" title={appSystem.heading} description={appSystem.description} />

        <div
          className="mt-6 overflow-hidden rounded-[1.7rem] border p-5 sm:p-6"
          style={{
            borderColor: 'rgba(255,122,22,0.18)',
            background: 'linear-gradient(135deg, #FFF6ED 0%, #FFFFFF 100%)',
            boxShadow: '0 2px 8px -2px rgba(255,122,22,0.10), 0 12px 28px -6px rgba(20,41,95,0.07)',
          }}
        >
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <span className="eyebrow-badge">{appSystem.dataStory.eyebrow}</span>
              <p className="mt-3 break-keep text-[1.6rem] font-black leading-[1.18] text-[#14295F]">
                {appSystem.dataStory.title}
              </p>
              <p className="mt-2 break-keep text-[14px] font-semibold leading-[1.74] text-slate-600">
                {appSystem.dataStory.description}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {appSystem.dataStory.proofNotes.map((note) => (
                <div
                  key={note}
                  className="rounded-[1.2rem] border border-[#14295F]/8 bg-white px-4 py-3 text-[12px] font-black leading-[1.55] text-[#14295F]"
                >
                  {note}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {appSystem.captures.map((capture) => (
            <article key={capture.mode} className="overflow-hidden rounded-[1.5rem] border border-[#14295F]/10 bg-white shadow-sm">
              <div className="relative aspect-[1.12/1] border-b border-[#14295F]/8 bg-[#0C1734]">
                <Image src={capture.image} alt={capture.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
              </div>
              <div className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">{capture.mode}</p>
                  <span className="rounded-full bg-[#F5F8FF] px-3 py-1 text-[10px] font-black text-[#14295F]/58">
                    {capture.proofType === 'actual' ? '실제 캡처' : '재구성 캡처'}
                  </span>
                </div>
                <p className="mt-2 break-keep text-[1.05rem] font-black leading-[1.35] text-[#14295F]">{capture.title}</p>
                <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.7] text-slate-500">{capture.description}</p>
                <div className="mt-3 rounded-[1rem] bg-[#F8FBFF] px-4 py-3 text-[11px] font-black text-[#14295F]">
                  {capture.callout}
                </div>
                <a href={capture.href} className="premium-cta premium-cta-muted mt-4 h-10 px-5 text-sm">
                  이 화면 자세히 보기
                </a>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div className="space-y-6">
            <ul className="grid gap-3 sm:grid-cols-2">
              {appSystem.features.map((item) => (
                <li key={item.title} className="marketing-card p-4">
                  <p className="text-[1rem] font-black text-[#14295F]">{item.title}</p>
                  <p className="mt-2 break-keep text-sm font-semibold leading-[1.72] text-slate-600">{item.description}</p>
                </li>
              ))}
            </ul>

            <div className="marketing-card p-5">
              <span className="eyebrow-badge">TRUST METRICS</span>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {appSystem.trustMetrics.map((metric) => (
                  <article
                    key={`${metric.label}-${metric.value}`}
                    className={`rounded-2xl border px-3.5 py-3.5 ${
                      metric.tone ? toneClassMap[metric.tone] : 'border-[#14295F]/10 bg-[#F4F7FF] text-[#14295F]'
                    }`}
                  >
                    <p className="text-[11px] font-black">{metric.label}</p>
                    <p className="dashboard-number mt-1.5 text-[1.45rem]">{metric.value}</p>
                    <p className="mt-1 text-[11px] font-semibold opacity-75">{metric.detail}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {appSystem.guides.map((guide) => (
              <article key={guide.mode} className="marketing-card rounded-[1.6rem] p-5">
                <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">{guide.mode}</p>
                <p className="mt-2 break-keep text-[1rem] font-black leading-[1.4] text-[#14295F]">{guide.headline}</p>
                <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.7] text-slate-500">{guide.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {guide.checkpoints.map((checkpoint) => (
                    <span
                      key={checkpoint}
                      className="rounded-full border border-[#14295F]/10 bg-[#F8FBFF] px-3 py-1 text-[11px] font-black text-[#14295F]/64"
                    >
                      {checkpoint}
                    </span>
                  ))}
                </div>
                <a href={guide.href} className="premium-cta premium-cta-ghost mt-5 h-10 px-5 text-sm">
                  {guide.label}
                </a>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
