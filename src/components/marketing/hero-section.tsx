import Image from "next/image";
import Link from "next/link";

import type { MarketingContent } from "@/lib/marketing-content";

type HeroSectionProps = {
  brand: MarketingContent["brand"];
  heroStats: MarketingContent["heroStats"];
};

export function HeroSection({ brand, heroStats }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-white pb-14 pt-10 sm:pb-20 sm:pt-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_4%,rgba(20,41,95,0.06),transparent_36%),radial-gradient(circle_at_92%_2%,rgba(255,122,22,0.1),transparent_36%)]" />

      <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.03fr_0.97fr] lg:px-8">
        <div>
          <p className="text-xs font-black tracking-[0.2em] text-[#FF7A16]">TRACK INTELLIGENCE</p>
          <h1 className="font-display mt-5 break-keep text-4xl font-bold leading-tight text-[#14295F] sm:text-5xl lg:text-6xl">
            {brand.heroTitle}
          </h1>
          <p className="mt-5 max-w-2xl break-keep text-base font-bold leading-relaxed text-slate-600 sm:text-lg">
            {brand.heroDescription}
          </p>
          <p className="mt-5 text-sm font-black text-[#14295F]">{brand.slogan}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#consult"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-[#FF7A16] px-6 text-sm font-black text-white shadow-[0_12px_28px_rgba(255,122,22,0.3)] transition hover:bg-[#f06905]"
            >
              상담 문의
            </a>
            <a
              href="#study-cafe"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-[#14295F]/20 bg-white px-6 text-sm font-black text-[#14295F] transition hover:bg-[#F7FAFF]"
            >
              시설·프로그램 보기
            </a>
            <Link
              href="/app"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-[#14295F]/20 bg-white px-6 text-sm font-black text-[#14295F] transition hover:bg-[#F7FAFF]"
            >
              웹앱 바로가기
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {heroStats.map((stat) => (
              <article key={stat.label} className="rounded-2xl border border-[#14295F]/10 bg-[#F8FAFF] p-4">
                <p className="text-[11px] font-black text-[#14295F]/70">{stat.label}</p>
                <p className="font-display mt-2 break-keep text-xl font-bold text-[#14295F]">{stat.value}</p>
                {stat.detail ? <p className="mt-1 text-xs font-bold text-[#FF7A16]">{stat.detail}</p> : null}
              </article>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <article className="group relative overflow-hidden rounded-3xl border border-[#14295F]/15 bg-[#0D235D] p-6 shadow-[0_24px_48px_rgba(8,22,56,0.22)]">
            <div className="pointer-events-none absolute inset-0">
              <Image src={brand.heroBackground} alt="트랙 학습센터 비주얼" fill className="object-cover opacity-30 transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(13,35,93,0.92),rgba(13,35,93,0.74)_45%,rgba(255,122,22,0.28))]" />
            </div>

            <div className="relative">
              <Image src={brand.logoFull} alt={`${brand.name} 로고`} width={220} height={130} className="h-auto w-[160px] sm:w-[220px]" />
              <p className="font-display mt-8 break-keep text-3xl font-bold text-white sm:text-4xl">국어 중심 입시학원</p>
              <p className="mt-2 text-sm font-bold text-white/80">원장 직강 · 직접 제작 자료 · 학생 맞춤 피드백</p>
              <div className="mt-6 h-px bg-white/20" />
              <p className="font-display mt-6 break-keep text-3xl font-bold text-white sm:text-4xl">관리형 스터디카페</p>
              <p className="mt-2 text-sm font-bold text-white/80">자체 앱 기반 출결·생활관리 · 프리미엄 좌석 운영</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
