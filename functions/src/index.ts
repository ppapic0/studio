import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { format, getISOWeek } from "date-fns";

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

    // 1. Create/Update User Profile for all roles
    const userProfileRef = db.doc(`users/${uid}`);
     batch.set(userProfileRef, {
      id: uid,
      displayName: displayName,
      email: email,
      createdAt: timestamp,
      updatedAt: timestamp
    }, { merge: true });

    // 2. Create the primary membership document
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

    // 3. Create the reverse-index for the user
    const userCenterRef = db.doc(`userCenters/${uid}/centers/${centerId}`);
    batch.set(userCenterRef, {
      role: role,
      status: "active",
      joinedAt: timestamp,
    });

    // 4. If student, seed initial data
    if (role === "student") {
      const todayKey = format(new Date(), 'yyyy-MM-dd');
      const weekKey = `${format(new Date(), 'yyyy')}-W${getISOWeek(new Date())}`;

      // Initial Daily Stat
      const dailyStatRef = db.doc(`centers/${centerId}/dailyStudentStats/${todayKey}/students/${uid}`);
      batch.set(dailyStatRef, {
        centerId: centerId,
        studentId: uid,
        dateKey: todayKey,
        todayPlanCompletionRate: 0,
        totalStudyMinutes: 0,
        attendanceStreakDays: 0,
        weeklyPlanCompletionRate: 0,
        studyTimeGrowthRate: 0,
        riskDetected: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      // Initial Study Plan Week
      const studyPlanWeekRef = db.doc(`centers/${centerId}/plans/${uid}/weeks/${weekKey}`);
      batch.set(studyPlanWeekRef, {
          centerId: centerId,
          uid: uid,
          weekKey: weekKey,
          createdAt: timestamp,
          updatedAt: timestamp,
      });

      // Initial enrollment record
      const enrollmentRef = db.collection(`centers/${centerId}/enrollments`).doc();
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3);
      batch.set(enrollmentRef, {
        centerId: centerId,
        studentId: uid,
        startAt: admin.firestore.Timestamp.fromDate(startDate),
        endAt: admin.firestore.Timestamp.fromDate(endDate),
        status: 'active',
        renewalIntent: 'N/A',
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }

    // 5. Create an audit log
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
    
    // Use the code as the document ID for a direct lookup.
    const inviteCodeRef = db.doc(`inviteCodes/${code}`);

    try {
        await db.runTransaction(async (transaction) => {
            const inviteCodeDoc = await transaction.get(inviteCodeRef);

            if (!inviteCodeDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Invalid invite code.');
            }
            
            const inviteCodeData = inviteCodeDoc.data()!;
            const centerId = inviteCodeData.centerId;

            if (!centerId) {
                throw new functions.https.HttpsError('internal', 'Invite code is missing centerId.');
            }

            if (inviteCodeData.usedCount >= inviteCodeData.maxUses) {
                throw new functions.https.HttpsError('resource-exhausted', 'This invite code has reached its maximum number of uses.');
            }

            const now = new Date();
            if (inviteCodeData.expiresAt && inviteCodeData.expiresAt.toDate() < now) {
                throw new functions.https.HttpsError('deadline-exceeded', 'This invite code has expired.');
            }

            const timestamp = admin.firestore.FieldValue.serverTimestamp();
            const role = inviteCodeData.intendedRole || 'student';

            // 1. Create/update the main user profile
            const userProfileRef = db.doc(`users/${uid}`);
            transaction.set(userProfileRef, {
                id: uid,
                displayName: displayName,
                email: email,
                createdAt: timestamp,
                updatedAt: timestamp,
            }, { merge: true });

            // 2. Create the center membership document
            const memberRef = db.doc(`centers/${centerId}/members/${uid}`);
            transaction.set(memberRef, {
                role: role,
                status: "active",
                joinedAt: timestamp,
                email,
                displayName,
                invitedByInviteCodeId: inviteCodeDoc.id,
            });

            // 3. Create the reverse-index for the user
            const userCenterRef = db.doc(`userCenters/${uid}/centers/${centerId}`);
            transaction.set(userCenterRef, {
                role: role,
                status: "active",
                joinedAt: timestamp,
            });
            
            // 4. Update invite code usage
            transaction.update(inviteCodeRef, {
                usedCount: admin.firestore.FieldValue.increment(1),
                updatedAt: timestamp,
            });

            // 5. Create an audit log
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

        const inviteCodeData = (await inviteCodeRef.get()).data();
        return { ok: true, message: `Successfully joined center ${inviteCodeData?.centerId} as ${inviteCodeData?.intendedRole}.` };

    } catch (error: any) {
        console.error("redeemInviteCode failed:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        
        let errorMessage = error.message || "Server error during invite redemption.";
        // Specific error for FAILED_PRECONDITION which can indicate a missing index, though less likely now.
        if (error.code === 'FAILED_PRECONDITION' || (error.code === 9)) {
            errorMessage = "A database index might be required. Please check the Firebase console logs for an index creation link.";
        } else if (error.code === 'PERMISSION_DENIED' || (error.code === 7)) {
            errorMessage = `Permission denied. Ensure the invite code '${code}' exists and is active.`;
        }

        throw new functions.https.HttpsError(
            "internal",
            errorMessage
        );
    }
});
    
