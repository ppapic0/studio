import Link from 'next/link';
import {
  ArrowRight,
  Sparkles,
} from 'lucide-react';

import { CenterOverviewStack } from '@/components/marketing/center-overview-stack';
import { FeedbackManagementSection } from '@/components/marketing/feedback-management-section';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { MarketingPageTracker } from '@/components/marketing/marketing-page-tracker';
import { MockExamProgramSection } from '@/components/marketing/mock-exam-program-section';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { marketingContent } from '@/lib/marketing-content';

const motivationCards = [
  {
    title: '포인트 반영',
    description: '공부시간, 계획 완수, 실행 흐름이 누적 포인트로 반영돼 성취가 바로 보입니다.',
  },
  {
    title: '상벌점 운영',
    description: '좋은 루틴은 보상으로, 흐트러진 루틴은 상벌점으로 관리해 기준을 분명하게 잡습니다.',
  },
  {
    title: '학생 동기 유도',
    description: '학생이 스스로 동기와 흥미를 유지할 수 있도록 앱 안에서 꾸준히 자극을 줍니다.',
  },
] as const;

type MediaPlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  mode?: 'warm' | 'cool';
};

function MediaPlaceholder({ eyebrow, title, description, mode = 'cool' }: MediaPlaceholderProps) {
  const isWarm = mode === 'warm';

  return (
    <div
      className={`relative overflow-hidden rounded-[1.9rem] border p-4 shadow-[0_20px_44px_rgba(20,41,95,0.08)] sm:p-5 ${
        isWarm ? 'border-[#FFD9BF] bg-[linear-gradient(180deg,#FFF8F0_0%,#FFF3E7_100%)]' : 'border-[#D9E7FF] bg-[linear-gradient(180deg,#F9FBFF_0%,#EEF5FF_100%)]'
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-0 ${
          isWarm
            ? 'bg-[radial-gradient(circle_at_75%_18%,rgba(255,122,22,0.12),transparent_28%)]'
            : 'bg-[radial-gradient(circle_at_70%_18%,rgba(140,183,255,0.14),transparent_30%)]'
        }`}
      />
      <div className="relative">
        <p className={`text-[10px] font-black tracking-[0.18em] ${isWarm ? 'text-[#FF7A16]' : 'text-[#14295F]/55'}`}>{eyebrow}</p>
        <div className="mt-4 flex min-h-[270px] items-center justify-center rounded-[1.6rem] border border-dashed border-[#14295F]/12 bg-white/82 px-6 py-10 text-center sm:min-h-[320px]">
          <div className="max-w-[220px]">
            <div className="mx-auto h-16 w-16 rounded-[1.5rem] border border-[#14295F]/10 bg-[linear-gradient(180deg,#FFFFFF_0%,#F6F9FF_100%)] shadow-[0_14px_30px_rgba(20,41,95,0.08)]" />
            <p className={`mt-6 text-[11px] font-black tracking-[0.22em] ${isWarm ? 'text-[#FF7A16]' : 'text-[#14295F]/42'}`}>REAL CAPTURE READY</p>
            <p className="mt-3 break-keep text-[1.15rem] font-black leading-[1.35] text-[#14295F]">{title}</p>
            <p className="mt-3 break-keep text-[13px] font-semibold leading-[1.75] text-[#506680]">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CenterPage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-[linear-gradient(180deg,#F7F9FD_0%,#FFFFFF_18%,#F8FAFE_100%)] text-[#14295F]">
      <MarketingPageTracker pageType="center" placement="center_page" />
      <MarketingHeader brand={marketingContent.brand} nav={marketingContent.nav} />

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Link
            href="/#consult"
            className="inline-flex items-center gap-2 rounded-full bg-[#FF7A16] px-4 py-2 text-[13px] font-black text-white shadow-[0_14px_24px_rgba(255,122,22,0.26)] transition-transform hover:-translate-y-0.5"
          >
            상담 문의
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <CenterOverviewStack className="mt-7" />

      <div className="mx-auto mt-10 w-full max-w-7xl space-y-8 px-4 sm:space-y-10 sm:px-6 lg:px-8">
        <ScrollReveal>
          <FeedbackManagementSection />
        </ScrollReveal>

        <ScrollReveal>
          <MockExamProgramSection mockExamProgram={marketingContent.mockExamProgram} />
        </ScrollReveal>

        <ScrollReveal>
            <section className="overflow-hidden rounded-[2.3rem] border border-[#14295F]/10 bg-white shadow-[0_22px_52px_rgba(20,41,95,0.08)]">
              <div className="grid gap-0 lg:grid-cols-[1.02fr_0.98fr]">
                <div className="order-2 border-t border-[#14295F]/8 bg-[linear-gradient(180deg,#F8FBFF_0%,#FFFFFF_100%)] px-6 py-7 sm:px-8 sm:py-8 lg:order-1 lg:border-r lg:border-t-0">
                  <MediaPlaceholder
                    eyebrow="POINT · REWARD SYSTEM"
                    title="포인트 · 상벌점 앱 화면 예정"
                    description="공부시간, 계획 완수, 포인트와 상벌점 흐름이 보이는 실제 앱 화면을 여기에 반영합니다."
                  />
                </div>

                <div className="order-1 px-6 py-7 sm:px-8 sm:py-8 lg:order-2">
                  <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">SECTION 04</p>
                  <h2 className="mt-4 break-keep text-[clamp(1.55rem,3.1vw,2.25rem)] font-black leading-[1.12] text-[#14295F]">
                    학생별 포인트와 상벌점 제도로 학습 동기와 흥미를 끌어올립니다
                  </h2>
                  <p className="mt-5 break-keep text-[15px] font-semibold leading-[1.86] text-[#425A75]">
                    공부시간, 계획 완수 등 구체적인 실행을 포인트로 반영하고 상벌점 제도로 기준을 세워 학생이 스스로 동기와 흥미를 유지할 수 있도록 돕습니다. 학습 동선을 단단하게 만드는 장치까지 함께 설계합니다.
                  </p>

                  <div className="mt-6 grid gap-3">
                    {motivationCards.map((card) => (
                      <article key={card.title} className="rounded-[1.25rem] border border-[#14295F]/8 bg-[#F9FBFF] px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-[#14295F] text-white">
                            <Sparkles className="h-4 w-4" />
                          </span>
                          <h3 className="break-keep text-[0.98rem] font-black leading-[1.34] text-[#14295F]">{card.title}</h3>
                        </div>
                        <p className="mt-3 break-keep text-[13px] font-semibold leading-[1.72] text-[#53687F]">{card.description}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </section>
        </ScrollReveal>

        <ScrollReveal>
            <section className="relative overflow-hidden rounded-[2.1rem] border border-[#14295F]/10 bg-white px-6 py-7 text-center shadow-[0_20px_46px_rgba(20,41,95,0.08)] sm:px-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,122,22,0.10),transparent_32%)]" />
              <div className="relative mx-auto max-w-3xl">
                <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">NEXT STEP</p>
                <h2 className="mt-3 break-keep text-[clamp(1.55rem,3vw,2.2rem)] font-black leading-[1.2] text-[#14295F]">
                  트랙 시스템과 국어 수업 구조도 이어서 확인해보세요
                </h2>
                <p className="mt-3 break-keep text-[14px] font-semibold leading-[1.8] text-[#425A75]">
                  센터 소개를 먼저 봤다면, 트랙 시스템과 국어 수업 페이지까지 이어서 보면 실제 운영 구조가 더 또렷하게 읽힙니다.
                </p>
                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link href="/experience" className="premium-cta premium-cta-muted h-11 px-6 text-sm">
                    트랙 시스템 보기
                  </Link>
                  <Link href="/class" className="premium-cta premium-cta-primary h-11 px-6 text-sm">
                    국어 수업 보기
                  </Link>
                </div>
              </div>
            </section>
        </ScrollReveal>
      </div>

      <MarketingFooter brand={marketingContent.brand} footer={marketingContent.footer} />
    </main>
  );
}
