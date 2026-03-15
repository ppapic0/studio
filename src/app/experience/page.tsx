'use client';

import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Info,
  MessageCircle,
  Smartphone,
  Target,
  Trophy,
} from 'lucide-react';

import { MarketingPageTracker } from '@/components/marketing/marketing-page-tracker';
import { cn } from '@/lib/utils';

type DemoMode = 'student' | 'parent';

/* ─────────────────────────────────────────
   Utility: compact stat card
───────────────────────────────────────── */
function ValueCard({
  label,
  value,
  tone = 'navy',
}: {
  label: string;
  value: string;
  tone?: 'navy' | 'orange' | 'emerald' | 'rose';
}) {
  const toneMap = {
    navy: 'bg-[#F5F8FF] text-[#14295F]',
    orange: 'bg-[#FFF5EC] text-[#D96809]',
    emerald: 'bg-[#EEF9F2] text-[#0F8C57]',
    rose: 'bg-[#FFF3F5] text-[#D14A74]',
  };
  return (
    <div className={cn('rounded-[1rem] p-3', toneMap[tone])}>
      <p className="text-[10px] font-black tracking-tight opacity-60">{label}</p>
      <p className="dashboard-number mt-1.5 text-[1.35rem] leading-none tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

/* ─────────────────────────────────────────
   Utility: calendar heat cell
───────────────────────────────────────── */
function HeatCell({ day, value, active = false }: { day: string; value: string; active?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[0.9rem] border p-2',
        active
          ? 'border-[#FFB571] bg-gradient-to-b from-[#FFF8EE] to-white'
          : 'border-[#14295F]/6 bg-white',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black text-[#14295F]/45">{day}</span>
        {active && <div className="h-1.5 w-1.5 rounded-full bg-[#FF7A16]" />}
      </div>
      <p className="dashboard-number mt-2 text-[11px] font-black text-[#14295F] tabular-nums whitespace-nowrap tracking-tighter">
        {value}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────
   Preview shell
───────────────────────────────────────── */
function PreviewShell({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[1.5rem] border border-[#14295F]/10 bg-white shadow-[0_8px_28px_rgba(20,41,95,0.09)]',
        className,
      )}
    >
      <div className="h-1 bg-gradient-to-r from-[#14295F] via-[#1d45a8] to-transparent opacity-35" />
      <div className="p-4">{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Student mini previews
───────────────────────────────────────── */
function MiniStudentToday() {
  return (
    <PreviewShell>
      <div className="rounded-[1.1rem] bg-gradient-to-br from-[#D85810] to-[#A83D0A] p-4 text-white">
        <div className="mb-2 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-[8.5px] font-black tracking-widest text-white/80">
          GROWTH TRACK ACTIVE
        </div>
        <p className="text-[1rem] font-black leading-tight">
          오늘의 성장을 위해
          <br />
          트랙을 시작하세요
        </p>
        <div className="mt-3 rounded-xl bg-white py-2 text-center text-[13px] font-black text-[#14295F]">
          트랙 시작
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ValueCard label="오늘의 누적 트랙" value="1h 36m" />
        <ValueCard label="시즌 LP" value="3,164" tone="orange" />
      </div>
    </PreviewShell>
  );
}

function MiniStudentStats() {
  return (
    <PreviewShell>
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]/45">
        스킬트랙 · FOCUS · CONSISTENCY
      </p>
      <div className="grid grid-cols-2 gap-2">
        <ValueCard label="집중력" value="98.3" />
        <ValueCard label="꾸준함" value="98.5" tone="emerald" />
        <ValueCard label="목표달성" value="98.1" tone="orange" />
        <ValueCard label="회복력" value="98.0" tone="rose" />
      </div>
    </PreviewShell>
  );
}

function MiniStudentCalendar() {
  return (
    <PreviewShell>
      <div className="mb-2 grid grid-cols-4 gap-1.5 text-center text-[8.5px] font-black uppercase tracking-widest text-[#14295F]/35">
        {['MON', 'TUE', 'WED', 'THU'].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <HeatCell day="3/2" value="8:25" />
        <HeatCell day="3/3" value="4:23" />
        <HeatCell day="3/4" value="2:46" />
        <HeatCell day="3/5" value="1:36" active />
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-[#14295F]/4 py-2 px-3">
        <Info className="h-3 w-3 shrink-0 text-[#14295F]/35" />
        <p className="text-[10px] font-semibold text-[#14295F]/50">
          날짜를 누르면 그날의 기록을 확인할 수 있어요
        </p>
      </div>
    </PreviewShell>
  );
}

function MiniStudentReport() {
  return (
    <PreviewShell>
      <div className="space-y-2">
        {[
          { title: '계획트랙', sub: '매일 계획 → 실행 → 피드백' },
          { title: '선생님 리포트', sub: '이번 주 분석 · 다음 전략' },
          { title: '벌점 현황', sub: '생활관리 기준 · 회복 흐름' },
        ].map((item) => (
          <div
            key={item.title}
            className="flex items-center justify-between rounded-xl border border-[#14295F]/8 bg-[#F8FBFF] px-3 py-3"
          >
            <div>
              <p className="text-[13px] font-black text-[#14295F]">{item.title}</p>
              <p className="mt-0.5 text-[10px] font-semibold text-[#14295F]/45">{item.sub}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#14295F]/30" />
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

/* ─────────────────────────────────────────
   Parent mini previews
───────────────────────────────────────── */
function MiniParentStatus() {
  return (
    <PreviewShell>
      <p className="mb-3 text-[10px] font-black text-[#FF7A16]">실시간 업데이트 중</p>
      <div className="grid grid-cols-2 gap-2">
        <ValueCard label="주간 누적 트랙" value="14h 23m" />
        <ValueCard label="평균 목표 달성" value="50%" tone="orange" />
        <ValueCard label="결제 상태" value="완납" tone="emerald" />
        <ValueCard label="벌점 지수" value="5점" tone="rose" />
      </div>
    </PreviewShell>
  );
}

function MiniParentWeekly() {
  return (
    <PreviewShell>
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]/45">
        주간 누적 트랙
      </p>
      <div className="rounded-[1.1rem] bg-[#14295F] p-3">
        <div className="flex h-14 items-end gap-1.5">
          {[10, 10, 12, 86, 100, 70, 46].map((v, i) => (
            <div key={i} className="flex-1 rounded-t-md bg-[#FF7A16]" style={{ height: `${v}%` }} />
          ))}
        </div>
        <p className="mt-2 text-[11px] font-black text-white/80">
          주간 누적 14시간 23분 · 목표 대비 48%
        </p>
      </div>
    </PreviewShell>
  );
}

function MiniParentCalendar() {
  return (
    <PreviewShell>
      <div className="mb-2 grid grid-cols-4 gap-1.5 text-center text-[8.5px] font-black uppercase tracking-widest text-[#14295F]/35">
        {['MON', 'TUE', 'WED', 'THU'].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <HeatCell day="3/2" value="8:25" />
        <HeatCell day="3/3" value="4:23" />
        <HeatCell day="3/4" value="2:46" />
        <HeatCell day="3/5" value="1:36" active />
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-[#14295F]/4 py-2 px-3">
        <Info className="h-3 w-3 shrink-0 text-[#14295F]/35" />
        <p className="text-[10px] font-semibold text-[#14295F]/50">
          날짜를 누르면 해당 날짜의 학습 기록을 확인할 수 있어요
        </p>
      </div>
    </PreviewShell>
  );
}

function MiniParentAlerts() {
  return (
    <PreviewShell>
      <div className="space-y-2">
        {[
          { title: '출결 상태 업데이트', unread: true },
          { title: '생활 기록 알림', unread: true },
          { title: '학습 리포트 도착', unread: false },
        ].map((item) => (
          <div
            key={item.title}
            className={cn(
              'flex items-center justify-between rounded-xl border px-3 py-3',
              item.unread
                ? 'border-[#FFB46A] bg-[#FFF9F3]'
                : 'border-[#14295F]/8 bg-[#F8FBFF]',
            )}
          >
            <p className="text-[13px] font-black text-[#14295F]">{item.title}</p>
            {item.unread && (
              <div className="h-2 w-2 rounded-full bg-[#FF7A16] shadow-[0_0_8px_rgba(255,122,22,0.55)]" />
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[10px] font-semibold text-[#14295F]/40">
        제목만 먼저 보이고, 눌러서 상세를 확인합니다
      </p>
    </PreviewShell>
  );
}

/* ─────────────────────────────────────────
   Chip tag label
───────────────────────────────────────── */
function ChipRow({ items }: { items: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-[#14295F]/10 bg-[#14295F]/5 px-2.5 py-1 text-[10px] font-black text-[#14295F]/60"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   Preview block: text + preview
───────────────────────────────────────── */
function PreviewBlock({
  num,
  tag,
  title,
  body,
  sub,
  chips,
  preview,
  flip = false,
}: {
  num: string;
  tag: string;
  title: string;
  body: string;
  sub?: string;
  chips?: string[];
  preview: ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-10">
      <div className={cn(flip && 'lg:order-2')}>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#14295F]/10 text-[9px] font-black text-[#14295F]">
            {num}
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF7A16]">{tag}</span>
        </div>
        <h3 className="break-keep text-[1.15rem] font-black leading-[1.32] text-[#14295F]">{title}</h3>
        <p className="mt-2 break-keep text-[13.5px] font-semibold leading-[1.7] text-slate-500">{body}</p>
        {sub && (
          <p className="mt-1.5 break-keep text-[12px] font-semibold leading-[1.6] text-slate-400">
            {sub}
          </p>
        )}
        {chips && <ChipRow items={chips} />}
      </div>
      <div className={cn(flip && 'lg:order-1')}>{preview}</div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Flow summary (3 steps)
───────────────────────────────────────── */
function FlowSummary({
  title,
  subtitle,
  steps,
}: {
  title: string;
  subtitle?: string;
  steps: Array<{ icon: ReactNode; label: string; desc: string }>;
}) {
  return (
    <div className="rounded-[1.5rem] border border-[#14295F]/8 bg-[#F7FAFF] p-5">
      <p className="text-[11px] font-black text-[#14295F]">{title}</p>
      {subtitle && (
        <p className="mt-1 text-[12px] font-semibold text-slate-400">{subtitle}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {steps.map((step, i) => (
          <Fragment key={step.label}>
            <div className="flex items-center gap-2.5 rounded-xl border border-[#14295F]/8 bg-white px-4 py-2.5 shadow-sm">
              <div className="text-[#FF7A16]">{step.icon}</div>
              <div>
                <p className="text-[12px] font-black text-[#14295F]">{step.label}</p>
                <p className="text-[10px] font-semibold text-slate-400">{step.desc}</p>
              </div>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#14295F]/25" />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   CTA bar
───────────────────────────────────────── */
function ModeCTA({
  eyebrow,
  title,
  note,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  eyebrow: string;
  title: string;
  note: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-[#14295F]/10 bg-white p-6 text-center shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF7A16]">{eyebrow}</p>
      <p className="mt-2 break-keep text-[1.1rem] font-black text-[#14295F]">{title}</p>
      <p className="mt-1.5 text-[13px] font-semibold text-slate-400">{note}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link href={primaryHref} className="premium-cta premium-cta-primary h-11 px-6 text-sm">
          {primaryLabel}
        </Link>
        <Link href={secondaryHref} className="premium-cta premium-cta-muted h-11 px-6 text-sm">
          {secondaryLabel}
        </Link>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Mode hero (inside each mode page)
───────────────────────────────────────── */
function ModeHero({
  eyebrow,
  title,
  desc,
  subdesc,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  badge,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  subdesc?: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  badge?: ReactNode;
}) {
  return (
    <div className="mb-8 overflow-hidden rounded-[1.75rem] border border-[#14295F]/10 bg-white shadow-[0_12px_36px_rgba(20,41,95,0.09)]">
      <div className="relative px-6 py-6 sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_6%_12%,rgba(20,41,95,0.04),transparent_20%),radial-gradient(circle_at_94%_8%,rgba(255,122,22,0.08),transparent_20%)]" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF7A16]">{eyebrow}</p>
            {badge}
          </div>
          <h2 className="mt-2 break-keep text-[1.5rem] font-black text-[#14295F] sm:text-[1.75rem]">{title}</h2>
          <p className="mt-2 break-keep text-[14px] font-semibold leading-[1.7] text-[#334e6a]">{desc}</p>
          {subdesc && (
            <p className="mt-1.5 break-keep text-[13px] font-semibold leading-[1.65] text-slate-400">
              {subdesc}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link href={primaryHref} className="premium-cta premium-cta-primary h-10 px-5 text-sm">
              {primaryLabel}
            </Link>
            <Link href={secondaryHref} className="premium-cta premium-cta-muted h-10 px-5 text-sm">
              {secondaryLabel}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Student mode section
───────────────────────────────────────── */
const studentBlocks: Array<{
  num: string; tag: string; title: string; body: string; sub: string; chips: string[]; preview: ReactNode; flip: boolean;
}> = [
  {
    num: '01', tag: '오늘의 시작',
    title: '오늘의 루틴을 바로 확인합니다',
    body: '학생은 홈 화면에서 오늘 해야 할 루틴과 현재 흐름을 바로 확인할 수 있습니다.',
    sub: '시작해야 할 일과 지금까지의 진행 흐름이 복잡하지 않게 정리됩니다.',
    chips: ['오늘의 루틴', '시작하기', '실행 흐름'],
    preview: <MiniStudentToday />,
    flip: false,
  },
  {
    num: '02', tag: '누적 기록',
    title: '기록은 매일 쌓이고 흐름으로 보입니다',
    body: '공부 시간, 누적 기록, 실행 흐름을 한 화면에서 빠르게 확인할 수 있습니다.',
    sub: '하루의 기록이 쌓여 주간 흐름과 학습 습관으로 이어집니다.',
    chips: ['누적 시간', '실행 기록', '주간 흐름'],
    preview: <MiniStudentStats />,
    flip: true,
  },
  {
    num: '03', tag: '기록 캘린더',
    title: '날짜별 기록을 바로 확인합니다',
    body: '캘린더에서 원하는 날짜를 눌러 그날의 학습 기록을 확인할 수 있습니다.',
    sub: '언제 얼마나 공부했는지, 어떤 흐름으로 쌓였는지 달력에서 바로 볼 수 있습니다.',
    chips: ['기록 캘린더', '날짜별 확인', '학습 흐름'],
    preview: <MiniStudentCalendar />,
    flip: false,
  },
  {
    num: '04', tag: '리포트 · 분석',
    title: '기록은 분석으로 이어집니다',
    body: '쌓인 데이터는 리포트와 분석 흐름으로 이어져 학생이 지금 상태를 더 분명하게 확인할 수 있게 합니다.',
    sub: '단순히 기록만 남는 것이 아니라, 돌아보고 정리할 수 있는 흐름까지 연결됩니다.',
    chips: ['리포트', '분석 흐름', '기록 정리'],
    preview: <MiniStudentReport />,
    flip: true,
  },
];

function StudentModeSection() {
  return (
    <div className="space-y-10">
      <div className="divide-y divide-[#14295F]/6">
        {studentBlocks.map((block, i) => (
          <div key={block.num} className={cn('py-10', i === 0 && 'pt-0')}>
            <PreviewBlock {...block} />
          </div>
        ))}
      </div>

      <FlowSummary
        title="학생 화면에서는 이런 흐름으로 이어집니다"
        subtitle="해야 할 일, 쌓인 기록, 돌아보는 흐름까지 학생 화면 안에서 자연스럽게 이어집니다."
        steps={[
          { icon: <CalendarDays className="h-4 w-4" />, label: '루틴 확인', desc: '오늘 해야 할 루틴 확인' },
          { icon: <BarChart3 className="h-4 w-4" />, label: '기록 누적', desc: '공부 시간 · 실행 흐름' },
          { icon: <Target className="h-4 w-4" />, label: '흐름 정리', desc: '누적 기록 · 리포트 반영' },
        ]}
      />

      <ModeCTA
        eyebrow="STUDENT MODE"
        title="학생 화면을 직접 확인해보세요"
        note="실제 화면에서 루틴, 기록, 누적 흐름이 어떻게 보이는지 바로 체험할 수 있습니다."
        primaryHref="/go/experience?placement=experience_student&mode=student"
        primaryLabel="학생 화면 체험하기"
        secondaryHref="/experience?mode=parent"
        secondaryLabel="학부모 화면 보기"
      />
    </div>
  );
}

/* ─────────────────────────────────────────
   Parent mode section
───────────────────────────────────────── */
const parentBlocks: Array<{
  num: string; tag: string; title: string; body: string; sub: string; chips: string[]; preview: ReactNode; flip: boolean;
}> = [
  {
    num: '01', tag: '학생 현황 요약',
    title: '학생 현황을 한눈에 확인합니다',
    body: '오늘 공부, 현재 상태, 목표 달성 흐름까지 상단 화면에서 빠르게 확인할 수 있습니다.',
    sub: '복잡한 설명보다 지금 필요한 상태를 먼저 읽을 수 있도록 정리했습니다.',
    chips: ['오늘 공부', '현재 상태', '목표 달성'],
    preview: <MiniParentStatus />,
    flip: false,
  },
  {
    num: '02', tag: '주간 기록',
    title: '주간 누적 트랙과 학습 흐름을 확인합니다',
    body: '주간 시간과 목표 달성 흐름을 학부모 화면에서 요약해 확인할 수 있습니다.',
    sub: '매일의 기록이 어떻게 쌓이고 있는지 한눈에 읽히는 구조로 보여줍니다.',
    chips: ['주간 누적 트랙', '학습 흐름', '목표 달성'],
    preview: <MiniParentWeekly />,
    flip: true,
  },
  {
    num: '03', tag: '기록 캘린더',
    title: '날짜별 학습 기록을 확인합니다',
    body: '캘린더에서 원하는 날짜를 눌러 그날의 학습 내용을 바로 확인할 수 있습니다.',
    sub: '기록의 흐름을 날짜별로 확인할 수 있어 학생의 학습 패턴을 더 쉽게 파악할 수 있습니다.',
    chips: ['기록 캘린더', '날짜별 확인', '학습 내용'],
    preview: <MiniParentCalendar />,
    flip: false,
  },
  {
    num: '04', tag: '알림 · 리포트',
    title: '알림과 분석 흐름도 함께 연결됩니다',
    body: '최근 알림, 분석 결과, 상담 흐름까지 학부모 화면에서 함께 확인할 수 있습니다.',
    sub: '출결이나 기록만 따로 보는 것이 아니라, 필요한 흐름이 하나의 화면 안에서 이어집니다.',
    chips: ['최근 알림', '분석 결과', '상담 흐름'],
    preview: <MiniParentAlerts />,
    flip: true,
  },
];

function ParentModeSection() {
  return (
    <div className="space-y-10">
      <div className="divide-y divide-[#14295F]/6">
        {parentBlocks.map((block, i) => (
          <div key={block.num} className={cn('py-10', i === 0 && 'pt-0')}>
            <PreviewBlock {...block} />
          </div>
        ))}
      </div>

      <FlowSummary
        title="학부모 화면에서는 이런 흐름으로 이어집니다"
        subtitle="오늘의 상태부터 누적 기록, 분석과 상담 흐름까지 한 번에 확인할 수 있습니다."
        steps={[
          { icon: <Bell className="h-4 w-4" />, label: '상태 확인', desc: '학생 현재 상태 확인' },
          { icon: <CalendarDays className="h-4 w-4" />, label: '흐름 추적', desc: '주간 트랙 · 캘린더' },
          { icon: <MessageCircle className="h-4 w-4" />, label: '연결', desc: '알림 · 리포트 · 상담' },
        ]}
      />

      <ModeCTA
        eyebrow="PARENT MODE"
        title="학부모 화면을 직접 확인해보세요"
        note="출결, 학습 현황, 기록 흐름이 어떻게 정리되어 보이는지 바로 체험할 수 있습니다."
        primaryHref="/go/experience?placement=experience_parent&mode=parent"
        primaryLabel="학부모 화면 체험하기"
        secondaryHref="/experience?mode=student"
        secondaryLabel="학생 화면 보기"
      />
    </div>
  );
}

/* ─────────────────────────────────────────
   No-mode landing (웹앱 체험 통합)
───────────────────────────────────────── */
function WebAppLanding() {
  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="rounded-[1.75rem] border border-[#14295F]/10 bg-white p-6 shadow-[0_12px_36px_rgba(20,41,95,0.09)]">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF7A16]">
          WEB APP PREVIEW
        </p>
        <h2 className="mt-2 break-keep text-[1.4rem] font-black text-[#14295F] sm:text-[1.7rem]">
          웹앱으로 직접 확인해보세요
        </h2>
        <p className="mt-2 break-keep text-[14px] font-semibold leading-[1.7] text-[#334e6a]">
          학생은 루틴과 기록을 확인하고, 학부모는 출결과 학습 흐름을 확인합니다.
        </p>
        <p className="mt-1.5 break-keep text-[13px] font-semibold text-slate-400">
          같은 데이터를 보더라도 학생과 학부모에게 필요한 화면은 다르게 설계됩니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link
            href="/experience?mode=student"
            className="premium-cta premium-cta-primary h-10 px-5 text-sm"
          >
            학생 화면 체험하기
          </Link>
          <Link
            href="/experience?mode=parent"
            className="premium-cta premium-cta-muted h-10 px-5 text-sm"
          >
            학부모 화면 체험하기
          </Link>
        </div>
      </div>

      {/* Two mode cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Student */}
        <article className="flex flex-col rounded-[1.75rem] border border-[#14295F]/10 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#14295F]/7">
              <Trophy className="h-4.5 w-4.5 text-[#14295F]" />
            </div>
            <p className="text-[1.05rem] font-black text-[#14295F]">학생 모드</p>
          </div>
          <p className="mt-3 break-keep text-[13.5px] font-semibold leading-[1.7] text-slate-500">
            루틴, 기록, 누적 흐름을 학생 화면에서 바로 확인합니다.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <ValueCard label="오늘의 누적 트랙" value="1h 36m" />
            <ValueCard label="시즌 LP" value="3,164" tone="orange" />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {['오늘의 루틴', '누적 기록', '날짜별 캘린더'].map((c) => (
              <span
                key={c}
                className="rounded-full border border-[#14295F]/10 bg-[#14295F]/5 px-2.5 py-1 text-[10px] font-black text-[#14295F]/55"
              >
                {c}
              </span>
            ))}
          </div>

          <Link
            href="/experience?mode=student"
            className="premium-cta premium-cta-primary mt-5 h-10 w-full text-[13px]"
          >
            학생 화면 체험하기
          </Link>
        </article>

        {/* Parent */}
        <article className="flex flex-col rounded-[1.75rem] border border-[#14295F]/10 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF7A16]/10">
              <Smartphone className="h-4.5 w-4.5 text-[#FF7A16]" />
            </div>
            <p className="text-[1.05rem] font-black text-[#14295F]">학부모 모드</p>
          </div>
          <p className="mt-3 break-keep text-[13.5px] font-semibold leading-[1.7] text-slate-500">
            출결, 학습 현황, 상담 흐름을 학부모 화면에서 확인합니다.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <ValueCard label="주간 누적 트랙" value="14h 23m" />
            <ValueCard label="평균 목표 달성" value="50%" tone="orange" />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {['학생 현황', '주간 누적 트랙', '학습 기록 확인'].map((c) => (
              <span
                key={c}
                className="rounded-full border border-[#14295F]/10 bg-[#FF7A16]/6 px-2.5 py-1 text-[10px] font-black text-[#D96809]/70"
              >
                {c}
              </span>
            ))}
          </div>

          <Link
            href="/experience?mode=parent"
            className="premium-cta premium-cta-primary mt-5 h-10 w-full text-[13px]"
          >
            학부모 화면 체험하기
          </Link>
        </article>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Mode tab
───────────────────────────────────────── */
function ModeTab({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-black transition-all',
        active
          ? 'bg-[#14295F] text-white shadow-[0_6px_16px_rgba(20,41,95,0.22)]'
          : 'border border-[#14295F]/12 bg-white text-[#14295F]/65 hover:border-[#14295F]/22 hover:text-[#14295F]',
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

/* ─────────────────────────────────────────
   Page
───────────────────────────────────────── */
export default function ExperiencePage() {
  const searchParams = useSearchParams();
  const mode = (searchParams.get('mode') as DemoMode | null) ?? null;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#F5F8FF_0%,#FFFFFF_60%,#F8FBFF_100%)] text-[#14295F]">
      <MarketingPageTracker pageType="experience" placement="experience_page" />
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Top nav */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[#14295F]/12 bg-white px-4 py-2 text-[13px] font-black text-[#14295F] shadow-sm"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            홍보 페이지로 돌아가기
          </Link>
          <Link
            href="/go/login?placement=experience_header"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#FF7A16] px-4 py-2 text-[13px] font-black text-white shadow-[0_8px_18px_rgba(255,122,22,0.28)]"
          >
            실제 로그인
          </Link>
        </div>

        {/* Page-level mode tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          <ModeTab
            href="/experience"
            label="웹앱 체험"
            active={!mode}
            icon={<span className="h-3 w-3 rounded-full border-2 border-current opacity-70" />}
          />
          <ModeTab
            href="/experience?mode=student"
            label="학생 모드"
            active={mode === 'student'}
            icon={<Trophy className="h-3.5 w-3.5" />}
          />
          <ModeTab
            href="/experience?mode=parent"
            label="학부모 모드"
            active={mode === 'parent'}
            icon={<Smartphone className="h-3.5 w-3.5" />}
          />
        </div>

        {/* Content */}
        <div className="mt-6">
          {!mode && <WebAppLanding />}

          {mode === 'student' && (
            <>
              <ModeHero
                eyebrow="STUDENT MODE PREVIEW"
                title="학생 모드 체험"
                desc="루틴, 기록, 누적 흐름까지 학생 화면에서 직접 확인해보세요."
                subdesc="오늘 해야 할 루틴부터 누적 기록, 날짜별 학습 흐름까지 학생에게 필요한 화면을 한눈에 볼 수 있도록 구성했습니다."
                primaryHref="/go/experience?placement=experience_hero_student&mode=student"
                primaryLabel="학생 화면 체험하기"
                secondaryHref="/experience?mode=parent"
                secondaryLabel="학부모 화면도 보기"
              />
              <StudentModeSection />
            </>
          )}

          {mode === 'parent' && (
            <>
              <ModeHero
                eyebrow="PARENT MODE PREVIEW"
                title="학부모 모드 체험"
                desc="출결, 학습 현황, 기록 흐름까지 학부모 화면에서 직접 확인해보세요."
                subdesc="학생의 하루 현황부터 주간 기록, 날짜별 학습 흐름까지 학부모가 필요한 정보를 빠르게 확인할 수 있도록 구성했습니다."
                primaryHref="/go/experience?placement=experience_hero_parent&mode=parent"
                primaryLabel="학부모 화면 체험하기"
                secondaryHref="/experience?mode=student"
                secondaryLabel="학생 화면도 보기"
                badge={
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF4EB] px-3 py-1.5 text-[11px] font-black text-[#B85A00]">
                    <Smartphone className="h-3 w-3" />
                    앱모드 전용
                  </div>
                }
              />
              <ParentModeSection />
            </>
          )}
        </div>

      </div>
    </main>
  );
}
