
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
  Users, 
  MapPin,
  Maximize2,
  RefreshCw,
  AlertCircle,
  Clock,
  ChevronRight,
  Settings2
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

const GRID_WIDTH = 20;
const GRID_HEIGHT = 10;

export default function LayoutViewPage() {
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();
  const centerId = activeMembership?.id;

  const [selectedSeat, setSelectedSeat] = useState<AttendanceCurrent | null>(null);
  const [isManaging, setIsManaging] = useState(false);

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
  const alertCount = attendanceList?.filter(a => a.studentId && a.status === 'absent').length ?? 0;

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
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto pb-10">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
            <Monitor className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            실시간 관제 커맨드 센터
          </h1>
          <p className="text-xs font-bold text-muted-foreground">센터 내 모든 좌석의 실시간 상태를 감시하고 즉각적으로 대응합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-xl font-bold h-10 gap-2 bg-white shadow-sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" /> 새로고침
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '현재 학습 중', val: studyingCount, color: 'text-emerald-600', icon: Users, bg: 'bg-emerald-50/50' },
          { label: '미입실/지각 의심', val: alertCount, color: 'text-rose-600', icon: AlertCircle, bg: 'bg-rose-50/50' },
          { label: '전체 좌석 점유', val: attendanceList?.filter(a => a.studentId).length || 0, color: 'text-primary', icon: Armchair, bg: 'bg-white' },
          { label: '실시간 가동률', val: `${attendanceList && attendanceList.length > 0 ? Math.round((studyingCount / attendanceList.length) * 100) : 0}%`, color: 'text-primary', icon: Monitor, bg: 'bg-white' }
        ].map((item, i) => (
          <Card key={i} className={cn("rounded-xl border-none shadow-lg overflow-hidden relative group", item.bg, i < 2 && "ring-1 ring-opacity-20", i === 0 && "ring-emerald-500", i === 1 && "ring-rose-500")}>
            <CardContent className="p-4 sm:p-5">
              <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">{item.label}</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className={cn("text-xl sm:text-2xl font-black", item.color)}>{item.val}</span>
                {typeof item.val === 'number' && <span className="text-[10px] font-bold opacity-40">명</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white ring-1 ring-border/50">
        <CardContent className="p-4 sm:p-10 bg-[#f8f9fa]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
              <Loader2 className="animate-spin h-12 w-12 text-primary" />
              <p className="font-bold text-muted-foreground">실시간 관제 시스템 연결 중...</p>
            </div>
          ) : !attendanceList || attendanceList.length === 0 ? (
            <div className="py-40 text-center flex flex-col items-center gap-4">
              <Armchair className="h-20 w-20 text-muted-foreground opacity-10" />
              <p className="text-xl font-bold text-muted-foreground/40">배치된 좌석이 없습니다.</p>
            </div>
          ) : (
            <div className="w-full overflow-auto custom-scrollbar bg-white rounded-[2rem] border shadow-2xl p-6 sm:p-12">
              <div 
                className="grid gap-2 sm:gap-3 mx-auto relative"
                style={{ 
                  gridTemplateColumns: `repeat(${GRID_WIDTH}, minmax(40px, 50px))`, 
                  width: 'fit-content',
                  backgroundImage: 'radial-gradient(circle, #00000008 1px, transparent 1px)',
                  backgroundSize: '20px 20px'
                }}
              >
                {Array.from({ length: GRID_HEIGHT * GRID_WIDTH }).map((_, idx) => {
                  const x = idx % GRID_WIDTH;
                  const y = Math.floor(idx / GRID_WIDTH);
                  const seat = attendanceList.find(a => a.gridX === x && a.gridY === y);
                  const occupant = students?.find(s => s.id === seat?.studentId);

                  if (!seat) return <div key={idx} className="w-[40px] h-[40px] sm:w-[50px] sm:h-[50px] opacity-[0.01]" />;

                  const isLateOrAbsent = seat.studentId && seat.status === 'absent';

                  return (
                    <div 
                      key={seat.id} 
                      onClick={() => {
                        setSelectedSeat(seat);
                        setIsManaging(true);
                      }}
                      className={cn(
                        "w-[40px] h-[40px] sm:w-[50px] sm:h-[50px] rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-500 relative cursor-pointer group border-solid",
                        seat.status === 'studying' ? "bg-emerald-500 border-emerald-600 text-white shadow-md scale-110 z-10 animate-pulse-soft" : 
                        isLateOrAbsent ? "bg-rose-50 border-rose-500 text-rose-700 shadow-inner" :
                        seat.status === 'away' ? "bg-amber-500 border-amber-600 text-white" :
                        seat.status === 'break' ? "bg-blue-500 border-blue-600 text-white" : 
                        occupant ? "bg-white border-primary/40 text-primary hover:border-primary" : "bg-white border-primary/10 text-muted-foreground/10 hover:border-primary/30"
                      )}
                    >
                      <span className={cn(
                        "text-[7px] sm:text-[9px] font-black absolute top-1 left-1.5",
                        seat.status === 'studying' || seat.status === 'away' || seat.status === 'break' ? "opacity-60" : "opacity-30"
                      )}>{seat.seatNo}</span>
                      
                      <span className={cn(
                        "text-[9px] sm:text-[11px] font-black truncate px-1 w-full text-center mt-1",
                        isLateOrAbsent ? "text-rose-600" : ""
                      )}>
                        {occupant ? occupant.name : ''}
                      </span>
                      
                      {isLateOrAbsent && (
                        <div className="absolute -top-1 -right-1 bg-rose-600 text-white p-0.5 rounded-full shadow-lg border border-white animate-bounce">
                          <AlertCircle className="h-2.5 w-2.5" />
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

      <footer className="flex flex-wrap gap-4 sm:gap-8 items-center justify-center p-6 bg-white rounded-[2rem] border shadow-sm ring-1 ring-border/50">
        {[
          { label: '집중 학습', color: 'bg-emerald-500', desc: '몰입 중' },
          { label: '미입실/지각', color: 'bg-rose-500', desc: '경고 상태' },
          { label: '외출 중', color: 'bg-amber-500', desc: '일시 이탈' },
          { label: '휴식 중', color: 'bg-blue-500', desc: '공식 휴식' },
          { label: '빈 좌석', color: 'bg-white border-2 border-primary/10', desc: '배정 가능' }
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-xl border border-border/50">
            <div className={cn("w-3.5 h-3.5 rounded-md shadow-sm", item.color)} />
            <div className="flex flex-col leading-none">
              <span className="text-[10px] font-black text-foreground">{item.label}</span>
              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter">{item.desc}</span>
            </div>
          </div>
        ))}
      </footer>

      <Dialog open={isManaging} onOpenChange={setIsManaging}>
        <DialogContent className="rounded-[2rem] sm:max-w-md border-none shadow-2xl p-0 overflow-hidden">
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
                  <DialogDescription className="text-white/70 font-bold text-lg">
                    현재 상태: <span className="text-white underline underline-offset-4">{
                      selectedSeat.status === 'studying' ? '학습 중' :
                      selectedSeat.status === 'away' ? '외출 중' :
                      selectedSeat.status === 'break' ? '휴식 중' : '미입실'
                    }</span>
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={() => handleStatusUpdate('studying')} className="h-14 rounded-2xl font-black bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-100 gap-2">
                    <Clock className="h-4 w-4" /> 입실/학습
                  </Button>
                  <Button onClick={() => handleStatusUpdate('away')} className="h-14 rounded-2xl font-black bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-100 gap-2">
                    <MapPin className="h-4 w-4" /> 외출 처리
                  </Button>
                  <Button onClick={() => handleStatusUpdate('break')} className="h-14 rounded-2xl font-black bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-100 gap-2">
                    <Maximize2 className="h-4 w-4" /> 휴식 처리
                  </Button>
                  <Button onClick={() => handleStatusUpdate('absent')} variant="outline" className="h-14 rounded-2xl font-black border-2 border-rose-200 text-rose-600 hover:bg-rose-50 gap-2">
                    <AlertCircle className="h-4 w-4" /> 퇴실 처리
                  </Button>
                </div>

                <div className="pt-4 border-t border-dashed">
                  <Button variant="ghost" className="w-full h-12 rounded-xl font-black text-primary hover:bg-primary/5 gap-2" asChild>
                    <a href={`/dashboard/teacher/students/${selectedSeat.studentId}`}>
                      학생 상세 정보 및 계획 보기 <ChevronRight className="h-4 w-4" />
                    </a>
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
