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
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_44%,#FFFFFF_100%)] pb-12 pt-8 sm:pb-16 sm:pt-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(20,41,95,0.06),transparent_24%),radial-gradient(circle_at_88%_8%,rgba(255,122,22,0.14),transparent_18%),linear-gradient(126deg,transparent_0%,transparent_54%,rgba(20,41,95,0.03)_54%,rgba(20,41,95,0.03)_55%,transparent_55%)]" />

      <div className="relative mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:px-8">
        <div className="space-y-6">
          <p className="text-[11px] font-black tracking-[0.26em] text-[#FF7A16]">TRACK MANAGED STUDY CENTER</p>

          <div className="space-y-3">
            <h1 className="font-brand max-w-4xl break-keep text-[3rem] leading-[0.94] text-[#14295F] sm:text-[4.7rem] lg:text-[5.6rem]">
              관리형
              <br />
              스터디센터가
              <br />
              중심입니다
            </h1>
            <p className="max-w-xl break-keep text-[16px] font-medium leading-[1.82] text-slate-600 sm:text-[17px]">
              {brand.heroDescription}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[0.95fr_1.05fr]">
            <div className="marketing-card p-4 sm:p-5">
              <p className="text-[11px] font-black tracking-[0.22em] text-[#FF7A16]">KEYWORD</p>
              <div className="mt-4 space-y-2.5">
                {heroKeywords.map((keyword) => (
                  <div key={keyword} className="rounded-2xl bg-[#14295F] px-4 py-3 text-[1.05rem] font-black tracking-[-0.03em] text-white sm:text-[1.18rem]">
                    {keyword}
                  </div>
                ))}
              </div>
            </div>

            <div className="marketing-card-soft p-4 sm:p-5">
              <p className="text-[11px] font-black tracking-[0.22em] text-[#14295F]/46">TRACK SIGNAL</p>
              <div className="mt-4 space-y-2.5">
                {heroSignals.map((signal) => (
                  <div key={signal} className="flex items-start gap-3 rounded-2xl border border-[#14295F]/8 bg-white px-4 py-3 shadow-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FF7A16]" />
                    <p className="break-keep text-sm font-semibold leading-[1.6] text-[#14295F]">{signal}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <a href="/go/login?placement=hero_login" className="premium-cta premium-cta-secondary h-12 px-6 text-sm">
              웹앱 로그인
            </a>
            <a href="/go/experience?placement=hero_experience_primary" className="premium-cta premium-cta-primary h-12 px-6 text-sm">
              웹앱 체험하기
            </a>
            <a href="#consult" className="premium-cta premium-cta-muted h-12 px-6 text-sm">
              방문 상담 문의
            </a>
          </div>
        </div>

        <div className="grid gap-4">
          <article className="marketing-card relative overflow-hidden p-5 sm:p-6">
            <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(20,41,95,0.045),transparent_52%),radial-gradient(circle_at_88%_16%,rgba(255,122,22,0.16),transparent_22%)]" />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black tracking-[0.2em] text-[#FF7A16]">RESULT</p>
                <p className="mt-3 max-w-[16rem] break-keep text-[2rem] font-black leading-[1.04] tracking-[-0.03em] text-[#14295F] sm:text-[2.4rem]">
                  {resultStat?.value}
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-600">{resultStat?.detail}</p>
              </div>
              <div className="rounded-[1.6rem] border border-[#14295F]/10 bg-[#F7FAFF] p-4 shadow-sm">
                <Image src={brand.logoMark} alt={`${brand.name} 로고`} width={56} height={56} className="h-14 w-14 object-contain" />
              </div>
            </div>
          </article>

          <div className="grid gap-4 md:grid-cols-2">
            <article className="marketing-card-soft p-5">
              <p className="text-[11px] font-black tracking-[0.2em] text-[#14295F]/44">{entryStat?.label}</p>
              <p className="mt-3 break-keep text-[1.65rem] font-black leading-[1.08] tracking-[-0.03em] text-[#14295F]">
                {entryStat?.value}
              </p>
              <p className="mt-2 text-sm font-medium leading-[1.72] text-slate-600">{entryStat?.detail}</p>
            </article>

            <article className="marketing-card-warm p-5">
              <p className="text-[11px] font-black tracking-[0.2em] text-[#B85A00]/58">{dataStat?.label}</p>
              <p className="mt-3 break-keep text-[1.65rem] font-black leading-[1.08] tracking-[-0.03em] text-[#14295F]">
                {dataStat?.value}
              </p>
              <p className="mt-2 text-sm font-medium leading-[1.72] text-slate-600">{dataStat?.detail}</p>
            </article>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <a href="/go/experience?placement=hero_student_demo&mode=student&view=mobile" className="premium-surface-button marketing-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#14295F] text-white shadow-[0_10px_20px_rgba(20,41,95,0.18)]">
                  <Smartphone className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-[#F6F9FF] px-3 py-1 text-[10px] font-black tracking-[0.16em] text-[#14295F]">STUDENT DEMO</span>
              </div>
              <p className="mt-5 text-[1.45rem] font-black tracking-[-0.03em] text-[#14295F]">학생 모드 체험</p>
              <p className="mt-2 break-keep text-sm font-medium leading-[1.72] text-slate-600">성장 · 기록 · 계획 화면을 앱처럼 바로 확인</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#14295F]">
                체험 시작
                <ArrowRight className="h-4 w-4" />
              </span>
            </a>

            <a href="/go/experience?placement=hero_parent_demo&mode=parent" className="premium-surface-button marketing-card-soft p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF7A16] text-white shadow-[0_10px_20px_rgba(255,122,22,0.18)]">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black tracking-[0.16em] text-[#B85A00]">PARENT DEMO</span>
              </div>
              <p className="mt-5 text-[1.45rem] font-black tracking-[-0.03em] text-[#14295F]">학부모 모드 체험</p>
              <p className="mt-2 break-keep text-sm font-medium leading-[1.72] text-slate-600">알림 · 캘린더 · 수납 흐름을 앱모드 전용으로 확인</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#14295F]">
                체험 시작
                <ArrowRight className="h-4 w-4" />
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
