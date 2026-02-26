'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { StudyLogDay } from '@/lib/types';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  startOfWeek, 
  endOfWeek, 
  addMonths, 
  subMonths 
} from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function StudyHistoryPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  
  const [currentDate, setCurrentDate] = useState(new Date());

  // 학습 로그 데이터 페칭 (전체 기간 혹은 해당 월 최적화 가능)
  const studyLogsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days'),
      orderBy('dateKey', 'desc')
    );
  }, [firestore, user, activeMembership]);

  const { data: logs, isLoading } = useCollection<StudyLogDay>(studyLogsQuery);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const getHeatmapColor = (minutes: number) => {
    if (minutes === 0) return 'bg-white';
    if (minutes < 120) return 'bg-emerald-50 text-emerald-700';
    if (minutes < 240) return 'bg-emerald-100 text-emerald-800';
    if (minutes < 480) return 'bg-emerald-300 text-emerald-900';
    return 'bg-emerald-500 text-white';
  };

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const monthTotalMinutes = useMemo(() => {
    if (!logs) return 0;
    return logs
      .filter(log => isSameMonth(new Date(log.dateKey), currentDate))
      .reduce((acc, log) => acc + log.totalMinutes, 0);
  }, [logs, currentDate]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-headline font-bold">학습 기록</h1>
          <p className="text-muted-foreground">나의 월간 학습 몰입도를 히트맵으로 확인하세요.</p>
        </div>
        <div className="flex items-center gap-4 bg-card p-1 rounded-xl border shadow-sm">
           <Button variant="ghost" size="icon" onClick={prevMonth}>
             <ChevronLeft className="h-5 w-5" />
           </Button>
           <span className="font-bold text-lg min-w-[100px] text-center">
             {format(currentDate, 'yyyy년 M월')}
           </span>
           <Button variant="ghost" size="icon" onClick={nextMonth}>
             <ChevronRight className="h-5 w-5" />
           </Button>
        </div>
      </div>

      <Card className="border-none shadow-xl overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-4">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-6">
               <div className="flex items-center gap-2">
                 <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                 <span className="text-xs font-medium">10시간+</span>
               </div>
               <div className="flex items-center gap-2">
                 <div className="w-3 h-3 bg-emerald-300 rounded-sm" />
                 <span className="text-xs font-medium">4시간+</span>
               </div>
               <div className="flex items-center gap-2 text-muted-foreground/60">
                 <div className="w-3 h-3 bg-white border rounded-sm" />
                 <span className="text-xs font-medium">기록 없음</span>
               </div>
             </div>
             <div className="flex items-baseline gap-1">
               <span className="text-sm text-muted-foreground">이달의 총 학습 시간:</span>
               <span className="text-xl font-bold text-primary">{formatMinutes(monthTotalMinutes)}</span>
             </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b bg-muted/10">
            {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => (
              <div key={day} className={cn(
                "py-3 text-center text-xs font-bold uppercase tracking-wider",
                i === 5 ? "text-blue-500" : i === 6 ? "text-red-500" : "text-muted-foreground"
              )}>
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-fr">
            {isLoading ? (
              <div className="col-span-7 h-[500px] flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            ) : days.map((day, idx) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const log = logs?.find(l => l.dateKey === dateKey);
              const minutes = log?.totalMinutes || 0;
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div 
                  key={dateKey} 
                  className={cn(
                    "min-h-[100px] sm:min-h-[120px] p-2 border-r border-b relative group transition-colors",
                    !isCurrentMonth ? "bg-muted/20 opacity-30" : getHeatmapColor(minutes),
                    isToday && "ring-2 ring-inset ring-primary z-10"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <span className={cn(
                      "text-sm font-bold",
                      idx % 7 === 5 && isCurrentMonth ? "text-blue-600" : 
                      idx % 7 === 6 && isCurrentMonth ? "text-red-600" : ""
                    )}>
                      {format(day, 'd')}
                    </span>
                    {minutes >= 180 && (
                      <Zap className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                  
                  {minutes > 0 && (
                    <div className="mt-4 flex flex-col items-center justify-center">
                      <span className="text-lg sm:text-2xl font-mono font-extrabold tracking-tighter">
                        {formatMinutes(minutes)}
                      </span>
                    </div>
                  )}

                  {isToday && (
                    <div className="absolute bottom-1 right-2">
                       <span className="text-[10px] font-bold uppercase tracking-tighter bg-primary text-white px-1 rounded">Today</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-start gap-2 items-center px-4 py-2 bg-muted/30 rounded-lg text-[11px] text-muted-foreground">
         <InfoIcon className="h-3 w-3" />
         <span>히트맵의 색상은 학습 시간이 길어질수록 더 진하게 표시됩니다. 3시간 이상 학습한 날은 <Zap className="h-3 w-3 inline text-yellow-500" /> 아이콘이 표시됩니다.</span>
      </div>
    </div>
  );
}

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
