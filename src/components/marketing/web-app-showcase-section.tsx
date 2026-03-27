import Image from 'next/image';
import { Smartphone, Users } from 'lucide-react';

import type { MarketingContent } from '@/lib/marketing-content';

import { SectionHeading } from './section-heading';
import { StaggerChildren } from './stagger-children';

type WebAppShowcaseSectionProps = {
  webAppShowcase: MarketingContent['webAppShowcase'];
};

const screenStyleMap = {
  '학생 모드': {
    icon: Smartphone,
    label: 'text-[#14295F]',
    chip: 'border-[#14295F]/12 bg-[#EEF3FF] text-[#14295F]',
    iconWrap: 'bg-[#EEF3FF] text-[#14295F]',
    card: 'border-[#14295F]/10 bg-white',
    canvas: 'border-[#14295F]/12 bg-[linear-gradient(180deg,#F8FBFF_0%,#EEF3FF_100%)]',
    device: 'border-[#14295F]/12 bg-white',
  },
  '학부모 모드': {
    icon: Users,
    label: 'text-[#B55200]',
    chip: 'border-[#FF7A16]/12 bg-[#FFF3E8] text-[#B55200]',
    iconWrap: 'bg-[#FFF3E8] text-[#FF7A16]',
    card: 'border-[#FF7A16]/12 bg-white',
    canvas: 'border-[#FF7A16]/14 bg-[linear-gradient(180deg,#FFF9F2_0%,#FFF3E8_100%)]',
    device: 'border-[#FF7A16]/12 bg-white',
  },
} as const;

type ShowcaseScreen = MarketingContent['webAppShowcase']['screens'][number];

