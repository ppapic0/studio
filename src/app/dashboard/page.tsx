'use client';

import { useState, useEffect } from 'react';
import { StudentDashboard } from '@/components/dashboard/student-dashboard';
import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { Loader2, RefreshCw, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { redeemInviteCodeAction } from '@/lib/membership-actions';
import { useToast } from '@/hooks/use-toast';

const inviteFormSchema = z.object({
  inviteCode: z.string().min(1, '코드를 입력해주세요.'),
});

export default function DashboardPage() {
  const { user } = useUser();
  const { activeMembership, membershipsLoading } = useAppContext();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingGrace, setIsCheckingGrace] = useState(true);

  // 가입 직후 데이터 전파 지연을 대비해 3초간은 로딩 유지
  useEffect(() => {
    const timer = setTimeout(() => setIsCheckingGrace(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const form = useForm<z.infer<typeof inviteFormSchema>>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { inviteCode: '' },
  });

  async function onInviteSubmit(values: z.infer<typeof inviteFormSchema>) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const result = await redeemInviteCodeAction(user.uid, values.inviteCode, user.displayName || '사용자');
      if (result.ok) {
        toast({ title: '가입 성공', description: result.message });
        window.location.reload();
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: '가입 실패', description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  // 로딩 상태 (멤버십 로딩 중이거나 가입 직후 대기 시간인 경우)
  if (membershipsLoading || (isCheckingGrace && !activeMembership)) {
    return (
      <div className="flex flex-col h-[70vh] w-full items-center justify-center gap-6">
        <div className="relative">
          <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
          <Compass className="h-12 w-12 text-primary absolute inset-0 animate-pulse" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-xl font-black text-primary tracking-tighter">프로필 정보를 불러오는 중입니다</p>
          <p className="text-sm font-bold text-muted-foreground italic">잠시만 기다려주시면 대시보드가 준비됩니다...</p>
        </div>
      </div>
    );
  }

  // 확실히 멤버십이 없는 경우
  if (!activeMembership) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-10 text-center px-4">
        <div className="space-y-4">
          <div className="bg-primary/10 p-6 rounded-[2.5rem] w-fit mx-auto shadow-inner">
            <RefreshCw className="h-12 w-12 text-primary animate-spin-slow" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tighter">아직 소속된 센터가 없습니다</h1>
            <p className="text-muted-foreground font-bold max-w-sm mx-auto leading-relaxed">
              가입을 완료하셨다면 잠시 후 자동으로 전환됩니다.<br/>
              변화가 없다면 아래 버튼을 눌러주세요.
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
                <DialogDescription className="font-bold pt-2">센터 관리자로부터 받은 4자리 이상의 코드를 입력하세요.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onInviteSubmit)} className="space-y-6 pt-4">
                  <FormField
                    control={form.control}
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
                      {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : '센터 가입하기'}
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

  const userRole = activeMembership.role;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <h1 className="text-4xl font-black tracking-tighter">
          {user?.displayName}님, {userRole === 'teacher' ? '선생님' : '학생'} 모드
        </h1>
        <Badge variant="secondary" className="h-7 px-3 rounded-full font-black bg-primary text-white border-none uppercase tracking-tighter">
          {userRole}
        </Badge>
      </div>
      <p className="text-muted-foreground font-bold italic mb-8 ml-1">공부트랙 동백센터의 실시간 지표를 분석 중입니다.</p>
      
      <div className="flex flex-col gap-8">
        <StudentDashboard isActive={userRole === 'student'} />
        <TeacherDashboard isActive={userRole === 'teacher'} />
        <AdminDashboard isActive={userRole === 'centerAdmin'} />
      </div>
    </div>
  );
}