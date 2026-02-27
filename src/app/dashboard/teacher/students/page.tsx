
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Search, UserPlus, GraduationCap, ChevronRight, Loader2, Armchair } from 'lucide-react';
import Link from 'next/link';
import { StudentProfile, AttendanceCurrent } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function StudentListPage() {
  const { activeMembership } = useAppContext();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');

  const centerId = activeMembership?.id;

  // 1. 학생 전체 목록 조회
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'students'), orderBy('name', 'asc'));
  }, [firestore, centerId]);
  const { data: students, isLoading: studentsLoading } = useCollection<StudentProfile>(studentsQuery);

  // 2. 실시간 출결 상태 조회
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList } = useCollection<AttendanceCurrent>(attendanceQuery);

  const filteredStudents = students?.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.seatNo.toString().includes(searchTerm)
  );

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'studying': return <Badge className="bg-emerald-500 hover:bg-emerald-600">공부중</Badge>;
      case 'away': return <Badge variant="outline" className="text-amber-500 border-amber-500">외출중</Badge>;
      case 'break': return <Badge variant="secondary">휴식중</Badge>;
      case 'absent': return <Badge variant="destructive">결석</Badge>;
      default: return <Badge variant="outline">미입실</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            학생 관리
          </h1>
          <p className="text-muted-foreground font-bold">센터에 등록된 모든 학생을 관리합니다.</p>
        </div>
        <Button className="rounded-xl font-black gap-2 h-12 shadow-lg">
          <UserPlus className="h-5 w-5" /> 신규 학생 등록
        </Button>
      </header>

      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="학생 이름 또는 좌석 번호로 검색..." 
            className="pl-10 h-11 border-none focus-visible:ring-0 text-base"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {studentsLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-bold text-muted-foreground">학생 데이터를 불러오고 있습니다...</p>
        </div>
      ) : !filteredStudents || filteredStudents.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-[2rem] border-2 border-dashed">
          <p className="font-bold text-muted-foreground">검색 결과가 없거나 등록된 학생이 없습니다.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((student) => {
            const currentStatus = attendanceList?.find(a => a.id === student.id);
            return (
              <Link key={student.id} href={`/dashboard/teacher/students/${student.id}`}>
                <Card className="rounded-3xl border-none shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden">
                  <div className={cn(
                    "h-2 w-full",
                    currentStatus?.status === 'studying' ? "bg-emerald-500" : "bg-muted"
                  )} />
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-14 w-14 border-2 border-primary/10">
                        <AvatarFallback className="bg-primary/5 text-primary font-black text-xl">
                          {student.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-black">{student.name}</h3>
                          {getStatusBadge(currentStatus?.status)}
                        </div>
                        <p className="text-sm text-muted-foreground font-bold">{student.grade} · 목표 {student.targetDailyMinutes}분</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                    
                    <div className="mt-6 flex items-center justify-between p-3 bg-muted/30 rounded-2xl">
                      <div className="flex items-center gap-2">
                        <Armchair className="h-4 w-4 text-primary/60" />
                        <span className="text-sm font-black text-primary/80">{student.seatNo}번 좌석</span>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Profile View</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
