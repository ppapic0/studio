
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
  Activity
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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

  // [UI 핵심] 실제 좌석이 있는 구역만 계산하여 포커싱 (Auto-Zoom)
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

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto pb-10 px-1 sm:px-4">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tighter flex items-center gap-2 text-primary break-keep whitespace-nowrap">
            <Monitor className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            실시간 전체 도면
          </h1>
          <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60">Full-scale Monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-xl font-black h-10 gap-2 bg-white shadow-sm text-xs" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" /> 새로고침
          </Button>
        </div>
      </header>

      <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white ring-1 ring-border/50">
        <CardContent className="p-2 sm:p-10 bg-[#f8f9fa]">
          {studentsLoading || attendanceLoading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
              <Loader2 className="animate-spin h-12 w-12 text-primary opacity-20" />
              <p className="font-bold text-muted-foreground">도면 데이터 로드 중...</p>
            </div>
          ) : !attendanceList || attendanceList.length === 0 ? (
            <div className="py-40 text-center flex flex-col items-center gap-4">
              <Armchair className="h-20 w-20 text-muted-foreground opacity-10" />
              <p className="text-xl font-bold text-muted-foreground/40">배치된 좌석이 없습니다.</p>
            </div>
          ) : (
            <div className="w-full bg-white rounded-[2rem] border shadow-2xl p-2 sm:p-12 overflow-hidden">
              <div 
                className="grid gap-1.5 sm:gap-3 w-full mx-auto relative"
                style={{ 
                  gridTemplateColumns: `repeat(${gridDimensions.cols}, minmax(0, 1fr))`,
                  gridAutoRows: '1fr',
                  backgroundImage: 'radial-gradient(circle, #00000008 1px, transparent 1px)',
                  backgroundSize: '20px 20px'
                }}
              >
                {Array.from({ length: gridDimensions.rows * gridDimensions.cols }).map((_, idx) => {
                  const x = gridDimensions.startX + (idx % gridDimensions.cols);
                  const y = gridDimensions.startY + Math.floor(idx / gridDimensions.cols);
                  const seat = attendanceList.find(a => a.gridX === x && a.gridY === y);
                  const occupant = students?.find(s => s.id === seat?.studentId);

                  if (!seat) return <div key={idx} className="aspect-square opacity-0" />;

                  const isLateOrAbsent = seat.studentId && seat.status === 'absent';

                  return (
                    <div 
                      key={seat.id} 
                      onClick={() => {
                        setSelectedSeat(seat);
                        setIsManaging(true);
                      }}
                      className={cn(
                        "aspect-square rounded-lg sm:rounded-2xl border-2 flex flex-col items-center justify-center transition-all relative cursor-pointer group shadow-sm active:scale-95",
                        seat.status === 'studying' ? "bg-emerald-500 border-emerald-600 text-white animate-pulse-soft" : 
                        isLateOrAbsent ? "bg-rose-50 border-rose-500 text-rose-700" :
                        seat.status === 'away' ? "bg-amber-500 border-amber-600 text-white" :
                        seat.status === 'break' ? "bg-blue-500 border-blue-600 text-white" : 
                        occupant ? "bg-white border-primary/40 text-primary" : "bg-white border-primary/5 text-muted-foreground/10 hover:border-primary/30"
                      )}
                    >
                      <span className={cn(
                        "font-black absolute top-1 left-1 leading-none",
                        isMobile ? "text-[7px]" : "text-[11px]",
                        seat.status !== 'absent' ? "opacity-60" : "opacity-30"
                      )}>{seat.seatNo}</span>
                      
                      <span className={cn(
                        "font-black truncate px-0.5 w-full text-center leading-tight tracking-tighter",
                        isMobile ? "text-[9px]" : "text-[14px]"
                      )}>
                        {occupant ? occupant.name : ''}
                      </span>
                      
                      {isLateOrAbsent && (
                        <div className="absolute -top-1 -right-1 bg-rose-600 text-white p-0.5 rounded-full shadow-lg border border-white">
                          <div className="rounded-full bg-white w-1.5 h-1.5" />
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

      <footer className="flex flex-wrap gap-2 sm:gap-8 items-center justify-center p-4 sm:p-6 bg-white rounded-[2rem] border shadow-sm ring-1 ring-border/50">
        {[
          { label: '학습', color: 'bg-emerald-500' },
          { label: '미입실', color: 'bg-rose-500' },
          { label: '외출', color: 'bg-amber-500' },
          { label: '휴식', color: 'bg-blue-500' },
          { label: '빈자리', color: 'bg-white border-2 border-primary/10' }
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 bg-muted/20 px-3 py-1.5 rounded-xl border border-border/50 shadow-inner">
            <div className={cn("w-3 h-3 rounded-md shadow-sm", item.color)} />
            <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{item.label}</span>
          </div>
        ))}
      </footer>

      <Dialog open={isManaging} onOpenChange={setIsManaging}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md border-none shadow-2xl p-0 overflow-hidden">
          {selectedSeat && (
            <>
              <div className={cn(
                "p-8 text-white relative overflow-hidden",
                selectedSeat.status === 'studying' ? "bg-emerald-600" : 
                selectedSeat.studentId && selectedSeat.status === 'absent' ? "bg-rose-600" : 
                "bg-primary"
              )}>
                <DialogHeader className="relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge className="bg-white/20 text-white border-none font-black text-[10px] tracking-widest uppercase">Seat Control</Badge>
                    <span className="text-white/60 font-bold text-xs">{selectedSeat.seatNo}번 좌석</span>
                  </div>
                  <DialogTitle className="text-4xl font-black tracking-tighter">
                    {students?.find(s => s.id === selectedSeat.studentId)?.name || '공석'}
                  </DialogTitle>
                </DialogHeader>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={() => handleStatusUpdate('studying')} className="h-14 rounded-2xl font-black bg-emerald-500 hover:bg-emerald-600 shadow-lg text-sm gap-2">
                    <Clock className="h-4 w-4" /> 입실
                  </Button>
                  <Button onClick={() => handleStatusUpdate('away')} className="h-14 rounded-2xl font-black bg-amber-500 hover:bg-amber-600 shadow-lg text-sm gap-2">
                    <MapPin className="h-4 w-4" /> 외출
                  </Button>
                  <Button onClick={() => handleStatusUpdate('break')} className="h-14 rounded-2xl font-black bg-blue-500 hover:bg-blue-600 shadow-lg text-sm gap-2">
                    <Maximize2 className="h-4 w-4" /> 휴식
                  </Button>
                  <Button onClick={() => handleStatusUpdate('absent')} variant="outline" className="h-14 rounded-2xl font-black border-2 border-rose-200 text-rose-600 text-sm gap-2">
                    <AlertCircle className="h-4 w-4" /> 퇴실
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
