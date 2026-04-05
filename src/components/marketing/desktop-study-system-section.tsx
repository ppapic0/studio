import Link from 'next/link';
import { ArrowRight, ChartColumnBig, ClipboardList, ShieldCheck, Sparkles, Target } from 'lucide-react';

import type { MarketingContent } from '@/lib/marketing-content';
import { cn } from '@/lib/utils';

import { SectionHeading } from './section-heading';

type DesktopStudySystemSectionProps = {
  content: MarketingContent['mobileStudySystem'];
};

const sectionIcons = [Target, ChartColumnBig, ShieldCheck, Sparkles] as const;

const toneStyles = {
  navy: {
    shell: 'border-[#D8E5FF] bg-[linear-gradient(180deg,#F8FBFF_0%,#FFFFFF_100%)]',
    panel: 'border-[#D9E7FF] bg-[linear-gradient(180deg,#F9FBFF_0%,#EEF5FF_100%)]',
    badge: 'bg-[#EEF3FF] text-[#14295F]',
    icon: 'bg-[#14295F] text-white',
    body: 'text-[#425A75]',
    glow: 'bg-[#8CB7FF]/18',
  },
  slate: {
    shell: 'border-[#DCE5F6] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)]',
    panel: 'border-[#D9E7FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F3F7FF_100%)]',
    badge: 'bg-[#EEF3FF] text-[#14295F]',
    icon: 'bg-[#EEF3FF] text-[#14295F]',
    body: 'text-[#425A75]',
    glow: 'bg-[#8CB7FF]/14',
  },
  orange: {
    shell: 'border-[#FFD9BF] bg-[linear-gradient(180deg,#FFF9F2_0%,#FFFFFF_100%)]',
    panel: 'border-[#FFD8BF] bg-[linear-gradient(180deg,#FFF8F0_0%,#FFF3E8_100%)]',
    badge: 'bg-[#FFF3E8] text-[#B55200]',
    icon: 'bg-[#FF7A16] text-white',
    body: 'text-[#5A4A3F]',
    glow: 'bg-[#FFB878]/20',
  },
  violet: {
    shell: 'border-[#E3DBFF] bg-[linear-gradient(180deg,#FBFAFF_0%,#FFFFFF_100%)]',
    panel: 'border-[#E5DCFF] bg-[linear-gradient(180deg,#FCFBFF_0%,#F2EEFF_100%)]',
    badge: 'bg-[#F2EEFF] text-[#4B3B97]',
    icon: 'bg-[#14295F] text-white',
    body: 'text-[#564D7C]',
    glow: 'bg-[#BBAEFF]/18',
  },
} as const;

const previewTitles = [
  '학습 방향 설정 흐름',
  '실시간 체크 · 피드백 흐름',
  '허용사이트 설정 화면 예정',
  '포인트 · 상벌점 화면 예정',
] as const;

const sectionSurfaceStyles = {
  light: {
    section: 'bg-white',
    title: 'text-[#14295F]',
    body: 'text-[#425A75]',
    secondary: 'text-[#425A75]',
    chip: 'border-[#14295F]/10 bg-white/88 text-[#14295F]',
    button: 'border-[#14295F]/12 bg-white text-[#14295F] hover:border-[#14295F]/22 hover:bg-[#F7FAFF]',
  },
  dark: {
    section: 'bg-[#14295F]',
    title: 'text-white',
    body: 'text-white/82',
    secondary: 'text-white/72',
    chip: 'border-white/12 bg-white/10 text-white',
    button: 'border-white/16 bg-white text-[#14295F] hover:bg-[#F7FAFF]',
  },
} as const;

