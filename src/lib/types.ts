
import { Timestamp } from "firebase/firestore";

export type WithId<T> = T & { id: string };

export interface User {
  id: string;
  displayName: string;
  email: string;
  profileImageUrl?: string;
  schoolName?: string; // 소속 학교 추가
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CenterMembership {
  id: string; // This is the centerId
  role: 'student' | 'teacher' | 'parent' | 'centerAdmin';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: Timestamp;
  displayName?: string;
}

export interface StudentProfile {
  id: string;
  name: string;
  grade: string;
  schoolName: string; // 소속 학교 필수
  seatNo: number;
  targetDailyMinutes: number;
  parentUids: string[];
  createdAt: Timestamp;
}

export interface AttendanceCurrent {
  id: string;
  seatNo: number;
  status: "studying" | "away" | "break" | "absent";
  updatedAt: Timestamp;
  lastCheckInAt?: Timestamp;
  gridX?: number; // X coordinate in layout grid
  gridY?: number; // Y coordinate in layout grid
  studentId?: string; // Currently occupied student
}

export interface StudyPlan {
  studentId: string;
  subject: string;
  targetMinutes: number;
  completedMinutes: number;
  startDate: Timestamp;
  endDate: Timestamp;
  status: "active" | "completed";
  teacherId: string;
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

export interface Appointment {
  centerId: string;
  studentId: string;
  studentName?: string;
  teacherId?: string;
  teacherName?: string;
  startAt: Timestamp;
  endAt: Timestamp;
  status: 'requested' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  createdByRole: 'student' | 'teacher' | 'centerAdmin';
  teacherNote?: string;
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
