import { BarChart3, CalendarDays, CircleAlert, Clock3, Sparkles } from 'lucide-react';

import type { MarketingContent } from '@/lib/marketing-content';

import { SectionHeading } from './section-heading';

type AppSystemSectionProps = {
  appSystem: MarketingContent['appSystem'];
};

export function AppSystemSection({ appSystem }: AppSystemSectionProps) {
  const toneClassMap: Record<NonNullable<(typeof appSystem.dataMetrics)[number]['tone']>, string> = {
    navy: 'border-[#14295F]/20 bg-[#F1F5FF] text-[#14295F]',
    orange: 'border-[#FF7A16]/25 bg-[#FFF4EB] text-[#B55200]',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-rose-200 bg-rose-50 text-rose-700',
  };

  return (
    <section id="app-system" className="scroll-mt-28 bg-[#F6F9FF] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Track Web App" title={appSystem.heading} description={appSystem.description} />

        <div className="mt-6 rounded-[1.8rem] border border-[#FF7A16]/18 bg-[linear-gradient(135deg,#FFF6ED_0%,#FFFFFF_100%)] p-5 shadow-[0_18px_40px_rgba(255,122,22,0.10)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.16em] text-[#FF7A16]">EXPERIENCE FIRST</p>
              <p className="mt-2 break-keep text-xl font-black text-[#14295F]">학생 모드와 학부모 모드를 실제 앱처럼 체험해보세요</p>
              <p className="mt-2 break-keep text-sm font-bold leading-relaxed text-slate-600">그래프, 캘린더, 알림, 수납, 성장 지표까지 실제 운영 화면처럼 확인할 수 있습니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="/go/login?placement=app_section_login" className="premium-cta premium-cta-primary h-11 rounded-full px-5 text-sm">
                웹앱 로그인
              </a>
              <a href="/go/experience?placement=app_section" className="premium-cta premium-cta-secondary h-11 rounded-full px-5 text-sm">
                웹앱 체험하기
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {appSystem.modes.map((mode) => (
            <article key={mode.mode} className="marketing-card p-5">
              <p className="text-xs font-black tracking-[0.14em] text-[#FF7A16]">{mode.mode}</p>
              <p className="mt-2 break-keep text-sm font-bold leading-relaxed text-slate-600">{mode.description}</p>
              <ul className="mt-3 space-y-1.5">
                {mode.items.map((item) => (
                  <li key={`${mode.mode}-${item}`} className="text-sm font-black text-[#14295F]">
                    • {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
          <div>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {appSystem.features.map((item) => (
                <li key={item.title} className="marketing-card p-4">
                  <p className="text-base font-black text-[#14295F]">{item.title}</p>
                  <p className="mt-2 break-keep text-sm font-bold leading-relaxed text-slate-600">{item.description}</p>
                </li>
              ))}
            </ul>

            <div className="marketing-card mt-8 p-5">
              <p className="text-xs font-black tracking-[0.16em] text-[#FF7A16]">DATA SNAPSHOT</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {appSystem.dataMetrics.map((metric) => (
                  <article
                    key={`${metric.label}-${metric.value}`}
                    className={`rounded-xl border px-3 py-3 ${
                      metric.tone ? toneClassMap[metric.tone] : 'border-[#14295F]/14 bg-[#F8FAFF] text-[#14295F] ring-1 ring-white/70'
                    }`}
                  >
                    <p className="text-xs font-black">{metric.label}</p>
                    <p className="font-brand mt-1 text-xl">{metric.value}</p>
                    <p className="mt-1 text-[11px] font-bold opacity-80">{metric.detail}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {appSystem.appScreens.map((screen, index) => (
              <article key={screen.title} className="marketing-card rounded-[1.8rem] p-4">
                <div className="rounded-[1.25rem] border border-[#14295F]/10 bg-[linear-gradient(170deg,#EEF3FF,#FFFFFF)] p-4">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#FF7A16]/15 text-[#FF7A16]">
                    {index === 0 ? <Sparkles className="h-4 w-4" /> : null}
                    {index === 1 ? <BarChart3 className="h-4 w-4" /> : null}
                    {index === 2 ? <CalendarDays className="h-4 w-4" /> : null}
                  </div>

                  <p className="mt-3 text-[11px] font-black tracking-[0.14em] text-[#14295F]/60">LIVE WIDGET</p>
                  <div className="mt-2 space-y-2 rounded-xl border border-[#14295F]/10 bg-white p-3">
                    <div className="flex items-center justify-between text-[11px] font-black text-[#14295F]">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3 text-[#FF7A16]" />
                        최근 공부시간
                      </span>
                      <span>14:23</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#E5ECFF]">
                      <div className="h-full w-4/5 rounded-full bg-[#14295F]" />
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
                  <p className="font-brand break-keep text-base text-[#14295F]">{screen.title}</p>
                  <p className="mt-1 break-keep text-xs font-black text-[#FF7A16]">{screen.subtitle}</p>
                  <p className="mt-2 break-keep text-xs font-bold leading-relaxed text-slate-600">{screen.caption}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
