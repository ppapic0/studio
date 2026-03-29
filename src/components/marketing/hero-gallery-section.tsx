const heroGalleryCards = [
  {
    eyebrow: 'CENTER 01',
    title: '센터 전경',
    summary: '입실 순간부터 차분한 분위기와 운영 기준이 느껴지는 공간입니다.',
    tone: 'center',
  },
  {
    eyebrow: 'CENTER 02',
    title: '학습 공간',
    summary: '오래 앉아도 집중 흐름이 유지되도록 설계한 메인 학습 공간입니다.',
    tone: 'center',
  },
  {
    eyebrow: 'CLASS 01',
    title: '국어 수업 장면',
    summary: '원장 직강 수업의 실제 분위기와 설명 밀도가 보이는 장면을 담습니다.',
    tone: 'class',
  },
  {
    eyebrow: 'CLASS 02',
    title: '수업 자료 · 피드백',
    summary: '자료와 피드백이 어떻게 연결되는지 한눈에 보이도록 보여드립니다.',
    tone: 'class',
  },
] as const;

export function HeroGallerySection() {
  return (
    <section
      className="py-12 sm:py-16"
      style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f7f9fd 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-[10px] font-black tracking-[0.22em] text-[#FF7A16]">TRACK SPACE & CLASS</p>
          <h2 className="mt-4 break-keep text-[clamp(1.7rem,4.8vw,3rem)] font-black leading-[1.28] text-[#14295F]">
            트랙 관리형 스터디센터 및
            <br />
            트랙 국어학원에서는 최고의
            <br />
            수업분위기와, 최적의 관리를 제공합니다
          </h2>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4 lg:gap-5">
          {heroGalleryCards.map((card) => (
            <article
              key={card.title}
              className="brand-sheen-panel overflow-hidden rounded-[1.25rem] border border-[#14295F]/10 bg-white p-3 shadow-[0_16px_34px_rgba(20,41,95,0.08)] sm:rounded-[1.7rem] sm:p-4 lg:p-5"
            >
              <p className="text-[8px] font-black tracking-[0.18em] text-[#FF7A16] sm:text-[10px]">{card.eyebrow}</p>
              <h3 className="mt-2 break-keep text-[0.98rem] font-black leading-[1.28] text-[#14295F] sm:text-[1.18rem]">
                {card.title}
              </h3>

              <div
                className={`mt-3 flex min-h-[10rem] items-center justify-center rounded-[1rem] border p-3 text-center sm:min-h-[13rem] sm:rounded-[1.25rem] sm:p-4 ${
                  card.tone === 'center'
                    ? 'border-[#14295F]/10 bg-[linear-gradient(160deg,#F7FAFF_0%,#FFFFFF_100%)]'
                    : 'border-[#FF7A16]/12 bg-[linear-gradient(160deg,#FFF9F2_0%,#FFFFFF_100%)]'
                }`}
              >
                <div className="w-full rounded-[0.95rem] border border-dashed border-[#14295F]/14 bg-white/90 px-3 py-8 sm:px-4 sm:py-10">
                  <div className="mx-auto h-9 w-9 rounded-[0.9rem] border border-[#FF7A16]/14 bg-white shadow-[0_12px_24px_rgba(20,41,95,0.06)] sm:h-11 sm:w-11 sm:rounded-[1rem]" />
                  <p className="mt-3 text-[8.5px] font-black tracking-[0.15em] text-[#FF7A16] sm:text-[10px]">PHOTO PLACEHOLDER</p>
                  <p className="mt-2 break-keep text-[0.9rem] font-black leading-[1.3] text-[#14295F] sm:text-[1rem]">
                    실제 사진 예정
                  </p>
                </div>
              </div>

              <p className="mt-3 break-keep text-[11px] font-semibold leading-[1.65] text-[#51667D] sm:text-[13px] sm:leading-[1.75]">
                {card.summary}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
