import Image from 'next/image';
import Link from 'next/link';
import { BarChart3, Clock3, Search, Sparkles } from 'lucide-react';

const caseTimeline = [
  {
    phase: '6월 모의평가',
    score: '3등급',
    percentile: '백분위 82',
    tone: 'border-[#14295F]/10 bg-white text-[#14295F]',
  },
  {
    phase: '9월 모의평가',
    score: '1등급',
    percentile: '백분위 96',
    tone: 'border-[#FF7A16]/18 bg-[#FFF6EF] text-[#14295F]',
  },
  {
    phase: '수능 본시험',
    score: '상승 완료',
    percentile: '백분위 99',
    tone: 'border-[#14295F] bg-[#14295F] text-white',
  },
];

const interventionHighlights = [
  {
    icon: Search,
    label: '진단',
    title: '문제 상태를 먼저 진단합니다',
    description: '국어 약점 유형과 공부시간 하락 구간을 먼저 확인하고, 루틴이 무너지는 지점을 찾습니다.',
    emphasis: '6월 3등급 · 백분위 82',
  },
  {
    icon: Clock3,
    label: '개입',
    title: '루틴과 개입을 바로 연결합니다',
    description: '시작 시간 고정, 주간 계획 조정, 과제 밀도 재배치를 같은 흐름 안에서 반복 개입합니다.',
    emphasis: '주간 학습시간 21h → 34h',
  },
  {
    icon: Sparkles,
    label: '변화 확인',
    title: '변화도 다시 숫자로 확인합니다',
    description: '상승한 성적만 보는 것이 아니라, 학습 안정성과 루틴 회복이 함께 유지되는지 전후를 비교합니다.',
    emphasis: '9월 백분위 96 → 수능 99',
  },
] as const;

const caseMetrics = [
  {
    label: '백분위 변화',
    value: '82 → 96 → 99',
    detail: '6월 · 9월 · 수능',
  },
  {
    label: '주간 학습시간',
    value: '21h → 34h',
    detail: '루틴 고정 이후 상승',
  },
  {
    label: '개입 기록',
    value: '14회',
    detail: '점검 · 피드백 누적',
  },
] as const;

const scoreSheetProofs = [
  {
    label: '6월 모의평가',
    caption: '국어 3등급 · 백분위 82',
    image: '/marketing/proof/june-score-sheet-proof-v6.jpg',
  },
  {
    label: '9월 모의평가',
    caption: '국어 1등급 · 백분위 96',
    image: '/marketing/proof/september-score-sheet-proof-v6.jpg',
  },
  {
    label: '수능',
    caption: '국어 백분위 99',
    image: '/marketing/proof/csat-score-sheet-proof-v6.jpg',
  },
] as const;

