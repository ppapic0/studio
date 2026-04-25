"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSafeErrorMessage } from "@/lib/exposed-error";
import { logHandledClientIssue } from "@/lib/handled-client-log";
import { PRIVACY_ROUTE } from "@/lib/legal-documents";

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
  privacyConsentRequired: boolean;
  marketingConsentOptional: boolean;
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
  waitlistRegistered: boolean;
};

const INITIAL_FORM: FormState = {
  studentName: "",
  school: "",
  grade: "",
  gender: "",
  consultPhone: "",
  serviceType: "korean_academy",
  studyCenterRequestType: "consult",
  privacyConsentRequired: false,
  marketingConsentOptional: false,
};

const GRADE_OPTIONS = ["고1", "고2", "고3", "N수생"];

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
        {receipt.waitlistRegistered
          ? "📞 입학 대기 신청이 접수되었습니다. 담당 선생님이 확인 후 등록하신 연락처로 연락드릴 예정입니다."
          : "📞 담당 선생님이 확인 후 등록하신 연락처로 연락드릴 예정입니다."}
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

export function ConsultForm() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptInfo | null>(null);
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);

  const isPrimaryActionDisabled = useMemo(() => {
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

  async function submitConsultRequest() {
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
        waitlistRegistered?: boolean;
      };

      if (!response.ok || !data.ok) {
        setError(getSafeErrorMessage(data.message, "접수 중 오류가 발생했습니다."));
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
        waitlistRegistered: Boolean(data.waitlistRegistered),
      });
      setConsentDialogOpen(false);
      setForm(INITIAL_FORM);
    } catch (err) {
      logHandledClientIssue("[consult-form] submit error", err);
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPrimaryActionDisabled) return;
    setError(null);
    setConsentDialogOpen(true);
  }

  async function handleConfirmConsent() {
    if (!form.privacyConsentRequired) {
      setError("개인정보 수집 및 이용 동의가 필요합니다.");
      return;
    }

    await submitConsultRequest();
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
        disabled={isPrimaryActionDisabled}
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

      <Dialog open={consentDialogOpen} onOpenChange={(open) => !submitting && setConsentDialogOpen(open)}>
        <DialogContent className="rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-xl">
          <div className="rounded-t-[2rem] bg-[#14295F] px-6 py-6 text-white sm:px-7">
            <DialogHeader className="text-left">
              <DialogTitle className="text-[1.8rem] font-black tracking-[-0.04em]">
                {form.serviceType === "study_center" && form.studyCenterRequestType === "waitlist"
                  ? "입학대기 신청 전 개인정보 동의"
                  : "상담문의 전 개인정보 동의"}
              </DialogTitle>
              <DialogDescription className="pt-2 text-sm font-bold leading-6 text-white/78">
                상담 연락과 입학대기 안내를 위해 필요한 항목만 수집합니다.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-6 sm:px-7">
            <div className="grid gap-3 rounded-[1.6rem] border border-[#14295F]/10 bg-[#f8fbff] p-4">
              <div className="grid gap-1">
                <p className="text-sm font-black text-[#14295F]">필수 동의</p>
                <p className="text-[11px] font-semibold leading-5 text-[#14295F]/58">
                  아래 항목에 동의해야 상담문의 또는 입학대기 신청을 접수할 수 있습니다.
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-[1.25rem] border border-[#14295F]/10 bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.privacyConsentRequired}
                  onChange={(event) => setField("privacyConsentRequired", event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[#14295F]/30 text-[#14295F] focus:ring-[#FF7A16]"
                />
                <div className="grid gap-1">
                  <span className="text-sm font-black text-[#14295F]">
                    [필수] 상담 신청 및 입학대기 안내를 위한 개인정보 수집·이용에 동의합니다.
                  </span>
                  <span className="text-[11px] font-semibold leading-5 text-[#14295F]/58">
                    학생 이름, 학교, 학년, 성별, 연락처, 서비스 유형을 상담 안내와 접수 확인에 사용합니다.
                  </span>
                  <Link
                    href={PRIVACY_ROUTE}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-black text-[#FF7A16] underline underline-offset-4"
                  >
                    개인정보처리방침 전문 보기
                  </Link>
                </div>
              </label>
            </div>

            <div className="grid gap-3 rounded-[1.6rem] border border-[#FF7A16]/12 bg-[#fff7ef] p-4">
              <div className="grid gap-1">
                <p className="text-sm font-black text-[#14295F]">선택 동의</p>
                <p className="text-[11px] font-semibold leading-5 text-[#14295F]/58">
                  아래 항목은 선택이며, 동의하지 않아도 상담 접수는 가능합니다.
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-[1.25rem] border border-[#FF7A16]/15 bg-white px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.marketingConsentOptional}
                  onChange={(event) => setField("marketingConsentOptional", event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[#FF7A16]/30 text-[#FF7A16] focus:ring-[#FF7A16]"
                />
                <div className="grid gap-1">
                  <span className="text-sm font-black text-[#14295F]">
                    [선택] 전화·문자(필요 시 이메일)로 혜택·이벤트·신규 프로그램 안내를 받겠습니다.
                  </span>
                  <span className="text-[11px] font-semibold leading-5 text-[#14295F]/58">
                    운영 연락과 별도로, 혜택·이벤트·신규 프로그램 안내를 전화번호 중심으로 드리며 필요 시 이메일로도 안내드립니다.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <DialogFooter className="border-t border-[#14295F]/8 bg-[#f8fbff] px-6 py-5 sm:px-7">
            <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-2xl border-[#14295F]/12 font-black text-[#14295F]"
                onClick={() => setConsentDialogOpen(false)}
                disabled={submitting}
              >
                다시 확인할게요
              </Button>
              <Button
                type="button"
                className="h-12 rounded-2xl bg-[#FF7A16] font-black text-white hover:bg-[#e86d11]"
                onClick={() => void handleConfirmConsent()}
                disabled={submitting || !form.privacyConsentRequired}
              >
                {submitting
                  ? "접수 중..."
                  : form.serviceType === "study_center" && form.studyCenterRequestType === "waitlist"
                    ? "동의하고 입학대기 신청하기"
                    : "동의하고 상담 접수하기"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
