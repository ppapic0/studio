import Image from 'next/image';
import { LayoutDashboard, Smartphone, Users } from 'lucide-react';

import type { MarketingContent } from '@/lib/marketing-content';

import { SectionHeading } from './section-heading';

type AppSystemSectionProps = {
  appSystem: MarketingContent['appSystem'];
};

type ScreenCardProps = {
  screen: MarketingContent['appSystem']['appScreens'][number];
  featured?: boolean;
};

const screenStyleMap = {
  센터관리자: {
    icon: LayoutDashboard,
    accent: 'border-[#14295F]/12',
    badge: 'bg-[#14295F] text-white',
    eyebrow: 'text-[#14295F]/55',
    chip: 'border-[#14295F]/10 bg-[#EEF3FF] text-[#14295F]',
    iconWrap: 'bg-[#EEF3FF] text-[#14295F]',
    frame: 'border-[#14295F]/16 bg-[linear-gradient(180deg,#F8FBFF_0%,#EEF3FF_100%)]',
  },
  '학부모 모드': {
    icon: Users,
    accent: 'border-[#FF7A16]/16',
    badge: 'bg-[#FFF3E8] text-[#B55200]',
    eyebrow: 'text-[#B55200]/72',
    chip: 'border-[#FF7A16]/12 bg-[#FFF3E8] text-[#B55200]',
    iconWrap: 'bg-[#FFF3E8] text-[#FF7A16]',
    frame: 'border-[#FF7A16]/18 bg-[linear-gradient(180deg,#FFF9F2_0%,#FFF3E8_100%)]',
  },
  '학생 모드': {
    icon: Smartphone,
    accent: 'border-[#14295F]/12',
    badge: 'bg-[#EEF3FF] text-[#14295F]',
    eyebrow: 'text-[#14295F]/55',
    chip: 'border-[#14295F]/10 bg-[#F4F8FF] text-[#14295F]',
    iconWrap: 'bg-[#F1F5FF] text-[#14295F]',
    frame: 'border-[#14295F]/16 bg-[linear-gradient(180deg,#FBFCFF_0%,#F2F6FF_100%)]',
  },
} as const;

function PlaceholderFrame({ screen, featured = false }: ScreenCardProps) {
  const frameClass =
    screen.frame === 'desktop'
      ? 'aspect-[16/10] rounded-[1.6rem]'
      : 'mx-auto max-w-[15rem] aspect-[10/18] rounded-[1.9rem]';
  const style = screenStyleMap[screen.mode as keyof typeof screenStyleMap] ?? screenStyleMap['학생 모드'];

  if (screen.image) {
    return (
      <div className={`relative overflow-hidden border shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${frameClass} ${style.frame}`}>
        <Image
          src={screen.image}
          alt={screen.title}
          fill
          sizes={screen.frame === 'desktop' ? '(max-width: 1024px) 100vw, 60vw' : '(max-width: 1024px) 100vw, 20vw'}
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden border border-dashed shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${frameClass} ${style.frame}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.72),transparent_48%)]" />
      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <span className="rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[10px] font-black tracking-[0.14em] text-[#14295F]/56">
          스크린샷 자리
        </span>
        <p className={`mt-3 break-keep text-[1rem] font-black ${featured ? 'sm:text-[1.1rem]' : ''} text-[#14295F]`}>
          실제 스크린샷 예정
        </p>
        <p className="mt-2 break-keep text-[12px] font-semibold leading-[1.65] text-[#5C708B]">
          실제 운영 화면 완성 후 이 자리에 반영됩니다.
        </p>
      </div>
    </div>
  );
}

function ScreenCard({ screen, featured = false }: ScreenCardProps) {
  const style = screenStyleMap[screen.mode as keyof typeof screenStyleMap] ?? screenStyleMap['학생 모드'];
  const Icon = style.icon;

  return (
    <article
      className={`rounded-[1.75rem] border bg-white p-5 shadow-[0_18px_40px_rgba(20,41,95,0.08)] sm:p-6 ${style.accent}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${style.iconWrap}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className={`text-[10px] font-black tracking-[0.18em] ${style.eyebrow}`}>{screen.mode}</p>
            <h3 className="mt-1 break-keep text-[1.12rem] font-black leading-[1.35] text-[#14295F] sm:text-[1.22rem]">
              {screen.title}
            </h3>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black ${style.badge}`}>
          {featured ? '대표화면' : '모바일 화면'}
        </span>
      </div>

      <p className="mt-3 break-keep text-[14px] font-semibold leading-[1.72] text-[#425a75]">{screen.summary}</p>

      <div className="mt-5">
        <PlaceholderFrame screen={screen} featured={featured} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {screen.highlights.map((item) => (
          <span
            key={`${screen.mode}-${item}`}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${style.chip}`}
          >
            {item}
          </span>
        ))}
      </div>
    </article>
  );
}

export function AppSystemSection({ appSystem }: AppSystemSectionProps) {
  const featuredScreen = appSystem.appScreens.find((screen) => screen.featured) ?? appSystem.appScreens[0];
  const sideScreens = appSystem.appScreens.filter((screen) => screen !== featuredScreen);

  return (
    <section id="app" className="scroll-mt-28 bg-[#F4F7FC] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center [&_.eyebrow-badge]:mx-auto">
          <SectionHeading
            eyebrow="실제 관리 화면"
            title={appSystem.heading}
            description={appSystem.description}
          />
        </div>

        <div className="mt-10 space-y-5">
          {featuredScreen ? <ScreenCard screen={featuredScreen} featured /> : null}

          <div className="grid gap-5 md:grid-cols-2">
            {sideScreens.map((screen) => (
              <ScreenCard key={screen.title} screen={screen} />
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-[12px] font-semibold text-[#667A95]">
          실제 화면은 순차 반영 예정입니다.
        </p>
      </div>
    </section>
  );
}
