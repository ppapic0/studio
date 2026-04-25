import type { MarketingContent } from '@/lib/marketing-content';

import { ConsultForm } from './consult-form';
import { ConsultReservationCard } from './consult-reservation-card';
import { SectionHeading } from './section-heading';
import { StaggerChildren } from './stagger-children';

type ConsultSectionProps = {
  consult: MarketingContent['consult'];
  trustMetrics: MarketingContent['appSystem']['trustMetrics'];
};

const mobileTrustMetricMap: Record<string, { label: string; value: string }> = {
  '학생이 얻는 변화': { label: '변화', value: '습관' },
  '빠른 개입 구조': { label: '개입', value: '즉시' },
  '학부모 확인': { label: '확인', value: '안심' },
};

export async function ConsultSection({ consult, trustMetrics }: ConsultSectionProps) {
  const hourLines = consult.hoursLine
    .split(/<br\s*\/?>/i)
    .map((item) => item.trim())
    .filter(Boolean);
  const infoCards = [
    { label: 'CONTACT', value: consult.contactLine, mobileSpanClass: '' },
    { label: 'LOCATION', value: consult.locationLine, mobileSpanClass: 'col-span-2' },
    { label: 'HOURS', value: consult.hoursLine, mobileSpanClass: 'col-span-2' },
  ];

  return (
    <section
      id="consult"
      className="on-dark relative scroll-mt-28 overflow-hidden py-9 sm:py-14"
      style={{ background: 'linear-gradient(160deg, #0c1a40 0%, #14295f 55%, #0d1e4a 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="brand-glow-drift absolute left-[-8%] top-[12%] h-56 w-56 rounded-full bg-[#2E5CB8]/16 blur-[120px]" />
        <div
          className="brand-glow-drift absolute right-[-4%] top-[8%] h-72 w-72 rounded-full bg-[#FF7A16]/12 blur-[140px]"
          style={{ animationDelay: '-3.2s' }}
        />
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className="brand-sheen-panel relative overflow-hidden rounded-[1.7rem] border p-5 sm:rounded-[2rem] sm:p-10"
          style={{
            borderColor: 'rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 1px 0 0 rgba(255,255,255,0.08) inset, 0 32px 64px -16px rgba(0,0,0,0.32)',
          }}
        >
          <SectionHeading eyebrow="Consulting" title={consult.heading} description={consult.description} light />

          <StaggerChildren className="mt-6 hidden grid-cols-3 gap-2 sm:grid sm:gap-3" stagger={85}>
            {trustMetrics.map((metric) => (
              <article
                key={`${metric.label}-${metric.value}`}
                className="brand-sheen-panel min-w-0 rounded-[1rem] border px-2 py-2.5 sm:rounded-2xl sm:px-4 sm:py-4"
                style={{
                  borderColor: 'rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.06)',
                }}
              >
                <p className="break-keep text-[8px] font-black tracking-[0.06em] text-white sm:text-[10px] sm:tracking-[0.16em]">
                  <span className="sm:hidden">{mobileTrustMetricMap[metric.label]?.label ?? metric.label}</span>
                  <span className="hidden sm:inline">{metric.label}</span>
                </p>
                <p className="brand-number-pop mt-1.5 break-keep text-[0.98rem] font-black leading-none text-white sm:mt-2 sm:text-[1.15rem]">
                  <span className="sm:hidden">{mobileTrustMetricMap[metric.label]?.value ?? metric.value}</span>
                  <span className="hidden sm:inline">{metric.value}</span>
                </p>
                <p className="mt-1 hidden break-keep text-[11px] font-semibold leading-[1.55] text-white sm:block">{metric.detail}</p>
              </article>
            ))}
          </StaggerChildren>

          <div className="mt-7 grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:gap-6">
            <ConsultForm />

            <div className="space-y-4">
              <ConsultReservationCard />

              <div className="grid grid-cols-2 gap-3">
                {infoCards.map((item) => (
                  <article
                    key={item.label}
                    className={`brand-sheen-panel rounded-[1.25rem] border p-4 sm:rounded-2xl sm:p-5 ${item.mobileSpanClass}`}
                    style={{
                      borderColor: 'rgba(255,255,255,0.10)',
                      background: 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <p className="text-[10px] font-black tracking-[0.17em] text-[#FFB273] sm:text-[10.5px]">
                      {item.label}
                    </p>
                    {item.label === 'HOURS' ? (
                      <div className="mt-2 space-y-1.5 sm:space-y-2">
                        {hourLines.map((line) => (
                          <p
                            key={line}
                            className="break-keep text-[11px] font-black leading-[1.5] tracking-[-0.03em] text-white sm:text-[1.05rem] sm:leading-relaxed sm:tracking-normal"
                          >
                            {line}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 break-keep text-[0.94rem] font-black leading-[1.65] text-white sm:text-[1.05rem] sm:leading-relaxed">
                        {item.value}
                      </p>
                    )}
                  </article>
                ))}
              </div>

              <div className="grid gap-2.5 pt-1 sm:flex sm:flex-wrap">
                <a
                  href="#consult-form"
                  className="premium-cta premium-cta-primary brand-cta-float h-12 w-full px-6 text-sm sm:w-auto"
                >
                  상담 폼 작성하기
                </a>
                <a
                  href="/consult/check"
                  className="premium-cta premium-cta-ghost brand-cta-float h-12 w-full px-6 text-sm sm:w-auto"
                >
                  접수 내역 조회하기
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
