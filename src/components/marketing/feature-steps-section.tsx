'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/* ─── Student mini-preview ────────────────────────────────────────────────── */
function StudentPreview() {
  return (
    <div className="w-full rounded-xl overflow-hidden bg-white border border-slate-200/70 shadow-sm select-none pointer-events-none">
      {/* Orange hero */}
      <div className="bg-gradient-to-br from-[#FF7A16] to-[#e8700e] px-3.5 pt-3 pb-3">
        <div className="text-[6px] font-black text-white/65 uppercase tracking-widest">브론즈 TIER ACTIVE</div>
        <div className="mt-0.5 text-[10px] font-black text-white leading-[1.3]">
          오늘의 성장을 위해<br />트랙을 시작하세요
        </div>
        <div className="mt-2 bg-white rounded-md py-1.5 text-center text-[8px] font-black text-[#FF7A16]">
          트랙 시작 ▶
        </div>
        <div className="mt-1.5 border border-white/20 rounded-md py-1 text-center text-[7.5px] font-black text-white/80">
          나의 출입 QR
        </div>
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-1.5 p-2">
        <div className="bg-slate-50 rounded-lg px-2 py-1.5">
          <div className="text-[6px] font-black text-slate-400 uppercase">오늘 누적 트랙</div>
          <div className="text-[11px] font-black text-[#14295F] mt-0.5 tabular-nums">
            1<span className="text-[7px]">h</span> 36<span className="text-[7px]">m</span>
          </div>
          <div className="text-[6px] text-[#14295F]/40 font-black mt-0.5">세션 보기 ›</div>
        </div>
        <div className="bg-[#fff7ed] rounded-lg px-2 py-1.5">
          <div className="text-[6px] font-black text-[#FF7A16] uppercase">시즌 러닝 LP</div>
          <div className="text-[11px] font-black text-[#FF7A16] mt-0.5 tabular-nums">3,164</div>
          <div className="text-[6px] text-[#FF7A16]/50 font-black mt-0.5">히스토리 분석 ›</div>
        </div>
      </div>
      {/* Plan row */}
      <div className="px-2 pb-1.5">
        <div className="bg-slate-50 rounded-lg px-2 py-1.5 flex items-center justify-between">
          <span className="text-[7.5px] font-black text-[#14295F]">계획트랙</span>
          <span className="text-[6.5px] font-black text-white bg-emerald-500 px-1.5 py-0.5 rounded">1 DONE</span>
        </div>
      </div>
      {/* Bottom nav */}
      <div className="bg-[#14295F] px-2 py-1.5 flex justify-around">
        {[['홈', true], ['성장', false], ['기록', false], ['계획', false], ['상담', false]].map(([nav, active]) => (
          <div key={nav as string} className={`text-[6px] font-black ${active ? 'text-[#FF7A16]' : 'text-white/40'}`}>
            {nav as string}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Parent mini-preview ─────────────────────────────────────────────────── */
function ParentPreview() {
  const bars = [45, 72, 58, 88, 66, 30, 18];
  const days = ['월', '화', '수', '목', '금', '토', '일'];
  return (
    <div className="w-full rounded-xl overflow-hidden bg-white border border-slate-200/70 shadow-sm select-none pointer-events-none">
      {/* Header */}
      <div className="bg-white px-3 pt-2.5 pb-1.5 border-b border-slate-100">
        <div className="text-[9px] font-black text-[#14295F]">김재윤 학생 현황</div>
        <div className="text-[6px] font-bold text-[#FF7A16]">● 실시간 업데이트 중</div>
      </div>
      {/* 2×2 KPI */}
      <div className="grid grid-cols-2 gap-1.5 p-2">
        <div className="bg-slate-50 rounded-lg px-2 py-1.5">
          <div className="text-[6px] font-black text-slate-400 uppercase">오늘 공부</div>
          <div className="text-[11px] font-black text-[#14295F] mt-0.5 tabular-nums">1h 36m</div>
        </div>
        <div className="bg-[#fff7ed] rounded-lg px-2 py-1.5">
          <div className="text-[6px] font-black text-[#FF7A16] uppercase">계획 달성</div>
          <div className="text-[11px] font-black text-[#14295F] mt-0.5 tabular-nums">82%</div>
        </div>
        <div className="bg-emerald-50 rounded-lg px-2 py-1.5">
          <div className="text-[6px] font-black text-emerald-600 uppercase">출결 상태</div>
          <div className="text-[9.5px] font-black text-emerald-700 mt-0.5">정상 출석</div>
        </div>
        <div className="bg-slate-50 rounded-lg px-2 py-1.5">
          <div className="text-[6px] font-black text-slate-400 uppercase">주간 누적</div>
          <div className="text-[11px] font-black text-[#14295F] mt-0.5 tabular-nums">14h 20m</div>
        </div>
      </div>
      {/* Weekly bars */}
      <div className="px-2 pb-2">
        <div className="text-[6px] font-black text-slate-400 mb-1 uppercase tracking-widest">주간 누적 트랙</div>
        <div className="flex items-end gap-1 h-8">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm"
              style={{
                height: `${h}%`,
                background: i === 3 ? '#FF7A16' : '#14295F',
                opacity: i === 3 ? 1 : 0.15 + (h / 100) * 0.5,
              }}
            />
          ))}
        </div>
        <div className="flex gap-1 mt-0.5">
          {days.map((d, i) => (
            <div key={d} className={`flex-1 text-center text-[5.5px] font-black ${i === 3 ? 'text-[#FF7A16]' : 'text-slate-300'}`}>{d}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Section ─────────────────────────────────────────────────────────────── */
export function FeatureStepsSection() {
  return (
    <section
      id="features"
      className="scroll-mt-20 py-12 sm:py-16"
      style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f2f6ff 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
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

        {/* 2×2 grid */}
        <div className="mt-9 grid gap-4 sm:grid-cols-2">

          {/* ── Card 01: 관리형 스터디센터 ── */}
          <Link
            href="/#consult"
            className="group flex flex-col rounded-[1.25rem] border border-[rgba(20,41,95,0.1)] bg-white p-5 transition-all duration-200 hover:border-[rgba(20,41,95,0.22)] hover:shadow-md hover:shadow-[#14295F]/8 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14295F]/40 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-lg px-2.5 py-1 text-[10.5px] font-black tracking-[0.14em] bg-[#14295F]/6 text-[#14295F]/55">
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
            <div className="mt-4 rounded-xl border border-[#14295F]/8 bg-[#14295F]/4 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-black text-[#14295F]">매일 오전 8:30</p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-400">운영 시작</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[#14295F]/30 group-hover:text-[#14295F]/60 group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>

          {/* ── Card 02: 국어 수업 선택형 ── dark */}
          <Link
            href="/class"
            className="group flex flex-col rounded-[1.25rem] border border-[#0c1d47] bg-[#14295F] p-5 text-white transition-all duration-200 hover:shadow-md hover:shadow-[#14295F]/30 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-lg px-2.5 py-1 text-[10.5px] font-black tracking-[0.14em] bg-white/15 text-white/70">
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
            <div className="mt-4 rounded-xl border border-white/15 bg-white/10 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-black text-white">재학생 · N수생</p>
                <p className="mt-0.5 text-[11px] font-semibold text-white/55">등록 가능</p>
              </div>
              <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>

          {/* ── Card 03: 학생 모드 preview ── */}
          <Link
            href="/go/experience?placement=feature_card&mode=student&view=mobile"
            className="group flex flex-col rounded-[1.25rem] border border-[rgba(20,41,95,0.1)] bg-white overflow-hidden transition-all duration-200 hover:border-[rgba(255,122,22,0.28)] hover:shadow-lg hover:shadow-[#FF7A16]/8 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A16]/30 cursor-pointer"
          >
            {/* Preview frame */}
            <div className="px-4 pt-4 pb-0">
              <StudentPreview />
            </div>
            {/* Text */}
            <div className="p-5 pt-4 flex flex-col flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#14295F]/40">
                Student Mode
              </p>
              <h3 className="mt-1 text-[1.2rem] font-black text-[#14295F]">학생 모드</h3>
              <p className="mt-1.5 break-keep text-[13px] font-semibold leading-[1.68] text-slate-500">
                공부습관, 누적 흐름을 학생 화면에서 바로 확인합니다.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['오늘의 루틴', '누적 기록', '날짜별 캘린더'].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-md bg-[#14295F]/5 px-2.5 py-1 text-[11px] font-black text-[#14295F]/65"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <div className="mt-auto pt-4 flex items-center justify-between">
                <span className="text-[12.5px] font-black text-[#14295F] group-hover:text-[#FF7A16] transition-colors">
                  학생 화면 체험하기
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-[#14295F]/35 group-hover:text-[#FF7A16] group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </Link>

          {/* ── Card 04: 학부모 모드 preview ── */}
          <Link
            href="/go/experience?placement=feature_card&mode=parent"
            className="group flex flex-col rounded-[1.25rem] border border-[rgba(255,122,22,0.14)] bg-white overflow-hidden transition-all duration-200 hover:border-[rgba(255,122,22,0.32)] hover:shadow-lg hover:shadow-[#FF7A16]/8 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A16]/30 cursor-pointer"
          >
            {/* Preview frame */}
            <div className="px-4 pt-4 pb-0">
              <ParentPreview />
            </div>
            {/* Text */}
            <div className="p-5 pt-4 flex flex-col flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF7A16]/55">
                Parent Mode
              </p>
              <h3 className="mt-1 text-[1.2rem] font-black text-[#14295F]">학부모 모드</h3>
              <p className="mt-1.5 break-keep text-[13px] font-semibold leading-[1.68] text-slate-500">
                출결, 학습 현황, 주간 누적 트랙을 학부모 화면에서 확인합니다.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['학생 현황', '주간 누적 트랙', '학습 기록 확인'].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-md bg-[#FF7A16]/8 px-2.5 py-1 text-[11px] font-black text-[#FF7A16]/75"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <div className="mt-auto pt-4 flex items-center justify-between">
                <span className="text-[12.5px] font-black text-[#FF7A16]/80 group-hover:text-[#FF7A16] transition-colors">
                  학부모 기능 안내
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-[#FF7A16]/45 group-hover:text-[#FF7A16] group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </Link>

        </div>
      </div>
    </section>
  );
}
