'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import { useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { StudentNotification } from '@/lib/types';

export type ReportItem = {
  id: string;
  dateKey?: string;
  studentId?: string;
  status?: string;
  content?: string;
  viewedAt?: { toDate?: () => Date } | null;
  updatedAt?: { toDate?: () => Date } | null;
  createdAt?: { toDate?: () => Date } | null;
  [key: string]: unknown;
};

type NotificationsContextType = {
  reports: ReportItem[];
  feedbacks: StudentNotification[];
  latestReport: ReportItem | null;
  latestFeedback: StudentNotification | null;
  clearLatestReport: () => void;
  clearLatestFeedback: () => void;
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
  latestReport: null,
  latestFeedback: null,
  clearLatestReport: () => {},
  clearLatestFeedback: () => {},
});

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [feedbacks, setFeedbacks] = useState<StudentNotification[]>([]);
  const [latestReport, setLatestReport] = useState<ReportItem | null>(null);
  const [latestFeedback, setLatestFeedback] = useState<StudentNotification | null>(null);

  const reportsInitialLoad = useRef(true);
  const feedbacksInitialLoad = useRef(true);

  useEffect(() => {
    if (!firestore || !user || !activeMembership || activeMembership.role !== 'student') {
      setReports([]);
      setLatestReport(null);
      reportsInitialLoad.current = true;
      return;
    }

    const centerId = activeMembership.id;
    const q = query(
      collection(firestore, 'centers', centerId, 'dailyReports'),
      where('studentId', '==', user.uid),
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
  }, [firestore, user, activeMembership]);

  useEffect(() => {
    if (!firestore || !user || !activeMembership || activeMembership.role !== 'student') {
      setFeedbacks([]);
      setLatestFeedback(null);
      feedbacksInitialLoad.current = true;
      return;
    }

    const centerId = activeMembership.id;
    const q = query(
      collection(firestore, 'centers', centerId, 'studentNotifications'),
      where('studentId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedFeedbacks = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as StudentNotification))
        .filter((item) => item.type === 'one_line_feedback')
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
        if (data.type !== 'one_line_feedback') return;
        const ts = data.updatedAt?.toDate?.().getTime?.() ?? data.createdAt?.toDate?.().getTime?.() ?? 0;
        if (Date.now() - ts < 20000) {
          setLatestFeedback(data);
        }
      });
    });

    return () => unsubscribe();
  }, [firestore, user, activeMembership]);

  return (
    <NotificationsContext.Provider
      value={{
        reports,
        feedbacks,
        latestReport,
        latestFeedback,
        clearLatestReport: () => setLatestReport(null),
        clearLatestFeedback: () => setLatestFeedback(null),
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
