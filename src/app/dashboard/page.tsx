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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

  if (membershipsLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!activeMembership) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">센터에 오신 것을 환영합니다!</h1>
        <p className="text-muted-foreground">시작하려면 센터에 가입하거나 새로 만들어야 합니다.</p>
        <div className="flex gap-4">
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">초대 코드로 가입하기</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>초대 코드 입력</DialogTitle>
                <DialogDescription>관리자에게 받은 초대 코드를 입력해 주세요. (예: 0313)</DialogDescription>
              </DialogHeader>
              <Form {...inviteForm}>
                <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)} className="space-y-4">
                  <FormField
                    control={inviteForm.control}
                    name="inviteCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>초대 코드</FormLabel>
                        <FormControl><Input placeholder="0313" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      가입하기
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDevJoinDialogOpen} onOpenChange={setIsDevJoinDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="lg">개발자용 강제 가입</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>테스트용 센터 가입</DialogTitle>
                <DialogDescription>초대 코드 없이 즉시 센터를 생성하고 가입합니다.</DialogDescription>
              </DialogHeader>
              <Form {...devJoinForm}>
                <form onSubmit={devJoinForm.handleSubmit(onDevJoinSubmit)} className="space-y-4">
                  <FormField
                    control={devJoinForm.control}
                    name="centerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>센터 ID</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
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
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                        <FormControl><Input type="password" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={isSubmitting}>강제 가입</Button>
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
    <>
      <h1 className="text-3xl font-headline font-bold tracking-tight">
        {user?.displayName}님, 반갑습니다!
      </h1>
      <p className="text-muted-foreground">공부트랙 동백센터의 오늘 현황입니다.</p>
      <div className="mt-4 flex flex-col gap-4">
        <StudentDashboard isActive={userRole === 'student'} />
        <TeacherDashboard isActive={userRole === 'teacher'} />
        <AdminDashboard isActive={userRole === 'centerAdmin'} />
      </div>
    </>
  );
}