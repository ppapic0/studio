"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

type ServiceType = "korean_academy" | "study_center";
type StudyCenterRequestType = "consult" | "waitlist";

type FormState = {
  studentName: string;
  school: string;
  grade: string;
  gender: string;
  consultPhone: string;
  serviceType: ServiceType;
  studyCenterRequestType: StudyCenterRequestType;
};

type ReceiptInfo = {
  receiptId: string;
  createdAt: string;
  studentName: string;
  school: string;
  grade: string;
  gender: string;
  consultPhone: string;
  requestTypeLabel: string;
};

const INITIAL_FORM: FormState = {
  studentName: "",
  school: "",
  grade: "",
  gender: "",
  consultPhone: "",
  serviceType: "korean_academy",
  studyCenterRequestType: "consult",
};

const GRADE_OPTIONS = ["중3", "고1", "고2", "고3", "N수생"];

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function formatKoreaTime(isoString: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

function ReceiptCard({ receipt, onReset }: { receipt: ReceiptInfo; onReset: () => void }) {
  return (
    <div id="consult-form" className="marketing-card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        <p className="text-xs font-black tracking-[0.14em] text-emerald-600">접수 완료</p>
      </div>
      <h3 className="mt-2 text-xl font-black text-[#14295F]">신청이 접수되었습니다</h3>
      <p className="mt-1 text-sm text-[#14295F]/60">
        아래 내용을 스크린샷으로 저장하시면 나중에 접수 확인에 사용할 수 있습니다.
      </p>

      <div
        className="mt-5 rounded-xl border-2 border-dashed border-[#14295F]/20 bg-[#14295F]/[0.03] p-4"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-black tracking-[0.16em] text-[#14295F]/40">접수 확인 번호</p>
          <p className="font-black tracking-widest text-[#FF7A16]">{receipt.receiptId}</p>
        </div>

        <div className="space-y-2.5 border-t border-[#14295F]/10 pt-3">
          {[
            { label: "신청 유형", value: receipt.requestTypeLabel },
            { label: "학생 이름", value: receipt.studentName },
            { label: "학교 / 학년", value: `${receipt.school} ${receipt.grade}` },
            { label: "성별", value: receipt.gender },
            { label: "연락처", value: receipt.consultPhone },
            { label: "접수 일시", value: formatKoreaTime(receipt.createdAt) },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <span className="font-bold text-[#14295F]/50">{label}</span>
              <span className="font-black text-[#14295F] sm:text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-xs font-bold leading-relaxed text-amber-700">
        📞 담당 선생님이 확인 후 등록하신 연락처로 연락드릴 예정입니다.
        <br />
        접수 확인 번호로{" "}
        <a href="/consult/check" className="underline underline-offset-2">
          접수 내역 조회
        </a>
        도 가능합니다.
      </p>

      <button
        type="button"
        onClick={onReset}
        className="mt-4 h-10 w-full rounded-lg border border-[#14295F]/20 text-sm font-bold text-[#14295F]/60 transition hover:border-[#14295F]/40 hover:text-[#14295F]"
      >
        새로운 신청 작성하기
      </button>
    </div>
  );
}

type ConsultFormProps = {
  waitlistCount?: number;
};

export function ConsultForm({ waitlistCount = 0 }: ConsultFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptInfo | null>(null);

  const isDisabled = useMemo(() => {
    return (
      submitting ||
      form.studentName.trim().length === 0 ||
      form.school.trim().length === 0 ||
      form.grade.length === 0 ||
      form.gender.length === 0 ||
      normalizePhone(form.consultPhone).length < 8
    );
  }, [form, submitting]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const normalizedPhone = normalizePhone(form.consultPhone);

    try {
      const response = await fetch("/api/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, consultPhone: normalizedPhone }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        message?: string;
        receiptId?: string;
        createdAt?: string;
        requestTypeLabel?: string;
      };

      if (!response.ok || !data.ok) {
        setError(data.message ?? "접수 중 오류가 발생했습니다.");
        return;
      }

      setReceipt({
        receiptId: data.receiptId ?? "--------",
        createdAt: data.createdAt ?? new Date().toISOString(),
        studentName: form.studentName,
        school: form.school,
        grade: form.grade,
        gender: form.gender,
        consultPhone: normalizedPhone,
        requestTypeLabel: data.requestTypeLabel ?? "상담 신청",
      });
      setForm(INITIAL_FORM);
    } catch (err) {
      console.error("[consult-form] submit error", err);
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  if (receipt) {
    return <ReceiptCard receipt={receipt} onReset={() => setReceipt(null)} />;
  }

  return (
    <form id="consult-form" onSubmit={onSubmit} className="marketing-card p-4 sm:p-5">
      <p className="text-xs font-black tracking-[0.14em] text-[#FF7A16]">CONSULT FORM</p>
      <h3 className="mt-2 text-xl font-black text-[#14295F]">입학 상담 요청</h3>

      {/* 서비스 유형 탭 */}
      <div className="mt-5 flex rounded-xl border border-[#14295F]/15 p-1">
        <button
          type="button"
          onClick={() => setField("serviceType", "korean_academy")}
          className={`flex-1 rounded-lg py-2 text-sm font-black transition ${
            form.serviceType === "korean_academy"
              ? "bg-[#14295F] text-white shadow-sm"
              : "text-[#14295F]/60 hover:text-[#14295F]"
          }`}
        >
          국어 학원 상담
        </button>
        <button
          type="button"
          onClick={() => setField("serviceType", "study_center")}
          className={`flex-1 rounded-lg py-2 text-sm font-black transition ${
            form.serviceType === "study_center"
              ? "bg-[#14295F] text-white shadow-sm"
              : "text-[#14295F]/60 hover:text-[#14295F]"
          }`}
        >
          관리형 스터디센터
        </button>
      </div>

      {/* 관리형 스터디센터: 상담 vs 입학 대기 */}
      {form.serviceType === "study_center" && (
        <>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          {(
            [
              { value: "consult", label: "상담 신청" },
              { value: "waitlist", label: "입학 대기 신청" },
            ] as { value: StudyCenterRequestType; label: string }[]
          ).map((option) => (
            <label
              key={option.value}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-bold transition ${
                form.studyCenterRequestType === option.value
                  ? "border-[#FF7A16] bg-orange-50 text-[#FF7A16]"
                  : "border-[#14295F]/15 text-[#14295F]/60 hover:border-[#14295F]/30"
              }`}
            >
              <input
                type="radio"
                name="studyCenterRequestType"
                value={option.value}
                checked={form.studyCenterRequestType === option.value}
                onChange={() => setField("studyCenterRequestType", option.value)}
                className="sr-only"
              />
              <span
                className={`h-3.5 w-3.5 rounded-full border-2 ${
                  form.studyCenterRequestType === option.value
                    ? "border-[#FF7A16] bg-[#FF7A16]"
                    : "border-[#14295F]/30"
                }`}
              />
              {option.label}
            </label>
          ))}
        </div>
          {waitlistCount > 0 ? (
            <div className="mt-3 rounded-xl border border-[#FF7A16]/25 bg-[#FFF4EC] px-4 py-3">
              <p className="text-[11px] font-black tracking-[0.16em] text-[#FF7A16]">WAITLIST STATUS</p>
              <div className="mt-1 flex items-end gap-1.5 text-[#14295F]">
                <span className="text-2xl font-black leading-none">{waitlistCount}</span>
                <span className="text-sm font-black">명 대기 중</span>
              </div>
              <p className="mt-1 text-xs font-bold leading-relaxed text-[#14295F]/70">
                관리형 스터디센터는 접수 순서대로 안내하고 있습니다.
              </p>
            </div>
          ) : null}
        </>
      )}

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="studentName" className="mb-1.5 block text-sm font-black text-[#14295F]">
            학생 이름
          </label>
          <input
            id="studentName"
            value={form.studentName}
            onChange={(e) => setField("studentName", e.target.value)}
            maxLength={15}
            placeholder="예: 김트랙"
            className="h-11 w-full rounded-lg border border-[#14295F]/15 px-3 text-sm font-bold text-[#14295F] outline-none transition focus:border-[#FF7A16]"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="school" className="mb-1.5 block text-sm font-black text-[#14295F]">
              학교
            </label>
            <input
              id="school"
              value={form.school}
              onChange={(e) => setField("school", e.target.value)}
              maxLength={15}
              placeholder="예: 동백고등학교"
              className="h-11 w-full rounded-lg border border-[#14295F]/15 px-3 text-sm font-bold text-[#14295F] outline-none transition focus:border-[#FF7A16]"
            />
          </div>

          <div>
            <label htmlFor="grade" className="mb-1.5 block text-sm font-black text-[#14295F]">
              학년
            </label>
            <select
              id="grade"
              value={form.grade}
              onChange={(e) => setField("grade", e.target.value)}
              className="h-11 w-full rounded-lg border border-[#14295F]/15 px-3 text-sm font-bold text-[#14295F] outline-none transition focus:border-[#FF7A16]"
            >
              <option value="" disabled>
                선택
              </option>
              {GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-black text-[#14295F]">성별</p>
          <div className="flex gap-3">
            {(["남", "여"] as const).map((g) => (
              <label
                key={g}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-bold transition ${
                  form.gender === g
                    ? "border-[#14295F] bg-[#14295F] text-white"
                    : "border-[#14295F]/15 text-[#14295F]/60 hover:border-[#14295F]/30"
                }`}
              >
                <input
                  type="radio"
                  name="gender"
                  value={g}
                  checked={form.gender === g}
                  onChange={() => setField("gender", g)}
                  className="sr-only"
                />
                {g}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="consultPhone" className="mb-1.5 block text-sm font-black text-[#14295F]">
            상담 번호(연락처)
          </label>
          <input
            id="consultPhone"
            value={form.consultPhone}
            onChange={(e) => setField("consultPhone", e.target.value)}
            maxLength={15}
            placeholder="예: 010-1234-5678"
            className="h-11 w-full rounded-lg border border-[#14295F]/15 px-3 text-sm font-bold text-[#14295F] outline-none transition focus:border-[#FF7A16]"
          />
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isDisabled}
        className="premium-cta premium-cta-primary mt-5 h-12 w-full gap-2 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            접수 중...
          </>
        ) : form.serviceType === "study_center" && form.studyCenterRequestType === "waitlist" ? (
          "입학 대기 신청 접수"
        ) : (
          "상담 요청 접수"
        )}
      </button>
    </form>
  );
}
