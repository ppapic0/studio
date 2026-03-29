import Link from 'next/link';
import { ArrowRight, ChevronLeft, Trophy } from 'lucide-react';

import { HomeGrowthProofSection } from '@/components/marketing/home-growth-proof-section';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { MarketingPageTracker } from '@/components/marketing/marketing-page-tracker';
import { ResultsSection } from '@/components/marketing/results-section';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { SectionHeading } from '@/components/marketing/section-heading';
import { marketingContent } from '@/lib/marketing-content';

export default function ResultsPage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-[linear-gradient(180deg,#F8F5EF_0%,#FFFFFF_18%,#F7F9FD_100%)] text-[#14295F]">
      <MarketingPageTracker pageType="results" placement="results_page" />
      <MarketingHeader brand={marketingContent.brand} nav={marketingContent.nav} />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[#14295F]/12 bg-white px-4 py-2 text-[13px] font-black text-[#14295F] shadow-[0_10px_24px_rgba(20,41,95,0.06)]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            홈으로 돌아가기
          </Link>
          <Link
            href="/#consult"
            className="inline-flex items-center gap-2 rounded-full bg-[#FF7A16] px-4 py-2 text-[13px] font-black text-white shadow-[0_14px_24px_rgba(255,122,22,0.26)] transition-transform hover:-translate-y-0.5"
          >
            상담 문의
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <ScrollReveal className="mt-7">
          <section className="relative overflow-hidden rounded-[2.6rem] border border-[#14295F]/10 bg-white px-6 py-7 shadow-[0_28px_64px_rgba(20,41,95,0.10)] sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(20,41,95,0.05),transparent_24%),radial-gradient(circle_at_92%_10%,rgba(255,122,22,0.10),transparent_24%)]" />
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.8fr)] lg:gap-8">
              <div>
                <SectionHeading
                  eyebrow="RESULTS DETAIL"
                  title="합격 결과와 실제 성적표를 한 흐름으로 보여드립니다"
                />
              </div>

              <div className="rounded-[1.55rem] border border-[#14295F]/10 bg-[#F9FBFF] px-5 py-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#14295F] text-white">
                    <Trophy className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-black tracking-[0.16em] text-[#14295F]/55">FINAL OUTCOME</p>
                    <p className="mt-1 break-keep text-[1rem] font-black leading-[1.38] text-[#14295F]">
                      2026 주요 대학 합격 결과를 먼저 확인합니다.
                    </p>
                  </div>
                </div>
                </div>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal className="mt-8">
          <ResultsSection outcomes={marketingContent.outcomes} successStory={marketingContent.successStory} />
        </ScrollReveal>

        <ScrollReveal className="mt-8">
          <HomeGrowthProofSection />
        </ScrollReveal>

        <ScrollReveal className="mt-8">
          <section className="relative overflow-hidden rounded-[2.1rem] border border-[#14295F]/10 bg-white px-6 py-7 text-center shadow-[0_20px_46px_rgba(20,41,95,0.08)] sm:px-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,122,22,0.10),transparent_32%)]" />
            <div className="relative mx-auto max-w-3xl">
              <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">NEXT STEP</p>
              <h2 className="mt-3 break-keep text-[clamp(1.55rem,3vw,2.2rem)] font-black leading-[1.2] text-[#14295F]">
                결과가 만들어진 운영 구조도 이어서 확인해보세요
              </h2>
              <p className="mt-3 break-keep text-[14px] font-semibold leading-[1.8] text-[#425A75]">
                센터 소개, 트랙 시스템, 국어 수업 구조를 함께 보면 왜 결과가 이어졌는지 더 선명하게 읽을 수 있습니다.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link href="/center" className="premium-cta premium-cta-muted h-11 px-6 text-sm">
                  센터 소개 보기
                </Link>
                <Link href="/#consult" className="premium-cta premium-cta-primary h-11 px-6 text-sm">
                  상담 문의하기
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
