import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

import { adminDb } from '@/lib/firebase-admin';

const TARGET_PATHS: Record<string, string> = {
  login: '/login',
  experience: '/experience',
};

async function resolveMarketingCenterId() {
  const envCenterId = process.env.MARKETING_CENTER_ID || process.env.NEXT_PUBLIC_MARKETING_CENTER_ID;
  if (envCenterId) return envCenterId;

  const snapshot = await adminDb.collection('centers').limit(1).get();
  return snapshot.empty ? null : snapshot.docs[0]?.id ?? null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ target: string }> },
) {
  const { target } = await context.params;
  const targetPath = TARGET_PATHS[target];

  if (!targetPath) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const searchParams = request.nextUrl.searchParams;
  const placement = searchParams.get('placement') || 'unknown';
  const mode = searchParams.get('mode');
  const view = searchParams.get('view');
  const source = searchParams.get('source') || 'marketing';
  const visitorId = request.cookies.get('track_marketing_vid')?.value || null;
  const sessionId = request.cookies.get('track_marketing_sid')?.value || null;

  const destination = new URL(targetPath, request.url);
  for (const [key, value] of searchParams.entries()) {
    if (key === 'placement' || key === 'source') continue;
    destination.searchParams.set(key, value);
  }

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

  return NextResponse.redirect(destination);
}
