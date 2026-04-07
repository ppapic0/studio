import { NextRequest } from "next/server";
import { z } from "zod";
import * as admin from "firebase-admin";

import {
  applyIpRateLimit,
  forbiddenJson,
  hasTrustedBrowserContext,
  noStoreJson,
  tooManyRequestsJson,
} from "@/lib/api-security";
import { adminDb } from "@/lib/firebase-admin";
import { resolveMarketingCenterId } from "@/lib/marketing-center";

const WEBSITE_CONSULT_SOURCE = "website";
const WEBSITE_CONSULT_LABEL = "웹사이트 상담폼";

export const dynamic = "force-dynamic";

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

const consultSchema = z.object({
  studentName: z.string().trim().min(1, "학생 이름을 입력해주세요.").max(15, "학생 이름은 15자 이내로 입력해주세요."),
  school: z.string().trim().min(1, "학교명을 입력해주세요.").max(15, "학교명은 15자 이내로 입력해주세요."),
  grade: z.string().trim().min(1, "학년을 선택해주세요.").max(10, "학년 형식이 올바르지 않습니다."),
  gender: z.enum(["남", "여"], { errorMap: () => ({ message: "성별을 선택해주세요." }) }),
  consultPhone: z
    .string()
    .trim()
    .transform(normalizePhone)
    .refine((value) => value.length >= 8 && value.length <= 15, "연락처는 15자 이내로 입력해주세요."),
  serviceType: z.enum(["korean_academy", "study_center"]),
  studyCenterRequestType: z.enum(["consult", "waitlist"]).optional(),
});

function getKoreaDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function getNextWaitlistQueueNumber(centerId: string) {
  const waitlistCollection = adminDb.collection("centers").doc(centerId).collection("admissionWaitlist");
  const [countSnap, latestQueueSnap] = await Promise.all([
    waitlistCollection.count().get(),
    waitlistCollection.orderBy("queueNumber", "desc").limit(1).get().catch(() => null),
  ]);

  const totalCount = countSnap.data().count ?? 0;
  const latestQueueNumber =
    latestQueueSnap?.docs[0]?.data()?.queueNumber && Number.isFinite(latestQueueSnap.docs[0].data().queueNumber)
      ? Number(latestQueueSnap.docs[0].data().queueNumber)
      : 0;

  return Math.max(totalCount, latestQueueNumber) + 1;
}

function resolveRequestType(
  serviceType: "korean_academy" | "study_center",
  studyCenterRequestType?: "consult" | "waitlist",
): { requestType: string; requestTypeLabel: string } {
  if (serviceType === "korean_academy") {
    return { requestType: "korean_academy_consult", requestTypeLabel: "국어 학원 상담" };
  }
  if (studyCenterRequestType === "waitlist") {
    return { requestType: "study_center_waitlist", requestTypeLabel: "관리형 스터디센터 입학 대기" };
  }
  return { requestType: "study_center_consult", requestTypeLabel: "관리형 스터디센터 상담" };
}

function buildLeadMemoLines(
  requestType: string,
  fields: {
    school: string;
    grade: string;
  },
  createdAt: string,
) {
  return [
    requestType === "study_center_waitlist" ? "웹 입학 대기 신청" : "웹 상담 신청",
    `학교: ${fields.school}`,
    `학년: ${fields.grade}`,
    `웹 접수: ${createdAt}`,
  ];
}

