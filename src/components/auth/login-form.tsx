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
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Monitor, Smartphone } from 'lucide-react';
import { useAppContext } from '@/contexts/app-context';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  email: z.string().email({
    message: '유효한 이메일 주소를 입력해주세요.',
  }),
  password: z.string().min(6, {
    message: '비밀번호는 6자 이상이어야 합니다.',
  }),
});

export function LoginForm() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const { viewMode, setViewMode } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!auth) return;
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      // router.replace를 사용하여 인증 상태 변경 후 AuthGuard가 자연스럽게 대시보드로 이동시키도록 합니다.
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

  return (
    <div className="flex flex-col gap-6">
      {/* 접속 모드 선택 섹션 */}
      <div className="space-y-3">
        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">접속 모드 선택</label>
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-muted/40 rounded-2xl border border-border/50">
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "rounded-xl h-12 font-black gap-2 transition-all duration-300",
              viewMode === 'responsive' 
                ? "bg-white shadow-md text-primary ring-1 ring-black/[0.05]" 
                : "text-muted-foreground/50 hover:text-primary hover:bg-white/50"
            )}
            onClick={() => setViewMode('responsive')}
          >
            <Monitor className={cn("h-4 w-4", viewMode === 'responsive' ? "text-primary" : "opacity-40")} />
            웹모드
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "rounded-xl h-12 font-black gap-2 transition-all duration-300",
              viewMode === 'mobile' 
                ? "bg-white shadow-md text-primary ring-1 ring-black/[0.05]" 
                : "text-muted-foreground/50 hover:text-primary hover:bg-white/50"
            )}
            onClick={() => setViewMode('mobile')}
          >
            <Smartphone className={cn("h-4 w-4", viewMode === 'mobile' ? "text-primary" : "opacity-40")} />
            앱모드
          </Button>
        </div>
      </div>

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
                  <Link
                    href="#"
                    className="ml-auto inline-block text-xs underline font-bold text-muted-foreground"
                  >
                    비밀번호를 잊으셨나요?
                  </Link>
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
            ) : `${viewMode === 'mobile' ? '앱모드로 ' : '웹모드로 '}로그인`}
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
