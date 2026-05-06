'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Bar, BarChart, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useSearchParams } from 'next/navigation';

import { StudentHomeGamePanel, type StudentHomeRankState, type StudentHomeRewardBox } from '@/components/dashboard/student-home-game-panel';
import { PlanItemCard } from '@/components/dashboard/student-planner/plan-item-card';
import { ScheduleItemCard } from '@/components/dashboard/student-planner/schedule-item-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { buildStudyBoxRewardReveal } from '@/lib/student-rewards';

const mockTrend = [
  { date: '03/25', minutes: 180 },
  { date: '03/26', minutes: 225 },
  { date: '03/27', minutes: 150 },
  { date: '03/28', minutes: 290 },
  { date: '03/29', minutes: 340 },
  { date: '03/30', minutes: 305 },
  { date: '03/31', minutes: 410 },
];

const mockChartData = [
  { date: '월', focus: 78, reward: 120 },
  { date: '화', focus: 84, reward: 160 },
  { date: '수', focus: 72, reward: 132 },
  { date: '목', focus: 88, reward: 196 },
  { date: '금', focus: 94, reward: 240 },
  { date: '토', focus: 81, reward: 188 },
  { date: '일', focus: 97, reward: 264 },
];

const mockBoxes: StudentHomeRewardBox[] = [
  { id: 'box-1', hour: 1, state: 'opened', rarity: 'common', reward: 12 },
  { id: 'box-2', hour: 2, state: 'ready', rarity: 'rare', reward: 28 },
  { id: 'box-3', hour: 3, state: 'charging', rarity: 'rare' },
  { id: 'box-4', hour: 4, state: 'locked', rarity: 'epic' },
];

const mockRank: StudentHomeRankState = {
  title: '이번 주 랭킹',
  rank: 4,
  minutes: 1380,
  badge: 'TOP 5',
  caption: '이번 주 누적 집중 23시간',
  preview: [
    { rank: 1, studentId: 'mock-1', name: '민서', schoolName: '청담고', minutes: 1820, baseMinutes: 1820, displaySeconds: 109215, isLive: true },
    { rank: 2, studentId: 'mock-2', name: '수현', schoolName: '대진여고', minutes: 1705, baseMinutes: 1705, displaySeconds: 102300, isLive: false },
    { rank: 3, studentId: 'mock-3', name: '서준', schoolName: '중앙고', minutes: 1490, baseMinutes: 1490, displaySeconds: 89400, isLive: false },
  ],
  isLoading: false,
  isLive: true,
  liveBadge: 'LIVE 0:15',
};

