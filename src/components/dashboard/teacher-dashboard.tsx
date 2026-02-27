'use client';

import { useState, useMemo } from 'react';
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
  Users, 
  Loader2, 
  Settings2,
  Save,
  Trash2,
  X
} from 'lucide-react';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { 
  collection, 
  query, 
  orderBy, 
  writeBatch, 
  doc, 
  serverTimestamp,
} from 'firebase/firestore';
import { type StudentProfile, type AttendanceCurrent } from '@/lib/types';
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

// 그리드 크기 정의 (가로 20 x 세로 10)
const GRID_WIDTH = 20;
const GRID_HEIGHT = 10;

export function TeacherDashboard({ isActive }: { isActive: boolean }) {
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();
  
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // 편집 중인 임시 레이아웃 상태
  const [tempLayout, setTempLayout] = useState<{ x: number, y: number, seatNo: number }[]>([]);

  const centerId = activeMembership?.id;

  // 1. 학생 데이터 (이름 매칭용)
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'students'), orderBy('seatNo', 'asc'));
  }, [firestore, centerId]);
  const { data: students } = useCollection<StudentProfile>(studentsQuery, { enabled: isActive });

  // 2. 실시간 좌석 및 출결 (도면 데이터의 원천)
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery, { enabled: isActive });

  // 편집 모드 시작
  const openLayoutEditor = () => {
    if (attendanceList && attendanceList.length > 0) {
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

  // 그리드 클릭 핸들러 (좌석 추가/삭제)
  const handleGridClick = (x: number, y: number) => {
    const existingIndex = tempLayout.findIndex(s => s.x === x && s.y === y);
    
    if (existingIndex !== -1) {
      // 이미 좌석이 있는 곳을 클릭하면 삭제하고 번호 재정렬
      const newList = tempLayout.filter((_, i) => i !== existingIndex);
      // 번호를 1번부터 다시 매깁니다 (사용자가 클릭한 순서 유지 원할 시)
      const renumberedList = newList.map((s, i) => ({ ...s, seatNo: i + 1 }));
      setTempLayout(renumberedList);
    } else {
      // 새 좌석 추가 (현재 개수 + 1)
      const nextNo = tempLayout.length + 1;
      setTempLayout([...tempLayout, { x, y, seatNo: nextNo }]);
    }
  };

  // 모든 좌석 초기화
  const clearAllSeats = () => {
    setTempLayout([]);
  };

  // 레이아웃 DB 저장
  const saveLayout = async () => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      
      // 1. 기존 좌석 데이터 전체 삭제
      if (attendanceList) {
        attendanceList.forEach(a => {
          batch.delete(doc(firestore, 'centers', centerId, 'attendanceCurrent', a.id));
        });
      }

      // 2. 새로운 레이아웃 데이터 일괄 생성
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
      toast({ title: "레이아웃 저장 완료", description: "센터 도면이 성공적으로 업데이트되었습니다." });
      setIsLayoutModalOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "저장 실패", description: "권한이 없거나 오류가 발생했습니다." });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isActive) return null;

  const studyingCount = attendanceList?.filter(a => a.status === 'studying').length ?? 0;

  return (
    <div className="flex flex-col gap-8 w-full">
      {/* 요약 현황 섹션 */}
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
            <div className="text-[10px] font-bold text-muted-foreground">실시간 센터 이용 인원</div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-none shadow-md bg-white overflow-hidden">
          <CardHeader className="p-6 pb-2">
            <CardDescription className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">전체 좌석</CardDescription>
            <CardTitle className="text-4xl font-black text-primary mt-2">{attendanceList?.length || 0}</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-[10px] font-bold text-primary/60">도면에 배치된 총 좌석</div>
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
            <CardTitle className="text-4xl font-black mt-2">
              {attendanceList && attendanceList.length > 0 ? Math.round((studyingCount / attendanceList.length) * 100) : 0}%
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-[10px] font-bold opacity-80">만석 임박</div>
          </CardContent>
        </Card>
      </div>

      {/* 실시간 좌석 현황판 */}
      <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-muted/20 border-b p-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl font-black flex items-center gap-3">
                <Armchair className="h-6 w-6 text-primary" /> 실시간 좌석 현황
              </CardTitle>
              <CardDescription className="font-bold mt-1 text-sm text-muted-foreground">센터 실제 도면에 배치된 좌석별 실시간 상태입니다.</CardDescription>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                variant="outline" 
                className="flex-1 sm:flex-none rounded-2xl font-black border-2 h-12 px-4 gap-2 border-primary/20 hover:border-primary transition-all"
                onClick={openLayoutEditor}
              >
                <Settings2 className="h-4 w-4" />
                도면 배치 수정
              </Button>
              <Button asChild className="flex-1 sm:flex-none rounded-2xl font-black h-12 px-6 shadow-lg shadow-primary/20">
                <Link href="/dashboard/teacher/students">학생 관리</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          {attendanceLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>
          ) : !attendanceList || attendanceList.length === 0 ? (
            <div className="py-24 text-center flex flex-col items-center gap-4 bg-muted/10 rounded-[2.5rem] border-2 border-dashed">
              <Armchair className="h-16 w-16 text-muted-foreground opacity-20" />
              <div className="grid gap-1">
                <p className="text-xl font-black text-muted-foreground">아직 도면이 설정되지 않았습니다.</p>
                <p className="text-sm font-bold text-muted-foreground/60">'도면 배치 수정' 버튼을 눌러 좌석을 배치해 주세요.</p>
              </div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
              <div 
                className="grid gap-3 mx-auto p-4 bg-muted/5 rounded-[2rem] border"
                style={{ 
                  gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(50px, 1fr))`,
                  width: 'fit-content'
                }}
              >
                {Array.from({ length: GRID_HEIGHT * GRID_WIDTH }).map((_, idx) => {
                  const x = idx % GRID_WIDTH;
                  const y = Math.floor(idx / GRID_WIDTH);
                  const seat = attendanceList.find(a => a.gridX === x && a.gridY === y);
                  const occupant = students?.find(s => s.seatNo === seat?.seatNo);

                  if (!seat) return <div key={idx} className="w-12 h-12 sm:w-16 sm:h-16 opacity-10 bg-muted/20 rounded-xl" />;

                  return (
                    <Link key={seat.id} href={occupant ? `/dashboard/teacher/students/${occupant.id}` : "#"}>
                      <div className={cn(
                        "w-12 h-12 sm:w-16 sm:h-16 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-300 hover:scale-110 relative shadow-sm",
                        seat.status === 'studying' ? "bg-emerald-50 border-emerald-400 text-emerald-700 ring-4 ring-emerald-500/10" : 
                        seat.status === 'away' ? "bg-amber-50 border-amber-400 text-amber-700" :
                        seat.status === 'break' ? "bg-blue-50 border-blue-400 text-blue-700" :
                        "bg-white border-border text-muted-foreground"
                      )}>
                        <span className="text-[10px] font-black opacity-40 leading-none">{seat.seatNo}</span>
                        <span className="text-[11px] font-black truncate px-1 w-full text-center leading-tight">
                          {occupant ? occupant.name : '비어있음'}
                        </span>
                        {seat.status === 'studying' && (
                          <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
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

      {/* 좌석 배치 에디터 모달 */}
      <Dialog open={isLayoutModalOpen} onOpenChange={setIsLayoutModalOpen}>
        <DialogContent className="max-w-[95vw] lg:max-w-6xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-8 bg-primary text-primary-foreground relative">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsLayoutModalOpen(false)}
              className="absolute top-4 right-4 text-white hover:bg-white/10 rounded-full"
            >
              <X className="h-6 w-6" />
            </Button>
            <DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
              <Settings2 className="h-8 w-8" /> 센터 좌석 도면 에디터
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/70 font-bold text-base">
              그리드의 칸을 클릭하여 좌석을 배치하세요. 번호는 클릭한 순서대로 1번부터 매겨집니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-8 bg-background overflow-hidden flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-center justify-between p-5 bg-muted/30 rounded-3xl border border-dashed gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-white border-2 rounded-lg" />
                  <span className="text-sm font-bold text-muted-foreground">빈 공간</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-primary rounded-lg shadow-sm" />
                  <span className="text-sm font-bold text-primary">배치된 좌석</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm font-black bg-primary/10 text-primary px-4 py-2 rounded-xl border border-primary/20">
                  총 배치 좌석: <span className="text-lg">{tempLayout.length}</span>개
                </div>
                <Button variant="ghost" onClick={clearAllSeats} className="text-destructive font-black hover:bg-destructive/10 rounded-xl gap-2">
                  <Trash2 className="h-4 w-4" /> 전체 삭제
                </Button>
              </div>
            </div>

            <div className="relative overflow-auto border-2 border-border/50 rounded-[2rem] p-6 bg-muted/5 max-h-[50vh] custom-scrollbar">
              <div 
                className="grid gap-2 mx-auto"
                style={{ 
                  gridTemplateColumns: `repeat(${GRID_WIDTH}, 50px)`,
                  width: 'fit-content'
                }}
              >
                {Array.from({ length: GRID_HEIGHT * GRID_WIDTH }).map((_, idx) => {
                  const x = idx % GRID_WIDTH;
                  const y = Math.floor(idx / GRID_WIDTH);
                  const seat = tempLayout.find(s => s.x === x && s.y === y);

                  return (
                    <div
                      key={idx}
                      onClick={() => handleGridClick(x, y)}
                      className={cn(
                        "w-[50px] h-[50px] rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-200",
                        seat 
                          ? "bg-primary border-primary text-primary-foreground shadow-lg scale-105 z-10" 
                          : "bg-white border-dashed border-border/40 hover:border-primary/30 text-muted-foreground/10"
                      )}
                    >
                      {seat ? (
                        <>
                          <span className="text-xs font-black leading-none">{seat.seatNo}</span>
                          <span className="text-[7px] font-black opacity-60 uppercase">Seat</span>
                        </>
                      ) : (
                        <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-muted/30 border-t flex items-center justify-between gap-4">
            <p className="text-xs font-bold text-muted-foreground italic hidden sm:block">
              ※ 저장 시 기존의 모든 좌석 정보가 현재 도면으로 교체됩니다.
            </p>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button variant="ghost" onClick={() => setIsLayoutModalOpen(false)} className="rounded-xl font-bold h-12 px-6">취소</Button>
              <Button 
                onClick={saveLayout} 
                disabled={isSaving || tempLayout.length === 0}
                className="flex-1 sm:flex-none rounded-2xl font-black px-10 h-12 shadow-xl gap-2 active:scale-95 transition-all"
              >
                {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                레이아웃 저장 및 적용
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
