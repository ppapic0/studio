'use server';

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * 초기 데이터 시딩용 함수 (관리자용)
 */
export async function seedInitialData(uid: string, centerId: string) {
  const batch = adminDb.batch();
  batch.set(adminDb.doc('inviteCodes/0313'), { centerId: 'learning-lab-dongbaek', intendedRole: 'student', maxUses: 999, usedCount: 0, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.set(adminDb.doc('inviteCodes/T0313'), { centerId: 'learning-lab-dongbaek', intendedRole: 'teacher', maxUses: 999, usedCount: 0, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
  return { ok: true };
}
