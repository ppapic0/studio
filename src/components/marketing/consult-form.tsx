"use client";

import { FormEvent, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

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

const INITIAL_FORM: FormState = {
  studentName: "",
  school: "",
  grade: "",
  gender: "",
  consultPhone: "",
  serviceType: "korean_academy",
  studyCenterRequestType: "consult",
};

const GRADE_OPTIONS = ["중1", "중2", "중3", "고1", "고2", "고3"];

export function ConsultForm() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const isDisabled = useMemo(() => {
    return (
      submitting ||
      form.studentName.trim().length === 0 ||
      form.school.trim().length === 0 ||
      form.grade.length === 0 ||
      form.gender.length === 0 ||
      form.consultPhone.trim().length === 0
    );
  }, [form, submitting]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setResult(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setResult({ type: "error", message: data.message ?? "접수 중 오류가 발생했습니다." });
        return;
      }

      setResult({ type: "success", message: data.message ?? "신청이 접수되었습니다." });
      setForm(INITIAL_FORM);
    } catch (error) {
      console.error("[consult-form] submit error", error);
      setResult({ type: "error", message: "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form id="consult-form" onSubmit={onSubmit} className="marketing-card p-5">
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
        <div className="mt-3 flex gap-3">
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
            placeholder="예: 김트랙"
            className="h-11 w-full rounded-lg border border-[#14295F]/15 px-3 text-sm font-bold text-[#14295F] outline-none transition focus:border-[#FF7A16]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="school" className="mb-1.5 block text-sm font-black text-[#14295F]">
              학교
            </label>
            <input
              id="school"
              value={form.school}
              onChange={(e) => setField("school", e.target.value)}
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
            placeholder="예: 010-1234-5678"
            className="h-11 w-full rounded-lg border border-[#14295F]/15 px-3 text-sm font-bold text-[#14295F] outline-none transition focus:border-[#FF7A16]"
          />
        </div>
      </div>

      {result ? (
        <p
          className={`mt-4 rounded-lg px-3 py-2 text-sm font-bold ${
            result.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {result.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isDisabled}
        className="premium-cta premium-cta-primary mt-5 h-11 w-full gap-2 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-60"
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
