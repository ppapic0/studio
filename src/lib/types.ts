
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
  linkedStudentIds?: string[];
  monthlyFee?: number;
  tutoringDiscount?: boolean;
  siblingDiscount?: boolean;
}

export interface InviteCode {
  id: string;
  centerId: string;
  intendedRole: 'student' | 'teacher' | 'parent' | 'centerAdmin';
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
  fixedCosts: number; // Legacy, replaced by monthly collection
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
  totalRevenue: number; // Accrued daily revenue (Total / 28 per active invoice)
  totalDiscount: number;
  totalRefund: number;
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
  seatNo: number;
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
  updatedAt: Timestamp;
  lastCheckInAt?: Timestamp;
  gridX?: number; 
  gridY?: number; 
  studentId?: string; 
}

export interface CounselingLog {
  studentId: string;
  teacherId: string;
  type: "academic" | "life" | "career";
  content: string;
  improvement: string;
  attachedStudySummary?: { yyyymmdd: string, totalMinutes: number };
  createdAt: Timestamp;
}

export interface DailyReport {
  studentId: string;
  teacherId: string;
  dateKey: string;
  content: string;
  status: "draft" | "sent";
  studentName?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GrowthProgress {
  level: number;
  currentXp: number;
  nextLevelXp: number;
  stats: {
    focus: number;
    consistency: number;
    achievement: number;
    resilience: number;
  };
  skills: Record<string, {
    level: number;
    unlockedAt: Timestamp;
  }>;
  updatedAt: Timestamp;
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
