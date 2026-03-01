
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
import { Bell, Calendar, MessageSquare, Sparkles, X } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function AppointmentNotifier() {
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
    const q = query(
      collection(firestore, 'centers', centerId, 'counselingReservations'),
      where('studentId', '==', user.uid),
      where('status', '==', 'confirmed')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();
          // 최근 10초 이내에 업데이트된 것만 알림 (중복 알림 방지)
          const updatedAt = data.updatedAt?.toMillis() || 0;
          const now = Date.now();
          
          if (now - updatedAt < 10000) {
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
        "rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md animate-in fade-in zoom-in duration-500",
        isMobile ? "fixed bottom-4 top-auto translate-y-0 max-w-[95vw] left-1/2 -translate-x-1/2" : ""
      )}>
        <div className="bg-primary p-8 text-white relative">
          <Sparkles className="absolute top-0 right-0 p-8 h-32 w-32 opacity-10 animate-pulse" />
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-white/20 p-1.5 rounded-lg">
                <Bell className="h-4 w-4 text-white animate-bounce" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">New Appointment</span>
            </div>
            <DialogTitle className="text-3xl font-black tracking-tighter">상담 예약 확정!</DialogTitle>
            <DialogDescription className="text-white/70 font-bold mt-1">선생님과 상담 약속이 잡혔습니다.</DialogDescription>
          </DialogHeader>
        </div>
        
        <div className="p-8 space-y-6 bg-white">
          <div className="flex items-center gap-5 p-5 rounded-[1.5rem] bg-muted/30 border border-border/50">
            <div className="h-14 w-14 rounded-2xl bg-white flex flex-col items-center justify-center shadow-sm shrink-0 border-2 border-primary/5">
              <span className="text-[8px] font-black text-primary/40 uppercase leading-none">{notification.scheduledAt ? format(notification.scheduledAt.toDate(), 'MMM') : ''}</span>
              <span className="text-xl font-black text-primary">{notification.scheduledAt ? format(notification.scheduledAt.toDate(), 'd') : ''}</span>
            </div>
            <div className="grid gap-0.5">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">상담 일시</p>
              <h4 className="text-lg font-black tracking-tight">
                {notification.scheduledAt ? format(notification.scheduledAt.toDate(), 'p (EEEE)', { locale: ko }) : '-'}
              </h4>
            </div>
          </div>

          {notification.teacherNote && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary/60 ml-1">
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">Teacher's Note</span>
              </div>
              <div className="p-4 rounded-2xl bg-[#fafafa] border text-sm font-bold text-foreground/80 leading-relaxed italic">
                "{notification.teacherNote}"
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 bg-muted/10 border-t">
          <Button onClick={() => setIsOpen(false)} className="w-full h-12 rounded-xl font-black text-base shadow-xl">
            확인했습니다
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
