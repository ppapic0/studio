import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#F4F6FB] text-slate-900">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col overflow-hidden rounded-none md:grid md:grid-cols-[1fr_1.05fr]">
        <div className="flex flex-col justify-center px-6 py-16 md:px-12 lg:px-16">
          <div className="mb-8">
            <Image
              src="/track-logo-full.png"
              alt="트랙 학습센터 로고"
              width={260}
              height={160}
              priority
              className="h-auto w-[220px] sm:w-[250px]"
            />
          </div>

          <p className="text-[12px] font-black uppercase tracking-[0.22em] text-[#14295F]/70">
            Track Study Center
          </p>
          <h1 className="mt-3 text-3xl font-black leading-tight text-[#14295F] sm:text-4xl lg:text-5xl">
            학생의 시간을 지키는
            <br />
            학습 운영 시스템
          </h1>
          <p className="mt-4 max-w-xl break-keep text-base font-bold leading-relaxed text-slate-600">
            출결, 학습 루틴, 상담, 수납, 리포트를 한 흐름으로 운영하고 학부모와 학생에게 신뢰도 높은 데이터를 제공합니다.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/app"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-[#14295F] px-6 text-sm font-black text-white shadow-lg shadow-[#14295F]/20 transition hover:bg-[#10224f]"
            >
              웹앱 시작하기 (/app)
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-[#14295F]/20 bg-white px-6 text-sm font-black text-[#14295F] transition hover:bg-[#14295F]/5"
            >
              로그인
            </Link>
          </div>
        </div>

        <div className="relative flex min-h-[360px] items-end justify-center overflow-hidden bg-[#091A4B] p-6 md:min-h-screen md:p-10">
          <Image
            src="/login-fireworks.png"
            alt="트랙 학습센터 비주얼"
            fill
            priority
            className="object-cover object-center opacity-90"
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,122,22,0.35),transparent_45%),radial-gradient(circle_at_80%_28%,rgba(20,41,95,0.72),transparent_52%),linear-gradient(180deg,rgba(9,26,75,0.2),rgba(9,26,75,0.65))]" />
          <div className="relative z-10 mb-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-4 backdrop-blur-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">track intelligence</p>
            <p className="mt-1 text-lg font-black leading-tight text-white">홍보 사이트와 웹앱을 하나의 도메인으로 운영</p>
            <p className="mt-1 text-sm font-bold text-white/80">trackstudy.kr · /app</p>
          </div>
        </div>
      </section>
    </main>
  );
}

