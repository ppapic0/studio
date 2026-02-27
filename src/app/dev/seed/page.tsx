'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { seedInitialData } from '@/lib/membership-actions';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Database } from 'lucide-react';

export default function SeedPage() {
  const { user } = useUser();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeed = async () => {
    if (!user || !activeMembership) {
      toast({ variant: 'destructive', title: '로그인 및 센터 가입이 필요합니다.' });
      return;
    }

    setIsSeeding(true);
    try {
      const result = await seedInitialData(user.uid, activeMembership.id);
      if (result.ok) {
        toast({ title: '시딩 성공', description: '초기 데이터가 주입되었습니다.' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: '시딩 실패', description: error.message });
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
            disabled={isSeeding || !activeMembership} 
            className="w-full h-12 rounded-xl font-black text-lg"
          >
            {isSeeding ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : '데이터 주입 시작'}
          </Button>
          {!activeMembership && (
            <p className="text-xs text-destructive text-center mt-4 font-bold">
              ※ 먼저 센터에 가입해야 시딩이 가능합니다.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
