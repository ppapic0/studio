'use client';

import { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, doc, limit, orderBy, query } from 'firebase/firestore';
import {
  BellRing,
  Clock3,
  Loader2,
  MessageSquare,
  PlugZap,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

import { useCollection, useDoc, useFirestore, useFunctions, useMemoFirebase } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useToast } from '@/hooks/use-toast';
import { isAdminRole } from '@/lib/dashboard-access';
import type { NotificationSettings } from '@/lib/types';
import { cn } from '@/lib/utils';
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

const SMS_BYTE_LIMIT = 90;
const STUDENT_SMS_FALLBACK_UID = '__student__';

type ParentSmsEventType =
  | 'study_start'
  | 'away_start'
  | 'study_end'
  | 'late_alert'
  | 'weekly_report';

type SmsConsoleEventType = ParentSmsEventType | 'risk_alert';

type SmsEventTemplateKey =
  | 'smsTemplateStudyStart'
  | 'smsTemplateAwayStart'
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
};

const DEFAULT_FORM: Required<Pick<NotificationSettings,
  'smsEnabled' |
  'smsProvider' |
  'smsSender' |
  'smsUserId' |
  'smsEndpointUrl' |
  'smsTemplateStudyStart' |
  'smsTemplateAwayStart' |
  'smsTemplateStudyEnd' |
  'smsTemplateLateAlert' |
  'lateAlertEnabled' |
  'lateAlertGraceMinutes' |
  'defaultArrivalTime'
>> = {
  smsEnabled: true,
  smsProvider: 'none',
  smsSender: '',
  smsUserId: '',
  smsEndpointUrl: '',
  smsTemplateStudyStart: '[{centerName}] {studentName} 학생 {time} 공부시작. 오늘 학습 흐름 확인 부탁드립니다.',
  smsTemplateAwayStart: '[{centerName}] {studentName} 학생 {time} 외출. 복귀 후 다시 공부를 이어갑니다.',
  smsTemplateStudyEnd: '[{centerName}] {studentName} 학생 {time} 공부종료. 오늘 학습 마무리했습니다.',
  smsTemplateLateAlert: '[{centerName}] {studentName} 학생 {expectedTime} 미등원. 확인 부탁드립니다.',
  lateAlertEnabled: true,
  lateAlertGraceMinutes: 20,
  defaultArrivalTime: '17:00',
};

const SMS_EVENTS: Array<{ value: SmsConsoleEventType; label: string }> = [
  { value: 'study_start', label: '공부시작' },
  { value: 'away_start', label: '외출' },
  { value: 'study_end', label: '공부종료' },
  { value: 'late_alert', label: '지각' },
  { value: 'weekly_report', label: '주간리포트' },
  { value: 'risk_alert', label: '리스크 알림' },
];

const RECIPIENT_EVENT_OPTIONS: Array<{ value: ParentSmsEventType; label: string }> = [
  { value: 'study_start', label: '공부시작' },
  { value: 'away_start', label: '외출' },
  { value: 'study_end', label: '공부종료' },
  { value: 'late_alert', label: '지각' },
  { value: 'weekly_report', label: '주간리포트' },
];

