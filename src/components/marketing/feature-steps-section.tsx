import { StaggerChildren } from './stagger-children';

const steps = [
  {
    num: '01',
    tag: '루틴 설계',
    heading: '매일 같은 흐름으로\n공부 구조를 만듭니다',
    body: '입실 시간, 공부 흐름, 쉬는 구간까지 구조화된 일과를 운영합니다. 좌석 제공이 아닌 루틴 완성이 목표입니다.',
    accent: { label: '운영 시작', value: '매일 오전 8:30' },
    dark: false,
  },
  {
    num: '02',
    tag: '데이터 기반 관리',
    heading: '기록이 쌓이고\n데이터로 확인됩니다',
    body: '출입 기록, 공부 시간, 실행 상태가 자동으로 연결됩니다. 학생과 학부모가 각자의 화면에서 루틴 흐름을 확인합니다.',
    accent: { label: '실시간 연결', value: '출결 · 공부시간 · 실행률' },
    dark: false,
  },
  {
    num: '03',
    tag: '수업 선택형 구조',
    heading: '국어 수업은\n필요할 때 선택합니다',
    body: '센터 이용과 수업은 분리되어 있습니다. 재학생·N수생 모두 등록 가능하며, 수능 국어 수업은 별도로 추가할 수 있습니다.',
    accent: { label: '등록 가능', value: '재학생 · N수생' },
    dark: true,
  },
];

export function FeatureStepsSection() {
  return (
    <section id="features" className="scroll-mt-20 py-20 sm:py-28" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f2f6ff 100%)' }}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <div className="mx-auto max-w-lg text-center">
          <span className="eyebrow-badge">HOW WE WORK</span>
          <h2 className="font-aggro-display mt-4 break-keep text-[clamp(1.9rem,3.9vw,2.8rem)] font-black leading-[1.08] text-[#14295F]">
            트랙이 다른 이유는
            <br />
            구조에 있습니다
          </h2>
          <p className="mt-4 break-keep text-[15px] font-bold leading-[1.78] text-[#384f6a]">
            공간을 제공하는 것이 아니라, 루틴을 설계하고 데이터로 관리합니다.
          </p>
        </div>

        {/* Steps — stagger on scroll */}
        <StaggerChildren stagger={130} className="mt-14 grid gap-5 sm:grid-cols-3">
          {steps.map((step) => (
            <article
              key={step.num}
              className={`flex flex-col rounded-[1.4rem] border p-7 ${
                step.dark
                  ? 'border-[#0c1d47] bg-[#14295F] text-white'
                  : 'border-[rgba(20,41,95,0.1)] bg-white'
              }`}
            >
              {/* Step number + tag */}
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-lg px-2.5 py-1 text-[10.5px] font-black tracking-[0.14em] ${
                    step.dark ? 'bg-white/12 text-white/60' : 'bg-[#14295F]/6 text-[#14295F]/55'
                  }`}
                >
                  STEP {step.num}
                </span>
                <span
                  className={`text-[2.2rem] font-black leading-none ${
                    step.dark ? 'text-white/10' : 'text-[#14295F]/8'
                  }`}
                >
                  {step.num}
                </span>
              </div>

              {/* Tag + Heading */}
              <p
                className={`mt-6 text-[11px] font-black tracking-[0.18em] uppercase ${
                  step.dark ? 'text-[#FF9848]' : 'text-[#FF7A16]'
                }`}
              >
                {step.tag}
              </p>
              <h3
                className={`mt-2 whitespace-pre-line break-keep text-[1.2rem] font-black leading-[1.28] ${
                  step.dark ? 'text-white' : 'text-[#14295F]'
                }`}
              >
                {step.heading}
              </h3>
              <p
                className={`mt-3 flex-1 break-keep text-[13.5px] font-semibold leading-[1.74] ${
                  step.dark ? 'text-blue-100/58' : 'text-slate-500'
                }`}
              >
                {step.body}
              </p>

              {/* Accent stat */}
              <div
                className={`mt-6 rounded-xl border px-4 py-3 ${
                  step.dark
                    ? 'border-white/12 bg-white/7'
                    : 'border-[#14295F]/8 bg-[#14295F]/4'
                }`}
              >
                <p
                  className={`text-[13px] font-black ${
                    step.dark ? 'text-white' : 'text-[#14295F]'
                  }`}
                >
                  {step.accent.value}
                </p>
                <p
                  className={`mt-0.5 text-[11px] font-semibold ${
                    step.dark ? 'text-white/42' : 'text-slate-400'
                  }`}
                >
                  {step.accent.label}
                </p>
              </div>
            </article>
          ))}
        </StaggerChildren>
      </div>
    </section>
  );
}
