'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, doc, limit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { AlertTriangle, Bell, ChevronRight, Clock, Crown, FileText, Gift, MessageSquareMore, Sparkles } from 'lucide-react';

import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useNotifications } from '@/contexts/notifications-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
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
import { logHandledClientIssue } from '@/lib/handled-client-log';
import { getRankingRangeLabel, getRankingRewardContextCopy, getRankingRewardHeadline } from '@/lib/ranking-reward-display';
import { StudentNotification } from '@/lib/types';
import { isAdminRole } from '@/lib/dashboard-access';

type NotificationFeedItem =
  | {
      id: string;
      kind: 'report';
      title: string;
      description: string;
      timestamp: number;
      unread: boolean;
      link: string;
      reportId: string;
      viewedAt?: { toDate?: () => Date } | null;
    }
  | {
      id: string;
      kind: 'announcement';
      title: string;
      description: string;
      timestamp: number;
      unread: boolean;
      link: string;
    }
  | {
      id: string;
      kind: 'feedback';
      title: string;
      description: string;
      timestamp: number;
      unread: boolean;
      payload: StudentNotification;
    }
  | {
      id: string;
      kind: 'reward';
      title: string;
      description: string;
      timestamp: number;
      unread: boolean;
      payload: StudentNotification;
    };

type AdminNotificationItem = {
  id: string;
  kind: 'reservation' | 'communication' | 'report';
  title: string;
  description: string;
  timestamp: number;
  priority: number;
  unread: boolean;
  link: string;
};

function toMillis(value?: { toDate?: () => Date } | null) {
  try {
    return value?.toDate?.().getTime?.() || 0;
  } catch {
    return 0;
  }
}

