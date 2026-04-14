'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, doc, limit, query } from 'firebase/firestore';
import {
  Gift,
  Loader2,
  PlugZap,
  RefreshCcw,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  TriangleAlert,
  Wallet,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAppContext } from '@/contexts/app-context';
import { useCollection, useDoc, useFirestore } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { useToast } from '@/hooks/use-toast';
import { canManageSettings } from '@/lib/dashboard-access';
import { getSafeErrorMessage } from '@/lib/exposed-error';
import {
  approveGiftishowOrderSecure,
  cancelGiftishowSendFailSecure,
  cancelGiftishowOrderSecure,
  getGiftishowBizmoneySecure,
  rejectGiftishowOrderSecure,
  resendGiftishowOrderSecure,
  saveGiftishowSettingsSecure,
  syncGiftishowCatalogSecure,
} from '@/lib/giftishow-actions';
import {
  formatGiftishowTimestamp,
  getGiftishowOrderStatusLabel,
  getGiftishowOrderStatusTone,
  getGiftishowSyncStatusLabel,
  sortGiftishowOrdersByRecent,
  sortGiftishowProducts,
} from '@/lib/giftishow';
import type {
  GiftishowBrand,
  GiftishowOrder,
  GiftishowProduct,
  GiftishowSettings,
  GiftishowSyncStatus,
} from '@/lib/types';
import { cn } from '@/lib/utils';

type GiftishowFormState = {
  enabled: boolean;
  bannerId: string;
  templateId: string;
  userId: string;
  callbackNo: string;
};

type GiftishowOrderCardProps = {
  order: GiftishowOrder & { id: string };
  actionKey: string | null;
  onApprove: (orderId: string) => Promise<void>;
  onReject: (orderId: string) => Promise<void>;
  onCancel: (orderId: string) => Promise<void>;
  onCancelSendFail: (orderId: string) => Promise<void>;
  onResend: (orderId: string) => Promise<void>;
};

const DEFAULT_FORM: GiftishowFormState = {
  enabled: false,
  bannerId: '',
  templateId: '',
  userId: '',
  callbackNo: '',
};

function getGiftishowSyncTone(status?: GiftishowSyncStatus | null) {
  if (status === 'success') return 'bg-emerald-100 text-emerald-700';
  if (status === 'syncing') return 'bg-amber-100 text-amber-700';
  if (status === 'error') return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-700';
}

function getProductImage(product?: GiftishowProduct | null) {
  return product?.goodsImgB || product?.goodsImgS || product?.mmsGoodsImg || product?.brandIconImg || '';
}

function formatPoints(value?: number | null) {
  return `${Math.max(0, Number(value || 0)).toLocaleString()}P`;
}

function formatWon(value?: number | null) {
  return `${Math.max(0, Number(value || 0)).toLocaleString()}원`;
}

