'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  PanelLeft,
  LogOut,
  Smartphone,
  Monitor,
  Settings,
  HelpCircle,
  BookOpen,
  Zap,
  CalendarDays,
  MessageCircle,
  School,
  Loader2,
  Sparkles,
} from 'lucide-react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { MainNav } from './main-nav';
import { NotificationBell } from './notification-bell';
import { useAppContext } from '@/contexts/app-context';
import { useAuth, useDoc, useFirestore, useFunctions, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useToast } from '@/hooks/use-toast';
import { StudentProfile, User as UserType } from '@/lib/types';

function resolveCallableErrorMessage(error: any): string {
  const detailMessage =
    typeof error?.details === 'string'
      ? error.details
      : typeof error?.details?.userMessage === 'string'
        ? error.details.userMessage
        : typeof error?.details?.message === 'string'
          ? error.details.message
          : '';

  const rawMessage = String(error?.message || '').replace(/^FirebaseError:\s*/i, '').trim();
  if (detailMessage) return detailMessage;
  if (rawMessage && !/(functions\/internal|internal)$/i.test(rawMessage)) return rawMessage;

  return '서버 통신 중 오류가 발생했습니다.';
}

function normalizeParentLinkCode(value: unknown): string {
  if (typeof value === 'string') {
    return value.replace(/\D/g, '').slice(0, 6);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value)).replace(/\D/g, '').slice(0, 6);
  }
  return '';
}

