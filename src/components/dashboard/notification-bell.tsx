'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, FileText, ChevronRight, Sparkles, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function NotificationBell() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const [reports, setReports] = useState<any[]>([]);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    if (!firestore || !user || !activeMembership || activeMembership.role !== 'student') return;

    const centerId = activeMembership.id;
    // 복합 색인 에러 방지를 위해 orderBy를 제거하고 클라이언트에서 정렬합니다.
    const q = query(
      collection(firestore, 'centers', centerId, 'dailyReports'),
      where('studentId', '==', user.uid),
      where('status', '==', 'sent')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReports = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0))
        .slice(0, 5);
        
      setReports(fetchedReports);
      
      const now = Date.now();
      const isNew = fetchedReports.some(r => now - (r.updatedAt?.toMillis() || 0) < 24 * 60 * 60 * 1000);
      setHasNew(isNew);
    });

    return () => unsubscribe();
  }, [firestore, user, activeMembership]);

  if (!activeMembership || activeMembership.role !== 'student') {
    return (
      <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground">
        <Bell className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground relative">
          <Bell className="h-5 w-5" />
          {hasNew && (
            <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-background animate-pulse" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[320px] rounded-[2rem] border-none shadow-2xl p-4 animate-in fade-in zoom-in duration-300">
        <DropdownMenuLabel className="font-black text-xs uppercase tracking-[0.2em] opacity-40 px-2 py-2 flex items-center justify-between">
          <span>최근 학습 알림</span>
          <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-black text-[8px]">RECENTS</Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-2" />
        <div className="grid gap-1">
          {reports.length === 0 ? (
            <div className="py-10 text-center opacity-20 italic flex flex-col items-center gap-2">
              <Sparkles className="h-8 w-8" />
              <p className="text-[10px] font-black uppercase">No Reports Yet</p>
            </div>
          ) : (
            reports.map((report) => (
              <DropdownMenuItem key={report.id} asChild>
                <Link href="/dashboard/student-reports" className="flex items-center gap-4 p-3 rounded-2xl cursor-pointer hover:bg-primary/5 transition-all group">
                  <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center shrink-0 transition-all group-hover:bg-primary group-hover:text-white shadow-sm">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="grid gap-0.5 flex-1 min-w-0">
                    <p className="text-sm font-black tracking-tight">{report.dateKey} 분석 리포트</p>
                    <div className="flex items-center gap-1.5 opacity-40">
                      <Clock className="h-2.5 w-2.5" />
                      <span className="text-[9px] font-bold">{report.updatedAt ? format(report.updatedAt.toDate(), 'HH:mm') : ''} 도착</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-20 group-hover:translate-x-1 transition-all" />
                </Link>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator className="my-2" />
        <Link href="/dashboard/student-reports" className="block p-2">
          <Button variant="outline" className="w-full h-10 rounded-xl font-black text-[10px] uppercase tracking-widest border-2 hover:bg-primary hover:text-white transition-all">
            모든 리포트 보기
          </Button>
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
