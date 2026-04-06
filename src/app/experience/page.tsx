import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Smartphone, Users } from 'lucide-react';

import { DataAnalyticsPreviewSection } from '@/components/marketing/data-analytics-preview-section';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { MarketingPageTracker } from '@/components/marketing/marketing-page-tracker';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { SectionHeading } from '@/components/marketing/section-heading';
import type { MarketingContent } from '@/lib/marketing-content';
import { marketingContent } from '@/lib/marketing-content';

type ExperienceSection = MarketingContent['experienceShowcase']['sections'][number];
type ExperienceFrame = ExperienceSection['primaryScreen'];
type ExperienceTone = 'student' | 'parent';

const toneStyleMap: Record<
  ExperienceTone,
  {
    label: string;
    iconWrap: string;
    chip: string;
    sectionCard: string;
    frameCanvas: string;
    insight: string;
    textButton: string;
    glow: string;
  }
> = {
  student: {
    label: 'text-[#14295F]',
    iconWrap: 'bg-[#EEF3FF] text-[#14295F]',
    chip: 'border-[#14295F]/12 bg-[#EEF3FF] text-[#14295F]',
    sectionCard: 'border-[#14295F]/10 bg-white',
    frameCanvas: 'border-[#D8E5FF] bg-[linear-gradient(180deg,#F8FBFF_0%,#EEF3FF_100%)]',
    insight: 'border-[#14295F]/10 bg-[#F8FBFF]',
    textButton: 'border-[#14295F]/12 bg-white text-[#14295F] hover:border-[#14295F]/22 hover:bg-[#F7FAFF]',
    glow: 'bg-[#8CB7FF]/18',
  },
  parent: {
    label: 'text-[#B55200]',
    iconWrap: 'bg-[#FFF3E8] text-[#FF7A16]',
    chip: 'border-[#FF7A16]/12 bg-[#FFF3E8] text-[#B55200]',
    sectionCard: 'border-[#FF7A16]/12 bg-white',
    frameCanvas: 'border-[#FFD9BF] bg-[linear-gradient(180deg,#FFF9F2_0%,#FFF3E8_100%)]',
    insight: 'border-[#FF7A16]/12 bg-[#FFF9F2]',
    textButton: 'border-[#FF7A16]/12 bg-white text-[#B55200] hover:border-[#FF7A16]/24 hover:bg-[#FFF9F2]',
    glow: 'bg-[#FFB878]/20',
  },
};

function resolveTone(mode: string): ExperienceTone {
  return mode === '학부모 모드' ? 'parent' : 'student';
}

function ModeIcon({ mode }: { mode: string }) {
  const Icon = mode === '학부모 모드' ? Users : Smartphone;
  return <Icon className="h-5 w-5" />;
}

