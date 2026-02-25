'use client';

import { StudentDashboard } from '@/components/dashboard/student-dashboard';
import { ParentDashboard } from '@/components/dashboard/parent-dashboard';
import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useUser();
  const { activeMembership } = useAppContext();
  
  const userRole = activeMembership?.role;

  return (
    <>
      <h1 className="text-3xl font-headline font-bold tracking-tight">
        {user ? `${user.displayName}님, 다시 오신 것을 환영합니다!` : '대시보드 로딩 중...'}
      </h1>
      <p className="text-muted-foreground">오늘의 맞춤 개요입니다.</p>
      <div className="mt-4 flex flex-col gap-4">
        {!userRole && (
            <div className="flex h-64 w-full items-center justify-center rounded-lg border">
            <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )}
        <StudentDashboard isActive={userRole === 'student'} />
        <ParentDashboard isActive={userRole === 'parent'} />
        <TeacherDashboard isActive={userRole === 'teacher'} />
        <AdminDashboard isActive={userRole === 'centerAdmin'} />
      </div>
    </>
  );
}
