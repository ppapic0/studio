'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { collection, deleteField, doc, getDocs, limit, serverTimestamp, setDoc, query, where, updateDoc, orderBy, Timestamp } from 'firebase/firestore';
import { Loader2, CheckCircle2, XCircle, Clock, CalendarX, UserCheck, ClipboardCheck } from 'lucide-react';
import { CenterMembership, AttendanceRequest, AttendanceCurrent } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  AttendanceRecordStatus,
  AttendanceRoutineInfo,
  DisplayAttendanceStatus,
  buildAttendanceRoutineInfo,
  deriveAttendanceDisplayState,
  syncAutoAttendanceRecord,
  toDateSafe,
} from '@/lib/attendance-auto';

type AttendanceRecord = {
  id: string;
  status: AttendanceRecordStatus;
  statusSource?: 'auto' | 'manual' | string;
  updatedAt?: any;
  checkInAt?: any;
  autoSyncedAt?: any;
  routineMissingAtCheckIn?: boolean;
  routineMissingPenaltyApplied?: boolean;
  confirmedByUserId?: string;
  centerId?: string;
  studentId?: string;
  dateKey?: string;
  studentName?: string;
};

export default function AttendancePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [attendanceRoutineMap, setAttendanceRoutineMap] = useState<Record<string, AttendanceRoutineInfo>>({});
  const [routineLoading, setRoutineLoading] = useState(false);

  useEffect(() => {
    setSelectedDate(new Date());
  }, []);

  const dateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const weekKey = selectedDate ? format(selectedDate, "yyyy-'W'II") : '';
  const centerId = activeMembership?.id;
  const isTeacherOrAdmin = activeMembership?.role === 'teacher' || activeMembership?.role === 'centerAdmin';

  // 1. 센터 모든 학생 조회
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'),
      where('role', '==', 'student')
    );
  }, [firestore, centerId]);
  const { data: students, isLoading: membersLoading } = useCollection<CenterMembership>(studentsQuery, { enabled: isTeacherOrAdmin });

  // 2. 선택일 출석 기록 조회
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !dateKey) return null;
    return collection(firestore, 'centers', centerId, 'attendanceRecords', dateKey, 'students');
  }, [firestore, centerId, dateKey]);
  const { data: attendanceRecords, isLoading: attendanceLoading } = useCollection<AttendanceRecord>(attendanceQuery, { enabled: isTeacherOrAdmin });

  const attendanceCurrentQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceCurrentDocs, isLoading: attendanceCurrentLoading } = useCollection<AttendanceCurrent>(attendanceCurrentQuery, { enabled: isTeacherOrAdmin });

  // 3. 지각/결석 신청 내역 조회
  const requestsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'attendanceRequests'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, centerId]);
  const { data: requests, isLoading: requestsLoading } = useCollection<AttendanceRequest>(requestsQuery, { enabled: isTeacherOrAdmin });

  useEffect(() => {
    if (!firestore || !centerId || !isTeacherOrAdmin || !dateKey || !weekKey || !students) {
      setAttendanceRoutineMap({});
      return;
    }

    let cancelled = false;
    const loadRoutineMap = async () => {
      setRoutineLoading(true);
      try {
        const entries = await Promise.all(
          students.map(async (student) => {
            const routineQuery = query(
              collection(firestore, 'centers', centerId, 'plans', student.id, 'weeks', weekKey, 'items'),
              where('dateKey', '==', dateKey),
              where('category', '==', 'schedule'),
              limit(5)
            );
            const snap = await getDocs(routineQuery);
            const scheduleTitles = snap.docs.map((docSnap) => String(docSnap.data()?.title || ''));
            const routineInfo = buildAttendanceRoutineInfo(scheduleTitles);

            return [
              student.id,
              {
                hasRoutine: routineInfo.hasRoutine,
                isNoAttendanceDay: routineInfo.isNoAttendanceDay,
                expectedArrivalTime: routineInfo.expectedArrivalTime,
              },
            ] as const;
          })
        );

        if (!cancelled) {
          setAttendanceRoutineMap(Object.fromEntries(entries));
        }
      } catch (error) {
        console.error('[attendance] routine map load failed', error);
        if (!cancelled) setAttendanceRoutineMap({});
      } finally {
        if (!cancelled) setRoutineLoading(false);
      }
    };

    void loadRoutineMap();
    return () => {
      cancelled = true;
    };
  }, [firestore, centerId, isTeacherOrAdmin, dateKey, weekKey, students]);

  const getBadgeVariant = (status: string) => {
    switch (status) {
      case 'confirmed_present': return 'default';
      case 'confirmed_present_missing_routine': return 'default';
      case 'confirmed_absent': return 'destructive';
      case 'confirmed_late': return 'secondary';
      case 'excused_absent': return 'outline';
      default: return 'outline';
    }
  };

  const handleStatusChange = async (studentId: string, status: AttendanceRecord['status'], checkedAt?: Date | null) => {
      if (!firestore || !user || !centerId || !dateKey) return;
      
      const recordRef = doc(firestore, 'centers', centerId, 'attendanceRecords', dateKey, 'students', studentId);
      const studentData = students?.find(s => s.id === studentId);

      const recordData: Partial<AttendanceRecord> = {
          status,
          updatedAt: serverTimestamp() as any,
          confirmedByUserId: user.uid,
          centerId: centerId,
          studentId: studentId,
          dateKey: dateKey,
          statusSource: 'manual',
      };
      (recordData as any).routineMissingAtCheckIn = deleteField();
      (recordData as any).routineMissingPenaltyApplied = deleteField();

      if ((status === 'confirmed_present' || status === 'confirmed_late') && checkedAt) {
        recordData.checkInAt = Timestamp.fromDate(checkedAt);
      } else if (status === 'confirmed_present' || status === 'confirmed_late') {
        recordData.checkInAt = serverTimestamp() as any;
      } else {
        (recordData as any).checkInAt = deleteField();
      }

      if (studentData) recordData.studentName = studentData.displayName;
      await setDoc(recordRef, recordData, { merge: true });
  }

  const handleRequestAction = async (requestId: string, status: 'approved' | 'rejected') => {
    if (!firestore || !centerId) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'attendanceRequests', requestId), {
        status,
        updatedAt: serverTimestamp()
      });
      toast({ title: status === 'approved' ? "신청을 승인했습니다." : "신청을 반려했습니다." });
    } catch (e) {
      toast({ variant: "destructive", title: "처리 실패" });
    } finally {
      setIsProcessing(false);
    }
  };

  const isLoading = !selectedDate || membersLoading || attendanceLoading || attendanceCurrentLoading;
  const attendanceMap = useMemo(() => new Map(attendanceRecords?.map(r => [r.id, r])), [attendanceRecords]);
  const attendanceCurrentMap = useMemo(() => {
    const mapped = new Map<string, AttendanceCurrent>();
    (attendanceCurrentDocs || []).forEach((seat) => {
      if (seat.studentId) {
        mapped.set(seat.studentId, seat);
      }
    });
    return mapped;
  }, [attendanceCurrentDocs]);

  const attendanceDisplayMap = useMemo(() => {
    const mapped = new Map<string, { status: DisplayAttendanceStatus; checkedAt: Date | null }>();
    if (!selectedDate) return mapped;

    const todayDateKey = format(new Date(), 'yyyy-MM-dd');
    const isTodaySelected = dateKey === todayDateKey;
    const nowMs = Date.now();

    (students || []).forEach((student) => {
      const record = attendanceMap.get(student.id);
      const routine = attendanceRoutineMap[student.id];
      const liveAttendance = attendanceCurrentMap.get(student.id);
      const derived = deriveAttendanceDisplayState({
        selectedDate,
        dateKey,
        todayDateKey,
        routine,
        recordStatus: record?.status,
        recordRoutineMissingAtCheckIn: Boolean(record?.routineMissingAtCheckIn),
        recordCheckedAt: toDateSafe(record?.checkInAt || record?.updatedAt),
        liveCheckedAt: isTodaySelected ? toDateSafe(liveAttendance?.lastCheckInAt) : null,
        nowMs,
        isRoutineLoading: routineLoading,
      });

      mapped.set(student.id, derived);
    });

    return mapped;
  }, [
    attendanceMap,
    attendanceCurrentMap,
    attendanceRoutineMap,
    dateKey,
    routineLoading,
    selectedDate,
    students,
  ]);

  const missingRoutineStudents = useMemo(
    () => (students || []).filter((student) => attendanceRoutineMap[student.id]?.hasRoutine === false),
    [students, attendanceRoutineMap]
  );

  useEffect(() => {
    if (
      !firestore ||
      !user?.uid ||
      !centerId ||
      !dateKey ||
      !selectedDate ||
      !isTeacherOrAdmin ||
      isLoading ||
      routineLoading ||
      !students?.length
    ) {
      return;
    }

    let cancelled = false;
    const syncAutoAttendance = async () => {
      try {
        await Promise.all(
          students.map(async (student) => {
            const derived = attendanceDisplayMap.get(student.id);
            if (!derived) return;

            if (cancelled) return;

            await syncAutoAttendanceRecord({
              firestore,
              centerId,
              studentId: student.id,
              studentName: student.displayName || '',
              targetDate: selectedDate,
              checkInAt: derived.checkedAt,
              confirmedByUserId: user.uid,
            });
          })
        );
      } catch (error) {
        console.error('[attendance] auto-sync failed', error);
      }
    };

    void syncAutoAttendance();
    return () => {
      cancelled = true;
    };
  }, [
    attendanceDisplayMap,
    centerId,
    dateKey,
    firestore,
    isLoading,
    isTeacherOrAdmin,
    routineLoading,
    selectedDate,
    students,
    user?.uid,
  ]);

  if (!isTeacherOrAdmin) {
    return (
      <div className="p-8"><Alert><AlertTitle>권한 없음</AlertTitle><AlertDescription>교사 또는 관리자 계정으로 로그인해야 출석을 관리할 수 있습니다.</AlertDescription></Alert></div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto p-4 sm:p-8">
      <header className="flex justify-between items-center">
        <div className="grid gap-1">
          <h1 className="text-3xl font-black tracking-tighter text-primary">출결 및 신청 관리</h1>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Attendance & Request Management</p>
        </div>
      </header>

      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="grid grid-cols-2 bg-muted/30 p-1 rounded-2xl border h-14 mb-8 max-w-md">
          <TabsTrigger value="attendance" className="rounded-xl font-black gap-2"><UserCheck className="h-4 w-4" /> 일일 출석체크</TabsTrigger>
          <TabsTrigger value="requests" className="rounded-xl font-black gap-2"><ClipboardCheck className="h-4 w-4" /> 신청 내역 관리</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="animate-in fade-in duration-500">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
            <CardHeader className="bg-muted/5 border-b p-8 flex flex-row items-center justify-between gap-4">
              <div className="grid gap-1">
                <CardTitle className="text-xl font-black tracking-tight">학생 출석부</CardTitle>
                <CardDescription className="text-xs font-bold">{dateKey} 현황을 관리합니다.</CardDescription>
              </div>
              <Input 
                type="date" 
                value={dateKey}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="w-[180px] h-11 rounded-xl border-2 font-black"
              />
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? <div className='flex justify-center py-20'><Loader2 className="h-8 w-8 animate-spin text-primary opacity-20"/></div> :
              <div>
                {!routineLoading && missingRoutineStudents.length > 0 && (
                  <div className="px-8 pt-6">
                    <Alert className="rounded-2xl border-amber-200 bg-amber-50/60">
                      <AlertTitle className="font-black text-amber-700">미작성 학생 {missingRoutineStudents.length}명</AlertTitle>
                      <AlertDescription className="font-bold text-amber-700/90 text-xs leading-relaxed">
                        선택한 날짜({dateKey})에 출결 루틴(등원/하원/휴무)이 없는 학생입니다. 먼저 학습계획에서 루틴을 작성해 주세요.
                      </AlertDescription>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {missingRoutineStudents.map((student) => (
                          <Badge key={student.id} variant="outline" className="border-amber-300 bg-white text-amber-700 font-black">
                            {student.displayName}
                          </Badge>
                        ))}
                      </div>
                    </Alert>
                  </div>
                )}
                <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow className="border-none hover:bg-transparent h-12">
                    <TableHead className="font-black text-[10px] pl-8">STUDENT</TableHead>
                    <TableHead className="font-black text-[10px]">STATUS</TableHead>
                    <TableHead className="hidden md:table-cell font-black text-[10px]">CHECKED AT</TableHead>
                    <TableHead className="text-right pr-8 font-black text-[10px]">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students?.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="h-40 text-center font-bold opacity-30 italic">학생 정보가 없습니다.</TableCell></TableRow>
                  ) : students?.map((student) => {
                    const record = attendanceMap.get(student.id);
                    const status = attendanceDisplayMap.get(student.id)?.status || 'requested';
                    const hasAttendanceRoutine = attendanceRoutineMap[student.id]?.hasRoutine !== false;
                    const checkedAt = attendanceDisplayMap.get(student.id)?.checkedAt;
                    const manualStatus = record?.status && record.status !== 'requested' ? record.status : undefined;
                    return (
                    <TableRow key={student.id} className="h-20 hover:bg-muted/5 transition-colors border-muted/10">
                      <TableCell className="pl-8">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-white shadow-sm ring-1 ring-border/50">
                            <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">{student.displayName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-black text-sm">{student.displayName}</div>
                            {routineLoading && !attendanceRoutineMap[student.id] && (
                              <Badge variant="outline" className="font-black text-[10px]">루틴 확인중</Badge>
                            )}
                            {!routineLoading && !hasAttendanceRoutine && (
                              <Badge className="font-black text-[10px] border-none bg-amber-100 text-amber-700">미작성</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getBadgeVariant(status) as any}
                          className={cn(
                            "font-black text-[10px] rounded-md shadow-sm border-none",
                            status === 'missing_routine' && "bg-amber-100 text-amber-700",
                            status === 'confirmed_present_missing_routine' && "bg-emerald-100 text-emerald-700"
                          )}
                        >
                          {status === 'confirmed_present'
                            ? '출석'
                            : status === 'confirmed_present_missing_routine'
                              ? '출석(미작성)'
                            : status === 'confirmed_late'
                              ? '지각출석'
                              : status === 'confirmed_absent'
                                ? '결석'
                                : status === 'excused_absent'
                                  ? '사유결석'
                                  : status === 'missing_routine'
                                    ? '미작성'
                                    : '미확인'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs font-bold text-muted-foreground">
                        {checkedAt ? format(checkedAt, 'p') : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <Select value={manualStatus} onValueChange={(newStatus) => handleStatusChange(student.id, newStatus as any, checkedAt)}>
                          <SelectTrigger className="w-[120px] h-10 rounded-xl font-bold border-2 ml-auto">
                            <SelectValue placeholder="상태 설정" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl shadow-2xl border-none">
                            <SelectItem value="confirmed_present" className="font-bold">출석</SelectItem>
                            <SelectItem value="confirmed_late" className="font-bold">지각출석</SelectItem>
                            <SelectItem value="confirmed_absent" className="font-bold text-rose-600">무단결석</SelectItem>
                            <SelectItem value="excused_absent" className="font-bold text-blue-600">사유결석</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
              </div>
              }
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="animate-in fade-in duration-500">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
            <CardHeader className="bg-muted/5 border-b p-8">
              <CardTitle className="text-xl font-black tracking-tight">지각/결석 신청서 관리</CardTitle>
              <CardDescription className="text-xs font-bold text-muted-foreground">학생들이 제출한 사유를 검토하고 승인합니다.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {requestsLoading ? <div className='flex justify-center py-20'><Loader2 className="h-8 w-8 animate-spin text-primary opacity-20"/></div> :
              <div className="divide-y divide-muted/10">
                {requests?.length === 0 ? (
                  <div className="py-20 text-center opacity-20 italic font-black text-sm">접수된 신청 내역이 없습니다.</div>
                ) : requests?.map((req) => (
                  <div key={req.id} className="p-8 hover:bg-muted/5 transition-all group">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex items-start gap-5">
                        <div className={cn("h-14 w-14 rounded-2xl flex flex-col items-center justify-center shrink-0 border-2", req.type === 'late' ? "bg-amber-50 border-amber-100 text-amber-600" : "bg-rose-50 border-rose-100 text-rose-600")}>
                          {req.type === 'late' ? <Clock className="h-6 w-6" /> : <CalendarX className="h-6 w-6" />}
                          <span className="text-[8px] font-black uppercase mt-1">{req.type === 'late' ? 'Late' : 'Absent'}</span>
                        </div>
                        <div className="grid gap-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-lg tracking-tight">{req.studentName} 학생</span>
                            <Badge variant="outline" className="font-bold text-[10px] rounded-md h-5 px-2 bg-white">{req.date} 신청</Badge>
                            {req.penaltyApplied && <Badge className="bg-rose-100 text-rose-600 border-none font-black text-[9px]">당일벌점부과됨</Badge>}
                          </div>
                          <div className="p-4 rounded-2xl bg-[#fafafa] border shadow-inner">
                            <p className="text-sm font-bold text-foreground/80 leading-relaxed break-keep">“{req.reason}”</p>
                          </div>
                          <p className="text-[10px] font-bold text-muted-foreground ml-1">신청 시각: {req.createdAt ? format(req.createdAt.toDate(), 'yyyy.MM.dd HH:mm') : '-'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                        {req.status === 'requested' ? (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleRequestAction(req.id, 'approved')} disabled={isProcessing} className="bg-emerald-500 hover:bg-emerald-600 rounded-xl h-10 px-6 font-black gap-2 shadow-lg shadow-emerald-100">
                              <CheckCircle2 className="h-4 w-4" /> 승인
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleRequestAction(req.id, 'rejected')} disabled={isProcessing} className="text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl h-10 px-6 font-black gap-2">
                              <XCircle className="h-4 w-4" /> 반려
                            </Button>
                          </div>
                        ) : (
                          <Badge className={cn(
                            "rounded-full px-4 py-1.5 font-black text-xs shadow-sm",
                            req.status === 'approved' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          )}>
                            {req.status === 'approved' ? '최종 승인됨' : '반려 처리됨'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              }
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
