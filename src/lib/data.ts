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
  name: '알렉스',
  email: 'alex.doe@example.com',
  role: 'student', // 'parent', 'teacher', 'admin'으로 변경하여 다른 뷰 테스트
  avatarUrl: PlaceHolderImages.find(p => p.id === 'user-avatar-main')?.imageUrl ?? '',
};

export const mockStudents: Student[] = [
  { id: 'student-1', name: '이소피아', avatarUrl: PlaceHolderImages.find(p => p.id === 'student-avatar-1')?.imageUrl ?? '' },
  { id: 'student-2', name: '벤 카터', avatarUrl: PlaceHolderImages.find(p => p.id === 'student-avatar-2')?.imageUrl ?? '' },
  { id: 'student-3', name: '미아 가르시아', avatarUrl: PlaceHolderImages.find(p => p.id === 'student-avatar-3')?.imageUrl ?? '' },
  { id: 'student-4', name: '레오 마르티네즈', avatarUrl: PlaceHolderImages.find(p => p.id === 'student-avatar-4')?.imageUrl ?? '' },
  { id: 'student-5', name: '클로이 킴', avatarUrl: PlaceHolderImages.find(p => p.id === 'student-avatar-5')?.imageUrl ?? '' },
];

export const mockStudyPlan = [
  { id: 'task-1', title: '수학 5단원 연습문제 풀기', done: true },
  { id: 'task-2', title: '물리 열역학 노트 복습', done: true },
  { id: 'task-3', title: '역사 에세이 초안 작성', done: false },
  { id: 'task-4', title: '30분간 스페인어 단어 연습', done: false },
];

export const mockLeaderboards = {
  completionMaster: [
    { rank: 1, name: '이소피아', value: '98%', avatarUrl: mockStudents[0].avatarUrl },
    { rank: 2, name: '벤 카터', value: '95%', avatarUrl: mockStudents[1].avatarUrl },
    { rank: 3, name: '레오 마르티네즈', value: '92%', avatarUrl: mockStudents[3].avatarUrl },
    { rank: 4, name: '클로이 킴', value: '88%', avatarUrl: mockStudents[4].avatarUrl },
    { rank: 5, name: '미아 가르시아', value: '85%', avatarUrl: mockStudents[2].avatarUrl },
  ],
  consistencyLeader: [
    { rank: 1, name: '벤 카터', value: '45일', avatarUrl: mockStudents[1].avatarUrl },
    { rank: 2, name: '이소피아', value: '38일', avatarUrl: mockStudents[0].avatarUrl },
    { rank: 3, name: '미아 가르시아', value: '32일', avatarUrl: mockStudents[2].avatarUrl },
    { rank: 4, name: '클로이 킴', value: '25일', avatarUrl: mockStudents[4].avatarUrl },
    { rank: 5, name: '레오 마르티네즈', value: '21일', avatarUrl: mockStudents[3].avatarUrl },
  ],
  growthChampion: [
    { rank: 1, name: '레오 마르티네즈', value: '+45%', avatarUrl: mockStudents[3].avatarUrl },
    { rank: 2, name: '클로이 킴', value: '+35%', avatarUrl: mockStudents[4].avatarUrl },
    { rank: 3, name: '미아 가르시아', value: '+20%', avatarUrl: mockStudents[2].avatarUrl },
    { rank: 4, name: '이소피아', value: '+15%', avatarUrl: mockStudents[0].avatarUrl },
    { rank: 5, name: '벤 카터', value: '-5%', avatarUrl: mockStudents[1].avatarUrl },
  ],
};

export const mockAtRiskStudents = [
  { student: mockStudents[4], risk: '낮은 계획 완수율', reason: '2주 동안 완수율 50% 미만.' },
  { student: mockStudents[3], risk: '잦은 결석률', reason: '지난달 4일 결석.' },
  { student: mockStudents[1], risk: '학습 시간 감소', reason: '학습 시간이 35% 감소했습니다.' },
];

export const mockParentSummary = {
  message: "벤은 이번 주에 생산적인 한 주를 보냈으며, 출석에 있어 꾸준함을 보여주었습니다. 계획 완수율은 약간 떨어졌지만, 수학에 대한 그의 노력은 주목할 만합니다. 그가 큰 과제들을 더 관리하기 쉬운 작은 과제들로 나누도록 격려해 줍시다.",
  keyMetrics: [
    { name: '계획 완수율', value: '82%', trend: '지난주 대비 -5%' },
    { name: '출석률', value: '100%', trend: '변동 없음' },
    { name: '학습 시간 성장', value: '+10%', trend: '지난주 대비 증가' },
  ],
  recommendations: [
    "그의 완벽한 출석을 축하해주세요!",
    "그의 수학 진행 상황과 그가 즐기고 있는 것에 대해 물어보세요.",
    "주간 목표를 더 작은 일일 과제로 나누도록 제안하세요.",
  ]
};

export const mockAiCoachMessage = {
  message: "알렉스, 물리 복습을 꾸준히 해줘서 정말 잘했어요! 역사 에세이 초안이 아직 제출되지 않은 것을 확인했어요. 주요 요점만 간략하게 작성하는 데 45분 정도 시간을 투자해 보는 건 어떨까요? 시작이 반이라는 말이 있잖아요!"
};

export const mockAttendance = mockStudents.map(s => ({
  ...s,
  status: Math.random() > 0.8 ? (Math.random() > 0.5 ? '결석' : '지각') : '출석'
}));

export const mockInviteCodes = [
    { code: 'teach2024-alpha', role: '교사', uses: '5/10', expires: '2024-12-31', status: '활성' },
    { code: 'student-new-sem', role: '학생', uses: '88/100', expires: '2024-09-01', status: '활성' },
    { code: 'parent-welcome-kit', role: '학부모', uses: '42/50', expires: '2024-10-31', status: '활성' },
    { code: 'admin-temp-access', role: '관리자', uses: '1/1', expires: '2024-08-15', status: '만료됨' },
    { code: 'summer-camp-std', role: '학생', uses: '25/25', expires: '2024-07-30', status: '소진됨' },
];
