import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

import { adminDb } from '@/lib/firebase-admin';
import { resolveMarketingCenterId } from '@/lib/marketing-center';

type MarketingEventPayload = {
  eventType?: 'page_view' | 'login_success';
  pageType?: 'landing' | 'experience' | 'login';
  mode?: string | null;
  view?: string | null;
  placement?: string | null;
  target?: string | null;
  visitorId?: string | null;
  sessionId?: string | null;
  pathname?: string | null;
  search?: string | null;
  extra?: Record<string, unknown>;
};


export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as MarketingEventPayload;
    const centerId = await resolveMarketingCenterId();
    const visitorId =
      payload.visitorId ||
      request.cookies.get('track_marketing_vid')?.value ||
      null;
    const sessionId =
      payload.sessionId ||
      request.cookies.get('track_marketing_sid')?.value ||
      null;

    const eventData = {
      centerId,
      eventType: payload.eventType || 'page_view',
      pageType: payload.pageType || 'landing',
      placement: payload.placement || null,
      target: payload.target || null,
      mode: payload.mode || null,
      view: payload.view || null,
      visitorId,
      sessionId,
      pathname: payload.pathname || request.nextUrl.pathname,
      search: payload.search || '',
      extra: payload.extra || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: request.headers.get('user-agent') || null,
      referer: request.headers.get('referer') || null,
    };

    await adminDb.collection('marketingEntryEvents').add(eventData);

    if (centerId) {
      await adminDb
        .collection('centers')
        .doc(centerId)
        .collection('websiteEntryEvents')
        .add(eventData);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[marketing-events][POST] failed', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
