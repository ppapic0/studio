import { AccessTestPanel } from "@/components/dev/access-test-panel";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function AppPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-10 flex h-[57px] items-center gap-1 border-b bg-background px-4 justify-between">
        <h1 className="text-xl font-semibold">보안 규칙 테스트 패널</h1>
         <Button asChild variant="outline">
          <Link href="/connection-test">연결 테스트 페이지로 이동</Link>
        </Button>
      </header>
      <main className="flex-1 p-4">
        <p className="mb-4 text-muted-foreground">
          이 패널은 특정 역할로 센터에 가입한 후 Firestore 보안 규칙을 테스트하기 위한 것입니다. 먼저{' '}
          <Link href="/connection-test" className="underline">연결 테스트 페이지</Link>
          에서 센터에 가입하세요.
        </p>
        <AccessTestPanel />
      </main>
    </div>
  );
}
