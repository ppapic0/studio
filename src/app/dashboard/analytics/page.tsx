import { AdminDashboard } from '@/components/dashboard/admin-dashboard';

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-headline font-bold tracking-tight">
        Center KPI Dashboard
      </h1>
      <p className="text-muted-foreground">A high-level overview of your center's performance.</p>
       <div className="mt-4 flex flex-col gap-4">
        <AdminDashboard />
      </div>
    </div>
  );
}
