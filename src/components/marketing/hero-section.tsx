import Image from "next/image";
import Link from "next/link";

import type { MarketingContent } from "@/lib/marketing-content";

type HeroSectionProps = {
  brand: MarketingContent["brand"];
  heroStats: MarketingContent["heroStats"];
};

export function HeroSection({ brand, heroStats }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-[#091A47] pb-16 pt-10 sm:pb-20 sm:pt-14">
      <div className="pointer-events-none absolute inset-0">
        <Image src={brand.heroBackground} alt="트랙 학습센터 히어로 배경" fill priority className="object-cover opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(255,122,22,0.35),transparent_30%),radial-gradient(circle_at_80%_18%,rgba(255,255,255,0.18),transparent_34%),linear-gradient(180deg,rgba(9,26,71,0.9),rgba(9,26,71,0.96))]" />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8">
        <div>
          <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
            <Image src={brand.logoMark} alt={`${brand.name} 심볼`} width={26} height={26} className="h-[26px] w-[26px] rounded-md object-cover" />
            <span className="text-[11px] font-black tracking-[0.18em] text-white/85">TRACK INTELLIGENCE</span>
          </div>

          <h1 className="mt-6 break-keep text-4xl font-black leading-tight text-white sm:text-5xl">
            {brand.heroTitle}
          </h1>
          <p className="mt-5 max-w-2xl break-keep text-base font-bold leading-relaxed text-white/85 sm:text-lg">
            {brand.heroDescription}
          </p>
          <p className="mt-5 text-sm font-black text-[#FFB273]">{brand.slogan}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#consult"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-[#FF7A16] px-6 text-sm font-black text-white shadow-lg shadow-[#FF7A16]/35 transition hover:bg-[#f06905]"
            >
              상담 문의
            </a>
            <a
              href="#study-cafe"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-6 text-sm font-black text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              시설·프로그램 보기
            </a>
            <Link
              href="/app"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/30 px-6 text-sm font-black text-white transition hover:bg-white/10"
            >
              웹앱 바로가기
            </Link>
          </div>
        </div>

        <div className="grid gap-4 self-end">
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-xs font-black tracking-[0.18em] text-[#FFB273]">AXIS 01</p>
              <h3 className="mt-2 text-xl font-black text-white">국어 중심 입시학원</h3>
              <p className="mt-2 text-sm font-bold leading-relaxed text-white/80">
                원장 직강과 직접 제작 자료를 기반으로 성적 향상 루트를 설계합니다.
              </p>
            </article>
            <article className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-xs font-black tracking-[0.18em] text-[#FFB273]">AXIS 02</p>
              <h3 className="mt-2 text-xl font-black text-white">관리형 스터디카페</h3>
              <p className="mt-2 text-sm font-bold leading-relaxed text-white/80">
                앱 기반 운영과 생활관리로 학습 몰입을 안정적으로 유지합니다.
              </p>
            </article>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {heroStats.map((stat) => (
              <article key={stat.label} className="rounded-2xl border border-white/20 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-[11px] font-black text-white/70">{stat.label}</p>
                <p className="mt-2 text-2xl font-black text-white">{stat.value}</p>
                {stat.detail ? <p className="mt-1 text-xs font-bold text-[#FFB273]">{stat.detail}</p> : null}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
