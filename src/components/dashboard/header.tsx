'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
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
  Phone,
  Play,
  Square,
  Gift,
  Trophy,
  ShieldAlert,
  FileText,
  Wallet,
  History,
  Target,
  BellRing,
  Lightbulb,
  ChevronRight,
  Wifi,
  Clock,
  Flame,
} from 'lucide-react';

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
import { useAuth, useDoc, useFirestore, useFunctions, useMemoFirebase, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import {
  DASHBOARD_POST_LOGIN_ENTRY_MAX_AGE_MS,
  PARENT_POST_LOGIN_ENTRY_MOTION_KEY,
} from '@/lib/dashboard-motion';
import { cn } from '@/lib/utils';
import { logHandledClientIssue } from '@/lib/handled-client-log';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useToast } from '@/hooks/use-toast';
import { CenterMembership, StudentProfile, User as UserType } from '@/lib/types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { clearServerAuthSession } from '@/lib/client-auth-session';

function Pill({ children, tone = 'navy' }: { children: ReactNode; tone?: 'navy' | 'orange' | 'amber' | 'rose' }) {
  const toneClass =
    tone === 'orange'
      ? 'bg-[#FFE5CC] text-[#B44A00] border-[#FFD0A3]'
      : tone === 'amber'
        ? 'bg-[#FEF3E0] text-[#9A5A00] border-[#F7D8A3]'
        : tone === 'rose'
          ? 'bg-[#FFE3EA] text-[#B02344] border-[#FBC4D1]'
          : 'bg-[#E7ECF7] text-[#17326B] border-[#C8D4EC]';
  return (
    <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-black whitespace-nowrap align-baseline', toneClass)}>
      {children}
    </span>
  );
}

