'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  PanelLeft,
  LogOut,
  Smartphone,
  Monitor,
  Settings,
  HelpCircle,
  BookOpen,
  CalendarDays,
  MessageCircle,
  School,
  Loader2,
  Sparkles,
  Phone,
  Play,
  Square,
  Gift,
  Trophy,
  ShieldAlert,
  FileText,
  CreditCard,
  History,
  Target,
  BellRing,
  Lightbulb,
  ChevronRight,
  Wifi,
  Flame,
  CheckCircle2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { MainNav } from './main-nav';
import { NotificationBell } from './notification-bell';
import { useAppContext } from '@/contexts/app-context';
import { useAuth, useDoc, useFirestore, useFunctions, useMemoFirebase, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import {
  DASHBOARD_POST_LOGIN_ENTRY_MAX_AGE_MS,
  PARENT_POST_LOGIN_ENTRY_MOTION_KEY,
} from '@/lib/dashboard-motion';
import { cn } from '@/lib/utils';
import { logHandledClientIssue } from '@/lib/handled-client-log';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useToast } from '@/hooks/use-toast';
import { CenterMembership, StudentProfile, User as UserType } from '@/lib/types';
import {
  getManualToneClass,
  STUDENT_MANUAL_FIRST_DAY_FLOW,
  STUDENT_MANUAL_OPERATION_HIGHLIGHTS,
  STUDENT_MANUAL_PENALTY_RULE_ROWS,
  STUDENT_MANUAL_PRO_TIPS,
  STUDENT_MANUAL_RULE_SECTIONS,
  STUDENT_PENALTY_STAGE_RULES,
  type StudentManualHighlight,
  type StudentManualRuleSection,
  type StudentPenaltyRuleRow,
} from '@/lib/student-manual';
import {
  PARENT_MANUAL_DASHBOARD_SECTIONS,
  PARENT_MANUAL_FIRST_DAY_FLOW,
  PARENT_MANUAL_OPERATION_HIGHLIGHTS,
  PARENT_MANUAL_PRO_TIPS,
} from '@/lib/parent-manual';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { clearServerAuthSession } from '@/lib/client-auth-session';

function Pill({ children, tone = 'navy' }: { children: ReactNode; tone?: 'navy' | 'orange' | 'amber' | 'rose' }) {
  const toneClass =
    tone === 'orange'
      ? 'bg-[#FFE5CC] text-[#B44A00] border-[#FFD0A3]'
      : tone === 'amber'
        ? 'bg-[#FEF3E0] text-[#9A5A00] border-[#F7D8A3]'
        : tone === 'rose'
          ? 'bg-[#FFE3EA] text-[#B02344] border-[#FBC4D1]'
          : 'bg-[#E7ECF7] text-[#17326B] border-[#C8D4EC]';
  return (
    <span className={cn('inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-black whitespace-nowrap align-baseline', toneClass)}>
      {children}
    </span>
  );
}

