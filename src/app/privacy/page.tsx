import Link from 'next/link';

import { MarketingTrackingOptOutButton } from '@/components/marketing/marketing-tracking-opt-out-button';
import {
  CONSULT_DATA_FIELDS,
  CONSULT_RETENTION_LABEL,
  LEGAL_OPERATOR_LABEL,
  LEGAL_REPRESENTATIVE_NAME,
  MARKETING_ANALYTICS_FIELDS,
  MARKETING_ANALYTICS_RETENTION_LABEL,
  MEMBER_RETENTION_LABEL,
  PRIVACY_EFFECTIVE_DATE_LABEL,
  PRIVACY_ROUTE,
  SIGNUP_DATA_FIELDS,
  TERMS_ROUTE,
} from '@/lib/legal-documents';
import { marketingContent } from '@/lib/marketing-content';

const summaryCards = [
  {
    label: '운영주체',
    value: LEGAL_OPERATOR_LABEL,
    detail: '학원 웹사이트와 역할별 학습관리 서비스를 운영합니다.',
  },
  {
    label: '처리 범위',
    value: '회원가입 · 대시보드 · 상담 · 결제 · 리포트',
    detail: '서비스 제공에 필요한 범위 안에서만 개인정보를 처리합니다.',
  },
  {
    label: '보유기간',
    value: `회원 ${MEMBER_RETENTION_LABEL}`,
    detail: `상담/입학대기 ${CONSULT_RETENTION_LABEL}, 방문분석 ${MARKETING_ANALYTICS_RETENTION_LABEL}`,
  },
  {
    label: '제3자 제공',
    value: '원칙적 미제공',
    detail: '법령 근거 또는 정보주체 동의가 있는 경우에만 제공합니다.',
  },
] as const;

const processingActivities = [
  {
    title: '회원가입 및 계정 생성',
    purpose: '역할별 계정 생성, 센터 소속 확인, 로그인 및 서비스 초기 제공',
    items: SIGNUP_DATA_FIELDS.join(', '),
    retention: MEMBER_RETENTION_LABEL,
  },
  {
    title: '로그인·인증 및 보안',
    purpose: '본인 식별, 로그인 유지, 비정상 접근 탐지, 보안 대응',
    items: '이메일, 비밀번호, 인증 식별값, 로그인 이력, 보안 로그',
    retention: '회원 탈퇴 시까지 및 보안 대응·법정 보존 기간',
  },
  {
    title: '학생·학부모 연동 및 센터 소속',
    purpose: '학생-학부모 연결, 센터 초대 확인, 역할별 접근권한 부여',
    items: '학생/학부모 연동 코드, 센터 초대 코드, 역할, 소속 상태, 연락처',
    retention: MEMBER_RETENTION_LABEL,
  },
  {
    title: '상담문의 및 입학대기',
    purpose: '상담 연락, 입학 안내, 입학대기 관리, 접수 이력 조회',
    items: CONSULT_DATA_FIELDS.join(', '),
    retention: CONSULT_RETENTION_LABEL,
  },
  {
    title: '출결·학습기록·리포트',
    purpose: '출결 관리, 학습시간 산정, 루틴·플랜 제공, 데일리/주간 리포트 제공',
    items: '출결 상태, 학습시간, 루틴/플랜 진행 정보, 교사 메모, 리포트 데이터, AI 생성 요약',
    retention: '회원 탈퇴 시까지 및 분쟁·운영 기록 보존 기간',
  },
  {
    title: '상담 및 민원 처리',
    purpose: '상담 예약, 상담 로그, 문의·민원 접수, 처리결과 통지',
    items: '상담 일정, 상담 기록, 문의 내용, 답변 내역, 지원 대화 기록',
    retention: '상담 또는 민원 종료 후 3년 또는 관계 법령 보존 기간',
  },
  {
    title: '결제·청구·수납',
    purpose: '청구서 발행, 결제 확인, 환불·정산, 미납 관리',
    items: '청구서 정보, 결제 결과, 거래 식별값, 수납 상태, 환불 처리 정보',
    retention: '계약·대금결제·재화공급 기록 5년, 분쟁처리 3년',
  },
  {
    title: '문자·카카오 운영 알림',
    purpose: '출결, 리포트, 결제, 상담, 운영 공지 알림 발송',
    items: '학생/학부모 연락처, 발송 대상 정보, 템플릿, 발송 결과, 실패 사유',
    retention: '회원 탈퇴 시까지 및 분쟁·민원 대응 범위',
  },
  {
    title: '마케팅 분석',
    purpose: '홍보 페이지 유입 경로, 상담 전환, 로그인 전환 흐름 분석',
    items: MARKETING_ANALYTICS_FIELDS.join(', '),
    retention: MARKETING_ANALYTICS_RETENTION_LABEL,
  },
  {
    title: '포인트·보상·쿠폰 처리',
    purpose: '포인트 적립/차감, 보상 상자, 외부 쿠폰 발송 및 상태 확인',
    items: '포인트 잔액, 보상 이력, 주문 상태, 수령자 휴대폰번호, 공급사 발송 결과',
    retention: '회원 탈퇴 시까지, 거래·정산 성격 기록은 최대 5년',
  },
] as const;

