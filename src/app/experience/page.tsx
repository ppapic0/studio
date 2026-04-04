import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, Smartphone, Users } from 'lucide-react';

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

const koreanMockProgram = {
  eyebrow: 'KOREAN PRACTICE FLOW',
  title: '이감 · 한수 모의고사까지 같은 흐름 안에서 이어서 점검합니다',
  description:
    '앱 안에서 공부시간과 계획 실행 흐름을 확인하는 데서 끝나지 않고, 국어는 이감과 한수 모의고사까지 연결해 실전 감각과 현재 대응 상태를 함께 점검합니다.',
  chips: ['이감 실전 점검', '한수 실전 점검', '실전 감각 유지', '국어 대응력 확인'],
  points: [
    {
      title: '이감',
      summary: '실전 수능 감도에 맞춘 지문 흐름 안에서 현재 대응력을 빠르게 점검합니다.',
    },
    {
      title: '한수',
      summary: '평가원 감각이 흐트러지지 않도록 실전 루틴 안에서 안정적인 대응을 반복합니다.',
    },
  ],
};

const motivationProgram = {
  eyebrow: 'MOTIVATION SYSTEM',
  title: '공부시간과 계획 완수도 결국 동기 설계 안에서 관리합니다',
  description:
    '트랙은 공부시간, 계획 완수, 실행 흐름을 포인트 제도와 상벌점 제도로 연결해 학생들이 학습 동기와 흥미를 꾸준히 유지하도록 운영합니다.',
  chips: ['공부시간 포인트', '계획 완수 반영', '상벌점 운영', '동기 유지 설계'],
  bulletPoints: [
    '공부시간과 계획 완수율이 누적 포인트로 반영됩니다.',
    '지속적인 실행은 보상으로, 흐트러진 루틴은 상벌점으로 바로 연결됩니다.',
    '학생이 스스로 움직이도록 동기와 운영 기준을 함께 설계합니다.',
  ],
  screen: {
    title: '포인트 · 상벌점 운영 화면',
    caption: '포인트 누적, 계획 완수, 상벌점 흐름을 한 화면에서 확인하는 앱 스크린샷 자리입니다.',
    alt: '포인트와 상벌점 운영 화면 스크린샷 예정 자리',
    image: undefined as string | undefined,
  },
};

