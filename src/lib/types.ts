
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
  role: 'student' | 'teacher' | 'parent' | 'centerAdmin' | 'owner';
  status: 'active' | 'onHold' | 'withdrawn' | 'pending';
  joinedAt: Timestamp;
  displayName?: string;
  className?: string;
  linkedStudentIds?: string[];
  monthlyFee?: number;
  baseFee?: number;
  tutoringDiscount?: boolean;
  siblingDiscount?: boolean;
}

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
  className?: string;
  seatNo: number;
  seatZone?: string;
  targetDailyMinutes: number;
  parentUids: string[];
  createdAt: Timestamp;
  parentLinkCode?: string;
  monthlyFee?: number;
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
  targetMinutes?: number;
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
  viewedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  createdAt: Timestamp;
}
