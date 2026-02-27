'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Users, Clock, MessageSquare, Armchair, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { AttendanceCurrent, StudentProfile } from '@/lib/types';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function TeacherHomePage() {
  const { activeMembership } = useAppContext();
  const firestore = useFirestore();

  const centerId = activeMembership?.id;

  // 1. 오늘 출결 현황
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery);

  // 2. 학생 리스트
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'students'), orderBy('seatNo', 'asc'));
  }, [firestore, centerId]);
  const { data: students, isLoading: studentsLoading } = useCollection<StudentProfile>(studentsQuery);

  // 3. 오늘 상담 예약 (counselingReservations로 통일)
  const appointmentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    const today = new Date();
    return query(
      collection(firestore, 'centers', centerId, 'counselingReservations'),
      where('scheduledAt', '>=', Timestamp.fromDate(startOfDay(today))),
      where('scheduledAt', '<=', Timestamp.fromDate(endOfDay(today))),
      orderBy('scheduledAt', 'asc')
    );
  }, [firestore, centerId]);
  const { data: appointments, isLoading: aptLoading } = useCollection<any>(appointmentsQuery);

  const isLoading = attendanceLoading || studentsLoading || aptLoading;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight">선생님 대시보드</h1>
        <p className="text-muted-foreground">오늘의 센터 현황과 학생 관리를 한눈에 확인하세요.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 rounded-[2rem] border-none shadow-xl overflow-hidden bg-white">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="flex items-center gap-2">
              <Armchair className="h-5 w-5 text-primary" /> 좌석 및 실시간 출결
            </CardTitle>
            <CardDescription>총 {students?.length || 0}명의 학생이 등록되어 있습니다.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div> : (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {students?.map((student) => {
                  const currentStatus = attendanceList?.find(a => a.id === `seat_${student.seatNo.toString().padStart(3, '0')}`);
                  return (
                    <Link key={student.id} href={`/dashboard/teacher/students/${student.id}`}>
                      <div className="aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 hover:bg-muted/50 hover:border-primary transition-all group relative">
                        <span className="text-[10px] font-black text-muted-foreground">{student.seatNo}</span>
                        <span className="text-xs font-bold">{student.name}</span>
                        {currentStatus && (
                          <div className={cn(
                            "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white",
                            currentStatus.status === 'studying' ? 'bg-emerald-500' : 'bg-muted'
                          )} />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-xl bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> 오늘 상담 예약
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {aptLoading ? <Loader2 className="animate-spin mx-auto" /> : 
             !appointments || appointments.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-xs font-bold">오늘 예정된 상담이 없습니다.</div>
            ) : (
              appointments.map((apt: any) => (
                <div key={apt.id} className="p-4 rounded-2xl bg-muted/20 border flex justify-between items-center group hover:border-primary transition-all">
                  <div className="grid gap-1">
                    <span className="text-xs font-black text-primary">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'p') : '-'}</span>
                    <span className="text-sm font-bold">{apt.studentName} 학생</span>
                  </div>
                  <Button size="icon" variant="ghost" className="rounded-full group-hover:bg-primary group-hover:text-white" asChild>
                    <Link href={`/dashboard/teacher/students/${apt.studentId}`}>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}