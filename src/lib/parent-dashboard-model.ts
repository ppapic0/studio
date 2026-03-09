export type ParentPortalTab = 'home' | 'reports' | 'studyDetail' | 'life' | 'communication' | 'notifications';

export type ParentQuickRequestKey =
  | 'math_support'
  | 'english_support'
  | 'habit_coaching'
  | 'career_consulting';

export type ParentBehaviorBadge = '좋음' | '보통' | '주의';

export interface ParentNotificationItem {
  id: string;
  type:
    | 'check_in'
    | 'check_out'
    | 'late'
    | 'away_long'
    | 'unauthorized_exit'
    | 'penalty'
    | 'counseling_done'
    | 'weekly_report'
    | 'monthly_report';
  title: string;
  body: string;
  createdAtLabel: string;
  isRead: boolean;
  isImportant: boolean;
}

export interface ParentWeeklyReportSnapshot {
  totalStudyMinutes: number;
  averageDailyMinutes: number;
  studyTimeDeltaRate: number;
  avgPlanCompletionRate: number;
  attendanceRate: number;
  lateCount: number;
  absenceCount: number;
  earlyLeaveCount: number;
  topSubject: string;
  weakSubject: string;
  teacherFeedback: string;
}

export interface ParentMonthlyReportSnapshot {
  totalStudyMinutes: number;
  attendanceRate: number;
  avgPlanCompletionRate: number;
  diligenceSummary: string;
  accumulatedPenaltyPoints: number;
  counselingCount: number;
  growthPoint: string;
  improvementPoint: string;
  teacherOpinion: string;
}

export interface ParentDashboardMockData {
  weeklyReport: ParentWeeklyReportSnapshot;
  monthlyReport: ParentMonthlyReportSnapshot;
  charts: {
    dailyStudyMinutes: { date: string; minutes: number }[];
    planCompletionTrend: { date: string; rate: number }[];
    subjectShare: { subject: string; minutes: number; color: string }[];
    attendancePenaltyTrend: { week: string; attendanceRate: number; penalty: number }[];
    hourlyFocus: { hour: string; minutes: number }[];
    lifeTrend2Weeks: { day: string; behaviorScore: number; penalty: number }[];
  };
  life: {
    recentPenaltyReasons: { id: string; reason: string; points: number; dateLabel: string }[];
    attendanceEvents: { id: string; label: string; dateLabel: string }[];
    unauthorizedExitCount2Weeks: number;
    longAwayCount2Weeks: number;
  };
  feedback: {
    daily: string;
    weekly: string;
    monthly: string;
  };
  quickRequestTemplates: Record<ParentQuickRequestKey, string>;
  aiInsights: string[];
  notifications: ParentNotificationItem[];
}

