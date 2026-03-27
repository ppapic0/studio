import type { MarketingContent } from '@/lib/marketing-content';
import { adminDb } from '@/lib/firebase-admin';
import { resolveMarketingCenterId } from '@/lib/marketing-center';
import { unstable_noStore as noStore } from 'next/cache';

import { ConsultForm } from './consult-form';
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
  '국어 수업 연동': { label: '국어', value: '실전' },
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

          <StaggerChildren className="mt-6 grid grid-cols-5 gap-2 sm:gap-3" stagger={85}>
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
            <article
              className="brand-beacon brand-sheen-panel relative min-w-0 rounded-[1rem] border px-2 py-2.5 sm:rounded-2xl sm:px-4 sm:py-4"
              style={{
                borderColor: 'rgba(255,122,22,0.30)',
                background: 'rgba(255,122,22,0.10)',
              }}
            >
              <div
                className="brand-glow-drift absolute -right-6 top-0 h-20 w-20 rounded-full bg-[#FFB878]/20 blur-3xl"
                style={{ animationDelay: '-1.7s' }}
              />
              <p className="break-keep text-[8px] font-black tracking-[0.06em] text-[#FFB273] sm:text-[10px] sm:tracking-[0.16em]">
                <span className="sm:hidden">대기</span>
                <span className="hidden sm:inline">현재 대기 인원</span>
              </p>
              <p className="brand-number-pop mt-1.5 break-keep text-[0.92rem] font-black leading-none text-white sm:mt-2 sm:text-[1.15rem]">{waitlistCount}명</p>
              <p className="mt-1 hidden break-keep text-[11px] font-semibold leading-[1.55] text-white sm:block">
                상담 요청 후 순차적으로 안내 중입니다.
              </p>
            </article>
          </StaggerChildren>

          <div className="mt-7 grid gap-5 lg:grid-cols-[0.95fr_1.05fr] lg:gap-6">
            <ConsultForm waitlistCount={waitlistCount} />

            <div className="space-y-4">
              {/* 입학 대기 인원 배너 */}
              {waitlistCount > 0 && (
                <article
                  className="brand-panel-scan relative overflow-hidden rounded-2xl border p-5"
                  style={{
                    borderColor: 'rgba(255,122,22,0.45)',
                    background: 'linear-gradient(135deg, rgba(255,122,22,0.18) 0%, rgba(255,122,22,0.08) 100%)',
                  }}
                >
                  {/* 배경 장식 */}
                  <div
                    className="brand-glow-drift pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-20"
                    style={{ background: 'radial-gradient(circle, #FF7A16 0%, transparent 70%)' }}
                  />
                  <p className="text-[10.5px] font-black tracking-[0.18em] text-[#FF7A16]">WAITLIST</p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="brand-number-pop text-4xl font-black leading-none text-white">{waitlistCount}</span>
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
                  className="brand-sheen-panel rounded-2xl border p-5"
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

              <div className="grid gap-2.5 pt-1 sm:flex sm:flex-wrap">
                <a
                  href="#consult-form"
                  className="premium-cta premium-cta-primary brand-cta-float h-12 w-full px-6 text-sm sm:w-auto"
                >
                  상담 폼 작성하기
                </a>
                <a
                  href="/go/login?placement=consult_section"
                  className="premium-cta premium-cta-ghost brand-cta-float h-12 w-full px-6 text-sm sm:w-auto"
                >
                  웹앱 로그인
                </a>
                <a
                  href="/go/experience?placement=consult_section"
                  className="premium-cta premium-cta-ghost brand-cta-float h-12 w-full px-6 text-sm sm:w-auto"
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
