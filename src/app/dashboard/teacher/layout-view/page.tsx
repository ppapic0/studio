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
  Circle
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

  // 실제 좌석이 있는 구역만 계산하여 포커싱 (Auto-Zoom)
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
      toast({ title: `상태가 ${status}로 변경되었습니다.` });
      setIsManaging(false);
    } catch (e) {
      toast({ variant: "destructive", title: "상태 변경 실패" });
    }
  };

  const studyingCount = attendanceList?.filter(a => a.status === 'studying').length || 0;

  return (
    <div className={cn(
      "flex flex-col gap-4 w-full max-w-[1600px] mx-auto pb-24",
      isMobile ? "px-2" : "px-6 py-6"
    )}>
      <header className={cn(
        "flex justify-between items-center gap-4 bg-white/50 backdrop-blur-md p-4 rounded-[2rem] border shadow-sm",
        isMobile ? "flex-row" : ""
      )}>
        <div className="flex flex-col gap-0.5">
          <h1 className={cn(
            "font-black tracking-tighter flex items-center gap-2 text-primary whitespace-nowrap",
            isMobile ? "text-xl" : "text-3xl"
          )}>
            <Monitor className={cn("text-primary", isMobile ? "h-5 w-5" : "h-8 w-8")} />
            실시간 전체 도면
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-none font-black text-[9px] px-2 py-0">
              LIVE: {studyingCount}명 열공 중
            </Badge>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="icon"
          className="rounded-full h-10 w-10 bg-white shadow-sm border-primary/10" 
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="h-4 w-4 text-primary" />
        </Button>
      </header>

      <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white ring-1 ring-border/50 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
        <CardContent className={cn(
          "bg-[#f8f9fa] relative z-10",
          isMobile ? "p-2 min-h-[400px]" : "p-10 min-h-[600px]"
        )}>
          {studentsLoading || attendanceLoading ? (
            <div className="flex flex-col items-center justify-center h-[400px] gap-4">
              <div className="relative">
                <Loader2 className="animate-spin h-12 w-12 text-primary opacity-20" />
                <Zap className="h-12 w-12 text-primary absolute inset-0 animate-pulse scale-50" />
              </div>
              <p className="font-black text-muted-foreground/40 italic uppercase tracking-widest text-[10px]">Synchronizing Map Data...</p>
            </div>
          ) : !attendanceList || attendanceList.length === 0 ? (
            <div className="h-[400px] text-center flex flex-col items-center justify-center gap-4">
              <div className="bg-white p-8 rounded-full shadow-xl">
                <Armchair className="h-16 w-16 text-muted-foreground opacity-10" />
              </div>
              <p className="text-lg font-black text-muted-foreground/40 tracking-tighter">배치된 좌석이 없습니다.</p>
            </div>
          ) : (
            <div className={cn(
              "w-full bg-white rounded-[2rem] border shadow-2xl overflow-hidden relative",
              isMobile ? "p-3" : "p-12"
            )}>
              {/* 도면 배경 그리드 */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                style={{ 
                  backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', 
                  backgroundSize: '20px 20px' 
                }} 
              />
              
              <div 
                className="grid gap-1.5 sm:gap-3 w-full mx-auto relative z-10"
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
                        "aspect-square rounded-lg sm:rounded-2xl border-2 flex flex-col items-center justify-center transition-all relative cursor-pointer group shadow-sm active:scale-90",
                        isStudying ? "bg-emerald-500 border-emerald-600 text-white shadow-emerald-200" : 
                        isAbsent ? "bg-rose-50 border-rose-500 text-rose-700" :
                        isAway ? "bg-amber-500 border-amber-600 text-white shadow-amber-200" :
                        occupant ? "bg-white border-primary/40 text-primary" : "bg-white border-primary/5 text-muted-foreground/10 hover:border-primary/30"
                      )}
                    >
                      <span className={cn(
                        "font-black absolute top-1 left-1 leading-none",
                        isMobile ? "text-[6px]" : "text-[10px]",
                        !isAbsent ? "opacity-60" : "opacity-30"
                      )}>{seat.seatNo}</span>
                      
                      <div className="flex flex-col items-center gap-0.5 w-full px-0.5">
                        <span className={cn(
                          "font-black truncate w-full text-center leading-tight tracking-tighter",
                          isMobile ? "text-[8px]" : "text-[14px]"
                        )}>
                          {occupant ? occupant.name : ''}
                        </span>
                        {isStudying && (
                          <Activity className={cn("animate-pulse", isMobile ? "h-2 w-2" : "h-4 w-4")} />
                        )}
                      </div>
                      
                      {isAbsent && (
                        <div className="absolute -top-1 -right-1 bg-rose-600 text-white p-0.5 rounded-full shadow-lg border border-white">
                          <div className="rounded-full bg-white w-1 h-1 animate-ping" />
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

      <section className="bg-white/80 backdrop-blur-md rounded-[2rem] p-4 border shadow-xl flex flex-wrap gap-2 justify-center items-center">
        {[
          { label: '학습', color: 'bg-emerald-500', icon: Activity },
          { label: '미입실', color: 'bg-rose-500', icon: AlertCircle },
          { label: '외출/휴식', color: 'bg-amber-500', icon: Clock },
          { label: '빈자리', color: 'bg-white border-2 border-primary/10', icon: Circle }
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 bg-muted/30 px-4 py-2 rounded-2xl border border-border/50 shadow-inner group transition-all hover:bg-white hover:shadow-md cursor-default">
            <div className={cn("w-3 h-3 rounded-full shadow-sm group-hover:scale-125 transition-transform", item.color)} />
            <span className="text-[10px] font-black text-foreground/70 uppercase tracking-widest">{item.label}</span>
          </div>
        ))}
      </section>

      <Dialog open={isManaging} onOpenChange={setIsManaging}>
        <DialogContent className={cn(
          "border-none shadow-2xl p-0 overflow-hidden",
          isMobile ? "fixed bottom-0 top-auto translate-y-0 translate-x-0 left-0 right-0 max-w-none rounded-t-[3rem] rounded-b-none" : "rounded-[2.5rem] sm:max-w-md"
        )}>
          {selectedSeat && (
            <>
              <div className={cn(
                "p-8 text-white relative overflow-hidden",
                selectedSeat.status === 'studying' ? "bg-emerald-600" : 
                selectedSeat.studentId && selectedSeat.status === 'absent' ? "bg-rose-600" : 
                "bg-primary"
              )}>
                <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
                  <Monitor className="h-32 w-32" />
                </div>
                <DialogHeader className="relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge className="bg-white/20 text-white border-none font-black text-[10px] tracking-widest uppercase">Floor Control</Badge>
                    <span className="text-white/60 font-bold text-xs">{selectedSeat.seatNo}번 좌석 현황</span>
                  </div>
                  <DialogTitle className="text-4xl font-black tracking-tighter">
                    {students?.find(s => s.id === selectedSeat.studentId)?.name || '공석'}
                  </DialogTitle>
                </DialogHeader>
              </div>
              <div className="p-8 space-y-6 bg-white">
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={() => handleStatusUpdate('studying')} className="h-16 rounded-2xl font-black bg-emerald-500 hover:bg-emerald-600 shadow-lg text-sm gap-2 active:scale-95 transition-all">
                    <Zap className="h-4 w-4 fill-current" /> 입실/학습
                  </Button>
                  <Button onClick={() => handleStatusUpdate('away')} className="h-16 rounded-2xl font-black bg-amber-500 hover:bg-amber-600 shadow-lg text-sm gap-2 active:scale-95 transition-all">
                    <MapPin className="h-4 w-4" /> 외출 중
                  </Button>
                  <Button onClick={() => handleStatusUpdate('break')} className="h-16 rounded-2xl font-black bg-blue-500 hover:bg-blue-600 shadow-lg text-sm gap-2 active:scale-95 transition-all">
                    <Maximize2 className="h-4 w-4" /> 휴식 중
                  </Button>
                  <Button onClick={() => handleStatusUpdate('absent')} variant="outline" className="h-16 rounded-2xl font-black border-2 border-rose-200 text-rose-600 text-sm gap-2 active:scale-95 transition-all">
                    <AlertCircle className="h-4 w-4" /> 하원/퇴실
                  </Button>
                </div>
                {selectedSeat.studentId && (
                  <Button variant="secondary" className="w-full h-14 rounded-2xl font-black gap-2" asChild>
                    <a href={`/dashboard/teacher/students/${selectedSeat.studentId}`}>
                      학생 상세 리포트 보기 <Maximize2 className="h-4 w-4" />
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
