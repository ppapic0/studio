import { BookOpenCheck, Smartphone, Sparkles, Wifi } from 'lucide-react';

import { SectionHeading } from './section-heading';

const centerIntroPoints = [
  { icon: Wifi, title: '학습 집중 환경/휴대폰 수거 관리', detail: '허용 사이트 중심 와이파이 운영' },
  { icon: Smartphone, title: '앱 연동 관리', detail: '현황과 피드백을 바로 연결' },
  { icon: BookOpenCheck, title: '실전 모의 운영', detail: '더프리미엄 · 이감 · 한수 · 서바이벌 프로' },
  { icon: Sparkles, title: '상벌점 제도 운영', detail: '엄격한 규정과 체계적인 관리로 학습 분위기 조성' },
] as const;

export function CenterIntroSection() {
  return (
    <section className="relative overflow-hidden rounded-[2.7rem] border border-[#14295F]/10 bg-white px-6 py-7 shadow-[0_28px_64px_rgba(20,41,95,0.10)] sm:px-8 sm:py-8 lg:px-10 lg:py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(20,41,95,0.06),transparent_24%),radial-gradient(circle_at_92%_8%,rgba(255,122,22,0.10),transparent_24%)]" />
      <div className="relative grid gap-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-end">
        <div>
          <SectionHeading eyebrow="CENTER INTRO" title="트랙의 센터 소개" />
          <p className="mt-4 max-w-2xl break-keep text-[15px] font-bold leading-[1.82] text-[#2c3f58] sm:text-[15.5px]">
            <span className="block">공간만 제공하는 것이 아니라</span>
            <span className="block">집중력 최적화, 앱 연동 관리, 실전모의고사 및</span>
            <span className="block">포인트, 벌점제도로 학습동기를 높입니다.</span>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {centerIntroPoints.map(({ icon: Icon, title, detail }) => (
            <div key={title} className="rounded-[1.45rem] border border-[#14295F]/10 bg-[#F9FBFF] px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#14295F] text-white">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-[10px] font-black tracking-[0.16em] text-[#14295F]/50">CENTER POINT</p>
                  <p className="mt-1 break-keep text-[0.98rem] font-black leading-[1.34] text-[#14295F]">{title}</p>
                </div>
              </div>
              <p className="mt-3 break-keep text-[13px] font-semibold leading-[1.7] text-[#53687F]">{detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
