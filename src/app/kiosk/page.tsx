
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { StudentProfile, AttendanceCurrent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { 
  Delete, 
  Loader2, 
  LogIn, 
  LogOut, 
  MonitorSmartphone, 
  Sparkles, 
  Clock,
  Zap,
  ArrowLeft,
  Coffee,
  Undo2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { syncAutoAttendanceRecord } from '@/lib/attendance-auto';
import { resolveSeatIdentity } from '@/lib/seat-layout';
import { setStudentAttendanceStatusSecure } from '@/lib/study-session-actions';

export default function KioskPage() {
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();
  const router = useRouter();
  const centerId = activeMembership?.id;

  const [pin, setPin] = useState('');
  const [matchedStudents, setMatchedStudents] = useState<StudentProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // 실시간 좌석 현황 조회
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList } = useCollection<AttendanceCurrent>(attendanceQuery);

  const resolveSeatForStudent = (student: StudentProfile) => {
    const liveSeat = attendanceList?.find((attendance) => attendance.studentId === student.id);
    if (liveSeat) return liveSeat;

    const identity = resolveSeatIdentity(student);
    if (!identity.seatId || identity.seatNo <= 0) return null;

    const fallbackSeat = attendanceList?.find((attendance) => attendance.id === identity.seatId);
    if (fallbackSeat) return fallbackSeat;

    return {
      id: identity.seatId,
      seatNo: identity.seatNo,
      roomId: identity.roomId,
      roomSeatNo: identity.roomSeatNo,
      status: 'absent',
      type: 'seat',
      updatedAt: Timestamp.now(),
    } as AttendanceCurrent;
  };

  const handleNumberClick = (num: string) => {
    if (pin.length < 6) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 6) {
        searchStudent(nextPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const searchStudent = async (code: string) => {
    if (!firestore || !centerId) return;
    setIsSearching(true);
    try {
      const q = query(
        collection(firestore, 'centers', centerId, 'students'),
        where('parentLinkCode', '==', code)
      );
      const snap = await getDocs(q);
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentProfile));
      
      if (results.length > 0) {
        setMatchedStudents(results);
        setShowResults(true);
      } else {
        toast({ 
          variant: "destructive", 
          title: "일치하는 정보 없음", 
          description: "핀번호를 다시 확인해 주세요." 
        });
        setPin('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleStatusUpdate = async (student: StudentProfile, nextStatus: AttendanceCurrent['status']) => {
    if (!firestore || !centerId || !attendanceList) return;
    
    const seat = resolveSeatForStudent(student);
    if (!seat) {
      toast({ 
        variant: "destructive", 
        title: "좌석 미배정", 
        description: "관리자에게 좌석 배정을 요청하세요." 
      });
      resetKiosk();
      return;
    }

    const prevStatus = seat.status;
    if (prevStatus === nextStatus) {
      toast({ title: "이미 해당 상태입니다." });
      resetKiosk();
      return;
    }

    setIsProcessing(true);
    try {
      const nowDate = new Date();
      await setStudentAttendanceStatusSecure({
        centerId,
        studentId: student.id,
        nextStatus,
        source: 'kiosk',
        seatId: seat.id,
        seatHint: {
          seatNo: seat.seatNo,
          roomId: seat.roomId || null,
          roomSeatNo: seat.roomSeatNo || null,
        },
      });

      if (nextStatus === 'studying') {
        void syncAutoAttendanceRecord({
          firestore,
          centerId,
          studentId: student.id,
          studentName: student.name,
          targetDate: nowDate,
          checkInAt: nowDate,
        }).catch((syncError: any) => {
          console.warn('[kiosk] auto attendance sync skipped', syncError?.message || syncError);
        });
      }

      const statusLabels: Record<AttendanceCurrent['status'], string> = {
        studying: '입실',
        away: '외출/휴식',
        break: '휴식',
        absent: '퇴실',
      };
      toast({ 
        title: `${statusLabels[nextStatus]} 확인 ✨`,
        description: `${student.name} 학생, 열공하세요!`
      });
      
      resetKiosk();
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "처리 실패" });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetKiosk = () => {
    setPin('');
    setMatchedStudents([]);
    setShowResults(false);
  };

  const getStatusInfo = (status?: string) => {
    switch (status) {
      case 'studying': return { label: '학습 중', color: 'bg-blue-500', icon: Zap };
      case 'away': return { label: '외출/휴식 중', color: 'bg-amber-500', icon: Coffee };
      case 'break': return { label: '휴식 중', color: 'bg-amber-500', icon: Coffee };
      default: return { label: '미입실 (퇴실 상태)', color: 'bg-slate-400', icon: Clock };
    }
  };

  const canGoBack = activeMembership?.role === 'teacher' || activeMembership?.role === 'centerAdmin';

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      {canGoBack && !showResults && (
        <div className="fixed top-8 left-8 z-50">
          <Button 
            variant="outline" 
            onClick={() => router.push('/dashboard')}
            className="rounded-2xl h-12 px-6 font-black gap-2 border-2 shadow-xl bg-white/80 backdrop-blur-md hover:bg-primary hover:text-white transition-all active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" /> 대시보드 돌아가기
          </Button>
        </div>
      )}

      <header className="flex flex-col items-center text-center gap-2 mb-12 relative z-10">
        <div className="bg-primary p-5 rounded-[2.5rem] shadow-inner mb-4 animate-in zoom-in duration-700">
          <MonitorSmartphone className="h-12 w-12 text-white" />
        </div>
        <h1 className="text-5xl font-black tracking-tighter text-primary">스마트 출입 키오스크</h1>
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-[0.4em] opacity-40">Number Pad Attendance Check-In</p>
      </header>

      <div className="w-full max-w-3xl relative z-10">
        {!showResults ? (
          <Card className="rounded-[4rem] border-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] bg-white overflow-hidden ring-1 ring-black/5 animate-in slide-in-from-bottom-8 duration-700">
            <CardHeader className="bg-muted/5 border-b p-12 text-center">
              <CardTitle className="text-3xl font-black tracking-tighter">번호 6자리를 입력하세요</CardTitle>
              <CardDescription className="font-bold pt-3 text-base">출입 확인용 번호를 누르면 학생 정보를 바로 찾습니다.</CardDescription>
            </CardHeader>
            <CardContent className="relative p-12 space-y-12">
              {isSearching && (
                <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="font-black text-primary">학생 정보를 확인 중...</p>
                </div>
              )}
              <div className="space-y-4">
                <div className="flex justify-center gap-4">
                  {[...Array(6)].map((_, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "w-14 h-18 rounded-3xl border-4 flex items-center justify-center text-3xl font-black transition-all duration-300",
                        pin.length > i ? "border-primary bg-primary text-white scale-110 shadow-2xl shadow-primary/20" : "border-muted bg-muted/20"
                      )}
                    >
                      {pin[i] ? '●' : ''}
                    </div>
                  ))}
                </div>
                <p className="text-center text-sm font-bold text-muted-foreground">
                  숫자를 누르면 자동으로 입력되고, 6자리가 채워지면 바로 조회합니다.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <Button 
                    key={num} 
                    variant="outline" 
                    onClick={() => handleNumberClick(num)}
                    disabled={isSearching}
                    className="h-24 rounded-3xl text-3xl font-black border-2 hover:bg-primary hover:text-white hover:border-primary transition-all active:scale-90 shadow-sm"
                  >
                    {num}
                  </Button>
                ))}
                <Button variant="ghost" onClick={resetKiosk} disabled={isSearching} className="h-24 rounded-3xl text-xl font-black">초기화</Button>
                <Button variant="outline" onClick={() => handleNumberClick('0')} disabled={isSearching} className="h-24 rounded-3xl text-3xl font-black border-2 shadow-sm">0</Button>
                <Button variant="ghost" onClick={handleDelete} disabled={isSearching} className="h-24 rounded-3xl"><Delete className="h-10 w-10" /></Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 w-full animate-in zoom-in-95 duration-500">
            {matchedStudents.map(student => {
              const seat = resolveSeatForStudent(student);
              const statusInfo = getStatusInfo(seat?.status);
              
              return (
                <Card key={student.id} className="rounded-[4rem] border-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] bg-white overflow-hidden ring-1 ring-black/5 relative group transition-all duration-500">
                  <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                    <Sparkles className="h-64 w-64 rotate-12" />
                  </div>
                  
                  <CardContent className="p-12 sm:p-16 flex flex-col items-center text-center gap-8">
                    <div className="space-y-4 w-full">
                      <div className="flex flex-col items-center gap-2">
                        <Badge className={cn("rounded-full font-black text-xs px-4 py-1 border-none shadow-lg mb-2 text-white", statusInfo.color)}>
                          현재 {statusInfo.label}
                        </Badge>
                        <h3 className="text-6xl font-black tracking-tighter text-primary">{student.name}</h3>
                        <p className="font-bold text-xl text-muted-foreground opacity-60">{student.schoolName} · {student.grade}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mt-4">
                      <Button 
                        disabled={isProcessing || seat?.status === 'studying'}
                        onClick={() => handleStatusUpdate(student, 'studying')}
                        className={cn(
                          "h-48 rounded-[2.5rem] font-black flex flex-col gap-4 shadow-xl transition-all active:scale-95",
                          seat?.status === 'studying' ? "bg-muted text-muted-foreground opacity-40" : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200"
                        )}
                      >
                        <LogIn className="h-12 w-12" />
                        <div className="grid">
                          <span className="text-2xl">입실</span>
                          <span className="text-[10px] opacity-60 uppercase tracking-widest">Start Study</span>
                        </div>
                      </Button>

                      <Button 
                        disabled={isProcessing || seat?.status === 'away' || seat?.status === 'absent'}
                        onClick={() => handleStatusUpdate(student, 'away')}
                        className={cn(
                          "h-48 rounded-[2.5rem] font-black flex flex-col gap-4 shadow-xl transition-all active:scale-95",
                          (seat?.status === 'away' || seat?.status === 'absent') ? "bg-muted text-muted-foreground opacity-40" : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200"
                        )}
                      >
                        <Coffee className="h-12 w-12" />
                        <div className="grid">
                          <span className="text-2xl">외출/휴식</span>
                          <span className="text-[10px] opacity-60 uppercase tracking-widest">Take a Break</span>
                        </div>
                      </Button>

                      <Button 
                        disabled={isProcessing || seat?.status === 'absent'}
                        onClick={() => handleStatusUpdate(student, 'absent')}
                        className={cn(
                          "h-48 rounded-[2.5rem] font-black flex flex-col gap-4 shadow-xl transition-all active:scale-95",
                          seat?.status === 'absent' ? "bg-muted text-muted-foreground opacity-40" : "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200"
                        )}
                      >
                        <LogOut className="h-12 w-12" />
                        <div className="grid">
                          <span className="text-2xl">퇴실</span>
                          <span className="text-[10px] opacity-60 uppercase tracking-widest">Check Out</span>
                        </div>
                      </Button>
                    </div>

                    {isProcessing && (
                      <div className="flex items-center gap-2 text-primary font-black animate-pulse mt-4">
                        <Loader2 className="h-5 w-5 animate-spin" /> 시스템 업데이트 중...
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            
            <Button 
              variant="ghost" 
              onClick={resetKiosk}
              className="mt-4 text-xl font-black text-muted-foreground/60 hover:text-primary transition-all gap-2"
            >
              <Undo2 className="h-6 w-6" /> 처음으로 돌아가기
            </Button>
          </div>
        )}
      </div>

      <footer className="mt-16 opacity-30">
        <div className="flex items-center gap-3 font-black text-xs uppercase tracking-[0.5em] text-primary">
          Smart Number Attendance System
        </div>
      </footer>
    </div>
  );
}
