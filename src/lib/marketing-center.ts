import { adminDb } from '@/lib/firebase-admin';

let cachedCenterId: string | null | undefined = undefined;

/**
 * Resolves the centerId for marketing tracking.
 * Priority: MARKETING_CENTER_ID env var > NEXT_PUBLIC_MARKETING_CENTER_ID env var > first center in DB.
 * Result is cached in-process to avoid repeated Firestore reads.
 */
export async function resolveMarketingCenterId(): Promise<string | null> {
  const envCenterId =
    process.env.MARKETING_CENTER_ID || process.env.NEXT_PUBLIC_MARKETING_CENTER_ID;
  if (envCenterId) return envCenterId;

  if (cachedCenterId !== undefined) return cachedCenterId;

  try {
    const snapshot = await adminDb.collection('centers').limit(1).get();
    cachedCenterId = snapshot.empty ? null : (snapshot.docs[0]?.id ?? null);
  } catch (error) {
    console.error('[marketing-center] failed to resolve centerId:', error);
    cachedCenterId = null;
  }

  if (!cachedCenterId) {
    console.warn(
      '[marketing-center] MARKETING_CENTER_ID env var is not set and no centers found in DB. ' +
        'Set MARKETING_CENTER_ID to the correct center document ID to enable marketing tracking.',
    );
  }

  return cachedCenterId;
}
