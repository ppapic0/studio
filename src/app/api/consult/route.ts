import { NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase-admin";
import { resolveMarketingCenterId } from "@/lib/marketing-center";

const WEBSITE_CONSULT_SOURCE = "website";
const WEBSITE_CONSULT_LABEL = "웹사이트 상담폼";

const consultSchema = z.object({
  studentName: z.string().trim().min(1, "학생 이름을 입력해주세요.").max(40, "학생 이름이 너무 깁니다."),
  school: z.string().trim().min(1, "학교명을 입력해주세요.").max(80, "학교명이 너무 깁니다."),
  consultPhone: z
    .string()
    .trim()
    .min(8, "연락처를 입력해주세요.")
    .max(30, "연락처 형식이 올바르지 않습니다."),
});

function getKoreaDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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

    const payload = parsed.data;
    const centerId = await resolveMarketingCenterId();
    const createdAt = new Date().toISOString();
    const consultationDate = getKoreaDateKey();

    await adminDb.collection("marketingConsultRequests").add({
      ...payload,
      centerId,
      consultationDate,
      source: WEBSITE_CONSULT_SOURCE,
      sourceLabel: WEBSITE_CONSULT_LABEL,
      status: "new",
      createdAt,
    });

    if (centerId) {
      await adminDb.collection("centers").doc(centerId).collection("websiteConsultRequests").add({
        ...payload,
        centerId,
        consultationDate,
        source: WEBSITE_CONSULT_SOURCE,
        sourceLabel: WEBSITE_CONSULT_LABEL,
        status: "new",
        createdAt,
        updatedAt: createdAt,
      });
    }

    return NextResponse.json({ ok: true, message: "상담 신청이 접수되었습니다." });
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
