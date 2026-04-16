import { NextRequest } from 'next/server';

import { noStoreJson } from '@/lib/api-security';
import { adminAuth, adminDb, isMissingAdminCredentialsError } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

function normalizeRole(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function canAccessWebsiteAnalytics(role: string) {
  return role === 'teacher' || role === 'centerAdmin' || role === 'owner' || role === 'admin' || role === 'centerManager';
}

async function getCenterRole(uid: string, centerId: string) {
  const [memberSnap, userCenterSnap] = await Promise.all([
    adminDb.doc(`centers/${centerId}/members/${uid}`).get(),
    adminDb.doc(`userCenters/${uid}/centers/${centerId}`).get(),
  ]);

  return normalizeRole(memberSnap.data()?.role || userCenterSnap.data()?.role);
}

function unavailableAnalyticsResponse() {
  return noStoreJson({
    events: [],
    unavailableReason: 'missing-admin-credentials',
  });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const centerId = request.nextUrl.searchParams.get('centerId')?.trim() || '';

  if (!idToken) {
    return noStoreJson({ error: 'unauthorized' }, { status: 401 });
  }

  if (!centerId) {
    return noStoreJson({ error: 'centerId-required' }, { status: 400 });
  }

  let uid = '';
  try {
    uid = (await adminAuth.verifyIdToken(idToken)).uid;
  } catch (error) {
    if (isMissingAdminCredentialsError(error)) {
      return unavailableAnalyticsResponse();
    }
    return noStoreJson({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const role = await getCenterRole(uid, centerId);
    if (!canAccessWebsiteAnalytics(role)) {
      return noStoreJson({ error: 'forbidden' }, { status: 403 });
    }

    const snapshot = await adminDb
      .collection(`centers/${centerId}/websiteEntryEvents`)
      .orderBy('createdAt', 'desc')
      .limit(1500)
      .get();

    const events = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        eventType: data.eventType ?? null,
        pageType: data.pageType ?? null,
        target: data.target ?? null,
        placement: data.placement ?? null,
        mode: data.mode ?? null,
        view: data.view ?? null,
        sessionId: data.sessionId ?? null,
        visitorId: data.visitorId ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    return noStoreJson({ events });
  } catch (error) {
    if (isMissingAdminCredentialsError(error)) {
      return unavailableAnalyticsResponse();
    }
    console.error('[website-analytics] query failed', error);
    return noStoreJson({ error: 'internal' }, { status: 500 });
  }
}