export function HomeGrowthProofSection() {
  return (
    <section
      id="growth-proof"
      className="scroll-mt-24 py-12 sm:py-20"
      style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f6f8fc 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
          <article className="marketing-card p-4 sm:p-8">
            <span className="inline-flex items-center rounded-full bg-[#14295F]/7 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-[#14295F] uppercase">
              Growth Proof
            </span>
            <h2 className="mt-3 break-keep text-[1.12rem] font-black leading-[1.22] text-[#14295F] sm:mt-4 sm:text-[clamp(1.35rem,7vw,2.15rem)]">
              관리와 코칭을 함께 설계했을때,
              <br />
              성적은 데이터로 올라옵니다
            </h2>
            <p className="mt-3 break-keep text-[12px] font-semibold leading-[1.72] text-[#425a75] sm:mt-4 sm:text-[14px] sm:leading-[1.82]">
              한 학생의 변화 과정을 익명 사례로 정리했습니다. 트랙은 결과만 보여주지 않고, 어떤 문제를 먼저 찾았고
              어떤 개입이 성적 상승으로 이어졌는지 같은 흐름 안에서 설명합니다.
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5 sm:mt-6 sm:gap-2">
              {['익명 대표 사례', '국어 약점 진단', '루틴 고정 개입', '전후 데이터 확인'].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[#14295F]/10 bg-[#F7FAFF] px-2.5 py-1 text-[9.5px] font-black text-[#14295F]/78 sm:px-3 sm:py-1.5 sm:text-[12px]"
                >
                  {chip}
                </span>
              ))}
            </div>

            <div className="mt-5 rounded-[1.1rem] border border-[#14295F]/10 bg-[#14295F] p-4 text-white shadow-[0_18px_34px_rgba(20,41,95,0.16)] sm:mt-7 sm:rounded-[1.4rem] sm:p-5">
              <p className="text-[10px] font-black tracking-[0.18em] text-white/62">CASE SNAPSHOT</p>
              <p className="brand-number-pop mt-2 break-keep text-[1.02rem] font-black leading-[1.28] sm:text-[1.35rem]">
                6월 3등급에서 시작해
                <br />
                수능 백분위 99까지 올라간 사례
              </p>
              <p className="mt-2.5 break-keep text-[11px] font-semibold leading-[1.6] text-white/78 sm:mt-3 sm:text-[13px] sm:leading-[1.72]">
                결과만이 아니라, 개입 전후의 루틴 변화와 공부시간 회복까지 함께 본 대표 사례입니다.
              </p>
            </div>

            <div className="mt-5 sm:mt-7">
              <Link href="/class" className="premium-cta premium-cta-primary h-11 w-full px-6 text-sm sm:w-auto">
                국어 수업 자세히 보기
              </Link>
            </div>
          </article>

          <div className="space-y-4">
            <article className="brand-sheen-panel overflow-hidden rounded-[1.6rem] border border-[#14295F]/12 bg-white shadow-[0_18px_40px_rgba(20,41,95,0.10)]">
              <div className="border-b border-[#14295F]/8 bg-[linear-gradient(135deg,#F8FBFF_0%,#FFF4EB_100%)] px-3.5 py-4 sm:px-6 sm:py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black tracking-[0.18em] text-[#14295F]/45">대표 익명 사례 01</p>
                    <h3 className="mt-1 break-keep text-[0.98rem] font-black leading-[1.3] text-[#14295F] sm:text-[1.28rem]">
                      한 학생의 변화가 만들어진 흐름
                    </h3>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[9.5px] font-black text-[#FF7A16] shadow-[0_8px_18px_rgba(255,122,22,0.10)] sm:px-3 sm:text-[11px]">
                    <BarChart3 className="h-3.5 w-3.5" />
                    실수치 기반 정리
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                  {caseTimeline.map((item) => (
                    <article
                      key={item.phase}
                      className={`brand-sheen-panel relative min-w-0 overflow-hidden rounded-[0.95rem] border px-2.5 py-3 shadow-[0_10px_22px_rgba(20,41,95,0.04)] sm:rounded-[1.2rem] sm:px-4 sm:py-4 ${item.tone}`}
                    >
                      <div className="relative">
                        <p className="text-[8.5px] font-black tracking-[0.12em] opacity-70 sm:text-[10px]">{item.phase}</p>
                        <p className="brand-number-pop mt-1.5 break-keep text-[0.92rem] font-black leading-none sm:mt-2 sm:text-[1.1rem]">{item.score}</p>
                        <p className="mt-1.5 text-[9px] font-semibold leading-[1.35] opacity-85 sm:mt-2 sm:text-[13px]">{item.percentile}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="px-3.5 py-4 sm:px-6 sm:py-6">
                <div className="relative">
                  <div className="brand-flow-line pointer-events-none absolute left-[16%] right-[16%] top-9 hidden h-[2px] rounded-full bg-[linear-gradient(90deg,rgba(255,122,22,0.08),rgba(255,122,22,0.68),rgba(20,41,95,0.08))] lg:block" />
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {interventionHighlights.map((item, index) => {
                      const Icon = item.icon;

                      return (
                        <article
                          key={item.label}
                          className="brand-sheen-panel relative min-w-0 rounded-[1rem] border border-[#14295F]/9 bg-[#F9FBFF] px-2.5 py-3 sm:rounded-[1.35rem] sm:px-4 sm:py-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[8.5px] font-black tracking-[0.12em] text-[#FF7A16] sm:text-[10px]">{item.label}</span>
                            <div
                              className="brand-glow-drift flex h-7 w-7 items-center justify-center rounded-2xl bg-[#14295F]/7 text-[#14295F] sm:h-8 sm:w-8"
                              style={{ animationDelay: `${index * 0.4}s` }}
                            >
                              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </div>
                          </div>
                          <p className="mt-2 break-keep text-[0.82rem] font-black leading-[1.36] text-[#14295F] sm:mt-3 sm:text-[1rem] sm:leading-[1.42]">{item.title}</p>
                          <p className="mt-2 hidden break-keep text-[13px] font-semibold leading-[1.72] text-[#425a75] sm:block">
                            {item.description}
                          </p>
                          <p
                            className="brand-chip-rise mt-3 rounded-[0.8rem] bg-white px-2.5 py-1.5 text-[9px] font-black leading-[1.35] text-[#14295F] shadow-[inset_0_0_0_1px_rgba(20,41,95,0.06)] sm:mt-4 sm:rounded-[0.95rem] sm:px-3 sm:py-2 sm:text-[12px]"
                            style={{ animationDelay: `${0.12 + index * 0.08}s` }}
                          >
                            {item.emphasis}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                  {caseMetrics.map((item) => (
                    <article
                      key={item.label}
                      className="brand-sheen-panel relative min-w-0 overflow-hidden rounded-[0.95rem] border border-[#14295F]/10 bg-[#14295F] px-2.5 py-3 text-white sm:rounded-[1.2rem] sm:px-4 sm:py-4"
                    >
                      <div className="brand-glow-drift absolute -right-8 top-0 h-16 w-16 rounded-full bg-white/12 blur-2xl" />
                      <p className="text-[8.5px] font-black tracking-[0.12em] text-white/58 sm:text-[10px]">{item.label}</p>
                      <p className="brand-number-pop mt-1.5 break-keep text-[0.92rem] font-black leading-[1.2] sm:mt-2 sm:text-[1.2rem]">{item.value}</p>
                      <p className="mt-1 text-[8.5px] font-semibold leading-[1.35] text-white/68 sm:mt-1.5 sm:text-[11px]">{item.detail}</p>
                    </article>
                  ))}
                </div>
              </div>
            </article>

          </div>
        </div>

        <article className="brand-sheen-panel mt-6 overflow-hidden rounded-[1.6rem] border border-[#14295F]/12 bg-white shadow-[0_18px_40px_rgba(20,41,95,0.10)]">
          <div className="border-b border-[#14295F]/8 bg-[linear-gradient(135deg,#FFF8F1_0%,#F8FBFF_100%)] px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">ACTUAL SCORE SHEETS</p>
                <h3 className="mt-2 break-keep text-[1.18rem] font-black leading-[1.4] text-[#14295F] sm:text-[1.3rem]">
                  실제 모의고사 성적표로 변화 흐름을 확인합니다
                </h3>
                <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.78] text-[#425a75]">
                  원장 국어 수업과 전과목 밸런스 코칭이 함께 들어간 학생 사례입니다.
                </p>
              </div>

              <div className="inline-flex items-center rounded-full border border-[#14295F]/10 bg-white px-3 py-1.5 text-[11px] font-black text-[#14295F]/72 shadow-[0_8px_18px_rgba(20,41,95,0.06)]">
                개인정보 마스킹 완료
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 p-3.5 sm:gap-4 sm:p-6">
            {scoreSheetProofs.map((item) => (
              <article
                key={item.image}
                className="brand-sheen-panel min-w-0 overflow-hidden rounded-[1rem] border border-[#14295F]/10 bg-white shadow-[0_12px_26px_rgba(20,41,95,0.06)] sm:rounded-[1.3rem]"
              >
                <div className="px-2.5 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
                  <p className="text-[8.5px] font-black tracking-[0.12em] text-[#FF7A16] sm:text-[10px]">{item.label}</p>
                  <div className="mt-2 rounded-[0.85rem] border border-[#14295F]/8 bg-[#F8FBFF] p-1.5 sm:mt-3 sm:rounded-[1.1rem] sm:p-3">
                    <div className="relative aspect-[3/4] overflow-hidden rounded-[0.95rem] bg-white">
                      <Image
                        src={item.image}
                        alt={`${item.label} 성적표`}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-contain"
                      />
                    </div>
                  </div>
                  <p className="mt-2 break-keep text-[9px] font-black leading-[1.4] text-[#14295F] sm:mt-3 sm:text-[13px]">{item.caption}</p>
                </div>
              </article>
            ))}
          </div>
        </article>

        <div className="mt-6 rounded-[1.2rem] border border-[#14295F]/10 bg-white px-4 py-4 sm:px-5">
          <p className="flex items-start gap-2 break-keep text-[12.5px] font-semibold leading-[1.72] text-[#425b78]">
            <span className="inline-flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#FF7A16]" />
              실제 성적표는 이름, 학교, 개인정보를 가린 뒤 6월 · 9월 · 수능 순서로 정리했습니다.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
