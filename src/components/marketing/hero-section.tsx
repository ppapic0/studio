import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Building2, CheckCircle2, GraduationCap, Smartphone, Sparkles } from 'lucide-react';

import type { MarketingContent } from '@/lib/marketing-content';

type HeroSectionProps = {
  brand: MarketingContent['brand'];
  heroStats: MarketingContent['heroStats'];
};

export function HeroSection({ brand, heroStats }: HeroSectionProps) {
  const [resultStat, ...otherStats] = heroStats;

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#FFFFFF_0%,#F6F9FF_58%,#FFFFFF_100%)] pb-14 pt-10 sm:pb-20 sm:pt-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_12%,rgba(20,41,95,0.08),transparent_28%),radial-gradient(circle_at_88%_10%,rgba(255,122,22,0.12),transparent_24%),linear-gradient(118deg,transparent_0%,transparent_45%,rgba(20,41,95,0.04)_45%,rgba(20,41,95,0.04)_46%,transparent_46%)]" />

      <div className="relative mx-auto grid w-full max-w-7xl gap-6 px-4 sm:gap-8 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-start lg:gap-10 lg:px-8">
        <div>
          <p className="text-xs font-black tracking-[0.22em] text-[#FF7A16]">TRACK MANAGED STUDY CENTER</p>
          <h1 className="font-brand mt-4 break-keep text-4xl leading-[1.08] text-[#14295F] sm:text-5xl lg:text-[4.1rem]">
            {brand.heroTitle}
          </h1>
          <p className="mt-5 max-w-2xl break-keep text-base font-bold leading-relaxed text-slate-600 sm:text-lg">
            {brand.heroDescription}
          </p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#14295F]/12 bg-[#F6F9FF] px-4 py-2 text-sm font-black text-[#14295F] shadow-sm">
            <CheckCircle2 className="h-4 w-4 text-[#FF7A16]" />
            {brand.slogan}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/go/login?placement=hero_login"
              className="premium-cta premium-cta-primary h-12 px-6 text-sm"
            >
              웹앱 로그인
            </a>
            <a
              href="#study-cafe"
              className="premium-cta premium-cta-secondary h-12 px-6 text-sm"
            >
              관리형 스터디센터 안내
            </a>
            <a
              href="#outcome"
              className="premium-cta premium-cta-muted h-12 px-6 text-sm"
            >
              2026 실적 보기
            </a>
          </div>

          <a
            href="/go/experience?placement=hero_experience"
            className="group premium-surface-button mt-4 flex w-full max-w-xl items-center justify-between gap-4 border-[#FF7A16]/24 bg-[linear-gradient(135deg,#FFF6ED_0%,#FFFFFF_100%)] px-5 py-5 shadow-[0_22px_48px_rgba(255,122,22,0.15)]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF7A16] text-white shadow-[0_10px_20px_rgba(255,122,22,0.26)]">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-black tracking-[0.18em] text-[#FF7A16]">LIVE DEMO</p>
                  <span className="inline-flex rounded-full bg-[#14295F] px-2 py-1 text-[10px] font-black text-white">학생 · 학부모 체험</span>
                </div>
                <p className="mt-1 text-lg font-black tracking-tight text-[#14295F]">웹앱 체험하기</p>
                <p className="mt-1 break-keep text-sm font-bold text-slate-600">학생 모드와 학부모 모드를 실제 앱처럼 바로 체험해보세요.</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 text-sm font-black text-[#14295F]">
              바로 보기
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </div>
          </a>
        </div>

        <div className="space-y-4">
          {resultStat ? (
            <article className="relative overflow-hidden rounded-3xl border border-[#14295F]/18 bg-[linear-gradient(165deg,#13295D,#1B3C88)] p-6 text-white shadow-[0_20px_42px_rgba(20,41,95,0.25)] ring-1 ring-white/10 sm:p-7">
              <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#FF7A16]/20 blur-2xl" />
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 top-0 opacity-40 [background-image:linear-gradient(130deg,transparent_0%,transparent_38%,rgba(255,255,255,0.12)_38%,rgba(255,255,255,0.12)_39%,transparent_39%),radial-gradient(circle_at_78%_22%,rgba(255,122,22,0.35),transparent_28%)]" />
              <div className="relative">
                <p className="text-[11px] font-black tracking-[0.14em] text-[#FFB070]">{resultStat.label}</p>
                <p className="font-brand mt-3 break-keep text-xl leading-snug sm:text-2xl">{resultStat.value}</p>
                {resultStat.detail ? <p className="mt-2 text-sm font-bold text-white/80">{resultStat.detail}</p> : null}

                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-black">
                    <Building2 className="h-3.5 w-3.5 text-[#FFB070]" />
                    관리형 스터디센터 중심 운영
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-black">
                    <GraduationCap className="h-3.5 w-3.5 text-[#FFB070]" />
                    수능 국어 수업 별도 선택
                  </span>
                </div>
              </div>
            </article>
          ) : null}

          <article className="marketing-card relative overflow-hidden rounded-3xl p-5">
            <div className="absolute inset-0 opacity-80 [background-image:radial-gradient(circle_at_24%_28%,rgba(20,41,95,0.08),transparent_22%),radial-gradient(circle_at_76%_72%,rgba(255,122,22,0.14),transparent_20%)]" />
            <div className="relative grid gap-3 sm:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-2xl bg-[linear-gradient(165deg,#F7F9FF,#ECF2FF)] p-4">
                <p className="text-[11px] font-black tracking-[0.16em] text-[#FF7A16]">TRACK FLOW</p>
                <div className="mt-4 space-y-2">
                  <div className="rounded-xl bg-white px-3 py-2 text-sm font-black text-[#14295F]">입실</div>
                  <div className="rounded-xl bg-white px-3 py-2 text-sm font-black text-[#14295F]">계획</div>
                  <div className="rounded-xl bg-white px-3 py-2 text-sm font-black text-[#14295F]">실행</div>
                  <div className="rounded-xl bg-white px-3 py-2 text-sm font-black text-[#14295F]">피드백</div>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-[#14295F]/10 bg-white/90 p-4">
                <div className="flex items-center gap-3">
                  <Image src={brand.logoMark} alt={`${brand.name} 로고`} width={40} height={40} className="h-10 w-10 object-contain" />
                  <div>
                    <p className="text-sm font-black text-[#14295F]">{brand.name}</p>
                    <p className="text-xs font-bold text-slate-500">과정과 구조가 먼저 보이는 홍보 메인</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2">
                  <div className="rounded-xl bg-[#F8FAFF] px-3 py-2 text-sm font-black text-[#14295F]">관리형 스터디센터 중심 운영</div>
                  <div className="rounded-xl bg-[#FFF4EB] px-3 py-2 text-sm font-black text-[#B55200]">수능 국어 그룹 수업 별도 선택</div>
                  <div className="rounded-xl bg-[#F8FAFF] px-3 py-2 text-sm font-black text-[#14295F]">학부모 앱으로 과정 확인</div>
                </div>
              </div>
            </div>
          </article>

          <div className="grid gap-3 sm:grid-cols-2">
            {otherStats.map((stat) => (
              <article key={stat.label} className="rounded-2xl border border-[#14295F]/10 bg-[#F8FAFF] p-4 shadow-sm">
                <p className="text-[11px] font-black text-[#14295F]/70">{stat.label}</p>
                <p className="font-brand mt-2 break-keep text-lg text-[#14295F] sm:text-xl">{stat.value}</p>
                {stat.detail ? <p className="mt-1 text-xs font-bold text-[#FF7A16]">{stat.detail}</p> : null}
              </article>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <a href="/go/experience?placement=hero_student_demo&mode=student&view=mobile" className="premium-surface-button px-4 py-4">
              <p className="text-[11px] font-black tracking-[0.16em] text-[#FF7A16]">STUDENT DEMO</p>
              <p className="mt-1 text-lg font-black text-[#14295F]">학생 모드 체험</p>
              <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">성장, 기록, 계획 탭까지 실제 앱처럼 확인</p>
            </a>
            <a href="/go/experience?placement=hero_parent_demo&mode=parent" className="premium-surface-button px-4 py-4">
              <p className="text-[11px] font-black tracking-[0.16em] text-[#FF7A16]">PARENT DEMO</p>
              <p className="mt-1 text-lg font-black text-[#14295F]">학부모 모드 체험</p>
              <p className="mt-1 text-sm font-bold leading-relaxed text-slate-600">앱모드 전용 알림, 캘린더, 수납 흐름 확인</p>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
