import Link from 'next/link';
import { ArrowRight, BarChart3, GraduationCap, ShieldCheck, Trophy } from 'lucide-react';

import { SectionHeading } from './section-heading';
import { StaggerChildren } from './stagger-children';

const pageDestinations = [
  {
    eyebrow: 'RESULTS',
    title: '합격 실적과 실제 성적표',
    description: '2026 주요 대학 합격과 성적 상승 케이스, 실제 성적표 증빙을 한 페이지에서 확인합니다.',
    href: '/results',
    cta: '실적 자세히 보기',
    highlights: ['2026 합격 결과', '성적 상승 케이스', '실제 성적표'],
    icon: Trophy,
    cardClass:
      'border-[#14295F]/10 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)]',
    iconClass: 'bg-[#14295F] text-white',
  },
  {
    eyebrow: 'CENTER',
    title: '센터 환경과 와이파이 보안',
    description: '와이파이 방화벽 운영과 실제 센터 공간을 한 흐름으로 보여드리는 페이지입니다.',
    href: '/center',
    cta: '센터 환경 보기',
    highlights: ['학습 집중 환경', '불필요한 접속 제한', '센터 사진'],
    icon: ShieldCheck,
    cardClass:
      'border-[#FF7A16]/14 bg-[linear-gradient(180deg,#FFF9F2_0%,#FFFFFF_100%)]',
    iconClass: 'bg-[#FFF1E4] text-[#FF7A16]',
  },
  {
    eyebrow: 'WEB APP',
    title: '실제 웹앱 화면과 데이터',
    description: '학생·학부모 화면과 실제 운영 데이터를 같은 페이지에서 이어서 확인할 수 있습니다.',
    href: '/experience',
    cta: '웹앱 체험 보기',
    highlights: ['학생 화면', '학부모 화면', '데이터 그래프'],
    icon: BarChart3,
    cardClass:
      'border-[#14295F]/10 bg-[linear-gradient(180deg,#FFFFFF_0%,#F6F9FF_100%)]',
    iconClass: 'bg-[#EEF3FF] text-[#14295F]',
  },
  {
    eyebrow: 'KOREAN CLASS',
    title: '국어 수업과 실전 모의 운영',
    description: '원장 직강, 수업 자료, 실전 모의고사 운영까지 국어 수업 페이지에서 자세히 보여드립니다.',
    href: '/class',
    cta: '국어 수업 보기',
    highlights: ['원장 직강', '자료 기반 수업', '실전 모의 운영'],
    icon: GraduationCap,
    cardClass:
      'border-[#14295F]/10 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)]',
    iconClass: 'bg-[#14295F] text-white',
  },
] as const;

export function PageGatewaySection() {
  return (
    <section
      id="page-guide"
      className="scroll-mt-24 py-14 sm:py-20"
      style={{ background: 'linear-gradient(180deg, #f7f9fd 0%, #ffffff 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeading
            eyebrow="PAGE GUIDE"
            title="필요한 정보는 각 페이지에서 더 또렷하게 보여드립니다"
            description="홈에서는 핵심만 빠르게 보고, 자세한 결과·센터 환경·웹앱·국어 수업은 각각의 페이지에서 더 크게 확인하도록 구조를 정리했습니다."
          />
        </div>

        <StaggerChildren stagger={90} className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {pageDestinations.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`brand-sheen-panel group relative overflow-hidden rounded-[1.7rem] border px-5 py-5 shadow-[0_16px_34px_rgba(20,41,95,0.08)] transition-transform hover:-translate-y-1 sm:px-6 sm:py-6 ${item.cardClass}`}
              >
                <div className="brand-glow-drift absolute -right-10 top-4 h-24 w-24 rounded-full bg-[#FFB878]/12 blur-3xl" />
                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black tracking-[0.2em] text-[#FF7A16]">{item.eyebrow}</p>
                      <h3 className="mt-3 break-keep text-[1.18rem] font-black leading-[1.25] text-[#14295F]">
                        {item.title}
                      </h3>
                    </div>
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-[0_12px_24px_rgba(20,41,95,0.10)] ${item.iconClass}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>

                  <p className="mt-4 break-keep text-[13.5px] font-semibold leading-[1.82] text-[#49607B]">
                    {item.description}
                  </p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {item.highlights.map((highlight) => (
                      <span
                        key={highlight}
                        className="rounded-full border border-[#14295F]/10 bg-white/88 px-3 py-1.5 text-[11px] font-black text-[#14295F]/78"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 inline-flex items-center gap-2 text-[13px] font-black text-[#14295F]">
                    {item.cta}
                    <ArrowRight className="brand-cta-arrow h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </StaggerChildren>
      </div>
    </section>
  );
}
