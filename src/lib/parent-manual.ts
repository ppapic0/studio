import type { StudentManualHighlight, StudentManualRuleSection } from './student-manual';

export const PARENT_MANUAL_FIRST_DAY_FLOW: StudentManualHighlight[] = [
  {
    key: 'student',
    title: '자녀 선택부터 확인',
    description: '둘 이상 연결되어 있으면 상단에서 현재 보고 있는 자녀를 먼저 맞춰 주세요.',
    tone: 'navy',
  },
  {
    key: 'home',
    title: '홈에서 오늘 흐름 확인',
    description: '오늘 공부 시간, 출결 상태, 벌점 변화, 미확인 알림을 먼저 보는 게 좋아요.',
    tone: 'orange',
  },
  {
    key: 'report',
    title: '리포트와 중요 알림 확인',
    description: '읽지 않은 리포트와 중요 알림은 당일 안에 확인해야 대응이 빨라져요.',
    tone: 'amber',
  },
  {
    key: 'contact',
    title: '필요하면 바로 소통',
    description: '상담, 요청, 건의는 소통 탭에서 남기면 기록이 남아 더 정확하게 이어져요.',
    tone: 'rose',
  },
];

export const PARENT_MANUAL_OPERATION_HIGHLIGHTS: StudentManualHighlight[] = [
  {
    key: 'phone',
    title: '도착 즉시 휴대폰 반납 운영',
    description: '학생은 입실 시 휴대폰 전원을 끄고 지정 장소에 반납합니다.',
    tone: 'rose',
  },
  {
    key: 'tablet',
    title: '태블릿은 학습 목적만 허용',
    description: '인강, 문서, 문제풀이 외 사용은 즉시 제지 및 벌점 반영 대상입니다.',
    tone: 'navy',
  },
  {
    key: 'wifi',
    title: '와이파이는 방화벽 기반',
    description: '학습에 필요한 사이트만 요청 후 열리며, 우회 시도는 중대 위반입니다.',
    tone: 'amber',
  },
  {
    key: 'patrol',
    title: '선생님이 수시로 순회 지도',
    description: '분위기 저해 행동은 현장에서 바로 제지하고 필요 시 강하게 조치합니다.',
    tone: 'orange',
  },
];

export const PARENT_MANUAL_DASHBOARD_SECTIONS: StudentManualRuleSection[] = [
  {
    key: 'home',
    eyebrow: 'HOME',
    title: '홈 탭: 오늘 흐름부터 확인',
    description: '하루 시작, 현재 상태, 즉시 확인이 필요한 변화를 가장 먼저 보는 화면입니다.',
    tone: 'navy',
    items: [
      '오늘 공부 시간, 등하원 상태, 벌점, 미확인 알림을 한 화면에서 확인할 수 있어요.',
      '형제자매가 함께 연결돼 있으면 상단 자녀 선택 상태를 먼저 맞추고 읽어 주세요.',
      '중요 알림이나 새 리포트가 보이면 당일 안에 확인하고 필요 시 상담으로 이어가세요.',
    ],
  },
  {
    key: 'study',
    eyebrow: 'STUDY',
    title: '학습 탭: 날짜별 기록 읽기',
    description: '캘린더를 중심으로 실제 공부 흐름과 일자별 기록을 읽는 탭입니다.',
    tone: 'orange',
    items: [
      '월간 캘린더에서 날짜를 눌러 등원, 학습 시작·종료, 이석 흐름을 차분하게 볼 수 있어요.',
      '하루 공부 시간이 크게 흔들린 날은 같은 날짜의 기록과 리포트를 함께 보는 것이 좋아요.',
      '지각·결석 관련 변화가 있으면 학습 탭 기록과 벌점 안내를 같이 보면 이해가 빨라져요.',
    ],
  },
  {
    key: 'data',
    eyebrow: 'DATA',
    title: '데이터 탭: 추세와 인사이트',
    description: '하루 상태보다 주간·월간 변화와 패턴을 읽는 분석 화면입니다.',
    tone: 'amber',
    items: [
      '학습 시간, 계획 이행률, 과목 비중, 생활 리듬을 그래프로 확인할 수 있어요.',
      'AI 인사이트는 참고용 해석이고, 실제 변화는 리포트와 함께 읽을 때 가장 정확해요.',
      '좋았던 주와 흔들린 주를 비교해 상담 포인트를 정리하면 대화가 훨씬 수월해집니다.',
    ],
  },
  {
    key: 'communication',
    eyebrow: 'COMMUNICATION',
    title: '소통 탭: 상담·문의·공지',
    description: '센터와 주고받는 모든 상담, 알림, 문의 기록이 모이는 탭입니다.',
    tone: 'emerald',
    items: [
      '방문, 전화, 온라인 중 원하는 방식으로 상담 요청을 남길 수 있어요.',
      '질의사항, 요청사항, 건의사항을 구분해서 보내면 처리와 답변이 더 빨라져요.',
      '공지와 중요 알림은 읽음 상태로 관리되니 미확인 항목을 오래 쌓아두지 않는 것이 좋아요.',
    ],
  },
  {
    key: 'billing',
    eyebrow: 'BILLING',
    title: '수납 탭: 청구서와 상태 확인',
    description: '현재는 결제보다 청구 확인과 상태 조회에 중심을 둔 화면입니다.',
    tone: 'rose',
    items: [
      '대표 청구서의 금액, 상태, 마감일을 가장 먼저 확인해 주세요.',
      '이전 청구서나 추가 청구도 이력에서 함께 확인할 수 있어요.',
      '앱 내 결제 기능은 추후 오픈 예정이라 지금은 수납 상태 확인 중심으로 운영돼요.',
    ],
  },
];

export const PARENT_MANUAL_PRO_TIPS = [
  '홈에서 미확인 알림, 리포트 수, 수납 상태를 먼저 보면 중요한 변화 대부분을 놓치지 않아요.',
  '걱정되는 그래프가 보여도 하루 수치만 보고 판단하기보다 최근 2주 추세와 리포트를 같이 보세요.',
  '벌점은 점수만이 아니라 사유, 반영 시점, 회복 여부를 함께 보셔야 실제 생활 흐름이 보입니다.',
  '학생이 규정을 임의 해석하지 않도록, 휴대폰·태블릿·와이파이 관련 애매한 부분은 바로 센터에 문의해 주세요.',
  '상담 요청 제목을 구체적으로 적을수록 센터에서 더 빠르고 정확하게 도와드릴 수 있어요.',
];
