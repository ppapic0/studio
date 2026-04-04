import Link from 'next/link';
import {
  ArrowRight,
  BookOpenCheck,
  CircleGauge,
  MessageSquareText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trophy,
  Wifi,
} from 'lucide-react';

import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingHeader } from '@/components/marketing/marketing-header';
import { MarketingPageTracker } from '@/components/marketing/marketing-page-tracker';
import { ScrollReveal } from '@/components/marketing/scroll-reveal';
import { SectionHeading } from '@/components/marketing/section-heading';
import { StaggerChildren } from '@/components/marketing/stagger-children';
import { marketingContent } from '@/lib/marketing-content';

const focusHighlights = [
  '자습 시간에는 학습에 필요한 연결만 남깁니다.',
  '학생이 흔들리기 쉬운 접속은 와이파이에서 먼저 정리합니다.',
  '허용 사이트 기준도 학생 흐름에 맞춰 세밀하게 관리합니다.',
] as const;

const appFlowCards = [
  {
    title: '학습 현황 확인',
    description: '계획, 실행, 공부시간, 누적 흐름이 앱에 남아 지금 상태를 바로 읽을 수 있습니다.',
  },
  {
    title: '피드백 연결',
    description: '학생별로 흔들린 지점을 바로 확인하고 피드백까지 이어 철저하게 관리합니다.',
  },
  {
    title: '학부모 확인',
    description: '학부모도 짧은 확인만으로 학생의 학습 흐름과 현재 상태를 파악할 수 있습니다.',
  },
] as const;

