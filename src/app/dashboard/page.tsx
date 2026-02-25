import { StudentDashboard } from '@/components/dashboard/student-dashboard';
import { ParentDashboard } from '@/components/dashboard/parent-dashboard';
import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { mockUser } from '@/lib/data';

function renderDashboard(role: string) {
  switch (role) {
    case 'student':
      return <StudentDashboard />;
    case 'parent':
      return <ParentDashboard />;
    case 'teacher':
      return <TeacherDashboard />;
    case 'admin':
      return <AdminDashboard />;
    default:
      return <StudentDashboard />;
  }
}

export default function DashboardPage() {
  // In a real app, you'd get the user from a session or context
  const userRole = mockUser.role;

  return (
    <>
      <h1 className="text-3xl font-headline font-bold tracking-tight">
        {mockUser.name}님, 다시 오신 것을 환영합니다!
      </h1>
      <p className="text-muted-foreground">오늘의 맞춤 개요입니다.</p>
      <div className="mt-4 flex flex-col gap-4">
        {renderDashboard(userRole)}
      </div>
    </>
  );
}
