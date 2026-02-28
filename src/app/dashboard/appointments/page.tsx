
'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2,
  XCircle,
  FileText,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy
} from 'firebase/firestore';
import { format } from 'date-fns';
import { CounselingLog } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function AppointmentsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, membershipsLoading } = useAppContext();

  const role = activeMembership?.role;
  const isStudent = role === 'student';

  // --- 상담 일지 쿼리 (상담 예약 쿼리는 오류 테스트를 위해 제거됨) ---
  const notesQuery = useMemoFirebase(() => {
    if (!firestore || membershipsLoading || !activeMembership?.id || !user?.uid || !role) return null;
    
    const baseRef = collection(firestore, 'centers', activeMembership.id, 'counselingLogs');
    
    // 학생은 본인 기록만 필터링
    if (isStudent) {
      return query(baseRef, where('studentId', '==', user.uid), orderBy('createdAt', 'desc'));
    }
    
    // 선생님/관리자는 전체 조회
    return query(baseRef, orderBy('createdAt', 'desc'));
  }, [firestore, membershipsLoading, activeMembership?.id, user?.uid, isStudent, role]);

  const { data: notes, isLoading: notesLoading } = useCollection<CounselingLog>(notesQuery);

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter">상담 및 피드백</h1>
          <p className="text-sm font-bold text-muted-foreground ml-1">선생님이 작성해주신 상담 일지와 피드백을 확인하세요.</p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-border/50">
            <CardHeader className="bg-muted/30 border-b p-6 sm:p-8">
              <CardTitle className="flex items-center gap-3 text-2xl font-black tracking-tight">
                <FileText className="h-6 w-6 text-primary" /> 나의 상담 일지 목록
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {notesLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
              ) : !notes || notes.length === 0 ? (
                <div className="py-20 border-2 border-dashed rounded-3xl flex flex-col items-center gap-3 opacity-30">
                  <XCircle className="h-10 w-10 text-muted-foreground" />
                  <span className="text-xs font-black uppercase tracking-widest text-center">작성된 일지가 없습니다.</span>
                </div>
              ) : (
                notes.map(note => (
                  <div key={note.id} className="p-6 rounded-2xl bg-muted/20 border border-border/50 hover:bg-white hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <Badge variant="outline" className={cn(
                        "text-[9px] font-black uppercase px-2 py-0.5 border-none",
                        note.type === 'academic' ? "bg-blue-100 text-blue-700" : 
                        note.type === 'life' ? "bg-amber-100 text-amber-700" : "bg-purple-100 text-purple-700"
                      )}>
                        {note.type === 'academic' ? '학업' : note.type === 'life' ? '생활' : '진로'}
                      </Badge>
                      <span className="text-[10px] font-bold text-muted-foreground/60">{note.createdAt ? format(note.createdAt.toDate(), 'yy.MM.dd') : ''}</span>
                    </div>
                    <p className="text-sm font-bold leading-relaxed text-foreground/80 mb-4">{note.content}</p>
                    {note.improvement && (
                      <div className="pt-4 border-t border-dashed border-primary/10">
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-primary mb-1 uppercase tracking-widest">
                          <CheckCircle2 className="h-3 w-3" /> 선생님 피드백
                        </div>
                        <p className="text-xs font-bold text-primary/70">{note.improvement}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-8">
          <Card className="border-none shadow-lg rounded-[2rem] bg-accent/5 overflow-hidden">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="p-2 bg-accent/10 rounded-xl">
                <AlertCircle className="h-5 w-5 text-accent" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-accent-foreground">안내 사항</h4>
                <p className="text-[11px] font-bold text-muted-foreground leading-relaxed">
                  현재 시스템 점검을 위해 상담 신청 기능이 일시적으로 중단되었습니다. 선생님이 작성해주신 기존 상담 일지는 정상적으로 조회 가능합니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
