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

export interface CenterMembership {
  id: string; // This is the centerId
  role: 'student' | 'teacher' | 'centerAdmin';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: Timestamp;
  displayName?: string;
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

export interface CounselingNote {
  centerId: string;
  appointmentId: string;
  studentId: string;
  teacherId: string;
  studentName?: string;
  content: string;
  visibility: 'student_and_parent' | 'teacher_only';
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