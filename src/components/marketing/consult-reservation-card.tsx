"use client";

import { useEffect, useMemo, useState } from "react";
import { Armchair, CalendarDays, CheckCircle2, Loader2, Phone, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getSafeErrorMessage } from "@/lib/exposed-error";
import { logHandledClientIssue } from "@/lib/handled-client-log";
import { DEFAULT_WEBSITE_SLOT_GUIDE } from "@/lib/website-consult";

type PublicSettings = {
  isPublicEnabled?: boolean;
  bankAccountDisplay: string;
  depositAmount: number;
  depositorGuide: string;
  nonRefundableNotice: string;
  slotGuideText?: string | null;
  seatGuideText?: string | null;
};

type PublicSlot = {
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  reservationCount: number;
  isAvailable: boolean;
};

type VerifiedLead = {
  id: string;
  receiptId?: string | null;
  studentName: string;
  school?: string | null;
  grade?: string | null;
  gender?: string | null;
  consultPhone: string;
  serviceType?: string | null;
  requestType?: string | null;
  requestTypeLabel?: string | null;
  createdAt?: string | null;
  bookingAccessStatus: "no_lead" | "locked" | "enabled";
  canReserve: boolean;
  canSeatHold: boolean;
  bookingAccessNote?: string | null;
  latestConsultReservationStatus?: string | null;
  latestSeatHoldStatus?: string | null;
};

type PublicSeat = {
  cellType: "seat" | "aisle";
  seatId: string;
  roomId: string;
  roomName: string;
  roomSeatNo: number;
  seatNo: number;
  label: string;
  status: "available" | "occupied" | "held";
  statusLabel: string;
};

type PublicSeatRoom = {
  roomId: string;
  roomName: string;
  rows: number;
  cols: number;
  seats: PublicSeat[];
};

type PublicSeatSummary = {
  availableCount: number;
  occupiedCount: number;
  heldCount: number;
  totalCount: number;
};

type SlotResponse = {
  ok: boolean;
  message?: string;
  settings: PublicSettings;
  slots: PublicSlot[];
};

type SeatResponse = {
  ok: boolean;
  message?: string;
  settings: PublicSettings;
  summary: PublicSeatSummary;
  rooms: PublicSeatRoom[];
};

type VerifyResponse = {
  ok: boolean;
  message?: string;
  leads: VerifiedLead[];
};

type ReservationAction =
  | { kind: "slot"; slot: PublicSlot }
  | { kind: "seat"; seat: PublicSeat };

type SuccessState =
  | {
      kind: "slot";
      title: string;
      description: string;
      detail: string;
    }
  | {
      kind: "seat";
      title: string;
      description: string;
      detail: string;
    };

type SummaryChipProps = {
  label: string;
  value: string;
  tone?: "default" | "orange" | "light" | "accent";
};

type LeadChoiceCardProps = {
  lead: VerifiedLead;
  isSelected: boolean;
  onSelect: (leadId: string) => void;
};

function formatKoreanDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parsed);
}

function formatKoreanTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function getDayKey(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function SummaryChip({ label, value, tone = "default" }: SummaryChipProps) {
  return (
    <div
      className={cn(
        "rounded-[1.15rem] border px-4 py-3",
        tone === "orange"
          ? "border-[#FF7A16]/25 bg-[#FFF2E8]"
          : tone === "accent"
            ? "border-[#FFB273]/24 bg-[#FF7A16]/10"
          : tone === "light"
            ? "border-[#dbe5ff] bg-white"
            : "border-white/10 bg-white/[0.06]"
      )}
    >
      <p
        className={cn(
          "text-[10px] font-black tracking-[0.18em]",
          tone === "orange"
            ? "text-[#FF7A16]"
            : tone === "accent"
              ? "text-[#FFB273]"
            : tone === "light"
              ? "text-[#5c6e97]"
              : "text-white/55"
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-lg font-black tracking-tight",
          tone === "orange" || tone === "light" ? "text-[#14295F]" : "text-white"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function getConsultReservationStatusLabel(status?: string | null) {
  if (status === "confirmed") return "예약완료";
  if (status === "completed") return "상담완료";
  if (status === "canceled") return "예약취소";
  return null;
}

function getSeatHoldStatusLabel(status?: string | null) {
  if (status === "pending_transfer") return "좌석예약 진행중";
  if (status === "held") return "좌석예약 확정";
  if (status === "canceled") return "좌석예약 취소";
  return null;
}

function getLeadAccessLabel(lead: VerifiedLead) {
  return lead.canReserve ? "예약 가능" : "순차 안내 중";
}

function getLeadAccessDescription(lead: VerifiedLead) {
  if (lead.canReserve) {
    return "센터에서 이 문의 건을 예약 가능 상태로 열어 두었습니다. 아래 공개된 시간 중에서 방문 상담 예약을 진행할 수 있습니다.";
  }
  return (
    lead.bookingAccessNote ||
    "현재는 이 문의 건의 순서가 아직 열리지 않아 상담 시간과 좌석 현황만 확인할 수 있습니다. 센터에서 순차적으로 열어드린 뒤 예약이 가능합니다."
  );
}

function LeadChoiceCard({ lead, isSelected, onSelect }: LeadChoiceCardProps) {
  const consultReservationLabel = getConsultReservationStatusLabel(lead.latestConsultReservationStatus);
  const seatHoldLabel = getSeatHoldStatusLabel(lead.latestSeatHoldStatus);

  return (
    <button
      type="button"
      onClick={() => onSelect(lead.id)}
      className={cn(
        "w-full rounded-[1.25rem] border px-4 py-4 text-left transition",
        isSelected
          ? "border-[#FF7A16] bg-[#FFF4EC] shadow-[0_18px_30px_-24px_rgba(255,122,22,0.45)]"
          : "border-[#14295F]/12 bg-white hover:border-[#14295F]/28"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[#14295F]">{lead.studentName}</p>
          <p className="mt-1 text-xs font-bold text-[#14295F]/58">
            {[lead.school, lead.grade, lead.gender].filter(Boolean).join(" · ") || "기존 문의 건"}
          </p>
        </div>
        {lead.receiptId ? (
          <span className="rounded-full bg-[#14295F]/6 px-2.5 py-1 text-[10px] font-black tracking-[0.12em] text-[#14295F]/70">
            {lead.receiptId}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[10px] font-black",
            lead.canReserve
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-100 text-slate-600"
          )}
        >
          {getLeadAccessLabel(lead)}
        </span>
        <span className="rounded-full border border-[#14295F]/12 px-2.5 py-1 text-[10px] font-black text-[#14295F]/68">
          {lead.requestTypeLabel || "기존 입학문의"}
        </span>
        {consultReservationLabel ? (
          <span className="rounded-full border border-[#dbe4ff] bg-[#edf3ff] px-2.5 py-1 text-[10px] font-black text-[#17326B]">
            {consultReservationLabel}
          </span>
        ) : null}
        {seatHoldLabel ? (
          <span className="rounded-full border border-[#ffe2cb] bg-[#fff3e9] px-2.5 py-1 text-[10px] font-black text-[#c26a1c]">
            {seatHoldLabel}
          </span>
        ) : null}
      </div>
      {!lead.canReserve ? (
        <p className="mt-3 text-[11px] font-bold leading-5 text-[#5c6e97]">{getLeadAccessDescription(lead)}</p>
      ) : null}
    </button>
  );
}

export function ConsultReservationCard() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [seatSummary, setSeatSummary] = useState<PublicSeatSummary>({
    availableCount: 0,
    occupiedCount: 0,
    heldCount: 0,
    totalCount: 0,
  });
  const [seatRooms, setSeatRooms] = useState<PublicSeatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [seatDialogOpen, setSeatDialogOpen] = useState(false);
  const [slotPanelOpen, setSlotPanelOpen] = useState(false);
  const [action, setAction] = useState<ReservationAction | null>(null);
  const [phone, setPhone] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifiedLeads, setVerifiedLeads] = useState<VerifiedLead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  async function refreshPublicData(options?: { showLoading?: boolean; resetError?: boolean }) {
    const showLoading = options?.showLoading ?? false;
    const resetError = options?.resetError ?? showLoading;

    if (showLoading) {
      setIsLoading(true);
    }
    if (resetError) {
      setSlotError(null);
    }

    try {
      const [slotRes, seatRes] = await Promise.all([
        fetch("/api/consult/reservations", { cache: "no-store" }),
        fetch("/api/consult/seats", { cache: "no-store" }),
      ]);
      const slotData = (await slotRes.json()) as SlotResponse;
      const seatData = (await seatRes.json()) as SeatResponse;

      if (!slotRes.ok || !slotData.ok) {
        throw new Error(getSafeErrorMessage(slotData.message, "상담 예약 정보를 불러오지 못했습니다."));
      }
      if (!seatRes.ok || !seatData.ok) {
        throw new Error(getSafeErrorMessage(seatData.message, "좌석 현황을 불러오지 못했습니다."));
      }

      setSettings(slotData.settings || seatData.settings);
      setSlots(slotData.slots || []);
      setSeatSummary(seatData.summary);
      setSeatRooms(seatData.rooms || []);
    } catch (error) {
      logHandledClientIssue("[consult-reservation-card] refresh failed", error);
      setSlotError(getSafeErrorMessage(error, "예약 정보를 불러오지 못했습니다."));
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadInitialData() {
      setIsLoading(true);
      setSlotError(null);
      try {
        const [slotRes, seatRes] = await Promise.all([
          fetch("/api/consult/reservations", { cache: "no-store" }),
          fetch("/api/consult/seats", { cache: "no-store" }),
        ]);
        const slotData = (await slotRes.json()) as SlotResponse;
        const seatData = (await seatRes.json()) as SeatResponse;

        if (!mounted) return;
        if (!slotRes.ok || !slotData.ok) {
          throw new Error(getSafeErrorMessage(slotData.message, "상담 예약 정보를 불러오지 못했습니다."));
        }
        if (!seatRes.ok || !seatData.ok) {
          throw new Error(getSafeErrorMessage(seatData.message, "좌석 현황을 불러오지 못했습니다."));
        }

        setSettings(slotData.settings || seatData.settings);
        setSlots(slotData.slots || []);
        setSeatSummary(seatData.summary);
        setSeatRooms(seatData.rooms || []);
      } catch (error) {
        logHandledClientIssue("[consult-reservation-card] initial load failed", error);
        if (mounted) {
          setSlotError(getSafeErrorMessage(error, "예약 정보를 불러오지 못했습니다."));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!slotPanelOpen) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void refreshPublicData();
    };

    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [slotPanelOpen]);

  const groupedSlots = useMemo(() => {
    const groups = new Map<string, { label: string; slots: PublicSlot[] }>();
    slots.forEach((slot) => {
      const key = getDayKey(slot.startsAt);
      const group = groups.get(key) || {
        label: formatKoreanDate(slot.startsAt),
        slots: [],
      };
      group.slots.push(slot);
      groups.set(key, group);
    });
    return Array.from(groups.entries()).map(([key, value]) => ({
      key,
      label: value.label,
      slots: value.slots.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    }));
  }, [slots]);

  const selectedLead = useMemo(
    () => verifiedLeads.find((lead) => lead.id === selectedLeadId) || null,
    [verifiedLeads, selectedLeadId]
  );
  const activeSettings = settings;
  const availableSlotCount = useMemo(() => slots.filter((slot) => slot.isAvailable).length, [slots]);
  const publicRoomLabel = seatRooms[0]?.roomName || "1호실";

  function resetActionState(nextAction: ReservationAction | null) {
    setAction(nextAction);
    setPhone("");
    setVerifiedLeads([]);
    setSelectedLeadId(null);
    setPolicyAccepted(false);
    setActionError(null);
    setSuccess(null);
  }

  function openSlotReservation(slot: PublicSlot) {
    resetActionState({ kind: "slot", slot });
  }

  function openSeatReservation(seat: PublicSeat) {
    if (seat.cellType !== "seat" || seat.status !== "available") return;
    resetActionState({ kind: "seat", seat });
    setSeatDialogOpen(false);
  }

  async function handleToggleSlotPanel() {
    if (slotPanelOpen) {
      setSlotPanelOpen(false);
      return;
    }

    setSlotPanelOpen(true);
    await refreshPublicData({ showLoading: true, resetError: true });
  }

  async function handleVerifyPhone() {
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length < 8) {
      setActionError("기존 입학문의에 사용한 학부모 연락처를 입력해 주세요.");
      return;
    }

    setVerifying(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/consult/verify?phone=${encodeURIComponent(normalizedPhone)}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as VerifyResponse;
      if (!response.ok || !data.ok) {
        setActionError(getSafeErrorMessage(data.message, "전화번호 인증에 실패했습니다."));
        return;
      }
      if (!data.leads.length) {
        setVerifiedLeads([]);
        setSelectedLeadId(null);
        setActionError("이 번호로 접수된 홍보 리드가 없습니다. 먼저 아래 상담 폼을 작성해 주세요.");
        return;
      }
      const sortedLeads = [...data.leads].sort((left, right) => {
        const reservePriorityGap = Number(right.canReserve) - Number(left.canReserve);
        if (reservePriorityGap !== 0) return reservePriorityGap;
        return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
      });
      setVerifiedLeads(sortedLeads);
      const defaultLead = sortedLeads.find((lead) => lead.canReserve) || sortedLeads[0] || null;
      setSelectedLeadId(defaultLead?.id || null);
      if (!sortedLeads.some((lead) => lead.canReserve)) {
        setActionError(getLeadAccessDescription(defaultLead as VerifiedLead));
      }
    } catch (error) {
      logHandledClientIssue("[consult-reservation-card] verify failed", error);
      setActionError("전화번호 인증 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmitAction() {
    if (!action || !selectedLead) {
      setActionError("접수 건을 먼저 선택해 주세요.");
      return;
    }
    if (!selectedLead.canReserve) {
      setActionError(getLeadAccessDescription(selectedLead));
      return;
    }

    if (action.kind === "seat" && !selectedLead.canSeatHold) {
      setActionError("관리형 스터디센터 문의 건만 좌석예약을 신청할 수 있습니다.");
      return;
    }
    if (action.kind === "seat" && !policyAccepted) {
      setActionError("예약금 환불 불가 안내에 동의해 주세요.");
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      if (action.kind === "slot") {
        const response = await fetch("/api/consult/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId: selectedLead.id,
            consultPhone: normalizePhone(phone),
            slotId: action.slot.id,
          }),
        });
        const data = (await response.json()) as {
          ok: boolean;
          message?: string;
          slotLabel?: string;
          scheduledAt?: string;
        };
        if (!response.ok || !data.ok) {
          setActionError(getSafeErrorMessage(data.message, "상담 예약에 실패했습니다."));
          return;
        }
        setSuccess({
          kind: "slot",
          title: "상담 예약이 완료되었습니다.",
          description: "센터에서 별도 확인 연락 없이 바로 일정이 확정됩니다.",
          detail: `${selectedLead.studentName} 학생 · ${data.slotLabel || formatKoreanTime(action.slot.startsAt)} 예약`,
        });
      } else {
        const response = await fetch("/api/consult/seat-holds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId: selectedLead.id,
            consultPhone: normalizePhone(phone),
            roomId: action.seat.roomId,
            roomSeatNo: action.seat.roomSeatNo,
            seatId: action.seat.seatId,
            policyAccepted,
          }),
        });
        const data = (await response.json()) as {
          ok: boolean;
          message?: string;
          seatLabel?: string;
          depositAmount?: number;
          bankAccountDisplay?: string;
          depositorGuide?: string;
        };
        if (!response.ok || !data.ok) {
          setActionError(getSafeErrorMessage(data.message, "좌석예약 신청에 실패했습니다."));
          return;
        }
        setSuccess({
          kind: "seat",
          title: "좌석예약 신청이 접수되었습니다.",
          description: "입금 전까지는 확정이 아니며, 입금 확인 후 센터가 수동으로 확정합니다.",
          detail: `${data.seatLabel || action.seat.label} · 예약금 ${formatCurrency(
            data.depositAmount || activeSettings?.depositAmount || 50000
          )}원`,
        });
      }
      await refreshPublicData();
    } catch (error) {
      logHandledClientIssue("[consult-reservation-card] submit failed", error);
      setActionError("요청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  const actionTitle =
    action?.kind === "slot" ? "전화번호 인증 후 상담 예약" : "전화번호 인증 후 좌석예약 신청";

  return (
    <>
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
            <p className="text-[10px] font-black tracking-[0.22em] text-[#FFB273]">VISIT RESERVATION</p>
            <h3 className="mt-2 break-keep text-[1.55rem] font-black tracking-[-0.04em] text-white sm:text-[1.9rem]">
              상담 예약과
              <br />
              실시간 좌석 확인
            </h3>
          </div>
          <div className="hidden rounded-full border border-white/10 bg-white/[0.08] p-3 text-white/80 sm:block">
            <CalendarDays className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <SummaryChip label="공개된 상담 슬롯" value={`${availableSlotCount}개`} />
          <SummaryChip label={`${publicRoomLabel} 빈좌석`} value={`${seatSummary.availableCount}석`} />
          <SummaryChip label="좌석예약 진행" value={`${seatSummary.heldCount}석`} tone="accent" />
        </div>

        <div className="mt-5 rounded-[1.35rem] border border-[#FFB273]/20 bg-[#FFF2E8] p-4">
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#FF7A16]" />
            <div className="min-w-0">
              <p className="text-sm font-black text-[#14295F]">온라인 예약은 순차 오픈 방식입니다</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[#14295F]/78">
                {activeSettings?.slotGuideText ||
                  DEFAULT_WEBSITE_SLOT_GUIDE}
              </p>
            </div>
          </div>
        </div>

        {slotError ? (
          <div className="mt-5 rounded-[1.25rem] border border-rose-300/20 bg-rose-400/12 px-4 py-3 text-sm font-bold text-rose-100">
            {slotError}
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          <div className={cn("flex gap-3", "flex-col sm:flex-row sm:items-center sm:justify-between")}>
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-white/90">방문 상담 가능한 시간</p>
              <p className="mt-1 text-sm font-semibold text-white">
                버튼을 누르면 센터가 열어둔 상담 시간을 볼 수 있고, 실제 예약은 전화번호 인증 후 예약 가능 상태인 문의 건만 가능합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void handleToggleSlotPanel()}
                className="h-11 rounded-full bg-[#FF7A16] text-white hover:bg-[#e86d11]"
                disabled={!activeSettings?.isPublicEnabled}
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                {slotPanelOpen ? "방문 상담 가능한 시간 닫기" : "방문 상담 가능한 시간 보기"}
              </Button>
              <Button
                type="button"
                onClick={() => setSeatDialogOpen(true)}
                className="h-11 rounded-full bg-white text-[#14295F] hover:bg-[#f7faff]"
                disabled={!activeSettings?.isPublicEnabled}
              >
                <Armchair className="mr-2 h-4 w-4" />
                실시간 좌석 보기
              </Button>
            </div>
          </div>

          {!slotPanelOpen ? (
            <div className="rounded-[1.25rem] border border-dashed border-white/14 bg-white/[0.04] px-4 py-6 text-center">
              <p className="text-sm font-black text-white">열어둔 상담 시간을 확인하려면 버튼을 눌러주세요.</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-white">
                예약 단계에서는 홍보리드 DB에 남긴 학부모 연락처 확인과 예약 가능 여부를 다시 확인합니다.
              </p>
            </div>
          ) : isLoading ? (
            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] px-4 py-8 text-center text-sm font-bold text-white/70">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-white/60" />
              <p className="mt-3">예약 가능한 상담 시간을 불러오고 있습니다.</p>
            </div>
          ) : groupedSlots.length === 0 ? (
            <div className="rounded-[1.25rem] border border-dashed border-white/14 bg-white/[0.04] px-4 py-8 text-center">
              <p className="text-sm font-black text-white">지금은 공개된 상담 슬롯이 없습니다.</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-white">
                먼저 빠른 입학문의 폼을 남겨주시면 센터에서 순차적으로 안내드립니다.
              </p>
              <a
                href="#consult-form"
                className="mt-4 inline-flex h-10 items-center justify-center rounded-full border border-white/12 px-4 text-xs font-black text-white transition hover:bg-white/[0.08]"
              >
                상담 폼 먼저 작성하기
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedSlots.map((group) => (
                <div
                  key={group.key}
                  className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-white">{group.label}</p>
                    <span className="text-[11px] font-bold text-white/56">{group.slots.length}개 슬롯</span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {group.slots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => slot.isAvailable && openSlotReservation(slot)}
                        disabled={!slot.isAvailable || !activeSettings?.isPublicEnabled}
                        className={cn(
                          "rounded-[1rem] border px-4 py-3 text-left transition",
                          slot.isAvailable
                            ? "border-white/12 bg-white/[0.08] hover:-translate-y-0.5 hover:bg-white/[0.12]"
                            : "border-white/8 bg-white/[0.03] opacity-55"
                        )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-black text-white">
                              {formatKoreanTime(slot.startsAt)} - {formatKoreanTime(slot.endsAt)}
                            </p>
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[10px] font-black",
                              slot.isAvailable
                                ? "bg-[#FFF2E8] text-[#FF7A16]"
                                : "bg-white/10 text-white"
                            )}
                          >
                            {slot.isAvailable ? "전화번호 인증 후 예약" : "예약 마감"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs font-semibold leading-5 text-white">
                          {slot.label}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </article>

      <Dialog open={seatDialogOpen} onOpenChange={setSeatDialogOpen}>
        <DialogContent className="max-w-4xl rounded-[2rem] border-none p-0 shadow-2xl">
          <div className="rounded-t-[2rem] bg-[#14295F] px-6 py-6 text-white sm:px-8">
            <DialogHeader className="text-left">
              <DialogTitle className="text-[1.65rem] font-black tracking-[-0.04em]">실시간 좌석 현황</DialogTitle>
              <DialogDescription className="pt-2 text-sm font-semibold leading-6 text-white/78">
                지금은 {publicRoomLabel} 좌석만 공개되며, 운영실 실제 배치 기준으로 통로 칸은 비워서 보여드립니다. 좌석예약은 홍보리드 DB에 등록된 관리형 스터디센터 문의 건 중 센터가 예약 가능 상태로 열어둔 번호만 신청할 수 있습니다.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[75vh] overflow-y-auto bg-[#f7faff] px-6 py-6 sm:px-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryChip label="빈자리" value={`${seatSummary.availableCount}석`} tone="orange" />
              <SummaryChip label="사용 중" value={`${seatSummary.occupiedCount}석`} tone="light" />
              <SummaryChip label="좌석예약 진행" value={`${seatSummary.heldCount}석`} tone="light" />
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-bold text-[#14295F]/72">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">빈자리</span>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5">사용 중</span>
              <span className="rounded-full border border-[#ffd9bd] bg-[#fff3e9] px-3 py-1.5">좌석예약 진행</span>
            </div>

            <div className="mt-6 space-y-5">
              {seatRooms.map((room) => (
                <section
                  key={room.roomId}
                  className="rounded-[1.4rem] border border-[#dbe5ff] bg-white p-4 shadow-[0_20px_46px_-38px_rgba(20,41,95,0.32)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-black tracking-tight text-[#14295F]">{room.roomName}</p>
                      <p className="mt-1 text-xs font-semibold text-[#5c6e97]">
                        운영실 실제 배치 기준으로 공개됩니다.
                      </p>
                    </div>
                    <span className="rounded-full bg-[#14295F]/6 px-3 py-1 text-[10px] font-black tracking-[0.16em] text-[#14295F]/68">
                      {room.seats.filter((seat) => seat.cellType === "seat" && seat.status === "available").length}석 가능
                    </span>
                  </div>
                  <div className="mt-4 overflow-x-auto pb-1">
                    <div
                      className="inline-grid gap-2.5"
                      style={{
                        gridTemplateColumns: `repeat(${room.cols}, minmax(78px, 90px))`,
                      }}
                    >
                      {Array.from({ length: room.cols }).map((_, colIndex) => (
                        <div key={`${room.roomId}_${colIndex}`} className="flex flex-col gap-2.5">
                          {Array.from({ length: room.rows }).map((__, rowIndex) => {
                            const seat = room.seats[colIndex * room.rows + rowIndex];
                            const cellKey = `${room.roomId}_${colIndex}_${rowIndex}`;

                            if (!seat || seat.cellType === "aisle") {
                              return (
                                <div
                                  key={cellKey}
                                  className="aspect-square rounded-[1rem] bg-transparent"
                                />
                              );
                            }

                            return (
                              <button
                                key={seat.seatId || cellKey}
                                type="button"
                                onClick={() => openSeatReservation(seat)}
                                disabled={seat.status !== "available"}
                                className={cn(
                                  "aspect-square rounded-[1rem] border px-3 py-3 text-left transition",
                                  seat.status === "available"
                                    ? "border-emerald-200 bg-emerald-50 hover:-translate-y-0.5 hover:border-emerald-300"
                                    : seat.status === "held"
                                      ? "border-[#ffd7b6] bg-[#fff3e8] text-[#b7641d]"
                                      : "border-slate-200 bg-slate-100 text-slate-500"
                                )}
                              >
                                <p className="text-sm font-black">{seat.roomSeatNo}번</p>
                                <p className="mt-1 text-[11px] font-bold">{seat.statusLabel}</p>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(action)} onOpenChange={(open) => !open && resetActionState(null)}>
        <DialogContent className="rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-xl">
          <div className="rounded-t-[2rem] bg-[#14295F] px-6 py-6 text-white sm:px-7">
            <DialogHeader className="text-left">
              <DialogTitle className="text-[1.7rem] font-black tracking-[-0.04em]">{actionTitle}</DialogTitle>
              <DialogDescription className="pt-2 text-sm font-semibold leading-6 text-white/78">
                홍보리드 DB에 등록된 학부모 연락처와 일치하는지 먼저 확인한 뒤, 센터가 예약 가능 상태로 열어둔 문의 건만 진행됩니다.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[78vh] overflow-y-auto bg-[#f8fbff] px-6 py-6 sm:px-7">
            {success ? (
              <div className="rounded-[1.6rem] border border-emerald-200 bg-white p-5 shadow-[0_22px_40px_-30px_rgba(16,185,129,0.35)]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <p className="text-xs font-black tracking-[0.18em] text-emerald-600">REQUEST COMPLETE</p>
                </div>
                <h4 className="mt-3 text-xl font-black text-[#14295F]">{success.title}</h4>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#14295F]/68">{success.description}</p>
                <div className="mt-4 rounded-[1.2rem] border border-[#dbe5ff] bg-[#f7faff] px-4 py-4 text-sm font-black text-[#14295F]">
                  {success.detail}
                </div>
                {success.kind === "seat" && activeSettings ? (
                  <div className="mt-4 rounded-[1.25rem] border border-[#ffd9bd] bg-[#fff4eb] px-4 py-4">
                    <p className="text-[10px] font-black tracking-[0.18em] text-[#c26a1c]">입금 안내</p>
                    <p className="mt-2 text-sm font-black text-[#14295F]">{activeSettings.bankAccountDisplay}</p>
                    <p className="mt-2 text-xs font-semibold leading-5 text-[#14295F]/72">
                      예약금 {formatCurrency(activeSettings.depositAmount)}원 · {activeSettings.depositorGuide}
                    </p>
                  </div>
                ) : null}
                <Button
                  type="button"
                  className="mt-5 h-12 w-full rounded-2xl bg-[#14295F] text-white hover:bg-[#10224e]"
                  onClick={() => resetActionState(null)}
                >
                  닫기
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-[1.4rem] border border-[#dbe5ff] bg-white p-4">
                  <p className="text-[10px] font-black tracking-[0.18em] text-[#5c6e97]">선택한 항목</p>
                  <p className="mt-2 text-base font-black text-[#14295F]">
                    {action?.kind === "slot"
                      ? `${formatKoreanDate(action.slot.startsAt)} · ${formatKoreanTime(action.slot.startsAt)}`
                      : action?.seat.label}
                  </p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[#14295F]/65">
                    {action?.kind === "slot"
                      ? "연락처 인증 후 즉시 상담 시간이 확정됩니다."
                      : "연락처 인증과 환불 불가 동의 후 좌석예약 입금대기로 접수됩니다."}
                  </p>
                </div>

                  <div className="rounded-[1.4rem] border border-[#dbe5ff] bg-white p-4">
                    <label htmlFor="verifyPhone" className="text-sm font-black text-[#14295F]">
                      학부모 연락처 인증
                  </label>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input
                      id="verifyPhone"
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value);
                        setVerifiedLeads([]);
                        setSelectedLeadId(null);
                        setActionError(null);
                      }}
                      placeholder="기존 입학문의에 남긴 번호"
                      className="h-12 flex-1 rounded-2xl border border-[#dbe5ff] bg-[#f8fbff] px-4 text-sm font-black text-[#14295F] outline-none focus:border-[#FF7A16]"
                    />
                    <Button
                      type="button"
                      className="h-12 rounded-2xl bg-[#14295F] px-5 text-white hover:bg-[#10224e]"
                      onClick={() => void handleVerifyPhone()}
                      disabled={verifying}
                    >
                      {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "전화번호 인증"}
                    </Button>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold leading-5 text-[#5c6e97]">
                    홍보리드 DB에 등록된 학부모 연락처와 일치해야 하며, 센터가 순차적으로 예약 가능 상태를 연 문의 건만 예약할 수 있습니다.
                  </p>
                </div>

                {verifiedLeads.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-[#14295F]">인증된 문의 건 선택</p>
                      <span className="text-[11px] font-bold text-[#5c6e97]">{verifiedLeads.length}건</span>
                    </div>
                    <div className="space-y-3">
                      {verifiedLeads.map((lead) => (
                        <LeadChoiceCard
                          key={lead.id}
                          lead={lead}
                          isSelected={lead.id === selectedLeadId}
                          onSelect={setSelectedLeadId}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedLead ? (
                  <div
                    className={cn(
                      "rounded-[1.4rem] border p-4",
                      selectedLead.canReserve
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-slate-50"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-[#14295F]">현재 예약 상태</p>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[10px] font-black",
                          selectedLead.canReserve
                            ? "border-emerald-200 bg-white text-emerald-700"
                            : "border-slate-200 bg-white text-slate-600"
                        )}
                      >
                        {getLeadAccessLabel(selectedLead)}
                      </span>
                      {getConsultReservationStatusLabel(selectedLead.latestConsultReservationStatus) ? (
                        <span className="rounded-full border border-[#dbe4ff] bg-white px-2.5 py-1 text-[10px] font-black text-[#17326B]">
                          {getConsultReservationStatusLabel(selectedLead.latestConsultReservationStatus)}
                        </span>
                      ) : null}
                      {getSeatHoldStatusLabel(selectedLead.latestSeatHoldStatus) ? (
                        <span className="rounded-full border border-[#ffe2cb] bg-white px-2.5 py-1 text-[10px] font-black text-[#c26a1c]">
                          {getSeatHoldStatusLabel(selectedLead.latestSeatHoldStatus)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-6 text-[#14295F]/72">
                      {getLeadAccessDescription(selectedLead)}
                    </p>
                  </div>
                ) : null}

                {action?.kind === "seat" && selectedLead && activeSettings ? (
                  <div className="rounded-[1.5rem] border border-[#ffd9bd] bg-[#fff4eb] p-4">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#c26a1c]" />
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#14295F]">5만원 좌석예약 입금 안내</p>
                        <p className="mt-2 text-sm font-black text-[#14295F]">{activeSettings.bankAccountDisplay}</p>
                        <p className="mt-2 text-xs font-semibold leading-5 text-[#14295F]/72">
                          예약금 {formatCurrency(activeSettings.depositAmount)}원 · {activeSettings.depositorGuide}
                        </p>
                        <p className="mt-3 text-xs font-semibold leading-5 text-[#9a5516]">
                          {activeSettings.nonRefundableNotice}
                        </p>
                      </div>
                    </div>
                    <label className="mt-4 flex items-start gap-3 rounded-[1.15rem] border border-[#ffd9bd] bg-white px-4 py-3">
                      <input
                        type="checkbox"
                        checked={policyAccepted}
                        onChange={(event) => setPolicyAccepted(event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-[#FF7A16]/35 text-[#FF7A16] focus:ring-[#FF7A16]"
                      />
                      <span className="text-sm font-black leading-6 text-[#14295F]">
                        좌석예약 예약금은 상담 취소 시에도 환불되지 않는다는 내용을 확인했고 동의합니다.
                      </span>
                    </label>
                    {!selectedLead.canSeatHold ? (
                      <p className="mt-3 text-xs font-black text-rose-600">
                        선택한 문의 건은 관리형 스터디센터 문의가 아니어서 좌석예약을 신청할 수 없습니다.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {actionError ? (
                  <div className="rounded-[1.2rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                    {actionError}
                    {actionError.includes("먼저 아래 상담 폼") ? (
                      <>
                        {" "}
                        <a href="#consult-form" className="underline underline-offset-2">
                          지금 상담 폼 작성하기
                        </a>
                      </>
                    ) : null}
                  </div>
                ) : null}

                <Button
                  type="button"
                  className="h-12 w-full rounded-2xl bg-[#FF7A16] text-white hover:bg-[#e86d11]"
                  onClick={() => void handleSubmitAction()}
                  disabled={
                    submitting ||
                    !selectedLead ||
                    !selectedLead.canReserve ||
                    (action?.kind === "seat" && (!policyAccepted || !selectedLead.canSeatHold))
                  }
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      처리 중...
                    </>
                  ) : !selectedLead ? (
                    "접수 건을 먼저 선택해 주세요"
                  ) : !selectedLead.canReserve ? (
                    "순차 안내 중"
                  ) : action?.kind === "seat" && !selectedLead.canSeatHold ? (
                    "관리형 스터디센터 문의만 가능"
                  ) : action?.kind === "slot" ? (
                    "상담 시간 예약 확정하기"
                  ) : (
                    "좌석예약 신청 접수하기"
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
