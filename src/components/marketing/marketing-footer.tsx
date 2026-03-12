import Image from "next/image";
import Link from "next/link";

import type { MarketingContent } from "@/lib/marketing-content";

type MarketingFooterProps = {
  brand: MarketingContent["brand"];
  footer: MarketingContent["footer"];
};

export function MarketingFooter({ brand, footer }: MarketingFooterProps) {
  return (
    <footer className="border-t border-[#14295F]/10 bg-white py-10">
      <div className="mx-auto grid w-full max-w-7xl gap-7 px-4 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
        <div>
          <div className="inline-flex items-center gap-3">
            <Image src={brand.logoMark} alt={`${brand.name} 로고`} width={36} height={36} className="h-9 w-9 rounded-md object-cover" />
            <p className="font-display text-base font-bold text-[#14295F]">{brand.name}</p>
          </div>
          <p className="mt-4 break-keep text-sm font-bold leading-relaxed text-slate-600">{footer.line}</p>
          <div className="mt-5 flex gap-2">
            <a
              href="#consult"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#FF7A16] px-4 text-xs font-black text-white transition hover:bg-[#f06905]"
            >
              상담 문의
            </a>
            <Link
              href="/app"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-[#14295F]/25 px-4 text-xs font-black text-[#14295F] transition hover:bg-[#F6F9FF]"
            >
              웹앱 바로가기
            </Link>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-[#14295F]/10 bg-[#F8FAFF] p-5">
          <p className="text-sm font-bold text-[#14295F]/85">{footer.phone}</p>
          <p className="break-keep text-sm font-bold text-[#14295F]/85">{footer.location}</p>
          <p className="text-sm font-bold text-[#14295F]/85">{footer.hours}</p>
        </div>
      </div>
    </footer>
  );
}
