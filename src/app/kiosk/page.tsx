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
  Loader2, 
  LogIn, 
  LogOut, 
  MonitorSmartphone, 
  Sparkles, 
  X,
  Clock,
  Zap,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

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

  // 실시간 좌석 현황 조회
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

  const canGoBack = activeMembership?.role === 'teacher' || activeMembership?.role === 'centerAdmin';

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      {/* Back to Dashboard Button - Only for Staff */}
      {canGoBack && (
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
        <div className="bg-primary/10 p-5 rounded-[2.5rem] shadow-inner mb-4 animate-in zoom-in duration-700">
          <MonitorSmartphone className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-5xl font-black tracking-tighter text-primary">출입 관리 키오스크</h1>
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-[0.4em] opacity-40">Analytical Track Engine Kiosk</p>
      </header>

      <div className="w-full max-w-lg relative z-10">
        {!showResults ? (
          <Card className="rounded-[4rem] border-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] bg-white overflow-hidden ring-1 ring-black/5 animate-in slide-in-from-bottom-8 duration-700">
            <CardHeader className="bg-muted/5 border-b p-12 text-center">
              <CardTitle className="text-3xl font-black tracking-tighter">핀번호를 입력하세요</CardTitle>
              <CardDescription className="font-bold pt-3 text-base">학부모 연동 코드 4자리를 입력해 주세요.</CardDescription>
            </CardHeader>
            <CardContent className="p-12 space-y-12">
              <div className="flex justify-center gap-5">
                {[...Array(4)].map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-16 h-20 rounded-3xl border-4 flex items-center justify-center text-4xl font-black transition-all duration-300",
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
                <Button 
                  variant="ghost" 
                  onClick={resetKiosk}
                  className="h-24 rounded-3xl text-xl font-black hover:bg-rose-50 hover:text-rose-600"
                >
                  초기화
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleNumberClick('0')}
                  className="h-24 rounded-3xl text-3xl font-black border-2 hover:bg-primary hover:text-white hover:border-primary transition-all active:scale-90 shadow-sm"
                >
                  0
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={handleDelete}
                  className="h-24 rounded-3xl hover:bg-muted/50"
                >
                  <Delete className="h-10 w-10" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-[4rem] border-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] bg-white overflow-hidden ring-1 ring-black/5 animate-in zoom-in-95 duration-500 max-w-2xl mx-auto">
            <div className="bg-primary p-12 text-white relative">
              <Sparkles className="absolute top-0 right-0 p-12 h-48 w-48 opacity-10 rotate-12" />
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <Badge className="bg-white/20 text-white border-none font-black text-xs tracking-widest uppercase mb-2">Student Match</Badge>
                  <CardTitle className="text-5xl font-black tracking-tighter">학생 확인</CardTitle>
                </div>
                <Button variant="ghost" onClick={resetKiosk} className="text-white hover:bg-white/10 rounded-full h-16 w-16 p-0">
                  <X className="h-10 w-10" />
                </Button>
              </div>
            </div>
            <CardContent className="p-12 space-y-8">
              {matchedStudents.map(student => {
                const seat = attendanceList?.find(a => a.studentId === student.id);
                const isStudying = seat?.status === 'studying';

                return (
                  <div key={student.id} className="p-10 rounded-[3rem] border-2 border-primary/10 bg-muted/5 flex flex-col sm:flex-row items-center justify-between gap-10 group hover:bg-white hover:border-primary/30 hover:shadow-2xl transition-all duration-500">
                    <div className="flex items-center gap-8">
                      <div className={cn(
                        "h-24 w-24 rounded-[2.5rem] flex items-center justify-center border-4 shadow-inner transition-all duration-700",
                        isStudying ? "bg-emerald-500 border-emerald-100 text-white scale-110 shadow-emerald-200" : "bg-white border-muted text-primary/20"
                      )}>
                        {isStudying ? <Zap className="h-12 w-12 fill-current animate-pulse" /> : <Clock className="h-12 w-12" />}
                      </div>
                      <div className="text-left">
                        <h3 className="text-4xl font-black tracking-tighter">{student.name}</h3>
                        <p className="font-bold text-lg text-muted-foreground mt-1">{student.schoolName} · {student.grade}</p>
                        <div className="flex items-center gap-3 mt-4">
                          <Badge variant="outline" className="rounded-xl font-black text-xs px-3 py-1 border-primary/20 text-primary bg-white shadow-sm">
                            {seat ? `${seat.seatNo}번 좌석` : '좌석 미배정'}
                          </Badge>
                          {isStudying && <Badge className="bg-emerald-500 font-black text-xs px-3 py-1 border-none shadow-lg shadow-emerald-100">현재 학습 중</Badge>}
                        </div>
                      </div>
                    </div>

                    <Button 
                      size="lg"
                      onClick={() => handleToggleStatus(student)}
                      className={cn(
                        "h-24 px-12 rounded-[2rem] font-black text-2xl gap-4 shadow-2xl transition-all active:scale-95",
                        isStudying ? "bg-rose-500 hover:bg-rose-600 shadow-rose-200" : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200"
                      )}
                    >
                      {isStudying ? (
                        <>하원 완료 <LogOut className="h-8 w-8" /></>
                      ) : (
                        <>학습 시작 <LogIn className="h-8 w-8" /></>
                      )}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
            <div className="p-10 bg-muted/20 border-t flex justify-center">
              <p className="text-sm font-bold text-muted-foreground/60 flex items-center gap-2 italic">
                <CheckCircle2 className="h-5 w-5" /> 핀번호가 일치하는 모든 자녀가 표시됩니다.
              </p>
            </div>
          </Card>
        )}
      </div>

      <footer className="mt-16 opacity-30">
        <div className="flex items-center gap-3 font-black text-xs uppercase tracking-[0.5em] text-primary">
          Analytical Track Kiosk System
        </div>
      </footer>
    </div>
  );
}
