'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Loader2, ShieldCheck, UserCheck } from 'lucide-react';

import { useAuth, useFirestore, useFunctions } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  buildClientConsentSnapshot,
  LEGAL_REQUIRED_PRIVACY_SUMMARY,
  LEGAL_REQUIRED_TERMS_SUMMARY,
  MARKETING_CONSENT_VERSION,
  PRIVACY_ROUTE,
  PRIVACY_VERSION,
  TERMS_ROUTE,
  TERMS_VERSION,
} from '@/lib/legal-documents';
import { AUTH_SESSION_SYNC_SKIP_STORAGE_KEY } from '@/lib/auth-session-shared';
import { createServerAuthSession } from '@/lib/client-auth-session';
import { getSafeErrorMessage } from '@/lib/exposed-error';
import { logHandledClientIssue } from '@/lib/handled-client-log';

const roleEnum = z.enum(['student', 'teacher', 'parent', 'centerAdmin']);

const formSchema = z
  .object({
    displayName: z.string().trim().optional(),
    email: z.string().email('올바른 이메일 형식이 아닙니다.'),
    password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
    confirmPassword: z.string().min(1, '비밀번호 확인을 입력해 주세요.'),
    role: roleEnum,
    schoolName: z.string().trim().optional(),
    inviteCode: z.string().trim().optional(),
    parentLinkCode: z.string().trim().optional(),
    studentLinkCode: z.string().trim().optional(),
    phoneNumber: z.string().trim().optional(),
    termsConsent: z.boolean().refine((value) => value, '이용약관에 동의해 주세요.'),
    privacyConsent: z.boolean().refine((value) => value, '개인정보 수집 및 이용에 동의해 주세요.'),
    age14Consent: z.boolean().refine((value) => value, '만 14세 이상 여부를 확인해 주세요.'),
    marketingEmailConsent: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '비밀번호가 일치하지 않습니다.',
        path: ['confirmPassword'],
      });
    }
  });

type SignupFormValues = z.infer<typeof formSchema>;

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

function isValidKoreanMobilePhone(raw: string): boolean {
  return /^01\d{8,9}$/.test(raw);
}

