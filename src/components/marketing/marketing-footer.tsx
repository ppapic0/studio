import Image from "next/image";
import Link from "next/link";

import type { MarketingContent } from "@/lib/marketing-content";

type MarketingFooterProps = {
  brand: MarketingContent["brand"];
  footer: MarketingContent["footer"];
};

export function MarketingFooter({ brand, footer }: MarketingFooterProps) {
  return (
    <footer className="border-t border-white/10 bg-[#08173E] py-10">
      <div className="mx-auto grid w-full max-w-7xl gap-7 px-4 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
        <div>
          <div className="inline-flex items-center gap-3">
            <Image src={brand.logoMark} alt={`${brand.name} 로고`} width={36} height={36} className="h-9 w-9 rounded-md object-cover" />
            <p className="text-base font-black text-white">{brand.name}</p>
          </div>
          <p className="mt-4 break-keep text-sm font-bold leading-relaxed text-white/75">{footer.line}</p>
          <div className="mt-5 flex gap-2">
            <a
              href="#consult"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#FF7A16] px-4 text-xs font-black text-white transition hover:bg-[#f06905]"
            >
              상담 문의
            </a>
            <Link
              href="/app"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-white/25 px-4 text-xs font-black text-white transition hover:bg-white/10"
            >
              웹앱 바로가기
            </Link>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm font-bold text-white/80">{footer.phone}</p>
          <p className="text-sm font-bold text-white/80">{footer.location}</p>
          <p className="text-sm font-bold text-white/80">{footer.hours}</p>
        </div>
      </div>
    </footer>
  );
}
