'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck, Smartphone, Users } from 'lucide-react';

type ShowcaseItem = {
  label: string;
  title: string;
  desc: string;
  proofType: string;
  image: string;
  stat: string;
  href: string;
  icon: typeof Smartphone;
};

const items: ShowcaseItem[] = [
  {
    label: 'STUDENT MODE',
    title: '오늘의 루틴과 성장 지표를 한 화면에서',
    desc: '학생 홈 화면 기준 재구성 캡처입니다. 오늘의 루틴, 주간 캘린더, 성장 지표, 피드백 흐름을 묶었습니다.',
    proofType: '재구성 캡처',
    image: '/marketing/app-evidence/student-dashboard-redacted.svg',
    stat: '루틴 · 캘린더 · 성장 지표',
    href: '/experience?mode=student',
    icon: Smartphone,
  },
  {
    label: 'PARENT MODE',
    title: '상태 요약과 주간 그래프로 과정을 확인',
    desc: '학부모 화면 기준 재구성 캡처입니다. 실시간 상태, 주간 그래프, 날짜별 기록, 리포트 흐름을 보여줍니다.',
    proofType: '재구성 캡처',
    image: '/marketing/app-evidence/parent-dashboard-redacted.svg',
    stat: '상태 요약 · 주간 그래프 · 리포트',
    href: '/experience?mode=parent',
    icon: Users,
  },
  {
    label: 'ADMIN MODE',
    title: '위험 신호와 개입 우선순위를 한 번에',
    desc: '운영자 대시보드 기준 재구성 캡처입니다. 하락 추세, 미제출, 개입 우선순위, 전후 비교를 정리합니다.',
    proofType: '재구성 캡처',
    image: '/marketing/app-evidence/admin-dashboard-redacted.svg',
    stat: '위험 신호 · 개입 · 전후 비교',
    href: '/experience?mode=admin',
    icon: ShieldCheck,
  },
];

export function HeroShowcase() {
  const [active, setActive] = useState(0);
  const current = items[active] ?? items[0];

  useEffect(() => {
    const id = setInterval(() => setActive((prev) => (prev + 1) % items.length), 3800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[1.7rem] border border-white/12 bg-white/8 p-4 shadow-[0_20px_44px_rgba(4,11,29,0.28)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-white/52">PRODUCT PROOF</p>
            <p className="mt-1 text-[1.15rem] font-black leading-[1.25] text-white">{current.title}</p>
          </div>
          <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[10px] font-black text-[#FFB273]">
            {current.proofType}
          </span>
        </div>

        <a
          href={current.href}
          className="group mt-4 block overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#09152F]"
        >
          <div className="border-b border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-4 py-5">
            <p className="text-[10px] font-black tracking-[0.18em] text-white/48">SCREEN SUMMARY</p>
            <p className="mt-2 break-keep text-[1.05rem] font-black leading-[1.45] text-white">
              공개용 실제 앱 스크린샷 대신, 이 모드에서 확인 가능한 핵심 항목만 먼저 보여드립니다.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-black text-white/76">
                {current.label}
              </span>
              <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] font-black text-white/76">
                {current.stat}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#09152F] px-4 py-3">
            <span className="text-[12px] font-black text-white/82">{current.stat}</span>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-black text-[#FFB273]">
              화면 자세히 보기
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </div>
        </a>

        <p className="mt-4 break-keep text-[12px] font-semibold leading-[1.65] text-white/68">{current.desc}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = index === active;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => setActive(index)}
              className={`rounded-[1.15rem] border px-3 py-3 text-left transition-all duration-300 ${
                isActive
                  ? 'border-white/20 bg-white/10'
                  : 'border-white/6 bg-white/[0.04] opacity-65 hover:opacity-90'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isActive ? 'bg-white/14 text-[#FFB273]' : 'bg-white/8 text-white/46'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-[10px] font-black tracking-[0.16em] text-white/56">{item.label}</p>
              </div>
              <p className="mt-2 break-keep text-[13px] font-black leading-[1.4] text-white">{item.title}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
