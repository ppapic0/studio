'use client';

import { useEffect, useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { MessageSquareMore, Sparkles } from 'lucide-react';

import { useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useNotifications } from '@/contexts/notifications-context';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { StudentNotification } from '@/lib/types';

export function FeedbackNotifier() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { latestFeedback, clearLatestFeedback } = useNotifications();
  const isMobile = activeMembership?.role === 'parent' || viewMode === 'mobile';

  const [notification, setNotification] = useState<StudentNotification | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const markAsRead = async (item: StudentNotification | null) => {
    if (!firestore || !activeMembership || !item || item.readAt) return;

    try {
      await updateDoc(
        doc(firestore, 'centers', activeMembership.id, 'studentNotifications', item.id),
        {
          readAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
    } catch (error) {
      console.error('feedback read state update failed', error);
    }
  };

  useEffect(() => {
    if (!latestFeedback) return;
    setNotification(latestFeedback);
    setIsOpen(true);
    clearLatestFeedback();
  }, [latestFeedback, clearLatestFeedback]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          void markAsRead(notification);
        }
      }}
    >
      <DialogContent
        className={cn(
          'border-none p-0 overflow-hidden shadow-2xl flex flex-col transition-all duration-300',
          isMobile ? 'fixed inset-0 h-full w-full max-w-none rounded-none' : 'sm:max-w-lg rounded-[2.5rem]'
        )}
      >
        <div className={cn('relative overflow-hidden bg-[#14295F] text-white', isMobile ? 'p-7' : 'p-8')}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,122,22,0.25),transparent_38%)]" />
          <Sparkles className="absolute right-4 top-4 h-24 w-24 opacity-10" />
          <DialogHeader className="relative z-10">
            <div className="mb-3 flex items-center gap-2">
              <Badge className="border-none bg-white/15 text-white font-black text-[10px] tracking-[0.18em] uppercase whitespace-nowrap">
                한 줄 피드백
              </Badge>
            </div>
            <DialogTitle className="flex items-center gap-3 text-3xl font-black tracking-tight">
              <div className="rounded-2xl bg-white/14 p-2">
                <MessageSquareMore className="h-5 w-5" />
              </div>
              새 피드백이 도착했어요
            </DialogTitle>
            <DialogDescription className="text-sm font-semibold text-white/70">
              선생님이 오늘 학습 흐름에 맞춰 짧고 중요한 코멘트를 남겼습니다.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 bg-[#fafafa] p-6 sm:p-7">
          <div className="app-depth-card rounded-[1.75rem] px-5 py-5 sm:px-6 sm:py-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary/55">
                {notification?.teacherName || '담당 선생님'}
              </p>
              <Badge className="border border-[#ffd9b7] bg-[#fff3e9] text-[#ff7a16] font-black">
                바로 확인
              </Badge>
            </div>
            <p className="break-keep text-lg font-black leading-8 text-slate-900 sm:text-xl">
              {notification?.message || ''}
            </p>
          </div>
        </div>

        <DialogFooter className="border-t bg-white p-5">
          <Button
            onClick={() => {
              void markAsRead(notification);
              setIsOpen(false);
            }}
            className="premium-cta premium-cta-secondary h-12 w-full rounded-2xl text-base"
          >
            확인했어요
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
