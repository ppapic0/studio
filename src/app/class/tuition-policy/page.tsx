import Link from 'next/link';

import {
  CLASS_TUITION_NOTICE,
  CLASS_TUITION_POLICY_EFFECTIVE_DATE_LABEL,
  CLASS_TUITION_POLICY_ROUTE,
  PRIVACY_ROUTE,
  TERMS_ROUTE,
} from '@/lib/legal-documents';

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-[#14295F]/10 bg-white/90 p-6 shadow-[0_24px_60px_-30px_rgba(20,41,95,0.35)] sm:p-8">
      <h2 className="text-xl font-black tracking-tight text-[#14295F]">{title}</h2>
      <div className="mt-4 space-y-4 text-sm font-semibold leading-7 text-[#14295F]/72">
        {children}
      </div>
    </section>
  );
}

export default function ClassTuitionPolicyPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ffd9c2_0%,#f8fbff_44%,#eef4ff_100%)] px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <section className="overflow-hidden rounded-[2.4rem] bg-[#14295F] px-6 py-8 text-white shadow-[0_36px_80px_-32px_rgba(20,41,95,0.7)] sm:px-8 sm:py-10">
          <p className="text-xs font-black tracking-[0.28em] text-[#FFB273]">TUITION & REFUND POLICY</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">교습비 및 환불 안내</h1>
          <p className="mt-3 max-w-3xl break-keep text-sm font-semibold leading-7 text-white/78">
            트랙 국어학원의 교습비와 환불 기준을 등록 준비 중 안내 형태로 먼저 공개합니다.
            현재 등록번호는 등록 완료 후 반영 예정이며, 환불은 학교교과교습학원 기준에 따라 적용됩니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-black text-white/72">
            <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5">
              시행일 {CLASS_TUITION_POLICY_EFFECTIVE_DATE_LABEL}
            </span>
            <span className="rounded-full border border-[#FF7A16]/35 bg-[#FF7A16]/12 px-3 py-1.5 text-[#FFD0A5]">
              {CLASS_TUITION_NOTICE.registrationStatusDescription}
            </span>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: '학원명', value: CLASS_TUITION_NOTICE.academyName },
            { label: '교습과목', value: CLASS_TUITION_NOTICE.subject },
            { label: '문의처', value: CLASS_TUITION_NOTICE.contact },
            { label: '등록번호', value: CLASS_TUITION_NOTICE.registrationNumber },
          ].map((card) => (
            <article
              key={card.label}
              className="rounded-[1.8rem] border border-[#14295F]/10 bg-white/90 p-5 shadow-[0_20px_50px_-30px_rgba(20,41,95,0.35)]"
            >
              <p className="text-[11px] font-black tracking-[0.18em] text-[#FF7A16]">{card.label}</p>
              <p className="mt-3 break-keep text-lg font-black leading-snug text-[#14295F]">{card.value}</p>
            </article>
          ))}
        </section>

        <PolicySection title="1. 교습비 기준">
          <div className="grid gap-4 sm:grid-cols-2">
            {CLASS_TUITION_NOTICE.tuitionRows.map((row) => (
              <article
                key={row.target}
                className="rounded-[1.6rem] border border-[#14295F]/10 bg-[#f7f9ff] p-5"
              >
                <p className="text-[11px] font-black tracking-[0.18em] text-[#FF7A16]">{row.target}</p>
                <p className="mt-3 text-2xl font-black tracking-[-0.03em] text-[#14295F]">{row.amount}</p>
                <p className="mt-2 break-keep text-sm font-semibold leading-6 text-[#14295F]/66">{row.detail}</p>
              </article>
            ))}
          </div>
          <div className="grid gap-3 pt-1 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#14295F]/8 bg-[#f7f9ff] px-4 py-3">
              <p className="font-black text-[#14295F]">수강 단위</p>
              <p className="mt-1 break-keep">{CLASS_TUITION_NOTICE.sessionSummary}</p>
            </div>
            <div className="rounded-2xl border border-[#14295F]/8 bg-[#f7f9ff] px-4 py-3">
              <p className="font-black text-[#14295F]">별도 비용</p>
              <p className="mt-1 break-keep">{CLASS_TUITION_NOTICE.extraFees}</p>
            </div>
          </div>
        </PolicySection>

        <PolicySection title="2. 환불 기준">
          <p>
            환불은 학교교과교습학원 교습비 반환기준에 따라 적용합니다. 현재 안내 중인 교습비는 월 4회 기준이며,
            아래 기준에 따라 환불합니다.
          </p>
          <div className="grid gap-3">
            {CLASS_TUITION_NOTICE.refundRules.map((rule) => (
              <div
                key={rule.stage}
                className="rounded-2xl border border-[#14295F]/8 bg-[#f7f9ff] px-4 py-3"
              >
                <p className="font-black text-[#14295F]">{rule.stage}</p>
                <p className="mt-1 break-keep text-sm font-semibold leading-6 text-[#14295F]/68">
                  {rule.refund}
                </p>
              </div>
            ))}
          </div>
          <p className="rounded-2xl border border-[#FF7A16]/18 bg-[#fff7f1] px-4 py-3 text-[#8b4a14]">
            {CLASS_TUITION_NOTICE.refundBasis}
          </p>
        </PolicySection>

        <PolicySection title="3. 추가 안내">
          <p>
            본 페이지는 등록 준비 중 안내를 위한 공개 문서이며, 현재 등록번호는 등록 완료 후 즉시 업데이트할 예정입니다.
          </p>
          <p>
            학원명은 <span className="font-black text-[#14295F]">{CLASS_TUITION_NOTICE.academyName}</span>,
            교습과목은 <span className="font-black text-[#14295F]">{CLASS_TUITION_NOTICE.subject}</span> 기준으로 안내합니다.
          </p>
          <p>문의: {CLASS_TUITION_NOTICE.contact}</p>
        </PolicySection>

        <section className="rounded-[2rem] border border-[#14295F]/10 bg-white/85 p-6 sm:p-8">
          <div className="flex flex-wrap gap-3 text-sm font-black">
            <Link
              href="/class"
              className="rounded-full bg-[#FF7A16] px-4 py-2.5 text-white transition hover:-translate-y-0.5"
            >
              수업 페이지로 돌아가기
            </Link>
            <Link
              href="/"
              className="rounded-full border border-[#14295F]/12 px-4 py-2.5 text-[#14295F] transition hover:border-[#FF7A16]/45 hover:text-[#FF7A16]"
            >
              홈으로 돌아가기
            </Link>
            <Link
              href={TERMS_ROUTE}
              className="rounded-full border border-[#14295F]/12 px-4 py-2.5 text-[#14295F] transition hover:border-[#FF7A16]/45 hover:text-[#FF7A16]"
            >
              이용약관
            </Link>
            <Link
              href={PRIVACY_ROUTE}
              className="rounded-full border border-[#14295F]/12 px-4 py-2.5 text-[#14295F] transition hover:border-[#FF7A16]/45 hover:text-[#FF7A16]"
            >
              개인정보처리방침
            </Link>
            <Link
              href={CLASS_TUITION_POLICY_ROUTE}
              className="rounded-full border border-[#14295F]/12 px-4 py-2.5 text-[#14295F] transition hover:border-[#FF7A16]/45 hover:text-[#FF7A16]"
            >
              현재 정책 경로 확인
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
