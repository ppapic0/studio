
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redeemInviteCode = exports.registerStudent = exports.updateStudentAccount = exports.deleteStudentAccount = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
if (admin.apps.length === 0) { admin.initializeApp(); }
const region = "asia-northeast3";

exports.deleteStudentAccount = functions.region(region).runWith({ timeoutSeconds: 540, memory: '1GB' }).https.onCall(async (data, context) => {
    const db = admin.firestore();
    const auth = admin.auth();
    if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "인증 필요");
    const { studentId, centerId } = data;
    if (!studentId || !centerId) throw new functions.https.HttpsError("invalid-argument", "ID 누락");
    try {
        try { await auth.deleteUser(studentId); } catch (e) { }
        const paths = [`users/${studentId}`, `userCenters/${studentId}`, `centers/${centerId}/members/${studentId}`, `centers/${centerId}/students/${studentId}`, `centers/${centerId}/growthProgress/${studentId}`, `centers/${centerId}/plans/${studentId}`, `centers/${centerId}/studyLogs/${studentId}`];
        const filterCols = [`centers/${centerId}/counselingReservations`, `centers/${centerId}/counselingLogs`, `centers/${centerId}/attendanceRequests`, `centers/${centerId}/dailyReports` ];
        await Promise.allSettled([
            ...paths.map(async (p) => { try { await db.recursiveDelete(db.doc(p)); } catch (e) { } }),
            ...filterCols.map(async (cp) => {
                try {
                    const q = await db.collection(cp).where('studentId', '==', studentId).get();
                    const tasks = q.docs.map(doc => db.recursiveDelete(doc.ref));
                    await Promise.all(tasks);
                } catch (e) { }
            })
        ]);
        return { ok: true, message: "정리가 완료되었습니다." };
    } catch (error) { throw new functions.https.HttpsError("internal", error.message); }
});

exports.updateStudentAccount = functions.region(region).https.onCall(async (data, context) => {
    const db = admin.firestore();
    const auth = admin.auth();
    const { studentId, centerId, password, displayName, schoolName, grade, parentLinkCode } = data;
    try {
        const authUpdates = {};
        if (password) authUpdates.password = password;
        if (displayName) authUpdates.displayName = displayName;
        if (Object.keys(authUpdates).length > 0) await auth.updateUser(studentId, authUpdates);
        const timestamp = admin.firestore.Timestamp.now();
        const batch = db.batch();
        if (displayName || schoolName) {
            const uUp = { updatedAt: timestamp };
            if (displayName) uUp.displayName = displayName;
            if (schoolName) uUp.schoolName = schoolName;
            batch.set(db.doc(`users/${studentId}`), uUp, { merge: true });
        }
        const sUp = { updatedAt: timestamp };
        if (displayName) sUp.name = displayName;
        if (schoolName) sUp.schoolName = schoolName;
        if (grade) sUp.grade = grade;
        if (parentLinkCode !== undefined) sUp.parentLinkCode = parentLinkCode;
        batch.set(db.doc(`centers/${centerId}/students/${studentId}`), sUp, { merge: true });
        if (displayName) batch.set(db.doc(`centers/${centerId}/members/${studentId}`), { displayName, updatedAt: timestamp }, { merge: true });
        await batch.commit();
        return { ok: true };
    } catch (e) { throw new functions.https.HttpsError("internal", e.message); }
});

exports.registerStudent = functions.region(region).https.onCall(async (data, context) => {
    const db = admin.firestore();
    const auth = admin.auth();
    const { email, password, displayName, schoolName, grade, centerId } = data;
    try {
        const userRecord = await auth.createUser({ email, password, displayName });
        const uid = userRecord.uid;
        const timestamp = admin.firestore.Timestamp.now();
        await db.runTransaction(async (t) => {
            t.set(db.doc(`users/${uid}`), { id: uid, email, displayName, schoolName, createdAt: timestamp, updatedAt: timestamp });
            t.set(db.doc(`centers/${centerId}/members/${uid}`), { id: uid, centerId, role: 'student', status: 'active', joinedAt: timestamp, displayName });
            t.set(db.doc(`userCenters/${uid}/centers/${centerId}`), { id: centerId, centerId, role: 'student', status: 'active', joinedAt: timestamp });
            t.set(db.doc(`centers/${centerId}/students/${uid}`), { id: uid, name: displayName, schoolName, grade, createdAt: timestamp, updatedAt: timestamp });
            t.set(db.doc(`centers/${centerId}/growthProgress/${uid}`), { seasonLp: 0, penaltyPoints: 0, stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 }, updatedAt: timestamp });
        });
        return { ok: true, uid };
    } catch (e) { throw new functions.https.HttpsError("internal", e.message); }
});

exports.redeemInviteCode = functions.region(region).https.onCall(async (data, context) => {
    const db = admin.firestore();
    const { code } = data;
    const uid = context.auth.uid;
    try {
        return await db.runTransaction(async (t) => {
            const snap = await t.get(db.doc(`inviteCodes/${code}`));
            if (!snap.exists) throw new Error("Invalid code");
            const inv = snap.data();
            const ts = admin.firestore.Timestamp.now();
            t.set(db.doc(`userCenters/${uid}/centers/${inv.centerId}`), { id: inv.centerId, role: inv.intendedRole, status: 'active', joinedAt: ts, className: inv.targetClassName || null });
            t.set(db.doc(`centers/${inv.centerId}/members/${uid}`), { id: uid, role: inv.intendedRole, status: 'active', joinedAt: ts, displayName: context.auth.token.name, className: inv.targetClassName || null });
            t.update(db.doc(`inviteCodes/${code}`), { usedCount: admin.firestore.FieldValue.increment(1), updatedAt: ts });
            return { ok: true };
        });
    } catch (e) { throw new functions.https.HttpsError("internal", e.message); }
});
