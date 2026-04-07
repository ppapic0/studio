export const TERMS_ROUTE = '/terms';
export const PRIVACY_ROUTE = '/privacy';

export const LEGAL_EFFECTIVE_DATE = '2026-04-07';
export const LEGAL_EFFECTIVE_DATE_LABEL = '2026년 4월 7일';

export const TERMS_VERSION = LEGAL_EFFECTIVE_DATE;
export const PRIVACY_VERSION = LEGAL_EFFECTIVE_DATE;
export const MARKETING_CONSENT_VERSION = LEGAL_EFFECTIVE_DATE;

export const SIGNUP_DATA_FIELDS = [
  '이름',
  '이메일',
  '비밀번호',
  '역할',
  '학교명',
  '휴대폰번호',
  '학생/초대 코드',
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

export type ConsentSource = 'signup' | 'consult';

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
