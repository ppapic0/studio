'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { CheckCircle2, Loader2, PartyPopper } from 'lucide-react';

import { useAppContext } from '@/contexts/app-context';
import { useFunctions } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

type ConfirmInvoicePaymentResult = {
  ok: boolean;
  centerId: string;
  invoiceId: string;
  status: string;
  amount: number;
  alreadyProcessed?: boolean;
};

function resolveNextHref(role: string | undefined): string {
  if (role === 'parent') return '/dashboard?parentTab=billing';
  if (role === 'centerAdmin' || role === 'owner' || role === 'teacher') return '/dashboard/revenue';
  return '/dashboard';
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const functions = useFunctions();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processedAmount, setProcessedAmount] = useState<number>(0);
  const [alreadyProcessed, setAlreadyProcessed] = useState(false);

  const nextHref = useMemo(() => resolveNextHref(activeMembership?.role), [activeMembership?.role]);

  useEffect(() => {
    const invoiceId = (searchParams.get('invoiceId') || '').trim();
    const centerIdFromQuery = (searchParams.get('centerId') || '').trim();
    const centerId = centerIdFromQuery || activeMembership?.id || '';
    const paymentKey = (searchParams.get('paymentKey') || '').trim();
    const orderId = (searchParams.get('orderId') || '').trim();
    const amountRaw = Number(searchParams.get('amount'));
    const amount = Number.isFinite(amountRaw) ? amountRaw : null;

    if (!invoiceId || !centerId || !functions) {
      setErrorMessage('결제 확인 파라미터가 누락되었습니다. 다시 시도해 주세요.');
      setIsProcessing(false);
      return;
    }

    const confirm = async () => {
      try {
        const confirmFn = httpsCallable<
          { centerId: string; invoiceId: string; paymentMethod: 'card'; paymentKey?: string; orderId?: string; amount?: number },
          ConfirmInvoicePaymentResult
        >(functions, 'confirmInvoicePayment');

        const result = await confirmFn({
          centerId,
          invoiceId,
          paymentMethod: 'card',
          paymentKey: paymentKey || undefined,
          orderId: orderId || undefined,
          amount: amount === null ? undefined : amount,
        });

        const payload = result.data;
        setProcessedAmount(Number(payload?.amount) || 0);
        setAlreadyProcessed(!!payload?.alreadyProcessed);
        setIsProcessing(false);

        toast({
          title: payload?.alreadyProcessed ? '이미 처리된 결제입니다.' : '결제가 완료되었습니다.',
          description: '감사합니다! 최선을 다해 관리하겠습니다!',
        });
      } catch (error: any) {
        const fallback = '결제 후 처리 중 오류가 발생했습니다. 잠시 후 다시 확인해 주세요.';
        const detail =
          typeof error?.details === 'string'
            ? error.details
            : typeof error?.details?.userMessage === 'string'
              ? error.details.userMessage
              : typeof error?.message === 'string'
                ? error.message.replace(/^FirebaseError:\s*/i, '').trim()
                : fallback;

        setErrorMessage(detail || fallback);
        setIsProcessing(false);
      }
    };

    void confirm();
  }, [searchParams, functions, activeMembership?.id, toast]);

  if (isProcessing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#fafafa] p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary/40" />
        <p className="text-center text-sm font-black tracking-wide text-primary/70">
          결제 승인 내용을 확인하고 있습니다.
        </p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa] p-4">
        <Card className="w-full max-w-md rounded-[2.25rem] border-none bg-white p-2 shadow-2xl">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-2xl font-black tracking-tight text-rose-600">결제 반영 실패</CardTitle>
            <CardDescription className="font-bold text-slate-500">{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Button className="h-12 w-full rounded-xl font-black" onClick={() => router.push(nextHref)}>
              대시보드로 이동
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fafafa] p-4">
      <PartyPopper className="pointer-events-none absolute left-10 top-14 h-10 w-10 text-primary/20" />
      <PartyPopper className="pointer-events-none absolute right-12 top-20 h-12 w-12 text-orange-400/30" />
      <Card className="w-full max-w-lg overflow-hidden rounded-[2.75rem] border-none bg-white shadow-[0_40px_90px_-30px_rgba(17,24,39,0.35)]">
        <CardHeader className="bg-emerald-500 px-8 py-10 text-white">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 rounded-full bg-white/20 p-4">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <CardTitle className="text-4xl font-black tracking-tight">수납 완료</CardTitle>
            <CardDescription className="mt-1 text-white/85">
              감사합니다! 최선을 다해 관리하겠습니다!
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 px-8 py-8">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-center">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">처리 금액</p>
            <p className="mt-1 text-3xl font-black tracking-tight text-[#14295F]">
              ₩{Math.max(0, Math.round(processedAmount)).toLocaleString()}
            </p>
            {alreadyProcessed && (
              <p className="mt-1 text-[11px] font-bold text-slate-500">이미 처리된 결제건으로 확인되었습니다.</p>
            )}
          </div>
          <Button className="h-14 w-full rounded-2xl bg-[#14295F] font-black text-white" onClick={() => router.push(nextHref)}>
            대시보드로 돌아가기
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#fafafa] p-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
