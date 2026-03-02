
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Activity,
  ArrowUpRight,
  ClipboardCheck,
  Clock,
  TrendingUp,
  Loader2,
  Play,
  Trophy,
  Zap,
  Square,
  Timer,
  Info,
  CalendarClock,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  CircleDot,
  History,
  RefreshCw,
  ListTodo,
  Sparkles,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { DailyStudentStat, StudyPlanItem, WithId, StudyLogDay, GrowthProgress, StudentProfile } from '@/lib/types';
import { doc, collection, query, where, updateDoc, setDoc, serverTimestamp, increment, getDoc } from 'firebase/firestore';
import { format, startOfDay } from 'date-fns';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { Progress } from '../ui/progress';

const AUTO_TERMINATE_SECONDS = 7200; 
const GRACE_PERIOD_SECONDS = 60; 
const getNextLevelXp = (level: number) => 1000 + (level - 1) * 300;

export function StudentDashboard({ isActive }: { isActive: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { 
    activeMembership, 
    isTimerActive, 
    setIsTimerActive, 
    startTime,
    setStartTime,
    lastActiveCheckTime,
    setLastActiveCheckTime,
    viewMode
  } = useAppContext();
  
  const [today, setToday] = useState<Date | null>(null);
  const isMobile = viewMode === 'mobile';
  
  useEffect(() => {
    setToday(new Date());
  }, []);

  const todayKey = today ? format(today, 'yyyy-MM-dd') : '';
  const weekKey = today ? format(today, "yyyy-'W'II") : '';

  const [localSeconds, setLocalSeconds] = useState(0);
  const [showSessionAlert, setShowSessionAlert] = useState(false);
  const [gracePeriod, setGracePeriod] = useState(GRACE_PERIOD_SECONDS);

  const isLevelingUp = useRef(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && startTime) {
      setLocalSeconds(Math.floor((Date.now() - startTime) / 1000));
      interval = setInterval(() => {
        setLocalSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setLocalSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, startTime]);

  // 학생 프로필 정보 (좌석 번호 확인용)
  const studentProfileRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'students', user.uid);
  }, [firestore, activeMembership, user]);
  const { data: studentProfile } = useDoc<StudentProfile>(studentProfileRef, { enabled: isActive });

  const dailyStatRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || !todayKey) return null;
    return doc(firestore, 'centers', activeMembership.id, 'dailyStudentStats', todayKey, 'students', user.uid);
  }, [firestore, activeMembership, user, todayKey]);
  const { data: dailyStat, isLoading: dailyStatLoading } = useDoc<DailyStudentStat>(dailyStatRef, { enabled: isActive });

  const studyLogRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || !todayKey) return null;
    return doc(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days', todayKey);
  }, [firestore, activeMembership, user, todayKey]);
  const { data: todayStudyLog } = useDoc<StudyLogDay>(studyLogRef, { enabled: isActive });

  const allPlansRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || !weekKey || !todayKey) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items'),
      where('dateKey', '==', todayKey)
    );
  }, [firestore, activeMembership, user, weekKey, todayKey]);
  const { data: todayPlans, isLoading: plansLoading } = useCollection<StudyPlanItem>(allPlansRef, { enabled: isActive });
  
  const scheduleItems = useMemo(() => todayPlans?.filter(p => p.category === 'schedule') || [], [todayPlans]);
  const studyTasks = useMemo(() => todayPlans?.filter(p => p.category === 'study' || !p.category) || [], [todayPlans]);

  const todayCompletionRate = useMemo(() => {
    if (!studyTasks || studyTasks.length === 0) return 0;
    const doneCount = studyTasks.filter(t => t.done).length;
    return (doneCount / studyTasks.length) * 100;
  }, [studyTasks]);

  const saveStudyTime = async () => {
    if (!firestore || !user || !activeMembership || !studyLogRef || !startTime || !todayKey) return;
    
    const sessionMinutes = Math.floor((Date.now() - startTime) / 60000);
    if (sessionMinutes <= 0) return;

    const data = {
      totalMinutes: increment(sessionMinutes),
      uid: user.uid,
      centerId: activeMembership.id,
      dateKey: todayKey,
      updatedAt: serverTimestamp(),
      studentId: user.uid,
      createdAt: serverTimestamp(),
    };

    setDoc(studyLogRef, data, { merge: true });

    const progressRef = doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
    await setDoc(progressRef, {
      stats: {
        focus: increment(sessionMinutes / 1000),
        consistency: increment(0.1), 
      },
      currentXp: increment(sessionMinutes), 
      updatedAt: serverTimestamp()
    }, { merge: true });
  };

  const handleStudyStartStop = async () => {
    if (!firestore || !user || !activeMembership || !studyLogRef) return;

    if (isTimerActive) {
      // 종료 시 좌석 상태 업데이트 - setDoc merge 사용하여 문서가 없어도 생성되게 함
      if (studentProfile?.seatNo) {
        const seatId = `seat_${studentProfile.seatNo.toString().padStart(3, '0')}`;
        const seatRef = doc(firestore, 'centers', activeMembership.id, 'attendanceCurrent', seatId);
        setDoc(seatRef, { status: 'absent', updatedAt: serverTimestamp() }, { merge: true });
      }

      await saveStudyTime();
      setIsTimerActive(false);
      setStartTime(null);
      setLastActiveCheckTime(null);
      toast({ title: "트랙 종료 및 기록 완료" });
    } else {
      const now = Date.now();
      
      // 시작 시 좌석 상태 업데이트 - setDoc merge 사용하여 더 안정적으로 업데이트
      if (studentProfile?.seatNo) {
        const seatId = `seat_${studentProfile.seatNo.toString().padStart(3, '0')}`;
        const seatRef = doc(firestore, 'centers', activeMembership.id, 'attendanceCurrent', seatId);
        setDoc(seatRef, { 
          status: 'studying', 
          lastCheckInAt: serverTimestamp(),
          updatedAt: serverTimestamp() 
        }, { merge: true });
      }

      setStartTime(now);
      setLastActiveCheckTime(now);
      setIsTimerActive(true);
      toast({ title: "학습 트랙을 시작합니다!" });
    }
  };

  if (!isActive) return null;

  const totalMinutes = (todayStudyLog?.totalMinutes || 0) + Math.floor(localSeconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  return (
    <div className={cn("flex flex-col gap-6 sm:gap-8 pb-20", isMobile ? "px-0" : "px-0")}>
      <section className={cn("group relative overflow-hidden bg-primary text-primary-foreground shadow-2xl border-b-4 sm:border-b-8 border-black/20 transition-all", isMobile ? "rounded-[2.5rem] p-8 mx-0" : "rounded-[3rem] p-12")}>
        <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-10 rotate-12 transition-transform duration-700 group-hover:scale-110">
          <Zap className="h-48 w-48 sm:h-64 sm:w-64" />
        </div>
        
        <div className={cn("relative z-10 flex flex-col gap-8", isMobile ? "items-center text-center" : "md:flex-row md:justify-between md:text-left")}>
          <div className="space-y-4">
            <h2 className={cn("font-black tracking-tighter leading-[1.15]", isMobile ? "text-3xl" : "text-5xl")}>
              {isTimerActive ? "몰입의 정점에\n도착하셨네요!" : "오늘의 트랙을\n시작해볼까요?"}
            </h2>
            <div className={cn("flex items-center gap-2 bg-white/10 backdrop-blur-md w-fit px-4 py-2 rounded-full border border-white/10", isMobile ? "mx-auto" : "md:mx-0")}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 whitespace-nowrap">Live Study Tracker</span>
            </div>
          </div>
          
          <div className={cn("flex flex-col sm:flex-row items-center gap-5 sm:gap-6 w-full md:w-auto")}>
            {isTimerActive && (
              <div className={cn("flex flex-col items-center bg-white/10 backdrop-blur-2xl rounded-[2rem] border border-white/10 shadow-2xl shrink-0 w-full sm:w-auto", isMobile ? "px-8 py-5" : "px-10 py-6")}>
                <span className="text-[9px] font-black uppercase tracking-[0.25em] opacity-50 mb-1">Session Progress</span>
                <span className="font-mono font-black tracking-tighter tabular-nums text-accent text-5xl leading-none">
                  {Math.floor(localSeconds / 60).toString().padStart(2, '0')}:{(localSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}
            
            <Button size="lg" className={cn("w-full rounded-[2.5rem] font-black transition-all md:w-auto shadow-2xl active:scale-95", isMobile ? "h-16 text-xl" : "h-20 px-12 text-2xl", isTimerActive ? "bg-destructive" : "bg-accent")} onClick={handleStudyStartStop}>
              {isTimerActive ? <>트랙 종료 <Square className="ml-2 h-6 w-6 fill-current" /></> : <>트랙 시작 <Play className="ml-2 h-6 w-6 fill-current" /></>}
            </Button>
          </div>
        </div>
      </section>

      <div className={cn("grid gap-4", isMobile ? "px-0 grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-4")}>
        <Card className="border-none shadow-md bg-white rounded-[2rem] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-6 pt-6">
            <CardTitle className="font-black uppercase tracking-widest text-muted-foreground text-xs">오늘의 몰입</CardTitle>
            <div className="bg-primary/5 p-1.5 rounded-lg"><Clock className="h-4 w-4 text-primary/60" /></div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="font-black tracking-tighter text-primary text-4xl">
              {h}<span className="text-sm ml-1.5 opacity-40 font-bold">h</span> {m}<span className="text-sm ml-1.5 opacity-40 font-bold">m</span>
            </div>
            <p className="font-bold text-muted-foreground/60 text-[10px] mt-2.5">목표 시간 대비 {Math.round((totalMinutes/360)*100)}% 달성</p>
          </CardContent>
        </Card>
      </div>

      <div className={cn("grid gap-6", isMobile ? "px-0 grid-cols-1" : "lg:grid-cols-3")}>
        <Card className={cn("border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/[0.03]", isMobile ? "" : "lg:col-span-2")}>
          <CardHeader className="bg-muted/10 border-b p-8">
            <CardTitle className="font-black flex items-center gap-3 tracking-tighter text-3xl">
              <ListTodo className="h-8 w-8 text-primary" /> 오늘의 학습 계획
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            {studyTasks.map((task) => (
              <div key={task.id} className={cn("flex items-center gap-5 p-6 rounded-[2rem] border-2 transition-all mb-4", task.done ? "bg-emerald-50/20 border-emerald-100/50" : "bg-white border-transparent shadow-sm")}>
                <Checkbox id={task.id} checked={task.done} onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} className="h-8 w-8 rounded-xl border-2" />
                <Label htmlFor={task.id} className={cn("flex-1 font-bold text-lg", task.done && "line-through text-muted-foreground/40 italic")}>{task.title}</Label>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/[0.03]">
          <CardHeader className="bg-accent/5 border-b p-8">
            <CardTitle className="font-black flex items-center gap-3 tracking-tighter text-accent">
              <Timer className="h-8 w-8" /> 오늘의 루틴
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-4">
              {scheduleItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-6 rounded-[2rem] bg-muted/20">
                  <span className="font-bold">{item.title.split(': ')[0]}</span>
                  <span className="font-mono font-black text-accent text-lg">{item.title.split(': ')[1] || '--:--'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
