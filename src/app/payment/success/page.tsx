
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { completePayment } from '@/lib/finance-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, PartyPopper, ArrowRight, Sparkles, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const invoiceId = searchParams.get('invoiceId');
    const centerId = searchParams.get('centerId');
    const paymentKey = searchParams.get('paymentKey'); // 토스 결제 키
    const amount = searchParams.get('amount'); // 실제 결제 금액

    if (!invoiceId || !centerId || !firestore) return;

    const finalize = async () => {
      try {
        /**
         * [운영 가이드]
         * 실제 운영 환경에서는 여기서 서버(Next.js API Route)를 통해 토스페이먼츠 '승인 API'를 호출해야 합니다.
         * POST https://api.tosspayments.com/v1/payments/confirm
         * Authorization: Basic {SecretKey + ":"} (Base64 encoded)
         */
        
        // 프로토타입: 승인 API 호출이 성공했다고 가정하고 DB 상태를 업데이트합니다.
        await completePayment(firestore, centerId, invoiceId, 'card');
        
        setIsProcessing(false);
        toast({ title: "결제 완료 ✨", description: "수강료 납부가 성공적으로 처리되었습니다." });
      } catch (e: any) {
        console.error(e);
        setError(e.message || "결제 처리 중 오류가 발생했습니다.");
        setIsProcessing(false);
      }
    };

    finalize();
  }, [searchParams, firestore, toast]);

  if (isProcessing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[#fafafa]">
        <div className="relative">
          <Loader2 className="h-16 w-16 animate-spin text-primary opacity-20" />
          <Building2 className="h-8 w-8 text-primary absolute inset-0 m-auto animate-pulse" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-xl font-black text-primary tracking-tighter">결제 승인을 요청하고 있습니다</p>
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest opacity-40 italic">Verifying Transaction...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-[3rem] border-none shadow-2xl p-12 text-center bg-white overflow-hidden">
          <div className="bg-rose-50 p-5 rounded-3xl w-fit mx-auto mb-8 shadow-inner">
            <CheckCircle2 className="h-12 w-12 text-rose-500 rotate-180" />
          </div>
          <CardTitle className="text-rose-600 text-3xl font-black tracking-tighter">결제 처리 오류</CardTitle>
          <CardDescription className="font-bold pt-4 text-base leading-relaxed text-muted-foreground/80">{error}</CardDescription>
          <Button onClick={() => router.push('/dashboard/revenue')} className="mt-10 w-full h-16 rounded-2xl font-black text-lg shadow-xl shadow-rose-100 transition-all active:scale-95">수납 관리로 돌아가기</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 animate-bounce delay-75"><PartyPopper className="h-12 w-12 text-primary opacity-20" /></div>
        <div className="absolute top-1/3 right-1/4 animate-bounce delay-300"><PartyPopper className="h-16 w-16 text-accent opacity-20" /></div>
        <div className="absolute bottom-1/4 left-1/2 animate-bounce delay-500"><PartyPopper className="h-10 w-10 text-blue-500 opacity-20" /></div>
      </div>

      <Card className="w-full max-w-lg rounded-[4.5rem] border-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] bg-white overflow-hidden ring-1 ring-black/5 animate-in zoom-in-95 duration-700">
        <CardHeader className="bg-emerald-500 p-16 text-white text-center relative overflow-hidden">
          <Sparkles className="absolute -bottom-10 -right-10 h-64 w-64 opacity-20 rotate-12" />
          <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="bg-white/20 p-6 rounded-full shadow-inner backdrop-blur-md border border-white/30">
              <CheckCircle2 className="h-16 w-16 text-white" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-5xl font-black tracking-tighter">납부 완료!</CardTitle>
              <CardDescription className="text-white/80 font-bold text-lg">성공적으로 수강료가 납부되었습니다.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-16 space-y-10 text-center">
          <div className="space-y-4">
            <p className="text-base font-bold text-muted-foreground leading-relaxed">
              정상적으로 입금이 확인되었으며, <br/>
              인보이스 상태가 즉시 업데이트되었습니다.<br/>
              이제 센터 대시보드에서 실시간 분석을 확인하실 수 있습니다.
            </p>
          </div>

          <Button 
            onClick={() => router.push('/dashboard/revenue')}
            className="w-full h-20 rounded-[2rem] font-black text-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-2xl shadow-emerald-200 gap-3 active:scale-95 transition-all"
          >
            수납 관리로 돌아가기 <ArrowRight className="h-6 w-6" />
          </Button>
          
          <p className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">Analytical Track Business Center</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
        <p className="font-black text-primary/40 uppercase tracking-widest">Loading...</p>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
