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
  User
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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

  // 유효 좌석 구역 자동 계산 (Bounding Box)
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

    const padding = 1;
    return {
      minX: Math.max(0, minX - padding),
      maxX: Math.min(GRID_WIDTH - 1, maxX + padding),
      minY: Math.max(0, minY - padding),
      maxY: Math.min(GRID_HEIGHT - 1, maxY + padding),
    };
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
      "flex flex-col gap-4 w-full max-w-[1600px] mx-auto pb-24 min-h-screen transition-all",
      isMobile ? "px-2 pt-2" : "px-6 py-6"
    )}>
      {/* 프리미엄 헤더 */}
      <header className={cn(
        "flex justify-between items-center gap-4 bg-white/80 backdrop-blur-xl p-4 rounded-[2rem] border shadow-xl ring-1 ring-black/5",
        isMobile ? "p-3" : "p-6"
      )}>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-xl">
              <Monitor className={cn("text-primary", isMobile ? "h-4 w-4" : "h-6 w-6")} />
            </div>
            <h1 className={cn(
              "font-black tracking-tighter text-primary whitespace-nowrap",
              isMobile ? "text-lg" : "text-2xl"
            )}>
              실시간 관제 도면
            </h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-none font-black text-[9px] px-2 py-0 animate-pulse">
              LIVE
            </Badge>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{studyingCount}명 집중 학습 중</span>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="icon"
          className="rounded-full h-10 w-10 bg-white shadow-md border-primary/5 hover:bg-primary/5 transition-all" 
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="h-4 w-4 text-primary opacity-60" />
        </Button>
      </header>

      {/* 도면 캔버스 영역 */}
      <Card className="rounded-[2.5rem] border-none shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden bg-white ring-1 ring-border/50 relative flex-1">
        <div className="absolute inset-0 bg-gradient-to-br from-[#f8f9fa] to-white pointer-events-none" />
        
        <CardContent className={cn(
          "relative z-10 flex items-center justify-center",
          isMobile ? "p-2 min-h-[450px]" : "p-10 min-h-[600px]"
        )}>
          {studentsLoading || attendanceLoading ? (
            <div className="flex flex-col items-center justify-center h-[400px] gap-4">
              <div className="relative">
                <Loader2 className="animate-spin h-12 w-12 text-primary opacity-20" />
                <Activity className="h-12 w-12 text-primary absolute inset-0 animate-pulse scale-50" />
              </div>
              <p className="font-black text-muted-foreground/40 italic uppercase tracking-[0.3em] text-[9px]">Synchronizing Matrix...</p>
            </div>
          ) : !attendanceList || attendanceList.length === 0 ? (
            <div className="h-[400px] text-center flex flex-col items-center justify-center gap-4">
              <div className="bg-muted/30 p-8 rounded-[3rem] shadow-inner">
                <Armchair className="h-16 w-16 text-muted-foreground opacity-10" />
              </div>
              <p className="text-lg font-black text-muted-foreground/40 tracking-tighter uppercase">No Seats Configured</p>
            </div>
          ) : (
            <div className={cn(
              "w-full max-w-full bg-white rounded-[2.5rem] border-2 border-muted shadow-2xl overflow-hidden relative transform-gpu transition-all",
              isMobile ? "p-4" : "p-12"
            )}>
              {/* 테크니컬 배경 그리드 */}
              <div className="absolute inset-0 opacity-[0.05] pointer-events-none" 
                style={{ 
                  backgroundImage: 'radial-gradient(circle, #000 1.2px, transparent 1.2px)', 
                  backgroundSize: '24px 24px' 
                }} 
              />
              
              <div 
                className="grid gap-2 sm:gap-4 w-full mx-auto relative z-10"
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
                      onClick={() => {
                        setSelectedSeat(seat);
                        setIsManaging(true);
                      }}
                      className={cn(
                        "aspect-square rounded-xl sm:rounded-2xl border-2 flex flex-col items-center justify-center transition-all relative cursor-pointer group shadow-md active:scale-90 transform-gpu overflow-hidden",
                        isStudying ? "bg-emerald-500 border-emerald-600 text-white shadow-emerald-200 ring-4 ring-emerald-500/10" : 
                        isAbsent ? "bg-rose-50 border-rose-500 text-rose-700 shadow-rose-100" :
                        isAway ? "bg-amber-500 border-amber-600 text-white shadow-amber-200" :
                        occupant ? "bg-white border-primary/20 text-primary hover:border-primary/50 shadow-sm" : "bg-muted/10 border-transparent text-muted-foreground/20 hover:border-muted cursor-default"
                      )}
                    >
                      {/* 좌석 번호 (초소형) */}
                      <span className={cn(
                        "font-black absolute top-1 left-1.5 leading-none",
                        isMobile ? "text-[6px]" : "text-[10px]",
                        isStudying || isAway ? "opacity-60" : "opacity-30"
                      )}>{seat.seatNo}</span>
                      
                      {/* 학생 이름 (중앙 강조) */}
                      <div className="flex flex-col items-center justify-center w-full px-1">
                        <span className={cn(
                          "font-black truncate w-full text-center leading-none tracking-tighter transition-all",
                          isMobile ? "text-[9px]" : "text-[15px]",
                          isStudying || isAway ? "text-white" : "text-primary"
                        )}>
                          {occupant ? occupant.name : ''}
                        </span>
                        
                        {isStudying && (
                          <div className="mt-1">
                            <Activity className={cn("animate-pulse stroke-[3px]", isMobile ? "h-2 w-2" : "h-4 w-4")} />
                          </div>
                        )}
                      </div>
                      
                      {/* 부재 중 표시 */}
                      {isAbsent && (
                        <div className="absolute bottom-1 right-1.5">
                          <AlertCircle className={cn("text-rose-600 opacity-60", isMobile ? "h-2 w-2" : "h-4 w-4")} />
                        </div>
                      )}

                      {/* 호버 시 디테일 오버레이 (Desktop Only) */}
                      {!isMobile && occupant && (
                        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 상태 안내 (Legend) */}
      <section className="bg-white/60 backdrop-blur-xl rounded-[2.2rem] p-3 border shadow-xl flex flex-wrap gap-2 justify-center items-center ring-1 ring-black/5">
        {[
          { label: '학습 중', color: 'bg-emerald-500', icon: Activity },
          { label: '미입실', color: 'bg-rose-500', icon: AlertCircle },
          { label: '외출/휴식', color: 'bg-amber-500', icon: Clock },
          { label: '빈자리', color: 'bg-muted/30 border border-muted', icon: Circle }
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 bg-white/50 px-4 py-2 rounded-2xl border border-white shadow-sm transition-all hover:bg-white hover:scale-105 cursor-default">
            <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm", item.color)} />
            <span className="text-[10px] font-black text-foreground/60 uppercase tracking-widest">{item.label}</span>
          </div>
        ))}
      </section>

      {/* 관리 바텀 시트 (Mobile) / 다이얼로그 (Desktop) */}
      <Dialog open={isManaging} onOpenChange={setIsManaging}>
        <DialogContent className={cn(
          "border-none shadow-[0_-20px_80px_rgba(0,0,0,0.2)] p-0 overflow-hidden transition-all duration-500",
          isMobile 
            ? "fixed bottom-0 top-auto translate-y-0 translate-x-0 left-0 right-0 max-w-none rounded-t-[3.5rem] rounded-b-none animate-in slide-in-from-bottom duration-500" 
            : "rounded-[3rem] sm:max-w-md"
        )}>
          {selectedSeat && (
            <>
              <div className={cn(
                "p-10 text-white relative overflow-hidden",
                selectedSeat.status === 'studying' ? "bg-emerald-600" : 
                selectedSeat.studentId && selectedSeat.status === 'absent' ? "bg-rose-600" : 
                "bg-primary"
              )}>
                <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
                  <Monitor className="h-48 w-48" />
                </div>
                <DialogHeader className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <Badge className="bg-white/20 text-white border-none font-black text-[10px] tracking-widest uppercase py-1 px-3 rounded-lg backdrop-blur-md">Seat Controller</Badge>
                    <span className="text-white/60 font-black text-sm uppercase tracking-tighter">No.{selectedSeat.seatNo}</span>
                  </div>
                  <DialogTitle className="text-5xl font-black tracking-tighter flex items-center gap-3">
                    {students?.find(s => s.id === selectedSeat.studentId)?.name || '공석'}
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  </DialogTitle>
                  <p className="text-white/60 font-bold text-xs mt-2 uppercase tracking-widest">Real-time status management</p>
                </DialogHeader>
              </div>
              <div className="p-8 space-y-6 bg-white">
                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={() => handleStatusUpdate('studying')} className="h-20 rounded-[1.8rem] font-black bg-emerald-500 hover:bg-emerald-600 shadow-lg text-sm gap-2 transition-all active:scale-95 group">
                    <Zap className="h-5 w-5 fill-current group-hover:scale-110 transition-transform" /> 입실/학습
                  </Button>
                  <Button onClick={() => handleStatusUpdate('away')} className="h-20 rounded-[1.8rem] font-black bg-amber-500 hover:bg-amber-600 shadow-lg text-sm gap-2 transition-all active:scale-95 group">
                    <MapPin className="h-5 w-5 group-hover:rotate-12 transition-transform" /> 외출 중
                  </Button>
                  <Button onClick={() => handleStatusUpdate('break')} className="h-20 rounded-[1.8rem] font-black bg-blue-500 hover:bg-blue-600 shadow-lg text-sm gap-2 transition-all active:scale-95 group">
                    <Maximize2 className="h-5 w-5 group-hover:scale-110 transition-transform" /> 휴식 중
                  </Button>
                  <Button onClick={() => handleStatusUpdate('absent')} variant="outline" className="h-20 rounded-[1.8rem] font-black border-2 border-rose-100 text-rose-600 text-sm gap-2 transition-all active:scale-95 hover:bg-rose-50">
                    <AlertCircle className="h-5 w-5" /> 퇴실/하원
                  </Button>
                </div>
                {selectedSeat.studentId && (
                  <Button variant="secondary" className="w-full h-16 rounded-[1.5rem] font-black gap-3 text-base shadow-sm group" asChild>
                    <a href={`/dashboard/teacher/students/${selectedSeat.studentId}`}>
                      <User className="h-5 w-5 text-primary opacity-40 group-hover:opacity-100" />
                      학생 프로필 및 상세 분석
                      <ChevronRight className="ml-auto h-5 w-5 opacity-20" />
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
