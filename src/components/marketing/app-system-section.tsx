import { BarChart3, CalendarDays, CircleAlert, Clock3, Sparkles } from 'lucide-react';

import type { MarketingContent } from '@/lib/marketing-content';

import { SectionHeading } from './section-heading';

type AppSystemSectionProps = {
  appSystem: MarketingContent['appSystem'];
};

export function AppSystemSection({ appSystem }: AppSystemSectionProps) {
  const toneClassMap: Record<NonNullable<(typeof appSystem.dataMetrics)[number]['tone']>, string> = {
    navy: 'border-[#14295F]/15 bg-[#EEF3FF] text-[#14295F]',
    orange: 'border-[#FF7A16]/20 bg-[#FFF3E8] text-[#B55200]',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-rose-200 bg-rose-50 text-rose-700',
  };

  return (
    <section id="app-system" className="scroll-mt-28 bg-[#F4F7FF] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Track Web App" title={appSystem.heading} description={appSystem.description} />

        {/* Experience CTA Banner */}
        <div
          className="mt-6 overflow-hidden rounded-[1.6rem] border p-5"
          style={{
            borderColor: 'rgba(255,122,22,0.20)',
            background: 'linear-gradient(135deg, #FFF6ED 0%, #FFFFFF 100%)',
            boxShadow: '0 2px 8px -2px rgba(255,122,22,0.10), 0 12px 28px -6px rgba(20,41,95,0.07)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="eyebrow-badge">EXPERIENCE FIRST</span>
              <p className="mt-3 break-keep text-[1.55rem] font-black leading-[1.14] text-[#14295F]">
                학생 · 학부모 모드를 실제 앱처럼 체험
              </p>
              <p className="mt-2 break-keep text-[14px] font-semibold leading-[1.74] text-slate-600">
                그래프, 캘린더, 알림, 수납, 성장 지표까지 실제 운영 화면처럼 확인할 수 있습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="/go/login?placement=app_section_login" className="premium-cta premium-cta-primary h-11 px-5 text-sm">
                웹앱 로그인
              </a>
              <a href="/go/experience?placement=app_section" className="premium-cta premium-cta-secondary h-11 px-5 text-sm">
                웹앱 체험하기
              </a>
            </div>
          </div>
        </div>

        {/* Mode cards */}
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {appSystem.modes.map((mode) => (
            <article key={mode.mode} className="marketing-card p-5">
              <span className="eyebrow-badge">{mode.mode}</span>
              <p className="mt-3 break-keep text-sm font-semibold leading-[1.74] text-slate-600">{mode.description}</p>
              <ul className="mt-3.5 space-y-1.5">
                {mode.items.map((item) => (
                  <li key={`${mode.mode}-${item}`} className="flex items-center gap-2 text-sm font-extrabold text-[#14295F]">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: 'linear-gradient(135deg, #FF7A16, #FF9848)' }}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
          {/* Features + Data snapshot */}
          <div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {appSystem.features.map((item) => (
                <li key={item.title} className="marketing-card p-4">
                  <p className="text-[1rem] font-black text-[#14295F]">{item.title}</p>
                  <p className="mt-2 break-keep text-sm font-semibold leading-[1.72] text-slate-600">{item.description}</p>
                </li>
              ))}
            </ul>

            <div className="marketing-card mt-6 p-5">
              <span className="eyebrow-badge">DATA SNAPSHOT</span>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {appSystem.dataMetrics.map((metric) => (
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

          {/* App screen previews */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {appSystem.appScreens.map((screen, index) => (
              <article key={screen.title} className="marketing-card rounded-[1.8rem] p-4">
                <div
                  className="rounded-[1.3rem] border p-4"
                  style={{
                    borderColor: 'rgba(20,41,95,0.08)',
                    background: 'linear-gradient(160deg, #EDF2FF, #FFFFFF)',
                  }}
                >
                  <div
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#FF7A16]"
                    style={{ background: 'rgba(255,122,22,0.12)' }}
                  >
                    {index === 0 ? <Sparkles className="h-4 w-4" /> : null}
                    {index === 1 ? <BarChart3 className="h-4 w-4" /> : null}
                    {index === 2 ? <CalendarDays className="h-4 w-4" /> : null}
                  </div>

                  <p className="mt-3 text-[11px] font-black tracking-[0.14em] text-[#14295F]/55">LIVE WIDGET</p>
                  <div
                    className="mt-2 space-y-2 rounded-xl border p-3"
                    style={{ borderColor: 'rgba(20,41,95,0.08)', background: 'white' }}
                  >
                    <div className="flex items-center justify-between text-[11px] font-black text-[#14295F]">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3 text-[#FF7A16]" />
                        최근 공부시간
                      </span>
                      <span>14:23</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#E8EEFF]">
                      <div
                        className="h-full w-4/5 rounded-full"
                        style={{ background: 'linear-gradient(90deg, #14295F, #2850A8)' }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-black text-[#14295F]">
                      <span className="inline-flex items-center gap-1">
                        <CircleAlert className="h-3 w-3 text-rose-500" />
                        생활 관리 지수
                      </span>
                      <span>5점</span>
                    </div>
                  </div>
                </div>

                <div className="px-1 pb-1 pt-4">
                  <p className="break-keep text-[1rem] font-extrabold text-[#14295F]">{screen.title}</p>
                  <p className="mt-1 break-keep text-xs font-black text-[#FF7A16]">{screen.subtitle}</p>
                  <p className="mt-1.5 break-keep text-xs font-semibold leading-[1.7] text-slate-600">{screen.caption}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
