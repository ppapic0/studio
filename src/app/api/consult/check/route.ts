import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone")?.trim();
  const name = searchParams.get("name")?.trim();
  const normalizedPhone = normalizePhone(phone || "");

  if (!normalizedPhone || normalizedPhone.length < 8) {
    return NextResponse.json({ ok: false, message: "연락처를 입력해주세요." }, { status: 400 });
  }

  try {
    const runQuery = async (phoneValue: string) => {
      let query = adminDb
        .collection("marketingConsultRequests")
        .where("consultPhone", "==", phoneValue)
        .orderBy("createdAt", "desc")
        .limit(5);

      if (name) {
        query = adminDb
          .collection("marketingConsultRequests")
          .where("consultPhone", "==", phoneValue)
          .where("studentName", "==", name)
          .orderBy("createdAt", "desc")
          .limit(5);
      }

      return query.get();
    };

    const snapshots = await Promise.all(
      Array.from(new Set([phone, normalizedPhone].filter((value): value is string => !!value))).map(runQuery),
    );

    const docs = snapshots.flatMap((snapshot) => snapshot.docs);
    const uniqueDocs = Array.from(new Map(docs.map((doc) => [doc.id, doc])).values()).slice(0, 5);

    if (uniqueDocs.length === 0) {
      return NextResponse.json({ ok: true, results: [] });
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

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error("[consult/check][GET] failed", error);
    return NextResponse.json(
      { ok: false, message: "조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }
}
