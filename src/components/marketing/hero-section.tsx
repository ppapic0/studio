import Image from "next/image";
import Link from "next/link";
import { Building2, CheckCircle2, GraduationCap, Trophy } from "lucide-react";

import type { MarketingContent } from "@/lib/marketing-content";

type HeroSectionProps = {
  brand: MarketingContent["brand"];
  heroStats: MarketingContent["heroStats"];
};

export function HeroSection({ brand, heroStats }: HeroSectionProps) {
  const [resultStat, ...otherStats] = heroStats;

  return (
    <section className="relative overflow-hidden bg-white pb-14 pt-10 sm:pb-20 sm:pt-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_6%,rgba(20,41,95,0.06),transparent_32%),radial-gradient(circle_at_94%_8%,rgba(255,122,22,0.11),transparent_34%)]" />

      <div className="relative mx-auto grid w-full max-w-7xl gap-6 px-4 sm:gap-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-10 lg:px-8">
        <div>
          <p className="text-xs font-black tracking-[0.2em] text-[#FF7A16]">TRACK PREMIUM EDUCATION</p>
          <h1 className="font-display mt-4 break-keep text-4xl font-bold leading-tight text-[#14295F] sm:text-5xl lg:text-6xl">
            {brand.heroTitle}
          </h1>
          <p className="mt-5 max-w-2xl break-keep text-base font-bold leading-relaxed text-slate-600 sm:text-lg">
            {brand.heroDescription}
          </p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#14295F]/12 bg-[#F6F9FF] px-4 py-2 text-sm font-black text-[#14295F]">
            <CheckCircle2 className="h-4 w-4 text-[#FF7A16]" />
            {brand.slogan}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#study-cafe"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-[#FF7A16] px-6 text-sm font-black text-white shadow-[0_12px_26px_rgba(255,122,22,0.3)] transition hover:bg-[#f06905]"
            >
              스터디카페 안내
            </a>
            <a
              href="#outcome"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-[#14295F]/20 bg-white px-6 text-sm font-black text-[#14295F] transition hover:bg-[#F7FAFF]"
            >
              2026 실적 보기
            </a>
            <Link
              href="/app"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-[#14295F]/20 bg-white px-6 text-sm font-black text-[#14295F] transition hover:bg-[#F7FAFF]"
            >
              웹앱 바로가기
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          {resultStat ? (
            <article className="relative overflow-hidden rounded-3xl border border-[#14295F]/18 bg-[linear-gradient(165deg,#13295D,#1B3C88)] p-6 text-white shadow-[0_20px_42px_rgba(20,41,95,0.25)] sm:p-7">
              <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#FF7A16]/20 blur-2xl" />
              <div className="relative">
                <p className="text-[11px] font-black tracking-[0.14em] text-[#FFB070]">{resultStat.label}</p>
                <p className="font-display mt-3 break-keep text-xl font-bold leading-snug sm:text-2xl">{resultStat.value}</p>
                {resultStat.detail ? <p className="mt-2 text-sm font-bold text-white/80">{resultStat.detail}</p> : null}

                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-black">
                    <Building2 className="h-3.5 w-3.5 text-[#FFB070]" />
                    관리형 스터디카페 중심
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-black">
                    <GraduationCap className="h-3.5 w-3.5 text-[#FFB070]" />
                    입시학원 별도 선택
                  </span>
                </div>
              </div>
            </article>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {otherStats.map((stat) => (
              <article key={stat.label} className="rounded-2xl border border-[#14295F]/10 bg-[#F8FAFF] p-4">
                <p className="text-[11px] font-black text-[#14295F]/70">{stat.label}</p>
                <p className="font-display mt-2 break-keep text-lg font-bold text-[#14295F] sm:text-xl">{stat.value}</p>
                {stat.detail ? <p className="mt-1 text-xs font-bold text-[#FF7A16]">{stat.detail}</p> : null}
              </article>
            ))}
          </div>

          <article className="rounded-2xl border border-[#14295F]/10 bg-white p-4 shadow-[0_10px_24px_rgba(20,41,95,0.08)]">
            <div className="flex items-center gap-3">
              <Image src={brand.logoMark} alt={`${brand.name} 로고`} width={40} height={40} className="h-10 w-10 object-contain" />
              <div>
                <p className="text-sm font-black text-[#14295F]">{brand.name}</p>
                <p className="text-xs font-bold text-slate-500">트랙은 실적으로 증명합니다</p>
              </div>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#FFF4EB] px-3 py-1 text-xs font-black text-[#B55200]">
                <Trophy className="h-3.5 w-3.5" />
                2026 합격 실적 공개
              </span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
