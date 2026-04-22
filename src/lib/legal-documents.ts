export const TERMS_ROUTE = '/terms';
export const PRIVACY_ROUTE = '/privacy';
export const CLASS_TUITION_POLICY_ROUTE = '/class/tuition-policy';

export const TERMS_EFFECTIVE_DATE = '2026-04-16';
export const TERMS_EFFECTIVE_DATE_LABEL = '2026년 4월 16일';
export const PRIVACY_EFFECTIVE_DATE = '2026-04-16';
export const PRIVACY_EFFECTIVE_DATE_LABEL = '2026년 4월 16일';
export const CLASS_TUITION_POLICY_EFFECTIVE_DATE = '2026-04-12';
export const CLASS_TUITION_POLICY_EFFECTIVE_DATE_LABEL = '2026년 4월 12일';

export const TERMS_VERSION = TERMS_EFFECTIVE_DATE;
export const PRIVACY_VERSION = PRIVACY_EFFECTIVE_DATE;
export const MARKETING_CONSENT_VERSION = '2026-04-07';

export const LEGAL_OPERATOR_NAME = '트랙 학습센터';
export const LEGAL_REPRESENTATIVE_NAME = '김재윤';
export const LEGAL_OPERATOR_LABEL = `${LEGAL_OPERATOR_NAME}(대표 ${LEGAL_REPRESENTATIVE_NAME})`;
export const LEGAL_REQUIRED_TERMS_SUMMARY =
  '서비스 이용 조건, 계정 제한, 콘텐츠·리포트 이용 제한, 결제·환불 기준을 확인합니다.';
export const LEGAL_REQUIRED_PRIVACY_SUMMARY =
  '계정 정보, 학습기록, 상담·리포트, 결제·청구, 운영 알림 처리에 필요한 범위를 확인합니다.';
export const LEGAL_RECONSENT_DESCRIPTION =
  '서비스 운영 과정에서 계정 정보, 학생·학부모 연동 정보, 출결·학습기록, 상담·리포트, 결제·청구, 운영 알림 및 방문 분석 관련 정보를 처리합니다. 계속 이용하려면 현재 약관과 개인정보처리방침 동의가 필요합니다.';
export const LEGAL_CURRENT_DATA_CATEGORIES = [
  '계정·소속 정보: 이름, 이메일, 역할, 학교명, 센터 소속 정보',
  '연동·연락 정보: 학생·학부모 연동 코드, 센터 초대 코드, 학생 본인 번호, 학부모 본인 번호',
  '운영·학습 정보: 출결, 학습시간, 루틴, 상담, 리포트, 결제·청구, 운영 알림 및 보상 이력',
] as const;

export const SIGNUP_DATA_FIELDS = [
  '이름',
  '이메일',
  '비밀번호',
  '역할',
  '학교명',
  '학생 본인 휴대폰번호',
  '학부모 본인 휴대폰번호',
  '학생/학부모 연동 코드',
  '센터 초대 코드',
] as const;

export const CONSULT_DATA_FIELDS = [
  '학생 이름',
  '학교',
  '학년',
  '성별',
  '연락처',
  '서비스 유형',
] as const;

export const MARKETING_ANALYTICS_FIELDS = [
  'track_marketing_vid',
  'track_marketing_sid',
  'localStorage/sessionStorage 식별값',
  'userAgent',
  'referer',
  'pathname',
  'search',
] as const;

export const CONSULT_RETENTION_LABEL = '3년';
export const MARKETING_ANALYTICS_RETENTION_LABEL = '1년';
export const MEMBER_RETENTION_LABEL = '회원 탈퇴 시까지 및 관련 법령 보관기간';

export const CLASS_TUITION_NOTICE = {
  academyName: '트랙 국어학원',
  subject: '국어',
  registrationNumber: '등록 완료 후 업데이트 예정',
  contact: '010-5879-5888',
  sessionSummary: '월 4회 / 주 1회 / 회당 3시간 / 총 12시간',
  extraFees: '별도 비용 없음',
  tuitionRows: [
    {
      target: '고1·고2',
      amount: '320,000원',
      detail: '월 4회 기준 국어 수업',
    },
    {
      target: '고3',
      amount: '350,000원',
      detail: '월 4회 기준 국어 수업',
    },
  ],
  refundRules: [
    {
      stage: '교습 시작 전',
      refund: '이미 납부한 교습비 전액 반환',
    },
    {
      stage: '총 교습시간의 1/3 경과 전',
      refund: '이미 납부한 교습비의 2/3 반환',
    },
    {
      stage: '총 교습시간의 1/2 경과 전',
      refund: '이미 납부한 교습비의 1/2 반환',
    },
    {
      stage: '총 교습시간의 1/2 경과 후',
      refund: '반환 없음',
    },
  ],
  refundBasis: '환불은 학교교과교습학원 교습비 반환기준에 따라 적용됩니다.',
} as const;

export type ConsentSource = 'signup' | 'consult' | 'dashboard';

export type ClientConsentSnapshot = {
  agreed: boolean;
  version: string;
  agreedAt: string;
  source: ConsentSource;
  channel?: string;
};

type BuildClientConsentSnapshotInput = {
  agreed: boolean;
  version: string;
  source: ConsentSource;
  channel?: string;
  agreedAt?: string;
};

export function buildClientConsentSnapshot({
  agreed,
  version,
  source,
  channel,
  agreedAt,
}: BuildClientConsentSnapshotInput): ClientConsentSnapshot {
  return {
    agreed,
    version,
    agreedAt: agreedAt || new Date().toISOString(),
    source,
    ...(channel ? { channel } : {}),
  };
}
