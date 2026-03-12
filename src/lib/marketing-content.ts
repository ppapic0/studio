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
    heroTitle: "국어 실력과 학습 관리, 두 가지를 모두 잡는 공간",
    heroDescription:
      "원장 직강 국어 수업과 자체 앱 기반 관리 시스템을 결합해 성과를 만드는 학습 루틴을 설계합니다. 수업, 생활지도, 학습환경까지 하나의 체계로 연결되는 프리미엄 교육 브랜드입니다.",
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
    { label: "수능 성과", value: "백분위 99", detail: "26학년도 국어" },
    { label: "개인 지도 경험", value: "40명+", detail: "국어 과외 지도" },
    { label: "주요 대학 합격", value: "6개 대학", detail: "26학년도 실적" },
  ],
  valueCards: [
    {
      title: "원장 직강",
      description:
        "입시 흐름을 반영한 원장 직강 수업으로 개념 이해부터 실전 문제 대응까지 밀도 있게 연결합니다.",
    },
    {
      title: "직접 제작 자료",
      description:
        "원장이 직접 해설자료와 수업자료를 제작해 학생별 취약 포인트를 정교하게 보완합니다.",
    },
    {
      title: "앱 기반 생활관리",
      description:
        "자체 개발 앱으로 출결, 학습 기록, 생활 피드백을 연동해 학습 루틴의 흔들림을 줄입니다.",
    },
    {
      title: "프리미엄 학습공간",
      description:
        "러셀형 책상과 프라이버시 보호형 좌석으로 장시간 몰입에 최적화된 학습 환경을 제공합니다.",
    },
  ],
  director: {
    heading: "왜 이 수업이 다른가",
    description:
      "분당·판교 관리형 독서실 운영 경험과 40명 이상의 국어 개인 지도 경험을 바탕으로, 학생마다 다른 이해도와 약점을 수업과 자료로 동시에 교정합니다. 모든 해설자료와 수업자료는 원장이 직접 제작합니다.",
    highlights: [
      "분당·판교 지역 관리형 독서실 원장 경력",
      "국어 개인과외 40명 이상 지도",
      "원장 직강 수업 중심 커리큘럼 운영",
      "학생별 맞춤 해설자료·복습자료 직접 제작",
    ],
    materialSamples: [
      {
        title: "수능 국어 해설 자료",
        subtitle: "문항별 사고 과정 정리",
        caption: "실제 수업용 PDF/이미지 업로드 시 카드 썸네일로 교체 가능합니다.",
      },
      {
        title: "개념-문항 연결 노트",
        subtitle: "오답 원인 교정형 자료",
        caption: "취약 유형별 보완 자료를 학생별 버전으로 관리합니다.",
      },
      {
        title: "주간 피드백 리포트",
        subtitle: "학부모 공유형 리포트",
        caption: "학습 진행도와 생활관리 이슈를 함께 정리해 전달합니다.",
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
        "현재 국어 성취도와 학습 습관을 진단해 학생별 우선 개선 지점을 명확히 설정합니다.",
    },
    {
      title: "원장 직강 수업",
      description:
        "핵심 개념과 평가원식 사고 과정을 연결한 수업으로 실전 적용력을 높입니다.",
    },
    {
      title: "직접 제작 자료 제공",
      description:
        "수업 직후 복습용 자료와 해설자료를 제공해 개념 정착과 오답 교정을 동시에 진행합니다.",
    },
    {
      title: "복습 및 피드백",
      description:
        "오답 패턴과 이해도 변화를 추적해 다음 수업에 반영하는 밀도 높은 피드백을 제공합니다.",
    },
    {
      title: "학습·생활 관리 연동",
      description:
        "출결, 학습 기록, 생활 지도를 앱으로 연동해 성적 향상 흐름이 끊기지 않도록 관리합니다.",
    },
  ],
  studyCafe: {
    heading: "관리형 스터디카페",
    description:
      "학원 수업과 분리되지 않는 운영 구조로 공부 시간과 생활 리듬을 함께 관리합니다. 단순한 좌석 제공이 아닌, 성과를 위한 학습 운영 환경을 제공합니다.",
    features: [
      {
        title: "자체 앱 기반 관리",
        description:
          "학생의 공부 기록과 출결 데이터를 실시간으로 연결해 학습 흐름을 빠르게 점검합니다.",
      },
      {
        title: "생활지도 연계",
        description:
          "지각·결석·루틴 이행 상태를 관리하고 필요한 상담과 피드백을 바로 연동합니다.",
      },
      {
        title: "학습 운영 중심 시스템",
        description:
          "학원 수업-자습-피드백이 하나로 이어지는 운영으로 성적 상승의 재현성을 높입니다.",
      },
    ],
    seatTypes: [
      {
        title: "러셀형 책상",
        description:
          "시야 분산을 줄이고 집중 시간을 안정적으로 확보할 수 있도록 설계된 좌석입니다.",
      },
      {
        title: "사생활 보호형 독서실 책상",
        description:
          "개인 학습 공간을 확보해 심리적 안정감과 몰입도를 동시에 높여줍니다.",
      },
    ],
  },
  appSystem: {
    heading: "학생용 앱으로 완성되는 학습 관리",
    description:
      "단순 출결 앱이 아니라, 학생의 학습 계획·기록·생활지도를 연결하는 운영 시스템입니다. 학생, 선생님, 학부모가 같은 기준으로 학습 흐름을 확인할 수 있습니다.",
    features: [
      {
        title: "학습 계획 확인",
        description: "오늘의 학습 계획과 우선순위를 확인하고 실행 흐름을 정리합니다.",
      },
      {
        title: "공부 기록",
        description: "일자별 공부시간과 과목별 집중 데이터를 시각적으로 관리합니다.",
      },
      {
        title: "출결/등하원 관리",
        description: "등원 현황과 출결 상태를 기록해 학습 리듬을 안정적으로 유지합니다.",
      },
      {
        title: "생활 피드백",
        description: "규정 안내, 생활 지도, 코칭 피드백이 학습 데이터와 함께 연동됩니다.",
      },
    ],
    appScreens: [
      {
        title: "오늘의 학습 대시보드",
        subtitle: "계획·기록·리듬 점검",
        caption: "학생이 매일 확인하는 핵심 화면 예시",
      },
      {
        title: "학습 기록 캘린더",
        subtitle: "날짜별 공부시간 확인",
        caption: "공부 흐름을 캘린더/그래프로 직관적으로 확인",
      },
      {
        title: "관리 피드백 화면",
        subtitle: "출결·생활·코칭 연동",
        caption: "선생님 피드백과 생활지도를 한 번에 확인",
      },
    ],
  },
  facility: {
    heading: "몰입에 최적화된 프리미엄 시설",
    description:
      "조용하고 정돈된 공간, 프라이버시가 보장되는 좌석, 장시간 학습에도 피로를 줄이는 설계까지 학습 성과에 필요한 환경 요소를 기준으로 구성했습니다.",
    gallery: [
      {
        title: "집중형 학습존",
        subtitle: "저소음·고집중 환경",
        caption: "실제 공간 사진 교체 영역",
      },
      {
        title: "프라이버시 좌석존",
        subtitle: "개인 몰입 공간",
        caption: "좌석 디테일 사진 교체 영역",
      },
      {
        title: "상담/코칭 공간",
        subtitle: "학습 진단 및 상담",
        caption: "상담 공간 사진 교체 영역",
      },
    ],
  },
  consult: {
    heading: "입학 상담 및 방문 예약",
    description:
      "학습 진단부터 프로그램 안내, 시설 투어까지 상담에서 한 번에 확인하실 수 있습니다. 학생 현재 상태를 기반으로 맞춤 학습 운영 방향을 제안해드립니다.",
    contactLine: "상담 문의: 아래 상담 폼에 연락처를 남겨주세요.",
    locationLine: "위치: 경기 용인시 기흥구 동백중앙로 283 B동 906호, 907호",
  },
  footer: {
    line: "성과를 만드는 수업, 몰입을 완성하는 관리 시스템",
    phone: "대표 문의: 상담 폼 접수 후 순차 연락",
    location: "경기 용인시 기흥구 동백중앙로 283 B동 906호, 907호",
    hours: "운영 시간 평일 13:00 - 22:00 / 토요일 10:00 - 18:00",
  },
};
