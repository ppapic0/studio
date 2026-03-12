export type MarketingNavItem = {
  label: string;
  href: string;
};

export type MarketingStat = {
  label: string;
  value: string;
  detail?: string;
};

export type MarketingCard = {
  title: string;
  description: string;
};

export type ProgramStep = {
  title: string;
  description: string;
};

export type AppFeature = {
  title: string;
  description: string;
};

export type MockPreview = {
  title: string;
  subtitle: string;
  caption: string;
  image?: string;
};

export type AppDataMetric = {
  label: string;
  value: string;
  detail: string;
  tone?: "navy" | "orange" | "green" | "red";
};

export type MarketingContent = {
  brand: {
    name: string;
    slogan: string;
    heroTitle: string;
    heroDescription: string;
    logoFull: string;
    logoMark: string;
    heroBackground: string;
  };
  nav: MarketingNavItem[];
  heroStats: MarketingStat[];
  valueCards: MarketingCard[];
  director: {
    heading: string;
    description: string;
    highlights: string[];
    materialSamples: MockPreview[];
  };
  outcomes: MarketingStat[];
  classSystem: ProgramStep[];
  studyCafe: {
    heading: string;
    description: string;
    features: MarketingCard[];
    seatTypes: MarketingCard[];
  };
  appSystem: {
    heading: string;
    description: string;
    features: AppFeature[];
    appScreens: MockPreview[];
    dataMetrics: AppDataMetric[];
  };
  facility: {
    heading: string;
    description: string;
    gallery: MockPreview[];
  };
  consult: {
    heading: string;
    description: string;
    contactLine: string;
    locationLine: string;
  };
  footer: {
    line: string;
    phone: string;
    location: string;
    hours: string;
  };
};

