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
import { doc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  displayName: z.string().min(2, '이름은 2자 이상이어야 합니다.'),
  email: z.string().email('유효한 이메일을 입력해주세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
  role: z.enum(['student', 'teacher'], {
    required_error: '역할을 선택해주세요.',
  }),
  schoolName: z.string().optional().refine((val) => {
    // 학생일 때만 학교명 필수
    return true; 
  }, { message: '학교명을 입력해주세요.' }),
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
      schoolName: '',
      inviteCode: '' 
    },
  });

  const selectedRole = form.watch('role');

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth || !firestore) return;
    
    // 추가 검증: 학생이면 학교명 필수
    if (values.role === 'student' && (!values.schoolName || values.schoolName.length < 3)) {
      form.setError('schoolName', { message: '학교명을 풀네임으로 입력해주세요 (예: 000고등학교)' });
      return;
    }

    setIsLoading(true);
    
    try {
      setLoadingStatus('계정 생성 중...');
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: values.displayName });

      const centerId = 'learning-lab-dongbaek'; 
      const timestamp = serverTimestamp();

      setLoadingStatus('멤버십 정보를 설정하고 있습니다...');
      
      const batch = writeBatch(firestore);

      // 1. 프로필
      batch.set(doc(firestore, 'users', user.uid), {
        id: user.uid,
        email: values.email,
        displayName: values.displayName,
        schoolName: values.schoolName || '',
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      // 2. 센터 정보 (Merge)
      batch.set(doc(firestore, 'centers', centerId), {
        id: centerId,
        name: "공부트랙 동백센터",
        subscriptionTier: "Pro",
        createdAt: timestamp,
        updatedAt: timestamp,
      }, { merge: true });

      // 3. 멤버십 정보
      batch.set(doc(firestore, 'centers', centerId, 'members', user.uid), {
        id: user.uid,
        centerId: centerId,
        role: values.role,
        status: "active",
        joinedAt: timestamp,
        displayName: values.displayName,
      });

      // 4. 역인덱스 (AuthGuard 감지용)
      batch.set(doc(firestore, 'userCenters', user.uid, 'centers', centerId), {
        id: centerId,
        centerId: centerId,
        role: values.role,
        status: "active",
        joinedAt: timestamp,
      });

      // 5. 학생일 경우 상세 프로필 및 성장 로드맵 초기화
      if (values.role === 'student') {
        batch.set(doc(firestore, 'centers', centerId, 'students', user.uid), {
          id: user.uid,
          name: values.displayName,
          schoolName: values.schoolName || '',
          grade: '고등학생', // 기본값
          seatNo: 0,
          targetDailyMinutes: 360,
          parentUids: [],
          createdAt: timestamp,
        });

        batch.set(doc(firestore, 'centers', centerId, 'growthProgress', user.uid), {
          level: 1,
          currentXp: 0,
          nextLevelXp: 1000,
          stats: { focus: 0, consistency: 0, achievement: 0, resilience: 0 },
          skills: {},
          updatedAt: timestamp,
        });
      }

      await batch.commit();

      setLoadingStatus('완료! 대시보드로 이동합니다.');
      toast({ title: '가입 성공', description: '잠시 후 대시보드가 열립니다.' });
      
      // 즉시 새로고침 리디렉션
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

        {selectedRole === 'student' && (
          <FormField
            control={form.control}
            name="schoolName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>소속 학교</FormLabel>
                <FormControl><Input placeholder="예: 동백고등학교" {...field} className="h-12 rounded-xl border-2" /></FormControl>
                <FormDescription className="text-[10px]">반드시 "OOO고등학교"까지 풀네임으로 적어주세요.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

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