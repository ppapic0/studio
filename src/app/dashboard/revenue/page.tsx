'use client';

import { RevenueAnalysis } from '@/components/dashboard/revenue-analysis';
import { useAppContext } from '@/contexts/app-context';
import { redirect } from 'next/navigation';
import { Loader2, Compass } from 'lucide-react';

export default function RevenuePage() {
  const { activeMembership, membershipsLoading } = useAppContext();

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
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-headline font-bold tracking-tight">
          수익 및 운영 분석
        </h1>
        <p className="text-muted-foreground">센터의 비즈니스 성과와 학생 등록 추이를 모니터링합니다.</p>
      </div>
      <div className="mt-6">
        <RevenueAnalysis />
      </div>
    </div>
  );
}
