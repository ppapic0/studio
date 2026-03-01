'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bell,
  Home,
  LineChart,
  Package2,
  Users,
  PanelLeft,
  Search,
  LogOut,
  Smartphone,
  Monitor,
  Settings,
  HelpCircle,
  BookOpen,
  Zap,
  CalendarDays,
  MessageCircle,
  CheckCircle2,
  School,
  GraduationCap,
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
import { doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { StudentProfile } from '@/lib/types';

export function DashboardHeader() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { viewMode, setViewMode, activeMembership } = useAppContext();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // 설정 폼 상태
  const [schoolName, setSchoolName] = useState('');
  const [grade, setGrade] = useState('');

  const studentRef = (firestore && activeMembership && user) 
    ? doc(firestore, 'centers', activeMembership.id, 'students', user.uid)
    : null;
  const { data: studentProfile } = useDoc<StudentProfile>(studentRef as any);

  useEffect(() => {
    if (studentProfile) {
      setSchoolName(studentProfile.schoolName || '');
      setGrade(studentProfile.grade || '');
    }
  }, [studentProfile]);

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push('/login');
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'responsive' ? 'mobile' : 'responsive');
  };

  const handleUpdateSettings = async () => {
    if (!firestore || !user || !activeMembership) return;
    setIsUpdating(true);
    try {
      const batch = writeBatch(firestore);
      
      // 1. 전역 프로필 업데이트
      const userRef = doc(firestore, 'users', user.uid);
      batch.update(userRef, { schoolName, updatedAt: serverTimestamp() });

      // 2. 센터 내 학생 프로필 업데이트
      if (activeMembership.role === 'student') {
        const sRef = doc(firestore, 'centers', activeMembership.id, 'students', user.uid);
        batch.update(sRef, { schoolName, grade, updatedAt: serverTimestamp() });
      }

      await batch.commit();
      toast({ title: "정보가 성공적으로 업데이트되었습니다." });
      setIsSettingsOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "업데이트 실패", description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <header className={cn(
      "sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4",
      viewMode === 'responsive' && "sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6"
    )}>
      {viewMode === 'responsive' && (
        <Sheet>
          <SheetTrigger asChild>
            <Button size="icon" variant="outline" className="md:hidden">
              <PanelLeft className="h-5 w-5" />
              <span className="sr-only">메뉴 열기</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="sm:max-w-xs">
            <MainNav isMobile={true} />
          </SheetContent>
        </Sheet>
      )}

      {viewMode === 'responsive' && (
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
      )}

      <div className="relative ml-auto flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "rounded-full transition-all",
            viewMode === 'mobile' ? "bg-primary text-white" : "text-muted-foreground"
          )}
          onClick={toggleViewMode}
          title={viewMode === 'mobile' ? "데스크톱 모드로 전환" : "앱 모드 시뮬레이션"}
        >
          {viewMode === 'mobile' ? <Monitor className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
        </Button>

        <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground">
          <Bell className="h-5 w-5" />
          <span className="sr-only">알림 열기</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="overflow-hidden rounded-full border-2 border-primary/10 shadow-sm"
            >
              <Avatar className="h-full w-full">
                {user?.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || ''} />}
                <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl border-none shadow-2xl min-w-[200px] p-2">
            <DropdownMenuLabel className="font-black px-3 py-2">내 계정</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="font-bold rounded-xl cursor-pointer" onClick={() => setIsSettingsOpen(true)}>
              <Settings className="mr-2 h-4 w-4 opacity-40" /> 설정
            </DropdownMenuItem>
            <DropdownMenuItem className="font-bold rounded-xl cursor-pointer" onClick={() => setIsSupportOpen(true)}>
              <HelpCircle className="mr-2 h-4 w-4 opacity-40" /> 지원 및 메뉴얼
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="font-black text-destructive rounded-xl cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 설정 다이얼로그 */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md">
          <div className="bg-primary p-8 text-white">
            <DialogTitle className="text-2xl font-black tracking-tighter">프로필 설정</DialogTitle>
            <DialogDescription className="text-white/60 font-bold mt-1">학교 및 학년 정보를 수정할 수 있습니다.</DialogDescription>
          </div>
          <div className="p-8 space-y-6">
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">소속 학교</Label>
              <div className="relative">
                <School className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30" />
                <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="h-12 pl-10 rounded-xl border-2" placeholder="학교명을 입력하세요" />
              </div>
            </div>
            {activeMembership?.role === 'student' && (
              <div className="grid gap-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">현재 학년</Label>
                <Select value={grade} onValueChange={setGrade}>
                  <SelectTrigger className="h-12 rounded-xl border-2">
                    <SelectValue placeholder="학년 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1학년">1학년</SelectItem>
                    <SelectItem value="2학년">2학년</SelectItem>
                    <SelectItem value="3학년">3학년</SelectItem>
                    <SelectItem value="N수생">N수생</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="p-8 bg-muted/20">
            <Button onClick={handleUpdateSettings} disabled={isUpdating} className="w-full h-12 rounded-2xl font-black text-base shadow-xl">
              {isUpdating ? <Loader2 className="animate-spin h-5 w-5" /> : '변경 내용 저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 지원/메뉴얼 다이얼로그 */}
      <Dialog open={isSupportOpen} onOpenChange={setIsSupportOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-2xl max-h-[85vh] flex flex-col">
          <div className="bg-accent p-8 text-white shrink-0">
            <DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
              <BookOpen className="h-8 w-8" /> 공부트랙 마스터 가이드
            </DialogTitle>
            <DialogDescription className="text-white/70 font-bold mt-1">효율적인 학습을 위한 앱 사용 메뉴얼입니다.</DialogDescription>
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-10 bg-[#fafafa] custom-scrollbar">
            <section className="space-y-4">
              <h4 className="flex items-center gap-2 font-black text-xl text-primary">
                <Zap className="h-5 w-5 text-accent fill-current" /> 1. 학습 트랙 엔진
              </h4>
              <div className="p-5 rounded-[1.5rem] bg-white border shadow-sm space-y-3">
                <p className="text-sm font-bold leading-relaxed text-foreground/80">
                  대시보드 상단의 **[트랙 시작]** 버튼을 누르면 실시간 학습 몰입 엔진이 가동됩니다. 
                  학습이 끝나면 **[트랙 종료]**를 눌러 기록을 저장하세요.
                </p>
                <div className="flex items-center gap-2 text-[10px] font-black text-amber-600 bg-amber-50 p-2 rounded-lg">
                  <CheckCircle2 className="h-3.5 w-3.5" /> 2시간 이상 활동이 없으면 세션이 자동 보호 모드로 전환됩니다.
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="flex items-center gap-2 font-black text-xl text-primary">
                <CalendarDays className="h-5 w-5 text-accent fill-current" /> 2. 일일 계획 및 루틴
              </h4>
              <div className="p-5 rounded-[1.5rem] bg-white border shadow-sm space-y-3">
                <p className="text-sm font-bold leading-relaxed text-foreground/80">
                  **[나의 학습 계획]** 메뉴에서 매일의 공부 To-do와 생활 루틴을 관리하세요. 
                  '요일 반복 복사' 기능을 활용하면 일주일치 계획을 1초 만에 세울 수 있습니다.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="flex items-center gap-2 font-black text-xl text-primary">
                <MessageCircle className="h-5 w-5 text-accent fill-current" /> 3. 전문가 상담 및 피드백
              </h4>
              <div className="p-5 rounded-[1.5rem] bg-white border shadow-sm space-y-3">
                <p className="text-sm font-bold leading-relaxed text-foreground/80">
                  고민이 생기면 언제든 **[상담 신청]**을 통해 선생님께 도움을 요청하세요. 
                  선생님이 작성해주신 상담 일지는 **[상담 히스토리]**에서 다시 볼 수 있습니다.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="flex items-center gap-2 font-black text-xl text-primary">
                <GraduationCap className="h-5 w-5 text-accent fill-current" /> 4. 성장 로드맵 및 랭킹
              </h4>
              <div className="p-5 rounded-[1.5rem] bg-white border shadow-sm space-y-3">
                <p className="text-sm font-bold leading-relaxed text-foreground/80">
                  공부한 시간만큼 XP를 얻고 레벨업하세요! **[리더보드]**에서는 이번 달 센터 최고의 열정 챔피언들을 확인할 수 있습니다.
                </p>
              </div>
            </section>
          </div>
          <div className="p-6 bg-white border-t shrink-0 flex justify-end">
            <Button onClick={() => setIsSupportOpen(false)} className="rounded-xl font-black px-8">이해했습니다</Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
