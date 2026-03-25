'use client';

import { useEffect, useMemo, useState } from 'react';
import { StudentDashboard } from '@/components/dashboard/student-dashboard';
import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { ParentDashboard } from '@/components/dashboard/parent-dashboard';
import { useUser, useFunctions, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { Loader2, RefreshCw, Compass, Sparkles, Link2, Phone, CalendarClock, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { type StudentProfile } from '@/lib/types';

type ExamCountdownSetting = {
  id: string;
  title: string;
  date: string;
};

const DEFAULT_EXAM_COUNTDOWNS: ExamCountdownSetting[] = [
  { id: 'mock', title: '\uBAA8\uC758\uACE0\uC0AC', date: '' },
  { id: 'school', title: '\uB0B4\uC2E0', date: '' },
];

function normalizeExamCountdowns(input: unknown): ExamCountdownSetting[] {
  if (!Array.isArray(input)) return DEFAULT_EXAM_COUNTDOWNS;
  const normalized = input
    .map((item, index) => {
      const row = item as Partial<ExamCountdownSetting>;
      return {
        id: typeof row.id === 'string' && row.id.length > 0 ? row.id : `exam_${index + 1}`,
        title: typeof row.title === 'string' ? row.title.trim() : '',
        date: typeof row.date === 'string' ? row.date.trim() : '',
      };
    })
    .filter((item) => item.title.length > 0 || item.date.length > 0);

  return normalized.length > 0 ? normalized : DEFAULT_EXAM_COUNTDOWNS;
}

const inviteFormSchema = z.object({
  inviteCode: z.string().trim().min(1, '초대 코드를 입력해 주세요.'),
});

const parentLinkFormSchema = z.object({
  studentLinkCode: z.string().trim().regex(/^\d{6}$/, '학생 코드(6자리 숫자)를 입력해 주세요.'),
  parentPhoneNumber: z.string().trim().optional(),
});

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

function isValidKoreanMobilePhone(raw: string): boolean {
  return /^01\d{8,9}$/.test(raw);
}

function resolveCallableErrorMessage(error: any, fallback: string): string {
  const detailMessageRaw =
    typeof error?.details === 'string'
      ? error.details
      : typeof error?.details?.userMessage === 'string'
        ? error.details.userMessage
        : typeof error?.details?.message === 'string'
          ? error.details.message
          : typeof error?.details?.error === 'string'
            ? error.details.error
            : '';
  const detailMessage = String(detailMessageRaw || '')
    .replace(/^\d+\s+FAILED_PRECONDITION:?\s*/i, '')
    .replace(/^\d+\s+INVALID_ARGUMENT:?\s*/i, '')
    .replace(/^\d+\s+ALREADY_EXISTS:?\s*/i, '')
    .replace(/^\d+\s+INTERNAL:?\s*/i, '')
    .trim();

  const rawMessage = String(error?.message || '').trim();
  const strippedRaw = rawMessage.replace(/^FirebaseError:\s*/i, '').trim();
  const normalizedRaw = strippedRaw
    .replace(/^\d+\s+FAILED_PRECONDITION:?\s*/i, '')
    .replace(/^\d+\s+INVALID_ARGUMENT:?\s*/i, '')
    .replace(/^\d+\s+ALREADY_EXISTS:?\s*/i, '')
    .replace(/^\d+\s+INTERNAL:?\s*/i, '')
    .trim();

  const code = String(error?.code || '').toLowerCase();
  const hasFailedPrecondition = code.includes('failed-precondition') || /failed[_ -]?precondition/i.test(strippedRaw);
  const hasInvalidArgument = code.includes('invalid-argument') || /invalid[_ -]?argument/i.test(strippedRaw);
  const hasAlreadyExists = code.includes('already-exists') || /already[_ -]?exists/i.test(strippedRaw);
  const isInternal = code.includes('internal') || /\b(functions\/internal|internal)\b/i.test(normalizedRaw);

  if (detailMessage) return detailMessage;
  if (!isInternal && normalizedRaw) return normalizedRaw;

  if (hasFailedPrecondition) {
    return '사전 조건이 맞지 않습니다. 입력한 학생 코드 또는 초대 코드를 다시 확인해 주세요.';
  }
  if (hasInvalidArgument) {
    return '입력값이 올바르지 않습니다. 필수 항목을 다시 확인해 주세요.';
  }
  if (hasAlreadyExists) {
    return '이미 연결된 계정입니다. 연동 상태를 다시 확인해 주세요.';
  }

  return fallback;
}

export default function DashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const functions = useFunctions();
  const { activeMembership, membershipsLoading, viewMode } = useAppContext();
  const { toast } = useToast();
  const [isInviteSubmitting, setIsInviteSubmitting] = useState(false);
  const [isParentLinkSubmitting, setIsParentLinkSubmitting] = useState(false);
  const [isExamDialogOpen, setIsExamDialogOpen] = useState(false);
  const [isExamSaving, setIsExamSaving] = useState(false);
  const [examDrafts, setExamDrafts] = useState<ExamCountdownSetting[]>(DEFAULT_EXAM_COUNTDOWNS);
  const isMobile = activeMembership?.role === 'parent' || viewMode === 'mobile';
  const isStudentRole = activeMembership?.role === 'student';

  const studentProfileRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || activeMembership.role !== 'student') return null;
    return doc(firestore, 'centers', activeMembership.id, 'students', user.uid);
  }, [firestore, activeMembership?.id, activeMembership?.role, user?.uid]);
  const { data: studentProfile } = useDoc<StudentProfile>(studentProfileRef, { enabled: isStudentRole });

  const studentGrowthRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || activeMembership.role !== 'student') return null;
    return doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
  }, [firestore, activeMembership?.id, activeMembership?.role, user?.uid]);
  const { data: studentGrowth } = useDoc<any>(studentGrowthRef, { enabled: isStudentRole });

  const examCountdownSource = studentGrowth?.examCountdowns ?? studentProfile?.examCountdowns;

  useEffect(() => {
    setExamDrafts(normalizeExamCountdowns(examCountdownSource));
  }, [examCountdownSource]);

  const examCountdowns = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    return normalizeExamCountdowns(examCountdownSource)
      .map((item) => {
        const parsed = item.date ? new Date(`${item.date}T00:00:00`) : null;
        const targetMs = parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : null;
        if (!targetMs) return { ...item, dLabel: '\uB0A0\uC9DC \uBBF8\uC124\uC815', daysLeft: null as number | null };

        const diffDays = Math.ceil((targetMs - todayMs) / (1000 * 60 * 60 * 24));
        const dLabel = diffDays > 0 ? `D-${diffDays}` : diffDays === 0 ? 'D-Day' : `D+${Math.abs(diffDays)}`;
        return { ...item, dLabel, daysLeft: diffDays };
      })
      .sort((a, b) => {
        const aSort = a.daysLeft === null ? 9999 : Math.abs(a.daysLeft);
        const bSort = b.daysLeft === null ? 9999 : Math.abs(b.daysLeft);
        return aSort - bSort;
      });
  }, [examCountdownSource]);

  const primaryExam = examCountdowns[0];

  const inviteForm = useForm<z.infer<typeof inviteFormSchema>>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { inviteCode: '' },
  });

  const parentLinkForm = useForm<z.infer<typeof parentLinkFormSchema>>({
    resolver: zodResolver(parentLinkFormSchema),
    defaultValues: { studentLinkCode: '', parentPhoneNumber: '' },
  });

  async function onInviteSubmit(values: z.infer<typeof inviteFormSchema>) {
    if (!user || !functions) return;

    setIsInviteSubmitting(true);
    try {
      const redeemFn = httpsCallable(functions, 'redeemInviteCode');
      const result: any = await redeemFn({ code: values.inviteCode.trim() });

      if (result.data?.ok) {
        toast({ title: '가입 완료', description: result.data.message || '센터 가입이 완료되었습니다.' });
        setTimeout(() => window.location.reload(), 250);
      }
    } catch (error: any) {
      const message = resolveCallableErrorMessage(error, '초대 코드 가입 중 오류가 발생했습니다.');
      toast({
        variant: 'destructive',
        title: '가입 실패',
        description: message,
      });
    } finally {
      setIsInviteSubmitting(false);
    }
  }

  async function onParentLinkSubmit(values: z.infer<typeof parentLinkFormSchema>) {
    if (!user || !functions) return;

    const normalizedPhone = normalizePhone(values.parentPhoneNumber || '');
    if (normalizedPhone && !isValidKoreanMobilePhone(normalizedPhone)) {
      parentLinkForm.setError('parentPhoneNumber', {
        message: '휴대폰 번호를 01012345678 형식으로 입력해 주세요.',
      });
      return;
    }

    setIsParentLinkSubmitting(true);
    try {
      const completeSignupFn = httpsCallable(functions, 'completeSignupWithInvite');
      const result: any = await completeSignupFn({
        role: 'parent',
        studentLinkCode: values.studentLinkCode.trim(),
        parentPhoneNumber: normalizedPhone || null,
      });

      if (result.data?.ok) {
        toast({ title: '연동 완료', description: '학부모 계정이 학생과 연결되었습니다.' });
        setTimeout(() => window.location.reload(), 250);
      }
    } catch (error: any) {
      const message = resolveCallableErrorMessage(error, '학생 코드 연동 중 오류가 발생했습니다.');
      const lowered = message.toLowerCase();
      const isPhoneError = lowered.includes('phone') || lowered.includes('\uC804\uD654');
      if (isPhoneError) {
        parentLinkForm.setError('parentPhoneNumber', { message });
      } else {
        parentLinkForm.setError('studentLinkCode', { message });
      }
      toast({
        variant: 'destructive',
        title: '연동 실패',
        description: message,
      });
    } finally {
      setIsParentLinkSubmitting(false);
    }
  }

  const handleAddExamDraft = () => {
    setExamDrafts((prev) => {
      if (prev.length >= 6) return prev;
      return [...prev, { id: `exam_${Date.now()}`, title: '', date: '' }];
    });
  };

  const handleRemoveExamDraft = (id: string) => {
    setExamDrafts((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleExamDraftChange = (id: string, key: 'title' | 'date', value: string) => {
    setExamDrafts((prev) => prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  };

  const handleSaveExamCountdowns = async () => {
    if (!firestore || !activeMembership || !user || activeMembership.role !== 'student') return;

    const payload = examDrafts
      .map((item) => ({
        id: item.id || `exam_${Date.now()}`,
        title: item.title.trim(),
        date: item.date.trim(),
      }))
      .filter((item) => item.title.length > 0 && item.date.length > 0);

    if (!payload.length) {
      toast({
        variant: 'destructive',
        title: '\uC2DC\uD5D8 \uC124\uC815 \uC800\uC7A5 \uC2E4\uD328',
        description: '\uC2DC\uD5D8\uBA85\uACFC \uB0A0\uC9DC\uAC00 \uC785\uB825\uB41C \uD56D\uBAA9\uC744 \uCD5C\uC18C 1\uAC1C \uC774\uC0C1 \uB9CC\uB4E4\uC5B4 \uC8FC\uC138\uC694.',
      });
      return;
    }

    setIsExamSaving(true);
    try {
      await setDoc(doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid), { examCountdowns: payload, updatedAt: serverTimestamp() }, { merge: true });
      setIsExamDialogOpen(false);
      toast({
        title: '\uC2DC\uD5D8 \uB514\uB370\uC774 \uC800\uC7A5 \uC644\uB8CC',
        description: '\uD559\uC0DD \uACC4\uC815\uC5D0 \uC2DC\uD5D8 \uC77C\uC815\uC774 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.',
      });
    } catch (error: any) {
      const detail = String(error?.message || '').replace(/^FirebaseError:\s*/i, '').trim();
      toast({
        variant: 'destructive',
        title: '\uC2DC\uD5D8 \uC124\uC815 \uC800\uC7A5 \uC2E4\uD328',
        description: detail || '\uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.',
      });
    } finally {
      setIsExamSaving(false);
    }
  }; 

  if (membershipsLoading) {
    return (
      <div className="flex h-[70vh] w-full flex-col items-center justify-center gap-6">
        <div className="relative">
          <Loader2 className="absolute inset-0 h-12 w-12 animate-spin text-primary opacity-20" />
          <Compass className="h-12 w-12 animate-pulse text-primary" />
        </div>
        <div className="space-y-2 text-center">
          <p className="text-xl font-black tracking-tighter text-primary">{'\uC13C\uD130 \uC815\uBCF4\uB97C \uD655\uC778\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4'}</p>
          <p className="text-sm font-bold italic text-muted-foreground">{'\uAC00\uC785 \uC9C1\uD6C4\uC5D0\uB294 \uC5F0\uB3D9\uC5D0 \uBA87 \uCD08 \uC815\uB3C4 \uC9C0\uC5F0\uB420 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}</p>
        </div>
      </div>
    );
  }

  if (activeMembership) {
    const userRole = activeMembership.role;

    if (userRole === 'centerAdmin' || userRole === 'owner') {
      return <AdminDashboard isActive={true} />;
    }

    if (userRole === 'teacher') {
      return <TeacherDashboard isActive={true} />;
    }

    return (
      <div className={cn('flex flex-col', isMobile ? 'gap-1' : 'gap-2')}>
        <div className={cn('mb-2 flex flex-wrap items-center gap-2 px-1', isMobile ? 'mt-0' : 'mb-4')}>
          <h1 className={cn('font-black tracking-tighter', isMobile ? 'text-xl' : 'text-4xl')}>
            {userRole === 'parent' ? `${user?.displayName}\uB2D8, \uD559\uBD80\uBAA8` : `${user?.displayName}\uB2D8, \uBC18\uAC00\uC6CC\uC694!`}
          </h1>
          <Badge
            variant="secondary"
            className={cn(
              'shrink-0 whitespace-nowrap rounded-full border-none bg-primary font-black uppercase text-white',
              isMobile ? 'h-5 px-2 text-[9px]' : 'h-7 px-3 text-[11px]',
            )}
          >
            {userRole === 'parent' ? '\uD559\uBD80\uBAA8' : '\uD559\uC0DD'}
          </Badge>

          {userRole === 'student' && (
            <Dialog open={isExamDialogOpen} onOpenChange={setIsExamDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'ml-auto h-auto min-h-10 rounded-xl border-primary/20 bg-white px-3 py-2 text-left shadow-sm',
                    isMobile ? 'w-full justify-between' : 'min-w-[180px] justify-between'
                  )}
                >
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-primary/55">{'\uC2DC\uD5D8 \uB514\uB370\uC774'}</p>
                    <p className="text-sm font-black leading-none text-primary">
                      {primaryExam?.title?.trim() ? primaryExam.title : '\uC124\uC815\uD558\uAE30'}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-white">
                    {primaryExam?.dLabel ?? '\uBBF8\uC124\uC815'}
                  </span>
                </Button>
              </DialogTrigger>
              <DialogContent className={cn('flex max-h-[85vh] w-[94vw] max-w-[94vw] flex-col overflow-hidden rounded-2xl border-slate-200 p-0', isMobile ? '' : 'sm:w-full sm:max-w-lg')}>
                <div className="bg-primary p-5 text-white">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-black tracking-tight">{'\uC2DC\uD5D8 \uB514\uB370\uC774 \uC124\uC815'}</DialogTitle>
                    <DialogDescription className="text-white/80">{'\uC2DC\uD5D8 \uC77C\uC815\uC740 \uD559\uC0DD\uBCC4\uB85C \uB530\uB85C \uC800\uC7A5\uB429\uB2C8\uB2E4.'}</DialogDescription>
                  </DialogHeader>
                </div>
                <div className="space-y-3 overflow-y-auto bg-white p-4 sm:p-5">
                  {examDrafts.map((item, index) => (
                    <div key={item.id} className={cn('grid items-center gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-[1fr_132px_auto]')}>
                      <Input
                        value={item.title}
                        onChange={(e) => handleExamDraftChange(item.id, 'title', e.target.value)}
                        placeholder={`\uC2DC\uD5D8\uBA85 ${index + 1}`}
                        className="h-10 rounded-xl border-primary/15 font-bold"
                      />
                      <Input
                        type="date"
                        value={item.date}
                        onChange={(e) => handleExamDraftChange(item.id, 'date', e.target.value)}
                        className="h-10 rounded-xl border-primary/15 font-bold"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn('h-10 w-10 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700', isMobile ? 'justify-self-end' : '')}
                        onClick={() => handleRemoveExamDraft(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-full rounded-xl border-dashed font-black"
                    onClick={handleAddExamDraft}
                    disabled={examDrafts.length >= 6}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    {'\uC2DC\uD5D8 \uCD94\uAC00'}
                  </Button>
                </div>
                <DialogFooter className="border-t bg-white p-4 sm:p-5">
                  <Button type="button" variant="ghost" className="h-10 rounded-xl font-bold" onClick={() => setIsExamDialogOpen(false)}>
                    {'\uB2EB\uAE30'}
                  </Button>
                  <Button type="button" className="h-10 rounded-xl font-black" onClick={handleSaveExamCountdowns} disabled={isExamSaving}>
                    {isExamSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-1.5 h-4 w-4" />}
                    {'\uC800\uC7A5'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className={cn('flex flex-col', isMobile ? 'gap-4' : 'gap-8')}>
          {userRole === 'student' ? (
            <StudentDashboard isActive={true} />
          ) : (
            <ParentDashboard isActive={true} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center space-y-10 px-4 text-center">
      <div className="space-y-4">
        <div className="mx-auto w-fit rounded-[2.5rem] bg-primary/10 p-6 shadow-inner">
          <Sparkles className="h-12 w-12 animate-bounce text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tighter">{'\uC544\uC9C1 \uC18C\uC18D\uB41C \uC13C\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'}</h1>
          <p className="mx-auto max-w-sm font-bold leading-relaxed text-muted-foreground">
            {'\uAC00\uC785 \uC9C1\uD6C4\uC5D0\uB294 \uC815\uBCF4 \uB3D9\uAE30\uD654\uAC00 \uB2A6\uC5B4\uC9C8 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'}
            <br />
            {'\uB2E4\uC2DC \uD655\uC778\uC744 \uB204\uB974\uAC70\uB098 \uCF54\uB4DC\uB97C \uB2E4\uC2DC \uC785\uB825\uD574 \uC8FC\uC138\uC694.'}
          </p>
        </div>
      </div>

      <div className="grid w-full max-w-xl gap-3 sm:grid-cols-3">
        <Button
          variant="outline"
          size="lg"
          className="h-14 rounded-2xl border-2 text-base font-black shadow-sm"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="mr-2 h-5 w-5" /> {'\uB2E4\uC2DC \uD655\uC778'}
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button size="lg" className="h-14 rounded-2xl text-base font-black shadow-xl">
              {'\uCD08\uB300 \uCF54\uB4DC\uB85C \uAC00\uC785'}
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] border-none p-8 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-3xl font-black tracking-tighter">{'\uCD08\uB300 \uCF54\uB4DC \uC785\uB825'}</DialogTitle>
              <DialogDescription className="pt-2 font-bold">
                {'\uC13C\uD130\uC5D0\uC11C \uBC1B\uC740 \uCD08\uB300 \uCF54\uB4DC\uB85C \uAC00\uC785\uC744 \uC644\uB8CC\uD569\uB2C8\uB2E4.'}
              </DialogDescription>
            </DialogHeader>
            <Form {...inviteForm}>
              <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)} className="space-y-6 pt-4">
                <FormField
                  control={inviteForm.control}
                  name="inviteCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-black uppercase tracking-widest text-primary/70">
                         {'\uCD08\uB300 \uCF54\uB4DC'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={'\uC608: 0313'}
                          {...field}
                          className="h-14 rounded-xl border-2 text-xl font-black tracking-widest"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isInviteSubmitting} className="h-14 w-full rounded-2xl text-lg font-black shadow-lg">
                    {isInviteSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : '\uC13C\uD130 \uAC00\uC785 \uC644\uB8CC'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button size="lg" variant="secondary" className="h-14 rounded-2xl text-base font-black shadow-xl">
              <Link2 className="mr-2 h-5 w-5" /> 학부모 코드 연동
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] border-none p-8 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-3xl font-black tracking-tighter">학부모 자녀코드 연동</DialogTitle>
              <DialogDescription className="pt-2 font-bold">
                학생 계정의 6자리 코드를 입력하면 학부모 계정과 즉시 연결됩니다.
              </DialogDescription>
            </DialogHeader>
            <Form {...parentLinkForm}>
              <form onSubmit={parentLinkForm.handleSubmit(onParentLinkSubmit)} className="space-y-6 pt-4">
                <FormField
                  control={parentLinkForm.control}
                  name="studentLinkCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-black uppercase tracking-widest text-primary/70">
                        학생 코드(6자리)
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123456"
                          maxLength={6}
                          {...field}
                          className="h-14 rounded-xl border-2 text-center text-xl font-black tracking-[0.4em]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={parentLinkForm.control}
                  name="parentPhoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-black uppercase tracking-widest text-primary/70">
                        학부모 전화번호 (선택)
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/40" />
                          <Input
                            placeholder="01012345678"
                            maxLength={11}
                            {...field}
                            className="h-14 rounded-xl border-2 pl-11 text-base font-black"
                          />
                        </div>
                      </FormControl>
                      <p className="text-[10px] font-bold text-muted-foreground">
                        최초 연동 계정이면 필수이며, 기존 연동 계정은 비워도 됩니다.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={isParentLinkSubmitting} className="h-14 w-full rounded-2xl text-lg font-black shadow-lg">
                    {isParentLinkSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : '학생과 연동하기'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

