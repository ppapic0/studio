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
  role: 'student' | 'teacher' | 'parent' | 'centerAdmin';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: Timestamp;
  displayName?: string;
  linkedStudentIds?: string[];
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

export interface SkillNode {
  id: string;
  branch: 'focus' | 'consistency' | 'achievement' | 'resilience';
  name: string;
  description: string;
  maxLevel: number;
  prerequisites: string[];
  unlockCondition: {
    stat?: keyof GrowthProgress['stats'];
    value?: number;
    customRule?: string;
  };
  effects: Record<string, any>;
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StudyLogDay {
    centerId: string;
    studentId: string;
    dateKey: string;
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
    studentName?: string;
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
