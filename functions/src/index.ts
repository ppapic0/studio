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
