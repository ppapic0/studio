
'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, orderBy, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { StudentProfile, DailyReport, CenterMembership } from '@/lib/types';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  FileText, 
  Search, 
  Send, 
  CheckCircle2, 
  Clock, 
  Loader2,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function DailyReportsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateKey = format(selectedDate, 'yyyy-MM-dd');
  const centerId = activeMembership?.id;

  // 1. 센터 내 학생 목록 조회
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'student'));
  }, [firestore, centerId]);
  const { data: studentMembers, isLoading: membersLoading } = useCollection<CenterMembership>(studentsQuery);

  // 2. 오늘의 리포트 목록 조회
  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'dailyReports'), where('dateKey', '==', dateKey));
  }, [firestore, centerId, dateKey]);
  const { data: dailyReports, isLoading: reportsLoading } = useCollection<DailyReport>(reportsQuery);

  const filteredStudents = useMemo(() => {
    if (!studentMembers) return [];
    return studentMembers.filter(s => 
      s.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
  }, [studentMembers, searchTerm]);

  const isLoading = membersLoading || reportsLoading;

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto pb-20">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            학부모 데일리 리포트 관리
          </h1>
          <p className="text-muted-foreground font-bold">학생들의 일일 학습 성과를 학부모님께 보고합니다.</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border shadow-sm">
          <Input 
            type="date" 
            value={dateKey}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="w-[160px] border-none font-bold"
          />
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-1 rounded-[2rem] border-none shadow-lg bg-white overflow-hidden flex flex-col">
          <CardHeader className="bg-muted/30 border-b p-6">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" /> 학생 검색
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="이름으로 찾기..." 
                className="pl-9 h-11 rounded-xl border-2 focus-visible:ring-primary/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-2 max-h-[500px]">
              {membersLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin h-6 w-6 text-primary/30" /></div>
              ) : filteredStudents.length === 0 ? (
                <p className="text-center py-10 text-xs font-bold text-muted-foreground">학생이 없습니다.</p>
              ) : (
                filteredStudents.map((student) => {
                  const report = dailyReports?.find(r => r.studentId === student.id);
                  return (
                    <div 
                      key={student.id} 
                      className={cn(
                        "p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-3 group",
                        report?.status === 'sent' 
                          ? "bg-emerald-50 border-emerald-100 hover:border-emerald-300" 
                          : "bg-white border-transparent hover:border-primary/20 hover:bg-primary/5"
                      )}
                      onClick={() => window.location.href = `/dashboard/teacher/students/${student.id}`}
                    >
                      <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                        <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">
                          {student.displayName?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black truncate">{student.displayName}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                          {report?.status === 'sent' ? '발송 완료' : '미발송'}
                        </p>
                      </div>
                      {report?.status === 'sent' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
          <CardHeader className="p-8 border-b bg-muted/10">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-black">데일리 리포트 현황</CardTitle>
                <CardDescription className="font-bold text-base mt-1">
                  {format(selectedDate, 'yyyy년 M월 d일')} 기준 총 {studentMembers?.length || 0}명의 학생 리포트
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">발송율</p>
                  <p className="text-2xl font-black text-primary">
                    {Math.round(((dailyReports?.filter(r => r.status === 'sent').length || 0) / (studentMembers?.length || 1)) * 100)}%
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full border-4 border-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {isLoading ? (
                <div className="flex justify-center py-40"><Loader2 className="animate-spin h-10 w-10 text-primary/20" /></div>
              ) : !studentMembers || studentMembers.length === 0 ? (
                <div className="py-40 text-center flex flex-col items-center gap-4 opacity-20">
                  <Sparkles className="h-16 w-16" />
                  <p className="text-xl font-black">등록된 학생이 없습니다.</p>
                </div>
              ) : (
                filteredStudents.map((student) => {
                  const report = dailyReports?.find(r => r.studentId === student.id);
                  return (
                    <div key={student.id} className="p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-muted/5 transition-colors group">
                      <div className="flex items-center gap-5">
                        <div className="relative">
                          <Avatar className="h-16 w-16 border-4 border-white shadow-xl group-hover:scale-110 transition-transform">
                            <AvatarFallback className="bg-primary/5 text-primary font-black text-xl">
                              {student.displayName?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          {report?.status === 'sent' && (
                            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full shadow-lg border-2 border-white">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div className="grid gap-1">
                          <h3 className="text-xl font-black group-hover:text-primary transition-colors">{student.displayName} 학생</h3>
                          <div className="flex items-center gap-2">
                            {report?.status === 'sent' ? (
                              <Badge className="bg-emerald-500 text-white border-none font-black px-3 py-0.5 rounded-full text-[10px]">발송 완료</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground border-2 font-black px-3 py-0.5 rounded-full text-[10px]">미발달/작성중</Badge>
                            )}
                            <span className="text-xs font-bold text-muted-foreground">
                              {report?.updatedAt ? `${format(report.updatedAt.toDate(), 'HH:mm')} 최종 업데이트` : '기록 없음'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Button 
                          variant="ghost" 
                          className="rounded-xl font-black h-12 px-6 gap-2 hover:bg-primary/5 text-primary"
                          asChild
                        >
                          <Link href={`/dashboard/teacher/students/${student.id}?tab=counseling`}>
                            <FileText className="h-4 w-4" /> 리포트 작성
                          </Link>
                        </Button>
                        <Button 
                          className={cn(
                            "rounded-xl font-black h-12 px-8 gap-2 shadow-lg active:scale-95 transition-all",
                            report?.status === 'sent' ? "bg-muted text-muted-foreground" : "bg-primary text-white"
                          )}
                          disabled={report?.status === 'sent'}
                        >
                          <Send className="h-4 w-4" /> {report?.status === 'sent' ? '발송 완료' : '지금 발송'}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