function GuideStep({ icon, title, body }: { icon: ReactNode; title: string; body: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-[0_4px_10px_-6px_rgba(10,28,72,0.2)]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-black tracking-tight text-[#17326B] break-keep">{title}</p>
        <p className="mt-1 text-[11.5px] font-semibold leading-5 text-[#49597A] break-keep">{body}</p>
      </div>
    </div>
  );
}

function GuideTip({ children, tone = 'orange' }: { children: ReactNode; tone?: 'orange' | 'amber' }) {
  const toneClass =
    tone === 'amber'
      ? 'border-[#F7D8A3] bg-[#FEF3E0] text-[#9A5A00]'
      : 'border-[#FFD0A3] bg-[#FFF4E8] text-[#B44A00]';
  return (
    <div className={cn('mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5', toneClass)}>
      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p className="text-[11px] font-bold leading-5 break-keep">{children}</p>
    </div>
  );
}

function GuideSection({
  step,
  title,
  icon,
  accentColor,
  tintColor,
  children,
}: {
  step: number;
  title: string;
  icon: ReactNode;
  accentColor: string;
  tintColor: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-34px_rgba(10,28,72,0.22)]">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_10px_22px_-14px_rgba(10,28,72,0.5)]"
          style={{ backgroundColor: accentColor }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[9.5px] font-black uppercase tracking-[0.22em]" style={{ color: accentColor }}>
            STEP {String(step).padStart(2, '0')}
          </p>
          <h4 className="font-black tracking-tight text-[#17326B] text-[15px] break-keep">{title}</h4>
        </div>
      </div>
      <div className="mt-4 rounded-2xl p-4 space-y-3.5" style={{ backgroundColor: tintColor }}>
        {children}
      </div>
    </section>
  );
}

function extractPhoneNumber(source: unknown): string {
  if (!source || typeof source !== 'object') return '';
  const candidate = (source as { phoneNumber?: unknown }).phoneNumber;
  return typeof candidate === 'string' ? candidate : '';
}

function resolveCallableErrorMessage(error: any): string {
  const errorCode = String(error?.code || '').toLowerCase();
  const detailMessage =
    typeof error?.details === 'string'
      ? error.details
      : typeof error?.details?.userMessage === 'string'
        ? error.details.userMessage
        : typeof error?.details?.message === 'string'
          ? error.details.message
          : '';

  const looksCorrupted = (message: string): boolean => {
    const trimmed = message.trim();
    if (!trimmed) return false;
    const questionCount = (trimmed.match(/\?/g) || []).length;
    return questionCount >= Math.max(2, Math.floor(trimmed.length * 0.25));
  };

  if (errorCode.includes('permission-denied')) {
    return '\uAD8C\uD55C\uC774 \uC5C6\uC5B4 \uC815\uBCF4\uB97C \uBCC0\uACBD\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.';
  }
  if (errorCode.includes('failed-precondition')) {
    return '\uC774\uBBF8 \uC0AC\uC6A9 \uC911\uC778 \uD559\uBD80\uBAA8 \uC5F0\uB3D9 \uCF54\uB4DC\uC785\uB2C8\uB2E4. \uB2E4\uB978 6\uC790\uB9AC \uC22B\uC790\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694.';
  }
  if (errorCode.includes('invalid-argument')) {
    return '\uC785\uB825\uAC12\uC744 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.';
  }

  const rawMessage = String(error?.message || '').replace(/^FirebaseError:\s*/i, '').trim();
  if (detailMessage && !looksCorrupted(detailMessage)) return detailMessage;
  if (rawMessage && !/(functions\/internal|internal)$/i.test(rawMessage) && !looksCorrupted(rawMessage)) return rawMessage;

  return '\uC11C\uBC84 \uD1B5\uC2E0 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.';
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

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

function isValidKoreanMobilePhone(raw: string): boolean {
  return /^01\d{8,9}$/.test(raw);
}

type DashboardHeaderProps = {
  playStudentEntry?: boolean;
};

export function DashboardHeader({ playStudentEntry = false }: DashboardHeaderProps) {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const functions = useFunctions();
  const router = useRouter();
  const { toast } = useToast();
  const { activeMembership, activeStudentId, viewMode, setViewMode } = useAppContext();
  const isParentMode = activeMembership?.role === 'parent';
  const isStudentMode = activeMembership?.role === 'student';
  const isMobileView = isParentMode || viewMode === 'mobile';
  const dashboardMotionPreset = isParentMode || isStudentMode ? 'dashboard-premium' : 'default';

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSettingsFormInitialized, setIsSettingsFormInitialized] = useState(false);
  const [playParentEntry, setPlayParentEntry] = useState(false);

  const [schoolName, setSchoolName] = useState('');
  const [grade, setGrade] = useState('');
  const [parentLinkCode, setParentLinkCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userProfile } = useDoc<UserType>(userRef as any);
  const authUid = user?.uid || null;
  const studentUid = authUid || activeStudentId || null;
  const studentDocId = activeStudentId || authUid || null;

  const studentRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !studentDocId) return null;
    return doc(firestore, 'centers', activeMembership.id, 'students', studentDocId);
  }, [firestore, activeMembership?.id, studentDocId]);
  const { data: studentProfile } = useDoc<StudentProfile>(studentRef as any);
  const linkedStudentId =
    activeMembership?.role === 'parent'
      ? activeMembership?.linkedStudentIds?.[0] || null
      : studentDocId;
  const linkedStudentRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership?.id || !linkedStudentId) return null;
    return doc(firestore, 'centers', activeMembership.id, 'students', linkedStudentId);
  }, [firestore, activeMembership?.id, linkedStudentId]);
  const { data: linkedStudentProfile } = useDoc<StudentProfile>(linkedStudentRef as any);
  const [parentHeaderTodayLabel, setParentHeaderTodayLabel] = useState('');
  const parentHeaderStudentName = linkedStudentProfile?.name || '학생';

  useEffect(() => {
    if (!isParentMode || typeof window === 'undefined') {
      setParentHeaderTodayLabel('');
      return;
    }

    const syncParentHeaderTodayLabel = () => {
      setParentHeaderTodayLabel(format(new Date(), 'yyyy. MM. dd (EEE)', { locale: ko }));
    };

    syncParentHeaderTodayLabel();
    const intervalId = window.setInterval(syncParentHeaderTodayLabel, 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [isParentMode]);

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
      setPhoneNumber(normalizePhone(extractPhoneNumber(studentProfile) || userProfile?.phoneNumber || activeMembership?.phoneNumber || ''));
      setIsSettingsFormInitialized(true);
      return;
    }

    if (userProfile) {
      setSchoolName(userProfile.schoolName || '');
      setGrade('');
      setParentLinkCode('');
      setPhoneNumber(normalizePhone(userProfile.phoneNumber || activeMembership?.phoneNumber || ''));
      setIsSettingsFormInitialized(true);
    }
  }, [isSettingsOpen, isSettingsFormInitialized, studentProfile, userProfile, activeMembership?.phoneNumber]);

  useEffect(() => {
    if (!isParentMode || typeof window === 'undefined') return;

    const raw = window.sessionStorage.getItem(PARENT_POST_LOGIN_ENTRY_MOTION_KEY);
    const timestamp = Number(raw);
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > DASHBOARD_POST_LOGIN_ENTRY_MAX_AGE_MS) {
      return;
    }

    setPlayParentEntry(true);
    const timer = window.setTimeout(() => setPlayParentEntry(false), 1100);
    return () => window.clearTimeout(timer);
  }, [isParentMode]);

  const handleSignOut = async () => {
    try {
      await clearServerAuthSession();
      if (auth) {
        await signOut(auth);
      }
      router.push('/login');
    } catch (error) {
      logHandledClientIssue('[dashboard-header] sign out failed', error);
      toast({
        variant: 'destructive',
        title: '로그아웃 실패',
        description: '로그아웃 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      });
    }
  };

  const handleUpdateSettings = async () => {
    if (!firestore || !user || !activeMembership) return;

    if (activeMembership.role === 'student') {
      toast({
        title: '프로필은 조회 전용입니다.',
        description: '정보 변경이 필요하면 센터 관리자에게 요청해 주세요.',
      });
      setIsSettingsOpen(false);
      return;
    }

    const normalizedSchoolName = schoolName.trim();
    const normalizedPhoneNumber = normalizePhone(phoneNumber);

    if (activeMembership.role === 'parent' && !isValidKoreanMobilePhone(normalizedPhoneNumber)) {
      toast({
        variant: 'destructive',
        title: '\uC785\uB825 \uD655\uC778',
        description: '\uBCF8\uC778 \uD734\uB300\uD3F0 \uBC88\uD638\uB97C 01012345678 \uD615\uC2DD\uC73C\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694.',
      });
      return;
    }

    setIsUpdating(true);
    try {
      if (activeMembership.role === 'parent') {
        if (!functions) {
          throw new Error('함수 연결이 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.');
        }
        const updateFn = httpsCallable(functions, 'updateParentProfile');
        await updateFn({
          centerId: activeMembership.id,
          schoolName: normalizedSchoolName,
          phoneNumber: normalizedPhoneNumber,
        });
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

      toast({ title: '\uC815\uBCF4\uAC00 \uC131\uACF5\uC801\uC73C\uB85C \uC5C5\uB370\uC774\uD2B8\uB418\uC5C8\uC2B5\uB2C8\uB2E4.' });
      setIsSettingsOpen(false);
    } catch (error: any) {
      logHandledClientIssue('[dashboard-header] settings update failed', error);
      toast({
        variant: 'destructive',
        title: '\uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328',
        description: resolveCallableErrorMessage(error),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center md:static md:h-auto',
        isParentMode ? 'h-[3.25rem] gap-2 px-3 sm:h-14 sm:px-4 md:px-5' : 'h-14 gap-4 px-4 md:px-6',
        isMobileView
          ? 'border-b border-[rgba(255,170,80,0.20)] bg-[linear-gradient(180deg,rgba(255,247,238,0.98)_0%,rgba(255,255,255,0.96)_100%)] shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_4px_16px_rgba(20,41,95,0.09)] backdrop-blur-md'
          : 'border-b border-[rgba(20,41,95,0.07)] bg-white/85 backdrop-blur-xl shadow-[0_1px_0_0_rgba(255,255,255,0.8)_inset] md:border-0 md:bg-transparent md:shadow-none',
        playParentEntry && 'parent-shell-enter parent-entry-delay-1',
        playStudentEntry && !isParentMode && 'student-shell-enter student-entry-delay-1'
      )}
    >
      <div className={cn('flex items-center', isParentMode ? 'gap-1.5' : 'gap-2')}>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className={cn(
                'md:hidden rounded-full border-[#1a336d]/20 bg-white/80 shadow-sm',
                isParentMode ? 'h-9 w-9' : ''
              )}
            >
              <PanelLeft className="h-5 w-5" />
              <span className="sr-only">메뉴 열기</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" motionPreset={dashboardMotionPreset} className="sm:max-w-xs">
            <MainNav isMobile={true} />
          </SheetContent>
        </Sheet>
      </div>

      <div className="relative ml-auto flex items-center gap-2">
        {isParentMode && (
          <div className="flex items-center rounded-2xl border border-[#d6e2fb] bg-[linear-gradient(145deg,#f4f8ff_0%,#ffffff_100%)] px-3 py-1.5 shadow-sm">
            <div className="grid gap-0.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#14295F]/55">{parentHeaderTodayLabel}</p>
              <p className="text-[11px] font-black text-[#14295F]">{parentHeaderStudentName} 학생 현황</p>
            </div>
          </div>
        )}
        {!isParentMode && (
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
        )}

        {!isParentMode && <NotificationBell />}

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                'overflow-hidden rounded-full border-2 border-primary/10 shadow-sm interactive-button',
                isMobileView && 'border-[#14295F]/20 bg-white',
                isParentMode ? 'h-9 w-9 sm:h-10 sm:w-10' : ''
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
        <DialogContent
          motionPreset={dashboardMotionPreset}
          className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md transition-all duration-500 w-[90vw] max-w-[350px] sm:w-auto"
        >
          <div className="bg-primary text-white relative overflow-hidden p-6 sm:p-8">
            <Sparkles className="absolute top-0 right-0 p-8 h-32 w-32 opacity-10" />
            <DialogTitle className="font-black tracking-tighter text-xl sm:text-2xl">프로필 설정</DialogTitle>
            <DialogDescription className="text-white/60 font-bold mt-1 text-xs">
              {activeMembership?.role === 'student' ? '등록된 프로필을 확인할 수 있습니다.' : '정보를 수정할 수 있습니다.'}
            </DialogDescription>
          </div>

          <div className="space-y-6 bg-white p-6 sm:p-8">
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">소속 학교</Label>
              <div className="relative">
                <School className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30" />
                <Input
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  readOnly={activeMembership?.role === 'student'}
                  disabled={activeMembership?.role === 'student'}
                  className="h-12 pl-10 rounded-xl border-2 font-bold"
                  placeholder={activeMembership?.role === 'student' ? '등록된 학교 정보 없음' : '학교명을 입력하세요'}
                />
              </div>
            </div>

            {(activeMembership?.role === 'student' || activeMembership?.role === 'parent') && (
              <div className="grid gap-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">본인 전화번호</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30" />
                  <Input
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    readOnly={activeMembership?.role === 'student'}
                    disabled={activeMembership?.role === 'student'}
                    className="h-12 rounded-xl border-2 pl-10 font-black tracking-tight"
                    placeholder={activeMembership?.role === 'student' ? '등록된 전화번호 없음' : '01012345678'}
                    maxLength={11}
                  />
                </div>
              </div>
            )}

            {activeMembership?.role === 'student' && (
              <>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">현재 학년</Label>
                  <Select value={grade} onValueChange={setGrade} disabled>
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
                    readOnly
                    disabled
                    className="h-12 rounded-xl border-2 font-black tracking-[0.25em] text-center"
                    placeholder="등록된 코드 없음"
                    maxLength={6}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="bg-muted/20 border-t p-6 sm:p-8">
            <Button
              onClick={activeMembership?.role === 'student' ? () => setIsSettingsOpen(false) : handleUpdateSettings}
              disabled={isUpdating}
              className="w-full h-14 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all"
            >
              {isUpdating ? <Loader2 className="animate-spin h-5 w-5" /> : activeMembership?.role === 'student' ? '확인' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSupportOpen} onOpenChange={setIsSupportOpen}>
        <DialogContent
          motionPreset={dashboardMotionPreset}
          className={cn(
            "rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden flex flex-col transition-all duration-500",
            isMobileView
              ? "w-[95vw] max-w-[390px] h-[86vh] max-h-[86vh]"
              : "w-auto max-w-2xl h-auto max-h-[85vh]"
          )}
        >
          <div className={cn(
            "shrink-0 relative overflow-hidden text-white bg-[linear-gradient(140deg,#FF9A46_0%,#FF7A16_58%,#EF6100_100%)]",
            isMobileView ? "p-6" : "p-8"
          )}>
            <BookOpen className="pointer-events-none absolute -top-10 -right-10 h-48 w-48 opacity-10 rotate-12" />
            <Sparkles className="pointer-events-none absolute bottom-4 right-6 h-6 w-6 text-white/40" />
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
              <Flame className="h-3 w-3" /> STUDENT MANUAL
            </div>
            <DialogTitle className={cn(
              "font-black tracking-tighter flex items-center gap-3 mt-3",
              isMobileView ? "text-2xl" : "text-3xl"
            )}>
              <BookOpen className="h-7 w-7" /> 스터디센터 이용 가이드
            </DialogTitle>
            <DialogDescription className="text-white/85 font-bold mt-1.5 text-[12px] leading-5">
              러닝 시스템을 120% 활용하는 방법을 하나씩 알려줄게요.
            </DialogDescription>
          </div>

          <div className={cn(
            "flex-1 overflow-y-auto bg-[#f6f7fb] custom-scrollbar",
            isMobileView ? "p-5 space-y-6" : "p-8 space-y-8"
          )}>
            <section className="rounded-[1.75rem] border border-[#FFD7B0] bg-[linear-gradient(160deg,#FFF4E6_0%,#FFE5CC_100%)] p-5 shadow-[0_18px_40px_-32px_rgba(239,97,0,0.45)]">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FF7A16] text-white shadow-[0_12px_24px_-14px_rgba(239,97,0,0.65)]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#B44A00]">QUICK START</p>
                  <p className="mt-1.5 text-sm font-black leading-6 text-[#17326B] break-keep">
                    하루 3번만 기억하세요: <span className="text-[#FF7A16]">집중 시작</span> → <span className="text-[#FF7A16]">오늘 할 일</span> → <span className="text-[#FF7A16]">기록 확인</span>
                  </p>
                  <p className="mt-2 text-[11px] font-semibold leading-5 text-[#5A6F95] break-keep">
                    센터에 도착하면 바로 타이머를 켜고, 홈 카드의 오늘 할 일을 체크한 뒤, 끝날 때 기록 탭에서 성장을 확인해요.
                  </p>
                </div>
              </div>
            </section>

            <GuideSection
              step={1}
              title="학습 몰입 시작하기"
              icon={<Play className="h-5 w-5" />}
              accentColor="#2554D7"
              tintColor="#EAF0FC"
            >
              <GuideStep
                icon={<Play className="h-4 w-4 text-[#2554D7]" />}
                title="집중 시작하기"
                body={<>홈 상단의 <Pill>집중 시작하기</Pill> 버튼을 누르면 실시간 공부 타이머가 시작돼요. 자리에 앉아 공부에만 집중하세요.</>}
              />
              <GuideStep
                icon={<Square className="h-4 w-4 text-[#2554D7]" />}
                title="공부 종료하기"
                body={<>공부가 끝나면 <Pill>공부 종료하기</Pill>를 눌러 세션을 저장해요. 포인트가 적립되고, 오늘의 트랙 카드에 누적 시간이 반영돼요.</>}
              />
              <GuideStep
                icon={<Clock className="h-4 w-4 text-[#2554D7]" />}
                title="화장실·잠깐 이석"
                body={<>자리를 비울 땐 반드시 <Pill>종료</Pill>한 뒤, 돌아와서 다시 시작해요. 타이머를 켜둔 채 자리를 비우면 부정 기록으로 처리될 수 있어요.</>}
              />
              <GuideTip>
                집중 중엔 카톡·유튜브 알림을 무음으로. 몰입한 만큼 포인트 적립 속도도 빨라져요.
              </GuideTip>
            </GuideSection>

            <GuideSection
              step={2}
              title="포인트 & 리워드 상자"
              icon={<Gift className="h-5 w-5" />}
              accentColor="#FF7A16"
              tintColor="#FFF0DE"
            >
              <GuideStep
                icon={<Trophy className="h-4 w-4 text-[#FF7A16]" />}
                title="포인트 적립"
                body={<>공부 시간에 비례해 <Pill tone="orange">러닝 포인트</Pill>가 쌓여요. 오늘 번 포인트와 누적은 홈의 포인트 카드 또는 <Pill>포인트</Pill> 탭에서 확인할 수 있어요.</>}
              />
              <GuideStep
                icon={<Gift className="h-4 w-4 text-[#FF7A16]" />}
                title="리워드 상자 열기"
                body={<>일정 공부 시간에 도달하면 <Pill tone="orange">BOX READY</Pill> 표시와 함께 상자가 지급돼요. 홈의 상자 아이콘을 눌러 열면 랜덤 리워드가 나와요.</>}
              />
              <GuideStep
                icon={<Zap className="h-4 w-4 text-[#FF7A16]" />}
                title="부스트 이벤트"
                body={<>센터에서 부스트를 띄우면 <Pill tone="orange">n배 적용 중</Pill> 배너가 떠요. 이 시간엔 같은 공부라도 포인트가 배로 들어오니 놓치지 마세요.</>}
              />
              <GuideTip>
                상자는 자동 저장되지 않아요. 받은 날 바로 열어서 리워드를 확인하세요.
              </GuideTip>
            </GuideSection>

            <GuideSection
              step={3}
              title="계획 & 루틴 관리"
              icon={<CalendarDays className="h-5 w-5" />}
              accentColor="#17326B"
              tintColor="#E7ECF7"
            >
              <GuideStep
                icon={<CalendarDays className="h-4 w-4 text-[#17326B]" />}
                title="오늘 할 일 체크"
                body={<>하단 <Pill>계획</Pill> 탭에서 일/주 단위로 공부 할 일을 등록하고, 끝낼 때마다 체크하세요. 홈 카드에도 오늘의 할 일이 표시돼요.</>}
              />
              <GuideStep
                icon={<Target className="h-4 w-4 text-[#17326B]" />}
                title="시험 D-day·진로 목표"
                body={<>홈의 <Pill>시험 디데이 / 진로 목표</Pill> 카드에 시험일과 희망 학교/직업을 등록하면, 매일 남은 일수가 카운트다운돼요.</>}
              />
              <GuideStep
                icon={<Flame className="h-4 w-4 text-[#17326B]" />}
                title="매일 같은 시간"
                body={<>공부는 <strong>시간보다 규칙성</strong>이 중요해요. 같은 시간대에 오고 가는 습관이 가장 빠른 성장을 만들어요.</>}
              />
            </GuideSection>

            <GuideSection
              step={4}
              title="기록 & 성장 확인"
              icon={<History className="h-5 w-5" />}
              accentColor="#2554D7"
              tintColor="#EAF0FC"
            >
              <GuideStep
                icon={<History className="h-4 w-4 text-[#2554D7]" />}
                title="기록 탭"
                body={<>하단 <Pill>기록</Pill>에서 일자별 공부 시간, 세션 히스토리, 주/월 단위 추세를 볼 수 있어요.</>}
              />
              <GuideStep
                icon={<FileText className="h-4 w-4 text-[#2554D7]" />}
                title="선생님 리포트"
                body={<>홈의 <Pill>선생님 리포트</Pill> 카드에 새 리포트가 오면 빨간 뱃지가 떠요. 개인화된 피드백을 꼭 확인해 다음 공부에 반영하세요.</>}
              />
              <GuideStep
                icon={<Wallet className="h-4 w-4 text-[#2554D7]" />}
                title="포인트 내역"
                body={<><Pill>포인트</Pill> 탭에서 언제·어떤 활동으로 포인트를 얻었는지 전부 추적할 수 있어요.</>}
              />
            </GuideSection>

            <GuideSection
              step={5}
              title="출결 & 센터 요청"
              icon={<BellRing className="h-5 w-5" />}
              accentColor="#D97706"
              tintColor="#FEF3E0"
            >
              <GuideStep
                icon={<BellRing className="h-4 w-4 text-[#D97706]" />}
                title="지각·결석 신청"
                body={<>홈의 <Pill tone="amber">지각/결석 신청</Pill>에서 사유를 10자 이상 적어 제출하세요. 담당 선생님 승인 후 센터 규정에 따라 반영돼요.</>}
              />
              <GuideStep
                icon={<Wifi className="h-4 w-4 text-[#D97706]" />}
                title="와이파이 방화벽 해제"
                body={<>학습용 사이트가 차단돼 있으면 <Pill tone="amber">와이파이 요청</Pill>에서 주소와 이유를 적어 요청하세요. 상담 트랙으로 연결돼요.</>}
              />
              <GuideTip tone="amber">
                당일 지각 신청도 가능하지만, 가능하면 전날까지 미리 제출하는 게 좋아요.
              </GuideTip>
            </GuideSection>

            <GuideSection
              step={6}
              title="상담 & 피드백"
              icon={<MessageCircle className="h-5 w-5" />}
              accentColor="#17326B"
              tintColor="#E7ECF7"
            >
              <GuideStep
                icon={<MessageCircle className="h-4 w-4 text-[#17326B]" />}
                title="상담 신청"
                body={<>진로·학습·생활 무엇이든 하단 <Pill>상담</Pill>에서 신청할 수 있어요. 혼자 끙끙 앓지 말고 편하게 말해 주세요.</>}
              />
              <GuideStep
                icon={<BellRing className="h-4 w-4 text-[#17326B]" />}
                title="알림 확인"
                body={<>헤더의 <Pill>벨 아이콘</Pill>에 새 리포트·상담 답변·공지가 모여요. 숫자 뱃지가 뜨면 바로 열어 확인해요.</>}
              />
            </GuideSection>

            <GuideSection
              step={7}
              title="규칙 & 벌점"
              icon={<ShieldAlert className="h-5 w-5" />}
              accentColor="#EF476F"
              tintColor="#FFE8EE"
            >
              <GuideStep
                icon={<ShieldAlert className="h-4 w-4 text-[#EF476F]" />}
                title="벌점 제도"
                body={<>센터 규정 위반 시 벌점이 부여돼요. 홈의 <Pill tone="rose">나의 벌점 현황</Pill>에서 누적 점수와 반영 사유를 확인할 수 있어요.</>}
              />
              <GuideStep
                icon={<Lightbulb className="h-4 w-4 text-[#EF476F]" />}
                title="벌점을 피하려면"
                body={<>자리 이탈 시 타이머 끄기, 휴대폰 사용 금지 시간 지키기, 조용한 학습 환경 유지하기 — 이 세 가지만 기억하면 충분해요.</>}
              />
            </GuideSection>

            <section className="rounded-[1.75rem] border border-[#D9E1F2] bg-white p-5 shadow-[0_18px_40px_-32px_rgba(10,28,72,0.18)]">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-[#FF7A16]" />
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#6781AE]">PRO TIPS</p>
              </div>
              <ul className="mt-3 space-y-2.5 text-[12px] font-semibold leading-5 text-[#17326B]">
                <li className="flex items-start gap-2">
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF7A16]" />
                  <span>헤더 좌상단의 기기 아이콘으로 <strong>모바일/데스크톱 뷰</strong>를 언제든 전환할 수 있어요.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF7A16]" />
                  <span>홈의 <strong>오늘의 트랙</strong> 카드를 탭하면 오늘 공부한 세션이 전부 펼쳐져요.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF7A16]" />
                  <span>포인트 내역이 이상하면 당일 <Pill>상담</Pill>에서 바로 문의하세요.</span>
                </li>
                <li className="flex items-start gap-2">
                  <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF7A16]" />
                  <span>성장 그래프는 일주일 단위로 확인하면 변화가 잘 보여요.</span>
                </li>
              </ul>
            </section>
          </div>

          <div className={cn(
            "bg-white border-t shrink-0 flex items-center justify-between",
            isMobileView ? "p-4" : "p-6"
          )}>
            <p className="text-[11px] font-bold text-[#6781AE]">도움이 더 필요하면 <span className="text-[#FF7A16]">상담</span>으로!</p>
            <Button onClick={() => setIsSupportOpen(false)} className="rounded-xl font-black px-8 h-12 shadow-lg active:scale-95 transition-all">
              확인했어요
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
