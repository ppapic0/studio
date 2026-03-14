import Image from 'next/image';
import { ArrowRight, CheckCircle2, GraduationCap, Smartphone } from 'lucide-react';

import type { MarketingContent } from '@/lib/marketing-content';

type HeroSectionProps = {
  brand: MarketingContent['brand'];
  heroStats: MarketingContent['heroStats'];
};

const heroKeywords = ['ROUTINE', 'DATA', 'RESULT'];
const heroSignals = ['관리형 스터디센터 중심', '수능 국어 수업 별도 선택', '재학생 · N수생 등록 가능'];

export function HeroSection({ brand, heroStats }: HeroSectionProps) {
  const [resultStat, entryStat, dataStat] = heroStats;

  return (
    <section className="relative overflow-hidden bg-[#0b1631] pb-16 pt-10 sm:pb-20 sm:pt-14">
      {/* Mesh gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_10%_0%,rgba(30,72,180,0.55),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_50%_at_90%_5%,rgba(255,122,22,0.18),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_100%,rgba(14,30,80,0.6),transparent)]" />
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Decorative large background text */}
      <div
        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 select-none overflow-hidden"
        aria-hidden="true"
      >
        <span className="block text-[clamp(7rem,18vw,20rem)] font-black leading-none tracking-[-0.06em] text-white opacity-[0.025]">
          TRACK
        </span>
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:px-8">
        {/* LEFT: Headline + signals */}
        <div className="space-y-7">
          <div>
            <span className="eyebrow-badge-light">TRACK MANAGED STUDY CENTER</span>
          </div>

          <div className="space-y-4">
            <h1 className="font-brand max-w-4xl break-keep text-[clamp(2.9rem,7.5vw,5.8rem)] leading-[0.92] text-white">
              관리형
              <br />
              스터디센터가
              <br />
              <span className="text-[#FF7A16]">중심입니다</span>
            </h1>
            <p className="max-w-xl break-keep text-[15px] font-medium leading-[1.86] text-blue-100/75 sm:text-[16px]">
              {brand.heroDescription}
            </p>
          </div>

          {/* Keyword + Signal cards */}
          <div className="grid gap-3 sm:grid-cols-[0.95fr_1.05fr]">
            <div className="marketing-card-dark rounded-[1.6rem] p-4 sm:p-5">
              <p className="text-[10px] font-black tracking-[0.24em] text-[#FF9848]">KEYWORD</p>
              <div className="mt-4 space-y-2.5">
                {heroKeywords.map((keyword) => (
                  <div
                    key={keyword}
                    className="rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-[1.05rem] font-black tracking-[-0.03em] text-white sm:text-[1.18rem]"
                    style={{ background: 'rgba(255,255,255,0.07)' }}
                  >
                    {keyword}
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-[1.6rem] border p-4 sm:p-5"
              style={{
                borderColor: 'rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <p className="text-[10px] font-black tracking-[0.24em] text-white/40">TRACK SIGNAL</p>
              <div className="mt-4 space-y-2.5">
                {heroSignals.map((signal) => (
                  <div
                    key={signal}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/6 px-4 py-3"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FF7A16]" />
                    <p className="break-keep text-sm font-semibold leading-[1.6] text-white/90">{signal}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-3">
            <a href="/go/login?placement=hero_login" className="premium-cta premium-cta-ghost h-12 px-6 text-sm">
              웹앱 로그인
            </a>
            <a href="/go/experience?placement=hero_experience_primary" className="premium-cta premium-cta-primary h-12 px-6 text-sm">
              웹앱 체험하기
            </a>
            <a href="#consult" className="premium-cta premium-cta-ghost h-12 px-6 text-sm">
              방문 상담 문의
            </a>
          </div>
        </div>

        {/* RIGHT: Stats + Demo cards */}
        <div className="grid gap-4">
          {/* RESULT stat — big card */}
          <article
            className="relative overflow-hidden rounded-[1.6rem] border p-5 sm:p-6"
            style={{
              borderColor: 'rgba(255,255,255,0.12)',
              background: 'linear-gradient(145deg, rgba(30,72,165,0.55) 0%, rgba(18,42,110,0.45) 100%)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 1px 0 0 rgba(255,255,255,0.12) inset, 0 24px 48px -8px rgba(0,0,0,0.32)',
            }}
          >
            <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-bl-full bg-[#FF7A16]/15" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="eyebrow-badge-light">RESULT</span>
                <p className="stat-number mt-3 max-w-[16rem] break-keep text-[2.1rem] text-white sm:text-[2.5rem]">
                  {resultStat?.value}
                </p>
                <p className="mt-3 text-sm font-semibold text-blue-100/70">{resultStat?.detail}</p>
              </div>
              <div
                className="rounded-[1.4rem] border p-3"
                style={{ borderColor: 'rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.10)' }}
              >
                <Image src={brand.logoMark} alt={`${brand.name} 로고`} width={56} height={56} className="h-14 w-14 object-contain" />
              </div>
            </div>
          </article>

          {/* Two stat cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <article
              className="relative overflow-hidden rounded-[1.6rem] border p-5"
              style={{
                borderColor: 'rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <p className="text-[10px] font-black tracking-[0.22em] text-white/42">{entryStat?.label}</p>
              <p className="stat-number mt-3 break-keep text-[1.7rem] text-white">
                {entryStat?.value}
              </p>
              <p className="mt-2 text-sm font-medium leading-[1.72] text-blue-100/65">{entryStat?.detail}</p>
            </article>

            <article
              className="relative overflow-hidden rounded-[1.6rem] border p-5"
              style={{
                borderColor: 'rgba(255,122,22,0.28)',
                background: 'linear-gradient(145deg, rgba(255,122,22,0.15), rgba(255,80,0,0.08))',
                backdropFilter: 'blur(8px)',
              }}
            >
              <p className="text-[10px] font-black tracking-[0.22em] text-[#FFB273]/70">{dataStat?.label}</p>
              <p className="stat-number mt-3 break-keep text-[1.7rem] text-white">
                {dataStat?.value}
              </p>
              <p className="mt-2 text-sm font-medium leading-[1.72] text-blue-100/65">{dataStat?.detail}</p>
            </article>
          </div>

          {/* Demo entry cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <a
              href="/go/experience?placement=hero_student_demo&mode=student&view=mobile"
              className="group relative overflow-hidden rounded-[1.6rem] border p-5 transition-all duration-200 hover:-translate-y-0.5"
              style={{
                borderColor: 'rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl text-white"
                  style={{
                    background: 'linear-gradient(145deg, #1e4898, #14295f)',
                    boxShadow: '0 8px 20px rgba(20,41,95,0.40)',
                  }}
                >
                  <Smartphone className="h-5 w-5" />
                </div>
                <span
                  className="rounded-full border px-3 py-1 text-[10px] font-black tracking-[0.16em] text-white/70"
                  style={{ borderColor: 'rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.08)' }}
                >
                  STUDENT DEMO
                </span>
              </div>
              <p className="mt-5 text-[1.35rem] font-black tracking-[-0.03em] text-white">학생 모드 체험</p>
              <p className="mt-2 break-keep text-sm font-medium leading-[1.72] text-blue-100/65">성장 · 기록 · 계획 화면을 앱처럼 바로 확인</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#FF9848]">
                체험 시작
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </a>

            <a
              href="/go/experience?placement=hero_parent_demo&mode=parent"
              className="group relative overflow-hidden rounded-[1.6rem] border p-5 transition-all duration-200 hover:-translate-y-0.5"
              style={{
                borderColor: 'rgba(255,122,22,0.24)',
                background: 'linear-gradient(145deg, rgba(255,122,22,0.13), rgba(255,60,0,0.07))',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl text-white"
                  style={{
                    background: 'linear-gradient(145deg, #ff9d4e, #e86800)',
                    boxShadow: '0 8px 20px rgba(255,122,22,0.38)',
                  }}
                >
                  <GraduationCap className="h-5 w-5" />
                </div>
                <span
                  className="rounded-full border px-3 py-1 text-[10px] font-black tracking-[0.16em] text-[#FFB273]/80"
                  style={{ borderColor: 'rgba(255,165,80,0.30)', background: 'rgba(255,122,22,0.10)' }}
                >
                  PARENT DEMO
                </span>
              </div>
              <p className="mt-5 text-[1.35rem] font-black tracking-[-0.03em] text-white">학부모 모드 체험</p>
              <p className="mt-2 break-keep text-sm font-medium leading-[1.72] text-blue-100/65">알림 · 캘린더 · 수납 흐름을 앱모드 전용으로 확인</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#FFB273]">
                체험 시작
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