export function DashboardHeader() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const functions = useFunctions();
  const router = useRouter();
  const { toast } = useToast();
  const { activeMembership, viewMode, setViewMode } = useAppContext();
  const isMobileView = viewMode === 'mobile';

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSettingsFormInitialized, setIsSettingsFormInitialized] = useState(false);

  const [schoolName, setSchoolName] = useState('');
  const [grade, setGrade] = useState('');
  const [parentLinkCode, setParentLinkCode] = useState('');

  const userRef = firestore && user ? doc(firestore, 'users', user.uid) : null;
  const { data: userProfile } = useDoc<UserType>(userRef as any);

  const studentRef =
    firestore && activeMembership && user
      ? doc(firestore, 'centers', activeMembership.id, 'students', user.uid)
      : null;
  const { data: studentProfile } = useDoc<StudentProfile>(studentRef as any);

  useEffect(() => {
    if (!isSettingsOpen) {
      setIsSettingsFormInitialized(false);
      return;
    }

    if (isSettingsFormInitialized) return;

    if (studentProfile) {
      setSchoolName(studentProfile.schoolName || '');
      setGrade(studentProfile.grade || '');
      setParentLinkCode(normalizeParentLinkCode(studentProfile.parentLinkCode));
      setIsSettingsFormInitialized(true);
      return;
    }

    if (userProfile) {
      setSchoolName(userProfile.schoolName || '');
      setGrade('');
      setParentLinkCode('');
      setIsSettingsFormInitialized(true);
    }
  }, [isSettingsOpen, isSettingsFormInitialized, studentProfile, userProfile]);

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push('/login');
  };

  const handleUpdateSettings = async () => {
    if (!firestore || !user || !activeMembership) return;

    const normalizedSchoolName = schoolName.trim();
    const normalizedGrade = grade.trim();
    const normalizedParentLinkCode = normalizeParentLinkCode(parentLinkCode);
    const currentParentLinkCode = normalizeParentLinkCode(studentProfile?.parentLinkCode);

    if (activeMembership.role === 'student' && normalizedParentLinkCode && !/^\d{6}$/.test(normalizedParentLinkCode)) {
      toast({
        variant: 'destructive',
        title: '입력 확인',
        description: '학부모 연동 코드는 6자리 숫자로 입력해 주세요.',
      });
      return;
    }

    setIsUpdating(true);
    try {
      if (activeMembership.role === 'student') {
        if (!functions) {
          throw new Error('함수 연결이 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.');
        }

        const updateFn = httpsCallable(functions, 'updateStudentAccount');
        const payload: any = {
          studentId: user.uid,
          centerId: activeMembership.id,
          schoolName: normalizedSchoolName,
          grade: normalizedGrade,
        };
        if (normalizedParentLinkCode !== currentParentLinkCode) {
          payload.parentLinkCode = normalizedParentLinkCode || null;
        }
        await updateFn(payload);
      } else {
        const batch = writeBatch(firestore);
        batch.set(
          doc(firestore, 'users', user.uid),
          {
            schoolName: normalizedSchoolName,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        await batch.commit();
      }

      toast({ title: '정보가 성공적으로 업데이트되었습니다.' });
      setIsSettingsOpen(false);
    } catch (error: any) {
      console.error('Settings Update Error:', error);
      toast({
        variant: 'destructive',
        title: '업데이트 실패',
        description: resolveCallableErrorMessage(error),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 items-center gap-4 px-4 md:static md:h-auto md:px-6',
        isMobileView
          ? 'border-b border-[#ffd9b7] bg-[linear-gradient(180deg,#fff2e6_0%,#ffffff_82%)] shadow-[0_8px_22px_rgba(20,41,95,0.14)] backdrop-blur-sm'
          : 'border-b bg-background/80 backdrop-blur-sm md:border-0 md:bg-transparent'
      )}
    >
      <div className="flex items-center gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="md:hidden rounded-full border-[#1a336d]/20 bg-white/80 shadow-sm">
              <PanelLeft className="h-5 w-5" />
              <span className="sr-only">메뉴 열기</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:max-w-xs">
            <MainNav isMobile={true} />
          </SheetContent>
        </Sheet>
      </div>

      <Breadcrumb className="hidden md:flex">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard">대시보드</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>기본 대시보드</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="relative ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'rounded-full text-muted-foreground hover:bg-primary/5 transition-all',
            isMobileView &&
              'bg-[#14295F] text-white shadow-[0_8px_18px_rgba(20,41,95,0.28)] hover:bg-[#10214a] hover:text-white'
          )}
          onClick={() => setViewMode(viewMode === 'mobile' ? 'desktop' : 'mobile')}
          title={viewMode === 'mobile' ? '데스크톱 모드로 전환' : '앱 모드로 전환'}
        >
          {viewMode === 'mobile' ? <Monitor className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
        </Button>

        <NotificationBell />

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                'overflow-hidden rounded-full border-2 border-primary/10 shadow-sm interactive-button',
                isMobileView && 'border-[#14295F]/20 bg-white'
              )}
            >
              <Avatar className="h-full w-full">
                {user?.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || ''} />}
                <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">
                  {user?.displayName?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="rounded-2xl border-none shadow-2xl min-w-[200px] p-2 animate-in fade-in zoom-in duration-200"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DropdownMenuLabel className="font-black px-3 py-2 text-xs uppercase tracking-widest opacity-60">
              내 계정 관리
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="font-bold rounded-xl cursor-pointer py-2.5"
              onSelect={(e) => {
                e.preventDefault();
                setIsSettingsOpen(true);
              }}
            >
              <Settings className="mr-2 h-4 w-4 opacity-40" /> 설정
            </DropdownMenuItem>
            <DropdownMenuItem
              className="font-bold rounded-xl cursor-pointer py-2.5"
              onSelect={(e) => {
                e.preventDefault();
                setIsSupportOpen(true);
              }}
            >
              <HelpCircle className="mr-2 h-4 w-4 opacity-40" /> 지원 및 메뉴얼
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="font-black text-destructive rounded-xl cursor-pointer py-2.5">
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md transition-all duration-500 w-[90vw] max-w-[350px] sm:w-auto">
          <div className="bg-primary text-white relative overflow-hidden p-6 sm:p-8">
            <Sparkles className="absolute top-0 right-0 p-8 h-32 w-32 opacity-10" />
            <DialogTitle className="font-black tracking-tighter text-xl sm:text-2xl">프로필 설정</DialogTitle>
            <DialogDescription className="text-white/60 font-bold mt-1 text-xs">정보를 수정할 수 있습니다.</DialogDescription>
          </div>

          <div className="space-y-6 bg-white p-6 sm:p-8">
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">소속 학교</Label>
              <div className="relative">
                <School className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30" />
                <Input
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="h-12 pl-10 rounded-xl border-2 font-bold"
                  placeholder="학교명을 입력하세요"
                />
              </div>
            </div>

            {activeMembership?.role === 'student' && (
              <>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">현재 학년</Label>
                  <Select value={grade} onValueChange={setGrade}>
                    <SelectTrigger className="h-12 rounded-xl border-2 font-bold">
                      <SelectValue placeholder="학년 선택" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      <SelectItem value="1학년">1학년</SelectItem>
                      <SelectItem value="2학년">2학년</SelectItem>
                      <SelectItem value="3학년">3학년</SelectItem>
                      <SelectItem value="N수생">N수생</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">학부모 연동 코드 (6자리)</Label>
                  <Input
                    value={parentLinkCode}
                    onChange={(e) => setParentLinkCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    className="h-12 rounded-xl border-2 font-black tracking-[0.25em] text-center"
                    placeholder="123456"
                    maxLength={6}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="bg-muted/20 border-t p-6 sm:p-8">
            <Button
              onClick={handleUpdateSettings}
              disabled={isUpdating}
              className="w-full h-14 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all"
            >
              {isUpdating ? <Loader2 className="animate-spin h-5 w-5" /> : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSupportOpen} onOpenChange={setIsSupportOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-2xl flex flex-col transition-all duration-500 w-[95vw] max-w-[370px] sm:w-auto h-[80vh] sm:h-auto max-h-[85vh]">
          <div className="bg-accent text-white shrink-0 relative overflow-hidden p-6 sm:p-8">
            <BookOpen className="absolute -top-10 -right-10 h-48 w-48 opacity-10 rotate-12" />
            <DialogTitle className="font-black tracking-tighter flex items-center gap-3 text-xl sm:text-3xl">
              <BookOpen className="h-6 w-6" /> 가이드
            </DialogTitle>
            <DialogDescription className="text-white/70 font-bold mt-1 text-xs">앱 사용 메뉴얼입니다.</DialogDescription>
          </div>

          <div className="flex-1 overflow-y-auto space-y-10 bg-[#fafafa] custom-scrollbar p-6 sm:p-8">
            <section className="space-y-4">
              <h4 className="flex items-center gap-2 font-black text-lg text-primary">
                <Zap className="h-5 w-5 text-accent fill-current" /> 1. 학습 트랙
              </h4>
              <div className="p-5 rounded-[1.5rem] bg-white border shadow-sm space-y-3">
                <p className="text-xs font-bold leading-relaxed text-foreground/80">
                  대시보드 상단의 **[트랙 시작]** 버튼을 누르면 실시간 학습 몰입 엔진이 가동됩니다.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="flex items-center gap-2 font-black text-lg text-primary">
                <CalendarDays className="h-5 w-5 text-accent fill-current" /> 2. 계획 및 루틴
              </h4>
              <div className="p-5 rounded-[1.5rem] bg-white border shadow-sm space-y-3">
                <p className="text-xs font-bold leading-relaxed text-foreground/80">
                  **[나의 학습 계획]** 메뉴에서 매일의 공부 To-do와 생활 루틴을 관리하세요.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="flex items-center gap-2 font-black text-lg text-primary">
                <MessageCircle className="h-5 w-5 text-accent fill-current" /> 3. 상담 및 피드백
              </h4>
              <div className="p-5 rounded-[1.5rem] bg-white border shadow-sm space-y-3">
                <p className="text-xs font-bold leading-relaxed text-foreground/80">
                  고민이 생기면 언제든 **[상담 신청]**을 통해 도움을 요청하세요.
                </p>
              </div>
            </section>
          </div>

          <div className="bg-white border-t shrink-0 flex justify-end p-4 sm:p-6">
            <Button onClick={() => setIsSupportOpen(false)} className="rounded-xl font-black px-8 h-12 shadow-lg active:scale-95 transition-all">
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