export const parentDashboardMockData: ParentDashboardMockData = {
  weeklyReport: {
    totalStudyMinutes: 2120,
    averageDailyMinutes: 303,
    studyTimeDeltaRate: 12,
    avgPlanCompletionRate: 84,
    attendanceRate: 96,
    lateCount: 1,
    absenceCount: 0,
    earlyLeaveCount: 0,
    topSubject: '수학',
    weakSubject: '영어',
    teacherFeedback: '이번 주는 전반적으로 집중력이 안정적이었고, 계획 이행도도 꾸준했습니다.',
  },
  monthlyReport: {
    totalStudyMinutes: 9100,
    attendanceRate: 95,
    avgPlanCompletionRate: 81,
    diligenceSummary: '성실도는 상위권이며 루틴 유지력이 좋습니다.',
    accumulatedPenaltyPoints: 9,
    counselingCount: 2,
    growthPoint: '수학 심화 과제 수행량 증가',
    improvementPoint: '영어 독해 비중 확대 필요',
    teacherOpinion: '현재 흐름을 유지하면 다음 달 성과 향상이 기대됩니다.',
  },
  charts: {
    dailyStudyMinutes: [
      { date: '03/02', minutes: 280 },
      { date: '03/03', minutes: 320 },
      { date: '03/04', minutes: 295 },
      { date: '03/05', minutes: 340 },
      { date: '03/06', minutes: 310 },
      { date: '03/07', minutes: 365 },
      { date: '03/08', minutes: 350 },
    ],
    planCompletionTrend: [
      { date: '03/02', rate: 72 },
      { date: '03/03', rate: 85 },
      { date: '03/04', rate: 78 },
      { date: '03/05', rate: 88 },
      { date: '03/06', rate: 82 },
      { date: '03/07', rate: 91 },
      { date: '03/08', rate: 87 },
    ],
    subjectShare: [
      { subject: '수학', minutes: 2100, color: '#1B64DA' },
      { subject: '국어', minutes: 1750, color: '#14B8A6' },
      { subject: '영어', minutes: 1200, color: '#F59E0B' },
      { subject: '과학', minutes: 980, color: '#8B5CF6' },
    ],
    attendancePenaltyTrend: [
      { week: '2월 1주', attendanceRate: 93, penalty: 4 },
      { week: '2월 2주', attendanceRate: 95, penalty: 3 },
      { week: '2월 3주', attendanceRate: 94, penalty: 3 },
      { week: '2월 4주', attendanceRate: 96, penalty: 2 },
      { week: '3월 1주', attendanceRate: 96, penalty: 2 },
    ],
    hourlyFocus: [
      { hour: '16시', minutes: 40 },
      { hour: '17시', minutes: 75 },
      { hour: '18시', minutes: 82 },
      { hour: '19시', minutes: 90 },
      { hour: '20시', minutes: 63 },
      { hour: '21시', minutes: 38 },
    ],
    lifeTrend2Weeks: [
      { day: 'D-13', behaviorScore: 78, penalty: 2 },
      { day: 'D-11', behaviorScore: 80, penalty: 2 },
      { day: 'D-9', behaviorScore: 82, penalty: 1 },
      { day: 'D-7', behaviorScore: 84, penalty: 1 },
      { day: 'D-5', behaviorScore: 83, penalty: 2 },
      { day: 'D-3', behaviorScore: 86, penalty: 1 },
      { day: 'D-1', behaviorScore: 88, penalty: 1 },
    ],
  },
  life: {
    recentPenaltyReasons: [
      { id: 'pen-1', reason: '자습 시작 지연', points: 2, dateLabel: '03/05' },
      { id: 'pen-2', reason: '휴대폰 사용', points: 2, dateLabel: '03/01' },
    ],
    attendanceEvents: [
      { id: 'att-1', label: '지각 1회', dateLabel: '03/05' },
      { id: 'att-2', label: '결석 0회', dateLabel: '최근 2주' },
      { id: 'att-3', label: '조퇴 0회', dateLabel: '최근 2주' },
    ],
    unauthorizedExitCount2Weeks: 0,
    longAwayCount2Weeks: 1,
  },
  feedback: {
    daily: '오늘은 수학 집중력이 좋았고 계획한 분량의 대부분을 마쳤습니다.',
    weekly: '이번 주는 루틴이 안정적으로 유지되었고, 과제 제출 지연이 줄었습니다.',
    monthly: '전반적으로 성장 추세이며 영어 독해 루틴을 보완하면 더 좋은 결과가 기대됩니다.',
  },
  quickRequestTemplates: {
    math_support: '수학 집중 관리 요청',
    english_support: '영어 보완 요청',
    habit_coaching: '학습 습관 코칭 요청',
    career_consulting: '진로/진학 상담 요청',
  },
  aiInsights: [
    '이번 주는 전반적으로 꾸준한 학습이 유지되었습니다.',
    '수학 학습 비중이 높으나 영어 학습 보완이 필요해 보입니다.',
    '생활 태도는 매우 좋으며 출석 리듬이 일정합니다.',
    '현재의 성실도를 유지한다면 다음 모의고사 성적 향상이 기대됩니다.',
  ],
  notifications: [
    {
      id: 'n-1',
      type: 'check_in',
      title: '등원 완료',
      body: '오늘 16:08에 정상적으로 등원 처리되었습니다.',
      createdAtLabel: '방금 전',
      isRead: false,
      isImportant: true,
    },
    {
      id: 'n-2',
      type: 'weekly_report',
      title: '주간 리포트 발행',
      body: '이번 주 자녀의 학습 분석 리포트가 도착했습니다.',
      createdAtLabel: '1시간 전',
      isRead: false,
      isImportant: true,
    },
    {
      id: 'n-3',
      type: 'penalty',
      title: '벌점 기록 알림',
      body: '생활 수칙 위반으로 벌점 2점이 부과되었습니다.',
      createdAtLabel: '어제',
      isRead: true,
      isImportant: false,
    },
  ],
};