const legalRetentionRows = [
  '표시·광고에 관한 기록: 6개월',
  '계약 또는 청약철회, 대금결제, 재화 등의 공급기록: 5년',
  '소비자 불만 또는 분쟁처리에 관한 기록: 3년',
  '통신사실확인자료: 3개월',
  '학원의 설립·운영 및 과외교습에 관한 법률상 수입·지출 장부 및 교습비 영수증: 5년',
  '학원의 설립·운영 및 과외교습에 관한 법률상 수강생 대장: 3년',
] as const;

const entrustedServices = [
  {
    name: 'Google Firebase / Cloud Functions',
    work: '회원가입, 인증, 데이터 저장, 서버 처리, 호스팅 및 운영 인프라',
    note: '글로벌 클라우드 인프라 기반으로 운영될 수 있습니다.',
  },
  {
    name: 'Google AI (Genkit)',
    work: '학습 데이터 기반 데일리 리포트, 주간 요약, 추천 문구 생성',
    note: 'AI 결과물은 보조적 참고자료이며 품질 검증 범위 내에서만 활용됩니다.',
  },
  {
    name: 'Toss Payments',
    work: '청구서 결제, 결제결과 확인, 환불 및 정산 처리',
    note: '결제수단 세부정보는 결제대행사가 직접 처리할 수 있습니다.',
  },
  {
    name: '센터가 설정한 문자·카카오 발송 대행사',
    work: '출결, 리포트, 결제, 상담 등 운영 알림 발송',
    note: '센터별 설정에 따라 실제 발송 공급사는 달라질 수 있습니다.',
  },
  {
    name: 'Giftishow',
    work: '보상 쿠폰 발송, 상태 조회, 재전송·취소 처리',
    note: '수령자 휴대전화와 주문/발송 결과가 처리될 수 있습니다.',
  },
] as const;

const rightsItems = [
  '개인정보 열람, 정정, 삭제, 처리정지, 동의 철회 요구',
  '본인 또는 적법한 대리인을 통한 권리행사 요청',
  '법령상 보존 의무가 있는 정보에 대한 제한 가능성 확인',
  '허위 또는 타인 정보 등록 시 권리행사 제한 및 본인 확인 요구',
] as const;

const safetyMeasures = [
  '관리적 조치: 최소 권한 부여, 내부 접근권한 통제, 정기 점검, 운영자 교육',
  '기술적 조치: 인증 기반 접근 통제, 비밀값 분리, 암호화, 요청 제한, 로그 모니터링',
  '물리적 조치: 클라우드 운영환경 및 관리계정 접근 통제',
] as const;

const reliefOrganizations = [
  {
    name: '개인정보분쟁조정위원회',
    phone: '1833-6972',
    href: 'https://www.kopico.go.kr',
  },
  {
    name: '개인정보침해신고센터',
    phone: '118',
    href: 'https://privacy.kisa.or.kr',
  },
  {
    name: '대검찰청',
    phone: '1301',
    href: 'https://www.spo.go.kr',
  },
  {
    name: '경찰청',
    phone: '182',
    href: 'https://ecrm.cyber.go.kr',
  },
] as const;

