import type { MarketingContent } from '@/lib/marketing-content';
import { adminDb } from '@/lib/firebase-admin';
import { resolveMarketingCenterId } from '@/lib/marketing-center';
import { unstable_noStore as noStore } from 'next/cache';

import { ConsultForm } from './consult-form';
import { SectionHeading } from './section-heading';

type ConsultSectionProps = {
  consult: MarketingContent['consult'];
  trustMetrics: MarketingContent['appSystem']['trustMetrics'];
};

async function getWaitlistCount(): Promise<number> {
  noStore();
  try {
    const centerId = await resolveMarketingCenterId();
    if (!centerId) return 0;
    const snap = await adminDb
      .collection('centers')
      .doc(centerId)
      .collection('admissionWaitlist')
      .where('status', '==', 'waiting')
      .count()
      .get();
    return snap.data().count ?? 0;
  } catch {
    return 0;
  }
}

export async function ConsultSection({ consult, trustMetrics }: ConsultSectionProps) {
  const waitlistCount = await getWaitlistCount();

  return (
    <section
      id="consult"
      className="on-dark scroll-mt-28 py-10 sm:py-14"
      style={{ background: 'linear-gradient(160deg, #0c1a40 0%, #14295f 55%, #0d1e4a 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className="overflow-hidden rounded-[2rem] border p-7 sm:p-10"
          style={{
            borderColor: 'rgba(255,255,255,0.10)',
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 1px 0 0 rgba(255,255,255,0.08) inset, 0 32px 64px -16px rgba(0,0,0,0.32)',
          }}
        >
          <SectionHeading eyebrow="Consulting" title={consult.heading} description={consult.description} light />

          <div className="mt-6 grid gap-3 md:grid-cols-5">
            {trustMetrics.map((metric) => (
              <article
                key={`${metric.label}-${metric.value}`}
                className="rounded-2xl border px-4 py-4"
                style={{
                  borderColor: 'rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.06)',
                }}
              >
                <p className="text-[10px] font-black tracking-[0.16em] text-white">{metric.label}</p>
                <p className="mt-2 text-[1.15rem] font-black text-white">{metric.value}</p>
                <p className="mt-1 break-keep text-[11px] font-semibold leading-[1.55] text-white">{metric.detail}</p>
              </article>
            ))}
            <article
              className="rounded-2xl border px-4 py-4"
              style={{
                borderColor: 'rgba(255,122,22,0.30)',
                background: 'rgba(255,122,22,0.10)',
              }}
            >
              <p className="text-[10px] font-black tracking-[0.16em] text-[#FFB273]">현재 대기 인원</p>
              <p className="mt-2 text-[1.15rem] font-black text-white">{waitlistCount}명</p>
              <p className="mt-1 break-keep text-[11px] font-semibold leading-[1.55] text-white">
                상담 요청 후 순차적으로 안내 중입니다.
              </p>
            </article>
          </div>

          <div className="mt-7 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <ConsultForm waitlistCount={waitlistCount} />

            <div className="space-y-4">
              {/* 입학 대기 인원 배너 */}
              {waitlistCount > 0 && (
                <article
                  className="relative overflow-hidden rounded-2xl border p-5"
                  style={{
                    borderColor: 'rgba(255,122,22,0.45)',
                    background: 'linear-gradient(135deg, rgba(255,122,22,0.18) 0%, rgba(255,122,22,0.08) 100%)',
                  }}
                >
                  {/* 배경 장식 */}
                  <div
                    className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-20"
                    style={{ background: 'radial-gradient(circle, #FF7A16 0%, transparent 70%)' }}
                  />
                  <p className="text-[10.5px] font-black tracking-[0.18em] text-[#FF7A16]">WAITLIST</p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-4xl font-black leading-none text-white">{waitlistCount}</span>
                    <span className="mb-0.5 text-lg font-black text-white/70">명</span>
                  </div>
                  <p className="mt-1.5 break-keep text-sm font-bold leading-relaxed text-white/80">
                    현재 입학을 기다리고 있습니다.<br />
                    <span className="text-[#FF7A16]">지금 신청하면 우선순위로 연락드립니다.</span>
                  </p>
                </article>
              )}

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
