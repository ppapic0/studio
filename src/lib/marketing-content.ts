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

export type AppScreenPreview = {
  mode: string;
  title: string;
  summary: string;
  highlights: string[];
  frame: 'desktop' | 'phone';
  featured: boolean;
  image?: string;
};

export type WebAppShowcaseScreen = {
  mode: string;
  title: string;
  summary: string;
  highlights: string[];
  image?: string;
  alt: string;
};

export type ExperienceShowcaseFrame = {
  title: string;
  caption: string;
  image?: string;
  alt: string;
};

export type ExperienceShowcaseSection = {
  mode: string;
  title: string;
  summary: string;
  highlights: string[];
  primaryScreen: ExperienceShowcaseFrame;
  secondaryScreens: ExperienceShowcaseFrame[];
  insightTitle: string;
  insightDescription: string;
  ctaHref: string;
  ctaLabel: string;
};

export type AppDataStory = {
  eyebrow: string;
  title: string;
  description: string;
  proofNotes: string[];
};

export type AppExperienceGuide = {
  mode: string;
  headline: string;
  summary: string;
  checkpoints: string[];
  href: string;
  label: string;
};

export type AppEvidenceCapture = {
  mode: string;
  title: string;
  description: string;
  image: string;
  proofType: 'actual' | 'reconstructed';
  callout: string;
  href: string;
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

export type MarketingLaunchNotice = {
  enabled: boolean;
  eyebrow: string;
  title: string;
  description: string;
  note: string;
  primaryLabel: string;
  secondaryLabel: string;
};

export type CenterEnvironmentPhoto = {
  title: string;
  summary: string;
  image?: string;
  alt: string;
};

export type MockExamProgramCard = {
  title: string;
  summary: string;
};

export type MobileStudySystemSection = {
  title: string;
  body: string;
  secondaryBody?: string;
  href?: string;
  image?: string;
  alt?: string;
  tone: 'navy' | 'slate' | 'orange' | 'violet';
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
  launchNotice: MarketingLaunchNotice;
  nav: MarketingNavItem[];
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
    timeline: Array<{
      label: string;
      value: string;
      detail: string;
    }>;
  };
  classSystem: ProgramStep[];
  studyCafe: {
    heading: string;
    description: string;
    features: MarketingCard[];
    seatTypes: MarketingCard[];
  };
  webAppShowcase: {
    heading: string;
    description: string;
    screens: WebAppShowcaseScreen[];
  };
  experienceShowcase: {
    heading: string;
    description: string;
    sections: ExperienceShowcaseSection[];
    footerNote: string;
    closingTitle: string;
    closingDescription: string;
    closingHref: string;
    closingLabel: string;
  };
  appSystem: {
    heading: string;
    description: string;
    appScreens: AppScreenPreview[];
    dataStory: AppDataStory;
    guides: AppExperienceGuide[];
    captures: AppEvidenceCapture[];
    trustMetrics: AppDataMetric[];
  };
  centerEnvironment: {
    eyebrow: string;
    title: string;
    description: string;
    highlights: string[];
    photos: CenterEnvironmentPhoto[];
  };
  mockExamProgram: {
    eyebrow: string;
    title: string;
    description: string;
    highlights: string[];
    programs: MockExamProgramCard[];
  };
  mobileStudySystem: {
    intro: {
      eyebrow: string;
      title: string;
      description: string;
    };
    sections: MobileStudySystemSection[];
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
    name: '트랙 관리형 스터디센터 · 트랙 국어학원',
    slogan: '학생의 성장 궤적을 함께 그립니다',
    heroTitle: '공부는 방향이 중요합니다.\n성장의 길,\n트랙에서\n시작됩니다.',
    heroDescription:
      '빈틈없는 관리시스템으로 <br> 스스로 공부하는 습관을 형성합니다.',
    logoFull: '/track-logo-full.png',
    logoMark: '/track-logo-mark.png',
    heroBackground: '',
  },
  launchNotice: {
    enabled: true,
    eyebrow: 'OPENING NOTICE',
    title: '트랙은 4월 말 오픈 예정입니다',
    description:
      '현재 웹페이지와 앱은 계속 수정 중입니다. 보시는 데 큰 차질이 없도록 순차적으로 반영하고 있으며, 일부 화면과 문구는 계속 변경될 수 있습니다.',
    note: '정식 오픈 전까지 실제 운영 흐름에 맞춰 계속 다듬고 있습니다.',
    primaryLabel: '확인했습니다',
    secondaryLabel: '오늘 하루 보지 않기',
  },
  nav: [
    { label: '센터 소개', href: '/center' },
    { label: '트랙 시스템', href: '/experience' },
    { label: '합격 실적', href: '/results' },
    { label: '국어 수업', href: '/class' },
    { label: '상담 문의', href: '/#consult' },
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
      '분당, 판교 관리형 독서실 운영 경험 기반 학습 동선 설계',
      '원장 본인 24학년도 국어 백분위 99 기록',
      '웹앱을 자체 개발하고 기획하여 운영하는 구조',
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
    title: '성적 상승 케이스',
    summary: '3등급에서 수능 백분위 99까지 올린 케이스',
    timeline: [
      { label: '6모', value: '3등급', detail: '백분위 82' },
      { label: '9모', value: '1등급', detail: '백분위 96' },
      { label: '수능', value: '백분위 99', detail: '고려대 합격' },
    ],
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
  webAppShowcase: {
    heading: '실제 화면으로 보는 트랙 웹앱',
    description:
      '학생과 학부모가 실제로 어떤 화면으로 관리되는지 먼저 보여드립니다.',
    screens: [
      {
        mode: '학생 모드',
        title: '학생은 오늘 해야 할 일과 루틴을 한 화면에서 확인합니다',
        summary:
          '막연하게 공부를 시작하지 않도록, 오늘 할 일과 공부시간, 피드백을 한 흐름으로 보여주는 학생용 화면입니다. 확인하고 끝나는 것이 아니라 바로 다음 행동으로 이어지게 설계했습니다.',
        highlights: ['오늘 할 일', '루틴 확인', '공부시간', '피드백 반영'],
        alt: '학생 모드 실제 스크린샷 예정 자리',
      },
      {
        mode: '학부모 모드',
        title: '학부모는 출결과 공부 흐름을 빠르게 확인합니다',
        summary:
          '출결, 공부시간, 리포트가 따로 놀지 않도록 한 화면 흐름으로 보여주는 학부모용 화면입니다. 짧은 시간 안에도 학생의 현재 상태와 변화 방향을 파악할 수 있게 설계했습니다.',
        highlights: ['출결 상태', '공부시간', '리포트 확인', '상담 연결'],
        alt: '학부모 모드 실제 스크린샷 예정 자리',
      },
    ],
  },
  experienceShowcase: {
    heading: '트랙이 자체 개발한 웹앱으로 학습 효율과 흥미를 함께 높입니다',
    description:
      '학생은 더 분명하게 실행하고, 학부모는 더 빠르게 흐름을 확인할 수 있도록 트랙에서 직접 설계한 웹앱입니다.',
    sections: [
      {
        mode: '학생 모드',
        title: '학생은 오늘 해야 할 일과 공부 흐름을 한 화면에서 확인합니다',
        summary:
          '오늘 할 일, 루틴, 공부시간, 피드백이 한 흐름으로 연결되어 다음 행동으로 바로 이어지는 학생용 화면입니다. 확인만 하고 끝나는 것이 아니라, 바로 실행으로 이어지도록 설계했습니다.',
        highlights: ['오늘 할 일', '루틴 확인', '공부시간', '피드백 반영'],
        primaryScreen: {
          title: '학생 모드 대표화면',
          caption: '오늘 해야 할 일과 루틴, 공부 흐름을 가장 먼저 읽는 대표 화면입니다.',
          alt: '학생 모드 대표 스크린샷 예정 자리',
        },
        secondaryScreens: [
          {
            title: '오늘 할 일 · 루틴 화면',
            caption: '막연하게 시작하지 않도록 오늘 할 일과 루틴을 바로 확인하는 화면입니다.',
            alt: '학생 모드 오늘 할 일과 루틴 스크린샷 예정 자리',
          },
          {
            title: '공부시간 · 피드백 화면',
            caption: '공부시간 기록과 피드백이 다음 행동으로 이어지도록 정리한 화면입니다.',
            alt: '학생 모드 공부시간과 피드백 스크린샷 예정 자리',
          },
        ],
        insightTitle: '학생 화면은 다음 행동이 보여야 합니다',
        insightDescription:
          '학생에게는 많은 정보보다 지금 무엇을 해야 하는지가 먼저 보여야 합니다. 트랙 학생 화면은 확인보다 실행이 앞서도록 구조를 잡습니다.',
        ctaHref: '/go/login?placement=experience_student',
        ctaLabel: '학생 로그인 보기',
      },
      {
        mode: '학부모 모드',
        title: '학부모는 출결과 공부 흐름을 빠르게 확인합니다',
        summary:
          '출결, 공부시간, 리포트, 변화 흐름을 짧은 시간 안에 읽고 현재 상태를 파악하는 학부모용 화면입니다. 길게 탐색하지 않아도 지금의 상태와 방향이 먼저 보이도록 설계했습니다.',
        highlights: ['출결 상태', '공부시간', '리포트 확인', '상담 연결'],
        primaryScreen: {
          title: '학부모 모드 대표화면',
          caption: '출결과 공부 흐름, 리포트를 빠르게 읽는 대표 화면입니다.',
          alt: '학부모 모드 대표 스크린샷 예정 자리',
        },
        secondaryScreens: [
          {
            title: '출결 · 공부시간 화면',
            caption: '학생의 현재 상태와 누적 공부 흐름을 먼저 확인하는 화면입니다.',
            alt: '학부모 모드 출결과 공부시간 스크린샷 예정 자리',
          },
          {
            title: '리포트 · 상담 화면',
            caption: '리포트와 상담 흐름을 같은 맥락에서 확인하도록 정리한 화면입니다.',
            alt: '학부모 모드 리포트와 상담 스크린샷 예정 자리',
          },
        ],
        insightTitle: '학부모 화면은 빠른 확인이 먼저입니다',
        insightDescription:
          '학부모에게는 깊은 탐색보다 현재 상태를 짧은 시간 안에 읽을 수 있는 구조가 더 중요합니다. 출결, 공부 흐름, 리포트를 같은 문맥으로 연결해 보여줍니다.',
        ctaHref: '/go/login?placement=experience_parent',
        ctaLabel: '학부모 로그인 보기',
      },
    ],
    footerNote: '실제 스크린샷은 순차 반영 예정입니다.',
    closingTitle: '트랙은 실제 데이터로 엄밀하게 관리합니다.',
    closingDescription:
      '스크린샷이 반영되면 학생과 학부모가 어떤 구조로 관리되는지 더 선명하게 확인할 수 있습니다.',
    closingHref: '/#consult',
    closingLabel: '상담 문의하기',
  },
  appSystem: {
    heading: '우리는 실제 이렇게 관리합니다',
    description: '학생, 학부모, 센터관리자가 각각 어떤 화면으로 관리되는지 대표 화면부터 보여드립니다.',
    appScreens: [
      {
        mode: '센터관리자',
        title: '센터관리자 대시보드 대표화면',
        summary: '위험 신호 · 미제출 · 개입 우선순위',
        highlights: ['위험 신호', '미제출', '개입 우선순위'],
        frame: 'desktop',
        featured: true,
      },
      {
        mode: '학부모 모드',
        title: '학부모 모드 대표화면',
        summary: '출결 · 공부시간 · 리포트 확인',
        highlights: ['출결 상태', '공부시간', '리포트 확인'],
        frame: 'phone',
        featured: false,
      },
      {
        mode: '학생 모드',
        title: '학생 모드 대표화면',
        summary: '루틴 · 오늘 할 일 · 피드백 확인',
        highlights: ['오늘 루틴', '오늘 할 일', '피드백 확인'],
        frame: 'phone',
        featured: false,
      },
    ],
    dataStory: {
      eyebrow: 'DATA OPERATING SYSTEM',
      title: '출결만 확인하지 않고 변화의 방향까지 읽습니다',
      description:
        '공부시간, 목표 달성률, 루틴 안정성, 위험 신호, 시험 결과를 하나의 흐름으로 연결해 보여주는 구조입니다.',
      proofNotes: [
        '실시간 운영 데이터가 매일 누적됩니다.',
        '하락 추세가 보이면 먼저 개입할 수 있습니다.',
        '결과 데이터까지 남아 성장 증명으로 이어집니다.',
      ],
    },
    guides: [
      {
        mode: '학생 모드',
        headline: '학생은 오늘 해야 할 행동부터 바로 확인합니다',
        summary: '루틴, 누적 공부시간, 피드백을 한 화면에서 읽고 바로 다음 행동으로 이어가는 학생용 흐름입니다.',
        checkpoints: ['오늘 루틴', '누적 공부시간', '피드백 반영', '다음 행동'],
        href: '/go/experience?placement=app_preview_student',
        label: '학생 모드 체험',
      },
      {
        mode: '학부모 모드',
        headline: '학부모는 현재 상태와 흔들리는 구간을 먼저 읽습니다',
        summary: '출결, 주간 흐름, 날짜별 기록, 리포트를 같은 문맥으로 확인하는 학부모용 흐름입니다.',
        checkpoints: ['실시간 상태', '주간 흐름', '날짜별 기록', '리포트 확인'],
        href: '/go/experience?placement=app_preview_parent',
        label: '학부모 모드 체험',
      },
      {
        mode: '운영자 모드',
        headline: '운영자는 먼저 개입할 학생부터 우선순위로 봅니다',
        summary: '하락 추세, 미제출, 상담과 전후 변화를 연결해 개입 순서를 빠르게 정하는 운영용 흐름입니다.',
        checkpoints: ['하락 추세', '미제출 확인', '개입 우선순위', '전후 비교'],
        href: '/go/experience?placement=app_preview_admin',
        label: '운영자 화면 보기',
      },
    ],
    captures: [
      {
        mode: '학생 모드',
        title: '오늘의 루틴과 성장 지표를 한 화면에서 확인',
        description: '학생 홈 화면 기준 재구성 캡처입니다. 오늘의 루틴, 주간 캘린더, 성장 지표, 피드백이 한 번에 보입니다.',
        image: '/marketing/app-evidence/student-dashboard-redacted.svg',
        proofType: 'reconstructed',
        callout: '확인 → 추적 → 해석 → 행동',
        href: '/experience',
      },
      {
        mode: '학부모 모드',
        title: '상태 요약과 주간 그래프로 과정을 빠르게 확인',
        description: '학부모 화면 기준 재구성 캡처입니다. 출결/상태 요약, 주간 그래프, 날짜별 기록, 리포트 흐름을 보여줍니다.',
        image: '/marketing/app-evidence/parent-dashboard-redacted.svg',
        proofType: 'reconstructed',
        callout: '실시간 상태 → 기록 추적 → 리포트 확인',
        href: '/experience',
      },
      {
        mode: '운영자 모드',
        title: '위험 신호와 개입 결과를 우선순위로 정리',
        description: '운영자 대시보드 기준 재구성 캡처입니다. 하락 추세, 미제출, 상담, 전후 비교를 같은 문맥으로 묶습니다.',
        image: '/marketing/app-evidence/admin-dashboard-redacted.svg',
        proofType: 'reconstructed',
        callout: '문제 발견 → 개입 → 변화 확인',
        href: '/experience',
      },
    ],
    trustMetrics: [
      { label: '학생이 얻는 변화', value: '공부 습관', detail: '매일 같은 흐름으로 공부가 이어집니다', tone: 'navy' },
      { label: '빠른 개입 구조', value: '즉시 점검', detail: '흔들리는 구간을 빠르게 확인하고 바로 조정합니다', tone: 'orange' },
      { label: '학부모 확인', value: '안심 관리', detail: '출결·공부시간·리포트를 한 흐름으로 확인합니다', tone: 'green' },
      { label: '국어 수업 연동', value: '실전 대비', detail: '독서실 관리와 국어 수업이 같은 방향으로 연결됩니다', tone: 'red' },
    ],
  },
  centerEnvironment: {
    eyebrow: 'STUDY ENVIRONMENT',
    title: '와이파이 방화벽으로 학습에 불필요한 접속을 제한합니다',
    description:
      '센터 내 네트워크는 공부 흐름에 방해가 되는 접속을 줄이고, 학생이 더 안정적으로 집중할 수 있는 환경으로 운영됩니다.',
    highlights: ['학습 집중 환경', '불필요한 접속 제한', '센터 전체 동일 적용'],
    photos: [
      {
        title: '센터 전경',
        summary: '입실 순간부터 차분한 분위기와 운영 기준이 느껴지도록 정리한 공간입니다.',
        alt: '센터 전경 실제 사진 예정 자리',
      },
      {
        title: '학습 공간',
        summary: '학생이 오래 머물러도 흐름이 끊기지 않도록 몰입 중심으로 설계한 자리입니다.',
        alt: '학습 공간 실제 사진 예정 자리',
      },
      {
        title: '상담 공간',
        summary: '학생과 학부모가 편하게 상담 흐름을 이어갈 수 있도록 별도 공간으로 운영합니다.',
        alt: '상담 공간 실제 사진 예정 자리',
      },
    ],
  },
  mockExamProgram: {
    eyebrow: 'REAL MOCK EXAM PROGRAM',
    title: '대치동까지 가지 않아도, 트랙에서 실전 모의고사 체계를 바로 경험합니다',
    description:
      '매달 더프리미엄 모의고사와, 시대인재 서바이벌 프로 모의고사를 포함한 실전 모의 운영과 국어는 이감, 한수 모의고사까지 연결해 학습 상태를 점검합니다. 멀리 이동하지 않아도 실전 감각과 대응력을 기를 수 있습니다.',
    highlights: ['매달 더프 실시', '이감 점검', '한수 점검', '서바이벌 프로 실시'],
    programs: [
      {
        title: '더프리미엄 모의고사',
        summary: '더프리미엄 실전 모의고사로 현재 위치를 확인하고, 성적표까지 함께 반영해 시간 운영과 기본 대응력을 점검합니다.',
      },
      {
        title: '이감',
        summary: '실제 수능장과 가까운 국어 실전 흐름 안에서 낯선 지문 대응력과 시간 배분을 점검합니다.',
      },
      {
        title: '한수',
        summary: '평가원 감각이 흐트러지지 않도록 국어 실전 루틴을 안정적으로 유지하며 흔들리는 구간을 확인합니다.',
      },
      {
        title: '시대인재 서바이벌 프로',
        summary: '상위권 실전 난이도까지 대비해 시험장에서 흔들리지 않는 난이도 대응력을 만듭니다.',
      },
    ],
  },
  mobileStudySystem: {
    intro: {
      eyebrow: 'TRACK SYSTEM',
      title: '트랙 스터디센터 학습관리 시스템을 소개합니다',
      description:
        '학습 방향 설정부터 웹앱 피드백, 실전 모의고사 운영, 분위기 관리까지 학생의 흐름이 흔들리지 않도록 한 시스템 안에서 운영합니다.',
    },
    sections: [
      {
        title: '독자개발한 트랙러닝시스템을 통해 학습 방향성 설정',
        body: '오늘의 학습계획을 작성하고 실천',
        href: '/experience',
        tone: 'orange',
      },
      {
        title: '트랙 러닝시스템으로 학습현황 실시간 체크 및 피드백',
        body: '학습 계획 기반으로 공부 흐름 분석',
        secondaryBody: '학생의 학습데이터를 학생, 학부모 실시간 확인가능',
        tone: 'slate',
      },
      {
        title:
          '더프리미엄 모의고사와 시대인재 서바이벌 프로, 이감, 한수 모의고사를 통한 문제경험 및 실전 감각 향상',
        body: '대치동에 가지 않아도 동일한 컨텐츠 유료 이용가능',
        tone: 'navy',
      },
      {
        title: '확실한 벌점제도를 통한 학습분위기 관리 및 포인트제도를 통한 학습흥미 유발',
        body: '벌점과 포인트를 함께 운영해 학습 집중도와 지속성을 동시에 높입니다.',
        alt: '모바일 학습관리 시스템 실제 앱 화면 예정 자리',
        tone: 'violet',
      },
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
    contactLine: '상담 문의: 접수 후 순차연락',
    locationLine: '위치: 경기 용인시 기흥구 동백중앙로 283 B동 9층 906호, 907호',
    hoursLine: '학기중 오후 5:00 ~ 다음날 오전 1:00 · 방학중 오전 8:30 ~ 다음날 오전 1:00 · N수생 별도 운영시간 운영',
  },
  footer: {
    line: '트랙은 공간만 제공하지 않습니다. 학생의 현재를 데이터로 보고, 다음 전략까지 함께 설계합니다.',
    phone: '상담 문의: 접수 후 순차연락',
    location: '경기 용인시 기흥구 동백중앙로 283 B동 9층 906호, 907호',
    hours: '운영 시간: 학기중 오후 5:00 ~ 다음날 오전 1:00 · 방학중 오전 8:30 ~ 다음날 오전 1:00 · N수생 별도 운영시간 운영',
  },
};

