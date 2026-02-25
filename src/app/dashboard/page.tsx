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
        Welcome back, {mockUser.name}!
      </h1>
      <p className="text-muted-foreground">Here&apos;s your personalized overview for today.</p>
      <div className="mt-4 flex flex-col gap-4">
        {renderDashboard(userRole)}
      </div>
    </>
  );
}
