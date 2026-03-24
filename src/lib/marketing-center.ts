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
  } catch {
    // Marketing pages should fail closed without noisy logs when credentials are unavailable.
    cachedCenterId = null;
  }

  return cachedCenterId;
}
