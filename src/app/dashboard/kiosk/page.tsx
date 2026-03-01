'use client';

import { useState, useEffect, useMemo } from 'react';
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
  doc, 
  updateDoc, 
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { StudentProfile, AttendanceCurrent } from '@/lib/types';
import { cn } from '@/lib/utils';
import { 
  Delete, 
  DeleteIcon, 
  Fingerprint, 
  Keypad, 
  Loader2, 
  LogIn, 
  LogOut, 
  MonitorSmartphone, 
  Sparkles, 
  UserCheck, 
  X,
  Clock,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function KioskPage() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;

  const [pin, setPin] = useState('');
  const [matchedStudents, setMatchedStudents] = useState<StudentProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // 실시간 좌석 현황 조회 (학생들의 현재 상태 확인용)
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList } = useCollection<AttendanceCurrent>(attendanceQuery);

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
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

  const handleToggleStatus = async (student: StudentProfile) => {
    if (!firestore || !centerId || !attendanceList) return;
    
    // 해당 학생의 좌석 문서를 찾음
    const seat = attendanceList.find(a => a.studentId === student.id);
    if (!seat) {
      toast({ 
        variant: "destructive", 
        title: "좌석 미배정", 
        description: "관리자에게 좌석 배정을 요청하세요." 
      });
      return;
    }

    const nextStatus = seat.status === 'studying' ? 'absent' : 'studying';
    
    try {
      await updateDoc(doc(firestore, 'centers', centerId, 'attendanceCurrent', seat.id), {
        status: nextStatus,
        updatedAt: serverTimestamp()
      });

      toast({ 
        title: nextStatus === 'studying' ? "입실 확인" : "퇴실 확인",
        description: `${student.name} 학생의 상태가 변경되었습니다.`
      });
      
      resetKiosk();
    } catch (e) {
      toast({ variant: "destructive", title: "처리 실패" });
    }
  };

  const resetKiosk = () => {
    setPin('');
    setMatchedStudents([]);
    setShowResults(false);
  };

  return (
    <div className={cn("flex flex-col gap-8 max-w-4xl mx-auto pb-20", isMobile ? "px-1 pt-4" : "px-4 pt-10")}>
      <header className="flex flex-col items-center text-center gap-2">
        <div className="bg-primary/10 p-4 rounded-[2rem] shadow-inner mb-2">
          <MonitorSmartphone className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-4xl font-black tracking-tighter text-primary">출입 관리 키오스크</h1>
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-[0.3em] opacity-60">Dongbaek Center Kiosk System</p>
      </header>

      {!showResults ? (
        <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-border/50 max-w-md mx-auto w-full">
          <CardHeader className="bg-muted/5 border-b p-10 text-center">
            <CardTitle className="text-2xl font-black tracking-tighter">핀번호를 입력하세요</CardTitle>
            <CardDescription className="font-bold pt-2">학부모 연동 코드 4자리를 입력해 주세요.</CardDescription>
          </CardHeader>
          <CardContent className="p-10 space-y-10">
            <div className="flex justify-center gap-4">
              {[...Array(4)].map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-14 h-16 rounded-2xl border-4 flex items-center justify-center text-3xl font-black transition-all duration-300",
                    pin.length > i ? "border-primary bg-primary text-white scale-110 shadow-lg" : "border-muted bg-muted/20"
                  )}
                >
                  {pin[i] ? '*' : ''}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <Button 
                  key={num} 
                  variant="outline" 
                  onClick={() => handleNumberClick(num)}
                  className="h-20 rounded-2xl text-2xl font-black border-2 hover:bg-primary hover:text-white transition-all active:scale-90"
                >
                  {num}
                </Button>
              ))}
              <Button 
                variant="ghost" 
                onClick={resetKiosk}
                className="h-20 rounded-2xl text-lg font-black hover:bg-rose-50 hover:text-rose-600"
              >
                초기화
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleNumberClick('0')}
                className="h-20 rounded-2xl text-2xl font-black border-2 hover:bg-primary hover:text-white transition-all active:scale-90"
              >
                0
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleDelete}
                className="h-20 rounded-2xl hover:bg-muted/50"
              >
                <Delete className="h-8 w-8" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-border/50 animate-in zoom-in duration-500 max-w-2xl mx-auto w-full">
          <div className="bg-primary p-10 text-white relative">
            <Sparkles className="absolute top-0 right-0 p-10 h-40 w-40 opacity-10 rotate-12" />
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <Badge className="bg-white/20 text-white border-none font-black text-[10px] tracking-widest uppercase mb-2">Student Match Found</Badge>
                <CardTitle className="text-4xl font-black tracking-tighter">학생 확인</CardTitle>
              </div>
              <Button variant="ghost" onClick={resetKiosk} className="text-white hover:bg-white/10 rounded-full h-12 w-12 p-0">
                <X className="h-8 w-8" />
              </Button>
            </div>
          </div>
          <CardContent className="p-10 space-y-6">
            {matchedStudents.map(student => {
              const seat = attendanceList?.find(a => a.studentId === student.id);
              const isStudying = seat?.status === 'studying';

              return (
                <div key={student.id} className="p-8 rounded-[2.5rem] border-2 border-primary/10 bg-muted/5 flex flex-col sm:flex-row items-center justify-between gap-8 group hover:bg-white hover:border-primary/30 hover:shadow-xl transition-all duration-500">
                  <div className="flex items-center gap-6">
                    <div className={cn(
                      "h-20 w-20 rounded-[2rem] flex items-center justify-center border-4 shadow-inner transition-colors duration-500",
                      isStudying ? "bg-emerald-500 border-emerald-100 text-white" : "bg-white border-muted text-primary/20"
                    )}>
                      {isStudying ? <Zap className="h-10 w-10 fill-current animate-pulse" /> : <Clock className="h-10 w-10" />}
                    </div>
                    <div className="text-left">
                      <h3 className="text-3xl font-black tracking-tighter">{student.name}</h3>
                      <p className="font-bold text-muted-foreground">{student.schoolName} · {student.grade}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="rounded-lg font-black text-[10px] px-2 py-0.5 border-primary/20 text-primary">
                          {seat ? `${seat.seatNo}번 좌석` : '좌석 미배정'}
                        </Badge>
                        {isStudying && <Badge className="bg-emerald-500 font-black text-[10px] px-2 py-0.5 border-none">현재 학습 중</Badge>}
                      </div>
                    </div>
                  </div>

                  <Button 
                    size="lg"
                    onClick={() => handleToggleStatus(student)}
                    className={cn(
                      "h-20 px-10 rounded-[1.75rem] font-black text-xl gap-3 shadow-xl transition-all active:scale-95",
                      isStudying ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-500 hover:bg-emerald-600"
                    )}
                  >
                    {isStudying ? (
                      <>하원 완료 <LogOut className="h-6 w-6" /></>
                    ) : (
                      <>학습 시작 <LogIn className="h-6 w-6" /></>
                    )}
                  </Button>
                </div>
              );
            })}
          </CardContent>
          <div className="p-10 bg-muted/20 border-t flex justify-center">
            <p className="text-xs font-bold text-muted-foreground/60 flex items-center gap-2 italic">
              <CheckCircle2 className="h-4 w-4" /> 핀번호가 일치하는 모든 자녀가 표시됩니다.
            </p>
          </div>
        </Card>
      )}

      <footer className="flex flex-col items-center gap-4 pt-10 opacity-30">
        <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-[0.4em]">
          Analytical Track Engine
        </div>
      </footer>
    </div>
  );
}
