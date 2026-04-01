'use client';

import { Sparkles } from 'lucide-react';

import type { StudyPlannerInsight } from '@/lib/types';

type InsightCardProps = {
  insights: StudyPlannerInsight[];
};

export function InsightCard({ insights }: InsightCardProps) {
  return (
    <div className="rounded-[1.7rem] border border-[#DCE6F5] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,249,255,0.96)_100%)] p-4 shadow-[0_18px_42px_-34px_rgba(20,41,95,0.18)]">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#FF8A1F]" />
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7C8FB5]">핵심 포인트</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-[#17326B]">핵심 인사이트</h3>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {insights.length > 0 ? (
          insights.map((insight, index) => (
            <div
              key={insight.id}
              className="rounded-[1.15rem] border border-[#E5ECF8] bg-white px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
            >
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#FF8A1F]">인사이트 {index + 1}</p>
              <p className="mt-2 break-keep text-[13px] font-semibold leading-6 text-[#17326B]">{insight.text}</p>
            </div>
          ))
        ) : (
          <div className="rounded-[1.15rem] border border-[#E5ECF8] bg-white px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <p className="text-[13px] font-semibold leading-6 text-[#4F658B]">
              이번 결과에서는 큰 경고 신호보다 현재 리듬을 안정적으로 이어가는 쪽이 더 중요해 보여요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
