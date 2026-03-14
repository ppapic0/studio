import { CheckCircle2, Clock3, GraduationCap, ShieldCheck } from 'lucide-react';

import type { MarketingContent } from '@/lib/marketing-content';

import { SectionHeading } from './section-heading';

type StudyCafeSectionProps = {
  studyCafe: MarketingContent['studyCafe'];
};

const brochureBlocks = [
  {
    eyebrow: 'OPERATING HOURS',
    title: '매일 08:30 ~ 익일 01:30',
    body: '센터는 거의 연중무휴 흐름으로 운영하고, 학원은 매일 오후 10시에 종료합니다.',
    note: '',
    icon: Clock3,
    warm: false,
  },
  {
    eyebrow: 'MOCK EXAM',
    title: '이감 · 더프 상시 진행',
    body: '실전 감각과 현재 위치를 주기적으로 확인합니다.',
    note: '이감모의고사와 더프 모의고사는 별도 구매입니다.',
    icon: CheckCircle2,
    warm: true,
  },
  {
    eyebrow: 'REGISTRATION',
    title: '센터 단독 / 수업 별도 선택',
    body: '관리형 스터디센터만 먼저 시작할 수 있고, 수능 국어 그룹 수업은 필요할 때 선택합니다.',
    note: '재학생 · N수생 모두 등록 가능',
    icon: GraduationCap,
    warm: false,
  },
];

export function StudyCafeSection({ studyCafe }: StudyCafeSectionProps) {
  return (
    <section id="study-cafe" className="scroll-mt-28 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFF_100%)] py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Managed Study Center" title={studyCafe.heading} description={studyCafe.description} />

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="marketing-card relative overflow-hidden p-6 sm:p-7">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(20,41,95,0.08),transparent_28%),radial-gradient(circle_at_88%_18%,rgba(255,122,22,0.15),transparent_24%),linear-gradient(125deg,transparent_0%,transparent_48%,rgba(20,41,95,0.035)_48%,rgba(20,41,95,0.035)_49%,transparent_49%)]" />
            <div className="relative">
              <p className="text-[11px] font-black tracking-[0.22em] text-[#FF7A16]">BROCHURE STATEMENT</p>
              <h3 className="mt-4 max-w-2xl break-keep text-[2.1rem] font-black leading-[1.04] tracking-[-0.04em] text-[#14295F] sm:text-[2.8rem]">
                공간보다 먼저,
                <br />
                루틴이 보이게 만듭니다
              </h3>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {['입실 기록', '공부시간 확인', '실행 데이터 연결', '학부모 앱 확인'].map((keyword, index) => (
                  <div
                    key={keyword}
                    className={index % 2 === 0 ? 'marketing-card-soft px-4 py-4' : 'marketing-card-warm px-4 py-4'}
                  >
                    <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">KEYWORD</p>
                    <p className="mt-2 text-lg font-black tracking-[-0.03em] text-[#14295F]">{keyword}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[1.5rem] border border-[#14295F]/10 bg-white/90 p-5 shadow-sm">
                <p className="text-sm font-semibold leading-[1.78] text-slate-600">
                  좌석을 채우는 공간이 아니라, 학생의 하루를 흔들림 없이 이어주는 운영 구조가 먼저 보이도록 설계한 관리형 스터디센터입니다.
                </p>
              </div>
            </div>
          </article>

          <div className="grid gap-4">
            {brochureBlocks.map((block) => {
              const Icon = block.icon;
              return (
                <article key={block.title} className={block.warm ? 'marketing-card-warm p-5 sm:p-6' : 'marketing-card-soft p-5 sm:p-6'}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-black tracking-[0.2em] text-[#FF7A16]">{block.eyebrow}</p>
                      <h3 className="mt-3 break-keep text-[1.7rem] font-black leading-[1.08] tracking-[-0.03em] text-[#14295F]">{block.title}</h3>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#FF7A16] shadow-sm ring-1 ring-[#14295F]/8">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  <p className="mt-3 break-keep text-sm font-medium leading-[1.74] text-slate-600">{block.body}</p>
                  {block.note ? <p className="mt-3 text-[11px] font-black text-[#B85A00]/78">{block.note}</p> : null}
                </article>
              );
            })}
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            {studyCafe.features.map((item) => (
              <article key={item.title} className="marketing-card-soft p-5">
                <p className="text-[11px] font-black tracking-[0.16em] text-[#FF7A16]">TRACK STANDARD</p>
                <h3 className="mt-3 break-keep text-[1.35rem] font-extrabold tracking-[-0.03em] text-[#14295F]">{item.title}</h3>
                <p className="mt-2 break-keep text-sm font-medium leading-[1.74] text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>

          <div className="marketing-card p-6">
            <p className="inline-flex items-center gap-2 text-[11px] font-black tracking-[0.18em] text-[#FF7A16]">
              <ShieldCheck className="h-4 w-4" />
              PREMIUM SEAT & FLOW
            </p>
            <h3 className="mt-4 max-w-xl break-keep text-[2rem] font-black leading-[1.06] tracking-[-0.04em] text-[#14295F]">
              몰입을 높이는 좌석과
              <br />
              운영 구조
            </h3>

            <div className="mt-5 space-y-4">
              {studyCafe.seatTypes.map((seat) => (
                <article key={seat.title} className="marketing-card-soft p-4">
                  <h4 className="text-xl font-extrabold tracking-[-0.03em] text-[#14295F]">{seat.title}</h4>
                  <p className="mt-2 break-keep text-sm font-medium leading-[1.72] text-slate-600">{seat.description}</p>
                </article>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex rounded-full border border-[#14295F]/10 bg-[#F7FAFF] px-3 py-1.5 text-xs font-black text-[#14295F]">센터 단독 등록 가능</span>
              <span className="inline-flex rounded-full border border-[#FF7A16]/15 bg-[#FFF5EC] px-3 py-1.5 text-xs font-black text-[#B85A00]">수능 국어 그룹 수업 별도 선택</span>
              <span className="inline-flex rounded-full border border-[#14295F]/10 bg-[#F7FAFF] px-3 py-1.5 text-xs font-black text-[#14295F]">재학생 · N수생 모두 등록 가능</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
