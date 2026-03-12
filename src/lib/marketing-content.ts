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
    slogan: "국어 중심 입시학원 + 관리형 스터디카페",
    heroTitle: "성과를 만드는 수업, 몰입을 완성하는 관리",
    heroDescription:
      "원장 직강 국어 수업과 자체 앱 기반 학습·생활 관리를 결합한 프리미엄 학습 운영 시스템입니다. 학생의 공부시간, 루틴, 성장지표, 상담 피드백을 한 흐름으로 연결해 성과를 만듭니다.",
    logoFull: "/track-logo-full.png",
    logoMark: "/track-logo-mark.png",
    heroBackground: "/login-fireworks.png",
  },
  nav: [
    { label: "핵심 가치", href: "#core-value" },
    { label: "원장 소개", href: "#director" },
    { label: "입시 성과", href: "#outcome" },
    { label: "수업 시스템", href: "#class-system" },
    { label: "스터디카페", href: "#study-cafe" },
    { label: "학생 앱", href: "#app-system" },
    { label: "시설", href: "#facility" },
    { label: "상담 문의", href: "#consult" },
  ],
  heroStats: [
    { label: "원장 성과", value: "24학년도 국어 백분위 99", detail: "원장 실전 성과" },
    { label: "개인 지도 경험", value: "국어 과외 40명+", detail: "학생별 맞춤 지도" },
    { label: "26학년도 합격 성과", value: "주요 대학 6명", detail: "고려대·서강대·성균관대 포함" },
  ],
  valueCards: [
    {
      title: "원장 직강",
      description:
        "입시 흐름을 반영한 원장 직강 수업으로 개념 이해부터 실전 적용까지, 성적 상승에 필요한 전 과정을 밀도 있게 설계합니다.",
    },
    {
      title: "직접 제작 자료",
      description:
        "원장이 해설자료와 수업자료를 직접 제작하여 학생별 취약 지점을 정확히 보완합니다. 자료의 완성도가 수업의 차이를 만듭니다.",
    },
    {
      title: "앱 기반 생활관리",
      description:
        "출결, 공부시간, 루틴 이행, 상담 피드백을 앱에서 연동해 관리 공백을 줄입니다. 데이터 기반으로 학습 리듬을 안정화합니다.",
    },
    {
      title: "프리미엄 학습공간",
      description:
        "러셀형 책상과 프라이버시 보호형 독서실 책상을 포함한 몰입 중심 공간으로 장시간 학습의 집중도를 높입니다.",
    },
  ],
  director: {
    heading: "원장 소개",
    description:
      "교육학·국어국문 전공 기반의 수업 설계와 현장 운영 경험을 갖춘 원장이 직접 수업합니다. 학생별 이해도와 취약 단원을 세밀하게 분석하고, 맞춤 자료와 피드백으로 실제 성적 향상을 만들어냅니다.",
    highlights: [
      "교육학·국어국문 전공 기반 커리큘럼 설계",
      "원장 본인 24학년도 국어 백분위 99",
      "분당·판교 관리형 독서실 원장 운영 경험",
      "국어 개인과외 40명 이상 지도",
      "해설자료·수업자료 직접 제작 및 개별 피드백",
    ],
    materialSamples: [
      {
        title: "수능 국어 해설 자료",
        subtitle: "문항별 사고 과정 정리",
        caption: "실제 수업에 사용하는 해설 중심 자료를 바탕으로 오답 원인을 구조적으로 교정합니다.",
      },
      {
        title: "학생별 맞춤 수업 노트",
        subtitle: "취약 개념 집중 보완",
        caption: "학생의 오답 패턴과 학습 습관을 반영해 개별 복습 흐름을 설계합니다.",
      },
      {
        title: "주간 학습 리포트",
        subtitle: "학부모 공유형 피드백",
        caption: "학습량·리듬·상담 이슈를 한 번에 정리해 학부모와 학습 방향을 명확히 공유합니다.",
      },
    ],
  },
  outcomes: [
    { label: "26학년도 수능", value: "국어 백분위 99", detail: "상위권 성과" },
    { label: "고려대학교", value: "2명", detail: "합격" },
    { label: "서강대학교", value: "1명", detail: "합격" },
    { label: "성균관대학교", value: "1명", detail: "합격" },
    { label: "아주대학교", value: "1명", detail: "합격" },
    { label: "홍익대학교", value: "1명", detail: "합격" },
  ],
  classSystem: [
    {
      title: "진단",
      description:
        "현재 국어 성취도와 학습 습관을 진단해 학생별 우선 개선 지점을 명확히 설정합니다.",
    },
    {
      title: "원장 직강 수업",
      description:
        "개념과 독해 사고 과정을 연결하는 수업으로, 실전 적용력을 빠르게 끌어올립니다.",
    },
    {
      title: "직접 제작 자료 제공",
      description:
        "수업 직후 복습자료와 해설자료를 제공하여 개념 정착과 오답 교정을 동시에 진행합니다.",
    },
    {
      title: "복습 및 피드백",
      description:
        "오답 유형과 이해도 변화를 추적해 다음 수업에 반영하고, 개선 포인트를 구체적으로 안내합니다.",
    },
    {
      title: "학습·생활 관리 연동",
      description:
        "출결, 공부 기록, 생활 지표를 앱에서 연동해 성적 향상 흐름이 끊기지 않도록 관리합니다.",
    },
  ],
  studyCafe: {
    heading: "관리형 스터디카페",
    description:
      "학원 수업과 분리되지 않는 운영 구조로 공부 시간과 생활 리듬을 함께 관리합니다. 단순 좌석 제공이 아니라, 성과를 위한 학습 운영 환경을 제공합니다.",
    features: [
      {
        title: "자체 앱 기반 관리",
        description:
          "학생의 학습 시간과 출결 데이터를 실시간으로 연결해 학습 흐름의 이탈을 빠르게 조정합니다.",
      },
      {
        title: "생활지도 연계",
        description:
          "지각·결석·루틴 이행 상태를 관리하고 필요 시 상담 및 피드백을 즉시 연동합니다.",
      },
      {
        title: "학습 운영 중심 시스템",
        description:
          "학원 수업-자습-피드백이 하나로 이어지는 운영으로, 성적 상승의 재현성을 높입니다.",
      },
    ],
    seatTypes: [
      {
        title: "러셀형 책상",
        description:
          "시야 분산을 줄여 집중 시간을 안정적으로 확보하도록 설계한 몰입형 좌석입니다.",
      },
      {
        title: "프라이버시 보호형 독서실 책상",
        description:
          "개인 학습 공간을 보장해 장시간 학습에서도 안정감과 몰입도를 유지합니다.",
      },
    ],
  },
  appSystem: {
    heading: "데이터로 관리되는 학생 앱 시스템",
    description:
      "출결, 공부시간, 루틴, 성장 지표, 상담 이력까지 데이터로 연결됩니다. 학생·학부모·센터가 같은 기준으로 학습 상태를 확인하고 빠르게 대응할 수 있습니다.",
    features: [
      {
        title: "학습 계획 확인",
        description: "오늘 목표와 루틴을 확인하고 실행 흐름을 정리합니다.",
      },
      {
        title: "기록트랙 캘린더",
        description: "날짜별 공부시간과 학습 이력을 캘린더로 조회합니다.",
      },
      {
        title: "성장·스킬 데이터",
        description: "LP, 스킬트랙 점수, 벌점 지수를 한 화면에서 확인합니다.",
      },
      {
        title: "상담/요청 연동",
        description: "상담 예약과 요청 내역이 앱에서 바로 연결됩니다.",
      },
    ],
    appScreens: [
      {
        title: "학생 홈 대시보드",
        subtitle: "학습량 · LP · 계획트랙 통합 확인",
        caption: "학생이 당일 학습 상태를 한 화면에서 점검하고 즉시 행동할 수 있도록 구성했습니다.",
        image: "/marketing/app-screens/dashboard.png",
      },
      {
        title: "성장트랙 스킬 분석",
        subtitle: "집중력 · 꾸준함 · 목표달성 지표",
        caption: "스킬트랙 점수와 시즌 지표를 데이터로 보여주어 학습 피드백의 기준을 명확히 제공합니다.",
        image: "/marketing/app-screens/growth.png",
      },
      {
        title: "운영자 데이터 관찰 화면",
        subtitle: "실시간 학습 운영 모니터링",
        caption: "센터가 학생 상태를 빠르게 파악하고 관리 개입 시점을 놓치지 않도록 운영 화면을 제공합니다.",
        image: "/marketing/app-screens/dashboard.png",
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
    description:
      "조용하고 정돈된 공간, 프라이버시를 고려한 좌석 구성, 장시간 학습에 적합한 동선으로 학습 효율을 높입니다.",
    gallery: [
      {
        title: "집중 학습 존",
        subtitle: "저소음 · 고집중 환경",
        caption: "실제 공간 사진으로 교체 가능한 갤러리 영역입니다.",
      },
      {
        title: "프라이빗 좌석 존",
        subtitle: "개인 몰입 공간",
        caption: "러셀형/독서실형 좌석 구조를 시각적으로 소개합니다.",
      },
      {
        title: "상담 · 코칭 공간",
        subtitle: "피드백 중심 상담",
        caption: "학생/학부모 상담과 피드백을 위한 전용 공간입니다.",
      },
    ],
  },
  consult: {
    heading: "입학 상담 및 방문 예약",
    description:
      "학습 진단부터 프로그램 안내, 시설 투어까지 상담에서 한 번에 안내드립니다. 학생의 현재 상태를 기준으로 맞춤 학습 운영 방향을 제안합니다.",
    contactLine: "상담 문의: 상담 폼 접수 후 순차 연락",
    locationLine: "위치: 경기 용인시 기흥구 동백중앙로 283 B동 906호, 907호",
  },
  footer: {
    line: "성과를 만드는 수업, 몰입을 완성하는 관리 시스템",
    phone: "상담 문의: 상담 폼 접수 후 순차 연락",
    location: "경기 용인시 기흥구 동백중앙로 283 B동 906호, 907호",
    hours: "운영 시간: 평일 13:00 - 22:00 / 토요일 10:00 - 18:00",
  },
};
