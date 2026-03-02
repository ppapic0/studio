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
import { doc, setDoc, serverTimestamp, writeBatch, collection, query, where, getDocs, getDoc, increment } from 'firebase/firestore';
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
  inviteCode: z.string().min(1, '초대 코드를 입력해주세요.'),
  parentLinkCode: z.string().optional(), 
  studentLinkCode: z.string().optional(), 
}).refine((data) => data.password === data.confirmPassword, {
  message: "비밀번호가 일치하지 않습니다.",
  path: ["confirmPassword"],
});

export function SignupForm() {
  const auth = useAuth();
  const firestore = useFirestore();
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
      studentLinkCode: ''
    },
  });

  const selectedRole = form.watch('role');

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth || !firestore) return;
    
    if (values.role === 'student') {
      if (!values.displayName || values.displayName.length < 2) {
        form.setError('displayName', { message: '이름을 입력해주세요.' });
        return;
      }
      if (!values.schoolName || values.schoolName.length < 2) {
        form.setError('schoolName', { message: '학교명을 입력해주세요.' });
        return;
      }
      if (!values.parentLinkCode || values.parentLinkCode.length !== 4) {
        form.setError('parentLinkCode', { message: '부모님 연동을 위한 4자리 숫자를 입력해주세요.' });
        return;
      }
    }

    if (values.role === 'parent' && (!values.studentLinkCode || values.studentLinkCode.length !== 4)) {
      form.setError('studentLinkCode', { message: '자녀의 4자리 연동 코드를 입력해주세요.' });
      return;
    }

    if ((values.role === 'teacher' || values.role === 'centerAdmin') && (!values.displayName || values.displayName.length < 2)) {
      form.setError('displayName', { message: '이름을 입력해주세요.' });
      return;
    }

    setIsLoading(true);
    
    try {
      setLoadingStatus('초대 코드를 검증하고 있습니다...');
      const inviteRef = doc(firestore, 'inviteCodes', values.inviteCode);
      const inviteSnap = await getDoc(inviteRef);

      if (!inviteSnap.exists()) {
        setIsLoading(false);
        setLoadingStatus('');
        form.setError('inviteCode', { message: '존재하지 않거나 유효하지 않은 초대 코드입니다.' });
        return;
      }

      const inviteData = inviteSnap.data();
      
      if (inviteData.intendedRole !== values.role) {
        setIsLoading(false);
        setLoadingStatus('');
        const roleNames = { student: '학생', teacher: '선생님', parent: '학부모', centerAdmin: '센터 관리자' };
        const intendedRoleName = roleNames[inviteData.intendedRole as keyof typeof roleNames] || inviteData.intendedRole;
        form.setError('inviteCode', { 
          message: `입력하신 코드는 [${intendedRoleName}] 전용 코드입니다. 선택하신 역할과 일치하지 않습니다.` 
        });
        return;
      }

      if (inviteData.isActive === false) {
        setIsLoading(false);
        setLoadingStatus('');
        form.setError('inviteCode', { message: '현재 비활성화된 초대 코드입니다.' });
        return;
      }

      if (inviteData.usedCount >= inviteData.maxUses) {
        setIsLoading(false);
        setLoadingStatus('');
        form.setError('inviteCode', { message: '이미 최대 사용 횟수에 도달한 코드입니다.' });
        return;
      }

      const centerId = inviteData.centerId; 
      const targetClassName = inviteData.targetClassName || null;
      const timestamp = serverTimestamp();
      const batch = writeBatch(firestore);
      let finalDisplayName = values.displayName || '';
      let linkedStudentId = '';

      if (values.role === 'parent') {
        setLoadingStatus('자녀 정보를 확인하고 있습니다...');
        const studentsRef = collection(firestore, 'centers', centerId, 'students');
        const q = query(studentsRef, where('parentLinkCode', '==', values.studentLinkCode));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const studentDoc = querySnapshot.docs[0];
          linkedStudentId = studentDoc.id;
          const studentData = studentDoc.data();
          finalDisplayName = `${studentData.name} 학부모`;
        } else {
          setIsLoading(false);
          setLoadingStatus('');
          form.setError('studentLinkCode', { message: '해당 코드를 사용하는 학생을 찾을 수 없습니다.' });
          return;
        }
      }

      setLoadingStatus('계정 생성 중...');
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: finalDisplayName });

      batch.set(doc(firestore, 'users', user.uid), {
        id: user.uid,
        email: values.email,
        displayName: finalDisplayName,
        schoolName: values.schoolName || '',
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      const membershipData: any = {
        id: user.uid,
        centerId: centerId,
        role: values.role,
        status: "active",
        className: targetClassName,
        joinedAt: timestamp,
        displayName: finalDisplayName,
      };

      if (values.role === 'student') {
        batch.set(doc(firestore, 'centers', centerId, 'students', user.uid), {
          id: user.uid,
          name: finalDisplayName,
          schoolName: values.schoolName || '',
          grade: '고등학생',
          className: targetClassName,
          seatNo: 0,
          targetDailyMinutes: 360,
          parentUids: [],
          parentLinkCode: values.parentLinkCode,
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

      if (values.role === 'parent' && linkedStudentId) {
        membershipData.linkedStudentIds = [linkedStudentId];
        batch.update(doc(firestore, 'centers', centerId, 'students', linkedStudentId), {
          parentUids: [user.uid]
        });
      }

      batch.set(doc(firestore, 'centers', centerId, 'members', user.uid), membershipData);
      batch.set(doc(firestore, 'userCenters', user.uid, 'centers', centerId), {
        id: centerId,
        centerId: centerId,
        role: values.role,
        status: "active",
        className: targetClassName,
        joinedAt: timestamp,
        ...(membershipData.linkedStudentIds ? { linkedStudentIds: membershipData.linkedStudentIds } : {})
      });

      batch.update(inviteRef, {
        usedCount: increment(1),
        updatedAt: timestamp
      });

      await batch.commit();

      setLoadingStatus('완료! 대시보드로 이동합니다.');
      toast({ title: '가입 성공', description: `환영합니다, ${finalDisplayName}님!` });
      
      setTimeout(() => {
        router.replace('/dashboard');
      }, 500);

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
                  <FormControl><Input placeholder="4자리 숫자" maxLength={4} {...field} className="h-12 rounded-xl border-2 font-black tracking-[0.5em] text-center" disabled={isLoading} /></FormControl>
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
                <FormControl><Input placeholder="자녀가 설정한 4자리 숫자" maxLength={4} {...field} className="h-12 rounded-xl border-2 font-black tracking-[0.5em] text-center" disabled={isLoading} /></FormControl>
                <FormDescription className="text-[10px] font-bold">자녀에게 물어보고 4자리 코드를 입력해 주세요.</FormDescription>
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
              <FormLabel className="font-bold">센터 가입 코드</FormLabel>
              <FormControl><Input placeholder="센터에서 제공받은 코드" {...field} className="h-12 rounded-xl border-2" disabled={isLoading} /></FormControl>
              <FormDescription className="text-[10px] font-black text-primary bg-primary/5 p-2 rounded-lg">
                💡 반드시 선택하신 가입 역할에 맞는 코드를 입력해야 합니다.
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