function PrivacySection({
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

function ItemList({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-2xl border border-[#14295F]/8 bg-[#f7f9ff] px-4 py-3 text-sm font-semibold leading-6 text-[#14295F]/72"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ffd9c2_0%,#f8fbff_44%,#eef4ff_100%)] px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <section className="overflow-hidden rounded-[2.4rem] bg-[#14295F] px-6 py-8 text-white shadow-[0_36px_80px_-32px_rgba(20,41,95,0.7)] sm:px-8 sm:py-10">
          <p className="text-xs font-black tracking-[0.28em] text-[#FFB273]">PRIVACY POLICY</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">개인정보처리방침</h1>
          <p className="mt-3 max-w-4xl break-keep text-sm font-semibold leading-7 text-white/78">
            {LEGAL_OPERATOR_LABEL}는 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 적법하고 안전하게 처리하며,
            웹사이트, 학습 대시보드, 상담, 결제, 리포트, 운영 알림 서비스에서 처리되는 개인정보의 기준을 다음과 같이
            공개합니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-black text-white/72">
            <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5">
              시행일 {PRIVACY_EFFECTIVE_DATE_LABEL}
            </span>
            <Link
              href={TERMS_ROUTE}
              className="rounded-full border border-[#FF7A16]/35 bg-[#FF7A16]/12 px-3 py-1.5 text-[#FFD0A5] transition hover:bg-[#FF7A16]/18"
            >
              이용약관 보기
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <article
              key={card.label}
              className="rounded-[1.8rem] border border-[#14295F]/10 bg-white/90 p-5 shadow-[0_20px_50px_-30px_rgba(20,41,95,0.35)]"
            >
              <p className="text-[11px] font-black tracking-[0.18em] text-[#FF7A16]">{card.label}</p>
              <p className="mt-3 break-keep text-lg font-black leading-snug text-[#14295F]">{card.value}</p>
              <p className="mt-2 break-keep text-sm font-semibold leading-6 text-[#14295F]/62">{card.detail}</p>
            </article>
          ))}
        </section>

        <PrivacySection title="1. 개인정보의 처리 목적 및 항목">
          <p>
            회사는 서비스 제공, 회원관리, 상담·민원 처리, 결제·정산, 운영 알림, 리포트 생성, 보상 제공, 방문 분석을
            위하여 아래 범위의 개인정보를 처리합니다. 처리 목적이 변경되는 경우 법령에 따라 필요한 절차를 거칩니다.
          </p>
          <div className="grid gap-3">
            {processingActivities.map((activity) => (
              <article
                key={activity.title}
                className="rounded-[1.4rem] border border-[#14295F]/8 bg-[#f7f9ff] px-4 py-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[#14295F]">{activity.title}</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-[#5E7097]">{activity.purpose}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-[#17326B] shadow-sm">
                    {activity.retention}
                  </span>
                </div>
                <div className="mt-3 rounded-[1rem] bg-white px-3.5 py-3 text-xs font-semibold leading-6 text-[#14295F]/72">
                  {activity.items}
                </div>
              </article>
            ))}
          </div>
        </PrivacySection>

        <PrivacySection title="2. 개인정보의 처리 및 보유기간">
          <p>
            회사는 법령에 따른 보유기간 또는 정보주체의 동의 범위 내에서 개인정보를 처리·보유합니다. 회원 정보는
            {` ${MEMBER_RETENTION_LABEL}`}, 상담문의 및 입학대기 정보는 접수일로부터 {CONSULT_RETENTION_LABEL},
            방문 분석 정보는 수집일로부터 {MARKETING_ANALYTICS_RETENTION_LABEL} 동안 보관합니다.
          </p>
          <p className="font-black text-[#14295F]">관계 법령에 따른 별도 보존기간</p>
          <ItemList items={legalRetentionRows} />
        </PrivacySection>

        <PrivacySection title="3. 개인정보의 제3자 제공">
          <p>
            회사는 정보주체의 개인정보를 본 방침에서 고지한 범위 내에서만 처리하며, 원칙적으로 개인정보를 제3자에게
            제공하지 않습니다.
          </p>
          <p>
            다만 법령에 특별한 규정이 있는 경우, 수사기관 등 적법한 요청이 있는 경우, 정보주체의 별도 동의가 있는 경우에
            한하여 「개인정보 보호법」 제17조 및 제18조에 따라 제공할 수 있습니다.
          </p>
        </PrivacySection>

        <PrivacySection title="4. 개인정보 처리업무의 위탁 및 외부 연동">
          <p>
            회사는 원활한 서비스 제공을 위하여 아래와 같이 개인정보 처리업무의 일부를 외부 서비스 또는 연동사에 맡기거나
            연계할 수 있습니다.
          </p>
          <div className="grid gap-3">
            {entrustedServices.map((service) => (
              <div
                key={service.name}
                className="rounded-[1.4rem] border border-[#14295F]/8 bg-[#f7f9ff] px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-sm font-black text-[#14295F]">{service.name}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-[#17326B] shadow-sm">
                    외부 연동
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#14295F]/72">{service.work}</p>
                <p className="mt-1 text-xs font-bold leading-5 text-[#5E7097]">{service.note}</p>
              </div>
            ))}
          </div>
          <p>
            위탁계약 또는 연동 운영 시 회사는 위탁 목적 외 처리금지, 접근통제, 안전성 확보조치, 재위탁 관리, 손해배상 등
            법령상 필요한 사항을 관리·감독합니다.
          </p>
        </PrivacySection>

        <PrivacySection title="5. 정보주체의 권리·의무 및 행사방법">
          <p>
            정보주체는 회사에 대해 언제든지 개인정보 열람, 정정, 삭제, 처리정지, 동의 철회 등의 권리를 행사할 수
            있습니다. 현재 서비스는 만 14세 이상만 가입 가능하며, 만 14세 이상의 미성년자도 본인 개인정보에 대해 직접
            권리를 행사할 수 있습니다.
          </p>
          <ItemList items={rightsItems} />
          <p>
            권리행사는 웹사이트 상담문의, 센터 연락처, 센터 방문을 통해 접수할 수 있으며, 회사는 본인 또는 정당한
            대리인 여부를 확인한 후 지체 없이 처리합니다.
          </p>
        </PrivacySection>

        <PrivacySection title="6. 개인정보의 파기절차 및 파기방법">
          <p>
            개인정보 보유기간의 경과, 처리 목적 달성, 회원 탈퇴, 서비스 종료 등으로 개인정보가 불필요하게 되었을 때에는
            지체 없이 파기합니다.
          </p>
          <p>
            다른 법령에 따라 보존이 필요한 경우에는 별도의 데이터베이스나 보관 공간으로 분리하여 저장하고, 해당 보존기간이
            종료된 후 즉시 파기합니다.
          </p>
          <p>전자적 파일은 복구 또는 재생이 불가능한 기술적 방법으로 삭제하며, 종이 문서는 분쇄 또는 소각합니다.</p>
        </PrivacySection>

        <PrivacySection title="7. 개인정보의 안전성 확보조치">
          <ItemList items={safetyMeasures} />
        </PrivacySection>

        <PrivacySection title="8. 자동 수집 장치의 설치·운영 및 거부">
          <p>
            회사는 웹사이트 방문 흐름과 상담 전환 성과를 분석하기 위해 first-party 식별값과 이벤트 로그를 사용할 수
            있습니다.
          </p>
          <div className="rounded-[1.4rem] border border-[#14295F]/8 bg-[#f7f9ff] px-4 py-4">
            <p className="text-sm font-black text-[#14295F]">자동 수집 항목</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#14295F]/72">
              {MARKETING_ANALYTICS_FIELDS.join(', ')}
            </p>
          </div>
          <p>
            정보주체는 아래 버튼을 통해 방문 분석 식별값 생성 및 이벤트 전송을 거부할 수 있으며, 브라우저 설정에서
            쿠키 또는 사이트 데이터 저장을 차단하거나 삭제할 수도 있습니다.
          </p>
          <MarketingTrackingOptOutButton />
        </PrivacySection>

        <PrivacySection title="9. 개인정보 보호 관련 문의처">
          <p>운영주체: {LEGAL_OPERATOR_LABEL}</p>
          <p>개인정보 보호 관련 접수 책임자: 대표 {LEGAL_REPRESENTATIVE_NAME}</p>
          <p>문의채널: {marketingContent.footer.phone}</p>
          <p>접수방법: 웹사이트 상담문의 또는 센터 방문상담</p>
          <p>주소: {marketingContent.footer.location}</p>
        </PrivacySection>

        <PrivacySection title="10. 권익침해 구제방법">
          <p>
            개인정보침해로 인한 구제가 필요하신 경우 아래 기관에 분쟁해결, 상담 또는 신고를 신청할 수 있습니다.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {reliefOrganizations.map((item) => (
              <a
                key={item.name}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-[1.4rem] border border-[#14295F]/8 bg-[#f7f9ff] px-4 py-4 transition hover:border-[#FF7A16]/35 hover:bg-white"
              >
                <p className="text-sm font-black text-[#14295F]">{item.name}</p>
                <p className="mt-1 text-xs font-bold text-[#5E7097]">{item.phone}</p>
                <p className="mt-2 text-xs font-semibold text-[#FF7A16] underline underline-offset-4">{item.href}</p>
              </a>
            ))}
          </div>
        </PrivacySection>

        <PrivacySection title="11. 개인정보처리방침의 변경">
          <p>이 개인정보처리방침은 {PRIVACY_EFFECTIVE_DATE_LABEL}부터 적용됩니다.</p>
          <p>
            법령, 서비스 기능, 처리 항목, 보유기간, 위탁 또는 연동 구조가 변경되는 경우 회사는 정책 페이지, 서비스 내
            공지 또는 필요한 경우 별도의 동의 절차를 통해 변경사항을 안내합니다.
          </p>
          <p>
            일반적인 변경은 시행일 7일 전까지, 정보주체의 권리 또는 의무에 중대한 영향을 주는 변경은 시행일 30일 전까지
            고지하는 것을 원칙으로 합니다.
          </p>
        </PrivacySection>

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
