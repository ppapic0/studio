'use client';

import { StudentDashboard } from '@/components/dashboard/student-dashboard';
import { ParentDashboard } from '@/components/dashboard/parent-dashboard';
import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { Loader2 } from 'lucide-react';

function renderDashboard(role: string) {
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
      return <StudentDashboard />;
  }
}

export default function DashboardPage() {
  const { user } = useUser();
  const { activeMembership } = useAppContext();

  if (!user || !activeMembership) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const userRole = activeMembership.role;

  return (
    <>
      <h1 className="text-3xl font-headline font-bold tracking-tight">
        {user.displayName}님, 다시 오신 것을 환영합니다!
      </h1>
      <p className="text-muted-foreground">오늘의 맞춤 개요입니다.</p>
      <div className="mt-4 flex flex-col gap-4">
        {renderDashboard(userRole)}
      </div>
    </>
  );
}
