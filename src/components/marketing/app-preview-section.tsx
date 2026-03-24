'use client';

import Link from 'next/link';
import { ArrowRight, Smartphone, Users } from 'lucide-react';

import type { MarketingContent } from '@/lib/marketing-content';

import { StaggerChildren } from './stagger-children';

type AppPreviewSectionProps = {
  appSystem: MarketingContent['appSystem'];
};

function MetricChip({
  label,
  value,
  tone = 'navy',
}: {
  label: string;
  value: string;
  tone?: 'navy' | 'orange' | 'green';
}) {
  const toneMap = {
    navy: 'border-[#14295F]/10 bg-[#F5F8FF] text-[#14295F]',
    orange: 'border-[#FF7A16]/12 bg-[#FFF4E8] text-[#C15D05]',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };

  return (
    <div className={`rounded-[1rem] border px-3 py-3 ${toneMap[tone]}`}>
      <p className="text-[10px] font-black tracking-[0.14em] opacity-60">{label}</p>
      <p className="dashboard-number mt-1 text-[1.2rem] leading-none">{value}</p>
    </div>
  );
}

export function AppPreviewSection({ appSystem }: AppPreviewSectionProps) {
  return (
    <section
      id="app"
      className="scroll-mt-20 py-12 sm:py-16"
      style={{ background: 'linear-gradient(180deg, #edf1fb 0%, #ffffff 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <article className="overflow-hidden rounded-[1.8rem] border border-[rgba(20,41,95,0.12)] bg-white p-5 shadow-[0_16px_36px_rgba(20,41,95,0.08)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="eyebrow-badge">WEB APP EXPERIENCE</span>
                <h2 className="font-aggro-display mt-3 break-keep text-[clamp(1.75rem,3.5vw,2.5rem)] font-black leading-[1.1] text-[#14295F]">
                  웹앱을 실제 흐름처럼
                  <br />
                  단계별로 체험해보세요
                </h2>
              </div>
              <Link
                href="/go/login?placement=app_preview_login"
                className="premium-cta premium-cta-primary h-10 px-5 text-sm"
              >
                실제 로그인
              </Link>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
              <div className="rounded-[1.6rem] bg-[linear-gradient(180deg,#0E1D45_0%,#14295F_100%)] p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black tracking-[0.18em] text-white/60">LIVE PREVIEW</p>
                    <p className="mt-1 text-[1rem] font-black">학생 대표 화면</p>
                  </div>
                  <span className="rounded-full bg-white/12 px-3 py-1 text-[10px] font-black text-white/78">
                    TODAY
                  </span>
                </div>
                <div className="mt-4 rounded-[1.35rem] bg-white p-4 text-[#14295F]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black tracking-[0.14em] text-[#14295F]/45">오늘의 루틴</p>
                      <p className="mt-1 text-[1.1rem] font-black leading-[1.3]">
                        영어 모의고사 복기
                        <br />
                        국어 독서 3지문
                      </p>
                    </div>
                    <div className="rounded-full bg-[#FFF4E8] px-3 py-1 text-[10px] font-black text-[#C15D05]">
                      목표 달성률 83%
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <MetricChip label="오늘의 공부시간" value="4h 12m" />
                    <MetricChip label="시즌 LP" value="3,164" tone="orange" />
                    <MetricChip label="집중력" value="98.3" tone="green" />
                    <MetricChip label="주간 루틴" value="6 / 7일" />
                  </div>
                  <div className="mt-4 rounded-[1rem] bg-[#F5F8FF] p-3">
                    <div className="flex items-center justify-between text-[11px] font-black">
                      <span>주간 누적 그래프</span>
                      <span className="text-[#FF7A16]">14h 23m</span>
                    </div>
                    <div className="mt-3 flex h-16 items-end gap-1.5">
                      {[18, 28, 42, 56, 68, 92, 74].map((value, index) => (
                        <div
                          key={index}
                          className="flex-1 rounded-t-lg bg-[linear-gradient(180deg,#2C5DDD_0%,#14295F_100%)]"
                          style={{ height: `${value}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <article className="rounded-[1.35rem] border border-[#14295F]/10 bg-[#F7FAFF] p-4">
                  <p className="text-[10px] font-black tracking-[0.18em] text-[#14295F]/45">1. 확인</p>
                  <p className="mt-1 text-[1rem] font-black text-[#14295F]">오늘 해야 할 루틴과 현재 상태를 먼저 확인</p>
                </article>
                <article className="rounded-[1.35rem] border border-[#14295F]/10 bg-[#FFF6EE] p-4">
                  <p className="text-[10px] font-black tracking-[0.18em] text-[#C15D05]/70">2. 추적</p>
                  <p className="mt-1 text-[1rem] font-black text-[#14295F]">주간 그래프와 날짜별 기록으로 흐름을 추적</p>
                </article>
                <article className="rounded-[1.35rem] border border-[#14295F]/10 bg-[#F7FAFF] p-4">
                  <p className="text-[10px] font-black tracking-[0.18em] text-[#14295F]/45">3. 해석</p>
                  <p className="mt-1 text-[1rem] font-black text-[#14295F]">리포트와 성장 지표로 변화의 방향을 해석</p>
                </article>
                <article className="rounded-[1.35rem] border border-[#14295F]/10 bg-[#EEF9F2] p-4">
                  <p className="text-[10px] font-black tracking-[0.18em] text-[#0F8C57]/70">4. 행동</p>
                  <p className="mt-1 text-[1rem] font-black text-[#14295F]">알림과 피드백을 다음 루틴으로 바로 연결</p>
                </article>
              </div>
            </div>
          </article>

          <div>
            <div className="max-w-xl">
              <p className="break-keep text-[14px] font-bold leading-[1.72] text-[#384f6a]">
                학생은 루틴과 성장 지표를, 학부모는 출결과 학습 흐름을 봅니다. 같은 데이터를 보더라도 필요한 행동이 다르기 때문에 화면도 다르게 설계했습니다.
              </p>
            </div>

            <StaggerChildren stagger={120} className="mt-5 grid gap-4">
              {appSystem.guides.map((guide, index) => (
                <article
                  key={guide.mode}
                  className={`overflow-hidden rounded-[1.5rem] border bg-white shadow-sm ${
                    index === 0 ? 'border-[#14295F]/12' : 'border-[#FF7A16]/16'
                  }`}
                >
                  <div className="p-5">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          index === 0 ? 'bg-[#14295F]/7' : 'bg-[#FF7A16]/10'
                        }`}
                      >
                        {index === 0 ? (
                          <Smartphone className="h-4.5 w-4.5 text-[#14295F]" />
                        ) : (
                          <Users className="h-4.5 w-4.5 text-[#FF7A16]" />
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#14295F]/45">
                          {guide.mode}
                        </p>
                        <h3 className="mt-1 text-[1.05rem] font-black text-[#14295F]">{guide.headline}</h3>
                      </div>
                    </div>
                    <p className="mt-3 break-keep text-[13.5px] font-semibold leading-[1.72] text-slate-500">
                      {guide.summary}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {guide.checkpoints.map((checkpoint) => (
                        <span
                          key={checkpoint}
                          className={`rounded-full px-3 py-1 text-[11px] font-black ${
                            index === 0
                              ? 'bg-[#14295F]/6 text-[#14295F]/72'
                              : 'bg-[#FF7A16]/8 text-[#D96809]/75'
                          }`}
                        >
                          {checkpoint}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div
                    className={`flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 ${
                      index === 0
                        ? 'border-[#14295F]/7 bg-[#14295F]/3'
                        : 'border-[#FF7A16]/10 bg-[#FF7A16]/3'
                    }`}
                  >
                    <Link
                      href={guide.href}
                      className="inline-flex min-w-0 items-center gap-2 text-[13px] font-black text-[#14295F] transition-all duration-200 hover:gap-3"
                    >
                      {guide.label}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <span className="text-[11px] font-black text-[#14295F]/42">로그인 없이 대표 흐름 확인</span>
                  </div>
                </article>
              ))}
            </StaggerChildren>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MetricChip label={appSystem.dataMetrics[0]?.label ?? '시즌 누적 포인트'} value={appSystem.dataMetrics[0]?.value ?? '3,164 LP'} tone="orange" />
              <MetricChip label={appSystem.dataMetrics[1]?.label ?? '평균 목표 달성률'} value={appSystem.dataMetrics[1]?.value ?? '83%'} tone="green" />
              <MetricChip label={appSystem.dataMetrics[2]?.label ?? '주간 학습 시간'} value={appSystem.dataMetrics[2]?.value ?? '14시간 23분'} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
