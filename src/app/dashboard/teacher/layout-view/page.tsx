
'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useDoc } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, doc, updateDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { type StudentProfile, type AttendanceCurrent, StudyLogDay, GrowthProgress, StudyPlanItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { 
  Armchair, 
  Loader2, 
  Monitor, 
  Users, 
  MapPin,
  Maximize2,
  RefreshCw,
  AlertCircle,
  Clock,
  ChevronRight,
  Settings2,
  Zap,
  Trophy,
  Activity,
  ClipboardCheck,
  Check,
  CheckCircle2,
  CircleDot,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  BarChart, 
  Bar
} from 'recharts';

const GRID_WIDTH = 20;
const GRID_HEIGHT = 10;

export default function LayoutViewPage() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const centerId = activeMembership?.id;
  const isMobile = viewMode === 'mobile';
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const [selectedSeat, setSelectedSeat] = useState<AttendanceCurrent | null>(null);
  const [isManaging, setIsManaging] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

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

  const handleStatusUpdate = async (status: AttendanceCurrent['status']) => {
    if (!firestore || !centerId || !selectedSeat) return;
    
    try {
      const seatRef = doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id);
      await updateDoc(seatRef, {
        status,
        updatedAt: serverTimestamp()
      });
      toast({ title: `좌석 ${selectedSeat.seatNo}번 상태가 ${status}로 변경되었습니다.` });
      setIsManaging(false);
    } catch (e) {
      toast({ variant: "destructive", title: "상태 변경 실패" });
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto pb-10 px-1 sm:px-4">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2 text-primary">
            <Monitor className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            실시간 관제 커맨드 센터
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
        <CardContent className="p-1 sm:p-10 bg-[#f8f9fa]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
              <Loader2 className="animate-spin h-12 w-12 text-primary opacity-20" />
              <p className="font-bold text-muted-foreground animate-pulse">실시간 관제 시스템 연결 중...</p>
            </div>
          ) : !attendanceList || attendanceList.length === 0 ? (
            <div className="py-40 text-center flex flex-col items-center gap-4">
              <Armchair className="h-20 w-20 text-muted-foreground opacity-10" />
              <p className="text-xl font-bold text-muted-foreground/40">배치된 좌석이 없습니다.</p>
            </div>
          ) : (
            <div className="w-full bg-white rounded-[2rem] border shadow-2xl p-1.5 sm:p-12 overflow-hidden">
              <div 
                className="grid gap-0.5 sm:gap-2 w-full mx-auto relative"
                style={{ 
                  gridTemplateColumns: `repeat(20, minmax(0, 1fr))`, 
                  backgroundImage: 'radial-gradient(circle, #00000008 1px, transparent 1px)',
                  backgroundSize: isMobile ? '12px 12px' : '20px 20px'
                }}
              >
                {Array.from({ length: GRID_HEIGHT * GRID_WIDTH }).map((_, idx) => {
                  const x = idx % GRID_WIDTH;
                  const y = Math.floor(idx / GRID_WIDTH);
                  const seat = attendanceList.find(a => a.gridX === x && a.gridY === y);
                  const occupant = students?.find(s => s.id === seat?.studentId);

                  if (!seat) return <div key={idx} className="aspect-square opacity-[0.01]" />;

                  const isLateOrAbsent = seat.studentId && seat.status === 'absent';

                  return (
                    <div 
                      key={seat.id} 
                      onClick={() => {
                        if (occupant) {
                          setSelectedStudentId(occupant.id);
                        }
                        setSelectedSeat(seat);
                        setIsManaging(true);
                      }}
                      className={cn(
                        "aspect-square rounded-md sm:rounded-2xl border flex flex-col items-center justify-center transition-all duration-500 relative cursor-pointer group shadow-sm",
                        seat.status === 'studying' ? "bg-emerald-500 border-emerald-600 text-white animate-pulse-soft z-10" : 
                        isLateOrAbsent ? "bg-rose-50 border-rose-500 text-rose-700" :
                        seat.status === 'away' ? "bg-amber-500 border-amber-600 text-white" :
                        seat.status === 'break' ? "bg-blue-500 border-blue-600 text-white" : 
                        occupant ? "bg-white border-primary text-primary" : "bg-white border-primary/10 text-muted-foreground/10 hover:border-primary/30"
                      )}
                    >
                      <span className={cn(
                        "font-black absolute top-0.5 left-0.5 opacity-40 leading-none",
                        isMobile ? "text-[5px]" : "text-[10px]"
                      )}>{seat.seatNo}</span>
                      
                      <span className={cn(
                        "font-black truncate px-0.5 w-full text-center mt-0.5 leading-none tracking-tighter",
                        isMobile ? "text-[7px]" : "text-[12px]"
                      )}>
                        {occupant ? occupant.name : ''}
                      </span>
                      
                      {isLateOrAbsent && (
                        <div className="absolute -top-0.5 -right-0.5 bg-rose-600 text-white p-0.5 rounded-full shadow-lg border border-white">
                          <div className={cn("rounded-full bg-white", isMobile ? "w-0.5 h-0.5" : "w-1 h-1")} />
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
          { label: '빈자리', color: 'bg-white border border-primary/10' }
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
                <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
                  <Armchair className="h-32 w-32" />
                </div>
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
              <DialogFooter className="p-6 bg-muted/10">
                <Button variant="ghost" onClick={() => setIsManaging(false)} className="w-full rounded-xl font-black">닫기</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