export function SignupForm() {
  const auth = useAuth();
  const firestore = useFirestore();
  const functions = useFunctions();
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'student',
      schoolName: '',
      inviteCode: '',
      parentLinkCode: '',
      studentLinkCode: '',
      phoneNumber: '',
      termsConsent: false,
      privacyConsent: false,
      age14Consent: false,
      marketingEmailConsent: false,
    },
  });

  const selectedRole = form.watch('role');
  const termsConsent = form.watch('termsConsent');
  const privacyConsent = form.watch('privacyConsent');
  const age14Consent = form.watch('age14Consent');
  const marketingEmailConsent = form.watch('marketingEmailConsent');
  const requiredSignupConsentsAccepted = termsConsent && privacyConsent && age14Consent;
  const signupConsentDescription =
    selectedRole === 'student' || selectedRole === 'parent'
      ? '학생·학부모 연동 정보, 학습기록, 상담·리포트, 운영 알림까지 포함한 처리 범위를 확인한 뒤 가입을 진행합니다.'
      : '계정 생성, 센터 소속 처리, 학생 관리, 상담·리포트, 운영 알림에 필요한 처리 범위를 확인한 뒤 가입을 진행합니다.';

  const resolveSignupErrorMessage = (error: any): string => {
    const code = String(error?.code || '').toLowerCase();
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
    const detailMessage = getSafeErrorMessage(detailMessageRaw, '');

    const rawMessage = String(error?.message || '').trim();
    const strippedRaw = rawMessage.replace(/^FirebaseError:\s*/i, '').trim();
    const cleanedRaw = getSafeErrorMessage(strippedRaw, '');

    const normalizedRaw =
      /^(functions\/)?internal$/i.test(cleanedRaw) || /\(functions\/internal\)/i.test(cleanedRaw)
        ? ''
        : cleanedRaw;

    const hasFailedPrecondition =
      code.includes('failed-precondition') || /failed[_ -]?precondition/i.test(strippedRaw);
    const hasInvalidArgument =
      code.includes('invalid-argument') || /invalid[_ -]?argument/i.test(strippedRaw);
    const hasAlreadyExists =
      code.includes('already-exists') || /already[_ -]?exists/i.test(strippedRaw);

    if (!detailMessage && !normalizedRaw) {
      if (hasFailedPrecondition) {
        return '가입 조건을 확인해 주세요. 학생 코드 또는 초대 코드를 다시 확인해 주세요.';
      }
      if (hasInvalidArgument) {
        return '입력값이 올바르지 않습니다. 필수 항목을 다시 확인해 주세요.';
      }
      if (hasAlreadyExists) {
        return '이미 가입된 계정입니다.';
      }
    }

    const fallbackMessage = detailMessage || normalizedRaw;

    switch (code) {
      case 'auth/email-already-in-use':
        return '이미 사용 중인 이메일입니다.';
      case 'auth/invalid-email':
        return '이메일 형식을 확인해 주세요.';
      case 'auth/weak-password':
        return '비밀번호가 너무 약합니다. 8자 이상으로 입력해 주세요.';
      case 'auth/network-request-failed':
        return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
      case 'functions/invalid-argument':
        return fallbackMessage || '입력값이 올바르지 않습니다.';
      case 'functions/failed-precondition':
        return fallbackMessage || '가입 조건을 만족하지 못했습니다. 입력한 코드를 다시 확인해 주세요.';
      case 'functions/already-exists':
        return fallbackMessage || '이미 센터에 가입된 계정입니다.';
      case 'functions/unauthenticated':
        return '로그인이 만료되었습니다. 다시 시도해 주세요.';
      case 'functions/internal':
        return fallbackMessage || '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
      default:
        return fallbackMessage || '가입 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    }
  };

  function validateRoleSpecificFields(values: SignupFormValues) {
    if (values.role === 'student') {
      if (!values.displayName || values.displayName.length < 2) {
        form.setError('displayName', { message: '학생 이름을 입력해 주세요.' });
        return false;
      }
      if (!values.schoolName || values.schoolName.length < 2) {
        form.setError('schoolName', { message: '학교명을 입력해 주세요.' });
        return false;
      }
      if (!values.parentLinkCode || !/^\d{6}$/.test(values.parentLinkCode)) {
        form.setError('parentLinkCode', { message: '학생 코드(6자리 숫자)를 입력해 주세요.' });
        return false;
      }
      const normalizedPhone = normalizePhone(values.phoneNumber || '');
      if (!isValidKoreanMobilePhone(normalizedPhone)) {
        form.setError('phoneNumber', { message: '본인 휴대폰 번호를 01012345678 형식으로 입력해 주세요.' });
        return false;
      }
    }

    if (values.role === 'parent') {
      if (!values.studentLinkCode || !/^\d{6}$/.test(values.studentLinkCode)) {
        form.setError('studentLinkCode', { message: '학생 코드(6자리 숫자)를 입력해 주세요.' });
        return false;
      }

      const normalizedPhone = normalizePhone(values.phoneNumber || '');
      if (!isValidKoreanMobilePhone(normalizedPhone)) {
        form.setError('phoneNumber', { message: '본인 휴대폰 번호를 01012345678 형식으로 입력해 주세요.' });
        return false;
      }
    }

    if ((values.role === 'teacher' || values.role === 'centerAdmin') && (!values.displayName || values.displayName.length < 2)) {
      form.setError('displayName', { message: '이름을 입력해 주세요.' });
      return false;
    }

    if (values.role !== 'parent' && !values.inviteCode?.trim()) {
      form.setError('inviteCode', { message: '초대 코드를 입력해 주세요.' });
      return false;
    }

    return true;
  }

  async function handleRequestSignup(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const baseFields: Array<keyof SignupFormValues> = [
      'displayName',
      'email',
      'password',
      'confirmPassword',
      'role',
      'schoolName',
      'inviteCode',
      'parentLinkCode',
      'studentLinkCode',
      'phoneNumber',
    ];
    const isBaseValid = await form.trigger(baseFields);
    if (!isBaseValid) return;

    const values = form.getValues();
    if (!validateRoleSpecificFields(values)) return;

    setConsentDialogOpen(true);
  }

  async function onSubmit(values: SignupFormValues) {
    if (!auth || !functions) return;

    if (!validateRoleSpecificFields(values)) {
      return;
    }
    if (values.role === 'student' || values.role === 'parent') {
      values.phoneNumber = normalizePhone(values.phoneNumber || '');
    }

    setIsLoading(true);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(AUTH_SESSION_SYNC_SKIP_STORAGE_KEY, '1');
    }
    router.prefetch('/dashboard');
    let createdUser = false;
    let signupCompleted = false;

    try {
      const inviteCode = (values.inviteCode || '').trim();
      const trimmedEmail = values.email.trim();
      const fallbackName =
        values.role === 'parent' ? '학부모' : values.role === 'student' ? '학생' : '사용자';
      const finalDisplayName = (values.displayName || '').trim() || fallbackName;

      setLoadingStatus('계정 생성 중...');
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, values.password);
      createdUser = true;
      await updateProfile(userCredential.user, { displayName: finalDisplayName });

      setLoadingStatus('센터 가입 처리 중...');
      const completeSignupFn = httpsCallable(functions, 'completeSignupWithInvite');
      const consentRecordedAt = new Date().toISOString();
      const legalConsents = {
        terms: buildClientConsentSnapshot({
          agreed: values.termsConsent,
          version: TERMS_VERSION,
          source: 'signup',
          agreedAt: consentRecordedAt,
        }),
        privacy: buildClientConsentSnapshot({
          agreed: values.privacyConsent,
          version: PRIVACY_VERSION,
          source: 'signup',
          agreedAt: consentRecordedAt,
        }),
        age14: buildClientConsentSnapshot({
          agreed: values.age14Consent,
          version: PRIVACY_VERSION,
          source: 'signup',
          agreedAt: consentRecordedAt,
        }),
        marketingEmail: buildClientConsentSnapshot({
          agreed: values.marketingEmailConsent,
          version: MARKETING_CONSENT_VERSION,
          source: 'signup',
          channel: 'email',
          agreedAt: consentRecordedAt,
        }),
      };
      await completeSignupFn({
        code: inviteCode,
        role: values.role,
        displayName: finalDisplayName,
        schoolName: values.schoolName || '',
        grade: '고등학생',
        parentLinkCode: values.parentLinkCode || null,
        studentLinkCode: values.studentLinkCode || null,
        phoneNumber: values.phoneNumber || null,
        legalConsents,
      });
      signupCompleted = true;

      if (firestore) {
        try {
          const userProfilePatch: Record<string, unknown> = {
            id: userCredential.user.uid,
            email: trimmedEmail,
            displayName: finalDisplayName,
            schoolName: values.schoolName || '',
            legalConsents,
            updatedAt: serverTimestamp(),
          };
          if (values.phoneNumber) {
            userProfilePatch.phoneNumber = values.phoneNumber;
          }
          await setDoc(doc(firestore, 'users', userCredential.user.uid), userProfilePatch, { merge: true });
        } catch (profileWriteError) {
          logHandledClientIssue('[signup-form] legal consent mirror write failed', profileWriteError);
        }
      }

      try {
        await createServerAuthSession(userCredential.user);
      } catch {
        await signOut(auth).catch(() => undefined);
        throw new Error('회원가입은 완료되었지만 브라우저 인증 세션을 준비하지 못했습니다. 로그인 페이지에서 다시 로그인해 주세요.');
      }

      setLoadingStatus('회원가입 완료');
      toast({
        title: '회원가입 완료',
        description: `${finalDisplayName} 계정이 생성되었습니다. 대시보드로 이동합니다.`,
      });

      setConsentDialogOpen(false);
      setLoadingStatus('대시보드로 이동 중...');
      router.replace('/dashboard');
      router.refresh();
    } catch (error: any) {
      if (createdUser && !signupCompleted && auth.currentUser) {
        try {
          await auth.currentUser.delete();
        } catch (cleanupError) {
          logHandledClientIssue('[signup-form] signup rollback failed', cleanupError);
        }
      }

      logHandledClientIssue('[signup-form] signup failed', error);

      const signupErrorMessage = resolveSignupErrorMessage(error);
      const msgLower = signupErrorMessage.toLowerCase();

      if (values.role === 'parent') {
        form.setError('studentLinkCode', { message: signupErrorMessage });
      } else if (/invite|초대|invite code/.test(msgLower)) {
        form.setError('inviteCode', { message: signupErrorMessage });
      }

      if (/parent|학부모|연동/.test(msgLower)) {
        form.setError('parentLinkCode', { message: signupErrorMessage });
      }
      if (/phone|전화|휴대폰/.test(msgLower)) {
        form.setError('phoneNumber', { message: signupErrorMessage });
      }
      if (/school|학교/.test(msgLower)) {
        form.setError('schoolName', { message: signupErrorMessage });
      }

      toast({
        variant: 'destructive',
        title: '가입 실패',
        description: signupErrorMessage,
      });

      setIsLoading(false);
      setLoadingStatus('');
    } finally {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(AUTH_SESSION_SYNC_SKIP_STORAGE_KEY);
      }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={(event) => void handleRequestSignup(event)} className="grid gap-4">
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-bold">역할</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                <FormControl>
                  <SelectTrigger className="h-12 rounded-xl border-2">
                    <SelectValue placeholder="역할을 선택해 주세요" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="student">학생</SelectItem>
                  <SelectItem value="teacher">선생님</SelectItem>
                  <SelectItem value="parent">학부모</SelectItem>
                  <SelectItem value="centerAdmin">센터 관리자</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedRole !== 'parent' && (
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">이름</FormLabel>
                <FormControl>
                  <Input placeholder="이름" {...field} disabled={isLoading} className="h-12 rounded-xl" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-bold">이메일</FormLabel>
              <FormControl>
                <Input placeholder="name@example.com" {...field} disabled={isLoading} className="h-12 rounded-xl" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-bold">비밀번호 (8자 이상)</FormLabel>
              <FormControl>
                <Input type="password" {...field} disabled={isLoading} className="h-12 rounded-xl" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="font-bold">비밀번호 확인</FormLabel>
              <FormControl>
                <Input type="password" {...field} disabled={isLoading} className="h-12 rounded-xl" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedRole === 'student' && (
          <>
            <FormField
              control={form.control}
              name="schoolName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold">학교명</FormLabel>
                  <FormControl>
                    <Input placeholder="예: 트랙고등학교" {...field} disabled={isLoading} className="h-12 rounded-xl border-2" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold">본인 전화번호</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="01012345678"
                      maxLength={11}
                      {...field}
                      className="h-12 rounded-xl border-2 font-black tracking-tight"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription className="text-[10px] font-bold">
                    학생 본인 알림과 센터 연락을 위해 사용됩니다.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="parentLinkCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 font-bold">
                    학생 코드 <ShieldCheck className="h-3 w-3 text-primary" />
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="6자리 숫자"
                      maxLength={6}
                      {...field}
                      className="h-12 rounded-xl border-2 text-center font-black tracking-[0.5em]"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormDescription className="text-[10px] font-bold">
                    학부모 가입 시 동일한 학생 코드를 입력하면 자동으로 연동됩니다.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {selectedRole === 'parent' && (
          <FormField
            control={form.control}
            name="studentLinkCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2 font-bold">
                  학생 코드 <UserCheck className="h-3 w-3 text-primary" />
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="학생이 설정한 6자리 숫자"
                    maxLength={6}
                    {...field}
                    className="h-12 rounded-xl border-2 text-center font-black tracking-[0.5em]"
                    disabled={isLoading}
                  />
                </FormControl>
                <FormDescription className="text-[10px] font-bold">
                  초대코드 없이 학생 코드로 가입됩니다.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {selectedRole === 'parent' && (
          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">본인 전화번호</FormLabel>
                <FormControl>
                  <Input
                    placeholder="01012345678"
                    maxLength={11}
                    {...field}
                    className="h-12 rounded-xl border-2 font-black tracking-tight"
                    disabled={isLoading}
                  />
                </FormControl>
                <FormDescription className="text-[10px] font-bold">
                  학부모 본인 수신 번호로 문자와 연락이 전달됩니다.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {selectedRole !== 'parent' ? (
          <FormField
            control={form.control}
            name="inviteCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">센터 초대 코드</FormLabel>
                <FormControl>
                  <Input
                    placeholder="센터에서 받은 초대 코드"
                    {...field}
                    disabled={isLoading}
                    className="h-12 rounded-xl border-2"
                  />
                </FormControl>
                <FormDescription className="rounded-lg bg-primary/5 p-2 text-[10px] font-black text-primary">
                  학생, 선생님, 관리자 가입 시 초대 코드가 필요합니다.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <div className="rounded-xl border border-[#ffd9b7] bg-[#fff7ef] px-3 py-2 text-[11px] font-bold text-[#8b3e00]">
            학부모는 센터 초대코드 없이 학생 코드로 가입할 수 있습니다.
          </div>
        )}

        <Button type="submit" className="mt-2 h-14 w-full rounded-2xl text-lg font-black shadow-xl" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          {isLoading ? (loadingStatus || '처리 중...') : '회원가입 진행하기'}
        </Button>
      </form>

      <Dialog open={consentDialogOpen} onOpenChange={(open) => !isLoading && setConsentDialogOpen(open)}>
        <DialogContent className="rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-xl">
          <div className="rounded-t-[2rem] bg-[#14295F] px-6 py-6 text-white sm:px-7">
            <DialogHeader className="text-left">
              <DialogTitle className="text-[1.8rem] font-black tracking-[-0.04em]">
                회원가입 전 개인정보 동의
              </DialogTitle>
              <DialogDescription className="pt-2 text-sm font-bold leading-6 text-white/78">
                {signupConsentDescription}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 px-6 py-6 sm:px-7">
            <div className="grid gap-3 rounded-[1.6rem] border border-[#14295F]/10 bg-[#f8fbff] p-4">
              <div className="grid gap-1">
                <p className="text-sm font-black text-[#14295F]">필수 동의</p>
                <p className="text-[11px] font-semibold leading-5 text-[#14295F]/58">
                  아래 항목에 동의해야 가입을 완료할 수 있습니다.
                </p>
              </div>

              <FormField
                control={form.control}
                name="termsConsent"
                render={({ field }) => (
                  <FormItem className="rounded-[1.25rem] border border-[#14295F]/10 bg-white px-4 py-3">
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                          disabled={isLoading}
                          className="mt-1 h-5 w-5 rounded-md border-[#14295F]/20 data-[state=checked]:border-[#14295F] data-[state=checked]:bg-[#14295F] data-[state=checked]:text-white"
                        />
                      </FormControl>
                      <div className="grid gap-1">
                        <FormLabel className="cursor-pointer text-sm font-black text-[#14295F]">
                          [필수] 이용약관에 동의합니다.
                        </FormLabel>
                        <p className="text-[11px] font-semibold leading-5 text-[#14295F]/58">
                          {LEGAL_REQUIRED_TERMS_SUMMARY}
                        </p>
                        <Link
                          href={TERMS_ROUTE}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-black text-[#FF7A16] underline underline-offset-4"
                        >
                          이용약관 전문 보기
                        </Link>
                        <FormMessage />
                      </div>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="privacyConsent"
                render={({ field }) => (
                  <FormItem className="rounded-[1.25rem] border border-[#14295F]/10 bg-white px-4 py-3">
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                          disabled={isLoading}
                          className="mt-1 h-5 w-5 rounded-md border-[#14295F]/20 data-[state=checked]:border-[#14295F] data-[state=checked]:bg-[#14295F] data-[state=checked]:text-white"
                        />
                      </FormControl>
                      <div className="grid gap-1">
                        <FormLabel className="cursor-pointer text-sm font-black text-[#14295F]">
                          [필수] 개인정보 수집 및 이용에 동의합니다.
                        </FormLabel>
                        <p className="text-[11px] font-semibold leading-5 text-[#14295F]/58">
                          {LEGAL_REQUIRED_PRIVACY_SUMMARY}
                        </p>
                        <Link
                          href={PRIVACY_ROUTE}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-black text-[#FF7A16] underline underline-offset-4"
                        >
                          개인정보처리방침 전문 보기
                        </Link>
                        <FormMessage />
                      </div>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="age14Consent"
                render={({ field }) => (
                  <FormItem className="rounded-[1.25rem] border border-[#14295F]/10 bg-white px-4 py-3">
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                          disabled={isLoading}
                          className="mt-1 h-5 w-5 rounded-md border-[#14295F]/20 data-[state=checked]:border-[#14295F] data-[state=checked]:bg-[#14295F] data-[state=checked]:text-white"
                        />
                      </FormControl>
                      <div className="grid gap-1">
                        <FormLabel className="cursor-pointer text-sm font-black text-[#14295F]">
                          [필수] 만 14세 이상입니다.
                        </FormLabel>
                        <p className="text-[11px] font-semibold leading-5 text-[#14295F]/58">
                          현재는 별도 법정대리인 동의 절차 없이 만 14세 이상만 회원가입할 수 있습니다.
                        </p>
                        <FormMessage />
                      </div>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 rounded-[1.6rem] border border-[#FF7A16]/12 bg-[#fff7ef] p-4">
              <div className="grid gap-1">
                <p className="text-sm font-black text-[#14295F]">선택 동의</p>
                <p className="text-[11px] font-semibold leading-5 text-[#14295F]/58">
                  아래 항목은 선택이며, 동의하지 않아도 회원가입은 가능합니다.
                </p>
              </div>

              <FormField
                control={form.control}
                name="marketingEmailConsent"
                render={({ field }) => (
                  <FormItem className="rounded-[1.25rem] border border-[#FF7A16]/15 bg-white px-4 py-3">
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                          disabled={isLoading}
                          className="mt-1 h-5 w-5 rounded-md border-[#FF7A16]/28 data-[state=checked]:border-[#FF7A16] data-[state=checked]:bg-[#FF7A16] data-[state=checked]:text-white"
                        />
                      </FormControl>
                      <div className="grid gap-1">
                        <FormLabel className="cursor-pointer text-sm font-black text-[#14295F]">
                          [선택] 전화·문자(필요 시 이메일)로 혜택·이벤트·신규 프로그램 안내를 받겠습니다.
                        </FormLabel>
                        <p className="text-[11px] font-semibold leading-5 text-[#14295F]/58">
                          운영 연락과 별도로, 혜택·이벤트·신규 프로그램 안내를 전화번호 중심으로 드리며 필요 시 이메일로도 안내드립니다.
                        </p>
                        <FormMessage />
                      </div>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-[#14295F]/8 bg-[#f8fbff] px-6 py-5 sm:px-7">
            <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-2xl border-[#14295F]/12 font-black text-[#14295F]"
                onClick={() => setConsentDialogOpen(false)}
                disabled={isLoading}
              >
                다시 확인할게요
              </Button>
              <Button
                type="button"
                className="h-12 rounded-2xl bg-[#FF7A16] font-black text-white hover:bg-[#e86d11]"
                onClick={() => void form.handleSubmit(onSubmit)()}
                disabled={isLoading || !requiredSignupConsentsAccepted}
              >
                {isLoading ? (loadingStatus || '처리 중...') : '동의하고 가입하기'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-4 text-center text-sm font-bold text-muted-foreground">
        이미 계정이 있나요?{' '}
        <Link href="/login" className="text-primary underline">
          로그인
        </Link>
      </div>
    </Form>
  );
}
