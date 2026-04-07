'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { seedInitialData } from '@/lib/membership-actions';
import { getSafeErrorMessage } from '@/lib/exposed-error';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Database } from 'lucide-react';

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

export default function SeedPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);
  const isAdmin =
    activeMembership?.role === 'centerAdmin' ||
    activeMembership?.role === 'owner';
  const isLocalDevHost =
    typeof window !== 'undefined' && LOCALHOST_HOSTS.has(window.location.hostname.trim().toLowerCase());

  if (!isLocalDevHost) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md border-dashed border-2">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-black">개발용 페이지 비활성화</CardTitle>
            <CardDescription>운영 환경에서는 시드 페이지가 차단됩니다.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleSeed = async () => {
    if (!user || !activeMembership || !firestore) {
      toast({ variant: 'destructive', title: '로그인 및 센터 가입이 필요합니다.' });
      return;
    }

    if (!isAdmin) {
      toast({ variant: 'destructive', title: '센터 관리자만 시딩할 수 있습니다.' });
      return;
    }

    setIsSeeding(true);
    try {
      const result = await seedInitialData(firestore, user.uid, activeMembership.id);
      if (result.ok) {
        toast({ title: '시딩 성공', description: '초기 데이터가 주입되었습니다.' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: '시딩 실패', description: getSafeErrorMessage(error) });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="max-w-md w-full border-dashed border-2">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
            <Database className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-black">초기 데이터 주입 (Seeding)</CardTitle>
          <CardDescription>
            현재 센터({activeMembership?.id || 'N/A'})에 테스트용 상담 내역, 일지, 학습 계획 등을 생성합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleSeed} 
            disabled={isSeeding || !activeMembership || !isAdmin}
            className="w-full h-12 rounded-xl font-black text-lg"
          >
            {isSeeding ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : '데이터 주입 시작'}
          </Button>
          {!activeMembership && (
            <p className="text-xs text-destructive text-center mt-4 font-bold">
              ※ 먼저 센터에 가입해야 시딩이 가능합니다.
            </p>
          )}
          {activeMembership && !isAdmin && (
            <p className="mt-4 text-center text-xs font-bold text-destructive">
              ※ 센터 관리자 계정에서만 시딩을 실행할 수 있습니다.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
