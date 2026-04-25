import { CheckCircle2, ClipboardCheck, MessageCircle, Phone } from "lucide-react";

const consultSteps = [
  {
    icon: ClipboardCheck,
    title: "문의 접수",
    description: "아래 상담 폼을 남겨주시면 학생 정보와 희망 유형을 먼저 확인합니다.",
  },
  {
    icon: Phone,
    title: "담당자 연락",
    description: "남겨주신 연락처로 상담 가능 여부와 다음 절차를 안내드립니다.",
  },
  {
    icon: MessageCircle,
    title: "상담 진행",
    description: "학생의 현재 학습 흐름과 필요한 관리 방식을 함께 확인합니다.",
  },
];

export function ConsultReservationCard() {
  return (
    <article
      className="brand-sheen-panel overflow-hidden rounded-[1.5rem] border p-5 sm:rounded-[2rem] sm:p-6"
      style={{
        borderColor: "rgba(255,255,255,0.10)",
        background:
          "linear-gradient(180deg, rgba(11,28,69,0.98) 0%, rgba(20,41,95,0.98) 62%, rgba(16,34,78,0.98) 100%)",
        boxShadow: "0 24px 60px -30px rgba(3, 10, 27, 0.7)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black tracking-[0.22em] text-[#FFB273]">CONSULT FLOW</p>
          <h3 className="mt-2 break-keep text-[1.55rem] font-black tracking-[-0.04em] text-white sm:text-[1.9rem]">
            상담 접수 후
            <br />
            순차적으로 안내드려요
          </h3>
          <p className="mt-3 break-keep text-sm font-semibold leading-6 text-white/72">
            온라인에서는 상담 신청만 간단히 남겨주세요. 세부 일정과 준비 사항은 담당자가 직접 확인해 안내합니다.
          </p>
        </div>
        <div className="hidden rounded-full border border-white/10 bg-white/[0.08] p-3 text-white/80 sm:block">
          <Phone className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {consultSteps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="rounded-[1.25rem] border border-white/10 bg-white/[0.06] px-4 py-4"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF7A16] text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-black text-white">{step.title}</p>
                  <p className="mt-1 break-keep text-xs font-semibold leading-5 text-white/70">{step.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-[1.35rem] border border-[#FFB273]/20 bg-[#FFF2E8] p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FF7A16]" />
          <p className="break-keep text-sm font-black leading-6 text-[#14295F]">
            상담 폼 접수 후 실제 상담 일정과 준비 사항은 개별 연락으로 안내드립니다.
          </p>
        </div>
      </div>

      <a
        href="#consult-form"
        className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-[1rem] bg-[#FF7A16] px-4 text-sm font-black text-white transition hover:bg-[#e86d11]"
      >
        상담 폼 작성하기
      </a>
    </article>
  );
}
