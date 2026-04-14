import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const region = "asia-northeast3";
const GIFTISHOW_BASE_URL = "https://bizapi.giftishow.com/bizApi";
const GIFTISHOW_CATALOG_PAGE_SIZE = 100;
const GIFTISHOW_SYNC_BATCH_LIMIT = 320;
const GIFTISHOW_SEND_TIMEOUT_MS = 14_000;
const GIFTISHOW_MANUAL_REVIEW_THRESHOLD = 3;
const GIFTISHOW_SECRET_NAMES = [
  "GIFTISHOW_AUTH_CODE",
  "GIFTISHOW_AUTH_TOKEN",
] as const;
const giftishowSecureFunctions = functions
  .region(region)
  .runWith({ secrets: [...GIFTISHOW_SECRET_NAMES] });

type GiftishowDeliveryMode = "mms";
type GiftishowSyncStatus = "idle" | "syncing" | "success" | "error";
type GiftishowProviderMode = "mock" | "live";
type GiftishowOrderStatus =
  | "requested"
  | "approved"
  | "sending"
  | "pending_provider"
  | "sent"
  | "failed"
  | "rejected"
  | "cancelled";
type GiftishowPointEventType = "deduct" | "refund";

type GiftishowSettingsDoc = {
  enabled?: boolean;
  deliveryMode?: GiftishowDeliveryMode;
  bannerId?: string;
  templateId?: string;
  authCodeConfigured?: boolean;
  authTokenConfigured?: boolean;
  userIdConfigured?: boolean;
  callbackNoConfigured?: boolean;
  lastCatalogSyncedAt?: admin.firestore.Timestamp | null;
  lastBizmoneyBalance?: number | null;
  lastSyncStatus?: GiftishowSyncStatus;
  lastErrorMessage?: string | null;
  updatedAt?: admin.firestore.Timestamp;
  updatedBy?: string;
};

type GiftishowSecretDoc = {
  authCode?: string;
  authToken?: string;
  userId?: string;
  callbackNo?: string;
  updatedAt?: admin.firestore.Timestamp;
  updatedBy?: string;
};

type GiftishowProductDoc = {
  goodsCode: string;
  goodsName: string;
  brandCode?: string | null;
  brandName?: string | null;
  content?: string | null;
  contentAddDesc?: string | null;
  goodsTypeNm?: string | null;
  goodsTypeDtlNm?: string | null;
  affiliate?: string | null;
  goodsImgS?: string | null;
  goodsImgB?: string | null;
  mmsGoodsImg?: string | null;
  brandIconImg?: string | null;
  salePrice: number;
  discountPrice: number;
  realPrice?: number | null;
  validPrdTypeCd?: string | null;
  validPrdDay?: string | null;
  limitDay?: number | null;
  goodsStateCd?: string | null;
  mmsReserveFlag?: string | null;
  mmsBarcdCreateYn?: string | null;
  pointCost: number;
  isAvailable: boolean;
  lastSyncedAt?: admin.firestore.Timestamp | null;
  updatedAt?: admin.firestore.Timestamp;
};

type GiftishowOrderPointEvent = {
  type: GiftishowPointEventType;
  points: number;
  reason: string;
  byUid?: string | null;
  createdAt?: admin.firestore.Timestamp | null;
};

type GiftishowOrderDoc = {
  centerId: string;
  studentId: string;
  studentName: string;
  recipientPhoneMasked: string;
  goodsCode: string;
  goodsName: string;
  brandCode?: string | null;
  brandName?: string | null;
  salePrice: number;
  discountPrice: number;
  pointCost: number;
  status: GiftishowOrderStatus;
  providerMode?: GiftishowProviderMode;
  trId?: string | null;
  orderNo?: string | null;
  pinNo?: string | null;
  couponImgUrl?: string | null;
  sendStatusCode?: string | null;
  sendStatusName?: string | null;
  pinStatusCode?: string | null;
  pinStatusName?: string | null;
  validPrdEndDt?: string | null;
  sendResultCode?: string | null;
  sendResultMessage?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  rejectionReason?: string | null;
  cancelledReason?: string | null;
  needsManualReview?: boolean;
  reconcileAttemptCount?: number;
  resendCount?: number;
  pointEvents?: GiftishowOrderPointEvent[];
  requestedAt?: admin.firestore.Timestamp | null;
  requestedBy?: string | null;
  approvedAt?: admin.firestore.Timestamp | null;
  approvedBy?: string | null;
  sentAt?: admin.firestore.Timestamp | null;
  failedAt?: admin.firestore.Timestamp | null;
  rejectedAt?: admin.firestore.Timestamp | null;
  rejectedBy?: string | null;
  cancelledAt?: admin.firestore.Timestamp | null;
  cancelledBy?: string | null;
  lastReconciledAt?: admin.firestore.Timestamp | null;
  createdAt?: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
};

type GiftishowCredentials = {
  authCode?: string;
  authToken?: string;
  userId?: string;
  callbackNo?: string;
  bannerId?: string;
  templateId?: string;
};

type GiftishowGoodsItem = Record<string, unknown>;

type GiftishowListGoodsPageResult = {
  items: GiftishowGoodsItem[];
  totalCount: number;
};

type GiftishowSendSuccess = {
  orderNo?: string | null;
  pinNo?: string | null;
  couponImgUrl?: string | null;
  sendStatusCode?: string | null;
  sendStatusName?: string | null;
  pinStatusCode?: string | null;
  pinStatusName?: string | null;
  validPrdEndDt?: string | null;
  code?: string | null;
  message?: string | null;
};

