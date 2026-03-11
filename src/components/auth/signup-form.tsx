'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { Loader2, ShieldCheck, UserCheck } from 'lucide-react';

import { useAuth, useFunctions } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
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
    parentPhoneNumber: z.string().trim().optional(),
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
  const functions = useFunctions();
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');

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
      parentPhoneNumber: '',
    },
  });

  const selectedRole = form.watch('role');

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
    const detailMessage = String(detailMessageRaw || '')
      .replace(/^\d+\s+FAILED_PRECONDITION:?\s*/i, '')
      .replace(/^\d+\s+ALREADY_EXISTS:?\s*/i, '')
      .replace(/^\d+\s+INVALID_ARGUMENT:?\s*/i, '')
      .replace(/^\d+\s+INTERNAL:?\s*/i, '')
      .trim();

    const rawMessage = String(error?.message || '').trim();
    const strippedRaw = rawMessage.replace(/^FirebaseError:\s*/i, '').trim();
    const cleanedRaw = strippedRaw
      .replace(/^\d+\s+FAILED_PRECONDITION:?\s*/i, '')
      .replace(/^\d+\s+ALREADY_EXISTS:?\s*/i, '')
      .replace(/^\d+\s+INVALID_ARGUMENT:?\s*/i, '')
      .trim();

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

  async function onSubmit(values: SignupFormValues) {
    if (!auth || !functions) return;

    if (values.role === 'student') {
      if (!values.displayName || values.displayName.length < 2) {
        form.setError('displayName', { message: '학생 이름을 입력해 주세요.' });
        return;
      }
      if (!values.schoolName || values.schoolName.length < 2) {
        form.setError('schoolName', { message: '학교명을 입력해 주세요.' });
        return;
      }
      if (!values.parentLinkCode || !/^\d{6}$/.test(values.parentLinkCode)) {
        form.setError('parentLinkCode', { message: '학생 코드(6자리 숫자)를 입력해 주세요.' });
        return;
      }
    }

    if (values.role === 'parent') {
      if (!values.studentLinkCode || !/^\d{6}$/.test(values.studentLinkCode)) {
        form.setError('studentLinkCode', { message: '학생 코드(6자리 숫자)를 입력해 주세요.' });
        return;
      }

      const normalizedPhone = normalizePhone(values.parentPhoneNumber || '');
      if (!isValidKoreanMobilePhone(normalizedPhone)) {
        form.setError('parentPhoneNumber', { message: '휴대폰 번호를 01012345678 형식으로 입력해 주세요.' });
        return;
      }
      values.parentPhoneNumber = normalizedPhone;
    }

    if ((values.role === 'teacher' || values.role === 'centerAdmin') && (!values.displayName || values.displayName.length < 2)) {
      form.setError('displayName', { message: '이름을 입력해 주세요.' });
      return;
    }

    if (values.role !== 'parent' && !values.inviteCode?.trim()) {
      form.setError('inviteCode', { message: '초대 코드를 입력해 주세요.' });
      return;
    }

    setIsLoading(true);
    router.prefetch('/dashboard');
    let createdUser = false;

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
      await completeSignupFn({
        code: inviteCode,
        role: values.role,
        displayName: finalDisplayName,
        schoolName: values.schoolName || '',
        grade: '고등학생',
        parentLinkCode: values.parentLinkCode || null,
        studentLinkCode: values.studentLinkCode || null,
        parentPhoneNumber: values.parentPhoneNumber || null,
      });

      setLoadingStatus('회원가입 완료');
      toast({
        title: '회원가입 완료',
        description: `${finalDisplayName} 계정이 생성되었습니다. 대시보드로 이동합니다.`,
      });

      setLoadingStatus('대시보드로 이동 중...');
      router.replace('/dashboard');
      router.refresh();
    } catch (error: any) {
      if (createdUser && auth.currentUser) {
        try {
          await auth.currentUser.delete();
        } catch (cleanupError) {
          console.error('Signup rollback failed:', cleanupError);
        }
      }

      console.error('Signup Error:', error);

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
        form.setError('parentPhoneNumber', { message: signupErrorMessage });
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
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
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
            name="parentPhoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">학부모 전화번호</FormLabel>
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
                  등원/하원/지각 문자 수신 번호입니다.
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
          {isLoading ? (loadingStatus || '처리 중...') : '가입 완료'}
        </Button>
      </form>

      <div className="mt-4 text-center text-sm font-bold text-muted-foreground">
        이미 계정이 있나요?{' '}
        <Link href="/login" className="text-primary underline">
          로그인
        </Link>
      </div>
    </Form>
  );
}
