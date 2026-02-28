'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { type StudentProfile, type AttendanceCurrent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { 
  Armchair, 
  Loader2, 
  Monitor, 
  Users, 
  MapPin,
  Maximize2,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const GRID_WIDTH = 20;
const GRID_HEIGHT = 10;

export default function LayoutViewPage() {
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const centerId = activeMembership?.id;

  // 데이터 조회
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'students');
  }, [firestore, centerId]);
  const { data: students, isLoading: studentsLoading } = useCollection<StudentProfile>(studentsQuery);

  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery);

  const isLoading = studentsLoading || attendanceLoading;
  const studyingCount = attendanceList?.filter(a => a.status === 'studying').length ?? 0;

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Monitor className="h-8 w-8 text-primary" />
            실시간 좌석 관제 센터
          </h1>
          <p className="text-muted-foreground font-bold">센터 내 모든 좌석의 실시간 상태를 대화면으로 모니터링합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-xl font-bold h-12 gap-2" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" /> 새로고침
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-none shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="grid gap-1">
              <span className="text-xs font-black text-muted-foreground uppercase">현재 학습</span>
              <span className="text-3xl font-black text-emerald-600">{studyingCount}</span>
            </div>
            <Users className="h-8 w-8 text-emerald-100" />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="grid gap-1">
              <span className="text-xs font-black text-muted-foreground uppercase">전체 좌석</span>
              <span className="text-3xl font-black text-primary">{attendanceList?.length || 0}</span>
            </div>
            <Armchair className="h-8 w-8 text-primary/10" />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm">
          <CardContent className="p-6 flex items-center justify-between text-amber-600">
            <div className="grid gap-1">
              <span className="text-xs font-black text-muted-foreground uppercase">외출/휴식</span>
              <span className="text-3xl font-black">{attendanceList?.filter(a => ['away', 'break'].includes(a.status)).length || 0}</span>
            </div>
            <MapPin className="h-8 w-8 opacity-20" />
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-none shadow-sm">
          <CardContent className="p-6 flex items-center justify-between text-muted-foreground">
            <div className="grid gap-1">
              <span className="text-xs font-black uppercase">미입실</span>
              <span className="text-3xl font-black">{attendanceList?.filter(a => a.status === 'absent').length || 0}</span>
            </div>
            <Maximize2 className="h-8 w-8 opacity-10" />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white ring-1 ring-border/50">
        <CardContent className="p-6 sm:p-10 bg-[#fafafa]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
              <Loader2 className="animate-spin h-12 w-12 text-primary" />
              <p className="font-bold text-muted-foreground">실시간 도면 데이터를 불러오는 중입니다...</p>
            </div>
          ) : !attendanceList || attendanceList.length === 0 ? (
            <div className="py-40 text-center flex flex-col items-center gap-4">
              <Armchair className="h-20 w-20 text-muted-foreground opacity-10" />
              <p className="text-xl font-bold text-muted-foreground/40">배치된 좌석이 없습니다. 대시보드에서 도면을 먼저 설정해 주세요.</p>
            </div>
          ) : (
            <div className="w-full overflow-auto custom-scrollbar bg-white rounded-[2rem] border shadow-2xl p-8 sm:p-12">
              <div 
                className="grid gap-2 sm:gap-3 mx-auto relative"
                style={{ 
                  gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(42px, 55px))`, 
                  width: 'fit-content',
                  backgroundImage: 'radial-gradient(circle, #00000005 1px, transparent 1px)',
                  backgroundSize: '24px 24px'
                }}
              >
                {Array.from({ length: GRID_HEIGHT * GRID_WIDTH }).map((_, idx) => {
                  const x = idx % GRID_WIDTH;
                  const y = Math.floor(idx / GRID_WIDTH);
                  const seat = attendanceList.find(a => a.gridX === x && a.gridY === y);
                  const occupant = students?.find(s => s.seatNo === seat?.seatNo);

                  if (!seat) return <div key={idx} className="w-[42px] h-[42px] sm:w-[52px] sm:h-[52px] opacity-[0.01]" />;

                  return (
                    <div 
                      key={seat.id} 
                      className={cn(
                        "w-[42px] h-[42px] sm:w-[52px] sm:h-[52px] rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-500 relative shadow-md border-solid",
                        seat.status === 'studying' ? "bg-emerald-50 border-emerald-500 text-emerald-700 ring-4 ring-emerald-500/10 scale-105 z-10" : 
                        seat.status === 'away' ? "bg-amber-50 border-amber-500 text-amber-700" :
                        seat.status === 'break' ? "bg-blue-50 border-blue-500 text-blue-700" : 
                        occupant ? "bg-white border-primary text-primary" : "bg-white border-primary/40 text-muted-foreground/20"
                      )}
                    >
                      <span className={cn(
                        "text-[8px] sm:text-[10px] font-black absolute top-1 left-1.5",
                        occupant ? "opacity-40" : "opacity-60"
                      )}>{seat.seatNo}</span>
                      
                      <span className="text-[10px] sm:text-[13px] font-black truncate px-1 w-full text-center mt-1">
                        {occupant ? occupant.name : ''}
                      </span>
                      
                      {seat.status === 'studying' && (
                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-lg animate-pulse" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <footer className="flex flex-wrap gap-6 items-center justify-center p-6 bg-muted/20 rounded-[2rem] border border-dashed border-primary/20">
        {[
          { label: '공부 중', color: 'bg-emerald-500' },
          { label: '외출 중', color: 'bg-amber-500' },
          { label: '휴식 중', color: 'bg-blue-500' },
          { label: '미입실', color: 'bg-muted border border-border' },
          { label: '좌석 미지정', color: 'bg-white border-2 border-primary/30' }
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={cn("w-4 h-4 rounded-md shadow-sm", item.color)} />
            <span className="text-xs font-black text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </footer>
    </div>
  );
}
