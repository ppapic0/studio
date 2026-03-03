import { Timestamp } from "firebase/firestore";

export type WithId<T> = T & { id: string };

export interface User {
  id: string;
  displayName: string;
  email: string;
  profileImageUrl?: string;
  schoolName?: string; 
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CenterMembership {
  id: string; 
  role: 'student' | 'teacher' | 'parent' | 'centerAdmin';
  status: 'active' | 'onHold' | 'withdrawn' | 'pending';
  joinedAt: Timestamp;
  displayName?: string;
  className?: string; // 소속 반 이름
  linkedStudentIds?: string[];
  monthlyFee?: number;
  baseFee?: number; // 할인 전 기본 수강료
  tutoringDiscount?: boolean;
  siblingDiscount?: boolean;
}

export interface InviteCode {
  id: string;
  centerId: string;
  intendedRole: 'student' | 'teacher' | 'parent' | 'centerAdmin';
  targetClassName?: string; // 이 코드로 가입 시 자동 배정될 반 이름
  maxUses: number;
  usedCount: number;
  expiresAt: Timestamp | null;
  isActive: boolean;
  createdByUserId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MonthlyFinance {
  yearMonth: string; // YYYY-MM
  rent: number;
  labor: number;
  maintenance: number;
  other: number;
  totalFixedCosts: number;
  updatedAt: Timestamp;
}

export interface FinanceSettings {
  fixedCosts: number; 
  refundPolicy: {
    penaltyType: 'none' | 'rate' | 'fixed';
    penaltyRate?: number;
    penaltyFixed?: number;
    perDayRounding: 'floor' | 'round';
  };
  discountPolicy: {
    order: ('rateFirst' | 'fixedFirst')[];
  };
}

export interface PricingMatrix {
  productId: string;
  season: 'semester' | 'vacation';
  studentType: 'student' | 'n_student';
  basePrice: number;
  isActive: boolean;
  updatedAt: Timestamp;
}

export interface DiscountSnapshot {
  type: 'tutoring' | 'sibling' | 'coupon';
  method: 'fixed' | 'rate';
  value: number;
  amount: number;
  order: number;
}

export interface Invoice {
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
  discountsSnapshot: DiscountSnapshot[];
  finalPrice: number;
  status: 'issued' | 'paid' | 'refunded' | 'void';
  issuedAt: Timestamp;
  paidAt?: Timestamp;
  metadata?: any;
}

export interface RefundRecord {
  invoiceId: string;
  studentId: string;
  requestedAt: Timestamp;
  approvedAt?: Timestamp;
  usedDays: number;
  perDay: number;
  usedAmount: number;
  penalty: number;
  refundAmount: number;
  status: 'requested' | 'approved' | 'paid';
  reason?: string;
}

export interface KpiDaily {
  date: string; // YYYY-MM-DD
  totalRevenue: number; 
  totalDiscount: number;
  totalRefund: number;
  totalStudyMinutes: number; // 실제 총 공부 시간 (분)
  paidInvoiceCount: number;
  activeStudentCount: number;
  avgFinalPrice: number;
  breakevenStudents: number | null;
  updatedAt: Timestamp;
}

export interface StudentProfile {
  id: string;
  name: string;
  grade: string;
  schoolName: string;
  className?: string; // 소속 반 이름
  seatNo: number;
  seatZone?: 'A' | 'B' | 'Fixed' | 'Flex'; // 좌석 구역 정보
  targetDailyMinutes: number;
  parentUids: string[];
  createdAt: Timestamp;
  parentLinkCode?: string;
  flags?: {
    tutoringDiscountEnabled: boolean;
    siblingDiscountEnabled: boolean;
    siblingGroupId?: string;
  };
  currentEnrollment?: {
    productId: string;
    season: 'semester' | 'vacation';
    studentType: 'student' | 'n_student';
    cycleStartDate: Timestamp;
  };
}

export interface AttendanceCurrent {
  id: string;
  seatNo: number;
  status: "studying" | "away" | "break" | "absent";
  type?: "seat" | "aisle";
  updatedAt: Timestamp;
  lastCheckInAt?: Timestamp;
  gridX?: number; 
  gridY?: number; 
  studentId?: string; 
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName?: string;
  centerId: string;
  dateKey: string;
  status: 'confirmed_present' | 'confirmed_absent' | 'confirmed_late' | 'excused_absent' | 'requested';
  updatedAt: Timestamp;
  confirmedByUserId?: string;
}

export interface AttendanceRequest {
  id: string;
  studentId: string;
  studentName: string;
  centerId: string;
  type: 'late' | 'absence';
  date: string; // YYYY-MM-DD
  reason: string;
  status: 'requested' | 'approved' | 'rejected';
  penaltyApplied: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CounselingLog {
  id: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  type: "academic" | "life" | "career";
  content: string;
  improvement: string;
  attachedStudySummary?: { yyyymmdd: string, totalMinutes: number };
  createdAt: Timestamp;
  reservationId?: string;
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

export interface DailyReport {
  studentId: string;
  teacherId: string;
  dateKey: string;
  content: string;
  status: "draft" | "sent";
  studentName?: string;
  viewedAt?: Timestamp; // 학부모 열람 시점
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GrowthProgress {
  seasonLp: number; // 시즌 리셋 대상
  mastery: number; // 0-100 영구 성장 (부스트 영향)
  penaltyPoints: number; // 0-100 벌점
  stats: {
    focus: number;
    consistency: number;
    achievement: number;
    resilience: number;
  };
  dailyLpStatus?: {
    [dateKey: string]: {
      attendance: boolean;
      plan: boolean;
      routine: boolean;
      growth: boolean;
      dailyLpAmount?: number;
      bonus6h?: boolean;
      achievementCount?: number;
      checkedIn?: boolean;
    };
  };
  totalLpEarned: number; // 누적 LP
  lastResetAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SkillNode {
  id: string;
  branch: 'focus' | 'consistency' | 'achievement' | 'resilience';
  name: string;
  description: string;
  maxLevel: number;
  prerequisites: string[];
  unlockCondition: { stat: string; value: number };
  effects: { lp: number };
  iconKey: string;
}

export interface StudyPlanItem {
  studyPlanWeekId: string;
  centerId: string;
  studentId: string;
  title: string;
  weight: number;
  done: boolean;
  doneAt?: Timestamp;
  dateKey?: string;
  category?: 'schedule' | 'personal' | 'study';
  subject?: string;
  targetMinutes?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StudyLogDay {
  studentId: string;
  centerId: string;
  dateKey: string;
  totalMinutes: number;
  updatedAt: Timestamp;
  createdAt: Timestamp;
}

export interface StudySession {
  id: string;
  startTime: Timestamp;
  endTime: Timestamp;
  durationMinutes: number;
  createdAt: Timestamp;
}

export interface DailyStudentStat {
    centerId: string;
    studentId: string;
    dateKey: string;
    todayPlanCompletionRate: number;
    totalStudyMinutes: number;
    attendanceStreakDays: number;
    weeklyPlanCompletionRate: number;
    studyTimeGrowthRate: number;
    riskDetected: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface ParentAiCache {
  content: any;
  dateKey: string;
  createdAt: Timestamp;
}

export interface LeaderboardEntry {
  id: string;
  studentId: string;
  displayNameSnapshot: string;
  classNameSnapshot?: string; // 순위 집계 시점의 반 이름
  value: number;
  rank: number;
  updatedAt: Timestamp;
}
