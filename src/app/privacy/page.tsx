import Link from 'next/link';

import { MarketingTrackingOptOutButton } from '@/components/marketing/marketing-tracking-opt-out-button';
import {
  CONSULT_DATA_FIELDS,
  CONSULT_RETENTION_LABEL,
  LEGAL_EFFECTIVE_DATE_LABEL,
  MARKETING_ANALYTICS_FIELDS,
  MARKETING_ANALYTICS_RETENTION_LABEL,
  MEMBER_RETENTION_LABEL,
  PRIVACY_ROUTE,
  SIGNUP_DATA_FIELDS,
  TERMS_ROUTE,
} from '@/lib/legal-documents';

function PrivacyCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-[#14295F]/10 bg-white/90 p-6 shadow-[0_24px_60px_-30px_rgba(20,41,95,0.35)] sm:p-8">
      <h2 className="text-xl font-black tracking-tight text-[#14295F]">{title}</h2>
      <div className="mt-4 space-y-3 text-sm font-semibold leading-7 text-[#14295F]/72">
        {children}
      </div>
    </section>
  );
}

function PrivacyList({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="rounded-2xl border border-[#14295F]/8 bg-[#f7f9ff] px-4 py-3 text-sm font-semibold text-[#14295F]/72">
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ffd9c2_0%,#f8fbff_44%,#eef4ff_100%)] px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <section className="overflow-hidden rounded-[2.4rem] bg-[#14295F] px-6 py-8 text-white shadow-[0_36px_80px_-32px_rgba(20,41,95,0.7)] sm:px-8 sm:py-10">
          <p className="text-xs font-black tracking-[0.28em] text-[#FFB273]">PRIVACY POLICY</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">개인정보처리방침</h1>
          <p className="mt-3 max-w-3xl break-keep text-sm font-semibold leading-7 text-white/78">
            트랙 학습센터는 회원가입, 상담문의, 입학대기, 웹사이트 방문 분석에 필요한 범위에서만 개인정보를 수집하고
            목적이 끝나면 지체 없이 파기합니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-black text-white/72">
            <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5">
              시행일 {LEGAL_EFFECTIVE_DATE_LABEL}
            </span>
            <Link
              href={TERMS_ROUTE}
              className="rounded-full border border-[#FF7A16]/35 bg-[#FF7A16]/12 px-3 py-1.5 text-[#FFD0A5] transition hover:bg-[#FF7A16]/18"
            >
              이용약관 보기
            </Link>
          </div>
        </section>

        <PrivacyCard title="1. 수집 항목과 목적">
          <p className="font-black text-[#14295F]">회원가입</p>
          <PrivacyList items={SIGNUP_DATA_FIELDS} />
          <p>목적: 역할별 계정 생성, 센터 가입 처리, 학생·학부모 연동, 로그인 및 대시보드 제공</p>

          <p className="pt-2 font-black text-[#14295F]">상담문의 및 입학대기</p>
          <PrivacyList items={CONSULT_DATA_FIELDS} />
          <p>목적: 상담 연락, 입학 안내, 입학대기 관리, 접수 이력 조회</p>

          <p className="pt-2 font-black text-[#14295F]">웹사이트 방문 분석</p>
          <PrivacyList items={MARKETING_ANALYTICS_FIELDS} />
          <p>목적: 홍보 페이지 유입 경로, 전환 흐름, 상담 전환 성과의 내부 분석</p>
        </PrivacyCard>

        <PrivacyCard title="2. 보유 및 이용 기간">
          <p>회원 정보: {MEMBER_RETENTION_LABEL}</p>
          <p>상담문의 및 입학대기 정보: 접수일로부터 {CONSULT_RETENTION_LABEL}</p>
          <p>웹사이트 방문 분석 식별값 및 이벤트: 수집일로부터 {MARKETING_ANALYTICS_RETENTION_LABEL}</p>
          <p>관계 법령에 따라 별도 보관이 필요한 경우에는 해당 법정 보관기간 동안 분리 보관합니다.</p>
        </PrivacyCard>

        <PrivacyCard title="3. 선택 동의와 거부 권리">
          <p>
            회원가입 시 이용약관, 개인정보 수집·이용, 만 14세 이상 확인은 필수이며, 광고성 정보 수신 동의는
            선택사항입니다.
          </p>
          <p>
            상담문의 시 개인정보 수집·이용 동의는 필수이며, 혜택·이벤트·신규 프로그램 안내를 위한 문자/전화 수신
            동의는 선택사항입니다.
          </p>
          <p>선택 동의를 거부해도 회원가입과 상담문의 접수는 이용할 수 있습니다.</p>
          <p>다만 필수 동의를 거부하는 경우 회원가입 또는 상담문의 접수가 제한됩니다.</p>
        </PrivacyCard>

        <PrivacyCard title="4. 처리 위탁 및 외부 서비스">
          <p>회원가입, 로그인, 데이터 저장과 서버 처리에는 Google Firebase Auth, Firestore, Cloud Functions가 사용됩니다.</p>
          <p>웹사이트와 앱은 Next.js 기반으로 제공되며, 운영상 필요한 로그와 보안 헤더가 적용됩니다.</p>
          <p>결제 페이지 이용 시 Toss Payments가 사용될 수 있으며, 문자 발송은 센터 설정에 따라 별도 발송 서비스가 사용될 수 있습니다.</p>
          <p>광고성 정보 수신 동의는 운영 알림과 분리되며, 홍보·이벤트 안내에만 사용합니다.</p>
        </PrivacyCard>

        <PrivacyCard title="5. 파기 및 정보주체 권리">
          <p>보유기간이 끝나거나 처리 목적이 달성된 정보는 복구가 어렵도록 지체 없이 파기합니다.</p>
          <p>이용자는 본인 정보에 대해 열람, 정정, 삭제, 처리정지, 동의 철회를 요청할 수 있습니다.</p>
          <p>계정 탈퇴, 상담 철회, 정보 수정 요청은 센터 관리자 또는 웹사이트 상담문의로 접수할 수 있습니다.</p>
        </PrivacyCard>

        <PrivacyCard title="6. 웹 방문 분석 수집 거부">
          <p>
            본 웹사이트는 first-party 식별값을 이용한 내부 분석을 수행합니다. 쿠키 배너 대신 정책 고지와 거부 기능을
            제공합니다.
          </p>
          <p>
            아래 버튼을 누르면 <span className="font-black">track_marketing_vid</span>,
            <span className="font-black"> track_marketing_sid</span> 생성과 웹 분석 이벤트 전송이 중지됩니다.
          </p>
          <MarketingTrackingOptOutButton />
        </PrivacyCard>

        <section className="rounded-[2rem] border border-[#14295F]/10 bg-white/85 p-6 sm:p-8">
          <div className="flex flex-wrap gap-3 text-sm font-black">
            <Link href="/" className="rounded-full bg-[#FF7A16] px-4 py-2.5 text-white transition hover:-translate-y-0.5">
              홈으로 돌아가기
            </Link>
            <Link
              href={PRIVACY_ROUTE}
              className="rounded-full border border-[#14295F]/12 px-4 py-2.5 text-[#14295F] transition hover:border-[#FF7A16]/45 hover:text-[#FF7A16]"
            >
              현재 처리방침 경로 확인
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
