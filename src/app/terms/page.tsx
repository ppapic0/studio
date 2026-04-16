import Link from 'next/link';

import { MarketingTrackingOptOutButton } from '@/components/marketing/marketing-tracking-opt-out-button';
import {
  CLASS_TUITION_POLICY_ROUTE,
  CONSULT_RETENTION_LABEL,
  LEGAL_OPERATOR_LABEL,
  MEMBER_RETENTION_LABEL,
  PRIVACY_ROUTE,
  TERMS_EFFECTIVE_DATE_LABEL,
} from '@/lib/legal-documents';
import { marketingContent } from '@/lib/marketing-content';

const summaryCards = [
  {
    label: '운영주체',
    value: LEGAL_OPERATOR_LABEL,
    detail: '웹사이트, 역할별 대시보드, 상담·수납·리포트 서비스를 운영합니다.',
  },
  {
    label: '가입 기준',
    value: '만 14세 이상',
    detail: '현재는 별도 법정대리인 동의 절차 없이 만 14세 이상만 가입할 수 있습니다.',
  },
  {
    label: '재동의',
    value: '2026-04-16 버전',
    detail: '중요한 권리·의무 변경이 있어 기존 회원도 현재 약관 재동의가 필요합니다.',
  },
  {
    label: '별도 기준',
    value: '교습비 반환 기준 우선',
    detail: '유료 수납·청구·환불은 학원 고지와 관계 법령을 우선 적용합니다.',
  },
] as const;

const serviceScopeItems = [
  '학생·학부모·선생님·센터관리자용 역할별 대시보드',
  '출결, 학습시간 기록, 루틴/플랜, 상담, 리포트, 운영 알림',
  '청구서, 결제 안내, 수납 현황, 포인트 및 보상/쿠폰 처리',
  '상담문의, 입학대기 접수, 웹사이트 방문 분석 및 운영 공지',
] as const;

const prohibitedActs = [
  '타인의 개인정보, 연락처, 초대 코드, 학생·학부모 연동 코드를 도용하거나 허위 정보를 등록하는 행위',
  '계정을 타인과 공유·양도·대여하거나 권한이 없는 역할 화면에 접근하려는 행위',
  '학생·학부모·교사 화면, 상담기록, 리포트, 포인트·보상 콘텐츠를 무단 복제·배포·판매·상업적으로 이용하는 행위',
  '스크래핑, 크롤링, 매크로, 비정상 자동화, 대량 요청 등으로 서비스 운영을 방해하는 행위',
  '보안 설정 우회, 관리자 권한 오용, 리버스엔지니어링, 비정상 API 호출 등 서비스 안정성을 해치는 행위',
  '법령, 공서양속, 센터 운영정책, 본 약관에 위반되는 방식으로 서비스를 이용하는 행위',
] as const;

const pointsPolicyItems = [
  '포인트, 보상, 쿠폰은 현금 또는 예금이 아니며, 별도 법령상 강행 규정이 없는 한 현금 환급 대상이 아닙니다.',
  '포인트 적립·차감·사용 가능 여부는 센터 정책, 운영 이벤트, 외부 보상 공급사의 재고 및 정책에 따라 변경될 수 있습니다.',
  '부정 적립·중복 적립·시스템 오작동·권한 오남용으로 취득한 포인트와 보상은 사전 통지 후 회수 또는 취소될 수 있습니다.',
  '외부 공급사를 통해 발송되는 쿠폰·상품권은 공급사 정책, 유효기간, 발송 상태, 취소 가능 범위에 따릅니다.',
] as const;

const intellectualPropertyItems = [
  '서비스 화면, 문구, 리포트 구성, 상담 기록 포맷, 데이터 시각화, 운영 정책 문서, 포인트·보상 연출 등 서비스 내 콘텐츠와 저작물에 관한 권리는 회사 또는 정당한 권리자에게 귀속됩니다.',
  '이용자는 회사의 사전 서면 동의 없이 서비스 또는 그 일부를 복제, 배포, 전송, 전시, 수정, 2차적 저작물 작성, 상업적 이용에 사용할 수 없습니다.',
  '이용자가 서비스에 게시하거나 제출한 문의, 상담 내용, 피드백 자료는 이용자의 권리를 존중하되, 서비스 운영·민원 처리·품질 개선 범위에서 비독점적으로 사용할 수 있습니다.',
] as const;

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

