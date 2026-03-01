
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
  linkedStudentIds?: string[]; // 학부모용: 연결된 자녀 ID 목록
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
  parentLinkCode?: string; // 부모님 연동용 4자리 코드
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
