
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
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCircle, GraduationCap } from 'lucide-react';
import { redeemInviteCodeAction } from '@/lib/membership-actions';

const formSchema = z.object({
  displayName: z.string().min(2, '이름은 2자 이상이어야 합니다.'),
  email: z.string().email('유효한 이메일을 입력해주세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
  role: z.enum(['student', 'teacher'], {
    required_error: '역할을 선택해주세요.',
  }),
  inviteCode: z.string().min(1, '초대 코드를 입력해주세요.'),
});

export function SignupForm() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      displayName: '', 
      email: '', 
      password: '', 
      role: 'student',
      inviteCode: '' 
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth) return;
    setIsLoading(true);
    try {
      // 1. Firebase Auth 계정 생성
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      await updateProfile(userCredential.user, { displayName: values.displayName });

      // 2. 서버 액션을 통해 초대 코드 사용 및 센터 가입 (필수 문서들 생성 포함)
      const result = await redeemInviteCodeAction(userCredential.user.uid, values.inviteCode, values.displayName);

      if (result.ok) {
        toast({ title: '가입 성공', description: result.message });
        // 가입 후 멤버십 정보가 반영되도록 대시보드로 이동
        router.push('/dashboard');
        // 강제 새로고침으로 AuthGuard가 최신 데이터를 읽도록 함
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (error: any) {
      console.error('Signup Error:', error);
      toast({
        variant: 'destructive',
        title: '가입 실패',
        description: error.message || '오류가 발생했습니다. 초대 코드를 확인해 주세요.',
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
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>가입 역할</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="역할을 선택하세요" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="student">
                    <div className="flex items-center gap-2">
                      <UserCircle className="h-4 w-4" />
                      <span>학생 (공부하러 왔어요)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="teacher">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      <span>선생님 (학생을 관리할게요)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
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
              <FormControl><Input placeholder="코드 입력" {...field} /></FormControl>
              <FormDescription className="text-[10px]">
                {form.watch('role') === 'teacher' 
                  ? '선생님용 코드를 입력하세요 (테스트: T0313)' 
                  : '학생용 코드를 입력하세요 (테스트: 0313)'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full h-12 rounded-xl font-bold mt-2" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoading ? '가입 중...' : '가입 및 센터 참여'}
        </Button>
      </form>
      <div className="mt-4 text-center text-sm">
        이미 계정이 있으신가요? <Link href="/login" className="underline">로그인</Link>
      </div>
    </Form>
  );
}
