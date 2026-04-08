'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Clock, Search, Send, MessageSquare, ClipboardCheck, Users, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';

type AdminExecutiveHeaderProps = {
  centerName: string;
  dateLabel: string;
  timeLabel: string;
  statusLabel: string;
  statusLevel: 'stable' | 'warning' | 'critical';
  totalAlerts: number;
  isMobile: boolean;
  onOpenMemo: () => void;
  onOpenAnnouncement: () => void;
  onOpenAttendancePriority: () => void;
};

export function AdminExecutiveHeader({
  centerName,
  dateLabel,
  timeLabel,
  statusLabel,
  statusLevel,
  totalAlerts,
  isMobile,
  onOpenMemo,
  onOpenAnnouncement,
  onOpenAttendancePriority,
}: AdminExecutiveHeaderProps) {
  const prefersReducedMotion = useReducedMotion();

  const statusConfig = {
    stable: {
      badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
      dotClass: 'bg-emerald-500',
      label: '안정',
    },
    warning: {
      badgeClass: 'bg-amber-500/10 text-amber-700 border-amber-200',
      dotClass: 'bg-amber-500 admin-alert-dot',
      label: '주의',
    },
    critical: {
      badgeClass: 'bg-[#FF7A16]/10 text-[#C95A08] border-[#FFD7BA]',
      dotClass: 'bg-[#FF7A16] admin-alert-dot',
      label: '즉시 점검',
    },
  }[statusLevel];

  const quickActions = [
    { icon: Send, label: '공지 보내기', onClick: onOpenAnnouncement },
    { icon: StickyNote, label: '운영 메모', onClick: onOpenMemo },
    { icon: ClipboardCheck, label: '출결 확인', onClick: onOpenAttendancePriority },
  ];

  return (
    <motion.header
      className="relative overflow-hidden rounded-[2rem] border border-[#1C3A82] admin-exec-header text-white shadow-[0_32px_64px_-40px_rgba(20,41,95,0.6)]"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(37,84,215,0.2),transparent_50%)]" />

      <div className="relative px-6 py-5 sm:px-8 sm:py-6">
        <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-center justify-between')}>
          {/* Left: Center identity + status */}
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className={cn('rounded-full border px-3 py-1 text-[10px] font-black', statusConfig.badgeClass)}>
                <span className={cn('mr-1.5 inline-block h-1.5 w-1.5 rounded-full', statusConfig.dotClass)} />
                {statusConfig.label}
              </Badge>
              {totalAlerts > 0 && (
                <Badge className="rounded-full border border-[#FFB57A]/30 bg-[#FF7A16]/14 px-2.5 py-1 text-[10px] font-black text-[#FFD7BA]">
                  경고 {totalAlerts}건
                </Badge>
              )}
            </div>

            <h1 className="admin-section-title text-[1.75rem] tracking-tight text-white sm:text-[2rem]">
              {centerName || '센터 운영 현황'}
            </h1>

            <p className="text-sm font-semibold text-white/60">
              {dateLabel} · {statusLabel}
            </p>
          </div>

          {/* Right: Time + Quick Actions */}
          <div className={cn('flex gap-3', isMobile ? 'flex-wrap' : 'items-center')}>
            {/* Live clock */}
            <div className="flex items-center gap-2 rounded-[1.2rem] border border-white/10 bg-white/8 px-4 py-2.5">
              <Clock className="h-3.5 w-3.5 text-white/50" />
              <span className="admin-kpi-number text-lg text-white">{timeLabel}</span>
            </div>

            {/* Quick action buttons */}
            <div className="flex gap-1.5">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    title={action.label}
                    className="group inline-flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/10 bg-white/8 text-white/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF7A16]/40 hover:bg-[#FF7A16]/14 hover:text-white"
                  >
                    <Icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}