export const marketingContent: MarketingContent = {
  brand: {
    name: "트랙 학습센터",
    slogan: "관리형 스터디카페 우선 운영 · 국어 입시학원 별도 선택",
    heroTitle: "트랙은 실적으로 증명합니다",
    heroDescription:
      "트랙은 관리형 스터디카페를 중심으로 운영됩니다. 좌석·출입·학습시간·루틴 데이터로 학습 환경을 정교하게 관리하고, 국어 입시학원은 별도 등록으로 선택할 수 있습니다.",
    logoFull: "/track-logo-full.svg",
    logoMark: "/track-logo-mark.svg",
    heroBackground: "",
  },
  nav: [
    { label: "스터디카페", href: "#study-cafe" },
    { label: "학생 앱", href: "#app-system" },
    { label: "입시 성과", href: "#outcome" },
    { label: "원장 소개", href: "#director" },
    { label: "수업 시스템", href: "#class-system" },
    { label: "핵심 가치", href: "#core-value" },
    { label: "시설", href: "#facility" },
    { label: "상담 문의", href: "#consult" },
  ],
  heroStats: [
    {
      label: "2026학년도 대학 합격 실적",
      value: "고려대 2 · 서강대 1 · 성균관대 1 · 아주대 1 · 홍익대 1",
      detail: "총 6명 합격",
    },
    {
      label: "스터디카페 단독 등록",
      value: "학원 수강 없이 이용 가능",
      detail: "필요 시 입시학원 별도 선택",
    },
    {
      label: "관리형 운영 시스템",
      value: "출입·학습시간·루틴 데이터 관리",
      detail: "학습환경 운영 중심",
    },
  ],
  valueCards: [
    {
      title: "관리형 스터디카페 우선",
      description: "학습시간과 루틴의 일관성을 만드는 운영 시스템이 가장 먼저입니다.",
    },
    {
      title: "입시학원 별도 선택",
      description: "국어 수업은 별도 등록으로 운영되어 학생 상황에 맞게 선택할 수 있습니다.",
    },
    {
      title: "데이터 기반 운영",
      description: "출입, 학습시간, 루틴 이행 데이터를 기준으로 학습환경을 안정적으로 관리합니다.",
    },
    {
      title: "프리미엄 몰입 공간",
      description: "러셀형/프라이버시형 좌석으로 장시간 학습에 맞는 집중 환경을 제공합니다.",
    },
  ],
  director: {
    heading: "원장 소개",
    description:
      "교육학·국어국문 전공 기반으로 국어 수업을 설계하고, 학생별 취약 단원을 정밀하게 분석해 성과 중심 피드백을 제공합니다.",
    highlights: [
      "교육학·국어국문 전공 기반 커리큘럼 설계",
      "분당·판교 관리형 독서실 원장 운영 경험",
      "국어 개인과외 40명 이상 지도",
      "원장 본인 24학년도 국어 백분위 99",
      "해설자료·수업자료 직접 제작 및 개별 피드백",
    ],
    materialSamples: [
      {
        title: "수능 국어 해설 자료",
        subtitle: "문항별 사고 과정 정리",
        caption: "문항 접근법과 오답 원인을 구조적으로 분석해 재현 가능한 풀이 전략으로 연결합니다.",
      },
      {
        title: "학생별 맞춤 수업 노트",
        subtitle: "취약 개념 집중 보완",
        caption: "학생의 오답 패턴과 학습 습관을 반영해 개별 복습 동선을 설계합니다.",
      },
      {
        title: "주간 학습 리포트",
        subtitle: "학부모 공유형 피드백",
        caption: "학습량·리듬·상담 이슈를 정리해 학부모와 학습 방향을 명확히 공유합니다.",
      },
    ],
  },
  outcomes: [
    { label: "2026학년도 수능", value: "국어 백분위 99", detail: "상위권 성과" },
    { label: "고려대학교", value: "2명", detail: "합격" },
    { label: "서강대학교", value: "1명", detail: "합격" },
    { label: "성균관대학교", value: "1명", detail: "합격" },
    { label: "아주대학교", value: "1명", detail: "합격" },
    { label: "홍익대학교", value: "1명", detail: "합격" },
  ],
  classSystem: [
    {
      title: "진단",
      description: "학원 등록 학생의 현재 성취도와 취약 단원을 진단합니다.",
    },
    {
      title: "원장 직강",
      description: "개념과 독해 사고를 연결하는 수업으로 실전 적용력을 빠르게 높입니다.",
    },
    {
      title: "직접 제작 자료",
      description: "해설자료·복습자료를 제공해 개념 정착과 오답 교정을 동시에 진행합니다.",
    },
    {
      title: "개별 피드백",
      description: "이해도 변화를 점검해 다음 수업에 반영하고 개선 포인트를 안내합니다.",
    },
    {
      title: "성과 추적",
      description: "학습 기록과 결과를 연결해 다음 전략을 명확하게 제시합니다.",
    },
  ],
  studyCafe: {
    heading: "관리형 스터디카페가 먼저입니다",
    description:
      "관리형 스터디카페는 학습환경 운영 중심 서비스입니다. 좌석·출입·학습시간·루틴 점검 중심으로 운영되며, 학원 수업과는 별도 등록으로 선택할 수 있습니다.",
    features: [
      {
        title: "학습환경 운영 중심",
        description: "학습지도/교습이 아닌 학습환경 운영, 시간관리, 이용 편의 중심으로 제공합니다.",
      },
      {
        title: "단독 등록 가능",
        description: "입시학원 수강 여부와 관계없이 스터디카페만 단독 등록해 이용할 수 있습니다.",
      },
      {
        title: "데이터 기반 루틴 관리",
        description: "출입 기록과 학습시간 데이터를 바탕으로 루틴 이행 상태를 시각적으로 확인합니다.",
      },
      {
        title: "운영 리포트 제공",
        description: "주간 학습 시간과 이용 패턴을 요약해 학생·학부모가 현황을 쉽게 파악할 수 있습니다.",
      },
    ],
    seatTypes: [
      {
        title: "러셀형 책상",
        description: "시야 분산을 줄여 장시간 몰입에 유리한 구조로 설계한 좌석입니다.",
      },
      {
        title: "프라이버시 보호형 독서실 책상",
        description: "개인 학습 공간을 확보해 안정적인 집중 환경을 제공합니다.",
      },
    ],
  },
  appSystem: {
    heading: "운영 데이터가 보이는 학생 앱",
    description:
      "출입, 학습시간, 루틴 이행, 상담/요청 내역을 한 화면에서 확인합니다. 학생·학부모·센터가 같은 지표를 기준으로 빠르게 대응할 수 있습니다.",
    features: [
      { title: "학습 계획 확인", description: "오늘 목표와 루틴을 확인하고 실행 흐름을 정리합니다." },
      { title: "기록트랙 캘린더", description: "날짜별 학습시간과 기록을 캘린더로 조회합니다." },
      { title: "성장/스킬 지표", description: "LP와 스킬트랙 점수를 기준으로 성장 상태를 확인합니다." },
      { title: "상담/요청 연동", description: "상담 예약과 요청 내역을 앱에서 바로 확인할 수 있습니다." },
    ],
    appScreens: [
      {
        title: "학생 홈 대시보드",
        subtitle: "당일 학습 상태 통합 점검",
        caption: "오늘의 학습시간, 포인트, 계획 이행률을 한 번에 확인합니다.",
      },
      {
        title: "성장트랙 분석",
        subtitle: "스킬별 세부 지표 확인",
        caption: "집중력·꾸준함·목표달성·회복력 지표를 시각화해 확인합니다.",
      },
      {
        title: "학부모 데이터 연동",
        subtitle: "학습 기록·생활 이슈 공유",
        caption: "학부모가 자녀의 학습 데이터와 주요 이슈를 같은 기준으로 파악할 수 있습니다.",
      },
    ],
    dataMetrics: [
      { label: "시즌 누적 포인트", value: "3,164 LP", detail: "실시간 반영", tone: "orange" },
      { label: "평균 공부 리듬", value: "98.2점", detail: "집중·꾸준함·목표달성 기반", tone: "green" },
      { label: "주간 누적 학습", value: "14시간 23분", detail: "기록트랙 캘린더 기준", tone: "navy" },
      { label: "누적 벌점 지수", value: "5점", detail: "회복 점수 반영 관리", tone: "red" },
    ],
  },
  facility: {
    heading: "몰입을 위한 프리미엄 시설",
    description: "조용하고 정돈된 공간, 프라이버시를 고려한 좌석 구성으로 학습 효율을 높입니다.",
    gallery: [
      {
        title: "집중 학습 존",
        subtitle: "저소음 · 고집중 환경",
        caption: "조용한 환경에서 장시간 몰입할 수 있도록 설계된 학습 구역입니다.",
      },
      {
        title: "프라이빗 좌석 존",
        subtitle: "개인 몰입 공간",
        caption: "러셀형/독서실형 좌석 구조로 개인 집중도를 안정적으로 유지합니다.",
      },
      {
        title: "상담 · 코칭 공간",
        subtitle: "피드백 중심 상담",
        caption: "학생·학부모 상담과 학습 방향 설계를 위한 공간입니다.",
      },
    ],
  },
  consult: {
    heading: "입학 상담 및 방문 예약",
    description:
      "스터디카페 이용 상담부터 입시학원 프로그램 안내까지 한 번에 안내드립니다. 현재 학습 상태를 기준으로 맞춤 운영 방향을 제안합니다.",
    contactLine: "상담 문의: 상담 폼 접수 후 순차 연락",
    locationLine: "위치: 경기 용인시 기흥구 동백중앙로 283 B동 906호, 907호",
  },
  footer: {
    line: "트랙은 실적으로 증명합니다",
    phone: "상담 문의: 상담 폼 접수 후 순차 연락",
    location: "경기 용인시 기흥구 동백중앙로 283 B동 906호, 907호",
    hours: "운영 시간: 평일 13:00 - 22:00 / 토요일 10:00 - 18:00",
  },
};
