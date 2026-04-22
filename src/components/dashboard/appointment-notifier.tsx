'use client';

import { useState, useEffect, useRef } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Bell, Calendar, MessageSquare, Sparkles, X, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function AppointmentNotifier() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, activeStudentId, viewMode } = useAppContext();
  const isMobile = viewMode === 'mobile';
  const authUid = user?.uid || null;
  const studentUid = authUid || activeStudentId || null;

  const [notification, setNotification] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!firestore || !user || !activeMembership || activeMembership.role !== 'student' || !studentUid) return;

    const centerId = activeMembership.id;
    const q = query(
      collection(firestore, 'centers', centerId, 'counselingReservations'),
      where('studentId', '==', studentUid),
      where('status', 'in', ['confirmed', 'canceled'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();
          const updatedAt = data.updatedAt?.toMillis() || 0;
          const now = Date.now();
          
          // 최근 15초 이내 업데이트만 알림
          if (now - updatedAt < 15000) {
            setNotification({ id: change.doc.id, ...data });
            setIsOpen(true);
          }
        }
      });
    });

    return () => unsubscribe();
  }, [firestore, studentUid, user?.uid, activeMembership?.id, activeMembership?.role]);

  if (!notification) return null;

  const isCanceled = notification.status === 'canceled';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className={cn(
        "rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md animate-in fade-in zoom-in duration-500",
        isMobile ? "fixed bottom-4 top-auto translate-y-0 max-w-[95vw] left-1/2 -translate-x-1/2" : ""
      )}>
        <div className={cn("p-8 text-white relative", isCanceled ? "bg-rose-600" : "bg-primary")}>
          <div className="absolute top-0 right-0 p-8 h-32 w-32 opacity-10 animate-pulse">
            {isCanceled ? <X className="h-full w-full" /> : <Sparkles className="h-full w-full" />}
          </div>
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-white/20 p-1.5 rounded-lg">
                <Bell className="h-4 w-4 text-white animate-bounce" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 whitespace-nowrap">상담 상태 알림</span>
            </div>
            <DialogTitle className="text-3xl font-black tracking-tighter">
              {isCanceled ? '상담이 취소되었습니다' : '상담 예약 확정!'}
            </DialogTitle>
            <DialogDescription className="text-white/70 font-bold mt-1">
              {isCanceled ? '상담 일정이 취소되었습니다.' : '선생님과 상담 약속이 잡혔습니다.'}
            </DialogDescription>
          </DialogHeader>
        </div>
        
        <div className="p-8 space-y-6 bg-white">
          <div className={cn(
            "flex items-center gap-5 p-5 rounded-[1.5rem] border",
            isCanceled ? "bg-rose-50 border-rose-100" : "bg-muted/30 border-border/50"
          )}>
            <div className="h-14 w-14 rounded-2xl bg-white flex flex-col items-center justify-center shadow-sm shrink-0 border-2 border-primary/5">
              <span className={cn("text-[8px] font-black uppercase leading-none", isCanceled ? "text-rose-400" : "text-primary/40")}>
                {notification.scheduledAt ? format(notification.scheduledAt.toDate(), 'M월') : ''}
              </span>
              <span className={cn("text-xl font-black", isCanceled ? "text-rose-600" : "text-primary")}>
                {notification.scheduledAt ? format(notification.scheduledAt.toDate(), 'd') : ''}
              </span>
            </div>
            <div className="grid gap-0.5">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">요청된 일시</p>
              <h4 className="text-lg font-black tracking-tight">
                {notification.scheduledAt ? format(notification.scheduledAt.toDate(), 'p (EEEE)', { locale: ko }) : '-'}
              </h4>
            </div>
          </div>

          {(notification.teacherNote || isCanceled) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary/60 ml-1">
                {isCanceled ? <AlertCircle className="h-3.5 w-3.5 text-rose-500" /> : <MessageSquare className="h-3.5 w-3.5" />}
                <span className="text-[10px] font-black tracking-widest whitespace-nowrap">
                  {isCanceled ? "취소 사유 / 메모" : "선생님 메모"}
                </span>
              </div>
              <div className={cn(
                "p-4 rounded-2xl border text-sm font-bold leading-relaxed italic",
                isCanceled ? "bg-rose-50/50 border-rose-100 text-rose-900" : "bg-[#fafafa] border-border text-foreground/80"
              )}>
                "{notification.teacherNote || (isCanceled ? "상담 일정이 취소되었습니다." : "")}"
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 bg-muted/10 border-t">
          <Button onClick={() => setIsOpen(false)} className={cn(
            "w-full h-12 rounded-xl font-black text-base shadow-xl",
            isCanceled ? "bg-rose-600 hover:bg-rose-700" : ""
          )}>
            확인했습니다
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
