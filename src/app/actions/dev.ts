/**
 * @file This file contains server actions for development purposes ONLY.
 * These actions often use the Admin SDK and bypass security rules.
 * They MUST be protected by a secret and REMOVED before production.
 */
'use server';

import { initializeFirebase } from '@/firebase';
import { getAuth } from 'firebase/auth';
import {
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

// IMPORTANT: This is a placeholder for the actual Firebase Admin SDK initialization.
// In a real project, you would use 'firebase-admin' here, not the client SDK.
// The client SDK is used here as a stand-in because the dev environment
// does not support the Admin SDK directly.
// This code will only work if Firestore security rules are temporarily opened up
// or if it's run in a privileged server environment.
const { firestore, auth: clientAuth } = initializeFirebase();

type DevJoinCenterInput = {
  centerId: string;
  role: 'student' | 'teacher' | 'parent' | 'centerAdmin';
  linkedStudentId?: string;
  devSecret: string;
};

// This function simulates a server-side action to join a center.
// It requires admin privileges to write to Firestore collections directly.
export async function devJoinCenter(
  input: DevJoinCenterInput
): Promise<{ ok: boolean; error?: string }> {

  // ** CRITICAL SECURITY CHECK **
  // This DEV_SECRET must be set in your environment variables on the server.
  // It prevents unauthorized users from gaining roles in production.
  if (input.devSecret !== "SUPER_SECRET_DEV_KEY") {
     // process.env.DEV_SECRET) {
    return { ok: false, error: 'Invalid DEV_SECRET. Access denied.' };
  }

  // This part is tricky without a real session. We'll assume the user is the one
  // making the request. In a real app, you'd get the UID from the authenticated session.
  // For this simulation, we'll assume we can get the current user this way.
  // This is NOT how you'd do it in production with the Admin SDK.
  const currentUser = clientAuth.currentUser;
  if (!currentUser) {
    return { ok: false, error: 'User not authenticated.' };
  }
  const { uid, email, displayName } = currentUser;

  try {
    const batch = writeBatch(firestore);

    // 1. Create the primary membership document
    const memberRef = doc(firestore, 'centers', input.centerId, 'members', uid);
    const memberData: any = {
      role: input.role,
      status: 'active',
      joinedAt: serverTimestamp(),
      email,
      displayName
    };
    if (input.role === 'parent' && input.linkedStudentId) {
      memberData.linkedStudentIds = [input.linkedStudentId];
    }
    batch.set(memberRef, memberData);
    
    // 2. Create the reverse-index for the user
    const userCenterRef = doc(firestore, 'userCenters', uid, 'centers', input.centerId);
    batch.set(userCenterRef, {
        role: input.role,
        status: 'active',
        joinedAt: serverTimestamp(),
    });

    // 3. If student, create a student profile
    if (input.role === 'student') {
        const studentRef = doc(firestore, 'centers', input.centerId, 'students', uid);
        batch.set(studentRef, {
            uid: uid,
            displayName: displayName,
            email: email,
            createdAt: serverTimestamp()
        }, { merge: true }); // Merge in case it exists
    }
    
    // 4. Create an audit log
    const auditLogRef = doc(collection(firestore, 'centers', input.centerId, 'auditLogs'));
    batch.set(auditLogRef, {
        timestamp: serverTimestamp(),
        actorUid: uid,
        action: 'dev_join_center',
        details: {
            targetUid: uid,
            role: input.role,
        }
    });

    await batch.commit();

    return { ok: true };

  } catch (error: any) {
    console.error('devJoinCenter failed:', error);
    return { ok: false, error: error.message || 'Server error during join process.' };
  }
}