export async function POST(request: NextRequest) {
  const rateLimit = applyIpRateLimit(request, "consult:create", {
    max: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return tooManyRequestsJson(rateLimit.retryAfterSeconds, "상담 신청이 너무 자주 시도되고 있습니다. 잠시 후 다시 시도해주세요.");
  }

  if (!hasTrustedBrowserContext(request)) {
    return forbiddenJson("허용되지 않은 상담 신청 경로입니다.");
  }

  try {
    const body = await request.json();
    const parsed = consultSchema.safeParse(body);

    if (!parsed.success) {
      return noStoreJson(
        {
          ok: false,
          message: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.",
        },
        { status: 400 },
      );
    }

    const { serviceType, studyCenterRequestType, ...fields } = parsed.data;
    const { requestType, requestTypeLabel } = resolveRequestType(serviceType, studyCenterRequestType);

    const centerId = await resolveMarketingCenterId();
    const createdAt = new Date().toISOString();
    const consultationDate = getKoreaDateKey();
    const requestId = adminDb.collection("marketingConsultRequests").doc().id;
    const receiptId = requestId.slice(0, 8).toUpperCase();
    const shouldAutoCreateLead = Boolean(centerId);
    const autoLeadId = shouldAutoCreateLead
      ? adminDb.collection("centers").doc(centerId!).collection("consultingLeads").doc().id
      : null;
    const autoWaitlistId = shouldAutoCreateLead
      && requestType === "study_center_waitlist"
      ? adminDb.collection("centers").doc(centerId!).collection("admissionWaitlist").doc().id
      : null;
    const autoWaitlistQueueNumber =
      shouldAutoCreateLead && centerId && requestType === "study_center_waitlist"
        ? await getNextWaitlistQueueNumber(centerId)
        : null;

    const payload = {
      ...fields,
      serviceType,
      requestType,
      requestTypeLabel,
      centerId,
      consultationDate,
      source: WEBSITE_CONSULT_SOURCE,
      sourceLabel: WEBSITE_CONSULT_LABEL,
      status: "new",
      linkedLeadId: autoLeadId,
      createdAt,
      updatedAt: createdAt,
    };

    const batch = adminDb.batch();
    const rootRequestRef = adminDb.collection("marketingConsultRequests").doc(requestId);
    batch.set(rootRequestRef, { ...payload, receiptId });

    if (centerId) {
      const centerRequestRef = adminDb
        .collection("centers")
        .doc(centerId)
        .collection("websiteConsultRequests")
        .doc(requestId);
      batch.set(centerRequestRef, { ...payload, receiptId });

      if (shouldAutoCreateLead && autoLeadId) {
        const leadRef = adminDb
          .collection("centers")
          .doc(centerId)
          .collection("consultingLeads")
          .doc(autoLeadId);
        const memoLines = buildLeadMemoLines(requestType, fields, createdAt);

        batch.set(leadRef, {
          studentName: fields.studentName,
          parentName: "웹사이트 문의",
          parentPhone: fields.consultPhone,
          studentPhone: "",
          school: fields.school,
          grade: fields.grade,
          marketingChannel: WEBSITE_CONSULT_LABEL,
          referralRoute: "기타",
          referrerName: "",
          consultationDate,
          status: "new",
          serviceType,
          requestType,
          requestTypeLabel,
          memo: memoLines.join("\n"),
          source: WEBSITE_CONSULT_SOURCE,
          sourceRequestId: requestId,
          receiptId,
          addedToWaitlistId: autoWaitlistId,
          addedToWaitlistIds: autoWaitlistId ? [autoWaitlistId] : [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdByUid: null,
        });

        if (autoWaitlistId) {
          const waitlistRef = adminDb
            .collection("centers")
            .doc(centerId)
            .collection("admissionWaitlist")
            .doc(autoWaitlistId);

          batch.set(waitlistRef, {
            studentName: fields.studentName,
            parentPhone: fields.consultPhone,
            studentPhone: "",
            school: fields.school,
            grade: fields.grade,
            serviceType,
            status: "waiting",
            queueNumber: autoWaitlistQueueNumber,
            memo: WEBSITE_CONSULT_LABEL,
            waitlistDate: consultationDate,
            sourceLeadId: autoLeadId,
            sourceWebsiteRequestId: requestId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }

    await batch.commit();

    const successMessage =
      requestType === "study_center_waitlist"
        ? "입학 대기 신청이 접수되었습니다."
        : "상담 신청이 접수되었습니다.";

    return noStoreJson({ ok: true, message: successMessage, receiptId, createdAt, requestTypeLabel });
  } catch (error) {
    console.error("[consult][POST] failed", error);
    return noStoreJson(
      {
        ok: false,
        message: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      },
      { status: 500 },
    );
  }
}
