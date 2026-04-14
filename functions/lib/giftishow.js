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
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcilePendingGiftishowOrders = exports.resendGiftishowOrderSecure = exports.cancelGiftishowOrderSecure = exports.rejectGiftishowOrderSecure = exports.approveGiftishowOrderSecure = exports.createGiftishowOrderRequestSecure = exports.getGiftishowBizmoneySecure = exports.scheduledGiftishowCatalogSync = exports.syncGiftishowCatalogSecure = exports.saveGiftishowSettingsSecure = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const region = "asia-northeast3";
const GIFTISHOW_BASE_URL = "https://bizapi.giftishow.com/bizApi";
const GIFTISHOW_SEND_URL = "https://bizapi.giftishow.com/coupon/send";
const GIFTISHOW_CATALOG_PAGE_SIZE = 100;
const GIFTISHOW_SYNC_BATCH_LIMIT = 320;
const GIFTISHOW_SEND_TIMEOUT_MS = 14000;
const GIFTISHOW_MANUAL_REVIEW_THRESHOLD = 3;
const GIFTISHOW_SECRET_NAMES = [
    "GIFTISHOW_AUTH_CODE",
    "GIFTISHOW_AUTH_TOKEN",
];
const giftishowSecureFunctions = functions
    .region(region)
    .runWith({ secrets: [...GIFTISHOW_SECRET_NAMES] });
