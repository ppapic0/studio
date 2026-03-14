"use client";

import { FormEvent, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

type FormState = {
  studentName: string;
  school: string;
  consultPhone: string;
};

const INITIAL_FORM: FormState = {
  studentName: "",
  school: "",
  consultPhone: "",
};

export function ConsultForm() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const isDisabled = useMemo(() => {
    return (
      submitting ||
      form.studentName.trim().length === 0 ||
      form.school.trim().length === 0 ||
      form.consultPhone.trim().length === 0
    );
  }, [form, submitting]);

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

      setResult({ type: "success", message: data.message ?? "상담 요청이 접수되었습니다." });
      setForm(INITIAL_FORM);
    } catch (error) {
      console.error("[consult-form] submit error", error);
      setResult({ type: "error", message: "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      id="consult-form"
      onSubmit={onSubmit}
      className="marketing-card p-5"
    >
      <p className="text-xs font-black tracking-[0.14em] text-[#FF7A16]">CONSULT FORM</p>
      <h3 className="mt-2 text-xl font-black text-[#14295F]">입학 상담 요청</h3>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="studentName" className="mb-1.5 block text-sm font-black text-[#14295F]">
            학생 이름
          </label>
          <input
            id="studentName"
            value={form.studentName}
            onChange={(event) => setForm((prev) => ({ ...prev, studentName: event.target.value }))}
            placeholder="예: 김트랙"
            className="h-11 w-full rounded-lg border border-[#14295F]/15 px-3 text-sm font-bold text-[#14295F] outline-none transition focus:border-[#FF7A16]"
          />
        </div>

        <div>
          <label htmlFor="school" className="mb-1.5 block text-sm font-black text-[#14295F]">
            학교
          </label>
          <input
            id="school"
            value={form.school}
            onChange={(event) => setForm((prev) => ({ ...prev, school: event.target.value }))}
            placeholder="예: 동백고등학교"
            className="h-11 w-full rounded-lg border border-[#14295F]/15 px-3 text-sm font-bold text-[#14295F] outline-none transition focus:border-[#FF7A16]"
          />
        </div>

        <div>
          <label htmlFor="consultPhone" className="mb-1.5 block text-sm font-black text-[#14295F]">
            상담 번호(연락처)
          </label>
          <input
            id="consultPhone"
            value={form.consultPhone}
            onChange={(event) => setForm((prev) => ({ ...prev, consultPhone: event.target.value }))}
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
        ) : (
          "상담 요청 접수"
        )}
      </button>
    </form>
  );
}