export default function UiAuditPage() {
  const searchParams = useSearchParams();
  const [vaultOpen, setVaultOpen] = useState(searchParams.get('surface') === 'vault');
  const [modalOpen, setModalOpen] = useState(searchParams.get('surface') === 'dialog');
  const [sheetOpen, setSheetOpen] = useState(searchParams.get('surface') === 'sheet');

  const chartConfig = useMemo(
    () => ({
      focus: { label: '집중도', color: 'var(--chart-1)' },
      reward: { label: '포인트', color: 'var(--chart-2)' },
    }),
    []
  );

  const renderTooltip = (active?: boolean, payload?: Array<{ name: string; value: number; color?: string }>, label?: string) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-2xl border border-[var(--chart-tooltip-border)] bg-[var(--chart-tooltip-bg)] px-3 py-2 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--chart-axis)]">{label}</p>
        <div className="mt-2 space-y-1.5">
          {payload.map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-3 text-sm font-black text-white">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}
              </span>
              <span>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] px-4 py-8 text-[var(--text-primary)] sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-8">
        <section className="surface-card surface-card--light px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge variant="secondary">UI Audit</Badge>
              <h1 className="text-balance text-3xl font-black tracking-tight text-[var(--text-primary)]">학생용 다크 대시보드 가독성 점검</h1>
              <p className="max-w-3xl text-sm font-semibold text-[var(--text-secondary)]">
                학생 홈, 플래너 카드, 차트, 모달, 시트의 실제 렌더를 한 페이지에서 확인하는 감사용 화면입니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setVaultOpen((prev) => !prev)}>보관함 토글</Button>
              <Button variant="secondary" onClick={() => setModalOpen(true)}>모달 보기</Button>
              <Button variant="dark" onClick={() => setSheetOpen(true)}>시트 보기</Button>
            </div>
          </div>
        </section>

        <StudentHomeGamePanel
          isMobile={false}
        dateLabel="3월 31일 화요일"
        heroMessage="루틴, 퀘스트, 보상 흐름이 한눈에 읽히는지 확인합니다."
        totalMinutesLabel="12시간 10분"
        growthLabel="12h / 10h"
        growthPercent={100}
        growthDeltaPercent={14}
          growthDeltaLabel="어제 대비 +14%"
          primaryActionLabel="공부 종료하기"
          onPrimaryAction={() => undefined}
          primaryActionActive
          sessionTimerLabel="1:24:18"
          totalAvailableBoxes={2}
          boxStatusLabel="BOX READY"
          boxSubLabel="상자 2개가 도착했어요"
          onOpenMainBox={() => setVaultOpen(true)}
          nextBoxCounter="2개 대기"
          nextBoxCaption="보관함에서 한 개씩 열어보세요"
          isNearNextBox
          arrivalCount={2}
          todayStudyLabel="12시간 10분"
          todayOpenedBoxCount={3}
          homeWelcomeTargetLabel="경희대학교 국어국문학과"
          homeStudentName="김재윤"
          homeFocusSummaryLabel="모의고사 D-18 · 설정하기"
          onOpenFocusEditor={() => undefined}
          quests={[
            { id: 'quest-1', title: '영어 독해 2지문 완료', reward: 18, done: true, subjectLabel: '영어', timeLabel: '25m' },
            { id: 'quest-2', title: '수학 오답 15문제 정리', reward: 24, done: false, subjectLabel: '수학', timeLabel: '50m' },
            { id: 'quest-3', title: '국어 문학 복습 노트 작성', reward: 16, done: false, subjectLabel: '국어', timeLabel: '35m' },
          ]}
          questGain={{ id: 'quest-1', key: 1, amount: 18 }}
          onToggleQuest={() => undefined}
          onOpenPlan={() => undefined}
          weeklyTrend={mockTrend}
          bestDayLabel="03/31"
          selectedRankRange="weekly"
          onSelectRankRange={() => undefined}
          selectedHomeRank={mockRank}
          onOpenLeaderboard={() => undefined}
          isVaultOpen={vaultOpen}
          onVaultChange={setVaultOpen}
          selectedBox={mockBoxes[1]}
          boxStage="revealed"
          onRevealBox={() => undefined}
          revealedReward={buildStudyBoxRewardReveal({ basePoints: 14, awardedPoints: 28, multiplier: 2 })}
          onNextBox={() => undefined}
          nextCountdownLabel="14:10"
        />

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card variant="primary" className="on-dark">
            <CardHeader>
              <Badge variant="dark">Planner</Badge>
              <CardTitle>루틴·계획 카드 대비 점검</CardTitle>
              <CardDescription>체크리스트, 일정 카드, 입력 필드가 다크 카드에서도 분명히 보이는지 확인합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PlanItemCard
                id="audit-plan-1"
                title="수학 수특 2단원 오답 20문제 정리"
                checked={false}
                onToggle={() => undefined}
                onDelete={() => undefined}
                isMobile={false}
                tone="amber"
                badgeLabel="수학 · 분량형"
                metaLabel="보상 8P"
                volumeMeta={{
                  targetAmount: 20,
                  actualAmount: 12,
                  unitLabel: '문제',
                  onCommitActual: () => undefined,
                }}
              />
              <PlanItemCard
                id="audit-plan-2"
                title="영어 단어 2회독"
                checked
                onToggle={() => undefined}
                onDelete={() => undefined}
                isMobile={false}
                tone="emerald"
                badgeLabel="영어 · 시간형"
                metaLabel="완료"
              />
              <ScheduleItemCard
                item={{ id: 'audit-schedule', title: '등원 예정: 06:30 ~ 07:20' }}
                onUpdateRange={() => undefined}
                onDelete={() => undefined}
                isPast={false}
                isToday
                isMobile={false}
              />
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card variant="secondary" className="on-dark">
              <CardHeader>
                <Badge variant="dark">Charts</Badge>
                <CardTitle>그래프 라벨·범례 대비</CardTitle>
              <CardDescription>축 라벨, 수치, 범례, 툴팁이 실사용 배경 위에서 읽히는지 확인합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mockChartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="auditFocus" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={34} />
                    <Tooltip content={({ active, payload, label }) => renderTooltip(active, payload as Array<{ name: string; value: number; color?: string }>, label as string)} />
                    <Area dataKey="focus" type="monotone" stroke="var(--chart-1)" fill="url(#auditFocus)" strokeWidth={3} />
                  </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mockChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={34} />
                    <Tooltip content={({ active, payload, label }) => renderTooltip(active, payload as Array<{ name: string; value: number; color?: string }>, label as string)} />
                    <Legend
                      wrapperStyle={{ color: 'var(--chart-axis)', fontWeight: 800, fontSize: 12 }}
                      formatter={(value) => <span style={{ color: 'var(--chart-axis)' }}>{chartConfig[value as keyof typeof chartConfig]?.label ?? value}</span>}
                    />
                    <Bar radius={[10, 10, 4, 4]} dataKey="reward" fill="var(--chart-2)" />
                  </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card variant="light">
              <CardHeader>
                <Badge variant="outline">System</Badge>
                <CardTitle>공통 버튼·배지·라이트 카드</CardTitle>
                <CardDescription>밝은 카드에서도 버튼과 태그가 흐려지지 않는지 확인합니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="default">기본 버튼</Button>
                  <Button variant="secondary">핵심 CTA</Button>
                  <Button variant="dark">다크 버튼</Button>
                  <Button variant="ghost">보조 액션</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">기본 배지</Badge>
                  <Badge variant="secondary">보상 배지</Badge>
                  <Badge variant="dark">다크 배지</Badge>
                  <Badge variant="outline">필터 배지</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <Badge variant="secondary" className="w-fit">Reward Modal</Badge>
            <DialogTitle>포인트 보상 모달 대비 점검</DialogTitle>
            <DialogDescription>블러 오버레이와 네이비 모달 위에서도 제목, 설명, 수치, 버튼이 모두 또렷하게 보여야 합니다.</DialogDescription>
          </DialogHeader>
          <div className="surface-card surface-card--primary on-dark px-5 py-5">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-soft)]">획득 포인트</p>
            <p className="mt-2 text-4xl font-black tracking-tight text-[var(--text-on-dark)]">+128P</p>
            <p className="mt-2 text-sm font-semibold text-[var(--text-on-dark-soft)]">오늘의 핵심 루틴 완료 보상과 연속 달성 보너스가 반영된 상태입니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="dark" onClick={() => setModalOpen(false)}>닫기</Button>
            <Button variant="secondary">다음 보상 보기</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[420px] max-w-[92vw]">
          <SheetHeader>
            <Badge variant="dark" className="w-fit">Bottom Sheet</Badge>
            <SheetTitle>루틴 설정 시트 대비 점검</SheetTitle>
            <SheetDescription>라벨, 필드, 보조 텍스트가 반투명 레이어 위에서도 충분한 대비를 유지해야 합니다.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <Card variant="ivory">
              <CardContent className="space-y-3 pt-6">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">추천 상태</p>
                  <p className="mt-1 text-sm font-black text-[var(--text-primary)]">등원 루틴과 저녁 복습 루틴이 균형 있게 배치되어 있어요.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">집중 유지</Badge>
                  <Badge variant="outline">오답 복습</Badge>
                </div>
              </CardContent>
            </Card>
            <Button variant="secondary" className="w-full">저장하고 적용</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
