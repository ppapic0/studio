import 'server-only';
import * as admin from 'firebase-admin';

function resolveServiceAccountCredential() {
  const rawJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
      ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
      : '');

  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as admin.ServiceAccount;
      if (parsed.clientEmail && parsed.privateKey) {
        return admin.credential.cert({
          ...parsed,
          privateKey: parsed.privateKey.replace(/\\n/g, '\n'),
        });
      }
    } catch {
      // Fallback to explicit env vars below.
    }
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKeyBase64 = process.env.FIREBASE_PRIVATE_KEY_BASE64?.trim();
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY?.trim();
  const privateKey = privateKeyBase64
    ? Buffer.from(privateKeyBase64, 'base64').toString('utf8')
    : privateKeyRaw?.replace(/\\n/g, '\n');

  if (clientEmail && privateKey) {
    return admin.credential.cert({
      projectId:
        process.env.FIREBASE_PROJECT_ID ||
        process.env.GCLOUD_PROJECT ||
        process.env.GOOGLE_CLOUD_PROJECT ||
        'studio-2815552762-86e0f',
      clientEmail,
      privateKey,
    });
  }

  return undefined;
}

if (!admin.apps.length) {
  const credential = resolveServiceAccountCredential();
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    'studio-2815552762-86e0f';

  admin.initializeApp(
    credential
      ? {
          credential,
          projectId,
        }
      : {
          projectId,
        }
  );
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();

export function isMissingAdminCredentialsError(error: unknown) {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes('could not load the default credentials') ||
    normalized.includes('application default credentials') ||
    normalized.includes('default credentials are not available')
  );
}