function ScreenshotFrame({ screen }: { screen: ShowcaseScreen }) {
  const style = screenStyleMap[screen.mode as keyof typeof screenStyleMap] ?? screenStyleMap['학생 모드'];

  return (
    <div className={`brand-sheen-panel relative overflow-hidden rounded-[1.15rem] border p-2.5 sm:rounded-[2rem] sm:p-7 ${style.canvas}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.82),transparent_52%)]" />
      <div className="brand-glow-drift absolute -left-10 bottom-8 h-28 w-28 rounded-full bg-white/40 blur-3xl" />
      <div
        className="brand-glow-drift absolute -right-8 top-10 h-32 w-32 rounded-full bg-white/35 blur-3xl"
        style={{ animationDelay: '-2.1s' }}
      />
      <div className="brand-glow-drift absolute left-1/2 top-10 h-28 w-28 -translate-x-1/2 rounded-full bg-[#FFB878]/14 blur-3xl" />

      <div className="relative flex min-h-[12.5rem] items-center justify-center sm:min-h-[24rem]">
        <div className="brand-glow-drift absolute inset-y-4 left-1/2 w-[8rem] -translate-x-1/2 rounded-[2rem] bg-[#14295F]/8 blur-3xl sm:inset-y-8 sm:w-[18rem] sm:rounded-[3rem]" />
        <div
          className={`relative aspect-[10/20] w-full max-w-[7.8rem] overflow-hidden rounded-[1.5rem] border shadow-[0_24px_48px_rgba(20,41,95,0.14)] sm:max-w-[17rem] sm:rounded-[2.6rem] ${style.device} ${
            screen.image ? '' : 'brand-sheen-panel'
          }`}
        >
          {screen.image ? (
            <Image
              src={screen.image}
              alt={screen.alt}
              fill
              sizes="(max-width: 1024px) 80vw, 28vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-3 text-center sm:px-6">
              <span className="rounded-full border border-[#14295F]/10 bg-[#F7FAFF] px-2 py-1 text-[8px] font-black tracking-[0.1em] text-[#14295F]/56 sm:px-3 sm:text-[10px] sm:tracking-[0.14em]">
                실제 스크린샷 예정
              </span>
              <p className="mt-3 break-keep text-[0.74rem] font-black leading-[1.38] text-[#14295F] sm:mt-4 sm:text-[1.05rem] sm:leading-[1.42]">
                완성된 화면이
                <br />
                이 자리에 반영됩니다.
              </p>
              <p className="mt-1.5 break-keep text-[9px] font-semibold leading-[1.45] text-[#5C708B] sm:mt-2 sm:text-[12px] sm:leading-[1.65]">
                지금은 레이아웃과 설명 구조만 먼저 준비합니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShowcaseRow({ screen, reverse = false }: { screen: ShowcaseScreen; reverse?: boolean }) {
  const style = screenStyleMap[screen.mode as keyof typeof screenStyleMap] ?? screenStyleMap['학생 모드'];
  const Icon = style.icon;
  const textColumnClass = reverse ? 'col-start-2 lg:col-start-2' : 'col-start-1 lg:col-start-1';
  const imageColumnClass = reverse
    ? 'col-start-1 row-span-2 row-start-1 lg:col-start-1 lg:row-span-2 lg:row-start-1'
    : 'col-start-2 row-span-2 row-start-1 lg:col-start-2 lg:row-span-2 lg:row-start-1';

  return (
    <article
      className={`brand-sheen-panel relative overflow-hidden rounded-[1.2rem] border p-3 shadow-[0_18px_40px_rgba(20,41,95,0.08)] sm:rounded-[2rem] sm:p-6 lg:p-8 ${style.card}`}
    >
      <div className="brand-glow-drift absolute -right-10 top-6 h-28 w-28 rounded-full bg-[#FFB878]/12 blur-3xl" />
      <div className="grid grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] gap-3 sm:gap-6 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:gap-x-10">
        <div className={textColumnClass}>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 sm:rounded-2xl ${style.iconWrap}`}>
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <p className={`text-[9px] font-black tracking-[0.1em] ${style.label} sm:text-[12px] sm:tracking-[0.14em]`}>{screen.mode}</p>
          </div>

          <h3 className="mt-3 break-keep text-[0.96rem] font-black leading-[1.2] text-[#14295F] sm:mt-4 sm:text-[clamp(1.2rem,6.5vw,2rem)]">
            {screen.title}
          </h3>
        </div>

        <div className={imageColumnClass}>
          <ScreenshotFrame screen={screen} />
        </div>

        <div className={textColumnClass}>
          <p className="break-keep text-[11px] font-semibold leading-[1.65] text-[#425a75] sm:text-[15px] sm:leading-[1.82]">
            {screen.summary}
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-5 sm:gap-2.5">
            {screen.highlights.map((item, index) => (
              <span
                key={`${screen.mode}-${item}`}
                className={`brand-chip-rise rounded-full border px-2 py-1 text-[8.5px] font-black ${style.chip} sm:px-3 sm:py-1.5 sm:text-[11px]`}
                style={{ animationDelay: `${0.08 + index * 0.08}s` }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

export function WebAppShowcaseSection({ webAppShowcase }: WebAppShowcaseSectionProps) {
  return (
    <section
      id="app"
      className="relative scroll-mt-28 overflow-hidden py-16 sm:py-20"
      style={{ background: 'linear-gradient(180deg, #F7F9FD 0%, #FFFFFF 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="brand-glow-drift absolute left-[-4%] top-[18%] h-56 w-56 rounded-full bg-[#8CB7FF]/10 blur-[110px]" />
        <div
          className="brand-glow-drift absolute right-[-3%] top-[30%] h-64 w-64 rounded-full bg-[#FFB878]/14 blur-[120px]"
          style={{ animationDelay: '-2.7s' }}
        />
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-3xl text-center [&_.eyebrow-badge]:mx-auto">
          <SectionHeading
            eyebrow="ACTUAL WEB APP"
            title={webAppShowcase.heading}
            description={webAppShowcase.description}
          />
        </div>

        <StaggerChildren stagger={140} className="mt-8 space-y-4 sm:mt-10 sm:space-y-6">
          {webAppShowcase.screens.map((screen, index) => (
            <ShowcaseRow key={screen.mode} screen={screen} reverse={index % 2 === 1} />
          ))}
        </StaggerChildren>

        <p className="mt-6 text-center text-[12px] font-semibold text-[#667A95]">
          실제 스크린샷은 순차 반영 예정입니다.
        </p>
      </div>
    </section>
  );
}
