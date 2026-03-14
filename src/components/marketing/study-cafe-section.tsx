import { CheckCircle2, Clock3, GraduationCap, ShieldCheck } from 'lucide-react';

import type { MarketingContent } from '@/lib/marketing-content';

import { SectionHeading } from './section-heading';

type StudyCafeSectionProps = {
  studyCafe: MarketingContent['studyCafe'];
};

export function StudyCafeSection({ studyCafe }: StudyCafeSectionProps) {
  const premiumHighlights = [
    {
      eyebrow: 'OPERATING HOURS',
      title: '매일 08:30 ~ 익일 01:30',
      description:
        '관리형 스터디센터는 거의 연중무휴 흐름으로 운영하고, 학원은 매일 오후 10시에 종료합니다.',
      icon: <Clock3 className="h-4.5 w-4.5 text-[#FF7A16]" />,
      warm: false,
    },
    {
      eyebrow: 'MOCK EXAM FLOW',
      title: '이감 · 더프 상시 진행',
      description:
        '이감 모의고사와 더프 모의고사를 상시 진행해 실전 감각과 현재 위치를 점검합니다.',
      note: '이감모의고사와 더프 모의고사는 별도 구매입니다.',
      icon: <CheckCircle2 className="h-4.5 w-4.5 text-[#FF7A16]" />,
      warm: true,
    },
    {
      eyebrow: 'REGISTRATION FLOW',
      title: '센터 단독 / 수업 별도 선택',
      description:
        '관리형 스터디센터만 단독 등록할 수 있고, 수능 국어 그룹 수업은 필요할 때 별도로 선택 가능합니다. 재학생과 N수생 모두 등록할 수 있습니다.',
      icon: <GraduationCap className="h-4.5 w-4.5 text-[#FF7A16]" />,
      warm: false,
    },
  ];

  return (
    <section id="study-cafe" className="scroll-mt-28 bg-white py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Managed Study Center" title={studyCafe.heading} description={studyCafe.description} />

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.12fr_0.88fr]">
          <article className="marketing-card relative overflow-hidden p-6 sm:p-7">
            <div className="absolute inset-0 opacity-80 [background-image:radial-gradient(circle_at_88%_18%,rgba(255,122,22,0.14),transparent_22%),linear-gradient(120deg,transparent_0%,transparent_42%,rgba(20,41,95,0.05)_42%,rgba(20,41,95,0.05)_43%,transparent_43%)]" />
            <div className="relative">
              <p className="text-[11px] font-black tracking-[0.18em] text-[#FF7A16]">BROCHURE EDITION</p>
              <h3 className="mt-3 break-keep text-3xl font-black tracking-tight text-[#14295F] sm:text-[2.25rem]">
                학습 루틴이 무너지지 않도록
                <br />
                운영 구조까지 설계했습니다
              </h3>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {[
                  '입실 기록',
                  '공부시간 확인',
                  '실행 데이터 누적',
                  '수능 국어 수업 별도 선택',
                ].map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex rounded-full border border-[#14295F]/10 bg-white px-3.5 py-2 text-[12px] font-extrabold tracking-[-0.02em] text-[#14295F] shadow-[0_10px_20px_rgba(20,41,95,0.06)]"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
              <p className="mt-4 max-w-2xl break-keep text-[15px] font-semibold leading-[1.82] text-slate-600">
                좌석만 제공하는 공간이 아니라, 공부 흐름이 끊기지 않도록 운영 구조까지 설계한 관리형 스터디센터입니다.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="marketing-card-soft p-4">
                  <p className="text-[10px] font-black tracking-[0.16em] text-[#14295F]/46">운영</p>
                  <p className="mt-2 text-lg font-black text-[#14295F]">매일 08:30 ~ 익일 01:30</p>
                  <p className="mt-2 text-xs font-medium leading-[1.72] text-slate-600">거의 연중무휴 흐름으로 학습 루틴을 끊기지 않게 운영합니다.</p>
                </div>
                <div className="marketing-card-warm p-4">
                  <p className="text-[10px] font-black tracking-[0.16em] text-[#B85A00]/58">실전 점검</p>
                  <p className="mt-2 text-lg font-black text-[#14295F]">이감 · 더프 상시 진행</p>
                  <p className="mt-2 text-xs font-medium leading-[1.72] text-slate-600">실전 감각과 현재 위치를 정기적으로 점검합니다.</p>
                </div>
                <div className="marketing-card-soft p-4">
                  <p className="text-[10px] font-black tracking-[0.16em] text-[#14295F]/46">등록 구조</p>
                  <p className="mt-2 text-lg font-black text-[#14295F]">센터 단독 / 수업 별도 선택</p>
                  <p className="mt-2 text-xs font-medium leading-[1.72] text-slate-600">재학생과 N수생 모두 상황에 맞게 유연하게 시작할 수 있습니다.</p>
                </div>
              </div>
            </div>
          </article>

          <article className="marketing-card-soft p-6 sm:p-7">
            <p className="text-[11px] font-black tracking-[0.18em] text-[#FF7A16]">TRACK STANDARD</p>
            <div className="mt-4 space-y-4">
              {[
                '관리형 스터디센터는 학습 환경 제공을 넘어 루틴과 실행 흐름을 운영하는 서비스입니다.',
                '국어 입시학원 수업은 별도 선택 프로그램으로, 학생 상황에 맞게 분리 이용이 가능합니다.',
                '학생은 입실, 학습량, 실행률, 피드백 흐름을 한 구조 안에서 이어가고, 학부모는 앱으로 과정을 확인할 수 있습니다.',
              ].map((copy, index) => (
                <div key={copy} className="flex gap-3 rounded-[1.35rem] border border-[#14295F]/10 bg-white px-4 py-4 shadow-sm">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#14295F] text-xs font-black text-white shadow-[0_8px_14px_rgba(20,41,95,0.2)]">
                    {index + 1}
                  </div>
                  <p className="break-keep text-sm font-semibold leading-[1.72] text-slate-600">{copy}</p>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="marketing-card-soft mt-8 p-4 sm:p-5">
          <p className="inline-flex items-center gap-2 text-sm font-black text-[#14295F]">
            <ShieldCheck className="h-4 w-4 text-[#FF7A16]" />
            운영 안내
          </p>
          <div className="mt-3 grid gap-2 text-sm font-bold text-slate-700 sm:grid-cols-2">
            <p className="rounded-lg border border-[#14295F]/10 bg-white px-3 py-2">관리형 스터디센터는 학습 환경 제공을 넘어 루틴과 실행 흐름을 운영하는 서비스입니다.</p>
            <p className="rounded-lg border border-[#14295F]/10 bg-white px-3 py-2">국어 입시학원 수업은 별도 선택 프로그램으로, 학생 상황에 맞게 분리 이용이 가능합니다.</p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {premiumHighlights.map((item) => (
            <article key={item.title} className={item.warm ? 'marketing-card-warm p-5' : 'marketing-card p-5'}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black tracking-[0.18em] text-[#FF7A16]">{item.eyebrow}</p>
                  <h3 className="mt-3 break-keep text-2xl font-black tracking-tight text-[#14295F]">{item.title}</h3>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 shadow-sm ring-1 ring-white/70">
                  {item.icon}
                </div>
              </div>
              <p className="mt-4 break-keep text-sm font-medium leading-[1.72] text-slate-600">{item.description}</p>
              {'note' in item && item.note ? (
                <p className="mt-3 text-[11px] font-black text-[#B85A00]/78">{item.note}</p>
              ) : null}
            </article>
          ))}
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            {studyCafe.features.map((item) => (
              <article key={item.title} className="marketing-card-soft p-5">
                <p className="inline-flex items-center gap-2 text-xs font-black tracking-[0.08em] text-[#FF7A16]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  TRACK STANDARD
                </p>
                <h3 className="mt-2 break-keep text-xl font-black text-[#14295F]">{item.title}</h3>
                <p className="mt-2 break-keep text-sm font-medium leading-[1.72] text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>

          <div className="marketing-card-soft p-6">
            <p className="text-xs font-black tracking-[0.18em] text-[#FF7A16]">PREMIUM SEAT & FLOW</p>
            <h3 className="font-brand mt-3 break-keep text-2xl text-[#14295F]">몰입을 높이는 좌석과 운영 구조</h3>

            <div className="mt-5 space-y-4">
              {studyCafe.seatTypes.map((seat) => (
                <article key={seat.title} className="marketing-card p-4">
                  <h4 className="text-lg font-black text-[#14295F]">{seat.title}</h4>
                  <p className="mt-2 break-keep text-sm font-medium leading-[1.72] text-slate-600">{seat.description}</p>
                </article>
              ))}
            </div>

            <div className="marketing-card mt-5 p-4">
              <p className="text-sm font-black text-[#14295F]">이용 구조</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex rounded-full border border-[#14295F]/10 bg-[#F7FAFF] px-3 py-1.5 text-xs font-black text-[#14295F]">
                  관리형 스터디센터 단독 등록 가능
                </span>
                <span className="inline-flex rounded-full border border-[#FF7A16]/15 bg-[#FFF5EC] px-3 py-1.5 text-xs font-black text-[#B85A00]">
                  수능 국어 그룹 수업 별도 선택
                </span>
                <span className="inline-flex rounded-full border border-[#14295F]/10 bg-[#F7FAFF] px-3 py-1.5 text-xs font-black text-[#14295F]">
                  재학생 · N수생 모두 등록 가능
                </span>
              </div>
              <p className="mt-3 break-keep text-sm font-medium leading-[1.72] text-slate-600">
                학생 상황에 따라 관리형 스터디센터만 먼저 시작하거나, 수능 국어 그룹 수업을 함께 선택하는 구조로 유연하게 안내합니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
