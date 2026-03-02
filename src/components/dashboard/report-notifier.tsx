'use client';

import { useState, useEffect, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { FileText, Sparkles, X, Wand2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { VisualReportViewer } from './visual-report-viewer';
import { Badge } from '@/components/ui/badge';

export function ReportNotifier() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const isMobile = viewMode === 'mobile';

  const [notification, setNotification] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!firestore || !user || !activeMembership || activeMembership.role !== 'student') return;

    const centerId = activeMembership.id;
    // 복합 색인 요구를 피하기 위해 orderBy와 limit을 제거하고 클라이언트 측에서 필터링합니다.
    const q = query(
      collection(firestore, 'centers', centerId, 'dailyReports'),
      where('studentId', '==', user.uid),
      where('status', '==', 'sent')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        return;
      }

      // 변경된 문서 중 가장 최신의 발송된 리포트 하나를 찾습니다.
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();
          const updatedAt = data.updatedAt?.toMillis() || 0;
          const now = Date.now();
          
          // 최근 20초 이내에 선생님이 발송한 경우만 팝업 실행
          if (now - updatedAt < 20000) {
            setNotification({ id: change.doc.id, ...data });
            setIsOpen(true);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [firestore, user, activeMembership]);

  if (!notification) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className={cn(
        "rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col transition-all duration-500",
        isMobile ? "fixed inset-0 w-full h-full max-w-none rounded-none" : "sm:max-w-2xl max-h-[90vh]"
      )}>
        <div className={cn("p-8 text-white relative shrink-0 bg-primary")}>
          <div className="absolute top-0 right-0 p-8 h-32 w-32 opacity-10 animate-pulse">
            <Sparkles className="h-full w-full" />
          </div>
          <DialogHeader className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-white/20 p-1.5 rounded-lg">
                <FileText className="h-4 w-4 text-white animate-bounce" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">New Analysis Arrived</span>
            </div>
            <DialogTitle className="text-3xl font-black tracking-tighter">
              데일리 리포트가 도착했습니다
            </DialogTitle>
            <DialogDescription className="text-white/70 font-bold mt-1">
              선생님이 어제 데이터를 정밀 분석하여 보냈습니다.
            </DialogDescription>
          </DialogHeader>
        </div>
        
        <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar p-6 sm:p-10">
          <div className="flex justify-center mb-6">
            <Badge variant="secondary" className="rounded-full px-4 py-1.5 bg-white border-2 border-primary/10 shadow-sm font-black text-primary gap-2">
              <Wand2 className="h-3.5 w-3.5" /> {notification.dateKey} 분석 결과
            </Badge>
          </div>
          <VisualReportViewer content={notification.content} />
        </div>

        <DialogFooter className="p-6 bg-white border-t shrink-0">
          <Button onClick={() => setIsOpen(false)} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20">
            확인했습니다
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
