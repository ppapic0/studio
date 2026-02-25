import { AccessTestPanel } from "@/components/dev/access-test-panel";

export default function AppPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-10 flex h-[57px] items-center gap-1 border-b bg-background px-4">
        <h1 className="text-xl font-semibold">보안 규칙 테스트 패널</h1>
      </header>
      <main className="flex-1 p-4">
        <AccessTestPanel />
      </main>
    </div>
  );
}
