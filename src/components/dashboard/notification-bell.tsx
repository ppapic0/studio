'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { Bell, ChevronRight, Clock, FileText, MessageSquareMore, Sparkles } from 'lucide-react';

import { useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StudentNotification } from '@/lib/types';

type ReportItem = {
  id: string;
  dateKey?: string;
  viewedAt?: { toDate?: () => Date };
  updatedAt?: { toDate?: () => Date };
  createdAt?: { toDate?: () => Date };
};

type NotificationFeedItem =
  | {
      id: string;
      kind: 'report';
      title: string;
      description: string;
      timestamp: number;
      unread: boolean;
    }
  | {
      id: string;
      kind: 'feedback';
      title: string;
      description: string;
      timestamp: number;
      unread: boolean;
      payload: StudentNotification;
    };

function toMillis(value?: { toDate?: () => Date } | null) {
  try {
    return value?.toDate?.().getTime?.() || 0;
  } catch {
    return 0;
  }
}

export function NotificationBell() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<StudentNotification[]>([]);
  const [selectedFeedback, setSelectedFeedback] = useState<StudentNotification | null>(null);

  useEffect(() => {
    if (!firestore || !user || !activeMembership || activeMembership.role !== 'student') return;

    const centerId = activeMembership.id;
    const q = query(
      collection(firestore, 'centers', centerId, 'dailyReports'),
      where('studentId', '==', user.uid),
      where('status', '==', 'sent')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReports = snapshot.docs
        .map((reportDoc) => ({ id: reportDoc.id, ...reportDoc.data() } as ReportItem))
        .sort((a, b) => Math.max(toMillis(b.updatedAt), toMillis(b.createdAt)) - Math.max(toMillis(a.updatedAt), toMillis(a.createdAt)))
        .slice(0, 10);

      setReports(fetchedReports);
    });

    return () => unsubscribe();
  }, [firestore, user, activeMembership]);

  useEffect(() => {
    if (!firestore || !user || !activeMembership || activeMembership.role !== 'student') return;

    const centerId = activeMembership.id;
    const q = query(
      collection(firestore, 'centers', centerId, 'studentNotifications'),
      where('studentId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedFeedbacks = snapshot.docs
        .map((feedbackDoc) => ({ id: feedbackDoc.id, ...feedbackDoc.data() } as StudentNotification))
        .filter((item) => item.type === 'one_line_feedback')
        .sort((a, b) => Math.max(toMillis(b.updatedAt), toMillis(b.createdAt)) - Math.max(toMillis(a.updatedAt), toMillis(a.createdAt)))
        .slice(0, 10);

      setFeedbacks(fetchedFeedbacks);
    });

    return () => unsubscribe();
  }, [firestore, user, activeMembership]);

  const markFeedbackAsRead = async (feedback: StudentNotification | null) => {
    if (!firestore || !activeMembership || !feedback || feedback.readAt) return;

    try {
      await updateDoc(
        doc(firestore, 'centers', activeMembership.id, 'studentNotifications', feedback.id),
        {
          readAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
    } catch (error) {
      console.error('mark feedback read failed', error);
    }
  };

  const feedItems = useMemo<NotificationFeedItem[]>(() => {
    const reportItems: NotificationFeedItem[] = reports.map((report) => ({
      id: `report-${report.id}`,
      kind: 'report',
      title: `${report.dateKey || '최근'} 분석 리포트`,
      description:
        report.updatedAt && typeof report.updatedAt.toDate === 'function'
          ? `${format(report.updatedAt.toDate(), 'HH:mm')} 도착`
          : '새 리포트',
      timestamp: Math.max(toMillis(report.updatedAt), toMillis(report.createdAt)),
      unread: !report.viewedAt,
    }));

    const feedbackItems: NotificationFeedItem[] = feedbacks.map((feedback) => ({
      id: `feedback-${feedback.id}`,
      kind: 'feedback',
      title: feedback.title || '한 줄 피드백',
      description: feedback.message,
      timestamp: Math.max(toMillis(feedback.updatedAt), toMillis(feedback.createdAt)),
      unread: !feedback.readAt,
      payload: feedback,
    }));

    return [...feedbackItems, ...reportItems].sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
  }, [feedbacks, reports]);

  const hasNew = useMemo(() => {
    if (feedItems.some((item) => item.unread)) return true;
    const now = Date.now();
    return reports.some((report) => now - Math.max(toMillis(report.updatedAt), toMillis(report.createdAt)) < 24 * 60 * 60 * 1000);
  }, [feedItems, reports]);

  if (!activeMembership || activeMembership.role !== 'student') {
    return (
      <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground">
        <Bell className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground relative">
            <Bell className="h-5 w-5" />
            {hasNew && (
              <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-background animate-pulse" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[330px] rounded-[2rem] border-none shadow-2xl p-4 animate-in fade-in zoom-in duration-300"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DropdownMenuLabel className="font-black text-xs uppercase tracking-[0.2em] opacity-50 px-2 py-2 flex items-center justify-between">
            <span>최근 알림</span>
            <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-black text-[8px] whitespace-nowrap">
              알림 업데이트
            </Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-2" />

          <div className="grid gap-1">
            {feedItems.length === 0 ? (
              <div className="py-10 text-center opacity-20 italic flex flex-col items-center gap-2">
                <Sparkles className="h-8 w-8" />
                <p className="text-[10px] font-black uppercase">새 알림이 없습니다</p>
              </div>
            ) : (
              feedItems.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  onSelect={(event) => {
                    if (item.kind !== 'feedback') return;
                    event.preventDefault();
                    setSelectedFeedback(item.payload);
                    void markFeedbackAsRead(item.payload);
                  }}
                  asChild={item.kind === 'report'}
                  className="p-0"
                >
                  {item.kind === 'report' ? (
                    <Link href="/dashboard/student-reports" className="flex items-center gap-4 p-3 rounded-2xl cursor-pointer hover:bg-primary/5 transition-all group">
                      <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center shrink-0 transition-all group-hover:bg-primary group-hover:text-white shadow-sm">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="grid gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black tracking-tight whitespace-nowrap truncate">{item.title}</p>
                          {item.unread && (
                            <Badge className="border-none bg-emerald-100 text-emerald-700 font-black text-[8px] px-1.5 h-4">
                              신규
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 opacity-45">
                          <Clock className="h-2.5 w-2.5" />
                          <span className="text-[9px] font-bold">{item.description}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-20 group-hover:translate-x-1 transition-all" />
                    </Link>
                  ) : (
                    <button type="button" className="flex w-full items-center gap-4 p-3 rounded-2xl cursor-pointer hover:bg-primary/5 transition-all group text-left">
                      <div className="h-10 w-10 rounded-xl bg-[#fff3e9] text-[#ff7a16] flex items-center justify-center shrink-0 transition-all group-hover:bg-[#ff7a16] group-hover:text-white shadow-sm">
                        <MessageSquareMore className="h-5 w-5" />
                      </div>
                      <div className="grid gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black tracking-tight whitespace-nowrap truncate">{item.title}</p>
                          {item.unread && (
                            <Badge className="border-none bg-rose-100 text-rose-700 font-black text-[8px] px-1.5 h-4">
                              신규
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] font-semibold text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-20 group-hover:translate-x-1 transition-all" />
                    </button>
                  )}
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

      <Dialog
        open={!!selectedFeedback}
        onOpenChange={(open) => {
          if (!open) {
            void markFeedbackAsRead(selectedFeedback);
            setSelectedFeedback(null);
          }
        }}
      >
        <DialogContent className="rounded-[2.25rem] border-none p-0 overflow-hidden shadow-2xl sm:max-w-lg">
          <div className="bg-gradient-to-br from-[#14295F] via-[#17326f] to-[#0f214d] px-7 py-6 text-white">
            <DialogHeader>
              <div className="mb-3 flex items-center gap-2">
                <Badge className="border-none bg-white/15 text-white font-black text-[10px] tracking-[0.18em] uppercase whitespace-nowrap">
                  선생님 피드백
                </Badge>
              </div>
              <DialogTitle className="flex items-center gap-3 text-2xl font-black tracking-tight">
                <div className="rounded-2xl bg-white/12 p-2">
                  <MessageSquareMore className="h-5 w-5" />
                </div>
                {selectedFeedback?.title || '한 줄 피드백'}
              </DialogTitle>
              <DialogDescription className="text-white/75 font-semibold">
                {selectedFeedback?.teacherName || '담당 선생님'} 선생님이 남긴 오늘의 코멘트입니다.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="bg-[#fafafa] px-6 py-6">
            <div className="app-depth-card rounded-[1.65rem] px-5 py-5">
              <p className="break-keep text-lg font-black leading-8 text-slate-900">
                {selectedFeedback?.message || ''}
              </p>
            </div>
          </div>

          <DialogFooter className="border-t bg-white p-5">
            <Button
              className="premium-cta premium-cta-secondary h-12 w-full rounded-2xl text-base"
              onClick={() => {
                void markFeedbackAsRead(selectedFeedback);
                setSelectedFeedback(null);
              }}
            >
              확인했어요
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
