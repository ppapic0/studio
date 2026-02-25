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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useFunctions } from '@/firebase';
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';

const formSchema = z.object({
  displayName: z.string().min(2, {
    message: '이름은 2자 이상이어야 합니다.',
  }),
  email: z.string().email({
    message: '유효한 이메일 주소를 입력해주세요.',
  }),
  password: z.string().min(8, {
    message: '비밀번호는 8자 이상이어야 합니다.',
  }),
  inviteCode: z.string().min(4, {
    message: '초대 코드는 4자 이상이어야 합니다.',
  }),
});

export function SignupForm() {
  const router = useRouter();
  const auth = useAuth();
  const functions = useFunctions();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      inviteCode: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth || !functions) return;
    setIsLoading(true);
    try {
      // 1. Create User in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      const user = userCredential.user;

      // 2. Update Firebase Auth profile
      await updateProfile(user, { displayName: values.displayName });

      // 3. Redeem invite code via Cloud Function.
      const redeemInviteCode = httpsCallable(functions, 'redeemInviteCode');
      await redeemInviteCode({ code: values.inviteCode });

      toast({
        title: '회원가입 성공!',
        description: '센터에 오신 것을 환영합니다. 대시보드로 이동합니다.',
      });

      router.push('/app');
    } catch (error: any) {
      console.error('Signup failed:', error);

      let description = '오류가 발생했습니다. 다시 시도해 주세요.';
      if (error.code === 'auth/email-already-in-use') {
        description = '이미 사용 중인 이메일입니다.';
      } else if (error.code === 'functions/not-found') {
        description = '입력하신 초대 코드가 유효하지 않습니다. 다시 확인해주세요.';
      } else if (error.code === 'functions/resource-exhausted') {
        description = '해당 초대 코드의 사용 한도를 초과했습니다.';
      } else if (error.code === 'functions/deadline-exceeded') {
        description = '초대 코드가 만료되었습니다.';
      } else if (error.code === 'functions/internal') {
        description = error.message || '서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      } else if (error.message) {
        description = error.message;
      }

      toast({
        variant: 'destructive',
        title: '가입 실패',
        description: description,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>이름</FormLabel>
              <FormControl>
                <Input placeholder="홍길동" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>이메일</FormLabel>
              <FormControl>
                <Input placeholder="name@example.com" {...field} />
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
              <FormLabel>비밀번호</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="inviteCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>초대 코드</FormLabel>
              <FormControl>
                <Input placeholder="센터 초대 코드를 입력하세요" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full bg-accent hover:bg-accent/90"
          disabled={isLoading}
        >
          {isLoading ? '계정 생성 중...' : '가입 및 센터 참여'}
        </Button>
      </form>
      <div className="mt-4 text-center text-sm">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="underline">
          로그인
        </Link>
      </div>
    </Form>
  );
}
