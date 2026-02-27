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
  Users, 
  Loader2, 
  Settings2,
  Save,
  Trash2,
  X,
  Plus,
  ArrowRight,
  TrendingUp,
  Monitor
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
      // 기존 데이터가 있으면 1번부터 순차적으로 정렬하여 상태 초기화
      const sorted = [...attendanceList].sort((a, b) => a.seatNo - b.seatNo);
      setTempLayout(sorted.map((a, i) => ({
        x: a.gridX || 0,
        y: a.gridY || 0,
        seatNo: i + 1 // 강제로 1번부터 다시 매김
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
      // 이미 좌석이 있는 곳을 클릭하면 삭제하고 나머지 번호 재정렬
      const newList = tempLayout.filter((_, i) => i !== existingIndex);
      const renumberedList = newList.map((s, i) => ({ ...s, seatNo: i + 1 }));
      setTempLayout(renumberedList);
    } else {
      // 새 좌석 추가 (현재 개수 + 1)
      const nextNo = tempLayout.length + 1;
      setTempLayout([...tempLayout, { x, y, seatNo: nextNo }]);
    }
  };

  const clearAllSeats = () => {
    setTempLayout([]);
  };

  const saveLayout = async () => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      
      // 1. 기존 좌석 데이터 삭제
      if (attendanceList) {
        attendanceList.forEach(a => {
          batch.delete(doc(firestore, 'centers', centerId, 'attendanceCurrent', a.id));
        });
      }

      // 2. 새로운 레이아웃 생성
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
    <div className="flex flex-col gap-6 sm:gap-8 w-full">
      {/* 반응형 헤더 섹션 */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
          <Monitor className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          실시간 관제 센터
        </h1>
        <p className="text-sm font-bold text-muted-foreground">오늘 센터의 흐름을 한눈에 파악하세요.</p>
      </div>

      {/* 요약 현황 그리드 (모바일 2열, 데스크톱 4열) */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: '현재 학습 중', val: studyingCount, color: 'text-emerald-500', icon: Users, sub: '실시간 입실 인원' },
          { label: '전체 좌석', val: attendanceList?.length || 0, color: 'text-primary', icon: Armchair, sub: '도면 배치 기준' },
          { label: '평균 완수율', val: '88%', color: 'text-amber-500', icon: TrendingUp, sub: '센터 전체 평균' },
          { label: '좌석 점유율', val: `${attendanceList && attendanceList.length > 0 ? Math.round((studyingCount / attendanceList.length) * 100) : 0}%`, color: 'text-blue-500', icon: Armchair, sub: '만석 임박 현황' }
        ].map((item, i) => (
          <Card key={i} className="rounded-2xl sm:rounded-3xl border-none shadow-md bg-white overflow-hidden group transition-all hover:shadow-lg">
            <CardHeader className="p-4 sm:p-6 pb-1 sm:pb-2">
              <div className="flex justify-between items-start">
                <CardDescription className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground/60">{item.label}</CardDescription>
                <div className={cn("p-1.5 sm:p-2 rounded-xl bg-opacity-10 transition-colors", item.color.replace('text-', 'bg-'))}>
                  <item.icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", item.color)} />
                </div>
              </div>
              <CardTitle className={cn("text-2xl sm:text-4xl font-black mt-1 sm:mt-2", item.color)}>{item.val}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="text-[9px] sm:text-[10px] font-bold text-muted-foreground">{item.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 실시간 좌석 현황판 섹션 */}
      <Card className="rounded-[1.5rem] sm:rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-muted/20 border-b p-5 sm:p-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl sm:text-2xl font-black flex items-center gap-2">
                <Armchair className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> 실시간 좌석 도면
              </CardTitle>
              <CardDescription className="font-bold text-xs sm:text-sm text-muted-foreground">실제 센터 구조와 동일하게 배치된 좌석 상태입니다.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              <Button 
                variant="outline" 
                className="flex-1 sm:flex-none rounded-xl sm:rounded-2xl font-black border-2 h-10 sm:h-12 px-3 sm:px-4 gap-2 border-primary/20 hover:border-primary transition-all text-xs sm:text-sm"
                onClick={openLayoutEditor}
              >
                <Settings2 className="h-4 w-4" />
                도면 수정
              </Button>
              <Button asChild className="flex-1 sm:flex-none rounded-xl sm:rounded-2xl font-black h-10 sm:h-12 px-4 sm:px-6 shadow-lg shadow-primary/20 text-xs sm:text-sm">
                <Link href="/dashboard/teacher/students" className="gap-2">학생 관리 <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-8">
          {attendanceLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 sm:h-10 sm:w-10 text-primary" /></div>
          ) : !attendanceList || attendanceList.length === 0 ? (
            <div className="py-16 sm:py-24 text-center flex flex-col items-center gap-4 bg-muted/10 rounded-[1.5rem] sm:rounded-[2.5rem] border-2 border-dashed">
              <Armchair className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground opacity-20" />
              <div className="grid gap-1 px-4">
                <p className="text-lg sm:text-xl font-black text-muted-foreground">아직 도면이 설정되지 않았습니다.</p>
                <p className="text-xs sm:text-sm font-bold text-muted-foreground/60">'도면 수정' 버튼을 눌러 좌석을 배치해 주세요.</p>
              </div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
              <div 
                className="grid gap-2 sm:gap-3 mx-auto p-3 sm:p-4 bg-muted/5 rounded-[1.5rem] sm:rounded-[2rem] border shadow-inner"
                style={{ 
                  gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(45px, 65px))`,
                  width: 'fit-content'
                }}
              >
                {Array.from({ length: GRID_HEIGHT * GRID_WIDTH }).map((_, idx) => {
                  const x = idx % GRID_WIDTH;
                  const y = Math.floor(idx / GRID_WIDTH);
                  const seat = attendanceList.find(a => a.gridX === x && a.gridY === y);
                  const occupant = students?.find(s => s.seatNo === seat?.seatNo);

                  if (!seat) return <div key={idx} className="w-[45px] h-[45px] sm:w-[60px] sm:h-[60px] opacity-10 bg-muted/20 rounded-lg sm:rounded-xl" />;

                  return (
                    <Link key={seat.id} href={occupant ? `/dashboard/teacher/students/${occupant.id}` : "#"}>
                      <div className={cn(
                        "w-[45px] h-[45px] sm:w-[60px] sm:h-[60px] rounded-lg sm:rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-300 hover:scale-110 relative shadow-sm",
                        seat.status === 'studying' ? "bg-emerald-50 border-emerald-400 text-emerald-700 ring-4 ring-emerald-500/10" : 
                        seat.status === 'away' ? "bg-amber-50 border-amber-400 text-amber-700" :
                        seat.status === 'break' ? "bg-blue-50 border-blue-400 text-blue-700" :
                        "bg-white border-border text-muted-foreground"
                      )}>
                        <span className="text-[8px] sm:text-[10px] font-black opacity-40 leading-none">{seat.seatNo}</span>
                        <span className="text-[9px] sm:text-[11px] font-black truncate px-1 w-full text-center leading-tight">
                          {occupant ? occupant.name : 'EMPTY'}
                        </span>
                        {seat.status === 'studying' && (
                          <div className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
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

      {/* 좌석 배치 에디터 모달 (반응형 최적화) */}
      <Dialog open={isLayoutModalOpen} onOpenChange={setIsLayoutModalOpen}>
        <DialogContent className="max-w-[98vw] sm:max-w-[95vw] lg:max-w-6xl h-[95vh] sm:h-auto rounded-xl sm:rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col">
          <DialogHeader className="p-5 sm:p-8 bg-primary text-primary-foreground relative shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsLayoutModalOpen(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-white hover:bg-white/10 rounded-full h-8 w-8 sm:h-10 sm:w-10"
            >
              <X className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
            <DialogTitle className="text-xl sm:text-3xl font-black tracking-tighter flex items-center gap-2 sm:gap-3">
              <Settings2 className="h-6 w-6 sm:h-8 sm:w-8" /> 도면 에디터
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/70 font-bold text-xs sm:text-base mt-1">
              칸을 클릭하여 좌석을 배치하세요. 번호는 클릭한 순서대로 부여됩니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-4 sm:p-8 bg-background overflow-hidden flex flex-col gap-4 sm:gap-6 flex-1">
            <div className="flex flex-col sm:flex-row items-center justify-between p-3 sm:p-5 bg-muted/30 rounded-xl sm:rounded-3xl border border-dashed gap-3 sm:gap-4 shrink-0">
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 bg-white border-2 rounded-md sm:rounded-lg" />
                  <span className="text-[10px] sm:text-sm font-bold text-muted-foreground">빈 칸</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 bg-primary rounded-md sm:rounded-lg shadow-sm" />
                  <span className="text-[10px] sm:text-sm font-bold text-primary">배치됨</span>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                <div className="flex-1 sm:flex-none text-[10px] sm:text-sm font-black bg-primary/10 text-primary px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl border border-primary/20 text-center">
                  배치된 좌석: <span className="text-base sm:text-lg">{tempLayout.length}</span>개
                </div>
                <Button variant="ghost" onClick={clearAllSeats} className="text-destructive font-black hover:bg-destructive/10 rounded-lg sm:rounded-xl gap-1.5 sm:gap-2 h-8 sm:h-10 text-[10px] sm:text-sm">
                  <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> 전체 삭제
                </Button>
              </div>
            </div>

            <div className="relative overflow-auto border-2 border-border/50 rounded-xl sm:rounded-[2rem] p-3 sm:p-6 bg-muted/5 flex-1 custom-scrollbar">
              <div 
                className="grid gap-1 sm:gap-2 mx-auto"
                style={{ 
                  gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(40px, 50px))`,
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
                        "w-[40px] h-[40px] sm:w-[50px] sm:h-[50px] rounded-lg sm:rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-200",
                        seat 
                          ? "bg-primary border-primary text-primary-foreground shadow-lg scale-105 z-10" 
                          : "bg-white border-dashed border-border/40 hover:border-primary/30 text-muted-foreground/10"
                      )}
                    >
                      {seat ? (
                        <>
                          <span className="text-[10px] sm:text-xs font-black leading-none">{seat.seatNo}</span>
                          <span className="text-[6px] sm:text-[7px] font-black opacity-60 uppercase">Seat</span>
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

          <DialogFooter className="p-4 sm:p-8 bg-muted/30 border-t flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
            <p className="text-[10px] sm:text-xs font-bold text-muted-foreground italic text-center sm:text-left">
              ※ 저장 시 기존의 도면 데이터가 현재 배치로 완전히 대체됩니다.
            </p>
            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
              <Button variant="ghost" onClick={() => setIsLayoutModalOpen(false)} className="flex-1 sm:flex-none rounded-lg sm:rounded-xl font-bold h-10 sm:h-12 px-4 sm:px-6 text-xs sm:text-sm">취소</Button>
              <Button 
                onClick={saveLayout} 
                disabled={isSaving || tempLayout.length === 0}
                className="flex-[2] sm:flex-none rounded-lg sm:rounded-2xl font-black px-6 sm:px-10 h-10 sm:h-12 shadow-xl gap-2 active:scale-95 transition-all text-xs sm:text-sm"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                레이아웃 저장 적용
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
