
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { completePayment } from '@/lib/finance-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, PartyPopper, ArrowRight } from 'lucide-react';
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
    const paymentKey = searchParams.get('paymentKey');
    const amount = searchParams.get('amount');

    if (!invoiceId || !centerId || !firestore) return;

    const finalize = async () => {
      try {
        // 실제 운영 환경에서는 여기서 서버 사이드(API) 결제 승인(Confirm) 요청을 보내야 함
        // 프로토타입에서는 프론트엔드 완료 로직 호출
        await completePayment(firestore, centerId, invoiceId, 'card');
        setIsProcessing(false);
        toast({ title: "결제 승인 완료", description: "수강료 납부가 성공적으로 처리되었습니다." });
      } catch (e: any) {
        console.error(e);
        setError(e.message || "결제 처리 중 오류가 발생했습니다.");
        setIsProcessing(false);
      }
    };

    finalize();
  }, [searchParams, firestore]);

  if (isProcessing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
        <p className="font-black text-primary tracking-tighter uppercase">Verifying Payment Transaction...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-[2.5rem] border-none shadow-2xl p-10 text-center">
          <CardTitle className="text-rose-600 text-2xl font-black">결제 처리 오류</CardTitle>
          <CardDescription className="font-bold pt-4">{error}</CardDescription>
          <Button onClick={() => router.push('/dashboard/revenue')} className="mt-8 w-full rounded-xl font-black h-12">관리 대시보드로 돌아가기</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 animate-bounce delay-75"><PartyPopper className="h-8 w-8 text-primary opacity-20" /></div>
        <div className="absolute top-1/3 right-1/4 animate-bounce delay-300"><PartyPopper className="h-10 w-10 text-accent opacity-20" /></div>
        <div className="absolute bottom-1/4 left-1/2 animate-bounce delay-500"><PartyPopper className="h-6 w-6 text-blue-500 opacity-20" /></div>
      </div>

      <Card className="w-full max-w-lg rounded-[4rem] border-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] bg-white overflow-hidden ring-1 ring-black/5 animate-in zoom-in-95 duration-700">
        <CardHeader className="bg-emerald-500 p-12 text-white text-center relative overflow-hidden">
          <CheckCircle2 className="absolute -bottom-4 -right-4 h-32 w-32 opacity-20 rotate-12" />
          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="bg-white/20 p-4 rounded-full shadow-inner">
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-4xl font-black tracking-tighter">결제 완료!</CardTitle>
              <CardDescription className="text-white/80 font-bold text-base">성공적으로 수납 처리가 완료되었습니다.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-12 space-y-8 text-center">
          <div className="space-y-2">
            <p className="text-sm font-bold text-muted-foreground leading-relaxed">
              입금 확인 및 인보이스 상태 업데이트가 완료되었습니다.<br/>
              이제 비즈니스 분석 대시보드에서 실시간 수익을 확인하실 수 있습니다.
            </p>
          </div>

          <Button 
            onClick={() => router.push('/dashboard/revenue')}
            className="w-full h-16 rounded-2xl font-black text-lg bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-200 gap-2 active:scale-95 transition-all"
          >
            수납 관리로 돌아가기 <ArrowRight className="h-5 w-5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
