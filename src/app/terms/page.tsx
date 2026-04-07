import Link from 'next/link';

import { MarketingTrackingOptOutButton } from '@/components/marketing/marketing-tracking-opt-out-button';
import {
  CONSULT_RETENTION_LABEL,
  LEGAL_EFFECTIVE_DATE_LABEL,
  MEMBER_RETENTION_LABEL,
  PRIVACY_ROUTE,
  TERMS_ROUTE,
} from '@/lib/legal-documents';

function TermsSection({
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

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ffd7bb_0%,#f7f9ff_42%,#eef3ff_100%)] px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto grid w-full max-w-4xl gap-6">
        <section className="overflow-hidden rounded-[2.4rem] bg-[#14295F] px-6 py-8 text-white shadow-[0_36px_80px_-32px_rgba(20,41,95,0.7)] sm:px-8 sm:py-10">
          <p className="text-xs font-black tracking-[0.28em] text-[#FFB273]">TERMS OF SERVICE</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">이용약관</h1>
          <p className="mt-3 max-w-2xl break-keep text-sm font-semibold leading-7 text-white/78">
            트랙 학습센터 웹사이트, 회원가입, 상담문의, 입학대기 접수와 관련된 기본 이용 조건을 안내합니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-black text-white/72">
            <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5">
              시행일 {LEGAL_EFFECTIVE_DATE_LABEL}
            </span>
            <Link
              href={PRIVACY_ROUTE}
              className="rounded-full border border-[#FF7A16]/35 bg-[#FF7A16]/12 px-3 py-1.5 text-[#FFD0A5] transition hover:bg-[#FF7A16]/18"
            >
              개인정보처리방침 보기
            </Link>
          </div>
        </section>

        <TermsSection title="1. 목적 및 적용 범위">
          <p>
            본 약관은 트랙 학습센터가 제공하는 웹사이트, 회원가입, 상담문의, 입학대기 접수, 로그인 및 대시보드
            이용과 관련하여 회사와 이용자 사이의 권리, 의무 및 책임사항을 정하는 것을 목적으로 합니다.
          </p>
          <p>
            회원가입 시에는 역할별 대시보드 이용을 위한 계정이 생성되며, 상담문의 시에는 상담 안내와 입학대기
            운영을 위한 정보가 접수됩니다.
          </p>
        </TermsSection>

        <TermsSection title="2. 회원가입 및 이용 제한">
          <p>회원가입은 본인 명의의 이메일과 정확한 정보로 진행해야 하며, 허위 정보 입력 시 이용이 제한될 수 있습니다.</p>
          <p>만 14세 미만은 별도 법정대리인 동의 절차를 제공하지 않으므로 현재 회원가입할 수 없습니다.</p>
          <p>
            학생, 선생님, 센터관리자는 센터 초대 코드가 필요하며, 학부모는 학생 코드와 본인 연락처 확인을 통해
            가입할 수 있습니다.
          </p>
        </TermsSection>

        <TermsSection title="3. 상담문의 및 입학대기">
          <p>
            웹사이트 상담문의는 상담 안내와 입학대기 운영을 위해 접수되며, 관리형 스터디센터 문의는 운영상 입학
            대기 인원에 먼저 반영될 수 있습니다.
          </p>
          <p>
            상담 및 입학대기 정보는 접수일로부터 {CONSULT_RETENTION_LABEL} 동안 보관한 뒤 파기하거나 법령상 추가
            보관이 필요한 경우 해당 기간 동안 별도로 보관합니다.
          </p>
        </TermsSection>

        <TermsSection title="4. 개인정보와 운영 알림">
          <p>
            개인정보 수집 및 이용에 관한 자세한 내용은 <Link href={PRIVACY_ROUTE} className="font-black text-[#FF7A16] underline underline-offset-4">개인정보처리방침</Link>에
            따릅니다.
          </p>
          <p>
            출결, 상담, 결제, 운영 안내처럼 서비스 제공에 필요한 연락은 광고성 정보 수신 동의 여부와 별도로
            발송될 수 있습니다.
          </p>
          <p>
            광고성 정보 수신 동의는 선택사항이며, 동의하지 않아도 회원가입과 상담문의 이용에는 제한이 없습니다.
          </p>
        </TermsSection>

        <TermsSection title="5. 계정 관리 및 책임">
          <p>이용자는 비밀번호와 계정 접근 권한을 안전하게 관리해야 하며, 타인에게 계정을 양도하거나 공유할 수 없습니다.</p>
          <p>이용자는 관련 법령, 본 약관, 서비스 안내에 따라 서비스를 이용해야 하며, 운영을 방해하는 행위를 해서는 안 됩니다.</p>
          <p>
            회원정보는 {MEMBER_RETENTION_LABEL} 동안 보관되며, 센터 운영 기록이나 법령상 보관 의무가 있는 정보는
            분리 보관될 수 있습니다.
          </p>
        </TermsSection>

        <TermsSection title="6. 문의 및 고지">
          <p>약관과 서비스 이용에 대한 문의는 웹사이트 상담문의 또는 센터 연락처를 통해 접수할 수 있습니다.</p>
          <p>본 약관이 변경되는 경우 웹사이트 또는 앱 내 공지, 정책 페이지 갱신 등의 방법으로 안내합니다.</p>
        </TermsSection>

        <section className="rounded-[2rem] border border-[#14295F]/10 bg-white/85 p-6 sm:p-8">
          <h2 className="text-lg font-black text-[#14295F]">방문 분석 수집 거부</h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-[#14295F]/70">
            웹사이트 방문 분석 식별 생성과 이벤트 전송은 아래 버튼에서 중지하거나 다시 허용할 수 있습니다.
          </p>
          <div className="mt-4">
            <MarketingTrackingOptOutButton />
          </div>
          <div className="mt-5 flex flex-wrap gap-3 text-sm font-black">
            <Link href="/" className="rounded-full bg-[#FF7A16] px-4 py-2.5 text-white transition hover:-translate-y-0.5">
              홈으로 돌아가기
            </Link>
            <Link
              href={TERMS_ROUTE}
              className="rounded-full border border-[#14295F]/12 px-4 py-2.5 text-[#14295F] transition hover:border-[#FF7A16]/45 hover:text-[#FF7A16]"
            >
              현재 약관 경로 확인
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
