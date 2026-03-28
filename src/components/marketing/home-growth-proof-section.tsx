import Image from 'next/image';

const scoreSheetProofs = [
  {
    label: '6월 모의평가',
    mobileLabel: '6모',
    caption: '국어 3등급 · 백분위 82',
    mobileCaption: '3등급 · 82',
    image: '/marketing/proof/june-score-sheet-proof-v6.jpg',
  },
  {
    label: '9월 모의평가',
    mobileLabel: '9모',
    caption: '국어 1등급 · 백분위 96',
    mobileCaption: '1등급 · 96',
    image: '/marketing/proof/september-score-sheet-proof-v6.jpg',
  },
  {
    label: '수능',
    mobileLabel: '수능',
    caption: '국어 백분위 99',
    mobileCaption: '백분위 99',
    image: '/marketing/proof/csat-score-sheet-proof-v6.jpg',
  },
] as const;

export function HomeGrowthProofSection() {
  return (
    <section
      id="growth-proof"
      className="scroll-mt-24 py-12 sm:py-20"
      style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f6f8fc 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <article className="brand-sheen-panel overflow-hidden rounded-[1.6rem] border border-[#14295F]/12 bg-white shadow-[0_18px_40px_rgba(20,41,95,0.10)]">
          <div className="border-b border-[#14295F]/8 bg-[linear-gradient(135deg,#FFF8F1_0%,#F8FBFF_100%)] px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">ACTUAL SCORE SHEETS</p>
                <h3 className="mt-2 break-keep text-[1.18rem] font-black leading-[1.4] text-[#14295F] sm:text-[1.3rem]">
                  실제 모의고사 성적표로 변화 흐름을 확인합니다
                </h3>
                <p className="mt-2 break-keep text-[13px] font-semibold leading-[1.78] text-[#425a75]">
                  원장 국어 수업과 전과목 밸런스 코칭이 함께 들어간 학생 사례입니다.
                </p>
              </div>

              <div className="inline-flex items-center rounded-full border border-[#14295F]/10 bg-white px-3 py-1.5 text-[11px] font-black text-[#14295F]/72 shadow-[0_8px_18px_rgba(20,41,95,0.06)]">
                개인정보 마스킹 완료
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 p-3.5 sm:grid-cols-3 sm:gap-4 sm:p-6">
            {scoreSheetProofs.map((item) => (
              <article
                key={item.image}
                className="brand-sheen-panel min-w-0 overflow-hidden rounded-[1rem] border border-[#14295F]/10 bg-white shadow-[0_12px_26px_rgba(20,41,95,0.06)] sm:rounded-[1.3rem]"
              >
                <div className="px-2.5 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
                  <p className="text-[8.5px] font-black tracking-[0.08em] text-[#FF7A16] sm:text-[10px]">
                    <span className="sm:hidden">{item.mobileLabel}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </p>
                  <div className="mt-2 rounded-[0.85rem] border border-[#14295F]/8 bg-[#F8FBFF] p-1.5 sm:mt-3 sm:rounded-[1.1rem] sm:p-3">
                    <div className="relative aspect-[5/6] overflow-hidden rounded-[0.95rem] bg-white sm:aspect-[3/4]">
                      <Image
                        src={item.image}
                        alt={`${item.label} 성적표`}
                        fill
                        sizes="(max-width: 640px) 92vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-contain"
                      />
                    </div>
                  </div>
                  <p className="mt-2 break-keep text-[11px] font-black leading-[1.4] text-[#14295F] sm:mt-3 sm:text-[13px]">
                    <span className="sm:hidden">{item.caption}</span>
                    <span className="hidden sm:inline">{item.caption}</span>
                  </p>
                </div>
              </article>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
