'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import { useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { DailyReport, StudentNotification } from '@/lib/types';

export type ReportItem = {
  id: string;
  dateKey?: string;
  studentId?: string;
  studentName?: string;
  status?: string;
  content?: string;
  aiMeta?: DailyReport['aiMeta'] | null;
  viewedAt?: { toDate?: () => Date } | null;
  viewedByUid?: string;
  viewedByName?: string;
  updatedAt?: { toDate?: () => Date } | null;
  createdAt?: { toDate?: () => Date } | null;
  [key: string]: unknown;
};

type NotificationsContextType = {
  reports: ReportItem[];
  feedbacks: StudentNotification[];
  rankingRewards: StudentNotification[];
  latestReport: ReportItem | null;
  latestFeedback: StudentNotification | null;
  latestRankingReward: StudentNotification | null;
  clearLatestReport: () => void;
  clearLatestFeedback: () => void;
  clearLatestRankingReward: () => void;
};

function toMillis(value?: { toDate?: () => Date } | null): number {
  try {
    return value?.toDate?.().getTime?.() ?? 0;
  } catch {
    return 0;
  }
}

const NotificationsContext = createContext<NotificationsContextType>({
  reports: [],
  feedbacks: [],
  rankingRewards: [],
  latestReport: null,
  latestFeedback: null,
  latestRankingReward: null,
  clearLatestReport: () => {},
  clearLatestFeedback: () => {},
  clearLatestRankingReward: () => {},
});

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, activeStudentId } = useAppContext();
  const authUid = user?.uid || null;
  const studentUid = activeStudentId || authUid || null;

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<StudentNotification[]>([]);
  const [rankingRewards, setRankingRewards] = useState<StudentNotification[]>([]);
  const [latestReport, setLatestReport] = useState<ReportItem | null>(null);
  const [latestFeedback, setLatestFeedback] = useState<StudentNotification | null>(null);
  const [latestRankingReward, setLatestRankingReward] = useState<StudentNotification | null>(null);

  const reportsInitialLoad = useRef(true);
  const feedbacksInitialLoad = useRef(true);
  const rankingRewardsInitialLoad = useRef(true);

  useEffect(() => {
    if (!firestore || !user || !activeMembership || activeMembership.role !== 'student' || !studentUid) {
      setReports([]);
      setLatestReport(null);
      reportsInitialLoad.current = true;
      return;
    }

    const centerId = activeMembership.id;
    const q = query(
      collection(firestore, 'centers', centerId, 'dailyReports'),
      where('studentId', '==', studentUid),
      where('status', '==', 'sent')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReports = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as ReportItem))
        .sort((a, b) =>
          Math.max(toMillis(b.updatedAt), toMillis(b.createdAt)) -
          Math.max(toMillis(a.updatedAt), toMillis(a.createdAt))
        )
        .slice(0, 10);
      setReports(fetchedReports);

      if (reportsInitialLoad.current) {
        reportsInitialLoad.current = false;
        return;
      }

      const now = Date.now();
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added' && change.type !== 'modified') return;
        const data = { id: change.doc.id, ...change.doc.data() } as ReportItem;
        const ts = toMillis(data.updatedAt) || toMillis(data.createdAt);
        if (now - ts < 20000) {
          setLatestReport(data);
        }
      });
    });

    return () => unsubscribe();
  }, [firestore, studentUid, user?.uid, activeMembership?.id, activeMembership?.role]);

  useEffect(() => {
    if (!firestore || !user || !activeMembership || activeMembership.role !== 'student' || !studentUid) {
      setFeedbacks([]);
      setLatestFeedback(null);
      feedbacksInitialLoad.current = true;
      return;
    }

    const centerId = activeMembership.id;
    const q = query(
      collection(firestore, 'centers', centerId, 'studentNotifications'),
      where('studentId', '==', studentUid),
      where('type', '==', 'one_line_feedback')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedFeedbacks = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as StudentNotification))
        .sort((a, b) =>
          Math.max(toMillis(b.updatedAt), toMillis(b.createdAt)) -
          Math.max(toMillis(a.updatedAt), toMillis(a.createdAt))
        )
        .slice(0, 10);
      setFeedbacks(fetchedFeedbacks);

      if (feedbacksInitialLoad.current) {
        feedbacksInitialLoad.current = false;
        return;
      }

      const now = Date.now();
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added' && change.type !== 'modified') return;
        const data = { id: change.doc.id, ...change.doc.data() } as StudentNotification;
        const ts = data.updatedAt?.toDate?.().getTime?.() ?? data.createdAt?.toDate?.().getTime?.() ?? 0;
        if (Date.now() - ts < 20000) {
          setLatestFeedback(data);
        }
      });
    });

    return () => unsubscribe();
  }, [firestore, studentUid, user?.uid, activeMembership?.id, activeMembership?.role]);

  useEffect(() => {
    if (!firestore || !user || !activeMembership || activeMembership.role !== 'student' || !studentUid) {
      setRankingRewards([]);
      setLatestRankingReward(null);
      rankingRewardsInitialLoad.current = true;
      return;
    }

    const centerId = activeMembership.id;
    const q = query(
      collection(firestore, 'centers', centerId, 'studentNotifications'),
      where('studentId', '==', studentUid),
      where('type', '==', 'ranking_reward')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRewards = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as StudentNotification))
        .sort((a, b) =>
          Math.max(toMillis(b.updatedAt), toMillis(b.createdAt)) -
          Math.max(toMillis(a.updatedAt), toMillis(a.createdAt))
        )
        .slice(0, 10);
      setRankingRewards(fetchedRewards);

      const latestUnreadReward = fetchedRewards.find((item) => !item.readAt) || null;

      if (rankingRewardsInitialLoad.current) {
        rankingRewardsInitialLoad.current = false;
        if (latestUnreadReward) {
          setLatestRankingReward(latestUnreadReward);
        }
        return;
      }

      const now = Date.now();
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added' && change.type !== 'modified') return;
        const data = { id: change.doc.id, ...change.doc.data() } as StudentNotification;
        const ts = data.updatedAt?.toDate?.().getTime?.() ?? data.createdAt?.toDate?.().getTime?.() ?? 0;
        if (!data.readAt && now - ts < 20000) {
          setLatestRankingReward(data);
        }
      });
    });

    return () => unsubscribe();
  }, [firestore, studentUid, user?.uid, activeMembership?.id, activeMembership?.role]);

  return (
    <NotificationsContext.Provider
      value={{
        reports,
        feedbacks,
        rankingRewards,
        latestReport,
        latestFeedback,
        latestRankingReward,
        clearLatestReport: () => setLatestReport(null),
        clearLatestFeedback: () => setLatestFeedback(null),
        clearLatestRankingReward: () => setLatestRankingReward(null),
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
