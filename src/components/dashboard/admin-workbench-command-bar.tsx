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
  variant?: 'default' | 'teacherWorkbench' | 'adminStudio';
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
  variant = 'default',
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
  const isTeacherWorkbench = variant === 'teacherWorkbench';
  const isAdminStudio = variant === 'adminStudio';

  return (
    <section
      className={cn(
        'sticky top-3 z-20 backdrop-blur-xl',
        isTeacherWorkbench
          ? 'rounded-[2.15rem] border border-[#dbe7ff] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,249,255,0.98)_100%)] p-5 shadow-[0_24px_56px_-42px_rgba(20,41,95,0.34)]'
          : isAdminStudio
            ? 'rounded-[2rem] border border-[#1E3B82] bg-[linear-gradient(135deg,rgba(20,41,95,0.98)_0%,rgba(22,48,109,0.97)_52%,rgba(15,31,69,0.98)_100%)] p-4 text-white shadow-[0_28px_64px_-42px_rgba(20,41,95,0.72)]'
            : 'rounded-[2rem] border border-slate-200/80 bg-white/88 p-4 shadow-[0_18px_48px_-38px_rgba(20,41,95,0.36)]',
        className
      )}
    >
      <div className="flex flex-col gap-4">
        <div className={cn(
          'flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between',
          isAdminStudio && 'lg:items-center'
        )}>
          <div className="space-y-1">
            {eyebrow ? (
              <Badge className={cn(
                'rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]',
                isTeacherWorkbench
                  ? 'border border-[#14295F] bg-[#14295F] text-white'
                  : isAdminStudio
                    ? 'border border-white/12 bg-white/10 text-[#FFD7BA]'
                    : 'border border-[#dbe7ff] bg-[#eef4ff] text-[#2554d4]'
              )}>
                {eyebrow}
              </Badge>
            ) : null}
            <h2 className={cn(
              'tracking-tight',
              isTeacherWorkbench
                ? 'font-aggro-display text-[1.35rem] font-black text-[#14295F]'
                : isAdminStudio
                  ? 'font-aggro-display text-[1.35rem] font-black text-white sm:text-[1.55rem]'
                  : 'text-xl font-black text-[#14295F]'
            )}>{title}</h2>
            <p className={cn(
              'font-semibold leading-5',
              isTeacherWorkbench
                ? 'max-w-3xl text-[12px] text-[#5c6e97]'
                : isAdminStudio
                  ? 'max-w-2xl text-[11px] text-white/72 sm:text-[12px]'
                  : 'text-xs text-[#5c6e97]'
            )}>{description}</p>
          </div>

          {quickActions.length > 0 ? (
            <div
              className={cn(
                isAdminStudio
                  ? 'rounded-[1.35rem] border border-white/10 bg-white/10 p-1.5 lg:max-w-[620px]'
                  : 'flex flex-wrap gap-2'
              )}
            >
              <div className={cn(isAdminStudio ? 'flex flex-wrap gap-1' : 'flex flex-wrap gap-2')}>
                {quickActions.map((action) => {
                  const button = (
                    <Button
                      key={action.label}
                      type="button"
                      variant="outline"
                      className={cn(
                        'h-10 rounded-xl px-4 text-xs font-black',
                        isTeacherWorkbench
                          ? 'border-[#dbe7ff] bg-white text-[#14295F] hover:bg-[#f4f7ff]'
                          : isAdminStudio
                            ? 'h-9 rounded-[1rem] border border-transparent bg-white/10 px-3 text-white shadow-none transition-[transform,background-color,border-color,color] hover:-translate-y-0.5 hover:border-[#FF7A16]/60 hover:bg-[#FF7A16]/12 hover:text-[#FFD7BA]'
                            : 'border-slate-200 bg-white text-[#17306f]'
                      )}
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
                        className={cn(
                          'h-10 rounded-xl px-4 text-xs font-black',
                          isTeacherWorkbench
                            ? 'border-[#dbe7ff] bg-white text-[#14295F] hover:bg-[#f4f7ff]'
                            : isAdminStudio
                              ? 'h-9 rounded-[1rem] border border-transparent bg-white/10 px-3 text-white shadow-none transition-[transform,background-color,border-color,color] hover:-translate-y-0.5 hover:border-[#FF7A16]/60 hover:bg-[#FF7A16]/12 hover:text-[#FFD7BA]'
                              : 'border-slate-200 bg-white text-[#17306f]'
                        )}
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
            </div>
          ) : null}
        </div>

        {(onSearchChange || onPeriodChange || (onSelectChange && selectOptions?.length) || children) ? (
          <div className={cn(
            'flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between',
            isAdminStudio &&
              'rounded-[1.45rem] border border-white/10 bg-white/10 p-3'
          )}>
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              {onPeriodChange ? (
                <div className={cn(
                  'inline-flex rounded-xl p-1',
                  isTeacherWorkbench
                    ? 'border border-[#dbe7ff] bg-[#f8fbff]'
                    : isAdminStudio
                      ? 'border border-white/10 bg-white/10'
                      : 'border border-slate-200 bg-slate-50'
                )}>
                  {periodOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onPeriodChange(option.value)}
                      className={cn(
                        'rounded-lg px-3 py-2 text-[11px] font-black transition-colors',
                        periodValue === option.value
                          ? isAdminStudio
                            ? 'bg-white text-[#14295F] shadow-sm'
                            : 'bg-white text-[#17306f] shadow-sm'
                          : isTeacherWorkbench
                            ? 'text-[#5c6e97] hover:text-[#14295F]'
                            : isAdminStudio
                              ? 'text-white/72 hover:text-white'
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
                  <Label className={cn(
                    'text-[10px] font-black uppercase tracking-[0.16em]',
                    isTeacherWorkbench ? 'text-[#5c6e97]' : isAdminStudio ? 'text-white/60' : 'text-slate-500'
                  )}>
                    {selectLabel}
                  </Label>
                  <Select value={selectValue} onValueChange={onSelectChange}>
                    <SelectTrigger className={cn(
                      'h-11 min-w-[180px] rounded-xl border-2 font-black',
                      isTeacherWorkbench && 'border-[#dbe7ff] bg-white text-[#14295F]',
                      isAdminStudio && 'border-white/10 bg-white text-[#14295F]'
                    )}>
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
                  <Search className={cn(
                    'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2',
                    isTeacherWorkbench
                      ? 'text-[#7b8db3]'
                      : isAdminStudio
                        ? 'text-[#8CA1CC]'
                        : 'text-slate-400'
                  )} />
                  <Input
                    value={searchValue}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder={searchPlaceholder}
                    className={cn(
                      'h-11 rounded-xl border-2 pl-10 font-bold',
                      isTeacherWorkbench && 'border-[#dbe7ff] bg-white text-[#14295F] placeholder:text-[#9aa9c7]',
                      isAdminStudio && 'border-white/10 bg-white text-[#14295F] placeholder:text-[#9AA9C7]'
                    )}
                  />
                </div>
              ) : null}
            </div>

            {children ? (
              <div
                className={cn(
                  'flex flex-wrap gap-3',
                  isAdminStudio &&
                    'rounded-[1.2rem] border border-white/10 bg-white/10 px-3 py-2 xl:justify-end'
                )}
              >
                {children}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
