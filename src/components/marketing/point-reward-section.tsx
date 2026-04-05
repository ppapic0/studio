import { Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

const motivationCards = [
  {
    title: '포인트 반영',
    description: '공부시간, 계획 완수, 실행 흐름이 누적 포인트로 반영돼 성취가 바로 보입니다.',
  },
  {
    title: '상벌점 운영',
    description: '좋은 루틴은 보상으로, 흐트러진 루틴은 상벌점으로 관리해 기준을 분명하게 잡습니다.',
  },
  {
    title: '학생 동기 유도',
    description: '학생이 스스로 동기와 흥미를 유지할 수 있도록 앱 안에서 꾸준히 자극을 줍니다.',
  },
] as const;

type PointRewardSectionProps = {
  surface?: 'card' | 'flat-light' | 'flat-dark';
  titleBreakMode?: 'default' | 'app';
};

export function PointRewardSection({ surface = 'card', titleBreakMode = 'default' }: PointRewardSectionProps) {
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
        <div className={cn('order-2 border-t px-6 py-7 sm:px-8 sm:py-8 lg:order-1 lg:border-r lg:border-t-0', isDark ? 'border-white/10 bg-white/[0.06]' : 'border-[#14295F]/8 bg-[linear-gradient(180deg,#F8FBFF_0%,#FFFFFF_100%)]')}>
          <div className={cn('relative overflow-hidden rounded-[1.9rem] border p-4 shadow-[0_20px_44px_rgba(20,41,95,0.08)] sm:p-5', isDark ? 'border-white/[0.12] bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.04)_100%)]' : 'border-[#D9E7FF] bg-[linear-gradient(180deg,#F9FBFF_0%,#EEF5FF_100%)]')}>
            <div className={cn('pointer-events-none absolute inset-0', isDark ? 'bg-[radial-gradient(circle_at_70%_18%,rgba(255,255,255,0.10),transparent_30%)]' : 'bg-[radial-gradient(circle_at_70%_18%,rgba(140,183,255,0.14),transparent_30%)]')} />
            <div className="relative">
              <p className={cn('text-[10px] font-black tracking-[0.18em]', isDark ? 'text-white/[0.58]' : 'text-[#14295F]/55')}>POINT · REWARD SYSTEM</p>
              <div className={cn('mt-4 flex min-h-[270px] items-center justify-center rounded-[1.6rem] border px-6 py-10 text-center sm:min-h-[320px]', isDark ? 'border-dashed border-white/[0.12] bg-white/[0.06]' : 'border-dashed border-[#14295F]/12 bg-white/82')}>
                <div className="max-w-[220px]">
                  <div className={cn('mx-auto h-16 w-16 rounded-[1.5rem] border shadow-[0_14px_30px_rgba(20,41,95,0.08)]', isDark ? 'border-white/[0.14] bg-white/10' : 'border-[#14295F]/10 bg-[linear-gradient(180deg,#FFFFFF_0%,#F6F9FF_100%)]')} />
                  <p className={cn('mt-6 text-[11px] font-black tracking-[0.22em]', isDark ? 'text-white/[0.48]' : 'text-[#14295F]/42')}>REAL CAPTURE READY</p>
                  <p className={cn('font-aggro-display mt-3 break-keep text-[1.15rem] font-black leading-[1.35] tracking-[-0.03em]', isDark ? 'text-white' : 'text-[#14295F]')}>포인트 · 상벌점 화면 예정</p>
                  <p className={cn('mt-3 break-keep text-[13px] font-semibold leading-[1.75]', isDark ? 'text-white/[0.74]' : 'text-[#506680]')}>
                    공부시간, 계획 완수, 포인트와 상벌점이
                    <br />
                    어떻게 보이는지 실제 앱 화면이 여기에
                    <br />
                    반영됩니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="order-1 px-6 py-7 sm:px-8 sm:py-8 lg:order-2">
          <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">SECTION 04</p>
          <h2 className={cn('font-aggro-display mt-4 break-keep text-[clamp(1.55rem,3.1vw,2.25rem)] font-black leading-[1.12] tracking-[-0.03em]', isDark ? 'text-white' : 'text-[#14295F]')}>
            학생별 포인트와 상벌점 제도로
            <br />
            학습 동기와 흥미를
            {isAppTitle ? (
              <>
                <br />
                끌어올립니다
              </>
            ) : (
              <> 끌어올립니다</>
            )}
          </h2>
          <p className={cn('mt-5 break-keep text-[15px] font-semibold leading-[1.86]', isDark ? 'text-white/[0.82]' : 'text-[#425A75]')}>
            공부시간, 계획완수 등 구체적인 실행을 포인트로 반영하고, 흥미를 유지할 수 있도록 돕습니다. 학습 동선을 단단하게 만드는 장치까지 트랙이 설계합니다.
          </p>

          <div className="mt-6 grid gap-3">
            {motivationCards.map((card) => (
              <article key={card.title} className={cn('rounded-[1.25rem] border px-4 py-4', isDark ? 'border-white/10 bg-white/[0.08] backdrop-blur-sm' : 'border-[#14295F]/8 bg-[#F9FBFF]')}>
                <div className="flex items-center gap-2">
                  <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-2xl text-white', isDark ? 'bg-white/[0.12]' : 'bg-[#14295F]')}>
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <h3 className={cn('font-aggro-display break-keep text-[0.98rem] font-black leading-[1.34] tracking-[-0.03em]', isDark ? 'text-white' : 'text-[#14295F]')}>{card.title}</h3>
                </div>
                <p className={cn('mt-3 break-keep text-[13px] font-semibold leading-[1.72]', isDark ? 'text-white/[0.74]' : 'text-[#53687F]')}>{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
