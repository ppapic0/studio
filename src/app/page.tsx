import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  const highlights = [
    {
      title: '출결·루틴 자동 관리',
      desc: '등원 루틴, 지각/결석, 미작성 상태를 한 화면에서 빠르게 확인하고 관리합니다.',
    },
    {
      title: '학부모 신뢰 대시보드',
      desc: '최근 알림, 학습 캘린더, 벌점 지표를 통해 학습 흐름을 투명하게 공유합니다.',
    },
    {
      title: '상담·수납 운영 연동',
      desc: '상담일지, 리포트, 인보이스를 분리 운영해 실제 센터 업무 흐름에 맞춥니다.',
    },
  ];

  return (
    <main className="min-h-screen bg-[#F3F6FC] text-slate-900">
      <section className="relative overflow-hidden bg-[#0D215A]">
        <div className="absolute inset-0">
          <Image
            src="/login-fireworks.png"
            alt="트랙 메인 비주얼"
            fill
            priority
            className="object-cover object-center opacity-35"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,122,22,0.42),transparent_38%),radial-gradient(circle_at_78%_12%,rgba(255,255,255,0.12),transparent_35%),linear-gradient(180deg,rgba(13,33,90,0.86),rgba(13,33,90,0.94))]" />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-8 md:px-10 md:pb-28 md:pt-12">
          <div className="mb-12 flex items-center justify-between gap-4">
            <Image
              src="/track-logo-full.png"
              alt="트랙 학습센터 로고"
              width={230}
              height={130}
              priority
              className="h-auto w-[170px] sm:w-[210px]"
            />
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-white/30 bg-white/10 px-4 text-xs font-black text-white backdrop-blur transition hover:bg-white/20"
            >
              관리자 로그인
            </Link>
          </div>

          <p className="text-xs font-black uppercase tracking-[0.22em] text-white/75">TRACK INTELLIGENCE</p>
          <h1 className="mt-4 break-keep text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
            학생의 시간을 지키는 학습 운영 시스템
          </h1>
          <p className="mt-4 max-w-2xl break-keep text-base font-bold leading-relaxed text-white/85">
            출결, 학습, 상담, 수납까지 한 흐름으로 운영해 학부모 신뢰와 학생 성장을 동시에 관리합니다.
          </p>
          <p className="mt-2 text-sm font-bold text-[#FFB273]">트랙과 함께라면 할 수 있습니다.</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/app"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-[#FF7A16] px-6 text-sm font-black text-white shadow-lg shadow-[#FF7A16]/35 transition hover:bg-[#f06905]"
            >
              오늘의 트랙을 시작하세요
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/35 bg-white/10 px-6 text-sm font-black text-white backdrop-blur transition hover:bg-white/20"
            >
              로그인
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-12 md:px-10 md:py-16">
        <div className="grid gap-4 md:grid-cols-3">
          {highlights.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-[#14295F]/10 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#FF7A16]">핵심 운영</p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-[#14295F]">{item.title}</h2>
              <p className="mt-2 break-keep text-sm font-bold leading-relaxed text-slate-600">{item.desc}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-[#14295F]/10 bg-white p-6 shadow-sm md:p-7">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#14295F]/60">운영 흐름</p>
          <div className="mt-3 flex flex-col gap-2 text-sm font-bold text-[#14295F] md:flex-row md:items-center md:gap-3">
            <span className="rounded-lg bg-[#F3F6FC] px-3 py-2">입실·출결 관리</span>
            <span className="hidden md:block text-[#FF7A16]">→</span>
            <span className="rounded-lg bg-[#F3F6FC] px-3 py-2">학습 데이터 기록</span>
            <span className="hidden md:block text-[#FF7A16]">→</span>
            <span className="rounded-lg bg-[#F3F6FC] px-3 py-2">학부모 공유·상담</span>
            <span className="hidden md:block text-[#FF7A16]">→</span>
            <span className="rounded-lg bg-[#F3F6FC] px-3 py-2">수납·리포트 관리</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/app"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#14295F] px-5 text-sm font-black text-white transition hover:bg-[#0f1f4d]"
            >
              웹앱으로 이동
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[#14295F]/20 bg-white px-5 text-sm font-black text-[#14295F] transition hover:bg-[#F7FAFF]"
            >
              로그인하기
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
