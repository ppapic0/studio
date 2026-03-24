'use client';

import { useEffect, useState } from 'react';
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
import { Loader2, MessageSquare, Save, BellRing, Clock3, PlugZap } from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useToast } from '@/hooks/use-toast';
import type { NotificationSettings } from '@/lib/types';
import { cn } from '@/lib/utils';
import { isAdminRole } from '@/lib/dashboard-access';

const DEFAULT_FORM: Required<Pick<NotificationSettings,
  'smsEnabled' |
  'smsProvider' |
  'smsSender' |
  'smsApiKey' |
  'smsUserId' |
  'smsEndpointUrl' |
  'smsTemplateCheckIn' |
  'smsTemplateCheckOut' |
  'smsTemplateLateAlert' |
  'lateAlertEnabled' |
  'lateAlertGraceMinutes' |
  'defaultArrivalTime'
>> = {
  smsEnabled: true,
  smsProvider: 'none',
  smsSender: '',
  smsApiKey: '',
  smsUserId: '',
  smsEndpointUrl: '',
  smsTemplateCheckIn: '{studentName}학생이 {time}에 등원했습니다.',
  smsTemplateCheckOut: '{studentName}학생이 {time}에 하원했습니다.',
  smsTemplateLateAlert: '{studentName}학생이 {expectedTime}까지 등원하지 않았습니다.',
  lateAlertEnabled: true,
  lateAlertGraceMinutes: 20,
  defaultArrivalTime: '17:00',
};

