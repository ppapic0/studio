import { ArrowRight, GraduationCap, Smartphone } from 'lucide-react';

import { StaggerChildren } from './stagger-children';

const studentFeatures = [
  { label: '오늘의 공부 목표 확인', desc: '일과 계획을 매일 같은 형식으로 확인합니다' },
  { label: '누적 공부 시간 기록', desc: '입실부터 퇴실까지 자동으로 기록됩니다' },
  { label: '성장 데이터 흐름', desc: 'LP와 실행 지표로 변화를 숫자로 확인합니다' },
];

const parentFeatures = [
  { label: '실시간 출결 확인', desc: '자녀의 입실과 퇴실을 앱에서 바로 확인합니다' },
  { label: '학습 리포트 열람', desc: '선생님이 작성한 피드백과 변화 흐름을 확인합니다' },
  { label: '알림 및 수납 흐름', desc: '상담, 알림, 수납 상태가 하나의 화면에서 연결됩니다' },
];

export function AppPreviewSection() {
  return (
    <section id="app" className="scroll-mt-20 py-20 sm:py-28" style={{ background: 'linear-gradient(180deg, #f2f6ff 0%, #edf1fb 100%)' }}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section heading */}
        <div className="mx-auto max-w-lg text-center">
          <span className="eyebrow-badge">APP SYSTEM</span>
          <h2 className="font-aggro-display mt-4 break-keep text-[clamp(1.9rem,3.9vw,2.8rem)] font-black leading-[1.08] text-[#14295F]">
            학생과 학부모가
            <br />
            각자의 화면을 갖습니다
          </h2>
          <p className="mt-4 break-keep text-[15px] font-bold leading-[1.78] text-[#384f6a]">
            관리는 보여주는 것이 아니라 확인 가능한 것이어야 합니다.
          </p>
        </div>

        {/* Two-panel preview */}
        <StaggerChildren stagger={150} className="mt-14 grid gap-5 lg:grid-cols-2">
          {/* Student panel */}
          <article className="overflow-hidden rounded-[1.4rem] border border-[rgba(20,41,95,0.1)] bg-white">
            {/* Header bar */}
            <div className="flex items-center gap-3 bg-[#14295F] px-6 py-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/12">
                <Smartphone className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/45">
                  Student Mode
                </p>
                <p className="text-[15px] font-black text-white">학생 화면</p>
              </div>
            </div>

            {/* Feature list */}
            <div className="space-y-3 p-6">
              {studentFeatures.map((f, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 rounded-xl border border-[#14295F]/7 bg-[#14295F]/3 px-4 py-3.5"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#14295F]/10 text-[10px] font-black text-[#14295F]/50">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[14px] font-black text-[#14295F]">{f.label}</p>
                    <p className="mt-0.5 text-[12px] font-semibold text-slate-500">{f.desc}</p>
                  </div>
                </div>
              ))}

              <a
                href="/go/experience?placement=app_student&mode=student&view=mobile"
                className="mt-2 inline-flex items-center gap-2 text-[13px] font-black text-[#14295F] transition-opacity hover:opacity-65"
              >
                학생 화면 체험하기
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </article>

          {/* Parent panel */}
          <article className="overflow-hidden rounded-[1.4rem] border border-[rgba(255,122,22,0.14)] bg-white">
            {/* Header bar */}
            <div className="flex items-center gap-3 bg-[#FF7A16] px-6 py-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
                  Parent Mode
                </p>
                <p className="text-[15px] font-black text-white">학부모 화면</p>
              </div>
            </div>

            {/* Feature list */}
            <div className="space-y-3 p-6">
              {parentFeatures.map((f, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 rounded-xl border border-[#FF7A16]/10 bg-[#FF7A16]/4 px-4 py-3.5"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF7A16]/12 text-[10px] font-black text-[#D45E00]/55">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[14px] font-black text-[#14295F]">{f.label}</p>
                    <p className="mt-0.5 text-[12px] font-semibold text-slate-500">{f.desc}</p>
                  </div>
                </div>
              ))}

              <a
                href="/go/experience?placement=app_parent&mode=parent"
                className="mt-2 inline-flex items-center gap-2 text-[13px] font-black text-[#FF7A16] transition-opacity hover:opacity-65"
              >
                학부모 화면 체험하기
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </article>
        </StaggerChildren>
      </div>
    </section>
  );
}
