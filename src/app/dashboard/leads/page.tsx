'use client';

import { Loader2, Megaphone } from 'lucide-react';

import { MarketingConsultingCRM } from '@/components/dashboard/marketing-consulting-crm';
import { WebsiteEntryAnalytics } from '@/components/dashboard/website-entry-analytics';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/contexts/app-context';

export default function LeadsPage() {
  const { activeMembership, membershipsLoading, viewMode } = useAppContext();
  const isMobile = viewMode === 'mobile';

  if (membershipsLoading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const role = activeMembership?.role;
  const canAccess = role === 'teacher' || role === 'centerAdmin' || role === 'owner';
  const isTeacher = role === 'teacher';

  if (!activeMembership || !canAccess) {
    return (
      <div className="rounded-2xl border border-dashed bg-white p-8 text-center shadow-sm">
        <p className="text-base font-black text-slate-700">이 메뉴는 선생님과 관리자만 사용할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-16">
      <div className="flex flex-wrap items-center gap-3 px-1">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-lg">
          <Megaphone className="h-5 w-5" />
        </div>
        <div className="grid gap-0.5">
          <h1 className="text-2xl font-black tracking-tight text-primary">홍보/상담 리드 DB</h1>
          <p className="text-xs font-semibold text-muted-foreground">
            {isTeacher
              ? '선생님 계정은 리드와 웹 상담 데이터를 조회하고, 상담 리드·입학 대기 이동만 처리할 수 있습니다.'
              : '상담 입력 리드와 웹사이트 상담·입구 클릭 데이터를 한 화면에서 보고, 상태 관리와 다운로드까지 처리합니다.'}
          </p>
        </div>
        <Badge className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-600">
          {isTeacher ? '선생님 조회·이동 전용' : '교사/관리자 공용'}
        </Badge>
      </div>

      <WebsiteEntryAnalytics centerId={activeMembership.id} />
      <MarketingConsultingCRM centerId={activeMembership.id} isMobile={isMobile} />
    </div>
  );
}
