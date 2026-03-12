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
      "원장 직강 국어 수업과 자체 앱 기반 학습·생활관리 시스템이 연결된 프리미엄 학습 운영 브랜드입니다. 단순한 공간이 아니라, 상위권을 만드는 관리 구조를 제공합니다.",
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
    { label: "학생용 앱", href: "#app-system" },
    { label: "시설", href: "#facility" },
    { label: "상담 문의", href: "#consult" },
  ],
  heroStats: [
    { label: "원장 실전 성과", value: "24 불수능 언매 99", detail: "수능 백분위" },
    { label: "개인 지도 경험", value: "40명+", detail: "국어 과외 지도" },
    { label: "26학년도 합격", value: "6개 대학", detail: "주요 대학 실적" },
  ],
  valueCards: [
    {
      title: "원장 직강",
      description:
        "입시 흐름을 반영한 원장 직강 수업으로 개념 이해부터 실전 대응까지 흐름을 끊기지 않게 설계합니다.",
    },
    {
      title: "직접 제작 자료",
      description:
        "원장이 해설자료와 수업자료를 직접 제작하여 학생별 취약지점을 정확하게 교정합니다.",
    },
    {
      title: "앱 기반 생활관리",
      description:
        "출결, 공부 기록, 생활 피드백이 앱에서 연결되어 관리의 빈틈을 줄입니다.",
    },
    {
      title: "프리미엄 학습공간",
      description:
        "러셀형 책상과 프라이버시 보호형 좌석으로 장시간 집중에 최적화된 환경을 제공합니다.",
    },
  ],
  director: {
    heading: "왜 트랙의 국어 수업이 다른가",
    description:
      "원장은 수능 언어와매체 기준 24학년도 불수능에서 백분위 99를 기록했고, 분당·판교 지역 관리형 독서실 운영 경험과 40명 이상의 국어 개인 지도 경험을 바탕으로 학생별 맞춤 수업을 설계합니다.",
    highlights: [
      "원장 본인 24학년도 불수능 언어와매체 백분위 99",
      "분당·판교 지역 관리형 독서실 원장 경력",
      "국어 개인과외 40명 이상 지도",
      "해설자료·수업자료 직접 제작 및 학생별 최적화",
    ],
    materialSamples: [
      {
        title: "수능 국어 해설 자료",
        subtitle: "문항별 사고 과정 정리",
        caption: "실제 수업용 이미지/PDF 업로드 시 이 카드에 바로 교체됩니다.",
      },
      {
        title: "개념-문항 연결 노트",
        subtitle: "학생별 약점 교정",
        caption: "취약 유형별 맞춤형 자료를 학생별 버전으로 제작합니다.",
      },
      {
        title: "주간 피드백 리포트",
        subtitle: "학부모 공유형 운영",
        caption: "수업 진도, 복습 상태, 생활관리 코멘트를 함께 전달합니다.",
      },
    ],
  },
  outcomes: [
    { label: "26학년도 수능", value: "국어 백분위 99", detail: "상위권 결과" },
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
        "현재 국어 성취도와 학습 습관을 진단해 학생별 우선 개선 지점을 정확히 설정합니다.",
    },
    {
      title: "원장 직강 수업",
      description:
        "핵심 개념과 평가원식 사고 과정을 연결해 문제 해결 능력을 끌어올립니다.",
    },
    {
      title: "직접 제작 자료 제공",
      description:
        "수업 직후 복습자료와 해설자료를 제공해 개념 정착과 오답 교정을 동시에 진행합니다.",
    },
    {
      title: "밀도 높은 복습",
      description:
        "오답 패턴과 이해도 변화를 추적하고 다음 수업에 즉시 반영합니다.",
    },
    {
      title: "학습·생활 관리 연동",
      description:
        "출결, 공부시간, 생활 피드백을 앱으로 연동해 성과가 유지되도록 관리합니다.",
    },
  ],
  studyCafe: {
    heading: "관리형 스터디카페",
    description:
      "학원 수업과 자습 운영이 분리되지 않는 구조로 공부시간, 생활리듬, 피드백까지 하나의 흐름으로 관리합니다.",
    features: [
      {
        title: "자체 앱 기반 출결/학습 관리",
        description:
          "실시간 데이터로 학습 흐름을 점검하고 관리 우선순위를 빠르게 조정합니다.",
      },
      {
        title: "생활지도 연계 운영",
        description:
          "출결 이슈, 루틴 이행, 상담 기록이 분리되지 않고 하나의 시스템에서 연결됩니다.",
      },
      {
        title: "성과 중심 운영",
        description:
          "수업-자습-리포트가 끊김 없이 이어져 성적 향상을 위한 실행력을 높입니다.",
      },
    ],
    seatTypes: [
      {
        title: "러셀형 책상",
        description:
          "시야 분산을 최소화해 몰입 시간을 안정적으로 확보할 수 있는 구조입니다.",
      },
      {
        title: "사생활 보호형 독서실 책상",
        description:
          "개인 집중 공간을 확보해 학습 피로를 낮추고 집중 밀도를 높입니다.",
      },
    ],
  },
  appSystem: {
    heading: "학생용 앱으로 완성되는 정교한 관리",
    description:
      "단순 출결 앱이 아닌 학습 계획, 공부 기록, 생활 피드백을 통합하는 운영 시스템입니다.",
    features: [
      {
        title: "학습 계획 확인",
        description: "오늘의 계획과 실행 우선순위를 명확히 확인합니다.",
      },
      {
        title: "공부 기록 관리",
        description: "날짜별·과목별 공부 흐름을 시각적으로 점검합니다.",
      },
      {
        title: "출결/등하원 관리",
        description: "출결 상태와 루틴 이행 상태를 실시간으로 관리합니다.",
      },
      {
        title: "생활 피드백 연동",
        description: "선생님 피드백과 생활지도를 앱에서 즉시 확인합니다.",
      },
    ],
    appScreens: [
      {
        title: "오늘의 학습 대시보드",
        subtitle: "계획·기록·리듬 점검",
        caption: "학생의 일일 학습 흐름을 한 화면에서 확인",
      },
      {
        title: "학습 기록 캘린더",
        subtitle: "날짜별 공부시간",
        caption: "공부시간과 학습 내용을 날짜 단위로 조회",
      },
      {
        title: "관리 피드백 화면",
        subtitle: "출결·생활·코칭 연동",
        caption: "학습·생활 피드백을 연결해 즉시 반영",
      },
    ],
  },
  facility: {
    heading: "몰입에 최적화된 프리미엄 시설",
    description:
      "조용하고 정돈된 분위기, 프라이버시 보장 좌석, 장시간 학습을 고려한 설계로 학습 효율을 높입니다.",
    gallery: [
      {
        title: "집중형 학습존",
        subtitle: "고밀도 몰입 환경",
        caption: "실제 공간 사진 교체 영역",
      },
      {
        title: "프라이버시 좌석존",
        subtitle: "개인 공간 보장",
        caption: "좌석 디테일 사진 교체 영역",
      },
      {
        title: "상담/코칭 공간",
        subtitle: "1:1 진단 및 피드백",
        caption: "상담 공간 사진 교체 영역",
      },
    ],
  },
  consult: {
    heading: "입학 상담 및 방문 예약",
    description:
      "학생 현재 상태를 진단하고, 수업·자습·관리 전략을 함께 제안드립니다. 상담 폼으로 접수하시면 순차적으로 연락드립니다.",
    contactLine: "상담 문의: 상담 폼 접수 후 순차 연락",
    locationLine: "위치: 경기 용인시 기흥구 동백중앙로 283 B동 906호, 907호",
  },
  footer: {
    line: "성과를 만드는 수업, 몰입을 완성하는 관리 시스템",
    phone: "대표 문의: 상담 폼 접수 후 순차 연락",
    location: "경기 용인시 기흥구 동백중앙로 283 B동 906호, 907호",
    hours: "운영 시간 평일 13:00 - 22:00 / 토요일 10:00 - 18:00",
  },
};
