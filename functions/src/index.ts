import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

// Set the DEV_SECRET in your Firebase Functions config:
// firebase functions:config:set dev.secret="YOUR_SUPER_SECRET_KEY"
const DEV_SECRET = functions.config().dev?.secret;

export const devJoinCenter = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const { centerId, role, linkedStudentId, devSecret } = data;
  const uid = context.auth.uid;
  const { email, name: displayName } = context.auth.token;

  // --- Validation ---
  if (process.env.FUNCTIONS_EMULATOR !== 'true' && devSecret !== DEV_SECRET) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Invalid DEV_SECRET. Access denied."
    );
  }
  if (!centerId || typeof centerId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "centerId is required.");
  }
  const allowedRoles = ["student", "teacher", "parent", "centerAdmin"];
  if (!role || !allowedRoles.includes(role)) {
    throw new functions.https.HttpsError("invalid-argument", `Invalid role. Must be one of: ${allowedRoles.join(", ")}`);
  }

  try {
    const batch = db.batch();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // 1. Create the primary membership document
    const memberRef = db.doc(`centers/${centerId}/members/${uid}`);
    const memberData: any = {
      role: role,
      status: "active",
      joinedAt: timestamp,
      email,
      displayName,
    };
    if (role === "parent" && linkedStudentId) {
      memberData.linkedStudentIds = [linkedStudentId];
    }
    batch.set(memberRef, memberData);

    // 2. Create the reverse-index for the user
    const userCenterRef = db.doc(`userCenters/${uid}/centers/${centerId}`);
    batch.set(userCenterRef, {
      role: role,
      status: "active",
      joinedAt: timestamp,
    });

    // 3. If student, create a student profile
    if (role === "student") {
      const studentRef = db.doc(`centers/${centerId}/students/${uid}`);
      batch.set(studentRef, {
        uid: uid,
        displayName: displayName,
        email: email,
        createdAt: timestamp,
      }, { merge: true });
    }

    // 4. Create an audit log
    const auditLogRef = db.collection(`centers/${centerId}/auditLogs`).doc();
    batch.set(auditLogRef, {
      timestamp: timestamp,
      actorUid: uid,
      action: "dev_join_center",
      details: {
        targetUid: uid,
        role: role,
      },
    });

    await batch.commit();

    return { ok: true, message: `Successfully joined center ${centerId} as ${role}.` };
  } catch (error: any) {
    console.error("devJoinCenter failed:", error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Server error during join process."
    );
  }
});


export const redeemInviteCode = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "The function must be called while authenticated."
        );
    }

    const { code } = data;
    const uid = context.auth.uid;
    const { email, name: displayName } = context.auth.token;

    if (!code || typeof code !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "A valid invite code is required.");
    }

    const inviteCodeQuery = db.collectionGroup('inviteCodes').where('code', '==', code).limit(1);

    try {
        const inviteCodeSnapshot = await inviteCodeQuery.get();

        if (inviteCodeSnapshot.empty) {
            throw new functions.https.HttpsError('not-found', 'Invalid invite code.');
        }

        const inviteCodeDoc = inviteCodeSnapshot.docs[0];
        const inviteCodeData = inviteCodeDoc.data();
        const centerId = inviteCodeData.centerId;

        if (!centerId) {
            throw new functions.https.HttpsError('internal', 'Invite code is missing centerId.');
        }

        await db.runTransaction(async (transaction) => {
            const freshInviteCodeDoc = await transaction.get(inviteCodeDoc.ref);
            const freshInviteCodeData = freshInviteCodeDoc.data();

            if (!freshInviteCodeData) {
                throw new functions.https.HttpsError('not-found', 'Invite code no longer exists.');
            }

            if (freshInviteCodeData.usedCount >= freshInviteCodeData.maxUses) {
                throw new functions.https.HttpsError('resource-exhausted', 'This invite code has reached its maximum number of uses.');
            }

            const now = new Date();
            // FIX: Convert Firestore Timestamp to JS Date for comparison
            if (freshInviteCodeData.expiresAt && freshInviteCodeData.expiresAt.toDate() < now) {
                throw new functions.https.HttpsError('deadline-exceeded', 'This invite code has expired.');
            }

            const timestamp = admin.firestore.FieldValue.serverTimestamp();
            const role = freshInviteCodeData.intendedRole || 'student';

            const memberRef = db.doc(`centers/${centerId}/members/${uid}`);
            transaction.set(memberRef, {
                role: role,
                status: "active",
                joinedAt: timestamp,
                email,
                displayName,
                invitedByInviteCodeId: freshInviteCodeDoc.id,
            });

            const userCenterRef = db.doc(`userCenters/${uid}/centers/${centerId}`);
            transaction.set(userCenterRef, {
                role: role,
                status: "active",
                joinedAt: timestamp,
            });

            if (role === "student") {
                const studentRef = db.doc(`centers/${centerId}/students/${uid}`);
                transaction.set(studentRef, {
                    uid: uid,
                    displayName: displayName,
                    email: email,
                    createdAt: timestamp,
                }, { merge: true });
            }
            
            transaction.update(inviteCodeDoc.ref, {
                usedCount: admin.firestore.FieldValue.increment(1),
                updatedAt: timestamp,
            });

            const auditLogRef = db.collection(`centers/${centerId}/auditLogs`).doc();
            transaction.set(auditLogRef, {
                timestamp: timestamp,
                actorId: uid,
                action: "invite_code_redeemed",
                targetId: uid,
                targetType: 'CenterMembership',
                details: {
                    inviteCode: code,
                    role: role,
                },
            });
        });

        return { ok: true, message: `Successfully joined center ${centerId} as ${inviteCodeData.intendedRole}.` };

    } catch (error: any) {
        console.error("redeemInviteCode failed:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        // Firestore security rule errors (like missing index) often manifest as 'INTERNAL' here.
        let errorMessage = error.message || "Server error during invite redemption.";
        if (error.code === 9) { // PERMISSION_DENIED from index error
            errorMessage = "A database index is required for this operation. Please check the Firebase console logs for a link to create it.";
        }

        throw new functions.https.HttpsError(
            "internal",
            errorMessage
        );
    }
});
