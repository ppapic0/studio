'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Armchair,
  CalendarClock,
  CheckCircle2,
  EyeOff,
  Loader2,
  Receipt,
  Save,
  Trash2,
} from 'lucide-react';

import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useToast } from '@/hooks/use-toast';
import { isAdminRole } from '@/lib/dashboard-access';
import type {
  WebsiteConsultReservation,
  WebsiteConsultSlot,
  WebsiteReservationSettings,
  WebsiteSeatHoldRequest,
} from '@/lib/types';
import {
  formatSlotLabel,
  getWebsiteReservationSettings,
  isActiveWebsiteConsultReservation,
  toDateMs,
  WEBSITE_RESERVATION_SETTINGS_DOC_ID,
} from '@/lib/website-consult';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

type SlotFormState = {
  date: string;
  startTime: string;
  endTime: string;
  label: string;
  isPublished: boolean;
};

type SettingsFormState = {
  isPublicEnabled: boolean;
  bankAccountDisplay: string;
  depositAmount: string;
  depositorGuide: string;
  nonRefundableNotice: string;
  slotGuideText: string;
  seatGuideText: string;
};

const SLOT_STATUS_META = {
  available: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  booked: 'border-[#ffd9bd] bg-[#fff4eb] text-[#c26a1c]',
  hidden: 'border-slate-200 bg-slate-100 text-slate-600',
} as const;

const RESERVATION_STATUS_META: Record<WebsiteConsultReservation['status'], string> = {
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  canceled: 'border-slate-200 bg-slate-100 text-slate-600',
  completed: 'border-[#dbe5ff] bg-[#eef4ff] text-[#17326B]',
};

const SEAT_HOLD_STATUS_META: Record<WebsiteSeatHoldRequest['status'], string> = {
  pending_transfer: 'border-[#ffd9bd] bg-[#fff4eb] text-[#c26a1c]',
  held: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  canceled: 'border-slate-200 bg-slate-100 text-slate-600',
};

function getTodayDateInput() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getDefaultSlotForm(): SlotFormState {
  return {
    date: getTodayDateInput(),
    startTime: '14:00',
    endTime: '14:40',
    label: '',
    isPublished: true,
  };
}

function getDefaultSettingsForm(settings?: WebsiteReservationSettings | null): SettingsFormState {
  const resolved = getWebsiteReservationSettings(settings);
  return {
    isPublicEnabled: resolved.isPublicEnabled ?? true,
    bankAccountDisplay: resolved.bankAccountDisplay,
    depositAmount: String(resolved.depositAmount),
    depositorGuide: resolved.depositorGuide,
    nonRefundableNotice: resolved.nonRefundableNotice,
    slotGuideText: resolved.slotGuideText || '',
    seatGuideText: resolved.seatGuideText || '',
  };
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat('ko-KR').format(Number(value || 0));
}

