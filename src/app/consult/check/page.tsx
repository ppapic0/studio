"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, ChevronLeft, Loader2, Search } from "lucide-react";
import Link from "next/link";

type CheckResult = {
  receiptId: string;
  requestTypeLabel: string;
  studentName: string;
  school: string;
  grade: string;
  gender: string;
  status: string;
  createdAt: string;
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: "접수됨 · 확인 대기", color: "text-amber-600 bg-amber-50" },
  contacted: { label: "연락 완료", color: "text-blue-600 bg-blue-50" },
  scheduled: { label: "상담 예약 완료", color: "text-violet-600 bg-violet-50" },
  done: { label: "상담 완료", color: "text-emerald-600 bg-emerald-50" },
  cancelled: { label: "취소됨", color: "text-slate-500 bg-slate-100" },
};

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

export default function ConsultCheckPage() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CheckResult[] | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const params = new URLSearchParams({ phone: phone.trim() });
      if (name.trim()) params.set("name", name.trim());

      const res = await fetch(`/api/consult/check?${params.toString()}`);
      const data = (await res.json()) as { ok: boolean; message?: string; results?: CheckResult[] };

      if (!res.ok || !data.ok) {
        setError(data.message ?? "조회 중 오류가 발생했습니다.");
        return;
      }
      setResults(data.results ?? []);
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] py-16 px-4">
      <div className="mx-auto w-full max-w-lg">
        <Link
          href="/#consult"
          className="mb-8 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#14295F]/50 transition hover:text-[#14295F]"
        >
          <ChevronLeft className="h-4 w-4" />
          홈으로 돌아가기
        </Link>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-[#14295F]/10">
          <p className="text-xs font-black tracking-[0.14em] text-[#FF7A16]">접수 확인</p>
          <h1 className="mt-2 text-xl font-black text-[#14295F]">상담 신청 내역 조회</h1>
          <p className="mt-1 text-sm text-[#14295F]/60">
            신청 시 입력하신 연락처로 접수 내역을 확인할 수 있습니다.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="phone" className="mb-1.5 block text-sm font-black text-[#14295F]">
                연락처 <span className="text-[#FF7A16]">*</span>
              </label>
              <input
                id="phone"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError(null);
                  setResults(null);
                }}
                maxLength={15}
                placeholder="예: 010-1234-5678"
                className="h-11 w-full rounded-lg border border-[#14295F]/15 px-3 text-sm font-bold text-[#14295F] outline-none transition focus:border-[#FF7A16]"
              />
            </div>

            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-black text-[#14295F]">
                학생 이름 <span className="text-[#14295F]/40 text-xs font-bold">(선택)</span>
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                  setResults(null);
                }}
                maxLength={15}
                placeholder="예: 김트랙"
                className="h-11 w-full rounded-lg border border-[#14295F]/15 px-3 text-sm font-bold text-[#14295F] outline-none transition focus:border-[#FF7A16]"
              />
            </div>

            {error ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading || phone.trim().length < 8}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#14295F] text-sm font-black text-white transition hover:bg-[#14295F]/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  조회 중...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  접수 내역 조회
                </>
              )}
            </button>
          </form>
        </div>

        {results !== null && (
          <div className="mt-6">
            {results.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-[#14295F]/10">
                <p className="text-sm font-bold text-[#14295F]/50">
                  입력하신 연락처로 접수된 내역이 없습니다.
                </p>
                <p className="mt-1 text-xs text-[#14295F]/40">
                  연락처를 다시 확인하시거나, 학생 이름도 함께 입력해보세요.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="px-1 text-xs font-bold text-[#14295F]/50">
                  {results.length}건의 접수 내역이 있습니다
                </p>
                {results.map((item) => {
                  const statusInfo = STATUS_MAP[item.status] ?? {
                    label: item.status,
                    color: "text-slate-500 bg-slate-100",
                  };
                  return (
                    <div
                      key={item.receiptId}
                      className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#14295F]/10"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                          <span className="text-[10px] font-black tracking-widest text-[#FF7A16]">
                            {item.receiptId}
                          </span>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-black ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="mt-3 space-y-2 border-t border-[#14295F]/8 pt-3">
                        {[
                          { label: "신청 유형", value: item.requestTypeLabel },
                          { label: "학생 이름", value: item.studentName },
                          { label: "학교 / 학년", value: `${item.school} ${item.grade}` },
                          { label: "접수 일시", value: formatKoreaTime(item.createdAt) },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex justify-between gap-4 text-sm">
                            <span className="font-bold text-[#14295F]/50">{label}</span>
                            <span className="text-right font-black text-[#14295F]">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-[#14295F]/40">
          접수 후 담당 선생님이 확인하여 등록하신 번호로 연락드립니다.
        </p>
      </div>
    </main>
  );
}
