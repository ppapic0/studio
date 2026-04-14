'use client';

import { useEffect, useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Crown, Gift, Sparkles } from 'lucide-react';

import { useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useNotifications } from '@/contexts/notifications-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { logHandledClientIssue } from '@/lib/handled-client-log';
import { getRankingRewardContextCopy, getRankingRewardHeadline } from '@/lib/ranking-reward-display';
import { StudentNotification } from '@/lib/types';

export function RankingRewardNotifier() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { latestRankingReward, clearLatestRankingReward } = useNotifications();
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
      logHandledClientIssue('[ranking-reward-notifier] reward read state update failed', error);
    }
  };

  useEffect(() => {
    if (!latestRankingReward) return;
    setNotification(latestRankingReward);
    setIsOpen(true);
    clearLatestRankingReward();
  }, [latestRankingReward, clearLatestRankingReward]);

  const points = Math.max(0, Number(notification?.rankingRewardPoints || 0));
  const rewardHeadline = getRankingRewardHeadline(notification);
  const rewardContextCopy = getRankingRewardContextCopy(notification);

  if (!notification || points <= 0) return null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          void markAsRead(notification);
          setNotification(null);
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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,122,22,0.28),transparent_38%)]" />
          <Sparkles className="absolute right-4 top-4 h-24 w-24 opacity-10" />
          <DialogHeader className="relative z-10">
            <div className="mb-3 flex items-center gap-2">
              <Badge className="border-none bg-white/15 text-white font-black text-[10px] tracking-[0.18em] uppercase whitespace-nowrap">
                랭킹 보상 도착
              </Badge>
            </div>
            <DialogTitle className="flex items-center gap-3 text-3xl font-black tracking-tight">
              <div className="rounded-2xl bg-white/14 p-2">
                <Crown className="h-5 w-5" />
              </div>
              축하해요! {rewardHeadline}
            </DialogTitle>
            <DialogDescription className="text-sm font-semibold text-white/72">
              {rewardContextCopy} 학생 알림함에서도 다시 확인할 수 있어요.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 bg-[#fafafa] p-6 sm:p-7">
          <div className="app-depth-card rounded-[1.75rem] px-5 py-5 sm:px-6 sm:py-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary/55">
                {`${rewardHeadline} 보상`}
              </p>
              <Badge className="border border-[#ffd9b7] bg-[#fff3e9] text-[#ff7a16] font-black">
                지급 완료
              </Badge>
            </div>

            <div className="rounded-[1.4rem] bg-[linear-gradient(135deg,#fff8ef_0%,#ffffff_100%)] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[#14295F] p-3 text-white shadow-[0_18px_36px_-24px_rgba(20,41,95,0.7)]">
                  <Gift className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6a7aa5]">획득 포인트</p>
                  <p className="mt-1 text-3xl font-black tracking-tight text-[#14295F]">+{points.toLocaleString()}P</p>
                </div>
              </div>
              <p className="mt-4 break-keep text-sm font-semibold leading-6 text-slate-700">
                {notification.message}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t bg-white p-5">
          <Button
            onClick={() => {
              void markAsRead(notification);
              setIsOpen(false);
              setNotification(null);
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
