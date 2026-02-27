'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useForm } from 'react-hook-form';

import { StudentDashboard } from '@/components/dashboard/student-dashboard';
import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/contexts/app-context';
import { Loader2 } from 'lucide-react';
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
        // onSnapshot 리스너가 작동하므로 강제 새로고침 불필요
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

  // 멤버십 확인 중이면 로딩 표시
  if (membershipsLoading) {
    return (
      <div className="flex flex-col h-[60vh] w-full items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-bold text-muted-foreground">멤버십 정보를 불러오는 중...</p>
      </div>
    );
  }

  // 로그인 상태인데 가입된 센터가 없는 경우
  if (!activeMembership) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-8 text-center px-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tighter">센터에 오신 것을 환영합니다!</h1>
          <p className="text-muted-foreground font-bold">시작하려면 초대 코드로 가입하거나 테스트 센터에 접속하세요.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
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

          <Dialog open={isDevJoinDialogOpen} onOpenChange={setIsDevJoinDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="lg" className="flex-1 h-16 rounded-2xl text-lg font-black border-2">개발자 전용</Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2rem]">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black">테스트용 강제 가입</DialogTitle>
                <DialogDescription className="font-bold">초대 코드 없이 즉시 관리자 권한을 획득합니다.</DialogDescription>
              </DialogHeader>
              <Form {...devJoinForm}>
                <form onSubmit={devJoinForm.handleSubmit(onDevJoinSubmit)} className="space-y-4">
                  <FormField
                    control={devJoinForm.control}
                    name="centerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>센터 ID</FormLabel>
                        <FormControl><Input {...field} className="h-12 rounded-xl" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={devJoinForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>역할</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="centerAdmin">센터 관리자</SelectItem>
                            <SelectItem value="teacher">교사</SelectItem>
                            <SelectItem value="student">학생</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={devJoinForm.control}
                    name="devSecret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>개발용 비밀 키</FormLabel>
                        <FormControl><Input type="password" {...field} className="h-12 rounded-xl" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmitting} className="w-full h-12 rounded-xl font-black">
                      {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : '즉시 가입'}
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

  // 가입된 센터가 있을 경우 역할에 맞는 대시보드 표시
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
