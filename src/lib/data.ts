import { PlaceHolderImages } from '@/lib/placeholder-images';

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'parent' | 'teacher' | 'admin';
  avatarUrl: string;
};

export type Student = {
  id: string;
  name: string;
  avatarUrl: string;
};

export const mockUser: User = {
  id: 'user-1',
  name: 'Alex Doe',
  email: 'alex.doe@example.com',
  role: 'student', // Change this to 'parent', 'teacher', or 'admin' to test different views
  avatarUrl: PlaceHolderImages.find(p => p.id === 'user-avatar-main')?.imageUrl ?? '',
};

export const mockStudents: Student[] = [
  { id: 'student-1', name: 'Sophia Lee', avatarUrl: PlaceHolderImages.find(p => p.id === 'student-avatar-1')?.imageUrl ?? '' },
  { id: 'student-2', name: 'Ben Carter', avatarUrl: PlaceHolderImages.find(p => p.id === 'student-avatar-2')?.imageUrl ?? '' },
  { id: 'student-3', name: 'Mia Garcia', avatarUrl: PlaceHolderImages.find(p => p.id === 'student-avatar-3')?.imageUrl ?? '' },
  { id: 'student-4', name: 'Leo Martinez', avatarUrl: PlaceHolderImages.find(p => p.id === 'student-avatar-4')?.imageUrl ?? '' },
  { id: 'student-5', name: 'Chloe Kim', avatarUrl: PlaceHolderImages.find(p => p.id === 'student-avatar-5')?.imageUrl ?? '' },
];

export const mockStudyPlan = [
  { id: 'task-1', title: 'Complete Math Chapter 5 exercises', done: true },
  { id: 'task-2', title: 'Review Physics notes on thermodynamics', done: true },
  { id: 'task-3', title: 'Write draft for History essay', done: false },
  { id: 'task-4', title: 'Practice Spanish vocabulary for 30 mins', done: false },
];

export const mockLeaderboards = {
  completionMaster: [
    { rank: 1, name: 'Sophia Lee', value: '98%', avatarUrl: mockStudents[0].avatarUrl },
    { rank: 2, name: 'Ben Carter', value: '95%', avatarUrl: mockStudents[1].avatarUrl },
    { rank: 3, name: 'Leo Martinez', value: '92%', avatarUrl: mockStudents[3].avatarUrl },
    { rank: 4, name: 'Chloe Kim', value: '88%', avatarUrl: mockStudents[4].avatarUrl },
    { rank: 5, name: 'Mia Garcia', value: '85%', avatarUrl: mockStudents[2].avatarUrl },
  ],
  consistencyLeader: [
    { rank: 1, name: 'Ben Carter', value: '45 days', avatarUrl: mockStudents[1].avatarUrl },
    { rank: 2, name: 'Sophia Lee', value: '38 days', avatarUrl: mockStudents[0].avatarUrl },
    { rank: 3, name: 'Mia Garcia', value: '32 days', avatarUrl: mockStudents[2].avatarUrl },
    { rank: 4, name: 'Chloe Kim', value: '25 days', avatarUrl: mockStudents[4].avatarUrl },
    { rank: 5, name: 'Leo Martinez', value: '21 days', avatarUrl: mockStudents[3].avatarUrl },
  ],
  growthChampion: [
    { rank: 1, name: 'Leo Martinez', value: '+45%', avatarUrl: mockStudents[3].avatarUrl },
    { rank: 2, name: 'Chloe Kim', value: '+35%', avatarUrl: mockStudents[4].avatarUrl },
    { rank: 3, name: 'Mia Garcia', value: '+20%', avatarUrl: mockStudents[2].avatarUrl },
    { rank: 4, name: 'Sophia Lee', value: '+15%', avatarUrl: mockStudents[0].avatarUrl },
    { rank: 5, name: 'Ben Carter', value: '-5%', avatarUrl: mockStudents[1].avatarUrl },
  ],
};

export const mockAtRiskStudents = [
  { student: mockStudents[4], risk: 'Low plan completion', reason: 'Completion rate below 50% for 2 weeks.' },
  { student: mockStudents[3], risk: 'High absence rate', reason: 'Absent 4 days in the last month.' },
  { student: mockStudents[1], risk: 'Decreased study time', reason: 'Study time has dropped by 35%.' },
];

export const mockParentSummary = {
  message: "Ben had a productive week, showing great consistency in his attendance. While his plan completion saw a slight dip, his effort in math has been noteworthy. Let's encourage him to break down his larger tasks to make them more manageable.",
  keyMetrics: [
    { name: 'Plan Completion', value: '82%', trend: '-5% from last week' },
    { name: 'Attendance', value: '100%', trend: 'Stable' },
    { name: 'Study Time Growth', value: '+10%', trend: 'Up from last week' },
  ],
  recommendations: [
    "Celebrate his perfect attendance streak!",
    "Ask about his math progress and what he's enjoying.",
    "Suggest breaking down weekly goals into smaller daily tasks.",
  ]
};

export const mockAiCoachMessage = {
  message: "Hi Alex, great job on staying consistent with your physics reviews! I noticed your history essay draft is still pending. How about setting a specific 45-minute block to just outline the main points? Getting started is often the hardest part!"
};

export const mockAttendance = mockStudents.map(s => ({
  ...s,
  status: Math.random() > 0.8 ? (Math.random() > 0.5 ? 'Absent' : 'Late') : 'Present'
}));

export const mockInviteCodes = [
    { code: 'teach2024-alpha', role: 'Teacher', uses: '5/10', expires: '2024-12-31', status: 'Active' },
    { code: 'student-new-sem', role: 'Student', uses: '88/100', expires: '2024-09-01', status: 'Active' },
    { code: 'parent-welcome-kit', role: 'Parent', uses: '42/50', expires: '2024-10-31', status: 'Active' },
    { code: 'admin-temp-access', role: 'Admin', uses: '1/1', expires: '2024-08-15', status: 'Expired' },
    { code: 'summer-camp-std', role: 'Student', uses: '25/25', expires: '2024-07-30', status: 'Exhausted' },
];
