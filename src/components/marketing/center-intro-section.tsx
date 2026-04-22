import { BookOpenCheck, Smartphone, Sparkles, Wifi } from 'lucide-react';

import { cn } from '@/lib/utils';

const centerIntroPoints = [
  { icon: Wifi, title: '학습 집중 환경/휴대폰 수거 관리', detail: '허용 사이트 중심 와이파이 운영\n러셀형 프리미엄 좌석 운영' },
  { icon: Smartphone, title: '학습상담 & 학습관리 앱 운영', detail: '현황과 피드백을 바로 연결' },
  { icon: BookOpenCheck, title: '실전 모의 운영', detail: '더프리미엄 · 이감 · 한수 · 서바이벌 프로' },
  { icon: Sparkles, title: '상벌점 제도 운영', detail: '엄격한 규정과 체계적인 관리로 학습 분위기 조성' },
] as const;

type CenterIntroSectionProps = {
  surface?: 'card' | 'flat-light' | 'flat-dark';
};

export function CenterIntroSection({ surface = 'card' }: CenterIntroSectionProps) {
  const isCard = surface === 'card';
  const isDark = surface === 'flat-dark';

  return (
    <section
      className={cn(
        'relative overflow-hidden',
        isCard ? 'rounded-[2.35rem] border border-[#dbe4f3] px-5 py-6 shadow-[0_26px_60px_rgba(20,41,95,0.10)] sm:rounded-[2.7rem] sm:px-8 sm:py-8 lg:px-10 lg:py-10' : 'rounded-[2.7rem] border border-[#dbe4f3] px-6 py-8 shadow-[0_24px_56px_rgba(20,41,95,0.08)] sm:px-8 lg:px-10 lg:py-10',
        isDark
          ? 'border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.04)_100%)] shadow-none'
          : 'bg-[radial-gradient(circle_at_top_right,rgba(255,122,22,0.12),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]',
      )}
    >
      <div className={cn('absolute inset-x-4 top-0 h-[5px] rounded-b-full sm:inset-x-6', isDark ? 'bg-white/16' : 'bg-[linear-gradient(90deg,#14295F_0%,#365dc9_58%,#ffb274_100%)]')} />
      <div className="relative">
        <div className="max-w-3xl">
          <div
            className={cn(
              'inline-flex rounded-full border px-4 py-2 text-[10px] font-black tracking-[0.26em]',
              isDark ? 'border-white/14 bg-white/10 text-white/72' : 'border-[#ead8c7] bg-[#fff4ea] text-[#c66f1e]'
            )}
          >
            CENTER INTRO
          </div>
          <h2
            className={cn(
              'font-aggro-display mt-4 break-keep text-[2rem] font-black leading-[1.02] tracking-[-0.05em] sm:mt-5 sm:text-[2.4rem] lg:text-[2.9rem]',
              isDark ? 'text-white' : 'text-[#14295F]'
            )}
          >
            트랙의 센터 소개
          </h2>
          <p
            className={cn(
              'mt-5 max-w-2xl break-keep text-[14px] font-bold leading-[1.95] sm:text-[15px]',
              isDark ? 'text-white/82' : 'text-[#324765]'
            )}
          >
            <span className="block">공간만 제공하는 것이 아니라</span>
            <span className="block">집중력 최적화, 앱 연동 관리, 실전모의고사 및</span>
            <span className="block">포인트, 벌점제도로 학습동기를 높입니다.</span>
          </p>
        </div>

        <div className="mt-7 grid gap-3.5 sm:mt-8 sm:gap-4 lg:mt-9">
          {centerIntroPoints.map(({ icon: Icon, title, detail }) => (
            <article
              key={title}
              className={cn(
                'rounded-[1.55rem] border px-4 py-4 sm:px-5 sm:py-5',
                isDark
                  ? 'border-white/12 bg-white/8 backdrop-blur-sm'
                  : 'border-[#dbe4f3] bg-white shadow-[0_18px_38px_rgba(20,41,95,0.06)]'
              )}
            >
              <div className="flex items-start gap-3.5 sm:gap-4">
                <span
                  className={cn(
                    'mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.1rem]',
                    isDark ? 'bg-white/12 text-white' : 'bg-[#14295F] text-white'
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className={cn('text-[10px] font-black tracking-[0.22em]', isDark ? 'text-white/58' : 'text-[#97a5bb]')}>
                    CENTER POINT
                  </p>
                  <p
                    className={cn(
                      'font-aggro-display mt-1 break-keep text-[1.04rem] font-black leading-[1.34] tracking-[-0.04em] sm:text-[1.14rem]',
                      isDark ? 'text-white' : 'text-[#14295F]'
                    )}
                  >
                    {title}
                  </p>
                  <p
                    className={cn(
                      'mt-3 whitespace-pre-line break-keep text-[13px] font-semibold leading-[1.78] sm:text-[13.5px]',
                      isDark ? 'text-white/76' : 'text-[#596d88]'
                    )}
                  >
                    {detail}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
