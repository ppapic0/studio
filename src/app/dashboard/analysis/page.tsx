'use client';

import { FileText, Loader2 } from 'lucide-react';
import { useMemo } from 'react';

import { useAppContext } from '@/contexts/app-context';
import { useUser } from '@/firebase';
import StudentDetailPage from '../teacher/students/[id]/page';

export default function AnalysisTrackPage() {
  const { viewMode } = useAppContext();
  const { user } = useUser();
  const selfParams = useMemo(() => Promise.resolve({ id: user?.uid ?? '' }), [user?.uid]);

  if (viewMode === 'mobile') {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center px-4 py-20">
        <div className="w-full rounded-3xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FileText className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-primary">분석트랙은 웹모드 전용입니다</h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground">앱모드에서는 학생 본인의 학습 분석표를 확인할 수 없어요.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <StudentDetailPage params={selfParams} />;
}