function ScreenshotCard({
  screen,
  tone,
  featured = false,
}: {
  screen: ExperienceFrame;
  tone: ExperienceTone;
  featured?: boolean;
}) {
  const style = toneStyleMap[tone];
  const isLandscape = Boolean(screen.width && screen.height && screen.width > screen.height);
  const mediaWidthClass = featured
    ? isLandscape
      ? 'max-w-[30rem]'
      : 'max-w-[24rem]'
    : isLandscape
      ? 'max-w-full'
      : 'max-w-[20rem]';

  return (
    <article className={`overflow-hidden rounded-[2rem] border p-4 shadow-[0_20px_44px_rgba(20,41,95,0.08)] sm:p-5 ${style.sectionCard}`}>
      <div className={`relative overflow-hidden rounded-[1.7rem] border p-3 sm:p-4 ${style.frameCanvas}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.85),transparent_58%)]" />
        <div className={`absolute -left-10 bottom-10 h-28 w-28 rounded-full blur-3xl ${style.glow}`} />
        <div className={`absolute -right-6 top-8 h-24 w-24 rounded-full blur-3xl ${style.glow}`} />

        <div className={`relative flex items-center justify-center ${featured ? 'min-h-[17rem] sm:min-h-[19rem]' : 'min-h-[15rem] sm:min-h-[17rem]'}`}>
          <div className={`absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[78px] ${style.glow}`} />
          <div className={`relative mx-auto w-full ${mediaWidthClass}`}>
            {screen.image && screen.width && screen.height ? (
              <div className="overflow-hidden rounded-[1.45rem] border border-white/72 bg-white shadow-[0_22px_42px_rgba(20,41,95,0.14)]">
                <Image
                  src={screen.image}
                  alt={screen.alt}
                  width={screen.width}
                  height={screen.height}
                  sizes={featured ? '(max-width: 1024px) 92vw, 34vw' : '(max-width: 768px) 92vw, 26vw'}
                  className="h-auto w-full"
                />
              </div>
            ) : screen.image ? (
              <div
                className="relative overflow-hidden rounded-[1.45rem] border border-white/72 bg-white shadow-[0_22px_42px_rgba(20,41,95,0.14)]"
                style={{ aspectRatio: featured ? '4 / 5' : '3 / 4' }}
              >
                <Image
                  src={screen.image}
                  alt={screen.alt}
                  fill
                  sizes={featured ? '(max-width: 1024px) 92vw, 34vw' : '(max-width: 768px) 92vw, 26vw'}
                  className="object-contain bg-white"
                />
              </div>
            ) : (
              <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-[1.45rem] border border-dashed border-[#14295F]/12 bg-white/82 px-6 py-8 text-center shadow-[0_22px_42px_rgba(20,41,95,0.08)]">
                <span className="rounded-full border border-[#14295F]/10 bg-white/84 px-3 py-1 text-[10px] font-black tracking-[0.14em] text-[#14295F]/56 backdrop-blur">
                  실제 스크린샷 예정
                </span>
                <p className="mt-4 break-keep text-[1rem] font-black leading-[1.45] text-[#14295F]">
                  완성된 화면이
                  <br />
                  이 자리에 반영됩니다.
                </p>
                <p className="mt-2 break-keep text-[12px] font-semibold leading-[1.65] text-[#5B7088]">
                  지금은 구조와 설명부터 먼저 준비했습니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[0.98rem] font-black leading-[1.4] text-[#14295F]">{screen.title}</p>
        <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.72] text-[#51667D]">{screen.caption}</p>
      </div>
    </article>
  );
}

function ExperienceSectionBlock({ section, reverse = false }: { section: ExperienceSection; reverse?: boolean }) {
  const tone = resolveTone(section.mode);
  const style = toneStyleMap[tone];
  const hasPrimaryScreenImage = Boolean(section.primaryScreen.image);
  const showStudentScreenSet = section.mode === '학생 모드' && section.secondaryScreens.length >= 2;
  const showScreenColumn = hasPrimaryScreenImage;

  return (
    <div className="relative">
      <div className={`pointer-events-none absolute ${reverse ? 'left-[-4%] top-[18%]' : 'right-[-4%] top-[14%]'} h-44 w-44 rounded-full blur-[120px] ${style.glow}`} />

      <div
        className={`relative grid gap-6 lg:gap-8 ${
          !showScreenColumn
            ? 'lg:grid-cols-1'
            : `lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] ${reverse ? 'lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1' : ''}`
        }`}
      >
        <div className={`order-2 flex flex-col lg:order-1 ${!showScreenColumn ? 'mx-auto w-full max-w-3xl' : ''}`}>
          <div>
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${style.iconWrap}`}>
                <ModeIcon mode={section.mode} />
              </div>
              <p className={`text-[12px] font-black tracking-[0.14em] ${style.label}`}>{section.mode}</p>
            </div>

            <h2
              className={`mt-5 break-keep text-[#14295F] ${
                tone === 'student'
                  ? 'font-aggro-display text-[clamp(1.85rem,4.2vw,2.7rem)] leading-[1.08] tracking-[-0.04em]'
                  : 'font-aggro-display text-[clamp(1.75rem,3.8vw,2.5rem)] leading-[1.1] tracking-[-0.03em]'
              }`}
            >
              {section.title.split('\n').map((line, index) => (
                <span key={`${section.mode}-title-${index}`} className="block">
                  {line}
                </span>
              ))}
            </h2>
            <p
              className={`mt-4 break-keep ${
                tone === 'student'
                  ? 'max-w-[28rem] text-[15px] font-semibold leading-[1.8] text-[#506680]'
                  : 'max-w-[29rem] text-[15px] font-semibold leading-[1.85] text-[#40556F]'
              }`}
            >
              {section.summary}
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              {section.highlights.map((item) => (
                <span key={`${section.mode}-${item}`} className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${style.chip}`}>
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-8 max-w-[34rem]">
              <p className={`text-[10px] font-black tracking-[0.22em] ${style.label}`}>VIEW INSIGHT</p>
              <h3 className="mt-3 break-keep text-[1.35rem] font-black leading-[1.3] text-[#14295F] sm:text-[1.55rem]">
                {section.insightTitle}
              </h3>
              <p className="mt-3 break-keep text-[14px] font-semibold leading-[1.82] text-[#51667D]">
                {section.insightDescription}
              </p>
              <div className="mt-5">
                <Link
                  href={section.ctaHref}
                  className={`inline-flex h-11 items-center justify-center rounded-full border px-5 text-[13px] font-black transition-colors ${style.textButton}`}
                >
                  {section.ctaLabel}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {showScreenColumn ? <div className="order-1 lg:order-2">
          {showStudentScreenSet ? (
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] md:items-center">
              <div className="space-y-4">
                <ScreenshotCard screen={section.primaryScreen} tone={tone} />
                <ScreenshotCard screen={section.secondaryScreens[0]!} tone={tone} />
              </div>
              <div className="md:pt-16">
                <ScreenshotCard screen={section.secondaryScreens[1]!} tone={tone} />
              </div>
            </div>
          ) : (
              <ScreenshotCard screen={section.primaryScreen} tone={tone} featured />
            )}
        </div> : null}
      </div>
    </div>
  );
}

export default function ExperiencePage() {
  const experienceShowcase = marketingContent.experienceShowcase;

  return (
    <main className="min-h-screen overflow-x-clip bg-white text-[#14295F]">
      <MarketingPageTracker pageType="experience" placement="experience_page" />
      <MarketingHeader brand={marketingContent.brand} nav={marketingContent.nav} />
      <section className="relative overflow-hidden bg-white pt-8 sm:pt-10 lg:pt-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(255,122,22,0.10),transparent_46%),radial-gradient(circle_at_18%_16%,rgba(20,41,95,0.07),transparent_28%)]" />
        <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex justify-end">
            <Link
              href="/go/login?placement=experience_header"
              className="inline-flex items-center gap-2 rounded-full bg-[#FF7A16] px-4 py-2 text-[13px] font-black text-white shadow-[0_14px_24px_rgba(255,122,22,0.26)] transition-transform hover:-translate-y-0.5"
            >
              실제 로그인
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <ScrollReveal className="mt-7">
            <div className="py-3 sm:py-5">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-10">
                <div>
                  <SectionHeading
                    eyebrow="ACTUAL LEARNING SYSTEM"
                    title={experienceShowcase.heading}
                    description={experienceShowcase.description}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-[1.45rem] border border-[#D8E5FF] bg-[#F8FBFF] px-5 py-5">
                    <p className="text-[11px] font-black tracking-[0.18em] text-[#14295F]/52">STUDENT VIEW</p>
                    <p className="mt-3 break-keep text-[1rem] font-black leading-[1.42] text-[#14295F]">
                      학습관리 시스템 운영으로 오늘의 계획이
                      <br />
                      실천으로 이어지고 기록이 누적됩니다.
                    </p>
                  </div>
                  <div className="rounded-[1.45rem] border border-[#FFD9BF] bg-[#FFF7EF] px-5 py-5">
                    <p className="text-[11px] font-black tracking-[0.18em] text-[#B55200]/70">PARENT VIEW</p>
                    <p className="mt-3 break-keep text-[1rem] font-black leading-[1.42] text-[#14295F]">
                      학생의 학습데이터를 실시간으로 확인 가능한
                      <br />
                      학부모용 웹앱을 제공합니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {experienceShowcase.sections.map((section, index) => (
        <section
          key={section.mode}
          className={index % 2 === 0 ? 'bg-[#FFF8F1] py-14 lg:py-18' : 'bg-white py-14 lg:py-18'}
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal delay={index * 80}>
              <ExperienceSectionBlock section={section} reverse={index % 2 === 1} />
            </ScrollReveal>
          </div>
        </section>
      ))}

      <section className="bg-[#FFF8F1] py-14 lg:py-18">
        <ScrollReveal>
          <DataAnalyticsPreviewSection showNextView={false} />
        </ScrollReveal>
      </section>

      <section className="bg-white py-14 lg:py-18">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center">
              {experienceShowcase.footerNote ? (
                <p className="text-center text-[12px] font-semibold text-[#667A95]">{experienceShowcase.footerNote}</p>
              ) : null}

              <div className="mx-auto mt-4 max-w-3xl">
                <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">READY FOR REAL CAPTURES</p>
                <h2 className="font-aggro-display mt-3 break-keep text-[clamp(1.55rem,3vw,2.2rem)] font-black leading-[1.2] tracking-[-0.03em] text-[#14295F]">
                  {experienceShowcase.closingTitle}
                </h2>
                {experienceShowcase.closingDescription ? (
                  <p className="mt-3 break-keep text-[14px] font-semibold leading-[1.8] text-[#425A75]">
                    {experienceShowcase.closingDescription}
                  </p>
                ) : null}
                <div className="mt-6">
                  <Link href={experienceShowcase.closingHref} className="premium-cta premium-cta-primary h-11 px-6 text-sm">
                    {experienceShowcase.closingLabel}
                  </Link>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
      <MarketingFooter brand={marketingContent.brand} footer={marketingContent.footer} />
    </main>
  );
}
