'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { DailyReport } from '@/lib/types';
import { format } from 'date-fns';
import { 
  Loader2, 
  FileText, 
  Sparkles, 
  ChevronRight, 
  Search, 
  Calendar,
  Zap,
  Wand2,
  TrendingUp,
  History
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { VisualReportViewer } from '@/components/dashboard/visual-report-viewer';

export default function StudentReportsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, viewMode, currentTier } = useAppContext();
  const isMobile = viewMode === 'mobile';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'dailyReports'),
      where('studentId', '==', user.uid),
      where('status', '==', 'sent')
    );
  }, [firestore, activeMembership, user]);

  const { data: rawReports, isLoading } = useCollection<DailyReport>(reportsQuery);

  const filteredReports = useMemo(() => {
    if (!rawReports) return [];
    
    // 클라이언트 측 정렬 (최신순)
    const sorted = [...rawReports].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    
    // 검색어 필터링
    return sorted.filter(r => r.dateKey.includes(searchTerm));
  }, [rawReports, searchTerm]);

  const handleOpenReport = async (report: DailyReport) => {
    setSelectedReport(report);
    
    // 처음 열람하는 경우 viewedAt 업데이트
    if (!report.viewedAt && firestore && activeMembership) {
      const reportId = `${report.dateKey}_${report.studentId}`;
      const reportRef = doc(firestore, 'centers', activeMembership.id, 'dailyReports', reportId);
      
      updateDoc(reportRef, {
        viewedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch(err => console.error("Error updating report viewed state:", err));
    }
  };

  return (
    <div className={cn("flex flex-col gap-6 w-full max-w-5xl mx-auto pb-24", isMobile ? "gap-4 px-1" : "gap-10")}>
      <header className={cn("flex flex-col gap-2", isMobile ? "px-2" : "")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2.5 rounded-2xl shadow-lg text-white">
              <FileText className="h-6 w-6" />
            </div>
            <div className="grid">
              <h1 className={cn("font-black tracking-tighter", isMobile ? "text-2xl" : "text-4xl")}>나의 분석 리포트</h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] mt-0.5 ml-1">Learning Intelligence Archive</p>
            </div>
          </div>
          <Badge className={cn("rounded-full font-black border-none text-white shadow-lg bg-gradient-to-r", isMobile ? "hidden" : "h-9 px-4 text-xs", currentTier.gradient)}>
            <Sparkles className="h-4 w-4 mr-2" /> {currentTier.name} Tier Analysis
          </Badge>
        </div>
      </header>

      <div className={cn("relative group", isMobile ? "px-2" : "")}>
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="날짜로 검색 (예: 2025-03)..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={cn("rounded-[2rem] border-2 pl-14 focus-visible:ring-primary/10 shadow-sm transition-all bg-white", isMobile ? "h-14" : "h-16 text-lg")}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
          <p className="font-black text-muted-foreground/40 uppercase tracking-widest italic">Decoding Study Patterns...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="py-32 text-center bg-white/50 backdrop-blur-sm rounded-[3rem] border-2 border-dashed border-border/50 flex flex-col items-center gap-6">
          <div className="p-8 rounded-full bg-muted/20">
            <History className="h-16 w-16 text-muted-foreground/10" />
          </div>
          <div className="grid gap-1">
            <p className="font-black text-muted-foreground/40 text-lg">아직 받은 리포트가 없습니다.</p>
            <p className="text-[10px] font-bold text-muted-foreground/20 uppercase tracking-widest">Reports arrive after teacher verification</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredReports.map((report) => (
            <Card 
              key={report.id} 
              onClick={() => handleOpenReport(report)}
              className="rounded-[2.5rem] border-none shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 cursor-pointer group bg-white ring-1 ring-border/50 overflow-hidden"
            >
              <CardContent className="p-0">
                <div className={cn("flex items-center justify-between p-6 sm:p-10", isMobile ? "p-5" : "")}>
                  <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                    <div className={cn("h-12 w-12 sm:h-16 sm:w-16 rounded-2xl sm:rounded-[1.5rem] bg-primary/5 flex flex-col items-center justify-center shrink-0 border-2 border-primary/10 group-hover:bg-primary group-hover:border-primary transition-all duration-500 shadow-inner")}>
                      <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-primary group-hover:text-white" />
                    </div>
                    <div className="grid gap-0.5 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base sm:text-xl font-black tracking-tighter text-primary truncate whitespace-nowrap">{report.dateKey} 리포트</h3>
                        <Badge variant="secondary" className={cn(
                          "border-none font-black text-[8px] px-1.5 h-4 flex-shrink-0",
                          report.viewedAt ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                        )}>
                          {report.viewedAt ? '읽음' : 'NEW'}
                        </Badge>
                      </div>
                      <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground/60 truncate whitespace-nowrap max-w-full">
                        {report.content.replace(/[🕒✅📊💬🧠]/g, '').trim().substring(0, 50)}...
                      </p>
                    </div>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-primary/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all shadow-sm shrink-0 ml-2">
                    <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 리포트 상세 다이얼로그 */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className={cn(
          "rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col transition-all duration-500", 
          isMobile 
            ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] h-[85vh] max-w-[450px] rounded-[2.5rem]" 
            : "max-w-3xl max-h-[90vh]"
        )}>
          {selectedReport && (
            <>
              <div className={cn("bg-primary text-white relative overflow-hidden shrink-0", isMobile ? "p-8" : "p-12")}>
                <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-10 rotate-12">
                  <Sparkles className={cn(isMobile ? "h-32 w-32" : "h-48 w-48")} />
                </div>
                <DialogHeader className="relative z-10 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-white/20 text-white border-none font-black text-[9px] tracking-[0.2em] uppercase px-3 py-1">Premium AI Analysis</Badge>
                    <span className="text-white/60 font-black text-[10px] tracking-widest">{selectedReport.dateKey}</span>
                  </div>
                  <DialogTitle className={cn("font-black tracking-tighter", isMobile ? "text-3xl" : "text-5xl")}>정밀 분석 리포트</DialogTitle>
                  <DialogDescription className="text-white/70 font-bold mt-1 text-xs sm:text-sm">성장 데이터를 바탕으로 AI와 선생님의 정밀 리포트가 합쳐진 최적의 솔루션입니다.</DialogDescription>
                </DialogHeader>
              </div>

              <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar p-6 sm:p-12">
                <VisualReportViewer content={selectedReport.content} />
              </div>

              <DialogFooter className="p-6 sm:p-8 bg-white border-t shrink-0 flex justify-center">
                <DialogClose asChild>
                  <Button className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 active:scale-95 transition-all">분석 완료</Button>
                </DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
