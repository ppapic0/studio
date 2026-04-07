import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { z } from 'zod';

import {
  applyIpRateLimit,
  forbiddenJson,
  hasTrustedBrowserContext,
  noStoreJson,
  tooManyRequestsJson,
} from '@/lib/api-security';
import { adminDb } from '@/lib/firebase-admin';
import { resolveMarketingCenterId } from '@/lib/marketing-center';

type MarketingEventPayload = {
  eventType?: 'page_view' | 'login_success';
  pageType?: 'landing' | 'experience' | 'login' | 'center' | 'results';
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

const marketingEventSchema = z.object({
  eventType: z.enum(['page_view', 'login_success']).optional(),
  pageType: z.enum(['landing', 'experience', 'login', 'center', 'results']).optional(),
  mode: z.string().trim().max(40).nullable().optional(),
  view: z.string().trim().max(40).nullable().optional(),
  placement: z.string().trim().max(80).nullable().optional(),
  target: z.string().trim().max(40).nullable().optional(),
  visitorId: z.string().trim().max(120).nullable().optional(),
  sessionId: z.string().trim().max(120).nullable().optional(),
  pathname: z.string().trim().max(240).nullable().optional(),
  search: z.string().trim().max(400).nullable().optional(),
  extra: z.record(
    z.string(),
    z.union([z.string().max(160), z.number(), z.boolean(), z.null()]),
  ).optional(),
});

export const dynamic = 'force-dynamic';

function normalizeTrackedPathname(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith('/')) return fallback;
  return value.slice(0, 240);
}

export async function POST(request: NextRequest) {
  const rateLimit = applyIpRateLimit(request, 'marketing-events:create', {
    max: 240,
    windowMs: 5 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return tooManyRequestsJson(rateLimit.retryAfterSeconds, '이벤트 수집 요청이 너무 많습니다.');
  }

  if (!hasTrustedBrowserContext(request)) {
    return forbiddenJson('허용되지 않은 이벤트 수집 경로입니다.');
  }

  try {
    const payload = marketingEventSchema.parse((await request.json()) as MarketingEventPayload);
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
      pathname: normalizeTrackedPathname(payload.pathname, request.nextUrl.pathname),
      search: (payload.search || '').slice(0, 400),
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

    return noStoreJson({ ok: true });
  } catch (error) {
    console.error('[marketing-events][POST] failed', error);
    return noStoreJson({ ok: false }, { status: 500 });
  }
}