export function WebsiteConsultOperations() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();

  const centerId = activeMembership?.id || '';
  const isAdmin = isAdminRole(activeMembership?.role);
  const isMobile = viewMode === 'mobile';

  const [slotForm, setSlotForm] = useState<SlotFormState>(getDefaultSlotForm);
  const [settingsForm, setSettingsForm] = useState<SettingsFormState>(getDefaultSettingsForm(null));
  const [isSavingSlot, setIsSavingSlot] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const settingsRef = useMemo(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return doc(
      firestore,
      'centers',
      centerId,
      'websiteReservationSettings',
      WEBSITE_RESERVATION_SETTINGS_DOC_ID
    );
  }, [firestore, centerId, isAdmin]);
  const { data: settingsDoc } = useDoc<WebsiteReservationSettings>(settingsRef, {
    enabled: Boolean(settingsRef) && isAdmin,
  });

  useEffect(() => {
    setSettingsForm(getDefaultSettingsForm(settingsDoc));
  }, [settingsDoc]);

  const slotsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(
      collection(firestore, 'centers', centerId, 'websiteConsultSlots'),
      orderBy('startsAt', 'asc'),
      limit(200)
    );
  }, [firestore, centerId, isAdmin]);
  const { data: slotDocs, isLoading: slotsLoading } = useCollection<WebsiteConsultSlot>(slotsQuery, {
    enabled: Boolean(slotsQuery) && isAdmin,
  });

  const reservationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(
      collection(firestore, 'centers', centerId, 'websiteConsultReservations'),
      orderBy('createdAt', 'desc'),
      limit(200)
    );
  }, [firestore, centerId, isAdmin]);
  const { data: reservationDocs, isLoading: reservationsLoading } = useCollection<WebsiteConsultReservation>(
    reservationsQuery,
    {
      enabled: Boolean(reservationsQuery) && isAdmin,
    }
  );

  const seatHoldsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(
      collection(firestore, 'centers', centerId, 'websiteSeatHoldRequests'),
      orderBy('createdAt', 'desc'),
      limit(200)
    );
  }, [firestore, centerId, isAdmin]);
  const { data: seatHoldDocs, isLoading: seatHoldsLoading } = useCollection<WebsiteSeatHoldRequest>(seatHoldsQuery, {
    enabled: Boolean(seatHoldsQuery) && isAdmin,
  });

  const reservations = useMemo(
    () => [...(reservationDocs || [])].sort((a, b) => toDateMs(b.createdAt) - toDateMs(a.createdAt)),
    [reservationDocs]
  );
  const seatHolds = useMemo(
    () => [...(seatHoldDocs || [])].sort((a, b) => toDateMs(b.createdAt) - toDateMs(a.createdAt)),
    [seatHoldDocs]
  );
  const activeReservationCountBySlot = useMemo(() => {
    const counts = new Map<string, number>();
    reservations.forEach((reservation) => {
      if (!isActiveWebsiteConsultReservation(reservation.status)) return;
      counts.set(reservation.slotId, (counts.get(reservation.slotId) || 0) + 1);
    });
    return counts;
  }, [reservations]);
  const slots = useMemo(
    () =>
      [...(slotDocs || [])]
        .map((slot) => ({
          ...slot,
          reservationCount: activeReservationCountBySlot.get(slot.id) || 0,
        }))
        .sort((a, b) => toDateMs(a.startsAt) - toDateMs(b.startsAt)),
    [slotDocs, activeReservationCountBySlot]
  );

  const summary = useMemo(
    () => ({
      publishedSlots: slots.filter((slot) => slot.isPublished).length,
      confirmedReservations: reservations.filter((item) => item.status === 'confirmed').length,
      pendingSeatHolds: seatHolds.filter((item) => item.status === 'pending_transfer').length,
      heldSeats: seatHolds.filter((item) => item.status === 'held').length,
    }),
    [slots, reservations, seatHolds]
  );

  if (!isAdmin || !centerId || !firestore) {
    return null;
  }

  async function handleSaveSettings() {
    const depositAmount = Number.parseInt(settingsForm.depositAmount.replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
      toast({ variant: 'destructive', title: '예약금 금액을 확인해 주세요.' });
      return;
    }

    setIsSavingSettings(true);
    try {
      await setDoc(
        doc(firestore, 'centers', centerId, 'websiteReservationSettings', WEBSITE_RESERVATION_SETTINGS_DOC_ID),
        {
          centerId,
          isPublicEnabled: settingsForm.isPublicEnabled,
          bankAccountDisplay: settingsForm.bankAccountDisplay.trim(),
          depositAmount,
          depositorGuide: settingsForm.depositorGuide.trim(),
          nonRefundableNotice: settingsForm.nonRefundableNotice.trim(),
          slotGuideText: settingsForm.slotGuideText.trim(),
          seatGuideText: settingsForm.seatGuideText.trim(),
          updatedAt: new Date().toISOString(),
          updatedByUid: user?.uid || null,
        },
        { merge: true }
      );
      toast({ title: '웹 상담 설정을 저장했습니다.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: '설정 저장에 실패했습니다.', description: error?.message });
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleCreateSlot() {
    if (!slotForm.date || !slotForm.startTime || !slotForm.endTime) {
      toast({ variant: 'destructive', title: '날짜와 시간을 모두 입력해 주세요.' });
      return;
    }

    const startsAt = new Date(`${slotForm.date}T${slotForm.startTime}:00+09:00`);
    const endsAt = new Date(`${slotForm.date}T${slotForm.endTime}:00+09:00`);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      toast({ variant: 'destructive', title: '상담 시작/종료 시간을 다시 확인해 주세요.' });
      return;
    }

    setIsSavingSlot(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'websiteConsultSlots'), {
        centerId,
        label: slotForm.label.trim(),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        capacity: 1,
        isPublished: slotForm.isPublished,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdByUid: user?.uid || null,
        updatedByUid: user?.uid || null,
      });
      setSlotForm(getDefaultSlotForm());
      toast({ title: '새 상담 슬롯을 만들었습니다.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: '슬롯 생성에 실패했습니다.', description: error?.message });
    } finally {
      setIsSavingSlot(false);
    }
  }

  async function handleToggleSlot(slot: WebsiteConsultSlot, isPublished: boolean) {
    setProcessingId(slot.id);
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'websiteConsultSlots', slot.id), {
        isPublished,
        updatedAt: new Date().toISOString(),
        updatedByUid: user?.uid || null,
      });
      toast({ title: isPublished ? '슬롯을 공개했습니다.' : '슬롯을 숨겼습니다.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: '슬롯 상태 변경에 실패했습니다.', description: error?.message });
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDeleteSlot(slot: WebsiteConsultSlot) {
    const activeCount = activeReservationCountBySlot.get(slot.id) || 0;
    if (activeCount > 0) {
      toast({ variant: 'destructive', title: '이미 예약된 슬롯은 삭제할 수 없습니다.' });
      return;
    }
    setProcessingId(slot.id);
    try {
      await deleteDoc(doc(firestore, 'centers', centerId, 'websiteConsultSlots', slot.id));
      toast({ title: '슬롯을 삭제했습니다.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: '슬롯 삭제에 실패했습니다.', description: error?.message });
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReservationStatus(
    reservation: WebsiteConsultReservation,
    nextStatus: WebsiteConsultReservation['status']
  ) {
    setProcessingId(reservation.id);
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'websiteConsultReservations', reservation.id), {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
        canceledAt: nextStatus === 'canceled' ? new Date().toISOString() : null,
        completedAt: nextStatus === 'completed' ? new Date().toISOString() : null,
        updatedByUid: user?.uid || null,
      });
      toast({ title: nextStatus === 'canceled' ? '예약을 취소 처리했습니다.' : '예약을 완료 처리했습니다.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: '예약 상태 변경에 실패했습니다.', description: error?.message });
    } finally {
      setProcessingId(null);
    }
  }

  async function handleSeatHoldStatus(
    seatHold: WebsiteSeatHoldRequest,
    nextStatus: WebsiteSeatHoldRequest['status']
  ) {
    setProcessingId(seatHold.id);
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'websiteSeatHoldRequests', seatHold.id), {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
        confirmedAt: nextStatus === 'held' ? new Date().toISOString() : null,
        canceledAt: nextStatus === 'canceled' ? new Date().toISOString() : null,
        updatedByUid: user?.uid || null,
      });
      toast({ title: nextStatus === 'held' ? '좌석예약을 확정했습니다.' : '좌석예약을 해제했습니다.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: '좌석예약 상태 변경에 실패했습니다.', description: error?.message });
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <section className="space-y-5">
      <div className={cn('grid gap-4', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
        {[
          { label: '공개 슬롯', value: `${summary.publishedSlots}개`, icon: <CalendarClock className="h-4 w-4" /> },
          { label: '예약 확정', value: `${summary.confirmedReservations}건`, icon: <CheckCircle2 className="h-4 w-4" /> },
          { label: '입금 대기', value: `${summary.pendingSeatHolds}건`, icon: <Receipt className="h-4 w-4" /> },
          { label: '좌석예약 확정', value: `${summary.heldSeats}건`, icon: <Armchair className="h-4 w-4" /> },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-[1.5rem] border border-[#dbe5ff] bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_60%,#eef4ff_100%)] px-4 py-4 shadow-[0_22px_40px_-36px_rgba(20,41,95,0.28)]"
          >
            <div className="flex items-center gap-2 text-[#5c6e97]">
              {item.icon}
              <span className="text-[10px] font-black tracking-[0.2em]">{item.label}</span>
            </div>
            <p className="mt-3 text-[1.8rem] font-black tracking-tight text-[#14295F]">{item.value}</p>
          </div>
        ))}
      </div>

      <div className={cn('grid gap-5', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[1.02fr_0.98fr]')}>
        <Card className="rounded-[2rem] border-[#dbe5ff] shadow-[0_28px_60px_-44px_rgba(20,41,95,0.34)]">
          <CardHeader>
            <CardTitle className="text-xl font-black text-[#14295F]">웹 예약 설정</CardTitle>
            <CardDescription className="font-semibold text-[#5c6e97]">
              홍보 웹사이트에 보이는 계좌 정보, 환불 불가 문구, 공개 여부를 관리합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between rounded-[1.25rem] border border-[#dbe5ff] bg-[#f8fbff] px-4 py-3">
              <div>
                <p className="text-sm font-black text-[#14295F]">공개 웹 예약 열기</p>
                <p className="mt-1 text-xs font-semibold text-[#5c6e97]">끄면 홍보 웹에서 상담 예약과 좌석예약 신청이 모두 막힙니다.</p>
              </div>
              <Switch
                checked={settingsForm.isPublicEnabled}
                onCheckedChange={(checked) => setSettingsForm((prev) => ({ ...prev, isPublicEnabled: checked }))}
              />
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label className="text-sm font-black text-[#14295F]">입금 계좌 표기</Label>
                <Input
                  value={settingsForm.bankAccountDisplay}
                  onChange={(event) =>
                    setSettingsForm((prev) => ({ ...prev, bankAccountDisplay: event.target.value }))
                  }
                  className="h-11 rounded-xl border-[#dbe5ff] font-bold text-[#14295F]"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-black text-[#14295F]">예약금 금액</Label>
                <Input
                  value={settingsForm.depositAmount}
                  onChange={(event) =>
                    setSettingsForm((prev) => ({ ...prev, depositAmount: event.target.value }))
                  }
                  className="h-11 rounded-xl border-[#dbe5ff] font-bold text-[#14295F]"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-black text-[#14295F]">입금자 안내</Label>
                <Input
                  value={settingsForm.depositorGuide}
                  onChange={(event) =>
                    setSettingsForm((prev) => ({ ...prev, depositorGuide: event.target.value }))
                  }
                  className="h-11 rounded-xl border-[#dbe5ff] font-bold text-[#14295F]"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-black text-[#14295F]">환불 불가 문구</Label>
                <Textarea
                  value={settingsForm.nonRefundableNotice}
                  onChange={(event) =>
                    setSettingsForm((prev) => ({ ...prev, nonRefundableNotice: event.target.value }))
                  }
                  className="min-h-[90px] rounded-xl border-[#dbe5ff] font-bold text-[#14295F]"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-black text-[#14295F]">상담 슬롯 안내</Label>
                <Textarea
                  value={settingsForm.slotGuideText}
                  onChange={(event) =>
                    setSettingsForm((prev) => ({ ...prev, slotGuideText: event.target.value }))
                  }
                  className="min-h-[70px] rounded-xl border-[#dbe5ff] font-bold text-[#14295F]"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-black text-[#14295F]">좌석/좌석예약 안내</Label>
                <Textarea
                  value={settingsForm.seatGuideText}
                  onChange={(event) =>
                    setSettingsForm((prev) => ({ ...prev, seatGuideText: event.target.value }))
                  }
                  className="min-h-[70px] rounded-xl border-[#dbe5ff] font-bold text-[#14295F]"
                />
              </div>
            </div>

            <Button
              type="button"
              className="h-11 rounded-xl bg-[#14295F] text-white hover:bg-[#10224e]"
              onClick={() => void handleSaveSettings()}
              disabled={isSavingSettings}
            >
              {isSavingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              설정 저장
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-[#dbe5ff] shadow-[0_28px_60px_-44px_rgba(20,41,95,0.34)]">
          <CardHeader>
            <CardTitle className="text-xl font-black text-[#14295F]">상담 슬롯 관리</CardTitle>
            <CardDescription className="font-semibold text-[#5c6e97]">
              센터가 공개할 고정 상담 시간만 미리 열어두고, 공개/숨김/삭제를 바로 처리합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label className="text-sm font-black text-[#14295F]">상담 날짜</Label>
                <Input
                  type="date"
                  value={slotForm.date}
                  onChange={(event) => setSlotForm((prev) => ({ ...prev, date: event.target.value }))}
                  className="h-11 rounded-xl border-[#dbe5ff] font-bold text-[#14295F]"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-black text-[#14295F]">슬롯 이름</Label>
                <Input
                  value={slotForm.label}
                  onChange={(event) => setSlotForm((prev) => ({ ...prev, label: event.target.value }))}
                  placeholder="예: 토요 오전 방문 상담"
                  className="h-11 rounded-xl border-[#dbe5ff] font-bold text-[#14295F]"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-black text-[#14295F]">시작 시간</Label>
                <Input
                  type="time"
                  value={slotForm.startTime}
                  onChange={(event) => setSlotForm((prev) => ({ ...prev, startTime: event.target.value }))}
                  className="h-11 rounded-xl border-[#dbe5ff] font-bold text-[#14295F]"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-black text-[#14295F]">종료 시간</Label>
                <Input
                  type="time"
                  value={slotForm.endTime}
                  onChange={(event) => setSlotForm((prev) => ({ ...prev, endTime: event.target.value }))}
                  className="h-11 rounded-xl border-[#dbe5ff] font-bold text-[#14295F]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[1.25rem] border border-[#dbe5ff] bg-[#f8fbff] px-4 py-3">
              <div>
                <p className="text-sm font-black text-[#14295F]">생성 즉시 공개</p>
                <p className="mt-1 text-xs font-semibold text-[#5c6e97]">끄면 관리자 화면에만 남고 홍보 웹에는 노출되지 않습니다.</p>
              </div>
              <Switch
                checked={slotForm.isPublished}
                onCheckedChange={(checked) => setSlotForm((prev) => ({ ...prev, isPublished: checked }))}
              />
            </div>

            <Button
              type="button"
              className="h-11 rounded-xl bg-[#FF7A16] text-white hover:bg-[#e86d11]"
              onClick={() => void handleCreateSlot()}
              disabled={isSavingSlot}
            >
              {isSavingSlot ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-2 h-4 w-4" />}
              상담 슬롯 만들기
            </Button>

            <div className="space-y-3">
              {slotsLoading ? (
                <div className="py-8 text-center text-sm font-bold text-[#5c6e97]">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </div>
              ) : slots.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-[#dbe5ff] bg-[#f8fbff] px-4 py-8 text-center text-sm font-bold text-[#5c6e97]">
                  아직 등록된 상담 슬롯이 없습니다.
                </div>
              ) : (
                slots.map((slot) => {
                  const activeCount = slot.reservationCount || 0;
                  const slotTone = !slot.isPublished
                    ? SLOT_STATUS_META.hidden
                    : activeCount > 0
                      ? SLOT_STATUS_META.booked
                      : SLOT_STATUS_META.available;

                  return (
                    <div
                      key={slot.id}
                      className="rounded-[1.25rem] border border-[#dbe5ff] bg-[#fbfdff] p-4 shadow-[0_18px_40px_-36px_rgba(20,41,95,0.28)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-black text-[#14295F]">{formatSlotLabel(slot)}</p>
                          <p className="mt-1 text-sm font-semibold text-[#5c6e97]">
                            {formatDateTime(slot.startsAt)} - {formatDateTime(slot.endsAt)}
                          </p>
                        </div>
                        <Badge className={cn('border font-black', slotTone)}>
                          {!slot.isPublished ? '숨김' : activeCount > 0 ? `${activeCount}팀 예약` : '예약 가능'}
                        </Badge>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-xl border-[#dbe5ff] font-black text-[#14295F]"
                          onClick={() => void handleToggleSlot(slot, !slot.isPublished)}
                          disabled={processingId === slot.id}
                        >
                          {slot.isPublished ? <EyeOff className="mr-1.5 h-4 w-4" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                          {slot.isPublished ? '숨기기' : '다시 공개'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-xl border-rose-200 font-black text-rose-600 hover:bg-rose-50"
                          onClick={() => void handleDeleteSlot(slot)}
                          disabled={processingId === slot.id}
                        >
                          <Trash2 className="mr-1.5 h-4 w-4" />
                          삭제
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className={cn('grid gap-5', isMobile ? 'grid-cols-1' : 'xl:grid-cols-2')}>
        <Card className="rounded-[2rem] border-[#dbe5ff] shadow-[0_28px_60px_-44px_rgba(20,41,95,0.34)]">
          <CardHeader>
            <CardTitle className="text-xl font-black text-[#14295F]">웹 상담 예약 목록</CardTitle>
            <CardDescription className="font-semibold text-[#5c6e97]">
              홍보 리드 기반으로 들어온 예약을 확인하고 취소/완료 처리합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {reservationsLoading ? (
              <div className="py-8 text-center text-sm font-bold text-[#5c6e97]">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </div>
            ) : reservations.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-[#dbe5ff] bg-[#f8fbff] px-4 py-8 text-center text-sm font-bold text-[#5c6e97]">
                아직 들어온 웹 상담 예약이 없습니다.
              </div>
            ) : (
              reservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="rounded-[1.25rem] border border-[#dbe5ff] bg-[#fbfdff] p-4 shadow-[0_18px_40px_-36px_rgba(20,41,95,0.28)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-[#14295F]">
                        {reservation.studentName} {reservation.receiptId ? `· ${reservation.receiptId}` : ''}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#5c6e97]">
                        {reservation.requestTypeLabel || '기존 입학문의'} · {reservation.consultPhone}
                      </p>
                    </div>
                    <Badge className={cn('border font-black', RESERVATION_STATUS_META[reservation.status])}>
                      {reservation.status}
                    </Badge>
                  </div>
                  <div className="mt-3 rounded-[1rem] border border-[#dbe5ff] bg-white px-3 py-3">
                    <p className="text-[10px] font-black tracking-[0.18em] text-[#5c6e97]">예약 시간</p>
                    <p className="mt-1 text-sm font-black text-[#14295F]">{formatDateTime(reservation.startsAt)}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {reservation.status === 'confirmed' ? (
                      <>
                        <Button
                          type="button"
                          className="h-9 rounded-xl bg-[#14295F] text-white hover:bg-[#10224e]"
                          onClick={() => void handleReservationStatus(reservation, 'completed')}
                          disabled={processingId === reservation.id}
                        >
                          완료 처리
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-xl border-rose-200 font-black text-rose-600 hover:bg-rose-50"
                          onClick={() => void handleReservationStatus(reservation, 'canceled')}
                          disabled={processingId === reservation.id}
                        >
                          취소 처리
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-[#dbe5ff] shadow-[0_28px_60px_-44px_rgba(20,41,95,0.34)]">
          <CardHeader>
            <CardTitle className="text-xl font-black text-[#14295F]">좌석예약 요청 목록</CardTitle>
            <CardDescription className="font-semibold text-[#5c6e97]">
              입금대기 확인 후 좌석예약 확정 또는 해제를 진행합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {seatHoldsLoading ? (
              <div className="py-8 text-center text-sm font-bold text-[#5c6e97]">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </div>
            ) : seatHolds.length === 0 ? (
              <div className="rounded-[1.25rem] border border-dashed border-[#dbe5ff] bg-[#f8fbff] px-4 py-8 text-center text-sm font-bold text-[#5c6e97]">
                아직 들어온 좌석예약 요청이 없습니다.
              </div>
            ) : (
              seatHolds.map((seatHold) => (
                <div
                  key={seatHold.id}
                  className="rounded-[1.25rem] border border-[#dbe5ff] bg-[#fbfdff] p-4 shadow-[0_18px_40px_-36px_rgba(20,41,95,0.28)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-[#14295F]">
                        {seatHold.studentName} · {seatHold.seatLabel}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#5c6e97]">
                        {seatHold.requestTypeLabel || '관리형 스터디센터 문의'} · {seatHold.consultPhone}
                      </p>
                    </div>
                    <Badge className={cn('border font-black', SEAT_HOLD_STATUS_META[seatHold.status])}>
                      {seatHold.status}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-[1rem] border border-[#dbe5ff] bg-white px-3 py-3">
                      <p className="text-[10px] font-black tracking-[0.18em] text-[#5c6e97]">예약금</p>
                      <p className="mt-1 text-sm font-black text-[#14295F]">
                        {formatCurrency(seatHold.depositAmount)}원
                      </p>
                    </div>
                    <div className="rounded-[1rem] border border-[#dbe5ff] bg-white px-3 py-3">
                      <p className="text-[10px] font-black tracking-[0.18em] text-[#5c6e97]">신청 시각</p>
                      <p className="mt-1 text-sm font-black text-[#14295F]">{formatDateTime(seatHold.createdAt)}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs font-semibold leading-5 text-[#9a5516]">
                    {seatHold.nonRefundableNotice}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {seatHold.status === 'pending_transfer' ? (
                      <>
                        <Button
                          type="button"
                          className="h-9 rounded-xl bg-[#14295F] text-white hover:bg-[#10224e]"
                          onClick={() => void handleSeatHoldStatus(seatHold, 'held')}
                          disabled={processingId === seatHold.id}
                        >
                          입금 확인 후 확정
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 rounded-xl border-rose-200 font-black text-rose-600 hover:bg-rose-50"
                          onClick={() => void handleSeatHoldStatus(seatHold, 'canceled')}
                          disabled={processingId === seatHold.id}
                        >
                          대기 해제
                        </Button>
                      </>
                    ) : seatHold.status === 'held' ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 rounded-xl border-rose-200 font-black text-rose-600 hover:bg-rose-50"
                        onClick={() => void handleSeatHoldStatus(seatHold, 'canceled')}
                        disabled={processingId === seatHold.id}
                      >
                        확정 해제
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
