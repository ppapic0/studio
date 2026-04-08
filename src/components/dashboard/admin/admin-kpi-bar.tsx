'use client';

import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { ComponentType } from 'react';

type KpiCardData = {
  key: string;
  label: string;
  value: number | string;
  unit?: string;
  delta?: number | null;
  deltaLabel?: string;
  icon: ComponentType<{ className?: string }>;
  tone: 'navy' | 'orange' | 'emerald' | 'rose' | 'blue' | 'default';
  onClick?: () => void;
};

type AdminKpiBarProps = {
  cards: KpiCardData[];
  isMobile: boolean;
};

const toneStyles = {
  navy: {
    card: 'border-[#C8D8F8] bg-[linear-gradient(180deg,#14295F_0%,#1B3D89_100%)] text-white',
    label: 'text-white/55',
    value: 'text-white',
    delta: 'text-white/60',
    iconBg: 'bg-white/10',
    iconColor: 'text-white/70',
  },
  orange: {
    card: 'border-[#FFD7BA] bg-[linear-gradient(180deg,#FFF6EE_0%,#FFFFFF_100%)] admin-glow-pulse',
    label: 'text-[#C95A08]',
    value: 'text-[#C95A08]',
    delta: 'text-[#C95A08]/70',
    iconBg: 'bg-[#FF7A16]/10',
    iconColor: 'text-[#FF7A16]',
  },
  emerald: {
    card: 'border-emerald-100 bg-[linear-gradient(180deg,#F0FDF4_0%,#FFFFFF_100%)]',
    label: 'text-emerald-700/70',
    value: 'text-emerald-800',
    delta: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  rose: {
    card: 'border-rose-100 bg-[linear-gradient(180deg,#FFF1F2_0%,#FFFFFF_100%)]',
    label: 'text-rose-700/70',
    value: 'text-rose-800',
    delta: 'text-rose-600',
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
  },
  blue: {
    card: 'border-[#DCE7FF] bg-[linear-gradient(180deg,#F0F5FF_0%,#FFFFFF_100%)]',
    label: 'text-[#5c6e97]',
    value: 'text-[#14295F]',
    delta: 'text-[#2554D7]',
    iconBg: 'bg-[#EEF4FF]',
    iconColor: 'text-[#2554D7]',
  },
  default: {
    card: 'border-[#DCE7FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)]',
    label: 'text-[#5c6e97]',
    value: 'text-[#14295F]',
    delta: 'text-[#5c6e97]',
    iconBg: 'bg-[#F7FAFF]',
    iconColor: 'text-[#5c6e97]',
  },
};

export function AdminKpiBar({ cards, isMobile }: AdminKpiBarProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={cn(
      'grid gap-3',
      isMobile ? 'grid-cols-2' : 'grid-cols-3 xl:grid-cols-6'
    )}>
      {cards.map((card, index) => {
        const styles = toneStyles[card.tone];
        const Icon = card.icon;
        const isClickable = !!card.onClick;

        return (
          <motion.div
            key={card.key}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.06 + index * 0.05, ease: 'easeOut' }}
          >
            <button
              type="button"
              disabled={!isClickable}
              onClick={card.onClick}
              className={cn(
                'admin-card-lift group w-full rounded-[1.5rem] border p-4 text-left',
                styles.card,
                isClickable && 'cursor-pointer',
                !isClickable && 'cursor-default'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={cn('text-[10px] font-black uppercase tracking-[0.18em]', styles.label)}>
                  {card.label}
                </p>
                <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-[0.7rem]', styles.iconBg)}>
                  <Icon className={cn('h-3.5 w-3.5', styles.iconColor)} />
                </span>
              </div>

              <div className="mt-3 flex items-end gap-2">
                <span className={cn('admin-kpi-number text-[1.75rem]', styles.value)}>
                  {card.value}
                </span>
                {card.unit && (
                  <span className={cn('mb-0.5 text-xs font-bold', styles.label)}>
                    {card.unit}
                  </span>
                )}
              </div>

              {card.delta !== null && card.delta !== undefined && card.delta !== 0 && (
                <div className={cn('mt-2 flex items-center gap-1', styles.delta)}>
                  {card.delta > 0 ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-rose-500" />
                  )}
                  <span className={cn('text-[11px] font-bold', card.delta > 0 ? 'text-emerald-600' : 'text-rose-500')}>
                    {card.deltaLabel || `${card.delta > 0 ? '+' : ''}${card.delta}`}
                  </span>
                </div>
              )}

              {card.delta === 0 && card.deltaLabel && (
                <p className={cn('mt-2 text-[11px] font-bold', styles.delta)}>
                  {card.deltaLabel}
                </p>
              )}
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}
