'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';
import { useAuth, useFunctions } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, UserCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

const formSchema = z.object({
  displayName: z.string().optional(),
  email: z.string().email('유효한 이메일을 입력해주세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
  confirmPassword: z.string().min(1, '비밀번호 확인을 입력해주세요.'),
  role: z.enum(['student', 'teacher', 'parent', 'centerAdmin'], {
    required_error: '역할을 선택해주세요.',
  }),
  schoolName: z.string().optional(),
  inviteCode: z.string().optional(),
  parentLinkCode: z.string().optional(),
  studentLinkCode: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다.',
  path: ['confirmPassword'],
});

export function SignupForm() {
  const auth = useAuth();
  const functions = useFunctions();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');

  const form = useForm<z.infer<typeof formSchema>>({
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
    },
  });

  const selectedRole = form.watch('role');

  const resolveSignupErrorMessage = (error: any) => {
    const code = String(error?.code || '');
    const detailMessage =
      typeof error?.details === 'string'
        ? error.details
        : typeof error?.details?.userMessage === 'string'
          ? error.details.userMessage
          : typeof error?.details?.message === 'string'
            ? error.details.message
            : '';

    const rawMessage = String(error?.message || '').trim();
    const normalizedRaw = /^(functions\/)?internal$/i.test(rawMessage) ? '' : rawMessage;
    const fallbackMessage = detailMessage || normalizedRaw;

    switch (code) {
      case 'auth/email-already-in-use':
        return '이미 사용 중인 이메일입니다.';
      case 'auth/invalid-email':
        return '이메일 형식이 올바르지 않습니다.';
      case 'auth/weak-password':
        return '비밀번호가 너무 약합니다. 8자 이상으로 설정해 주세요.';
      case 'auth/network-request-failed':
        return '네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
      case 'functions/invalid-argument':
        return fallbackMessage || '입력값이 올바르지 않습니다. 입력 항목을 확인해 주세요.';
      case 'functions/failed-precondition':
        return fallbackMessage || '가입 조건을 만족하지 않습니다. 초대코드/연동코드를 확인해 주세요.';
      case 'functions/already-exists':
        return fallbackMessage || '이미 가입된 센터입니다.';
      case 'functions/unauthenticated':
        return '인증이 만료되었습니다. 다시 로그인 후 시도해 주세요.';
      case 'functions/internal':
        return fallbackMessage || '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
      default:
        return fallbackMessage || '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth || !functions) return;

    if (values.role === 'student') {
      if (!values.displayName || values.displayName.length < 2) {
        form.setError('displayName', { message: '이름을 입력해주세요.' });
        return;
      }
      if (!values.schoolName || values.schoolName.length < 2) {
        form.setError('schoolName', { message: '학교명을 입력해주세요.' });
        return;
      }
      if (!values.parentLinkCode || !/^\d{6}$/.test(values.parentLinkCode)) {
        form.setError('parentLinkCode', { message: '부모님 연동을 위한 6자리 숫자를 입력해주세요.' });
        return;
      }
    }

    if (values.role === 'parent' && (!values.studentLinkCode || !/^\d{6}$/.test(values.studentLinkCode))) {
      form.setError('studentLinkCode', { message: '자녀의 6자리 연동 코드를 입력해주세요.' });
      return;
    }

    if ((values.role === 'teacher' || values.role === 'centerAdmin') && (!values.displayName || values.displayName.length < 2)) {
      form.setError('displayName', { message: '이름을 입력해주세요.' });
      return;
    }

    if (values.role !== 'parent' && !values.inviteCode?.trim()) {
      form.setError('inviteCode', { message: '초대 코드를 입력해주세요.' });
      return;
    }

    setIsLoading(true);
    let createdUser = false;

    try {
      const inviteCode = (values.inviteCode || '').trim();
      const trimmedEmail = values.email.trim();
      const fallbackName =
        values.role === 'parent'
          ? '학부모'
          : values.role === 'student'
            ? '학생'
            : '사용자';
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
      });

      setLoadingStatus('회원가입이 완료되었습니다!');
      toast({
        title: '회원가입 완료 ✨',
        description: `${finalDisplayName}님의 계정이 성공적으로 생성되었습니다. 로그인 창으로 이동합니다.`,
      });

      await signOut(auth);
      setTimeout(() => {
        router.replace('/login');
      }, 1500);
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
      if (/초대\s*코드|초대코드/.test(signupErrorMessage)) {
        form.setError('inviteCode', { message: signupErrorMessage });
      }
      if (/자녀\s*연동\s*코드|연동 코드를 가진 학생|동일한 자녀 연동 코드/.test(signupErrorMessage)) {
        form.setError('studentLinkCode', { message: signupErrorMessage });
      }
      if (/부모\s*연동\s*코드/.test(signupErrorMessage)) {
        form.setError('parentLinkCode', { message: signupErrorMessage });
      }
      if (/학교명/.test(signupErrorMessage)) {
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
              <FormLabel className="font-bold">가입 역할</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                <FormControl>
                  <SelectTrigger className="h-12 rounded-xl border-2">
                    <SelectValue placeholder="역할을 선택하세요" />
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
                <FormControl><Input placeholder="홍길동" {...field} disabled={isLoading} className="rounded-xl h-12" /></FormControl>
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
              <FormControl><Input placeholder="name@example.com" {...field} disabled={isLoading} className="rounded-xl h-12" /></FormControl>
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
              <FormControl><Input type="password" {...field} disabled={isLoading} className="rounded-xl h-12" /></FormControl>
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
              <FormControl><Input type="password" {...field} disabled={isLoading} className="rounded-xl h-12" /></FormControl>
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
                  <FormLabel className="font-bold">소속 학교</FormLabel>
                  <FormControl><Input placeholder="예: 동백고등학교" {...field} className="h-12 rounded-xl border-2" disabled={isLoading} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentLinkCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 font-bold">부모님 연동 코드 <ShieldCheck className="h-3 w-3 text-primary" /></FormLabel>
                  <FormControl><Input placeholder="6자리 숫자" maxLength={6} {...field} className="h-12 rounded-xl border-2 font-black tracking-[0.5em] text-center" disabled={isLoading} /></FormControl>
                  <FormDescription className="text-[10px] font-bold">부모님이 가입하실 때 이 코드를 입력하면 자녀의 정보를 볼 수 있습니다.</FormDescription>
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
                <FormLabel className="flex items-center gap-2 font-bold">자녀 연동 코드 <UserCheck className="h-3 w-3 text-primary" /></FormLabel>
                <FormControl><Input placeholder="자녀가 설정한 6자리 숫자" maxLength={6} {...field} className="h-12 rounded-xl border-2 font-black tracking-[0.5em] text-center" disabled={isLoading} /></FormControl>
                <FormDescription className="text-[10px] font-bold">자녀에게 물어보고 6자리 코드를 입력해 주세요.</FormDescription>
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
                <FormLabel className="font-bold">센터 가입 코드</FormLabel>
                <FormControl><Input placeholder="센터에서 제공받은 코드" {...field} className="h-12 rounded-xl border-2" disabled={isLoading} /></FormControl>
                <FormDescription className="text-[10px] font-black text-primary bg-primary/5 p-2 rounded-lg">
                  💡 반드시 선택하신 가입 역할에 맞는 코드를 입력해야 합니다.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <div className="rounded-xl border border-[#ffd9b7] bg-[#fff7ef] px-3 py-2 text-[11px] font-bold text-[#8b3e00]">
            학부모는 센터 초대코드 없이 자녀 연동 코드로 가입할 수 있습니다.
          </div>
        )}
        <Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg mt-2 shadow-xl" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          {isLoading ? (loadingStatus || '처리 중...') : '가입 완료'}
        </Button>
      </form>
      <div className="mt-4 text-center text-sm font-bold text-muted-foreground">
        이미 계정이 있으신가요? <Link href="/login" className="underline text-primary">로그인</Link>
      </div>
    </Form>
  );
}
