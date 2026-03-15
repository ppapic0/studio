import type { MarketingContent } from '@/lib/marketing-content';

import { ConsultForm } from './consult-form';
import { SectionHeading } from './section-heading';

type ConsultSectionProps = {
  consult: MarketingContent['consult'];
};

export function ConsultSection({ consult }: ConsultSectionProps) {
  return (
    <section
      id="consult"
      className="on-dark scroll-mt-28 py-16 sm:py-20"
      style={{ background: 'linear-gradient(160deg, #0c1a40 0%, #14295f 55%, #0d1e4a 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className="overflow-hidden rounded-[2rem] border p-7 sm:p-10"
          style={{
            borderColor: 'rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 1px 0 0 rgba(255,255,255,0.08) inset, 0 32px 64px -16px rgba(0,0,0,0.32)',
          }}
        >
          <SectionHeading eyebrow="Consulting" title={consult.heading} description={consult.description} light />

          <div className="mt-7 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <ConsultForm />

            <div className="space-y-4">
              {[
                { label: 'CONTACT', value: consult.contactLine },
                { label: 'LOCATION', value: consult.locationLine },
                { label: 'HOURS', value: consult.hoursLine },
              ].map((item) => (
                <article
                  key={item.label}
                  className="rounded-2xl border p-5"
                  style={{
                    borderColor: 'rgba(255,255,255,0.10)',
                    background: 'rgba(255,255,255,0.06)',
                  }}
                >
                  <p className="text-[10.5px] font-black tracking-[0.18em] text-[#FFB273]">{item.label}</p>
                  <p className="mt-2 break-keep text-[1.05rem] font-black leading-relaxed text-white">
                    {item.value}
                  </p>
                </article>
              ))}

              <div className="flex flex-wrap gap-3 pt-1">
                <a
                  href="#consult-form"
                  className="premium-cta premium-cta-primary h-12 px-6 text-sm"
                >
                  상담 폼 작성하기
                </a>
                <a
                  href="/go/login?placement=consult_section"
                  className="premium-cta premium-cta-ghost h-12 px-6 text-sm"
                >
                  웹앱 로그인
                </a>
                <a
                  href="/go/experience?placement=consult_section"
                  className="premium-cta premium-cta-ghost h-12 px-6 text-sm"
                >
                  웹앱 체험하기
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
