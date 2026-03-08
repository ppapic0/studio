
'use client';

import { use, useState, useMemo, useEffect, useRef } from 'react';
import { useDoc, useCollection, useFirestore, useFunctions, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc, collection, query, where, writeBatch, serverTimestamp, addDoc, Timestamp, updateDoc, orderBy, getDocs, limit, setDoc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Loader2, 
  ArrowLeft, 
  Building2,
  TrendingUp,
  Zap,
  Clock,
  Trophy,
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  Settings2,
  UserCheck,
  Lock,
  Activity,
  CalendarPlus,
  FileEdit,
  MessageSquare,
  BarChart3,
  Sparkles,
  History,
  CheckCircle2,
  AlertCircle,
  ClipboardCheck,
  Target,
  ShieldCheck,
  User,
  PieChart as PieChartIcon,
  Crown,
  Medal,
  Star,
  RefreshCw,
  Check,
  X,
  ListTodo,
  Timer,
  CalendarCheck,
  Coffee,
  School,
  ArrowRightLeft,
  LayoutGrid,
  Save,
  Wand2,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StudentProfile, StudyLogDay, GrowthProgress, LeaderboardEntry, CenterMembership, CounselingLog, CounselingReservation, StudyPlanItem, WithId, InviteCode, StudySession, KpiDaily } from '@/lib/types';
import { format, subDays, addDays, startOfDay, startOfWeek, isSameDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

const STAT_CONFIG = {
  focus: { label: '집중력', sub: 'FOCUS', icon: Target, color: 'text-blue-500', bg: 'bg-blue-500', accent: 'bg-blue-50', guide: '몰입 시간에 비례하여 상승' },
  consistency: { label: '꾸준함', sub: 'CONSISTENCY', icon: RefreshCw, color: 'text-emerald-500', bg: 'bg-emerald-500', accent: 'bg-emerald-50', guide: '매일 트랙 시작 시 상승' },
  achievement: { label: '목표달성', sub: 'ACHIEVEMENT', icon: CheckCircle2, color: 'text-amber-500', bg: 'bg-amber-500', accent: 'bg-amber-50', guide: 'To-do 완료 시 상승' },
  resilience: { label: '회복력', sub: 'RESILIENCE', icon: ShieldCheck, color: 'text-rose-500', bg: 'bg-rose-500', accent: 'bg-rose-50', guide: '장기 학습 달성 시 상승' },
};

const CustomTooltip = ({ active, payload, label, unit = '시간' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-xl border-2 border-primary/10 p-5 rounded-[1.5rem] shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in duration-300">
        <div className="flex items-center gap-2 mb-2"><div className="w-2 h-2 rounded-full bg-primary animate-pulse" /><p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{label}</p></div>
        <div className="flex items-baseline gap-1.5"><span className="text-3xl font-black text-primary tracking-tighter drop-shadow-sm">{payload[0].value}</span><span className="text-xs font-black text-primary/60">{unit}</span></div>
      </div>
    );
  }
  return null;
};

function StatAnalysisCard({ title, value, subValue, icon: Icon, colorClass, isMobile, onClick, href, isActive }: any) {
  const content = (
    <Card className={cn(
      "border-none shadow-md overflow-hidden relative bg-white rounded-[1.5rem] sm:rounded-[2rem] transition-all",
      (onClick || href) && "hover:shadow-xl active:scale-[0.98] cursor-pointer hover:bg-muted/5",
      isActive && "ring-4 ring-primary ring-offset-4 scale-[1.02] shadow-2xl z-10"
    )}>
      <div className={cn("absolute top-0 left-0 w-1 h-full", colorClass.replace('text-', 'bg-'))} />
      <CardHeader className={cn("pb-1 flex flex-row items-center justify-between", isMobile ? "px-3 pt-3" : "px-6 pt-6")}>
        <CardTitle className={cn("font-black text-muted-foreground uppercase", isMobile ? "text-[8px]" : "text-[10px]")}>{title}</CardTitle>
        <div className={cn("rounded-lg bg-opacity-10", isMobile ? "p-1.5" : "p-2", colorClass.replace('text-', 'bg-'))}><Icon className={cn(isMobile ? "h-3.5 w-3.5" : "h-4 w-4", colorClass)} /></div>
      </CardHeader>
      <CardContent className={cn(isMobile ? "px-3 pb-3" : "px-6 pb-6")}><div className={cn("font-black tracking-tighter", isMobile ? "text-lg leading-tight" : "text-2xl")}>{value}</div><p className={cn("font-bold text-muted-foreground mt-0.5", isMobile ? "text-[8px]" : "text-[9px]")}>{subValue}</p></CardContent>
    </Card>
  );
  if (href) return <Link href={href}>{content}</Link>;
  if (onClick) return <div onClick={onClick}>{content}</div>;
  return content;
}

