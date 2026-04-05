import Image from 'next/image';

import { cn } from '@/lib/utils';

const appFlowCards = [
  {
    title: '학습현황 확인',
    description: '계획부터 실행까지 누적된 학습데이터가 앱에 기록되어 현재 상태를 실시간으로 파악할 수 있습니다.',
  },
  {
    title: '학습의 피드백',
    description: '학생별 취약 구간을 앱상에서 파악해 즉각적인 피드백과 학습 관리로 바로 연결합니다.',
  },
  {
    title: '학부모 확인',
    description: '학생의 학습데이터를 학부모용 앱을 통해 실시간으로 확인할 수 있습니다.',
  },
] as const;

type FeedbackManagementSectionProps = {
  surface?: 'card' | 'flat-light' | 'flat-dark';
  titleBreakMode?: 'default' | 'app';
};

export function FeedbackManagementSection({ surface = 'card', titleBreakMode = 'default' }: FeedbackManagementSectionProps) {
  const isCard = surface === 'card';
  const isDark = surface === 'flat-dark';
  const isAppTitle = titleBreakMode === 'app';

  return (
    <section
      className={cn(
        'overflow-hidden',
        isCard && 'rounded-[2.3rem] border border-[#14295F]/10 bg-white shadow-[0_22px_52px_rgba(20,41,95,0.08)]',
      )}
    >
      <div className="grid gap-0 lg:grid-cols-[1.02fr_0.98fr]">
        <div className={cn('order-2 border-t px-6 py-7 sm:px-8 sm:py-8 lg:order-1 lg:border-r lg:border-t-0', isDark ? 'border-white/10 bg-white/[0.06]' : 'border-[#14295F]/8 bg-[linear-gradient(180deg,#FFF9F2_0%,#FFFFFF_100%)]')}>
          <div className={cn('relative overflow-hidden rounded-[1.9rem] border p-4 shadow-[0_20px_44px_rgba(20,41,95,0.08)] sm:p-5', isDark ? 'border-white/[0.12] bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.04)_100%)]' : 'border-[#FFD9BF] bg-[linear-gradient(180deg,#FFF8F0_0%,#FFF3E7_100%)]')}>
            <div className={cn('pointer-events-none absolute inset-0', isDark ? 'bg-[radial-gradient(circle_at_75%_18%,rgba(255,255,255,0.10),transparent_28%)]' : 'bg-[radial-gradient(circle_at_75%_18%,rgba(255,122,22,0.12),transparent_28%)]')} />
            <div className="relative">
              <p className={cn('text-[10px] font-black tracking-[0.18em]', isDark ? 'text-white/[0.58]' : 'text-[#FF7A16]')}>APP LINKED MANAGEMENT</p>
              <div className={cn('mt-4 rounded-[1.6rem] border px-4 py-5 text-center sm:px-5 sm:py-6', isDark ? 'border-white/[0.12] bg-white/[0.06]' : 'border-[#14295F]/12 bg-white/82')}>
                <div className="mx-auto max-w-[290px]">
                  <div className={cn('relative mx-auto aspect-[284/439] overflow-hidden rounded-[1.7rem] border shadow-[0_20px_44px_rgba(20,41,95,0.16)]', isDark ? 'border-white/[0.16] bg-[#0E2152]' : 'border-[#14295F]/10 bg-[#F7FAFF]')}>
                    <Image
                      src="/marketing/app-evidence/study-feedback-dashboard-capture.png"
                      alt="학습 현황과 피드백이 한 화면에서 보이는 실제 앱 화면"
                      fill
                      sizes="(min-width: 640px) 290px, 82vw"
                      className="object-contain object-center"
                    />
                  </div>
                  <p className={cn('mt-5 text-[11px] font-black tracking-[0.22em]', isDark ? 'text-white/[0.48]' : 'text-[#FF7A16]')}>REAL CAPTURE READY</p>
                  <p className={cn('font-aggro-display mt-3 break-keep text-[1.15rem] font-black leading-[1.35] tracking-[-0.03em]', isDark ? 'text-white' : 'text-[#14295F]')}>학습 현황 · 피드백 실제 화면</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="order-1 px-6 py-7 sm:px-8 sm:py-8 lg:order-2">
          <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">SECTION 02</p>
          <h2 className={cn('font-aggro-display mt-4 break-keep text-[clamp(1.55rem,3.1vw,2.25rem)] font-black leading-[1.12] tracking-[-0.03em]', isDark ? 'text-white' : 'text-[#14295F]')}>
            자체 개발한
            <br />
            트랙 러닝시스템으로
            {isAppTitle ? (
              <>
                <br />
                실시간 체크 및 피드백
              </>
            ) : (
              <>
                <br />
                학습 현황을 실시간 체크 및
                <br />
                피드백
              </>
            )}
          </h2>

          <div className="mt-6 space-y-3">
            {appFlowCards.map((card) => (
              <article key={card.title} className={cn('rounded-[1.3rem] border px-4 py-4', isDark ? 'border-white/10 bg-white/[0.08] backdrop-blur-sm' : 'border-[#14295F]/8 bg-[#F9FBFF]')}>
                <p className={cn('text-[10px] font-black tracking-[0.16em]', isDark ? 'text-white/[0.58]' : 'text-[#FF7A16]')}>SYSTEM FLOW</p>
                <h3 className={cn('font-aggro-display mt-3 break-keep text-[0.98rem] font-black leading-[1.36] tracking-[-0.03em]', isDark ? 'text-white' : 'text-[#14295F]')}>{card.title}</h3>
                <p className={cn('mt-2 break-keep text-[13px] font-semibold leading-[1.72]', isDark ? 'text-white/[0.74]' : 'text-[#53687F]')}>{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
