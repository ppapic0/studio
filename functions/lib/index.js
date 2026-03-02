
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redeemInviteCode = exports.deleteStudentAccount = exports.updateStudentAccount = exports.registerStudent = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
const region = "asia-northeast3";
/**
 * 선생님이 학생 계정을 직접 생성하고 센터에 등록하는 함수
 */
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
        const callerData = callerMemberSnap.data();
        if (!callerMemberSnap.exists || !['teacher', 'centerAdmin'].includes(callerData?.role)) {
            throw new functions.https.HttpsError("permission-denied", "학생을 등록할 권한이 없습니다.");
        }
        let userRecord;
        try {
            userRecord = await admin.auth().createUser({
                email,
                password,
                displayName,
            });
        }
        catch (authError) {
            if (authError.code === 'auth/email-already-exists') {
                throw new functions.https.HttpsError("already-exists", "이미 가입된 이메일 주소입니다.");
            }
            throw new functions.https.HttpsError("internal", `계정 생성 중 오류: ${authError.message}`);
        }
        const uid = userRecord.uid;
        const timestamp = admin.firestore.Timestamp.now();
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
                id: uid,
                centerId: centerId,
                role: 'student',
                status: "active",
                joinedAt: timestamp,
                displayName,
            });
            transaction.set(db.doc(`userCenters/${uid}/centers/${centerId}`), {
                id: centerId,
                centerId: centerId,
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
    }
    catch (error) {
        console.error("[RegisterStudent Error]", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError("internal", error.message || "서버 내부 오류가 발생했습니다.");
    }
});
/**
 * 학생의 계정 정보(비밀번호 등)를 업데이트하는 함수
 */
exports.updateStudentAccount = functions.region(region).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
    const { studentId, centerId, password, displayName, schoolName, grade, parentLinkCode } = data;
    if (!studentId || !centerId)
        throw new functions.https.HttpsError("invalid-argument", "학생 ID와 센터 ID가 필요합니다.");
    const callerId = context.auth.uid;
    try {
        const callerMemberSnap = await db.doc(`centers/${centerId}/members/${callerId}`).get();
        if (!callerMemberSnap.exists || !['teacher', 'centerAdmin'].includes(callerMemberSnap.data()?.role)) {
            throw new functions.https.HttpsError("permission-denied", "정보를 수정할 권한이 없습니다.");
        }
        try {
            const authUpdates = {};
            if (password && password.length >= 6)
                authUpdates.password = password;
            if (displayName)
                authUpdates.displayName = displayName;
            if (Object.keys(authUpdates).length > 0) {
                await admin.auth().updateUser(studentId, authUpdates);
            }
        }
        catch (authError) {
            throw new functions.https.HttpsError("internal", `인증 정보 수정 실패: ${authError.message}`);
        }
        const timestamp = admin.firestore.Timestamp.now();
        const batch = db.batch();
        const userRef = db.doc(`users/${studentId}`);
        const studentRef = db.doc(`centers/${centerId}/students/${studentId}`);
        const memberRef = db.doc(`centers/${centerId}/members/${studentId}`);
        const userUpdate = { updatedAt: timestamp };
        if (displayName)
            userUpdate.displayName = displayName;
        if (schoolName)
            userUpdate.schoolName = schoolName;
        batch.set(userRef, userUpdate, { merge: true });
        const studentUpdate = { updatedAt: timestamp };
        if (displayName)
            studentUpdate.name = displayName;
        if (schoolName)
            studentUpdate.schoolName = schoolName;
        if (grade)
            studentUpdate.grade = grade;
        if (parentLinkCode !== undefined)
            studentUpdate.parentLinkCode = parentLinkCode;
        batch.set(studentRef, studentUpdate, { merge: true });
        if (displayName) {
            batch.set(memberRef, { displayName, updatedAt: timestamp }, { merge: true });
        }
        await batch.commit();
        return { ok: true, message: "학생 정보가 성공적으로 업데이트되었습니다." };
    }
    catch (error) {
        console.error("[updateStudentAccount Error]", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError("internal", error.message || "데이터베이스 처리 중 오류가 발생했습니다.");
    }
});
/**
 * 학생 계정을 영구 삭제하는 함수 (관리자 전용)
 * Auth 계정이 이미 삭제된 경우에도 Firestore 데이터를 강제로 정리합니다.
 */
