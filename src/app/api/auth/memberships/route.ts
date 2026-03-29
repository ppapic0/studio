import * as admin from 'firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MembershipPayload = {
  id: string;
  role?: string;
  status?: string;
  displayName?: string;
  className?: string;
  phoneNumber?: string;
  linkedStudentIds?: string[];
  joinedAtMs?: number | null;
};

function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items.length > 0 ? items : undefined;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!idToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let decodedToken: admin.auth.DecodedIdToken;

  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const uid = decodedToken.uid;
    const membershipsSnap = await adminDb.collectionGroup('members').where('id', '==', uid).get();

    const memberships: MembershipPayload[] = [];

    membershipsSnap.docs.forEach((docSnap) => {
      const centerId = docSnap.ref.parent.parent?.id;
      if (!centerId) return;

      const data = docSnap.data() as Record<string, unknown>;
      const joinedAt = data.joinedAt as admin.firestore.Timestamp | undefined;

      memberships.push({
        id: centerId,
        role: normalizeString(data.role),
        status: normalizeString(data.status),
        displayName: normalizeString(data.displayName),
        className: normalizeString(data.className),
        phoneNumber: normalizeString(data.phoneNumber),
        linkedStudentIds: normalizeStringArray(data.linkedStudentIds),
        joinedAtMs: joinedAt?.toMillis?.() ?? null,
      });
    });

    if (memberships.length > 0) {
      const batch = adminDb.batch();
      const updatedAt = admin.firestore.FieldValue.serverTimestamp();

      memberships.forEach((membership) => {
        const payload: Record<string, unknown> = {
          id: membership.id,
          centerId: membership.id,
          updatedAt,
        };

        if (membership.role) payload.role = membership.role;
        if (membership.status) payload.status = membership.status;
        if (membership.displayName) payload.displayName = membership.displayName;
        if (membership.className) payload.className = membership.className;
        if (membership.phoneNumber) payload.phoneNumber = membership.phoneNumber;
        if (membership.linkedStudentIds) payload.linkedStudentIds = membership.linkedStudentIds;

        const sourceDoc = membershipsSnap.docs.find((docSnap) => docSnap.ref.parent.parent?.id === membership.id);
        const sourceJoinedAt = sourceDoc?.data()?.joinedAt;
        if (sourceJoinedAt) {
          payload.joinedAt = sourceJoinedAt;
        }

        batch.set(adminDb.doc(`userCenters/${uid}/centers/${membership.id}`), payload, { merge: true });
      });

      await batch.commit();
    }

    return NextResponse.json({ memberships });
  } catch (error) {
    console.error('[auth/memberships] recovery failed', error);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
