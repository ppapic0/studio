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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/firebase';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { trackMarketingClientEvent } from '@/lib/marketing-tracking-client';
import { Loader2, Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const formSchema = z.object({
  email: z.string().email({
    message: '유효한 이메일 주소를 입력해주세요.',
  }),
  password: z.string().min(6, {
    message: '비밀번호는 6자 이상이어야 합니다.',
  }),
});

const resetSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력해주세요.'),
});

export function LoginForm() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isResetSending, setIsResetSending] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const resetForm = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth) return;
    setIsLoading(true);
    try {
      const trimmedEmail = values.email.trim();
      await signInWithEmailAndPassword(auth, trimmedEmail, values.password);
      await trackMarketingClientEvent({
        eventType: 'login_success',
        pageType: 'login',
        target: 'login',
        extra: {
          emailDomain: trimmedEmail.includes('@') ? trimmedEmail.split('@')[1] : null,
        },
      });
      router.replace('/dashboard');
    } catch (error: any) {
      console.error('Login failed:', error);
      let errorMessage = '오류가 발생했습니다. 다시 시도해 주세요.';

      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다.';
      }

      toast({
        variant: 'destructive',
        title: '로그인 실패',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function onResetSubmit(values: z.infer<typeof resetSchema>) {
    if (!auth) return;

    const email = values.email.trim();
    setIsResetSending(true);

    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: '재설정 메일 전송 완료',
        description: `${email} 주소로 비밀번호 재설정 링크를 보냈습니다.`,
      });
      setIsResetOpen(false);
      resetForm.reset({ email: '' });
    } catch (error: any) {
      console.error('Password reset failed:', error);

      const code = String(error?.code || '').toLowerCase();
      const rawMessage = String(error?.message || '').replace(/^FirebaseError:\s*/i, '').trim();
      let message = '재설정 메일 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

      if (code === 'auth/invalid-email') {
        message = '이메일 형식을 다시 확인해 주세요.';
      } else if (code === 'auth/network-request-failed') {
        message = '네트워크 연결을 확인한 뒤 다시 시도해 주세요.';
      } else if (code === 'auth/too-many-requests') {
        message = '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
      } else if (code === 'auth/user-not-found') {
        message = '가입된 이메일이라면 재설정 링크가 전송됩니다. 메일함을 확인해 주세요.';
      } else if (code === 'auth/operation-not-allowed') {
        message = '현재 프로젝트에서 이메일 비밀번호 재설정 기능이 비활성화되어 있습니다. 관리자 설정을 확인해 주세요.';
      } else if (rawMessage && !/\binternal\b/i.test(rawMessage)) {
        message = rawMessage;
      }

      toast({
        variant: 'destructive',
        title: '재설정 메일 전송 실패',
        description: message,
      });
    } finally {
      setIsResetSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">이메일</FormLabel>
                <FormControl>
                  <Input placeholder="name@example.com" {...field} disabled={isLoading} className="rounded-xl h-12" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center">
                  <FormLabel className="font-bold">비밀번호</FormLabel>

                  <Dialog
                    open={isResetOpen}
                    onOpenChange={(open) => {
                      setIsResetOpen(open);
                      if (open) {
                        resetForm.reset({ email: form.getValues('email') || '' });
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="ml-auto inline-block text-xs underline font-bold text-muted-foreground"
                      >
                        비밀번호를 잊으셨나요?
                      </button>
                    </DialogTrigger>
                    <DialogContent className="rounded-2xl border-none shadow-2xl">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-black tracking-tight">비밀번호 재설정</DialogTitle>
                        <DialogDescription className="font-bold">
                          가입한 이메일 주소를 입력하면 재설정 링크를 보내드립니다.
                        </DialogDescription>
                      </DialogHeader>

                      <Form {...resetForm}>
                        <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
                          <FormField
                            control={resetForm.control}
                            name="email"
                            render={({ field: resetField }) => (
                              <FormItem>
                                <FormLabel className="font-bold">이메일</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/40" />
                                    <Input
                                      placeholder="name@example.com"
                                      {...resetField}
                                      disabled={isResetSending}
                                      className="h-12 rounded-xl border-2 pl-10"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <DialogFooter>
                            <Button type="submit" className="h-12 w-full rounded-xl font-black" disabled={isResetSending}>
                              {isResetSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              {isResetSending ? '전송 중...' : '재설정 메일 보내기'}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
                <FormControl>
                  <Input type="password" {...field} disabled={isLoading} className="rounded-xl h-12" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 h-14 rounded-2xl font-black text-lg shadow-xl mt-2 transition-all active:scale-95" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                로그인 중...
              </>
            ) : '로그인'}
          </Button>
        </form>
        <div className="mt-4 text-center text-sm font-bold text-muted-foreground">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="underline font-black text-primary">
            가입하기
          </Link>
        </div>
      </Form>
    </div>
  );
}
