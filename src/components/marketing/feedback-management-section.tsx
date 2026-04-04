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

export function FeedbackManagementSection() {
  return (
    <section className="overflow-hidden rounded-[2.3rem] border border-[#14295F]/10 bg-white shadow-[0_22px_52px_rgba(20,41,95,0.08)]">
      <div className="grid gap-0 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="order-2 border-t border-[#14295F]/8 bg-[linear-gradient(180deg,#FFF9F2_0%,#FFFFFF_100%)] px-6 py-7 sm:px-8 sm:py-8 lg:order-1 lg:border-r lg:border-t-0">
          <div className="relative overflow-hidden rounded-[1.9rem] border border-[#FFD9BF] bg-[linear-gradient(180deg,#FFF8F0_0%,#FFF3E7_100%)] p-4 shadow-[0_20px_44px_rgba(20,41,95,0.08)] sm:p-5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_18%,rgba(255,122,22,0.12),transparent_28%)]" />
            <div className="relative">
              <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">APP LINKED MANAGEMENT</p>
              <div className="mt-4 flex min-h-[270px] items-center justify-center rounded-[1.6rem] border border-dashed border-[#14295F]/12 bg-white/82 px-6 py-10 text-center sm:min-h-[320px]">
                <div className="max-w-[220px]">
                  <div className="mx-auto h-16 w-16 rounded-[1.5rem] border border-[#14295F]/10 bg-[linear-gradient(180deg,#FFFFFF_0%,#F6F9FF_100%)] shadow-[0_14px_30px_rgba(20,41,95,0.08)]" />
                  <p className="mt-6 text-[11px] font-black tracking-[0.22em] text-[#FF7A16]">REAL CAPTURE READY</p>
                  <p className="font-aggro-display mt-3 break-keep text-[1.15rem] font-black leading-[1.35] tracking-[-0.03em] text-[#14295F]">학습 현황 · 피드백 화면 예정</p>
                  <p className="mt-3 break-keep text-[13px] font-semibold leading-[1.75] text-[#506680]">
                    학생별 계획, 실행, 학습 현황과 피드백이
                    <br />
                    바로 연결되는 앱 화면을 여기에
                    <br />
                    반영합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="order-1 px-6 py-7 sm:px-8 sm:py-8 lg:order-2">
          <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">SECTION 02</p>
          <h2 className="font-aggro-display mt-4 break-keep text-[clamp(1.55rem,3.1vw,2.25rem)] font-black leading-[1.12] tracking-[-0.03em] text-[#14295F]">
            자체 개발한 트랙 러닝시스템으로
            <br />
            학습 현황을 실시간 체크 및
            <br />
            피드백
          </h2>

          <div className="mt-6 space-y-3">
            {appFlowCards.map((card) => (
              <article key={card.title} className="rounded-[1.3rem] border border-[#14295F]/8 bg-[#F9FBFF] px-4 py-4">
                <p className="text-[10px] font-black tracking-[0.16em] text-[#FF7A16]">SYSTEM FLOW</p>
                <h3 className="font-aggro-display mt-3 break-keep text-[0.98rem] font-black leading-[1.36] tracking-[-0.03em] text-[#14295F]">{card.title}</h3>
                <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.72] text-[#53687F]">{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
