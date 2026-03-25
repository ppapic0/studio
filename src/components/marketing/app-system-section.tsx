import { ArrowRight, ShieldCheck, Smartphone, Users } from 'lucide-react';

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

type RoleStyle = {
  accent: string;
  label: string;
  chipClass: string;
  iconBg: string;
  icon: typeof Smartphone;
};

const roleStyleMap: Record<string, RoleStyle> = {
  '학생 모드': {
    accent: 'border-t-[3px] border-t-[#14295F]',
    label: 'text-[#14295F]',
    chipClass: 'bg-[#EEF3FF] text-[#14295F] border-[#14295F]/14',
    iconBg: 'bg-[#EEF3FF] text-[#14295F]',
    icon: Smartphone,
  },
  '학부모 모드': {
    accent: 'border-t-[3px] border-t-[#FF7A16]',
    label: 'text-[#B55200]',
    chipClass: 'bg-[#FFF3E8] text-[#B55200] border-[#FF7A16]/14',
    iconBg: 'bg-[#FFF3E8] text-[#FF7A16]',
    icon: Users,
  },
  '운영자 모드': {
    accent: 'border-t-[3px] border-t-emerald-500',
    label: 'text-emerald-700',
    chipClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconBg: 'bg-emerald-50 text-emerald-600',
    icon: ShieldCheck,
  },
};

const connectionFlow = [
  {
    step: '학생이 실행',
    desc: '루틴 체크·공부시간 기록',
    icon: Smartphone,
    iconBg: 'bg-[#EEF3FF] text-[#14295F]',
  },
  {
    step: '데이터로 전환',
    desc: '캘린더·그래프·알림 생성',
    icon: ArrowRight,
    iconBg: 'bg-[#F4F6FA] text-[#8099B8]',
  },
  {
    step: '역할별로 읽음',
    desc: '출결·리포트·위험 신호 확인',
    icon: Users,
    iconBg: 'bg-[#FFF3E8] text-[#FF7A16]',
  },
];

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

        {/* Role cards */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {appSystem.guides.map((guide) => {
            const style = roleStyleMap[guide.mode] ?? roleStyleMap['학생 모드']!;
            const Icon = style.icon;
            return (
              <article
                key={guide.mode}
                className={`overflow-hidden rounded-[1.5rem] border border-[#14295F]/10 bg-white shadow-[0_10px_28px_rgba(20,41,95,0.06)] ${style.accent}`}
              >
                <div className="p-5">
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${style.iconBg}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className={`text-[10px] font-black tracking-[0.18em] ${style.label}`}>{guide.mode}</p>
                  </div>
                  <p className="mt-3 break-keep text-[1.05rem] font-black leading-[1.42] text-[#14295F]">
                    {guide.headline}
                  </p>
                  <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.72] text-[#425a75]">
                    {guide.summary}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {guide.checkpoints.map((checkpoint) => (
                      <span
                        key={`${guide.mode}-${checkpoint}`}
                        className={`rounded-full border px-3 py-1 text-[11px] font-black ${style.chipClass}`}
                      >
                        {checkpoint}
                      </span>
                    ))}
                  </div>
                  <a href={guide.href} className="premium-cta premium-cta-muted mt-5 h-10 px-5 text-sm">
                    {guide.label}
                  </a>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          {/* 3-role connection flow card */}
          <article className="rounded-[1.6rem] border border-[#14295F]/10 bg-white p-6 shadow-[0_10px_28px_rgba(20,41,95,0.06)]">
            <span className="eyebrow-badge">HOW IT CONNECTS</span>
            <p className="mt-4 break-keep text-[1.2rem] font-black leading-[1.4] text-[#14295F]">
              학생의 실행이 데이터가 되고,<br />
              역할에 맞는 화면으로 연결됩니다.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {connectionFlow.map((item, i) => {
                const FlowIcon = item.icon;
                const isArrow = item.icon === ArrowRight;
                return (
                  <div
                    key={item.step}
                    className={`relative rounded-[1.1rem] px-4 py-4 ${
                      isArrow
                        ? 'flex flex-col items-center justify-center border border-dashed border-[#14295F]/12 bg-[#F4F6FA]'
                        : 'border border-[#14295F]/8 bg-[#F8FBFF]'
                    }`}
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.iconBg}`}>
                      <FlowIcon className="h-4 w-4" />
                    </div>
                    <p className="mt-2 text-[12px] font-black text-[#14295F]">{item.step}</p>
                    <p className="mt-1 break-keep text-[11px] font-semibold leading-[1.55] text-[#425a75]">{item.desc}</p>
                    {i < connectionFlow.length - 1 && (
                      <div className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 sm:block">
                        <ArrowRight className="h-4 w-4 text-[#C5D2E8]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-[1rem] border border-[#14295F]/10 bg-[#14295F] px-4 py-3">
              <p className="break-keep text-[12.5px] font-black leading-[1.6] text-white">
                같은 데이터를, 역할에 맞는 언어로 동시에 전달합니다.
              </p>
            </div>
          </article>

          {/* Trust metrics */}
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
