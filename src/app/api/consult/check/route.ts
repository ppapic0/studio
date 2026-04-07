import { NextRequest } from "next/server";

import {
  applyIpRateLimit,
  forbiddenJson,
  hasTrustedBrowserContext,
  noStoreJson,
  tooManyRequestsJson,
} from "@/lib/api-security";
import { adminDb } from "@/lib/firebase-admin";

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function toDateMs(value: unknown) {
  if (!value) return 0;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  }
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    const parsed = (value as { toDate: () => Date }).toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
  }
  return 0;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rateLimit = applyIpRateLimit(request, "consult:check", {
    max: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.ok) {
    return tooManyRequestsJson(rateLimit.retryAfterSeconds, "조회 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
  }

  if (!hasTrustedBrowserContext(request)) {
    return forbiddenJson("허용되지 않은 조회 경로입니다.");
  }

  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone")?.trim();
  const name = searchParams.get("name")?.trim();
  const normalizedPhone = normalizePhone(phone || "");

  if (!normalizedPhone || normalizedPhone.length < 8) {
    return noStoreJson({ ok: false, message: "연락처를 입력해주세요." }, { status: 400 });
  }

  try {
    const snapshot = await adminDb
      .collection("marketingConsultRequests")
      .where("consultPhone", "==", normalizedPhone)
      .limit(20)
      .get();

    const normalizedName = name?.trim();
    const uniqueDocs = Array.from(new Map(snapshot.docs.map((doc) => [doc.id, doc])).values())
      .filter((doc) => {
        if (!normalizedName) return true;
        return String(doc.data().studentName || "").trim() === normalizedName;
      })
      .sort((a, b) => toDateMs(b.data().createdAt) - toDateMs(a.data().createdAt))
      .slice(0, 5);

    if (uniqueDocs.length === 0) {
      return noStoreJson({ ok: true, results: [] });
    }

    const results = uniqueDocs.map((doc) => {
      const d = doc.data();
      return {
        receiptId: d.receiptId as string,
        requestTypeLabel: d.requestTypeLabel as string,
        studentName: d.studentName as string,
        school: d.school as string,
        grade: d.grade as string,
        gender: d.gender as string,
        status: d.status as string,
        createdAt: d.createdAt as string,
      };
    });

    return noStoreJson({ ok: true, results });
  } catch (error) {
    console.error("[consult/check][GET] failed", error);
    return noStoreJson(
      { ok: false, message: "조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
