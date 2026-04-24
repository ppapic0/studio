
import { Timestamp } from "firebase/firestore";

export type WithId<T> = T & { id: string };

export type SupportedUniversityThemeKey =
  | 'seoul-national'
  | 'yonsei'
  | 'korea'
  | 'sogang'
  | 'sungkyunkwan'
  | 'hanyang'
  | 'chung-ang'
  | 'kyung-hee'
  | 'hufs'
  | 'seoul-city'
  | 'konkuk'
  | 'dongguk'
  | 'hongik'
  | 'kookmin'
  | 'soongsil'
  | 'sejong'
  | 'dankook';

export interface LegalConsentSnapshot {
  agreed: boolean;
  version?: string;
  agreedAt?: Timestamp | null;
  source?: string;
  channel?: string;
}

export interface UserLegalConsents {
  terms?: LegalConsentSnapshot;
  privacy?: LegalConsentSnapshot;
  age14?: LegalConsentSnapshot;
  marketingEmail?: LegalConsentSnapshot;
}

export interface OperationalExclusions {
  rankings?: boolean;
  sms?: boolean;
}

export interface User {
  id: string;
  displayName: string;
  email: string;
  profileImageUrl?: string;
  schoolName?: string; 
  phoneNumber?: string;
  isCounselingDemo?: boolean;
  operationalExclusions?: OperationalExclusions;
  legalConsents?: UserLegalConsents;
  targetDailyMinutes?: number;
  targetDailyMinutesSource?: 'default' | 'routine' | 'manual';
  examCountdowns?: Array<{
    id: string;
    title: string;
    date: string;
  }>;
  goalPathType?: 'school' | 'job';
  goalPathLabel?: string;
  universityThemeKey?: SupportedUniversityThemeKey | null;
  studyRoutineOnboarding?: RoutineOnboardingState;
  studyRoutineProfile?: UserStudyProfile;
  studyPlannerDiagnostic?: StudyPlannerDiagnosticRecord;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Student {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface CenterMembership {
  id: string; 
  role: 'student' | 'teacher' | 'parent' | 'centerAdmin' | 'owner';
  status: 'active' | 'onHold' | 'withdrawn' | 'pending';
  joinedAt: Timestamp;
  displayName?: string;
  className?: string;
  phoneNumber?: string;
  isCounselingDemo?: boolean;
  operationalExclusions?: OperationalExclusions;
  linkedStudentIds?: string[];
  // Legacy read compatibility only. New writes go to billingProfiles.
  monthlyFee?: number;
  baseFee?: number;
  tutoringDiscount?: boolean;
  siblingDiscount?: boolean;
}

export type 센터Membership = CenterMembership;

export interface Invoice {
  id: string;
  studentId: string;
  studentName: string;
  cycleStartDate: Timestamp;
  cycleEndDate: Timestamp;
  collectionStartDate?: Timestamp;
  collectionEndDate?: Timestamp;
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
  trackCategory?: 'studyRoom' | 'academy';
  isActionRequired?: boolean;
  dueLabel?: string;
  paymentMethodSummary?: string;
  receiptUrl?: string;
  nextAction?: string;
  priority?: 'normal' | 'high' | 'critical';
  readAt?: Timestamp;
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

export type BusinessLedgerDirection = 'income' | 'expense';
export type BusinessLedgerTrackScope = 'center' | 'studyRoom' | 'academy';
export type BusinessLedgerPaymentMethod = 'card' | 'transfer' | 'cash' | 'auto_debit' | 'other';
export type BusinessLedgerProofStatus =
  | 'not_needed'
  | 'pending'
  | 'card_receipt'
  | 'cash_receipt'
  | 'tax_invoice'
  | 'simple_receipt';
export type BusinessLedgerCategory =
  | 'other_tuition_income'
  | 'material_income'
  | 'subsidy_income'
  | 'refund_recovery'
  | 'other_income'
  | 'rent'
  | 'payroll'
  | 'utilities'
  | 'marketing'
  | 'sms'
  | 'supplies'
  | 'snacks'
  | 'refund_expense'
  | 'payment_fee'
  | 'tax'
  | 'other_expense';

export interface BusinessLedgerEntry {
  id: string;
  centerId: string;
  entryDate: Timestamp;
  monthKey: string;
  direction: BusinessLedgerDirection;
  trackScope: BusinessLedgerTrackScope;
  category: BusinessLedgerCategory;
  description: string;
  counterparty?: string | null;
  amount: number;
  paymentMethod: BusinessLedgerPaymentMethod;
  proofStatus: BusinessLedgerProofStatus;
  memo?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdByUid: string;
  updatedByUid: string;
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
  phoneNumber?: string | null;
  className?: string;
  seatNo: number;
  seatId?: string;
  roomId?: string;
  roomSeatNo?: number;
  seatLabel?: string;
  seatZone?: string;
  targetDailyMinutes: number;
  targetDailyMinutesSource?: 'default' | 'routine' | 'manual';
  isCounselingDemo?: boolean;
  operationalExclusions?: OperationalExclusions;
  parentUids: string[];
  createdAt: Timestamp;
  parentLinkCode?: string;
  expectedArrivalTime?: string;
  // Legacy read compatibility only. New writes go to billingProfiles.
  monthlyFee?: number;
  currentEnrollment?: {
    productId: string;
    season: 'semester' | 'vacation';
    studentType: 'student' | 'n_student';
    cycleStartDate: Timestamp;
  };
  examCountdowns?: Array<{
    id: string;
    title: string;
    date: string; // yyyy-MM-dd
  }>;
  goalPathType?: 'school' | 'job';
  goalPathLabel?: string;
  universityThemeKey?: SupportedUniversityThemeKey | null;
  studyRoutineOnboarding?: RoutineOnboardingState;
  studyRoutineProfile?: UserStudyProfile;
  studyRoutineWorkspace?: RoutineWorkspaceState;
  studyPlannerDiagnostic?: StudyPlannerDiagnosticRecord;
  routineSocialProfile?: RoutineSocialProfile;
  savedRoutineTemplates?: RoutineTemplateSave[];
}

export interface BillingProfile {
  id: string;
  studentId: string;
  centerId: string;
  monthlyFee?: number;
  baseFee?: number;
  tutoringDiscount?: boolean;
  siblingDiscount?: boolean;
  currentEnrollment?: {
    productId: string;
    season: 'semester' | 'vacation';
    studentType: 'student' | 'n_student';
    cycleStartDate: Timestamp;
  };
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type ScheduleSubjectKey = '국어' | '수학' | '영어' | '탐구';

export interface StudentScheduleOuting {
  id: string;
  kind?: 'outing' | 'academy';
  title?: string | null;
  startTime: string;
  endTime: string;
  reason: string;
}

export interface StudyRoomPeriodBlock {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  description?: string | null;
}

export interface StudyRoomClassScheduleTemplate {
  id?: string;
  centerId: string;
  className: string;
  weekdays: number[];
  arrivalTime: string;
  departureTime: string;
  note?: string | null;
  blocks: StudyRoomPeriodBlock[];
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdByUid?: string | null;
  updatedByUid?: string | null;
}

export interface StudentScheduleDoc {
  uid: string;
  studentName: string;
  centerId: string | null;
  dateKey: string;
  timezone: string;
  arrivalPlannedAt: string;
  departurePlannedAt: string;
  hasExcursion: boolean;
  excursionStartAt: string | null;
  excursionEndAt: string | null;
  excursionReason: string | null;
  note: string | null;
  recurrenceSourceId: string | null;
  status: 'scheduled' | 'checked_in' | 'excursion' | 'checked_out' | 'absent';
  actualArrivalAt: Timestamp | null;
  actualDepartureAt: Timestamp | null;
  inTime: string;
  outTime: string;
  isAbsent: boolean;
  outings: StudentScheduleOuting[];
  recommendedStudyMinutes?: number | null;
  recommendedWeeklyDays?: number | null;
  source?: 'manual' | 'regular-routine' | 'planner-diagnostic';
  classScheduleId?: string | null;
  classScheduleName?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface StudentScheduleSettings {
  weekdayTemplates: Record<string, StudentScheduleDoc>;
  savedRoutines: Array<{
    id: string;
    name: string;
    schedule: StudentScheduleDoc;
  }>;
  updatedAt?: Timestamp;
}

export interface StudentScheduleTemplate {
  id?: string;
  name: string;
  weekdays: number[];
  arrivalPlannedAt: string;
  departurePlannedAt: string;
  academyNameDefault?: string | null;
  academyStartAtDefault?: string | null;
  academyEndAtDefault?: string | null;
  hasExcursionDefault: boolean;
  defaultExcursionStartAt: string | null;
  defaultExcursionEndAt: string | null;
  defaultExcursionReason?: string | null;
  note?: string | null;
  classScheduleId?: string | null;
  classScheduleName?: string | null;
  active: boolean;
  timezone: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type PlannerLearnerGrade =
  | 'middle-1'
  | 'middle-2'
  | 'middle-3'
  | 'high-1'
  | 'high-2'
  | 'high-3'
  | 'n-susi'
  | 'gongsi';

export type PlannerMainGoal = 'csat' | 'school' | 'both' | 'gongsi' | 'etc';

export type PlannerExamWindow = 'under-1-month' | 'one-to-three-months' | 'over-three-months';

export type PlannerStudyHoursBand = 'under-2' | '2-4' | '4-6' | '6-plus';

export type PlannerLikert = 1 | 2 | 3 | 4 | 5;

export type PlannerSubject =
  | '국어'
  | '수학'
  | '영어'
  | '탐구'
  | '한국사'
  | '전공'
  | '행정법/행정학'
  | '기타';

export type PlannerStudyActivity = '개념이해' | '문제풀이' | '암기' | '오답정리' | '백지회상' | '설명해보기';

export type PlannerBurnoutReason =
  | '너무 어려워서'
  | '왜 해야 하는지 모르겠어서'
  | '그냥 지쳐서'
  | '특별히 없음';

export type PlannerMotivationType = '더 잘하고 싶어서' | '못하면 안 될 것 같아서' | '모르겠음';

export type PlannerSuccessRecency = '최근 1주' | '1개월 내' | '기억 안 남';

export interface StudyPlannerAnswers {
  grade: PlannerLearnerGrade;
  goal: PlannerMainGoal;
  examWindow: PlannerExamWindow;
  averageStudyHours: PlannerStudyHoursBand;
  planningScore: PlannerLikert;
  reflectionScore: PlannerLikert;
  unknownHandling: '바로 찾아봄' | '표시 후 나중에' | '그냥 넘김';
  subjectGrades: Partial<Record<ScheduleSubjectKey, number | null>>;
  topTimeSubjects: PlannerSubject[];
  studyActivities: PlannerStudyActivity[];
  lowEfficiencySubject: PlannerSubject | '없음';
  burnoutReasons: PlannerBurnoutReason[];
  motivationType: PlannerMotivationType;
  lastSuccessRecency: PlannerSuccessRecency;
}

export interface StudyPlannerMetric {
  label: '학습 계획성' | '자기성찰' | '과목 밸런스' | '학습 활동 다양성' | '동기 수준';
  value: number;
}

export interface StudyPlannerScores {
  planning: number;
  reflection: number;
  subjectBalance: number;
  activityDiversity: number;
  motivation: number;
}

export interface StudyPlannerFlags {
  lowPlanningFlag: boolean;
  lowReflectionFlag: boolean;
  lowMotivationFlag: boolean;
  efficiencyMismatchFlag: boolean;
  burnoutRiskFlag: boolean;
  avoidanceMotivationFlag: boolean;
}

export interface StudyPlannerInsight {
  id: string;
  text: string;
}

export interface GeneratedStudyTodo {
  과목: string;
  활동: string;
  시간: number;
}

export interface GeneratedStudyPlan {
  weekly_balance: Record<ScheduleSubjectKey, number>;
  daily_todos: GeneratedStudyTodo[];
  coaching_message: string;
}

export interface StudyPlannerDiagnosticResult {
  scores: StudyPlannerScores;
  flags: StudyPlannerFlags;
  metrics: StudyPlannerMetric[];
  insights: StudyPlannerInsight[];
  generatedPlan: GeneratedStudyPlan;
  recommendedWeeklyDays: number;
  recommendedDailyMinutes: number;
  createdAtISO: string;
}

export interface StudyPlannerDiagnosticRecord {
  answers: StudyPlannerAnswers;
  result: StudyPlannerDiagnosticResult;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type RoutineVisibility = 'private' | 'friends' | 'group' | 'anonymous' | 'profile';

export type SharingPreference = RoutineVisibility;

export type RoutineReactionType = 'cheer' | 'save' | 'reference';

export type PeerSimilarityTag =
  | 'same-grade'
  | 'same-goal'
  | 'same-weak-subject'
  | 'same-session'
  | 'same-focus-time'
  | 'same-plan-style';

export interface RoutineReaction {
  type: RoutineReactionType;
  label: string;
  count: number;
  viewerReacted?: boolean;
}

export interface RoutineTemplateSave {
  routineId: string;
  routineName: string;
  authorAlias: string;
  source: 'explore-home' | 'routine-detail' | 'friend-routine' | 'group-routine' | 'recommended';
  savedAtISO: string;
}

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  focusLabel: string;
  memberCount: number;
  accentLabel: string;
}

export interface RoutineSocialProfile {
  visibility: RoutineVisibility;
  previewAlias: string;
  selectedGroupIds: string[];
  allowCheer: boolean;
  allowTemplateSave: boolean;
  updatedAt?: Timestamp;
}

export interface RoutineOnboardingState {
  status?: 'completed' | 'dismissed';
  presentedAt?: Timestamp;
  completedAt?: Timestamp;
  dismissedAt?: Timestamp;
  version?: number;
  updatedAt?: Timestamp;
}

export type StudyAvailabilitySlot =
  | 'weekday-morning'
  | 'weekday-after-school'
  | 'weekday-evening'
  | 'weekday-night'
  | 'weekend-morning'
  | 'weekend-afternoon'
  | 'weekend-evening';

export type RoutineDifficulty = 'easy' | 'balanced' | 'stretch';

export type LearnerType =
  | 'middle_school_core'
  | 'high_school_internal'
  | 'high3_csat'
  | 'n_susi'
  | 'gongsi'
  | 'goal_searching';

export type QuestionSection =
  | '목표 파악'
  | '공부시간 파악'
  | '과목 배분 파악'
  | '계획 방식 파악';

export interface OnboardingProgressMeta {
  currentStep: number;
  totalSteps: number;
  progressPercent: number;
  remainingMinutesLabel: string;
  section: QuestionSection;
  sectionLabel: string;
}

export interface OnboardingAnswer {
  learnerType: LearnerType;
  dailyStudyHours: '4h' | '6h' | '8h' | '10h' | '12h-plus';
  mainBlockLength: '90m' | '120m' | '150m' | '180m' | 'long-flex';
  breakPreference: '10-15' | '20' | '30' | '40+' | 'variable';
  subjectPriority: string[];
  weakSubjects: string[];
  focusPeak: 'morning' | 'late-morning' | 'afternoon' | 'evening' | 'night' | 'variable';
  planBreakReason:
    | 'too-much-volume'
    | 'subject-avoidance'
    | 'late-start'
    | 'concentration-drop'
    | 'break-overrun'
    | 'subject-imbalance'
    | 'finish-gap';
  planningStyle: 'time-table' | 'subject-hours' | 'big-block' | 'guided' | 'unknown';
  reflectionStyle: 'time-check' | 'subject-progress' | 'memo' | 'auto-summary' | 'not-ready';
  sharingPreference: SharingPreference;
  gradeBand: 'middle' | 'high' | 'repeat';
  examGoal: 'school-rank' | 'mock-improvement' | 'college-sprint' | 'balance-recovery' | 'habit-reset' | 'specific-test' | 'undecided';
  weekdayAvailability: StudyAvailabilitySlot[];
  weekendAvailability: StudyAvailabilitySlot[];
  difficultSubjects: string[];
  laggingStudyTypes: Array<'concept' | 'problem-solving' | 'memorization' | 'review' | 'assignment'>;
  derailReason: 'slow-start' | 'phone' | 'too-hard' | 'subject-switch' | 'fatigue' | 'unclear-priority' | 'execution-gap';
  preferredSessionLength: '25-30' | '45-50' | '70-80' | 'flexible';
  preferredBreakStyle: 'short-often' | 'one-long' | 'subject-switch' | 'fixed' | 'unsure';
  preferredPlanStyle: 'time-table' | 'block' | 'todo' | 'guided' | 'searching';
  supportMode: 'solo' | 'remind' | 'peers' | 'teacher' | 'adaptive';
  bestFocusTime: 'morning' | 'afternoon' | 'evening' | 'late-night' | 'variable';
  legacyReflectionStyle: 'daily-brief' | 'weekly-deep' | 'auto-summary' | 'not-yet';
}

export interface StudyPlanArchetype {
  id:
    | 'hs_balanced_exam'
    | 'math_heavy_exam'
    | 'korean_math_core'
    | 'n_susi_intensive'
    | 'gongsi_standard'
    | 'weak_subject_repair'
    | 'volume_recovery'
    | 'long_block_stable';
  name: string;
  shortLabel: string;
  summary: string;
  fitDescription: string;
  strategyHeadline: string;
  defaultStudyLabel: string;
  defaultBlockLabel: string;
  defaultBreakLabel: string;
  defaultTypeLabel: string;
}

export type RoutineArchetype = StudyPlanArchetype;

export interface StudyBlock {
  id: string;
  title: string;
  subjectId?: string;
  subjectLabel?: string;
  kind: 'warmup' | 'focus' | 'problem' | 'concept' | 'review' | 'memorization' | 'recovery';
  startTime: string;
  endTime: string;
  durationMinutes: number;
  instruction: string;
  fallbackInstruction?: string;
}

export interface ReviewRule {
  id: string;
  title: string;
  timing: string;
  description: string;
}

export interface DistractionRule {
  id: string;
  trigger: string;
  response: string;
  fallback: string;
}

export interface SubjectAllocation {
  subjectId: string;
  subjectLabel: string;
  minutes: number;
  hoursLabel: string;
  ratio: number;
  emphasis: 'core' | 'support' | 'maintenance';
  rationale: string;
}

export interface BreakRule {
  id: string;
  label: string;
  minutes: number;
  description: string;
}

export interface RecommendationReason {
  id: string;
  label: string;
  text: string;
}

export interface RecommendationFeedback {
  downshift: string[];
  upshift: string[];
  operatingRules: string[];
}

export interface StudyPlanTemplate {
  archetypeId: StudyPlanArchetype['id'];
  name: string;
  subtitle: string;
  totalStudyMinutes: number;
  mainBlockMinutes: 120 | 150 | 180;
  breakRule: BreakRule;
  subjectAllocations: SubjectAllocation[];
  studyBlocks: StudyBlock[];
  recommendationReasons: RecommendationReason[];
  feedback: RecommendationFeedback;
  fitCopy: string[];
  weekendExtension: string;
}

export interface RecommendedStudyPlan {
  id: string;
  archetypeId: StudyPlanArchetype['id'];
  priority: 1 | 2 | 3;
  badge: string;
  name: string;
  subtitle: string;
  oneLineDescription: string;
  totalStudyMinutes: number;
  totalStudyLabel: string;
  blockMeta: string;
  breakMeta: string;
  typeMeta: string;
  fitStudent: string;
  difficulty: RoutineDifficulty;
  difficultyLabel: string;
  recommendationReasons: string[];
  reasonEntries: RecommendationReason[];
  coreStrategies: string[];
  dayStructureSummary: string;
  dayPreviewTitle: string;
  dayPreview: string[];
  subjectPlacement: string;
  subjectAllocations: SubjectAllocation[];
  sessionRule: string;
  breakRule: string;
  breakRuleDetail: BreakRule;
  studyBlocks: StudyBlock[];
  reviewRules: ReviewRule[];
  distractionRules: DistractionRule[];
  downgradeTitle: string;
  downgradeVersion: string[];
  upgradeTitle: string;
  upgradeVersion: string[];
  fitTitle: string;
  fitCopy: string[];
  ruleTitle: string;
  ruleCopy: string[];
  whyTitle: string;
  whyCopy: string[];
  weekendExtension: string;
  recommendationFeedback: RecommendationFeedback;
  primaryCta: string;
  secondaryCta: string;
}

export type RecommendedRoutine = RecommendedStudyPlan;

export interface SharedRoutine {
  id: string;
  source: 'similar' | 'goal' | 'group' | 'popular' | 'friend';
  title: string;
  summary: string;
  authorAlias: string;
  authorName?: string;
  authorMode: 'anonymous' | 'profile';
  authorSchoolLabel?: string;
  gradeLabel: string;
  goalLabel: string;
  styleTags: string[];
  weakSubjectTags: string[];
  similarityTags: PeerSimilarityTag[];
  fitSummary: string;
  authorNote: string;
  reflectionTip: string;
  dayStructureLabel: string;
  subjectBalanceLabel: string;
  breakRuleLabel: string;
  reviewRuleLabel: string;
  reactions: RoutineReaction[];
  visibility: RoutineVisibility;
  groupId?: string;
  groupName?: string;
  sourceAnswers: Pick<
    OnboardingAnswer,
    'gradeBand' | 'examGoal' | 'difficultSubjects' | 'preferredSessionLength' | 'bestFocusTime' | 'preferredPlanStyle'
  >;
  routine: RecommendedRoutine;
}

export interface UserStudyProfile {
  version: number;
  planningMode?: 'recommended-routine' | 'feedback-coach';
  answers: OnboardingAnswer;
  archetypeId: StudyPlanArchetype['id'];
  archetypeName: string;
  recommendedRoutines: RecommendedStudyPlan[];
  selectedRoutineId: string;
  selectedRoutine: RecommendedStudyPlan;
  sharingPreference: SharingPreference;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface DailyRoutineBlock {
  id: string;
  title: string;
  subjectId?: string;
  subjectLabel?: string;
  studyType: 'concept' | 'problem-solving' | 'memorization' | 'review' | 'warmup' | 'recovery';
  studyTypeLabel: string;
  startTime?: string;
  sequence: number;
  durationMinutes: number;
  done: boolean;
  rewardLabel: string;
  feedbackMessage: string;
  instruction: string;
  fallbackInstruction?: string;
}

export interface DailyRoutinePlan {
  dateKey: string;
  routineId: string;
  routineName: string;
  routineSummary: string;
  archetypeName: string;
  totalMinutes: number;
  targetFocus: string;
  reminderMessage: string;
  tags: string[];
  blocks: DailyRoutineBlock[];
  executionRules: DistractionRule[];
  reviewRules: ReviewRule[];
  recommendedAdjustments: string[];
  startedAt?: string | null;
}

export interface RoutineReflectionEntry {
  dateKey: string;
  goodPoint: string;
  derailReason: string;
  keepOneThing: string;
  changeOneThing: string;
  mood: 'low' | 'steady' | 'good' | 'great';
  energy: 'low' | 'medium' | 'high';
  completedBlockCount: number;
  totalBlockCount: number;
  createdAt?: Timestamp;
}

export interface WeeklyRoutineSummary {
  weekKey: string;
  completionRate: number;
  consistencyLabel: string;
  topSubject: string;
  balanceStatus: 'balanced' | 'skewed' | 'recovery';
  reflectionHeadline: string;
  coachingTip: string;
}

export interface RoutineWorkspaceState {
  version: number;
  activeDateKey: string;
  activeRoutine: DailyRoutinePlan;
  recentHistory: Array<{
    dateKey: string;
    subjectMinutes: Record<string, number>;
    completedMinutes: number;
  }>;
  reflections: RoutineReflectionEntry[];
  weeklySummary: WeeklyRoutineSummary;
  lastOpenedAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface LayoutRoomConfig {
  id: string;
  name: string;
  rows: number;
  cols: number;
  order: number;
}

export type SeatGenderPolicy = 'all' | 'male' | 'female';

export interface LayoutSettings {
  rooms?: LayoutRoomConfig[];
  aisleSeatIds?: string[];
  seatLabelsBySeatId?: Record<string, string>;
  seatGenderBySeatId?: Record<string, SeatGenderPolicy>;
  rows?: number;
  cols?: number;
  updatedAt?: Timestamp;
}

export interface AttendanceCurrent {
  id: string;
  seatNo: number;
  roomId?: string;
  roomSeatNo?: number;
  seatLabel?: string;
  seatGenderPolicy?: SeatGenderPolicy;
  status: "studying" | "away" | "break" | "absent";
  type?: "seat" | "aisle";
  seatZone?: string;
  manualOccupantName?: string | null;
  updatedAt: Timestamp;
  lastCheckInAt?: Timestamp;
  studentId?: string; 
}

export interface GrowthProgress {
  seasonLp?: number;
  penaltyPoints: number;
  stats: {
    focus: number;
    consistency: number;
    achievement: number;
    resilience: number;
  };
  dailyPointStatus?: {
    [dateKey: string]: any;
  };
  pointsBalance?: number;
  totalPointsEarned?: number;
  dailyLpStatus?: {
    [dateKey: string]: any;
  };
  totalLpEarned?: number;
  lastResetAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PointBoostEvent {
  id: string;
  centerId: string;
  mode: 'day' | 'window';
  startAt: Timestamp;
  endAt: Timestamp;
  multiplier: number;
  message?: string | null;
  createdBy: string;
  createdAt?: Timestamp;
  cancelledAt?: Timestamp | null;
  cancelledBy?: string | null;
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
  subjectLabel?: string;
  studyPlanMode?: 'time' | 'volume';
  targetMinutes?: number;
  targetAmount?: number;
  actualAmount?: number;
  amountUnit?: '문제' | '페이지' | '챕터' | '지문' | '세트' | '강' | '회독' | '직접입력';
  amountUnitLabel?: string;
  startTime?: string;
  endTime?: string;
  priority?: 'low' | 'medium' | 'high';
  tag?: string;
  completedAt?: Timestamp | null;
  completionPercent?: number | null;
  actualDurationMinutes?: number | null;
  completedWithinPlannedTime?: boolean | null;
  completionOvertimeMinutes?: number | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StudyLogDay {
  studentId: string;
  centerId: string;
  dateKey: string;
  totalMinutes: number;
  awayMinutes?: number;
  firstSessionStartAt?: Timestamp | null;
  lastSessionEndAt?: Timestamp | null;
}

export interface DailyReport {
  id: string;
  studentId: string;
  teacherId: string;
  dateKey: string;
  content: string;
  status: "draft" | "sent";
  studentName?: string;
  teacherNote?: string | null;
  aiMeta?: {
    teacherOneLiner: string;
    strengths: string[];
    improvements: string[];
    level?: number;
    levelName?: string;
    internalStage?: number;
    generationAttempt?: number;
    attendanceLabel?: string;
    totalStudyMinutes?: number;
    completionRate?: number;
    history7Days?: Array<{
      date: string;
      minutes: number;
    }>;
    pedagogyLens?: '습관 형성' | '자기조절' | '집중 회복' | '성장 가속';
    secondaryLens?: '습관 형성' | '자기조절' | '집중 회복' | '성장 가속';
    stateBucket?: string;
    variationKey?: string;
    variationSignature?: string;
    variationStyle?: '차분한 관찰형' | '격려형' | '전략 코칭형' | '균형 피드백형' | '가정 대화형' | '회복 지원형';
    coachingFocus?: string;
    homeTip?: string;
    studyBand?: '저학습' | '기준학습' | '고학습' | '고집중';
    growthBand?: '급하락' | '하락' | '유지' | '상승' | '급상승';
    completionBand?: '낮음' | '보통' | '양호' | '높음';
    routineBand?: '정상' | '지각' | '루틴누락' | '미입실' | '퇴실불안정';
    volatilityBand?: '안정' | '출렁임' | '불안정';
    continuityBand?: '회복중' | '유지중' | '연속호조' | '연속저하';
    metrics: {
      growthRate: number;
      deltaMinutesFromAvg: number;
      avg7StudyMinutes: number;
      isNewRecord: boolean;
      alertLow: boolean;
      streakBadge: boolean;
      trendSummary: string;
    };
  } | null;
  viewedAt?: Timestamp;
  viewedByUid?: string;
  viewedByName?: string;
  nextAction?: string;
  priority?: 'normal' | 'high' | 'critical';
  readAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface InviteCode {
  id: string;
  intendedRole: 'student' | 'teacher' | 'parent' | 'centerAdmin';
  centerId?: string;
  targetClassName?: string;
  maxUses: number;
  usedCount: number;
  expiresAt?: Timestamp | { toDate?: () => Date } | Date | null;
  isActive?: boolean;
  createdByUserId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
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
  requestMode?: 'general' | 'study_question';
  availabilitySlotId?: string | null;
  questionSubject?: string | null;
  questionWorkbook?: string | null;
  questionProblemNumbers?: string | null;
  questionSummary?: string | null;
  questionDetails?: string | null;
  questionAttachments?: CounselingQuestionAttachment[];
  questionAttachmentCleanupAt?: Timestamp | null;
  questionAttachmentsDeletedAt?: Timestamp | null;
  doneAt?: Timestamp | null;
  canceledAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CounselingQuestionAttachment {
  id: string;
  name: string;
  path: string;
  downloadUrl: string;
  contentType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  uploadedAt?: Timestamp | null;
  deletedAt?: Timestamp | null;
}

export interface CounselingAvailabilitySlot {
  id: string;
  centerId: string;
  teacherId: string;
  teacherName: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
  slotType?: 'study_question';
  note?: string | null;
  capacity?: number;
  reservedCount?: number;
  activeReservationIds?: string[];
  isPublished: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdByUid?: string | null;
  updatedByUid?: string | null;
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
  reservationId?: string;
  studentQuestion?: string;
  readAt?: Timestamp | null;
  readByUid?: string;
  readByRole?: 'student' | 'parent';
  createdAt: Timestamp;
}

export interface WebsiteConsultSlot {
  id: string;
  centerId?: string | null;
  label?: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number;
  isPublished: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdByUid?: string | null;
  updatedByUid?: string | null;
}

export type WebsiteBookingAccessStatus = 'no_lead' | 'locked' | 'enabled';

export interface WebsiteBookingAccess {
  isEnabled: boolean;
  unlockedAt?: string | null;
  unlockedByUid?: string | null;
  note?: string | null;
}

export type WebsiteConsultReservationStatus = 'confirmed' | 'canceled' | 'completed';

export interface WebsiteConsultReservation {
  id: string;
  centerId?: string | null;
  leadId: string;
  consultPhone: string;
  studentName: string;
  school?: string | null;
  grade?: string | null;
  receiptId?: string | null;
  requestType?: string | null;
  requestTypeLabel?: string | null;
  slotId: string;
  scheduledAt: string;
  startsAt: string;
  endsAt: string;
  status: WebsiteConsultReservationStatus;
  createdAt?: string;
  updatedAt?: string;
  canceledAt?: string | null;
  completedAt?: string | null;
  createdByUid?: string | null;
  updatedByUid?: string | null;
}

export type WebsiteSeatHoldRequestStatus = 'pending_transfer' | 'held' | 'canceled';

export interface WebsiteSeatHoldRequest {
  id: string;
  centerId?: string | null;
  leadId: string;
  consultPhone: string;
  studentName: string;
  school?: string | null;
  grade?: string | null;
  receiptId?: string | null;
  requestType?: string | null;
  requestTypeLabel?: string | null;
  seatId: string;
  roomId: string;
  roomSeatNo: number;
  seatNo: number;
  seatLabel: string;
  seatGenderPolicy?: SeatGenderPolicy | null;
  seatGenderLabel?: string | null;
  status: WebsiteSeatHoldRequestStatus;
  depositAmount: number;
  bankAccountDisplay: string;
  depositorGuide: string;
  nonRefundableNotice: string;
  policyAcceptedAt: string;
  createdAt?: string;
  updatedAt?: string;
  confirmedAt?: string | null;
  canceledAt?: string | null;
  createdByUid?: string | null;
  updatedByUid?: string | null;
}

export interface WebsiteReservationSettings {
  id: string;
  centerId?: string | null;
  isPublicEnabled?: boolean;
  bankAccountDisplay: string;
  depositAmount: number;
  depositorGuide: string;
  nonRefundableNotice: string;
  slotGuideText?: string | null;
  seatGuideText?: string | null;
  createdAt?: string;
  updatedAt?: string;
  updatedByUid?: string | null;
}

export type SupportThreadKind = 'student_question' | 'student_suggestion' | 'wifi_unblock';
export type SupportThreadSenderRole = 'student' | 'teacher' | 'centerAdmin' | 'parent';

export interface SupportThreadMessage {
  id: string;
  centerId: string;
  communicationId: string;
  studentId: string;
  parentUid?: string | null;
  senderRole: SupportThreadSenderRole;
  senderUid: string;
  senderName: string;
  body: string;
  supportKind?: SupportThreadKind | null;
  requestedUrl?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
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
  schoolNameSnapshot?: string;
  value: number;
  rank: number;
}

export interface StudySession {
  id: string;
  startTime: Timestamp;
  endTime: Timestamp;
  durationMinutes: number;
}

export interface AttendanceRequestProofAttachment {
  id: string;
  name: string;
  path: string;
  downloadUrl: string;
  contentType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  uploadedAt?: Timestamp | null;
  deletedAt?: Timestamp | null;
}

export type AttendanceRequestType = 'late' | 'absence' | 'schedule_change';
export type AttendanceRequestReasonCategory = 'disaster' | 'emergency' | 'surgery' | 'hospital' | 'other';

export interface AttendanceRequest {
  id: string;
  studentId: string;
  studentName: string;
  centerId: string;
  type: AttendanceRequestType;
  date: string;
  reason: string;
  reasonCategory?: AttendanceRequestReasonCategory | null;
  status: 'requested' | 'approved' | 'rejected';
  penaltyApplied: boolean;
  penaltyPointsDelta?: number;
  penaltyWaived?: boolean;
  proofRequired?: boolean;
  proofAttachments?: AttendanceRequestProofAttachment[];
  requestedArrivalTime?: string | null;
  requestedDepartureTime?: string | null;
  requestedAcademyName?: string | null;
  requestedAcademyStartTime?: string | null;
  requestedAcademyEndTime?: string | null;
  scheduleChangeAction?: 'save' | 'absent' | 'reset' | null;
  classScheduleId?: string | null;
  classScheduleName?: string | null;
  statusUpdatedAt?: Timestamp;
  slaDueAt?: Timestamp;
  owner?: string;
  nextAction?: string;
  priority?: 'normal' | 'high' | 'critical';
  readAt?: Timestamp;
  updatedAt?: Timestamp;
  updatedByUserId?: string;
  createdAt: Timestamp;
}

export interface PenaltyLog {
  id: string;
  centerId: string;
  studentId: string;
  studentName?: string;
  pointsDelta: number;
  reason: string;
  source: 'attendance_request' | 'manual' | 'reset' | 'routine_missing';
  requestId?: string;
  requestType?: AttendanceRequestType;
  penaltyKey?: string;
  penaltyDateKey?: string;
  createdByUserId?: string;
  createdByName?: string;
  createdAt: Timestamp;
}

export interface NotificationSettings {
  smsEnabled?: boolean;
  smsProvider?: "none" | "aligo" | "custom";
  smsSender?: string;
  smsApiKey?: string;
  smsUserId?: string;
  smsEndpointUrl?: string;
  smsTemplateCheckIn?: string;
  smsTemplateCheckOut?: string;
  smsTemplateStudyStart?: string;
  smsTemplateAwayStart?: string;
  smsTemplateAwayEnd?: string;
  smsTemplateStudyEnd?: string;
  smsTemplateLateAlert?: string;
  smsApiKeyConfigured?: boolean;
  smsApiKeyLastUpdatedAt?: Timestamp;
  lateAlertEnabled?: boolean;
  lateAlertGraceMinutes?: number;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export type GiftishowDeliveryMode = 'mms';
export type GiftishowSyncStatus = 'idle' | 'syncing' | 'success' | 'error';
export type GiftishowOrderStatus =
  | 'requested'
  | 'approved'
  | 'sending'
  | 'pending_provider'
  | 'sent'
  | 'failed'
  | 'rejected'
  | 'cancelled';
export type GiftishowPointEventType = 'deduct' | 'refund';

export interface GiftishowSettings {
  enabled?: boolean;
  deliveryMode?: GiftishowDeliveryMode;
  bannerId?: string;
  templateId?: string;
  authCodeConfigured?: boolean;
  authTokenConfigured?: boolean;
  userIdConfigured?: boolean;
  callbackNoConfigured?: boolean;
  lastCatalogSyncedAt?: Timestamp | null;
  lastBrandSyncedAt?: Timestamp | null;
  lastDetailSyncedAt?: Timestamp | null;
  lastBizmoneyBalance?: number | null;
  lastBrandCount?: number | null;
  lastDetailSyncedCount?: number | null;
  lastBrandDetailSyncedCount?: number | null;
  lastSyncStatus?: GiftishowSyncStatus;
  lastErrorMessage?: string | null;
  studentReviewBaselineApprovedAt?: Timestamp | null;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export interface GiftishowProduct {
  goodsCode: string;
  goodsName: string;
  brandCode?: string | null;
  brandName?: string | null;
  content?: string | null;
  contentAddDesc?: string | null;
  goodsTypeNm?: string | null;
  goodsTypeDtlNm?: string | null;
  affiliate?: string | null;
  goodsImgS?: string | null;
  goodsImgB?: string | null;
  mmsGoodsImg?: string | null;
  brandIconImg?: string | null;
  salePrice: number;
  discountPrice: number;
  realPrice?: number | null;
  validPrdTypeCd?: string | null;
  validPrdDay?: string | null;
  limitDay?: number | null;
  goodsStateCd?: string | null;
  mmsReserveFlag?: string | null;
  mmsBarcdCreateYn?: string | null;
  pointCost: number;
  isAvailable: boolean;
  lastSyncedAt?: Timestamp | null;
  detailSyncedAt?: Timestamp | null;
  studentReviewApprovedAt?: Timestamp | null;
  updatedAt?: Timestamp;
}

export interface GiftishowBrand {
  brandCode: string;
  brandName: string;
  brandIconImg?: string | null;
  brandImg?: string | null;
  brandDescription?: string | null;
  goodsCount?: number | null;
  isAvailable: boolean;
  lastSyncedAt?: Timestamp | null;
  detailSyncedAt?: Timestamp | null;
  updatedAt?: Timestamp;
}

export interface GiftishowOrderPointEvent {
  type: GiftishowPointEventType;
  points: number;
  reason: string;
  byUid?: string | null;
  createdAt?: Timestamp | null;
}

export interface GiftishowOrder {
  centerId: string;
  studentId: string;
  studentName: string;
  recipientPhoneMasked: string;
  goodsCode: string;
  goodsName: string;
  brandCode?: string | null;
  brandName?: string | null;
  salePrice: number;
  discountPrice: number;
  pointCost: number;
  status: GiftishowOrderStatus;
  providerMode?: 'mock' | 'live';
  trId?: string | null;
  orderNo?: string | null;
  pinNo?: string | null;
  couponImgUrl?: string | null;
  sendStatusCode?: string | null;
  sendStatusName?: string | null;
  pinStatusCode?: string | null;
  pinStatusName?: string | null;
  validPrdEndDt?: string | null;
  sendResultCode?: string | null;
  sendResultMessage?: string | null;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  rejectionReason?: string | null;
  cancelledReason?: string | null;
  needsManualReview?: boolean;
  reconcileAttemptCount?: number;
  resendCount?: number;
  pointEvents?: GiftishowOrderPointEvent[];
  requestedAt?: Timestamp | null;
  requestedBy?: string | null;
  approvedAt?: Timestamp | null;
  approvedBy?: string | null;
  sentAt?: Timestamp | null;
  failedAt?: Timestamp | null;
  rejectedAt?: Timestamp | null;
  rejectedBy?: string | null;
  cancelledAt?: Timestamp | null;
  cancelledBy?: string | null;
  lastReconciledAt?: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ParentActivityEvent {
  id: string;
  centerId: string;
  studentId: string;
  parentUid: string;
  eventType: "app_visit" | "report_read" | "consultation_request" | "request" | "suggestion";
  createdAt: Timestamp;
  metadata?: Record<string, any>;
}

export interface StudentNotification {
  id: string;
  centerId: string;
  studentId: string;
  teacherId: string;
  teacherName: string;
  type: 'one_line_feedback' | 'ranking_reward';
  title?: string;
  message: string;
  rankingRange?: 'daily' | 'weekly' | 'monthly';
  rankingRank?: number;
  rankingRewardPoints?: number;
  rankingPeriodKey?: string;
  awardDateKey?: string;
  readAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export type ClassroomSignalRiskLevel = 'stable' | 'watch' | 'risk' | 'critical';
export type ClassroomSignalPriority = 'low' | 'medium' | 'high' | 'critical';
export type ClassroomOverlayMode = 'status' | 'risk' | 'penalty' | 'minutes' | 'counseling' | 'report';
export type ClassroomIncidentType =
  | 'away_long'
  | 'late_or_absent'
  | 'risk'
  | 'unread_report'
  | 'counseling_pending'
  | 'penalty_threshold'
  | 'check_in'
  | 'check_out';
export type ClassroomIncidentActionTarget = 'seat' | 'student' | 'report' | 'counseling';
export type ClassroomQuickFilter =
  | 'all'
  | 'studying'
  | 'awayLong'
  | 'lateOrAbsent'
  | 'atRisk'
  | 'unreadReports'
  | 'counselingPending';

export interface ClassroomSignalsSummary {
  studying: number;
  awayLong: number;
  lateOrAbsent: number;
  atRisk: number;
  unreadReports: number;
  counselingPending: number;
}

export interface ClassroomSignalClassSummary {
  className: string;
  occupancyRate: number;
  avgMinutes: number;
  riskCount: number;
  awayLongCount: number;
  pendingCounselingCount: number;
}

export interface ClassroomSeatSignal {
  studentId: string;
  seatId: string;
  overlayFlags: string[];
  todayMinutes: number;
  riskLevel: ClassroomSignalRiskLevel;
  effectivePenaltyPoints: number;
  hasUnreadReport: boolean;
  hasCounselingToday: boolean;
}

export interface ClassroomSignalIncident {
  type: ClassroomIncidentType;
  priority: ClassroomSignalPriority;
  studentId: string;
  studentName: string;
  seatId?: string;
  className?: string;
  reason: string;
  occurredAt: Timestamp;
  actionTarget: ClassroomIncidentActionTarget;
}

export interface ClassroomSignalsDocument {
  id?: string;
  updatedAt: Timestamp;
  dateKey: string;
  summary: ClassroomSignalsSummary;
  classSummaries: ClassroomSignalClassSummary[];
  seatSignals: ClassroomSeatSignal[];
  incidents: ClassroomSignalIncident[];
}

export type OpenClawIntegrationStatus = 'idle' | 'exporting' | 'success' | 'error';

export interface OpenClawIntegrationDoc {
  id?: string;
  enabled?: boolean;
  status?: OpenClawIntegrationStatus;
  lastRequestedAt?: Timestamp | null;
  lastRequestedBy?: string | null;
  lastExportedAt?: Timestamp | null;
  lastSnapshotPath?: string | null;
  lastErrorAt?: Timestamp | null;
  lastErrorMessage?: string | null;
  schemaVersion?: string | null;
}

export interface OpenClawSnapshotRecordCounts {
  students: {
    memberships: number;
    profiles: number;
    growthProgress: number;
  };
  attendance: {
    records: number;
    schedules: number;
    currentSeats: number;
  };
  consultations: {
    logs: number;
    reservations: number;
  };
  billing: {
    invoices: number;
    payments: number;
    kpiDaily: number;
  };
  studyRoomUsage: {
    dailyStudentStats: number;
    studyLogDays: number;
    sessions: number;
  };
  derived: {
    riskCache: number;
    classroomSignals: number;
    kpiDaily: number;
  };
}
