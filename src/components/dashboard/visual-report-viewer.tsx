'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Clock, CheckCircle2, TrendingUp, MessageCircle, BrainCircuit, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function VisualReportViewer({ content }: { content: string }) {
  const sections = useMemo(() => {
    if (!content) return [];
    // 이모지 기준으로 섹션 분리
    const parts = content.split(/(?=🕒|✅|📊|💬|🧠)/g);
    return parts.map(p => p.trim()).filter(Boolean);
  }, [content]);

  const getSectionIcon = (text: string) => {
    if (text.includes('출결')) return <Clock className="h-5 w-5 text-blue-600" />;
    if (text.includes('계획 완수율')) return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
    if (text.includes('인공지능 분석') || text.includes('AI 분석')) return <TrendingUp className="h-5 w-5 text-purple-600" />;
    if (text.includes('코멘트')) return <MessageCircle className="h-5 w-5 text-amber-600" />;
    if (text.includes('인공지능 종합 피드백') || text.includes('AI 종합 피드백')) return <BrainCircuit className="h-5 w-5 text-rose-600" />;
    return <Sparkles className="h-5 w-5 text-primary" />;
  };

  const getSectionColor = (text: string) => {
    if (text.includes('출결')) return "bg-blue-50/50 border-blue-100";
    if (text.includes('계획 완수율')) return "bg-emerald-50/50 border-emerald-100";
    if (text.includes('인공지능 분석') || text.includes('AI 분석')) return "bg-purple-50/50 border-purple-100";
    if (text.includes('코멘트')) return "bg-amber-50/50 border-amber-100";
    if (text.includes('인공지능 종합 피드백') || text.includes('AI 종합 피드백')) return "bg-rose-50/50 border-rose-100";
    return "bg-muted/30 border-border";
  };

  if (!content) {
    return (
      <div className="py-20 text-center opacity-20 italic">
        <Sparkles className="h-12 w-12 mx-auto mb-4" />
        <p className="font-black">리포트 내용을 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-700">
      {sections.map((section, idx) => {
        const lines = section.split('\n');
        const title = lines[0];
        const body = lines.slice(1).join('\n');
        
        return (
          <Card key={idx} className={cn("rounded-[1.5rem] border shadow-sm overflow-hidden", getSectionColor(title))}>
            <CardHeader className="p-5 pb-2 border-b border-white/20">
              <div className="flex items-center gap-2">
                {getSectionIcon(title)}
                <span className="font-black text-sm tracking-tight">{title.replace(/^[^\s]+\s/, '')}</span>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <p className="text-sm font-bold text-foreground/80 leading-relaxed whitespace-pre-wrap break-keep">
                {body}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
