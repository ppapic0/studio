import { ROUTINE_MISSING_PENALTY_POINTS } from './attendance-auto';

export const REQUEST_PENALTY_POINTS = {
  late: 1,
  absence: 2,
} as const;

export const PENALTY_RECOVERY_INTERVAL_DAYS = 7;

export type ManualTone = 'navy' | 'orange' | 'amber' | 'rose' | 'emerald';

export type StudentManualHighlight = {
  key: string;
  title: string;
  description: string;
  tone: ManualTone;
};

export type StudentManualRuleSection = {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  items: string[];
  tone: ManualTone;
};

export type StudentPenaltyGuideItem = {
  key: string;
  title: string;
  description: string;
  pointsLabel: string;
  tone: string;
};

export type StudentPenaltyRuleRow = {
  key: string;
  category: string;
  pointsLabel: string;
  detail: string;
  tone: ManualTone;
};

export type StudentPenaltyStageRule = {
  key: string;
  threshold: string;
  action: string;
  tone: ManualTone;
};

export const STUDENT_MANUAL_OPERATION_HIGHLIGHTS: StudentManualHighlight[] = [
  {
    key: 'phone',
    title: '도착 즉시 휴대폰 반납',
    description: '입실하면 전원을 끄고 지정 장소에 맡겨요.',
    tone: 'rose',
  },
  {
    key: 'tablet',
    title: '태블릿은 학습용만',
    description: '인강·문서·문제풀이 외 사용은 바로 제지돼요.',
    tone: 'navy',
  },
  {
    key: 'wifi',
    title: '와이파이는 기본 방화벽',
    description: '필요한 사이트만 요청 후 화이트리스트로 열어요.',
    tone: 'amber',
  },
  {
    key: 'patrol',
    title: '선생님 수시 순회 관리',
    description: '분위기 저해 행동은 즉시 지도하고 강하게 반영해요.',
    tone: 'orange',
  },
];

export const STUDENT_MANUAL_FIRST_DAY_FLOW: StudentManualHighlight[] = [
  {
    key: 'arrival',
    title: '자리 세팅부터',
    description: '가방, 물, 필기구를 정리하고 오늘 공부 순서를 바로 확인해요.',
    tone: 'navy',
  },
  {
    key: 'phone',
    title: '휴대폰 OFF 후 반납',
    description: '센터 도착 후 바로 전원을 끄고 지정 장소에 맡겨야 해요.',
    tone: 'rose',
  },
  {
    key: 'plan',
    title: '오늘 할 일 체크',
    description: '계획 탭에서 과목 순서와 목표 분량을 먼저 확인해요.',
    tone: 'amber',
  },
  {
    key: 'focus',
    title: '키오스크로 공부 시작',
    description: '착석 후 준비된 키오스크에서 시작 처리하고 자리에서 바로 몰입해요.',
    tone: 'orange',
  },
];

export const STUDENT_MANUAL_RULE_SECTIONS: StudentManualRuleSection[] = [
  {
    key: 'attendance',
    eyebrow: 'ATTENDANCE',
    title: '출결 및 연락 규정',
    description: '지각, 외출, 결석은 모두 사전 승인 기준으로 운영합니다.',
    tone: 'navy',
    items: [
      '지각·외출·결석은 반드시 사전에 승인받아야 해요.',
      '보호자 확인이 필요한 경우 센터 전용 연락망으로 직접 안내해요.',
      '입실 즉시 휴대폰은 전원 OFF 후 지정 장소에 반납해요.',
    ],
  },
  {
    key: 'study',
    eyebrow: 'FOCUS',
    title: '학습시간 및 휴식 규정',
    description: '학습 시간에는 조용하고 정돈된 분위기를 유지하는 것이 기본입니다.',
    tone: 'orange',
    items: [
      '학습 시간에는 자리 이동, 잡담, 불필요한 행동을 금지해요.',
      '필기구·책넘김·의자 이동 소리까지 포함해 소음을 최소화해요.',
      '음식 섭취는 지정된 공간에서만 가능하고, 휴식 시간에도 과도한 대화는 제한돼요.',
    ],
  },
  {
    key: 'device',
    eyebrow: 'DEVICE',
    title: '기기 및 인터넷 사용 규정',
    description: '태블릿과 노트북은 학습 목적일 때만 허용됩니다.',
    tone: 'amber',
    items: [
      '노트북·태블릿은 인강, 문서 열람, 문제풀이 같은 학습 용도로만 사용 가능해요.',
      '게임, SNS, 영상 시청 등 비학습 콘텐츠는 금지돼요.',
      '센터 와이파이는 방화벽이 적용되어 있고, 필요한 사이트만 요청 후 열 수 있어요.',
      '인강 시 이어폰은 필수이며 소리가 밖으로 새면 바로 지도돼요.',
    ],
  },
  {
    key: 'life',
    eyebrow: 'LIFE',
    title: '생활 및 위생 규정',
    description: '공용 공간을 함께 쓰는 만큼 기본 생활 관리도 성실하게 지켜야 합니다.',
    tone: 'emerald',
    items: [
      '개인 자리와 공용 공간은 항상 깨끗하게 유지해요.',
      '쓰레기는 일반/재활용으로 직접 분리해서 버려요.',
      '향수, 체취, 젖은 우산·컵 등 타인에게 불편을 주는 요소는 바로 정리해요.',
      '개인 물품은 스스로 챙기고, 분실 방지는 본인 책임으로 관리해요.',
    ],
  },
  {
    key: 'facility',
    eyebrow: 'FACILITY',
    title: '시설 이용 규정',
    description: '책상과 의자, 벽면은 모두 다음 학생을 위한 학습 자산입니다.',
    tone: 'rose',
    items: [
      '모든 시설은 사용 후 원위치가 기본이에요.',
      '책상, 의자, 벽에 낙서하거나 스티커를 붙이는 행동은 금지예요.',
      '기물 훼손이 발생하면 배상 책임과 함께 강한 조치가 이어질 수 있어요.',
    ],
  },
];