export default function NotificationSettingsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, membershipsLoading, viewMode } = useAppContext();
  const { toast } = useToast();
  const isMobile = viewMode === 'mobile';

  const centerId = activeMembership?.id;
  const isAdmin = isAdminRole(activeMembership?.role);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const settingsRef = useMemoFirebase(() => {
    if (!firestore || !centerId || !isAdmin) return null;
    return doc(firestore, 'centers', centerId, 'settings', 'notifications');
  }, [firestore, centerId, isAdmin]);
  const { data: settingsDoc, isLoading } = useDoc<NotificationSettings>(settingsRef, { enabled: isAdmin });

  useEffect(() => {
    if (!settingsDoc) return;
    setForm((prev) => ({
      ...prev,
      ...settingsDoc,
      smsProvider: (settingsDoc.smsProvider || prev.smsProvider) as 'none' | 'aligo' | 'custom',
      lateAlertGraceMinutes: Number(settingsDoc.lateAlertGraceMinutes ?? prev.lateAlertGraceMinutes),
      defaultArrivalTime: settingsDoc.defaultArrivalTime || prev.defaultArrivalTime,
      smsTemplateCheckIn: settingsDoc.smsTemplateCheckIn || prev.smsTemplateCheckIn,
      smsTemplateCheckOut: settingsDoc.smsTemplateCheckOut || prev.smsTemplateCheckOut,
      smsTemplateLateAlert: settingsDoc.smsTemplateLateAlert || prev.smsTemplateLateAlert,
    }));
  }, [settingsDoc]);

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!firestore || !centerId || !isAdmin || !settingsRef) return;
    setIsSaving(true);
    try {
      await setDoc(settingsRef, {
        ...form,
        lateAlertGraceMinutes: Number.isFinite(Number(form.lateAlertGraceMinutes))
          ? Math.max(0, Number(form.lateAlertGraceMinutes))
          : 20,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || null,
      }, { merge: true });

      toast({
        title: '알림 설정 저장 완료',
        description: '문자/SMS 설정이 저장되었습니다.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '저장 실패',
        description: error?.message || '설정 저장 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSaving(false);
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
    <div className={cn('mx-auto flex w-full max-w-5xl flex-col gap-6 pb-24 px-4', isMobile ? 'pt-1' : 'pt-4')}>
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-3xl font-black tracking-tighter text-primary">
          <BellRing className="h-7 w-7" /> 문자 알림 설정
        </h1>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground/60">
          학부모 문자 연동 및 지각 알림 규칙
        </p>
      </header>

      <Card className="rounded-[2rem] border-none shadow-xl ring-1 ring-black/[0.04]">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
            <PlugZap className="h-5 w-5" /> 문자 연동 설정
          </CardTitle>
          <CardDescription className="font-bold text-sm">
            문자 연동은 나중에 연결해도 됩니다. 지금은 키와 주소를 저장해두고, 큐(centers/{"{centerId}"}/smsQueue)를 통해 연동할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground whitespace-nowrap">연동 방식</Label>
              <Select value={form.smsProvider} onValueChange={(value) => updateField('smsProvider', value as 'none' | 'aligo' | 'custom')}>
                <SelectTrigger className="h-11 rounded-xl border-2 font-bold">
                  <SelectValue placeholder="SMS 제공사 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="font-bold">연결 안함(준비중)</SelectItem>
                  <SelectItem value="aligo" className="font-bold">알리고</SelectItem>
                  <SelectItem value="custom" className="font-bold">사용자 엔드포인트</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground">알림 활성화</Label>
              <div className="flex h-11 items-center justify-between rounded-xl border-2 px-3">
                <span className="text-sm font-bold">문자 전송</span>
                <Switch checked={form.smsEnabled} onCheckedChange={(checked) => updateField('smsEnabled', checked)} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground">발신번호</Label>
              <Input
                value={form.smsSender}
                onChange={(e) => updateField('smsSender', e.target.value)}
                placeholder="01012345678"
                className="h-11 rounded-xl border-2 font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground whitespace-nowrap">연동 사용자 아이디</Label>
              <Input
                value={form.smsUserId}
                onChange={(e) => updateField('smsUserId', e.target.value)}
                placeholder="발신 계정 아이디"
                className="h-11 rounded-xl border-2 font-bold"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground whitespace-nowrap">연동 키</Label>
              <Input
                value={form.smsApiKey}
                onChange={(e) => updateField('smsApiKey', e.target.value)}
                placeholder="연동 키"
                className="h-11 rounded-xl border-2 font-bold"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground whitespace-nowrap">연동 주소</Label>
              <Input
                value={form.smsEndpointUrl}
                onChange={(e) => updateField('smsEndpointUrl', e.target.value)}
                placeholder="https://your-sms-gateway.example/send"
                className="h-11 rounded-xl border-2 font-bold"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[2rem] border-none shadow-xl ring-1 ring-black/[0.04]">
        <CardHeader className="border-b bg-muted/10">
          <CardTitle className="flex items-center gap-2 text-xl font-black tracking-tight">
            <MessageSquare className="h-5 w-5" /> 문자 템플릿
          </CardTitle>
          <CardDescription className="font-bold text-sm">
            사용 가능한 변수: <Badge variant="outline" className="mx-1">{'{studentName}'}</Badge>
            <Badge variant="outline" className="mx-1">{'{time}'}</Badge>
            <Badge variant="outline" className="mx-1">{'{expectedTime}'}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-6">
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase text-muted-foreground">등원 메시지</Label>
            <Input value={form.smsTemplateCheckIn} onChange={(e) => updateField('smsTemplateCheckIn', e.target.value)} className="h-11 rounded-xl border-2 font-bold" />
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase text-muted-foreground">하원 메시지</Label>
            <Input value={form.smsTemplateCheckOut} onChange={(e) => updateField('smsTemplateCheckOut', e.target.value)} className="h-11 rounded-xl border-2 font-bold" />
          </div>
          <div className="space-y-2">
            <Label className="text-[11px] font-black uppercase text-muted-foreground">지각 알림 메시지</Label>
            <Input value={form.smsTemplateLateAlert} onChange={(e) => updateField('smsTemplateLateAlert', e.target.value)} className="h-11 rounded-xl border-2 font-bold" />
          </div>
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
            <Input
              type="number"
              min={0}
              value={form.lateAlertGraceMinutes}
              onChange={(e) => updateField('lateAlertGraceMinutes', Number(e.target.value || 20))}
              className="h-11 rounded-xl border-2 font-bold"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving || isLoading} className="h-14 rounded-2xl text-lg font-black shadow-xl gap-2">
        {(isSaving || isLoading) ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
        설정 저장
      </Button>
    </div>
  );
}
