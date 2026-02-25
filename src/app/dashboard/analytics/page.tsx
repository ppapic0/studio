import { AdminDashboard } from '@/components/dashboard/admin-dashboard';

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-headline font-bold tracking-tight">
        센터 KPI 대시보드
      </h1>
      <p className="text-muted-foreground">센터 성과에 대한 개요입니다.</p>
       <div className="mt-4 flex flex-col gap-4">
        <AdminDashboard />
      </div>
    </div>
  );
}