function DesktopStudySystemPreview({
  section,
  index,
  isDark,
}: {
  section: MarketingContent['mobileStudySystem']['sections'][number];
  index: number;
  isDark: boolean;
}) {
  const tone = toneStyles[section.tone];
  const previewSurface = isDark
    ? {
        panel: 'border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.04)_100%)]',
        card: 'border-white/12 bg-white/10 backdrop-blur-sm',
        subtleCard: 'border-white/10 bg-white/8 backdrop-blur-sm',
        label: 'text-white/58',
        title: 'text-white',
        body: 'text-white/74',
        chip: 'border-white/12 bg-white/10 text-white',
        count: 'bg-white text-[#14295F]',
      }
    : {
        panel: tone.panel,
        card: 'border-white/70 bg-white/88',
        subtleCard: 'border-[#14295F]/8 bg-white/88',
        label: 'text-[#FF7A16]',
        title: 'text-[#14295F]',
        body: 'text-[#53687F]',
        chip: 'border-[#6050A8]/10 bg-white/88 text-[#4B3B97]',
        count: 'bg-[#14295F] text-white',
      };

  if (index === 0) {
    return (
      <div className={cn('relative overflow-hidden rounded-[1.9rem] border p-5 shadow-[0_20px_44px_rgba(20,41,95,0.08)]', previewSurface.panel)}>
        <div className={`pointer-events-none absolute -right-8 top-4 h-24 w-24 rounded-full blur-3xl ${tone.glow}`} />
        <div className={cn('relative rounded-[1.5rem] border p-6 shadow-[0_14px_32px_rgba(20,41,95,0.08)]', previewSurface.card)}>
          <p className={cn('text-[10px] font-black tracking-[0.18em]', previewSurface.label)}>TODAY FLOW</p>
          <p className={cn('font-aggro-display mt-4 break-keep text-[1.35rem] font-black leading-[1.2] tracking-[-0.03em]', previewSurface.title)}>
            {section.body}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {['계획 작성', '실행 체크', '흐름 확인'].map((item) => (
              <div key={item} className={cn('rounded-[1rem] border px-3 py-3 text-center', previewSurface.subtleCard)}>
                <p className={cn('font-aggro-display text-[0.92rem] font-black tracking-[-0.03em]', previewSurface.title)}>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (index === 1) {
    const flowCards = [
      { title: '학습현황 확인', body: section.body },
      { title: '학습의 피드백', body: section.secondaryBody ?? '학생별 취약 구간과 피드백 연결 흐름을 빠르게 읽습니다.' },
      { title: '학부모 확인', body: '학생과 학부모가 같은 데이터를 각자의 화면에서 실시간으로 확인합니다.' },
    ];

    return (
      <div className="grid gap-3">
        {flowCards.map((card) => (
          <article key={card.title} className={cn('rounded-[1.35rem] border px-5 py-4 shadow-[0_14px_30px_rgba(20,41,95,0.06)]', previewSurface.panel)}>
            <p className={cn('text-[10px] font-black tracking-[0.16em]', previewSurface.label)}>SYSTEM FLOW</p>
            <p className={cn('font-aggro-display mt-3 break-keep text-[1rem] font-black leading-[1.32] tracking-[-0.03em]', previewSurface.title)}>
              {card.title}
            </p>
            <p className={cn('mt-2 break-keep text-[13px] font-semibold leading-[1.7]', previewSurface.body)}>{card.body}</p>
          </article>
        ))}
      </div>
    );
  }

  if (index === 2) {
    return (
      <div className={cn('relative overflow-hidden rounded-[1.9rem] border p-5 shadow-[0_20px_44px_rgba(20,41,95,0.08)]', previewSurface.panel)}>
        <div className={`pointer-events-none absolute -left-8 bottom-0 h-24 w-24 rounded-full blur-3xl ${tone.glow}`} />
        <div className="relative">
          <p className={cn('text-[10px] font-black tracking-[0.18em]', previewSurface.label)}>FIREWALL CONTROL</p>
          <p className={cn('font-aggro-display mt-4 break-keep text-[1.25rem] font-black leading-[1.24] tracking-[-0.03em]', previewSurface.title)}>
            {previewTitles[index]}
          </p>
          <div className="mt-5 space-y-3">
            {section.detailPoints?.map((point, pointIndex) => (
              <div key={point} className={cn('flex items-start gap-3 rounded-[1.1rem] border px-4 py-3', previewSurface.subtleCard)}>
                <span className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black', previewSurface.count)}>
                  {pointIndex + 1}
                </span>
                <p className={cn('break-keep text-[13px] font-semibold leading-[1.68]', previewSurface.body)}>{point}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden rounded-[1.9rem] border p-5 shadow-[0_20px_44px_rgba(20,41,95,0.08)]', previewSurface.panel)}>
      <div className={`pointer-events-none absolute -right-8 top-2 h-24 w-24 rounded-full blur-3xl ${tone.glow}`} />
      <div className="relative">
        <div className="flex flex-wrap gap-2">
          {['포인트', '상벌점', '동기 유지'].map((item) => (
            <span
              key={item}
              className={cn('inline-flex rounded-full border px-3 py-1.5 text-[11px] font-black', previewSurface.chip)}
            >
              {item}
            </span>
          ))}
        </div>

        <div className={cn('mt-5 rounded-[1.5rem] border px-6 py-8 text-center shadow-[0_14px_32px_rgba(20,41,95,0.08)]', previewSurface.card)}>
          <p className={cn('text-[10px] font-black tracking-[0.18em]', previewSurface.label)}>REAL CAPTURE READY</p>
          <p className={cn('font-aggro-display mt-4 break-keep text-[1.25rem] font-black leading-[1.24] tracking-[-0.03em]', previewSurface.title)}>
            {section.alt ?? previewTitles[index]}
          </p>
          <p className={cn('mt-3 break-keep text-[13px] font-semibold leading-[1.72]', previewSurface.body)}>
            포인트와 상벌점 운영 흐름이 실제 앱 화면으로 반영될 자리를 미리 구성했습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

export function DesktopStudySystemSection({ content }: DesktopStudySystemSectionProps) {
  return (
    <section className="hidden sm:block">
      <div className="bg-white py-14 sm:py-16 lg:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center [&_.eyebrow-badge]:mx-auto">
            <SectionHeading
              eyebrow={content.intro.eyebrow}
              title={content.intro.title}
              description={content.intro.description}
            />
          </div>
        </div>
      </div>

      <div>
        {content.sections.map((section, index) => {
          const Icon = sectionIcons[index] ?? Sparkles;
          const tone = toneStyles[section.tone];
          const surface = sectionSurfaceStyles[index % 2 === 1 ? 'dark' : 'light'];

          return (
            <div key={section.title} className={`${surface.section} py-16 lg:py-20`}>
              <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="relative">
                  <div className={`pointer-events-none absolute left-1/2 top-0 h-44 w-44 -translate-x-1/2 rounded-full blur-[110px] ${tone.glow}`} />
                  <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone.icon}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black tracking-[0.18em] ${tone.badge}`}>
                        SECTION {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>

                    <h3 className={`font-aggro-display mt-6 break-keep text-[clamp(1.7rem,3vw,2.65rem)] font-black leading-[1.08] tracking-[-0.03em] ${surface.title}`}>
                      {section.title}
                    </h3>
                    <p className={`mt-5 max-w-3xl break-keep text-[15px] font-semibold leading-[1.84] ${surface.body}`}>
                      {section.body}
                    </p>
                    {section.secondaryBody ? (
                      <p className={`mt-3 max-w-3xl break-keep text-[14px] font-semibold leading-[1.8] ${surface.secondary}`}>
                        {section.secondaryBody}
                      </p>
                    ) : null}

                    {section.detailPoints?.length ? (
                      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                        {section.detailPoints.map((point) => (
                          <span
                            key={point}
                            className={`inline-flex rounded-full border px-3 py-1.5 text-[11px] font-black ${surface.chip}`}
                          >
                            {point}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {section.href ? (
                      <div className="mt-6">
                        <Link
                          href={section.href}
                          className={`inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[13px] font-black transition-colors ${surface.button}`}
                        >
                          자세히 보기
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    ) : null}
                  </div>

                  <div className="mx-auto mt-8 max-w-5xl lg:mt-10">
                    <DesktopStudySystemPreview section={section} index={index} isDark={index % 2 === 1} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
