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
  User,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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

  const seatBounds = useMemo(() => {
    if (!attendanceList || attendanceList.length === 0) return null;
    let minX = GRID_WIDTH, maxX = 0, minY = GRID_HEIGHT, maxY = 0;
    attendanceList.forEach(s => {
      if (s.gridX !== undefined && s.gridY !== undefined) {
        minX = Math.min(minX, s.gridX); maxX = Math.max(maxX, s.gridX);
        minY = Math.min(minY, s.gridY); maxY = Math.max(maxY, s.gridY);
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
      await updateDoc(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id), { status, updatedAt: serverTimestamp() });
      toast({ title: "변경 완료" });
      setIsManaging(false);
    } catch (e) { toast({ variant: "destructive", title: "변경 실패" }); }
  };

  const stats = useMemo(() => {
    if (!attendanceList) return { studying: 0, absent: 0, away: 0, total: 0 };
    return {
      studying: attendanceList.filter(a => a.status === 'studying').length,
      absent: attendanceList.filter(a => a.studentId && a.status === 'absent').length,
      away: attendanceList.filter(a => ['away', 'break'].includes(a.status)).length,
      total: attendanceList.length
    };
  }, [attendanceList]);

  return (
    <div className={cn("flex flex-col w-full max-w-[1600px] mx-auto pb-24 min-h-screen transition-all", isMobile ? "gap-3 px-1 pt-1" : "gap-6 px-6 py-6")}>
      <header className={cn("flex justify-between items-center bg-white/80 backdrop-blur-xl border shadow-sm", isMobile ? "p-3 rounded-2xl" : "p-6 rounded-[2rem]")}>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Monitor className={cn("text-primary", isMobile ? "h-4 w-4" : "h-6 w-6")} />
            <h1 className={cn("font-black tracking-tighter text-primary", isMobile ? "text-base" : "text-2xl")}>실시간 관제</h1>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 font-black text-[8px] animate-pulse">LIVE</Badge>
          </div>
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{stats.studying}명 열공 중</span>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => window.location.reload()}><RefreshCw className="h-3.5 w-3.5 opacity-40" /></Button>
      </header>

      {/* 모바일에서 빈 공간을 채우는 현황 요약 카드 */}
      <div className={cn("grid gap-2", isMobile ? "grid-cols-2 px-1" : "hidden")}>
        {[
          { label: '학습 중', val: stats.studying, color: 'text-emerald-600', icon: Activity, bg: 'bg-emerald-50/50' },
          { label: '미입실', val: stats.absent, color: 'text-rose-600', icon: AlertCircle, bg: 'bg-rose-50/50' },
          { label: '외출/휴식', val: stats.away, color: 'text-amber-600', icon: Clock, bg: 'bg-amber-50/50' },
          { label: '배치 좌석', val: stats.total, color: 'text-primary', icon: Armchair, bg: 'bg-muted/30' }
        ].map((item, i) => (
          <Card key={i} className={cn("rounded-xl border-none shadow-sm p-3 flex flex-col gap-1", item.bg)}>
            <div className="flex justify-between items-center">
              <span className="text-[8px] font-black uppercase opacity-60">{item.label}</span>
              <item.icon className={cn("h-3 w-3", item.color)} />
            </div>
            <div className={cn("text-xl font-black tracking-tighter", item.color)}>{item.val}</div>
          </Card>
        ))}
      </div>

      <Card className="rounded-[2rem] border-none shadow-2xl overflow-hidden bg-white ring-1 ring-border/50 relative flex-1 flex flex-col">
        <CardContent className={cn("relative z-10 flex items-center justify-center flex-1", isMobile ? "p-0" : "p-6")}>
          {studentsLoading || attendanceLoading ? (
            <div className="flex flex-col items-center gap-2"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /><p className="font-black text-[8px] uppercase">Loading Map...</p></div>
          ) : !attendanceList?.length ? (
            <div className="text-center opacity-20"><Armchair className="h-12 w-12 mx-auto mb-2" /><p className="text-xs font-black">No Seats</p></div>
          ) : (
            <div className={cn("w-full bg-white relative", isMobile ? "p-1" : "p-8 rounded-2xl border shadow-2xl")}>
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 24px' }} />
              <div 
                className="grid w-full mx-auto relative z-10 gap-1"
                style={{ gridTemplateColumns: `repeat(${gridDimensions.cols}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: gridDimensions.rows * gridDimensions.cols }).map((_, idx) => {
                  const x = gridDimensions.startX + (idx % gridDimensions.cols);
                  const y = gridDimensions.startY + Math.floor(idx / gridDimensions.cols);
                  const seat = attendanceList.find(a => a.gridX === x && a.gridY === y);
                  const occupant = students?.find(s => s.id === seat?.studentId);
                  if (!seat) return <div key={idx} className="aspect-square opacity-0" />;

                  const isStudying = seat.status === 'studying';
                  const isAlert = seat.studentId && seat.status === 'absent';

                  return (
                    <div 
                      key={seat.id} 
                      onClick={() => { setSelectedSeat(seat); setIsManaging(true); }}
                      className={cn(
                        "aspect-square rounded-md border flex flex-col items-center justify-center transition-all relative cursor-pointer shadow-sm active:scale-90",
                        isStudying ? "bg-emerald-500 border-emerald-600 text-white shadow-lg shadow-emerald-500/20" : 
                        isAlert ? "bg-rose-50 border-rose-400 text-rose-700" :
                        seat.status === 'away' ? "bg-amber-500 border-amber-600 text-white shadow-lg shadow-amber-500/20" :
                        occupant ? "bg-white border-primary/20 text-primary hover:border-primary/50" : "bg-muted/5 border-transparent"
                      )}
                    >
                      {isMobile ? (
                        <span className={cn("font-black text-[10px] leading-none", isStudying || seat.status === 'away' ? "text-white" : "text-primary/40")}>{seat.seatNo}</span>
                      ) : (
                        <>
                          <span className={cn("font-black absolute top-0.5 left-0.5 leading-none text-[7px]", isStudying || seat.status === 'away' ? "opacity-60" : "opacity-30")}>{seat.seatNo}</span>
                          <span className={cn("font-black truncate w-full text-center leading-none tracking-tighter px-0.5 text-[12px]")}>{occupant?.name}</span>
                        </>
                      )}
                      {isStudying && <Activity className={cn("animate-pulse stroke-[3px] mt-0.5", isMobile ? "h-2 w-2" : "h-3 w-3")} />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="bg-white/60 backdrop-blur-xl rounded-2xl p-2 border shadow-sm flex flex-wrap gap-1.5 justify-center items-center">
        {[
          { label: '학습', color: 'bg-emerald-500' },
          { label: '부재', color: 'bg-rose-500' },
          { label: '외출', color: 'bg-amber-500' },
          { label: '빈자리', color: 'bg-muted/30 border border-muted' }
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1 bg-white/50 px-2 py-1 rounded-lg border border-white">
            <div className={cn("w-1.5 h-1.5 rounded-full", item.color)} />
            <span className="text-[8px] font-black text-foreground/60 uppercase">{item.label}</span>
          </div>
        ))}
      </section>

      <Dialog open={isManaging} onOpenChange={setIsManaging}>
        <DialogContent className={cn("border-none shadow-2xl p-0 overflow-hidden", isMobile ? "fixed bottom-0 top-auto translate-y-0 translate-x-0 left-0 right-0 max-w-none rounded-t-3xl rounded-b-none" : "rounded-3xl sm:max-w-md")}>
          {selectedSeat && (
            <>
              <div className={cn("p-8 text-white relative overflow-hidden", selectedSeat.status === 'studying' ? "bg-emerald-600" : "bg-primary")}>
                <div className="flex items-center gap-2 mb-2"><Badge className="bg-white/20 text-white">No.{selectedSeat.seatNo}</Badge></div>
                <DialogTitle className="text-4xl font-black tracking-tighter">{students?.find(s => s.id === selectedSeat.studentId)?.name || '공석'}</DialogTitle>
              </div>
              <div className="p-6 space-y-4 bg-white">
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={() => handleStatusUpdate('studying')} className="h-16 rounded-2xl font-black bg-emerald-500 gap-2"><Zap className="h-4 w-4 fill-current" /> 학습 시작</Button>
                  <Button onClick={() => handleStatusUpdate('away')} className="h-16 rounded-2xl font-black bg-amber-500 gap-2"><MapPin className="h-4 w-4" /> 외출 중</Button>
                  <Button onClick={() => handleStatusUpdate('break')} className="h-16 rounded-2xl font-black bg-blue-500 gap-2"><Maximize2 className="h-4 w-4" /> 휴식 중</Button>
                  <Button onClick={() => handleStatusUpdate('absent')} variant="outline" className="h-16 rounded-2xl font-black text-rose-600 gap-2"><AlertCircle className="h-4 w-4" /> 하원 처리</Button>
                </div>
                {selectedSeat.studentId && (
                  <Button variant="secondary" className="w-full h-14 rounded-2xl font-black gap-3" asChild>
                    <a href={`/dashboard/teacher/students/${selectedSeat.studentId}`}><User className="h-4 w-4 opacity-40" />상세 분석 리포트<ChevronRight className="ml-auto h-4 w-4 opacity-20" /></a>
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