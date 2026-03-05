
'use client';

import { useEffect, useState, use } from 'react';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Invoice } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, ShieldCheck, Sparkles, ArrowLeft, Lock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/contexts/app-context';

/**
 * [운영 가이드]
 * 1. 토스페이먼츠 개발자 센터(https://developers.tosspayments.com/) 로그인
 * 2. 내 상점 정보 -> API 키 확인
 * 3. 아래 clientKey를 발급받으신 '클라이언트 키'로 교체하세요.
 */
const TOSS_CLIENT_KEY = 'test_ck_AQ92ymxN34NDobpk74e0rajRKXvd'; // 현재는 테스트 키입니다.

export default function CheckoutPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = use(params);
  const firestore = useFirestore();
  const router = useRouter();
  const { activeMembership } = useAppContext();
  const [isLoading, setIsLoading] = useState(true);

  const invoiceRef = (firestore && activeMembership) 
    ? doc(firestore, 'centers', activeMembership.id, 'invoices', invoiceId) 
    : null;
  const { data: invoice, isLoading: invoiceLoading } = useDoc<Invoice>(invoiceRef as any);

  useEffect(() => {
    if (!invoiceLoading) {
      setIsLoading(false);
    }
  }, [invoiceLoading]);

  const handlePayment = async () => {
    if (!invoice || !activeMembership) return;

    try {
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const orderId = `track_${invoiceId}_${Math.random().toString(36).substring(2, 9)}`;
      
      await tossPayments.requestPayment('카드', {
        amount: invoice.finalPrice,
        orderId: orderId,
        orderName: `${invoice.studentName} 학생 수강료 (Analytical Track)`,
        customerName: invoice.studentName,
        successUrl: `${window.location.origin}/payment/success?invoiceId=${invoiceId}&centerId=${activeMembership.id}`,
        failUrl: `${window.location.origin}/payment/fail?invoiceId=${invoiceId}`,
      });
    } catch (error) {
      console.error('Payment request failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#fafafa]">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="font-black text-primary tracking-tighter uppercase opacity-40">Securing Payment Channel...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-[2.5rem] border-none shadow-2xl text-center p-10">
          <div className="bg-rose-50 p-4 rounded-2xl w-fit mx-auto mb-6">
            <Lock className="h-10 w-10 text-rose-500" />
          </div>
          <CardTitle className="text-2xl font-black tracking-tighter">유효하지 않은 요청</CardTitle>
          <CardDescription className="font-bold pt-2">만료된 결제 링크이거나 정보를 찾을 수 없습니다.</CardDescription>
          <Button onClick={() => router.back()} className="mt-8 w-full h-14 rounded-2xl font-black border-2">대시보드로 돌아가기</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ornaments */}
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      
      <header className="flex flex-col items-center text-center gap-2 mb-12 relative z-10">
        <div className="bg-primary p-5 rounded-[2.5rem] shadow-2xl shadow-primary/20 mb-4 animate-in zoom-in duration-700">
          <CreditCard className="h-12 w-12 text-white" />
        </div>
        <h1 className="text-5xl font-black tracking-tighter text-primary">안전 결제 시스템</h1>
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-[0.4em] opacity-40">Analytical Track Secure Checkout</p>
      </header>

      <Card className="w-full max-w-xl rounded-[4rem] border-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] bg-white overflow-hidden ring-1 ring-black/5 animate-in slide-in-from-bottom-8 duration-700">
        <CardHeader className="bg-muted/5 border-b p-12">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="text-3xl font-black tracking-tighter">결제 정보 확인</CardTitle>
              <CardDescription className="font-bold text-base opacity-60">학생의 정보를 확인하고 결제를 진행하세요.</CardDescription>
            </div>
            <Badge className="bg-emerald-500 text-white border-none font-black text-[10px] px-3 py-1">SECURE</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-12 space-y-10">
          <div className="space-y-8">
            <div className="flex justify-between items-end border-b-4 border-dashed pb-8 border-muted">
              <div className="grid gap-1">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Payment Item</span>
                <h3 className="text-2xl font-black text-primary flex items-center gap-2">
                  {invoice.studentName} <span className="text-sm opacity-40">학생 수강료</span>
                </h3>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Grand Total</span>
                <p className="text-5xl font-black text-blue-600 tracking-tighter drop-shadow-sm">₩{invoice.finalPrice.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-4 p-5 rounded-3xl bg-[#fafafa] border-2 border-transparent hover:border-primary/5 transition-all group">
                <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center shadow-md border border-black/5 group-hover:scale-110 transition-transform"><Sparkles className="h-6 w-6 text-amber-500" /></div>
                <div className="grid leading-tight">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Service</span>
                  <span className="text-sm font-black text-primary">Analytical Track</span>
                </div>
              </div>
              <div className="flex items-center gap-4 p-5 rounded-3xl bg-blue-50/50 border-2 border-blue-100 shadow-sm group">
                <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center shadow-md border border-blue-200 group-hover:scale-110 transition-transform"><ShieldCheck className="h-6 w-6 text-blue-600" /></div>
                <div className="grid leading-tight">
                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Security</span>
                  <span className="text-sm font-black text-blue-900">금융 보안 적용됨</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Button 
              onClick={handlePayment}
              className="w-full h-24 rounded-[2rem] font-black text-2xl bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-4 group"
            >
              <CreditCard className="h-8 w-8 group-hover:rotate-12 transition-transform" /> 지금 결제하기
            </Button>
            <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
              <Lock className="h-3 w-3" /> Encrypted Transaction Processing
            </div>
          </div>

          <div className="p-6 rounded-[2rem] bg-muted/20 border-2 border-dashed flex items-start gap-4">
            <CheckCircle2 className="h-5 w-5 text-primary opacity-40 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-muted-foreground leading-relaxed">
              결제 완료 후 인보이스 상태가 자동으로 '납부 완료'로 변경되며, <br/>
              센터 관리 시스템에 실시간 매출로 집계됩니다.
            </p>
          </div>
        </CardContent>
      </Card>

      <footer className="mt-12 opacity-30 flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()} className="font-black text-xs gap-2 hover:bg-white/50 rounded-xl px-6 h-12 transition-all"><ArrowLeft className="h-4 w-4" /> 취소하고 대시보드로 돌아가기</Button>
      </footer>
    </div>
  );
}
