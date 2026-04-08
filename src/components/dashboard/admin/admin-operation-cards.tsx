'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, ShieldAlert, Trophy, Armchair, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';

/* ═══════════════════════════════════════════
   A. Attendance Overview Card
   ═══════════════════════════════════════════ */

type RoomOverview = {
  id: string;
  name: string;
  focusedCount: number;
  awayCount: number;
  alertCount: number;
  totalSeats: number;
};

type AttendanceOverviewCardProps = {
  checkedInCount: number;
  lateOrAbsentCount: number;
  longAwayCount: number;
  urgentCount: number;
  rooms: RoomOverview[];
  isMobile: boolean;
  onOpenRoom: (roomId: string) => void;
  onOpenAll: () => void;
  delay?: number;
};

export function AttendanceOverviewCard({
  checkedInCount,
  lateOrAbsentCount,
  longAwayCount,
  urgentCount,
  rooms,
  isMobile,
  onOpenRoom,
  onOpenAll,
  delay = 0,
}: AttendanceOverviewCardProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
    >
      <Card className="admin-card-lift h-full overflow-hidden rounded-[2rem] border border-[#DCE7FF] admin-surface-primary shadow-[0_24px_50px_-36px_rgba(20,41,95,0.28)]">
        <CardHeader className="border-b border-[#E4ECFF] pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5c6e97]">실시간 교실</p>
              <CardTitle className="mt-1.5 text-lg font-black tracking-tight text-[#14295F]">
                교실 현황
              </CardTitle>
            </div>
            <Badge className="rounded-full border-none bg-[#14295F] px-2.5 py-1 text-[10px] font-black text-white">
              {checkedInCount}명 착석
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3.5 p-5">
          {/* Mini KPI grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[1.25rem] border border-[#DCE7FF] bg-white px-3.5 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">착석</p>
              <p className="admin-kpi-number mt-1.5 text-[1.4rem] text-[#14295F]">{checkedInCount}</p>
            </div>
            <div className="rounded-[1.25rem] border border-[#DCE7FF] bg-[#F8FBFF] px-3.5 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">미입실·지각</p>
              <p className="admin-kpi-number mt-1.5 text-[1.4rem] text-[#14295F]">{lateOrAbsentCount}</p>
            </div>
            <div className={cn('rounded-[1.25rem] border px-3.5 py-3', longAwayCount > 0 ? 'border-[#FFD7BA] bg-[#FFF8F2]' : 'border-[#DCE7FF] bg-white')}>
              <p className={cn('text-[10px] font-black uppercase tracking-[0.16em]', longAwayCount > 0 ? 'text-[#C95A08]' : 'text-[#5c6e97]')}>장기 외출</p>
              <p className={cn('admin-kpi-number mt-1.5 text-[1.4rem]', longAwayCount > 0 ? 'text-[#C95A08]' : 'text-[#14295F]')}>{longAwayCount}</p>
            </div>
            <div className={cn('rounded-[1.25rem] border px-3.5 py-3', urgentCount > 0 ? 'border-[#FFD7BA] bg-[#FFF2E8]' : 'border-[#DCE7FF] bg-white')}>
              <p className={cn('text-[10px] font-black uppercase tracking-[0.16em]', urgentCount > 0 ? 'text-[#C95A08]' : 'text-[#5c6e97]')}>즉시 개입</p>
              <p className={cn('admin-kpi-number mt-1.5 text-[1.4rem]', urgentCount > 0 ? 'text-[#C95A08]' : 'text-[#14295F]')}>{urgentCount}</p>
            </div>
          </div>

          {/* Room rows */}
          <div className="grid gap-2">
            {rooms.slice(0, 3).map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => onOpenRoom(room.id)}
                className="admin-card-lift rounded-[1.35rem] border border-[#DCE7FF] bg-[#F7FAFF] px-4 py-3 text-left hover:border-[#FF7A16]/24 hover:bg-white"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#14295F]">{room.name}</p>
                    <p className="mt-0.5 text-[11px] font-bold text-[#5c6e97]">
                      착석 {room.focusedCount}/{room.totalSeats}
                      {room.alertCount > 0 && <span className="text-[#C95A08]"> · 경고 {room.alertCount}건</span>}
                      {room.awayCount > 0 && ` · 외출 ${room.awayCount}명`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#5c6e97]" />
                </div>
              </button>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-[1.25rem] border-[#DCE7FF] bg-white font-black text-[#14295F] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF7A16]/24 hover:text-[#C95A08]"
            onClick={onOpenAll}
          >
            전체 좌석 보기
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   B. Intervention Card
   ═══════════════════════════════════════════ */

type InterventionStudent = {
  studentId: string;
  studentName: string;
  className?: string;
  roomLabel: string;
  attendanceStatus: string;
  topReason: string;
  compositeHealth: number;
};

type InterventionCardProps = {
  students: InterventionStudent[];
  onSelectStudent: (studentId: string) => void;
  onViewAll: () => void;
  delay?: number;
};

export function InterventionCard({
  students,
  onSelectStudent,
  onViewAll,
  delay = 0,
}: InterventionCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const primary = students[0] || null;
  const secondary = students.slice(1, 3);

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
    >
      <Card className={cn(
        'admin-card-lift h-full overflow-hidden rounded-[2rem] border shadow-[0_24px_50px_-36px_rgba(20,41,95,0.28)]',
        primary ? 'border-[#FFD7BA] admin-surface-alert' : 'border-[#DCE7FF] admin-surface-primary'
      )}>
        <CardHeader className="border-b border-[#E4ECFF] pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5c6e97]">즉시 개입 학생</p>
              <CardTitle className="mt-1.5 text-lg font-black tracking-tight text-[#14295F]">
                우선 조치 대상
              </CardTitle>
            </div>
            <Badge className={cn(
              'rounded-full border-none px-2.5 py-1 text-[10px] font-black',
              students.length > 0 ? 'bg-[#FF7A16] text-white' : 'bg-[#EEF4FF] text-[#2554D7]'
            )}>
              {students.length}명
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {students.length === 0 ? (
            <div className="rounded-[1.45rem] border border-dashed border-[#DCE7FF] bg-[#F7FAFF] px-4 py-8 text-center">
              <ShieldAlert className="mx-auto h-6 w-6 text-emerald-400" />
              <p className="mt-2 text-xs font-bold text-[#5c6e97]">
                현재 즉시 개입이 필요한 학생이 없습니다.
              </p>
            </div>
          ) : (
            <>
              {primary && (
                <button
                  type="button"
                  onClick={() => onSelectStudent(primary.studentId)}
                  className="admin-card-lift w-full rounded-[1.7rem] border border-[#FFD7BA] bg-[linear-gradient(180deg,#FFF4EA_0%,#FFFFFF_100%)] p-4 text-left shadow-[0_22px_36px_-30px_rgba(255,122,22,0.2)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="h-6 rounded-full border-none bg-[#FF7A16] px-2.5 text-[10px] font-black text-white">
                          1순위
                        </Badge>
                        {primary.className && (
                          <Badge className="h-6 rounded-full border-none bg-white px-2.5 text-[10px] font-black text-[#14295F] shadow-sm">
                            {primary.className}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2.5 text-base font-black text-[#14295F]">{primary.studentName}</p>
                      <p className="mt-0.5 text-[11px] font-bold text-[#5c6e97]">
                        {primary.roomLabel} · {primary.attendanceStatus}
                      </p>
                      <p className="mt-1.5 text-sm font-black text-[#C95A08]">{primary.topReason}</p>
                    </div>
                    <div className="rounded-[1.2rem] border border-[#FFD7BA] bg-white px-3 py-2 text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">위험</p>
                      <p className="admin-kpi-number mt-1 text-[1.3rem] text-[#14295F]">{primary.compositeHealth}</p>
                    </div>
                  </div>
                </button>
              )}

              <div className="grid gap-2">
                {secondary.map((student, index) => (
                  <button
                    key={`${student.studentId}-${index}`}
                    type="button"
                    onClick={() => onSelectStudent(student.studentId)}
                    className="admin-card-lift grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 rounded-[1.25rem] border border-[#DCE7FF] bg-[#F7FAFF] px-3 py-3 text-left hover:bg-white"
                  >
                    <span className="text-xs font-black text-[#C95A08]">{index + 2}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#14295F]">{student.studentName}</p>
                      <p className="mt-0.5 truncate text-[11px] font-bold text-[#5c6e97]">
                        {student.roomLabel} · {student.topReason}
                      </p>
                    </div>
                    <p className="text-sm font-black text-[#14295F]">{student.compositeHealth}점</p>
                  </button>
                ))}
              </div>
            </>
          )}

          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-[1.25rem] border-[#DCE7FF] bg-white font-black text-[#14295F] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF7A16]/24 hover:text-[#C95A08]"
            onClick={onViewAll}
          >
            전체 우선순위 보기
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   C. Top Performers Card
   ═══════════════════════════════════════════ */

type TopPerformer = {
  studentId: string;
  name: string;
  className: string;
  score: number;
  highlight: string;
};

type TopPerformersCardProps = {
  performers: TopPerformer[];
  onSelectStudent: (studentId: string) => void;
  delay?: number;
};

export function TopPerformersCard({
  performers,
  onSelectStudent,
  delay = 0,
}: TopPerformersCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const leader = performers[0] || null;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
    >
      <Card className="admin-card-lift h-full overflow-hidden rounded-[2rem] border border-[#DCE7FF] admin-surface-primary shadow-[0_24px_50px_-36px_rgba(20,41,95,0.28)]">
        <CardHeader className="border-b border-[#E4ECFF] pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5c6e97]">오늘의 TOP 3</p>
              <CardTitle className="mt-1.5 text-lg font-black tracking-tight text-[#14295F]">
                학습 우수 학생
              </CardTitle>
            </div>
            <Badge className="rounded-full border-none bg-[#14295F] px-2.5 py-1 text-[10px] font-black text-white">
              <Trophy className="mr-1 h-3 w-3" />
              TOP 3
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {performers.length === 0 ? (
            <div className="rounded-[1.45rem] border border-dashed border-[#DCE7FF] bg-[#F7FAFF] px-4 py-8 text-center text-xs font-bold text-[#5c6e97]">
              오늘의 상위 학생 집계가 아직 준비되지 않았습니다.
            </div>
          ) : (
            <>
              {leader && (
                <button
                  type="button"
                  onClick={() => onSelectStudent(leader.studentId)}
                  className="admin-card-lift w-full rounded-[1.65rem] border border-[#17326B] admin-surface-dark p-4 text-left text-white shadow-[0_24px_42px_-34px_rgba(20,41,95,0.48)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Badge className="h-6 rounded-full border-none bg-[#FF7A16] px-2.5 text-[10px] font-black text-white">
                        1위
                      </Badge>
                      <p className="mt-2.5 text-base font-black">{leader.name}</p>
                      <p className="mt-0.5 text-[11px] font-bold text-white/72">
                        {leader.className} · {leader.highlight}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/50">집중</p>
                      <p className="admin-kpi-number mt-1 text-[1.4rem] text-white">{leader.score}</p>
                    </div>
                  </div>
                </button>
              )}

              <div className="grid gap-2">
                {performers.slice(1).map((student, index) => (
                  <button
                    key={student.studentId}
                    type="button"
                    onClick={() => onSelectStudent(student.studentId)}
                    className="admin-card-lift grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 rounded-[1.2rem] border border-[#DCE7FF] bg-[#F7FAFF] px-3 py-3 text-left hover:border-[#2554D7]/24 hover:bg-white"
                  >
                    <span className="text-xs font-black text-[#2554D7]">{index + 2}위</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#14295F]">{student.name}</p>
                      <p className="mt-0.5 truncate text-[11px] font-bold text-[#5c6e97]">
                        {student.className} · {student.highlight}
                      </p>
                    </div>
                    <p className="text-sm font-black text-[#14295F]">{student.score}점</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════
   D. Quick Actions Card
   ═══════════════════════════════════════════ */

type QuickActionItem = {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

type QuickActionsCardProps = {
  actions: QuickActionItem[];
  topPriorityTitle: string;
  topPriorityDetail: string;
  primaryContactName: string | null;
  primaryContactIssue: string | null;
  contactCount: number;
  onOpenMemo: () => void;
  onOpenContactPriority: () => void;
  delay?: number;
};

export function QuickActionsCard({
  actions,
  topPriorityTitle,
  topPriorityDetail,
  primaryContactName,
  primaryContactIssue,
  contactCount,
  onOpenMemo,
  onOpenContactPriority,
  delay = 0,
}: QuickActionsCardProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
    >
      <Card className="admin-card-lift h-full overflow-hidden rounded-[2rem] border border-[#DCE7FF] admin-surface-primary shadow-[0_24px_50px_-36px_rgba(20,41,95,0.28)]">
        <CardHeader className="border-b border-[#E4ECFF] pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5c6e97]">운영 메모 · 빠른 이동</p>
              <CardTitle className="mt-1.5 text-lg font-black tracking-tight text-[#14295F]">
                보조 액션
              </CardTitle>
            </div>
            <Badge className="rounded-full border-none bg-[#EEF4FF] px-2.5 py-1 text-[10px] font-black text-[#2554D7]">
              보조
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {/* Operations Memo */}
          <button
            type="button"
            onClick={onOpenMemo}
            className="admin-card-lift w-full rounded-[1.45rem] border border-[#DCE7FF] bg-white px-4 py-3 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">운영 메모</p>
                <p className="mt-1.5 text-sm font-black text-[#14295F]">{topPriorityTitle}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] font-bold leading-5 text-[#5c6e97]">{topPriorityDetail}</p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 text-[#5c6e97]" />
            </div>
          </button>

          {/* Attendance Contact */}
          <button
            type="button"
            onClick={onOpenContactPriority}
            className="admin-card-lift w-full rounded-[1.45rem] border border-[#DCE7FF] bg-[#F7FAFF] px-4 py-3 text-left hover:bg-white"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">출결 연락 우선</p>
                <p className="mt-1.5 text-sm font-black text-[#14295F]">
                  {primaryContactName ? `${contactCount}명 확인 필요` : '현재 연락 우선 없음'}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11px] font-bold leading-5 text-[#5c6e97]">
                  {primaryContactName
                    ? `${primaryContactName} · ${primaryContactIssue}`
                    : '미입실, 지각 학생은 현재 안정 구간입니다.'}
                </p>
              </div>
              <Phone className="mt-1 h-4 w-4 text-[#C95A08]" />
            </div>
          </button>

          {/* Quick Links */}
          <div className="grid gap-1.5">
            {actions.slice(0, 3).map((item) => {
              const QuickIcon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="admin-card-lift flex items-center justify-between rounded-[1.2rem] border border-[#DCE7FF] bg-[#F7FAFF] px-3 py-2.5 hover:bg-white"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-[0.95rem] bg-[#14295F] text-white">
                      <QuickIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-black text-[#14295F]">{item.label}</p>
                      <p className="text-[10px] font-bold text-[#5c6e97]">{item.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#5c6e97]" />
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
