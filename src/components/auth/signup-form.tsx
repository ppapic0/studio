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
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCircle, GraduationCap } from 'lucide-react';

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
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');

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
    if (!auth || !firestore) return;
    setIsLoading(true);
    
    try {
      // 1. 계정 생성
      setLoadingStatus('계정 생성 중...');
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: values.displayName });

      const centerId = 'learning-lab-dongbaek'; 
      const timestamp = serverTimestamp();

      // 2. 프로필 정보 저장
      setLoadingStatus('프로필 정보 등록 중...');
      await setDoc(doc(firestore, 'users', user.uid), {
        id: user.uid,
        email: values.email,
        displayName: values.displayName,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      // 3. 센터 정보 존재 확인 및 생성
      setLoadingStatus('센터 연결 설정 중...');
      const centerRef = doc(firestore, 'centers', centerId);
      const centerSnap = await getDoc(centerRef);
      if (!centerSnap.exists()) {
        await setDoc(centerRef, {
          id: centerId,
          name: "공부트랙 동백센터",
          subscriptionTier: "Pro",
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      // 4. 멤버십 문서 생성 (보안 규칙 필수 경로)
      await setDoc(doc(firestore, 'centers', centerId, 'members', user.uid), {
        id: user.uid,
        centerId: centerId,
        role: values.role,
        status: "active",
        joinedAt: timestamp,
        displayName: values.displayName,
      });

      // 5. 사용자 센터 역인덱스 생성 (AuthGuard 감지용)
      await setDoc(doc(firestore, 'userCenters', user.uid, 'centers', centerId), {
        id: centerId,
        centerId: centerId,
        role: values.role,
        status: "active",
        joinedAt: timestamp,
      });

      // 6. 학생일 경우 추가 데이터 초기화
      if (values.role === 'student') {
        setLoadingStatus('학습 성장 로드맵 생성 중...');
        await setDoc(doc(firestore, 'centers', centerId, 'growthProgress', user.uid), {
          level: 1,
          currentXp: 0,
          nextLevelXp: 1000,
          stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 },
          skills: {},
          updatedAt: timestamp,
        });
      }

      setLoadingStatus('완료! 대시보드로 이동합니다.');
      toast({ title: '가입 성공', description: '환영합니다!' });
      
      // 즉시 페이지 이동
      window.location.href = '/dashboard';

    } catch (error: any) {
      console.error('Signup Error:', error);
      toast({
        variant: 'destructive',
        title: '가입 실패',
        description: error.message || '오류가 발생했습니다.',
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
                  <SelectTrigger className="h-12 rounded-xl border-2">
                    <SelectValue placeholder="역할을 선택하세요" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="student">학생</SelectItem>
                  <SelectItem value="teacher">선생님</SelectItem>
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
              <FormControl><Input placeholder="코드 입력" {...field} className="h-12 rounded-xl border-2" /></FormControl>
              <FormDescription className="text-[10px] font-black text-primary bg-primary/5 p-2 rounded-lg">
                {form.watch('role') === 'teacher' 
                  ? '💡 선생님용 테스트 코드: T0313' 
                  : '💡 학생용 테스트 코드: 0313'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

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