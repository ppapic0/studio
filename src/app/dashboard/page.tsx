'use client';

import { useState, useEffect } from 'react';
import { StudentDashboard } from '@/components/dashboard/student-dashboard';
import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { useUser, useFunctions } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { Loader2, RefreshCw, Compass, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';

const inviteFormSchema = z.object({
  inviteCode: z.string().min(1, '코드를 입력해주세요.'),
});

export default function DashboardPage() {
  const { user } = useUser();
  const functions = useFunctions();
  const { activeMembership, membershipsLoading } = useAppContext();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNoCenterUI, setShowNoCenterUI] = useState(false);

  // 로딩이 끝났는데도 멤버십이 없으면 3초 후에 "센터 없음" UI를 보여줍니다.
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!membershipsLoading && !activeMembership) {
      timer = setTimeout(() => setShowNoCenterUI(true), 3000);
    } else if (activeMembership) {
      setShowNoCenterUI(false);
    }
    return () => clearTimeout(timer);
  }, [membershipsLoading, activeMembership]);

  const form = useForm<z.infer<typeof inviteFormSchema>>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { inviteCode: '' },
  });

  async function onInviteSubmit(values: z.infer<typeof inviteFormSchema>) {
    if (!user || !functions) return;
    setIsSubmitting(true);
    try {
      const redeemFn = httpsCallable(functions, 'redeemInviteCode');
      const result: any = await redeemFn({ code: values.inviteCode });
      
      if (result.data.ok) {
        toast({ title: '가입 성공', description: result.data.message });
        window.location.reload();
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: '가입 실패', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  // 1. 정보를 불러오는 중일 때
  if (membershipsLoading && !activeMembership) {
    return (
      <div className="flex flex-col h-[70vh] w-full items-center justify-center gap-6">
        <div className="relative">
          <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
          <Compass className="h-12 w-12 text-primary absolute inset-0 animate-pulse" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-xl font-black text-primary tracking-tighter">정보를 동기화하고 있습니다</p>
          <p className="text-sm font-bold text-muted-foreground italic">센터 정보를 안전하게 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  // 2. 소속된 센터가 없을 때 (로딩 완료 후 잠시 대기 후 노출)
  if (!activeMembership && showNoCenterUI) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-10 text-center px-4">
        <div className="space-y-4">
          <div className="bg-primary/10 p-6 rounded-[2.5rem] w-fit mx-auto shadow-inner">
            <ShieldAlert className="h-12 w-12 text-primary animate-bounce" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tighter">소속된 센터가 없습니다</h1>
            <p className="text-muted-foreground font-bold max-w-sm mx-auto leading-relaxed">
              정보가 나타나지 않으면 '다시 확인'을 눌러주세요.<br/>
              아직 가입 전이라면 초대 코드를 입력해 보세요.
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <Button 
            variant="outline" 
            size="lg" 
            className="flex-1 h-16 rounded-2xl text-lg font-black border-2 shadow-sm"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-2 h-5 w-5" /> 다시 확인
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" className="flex-1 h-16 rounded-2xl text-lg font-black shadow-xl">초대 코드로 가입</Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] p-8 border-none shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-3xl font-black tracking-tighter">초대 코드 입력</DialogTitle>
                <DialogDescription className="font-bold pt-2">센터에서 제공받은 코드를 입력하여 가입을 완료하세요.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onInviteSubmit)} className="space-y-6 pt-4">
                  <FormField
                    name="inviteCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-black text-xs uppercase tracking-widest text-primary/70">코드를 입력하세요</FormLabel>
                        <FormControl><Input placeholder="예: 0313" {...field} className="h-14 rounded-xl border-2 text-xl font-black tracking-widest" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmitting} className="w-full h-14 rounded-2xl font-black text-lg shadow-lg">
                      {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : '멤버십 생성하기'}
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

  // 3. 멤버십이 확인되었을 때 (대시보드 표시)
  if (activeMembership) {
    const userRole = activeMembership.role;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-black tracking-tighter">
            {user?.displayName}님, {userRole === 'teacher' ? '선생님' : '학생'} 대시보드
          </h1>
          <Badge variant="secondary" className="h-7 px-3 rounded-full font-black bg-primary text-white border-none uppercase tracking-tighter">
            {userRole}
          </Badge>
        </div>
        <p className="text-muted-foreground font-bold italic mb-8 ml-1">센터의 데이터를 실시간으로 모니터링 중입니다.</p>
        
        <div className="flex flex-col gap-8">
          <StudentDashboard isActive={userRole === 'student'} />
          <TeacherDashboard isActive={userRole === 'teacher'} />
          <AdminDashboard isActive={userRole === 'centerAdmin'} />
        </div>
      </div>
    );
  }

  // 기본 상태 (로딩 중)
  return (
    <div className="flex flex-col h-[70vh] w-full items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
    </div>
  );
}