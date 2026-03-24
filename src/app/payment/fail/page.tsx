
'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, Loader2, RefreshCw, XCircle, ShieldAlert } from 'lucide-react';

function FailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const errorCode = searchParams.get('code');
  const errorMessage = searchParams.get('message');
  const invoiceId = searchParams.get('invoiceId');
  const centerId = searchParams.get('centerId');

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div className="absolute top-1/4 left-1/4 -rotate-12"><XCircle className="h-32 w-32 text-rose-500" /></div>
        <div className="absolute bottom-1/4 right-1/4 rotate-12"><ShieldAlert className="h-48 w-48 text-rose-500" /></div>
      </div>

      <Card className="w-full max-w-lg rounded-[4rem] border-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] bg-white overflow-hidden ring-1 ring-black/5 animate-in slide-in-from-bottom-8 duration-700">
        <CardHeader className="bg-rose-500 p-16 text-white text-center relative">
          <div className="relative z-10 flex flex-col items-center gap-6">
            <div className="bg-white/20 p-6 rounded-full shadow-inner backdrop-blur-md border border-white/30">
              <AlertCircle className="h-16 w-16 text-white" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-5xl font-black tracking-tighter">결제 실패</CardTitle>
              <CardDescription className="text-white/80 font-bold text-lg">요청하신 결제가 정상적으로 완료되지 않았습니다.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-16 space-y-10">
          <div className="p-8 rounded-[2rem] bg-rose-50 border-2 border-rose-100 space-y-3">
            <div className="flex items-center gap-2 text-rose-600">
              <ShieldAlert className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Error Details</span>
            </div>
            <div className="grid gap-1">
              <p className="text-lg font-black text-rose-900 tracking-tight">{errorMessage || "사용자에 의해 결제가 취소되었습니다."}</p>
              <p className="text-xs font-bold text-rose-400">Error Code: {errorCode || "PAYMENT_CANCELLED"}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Button 
              onClick={() => invoiceId ? router.push(`/payment/checkout/${invoiceId}${centerId ? `?centerId=${centerId}` : ''}`) : router.push('/')}
              className="w-full h-20 rounded-[2.5rem] font-black text-xl bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/20 gap-3 active:scale-95 transition-all"
            >
              <RefreshCw className="h-6 w-6" /> 다시 시도하기
            </Button>
            <Button 
              variant="outline"
              onClick={() => router.push('/')}
              className="w-full h-16 rounded-2xl font-black text-lg border-2 hover:bg-muted/10 gap-2 transition-all active:scale-95"
            >
              <ArrowLeft className="h-5 w-5 opacity-40" /> 메인으로 돌아가기
            </Button>
          </div>
          
          <p className="text-center text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.3em]">Analytical Track Support</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function FailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
      </div>
    }>
      <FailContent />
    </Suspense>
  );
}
