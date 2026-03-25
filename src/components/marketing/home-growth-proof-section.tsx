import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, TrendingUp } from 'lucide-react';

const steps = [
  {
    step: '문제 발견',
    title: '공부시간 하락과 미제출을 먼저 잡습니다',
    summary: '감으로 추측하지 않고, 떨어지는 구간을 먼저 확인합니다.',
  },
  {
    step: '개입',
    title: '루틴 조정과 피드백을 바로 연결합니다',
    summary: '상담, 계획 조정, 과제 밀도 조절이 같은 흐름 안에서 이어집니다.',
  },
  {
    step: '변화',
    title: '회복과 성적 상승을 다시 데이터로 봅니다',
    summary: '백분위와 공부시간이 함께 올라가는지 전후로 확인합니다.',
  },
];

const proofImages = [
  {
    label: '실제 성적표',
    title: '6월 모의평가',
    caption: '국어 백분위 82',
    image: '/marketing/proof/june-mock-redacted.jpg',
  },
  {
    label: '실제 성적표',
    title: '9월 모의평가',
    caption: '국어 백분위 96',
    image: '/marketing/proof/september-mock-redacted.jpg',
  },
  {
    label: '실제 성적표',
    title: '수능 본시험',
    caption: '국어 백분위 99',
    image: '/marketing/proof/csat-score-redacted.jpg',
  },
];

export function HomeGrowthProofSection() {
  return (
    <section
      id="growth-proof"
      className="scroll-mt-24 py-16 sm:py-20"
      style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[0.94fr_1.06fr]">
          <article className="marketing-card p-6 sm:p-8">
            <span className="inline-flex items-center rounded-full bg-[#14295F]/7 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-[#14295F] uppercase">
              Growth Proof
            </span>
            <h2 className="mt-4 break-keep text-[clamp(1.45rem,3.1vw,2.15rem)] font-black leading-[1.22] text-[#14295F]">
              문제를 먼저 찾고 개입하면
              <br />
              변화도 같은 화면 언어로 남습니다
            </h2>
            <p className="mt-4 break-keep text-[14px] font-semibold leading-[1.8] text-[#425a75]">
              홈에서는 한 학생의 전후 변화만 짧고 선명하게 보여줍니다. 더 많은 설명보다 무엇이 바뀌었는지가 먼저 읽히도록 정리했습니다.
            </p>

            <div className="mt-6 grid gap-3">
              {steps.map((item, index) => (
                <article key={item.step} className="rounded-[1.2rem] border border-[#14295F]/8 bg-[#F8FBFF] px-4 py-4">
                  <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">
                    STEP 0{index + 1} · {item.step}
                  </p>
                  <p className="mt-1 text-[1rem] font-black leading-[1.42] text-[#14295F]">{item.title}</p>
                  <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.68] text-[#3A5470]">{item.summary}</p>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-[1.45rem] border border-[#14295F]/10 bg-[#14295F] p-5 text-white">
              <p className="text-[10px] font-black tracking-[0.18em] text-white/60">BEFORE / AFTER</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1rem] bg-white/8 px-4 py-4">
                  <p className="text-[11px] font-black text-white/80">국어 백분위</p>
                  <p className="mt-1 text-[1.35rem] font-black">82 → 96 → 99</p>
                </div>
                <div className="rounded-[1rem] bg-white/8 px-4 py-4">
                  <p className="text-[11px] font-black text-white/80">주간 학습 시간</p>
                  <p className="mt-1 text-[1.35rem] font-black">21h → 34h</p>
                </div>
                <div className="rounded-[1rem] bg-white/8 px-4 py-4">
                  <p className="text-[11px] font-black text-white/80">개입 기록</p>
                  <p className="mt-1 text-[1.35rem] font-black">14회 누적</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/class" className="premium-cta premium-cta-primary h-11 px-6 text-sm">
                국어 수업 자세히 보기
              </Link>
              <Link href="/experience?mode=admin" className="premium-cta premium-cta-muted h-11 px-6 text-sm">
                운영 흐름 보기
              </Link>
            </div>
          </article>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              {proofImages.map((item) => (
                <article
                  key={item.image}
                  className="overflow-hidden rounded-[1.2rem] border border-[#14295F]/10 bg-white shadow-[0_10px_26px_rgba(20,41,95,0.06)]"
                >
                  <div className="relative aspect-[3/4]">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="object-cover object-center"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0d1732]/88 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4">
                      <p className="text-[10px] font-black tracking-[0.16em] text-white/80">{item.label}</p>
                      <p className="mt-0.5 text-[14px] font-black text-white">{item.title}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-white/90">{item.caption}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <article className="overflow-hidden rounded-[1.35rem] border border-[#14295F]/10 bg-white shadow-[0_10px_26px_rgba(20,41,95,0.06)]">
              <div className="grid gap-0 md:grid-cols-[1.05fr_0.95fr]">
                <div className="relative min-h-[260px]">
                  <Image
                    src="/marketing/reviews/kakao-feedback-1-redacted.jpg"
                    alt="실제 피드백 캡처"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover object-top"
                  />
                </div>
                <div className="flex flex-col justify-center px-6 py-6">
                  <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">ACTUAL FEEDBACK</p>
                  <p className="mt-2 break-keep text-[1.1rem] font-black leading-[1.45] text-[#14295F]">
                    성적표만이 아니라 실제 피드백 흐름도 함께 남깁니다
                  </p>
                  <p className="mt-3 break-keep text-[13px] font-semibold leading-[1.72] text-[#3A5470]">
                    증빙 이미지는 이 섹션에만 모아서 보여주고, 다른 섹션에서는 같은 이미지를 반복하지 않습니다.
                  </p>
                </div>
              </div>
            </article>
          </div>
        </div>

        <div className="mt-6 rounded-[1.2rem] border border-[#14295F]/10 bg-white px-4 py-4 sm:px-5">
          <p className="flex flex-col items-start gap-3 break-keep text-[12.5px] font-semibold text-[#425b78] sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#FF7A16]" />
              성장 증빙은 한 섹션에서만 보여주고, 홈 전체에서는 같은 그림을 반복하지 않습니다.
            </span>
            <Link href="/experience" className="inline-flex items-center gap-1 font-black text-[#14295F]">
              체험 페이지로 이어보기
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
