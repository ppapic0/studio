
import { Timestamp } from "firebase/firestore";

export type WithId<T> = T & { id: string };

export interface User {
  id: string;
  displayName: string;
  email: string;
  profileImageUrl?: string;
  schoolName?: string; 
  phoneNumber?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Student {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface CenterMembership {
  id: string; 
  role: 'student' | 'teacher' | 'parent' | 'centerAdmin' | 'owner';
  status: 'active' | 'onHold' | 'withdrawn' | 'pending';
  joinedAt: Timestamp;
  displayName?: string;
  className?: string;
  phoneNumber?: string;
  linkedStudentIds?: string[];
  monthlyFee?: number;
  baseFee?: number;
  tutoringDiscount?: boolean;
  siblingDiscount?: boolean;
}

export type 센터Membership = CenterMembership;

export interface Invoice {
  id: string;
  studentId: string;
  studentName: string;
  cycleStartDate: Timestamp;
  cycleEndDate: Timestamp;
  priceSnapshot: {
    productId: string;
    season: string;
    studentType: string;
    basePrice: number;
  };
  discountsSnapshot: any[];
  finalPrice: number;
  status: 'issued' | 'paid' | 'refunded' | 'void' | 'overdue';
  paymentMethod?: 'card' | 'transfer' | 'cash' | 'none';
  paidAt?: Timestamp;
  issuedAt: Timestamp;
  updatedAt: Timestamp;
  transactionId?: string;
  paymentKey?: string; // Toss Payments
  orderId?: string;    // Toss Payments
  trackCategory?: 'studyRoom' | 'academy';
  isActionRequired?: boolean;
  dueLabel?: string;
  paymentMethodSummary?: string;
  receiptUrl?: string;
  nextAction?: string;
  priority?: 'normal' | 'high' | 'critical';
  readAt?: Timestamp;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  studentId: string;
  centerId: string;
  amount: number;
  method: 'card' | 'transfer' | 'cash';
  status: 'success' | 'failed' | 'cancelled';
  processedAt: Timestamp;
}

export interface KpiDaily {
  date: string; // YYYY-MM-DD
  totalRevenue: number; 
  collectedRevenue: number; // 실제 수납된 현금 흐름
  totalDiscount: number;
  totalRefund: number;
  totalStudyMinutes: number;
  activeStudentCount: number;
  breakevenStudents: number | null;
  updatedAt: Timestamp;
}

export interface StudentProfile {
  id: string;
  name: string;
  grade: string;
  schoolName: string;
  phoneNumber?: string;
  className?: string;
  seatNo: number;
  seatId?: string;
  roomId?: string;
  roomSeatNo?: number;
  seatZone?: string;
  targetDailyMinutes: number;
  parentUids: string[];
  createdAt: Timestamp;
  parentLinkCode?: string;
  expectedArrivalTime?: string;
  monthlyFee?: number;
  currentEnrollment?: {
    productId: string;
    season: 'semester' | 'vacation';
    studentType: 'student' | 'n_student';
    cycleStartDate: Timestamp;
  };
  examCountdowns?: Array<{
    id: string;
    title: string;
    date: string; // yyyy-MM-dd
  }>;
}

export interface LayoutRoomConfig {
  id: string;
  name: string;
  rows: number;
  cols: number;
  order: number;
}

export interface LayoutSettings {
  rooms?: LayoutRoomConfig[];
  rows?: number;
  cols?: number;
  updatedAt?: Timestamp;
}

export interface AttendanceCurrent {
  id: string;
  seatNo: number;
  roomId?: string;
  roomSeatNo?: number;
  status: "studying" | "away" | "break" | "absent";
  type?: "seat" | "aisle";
  seatZone?: string;
  updatedAt: Timestamp;
  lastCheckInAt?: Timestamp;
  studentId?: string; 
}

export interface GrowthProgress {
  seasonLp: number;
  penaltyPoints: number;
  stats: {
    focus: number;
    consistency: number;
    achievement: number;
    resilience: number;
  };
  dailyLpStatus?: {
    [dateKey: string]: any;
  };
  totalLpEarned: number;
  lastResetAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StudyPlanItem {
  id: string;
  studyPlanWeekId: string;
  centerId: string;
  studentId: string;
  title: string;
  weight: number;
  done: boolean;
  dateKey: string;
  category?: 'schedule' | 'personal' | 'study';
  subject?: string;
  studyPlanMode?: 'time' | 'volume';
  targetMinutes?: number;
  targetAmount?: number;
  actualAmount?: number;
  amountUnit?: '문제' | '페이지' | '챕터' | '지문' | '세트' | '회독' | '직접입력';
  amountUnitLabel?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StudyLogDay {
  studentId: string;
  centerId: string;
  dateKey: string;
  totalMinutes: number;
}

export interface DailyReport {
  id: string;
  studentId: string;
  teacherId: string;
  dateKey: string;
  content: string;
  status: "draft" | "sent";
  studentName?: string;
  teacherNote?: string | null;
  aiMeta?: {
    teacherOneLiner: string;
    strengths: string[];
    improvements: string[];
    level?: number;
    levelName?: string;
    attendanceLabel?: string;
    totalStudyMinutes?: number;
    completionRate?: number;
    history7Days?: Array<{
      date: string;
      minutes: number;
    }>;
    pedagogyLens?: '습관 형성' | '자기조절' | '집중 회복' | '성장 가속';
    secondaryLens?: '습관 형성' | '자기조절' | '집중 회복' | '성장 가속';
    stateBucket?: string;
    variationKey?: string;
    variationStyle?: '차분한 관찰형' | '격려형' | '전략 코칭형' | '균형 피드백형' | '가정 대화형' | '회복 지원형';
    coachingFocus?: string;
    homeTip?: string;
    studyBand?: '저학습' | '기준학습' | '고학습' | '고집중';
    growthBand?: '급하락' | '하락' | '유지' | '상승' | '급상승';
    completionBand?: '낮음' | '보통' | '양호' | '높음';
    routineBand?: '정상' | '지각' | '루틴누락' | '미입실' | '퇴실불안정';
    volatilityBand?: '안정' | '출렁임' | '불안정';
    continuityBand?: '회복중' | '유지중' | '연속호조' | '연속저하';
    metrics: {
      growthRate: number;
      deltaMinutesFromAvg: number;
      avg7StudyMinutes: number;
      isNewRecord: boolean;
      alertLow: boolean;
      streakBadge: boolean;
      trendSummary: string;
    };
  } | null;
  viewedAt?: Timestamp;
  viewedByUid?: string;
  viewedByName?: string;
  nextAction?: string;
  priority?: 'normal' | 'high' | 'critical';
  readAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InviteCode {
  id: string;
  intendedRole: 'student' | 'teacher' | 'parent' | 'centerAdmin';
  centerId?: string;
  targetClassName?: string;
  maxUses: number;
  usedCount: number;
  expiresAt?: Timestamp | { toDate?: () => Date } | Date | null;
  isActive?: boolean;
  createdByUserId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CounselingReservation {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  scheduledAt: Timestamp;
  status: 'requested' | 'confirmed' | 'done' | 'canceled';
  studentNote?: string;
  teacherNote?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CounselingLog {
  id: string;
  studentId: string;
  studentName?: string;
  teacherId: string;
  teacherName: string;
  type: "academic" | "life" | "career";
  content: string;
  improvement: string;
  reservationId?: string;
  studentQuestion?: string;
  readAt?: Timestamp | null;
  readByUid?: string;
  readByRole?: 'student' | 'parent';
  createdAt: Timestamp;
}

export interface DailyStudentStat {
    centerId: string;
    studentId: string;
    dateKey: string;
    todayPlanCompletionRate: number;
    totalStudyMinutes: number;
    studyTimeGrowthRate: number;
    createdAt: Timestamp;
}

export interface LeaderboardEntry {
  id: string;
  studentId: string;
  displayNameSnapshot: string;
  classNameSnapshot?: string;
  schoolNameSnapshot?: string;
  value: number;
  rank: number;
}

export interface StudySession {
  id: string;
  startTime: Timestamp;
  endTime: Timestamp;
  durationMinutes: number;
}

export interface AttendanceRequest {
  id: string;
  studentId: string;
  studentName: string;
  centerId: string;
  type: 'late' | 'absence';
  date: string;
  reason: string;
  status: 'requested' | 'approved' | 'rejected';
  penaltyApplied: boolean;
  penaltyPointsDelta?: number;
  statusUpdatedAt?: Timestamp;
  slaDueAt?: Timestamp;
  owner?: string;
  nextAction?: string;
  priority?: 'normal' | 'high' | 'critical';
  readAt?: Timestamp;
  updatedAt?: Timestamp;
  updatedByUserId?: string;
  createdAt: Timestamp;
}

export interface PenaltyLog {
  id: string;
  centerId: string;
  studentId: string;
  studentName?: string;
  pointsDelta: number;
  reason: string;
  source: 'attendance_request' | 'manual' | 'reset' | 'routine_missing';
  requestId?: string;
  requestType?: 'late' | 'absence';
  createdByUserId?: string;
  createdByName?: string;
  createdAt: Timestamp;
}

export interface NotificationSettings {
  smsEnabled?: boolean;
  smsProvider?: "none" | "aligo" | "custom";
  smsSender?: string;
  smsApiKey?: string;
  smsUserId?: string;
  smsEndpointUrl?: string;
  smsTemplateCheckIn?: string;
  smsTemplateCheckOut?: string;
  smsTemplateStudyStart?: string;
  smsTemplateAwayStart?: string;
  smsTemplateAwayEnd?: string;
  smsTemplateStudyEnd?: string;
  smsTemplateLateAlert?: string;
  smsApiKeyConfigured?: boolean;
  smsApiKeyLastUpdatedAt?: Timestamp;
  lateAlertEnabled?: boolean;
  lateAlertGraceMinutes?: number;
  defaultArrivalTime?: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export interface ParentActivityEvent {
  id: string;
  centerId: string;
  studentId: string;
  parentUid: string;
  eventType: "app_visit" | "report_read" | "consultation_request" | "request" | "suggestion";
  createdAt: Timestamp;
  metadata?: Record<string, any>;
}

export interface StudentNotification {
  id: string;
  centerId: string;
  studentId: string;
  teacherId: string;
  teacherName: string;
  type: 'one_line_feedback';
  title?: string;
  message: string;
  readAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export type ClassroomSignalRiskLevel = 'stable' | 'watch' | 'risk' | 'critical';
export type ClassroomSignalPriority = 'low' | 'medium' | 'high' | 'critical';
export type ClassroomOverlayMode = 'status' | 'risk' | 'penalty' | 'minutes' | 'counseling' | 'report';
export type ClassroomIncidentType =
  | 'away_long'
  | 'late_or_absent'
  | 'risk'
  | 'unread_report'
  | 'counseling_pending'
  | 'penalty_threshold'
  | 'check_in'
  | 'check_out';
export type ClassroomIncidentActionTarget = 'seat' | 'student' | 'report' | 'counseling';
export type ClassroomQuickFilter =
  | 'all'
  | 'studying'
  | 'awayLong'
  | 'lateOrAbsent'
  | 'atRisk'
  | 'unreadReports'
  | 'counselingPending';

export interface ClassroomSignalsSummary {
  studying: number;
  awayLong: number;
  lateOrAbsent: number;
  atRisk: number;
  unreadReports: number;
  counselingPending: number;
}

export interface ClassroomSignalClassSummary {
  className: string;
  occupancyRate: number;
  avgMinutes: number;
  riskCount: number;
  awayLongCount: number;
  pendingCounselingCount: number;
}

export interface ClassroomSeatSignal {
  studentId: string;
  seatId: string;
  overlayFlags: string[];
  todayMinutes: number;
  riskLevel: ClassroomSignalRiskLevel;
  effectivePenaltyPoints: number;
  hasUnreadReport: boolean;
  hasCounselingToday: boolean;
}

export interface ClassroomSignalIncident {
  type: ClassroomIncidentType;
  priority: ClassroomSignalPriority;
  studentId: string;
  studentName: string;
  seatId?: string;
  className?: string;
  reason: string;
  occurredAt: Timestamp;
  actionTarget: ClassroomIncidentActionTarget;
}

export interface ClassroomSignalsDocument {
  id?: string;
  updatedAt: Timestamp;
  dateKey: string;
  summary: ClassroomSignalsSummary;
  classSummaries: ClassroomSignalClassSummary[];
  seatSignals: ClassroomSeatSignal[];
  incidents: ClassroomSignalIncident[];
}