class GiftishowProviderError extends Error {
    constructor(code, message, retryable = false) {
        super(message);
        this.code = code;
        this.retryable = retryable;
        this.name = "GiftishowProviderError";
    }
}
class GiftishowTimeoutError extends Error {
    constructor(message = "Giftishow request timed out.") {
        super(message);
        this.name = "GiftishowTimeoutError";
    }
}
class MockGiftishowClient {
    constructor() {
        this.mode = "mock";
    }
    async listGoodsPage(start, size) {
        const all = buildMockGiftishowGoods();
        const sliceStart = Math.max(0, start);
        const sliceEnd = Math.min(all.length, sliceStart + Math.max(1, size));
        return {
            items: all.slice(sliceStart, sliceEnd),
            totalCount: all.length,
        };
    }
    async getGoodsDetail(goodsCode) {
        return buildMockGiftishowGoods().find((item) => asTrimmedString(item.goodsCode) === goodsCode) || null;
    }
    async listBrands() {
        var _a;
        const brandMap = new Map();
        for (const item of buildMockGiftishowGoods()) {
            const brandCode = asTrimmedString(item.brandCode);
            if (!brandCode)
                continue;
            if (!brandMap.has(brandCode)) {
                brandMap.set(brandCode, {
                    brandCode,
                    brandName: asTrimmedString(item.brandName) || brandCode,
                    brandIconImg: asTrimmedString(item.brandIconImg) || asTrimmedString(item.goodsImgS) || null,
                    goodsCount: 0,
                });
            }
            const current = brandMap.get(brandCode);
            if (current) {
                current.goodsCount = Math.max(0, Math.floor((_a = parseFiniteNumber(current.goodsCount)) !== null && _a !== void 0 ? _a : 0)) + 1;
            }
        }
        const items = [...brandMap.values()];
        return { items, totalCount: items.length };
    }
    async getBrandDetail(brandCode) {
        const brand = (await this.listBrands()).items.find((item) => asTrimmedString(item.brandCode) === brandCode);
        return brand || null;
    }
    async getBizmoney() {
        return 250000;
    }
    async sendCoupon(_input) {
        const scenario = getMockScenario();
        if (scenario === "timeout") {
            throw new GiftishowTimeoutError("Mock Giftishow timeout.");
        }
        if (scenario === "no-balance") {
            throw new GiftishowProviderError("E0010", "비즈머니 잔액이 부족합니다.");
        }
        if (scenario === "duplicate") {
            throw new GiftishowProviderError("ERR0215", "중복된 TR_ID 입니다.");
        }
        if (scenario === "bad-phone") {
            throw new GiftishowProviderError("ERR0817", "수신전화번호 형식이 올바르지 않습니다.");
        }
        if (scenario === "send-fail") {
            throw new GiftishowProviderError("MOCK-FAILED", "Mock provider send failure.");
        }
        return {
            orderNo: `MOCK-${Date.now()}`,
            code: "0000",
            message: "SUCCESS",
        };
    }
    async getCoupon(_trId) {
        const timeoutResult = asTrimmedString(process.env.GIFTISHOW_MOCK_TIMEOUT_RESULT, "sent").toLowerCase();
        if (getMockScenario() === "timeout" && timeoutResult === "missing") {
            return { found: false };
        }
        return {
            found: true,
            orderNo: `MOCK-${Date.now()}`,
            pinNo: "1234 5678 0000",
            couponImgUrl: "https://example.com/mock-giftishow-coupon.png",
            sendStatusCode: "1000",
            sendStatusName: "발송완료",
            pinStatusCode: "01",
            pinStatusName: "사용가능",
            validPrdEndDt: "2099-12-31",
        };
    }
    async cancelCoupon(_trId) {
        if (getMockScenario() === "cancel-already") {
            return { alreadyCancelled: true };
        }
        if (getMockScenario() === "cancel-fail") {
            throw new GiftishowProviderError("MOCK-CANCEL", "Mock cancel failure.");
        }
        return {};
    }
    async resendCoupon(_trId) {
        if (getMockScenario() === "resend-fail") {
            throw new GiftishowProviderError("MOCK-RESEND", "Mock resend failure.");
        }
    }
}
class LiveGiftishowClient {
    constructor(credentials) {
        this.credentials = credentials;
        this.mode = "live";
    }
    async listGoodsPage(start, size) {
        var _a;
        const payload = await this.postForm("/goods", {
            api_code: "0101",
            custom_auth_code: requireCredential(this.credentials.authCode, "authCode"),
            custom_auth_token: requireCredential(this.credentials.authToken, "authToken"),
            dev_yn: "N",
            start,
            size,
        });
        assertGiftishowSuccess(payload, "상품 목록 조회");
        const result = asRecord(payload.result) || payload;
        const items = Array.isArray(result.goodsList)
            ? result.goodsList.filter((item) => isPlainObject(item))
            : [];
        const totalCount = Math.max(items.length, Math.floor((_a = parseFiniteNumber(result.totalCount)) !== null && _a !== void 0 ? _a : items.length));
        return { items, totalCount };
    }
    async getGoodsDetail(goodsCode) {
        const payload = await this.postForm(`/goods/${encodeURIComponent(goodsCode)}`, {
            api_code: "0102",
            custom_auth_code: requireCredential(this.credentials.authCode, "authCode"),
            custom_auth_token: requireCredential(this.credentials.authToken, "authToken"),
            dev_yn: "N",
            goods_code: goodsCode,
        });
        assertGiftishowSuccess(payload, "상품 상세 조회");
        return findFirstGiftishowRecord(payload, ["goodsCode", "goods_code"]);
    }
    async listBrands() {
        var _a, _b, _c;
        const payload = await this.postForm("/brands", {
            api_code: "0103",
            custom_auth_code: requireCredential(this.credentials.authCode, "authCode"),
            custom_auth_token: requireCredential(this.credentials.authToken, "authToken"),
            dev_yn: "N",
        });
        assertGiftishowSuccess(payload, "브랜드 조회");
        const items = findGiftishowRecords(payload, ["brandCode", "brand_code"]).filter((item) => readGiftishowString(item, "brandCode", "brand_code").length > 0);
        return {
            items,
            totalCount: Math.max(items.length, Math.floor((_c = parseFiniteNumber((_b = (_a = asRecord(payload.result)) === null || _a === void 0 ? void 0 : _a.totalCount) !== null && _b !== void 0 ? _b : payload.totalCount)) !== null && _c !== void 0 ? _c : items.length)),
        };
    }
    async getBrandDetail(brandCode) {
        const payload = await this.postForm("/brands", {
            api_code: "0104",
            custom_auth_code: requireCredential(this.credentials.authCode, "authCode"),
            custom_auth_token: requireCredential(this.credentials.authToken, "authToken"),
            dev_yn: "N",
            brand_code: brandCode,
        });
        assertGiftishowSuccess(payload, "브랜드 상세 조회");
        return findFirstGiftishowRecord(payload, ["brandCode", "brand_code"]);
    }
    async getBizmoney() {
        var _a, _b;
        const payload = await this.postForm("/bizmoney", {
            api_code: "0301",
            custom_auth_code: requireCredential(this.credentials.authCode, "authCode"),
            custom_auth_token: requireCredential(this.credentials.authToken, "authToken"),
            user_id: requireCredential(this.credentials.userId, "userId"),
            dev_yn: "N",
        });
        assertGiftishowSuccess(payload, "비즈머니 조회");
        const result = asRecord(payload.result) || payload;
        const balance = Math.floor((_b = parseFiniteNumber((_a = result.balance) !== null && _a !== void 0 ? _a : payload.balance)) !== null && _b !== void 0 ? _b : Number.NaN);
        if (!Number.isFinite(balance)) {
            throw new GiftishowProviderError("BIZMONEY_PARSE", "비즈머니 잔액을 확인하지 못했습니다.");
        }
        return Math.max(0, balance);
    }
    async sendCoupon(input) {
        const callbackNo = requireCredential(this.credentials.callbackNo, "callbackNo");
        assertGiftishowSendLimits(input.trId, input.mmsTitle);
        const payload = await this.postForm(GIFTISHOW_SEND_URL, {
            api_code: "0204",
            custom_auth_code: requireCredential(this.credentials.authCode, "authCode"),
            custom_auth_token: requireCredential(this.credentials.authToken, "authToken"),
            user_id: requireCredential(this.credentials.userId, "userId"),
            dev_yn: "N",
            gubun: "N",
            goods_code: input.goodsCode,
            order_no: input.orderNo,
            phone_no: input.phoneNo,
            callback_no: callbackNo,
            mms_title: input.mmsTitle,
            mms_msg: input.mmsMsg,
            banner_id: asTrimmedString(this.credentials.bannerId) || undefined,
            template_id: asTrimmedString(this.credentials.templateId) || undefined,
            tr_id: input.trId,
        }, GIFTISHOW_SEND_TIMEOUT_MS);
        assertGiftishowSuccess(payload, "쿠폰 발송");
        const stageOne = asRecord(payload.result) || payload;
        assertGiftishowSuccess(stageOne, "쿠폰 발송 결과");
        const stageTwo = asRecord(stageOne.result) || stageOne;
        return {
            orderNo: asTrimmedString(stageTwo.orderNo) || null,
            pinNo: asTrimmedString(stageTwo.pinNo) || null,
            couponImgUrl: asTrimmedString(stageTwo.couponImgUrl) || null,
            sendStatusCode: asTrimmedString(stageTwo.sendStatusCd) || null,
            sendStatusName: asTrimmedString(stageTwo.sendStatusNm) || null,
            pinStatusCode: asTrimmedString(stageTwo.pinStatusCd) || null,
            pinStatusName: asTrimmedString(stageTwo.pinStatusNm) || null,
            validPrdEndDt: asTrimmedString(stageTwo.validPrdEndDt) || null,
            code: asTrimmedString(stageOne.code) || asTrimmedString(payload.code) || null,
            message: asTrimmedString(stageOne.message) || asTrimmedString(payload.message) || null,
        };
    }
    async getCoupon(trId) {
        const payload = await this.postForm("/coupons", {
            api_code: "0201",
            custom_auth_code: requireCredential(this.credentials.authCode, "authCode"),
            custom_auth_token: requireCredential(this.credentials.authToken, "authToken"),
            user_id: requireCredential(this.credentials.userId, "userId"),
            dev_yn: "N",
            tr_id: trId,
        });
        const topLevelCode = resolveGiftishowCode(payload);
        if (topLevelCode && topLevelCode !== "0000") {
            const notFoundCodes = new Set(["ERR0204", "ERR0212", "NO_DATA"]);
            if (notFoundCodes.has(topLevelCode)) {
                return { found: false };
            }
            throw new GiftishowProviderError(topLevelCode, resolveGiftishowMessage(payload, "쿠폰 조회에 실패했습니다."));
        }
        const resultRoot = payload.result;
        const resultRow = Array.isArray(resultRoot)
            ? resultRoot.find((item) => isPlainObject(item)) || null
            : asRecord(resultRoot);
        const nestedCode = resultRow ? resolveGiftishowCode(resultRow) : null;
        if (nestedCode && nestedCode !== "0000") {
            const notFoundCodes = new Set(["ERR0204", "ERR0212", "NO_DATA"]);
            if (notFoundCodes.has(nestedCode)) {
                return { found: false };
            }
            throw new GiftishowProviderError(nestedCode, resolveGiftishowMessage(resultRow || payload, "쿠폰 조회에 실패했습니다."));
        }
        const couponInfoSource = (resultRow && Array.isArray(resultRow.couponInfoList) ? resultRow.couponInfoList : null)
            || (Array.isArray(payload.couponInfoList) ? payload.couponInfoList : []);
        const list = couponInfoSource.filter((item) => isPlainObject(item));
        const first = list[0];
        if (!first) {
            return { found: false };
        }
        return {
            found: true,
            orderNo: asTrimmedString(first.orderNo) || null,
            pinNo: asTrimmedString(first.pinNo) || null,
            couponImgUrl: asTrimmedString(first.couponImgUrl) || null,
            sendStatusCode: asTrimmedString(first.sendStatusCd) || null,
            sendStatusName: asTrimmedString(first.sendStatusNm) || null,
            pinStatusCode: asTrimmedString(first.pinStatusCd) || null,
            pinStatusName: asTrimmedString(first.pinStatusNm) || null,
            validPrdEndDt: asTrimmedString(first.validPrdEndDt) || null,
        };
    }
    async cancelCoupon(trId) {
        const payload = await this.postForm("/cancel", {
            api_code: "0202",
            custom_auth_code: requireCredential(this.credentials.authCode, "authCode"),
            custom_auth_token: requireCredential(this.credentials.authToken, "authToken"),
            user_id: requireCredential(this.credentials.userId, "userId"),
            dev_yn: "N",
            tr_id: trId,
        });
        const code = resolveGiftishowCode(payload);
        if (code === "0000") {
            return {};
        }
        if (code === "ERR0208" || code === "ERR0210") {
            return { alreadyCancelled: true };
        }
        throw new GiftishowProviderError(code || "CANCEL_FAILED", resolveGiftishowMessage(payload, "쿠폰 취소에 실패했습니다."));
    }
    async resendCoupon(trId) {
        const payload = await this.postForm("/resend", {
            api_code: "0203",
            custom_auth_code: requireCredential(this.credentials.authCode, "authCode"),
            custom_auth_token: requireCredential(this.credentials.authToken, "authToken"),
            user_id: requireCredential(this.credentials.userId, "userId"),
            dev_yn: "N",
            tr_id: trId,
            sms_flag: "N",
        });
        assertGiftishowSuccess(payload, "쿠폰 재전송");
    }
    async postForm(pathOrUrl, payload, timeoutMs = 10000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${GIFTISHOW_BASE_URL}${pathOrUrl}`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    accept: "application/json",
                },
                body: toGiftishowFormBody(payload),
                signal: controller.signal,
            });
            const text = await response.text();
            const parsed = safeParseJson(text);
            if (!response.ok) {
                throw new GiftishowProviderError(`HTTP_${response.status}`, resolveGiftishowMessage(parsed, `Giftishow HTTP ${response.status}`), response.status >= 500);
            }
            return parsed;
        }
        catch (error) {
            if (error instanceof GiftishowProviderError) {
                throw error;
            }
            if (isAbortError(error)) {
                throw new GiftishowTimeoutError();
            }
            throw new GiftishowProviderError("NETWORK_ERROR", error instanceof Error ? error.message : String(error), true);
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
}
exports.saveGiftishowSettingsSecure = giftishowSecureFunctions.https.onCall(async (data, context) => {
    var _a, _b, _c;
    const db = admin.firestore();
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    if (!centerId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId is required.");
    }
    await assertCenterAdmin(db, centerId, context.auth.uid);
    const publicRef = db.doc(`centers/${centerId}/settings/giftishow`);
    const privateRef = db.doc(`centers/${centerId}/settingsPrivate/giftishowSecret`);
    const [publicSnap, privateSnap] = await Promise.all([publicRef.get(), privateRef.get()]);
    const currentPublic = (publicSnap.exists ? publicSnap.data() : {});
    const currentPrivate = (privateSnap.exists ? privateSnap.data() : {});
    const authCode = getGiftishowRuntimeSecret("GIFTISHOW_AUTH_CODE") || asTrimmedString(currentPrivate.authCode);
    const authToken = getGiftishowRuntimeSecret("GIFTISHOW_AUTH_TOKEN") || asTrimmedString(currentPrivate.authToken);
    const userId = asTrimmedString(data === null || data === void 0 ? void 0 : data.userId) || asTrimmedString(currentPrivate.userId);
    const callbackNo = normalizePhoneNumber(asTrimmedString(data === null || data === void 0 ? void 0 : data.callbackNo) || asTrimmedString(currentPrivate.callbackNo));
    const payload = {
        enabled: (data === null || data === void 0 ? void 0 : data.enabled) === true,
        deliveryMode: "mms",
        bannerId: asTrimmedString(data === null || data === void 0 ? void 0 : data.bannerId) || nullToUndefined(currentPublic.bannerId),
        templateId: asTrimmedString(data === null || data === void 0 ? void 0 : data.templateId) || nullToUndefined(currentPublic.templateId),
        authCodeConfigured: Boolean(authCode),
        authTokenConfigured: Boolean(authToken),
        userIdConfigured: Boolean(userId),
        callbackNoConfigured: Boolean(callbackNo),
        lastSyncStatus: currentPublic.lastSyncStatus || "idle",
        lastCatalogSyncedAt: currentPublic.lastCatalogSyncedAt || null,
        lastBizmoneyBalance: (_b = currentPublic.lastBizmoneyBalance) !== null && _b !== void 0 ? _b : null,
        lastErrorMessage: (_c = currentPublic.lastErrorMessage) !== null && _c !== void 0 ? _c : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: context.auth.uid,
    };
    const batch = db.batch();
    batch.set(publicRef, payload, { merge: true });
    batch.set(privateRef, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (asTrimmedString(data === null || data === void 0 ? void 0 : data.userId) ? { userId: asTrimmedString(data === null || data === void 0 ? void 0 : data.userId) } : {})), (normalizePhoneNumber(data === null || data === void 0 ? void 0 : data.callbackNo) ? { callbackNo: normalizePhoneNumber(data === null || data === void 0 ? void 0 : data.callbackNo) } : {})), (asTrimmedString(currentPrivate.authCode) ? { authCode: admin.firestore.FieldValue.delete() } : {})), (asTrimmedString(currentPrivate.authToken) ? { authToken: admin.firestore.FieldValue.delete() } : {})), { updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: context.auth.uid }), { merge: true });
    await batch.commit();
    return {
        ok: true,
        settings: Object.assign(Object.assign({}, payload), { updatedAt: undefined }),
    };
});
exports.syncGiftishowCatalogSecure = giftishowSecureFunctions.https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    if (!centerId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId is required.");
    }
    await assertCenterAdmin(db, centerId, context.auth.uid);
    const result = await syncGiftishowCatalogForCenter(db, centerId, context.auth.uid);
    return {
        syncedCount: result.syncedCount,
        availableCount: result.availableCount,
        brandCount: result.brandCount,
        detailSyncedCount: result.detailSyncedCount,
        brandDetailSyncedCount: result.brandDetailSyncedCount,
        lastCatalogSyncedAt: result.lastCatalogSyncedAt.toISOString(),
        mode: result.mode,
    };
});
exports.scheduledGiftishowCatalogSync = giftishowSecureFunctions
    .pubsub.schedule("20 4 * * *")
    .timeZone("Asia/Seoul")
    .onRun(async () => {
    const db = admin.firestore();
    const centersSnap = await db.collection("centers").get();
    for (const centerDoc of centersSnap.docs) {
        const centerId = centerDoc.id;
        const settingsSnap = await db.doc(`centers/${centerId}/settings/giftishow`).get();
        const settings = (settingsSnap.exists ? settingsSnap.data() : {});
        if (!settings.enabled)
            continue;
        try {
            await syncGiftishowCatalogForCenter(db, centerId, "scheduler");
        }
        catch (error) {
            functions.logger.error("giftishow catalog sync failed", {
                centerId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    return null;
});
exports.getGiftishowBizmoneySecure = giftishowSecureFunctions.https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    if (!centerId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId is required.");
    }
    await assertCenterAdmin(db, centerId, context.auth.uid);
    const runtime = await loadGiftishowRuntimeConfig(db, centerId);
    const client = createGiftishowClient(runtime);
    const balance = await client.getBizmoney();
    await runtime.settingsRef.set({
        lastBizmoneyBalance: balance,
        lastSyncStatus: "success",
        lastErrorMessage: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: context.auth.uid,
    }, { merge: true });
    return {
        ok: true,
        balance,
        mode: client.mode,
    };
});
exports.createGiftishowOrderRequestSecure = functions.region(region).https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    const goodsCode = asTrimmedString(data === null || data === void 0 ? void 0 : data.goodsCode);
    if (!centerId || !goodsCode) {
        throw new functions.https.HttpsError("invalid-argument", "centerId and goodsCode are required.");
    }
    const membership = await resolveCenterMembershipRole(db, centerId, context.auth.uid);
    if (membership.role !== "student" || !isActiveMembershipStatus(membership.status)) {
        throw new functions.https.HttpsError("permission-denied", "학생 본인만 교환 요청을 만들 수 있습니다.");
    }
    const [productSnap, studentContext] = await Promise.all([
        db.doc(`centers/${centerId}/giftishowProducts/${goodsCode}`).get(),
        resolveStudentContext(db, centerId, context.auth.uid),
    ]);
    if (!productSnap.exists) {
        throw new functions.https.HttpsError("not-found", "상품 정보를 찾을 수 없습니다.");
    }
    const product = productSnap.data();
    if (!product.isAvailable || product.goodsStateCd !== "SALE") {
        throw new functions.https.HttpsError("failed-precondition", "현재 교환할 수 없는 상품입니다.");
    }
    if (!studentContext.phoneNumber) {
        throw new functions.https.HttpsError("failed-precondition", "학생 전화번호가 없어 교환 요청을 만들 수 없습니다.");
    }
    const orderRef = db.collection(`centers/${centerId}/giftishowOrders`).doc();
    const now = admin.firestore.Timestamp.now();
    const orderPayload = {
        centerId,
        studentId: context.auth.uid,
        studentName: studentContext.displayName,
        recipientPhoneMasked: maskPhoneNumber(studentContext.phoneNumber),
        goodsCode: product.goodsCode,
        goodsName: product.goodsName,
        brandCode: product.brandCode || null,
        brandName: product.brandName || null,
        salePrice: Math.max(0, Math.floor(product.salePrice || 0)),
        discountPrice: Math.max(0, Math.floor(product.discountPrice || 0)),
        pointCost: Math.max(0, Math.floor(product.pointCost || product.salePrice || 0)),
        status: "requested",
        pointEvents: [],
        requestedAt: now,
        requestedBy: context.auth.uid,
        createdAt: now,
        updatedAt: now,
    };
    await orderRef.set(orderPayload, { merge: true });
    return {
        ok: true,
        order: serializeOrder(orderRef.id, orderPayload),
    };
});
exports.approveGiftishowOrderSecure = giftishowSecureFunctions.https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    const orderId = asTrimmedString(data === null || data === void 0 ? void 0 : data.orderId);
    if (!centerId || !orderId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId and orderId are required.");
    }
    await assertCenterAdmin(db, centerId, context.auth.uid);
    const orderRef = db.doc(`centers/${centerId}/giftishowOrders/${orderId}`);
    const [orderSnap, runtime] = await Promise.all([
        orderRef.get(),
        loadGiftishowRuntimeConfig(db, centerId),
    ]);
    if (!orderSnap.exists) {
        throw new functions.https.HttpsError("not-found", "주문 요청을 찾을 수 없습니다.");
    }
    const order = orderSnap.data();
    if (order.status !== "requested") {
        throw new functions.https.HttpsError("failed-precondition", "승인 가능한 요청 상태가 아닙니다.");
    }
    const [studentContext, centerName] = await Promise.all([
        resolveStudentContext(db, centerId, order.studentId),
        resolveCenterDisplayName(db, centerId),
    ]);
    if (!studentContext.phoneNumber) {
        throw new functions.https.HttpsError("failed-precondition", "학생 전화번호가 없어 발송할 수 없습니다.");
    }
    const trId = buildGiftishowTrId(orderId);
    const now = new Date();
    const approvedOrder = await claimGiftishowOrderForSend({
        db,
        centerId,
        orderId,
        orderRef,
        approvedBy: context.auth.uid,
        trId,
        now,
    });
    const client = createGiftishowClient(runtime);
    const mmsTitle = buildGiftishowMmsTitle(centerName);
    const mmsMsg = buildGiftishowMmsMessage({
        centerName,
        goodsName: approvedOrder.goodsName,
        studentName: approvedOrder.studentName,
    });
    try {
        const sendResult = await client.sendCoupon({
            trId,
            orderNo: orderId,
            goodsCode: approvedOrder.goodsCode,
            phoneNo: studentContext.phoneNumber,
            mmsTitle,
            mmsMsg,
        });
        const nextOrder = await finalizeGiftishowSendSuccess({
            orderRef,
            orderId,
            existingOrder: approvedOrder,
            sendResult,
            mode: client.mode,
        });
        return {
            ok: true,
            order: nextOrder,
        };
    }
    catch (error) {
        if (error instanceof GiftishowTimeoutError) {
            const nextOrder = await markGiftishowOrderPendingProvider({
                orderRef,
                orderId,
                existingOrder: approvedOrder,
                mode: client.mode,
            });
            return {
                ok: false,
                order: nextOrder,
            };
        }
        const providerError = normalizeGiftishowError(error);
        const nextOrder = await refundGiftishowOrderPoints({
            db,
            centerId,
            orderId,
            orderRef,
            status: "failed",
            byUid: context.auth.uid,
            reason: "send_failed",
            errorCode: providerError.code,
            errorMessage: providerError.message,
        });
        return {
            ok: false,
            order: nextOrder,
        };
    }
});
exports.rejectGiftishowOrderSecure = functions.region(region).https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    const orderId = asTrimmedString(data === null || data === void 0 ? void 0 : data.orderId);
    if (!centerId || !orderId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId and orderId are required.");
    }
    await assertCenterAdmin(db, centerId, context.auth.uid);
    const orderRef = db.doc(`centers/${centerId}/giftishowOrders/${orderId}`);
    const order = await db.runTransaction(async (transaction) => {
        var _a;
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) {
            throw new functions.https.HttpsError("not-found", "주문 요청을 찾을 수 없습니다.");
        }
        const currentOrder = orderSnap.data();
        if (currentOrder.status !== "requested") {
            throw new functions.https.HttpsError("failed-precondition", "반려 가능한 상태가 아닙니다.");
        }
        const now = admin.firestore.Timestamp.now();
        const nextOrder = Object.assign(Object.assign({}, currentOrder), { status: "rejected", rejectionReason: asTrimmedString(data === null || data === void 0 ? void 0 : data.reason), rejectedAt: now, rejectedBy: ((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid) || null, updatedAt: now });
        transaction.set(orderRef, nextOrder, { merge: true });
        return nextOrder;
    });
    return {
        ok: true,
        order: serializeOrder(orderId, order),
    };
});
exports.cancelGiftishowOrderSecure = giftishowSecureFunctions.https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    const orderId = asTrimmedString(data === null || data === void 0 ? void 0 : data.orderId);
    if (!centerId || !orderId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId and orderId are required.");
    }
    await assertCenterAdmin(db, centerId, context.auth.uid);
    const orderRef = db.doc(`centers/${centerId}/giftishowOrders/${orderId}`);
    const [orderSnap, runtime] = await Promise.all([
        orderRef.get(),
        loadGiftishowRuntimeConfig(db, centerId),
    ]);
    if (!orderSnap.exists) {
        throw new functions.https.HttpsError("not-found", "주문 정보를 찾을 수 없습니다.");
    }
    const order = orderSnap.data();
    if (!order.trId) {
        throw new functions.https.HttpsError("failed-precondition", "취소 가능한 발송 정보가 없습니다.");
    }
    if (!["sent", "pending_provider", "sending"].includes(order.status)) {
        throw new functions.https.HttpsError("failed-precondition", "취소 가능한 상태가 아닙니다.");
    }
    const client = createGiftishowClient(runtime);
    await client.cancelCoupon(order.trId);
    const nextOrder = await refundGiftishowOrderPoints({
        db,
        centerId,
        orderId,
        orderRef,
        status: "cancelled",
        byUid: context.auth.uid,
        reason: asTrimmedString(data === null || data === void 0 ? void 0 : data.reason) || "cancelled",
        cancelledReason: asTrimmedString(data === null || data === void 0 ? void 0 : data.reason),
    });
    return {
        ok: true,
        order: nextOrder,
    };
});
exports.resendGiftishowOrderSecure = giftishowSecureFunctions.https.onCall(async (data, context) => {
    var _a;
    const db = admin.firestore();
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const centerId = asTrimmedString(data === null || data === void 0 ? void 0 : data.centerId);
    const orderId = asTrimmedString(data === null || data === void 0 ? void 0 : data.orderId);
    if (!centerId || !orderId) {
        throw new functions.https.HttpsError("invalid-argument", "centerId and orderId are required.");
    }
    await assertCenterAdmin(db, centerId, context.auth.uid);
    const orderRef = db.doc(`centers/${centerId}/giftishowOrders/${orderId}`);
    const [orderSnap, runtime] = await Promise.all([
        orderRef.get(),
        loadGiftishowRuntimeConfig(db, centerId),
    ]);
    if (!orderSnap.exists) {
        throw new functions.https.HttpsError("not-found", "주문 정보를 찾을 수 없습니다.");
    }
    const order = orderSnap.data();
    if (!order.trId || order.status !== "sent") {
        throw new functions.https.HttpsError("failed-precondition", "재전송 가능한 상태가 아닙니다.");
    }
    const client = createGiftishowClient(runtime);
    await client.resendCoupon(order.trId);
    const nextOrder = await db.runTransaction(async (transaction) => {
        const currentSnap = await transaction.get(orderRef);
        const currentOrder = currentSnap.data();
        const now = admin.firestore.Timestamp.now();
        const updatedOrder = Object.assign(Object.assign({}, currentOrder), { resendCount: Math.max(0, Math.floor(currentOrder.resendCount || 0)) + 1, updatedAt: now });
        transaction.set(orderRef, updatedOrder, { merge: true });
        return updatedOrder;
    });
    return {
        ok: true,
        order: serializeOrder(orderId, nextOrder),
    };
});
exports.reconcilePendingGiftishowOrders = giftishowSecureFunctions
    .pubsub.schedule("every 10 minutes")
    .timeZone("Asia/Seoul")
    .onRun(async () => {
    const db = admin.firestore();
    const pendingSnap = await db.collectionGroup("giftishowOrders").where("status", "==", "pending_provider").limit(120).get();
    for (const orderDoc of pendingSnap.docs) {
        const order = orderDoc.data();
        if (!order.centerId || !order.trId)
            continue;
        try {
            const runtime = await loadGiftishowRuntimeConfig(db, order.centerId);
            const client = createGiftishowClient(runtime);
            const lookup = await client.getCoupon(order.trId);
            if (lookup.found) {
                await finalizeGiftishowReconciliationSuccess(orderDoc.ref, orderDoc.id, order, lookup, client.mode);
                continue;
            }
            await markGiftishowPendingManualReview(orderDoc.ref, orderDoc.id, order);
        }
        catch (error) {
            functions.logger.warn("giftishow reconciliation failed", {
                orderId: orderDoc.id,
                centerId: order.centerId,
                error: error instanceof Error ? error.message : String(error),
            });
            await markGiftishowPendingManualReview(orderDoc.ref, orderDoc.id, order, error);
        }
    }
    return null;
});
async function syncGiftishowCatalogForCenter(db, centerId, requestedBy) {
    const runtime = await loadGiftishowRuntimeConfig(db, centerId);
    const client = createGiftishowClient(runtime);
    await runtime.settingsRef.set({
        lastSyncStatus: "syncing",
        lastErrorMessage: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: requestedBy,
    }, { merge: true });
    try {
        const allItems = [];
        let start = 0;
        let totalCount = Number.POSITIVE_INFINITY;
        while (allItems.length < totalCount) {
            const page = await client.listGoodsPage(start, GIFTISHOW_CATALOG_PAGE_SIZE);
            allItems.push(...page.items);
            totalCount = page.totalCount;
            if (page.items.length === 0)
                break;
            start += page.items.length;
            if (page.items.length < GIFTISHOW_CATALOG_PAGE_SIZE)
                break;
        }
        const brandPage = await client.listBrands();
        const now = admin.firestore.Timestamp.now();
        const productDocs = allItems.map((item) => normalizeGiftishowProduct(item, now));
        const productDetails = await mapWithConcurrency(productDocs, 4, async (product) => {
            try {
                return product.goodsCode ? await client.getGoodsDetail(product.goodsCode) : null;
            }
            catch (error) {
                functions.logger.warn("giftishow product detail sync failed", {
                    centerId,
                    goodsCode: product.goodsCode,
                    error: error instanceof Error ? error.message : String(error),
                });
                return null;
            }
        });
        const mergedProducts = productDocs.map((product, index) => mergeGiftishowProductDetail(product, productDetails[index], now));
        const detailSyncedCount = mergedProducts.filter((product) => product.detailSyncedAt).length;
        const brandDocs = buildGiftishowBrandDocs({
            brands: brandPage.items,
            products: mergedProducts,
            syncedAt: now,
        });
        const brandDetails = await mapWithConcurrency(brandDocs, 4, async (brand) => {
            try {
                return brand.brandCode ? await client.getBrandDetail(brand.brandCode) : null;
            }
            catch (error) {
                functions.logger.warn("giftishow brand detail sync failed", {
                    centerId,
                    brandCode: brand.brandCode,
                    error: error instanceof Error ? error.message : String(error),
                });
                return null;
            }
        });
        const mergedBrands = brandDocs.map((brand, index) => mergeGiftishowBrandDetail(brand, brandDetails[index], now));
        const brandDetailSyncedCount = mergedBrands.filter((brand) => brand.detailSyncedAt).length;
        const chunks = chunkArray(mergedProducts, GIFTISHOW_SYNC_BATCH_LIMIT);
        for (const chunk of chunks) {
            const batch = db.batch();
            for (const product of chunk) {
                batch.set(db.doc(`centers/${centerId}/giftishowProducts/${product.goodsCode}`), product, { merge: true });
            }
            await batch.commit();
        }
        const brandChunks = chunkArray(mergedBrands, GIFTISHOW_SYNC_BATCH_LIMIT);
        for (const chunk of brandChunks) {
            const batch = db.batch();
            for (const brand of chunk) {
                batch.set(db.doc(`centers/${centerId}/giftishowBrands/${brand.brandCode}`), brand, { merge: true });
            }
            await batch.commit();
        }
        await runtime.settingsRef.set({
            lastCatalogSyncedAt: now,
            lastBrandSyncedAt: now,
            lastDetailSyncedAt: now,
            lastBrandCount: mergedBrands.length,
            lastDetailSyncedCount: detailSyncedCount,
            lastBrandDetailSyncedCount: brandDetailSyncedCount,
            lastSyncStatus: "success",
            lastErrorMessage: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: requestedBy,
        }, { merge: true });
        return {
            syncedCount: mergedProducts.length,
            availableCount: mergedProducts.filter((product) => product.isAvailable).length,
            brandCount: mergedBrands.length,
            detailSyncedCount,
            brandDetailSyncedCount,
            lastCatalogSyncedAt: now.toDate(),
            mode: client.mode,
        };
    }
    catch (error) {
        await runtime.settingsRef.set({
            lastSyncStatus: "error",
            lastErrorMessage: error instanceof Error ? error.message : String(error),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: requestedBy,
        }, { merge: true });
        throw error;
    }
}
async function claimGiftishowOrderForSend(params) {
    const { db, centerId, orderRef, approvedBy, trId, now } = params;
    return db.runTransaction(async (transaction) => {
        var _a, _b, _c;
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) {
            throw new functions.https.HttpsError("not-found", "주문 요청을 찾을 수 없습니다.");
        }
        const order = orderSnap.data();
        if (order.status !== "requested") {
            throw new functions.https.HttpsError("failed-precondition", "승인 가능한 요청 상태가 아닙니다.");
        }
        const progressRef = db.doc(`centers/${centerId}/growthProgress/${order.studentId}`);
        const progressSnap = await transaction.get(progressRef);
        const pointsBalance = Math.max(0, Math.floor((_b = parseFiniteNumber((_a = progressSnap.data()) === null || _a === void 0 ? void 0 : _a.pointsBalance)) !== null && _b !== void 0 ? _b : 0));
        const pointCost = Math.max(0, Math.floor((_c = parseFiniteNumber(order.pointCost)) !== null && _c !== void 0 ? _c : 0));
        if (pointsBalance < pointCost) {
            throw new functions.https.HttpsError("failed-precondition", "포인트가 부족합니다.");
        }
        const timestamp = admin.firestore.Timestamp.fromDate(now);
        const pointEvents = normalizePointEvents(order.pointEvents);
        pointEvents.push(buildPointEvent("deduct", pointCost, "approval", approvedBy, timestamp));
        const nextOrder = Object.assign(Object.assign({}, order), { status: "sending", providerMode: shouldUseMockGiftishowProvider() ? "mock" : "live", trId, approvedAt: timestamp, approvedBy, resendCount: Math.max(0, Math.floor(order.resendCount || 0)), reconcileAttemptCount: Math.max(0, Math.floor(order.reconcileAttemptCount || 0)), pointEvents, updatedAt: timestamp });
        transaction.set(progressRef, {
            pointsBalance: admin.firestore.FieldValue.increment(-pointCost),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.set(orderRef, nextOrder, { merge: true });
        return nextOrder;
    });
}
async function finalizeGiftishowSendSuccess(params) {
    const { orderRef, orderId, existingOrder, sendResult, mode } = params;
    const now = admin.firestore.Timestamp.now();
    const nextOrder = Object.assign(Object.assign({}, existingOrder), { status: "sent", providerMode: mode, orderNo: sendResult.orderNo || existingOrder.orderNo || null, pinNo: sendResult.pinNo || existingOrder.pinNo || null, couponImgUrl: sendResult.couponImgUrl || existingOrder.couponImgUrl || null, sendStatusCode: sendResult.sendStatusCode || existingOrder.sendStatusCode || "1000", sendStatusName: sendResult.sendStatusName || existingOrder.sendStatusName || "발송완료", pinStatusCode: sendResult.pinStatusCode || existingOrder.pinStatusCode || null, pinStatusName: sendResult.pinStatusName || existingOrder.pinStatusName || null, validPrdEndDt: sendResult.validPrdEndDt || existingOrder.validPrdEndDt || null, sendResultCode: sendResult.code || "0000", sendResultMessage: sendResult.message || "SUCCESS", lastErrorCode: null, lastErrorMessage: null, needsManualReview: false, sentAt: now, updatedAt: now });
    await orderRef.set(nextOrder, { merge: true });
    return serializeOrder(orderId, nextOrder);
}
async function markGiftishowOrderPendingProvider(params) {
    const now = admin.firestore.Timestamp.now();
    const nextOrder = Object.assign(Object.assign({}, params.existingOrder), { status: "pending_provider", providerMode: params.mode, lastErrorCode: "TIMEOUT", lastErrorMessage: "Giftishow 응답을 바로 확인하지 못해 사업자 조회 대기로 전환했습니다.", reconcileAttemptCount: Math.max(0, Math.floor(params.existingOrder.reconcileAttemptCount || 0)), needsManualReview: false, updatedAt: now });
    await params.orderRef.set(nextOrder, { merge: true });
    return serializeOrder(params.orderId, nextOrder);
}
async function finalizeGiftishowReconciliationSuccess(orderRef, orderId, existingOrder, lookup, mode) {
    const now = admin.firestore.Timestamp.now();
    const nextOrder = Object.assign(Object.assign({}, existingOrder), { status: "sent", providerMode: mode, orderNo: lookup.orderNo || existingOrder.orderNo || null, pinNo: lookup.pinNo || existingOrder.pinNo || null, couponImgUrl: lookup.couponImgUrl || existingOrder.couponImgUrl || null, sendStatusCode: lookup.sendStatusCode || existingOrder.sendStatusCode || "1000", sendStatusName: lookup.sendStatusName || existingOrder.sendStatusName || "발송완료", pinStatusCode: lookup.pinStatusCode || existingOrder.pinStatusCode || null, pinStatusName: lookup.pinStatusName || existingOrder.pinStatusName || null, validPrdEndDt: lookup.validPrdEndDt || existingOrder.validPrdEndDt || null, needsManualReview: false, lastErrorCode: null, lastErrorMessage: null, reconcileAttemptCount: Math.max(0, Math.floor(existingOrder.reconcileAttemptCount || 0)) + 1, lastReconciledAt: now, sentAt: existingOrder.sentAt || now, updatedAt: now });
    await orderRef.set(nextOrder, { merge: true });
    return serializeOrder(orderId, nextOrder);
}
async function markGiftishowPendingManualReview(orderRef, orderId, existingOrder, error) {
    const nextAttempt = Math.max(0, Math.floor(existingOrder.reconcileAttemptCount || 0)) + 1;
    const now = admin.firestore.Timestamp.now();
    const nextOrder = Object.assign(Object.assign({}, existingOrder), { reconcileAttemptCount: nextAttempt, needsManualReview: nextAttempt >= GIFTISHOW_MANUAL_REVIEW_THRESHOLD, lastErrorCode: error instanceof GiftishowProviderError ? error.code : existingOrder.lastErrorCode || "PENDING_PROVIDER", lastErrorMessage: error instanceof Error
            ? error.message
            : existingOrder.lastErrorMessage || "사업자 쿠폰 조회에서 즉시 확인되지 않았습니다.", lastReconciledAt: now, updatedAt: now });
    await orderRef.set(nextOrder, { merge: true });
    return serializeOrder(orderId, nextOrder);
}
async function refundGiftishowOrderPoints(params) {
    const { db, centerId, orderId, orderRef, status, byUid, reason, errorCode, errorMessage, cancelledReason } = params;
    const now = admin.firestore.Timestamp.now();
    const updatedOrder = await db.runTransaction(async (transaction) => {
        var _a;
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists) {
            throw new functions.https.HttpsError("not-found", "주문 정보를 찾을 수 없습니다.");
        }
        const currentOrder = orderSnap.data();
        const pointCost = Math.max(0, Math.floor((_a = parseFiniteNumber(currentOrder.pointCost)) !== null && _a !== void 0 ? _a : 0));
        const pointEvents = normalizePointEvents(currentOrder.pointEvents);
        const alreadyRefunded = pointEvents.some((event) => event.type === "refund");
        if (!alreadyRefunded && pointCost > 0) {
            pointEvents.push(buildPointEvent("refund", pointCost, reason, byUid, now));
            transaction.set(db.doc(`centers/${centerId}/growthProgress/${currentOrder.studentId}`), {
                pointsBalance: admin.firestore.FieldValue.increment(pointCost),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        }
        const nextOrder = Object.assign(Object.assign({}, currentOrder), { status,
            pointEvents, lastErrorCode: errorCode || null, lastErrorMessage: errorMessage || null, cancelledReason: cancelledReason || currentOrder.cancelledReason || null, failedAt: status === "failed" ? now : currentOrder.failedAt || null, cancelledAt: status === "cancelled" ? now : currentOrder.cancelledAt || null, cancelledBy: status === "cancelled" ? byUid : currentOrder.cancelledBy || null, needsManualReview: false, updatedAt: now });
        transaction.set(orderRef, nextOrder, { merge: true });
        return nextOrder;
    });
    return serializeOrder(orderId, updatedOrder);
}
async function loadGiftishowRuntimeConfig(db, centerId) {
    const settingsRef = db.doc(`centers/${centerId}/settings/giftishow`);
    const [settingsSnap, secretSnap] = await Promise.all([
        settingsRef.get(),
        db.doc(`centers/${centerId}/settingsPrivate/giftishowSecret`).get(),
    ]);
    const legacySecrets = (secretSnap.exists ? secretSnap.data() : {});
    return {
        settings: (settingsSnap.exists ? settingsSnap.data() : {}),
        secrets: {
            authCode: getGiftishowRuntimeSecret("GIFTISHOW_AUTH_CODE") || asTrimmedString(legacySecrets.authCode),
            authToken: getGiftishowRuntimeSecret("GIFTISHOW_AUTH_TOKEN") || asTrimmedString(legacySecrets.authToken),
            userId: asTrimmedString(legacySecrets.userId),
            callbackNo: asTrimmedString(legacySecrets.callbackNo),
        },
        mode: shouldUseMockGiftishowProvider() ? "mock" : "live",
        settingsRef,
    };
}
function createGiftishowClient(runtime) {
    if (runtime.mode === "mock") {
        return new MockGiftishowClient();
    }
    return new LiveGiftishowClient({
        authCode: asTrimmedString(runtime.secrets.authCode),
        authToken: asTrimmedString(runtime.secrets.authToken),
        userId: asTrimmedString(runtime.secrets.userId),
        callbackNo: normalizePhoneNumber(runtime.secrets.callbackNo),
        bannerId: asTrimmedString(runtime.settings.bannerId),
        templateId: asTrimmedString(runtime.settings.templateId),
    });
}
async function assertCenterAdmin(db, centerId, uid) {
    const membership = await resolveCenterMembershipRole(db, centerId, uid);
    if (!isAdminRole(membership.role) || !isActiveMembershipStatus(membership.status)) {
        throw new functions.https.HttpsError("permission-denied", "센터 관리자만 실행할 수 있습니다.");
    }
}
async function resolveStudentContext(db, centerId, studentId) {
    const [studentSnap, memberSnap, userSnap] = await Promise.all([
        db.doc(`centers/${centerId}/students/${studentId}`).get(),
        db.doc(`centers/${centerId}/members/${studentId}`).get(),
        db.doc(`users/${studentId}`).get(),
    ]);
    const studentData = (studentSnap.exists ? studentSnap.data() : {});
    const memberData = (memberSnap.exists ? memberSnap.data() : {});
    const userData = (userSnap.exists ? userSnap.data() : {});
    const displayName = asTrimmedString(studentData.name)
        || asTrimmedString(memberData.displayName)
        || asTrimmedString(userData.displayName)
        || "학생";
    const phoneNumber = resolveFirstValidPhoneNumber(studentData.phoneNumber, memberData.phoneNumber, userData.phoneNumber);
    return {
        displayName,
        phoneNumber,
    };
}
async function resolveCenterDisplayName(db, centerId) {
    const centerSnap = await db.doc(`centers/${centerId}`).get();
    const data = (centerSnap.exists ? centerSnap.data() : {});
    return asTrimmedString(data.name) || asTrimmedString(data.centerName) || "센터";
}
async function resolveCenterMembershipRole(db, centerId, uid) {
    const [memberSnap, userCenterSnap] = await Promise.all([
        db.doc(`centers/${centerId}/members/${uid}`).get(),
        db.doc(`userCenters/${uid}/centers/${centerId}`).get(),
    ]);
    const memberData = memberSnap.exists ? memberSnap.data() : null;
    const userCenterData = userCenterSnap.exists ? userCenterSnap.data() : null;
    const memberRole = normalizeMembershipRoleValue(memberData === null || memberData === void 0 ? void 0 : memberData.role);
    if (memberRole) {
        return {
            role: memberRole,
            status: memberData === null || memberData === void 0 ? void 0 : memberData.status,
        };
    }
    return {
        role: normalizeMembershipRoleValue(userCenterData === null || userCenterData === void 0 ? void 0 : userCenterData.role) || null,
        status: userCenterData === null || userCenterData === void 0 ? void 0 : userCenterData.status,
    };
}
function normalizeGiftishowProduct(item, syncedAt) {
    var _a, _b, _c, _d;
    const goodsCode = readGiftishowString(item, "goodsCode", "goods_code");
    const salePrice = Math.max(0, Math.floor((_a = readGiftishowNumber(item, "salePrice", "sale_price")) !== null && _a !== void 0 ? _a : 0));
    const discountPrice = Math.max(0, Math.floor((_b = readGiftishowNumber(item, "discountPrice", "discount_price")) !== null && _b !== void 0 ? _b : salePrice));
    const stateCode = readGiftishowString(item, "goodsStateCd", "goods_state_cd");
    return {
        goodsCode,
        goodsName: readGiftishowString(item, "goodsName", "goods_name") || "기프티쇼 상품",
        brandCode: readGiftishowString(item, "brandCode", "brand_code") || null,
        brandName: readGiftishowString(item, "brandName", "brand_name") || null,
        content: readGiftishowString(item, "content") || null,
        contentAddDesc: readGiftishowString(item, "contentAddDesc", "content_add_desc") || null,
        goodsTypeNm: readGiftishowString(item, "goodsTypeNm", "goods_type_nm") || null,
        goodsTypeDtlNm: readGiftishowString(item, "goodsTypeDtlNm", "goods_type_dtl_nm") || null,
        affiliate: readGiftishowString(item, "affiliate") || null,
        goodsImgS: readGiftishowString(item, "goodsImgS", "goods_img_s") || null,
        goodsImgB: readGiftishowString(item, "goodsImgB", "goods_img_b") || null,
        mmsGoodsImg: readGiftishowString(item, "mmsGoodsImg", "mms_goods_img") || null,
        brandIconImg: readGiftishowString(item, "brandIconImg", "brand_icon_img") || null,
        salePrice,
        discountPrice,
        realPrice: Math.max(0, Math.floor((_c = readGiftishowNumber(item, "realPrice", "real_price")) !== null && _c !== void 0 ? _c : discountPrice)),
        validPrdTypeCd: readGiftishowString(item, "validPrdTypeCd", "valid_prd_type_cd") || null,
        validPrdDay: readGiftishowString(item, "validPrdDay", "valid_prd_day") || null,
        limitDay: Math.max(0, Math.floor((_d = readGiftishowNumber(item, "limitDay", "limit_day")) !== null && _d !== void 0 ? _d : 0)),
        goodsStateCd: stateCode || null,
        mmsReserveFlag: readGiftishowString(item, "mmsReserveFlag", "mms_reserve_flag") || null,
        mmsBarcdCreateYn: readGiftishowString(item, "mmsBarcdCreateYn", "mms_barcd_create_yn") || null,
        pointCost: salePrice,
        isAvailable: stateCode === "SALE" && salePrice > 0,
        lastSyncedAt: syncedAt,
        updatedAt: syncedAt,
    };
}
function normalizeGiftishowBrand(item, syncedAt) {
    var _a;
    const brandCode = readGiftishowString(item, "brandCode", "brand_code");
    const goodsCount = Math.max(0, Math.floor((_a = readGiftishowNumber(item, "goodsCount", "goods_count")) !== null && _a !== void 0 ? _a : 0));
    return {
        brandCode,
        brandName: readGiftishowString(item, "brandName", "brand_name") || brandCode || "기프티쇼 브랜드",
        brandIconImg: readGiftishowString(item, "brandIconImg", "brand_icon_img") || null,
        brandImg: readGiftishowString(item, "brandImg", "brand_img", "brandImage", "brand_image") || null,
        brandDescription: readGiftishowString(item, "brandDescription", "brand_description", "description") || null,
        goodsCount,
        isAvailable: goodsCount > 0 || readGiftishowString(item, "useYn", "use_yn") !== "N",
        lastSyncedAt: syncedAt,
        updatedAt: syncedAt,
    };
}
function mergeGiftishowProductDetail(base, detail, syncedAt) {
    if (!detail) {
        return Object.assign(Object.assign({}, base), { updatedAt: syncedAt });
    }
    const detailDoc = normalizeGiftishowProduct(Object.assign(Object.assign({}, base), detail), syncedAt);
    return Object.assign(Object.assign(Object.assign({}, base), detailDoc), { detailSyncedAt: syncedAt, updatedAt: syncedAt });
}
function buildGiftishowBrandDocs(params) {
    var _a, _b;
    const map = new Map();
    for (const brand of params.brands) {
        const normalized = normalizeGiftishowBrand(brand, params.syncedAt);
        if (!normalized.brandCode)
            continue;
        map.set(normalized.brandCode, normalized);
    }
    for (const product of params.products) {
        const brandCode = asTrimmedString(product.brandCode);
        if (!brandCode)
            continue;
        const current = map.get(brandCode);
        const goodsCount = ((_a = current === null || current === void 0 ? void 0 : current.goodsCount) !== null && _a !== void 0 ? _a : 0) + 1;
        map.set(brandCode, {
            brandCode,
            brandName: (current === null || current === void 0 ? void 0 : current.brandName) || asTrimmedString(product.brandName) || brandCode,
            brandIconImg: (current === null || current === void 0 ? void 0 : current.brandIconImg) || product.brandIconImg || product.goodsImgS || null,
            brandImg: (current === null || current === void 0 ? void 0 : current.brandImg) || product.goodsImgB || null,
            brandDescription: (current === null || current === void 0 ? void 0 : current.brandDescription) || null,
            goodsCount,
            isAvailable: (_b = current === null || current === void 0 ? void 0 : current.isAvailable) !== null && _b !== void 0 ? _b : product.isAvailable,
            lastSyncedAt: params.syncedAt,
            detailSyncedAt: (current === null || current === void 0 ? void 0 : current.detailSyncedAt) || null,
            updatedAt: params.syncedAt,
        });
    }
    return [...map.values()].sort((left, right) => left.brandName.localeCompare(right.brandName, "ko"));
}
function mergeGiftishowBrandDetail(base, detail, syncedAt) {
    var _a, _b;
    if (!detail) {
        return Object.assign(Object.assign({}, base), { updatedAt: syncedAt });
    }
    const detailDoc = normalizeGiftishowBrand(Object.assign(Object.assign({}, base), detail), syncedAt);
    return Object.assign(Object.assign(Object.assign({}, base), detailDoc), { goodsCount: Math.max((_a = base.goodsCount) !== null && _a !== void 0 ? _a : 0, (_b = detailDoc.goodsCount) !== null && _b !== void 0 ? _b : 0), isAvailable: base.isAvailable || detailDoc.isAvailable, detailSyncedAt: syncedAt, updatedAt: syncedAt });
}
function buildGiftishowTrId(orderId) {
    const seed = `${Date.now().toString(36)}${orderId.slice(-8)}`.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
    const trId = `gs${seed}`;
    assertGiftishowSendLimits(trId, "보상 도착");
    return trId;
}
function buildGiftishowMmsTitle(centerName) {
    const baseTitle = `${centerName} 보상 도착`.trim();
    if (baseTitle.length <= 20)
        return baseTitle;
    return "보상 도착 안내";
}
function buildGiftishowMmsMessage(params) {
    const centerName = params.centerName || "센터";
    const goodsName = params.goodsName || "보상 상품";
    const studentName = params.studentName || "학생";
    return `[${centerName}] ${studentName} 학생이 요청한 ${goodsName} 보상이 도착했습니다.`;
}
function assertGiftishowSendLimits(trId, mmsTitle) {
    if (Buffer.byteLength(trId, "utf8") > 25) {
        throw new GiftishowProviderError("TR_ID_LIMIT", "tr_id 는 25byte 이하만 허용됩니다.");
    }
    if (mmsTitle.length > 20) {
        throw new GiftishowProviderError("MMS_TITLE_LIMIT", "mms_title 은 20자 이하만 허용됩니다.");
    }
}
function normalizeGiftishowError(error) {
    if (error instanceof GiftishowProviderError) {
        return error;
    }
    if (error instanceof GiftishowTimeoutError) {
        return new GiftishowProviderError("TIMEOUT", error.message, true);
    }
    return new GiftishowProviderError("UNKNOWN", error instanceof Error ? error.message : String(error), true);
}
function serializeOrder(id, order) {
    return Object.assign({ id }, order);
}
function buildPointEvent(type, points, reason, byUid, createdAt) {
    return {
        type,
        points: Math.max(0, Math.floor(points)),
        reason,
        byUid,
        createdAt,
    };
}
function normalizePointEvents(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((item) => isPlainObject(item))
        .map((item) => {
        var _a;
        return ({
            type: item.type === "refund" ? "refund" : "deduct",
            points: Math.max(0, Math.floor((_a = parseFiniteNumber(item.points)) !== null && _a !== void 0 ? _a : 0)),
            reason: asTrimmedString(item.reason) || "",
            byUid: asTrimmedString(item.byUid) || null,
            createdAt: item.createdAt instanceof admin.firestore.Timestamp ? item.createdAt : null,
        });
    });
}
function getGiftishowRuntimeSecret(name) {
    return asTrimmedString(process.env[name]);
}
function shouldUseMockGiftishowProvider() {
    const providerMode = asTrimmedString(process.env.GIFTISHOW_PROVIDER_MODE).toLowerCase();
    if (providerMode === "mock")
        return true;
    if (providerMode === "live")
        return false;
    return process.env.FUNCTIONS_EMULATOR === "true" || process.env.NODE_ENV === "test";
}
function getMockScenario() {
    return asTrimmedString(process.env.GIFTISHOW_MOCK_SCENARIO, "success").toLowerCase();
}
function requireCredential(value, field) {
    const normalized = asTrimmedString(value);
    if (!normalized) {
        throw new GiftishowProviderError("CONFIG_MISSING", `${field} is required for live Giftishow requests.`);
    }
    return normalized;
}
function cleanUndefinedValues(payload) {
    return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}
function toGiftishowFormBody(payload) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(cleanUndefinedValues(payload))) {
        if (value === null)
            continue;
        params.append(key, String(value));
    }
    return params.toString();
}
function safeParseJson(value) {
    try {
        const parsed = JSON.parse(value);
        return isPlainObject(parsed) ? parsed : {};
    }
    catch (_a) {
        return {};
    }
}
function assertGiftishowSuccess(payload, label) {
    const code = resolveGiftishowCode(payload);
    if (!code || code === "0000")
        return;
    throw new GiftishowProviderError(code, resolveGiftishowMessage(payload, `${label}에 실패했습니다.`));
}
function resolveGiftishowCode(payload) {
    var _a, _b;
    return (asTrimmedString(payload.code)
        || asTrimmedString(payload.resCode)
        || asTrimmedString((_a = asRecord(payload.result)) === null || _a === void 0 ? void 0 : _a.code)
        || asTrimmedString((_b = asRecord(payload.result)) === null || _b === void 0 ? void 0 : _b.resCode));
}
function resolveGiftishowMessage(payload, fallback) {
    var _a, _b;
    return (asTrimmedString(payload.message)
        || asTrimmedString(payload.resMsg)
        || asTrimmedString((_a = asRecord(payload.result)) === null || _a === void 0 ? void 0 : _a.message)
        || asTrimmedString((_b = asRecord(payload.result)) === null || _b === void 0 ? void 0 : _b.resMsg)
        || fallback);
}
function isAbortError(error) {
    return error instanceof Error && error.name === "AbortError";
}
function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asRecord(value) {
    return isPlainObject(value) ? value : null;
}
function asTrimmedString(value, fallback = "") {
    if (typeof value !== "string")
        return fallback;
    const normalized = value.trim();
    return normalized || fallback;
}
function readGiftishowString(record, ...keys) {
    for (const key of keys) {
        const value = asTrimmedString(record[key]);
        if (value)
            return value;
    }
    return "";
}
function readGiftishowNumber(record, ...keys) {
    for (const key of keys) {
        const value = parseFiniteNumber(record[key]);
        if (value !== null)
            return value;
    }
    return null;
}
function findGiftishowRecords(value, keys, depth = 0) {
    if (depth > 6 || value == null)
        return [];
    if (Array.isArray(value)) {
        return value.flatMap((item) => findGiftishowRecords(item, keys, depth + 1));
    }
    if (!isPlainObject(value)) {
        return [];
    }
    const record = value;
    const matches = keys.some((key) => asTrimmedString(record[key]).length > 0);
    const nested = Object.values(record).flatMap((item) => findGiftishowRecords(item, keys, depth + 1));
    return matches ? [record, ...nested] : nested;
}
function findFirstGiftishowRecord(value, keys) {
    return findGiftishowRecords(value, keys)[0] || null;
}
async function mapWithConcurrency(items, concurrency, mapper) {
    const safeConcurrency = Math.max(1, Math.floor(concurrency));
    const results = new Array(items.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(safeConcurrency, items.length) }, async () => {
        while (cursor < items.length) {
            const currentIndex = cursor++;
            results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    }));
    return results;
}
function parseFiniteNumber(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed))
            return parsed;
    }
    return null;
}
function normalizePhoneNumber(value) {
    if (typeof value !== "string" && typeof value !== "number")
        return "";
    const digits = String(value).replace(/\D/g, "");
    if ((digits.length === 10 || digits.length === 11) && digits.startsWith("01")) {
        return digits;
    }
    return "";
}
function resolveFirstValidPhoneNumber(...values) {
    for (const value of values) {
        const normalized = normalizePhoneNumber(value);
        if (normalized)
            return normalized;
    }
    return "";
}
function maskPhoneNumber(value) {
    const digits = normalizePhoneNumber(value);
    if (!digits)
        return "";
    if (digits.length === 10) {
        return `${digits.slice(0, 3)}-${"*".repeat(3)}-${digits.slice(-4)}`;
    }
    return `${digits.slice(0, 3)}-${"*".repeat(4)}-${digits.slice(-4)}`;
}
function normalizeMembershipRoleValue(value) {
    if (typeof value !== "string")
        return "";
    const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
    if (normalized === "owner" || normalized === "admin" || normalized === "centermanager" || normalized === "centeradmin") {
        return "centerAdmin";
    }
    if (normalized === "teacher")
        return "teacher";
    if (normalized === "student")
        return "student";
    if (normalized === "parent")
        return "parent";
    return "";
}
function isAdminRole(value) {
    return normalizeMembershipRoleValue(value) === "centerAdmin";
}
function normalizeMembershipStatus(value) {
    if (typeof value !== "string")
        return "";
    return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}
function isActiveMembershipStatus(value) {
    const normalized = normalizeMembershipStatus(value);
    return !normalized || normalized === "active" || normalized === "approved" || normalized === "enabled" || normalized === "current";
}
function buildMockGiftishowGoods() {
    return [
        {
            goodsCode: "MOCK001",
            goodsName: "스타벅스 아메리카노 T",
            brandCode: "BRAND01",
            brandName: "스타벅스",
            salePrice: 4500,
            discountPrice: 4500,
            realPrice: 4500,
            goodsStateCd: "SALE",
            goodsTypeNm: "카페",
            goodsImgB: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80",
            goodsImgS: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=300&q=80",
            mmsGoodsImg: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=300&q=80",
        },
        {
            goodsCode: "MOCK002",
            goodsName: "배스킨라빈스 싱글킹",
            brandCode: "BRAND02",
            brandName: "배스킨라빈스",
            salePrice: 4700,
            discountPrice: 4700,
            realPrice: 4700,
            goodsStateCd: "SALE",
            goodsTypeNm: "디저트",
            goodsImgB: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80",
            goodsImgS: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=300&q=80",
            mmsGoodsImg: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=300&q=80",
        },
        {
            goodsCode: "MOCK003",
            goodsName: "GS25 모바일 상품권 5천원",
            brandCode: "BRAND03",
            brandName: "GS25",
            salePrice: 5000,
            discountPrice: 5000,
            realPrice: 5000,
            goodsStateCd: "SALE",
            goodsTypeNm: "편의점",
            goodsImgB: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80",
            goodsImgS: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80",
            mmsGoodsImg: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=300&q=80",
        },
        {
            goodsCode: "MOCK004",
            goodsName: "교보문고 교환권 1만원",
            brandCode: "BRAND04",
            brandName: "교보문고",
            salePrice: 10000,
            discountPrice: 10000,
            realPrice: 10000,
            goodsStateCd: "SALE",
            goodsTypeNm: "도서",
            goodsImgB: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80",
            goodsImgS: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80",
            mmsGoodsImg: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80",
        },
        {
            goodsCode: "MOCK005",
            goodsName: "메가커피 아이스티",
            brandCode: "BRAND05",
            brandName: "메가커피",
            salePrice: 3000,
            discountPrice: 3000,
            realPrice: 3000,
            goodsStateCd: "SALE",
            goodsTypeNm: "카페",
            goodsImgB: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80",
            goodsImgS: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=300&q=80",
            mmsGoodsImg: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=300&q=80",
        },
        {
            goodsCode: "MOCK006",
            goodsName: "품절 예시 상품",
            brandCode: "BRAND99",
            brandName: "테스트",
            salePrice: 8000,
            discountPrice: 8000,
            realPrice: 8000,
            goodsStateCd: "STOP",
            goodsTypeNm: "테스트",
            goodsImgB: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80",
            goodsImgS: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=300&q=80",
            mmsGoodsImg: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=300&q=80",
        },
    ];
}
function chunkArray(values, size) {
    if (values.length === 0)
        return [];
    const chunks = [];
    for (let index = 0; index < values.length; index += size) {
        chunks.push(values.slice(index, index + size));
    }
    return chunks;
}
function nullToUndefined(value) {
    return value !== null && value !== void 0 ? value : undefined;
}
//# sourceMappingURL=giftishow.js.map