const toneStyleMap: Record<
  ExperienceTone,
  {
    label: string;
    iconWrap: string;
    chip: string;
    sectionCard: string;
    frameCanvas: string;
    device: string;
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
    device: 'border-[#14295F]/12 bg-white',
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
    device: 'border-[#FF7A16]/12 bg-white',
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

  return (
    <article className={`overflow-hidden rounded-[2rem] border p-4 shadow-[0_20px_44px_rgba(20,41,95,0.08)] sm:p-5 ${style.sectionCard}`}>
      <div className={`relative overflow-hidden rounded-[1.7rem] border p-4 sm:p-5 ${style.frameCanvas}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.85),transparent_58%)]" />
        <div className={`absolute -left-10 bottom-10 h-28 w-28 rounded-full blur-3xl ${style.glow}`} />
        <div className={`absolute -right-6 top-8 h-24 w-24 rounded-full blur-3xl ${style.glow}`} />

        <div className={`relative flex items-center justify-center ${featured ? 'min-h-[29rem] sm:min-h-[31rem]' : 'min-h-[21rem] sm:min-h-[20rem]'}`}>
          <div className={`absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px] ${style.glow}`} />
          <div
            className={`relative aspect-[10/20] w-full overflow-hidden rounded-[2.8rem] border shadow-[0_26px_54px_rgba(20,41,95,0.16)] ${style.device} ${
              featured ? 'max-w-[21rem]' : 'max-w-[14.5rem]'
            }`}
          >
            {screen.image ? (
              <Image
                src={screen.image}
                alt={screen.alt}
                fill
                sizes={featured ? '(max-width: 1024px) 80vw, 28vw' : '(max-width: 768px) 48vw, 18vw'}
                className="object-contain bg-white"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <span className="rounded-full border border-[#14295F]/10 bg-white/78 px-3 py-1 text-[10px] font-black tracking-[0.14em] text-[#14295F]/56 backdrop-blur">
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

  return (
    <article className={`relative overflow-hidden rounded-[2.35rem] border p-5 shadow-[0_24px_58px_rgba(20,41,95,0.10)] sm:p-7 lg:p-8 ${style.sectionCard}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.8),transparent_32%)]" />
      <div className={`absolute ${reverse ? 'left-[-4%] top-[18%]' : 'right-[-4%] top-[14%]'} h-44 w-44 rounded-full blur-[120px] ${style.glow}`} />

      <div className={`relative grid gap-6 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-8 ${reverse ? 'lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1' : ''}`}>
        <div className="order-2 flex flex-col lg:order-1">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${style.iconWrap}`}>
              <ModeIcon mode={section.mode} />
            </div>
            <p className={`text-[12px] font-black tracking-[0.14em] ${style.label}`}>{section.mode}</p>
          </div>

          <h2 className="mt-5 break-keep text-[clamp(1.7rem,3.6vw,2.4rem)] font-black leading-[1.14] text-[#14295F]">
            {section.title}
          </h2>
          <p className="mt-4 break-keep text-[15px] font-semibold leading-[1.9] text-[#40556F]">{section.summary}</p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            {section.highlights.map((item) => (
              <span key={`${section.mode}-${item}`} className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${style.chip}`}>
                {item}
              </span>
            ))}
          </div>

          <div className={`mt-6 rounded-[1.5rem] border px-5 py-5 ${style.insight}`}>
            <p className="text-[11px] font-black tracking-[0.18em] text-[#FF7A16]">WHAT THIS SCREEN HELPS YOU READ</p>
            <p className="mt-3 break-keep text-[1rem] font-black leading-[1.42] text-[#14295F]">{section.insightTitle}</p>
            <p className="mt-2 break-keep text-[13.5px] font-semibold leading-[1.8] text-[#4C627B]">{section.insightDescription}</p>
          </div>

          <div className="mt-6">
            <Link
              href={section.ctaHref}
              className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[13px] font-black transition-colors ${style.textButton}`}
            >
              {section.ctaLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <ScreenshotCard screen={section.primaryScreen} tone={tone} featured />
        </div>
      </div>
    </article>
  );
}

function LargeProductPlaceholder({
  title,
  caption,
  image,
  alt,
}: {
  title: string;
  caption: string;
  image?: string;
  alt: string;
}) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-[#14295F]/10 bg-white p-4 shadow-[0_20px_44px_rgba(20,41,95,0.08)] sm:p-5">
      <div className="relative overflow-hidden rounded-[1.7rem] border border-[#D8E5FF] bg-[linear-gradient(180deg,#F8FBFF_0%,#EEF3FF_100%)] p-4 sm:p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.85),transparent_58%)]" />
        <div className="absolute -left-10 bottom-10 h-28 w-28 rounded-full bg-[#8CB7FF]/16 blur-3xl" />
        <div className="absolute -right-8 top-8 h-28 w-28 rounded-full bg-[#FFB878]/18 blur-3xl" />

        <div className="relative flex items-center justify-center">
          <div className="relative w-full overflow-hidden rounded-[2rem] border border-[#14295F]/12 bg-white shadow-[0_26px_54px_rgba(20,41,95,0.12)]">
            <div className="aspect-[13/9] w-full">
              {image ? (
                <Image src={image} alt={alt} fill sizes="(max-width: 1024px) 100vw, 42vw" className="object-contain bg-white" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <span className="rounded-full border border-[#14295F]/10 bg-white/78 px-3 py-1 text-[10px] font-black tracking-[0.14em] text-[#14295F]/56 backdrop-blur">
                    실제 앱 사진 예정
                  </span>
                  <p className="mt-4 break-keep text-[1rem] font-black leading-[1.45] text-[#14295F]">
                    포인트와 상벌점이 보이는
                    <br />
                    앱 화면이 이 자리에 반영됩니다.
                  </p>
                  <p className="mt-2 break-keep text-[12px] font-semibold leading-[1.7] text-[#5B7088]">{caption}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[0.98rem] font-black leading-[1.4] text-[#14295F]">{title}</p>
        <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.72] text-[#51667D]">{caption}</p>
      </div>
    </div>
  );
}

export default function ExperiencePage() {
  const experienceShowcase = marketingContent.experienceShowcase;

  return (
    <main className="min-h-screen overflow-x-clip bg-[linear-gradient(180deg,#F8F5EF_0%,#FFFFFF_18%,#F7F9FD_100%)] text-[#14295F]">
      <MarketingPageTracker pageType="experience" placement="experience_page" />
      <MarketingHeader brand={marketingContent.brand} nav={marketingContent.nav} />

      <div className="pointer-events-none fixed inset-x-0 top-0 h-[26rem] bg-[radial-gradient(circle_at_top,rgba(255,122,22,0.12),transparent_44%),radial-gradient(circle_at_22%_10%,rgba(20,41,95,0.08),transparent_28%)]" />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[#14295F]/12 bg-white px-4 py-2 text-[13px] font-black text-[#14295F] shadow-[0_10px_24px_rgba(20,41,95,0.06)]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            홍보 페이지로 돌아가기
          </Link>
          <Link
            href="/go/login?placement=experience_header"
            className="inline-flex items-center gap-2 rounded-full bg-[#FF7A16] px-4 py-2 text-[13px] font-black text-white shadow-[0_14px_24px_rgba(255,122,22,0.26)] transition-transform hover:-translate-y-0.5"
          >
            실제 로그인
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <ScrollReveal className="mt-7">
          <section className="relative overflow-hidden rounded-[2.6rem] border border-[#14295F]/10 bg-white px-6 py-7 shadow-[0_28px_64px_rgba(20,41,95,0.10)] sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(20,41,95,0.05),transparent_24%),radial-gradient(circle_at_92%_10%,rgba(255,122,22,0.10),transparent_24%)]" />
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-8">
              <div>
                <SectionHeading
                  eyebrow="ACTUAL WEB APP"
                  title={experienceShowcase.heading}
                  description={experienceShowcase.description}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-[1.45rem] border border-[#14295F]/10 bg-[#F9FBFF] px-5 py-5">
                  <p className="text-[11px] font-black tracking-[0.18em] text-[#14295F]/52">STUDENT VIEW</p>
                  <p className="mt-3 break-keep text-[1rem] font-black leading-[1.42] text-[#14295F]">
                    학생이 더 효율적으로 움직이도록 해야 할 일과 실행 흐름이 먼저 보입니다.
                  </p>
                </div>
                <div className="rounded-[1.45rem] border border-[#FF7A16]/12 bg-[#FFF9F3] px-5 py-5">
                  <p className="text-[11px] font-black tracking-[0.18em] text-[#B55200]/70">PARENT VIEW</p>
                  <p className="mt-3 break-keep text-[1rem] font-black leading-[1.42] text-[#14295F]">
                    학부모는 짧은 확인만으로도 변화 흐름과 학습 흥미까지 읽을 수 있어야 합니다.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </ScrollReveal>

        <div className="mt-8 space-y-6 sm:space-y-7">
          {experienceShowcase.sections.map((section, index) => (
            <ScrollReveal key={section.mode} delay={index * 80}>
              <ExperienceSectionBlock section={section} reverse={index % 2 === 1} />
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal className="mt-8">
          <DataAnalyticsPreviewSection showNextView={false} />
        </ScrollReveal>

        <ScrollReveal className="mt-8">
          <section className="relative overflow-hidden rounded-[2.25rem] border border-[#FF7A16]/14 bg-white px-6 py-7 shadow-[0_24px_58px_rgba(20,41,95,0.08)] sm:px-8 sm:py-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,122,22,0.10),transparent_30%),radial-gradient(circle_at_left,rgba(20,41,95,0.05),transparent_32%)]" />
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start">
              <div>
                <p className="text-[11px] font-black tracking-[0.18em] text-[#FF7A16]">{koreanMockProgram.eyebrow}</p>
                <h2 className="mt-4 break-keep text-[clamp(1.55rem,3vw,2.2rem)] font-black leading-[1.18] text-[#14295F]">
                  {koreanMockProgram.title}
                </h2>
                <p className="mt-4 break-keep text-[15px] font-semibold leading-[1.9] text-[#40556F]">
                  {koreanMockProgram.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  {koreanMockProgram.chips.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-[#FF7A16]/12 bg-[#FFF3E8] px-3 py-1.5 text-[11px] font-black text-[#B55200]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {koreanMockProgram.points.map((item, index) => (
                  <article
                    key={item.title}
                    className="overflow-hidden rounded-[1.8rem] border border-[#14295F]/10 bg-white px-5 py-5 shadow-[0_20px_44px_rgba(20,41,95,0.06)]"
                  >
                    <p className="text-[11px] font-black tracking-[0.18em] text-[#FF7A16]">{`PROGRAM 0${index + 1}`}</p>
                    <p className="mt-4 break-keep text-[1.1rem] font-black leading-[1.3] text-[#14295F]">{item.title}</p>
                    <p className="mt-3 break-keep text-[13.5px] font-semibold leading-[1.82] text-[#4D627C]">
                      {item.summary}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal className="mt-6">
          <section className="relative overflow-hidden rounded-[2.25rem] border border-[#14295F]/10 bg-white px-6 py-7 shadow-[0_24px_58px_rgba(20,41,95,0.08)] sm:px-8 sm:py-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(20,41,95,0.06),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(255,122,22,0.10),transparent_22%)]" />
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:items-start">
              <div>
                <p className="text-[11px] font-black tracking-[0.18em] text-[#FF7A16]">{motivationProgram.eyebrow}</p>
                <h2 className="mt-4 break-keep text-[clamp(1.55rem,3vw,2.2rem)] font-black leading-[1.18] text-[#14295F]">
                  {motivationProgram.title}
                </h2>
                <p className="mt-4 break-keep text-[15px] font-semibold leading-[1.9] text-[#40556F]">
                  {motivationProgram.description}
                </p>

                <div className="mt-5 flex flex-wrap gap-2.5">
                  {motivationProgram.chips.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-[#14295F]/12 bg-[#EEF3FF] px-3 py-1.5 text-[11px] font-black text-[#14295F]"
                    >
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-6 space-y-3">
                  {motivationProgram.bulletPoints.map((item) => (
                    <div
                      key={item}
                      className="rounded-[1.25rem] border border-[#14295F]/10 bg-[#F8FBFF] px-4 py-3 text-[13.5px] font-semibold leading-[1.75] text-[#4C627B]"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <LargeProductPlaceholder
                title={motivationProgram.screen.title}
                caption={motivationProgram.screen.caption}
                image={motivationProgram.screen.image}
                alt={motivationProgram.screen.alt}
              />
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal className="mt-8">
          <div className="space-y-5">
            <p className="text-center text-[12px] font-semibold text-[#667A95]">{experienceShowcase.footerNote}</p>

            <section className="relative overflow-hidden rounded-[2.1rem] border border-[#14295F]/10 bg-white px-6 py-7 text-center shadow-[0_20px_46px_rgba(20,41,95,0.08)] sm:px-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,122,22,0.10),transparent_32%)]" />
              <div className="relative mx-auto max-w-3xl">
                <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">READY FOR REAL CAPTURES</p>
                <h2 className="mt-3 break-keep text-[clamp(1.55rem,3vw,2.2rem)] font-black leading-[1.2] text-[#14295F]">
                  {experienceShowcase.closingTitle}
                </h2>
                <p className="mt-3 break-keep text-[14px] font-semibold leading-[1.8] text-[#425A75]">
                  {experienceShowcase.closingDescription}
                </p>
                <div className="mt-6">
                  <Link href={experienceShowcase.closingHref} className="premium-cta premium-cta-primary h-11 px-6 text-sm">
                    {experienceShowcase.closingLabel}
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </ScrollReveal>
      </div>
      <MarketingFooter brand={marketingContent.brand} footer={marketingContent.footer} />
    </main>
  );
}
