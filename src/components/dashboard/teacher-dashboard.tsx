'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  Armchair, 
  Loader2, 
  MessageSquare, 
  ChevronRight, 
  Activity, 
  Monitor,
  AlertCircle,
  Clock,
  Zap,
  Users,
  Trophy,
  User,
  Sparkles,
  ArrowRight,
  Settings2,
  UserPlus,
  Search,
  Check,
  X,
  Map as MapIcon,
  ArrowRightLeft,
  Grid3X3,
  Save,
  History,
  Timer,
  LogIn,
  LogOut,
  Filter,
  LayoutGrid,
  BarChart3,
  TrendingUp,
  FileText,
  FileSearch,
  ChevronLeft,
  CheckCircle2,
  Eye
} from 'lucide-react';
import { useCollection, useFirestore, useDoc } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { 
  collection, 
  query, 
  orderBy, 
  where,
  Timestamp,
  collectionGroup,
  doc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  setDoc,
  getDocs,
  limit
} from 'firebase/firestore';
import { StudentProfile, AttendanceCurrent, StudyLogDay, CounselingReservation, CenterMembership, StudySession, StudyPlanItem, DailyReport } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, subDays, eachDayOfInterval } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export function TeacherDashboard({ isActive }: { isActive: boolean }) {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const isMobile = viewMode === 'mobile';
  
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<number>(Date.now());
  const [selectedSeat, setSelectedSeat] = useState<AttendanceCurrent | null>(null);
  const [isManaging, setIsManaging] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedStudentSessions, setSelectedStudentSessions] = useState<StudySession[]>([]);
  const [selectedStudentReports, setSelectedStudentReports] = useState<DailyReport[]>([]);
  const [selectedStudentHistory, setSelectedStudentHistory] = useState<StudyLogDay[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  
  const [selectedClass, setSelectedClass] = useState<string>('all');

  const [gridRows, setGridRows] = useState(7);
  const [gridCols, setGridCols] = useState(10);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const centerId = activeMembership?.id;
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysAgoKey = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const centerRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId);
  }, [firestore, centerId]);
  const { data: centerData } = useDoc<any>(centerRef);

  useEffect(() => {
    if (centerData?.layoutSettings) {
      setGridRows(centerData.layoutSettings.rows || 7);
      setGridCols(centerData.layoutSettings.cols || 10);
    }
  }, [centerData]);

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'students'), orderBy('name', 'asc'));
  }, [firestore, centerId]);
  const { data: students, isLoading: studentsLoading } = useCollection<StudentProfile>(studentsQuery, { enabled: isActive });

  const studentMembersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'student'));
  }, [firestore, centerId]);
  const { data: studentMembers } = useCollection<CenterMembership>(studentMembersQuery, { enabled: isActive });

  const availableClasses = useMemo(() => {
    if (!studentMembers) return [];
    const classes = new Set<string>();
    studentMembers.forEach(m => {
      if (m.className) classes.add(m.className);
    });
    return Array.from(classes).sort();
  }, [studentMembers]);

  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isActive) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId, isActive]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery, { enabled: isActive });

  // 실시간 및 과거 로그 집계 (복잡한 인덱스 요구사항을 피하기 위해 단순화된 쿼리 사용)
  const historicalLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collectionGroup(firestore, 'days'),
      where('centerId', '==', centerId)
      // 인덱스 문제를 방지하기 위해 orderBy와 dateKey 필터링을 최소화하거나 클라이언트에서 수행합니다.
    );
  }, [firestore, centerId]);
  
  const { data: rawHistoricalLogs } = useCollection<StudyLogDay>(historicalLogsQuery, { enabled: isActive });

  const historicalLogs = useMemo(() => {
    if (!rawHistoricalLogs) return [];
    return [...rawHistoricalLogs]
      .filter(l => l.dateKey >= thirtyDaysAgoKey)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [rawHistoricalLogs, thirtyDaysAgoKey]);

  const centerTrendData = useMemo(() => {
    if (!historicalLogs) return [];
    const days = eachDayOfInterval({ start: subDays(new Date(), 29), end: new Date() });
    return days.map(day => {
      const dStr = format(day, 'yyyy-MM-dd');
      const dayLogs = historicalLogs.filter(l => l.dateKey === dStr);
      const totalMinutes = dayLogs.reduce((acc, curr) => acc + (curr.totalMinutes || 0), 0);
      return {
        name: format(day, 'MM/dd'),
        hours: Number((totalMinutes / 60).toFixed(1)),
        dateKey: dStr
      };
    });
  }, [historicalLogs]);

  const todayLogs = useMemo(() => {
    return historicalLogs?.filter(l => l.dateKey === todayKey) || [];
  }, [historicalLogs, todayKey]);

  const recentReportsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'dailyReports'),
      where('status', '==', 'sent'),
      orderBy('updatedAt', 'desc'),
      limit(5)
    );
  }, [firestore, centerId]);
  const { data: recentReportsFeed } = useCollection<DailyReport>(recentReportsQuery, { enabled: isActive });

  const plansQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collectionGroup(firestore, 'items'),
      where('centerId', '==', centerId),
      where('category', '==', 'schedule'),
      where('dateKey', '==', todayKey)
    );
  }, [firestore, centerId, todayKey]);
  const { data: centerTodayPlans } = useCollection<StudyPlanItem>(plansQuery, { enabled: isActive });

  const appointmentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    const todayDate = new Date();
    return query(
      collection(firestore, 'centers', centerId, 'counselingReservations'), 
      where('scheduledAt', '>=', Timestamp.fromDate(startOfDay(todayDate))), 
      where('scheduledAt', '<=', Timestamp.fromDate(endOfDay(todayDate)))
    );
  }, [firestore, centerId]);
  const { data: rawAppointments, isLoading: aptLoading } = useCollection<CounselingReservation>(appointmentsQuery, { enabled: isActive });

  const appointments = useMemo(() => rawAppointments ? [...rawAppointments].sort((a,b)=>(b.scheduledAt?.toMillis()||0)-(a.createdAt?.toMillis()||0)) : [], [rawAppointments]);

  const unassignedStudents = useMemo(() => {
    if (!students || !studentMembers) return [];
    return students.filter(s => {
      const membership = studentMembers.find(m => m.id === s.id);
      return membership?.status === 'active' && (!s.seatNo || s.seatNo === 0);
    }).filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [students, studentMembers, searchTerm]);

  const getStudentStatusLogic = (studentId: string, status: string, totalMinutes: number) => {
    if (!centerTodayPlans) return { isAlert: false, schedule: { in: null, out: null }, isAbsentMode: false };

    const myPlans = centerTodayPlans.filter(p => p.studentId === studentId);
    const isAbsentMode = myPlans.some(p => p.title.includes('등원하지 않습니다'));
    if (isAbsentMode) {
      return { isAlert: false, schedule: { in: '미등원', out: '미등원' }, isAbsentMode: true };
    }

    const inItem = myPlans.find(p => p.title.includes('등원 예정'));
    const outItem = myPlans.find(p => p.title.includes('하원 예정'));

    const schedule = {
      in: inItem ? inItem.title.split(': ')[1] || null : null,
      out: outItem ? outItem.title.split(': ')[1] || null : null
    };

    if (!schedule.in || !schedule.out) {
      return { isAlert: status === 'absent' && totalMinutes === 0, schedule, isAbsentMode: false };
    }

    if (status === 'absent' && totalMinutes === 0) {
      const [h, m] = schedule.in.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const plannedTime = new Date();
        plannedTime.setHours(h, m, 0, 0);
        if (now > plannedTime.getTime()) {
          return { isAlert: true, schedule, isAbsentMode: false };
        }
      }
    }

    return { isAlert: false, schedule, isAbsentMode: false };
  };

  const getStudentStudyTimes = (studentId: string, status: string, lastCheckInAt?: Timestamp) => {
    if (!mounted) return { session: '0h 0m', total: '0h 0m', isStudying: false, totalMins: 0 };
    
    const studentLog = todayLogs?.find(l => l.studentId === studentId);
    const cumulativeMinutes = studentLog?.totalMinutes || 0;
    
    let sessionMinutes = 0;
    if (status === 'studying' && lastCheckInAt) {
      const startTime = lastCheckInAt.toMillis();
      sessionMinutes = Math.floor((now - startTime) / 60000);
    }

    const totalMinutes = cumulativeMinutes + Math.max(0, sessionMinutes);

    const formatTime = (mins: number) => {
      const hh = Math.floor(mins / 60);
      const mm = mins % 60;
      return `${hh}h ${mm}m`;
    };

    return {
      session: formatTime(Math.max(0, sessionMinutes)),
      total: formatTime(totalMinutes),
      totalMins: totalMinutes,
      isStudying: status === 'studying'
    };
  };

  const stats = useMemo(() => {
    if (!mounted || !attendanceList || !studentMembers) return { studying: 0, absent: 0, away: 0, total: 0, totalCenterMinutes: 0, avgMinutes: 0, top20Avg: 0 };

    let studying = 0;
    let away = 0;
    let totalMins = 0;
    let filteredLiveMinutes: number[] = [];

    const filteredMemberIds = new Set(
      studentMembers
        .filter(m => (selectedClass === 'all' || m.className === selectedClass) && m.status === 'active')
        .map(m => m.id)
    );

    attendanceList.forEach(seat => {
      if (seat.type !== 'aisle' && seat.studentId) {
        const isTargetStudent = filteredMemberIds.has(seat.studentId);
        
        if (isTargetStudent) {
          const status = seat.status || 'absent';
          const timeInfo = getStudentStudyTimes(seat.studentId, status, seat.lastCheckInAt);
          
          totalMins += timeInfo.totalMins;
          filteredLiveMinutes.push(timeInfo.totalMins);

          if (status === 'studying') studying++;
          else if (status === 'away' || status === 'break') away++;
        }
      }
    });

    const aisleIds = new Set(attendanceList.filter(s => s.type === 'aisle').map(s => s.id));
    let totalPhysicalSeats = 0;
    for(let i = 1; i <= gridRows * gridCols; i++) {
        const sid = `seat_${i.toString().padStart(3, '0')}`;
        if(!aisleIds.has(sid)) totalPhysicalSeats++;
    }

    let totalDisplayCount = selectedClass !== 'all' ? filteredMemberIds.size : totalPhysicalSeats;
    let absent = Math.max(0, totalDisplayCount - studying - away);

    const avgMinutes = filteredLiveMinutes.length > 0 ? Math.round(totalMins / filteredLiveMinutes.length) : 0;
    const sortedMinutes = [...filteredLiveMinutes].sort((a, b) => b - a);
    const top20Count = Math.max(1, Math.ceil(sortedMinutes.length * 0.2));
    const top20Avg = sortedMinutes.length > 0 ? Math.round(sortedMinutes.slice(0, top20Count).reduce((acc, m) => acc + m, 0) / top20Count) : 0;

    return { studying, absent, away, total: totalDisplayCount, totalCenterMinutes: totalMins, avgMinutes, top20Avg };
  }, [attendanceList, historicalLogs, studentMembers, selectedClass, now, mounted, gridRows, gridCols]);

  const fetchStudentDetails = async (studentId: string) => {
    if (!firestore || !centerId) return;
    setSessionsLoading(true);
    try {
      const sessionQ = query(
        collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', todayKey, 'sessions'),
        orderBy('startTime', 'desc')
      );
      const sessionSnap = await getDocs(sessionQ);
      setSelectedStudentSessions(sessionSnap.docs.map(d => ({ id: d.id, ...d.data() } as StudySession)));

      const reportQ = query(
        collection(firestore, 'centers', centerId, 'dailyReports'),
        where('studentId', '==', studentId),
        where('status', '==', 'sent'),
        orderBy('dateKey', 'desc'),
        limit(5)
      );
      const reportSnap = await getDocs(reportQ);
      setSelectedStudentReports(reportSnap.docs.map(d => ({ id: d.id, ...d.data() } as DailyReport)));

      const historyQ = query(
        collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days'),
        orderBy('dateKey', 'desc'),
        limit(7)
      );
      const historySnap = await getDocs(historyQ);
      setSelectedStudentHistory(historySnap.docs.map(d => d.data() as StudyLogDay));

    } catch (e) {
      console.error(e);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleSeatClick = (seat: AttendanceCurrent) => {
    setSelectedSeat(seat);
    if (isEditMode) {
      if (seat.studentId) setIsManaging(true);
      else setIsAssigning(true);
    } else {
      if (seat.studentId && seat.type !== 'aisle') {
        setIsManaging(true);
        fetchStudentDetails(seat.studentId);
      }
    }
  };

  const handleStatusUpdate = async (status: AttendanceCurrent['status']) => {
    if (!firestore || !centerId || !selectedSeat) return;
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id), { 
        status, 
        updatedAt: serverTimestamp(),
        ...(status === 'studying' ? { lastCheckInAt: serverTimestamp() } : {})
      });
      toast({ title: "상태 변경 완료" });
      setIsManaging(false);
    } catch (e) { toast({ variant: "destructive", title: "변경 실패" }); }
  };

  const handleSaveGridSettings = async () => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      await setDoc(doc(firestore, 'centers', centerId), {
        layoutSettings: { rows: gridRows, cols: gridCols, updatedAt: serverTimestamp() }
      }, { merge: true });
      toast({ title: "그리드 크기가 저장되었습니다." });
    } catch (e) { toast({ variant: "destructive", title: "저장 실패" }); } finally { setIsSaving(false); }
  };

  const handleToggleCellType = async () => {
    if (!firestore || !centerId || !selectedSeat) return;
    const nextType = selectedSeat.type === 'aisle' ? 'seat' : 'aisle';
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const seatRef = doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id);
      if (nextType === 'aisle' && selectedSeat.studentId) {
        batch.update(doc(firestore, 'centers', centerId, 'students', selectedSeat.studentId), { seatNo: 0, updatedAt: serverTimestamp() });
        batch.set(seatRef, { type: 'aisle', studentId: null, status: 'absent', updatedAt: serverTimestamp() }, { merge: true });
      } else {
        batch.set(seatRef, { type: nextType, updatedAt: serverTimestamp() }, { merge: true });
      }
      await batch.commit();
      toast({ title: nextType === 'aisle' ? "통로로 변경됨" : "좌석으로 변경됨" });
      setIsManaging(false);
      setIsAssigning(false);
    } catch (e) { toast({ variant: "destructive", title: "변경 실패" }); } finally { setIsSaving(false); }
  };

  const assignStudentToSeat = async (student: StudentProfile) => {
    if (!firestore || !centerId || !selectedSeat) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'centers', centerId, 'students', student.id), { seatNo: selectedSeat.seatNo, updatedAt: serverTimestamp() });
      batch.set(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id), { studentId: student.id, status: 'absent', type: 'seat', updatedAt: serverTimestamp() }, { merge: true });
      await batch.commit();
      toast({ title: `${student.name} 학생 배정 완료` });
      setIsAssigning(false);
      setSearchTerm('');
    } catch (e) { toast({ variant: "destructive", title: "배정 실패" }); } finally { setIsSaving(false); }
  };

  const unassignStudentFromSeat = async () => {
    if (!firestore || !centerId || !selectedSeat || !selectedSeat.studentId) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'centers', centerId, 'students', selectedSeat.studentId), { seatNo: 0, updatedAt: serverTimestamp() });
      batch.set(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id), { studentId: null, status: 'absent', updatedAt: serverTimestamp() }, { merge: true });
      await batch.commit();
      toast({ title: "배정 해제 완료" });
      setIsManaging(false);
    } catch (e) { toast({ variant: "destructive", title: "해제 실패" }); } finally { setIsSaving(false); }
  };

  if (!mounted) return (
    <div className="flex flex-col h-[70vh] w-full items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      <p className="font-black text-primary tracking-tighter uppercase opacity-40">Initializing Command Matrix...</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto pb-24 min-h-screen">
      <header className={cn("flex justify-between px-4 pt-6 gap-4", isMobile ? "flex-col" : "flex-row items-center")}>
        <div className="flex items-center gap-3">
          <Monitor className={cn("text-primary", isMobile ? "h-6 w-6" : "h-8 w-8")} />
          <div className="grid">
            <h1 className={cn("font-black tracking-tight", isMobile ? "text-2xl" : "text-3xl")}>실시간 관제 홈</h1>
            <p className={cn("font-bold text-muted-foreground uppercase tracking-[0.3em] mt-0.5 ml-1", isMobile ? "text-[8px]" : "text-[10px]")}>Command & Control Center</p>
          </div>
          <Badge className="bg-blue-600 text-white border-none font-black text-[10px] rounded-full px-2.5 h-5 tracking-tighter">LIVE</Badge>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border shadow-sm px-4">
            <Filter className="h-3.5 w-3.5 text-primary opacity-40" />
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="border-none shadow-none focus:ring-0 font-black text-xs h-8 w-[140px] bg-transparent">
                <SelectValue placeholder="반 선택" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-2xl">
                <SelectItem value="all" className="font-black">센터 전체 보기</SelectItem>
                {availableClasses.map(c => (
                  <SelectItem key={c} value={c} className="font-black">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className={cn("flex items-center gap-2 bg-white/80 backdrop-blur-md p-1.5 rounded-[1.25rem] border shadow-sm", isMobile ? "hidden" : "p-2 rounded-[1.5rem]")}>
            <div className="flex items-center gap-2 px-4 border-r">
              <Activity className="h-4 w-4 text-emerald-500" />
              <div className="grid leading-none">
                <span className="text-[8px] font-black text-muted-foreground uppercase">{selectedClass === 'all' ? 'Center' : selectedClass} Today Total</span>
                <span className="text-sm font-black text-emerald-600">{Math.floor(stats.totalCenterMinutes / 60)}h {stats.totalCenterMinutes % 60}m</span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 border-r">
              <Users className="h-4 w-4 text-blue-500" />
              <div className="grid leading-none">
                <span className="text-[8px] font-black text-muted-foreground uppercase">Avg Study</span>
                <span className="text-sm font-black text-blue-600">{Math.floor(stats.avgMinutes / 60)}h {stats.avgMinutes % 60}m</span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4">
              <Trophy className="h-4 w-4 text-amber-500" />
              <div className="grid leading-none">
                <span className="text-[8px] font-black text-muted-foreground uppercase">Top 20% Avg</span>
                <span className="text-sm font-black text-amber-600">{Math.floor(stats.top20Avg / 60)}h {stats.top20Avg % 60}m</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="px-4">
        <Card className="rounded-[2.5rem] border-none shadow-sm bg-white p-6 sm:p-8 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-1000"><TrendingUp className="h-32 w-32" /></div>
          <CardHeader className="p-0 mb-6">
            <div className="flex items-center justify-between">
              <div className="grid gap-1">
                <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" /> 최근 30일 센터 학습 추이
                </CardTitle>
                <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Historical Study Trend (Center Total Hours)</CardDescription>
              </div>
              <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-black text-[9px] px-2.5">PAST 30 DAYS</Badge>
            </div>
          </CardHeader>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={centerTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTrend" x1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" fontSize={9} fontWeight="bold" axisLine={false} tickLine={false} tick={{fill: '#999'}} />
                <YAxis fontSize={9} fontWeight="900" axisLine={false} tickLine={false} tick={{fill: '#999'}} />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 rounded-xl shadow-2xl border-none ring-1 ring-black/5">
                          <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">{label}</p>
                          <p className="text-base font-black text-emerald-600">{payload[0].value}h</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="hours" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" animationDuration={2000} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <section className={cn("grid gap-4 px-4", isMobile ? "grid-cols-2" : "md:grid-cols-4")}>
        {[
          { label: '학습 중', val: stats.studying, color: 'text-blue-600', icon: Activity },
          { label: '미입실', val: stats.absent, color: 'text-rose-500', icon: AlertCircle },
          { label: '외출/휴식', val: stats.away, color: 'text-amber-500', icon: Clock },
          { label: selectedClass === 'all' ? '전체 좌석' : `${selectedClass} 정원`, val: stats.total, color: 'text-primary', icon: Armchair, hasEdit: true }
        ].map((item, i) => (
          <Card key={i} className="rounded-[2rem] sm:rounded-[2.5rem] border-none shadow-sm bg-white p-5 sm:p-8 transition-all hover:shadow-md relative overflow-hidden group">
            <div className="flex justify-between items-start mb-2">
              <span className={cn("font-black text-muted-foreground uppercase tracking-widest", isMobile ? "text-[9px]" : "text-[11px]")}>{item.label}</span>
              <item.icon className={cn(isMobile ? "h-4 w-4" : "h-5 w-5", item.color)} />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={cn("font-black tracking-tighter", isMobile ? "text-3xl" : "text-5xl", item.color)}>{item.val}</div>
              {item.hasEdit && (
                <Button 
                  variant={isEditMode ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={cn(
                    "rounded-xl h-8 px-2.5 sm:h-9 sm:px-3 font-black text-[9px] sm:text-[10px] gap-1.5 transition-all shadow-sm",
                    isEditMode ? "bg-primary text-white" : "border-2 hover:bg-primary/5"
                  )}
                >
                  <Settings2 className="h-3.5 w-3.5" /> {!isMobile && (isEditMode ? '수정 완료' : '배치 수정')}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </section>

      {isEditMode && (
        <Card className="mx-4 rounded-[2.5rem] border-none shadow-xl bg-primary text-primary-foreground p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl"><Grid3X3 className="h-6 w-6 text-white" /></div>
            <div className="grid">
              <h3 className="text-xl font-black tracking-tight">그리드 크기 설정</h3>
              <p className="text-xs font-bold opacity-60">가로/세로 좌석 수를 조절하세요.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="grid gap-1.5">
              <Label className="text-[10px] font-black uppercase opacity-60 ml-1">가로</Label>
              <Input type="number" value={gridCols} onChange={e => setGridCols(Number(e.target.value))} className="w-20 h-12 bg-white text-primary rounded-xl font-black text-center" />
            </div>
            <X className="h-4 w-4 opacity-40 mt-6" />
            <div className="grid gap-1.5">
              <Label className="text-[10px] font-black uppercase opacity-60 ml-1">세로</Label>
              <Input type="number" value={gridRows} onChange={e => setGridRows(Number(e.target.value))} className="w-20 h-12 bg-white text-primary rounded-xl font-black text-center" />
            </div>
            <Button onClick={handleSaveGridSettings} disabled={isSaving} className="h-12 rounded-xl px-6 bg-white text-primary font-black hover:bg-white/90 gap-2 mt-6 shadow-xl active:scale-95 transition-all">
              {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />} 저장
            </Button>
          </div>
        </Card>
      )}

      <Card className={cn(
        "rounded-[3rem] border-none shadow-xl bg-white mx-4 overflow-hidden transition-all duration-500",
        isEditMode ? "ring-4 ring-primary/20" : ""
      )}>
        <CardHeader className={cn("bg-muted/5 border-b px-6 py-4 sm:px-10 sm:py-6")}>
          <div className="flex justify-between items-center">
            <CardTitle className={cn("font-black tracking-tight flex items-center gap-2", isMobile ? "text-lg" : "text-xl")}>
              <Armchair className={cn("opacity-40", isMobile ? "h-4 w-4" : "h-5 w-5")} /> 
              {isEditMode ? '배치 수정' : '좌석 상황판'}
              {selectedClass !== 'all' && <Badge variant="secondary" className="bg-primary/5 text-primary border-none ml-2">{selectedClass}</Badge>}
            </CardTitle>
            <Badge variant="outline" className="border-primary/40 font-black text-[9px] px-3 h-6 uppercase">{gridCols}x{gridRows}</Badge>
          </div>
        </CardHeader>
        <CardContent className={cn("flex justify-center", isMobile ? "p-4" : "p-6 sm:p-10")}>
          <ScrollArea className="w-full max-w-full">
            <div className={cn("rounded-[2.5rem] border-2 border-muted/30 bg-[#fafafa] w-fit mx-auto", isMobile ? "p-4" : "p-6 sm:p-10 shadow-inner")}>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(64px, 1fr))` }}>
                {Array.from({ length: gridCols }).map((_, colIndex) => (
                  <div key={colIndex} className="flex flex-col gap-2">
                    {Array.from({ length: gridRows }).map((_, rowIndex) => {
                      const seatNo = colIndex * gridRows + rowIndex + 1;
                      const seatId = `seat_${seatNo.toString().padStart(3, '0')}`;
                      const seat = attendanceList?.find(a => a.id === seatId) || { id: seatId, seatNo, status: 'absent', type: 'seat' } as AttendanceCurrent;
                      const student = students?.find(s => s.id === seat?.studentId);
                      const studentMember = studentMembers?.find(m => m.id === seat?.studentId);
                      const isFilteredOut = selectedClass !== 'all' && studentMember?.className !== selectedClass;
                      
                      const timeInfo = student ? getStudentStudyTimes(student.id, seat.status, seat.lastCheckInAt) : null;
                      const statusLogic = student ? getStudentStatusLogic(student.id, seat.status, timeInfo?.totalMins || 0) : { isAlert: false, isAbsentMode: false };

                      const isAisle = seat?.type === 'aisle';
                      const isStudying = timeInfo?.isStudying;
                      const isAlert = !isEditMode && statusLogic.isAlert;
                      const isAway = !isEditMode && (seat?.status === 'away' || seat?.status === 'break');
                      const isAbsentMode = statusLogic.isAbsentMode;

                      return (
                        <div key={seatNo} onClick={() => handleSeatClick(seat)} className={cn(
                          "aspect-square min-w-[64px] rounded-2xl flex flex-col items-center justify-center transition-all duration-500 relative overflow-hidden p-1 cursor-pointer shadow-sm border-2 outline-none",
                          isFilteredOut ? "opacity-20 grayscale border-transparent bg-muted/10" : 
                          isAisle ? "bg-transparent border-transparent text-transparent hover:bg-muted/10" : 
                          isStudying ? "bg-blue-600 border-blue-700 text-white shadow-xl scale-[1.03] z-10" : 
                          isAlert ? "bg-rose-500 border-rose-600 text-white shadow-lg" : 
                          isAway ? "bg-amber-500 border-amber-600 text-white" : 
                          isAbsentMode ? "bg-slate-100 border-slate-300 text-slate-400" : 
                          student ? "bg-white border-primary/30 text-primary" : "bg-white border-primary/40 text-primary/5 hover:border-primary/60",
                          isEditMode && isAisle && "border-dashed border-muted-foreground/20 bg-muted/5 text-muted-foreground/20"
                        )}>
                          {!isAisle && <span className={cn("text-[7px] font-black absolute top-1 left-1.5", isStudying || isAlert || isAway ? "opacity-60" : "opacity-40")}>{seatNo}</span>}
                          {isAisle ? (isEditMode && <MapIcon className="h-3 w-3 opacity-40" />) : student ? (
                            <div className="flex flex-col items-center gap-0.5 w-full px-0.5">
                              <span className="text-[10px] font-black truncate w-full text-center tracking-tighter leading-none mb-0.5">{student.name}</span>
                              <div className="flex flex-col items-center leading-[1.1]">
                                <span className={cn("text-[8px] font-black tracking-tighter", isStudying || isAlert || isAway ? "text-white" : "text-primary")}>{isAbsentMode ? '미등원' : `L: ${timeInfo?.session}`}</span>
                                <span className={cn("text-[8px] font-black tracking-tighter", isStudying || isAlert || isAway ? "text-white/90" : "text-primary/80")}>{isAbsentMode ? '-' : `T: ${timeInfo?.total}`}</span>
                              </div>
                              {isAlert && <AlertCircle className="h-2 w-2 text-white/80 mt-0.5 animate-pulse" />}
                              {isStudying && !isAlert && <Zap className="h-2 w-2 fill-current animate-pulse text-white/50 mt-0.5" />}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center"><span className="text-[7px] font-black tracking-tighter opacity-100 uppercase">Empty</span>{isEditMode && <UserPlus className="h-2.5 w-2.5 mt-0.5 text-primary/40" />}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      <div className={cn("grid gap-6 px-4", isMobile ? "grid-cols-1" : "lg:grid-cols-12")}>
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-black tracking-tighter">오늘 상담 현황</h2>
              <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-black h-6">{appointments.length}건</Badge>
            </div>
            <Button asChild variant="ghost" className="font-black text-xs text-muted-foreground hover:text-primary gap-2"><Link href="/dashboard/appointments">전체 관리 <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
          <div className="grid gap-3">
            {aptLoading ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div> : appointments.length === 0 ? (
              <div className="py-16 text-center bg-white/50 rounded-[2.5rem] border-2 border-dashed border-muted-foreground/10"><p className="font-black text-muted-foreground/30 text-sm italic">예정된 상담이 없습니다.</p></div>
            ) : appointments.map((apt) => (
              <Card key={apt.id} className="rounded-[2rem] border-none shadow-sm bg-white p-5 flex items-center justify-between group hover:shadow-md transition-all active:scale-[0.98]">
                <div className="flex items-center gap-4">
                  <div className="h-11 w-11 rounded-2xl bg-primary/5 border border-primary/10 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-black text-primary/60 leading-none">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'HH:mm') : ''}</span>
                  </div>
                  <div className="grid leading-tight min-w-0">
                    <span className="font-black text-sm truncate">{apt.studentName} 학생</span>
                    <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[200px]">{apt.studentNote || '상담 주제 미입력'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("font-black text-[9px] border-none", apt.status === 'requested' ? "bg-amber-50 text-amber-600" : "bg-emerald-500 text-white")}>{apt.status === 'requested' ? '승인대기' : '예약확정'}</Badge>
                  <ChevronRight className="h-4 w-4 opacity-20" />
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <FileSearch className="h-6 w-6 text-emerald-600" />
              <h2 className="text-2xl font-black tracking-tighter">최근 발송 리포트</h2>
            </div>
            <Button asChild variant="ghost" className="font-black text-xs text-muted-foreground hover:text-emerald-600 gap-2"><Link href="/dashboard/reports">리포트 센터 <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
          <div className="grid gap-3">
            {!recentReportsFeed || recentReportsFeed.length === 0 ? (
              <div className="py-16 text-center bg-white/50 rounded-[2.5rem] border-2 border-dashed border-muted-foreground/10"><p className="font-black text-muted-foreground/30 text-sm italic">최근 발송된 리포트가 없습니다.</p></div>
            ) : recentReportsFeed.map((report) => (
              <Card key={report.id} className="rounded-[2rem] border-none shadow-sm bg-white p-5 flex items-center justify-between group hover:shadow-md transition-all active:scale-[0.98]">
                <div className="flex items-center gap-4">
                  <div className="h-11 w-11 rounded-2xl bg-emerald-50 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-black text-emerald-600 leading-none">{report.dateKey.split('-')[2]}</span>
                    <span className="text-[7px] font-bold text-emerald-400 uppercase mt-0.5">{format(new Date(report.dateKey), 'MMM')}</span>
                  </div>
                  <div className="grid leading-tight min-w-0">
                    <span className="font-black text-sm truncate">{report.studentName} 학생</span>
                    <p className="text-[10px] font-bold text-muted-foreground truncate max-w-[180px]">{report.content.substring(0, 40)}...</p>
                  </div>
                </div>
                <div className={cn("h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm", report.viewedAt ? "text-emerald-600" : "text-emerald-300")}>
                  {report.viewedAt ? <CheckCircle2 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={isManaging} onOpenChange={setIsManaging}>
        <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col", isMobile ? "fixed inset-0 w-full h-full max-w-none rounded-none" : "sm:max-w-2xl max-h-[90vh]")}>
          {selectedSeat && (
            <>
              {(() => {
                const studentId = selectedSeat.studentId;
                const timeInfo = studentId ? getStudentStudyTimes(studentId, selectedSeat.status, selectedSeat.lastCheckInAt) : null;
                const statusLogic = studentId ? getStudentStatusLogic(studentId, selectedSeat.status, timeInfo?.totalMins || 0) : null;
                const isAlert = !isEditMode && statusLogic?.isAlert;
                const isAbsentMode = statusLogic?.isAbsentMode;

                return (
                  <>
                    <div className={cn("p-10 text-white relative shrink-0", 
                      isAlert ? "bg-rose-600" : selectedSeat.status === 'studying' ? "bg-blue-600" : "bg-primary")}>
                      <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12"><Sparkles className="h-32 w-32" /></div>
                      <DialogHeader className="relative z-10">
                        <DialogTitle className="text-3xl sm:text-4xl font-black tracking-tighter">{students?.find(s => s.id === selectedSeat.studentId)?.name || '학생'}</DialogTitle>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge className="bg-white/20 text-white border-none font-black px-2.5 py-0.5 text-[10px]">SEAT {selectedSeat.seatNo}</Badge>
                          <Badge className="bg-white/20 text-white border-none font-black px-2.5 py-0.5 text-[10px] uppercase">{isAbsentMode ? 'ABSENT' : selectedSeat.status}</Badge>
                          {isAlert && <Badge className="bg-white text-rose-600 border-none font-black px-2.5 py-0.5 text-[10px] uppercase">LATE / NO PLAN</Badge>}
                        </div>
                      </DialogHeader>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#fafafa]">
                      <Tabs defaultValue="status" className="w-full">
                        <TabsList className="w-full rounded-none h-14 bg-muted/20 border-b p-0">
                          <TabsTrigger value="status" className="flex-1 h-full rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none font-black text-xs uppercase tracking-widest border-b-2 border-transparent data-[state=active]:border-primary transition-all">실시간 상태</TabsTrigger>
                          <TabsTrigger value="history" className="flex-1 h-full rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none font-black text-xs uppercase tracking-widest border-b-2 border-transparent data-[state=active]:border-emerald-500 transition-all">학습 히스토리</TabsTrigger>
                          <TabsTrigger value="reports" className="flex-1 h-full rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none font-black text-xs uppercase tracking-widest border-b-2 border-transparent data-[state=active]:border-amber-500 transition-all">리포트 내역</TabsTrigger>
                        </TabsList>

                        <div className={cn("p-6 sm:p-8 space-y-8")}>
                          <TabsContent value="status" className="mt-0 space-y-8">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-5 bg-white rounded-3xl border-2 border-primary/5 shadow-sm flex flex-col items-center gap-1">
                                <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest"><LogIn className="h-3 w-3 text-blue-500" /> 등원 예정</div>
                                <p className="text-xl sm:text-2xl font-black text-primary tabular-nums">{statusLogic?.schedule.in || '--:--'}</p>
                              </div>
                              <div className="p-5 bg-white rounded-3xl border-2 border-primary/5 shadow-sm flex flex-col items-center gap-1">
                                <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest"><LogOut className="h-3 w-3 text-rose-500" /> 하원 예정</div>
                                <p className="text-xl sm:text-2xl font-black text-primary tabular-nums">{statusLogic?.schedule.out || '--:--'}</p>
                              </div>
                            </div>

                            {selectedSeat.studentId && !isAbsentMode && (
                              <div className="flex gap-4 p-5 bg-white rounded-3xl border-2 border-primary/5 shadow-sm">
                                <div className="flex-1 text-center">
                                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Live Session</p>
                                  <p className="text-xl sm:text-2xl font-black text-blue-600 tabular-nums">{timeInfo?.session}</p>
                                </div>
                                <div className="w-px h-10 bg-border/50 self-center" />
                                <div className="flex-1 text-center">
                                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Today Total</p>
                                  <p className="text-xl sm:text-2xl font-black text-primary tabular-nums">{timeInfo?.total}</p>
                                </div>
                              </div>
                            )}

                            {isEditMode ? (
                              <div className="grid gap-3">
                                <Button variant="destructive" onClick={unassignStudentFromSeat} disabled={isSaving} className="w-full h-16 rounded-2xl font-black text-lg shadow-xl shadow-rose-200">좌석 배정 해제</Button>
                                <Button variant="outline" onClick={handleToggleCellType} disabled={isSaving} className="w-full h-12 rounded-xl font-black gap-2 border-2"><ArrowRightLeft className="h-4 w-4" /> 통로로 전환하기</Button>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-4">
                                <Button onClick={() => handleStatusUpdate('studying')} className="h-20 sm:h-24 rounded-[2rem] font-black bg-blue-600 hover:bg-blue-700 text-white gap-2 flex flex-col items-center justify-center shadow-xl active:scale-95 transition-all"><Zap className="h-5 w-5 fill-current" /><span className="text-base sm:text-lg leading-none">입실 확인</span></Button>
                                <Button variant="outline" onClick={() => handleStatusUpdate('absent')} className="h-20 sm:h-24 rounded-[2rem] font-black border-2 border-rose-100 text-rose-600 hover:bg-rose-50 gap-2 flex flex-col items-center justify-center active:scale-95 transition-all"><AlertCircle className="h-5 w-5" /><span className="text-base sm:text-lg leading-none">퇴실 처리</span></Button>
                              </div>
                            )}

                            <div className="space-y-4">
                              <div className="flex items-center justify-between px-1">
                                <h4 className="text-[10px] font-black uppercase text-primary/60 tracking-widest flex items-center gap-2"><History className="h-3 w-3" /> 오늘의 몰입 세션</h4>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase">{todayKey}</span>
                              </div>
                              <div className="grid gap-2">
                                {sessionsLoading ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-primary opacity-20" /></div> : selectedStudentSessions.length === 0 ? <div className="py-10 text-center rounded-2xl border-2 border-dashed border-muted-foreground/10 italic text-[10px] text-muted-foreground">기록된 세션이 없습니다.</div> :
                                  selectedStudentSessions.map((session) => (
                                    <div key={session.id} className="p-4 rounded-2xl bg-white border border-border/50 shadow-sm flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-xl bg-primary/5 flex items-center justify-center"><Timer className="h-4 w-4 text-primary/40" /></div>
                                        <div className="grid leading-tight"><span className="font-black text-xs">{format(session.startTime.toDate(), 'HH:mm')} ~ {format(session.endTime.toDate(), 'HH:mm')}</span><span className="text-[8px] font-bold text-muted-foreground uppercase">Captured</span></div>
                                      </div>
                                      <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[10px] px-2.5 h-6">{session.durationMinutes}분</Badge>
                                    </div>
                                  ))
                                }
                              </div>
                            </div>
                          </TabsContent>

                          <TabsContent value="history" className="mt-0 space-y-6">
                            <div className="flex items-center gap-2 px-1">
                              <TrendingUp className="h-4 w-4 text-emerald-600" />
                              <h4 className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">최근 7일 학습 시간 변화</h4>
                            </div>
                            <div className="grid gap-2">
                              {selectedStudentHistory.length === 0 ? <div className="py-20 text-center opacity-20 italic font-black text-sm">기록이 없습니다.</div> :
                                selectedStudentHistory.map((hLog) => (
                                  <div key={hLog.dateKey} className="p-4 rounded-2xl bg-white border shadow-sm flex items-center justify-between group hover:border-emerald-200 transition-all">
                                    <span className="text-xs font-black text-muted-foreground">{format(new Date(hLog.dateKey), 'MM/dd (EEE)', {locale: ko})}</span>
                                    <div className="flex items-center gap-3">
                                      <div className="h-1 w-20 bg-muted rounded-full overflow-hidden shadow-inner">
                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (hLog.totalMinutes / 480) * 100)}%` }} />
                                      </div>
                                      <span className="text-sm font-black tracking-tight">{Math.floor(hLog.totalMinutes / 60)}h {hLog.totalMinutes % 60}m</span>
                                    </div>
                                  </div>
                                ))
                              }
                            </div>
                          </TabsContent>

                          <TabsContent value="reports" className="mt-0 space-y-6">
                            <div className="flex items-center gap-2 px-1">
                              <FileText className="h-4 w-4 text-amber-600" />
                              <h4 className="text-[10px] font-black uppercase text-amber-600 tracking-widest">최근 발송된 리포트 (5건)</h4>
                            </div>
                            <div className="grid gap-3">
                              {selectedStudentReports.length === 0 ? <div className="py-20 text-center opacity-20 italic font-black text-sm">발송된 리포트가 없습니다.</div> :
                                selectedStudentReports.map((report) => (
                                  <div key={report.id} className="p-5 rounded-2xl bg-white border border-amber-100 shadow-sm space-y-2 relative group hover:shadow-md transition-all">
                                    <div className="flex justify-between items-center">
                                      <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">{report.dateKey}</span>
                                      {report.viewedAt && <Badge className="bg-emerald-50 text-white border-none font-black text-[7px] px-1.5 h-4">열람함</Badge>}
                                    </div>
                                    <p className="text-xs font-bold text-foreground/70 line-clamp-2 leading-relaxed">{report.content.substring(0, 100)}...</p>
                                  </div>
                                ))
                              }
                            </div>
                          </TabsContent>
                        </div>
                      </Tabs>

                      <div className="p-6 sm:p-8 pt-0 border-t border-dashed mt-4">
                        <Button variant="secondary" className="w-full h-14 sm:h-16 rounded-2xl font-black gap-4 text-primary bg-primary/5 hover:bg-primary/10 transition-all border border-primary/5" asChild>
                          <Link href={`/dashboard/teacher/students/${selectedSeat.studentId}`}><User className="h-5 w-5 opacity-40" />학생 정밀 리포트 & 과거 상세 분석<ChevronRight className="ml-auto h-5 w-5 opacity-20" /></Link>
                        </Button>
                      </div>
                    </div>
                  </>
                );
              })()}
              <DialogFooter className={cn("bg-white border-t shrink-0 flex justify-center", isMobile ? "p-4" : "p-6")}>
                <Button variant="ghost" onClick={() => setIsManaging(false)} className="w-full font-bold text-muted-foreground">닫기</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAssigning} onOpenChange={setIsAssigning}>
        <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col", isMobile ? "fixed inset-0 w-full h-full max-w-none rounded-none" : "sm:max-w-md")}>
          <div className="bg-primary p-8 text-white relative shrink-0">
            <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><UserPlus className="h-24 w-24" /></div>
            <DialogHeader className="relative z-10"><DialogTitle className="text-2xl sm:text-3xl font-black tracking-tighter flex items-center gap-3">{selectedSeat?.type === 'aisle' ? <MapIcon className="h-7 w-7" /> : <UserPlus className="h-7 w-7" />}배정 설정</DialogTitle><p className="text-white/60 font-bold mt-1 text-xs">GRID ID: {selectedSeat?.seatNo}</p></DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white space-y-6">
            {isEditMode && <div className="p-4 rounded-2xl bg-muted/30 border-2 border-dashed border-primary/20"><Button onClick={handleToggleCellType} className={cn("w-full h-12 rounded-xl font-black gap-2 transition-all", selectedSeat?.type === 'aisle' ? "bg-primary text-white" : "bg-white text-primary border-2")}><ArrowRightLeft className="h-4 w-4" />{selectedSeat?.type === 'aisle' ? '좌석으로 사용' : '통로로 전환'}</Button></div>}
            {selectedSeat?.type !== 'aisle' && (
              <div className="space-y-4">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" /><Input placeholder="이름 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="rounded-xl border-2 pl-10 h-11 text-sm font-bold" /></div>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-2">
                    {unassignedStudents.length === 0 ? <p className="text-center py-10 text-[10px] font-bold text-muted-foreground/40 italic">미배정 학생이 없습니다.</p> : unassignedStudents.map((student) => (
                      <div key={student.id} onClick={() => assignStudentToSeat(student)} className="p-4 rounded-2xl border-2 border-transparent hover:border-primary/10 hover:bg-primary/5 cursor-pointer flex items-center justify-between transition-all">
                        <div className="flex items-center gap-3 min-w-0"><div className="h-9 w-9 rounded-xl bg-primary/5 flex items-center justify-center font-black text-primary border border-primary/10 shrink-0">{student.name.charAt(0)}</div><div className="grid gap-0.5 min-w-0"><span className="font-black text-sm truncate">{student.name}</span><span className="text-[10px] font-bold text-muted-foreground truncate">{student.schoolName}</span></div></div>
                        <ChevronRight className="h-4 w-4 opacity-40 shrink-0" />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
          <DialogFooter className={cn("bg-muted/20 border-t shrink-0 flex justify-center", isMobile ? "p-4" : "p-6")}><Button variant="ghost" onClick={() => setIsAssigning(false)} className="w-full font-bold text-muted-foreground">취소</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}