'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  CreditCard,
  FileText,
  LayoutDashboard,
  MessageCircle,
  Monitor,
  Smartphone,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';

import { cn } from '@/lib/utils';

type DemoMode = 'student' | 'parent';
type StudentView = 'desktop' | 'mobile';
type StudentInsight = 'analysis' | 'growth' | 'record' | 'plan';
type ParentInsight = 'alerts' | 'calendar' | 'weekly' | 'billing';

function SelectorLink({ href, label, active }: { href: string; label: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-black transition-all duration-200',
        active
          ? 'bg-[#14295F] text-white shadow-[0_12px_26px_rgba(20,41,95,0.24)]'
          : 'border border-[#14295F]/12 bg-white text-[#14295F] hover:border-[#FF7A16]/35 hover:bg-[#FFF8F2]'
      )}
    >
      {label}
    </Link>
  );
}

function DetailTabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-black transition-all duration-200',
        active
          ? 'bg-[#14295F] text-white shadow-[0_10px_24px_rgba(20,41,95,0.22)]'
          : 'border border-[#14295F]/10 bg-white text-[#14295F]/72 hover:border-[#FF7A16]/30 hover:text-[#14295F]'
      )}
    >
      {label}
    </button>
  );
}

function ExperienceSection({
  eyebrow,
  title,
  description,
  children,
  extra,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <section className="mt-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.18em] text-[#FF7A16]">{eyebrow}</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-[#14295F] sm:text-4xl">{title}</h2>
          <p className="mt-3 max-w-3xl break-keep text-sm font-bold leading-relaxed text-slate-600 sm:text-[15px]">
            {description}
          </p>
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

function DemoValueCard({
  label,
  value,
  tone = 'navy',
  caption,
}: {
  label: string;
  value: string;
  tone?: 'navy' | 'orange' | 'emerald' | 'rose';
  caption?: string;
}) {
  const toneMap = {
    navy: 'bg-[#F5F8FF] text-[#14295F]',
    orange: 'bg-[#FFF5EC] text-[#D96809]',
    emerald: 'bg-[#EEF9F2] text-[#0F8C57]',
    rose: 'bg-[#FFF3F5] text-[#D14A74]',
  };

  return (
    <div className={cn('rounded-2xl border border-[#14295F]/8 p-4 shadow-sm', toneMap[tone])}>
      <p className="text-[11px] font-black tracking-tight opacity-70">{label}</p>
      <p className="dashboard-number mt-2 text-[1.7rem] leading-none tracking-tight">{value}</p>
      {caption ? <p className="mt-2 text-[11px] font-bold opacity-65">{caption}</p> : null}
    </div>
  );
}

function DemoPanel({
  title,
  subtitle,
  children,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-[1.5rem] border border-[#14295F]/8 bg-white p-5 shadow-sm', className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-black tracking-tight text-[#14295F]">{title}</p>
          {subtitle ? <p className="mt-1 text-[10px] font-black tracking-[0.16em] text-[#14295F]/42">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[386px] rounded-[2.7rem] border-[10px] border-[#132B63] bg-[linear-gradient(180deg,#eff4ff_0%,#ffffff_100%)] p-3 shadow-[0_34px_90px_rgba(20,41,95,0.24)]">
      <div className="relative overflow-hidden rounded-[2rem] border border-[#14295F]/10 bg-[#FFFDFB]">
        <div className="pointer-events-none absolute left-1/2 top-0 z-20 h-6 w-32 -translate-x-1/2 rounded-b-[1rem] bg-[#10224B]" />
        {children}
      </div>
    </div>
  );
}

function AppHeader({ avatar = '김' }: { avatar?: string }) {
  return (
    <div className="relative flex items-center justify-between border-b border-[#14295F]/8 bg-white px-5 py-4">
      <div className="min-w-0 pr-8">
        <p className="text-[11px] font-black tracking-tight text-[#14295F]/62">대시보드</p>
        <p className="mt-0.5 text-[11px] font-black tracking-tight text-[#14295F]/62">기본 대시보드</p>
      </div>
      <div className="absolute left-1/2 top-0 flex -translate-x-1/2 translate-y-3 items-center justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#14295F] text-white shadow-[0_12px_18px_rgba(20,41,95,0.28)]">
          <Monitor className="h-5 w-5" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Bell className="h-4.5 w-4.5 text-[#14295F]/75" />
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#14295F]/12 bg-[#F6F8FD] text-[12px] font-black text-[#14295F]">{avatar}</div>
      </div>
    </div>
  );
}

function BottomNav({ items, active }: { items: Array<{ label: string; icon: typeof LayoutDashboard }>; active: string }) {
  return (
    <div className="grid grid-cols-5 border-t border-[#223a71] bg-[linear-gradient(180deg,#14295F_0%,#0E1F49_100%)] px-2 pb-5 pt-3 text-white shadow-[0_-12px_24px_rgba(10,20,52,0.35)]">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.label === active;
        return (
          <div key={item.label} className="flex flex-col items-center justify-center gap-1">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl transition-all', isActive ? 'bg-[#FF7A16] text-[#14295F] shadow-[0_8px_14px_rgba(255,122,22,0.35)]' : 'bg-white/10 text-white/80')}>
              <Icon className="h-4.5 w-4.5" />
            </div>
            <span className={cn('text-[10px] font-black', isActive ? 'text-[#FFD7AE]' : 'text-white/60')}>{item.label}</span>
            <div className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-[#FF7A16]' : 'bg-transparent')} />
          </div>
        );
      })}
    </div>
  );
}

function LineChartDemo({ values, labels }: { values: number[]; labels: string[] }) {
  const width = 480;
  const height = 180;
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1 || 1)) * (width - 20) + 10;
      const y = height - (value / max) * (height - 24) - 12;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div>
      <div className="h-[210px] rounded-[1.25rem] border border-[#14295F]/6 bg-[#FBFCFF] px-4 py-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[150px] w-full overflow-visible">
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
            <line key={ratio} x1="0" y1={height - ratio * (height - 24) - 12} x2={width} y2={height - ratio * (height - 24) - 12} stroke="rgba(20,41,95,0.10)" strokeDasharray="4 6" />
          ))}
          <polyline fill="none" stroke="rgba(20,41,95,0.18)" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round" points={points} />
          <polyline fill="none" stroke="#FF7A16" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" points={points} />
          {values.map((value, index) => {
            const x = (index / (values.length - 1 || 1)) * (width - 20) + 10;
            const y = height - (value / max) * (height - 24) - 12;
            return <circle key={`${index}-${value}`} cx={x} cy={y} r="6" fill="#fff" stroke="#FF7A16" strokeWidth="3" />;
          })}
        </svg>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {labels.map((label) => <span key={label} className="text-center text-[10px] font-black text-[#14295F]/45">{label}</span>)}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-3">
        {[
          ['누적 몰입', '14h 23m'],
          ['평균 시작', '08:57'],
          ['최고 몰입일', '03/09'],
          ['리듬 점수', '92점'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#14295F]/8 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black tracking-[0.14em] text-[#14295F]/42">{label}</p>
            <p className="dashboard-number mt-2 text-lg text-[#14295F]">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubjectBars({ items }: { items: Array<{ label: string; value: number; tone?: 'orange' | 'blue' | 'emerald' | 'rose' }> }) {
  const toneMap = {
    orange: 'from-[#FFB16D] to-[#FF7A16]',
    blue: 'from-[#72A4FF] to-[#356EF4]',
    emerald: 'from-[#47D8AA] to-[#12A876]',
    rose: 'from-[#FF8CAB] to-[#F25580]',
  };

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[72px_1fr_52px] items-center gap-3">
          <span className="text-sm font-black text-[#14295F]/68">{item.label}</span>
          <div className="h-3 rounded-full bg-[#EEF2F8]">
            <div className={cn('h-3 rounded-full bg-gradient-to-r', toneMap[item.tone ?? 'orange'])} style={{ width: `${item.value}%` }} />
          </div>
          <span className="dashboard-number text-right text-sm text-[#14295F]">{item.value}%</span>
        </div>
      ))}
    </div>
  );
}

