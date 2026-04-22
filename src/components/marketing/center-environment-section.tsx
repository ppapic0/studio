import Image from 'next/image';
import { Armchair, Camera } from 'lucide-react';

import type { MarketingContent } from '@/lib/marketing-content';

type CenterEnvironmentSectionProps = {
  centerEnvironment: MarketingContent['centerEnvironment'];
};

export function CenterEnvironmentSection({ centerEnvironment }: CenterEnvironmentSectionProps) {
  const [overviewPhoto, ...seatPhotos] = centerEnvironment.photos;

  return (
    <section
      id="track-view"
      className="scroll-mt-28 py-12 sm:py-20"
      style={{ background: 'linear-gradient(180deg, #f6f8fc 0%, #ffffff 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <article className="marketing-card-warm brand-sheen-panel relative overflow-hidden px-4 py-5 sm:px-7 sm:py-8 lg:px-9 lg:py-9">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[-4%] top-[12%] h-32 w-32 rounded-full bg-[#FFB878]/16 blur-3xl sm:h-40 sm:w-40" />
            <div className="absolute right-[8%] top-[14%] h-24 w-24 rounded-full bg-[#14295F]/8 blur-3xl sm:h-32 sm:w-32" />
            <div className="absolute right-[-4%] bottom-[-14%] h-44 w-44 rounded-full border border-[#FF7A16]/10" />
            <div className="absolute left-[18%] top-[22%] hidden h-[1px] w-[32%] border-t border-dashed border-[#FF7A16]/20 lg:block" />
            <div className="absolute right-[15%] top-[38%] hidden h-[1px] w-[22%] border-t border-dashed border-[#14295F]/14 lg:block" />
          </div>

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="eyebrow-badge">{centerEnvironment.eyebrow}</span>
              <h2 className="mt-4 break-keep text-[clamp(1.55rem,7.9vw,2.8rem)] font-black leading-[1.14] text-[#14295F]">
                {centerEnvironment.title}
              </h2>
              <p className="mt-4 break-keep text-[13.5px] font-semibold leading-[1.8] text-[#425A75] sm:text-[15px]">
                {centerEnvironment.description}
              </p>

              <div className="mt-5 flex flex-wrap gap-2.5">
                {centerEnvironment.highlights.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-full border border-[#FF7A16]/14 bg-white/90 px-3.5 py-1.5 text-[11px] font-black text-[#B55200] shadow-[0_8px_18px_rgba(255,122,22,0.06)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="marketing-card relative w-full max-w-full shrink-0 border-[#14295F]/10 bg-white/92 p-4 sm:p-5 lg:w-[21rem] lg:max-w-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#14295F] text-white shadow-[0_12px_24px_rgba(20,41,95,0.18)]">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">TRACK VIEW GUIDE</p>
                  <p className="mt-1 break-keep text-[0.98rem] font-black leading-[1.35] text-[#14295F]">
                    실제 스터디센터 전경과 좌석 구성을 소개합니다
                  </p>
                </div>
              </div>
              <p className="mt-4 break-keep text-[13px] font-semibold leading-[1.72] text-[#51667D]">
                전경은 공간 분위기를 먼저 보여주고, 아래에서는 좌석 타입별 특징을 사진과 함께 바로 확인할 수 있게 구성했습니다.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {centerEnvironment.photos.slice(1).map((photo) => (
                  <span
                    key={photo.title}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#F7FAFF] px-3 py-2 text-[11px] font-black text-[#14295F]"
                  >
                    <Armchair className="h-3.5 w-3.5 text-[#FF7A16]" />
                    {photo.title}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </article>

        {overviewPhoto ? (
          <article className="marketing-card brand-sheen-panel mt-5 overflow-hidden p-4 sm:p-5 lg:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">TRACK 01</p>
                <h3 className="mt-2 break-keep text-[1.2rem] font-black leading-[1.2] text-[#14295F] sm:text-[1.55rem]">
                  {overviewPhoto.title}
                </h3>
              </div>
              <span className="rounded-full border border-[#14295F]/10 bg-[#F7FAFF] px-3 py-1.5 text-[10px] font-black text-[#425A75]">
                실제 공간 사진
              </span>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.9fr)] lg:items-end">
              <div className="relative aspect-[16/11] overflow-hidden rounded-[1.35rem] border border-[#14295F]/10 bg-white">
                {overviewPhoto.image ? (
                  <Image
                    src={overviewPhoto.image}
                    alt={overviewPhoto.alt}
                    fill
                    sizes="(max-width: 1024px) 92vw, 68vw"
                    className="object-cover"
                    priority
                  />
                ) : null}
              </div>
              <div className="rounded-[1.35rem] border border-[#14295F]/10 bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] p-5">
                <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">SPACE OVERVIEW</p>
                <p className="mt-3 break-keep text-[14px] font-semibold leading-[1.8] text-[#52667D] sm:text-[15px]">
                  {overviewPhoto.summary}
                </p>
              </div>
            </div>
          </article>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {seatPhotos.map((photo, index) => (
            <article
              key={photo.title}
              className="marketing-card brand-sheen-panel overflow-hidden p-4 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">
                    TRACK 0{index + 2}
                  </p>
                  <h3 className="mt-2 break-keep text-[1.08rem] font-black leading-[1.24] text-[#14295F] sm:text-[1.28rem]">
                    {photo.title}
                  </h3>
                </div>
                <span className="rounded-full border border-[#14295F]/10 bg-[#F7FAFF] px-3 py-1.5 text-[10px] font-black text-[#425A75]">
                  좌석 타입 소개
                </span>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-[#14295F]/10 bg-[linear-gradient(160deg,#F7FAFF_0%,#FFFFFF_100%)] p-3">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[1rem] border border-[#14295F]/10 bg-white sm:aspect-[4/3]">
                  {photo.image ? (
                    <Image
                      src={photo.image}
                      alt={photo.alt}
                      fill
                      sizes="(max-width: 1024px) 92vw, 46vw"
                      className="object-cover"
                    />
                  ) : null}
                </div>
              </div>

              <p className="mt-4 break-keep text-[12px] font-semibold leading-[1.72] text-[#52667D] sm:text-[13.5px]">
                {photo.summary}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
