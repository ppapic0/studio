import Link from 'next/link';
import { ArrowRight, BarChart3, GraduationCap, ShieldCheck, Trophy } from 'lucide-react';

import { SectionHeading } from './section-heading';
import { StaggerChildren } from './stagger-children';

const pageDestinations = [
  {
    eyebrow: 'CENTER',
    title: '센터 소개',
    href: '/center',
    meta: '집중 환경 · 앱 연동 · 모의 운영',
    highlights: ['집중 환경', '앱 연동', '모의 운영'],
    icon: ShieldCheck,
    cardClass: 'border-[#FFD9BF] bg-[linear-gradient(180deg,#FFF9F2_0%,#FFF3E8_100%)]',
    iconClass: 'bg-[#FFF1E4] text-[#FF7A16]',
    chipClass: 'border-[#FF7A16]/12 bg-white/90 text-[#B55200]',
    footerClass: 'border-[#FF7A16]/12 bg-white/92 text-[#B55200]',
  },
  {
    eyebrow: 'RESULTS',
    title: '합격 실적',
    href: '/results',
    meta: '실제 성적표 포함',
    highlights: ['합격 결과', '상승 사례', '실제 성적표'],
    icon: Trophy,
    cardClass: 'border-[#D8E5FF] bg-[linear-gradient(180deg,#F8FBFF_0%,#EEF4FF_100%)]',
    iconClass: 'bg-[#14295F] text-white',
    chipClass: 'border-[#14295F]/10 bg-white/90 text-[#14295F]',
    footerClass: 'border-[#14295F]/10 bg-white/90 text-[#14295F]',
  },
  {
    eyebrow: 'WEB APP',
    title: '트랙 시스템',
    href: '/experience',
    meta: '학생 · 학부모 · 데이터',
    highlights: ['학생 모드', '학부모 모드', '데이터'],
    icon: BarChart3,
    cardClass: 'border-[#D9E8FF] bg-[linear-gradient(180deg,#F8FCFF_0%,#EEF6FF_100%)]',
    iconClass: 'bg-[#EEF3FF] text-[#14295F]',
    chipClass: 'border-[#14295F]/10 bg-white/90 text-[#14295F]',
    footerClass: 'border-[#14295F]/10 bg-white/92 text-[#14295F]',
  },
  {
    eyebrow: 'KOREAN CLASS',
    title: '국어 수업',
    href: '/class',
    meta: '실전 모의 · 수업 자료',
    highlights: ['실전 모의', '수업 자료', '풀이 기준'],
    icon: GraduationCap,
    cardClass: 'border-[#E3DBFF] bg-[linear-gradient(180deg,#FBFAFF_0%,#F2EEFF_100%)]',
    iconClass: 'bg-[#14295F] text-white',
    chipClass: 'border-[#6050A8]/10 bg-white/90 text-[#4B3B97]',
    footerClass: 'border-[#6050A8]/12 bg-white/92 text-[#4B3B97]',
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

        <StaggerChildren stagger={90} className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {pageDestinations.map((item, index) => {
            const Icon = item.icon;
            const pageNumber = String(index + 1).padStart(2, '0');

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group block h-full rounded-[2rem] border px-5 py-5 shadow-[0_16px_34px_rgba(20,41,95,0.08)] transition-transform duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_44px_rgba(20,41,95,0.12)] sm:px-6 sm:py-6 ${item.cardClass}`}
              >
                <div className="flex min-h-[250px] flex-col rounded-[1.5rem] border border-white/70 bg-white/82 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-[1px] sm:min-h-[264px] sm:p-5">
                  <div className="space-y-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2.5">
                          <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">{item.eyebrow}</p>
                          <span className="rounded-full border border-[#14295F]/10 bg-white px-2.5 py-1 text-[10px] font-black tracking-[0.16em] text-[#14295F]/55">
                            PAGE {pageNumber}
                          </span>
                        </div>
                        <h3 className="break-keep text-[1.32rem] font-black leading-[1.12] text-[#14295F] sm:text-[1.45rem]">
                          {item.title}
                        </h3>
                      </div>
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-[0_12px_24px_rgba(20,41,95,0.10)] ${item.iconClass}`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-bold leading-[1.55] text-[#14295F]/82">
                        {item.meta}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {item.highlights.map((highlight) => (
                          <span
                            key={highlight}
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-black tracking-[0.04em] ${item.chipClass}`}
                          >
                            {highlight}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-5">
                    <div className={`inline-flex w-full items-center justify-between gap-3 rounded-[1.1rem] border px-4 py-3 text-[13px] font-black ${item.footerClass}`}>
                      <span>자세히 보기</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1.5" />
                    </div>
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