function HeatCell({ day, value, active = false }: { day: string; value: string; active?: boolean }) {
  return (
    <div className={cn('rounded-[1.1rem] border p-2 shadow-sm', active ? 'border-[#FFB571] bg-[linear-gradient(180deg,#FFF8EE_0%,#FFFFFF_100%)]' : 'border-[#14295F]/6 bg-white')}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-[#14295F]/48">{day}</span>
        {active ? <div className="h-2 w-2 rounded-full bg-[#FF7A16]" /> : null}
      </div>
      <p className="dashboard-number mt-3 text-sm text-[#14295F]">{value}</p>
    </div>
  );
}
function ExperienceHighlights({ items }: { items: Array<{ title: string; body: string; icon: ReactNode }> }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.title} className="rounded-[1.5rem] border border-[#14295F]/10 bg-white p-5 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF5EC] text-[#FF7A16] shadow-sm">{item.icon}</div>
          <p className="mt-4 text-lg font-black tracking-tight text-[#14295F]">{item.title}</p>
          <p className="mt-2 break-keep text-sm font-bold leading-relaxed text-slate-600">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

function ExperienceDetailShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[1.75rem] border border-[#14295F]/10 bg-white p-5 shadow-[0_18px_45px_rgba(20,41,95,0.1)] sm:p-6">
      <p className="text-[11px] font-black tracking-[0.18em] text-[#FF7A16]">{eyebrow}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-2xl font-black tracking-tight text-[#14295F]">더 깊게 보는 체험 포인트</h3>
          <p className="mt-2 max-w-3xl break-keep text-sm font-bold leading-relaxed text-slate-600">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/#consult" className="inline-flex h-10 items-center justify-center rounded-full bg-[#FF7A16] px-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(255,122,22,0.25)]">
            {title}
          </Link>
          <Link href="/login" className="inline-flex h-10 items-center justify-center rounded-full border border-[#14295F]/10 bg-white px-4 text-sm font-black text-[#14295F]">
            실제 로그인
          </Link>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function StudentInsightDetail({ insight }: { insight: StudentInsight }) {
  const data = {
    analysis: {
      label: '학습 분석',
      summary: '공부시간, 시작 리듬, 과목 편중, 위험 신호를 한 번에 묶어 학생의 현재 상태를 빠르게 해석합니다.',
      bullets: ['최근 14일 평균 공부시간 4시간 49분', '평균 시작 시각 08:57', '독서 강세 / 언매 회전 부족', '미제출 과제 1건 즉시 감지'],
      stats: [
        ['몰입 시간', '14h 23m'],
        ['시작 리듬', '08:57'],
        ['리듬 점수', '92점'],
      ],
      note: '학생은 숫자로 현재 상태를 바로 보고, 원장은 어떤 보완이 필요한지 빠르게 개입할 수 있습니다.',
    },
    growth: {
      label: '성장 지표',
      summary: 'LP, 스킬 점수, 시즌 진행 상황을 함께 보여줘 성장이 추상적이지 않도록 설계했습니다.',
      bullets: ['시즌 LP 3,164 누적', '집중력 98.3 / 꾸준함 98.5', '달성률 82%', '보상 구조로 동기 유지'],
      stats: [
        ['시즌 LP', '3,164'],
        ['평균 스킬', '98.2'],
        ['현재 티어', '브론즈'],
      ],
      note: '학생이 지금 어느 구간에 있는지 시각적으로 확인할 수 있어 장기 루틴 유지에 유리합니다.',
    },
    record: {
      label: '기록 캘린더',
      summary: '날짜별 누적 시간과 주간 그래프를 함께 보여줘 공부가 언제 무너지고 언제 회복되는지 확인할 수 있습니다.',
      bullets: ['캘린더에서 날짜별 총 시간 확인', '주간 막대로 흐름 해석', '상세 일자 클릭 시 루틴/학습 데이터 연결', '공백 구간이 눈에 띄게 설계'],
      stats: [
        ['최고 몰입일', '03/09'],
        ['최고 시간', '8:25'],
        ['공백 구간', '2일'],
      ],
      note: '기록은 단순 저장이 아니라 다음 계획을 수정하는 근거 데이터가 됩니다.',
    },
    plan: {
      label: '계획 루틴',
      summary: '계획은 매주 세우고, 매일 체크하고, 피드백이 다시 다음 계획으로 연결되도록 구성했습니다.',
      bullets: ['주간 LP 작성', '오늘의 할 일 분리', '실행 체크와 완료율 산출', '다음 주 계획에 피드백 반영'],
      stats: [
        ['이번 주 계획', '12개'],
        ['완료', '10개'],
        ['달성률', '82%'],
      ],
      note: '막연한 공부를 구체적인 행동 단위로 바꾸는 것이 트랙 학생 모드의 핵심입니다.',
    },
  }[insight];

  return (
    <div key={insight} className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div className="rounded-[1.5rem] border border-[#14295F]/8 bg-[#FBFCFF] p-5">
        <p className="text-lg font-black tracking-tight text-[#14295F]">{data.label}</p>
        <p className="mt-3 break-keep text-sm font-bold leading-relaxed text-slate-600">{data.summary}</p>
        <div className="mt-4 grid gap-3">
          {data.bullets.map((bullet) => (
            <div key={bullet} className="rounded-2xl border border-[#14295F]/8 bg-white px-4 py-3 text-sm font-black text-[#14295F]/82 shadow-sm">
              {bullet}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-[1.5rem] bg-[linear-gradient(145deg,#14295F_0%,#1A3B82_100%)] p-5 text-white shadow-[0_18px_36px_rgba(20,41,95,0.2)]">
        <p className="text-[11px] font-black tracking-[0.18em] text-white/62">DETAIL SNAPSHOT</p>
        <div className="mt-4 grid gap-3">
          {data.stats.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-[10px] font-black tracking-[0.16em] text-white/55">{label}</p>
              <p className="dashboard-number mt-2 text-[1.8rem] text-white">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl bg-white/8 px-4 py-4 text-sm font-black leading-relaxed text-white/82">{data.note}</div>
      </div>
    </div>
  );
}

function ParentInsightDetail({ insight }: { insight: ParentInsight }) {
  const data = {
    alerts: {
      label: '알림 읽기 흐름',
      summary: '학부모 KPI 관리 목적에 맞춰 알림은 제목 중심으로 먼저 보여주고, 눌러서 읽어야 상세가 열리도록 설계했습니다.',
      bullets: ['미확인 알림은 오렌지 점과 글로우로 표시', '제목만 먼저 노출', '탭 후 상세 팝업에서 읽음 처리', '알림 방문 이력도 관리 지표로 반영 가능'],
      stats: [
        ['미확인', '2건'],
        ['최근 읽음', '17시간 전'],
        ['응답 필요', '1건'],
      ],
      note: '학부모가 어떤 정보에 반응했는지까지 관리할 수 있어 센터 소통 우선순위를 잡는 데 도움이 됩니다.',
    },
    calendar: {
      label: '학습 캘린더',
      summary: '주간 누적 몰입과 날짜별 학습 시간을 앱 안에서 바로 확인하고, 특정 날짜 상세 데이터까지 자연스럽게 이어집니다.',
      bullets: ['날짜별 총 공부시간 노출', '선택 날짜 상세 모달 연결', '캘린더 + 주간 그래프 동시 확인', '과목별 학습비중 카드 연동'],
      stats: [
        ['주간 누적', '14h 23m'],
        ['최고 몰입일', '03/02'],
        ['계획 달성', '50%'],
      ],
      note: '출결만 보는 앱이 아니라 학습 과정 전체를 캘린더형으로 이해하는 앱이라는 인상을 줍니다.',
    },
    weekly: {
      label: '주간 분석',
      summary: '그래프와 AI/교사 피드백을 같이 배치해, 학부모가 숫자만 보는 것이 아니라 해석까지 함께 받는 구조를 보여줍니다.',
      bullets: ['일별 집중 시간 그래프', '과목별 비중 차트', '목표 대비 달성도 문장 피드백', '벌점/생활 관리 상태도 함께 요약'],
      stats: [
        ['목표 대비', '48%'],
        ['가장 많이 한 과목', '독서'],
        ['벌점 지수', '5점'],
      ],
      note: '주간 분석은 학부모의 불안을 줄이고, 상담 시 어떤 부분을 먼저 이야기해야 할지 기준을 줍니다.',
    },
    billing: {
      label: '수납 상태',
      summary: '학원과 독서실 수납을 따로 보여 추후 분리될 결제 흐름을 미리 이해할 수 있도록 정리했습니다.',
      bullets: ['독서실 수납 / 학원 수납 분리 노출', '완납 / 청구 / 미납 상태 명확화', '앱에서 바로 결제 인지 가능', '실시간 상태 업데이트'],
      stats: [
        ['독서실 수납', '₩50,000'],
        ['학원 수납', '₩320,000'],
        ['결제 상태', '완납/청구'],
      ],
      note: '학부모는 지금 어떤 비용이 어떤 상태인지 혼동 없이 확인하고, 센터는 결제 안내 흐름을 명확히 유지할 수 있습니다.',
    },
  }[insight];

  return (
    <div key={insight} className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr] animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div className="rounded-[1.5rem] border border-[#14295F]/8 bg-[#FBFCFF] p-5">
        <p className="text-lg font-black tracking-tight text-[#14295F]">{data.label}</p>
        <p className="mt-3 break-keep text-sm font-bold leading-relaxed text-slate-600">{data.summary}</p>
        <div className="mt-4 grid gap-3">
          {data.bullets.map((bullet) => (
            <div key={bullet} className="rounded-2xl border border-[#14295F]/8 bg-white px-4 py-3 text-sm font-black text-[#14295F]/82 shadow-sm">
              {bullet}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-[1.5rem] border border-[#FF7A16]/12 bg-[linear-gradient(145deg,#FFF8EF_0%,#FFFFFF_100%)] p-5 shadow-[0_18px_36px_rgba(20,41,95,0.09)]">
        <p className="text-[11px] font-black tracking-[0.18em] text-[#C46C17]">PARENT SNAPSHOT</p>
        <div className="mt-4 grid gap-3">
          {data.stats.map(([label, value], index) => (
            <div key={label} className={cn('rounded-2xl px-4 py-3', index === data.stats.length - 1 ? 'bg-[#FFF3E7]' : 'bg-white border border-[#14295F]/8 shadow-sm')}>
              <p className="text-[10px] font-black tracking-[0.16em] text-[#14295F]/46">{label}</p>
              <p className="dashboard-number mt-2 text-[1.75rem] text-[#14295F]">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl bg-[#14295F] px-4 py-4 text-sm font-black leading-relaxed text-white/82">{data.note}</div>
      </div>
    </div>
  );
}

function StudentDesktopDemo() {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-[#14295F]/10 bg-white shadow-[0_24px_70px_rgba(20,41,95,0.12)]">
      <div className="border-b border-[#14295F]/8 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-[2rem] font-black tracking-tight text-[#14295F]">김재윤</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black text-[#14295F]/55">
              <span>건국대학교 목표</span>
              <span>2학년</span>
              <span>연속 공부 4일</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {['상담 예약', '리포트 확인', '정보 수정'].map((item) => (
              <div key={item} className="inline-flex h-11 items-center justify-center rounded-full border border-[#14295F]/10 bg-white px-5 text-sm font-black text-[#14295F] shadow-sm">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-4">
          <DemoValueCard label="평균 공부시간" value="4시간 49분" caption="최근 14일 기준" />
          <DemoValueCard label="시즌 LP" value="3,164 LP" tone="orange" caption="실행 기반 누적 포인트" />
          <DemoValueCard label="계획 달성률" value="82%" tone="emerald" caption="이번 주 진행률" />
          <DemoValueCard label="위험 신호" value="1건" tone="rose" caption="미제출 과제 즉시 감지" />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 rounded-full bg-[#F4F6FA] p-1">
          {['학습 분석', '성장 기록', '계획/루틴'].map((item, index) => (
            <div key={item} className={cn('flex h-11 items-center justify-center rounded-full text-sm font-black transition', index === 0 ? 'bg-white text-[#14295F] shadow-sm' : 'text-[#14295F]/46')}>
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 bg-[#FBFCFE] px-6 py-6 xl:grid-cols-[1.35fr_0.65fr]">
        <DemoPanel title="공부시간 추이" subtitle="RECENT 14 DAYS" right={<div className="rounded-full bg-[#F4F7FD] px-3 py-1 text-[11px] font-black text-[#14295F]/70">14일</div>}>
          <LineChartDemo values={[210, 25, 10, 128, 282, 96, 38]} labels={['2/27', '2/28', '3/1', '3/2', '3/3', '3/9', '3/12']} />
        </DemoPanel>

        <div className="space-y-4">
          <DemoPanel title="과목별 학습 비중" subtitle="SUBJECT FOCUS MAP">
            <SubjectBars
              items={[
                { label: '문학', value: 88, tone: 'orange' },
                { label: '독서', value: 76, tone: 'blue' },
                { label: '언매', value: 61, tone: 'emerald' },
                { label: '수학', value: 34, tone: 'rose' },
              ]}
            />
          </DemoPanel>

          <DemoPanel title="LP 획득 가이드" subtitle="ACTION REWARDS">
            <div className="space-y-3">
              {[
                ['출석 체크', '+100 LP'],
                ['계획 3개 이상 완료', '+100 LP'],
                ['실시간 몰입 3시간', '+100 LP'],
                ['실시간 몰입 6시간', '+100 LP'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-2xl border border-[#14295F]/8 bg-[#F8FBFF] px-4 py-3">
                  <span className="text-sm font-black text-[#14295F]">{label}</span>
                  <span className="dashboard-number text-sm text-[#FF7A16]">{value}</span>
                </div>
              ))}
            </div>
          </DemoPanel>
        </div>

        <DemoPanel title="인지과학 코칭 포인트" subtitle="WEEKLY FEEDBACK LOOP" className="xl:col-span-2">
          <div className="grid gap-3 lg:grid-cols-3">
            {[
              '최근 14일 평균 공부시간은 4시간 49분입니다. 상위권으로 가기 위해선 몰입 시간을 더 안정적으로 고정할 필요가 있습니다.',
              '계획 달성률 82%는 좋은 흐름입니다. 남은 18%는 시작 시간 지연과 루틴 미작성 구간에서 발생했습니다.',
              '독서는 강점이지만 언매 회전수가 부족합니다. 평가원 리듬에 맞춰 주 2회 언매 점검 루틴을 유지하세요.',
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-[#F7FAFF] px-4 py-4 text-sm font-black leading-relaxed text-[#14295F]/82">{item}</div>
            ))}
          </div>
        </DemoPanel>
      </div>
    </div>
  );
}

function StudentMobileDemo() {
  return (
    <PhoneFrame>
      <div className="flex h-full flex-col bg-[linear-gradient(180deg,#fff8f1_0%,#ffffff_22%,#f7faff_100%)]">
        <AppHeader />
        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4 pt-5">
          <div>
            <p className="text-[1.9rem] font-black leading-none tracking-tight text-[#14295F]">김재윤님, 반가워요!</p>
            <div className="mt-2 inline-flex rounded-full bg-[#14295F] px-3 py-1 text-[10px] font-black text-white">학생</div>
          </div>

          <div className="rounded-[1.9rem] bg-[linear-gradient(145deg,#D85810_0%,#A83D0A_100%)] p-5 text-white shadow-[0_22px_34px_rgba(196,82,18,0.28)]">
            <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-white/85">GROWTH TRACK ACTIVE</div>
            <h3 className="mt-4 text-[2rem] font-black leading-tight tracking-tight">오늘의 성장을 위해 트랙을 시작하세요</h3>
            <div className="mt-5 grid gap-3">
              <div className="flex h-14 items-center justify-center rounded-2xl bg-white text-lg font-black text-[#14295F]">트랙 시작</div>
              <div className="flex h-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-sm font-black">나의 출입 QR</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DemoValueCard label="오늘의 누적 트랙" value="1h 36m" />
            <DemoValueCard label="시즌 LP" value="3,164 LP" tone="orange" />
          </div>

          <DemoPanel title="스킬트랙" subtitle="FOCUS · CONSISTENCY · ACHIEVEMENT" right={<Trophy className="h-5 w-5 text-[#FF7A16]" />}>
            <div className="grid grid-cols-2 gap-3">
              <DemoValueCard label="집중력" value="98.3" />
              <DemoValueCard label="꾸준함" value="98.5" tone="emerald" />
              <DemoValueCard label="목표달성" value="98.1" tone="orange" />
              <DemoValueCard label="회복력" value="98.0" tone="rose" />
            </div>
          </DemoPanel>

          <DemoPanel title="기록트랙" subtitle="STUDY CONSISTENCY MAP" right={<div className="rounded-full bg-[#F4F7FD] px-3 py-1 text-[11px] font-black text-[#14295F]">2026년 3월</div>}>
            <div className="grid grid-cols-4 gap-2 text-center text-[9px] font-black uppercase tracking-[0.16em] text-[#14295F]/38">
              {['MON', 'TUE', 'WED', 'THU'].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <HeatCell day="3/2" value="8:25" />
              <HeatCell day="3/3" value="4:23" />
              <HeatCell day="3/4" value="2:46" />
              <HeatCell day="3/5" value="1:36" active />
            </div>
            <div className="mt-4 rounded-2xl border border-[#14295F]/8 bg-[#14295F] px-4 py-4 text-white">
              <p className="text-[10px] font-black tracking-[0.18em] text-white/65">WEEKLY DETAIL</p>
              <div className="mt-3 h-24 rounded-2xl bg-white/8 p-3">
                <div className="flex h-full items-end gap-2">
                  {[12, 12, 14, 88, 100, 72, 46].map((value, index) => <div key={index} className="flex-1 rounded-t-xl bg-[#FF7A16]" style={{ height: `${value}%` }} />)}
                </div>
              </div>
            </div>
          </DemoPanel>

          <div className="grid gap-3">
            {[
              ['계획트랙', '매일 계획 → 실행 → 피드백 루프'],
              ['선생님 리포트', '이번 주 분석과 다음 전략 확인'],
              ['벌점 현황', '생활관리 기준과 회복 흐름 안내'],
            ].map(([title, subtitle]) => (
              <div key={title} className="flex items-center justify-between rounded-[1.6rem] border border-[#14295F]/8 bg-white px-4 py-4 shadow-sm">
                <div>
                  <p className="text-base font-black tracking-tight text-[#14295F]">{title}</p>
                  <p className="mt-1 text-[10px] font-black tracking-[0.16em] text-[#14295F]/42">{subtitle}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-[#14295F]/40" />
              </div>
            ))}
          </div>
        </div>

        <BottomNav active="홈" items={[{ label: '홈', icon: LayoutDashboard }, { label: '성장', icon: Zap }, { label: '기록', icon: CalendarDays }, { label: '계획', icon: ClipboardList }, { label: '상담', icon: MessageCircle }]} />
      </div>
    </PhoneFrame>
  );
}
function ParentMobileDemo() {
  return (
    <PhoneFrame>
      <div className="flex h-full flex-col bg-[linear-gradient(180deg,#fff7f0_0%,#ffffff_24%,#f7faff_100%)]">
        <AppHeader avatar="학" />
        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4 pt-5">
          <div>
            <p className="text-[1.65rem] font-black leading-none tracking-tight text-[#14295F]">학부모 모드</p>
            <div className="mt-2 inline-flex rounded-full bg-[#14295F] px-3 py-1 text-[10px] font-black text-white">앱모드 전용</div>
          </div>

          <div className="rounded-[1.9rem] border border-[#14295F]/8 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[1.85rem] font-black leading-none tracking-tight text-[#14295F]">김재윤 학생 현황</p>
                <p className="mt-2 text-[11px] font-black text-[#FF7A16]">실시간 업데이트 중</p>
              </div>
              <Sparkles className="h-5 w-5 text-[#FF7A16]" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <DemoValueCard label="주간 누적 몰입" value="14시간 23분" />
              <DemoValueCard label="평균 목표 달성" value="50%" tone="orange" />
              <DemoValueCard label="결제 상태" value="완납" tone="emerald" />
              <DemoValueCard label="벌점 지수" value="5점" tone="rose" />
            </div>
          </div>

          <DemoPanel title="최근 알림 3개" subtitle="TITLE ONLY · TAP TO OPEN" right={<div className="rounded-full bg-[#FFF4EB] px-2.5 py-1 text-[11px] font-black text-[#C46C17]">미확인 2</div>}>
            <div className="space-y-3">
              {[
                ['출결 상태 업데이트', true],
                ['생활 기록 알림', true],
                ['학습 리포트 도착', false],
              ].map(([title, unread]) => (
                <div key={title} className={cn('rounded-2xl border px-4 py-4 shadow-sm', unread ? 'border-[#FFB46A] bg-[#FFF9F3]' : 'border-[#14295F]/8 bg-[#F8FBFF]')}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-[#14295F]">{title}</p>
                    {unread ? <div className="h-2.5 w-2.5 rounded-full bg-[#FF7A16] shadow-[0_0_14px_rgba(255,122,22,0.75)]" /> : null}
                  </div>
                  <p className="mt-1 text-[11px] font-black text-[#14295F]/45">제목만 먼저 보이고, 눌러서 상세 내용을 읽고 읽음 처리합니다.</p>
                </div>
              ))}
            </div>
          </DemoPanel>

          <DemoPanel title="기록트랙" subtitle="STUDY CONSISTENCY MAP" right={<div className="rounded-full bg-[#F4F7FD] px-3 py-2 text-[11px] font-black text-[#14295F]">2026년 3월</div>}>
            <div className="grid grid-cols-4 gap-2 text-center text-[9px] font-black uppercase tracking-[0.16em] text-[#14295F]/38">
              {['MON', 'TUE', 'WED', 'THU'].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <HeatCell day="3/2" value="8:25" />
              <HeatCell day="3/3" value="4:23" />
              <HeatCell day="3/4" value="2:46" />
              <HeatCell day="3/5" value="1:36" active />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#14295F]/8 bg-[#F8FBFF] px-4 py-4">
                <p className="text-[10px] font-black tracking-[0.14em] text-[#14295F]/42">과목별 학습비중</p>
                <div className="mt-3 space-y-3">
                  <SubjectBars items={[{ label: '독서', value: 78, tone: 'blue' }, { label: '문학', value: 74, tone: 'orange' }]} />
                </div>
              </div>
              <div className="rounded-2xl bg-[#14295F] px-4 py-4 text-white">
                <p className="text-[10px] font-black tracking-[0.16em] text-white/62">WEEKLY DETAIL</p>
                <div className="mt-3 h-24 rounded-2xl bg-white/8 p-3">
                  <div className="flex h-full items-end gap-2">
                    {[10, 10, 12, 86, 100, 70, 46].map((value, index) => <div key={index} className="flex-1 rounded-t-xl bg-[#FF7A16]" style={{ height: `${value}%` }} />)}
                  </div>
                </div>
                <p className="mt-3 text-[12px] font-black leading-relaxed text-white/82">주간 누적 14시간 23분, 목표 대비 48%입니다.</p>
              </div>
            </div>
          </DemoPanel>

          <DemoPanel title="수납" subtitle="REALTIME PAYMENT STATUS" right={<CreditCard className="h-5 w-5 text-[#FF7A16]" />}>
            <p className="break-keep text-[13px] font-black leading-relaxed text-[#14295F]/72">센터 수납 요청건을 비대면으로 결제할 수 있어요.</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-[#14295F]/8 bg-[#F8FBFF] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black text-[#14295F]/55">독서실 수납</p>
                    <p className="dashboard-number mt-2 text-[1.7rem] text-[#14295F]">₩50,000</p>
                  </div>
                  <div className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-700">완납</div>
                </div>
              </div>
              <div className="rounded-2xl border border-[#14295F]/8 bg-[#FFF9F3] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black text-[#14295F]/55">학원 수납</p>
                    <p className="dashboard-number mt-2 text-[1.7rem] text-[#14295F]">₩320,000</p>
                  </div>
                  <div className="rounded-full bg-[#FFE0C2] px-3 py-1 text-[11px] font-black text-[#D96809]">청구</div>
                </div>
              </div>
            </div>
          </DemoPanel>

          <DemoPanel title="상담 및 지원 요청" subtitle="PARENT SUPPORT CHANNEL" right={<MessageCircle className="h-5 w-5 text-[#FF7A16]" />}>
            <div className="rounded-2xl border border-[#14295F]/8 bg-[#FAFCFF] px-4 py-4">
              <p className="text-sm font-black text-[#14295F]">센터 방문 상담</p>
              <p className="mt-2 text-[13px] font-black leading-relaxed text-[#14295F]/64">자녀의 학습이나 생활에 대해 궁금한 점을 입력하면 상담 요청이 바로 센터에 전달됩니다.</p>
            </div>
          </DemoPanel>
        </div>

        <BottomNav active="홈" items={[{ label: '홈', icon: LayoutDashboard }, { label: '학습', icon: Clock3 }, { label: '데이터', icon: FileText }, { label: '소통', icon: MessageCircle }, { label: '수납', icon: CreditCard }]} />
      </div>
    </PhoneFrame>
  );
}

export default function ExperiencePage() {
  const searchParams = useSearchParams();
  const mode = (searchParams.get('mode') as DemoMode | null) ?? null;
  const studentView = (searchParams.get('view') as StudentView | null) ?? 'desktop';
  const [studentInsight, setStudentInsight] = useState<StudentInsight>('analysis');
  const [parentInsight, setParentInsight] = useState<ParentInsight>('alerts');

  useEffect(() => {
    if (mode === 'student') setStudentInsight('analysis');
    if (mode === 'parent') setParentInsight('alerts');
  }, [mode, studentView]);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#F5F8FF_0%,#FFFFFF_100%)] text-[#14295F]">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-[#14295F]/12 bg-white px-4 py-2 text-sm font-black text-[#14295F] shadow-sm">
            <ChevronLeft className="h-4 w-4" />
            홍보 페이지로 돌아가기
          </Link>
          <Link href="/login" className="inline-flex items-center gap-2 rounded-full bg-[#FF7A16] px-4 py-2 text-sm font-black text-white shadow-[0_12px_24px_rgba(255,122,22,0.28)]">
            실제 로그인
          </Link>
        </div>

        <section className="mt-8 overflow-hidden rounded-[2.25rem] border border-[#14295F]/10 bg-white shadow-[0_26px_80px_rgba(20,41,95,0.12)]">
          <div className="relative px-6 py-8 sm:px-8 sm:py-9">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(20,41,95,0.06),transparent_24%),radial-gradient(circle_at_88%_12%,rgba(255,122,22,0.14),transparent_24%),linear-gradient(135deg,transparent_0%,transparent_46%,rgba(20,41,95,0.03)_46%,rgba(20,41,95,0.03)_47%,transparent_47%)]" />
            <div className="relative">
              <p className="text-xs font-black tracking-[0.22em] text-[#FF7A16]">TRACK EXPERIENCE</p>
              <h1 className="mt-3 max-w-4xl break-keep text-4xl font-black leading-tight tracking-tight text-[#14295F] sm:text-5xl">실제 앱처럼, 데이터 흐름까지 보이는 체험 화면</h1>
              <p className="mt-4 max-w-3xl break-keep text-sm font-bold leading-relaxed text-slate-600 sm:text-[15px]">
                학생 모드는 웹과 앱 흐름 모두 체험할 수 있고, 학부모 모드는 실제 운영 방식과 동일하게 앱모드 전용으로 제공합니다. 계획, 실행, 리포트, 알림, 결제, 학습 캘린더까지 실제 화면처럼 구성해 트랙이 얼마나 데이터적으로 관리하는지 바로 느낄 수 있도록 만들었습니다.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <SelectorLink href="/experience?mode=student&view=desktop" label="학생 모드 체험" active={mode === 'student'} />
                <SelectorLink href="/experience?mode=parent" label="학부모 모드 체험" active={mode === 'parent'} />
              </div>
            </div>
          </div>
        </section>

        {!mode ? (
          <section className="mt-8 grid gap-5 lg:grid-cols-2">
            <article className="rounded-[1.9rem] border border-[#14295F]/10 bg-white p-6 shadow-[0_16px_40px_rgba(20,41,95,0.1)]">
              <div className="flex items-center gap-3"><LayoutDashboard className="h-5 w-5 text-[#FF7A16]" /><p className="text-2xl font-black tracking-tight text-[#14295F]">학생 모드 체험</p></div>
              <p className="mt-3 break-keep text-sm font-bold leading-relaxed text-slate-600">홈, 성장, 기록, 계획 흐름이 서로 연결되도록 구성했습니다. 학생이 무엇을 얼마나 했는지, 어디서 밀리는지, 다음 전략이 무엇인지가 한눈에 보이도록 설계했습니다.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <SelectorLink href="/experience?mode=student&view=desktop" label="학생 웹모드 보기" />
                <SelectorLink href="/experience?mode=student&view=mobile" label="학생 앱모드 보기" />
              </div>
            </article>

            <article className="rounded-[1.9rem] border border-[#14295F]/10 bg-white p-6 shadow-[0_16px_40px_rgba(20,41,95,0.1)]">
              <div className="flex items-center gap-3"><Smartphone className="h-5 w-5 text-[#FF7A16]" /><p className="text-2xl font-black tracking-tight text-[#14295F]">학부모 모드 체험</p></div>
              <p className="mt-3 break-keep text-sm font-bold leading-relaxed text-slate-600">제목 기반 알림, 학습 캘린더, 주간 그래프, 수납, 상담 요청까지 실제 학부모 앱에서 확인하는 핵심 흐름을 그대로 보여줍니다. 학부모 모드는 실제 환경처럼 앱모드만 체험할 수 있습니다.</p>
              <div className="mt-5 flex flex-wrap gap-3"><SelectorLink href="/experience?mode=parent" label="학부모 앱모드 보기" /></div>
            </article>
          </section>
        ) : null}

        {mode === 'student' ? (
          <ExperienceSection
            eyebrow="STUDENT EXPERIENCE"
            title="학생 모드 체험"
            description="학생 모드는 계획을 세우고, 실행을 기록하고, 결과를 다시 다음 계획에 반영하는 흐름이 중심입니다. 화면 곳곳의 수치와 그래프가 단순 장식이 아니라 실제 관리 포인트처럼 보이도록 구성했습니다."
            extra={<div className="flex gap-2"><SelectorLink href="/experience?mode=student&view=desktop" label="웹모드" active={studentView === 'desktop'} /><SelectorLink href="/experience?mode=student&view=mobile" label="앱모드" active={studentView === 'mobile'} /></div>}
          >
            {studentView === 'desktop' ? <StudentDesktopDemo /> : <StudentMobileDemo />}
            <ExperienceHighlights
              items={[
                { title: '실행 데이터 중심', body: '누적 공부시간, 계획 달성률, 위험 신호, LP 누적이 한 흐름으로 이어져 학생이 지금 어떤 상태인지 바로 파악할 수 있습니다.', icon: <BarChart3 className="h-5 w-5" /> },
                { title: '계획-실행 루프', body: '계획을 세우고 끝나는 것이 아니라, 실행 체크와 피드백이 다음 주 계획에 반영되는 구조가 보이도록 구성했습니다.', icon: <Target className="h-5 w-5" /> },
                { title: '동기 유지 장치', body: 'LP, 스킬 지표, 성장 카드처럼 학생이 성장을 시각적으로 느낄 수 있는 요소를 함께 배치했습니다.', icon: <Trophy className="h-5 w-5" /> },
              ]}
            />
            <ExperienceDetailShell
              eyebrow="STUDENT DETAIL PREVIEW"
              title="학생 모드 기준 상담 문의"
              description="학생 체험 화면 안에서도 어떤 데이터를 중심으로 관리하는지 탭처럼 살펴볼 수 있게 구성했습니다. 실제 서비스처럼 포인트를 나눠서 확인하는 흐름을 강조합니다."
            >
              <div className="flex flex-wrap gap-2">
                {[
                  ['analysis', '학습 분석'],
                  ['growth', '성장 지표'],
                  ['record', '기록 캘린더'],
                  ['plan', '계획 루틴'],
                ].map(([key, label]) => (
                  <DetailTabButton
                    key={key}
                    label={label}
                    active={studentInsight === key}
                    onClick={() => setStudentInsight(key as StudentInsight)}
                  />
                ))}
              </div>
              <div className="mt-5">
                <StudentInsightDetail insight={studentInsight} />
              </div>
            </ExperienceDetailShell>
          </ExperienceSection>
        ) : null}

        {mode === 'parent' ? (
          <ExperienceSection
            eyebrow="PARENT EXPERIENCE"
            title="학부모 모드 체험"
            description="학부모 모드는 앱모드 전용으로 운영됩니다. 알림은 제목만 먼저 보이고, 눌러서 상세를 읽는 구조를 유지하면서도 학습 캘린더, 주간 그래프, 수납 상태, 상담 채널까지 한 화면 흐름 안에서 확인할 수 있도록 만들었습니다."
            extra={<div className="inline-flex items-center gap-2 rounded-full bg-[#FFF4EB] px-4 py-2 text-sm font-black text-[#B85A00]"><Smartphone className="h-4 w-4" />앱모드 전용</div>}
          >
            <div className="rounded-[1.9rem] border border-[#14295F]/10 bg-white p-6 shadow-[0_16px_40px_rgba(20,41,95,0.1)]"><ParentMobileDemo /></div>
            <ExperienceHighlights
              items={[
                { title: '제목 중심 알림 구조', body: '알림은 제목만 먼저 보여 학부모의 실제 방문 흐름을 파악할 수 있게 하고, 눌러서 내용을 읽는 순간 읽음 상태가 반영되도록 설명합니다.', icon: <Bell className="h-5 w-5" /> },
                { title: '학습 데이터 가시화', body: '캘린더, 주간 그래프, 과목별 비중을 함께 배치해 단순 출결 앱이 아니라 학습 과정을 보는 구조임을 전달합니다.', icon: <Activity className="h-5 w-5" /> },
                { title: '관리와 소통 연결', body: '수납, 상담 요청, 리포트 확인까지 한 앱 흐름 안에서 이어져 학부모가 실제 관리 체계를 체감할 수 있습니다.', icon: <MessageCircle className="h-5 w-5" /> },
              ]}
            />
            <ExperienceDetailShell
              eyebrow="PARENT DETAIL PREVIEW"
              title="학부모 모드 기준 상담 문의"
              description="학부모 체험도 앱 안에서 어떤 흐름으로 정보를 읽고 해석하는지 더 자세히 볼 수 있게 나눴습니다. 관리 앱이라는 점이 숫자와 행동 흐름으로 바로 느껴지도록 구성했습니다."
            >
              <div className="flex flex-wrap gap-2">
                {[
                  ['alerts', '알림 읽기'],
                  ['calendar', '학습 캘린더'],
                  ['weekly', '주간 분석'],
                  ['billing', '수납 상태'],
                ].map(([key, label]) => (
                  <DetailTabButton
                    key={key}
                    label={label}
                    active={parentInsight === key}
                    onClick={() => setParentInsight(key as ParentInsight)}
                  />
                ))}
              </div>
              <div className="mt-5">
                <ParentInsightDetail insight={parentInsight} />
              </div>
            </ExperienceDetailShell>
          </ExperienceSection>
        ) : null}

        <section className="mt-10 rounded-[2rem] border border-[#14295F]/12 bg-[linear-gradient(145deg,#14295F_0%,#1B3B82_100%)] px-6 py-7 text-white shadow-[0_24px_60px_rgba(20,41,95,0.2)] sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-[#FFD3A7]">NEXT STEP</p>
              <h3 className="mt-2 text-3xl font-black tracking-tight">체험 다음에는 실제 데이터로 이어집니다</h3>
              <p className="mt-3 max-w-2xl break-keep text-sm font-bold leading-relaxed text-white/78">실제 계정으로 로그인하면 학생별 계획, 출결, 리포트, 알림, 수납, 상담 이력이 센터 데이터와 그대로 연결됩니다.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/login" className="inline-flex h-11 items-center justify-center rounded-full bg-[#FF7A16] px-5 text-sm font-black text-white shadow-[0_12px_24px_rgba(255,122,22,0.28)]">실제 로그인</Link>
              <Link href="/#consult" className="inline-flex h-11 items-center justify-center rounded-full border border-white/18 px-5 text-sm font-black text-white">상담 문의</Link>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ['학생 모드', '계획과 실행, 성장 그래프까지 한 흐름으로 관리'],
              ['학부모 모드', '앱모드 전용으로 알림, 캘린더, 수납 확인'],
              ['센터 운영 데이터', '실시간 대시보드와 연결되는 구조'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-2xl bg-white/10 px-4 py-4">
                <p className="text-sm font-black text-white">{title}</p>
                <p className="mt-1 text-[12px] font-bold text-white/72">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
