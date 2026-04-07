'use client';

import Link from 'next/link';
import { ArrowRight, ChevronLeft, ShieldCheck, Sparkles, Trophy } from 'lucide-react';

import { HomeGrowthProofSection } from '@/components/marketing/home-growth-proof-section';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { MarketingPageTracker } from '@/components/marketing/marketing-page-tracker';
import { ResultsSection } from '@/components/marketing/results-section';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { marketingContent } from '@/lib/marketing-content';

const universityResults = marketingContent.outcomes.filter((item) => item.label !== '성장 사례');
const successStory = marketingContent.successStory;

const heroMetrics = [
  {
    label: '주요 대학 합격',
    value: `${universityResults.reduce((sum, item) => sum + Number(String(item.value).replace(/[^\d]/g, '') || 0), 0)}명`,
    detail: '2026학년도 기준',
  },
  {
    label: '성장 사례',
    value: '백분위 99',
    detail: '3등급에서 고려대 합격',
  },
  {
    label: '실제 성적표',
    value: '3장',
    detail: '개인정보 마스킹 완료',
  },
] as const;

const heroReasons = ['합격 결과', '성장 사례', '실제 성적표'] as const;

export default function ResultsPage() {
  return (
    <main className="min-h-screen overflow-x-clip bg-[linear-gradient(180deg,#F7F2EA_0%,#FFFFFF_16%,#F5F8FD_100%)] text-[#14295F]">
      <MarketingPageTracker pageType="results" placement="results_page" />
      <MarketingHeader brand={marketingContent.brand} nav={marketingContent.nav} />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[#14295F]/12 bg-white px-4 py-2 text-[13px] font-black text-[#14295F] shadow-[0_10px_24px_rgba(20,41,95,0.06)] transition-transform duration-200 hover:-translate-y-0.5"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            홈으로 돌아가기
          </Link>
          <Link
            href="/#consult"
            className="inline-flex items-center gap-2 rounded-full bg-[#FF7A16] px-4 py-2 text-[13px] font-black text-white shadow-[0_14px_24px_rgba(255,122,22,0.26)] transition-transform duration-200 hover:-translate-y-0.5"
          >
            상담 문의
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <ScrollReveal className="mt-5 sm:mt-7">
          <section className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#0E214A_0%,#14295F_54%,#1B4E9F_100%)] px-5 py-6 text-white shadow-[0_28px_68px_rgba(20,41,95,0.22)] sm:rounded-[2.7rem] sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(255,255,255,0.14),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(255,122,22,0.28),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
            <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-8">
              <div className="max-w-2xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[10px] font-black tracking-[0.22em] text-[#FFB273]">
                  <Sparkles className="h-3.5 w-3.5" />
                  RESULTS DETAIL
                </p>
                <h1 className="mt-4 break-keep text-[clamp(2rem,8vw,4.1rem)] font-black leading-[0.98] tracking-[-0.05em] text-white">
                  합격 결과와
                  <br />
                  실제 성적표를
                  <br />
                  한 화면에서 봅니다
                </h1>
                <p className="mt-4 max-w-[34rem] break-keep text-[14px] font-semibold leading-[1.8] text-white/76 sm:text-[15px]">
                  트랙에서 나온 주요 대학 합격 결과, 상승 사례, 실제 성적표 흐름을 모바일에서도 바로 읽히도록 정리했습니다.
                </p>

                <div className="mt-5 flex flex-wrap gap-2.5">
                  {heroReasons.map((reason) => (
                    <span
                      key={reason}
                      className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[11px] font-black text-white/88 backdrop-blur"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {heroMetrics.map((item, index) => (
                  <article
                    key={item.label}
                    className="rounded-[1.4rem] border border-white/10 bg-white/8 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black tracking-[0.18em] text-white/50">
                          METRIC {String(index + 1).padStart(2, '0')}
                        </p>
                        <h2 className="mt-2 break-keep text-sm font-black text-white sm:text-[15px]">{item.label}</h2>
                        <p className="mt-1 text-[11px] font-semibold text-white/62">{item.detail}</p>
                      </div>
                      <p className="shrink-0 text-[1.45rem] font-black leading-none tracking-[-0.04em] text-[#FFB273] sm:text-[1.7rem]">
                        {item.value}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="relative mt-6 border-t border-white/10 pt-5">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-[#FFB273]">
                  <Trophy className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-[10px] font-black tracking-[0.16em] text-white/50">SUCCESS STORY</p>
                  <p className="mt-1 break-keep text-[15px] font-black text-white">{successStory.summary}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                {successStory.timeline.map((item) => (
                  <article
                    key={item.label}
                    className="rounded-[1.2rem] border border-white/10 bg-white/7 px-4 py-4 backdrop-blur"
                  >
                    <p className="text-[10px] font-black tracking-[0.16em] text-[#FFB273]">{item.label}</p>
                    <p className="mt-2 text-[1.1rem] font-black leading-none text-white">{item.value}</p>
                    <p className="mt-1.5 text-[12px] font-semibold leading-[1.55] text-white/66">{item.detail}</p>
                  </article>
                ))}
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
          <section className="relative overflow-hidden rounded-[2rem] border border-[#14295F]/10 bg-white px-5 py-6 text-center shadow-[0_20px_46px_rgba(20,41,95,0.08)] sm:rounded-[2.2rem] sm:px-8 sm:py-7">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,122,22,0.10),transparent_32%)]" />
            <div className="relative mx-auto max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#FF7A16]/14 bg-[#FFF5EC] px-3 py-1.5 text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">
                <ShieldCheck className="h-3.5 w-3.5" />
                NEXT STEP
              </p>
              <h2 className="mt-4 break-keep text-[clamp(1.55rem,3vw,2.2rem)] font-black leading-[1.16] text-[#14295F]">
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
