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
  { id: 'mock', title: '모의고사', date: '' },
  { id: 'school', title: '내신', date: '' },
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
    return '가입 조건을 만족하지 못했습니다. 입력한 학생 코드 또는 초대 코드를 다시 확인해 주세요.';
  }
  if (hasInvalidArgument) {
    return '입력값이 올바르지 않습니다. 필수 항목을 다시 확인해 주세요.';
  }
  if (hasAlreadyExists) {
    return '이미 연결된 계정입니다. 잠시 후 다시 확인해 주세요.';
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
  }, [firestore, activeMembership, user]);
  const { data: studentProfile } = useDoc<StudentProfile>(studentProfileRef, { enabled: isStudentRole });

  useEffect(() => {
    setExamDrafts(normalizeExamCountdowns(studentProfile?.examCountdowns));
  }, [studentProfile?.examCountdowns]);

  const examCountdowns = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    return normalizeExamCountdowns(studentProfile?.examCountdowns)
      .map((item) => {
        const parsed = item.date ? new Date(`${item.date}T00:00:00`) : null;
        const targetMs = parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : null;
        if (!targetMs) return { ...item, dLabel: '날짜 미설정', daysLeft: null as number | null };

        const diffDays = Math.ceil((targetMs - todayMs) / (1000 * 60 * 60 * 24));
        const dLabel = diffDays > 0 ? `D-${diffDays}` : diffDays === 0 ? 'D-Day' : `D+${Math.abs(diffDays)}`;
        return { ...item, dLabel, daysLeft: diffDays };
      })
      .sort((a, b) => {
        const aSort = a.daysLeft === null ? 9999 : Math.abs(a.daysLeft);
        const bSort = b.daysLeft === null ? 9999 : Math.abs(b.daysLeft);
        return aSort - bSort;
      });
  }, [studentProfile?.examCountdowns]);

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
      if (/phone|전화|휴대폰/.test(lowered)) {
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
      .filter((item) => item.title.length > 0 || item.date.length > 0);

    if (!payload.length) {
      toast({
        variant: 'destructive',
        title: '시험 설정 저장 실패',
        description: '최소 1개 시험명 또는 날짜를 입력해 주세요.',
      });
      return;
    }

    setIsExamSaving(true);
    try {
      await setDoc(
        doc(firestore, 'centers', activeMembership.id, 'students', user.uid),
        { examCountdowns: payload, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setIsExamDialogOpen(false);
      toast({ title: '시험 디데이 설정 완료' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '시험 설정 저장 실패',
        description: '잠시 후 다시 시도해 주세요.',
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
          <p className="text-xl font-black tracking-tighter text-primary">센터 정보를 확인하고 있습니다</p>
          <p className="text-sm font-bold italic text-muted-foreground">가입 직후에는 연동이 몇 초 정도 지연될 수 있습니다.</p>
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
            {userRole === 'parent' ? `${user?.displayName} 학부모님` : `${user?.displayName}님, 반가워요!`}
          </h1>
          <Badge
            variant="secondary"
            className={cn(
              'shrink-0 whitespace-nowrap rounded-full border-none bg-primary font-black uppercase text-white',
              isMobile ? 'h-5 px-2 text-[9px]' : 'h-7 px-3 text-[11px]',
            )}
          >
            {userRole === 'parent' ? '학부모' : '학생'}
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
                    <p className="text-[10px] font-black uppercase tracking-wider text-primary/55">시험 디데이</p>
                    <p className="text-sm font-black leading-none text-primary">
                      {primaryExam?.title?.trim() ? primaryExam.title : '설정하기'}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-white">
                    {primaryExam?.dLabel ?? '미설정'}
                  </span>
                </Button>
              </DialogTrigger>
              <DialogContent className={cn('overflow-hidden rounded-2xl border-slate-200 p-0', isMobile ? 'max-w-[94vw]' : 'sm:max-w-lg')}>
                <div className="bg-primary p-5 text-white">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-black tracking-tight">시험 디데이 설정</DialogTitle>
                    <DialogDescription className="text-white/80">시험 일정은 학생별로 따로 저장돼요.</DialogDescription>
                  </DialogHeader>
                </div>
                <div className="space-y-3 bg-white p-4 sm:p-5">
                  {examDrafts.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-[1fr_132px_auto] items-center gap-2">
                      <Input
                        value={item.title}
                        onChange={(e) => handleExamDraftChange(item.id, 'title', e.target.value)}
                        placeholder={`시험명 ${index + 1}`}
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
                        className="h-10 w-10 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700"
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
                    시험 추가
                  </Button>
                </div>
                <DialogFooter className="border-t bg-white p-4 sm:p-5">
                  <Button type="button" variant="ghost" className="h-10 rounded-xl font-bold" onClick={() => setIsExamDialogOpen(false)}>
                    닫기
                  </Button>
                  <Button type="button" className="h-10 rounded-xl font-black" onClick={handleSaveExamCountdowns} disabled={isExamSaving}>
                    {isExamSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-1.5 h-4 w-4" />}
                    저장
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className={cn('flex flex-col', isMobile ? 'gap-4' : 'gap-8')}>
          <StudentDashboard isActive={userRole === 'student'} />
          <ParentDashboard isActive={userRole === 'parent'} />
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
          <h1 className="text-4xl font-black tracking-tighter">아직 소속된 센터가 없습니다</h1>
          <p className="mx-auto max-w-sm font-bold leading-relaxed text-muted-foreground">
            가입 직후에는 정보 동기화가 늦어질 수 있습니다.
            <br />
            다시 확인을 누르거나 코드를 다시 입력해 주세요.
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
          <RefreshCw className="mr-2 h-5 w-5" /> 다시 확인
        </Button>

        <Dialog>
          <DialogTrigger asChild>
            <Button size="lg" className="h-14 rounded-2xl text-base font-black shadow-xl">
              초대 코드로 가입
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[2.5rem] border-none p-8 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-3xl font-black tracking-tighter">초대 코드 입력</DialogTitle>
              <DialogDescription className="pt-2 font-bold">
                센터에서 받은 초대 코드로 가입을 완료합니다.
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
                        초대 코드
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="예: 0313"
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
                    {isInviteSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : '센터 가입 완료'}
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
                학생이 설정한 6자리 코드를 입력하면 학부모 계정이 즉시 연결됩니다.
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
