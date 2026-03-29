import Link from 'next/link';
import { ArrowRight, ChartColumnBig, ClipboardList, Sparkles, Target } from 'lucide-react';

import type { MarketingContent } from '@/lib/marketing-content';

type MobileStudySystemSectionProps = {
  content: MarketingContent['mobileStudySystem'];
};

const toneStyles = {
  navy: {
    panel: 'border-white/8 bg-white/[0.04]',
    accent: 'text-[#AFC6FF]',
    iconWrap: 'bg-white/10 text-white',
    badge: 'bg-white/10 text-white/70',
  },
  slate: {
    panel: 'border-[#243A74] bg-[#10204A]',
    accent: 'text-[#C6D8FF]',
    iconWrap: 'bg-[#1A2F63] text-[#DCE8FF]',
    badge: 'bg-[#1A2F63] text-[#DCE8FF]/72',
  },
  orange: {
    panel: 'border-[#FF9A47]/18 bg-[linear-gradient(180deg,rgba(255,122,22,0.16)_0%,rgba(255,122,22,0.08)_100%)]',
    accent: 'text-[#FFD2A9]',
    iconWrap: 'bg-[#FF7A16]/18 text-[#FFD8B6]',
    badge: 'bg-white/10 text-[#FFD2A9]',
  },
  violet: {
    panel: 'border-[#6D61D9]/16 bg-[linear-gradient(180deg,rgba(101,84,214,0.14)_0%,rgba(101,84,214,0.08)_100%)]',
    accent: 'text-[#DDD8FF]',
    iconWrap: 'bg-[#3F2F95]/40 text-[#F0EDFF]',
    badge: 'bg-white/10 text-[#E4DFFF]',
  },
} as const;

const sectionIcons = [Target, ChartColumnBig, ClipboardList, Sparkles] as const;

function renderPanel(
  section: MarketingContent['mobileStudySystem']['sections'][number],
  index: number,
) {
  const Icon = sectionIcons[index] ?? Sparkles;
  const tone = toneStyles[section.tone];
  const panelBody = (
    <article
      className={`relative overflow-hidden rounded-[2rem] border p-5 shadow-[0_24px_48px_rgba(2,10,29,0.22)] ${tone.panel}`}
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -right-10 top-0 h-28 w-28 rounded-full blur-3xl"
          style={{
            background:
              section.tone === 'orange'
                ? 'rgba(255,122,22,0.16)'
                : section.tone === 'violet'
                  ? 'rgba(120,102,255,0.16)'
                  : 'rgba(142,173,255,0.14)',
          }}
        />
      </div>

      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black tracking-[0.18em] ${tone.badge}`}>
              SECTION {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="break-keep text-[1.7rem] font-black leading-[1.08] text-white">
              {section.title}
            </h3>
          </div>
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone.iconWrap}`}>
            <Icon className="h-5 w-5" />
          </span>
        </div>

        <div className="space-y-2.5">
          <p className={`break-keep text-[1rem] font-semibold leading-[1.7] ${tone.accent}`}>{section.body}</p>
          {section.secondaryBody ? (
            <p className="break-keep text-[0.96rem] font-semibold leading-[1.72] text-white/72">{section.secondaryBody}</p>
          ) : null}
        </div>

        {index === 3 ? (
          <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.05] p-3">
            <div className="flex h-[16rem] items-center justify-center rounded-[1.4rem] border border-dashed border-white/14 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.12),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] px-6 text-center">
              <div className="space-y-3">
                <span className="inline-flex rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-white/68">
                  APP PREVIEW
                </span>
                <p className="break-keep text-[1.35rem] font-black leading-[1.2] text-white">실제 앱 화면 예정</p>
                <p className="break-keep text-[0.88rem] font-semibold leading-[1.7] text-white/60">
                  포인트와 상벌점 운영이 어떻게 보이는지
                  <br />
                  추후 실제 화면으로 연결됩니다.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {section.href ? (
          <div className="pt-1">
            <span className="inline-flex items-center gap-2 text-[13px] font-black text-white">
              트랙 시스템 보러가기
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        ) : null}
      </div>
    </article>
  );

  if (section.href) {
    return (
      <Link key={section.title} href={section.href} className="block">
        {panelBody}
      </Link>
    );
  }

  return <div key={section.title}>{panelBody}</div>;
}

export function MobileStudySystemSection({ content }: MobileStudySystemSectionProps) {
  return (
    <section className="bg-[#07142F] px-4 py-8 text-white sm:hidden">
      <div className="mx-auto max-w-[28rem] space-y-4">
        <article className="overflow-hidden rounded-[2.25rem] border border-white/8 bg-[linear-gradient(180deg,#0C1E47_0%,#08142F_100%)] p-6 shadow-[0_28px_56px_rgba(2,8,22,0.4)]">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-[#FF9A47]/30 bg-[#FF7A16]/12 px-3 py-1 text-[10px] font-black tracking-[0.2em] text-[#FFB878]">
              {content.intro.eyebrow}
            </span>
            <h2 className="break-keep text-[2.2rem] font-black leading-[1.02] tracking-[-0.05em] text-white">
              {content.intro.title}
            </h2>
            <p className="break-keep text-[0.98rem] font-semibold leading-[1.82] text-white/76">
              {content.intro.description}
            </p>
          </div>
        </article>

        <div className="space-y-4">
          {content.sections.map((section, index) => renderPanel(section, index))}
        </div>
      </div>
    </section>
  );
}
