'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import { AlertTriangle, ArrowLeft, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { doc } from 'firebase/firestore';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppContext } from '@/contexts/app-context';
import { useDoc, useFirestore } from '@/firebase';
import type { Invoice } from '@/lib/types';

type CheckoutPageClientProps = {
  invoiceId: string;
  tossClientKey: string;
};

export function CheckoutPageClient({ invoiceId, tossClientKey }: CheckoutPageClientProps) {
  const firestore = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeMembership } = useAppContext();

  const [isRequesting, setIsRequesting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const centerIdFromQuery = (searchParams.get('centerId') || '').trim();
  const centerId = centerIdFromQuery || activeMembership?.id || '';
  const invoiceRef = firestore && centerId ? doc(firestore, 'centers', centerId, 'invoices', invoiceId) : null;
  const { data: invoice, isLoading: invoiceLoading } = useDoc<Invoice>(invoiceRef as any);

  useEffect(() => {
    if (!invoiceLoading) setIsLoading(false);
  }, [invoiceLoading]);

  const canRequestPayment = useMemo(() => {
    if (!invoice || !tossClientKey) return false;
    return invoice.status === 'issued' || invoice.status === 'overdue';
  }, [invoice, tossClientKey]);

  const handlePayment = async () => {
    if (!invoice || !centerId || !tossClientKey || isRequesting || !canRequestPayment) return;

    setIsRequesting(true);
    try {
      const tossPayments = await loadTossPayments(tossClientKey);
      const orderId = `invoice_${invoiceId}_${Math.random().toString(36).slice(2, 10)}`;
      const successUrl = `${window.location.origin}/payment/success?invoiceId=${invoiceId}&centerId=${centerId}`;
      const failUrl = `${window.location.origin}/payment/fail?invoiceId=${invoiceId}&centerId=${centerId}`;

      await tossPayments.requestPayment('카드', {
        amount: Math.max(0, Math.round(Number(invoice.finalPrice) || 0)),
        orderId,
        orderName: `${invoice.studentName} 학생 수납`,
        customerName: invoice.studentName || '학부모',
        successUrl,
        failUrl,
      });
    } catch (error) {
      console.error('Payment request failed:', error);
      setIsRequesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#fafafa] p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
        <p className="text-sm font-black tracking-wide text-primary/70">결제 정보를 불러오고 있습니다.</p>
      </div>
    );
  }

  if (!invoice || !centerId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa] p-4">
        <Card className="w-full max-w-md rounded-[2.25rem] border-none bg-white p-2 shadow-2xl">
          <CardHeader className="items-center text-center">
            <AlertTriangle className="h-10 w-10 text-rose-500" />
            <CardTitle className="text-2xl font-black tracking-tight text-rose-600">결제 정보를 찾을 수 없습니다</CardTitle>
            <CardDescription className="font-bold text-slate-500">유효하지 않은 결제 링크이거나 이미 처리된 요청일 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="h-12 w-full rounded-xl font-black" onClick={() => router.push('/')}>
              홈으로 이동
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dueDate = typeof invoice.cycleEndDate?.toDate === 'function' ? invoice.cycleEndDate.toDate() : null;
  const amount = Math.max(0, Math.round(Number(invoice.finalPrice) || 0));

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fafafa] p-4">
      <Card className="w-full max-w-xl overflow-hidden rounded-[2.75rem] border-none bg-white shadow-[0_40px_90px_-30px_rgba(17,24,39,0.35)]">
        <CardHeader className="space-y-3 border-b bg-slate-50/70 px-8 py-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[#14295F]/10 p-3 text-[#14295F]">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black tracking-tight text-[#14295F]">수납 결제</CardTitle>
              <CardDescription className="font-bold text-slate-500">
                센터에서 요청한 수납 금액을 결제합니다.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 px-8 py-8">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">청구 대상</span>
              <Badge className="h-5 border-none bg-[#14295F]/10 px-2 text-[10px] font-black text-[#14295F]">
                {invoice.trackCategory === 'academy' ? '학원' : '독서실'}
              </Badge>
            </div>
            <p className="text-lg font-black text-[#14295F]">{invoice.studentName} 학생</p>
            <p className="mt-1 text-[11px] font-bold text-slate-500">
              결제 마감일 {dueDate ? `${dueDate.getFullYear()}.${String(dueDate.getMonth() + 1).padStart(2, '0')}.${String(dueDate.getDate()).padStart(2, '0')}` : '-'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">결제 금액</p>
            <p className="mt-1 text-4xl font-black tracking-tight text-[#14295F]">₩{amount.toLocaleString()}</p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
            <div className="flex items-center gap-2 text-blue-700">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-[11px] font-black uppercase tracking-widest">안전 결제</span>
            </div>
            <p className="mt-1 text-xs font-bold text-blue-800/80">
              토스페이먼츠 결제창으로 이동해 카드 결제를 진행합니다.
            </p>
          </div>

          <Button
            type="button"
            disabled={!canRequestPayment || isRequesting}
            onClick={handlePayment}
            className="h-14 w-full rounded-2xl bg-[#14295F] font-black text-white"
          >
            {isRequesting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CreditCard className="mr-2 h-5 w-5" />}
            {!tossClientKey
              ? '결제 설정 확인 필요'
              : canRequestPayment
                ? '토스페이먼츠로 결제하기'
                : '결제 가능한 상태가 아닙니다'}
          </Button>

          <Button type="button" variant="ghost" className="h-11 w-full rounded-xl font-black" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            이전으로
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
