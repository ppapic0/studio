import Link from 'next/link';
import { ArrowRight, Smartphone, Users } from 'lucide-react';

const structureCards = [
  {
    step: 'STEP 03',
    label: '학생 관리 구조',
    title: '오늘 해야 할 행동이 먼저 보입니다',
    description: '학생 화면은 오늘 루틴, 누적 기록, 피드백 반영 흐름을 한 문맥에서 확인하도록 정리됩니다.',
    chips: ['오늘 루틴', '누적 기록', '피드백 반영'],
    href: '/#app',
    icon: Smartphone,
    cardClass:
      'border-[rgba(20,41,95,0.1)] bg-white hover:border-[rgba(20,41,95,0.22)] hover:shadow-md hover:shadow-[#14295F]/8',
    stepClass: 'bg-[#14295F]/6 text-[#14295F]/55',
    labelClass: 'text-[#14295F]/45',
    chipClass: 'bg-[#F3F7FF] text-[#14295F]/72',
    iconClass: 'bg-[#EEF3FF] text-[#14295F]',
  },
  {
    step: 'STEP 04',
    label: '학부모 확인 구조',
    title: '현재 상태와 흐름을 빠르게 읽게 합니다',
    description: '학부모 화면은 출결 상태, 학습 흐름, 리포트 확인 항목을 먼저 읽도록 구성됩니다.',
    chips: ['출결 상태', '학습 흐름', '리포트 확인'],
    href: '/#app',
    icon: Users,
    cardClass:
      'border-[rgba(255,122,22,0.14)] bg-white hover:border-[rgba(255,122,22,0.32)] hover:shadow-md hover:shadow-[#FF7A16]/8',
    stepClass: 'bg-[#FF7A16]/8 text-[#B55200]/72',
    labelClass: 'text-[#FF7A16]/65',
    chipClass: 'bg-[#FFF4EC] text-[#B55200]/78',
    iconClass: 'bg-[#FFF3E8] text-[#FF7A16]',
  },
] as const;

export function FeatureStepsSection() {
  return (
    <section
      id="features"
      className="scroll-mt-20 py-12 sm:py-16"
      style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f2f6ff 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg text-center">
          <span className="eyebrow-badge">HOW WE WORK</span>
          <h2 className="font-aggro-display mt-3 break-keep text-[clamp(1.75rem,3.5vw,2.5rem)] font-black leading-[1.1] text-[#14295F]">
            트랙이 다른 이유는
            <br />
            구조에 있습니다
          </h2>
          <p className="mt-3 break-keep text-[14px] font-bold leading-[1.7] text-[#384f6a]">
            단순히 공간을 제공하는 것이 아니라, 공부습관을 설계하고 목표까지 가는 길을 함께 관리합니다.
          </p>
        </div>

        <div className="mt-9 grid gap-4 sm:grid-cols-2">
          <Link
            href="/#consult"
            className="group flex flex-col rounded-[1.25rem] border border-[rgba(20,41,95,0.1)] bg-white p-5 transition-all duration-200 hover:border-[rgba(20,41,95,0.22)] hover:shadow-md hover:shadow-[#14295F]/8 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14295F]/40"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-[#14295F]/6 px-2.5 py-1 text-[10.5px] font-black tracking-[0.14em] text-[#14295F]/55">
                STEP 01
              </span>
              <span className="text-[2.2rem] font-black leading-none text-[#14295F]/8">01</span>
            </div>
            <p className="mt-5 text-[10.5px] font-black tracking-[0.18em] uppercase text-[#FF7A16]">
              관리형 스터디센터
            </p>
            <h3 className="mt-2 whitespace-pre-line break-keep text-[1.2rem] font-black leading-[1.28] text-[#14295F]">
              {'매일 같은 흐름으로\n공부 구조를 만듭니다'}
            </h3>
            <p className="mt-3 flex-1 break-keep text-[13.5px] font-semibold leading-[1.74] text-slate-500">
              입실 시간, 공부 흐름, 쉬는 구간까지 구조화된 일과를 운영합니다. 좌석 제공이 아닌 공부습관 완성이 목표입니다.
            </p>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-[#14295F]/8 bg-[#14295F]/4 px-4 py-3">
              <div className="pr-2">
                <p className="break-keep text-[12px] font-black leading-[1.45] text-[#14295F]">
                  학기중 평일 오후 5:00 ~ 다음날 오전 1:00 · 학기중 토요일·일요일/방학중 오전 8:00 ~ 다음날 오전 1:00 · N수생 별도 운영시간 운영
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-[#14295F]/30 transition-all group-hover:translate-x-0.5 group-hover:text-[#14295F]/60" />
            </div>
          </Link>

          <Link
            href="/class"
            className="group flex flex-col rounded-[1.25rem] border border-[#0c1d47] bg-[#14295F] p-5 text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-[#14295F]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-white/15 px-2.5 py-1 text-[10.5px] font-black tracking-[0.14em] text-white/70">
                STEP 02
              </span>
              <span className="text-[2.2rem] font-black leading-none text-white/10">02</span>
            </div>
            <p className="mt-5 text-[10.5px] font-black tracking-[0.18em] uppercase text-[#FF9848]">
              수업 선택형 구조
            </p>
            <h3 className="mt-2 whitespace-pre-line break-keep text-[1.2rem] font-black leading-[1.28] text-white">
              {'소수정예 국어 프로그램은\n트랙의 핵심 프로그램입니다'}
            </h3>
            <p className="mt-3 flex-1 break-keep text-[13.5px] font-semibold leading-[1.74] text-blue-100/80">
              원장이 직접 강의하는 국어 소수정예 수업은 재학생, N수생 모두 등록 가능합니다.
            </p>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/15 bg-white/10 px-4 py-3">
              <div>
                <p className="text-[13px] font-black text-white">재학생 · N수생</p>
                <p className="mt-0.5 text-[11px] font-semibold text-white/55">등록 가능</p>
              </div>
              <ArrowRight className="h-4 w-4 text-white/30 transition-all group-hover:translate-x-0.5 group-hover:text-white/70" />
            </div>
          </Link>

          {structureCards.map((card, index) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.step}
                href={card.href}
                className={`group flex flex-col rounded-[1.25rem] border p-5 transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14295F]/25 ${card.cardClass}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`rounded-lg px-2.5 py-1 text-[10.5px] font-black tracking-[0.14em] ${card.stepClass}`}>
                    {card.step}
                  </span>
                  <span className="text-[2.2rem] font-black leading-none text-[#14295F]/8">0{index + 3}</span>
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${card.iconClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className={`text-[10.5px] font-black uppercase tracking-[0.18em] ${card.labelClass}`}>{card.label}</p>
                </div>

                <h3 className="mt-3 break-keep text-[1.2rem] font-black leading-[1.3] text-[#14295F]">{card.title}</h3>
                <p className="mt-3 flex-1 break-keep text-[13.5px] font-semibold leading-[1.74] text-slate-500">
                  {card.description}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {card.chips.map((chip) => (
                    <span key={chip} className={`rounded-md px-2.5 py-1 text-[11px] font-black ${card.chipClass}`}>
                      {chip}
                    </span>
                  ))}
                </div>

                <div className="mt-auto flex items-center justify-between pt-5">
                  <span className="text-[12.5px] font-black text-[#14295F] transition-colors group-hover:text-[#FF7A16]">
                    대표 화면 보기
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#14295F]/35 transition-all group-hover:translate-x-0.5 group-hover:text-[#FF7A16]" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
