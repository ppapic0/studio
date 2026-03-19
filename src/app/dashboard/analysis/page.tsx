'use client';

import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';

import { useAppContext } from '@/contexts/app-context';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import { StudentTrackSubnav } from '@/components/dashboard/student-track-subnav';
import StudentDetailPage from '../teacher/students/[id]/page';

export default function AnalysisTrackPage() {
  const { viewMode } = useAppContext();
  const { user } = useUser();
  const selfParams = useMemo(() => Promise.resolve({ id: user?.uid ?? '' }), [user?.uid]);
  const isMobile = viewMode === 'mobile';

  if (!user) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn(isMobile && 'flex flex-col gap-3')}>
      {isMobile && <StudentTrackSubnav />}
      <StudentDetailPage params={selfParams} />
    </div>
  );
}
