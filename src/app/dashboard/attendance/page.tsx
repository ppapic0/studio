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
import { collection, doc, serverTimestamp, setDoc, query, where, updateDoc, orderBy } from 'firebase/firestore';
import { Loader2, CheckCircle2, XCircle, Clock, CalendarX, UserCheck, ClipboardCheck } from 'lucide-react';
import { CenterMembership, AttendanceRequest } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type AttendanceRecordStatus = 'requested' | 'confirmed_present' | 'confirmed_late' | 'confirmed_absent' | 'excused_absent';
type AttendanceRecord = {
  id: string;
  status: AttendanceRecordStatus;
  updatedAt?: any;
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

  useEffect(() => {
    setSelectedDate(new Date());
  }, []);

  const dateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
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

  // 3. 지각/결석 신청 내역 조회
  const requestsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'attendanceRequests'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, centerId]);
  const { data: requests, isLoading: requestsLoading } = useCollection<AttendanceRequest>(requestsQuery, { enabled: isTeacherOrAdmin });

  const getBadgeVariant = (status: string) => {
    switch (status) {
      case 'confirmed_present': return 'default';
      case 'confirmed_absent': return 'destructive';
      case 'confirmed_late': return 'secondary';
      case 'excused_absent': return 'outline';
      default: return 'outline';
    }
  };

  const handleStatusChange = async (studentId: string, status: AttendanceRecord['status']) => {
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
      };

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

  const isLoading = !selectedDate || membersLoading || attendanceLoading;
  const attendanceMap = useMemo(() => new Map(attendanceRecords?.map(r => [r.id, r])), [attendanceRecords]);

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
                    const status = record?.status || 'requested';
                    return (
                    <TableRow key={student.id} className="h-20 hover:bg-muted/5 transition-colors border-muted/10">
                      <TableCell className="pl-8">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-white shadow-sm ring-1 ring-border/50">
                            <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">{student.displayName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="font-black text-sm">{student.displayName}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getBadgeVariant(status) as any} className="font-black text-[10px] rounded-md shadow-sm border-none">
                          {status === 'confirmed_present' ? '출석' : status === 'confirmed_late' ? '지각' : status === 'confirmed_absent' ? '결석' : status === 'excused_absent' ? '사유결석' : '미확인'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs font-bold text-muted-foreground">
                        {record?.updatedAt ? format((record.updatedAt as any).toDate(), 'p') : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <Select value={status} onValueChange={(newStatus) => handleStatusChange(student.id, newStatus as any)}>
                          <SelectTrigger className="w-[120px] h-10 rounded-xl font-bold border-2 ml-auto">
                            <SelectValue placeholder="상태 설정" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl shadow-2xl border-none">
                            <SelectItem value="confirmed_present" className="font-bold">출석</SelectItem>
                            <SelectItem value="confirmed_late" className="font-bold">지각</SelectItem>
                            <SelectItem value="confirmed_absent" className="font-bold text-rose-600">무단결석</SelectItem>
                            <SelectItem value="excused_absent" className="font-bold text-blue-600">사유결석</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
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
