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
  inviteCode: z.string().min(1, {
    message: '초대 코드를 입력해주세요.',
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
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      await updateProfile(userCredential.user, { displayName: values.displayName });

      // 2. Redeem Invite Code (This bootstraps the center if it's missing)
      const redeemInviteCode = httpsCallable(functions, 'redeemInviteCode');
      const result: any = await redeemInviteCode({ code: values.inviteCode });

      if (result.data.ok) {
        toast({
          title: '회원가입 및 가입 성공!',
          description: result.data.message,
        });
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Signup failed:', error);
      toast({
        variant: 'destructive',
        title: '가입 실패',
        description: error.message || '초대 코드가 유효하지 않거나 서버 오류가 발생했습니다.',
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
              <FormControl><Input placeholder="홍길동" {...field} /></FormControl>
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
              <FormControl><Input placeholder="name@example.com" {...field} /></FormControl>
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
              <FormControl><Input type="password" {...field} /></FormControl>
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
              <FormControl><Input placeholder="0313" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? '처리 중...' : '가입 및 센터 참여'}
        </Button>
      </form>
      <div className="mt-4 text-center text-sm">
        이미 계정이 있으신가요? <Link href="/login" className="underline">로그인</Link>
      </div>
    </Form>
  );
}