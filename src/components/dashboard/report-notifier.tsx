'use client';

import { useEffect, useState } from 'react';
import { useAppContext } from '@/contexts/app-context';
import { useNotifications, ReportItem } from '@/contexts/notifications-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { FileText, Sparkles, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VisualReportViewer } from './visual-report-viewer';
import { Badge } from '@/components/ui/badge';

export function ReportNotifier() {
  const { viewMode } = useAppContext();
  const { latestReport, clearLatestReport } = useNotifications();
  const isMobile = viewMode === 'mobile';

  const [notification, setNotification] = useState<ReportItem | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!latestReport) return;
    setNotification(latestReport);
    setIsOpen(true);
    clearLatestReport();
  }, [latestReport, clearLatestReport]);

  const reportContent = typeof notification?.content === 'string' ? notification.content : '';
  const reportDateKey = notification?.dateKey || '새 리포트';

  if (!notification || !reportContent) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className={cn(
        "rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col transition-all duration-500",
        isMobile ? "fixed inset-0 w-full h-full max-w-none rounded-none" : "sm:max-w-2xl max-h-[90vh]"
      )}>
        <div className={cn("p-8 text-white relative shrink-0 bg-primary")}>
          <div className="absolute top-0 right-0 p-8 h-32 w-32 opacity-10 animate-pulse">
            <Sparkles className="h-full w-full" />
          </div>
          <DialogHeader className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-white/20 p-1.5 rounded-lg">
                <FileText className="h-4 w-4 text-white animate-bounce" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 whitespace-nowrap">AI 분석 도착</span>
            </div>
            <DialogTitle className="text-3xl font-black tracking-tighter">
              데일리 리포트가 도착했습니다
            </DialogTitle>
            <DialogDescription className="text-white/70 font-bold mt-1">
              학생 데이터를 바탕으로 생성된 리포트를 바로 확인할 수 있어요.
            </DialogDescription>
          </DialogHeader>
        </div>
        
        <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar p-6 sm:p-10">
          <div className="flex justify-center mb-6">
            <Badge variant="secondary" className="rounded-full px-4 py-1.5 bg-white border-2 border-primary/10 shadow-sm font-black text-primary gap-2">
              <Wand2 className="h-3.5 w-3.5" /> {reportDateKey} 분석 결과
            </Badge>
          </div>
          <VisualReportViewer
            content={reportContent}
            aiMeta={notification.aiMeta || null}
            dateKey={typeof notification.dateKey === 'string' ? notification.dateKey : undefined}
            studentName={typeof notification.studentName === 'string' ? notification.studentName : undefined}
          />
        </div>

        <DialogFooter className="p-6 bg-white border-t shrink-0">
          <Button onClick={() => setIsOpen(false)} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20">
            확인했습니다
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
