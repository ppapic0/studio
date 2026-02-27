
'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useForm } from 'react-hook-form';

import { StudentDashboard } from '@/components/dashboard/student-dashboard';
import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/contexts/app-context';
import { Loader2, RefreshCw } from 'lucide-react';
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
import {
  Form,
  FormControl,
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
import { redeemInviteCodeAction, devJoinCenterAction } from '@/lib/membership-actions';

const inviteCodeFormSchema = z.object({
  inviteCode: z.string().min(1, '초대 코드를 입력해주세요.'),
});

const devJoinFormSchema = z.object({
  centerId: z.string().min(1, '센터 ID가 필요합니다.'),
  role: z.enum(['student', 'teacher', 'centerAdmin']),
  devSecret: z.string().min(1, '개발용 비밀 키가 필요합니다.'),
});

export default function DashboardPage() {
  const { user } = useUser();
  const { activeMembership, membershipsLoading } = useAppContext();
  const { toast } = useToast();

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isDevJoinDialogOpen, setIsDevJoinDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 가입 직후 레이스 컨디션을 방지하기 위한 추가 로딩 상태
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    // 페이지 진입 후 2초간은 멤버십 데이터를 찾기 위해 기다림
    const timer = setTimeout(() => {
      setIsVerifying(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const inviteForm = useForm<z.infer<typeof inviteCodeFormSchema>>({
    resolver: zodResolver(inviteCodeFormSchema),
    defaultValues: { inviteCode: '' },
  });

  const devJoinForm = useForm<z.infer<typeof devJoinFormSchema>>({
    resolver: zodResolver(devJoinFormSchema),
    defaultValues: {
      centerId: 'learning-lab-dongbaek',
      role: 'centerAdmin',
      devSecret: '',
    },
  });

  async function onInviteSubmit(values: z.infer<typeof inviteCodeFormSchema>) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const result = await redeemInviteCodeAction(user.uid, values.inviteCode, user.displayName || '사용자');
      if (result.ok) {
        toast({ title: '가입 성공', description: result.message });
        window.location.reload();
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '가입 실패',
        description: error.message || '초대 코드가 유효하지 않습니다.',
      });
    } finally {
      setIsSubmitting(false);
      setIsInviteDialogOpen(false);
    }
  }

  async function onDevJoinSubmit(values: z.infer<typeof devJoinFormSchema>) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const result = await devJoinCenterAction({ ...values, uid: user.uid });
      if (result.ok) {
        toast({ title: '강제 가입 성공', description: result.message });
        window.location.reload();
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '강제 가입 실패',
        description: error.message || '오류가 발생했습니다.',
      });
    } finally {
      setIsSubmitting(false);
      setIsDevJoinDialogOpen(false);
    }
  }

  // 멤버십 확인 중이거나 가입 직후 검증 중이면 로딩 표시
  if (membershipsLoading || (isVerifying && !activeMembership)) {
    return (
      <div className="flex flex-col h-[60vh] w-full items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-base font-black text-primary">멤버십 정보를 확인하고 있습니다</p>
          <p className="text-xs font-bold text-muted-foreground mt-1">잠시만 기다려주세요...</p>
        </div>
      </div>
    );
  }

  // 가입된 센터가 없는 경우 (확실히 확인된 후)
  if (!activeMembership) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-8 text-center px-4">
        <div className="space-y-4">
          <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto">
            <RefreshCw className="h-10 w-10 text-primary animate-pulse" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tighter">센터 정보를 찾을 수 없습니다</h1>
            <p className="text-muted-foreground font-bold max-w-md mx-auto">
              이미 가입하셨나요? 데이터 반영에 시간이 걸릴 수 있습니다. <br/>
              잠시 후 다시 시도하거나 아래 버튼을 눌러주세요.
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <Button 
            variant="outline" 
            size="lg" 
            className="flex-1 h-16 rounded-2xl text-lg font-black border-2"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-2 h-5 w-5" /> 다시 확인
          </Button>

          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="flex-1 h-16 rounded-2xl text-lg font-black shadow-xl">초대 코드로 가입</Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2rem]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">초대 코드 입력</DialogTitle>
                <DialogDescription className="font-bold">관리자에게 받은 코드를 입력하여 센터에 가입합니다.</DialogDescription>
              </DialogHeader>
              <Form {...inviteForm}>
                <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)} className="space-y-4">
                  <FormField
                    control={inviteForm.control}
                    name="inviteCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>초대 코드</FormLabel>
                        <FormControl><Input placeholder="0313 또는 T0313" {...field} className="h-12 rounded-xl" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-xl font-black text-lg">
                      {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : '가입하기'}
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

  // 정상적으로 가입된 경우 역할에 맞는 대시보드 표시
  const userRole = activeMembership.role;
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl font-black tracking-tighter">
        {user?.displayName}님, 반갑습니다!
      </h1>
      <p className="text-muted-foreground font-bold italic mb-6">공부트랙 동백센터의 오늘 현황입니다.</p>
      
      <div className="flex flex-col gap-8">
        <StudentDashboard isActive={userRole === 'student'} />
        <TeacherDashboard isActive={userRole === 'teacher'} />
        <AdminDashboard isActive={userRole === 'centerAdmin'} />
      </div>
    </div>
  );
}
