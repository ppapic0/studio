'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StudentDashboard } from '@/components/dashboard/student-dashboard';
import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { ParentDashboard } from '@/components/dashboard/parent-dashboard';
import { RoutineOnboardingFlow } from '@/components/dashboard/student-planner/routine-onboarding-flow';
import { useUser, useFunctions, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { Loader2, RefreshCw, Compass, Sparkles, Link2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { type StudentProfile, type User as UserType, type UserStudyProfile } from '@/lib/types';

const inviteFormSchema = z.object({
  inviteCode: z.string().trim().min(1, '초대 코드를 입력해 주세요.'),
});

const parentLinkFormSchema = z.object({
  studentLinkCode: z.string().trim().regex(/^\d{6}$/, '학생 코드(6자리 숫자)를 입력해 주세요.'),
  parentPhoneNumber: z.string().trim().optional(),
});

const PLAN_TRACK_ONBOARDING_VERSION = 1;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => entry !== undefined)
      .map((entry) => stripUndefinedDeep(entry)) as T;
  }

  if (isPlainObject(value)) {
    const nextEntries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([entryKey, entryValue]) => [entryKey, stripUndefinedDeep(entryValue)]);

    return Object.fromEntries(nextEntries) as T;
  }

  return value;
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

function extractPhoneNumber(source: unknown): string {
  if (!source || typeof source !== 'object') return '';
  const candidate = (source as { phoneNumber?: unknown }).phoneNumber;
  return typeof candidate === 'string' ? candidate : '';
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
  const [isPhoneCaptureOpen, setIsPhoneCaptureOpen] = useState(false);
  const [phoneCaptureValue, setPhoneCaptureValue] = useState('');
  const [isPhoneCaptureSaving, setIsPhoneCaptureSaving] = useState(false);
  const [savedPhoneFallback, setSavedPhoneFallback] = useState('');
  const [hasFinishedStudentOnboarding, setHasFinishedStudentOnboarding] = useState(false);
  const studentOnboardingPresentationRef = useRef(false);
  const isMobile = activeMembership?.role === 'parent' || viewMode === 'mobile';
  const isStudentRole = activeMembership?.role === 'student';
  const isParentRole = activeMembership?.role === 'parent';

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<UserType>(userProfileRef, { enabled: Boolean(user) });

  const studentProfileRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || activeMembership.role !== 'student') return null;
    return doc(firestore, 'centers', activeMembership.id, 'students', user.uid);
  }, [firestore, activeMembership, user]);
  const { data: studentProfile, isLoading: isStudentProfileLoading } = useDoc<StudentProfile>(studentProfileRef, { enabled: isStudentRole });

  const inviteForm = useForm<z.infer<typeof inviteFormSchema>>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { inviteCode: '' },
  });

  const parentLinkForm = useForm<z.infer<typeof parentLinkFormSchema>>({
    resolver: zodResolver(parentLinkFormSchema),
    defaultValues: { studentLinkCode: '', parentPhoneNumber: '' },
  });

  const resolvedSelfPhone = useMemo(() => {
    if (!activeMembership) return '';
    const studentPhone = extractPhoneNumber(studentProfile);
    if (activeMembership.role === 'student') {
      return normalizePhone(studentPhone || userProfile?.phoneNumber || activeMembership.phoneNumber || '');
    }
    if (activeMembership.role === 'parent') {
      return normalizePhone(userProfile?.phoneNumber || activeMembership.phoneNumber || '');
    }
    return '';
  }, [activeMembership, studentProfile, userProfile?.phoneNumber]);

  const effectiveSelfPhone = savedPhoneFallback || resolvedSelfPhone;
  const studentRoutineOnboarding =
    studentProfile?.studyRoutineOnboarding || userProfile?.studyRoutineOnboarding;
  const studentRoutineProfile =
    studentProfile?.studyRoutineProfile || userProfile?.studyRoutineProfile;
  const shouldForceStudentOnboarding =
    isStudentRole &&
    !isStudentProfileLoading &&
    !isUserProfileLoading &&
    !hasFinishedStudentOnboarding &&
    !Boolean(
      studentRoutineProfile ||
      studentRoutineOnboarding?.completedAt ||
      studentRoutineOnboarding?.dismissedAt ||
      studentRoutineOnboarding?.status
    );
  const isPhoneLookupReady = useMemo(() => {
    if (!activeMembership || !user) return false;
    if (activeMembership.role === 'student') {
      return !isUserProfileLoading && !isStudentProfileLoading;
    }
    if (activeMembership.role === 'parent') {
      return !isUserProfileLoading;
    }
    return true;
  }, [activeMembership, user, isStudentProfileLoading, isUserProfileLoading]);

  useEffect(() => {
    if (!activeMembership || !user) return;
    if (activeMembership.role !== 'student' && activeMembership.role !== 'parent') return;
    if (!isPhoneLookupReady) return;
    if (effectiveSelfPhone) {
      setIsPhoneCaptureOpen(false);
      return;
    }
    setPhoneCaptureValue((prev) => prev || '');
    setIsPhoneCaptureOpen(true);
  }, [activeMembership, user, effectiveSelfPhone, isPhoneLookupReady]);

  useEffect(() => {
    if (!shouldForceStudentOnboarding || !userProfileRef || studentOnboardingPresentationRef.current) return;
    studentOnboardingPresentationRef.current = true;

    const onboardingPayload = {
      studyRoutineOnboarding: {
        presentedAt: studentRoutineOnboarding?.presentedAt || serverTimestamp(),
        version: PLAN_TRACK_ONBOARDING_VERSION,
        updatedAt: serverTimestamp(),
      },
    };

    void Promise.allSettled([
      setDoc(userProfileRef, onboardingPayload, { merge: true }),
      studentProfileRef ? setDoc(studentProfileRef, onboardingPayload, { merge: true }) : Promise.resolve(),
    ]).then((results) => {
      if (results.every((result) => result.status === 'rejected')) {
        console.error('[dashboard] failed to persist onboarding presentation state');
      }
    });
  }, [shouldForceStudentOnboarding, studentProfileRef, studentRoutineOnboarding?.presentedAt, userProfileRef]);

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
    if (!isValidKoreanMobilePhone(normalizedPhone)) {
      parentLinkForm.setError('parentPhoneNumber', {
        message: '본인 휴대폰 번호를 01012345678 형식으로 입력해 주세요.',
      });
      return;
    }

    setIsParentLinkSubmitting(true);
    try {
      const completeSignupFn = httpsCallable(functions, 'completeSignupWithInvite');
      const result: any = await completeSignupFn({
        role: 'parent',
        studentLinkCode: values.studentLinkCode.trim(),
        parentPhoneNumber: normalizedPhone,
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

  const persistSelfPhoneDirectly = async (normalizedPhone: string) => {
    if (!user || !firestore) {
      throw new Error('저장 준비가 아직 끝나지 않았습니다. 잠시 후 다시 시도해 주세요.');
    }

    await setDoc(
      doc(firestore, 'users', user.uid),
      {
        phoneNumber: normalizedPhone,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleSaveStudentRoutineProfile = useCallback(
    async (profile: UserStudyProfile) => {
      if (!firestore || !user || !activeMembership || !userProfileRef) return;

      const onboardingPayload = {
        presentedAt: studentRoutineOnboarding?.presentedAt || serverTimestamp(),
        status: 'completed' as const,
        completedAt: serverTimestamp(),
        version: PLAN_TRACK_ONBOARDING_VERSION,
        updatedAt: serverTimestamp(),
      };
      const studyProfilePayload = stripUndefinedDeep({
        ...profile,
        createdAt: studentRoutineProfile?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const writeResults = await Promise.allSettled([
        setDoc(
          userProfileRef,
          {
            updatedAt: serverTimestamp(),
            studyRoutineOnboarding: onboardingPayload,
            studyRoutineProfile: studyProfilePayload,
          },
          { merge: true }
        ),
        studentProfileRef
          ? setDoc(
              studentProfileRef,
              {
                id: user.uid,
                name: studentProfile?.name || activeMembership.displayName || user.displayName || '학생',
                schoolName: studentProfile?.schoolName || userProfile?.schoolName || '학교 미정',
                grade: studentProfile?.grade || '학년 미정',
                seatNo: studentProfile?.seatNo || 0,
                targetDailyMinutes: studentProfile?.targetDailyMinutes || 240,
                parentUids: studentProfile?.parentUids || [],
                createdAt: studentProfile?.createdAt || serverTimestamp(),
                updatedAt: serverTimestamp(),
                studyRoutineOnboarding: onboardingPayload,
                studyRoutineProfile: studyProfilePayload,
                studyRoutineWorkspace: null,
              },
              { merge: true }
            )
          : Promise.resolve(),
      ]);

      if (writeResults.every((result) => result.status === 'rejected')) {
        throw (writeResults.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined)?.reason;
      }

      if (writeResults.some((result) => result.status === 'rejected')) {
        console.warn('[dashboard] mirrored student profile write partially failed', writeResults);
      }

      toast({
        title: '학습 기준 저장 완료',
        description: '이제부터는 직접 쓴 계획을 바탕으로 더 잘 맞는 코칭과 추천을 보여드릴게요.',
      });
    },
    [
      activeMembership,
      firestore,
      studentProfile,
      studentProfileRef,
      studentRoutineOnboarding?.presentedAt,
      studentRoutineProfile?.createdAt,
      toast,
      user,
      userProfile?.schoolName,
      userProfileRef,
    ]
  );

  const handleSavePhoneCapture = async () => {
    if (!user || !activeMembership || !firestore) {
      toast({
        variant: 'destructive',
        title: '저장 준비 중',
        description: '계정 정보를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.',
      });
      return;
    }
    const normalizedPhone = normalizePhone(phoneCaptureValue);
    if (!isValidKoreanMobilePhone(normalizedPhone)) {
      toast({
        variant: 'destructive',
        title: '전화번호 확인',
        description: '휴대폰 번호를 01012345678 형식으로 입력해 주세요.',
      });
      return;
    }

    setIsPhoneCaptureSaving(true);
    try {
      if (activeMembership.role !== 'student' && activeMembership.role !== 'parent') {
        throw new Error('학생 또는 학부모 계정에서만 전화번호를 저장할 수 있습니다.');
      }

      await persistSelfPhoneDirectly(normalizedPhone);

      setSavedPhoneFallback(normalizedPhone);
      setIsPhoneCaptureOpen(false);
      toast({
        title: '전화번호 저장 완료',
        description: '본인 전화번호가 바로 저장되었습니다.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '저장 실패',
        description: resolveCallableErrorMessage(error, '전화번호 저장 중 오류가 발생했습니다.'),
      });
    } finally {
      setIsPhoneCaptureSaving(false);
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

    if (userRole === 'parent') {
      return (
        <>
          <div className="flex flex-col gap-3">
            <ParentDashboard isActive={true} />
          </div>
          <Dialog open={isPhoneCaptureOpen} onOpenChange={(open) => { if (effectiveSelfPhone) setIsPhoneCaptureOpen(open); }}>
            <DialogContent className="rounded-[2.5rem] border-none p-0 shadow-2xl sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
              <div className="bg-primary px-6 py-6 text-white">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black tracking-tight">본인 전화번호 확인</DialogTitle>
                  <DialogDescription className="text-white/75 font-bold">학부모 계정은 본인 수신 번호가 필요합니다. 지금 바로 등록해 주세요.</DialogDescription>
                </DialogHeader>
              </div>
              <div className="space-y-4 p-6">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase text-muted-foreground">학부모 본인 전화번호</Label>
                  <Input
                    value={phoneCaptureValue}
                    onChange={(e) => setPhoneCaptureValue(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="01012345678"
                    className="h-12 rounded-xl border-2 font-black tracking-tight"
                    maxLength={11}
                  />
                </div>
              </div>
              <DialogFooter className="border-t bg-muted/10 p-6">
                <Button onClick={handleSavePhoneCapture} disabled={isPhoneCaptureSaving} className="h-12 w-full rounded-2xl font-black">
                  {isPhoneCaptureSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Phone className="mr-2 h-4 w-4" />}
                  전화번호 저장
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      );
    }

    if (userRole === 'student' && shouldForceStudentOnboarding) {
      return (
        <RoutineOnboardingFlow
          studentName={studentProfile?.name || activeMembership.displayName || user?.displayName || '학생'}
          onSaveRoutineProfile={handleSaveStudentRoutineProfile}
          onContinueToPlanner={() => setHasFinishedStudentOnboarding(true)}
          autoContinueOnSave
          allowSkip={false}
        />
      );
    }

    return (
      <>
        <div className={cn('flex flex-col', isMobile ? 'gap-4' : 'gap-8')}>
          <StudentDashboard isActive={true} />
        </div>
        <Dialog open={isPhoneCaptureOpen} onOpenChange={(open) => { if (effectiveSelfPhone) setIsPhoneCaptureOpen(open); }}>
          <DialogContent className="rounded-[2.5rem] border-none p-0 shadow-2xl sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
            <div className="bg-primary px-6 py-6 text-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tight">본인 전화번호 등록</DialogTitle>
                <DialogDescription className="text-white/75 font-bold">학생 계정은 본인 번호가 필요합니다. 누락된 번호를 지금 바로 추가해 주세요.</DialogDescription>
              </DialogHeader>
            </div>
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-muted-foreground">학생 본인 전화번호</Label>
                <Input
                  value={phoneCaptureValue}
                  onChange={(e) => setPhoneCaptureValue(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="01012345678"
                  className="h-12 rounded-xl border-2 font-black tracking-tight"
                  maxLength={11}
                />
              </div>
            </div>
            <DialogFooter className="border-t bg-muted/10 p-6">
              <Button onClick={handleSavePhoneCapture} disabled={isPhoneCaptureSaving} className="h-12 w-full rounded-2xl font-black">
                {isPhoneCaptureSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Phone className="mr-2 h-4 w-4" />}
                전화번호 저장
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
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
                        학부모 본인 전화번호
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
                        학생 연동과 문자 수신을 위해 필수 입력입니다.
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

