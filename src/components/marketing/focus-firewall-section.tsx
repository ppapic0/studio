import { cn } from '@/lib/utils';

const focusHighlights = [
  '유튜브 게임 sns등의 불필요한 접속은 와이파이 방화벽으로 차단합니다.',
  '학습시간에는 필요한 학습사이트만 열어 집중 흐름을 향상시킵니다.',
] as const;

type FocusFirewallSectionProps = {
  surface?: 'card' | 'flat-light' | 'flat-dark';
};

export function FocusFirewallSection({ surface = 'card' }: FocusFirewallSectionProps) {
  const isCard = surface === 'card';
  const isDark = surface === 'flat-dark';

  return (
    <section
      className={cn(
        'overflow-hidden',
        isCard && 'rounded-[2.3rem] border border-[#14295F]/10 bg-white shadow-[0_22px_52px_rgba(20,41,95,0.08)]',
      )}
    >
      <div className="grid gap-0 lg:grid-cols-[0.96fr_1.04fr]">
        <div className="px-6 py-7 sm:px-8 sm:py-8">
          <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">SECTION 01</p>
          <h2 className={cn('font-aggro-display mt-4 break-keep text-[clamp(1.55rem,3.1vw,2.25rem)] font-black leading-[1.12] tracking-[-0.03em]', isDark ? 'text-white' : 'text-[#14295F]')}>
            트랙 전용 방화벽으로
            <br />
            몰입환경 조성
          </h2>
          <p className={cn('mt-5 break-keep text-[15px] font-semibold leading-[1.86]', isDark ? 'text-white/[0.82]' : 'text-[#425A75]')}>
            학습 전용 네트워크 기준을 먼저 세워 불필요한 접속은 차단하고, 필요한 사이트만 열어 학생의 집중 흐름을 안정적으로 끌어올립니다.
          </p>

          <div className="mt-6 space-y-3">
            {focusHighlights.map((item, index) => (
              <div
                key={item}
                className={cn(
                  'flex items-start gap-3 rounded-[1.15rem] border px-4 py-3',
                  isDark ? 'border-white/10 bg-white/[0.08] backdrop-blur-sm' : 'border-[#14295F]/8 bg-[#F8FBFF]',
                )}
              >
                <span
                  className={cn(
                    'mt-[1px] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
                    isDark ? 'border border-white/[0.16] bg-white/[0.12] text-white' : 'bg-[#14295F] text-white',
                  )}
                >
                  {index + 1}
                </span>
                <p className={cn('break-keep text-[13px] font-semibold leading-[1.7]', isDark ? 'text-white/[0.78]' : 'text-[#53687F]')}>{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={cn('border-t px-6 py-7 sm:px-8 sm:py-8 lg:border-l lg:border-t-0', isDark ? 'border-white/10 bg-white/[0.06]' : 'border-[#14295F]/8 bg-[linear-gradient(180deg,#F8FBFF_0%,#FFFFFF_100%)]')}>
          <div className={cn('relative overflow-hidden rounded-[1.9rem] border p-4 shadow-[0_20px_44px_rgba(20,41,95,0.08)] sm:p-5', isDark ? 'border-white/[0.12] bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.04)_100%)]' : 'border-[#D9E7FF] bg-[linear-gradient(180deg,#F9FBFF_0%,#EEF5FF_100%)]')}>
            <div className={cn('pointer-events-none absolute inset-0', isDark ? 'bg-[radial-gradient(circle_at_70%_18%,rgba(255,255,255,0.10),transparent_30%)]' : 'bg-[radial-gradient(circle_at_70%_18%,rgba(140,183,255,0.14),transparent_30%)]')} />
            <div className="relative">
              <p className={cn('text-[10px] font-black tracking-[0.18em]', isDark ? 'text-white/[0.58]' : 'text-[#14295F]/55')}>WEB APP CONTROL</p>
              <div className={cn('mt-4 flex min-h-[270px] items-center justify-center rounded-[1.6rem] border px-6 py-10 text-center sm:min-h-[320px]', isDark ? 'border-dashed border-white/[0.12] bg-white/[0.06]' : 'border-dashed border-[#14295F]/12 bg-white/82')}>
                <div className="max-w-[220px]">
                  <div className={cn('mx-auto h-16 w-16 rounded-[1.5rem] border shadow-[0_14px_30px_rgba(20,41,95,0.08)]', isDark ? 'border-white/[0.14] bg-white/10' : 'border-[#14295F]/10 bg-[linear-gradient(180deg,#FFFFFF_0%,#F6F9FF_100%)]')} />
                  <p className={cn('mt-6 text-[11px] font-black tracking-[0.22em]', isDark ? 'text-white/[0.48]' : 'text-[#14295F]/42')}>REAL CAPTURE READY</p>
                  <p className={cn('font-aggro-display mt-3 break-keep text-[1.15rem] font-black leading-[1.35] tracking-[-0.03em]', isDark ? 'text-white' : 'text-[#14295F]')}>허용사이트 설정 화면 예정</p>
                  <p className={cn('mt-3 break-keep text-[13px] font-semibold leading-[1.75]', isDark ? 'text-white/[0.74]' : 'text-[#506680]')}>
                    실제 웹앱에서 학습시간 허용 사이트와
                    <br />
                    집중 환경 설정이 반영되는 화면을 여기에 연결합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
