
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useFunctions } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { 
  collection, 
  query, 
  where, 
  doc, 
  updateDoc, 
  serverTimestamp,
  getDocs,
  writeBatch,
  increment,
  Timestamp,
  getDoc
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
  X,
  Clock,
  Zap,
  CheckCircle2,
  ArrowLeft,
  Coffee,
  Undo2,
  QrCode,
  Scan,
  Camera,
  Keyboard
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { httpsCallable } from 'firebase/functions';
import { sendKakaoNotification } from '@/lib/kakao-service';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { syncAutoAttendanceRecord } from '@/lib/attendance-auto';
import { resolveSeatIdentity } from '@/lib/seat-layout';

export default function KioskPage() {
  const firestore = useFirestore();
  const functions = useFunctions();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();
  const router = useRouter();
  const centerId = activeMembership?.id;
  const canTriggerAttendanceSms =
    activeMembership?.role === 'teacher' ||
    activeMembership?.role === 'centerAdmin' ||
    activeMembership?.role === 'owner';

  const triggerAttendanceSms = async (
    studentId: string,
    eventType: 'check_in' | 'check_out'
  ) => {
    if (!functions || !centerId || !canTriggerAttendanceSms) return;

    try {
      const notifyAttendanceSmsFn = httpsCallable(functions, 'notifyAttendanceSms');
      await notifyAttendanceSmsFn({ centerId, studentId, eventType });
    } catch (error) {
      console.warn('[kiosk] notifyAttendanceSms failed', error);
    }
  };

  const [mode, setMode] = useState<'pin' | 'qr'>('pin');
  const [pin, setPin] = useState('');
  const [matchedStudents, setMatchedStudents] = useState<StudentProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const qrScannerRef = useRef<Html5Qrcode | null>(null);

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

  // QR 스캐너 초기화 및 정리
  useEffect(() => {
    if (mode === 'qr' && !showResults) {
      const html5QrCode = new Html5Qrcode("qr-reader");
      qrScannerRef.current = html5QrCode;

      html5QrCode.start(
        { facingMode: "user" }, // 프론트 카메라 (키오스크용)
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // QR 데이터 형식: ATTENDANCE_QR:centerId:studentId
          if (decodedText.startsWith('ATTENDANCE_QR:')) {
            const [_, cid, sid] = decodedText.split(':');
            if (cid === centerId) {
              handleQrScan(sid);
            } else {
              toast({ variant: "destructive", title: "인식 오류", description: "이 센터의 QR 코드가 아닙니다." });
            }
          }
        },
        (errorMessage) => {
          // 스캔 중 에러는 무시 (반복 호출됨)
        }
      ).catch(err => {
        console.error("QR Start Error", err);
      });

      return () => {
        if (qrScannerRef.current?.isScanning) {
          qrScannerRef.current.stop().then(() => {
            qrScannerRef.current?.clear();
          });
        }
      };
    }
  }, [mode, showResults, centerId]);

  const handleQrScan = async (studentId: string) => {
    if (!firestore || !centerId) return;
    
    // 스캐너 중지
    if (qrScannerRef.current?.isScanning) {
      await qrScannerRef.current.stop();
    }

    setIsSearching(true);
    try {
      const studentDoc = await getDoc(doc(firestore, 'centers', centerId, 'students', studentId));
      if (studentDoc.exists()) {
        const studentData = { id: studentDoc.id, ...studentDoc.data() } as StudentProfile;
        
        // 해당 학생의 현재 좌석 상태 확인
        const seat = resolveSeatForStudent(studentData);
        
        if (seat && (seat.status === 'absent' || !seat.status)) {
          // 미입실 상태면 즉시 자동 입실 처리 (있어보이는 원터치 경험)
          setMatchedStudents([studentData]);
          handleStatusUpdate(studentData, 'studying');
        } else {
          // 입실 중이면 옵션(외출/퇴실) 선택창 노출
          setMatchedStudents([studentData]);
          setShowResults(true);
        }
      } else {
        toast({ variant: "destructive", title: "학생 정보 없음" });
        setMode('pin');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
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
      const batch = writeBatch(firestore);
      const seatRef = doc(firestore, 'centers', centerId, 'attendanceCurrent', seat.id);
      const todayKey = format(new Date(), 'yyyy-MM-dd');
      let stopSessionId: string | null = null;

      // 퇴실(absent) 처리 시 공부 시간 저장 로직
      // away/break 상태에서 퇴실해도 lastCheckInAt 기준으로 시간을 기록한다 (T-2 버그 수정)
      if (nextStatus === 'absent' && (prevStatus === 'studying' || prevStatus === 'away' || prevStatus === 'break') && seat.lastCheckInAt) {
        const startTime = seat.lastCheckInAt.toMillis();
        const durationMinutes = Math.max(1, Math.floor((Date.now() - startTime) / 60000));

        if (durationMinutes > 0) {
          const logRef = doc(firestore, 'centers', centerId, 'studyLogs', student.id, 'days', todayKey);
          batch.set(logRef, {
            totalMinutes: increment(durationMinutes),
            studentId: student.id,
            centerId: centerId,
            dateKey: todayKey,
            updatedAt: serverTimestamp()
          }, { merge: true });

          stopSessionId = `session_${seat.lastCheckInAt.toMillis()}`;
          const sessionRef = doc(firestore, 'centers', centerId, 'studyLogs', student.id, 'days', todayKey, 'sessions', stopSessionId);
          batch.set(sessionRef, {
            startTime: seat.lastCheckInAt,
            endTime: serverTimestamp(),
            durationMinutes,
            sessionId: stopSessionId,
            createdAt: serverTimestamp()
          });

          // 성장 지표 반영 (임시 가중치)
          const progressRef = doc(firestore, 'centers', centerId, 'growthProgress', student.id);
          batch.set(progressRef, {
            seasonLp: increment(durationMinutes),
            'stats.focus': increment(0.1),
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      }

      const updateData: any = {
        seatNo: seat.seatNo,
        roomId: seat.roomId,
        roomSeatNo: seat.roomSeatNo,
        type: seat.type || 'seat',
        status: nextStatus,
        updatedAt: serverTimestamp()
      };

      if (nextStatus === 'studying') {
        updateData.lastCheckInAt = serverTimestamp();
      }

      batch.set(seatRef, updateData, { merge: true });
      await batch.commit();

      const autoCheckInAt =
        nextStatus === 'studying'
          ? new Date()
          : (seat.lastCheckInAt ? seat.lastCheckInAt.toDate() : null);
      void syncAutoAttendanceRecord({
        firestore,
        centerId,
        studentId: student.id,
        studentName: student.name,
        targetDate: new Date(),
        checkInAt: autoCheckInAt,
      }).catch((syncError: any) => {
        console.warn('[kiosk] auto attendance sync skipped', syncError?.message || syncError);
      });

      // 카카오톡 알림 발송
      const kakaoType: any = nextStatus === 'studying' ? 'entry' : nextStatus === 'away' ? 'away' : 'exit';
      sendKakaoNotification(firestore, centerId, {
        studentName: student.name,
        type: kakaoType
      });

      if (nextStatus === 'studying') {
        void triggerAttendanceSms(student.id, 'check_in');
      } else if (nextStatus === 'absent' && prevStatus !== 'absent') {
        void triggerAttendanceSms(student.id, 'check_out');
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
    setMode('qr'); // 기본 모드로 복구
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

      {!showResults && (
        <div className="fixed top-8 right-8 z-50 flex gap-2">
          <Button 
            variant={mode === 'qr' ? 'default' : 'outline'}
            onClick={() => { setMode('qr'); setPin(''); }}
            className="rounded-xl h-12 px-5 font-black gap-2 border-2"
          >
            <Scan className="h-4 w-4" /> QR 스캔
          </Button>
          <Button 
            variant={mode === 'pin' ? 'default' : 'outline'}
            onClick={() => { setMode('pin'); }}
            className="rounded-xl h-12 px-5 font-black gap-2 border-2"
          >
            <Keyboard className="h-4 w-4" /> PIN 입력
          </Button>
        </div>
      )}

      <header className="flex flex-col items-center text-center gap-2 mb-12 relative z-10">
        <div className="bg-primary p-5 rounded-[2.5rem] shadow-inner mb-4 animate-in zoom-in duration-700">
          <MonitorSmartphone className="h-12 w-12 text-white" />
        </div>
        <h1 className="text-5xl font-black tracking-tighter text-primary">스마트 출입 키오스크</h1>
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-[0.4em] opacity-40">Analytical Track Intelligence</p>
      </header>

      <div className="w-full max-w-3xl relative z-10">
        {!showResults ? (
          mode === 'qr' ? (
            <Card className="rounded-[4rem] border-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] bg-white overflow-hidden ring-1 ring-black/5 animate-in zoom-in duration-500">
              <CardHeader className="bg-muted/5 border-b p-12 text-center">
                <CardTitle className="text-3xl font-black tracking-tighter">QR 코드를 스캔하세요</CardTitle>
                <CardDescription className="font-bold pt-3 text-base">앱에서 '나의 출입 QR'을 열어 카메라에 보여주세요.</CardDescription>
              </CardHeader>
              <CardContent className="p-12 flex flex-col items-center">
                <div className="relative w-full max-w-md aspect-square rounded-[3rem] overflow-hidden border-8 border-primary/5 bg-black/5 flex items-center justify-center">
                  <div id="qr-reader" className="w-full h-full" />
                  <div className="absolute inset-0 border-2 border-primary/20 pointer-events-none rounded-[2.5rem]">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-primary/40 animate-pulse" />
                  </div>
                  {isSearching && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <p className="font-black text-primary">학생 정보를 확인 중...</p>
                    </div>
                  )}
                </div>
                <p className="mt-8 text-muted-foreground font-bold flex items-center gap-2">
                  <Camera className="h-4 w-4" /> 카메라 영역 중앙에 QR을 맞춰주세요.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-[4rem] border-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] bg-white overflow-hidden ring-1 ring-black/5 animate-in slide-in-from-bottom-8 duration-700">
              <CardHeader className="bg-muted/5 border-b p-12 text-center">
                <CardTitle className="text-3xl font-black tracking-tighter">핀번호를 입력하세요</CardTitle>
                <CardDescription className="font-bold pt-3 text-base">학부모 연동 코드 6자리를 입력해 주세요.</CardDescription>
              </CardHeader>
              <CardContent className="p-12 space-y-12">
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

                <div className="grid grid-cols-3 gap-5">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                    <Button 
                      key={num} 
                      variant="outline" 
                      onClick={() => handleNumberClick(num)}
                      className="h-24 rounded-3xl text-3xl font-black border-2 hover:bg-primary hover:text-white hover:border-primary transition-all active:scale-90 shadow-sm"
                    >
                      {num}
                    </Button>
                  ))}
                  <Button variant="ghost" onClick={resetKiosk} className="h-24 rounded-3xl text-xl font-black">초기화</Button>
                  <Button variant="outline" onClick={() => handleNumberClick('0')} className="h-24 rounded-3xl text-3xl font-black border-2 shadow-sm">0</Button>
                  <Button variant="ghost" onClick={handleDelete} className="h-24 rounded-3xl"><Delete className="h-10 w-10" /></Button>
                </div>
              </CardContent>
            </Card>
          )
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
          Smart QR Attendance System
        </div>
      </footer>
    </div>
  );
}