function GiftishowOrderCard({
  order,
  actionKey,
  onApprove,
  onReject,
  onCancel,
  onCancelSendFail,
  onResend,
}: GiftishowOrderCardProps) {
  const actionButtons = [
    order.status === 'requested' ? (
      <Button
        key="approve"
        type="button"
        size="sm"
        variant="secondary"
        className="rounded-full"
        disabled={actionKey === `approve:${order.id}`}
        onClick={() => void onApprove(order.id || '')}
      >
        {actionKey === `approve:${order.id}` ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
        승인
      </Button>
    ) : null,
    order.status === 'requested' ? (
      <Button
        key="reject"
        type="button"
        size="sm"
        variant="outline"
        className="rounded-full text-rose-600"
        disabled={actionKey === `reject:${order.id}`}
        onClick={() => void onReject(order.id || '')}
      >
        {actionKey === `reject:${order.id}` ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1.5 h-3.5 w-3.5" />}
        반려
      </Button>
    ) : null,
    ['sending', 'pending_provider', 'sent'].includes(order.status) ? (
      <Button
        key="cancel"
        type="button"
        size="sm"
        variant="outline"
        className="rounded-full text-rose-600"
        disabled={actionKey === `cancel:${order.id}`}
        onClick={() => void onCancel(order.id || '')}
      >
        {actionKey === `cancel:${order.id}` ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1.5 h-3.5 w-3.5" />}
        취소
      </Button>
    ) : null,
    order.status === 'failed' && order.trId ? (
      <Button
        key="cancel-send-fail"
        type="button"
        size="sm"
        variant="outline"
        className="rounded-full text-amber-700"
        disabled={actionKey === `cancel-send-fail:${order.id}`}
        onClick={() => void onCancelSendFail(order.id || '')}
      >
        {actionKey === `cancel-send-fail:${order.id}` ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
        )}
        발송실패 취소
      </Button>
    ) : null,
    order.status === 'sent' ? (
      <Button
        key="resend"
        type="button"
        size="sm"
        variant="outline"
        className="rounded-full"
        disabled={actionKey === `resend:${order.id}`}
        onClick={() => void onResend(order.id || '')}
      >
        {actionKey === `resend:${order.id}` ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
        재전송
      </Button>
    ) : null,
  ].filter(Boolean);

  return (
    <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-black text-slate-900">{order.goodsName}</p>
            <Badge className={cn('border-none font-black', getGiftishowOrderStatusTone(order.status))}>
              {getGiftishowOrderStatusLabel(order.status)}
            </Badge>
            <Badge className="border-none bg-slate-100 text-slate-700 font-black">
              {order.providerMode === 'live' ? 'LIVE' : 'MOCK'}
            </Badge>
          </div>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {order.studentName} · {order.recipientPhoneMasked || '번호 미등록'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-black text-slate-900">{formatPoints(order.pointCost)}</p>
          <p className="mt-1 text-[11px] font-bold text-slate-500">
            {formatGiftishowTimestamp(order.updatedAt || order.createdAt || order.requestedAt)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-xs font-bold text-slate-600 sm:grid-cols-2">
        <p>요청 시각 · {formatGiftishowTimestamp(order.requestedAt || order.createdAt)}</p>
        <p>TR_ID · {order.trId || '-'}</p>
        <p>주문번호 · {order.orderNo || '-'}</p>
        <p>재전송 · {Math.max(0, Number(order.resendCount || 0))}회</p>
      </div>

      {order.lastErrorMessage ? (
        <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
          최근 오류: {order.lastErrorMessage}
        </div>
      ) : null}
      {order.rejectionReason ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
          반려 사유: {order.rejectionReason}
        </div>
      ) : null}
      {order.cancelledReason ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
          취소 사유: {order.cancelledReason}
        </div>
      ) : null}

      {actionButtons.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{actionButtons}</div> : null}
    </div>
  );
}

export default function GiftishowSettingsPage() {
  const firestore = useFirestore();
  const { activeMembership, membershipsLoading, viewMode } = useAppContext();
  const { toast } = useToast();

  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;
  const isAdmin = canManageSettings(activeMembership?.role);

  const [form, setForm] = useState<GiftishowFormState>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);
  const [isFetchingBizmoney, setIsFetchingBizmoney] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return doc(firestore, 'centers', centerId, 'settings', 'giftishow');
  }, [firestore, centerId, isAdmin]);
  const { data: settingsDoc, isLoading: isSettingsLoading } = useDoc<GiftishowSettings>(settingsRef, { enabled: isAdmin });

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(collection(firestore, 'centers', centerId, 'giftishowProducts'), limit(200));
  }, [firestore, centerId, isAdmin]);
  const { data: giftishowProductsRaw } = useCollection<GiftishowProduct>(productsQuery, { enabled: isAdmin });

  const brandsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(collection(firestore, 'centers', centerId, 'giftishowBrands'), limit(200));
  }, [firestore, centerId, isAdmin]);
  const { data: giftishowBrandsRaw } = useCollection<GiftishowBrand>(brandsQuery, { enabled: isAdmin });

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(collection(firestore, 'centers', centerId, 'giftishowOrders'), limit(200));
  }, [firestore, centerId, isAdmin]);
  const { data: giftishowOrdersRaw } = useCollection<GiftishowOrder>(ordersQuery, { enabled: isAdmin });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      enabled: settingsDoc?.enabled === true,
      bannerId: settingsDoc?.bannerId || '',
      templateId: settingsDoc?.templateId || '',
    }));
  }, [settingsDoc?.enabled, settingsDoc?.bannerId, settingsDoc?.templateId]);

  const products = useMemo(() => sortGiftishowProducts(giftishowProductsRaw || []), [giftishowProductsRaw]);
  const brands = useMemo(
    () => [...(giftishowBrandsRaw || [])].sort((left, right) => (left.brandName || '').localeCompare(right.brandName || '', 'ko')),
    [giftishowBrandsRaw]
  );
  const orders = useMemo(() => sortGiftishowOrdersByRecent(giftishowOrdersRaw || []), [giftishowOrdersRaw]);

  const availableProducts = useMemo(
    () => products.filter((product) => product.isAvailable && product.goodsStateCd === 'SALE'),
    [products]
  );
  const detailSyncedProducts = useMemo(
    () => products.filter((product) => Boolean(product.detailSyncedAt)).length,
    [products]
  );
  const detailSyncedBrands = useMemo(() => brands.filter((brand) => Boolean(brand.detailSyncedAt)).length, [brands]);
  const brandCount = Math.max(brands.length, Math.max(0, Number(settingsDoc?.lastBrandCount || 0)));
  const detailSyncedCount = Math.max(detailSyncedProducts, Math.max(0, Number(settingsDoc?.lastDetailSyncedCount || 0)));
  const brandDetailSyncedCount = Math.max(
    detailSyncedBrands,
    Math.max(0, Number(settingsDoc?.lastBrandDetailSyncedCount || 0))
  );
  const requestedOrders = useMemo(() => orders.filter((order) => order.status === 'requested'), [orders]);
  const deliveryOrders = useMemo(
    () => orders.filter((order) => ['sending', 'pending_provider', 'sent'].includes(order.status)),
    [orders]
  );
  const failedOrders = useMemo(
    () => orders.filter((order) => ['failed', 'rejected', 'cancelled'].includes(order.status)),
    [orders]
  );

  const capabilityBadges = useMemo(
    () => [
      { label: '인증 Key', configured: settingsDoc?.authCodeConfigured === true },
      { label: 'Token Key', configured: settingsDoc?.authTokenConfigured === true },
      { label: 'user_id', configured: settingsDoc?.userIdConfigured === true },
      { label: 'callback_no', configured: settingsDoc?.callbackNoConfigured === true },
    ],
    [
      settingsDoc?.authCodeConfigured,
      settingsDoc?.authTokenConfigured,
      settingsDoc?.userIdConfigured,
      settingsDoc?.callbackNoConfigured,
    ]
  );

  const orderSections = useMemo(
    () => [
      {
        key: 'requested',
        title: '승인 대기',
        description: '학생 요청을 검토하고 승인 또는 반려합니다.',
        emptyLabel: '승인 대기 요청이 없습니다.',
        orders: requestedOrders,
      },
      {
        key: 'delivery',
        title: '발송 추적',
        description: '전송 중, 사업자 확인 중, 발송 완료 주문을 확인합니다.',
        emptyLabel: '추적 중인 주문이 없습니다.',
        orders: deliveryOrders,
      },
      {
        key: 'failed',
        title: '실패/종료',
        description: '실패, 반려, 취소 이력을 확인합니다.',
        emptyLabel: '실패 또는 종료 주문이 없습니다.',
        orders: failedOrders,
      },
    ],
    [deliveryOrders, failedOrders, requestedOrders]
  );

  const updateField = <K extends keyof GiftishowFormState>(key: K, value: GiftishowFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    if (!centerId) return;

    setIsSaving(true);
    try {
      await saveGiftishowSettingsSecure({
        centerId,
        enabled: form.enabled,
        bannerId: form.bannerId.trim(),
        templateId: form.templateId.trim(),
        userId: form.userId.trim(),
        callbackNo: form.callbackNo.trim(),
      });

      setForm((current) => ({
        ...current,
        userId: '',
        callbackNo: '',
      }));

      toast({
        title: '기프티쇼 설정을 저장했습니다.',
        description: '서버 시크릿 상태와 발송 정보를 안전하게 저장했습니다.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '설정 저장 실패',
        description: getSafeErrorMessage(error, '기프티쇼 설정 저장 중 오류가 발생했습니다.'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncCatalog = async () => {
    if (!centerId) return;

    setIsSyncingCatalog(true);
    try {
      const result = await syncGiftishowCatalogSecure(centerId);
      toast({
        title: '필수 API 동기화를 완료했습니다.',
        description: `상품 ${result.syncedCount.toLocaleString()}개 · 상품 상세 ${result.detailSyncedCount.toLocaleString()}개 · 브랜드 ${result.brandCount.toLocaleString()}개 · 브랜드 상세 ${result.brandDetailSyncedCount.toLocaleString()}개 · ${result.mode.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '필수 API 동기화 실패',
        description: getSafeErrorMessage(error, '필수 API 동기화 중 오류가 발생했습니다.'),
      });
    } finally {
      setIsSyncingCatalog(false);
    }
  };

  const handleFetchBizmoney = async () => {
    if (!centerId) return;

    setIsFetchingBizmoney(true);
    try {
      const result = await getGiftishowBizmoneySecure(centerId);
      toast({
        title: '비즈머니 잔액을 조회했습니다.',
        description: `${formatWon(result.balance)} · ${result.mode.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '비즈머니 조회 실패',
        description: getSafeErrorMessage(error, '비즈머니 잔액을 가져오지 못했습니다.'),
      });
    } finally {
      setIsFetchingBizmoney(false);
    }
  };

  const handleApprove = async (orderId: string) => {
    if (!centerId || !orderId) return;
    if (!window.confirm('이 요청을 승인하고 포인트 차감 후 MMS 발송을 진행할까요?')) return;

    setActionKey(`approve:${orderId}`);
    try {
      await approveGiftishowOrderSecure({ centerId, orderId });
      toast({ title: '승인 완료', description: '포인트 차감과 MMS 발송을 시작했습니다.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '승인 실패',
        description: getSafeErrorMessage(error, '주문 승인 중 오류가 발생했습니다.'),
      });
    } finally {
      setActionKey(null);
    }
  };

  const handleReject = async (orderId: string) => {
    if (!centerId || !orderId) return;
    const reason = window.prompt('반려 사유를 입력해 주세요. 비워두면 사유 없이 반려됩니다.', '') ?? null;
    if (reason === null) return;

    setActionKey(`reject:${orderId}`);
    try {
      await rejectGiftishowOrderSecure({ centerId, orderId, reason: reason.trim() || undefined });
      toast({ title: '반려 처리 완료', description: '학생 요청을 반려했습니다.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '반려 실패',
        description: getSafeErrorMessage(error, '반려 처리 중 오류가 발생했습니다.'),
      });
    } finally {
      setActionKey(null);
    }
  };

  const handleCancel = async (orderId: string) => {
    if (!centerId || !orderId) return;
    const reason = window.prompt('취소 사유를 입력해 주세요. 포인트는 자동 환불됩니다.', '관리자 취소') ?? null;
    if (reason === null) return;

    setActionKey(`cancel:${orderId}`);
    try {
      await cancelGiftishowOrderSecure({ centerId, orderId, reason: reason.trim() || undefined });
      toast({ title: '주문 취소 완료', description: '기프티쇼 취소 및 포인트 환불을 완료했습니다.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '주문 취소 실패',
        description: getSafeErrorMessage(error, '주문 취소 중 오류가 발생했습니다.'),
      });
    } finally {
      setActionKey(null);
    }
  };

  const handleCancelSendFail = async (orderId: string) => {
    if (!centerId || !orderId) return;
    const reason =
      window.prompt(
        '발송 실패 주문을 공급사 기준으로 정리합니다. 비워두면 기본 사유로 저장됩니다.',
        '발송실패 취소 완료'
      ) ?? null;
    if (reason === null) return;

    setActionKey(`cancel-send-fail:${orderId}`);
    try {
      await cancelGiftishowSendFailSecure({ centerId, orderId, reason: reason.trim() || undefined });
      toast({ title: '발송실패 취소 완료', description: '실패 주문을 기프티쇼 기준으로 정리했습니다.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '발송실패 취소 실패',
        description: getSafeErrorMessage(error, '발송실패 취소 처리 중 오류가 발생했습니다.'),
      });
    } finally {
      setActionKey(null);
    }
  };

  const handleResend = async (orderId: string) => {
    if (!centerId || !orderId) return;
    if (!window.confirm('이 쿠폰을 다시 전송할까요? 포인트는 다시 차감되지 않습니다.')) return;

    setActionKey(`resend:${orderId}`);
    try {
      await resendGiftishowOrderSecure({ centerId, orderId });
      toast({ title: '재전송 요청 완료', description: '기프티쇼 사업자에 재전송 요청을 보냈습니다.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '재전송 실패',
        description: getSafeErrorMessage(error, '재전송 처리 중 오류가 발생했습니다.'),
      });
    } finally {
      setActionKey(null);
    }
  };

  if (membershipsLoading && !activeMembership) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-30" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="font-bold text-muted-foreground">센터 관리자만 기프티쇼 설정을 관리할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className={cn('mx-auto flex w-full max-w-7xl flex-col gap-5', isMobile ? 'px-3 pb-24 pt-2' : 'px-1 pb-10 pt-4')}>
      <Card className="rounded-[2rem] border-none shadow-xl ring-1 ring-black/[0.04]">
        <CardHeader className="border-b bg-muted/10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
                <Gift className="h-5 w-5" />
                Giftishow MMS 보상샵
              </CardTitle>
              <CardDescription className="mt-2 font-bold text-sm">
                학생 요청을 관리자가 승인하면 포인트를 차감하고, 기프티쇼 MMS로 모바일 쿠폰을 발송합니다.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn('border-none font-black', form.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700')}>
                {form.enabled ? '사용 중' : '비활성'}
              </Badge>
              <Badge className="border-none bg-slate-100 text-slate-700 font-black">MMS</Badge>
              <Badge className={cn('border-none font-black', getGiftishowSyncTone(settingsDoc?.lastSyncStatus))}>
                동기화 {getGiftishowSyncStatusLabel(settingsDoc?.lastSyncStatus)}
              </Badge>
              <Button type="button" variant="secondary" className="h-10 rounded-xl gap-2 font-black" onClick={() => void handleSave()} disabled={isSaving || isSettingsLoading}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                설정 저장
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 p-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground">보상샵 활성화</Label>
              <div className="flex h-11 items-center justify-between rounded-xl border-2 px-3">
                <span className="text-sm font-bold">학생 요청 허용</span>
                <Switch checked={form.enabled} onCheckedChange={(checked) => updateField('enabled', checked)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground">발송 방식</Label>
              <div className="flex h-11 items-center rounded-xl border-2 px-3 text-sm font-black text-slate-700">
                MMS 고정
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="giftishow-banner-id" className="text-[11px] font-black uppercase text-muted-foreground">배너 아이디</Label>
              <Input
                id="giftishow-banner-id"
                value={form.bannerId}
                onChange={(event) => updateField('bannerId', event.target.value)}
                placeholder="예: 20200601058067"
                className="h-11 rounded-xl border-2 font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="giftishow-template-id" className="text-[11px] font-black uppercase text-muted-foreground">카드 아이디</Label>
              <Input
                id="giftishow-template-id"
                value={form.templateId}
                onChange={(event) => updateField('templateId', event.target.value)}
                placeholder="예: 202006010057417"
                className="h-11 rounded-xl border-2 font-bold"
              />
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-black text-slate-900">비밀값 상태</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {capabilityBadges.map((item) => (
                <Badge
                  key={item.label}
                  className={cn(
                    'border-none font-black',
                    item.configured ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                  )}
                >
                  {item.label} · {item.configured ? '저장됨' : '미설정'}
                </Badge>
              ))}
            </div>
            <p className="mt-3 text-xs font-bold leading-5 text-slate-500">
              인증 Key와 Token Key는 서버 시크릿에만 보관됩니다. 이 화면에서는 저장 여부만 확인하고, 센터별 발송 정보만 별도로 관리합니다.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border-none shadow-xl ring-1 ring-black/[0.04]">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle className="text-xl font-black tracking-tight">발송 정보 입력</CardTitle>
          <CardDescription className="font-bold text-sm">
            상용 인증키는 서버 시크릿에서만 읽습니다. 여기서는 센터별 `user_id`, `callback_no`만 저장합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="giftishow-user-id" className="text-[11px] font-black uppercase text-muted-foreground">user_id</Label>
            <Input
              id="giftishow-user-id"
              value={form.userId}
              onChange={(event) => updateField('userId', event.target.value)}
              placeholder="관리자 콘솔 user_id"
              className="h-11 rounded-xl border-2 font-bold"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="giftishow-callback-no" className="text-[11px] font-black uppercase text-muted-foreground">callback_no</Label>
            <Input
              id="giftishow-callback-no"
              value={form.callbackNo}
              onChange={(event) => updateField('callbackNo', event.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="01012345678"
              className="h-11 rounded-xl border-2 font-bold"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-[2rem] border-none shadow-xl ring-1 ring-black/[0.04]">
          <CardHeader className="border-b bg-muted/10">
            <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
              <PlugZap className="h-5 w-5" />
              운영 상태
            </CardTitle>
            <CardDescription className="font-bold text-sm">
              비즈머니와 함께 상품 목록, 상품 상세, 브랜드, 브랜드 상세 필수 API 동기화 현황을 확인합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-black uppercase text-slate-500">카탈로그 상품</p>
                <p className="mt-2 text-xl font-black text-slate-900">{products.length.toLocaleString()}개</p>
              </div>
              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-black uppercase text-slate-500">판매 가능</p>
                <p className="mt-2 text-xl font-black text-slate-900">{availableProducts.length.toLocaleString()}개</p>
              </div>
              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-black uppercase text-slate-500">브랜드</p>
                <p className="mt-2 text-xl font-black text-slate-900">{brandCount.toLocaleString()}개</p>
              </div>
              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-black uppercase text-slate-500">상품 상세</p>
                <p className="mt-2 text-xl font-black text-slate-900">{detailSyncedCount.toLocaleString()}개</p>
              </div>
              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-black uppercase text-slate-500">브랜드 상세</p>
                <p className="mt-2 text-xl font-black text-slate-900">{brandDetailSyncedCount.toLocaleString()}개</p>
              </div>
              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-black uppercase text-slate-500">비즈머니</p>
                <p className="mt-2 text-xl font-black text-slate-900">{formatWon(settingsDoc?.lastBizmoneyBalance)}</p>
              </div>
              <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-black uppercase text-slate-500">최근 동기화</p>
                <p className="mt-2 text-base font-black text-slate-900">{formatGiftishowTimestamp(settingsDoc?.lastCatalogSyncedAt)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="rounded-xl font-black" disabled={isFetchingBizmoney} onClick={() => void handleFetchBizmoney()}>
                {isFetchingBizmoney ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wallet className="mr-2 h-4 w-4" />}
                비즈머니 조회
              </Button>
              <Button type="button" variant="outline" className="rounded-xl font-black" disabled={isSyncingCatalog} onClick={() => void handleSyncCatalog()}>
                {isSyncingCatalog ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                필수 API 동기화
              </Button>
            </div>

            {settingsDoc?.lastErrorMessage ? (
              <div className="rounded-[1.35rem] border border-rose-100 bg-rose-50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-4 w-4 text-rose-600" />
                  <div>
                    <p className="text-sm font-black text-rose-700">최근 오류</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-rose-700">{settingsDoc.lastErrorMessage}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[1.35rem] border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-bold leading-5 text-emerald-700">
                최근 저장된 오류가 없습니다. mock/live 모드는 함수 런타임 환경에 따라 자동으로 선택됩니다.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-xl ring-1 ring-black/[0.04]">
          <CardHeader className="border-b bg-muted/10">
            <CardTitle className="text-xl font-black tracking-tight">카탈로그 미리보기</CardTitle>
            <CardDescription className="font-bold text-sm">
              학생 앱에 노출될 최근 상품입니다. 상품 포인트는 salePrice를 그대로 사용합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {products.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed py-12 text-center text-sm font-bold text-muted-foreground">
                아직 동기화된 상품이 없습니다. 먼저 카탈로그 동기화를 실행해 주세요.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {products.slice(0, 12).map((product) => {
                  const productImage = getProductImage(product);
                  return (
                    <div key={product.id || product.goodsCode} className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-sm">
                      <div className="aspect-[1.3/1] bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
                        {productImage ? (
                          <img src={productImage} alt={product.goodsName} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs font-black text-slate-400">IMAGE</div>
                        )}
                      </div>
                      <div className="space-y-2 p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={cn('border-none font-black', product.isAvailable && product.goodsStateCd === 'SALE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700')}>
                            {product.goodsStateCd || 'UNKNOWN'}
                          </Badge>
                          <p className="text-xs font-bold text-slate-500">{product.brandName || product.affiliate || '브랜드'}</p>
                        </div>
                        <p className="line-clamp-2 text-sm font-black leading-5 text-slate-900">{product.goodsName}</p>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-base font-black text-[#14295F]">{formatPoints(product.pointCost)}</p>
                          <p className="text-xs font-bold text-slate-500">{formatWon(product.salePrice)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {orderSections.map((section) => (
          <Card key={section.key} className="rounded-[2rem] border-none shadow-xl ring-1 ring-black/[0.04]">
            <CardHeader className="border-b bg-muted/10">
              <CardTitle className="text-xl font-black tracking-tight">{section.title}</CardTitle>
              <CardDescription className="font-bold text-sm">{section.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-6">
              {section.orders.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed py-10 text-center text-sm font-bold text-muted-foreground">
                  {section.emptyLabel}
                </div>
              ) : (
                section.orders.slice(0, 12).map((order) => (
                  <GiftishowOrderCard
                    key={order.id || `${section.key}-${order.trId || order.goodsCode}-${order.studentId}`}
                    order={order}
                    actionKey={actionKey}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onCancel={handleCancel}
                    onCancelSendFail={handleCancelSendFail}
                    onResend={handleResend}
                  />
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
