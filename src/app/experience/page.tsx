'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
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
  Trophy,
  Zap,
} from 'lucide-react';

import { cn } from '@/lib/utils';

type DemoMode = 'student' | 'parent';
type StudentView = 'desktop' | 'mobile';

function SelectorLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
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

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[376px] rounded-[2.7rem] border-[10px] border-[#132B63] bg-[linear-gradient(180deg,#eff4ff_0%,#ffffff_100%)] p-3 shadow-[0_34px_90px_rgba(20,41,95,0.24)]">
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
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#14295F]/12 bg-[#F6F8FD] text-[12px] font-black text-[#14295F]">
          {avatar}
        </div>
      </div>
    </div>
  );
}

function StudentBottomNav({ active = '홈' }: { active?: '홈' | '성장' | '기록' | '계획' | '상담' }) {
  const items = [
    { label: '홈', icon: LayoutDashboard },
    { label: '성장', icon: Zap },
    { label: '기록', icon: CalendarDays },
    { label: '계획', icon: ClipboardList },
    { label: '상담', icon: MessageCircle },
  ] as const;

  return (
    <div className="grid grid-cols-5 border-t border-[#223a71] bg-[linear-gradient(180deg,#14295F_0%,#0E1F49_100%)] px-2 pb-5 pt-3 text-white shadow-[0_-12px_24px_rgba(10,20,52,0.35)]">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.label === active;
        return (
          <div key={item.label} className="flex flex-col items-center justify-center gap-1">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl transition-all',
                isActive ? 'bg-[#FF7A16] text-[#14295F] shadow-[0_8px_14px_rgba(255,122,22,0.35)]' : 'bg-white/10 text-white/80'
              )}
            >
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

function ParentBottomNav({ active = '홈' }: { active?: '홈' | '학습' | '데이터' | '소통' | '수납' }) {
  const items = [
    { label: '홈', icon: LayoutDashboard },
    { label: '학습', icon: Clock3 },
    { label: '데이터', icon: FileText },
    { label: '소통', icon: MessageCircle },
    { label: '수납', icon: CreditCard },
  ] as const;

  return (
    <div className="grid grid-cols-5 border-t border-[#223a71] bg-[linear-gradient(180deg,#14295F_0%,#0E1F49_100%)] px-2 pb-5 pt-3 text-white">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.label === active;
        return (
          <div key={item.label} className="flex flex-col items-center justify-center gap-1">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl transition-all',
                isActive ? 'bg-[#FF7A16] text-[#14295F] shadow-[0_8px_14px_rgba(255,122,22,0.35)]' : 'bg-white/10 text-white/80'
              )}
            >
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

function MetricCard({
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
    <div className={cn('rounded-2xl border border-[#14295F]/8 p-4 shadow-sm', toneMap[tone])}>
      <p className="text-[11px] font-black tracking-tight opacity-70">{label}</p>
      <p className="mt-2 text-[1.7rem] font-black leading-none tracking-tight">{value}</p>
    </div>
  );
}

function MiniLineChart() {
  return (
    <div className="mt-4 rounded-[1.5rem] border border-[#14295F]/8 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-black tracking-[0.12em] text-[#14295F]/45">공부시간 추이</p>
          <p className="mt-1 text-lg font-black text-[#14295F]">최근 7일 학습 흐름</p>
        </div>
        <div className="rounded-full bg-[#F4F7FD] px-3 py-1 text-[11px] font-black text-[#14295F]/70">14일</div>
      </div>

      <div className="mt-5 grid h-[220px] grid-cols-7 gap-3">
        {[220, 18, 12, 140, 286, 80, 40].map((value, index) => (
          <div key={index} className="flex flex-col justify-end gap-2">
            <div className="relative flex-1 rounded-full bg-[#F4F7FD]">
              <div
                className="absolute inset-x-0 bottom-0 rounded-full bg-[linear-gradient(180deg,#FF9B55_0%,#FF7A16_100%)]"
                style={{ height: `${Math.max((value / 300) * 100, 6)}%` }}
              />
            </div>
            <span className="text-center text-[10px] font-black text-[#14295F]/45">{`3/${index + 6}`}</span>
          </div>
        ))}
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
              <span>건국대학교</span>
              <span>2학년</span>
              <span>연속 공부 4일</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {['상담 예약', '리포트 확인', '정보 수정'].map((item) => (
              <div
                key={item}
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#14295F]/10 bg-white px-5 text-sm font-black text-[#14295F] shadow-sm"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-4">
          <MetricCard label="평균공부시간" value="4시간 49분" />
          <MetricCard label="평균 공부 리듬" value="22점" tone="emerald" />
          <MetricCard label="계획 완수율" value="50%" tone="orange" />
          <MetricCard label="상담 진행도" value="0/0" tone="rose" />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 rounded-full bg-[#F4F6FA] p-1">
          {['학습 분석', '성장 기록', '계획/루틴'].map((item, index) => (
            <div
              key={item}
              className={cn(
                'flex h-11 items-center justify-center rounded-full text-sm font-black transition',
                index === 0 ? 'bg-white text-[#14295F] shadow-sm' : 'text-[#14295F]/46'
              )}
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 bg-[#FBFCFE] px-6 py-6 xl:grid-cols-[1.35fr_0.65fr]">
        <MiniLineChart />

        <div className="space-y-4">
          <div className="rounded-[1.5rem] border border-[#14295F]/8 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black tracking-[0.12em] text-[#14295F]/45">계획 완수율</p>
                <p className="mt-1 text-lg font-black text-[#14295F]">이번 주 실행 현황</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-[#FF7A16]" />
            </div>
            <div className="mt-5 space-y-3">
              {[
                ['월', 30],
                ['화', 92],
                ['수', 0],
                ['목', 0],
                ['금', 84],
                ['토', 46],
                ['일', 0],
              ].map(([label, value]) => (
                <div key={label as string} className="grid grid-cols-[28px_1fr_42px] items-center gap-3">
                  <span className="text-xs font-black text-[#14295F]/55">{label}</span>
                  <div className="h-3 rounded-full bg-[#EEF2F8]">
                    <div
                      className="h-3 rounded-full bg-[linear-gradient(90deg,#FFAE6D_0%,#FF7A16_100%)]"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  <span className="text-right text-xs font-black text-[#14295F]">{value}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[#14295F]/8 bg-[linear-gradient(135deg,#18C29C_0%,#16A07D_100%)] p-5 text-white shadow-[0_20px_32px_rgba(24,194,156,0.16)]">
            <p className="text-[11px] font-black tracking-[0.18em] text-white/75">MASTERY SNAPSHOT</p>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-black tracking-tight">LP 124</p>
                <p className="mt-1 text-sm font-black text-white/78">스킬 평균 98점</p>
              </div>
              <div className="rounded-full bg-white/18 px-4 py-2 text-xs font-black">상세 보기</div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[#14295F]/8 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#FF7A16]" />
            <p className="text-lg font-black text-[#14295F]">인지과학 코칭 포인트</p>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {[
              '최근 14일 평균 공부시간은 4시간 49분입니다.',
              '완수율이 낮아 계획 단위를 조금 더 작게 나눌 필요가 있습니다.',
              '학습 리듬 변동이 큽니다. 매일 같은 시작 시간을 고정하세요.',
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-[#F7FAFF] px-4 py-4 text-sm font-black leading-relaxed text-[#14295F]/82">
                {item}
              </div>
            ))}
          </div>
        </div>
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
            <div className="mt-2 inline-flex rounded-full bg-[#14295F] px-3 py-1 text-[10px] font-black text-white">
              학생
            </div>
          </div>

          <div className="rounded-[1.9rem] bg-[linear-gradient(145deg,#D85810_0%,#A83D0A_100%)] p-5 text-white shadow-[0_22px_34px_rgba(196,82,18,0.28)]">
            <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-white/85">
              성장 트랙 ACTIVE
            </div>
            <h3 className="mt-4 text-[2rem] font-black leading-tight tracking-tight">오늘의 성장을 위해 트랙을 시작하세요</h3>
            <div className="mt-5 grid gap-3">
              <div className="flex h-14 items-center justify-center rounded-2xl bg-white text-lg font-black text-[#14295F]">
                트랙 시작
              </div>
              <div className="flex h-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-sm font-black">
                나의 출입 QR
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="오늘의 누적 트랙" value="1h 36m" />
            <MetricCard label="시즌 리뷰 포인트" value="3,164 LP" tone="orange" />
          </div>

          <div className="rounded-[1.75rem] border border-[#14295F]/8 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[#14295F]/8 px-4 py-4">
              <div>
                <p className="text-[1.7rem] font-black leading-none tracking-tight text-[#14295F]">계획트랙</p>
                <p className="mt-1 text-[10px] font-black tracking-[0.18em] text-[#14295F]/45">STUDY MATRIX LOGIC</p>
              </div>
              <div className="rounded-full bg-[#F3F6FD] px-3 py-1 text-[11px] font-black text-[#14295F]">1 DONE</div>
            </div>
            <div className="space-y-3 px-4 py-4">
              <div>
                <p className="text-[11px] font-black text-[#14295F]/55">오늘의 목표</p>
                <p className="mt-1 text-sm font-black text-[#14295F]">2026-03-12</p>
              </div>
              <div className="rounded-2xl border border-[#14295F]/8 bg-[#FAFCFF] px-4 py-4 text-sm font-black text-[#14295F]">
                국어영역 완료
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {[
              ['선생님 리포트', 'TEACHER REPORTS'],
              ['지각/결석 신청', 'QUICK REQUESTS'],
              ['벌점 현황', 'GROWTH GUARD'],
            ].map(([title, subtitle]) => (
              <div
                key={title}
                className="flex items-center justify-between rounded-[1.6rem] border border-[#14295F]/8 bg-white px-4 py-4 shadow-sm"
              >
                <div>
                  <p className="text-base font-black tracking-tight text-[#14295F]">{title}</p>
                  <p className="mt-1 text-[10px] font-black tracking-[0.16em] text-[#14295F]/42">{subtitle}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-[#14295F]/40" />
              </div>
            ))}
          </div>
        </div>

        <StudentBottomNav active="홈" />
      </div>
    </PhoneFrame>
  );
}

function CalendarHeatCell({
  day,
  minutes,
  active = false,
}: {
  day: string;
  minutes: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-[1.1rem] border p-2 shadow-sm',
        active ? 'border-[#FFB571] bg-[linear-gradient(180deg,#FFF8EE_0%,#FFFFFF_100%)]' : 'border-[#14295F]/6 bg-white'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-[#14295F]/48">{day}</span>
        {active && <div className="h-2 w-2 rounded-full bg-[#FF7A16]" />}
      </div>
      <p className="mt-3 text-sm font-black tracking-tight text-[#14295F]">{minutes}</p>
    </div>
  );
}

function ParentMobileDemo() {
  return (
    <PhoneFrame>
      <div className="flex h-full flex-col bg-[linear-gradient(180deg,#fff7f0_0%,#ffffff_24%,#f7faff_100%)]">
        <AppHeader avatar="학" />

        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4 pt-5">
          <div>
            <p className="text-[1.65rem] font-black leading-none tracking-tight text-[#14295F]">학부모 학부모님</p>
            <div className="mt-2 inline-flex rounded-full bg-[#14295F] px-3 py-1 text-[10px] font-black text-white">
              학부모
            </div>
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
              <MetricCard label="주간 누적 몰입" value="14시간 23분" />
              <MetricCard label="평균 목표 달성" value="50%" tone="orange" />
              <MetricCard label="결제 상태" value="완납" tone="emerald" />
              <MetricCard label="벌점 지수" value="5점" tone="rose" />
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-[#14295F]/8 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[1.55rem] font-black leading-none tracking-tight text-[#14295F]">최근 알림 3개</p>
                <p className="mt-2 text-[11px] font-black text-[#14295F]/55">제목만 노출되고, 눌러야 상세 내용을 볼 수 있습니다.</p>
              </div>
              <div className="rounded-full bg-[#FFF4EB] px-2.5 py-1 text-[11px] font-black text-[#C46C17]">미읽음 2</div>
            </div>

            <div className="mt-4 space-y-3">
              {[
                ['출결 상태 업데이트', true],
                ['생활 기록 알림', true],
                ['학습 리포트 도착', false],
              ].map(([title, unread]) => (
                <div
                  key={title}
                  className={cn(
                    'rounded-2xl border px-4 py-4 shadow-sm',
                    unread ? 'border-[#FFB46A] bg-[#FFF9F3]' : 'border-[#14295F]/8 bg-[#F8FBFF]'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-[#14295F]">{title}</p>
                    {unread ? <div className="h-2.5 w-2.5 rounded-full bg-[#FF7A16] shadow-[0_0_14px_rgba(255,122,22,0.75)]" /> : null}
                  </div>
                  <p className="mt-1 text-[11px] font-black text-[#14295F]/45">제목을 누르면 읽음 처리와 함께 상세 팝업이 열립니다.</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-[#14295F]/8 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[1.55rem] font-black leading-none tracking-tight text-[#14295F]">기록트랙</p>
                <p className="mt-1 text-[10px] font-black tracking-[0.18em] text-[#14295F]/42">STUDY CONSISTENCY MAP</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-[#F4F7FD] px-3 py-2 text-[11px] font-black text-[#14295F]">
                <ChevronLeft className="h-3.5 w-3.5" />
                2026년 3월
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[9px] font-black uppercase tracking-[0.16em] text-[#14295F]/38">
              {['MON', 'TUE', 'WED', 'THU'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              <CalendarHeatCell day="3/2" minutes="8:25" />
              <CalendarHeatCell day="3/3" minutes="4:23" />
              <CalendarHeatCell day="3/4" minutes="2:46" />
              <CalendarHeatCell day="3/5" minutes="1:36" active />
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-[#14295F]/8 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#14295F]">
              <CreditCard className="h-4.5 w-4.5 text-[#FF7A16]" />
              <p className="text-[1.55rem] font-black leading-none tracking-tight">수납</p>
            </div>
            <p className="mt-3 break-keep text-[13px] font-black leading-relaxed text-[#14295F]/72">
              센터 수납 요청건을 비대면으로
              <br />
              결제할 수 있어요!
            </p>
            <div className="mt-4 rounded-2xl border border-[#14295F]/8 bg-[#F8FBFF] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black text-[#14295F]/55">청구금액</p>
                  <p className="mt-2 text-[1.95rem] font-black tracking-tight text-[#14295F]">₩50,000</p>
                </div>
                <div className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-700">완납</div>
              </div>
            </div>
          </div>
        </div>

        <ParentBottomNav active="홈" />
      </div>
    </PhoneFrame>
  );
}

export default function ExperiencePage() {
  const searchParams = useSearchParams();
  const mode = (searchParams.get('mode') as DemoMode | null) ?? null;
  const studentView = (searchParams.get('view') as StudentView | null) ?? 'desktop';

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#F5F8FF_0%,#FFFFFF_100%)] text-[#14295F]">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[#14295F]/12 bg-white px-4 py-2 text-sm font-black text-[#14295F] shadow-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            홍보 페이지로 돌아가기
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-[#FF7A16] px-4 py-2 text-sm font-black text-white shadow-[0_12px_24px_rgba(255,122,22,0.28)]"
          >
            실제 로그인
          </Link>
        </div>

        <section className="mt-8 overflow-hidden rounded-[2.25rem] border border-[#14295F]/10 bg-white shadow-[0_26px_80px_rgba(20,41,95,0.12)]">
          <div className="relative px-6 py-8 sm:px-8 sm:py-9">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(20,41,95,0.06),transparent_24%),radial-gradient(circle_at_88%_12%,rgba(255,122,22,0.14),transparent_24%),linear-gradient(135deg,transparent_0%,transparent_46%,rgba(20,41,95,0.03)_46%,rgba(20,41,95,0.03)_47%,transparent_47%)]" />
            <div className="relative">
              <p className="text-xs font-black tracking-[0.22em] text-[#FF7A16]">TRACK EXPERIENCE</p>
              <h1 className="mt-3 max-w-4xl break-keep text-4xl font-black leading-tight tracking-tight text-[#14295F] sm:text-5xl">
                실제 앱과 비슷한 흐름으로 먼저 체험해보세요
              </h1>
              <p className="mt-4 max-w-3xl break-keep text-sm font-bold leading-relaxed text-slate-600 sm:text-[15px]">
                학생 모드는 웹모드와 앱모드를 모두 볼 수 있고, 학부모 모드는 실제 운영 방식과 동일하게 앱모드 전용으로만 제공합니다.
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
              <div className="flex items-center gap-3">
                <LayoutDashboard className="h-5 w-5 text-[#FF7A16]" />
                <p className="text-2xl font-black tracking-tight text-[#14295F]">학생 모드 체험</p>
              </div>
              <p className="mt-3 break-keep text-sm font-bold leading-relaxed text-slate-600">
                오늘의 트랙, 성장 지표, 계획트랙, 기록트랙까지 학생이 실제로 보게 되는 흐름을 웹모드와 앱모드 둘 다 미리 확인할 수 있습니다.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <SelectorLink href="/experience?mode=student&view=desktop" label="학생 웹모드 보기" />
                <SelectorLink href="/experience?mode=student&view=mobile" label="학생 앱모드 보기" />
              </div>
            </article>

            <article className="rounded-[1.9rem] border border-[#14295F]/10 bg-white p-6 shadow-[0_16px_40px_rgba(20,41,95,0.1)]">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-[#FF7A16]" />
                <p className="text-2xl font-black tracking-tight text-[#14295F]">학부모 모드 체험</p>
              </div>
              <p className="mt-3 break-keep text-sm font-bold leading-relaxed text-slate-600">
                학부모 모드는 실제 서비스와 동일하게 앱모드로만 운영됩니다. 출결, 학습, 알림, 수납 흐름을 모바일 감각으로 확인할 수 있습니다.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <SelectorLink href="/experience?mode=parent" label="학부모 앱모드 보기" />
              </div>
            </article>
          </section>
        ) : null}

        {mode === 'student' ? (
          <ExperienceSection
            eyebrow="STUDENT EXPERIENCE"
            title="학생 모드 체험"
            description="학생 모드는 목표 설정, 실행 체크, 성장 데이터, 계획 루틴이 한 흐름으로 이어지도록 구성되어 있습니다."
            extra={
              <div className="flex gap-2">
                <SelectorLink href="/experience?mode=student&view=desktop" label="웹모드" active={studentView === 'desktop'} />
                <SelectorLink href="/experience?mode=student&view=mobile" label="앱모드" active={studentView === 'mobile'} />
              </div>
            }
          >
            {studentView === 'desktop' ? <StudentDesktopDemo /> : <StudentMobileDemo />}
          </ExperienceSection>
        ) : null}

        {mode === 'parent' ? (
          <ExperienceSection
            eyebrow="PARENT EXPERIENCE"
            title="학부모 모드 체험"
            description="학부모 모드는 앱모드 전용입니다. 제목 중심 알림, 학습 캘린더, 수납, 학생 현황을 한눈에 보고 필요한 순간에 상세 내용을 확인하는 구조로 운영됩니다."
            extra={
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF4EB] px-4 py-2 text-sm font-black text-[#B85A00]">
                <Smartphone className="h-4 w-4" />
                앱모드 전용
              </div>
            }
          >
            <div className="rounded-[1.9rem] border border-[#14295F]/10 bg-white p-6 shadow-[0_16px_40px_rgba(20,41,95,0.1)]">
              <ParentMobileDemo />
            </div>
          </ExperienceSection>
        ) : null}

        <section className="mt-10 rounded-[2rem] border border-[#14295F]/12 bg-[linear-gradient(145deg,#14295F_0%,#1B3B82_100%)] px-6 py-7 text-white shadow-[0_24px_60px_rgba(20,41,95,0.2)] sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-[#FFD3A7]">NEXT STEP</p>
              <h3 className="mt-2 text-3xl font-black tracking-tight">체험 뒤에는 실제 데이터로 이어집니다</h3>
              <p className="mt-3 max-w-2xl break-keep text-sm font-bold leading-relaxed text-white/78">
                실제 계정으로 로그인하면 학생별 데이터, 알림, 수납, 리포트, 계획 루틴이 센터 운영 데이터와 바로 연결됩니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#FF7A16] px-5 text-sm font-black text-white shadow-[0_12px_24px_rgba(255,122,22,0.28)]"
              >
                실제 로그인
              </Link>
              <Link
                href="/#consult"
                className="inline-flex h-11 items-center justify-center rounded-full border border-white/18 px-5 text-sm font-black text-white"
              >
                상담 문의
              </Link>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ['학생 모드', '계획 → 실행 → 성장 데이터'],
              ['학부모 모드', '앱모드 전용 · 제목 알림 기반 확인'],
              ['관리 흐름', '센터 운영 데이터와 실시간 연동'],
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
