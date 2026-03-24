import Link from 'next/link';
import { ArrowRight, TrendingUp } from 'lucide-react';

const journeyCards = [
  {
    stage: '문제 발견',
    title: '공부시간 하락과 LP 미제출을 먼저 읽습니다',
    summary: '공부시간 감소, 목표 달성률 저하, 루틴 이탈을 데이터로 먼저 확인합니다.',
    chips: ['공부시간 하락', '목표 달성률 저하', 'LP 미제출'],
  },
  {
    stage: '개입',
    title: '루틴 재설계와 피드백으로 바로 개입합니다',
    summary: '상담, 피드백, 과제 밀도 조절, 루틴 재정렬을 같은 흐름으로 연결합니다.',
    chips: ['루틴 재설계', '피드백 발송', '상담 연결'],
  },
  {
    stage: '변화',
    title: '공부시간 회복과 성과 상승을 다시 확인합니다',
    summary: '리듬 회복, 공부시간 증가, 시험 결과 상승이 전후 비교로 남습니다.',
    chips: ['공부시간 회복', '백분위 상승', '합격 결과'],
  },
];

const proofImages = [
  {
    label: '실제 성적표',
    title: '6월 모의평가',
    caption: '국어 3등급 · 백분위 82',
    image: '/marketing/proof/june-mock-redacted.jpg',
  },
  {
    label: '실제 성적표',
    title: '9월 모의평가',
    caption: '국어 1등급 · 백분위 96',
    image: '/marketing/proof/september-mock-redacted.jpg',
  },
  {
    label: '실제 피드백',
    title: '학부모/학생 피드백',
    caption: '카카오 피드백 일부 마스킹 공개',
    image: '/marketing/reviews/kakao-feedback-1-redacted.jpg',
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
      style={{ background: 'linear-gradient(180deg, #f2f6ff 0%, #ffffff 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <article className="marketing-card p-6 sm:p-8">
            <span className="inline-flex items-center rounded-full bg-[#14295F]/8 px-3 py-1 text-[11px] font-black tracking-[0.14em] text-[#14295F] uppercase">
              행동 변화 증명
            </span>
            <h2 className="mt-4 break-keep text-[clamp(1.45rem,3.1vw,2.2rem)] font-black leading-[1.2] text-[#14295F]">
              문제를 먼저 읽고 개입하면
              <br />
              변화도 데이터로 남습니다
            </h2>
            <p className="mt-4 break-keep text-[14px] font-semibold leading-[1.8] text-[#3f5874] sm:text-[14.5px]">
              트랙의 증거는 좋은 문구가 아니라 전후 비교입니다. 공부시간 하락, 목표 달성률 저하, LP 미제출을 먼저 읽고 개입한 뒤, 회복과 결과 상승이 어떻게 이어졌는지 익명화된 사례로 보여줍니다.
            </p>

            <div className="mt-6 grid gap-3">
              {journeyCards.map((card, index) => (
                <article key={card.stage} className="rounded-[1.3rem] border border-[#14295F]/8 bg-[#F8FBFF] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">
                        STEP 0{index + 1} · {card.stage}
                      </p>
                      <p className="mt-1 text-[1rem] font-black leading-[1.4] text-[#14295F]">{card.title}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#14295F]/55">
                      {card.stage}
                    </span>
                  </div>
                  <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.7] text-slate-500">{card.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {card.chips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-[#14295F]/10 bg-white px-3 py-1 text-[11px] font-black text-[#14295F]/68"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-[1.4rem] border border-[#14295F]/8 bg-[#14295F] p-5 text-white">
              <p className="text-[10px] font-black tracking-[0.18em] text-white/62">BEFORE / AFTER</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.1rem] bg-white/8 px-4 py-4">
                  <p className="text-[11px] font-black text-white/72">백분위 변화</p>
                  <p className="mt-1 text-[1.1rem] font-black">82 → 96 → 99</p>
                </div>
                <div className="rounded-[1.1rem] bg-white/8 px-4 py-4">
                  <p className="text-[11px] font-black text-white/72">주간 공부시간</p>
                  <p className="mt-1 text-[1.1rem] font-black">21h → 34h</p>
                </div>
                <div className="rounded-[1.1rem] bg-white/8 px-4 py-4">
                  <p className="text-[11px] font-black text-white/72">개입 루프</p>
                  <p className="mt-1 text-[1.1rem] font-black">14회 누적</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/class" className="premium-cta premium-cta-primary h-11 px-6 text-sm">
                국어 수업 자세히 보기
              </Link>
              <Link href="/experience?mode=admin" className="premium-cta premium-cta-muted h-11 px-6 text-sm">
                운영자 흐름 보기
              </Link>
            </div>
          </article>

          <div className="grid gap-4 sm:grid-cols-2">
            {proofImages.map((item) => (
              <article
                key={`${item.title}-${item.caption}`}
                className="overflow-hidden rounded-[1.25rem] border border-[#14295F]/10 bg-white shadow-[0_10px_26px_-20px_rgba(20,41,95,0.42)]"
              >
                <div className="relative">
                  <img src={item.image} alt={`${item.title} 마스킹 증빙`} className="h-[260px] w-full object-cover object-top" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0d1732]/88 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-[10px] font-black tracking-[0.16em] text-white/70">{item.label}</p>
                    <p className="mt-1 text-[14px] font-black text-white">{item.title}</p>
                    <p className="mt-1 text-[11px] font-semibold text-white/72">{item.caption}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-[1.2rem] border border-[#14295F]/10 bg-white/90 px-4 py-4 sm:px-5">
          <p className="flex flex-col items-start gap-3 break-keep text-[12.5px] font-semibold text-[#425b78] sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#FF7A16]" />
              결과만 자랑하지 않고, 문제 발견부터 개입과 변화까지 이어진 흐름을 증거로 공개합니다.
            </span>
            <Link href="/class" className="inline-flex items-center gap-1 font-black text-[#14295F]">
              국어 수업 방식 보기
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
