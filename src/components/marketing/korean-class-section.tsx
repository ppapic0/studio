import { ArrowRight, BookOpen } from 'lucide-react';

export function KoreanClassSection() {
  return (
    <section
      id="korean-class"
      className="scroll-mt-20 py-10 sm:py-12"
      style={{ background: 'linear-gradient(180deg, #f2f6ff 0%, #edf1fb 100%)' }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-5 rounded-[1.4rem] border border-[rgba(20,41,95,0.1)] bg-white px-7 py-7 text-center sm:flex-row sm:gap-8 sm:px-10 sm:text-left">
          {/* Icon */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#14295F]/7 mx-auto sm:mx-0">
            <BookOpen className="h-5 w-5 text-[#14295F]/70" />
          </div>

          {/* Text */}
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF7A16]">
              국어 수업 연결
            </p>
            <h3 className="mt-1 break-keep text-[1.05rem] font-black text-[#14295F]">
              수능 국어 수업은 필요할 때 선택합니다
            </h3>
            <p className="mt-1.5 break-keep text-[13px] font-semibold text-slate-500">
              센터 이용과 수업은 분리됩니다. 재학생·N수생 모두 등록 가능하며,
              국어 수업은 별도로 추가할 수 있습니다.
            </p>
          </div>

          {/* CTA */}
          <a
            href="#consult"
            className="shrink-0 inline-flex items-center gap-2 rounded-[0.8rem] bg-[#14295F] px-6 py-3 text-[13px] font-black text-white transition-all hover:bg-[#14295F]/90 whitespace-nowrap"
          >
            수업 문의하기
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
