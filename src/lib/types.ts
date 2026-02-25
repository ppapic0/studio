import { Timestamp } from "firebase/firestore";

export type WithId<T> = T & { id: string };

export interface User {
  id: string;
  displayName: string;
  email: string;
  profileImageUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Student {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface Center {
  name: string;
  description?: string;
  subscriptionTier: string;
}

export interface CenterMembership {
  id: string; // This is the centerId
  role: 'student' | 'teacher' | 'parent' | 'centerAdmin';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: Timestamp;
  displayName?: string;
  linkedStudentIds?: string[];
}

export interface StudyPlanWeek {
  centerId: string;
  studentId: string;
  weekKey: string; // YYYY-Www
  createdAt: Timestamp;
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StudyLogDay {
    centerId: string;
    studentId: string;
    dateKey: string; // YYYY-MM-DD
    totalMinutes: number;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface AttendanceRecord {
    centerId: string;
    studentId: string;
    dateKey: string;
    status: 'requested' | 'confirmed_present' | 'confirmed_absent' | 'confirmed_late' | 'excused_absent';
    checkInAt?: Timestamp;
    checkOutAt?: Timestamp;
    confirmedByUserId?: string;
    updatedAt: Timestamp;
    studentName?: string; // Denormalized for display
    studentAvatar?: string; // Denormalized for display
}

export interface LeaderboardEntry {
    centerId: string;
    periodKey: string; // YYYY-Www or YYYY-MM
    metricKey: string;
    studentId: string;
    value: number;
    rank: number;
    displayNameSnapshot: string;
    updatedAt: Timestamp;
}

export interface DailyStudentStat {
    centerId: string;
    studentId: string;
    dateKey: string; // YYYY-MM-DD
    todayPlanCompletionRate: number; // 0.0 - 1.0
    totalStudyMinutes: number;
    attendanceStreakDays: number;
    weeklyPlanCompletionRate: number; // 0.0 - 1.0
    studyTimeGrowthRate: number; // e.g., 0.2 for +20%
    riskDetected: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface AIOutput {
    centerId: string;
    studentId: string;
    type: 'riskFlag' | 'parentSummary' | 'intervention';
    message: string;
    basedOnMetricsSnapshot: string; // JSON string
    modelUsed: string;
    createdAt: Timestamp;
}

export interface InviteCode {
    code: string;
    centerId: string;
    intendedRole: 'student' | 'teacher' | 'parent' | 'admin';
    expiresAt: Timestamp;
    maxUses: number;
    usedCount: number;
    createdByUserId: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
