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
import { marketingContent } from '@/lib/marketing-content';

const summaryCards = [
  {
    label: '수집 범위',
    value: '회원가입 · 상담문의 · 방문분석',
    detail: '서비스 제공에 필요한 범위 내에서만 수집합니다.',
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
  {
    label: '문의 채널',
    value: '웹사이트 상담문의',
    detail: '개인정보 관련 문의와 권리행사 요청을 접수합니다.',
  },
] as const;

const entrustedServices = [
  {
    name: 'Google Firebase',
    work: '회원가입, 로그인, 데이터 저장, Cloud Functions 기반 서버 처리',
  },
  {
    name: 'Toss Payments',
    work: '결제 페이지와 결제 처리',
  },
  {
    name: '문자 발송 서비스',
    work: '센터 설정에 따른 운영 안내 및 알림 발송',
  },
] as const;

const reliefOrganizations = [
  '개인정보분쟁조정위원회: 1833-6972 / [www.kopico.go.kr](https://www.kopico.go.kr)',
  '개인정보침해신고센터: 118 / [privacy.kisa.or.kr](https://privacy.kisa.or.kr)',
  '대검찰청: 1301 / [www.spo.go.kr](https://www.spo.go.kr)',
  '경찰청: 182 / [ecrm.cyber.go.kr](https://ecrm.cyber.go.kr)',
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
          className="rounded-2xl border border-[#14295F]/8 bg-[#f7f9ff] px-4 py-3 text-sm font-semibold text-[#14295F]/72"
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
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <section className="overflow-hidden rounded-[2.4rem] bg-[#14295F] px-6 py-8 text-white shadow-[0_36px_80px_-32px_rgba(20,41,95,0.7)] sm:px-8 sm:py-10">
          <p className="text-xs font-black tracking-[0.28em] text-[#FFB273]">PRIVACY POLICY</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">개인정보처리방침</h1>
          <p className="mt-3 max-w-3xl break-keep text-sm font-semibold leading-7 text-white/78">
            트랙 학습센터는 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 적법하고 안전하게 처리하며,
            관련한 고충을 신속하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립·공개합니다.
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

        <PrivacySection title="1. 개인정보의 처리 목적 및 처리 항목">
          <p className="font-black text-[#14295F]">회원가입 및 계정 운영</p>
          <ItemList items={SIGNUP_DATA_FIELDS} />
          <p>처리 목적: 역할별 계정 생성, 센터 가입 처리, 학생·학부모 연동, 로그인 및 대시보드 서비스 제공</p>

          <p className="pt-2 font-black text-[#14295F]">상담문의 및 입학대기 접수</p>
          <ItemList items={CONSULT_DATA_FIELDS} />
          <p>처리 목적: 상담 연락, 입학 안내, 입학대기 관리, 접수 이력 조회</p>

          <p className="pt-2 font-black text-[#14295F]">자동 수집 항목</p>
          <ItemList items={MARKETING_ANALYTICS_FIELDS} />
          <p>처리 목적: 홍보 페이지 유입 경로, 전환 흐름, 상담 전환 성과의 내부 분석</p>
          <p>
            처리하고 있는 개인정보는 위 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는
            「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행합니다.
          </p>
        </PrivacySection>

        <PrivacySection title="2. 개인정보의 처리 및 보유기간">
          <p>회원 정보는 {MEMBER_RETENTION_LABEL} 동안 보관합니다.</p>
          <p>상담문의 및 입학대기 정보는 접수일로부터 {CONSULT_RETENTION_LABEL} 동안 보관합니다.</p>
          <p>웹사이트 방문 분석 식별값 및 이벤트는 수집일로부터 {MARKETING_ANALYTICS_RETENTION_LABEL} 동안 보관합니다.</p>
          <p>
            다만 관계 법령에 따라 별도로 보존할 필요가 있는 경우에는 해당 법령에서 정한 기간 동안 분리하여
            보관합니다.
          </p>
        </PrivacySection>

        <PrivacySection title="3. 개인정보의 제3자 제공에 관한 사항">
          <p>
            트랙 학습센터는 정보주체의 개인정보를 본 방침 제1항에서 명시한 범위 내에서만 처리하며, 원칙적으로
            정보주체의 개인정보를 제3자에게 제공하지 않습니다.
          </p>
          <p>
            다만 정보주체의 별도 동의가 있는 경우, 법률의 특별한 규정이 있는 경우, 수사기관 등 관계 법령에 따른
            적법한 요청이 있는 경우에는 「개인정보 보호법」 제17조 및 제18조에 따라 제공할 수 있습니다.
          </p>
        </PrivacySection>

        <PrivacySection title="4. 개인정보 처리업무의 위탁에 관한 사항">
          <p>트랙 학습센터는 원활한 서비스 제공을 위하여 다음과 같이 개인정보 처리업무의 일부를 위탁할 수 있습니다.</p>
          <div className="grid gap-3">
            {entrustedServices.map((service) => (
              <div
                key={service.name}
                className="rounded-2xl border border-[#14295F]/8 bg-[#f7f9ff] px-4 py-3"
              >
                <p className="font-black text-[#14295F]">{service.name}</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-[#14295F]/66">{service.work}</p>
              </div>
            ))}
          </div>
          <p>
            위탁계약 체결 시 「개인정보 보호법」 제26조에 따라 위탁업무 수행목적 외 개인정보 처리금지, 기술적·관리적
            보호조치, 재위탁 제한, 수탁자에 대한 관리·감독, 손해배상 등 책임에 관한 사항을 계약서 등에 명시하고,
            수탁자가 개인정보를 안전하게 처리하는지를 감독합니다.
          </p>
        </PrivacySection>

        <PrivacySection title="5. 개인정보의 파기절차 및 파기방법">
          <p>
            트랙 학습센터는 개인정보 보유기간의 경과, 처리 목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이
            해당 개인정보를 파기합니다.
          </p>
          <p className="font-black text-[#14295F]">파기절차</p>
          <p>
            개인정보는 목적 달성 후 즉시 파기하거나, 다른 법령에 따라 보존이 필요한 경우에는 별도의 보관 공간으로
            옮겨 법령상 보관기간 종료 후 파기합니다.
          </p>
          <p className="font-black text-[#14295F]">파기방법</p>
          <p>전자적 파일은 복구 또는 재생이 불가능한 기술적 방법으로 삭제합니다.</p>
          <p>종이에 출력된 개인정보는 분쇄하거나 소각하는 방법으로 파기합니다.</p>
        </PrivacySection>

        <PrivacySection title="6. 정보주체와 법정대리인의 권리·의무 및 행사방법">
          <p>
            정보주체는 트랙 학습센터에 대해 언제든지 개인정보 열람, 정정·삭제, 처리정지, 동의 철회 요구 등의 권리를
            행사할 수 있습니다.
          </p>
          <p>
            만 14세 이상의 미성년자인 정보주체는 본인의 개인정보에 대해 직접 권리를 행사할 수 있으며, 법정대리인을
            통하여 행사할 수도 있습니다.
          </p>
          <p>
            권리행사는 웹사이트 상담문의, 센터 방문상담 등으로 접수할 수 있으며, 본인 또는 정당한 대리인 여부를 확인한
            후 지체 없이 처리하겠습니다.
          </p>
          <p>
            다른 법령에서 그 개인정보가 수집 대상으로 명시되어 있는 경우에는 삭제를 요구할 수 없으며, 열람·처리정지
            요구 역시 관련 법령 범위 내에서 제한될 수 있습니다.
          </p>
        </PrivacySection>

        <PrivacySection title="7. 개인정보의 안전성 확보조치에 관한 사항">
          <p>트랙 학습센터는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 하고 있습니다.</p>
          <p>관리적 조치: 내부 권한 관리, 최소 권한 부여, 운영자 접근 통제, 정기적인 점검</p>
          <p>기술적 조치: 인증 기반 접근 통제, 서버 보안 설정, 비공개 설정값 분리, 보안 헤더 및 요청 제한 적용</p>
          <p>물리적 조치: 클라우드 운영환경 접근 통제 및 계정 관리</p>
        </PrivacySection>

        <PrivacySection title="8. 자동으로 수집하는 장치의 설치·운영 및 거부에 관한 사항">
          <p>
            트랙 학습센터는 웹사이트 방문 흐름을 확인하기 위해 first-party 식별값과 방문 분석 이벤트를 사용할 수
            있습니다.
          </p>
          <p>수집 정보: track_marketing_vid, track_marketing_sid, localStorage/sessionStorage 식별값, userAgent, referer, pathname, search</p>
          <p>이용 목적: 홍보 페이지 유입 경로와 상담 전환 흐름 분석</p>
          <p>
            정보주체는 아래 버튼을 통해 방문 분석 식별값 생성 및 이벤트 전송을 거부할 수 있으며, 웹브라우저 설정에서
            쿠키 및 사이트 데이터 저장을 차단하거나 삭제할 수도 있습니다.
          </p>
          <MarketingTrackingOptOutButton />
        </PrivacySection>

        <PrivacySection title="9. 개인정보 보호책임자 및 문의처">
          <p>담당부서: 트랙 학습센터 운영팀</p>
          <p>문의채널: {marketingContent.footer.phone}</p>
          <p>접수방법: 웹사이트 상담문의 또는 센터 방문상담</p>
          <p>주소: {marketingContent.footer.location}</p>
          <p>
            개인정보 보호 관련 문의, 불만 처리, 피해구제, 열람청구 등은 위 문의채널로 접수해 주시면 지체 없이
            답변드리겠습니다.
          </p>
        </PrivacySection>

        <PrivacySection title="10. 정보주체의 권익침해에 대한 구제방법">
          <p>
            정보주체는 개인정보침해로 인한 구제를 받기 위하여 아래 기관에 분쟁해결이나 상담 등을 신청할 수 있습니다.
          </p>
          <div className="grid gap-2">
            {reliefOrganizations.map((item) => (
              <p key={item} className="break-keep rounded-2xl border border-[#14295F]/8 bg-[#f7f9ff] px-4 py-3">
                {item}
              </p>
            ))}
          </div>
          <p>
            위 기관은 트랙 학습센터와 별개의 기관이며, 자체적인 개인정보 불만처리 또는 피해구제 결과에 만족하지
            못하거나 보다 자세한 도움이 필요할 경우 이용할 수 있습니다.
          </p>
        </PrivacySection>

        <PrivacySection title="11. 개인정보처리방침의 변경에 관한 사항">
          <p>이 개인정보처리방침은 {LEGAL_EFFECTIVE_DATE_LABEL}부터 적용됩니다.</p>
          <p>
            법령, 서비스 기능, 처리 항목 또는 보유기간이 변경되는 경우에는 웹사이트 정책 페이지를 통해 사전에 또는
            지체 없이 고지하겠습니다.
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
