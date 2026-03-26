import { ArrowRight, BookOpen } from 'lucide-react';

export function KoreanClassSection() {
  return (
    <section
      id="korean-class"
      className="relative scroll-mt-20 overflow-hidden py-10 sm:py-12"
      style={{ background: 'linear-gradient(180deg, #f2f6ff 0%, #edf1fb 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="brand-glow-drift absolute left-[10%] top-[18%] h-36 w-36 rounded-full bg-[#8CB7FF]/10 blur-[90px]" />
        <div
          className="brand-glow-drift absolute right-[6%] top-[8%] h-40 w-40 rounded-full bg-[#FFB878]/12 blur-[100px]"
          style={{ animationDelay: '-2.3s' }}
        />
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="space-y-5">
          <div className="brand-sheen-panel relative overflow-hidden rounded-[1.85rem] border border-[rgba(255,122,22,0.18)] bg-[linear-gradient(135deg,rgba(255,255,255,0.97)_0%,rgba(255,244,236,0.99)_100%)] px-7 py-7 shadow-[0_22px_52px_rgba(20,41,95,0.10)] sm:px-10 sm:py-9 lg:px-12 lg:py-10">
            <div className="brand-glow-drift absolute -right-10 -top-8 h-32 w-32 rounded-full bg-[#FFB878]/24 blur-3xl" />
            <div className="brand-glow-drift absolute left-[-3%] bottom-[-20%] h-32 w-32 rounded-full bg-[#FFD7B5]/22 blur-3xl" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-3xl space-y-3">
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#FF7A16]">
                  실전 모의고사 운영
                </p>
                <h3 className="break-keep text-[1.22rem] font-black leading-[1.38] text-[#14295F] sm:text-[1.45rem] lg:text-[1.62rem]">
                  매달 더프와 사설 모의고사를 함께 운영해
                  <br className="hidden sm:block" />실전 감각과 국어 대응력을 꾸준히 점검합니다
                </h3>
                <p className="break-keep text-[14px] font-semibold leading-[1.78] text-slate-500 sm:text-[15px]">
                  더프, 사설 모의고사와 함께 국어는 이감, 시대인재 서바이벌 등도
                  제휴 협의 중인 흐름으로 준비하고 있습니다.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5 sm:max-w-[360px] sm:justify-end">
                {['매달 더프 실시', '사설 모의고사 운영', '국어 실전 대비 점검'].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[rgba(255,122,22,0.18)] bg-white/90 px-3.5 py-2 text-[11.5px] font-black text-[#C25A00] shadow-[0_10px_20px_rgba(255,122,22,0.10)] sm:px-4 sm:text-[12px]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="brand-sheen-panel relative flex flex-col items-center gap-5 rounded-[1.4rem] border border-[rgba(20,41,95,0.1)] bg-white px-7 py-7 text-center shadow-[0_16px_34px_rgba(20,41,95,0.07)] sm:flex-row sm:gap-8 sm:px-10 sm:text-left">
            <div className="brand-glow-drift absolute -right-8 top-4 h-24 w-24 rounded-full bg-[#FFB878]/14 blur-3xl" />
            <div className="brand-glow-drift mx-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#14295F]/7 sm:mx-0">
              <BookOpen className="h-5 w-5 text-[#14295F]/70" />
            </div>

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

            <a
              href="#consult"
              className="brand-cta-float shrink-0 inline-flex items-center gap-2 whitespace-nowrap rounded-[0.8rem] bg-[#14295F] px-6 py-3 text-[13px] font-black text-white transition-all hover:bg-[#14295F]/90"
            >
              수업 문의하기
              <ArrowRight className="brand-cta-arrow h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
