import { NextRequest, NextResponse } from 'next/server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  // 인증 확인 — Authorization: Bearer <idToken>
  const authHeader = request.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!idToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    // 전역 marketingEntryEvents 컬렉션에서 최신 2000건 조회
    // centerId와 무관하게 모든 이벤트를 반환 (단일 테넌트 운영 기준)
    const snapshot = await adminDb
      .collection('marketingEntryEvents')
      .orderBy('createdAt', 'desc')
      .limit(2000)
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
        centerId: data.centerId ?? null,
        // Firestore Timestamp → ISO string
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error('[website-analytics] query failed', error);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
