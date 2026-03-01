'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function KioskRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // 키오스크 전용 단독 모드 페이지로 리다이렉트합니다.
    router.replace('/kiosk');
  }, [router]);

  return (
    <div className="flex flex-col h-[70vh] w-full items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      <p className="font-black text-primary tracking-tighter">키오스크 전용 모드로 전환 중...</p>
    </div>
  );
}
