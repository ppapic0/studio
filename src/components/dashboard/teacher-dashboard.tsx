'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  Armchair, 
  MessageSquare, 
  TrendingUp, 
  Users, 
  Loader2, 
  Zap, 
  ChevronRight, 
  Wrench,
  CheckCircle2,
  Settings2,
  Save,
  Plus,
  Trash2
} from 'lucide-react';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  Timestamp, 
  writeBatch, 
  doc, 
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { type StudentProfile, type AttendanceCurrent } from '@/lib/types';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// 그리드 크기 정의 (10x10)
const GRID_SIZE = 10;

export function TeacherDashboard({ isActive }: { isActive: boolean }) {
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();
  
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tempLayout, setTempLayout] = useState<{ x: number, y: number, seatNo: number }[]>([]);

  const centerId = activeMembership?.id;

  // 1. 학생 데이터
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'students'), orderBy('seatNo', 'asc'));
  }, [firestore, centerId]);
  const { data: students, isLoading: studentsLoading } = useCollection<StudentProfile>(studentsQuery, { enabled: isActive });

  // 2. 실시간 좌석 및 출결
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery, { enabled: isActive });

  // 3. 오늘 상담 예약
  const reservationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    const start = Timestamp.fromDate(startOfDay(new Date()));
    const end = Timestamp.fromDate(endOfDay(new Date()));
    return query(
      collection(firestore, 'centers', centerId, 'counselingReservations'),
      where('scheduledAt', '>=', start),
      where('scheduledAt', '<=', end),
      orderBy('scheduledAt', 'asc')
    );
  }, [firestore, centerId]);
  const { data: reservations, isLoading: resLoading } = useCollection<any>(reservationsQuery, { enabled: isActive });

  // 편집 모드 시작 (현재 데이터 불러오기)
  const openLayoutEditor = () => {
    if (attendanceList) {
      setTempLayout(attendanceList.map(a => ({
        x: a.gridX || 0,
        y: a.gridY || 0,
        seatNo: a.seatNo
      })));
    } else {
      setTempLayout([]);
    }
    setIsLayoutModalOpen(true);
  };

  const handleGridClick = (x: number, y: number) => {
    const existing = tempLayout.find(s => s.x === x && s.y === y);
    if (existing) {
      setTempLayout(tempLayout.filter(s => s !== existing));
    } else {
      const nextSeatNo = tempLayout.length > 0 
        ? Math.max(...tempLayout.map(s => s.seatNo)) + 1 
        : 1;
      setTempLayout([...tempLayout, { x, y, seatNo: nextSeatNo }]);
    }
  };

  const saveLayout = async () => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      
      // 기존 좌석들 모두 삭제 (초기화 후 재배치)
      if (attendanceList) {
        attendanceList.forEach(a => {
          batch.delete(doc(firestore, 'centers', centerId, 'attendanceCurrent', a.id));
        });
      }

      // 새 레이아웃 저장
      tempLayout.forEach(s => {
        const seatId = `seat_${s.seatNo.toString().padStart(3, '0')}`;
        const seatRef = doc(firestore, 'centers', centerId, 'attendanceCurrent', seatId);
        batch.set(seatRef, {
          seatNo: s.seatNo,
          gridX: s.x,
          gridY: s.y,
          status: 'absent',
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      toast({ title: "레이아웃 저장 완료", description: "센터 도면이 업데이트되었습니다." });
      setIsLayoutModalOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "저장 실패" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isActive) return null;

  const studyingCount = attendanceList?.filter(a => a.status === 'studying').length ?? 0;

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* 요약 카드 */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-3xl border-none shadow-md bg-white overflow-hidden group">
          <CardHeader className="p-6 pb-2">
            <div className="flex justify-between items-start">
              <CardDescription className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">현재 학습 중</CardDescription>
              <div className="p-2 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
                <Users className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <CardTitle className="text-4xl font-black text-emerald-500 mt-2">{studyingCount}</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-[10px] font-bold text-muted-foreground">정원 대비 실시간 인원</div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-none shadow-md bg-white overflow-hidden">
          <CardHeader className="p-6 pb-2">
            <CardDescription className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">오늘 상담</CardDescription>
            <CardTitle className="text-4xl font-black text-primary mt-2">{reservations?.length ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-[10px] font-bold text-primary/60">남은 예약 건수</div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-none shadow-md bg-white overflow-hidden">
          <CardHeader className="p-6 pb-2">
            <CardDescription className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">평균 완수율</CardDescription>
            <CardTitle className="text-4xl font-black text-amber-500 mt-2">88%</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-[10px] font-bold text-amber-600/60">센터 전체 평균</div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-none shadow-md bg-primary text-primary-foreground overflow-hidden">
          <CardHeader className="p-6 pb-2">
            <CardDescription className="text-xs font-black uppercase tracking-widest opacity-60">좌석 점유율</CardDescription>
            <CardTitle className="text-4xl font-black mt-2">92%</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-[10px] font-bold opacity-80">만석 임박</div>
          </CardContent>
        </Card>
      </div>

      {/* 좌석 현황판 */}
      <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-muted/20 border-b p-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-black flex items-center gap-3">
                <Armchair className="h-6 w-6 text-primary" /> 실시간 좌석 현황
              </CardTitle>
              <CardDescription className="font-bold mt-1 text-sm text-muted-foreground">센터 도면에 배치된 좌석별 학습 상태입니다.</CardDescription>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                variant="outline" 
                className="flex-1 sm:flex-none rounded-2xl font-black border-2 h-12 px-4 gap-2"
                onClick={openLayoutEditor}
              >
                <Settings2 className="h-4 w-4" />
                도면 배치 수정
              </Button>
              <Button asChild variant="default" className="flex-1 sm:flex-none rounded-2xl font-black h-12 px-6 shadow-lg shadow-primary/20">
                <Link href="/dashboard/teacher/students">학생 관리</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          {attendanceLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>
          ) : !attendanceList || attendanceList.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center gap-4 bg-muted/10 rounded-[2rem] border-2 border-dashed">
              <Armchair className="h-12 w-12 text-muted-foreground opacity-20" />
              <p className="font-black text-muted-foreground">배치된 좌석이 없습니다. '도면 배치 수정'을 클릭하세요.</p>
            </div>
          ) : (
            <div className="relative w-full overflow-auto p-4 bg-muted/5 rounded-3xl min-h-[400px]">
              {/* 실제 배치된 좌석들을 그리드 좌표에 따라 렌더링 */}
              <div 
                className="grid gap-2 mx-auto"
                style={{ 
                  gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(40px, 1fr))`,
                  width: 'fit-content'
                }}
              >
                {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
                  const x = idx % GRID_SIZE;
                  const y = Math.floor(idx / GRID_SIZE);
                  const seat = attendanceList.find(a => a.gridX === x && a.gridY === y);
                  const occupant = students?.find(s => s.seatNo === seat?.seatNo);

                  if (!seat) return <div key={idx} className="w-10 h-10 sm:w-14 sm:h-14" />;

                  return (
                    <Link key={seat.id} href={occupant ? `/dashboard/teacher/students/${occupant.id}` : "#"}>
                      <div className={cn(
                        "w-10 h-10 sm:w-14 sm:h-14 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-300 hover:scale-110 relative shadow-sm",
                        seat.status === 'studying' ? "bg-emerald-50 border-emerald-400 text-emerald-700" : 
                        seat.status === 'away' ? "bg-amber-50 border-amber-400 text-amber-700" :
                        seat.status === 'break' ? "bg-blue-50 border-blue-400 text-blue-700" :
                        "bg-white border-border text-muted-foreground"
                      )}>
                        <span className="text-[8px] font-black opacity-40 leading-none">{seat.seatNo}</span>
                        <span className="text-[10px] font-black truncate px-0.5 w-full text-center leading-none">
                          {occupant ? occupant.name : 'Empty'}
                        </span>
                        {seat.status === 'studying' && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 좌석 배치 헬퍼 모달 */}
      <Dialog open={isLayoutModalOpen} onOpenChange={setIsLayoutModalOpen}>
        <DialogContent className="max-w-3xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-8 bg-primary text-primary-foreground">
            <DialogTitle className="text-2xl font-black tracking-tighter flex items-center gap-2">
              <Wrench className="h-6 w-6" /> 좌석 배치 헬퍼 (도면 에디터)
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/70 font-bold">
              센터 도면에 맞춰 좌석을 클릭하여 배치하세요. 클릭 시 좌석이 생성/삭제됩니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-8 bg-background">
            <div className="mb-6 flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-dashed">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white border-2 rounded-md" />
                  <span className="text-xs font-bold">빈 공간</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-primary rounded-md" />
                  <span className="text-xs font-bold">배치된 좌석</span>
                </div>
              </div>
              <div className="text-xs font-black text-primary">
                총 배치된 좌석: {tempLayout.length}개
              </div>
            </div>

            <div className="relative overflow-auto border-2 border-border/50 rounded-3xl p-4 bg-muted/5">
              <div 
                className="grid gap-1.5 mx-auto"
                style={{ 
                  gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
                  width: 'fit-content'
                }}
              >
                {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, idx) => {
                  const x = idx % GRID_SIZE;
                  const y = Math.floor(idx / GRID_SIZE);
                  const seat = tempLayout.find(s => s.x === x && s.y === y);

                  return (
                    <div
                      key={idx}
                      onClick={() => handleGridClick(x, y)}
                      className={cn(
                        "w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 hover:border-primary/50",
                        seat ? "bg-primary border-primary text-primary-foreground shadow-md" : "bg-white border-dashed border-border text-muted-foreground/20"
                      )}
                    >
                      {seat && (
                        <>
                          <span className="text-[10px] font-black leading-none">{seat.seatNo}</span>
                          <span className="text-[8px] font-bold opacity-60">SEAT</span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-muted/30 border-t gap-3">
            <Button variant="ghost" onClick={() => setIsLayoutModalOpen(false)} className="rounded-xl font-bold">취소</Button>
            <Button 
              onClick={saveLayout} 
              disabled={isSaving}
              className="rounded-xl font-black px-8 h-12 shadow-lg gap-2"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              레이아웃 설정 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
