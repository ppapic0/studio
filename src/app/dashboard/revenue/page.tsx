
'use client';

import { RevenueAnalysis } from '@/components/dashboard/revenue-analysis';
import { useAppContext } from '@/contexts/app-context';
import { redirect } from 'next/navigation';
import { Loader2, Compass, DollarSign, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function RevenuePage() {
  const { activeMembership, membershipsLoading, viewMode } = useAppContext();
  const isMobile = viewMode === 'mobile';

  // 멤버십 정보 로딩 중 처리
  if (membershipsLoading) {
    return (
      <div className="flex flex-col h-[70vh] w-full items-center justify-center gap-6">
        <div className="relative">
          <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
          <Compass className="h-12 w-12 text-primary absolute inset-0 animate-pulse" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-xl font-black text-primary tracking-tighter">운영 데이터를 불러오고 있습니다</p>
          <p className="text-sm font-bold text-muted-foreground italic">잠시만 기다려주세요...</p>
        </div>
      </div>
    );
  }

  // 관리자 권한 체크
  if (activeMembership && activeMembership.role !== 'centerAdmin') {
    redirect('/dashboard');
  }

  if (!activeMembership) {
    redirect('/dashboard');
  }

  return (
    <div className={cn("flex flex-col gap-8 w-full max-w-[1400px] mx-auto", isMobile ? "px-1" : "px-4 py-6")}>
      <header className={cn("flex justify-between items-end", isMobile ? "px-2" : "")}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary/60">
            <DollarSign className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Business Intelligence</span>
          </div>
          <h1 className={cn("font-black tracking-tighter text-primary leading-none", isMobile ? "text-3xl" : "text-5xl")}>
            수익 및 비즈니스 분석
          </h1>
          <p className="text-sm font-bold text-muted-foreground/70 mt-2">센터의 실시간 재무 지표와 학생 생애 가치를 추적합니다.</p>
        </div>
        {!isMobile && (
          <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Live Forecast Active</span>
          </div>
        )}
      </header>

      <div className="mt-4">
        <RevenueAnalysis />
      </div>
    </div>
  );
}