type GiftishowCouponLookupResult = {
  found: boolean;
  orderNo?: string | null;
  pinNo?: string | null;
  couponImgUrl?: string | null;
  sendStatusCode?: string | null;
  sendStatusName?: string | null;
  pinStatusCode?: string | null;
  pinStatusName?: string | null;
  validPrdEndDt?: string | null;
};

type GiftishowRuntimeConfig = {
  settings: GiftishowSettingsDoc;
  secrets: GiftishowSecretDoc;
  mode: GiftishowProviderMode;
  settingsRef: admin.firestore.DocumentReference;
};

type GiftishowSendCouponInput = {
  trId: string;
  orderNo: string;
  goodsCode: string;
  phoneNo: string;
  mmsTitle: string;
  mmsMsg: string;
};

type GiftishowClient = {
  mode: GiftishowProviderMode;
  listGoodsPage(start: number, size: number): Promise<GiftishowListGoodsPageResult>;
  getBizmoney(): Promise<number>;
  sendCoupon(input: GiftishowSendCouponInput): Promise<GiftishowSendSuccess>;
  getCoupon(trId: string): Promise<GiftishowCouponLookupResult>;
  cancelCoupon(trId: string): Promise<{ alreadyCancelled?: boolean }>;
  resendCoupon(trId: string): Promise<void>;
};

class GiftishowProviderError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false
  ) {
    super(message);
    this.name = "GiftishowProviderError";
  }
}

class GiftishowTimeoutError extends Error {
  constructor(message = "Giftishow request timed out.") {
    super(message);
    this.name = "GiftishowTimeoutError";
  }
}

class MockGiftishowClient implements GiftishowClient {
  readonly mode = "mock" as const;

  async listGoodsPage(start: number, size: number): Promise<GiftishowListGoodsPageResult> {
    const all = buildMockGiftishowGoods();
    const sliceStart = Math.max(0, start);
    const sliceEnd = Math.min(all.length, sliceStart + Math.max(1, size));
    return {
      items: all.slice(sliceStart, sliceEnd),
      totalCount: all.length,
    };
  }

  async getBizmoney(): Promise<number> {
    return 250000;
  }

