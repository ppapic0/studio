
const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const region = "asia-northeast3";

exports.registerStudent = functions.region(region).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
    const { email, password, displayName, schoolName, grade, centerId } = data;
    if (!email || !password || !displayName || !schoolName || !centerId) throw new functions.https.HttpsError("invalid-argument", "필수 정보가 누락되었습니다.");
    const callerId = context.auth.uid;
    try {
        const callerMemberSnap = await db.doc(`centers/${centerId}/members/${callerId}`).get();
        if (!callerMemberSnap.exists || !['teacher', 'centerAdmin'].includes(callerMemberSnap.data()?.role)) {
            throw new functions.https.HttpsError("permission-denied", "학생을 등록할 권한이 없습니다.");
        }
        let userRecord = await admin.auth().createUser({ email, password, displayName });
        const uid = userRecord.uid;
        const timestamp = admin.firestore.Timestamp.now();
        await db.runTransaction(async (transaction) => {
            transaction.set(db.doc(`users/${uid}`), { id: uid, email, displayName, schoolName, createdAt: timestamp, updatedAt: timestamp });
            transaction.set(db.doc(`centers/${centerId}/members/${uid}`), { id: uid, centerId, role: 'student', status: "active", joinedAt: timestamp, displayName });
            transaction.set(db.doc(`userCenters/${uid}/centers/${centerId}`), { id: centerId, centerId, role: 'student', status: "active", joinedAt: timestamp });
            transaction.set(db.doc(`centers/${centerId}/students/${uid}`), { id: uid, name: displayName, schoolName, grade, seatNo: 0, targetDailyMinutes: 360, parentUids: [], createdAt: timestamp, updatedAt: timestamp });
            transaction.set(db.doc(`centers/${centerId}/growthProgress/${uid}`), { level: 1, currentXp: 0, nextLevelXp: 1000, stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 }, skills: {}, updatedAt: timestamp });
        });
        return { ok: true, uid, message: "학생 등록이 완료되었습니다." };
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError("internal", error.message);
    }
});

exports.updateStudentAccount = functions.region(region).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
    const { studentId, centerId, password, displayName, schoolName, grade, parentLinkCode } = data;
    if (!studentId || !centerId) throw new functions.https.HttpsError("invalid-argument", "학생 ID와 센터 ID가 필요합니다.");
    const callerId = context.auth.uid;
    try {
        const callerMemberSnap = await db.doc(`centers/${centerId}/members/${callerId}`).get();
        if (!callerMemberSnap.exists || !['teacher', 'centerAdmin'].includes(callerMemberSnap.data()?.role)) throw new functions.https.HttpsError("permission-denied", "정보를 수정할 권한이 없습니다.");
        if (password || displayName) {
            const authUpdates = {};
            if (password && password.length >= 6) authUpdates.password = password;
            if (displayName) authUpdates.displayName = displayName;
            await admin.auth().updateUser(studentId, authUpdates);
        }
        const timestamp = admin.firestore.Timestamp.now();
        const batch = db.batch();
        const userUpdate = { updatedAt: timestamp };
        if (displayName) userUpdate.displayName = displayName;
        if (schoolName) userUpdate.schoolName = schoolName;
        batch.set(db.doc(`users/${studentId}`), userUpdate, { merge: true });
        const studentUpdate = { updatedAt: timestamp };
        if (displayName) studentUpdate.name = displayName;
        if (schoolName) studentUpdate.schoolName = schoolName;
        if (grade) studentUpdate.grade = grade;
        if (parentLinkCode !== undefined) studentUpdate.parentLinkCode = parentLinkCode;
        batch.set(db.doc(`centers/${centerId}/students/${studentId}`), studentUpdate, { merge: true });
        if (displayName) batch.set(db.doc(`centers/${centerId}/members/${studentId}`), { displayName, updatedAt: timestamp }, { merge: true });
        await batch.commit();
        return { ok: true, message: "학생 정보가 업데이트되었습니다." };
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError("internal", error.message);
    }
});

exports.deleteStudentAccount = functions.region(region).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
    const { studentId, centerId } = data;
    const callerId = context.auth.uid;
    try {
        const callerMemberSnap = await db.doc(`centers/${centerId}/members/${callerId}`).get();
        if (!callerMemberSnap.exists || callerMemberSnap.data()?.role !== 'centerAdmin') throw new functions.https.HttpsError("permission-denied", "관리자만 가능합니다.");
        try {
            await admin.auth().deleteUser(studentId);
        } catch (e) {
            if (e.code !== 'auth/user-not-found') throw e;
        }
        const batch = db.batch();
        batch.delete(db.doc(`users/${studentId}`));
        batch.delete(db.doc(`centers/${centerId}/members/${studentId}`));
        batch.delete(db.doc(`userCenters/${studentId}/centers/${centerId}`));
        batch.delete(db.doc(`centers/${centerId}/students/${studentId}`));
        batch.delete(db.doc(`centers/${centerId}/growthProgress/${studentId}`));
        await batch.commit();
        return { ok: true, message: "계정이 영구적으로 삭제되었습니다." };
    } catch (error) {
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError("internal", error.message);
    }
});

exports.redeemInviteCode = functions.region(region).https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    const { code } = data;
    const uid = context.auth.uid;
    try {
        return await db.runTransaction(async (transaction) => {
            const inviteRef = db.doc(`inviteCodes/${code}`);
            const inviteSnap = await transaction.get(inviteRef);
            if (!inviteSnap.exists) throw new functions.https.HttpsError("not-found", "유효하지 않은 코드입니다.");
            const inviteData = inviteSnap.data();
            const timestamp = admin.firestore.Timestamp.now();
            transaction.set(db.doc(`userCenters/${uid}/centers/${inviteData.centerId}`), { id: inviteData.centerId, centerId: inviteData.centerId, role: inviteData.intendedRole || 'student', status: "active", joinedAt: timestamp });
            transaction.set(db.doc(`centers/${inviteData.centerId}/members/${uid}`), { id: uid, centerId: inviteData.centerId, role: inviteData.intendedRole || 'student', status: "active", joinedAt: timestamp, displayName: context.auth.token.name || "" });
            transaction.update(inviteRef, { usedCount: admin.firestore.FieldValue.increment(1), updatedAt: timestamp });
            return { ok: true, message: "가입 완료" };
        });
    } catch (error) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});