export function NotificationBell() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeMembership } = useAppContext();
  const { reports, feedbacks, rankingRewards } = useNotifications();
  const isStudentRole = activeMembership?.role === 'student';
  const isCenterAdminRole = isAdminRole(activeMembership?.role);

  const [selectedFeedback, setSelectedFeedback] = useState<StudentNotification | null>(null);
  const [selectedReward, setSelectedReward] = useState<StudentNotification | null>(null);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncNow = () => setNowMs(Date.now());
    syncNow();
    const intervalId = window.setInterval(syncNow, 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const reservationsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !isCenterAdminRole) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'counselingReservations'),
      orderBy('createdAt', 'desc'),
      limit(120)
    );
  }, [firestore, activeMembership?.id, isCenterAdminRole]);
  const { data: reservationRows } = useCollection<any>(reservationsQuery, { enabled: isCenterAdminRole });

  const parentCommsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !isCenterAdminRole) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'parentCommunications'),
      orderBy('updatedAt', 'desc'),
      limit(120)
    );
  }, [firestore, activeMembership?.id, isCenterAdminRole]);
  const { data: parentCommRows } = useCollection<any>(parentCommsQuery, { enabled: isCenterAdminRole });

  const reportQueueQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !isCenterAdminRole) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'dailyReports'),
      orderBy('updatedAt', 'desc'),
      limit(120)
    );
  }, [firestore, activeMembership?.id, isCenterAdminRole]);
  const { data: reportRows } = useCollection<any>(reportQueueQuery, { enabled: isCenterAdminRole });

  const studentAnnouncementsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !isStudentRole) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'centerAnnouncements'),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
  }, [firestore, activeMembership?.id, isStudentRole]);
  const { data: studentAnnouncementRows } = useCollection<any>(studentAnnouncementsQuery, { enabled: isStudentRole });

  const markStudentNotificationAsRead = async (notification: StudentNotification | null) => {
    if (!firestore || !activeMembership || !notification || notification.readAt) return;

    try {
      await updateDoc(
        doc(firestore, 'centers', activeMembership.id, 'studentNotifications', notification.id),
        {
          readAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
    } catch (error) {
      logHandledClientIssue('[notification-bell] mark student notification read failed', error);
    }
  };

  const markReportAsRead = async (reportId?: string, alreadyViewed?: boolean) => {
    if (!firestore || !activeMembership || !user || !reportId || alreadyViewed) return;

    try {
      await updateDoc(
        doc(firestore, 'centers', activeMembership.id, 'dailyReports', reportId),
        {
          viewedAt: serverTimestamp(),
          viewedByUid: user.uid,
          viewedByName: user.displayName || activeMembership.displayName || '학생',
        }
      );
    } catch (error) {
      logHandledClientIssue('[notification-bell] mark report read failed', error);
    }
  };

  const studentFeedItems = useMemo<NotificationFeedItem[]>(() => {
    const reportItems: NotificationFeedItem[] = reports.map((report) => ({
      id: `report-${report.id}`,
      kind: 'report',
      title: `${report.dateKey || '최근'} 학습 리포트`,
      description:
        report.updatedAt && typeof report.updatedAt.toDate === 'function'
          ? `${format(report.updatedAt.toDate(), 'HH:mm')} 업데이트`
          : '새 리포트',
      timestamp: Math.max(toMillis(report.updatedAt), toMillis(report.createdAt)),
      unread: !report.viewedAt,
      link: '/dashboard/student-reports',
      reportId: report.id,
      viewedAt: report.viewedAt,
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

    const rewardItems: NotificationFeedItem[] = rankingRewards.map((reward) => {
      const headline = getRankingRewardHeadline(reward);
      const points = Math.max(0, Number(reward.rankingRewardPoints || 0));
      return {
        id: `reward-${reward.id}`,
        kind: 'reward',
        title: headline,
        description: points > 0 ? `${headline} · +${points.toLocaleString()}P 지급` : reward.message,
        timestamp: Math.max(toMillis(reward.updatedAt), toMillis(reward.createdAt)),
        unread: !reward.readAt,
        payload: reward,
      };
    });

    const announcementItems: NotificationFeedItem[] = (studentAnnouncementRows || [])
      .filter((item) => {
        const normalizedStatus = item?.status?.trim?.().toLowerCase?.();
        const isPublished = normalizedStatus
          ? normalizedStatus === 'published'
          : typeof item?.isPublished === 'boolean'
            ? item.isPublished
            : true;
        const audience = item?.audience || 'student';
        return isPublished && (audience === 'student' || audience === 'all' || !item?.audience);
      })
      .map((item, index) => {
        const timestamp = Math.max(toMillis(item?.updatedAt), toMillis(item?.createdAt));
        return {
          id: `announcement-${item?.id || index}`,
          kind: 'announcement',
          title: item?.title || '센터 공지사항',
          description: item?.body || '공지 내용을 확인해 주세요.',
          timestamp,
          unread: nowMs > 0 ? nowMs - timestamp < 3 * 24 * 60 * 60 * 1000 : false,
          link: '/dashboard/appointments/inquiries',
        };
      });

    return [...rewardItems, ...feedbackItems, ...announcementItems, ...reportItems].sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
  }, [feedbacks, nowMs, rankingRewards, reports, studentAnnouncementRows]);

  const adminFeedItems = useMemo<AdminNotificationItem[]>(() => {
    if (!isCenterAdminRole) return [];

    const items: AdminNotificationItem[] = [];
    const reservations = reservationRows || [];
    const parentComms = parentCommRows || [];
    const reportsForCenter = reportRows || [];

    reservations
      .filter((row) => row?.status === 'requested')
      .slice(0, 5)
      .forEach((row, index) => {
        const scheduledAtMs = toMillis(row?.scheduledAt);
        items.push({
          id: `reservation-${row?.id || index}`,
          kind: 'reservation',
          title: `상담 승인 대기 · ${row?.studentName || '학생'}`,
          description: scheduledAtMs ? `${format(new Date(scheduledAtMs), 'MM.dd HH:mm')} 상담 요청` : '일정 확인 필요',
          timestamp: Math.max(toMillis(row?.updatedAt), toMillis(row?.createdAt), scheduledAtMs),
          priority: 100,
          unread: true,
          link: '/dashboard/appointments/reservations',
        });
      });

    parentComms
      .filter((row) => ['requested', 'in_review', 'in_progress'].includes(String(row?.status || 'requested')))
      .slice(0, 6)
      .forEach((row, index) => {
        const status = String(row?.status || 'requested');
        const sender = row?.senderRole === 'student' ? '학생' : '학부모';
        const typeLabel =
          row?.type === 'consultation'
            ? '상담 요청'
            : row?.type === 'suggestion'
              ? '건의사항'
              : sender === '학생'
                ? '학생 질문'
                : '일반 요청';

        items.push({
          id: `communication-${row?.id || index}`,
          kind: 'communication',
          title: `${typeLabel} · ${row?.senderName || sender}`,
          description: status === 'requested' ? '신규 접수 건 확인 필요' : status === 'in_review' ? '검토 중 항목 후속 처리' : '처리 중 항목 점검',
          timestamp: Math.max(toMillis(row?.updatedAt), toMillis(row?.createdAt)),
          priority: status === 'requested' ? 95 : status === 'in_review' ? 78 : 70,
          unread: status !== 'done',
          link: '/dashboard/appointments/parent-requests',
        });
      });

    const draftReports = reportsForCenter.filter((row) => row?.status !== 'sent');
    if (draftReports.length > 0) {
      const latestTs = draftReports.reduce((max, row) => Math.max(max, toMillis(row?.updatedAt), toMillis(row?.createdAt)), 0);
      items.push({
        id: 'report-draft-summary',
        kind: 'report',
        title: `리포트 점검 필요 · ${draftReports.length}건`,
        description: '작성 중/미전송 리포트를 확인해 주세요.',
        timestamp: latestTs,
        priority: 80,
        unread: true,
        link: '/dashboard/reports',
      });
    }

    return items
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.timestamp - a.timestamp;
      })
      .slice(0, 8);
  }, [isCenterAdminRole, reservationRows, parentCommRows, reportRows]);

  const hasNew = useMemo(() => {
    if (isCenterAdminRole) return adminFeedItems.some((item) => item.unread);
    if (studentFeedItems.some((item) => item.unread)) return true;
    return nowMs > 0
      ? reports.some((report) => nowMs - Math.max(toMillis(report.updatedAt), toMillis(report.createdAt)) < 24 * 60 * 60 * 1000)
      : false;
  }, [adminFeedItems, studentFeedItems, reports, isCenterAdminRole, nowMs]);

  if (!activeMembership) {
    return (
      <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground">
        <Bell className="h-5 w-5" />
      </Button>
    );
  }

  if (!isStudentRole && !isCenterAdminRole) {
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
          className="max-h-[min(78vh,36rem)] w-[min(calc(100vw-2rem),380px)] overflow-y-auto rounded-[2rem] border-none p-4 shadow-2xl animate-in fade-in zoom-in duration-300"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DropdownMenuLabel className="font-black text-xs uppercase tracking-[0.2em] opacity-50 px-2 py-2 flex items-center justify-between">
            <span>{isCenterAdminRole ? '센터 우선 알림' : '최근 알림'}</span>
            <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-black text-[8px] whitespace-nowrap">
              {isCenterAdminRole ? `우선순위 ${adminFeedItems.length}건` : '알림 업데이트'}
            </Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-2" />

          <div className="grid gap-1">
            {(isCenterAdminRole ? adminFeedItems.length === 0 : studentFeedItems.length === 0) ? (
              <div className="py-10 text-center opacity-20 italic flex flex-col items-center gap-2">
                <Sparkles className="h-8 w-8" />
                <p className="text-[10px] font-black uppercase">{isCenterAdminRole ? '체크할 우선 알림이 없습니다' : '새 알림이 없습니다'}</p>
              </div>
            ) : isCenterAdminRole ? (
              adminFeedItems.map((item) => (
                <DropdownMenuItem key={item.id} asChild className="p-0">
                  <Link href={item.link} className="flex items-center gap-4 p-3 rounded-2xl cursor-pointer hover:bg-primary/5 transition-all group">
                    <div
                      className={item.kind === 'reservation'
                        ? 'h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 transition-all group-hover:bg-rose-600 group-hover:text-white shadow-sm'
                        : item.kind === 'communication'
                          ? 'h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 transition-all group-hover:bg-amber-500 group-hover:text-white shadow-sm'
                          : 'h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 transition-all group-hover:bg-blue-600 group-hover:text-white shadow-sm'}
                    >
                      {item.kind === 'reservation' ? <Clock className="h-5 w-5" /> : item.kind === 'communication' ? <AlertTriangle className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                    </div>
                    <div className="grid gap-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black tracking-tight truncate">{item.title}</p>
                        {item.unread && (
                          <Badge className="border-none bg-rose-100 text-rose-700 font-black text-[8px] px-1.5 h-4">
                            신규
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-muted-foreground line-clamp-2">{item.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-20 group-hover:translate-x-1 transition-all" />
                  </Link>
                </DropdownMenuItem>
              ))
            ) : (
              studentFeedItems.map((item) => (
                <DropdownMenuItem
                  key={item.id}
                  onSelect={(event) => {
                    if (item.kind === 'feedback') {
                      event.preventDefault();
                      setSelectedFeedback(item.payload);
                      void markStudentNotificationAsRead(item.payload);
                      return;
                    }

                    if (item.kind === 'reward') {
                      event.preventDefault();
                      setSelectedReward(item.payload);
                      void markStudentNotificationAsRead(item.payload);
                      return;
                    }

                    if (item.kind === 'report') {
                      void markReportAsRead(item.reportId, !!item.viewedAt);
                    }
                  }}
                  asChild={item.kind === 'report' || item.kind === 'announcement'}
                  className="p-0"
                >
                  {item.kind === 'report' || item.kind === 'announcement' ? (
                    <Link href={item.link} className="flex items-center gap-4 p-3 rounded-2xl cursor-pointer hover:bg-primary/5 transition-all group">
                      <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center shrink-0 transition-all group-hover:bg-primary group-hover:text-white shadow-sm">
                        {item.kind === 'announcement' ? <AlertTriangle className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                      </div>
                      <div className="grid gap-1 flex-1 min-w-0">
                        <div className="flex min-w-0 items-start gap-2">
                          <p className="line-clamp-2 min-w-0 flex-1 break-keep text-sm font-black leading-snug tracking-tight">{item.title}</p>
                          {item.unread && (
                            <Badge className="h-4 shrink-0 border-none bg-emerald-100 px-1.5 text-[8px] font-black text-emerald-700">
                              신규
                            </Badge>
                          )}
                        </div>
                        <div className="flex min-w-0 items-start gap-1.5 opacity-45">
                          <Clock className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                          <span className="line-clamp-2 min-w-0 text-[9px] font-bold leading-4">{item.description}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-20 group-hover:translate-x-1 transition-all" />
                    </Link>
                  ) : item.kind === 'reward' ? (
                    <button type="button" className="flex w-full items-center gap-4 p-3 rounded-2xl cursor-pointer hover:bg-primary/5 transition-all group text-left">
                      <div className="h-10 w-10 rounded-xl bg-[#fff3e9] text-[#ff7a16] flex items-center justify-center shrink-0 transition-all group-hover:bg-[#ff7a16] group-hover:text-white shadow-sm">
                        <Crown className="h-5 w-5" />
                      </div>
                      <div className="grid gap-1 flex-1 min-w-0">
                        <div className="flex min-w-0 items-start gap-2">
                          <p className="line-clamp-2 min-w-0 flex-1 break-keep text-sm font-black leading-snug tracking-tight">{item.title}</p>
                          {item.unread && (
                            <Badge className="h-4 shrink-0 border-none bg-amber-100 px-1.5 text-[8px] font-black text-amber-700">
                              신규
                            </Badge>
                          )}
                        </div>
                        <p className="line-clamp-2 min-w-0 text-[11px] font-semibold leading-4 text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 opacity-20 group-hover:translate-x-1 transition-all" />
                    </button>
                  ) : (
                    <button type="button" className="flex w-full items-center gap-4 p-3 rounded-2xl cursor-pointer hover:bg-primary/5 transition-all group text-left">
                      <div className="h-10 w-10 rounded-xl bg-[#fff3e9] text-[#ff7a16] flex items-center justify-center shrink-0 transition-all group-hover:bg-[#ff7a16] group-hover:text-white shadow-sm">
                        <MessageSquareMore className="h-5 w-5" />
                      </div>
                      <div className="grid gap-1 flex-1 min-w-0">
                        <div className="flex min-w-0 items-start gap-2">
                          <p className="line-clamp-2 min-w-0 flex-1 break-keep text-sm font-black leading-snug tracking-tight">{item.title}</p>
                          {item.unread && (
                            <Badge className="h-4 shrink-0 border-none bg-rose-100 px-1.5 text-[8px] font-black text-rose-700">
                              신규
                            </Badge>
                          )}
                        </div>
                        <p className="line-clamp-2 min-w-0 text-[11px] font-semibold leading-4 text-muted-foreground">
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
          <Link href={isCenterAdminRole ? '/dashboard/appointments' : '/dashboard/student-reports'} className="block p-2">
            <Button variant="outline" className="w-full h-10 rounded-xl font-black text-[10px] uppercase tracking-widest border-2 hover:bg-primary hover:text-white transition-all">
              {isCenterAdminRole ? '우선 알림 전체 확인' : '모든 리포트 보기'}
            </Button>
          </Link>
        </DropdownMenuContent>
      </DropdownMenu>

      {!isCenterAdminRole && (
        <Dialog
          open={!!selectedFeedback}
          onOpenChange={(open) => {
            if (!open) {
              void markStudentNotificationAsRead(selectedFeedback);
              setSelectedFeedback(null);
            }
          }}
        >
          <DialogContent className="rounded-[2.25rem] border-none p-0 overflow-hidden shadow-2xl sm:max-w-lg">
            <div className="bg-gradient-to-br from-[#14295F] via-[#17326f] to-[#0f214d] px-7 py-6 text-white">
              <DialogHeader>
                <div className="mb-3 flex items-center gap-2">
                  <Badge className="border-none bg-white/15 text-white font-black text-[10px] tracking-[0.18em] uppercase whitespace-nowrap">
                    {selectedFeedback?.source === 'counseling_log' ? '상담일지' : '선생님 피드백'}
                  </Badge>
                </div>
                <DialogTitle className="flex items-center gap-3 text-2xl font-black tracking-tight">
                  <div className="rounded-2xl bg-white/12 p-2">
                    <MessageSquareMore className="h-5 w-5" />
                  </div>
                  {selectedFeedback?.title || '한 줄 피드백'}
                </DialogTitle>
                <DialogDescription className="text-white/75 font-semibold">
                  {selectedFeedback?.source === 'counseling_log'
                    ? `${selectedFeedback?.teacherName || '담당 선생님'} 선생님이 공유한 상담 기록입니다.`
                    : `${selectedFeedback?.teacherName || '담당 선생님'} 선생님이 남긴 코멘트입니다.`}
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
                  void markStudentNotificationAsRead(selectedFeedback);
                  setSelectedFeedback(null);
                }}
              >
                확인했어요
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {!isCenterAdminRole && (
        <Dialog
          open={!!selectedReward}
          onOpenChange={(open) => {
            if (!open) {
              void markStudentNotificationAsRead(selectedReward);
              setSelectedReward(null);
            }
          }}
        >
          <DialogContent className="rounded-[2.25rem] border-none p-0 overflow-hidden shadow-2xl sm:max-w-lg">
            <div className="bg-gradient-to-br from-[#14295F] via-[#17326f] to-[#0f214d] px-7 py-6 text-white">
              <DialogHeader>
                <div className="mb-3 flex items-center gap-2">
                  <Badge className="border-none bg-white/15 text-white font-black text-[10px] tracking-[0.18em] uppercase whitespace-nowrap">
                    랭킹 보상
                  </Badge>
                </div>
                <DialogTitle className="flex items-center gap-3 text-2xl font-black tracking-tight">
                  <div className="rounded-2xl bg-white/12 p-2">
                    <Gift className="h-5 w-5" />
                  </div>
                  {selectedReward ? `${getRankingRewardHeadline(selectedReward)} 축하` : '랭킹 보상'}
                </DialogTitle>
                <DialogDescription className="text-white/75 font-semibold">
                  {getRankingRewardContextCopy(selectedReward)}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="bg-[#fafafa] px-6 py-6">
              <div className="app-depth-card rounded-[1.65rem] px-5 py-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary/55">
                    {getRankingRewardHeadline(selectedReward)}
                </p>
                  <Badge className="border border-[#ffd9b7] bg-[#fff3e9] text-[#ff7a16] font-black">
                    +{Math.max(0, Number(selectedReward?.rankingRewardPoints || 0)).toLocaleString()}P
                  </Badge>
                </div>
                <p className="break-keep text-lg font-black leading-8 text-slate-900">
                  {selectedReward?.message || ''}
                </p>
              </div>
            </div>

            <DialogFooter className="border-t bg-white p-5">
              <Button
                className="premium-cta premium-cta-secondary h-12 w-full rounded-2xl text-base"
                onClick={() => {
                  void markStudentNotificationAsRead(selectedReward);
                  setSelectedReward(null);
                }}
              >
                확인했어요
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
