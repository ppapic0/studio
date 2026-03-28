import Link from 'next/link';
import { ArrowRight, BarChart3, GraduationCap, ShieldCheck, Trophy } from 'lucide-react';

import { SectionHeading } from './section-heading';
import { StaggerChildren } from './stagger-children';

const pageDestinations = [
  {
    eyebrow: 'RESULTS',
    title: '합격 실적',
    href: '/results',
    meta: '실제 성적표 포함',
    icon: Trophy,
    cardClass:
      'border-[#14295F]/10 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)]',
    iconClass: 'bg-[#14295F] text-white',
  },
  {
    eyebrow: 'CENTER',
    title: '센터 환경',
    href: '/center',
    meta: '보안 운영 · 센터 사진',
    icon: ShieldCheck,
    cardClass:
      'border-[#FF7A16]/14 bg-[linear-gradient(180deg,#FFF9F2_0%,#FFFFFF_100%)]',
    iconClass: 'bg-[#FFF1E4] text-[#FF7A16]',
  },
  {
    eyebrow: 'WEB APP',
    title: '웹앱 시스템',
    href: '/experience',
    meta: '학생 · 학부모 · 데이터',
    icon: BarChart3,
    cardClass:
      'border-[#14295F]/10 bg-[linear-gradient(180deg,#FFFFFF_0%,#F6F9FF_100%)]',
    iconClass: 'bg-[#EEF3FF] text-[#14295F]',
  },
  {
    eyebrow: 'KOREAN CLASS',
    title: '국어 수업',
    href: '/class',
    meta: '원장 직강 · 실전 모의',
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
            description="홈에서는 핵심 카드만 빠르게 보고, 자세한 내용은 각 페이지에서 더 크게 확인하도록 정리했습니다."
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
                      <h3 className="mt-3 break-keep text-[1.22rem] font-black leading-[1.22] text-[#14295F]">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-[11px] font-black tracking-[0.08em] text-[#14295F]/54">
                        {item.meta}
                      </p>
                    </div>
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-[0_12px_24px_rgba(20,41,95,0.10)] ${item.iconClass}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>

                  <div className="mt-8 inline-flex items-center gap-2 text-[13px] font-black text-[#14295F]">
                    자세히 보기
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
