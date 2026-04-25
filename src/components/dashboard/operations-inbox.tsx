'use client';

import { useReducedMotion, motion } from 'framer-motion';
import { AlertCircle, ChevronRight, Clock3, Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type OperationsInboxTone = 'navy' | 'blue' | 'amber' | 'orange' | 'rose' | 'teal' | 'violet' | 'emerald';

export interface OperationsInboxSummaryChip {
  key: string;
  label: string;
  value: string;
  caption?: string;
  tone: OperationsInboxTone;
  onClick?: () => void;
}

export interface OperationsInboxQueueItem {
  key: string;
  label: string;
  title: string;
  detail: string;
  meta?: string;
  tone: OperationsInboxTone;
  onClick?: () => void;
}

export interface OperationsInboxPanelRow {
  key: string;
  title: string;
  detail: string;
  meta?: string;
  badge?: string;
  tone: OperationsInboxTone;
  onClick?: () => void;
}

export interface OperationsInboxPanel {
  key: string;
  label: string;
  title: string;
  count: number;
  emptyLabel: string;
  tone: OperationsInboxTone;
  rows: OperationsInboxPanelRow[];
  onOpenAll?: () => void;
}

type OperationsInboxProps = {
  headline: string;
  summary: string;
  statusLabel: string;
  statusTone: 'stable' | 'caution' | 'urgent';
  liveLabel: string;
  totalOpenCount: number;
  summaryChips: OperationsInboxSummaryChip[];
  queueItems: OperationsInboxQueueItem[];
  panels: OperationsInboxPanel[];
  headerActions?: ReactNode;
  queueButtonLabel?: string;
  onOpenQueue?: () => void;
  className?: string;
};

const toneClassMap: Record<OperationsInboxTone, { shell: string; badge: string; icon: string; accent: string }> = {
  navy: {
    shell: 'border-[#D7DEFF] bg-[linear-gradient(180deg,#F4F7FF_0%,#FFFFFF_100%)]',
    badge: 'bg-[#EEF4FF] text-[#2554D7]',
    icon: 'text-[#2554D7]',
    accent: 'text-[#14295F]',
  },
  blue: {
    shell: 'border-[#DCE7FF] bg-[linear-gradient(180deg,#F6FAFF_0%,#FFFFFF_100%)]',
    badge: 'bg-[#EEF4FF] text-[#2554D7]',
    icon: 'text-[#2554D7]',
    accent: 'text-[#14295F]',
  },
  amber: {
    shell: 'border-[#FFE1B7] bg-[linear-gradient(180deg,#FFF8ED_0%,#FFFFFF_100%)]',
    badge: 'bg-[#FFF1D9] text-[#B76B10]',
    icon: 'text-[#C95A08]',
    accent: 'text-[#8D4C00]',
  },
  orange: {
    shell: 'border-[#FFD7BA] bg-[linear-gradient(180deg,#FFF6EE_0%,#FFFFFF_100%)]',
    badge: 'bg-[#FFF1E6] text-[#C95A08]',
    icon: 'text-[#FF7A16]',
    accent: 'text-[#8D4C00]',
  },
  rose: {
    shell: 'border-rose-100 bg-[linear-gradient(180deg,#FFF4F5_0%,#FFFFFF_100%)]',
    badge: 'bg-rose-100 text-rose-700',
    icon: 'text-rose-600',
    accent: 'text-rose-800',
  },
  teal: {
    shell: 'border-[#CFE8EE] bg-[linear-gradient(180deg,#F3FBFD_0%,#FFFFFF_100%)]',
    badge: 'bg-[#EAFBFF] text-[#1D6F84]',
    icon: 'text-[#1D6F84]',
    accent: 'text-[#135565]',
  },
  violet: {
    shell: 'border-[#DDD8FF] bg-[linear-gradient(180deg,#F7F5FF_0%,#FFFFFF_100%)]',
    badge: 'bg-[#EEF1FF] text-[#4B57C0]',
    icon: 'text-[#4B57C0]',
    accent: 'text-[#3944A2]',
  },
  emerald: {
    shell: 'border-emerald-100 bg-[linear-gradient(180deg,#F3FCF7_0%,#FFFFFF_100%)]',
    badge: 'bg-emerald-100 text-emerald-700',
    icon: 'text-emerald-600',
    accent: 'text-emerald-800',
  },
};

const statusToneClassMap: Record<OperationsInboxProps['statusTone'], string> = {
  stable: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  caution: 'border-amber-200 bg-amber-50 text-amber-700',
  urgent: 'border-[#FFD7BA] bg-[#FFF2E8] text-[#C95A08]',
};

function InteractiveShell({
  onClick,
  className,
  children,
}: {
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  if (!onClick) {
    return <div className={className}>{children}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-left transition-[transform,border-color,box-shadow] hover:-translate-y-0.5',
        className
      )}
    >
      {children}
    </button>
  );
}

