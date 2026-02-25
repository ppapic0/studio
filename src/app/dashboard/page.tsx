'use client';

import { StudentDashboard } from '@/components/dashboard/student-dashboard';
import { ParentDashboard } from '@/components/dashboard/parent-dashboard';
import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useUser();
  const { activeMembership, membershipsLoading } = useAppContext();
  
  const userRole = activeMembership?.role;

  const renderContent = () => {
    if (membershipsLoading) {
      return (
        <div className="flex h-64 w-full items-center justify-center rounded-lg border">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (!activeMembership) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>센터에 오신 것을 환영합니다!</CardTitle>
            <CardDescription>학습을 시작하려면 먼저 센터에 가입해야 합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className='text-muted-foreground mb-4'>
                아직 센터의 멤버가 아닙니다. 센터 관리자에게 받은 초대 코드가 필요합니다.
            </p>
            <Button asChild>
              <Link href="/signup">초대 코드로 가입하기</Link>
            </Button>
          </CardContent>
        </Card>
      );
    }
    
    return (
      <>
        <StudentDashboard isActive={userRole === 'student'} />
        <ParentDashboard isActive={userRole === 'parent'} />
        <TeacherDashboard isActive={userRole === 'teacher'} />
        <AdminDashboard isActive={userRole === 'centerAdmin'} />
      </>
    )
  }

  return (
    <>
      <h1 className="text-3xl font-headline font-bold tracking-tight">
        {user ? `${user.displayName}님, 다시 오신 것을 환영합니다!` : '대시보드 로딩 중...'}
      </h1>
      <p className="text-muted-foreground">오늘의 맞춤 개요입니다.</p>
      <div className="mt-4 flex flex-col gap-4">
        {renderContent()}
      </div>
    </>
  );
}
