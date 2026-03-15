'use client';

import { ArrowRight, Smartphone, Users } from 'lucide-react';

import { StaggerChildren } from './stagger-children';

const studentHighlights = ['루틴 확인', '공부 시간 기록', '성장 흐름'];
const parentHighlights = ['실시간 출결', '학습 리포트', '알림 · 상담'];

export function AppPreviewSection() {
  return (
    <section
      id="app"
      className="scroll-mt-20 py-12 sm:py-16"
      style={{ background: 'linear-gradient(180deg, #edf1fb 0%, #ffffff 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mx-auto max-w-xl text-center">
          <span className="eyebrow-badge">WEBAPP</span>
          <h2 className="font-aggro-display mt-3 break-keep text-[clamp(1.75rem,3.5vw,2.5rem)] font-black leading-[1.1] text-[#14295F]">
            웹앱으로
            <br />
            직접 확인해보세요
          </h2>
          <p className="mt-3 break-keep text-[14px] font-bold leading-[1.7] text-[#384f6a]">
            학생은 루틴과 기록을 확인하고,
            <br />
            학부모는 출결과 학습 흐름을 확인합니다.
          </p>
        </div>

        {/* Two cards */}
        <StaggerChildren stagger={120} className="mt-9 grid gap-5 lg:grid-cols-2">
          {/* Student card */}
          <article className="overflow-hidden rounded-[1.4rem] border border-[rgba(20,41,95,0.12)] bg-white transition-all duration-300 hover:border-[rgba(20,41,95,0.22)] hover:shadow-lg hover:shadow-[#14295F]/6">
            <div className="p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#14295F]/40">
                Student Mode
              </p>
              <h3 className="mt-1.5 text-[1.25rem] font-black text-[#14295F]">학생 모드</h3>
              <p className="mt-2 break-keep text-[13.5px] font-semibold leading-[1.72] text-slate-500">
                루틴, 기록, 누적 흐름을
                <br />
                학생 화면에서 바로 확인합니다.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {studentHighlights.map((h) => (
                  <span
                    key={h}
                    className="rounded-lg bg-[#14295F]/6 px-3 py-1 text-[11.5px] font-black text-[#14295F]/70"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
            {/* Footer bar */}
            <div className="flex items-center justify-between border-t border-[rgba(20,41,95,0.07)] bg-[#14295F]/3 px-6 py-4">
              <a
                href="/go/experience?placement=app_student&mode=student&view=mobile"
                className="inline-flex items-center gap-2 text-[13px] font-black text-[#14295F] transition-all duration-200 hover:gap-3"
              >
                학생 화면 체험하기
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#14295F]/8">
                <Smartphone className="h-3.5 w-3.5 text-[#14295F]/45" />
              </div>
            </div>
          </article>

          {/* Parent card */}
          <article className="overflow-hidden rounded-[1.4rem] border border-[rgba(255,122,22,0.16)] bg-white transition-all duration-300 hover:border-[rgba(255,122,22,0.32)] hover:shadow-lg hover:shadow-[#FF7A16]/8">
            <div className="p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF7A16]/60">
                Parent Mode
              </p>
              <h3 className="mt-1.5 text-[1.25rem] font-black text-[#14295F]">학부모 모드</h3>
              <p className="mt-2 break-keep text-[13.5px] font-semibold leading-[1.72] text-slate-500">
                출결, 학습 현황, 상담 흐름을
                <br />
                학부모 화면에서 확인합니다.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {parentHighlights.map((h) => (
                  <span
                    key={h}
                    className="rounded-lg bg-[#FF7A16]/8 px-3 py-1 text-[11.5px] font-black text-[#FF7A16]/75"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
            {/* Footer bar */}
            <div className="flex items-center justify-between border-t border-[rgba(255,122,22,0.1)] bg-[#FF7A16]/3 px-6 py-4">
              <span className="inline-flex items-center gap-2 text-[13px] font-black text-[#FF7A16]/75">
                학부모 기능 안내
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FF7A16]/10">
                <Users className="h-3.5 w-3.5 text-[#FF7A16]/55" />
              </div>
            </div>
          </article>
        </StaggerChildren>

        {/* Footer note */}
        <p className="mt-5 text-center text-[12px] font-bold text-slate-400">
          로그인 없이 데모 화면을 체험할 수 있습니다.
        </p>
      </div>
    </section>
  );
}
