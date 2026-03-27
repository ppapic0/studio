import Image from 'next/image';
import { ShieldCheck, Wifi } from 'lucide-react';

import type { MarketingContent } from '@/lib/marketing-content';

type CenterEnvironmentSectionProps = {
  centerEnvironment: MarketingContent['centerEnvironment'];
};

export function CenterEnvironmentSection({ centerEnvironment }: CenterEnvironmentSectionProps) {
  return (
    <section
      id="center-environment"
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
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">NETWORK SAFETY</p>
                  <p className="mt-1 break-keep text-[0.98rem] font-black leading-[1.35] text-[#14295F]">
                    학습 집중을 위한 보안 운영
                  </p>
                </div>
              </div>
              <p className="mt-4 break-keep text-[13px] font-semibold leading-[1.72] text-[#51667D]">
                학생이 공부 흐름에서 벗어나지 않도록 센터 전체 네트워크를 같은 기준으로 관리합니다.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#F7FAFF] px-3 py-2 text-[11px] font-black text-[#14295F]">
                <Wifi className="h-3.5 w-3.5 text-[#FF7A16]" />
                센터 전체 동일 적용
              </div>
            </div>
          </div>
        </article>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {centerEnvironment.photos.map((photo, index) => (
            <article
              key={photo.title}
              className="marketing-card brand-sheen-panel overflow-hidden p-3 sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[8.5px] font-black tracking-[0.16em] text-[#FF7A16] sm:text-[10px]">CENTER 0{index + 1}</p>
                  <h3 className="mt-1.5 break-keep text-[0.9rem] font-black leading-[1.28] text-[#14295F] sm:mt-2 sm:text-[1.1rem]">
                    {photo.title}
                  </h3>
                </div>
                <span className="rounded-full border border-[#14295F]/10 bg-[#F7FAFF] px-2.5 py-1 text-[8.5px] font-black text-[#425A75] sm:px-3 sm:text-[10px]">
                  <span className="sm:hidden">사진 예정</span>
                  <span className="hidden sm:inline">실제 사진 예정</span>
                </span>
              </div>

              <div className="mt-3 rounded-[1rem] border border-[#14295F]/10 bg-[linear-gradient(160deg,#F7FAFF_0%,#FFFFFF_100%)] p-2 sm:mt-4 sm:rounded-[1.25rem] sm:p-3">
                <div className="relative aspect-[5/4] overflow-hidden rounded-[0.85rem] border border-dashed border-[#14295F]/14 bg-white sm:aspect-[4/3] sm:rounded-[1rem]">
                  {photo.image ? (
                    <Image
                      src={photo.image}
                      alt={photo.alt}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,122,22,0.10),transparent_34%),linear-gradient(160deg,#F9FBFF_0%,#FFFFFF_100%)] px-3 text-center sm:px-6">
                      <div className="h-8 w-8 rounded-[0.9rem] border border-[#FF7A16]/14 bg-white shadow-[0_14px_28px_rgba(20,41,95,0.06)] sm:h-14 sm:w-14 sm:rounded-[1.25rem]" />
                      <p className="mt-2.5 text-[8.5px] font-black tracking-[0.14em] text-[#FF7A16] sm:mt-4 sm:text-[11px]">CENTER PHOTO</p>
                      <p className="mt-1.5 break-keep text-[0.78rem] font-black leading-[1.28] text-[#14295F] sm:mt-2 sm:text-[0.98rem]">
                        <span className="sm:hidden">센터 사진 예정</span>
                        <span className="hidden sm:inline">실제 센터 사진 예정</span>
                      </p>
                      <p className="mt-1.5 break-keep text-[10px] font-semibold leading-[1.45] text-[#5B7087] sm:mt-2 sm:text-[12px] sm:leading-[1.7]">
                        <span className="sm:hidden">준비 후 반영</span>
                        <span className="hidden sm:inline">준비되면 이 자리에 바로 반영됩니다.</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <p className="mt-3 break-keep text-[11px] font-semibold leading-[1.62] text-[#52667D] sm:mt-4 sm:text-[12.8px] sm:leading-[1.72]">
                {photo.summary}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
