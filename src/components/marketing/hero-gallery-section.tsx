const heroGalleryCards = [
  {
    eyebrow: 'CENTER 01',
    title: '센터 전경',
    summary: '입실 순간부터 차분한 분위기와 운영 기준이 느껴지는 공간입니다.',
    tone: 'center',
    badge: '시설 사진 예정',
  },
  {
    eyebrow: 'CENTER 02',
    title: '학습 공간',
    summary: '오래 앉아도 집중 흐름이 유지되도록 설계한 메인 학습 공간입니다.',
    tone: 'center',
    badge: '집중 공간 예정',
  },
  {
    eyebrow: 'CLASS 01',
    title: '국어 수업 장면',
    summary: '수업의 실제 분위기와 설명 밀도가 보이는 장면을 담습니다.',
    tone: 'class',
    badge: '수업 장면 예정',
  },
  {
    eyebrow: 'CLASS 02',
    title: '수업 자료 · 피드백',
    summary: '자료와 피드백이 어떻게 연결되는지 한눈에 보이도록 보여드립니다.',
    tone: 'class',
    badge: '자료 사진 예정',
  },
] as const;

const toneMap = {
  center: {
    shell:
      'border-[#14295F]/10 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)]',
    image:
      'border-[#D8E5FF] bg-[radial-gradient(circle_at_top,rgba(140,183,255,0.14),transparent_34%),linear-gradient(160deg,#F8FBFF_0%,#FFFFFF_100%)]',
    badge: 'border-[#14295F]/10 bg-white/90 text-[#425A75]',
    chip: 'text-[#14295F]',
    glow: 'bg-[#8CB7FF]/18',
  },
  class: {
    shell:
      'border-[#FF7A16]/14 bg-[linear-gradient(180deg,#FFF9F2_0%,#FFFFFF_100%)]',
    image:
      'border-[#FFD8BF] bg-[radial-gradient(circle_at_top,rgba(255,184,122,0.18),transparent_34%),linear-gradient(160deg,#FFF8F0_0%,#FFFFFF_100%)]',
    badge: 'border-[#FF7A16]/14 bg-white/90 text-[#B55200]',
    chip: 'text-[#B55200]',
    glow: 'bg-[#FFB878]/20',
  },
} as const;

export function HeroGallerySection() {
  return (
    <section
      className="hidden py-14 sm:block sm:py-18"
      style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f7f9fd 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">TRACK SPACE & CLASS</p>
          <h2 className="font-aggro-display mt-4 break-keep text-[clamp(1.75rem,4.8vw,3.2rem)] font-black leading-[1.22] text-[#14295F]">
            <span className="text-[#FF7A16]">트랙</span>에서는
            <br />
            최고의
            <br />
            수업분위기와, 최적의 관리를 제공합니다
          </h2>
          <p className="mx-auto mt-4 max-w-3xl break-keep text-[13.5px] font-semibold leading-[1.8] text-[#51667D] sm:text-[15px]">
            사진이 반영되면 센터 분위기와 수업 흐름을 홈 첫 화면에서 바로 확인할 수 있도록 준비했습니다.
          </p>
        </div>

        <div className="mt-9 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-4 lg:gap-5">
          {heroGalleryCards.map((card) => {
            const tone = toneMap[card.tone];

            return (
              <article
                key={card.title}
                className={`group relative overflow-hidden rounded-[1.65rem] border p-3 shadow-[0_18px_36px_rgba(20,41,95,0.08)] transition-transform duration-300 hover:-translate-y-1 sm:rounded-[2rem] sm:p-3 ${tone.shell}`}
              >
                <div className={`pointer-events-none absolute -right-10 top-4 h-24 w-24 rounded-full blur-3xl ${tone.glow}`} />
                <div className={`pointer-events-none absolute -left-8 bottom-0 h-20 w-20 rounded-full blur-3xl ${tone.glow}`} />

                <div className={`relative overflow-hidden rounded-[1.35rem] border p-4 sm:rounded-[1.65rem] sm:p-4 ${tone.image}`}>
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0">
                      <p className={`text-[7.5px] font-black tracking-[0.2em] text-[#FF7A16] sm:text-[9px]`}>
                        {card.eyebrow}
                      </p>
                      <h3 className="mt-1.5 break-keep text-[0.95rem] font-black leading-[1.22] text-[#14295F] sm:text-[1.18rem]">
                        {card.title}
                      </h3>
                    </div>
                    <span className={`hidden rounded-full border px-2.5 py-1 text-[10px] font-black shadow-[0_8px_18px_rgba(20,41,95,0.06)] sm:inline-flex ${tone.badge}`}>
                      {card.badge}
                    </span>
                  </div>

                  <div className="mt-4 sm:mt-4">
                    <div className="relative min-h-[16.5rem] overflow-hidden rounded-[1.15rem] border border-dashed border-[#14295F]/14 bg-white/88 sm:min-h-[15rem] sm:rounded-[1.4rem]">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.72),transparent_58%)]" />
                      <div className={`absolute left-1/2 top-[30%] h-16 w-16 -translate-x-1/2 rounded-[1.2rem] border border-white bg-white shadow-[0_14px_28px_rgba(20,41,95,0.08)] sm:top-[34%] sm:h-16 sm:w-16 sm:rounded-[1.3rem]`} />
                      <div className="absolute inset-x-[8%] bottom-[10%] rounded-[1.05rem] border border-white/75 bg-white/88 px-4 py-4 text-center shadow-[0_16px_28px_rgba(20,41,95,0.07)] backdrop-blur sm:rounded-[1.2rem] sm:px-4 sm:py-4">
                        <p className="text-[9px] font-black tracking-[0.18em] text-[#FF7A16] sm:text-[9.5px]">PHOTO PLACEHOLDER</p>
                        <p className="mt-2 break-keep text-[1rem] font-black leading-[1.24] text-[#14295F] sm:text-[1.02rem]">
                          실제 사진 예정
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black sm:hidden ${tone.badge}`}>
                      {card.badge}
                    </span>
                    <p className="mt-3 break-keep text-[12px] font-semibold leading-[1.72] text-[#51667D] sm:text-[13px] sm:leading-[1.75]">
                      {card.summary}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
