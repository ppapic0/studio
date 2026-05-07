"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyAttendanceScheduleSheetSync = exports.previewAttendanceScheduleSheetSync = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const crypto_1 = require("crypto");
const googleapis_1 = require("googleapis");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const region = "asia-northeast3";
const TIMEZONE = "Asia/Seoul";
const SHEET_SYNC_INTEGRATION_ID = "attendanceScheduleSheet";
const SHEET_SYNC_RANGE_COLUMNS = "A:AZ";
const SHEET_SYNC_BATCH_LIMIT = 450;
const SHEET_SYNC_DEFAULT_DEPARTURE_TIME = "23:30";
const SCHEDULE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const SCHEDULE_DAY_MINUTES = 24 * 60;
const DAY_DEFINITIONS = [
    { offset: 0, weekday: 1, label: "월" },
    { offset: 1, weekday: 2, label: "화" },
    { offset: 2, weekday: 3, label: "수" },
    { offset: 3, weekday: 4, label: "목" },
    { offset: 4, weekday: 5, label: "금" },
    { offset: 5, weekday: 6, label: "토" },
    { offset: 6, weekday: 0, label: "일" },
];
const DAY_FIELD_DEFINITIONS = [
    { key: "status", labels: ["상태", "구분"] },
    { key: "arrival", labels: ["등원", "입실"] },
    { key: "departure", labels: ["하원", "퇴실"] },
    { key: "awayStart", labels: ["외출시작", "학원시작", "이동시작"] },
    { key: "awayEnd", labels: ["복귀", "복귀예정", "외출종료", "학원종료"] },
    { key: "awayReason", labels: ["외출사유", "사유", "학원명", "메모"] },
];
function asTrimmedString(value, fallback = "") {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}
function normalizeHeaderText(value) {
    return String(value !== null && value !== void 0 ? value : "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()[\]{}<>._:-]/g, "");
}
function normalizeLookupText(value) {
    return String(value !== null && value !== void 0 ? value : "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");
}
function normalizeMembershipStatus(value) {
    return typeof value === "string" ? value.trim().toLowerCase().replace(/[\s_-]+/g, "") : "";
}
function isActiveMembershipStatus(value) {
    const normalized = normalizeMembershipStatus(value);
    return !normalized || normalized === "active" || normalized === "approved" || normalized === "enabled" || normalized === "current";
}
function normalizeMembershipRole(value) {
    const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/[\s_-]+/g, "") : "";
    if (normalized === "owner" || normalized === "admin" || normalized === "centermanager" || normalized === "centeradmin")
        return "centerAdmin";
    if (normalized === "teacher")
        return "teacher";
    if (normalized === "student")
        return "student";
    if (normalized === "parent")
        return "parent";
    if (normalized === "kiosk")
        return "kiosk";
    return "";
}
function isStaffRole(role) {
    const normalized = normalizeMembershipRole(role);
    return normalized === "teacher" || normalized === "centerAdmin";
}
async function resolveCenterMembershipRole(db, centerId, uid) {
    var _a;
    const [memberSnap, userCenterSnap] = await Promise.all([
        db.doc(`centers/${centerId}/members/${uid}`).get(),
        db.doc(`userCenters/${uid}/centers/${centerId}`).get(),
    ]);
    const memberData = memberSnap.exists ? memberSnap.data() : null;
    const memberRole = normalizeMembershipRole(memberData === null || memberData === void 0 ? void 0 : memberData.role);
    if (memberRole) {
        return { role: memberRole, status: memberData === null || memberData === void 0 ? void 0 : memberData.status };
    }
    const userCenterData = userCenterSnap.exists ? userCenterSnap.data() : null;
    const userCenterRole = normalizeMembershipRole(userCenterData === null || userCenterData === void 0 ? void 0 : userCenterData.role);
    return { role: userCenterRole || null, status: (_a = userCenterData === null || userCenterData === void 0 ? void 0 : userCenterData.status) !== null && _a !== void 0 ? _a : null };
}
function throwUserError(code, message, userMessage = message) {
    throw new functions.https.HttpsError(code, message, { userMessage });
}
async function assertStaffCanSync(db, centerId, uid) {
    const membership = await resolveCenterMembershipRole(db, centerId, uid);
    if (!membership.role || !isStaffRole(membership.role) || !isActiveMembershipStatus(membership.status)) {
        throwUserError("permission-denied", "Only active teachers or admins can sync attendance schedules.", "센터관리자 또는 선생님 계정에서만 등원일정 시트를 동기화할 수 있습니다.");
    }
    return membership;
}
function isValidDateKey(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function getKstDate(baseDate = new Date()) {
    return new Date(baseDate.toLocaleString("en-US", { timeZone: TIMEZONE }));
}
function toDateKey(date) {
    return [
        String(date.getFullYear()).padStart(4, "0"),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}
function getStudyDayKey(baseDate = new Date()) {
    const kstDate = getKstDate(baseDate);
    if (kstDate.getHours() < 1) {
        kstDate.setDate(kstDate.getDate() - 1);
    }
    kstDate.setHours(0, 0, 0, 0);
    return toDateKey(kstDate);
}
function addDaysToDateKey(dateKey, dayDelta) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + dayDelta);
    return [
        String(date.getUTCFullYear()).padStart(4, "0"),
        String(date.getUTCMonth() + 1).padStart(2, "0"),
        String(date.getUTCDate()).padStart(2, "0"),
    ].join("-");
}
function getWeekdayFromDateKey(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
function validateWeekStartKey(weekStartKey) {
    if (!isValidDateKey(weekStartKey) || getWeekdayFromDateKey(weekStartKey) !== 1) {
        throwUserError("invalid-argument", "weekStartKey must be a Monday date key.", "동기화 기준 주차의 월요일 날짜가 올바르지 않습니다.");
    }
}
function getProjectId() {
    if (typeof process.env.FIREBASE_CONFIG === "string" && process.env.FIREBASE_CONFIG.trim()) {
        try {
            const parsed = JSON.parse(process.env.FIREBASE_CONFIG);
            const parsedProjectId = asTrimmedString(parsed.projectId);
            if (parsedProjectId)
                return parsedProjectId;
        }
        catch (error) {
            console.warn("[attendance-sheet-sync] failed to parse FIREBASE_CONFIG", { error });
        }
    }
    return asTrimmedString(process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || admin.app().options.projectId);
}
function getServiceAccountEmail() {
    const explicitEmail = asTrimmedString(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.FUNCTIONS_SERVICE_ACCOUNT_EMAIL);
    if (explicitEmail)
        return explicitEmail;
    const projectId = getProjectId();
    return projectId ? `${projectId}@appspot.gserviceaccount.com` : "";
}
function quoteSheetName(sheetName) {
    return `'${sheetName.replace(/'/g, "''")}'`;
}
async function readIntegrationConfig(db, centerId) {
    const integrationSnap = await db.doc(`centers/${centerId}/integrations/${SHEET_SYNC_INTEGRATION_ID}`).get();
    const integration = (integrationSnap.data() || {});
    const spreadsheetId = asTrimmedString(integration.spreadsheetId);
    const sheetName = asTrimmedString(integration.sheetName, "등원일정");
    const enabled = integration.enabled === true;
    if (!enabled || !spreadsheetId || !sheetName) {
        throwUserError("failed-precondition", "Attendance schedule sheet integration is not configured.", "등원일정 시트 연결이 아직 설정되지 않았습니다.");
    }
    return { spreadsheetId, sheetName, enabled };
}
async function readSheetRows(params) {
    const auth = await googleapis_1.google.auth.getClient({
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = googleapis_1.google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: params.spreadsheetId,
        range: `${quoteSheetName(params.sheetName)}!${SHEET_SYNC_RANGE_COLUMNS}`,
        valueRenderOption: "FORMATTED_VALUE",
        dateTimeRenderOption: "FORMATTED_STRING",
    });
    return (response.data.values || []).map((row) => row.map((cell) => String(cell !== null && cell !== void 0 ? cell : "")));
}
function buildSheetHash(rows, params) {
    return (0, crypto_1.createHash)("sha256")
        .update(JSON.stringify(Object.assign(Object.assign({}, params), { rows })))
        .digest("hex");
}
function findColumnIndex(headers, candidates) {
    const candidateSet = candidates.map(normalizeHeaderText);
    const index = headers.findIndex((header) => candidateSet.some((candidate) => header === candidate || header.includes(candidate)));
    return index >= 0 ? index : null;
}
function buildHeaderColumnMap(headerRows) {
    const maxColumns = Math.max(...headerRows.map((row) => row.length), 0);
    const combinedHeaders = Array.from({ length: maxColumns }, (_, columnIndex) => normalizeHeaderText(headerRows.map((row) => row[columnIndex] || "").join(" ")));
    const days = {};
    DAY_DEFINITIONS.forEach((day) => {
        const dayColumns = {};
        DAY_FIELD_DEFINITIONS.forEach((field) => {
            const columnIndex = combinedHeaders.findIndex((header) => {
                const hasDay = header.includes(day.label) || header.includes(`${day.label}요일`);
                const hasField = field.labels.some((label) => header.includes(normalizeHeaderText(label)));
                return hasDay && hasField;
            });
            if (columnIndex >= 0) {
                dayColumns[field.key] = columnIndex;
            }
        });
        days[day.label] = dayColumns;
    });
    return {
        studentId: findColumnIndex(combinedHeaders, ["학생ID", "학생Id", "studentId", "uid"]),
        name: findColumnIndex(combinedHeaders, ["이름", "학생명", "학생이름", "name"]),
        school: findColumnIndex(combinedHeaders, ["학교", "학교명", "school"]),
        grade: findColumnIndex(combinedHeaders, ["학년", "grade"]),
        days,
    };
}
function scoreHeaderColumnMap(columnMap) {
    let score = 0;
    if (columnMap.studentId !== null)
        score += 3;
    if (columnMap.name !== null)
        score += 2;
    if (columnMap.school !== null)
        score += 1;
    if (columnMap.grade !== null)
        score += 1;
    DAY_DEFINITIONS.forEach((day) => {
        const dayColumns = columnMap.days[day.label] || {};
        if (dayColumns.status !== undefined)
            score += 1;
        if (dayColumns.arrival !== undefined)
            score += 1;
        if (dayColumns.departure !== undefined)
            score += 1;
    });
    return score;
}
function detectHeader(rows) {
    const candidates = [];
    const maxHeaderStart = Math.min(rows.length, 6);
    for (let rowIndex = 0; rowIndex < maxHeaderStart; rowIndex += 1) {
        const oneRowMap = buildHeaderColumnMap([rows[rowIndex] || []]);
        candidates.push({ columnMap: oneRowMap, dataStartIndex: rowIndex + 1, score: scoreHeaderColumnMap(oneRowMap) });
        if (rowIndex + 1 < rows.length) {
            const twoRowMap = buildHeaderColumnMap([rows[rowIndex] || [], rows[rowIndex + 1] || []]);
            candidates.push({ columnMap: twoRowMap, dataStartIndex: rowIndex + 2, score: scoreHeaderColumnMap(twoRowMap) });
        }
    }
    const best = candidates.sort((left, right) => right.score - left.score || left.dataStartIndex - right.dataStartIndex)[0];
    const columnMap = (best === null || best === void 0 ? void 0 : best.columnMap) || buildHeaderColumnMap([]);
    const errors = [];
    if (columnMap.studentId === null)
        errors.push({ message: "필수 컬럼 `학생ID`를 찾지 못했습니다." });
    if (columnMap.name === null)
        errors.push({ message: "필수 컬럼 `이름`을 찾지 못했습니다." });
    if (columnMap.school === null)
        errors.push({ message: "필수 컬럼 `학교`를 찾지 못했습니다." });
    if (columnMap.grade === null)
        errors.push({ message: "필수 컬럼 `학년`을 찾지 못했습니다." });
    DAY_DEFINITIONS.forEach((day) => {
        const dayColumns = columnMap.days[day.label] || {};
        DAY_FIELD_DEFINITIONS.forEach((field) => {
            if (dayColumns[field.key] === undefined) {
                errors.push({ weekdayLabel: day.label, field: field.key, message: `${day.label}요일 ${field.labels[0]} 컬럼을 찾지 못했습니다.` });
            }
        });
    });
    return { columnMap, dataStartIndex: (best === null || best === void 0 ? void 0 : best.dataStartIndex) || 1, errors };
}
function normalizeSheetStatus(value) {
    const normalized = value.trim().replace(/\s+/g, "");
    if (!normalized)
        return null;
    if (normalized === "정규")
        return "scheduled";
    if (normalized === "자율" || normalized === "자율등원")
        return "autonomous";
    if (normalized === "미등원")
        return "absent";
    return null;
}
function timeToMinutes(value) {
    if (!SCHEDULE_TIME_PATTERN.test(value))
        return null;
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
}
function toOperationalMinutes(value, arrivalMinutes, departureMinutes) {
    const minutes = timeToMinutes(value);
    if (minutes === null)
        return null;
    return departureMinutes <= arrivalMinutes && minutes < arrivalMinutes ? minutes + SCHEDULE_DAY_MINUTES : minutes;
}
function makeFallbackKey(params) {
    return [params.name, params.school, params.grade].map(normalizeLookupText).join("|");
}
async function loadStudentsForCenter(db, centerId) {
    const membersSnap = await db
        .collection(`centers/${centerId}/members`)
        .where("role", "==", "student")
        .get();
    const memberDocs = membersSnap.docs.filter((docSnap) => { var _a; return isActiveMembershipStatus((_a = docSnap.data()) === null || _a === void 0 ? void 0 : _a.status); });
    const profileSnaps = await Promise.all(memberDocs.map((memberDoc) => db.doc(`centers/${centerId}/students/${memberDoc.id}`).get()));
    const studentsById = new Map();
    const fallbackStudentIdsByKey = new Map();
    memberDocs.forEach((memberDoc, index) => {
        const memberData = memberDoc.data();
        const profileData = profileSnaps[index].exists ? (profileSnaps[index].data() || {}) : {};
        const studentId = memberDoc.id;
        const studentName = asTrimmedString(profileData.name || profileData.displayName || memberData.displayName, "학생");
        const schoolName = asTrimmedString(profileData.schoolName || memberData.schoolName);
        const grade = asTrimmedString(profileData.grade || memberData.grade);
        const record = { id: studentId, studentName, schoolName, grade };
        studentsById.set(studentId, record);
        const fallbackKey = makeFallbackKey({ name: studentName, school: schoolName, grade });
        if (fallbackKey.replace(/\|/g, "")) {
            fallbackStudentIdsByKey.set(fallbackKey, [...(fallbackStudentIdsByKey.get(fallbackKey) || []), studentId]);
        }
    });
    return { studentsById, fallbackStudentIdsByKey };
}
function readCell(row, columnIndex) {
    if (columnIndex === null || columnIndex === undefined)
        return "";
    return asTrimmedString(row[columnIndex]);
}
function rowHasAnyScheduleValue(row, columnMap) {
    return DAY_DEFINITIONS.some((day) => {
        const dayColumns = columnMap.days[day.label] || {};
        return DAY_FIELD_DEFINITIONS.some((field) => readCell(row, dayColumns[field.key]));
    });
}
function validateScheduledDay(day) {
    if (!day.arrivalTime || !day.departureTime)
        return "정규 일정은 등원/하원 시간을 모두 입력해야 합니다.";
    const arrivalMinutes = timeToMinutes(day.arrivalTime);
    const departureMinutes = timeToMinutes(day.departureTime);
    if (arrivalMinutes === null || departureMinutes === null)
        return "시간은 HH:mm 형식으로 입력해 주세요.";
    const adjustedDepartureMinutes = departureMinutes <= arrivalMinutes ? departureMinutes + SCHEDULE_DAY_MINUTES : departureMinutes;
    if (adjustedDepartureMinutes <= arrivalMinutes)
        return "하원 시간은 등원 시간 이후여야 합니다.";
    const hasAwayValue = Boolean(day.awayStartTime || day.awayEndTime || day.awayReason);
    if (!hasAwayValue)
        return null;
    if (!day.awayStartTime || !day.awayEndTime)
        return "외출 시작과 복귀 시간을 모두 입력해야 합니다.";
    const awayStartMinutes = toOperationalMinutes(day.awayStartTime, arrivalMinutes, departureMinutes);
    let awayEndMinutes = toOperationalMinutes(day.awayEndTime, arrivalMinutes, departureMinutes);
    if (awayStartMinutes === null || awayEndMinutes === null)
        return "외출 시간은 HH:mm 형식으로 입력해 주세요.";
    if (awayEndMinutes <= awayStartMinutes)
        awayEndMinutes += SCHEDULE_DAY_MINUTES;
    if (awayStartMinutes < arrivalMinutes || awayEndMinutes > adjustedDepartureMinutes) {
        return "외출 일정은 등원~하원 시간 안에 있어야 합니다.";
    }
    return null;
}
function parseSheetRows(params) {
    const parsedDays = [];
    const matchedStudentIds = new Set();
    const seenStudentIds = new Map();
    const errors = [];
    const warnings = [];
    let skippedPastCount = 0;
    let totalSheetRows = 0;
    params.rows.slice(params.dataStartIndex).forEach((row, relativeIndex) => {
        const rowIndex = params.dataStartIndex + relativeIndex;
        const rowNumber = rowIndex + 1;
        const sheetStudentId = readCell(row, params.columnMap.studentId);
        const sheetStudentName = readCell(row, params.columnMap.name);
        const sheetSchool = readCell(row, params.columnMap.school);
        const sheetGrade = readCell(row, params.columnMap.grade);
        if (!sheetStudentId && !sheetStudentName && !sheetSchool && !sheetGrade && !rowHasAnyScheduleValue(row, params.columnMap)) {
            return;
        }
        totalSheetRows += 1;
        let matchedStudent = null;
        if (sheetStudentId) {
            matchedStudent = params.studentsById.get(sheetStudentId) || null;
            if (!matchedStudent) {
                errors.push({ rowNumber, studentName: sheetStudentName || null, message: `학생ID ${sheetStudentId} 학생을 센터에서 찾지 못했습니다.` });
                return;
            }
        }
        else {
            const fallbackKey = makeFallbackKey({ name: sheetStudentName, school: sheetSchool, grade: sheetGrade });
            const fallbackIds = params.fallbackStudentIdsByKey.get(fallbackKey) || [];
            if (fallbackIds.length === 1) {
                matchedStudent = params.studentsById.get(fallbackIds[0]) || null;
            }
            else if (fallbackIds.length > 1) {
                errors.push({ rowNumber, studentName: sheetStudentName || null, message: "이름+학교+학년이 같은 학생이 여러 명입니다. 학생ID를 입력해 주세요." });
                return;
            }
            else {
                errors.push({ rowNumber, studentName: sheetStudentName || null, message: "학생을 매칭하지 못했습니다. 학생ID를 입력해 주세요." });
                return;
            }
        }
        if (!matchedStudent)
            return;
        const previousRowNumber = seenStudentIds.get(matchedStudent.id);
        if (previousRowNumber) {
            errors.push({ rowNumber, studentName: matchedStudent.studentName, message: `${previousRowNumber}행과 같은 학생이 중복 입력되었습니다.` });
            return;
        }
        seenStudentIds.set(matchedStudent.id, rowNumber);
        matchedStudentIds.add(matchedStudent.id);
        DAY_DEFINITIONS.forEach((day) => {
            const dayColumns = params.columnMap.days[day.label] || {};
            const statusRaw = readCell(row, dayColumns.status);
            const arrivalTime = readCell(row, dayColumns.arrival);
            const departureTime = readCell(row, dayColumns.departure) || (arrivalTime ? SHEET_SYNC_DEFAULT_DEPARTURE_TIME : "");
            const awayStartTime = readCell(row, dayColumns.awayStart);
            const awayEndTime = readCell(row, dayColumns.awayEnd);
            const awayReason = readCell(row, dayColumns.awayReason).slice(0, 160);
            const hasAnyDayValue = Boolean(statusRaw || arrivalTime || departureTime || awayStartTime || awayEndTime || awayReason);
            if (!hasAnyDayValue)
                return;
            const statusMode = normalizeSheetStatus(statusRaw);
            if (statusRaw && !statusMode) {
                errors.push({
                    rowNumber,
                    studentName: (matchedStudent === null || matchedStudent === void 0 ? void 0 : matchedStudent.studentName) || null,
                    weekdayLabel: day.label,
                    field: "상태",
                    message: "상태는 정규, 자율, 미등원, 공백 중 하나로 입력해 주세요.",
                });
                return;
            }
            const mode = statusMode || "scheduled";
            const dateKey = addDaysToDateKey(params.weekStartKey, day.offset);
            if (dateKey < params.todayKey) {
                skippedPastCount += 1;
                warnings.push({
                    rowNumber,
                    studentName: matchedStudent.studentName,
                    dateKey,
                    weekdayLabel: day.label,
                    message: "오늘 이전 날짜는 v1에서 반영하지 않고 건너뜁니다.",
                });
                return;
            }
            const parsedDay = {
                studentId: matchedStudent.id,
                studentName: matchedStudent.studentName,
                rowNumber,
                dateKey,
                weekday: day.weekday,
                weekdayLabel: day.label,
                mode,
                arrivalTime: mode === "scheduled" ? arrivalTime : "",
                departureTime: mode === "scheduled" ? departureTime : "",
                awayStartTime: mode === "scheduled" ? awayStartTime : "",
                awayEndTime: mode === "scheduled" ? awayEndTime : "",
                awayReason: mode === "scheduled" ? awayReason : "",
            };
            if (mode === "scheduled") {
                const validationMessage = validateScheduledDay(parsedDay);
                if (validationMessage) {
                    errors.push({
                        rowNumber,
                        studentName: matchedStudent.studentName,
                        dateKey,
                        weekdayLabel: day.label,
                        message: validationMessage,
                    });
                    return;
                }
            }
            parsedDays.push(parsedDay);
        });
    });
    return { parsedDays, totalSheetRows, matchedStudentIds, skippedPastCount, errors, warnings };
}
function summarizeExistingSchedule(schedule) {
    if (!schedule)
        return "저장 일정 없음";
    if (schedule.isAbsent || schedule.status === "absent")
        return "미등원";
    if (schedule.isAutonomousAttendance)
        return "자율등원";
    const arrival = asTrimmedString(schedule.arrivalPlannedAt || schedule.inTime);
    const departure = asTrimmedString(schedule.departurePlannedAt || schedule.outTime);
    const outing = schedule.hasExcursion && schedule.excursionStartAt && schedule.excursionEndAt
        ? ` · 외출 ${schedule.excursionStartAt}~${schedule.excursionEndAt}${schedule.excursionReason ? ` ${schedule.excursionReason}` : ""}`
        : "";
    return arrival && departure ? `${arrival}~${departure}${outing}` : "시간 미정";
}
function summarizeParsedDay(day) {
    if (day.mode === "absent")
        return "미등원";
    if (day.mode === "autonomous")
        return "자율등원";
    const outing = day.awayStartTime && day.awayEndTime
        ? ` · 외출 ${day.awayStartTime}~${day.awayEndTime}${day.awayReason ? ` ${day.awayReason}` : ""}`
        : "";
    return `${day.arrivalTime}~${day.departureTime}${outing}`;
}
function buildComparableSchedule(day) {
    if (day.mode === "absent") {
        return {
            isAbsent: true,
            isAutonomousAttendance: false,
            arrivalPlannedAt: "",
            departurePlannedAt: "",
            hasExcursion: false,
            excursionStartAt: null,
            excursionEndAt: null,
            excursionReason: null,
        };
    }
    if (day.mode === "autonomous") {
        return {
            isAbsent: false,
            isAutonomousAttendance: true,
            arrivalPlannedAt: "",
            departurePlannedAt: "",
            hasExcursion: false,
            excursionStartAt: null,
            excursionEndAt: null,
            excursionReason: null,
        };
    }
    return {
        isAbsent: false,
        isAutonomousAttendance: false,
        arrivalPlannedAt: day.arrivalTime,
        departurePlannedAt: day.departureTime,
        hasExcursion: Boolean(day.awayStartTime && day.awayEndTime),
        excursionStartAt: day.awayStartTime || null,
        excursionEndAt: day.awayEndTime || null,
        excursionReason: day.awayReason || null,
    };
}
function hasScheduleChanged(existing, day) {
    const next = buildComparableSchedule(day);
    return (Boolean((existing === null || existing === void 0 ? void 0 : existing.isAbsent) || (existing === null || existing === void 0 ? void 0 : existing.status) === "absent") !== next.isAbsent ||
        Boolean(existing === null || existing === void 0 ? void 0 : existing.isAutonomousAttendance) !== next.isAutonomousAttendance ||
        asTrimmedString((existing === null || existing === void 0 ? void 0 : existing.arrivalPlannedAt) || (existing === null || existing === void 0 ? void 0 : existing.inTime)) !== next.arrivalPlannedAt ||
        asTrimmedString((existing === null || existing === void 0 ? void 0 : existing.departurePlannedAt) || (existing === null || existing === void 0 ? void 0 : existing.outTime)) !== next.departurePlannedAt ||
        Boolean(existing === null || existing === void 0 ? void 0 : existing.hasExcursion) !== next.hasExcursion ||
        ((existing === null || existing === void 0 ? void 0 : existing.excursionStartAt) || null) !== next.excursionStartAt ||
        ((existing === null || existing === void 0 ? void 0 : existing.excursionEndAt) || null) !== next.excursionEndAt ||
        ((existing === null || existing === void 0 ? void 0 : existing.excursionReason) || null) !== next.excursionReason);
}
async function buildPreviewChanges(db, parsedDays) {
    const scheduleSnaps = await Promise.all(parsedDays.map((day) => db.doc(`users/${day.studentId}/schedules/${day.dateKey}`).get()));
    const existingByKey = new Map();
    const changes = [];
    parsedDays.forEach((day, index) => {
        const existing = scheduleSnaps[index].exists
            ? (scheduleSnaps[index].data() || {})
            : null;
        existingByKey.set(`${day.studentId}:${day.dateKey}`, existing);
        if (!hasScheduleChanged(existing, day))
            return;
        changes.push({
            studentId: day.studentId,
            studentName: day.studentName,
            rowNumber: day.rowNumber,
            dateKey: day.dateKey,
            weekdayLabel: day.weekdayLabel,
            mode: day.mode,
            previousSummary: summarizeExistingSchedule(existing),
            nextSummary: summarizeParsedDay(day),
        });
    });
    return { changes, existingByKey };
}
async function buildSheetSyncPreview(params) {
    const { spreadsheetId, sheetName } = await readIntegrationConfig(params.db, params.centerId);
    const rows = await readSheetRows({ spreadsheetId, sheetName });
    const sheetHash = buildSheetHash(rows, { spreadsheetId, sheetName, weekStartKey: params.weekStartKey });
    const { columnMap, dataStartIndex, errors: headerErrors } = detectHeader(rows);
    const { studentsById, fallbackStudentIdsByKey } = await loadStudentsForCenter(params.db, params.centerId);
    const todayKey = getStudyDayKey();
    const parsed = headerErrors.length > 0
        ? {
            parsedDays: [],
            totalSheetRows: 0,
            matchedStudentIds: new Set(),
            skippedPastCount: 0,
            errors: [],
            warnings: [],
        }
        : parseSheetRows({
            rows,
            columnMap,
            dataStartIndex,
            studentsById,
            fallbackStudentIdsByKey,
            weekStartKey: params.weekStartKey,
            todayKey,
        });
    const errors = [...headerErrors, ...parsed.errors];
    const { changes } = errors.length === 0
        ? await buildPreviewChanges(params.db, parsed.parsedDays)
        : { changes: [] };
    return {
        ok: errors.length === 0,
        configured: true,
        serviceAccountEmail: getServiceAccountEmail(),
        spreadsheetId,
        sheetName,
        weekStartKey: params.weekStartKey,
        sheetHash,
        generatedAt: new Date().toISOString(),
        totalSheetRows: parsed.totalSheetRows,
        matchedStudentCount: parsed.matchedStudentIds.size,
        parsedScheduleCount: parsed.parsedDays.length,
        changeCount: changes.length,
        skippedPastCount: parsed.skippedPastCount,
        errorCount: errors.length,
        warningCount: parsed.warnings.length,
        errors,
        warnings: parsed.warnings,
        changes,
        parsedDays: parsed.parsedDays,
    };
}
function buildOutingsForDay(day) {
    if (day.mode !== "scheduled" || !day.awayStartTime || !day.awayEndTime)
        return [];
    return [{
            id: "sheet-primary",
            kind: "outing",
            title: null,
            startTime: day.awayStartTime,
            endTime: day.awayEndTime,
            reason: day.awayReason || null,
        }];
}
function getScheduleStatusForApply(existing, day) {
    if (day.mode === "absent")
        return "absent";
    const existingStatus = asTrimmedString(existing === null || existing === void 0 ? void 0 : existing.status);
    if (["checked_in", "excursion", "checked_out"].includes(existingStatus))
        return existingStatus;
    return "scheduled";
}
function buildSchedulePatch(params) {
    const { day } = params;
    const isAbsent = day.mode === "absent";
    const isAutonomous = day.mode === "autonomous";
    const outings = buildOutingsForDay(day);
    const primaryOuting = outings[0] || null;
    return Object.assign({ uid: day.studentId, studentName: day.studentName, centerId: params.centerId, dateKey: day.dateKey, timezone: TIMEZONE, arrivalPlannedAt: isAutonomous || isAbsent ? "" : day.arrivalTime, departurePlannedAt: isAutonomous || isAbsent ? "" : day.departureTime, inTime: isAutonomous || isAbsent ? "" : day.arrivalTime, outTime: isAutonomous || isAbsent ? "" : day.departureTime, isAbsent, isAutonomousAttendance: isAutonomous, status: getScheduleStatusForApply(params.existing, day), hasExcursion: outings.length > 0, excursionStartAt: (primaryOuting === null || primaryOuting === void 0 ? void 0 : primaryOuting.startTime) || null, excursionEndAt: (primaryOuting === null || primaryOuting === void 0 ? void 0 : primaryOuting.endTime) || null, excursionReason: (primaryOuting === null || primaryOuting === void 0 ? void 0 : primaryOuting.reason) || null, outings, source: "manual", recurrenceSourceId: null, classScheduleId: null, classScheduleName: isAutonomous ? "자율등원" : null, adminEdited: true, adminEditedAt: params.savedAt, adminEditedByUid: params.callerUid, adminDirectEditNoPenalty: true, sheetScheduleSync: true, sheetScheduleSyncAt: params.savedAt, updatedAt: params.savedAt }, (isAbsent
        ? {
            actualArrivalAt: null,
            actualDepartureAt: null,
            note: null,
            recommendedStudyMinutes: null,
            recommendedWeeklyDays: null,
        }
        : {}));
}
async function commitInChunks(db, writes) {
    for (let startIndex = 0; startIndex < writes.length; startIndex += SHEET_SYNC_BATCH_LIMIT) {
        const batch = db.batch();
        writes.slice(startIndex, startIndex + SHEET_SYNC_BATCH_LIMIT).forEach((write) => write(batch));
        await batch.commit();
    }
}
async function applySheetSync(params) {
    const preview = await buildSheetSyncPreview({
        db: params.db,
        centerId: params.centerId,
        weekStartKey: params.weekStartKey,
    });
    if (preview.sheetHash !== params.sheetHash) {
        throwUserError("failed-precondition", "Sheet changed after preview.", "미리보기 이후 시트가 변경되었습니다. 다시 시트 불러오기를 실행해 주세요.");
    }
    if (!preview.ok || preview.errorCount > 0) {
        throwUserError("invalid-argument", "Sheet preview has errors.", "오류가 있는 시트는 반영할 수 없습니다. 미리보기 오류를 먼저 수정해 주세요.");
    }
    const { existingByKey } = await buildPreviewChanges(params.db, preview.parsedDays);
    const changedKeys = new Set(preview.changes.map((change) => `${change.studentId}:${change.dateKey}`));
    const savedAt = admin.firestore.FieldValue.serverTimestamp();
    const deleteField = admin.firestore.FieldValue.delete();
    const writes = [];
    preview.parsedDays
        .filter((day) => changedKeys.has(`${day.studentId}:${day.dateKey}`))
        .forEach((day) => {
        const existing = existingByKey.get(`${day.studentId}:${day.dateKey}`) || null;
        const isAbsent = day.mode === "absent";
        const isAutonomous = day.mode === "autonomous";
        const outings = buildOutingsForDay(day);
        const primaryOuting = outings[0] || null;
        const inTime = isAutonomous || isAbsent ? "" : day.arrivalTime;
        const outTime = isAutonomous || isAbsent ? "" : day.departureTime;
        writes.push((batch) => {
            batch.set(params.db.doc(`users/${day.studentId}/schedules/${day.dateKey}`), buildSchedulePatch({
                centerId: params.centerId,
                day,
                existing,
                savedAt,
                callerUid: params.callerUid,
            }), { merge: true });
        });
        writes.push((batch) => {
            batch.set(params.db.doc(`centers/${params.centerId}/attendanceRecords/${day.dateKey}/students/${day.studentId}`), Object.assign(Object.assign({ centerId: params.centerId, studentId: day.studentId, studentName: day.studentName, dateKey: day.dateKey, scheduleEditedByAdminAt: savedAt, scheduleEditedByAdminUid: params.callerUid, scheduleEditPenaltyWaived: true, isAutonomousAttendance: isAutonomous, adminDirectEditNoPenalty: true, sheetScheduleSync: true, sheetScheduleSyncAt: savedAt, penaltyApplied: false, penaltyPointsDelta: 0, penaltyWaived: true }, (isAbsent
                ? {
                    status: "excused_absent",
                    statusSource: "manual",
                    statusUpdatedAt: savedAt,
                }
                : {
                    routineMissingAtCheckIn: deleteField,
                    routineMissingPenaltyApplied: deleteField,
                })), { updatedAt: savedAt }), { merge: true });
        });
        writes.push((batch) => {
            batch.set(params.db.doc(`centers/${params.centerId}/dailyStudentStats/${day.dateKey}/students/${day.studentId}`), {
                centerId: params.centerId,
                studentId: day.studentId,
                dateKey: day.dateKey,
                expectedArrivalTime: inTime,
                plannedDepartureTime: outTime,
                isAutonomousAttendance: isAutonomous,
                hasExcursion: outings.length > 0,
                excursionStartAt: (primaryOuting === null || primaryOuting === void 0 ? void 0 : primaryOuting.startTime) || null,
                excursionEndAt: (primaryOuting === null || primaryOuting === void 0 ? void 0 : primaryOuting.endTime) || null,
                excursionReason: (primaryOuting === null || primaryOuting === void 0 ? void 0 : primaryOuting.reason) || null,
                scheduleEditedByAdminAt: savedAt,
                scheduleEditedByAdminUid: params.callerUid,
                scheduleEditPenaltyWaived: true,
                adminDirectEditNoPenalty: true,
                sheetScheduleSync: true,
                sheetScheduleSyncAt: savedAt,
                penaltyApplied: false,
                penaltyPointsDelta: 0,
                penaltyWaived: true,
                updatedAt: savedAt,
            }, { merge: true });
        });
    });
    await commitInChunks(params.db, writes);
    await params.db.doc(`centers/${params.centerId}/integrations/${SHEET_SYNC_INTEGRATION_ID}`).set({
        lastAppliedAt: savedAt,
        lastAppliedByUid: params.callerUid,
        lastAppliedWeekStartKey: params.weekStartKey,
        lastAppliedChangeCount: preview.changeCount,
        lastAppliedSheetHash: params.sheetHash,
        updatedAt: savedAt,
    }, { merge: true });
    const { parsedDays: _parsedDays } = preview, publicPreview = __rest(preview, ["parsedDays"]);
    return {
        ok: true,
        appliedChangeCount: preview.changeCount,
        skippedPastCount: preview.skippedPastCount,
        preview: Object.assign(Object.assign({}, publicPreview), { changes: [], changeCount: 0, generatedAt: new Date().toISOString() }),
    };
}
exports.previewAttendanceScheduleSheetSync = functions.region(region).runWith({
    timeoutSeconds: 120,
    memory: "512MB",
}).https.onCall(async (data, context) => {
    const db = admin.firestore();
    if (!context.auth) {
        throwUserError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    const weekStartKey = asTrimmedString(data === null || data === void 0 ? void 0 : data.weekStartKey);
    if (!centerId || !weekStartKey) {
        throwUserError("invalid-argument", "centerId and weekStartKey are required.", "센터와 주차 정보가 필요합니다.");
    }
    validateWeekStartKey(weekStartKey);
    await assertStaffCanSync(db, centerId, context.auth.uid);
    const preview = await buildSheetSyncPreview({ db, centerId, weekStartKey });
    await db.doc(`centers/${centerId}/integrations/${SHEET_SYNC_INTEGRATION_ID}`).set({
        lastPreviewAt: admin.firestore.FieldValue.serverTimestamp(),
        lastPreviewByUid: context.auth.uid,
        lastPreviewWeekStartKey: weekStartKey,
        lastPreviewErrorCount: preview.errorCount,
        lastPreviewChangeCount: preview.changeCount,
        lastPreviewSheetHash: preview.sheetHash,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    const { parsedDays: _parsedDays } = preview, publicPreview = __rest(preview, ["parsedDays"]);
    return publicPreview;
});
exports.applyAttendanceScheduleSheetSync = functions.region(region).runWith({
    timeoutSeconds: 120,
    memory: "512MB",
}).https.onCall(async (data, context) => {
    const db = admin.firestore();
    if (!context.auth) {
        throwUserError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    const weekStartKey = asTrimmedString(data === null || data === void 0 ? void 0 : data.weekStartKey);
    const sheetHash = asTrimmedString(data === null || data === void 0 ? void 0 : data.sheetHash);
    if (!centerId || !weekStartKey || !sheetHash) {
        throwUserError("invalid-argument", "centerId, weekStartKey, and sheetHash are required.", "센터, 주차, 미리보기 해시 정보가 필요합니다.");
    }
    validateWeekStartKey(weekStartKey);
    await assertStaffCanSync(db, centerId, context.auth.uid);
    const result = await applySheetSync({
        db,
        centerId,
        callerUid: context.auth.uid,
        weekStartKey,
        sheetHash,
    });
    return result;
});
//# sourceMappingURL=attendanceScheduleSheetSync.js.map