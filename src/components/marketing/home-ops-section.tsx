import { ArrowRight, CalendarDays, ClipboardCheck, ShieldCheck, Wifi } from 'lucide-react';

import { SectionHeading } from './section-heading';

const firewallHighlights = [
  '학습 시간에는 필요한 학습 사이트만 열어 집중 흐름을 유지합니다.',
  '영상, 게임, SNS처럼 흔들리는 경로는 와이파이에서 먼저 정리합니다.',
  '학생마다 필요한 허용 목록만 남겨 억지 통제가 아니라 공부 몰입 환경을 만듭니다.',
] as const;

const mockExamFlow = [
  {
    step: '01',
    title: '월간 모의고사 운영',
    detail: '더프, 사설, 자체 점검 일정을 기준에 맞게 체계적으로 운영합니다.',
  },
  {
    step: '02',
    title: '실전처럼 응시 환경 구성',
    detail: '좌석 배치, 시작 시각, 시험 종료까지 실제 시험 루틴에 맞춥니다.',
  },
  {
    step: '03',
    title: '결과 입력 후 상담 진행',
    detail: '성적과 체감 난도를 기록한 뒤 바로 상담으로 이어 철저하게 점검합니다.',
  },
] as const;

const supportChips = ['집중 와이파이 환경', '실전 모의고사 운영', '결과 입력 후 상담'] as const;

export function HomeOpsSection() {
  return (
    <section
      className="relative overflow-hidden py-16 sm:py-20"
      style={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FBFF 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="brand-glow-drift absolute left-[-5%] top-[18%] h-56 w-56 rounded-full bg-[#8CB7FF]/10 blur-[110px]" />
        <div
          className="brand-glow-drift absolute right-[-4%] top-[12%] h-64 w-64 rounded-full bg-[#FFB878]/14 blur-[120px]"
          style={{ animationDelay: '-2.2s' }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center [&_.eyebrow-badge]:mx-auto">
          <SectionHeading
            eyebrow="FOCUS OPERATIONS"
            title="집중 환경과 실전 운영도 함께 설계합니다"
            description="트랙은 공부 기록만 보는 곳이 아니라, 방해를 줄이는 환경 설계와 모의고사 운영까지 한 흐름으로 연결합니다."
          />
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <article className="brand-sheen-panel relative overflow-hidden rounded-[2rem] border border-[#14295F]/10 bg-[#14295F] p-6 text-white shadow-[0_24px_48px_rgba(20,41,95,0.18)] sm:p-7">
            <div className="brand-glow-drift absolute -right-8 top-0 h-28 w-28 rounded-full bg-[#FFB878]/16 blur-3xl" />
            <div className="brand-glow-drift absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-white/10 blur-3xl" />

            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] bg-white/10 text-white">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black tracking-[0.18em] text-white/58">와이파이 방화벽</p>
                    <h3 className="mt-1 break-keep text-[1.18rem] font-black leading-[1.35] text-white sm:text-[1.35rem]">
                      공부 시간에는 필요한 연결만 남깁니다
                    </h3>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center rounded-full border border-white/18 bg-white/10 px-3 py-1 text-[10px] font-black tracking-[0.12em] text-white/78">
                  FOCUS
                </span>
              </div>

              <p className="mt-5 break-keep text-[14px] font-semibold leading-[1.85] text-white/80">
                학생이 흔들리는 지점을 무조건 통제하기보다, 자습 시간이 시작되면 공부에 필요한 연결만 남도록 집중 환경을 먼저 정리합니다.
              </p>

              <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/6 p-4 backdrop-blur-[1px]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-white/78">
                    <Wifi className="h-4 w-4" />
                    <span className="text-[11px] font-black">네트워크 집중 모드</span>
                  </div>
                  <span className="rounded-full bg-[#FF7A16] px-3 py-1 text-[10px] font-black text-white">자습 시간 연동</span>
                </div>

                <div className="mt-4 space-y-3">
                  {firewallHighlights.map((item, index) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-[1rem] border border-white/8 bg-white/5 px-3 py-3"
                    >
                      <span className="mt-[2px] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/14 text-[10px] font-black text-white">
                        {index + 1}
                      </span>
                      <p className="break-keep text-[12.5px] font-semibold leading-[1.7] text-white/78">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article className="brand-sheen-panel relative overflow-hidden rounded-[2rem] border border-[#14295F]/10 bg-white p-6 shadow-[0_22px_46px_rgba(20,41,95,0.10)] sm:p-7">
            <div className="brand-glow-drift absolute -left-8 top-5 h-24 w-24 rounded-full bg-[#FFB878]/12 blur-3xl" />
            <div
              className="brand-glow-drift absolute right-4 top-0 h-28 w-28 rounded-full bg-[#8CB7FF]/10 blur-3xl"
              style={{ animationDelay: '-1.7s' }}
            />

            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] bg-[#FFF3E8] text-[#FF7A16]">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">모의고사 운영</p>
                    <h3 className="mt-1 break-keep text-[1.18rem] font-black leading-[1.35] text-[#14295F] sm:text-[1.35rem]">
                      시험 전부터 결과 피드백까지 한 번에 연결합니다
                    </h3>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center rounded-full border border-[#14295F]/10 bg-[#F7FAFF] px-3 py-1 text-[10px] font-black tracking-[0.12em] text-[#14295F]/70">
                  REAL TEST
                </span>
              </div>

              <p className="mt-5 break-keep text-[14px] font-semibold leading-[1.85] text-[#425A75]">
                더프, 사설, 자체 점검까지 시험 일정부터 결과 입력, 상담 진행까지 끊기지 않도록 운영합니다. 시험이 끝난 뒤에도 학생별 상태를 체계적으로, 철저히 관리합니다.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {mockExamFlow.map((item) => (
                  <article
                    key={item.step}
                    className="brand-sheen-panel rounded-[1.25rem] border border-[#14295F]/8 bg-[linear-gradient(180deg,#F9FBFF_0%,#FFFFFF_100%)] px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black tracking-[0.16em] text-[#FF7A16]">{item.step}</span>
                      <ClipboardCheck className="h-4 w-4 text-[#14295F]/38" />
                    </div>
                    <p className="mt-3 break-keep text-[0.97rem] font-black leading-[1.42] text-[#14295F]">{item.title}</p>
                    <p className="mt-2 break-keep text-[12.5px] font-semibold leading-[1.7] text-[#53687F]">{item.detail}</p>
                  </article>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2.5">
                {supportChips.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-full border border-[#14295F]/10 bg-[#F8FBFF] px-3 py-1.5 text-[11px] font-black text-[#14295F]/82"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-6 flex items-center gap-2 text-[12px] font-black text-[#14295F]">
                <ArrowRight className="h-4 w-4" />
                모의고사는 결과 입력 후 상담까지 체계적으로, 철저히 관리합니다.
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