export const STUDENT_PENALTY_GUIDE_ITEMS: StudentPenaltyGuideItem[] = [
  {
    key: 'late-absence',
    title: '지각·결석·무단이탈',
    description: '지각은 자동 반영, 외출·결석은 사전 승인 없이 진행되면 바로 누적돼요.',
    pointsLabel: '+1~2점',
    tone: 'border-amber-100 bg-amber-50/70 text-amber-700',
  },
  {
    key: 'routine',
    title: '루틴 미작성',
    description: '등원 전 루틴을 쓰지 않으면 자동으로 기록돼요.',
    pointsLabel: `+${ROUTINE_MISSING_PENALTY_POINTS}점`,
    tone: 'border-sky-100 bg-sky-50/70 text-sky-700',
  },
  {
    key: 'device',
    title: '휴대폰·태블릿 규정 위반',
    description: '휴대폰 미반납, 태블릿 비학습 사용, 방화벽 우회는 강하게 반영돼요.',
    pointsLabel: '+2~4점',
    tone: 'border-rose-100 bg-rose-50/70 text-rose-600',
  },
  {
    key: 'focus',
    title: '학습 분위기 저해',
    description: '잡담, 소음, 무단이석, 불필요한 이동은 바로 지도 대상이에요.',
    pointsLabel: '+1~3점',
    tone: 'border-orange-100 bg-orange-50/70 text-orange-700',
  },
  {
    key: 'facility',
    title: '위생·시설 규정 위반',
    description: '쓰레기 방치, 주변 정리 미흡, 시설 훼손은 반복 시 빠르게 가중돼요.',
    pointsLabel: '+1~5점',
    tone: 'border-slate-200 bg-slate-50 text-slate-700',
  },
];

