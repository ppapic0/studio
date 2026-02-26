'use server';
/**
 * @fileOverview This file contains the core Cloud Functions for the application,
 * including development utilities and user-facing actions like redeeming invite codes.
 */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { format, getISOWeek } from "date-fns";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

// Set the DEV_SECRET in your Firebase Functions config:
// firebase functions:config:set dev.secret="YOUR_SUPER_SECRET_KEY"
const DEV_SECRET = functions.config().dev?.secret;

/**
 * @description A development-only function to allow a user to join a center with a specific role.
 * It automatically creates the center with default data if it doesn't exist.
 */
export const devJoinCenter = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "인증된 사용자만 호출할 수 있습니다."
    );
  }

  const { centerId, role, linkedStudentId, devSecret } = data;
  const uid = context.auth.uid;
  const { email, name: displayName } = context.auth.token;

  // --- Validation ---
  if (process.env.FUNCTIONS_EMULATOR !== 'true' && devSecret !== DEV_SECRET) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "개발용 비밀 키가 올바르지 않습니다."
    );
  }
  if (!centerId || typeof centerId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "centerId가 필요합니다.");
  }

  const finalDisplayName = displayName || (email ? email.split('@')[0] : "새 사용자");
  const finalEmail = email || `${uid}@example.com`;
  const centerName = centerId === 'learning-lab-dongbaek' ? "공부트랙 동백센터" : `센터 ${centerId}`;

  try {
    const batch = db.batch();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    // 1. Bootstrap Center if missing
    const centerRef = db.doc(`centers/${centerId}`);
    const centerDoc = await centerRef.get();
    if (!centerDoc.exists) {
        const subscriptionExpires = new Date();
        subscriptionExpires.setDate(subscriptionExpires.getDate() + 30);
        batch.set(centerRef, {
            name: centerName,
            description: "자동 생성된 센터입니다.",
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

    // 2. Create/Update User Profile
    const userProfileRef = db.doc(`users/${uid}`);
    batch.set(userProfileRef, {
      id: uid,
      displayName: finalDisplayName,
      email: finalEmail,
      createdAt: timestamp,
      updatedAt: timestamp
    }, { merge: true });

    // 3. Create Center Membership
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

    // 4. Create Reverse-Index
    const userCenterRef = db.doc(`userCenters/${uid}/centers/${centerId}`);
    batch.set(userCenterRef, {
      role: role,
      status: "active",
      joinedAt: timestamp,
    });

    // 5. Seed initial data for students
    if (role === "student") {
      const todayKey = format(new Date(), 'yyyy-MM-dd');
      const weekKey = `${format(new Date(), 'yyyy')}-W${getISOWeek(new Date())}`;

      const dailyStatRef = db.doc(`centers/${centerId}/dailyStudentStats/${todayKey}/students/${uid}`);
      batch.set(dailyStatRef, {
        centerId, studentId: uid, dateKey: todayKey,
        todayPlanCompletionRate: 0, totalStudyMinutes: 0, attendanceStreakDays: 0,
        weeklyPlanCompletionRate: 0, studyTimeGrowthRate: 0, riskDetected: false,
        createdAt: timestamp, updatedAt: timestamp,
      });

      const studyPlanWeekRef = db.doc(`centers/${centerId}/plans/${uid}/weeks/${weekKey}`);
      batch.set(studyPlanWeekRef, { centerId, uid, weekKey, createdAt: timestamp, updatedAt: timestamp });
    }

    // 6. Audit Log
    const auditLogRef = db.collection(`centers/${centerId}/auditLogs`).doc();
    batch.set(auditLogRef, {
      timestamp, actorId: uid, action: "dev_join_center",
      targetId: uid, targetType: "CenterMembership",
      details: JSON.stringify({ role, centerId })
    });

    await batch.commit();
    return { ok: true, message: `${centerName}에 ${role} 역할로 가입되었습니다.` };
  } catch (error: any) {
    console.error("devJoinCenter failed:", error);
    throw new functions.https.HttpsError("internal", error.message || "서버 오류가 발생했습니다.");
  }
});

/**
 * @description Redeems an invite code, creating all necessary documents.
 * Bootstraps the center if it doesn't exist.
 */
export const redeemInviteCode = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
    }

    const { code } = data;
    const uid = context.auth.uid;
    const { email, name: displayName } = context.auth.token;

    if (!code) throw new functions.https.HttpsError("invalid-argument", "코드가 필요합니다.");
    
    try {
        return await db.runTransaction(async (transaction) => {
            // 1. Try to find the code in the root collection (Standard)
            let inviteCodeRef = db.doc(`inviteCodes/${code}`);
            let inviteCodeDoc = await transaction.get(inviteCodeRef);

            // 2. If not found, try to find it in the Dongbaek center subcollection (Fallback for user's specific setup)
            if (!inviteCodeDoc.exists) {
                inviteCodeRef = db.doc(`centers/learning-lab-dongbaek/inviteCodes/${code}`);
                inviteCodeDoc = await transaction.get(inviteCodeRef);
            }

            if (!inviteCodeDoc.exists) {
                throw new functions.https.HttpsError('not-found', '유효하지 않은 초대 코드입니다.');
            }
            
            const inviteCodeData = inviteCodeDoc.data()!;
            const centerId = inviteCodeData.centerId || 'learning-lab-dongbaek'; // Fallback to Dongbaek if missing
            
            const centerRef = db.doc(`centers/${centerId}`);
            const centerDoc = await transaction.get(centerRef);

            // Validation
            const maxUses = inviteCodeData.maxUses || 999;
            const usedCount = inviteCodeData.usedCount || 0;
            if (usedCount >= maxUses) {
                throw new functions.https.HttpsError('resource-exhausted', '사용 횟수가 초과된 코드입니다.');
            }
            if (inviteCodeData.expiresAt && inviteCodeData.expiresAt.toDate() < new Date()) {
                throw new functions.https.HttpsError('deadline-exceeded', '만료된 코드입니다.');
            }

            const timestamp = admin.firestore.FieldValue.serverTimestamp();
            const role = inviteCodeData.intendedRole || 'student';
            const finalDisplayName = displayName || (email ? email.split('@')[0] : "새 사용자");
            const finalEmail = email || `${uid}@example.com`;
            const centerName = centerId === 'learning-lab-dongbaek' ? "공부트랙 동백센터" : `센터 (${centerId})`;

            // Bootstrapping Center if it doesn't exist
            if (!centerDoc.exists) {
                const subscriptionExpires = new Date();
                subscriptionExpires.setDate(subscriptionExpires.getDate() + 30);
                transaction.set(centerRef, {
                    name: centerName,
                    description: "초대 코드로 자동 생성된 센터입니다.",
                    subscriptionTier: "Pro",
                    maxStudents: 150, maxTeachers: 10, aiUsageQuotaWeekly: 1000,
                    dataRetentionPeriodDays: 365, billingStatus: 'active',
                    subscriptionExpiresAt: admin.firestore.Timestamp.fromDate(subscriptionExpires),
                    createdAt: timestamp, updatedAt: timestamp,
                });
            }

            // User Profile
            transaction.set(db.doc(`users/${uid}`), {
                id: uid, displayName: finalDisplayName, email: finalEmail,
                createdAt: timestamp, updatedAt: timestamp,
            }, { merge: true });

            // Membership
            transaction.set(db.doc(`centers/${centerId}/members/${uid}`), {
                role, status: "active", joinedAt: timestamp,
                email: finalEmail, displayName: finalDisplayName,
                invitedByInviteCodeId: inviteCodeDoc.id,
            });

            // Reverse Index
            transaction.set(db.doc(`userCenters/${uid}/centers/${centerId}`), {
                role, status: "active", joinedAt: timestamp,
            });
            
            // Usage Update
            transaction.update(inviteCodeRef, {
                usedCount: admin.firestore.FieldValue.increment(1),
                updatedAt: timestamp,
            });

            // Audit
            transaction.set(db.collection(`centers/${centerId}/auditLogs`).doc(), {
                timestamp, actorId: uid, action: "invite_code_redeemed",
                targetId: uid, targetType: 'CenterMembership',
                details: JSON.stringify({ inviteCode: code, role })
            });

            return { ok: true, centerId, message: `${centerName} 가입 성공!` };
        });
    } catch (error: any) {
        console.error("redeemInviteCode failed:", error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError("internal", error.message || "서버 처리 중 오류가 발생했습니다.");
    }
});
