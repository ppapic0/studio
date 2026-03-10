"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendScheduledLateArrivalAlerts = exports.runLateArrivalCheck = exports.notifyAttendanceSms = exports.completeSignupWithInvite = exports.redeemInviteCode = exports.registerStudent = exports.updateStudentAccount = exports.deleteStudentAccount = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const region = "asia-northeast3";
const allowedRoles = ["student", "teacher", "parent", "centerAdmin"];
const adminRoles = new Set(["centerAdmin", "owner"]);
const DEFAULT_SMS_TEMPLATES = {
    check_in: "{studentName}학생이 {time}에 등원했습니다.",
    check_out: "{studentName}학생이 {time}에 하원했습니다.",
    late_alert: "{studentName}학생이 {expectedTime}까지 등원하지 않았습니다.",
};
function normalizePhoneNumber(raw) {
    if (typeof raw !== "string" && typeof raw !== "number")
        return "";
    const digits = String(raw).replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("01"))
        return digits;
    if (digits.length === 10 && digits.startsWith("01"))
        return digits;
    return "";
}
function toKstDate(baseDate = new Date()) {
    const formatted = baseDate.toLocaleString("en-US", { timeZone: "Asia/Seoul" });
    return new Date(formatted);
}
function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function toTimeLabel(date) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
}
function parseHourMinute(value) {
    if (typeof value !== "string")
        return null;
    const normalized = value.trim();
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized))
        return null;
    const [hour, minute] = normalized.split(":").map((part) => Number(part));
    return { hour, minute };
}
function normalizeMembershipStatus(value) {
    if (typeof value !== "string")
        return "";
    return value.trim().toLowerCase();
}
function isActiveMembershipStatus(value) {
    const normalized = normalizeMembershipStatus(value);
    return !normalized || normalized === "active";
}
function toMillisSafe(value) {
    if (!value)
        return 0;
    if (value instanceof Date) {
        return Number.isFinite(value.getTime()) ? value.getTime() : 0;
    }
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === "string") {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    if (typeof value === "object" && value !== null) {
        const maybeTs = value;
        if (typeof maybeTs.toMillis === "function") {
            const millis = maybeTs.toMillis();
            return Number.isFinite(millis) ? millis : 0;
        }
    }
    return 0;
}
function applyTemplate(template, values) {
    return Object.entries(values).reduce((acc, [key, value]) => {
        return acc.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }, template);
}
async function loadNotificationSettings(db, centerId) {
    const settingsSnap = await db.doc(`centers/${centerId}/settings/notifications`).get();
    if (!settingsSnap.exists)
        return {};
    return (settingsSnap.data() || {});
}
async function collectParentRecipients(db, centerId, studentId) {
    var _a;
    const studentSnap = await db.doc(`centers/${centerId}/students/${studentId}`).get();
    if (!studentSnap.exists)
        return [];
    const parentUidsRaw = (_a = studentSnap.data()) === null || _a === void 0 ? void 0 : _a.parentUids;
    const parentUids = Array.isArray(parentUidsRaw)
        ? parentUidsRaw.filter((uid) => typeof uid === "string" && uid.trim().length > 0)
        : [];
    if (parentUids.length === 0)
        return [];
    const recipients = [];
    const usedPhones = new Set();
    for (const parentUid of parentUids) {
        const [userSnap, memberSnap] = await Promise.all([
            db.doc(`users/${parentUid}`).get(),
            db.doc(`centers/${centerId}/members/${parentUid}`).get(),
        ]);
        const userData = userSnap.exists ? userSnap.data() : null;
        const memberData = memberSnap.exists ? memberSnap.data() : null;
        const phoneNumber = normalizePhoneNumber((userData === null || userData === void 0 ? void 0 : userData.phoneNumber) || (memberData === null || memberData === void 0 ? void 0 : memberData.phoneNumber));
        if (!phoneNumber || usedPhones.has(phoneNumber))
            continue;
        recipients.push({
            parentUid,
            parentName: (memberData === null || memberData === void 0 ? void 0 : memberData.displayName) || (userData === null || userData === void 0 ? void 0 : userData.displayName) || null,
            phoneNumber,
        });
        usedPhones.add(phoneNumber);
    }
    return recipients;
}
async function queueParentSmsNotification(db, params) {
    const { centerId, studentId, studentName, eventType, eventAt, expectedTime, } = params;
    const settings = params.settings || await loadNotificationSettings(db, centerId);
    const recipients = await collectParentRecipients(db, centerId, studentId);
    if (recipients.length === 0) {
        return { queuedCount: 0, recipientCount: 0, message: "" };
    }
    const template = (() => {
        if (eventType === "check_in")
            return settings.smsTemplateCheckIn || DEFAULT_SMS_TEMPLATES.check_in;
        if (eventType === "check_out")
            return settings.smsTemplateCheckOut || DEFAULT_SMS_TEMPLATES.check_out;
        return settings.smsTemplateLateAlert || DEFAULT_SMS_TEMPLATES.late_alert;
    })();
    const eventTimeLabel = toTimeLabel(eventAt);
    const expectedTimeLabel = expectedTime || settings.defaultArrivalTime || "정해진 시간";
    const message = applyTemplate(template, {
        studentName,
        time: eventTimeLabel,
        expectedTime: expectedTimeLabel,
    });
    const provider = settings.smsProvider || "none";
    const ts = admin.firestore.Timestamp.now();
    const batch = db.batch();
    recipients.forEach((recipient) => {
        const queueRef = db.collection(`centers/${centerId}/smsQueue`).doc();
        batch.set(queueRef, {
            centerId,
            studentId,
            parentUid: recipient.parentUid,
            parentName: recipient.parentName,
            to: recipient.phoneNumber,
            provider,
            sender: settings.smsSender || null,
            endpointUrl: settings.smsEndpointUrl || null,
            message,
            eventType,
            status: settings.smsEnabled === false || provider === "none" ? "pending_provider" : "queued",
            createdAt: ts,
            updatedAt: ts,
            metadata: {
                studentName,
                expectedTime: expectedTime || null,
            },
        });
        const parentNotificationRef = db.collection(`centers/${centerId}/parentNotifications`).doc();
        batch.set(parentNotificationRef, {
            centerId,
            studentId,
            parentUid: recipient.parentUid,
            type: eventType,
            title: eventType === "check_in"
                ? "등원 알림"
                : eventType === "check_out"
                    ? "하원 알림"
                    : "지각 알림",
            body: message,
            isRead: false,
            isImportant: eventType !== "check_in",
            createdAt: ts,
            updatedAt: ts,
        });
    });
    const logRef = db.collection(`centers/${centerId}/smsLogs`).doc();
    batch.set(logRef, {
        centerId,
        studentId,
        eventType,
        provider,
        recipientCount: recipients.length,
        message,
        createdAt: ts,
        updatedAt: ts,
    });
    await batch.commit();
    return { queuedCount: recipients.length, recipientCount: recipients.length, message };
}
async function runLateArrivalCheckForCenter(db, centerId, nowKst) {
    const settings = await loadNotificationSettings(db, centerId);
    if (settings.lateAlertEnabled === false)
        return 0;
    const graceMinutes = Number.isFinite(Number(settings.lateAlertGraceMinutes))
        ? Math.max(0, Number(settings.lateAlertGraceMinutes))
        : 20;
    const defaultArrivalTime = settings.defaultArrivalTime || "17:00";
    const nowMinutes = nowKst.getHours() * 60 + nowKst.getMinutes();
    const dateKey = toDateKey(nowKst);
    const membersSnap = await db
        .collection(`centers/${centerId}/members`)
        .where("role", "==", "student")
        .where("status", "==", "active")
        .get();
    if (membersSnap.empty)
        return 0;
    const attendanceSnap = await db.collection(`centers/${centerId}/attendanceCurrent`).get();
    const checkedInStudentIds = new Set();
    attendanceSnap.forEach((seatDoc) => {
        const seatData = seatDoc.data();
        if (!(seatData === null || seatData === void 0 ? void 0 : seatData.studentId))
            return;
        if (seatData.status === "studying" || seatData.status === "away" || seatData.status === "break") {
            checkedInStudentIds.add(String(seatData.studentId));
        }
    });
    const studentRefs = membersSnap.docs.map((memberDoc) => db.doc(`centers/${centerId}/students/${memberDoc.id}`));
    const studentSnaps = studentRefs.length > 0 ? await db.getAll(...studentRefs) : [];
    const studentMap = new Map();
    studentSnaps.forEach((snap) => {
        if (snap.exists)
            studentMap.set(snap.id, snap.data() || {});
    });
    let alertsTriggered = 0;
    for (const memberDoc of membersSnap.docs) {
        const studentId = memberDoc.id;
        if (checkedInStudentIds.has(studentId))
            continue;
        const studentData = studentMap.get(studentId) || {};
        const studentName = typeof studentData.name === "string" && studentData.name.trim()
            ? studentData.name.trim()
            : "학생";
        const expectedTimeRaw = studentData.expectedArrivalTime || defaultArrivalTime;
        const expectedTime = parseHourMinute(expectedTimeRaw);
        if (!expectedTime)
            continue;
        const thresholdMinutes = expectedTime.hour * 60 + expectedTime.minute + graceMinutes;
        if (nowMinutes < thresholdMinutes)
            continue;
        const lateAlertRef = db.doc(`centers/${centerId}/lateAlerts/${dateKey}_${studentId}`);
        const alreadySentSnap = await lateAlertRef.get();
        if (alreadySentSnap.exists)
            continue;
        const expectedLabel = `${String(expectedTime.hour).padStart(2, "0")}:${String(expectedTime.minute).padStart(2, "0")}`;
        const queueResult = await queueParentSmsNotification(db, {
            centerId,
            studentId,
            studentName,
            eventType: "late_alert",
            eventAt: nowKst,
            expectedTime: expectedLabel,
            settings,
        });
        await lateAlertRef.set({
            centerId,
            studentId,
            studentName,
            expectedArrivalTime: expectedLabel,
            graceMinutes,
            triggeredAt: admin.firestore.Timestamp.now(),
            queuedCount: queueResult.queuedCount,
            dateKey,
        }, { merge: true });
        alertsTriggered += 1;
    }
    return alertsTriggered;
}
function isAdminRole(role) {
    return typeof role === "string" && adminRoles.has(role);
}
function assertInviteUsable(inv, expectedRole) {
    if (!allowedRoles.includes(inv.intendedRole)) {
        throw new functions.https.HttpsError("failed-precondition", "Invite has invalid role configuration.");
    }
    if (expectedRole && inv.intendedRole !== expectedRole) {
        throw new functions.https.HttpsError("failed-precondition", "Invite role does not match selected signup role.");
    }
    if (inv.isActive === false) {
        throw new functions.https.HttpsError("failed-precondition", "Invite code is inactive.");
    }
    if (typeof inv.maxUses === "number" && typeof inv.usedCount === "number" && inv.usedCount >= inv.maxUses) {
        throw new functions.https.HttpsError("failed-precondition", "Invite code usage limit exceeded.");
    }
    if (inv.expiresAt && inv.expiresAt.toMillis && inv.expiresAt.toMillis() < Date.now()) {
        throw new functions.https.HttpsError("failed-precondition", "Invite code has expired.");
    }
}
exports.deleteStudentAccount = functions.region(region).runWith({
    timeoutSeconds: 540,
    memory: "1GB",
}).https.onCall(async (data, context) => {
    var _a, _b;
    const db = admin.firestore();
    const auth = admin.auth();
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "인증 필요");
    const { studentId, centerId } = data;
    if (!studentId || !centerId)
        throw new functions.https.HttpsError("invalid-argument", "ID 누락");
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
    if (!callerMemberSnap.exists || !isAdminRole((_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role)) {
        throw new functions.https.HttpsError("permission-denied", "센터 관리자만 삭제 가능합니다.");
    }
    const targetMemberRef = db.doc(`centers/${centerId}/members/${studentId}`);
    const targetMemberSnap = await targetMemberRef.get();
    if (!targetMemberSnap.exists || ((_b = targetMemberSnap.data()) === null || _b === void 0 ? void 0 : _b.role) !== "student") {
        throw new functions.https.HttpsError("failed-precondition", "해당 센터의 학생 계정만 삭제할 수 있습니다.");
    }
    try {
        const errors = [];
        const paths = [
            `users/${studentId}`,
            `userCenters/${studentId}`,
            `centers/${centerId}/members/${studentId}`,
            `centers/${centerId}/students/${studentId}`,
            `centers/${centerId}/growthProgress/${studentId}`,
            `centers/${centerId}/plans/${studentId}`,
            `centers/${centerId}/studyLogs/${studentId}`,
        ];
        const filterCols = [
            `centers/${centerId}/counselingReservations`,
            `centers/${centerId}/counselingLogs`,
            `centers/${centerId}/attendanceRequests`,
            `centers/${centerId}/dailyReports`,
        ];
        await Promise.all([
            ...paths.map(async (path) => {
                try {
                    await db.recursiveDelete(db.doc(path));
                }
                catch (e) {
                    errors.push(`${path}: ${(e === null || e === void 0 ? void 0 : e.message) || "delete failed"}`);
                }
            }),
            ...filterCols.map(async (colPath) => {
                try {
                    const q = await db.collection(colPath).where("studentId", "==", studentId).get();
                    await Promise.all(q.docs.map((docSnap) => db.recursiveDelete(docSnap.ref)));
                }
                catch (e) {
                    errors.push(`${colPath}: ${(e === null || e === void 0 ? void 0 : e.message) || "query delete failed"}`);
                }
            }),
            (async () => {
                try {
                    const statsSnap = await db.collectionGroup("students").where("studentId", "==", studentId).get();
                    const statDocs = statsSnap.docs.filter((docSnap) => docSnap.ref.path.startsWith(`centers/${centerId}/dailyStudentStats/`));
                    await Promise.all(statDocs.map((docSnap) => db.recursiveDelete(docSnap.ref)));
                }
                catch (e) {
                    errors.push(`dailyStudentStats: ${(e === null || e === void 0 ? void 0 : e.message) || "stats cleanup failed"}`);
                }
            })(),
            (async () => {
                try {
                    const leaderboardsSnap = await db.collection(`centers/${centerId}/leaderboards`).get();
                    await Promise.all(leaderboardsSnap.docs.map(async (boardDoc) => {
                        const directEntryRef = boardDoc.ref.collection("entries").doc(studentId);
                        await db.recursiveDelete(directEntryRef);
                        const byStudentQuery = await boardDoc.ref.collection("entries").where("studentId", "==", studentId).get();
                        await Promise.all(byStudentQuery.docs.map((docSnap) => db.recursiveDelete(docSnap.ref)));
                    }));
                }
                catch (e) {
                    errors.push(`leaderboards: ${(e === null || e === void 0 ? void 0 : e.message) || "leaderboard cleanup failed"}`);
                }
            })(),
            (async () => {
                try {
                    const seatsSnap = await db.collection(`centers/${centerId}/attendanceCurrent`).where("studentId", "==", studentId).get();
                    await Promise.all(seatsSnap.docs.map((seatDoc) => seatDoc.ref.set({
                        studentId: null,
                        status: "absent",
                        updatedAt: admin.firestore.Timestamp.now(),
                        lastCheckInAt: admin.firestore.FieldValue.delete(),
                    }, { merge: true })));
                }
                catch (e) {
                    errors.push(`attendanceCurrent: ${(e === null || e === void 0 ? void 0 : e.message) || "seat cleanup failed"}`);
                }
            })(),
        ]);
        if (errors.length > 0) {
            throw new Error(`학생 데이터 일부 삭제 실패 (${errors.length}건)`);
        }
        try {
            await auth.deleteUser(studentId);
        }
        catch (e) {
            if ((e === null || e === void 0 ? void 0 : e.code) !== "auth/user-not-found") {
                throw e;
            }
        }
        return { ok: true, message: "정리가 완료되었습니다." };
    }
    catch (error) {
        throw new functions.https.HttpsError("internal", error.message);
    }
});
exports.updateStudentAccount = functions.region(region).https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    const auth = admin.auth();
    const { studentId, centerId, password, displayName, schoolName, grade, parentLinkCode, className, seasonLp, stats, todayStudyMinutes, dateKey, } = data;
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "인증 필요");
    if (!studentId || !centerId)
        throw new functions.https.HttpsError("invalid-argument", "ID 누락");
    const callerUid = context.auth.uid;
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${callerUid}`).get();
    const callerRole = callerMemberSnap.exists ? (_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role : null;
    const isAdminCaller = isAdminRole(callerRole);
    const isSelfStudentCaller = callerRole === "student" && callerUid === studentId;
    if (!isAdminCaller && !isSelfStudentCaller) {
        throw new functions.https.HttpsError("permission-denied", "수정 권한이 없습니다.");
    }
    const studentRef = db.doc(`centers/${centerId}/students/${studentId}`);
    const existingStudentSnap = await studentRef.get();
    const existingStudentData = existingStudentSnap.exists ? existingStudentSnap.data() : null;
    const existingParentLinkCode = typeof (existingStudentData === null || existingStudentData === void 0 ? void 0 : existingStudentData.parentLinkCode) === "string" ? existingStudentData.parentLinkCode.trim() : "";
    const trimmedDisplayName = typeof displayName === "string" ? displayName.trim() : "";
    const trimmedSchoolName = typeof schoolName === "string" ? schoolName.trim() : "";
    const trimmedGrade = typeof grade === "string" ? grade.trim() : "";
    const hasClassName = className !== undefined;
    const normalizedClassName = hasClassName
        ? (typeof className === "string" && className.trim() ? className.trim() : null)
        : undefined;
    const parentLinkCodeProvided = parentLinkCode !== undefined;
    const normalizedParentLinkCode = typeof parentLinkCode === "string"
        ? parentLinkCode.trim()
        : parentLinkCode === null
            ? ""
            : undefined;
    if (parentLinkCodeProvided) {
        if (typeof normalizedParentLinkCode !== "string") {
            throw new functions.https.HttpsError("invalid-argument", "Parent link code type is invalid.");
        }
        if (normalizedParentLinkCode && !/^\d{6}$/.test(normalizedParentLinkCode)) {
            throw new functions.https.HttpsError("invalid-argument", "Parent link code must be 6 digits.", {
                userMessage: "학부모 연동 코드는 6자리 숫자여야 합니다.",
            });
        }
        if (normalizedParentLinkCode && normalizedParentLinkCode !== existingParentLinkCode) {
            let duplicateCandidates = [];
            try {
                const duplicateSnap = await db
                    .collectionGroup("students")
                    .where("parentLinkCode", "==", normalizedParentLinkCode)
                    .limit(20)
                    .get();
                duplicateCandidates = duplicateSnap.docs;
            }
            catch (lookupError) {
                console.warn("[updateStudentAccount] collectionGroup duplicate lookup failed, fallback to center scoped lookup", {
                    centerId,
                    studentId,
                    code: normalizedParentLinkCode,
                    message: (lookupError === null || lookupError === void 0 ? void 0 : lookupError.message) || lookupError,
                });
                const localStudentsRef = db.collection(`centers/${centerId}/students`);
                const localStringSnap = await localStudentsRef
                    .where("parentLinkCode", "==", normalizedParentLinkCode)
                    .limit(20)
                    .get();
                duplicateCandidates = [...localStringSnap.docs];
                const asNumber = Number(normalizedParentLinkCode);
                if (Number.isFinite(asNumber)) {
                    const localNumberSnap = await localStudentsRef
                        .where("parentLinkCode", "==", asNumber)
                        .limit(20)
                        .get();
                    for (const docSnap of localNumberSnap.docs) {
                        if (!duplicateCandidates.find((d) => d.ref.path === docSnap.ref.path)) {
                            duplicateCandidates.push(docSnap);
                        }
                    }
                }
            }
            let hasConflict = false;
            for (const docSnap of duplicateCandidates) {
                if (docSnap.id === studentId)
                    continue;
                const candidateCenterRef = docSnap.ref.parent.parent;
                if (!candidateCenterRef)
                    continue;
                const candidateMemberSnap = await db.doc(`centers/${candidateCenterRef.id}/members/${docSnap.id}`).get();
                if (!candidateMemberSnap.exists)
                    continue;
                const candidateMemberData = candidateMemberSnap.data();
                const isActiveStudentCandidate = (candidateMemberData === null || candidateMemberData === void 0 ? void 0 : candidateMemberData.role) === "student" && isActiveMembershipStatus(candidateMemberData === null || candidateMemberData === void 0 ? void 0 : candidateMemberData.status);
                if (!isActiveStudentCandidate)
                    continue;
                const candidateUserCenterSnap = await db.doc(`userCenters/${docSnap.id}/centers/${candidateCenterRef.id}`).get();
                const candidateUserCenterData = candidateUserCenterSnap.exists ? candidateUserCenterSnap.data() : null;
                const hasActiveUserCenter = candidateUserCenterSnap.exists &&
                    (candidateUserCenterData === null || candidateUserCenterData === void 0 ? void 0 : candidateUserCenterData.role) === "student" &&
                    isActiveMembershipStatus(candidateUserCenterData === null || candidateUserCenterData === void 0 ? void 0 : candidateUserCenterData.status);
                let hasSeatAssignment = false;
                if (!hasActiveUserCenter) {
                    const seatSnap = await db
                        .collection(`centers/${candidateCenterRef.id}/attendanceCurrent`)
                        .where("studentId", "==", docSnap.id)
                        .limit(1)
                        .get();
                    hasSeatAssignment = !seatSnap.empty;
                }
                if (hasActiveUserCenter || hasSeatAssignment) {
                    hasConflict = true;
                    break;
                }
            }
            if (hasConflict) {
                throw new functions.https.HttpsError("failed-precondition", "Parent link code is duplicated.", {
                    userMessage: "이미 사용 중인 학부모 연동 코드입니다. 다른 6자리 숫자를 입력해 주세요.",
                });
            }
        }
    }
    if (isSelfStudentCaller) {
        const hasForbiddenUpdate = (typeof password === "string" && password.trim().length > 0) ||
            trimmedDisplayName.length > 0 ||
            hasClassName ||
            seasonLp !== undefined ||
            stats !== undefined ||
            todayStudyMinutes !== undefined ||
            dateKey !== undefined;
        if (hasForbiddenUpdate) {
            throw new functions.https.HttpsError("permission-denied", "학생 계정은 일부 항목만 수정할 수 있습니다.", {
                userMessage: "학생은 학교/학년/학부모 연동 코드만 수정할 수 있습니다.",
            });
        }
        if (!trimmedSchoolName && !trimmedGrade && !parentLinkCodeProvided) {
            throw new functions.https.HttpsError("invalid-argument", "No editable field provided.", {
                userMessage: "수정할 항목을 입력해 주세요.",
            });
        }
    }
    try {
        if (isAdminCaller) {
            const authUpdates = {};
            if (typeof password === "string" && password.trim().length >= 6)
                authUpdates.password = password.trim();
            if (trimmedDisplayName)
                authUpdates.displayName = trimmedDisplayName;
            if (Object.keys(authUpdates).length > 0) {
                try {
                    await auth.updateUser(studentId, authUpdates);
                }
                catch (authError) {
                    console.warn("Auth update skipped for " + studentId + ": " + authError.message);
                }
            }
        }
        const timestamp = admin.firestore.Timestamp.now();
        const batch = db.batch();
        if (trimmedDisplayName || trimmedSchoolName) {
            const userUpdate = { updatedAt: timestamp };
            if (trimmedDisplayName)
                userUpdate.displayName = trimmedDisplayName;
            if (trimmedSchoolName)
                userUpdate.schoolName = trimmedSchoolName;
            batch.set(db.doc("users/" + studentId), userUpdate, { merge: true });
        }
        const studentUpdate = { updatedAt: timestamp };
        if (trimmedDisplayName)
            studentUpdate.name = trimmedDisplayName;
        if (trimmedSchoolName)
            studentUpdate.schoolName = trimmedSchoolName;
        if (trimmedGrade)
            studentUpdate.grade = trimmedGrade;
        if (parentLinkCodeProvided)
            studentUpdate.parentLinkCode = normalizedParentLinkCode || null;
        if (isAdminCaller && hasClassName)
            studentUpdate.className = normalizedClassName;
        batch.set(studentRef, studentUpdate, { merge: true });
        if (isAdminCaller) {
            const memberUpdate = { updatedAt: timestamp };
            if (trimmedDisplayName)
                memberUpdate.displayName = trimmedDisplayName;
            if (hasClassName)
                memberUpdate.className = normalizedClassName;
            batch.set(db.doc("centers/" + centerId + "/members/" + studentId), memberUpdate, { merge: true });
            if (hasClassName) {
                batch.set(db.doc("userCenters/" + studentId + "/centers/" + centerId), {
                    className: normalizedClassName,
                    updatedAt: timestamp,
                }, { merge: true });
            }
            const hasSeasonLp = typeof seasonLp === "number" && Number.isFinite(seasonLp);
            const hasStats = !!stats && typeof stats === "object";
            if (hasSeasonLp || hasStats) {
                const progressUpdate = { updatedAt: timestamp };
                if (hasSeasonLp)
                    progressUpdate.seasonLp = seasonLp;
                if (hasStats)
                    progressUpdate.stats = stats;
                batch.set(db.doc("centers/" + centerId + "/growthProgress/" + studentId), progressUpdate, { merge: true });
            }
            const safeDateKey = typeof dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
                ? dateKey
                : new Date().toISOString().slice(0, 10);
            if (typeof todayStudyMinutes === "number" && Number.isFinite(todayStudyMinutes)) {
                batch.set(db.doc("centers/" + centerId + "/dailyStudentStats/" + safeDateKey + "/students/" + studentId), {
                    totalStudyMinutes: todayStudyMinutes,
                    studentId,
                    centerId,
                    dateKey: safeDateKey,
                    updatedAt: timestamp,
                }, { merge: true });
            }
            if (hasSeasonLp || trimmedDisplayName || hasClassName) {
                const periodKey = safeDateKey.slice(0, 7);
                const rankUpdate = {
                    studentId,
                    updatedAt: timestamp,
                };
                if (hasSeasonLp)
                    rankUpdate.value = seasonLp;
                if (trimmedDisplayName)
                    rankUpdate.displayNameSnapshot = trimmedDisplayName;
                if (hasClassName)
                    rankUpdate.classNameSnapshot = normalizedClassName;
                batch.set(db.doc("centers/" + centerId + "/leaderboards/" + periodKey + "_lp/entries/" + studentId), rankUpdate, {
                    merge: true,
                });
            }
        }
        await batch.commit();
        return { ok: true, updatedBy: isSelfStudentCaller ? "student" : "admin" };
    }
    catch (e) {
        if (e instanceof functions.https.HttpsError) {
            throw e;
        }
        throw new functions.https.HttpsError("internal", "Operation failed due to internal error.", {
            userMessage: (e === null || e === void 0 ? void 0 : e.message) || "Unknown internal error",
        });
    }
});
exports.registerStudent = functions.region(region).https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    const auth = admin.auth();
    const { email, password, displayName, schoolName, grade, centerId } = data;
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "인증 필요");
    if (!email || !password || !displayName || !centerId) {
        throw new functions.https.HttpsError("invalid-argument", "필수값 누락");
    }
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
    if (!callerMemberSnap.exists || !isAdminRole((_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role)) {
        throw new functions.https.HttpsError("permission-denied", "센터 관리자만 학생 계정을 생성할 수 있습니다.");
    }
    try {
        const userRecord = await auth.createUser({ email, password, displayName });
        const uid = userRecord.uid;
        const timestamp = admin.firestore.Timestamp.now();
        await db.runTransaction(async (t) => {
            t.set(db.doc(`users/${uid}`), { id: uid, email, displayName, schoolName, createdAt: timestamp, updatedAt: timestamp });
            t.set(db.doc(`centers/${centerId}/members/${uid}`), { id: uid, centerId, role: "student", status: "active", joinedAt: timestamp, displayName });
            t.set(db.doc(`userCenters/${uid}/centers/${centerId}`), { id: centerId, centerId, role: "student", status: "active", joinedAt: timestamp });
            t.set(db.doc(`centers/${centerId}/students/${uid}`), { id: uid, name: displayName, schoolName, grade, createdAt: timestamp, updatedAt: timestamp });
            t.set(db.doc(`centers/${centerId}/growthProgress/${uid}`), {
                seasonLp: 0,
                penaltyPoints: 0,
                stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 },
                updatedAt: timestamp,
            });
        });
        return { ok: true, uid };
    }
    catch (e) {
        if (e instanceof functions.https.HttpsError) {
            throw e;
        }
        throw new functions.https.HttpsError("internal", "Operation failed due to internal error.", {
            userMessage: (e === null || e === void 0 ? void 0 : e.message) || "Unknown internal error",
        });
    }
});
exports.redeemInviteCode = functions.region(region).https.onCall(async (data, context) => {
    const db = admin.firestore();
    const { code } = data;
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "인증 필요");
    if (!code)
        throw new functions.https.HttpsError("invalid-argument", "초대코드 누락");
    const uid = context.auth.uid;
    const callerDisplayName = context.auth.token.name || null;
    try {
        return await db.runTransaction(async (t) => {
            const inviteRef = db.doc(`inviteCodes/${code}`);
            const inviteSnap = await t.get(inviteRef);
            if (!inviteSnap.exists)
                throw new functions.https.HttpsError("failed-precondition", "Invalid invite code.");
            const inv = inviteSnap.data();
            assertInviteUsable(inv);
            const membershipRef = db.doc(`userCenters/${uid}/centers/${inv.centerId}`);
            const existingMembership = await t.get(membershipRef);
            if (existingMembership.exists) {
                throw new functions.https.HttpsError("already-exists", "Already joined this center.");
            }
            const ts = admin.firestore.Timestamp.now();
            t.set(membershipRef, {
                id: inv.centerId,
                role: inv.intendedRole,
                status: "active",
                joinedAt: ts,
                className: inv.targetClassName || null,
            });
            t.set(db.doc(`centers/${inv.centerId}/members/${uid}`), {
                id: uid,
                role: inv.intendedRole,
                status: "active",
                joinedAt: ts,
                displayName: callerDisplayName,
                className: inv.targetClassName || null,
            });
            t.update(inviteRef, { usedCount: admin.firestore.FieldValue.increment(1), updatedAt: ts });
            return { ok: true, message: "센터 가입이 완료되었습니다." };
        });
    }
    catch (e) {
        if (e instanceof functions.https.HttpsError) {
            throw e;
        }
        throw new functions.https.HttpsError("internal", "Operation failed due to internal error.", {
            userMessage: (e === null || e === void 0 ? void 0 : e.message) || "Unknown internal error",
        });
    }
});
exports.completeSignupWithInvite = functions.region(region).https.onCall(async (data, context) => {
    const db = admin.firestore();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const uid = context.auth.uid;
    const role = data === null || data === void 0 ? void 0 : data.role;
    const code = String((data === null || data === void 0 ? void 0 : data.code) || "").trim();
    const schoolName = String((data === null || data === void 0 ? void 0 : data.schoolName) || "").trim();
    const grade = String((data === null || data === void 0 ? void 0 : data.grade) || "고등학생").trim();
    const parentLinkCode = String((data === null || data === void 0 ? void 0 : data.parentLinkCode) || "").trim();
    const studentLinkCode = String((data === null || data === void 0 ? void 0 : data.studentLinkCode) || "").trim();
    const displayNameInput = String((data === null || data === void 0 ? void 0 : data.displayName) || "").trim();
    const parentPhoneNumber = normalizePhoneNumber((data === null || data === void 0 ? void 0 : data.parentPhoneNumber) || (data === null || data === void 0 ? void 0 : data.phoneNumber) || "");
    if (!allowedRoles.includes(role)) {
        throw new functions.https.HttpsError("invalid-argument", "선택한 역할이 유효하지 않습니다.");
    }
    if (role !== "parent" && !code) {
        throw new functions.https.HttpsError("invalid-argument", "초대 코드가 누락되었습니다.", {
            userMessage: "초대 코드를 입력해주세요.",
        });
    }
    const emailFromToken = context.auth.token.email || null;
    const tokenDisplayName = context.auth.token.name || null;
    try {
        return await db.runTransaction(async (t) => {
            let centerId = "";
            let targetClassName = null;
            let inviteRef = null;
            let linkedStudentRef = null;
            let linkedStudentData = null;
            let linkedStudentId = "";
            if (role === "parent") {
                if (!/^\d{6}$/.test(studentLinkCode)) {
                    throw new functions.https.HttpsError("invalid-argument", "Student link code must be a 6-digit number.", {
                        userMessage: "학생 코드는 6자리 숫자로 입력해주세요.",
                    });
                }
                const codeAsNumber = Number(studentLinkCode);
                const candidateQueries = [
                    db.collectionGroup("students").where("parentLinkCode", "==", studentLinkCode).limit(20),
                    db.collectionGroup("students").where("studentLinkCode", "==", studentLinkCode).limit(20),
                ];
                if (Number.isFinite(codeAsNumber)) {
                    candidateQueries.push(db.collectionGroup("students").where("parentLinkCode", "==", codeAsNumber).limit(20), db.collectionGroup("students").where("studentLinkCode", "==", codeAsNumber).limit(20));
                }
                const studentSnaps = await Promise.all(candidateQueries.map((candidateQuery) => t.get(candidateQuery)));
                const studentDocMap = new Map();
                for (const snap of studentSnaps) {
                    for (const studentDoc of snap.docs) {
                        studentDocMap.set(studentDoc.ref.path, studentDoc);
                    }
                }
                if (studentDocMap.size === 0) {
                    throw new functions.https.HttpsError("failed-precondition", "No student found for this link code.", {
                        userMessage: "No student matched this code. Please check the 6-digit student code and try again.",
                    });
                }
                let candidates = [];
                for (const studentDoc of studentDocMap.values()) {
                    const centerRef = studentDoc.ref.parent.parent;
                    if (!centerRef)
                        continue;
                    const candidateMemberRef = db.doc(`centers/${centerRef.id}/members/${studentDoc.id}`);
                    const candidateUserCenterRef = db.doc(`userCenters/${studentDoc.id}/centers/${centerRef.id}`);
                    const [candidateMemberSnap, candidateUserCenterSnap] = await Promise.all([
                        t.get(candidateMemberRef),
                        t.get(candidateUserCenterRef),
                    ]);
                    const candidateMemberData = candidateMemberSnap.exists ? candidateMemberSnap.data() : null;
                    const hasActiveMember = candidateMemberSnap.exists &&
                        (candidateMemberData === null || candidateMemberData === void 0 ? void 0 : candidateMemberData.role) === "student" && isActiveMembershipStatus(candidateMemberData === null || candidateMemberData === void 0 ? void 0 : candidateMemberData.status);
                    const candidateUserCenterData = candidateUserCenterSnap.exists ? candidateUserCenterSnap.data() : null;
                    const hasActiveUserCenter = candidateUserCenterSnap.exists &&
                        (candidateUserCenterData === null || candidateUserCenterData === void 0 ? void 0 : candidateUserCenterData.role) === "student" &&
                        isActiveMembershipStatus(candidateUserCenterData === null || candidateUserCenterData === void 0 ? void 0 : candidateUserCenterData.status);
                    const seatQuery = db
                        .collection(`centers/${centerRef.id}/attendanceCurrent`)
                        .where("studentId", "==", studentDoc.id)
                        .limit(1);
                    const seatSnap = await t.get(seatQuery);
                    const hasSeatAssignment = !seatSnap.empty;
                    if (!hasActiveMember && !hasActiveUserCenter && !hasSeatAssignment)
                        continue;
                    const studentData = studentDoc.data();
                    candidates.push({
                        centerId: centerRef.id,
                        studentDoc,
                        studentData,
                        className: (candidateMemberData === null || candidateMemberData === void 0 ? void 0 : candidateMemberData.className) ||
                            (candidateUserCenterData === null || candidateUserCenterData === void 0 ? void 0 : candidateUserCenterData.className) ||
                            null,
                        hasActiveMember,
                        hasActiveUserCenter,
                        hasSeatAssignment,
                        updatedAtMs: toMillisSafe(studentData === null || studentData === void 0 ? void 0 : studentData.updatedAt),
                        createdAtMs: toMillisSafe(studentData === null || studentData === void 0 ? void 0 : studentData.createdAt),
                    });
                }
                if (candidates.length === 0) {
                    throw new functions.https.HttpsError("failed-precondition", "No active student found for this link code.", {
                        userMessage: "No active student was found for this code. Ask the center admin to verify enrollment and seat assignment.",
                    });
                }
                const activeMemberCandidates = candidates.filter((candidate) => candidate.hasActiveMember);
                if (activeMemberCandidates.length > 0) {
                    candidates = activeMemberCandidates;
                }
                const userCenterActiveCandidates = candidates.filter((candidate) => candidate.hasActiveUserCenter);
                if (userCenterActiveCandidates.length > 0) {
                    candidates = userCenterActiveCandidates;
                }
                if (candidates.length > 1) {
                    const seatAssignedCandidates = candidates.filter((candidate) => candidate.hasSeatAssignment);
                    if (seatAssignedCandidates.length > 0) {
                        candidates = seatAssignedCandidates;
                    }
                }
                if (candidates.length > 1) {
                    const sortedCandidates = [...candidates].sort((a, b) => {
                        const aMemberScore = (a.hasActiveMember ? 2 : 0) + (a.hasActiveUserCenter ? 1 : 0);
                        const bMemberScore = (b.hasActiveMember ? 2 : 0) + (b.hasActiveUserCenter ? 1 : 0);
                        if (aMemberScore !== bMemberScore)
                            return bMemberScore - aMemberScore;
                        const aSeatScore = a.hasSeatAssignment ? 1 : 0;
                        const bSeatScore = b.hasSeatAssignment ? 1 : 0;
                        if (aSeatScore !== bSeatScore)
                            return bSeatScore - aSeatScore;
                        const aScore = Math.max(a.updatedAtMs, a.createdAtMs);
                        const bScore = Math.max(b.updatedAtMs, b.createdAtMs);
                        if (aScore !== bScore)
                            return bScore - aScore;
                        return a.studentDoc.id.localeCompare(b.studentDoc.id);
                    });
                    candidates = [sortedCandidates[0]];
                    console.warn("[completeSignupWithInvite] duplicate student link code candidates resolved automatically", {
                        studentLinkCode,
                        candidateCount: sortedCandidates.length,
                        selectedStudentId: sortedCandidates[0].studentDoc.id,
                        selectedCenterId: sortedCandidates[0].centerId,
                    });
                }
                const selected = candidates[0];
                centerId = selected.centerId;
                linkedStudentRef = selected.studentDoc.ref;
                linkedStudentData = selected.studentData;
                linkedStudentId = selected.studentDoc.id;
                targetClassName = selected.className || (linkedStudentData === null || linkedStudentData === void 0 ? void 0 : linkedStudentData.className) || null;
            }
            else {
                inviteRef = db.doc(`inviteCodes/${code}`);
                const inviteSnap = await t.get(inviteRef);
                if (!inviteSnap.exists) {
                    throw new functions.https.HttpsError("failed-precondition", "Invalid invite code.", {
                        userMessage: "유효하지 않은 초대 코드입니다.",
                    });
                }
                const inviteData = inviteSnap.data();
                assertInviteUsable(inviteData, role);
                centerId = inviteData.centerId;
                targetClassName = inviteData.targetClassName || null;
                if (!centerId) {
                    throw new functions.https.HttpsError("failed-precondition", "Invite code has no center information.", {
                        userMessage: "초대 코드의 센터 정보가 올바르지 않습니다.",
                    });
                }
            }
            const userCenterRef = db.doc(`userCenters/${uid}/centers/${centerId}`);
            const memberRef = db.doc(`centers/${centerId}/members/${uid}`);
            const [existingMembership, existingCenterMember] = await Promise.all([t.get(userCenterRef), t.get(memberRef)]);
            const existingMembershipData = existingMembership.exists ? existingMembership.data() : null;
            const existingCenterMemberData = existingCenterMember.exists ? existingCenterMember.data() : null;
            const existingRole = (existingMembershipData === null || existingMembershipData === void 0 ? void 0 : existingMembershipData.role) || (existingCenterMemberData === null || existingCenterMemberData === void 0 ? void 0 : existingCenterMemberData.role) || null;
            const isParentRelink = role === "parent" && existingRole === "parent";
            if ((existingMembership.exists || existingCenterMember.exists) && !isParentRelink) {
                throw new functions.https.HttpsError("already-exists", "Already joined this center.", {
                    userMessage: "이미 가입된 센터입니다.",
                });
            }
            const extractLinkedIds = (value) => {
                if (!Array.isArray(value))
                    return [];
                return value.filter((id) => typeof id === "string" && id.trim().length > 0);
            };
            const ts = admin.firestore.Timestamp.now();
            let resolvedDisplayName = displayNameInput || tokenDisplayName || "사용자";
            const existingLinkedStudentIds = Array.from(new Set([
                ...extractLinkedIds(existingMembershipData === null || existingMembershipData === void 0 ? void 0 : existingMembershipData.linkedStudentIds),
                ...extractLinkedIds(existingCenterMemberData === null || existingCenterMemberData === void 0 ? void 0 : existingCenterMemberData.linkedStudentIds),
            ]));
            let linkedStudentIds = [];
            let effectiveParentPhone = parentPhoneNumber || normalizePhoneNumber((existingMembershipData === null || existingMembershipData === void 0 ? void 0 : existingMembershipData.phoneNumber) || (existingCenterMemberData === null || existingCenterMemberData === void 0 ? void 0 : existingCenterMemberData.phoneNumber) || "");
            const resolvedStatus = "active";
            if (role === "student") {
                if (!schoolName) {
                    throw new functions.https.HttpsError("invalid-argument", "School name is required for student signup.", {
                        userMessage: "학생 가입에는 학교명이 필요합니다.",
                    });
                }
                if (!/^\d{6}$/.test(parentLinkCode)) {
                    throw new functions.https.HttpsError("invalid-argument", "Parent link code must be 6 digits.", {
                        userMessage: "학생 가입에는 6자리 부모 연동 코드가 필요합니다.",
                    });
                }
            }
            if (role === "parent") {
                if (!linkedStudentRef || !linkedStudentData || !linkedStudentId) {
                    throw new functions.https.HttpsError("failed-precondition", "Linked student data is missing.", {
                        userMessage: "연동할 학생 정보를 찾지 못했습니다. 다시 시도해주세요.",
                    });
                }
                if (!effectiveParentPhone) {
                    throw new functions.https.HttpsError("invalid-argument", "Parent phone number is required.", {
                        userMessage: "학부모 가입/연동 시 휴대폰 번호를 입력해주세요.",
                    });
                }
                linkedStudentIds = Array.from(new Set([...existingLinkedStudentIds, linkedStudentId]));
                if (!displayNameInput) {
                    resolvedDisplayName =
                        (existingMembershipData === null || existingMembershipData === void 0 ? void 0 : existingMembershipData.displayName) ||
                            (existingCenterMemberData === null || existingCenterMemberData === void 0 ? void 0 : existingCenterMemberData.displayName) ||
                            `${(linkedStudentData === null || linkedStudentData === void 0 ? void 0 : linkedStudentData.name) || "학생"} 학부모`;
                }
                t.set(linkedStudentRef, {
                    parentUids: admin.firestore.FieldValue.arrayUnion(uid),
                    updatedAt: ts,
                }, { merge: true });
            }
            const userDocData = {
                id: uid,
                email: emailFromToken,
                displayName: resolvedDisplayName,
                schoolName: schoolName || "",
                updatedAt: ts,
                createdAt: ts,
            };
            if (role === "parent" && effectiveParentPhone) {
                userDocData.phoneNumber = effectiveParentPhone;
            }
            t.set(db.doc(`users/${uid}`), userDocData, { merge: true });
            const memberData = {
                id: uid,
                centerId,
                role,
                status: resolvedStatus,
                joinedAt: (existingMembershipData === null || existingMembershipData === void 0 ? void 0 : existingMembershipData.joinedAt) || (existingCenterMemberData === null || existingCenterMemberData === void 0 ? void 0 : existingCenterMemberData.joinedAt) || ts,
                displayName: resolvedDisplayName,
                className: targetClassName || (existingMembershipData === null || existingMembershipData === void 0 ? void 0 : existingMembershipData.className) || (existingCenterMemberData === null || existingCenterMemberData === void 0 ? void 0 : existingCenterMemberData.className) || null,
            };
            if (role === "parent" && effectiveParentPhone) {
                memberData.phoneNumber = effectiveParentPhone;
            }
            if (linkedStudentIds.length > 0) {
                memberData.linkedStudentIds = linkedStudentIds;
            }
            const userCenterData = {
                id: centerId,
                centerId,
                role,
                status: resolvedStatus,
                joinedAt: (existingMembershipData === null || existingMembershipData === void 0 ? void 0 : existingMembershipData.joinedAt) || (existingCenterMemberData === null || existingCenterMemberData === void 0 ? void 0 : existingCenterMemberData.joinedAt) || ts,
                displayName: resolvedDisplayName,
                className: targetClassName || (existingMembershipData === null || existingMembershipData === void 0 ? void 0 : existingMembershipData.className) || (existingCenterMemberData === null || existingCenterMemberData === void 0 ? void 0 : existingCenterMemberData.className) || null,
            };
            if (role === "parent" && effectiveParentPhone) {
                userCenterData.phoneNumber = effectiveParentPhone;
            }
            if (linkedStudentIds.length > 0) {
                userCenterData.linkedStudentIds = linkedStudentIds;
            }
            t.set(memberRef, memberData, { merge: true });
            t.set(userCenterRef, userCenterData, { merge: true });
            if (role === "student") {
                t.set(db.doc(`centers/${centerId}/students/${uid}`), {
                    id: uid,
                    name: resolvedDisplayName,
                    schoolName,
                    grade,
                    className: targetClassName,
                    seatNo: 0,
                    targetDailyMinutes: 360,
                    parentUids: [],
                    parentLinkCode,
                    createdAt: ts,
                    updatedAt: ts,
                }, { merge: true });
                t.set(db.doc(`centers/${centerId}/growthProgress/${uid}`), {
                    level: 1,
                    currentXp: 0,
                    nextLevelXp: 1000,
                    seasonLp: 0,
                    penaltyPoints: 0,
                    stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 },
                    skills: {},
                    updatedAt: ts,
                }, { merge: true });
            }
            if (inviteRef) {
                t.update(inviteRef, {
                    usedCount: admin.firestore.FieldValue.increment(1),
                    updatedAt: ts,
                });
            }
            return { ok: true, centerId, role };
        });
    }
    catch (e) {
        if (e instanceof functions.https.HttpsError) {
            throw e;
        }
        const errorCode = String((e === null || e === void 0 ? void 0 : e.code) || "").toLowerCase();
        const errorMessage = String((e === null || e === void 0 ? void 0 : e.message) || "").trim();
        const strippedErrorMessage = errorMessage.replace(/^FirebaseError:\s*/i, "").trim();
        const hasFailedPrecondition = errorCode.includes("failed-precondition") ||
            errorCode === "9" ||
            /failed[_ -]?precondition/i.test(strippedErrorMessage);
        const hasInvalidArgument = errorCode.includes("invalid-argument") ||
            errorCode === "3" ||
            /invalid[_ -]?argument/i.test(strippedErrorMessage);
        const hasAlreadyExists = errorCode.includes("already-exists") ||
            errorCode === "6" ||
            /already[_ -]?exists/i.test(strippedErrorMessage);
        if (hasFailedPrecondition) {
            throw new functions.https.HttpsError("failed-precondition", "Signup precondition failed.", {
                userMessage: "Please verify the student code and link status. The code may be duplicated or the student may not be active.",
            });
        }
        if (hasInvalidArgument) {
            throw new functions.https.HttpsError("invalid-argument", "Invalid signup input.", {
                userMessage: "Please check required fields: student code, phone number, and other inputs.",
            });
        }
        if (hasAlreadyExists) {
            throw new functions.https.HttpsError("already-exists", "Signup target already exists.", {
                userMessage: "This account is already linked. Please sign in and check your dashboard.",
            });
        }
        throw new functions.https.HttpsError("internal", "Signup processing failed due to an internal error.", {
            userMessage: (e === null || e === void 0 ? void 0 : e.message) || "Unknown internal error",
        });
    }
});
exports.notifyAttendanceSms = functions.region(region).https.onCall(async (data, context) => {
    var _a, _b;
    const db = admin.firestore();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = String((data === null || data === void 0 ? void 0 : data.centerId) || "").trim();
    const studentId = String((data === null || data === void 0 ? void 0 : data.studentId) || "").trim();
    const eventType = String((data === null || data === void 0 ? void 0 : data.eventType) || "").trim();
    if (!centerId || !studentId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId and studentId are required.", {
            userMessage: "센터 또는 학생 정보가 누락되었습니다.",
        });
    }
    if (!["check_in", "check_out", "late_alert"].includes(eventType)) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid event type.", {
            userMessage: "알림 타입이 올바르지 않습니다.",
        });
    }
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
    const callerRole = callerMemberSnap.exists ? (_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role : null;
    const canNotify = callerRole === "teacher" || isAdminRole(callerRole);
    if (!canNotify) {
        throw new functions.https.HttpsError("permission-denied", "Only teacher/admin can send notifications.");
    }
    const studentSnap = await db.doc(`centers/${centerId}/students/${studentId}`).get();
    if (!studentSnap.exists) {
        throw new functions.https.HttpsError("failed-precondition", "Student not found.", {
            userMessage: "학생 정보를 찾을 수 없습니다.",
        });
    }
    const studentNameRaw = (_b = studentSnap.data()) === null || _b === void 0 ? void 0 : _b.name;
    const studentName = typeof studentNameRaw === "string" && studentNameRaw.trim() ? studentNameRaw.trim() : "학생";
    const nowKst = toKstDate();
    const settings = await loadNotificationSettings(db, centerId);
    const queueResult = await queueParentSmsNotification(db, {
        centerId,
        studentId,
        studentName,
        eventType,
        eventAt: nowKst,
        settings,
    });
    return {
        ok: true,
        queuedCount: queueResult.queuedCount,
        recipientCount: queueResult.recipientCount,
        provider: settings.smsProvider || "none",
        message: queueResult.message,
    };
});
exports.runLateArrivalCheck = functions.region(region).https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = String((data === null || data === void 0 ? void 0 : data.centerId) || "").trim();
    if (!centerId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId is required.");
    }
    const callerMemberSnap = await db.doc(`centers/${centerId}/members/${context.auth.uid}`).get();
    const callerRole = callerMemberSnap.exists ? (_a = callerMemberSnap.data()) === null || _a === void 0 ? void 0 : _a.role : null;
    const canRun = callerRole === "teacher" || isAdminRole(callerRole);
    if (!canRun) {
        throw new functions.https.HttpsError("permission-denied", "Only teacher/admin can run late check.");
    }
    const nowKst = toKstDate();
    const alertsTriggered = await runLateArrivalCheckForCenter(db, centerId, nowKst);
    return {
        ok: true,
        centerId,
        alertsTriggered,
        checkedAt: admin.firestore.Timestamp.now(),
    };
});
exports.sendScheduledLateArrivalAlerts = functions
    .region(region)
    .pubsub.schedule("every 10 minutes")
    .timeZone("Asia/Seoul")
    .onRun(async () => {
    const db = admin.firestore();
    const centersSnap = await db.collection("centers").get();
    const nowKst = toKstDate();
    let totalTriggered = 0;
    for (const centerDoc of centersSnap.docs) {
        totalTriggered += await runLateArrivalCheckForCenter(db, centerDoc.id, nowKst);
    }
    console.log("[late-arrival] run complete", {
        centerCount: centersSnap.size,
        totalTriggered,
        atKst: nowKst.toISOString(),
    });
    return null;
});
//# sourceMappingURL=index.js.map