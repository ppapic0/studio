'use client';

import { useEffect, useMemo, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, deleteField, doc, limit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
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

import { useCollection, useDoc, useFirestore, useFunctions, useMemoFirebase, useUser } from '@/firebase';
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

const SMS_BYTE_LIMIT = 90;

type SmsEventTemplateKey =
  | 'smsTemplateStudyStart'
  | 'smsTemplateAwayStart'
  | 'smsTemplateStudyEnd'
  | 'smsTemplateLateAlert';

type SmsQueueRow = {
  id: string;
  studentId?: string;
  studentName?: string;
  parentName?: string;
  to?: string;
  eventType?: string;
  status?: string;
  providerStatus?: string;
  renderedMessage?: string;
  message?: string;
  messageBytes?: number;
  failedReason?: string;
  createdAt?: { toDate?: () => Date };
  updatedAt?: { toDate?: () => Date };
};

type SmsLogRow = {
  id: string;
  studentId?: string;
  eventType?: string;
  provider?: string;
  recipientCount?: number;
  renderedMessage?: string;
  message?: string;
  messageBytes?: number;
  dedupeKey?: string;
  createdAt?: { toDate?: () => Date };
  updatedAt?: { toDate?: () => Date };
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
  switch (eventType) {
    case 'study_start':
    case 'check_in':
      return '공부시작';
    case 'away_start':
      return '외출';
    case 'study_end':
    case 'check_out':
      return '공부종료';
    case 'late_alert':
      return '지각';
    default:
      return eventType || '기타';
  }
}

export default function NotificationSettingsPage() {
  const { user } = useUser();
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
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilter, setEventFilter] = useState<'all' | 'study_start' | 'away_start' | 'study_end' | 'late_alert'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'queued' | 'pending_provider' | 'failed' | 'cancelled'>('all');

  const settingsRef = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return doc(firestore, 'centers', centerId, 'settings', 'notifications');
  }, [firestore, centerId, isAdmin]);
  const { data: settingsDoc, isLoading } = useDoc<NotificationSettings>(settingsRef, { enabled: isAdmin });

  const smsQueueQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(collection(firestore, 'centers', centerId, 'smsQueue'), orderBy('createdAt', 'desc'), limit(80));
  }, [firestore, centerId, isAdmin]);
  const { data: smsQueueRaw } = useCollection<SmsQueueRow>(smsQueueQuery, { enabled: isAdmin });

  const smsLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return query(collection(firestore, 'centers', centerId, 'smsLogs'), orderBy('createdAt', 'desc'), limit(80));
  }, [firestore, centerId, isAdmin]);
  const { data: smsLogsRaw } = useCollection<SmsLogRow>(smsLogsQuery, { enabled: isAdmin });

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
      return {
        ...item,
        rendered,
        bytes,
      };
    });
  }, [form, sampleValues]);

  const queueRows = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return (smsQueueRaw || []).filter((row) => {
      if (eventFilter !== 'all' && row.eventType !== eventFilter) return false;
      const normalizedStatus = String(row.status || row.providerStatus || '');
      if (statusFilter !== 'all' && normalizedStatus !== statusFilter) return false;
      if (!keyword) return true;
      const haystack = [
        row.studentName,
        row.parentName,
        row.to,
        row.renderedMessage || row.message,
      ].join(' ').toLowerCase();
      return haystack.includes(keyword);
    });
  }, [eventFilter, searchTerm, smsQueueRaw, statusFilter]);

  const logRows = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return (smsLogsRaw || []).filter((row) => {
      if (eventFilter !== 'all' && row.eventType !== eventFilter) return false;
      if (!keyword) return true;
      const haystack = [
        row.studentId,
        row.renderedMessage || row.message,
        row.provider,
      ].join(' ').toLowerCase();
      return haystack.includes(keyword);
    });
  }, [eventFilter, searchTerm, smsLogsRaw]);

  const queueSummary = useMemo(() => ({
    queued: (smsQueueRaw || []).filter((row) => row.status === 'queued').length,
    pendingProvider: (smsQueueRaw || []).filter((row) => row.status === 'pending_provider').length,
    failed: (smsQueueRaw || []).filter((row) => row.status === 'failed').length,
  }), [smsQueueRaw]);

  const logSummary = useMemo(() => {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayRows = (smsLogsRaw || []).filter((row) => {
      const created = row.createdAt?.toDate?.();
      if (!created) return false;
      const createdKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;
      return createdKey === todayKey;
    });
    return {
      sentToday: todayRows.length,
      recipientsToday: todayRows.reduce((sum, row) => sum + Number(row.recipientCount || 0), 0),
    };
  }, [smsLogsRaw]);

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
      await saveNotificationSettings({
        centerId,
        ...form,
        smsApiKey: smsApiKeyInput.trim(),
      });

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
      await saveNotificationSettings({
        centerId,
        clearSmsApiKey: true,
      });
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

  const handleRetryQueue = async (rowId: string) => {
    if (!firestore || !centerId) return;
    await updateDoc(doc(firestore, 'centers', centerId, 'smsQueue', rowId), {
      status: form.smsProvider === 'none' ? 'pending_provider' : 'queued',
      providerStatus: form.smsProvider === 'none' ? 'pending_provider' : 'queued',
      failedReason: deleteField(),
      updatedAt: serverTimestamp(),
    });
  };

  const handleCancelQueue = async (rowId: string) => {
    if (!firestore || !centerId) return;
    await updateDoc(doc(firestore, 'centers', centerId, 'smsQueue', rowId), {
      status: 'cancelled',
      providerStatus: 'cancelled',
      updatedAt: serverTimestamp(),
    });
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
    <div className={cn('mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-24', isMobile ? 'pt-1' : 'pt-4')}>
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-3xl font-black tracking-tighter text-primary">
          <BellRing className="h-7 w-7" /> 문자 알림 설정
        </h1>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground/60">
          90byte 최적화 · 센터관리자 발송 콘솔
        </p>
      </header>

      <Card className="rounded-[2rem] border-none shadow-xl ring-1 ring-black/[0.04]">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
            <PlugZap className="h-5 w-5" /> 문자 연동 설정
          </CardTitle>
          <CardDescription className="font-bold text-sm">
            API 키는 화면에 다시 노출하지 않고, 템플릿은 90byte 이하로만 저장합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 p-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
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
              <Label className="text-[11px] font-black uppercase text-muted-foreground">문자 활성화</Label>
              <div className="flex h-11 items-center justify-between rounded-xl border-2 px-3">
                <span className="text-sm font-bold">문자 전송</span>
                <Switch checked={form.smsEnabled} onCheckedChange={(checked) => updateField('smsEnabled', checked)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground">키 상태</Label>
              <div className="flex h-11 items-center rounded-xl border-2 px-3">
                <Badge className={cn('border-none font-black', settingsDoc?.smsApiKeyConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                  {settingsDoc?.smsApiKeyConfigured ? '등록됨' : '미등록'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground">발신번호</Label>
              <Input value={form.smsSender} onChange={(e) => updateField('smsSender', e.target.value)} placeholder="01012345678" className="h-11 rounded-xl border-2 font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground">연동 사용자 아이디</Label>
              <Input value={form.smsUserId} onChange={(e) => updateField('smsUserId', e.target.value)} placeholder="발신 계정 아이디" className="h-11 rounded-xl border-2 font-bold" />
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
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground">연동 주소</Label>
              <Input value={form.smsEndpointUrl} onChange={(e) => updateField('smsEndpointUrl', e.target.value)} placeholder="https://your-sms-gateway.example/send" className="h-11 rounded-xl border-2 font-bold" />
            </div>
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
        <CardContent className="grid gap-4 p-6">
          {TEMPLATE_META.map((item) => {
            const preview = templatePreviews.find((row) => row.key === item.key)!;
            return (
              <div key={item.key} className="rounded-[1.5rem] border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-[11px] font-black uppercase text-muted-foreground">{item.label}</Label>
                  <div className="flex items-center gap-2">
                    <Badge className={cn('border-none font-black', getByteTone(preview.bytes))}>
                      {preview.bytes}byte
                    </Badge>
                    <Badge className={cn('border-none font-black', getByteTone(preview.bytes))}>
                      {getByteLabel(preview.bytes)}
                    </Badge>
                  </div>
                </div>
                <Input
                  value={form[item.key]}
                  onChange={(e) => updateField(item.key, e.target.value)}
                  className="mt-3 h-11 rounded-xl border-2 bg-white font-bold"
                />
                <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">미리보기</p>
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
          <CardTitle className="text-xl font-black tracking-tight">문자 운영 콘솔</CardTitle>
          <CardDescription className="font-bold text-sm">
            발송 대기, 실패, 실제 로그를 한 화면에서 확인하고 관리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">대기중</p>
              <p className="mt-2 text-3xl font-black text-blue-800">{queueSummary.queued}</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">보류/미설정</p>
              <p className="mt-2 text-3xl font-black text-amber-800">{queueSummary.pendingProvider}</p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">실패</p>
              <p className="mt-2 text-3xl font-black text-rose-800">{queueSummary.failed}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">오늘 발송 로그</p>
              <p className="mt-2 text-3xl font-black text-emerald-800">{logSummary.sentToday}</p>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">오늘 수신 건수</p>
              <p className="mt-2 text-3xl font-black text-violet-800">{logSummary.recipientsToday}</p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr_1fr]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="학생명, 학부모명, 문구 검색" className="h-11 rounded-xl border-2 pl-10 font-bold" />
            </div>
            <Select value={eventFilter} onValueChange={(value) => setEventFilter(value as typeof eventFilter)}>
              <SelectTrigger className="h-11 rounded-xl border-2 font-bold">
                <SelectValue placeholder="이벤트 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 이벤트</SelectItem>
                <SelectItem value="study_start">공부시작</SelectItem>
                <SelectItem value="away_start">외출</SelectItem>
                <SelectItem value="study_end">공부종료</SelectItem>
                <SelectItem value="late_alert">지각</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="h-11 rounded-xl border-2 font-bold">
                <SelectValue placeholder="상태 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="queued">queued</SelectItem>
                <SelectItem value="pending_provider">pending_provider</SelectItem>
                <SelectItem value="failed">failed</SelectItem>
                <SelectItem value="cancelled">cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black tracking-tight text-slate-900">발송 대기 / 실패</h3>
                <Badge className="border-none bg-slate-100 text-slate-700 font-black">{queueRows.length}건</Badge>
              </div>
              <div className="grid gap-3">
                {queueRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed py-10 text-center text-sm font-bold text-muted-foreground">
                    표시할 큐 데이터가 없습니다.
                  </div>
                ) : queueRows.map((row) => (
                  <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-black text-slate-900">{row.studentName || '학생'}</p>
                          <Badge className="border-none bg-slate-100 text-slate-700 font-black">{getEventLabel(row.eventType)}</Badge>
                          <Badge className={cn('border-none font-black', row.status === 'failed' ? 'bg-rose-100 text-rose-700' : row.status === 'pending_provider' ? 'bg-amber-100 text-amber-700' : row.status === 'cancelled' ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700')}>
                            {row.status || row.providerStatus || 'queued'}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[11px] font-bold text-slate-500">
                          {row.parentName || '학부모'} · {maskPhone(row.to)}
                        </p>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500">{formatDateLabel(row.createdAt)}</p>
                    </div>
                    <p className="mt-3 rounded-lg bg-slate-50 px-3 py-3 text-sm font-bold leading-6 text-slate-800">
                      {row.renderedMessage || row.message || '-'}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <Badge className={cn('border-none font-black', getByteTone(Number(row.messageBytes || calculateSmsBytes(row.renderedMessage || row.message || ''))))}>
                        {Number(row.messageBytes || calculateSmsBytes(row.renderedMessage || row.message || ''))}byte
                      </Badge>
                      <div className="flex gap-2">
                        {(row.status === 'failed' || row.status === 'pending_provider') && (
                          <Button type="button" variant="outline" className="h-8 rounded-lg px-3 text-xs font-black" onClick={() => void handleRetryQueue(row.id)}>
                            <RefreshCcw className="mr-1 h-3.5 w-3.5" /> 재시도
                          </Button>
                        )}
                        {row.status !== 'cancelled' && (
                          <Button type="button" variant="outline" className="h-8 rounded-lg px-3 text-xs font-black text-rose-600" onClick={() => void handleCancelQueue(row.id)}>
                            <XCircle className="mr-1 h-3.5 w-3.5" /> 취소
                          </Button>
                        )}
                      </div>
                    </div>
                    {row.failedReason ? (
                      <p className="mt-2 text-xs font-bold text-rose-600">실패 사유: {row.failedReason}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black tracking-tight text-slate-900">발송 로그</h3>
                <Badge className="border-none bg-slate-100 text-slate-700 font-black">{logRows.length}건</Badge>
              </div>
              <div className="grid gap-3">
                {logRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed py-10 text-center text-sm font-bold text-muted-foreground">
                    표시할 로그가 없습니다.
                  </div>
                ) : logRows.map((row) => (
                  <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border-none bg-violet-100 text-violet-700 font-black">{getEventLabel(row.eventType)}</Badge>
                        <Badge className="border-none bg-slate-100 text-slate-700 font-black">{row.provider || 'none'}</Badge>
                        <Badge className={cn('border-none font-black', getByteTone(Number(row.messageBytes || calculateSmsBytes(row.renderedMessage || row.message || ''))))}>
                          {Number(row.messageBytes || calculateSmsBytes(row.renderedMessage || row.message || ''))}byte
                        </Badge>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500">{formatDateLabel(row.createdAt)}</p>
                    </div>
                    <p className="mt-3 rounded-lg bg-slate-50 px-3 py-3 text-sm font-bold leading-6 text-slate-800">
                      {row.renderedMessage || row.message || '-'}
                    </p>
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      수신 {row.recipientCount || 0}건 · 학생ID {row.studentId || '-'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
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
