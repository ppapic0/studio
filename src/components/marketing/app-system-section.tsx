import { ShieldCheck, Smartphone, Users } from 'lucide-react';

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
    step: '학생은',
    desc: '오늘 해야 할 행동과 누적 공부시간을 먼저 봅니다.',
    icon: Smartphone,
    iconBg: 'bg-[#EEF3FF] text-[#14295F]',
  },
  {
    step: '학부모는',
    desc: '현재 상태와 흔들리는 구간을 빠르게 읽습니다.',
    icon: Users,
    iconBg: 'bg-[#FFF3E8] text-[#FF7A16]',
  },
  {
    step: '운영자는',
    desc: '하락 신호와 먼저 개입할 대상을 우선순위로 봅니다.',
    icon: ShieldCheck,
    iconBg: 'bg-emerald-50 text-emerald-600',
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
                    <p className={`text-[12px] font-bold tracking-[0.08em] ${style.label}`}>{guide.mode}</p>
                  </div>
                  <p className="mt-3 break-keep text-[1.1rem] font-black leading-[1.42] text-[#14295F]">
                    {guide.headline}
                  </p>
                  <p className="mt-2 break-keep text-[14px] font-semibold leading-[1.72] text-[#425a75]">
                    {guide.summary}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {guide.checkpoints.map((checkpoint) => (
                      <span
                        key={`${guide.mode}-${checkpoint}`}
                        className={`rounded-full border px-3 py-1 text-[12px] font-bold ${style.chipClass}`}
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
            <span className="eyebrow-badge">READING ORDER</span>
            <p className="mt-4 break-keep text-[1.2rem] font-black leading-[1.4] text-[#14295F]">
              같은 기록이 역할마다
              <br />
              다른 질문에 답하게 구성됩니다.
            </p>
            <p className="mt-3 break-keep text-[14px] font-semibold leading-[1.72] text-[#425a75]">
              누구에게 보여주느냐에 따라 첫 화면에서 먼저 읽어야 하는 정보와 다음 행동이 달라집니다.
            </p>

            <div className="mt-5 grid gap-3">
              {connectionFlow.map((item) => {
                const FlowIcon = item.icon;
                return (
                  <div
                    key={item.step}
                    className="rounded-[1.1rem] border border-[#14295F]/8 bg-[#F8FBFF] px-4 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.iconBg}`}>
                        <FlowIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[13px] font-black text-[#14295F]">{item.step}</p>
                        <p className="mt-1 break-keep text-[13px] font-semibold leading-[1.65] text-[#425a75]">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-[1rem] border border-[#14295F]/10 bg-[#14295F] px-4 py-3">
              <p className="break-keep text-[13px] font-bold leading-[1.6] text-white">
                바로 위에서 본 같은 데이터라도, 역할에 따라 먼저 읽는 기준과 화면 구조를 달리 잡았습니다.
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
                  <p className="text-[12px] font-bold">{metric.label}</p>
                  <p className="dashboard-number mt-2 text-[1.4rem]">{metric.value}</p>
                  <p className="mt-1 text-[12px] font-semibold opacity-88">{metric.detail}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
