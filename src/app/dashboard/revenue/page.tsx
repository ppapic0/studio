'use client';

import { RevenueAnalysis } from '@/components/dashboard/revenue-analysis';
import { useAppContext } from '@/contexts/app-context';
import { redirect } from 'next/navigation';

export default function RevenuePage() {
  const { activeMembership } = useAppContext();

  // 관리자 권한 체크
  if (activeMembership && activeMembership.role !== 'centerAdmin') {
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
