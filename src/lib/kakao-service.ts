'use client';

import type { Firestore } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { initializeFirebase } from '@/firebase';

type KakaoMessageType = 'entry' | 'exit' | 'away' | 'report' | 'payment_reminder';

interface SendMessageParams {
  studentId?: string;
  studentName: string;
  parentPhone?: string;
  type: KakaoMessageType;
  customData?: Record<string, unknown>;
}

function requireStudentId(centerId: string, params: SendMessageParams) {
  const studentId = typeof params.studentId === 'string' ? params.studentId.trim() : '';
  if (!centerId || !studentId) {
    throw new Error('centerId와 studentId가 필요합니다.');
  }
  return studentId;
}

export async function sendKakaoNotification(
  _db: Firestore | null,
  centerId: string,
  params: SendMessageParams,
) {
  const { functions } = initializeFirebase();

  if (params.type === 'report') {
    const studentId = requireStudentId(centerId, params);
    const notifyDailyReportReady = httpsCallable(functions, 'notifyDailyReportReady');
    const result = await notifyDailyReportReady({
      centerId,
      studentId,
      dateKey:
        typeof params.customData?.dateKey === 'string'
          ? params.customData.dateKey
          : undefined,
    });
    return result.data;
  }

  if (params.type === 'payment_reminder') {
    const sendPaymentReminderBatch = httpsCallable(functions, 'sendPaymentReminderBatch');
    const result = await sendPaymentReminderBatch({ centerId });
    return result.data;
  }

  const studentId = requireStudentId(centerId, params);
  const notifyAttendanceSms = httpsCallable(functions, 'notifyAttendanceSms');
  const eventType =
    params.type === 'entry'
      ? 'study_start'
      : params.type === 'away'
        ? 'away_start'
        : 'study_end';

  const result = await notifyAttendanceSms({
    centerId,
    studentId,
    eventType,
  });
  return result.data;
}

export async function autoCheckPaymentReminders(
  _db: Firestore | null,
  centerId: string,
) {
  const { functions } = initializeFirebase();
  const sendPaymentReminderBatch = httpsCallable(functions, 'sendPaymentReminderBatch');
  const result = await sendPaymentReminderBatch({ centerId });
  const data = result.data as { queuedCount?: number } | undefined;
  return Number(data?.queuedCount || 0);
}
