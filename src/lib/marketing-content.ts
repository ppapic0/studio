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
  tone?: 'navy' | 'orange' | 'green' | 'red';
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
    hoursLine: string;
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
    name: '트랙 국어 학원 · 트랙 관리형 스터디센터',
    slogan: '학생의 성장 궤적을 함께 그립니다',
    heroTitle: '관리형 스터디센터가 중심입니다',
    heroDescription:
      '루틴을 먼저 세우고, 데이터로 확인합니다. 수능 국어 수업은 필요할 때 따로 선택하고, 재학생과 N수생 모두 등록할 수 있습니다.',
    logoFull: '/track-logo-full.png',
    logoMark: '/track-logo-mark.png',
    heroBackground: '',
  },
  nav: [
    { label: '운영 방식', href: '/#features' },
    { label: '웹앱 시스템', href: '/#app' },
    { label: '합격 실적', href: '/#results' },
    { label: '국어 수업', href: '/class' },
    { label: '상담 문의', href: '/#consult' },
  ],
  heroStats: [
    {
      label: '2026 주요 대학 합격',
      value: '고려대 2 · 서강대 1 · 성균관대 1 · 홍익대 1 · 아주대 1',
      detail: '실적으로 증명한 운영 구조',
    },
    {
      label: '센터 이용 구조',
      value: '센터 단독 등록 가능',
      detail: '수업은 필요할 때 별도 선택',
    },
    {
      label: '실시간 운영 데이터',
      value: '출결 · 공부시간 · 실행률 연결',
      detail: '보여주는 관리가 아니라 남는 관리',
    },
  ],
  valueCards: [
    {
      title: '루틴 중심 운영',
      description: '공간 제공보다 루틴 유지가 먼저 보이도록 설계했습니다.',
    },
    {
      title: '수능 국어 전문',
      description: '독서, 평가원, 사설 모의고사 흐름을 그룹 수업으로 정리합니다.',
    },
    {
      title: '학부모 앱 확인',
      description: '출결, 공부시간, 리포트, 수납 상태를 앱에서 바로 확인합니다.',
    },
    {
      title: '데이터 기반 관리',
      description: '계획, 실행, 피드백, 회복 흐름이 숫자로 남는 구조입니다.',
    },
  ],
  director: {
    heading: '원장 소개 · 지도 철학',
    description:
      '개인과외의 밀착 지도 강점을 시스템으로 확장했습니다. 학생별 진단, 빠른 피드백, 장기 루틴 설계를 한 구조 안에 묶었습니다.',
    highlights: [
      '국어국문·교육학 전공 기반 수업 설계',
      '수능 국어 전문 지도와 개인 맞춤 피드백',
      '개인과외 시절 직접 지도 학생 70% 인서울 달성',
      '분당·판교 관리 운영 경험 기반 학습 동선 설계',
      '원장 본인 24학년도 국어 백분위 99 기록',
      '학생·학부모 웹앱을 직접 기획하고 운영하는 구조',
    ],
    materialSamples: [
      {
        title: '학생별 진단 리포트',
        subtitle: '약점 유형부터 시작',
        caption: '무엇이 부족한지 먼저 나누고, 어떤 순서로 메울지 구조화합니다.',
      },
      {
        title: '수업 설계 노트',
        subtitle: '원장 직접 설계',
        caption: '평가원 흐름과 학생별 취약 지점을 함께 반영해 수업을 구성합니다.',
      },
      {
        title: '주간 피드백 보고',
        subtitle: '데이터 기반 조정',
        caption: '이번 주 실행 결과를 다음 주 전략으로 자연스럽게 연결합니다.',
      },
    ],
  },
  outcomes: [
    { label: '고려대학교', value: '2명', detail: '2026학년도 합격' },
    { label: '서강대학교', value: '1명', detail: '2026학년도 합격' },
    { label: '성균관대학교', value: '1명', detail: '2026학년도 합격' },
    { label: '홍익대학교', value: '1명', detail: '2026학년도 합격' },
    { label: '아주대학교', value: '1명', detail: '2026학년도 합격' },
    { label: '성장 사례', value: '백분위 99', detail: '3등급에서 고려대 합격' },
  ],
  successStory: {
    title: '성장 사례',
    summary: '3등급에서 출발해 수능 백분위 99, 고려대학교 합격으로 이어진 실제 사례가 있습니다.',
  },
  classSystem: [
    {
      title: '그룹 수업 운영',
      description: '재학생과 N수생을 대상으로 그룹 수업을 진행하며, 수능 대비 중심으로 학습 흐름을 설계합니다.',
    },
    {
      title: '수능특강 독서 점검',
      description: '수능특강 독서를 포함해 수능 독해 흐름과 연결되는 지문 해석 훈련을 반복합니다.',
    },
    {
      title: '평가원 중심 분석',
      description: '평가원 기출의 논리와 문항 구조를 중심으로 읽기 방식과 풀이 감각을 정리합니다.',
    },
    {
      title: '사설 모의고사 훈련',
      description: '사설 모의고사를 활용해 시간 운영, 실전 집중력, 흔들리는 구간을 점검합니다.',
    },
    {
      title: '실전 피드백',
      description: '시험 결과만 확인하는 것이 아니라, 어떤 이유로 흔들렸는지 분석하고 다음 전략으로 연결합니다.',
    },
  ],
  studyCafe: {
    heading: '관리형 스터디센터가 중심입니다',
    description:
      '입실 기록, 공부시간, 실행 데이터를 확인합니다. 수능 국어 수업은 별도 선택, 재학생과 N수생 모두 등록 가능합니다.',
    features: [
      {
        title: '학습 루틴 완성 중심',
        description: '좌석 제공이 아니라 매일 같은 흐름으로 공부가 이어지도록 설계합니다.',
      },
      {
        title: '별도 선택 가능한 수업 구조',
        description: '관리형 스터디센터만 이용할 수 있고, 국어 입시학원 수업은 필요할 때 별도로 선택할 수 있습니다.',
      },
      {
        title: '실시간 출입·학습 기록',
        description: '출입과 공부시간이 자동으로 쌓여 학생의 루틴과 몰입 흐름을 확인할 수 있습니다.',
      },
      {
        title: '학부모 앱 연동',
        description: '학부모는 앱에서 출결, 학습 현황, 리포트, 결제 상태를 실시간으로 확인할 수 있습니다.',
      },
      {
        title: '상시 모의고사 운영',
        description: '이감 모의고사와 더프 모의고사를 상시 진행하며 실전 감각을 점검합니다.',
      },
    ],
    seatTypes: [
      {
        title: '프리미엄 책상',
        description: '시야 분산을 줄이고 몰입도를 높이도록 설계한 좌석 구조로 장시간 학습에도 안정적으로 집중할 수 있습니다.',
      },
      {
        title: '프라이버시 보호형 좌석',
        description: '개인별 집중 공간을 확보해 외부 자극을 줄이고, 각자의 루틴을 흔들림 없이 이어갈 수 있도록 돕습니다.',
      },
    ],
  },
  appSystem: {
    heading: '학생을 놓치지 않는 전용 웹앱',
    description:
      '학생, 학부모, 관리자 모두가 같은 흐름을 봅니다. 관리 품질을 위해 설계한 전용 웹앱입니다.',
    modes: [
      {
        mode: '학부모 모드',
        description: '과정을 실시간으로 확인하는 앱모드 중심 구조',
        items: ['출결 확인', '학습 현황', '리포트 수신', '성적 추이', '상담/질문'],
      },
      {
        mode: '학생 모드',
        description: '계획부터 실행까지 직접 관리하는 학습 루틴',
        items: ['주간 LP 작성', '오늘의 할 일', '오답 기록', '성장 그래프', '일정 관리'],
      },
      {
        mode: '관리자 모드',
        description: '위험 신호를 놓치지 않는 운영 대시보드',
        items: ['하락 추세 감지', '미제출 확인', '피드백 발송', '상담 이력', '우선 연락 대상 추천'],
      },
    ],
    features: [
      { title: '계획 확인', description: '해야 할 일을 주간 계획 흐름으로 정리합니다.' },
      { title: '기록 캘린더', description: '날짜별 공부시간과 실행 결과를 바로 확인합니다.' },
      { title: '성장 데이터', description: 'LP와 스킬 지표로 학생의 변화가 숫자로 남습니다.' },
      { title: '알림·수납 연동', description: '상담, 리포트, 알림, 수납 상태가 하나의 흐름으로 연결됩니다.' },
    ],
    appScreens: [
      {
        title: '학생 대시보드',
        subtitle: '오늘의 목표와 실행을 한 화면에서',
        caption: '오늘 할 일, 누적 공부시간, LP, 성장 지표가 동시에 보여 학생이 바로 행동할 수 있습니다.',
      },
      {
        title: '학부모 데이터 화면',
        subtitle: '제목 중심 알림 + 학습 캘린더',
        caption: '제목만 먼저 보여주는 알림 구조와 캘린더형 학습 데이터로 과정을 자연스럽게 확인할 수 있습니다.',
      },
      {
        title: '운영 대시보드',
        subtitle: '위험 신호와 우선 대응 대상 확인',
        caption: '하락 추세, 미제출, 상담 요청, 수납 상태까지 연결해 조기 개입이 가능한 구조입니다.',
      },
    ],
    dataMetrics: [
      { label: '시즌 누적 포인트', value: '3,164 LP', detail: '실행 기반 보상 구조', tone: 'orange' },
      { label: '평균 공부 리듬', value: '98.2점', detail: '집중력·꾸준함·목표달성 기반', tone: 'green' },
      { label: '주간 학습 시간', value: '14시간 23분', detail: '기록 캘린더 기준', tone: 'navy' },
      { label: '생활 관리 지수', value: '5점', detail: '벌점과 회복 흐름 동시 관리', tone: 'red' },
    ],
  },
  lpSystem: {
    heading: 'LP 학습 계획 시스템',
    description:
      '계획 · 실행 · 체크 · 피드백 · 개선. 막연한 공부를 행동으로 바꾸는 핵심 루프입니다.',
    cycle: [
      { title: '계획', description: '주간 목표와 일별 실행 항목을 직접 작성합니다.' },
      { title: '실행', description: '매일 실제 수행 여부와 공부시간을 기록합니다.' },
      { title: '체크', description: '달성률과 빈 구간을 데이터로 바로 확인합니다.' },
      { title: '피드백', description: '원장과 관리자가 취약 지점을 기준으로 조정합니다.' },
      { title: '개선', description: '다음 주 계획에 반영해 루틴을 안정화합니다.' },
    ],
    benefits: [
      '막연한 공부가 구체적인 공부로 바뀝니다.',
      '자기관리 습관이 생겨 장기적으로 흔들림이 줄어듭니다.',
      '학부모는 잔소리보다 객관적인 지표로 현재를 확인할 수 있습니다.',
    ],
  },
  comparison: {
    heading: '왜 트랙인가',
    description: '같은 시간이라도 구조가 다르면 결과는 달라집니다. 트랙은 과정이 먼저 보이도록 설계합니다.',
    rows: [
      {
        topic: '운영 중심',
        common: '공간 제공 또는 단순 출결 중심',
        track: '관리형 스터디센터 중심으로 루틴과 데이터까지 운영',
      },
      {
        topic: '학부모 소통',
        common: '정기 상담 시점 중심',
        track: '앱 기반 실시간 확인과 제목형 알림 구조',
      },
      {
        topic: '학습 관리',
        common: '출석 확인에서 끝남',
        track: '계획·실행·피드백·회복 흐름까지 함께 관리',
      },
      {
        topic: '국어 수업',
        common: '진도 중심 수업',
        track: '평가원·수능특강·사설 모의고사 흐름으로 실전 대비',
      },
      {
        topic: '데이터 활용',
        common: '결과 확인 후 대응',
        track: '위험 신호를 먼저 보고 전략을 수정하는 구조',
      },
    ],
  },
  facility: {
    heading: '몰입을 위한 프리미엄 환경',
    description: '사진보다 구조가 먼저 보이도록, 좌석과 동선의 목적을 명확하게 보여줍니다.',
    gallery: [
      {
        title: '집중 학습 구역',
        subtitle: '조용하고 밀도 높은 환경',
        caption: '장시간 공부에도 리듬이 끊기지 않도록 소음과 동선을 함께 설계합니다.',
      },
      {
        title: '개인 몰입 좌석',
        subtitle: '프리미엄 책상 + 프라이버시 보호형 좌석',
        caption: '학생별로 안정적인 몰입을 유지할 수 있는 좌석 구조를 제공합니다.',
      },
      {
        title: '피드백 연결 구역',
        subtitle: '상담과 조정이 이어지는 흐름',
        caption: '공부 결과를 분석하고 다음 주 전략으로 연결하는 운영 동선이 함께 설계됩니다.',
      },
    ],
  },
  consult: {
    heading: '방문 상담 · 입학 문의',
    description:
      '관리형 스터디센터 이용부터 수능 국어 수업 선택 여부까지, 학생 상황에 맞는 시작 경로를 안내합니다.',
    contactLine: '상담 문의: 웹사이트 상담폼 접수 후 순차 연락',
    locationLine: '위치: 경기 용인시 기흥구 동백중앙로 283 B동 906호, 907호',
    hoursLine: '스터디센터 운영: 매일 오전 8:30 ~ 다음날 오전 1:00 · 학원 운영: 매일 오후 10:00 종료',
  },
  footer: {
    line: '트랙은 공간만 제공하지 않습니다. 학생의 현재를 데이터로 보고, 다음 전략까지 함께 설계합니다.',
    phone: '상담 문의: 웹사이트 상담폼 접수 후 순차 연락',
    location: '경기 용인시 기흥구 동백중앙로 283 B동 906호, 907호',
    hours: '운영 시간: 스터디센터 매일 오전 8:30 ~ 다음날 오전 1:00 · 학원 매일 오후 10:00 종료',
  },
};
