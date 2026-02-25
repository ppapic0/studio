'use client';

import { StudentDashboard } from '@/components/dashboard/student-dashboard';
import { ParentDashboard } from '@/components/dashboard/parent-dashboard';
import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { Loader2 } from 'lucide-react';

function renderDashboard(role?: 'student' | 'teacher' | 'parent' | 'centerAdmin') {
  switch (role) {
    case 'student':
      return <StudentDashboard />;
    case 'parent':
      return <ParentDashboard />;
    case 'teacher':
      return <TeacherDashboard />;
    case 'centerAdmin':
      return <AdminDashboard />;
    default:
      // 역할이 아직 정해지지 않았을 때 로더를 보여줍니다.
      return (
        <div className="flex h-64 w-full items-center justify-center rounded-lg border">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
  }
}

export default function DashboardPage() {
  const { user } = useUser();
  const { activeMembership } = useAppContext();
  
  // AuthGuard가 주 로딩을 처리하지만, 역할이 확정될 때까지의
  // 순간적인 로딩 상태를 대비합니다.
  const userRole = activeMembership?.role;

  return (
    <>
      <h1 className="text-3xl font-headline font-bold tracking-tight">
        {user ? `${user.displayName}님, 다시 오신 것을 환영합니다!` : '대시보드 로딩 중...'}
      </h1>
      <p className="text-muted-foreground">오늘의 맞춤 개요입니다.</p>
      <div className="mt-4 flex flex-col gap-4">
        {renderDashboard(userRole)}
      </div>
    </>
  );
}