export const STUDENT_MANUAL_PENALTY_RULE_ROWS: StudentPenaltyRuleRow[] = [
  {
    key: 'late',
    category: '지각 승인 입실',
    pointsLabel: `+${REQUEST_PENALTY_POINTS.late}점`,
    detail: '승인된 지각도 출결 기준상 벌점은 자동 반영돼요.',
    tone: 'amber',
  },
  {
    key: 'absence',
    category: '결석·무단 외출·무단 이석',
    pointsLabel: `+${REQUEST_PENALTY_POINTS.absence}점`,
    detail: '사전 승인 없이 자리나 센터를 이탈하면 바로 누적 관리해요.',
    tone: 'rose',
  },
  {
    key: 'routine',
    category: '루틴 미작성',
    pointsLabel: `+${ROUTINE_MISSING_PENALTY_POINTS}점`,
    detail: '등원 전 루틴을 쓰지 않으면 자동으로 기록돼요.',
    tone: 'navy',
  },
  {
    key: 'phone',
    category: '휴대폰 미반납·학습 중 사용',
    pointsLabel: '+2점',
    detail: '입실 즉시 전원 OFF 후 반납이 원칙이며, 적발 시 즉시 회수 후 누적돼요.',
    tone: 'rose',
  },
  {
    key: 'noise',
    category: '학습시간 대화·소음·불필요한 이동',
    pointsLabel: '+1점',
    detail: '학습 분위기를 흐리는 행동은 선생님이 바로 제지하고 반영해요.',
    tone: 'orange',
  },
  {
    key: 'tablet',
    category: '태블릿 비학습 사용·게임·SNS',
    pointsLabel: '+3점',
    detail: '인강·학습 외 사용은 규정 위반으로 즉시 강하게 처리해요.',
    tone: 'amber',
  },
  {
    key: 'firewall',
    category: '방화벽 우회·차단망 해제 시도',
    pointsLabel: '+4점',
    detail: '와이파이 우회는 중대 위반으로 보고 보호자 안내까지 이어질 수 있어요.',
    tone: 'rose',
  },
  {
    key: 'earphone',
    category: '이어폰 미착용·인강 소리 외부 유출',
    pointsLabel: '+1점',
    detail: '공용 학습 환경을 해치기 때문에 즉시 지도 후 누적될 수 있어요.',
    tone: 'navy',
  },
  {
    key: 'clean',
    category: '자리 정리 미흡·쓰레기 방치',
    pointsLabel: '+1점',
    detail: '개인 자리와 공용 공간을 정리하지 않으면 반복 시 가중돼요.',
    tone: 'emerald',
  },
  {
    key: 'damage',
    category: '시설 훼손·낙서·스티커 부착',
    pointsLabel: '+5점',
    detail: '배상 책임과 함께 보호자 안내, 강한 생활 조치가 바로 들어가요.',
    tone: 'rose',
  },
  {
    key: 'harm',
    category: '타인 피해·반복적 규정 위반',
    pointsLabel: '즉시 조치',
    detail: '상담, 귀가 조치, 퇴원 검토까지 즉시 진행될 수 있어요.',
    tone: 'rose',
  },
];

export const STUDENT_PENALTY_STAGE_RULES: StudentPenaltyStageRule[] = [
  {
    key: 'teacher',
    threshold: '7점 이상',
    action: '선생님 상담 및 생활 피드백 강화',
    tone: 'amber',
  },
  {
    key: 'guardian',
    threshold: '12점 이상',
    action: '학부모 상담 및 집중 관리',
    tone: 'orange',
  },
  {
    key: 'dismissal',
    threshold: '20점 이상',
    action: '강제 퇴원 검토 및 즉시 조치 가능',
    tone: 'rose',
  },
];

export const STUDENT_MANUAL_PRO_TIPS = [
  '도착 후 5분 안에 휴대폰 반납, 오늘 할 일 확인, 키오스크 시작 처리까지 끝내면 흐름이 가장 좋아요.',
  '학습에 필요한 사이트가 막혀 있으면 바로 와이파이 요청을 넣고, 임의로 우회하지 마세요.',
  '잠깐이라도 자리에서 일어나면 타이머부터 정리하는 습관이 벌점을 가장 잘 막아줘요.',
  '규정은 겁주기용이 아니라 몰입과 안전을 지키기 위한 기준이에요. 헷갈리면 바로 선생님께 물어보세요.',
];

export function getManualToneClass(tone: ManualTone) {
  if (tone === 'orange') {
    return {
      badge: 'border-[#FFD6B4] bg-[#FFF1E5] text-[#C45F0A]',
      surface: 'border-[#FFD8BE] bg-[linear-gradient(180deg,#FFF8F1_0%,#FFF0E0_100%)]',
    };
  }
  if (tone === 'amber') {
    return {
      badge: 'border-[#F5D69E] bg-[#FFF7E3] text-[#9A6208]',
      surface: 'border-[#F6DEB0] bg-[linear-gradient(180deg,#FFFBEF_0%,#FFF3D6_100%)]',
    };
  }
  if (tone === 'rose') {
    return {
      badge: 'border-[#F6C7D6] bg-[#FFF0F5] text-[#C13D68]',
      surface: 'border-[#F4CDDB] bg-[linear-gradient(180deg,#FFF7FA_0%,#FFEAF0_100%)]',
    };
  }
  if (tone === 'emerald') {
    return {
      badge: 'border-[#BFE9D1] bg-[#ECFFF4] text-[#0E8A52]',
      surface: 'border-[#CDEEDB] bg-[linear-gradient(180deg,#F7FFF9_0%,#EFFFF5_100%)]',
    };
  }
  return {
    badge: 'border-[#CFE0FF] bg-[#EFF4FF] text-[#214DAD]',
    surface: 'border-[#D7E3F8] bg-[linear-gradient(180deg,#F8FBFF_0%,#EEF4FF_100%)]',
  };
}
