'use client';

import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  FileText,
  AlertCircle,
  XCircle
} from 'lucide-react';

/**
 * @fileOverview 모든 Firestore 쿼리를 제거한 정적 디버깅 페이지입니다.
 * 이 페이지에서도 보안 오류가 발생한다면 상위 레이아웃이나 다른 컴포넌트의 문제일 가능성이 높습니다.
 */
export default function AppointmentsPage() {
  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter">상담 및 피드백 (진단 모드)</h1>
          <p className="text-sm font-bold text-muted-foreground ml-1">현재 모든 데이터 조회를 중단하고 권한 오류를 테스트 중입니다.</p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden ring-1 ring-border/50">
            <CardHeader className="bg-muted/30 border-b p-6 sm:p-8">
              <CardTitle className="flex items-center gap-3 text-2xl font-black tracking-tight">
                <FileText className="h-6 w-6 text-primary" /> 상담 기록 조회 테스트
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="py-20 border-2 border-dashed rounded-3xl flex flex-col items-center gap-3 opacity-30">
                <XCircle className="h-10 w-10 text-muted-foreground" />
                <span className="text-xs font-black uppercase tracking-widest text-center">
                  진단을 위해 모든 데이터 쿼리가 비활성화되었습니다.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-8">
          <Card className="border-none shadow-lg rounded-[2rem] bg-accent/5 overflow-hidden">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="p-2 bg-accent/10 rounded-xl">
                <AlertCircle className="h-5 w-5 text-accent" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-accent-foreground">테스트 안내</h4>
                <p className="text-[11px] font-bold text-muted-foreground leading-relaxed">
                  이 화면에서도 여전히 "FirebaseError: Missing or insufficient permissions"가 뜬다면, 
                  페이지 자체가 아니라 사이드바나 알림 센터 등 공통 영역에서 상담 데이터를 읽으려 시도하고 있는 것입니다.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
