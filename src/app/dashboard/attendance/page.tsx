'use client';

import { useState } from 'react';
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
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, doc, serverTimestamp, setDoc, query, where } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { AttendanceRecord, WithId, CenterMembership } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AttendancePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateKey = format(selectedDate, 'yyyy-MM-dd');

  const isTeacherOrAdmin = activeMembership?.role === 'teacher' || activeMembership?.role === 'centerAdmin';

  // 1. Fetch all students in the center
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'members'),
      where('role', '==', 'student')
    );
  }, [firestore, activeMembership]);
  const { data: students, isLoading: membersLoading } = useCollection<CenterMembership>(studentsQuery, { enabled: isTeacherOrAdmin });

  // 2. Fetch attendance records for the selected date
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership) return null;
    return collection(firestore, 'centers', activeMembership.id, 'attendanceRecords', dateKey, 'students');
  }, [firestore, activeMembership, dateKey]);
  const { data: attendanceRecords, isLoading: attendanceLoading } = useCollection<AttendanceRecord>(attendanceQuery, { enabled: isTeacherOrAdmin });

  const getBadgeVariant = (status: string) => {
    switch (status) {
      case 'confirmed_present':
        return 'default';
      case 'confirmed_absent':
        return 'destructive';
      case 'confirmed_late':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const handleStatusChange = async (studentId: string, status: AttendanceRecord['status']) => {
      if (!firestore || !user || !activeMembership) return;
      
      const recordRef = doc(firestore, 'centers', activeMembership.id, 'attendanceRecords', dateKey, 'students', studentId);
      const studentData = students?.find(s => s.id === studentId);

      const recordData: Partial<AttendanceRecord> = {
          status,
          updatedAt: serverTimestamp() as any,
          confirmedByUserId: user.uid,
          centerId: activeMembership.id,
          studentId: studentId,
          dateKey: dateKey,
      };

      if (studentData) {
        recordData.studentName = studentData.displayName;
      }

      await setDoc(recordRef, recordData, { merge: true });
  }

  const isLoading = membersLoading || attendanceLoading;

  const attendanceMap = new Map(attendanceRecords?.map(r => [r.id, r]));

  if (!isTeacherOrAdmin) {
    return (
      <Alert>
        <AlertTitle>권한 없음</AlertTitle>
        <AlertDescription>
          교사 또는 관리자 계정으로 로그인해야 출석을 관리할 수 있습니다.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex justify-between items-start'>
          <div>
            <CardTitle>학생 출석</CardTitle>
            <CardDescription>
              {format(selectedDate, 'yyyy년 MM월 dd일')}의 출석을 관리하고 검토합니다.
            </CardDescription>
          </div>
          <Input 
            type="date" 
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="w-[180px]"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className='flex justify-center p-8'><Loader2 className="h-8 w-8 animate-spin"/></div> :
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>학생</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="hidden md:table-cell">확인 시간</TableHead>
              <TableHead>
                <span className="sr-only">작업</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students?.map((student) => {
              const record = attendanceMap.get(student.id);
              const status = record?.status || 'requested';
              return (
              <TableRow key={student.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="hidden h-9 w-9 sm:flex">
                      <AvatarFallback>{student.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="font-medium">{student.displayName}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getBadgeVariant(status) as any}>
                    {status.replace('confirmed_', '').replace('requested', '요청됨')}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {record?.updatedAt ? format((record.updatedAt as any).toDate(), 'p') : 'N/A'}
                </TableCell>
                <TableCell>
                  <Select value={status} onValueChange={(newStatus) => handleStatusChange(student.id, newStatus as any)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="상태 설정" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirmed_present">출석</SelectItem>
                      <SelectItem value="confirmed_late">지각</SelectItem>
                      <SelectItem value="confirmed_absent">결석</SelectItem>
                      <SelectItem value="excused_absent">사유결석</SelectItem>
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
  );
}