export default function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: studentId } = use(params);
  const { user: currentUser } = useUser();
  const { activeMembership, viewMode } = useAppContext();
  const firestore = useFirestore();
  const functions = useFunctions();
  const { toast } = useToast();
  const router = useRouter();

  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const periodKey = format(new Date(), 'yyyy-MM');
  const hasInitializedForm = useRef(false);

  const [activeTab, setActiveTab] = useState('overview');
  const [focusedChartView, setFocusedChartView] = useState<'today' | 'weekly' | 'monthly'>('monthly');
  const [selectedDateForPlan, setSelectedDateForPlan] = useState<Date>(new Date());

  const [aptDate, setAptDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [aptTime, setAptTime] = useState('14:00');
  const [aptNote, setAptNote] = useState('');
  const [logType, setLogType] = useState<'academic' | 'life' | 'career'>('academic');
  const [logContent, setLogContent] = useState('');
  const [logImprovement, setLogImprovement] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMasteryModalOpen, setIsMasteryModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedResForLog, setSelectedResForLog] = useState<CounselingReservation | null>(null);

  const [isEditStats, setIsEditStats] = useState(false);
  const [editLp, setEditLp] = useState(0);
  const [editStats, setEditStats] = useState({ focus: 0, consistency: 0, achievement: 0, resilience: 0 });
  const [editTodayMinutes, setEditTodayMinutes] = useState(0);

  const studentRef = useMemoFirebase(() => (!firestore || !centerId) ? null : doc(firestore, 'centers', centerId, 'students', studentId), [firestore, centerId, studentId]);
  const { data: student, isLoading: studentLoading } = useDoc<StudentProfile>(studentRef);

  const progressRef = useMemoFirebase(() => (!firestore || !centerId) ? null : doc(firestore, 'centers', centerId, 'growthProgress', studentId), [firestore, centerId, studentId]);
  const { data: progress } = useDoc<GrowthProgress>(progressRef);

  useEffect(() => {
    if (progress) {
      setEditLp(progress.seasonLp || 0);
      setEditStats({ focus: progress.stats?.focus || 0, consistency: progress.stats?.consistency || 0, achievement: progress.stats?.achievement || 0, resilience: progress.stats?.resilience || 0 });
    }
  }, [progress]);

  const [editForm, setEditForm] = useState({ name: '', schoolName: '', grade: '', password: '', parentLinkCode: '', className: '' });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [statusForm, setStatusForm] = useState<string>('active');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (student && !hasInitializedForm.current) {
      setEditForm({ name: student.name, schoolName: student.schoolName, grade: student.grade, password: '', parentLinkCode: student.parentLinkCode || '', className: student.className || '' });
      hasInitializedForm.current = true;
    }
  }, [student]);

  const handleUpdateInfo = async () => {
    if (!functions || !centerId || !studentId || !firestore) return;
    setIsUpdating(true);
    try {
      const updateFn = httpsCallable(functions, 'updateStudentAccount', { timeout: 600000 });
      await updateFn({ studentId, centerId, displayName: editForm.name, schoolName: editForm.schoolName, grade: editForm.grade, password: editForm.password.length >= 6 ? editForm.password : undefined, parentLinkCode: editForm.parentLinkCode.trim() || null });
      const batch = writeBatch(firestore);
      const upd = { className: editForm.className, updatedAt: serverTimestamp() };
      batch.update(doc(firestore, 'centers', centerId, 'members', studentId), upd);
      batch.update(doc(firestore, 'centers', centerId, 'students', studentId), upd);
      batch.update(doc(firestore, 'userCenters', studentId, 'centers', centerId), upd);
      await batch.commit();
      toast({ title: "정보 수정 완료" });
      setIsEditModalOpen(false);
    } catch (e) { toast({ variant: "destructive", title: "수정 실패" }); } finally { setIsUpdating(false); }
  };

  const handleUpdateGrowthData = async () => {
    if (!firestore || !centerId || !studentId) return;
    setIsUpdating(true);
    try {
      const batch = writeBatch(firestore);
      const pRef = doc(firestore, 'centers', centerId, 'growthProgress', studentId);
      const rRef = doc(firestore, 'centers', centerId, 'leaderboards', `${periodKey}_lp`, 'entries', studentId);
      const sRef = doc(firestore, 'centers', centerId, 'dailyStudentStats', todayKey, 'students', studentId);
      batch.update(pRef, { seasonLp: editLp, stats: editStats, updatedAt: serverTimestamp() });
      batch.set(sRef, { totalStudyMinutes: editTodayMinutes, updatedAt: serverTimestamp() }, { merge: true });
      batch.set(rRef, { studentId, displayNameSnapshot: student?.name || '학생', value: editLp, updatedAt: serverTimestamp() }, { merge: true });
      await batch.commit();
      toast({ title: "성장 지표 보정 완료" });
      setIsEditStats(false);
    } catch (e) { toast({ variant: "destructive", title: "수정 실패" }); } finally { setIsUpdating(false); }
  };

  const handleDeleteAccount = async () => {
    if (!functions || !centerId || !studentId) return;
    setIsUpdating(true);
    try {
      const deleteFn = httpsCallable(functions, 'deleteStudentAccount', { timeout: 600000 });
      const result: any = await deleteFn({ studentId, centerId });
      if (result.data?.ok) { toast({ title: "영구 삭제 완료" }); router.replace('/dashboard/teacher/students'); }
    } catch (e) { toast({ variant: "destructive", title: "삭제 실패" }); } finally { setIsUpdating(false); }
  };

  if (studentLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

  return (
    <div className={cn("flex flex-col gap-6 max-w-6xl mx-auto pb-24 px-4")}>
      <div className="flex justify-between items-end gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 shrink-0 mt-1" asChild><Link href="/dashboard/teacher/students"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <div className="flex items-center gap-2"><h1 className="font-black tracking-tighter truncate text-4xl">{student?.name || '학생'}</h1><Badge className="bg-primary text-white px-2 py-0.5 rounded-full font-black text-[10px]">{student?.seatNo || '미배정'}번 좌석</Badge></div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-bold"><span className="flex items-center gap-1 text-primary"><Building2 className="h-3.5 w-3.5" /> {student?.schoolName}</span><span className="opacity-30">|</span><span>{student?.grade}</span><span className="opacity-30">|</span><span className="flex items-center gap-1 text-emerald-600"><LayoutGrid className="h-3 w-3" /> {student?.className || '반 미지정'}</span></div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-2xl font-black h-11 px-6 text-xs gap-2" onClick={() => setIsEditModalOpen(true)}><Settings2 className="h-4 w-4" /> 정보 수정</Button>
          <Button variant="destructive" className="rounded-2xl font-black h-11 px-6 text-xs gap-2" onClick={() => { if(confirm("영구 삭제하시겠습니까?")) handleDeleteAccount(); }}><Trash2 className="h-4 w-4" /> 계정 강제 삭제</Button>
        </div>
      </div>

      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatAnalysisCard title="현재 보유 LP" value={`${(progress?.seasonLp || 0).toLocaleString()} LP`} subValue="시즌 누적 성취" icon={Zap} colorClass="text-emerald-500" isMobile={isMobile} onClick={() => setIsMasteryModalOpen(true)} />
        <StatAnalysisCard title="실력 지수" value="분석 보기" subValue="4대 스킬 관리" icon={Target} colorClass="text-blue-500" isMobile={isMobile} onClick={() => setIsMasteryModalOpen(true)} />
      </section>

      <Dialog open={isMasteryModalOpen} onOpenChange={setIsMasteryModalOpen}>
        <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col sm:max-w-xl max-h-[90vh]">
          <div className="bg-purple-600 p-10 text-white relative shrink-0">
            <Zap className="absolute top-0 right-0 p-8 h-32 w-32 opacity-20 rotate-12" />
            <DialogHeader>
              <div className="flex justify-between items-center"><Badge className="bg-white/20 text-white border-none font-black text-[10px] px-2.5 py-0.5 uppercase tracking-widest">Growth Management</Badge>{!isEditStats && <Button variant="ghost" size="sm" onClick={() => setIsEditStats(true)} className="text-white hover:bg-white/10 gap-2 h-8 rounded-lg font-black text-xs"><Settings2 className="h-3.5 w-3.5" /> 수동 보정</Button>}</div>
              <DialogTitle className="text-3xl font-black tracking-tighter">성장 및 스킬 마스터 관리</DialogTitle>
            </DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto bg-white p-10 space-y-10 custom-scrollbar">
            <section className="space-y-4">
              <h4 className="text-xs font-black uppercase text-primary/60 flex items-center gap-2"><Trophy className="h-4 w-4" /> 시즌 보유 LP 수정</h4>
              <Card className="rounded-[1.5rem] border-2 border-primary/5 bg-muted/5 p-6 flex flex-col items-center text-center gap-4">
                {isEditStats ? (
                  <div className="w-full space-y-4">
                    <Slider value={[editLp]} max={50000} step={100} onValueChange={([v]) => setEditLp(v)} />
                    <Input type="number" value={editLp} onChange={e => setEditLp(Number(e.target.value))} className="h-12 rounded-xl text-center font-black text-xl border-2" />
                  </div>
                ) : (
                  <div className="text-5xl font-black text-primary">{(progress?.seasonLp || 0).toLocaleString()}<span className="text-xl opacity-20 ml-1">LP</span></div>
                )}
              </Card>
            </section>
            {isEditStats && (
              <section className="space-y-4">
                <h4 className="text-xs font-black uppercase text-blue-600 flex items-center gap-2"><Timer className="h-4 w-4" /> 오늘 공부 시간 보정 (분)</h4>
                <Input type="number" value={editTodayMinutes} onChange={e => setEditTodayMinutes(Number(e.target.value))} className="h-14 rounded-2xl border-blue-200 font-black text-2xl text-center text-blue-600" />
              </section>
            )}
            <section className="space-y-6">
              <h4 className="text-xs font-black uppercase text-primary/60 flex items-center gap-2"><Activity className="h-4 w-4" /> 핵심 역량 분석 (Stats)</h4>
              <div className="grid gap-8">
                {Object.entries(STAT_CONFIG).map(([key, config]) => {
                  const val = isEditStats ? (editStats[key as keyof typeof editStats] || 0) : (progress?.stats?.[key as keyof typeof progress.stats] || 0);
                  const Icon = config.icon;
                  return (
                    <div key={key} className="space-y-3">
                      <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className={cn("p-2 rounded-xl", config.accent)}><Icon className={cn("h-5 w-5", config.color)} /></div><div><p className="text-sm font-black tracking-tight">{config.label}</p><p className="text-[10px] font-bold text-muted-foreground uppercase">{config.sub}</p></div></div><div className="text-right flex items-baseline gap-1"><span className="text-2xl font-black tabular-nums">{val.toFixed(1)}</span><span className="text-[10px] font-bold text-muted-foreground/40">/ 100</span></div></div>
                      {isEditStats ? <Slider value={[val]} max={100} step={0.5} onValueChange={([v]) => setEditStats({...editStats, [key]: v})} /> : <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden shadow-inner"><div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${val}%` }} /></div>}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
          <DialogFooter className="p-8 bg-muted/20 border-t shrink-0">{isEditStats ? <div className="flex gap-3 w-full"><Button variant="outline" onClick={() => setIsEditStats(false)} className="flex-1 h-14 rounded-2xl font-black border-2">취소</Button><Button onClick={handleUpdateGrowthData} disabled={isUpdating} className="flex-2 h-14 px-10 rounded-2xl font-black text-lg shadow-xl gap-2">{isUpdating ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />} 정보 저장</Button></div> : <DialogClose asChild><Button className="w-full h-14 rounded-2xl font-black text-lg">닫기</Button></DialogClose>}</DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-primary p-10 text-white"><DialogTitle className="text-3xl font-black tracking-tighter">프로필 수정</DialogTitle></div>
          <div className="p-10 space-y-5 bg-white">
            <div className="grid gap-4">
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">이름</Label><Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="rounded-xl h-12 border-2 font-bold" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">소속 반</Label><Select value={editForm.className || 'none'} onValueChange={v => setEditForm({...editForm, className: v === 'none' ? '' : v})}><SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="none" className="font-bold">미배정</SelectItem>{availableClasses.map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">학교</Label><Input value={editForm.schoolName} onChange={e => setEditForm({...editForm, schoolName: e.target.value})} className="rounded-xl h-12 border-2 font-bold" /></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">학년</Label><Select value={editForm.grade} onValueChange={v => setEditForm({...editForm, grade: v})}><SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1학년">1학년</SelectItem><SelectItem value="2학년">2학년</SelectItem><SelectItem value="3학년">3학년</SelectItem><SelectItem value="N수생">N수생</SelectItem></SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter className="p-8 bg-muted/20 border-t"><Button onClick={handleUpdateInfo} disabled={isUpdating} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">정보 저장</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
