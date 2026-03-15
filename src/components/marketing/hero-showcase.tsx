'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Building2, Smartphone } from 'lucide-react';

const items = [
  {
    label: 'STUDY CENTER',
    title: '관리형 스터디센터 중심',
    desc: '입실부터 퇴실까지, 루틴과 데이터가 기록됩니다',
    stat: '매일 오전 8:30 시작',
    icon: Building2,
    targetId: 'features',
    color: 'navy' as const,
  },
  {
    label: 'CLASS SYSTEM',
    title: '국어 수업 선택형 구조',
    desc: '센터만 이용하거나, 필요할 때 수업을 추가합니다',
    stat: '재학생 · N수생 모두 가능',
    icon: BookOpen,
    targetId: 'korean-class',
    color: 'blue' as const,
  },
  {
    label: 'APP SYSTEM',
    title: '앱 기반 관리 시스템',
    desc: '학생과 학부모가 각자의 화면에서 흐름을 확인합니다',
    stat: '출결 · 공부시간 · 실행률 연결',
    icon: Smartphone,
    targetId: 'app',
    color: 'orange' as const,
  },
];

export function HeroShowcase() {
  const [active, setActive] = useState(0);

  const handleItemClick = (index: number, targetId: string) => {
    setActive(index);
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const id = setInterval(() => setActive((p) => (p + 1) % items.length), 3800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const Icon = item.icon;
        const isActive = i === active;
        return (
          <button
            key={item.label}
            onClick={() => handleItemClick(i, item.targetId)}
            aria-label={item.title}
            className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-500 ${
              isActive
                ? 'border-white/18 bg-white/9'
                : 'border-white/6 bg-white/3 opacity-38 hover:opacity-55'
            }`}
          >
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-400 ${
                isActive
                  ? item.color === 'orange'
                    ? 'bg-[#ff7a16]/18 text-[#FF9848]'
                    : 'bg-white/14 text-white'
                  : 'bg-white/6 text-white/35'
              }`}
            >
              <Icon className="h-4 w-4" />
            </div>

            <div className="min-w-0 flex-1">
              <p
                className={`text-[10px] font-black tracking-[0.22em] uppercase transition-colors duration-400 ${
                  isActive ? (item.color === 'orange' ? 'text-[#FF9848]' : 'text-white/55') : 'text-white/25'
                }`}
              >
                {item.label}
              </p>
              <p
                className={`mt-1.5 break-keep font-black leading-[1.2] transition-all duration-400 ${
                  isActive ? 'text-[1.1rem] text-white' : 'text-[1rem] text-white/45'
                }`}
              >
                {item.title}
              </p>
              <div
                className={`grid transition-all duration-500 ${isActive ? 'mt-2.5 grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="overflow-hidden">
                  <p className="break-keep text-[13px] font-semibold leading-[1.65] text-blue-100/55">
                    {item.desc}
                  </p>
                  <p className="mt-2.5 inline-block rounded-lg border border-white/10 bg-white/6 px-3 py-1.5 text-[12px] font-black text-white/70">
                    {item.stat}
                  </p>
                </div>
              </div>
            </div>
          </button>
        );
      })}

      {/* Indicator dots */}
      <div className="mt-1 flex items-center justify-center gap-2">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            aria-label={`${i + 1}번 항목`}
            className={`h-1 rounded-full transition-all duration-400 ${
              i === active ? 'w-5 bg-[#FF9848]' : 'w-1.5 bg-white/22 hover:bg-white/40'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
