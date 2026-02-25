import { AccessTestPanel } from "@/components/dev/access-test-panel";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { redirect } from 'next/navigation';

export default function AppPage() {
    // This page is now a wrapper. AuthGuard will redirect to either
    // /dashboard or /connection-test. If somehow a user with a membership
    // lands here, we redirect them to the dashboard.
    // This could happen if they manually navigate to /app.
    redirect('/dashboard');

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-10 flex h-[57px] items-center gap-1 border-b bg-background px-4 justify-between">
        <h1 className="text-xl font-semibold">리디렉션 중...</h1>
      </header>
      <main className="flex-1 p-4">
        <p className="mb-4 text-muted-foreground">
          잠시만 기다려주세요...
        </p>
      </main>
    </div>
  );
}