exports.deleteStudentAccount = functions.region(region).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "인증이 필요합니다.");
    }
    const studentId = data.studentId ? data.studentId.toString().trim() : null;
    const centerId = data.centerId ? data.centerId.toString().trim() : null;
    if (!studentId || !centerId) {
        throw new functions.https.HttpsError("invalid-argument", "학생 ID와 센터 ID가 유효하지 않습니다.");
    }
    const callerId = context.auth.uid;
    try {
        console.log(`[DeleteStudent] Request by ${callerId} to delete ${studentId} in center ${centerId}`);
        // 1. 권한 확인 (관리자만 가능)
        const callerMemberSnap = await db.doc(`centers/${centerId}/members/${callerId}`).get();
        const callerData = callerMemberSnap.data();
        if (!callerMemberSnap.exists || callerData?.role !== 'centerAdmin') {
            console.warn(`[DeleteStudent] Unauthorized attempt by ${callerId}`);
            throw new functions.https.HttpsError("permission-denied", "계정을 삭제할 권한이 없습니다. 관리자만 가능합니다.");
        }
        // 2. Auth 유저 삭제 (이미 삭제된 경우 에러를 무시하고 진행)
        try {
            await admin.auth().deleteUser(studentId);
            console.log(`[DeleteStudent] Auth user ${studentId} deleted successfully.`);
        }
        catch (authError) {
            if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-uid') {
                console.warn(`[DeleteStudent] Auth user ${studentId} missing or invalid. Proceeding with DB cleanup.`);
            }
            else {
                console.error(`[DeleteStudent] Auth deletion error:`, authError);
                throw new functions.https.HttpsError("internal", `인증 정보 삭제 실패: ${authError.message}`);
            }
        }
        // 3. Firestore 데이터 정리 (Batch 사용)
        const batch = db.batch();
        // 삭제 대상 문서 경로 정의
        const paths = [
            `users/${studentId}`,
            `centers/${centerId}/members/${studentId}`,
            `userCenters/${studentId}/centers/${centerId}`,
            `centers/${centerId}/students/${studentId}`,
            `centers/${centerId}/growthProgress/${studentId}`
        ];
        paths.forEach(path => {
            batch.delete(db.doc(path));
        });
        await batch.commit();
        console.log(`[DeleteStudent] Firestore cleanup for ${studentId} completed.`);
        return { ok: true, message: "계정 및 모든 데이터가 영구적으로 삭제되었습니다." };
    }
    catch (error) {
        console.error("[DeleteStudent Final Error]", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError("internal", error.message || "서버 내부 오류가 발생했습니다.");
    }
});
/**
 * 초대 코드 사용 및 센터 가입 함수
 */
exports.redeemInviteCode = functions.region(region).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    const { code } = data;
    const uid = context.auth.uid;
    const email = context.auth.token.email || "";
    const displayName = context.auth.token.name || email.split('@')[0];
    try {
        return await db.runTransaction(async (transaction) => {
            const inviteRef = db.doc(`inviteCodes/${code}`);
            const inviteSnap = await transaction.get(inviteRef);
            if (!inviteSnap.exists)
                throw new functions.https.HttpsError("not-found", "유효하지 않은 초대 코드입니다.");
            const inviteData = inviteSnap.data();
            if (inviteData.isActive === false) {
                throw new functions.https.HttpsError("failed-precondition", "비활성화된 초대 코드입니다.");
            }
            if (inviteData.expiresAt && inviteData.expiresAt.toDate() < new Date()) {
                throw new functions.https.HttpsError("failed-precondition", "만료된 초대 코드입니다.");
            }
            if (inviteData.usedCount >= inviteData.maxUses) {
                throw new functions.https.HttpsError("failed-precondition", "사용 횟수가 초과된 초대 코드입니다.");
            }
            const centerId = inviteData.centerId;
            const role = inviteData.intendedRole || 'student';
            const timestamp = admin.firestore.Timestamp.now();
            transaction.set(db.doc(`userCenters/${uid}/centers/${centerId}`), {
                id: centerId,
                centerId: centerId,
                role,
                status: "active",
                joinedAt: timestamp,
            });
            transaction.set(db.doc(`centers/${centerId}/members/${uid}`), {
                id: uid,
                centerId: centerId,
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
    }
    catch (error) {
        console.error("[RedeemInviteCode Error]", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError("internal", error.message);
    }
});