const TEMPLATE_META: Array<{
  key: SmsEventTemplateKey;
  label: string;
  sampleStatus: string;
}> = [
  { key: 'smsTemplateStudyStart', label: '공부 시작 메시지', sampleStatus: '공부시작' },
  { key: 'smsTemplateAwayStart', label: '외출 메시지', sampleStatus: '외출' },
  { key: 'smsTemplateStudyEnd', label: '공부 종료 메시지', sampleStatus: '공부종료' },
  { key: 'smsTemplateLateAlert', label: '지각 알림 메시지', sampleStatus: '미등원' },
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

function maskPhone(value?: string) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 8) return value || '-';
  return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4).replace(/\d/g, '*')}-${digits.slice(-4)}`;
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
    study_end: true,
    late_alert: true,
    weekly_report: true,
  };
}

function mergeEventToggles(toggles?: Partial<Record<ParentSmsEventType, boolean>>) {
  return {
    ...getDefaultEventToggles(),
    ...(toggles || {}),
  };
}

function getQueueStatusLabel(status?: string, providerStatus?: string, nextAttemptAt?: { toDate?: () => Date }, attemptCount?: number) {
  if (status === 'processing') return '처리중';
  if (status === 'failed') return '실패';
  if (status === 'pending_provider') return '설정 대기';
  if (status === 'cancelled') return '취소됨';
  if (status === 'sent') return '발송완료';
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
  if (label === '발송완료') return 'bg-emerald-100 text-emerald-700';
  return 'bg-blue-100 text-blue-700';
}

function getDeliveryStatusLabel(status?: string) {
  if (status === 'suppressed_opt_out') return '수신거부';
  if (status === 'failed') return '실패';
  return '발송완료';
}

export default function NotificationSettingsPage() {
  const firestore = useFirestore();
  const functions = useFunctions();
  const { activeMembership, membershipsLoading, viewMode } = useAppContext();
  const { toast } = useToast();
  const isMobile = viewMode === 'mobile';

  const centerId = activeMembership?.id;
  const isAdmin = isAdminRole(activeMembership?.role);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [smsApiKeyInput, setSmsApiKeyInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [queueSearchTerm, setQueueSearchTerm] = useState('');
  const [recipientSearchTerm, setRecipientSearchTerm] = useState('');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [queueEventFilter, setQueueEventFilter] = useState<'all' | SmsConsoleEventType>('all');
  const [queueStatusFilter, setQueueStatusFilter] = useState<'all' | 'queued' | 'processing' | 'pending_provider' | 'failed' | 'cancelled'>('all');
  const [historyEventFilter, setHistoryEventFilter] = useState<'all' | SmsConsoleEventType>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'sent' | 'failed' | 'suppressed_opt_out'>('all');
  const [historyTab, setHistoryTab] = useState<'by-date' | 'by-student'>('by-date');
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(toDateInputValue(new Date()));
  const [selectedHistoryStudentId, setSelectedHistoryStudentId] = useState<string>('all');
  const [queueActionKey, setQueueActionKey] = useState<string | null>(null);
  const [preferenceActionKey, setPreferenceActionKey] = useState<string | null>(null);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return doc(firestore, 'centers', centerId, 'settings', 'notifications');
  }, [firestore, centerId, isAdmin]);
  const { data: settingsDoc, isLoading } = useDoc<NotificationSettings>(settingsRef, { enabled: isAdmin });

  const smsQueueQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(collection(firestore, 'centers', centerId, 'smsQueue'), orderBy('createdAt', 'desc'), limit(200));
  }, [firestore, centerId, isAdmin]);
  const { data: smsQueueRaw } = useCollection<SmsQueueRow>(smsQueueQuery, { enabled: isAdmin });

  const smsDeliveryLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(collection(firestore, 'centers', centerId, 'smsDeliveryLogs'), orderBy('createdAt', 'desc'), limit(300));
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
      smsTemplateStudyEnd: settingsDoc.smsTemplateStudyEnd || settingsDoc.smsTemplateCheckOut || prev.smsTemplateStudyEnd,
      smsTemplateLateAlert: settingsDoc.smsTemplateLateAlert || prev.smsTemplateLateAlert,
      lateAlertEnabled: settingsDoc.lateAlertEnabled ?? prev.lateAlertEnabled,
      lateAlertGraceMinutes: Number(settingsDoc.lateAlertGraceMinutes ?? prev.lateAlertGraceMinutes),
      defaultArrivalTime: settingsDoc.defaultArrivalTime || prev.defaultArrivalTime,
    }));
  }, [settingsDoc]);

  const sampleValues = useMemo(() => ({
    studentName: '김재윤',
    time: '18:40',
    expectedTime: form.defaultArrivalTime || '17:00',
    centerName: '트랙센터',
  }), [form.defaultArrivalTime]);

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

  const providerReady = useMemo(() => {
    if (!form.smsEnabled) return false;
    if (form.smsProvider === 'none') return false;
    if (!form.smsSender.trim()) return false;
    if (form.smsProvider === 'aligo') {
      return Boolean(settingsDoc?.smsApiKeyConfigured && form.smsUserId.trim());
    }
    return Boolean(settingsDoc?.smsApiKeyConfigured && form.smsEndpointUrl.trim());
  }, [form, settingsDoc]);

  const queueRows = useMemo(() => {
    const keyword = queueSearchTerm.trim().toLowerCase();
    return (smsQueueRaw || []).filter((row) => {
      if (queueEventFilter !== 'all' && row.eventType !== queueEventFilter) return false;
      if (queueStatusFilter !== 'all' && row.status !== queueStatusFilter) return false;
      if (!keyword) return true;
      const haystack = [
        row.studentName,
        row.parentName,
        row.phoneNumber,
        row.to,
        row.renderedMessage || row.message,
      ].join(' ').toLowerCase();
      return haystack.includes(keyword);
    });
  }, [queueEventFilter, queueSearchTerm, queueStatusFilter, smsQueueRaw]);

  const queueSummary = useMemo(() => {
    const now = Date.now();
    const todayKey = toDateInputValue(new Date());
    const rows = smsQueueRaw || [];
    const deliveryLogs = smsDeliveryLogsRaw || [];
    return {
      queued: rows.filter((row) => row.status === 'queued' && (!row.nextAttemptAt?.toDate || row.nextAttemptAt.toDate().getTime() <= now)).length,
      processing: rows.filter((row) => row.status === 'processing').length,
      failed: rows.filter((row) => row.status === 'failed').length,
      retryScheduled: rows.filter((row) => row.status === 'queued' && row.nextAttemptAt?.toDate && row.nextAttemptAt.toDate().getTime() > now && Number(row.attemptCount || 0) > 0).length,
      successToday: deliveryLogs.filter((row) => row.status === 'sent' && toDateKeyFromValue(row.createdAt) === todayKey).length,
      suppressedToday: deliveryLogs.filter((row) => row.status === 'suppressed_opt_out' && toDateKeyFromValue(row.createdAt) === todayKey).length,
    };
  }, [smsDeliveryLogsRaw, smsQueueRaw]);

  const recipientRows = useMemo(() => {
    const keyword = recipientSearchTerm.trim().toLowerCase();
    return (studentsRaw || [])
      .filter((student) => {
        const membership = membersById.get(student.id);
        if (membership?.role === 'student' && membership?.status && membership.status !== 'active') {
          return false;
        }
        return true;
      })
      .map((student) => {
        const parentRows = (student.parentUids || []).map((parentUid) => {
          const member = membersById.get(parentUid);
          const pref = preferencesByKey.get(`${student.id}_${parentUid}`);
          return {
            studentId: student.id,
            studentName: student.name || '학생',
            className: student.className || student.grade || '-',
            parentUid,
            parentName: pref?.parentName || member?.displayName || member?.name || '학부모',
            phoneNumber: pref?.phoneNumber || member?.phoneNumber || '',
            enabled: pref?.enabled !== false,
            eventToggles: mergeEventToggles(pref?.eventToggles),
          } satisfies RecipientPreferenceRow;
        }).filter((row) => row.phoneNumber);

        const fallbackPref = preferencesByKey.get(`${student.id}_${STUDENT_SMS_FALLBACK_UID}`);
        const fallbackMember = membersById.get(student.id);
        const fallbackPhone = fallbackPref?.phoneNumber || fallbackMember?.phoneNumber || '';
        const resolvedRows = parentRows.length > 0
          ? parentRows
          : fallbackPhone
            ? [{
                studentId: student.id,
                studentName: student.name || '학생',
                className: student.className || student.grade || '-',
                parentUid: STUDENT_SMS_FALLBACK_UID,
                parentName: fallbackPref?.parentName || '학생 본인',
                phoneNumber: fallbackPhone,
                enabled: fallbackPref?.enabled !== false,
                eventToggles: mergeEventToggles(fallbackPref?.eventToggles),
              } satisfies RecipientPreferenceRow]
            : [];

        return {
          studentId: student.id,
          studentName: student.name || '학생',
          className: student.className || student.grade || '-',
          parentRows: resolvedRows,
        };
      })
      .filter((student) => student.parentRows.length > 0)
      .filter((student) => {
        if (!keyword) return true;
        const haystack = [
          student.studentName,
          student.className,
          ...student.parentRows.map((row) => `${row.parentName} ${row.phoneNumber}`),
        ].join(' ').toLowerCase();
        return haystack.includes(keyword);
      })
      .sort((a, b) => a.studentName.localeCompare(b.studentName, 'ko-KR'));
  }, [membersById, preferencesByKey, recipientSearchTerm, studentsRaw]);

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
    nextEventToggles: Record<ParentSmsEventType, boolean>
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
      });
      toast({
        title: '수신 설정 저장 완료',
        description: `${row.studentName} 학생의 ${row.parentName} 수신 설정을 업데이트했습니다.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '수신 설정 저장 실패',
        description: error?.message || '수신 제어 저장 중 오류가 발생했습니다.',
      });
    } finally {
      setPreferenceActionKey(null);
    }
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
      <Card className="rounded-[2rem] border-none shadow-xl ring-1 ring-black/[0.04]">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
            <PlugZap className="h-5 w-5" /> 연동 설정
          </CardTitle>
          <CardDescription className="font-bold text-sm">
            키는 마스킹 상태만 노출하고, 현재 제공사 준비 상태와 오늘 발송 가능 여부를 같이 보여줍니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 p-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">현재 제공사</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge className="border-none bg-slate-100 text-slate-700 font-black">
                  {form.smsProvider === 'none' ? '연결 안함' : form.smsProvider === 'aligo' ? '알리고' : '사용자 엔드포인트'}
                </Badge>
                <Badge className={cn('border-none font-black', providerReady ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                  {providerReady ? '발송 가능' : '설정 보완 필요'}
                </Badge>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">문자 전송</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-bold">센터 공통 스위치</span>
                <Switch checked={form.smsEnabled} onCheckedChange={(checked) => updateField('smsEnabled', checked)} />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">연동 키 상태</p>
              <div className="mt-3">
                <Badge className={cn('border-none font-black', settingsDoc?.smsApiKeyConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                  {settingsDoc?.smsApiKeyConfigured ? '등록됨' : '미등록'}
                </Badge>
              </div>
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
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground">연동 주소</Label>
              <Input value={form.smsEndpointUrl} onChange={(e) => updateField('smsEndpointUrl', e.target.value)} placeholder="https://your-sms-gateway.example/send" className="h-11 rounded-xl border-2 font-bold" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground">연동 키</Label>
              <div className="flex gap-2">
                <Input value={smsApiKeyInput} onChange={(e) => setSmsApiKeyInput(e.target.value)} placeholder={settingsDoc?.smsApiKeyConfigured ? '새 키를 입력하면 교체됩니다.' : '연동 키 입력'} className="h-11 rounded-xl border-2 font-bold" />
                {settingsDoc?.smsApiKeyConfigured ? (
                  <Button type="button" variant="outline" className="h-11 rounded-xl font-black text-rose-600" onClick={() => void handleClearApiKey()}>
                    키 해제
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
      </CardContent>
      </Card>
      <Card className="rounded-[2rem] border-none shadow-xl ring-1 ring-black/[0.04]">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle className="text-xl font-black tracking-tight">발송 현황</CardTitle>
          <CardDescription className="font-bold text-sm">
            현재 큐 상태, 재시도 예정, 오늘 성공/수신거부 건수를 함께 보고 바로 조치합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-blue-700">대기</p><p className="mt-2 text-3xl font-black text-blue-800">{queueSummary.queued}</p></div>
            <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-violet-700">처리중</p><p className="mt-2 text-3xl font-black text-violet-800">{queueSummary.processing}</p></div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-rose-700">실패</p><p className="mt-2 text-3xl font-black text-rose-800">{queueSummary.failed}</p></div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">오늘 성공</p><p className="mt-2 text-3xl font-black text-emerald-800">{queueSummary.successToday}</p></div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-amber-700">수신거부</p><p className="mt-2 text-3xl font-black text-amber-800">{queueSummary.suppressedToday}</p></div>
            <div className="rounded-xl border border-orange-100 bg-orange-50/60 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-orange-700">재시도 예정</p><p className="mt-2 text-3xl font-black text-orange-800">{queueSummary.retryScheduled}</p></div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={queueSearchTerm} onChange={(e) => setQueueSearchTerm(e.target.value)} placeholder="학생명, 학부모명, 번호, 문구 검색" className="h-11 rounded-xl border-2 pl-10 font-bold" />
            </div>
            <Select value={queueEventFilter} onValueChange={(value) => setQueueEventFilter(value as typeof queueEventFilter)}>
              <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="이벤트 필터" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 이벤트</SelectItem>
                {SMS_EVENTS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={queueStatusFilter} onValueChange={(value) => setQueueStatusFilter(value as typeof queueStatusFilter)}>
              <SelectTrigger className="h-11 rounded-xl border-2 font-bold"><SelectValue placeholder="상태 필터" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="queued">queued</SelectItem>
                <SelectItem value="processing">processing</SelectItem>
                <SelectItem value="pending_provider">pending_provider</SelectItem>
                <SelectItem value="failed">failed</SelectItem>
                <SelectItem value="cancelled">cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3">
            {queueRows.length === 0 ? (
              <div className="rounded-xl border border-dashed py-10 text-center text-sm font-bold text-muted-foreground">표시할 큐 데이터가 없습니다.</div>
            ) : queueRows.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-slate-900">{row.studentName || '학생'}</p>
                      <Badge className="border-none bg-slate-100 text-slate-700 font-black">{getEventLabel(row.eventType)}</Badge>
                      <Badge className={cn('border-none font-black', getStatusTone(row.status, row.providerStatus, row.nextAttemptAt, row.attemptCount))}>{getQueueStatusLabel(row.status, row.providerStatus, row.nextAttemptAt, row.attemptCount)}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-slate-500">{row.parentName || '수신자'} · {maskPhone(row.phoneNumber || row.to)}</p>
                  </div>
                  <p className="text-[11px] font-bold text-slate-500">{formatDateLabel(row.createdAt)}</p>
                </div>
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-3 text-sm font-bold leading-6 text-slate-800">{row.renderedMessage || row.message || '-'}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge className={cn('border-none font-black', getByteTone(Number(row.messageBytes || calculateSmsBytes(row.renderedMessage || row.message || ''))))}>{Number(row.messageBytes || calculateSmsBytes(row.renderedMessage || row.message || ''))}byte</Badge>
                  <Badge className="border-none bg-slate-100 text-slate-700 font-black">시도 {Number(row.attemptCount || 0)}회</Badge>
                  {Number(row.manualRetryCount || 0) > 0 ? <Badge className="border-none bg-orange-100 text-orange-700 font-black">수동 재시도 {Number(row.manualRetryCount || 0)}회</Badge> : null}
                  {row.nextAttemptAt?.toDate && row.status === 'queued' && (row.providerStatus === 'retry_scheduled' || Number(row.attemptCount || 0) > 0) ? <Badge className="border-none bg-orange-100 text-orange-700 font-black">다음 시도 {formatDateLabel(row.nextAttemptAt)}</Badge> : null}
                </div>
                {(row.failedReason || row.lastErrorMessage) ? <p className="mt-2 text-xs font-bold text-rose-600">실패 사유: {row.failedReason || row.lastErrorMessage}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {['failed', 'pending_provider', 'cancelled'].includes(String(row.status || '')) ? (
                    <Button type="button" variant="outline" className="h-8 rounded-lg px-3 text-xs font-black" disabled={queueActionKey === `retry-${row.id}`} onClick={() => void handleRetryQueue(row.id)}>
                      {queueActionKey === `retry-${row.id}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1 h-3.5 w-3.5" />}재시도
                    </Button>
                  ) : null}
                  {['queued', 'pending_provider', 'failed'].includes(String(row.status || '')) ? (
                    <Button type="button" variant="outline" className="h-8 rounded-lg px-3 text-xs font-black text-rose-600" disabled={queueActionKey === `cancel-${row.id}`} onClick={() => void handleCancelQueue(row.id)}>
                      {queueActionKey === `cancel-${row.id}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1 h-3.5 w-3.5" />}취소
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border-none shadow-xl ring-1 ring-black/[0.04]">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle className="text-xl font-black tracking-tight">수신 관리</CardTitle>
          <CardDescription className="font-bold text-sm">학생별로 보호자 번호를 우선 사용하고, 보호자 번호가 없으면 학생 번호를 대체 수신자로 제어할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={recipientSearchTerm} onChange={(e) => setRecipientSearchTerm(e.target.value)} placeholder="학생명, 반, 수신자명, 번호 검색" className="h-11 rounded-xl border-2 pl-10 font-bold" />
          </div>

          <div className="grid gap-3">
            {recipientRows.length === 0 ? (
              <div className="rounded-xl border border-dashed py-10 text-center text-sm font-bold text-muted-foreground">표시할 문자 수신 대상이 없습니다.</div>
            ) : recipientRows.map((student) => (
              <details key={student.studentId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-base font-black text-slate-900">{student.studentName}</p>
                      <p className="text-xs font-bold text-slate-500">{student.className} · 연결 수신자 {student.parentRows.length}명</p>
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
                            <p className="text-sm font-black text-slate-900">{row.parentName}</p>
                            <p className="text-xs font-bold text-slate-500">{maskPhone(row.phoneNumber)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-500">전체 수신</span>
                            <Switch checked={row.enabled} disabled={preferenceActionKey === actionKey} onCheckedChange={(checked) => void handleUpdateRecipientPreference(row, checked, row.eventToggles)} />
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {RECIPIENT_EVENT_OPTIONS.map((eventItem) => {
                            const enabled = row.eventToggles[eventItem.value] !== false;
                            return (
                              <Button key={eventItem.value} type="button" variant="outline" className={cn('h-8 rounded-full px-3 text-xs font-black', enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500')} disabled={preferenceActionKey === actionKey} onClick={() => void handleUpdateRecipientPreference(row, row.enabled, { ...row.eventToggles, [eventItem.value]: !enabled })}>
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
                사용 가능 변수: <Badge variant="outline" className="mx-1">{'{centerName}'}</Badge>
                <Badge variant="outline" className="mx-1">{'{studentName}'}</Badge>
                <Badge variant="outline" className="mx-1">{'{time}'}</Badge>
                <Badge variant="outline" className="mx-1">{'{expectedTime}'}</Badge>
              </CardDescription>
            </div>
            <Button type="button" variant="outline" className="h-10 rounded-xl font-black" onClick={applyRecommendedTemplates}>
              90byte 내 꽉 채운 추천문구
            </Button>
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
            학생이 정해진 시간보다 {form.lateAlertGraceMinutes}분 이상 늦으면 자동으로 지각 알림을 큐에 넣습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase text-muted-foreground">지각 알림 활성화</Label>
            <div className="flex h-11 items-center justify-between rounded-xl border-2 px-3">
              <span className="text-sm font-bold">자동 체크</span>
              <Switch checked={form.lateAlertEnabled} onCheckedChange={(checked) => updateField('lateAlertEnabled', checked)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase text-muted-foreground">기본 등원 시간</Label>
            <Input type="time" value={form.defaultArrivalTime} onChange={(e) => updateField('defaultArrivalTime', e.target.value)} className="h-11 rounded-xl border-2 font-bold" />
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
                    <p className="mt-1 text-[11px] font-bold text-slate-500">{row.parentName || '학부모'} {row.phoneNumber ? `· ${maskPhone(row.phoneNumber)}` : ''} · {row.provider || 'none'}</p>
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
