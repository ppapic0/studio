
'use client';

import { useEffect, useState, use } from 'react';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Invoice } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, ShieldCheck, Sparkles, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const clientKey = 'test_ck_D5ya AdvZdA1qWDQ9YvD83V5E0RY'; // 토스페이먼츠 테스트 클라이언트 키

export default function CheckoutPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = use(params);
  const firestore = useFirestore();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [centerId, setCenterId] = useState<string | null>(null);

  // 현재 사용자 세션에서 centerId 가져오기 (가정: URL 쿼리나 전역 상태)
  // 여기서는 로직 단순화를 위해 인보이스 문서를 먼저 찾습니다.
  // 실제 서비스에서는 인보이스 ID가 유추 불가능한 고유값이어야 합니다.

  // 주의: 현재 구조에서 centerId를 알아야 인보이스 조회가 가능하므로, 
  // 실제 운영 환경에서는 인보이스 컬렉션 그룹 쿼리나 별도의 고유 결제 페이지가 필요합니다.
  // 프로토타입에서는 activeMembership 정보를 활용합니다.
  const { activeMembership } = (require('@/contexts/app-context')).useAppContext();

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
    if (!invoice) return;

    try {
      const tossPayments = await loadTossPayments(clientKey);
      
      const orderId = `order_${invoiceId}_${Date.now()}`;
      
      await tossPayments.requestPayment('카드', {
        amount: invoice.finalPrice,
        orderId: orderId,
        orderName: `${invoice.studentName} 학생 수강료`,
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
        <Card className="max-w-md w-full rounded-[2rem] border-none shadow-2xl text-center p-8">
          <CardTitle className="text-2xl font-black">요청을 찾을 수 없습니다</CardTitle>
          <CardDescription className="font-bold pt-2">유효하지 않거나 만료된 결제 요청입니다.</CardDescription>
          <Button onClick={() => router.back()} className="mt-6 w-full rounded-xl font-black">뒤로 가기</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      
      <header className="flex flex-col items-center text-center gap-2 mb-12 relative z-10">
        <div className="bg-primary/10 p-5 rounded-[2.5rem] shadow-inner mb-4">
          <CreditCard className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-4xl font-black tracking-tighter text-primary">안전 결제 시스템</h1>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.4em] opacity-40">Analytical Track Secure Checkout</p>
      </header>

      <Card className="w-full max-w-lg rounded-[3rem] border-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] bg-white overflow-hidden ring-1 ring-black/5 animate-in slide-in-from-bottom-8 duration-700">
        <CardHeader className="bg-muted/5 border-b p-10">
          <CardTitle className="text-2xl font-black tracking-tighter">결제 상세 정보</CardTitle>
          <CardDescription className="font-bold pt-1">수강생의 정보를 확인하고 결제를 진행해 주세요.</CardDescription>
        </CardHeader>
        <CardContent className="p-10 space-y-8">
          <div className="space-y-6">
            <div className="flex justify-between items-end border-b-2 border-dashed pb-6">
              <div className="grid gap-1">
                <span className="text-[10px] font-black text-muted-foreground uppercase">결제 항목</span>
                <h3 className="text-xl font-black text-primary">{invoice.studentName} 학생 수강료</h3>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-muted-foreground uppercase">결제 금액</span>
                <p className="text-3xl font-black text-blue-600 tracking-tighter">₩{invoice.finalPrice.toLocaleString()}</p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#fafafa] border shadow-sm">
                <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-black/5"><Sparkles className="h-5 w-5 text-amber-500" /></div>
                <div className="grid leading-tight">
                  <span className="text-[10px] font-black text-muted-foreground uppercase">Service Range</span>
                  <span className="text-sm font-black">Analytical Track 28일 이용권</span>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-100 shadow-sm">
                <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-blue-200"><ShieldCheck className="h-5 w-5 text-blue-600" /></div>
                <div className="grid leading-tight">
                  <span className="text-[10px] font-black text-blue-600 uppercase">Secure Payment</span>
                  <span className="text-sm font-black text-blue-900">암호화된 보안 결제가 적용됩니다.</span>
                </div>
              </div>
            </div>
          </div>

          <Button 
            onClick={handlePayment}
            className="w-full h-20 rounded-2xl font-black text-xl bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            <CreditCard className="h-6 w-6" /> 지금 결제하기
          </Button>

          <p className="text-center text-[10px] font-bold text-muted-foreground/40 leading-relaxed uppercase tracking-widest">
            By clicking "Pay Now", you agree to our terms of service <br/> and refund policy.
          </p>
        </CardContent>
      </Card>

      <footer className="mt-12 opacity-30 flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()} className="font-black text-xs gap-2"><ArrowLeft className="h-4 w-4" /> 취소하고 돌아가기</Button>
      </footer>
    </div>
  );
}
