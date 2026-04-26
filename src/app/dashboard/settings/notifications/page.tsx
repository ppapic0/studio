'use client';

import { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, doc, limit, orderBy, query, where } from 'firebase/firestore';
import {
  BellRing,
  Clock3,
  Loader2,
  MessageSquare,
  Megaphone,
  PlugZap,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  TrendingUp,
  XCircle,
} from 'lucide-react';

import { useCollection, useDoc, useFirestore, useFunctions, useMemoFirebase } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useToast } from '@/hooks/use-toast';
import { shouldExcludeFromSmsQueries } from '@/lib/counseling-demo';
import { canManageSettings } from '@/lib/dashboard-access';
import type { NotificationSettings } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AdminWorkbenchCommandBar } from '@/components/dashboard/admin-workbench-command-bar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SMS_BYTE_LIMIT = 90;
const MANUAL_PARENT_SMS_UID = '__manual_parent__';
const TRACK_MANAGED_STUDY_CENTER_NAME = '트랙 관리형 스터디센터';

type ParentSmsEventType =
  | 'study_start'
  | 'away_start'
  | 'away_end'
  | 'study_end'
  | 'late_alert'
  | 'weekly_report'
  | 'daily_report'
  | 'payment_reminder';

type SmsConsoleEventType = ParentSmsEventType | 'risk_alert' | 'manual_note';

type SmsEventTemplateKey =
  | 'smsTemplateStudyStart'
  | 'smsTemplateAwayStart'
  | 'smsTemplateAwayEnd'
  | 'smsTemplateStudyEnd'
  | 'smsTemplateLateAlert';

type SmsQueueStatus =
  | 'queued'
  | 'processing'
  | 'failed'
  | 'pending_provider'
  | 'cancelled'
  | 'sent';

type SmsQueueRow = {
  id: string;
  studentId?: string;
  studentName?: string;
  parentUid?: string;
  parentName?: string;
  phoneNumber?: string;
  to?: string;
  eventType?: SmsConsoleEventType;
  status?: SmsQueueStatus | string;
  providerStatus?: string;
  renderedMessage?: string;
  message?: string;
  messageBytes?: number;
  dateKey?: string;
  failedReason?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  attemptCount?: number;
  manualRetryCount?: number;
  nextAttemptAt?: { toDate?: () => Date };
  sentAt?: { toDate?: () => Date };
  failedAt?: { toDate?: () => Date };
  createdAt?: { toDate?: () => Date };
  updatedAt?: { toDate?: () => Date };
};

type SmsDeliveryLogRow = {
  id: string;
  queueId?: string;
  studentId?: string;
  studentName?: string;
  parentUid?: string;
  parentName?: string;
  phoneNumber?: string;
  eventType?: SmsConsoleEventType;
  renderedMessage?: string;
  messageBytes?: number;
  provider?: string;
  attemptNo?: number;
  status?: 'sent' | 'failed' | 'suppressed_opt_out' | string;
  dateKey?: string;
  createdAt?: { toDate?: () => Date };
  sentAt?: { toDate?: () => Date };
  failedAt?: { toDate?: () => Date };
  errorCode?: string;
  errorMessage?: string;
  suppressedReason?: string;
};

type LegacySmsLogRow = {
  id: string;
  studentId?: string;
  eventType?: SmsConsoleEventType;
  provider?: string;
  recipientCount?: number;
  renderedMessage?: string;
  message?: string;
  messageBytes?: number;
  createdAt?: { toDate?: () => Date };
};

type StudentDoc = {
  id: string;
  name?: string;
  className?: string;
  grade?: string;
  parentUids?: string[];
  phoneNumber?: string;
};

type MemberDoc = {
  id: string;
  role?: string;
  status?: string;
  displayName?: string;
  name?: string;
  phoneNumber?: string;
};

type SmsRecipientPreferenceDoc = {
  id: string;
  studentId: string;
  studentName?: string;
  parentUid: string;
  parentName?: string;
  phoneNumber?: string;
  enabled?: boolean;
  isManualRecipient?: boolean;
  eventToggles?: Partial<Record<ParentSmsEventType, boolean>>;
  updatedAt?: { toDate?: () => Date };
};

type RecipientPreferenceRow = {
  studentId: string;
  studentName: string;
  className: string;
  parentUid: string;
  parentName: string;
  phoneNumber: string;
  enabled: boolean;
  eventToggles: Record<ParentSmsEventType, boolean>;
  isManualRecipient?: boolean;
  isPhoneMissing?: boolean;
};

type StudentDialogLogDetailRow = {
  id: string;
  type: 'attendance' | 'log' | 'queue';
  parentName: string;
  phoneNumber: string;
  message: string;
  statusLabel: string;
  statusTone: string;
  timeLabel: string;
  errorMessage: string;
  queueId: string | null;
  queueStatus: string | null;
};

type TodayBoardEventType = 'study_start' | 'away_start' | 'away_end' | 'study_end';

type StudentSmsBoardEventSummary = {
  eventType: TodayBoardEventType;
  status: 'sent' | 'queued' | 'failed' | 'suppressed' | 'missing_phone' | 'recorded' | 'none';
  timeLabel: string;
  badgeLabel: string;
  queueRows: SmsQueueRow[];
  logRows: SmsDeliveryLogRow[];
};

type AttendanceRecordRow = {
  id: string;
  studentId?: string;
  dateKey?: string;
  status?: string;
  checkInAt?: { toDate?: () => Date };
};

type AttendanceDailyStatRow = {
  id: string;
  studentId?: string;
  dateKey?: string;
  attendanceStatus?: string;
  checkInAt?: { toDate?: () => Date };
  checkOutAt?: { toDate?: () => Date };
  hasCheckOutRecord?: boolean;
};

type AttendanceEventRow = {
  id: string;
  studentId?: string;
  dateKey?: string;
  eventType?: string;
  occurredAt?: { toDate?: () => Date };
  createdAt?: { toDate?: () => Date };
};

type StudentSmsBoardRow = {
  studentId: string;
  studentName: string;
  className: string;
  recipients: RecipientPreferenceRow[];
  recipientLabel: string;
  hasMissingPhone: boolean;
  todaySentCount: number;
  needsAttentionRank: number;
  events: Record<TodayBoardEventType, StudentSmsBoardEventSummary>;
};

type StudentRecipientRow = {
  studentId: string;
  studentName: string;
  className: string;
  parentRows: RecipientPreferenceRow[];
};

const DEFAULT_FORM: Required<Pick<NotificationSettings,
  'smsEnabled' |
  'smsProvider' |
  'smsSender' |
  'smsUserId' |
  'smsEndpointUrl' |
  'smsTemplateStudyStart' |
  'smsTemplateAwayStart' |
  'smsTemplateAwayEnd' |
  'smsTemplateStudyEnd' |
  'smsTemplateLateAlert' |
  'lateAlertEnabled' |
  'lateAlertGraceMinutes'
>> = {
  smsEnabled: true,
  smsProvider: 'none',
  smsSender: '',
  smsUserId: '',
  smsEndpointUrl: '',
  smsTemplateStudyStart: '[{centerName}] {studentName} 학생 {time} 공부시작. 오늘 학습 흐름 확인 부탁드립니다.',
  smsTemplateAwayStart: '[{centerName}] {studentName} 학생 {time} 외출. 복귀 후 다시 공부를 이어갑니다.',
  smsTemplateAwayEnd: '[{centerName}] {studentName} 학생 {time} 복귀. 다시 공부를 시작했습니다.',
  smsTemplateStudyEnd: '[{centerName}] {studentName} 학생 {time} 공부종료. 오늘 학습 마무리했습니다.',
  smsTemplateLateAlert: '[{centerName}] {studentName} 학생 {expectedTime} 미등원. 확인 부탁드립니다.',
  lateAlertEnabled: true,
  lateAlertGraceMinutes: 20,
};

const SMS_EVENTS: Array<{ value: SmsConsoleEventType; label: string }> = [
  { value: 'study_start', label: '공부시작' },
  { value: 'away_start', label: '외출' },
  { value: 'away_end', label: '복귀' },
  { value: 'study_end', label: '공부종료' },
  { value: 'late_alert', label: '지각' },
  { value: 'weekly_report', label: '주간리포트' },
  { value: 'daily_report', label: '일일리포트' },
  { value: 'payment_reminder', label: '결제알림' },
  { value: 'manual_note', label: '수동 문자' },
  { value: 'risk_alert', label: '리스크 알림' },
];

const RECIPIENT_EVENT_OPTIONS: Array<{ value: ParentSmsEventType; label: string }> = [
  { value: 'study_start', label: '공부시작' },
  { value: 'away_start', label: '외출' },
  { value: 'away_end', label: '복귀' },
  { value: 'study_end', label: '공부종료' },
  { value: 'late_alert', label: '지각' },
  { value: 'weekly_report', label: '주간리포트' },
  { value: 'daily_report', label: '일일리포트' },
  { value: 'payment_reminder', label: '결제알림' },
];

const TEMPLATE_META: Array<{
  key: SmsEventTemplateKey;
  label: string;
  sampleStatus: string;
}> = [
  { key: 'smsTemplateStudyStart', label: '공부 시작 메시지', sampleStatus: '공부시작' },
  { key: 'smsTemplateAwayStart', label: '외출 메시지', sampleStatus: '외출' },
  { key: 'smsTemplateAwayEnd', label: '복귀 메시지', sampleStatus: '복귀' },
  { key: 'smsTemplateStudyEnd', label: '공부 종료 메시지', sampleStatus: '공부종료' },
  { key: 'smsTemplateLateAlert', label: '지각 알림 메시지', sampleStatus: '미등원' },
];

const TODAY_BOARD_EVENTS: Array<{ value: TodayBoardEventType; label: string }> = [
  { value: 'study_start', label: '등원' },
  { value: 'away_start', label: '외출' },
  { value: 'away_end', label: '복귀' },
  { value: 'study_end', label: '하원' },
];

function calculateSmsBytes(message: string) {
  return Array.from(message || '').reduce((sum, char) => sum + (char.charCodeAt(0) <= 0x007f ? 1 : 2), 0);
}

function trimSmsToByteLimit(message: string, limit = SMS_BYTE_LIMIT) {
  let result = '';
  for (const char of Array.from(message || '')) {
    const next = result + char;
    if (calculateSmsBytes(next) > limit) break;
    result = next;
  }
  return result.trim();
}

function renderTemplatePreview(template: string, sampleValues: Record<string, string>) {
  const rendered = Object.entries(sampleValues).reduce((acc, [key, value]) => {
    return acc.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }, template || '');
  return trimSmsToByteLimit(rendered.replace(/\s+/g, ' ').trim());
}

function getByteTone(bytes: number) {
  if (bytes > SMS_BYTE_LIMIT) return 'bg-rose-100 text-rose-700';
  if (bytes >= 81) return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
}

