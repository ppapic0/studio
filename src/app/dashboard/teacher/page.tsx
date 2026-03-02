
'use client';

import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard';
import { useAppContext } from '@/contexts/app-context';

export default function TeacherHomePage() {
  const { activeMembership } = useAppContext();
  const isAuthorized = activeMembership?.role === 'teacher' || activeMembership?.role === 'centerAdmin';

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="font-black text-muted-foreground opacity-20">권한이 없습니다.</p>
      </div>
    );
  }

  return <TeacherDashboard isActive={true} />;
}
