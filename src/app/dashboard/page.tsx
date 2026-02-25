'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { httpsCallable } from 'firebase/functions';

import { StudentDashboard } from '@/components/dashboard/student-dashboard';
import { ParentDashboard } from '@/components/dashboard/parent-dashboard';
import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { useUser, useFunctions } from '@/firebase';
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

const inviteCodeFormSchema = z.object({
  inviteCode: z.string().min(4, {
    message: '초대 코드는 4자 이상이어야 합니다.',
  }),
});

const devJoinFormSchema = z.object({
  centerId: z.string().min(1, '센터 ID가 필요합니다.'),
  role: z.enum(['student', 'teacher', 'parent', 'centerAdmin']),
  devSecret: z.string().min(1, '개발용 비밀 키가 필요합니다.'),
});

export default function DashboardPage() {
  const { user } = useUser();
  const { activeMembership, membershipsLoading } = useAppContext();
  const functions = useFunctions();
  const { toast } = useToast();

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isDevJoinDialogOpen, setIsDevJoinDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userRole = activeMembership?.role;

  const inviteForm = useForm<z.infer<typeof inviteCodeFormSchema>>({
    resolver: zodResolver(inviteCodeFormSchema),
    defaultValues: {
      inviteCode: '',
    },
  });

  const devJoinForm = useForm<z.infer<typeof devJoinFormSchema>>({
    resolver: zodResolver(devJoinFormSchema),
    defaultValues: {
      centerId: 'center-1',
      role: 'centerAdmin',
      devSecret: '',
    },
  });

  async function onInviteSubmit(values: z.infer<typeof inviteCodeFormSchema>) {
    if (!functions) return;
    setIsSubmitting(true);
    try {
      const redeemInviteCode = httpsCallable(functions, 'redeemInviteCode');
      await redeemInviteCode({ code: values.inviteCode });

      toast({
        title: '성공!',
        description: '센터에 오신 것을 환영합니다. 페이지를 새로고침합니다.',
      });

      window.location.reload();
    } catch (error: any) {
      console.error('Invite code redemption failed:', error);
      toast({
        variant: 'destructive',
        title: '가입 실패',
        description:
          error.message || '초대 코드가 유효하지 않거나 오류가 발생했습니다.',
      });
    } finally {
      setIsSubmitting(false);
      setIsInviteDialogOpen(false);
    }
  }

  async function onDevJoinSubmit(values: z.infer<typeof devJoinFormSchema>) {
    if (!functions) return;
    setIsSubmitting(true);
    try {
      const devJoinCenter = httpsCallable(functions, 'devJoinCenter');
      await devJoinCenter(values);
      toast({
        title: '개발자 가입 성공!',
        description:
          `${values.centerId} 센터에 ${values.role} 역할로 가입했습니다.`,
      });
      window.location.reload();
    } catch (error: any) {
      console.error('Dev join failed:', error);
      toast({
        variant: 'destructive',
        title: '개발자 가입 실패',
        description: error.message || '오류가 발생했습니다.',
      });
    } finally {
      setIsSubmitting(false);
      setIsDevJoinDialogOpen(false);
    }
  }

  const renderContent = () => {
    if (membershipsLoading) {
      return (
        <div className="flex h-64 w-full items-center justify-center rounded-lg border">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (!activeMembership) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>센터에 오신 것을 환영합니다!</CardTitle>
            <CardDescription>
              학습을 시작하려면 먼저 센터에 가입해야 합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Dialog
              open={isInviteDialogOpen}
              onOpenChange={setIsInviteDialogOpen}
            >
              <DialogTrigger asChild>
                <Button>초대 코드로 가입하기</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>초대 코드로 가입하기</DialogTitle>
                  <DialogDescription>
                    센터 관리자에게 받은 초대 코드를 입력하세요.
                  </DialogDescription>
                </DialogHeader>
                <Form {...inviteForm}>
                  <form
                    onSubmit={inviteForm.handleSubmit(onInviteSubmit)}
                    className="grid gap-4 py-4"
                  >
                    <FormField
                      control={inviteForm.control}
                      name="inviteCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel htmlFor="inviteCode">초대 코드</FormLabel>
                          <FormControl>
                            <Input
                              id="inviteCode"
                              placeholder="초대 코드를 입력하세요"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        가입하기
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog
              open={isDevJoinDialogOpen}
              onOpenChange={setIsDevJoinDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="secondary">개발자용 가입</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>개발자용 센터 가입</DialogTitle>
                  <DialogDescription>
                    테스트를 위해 특정 역할로 센터에 가입합니다.
                  </DialogDescription>
                </DialogHeader>
                <Form {...devJoinForm}>
                  <form
                    onSubmit={devJoinForm.handleSubmit(onDevJoinSubmit)}
                    className="grid gap-4 py-4"
                  >
                    <FormField
                      control={devJoinForm.control}
                      name="centerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>센터 ID</FormLabel>
                          <FormControl>
                            <Input placeholder="center-1" {...field} />
                          </FormControl>
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
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="역할 선택" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="student">학생</SelectItem>
                              <SelectItem value="teacher">교사</SelectItem>
                              <SelectItem value="parent">학부모</SelectItem>
                              <SelectItem value="centerAdmin">
                                센터 관리자
                              </SelectItem>
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
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        강제 가입
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      );
    }

    return (
      <>
        <StudentDashboard isActive={userRole === 'student'} />
        <ParentDashboard isActive={userRole === 'parent'} />
        <TeacherDashboard isActive={userRole === 'teacher'} />
        <AdminDashboard isActive={userRole === 'centerAdmin'} />
      </>
    );
  };

  return (
    <>
      <h1 className="text-3xl font-headline font-bold tracking-tight">
        {user
          ? `${user.displayName}님, 다시 오신 것을 환영합니다!`
          : '대시보드 로딩 중...'}
      </h1>
      <p className="text-muted-foreground">오늘의 맞춤 개요입니다.</p>
      <div className="mt-4 flex flex-col gap-4">{renderContent()}</div>
    </>
  );
}