function GuideStep({ icon, title, body }: { icon: ReactNode; title: string; body: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-[0_4px_10px_-6px_rgba(10,28,72,0.2)]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-black tracking-tight text-[#17326B] break-keep">{title}</p>
        <p className="mt-1 text-[11.5px] font-semibold leading-5 text-[#49597A] break-keep">{body}</p>
      </div>
    </div>
  );
}

function GuideTip({ children, tone = 'orange' }: { children: ReactNode; tone?: 'orange' | 'amber' }) {
  const toneClass =
    tone === 'amber'
      ? 'border-[#F7D8A3] bg-[#FEF3E0] text-[#9A5A00]'
      : 'border-[#FFD0A3] bg-[#FFF4E8] text-[#B44A00]';
  return (
    <div className={cn('mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5', toneClass)}>
      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p className="text-[11px] font-bold leading-5 break-keep">{children}</p>
    </div>
  );
}

function GuideSection({
  step,
  title,
  icon,
  accentColor,
  tintColor,
  children,
}: {
  step: number;
  title: string;
  icon: ReactNode;
  accentColor: string;
  tintColor: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-34px_rgba(10,28,72,0.22)]">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_10px_22px_-14px_rgba(10,28,72,0.5)]"
          style={{ backgroundColor: accentColor }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[9.5px] font-black uppercase tracking-[0.22em]" style={{ color: accentColor }}>
            STEP {String(step).padStart(2, '0')}
          </p>
          <h4 className="font-black tracking-tight text-[#17326B] text-[15px] break-keep">{title}</h4>
        </div>
      </div>
      <div className="mt-4 rounded-2xl p-4 space-y-3.5" style={{ backgroundColor: tintColor }}>
        {children}
      </div>
    </section>
  );
}

function ManualHighlightCard({
  title,
  description,
  tone,
  badgeLabel = '핵심 규칙',
}: StudentManualHighlight & { badgeLabel?: string }) {
  const toneClass = getManualToneClass(tone);

  return (
    <div className={cn('rounded-[1.4rem] border px-4 py-4 shadow-[0_16px_32px_-28px_rgba(10,28,72,0.28)]', toneClass.surface)}>
      <div className={cn('inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]', toneClass.badge)}>
        {badgeLabel}
      </div>
      <p className="mt-3 text-[13px] font-black leading-5 text-[#17326B] break-keep">{title}</p>
      <p className="mt-2 text-[11.5px] font-semibold leading-5 text-[#5A6F95] break-keep">{description}</p>
    </div>
  );
}

function ManualRulePanel({
  eyebrow,
  title,
  description,
  items,
  tone,
  badgeLabel = '생활규정',
}: StudentManualRuleSection & { badgeLabel?: string }) {
  const toneClass = getManualToneClass(tone);

  return (
    <div className={cn('rounded-[1.6rem] border px-4 py-4 shadow-[0_18px_36px_-30px_rgba(10,28,72,0.18)]', toneClass.surface)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6781AE]">{eyebrow}</p>
          <p className="mt-1 text-[14px] font-black tracking-tight text-[#17326B] break-keep">{title}</p>
        </div>
        <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black', toneClass.badge)}>
          {badgeLabel}
        </span>
      </div>
      <p className="mt-2 text-[11.5px] font-semibold leading-5 text-[#5A6F95] break-keep">{description}</p>
      <div className="mt-3 space-y-2.5">
        {items.map((item) => (
          <div key={`${eyebrow}-${item}`} className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#FF7A16]" />
            <p className="text-[11.5px] font-semibold leading-5 text-[#17326B] break-keep">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PenaltyRuleRow({
  category,
  pointsLabel,
  detail,
  tone,
}: StudentPenaltyRuleRow) {
  const toneClass = getManualToneClass(tone);

  return (
    <div className="grid grid-cols-[minmax(0,1.2fr)_auto] gap-3 rounded-[1.25rem] border border-[#DFE7F6] bg-white px-4 py-3 shadow-[0_16px_32px_-30px_rgba(10,28,72,0.18)]">
      <div className="min-w-0">
        <p className="text-[12.5px] font-black text-[#17326B] break-keep">{category}</p>
        <p className="mt-1 text-[11px] font-semibold leading-5 text-[#5A6F95] break-keep">{detail}</p>
      </div>
      <div className="flex items-start justify-end">
        <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-black whitespace-nowrap', toneClass.badge)}>
          {pointsLabel}
        </span>
      </div>
    </div>
  );
}

function ManualPenaltySection({
  isMobileView,
  intro,
  note,
}: {
  isMobileView: boolean;
  intro: string;
  note: string;
}) {
  return (
    <section className="rounded-[1.75rem] border border-[#F5C7D4] bg-[linear-gradient(180deg,#FFF6F8_0%,#FFF0F4_100%)] p-5 shadow-[0_18px_40px_-32px_rgba(170,34,88,0.16)]">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-[#C13D68]" />
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#C13D68]">벌점 운영표</p>
      </div>
      <p className="mt-2 text-[12px] font-semibold leading-5 text-[#6F4960] break-keep">{intro}</p>

      <div className="mt-4 space-y-2.5">
        {STUDENT_MANUAL_PENALTY_RULE_ROWS.map((row) => (
          <PenaltyRuleRow
            key={row.key}
            category={row.category}
            pointsLabel={row.pointsLabel}
            detail={row.detail}
            tone={row.tone}
          />
        ))}
      </div>

      <div className={cn('mt-4 grid gap-2', isMobileView ? 'grid-cols-1' : 'grid-cols-3')}>
        {STUDENT_PENALTY_STAGE_RULES.map((rule) => {
          const toneClass = getManualToneClass(rule.tone);
          return (
            <div key={rule.key} className={cn('rounded-[1.25rem] border px-4 py-3', toneClass.surface)}>
              <p className={cn('inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black', toneClass.badge)}>
                {rule.threshold}
              </p>
              <p className="mt-2 text-[12px] font-black leading-5 text-[#17326B] break-keep">{rule.action}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-[1.25rem] border border-[#F1B7C8] bg-white/80 px-4 py-3">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#C13D68]">중요</p>
        <p className="mt-1 text-[11.5px] font-semibold leading-5 text-[#6F4960] break-keep">{note}</p>
      </div>
    </section>
  );
}

function ManualTipsSection({
  eyebrow = 'PRO TIPS',
  tips,
}: {
  eyebrow?: string;
  tips: string[];
}) {
  return (
    <section className="rounded-[1.75rem] border border-[#D9E1F2] bg-white p-5 shadow-[0_18px_40px_-32px_rgba(10,28,72,0.18)]">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-[#FF7A16]" />
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#6781AE]">{eyebrow}</p>
      </div>
      <div className="mt-3 space-y-2.5">
        {tips.map((tip) => (
          <div key={tip} className="flex items-start gap-2">
            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF7A16]" />
            <p className="text-[12px] font-semibold leading-5 text-[#17326B] break-keep">{tip}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StudentSupportManualBody({ isMobileView }: { isMobileView: boolean }) {
  return (
    <>
      <section className="rounded-[1.9rem] border border-[#FFD7B0] bg-[linear-gradient(160deg,#FFF4E6_0%,#FFE6D0_45%,#FFF1E8_100%)] p-5 shadow-[0_24px_48px_-36px_rgba(239,97,0,0.42)]">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FF7A16] text-white shadow-[0_14px_28px_-14px_rgba(239,97,0,0.62)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#B44A00]">FIRST DAY FLOW</p>
            <p className="mt-1.5 text-[15px] font-black leading-6 text-[#17326B] break-keep">
              처음 오면 이것부터: <span className="text-[#FF7A16]">홈 확인</span> → <span className="text-[#FF7A16]">휴대폰 반납</span> → <span className="text-[#FF7A16]">계획 확인</span> → <span className="text-[#FF7A16]">키오스크 시작</span>
            </p>
            <p className="mt-2 text-[11.5px] font-semibold leading-5 text-[#5A6F95] break-keep">
              트랙은 도착 직후의 5분이 하루 분위기를 결정해요. 아래 안내는 학생이 실제로 쓰는 <span className="font-black text-[#17326B]">홈 · 포인트 · 기록 · 계획 · 상담</span> 메뉴 순서에 맞춰 정리했어요. 한 번만 읽어도 설명 없이 바로 적응할 수 있게 구성했어요.
            </p>
          </div>
        </div>

        <div className={cn('mt-4 grid gap-3', isMobileView ? 'grid-cols-1' : 'grid-cols-2')}>
          {STUDENT_MANUAL_FIRST_DAY_FLOW.map((item) => (
            <ManualHighlightCard
              key={item.key}
              title={item.title}
              description={item.description}
              tone={item.tone}
            />
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-[#DCE5F5] bg-white p-5 shadow-[0_20px_42px_-34px_rgba(10,28,72,0.16)]">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#17326B]" />
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#6781AE]">운영 원칙</p>
        </div>
        <p className="mt-2 text-[12px] font-semibold leading-5 text-[#5A6F95] break-keep">
          우리 센터는 몰입 유지가 최우선이에요. 휴대폰, 태블릿, 와이파이, 생활 태도를 전부 같은 기준으로 관리합니다.
        </p>
        <div className={cn('mt-4 grid gap-3', isMobileView ? 'grid-cols-1' : 'grid-cols-2')}>
          {STUDENT_MANUAL_OPERATION_HIGHLIGHTS.map((item) => (
            <ManualHighlightCard
              key={item.key}
              title={item.title}
              description={item.description}
              tone={item.tone}
            />
          ))}
        </div>
      </section>

      <GuideSection
        step={1}
        title="입실 후 5분 루틴"
        icon={<Play className="h-5 w-5" />}
        accentColor="#2554D7"
        tintColor="#EAF0FC"
      >
        <GuideStep
          icon={<BookOpen className="h-4 w-4 text-[#2554D7]" />}
          title="홈에서 오늘 상태 먼저 보기"
          body={<>하단 <Pill>홈</Pill>에서 오늘 목표 시간, 포인트 변화, 열릴 상자, 읽지 않은 리포트나 알림이 있는지 먼저 확인하세요. 오늘 공부 흐름을 한눈에 잡는 화면이에요.</>}
        />
        <GuideStep
          icon={<Smartphone className="h-4 w-4 text-[#2554D7]" />}
          title="도착 즉시 휴대폰 반납"
          body={<>센터에 도착하면 <Pill tone="rose">전원 OFF 후 반납</Pill>이 먼저예요. 가방에 계속 소지하고 있으면 바로 지도 대상이 됩니다.</>}
        />
        <GuideStep
          icon={<CalendarDays className="h-4 w-4 text-[#2554D7]" />}
          title="계획에서 오늘 할 일 순서 고정"
          body={<>하단 <Pill>계획</Pill>에서 오늘 과목, 순서, 목표 분량, 예상 시간을 먼저 보고 어느 공부부터 시작할지 정하세요. 계획이 비어 있으면 템플릿이나 전날 계획 복사로 바로 만들 수 있어요.</>}
        />
        <GuideStep
          icon={<Play className="h-4 w-4 text-[#2554D7]" />}
          title="착석 후 키오스크로 시작 처리"
          body={<>공부 시작은 학생 앱 버튼이 아니라 <Pill>준비된 키오스크</Pill>에서 진행해요. 시작 처리가 끝나야 실제 공부 시간, 리포트, 포인트 흐름이 정확하게 쌓여요.</>}
        />
        <GuideTip tone="amber">
          선생님들이 계속 순회하며 휴대폰, 무단이석, 잡담, 태블릿 사용 상태를 확인해요. 화장실이나 상담처럼 잠깐 자리 비울 때도 먼저 종료 또는 안내를 받는 습관이 가장 중요해요.
        </GuideTip>
      </GuideSection>

      <GuideSection
        step={2}
        title="러닝 시스템 핵심 화면"
        icon={<Gift className="h-5 w-5" />}
        accentColor="#FF7A16"
        tintColor="#FFF0DE"
      >
        <GuideStep
          icon={<BookOpen className="h-4 w-4 text-[#FF7A16]" />}
          title="홈은 오늘 상황판"
          body={<>하단 <Pill>홈</Pill>에서는 오늘 공부 시간, 남은 목표, 열 수 있는 상자, 새 리포트, 주요 알림을 바로 볼 수 있어요. 오늘 센터 생활을 여는 기본 화면이라고 생각하면 돼요.</>}
        />
        <GuideStep
          icon={<Target className="h-4 w-4 text-[#FF7A16]" />}
          title="계획은 실행용 화면"
          body={<>하단 <Pill>계획</Pill>에서 오늘 할 일을 추가하고, 끝난 공부는 완료 체크로 남겨요. 완료 기록은 다음 추천과 분석의 기준이 되고, 계획 완수 포인트도 이 흐름에서 적립돼요.</>}
        />
        <GuideStep
          icon={<Trophy className="h-4 w-4 text-[#FF7A16]" />}
          title="포인트는 보상 확인용 화면"
          body={<>하단 <Pill tone="orange">포인트</Pill>에서는 공부 시간으로 쌓인 포인트, 리워드 상자, 랭킹 보상 흐름을 확인해요. 상자는 열릴 때 바로 확인하고, 포인트 내역은 날짜별로 복기할 수 있어요.</>}
        />
        <GuideStep
          icon={<History className="h-4 w-4 text-[#FF7A16]" />}
          title="기록은 복기용 화면"
          body={<>하단 <Pill>기록</Pill>에서는 세션 히스토리, 일자별 공부 시간, 주간 흐름, 완료 기록을 다시 볼 수 있어요. 오늘 공부가 실제로 어떻게 흘렀는지 확인하는 화면이에요.</>}
        />
        <GuideTip>
          홈에서 상태를 보고, 계획에서 실행하고, 기록에서 복기하고, 포인트에서 보상을 확인한다고 생각하면 러닝 시스템이 가장 쉽게 정리돼요.
        </GuideTip>
      </GuideSection>

      <GuideSection
        step={3}
        title="공부 중 꼭 하는 행동"
        icon={<History className="h-5 w-5" />}
        accentColor="#17326B"
        tintColor="#E7ECF7"
      >
        <GuideStep
          icon={<Target className="h-4 w-4 text-[#17326B]" />}
          title="끝난 공부는 바로 완료 기록"
          body={<>공부가 끝났으면 미루지 말고 <Pill>계획</Pill>에서 바로 완료 체크를 남기세요. 완수율과 걸린 시간을 같이 적어두면 다음 계획 추천과 리포트가 훨씬 정확해져요.</>}
        />
        <GuideStep
          icon={<Square className="h-4 w-4 text-[#17326B]" />}
          title="자리 비울 때는 종료 먼저"
          body={<>화장실, 상담, 잠깐 이석도 먼저 <Pill tone="orange">공부 종료하기</Pill>를 눌러요. 타이머를 켠 채 자리를 비우면 기록과 분위기 둘 다 어긋나요.</>}
        />
        <GuideStep
          icon={<MessageCircle className="h-4 w-4 text-[#17326B]" />}
          title="막히면 앱으로 바로 요청"
          body={<>진로, 학습, 생활 상담은 <Pill>상담</Pill>에서, 학습 사이트 요청은 <Pill tone="amber">와이파이 요청</Pill>에서 남겨요. 혼자 해결하려고 우회하기보다 공식 요청을 남기는 게 원칙이에요.</>}
        />
        <GuideTip tone="amber">
          러닝 시스템은 “지금 상태를 정확히 남기는 학생”에게 가장 유리해요. 시작, 종료, 완료 기록만 정확해도 피드백 품질이 눈에 띄게 좋아져요.
        </GuideTip>
      </GuideSection>

      <GuideSection
        step={4}
        title="기기 규정 & 와이파이"
        icon={<Wifi className="h-5 w-5" />}
        accentColor="#D97706"
        tintColor="#FEF3E0"
      >
        <GuideStep
          icon={<Monitor className="h-4 w-4 text-[#D97706]" />}
          title="태블릿·노트북은 학습용만"
          body={<>태블릿은 인강, PDF, 문제풀이 같은 학습 목적으로만 가능해요. 게임, SNS, 비학습 영상은 바로 규정 위반으로 봐요.</>}
        />
        <GuideStep
          icon={<Wifi className="h-4 w-4 text-[#D97706]" />}
          title="와이파이는 기본 차단"
          body={<>센터 와이파이에는 방화벽이 걸려 있어요. 필요한 사이트는 요청 후 화이트리스트로 열 수 있고, 우회 시도는 중대 위반이에요.</>}
        />
        <GuideStep
          icon={<BellRing className="h-4 w-4 text-[#D97706]" />}
          title="이어폰은 필수"
          body={<>인강은 반드시 이어폰으로만 듣고, 소리가 새지 않게 해야 해요. 주변 학생 집중을 깨면 바로 지도 대상이에요.</>}
        />
        <GuideStep
          icon={<MessageCircle className="h-4 w-4 text-[#D97706]" />}
          title="요청은 URL과 이유를 함께"
          body={<>학습에 필요한 사이트가 막혀 있으면 사이트 주소와 필요한 이유를 같이 적어 요청하세요. 그래야 더 빠르게 승인되고 같은 실수가 반복되지 않아요.</>}
        />
        <GuideTip tone="amber">
          차단된 사이트가 필요하면 URL과 이유를 적어 바로 요청하세요. “잠깐이니까” 하며 우회하는 행동이 가장 크게 누적됩니다.
        </GuideTip>
      </GuideSection>

      <GuideSection
        step={5}
        title="하루 마감 루틴"
        icon={<CheckCircle2 className="h-5 w-5" />}
        accentColor="#0F8A5B"
        tintColor="#E8F8F0"
      >
        <GuideStep
          icon={<Square className="h-4 w-4 text-[#0F8A5B]" />}
          title="마지막 공부 종료 처리"
          body={<>집중이 끝났으면 종료 기록부터 정확히 남겨요. 종료가 안 되어 있으면 실제 공부 시간과 앱 기록이 계속 어긋날 수 있어요.</>}
        />
        <GuideStep
          icon={<History className="h-4 w-4 text-[#0F8A5B]" />}
          title="기록과 포인트를 짧게 복기"
          body={<>하단 <Pill>기록</Pill>과 <Pill tone="orange">포인트</Pill>에서 오늘 시간이 맞게 쌓였는지, 완료 체크가 빠진 과목은 없는지 1분만 확인하세요.</>}
        />
        <GuideStep
          icon={<CalendarDays className="h-4 w-4 text-[#0F8A5B]" />}
          title="내일 계획의 첫 과목만 정해두기"
          body={<>하루를 마칠 때 내일 가장 먼저 할 과목 하나만 정해두면 다음날 시작 속도가 훨씬 빨라져요. 완벽하게 다 짜기보다 첫 진입만 만들어 두면 돼요.</>}
        />
        <GuideTip>
          잘하는 학생일수록 마감 루틴이 짧고 정확해요. 종료, 복기, 내일 첫 과목 설정 이 세 가지만 해도 적응 속도가 크게 달라져요.
        </GuideTip>
      </GuideSection>

      <section className="rounded-[1.75rem] border border-[#D9E1F2] bg-white p-5 shadow-[0_18px_40px_-32px_rgba(10,28,72,0.18)]">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#17326B]" />
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#6781AE]">생활규정</p>
        </div>
        <p className="mt-2 text-[12px] font-semibold leading-5 text-[#5A6F95] break-keep">
          아래 규정은 공부를 편하게 하려고 만든 권장사항이 아니라, 센터 안에서 반드시 지켜야 하는 운영 기준이에요.
        </p>
        <div className={cn('mt-4 grid gap-3', isMobileView ? 'grid-cols-1' : 'grid-cols-2')}>
          {STUDENT_MANUAL_RULE_SECTIONS.map((section) => (
            <ManualRulePanel
              key={section.key}
              eyebrow={section.eyebrow}
              title={section.title}
              description={section.description}
              items={section.items}
              tone={section.tone}
            />
          ))}
        </div>
      </section>

      <ManualPenaltySection
        isMobileView={isMobileView}
        intro="기본 벌점 기준이에요. 반복, 은폐, 반항, 타인 피해가 겹치면 같은 항목도 더 강하게 반영될 수 있어요."
        note="심각한 경우에는 누적 점수와 무관하게 즉시 귀가 조치, 보호자 통보, 퇴원 검토가 진행될 수 있어요."
      />

      <ManualTipsSection tips={STUDENT_MANUAL_PRO_TIPS} />
    </>
  );
}

function ParentSupportManualBody({ isMobileView }: { isMobileView: boolean }) {
  return (
    <>
      <section className="rounded-[1.9rem] border border-[#FFD7B0] bg-[linear-gradient(160deg,#FFF4E6_0%,#FFE6D0_45%,#FFF1E8_100%)] p-5 shadow-[0_24px_48px_-36px_rgba(239,97,0,0.42)]">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FF7A16] text-white shadow-[0_14px_28px_-14px_rgba(239,97,0,0.62)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#B44A00]">PARENT START GUIDE</p>
            <p className="mt-1.5 text-[15px] font-black leading-6 text-[#17326B] break-keep">
              처음 들어오면 이것부터: <span className="text-[#FF7A16]">자녀 선택</span> → <span className="text-[#FF7A16]">홈 탭 확인</span> → <span className="text-[#FF7A16]">중요 알림 확인</span>
            </p>
            <p className="mt-2 text-[11.5px] font-semibold leading-5 text-[#5A6F95] break-keep">
              학부모 화면은 오늘 흐름, 리포트, 상담, 수납, 생활규정 확인이 한 번에 이어지도록 설계돼 있어요. 아래 순서대로 한 번만 읽어두시면 필요한 대응을 훨씬 빠르게 하실 수 있어요.
            </p>
          </div>
        </div>

        <div className={cn('mt-4 grid gap-3', isMobileView ? 'grid-cols-1' : 'grid-cols-2')}>
          {PARENT_MANUAL_FIRST_DAY_FLOW.map((item) => (
            <ManualHighlightCard
              key={item.key}
              title={item.title}
              description={item.description}
              tone={item.tone}
              badgeLabel="빠른 확인"
            />
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-[#DCE5F5] bg-white p-5 shadow-[0_20px_42px_-34px_rgba(10,28,72,0.16)]">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#17326B]" />
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#6781AE]">센터 운영 원칙</p>
        </div>
        <p className="mt-2 text-[12px] font-semibold leading-5 text-[#5A6F95] break-keep">
          학부모님도 꼭 함께 알고 계셔야 하는 생활 관리 기준이에요. 학생의 몰입과 안전을 위해 휴대폰, 태블릿, 와이파이, 생활 태도를 강하게 관리합니다.
        </p>
        <div className={cn('mt-4 grid gap-3', isMobileView ? 'grid-cols-1' : 'grid-cols-2')}>
          {PARENT_MANUAL_OPERATION_HIGHLIGHTS.map((item) => (
            <ManualHighlightCard
              key={item.key}
              title={item.title}
              description={item.description}
              tone={item.tone}
              badgeLabel="운영 기준"
            />
          ))}
        </div>
      </section>

      <GuideSection
        step={1}
        title="처음 로그인 후 3분 체크"
        icon={<CalendarDays className="h-5 w-5" />}
        accentColor="#2554D7"
        tintColor="#EAF0FC"
      >
        <GuideStep
          icon={<School className="h-4 w-4 text-[#2554D7]" />}
          title="상단에서 자녀 선택"
          body={<>연결된 자녀가 둘 이상이면 상단 선택기에서 <Pill>현재 확인 중인 자녀</Pill>를 먼저 맞춰 주세요. 요약, 리포트, 수납 정보가 이 기준으로 함께 바뀝니다.</>}
        />
        <GuideStep
          icon={<Target className="h-4 w-4 text-[#2554D7]" />}
          title="홈 탭부터 확인"
          body={<>가장 먼저 <Pill>홈</Pill>에서 오늘 공부 시간, 출결 상태, 벌점 변화, 미확인 알림 수를 확인하세요. 큰 변화는 대부분 이 화면에서 먼저 잡혀요.</>}
        />
        <GuideStep
          icon={<BellRing className="h-4 w-4 text-[#2554D7]" />}
          title="중요 알림은 당일 확인"
          body={<>등원, 하원, 벌점, 리포트 발행, 공지 알림은 읽음 상태로 관리돼요. <Pill tone="orange">중요</Pill> 표시가 뜬 항목은 그날 안에 열어보는 것이 좋아요.</>}
        />
        <GuideTip tone="amber">
          홈 요약 숫자와 소통 탭의 알림 흐름을 함께 보면 놓치는 일이 크게 줄어들어요.
        </GuideTip>
      </GuideSection>

      <GuideSection
        step={2}
        title="학습 흐름과 리포트 읽는 법"
        icon={<History className="h-5 w-5" />}
        accentColor="#FF7A16"
        tintColor="#FFF0DE"
      >
        <GuideStep
          icon={<History className="h-4 w-4 text-[#FF7A16]" />}
          title="학습 탭은 날짜별 기록"
          body={<>월간 캘린더에서 날짜를 누르면 등원, 학습 시작·종료, 이석 시간 같은 실제 흐름을 볼 수 있어요. 공부 시간이 흔들린 날을 먼저 찾아보기에 좋아요.</>}
        />
        <GuideStep
          icon={<FileText className="h-4 w-4 text-[#FF7A16]" />}
          title="데이터 탭은 추세 확인"
          body={<>주간·최근 흐름 그래프, 과목 비중, 생활 리듬, <Pill tone="orange">AI 인사이트</Pill>까지 모아서 보여줘요. 하루 수치보다 추세를 읽는 탭이에요.</>}
        />
        <GuideStep
          icon={<BookOpen className="h-4 w-4 text-[#FF7A16]" />}
          title="리포트는 누적 보관"
          body={<>받은 리포트는 날짜별로 쌓여 있어요. 최근 리포트만 보지 말고 전주·전월 흐름과 함께 다시 열어보면 변화가 더 분명하게 보여요.</>}
        />
        <GuideTip>
          같은 학생의 전주, 전월 변화로 비교해서 보시면 감정이 아니라 기록 기준으로 판단하기 쉬워져요.
        </GuideTip>
      </GuideSection>

      <GuideSection
        step={3}
        title="소통 센터 활용"
        icon={<MessageCircle className="h-5 w-5" />}
        accentColor="#17326B"
        tintColor="#E7ECF7"
      >
        <GuideStep
          icon={<Phone className="h-4 w-4 text-[#17326B]" />}
          title="상담 요청은 방문·전화·온라인"
          body={<>소통 탭에서 <Pill>방문</Pill>, <Pill tone="orange">전화</Pill>, <Pill tone="amber">온라인</Pill> 중 원하는 방식으로 상담 요청을 남길 수 있어요. 학습, 생활, 진로 문의를 한 흐름으로 전달할 수 있습니다.</>}
        />
        <GuideStep
          icon={<MessageCircle className="h-4 w-4 text-[#17326B]" />}
          title="질의·요청·건의 구분"
          body={<>일반 문의는 질의사항, 일정 변경이나 확인 요청은 요청사항, 개선 의견은 건의사항으로 남겨 주세요. 제목과 내용을 구체적으로 적을수록 대응이 빨라져요.</>}
        />
        <GuideStep
          icon={<BellRing className="h-4 w-4 text-[#17326B]" />}
          title="공지와 답변은 같은 흐름"
          body={<>센터 공지, 알림 상세, 상담 진행 기록이 함께 관리돼요. 미확인 알림을 눌러 읽으면 상태도 바로 반영됩니다.</>}
        />
        <GuideTip tone="amber">
          긴급한 출결 변경이나 당일 일정 이슈는 센터로 바로 알려주시고, 앱에도 기록을 남겨 두시면 누락이 적어요.
        </GuideTip>
      </GuideSection>

      <GuideSection
        step={4}
        title="수납과 생활관리 기준"
        icon={<CreditCard className="h-5 w-5" />}
        accentColor="#D97706"
        tintColor="#FEF3E0"
      >
        <GuideStep
          icon={<CreditCard className="h-4 w-4 text-[#D97706]" />}
          title="수납 탭은 청구 확인 중심"
          body={<>대표 청구서의 금액, 상태, 마감일, 이전 청구 이력을 볼 수 있어요. 현재는 <Pill tone="amber">앱 내 결제보다 청구 확인</Pill> 기능이 먼저 운영되고 있어요.</>}
        />
        <GuideStep
          icon={<ShieldAlert className="h-4 w-4 text-[#D97706]" />}
          title="벌점은 이력까지 함께 보기"
          body={<>현재 점수만 보지 말고 사유, 반영 시점, 자동 회복 여부를 함께 확인해 주세요. 생활 흐름을 이해할 때 훨씬 정확합니다.</>}
        />
        <GuideStep
          icon={<Smartphone className="h-4 w-4 text-[#D97706]" />}
          title="센터는 생활규정을 강하게 적용"
          body={<>학생은 도착 즉시 휴대폰을 반납하고, 태블릿은 학습용만 허용돼요. 방화벽 우회, 반복 위반, 타인 피해는 즉시 강한 조치가 들어갑니다.</>}
        />
        <GuideTip tone="amber">
          규정이 애매한 경우 학생에게 임의 판단을 맡기기보다 센터에 바로 문의해 주시는 것이 가장 빠르고 안전해요.
        </GuideTip>
      </GuideSection>

      <section className="rounded-[1.75rem] border border-[#D9E1F2] bg-white p-5 shadow-[0_18px_40px_-32px_rgba(10,28,72,0.18)]">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#17326B]" />
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#6781AE]">대시보드 구성</p>
        </div>
        <p className="mt-2 text-[12px] font-semibold leading-5 text-[#5A6F95] break-keep">
          학부모 화면은 탭마다 역할이 분명해요. 아래 기준대로 보시면 정보가 겹치지 않고 필요한 내용을 빠르게 찾을 수 있어요.
        </p>
        <div className={cn('mt-4 grid gap-3', isMobileView ? 'grid-cols-1' : 'grid-cols-2')}>
          {PARENT_MANUAL_DASHBOARD_SECTIONS.map((section) => (
            <ManualRulePanel
              key={section.key}
              eyebrow={section.eyebrow}
              title={section.title}
              description={section.description}
              items={section.items}
              tone={section.tone}
              badgeLabel="기능 안내"
            />
          ))}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-[#D9E1F2] bg-white p-5 shadow-[0_18px_40px_-32px_rgba(10,28,72,0.18)]">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#17326B]" />
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#6781AE]">센터 생활규정</p>
        </div>
        <p className="mt-2 text-[12px] font-semibold leading-5 text-[#5A6F95] break-keep">
          아래 규정은 학생에게 실제로 적용되는 기준이에요. 휴대폰 반납, 태블릿 사용, 와이파이 방화벽, 생활 태도 관리까지 학부모님도 같은 기준으로 함께 알고 계셔야 해요.
        </p>
        <div className={cn('mt-4 grid gap-3', isMobileView ? 'grid-cols-1' : 'grid-cols-2')}>
          {STUDENT_MANUAL_RULE_SECTIONS.map((section) => (
            <ManualRulePanel
              key={section.key}
              eyebrow={section.eyebrow}
              title={section.title}
              description={section.description}
              items={section.items}
              tone={section.tone}
            />
          ))}
        </div>
      </section>

      <ManualPenaltySection
        isMobileView={isMobileView}
        intro="생활규정 기준과 실제 반영 단계를 함께 안내해 드려요. 앱에서 보이는 벌점 현황은 아래 기준으로 누적되고, 일정 기간 문제 없이 지내면 자동 회복도 반영됩니다."
        note="반복 위반, 방화벽 우회, 시설 훼손, 타인 피해처럼 심각한 사안은 누적 점수와 무관하게 즉시 보호자 안내와 강한 조치가 가능합니다."
      />

      <ManualTipsSection eyebrow="PARENT TIPS" tips={PARENT_MANUAL_PRO_TIPS} />
    </>
  );
}

function extractPhoneNumber(source: unknown): string {
  if (!source || typeof source !== 'object') return '';
  const candidate = (source as { phoneNumber?: unknown }).phoneNumber;
  return typeof candidate === 'string' ? candidate : '';
}

function resolveCallableErrorMessage(error: any): string {
  const errorCode = String(error?.code || '').toLowerCase();
  const detailMessage =
    typeof error?.details === 'string'
      ? error.details
      : typeof error?.details?.userMessage === 'string'
        ? error.details.userMessage
        : typeof error?.details?.message === 'string'
          ? error.details.message
          : '';

  const looksCorrupted = (message: string): boolean => {
    const trimmed = message.trim();
    if (!trimmed) return false;
    const questionCount = (trimmed.match(/\?/g) || []).length;
    return questionCount >= Math.max(2, Math.floor(trimmed.length * 0.25));
  };

  if (errorCode.includes('permission-denied')) {
    return '\uAD8C\uD55C\uC774 \uC5C6\uC5B4 \uC815\uBCF4\uB97C \uBCC0\uACBD\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.';
  }
  if (errorCode.includes('failed-precondition')) {
    return '\uC774\uBBF8 \uC0AC\uC6A9 \uC911\uC778 \uD559\uBD80\uBAA8 \uC5F0\uB3D9 \uCF54\uB4DC\uC785\uB2C8\uB2E4. \uB2E4\uB978 6\uC790\uB9AC \uC22B\uC790\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694.';
  }
  if (errorCode.includes('invalid-argument')) {
    return '\uC785\uB825\uAC12\uC744 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694.';
  }

  const rawMessage = String(error?.message || '').replace(/^FirebaseError:\s*/i, '').trim();
  if (detailMessage && !looksCorrupted(detailMessage)) return detailMessage;
  if (rawMessage && !/(functions\/internal|internal)$/i.test(rawMessage) && !looksCorrupted(rawMessage)) return rawMessage;

  return '\uC11C\uBC84 \uD1B5\uC2E0 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.';
}

function normalizeParentLinkCode(value: unknown): string {
  if (typeof value === 'string') {
    return value.replace(/\D/g, '').slice(0, 6);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value)).replace(/\D/g, '').slice(0, 6);
  }
  return '';
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

function isValidKoreanMobilePhone(raw: string): boolean {
  return /^01\d{8,9}$/.test(raw);
}

type DashboardHeaderProps = {
  playStudentEntry?: boolean;
};

export function DashboardHeader({ playStudentEntry = false }: DashboardHeaderProps) {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const functions = useFunctions();
  const router = useRouter();
  const { toast } = useToast();
  const { activeMembership, activeStudentId, viewMode, setViewMode } = useAppContext();
  const isParentMode = activeMembership?.role === 'parent';
  const isStudentMode = activeMembership?.role === 'student';
  const isMobileView = isParentMode || viewMode === 'mobile';
  const dashboardMotionPreset = isParentMode || isStudentMode ? 'dashboard-premium' : 'default';

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSettingsFormInitialized, setIsSettingsFormInitialized] = useState(false);
  const [playParentEntry, setPlayParentEntry] = useState(false);

  const [schoolName, setSchoolName] = useState('');
  const [grade, setGrade] = useState('');
  const [parentLinkCode, setParentLinkCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userProfile } = useDoc<UserType>(userRef as any);
  const authUid = user?.uid || null;
  const studentUid = activeStudentId || authUid || null;
  const studentDocId = activeStudentId || authUid || null;

  const studentRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !studentDocId) return null;
    return doc(firestore, 'centers', activeMembership.id, 'students', studentDocId);
  }, [firestore, activeMembership?.id, studentDocId]);
  const { data: studentProfile } = useDoc<StudentProfile>(studentRef as any);
  const linkedStudentId =
    activeMembership?.role === 'parent'
      ? activeMembership?.linkedStudentIds?.[0] || null
      : studentDocId;
  const linkedStudentRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership?.id || !linkedStudentId) return null;
    return doc(firestore, 'centers', activeMembership.id, 'students', linkedStudentId);
  }, [firestore, activeMembership?.id, linkedStudentId]);
  const { data: linkedStudentProfile } = useDoc<StudentProfile>(linkedStudentRef as any);
  const [parentHeaderTodayLabel, setParentHeaderTodayLabel] = useState('');
  const parentHeaderStudentName = linkedStudentProfile?.name || '학생';

  useEffect(() => {
    if (!isParentMode || typeof window === 'undefined') {
      setParentHeaderTodayLabel('');
      return;
    }

    const syncParentHeaderTodayLabel = () => {
      setParentHeaderTodayLabel(format(new Date(), 'yyyy. MM. dd (EEE)', { locale: ko }));
    };

    syncParentHeaderTodayLabel();
    const intervalId = window.setInterval(syncParentHeaderTodayLabel, 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [isParentMode]);

  useEffect(() => {
    if (!isSettingsOpen) {
      setIsSettingsFormInitialized(false);
      return;
    }

    if (isSettingsFormInitialized) return;

    if (studentProfile) {
      setSchoolName(studentProfile.schoolName || '');
      setGrade(studentProfile.grade || '');
      setParentLinkCode(normalizeParentLinkCode(studentProfile.parentLinkCode));
      setPhoneNumber(normalizePhone(extractPhoneNumber(studentProfile) || userProfile?.phoneNumber || activeMembership?.phoneNumber || ''));
      setIsSettingsFormInitialized(true);
      return;
    }

    if (userProfile) {
      setSchoolName(userProfile.schoolName || '');
      setGrade('');
      setParentLinkCode('');
      setPhoneNumber(normalizePhone(userProfile.phoneNumber || activeMembership?.phoneNumber || ''));
      setIsSettingsFormInitialized(true);
    }
  }, [isSettingsOpen, isSettingsFormInitialized, studentProfile, userProfile, activeMembership?.phoneNumber]);

  useEffect(() => {
    if (!isParentMode || typeof window === 'undefined') return;

    const raw = window.sessionStorage.getItem(PARENT_POST_LOGIN_ENTRY_MOTION_KEY);
    const timestamp = Number(raw);
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > DASHBOARD_POST_LOGIN_ENTRY_MAX_AGE_MS) {
      return;
    }

    setPlayParentEntry(true);
    const timer = window.setTimeout(() => setPlayParentEntry(false), 1100);
    return () => window.clearTimeout(timer);
  }, [isParentMode]);

  const handleSignOut = async () => {
    try {
      await clearServerAuthSession();
      if (auth) {
        await signOut(auth);
      }
      router.push('/login');
    } catch (error) {
      logHandledClientIssue('[dashboard-header] sign out failed', error);
      toast({
        variant: 'destructive',
        title: '로그아웃 실패',
        description: '로그아웃 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      });
    }
  };

  const handleUpdateSettings = async () => {
    if (!firestore || !user || !activeMembership) return;

    if (activeMembership.role === 'student') {
      toast({
        title: '프로필은 조회 전용입니다.',
        description: '정보 변경이 필요하면 센터 관리자에게 요청해 주세요.',
      });
      setIsSettingsOpen(false);
      return;
    }

    const normalizedSchoolName = schoolName.trim();
    const normalizedPhoneNumber = normalizePhone(phoneNumber);

    if (activeMembership.role === 'parent' && !isValidKoreanMobilePhone(normalizedPhoneNumber)) {
      toast({
        variant: 'destructive',
        title: '\uC785\uB825 \uD655\uC778',
        description: '\uBCF8\uC778 \uD734\uB300\uD3F0 \uBC88\uD638\uB97C 01012345678 \uD615\uC2DD\uC73C\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694.',
      });
      return;
    }

    setIsUpdating(true);
    try {
      if (activeMembership.role === 'parent') {
        if (!functions) {
          throw new Error('함수 연결이 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.');
        }
        const updateFn = httpsCallable(functions, 'updateParentProfile');
        await updateFn({
          centerId: activeMembership.id,
          schoolName: normalizedSchoolName,
          phoneNumber: normalizedPhoneNumber,
        });
      } else {
        const batch = writeBatch(firestore);
        batch.set(
          doc(firestore, 'users', user.uid),
          {
            schoolName: normalizedSchoolName,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        await batch.commit();
      }

      toast({ title: '\uC815\uBCF4\uAC00 \uC131\uACF5\uC801\uC73C\uB85C \uC5C5\uB370\uC774\uD2B8\uB418\uC5C8\uC2B5\uB2C8\uB2E4.' });
      setIsSettingsOpen(false);
    } catch (error: any) {
      logHandledClientIssue('[dashboard-header] settings update failed', error);
      toast({
        variant: 'destructive',
        title: '\uC5C5\uB370\uC774\uD2B8 \uC2E4\uD328',
        description: resolveCallableErrorMessage(error),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex items-center md:static md:h-auto',
        isParentMode ? 'h-[3.25rem] gap-2 px-3 sm:h-14 sm:px-4 md:px-5' : 'h-14 gap-4 px-4 md:px-6',
        isMobileView
          ? isParentMode
            ? 'border-b border-[rgba(20,41,95,0.12)] bg-[linear-gradient(180deg,rgba(232,240,245,0.98)_0%,rgba(246,239,229,0.96)_100%)] shadow-[0_1px_0_0_rgba(255,255,255,0.72)_inset,0_4px_16px_rgba(20,41,95,0.10)] backdrop-blur-md'
            : 'border-b border-[rgba(255,170,80,0.20)] bg-[linear-gradient(180deg,rgba(255,247,238,0.98)_0%,rgba(255,255,255,0.96)_100%)] shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_4px_16px_rgba(20,41,95,0.09)] backdrop-blur-md'
          : 'border-b border-[rgba(20,41,95,0.07)] bg-white/85 backdrop-blur-xl shadow-[0_1px_0_0_rgba(255,255,255,0.8)_inset] md:border-0 md:bg-transparent md:shadow-none',
        playParentEntry && 'parent-shell-enter parent-entry-delay-1',
        playStudentEntry && !isParentMode && 'student-shell-enter student-entry-delay-1'
      )}
    >
      <div className={cn('flex items-center', isParentMode ? 'gap-1.5' : 'gap-2')}>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className={cn(
                'md:hidden rounded-full border-[#1a336d]/20 bg-white/80 shadow-sm',
                isParentMode ? 'h-9 w-9' : ''
              )}
            >
              <PanelLeft className="h-5 w-5" />
              <span className="sr-only">메뉴 열기</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" motionPreset={dashboardMotionPreset} className="sm:max-w-xs">
            <MainNav isMobile={true} />
          </SheetContent>
        </Sheet>
      </div>

      <div className="relative ml-auto flex items-center gap-2">
        {isParentMode && (
          <div className="flex items-center rounded-2xl border border-[#cfd9e3] bg-[linear-gradient(145deg,#eef3f5_0%,#f8f1e7_100%)] px-3 py-1.5 shadow-sm">
            <div className="grid gap-0.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#14295F]/55">{parentHeaderTodayLabel}</p>
              <p className="text-[11px] font-black text-[#14295F]">{parentHeaderStudentName} 학생 현황</p>
            </div>
          </div>
        )}
        {!isParentMode && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'rounded-full text-muted-foreground hover:bg-primary/5 transition-all',
              isMobileView &&
                'bg-[#14295F] text-white shadow-[0_8px_18px_rgba(20,41,95,0.28)] hover:bg-[#10214a] hover:text-white'
            )}
            onClick={() => setViewMode(viewMode === 'mobile' ? 'desktop' : 'mobile')}
            title={viewMode === 'mobile' ? '데스크톱 모드로 전환' : '앱 모드로 전환'}
          >
            {viewMode === 'mobile' ? <Monitor className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
          </Button>
        )}

        {!isParentMode && <NotificationBell />}

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                'overflow-hidden rounded-full border-2 border-primary/10 shadow-sm interactive-button',
                isMobileView && 'border-[#14295F]/20 bg-white',
                isParentMode ? 'h-9 w-9 sm:h-10 sm:w-10' : ''
              )}
            >
              <Avatar className="h-full w-full">
                {user?.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || ''} />}
                <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">
                  {user?.displayName?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="rounded-2xl border-none shadow-2xl min-w-[200px] p-2 animate-in fade-in zoom-in duration-200"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DropdownMenuLabel className="font-black px-3 py-2 text-xs uppercase tracking-widest opacity-60">
              내 계정 관리
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="font-bold rounded-xl cursor-pointer py-2.5"
              onSelect={(e) => {
                e.preventDefault();
                setIsSettingsOpen(true);
              }}
            >
              <Settings className="mr-2 h-4 w-4 opacity-40" /> 설정
            </DropdownMenuItem>
            <DropdownMenuItem
              className="font-bold rounded-xl cursor-pointer py-2.5"
              onSelect={(e) => {
                e.preventDefault();
                setIsSupportOpen(true);
              }}
            >
              <HelpCircle className="mr-2 h-4 w-4 opacity-40" /> 지원 및 메뉴얼
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="font-black text-destructive rounded-xl cursor-pointer py-2.5">
              <LogOut className="mr-2 h-4 w-4" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent
          motionPreset={dashboardMotionPreset}
          className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md transition-all duration-500 w-[90vw] max-w-[350px] sm:w-auto"
        >
          <div className="bg-primary text-white relative overflow-hidden p-6 sm:p-8">
            <Sparkles className="absolute top-0 right-0 p-8 h-32 w-32 opacity-10" />
            <DialogTitle className="font-black tracking-tighter text-xl sm:text-2xl">프로필 설정</DialogTitle>
            <DialogDescription className="text-white/60 font-bold mt-1 text-xs">
              {activeMembership?.role === 'student' ? '등록된 프로필을 확인할 수 있습니다.' : '정보를 수정할 수 있습니다.'}
            </DialogDescription>
          </div>

          <div className="space-y-6 bg-white p-6 sm:p-8">
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">소속 학교</Label>
              <div className="relative">
                <School className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30" />
                <Input
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  readOnly={activeMembership?.role === 'student'}
                  disabled={activeMembership?.role === 'student'}
                  className="h-12 pl-10 rounded-xl border-2 font-bold"
                  placeholder={activeMembership?.role === 'student' ? '등록된 학교 정보 없음' : '학교명을 입력하세요'}
                />
              </div>
            </div>

            {(activeMembership?.role === 'student' || activeMembership?.role === 'parent') && (
              <div className="grid gap-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">본인 전화번호</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30" />
                  <Input
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    readOnly={activeMembership?.role === 'student'}
                    disabled={activeMembership?.role === 'student'}
                    className="h-12 rounded-xl border-2 pl-10 font-black tracking-tight"
                    placeholder={activeMembership?.role === 'student' ? '등록된 전화번호 없음' : '01012345678'}
                    maxLength={11}
                  />
                </div>
              </div>
            )}

            {activeMembership?.role === 'student' && (
              <>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">현재 학년</Label>
                  <Select value={grade} onValueChange={setGrade} disabled>
                    <SelectTrigger className="h-12 rounded-xl border-2 font-bold">
                      <SelectValue placeholder="학년 선택" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      <SelectItem value="1학년">1학년</SelectItem>
                      <SelectItem value="2학년">2학년</SelectItem>
                      <SelectItem value="3학년">3학년</SelectItem>
                      <SelectItem value="N수생">N수생</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">학부모 연동 코드 (6자리)</Label>
                  <Input
                    value={parentLinkCode}
                    onChange={(e) => setParentLinkCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    readOnly
                    disabled
                    className="h-12 rounded-xl border-2 font-black tracking-[0.25em] text-center"
                    placeholder="등록된 코드 없음"
                    maxLength={6}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="bg-muted/20 border-t p-6 sm:p-8">
            <Button
              onClick={activeMembership?.role === 'student' ? () => setIsSettingsOpen(false) : handleUpdateSettings}
              disabled={isUpdating}
              className="w-full h-14 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all"
            >
              {isUpdating ? <Loader2 className="animate-spin h-5 w-5" /> : activeMembership?.role === 'student' ? '확인' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSupportOpen} onOpenChange={setIsSupportOpen}>
        <DialogContent
          motionPreset={dashboardMotionPreset}
          className={cn(
            "rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden flex flex-col transition-all duration-500",
            isMobileView
              ? "w-[95vw] max-w-[390px] h-[86vh] max-h-[86vh]"
              : "w-auto max-w-2xl h-auto max-h-[85vh]"
          )}
        >
          <div className={cn(
            "shrink-0 relative overflow-hidden text-white bg-[linear-gradient(140deg,#FF9A46_0%,#FF7A16_58%,#EF6100_100%)]",
            isMobileView ? "p-6" : "p-8"
          )}>
            <BookOpen className="pointer-events-none absolute -top-10 -right-10 h-48 w-48 opacity-10 rotate-12" />
            <Sparkles className="pointer-events-none absolute bottom-4 right-6 h-6 w-6 text-white/40" />
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
              <Flame className="h-3 w-3" /> {isParentMode ? 'PARENT MANUAL' : 'STUDENT MANUAL'}
            </div>
            <DialogTitle className={cn(
              "font-black tracking-tighter flex items-center gap-3 mt-3",
              isMobileView ? "text-2xl" : "text-3xl"
            )}>
              <BookOpen className="h-7 w-7" /> {isParentMode ? '학부모 이용 가이드' : '스터디센터 이용 가이드'}
            </DialogTitle>
            <DialogDescription className="text-white/85 font-bold mt-1.5 text-[12px] leading-5">
              {isParentMode
                ? '자녀 확인 순서, 리포트 읽는 법, 상담·수납, 생활규정과 벌점 기준까지 한 번에 볼 수 있어요.'
                : '첫 등원 루틴, 러닝 시스템, 생활규정, 벌점 기준까지 한 번에 볼 수 있어요.'}
            </DialogDescription>
          </div>

          <div className={cn(
            "flex-1 overflow-y-auto bg-[#f6f7fb] custom-scrollbar",
            isMobileView ? "p-5 space-y-6" : "p-8 space-y-8"
          )}>
            {isParentMode ? <ParentSupportManualBody isMobileView={isMobileView} /> : <StudentSupportManualBody isMobileView={isMobileView} />}
          </div>

          <div className={cn(
            "bg-white border-t shrink-0 flex items-center justify-between",
            isMobileView ? "p-4" : "p-6"
          )}>
            <p className="text-[11px] font-bold text-[#6781AE]">
              {isParentMode ? <>도움이 더 필요하면 <span className="text-[#FF7A16]">소통 탭</span>이나 상담으로!</> : <>도움이 더 필요하면 <span className="text-[#FF7A16]">상담</span>으로!</>}
            </p>
            <Button onClick={() => setIsSupportOpen(false)} className="rounded-xl font-black px-8 h-12 shadow-lg active:scale-95 transition-all">
              확인했어요
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
