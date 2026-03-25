'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
    title: '루틴·학습시간·피드백을 한 흐름으로',
    desc: '루틴, 학습시간, 피드백을 한 흐름으로 확인합니다.',
    points: ['오늘의 루틴', '주간 캘린더', '피드백 확인'],
    statLabel: '핵심 확인 항목',
    statValue: '3가지',
    href: '/experience?mode=student',
    cta: '학생 화면 보기',
    icon: Smartphone,
  },
  {
    label: 'PARENT MODE',
    title: '출결·그래프·리포트 실시간 확인',
    desc: '출결, 주간 그래프, 리포트를 실시간으로 읽습니다.',
    points: ['출결 상태', '주간 그래프', '리포트 수신'],
    statLabel: '핵심 확인 항목',
    statValue: '3가지',
    href: '/experience?mode=parent',
    cta: '학부모 화면 보기',
    icon: Users,
  },
  {
    label: 'ADMIN MODE',
    title: '위험 신호부터 개입 결과까지',
    desc: '위험 신호, 상담, 개입 결과를 우선순위로 정리합니다.',
    points: ['위험 신호', '개입 우선순위', '전후 비교'],
    statLabel: '핵심 확인 항목',
    statValue: '3가지',
    href: '/experience?mode=admin',
    cta: '운영자 흐름 보기',
    icon: ShieldCheck,
  },
];

const INTERVAL_MS = 3500;

export function HeroShowcase() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const rafRef = useRef<number | null>(null);
  const current = items[active] ?? items[0];

  const advance = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setActive((prev) => (prev + 1) % items.length);
      setProgress(0);
      startTimeRef.current = Date.now();
      setVisible(true);
    }, 220);
  }, []);

  // Progress bar animation via rAF
  useEffect(() => {
    if (paused) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    startTimeRef.current = Date.now() - progress * INTERVAL_MS;

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(elapsed / INTERVAL_MS, 1);
      setProgress(pct);
      if (pct >= 1) {
        advance();
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [paused, active, advance]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualSelect = (index: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setVisible(false);
    setTimeout(() => {
      setActive(index);
      setProgress(0);
      startTimeRef.current = Date.now();
      setVisible(true);
    }, 160);
  };

  return (
    <div
      className="space-y-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Main card */}
      <div
        className="overflow-hidden rounded-[1.7rem] border border-white/12 bg-white/8 p-5 shadow-[0_16px_32px_rgba(4,11,29,0.22)] backdrop-blur-sm"
        style={{
          transition: 'opacity 0.22s ease, transform 0.22s ease',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(6px)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-white/80">WEB APP VALUE</p>
            <p className="mt-1 text-[1.15rem] font-black leading-[1.32] text-white">{current.title}</p>
          </div>
          <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[10px] font-black text-[#FFB273]">
            {current.label}
          </div>
        </div>

        <p className="mt-4 break-keep text-[13px] font-semibold leading-[1.72] text-white/90">{current.desc}</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {current.points.map((point) => (
            <div
              key={point}
              className="rounded-[1rem] border border-white/10 bg-[#0f1d42] px-3 py-3 text-[12px] font-black text-white"
            >
              {point}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.1rem] border border-white/10 bg-[#09152F] px-4 py-3">
          <div>
            <p className="text-[10px] font-black tracking-[0.16em] text-white/80">{current.statLabel}</p>
            <p className="mt-1 text-[1rem] font-black text-white">{current.statValue}</p>
          </div>
          <a href={current.href} className="inline-flex items-center gap-1.5 text-[12px] font-black text-[#FFB273]">
            {current.cta}
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Tab buttons */}
      <div className="grid gap-2 sm:grid-cols-3">
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = index === active;

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => handleManualSelect(index)}
              className={`relative overflow-hidden rounded-[1.15rem] border px-3 py-3 text-left transition-all duration-300 ${
                isActive
                  ? 'border-white/20 bg-white/10'
                  : 'border-white/10 bg-white/[0.04] opacity-85 hover:opacity-100'
              }`}
            >
              {/* Progress bar on active tab */}
              {isActive && (
                <span
                  className="pointer-events-none absolute bottom-0 left-0 h-[2.5px] rounded-full bg-[#FFB273]"
                  style={{ width: `${progress * 100}%`, transition: 'none' }}
                />
              )}

              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    isActive ? 'bg-white/14 text-[#FFB273]' : 'bg-white/8 text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-[10px] font-black tracking-[0.16em] text-white">{item.label}</p>
              </div>
              <p className="mt-2 break-keep text-[13px] font-black leading-[1.4] text-white">{item.title}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