const mockPrograms = [
  {
    title: '더프리미엄 모의고사',
    description: '현재 위치를 확인하고 성적표와 함께 시간 운영, 기본 대응력을 점검합니다.',
  },
  {
    title: '이감',
    description: '실전 국어 흐름 안에서 낯선 지문 대응력과 시간 배분을 확인합니다.',
  },
  {
    title: '한수',
    description: '평가원 감각이 흐트러지지 않도록 국어 실전 루틴을 유지하며 점검합니다.',
  },
  {
    title: '시대인재 서바이벌 프로',
    description: '상위권 실전 난이도까지 대비해 시험장에서 흔들리지 않는 대응력을 만듭니다.',
  },
] as const;

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

        <ScrollReveal className="mt-7">
          <section className="relative overflow-hidden rounded-[2.7rem] border border-[#14295F]/10 bg-white px-6 py-7 shadow-[0_28px_64px_rgba(20,41,95,0.10)] sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(20,41,95,0.06),transparent_24%),radial-gradient(circle_at_92%_8%,rgba(255,122,22,0.10),transparent_24%)]" />
            <div className="relative grid gap-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-end">
              <div>
                <SectionHeading
                  eyebrow="CENTER INTRO"
                  title="트랙의 센터 소개"
                />
                <p className="mt-4 max-w-2xl break-keep text-[15px] font-bold leading-[1.82] text-[#2c3f58] sm:text-[15.5px]">
                  공간만 제공하는 것이 아니라
                  <br />
                  집중력 최적화, 앱 연동 관리, 실전모의고사 및
                  <br />
                  포인트, 벌점제도로 학습동기를 높입니다.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Wifi, title: '학습 집중 환경/휴대폰 수거 관리', detail: '허용 사이트 중심 와이파이 운영' },
                  { icon: Smartphone, title: '앱 연동 관리', detail: '현황과 피드백을 바로 연결' },
                  { icon: BookOpenCheck, title: '실전 모의 운영', detail: '더프리미엄 · 이감 · 한수 · 서바이벌 프로' },
                  { icon: Sparkles, title: '동기 설계', detail: '포인트와 상벌점으로 학습 흥미 유지' },
                ].map(({ icon: Icon, title, detail }) => (
                  <div key={title} className="rounded-[1.45rem] border border-[#14295F]/10 bg-[#F9FBFF] px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#14295F] text-white">
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <div>
                        <p className="text-[10px] font-black tracking-[0.16em] text-[#14295F]/50">CENTER POINT</p>
                        <p className="mt-1 break-keep text-[0.98rem] font-black leading-[1.34] text-[#14295F]">{title}</p>
                      </div>
                    </div>
                    <p className="mt-3 break-keep text-[13px] font-semibold leading-[1.7] text-[#53687F]">{detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </ScrollReveal>

        <div className="mt-10 space-y-8 sm:space-y-10">
          <ScrollReveal>
            <section className="overflow-hidden rounded-[2.3rem] border border-[#14295F]/10 bg-white shadow-[0_22px_52px_rgba(20,41,95,0.08)]">
              <div className="grid gap-0 lg:grid-cols-[0.96fr_1.04fr]">
                <div className="px-6 py-7 sm:px-8 sm:py-8">
                  <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">SECTION 01</p>
                  <h2 className="mt-4 break-keep text-[clamp(1.55rem,3.1vw,2.25rem)] font-black leading-[1.12] text-[#14295F]">
                    트랙 웹앱으로 학습에 필요한 연결만 남기는 집중 환경을 설정합니다
                  </h2>
                  <p className="mt-5 break-keep text-[15px] font-semibold leading-[1.86] text-[#425A75]">
                    자습 시간에는 공부에 필요한 연결만 남기고, 흔들리는 접속은 와이파이에서 먼저 정리합니다. 억지 통제가 아니라 학생이 오래 집중할 수 있는 안정적인 학습 환경을 만드는 방식입니다.
                  </p>

                  <div className="mt-6 space-y-3">
                    {focusHighlights.map((item, index) => (
                      <div key={item} className="flex items-start gap-3 rounded-[1.15rem] border border-[#14295F]/8 bg-[#F8FBFF] px-4 py-3">
                        <span className="mt-[1px] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#14295F] text-[10px] font-black text-white">
                          {index + 1}
                        </span>
                        <p className="break-keep text-[13px] font-semibold leading-[1.7] text-[#53687F]">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#14295F]/8 bg-[linear-gradient(180deg,#F8FBFF_0%,#FFFFFF_100%)] px-6 py-7 sm:px-8 sm:py-8 lg:border-l lg:border-t-0">
                  <MediaPlaceholder
                    eyebrow="WEB APP CONTROL"
                    title="허용 사이트 설정 화면 예정"
                    description="실제 웹앱에서 학습 시간 허용 사이트와 집중 환경 설정이 반영되는 화면을 여기에 연결합니다."
                  />
                </div>
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal>
            <section className="overflow-hidden rounded-[2.3rem] border border-[#14295F]/10 bg-white shadow-[0_22px_52px_rgba(20,41,95,0.08)]">
              <div className="grid gap-0 lg:grid-cols-[1.02fr_0.98fr]">
                <div className="order-2 border-t border-[#14295F]/8 bg-[linear-gradient(180deg,#FFF9F2_0%,#FFFFFF_100%)] px-6 py-7 sm:px-8 sm:py-8 lg:order-1 lg:border-r lg:border-t-0">
                  <MediaPlaceholder
                    eyebrow="APP LINKED MANAGEMENT"
                    title="학습 현황 · 피드백 화면 예정"
                    description="학생별 계획, 실행, 학습 현황과 피드백이 바로 연결되는 앱 화면을 여기에 반영합니다."
                    mode="warm"
                  />
                </div>

                <div className="order-1 px-6 py-7 sm:px-8 sm:py-8 lg:order-2">
                  <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">SECTION 02</p>
                  <h2 className="mt-4 break-keep text-[clamp(1.55rem,3.1vw,2.25rem)] font-black leading-[1.12] text-[#14295F]">
                    트랙 웹앱으로 학습 현황과 피드백까지 체계적으로, 철저히 관리합니다
                  </h2>
                  <p className="mt-5 break-keep text-[15px] font-semibold leading-[1.86] text-[#425A75]">
                    학생의 공부 흐름과 피드백이 따로 놀지 않도록 앱에서 바로 연결합니다. 학생은 무엇을 해야 하는지 분명하게 보고, 학부모는 현재 상태와 변화 방향을 빠르게 파악할 수 있도록 설계합니다.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {appFlowCards.map((card) => (
                      <article key={card.title} className="rounded-[1.3rem] border border-[#14295F]/8 bg-[#F9FBFF] px-4 py-4">
                        <p className="text-[10px] font-black tracking-[0.16em] text-[#FF7A16]">SYSTEM FLOW</p>
                        <h3 className="mt-3 break-keep text-[0.98rem] font-black leading-[1.36] text-[#14295F]">{card.title}</h3>
                        <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.72] text-[#53687F]">{card.description}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal>
            <section className="overflow-hidden rounded-[2.3rem] border border-[#14295F]/10 bg-white shadow-[0_22px_52px_rgba(20,41,95,0.08)]">
              <div className="grid gap-0 lg:grid-cols-[0.98fr_1.02fr]">
                <div className="px-6 py-7 sm:px-8 sm:py-8">
                  <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">SECTION 03</p>
                  <h2 className="mt-4 break-keep text-[clamp(1.55rem,3.1vw,2.25rem)] font-black leading-[1.12] text-[#14295F]">
                    대치동까지 가지 않아도, 트랙에서 실전 모의고사 체계를 바로 경험합니다
                  </h2>
                  <p className="mt-5 break-keep text-[15px] font-semibold leading-[1.86] text-[#425A75]">
                    더프리미엄과 시대인재 서바이벌 프로 모의고사, 국어 이감과 한수까지 연결해 학생별 상태를 점검합니다. 시험을 치는 것에서 끝내지 않고, 결과 입력 후 상담까지 체계적으로 이어 철저하게 관리합니다.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2.5">
                    {['더프리미엄', '이감', '한수', '서바이벌 프로'].map((item) => (
                      <span key={item} className="rounded-full border border-[#FF7A16]/14 bg-[#FFF5EC] px-3 py-1.5 text-[11px] font-black text-[#B55200]">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border-t border-[#14295F]/8 bg-[linear-gradient(180deg,#FFF8F0_0%,#FFFFFF_100%)] px-6 py-7 sm:px-8 sm:py-8 lg:border-l lg:border-t-0">
                  <StaggerChildren className="grid gap-3 sm:grid-cols-2" stagger={80}>
                    {mockPrograms.map((program, index) => (
                      <article key={program.title} className="rounded-[1.35rem] border border-[#FF7A16]/10 bg-white px-4 py-4 shadow-[0_12px_30px_rgba(20,41,95,0.06)]">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">PROGRAM {String(index + 1).padStart(2, '0')}</p>
                          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#14295F] text-white">
                            {index === 0 ? <CircleGauge className="h-4 w-4" /> : index === 1 ? <BookOpenCheck className="h-4 w-4" /> : index === 2 ? <MessageSquareText className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
                          </span>
                        </div>
                        <h3 className="mt-3 break-keep text-[1rem] font-black leading-[1.34] text-[#14295F]">{program.title}</h3>
                        <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.7] text-[#53687F]">{program.description}</p>
                      </article>
                    ))}
                  </StaggerChildren>
                </div>
              </div>
            </section>
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
      </div>

      <MarketingFooter brand={marketingContent.brand} footer={marketingContent.footer} />
    </main>
  );
}
