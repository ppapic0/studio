import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase-admin";
import { resolveMarketingCenterId } from "@/lib/marketing-center";

const WEBSITE_CONSULT_SOURCE = "website";
const WEBSITE_CONSULT_LABEL = "웹사이트 상담폼";

const consultSchema = z.object({
  studentName: z.string().trim().min(1, "학생 이름을 입력해주세요.").max(40, "학생 이름이 너무 깁니다."),
  school: z.string().trim().min(1, "학교명을 입력해주세요.").max(80, "학교명이 너무 깁니다."),
  grade: z.string().trim().min(1, "학년을 선택해주세요.").max(10, "학년 형식이 올바르지 않습니다."),
  gender: z.enum(["남", "여"], { errorMap: () => ({ message: "성별을 선택해주세요." }) }),
  consultPhone: z
    .string()
    .trim()
    .min(8, "연락처를 입력해주세요.")
    .max(30, "연락처 형식이 올바르지 않습니다."),
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = consultSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
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
      createdAt,
    };

    const docRef = adminDb.collection("marketingConsultRequests").doc();
    const receiptId = docRef.id.slice(0, 8).toUpperCase();
    await docRef.set({ ...payload, receiptId });

    if (centerId) {
      await adminDb
        .collection("centers")
        .doc(centerId)
        .collection("websiteConsultRequests")
        .add({ ...payload, receiptId, updatedAt: createdAt });
    }

    const successMessage =
      requestType === "study_center_waitlist"
        ? "입학 대기 신청이 접수되었습니다."
        : "상담 신청이 접수되었습니다.";

    return NextResponse.json({ ok: true, message: successMessage, receiptId, createdAt, requestTypeLabel });
  } catch (error) {
    console.error("[consult][POST] failed", error);
    return NextResponse.json(
      {
        ok: false,
        message: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      },
      { status: 500 },
    );
  }
}
