import Image from 'next/image';

const scoreSheetProofs = [
  {
    label: '6월 모의평가',
    caption: '국어 3등급 · 백분위 82',
    image: '/marketing/proof/june-score-sheet-proof-v6.jpg',
  },
  {
    label: '9월 모의평가',
    caption: '국어 1등급 · 백분위 96',
    image: '/marketing/proof/september-score-sheet-proof-v6.jpg',
  },
  {
    label: '수능',
    caption: '국어 백분위 99',
    image: '/marketing/proof/csat-score-sheet-proof-v6.jpg',
  },
] as const;

export function HomeGrowthProofSection() {
  return (
    <section
      id="growth-proof"
      className="scroll-mt-24 py-16 sm:py-20"
      style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f6f8fc 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <article className="brand-sheen-panel mt-6 overflow-hidden rounded-[1.6rem] border border-[#14295F]/12 bg-white shadow-[0_18px_40px_rgba(20,41,95,0.10)]">
          <div className="border-b border-[#14295F]/8 bg-[linear-gradient(135deg,#FFF8F1_0%,#F8FBFF_100%)] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">ACTUAL SCORE SHEETS</p>
                <h3 className="mt-2 break-keep text-[1.18rem] font-black leading-[1.4] text-[#14295F] sm:text-[1.3rem]">
                  실제 모의고사 성적표로 변화 흐름을 확인합니다
                </h3>
              </div>

              <div className="inline-flex items-center rounded-full border border-[#14295F]/10 bg-white px-3 py-1.5 text-[11px] font-black text-[#14295F]/72 shadow-[0_8px_18px_rgba(20,41,95,0.06)]">
                개인정보 마스킹 완료
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-2 lg:grid-cols-3">
            {scoreSheetProofs.map((item) => (
              <article
                key={item.image}
                className="brand-sheen-panel overflow-hidden rounded-[1.3rem] border border-[#14295F]/10 bg-white shadow-[0_12px_26px_rgba(20,41,95,0.06)]"
              >
                <div className="px-4 pb-4 pt-4">
                  <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">{item.label}</p>
                  <div className="mt-3 rounded-[1.1rem] border border-[#14295F]/8 bg-[#F8FBFF] p-3">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-[0.95rem] bg-white">
                      <Image
                        src={item.image}
                        alt={`${item.label} 성적표`}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-contain"
                      />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
