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
  LineChart,
  MessageCircle,
  Smartphone,
  Target,
  Trophy,
  Users,
} from 'lucide-react';

import { MarketingPageTracker } from '@/components/marketing/marketing-page-tracker';
import { cn } from '@/lib/utils';

type DemoMode = 'student' | 'parent';

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
        {active ? <div className="h-1.5 w-1.5 rounded-full bg-[#FF7A16]" /> : null}
      </div>
      <p className="dashboard-number mt-2 whitespace-nowrap text-[11px] font-black tracking-tighter text-[#14295F] tabular-nums">
        {value}
      </p>
    </div>
  );
}

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

function StudentShowcase() {
  return (
    <PreviewShell className="bg-[linear-gradient(180deg,#0F1E47_0%,#14295F_100%)] text-white">
      <div className="rounded-[1.25rem] bg-white p-4 text-[#14295F]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black tracking-[0.18em] text-[#14295F]/45">STUDENT HOME</p>
            <p className="mt-1 text-[1.1rem] font-black leading-[1.32]">
              오늘의 루틴과
              <br />
              누적 흐름을 한 번에 확인
            </p>
          </div>
          <span className="rounded-full bg-[#FFF4E8] px-3 py-1 text-[10px] font-black text-[#C15D05]">
            목표 달성률 83%
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <ValueCard label="오늘의 공부시간" value="4h 12m" />
          <ValueCard label="시즌 LP" value="3,164" tone="orange" />
          <ValueCard label="집중력" value="98.3" tone="emerald" />
          <ValueCard label="회복력" value="92.4" tone="rose" />
        </div>
        <div className="mt-4 rounded-[1rem] bg-[#F5F8FF] p-3">
          <div className="flex items-center justify-between text-[11px] font-black">
            <span>주간 누적 그래프</span>
            <span className="text-[#FF7A16]">14h 23m</span>
          </div>
          <div className="mt-3 flex h-16 items-end gap-1.5">
            {[16, 26, 38, 52, 66, 90, 74].map((value, index) => (
              <div
                key={index}
                className="flex-1 rounded-t-lg bg-[linear-gradient(180deg,#2C5DDD_0%,#14295F_100%)]"
                style={{ height: `${value}%` }}
              />
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-[1rem] border border-[#14295F]/8 bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-[#14295F]">선생님 피드백</p>
            <span className="text-[10px] font-black text-[#14295F]/40">방금 업데이트</span>
          </div>
          <p className="mt-2 break-keep text-[11px] font-semibold leading-[1.6] text-[#14295F]/60">
            수요일 이후 집중력이 회복되고 있어요. 국어 독서 복기를 목요일 밤 루틴에 고정해보세요.
          </p>
        </div>
      </div>
    </PreviewShell>
  );
}

function ParentShowcase() {
  return (
    <PreviewShell className="bg-[linear-gradient(180deg,#FFF7EF_0%,#FFFFFF_100%)]">
      <div className="rounded-[1.25rem] bg-[#14295F] p-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black tracking-[0.18em] text-white/60">PARENT DASHBOARD</p>
            <p className="mt-1 text-[1.1rem] font-black leading-[1.32]">
              학생의 상태와
              <br />
              기록 흐름을 빠르게 확인
            </p>
          </div>
          <span className="rounded-full bg-white/12 px-3 py-1 text-[10px] font-black text-white/82">
            실시간 업데이트
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <ValueCard label="주간 누적 공부시간" value="14h 23m" />
          <ValueCard label="평균 목표 달성" value="83%" tone="orange" />
          <ValueCard label="결제 상태" value="완납" tone="emerald" />
          <ValueCard label="위험 신호" value="3건" tone="rose" />
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[1rem] bg-[#F7FAFF] p-3">
          <div className="flex items-center justify-between text-[11px] font-black text-[#14295F]">
            <span>주간 누적 그래프</span>
            <span className="text-[#FF7A16]">목표 대비 48%</span>
          </div>
          <div className="mt-3 flex h-16 items-end gap-1.5">
            {[12, 20, 32, 44, 68, 100, 74].map((value, index) => (
              <div
                key={index}
                className="flex-1 rounded-t-lg bg-[linear-gradient(180deg,#FFB771_0%,#FF7A16_100%)]"
                style={{ height: `${value}%` }}
              />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {['출결 상태 업데이트', '생활 기록 알림', '학습 리포트 도착'].map((item, index) => (
            <div
              key={item}
              className={cn(
                'flex items-center justify-between rounded-xl border px-3 py-3',
                index < 2 ? 'border-[#FFB46A] bg-[#FFF9F3]' : 'border-[#14295F]/8 bg-[#F8FBFF]',
              )}
            >
              <p className="text-[12px] font-black text-[#14295F]">{item}</p>
              {index < 2 ? (
                <div className="h-2 w-2 rounded-full bg-[#FF7A16] shadow-[0_0_8px_rgba(255,122,22,0.55)]" />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </PreviewShell>
  );
}

function MiniStudentCalendar() {
  return (
    <PreviewShell>
      <div className="mb-2 grid grid-cols-4 gap-1.5 text-center text-[8.5px] font-black uppercase tracking-widest text-[#14295F]/35">
        {['MON', 'TUE', 'WED', 'THU'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <HeatCell day="3/2" value="8:25" />
        <HeatCell day="3/3" value="4:23" />
        <HeatCell day="3/4" value="2:46" />
        <HeatCell day="3/5" value="1:36" active />
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-[#14295F]/4 px-3 py-2">
        <Info className="h-3 w-3 shrink-0 text-[#14295F]/35" />
        <p className="text-[10px] font-semibold text-[#14295F]/50">
          날짜를 누르면 그날의 기록을 확인할 수 있어요
        </p>
      </div>
    </PreviewShell>
  );
}

function MiniStudentGrowth() {
  return (
    <PreviewShell>
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]/45">
        GROWTH METRICS
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

function MiniStudentAction() {
  return (
    <PreviewShell>
      <div className="space-y-2">
        {[
          { title: '오늘의 루틴 재정렬', sub: '국어 독서 3지문을 저녁 블록으로 이동' },
          { title: '선생님 피드백 확인', sub: '주간 리포트 기반으로 다음 계획 보정' },
          { title: '알림 확인', sub: '생활 기록과 벌점 회복 흐름 반영' },
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

function MiniParentWeekly() {
  return (
    <PreviewShell>
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]/45">
        주간 누적 그래프
      </p>
      <div className="rounded-[1.1rem] bg-[#14295F] p-3">
        <div className="flex h-14 items-end gap-1.5">
          {[10, 12, 18, 56, 78, 100, 72].map((value, index) => (
            <div key={index} className="flex-1 rounded-t-md bg-[#FF7A16]" style={{ height: `${value}%` }} />
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
        {['MON', 'TUE', 'WED', 'THU'].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <HeatCell day="3/2" value="8:25" />
        <HeatCell day="3/3" value="4:23" />
        <HeatCell day="3/4" value="2:46" />
        <HeatCell day="3/5" value="1:36" active />
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-[#14295F]/4 px-3 py-2">
        <Info className="h-3 w-3 shrink-0 text-[#14295F]/35" />
        <p className="text-[10px] font-semibold text-[#14295F]/50">
          날짜를 누르면 해당 날짜의 학습 기록을 확인할 수 있어요
        </p>
      </div>
    </PreviewShell>
  );
}

function MiniParentReport() {
  return (
    <PreviewShell>
      <div className="space-y-2">
        {[
          { title: '학습 리포트 도착', sub: '이번 주 분석과 다음 전략 정리' },
          { title: '위험 신호 감지', sub: '공부시간 하락과 루틴 이탈 안내' },
          { title: '상담 메모 확인', sub: '전화 상담과 다음 체크 포인트 기록' },
        ].map((item, index) => (
          <div
            key={item.title}
            className={cn(
              'rounded-xl border px-3 py-3',
              index === 1 ? 'border-[#FFB46A] bg-[#FFF9F3]' : 'border-[#14295F]/8 bg-[#F8FBFF]',
            )}
          >
            <p className="text-[13px] font-black text-[#14295F]">{item.title}</p>
            <p className="mt-0.5 text-[10px] font-semibold text-[#14295F]/45">{item.sub}</p>
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function MiniParentAction() {
  return (
    <PreviewShell>
      <div className="space-y-2">
        {[
          { title: '알림 제목 먼저 확인', sub: '필요한 내용만 눌러 상세 확인' },
          { title: '주간 흐름 질문 남기기', sub: '상담/질문 버튼으로 바로 연결' },
          { title: '다음 상담 일정 확인', sub: '학생 변화에 맞춘 체크 포인트 공유' },
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
        {sub ? (
          <p className="mt-1.5 break-keep text-[12px] font-semibold leading-[1.6] text-slate-400">
            {sub}
          </p>
        ) : null}
        {chips ? <ChipRow items={chips} /> : null}
      </div>
      <div className={cn(flip && 'lg:order-1')}>{preview}</div>
    </div>
  );
}

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
      {subtitle ? <p className="mt-1 text-[12px] font-semibold text-slate-400">{subtitle}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {steps.map((step, index) => (
          <Fragment key={step.label}>
            <div className="flex items-center gap-2.5 rounded-xl border border-[#14295F]/8 bg-white px-4 py-2.5 shadow-sm">
              <div className="text-[#FF7A16]">{step.icon}</div>
              <div>
                <p className="text-[12px] font-black text-[#14295F]">{step.label}</p>
                <p className="text-[10px] font-semibold text-slate-400">{step.desc}</p>
              </div>
            </div>
            {index < steps.length - 1 ? (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#14295F]/25" />
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

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
  secondaryHref?: string;
  secondaryLabel?: string;
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
        {secondaryHref && secondaryLabel ? (
          <Link href={secondaryHref} className="premium-cta premium-cta-muted h-11 px-6 text-sm">
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

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
  secondaryHref?: string;
  secondaryLabel?: string;
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
          {subdesc ? (
            <p className="mt-1.5 break-keep text-[13px] font-semibold leading-[1.65] text-slate-400">
              {subdesc}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link href={primaryHref} className="premium-cta premium-cta-primary h-10 px-5 text-sm">
              {primaryLabel}
            </Link>
            {secondaryHref && secondaryLabel ? (
              <Link href={secondaryHref} className="premium-cta premium-cta-muted h-10 px-5 text-sm">
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

const studentBlocks: Array<{
  num: string;
  tag: string;
  title: string;
  body: string;
  sub: string;
  chips: string[];
  preview: ReactNode;
  flip: boolean;
}> = [
  {
    num: '01',
    tag: '확인',
    title: '오늘의 루틴과 지금 상태를 먼저 확인합니다',
    body: '학생은 홈 화면에서 오늘 해야 할 루틴, 누적 공부시간, 목표 달성률을 바로 확인할 수 있습니다.',
    sub: '무엇을 해야 하는지 먼저 보이고, 바로 시작할 수 있도록 행동 중심으로 정리합니다.',
    chips: ['오늘의 루틴', '시즌 LP', '현재 상태'],
    preview: <StudentShowcase />,
    flip: false,
  },
  {
    num: '02',
    tag: '추적',
    title: '주간 캘린더와 누적 지표로 흐름을 추적합니다',
    body: '공부시간과 날짜별 기록이 쌓이면서 언제 리듬이 흔들렸는지, 어느 구간이 회복되었는지 확인할 수 있습니다.',
    sub: '하루 기록이 주간 그래프와 캘린더로 이어져 학습 습관의 패턴이 보입니다.',
    chips: ['주간 캘린더', '날짜별 기록', '누적 공부시간'],
    preview: <MiniStudentCalendar />,
    flip: true,
  },
  {
    num: '03',
    tag: '해석',
    title: '성장 지표와 리포트로 변화의 방향을 읽습니다',
    body: '쌓인 기록은 집중력, 꾸준함, 목표달성 지표와 선생님 리포트로 이어져 학생이 자신의 흐름을 더 분명하게 이해할 수 있게 합니다.',
    sub: '기록이 숫자로 남고, 숫자가 다시 해석으로 이어지는 구조입니다.',
    chips: ['성장 지표', '리포트', '루틴 해석'],
    preview: <MiniStudentGrowth />,
    flip: false,
  },
  {
    num: '04',
    tag: '행동',
    title: '피드백과 알림을 다음 루틴으로 바로 연결합니다',
    body: '피드백, 벌점 회복, 루틴 재정렬 같은 액션이 같은 화면에서 이어져 학생이 바로 다음 행동을 정할 수 있습니다.',
    sub: '보고 끝나는 화면이 아니라, 다음 계획을 다시 세우게 만드는 구조입니다.',
    chips: ['피드백', '다음 루틴', '회복 흐름'],
    preview: <MiniStudentAction />,
    flip: true,
  },
];

const parentBlocks: Array<{
  num: string;
  tag: string;
  title: string;
  body: string;
  sub: string;
  chips: string[];
  preview: ReactNode;
  flip: boolean;
}> = [
  {
    num: '01',
    tag: '확인',
    title: '학생의 현재 상태를 먼저 읽습니다',
    body: '학부모 화면은 출결, 오늘의 공부, 결제 상태, 위험 신호처럼 지금 필요한 정보부터 먼저 보여줍니다.',
    sub: '긴 설명보다 먼저 상태를 확인하고 필요한 알림만 열어보는 구조입니다.',
    chips: ['실시간 상태', '출결', '위험 신호'],
    preview: <ParentShowcase />,
    flip: false,
  },
  {
    num: '02',
    tag: '추적',
    title: '주간 그래프와 날짜별 기록으로 과정을 추적합니다',
    body: '주간 누적 공부시간, 목표 대비 진행률, 날짜별 기록 캘린더를 통해 학생의 과정을 자연스럽게 따라갈 수 있습니다.',
    sub: '매일의 기록이 어떻게 쌓이고 있는지 한눈에 읽히는 구조로 정리했습니다.',
    chips: ['주간 그래프', '날짜별 확인', '학습 흐름'],
    preview: (
      <div className="grid gap-3">
        <MiniParentWeekly />
        <MiniParentCalendar />
      </div>
    ),
    flip: true,
  },
  {
    num: '03',
    tag: '해석',
    title: '리포트와 위험 신호로 변화의 방향을 해석합니다',
    body: '단순한 출결 확인에 그치지 않고, 리포트와 위험 신호를 함께 보며 어떤 개입이 필요한지 이해할 수 있습니다.',
    sub: '하락 추세와 회복 지점이 모두 남아 있어 상담의 기준이 명확해집니다.',
    chips: ['리포트 수신', '위험 신호', '상담 기준'],
    preview: <MiniParentReport />,
    flip: false,
  },
  {
    num: '04',
    tag: '행동',
    title: '알림과 상담으로 바로 다음 행동을 연결합니다',
    body: '학부모는 알림 제목, 질문 전달, 상담 일정 확인까지 한 흐름 안에서 처리할 수 있습니다.',
    sub: '필요한 내용만 빠르게 확인하고 다음 행동으로 넘어갈 수 있도록 설계했습니다.',
    chips: ['알림', '질문 전달', '상담 연결'],
    preview: <MiniParentAction />,
    flip: true,
  },
];

function StudentModeSection() {
  return (
    <div className="space-y-10">
      <div className="divide-y divide-[#14295F]/6">
        {studentBlocks.map((block, index) => (
          <div key={block.num} className={cn('py-10', index === 0 && 'pt-0')}>
            <PreviewBlock {...block} />
          </div>
        ))}
      </div>

      <FlowSummary
        title="학생 화면에서는 이런 흐름으로 이어집니다"
        subtitle="확인, 추적, 해석, 행동이 학생 화면 안에서 자연스럽게 연결됩니다."
        steps={[
          { icon: <Target className="h-4 w-4" />, label: '확인', desc: '오늘의 루틴과 현재 상태 확인' },
          { icon: <CalendarDays className="h-4 w-4" />, label: '추적', desc: '주간 그래프와 날짜별 기록 확인' },
          { icon: <LineChart className="h-4 w-4" />, label: '해석', desc: '성장 지표와 리포트 읽기' },
          { icon: <Bell className="h-4 w-4" />, label: '행동', desc: '다음 루틴과 피드백 반영' },
        ]}
      />

      <ModeCTA
        eyebrow="STUDENT MODE"
        title="학생 화면을 직접 확인해보세요"
        note="실제 화면에서 루틴, 기록, 성장 지표가 어떻게 연결되는지 바로 체험할 수 있습니다."
        primaryHref="/go/login?placement=experience_student"
        primaryLabel="실제 로그인"
        secondaryHref="/experience?mode=parent"
        secondaryLabel="학부모 화면 보기"
      />
    </div>
  );
}

function ParentModeSection() {
  return (
    <div className="space-y-10">
      <div className="divide-y divide-[#14295F]/6">
        {parentBlocks.map((block, index) => (
          <div key={block.num} className={cn('py-10', index === 0 && 'pt-0')}>
            <PreviewBlock {...block} />
          </div>
        ))}
      </div>

      <FlowSummary
        title="학부모 화면에서는 이런 흐름으로 이어집니다"
        subtitle="상태 확인에서 끝나지 않고, 추적과 해석을 거쳐 상담과 행동으로 이어집니다."
        steps={[
          { icon: <Bell className="h-4 w-4" />, label: '확인', desc: '학생 현재 상태와 알림 확인' },
          { icon: <BarChart3 className="h-4 w-4" />, label: '추적', desc: '주간 그래프와 날짜별 기록 확인' },
          { icon: <MessageCircle className="h-4 w-4" />, label: '해석', desc: '리포트와 위험 신호 읽기' },
          { icon: <Users className="h-4 w-4" />, label: '행동', desc: '질문 전달과 상담 연결' },
        ]}
      />

      <ModeCTA
        eyebrow="PARENT MODE"
        title="학부모 화면을 직접 확인해보세요"
        note="출결, 학습 현황, 리포트, 상담 흐름이 어떻게 정리되어 보이는지 바로 체험할 수 있습니다."
        primaryHref="/go/login?placement=experience_parent"
        primaryLabel="실제 로그인"
        secondaryHref="/experience?mode=student"
        secondaryLabel="학생 화면 보기"
      />
    </div>
  );
}

function ExperienceHub() {
  return (
    <div className="space-y-8">
      <div className="rounded-[1.75rem] border border-[#14295F]/10 bg-white p-6 shadow-[0_12px_36px_rgba(20,41,95,0.09)]">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF7A16]">WEB APP PREVIEW</p>
        <h2 className="mt-2 break-keep text-[1.4rem] font-black text-[#14295F] sm:text-[1.7rem]">
          웹앱을 단순 소개가 아니라
          <br />
          실제 흐름처럼 체험해보세요
        </h2>
        <p className="mt-2 break-keep text-[14px] font-semibold leading-[1.7] text-[#334e6a]">
          학생은 오늘의 루틴부터 성장 지표까지, 학부모는 실시간 상태부터 리포트와 상담 흐름까지 확인합니다.
        </p>
        <p className="mt-1.5 break-keep text-[13px] font-semibold text-slate-400">
          같은 데이터를 보더라도 학생과 학부모의 행동이 다르기 때문에, 화면도 다르게 설계했습니다.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StudentShowcase />
        <ParentShowcase />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[1.5rem] border border-[#14295F]/10 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#14295F]/7">
              <Trophy className="h-4.5 w-4.5 text-[#14295F]" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]/45">STUDENT MODE</p>
              <p className="mt-1 text-[1.05rem] font-black text-[#14295F]">학생은 스스로 루틴을 관리합니다</p>
            </div>
          </div>
          <p className="mt-3 break-keep text-[13.5px] font-semibold leading-[1.72] text-slate-500">
            오늘의 루틴, 주간 캘린더, 성장 지표, 피드백이 한 화면 안에서 이어져 학생이 바로 행동할 수 있게 합니다.
          </p>
          <ChipRow items={['오늘의 루틴', '주간 캘린더', '성장 지표', '피드백 알림']} />
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/experience?mode=student" className="premium-cta premium-cta-primary h-10 px-5 text-sm">
              학생 모드 보기
            </Link>
            <Link href="/go/experience?placement=experience_hub_student&mode=student" className="premium-cta premium-cta-muted h-10 px-5 text-sm">
              학생 모드 체험
            </Link>
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-[#FF7A16]/14 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF7A16]/10">
              <Users className="h-4.5 w-4.5 text-[#FF7A16]" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#FF7A16]/55">PARENT MODE</p>
              <p className="mt-1 text-[1.05rem] font-black text-[#14295F]">학부모는 과정을 빠르게 확인합니다</p>
            </div>
          </div>
          <p className="mt-3 break-keep text-[13.5px] font-semibold leading-[1.72] text-slate-500">
            실시간 상태, 주간 그래프, 날짜별 기록, 리포트와 상담 흐름이 한 문법으로 정리되어 과정을 자연스럽게 읽을 수 있습니다.
          </p>
          <ChipRow items={['실시간 상태', '주간 그래프', '날짜별 기록', '리포트 수신']} />
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/experience?mode=parent" className="premium-cta premium-cta-primary h-10 px-5 text-sm">
              학부모 모드 보기
            </Link>
            <Link href="/go/experience?placement=experience_hub_parent&mode=parent" className="premium-cta premium-cta-muted h-10 px-5 text-sm">
              학부모 모드 체험
            </Link>
          </div>
        </article>
      </div>

      <FlowSummary
        title="웹앱 체험 페이지는 이런 순서로 구성했습니다"
        subtitle="화면 조각을 나열하지 않고, 실제 앱을 쓰는 흐름처럼 단계별로 따라갈 수 있도록 설계했습니다."
        steps={[
          { icon: <Target className="h-4 w-4" />, label: '확인', desc: '대표 화면에서 핵심 상태 확인' },
          { icon: <BarChart3 className="h-4 w-4" />, label: '추적', desc: '그래프와 캘린더로 흐름 추적' },
          { icon: <LineChart className="h-4 w-4" />, label: '해석', desc: '리포트와 지표로 변화 해석' },
          { icon: <MessageCircle className="h-4 w-4" />, label: '행동', desc: '알림과 상담으로 다음 행동 연결' },
        ]}
      />
    </div>
  );
}

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

export default function ExperiencePage() {
  const searchParams = useSearchParams();
  const mode = (searchParams.get('mode') as DemoMode | null) ?? null;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#F5F8FF_0%,#FFFFFF_60%,#F8FBFF_100%)] text-[#14295F]">
      <MarketingPageTracker pageType="experience" placement="experience_page" />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
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
            icon={<Users className="h-3.5 w-3.5" />}
          />
        </div>

        <div className="mt-6">
          {!mode ? <ExperienceHub /> : null}

          {mode === 'student' ? (
            <>
              <ModeHero
                eyebrow="STUDENT MODE PREVIEW"
                title="학생 모드 체험"
                desc="오늘의 루틴, 주간 기록, 성장 지표, 피드백 흐름까지 학생 화면에서 직접 확인해보세요."
                subdesc="학생은 무엇을 해야 하는지 먼저 보고, 기록을 쌓고, 성장 지표를 읽고, 다시 행동으로 연결하는 흐름으로 설계했습니다."
                primaryHref="/go/login?placement=experience_hero_student"
                primaryLabel="실제 로그인"
                secondaryHref="/experience?mode=parent"
                secondaryLabel="학부모 화면도 보기"
                badge={
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF3FF] px-3 py-1.5 text-[11px] font-black text-[#14295F]">
                    <Smartphone className="h-3 w-3" />
                    학생 앱 흐름
                  </div>
                }
              />
              <StudentModeSection />
            </>
          ) : null}

          {mode === 'parent' ? (
            <>
              <ModeHero
                eyebrow="PARENT MODE PREVIEW"
                title="학부모 모드 체험"
                desc="실시간 상태, 주간 그래프, 날짜별 기록, 리포트와 상담 흐름까지 학부모 화면에서 직접 확인해보세요."
                subdesc="학부모는 학생의 과정을 빠르게 읽고 필요한 순간에 바로 질문하거나 상담으로 연결할 수 있도록 설계했습니다."
                primaryHref="/go/login?placement=experience_hero_parent"
                primaryLabel="실제 로그인"
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
          ) : null}
        </div>
      </div>
    </main>
  );
}
