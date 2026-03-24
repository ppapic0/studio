import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

import { adminDb } from '@/lib/firebase-admin';
import { resolveMarketingCenterId } from '@/lib/marketing-center';

const TARGET_PATHS: Record<string, string> = {
  login: '/login',
  experience: '/experience',
};

function resolvePublicOrigin(request: NextRequest) {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host');

  if (host) {
    return `${forwardedProto || 'https'}://${host}`;
  }

  return request.nextUrl.origin;
}

async function logMarketingEntry(request: NextRequest, target: string, targetPath: string) {
  const searchParams = request.nextUrl.searchParams;
  const placement = searchParams.get('placement') || 'unknown';
  const mode = searchParams.get('mode');
  const view = searchParams.get('view');
  const source = searchParams.get('source') || 'marketing';
  const visitorId = request.cookies.get('track_marketing_vid')?.value || null;
  const sessionId = request.cookies.get('track_marketing_sid')?.value || null;

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
  const publicOrigin = resolvePublicOrigin(request);

  if (!targetPath) {
    return NextResponse.redirect(new URL('/', publicOrigin));
  }

  const searchParams = request.nextUrl.searchParams;

  const destination = new URL(targetPath, publicOrigin);
  for (const [key, value] of searchParams.entries()) {
    if (key === 'placement' || key === 'source') continue;
    destination.searchParams.set(key, value);
  }

  void logMarketingEntry(request, target, targetPath);

  return NextResponse.redirect(destination);
}
