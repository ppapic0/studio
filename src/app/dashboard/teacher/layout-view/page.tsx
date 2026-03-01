'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { type StudentProfile, type AttendanceCurrent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { 
  Armchair, 
  Loader2, 
  Monitor, 
  RefreshCw,
  Clock,
  MapPin,
  Maximize2,
  AlertCircle,
  Activity,
  Zap,
  Circle,
  User,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';

const GRID_WIDTH = 20;
const GRID_HEIGHT = 10;

export default function LayoutViewPage() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const centerId = activeMembership?.id;
  const isMobile = viewMode === 'mobile';

  const [selectedSeat, setSelectedSeat] = useState<AttendanceCurrent | null>(null);
  const [isManaging, setIsManaging] = useState(false);

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

  // 유효 좌석 구역 자동 계산 (Bounding Box) - 패딩을 제거하여 크기 극대화
  const seatBounds = useMemo(() => {
    if (!attendanceList || attendanceList.length === 0) return null;
    
    let minX = GRID_WIDTH, maxX = 0, minY = GRID_HEIGHT, maxY = 0;
    attendanceList.forEach(s => {
      if (s.gridX !== undefined && s.gridY !== undefined) {
        minX = Math.min(minX, s.gridX);
        maxX = Math.max(maxX, s.gridX);
        minY = Math.min(minY, s.gridY);
        maxY = Math.max(maxY, s.gridY);
      }
    });

    return { minX, maxX, minY, maxY };
  }, [attendanceList]);

  const gridDimensions = useMemo(() => {
    if (!seatBounds) return { cols: GRID_WIDTH, rows: GRID_HEIGHT, startX: 0, startY: 0 };
    return {
      cols: seatBounds.maxX - seatBounds.minX + 1,
      rows: seatBounds.maxY - seatBounds.minY + 1,
      startX: seatBounds.minX,
      startY: seatBounds.minY
    };
  }, [seatBounds]);

  const handleStatusUpdate = async (status: AttendanceCurrent['status']) => {
    if (!firestore || !centerId || !selectedSeat) return;
    try {
      const seatRef = doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id);
      await updateDoc(seatRef, { status, updatedAt: serverTimestamp() });
      toast({ title: `상태가 변경되었습니다.` });
      setIsManaging(false);
    } catch (e) {
      toast({ variant: "destructive", title: "상태 변경 실패" });
    }
  };

  const studyingCount = attendanceList?.filter(a => a.status === 'studying').length || 0;

  return (
    <div className={cn(
      "flex flex-col gap-3 w-full max-w-[1600px] mx-auto pb-24 min-h-screen transition-all",
      isMobile ? "px-1 pt-1" : "px-6 py-6"
    )}>
      {/* 컴팩트 헤더 */}
      <header className={cn(
        "flex justify-between items-center bg-white/80 backdrop-blur-xl border shadow-sm ring-1 ring-black/5",
        isMobile ? "p-3 rounded-2xl" : "p-6 rounded-[2rem]"
      )}>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Monitor className={cn("text-primary", isMobile ? "h-4 w-4" : "h-6 w-6")} />
            <h1 className={cn("font-black tracking-tighter text-primary", isMobile ? "text-base" : "text-2xl")}>
              실시간 관제
            </h1>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-none font-black text-[8px] px-1.5 py-0 animate-pulse">
              LIVE
            </Badge>
          </div>
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{studyingCount}명 열공 중</span>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => window.location.reload()}>
          <RefreshCw className="h-3.5 w-3.5 opacity-40" />
        </Button>
      </header>

      {/* 도면 영역 - 패딩 최소화로 크기 확보 */}
      <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden bg-white ring-1 ring-border/50 relative flex-1 flex flex-col">
        <div className="absolute inset-0 bg-[#f8f9fa] opacity-50 pointer-events-none" />
        
        <CardContent className={cn(
          "relative z-10 flex items-center justify-center flex-1",
          isMobile ? "p-1" : "p-10"
        )}>
          {studentsLoading || attendanceLoading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" />
              <p className="font-black text-[8px] text-muted-foreground uppercase tracking-widest">Loading Map...</p>
            </div>
          ) : !attendanceList || attendanceList.length === 0 ? (
            <div className="text-center opacity-20">
              <Armchair className="h-12 w-12 mx-auto mb-2" />
              <p className="text-xs font-black">No Seats</p>
            </div>
          ) : (
            <div className={cn(
              "w-full bg-white rounded-[1.5rem] border-2 shadow-2xl overflow-hidden relative",
              isMobile ? "p-2" : "p-12"
            )}>
              {/* 테크니컬 배경 그리드 */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 24px' }} 
              />
              
              <div 
                className={cn("grid w-full mx-auto relative z-10", isMobile ? "gap-1" : "gap-4")}
                style={{ 
                  gridTemplateColumns: `repeat(${gridDimensions.cols}, minmax(0, 1fr))`,
                  gridAutoRows: '1fr',
                }}
              >
                {Array.from({ length: gridDimensions.rows * gridDimensions.cols }).map((_, idx) => {
                  const x = gridDimensions.startX + (idx % gridDimensions.cols);
                  const y = gridDimensions.startY + Math.floor(idx / gridDimensions.cols);
                  const seat = attendanceList.find(a => a.gridX === x && a.gridY === y);
                  const occupant = students?.find(s => s.id === seat?.studentId);

                  if (!seat) return <div key={idx} className="aspect-square opacity-0" />;

                  const isStudying = seat.status === 'studying';
                  const isAway = seat.status === 'away' || seat.status === 'break';
                  const isAbsent = seat.studentId && seat.status === 'absent';

                  return (
                    <div 
                      key={seat.id} 
                      onClick={() => { setSelectedSeat(seat); setIsManaging(true); }}
                      className={cn(
                        "aspect-square rounded-md sm:rounded-2xl border flex flex-col items-center justify-center transition-all relative cursor-pointer shadow-sm active:scale-90",
                        isStudying ? "bg-emerald-500 border-emerald-600 text-white shadow-emerald-100 ring-2 ring-emerald-500/20" : 
                        isAbsent ? "bg-rose-50 border-rose-400 text-rose-700" :
                        isAway ? "bg-amber-500 border-amber-600 text-white" :
                        occupant ? "bg-white border-primary/20 text-primary hover:border-primary/50" : "bg-muted/10 border-transparent text-muted-foreground/10"
                      )}
                    >
                      {/* 좌석 번호 (초소형) */}
                      <span className={cn(
                        "font-black absolute top-0.5 left-1 leading-none",
                        isMobile ? "text-[5px]" : "text-[10px]",
                        isStudying || isAway ? "opacity-60" : "opacity-30"
                      )}>{seat.seatNo}</span>
                      
                      {/* 학생 이름 (최대화) */}
                      <div className="flex flex-col items-center justify-center w-full px-0.5">
                        <span className={cn(
                          "font-black truncate w-full text-center leading-none tracking-tighter",
                          isMobile ? "text-[10px] sm:text-[12px]" : "text-[16px]",
                          isStudying || isAway ? "text-white" : "text-primary"
                        )}>
                          {occupant ? occupant.name : ''}
                        </span>
                        
                        {isStudying && (
                          <Activity className={cn("animate-pulse stroke-[3px] mt-0.5", isMobile ? "h-1.5 w-1.5" : "h-4 w-4")} />
                        )}
                      </div>
                      
                      {isAbsent && (
                        <div className="absolute bottom-0.5 right-0.5">
                          <AlertCircle className={cn("text-rose-600 opacity-60", isMobile ? "h-1.5 w-1.5" : "h-4 w-4")} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 상태 안내 */}
      <section className="bg-white/60 backdrop-blur-xl rounded-[1.5rem] p-2 border shadow-sm flex flex-wrap gap-1.5 justify-center items-center">
        {[
          { label: '학습', color: 'bg-emerald-500' },
          { label: '부재', color: 'bg-rose-500' },
          { label: '외출', color: 'bg-amber-500' },
          { label: '빈자리', color: 'bg-muted/30 border border-muted' }
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 bg-white/50 px-3 py-1.5 rounded-xl border border-white shadow-xs">
            <div className={cn("w-2 h-2 rounded-full", item.color)} />
            <span className="text-[9px] font-black text-foreground/60 uppercase tracking-tighter">{item.label}</span>
          </div>
        ))}
      </section>

      {/* 관리 바텀 시트 */}
      <Dialog open={isManaging} onOpenChange={setIsManaging}>
        <DialogContent className={cn(
          "border-none shadow-2xl p-0 overflow-hidden transition-all",
          isMobile 
            ? "fixed bottom-0 top-auto translate-y-0 translate-x-0 left-0 right-0 max-w-none rounded-t-[2.5rem] rounded-b-none" 
            : "rounded-[3rem] sm:max-w-md"
        )}>
          {selectedSeat && (
            <>
              <div className={cn(
                "p-8 text-white relative overflow-hidden",
                selectedSeat.status === 'studying' ? "bg-emerald-600" : 
                selectedSeat.studentId && selectedSeat.status === 'absent' ? "bg-rose-600" : 
                "bg-primary"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-white/20 text-white border-none font-black text-[10px] tracking-widest uppercase">Quick Control</Badge>
                  <span className="text-white/60 font-black text-xs">No.{selectedSeat.seatNo}</span>
                </div>
                <DialogTitle className="text-4xl font-black tracking-tighter">
                  {students?.find(s => s.id === selectedSeat.studentId)?.name || '공석'}
                </DialogTitle>
              </div>
              <div className="p-6 space-y-4 bg-white">
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={() => handleStatusUpdate('studying')} className="h-16 rounded-2xl font-black bg-emerald-500 hover:bg-emerald-600 shadow-lg text-sm gap-2">
                    <Zap className="h-4 w-4 fill-current" /> 학습 시작
                  </Button>
                  <Button onClick={() => handleStatusUpdate('away')} className="h-16 rounded-2xl font-black bg-amber-500 hover:bg-amber-600 shadow-lg text-sm gap-2">
                    <MapPin className="h-4 w-4" /> 외출 중
                  </Button>
                  <Button onClick={() => handleStatusUpdate('break')} className="h-16 rounded-2xl font-black bg-blue-500 hover:bg-blue-600 shadow-lg text-sm gap-2">
                    <Maximize2 className="h-4 w-4" /> 휴식 중
                  </Button>
                  <Button onClick={() => handleStatusUpdate('absent')} variant="outline" className="h-16 rounded-2xl font-black border-2 border-rose-100 text-rose-600 text-sm gap-2">
                    <AlertCircle className="h-4 w-4" /> 퇴실/하원
                  </Button>
                </div>
                {selectedSeat.studentId && (
                  <Button variant="secondary" className="w-full h-14 rounded-2xl font-black gap-3 text-sm shadow-sm" asChild>
                    <a href={`/dashboard/teacher/students/${selectedSeat.studentId}`}>
                      <User className="h-4 w-4 opacity-40" />
                      상세 분석 및 관리
                      <ChevronRight className="ml-auto h-4 w-4 opacity-20" />
                    </a>
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