  async sendCoupon(_input: GiftishowSendCouponInput): Promise<GiftishowSendSuccess> {
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

  async getCoupon(_trId: string): Promise<GiftishowCouponLookupResult> {
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

  async cancelCoupon(_trId: string): Promise<{ alreadyCancelled?: boolean }> {
    if (getMockScenario() === "cancel-already") {
      return { alreadyCancelled: true };
    }
    if (getMockScenario() === "cancel-fail") {
      throw new GiftishowProviderError("MOCK-CANCEL", "Mock cancel failure.");
    }
    return {};
  }

  async resendCoupon(_trId: string): Promise<void> {
    if (getMockScenario() === "resend-fail") {
      throw new GiftishowProviderError("MOCK-RESEND", "Mock resend failure.");
    }
  }
}

class LiveGiftishowClient implements GiftishowClient {
  readonly mode = "live" as const;

  constructor(private readonly credentials: GiftishowCredentials) {}

  async listGoodsPage(start: number, size: number): Promise<GiftishowListGoodsPageResult> {
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
      ? result.goodsList.filter((item): item is GiftishowGoodsItem => isPlainObject(item))
      : [];
    const totalCount = Math.max(items.length, Math.floor(parseFiniteNumber(result.totalCount) ?? items.length));

    return { items, totalCount };
  }

  async getBizmoney(): Promise<number> {
    const payload = await this.postForm("/bizmoney", {
      api_code: "0301",
      custom_auth_code: requireCredential(this.credentials.authCode, "authCode"),
      custom_auth_token: requireCredential(this.credentials.authToken, "authToken"),
      user_id: requireCredential(this.credentials.userId, "userId"),
      dev_yn: "N",
    });

    assertGiftishowSuccess(payload, "비즈머니 조회");

    const result = asRecord(payload.result) || payload;
    const balance = Math.floor(parseFiniteNumber(result.balance ?? payload.balance) ?? Number.NaN);
    if (!Number.isFinite(balance)) {
      throw new GiftishowProviderError("BIZMONEY_PARSE", "비즈머니 잔액을 확인하지 못했습니다.");
    }
    return Math.max(0, balance);
  }

  async sendCoupon(input: GiftishowSendCouponInput): Promise<GiftishowSendSuccess> {
    const callbackNo = requireCredential(this.credentials.callbackNo, "callbackNo");

    assertGiftishowSendLimits(input.trId, input.mmsTitle);

    const payload = await this.postForm(
      "/send",
      {
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
      },
      GIFTISHOW_SEND_TIMEOUT_MS
    );

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

  async getCoupon(trId: string): Promise<GiftishowCouponLookupResult> {
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
      ? resultRoot.find((item): item is Record<string, unknown> => isPlainObject(item)) || null
      : asRecord(resultRoot);
    const nestedCode = resultRow ? resolveGiftishowCode(resultRow) : null;
    if (nestedCode && nestedCode !== "0000") {
      const notFoundCodes = new Set(["ERR0204", "ERR0212", "NO_DATA"]);
      if (notFoundCodes.has(nestedCode)) {
        return { found: false };
      }
      throw new GiftishowProviderError(
        nestedCode,
        resolveGiftishowMessage(resultRow || payload, "쿠폰 조회에 실패했습니다.")
      );
    }

    const couponInfoSource =
      (resultRow && Array.isArray(resultRow.couponInfoList) ? resultRow.couponInfoList : null)
      || (Array.isArray(payload.couponInfoList) ? payload.couponInfoList : []);
    const list = couponInfoSource.filter((item): item is Record<string, unknown> => isPlainObject(item));

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

  async cancelCoupon(trId: string): Promise<{ alreadyCancelled?: boolean }> {
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

  async resendCoupon(trId: string): Promise<void> {
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

  private async postForm(
    path: string,
    payload: Record<string, unknown>,
    timeoutMs = 10_000
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${GIFTISHOW_BASE_URL}${path}`, {
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
        throw new GiftishowProviderError(
          `HTTP_${response.status}`,
          resolveGiftishowMessage(parsed, `Giftishow HTTP ${response.status}`),
          response.status >= 500
        );
      }
      return parsed;
    } catch (error) {
      if (error instanceof GiftishowProviderError) {
        throw error;
      }
      if (isAbortError(error)) {
        throw new GiftishowTimeoutError();
      }
      throw new GiftishowProviderError(
        "NETWORK_ERROR",
        error instanceof Error ? error.message : String(error),
        true
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const saveGiftishowSettingsSecure = giftishowSecureFunctions.https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = asTrimmedString(data?.centerId);
  if (!centerId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId is required.");
  }

  await assertCenterAdmin(db, centerId, context.auth.uid);

  const publicRef = db.doc(`centers/${centerId}/settings/giftishow`);
  const privateRef = db.doc(`centers/${centerId}/settingsPrivate/giftishowSecret`);
  const [publicSnap, privateSnap] = await Promise.all([publicRef.get(), privateRef.get()]);
  const currentPublic = (publicSnap.exists ? publicSnap.data() : {}) as GiftishowSettingsDoc;
  const currentPrivate = (privateSnap.exists ? privateSnap.data() : {}) as GiftishowSecretDoc;

  const authCode = getGiftishowRuntimeSecret("GIFTISHOW_AUTH_CODE") || asTrimmedString(currentPrivate.authCode);
  const authToken = getGiftishowRuntimeSecret("GIFTISHOW_AUTH_TOKEN") || asTrimmedString(currentPrivate.authToken);
  const userId = asTrimmedString(data?.userId) || asTrimmedString(currentPrivate.userId);
  const callbackNo = normalizePhoneNumber(asTrimmedString(data?.callbackNo) || asTrimmedString(currentPrivate.callbackNo));

  const payload: GiftishowSettingsDoc = {
    enabled: data?.enabled === true,
    deliveryMode: "mms",
    bannerId: asTrimmedString(data?.bannerId) || nullToUndefined(currentPublic.bannerId),
    templateId: asTrimmedString(data?.templateId) || nullToUndefined(currentPublic.templateId),
    authCodeConfigured: Boolean(authCode),
    authTokenConfigured: Boolean(authToken),
    userIdConfigured: Boolean(userId),
    callbackNoConfigured: Boolean(callbackNo),
    lastSyncStatus: currentPublic.lastSyncStatus || "idle",
    lastCatalogSyncedAt: currentPublic.lastCatalogSyncedAt || null,
    lastBizmoneyBalance: currentPublic.lastBizmoneyBalance ?? null,
    lastErrorMessage: currentPublic.lastErrorMessage ?? null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp() as unknown as admin.firestore.Timestamp,
    updatedBy: context.auth.uid,
  };

  const batch = db.batch();
  batch.set(publicRef, payload, { merge: true });
  batch.set(privateRef, {
    ...(asTrimmedString(data?.userId) ? { userId: asTrimmedString(data?.userId) } : {}),
    ...(normalizePhoneNumber(data?.callbackNo) ? { callbackNo: normalizePhoneNumber(data?.callbackNo) } : {}),
    ...(asTrimmedString(currentPrivate.authCode) ? { authCode: admin.firestore.FieldValue.delete() } : {}),
    ...(asTrimmedString(currentPrivate.authToken) ? { authToken: admin.firestore.FieldValue.delete() } : {}),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: context.auth.uid,
  }, { merge: true });
  await batch.commit();

  return {
    ok: true,
    settings: {
      ...payload,
      updatedAt: undefined,
    },
  };
});

export const syncGiftishowCatalogSecure = giftishowSecureFunctions.https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = asTrimmedString(data?.centerId);
  if (!centerId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId is required.");
  }

  await assertCenterAdmin(db, centerId, context.auth.uid);
  const result = await syncGiftishowCatalogForCenter(db, centerId, context.auth.uid);
  return {
    syncedCount: result.syncedCount,
    availableCount: result.availableCount,
    lastCatalogSyncedAt: result.lastCatalogSyncedAt.toISOString(),
    mode: result.mode,
  };
});

export const scheduledGiftishowCatalogSync = giftishowSecureFunctions
  .pubsub.schedule("20 4 * * *")
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    const db = admin.firestore();
    const centersSnap = await db.collection("centers").get();

    for (const centerDoc of centersSnap.docs) {
      const centerId = centerDoc.id;
      const settingsSnap = await db.doc(`centers/${centerId}/settings/giftishow`).get();
      const settings = (settingsSnap.exists ? settingsSnap.data() : {}) as GiftishowSettingsDoc;
      if (!settings.enabled) continue;

      try {
        await syncGiftishowCatalogForCenter(db, centerId, "scheduler");
      } catch (error) {
        functions.logger.error("giftishow catalog sync failed", {
          centerId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return null;
  });

export const getGiftishowBizmoneySecure = giftishowSecureFunctions.https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = asTrimmedString(data?.centerId);
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

export const createGiftishowOrderRequestSecure = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = asTrimmedString(data?.centerId);
  const goodsCode = asTrimmedString(data?.goodsCode);
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

  const product = productSnap.data() as GiftishowProductDoc;
  if (!product.isAvailable || product.goodsStateCd !== "SALE") {
    throw new functions.https.HttpsError("failed-precondition", "현재 교환할 수 없는 상품입니다.");
  }
  if (!studentContext.phoneNumber) {
    throw new functions.https.HttpsError("failed-precondition", "학생 전화번호가 없어 교환 요청을 만들 수 없습니다.");
  }

  const orderRef = db.collection(`centers/${centerId}/giftishowOrders`).doc();
  const now = admin.firestore.Timestamp.now();
  const orderPayload: GiftishowOrderDoc = {
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

export const approveGiftishowOrderSecure = giftishowSecureFunctions.https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = asTrimmedString(data?.centerId);
  const orderId = asTrimmedString(data?.orderId);
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

  const order = orderSnap.data() as GiftishowOrderDoc;
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
  } catch (error) {
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

export const rejectGiftishowOrderSecure = functions.region(region).https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = asTrimmedString(data?.centerId);
  const orderId = asTrimmedString(data?.orderId);
  if (!centerId || !orderId) {
    throw new functions.https.HttpsError("invalid-argument", "centerId and orderId are required.");
  }

  await assertCenterAdmin(db, centerId, context.auth.uid);
  const orderRef = db.doc(`centers/${centerId}/giftishowOrders/${orderId}`);
  const order = await db.runTransaction(async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) {
      throw new functions.https.HttpsError("not-found", "주문 요청을 찾을 수 없습니다.");
    }

    const currentOrder = orderSnap.data() as GiftishowOrderDoc;
    if (currentOrder.status !== "requested") {
      throw new functions.https.HttpsError("failed-precondition", "반려 가능한 상태가 아닙니다.");
    }

    const now = admin.firestore.Timestamp.now();
    const nextOrder: GiftishowOrderDoc = {
      ...currentOrder,
      status: "rejected",
      rejectionReason: asTrimmedString(data?.reason),
      rejectedAt: now,
      rejectedBy: context.auth?.uid || null,
      updatedAt: now,
    };
    transaction.set(orderRef, nextOrder, { merge: true });
    return nextOrder;
  });

  return {
    ok: true,
    order: serializeOrder(orderId, order),
  };
});

export const cancelGiftishowOrderSecure = giftishowSecureFunctions.https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = asTrimmedString(data?.centerId);
  const orderId = asTrimmedString(data?.orderId);
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

  const order = orderSnap.data() as GiftishowOrderDoc;
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
    reason: asTrimmedString(data?.reason) || "cancelled",
    cancelledReason: asTrimmedString(data?.reason),
  });

  return {
    ok: true,
    order: nextOrder,
  };
});

export const resendGiftishowOrderSecure = giftishowSecureFunctions.https.onCall(async (data, context) => {
  const db = admin.firestore();

  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const centerId = asTrimmedString(data?.centerId);
  const orderId = asTrimmedString(data?.orderId);
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

  const order = orderSnap.data() as GiftishowOrderDoc;
  if (!order.trId || order.status !== "sent") {
    throw new functions.https.HttpsError("failed-precondition", "재전송 가능한 상태가 아닙니다.");
  }

  const client = createGiftishowClient(runtime);
  await client.resendCoupon(order.trId);

  const nextOrder = await db.runTransaction(async (transaction) => {
    const currentSnap = await transaction.get(orderRef);
    const currentOrder = currentSnap.data() as GiftishowOrderDoc;
    const now = admin.firestore.Timestamp.now();
    const updatedOrder: GiftishowOrderDoc = {
      ...currentOrder,
      resendCount: Math.max(0, Math.floor(currentOrder.resendCount || 0)) + 1,
      updatedAt: now,
    };
    transaction.set(orderRef, updatedOrder, { merge: true });
    return updatedOrder;
  });

  return {
    ok: true,
    order: serializeOrder(orderId, nextOrder),
  };
});

export const reconcilePendingGiftishowOrders = giftishowSecureFunctions
  .pubsub.schedule("every 10 minutes")
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    const db = admin.firestore();
    const pendingSnap = await db.collectionGroup("giftishowOrders").where("status", "==", "pending_provider").limit(120).get();

    for (const orderDoc of pendingSnap.docs) {
      const order = orderDoc.data() as GiftishowOrderDoc;
      if (!order.centerId || !order.trId) continue;

      try {
        const runtime = await loadGiftishowRuntimeConfig(db, order.centerId);
        const client = createGiftishowClient(runtime);
        const lookup = await client.getCoupon(order.trId);

        if (lookup.found) {
          await finalizeGiftishowReconciliationSuccess(orderDoc.ref, orderDoc.id, order, lookup, client.mode);
          continue;
        }

        await markGiftishowPendingManualReview(orderDoc.ref, orderDoc.id, order);
      } catch (error) {
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

async function syncGiftishowCatalogForCenter(
  db: admin.firestore.Firestore,
  centerId: string,
  requestedBy: string
) {
  const runtime = await loadGiftishowRuntimeConfig(db, centerId);
  const client = createGiftishowClient(runtime);

  await runtime.settingsRef.set({
    lastSyncStatus: "syncing",
    lastErrorMessage: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: requestedBy,
  }, { merge: true });

  try {
    const allItems: GiftishowGoodsItem[] = [];
    let start = 0;
    let totalCount = Number.POSITIVE_INFINITY;

    while (allItems.length < totalCount) {
      const page = await client.listGoodsPage(start, GIFTISHOW_CATALOG_PAGE_SIZE);
      allItems.push(...page.items);
      totalCount = page.totalCount;
      if (page.items.length === 0) break;
      start += page.items.length;
      if (page.items.length < GIFTISHOW_CATALOG_PAGE_SIZE) break;
    }

    const now = admin.firestore.Timestamp.now();
    const productDocs = allItems.map((item) => normalizeGiftishowProduct(item, now));
    const chunks = chunkArray(productDocs, GIFTISHOW_SYNC_BATCH_LIMIT);

    for (const chunk of chunks) {
      const batch = db.batch();
      for (const product of chunk) {
        batch.set(db.doc(`centers/${centerId}/giftishowProducts/${product.goodsCode}`), product, { merge: true });
      }
      await batch.commit();
    }

    await runtime.settingsRef.set({
      lastCatalogSyncedAt: now,
      lastSyncStatus: "success",
      lastErrorMessage: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: requestedBy,
    }, { merge: true });

    return {
      syncedCount: productDocs.length,
      availableCount: productDocs.filter((product) => product.isAvailable).length,
      lastCatalogSyncedAt: now.toDate(),
      mode: client.mode,
    };
  } catch (error) {
    await runtime.settingsRef.set({
      lastSyncStatus: "error",
      lastErrorMessage: error instanceof Error ? error.message : String(error),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: requestedBy,
    }, { merge: true });
    throw error;
  }
}

async function claimGiftishowOrderForSend(params: {
  db: admin.firestore.Firestore;
  centerId: string;
  orderId: string;
  orderRef: admin.firestore.DocumentReference;
  approvedBy: string;
  trId: string;
  now: Date;
}) {
  const { db, centerId, orderRef, approvedBy, trId, now } = params;

  return db.runTransaction(async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) {
      throw new functions.https.HttpsError("not-found", "주문 요청을 찾을 수 없습니다.");
    }
    const order = orderSnap.data() as GiftishowOrderDoc;
    if (order.status !== "requested") {
      throw new functions.https.HttpsError("failed-precondition", "승인 가능한 요청 상태가 아닙니다.");
    }

    const progressRef = db.doc(`centers/${centerId}/growthProgress/${order.studentId}`);
    const progressSnap = await transaction.get(progressRef);
    const pointsBalance = Math.max(0, Math.floor(parseFiniteNumber(progressSnap.data()?.pointsBalance) ?? 0));
    const pointCost = Math.max(0, Math.floor(parseFiniteNumber(order.pointCost) ?? 0));
    if (pointsBalance < pointCost) {
      throw new functions.https.HttpsError("failed-precondition", "포인트가 부족합니다.");
    }

    const timestamp = admin.firestore.Timestamp.fromDate(now);
    const pointEvents = normalizePointEvents(order.pointEvents);
    pointEvents.push(buildPointEvent("deduct", pointCost, "approval", approvedBy, timestamp));

    const nextOrder: GiftishowOrderDoc = {
      ...order,
      status: "sending",
      providerMode: shouldUseMockGiftishowProvider() ? "mock" : "live",
      trId,
      approvedAt: timestamp,
      approvedBy,
      resendCount: Math.max(0, Math.floor(order.resendCount || 0)),
      reconcileAttemptCount: Math.max(0, Math.floor(order.reconcileAttemptCount || 0)),
      pointEvents,
      updatedAt: timestamp,
    };

    transaction.set(progressRef, {
      pointsBalance: admin.firestore.FieldValue.increment(-pointCost),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(orderRef, nextOrder, { merge: true });
    return nextOrder;
  });
}

async function finalizeGiftishowSendSuccess(params: {
  orderRef: admin.firestore.DocumentReference;
  orderId: string;
  existingOrder: GiftishowOrderDoc;
  sendResult: GiftishowSendSuccess;
  mode: GiftishowProviderMode;
}) {
  const { orderRef, orderId, existingOrder, sendResult, mode } = params;
  const now = admin.firestore.Timestamp.now();
  const nextOrder: GiftishowOrderDoc = {
    ...existingOrder,
    status: "sent",
    providerMode: mode,
    orderNo: sendResult.orderNo || existingOrder.orderNo || null,
    pinNo: sendResult.pinNo || existingOrder.pinNo || null,
    couponImgUrl: sendResult.couponImgUrl || existingOrder.couponImgUrl || null,
    sendStatusCode: sendResult.sendStatusCode || existingOrder.sendStatusCode || "1000",
    sendStatusName: sendResult.sendStatusName || existingOrder.sendStatusName || "발송완료",
    pinStatusCode: sendResult.pinStatusCode || existingOrder.pinStatusCode || null,
    pinStatusName: sendResult.pinStatusName || existingOrder.pinStatusName || null,
    validPrdEndDt: sendResult.validPrdEndDt || existingOrder.validPrdEndDt || null,
    sendResultCode: sendResult.code || "0000",
    sendResultMessage: sendResult.message || "SUCCESS",
    lastErrorCode: null,
    lastErrorMessage: null,
    needsManualReview: false,
    sentAt: now,
    updatedAt: now,
  };

  await orderRef.set(nextOrder, { merge: true });
  return serializeOrder(orderId, nextOrder);
}

async function markGiftishowOrderPendingProvider(params: {
  orderRef: admin.firestore.DocumentReference;
  orderId: string;
  existingOrder: GiftishowOrderDoc;
  mode: GiftishowProviderMode;
}) {
  const now = admin.firestore.Timestamp.now();
  const nextOrder: GiftishowOrderDoc = {
    ...params.existingOrder,
    status: "pending_provider",
    providerMode: params.mode,
    lastErrorCode: "TIMEOUT",
    lastErrorMessage: "Giftishow 응답을 바로 확인하지 못해 사업자 조회 대기로 전환했습니다.",
    reconcileAttemptCount: Math.max(0, Math.floor(params.existingOrder.reconcileAttemptCount || 0)),
    needsManualReview: false,
    updatedAt: now,
  };
  await params.orderRef.set(nextOrder, { merge: true });
  return serializeOrder(params.orderId, nextOrder);
}

async function finalizeGiftishowReconciliationSuccess(
  orderRef: admin.firestore.DocumentReference,
  orderId: string,
  existingOrder: GiftishowOrderDoc,
  lookup: GiftishowCouponLookupResult,
  mode: GiftishowProviderMode
) {
  const now = admin.firestore.Timestamp.now();
  const nextOrder: GiftishowOrderDoc = {
    ...existingOrder,
    status: "sent",
    providerMode: mode,
    orderNo: lookup.orderNo || existingOrder.orderNo || null,
    pinNo: lookup.pinNo || existingOrder.pinNo || null,
    couponImgUrl: lookup.couponImgUrl || existingOrder.couponImgUrl || null,
    sendStatusCode: lookup.sendStatusCode || existingOrder.sendStatusCode || "1000",
    sendStatusName: lookup.sendStatusName || existingOrder.sendStatusName || "발송완료",
    pinStatusCode: lookup.pinStatusCode || existingOrder.pinStatusCode || null,
    pinStatusName: lookup.pinStatusName || existingOrder.pinStatusName || null,
    validPrdEndDt: lookup.validPrdEndDt || existingOrder.validPrdEndDt || null,
    needsManualReview: false,
    lastErrorCode: null,
    lastErrorMessage: null,
    reconcileAttemptCount: Math.max(0, Math.floor(existingOrder.reconcileAttemptCount || 0)) + 1,
    lastReconciledAt: now,
    sentAt: existingOrder.sentAt || now,
    updatedAt: now,
  };

  await orderRef.set(nextOrder, { merge: true });
  return serializeOrder(orderId, nextOrder);
}

async function markGiftishowPendingManualReview(
  orderRef: admin.firestore.DocumentReference,
  orderId: string,
  existingOrder: GiftishowOrderDoc,
  error?: unknown
) {
  const nextAttempt = Math.max(0, Math.floor(existingOrder.reconcileAttemptCount || 0)) + 1;
  const now = admin.firestore.Timestamp.now();
  const nextOrder: GiftishowOrderDoc = {
    ...existingOrder,
    reconcileAttemptCount: nextAttempt,
    needsManualReview: nextAttempt >= GIFTISHOW_MANUAL_REVIEW_THRESHOLD,
    lastErrorCode: error instanceof GiftishowProviderError ? error.code : existingOrder.lastErrorCode || "PENDING_PROVIDER",
    lastErrorMessage:
      error instanceof Error
        ? error.message
        : existingOrder.lastErrorMessage || "사업자 쿠폰 조회에서 즉시 확인되지 않았습니다.",
    lastReconciledAt: now,
    updatedAt: now,
  };
  await orderRef.set(nextOrder, { merge: true });
  return serializeOrder(orderId, nextOrder);
}

async function refundGiftishowOrderPoints(params: {
  db: admin.firestore.Firestore;
  centerId: string;
  orderId: string;
  orderRef: admin.firestore.DocumentReference;
  status: Extract<GiftishowOrderStatus, "failed" | "cancelled">;
  byUid: string;
  reason: string;
  errorCode?: string;
  errorMessage?: string;
  cancelledReason?: string;
}) {
  const { db, centerId, orderId, orderRef, status, byUid, reason, errorCode, errorMessage, cancelledReason } = params;
  const now = admin.firestore.Timestamp.now();

  const updatedOrder = await db.runTransaction(async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists) {
      throw new functions.https.HttpsError("not-found", "주문 정보를 찾을 수 없습니다.");
    }
    const currentOrder = orderSnap.data() as GiftishowOrderDoc;
    const pointCost = Math.max(0, Math.floor(parseFiniteNumber(currentOrder.pointCost) ?? 0));
    const pointEvents = normalizePointEvents(currentOrder.pointEvents);
    const alreadyRefunded = pointEvents.some((event) => event.type === "refund");

    if (!alreadyRefunded && pointCost > 0) {
      pointEvents.push(buildPointEvent("refund", pointCost, reason, byUid, now));
      transaction.set(db.doc(`centers/${centerId}/growthProgress/${currentOrder.studentId}`), {
        pointsBalance: admin.firestore.FieldValue.increment(pointCost),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    const nextOrder: GiftishowOrderDoc = {
      ...currentOrder,
      status,
      pointEvents,
      lastErrorCode: errorCode || null,
      lastErrorMessage: errorMessage || null,
      cancelledReason: cancelledReason || currentOrder.cancelledReason || null,
      failedAt: status === "failed" ? now : currentOrder.failedAt || null,
      cancelledAt: status === "cancelled" ? now : currentOrder.cancelledAt || null,
      cancelledBy: status === "cancelled" ? byUid : currentOrder.cancelledBy || null,
      needsManualReview: false,
      updatedAt: now,
    };

    transaction.set(orderRef, nextOrder, { merge: true });
    return nextOrder;
  });

  return serializeOrder(orderId, updatedOrder);
}

async function loadGiftishowRuntimeConfig(
  db: admin.firestore.Firestore,
  centerId: string
): Promise<GiftishowRuntimeConfig> {
  const settingsRef = db.doc(`centers/${centerId}/settings/giftishow`);
  const [settingsSnap, secretSnap] = await Promise.all([
    settingsRef.get(),
    db.doc(`centers/${centerId}/settingsPrivate/giftishowSecret`).get(),
  ]);
  const legacySecrets = (secretSnap.exists ? secretSnap.data() : {}) as GiftishowSecretDoc;

  return {
    settings: (settingsSnap.exists ? settingsSnap.data() : {}) as GiftishowSettingsDoc,
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

function createGiftishowClient(runtime: GiftishowRuntimeConfig): GiftishowClient {
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

async function assertCenterAdmin(
  db: admin.firestore.Firestore,
  centerId: string,
  uid: string
) {
  const membership = await resolveCenterMembershipRole(db, centerId, uid);
  if (!isAdminRole(membership.role) || !isActiveMembershipStatus(membership.status)) {
    throw new functions.https.HttpsError("permission-denied", "센터 관리자만 실행할 수 있습니다.");
  }
}

async function resolveStudentContext(
  db: admin.firestore.Firestore,
  centerId: string,
  studentId: string
) {
  const [studentSnap, memberSnap, userSnap] = await Promise.all([
    db.doc(`centers/${centerId}/students/${studentId}`).get(),
    db.doc(`centers/${centerId}/members/${studentId}`).get(),
    db.doc(`users/${studentId}`).get(),
  ]);

  const studentData = (studentSnap.exists ? studentSnap.data() : {}) as Record<string, unknown>;
  const memberData = (memberSnap.exists ? memberSnap.data() : {}) as Record<string, unknown>;
  const userData = (userSnap.exists ? userSnap.data() : {}) as Record<string, unknown>;

  const displayName =
    asTrimmedString(studentData.name)
    || asTrimmedString(memberData.displayName)
    || asTrimmedString(userData.displayName)
    || "학생";

  const phoneNumber = resolveFirstValidPhoneNumber(
    studentData.phoneNumber,
    memberData.phoneNumber,
    userData.phoneNumber
  );

  return {
    displayName,
    phoneNumber,
  };
}

async function resolveCenterDisplayName(
  db: admin.firestore.Firestore,
  centerId: string
) {
  const centerSnap = await db.doc(`centers/${centerId}`).get();
  const data = (centerSnap.exists ? centerSnap.data() : {}) as Record<string, unknown>;
  return asTrimmedString(data.name) || asTrimmedString(data.centerName) || "센터";
}

async function resolveCenterMembershipRole(
  db: admin.firestore.Firestore,
  centerId: string,
  uid: string
): Promise<{ role: string | null; status: unknown }> {
  const [memberSnap, userCenterSnap] = await Promise.all([
    db.doc(`centers/${centerId}/members/${uid}`).get(),
    db.doc(`userCenters/${uid}/centers/${centerId}`).get(),
  ]);

  const memberData = memberSnap.exists ? (memberSnap.data() as Record<string, unknown>) : null;
  const userCenterData = userCenterSnap.exists ? (userCenterSnap.data() as Record<string, unknown>) : null;
  const memberRole = normalizeMembershipRoleValue(memberData?.role);
  if (memberRole) {
    return {
      role: memberRole,
      status: memberData?.status,
    };
  }

  return {
    role: normalizeMembershipRoleValue(userCenterData?.role) || null,
    status: userCenterData?.status,
  };
}

function normalizeGiftishowProduct(
  item: GiftishowGoodsItem,
  syncedAt: admin.firestore.Timestamp
): GiftishowProductDoc {
  const goodsCode = asTrimmedString(item.goodsCode);
  const salePrice = Math.max(0, Math.floor(parseFiniteNumber(item.salePrice) ?? 0));
  const discountPrice = Math.max(0, Math.floor(parseFiniteNumber(item.discountPrice) ?? salePrice));
  const stateCode = asTrimmedString(item.goodsStateCd);

  return {
    goodsCode,
    goodsName: asTrimmedString(item.goodsName) || "기프티쇼 상품",
    brandCode: asTrimmedString(item.brandCode) || null,
    brandName: asTrimmedString(item.brandName) || null,
    content: asTrimmedString(item.content) || null,
    contentAddDesc: asTrimmedString(item.contentAddDesc) || null,
    goodsTypeNm: asTrimmedString(item.goodsTypeNm) || null,
    goodsTypeDtlNm: asTrimmedString(item.goodsTypeDtlNm) || null,
    affiliate: asTrimmedString(item.affiliate) || null,
    goodsImgS: asTrimmedString(item.goodsImgS) || null,
    goodsImgB: asTrimmedString(item.goodsImgB) || null,
    mmsGoodsImg: asTrimmedString(item.mmsGoodsImg) || null,
    brandIconImg: asTrimmedString(item.brandIconImg) || null,
    salePrice,
    discountPrice,
    realPrice: Math.max(0, Math.floor(parseFiniteNumber(item.realPrice) ?? discountPrice)),
    validPrdTypeCd: asTrimmedString(item.validPrdTypeCd) || null,
    validPrdDay: asTrimmedString(item.validPrdDay) || null,
    limitDay: Math.max(0, Math.floor(parseFiniteNumber(item.limitDay) ?? 0)),
    goodsStateCd: stateCode || null,
    mmsReserveFlag: asTrimmedString(item.mmsReserveFlag) || null,
    mmsBarcdCreateYn: asTrimmedString(item.mmsBarcdCreateYn) || null,
    pointCost: salePrice,
    isAvailable: stateCode === "SALE" && salePrice > 0,
    lastSyncedAt: syncedAt,
    updatedAt: syncedAt,
  };
}

function buildGiftishowTrId(orderId: string) {
  const seed = `${Date.now().toString(36)}${orderId.slice(-8)}`.replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
  const trId = `gs${seed}`;
  assertGiftishowSendLimits(trId, "보상 도착");
  return trId;
}

function buildGiftishowMmsTitle(centerName: string) {
  const baseTitle = `${centerName} 보상 도착`.trim();
  if (baseTitle.length <= 20) return baseTitle;
  return "보상 도착 안내";
}

function buildGiftishowMmsMessage(params: {
  centerName: string;
  goodsName: string;
  studentName: string;
}) {
  const centerName = params.centerName || "센터";
  const goodsName = params.goodsName || "보상 상품";
  const studentName = params.studentName || "학생";
  return `[${centerName}] ${studentName} 학생이 요청한 ${goodsName} 보상이 도착했습니다.`;
}

function assertGiftishowSendLimits(trId: string, mmsTitle: string) {
  if (Buffer.byteLength(trId, "utf8") > 25) {
    throw new GiftishowProviderError("TR_ID_LIMIT", "tr_id 는 25byte 이하만 허용됩니다.");
  }
  if (mmsTitle.length > 20) {
    throw new GiftishowProviderError("MMS_TITLE_LIMIT", "mms_title 은 20자 이하만 허용됩니다.");
  }
}

function normalizeGiftishowError(error: unknown) {
  if (error instanceof GiftishowProviderError) {
    return error;
  }
  if (error instanceof GiftishowTimeoutError) {
    return new GiftishowProviderError("TIMEOUT", error.message, true);
  }
  return new GiftishowProviderError(
    "UNKNOWN",
    error instanceof Error ? error.message : String(error),
    true
  );
}

function serializeOrder(id: string, order: GiftishowOrderDoc) {
  return {
    id,
    ...order,
  };
}

function buildPointEvent(
  type: GiftishowPointEventType,
  points: number,
  reason: string,
  byUid: string,
  createdAt: admin.firestore.Timestamp
): GiftishowOrderPointEvent {
  return {
    type,
    points: Math.max(0, Math.floor(points)),
    reason,
    byUid,
    createdAt,
  };
}

function normalizePointEvents(value: unknown): GiftishowOrderPointEvent[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => isPlainObject(item))
    .map((item) => ({
      type: item.type === "refund" ? "refund" : "deduct",
      points: Math.max(0, Math.floor(parseFiniteNumber(item.points) ?? 0)),
      reason: asTrimmedString(item.reason) || "",
      byUid: asTrimmedString(item.byUid) || null,
      createdAt: item.createdAt instanceof admin.firestore.Timestamp ? item.createdAt : null,
    }));
}

function getGiftishowRuntimeSecret(name: typeof GIFTISHOW_SECRET_NAMES[number]) {
  return asTrimmedString(process.env[name]);
}

function shouldUseMockGiftishowProvider() {
  const providerMode = asTrimmedString(process.env.GIFTISHOW_PROVIDER_MODE).toLowerCase();
  if (providerMode === "mock") return true;
  if (providerMode === "live") return false;
  return process.env.FUNCTIONS_EMULATOR === "true" || process.env.NODE_ENV === "test";
}

function getMockScenario() {
  return asTrimmedString(process.env.GIFTISHOW_MOCK_SCENARIO, "success").toLowerCase();
}

function requireCredential(value: string | undefined, field: string) {
  const normalized = asTrimmedString(value);
  if (!normalized) {
    throw new GiftishowProviderError("CONFIG_MISSING", `${field} is required for live Giftishow requests.`);
  }
  return normalized;
}

function cleanUndefinedValues(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function toGiftishowFormBody(payload: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(cleanUndefinedValues(payload))) {
    if (value === null) continue;
    params.append(key, String(value));
  }
  return params.toString();
}

function safeParseJson(value: string) {
  try {
    const parsed = JSON.parse(value);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function assertGiftishowSuccess(payload: Record<string, unknown>, label: string) {
  const code = resolveGiftishowCode(payload);
  if (!code || code === "0000") return;
  throw new GiftishowProviderError(code, resolveGiftishowMessage(payload, `${label}에 실패했습니다.`));
}

function resolveGiftishowCode(payload: Record<string, unknown>) {
  return (
    asTrimmedString(payload.code)
    || asTrimmedString(payload.resCode)
    || asTrimmedString(asRecord(payload.result)?.code)
    || asTrimmedString(asRecord(payload.result)?.resCode)
  );
}

function resolveGiftishowMessage(payload: Record<string, unknown>, fallback: string) {
  return (
    asTrimmedString(payload.message)
    || asTrimmedString(payload.resMsg)
    || asTrimmedString(asRecord(payload.result)?.message)
    || asTrimmedString(asRecord(payload.result)?.resMsg)
    || fallback
  );
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isPlainObject(value) ? value : null;
}

function asTrimmedString(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizePhoneNumber(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const digits = String(value).replace(/\D/g, "");
  if ((digits.length === 10 || digits.length === 11) && digits.startsWith("01")) {
    return digits;
  }
  return "";
}

function resolveFirstValidPhoneNumber(...values: unknown[]) {
  for (const value of values) {
    const normalized = normalizePhoneNumber(value);
    if (normalized) return normalized;
  }
  return "";
}

function maskPhoneNumber(value: string) {
  const digits = normalizePhoneNumber(value);
  if (!digits) return "";
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${"*".repeat(3)}-${digits.slice(-4)}`;
  }
  return `${digits.slice(0, 3)}-${"*".repeat(4)}-${digits.slice(-4)}`;
}

function normalizeMembershipRoleValue(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized === "owner" || normalized === "admin" || normalized === "centermanager" || normalized === "centeradmin") {
    return "centerAdmin";
  }
  if (normalized === "teacher") return "teacher";
  if (normalized === "student") return "student";
  if (normalized === "parent") return "parent";
  return "";
}

function isAdminRole(value: unknown) {
  return normalizeMembershipRoleValue(value) === "centerAdmin";
}

function normalizeMembershipStatus(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function isActiveMembershipStatus(value: unknown) {
  const normalized = normalizeMembershipStatus(value);
  return !normalized || normalized === "active" || normalized === "approved" || normalized === "enabled" || normalized === "current";
}

function buildMockGiftishowGoods(): GiftishowGoodsItem[] {
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

function chunkArray<T>(values: T[], size: number) {
  if (values.length === 0) return [] as T[][];
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function nullToUndefined(value: string | null | undefined) {
  return value ?? undefined;
}