function getByteLabel(bytes: number) {
  if (bytes > SMS_BYTE_LIMIT) return '초과';
  if (bytes >= 81) return '한계 근접';
  return '안전';
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toDateKeyFromValue(value?: { toDate?: () => Date }) {
  const date = value?.toDate?.();
  return date ? toDateInputValue(date) : '';
}

function formatDateLabel(value?: { toDate?: () => Date }) {
  const date = value?.toDate?.();
  if (!date) return '-';
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatPhone(value?: string) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value || '-';
}

function normalizePhoneNumber(value?: string) {
  const digits = String(value || '').replace(/\D/g, '');
  if ((digits.length === 10 || digits.length === 11) && digits.startsWith('01')) return digits;
  return '';
}

function resolveFirstValidPhoneNumber(...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = normalizePhoneNumber(value);
    if (normalized) return normalized;
  }
  return '';
}

function formatTimeLabel(value?: { toDate?: () => Date }) {
  const date = value?.toDate?.();
  if (!date) return '-';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function toDateSafe(value?: { toDate?: () => Date } | Date | null) {
  if (!value) return null;
  if (value instanceof Date) return value;
  return value?.toDate?.() || null;
}

function formatTimeLabelFromDate(date?: Date | null) {
  if (!date) return '-';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatShortDateLabel(date: Date) {
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}`;
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function buildAreaPath(points: Array<{ x: number; y: number }>, baselineY: number) {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `M ${first.x} ${baselineY} ${buildLinePath(points)} L ${last.x} ${baselineY} Z`;
}

function getEventLabel(eventType?: string) {
  if (eventType === 'check_in') return '공부시작';
  if (eventType === 'check_out') return '공부종료';
  return SMS_EVENTS.find((item) => item.value === eventType)?.label || eventType || '기타';
}

function getDefaultEventToggles(): Record<ParentSmsEventType, boolean> {
  return {
    study_start: true,
    away_start: true,
    away_end: true,
    study_end: true,
    late_alert: true,
    weekly_report: true,
    daily_report: true,
    payment_reminder: true,
  };
}

function mergeEventToggles(toggles?: Partial<Record<ParentSmsEventType, boolean>>) {
  return {
    ...getDefaultEventToggles(),
    ...(toggles || {}),
  };
}

function buildSmsRecipientPreferenceId(studentId: string, parentUid: string) {
  return `${studentId}_${parentUid}`;
}

function getTodayBoardCellTone(status: StudentSmsBoardEventSummary['status']) {
  if (status === 'sent') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'recorded') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'queued') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'failed') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'suppressed') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'missing_phone') return 'border-slate-300 bg-slate-100 text-slate-600';
  return 'border-slate-200 bg-slate-50 text-slate-400';
}

function getQueueStatusLabel(status?: string, providerStatus?: string, nextAttemptAt?: { toDate?: () => Date }, attemptCount?: number) {
  if (status === 'processing') return '처리중';
  if (status === 'failed') return '실패';
  if (status === 'pending_provider') return '설정 대기';
  if (status === 'cancelled') return '취소됨';
  if (status === 'sent') return '알리고 접수';
  if (status === 'queued' && providerStatus === 'retry_scheduled' && nextAttemptAt?.toDate && (attemptCount || 0) > 0) {
    return '재시도 예정';
  }
  return '대기중';
}

function getStatusTone(status?: string, providerStatus?: string, nextAttemptAt?: { toDate?: () => Date }, attemptCount?: number) {
  const label = getQueueStatusLabel(status, providerStatus, nextAttemptAt, attemptCount);
  if (label === '실패') return 'bg-rose-100 text-rose-700';
  if (label === '설정 대기') return 'bg-amber-100 text-amber-700';
  if (label === '취소됨') return 'bg-slate-200 text-slate-700';
  if (label === '처리중') return 'bg-violet-100 text-violet-700';
  if (label === '재시도 예정') return 'bg-orange-100 text-orange-700';
  if (label === '알리고 접수') return 'bg-emerald-100 text-emerald-700';
  return 'bg-blue-100 text-blue-700';
}

function getDeliveryStatusLabel(status?: string) {
  if (status === 'suppressed_opt_out') return '수신거부';
  if (status === 'failed') return '실패';
  return '알리고 접수';
}

export default function NotificationSettingsPage() {
  const firestore = useFirestore();
  const functions = useFunctions();
  const { activeMembership, membershipsLoading, viewMode } = useAppContext();
  const { toast } = useToast();
  const isMobile = viewMode === 'mobile';

  const centerId = activeMembership?.id;
  const isAdmin = canManageSettings(activeMembership?.role);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [smsApiKeyInput, setSmsApiKeyInput] = useState('');
  const [showApiKeyEditor, setShowApiKeyEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [studentBoardSearchTerm, setStudentBoardSearchTerm] = useState('');
  const [recipientSearchTerm, setRecipientSearchTerm] = useState('');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyEventFilter, setHistoryEventFilter] = useState<'all' | SmsConsoleEventType>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'sent' | 'failed' | 'suppressed_opt_out'>('all');
  const [historyTab, setHistoryTab] = useState<'by-date' | 'by-student'>('by-date');
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(toDateInputValue(new Date()));
  const [selectedHistoryStudentId, setSelectedHistoryStudentId] = useState<string>('all');
  const [selectedBoardStudentId, setSelectedBoardStudentId] = useState<string | null>(null);
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState(false);
  const [queueActionKey, setQueueActionKey] = useState<string | null>(null);
  const [preferenceActionKey, setPreferenceActionKey] = useState<string | null>(null);
  const [recipientPhoneDrafts, setRecipientPhoneDrafts] = useState<Record<string, string>>({});
  const [manualSmsMessage, setManualSmsMessage] = useState('');
  const [manualSmsActionKey, setManualSmsActionKey] = useState<string | null>(null);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return doc(firestore, 'centers', centerId, 'settings', 'notifications');
  }, [firestore, centerId, isAdmin]);
  const { data: settingsDoc, isLoading } = useDoc<NotificationSettings>(settingsRef, { enabled: isAdmin });

  const smsQueueQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(collection(firestore, 'centers', centerId, 'smsQueue'), orderBy('createdAt', 'desc'), limit(400));
  }, [firestore, centerId, isAdmin]);
  const { data: smsQueueRaw } = useCollection<SmsQueueRow>(smsQueueQuery, { enabled: isAdmin });

  const smsDeliveryLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(collection(firestore, 'centers', centerId, 'smsDeliveryLogs'), orderBy('createdAt', 'desc'), limit(1200));
  }, [firestore, centerId, isAdmin]);
  const { data: smsDeliveryLogsRaw } = useCollection<SmsDeliveryLogRow>(smsDeliveryLogsQuery, { enabled: isAdmin });

  const legacySmsLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(collection(firestore, 'centers', centerId, 'smsLogs'), orderBy('createdAt', 'desc'), limit(120));
  }, [firestore, centerId, isAdmin]);
  const { data: legacySmsLogsRaw } = useCollection<LegacySmsLogRow>(legacySmsLogsQuery, { enabled: isAdmin });

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(collection(firestore, 'centers', centerId, 'students'), limit(500));
  }, [firestore, centerId, isAdmin]);
  const { data: studentsRaw } = useCollection<StudentDoc>(studentsQuery, { enabled: isAdmin });

  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), limit(800));
  }, [firestore, centerId, isAdmin]);
  const { data: membersRaw } = useCollection<MemberDoc>(membersQuery, { enabled: isAdmin });

  const preferencesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(collection(firestore, 'centers', centerId, 'smsRecipientPreferences'), limit(800));
  }, [firestore, centerId, isAdmin]);
  const { data: preferencesRaw } = useCollection<SmsRecipientPreferenceDoc>(preferencesQuery, { enabled: isAdmin });

  const todayDateKey = useMemo(() => toDateInputValue(new Date()), []);

  const attendanceRecordsTodayQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(collection(firestore, 'centers', centerId, 'attendanceRecords', todayDateKey, 'students'), limit(800));
  }, [firestore, centerId, isAdmin, todayDateKey]);
  const { data: attendanceRecordsTodayRaw } = useCollection<AttendanceRecordRow>(attendanceRecordsTodayQuery, { enabled: isAdmin });

  const attendanceDailyStatsTodayQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(collection(firestore, 'centers', centerId, 'attendanceDailyStats', todayDateKey, 'students'), limit(800));
  }, [firestore, centerId, isAdmin, todayDateKey]);
  const { data: attendanceDailyStatsTodayRaw } = useCollection<AttendanceDailyStatRow>(attendanceDailyStatsTodayQuery, { enabled: isAdmin });

  const attendanceEventsTodayQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(
      collection(firestore, 'centers', centerId, 'attendanceEvents'),
      where('dateKey', '==', todayDateKey),
      limit(1200)
    );
  }, [firestore, centerId, isAdmin, todayDateKey]);
  const { data: attendanceEventsTodayRaw } = useCollection<AttendanceEventRow>(attendanceEventsTodayQuery, { enabled: isAdmin });

  useEffect(() => {
    if (!settingsDoc) return;
    setForm((prev) => ({
      ...prev,
      smsEnabled: settingsDoc.smsEnabled ?? prev.smsEnabled,
      smsProvider: (settingsDoc.smsProvider || prev.smsProvider) as 'none' | 'aligo' | 'custom',
      smsSender: settingsDoc.smsSender || prev.smsSender,
      smsUserId: settingsDoc.smsUserId || prev.smsUserId,
      smsEndpointUrl: settingsDoc.smsEndpointUrl || prev.smsEndpointUrl,
      smsTemplateStudyStart: settingsDoc.smsTemplateStudyStart || settingsDoc.smsTemplateCheckIn || prev.smsTemplateStudyStart,
      smsTemplateAwayStart: settingsDoc.smsTemplateAwayStart || prev.smsTemplateAwayStart,
      smsTemplateAwayEnd: settingsDoc.smsTemplateAwayEnd || prev.smsTemplateAwayEnd,
      smsTemplateStudyEnd: settingsDoc.smsTemplateStudyEnd || settingsDoc.smsTemplateCheckOut || prev.smsTemplateStudyEnd,
      smsTemplateLateAlert: settingsDoc.smsTemplateLateAlert || prev.smsTemplateLateAlert,
      lateAlertEnabled: settingsDoc.lateAlertEnabled ?? prev.lateAlertEnabled,
      lateAlertGraceMinutes: Number(settingsDoc.lateAlertGraceMinutes ?? prev.lateAlertGraceMinutes),
    }));
  }, [settingsDoc]);

  const isSmsApiKeyConfigured = useMemo(() => {
    return Boolean(
      settingsDoc?.smsApiKeyConfigured
      || settingsDoc?.smsApiKey
      || settingsDoc?.smsApiKeyLastUpdatedAt
    );
  }, [settingsDoc]);

  useEffect(() => {
    if (isSmsApiKeyConfigured) {
      setShowApiKeyEditor(false);
    }
  }, [isSmsApiKeyConfigured]);

  const sampleValues = useMemo(() => ({
    studentName: '김재윤',
    time: '18:40',
    expectedTime: '17:00',
    centerName: TRACK_MANAGED_STUDY_CENTER_NAME,
  }), []);

  const templatePreviews = useMemo(() => {
    return TEMPLATE_META.map((item) => {
      const rendered = renderTemplatePreview(form[item.key], sampleValues);
      const bytes = calculateSmsBytes(rendered);
      return { ...item, rendered, bytes };
    });
  }, [form, sampleValues]);

  const studentsById = useMemo<Map<string, StudentDoc>>(
    () => new Map((studentsRaw || []).map((row) => [row.id, row] as const)),
    [studentsRaw]
  );
  const membersById = useMemo<Map<string, MemberDoc>>(
    () => new Map((membersRaw || []).map((row) => [row.id, row] as const)),
    [membersRaw]
  );
  const preferencesByKey = useMemo<Map<string, SmsRecipientPreferenceDoc>>(
    () => new Map((preferencesRaw || []).map((row) => [row.id, row] as const)),
    [preferencesRaw]
  );
  const attendanceRecordsByStudentId = useMemo<Map<string, AttendanceRecordRow>>(
    () => new Map((attendanceRecordsTodayRaw || []).filter((row) => row.studentId).map((row) => [row.studentId!, row] as const)),
    [attendanceRecordsTodayRaw]
  );
  const attendanceDailyStatsByStudentId = useMemo<Map<string, AttendanceDailyStatRow>>(
    () => new Map((attendanceDailyStatsTodayRaw || []).filter((row) => row.studentId).map((row) => [row.studentId!, row] as const)),
    [attendanceDailyStatsTodayRaw]
  );
  const attendanceEventsByStudentId = useMemo<Map<string, AttendanceEventRow[]>>(() => {
    const next = new Map<string, AttendanceEventRow[]>();
    (attendanceEventsTodayRaw || []).forEach((row) => {
      if (!row.studentId) return;
      const current = next.get(row.studentId) || [];
      current.push(row);
      next.set(row.studentId, current);
    });
    next.forEach((rows, key) => {
      next.set(
        key,
        rows.slice().sort((a, b) => {
          const aTime = toDateSafe(a.occurredAt) || toDateSafe(a.createdAt);
          const bTime = toDateSafe(b.occurredAt) || toDateSafe(b.createdAt);
          return (bTime?.getTime() || 0) - (aTime?.getTime() || 0);
        })
      );
    });
    return next;
  }, [attendanceEventsTodayRaw]);

  const providerReady = useMemo(() => {
    if (!form.smsEnabled) return false;
    if (form.smsProvider === 'none') return false;
    if (!form.smsSender.trim()) return false;
    if (form.smsProvider === 'aligo') {
      return Boolean(isSmsApiKeyConfigured && form.smsUserId.trim());
    }
    return Boolean(isSmsApiKeyConfigured && form.smsEndpointUrl.trim());
  }, [form, isSmsApiKeyConfigured]);

  const smsTrendSummary = useMemo(() => {
    const range = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return {
        key: toDateInputValue(date),
        label: formatShortDateLabel(date),
        sent: 0,
        issue: 0,
      };
    });
    const dayMap = new Map(range.map((item) => [item.key, item] as const));
    (smsDeliveryLogsRaw || []).forEach((row) => {
      const key =
        row.dateKey ||
        toDateKeyFromValue(row.sentAt) ||
        toDateKeyFromValue(row.failedAt) ||
        toDateKeyFromValue(row.createdAt);
      if (!key) return;
      const bucket = dayMap.get(key);
      if (!bucket) return;
      if (row.status === 'sent') {
        bucket.sent += 1;
      } else {
        bucket.issue += 1;
      }
    });
    const todayKey = range[range.length - 1]?.key;
    const pendingTodayCount = (smsQueueRaw || []).filter((row) => {
      const key = toDateKeyFromValue(row.createdAt) || toDateKeyFromValue(row.updatedAt) || toDateKeyFromValue(row.nextAttemptAt);
      return key === todayKey && ['queued', 'processing', 'pending_provider'].includes(String(row.status || ''));
    }).length;
    return {
      range,
      maxCount: Math.max(1, ...range.map((item) => Math.max(item.sent, item.issue))),
      totalSent: range.reduce((sum, item) => sum + item.sent, 0),
      totalIssue: range.reduce((sum, item) => sum + item.issue, 0),
      pendingTodayCount,
    };
  }, [smsDeliveryLogsRaw, smsQueueRaw]);

  const smsTrendChart = useMemo(() => {
    const width = 640;
    const height = 220;
    const paddingX = 24;
    const paddingTop = 24;
    const paddingBottom = 36;
    const chartWidth = width - paddingX * 2;
    const chartHeight = height - paddingTop - paddingBottom;
    const baselineY = paddingTop + chartHeight;
    const maxCount = smsTrendSummary.maxCount;
    const stepX = smsTrendSummary.range.length > 1 ? chartWidth / (smsTrendSummary.range.length - 1) : chartWidth;
    const toPoint = (value: number, index: number) => ({
      x: paddingX + stepX * index,
      y: paddingTop + chartHeight - (value / maxCount) * chartHeight,
    });
    const sentPoints = smsTrendSummary.range.map((item, index) => toPoint(item.sent, index));
    const issuePoints = smsTrendSummary.range.map((item, index) => toPoint(item.issue, index));
    const yTicks = Array.from({ length: 4 }, (_, index) => Math.round((maxCount / 3) * (3 - index)));
    return {
      width,
      height,
      baselineY,
      sentPoints,
      issuePoints,
      sentPath: buildLinePath(sentPoints),
      sentAreaPath: buildAreaPath(sentPoints, baselineY),
      issuePath: buildLinePath(issuePoints),
      yTicks,
      chartWidth,
      paddingX,
      paddingTop,
      chartHeight,
    };
  }, [smsTrendSummary]);

  const recipientRows = useMemo<StudentRecipientRow[]>(() => {
    return (studentsRaw || [])
      .filter((student) => {
        if (shouldExcludeFromSmsQueries(student, student.id)) {
          return false;
        }
        const membership = membersById.get(student.id);
        if (shouldExcludeFromSmsQueries(membership, student.id)) {
          return false;
        }
        if (membership?.role === 'student' && membership?.status && membership.status !== 'active') {
          return false;
        }
        return true;
      })
      .map((student) => {
        const studentName = student.name || '학생';
        const className = student.className || student.grade || '-';
        const parentRows: RecipientPreferenceRow[] = (student.parentUids || []).reduce<RecipientPreferenceRow[]>((rows, parentUid) => {
          const member = membersById.get(parentUid);
          if (shouldExcludeFromSmsQueries(member, parentUid)) {
            return rows;
          }
          const pref = preferencesByKey.get(buildSmsRecipientPreferenceId(student.id, parentUid));
          const phoneNumber = resolveFirstValidPhoneNumber(
            pref?.phoneNumber,
            member?.phoneNumber
          );
          rows.push({
            studentId: student.id,
            studentName,
            className,
            parentUid,
            parentName: pref?.parentName || member?.displayName || member?.name || '학부모',
            phoneNumber,
            enabled: pref?.enabled !== false,
            eventToggles: mergeEventToggles(pref?.eventToggles),
            isPhoneMissing: !phoneNumber,
          } satisfies RecipientPreferenceRow);
          return rows;
        }, []);
        const manualParentPref = preferencesByKey.get(buildSmsRecipientPreferenceId(student.id, MANUAL_PARENT_SMS_UID));
        const manualParentPhoneNumber = resolveFirstValidPhoneNumber(manualParentPref?.phoneNumber);
        const manualParentRow: RecipientPreferenceRow | null = manualParentPhoneNumber
          ? {
              studentId: student.id,
              studentName,
              className,
              parentUid: MANUAL_PARENT_SMS_UID,
              parentName: manualParentPref?.parentName || '보호자',
              phoneNumber: manualParentPhoneNumber,
              enabled: manualParentPref?.enabled !== false,
              eventToggles: mergeEventToggles(manualParentPref?.eventToggles),
              isManualRecipient: true,
              isPhoneMissing: false,
            }
          : null;
        const effectiveRows: RecipientPreferenceRow[] = manualParentRow ? [...parentRows, manualParentRow] : parentRows;
        return {
          studentId: student.id,
          studentName,
          className,
          parentRows: effectiveRows,
        };
      })
      .sort((a, b) => a.studentName.localeCompare(b.studentName, 'ko-KR'));
  }, [membersById, preferencesByKey, studentsRaw]);

  const todayBoardRows = useMemo<StudentSmsBoardRow[]>(() => {
    const todayKey = todayDateKey;
    const queueRows = smsQueueRaw || [];
    const deliveryRows = smsDeliveryLogsRaw || [];
    const keyword = studentBoardSearchTerm.trim().toLowerCase();
    return recipientRows
      .map((student) => {
        const attendanceRecord = attendanceRecordsByStudentId.get(student.studentId);
        const attendanceDailyStat = attendanceDailyStatsByStudentId.get(student.studentId);
        const attendanceEvents = attendanceEventsByStudentId.get(student.studentId) || [];
        const resolveAttendanceTime = (eventType: TodayBoardEventType) => {
          if (eventType === 'study_start') {
            return (
              toDateSafe(attendanceDailyStat?.checkInAt) ||
              toDateSafe(attendanceRecord?.checkInAt) ||
              toDateSafe(attendanceEvents.find((row) => row.eventType === 'check_in')?.occurredAt) ||
              toDateSafe(attendanceEvents.find((row) => row.eventType === 'check_in')?.createdAt)
            );
          }
          if (eventType === 'study_end') {
            return (
              toDateSafe(attendanceDailyStat?.checkOutAt) ||
              toDateSafe(attendanceEvents.find((row) => row.eventType === 'check_out')?.occurredAt) ||
              toDateSafe(attendanceEvents.find((row) => row.eventType === 'check_out')?.createdAt)
            );
          }
          if (eventType === 'away_start') {
            return (
              toDateSafe(attendanceEvents.find((row) => row.eventType === 'away_start')?.occurredAt) ||
              toDateSafe(attendanceEvents.find((row) => row.eventType === 'away_start')?.createdAt)
            );
          }
          return (
            toDateSafe(attendanceEvents.find((row) => row.eventType === 'away_end')?.occurredAt) ||
            toDateSafe(attendanceEvents.find((row) => row.eventType === 'away_end')?.createdAt)
          );
        };
        const studentLogs = deliveryRows.filter(
          (row) => row.studentId === student.studentId && row.dateKey === todayKey && TODAY_BOARD_EVENTS.some((item) => item.value === row.eventType)
        );
        const studentQueueRows = queueRows.filter(
          (row) => row.studentId === student.studentId && row.dateKey === todayKey && TODAY_BOARD_EVENTS.some((item) => item.value === row.eventType)
        );
        const hasMissingPhone = student.parentRows.every((row) => row.isPhoneMissing);
        const events = TODAY_BOARD_EVENTS.reduce((acc, item) => {
          const logRows = studentLogs
            .filter((row) => row.eventType === item.value)
            .slice()
            .sort((a, b) => (b.createdAt?.toDate?.().getTime() || 0) - (a.createdAt?.toDate?.().getTime() || 0));
          const queueRowsForEvent = studentQueueRows
            .filter((row) => row.eventType === item.value)
            .slice()
            .sort((a, b) => (b.createdAt?.toDate?.().getTime() || 0) - (a.createdAt?.toDate?.().getTime() || 0));
          const latestSent = logRows.find((row) => row.status === 'sent');
          const latestSuppressed = logRows.find((row) => row.status === 'suppressed_opt_out');
          const latestFailedLog = logRows.find((row) => row.status === 'failed');
          const latestQueue = queueRowsForEvent[0];
          const attendanceTime = resolveAttendanceTime(item.value);

          let summary: StudentSmsBoardEventSummary;
          if (latestSent) {
            summary = {
              eventType: item.value,
              status: 'sent',
              timeLabel: formatTimeLabel(latestSent.sentAt || latestSent.createdAt),
              badgeLabel: formatTimeLabel(latestSent.sentAt || latestSent.createdAt),
              queueRows: queueRowsForEvent,
              logRows,
            };
          } else if (latestQueue && ['queued', 'processing', 'pending_provider'].includes(String(latestQueue.status || ''))) {
            summary = {
              eventType: item.value,
              status: 'queued',
              timeLabel: '-',
              badgeLabel: '대기',
              queueRows: queueRowsForEvent,
              logRows,
            };
          } else if (latestQueue && String(latestQueue.status || '') === 'failed') {
            summary = {
              eventType: item.value,
              status: 'failed',
              timeLabel: '-',
              badgeLabel: '실패',
              queueRows: queueRowsForEvent,
              logRows,
            };
          } else if (latestFailedLog) {
            summary = {
              eventType: item.value,
              status: 'failed',
              timeLabel: '-',
              badgeLabel: '실패',
              queueRows: queueRowsForEvent,
              logRows,
            };
          } else if (latestSuppressed) {
            summary = {
              eventType: item.value,
              status: 'suppressed',
              timeLabel: '-',
              badgeLabel: '수신거부',
              queueRows: queueRowsForEvent,
              logRows,
            };
          } else if (attendanceTime) {
            summary = {
              eventType: item.value,
              status: hasMissingPhone ? 'missing_phone' : 'recorded',
              timeLabel: formatTimeLabelFromDate(attendanceTime),
              badgeLabel: hasMissingPhone ? '번호없음' : '미접수',
              queueRows: queueRowsForEvent,
              logRows,
            };
          } else if (hasMissingPhone) {
            summary = {
              eventType: item.value,
              status: 'missing_phone',
              timeLabel: '-',
              badgeLabel: '번호없음',
              queueRows: queueRowsForEvent,
              logRows,
            };
          } else {
            summary = {
              eventType: item.value,
              status: 'none',
              timeLabel: '-',
              badgeLabel: '-',
              queueRows: queueRowsForEvent,
              logRows,
            };
          }

          acc[item.value] = summary;
          return acc;
        }, {} as Record<TodayBoardEventType, StudentSmsBoardEventSummary>);

        const todaySentCount = Object.values(events).filter((event) => event.status === 'sent').length;
        const hasFailed = Object.values(events).some((event) => event.status === 'failed');
        const hasQueued = Object.values(events).some((event) => event.status === 'queued');
        const hasSuppressed = Object.values(events).some((event) => event.status === 'suppressed');
        const hasNoEvent = Object.values(events).every((event) => event.status === 'none');
        const needsAttentionRank = hasMissingPhone
          ? 500
          : hasFailed
            ? 400
            : hasQueued
              ? 350
              : hasNoEvent
                ? 300
                : hasSuppressed
                  ? 200
                  : 100 - todaySentCount;
        const recipientLabel = hasMissingPhone
          ? '보호자 번호 미등록'
          : `보호자 ${student.parentRows.filter((row) => !row.isPhoneMissing).length}명`;

        return {
          studentId: student.studentId,
          studentName: student.studentName,
          className: student.className,
          recipients: student.parentRows,
          recipientLabel,
          hasMissingPhone,
          todaySentCount,
          needsAttentionRank,
          events,
        };
      })
      .filter((row) => {
        if (!keyword) return true;
        const haystack = [
          row.studentName,
          row.className,
          row.recipientLabel,
          ...row.recipients.map((recipient) => `${recipient.parentName} ${recipient.phoneNumber}`),
        ].join(' ').toLowerCase();
        return haystack.includes(keyword);
      })
      .sort((a, b) => {
        if (a.needsAttentionRank !== b.needsAttentionRank) return b.needsAttentionRank - a.needsAttentionRank;
        return a.studentName.localeCompare(b.studentName, 'ko-KR');
      });
  }, [
    attendanceDailyStatsByStudentId,
    attendanceEventsByStudentId,
    attendanceRecordsByStudentId,
    recipientRows,
    smsDeliveryLogsRaw,
    smsQueueRaw,
    studentBoardSearchTerm,
    todayDateKey,
  ]);

  const todayBoardSummary = useMemo(() => {
    return {
      sentStudents: todayBoardRows.filter((row) => row.todaySentCount > 0).length,
      failedStudents: todayBoardRows.filter((row) => Object.values(row.events).some((event) => event.status === 'failed')).length,
      missingPhoneStudents: todayBoardRows.filter((row) => row.hasMissingPhone).length,
      retryStudents: todayBoardRows.filter((row) => Object.values(row.events).some((event) => event.status === 'queued' || event.status === 'failed')).length,
    };
  }, [todayBoardRows]);

  const selectedBoardStudent = useMemo(
    () => todayBoardRows.find((row) => row.studentId === selectedBoardStudentId) || null,
    [selectedBoardStudentId, todayBoardRows]
  );
  const selectedManualParentRow = useMemo(
    () => selectedBoardStudent?.recipients.find((row) => row.isManualRecipient) || null,
    [selectedBoardStudent]
  );

  useEffect(() => {
    if (!selectedBoardStudent) return;
    setRecipientPhoneDrafts((prev) => {
      const next = { ...prev };
      selectedBoardStudent.recipients.forEach((row) => {
        const key = `${row.studentId}:${row.parentUid}`;
        if (!(key in next)) {
          next[key] = row.phoneNumber || '';
        }
      });
      const manualParentRow = selectedBoardStudent.recipients.find((row) => row.isManualRecipient);
      const manualParentKey = `${selectedBoardStudent.studentId}:${MANUAL_PARENT_SMS_UID}`;
      if (!(manualParentKey in next)) {
        next[manualParentKey] = manualParentRow?.phoneNumber || '';
      }
      return next;
    });
  }, [selectedBoardStudent]);

  const filteredRecipientRows = useMemo(() => {
    const keyword = recipientSearchTerm.trim().toLowerCase();
    return recipientRows.filter((student) => {
      if (!keyword) return true;
      const haystack = [
        student.studentName,
        student.className,
        ...student.parentRows.map((row) => `${row.parentName} ${row.phoneNumber}`),
      ].join(' ').toLowerCase();
      return haystack.includes(keyword);
    });
  }, [recipientRows, recipientSearchTerm]);

  const historyRows = useMemo(() => {
    const deliveryRows = (smsDeliveryLogsRaw || []).map((row) => ({
      id: `delivery-${row.id}`,
      studentId: row.studentId || '',
      studentName: row.studentName || studentsById.get(row.studentId || '')?.name || '학생',
      parentName: row.parentName || '학부모',
      phoneNumber: row.phoneNumber || '',
      eventType: row.eventType || 'study_start',
      status: row.status || 'sent',
      provider: row.provider || 'none',
      renderedMessage: row.renderedMessage || '-',
      messageBytes: row.messageBytes || calculateSmsBytes(row.renderedMessage || '-'),
      attemptNo: row.attemptNo || 0,
      createdAt: row.createdAt,
      errorMessage: row.errorMessage || row.suppressedReason || '',
      source: 'delivery',
    }));

    const legacyRows = (legacySmsLogsRaw || []).map((row) => ({
      id: `legacy-${row.id}`,
      studentId: row.studentId || '',
      studentName: studentsById.get(row.studentId || '')?.name || '학생',
      parentName: '학부모',
      phoneNumber: '',
      eventType: (row.eventType || 'study_start') as SmsConsoleEventType,
      status: 'sent',
      provider: row.provider || 'legacy',
      renderedMessage: row.renderedMessage || row.message || '-',
      messageBytes: row.messageBytes || calculateSmsBytes(row.renderedMessage || row.message || '-'),
      attemptNo: 1,
      createdAt: row.createdAt,
      errorMessage: '',
      source: 'legacy',
    }));

    const rows = [...deliveryRows, ...legacyRows];
    const keyword = historySearchTerm.trim().toLowerCase();

    return rows
      .filter((row) => {
        if (historyEventFilter !== 'all' && row.eventType !== historyEventFilter) return false;
        if (historyStatusFilter !== 'all' && row.status !== historyStatusFilter) return false;
        if (historyTab === 'by-date' && selectedHistoryDate && toDateKeyFromValue(row.createdAt) !== selectedHistoryDate) return false;
        if (historyTab === 'by-student' && selectedHistoryStudentId !== 'all' && row.studentId !== selectedHistoryStudentId) return false;
        if (!keyword) return true;
        const haystack = [row.studentName, row.parentName, row.phoneNumber, row.renderedMessage].join(' ').toLowerCase();
        return haystack.includes(keyword);
      })
      .sort((a, b) => (b.createdAt?.toDate?.().getTime() || 0) - (a.createdAt?.toDate?.().getTime() || 0));
  }, [
    historyEventFilter,
    historySearchTerm,
    historyStatusFilter,
    historyTab,
    legacySmsLogsRaw,
    selectedHistoryDate,
    selectedHistoryStudentId,
    smsDeliveryLogsRaw,
    studentsById,
  ]);

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const applyRecommendedTemplates = () => {
    setForm((prev) => ({
      ...prev,
      smsTemplateStudyStart: DEFAULT_FORM.smsTemplateStudyStart,
      smsTemplateAwayStart: DEFAULT_FORM.smsTemplateAwayStart,
      smsTemplateAwayEnd: DEFAULT_FORM.smsTemplateAwayEnd,
      smsTemplateStudyEnd: DEFAULT_FORM.smsTemplateStudyEnd,
      smsTemplateLateAlert: DEFAULT_FORM.smsTemplateLateAlert,
    }));
  };

  const handleSave = async () => {
    if (!functions || !centerId || !isAdmin) return;
    const hasOverflow = templatePreviews.some((item) => item.bytes > SMS_BYTE_LIMIT);
    if (hasOverflow) {
      toast({
        variant: 'destructive',
        title: '90byte 초과',
        description: '초과된 템플릿을 먼저 줄여 주세요.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const saveNotificationSettings = httpsCallable(functions, 'saveNotificationSettingsSecure');
      await saveNotificationSettings({ centerId, ...form, smsApiKey: smsApiKeyInput.trim() });
      setSmsApiKeyInput('');
      setShowApiKeyEditor(false);
      toast({
        title: '문자 설정 저장 완료',
        description: '템플릿과 발송 설정이 업데이트되었습니다.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '저장 실패',
        description: error?.message || '문자 설정 저장 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearApiKey = async () => {
    if (!functions || !centerId || !isAdmin) return;
    setIsSaving(true);
    try {
      const saveNotificationSettings = httpsCallable(functions, 'saveNotificationSettingsSecure');
      await saveNotificationSettings({ centerId, clearSmsApiKey: true });
      setSmsApiKeyInput('');
      setShowApiKeyEditor(false);
      toast({
        title: '연동 키 제거 완료',
        description: '저장된 문자 연동 키를 해제했습니다.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '키 제거 실패',
        description: error?.message || '연동 키 제거 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetryQueue = async (queueId: string) => {
    if (!functions || !centerId) return;
    setQueueActionKey(`retry-${queueId}`);
    try {
      const retrySmsQueueItem = httpsCallable(functions, 'retrySmsQueueItem');
      await retrySmsQueueItem({ centerId, queueId });
      toast({
        title: '재시도 요청 완료',
        description: '문자 큐를 다시 발송 대기 상태로 돌렸습니다.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '재시도 실패',
        description: error?.message || '문자 재시도 중 오류가 발생했습니다.',
      });
    } finally {
      setQueueActionKey(null);
    }
  };

  const handleCancelQueue = async (queueId: string) => {
    if (!functions || !centerId) return;
    setQueueActionKey(`cancel-${queueId}`);
    try {
      const cancelSmsQueueItem = httpsCallable(functions, 'cancelSmsQueueItem');
      await cancelSmsQueueItem({ centerId, queueId });
      toast({
        title: '큐 취소 완료',
        description: '선택한 문자 큐를 취소했습니다.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '취소 실패',
        description: error?.message || '문자 큐 취소 중 오류가 발생했습니다.',
      });
    } finally {
      setQueueActionKey(null);
    }
  };

  const handleUpdateRecipientPreference = async (
    row: RecipientPreferenceRow,
    nextEnabled: boolean,
    nextEventToggles: Record<ParentSmsEventType, boolean>,
    phoneNumberOverride?: string
  ) => {
    if (!functions || !centerId) return;
    const actionKey = `${row.studentId}:${row.parentUid}`;
    setPreferenceActionKey(actionKey);
    try {
      const updateSmsRecipientPreference = httpsCallable(functions, 'updateSmsRecipientPreference');
      await updateSmsRecipientPreference({
        centerId,
        studentId: row.studentId,
        parentUid: row.parentUid,
        enabled: nextEnabled,
        eventToggles: nextEventToggles,
        phoneNumberOverride: phoneNumberOverride || undefined,
        parentNameOverride: row.parentName,
        isManualRecipient: row.isManualRecipient === true || row.parentUid === MANUAL_PARENT_SMS_UID,
      });
      toast({
        title: '수신 설정 저장 완료',
        description: `${row.studentName} 학생의 ${row.parentName} 수신 설정을 업데이트했습니다.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '수신 설정 저장 실패',
        description: error?.message || '학부모 수신 제어 저장 중 오류가 발생했습니다.',
      });
    } finally {
      setPreferenceActionKey(null);
    }
  };

  const handleSaveRecipientPhone = async (row: RecipientPreferenceRow) => {
    const actionKey = `${row.studentId}:${row.parentUid}`;
    const nextPhone = normalizePhoneNumber(recipientPhoneDrafts[actionKey] || '');
    if (!nextPhone) {
      toast({
        variant: 'destructive',
        title: '보호자 번호 확인',
        description: '보호자 휴대폰 번호를 01012345678 형식으로 입력해 주세요.',
      });
      return;
    }
    await handleUpdateRecipientPreference(row, row.enabled, row.eventToggles, nextPhone);
  };

  const handleSaveManualParentPhone = async (student: StudentSmsBoardRow) => {
    const actionKey = `${student.studentId}:${MANUAL_PARENT_SMS_UID}`;
    const nextPhone = normalizePhoneNumber(recipientPhoneDrafts[actionKey] || '');
    if (!nextPhone) {
      toast({
        variant: 'destructive',
        title: '보호자 번호 확인',
        description: '보호자 휴대폰 번호를 01012345678 형식으로 입력해 주세요.',
      });
      return;
    }

    const existingManualRow = student.recipients.find((row) => row.isManualRecipient);
    await handleUpdateRecipientPreference(
      existingManualRow || {
        studentId: student.studentId,
        studentName: student.studentName,
        className: student.className,
        parentUid: MANUAL_PARENT_SMS_UID,
        parentName: '보호자',
        phoneNumber: nextPhone,
        enabled: true,
        eventToggles: getDefaultEventToggles(),
        isManualRecipient: true,
      },
      existingManualRow?.enabled ?? true,
      existingManualRow?.eventToggles ?? getDefaultEventToggles(),
      nextPhone
    );
  };

  const handleResendStudentEvent = async (studentId: string, eventType: TodayBoardEventType) => {
    if (!functions || !centerId) return;
    const actionKey = `resend-${studentId}-${eventType}`;
    setManualSmsActionKey(actionKey);
    try {
      const notifyAttendanceSms = httpsCallable(functions, 'notifyAttendanceSms');
      await notifyAttendanceSms({ centerId, studentId, eventType });
      toast({
        title: '문자 재발송 요청 완료',
        description: `${getEventLabel(eventType)} 문자를 다시 발송 대기열에 넣었습니다.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '재발송 실패',
        description: error?.message || '문자 재발송 중 오류가 발생했습니다.',
      });
    } finally {
      setManualSmsActionKey(null);
    }
  };

  const handleSendManualSms = async () => {
    if (!functions || !centerId || !selectedBoardStudent) return;
    const message = manualSmsMessage.replace(/\s+/g, ' ').trim();
    if (!message) {
      toast({
        variant: 'destructive',
        title: '문자 내용 확인',
        description: '보낼 문자 내용을 입력해 주세요.',
      });
      return;
    }
    if (calculateSmsBytes(message) > SMS_BYTE_LIMIT) {
      toast({
        variant: 'destructive',
        title: '문자 길이 초과',
        description: '수동 문자 내용이 90byte를 넘었습니다.',
      });
      return;
    }

    const actionKey = `manual-${selectedBoardStudent.studentId}`;
    setManualSmsActionKey(actionKey);
    try {
      const sendManualStudentSms = httpsCallable(functions, 'sendManualStudentSms');
      await sendManualStudentSms({
        centerId,
        studentId: selectedBoardStudent.studentId,
        message,
      });
      setManualSmsMessage('');
      toast({
        title: '수동 문자 발송 요청 완료',
        description: `${selectedBoardStudent.studentName} 학생의 현재 수신 대상에게 문자를 보냈습니다.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '수동 문자 발송 실패',
        description: error?.message || '직접 문자 발송 중 오류가 발생했습니다.',
      });
    } finally {
      setManualSmsActionKey(null);
    }
  };

  const openStudentDialog = (studentId: string) => {
    setSelectedBoardStudentId(studentId);
    setIsStudentDialogOpen(true);
  };

  if (membershipsLoading && !activeMembership) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-30" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className={cn('mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-24', isMobile ? 'pt-1' : 'pt-4')}>
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-3xl font-black tracking-tighter text-primary">
          <BellRing className="h-7 w-7" /> 문자 알림 설정
        </h1>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground/60">
          90byte 최적화 · 직접 발송 · 수신 제어 · 30일 히스토리
        </p>
      </header>

      <AdminWorkbenchCommandBar
        eyebrow="문자 운영 워크벤치"
        title="센터 문자 운영 워크벤치"
        description="최근 흐름을 먼저 보고, 학생별 발송 현황과 수신 제어를 같은 패턴으로 이어서 관리합니다."
        searchValue={studentBoardSearchTerm}
        onSearchChange={setStudentBoardSearchTerm}
        searchPlaceholder="학생명, 반 검색"
        quickActions={[
          { label: '학생 발송 보기', icon: <MessageSquare className="h-4 w-4" />, onClick: () => setHistoryTab('by-student') },
          { label: '수신 제어', icon: <ShieldCheck className="h-4 w-4" />, onClick: () => setRecipientSearchTerm('') },
          { label: '리드상담', icon: <Megaphone className="h-4 w-4" />, href: '/dashboard/leads' },
          { label: '수익분석', icon: <TrendingUp className="h-4 w-4" />, href: '/dashboard/revenue' },
          { label: '리포트 생성', icon: <Save className="h-4 w-4" />, href: '/dashboard/reports' },
          { label: '출결 이동', icon: <Clock3 className="h-4 w-4" />, href: '/dashboard/attendance' },
        ]}
      />

      <Card className="rounded-[2rem] border-none shadow-xl ring-1 ring-black/[0.04]">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
            <PlugZap className="h-5 w-5" /> 연동 설정
          </CardTitle>
          <CardDescription className="font-bold text-sm">
            상단에서는 최근 7일 문자 전송 흐름을 보고, 아래에서 연동과 발송 규칙을 바로 관리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 p-6">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">최근 7일 문자 전송 현황</p>
                <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">센터 문자 흐름을 선그래프로 빠르게 확인합니다.</h3>
                <p className="mt-2 text-sm font-bold text-slate-500">발송완료와 실패·보류 흐름을 함께 보고, 오늘 대기 건수까지 같이 확인합니다.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="border-none bg-emerald-100 text-emerald-700 font-black">발송완료 {smsTrendSummary.totalSent}건</Badge>
                <Badge className="border-none bg-rose-100 text-rose-700 font-black">실패·보류 {smsTrendSummary.totalIssue}건</Badge>
                <Badge className="border-none bg-blue-100 text-blue-700 font-black">오늘 대기 {smsTrendSummary.pendingTodayCount}건</Badge>
              </div>
            </div>
            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-100 bg-slate-50/80 p-4">
              <svg viewBox={`0 0 ${smsTrendChart.width} ${smsTrendChart.height}`} className="h-56 w-full">
                {smsTrendChart.yTicks.map((tick, index) => {
                  const y = smsTrendChart.paddingTop + (smsTrendChart.chartHeight / Math.max(1, smsTrendChart.yTicks.length - 1)) * index;
                  return (
                    <g key={`tick-${tick}-${index}`}>
                      <line x1={smsTrendChart.paddingX} y1={y} x2={smsTrendChart.width - smsTrendChart.paddingX} y2={y} stroke="rgba(148, 163, 184, 0.16)" strokeDasharray="4 6" />
                      <text x={4} y={y + 4} fontSize="11" fontWeight="800" fill="#64748b">{tick}</text>
                    </g>
                  );
                })}
                <path d={smsTrendChart.sentAreaPath} fill="rgba(16, 185, 129, 0.10)" />
                <path d={smsTrendChart.sentPath} fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                <path d={smsTrendChart.issuePath} fill="none" stroke="#f97316" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="10 8" />
                {smsTrendChart.sentPoints.map((point, index) => (
                  <circle key={`sent-${index}`} cx={point.x} cy={point.y} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="3" />
                ))}
                {smsTrendChart.issuePoints.map((point, index) => (
                  <circle key={`issue-${index}`} cx={point.x} cy={point.y} r="4.5" fill="#f97316" stroke="#ffffff" strokeWidth="2.5" />
                ))}
              </svg>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {smsTrendSummary.range.map((item) => (
                  <div key={item.key} className="rounded-xl bg-white px-2 py-2 text-center shadow-sm ring-1 ring-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</p>
                    <div className="mt-2 flex items-center justify-center gap-2 text-xs font-black">
                      <span className="text-emerald-600">완료 {item.sent}</span>
                      <span className="text-orange-600">이슈 {item.issue}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs font-black text-slate-600">
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />발송완료</span>
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" />실패·보류</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
            <div className="min-w-[150px]">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">센터 문자 전송</p>
              <p className="mt-1 text-sm font-black text-slate-900">공통 스위치와 제공사 상태를 여기서 함께 확인합니다.</p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
                <span className="text-sm font-black text-slate-700">문자 전송</span>
                <Switch checked={form.smsEnabled} onCheckedChange={(checked) => updateField('smsEnabled', checked)} />
              </div>
              <Badge className="border-none bg-slate-100 text-slate-700 font-black">
                {form.smsProvider === 'none' ? '연결 안함' : form.smsProvider === 'aligo' ? '알리고' : '사용자 엔드포인트'}
              </Badge>
              <Badge className={cn('border-none font-black', providerReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                {providerReady ? '발송 가능' : '설정 보완 필요'}
              </Badge>
              <Badge className={cn('border-none font-black', isSmsApiKeyConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                {isSmsApiKeyConfigured ? '연동 키 등록됨' : '연동 키 미등록'}
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground">연동 방식</Label>
              <Select value={form.smsProvider} onValueChange={(value) => updateField('smsProvider', value as 'none' | 'aligo' | 'custom')}>
                <SelectTrigger className="h-11 rounded-xl border-2 font-bold">
                  <SelectValue placeholder="SMS 제공사 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="font-bold">연결 안함</SelectItem>
                  <SelectItem value="aligo" className="font-bold">알리고</SelectItem>
                  <SelectItem value="custom" className="font-bold">사용자 엔드포인트</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground">발신번호</Label>
              <Input value={form.smsSender} onChange={(e) => updateField('smsSender', e.target.value)} placeholder="01012345678" className="h-11 rounded-xl border-2 font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground">연동 사용자 아이디</Label>
              <Input value={form.smsUserId} onChange={(e) => updateField('smsUserId', e.target.value)} placeholder="발신 계정 아이디" className="h-11 rounded-xl border-2 font-bold" />
            </div>
            {form.smsProvider === 'custom' ? (
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-muted-foreground">연동 주소</Label>
                <Input value={form.smsEndpointUrl} onChange={(e) => updateField('smsEndpointUrl', e.target.value)} placeholder="https://your-sms-gateway.example/send" className="h-11 rounded-xl border-2 font-bold" />
              </div>
            ) : form.smsProvider === 'aligo' ? (
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-muted-foreground">알리고 발송 경로</Label>
                <div className="flex h-11 items-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-600">
                  알리고는 시스템 발송 API를 사용해 별도 주소 입력이 필요 없습니다.
                </div>
              </div>
            ) : null}
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground">
                {isSmsApiKeyConfigured && !showApiKeyEditor ? '연동 상태' : '연동 키'}
              </Label>
              {isSmsApiKeyConfigured && !showApiKeyEditor ? (
                <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-emerald-800">저장된 연동 키로 발송 중입니다.</p>
                    <p className="mt-1 text-xs font-bold text-emerald-700/90">
                      {form.smsProvider === 'aligo'
                        ? '알리고는 저장된 키와 사용자 아이디로 바로 발송합니다.'
                        : '저장된 연동 키로 사용자 엔드포인트를 호출합니다.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="h-11 rounded-xl font-black" onClick={() => setShowApiKeyEditor(true)}>
                      키 다시 등록
                    </Button>
                    <Button type="button" variant="outline" className="h-11 rounded-xl font-black text-rose-600" onClick={() => void handleClearApiKey()}>
                      키 해제
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input value={smsApiKeyInput} onChange={(e) => setSmsApiKeyInput(e.target.value)} placeholder={isSmsApiKeyConfigured ? '새 키를 입력하면 교체됩니다.' : '연동 키 입력'} className="h-11 rounded-xl border-2 font-bold" />
                  <Button type="button" className="h-11 rounded-xl font-black" onClick={() => void handleSave()} disabled={isSaving || isLoading}>
                    {(isSaving || isLoading) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    연동 저장
                  </Button>
                  {isSmsApiKeyConfigured ? (
                    <>
                      <Button type="button" variant="outline" className="h-11 rounded-xl font-black" onClick={() => { setSmsApiKeyInput(''); setShowApiKeyEditor(false); }}>
                        입력 닫기
                      </Button>
                      <Button type="button" variant="outline" className="h-11 rounded-xl font-black text-rose-600" onClick={() => void handleClearApiKey()}>
                        키 해제
                      </Button>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          </div>
      </CardContent>
      </Card>
      <Card className="rounded-[2rem] border-none shadow-xl ring-1 ring-black/[0.04]">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle className="text-xl font-black tracking-tight">발송 현황</CardTitle>
          <CardDescription className="font-bold text-sm">
            학생별로 오늘 등원·외출·복귀·하원 문자 시각만 먼저 보고, 상세는 팝업에서 확인합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">오늘 발송완료 학생</p><p className="mt-2 text-3xl font-black text-emerald-800">{todayBoardSummary.sentStudents}</p></div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-rose-700">실패 학생</p><p className="mt-2 text-3xl font-black text-rose-800">{todayBoardSummary.failedStudents}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">번호 미등록</p><p className="mt-2 text-3xl font-black text-slate-700">{todayBoardSummary.missingPhoneStudents}</p></div>
            <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-orange-700">재확인 필요</p><p className="mt-2 text-3xl font-black text-orange-800">{todayBoardSummary.retryStudents}</p></div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.6fr_0.8fr]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={studentBoardSearchTerm} onChange={(e) => setStudentBoardSearchTerm(e.target.value)} placeholder="학생명, 반 검색" className="h-11 rounded-xl border-2 pl-10 font-bold" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-bold text-slate-600">
              실패 · 번호없음 · 미발송 학생이 위로 올라옵니다.
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="hidden items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 md:grid md:grid-cols-[1.4fr_repeat(4,minmax(88px,1fr))]">
              <span>학생</span>
              {TODAY_BOARD_EVENTS.map((event) => (
                <span key={event.value} className="text-center">{event.label}</span>
              ))}
            </div>
            <div className="grid gap-0">
              {todayBoardRows.length === 0 ? (
                <div className="py-12 text-center text-sm font-bold text-muted-foreground">표시할 학생 문자 현황이 없습니다.</div>
              ) : todayBoardRows.map((student) => (
                <button
                  key={student.studentId}
                  type="button"
                  onClick={() => openStudentDialog(student.studentId)}
                  className="border-b border-slate-100 px-4 py-4 text-left transition-colors hover:bg-slate-50/80 last:border-b-0"
                >
                  <div className="flex flex-col gap-4 md:grid md:grid-cols-[1.4fr_repeat(4,minmax(88px,1fr))] md:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-black text-slate-900">{student.studentName}</p>
                        <Badge className="border-none bg-slate-100 text-slate-700 font-black">{student.className}</Badge>
                        <Badge className={cn('border-none font-black', student.hasMissingPhone ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700')}>
                          {student.recipientLabel}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        수신 대상 {student.recipients.filter((row) => !row.isPhoneMissing).length}명 · 오늘 발송 {student.todaySentCount}건
                      </p>
                    </div>
                    {TODAY_BOARD_EVENTS.map((event) => {
                      const summary = student.events[event.value];
                      return (
                        <div key={event.value} className={cn('rounded-xl border px-3 py-3 text-center', getTodayBoardCellTone(summary.status))}>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{event.label}</p>
                          <p className="mt-1 text-sm font-black">{summary.status === 'sent' || summary.status === 'recorded' || summary.status === 'missing_phone' ? summary.timeLabel : summary.badgeLabel}</p>
                        </div>
                      );
                    })}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isStudentDialogOpen && !!selectedBoardStudent}
        onOpenChange={(open) => {
          setIsStudentDialogOpen(open);
          if (!open) setSelectedBoardStudentId(null);
        }}
      >
        <DialogContent
          motionPreset="dashboard-premium"
          className={cn(
            'flex min-h-0 flex-col overflow-hidden border-none p-0 shadow-2xl',
            isMobile
              ? 'fixed left-1/2 top-1/2 h-[min(88svh,46rem)] w-[95vw] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-[2rem]'
              : 'h-[min(920px,calc(100dvh-2rem))] w-[min(1120px,calc(100vw-2rem))] max-w-[1120px] rounded-[2.5rem]'
          )}
        >
          {selectedBoardStudent ? (
            <div className="flex h-full min-h-0 flex-col bg-white">
              <div className="shrink-0 bg-gradient-to-br from-[#17306f] via-[#2046ab] to-[#2f66ff] px-6 py-6 text-white sm:px-8">
                <DialogHeader className="space-y-2 text-left">
                  <DialogTitle className="text-2xl font-black tracking-tight text-white">
                    {selectedBoardStudent.studentName}
                  </DialogTitle>
                  <DialogDescription className="text-sm font-bold text-white/80">
                    {selectedBoardStudent.className} · 오늘 문자 발송 흐름과 수신 번호를 함께 확인합니다.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge className="border-none bg-white/20 text-white font-black">수신 대상 {selectedBoardStudent.recipients.filter((row) => !row.isPhoneMissing).length}명</Badge>
                  <Badge className="border-none bg-white/20 text-white font-black">오늘 발송 {selectedBoardStudent.todaySentCount}건</Badge>
                  <Badge className={cn('border-none font-black', selectedBoardStudent.hasMissingPhone ? 'bg-white text-slate-700' : 'bg-emerald-100 text-emerald-700')}>
                    {selectedBoardStudent.recipientLabel}
                  </Badge>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-6">
                <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
                <section className="min-w-0 space-y-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">수신 번호</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">보호자 번호가 없으면 문자 발송 대상에서 제외됩니다.</p>
                  </div>
                  <div className="grid gap-3">
                    {selectedBoardStudent.recipients.map((row) => {
                      const actionKey = `${row.studentId}:${row.parentUid}`;
                      return (
                        <div key={actionKey} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-black text-slate-900">{row.parentName}</p>
                                {row.isManualRecipient ? <Badge className="border-none bg-orange-100 text-orange-700 font-black">보호자 직접 추가</Badge> : null}
                                {row.isPhoneMissing ? <Badge className="border-none bg-slate-200 text-slate-700 font-black">번호 미등록</Badge> : null}
                              </div>
                              <p className="mt-1 text-xs font-bold text-slate-500">{row.phoneNumber ? formatPhone(row.phoneNumber) : '번호 미등록'}</p>
                              {row.isPhoneMissing ? (
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                  <Input
                                    value={recipientPhoneDrafts[actionKey] ?? row.phoneNumber}
                                    onChange={(e) => setRecipientPhoneDrafts((prev) => ({ ...prev, [actionKey]: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                                    placeholder="보호자 번호 입력"
                                    className="h-9 rounded-xl border-2 text-sm font-bold"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9 rounded-xl px-3 text-xs font-black"
                                    disabled={preferenceActionKey === actionKey}
                                    onClick={() => void handleSaveRecipientPhone(row)}
                                  >
                                    {preferenceActionKey === actionKey ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                                    번호 저장
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-slate-500">전체 수신</span>
                              <Switch
                                checked={row.enabled}
                                disabled={row.isPhoneMissing || preferenceActionKey === actionKey}
                                onCheckedChange={(checked) => void handleUpdateRecipientPreference(row, checked, row.eventToggles)}
                              />
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {RECIPIENT_EVENT_OPTIONS.filter((item) => TODAY_BOARD_EVENTS.some((event) => event.value === item.value) || item.value === 'late_alert' || item.value === 'weekly_report').map((eventItem) => {
                              const enabled = row.eventToggles[eventItem.value] !== false;
                              return (
                                <Button
                                  key={eventItem.value}
                                  type="button"
                                  variant="outline"
                                  className={cn('h-8 rounded-full px-3 text-xs font-black', enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500')}
                                  disabled={row.isPhoneMissing || preferenceActionKey === actionKey}
                                  onClick={() => void handleUpdateRecipientPreference(row, row.enabled, { ...row.eventToggles, [eventItem.value]: !enabled })}
                                >
                                  {preferenceActionKey === actionKey ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                                  {eventItem.label}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-slate-900">보호자 번호 추가</p>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            학부모 계정 연결 전에도 이 번호를 보호자 문자 수신 대상으로 사용합니다.
                          </p>
                        </div>
                        {selectedManualParentRow?.phoneNumber ? (
                          <Badge className="border-none bg-white text-orange-700 font-black">
                            {formatPhone(selectedManualParentRow.phoneNumber)}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={recipientPhoneDrafts[`${selectedBoardStudent.studentId}:${MANUAL_PARENT_SMS_UID}`] ?? selectedManualParentRow?.phoneNumber ?? ''}
                          onChange={(e) => setRecipientPhoneDrafts((prev) => ({ ...prev, [`${selectedBoardStudent.studentId}:${MANUAL_PARENT_SMS_UID}`]: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                          inputMode="tel"
                          maxLength={11}
                          placeholder="보호자 번호 입력"
                          className="h-10 rounded-xl border-2 border-orange-200 bg-white text-sm font-bold"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 rounded-xl border-orange-200 bg-white px-4 text-xs font-black text-orange-700 hover:bg-orange-100"
                          disabled={preferenceActionKey === `${selectedBoardStudent.studentId}:${MANUAL_PARENT_SMS_UID}`}
                          onClick={() => void handleSaveManualParentPhone(selectedBoardStudent)}
                        >
                          {preferenceActionKey === `${selectedBoardStudent.studentId}:${MANUAL_PARENT_SMS_UID}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                          {selectedManualParentRow?.phoneNumber ? '보호자 번호 저장' : '보호자 번호 추가'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="min-w-0 space-y-4">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">오늘 발송 로그</h3>
                    <p className="mt-1 text-xs font-bold text-slate-500">등원·외출·복귀·하원 문자 기준으로 오늘 접수된 내용과 출결 기록을 함께 보여줍니다.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-black text-slate-900">직접 문자 보내기</h4>
                        <p className="mt-1 text-xs font-bold text-slate-500">현재 수신 허용된 번호로 원하는 문자를 바로 발송합니다.</p>
                      </div>
                      <Badge className={cn('border-none font-black', getByteTone(calculateSmsBytes(manualSmsMessage.replace(/\s+/g, ' ').trim())))}>{calculateSmsBytes(manualSmsMessage.replace(/\s+/g, ' ').trim())}byte</Badge>
                    </div>
                    <Textarea
                      value={manualSmsMessage}
                      onChange={(e) => setManualSmsMessage(e.target.value)}
                      placeholder="예: 오늘은 자습 시작이 늦어져 19시부터 학습을 시작했습니다. 귀가 전 다시 안내드리겠습니다."
                      className="mt-3 min-h-[104px] rounded-2xl border-2 font-bold leading-6"
                    />
                    <div className="mt-3 flex flex-wrap justify-between gap-2">
                      <p className="text-xs font-bold text-slate-500">90byte 이하로 전송됩니다.</p>
                      <Button
                        type="button"
                        className="h-10 rounded-xl font-black"
                        disabled={manualSmsActionKey === `manual-${selectedBoardStudent.studentId}`}
                        onClick={() => void handleSendManualSms()}
                      >
                        {manualSmsActionKey === `manual-${selectedBoardStudent.studentId}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                        직접 문자 보내기
                      </Button>
                    </div>
                  </div>
                  {TODAY_BOARD_EVENTS.map((event) => {
                    const summary = selectedBoardStudent.events[event.value];
                    const baseDetailRows: StudentDialogLogDetailRow[] = [
                      ...summary.logRows.map((row) => ({
                        id: `log-${row.id}`,
                        type: 'log' as const,
                        parentName: row.parentName || '수신자',
                        phoneNumber: row.phoneNumber || '',
                        message: row.renderedMessage || '-',
                        statusLabel: getDeliveryStatusLabel(row.status),
                        statusTone: row.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : row.status === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700',
                        timeLabel: formatDateLabel(row.sentAt || row.failedAt || row.createdAt),
                        errorMessage: row.errorMessage || row.suppressedReason || '',
                        queueId: null as string | null,
                        queueStatus: null as string | null,
                      })),
                      ...summary.queueRows
                        .filter((row) => ['queued', 'processing', 'pending_provider', 'cancelled'].includes(String(row.status || '')))
                        .map((row) => ({
                          id: `queue-${row.id}`,
                          type: 'queue' as const,
                          parentName: row.parentName || '수신자',
                          phoneNumber: row.phoneNumber || row.to || '',
                          message: row.renderedMessage || row.message || '-',
                          statusLabel: getQueueStatusLabel(row.status, row.providerStatus, row.nextAttemptAt, row.attemptCount),
                          statusTone: getStatusTone(row.status, row.providerStatus, row.nextAttemptAt, row.attemptCount),
                          timeLabel: formatDateLabel(row.nextAttemptAt || row.createdAt),
                          errorMessage: row.failedReason || row.lastErrorMessage || '',
                          queueId: row.id,
                          queueStatus: String(row.status || ''),
                        })),
                    ];

                    const syntheticAttendanceRow =
                      baseDetailRows.length === 0 && (summary.status === 'recorded' || summary.status === 'missing_phone')
                        ? {
                            id: `attendance-${selectedBoardStudent.studentId}-${event.value}`,
                            type: 'attendance' as const,
                            parentName: summary.status === 'missing_phone' ? '번호 미등록' : '출결 기록',
                            phoneNumber:
                              selectedBoardStudent.recipients
                                .map((recipient) => recipient.phoneNumber)
                                .find(Boolean) || '',
                            message:
                              summary.status === 'missing_phone'
                                ? '오늘 출결 기록은 확인되지만 발송 가능한 번호가 없어 문자 접수가 되지 않았습니다.'
                                : '오늘 출결 기록은 확인되지만 문자 접수 로그가 없어 다시 보내기가 필요합니다.',
                            statusLabel: summary.status === 'missing_phone' ? '번호없음' : '미접수',
                            statusTone:
                              summary.status === 'missing_phone'
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-amber-100 text-amber-700',
                            timeLabel:
                              summary.timeLabel !== '-'
                                ? `${todayDateKey.slice(5).replace('-', '.')} ${summary.timeLabel}`
                                : '-',
                            errorMessage: '',
                            queueId: null,
                            queueStatus: null,
                          }
                        : null;

                    const detailRows: StudentDialogLogDetailRow[] = [
                      ...baseDetailRows,
                      ...(syntheticAttendanceRow ? [syntheticAttendanceRow] : []),
                    ].sort((a, b) => {
                      const aTime = a.timeLabel === '-' ? 0 : Date.parse(`2026-01-01T${a.timeLabel.slice(-5)}:00+09:00`);
                      const bTime = b.timeLabel === '-' ? 0 : Date.parse(`2026-01-01T${b.timeLabel.slice(-5)}:00+09:00`);
                      return bTime - aTime;
                    });

                    return (
                      <div key={event.value} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <p className="text-base font-black text-slate-900">{event.label}</p>
                            <Badge className={cn('border-none font-black', getTodayBoardCellTone(summary.status))}>{summary.status === 'sent' || summary.status === 'recorded' || summary.status === 'missing_phone' ? summary.timeLabel : summary.badgeLabel}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-500">오늘 {detailRows.length}건</p>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 rounded-lg px-3 text-xs font-black"
                              disabled={manualSmsActionKey === `resend-${selectedBoardStudent.studentId}-${event.value}`}
                              onClick={() => void handleResendStudentEvent(selectedBoardStudent.studentId, event.value)}
                            >
                              {manualSmsActionKey === `resend-${selectedBoardStudent.studentId}-${event.value}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1 h-3.5 w-3.5" />}
                              다시 보내기
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3">
                          {detailRows.length === 0 ? (
                            <div className="rounded-xl border border-dashed py-6 text-center text-sm font-bold text-muted-foreground">오늘 기록이 없습니다.</div>
                          ) : detailRows.map((row) => (
                            <div key={row.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-slate-900">{row.parentName}</p>
                                    <Badge className={cn('border-none font-black', row.statusTone)}>{row.statusLabel}</Badge>
                                  </div>
                                  <p className="mt-1 text-[11px] font-bold text-slate-500">{row.phoneNumber ? formatPhone(row.phoneNumber) : '번호 미등록'}</p>
                                </div>
                                <p className="text-[11px] font-bold text-slate-500">{row.timeLabel}</p>
                              </div>
                              <p className="mt-3 rounded-lg bg-white px-3 py-3 text-sm font-bold leading-6 text-slate-800">{row.message}</p>
                              {row.statusLabel === '알리고 접수' ? (
                                <p className="mt-2 text-[11px] font-bold text-slate-500">알리고 접수 기준입니다. 실제 수신은 통신사/단말 정책에 따라 달라질 수 있습니다.</p>
                              ) : null}
                              {row.errorMessage ? <p className="mt-2 text-xs font-bold text-rose-600">{row.errorMessage}</p> : null}
                              {row.type === 'queue' && row.queueId ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {['failed', 'pending_provider', 'cancelled'].includes(row.queueStatus || '') ? (
                                    <Button type="button" variant="outline" className="h-8 rounded-lg px-3 text-xs font-black" disabled={queueActionKey === `retry-${row.queueId}`} onClick={() => void handleRetryQueue(row.queueId!)}>
                                      {queueActionKey === `retry-${row.queueId}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1 h-3.5 w-3.5" />}재시도
                                    </Button>
                                  ) : null}
                                  {['queued', 'pending_provider', 'failed'].includes(row.queueStatus || '') ? (
                                    <Button type="button" variant="outline" className="h-8 rounded-lg px-3 text-xs font-black text-rose-600" disabled={queueActionKey === `cancel-${row.queueId}`} onClick={() => void handleCancelQueue(row.queueId!)}>
                                      {queueActionKey === `cancel-${row.queueId}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1 h-3.5 w-3.5" />}취소
                                    </Button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </section>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Card className="rounded-[2rem] border-none shadow-xl ring-1 ring-black/[0.04]">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle className="text-xl font-black tracking-tight">수신 관리</CardTitle>
          <CardDescription className="font-bold text-sm">보호자 번호가 있는 수신 대상만 문자 발송에 사용하고 이벤트별 수신을 제어합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={recipientSearchTerm} onChange={(e) => setRecipientSearchTerm(e.target.value)} placeholder="학생명, 반, 학부모명, 번호 검색" className="h-11 rounded-xl border-2 pl-10 font-bold" />
          </div>

          <div className="grid gap-3">
            {filteredRecipientRows.length === 0 ? (
              <div className="rounded-xl border border-dashed py-10 text-center text-sm font-bold text-muted-foreground">표시할 문자 수신 대상이 없습니다.</div>
            ) : filteredRecipientRows.map((student) => (
              <details key={student.studentId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-base font-black text-slate-900">{student.studentName}</p>
                      <p className="text-xs font-bold text-slate-500">{student.className} · 현재 수신 대상 {student.parentRows.filter((row) => !row.isPhoneMissing).length}명</p>
                    </div>
                    <Badge className="border-none bg-slate-100 text-slate-700 font-black">수신 제어</Badge>
                  </div>
                </summary>
                <div className="mt-4 grid gap-3">
                  {student.parentRows.map((row) => {
                    const actionKey = `${row.studentId}:${row.parentUid}`;
                    return (
                      <div key={actionKey} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-black text-slate-900">{row.parentName}</p>
                              {row.isPhoneMissing ? <Badge className="border-none bg-slate-200 text-slate-700 font-black">번호 미등록</Badge> : null}
                            </div>
                            <p className="text-xs font-bold text-slate-500">{row.phoneNumber ? formatPhone(row.phoneNumber) : '번호 미등록'}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-500">전체 수신</span>
                            <Switch checked={row.enabled} disabled={row.isPhoneMissing || preferenceActionKey === actionKey} onCheckedChange={(checked) => void handleUpdateRecipientPreference(row, checked, row.eventToggles)} />
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {RECIPIENT_EVENT_OPTIONS.map((eventItem) => {
                            const enabled = row.eventToggles[eventItem.value] !== false;
                            return (
                              <Button key={eventItem.value} type="button" variant="outline" className={cn('h-8 rounded-full px-3 text-xs font-black', enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500')} disabled={row.isPhoneMissing || preferenceActionKey === actionKey} onClick={() => void handleUpdateRecipientPreference(row, row.enabled, { ...row.eventToggles, [eventItem.value]: !enabled })}>
                                {preferenceActionKey === actionKey ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                                {eventItem.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border-none shadow-xl ring-1 ring-black/[0.04]">
        <CardHeader className="border-b bg-muted/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
                <MessageSquare className="h-5 w-5" /> 문자 템플릿
              </CardTitle>
              <CardDescription className="font-bold text-sm">
                사용 가능 변수: {'{centerName}'}, {'{studentName}'}, {'{time}'}, {'{expectedTime}'}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" className="h-10 rounded-xl font-black" onClick={applyRecommendedTemplates}>
                90byte 내 꽉 채운 추천문구
              </Button>
              <Button type="button" className="h-10 rounded-xl font-black gap-2" onClick={() => void handleSave()} disabled={isSaving || isLoading}>
                {(isSaving || isLoading) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                템플릿 저장
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 lg:grid-cols-2">
          {TEMPLATE_META.map((item) => {
            const preview = templatePreviews.find((row) => row.key === item.key)!;
            return (
              <div key={item.key} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-[11px] font-black uppercase text-muted-foreground">{item.label}</Label>
                  <div className="flex items-center gap-2">
                    <Badge className={cn('border-none font-black', getByteTone(preview.bytes))}>{preview.bytes}byte</Badge>
                    <Badge className={cn('border-none font-black', getByteTone(preview.bytes))}>{getByteLabel(preview.bytes)}</Badge>
                  </div>
                </div>
                <Textarea value={form[item.key]} onChange={(e) => updateField(item.key, e.target.value)} className="mt-3 min-h-[96px] rounded-xl border-2 bg-white font-bold" />
                <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">실제 미리보기</p>
                  </div>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-800">{preview.rendered || `${item.sampleStatus} 메시지를 입력해 주세요.`}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border-none shadow-xl ring-1 ring-black/[0.04]">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
            <Clock3 className="h-5 w-5" /> 지각 알림 규칙
          </CardTitle>
          <CardDescription className="font-bold text-sm">
            학생이 직접 정한 등원시간보다 {form.lateAlertGraceMinutes}분 이상 늦으면 자동으로 지각 알림을 큐에 넣습니다. 등원시간이 없는 학생은 제외됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase text-muted-foreground">지각 알림 활성화</Label>
            <div className="flex h-11 items-center justify-between rounded-xl border-2 px-3">
              <span className="text-sm font-bold">자동 체크</span>
              <Switch checked={form.lateAlertEnabled} onCheckedChange={(checked) => updateField('lateAlertEnabled', checked)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase text-muted-foreground">허용 지각 (분)</Label>
            <Input type="number" min={0} value={form.lateAlertGraceMinutes} onChange={(e) => updateField('lateAlertGraceMinutes', Number(e.target.value || 20))} className="h-11 rounded-xl border-2 font-bold" />
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-[2rem] border-none shadow-xl ring-1 ring-black/[0.04]">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle className="text-xl font-black tracking-tight">히스토리</CardTitle>
          <CardDescription className="font-bold text-sm">최근 30일 기준으로 일자별 발송 내역과 학생별 타임라인을 모두 확인합니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <Tabs value={historyTab} onValueChange={(value) => setHistoryTab(value as typeof historyTab)}>
            <TabsList className="h-11 rounded-xl bg-slate-100 p-1">
              <TabsTrigger value="by-date" className="rounded-lg font-black">일자별 보기</TabsTrigger>
              <TabsTrigger value="by-student" className="rounded-lg font-black">학생별 보기</TabsTrigger>
            </TabsList>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={historySearchTerm} onChange={(e) => setHistorySearchTerm(e.target.value)} placeholder="학생명, 학부모명, 문구 검색" className="h-11 rounded-xl border-2 pl-10 font-bold" />
              </div>
              <Select value={historyEventFilter} onValueChange={(value) => setHistoryEventFilter(value as typeof historyEventFilter)}>
                <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="이벤트 필터" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 이벤트</SelectItem>
                  {SMS_EVENTS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={historyStatusFilter} onValueChange={(value) => setHistoryStatusFilter(value as typeof historyStatusFilter)}>
                <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="상태 필터" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  <SelectItem value="sent">발송완료</SelectItem>
                  <SelectItem value="failed">실패</SelectItem>
                  <SelectItem value="suppressed_opt_out">수신거부</SelectItem>
                </SelectContent>
              </Select>

              <TabsContent value="by-date" className="mt-0">
                <Input type="date" value={selectedHistoryDate} onChange={(e) => setSelectedHistoryDate(e.target.value)} className="h-11 rounded-xl border-2 font-bold" />
              </TabsContent>
              <TabsContent value="by-student" className="mt-0">
                <Select value={selectedHistoryStudentId} onValueChange={(value) => setSelectedHistoryStudentId(value)}>
                  <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="학생 선택" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 학생</SelectItem>
                    {(studentsRaw || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko-KR')).map((student) => (
                      <SelectItem key={student.id} value={student.id}>{student.name || student.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>
            </div>
          </Tabs>

          <div className="grid gap-3">
            {historyRows.length === 0 ? (
              <div className="rounded-xl border border-dashed py-10 text-center text-sm font-bold text-muted-foreground">조건에 맞는 문자 히스토리가 없습니다.</div>
            ) : historyRows.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-slate-900">{row.studentName || '학생'}</p>
                      <Badge className="border-none bg-slate-100 text-slate-700 font-black">{getEventLabel(row.eventType)}</Badge>
                      <Badge className={cn('border-none font-black', row.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : row.status === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')}>{getDeliveryStatusLabel(row.status)}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-slate-500">{row.parentName || '학부모'} {row.phoneNumber ? `· ${formatPhone(row.phoneNumber)}` : ''} · {row.provider || 'none'}</p>
                  </div>
                  <p className="text-[11px] font-bold text-slate-500">{formatDateLabel(row.createdAt)}</p>
                </div>
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-3 text-sm font-bold leading-6 text-slate-800">{row.renderedMessage}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge className={cn('border-none font-black', getByteTone(Number(row.messageBytes || calculateSmsBytes(row.renderedMessage || ''))))}>{Number(row.messageBytes || calculateSmsBytes(row.renderedMessage || ''))}byte</Badge>
                  <Badge className="border-none bg-slate-100 text-slate-700 font-black">시도 {Number(row.attemptNo || 1)}회</Badge>
                  <Badge className="border-none bg-slate-100 text-slate-700 font-black">{row.source === 'legacy' ? 'legacy 로그' : 'delivery 로그'}</Badge>
                </div>
                {row.errorMessage ? <p className={cn('mt-2 text-xs font-bold', row.status === 'failed' ? 'text-rose-600' : 'text-amber-700')}>{row.status === 'failed' ? '실패 사유' : '수신거부 사유'}: {row.errorMessage}</p> : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Button onClick={() => void handleSave()} disabled={isSaving || isLoading} className="h-14 rounded-2xl text-lg font-black shadow-xl gap-2">
        {(isSaving || isLoading) ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
        설정 저장
      </Button>
    </div>
  );
}
