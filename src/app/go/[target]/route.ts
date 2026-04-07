import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

import { applyIpRateLimit } from '@/lib/api-security';
import { adminDb } from '@/lib/firebase-admin';
import { resolveMarketingCenterId } from '@/lib/marketing-center';
import {
  MARKETING_OPT_OUT_COOKIE,
  MARKETING_OPT_OUT_VALUE,
  MARKETING_SESSION_COOKIE,
  MARKETING_VISITOR_COOKIE,
} from '@/lib/marketing-tracking-shared';

const TARGET_PATHS: Record<string, string> = {
  login: '/login',
  experience: '/experience',
};

async function logMarketingEntry(request: NextRequest, target: string, targetPath: string) {
  if (request.cookies.get(MARKETING_OPT_OUT_COOKIE)?.value === MARKETING_OPT_OUT_VALUE) {
    return;
  }

  const searchParams = request.nextUrl.searchParams;
  const placement = searchParams.get('placement') || 'unknown';
  const mode = searchParams.get('mode');
  const view = searchParams.get('view');
  const source = searchParams.get('source') || 'marketing';
  const visitorId = request.cookies.get(MARKETING_VISITOR_COOKIE)?.value || null;
  const sessionId = request.cookies.get(MARKETING_SESSION_COOKIE)?.value || null;

  try {
    const centerId = await resolveMarketingCenterId();
    const payload = {
      eventType: 'entry_click',
      target,
      targetPath,
      placement,
      source,
      mode: mode || null,
      view: view || null,
      visitorId,
      sessionId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: request.headers.get('user-agent') || null,
      referer: request.headers.get('referer') || null,
      pathname: request.nextUrl.pathname,
      query: request.nextUrl.search,
    };

    await adminDb.collection('marketingEntryEvents').add({ centerId, ...payload });

    if (centerId) {
      await adminDb.collection('centers').doc(centerId).collection('websiteEntryEvents').add({
        centerId,
        ...payload,
      });
    }
  } catch (error) {
    console.error('[marketing-entry][GET] failed', error);
  }
}


export async function GET(
  request: NextRequest,
  context: { params: Promise<{ target: string }> },
) {
  const { target } = await context.params;
  const targetPath = TARGET_PATHS[target];

  if (!targetPath) {
    const response = new NextResponse(null, { status: 307 });
    response.headers.set('Location', '/');
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  }

  const searchParams = request.nextUrl.searchParams;
  const destination = new URL(targetPath, 'https://track.internal');
  for (const [key, value] of searchParams.entries()) {
    if (key === 'placement' || key === 'source') continue;
    destination.searchParams.set(key, value);
  }

  const rateLimit = applyIpRateLimit(request, 'marketing:redirect', {
    max: 80,
    windowMs: 60 * 1000,
  });
  if (rateLimit.ok) {
    void logMarketingEntry(request, target, targetPath);
  }

  const relativeLocation = `${destination.pathname}${destination.search}`;
  const response = new NextResponse(null, { status: 307 });
  response.headers.set('Location', relativeLocation);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}