export function OperationsInbox({
  headline,
  summary,
  statusLabel,
  statusTone,
  liveLabel,
  totalOpenCount,
  summaryChips,
  queueItems,
  panels,
  headerActions,
  queueButtonLabel = '전체 보기',
  onOpenQueue,
  className,
}: OperationsInboxProps) {
  const prefersReducedMotion = useReducedMotion();
  const primaryQueueItem = queueItems[0] || null;
  const secondaryQueueItems = queueItems.slice(1, 6);

  return (
    <motion.section
      className={cn('space-y-5 px-1', className)}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <div className="overflow-hidden rounded-[2.25rem] border border-[#DCE7FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F6FAFF_100%)] shadow-[0_28px_60px_-42px_rgba(20,41,95,0.3)]">
        <div className="border-b border-[#E4ECFF] px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn('rounded-full border px-3 py-1 text-[10px] font-black', statusToneClassMap[statusTone])}>
                  {statusLabel}
                </Badge>
                <Badge className="rounded-full border border-[#DCE7FF] bg-white px-3 py-1 text-[10px] font-black text-[#14295F]">
                  <Clock3 className="mr-1.5 h-3.5 w-3.5" />
                  {liveLabel}
                </Badge>
                <Badge className="rounded-full border border-[#DCE7FF] bg-white px-3 py-1 text-[10px] font-black text-[#14295F]">
                  <Inbox className="mr-1.5 h-3.5 w-3.5" />
                  Open {totalOpenCount}건
                </Badge>
              </div>
              <div className="space-y-2">
                <h2 className="text-[1.65rem] font-black tracking-tight text-[#14295F] sm:text-[1.9rem]">
                  {headline}
                </h2>
                <p className="max-w-[48rem] text-sm font-bold leading-6 text-[#5C6E97]">
                  {summary}
                </p>
              </div>
            </div>
            {headerActions ? (
              <div className="flex flex-wrap items-center gap-2">
                {headerActions}
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              'mt-5 grid gap-3 sm:grid-cols-2',
              summaryChips.length >= 6 ? 'xl:grid-cols-6' : 'xl:grid-cols-5'
            )}
          >
            {summaryChips.map((chip) => {
              const toneClasses = toneClassMap[chip.tone];
              return (
                <InteractiveShell
                  key={chip.key}
                  onClick={chip.onClick}
                  className={cn(
                    'rounded-[1.4rem] border px-4 py-3 shadow-[0_18px_34px_-32px_rgba(20,41,95,0.22)]',
                    toneClasses.shell
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5C6E97]">
                        {chip.label}
                      </p>
                      <p className={cn('dashboard-number mt-2 text-[1.45rem] leading-none', toneClasses.accent)}>
                        {chip.value}
                      </p>
                    </div>
                    <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[10px] font-black', toneClasses.badge)}>
                      확인
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] font-bold leading-5 text-[#6E7EA3]">
                    {chip.caption || '바로 열어 확인'}
                  </p>
                </InteractiveShell>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 px-5 py-5 sm:px-6 sm:py-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="rounded-[2rem] border border-[#DCE7FF] bg-white/92 p-4 shadow-[0_20px_42px_-32px_rgba(20,41,95,0.18)] sm:p-5">
            <div className="flex items-start justify-between gap-3 border-b border-[#EEF4FF] pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5C6E97]">우선순위 큐</p>
                <p className="mt-1.5 text-lg font-black tracking-tight text-[#14295F]">오늘 바로 연락/처리</p>
              </div>
              {onOpenQueue ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onOpenQueue}
                  className="h-10 rounded-xl border-2 border-[#DCE7FF] bg-white px-3 text-xs font-black text-[#14295F]"
                >
                  {queueButtonLabel}
                </Button>
              ) : null}
            </div>

            {!primaryQueueItem ? (
              <div className="rounded-[1.55rem] border border-dashed border-[#DCE7FF] bg-[#F7FAFF] px-5 py-10 text-center">
                <AlertCircle className="mx-auto h-6 w-6 text-emerald-500" />
                <p className="mt-3 text-sm font-black text-[#14295F]">지금 바로 처리할 항목이 없습니다.</p>
                <p className="mt-1 text-xs font-bold leading-5 text-[#6E7EA3]">출결과 문의 흐름이 안정적으로 유지되고 있습니다.</p>
              </div>
            ) : (
              <div className="space-y-3 pt-4">
                <InteractiveShell
                  onClick={primaryQueueItem.onClick}
                  className={cn(
                    'rounded-[1.7rem] border px-4 py-4 shadow-[0_22px_40px_-34px_rgba(20,41,95,0.18)] sm:px-5',
                    toneClassMap[primaryQueueItem.tone].shell
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={cn('h-6 rounded-full border-none px-2.5 text-[10px] font-black', toneClassMap[primaryQueueItem.tone].badge)}>
                          1순위
                        </Badge>
                        <Badge className="h-6 rounded-full border-none bg-white px-2.5 text-[10px] font-black text-[#14295F]">
                          {primaryQueueItem.label}
                        </Badge>
                      </div>
                      <p className="mt-3 break-keep text-base font-black leading-7 text-[#14295F]">
                        {primaryQueueItem.title}
                      </p>
                      <p className="mt-2 text-[12px] font-bold leading-6 text-[#5C6E97]">
                        {primaryQueueItem.detail}
                      </p>
                      {primaryQueueItem.meta ? (
                        <p className="mt-2 text-[11px] font-black text-[#8A98B5]">
                          {primaryQueueItem.meta}
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-[#8A98B5]" />
                  </div>
                </InteractiveShell>

                {secondaryQueueItems.map((item, index) => (
                  <InteractiveShell
                    key={item.key}
                    onClick={item.onClick}
                    className="rounded-[1.25rem] border border-[#DCE7FF] bg-[#F7FAFF] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="h-5 rounded-full border-none bg-[#EEF4FF] px-2 text-[10px] font-black text-[#2554D7]">
                            {index + 2}순위
                          </Badge>
                          <p className="truncate text-sm font-black text-[#14295F]">{item.title}</p>
                        </div>
                        <p className="mt-1 text-[11px] font-bold leading-5 text-[#5C6E97]">
                          {item.detail}
                        </p>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#8A98B5]" />
                    </div>
                  </InteractiveShell>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {panels.map((panel) => {
              const toneClasses = toneClassMap[panel.tone];
              return (
                <div
                  key={panel.key}
                  className={cn(
                    'rounded-[1.8rem] border px-4 py-4 shadow-[0_20px_40px_-34px_rgba(20,41,95,0.16)] sm:px-5',
                    toneClasses.shell
                  )}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-white/70 pb-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5C6E97]">{panel.label}</p>
                      <p className="mt-1.5 text-sm font-black text-[#14295F]">{panel.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn('h-6 rounded-full border-none px-2.5 text-[10px] font-black', toneClasses.badge)}>
                        {panel.count}건
                      </Badge>
                      {panel.onOpenAll ? (
                        <button
                          type="button"
                          onClick={panel.onOpenAll}
                          className="text-[11px] font-black text-[#14295F] hover:text-[#2554D7]"
                        >
                          전체 보기
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {panel.rows.length === 0 ? (
                    <div className="flex min-h-[148px] items-center justify-center rounded-[1.35rem] border border-dashed border-[#DCE7FF] bg-white/70 px-4 text-center text-xs font-bold leading-5 text-[#5C6E97]">
                      {panel.emptyLabel}
                    </div>
                  ) : (
                    <div className="space-y-2.5 pt-4">
                      {panel.rows.map((row) => (
                        <InteractiveShell
                          key={row.key}
                          onClick={row.onClick}
                          className="rounded-[1.2rem] border border-white/80 bg-white/84 px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                {row.badge ? (
                                  <Badge className={cn('h-5 rounded-full border-none px-2 text-[10px] font-black', toneClassMap[row.tone].badge)}>
                                    {row.badge}
                                  </Badge>
                                ) : null}
                                {row.meta ? (
                                  <span className="text-[10px] font-black text-[#8A98B5]">{row.meta}</span>
                                ) : null}
                              </div>
                              <p className="mt-2 break-keep text-sm font-black text-[#14295F]">{row.title}</p>
                              <p className="mt-1 text-[11px] font-bold leading-5 text-[#5C6E97]">{row.detail}</p>
                            </div>
                            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#8A98B5]" />
                          </div>
                        </InteractiveShell>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
