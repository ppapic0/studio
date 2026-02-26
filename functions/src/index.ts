'use server';
/**
 * @fileOverview This file contains the core Cloud Functions for the application,
 * including development utilities and user-facing actions like redeeming invite codes.
 */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { format, getISOWeek } from "date-fns";

admin.initializeApp();

const db = admin.firestore();

// Set the DEV_SECRET in your Firebase Functions config:
// firebase functions:config:set dev.secret="YOUR_SUPER_SECRET_KEY"
const DEV_SECRET = functions.config().dev?.secret;

/**
 * @description A development-only function to allow a user to join a center with a specific role.
 * It automatically creates the center with default data if it doesn't exist, making it
 * a crucial bootstrapping tool for new development environments.
 */
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

  // Add fallbacks for robustness, e.g., if token has no displayName.
  const finalDisplayName = displayName || (email ? email.split('@')[0] : "새 사용자");
  const finalEmail = email || `${uid}@example.com`;

  try {
    const centerRef = db.doc(`centers/${centerId}`);
    const batch = db.batch();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // CRITICAL FIX: Check if the center document exists. If not, create it.
    const centerDoc = await centerRef.get();
    if (!centerDoc.exists) {
        const subscriptionExpires = new Date();
        subscriptionExpires.setDate(subscriptionExpires.getDate() + 30);
        batch.set(centerRef, {
            name: `센터 ${centerId}`,
            description: "개발용으로 자동 생성된 센터입니다.",
            subscriptionTier: "Pro",
            maxStudents: 150,
            maxTeachers: 10,
            aiUsageQuotaWeekly: 1000,
            dataRetentionPeriodDays: 365,
            billingStatus: 'active',
            subscriptionExpiresAt: admin.firestore.Timestamp.fromDate(subscriptionExpires),
            createdAt: timestamp,
            updatedAt: timestamp,
        });
    }

    // 1. Create/Update User Profile for all roles
    const userProfileRef = db.doc(`users/${uid}`);
     batch.set(userProfileRef, {
      id: uid,
      displayName: finalDisplayName,
      email: finalEmail,
      createdAt: timestamp,
      updatedAt: timestamp
    }, { merge: true });

    // 2. Create the primary membership document
    const memberRef = db.doc(`centers/${centerId}/members/${uid}`);
    const memberData: any = {
      role: role,
      status: "active",
      joinedAt: timestamp,
      email: finalEmail,
      displayName: finalDisplayName,
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
      actorId: uid,
      action: "dev_join_center",
      targetId: uid,
      targetType: "CenterMembership",
      details: JSON.stringify({
        role: role,
        centerId: centerId
      }),
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

/**
 * @description Redeems an invite code, creating the necessary user profile,
 * center membership, and audit logs in a single transaction.
 * It also bootstraps the center document if it doesn't exist.
 */
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
    
    const inviteCodeRef = db.doc(`inviteCodes/${code}`);

    try {
        const result = await db.runTransaction(async (transaction) => {
            // 1. READ: Get Invite Code
            const inviteCodeDoc = await transaction.get(inviteCodeRef);
            if (!inviteCodeDoc.exists) {
                throw new functions.https.HttpsError('not-found', '존재하지 않거나 유효하지 않은 초대 코드입니다.');
            }
            
            const inviteCodeData = inviteCodeDoc.data()!;
            const centerId = inviteCodeData.centerId;

            if (!centerId) {
                throw new functions.https.HttpsError('internal', '초대 코드 정보가 올바르지 않습니다 (centerId 누락).');
            }

            // 2. READ: Get Center Doc (Bootstrap check)
            const centerRef = db.doc(`centers/${centerId}`);
            const centerDoc = await transaction.get(centerRef);

            // --- Validation ---
            if (inviteCodeData.usedCount >= inviteCodeData.maxUses) {
                throw new functions.https.HttpsError('resource-exhausted', '이 초대 코드는 이미 최대 사용 횟수에 도달했습니다.');
            }
            const now = new Date();
            if (inviteCodeData.expiresAt && inviteCodeData.expiresAt.toDate() < now) {
                throw new functions.https.HttpsError('deadline-exceeded', '만료된 초대 코드입니다.');
            }

            // --- Preparation ---
            const timestamp = admin.firestore.FieldValue.serverTimestamp();
            const role = inviteCodeData.intendedRole || 'student';
            const finalDisplayName = displayName || (email ? email.split('@')[0] : "새 사용자");
            const finalEmail = email || `${uid}@example.com`;

            // --- WRITES ---
            
            // A. Bootstrap Center if missing
            if (!centerDoc.exists) {
                const subscriptionExpires = new Date();
                subscriptionExpires.setDate(subscriptionExpires.getDate() + 30);
                transaction.set(centerRef, {
                    name: `공부트랙관리형독서실 (${centerId})`,
                    description: "초대 코드를 통해 자동 생성된 센터입니다.",
                    subscriptionTier: "Pro",
                    maxStudents: 150,
                    maxTeachers: 10,
                    aiUsageQuotaWeekly: 1000,
                    dataRetentionPeriodDays: 365,
                    billingStatus: 'active',
                    subscriptionExpiresAt: admin.firestore.Timestamp.fromDate(subscriptionExpires),
                    createdAt: timestamp,
                    updatedAt: timestamp,
                });
            }

            // B. Create/update the main user profile
            const userProfileRef = db.doc(`users/${uid}`);
            transaction.set(userProfileRef, {
                id: uid,
                displayName: finalDisplayName,
                email: finalEmail,
                createdAt: timestamp,
                updatedAt: timestamp,
            }, { merge: true });

            // C. Create the center membership document
            const memberRef = db.doc(`centers/${centerId}/members/${uid}`);
            transaction.set(memberRef, {
                role: role,
                status: "active",
                joinedAt: timestamp,
                email: finalEmail,
                displayName: finalDisplayName,
                invitedByInviteCodeId: inviteCodeDoc.id,
            });

            // D. Create the reverse-index for the user
            const userCenterRef = db.doc(`userCenters/${uid}/centers/${centerId}`);
            transaction.set(userCenterRef, {
                role: role,
                status: "active",
                joinedAt: timestamp,
            });
            
            // E. Update invite code usage
            transaction.update(inviteCodeRef, {
                usedCount: admin.firestore.FieldValue.increment(1),
                updatedAt: timestamp,
            });

            // F. Create an audit log
            const auditLogRef = db.collection(`centers/${centerId}/auditLogs`).doc();
            transaction.set(auditLogRef, {
                timestamp: timestamp,
                actorId: uid,
                action: "invite_code_redeemed",
                targetId: uid,
                targetType: 'CenterMembership',
                details: JSON.stringify({
                    inviteCode: code,
                    role: role,
                }),
            });

            return { ok: true, centerId: centerId, message: `Successfully joined center ${centerId} as ${role}.` };
        });
        
        return result;

    } catch (error: any) {
        console.error("redeemInviteCode failed:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError(
            "internal",
            error.message || "초대 코드 처리 중 서버 오류가 발생했습니다."
        );
    }
});
