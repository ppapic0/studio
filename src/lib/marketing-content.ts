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

export type AppModeCard = {
  mode: string;
  description: string;
  items: string[];
};

export type LPCycleCard = {
  title: string;
  description: string;
};

export type ComparisonRow = {
  topic: string;
  common: string;
  track: string;
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
  successStory: {
    title: string;
    summary: string;
  };
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
    modes: AppModeCard[];
    features: AppFeature[];
    appScreens: MockPreview[];
    dataMetrics: AppDataMetric[];
  };
  lpSystem: {
    heading: string;
    description: string;
    cycle: LPCycleCard[];
    benefits: string[];
  };
  comparison: {
    heading: string;
    description: string;
    rows: ComparisonRow[];
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
    name: "트랙 국어 학원 · 트랙 스터디카페",
    slogan: "학생의 성장 궤적을 함께 그립니다",
    heroTitle: "트랙은 실적으로 증명합니다",
    heroDescription:
      "관리형 스터디카페 운영을 중심으로 학습 루틴을 먼저 만들고, 수능 국어 전문 수업은 별도 선택형으로 운영합니다. 학생의 현재를 데이터로 확인하고, 다음 전략을 명확하게 설계합니다.",
    logoFull: "/track-logo-full.svg",
    logoMark: "/track-logo-mark.svg",
    heroBackground: "",
  },
  nav: [
    { label: "스터디카페", href: "#study-cafe" },
    { label: "웹앱 시스템", href: "#app-system" },
    { label: "LP 시스템", href: "#lp-system" },
    { label: "합격 실적", href: "#outcome" },
    { label: "차별점", href: "#why-track" },
    { label: "상담 문의", href: "#consult" },
  ],
  heroStats: [
    {
      label: "2026학년도 주요 대학 합격",
      value: "고려대 2 · 서강대 1 · 성균관대 1 · 홍익대 1 · 아주대 1",
      detail: "총 6명 합격",
    },
    {
      label: "스터디카페 단독 등록",
      value: "학원 수강 없이 이용 가능",
      detail: "학원은 필요 시 별도 선택",
    },
    {
      label: "실시간 운영 데이터",
      value: "출입·학습시간·실행률 점검",
      detail: "학습환경 운영 중심",
    },
  ],
  valueCards: [
    {
      title: "수능 국어 전문 수업",
      description: "진단 기반 커리큘럼으로 학생별 취약 유형을 보완하고 실전 점수로 연결합니다.",
    },
    {
      title: "개인 맞춤 설계",
      description: "학생별 목표와 현재 상태를 기준으로 학습 흐름을 다르게 설계합니다.",
    },
    {
      title: "학부모 실시간 확인",
      description: "출결, 학습 현황, 피드백, 성적 추이를 앱에서 확인할 수 있습니다.",
    },
    {
      title: "계획-실행-피드백 루프",
      description: "LP 시스템으로 공부 과정을 구조화해 막연한 공부를 구체적인 실행으로 전환합니다.",
    },
  ],
  director: {
    heading: "원장 소개 · 지도 철학",
    description:
      "트랙은 개인과외의 밀착 관리 방식을 학원 시스템으로 확장한 브랜드입니다. 수능 국어 전문 지도 경험과 학생별 맞춤 피드백 방식을 기반으로, 성적을 만드는 과정을 정밀하게 관리합니다.",
    highlights: [
      "수능 국어 전문 지도 및 개인 맞춤 설계",
      "개인과외 시절 직접 지도 학생 70% 인서울 달성",
      "분당·판교 관리형 독서실 운영 경험 기반 관리 노하우",
      "교육학·국어국문 전공 기반 수업 설계",
      "원장 본인 24학년도 국어 백분위 99 (경력 정보)",
      "트랙 전용 학부모/학생 웹앱 기획 및 운영",
    ],
    materialSamples: [
      {
        title: "진단 리포트",
        subtitle: "약점 유형 분류",
        caption: "학생별 독해 습관과 오답 패턴을 분석해 우선 보완 과제를 도출합니다.",
      },
      {
        title: "수업 해설 자료",
        subtitle: "원장 직접 제작",
        caption: "개념-문항-오답교정 흐름이 끊기지 않도록 수업 자료를 직접 설계합니다.",
      },
      {
        title: "주간 피드백 노트",
        subtitle: "학부모 공유형",
        caption: "실행률과 성적 추이를 함께 보며 다음 주 전략을 조정합니다.",
      },
    ],
  },
  outcomes: [
    { label: "고려대학교", value: "2명", detail: "2026학년도 합격" },
    { label: "서강대학교", value: "1명", detail: "2026학년도 합격" },
    { label: "성균관대학교", value: "1명", detail: "2026학년도 합격" },
    { label: "홍익대학교", value: "1명", detail: "2026학년도 합격" },
    { label: "아주대학교", value: "1명", detail: "2026학년도 합격" },
    { label: "인서울 합격 흐름", value: "70%", detail: "개인과외 시절 기준" },
  ],
  successStory: {
    title: "특별 성장 사례",
    summary: "6월 모의고사 국어 3등급 → 수능 백분위 99 → 고려대학교 합격",
  },
  classSystem: [
    {
      title: "실력 진단",
      description: "기출 기반 진단으로 학생의 취약 유형과 독해 습관을 먼저 파악합니다.",
    },
    {
      title: "개인 설계",
      description: "학생별 목표와 학습 시간표에 맞춘 맞춤 커리큘럼을 설계합니다.",
    },
    {
      title: "독해 원리 확립",
      description: "정확하게 읽는 힘을 중심으로 문학·비문학 사고 체계를 정리합니다.",
    },
    {
      title: "유형 집중 훈련",
      description: "약점 유형을 반복 훈련하며 실전에서 흔들리지 않는 풀이 습관을 만듭니다.",
    },
    {
      title: "실전 분석",
      description: "기출/모의 성과를 분석해 전략을 수정하고 다음 단계로 연결합니다.",
    },
  ],
  studyCafe: {
    heading: "관리형 스터디카페가 운영의 중심입니다",
    description:
      "트랙 스터디카페는 학습환경 운영 서비스입니다. 출입 기록, 학습 시간, 실행 루틴을 관리하며 학생의 공부 흐름이 끊기지 않도록 지원합니다. 입시학원 수강과 별개로 단독 이용이 가능합니다.",
    features: [
      {
        title: "학습 루틴 완성 공간",
        description: "예쁜 공간 소개보다, 매일 공부가 이어지는 루틴 구조를 먼저 설계합니다.",
      },
      {
        title: "학원과 별도 이용 가능",
        description: "스터디카페만 등록해 이용할 수 있으며, 학원 프로그램은 별도 선택입니다.",
      },
      {
        title: "출입 자동 기록",
        description: "입·퇴실 기록이 자동으로 누적되어 이용 흐름과 시간 패턴을 확인할 수 있습니다.",
      },
      {
        title: "학부모 실시간 확인",
        description: "학부모 앱에서 출입/학습 현황을 확인하며 가정 내 소통 부담을 줄입니다.",
      },
    ],
    seatTypes: [
      {
        title: "러셀형 책상",
        description: "시야 분산을 줄이고 몰입을 높이도록 설계된 좌석 구조입니다.",
      },
      {
        title: "프라이버시 보호형 독서실 책상",
        description: "개인 집중 공간을 확보해 장시간 학습에도 안정적인 몰입이 가능합니다.",
      },
    ],
  },
  appSystem: {
    heading: "학생을 놓치지 않는 전용 웹앱",
    description:
      "트랙 앱은 기술 홍보를 위한 화면이 아니라 관리 품질을 위한 시스템입니다. 학부모·학생·관리자가 같은 지표를 보고 빠르게 대응합니다.",
    modes: [
      {
        mode: "학부모 모드",
        description: "학습 과정을 투명하게 확인하는 실시간 모니터링",
        items: ["출결 확인", "학습 현황", "피드백 수신", "성적 추이", "상담/질문"],
      },
      {
        mode: "학생 모드",
        description: "계획부터 실행까지 스스로 관리하는 학습 루틴",
        items: ["주간 LP 작성", "오늘 할 일", "오답 기록", "성장 그래프", "일정 관리"],
      },
      {
        mode: "관리자 모드",
        description: "위험 신호를 놓치지 않는 운영 대시보드",
        items: ["하락 추세 감지", "미제출 확인", "피드백 발송", "상담 이력", "우선 대응 추천"],
      },
    ],
    features: [
      { title: "학습 계획 확인", description: "매일 할 일을 구체화해 막연한 공부를 줄입니다." },
      { title: "기록트랙 캘린더", description: "날짜별 공부 시간과 실행 결과를 직관적으로 확인합니다." },
      { title: "성장/스킬 지표", description: "LP·스킬트랙 지표를 통해 학습 흐름 변화를 파악합니다." },
      { title: "상담/요청 연동", description: "상담 요청과 피드백 기록이 앱에서 연결되어 누적 관리됩니다." },
    ],
    appScreens: [
      {
        title: "학생 홈 대시보드",
        subtitle: "오늘의 계획과 실행률 확인",
        caption: "오늘의 학습시간, 계획 이행률, 핵심 지표를 한 번에 확인합니다.",
      },
      {
        title: "학부모 데이터 화면",
        subtitle: "과정 확인 중심",
        caption: "출결, 학습량, 피드백, 성적 추이를 실시간으로 확인할 수 있습니다.",
      },
      {
        title: "관리자 분석 화면",
        subtitle: "조기 위험 감지",
        caption: "하락 추세 학생을 빠르게 식별하고 우선 순위 대응이 가능합니다.",
      },
    ],
    dataMetrics: [
      { label: "시즌 누적 포인트", value: "3,164 LP", detail: "실시간 반영", tone: "orange" },
      { label: "평균 공부 리듬", value: "98.2점", detail: "집중·꾸준함·목표달성 기반", tone: "green" },
      { label: "주간 누적 학습", value: "14시간 23분", detail: "기록트랙 캘린더 기준", tone: "navy" },
      { label: "누적 벌점 지수", value: "5점", detail: "회복 점수 반영 관리", tone: "red" },
    ],
  },
  lpSystem: {
    heading: "LP 학습 계획 시스템",
    description:
      "학생이 계획을 세우고, 매일 실행을 체크하고, 원장이 피드백을 반영해 다음 주 전략을 다시 설계하는 루프입니다.",
    cycle: [
      { title: "계획", description: "주간 목표와 일일 실행 항목을 직접 작성" },
      { title: "실행", description: "매일 실제 수행 여부와 학습 시간을 기록" },
      { title: "체크", description: "원장/관리자가 이행률과 누락 구간을 점검" },
      { title: "피드백", description: "학생별 취약 지점을 기준으로 보완 과제 제시" },
      { title: "개선", description: "다음 주 계획에 반영해 루틴을 고도화" },
    ],
    benefits: [
      "막연한 공부가 구체적인 공부로 바뀝니다.",
      "자기관리 습관이 형성되어 장기전에서 흔들림이 줄어듭니다.",
      "학부모는 잔소리 대신 객관적 지표를 통해 현황을 확인할 수 있습니다.",
    ],
  },
  comparison: {
    heading: "왜 트랙인가",
    description: "같은 공부 시간이라도 관리 구조가 다르면 결과가 달라집니다.",
    rows: [
      {
        topic: "수업 운영",
        common: "동일 진도 중심",
        track: "개인별 맞춤 커리큘럼 설계",
      },
      {
        topic: "학부모 소통",
        common: "정기 상담 시점 중심",
        track: "앱 기반 실시간 확인·피드백",
      },
      {
        topic: "학습 관리",
        common: "출결 확인 중심",
        track: "LP 계획·실행·피드백까지 추적",
      },
      {
        topic: "성적 분석",
        common: "시험 후 결과 확인",
        track: "유형 분석 후 전략 수정",
      },
      {
        topic: "자습 구조",
        common: "자습 공간 분리 또는 부재",
        track: "스터디카페 중심의 루틴 운영",
      },
    ],
  },
  facility: {
    heading: "몰입을 위한 프리미엄 공간",
    description: "과한 장식보다 학습 효율과 집중 지속성을 우선으로 설계했습니다.",
    gallery: [
      {
        title: "집중 학습 존",
        subtitle: "저소음 · 고집중 환경",
        caption: "장시간 학습에도 흐름이 끊기지 않도록 조용한 환경을 유지합니다.",
      },
      {
        title: "프라이빗 좌석 존",
        subtitle: "개인 몰입 구조",
        caption: "러셀형/독서실형 좌석으로 개인 집중 구간을 안정적으로 확보합니다.",
      },
      {
        title: "상담 · 피드백 존",
        subtitle: "전략 조정 공간",
        caption: "학습 데이터를 바탕으로 다음 전략을 설계하는 상담 공간입니다.",
      },
    ],
  },
  consult: {
    heading: "방문 상담 · 입학 문의",
    description:
      "학생의 현재 상태를 확인한 뒤, 스터디카페 이용 또는 국어 수업 선택을 포함해 가장 적합한 시작 경로를 안내드립니다.",
    contactLine: "상담 문의: 상담 폼 접수 후 순차 연락",
    locationLine: "위치: 경기 용인시 기흥구 동백중앙로 283 B동 906호, 907호",
  },
  footer: {
    line: "트랙은 화려한 문구보다, 학생의 성장 과정과 실제 결과로 신뢰를 증명합니다.",
    phone: "상담 문의: 상담 폼 접수 후 순차 연락",
    location: "경기 용인시 기흥구 동백중앙로 283 B동 906호, 907호",
    hours: "운영 시간: 평일 13:00 - 22:00 / 토요일 10:00 - 18:00",
  },
};
