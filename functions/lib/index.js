"use client";
const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();
const region = "asia-northeast3";

exports.registerStudent = functions.region(region).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
    }
    const { email, password, displayName, schoolName, grade, centerId } = data;
    if (!email || !password || !displayName || !schoolName || !centerId) {
        throw new functions.https.HttpsError("invalid-argument", "필수 정보가 누락되었습니다.");
    }
    const callerId = context.auth.uid;
    try {
        const callerMemberSnap = await db.doc(`centers/${centerId}/members/${callerId}`).get();
        if (!callerMemberSnap.exists || !['teacher', 'centerAdmin'].includes(callerMemberSnap.data()?.role)) {
            throw new functions.https.HttpsError("permission-denied", "학생을 등록할 권한이 없습니다.");
        }
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName,
        });
        const uid = userRecord.uid;
        const timestamp = admin.firestore.FieldValue.serverTimestamp();
        await db.runTransaction(async (transaction) => {
            transaction.set(db.doc(`users/${uid}`), {
                id: uid,
                email,
                displayName,
                schoolName,
                createdAt: timestamp,
                updatedAt: timestamp,
            });
            transaction.set(db.doc(`centers/${centerId}/members/${uid}`), {
                role: 'student',
                status: "active",
                joinedAt: timestamp,
                displayName,
            });
            transaction.set(db.doc(`userCenters/${uid}/centers/${centerId}`), {
                role: 'student',
                status: "active",
                joinedAt: timestamp,
            });
            transaction.set(db.doc(`centers/${centerId}/students/${uid}`), {
                id: uid,
                name: displayName,
                schoolName,
                grade,
                seatNo: 0,
                targetDailyMinutes: 360,
                parentUids: [],
                createdAt: timestamp,
                updatedAt: timestamp,
            });
            transaction.set(db.doc(`centers/${centerId}/growthProgress/${uid}`), {
                level: 1,
                currentXp: 0,
                nextLevelXp: 1000,
                stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 },
                skills: {},
                updatedAt: timestamp,
            });
        });
        return { ok: true, uid, message: "학생 등록이 완료되었습니다." };
    } catch (error) {
        console.error("Register Error:", error);
        if (error instanceof functions.https.HttpsError) throw error;
        if (error.code === 'auth/email-already-exists') {
            throw new functions.https.HttpsError("already-exists", "이미 가입된 이메일 주소입니다.");
        }
        throw new functions.https.HttpsError("internal", error.message);
    }
});

exports.redeemInviteCode = functions.region(region).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    const { code } = data;
    const uid = context.auth.uid;
    const email = context.auth.token.email || "";
    const displayName = context.auth.token.name || email.split('@')[0];
    try {
        return await db.runTransaction(async (transaction) => {
            const inviteRef = db.doc(`inviteCodes/${code}`);
            const inviteSnap = await transaction.get(inviteRef);
            if (!inviteSnap.exists) throw new functions.https.HttpsError("not-found", "유효하지 않은 초대 코드입니다.");
            const inviteData = inviteSnap.data();
            const centerId = inviteData.centerId;
            const role = inviteData.intendedRole || 'student';
            const timestamp = admin.firestore.FieldValue.serverTimestamp();
            transaction.set(db.doc(`userCenters/${uid}/centers/${centerId}`), {
                role,
                status: "active",
                joinedAt: timestamp,
            });
            transaction.set(db.doc(`centers/${centerId}/members/${uid}`), {
                role,
                status: "active",
                joinedAt: timestamp,
                displayName,
            });
            transaction.update(inviteRef, {
                usedCount: admin.firestore.FieldValue.increment(1),
                updatedAt: timestamp
            });
            return { ok: true, message: "센터 가입이 완료되었습니다." };
        });
    } catch (error) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});
