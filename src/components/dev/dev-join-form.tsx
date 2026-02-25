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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { devJoinCenter } from '@/app/actions/dev';
import { useRouter } from 'next/navigation';

const formSchema = z.object({
  centerId: z.string().min(1, '센터 ID를 입력하세요.'),
  role: z.enum(['student', 'teacher', 'parent', 'centerAdmin'], {
    required_error: '역할을 선택하세요.',
  }),
  linkedStudentId: z.string().optional(),
  devSecret: z.string().min(1, '개발용 비밀 키를 입력하세요.'),
});

export function DevJoinForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      centerId: 'center-1',
      role: 'student',
      linkedStudentId: '',
      devSecret: '',
    },
  });

  const role = form.watch('role');

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const result = await devJoinCenter(values);
      if (result.ok) {
        toast({
          title: '성공',
          description: `"${values.centerId}" 센터에 가입되었습니다.`,
        });
        // Force a reload to re-trigger AuthGuard and context updates
        window.location.href = '/app';
      } else {
        throw new Error(result.error || '알 수 없는 오류가 발생했습니다.');
      }
    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: '가입 실패',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
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
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>역할</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="역할을 선택하세요" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="student">학생</SelectItem>
                  <SelectItem value="parent">학부모</SelectItem>
                  <SelectItem value="teacher">교사</SelectItem>
                  <SelectItem value="centerAdmin">센터 관리자</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {role === 'parent' && (
          <FormField
            control={form.control}
            name="linkedStudentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>연결된 학생 ID (선택 사항)</FormLabel>
                <FormControl>
                  <Input placeholder="학생의 UID 입력" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="devSecret"
          render={({ field }) => (
            <FormItem>
              <FormLabel>개발용 비밀 키</FormLabel>
              <FormControl>
                <Input type="password" placeholder="DEV_SECRET" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? '가입 처리 중...' : '센터 가입'}
        </Button>
      </form>
    </Form>
  );
}
