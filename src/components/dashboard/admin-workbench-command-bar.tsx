'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type CommandBarOption = {
  value: string;
  label: string;
};

type QuickAction = {
  label: string;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};

type AdminWorkbenchCommandBarProps = {
  eyebrow?: string;
  title: string;
  description: string;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  searchWidthClassName?: string;
  periodValue?: string;
  onPeriodChange?: (value: string) => void;
  periodOptions?: CommandBarOption[];
  selectValue?: string;
  onSelectChange?: (value: string) => void;
  selectOptions?: CommandBarOption[];
  selectLabel?: string;
  quickActions?: QuickAction[];
  children?: ReactNode;
  className?: string;
};

export function AdminWorkbenchCommandBar({
  eyebrow,
  title,
  description,
  searchValue,
  searchPlaceholder = '학생명, 반, 키워드 검색',
  onSearchChange,
  searchWidthClassName,
  periodValue,
  onPeriodChange,
  periodOptions = [
    { value: 'today', label: '오늘' },
    { value: '7d', label: '7일' },
    { value: '30d', label: '30일' },
  ],
  selectValue,
  onSelectChange,
  selectOptions,
  selectLabel = '반 선택',
  quickActions = [],
  children,
  className,
}: AdminWorkbenchCommandBarProps) {
  return (
    <section
      className={cn(
        'sticky top-3 z-20 rounded-[2rem] border border-slate-200/80 bg-white/88 p-4 shadow-[0_18px_48px_-38px_rgba(20,41,95,0.36)] backdrop-blur-xl',
        className
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            {eyebrow ? (
              <Badge className="rounded-full border border-[#dbe7ff] bg-[#eef4ff] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#2554d4]">
                {eyebrow}
              </Badge>
            ) : null}
            <h2 className="text-xl font-black tracking-tight text-[#14295F]">{title}</h2>
            <p className="text-xs font-semibold leading-5 text-[#5c6e97]">{description}</p>
          </div>

          {quickActions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => {
                const button = (
                  <Button
                    key={action.label}
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl border-slate-200 bg-white px-4 text-xs font-black text-[#17306f]"
                    onClick={action.onClick}
                    disabled={action.disabled}
                  >
                    {action.icon ? <span className="mr-1.5 inline-flex items-center">{action.icon}</span> : null}
                    {action.label}
                  </Button>
                );

                if (action.href) {
                  return (
                    <Button
                      key={action.label}
                      asChild
                      type="button"
                      variant="outline"
                      className="h-10 rounded-xl border-slate-200 bg-white px-4 text-xs font-black text-[#17306f]"
                    >
                      <Link href={action.href}>
                        {action.icon ? <span className="mr-1.5 inline-flex items-center">{action.icon}</span> : null}
                        {action.label}
                      </Link>
                    </Button>
                  );
                }

                return button;
              })}
            </div>
          ) : null}
        </div>

        {(onSearchChange || onPeriodChange || (onSelectChange && selectOptions?.length) || children) ? (
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              {onPeriodChange ? (
                <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {periodOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onPeriodChange(option.value)}
                      className={cn(
                        'rounded-lg px-3 py-2 text-[11px] font-black transition-colors',
                        periodValue === option.value
                          ? 'bg-white text-[#17306f] shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {onSelectChange && selectOptions?.length ? (
                <div className="grid gap-1">
                  <Label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    {selectLabel}
                  </Label>
                  <Select value={selectValue} onValueChange={onSelectChange}>
                    <SelectTrigger className="h-11 min-w-[180px] rounded-xl border-2 font-black">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="font-black">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {onSearchChange ? (
                <div className={cn('relative min-w-0 flex-1 xl:max-w-md', searchWidthClassName)}>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchValue}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-11 rounded-xl border-2 pl-10 font-bold"
                  />
                </div>
              ) : null}
            </div>

            {children ? <div className="flex flex-wrap gap-3">{children}</div> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
