import 'server-only';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId:
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GCLOUD_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      'studio-2815552762-86e0f',
  });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
