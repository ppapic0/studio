'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  PanelLeft,
  LogOut,
  Smartphone,
  Monitor,
  Settings,
  HelpCircle,
  BookOpen,
  Sparkles,
  Loader2
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useUser, useAuth, useFirestore, useDoc } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/contexts/app-context';
import { cn } from '@/lib/utils';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { StudentProfile, User as UserType } from '@/lib/types';
import { NotificationBell } from './notification-bell';
import { TrackLogo } from '../ui/track-logo';
import { Badge } from '../ui/badge';

export function DashboardHeader() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { activeMembership, viewMode, setViewMode } = useAppContext();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const isMobileView = viewMode === 'mobile';

  // 설정 폼 상태
  const [schoolName, setSchoolName] = useState('');
  const [grade, setGrade] = useState('');

  const userRef = (firestore && user) ? doc(firestore, 'users', user.uid) : null;
  const { data: userProfile } = useDoc<UserType>(userRef as any);

  const studentRef = (firestore && activeMembership && user) 
    ? doc(firestore, 'centers', activeMembership.id, 'students', user.uid)
    : null;
  const { data: studentProfile } = useDoc<StudentProfile>(studentRef as any);

  useEffect(() => {
    if (studentProfile) {
      setSchoolName(studentProfile.schoolName || '');
      setGrade(studentProfile.grade || '');
    } else if (userProfile) {
      setSchoolName(userProfile.schoolName || '');
    }
  }, [studentProfile, userProfile]);

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push('/login');
  };

  const handleUpdateSettings = async () => {
    if (!firestore || !user || !activeMembership) return;
    setIsUpdating(true);
    try {
      const batch = writeBatch(firestore);
      const commonUpdate = {
        schoolName: schoolName.trim(),
        updatedAt: serverTimestamp()
      };
      const uRef = doc(firestore, 'users', user.uid);
      batch.set(uRef, commonUpdate, { merge: true });
      if (activeMembership.role === 'student') {
        const sRef = doc(firestore, 'centers', activeMembership.id, 'students', user.uid);
        batch.set(sRef, {
          ...commonUpdate,
          grade: grade,
          name: user.displayName || '학생'
        }, { merge: true });
      }
      await batch.commit();
      toast({ title: "정보가 성공적으로 업데이트되었습니다." });
      setIsSettingsOpen(false);
    } catch (e: any) {
      console.error("Settings Update Error:", e);
      toast({ variant: "destructive", title: "업데이트 실패", description: e.message || "서버 통신 중 오류가 발생했습니다." });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <header className={cn(
      "sticky top-0 z-30 flex items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 transition-all duration-300",
      isMobileView ? "h-14" : "h-14 md:h-16 md:px-6 md:bg-transparent md:border-0"
    )}>
      <div className="flex items-center gap-2">
        <Sheet>
          <SheetTrigger asChild>
            <button className={cn("p-1 text-primary/60 hover:text-primary transition-all md:hidden")}>
              <PanelLeft className={cn(isMobileView ? "h-5 w-5" : "h-6 w-6")} />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:max-w-xs p-0">
            <MainNav isMobile={true} />
          </SheetContent>
        </Sheet>

        {isMobileView && (
          <Link href="/dashboard" className="flex items-center gap-2 group active:scale-95 transition-all">
            <TrackLogo className="h-7 w-auto" />
            <div className="flex flex-col -gap-1">
              <span className="text-sm font-black tracking-tighter text-primary leading-none uppercase">Track</span>
              <span className="text-[10px] font-bold text-muted-foreground leading-none">학습센터</span>
            </div>
            {activeMembership?.role === 'parent' && (
              <Badge className="bg-primary text-white border-none font-black text-[8px] h-4 px-1.5 uppercase tracking-tighter shadow-sm ml-1">PARENT</Badge>
            )}
          </Link>
        )}
      </div>

      {!isMobileView && (
        <Breadcrumb className="hidden md:flex">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard">대시보드</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>메인 화면</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div className="relative ml-auto flex items-center gap-2 sm:gap-4">
        {/* 웹 모드 전환 버튼 복구 */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full text-muted-foreground hover:bg-primary/5 transition-all h-9 w-9"
          onClick={() => setViewMode(viewMode === 'mobile' ? 'desktop' : 'mobile')}
          title={viewMode === 'mobile' ? '데스크톱 모드로 전환' : '앱 모드로 전환'}
        >
          {viewMode === 'mobile' ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-5 w-5" />}
        </Button>

        <NotificationBell />

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "overflow-hidden rounded-full border-2 border-primary/10 shadow-sm interactive-button transition-all",
                isMobileView ? "h-7 w-7" : "h-9 w-9"
              )}
            >
              <Avatar className="h-full w-full">
                {user?.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || ''} />}
                <AvatarFallback className="bg-primary/5 text-primary font-black text-[10px]">{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="rounded-2xl border-none shadow-2xl min-w-[200px] p-2 animate-in fade-in zoom-in duration-200"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DropdownMenuLabel className="font-black px-3 py-2 text-xs uppercase tracking-widest opacity-60">내 계정 관리</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="font-bold rounded-xl cursor-pointer py-2.5" 
              onSelect={(e) => { e.preventDefault(); setIsSettingsOpen(true); }}
            >
              <Settings className="mr-2 h-4 w-4 opacity-40" /> 설정
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="font-bold rounded-xl cursor-pointer py-2.5" 
              onSelect={(e) => { e.preventDefault(); setIsSupportOpen(true); }}
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
              <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="h-12 rounded-xl border-2 font-bold" placeholder="학교명을 입력하세요" />
            </div>
            {activeMembership?.role === 'student' && (
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
            )}
          </div>
          <DialogFooter className="bg-muted/20 border-t p-6 sm:p-8">
            <Button onClick={handleUpdateSettings} disabled={isUpdating} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all">
              {isUpdating ? <Loader2 className="animate-spin h-5 w-5" /> : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSupportOpen} onOpenChange={setIsSupportOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-2xl flex flex-col transition-all duration-500 w-[95vw] max-w-[370px] sm:w-auto h-[80vh] sm:h-auto max-h-[85vh]">
          <div className="bg-primary text-white shrink-0 relative overflow-hidden p-6 sm:p-8">
            <BookOpen className="absolute -top-10 -right-10 h-48 w-48 opacity-10 rotate-12" />
            <DialogTitle className="font-black tracking-tighter flex items-center gap-3 text-xl sm:text-3xl">
              <BookOpen className="h-6 w-6" /> 가이드
            </DialogTitle>
            <DialogDescription className="text-white/70 font-bold mt-1 text-xs">앱 사용 메뉴얼입니다.</DialogDescription>
          </div>
          <div className="flex-1 overflow-y-auto space-y-10 bg-[#fafafa] custom-scrollbar p-6 sm:p-8">
            <section className="space-y-4">
              <h4 className="flex items-center gap-2 font-black text-lg text-primary">
                <Sparkles className="h-5 w-5 text-accent fill-current" /> 1. 학습 트랙
              </h4>
              <div className="p-5 rounded-[1.5rem] bg-white border shadow-sm">
                <p className="text-xs font-bold leading-relaxed text-foreground/80">
                  학생들이 공부를 시작하면 실시간으로 시간이 측정되며, 학부모님은 이 현황을 언제든 확인하실 수 있습니다.
                </p>
              </div>
            </section>
          </div>
          <div className="bg-white border-t shrink-0 flex justify-end p-4 sm:p-6">
            <Button onClick={() => setIsSupportOpen(false)} className="rounded-xl font-black px-8 h-12 shadow-lg active:scale-95 transition-all">닫기</Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