function TermsBulletList({ items }: { items: readonly string[] }) {
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

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ffd7bb_0%,#f7f9ff_42%,#eef3ff_100%)] px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <section className="overflow-hidden rounded-[2.4rem] bg-[#14295F] px-6 py-8 text-white shadow-[0_36px_80px_-32px_rgba(20,41,95,0.7)] sm:px-8 sm:py-10">
          <p className="text-xs font-black tracking-[0.28em] text-[#FFB273]">TERMS OF SERVICE</p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">이용약관</h1>
          <p className="mt-3 max-w-3xl break-keep text-sm font-semibold leading-7 text-white/78">
            본 약관은 {LEGAL_OPERATOR_LABEL}가 제공하는 웹사이트, 회원가입, 역할별 학습 대시보드, 상담, 결제,
            리포트, 운영 알림 서비스 이용과 관련한 권리, 의무 및 책임사항을 정합니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-black text-white/72">
            <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5">
              시행일 {TERMS_EFFECTIVE_DATE_LABEL}
            </span>
            <Link
              href={PRIVACY_ROUTE}
              className="rounded-full border border-[#FF7A16]/35 bg-[#FF7A16]/12 px-3 py-1.5 text-[#FFD0A5] transition hover:bg-[#FF7A16]/18"
            >
              개인정보처리방침 보기
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

        <TermsSection title="1. 목적 및 정의">
          <p>
            본 약관은 {LEGAL_OPERATOR_LABEL}(이하 &quot;회사&quot;)가 제공하는 서비스의 이용 조건, 회원과 회사의 권리·의무,
            책임사항 및 운영기준을 정하는 것을 목적으로 합니다.
          </p>
          <p>
            본 약관에서 &quot;서비스&quot;란 웹사이트, 상담문의, 입학대기, 학생·학부모·선생님·센터관리자 대시보드, 출결,
            학습기록, 루틴/플랜, 상담, 리포트, 수납/청구, 포인트/보상, 운영 알림을 포함한 온라인 서비스 전반을 말합니다.
          </p>
          <p>
            &quot;회원&quot;이란 본 약관과 개인정보처리방침에 동의하고 계정을 생성하여 서비스를 이용하는 자를 말하며, 역할에
            따라 학생·학부모·선생님·센터관리자 등으로 구분됩니다.
          </p>
        </TermsSection>

        <TermsSection title="2. 약관의 효력 및 개정">
          <p>
            본 약관은 서비스 화면, 가입 절차, 정책 페이지 등에 게시함으로써 효력이 발생합니다. 회원은 약관에 동의한
            경우 본 약관에 따라 서비스를 이용할 의무가 있습니다.
          </p>
          <p>
            회사는 관계 법령, 서비스 구조, 보안정책, 운영방식의 변경이 있는 경우 약관을 개정할 수 있으며, 회원에게
            불리하지 않은 일반적 변경은 시행일 10일 전까지, 회원의 권리·의무에 중대한 영향을 주는 변경은 시행일 30일
            전까지 고지하는 것을 원칙으로 합니다.
          </p>
          <p>
            개정 약관 시행 후에도 회원이 서비스를 계속 이용하면 개정 약관에 동의한 것으로 봅니다. 다만 이번 개정처럼
            중요한 내용 변경이 있는 경우 회사는 별도의 재동의 절차를 요구할 수 있습니다.
          </p>
        </TermsSection>

        <TermsSection title="3. 회원가입 및 자격 제한">
          <p>
            회원가입은 본인 명의의 이메일과 정확한 정보를 기초로 진행해야 하며, 학생·선생님·센터관리자는 센터 초대
            코드, 학부모는 학생 코드와 본인 연락처 확인 절차를 거쳐 가입할 수 있습니다.
          </p>
          <p>
            현재 서비스는 별도 법정대리인 동의 절차를 제공하지 않으므로 만 14세 미만은 회원가입할 수 없습니다. 회원은
            연령, 권한, 소속에 관한 정보를 허위로 등록해서는 안 됩니다.
          </p>
          <p>
            허위 정보 등록, 타인 정보 도용, 초대 코드 부정 사용, 이미 제한된 계정의 우회 재가입 시도 등은 가입 거절,
            이용 제한 또는 계정 해지 사유가 됩니다.
          </p>
        </TermsSection>

        <TermsSection title="4. 계정 정보의 정확성 및 보안">
          <p>
            회원은 자신의 계정 정보와 비밀번호를 스스로 관리해야 하며, 타인에게 계정을 공유·양도·대여하거나 접근권한을
            넘겨서는 안 됩니다.
          </p>
          <p>
            회사는 회원이 등록한 연락처, 이메일, 센터 소속, 학생·학부모 연동 정보 등을 기준으로 운영 공지, 상담 응대,
            알림 발송, 청구 안내, 본인 확인을 수행할 수 있습니다. 회원은 정보가 변경되면 지체 없이 최신 상태로 유지해야
            합니다.
          </p>
          <p>
            계정 도용, 무단 접근, 개인정보 유출 우려가 있는 경우 회원은 즉시 회사에 알려야 하며, 이를 지연하여 발생한
            손해에 대해서는 회원의 책임이 인정될 수 있습니다.
          </p>
        </TermsSection>

        <TermsSection title="5. 서비스의 내용, 제공, 변경 및 중단">
          <TermsBulletList items={serviceScopeItems} />
          <p>
            회사는 서비스 품질 향상, 보안, 법령 준수, 외부 연동사의 정책 변경, 시스템 점검 또는 운영상 필요에 따라
            서비스의 전부 또는 일부를 변경, 추가, 제한, 중단할 수 있습니다.
          </p>
          <p>
            정기 점검 또는 긴급 보안 조치가 필요한 경우 사전 공지 후 서비스를 중단할 수 있으며, 긴급 장애 대응이 필요한
            경우에는 사후 공지로 갈음할 수 있습니다.
          </p>
        </TermsSection>

        <TermsSection title="6. 유료 서비스, 청구, 결제 및 환불">
          <p>
            서비스 일부에는 교습비, 청구서, 결제 안내, 수납 확인 등 유료 거래와 관련된 기능이 포함될 수 있습니다.
            회사는 결제대행사 및 외부 연동사를 통해 결제를 처리할 수 있으며, 결제수단의 세부정보는 해당 결제대행사가
            처리할 수 있습니다.
          </p>
          <p>
            실제 교습계약, 교습비, 청구, 환불, 반환 비율 및 반환 절차는 서비스 내 고지, 개별 계약, 학원 운영정책,
            관계 법령 및 <Link href={CLASS_TUITION_POLICY_ROUTE} className="font-black text-[#FF7A16] underline underline-offset-4">교습비 반환 기준</Link>을 우선 적용합니다.
          </p>
          <p>
            결제가 정상적으로 완료되지 않거나 환불 제한 사유가 있는 경우 일부 서비스 접근이 제한될 수 있으며, 미납 상태가
            지속될 경우 회사는 계정 또는 소속 이용 범위를 조정할 수 있습니다.
          </p>
        </TermsSection>

        <TermsSection title="7. 운영 공지 및 필수 알림">
          <p>
            회사는 출결, 학습 진행, 상담 일정, 리포트 발행, 결제·청구, 보안, 약관 변경, 운영 공지 등 서비스 제공에
            필수적인 내용을 전화, 문자, 카카오 알림, 이메일, 앱 내 알림 등의 방식으로 발송할 수 있습니다.
          </p>
          <p>
            위와 같은 필수 알림은 광고성 정보 수신 동의와 별개로 발송될 수 있습니다. 다만 혜택·이벤트·신규 프로그램
            안내 등 마케팅 목적의 발송은 회원의 별도 선택 동의 범위 내에서만 진행합니다.
          </p>
        </TermsSection>

        <TermsSection title="8. 금지행위">
          <TermsBulletList items={prohibitedActs} />
        </TermsSection>

        <TermsSection title="9. 이용 제한, 정지 및 계약 해지">
          <p>
            회사는 회원이 본 약관, 운영정책 또는 관계 법령을 위반하거나 서비스 안전성을 해치는 경우 사전 통지 또는
            사후 통지 후 경고, 일부 기능 제한, 소속 제한, 계정 정지, 계정 삭제, 손해배상 청구 등 필요한 조치를 할 수
            있습니다.
          </p>
          <p>
            부정 이용, 허위 정보, 권한 우회, 개인정보 침해, 대량 자동화 요청, 운영 방해, 무단 복제·배포 같은 중대한
            위반이 있는 경우 회사는 사전 통지 없이 즉시 이용을 제한할 수 있습니다.
          </p>
          <p>
            회원은 언제든지 탈퇴를 요청할 수 있으나, 이미 발생한 결제·청구·상담·분쟁·법정 보존기록은 관계 법령과
            <Link href={PRIVACY_ROUTE} className="font-black text-[#FF7A16] underline underline-offset-4"> 개인정보처리방침</Link>에 따라 별도 보관될 수 있습니다.
          </p>
        </TermsSection>

        <TermsSection title="10. 포인트, 보상 및 외부 쿠폰">
          <TermsBulletList items={pointsPolicyItems} />
        </TermsSection>

        <TermsSection title="11. 지식재산권 및 게시자료 이용 제한">
          <TermsBulletList items={intellectualPropertyItems} />
        </TermsSection>

        <TermsSection title="12. AI 리포트 및 추천 기능">
          <p>
            서비스에는 학습기록, 출결, 상담 내용, 루틴 이력 등을 기반으로 AI 또는 규칙 기반 분석을 이용해 리포트,
            추천, 요약, 코칭 문구를 생성하는 기능이 포함될 수 있습니다.
          </p>
          <p>
            이러한 결과물은 학습 운영과 상담을 보조하기 위한 참고자료이며, 입시 결과, 성적 향상, 학업 성과, 상담 결과를
            보장하지 않습니다. 회원은 AI 결과물을 단독 의사결정 근거로만 사용해서는 안 됩니다.
          </p>
          <p>
            회사는 모델 응답, 데이터 품질, 외부 연동 장애 등으로 인해 일부 리포트 또는 추천의 정확성, 완전성, 최신성이
            제한될 수 있음을 고지합니다.
          </p>
        </TermsSection>

        <TermsSection title="13. 손해배상 및 면책">
          <p>
            회원이 본 약관 또는 관계 법령을 위반하여 회사, 다른 회원, 센터, 외부 연동사에 손해를 발생시킨 경우 그 손해를
            배상할 책임이 있습니다.
          </p>
          <p>
            회사는 천재지변, 불가항력, 통신장애, 결제대행사·문자발송사·쿠폰공급사·클라우드 인프라 사업자의 장애,
            회원의 귀책사유로 인한 서비스 이용장애에 대하여 책임을 지지 않습니다.
          </p>
          <p>
            회사는 무료 서비스, 운영 편의 기능, 참고용 리포트, 마케팅 분석, 외부 공급사의 재고·발송 상태와 관련하여
            법령상 허용되는 범위 내에서 명시적 또는 묵시적 보증을 하지 않습니다.
          </p>
        </TermsSection>

        <TermsSection title="14. 준거법, 관할 및 문의처">
          <p>본 약관은 대한민국 법률에 따라 해석되고 적용됩니다.</p>
          <p>
            서비스 이용과 관련하여 회사와 회원 사이에 분쟁이 발생하는 경우, 당사자들은 우선 성실히 협의하며,
            협의가 이루어지지 않으면 민사소송법상 관할 법원에 따릅니다.
          </p>
          <p>문의처: {marketingContent.footer.phone}</p>
          <p>주소: {marketingContent.footer.location}</p>
          <p>
            상담문의 및 입학대기 정보는 접수일로부터 {CONSULT_RETENTION_LABEL}, 회원 정보는 {MEMBER_RETENTION_LABEL}
            동안 보관될 수 있으며, 자세한 내용은 개인정보처리방침을 따릅니다.
          </p>
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
              href={PRIVACY_ROUTE}
              className="rounded-full border border-[#14295F]/12 px-4 py-2.5 text-[#14295F] transition hover:border-[#FF7A16]/45 hover:text-[#FF7A16]"
            >
              개인정보처리방침 보기
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
