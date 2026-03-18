'use client';

import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';

import { useAppContext } from '@/contexts/app-context';
import { useUser } from '@/firebase';
import StudentReportsPage from '../student-reports/page';
import StudentDetailPage from '../teacher/students/[id]/page';

export default function AnalysisTrackPage() {
  const { viewMode } = useAppContext();
  const { user } = useUser();
  const selfParams = useMemo(() => Promise.resolve({ id: user?.uid ?? '' }), [user?.uid]);

  if (viewMode === 'mobile') {
    return <StudentReportsPage />;
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
