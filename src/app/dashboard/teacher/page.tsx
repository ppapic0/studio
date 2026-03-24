'use client';

import { Loader2 } from 'lucide-react';

import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard';
import { useAppContext } from '@/contexts/app-context';

const CLASSROOM_ROLES = new Set(['teacher', 'centerAdmin', 'owner']);

function hasClassroomAccess(role?: string, status?: string) {
  if (!role || !CLASSROOM_ROLES.has(role)) return false;
  return !status || status === 'active';
}

export default function TeacherHomePage() {
  const { activeMembership, memberships, membershipsLoading } = useAppContext();
  const fallbackMembership =
    (activeMembership && hasClassroomAccess(activeMembership.role, activeMembership.status) ? activeMembership : null) ||
    memberships.find((membership) => hasClassroomAccess(membership.role, membership.status)) ||
    null;

  if (membershipsLoading && !fallbackMembership) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm font-bold text-slate-600">실시간 교실 정보를 불러오는 중입니다.</p>
        </div>
      </div>
    );
  }

  if (!fallbackMembership) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="font-black text-muted-foreground opacity-20">실시간 교실에 접근할 수 있는 권한이 없습니다.</p>
      </div>
    );
  }

  return <TeacherDashboard isActive={true} />;
}
