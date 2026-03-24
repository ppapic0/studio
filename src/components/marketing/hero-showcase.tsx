'use client';

import { useState } from 'react';
import { ArrowRight, ShieldCheck, Smartphone, Users } from 'lucide-react';

type ShowcaseItem = {
  label: string;
  title: string;
  desc: string;
  points: string[];
  statLabel: string;
  statValue: string;
  href: string;
  cta: string;
  icon: typeof Smartphone;
};

const items: ShowcaseItem[] = [
  {
    label: 'STUDENT MODE',
    title: '학생은 오늘 해야 할 행동을 바로 확인합니다',
    desc: '루틴, 공부시간, 피드백을 한 흐름으로 읽게 만드는 학생 화면입니다.',
    points: ['오늘의 루틴', '주간 캘린더', '피드백 확인'],
    statLabel: '핵심 확인 항목',
    statValue: '3가지',
    href: '/experience?mode=student',
    cta: '학생 화면 보기',
    icon: Smartphone,
  },
  {
    label: 'PARENT MODE',
    title: '학부모는 현재 상태와 변화 방향만 빠르게 읽습니다',
    desc: '출결, 주간 그래프, 리포트를 같은 문법으로 확인하는 화면입니다.',
    points: ['출결 상태', '주간 그래프', '리포트 수신'],
    statLabel: '핵심 확인 항목',
    statValue: '3가지',
    href: '/experience?mode=parent',
    cta: '학부모 화면 보기',
    icon: Users,
  },
  {
    label: 'ADMIN MODE',
    title: '운영자는 문제 발견부터 개입까지 우선순위로 봅니다',
    desc: '하락 신호, 상담, 개입 결과를 빠르게 연결하는 운영 화면입니다.',
    points: ['위험 신호', '개입 우선순위', '전후 비교'],
    statLabel: '핵심 확인 항목',
    statValue: '3가지',
    href: '/experience?mode=admin',
    cta: '운영자 흐름 보기',
    icon: ShieldCheck,
  },
];

export function HeroShowcase() {
  const [active, setActive] = useState(0);
  const current = items[active] ?? items[0];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[1.7rem] border border-white/12 bg-white/8 p-5 shadow-[0_16px_32px_rgba(4,11,29,0.22)] backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-white/52">WEB APP VALUE</p>
            <p className="mt-1 text-[1.15rem] font-black leading-[1.32] text-white">{current.title}</p>
          </div>
          <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[10px] font-black text-[#FFB273]">
            {current.label}
          </div>
        </div>

        <p className="mt-4 break-keep text-[13px] font-semibold leading-[1.72] text-white/72">{current.desc}</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {current.points.map((point) => (
            <div
              key={point}
              className="rounded-[1rem] border border-white/10 bg-[#0f1d42] px-3 py-3 text-[12px] font-black text-white/84"
            >
              {point}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.1rem] border border-white/10 bg-[#09152F] px-4 py-3">
          <div>
            <p className="text-[10px] font-black tracking-[0.16em] text-white/42">{current.statLabel}</p>
            <p className="mt-1 text-[1rem] font-black text-white">{current.statValue}</p>
          </div>
          <a href={current.href} className="inline-flex items-center gap-1.5 text-[12px] font-black text-[#FFB273]">
            {current.cta}
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
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
                  : 'border-white/6 bg-white/[0.04] opacity-70 hover:opacity-92'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    isActive ? 'bg-white/14 text-[#FFB273]' : 'bg-white/8 text-white/46'
                  }`}
                >
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
