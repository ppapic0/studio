'use client';

import { useMemo, useState } from 'react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { DailyReport } from '@/lib/types';
import {
  Loader2,
  FileText,
  Sparkles,
  ChevronRight,
  Search,
  Calendar,
  History,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { VisualReportViewer } from '@/components/dashboard/visual-report-viewer';

function getReportPreviewText(content: string) {
  return content
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function StudentReportsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const isMobile = viewMode === 'mobile';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'dailyReports'),
      where('studentId', '==', user.uid),
      where('status', '==', 'sent'),
    );
  }, [firestore, activeMembership?.id, user?.uid]);

  const { data: rawReports, isLoading } = useCollection<DailyReport>(reportsQuery);

  const filteredReports = useMemo(() => {
    if (!rawReports) return [];
    const sorted = [...rawReports].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    const term = searchTerm.trim();
    if (!term) return sorted;
    return sorted.filter((item) => item.dateKey.includes(term));
  }, [rawReports, searchTerm]);

  const handleOpenReport = async (report: DailyReport) => {
    setSelectedReport(report);

    if (!report.viewedAt && firestore && activeMembership?.id && report.id && user) {
      const reportRef = doc(firestore, 'centers', activeMembership.id, 'dailyReports', report.id);
      updateDoc(reportRef, {
        viewedAt: serverTimestamp(),
        viewedByUid: user.uid,
        viewedByName: user.displayName || activeMembership.displayName || '학생',
      }).catch(() => {
        toast({
          variant: 'destructive',
          title: '읽음 표시 실패',
          description: '리포트는 열렸지만 읽음 상태를 저장하지 못했습니다.',
        });
      });
    }
  };

  return (
    <div className={cn('mx-auto flex w-full max-w-5xl flex-col pb-24', isMobile ? 'gap-4 px-1' : 'gap-10')}>
      <header className={cn('flex flex-col gap-2', isMobile ? 'px-2' : '')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary p-2.5 text-white shadow-lg">
              <FileText className="h-6 w-6" />
            </div>
            <div className="grid">
              <h1 className={cn('font-black tracking-tighter', isMobile ? 'text-2xl' : 'text-4xl')}>나의 학습 리포트</h1>
              <p className="ml-1 mt-0.5 text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">학습 리포트 아카이브</p>
            </div>
          </div>
          <Badge className={cn('rounded-full border-none bg-gradient-to-r font-black text-white shadow-lg from-[#14295F] via-[#1B326D] to-[#233E86]', isMobile ? 'hidden' : 'h-9 px-4 text-xs')}>
            <Sparkles className="mr-2 h-4 w-4" /> 학습 흐름 분석
          </Badge>
        </div>
      </header>

      <div className={cn('group relative', isMobile ? 'px-2' : '')}>
        <Search className="absolute left-6 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/40 transition-colors group-focus-within:text-primary" />
        <Input
          placeholder="날짜로 검색 (예: 2026-03)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={cn('rounded-[2rem] border-2 bg-white pl-14 shadow-sm transition-all focus-visible:ring-primary/10', isMobile ? 'h-14' : 'h-16 text-lg')}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-40">
          <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
          <p className="font-black italic uppercase tracking-widest text-muted-foreground/40">학습 흐름 분석 중...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="flex flex-col items-center gap-6 rounded-[3rem] border-2 border-dashed border-border/50 bg-white/50 py-32 text-center backdrop-blur-sm">
          <div className="rounded-full bg-muted/20 p-8">
            <History className="h-16 w-16 text-muted-foreground/10" />
          </div>
          <div className="grid gap-1">
            <p className="text-lg font-black text-muted-foreground/40">아직 받은 리포트가 없습니다.</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/20">선생님이 발송하면 리포트가 이곳에 쌓입니다.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredReports.map((report) => {
            const preview = getReportPreviewText(report.content).slice(0, 60);
            return (
              <Card
                key={report.id}
                onClick={() => handleOpenReport(report)}
                className={cn(
                  'cursor-pointer overflow-hidden border-none bg-white ring-1 ring-border/50 transition-all duration-300',
                  isMobile ? 'rounded-[1.75rem] shadow-md active:scale-[0.995]' : 'rounded-[2.5rem] shadow-lg hover:-translate-y-1 hover:shadow-2xl',
                )}
              >
                <CardContent className="p-0">
                  <div className={cn('flex items-center', isMobile ? 'gap-3 p-4' : 'gap-6 p-6 sm:p-10')}>
                    <div className={cn('flex shrink-0 items-center justify-center rounded-2xl border-2 border-primary/10 bg-primary/5', isMobile ? 'h-12 w-12' : 'h-16 w-16 rounded-[1.5rem]')}>
                      <Calendar className={cn('text-primary', isMobile ? 'h-5 w-5' : 'h-6 w-6')} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[10px] font-black uppercase tracking-widest leading-none text-primary/40 sm:text-xs">{report.dateKey}</span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'h-4 shrink-0 border-none px-1.5 text-[8px] font-black',
                            report.viewedAt ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600',
                          )}
                        >
                          {report.viewedAt ? '읽음' : '신규'}
                        </Badge>
                      </div>

                      <h3 className="truncate text-base font-black tracking-tighter text-primary sm:text-xl">학습 리포트</h3>
                      <p className="line-clamp-1 text-[10px] font-bold text-muted-foreground/60 sm:text-[11px]">
                        {preview || '리포트 내용을 확인해보세요.'}
                      </p>
                    </div>

                    {isMobile ? (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                        <ChevronRight className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent
          className={cn(
            'flex flex-col overflow-hidden border-none p-0 shadow-2xl transition-all duration-500',
            isMobile
              ? 'fixed left-1/2 top-1/2 h-[85vh] w-[95vw] max-w-[450px] -translate-x-1/2 -translate-y-1/2 rounded-[2.5rem]'
              : 'max-h-[90vh] max-w-3xl rounded-[3rem]',
          )}
        >
          {selectedReport && (
            <>
              <div className={cn('relative shrink-0 overflow-hidden bg-primary text-white', isMobile ? 'p-8' : 'p-12')}>
                <div className="absolute right-0 top-0 rotate-12 p-8 opacity-10 sm:p-12">
                  <Sparkles className={cn(isMobile ? 'h-32 w-32' : 'h-48 w-48')} />
                </div>
                <DialogHeader className="relative z-10 text-left">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge className="border-none bg-white/20 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-white">학습 리포트</Badge>
                    <span className="text-[10px] font-black tracking-widest text-white/60">{selectedReport.dateKey}</span>
                  </div>
                  <DialogTitle className={cn('font-black tracking-tighter', isMobile ? 'text-3xl' : 'text-5xl')}>학습 리포트</DialogTitle>
                  <DialogDescription className="mt-1 text-xs font-bold text-white/70 sm:text-sm">
                    학부모가 보는 것과 같은 형식으로 오늘의 학습 흐름과 코칭을 확인할 수 있어요.
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="custom-scrollbar flex-1 overflow-y-auto bg-[#fafafa] p-6 sm:p-12">
                <VisualReportViewer
                  content={selectedReport.content}
                  aiMeta={selectedReport.aiMeta}
                  dateKey={selectedReport.dateKey}
                  studentName={selectedReport.studentName}
                />
              </div>

              <DialogFooter className="shrink-0 justify-center border-t bg-white p-6 sm:p-8">
                <DialogClose asChild>
                  <Button className="h-14 w-full rounded-2xl text-lg font-black gap-2">닫기 <X className="h-4 w-4" /></Button>
                </DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
