'use client';

import { useEffect, useState } from 'react';
import { Clock, Coffee, MapPin, School, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 12 }, (_, index) => (index + 1).toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, index) => (index * 5).toString().padStart(2, '0'));

type ScheduleItemCardProps = {
  item: { id: string; title: string };
  onUpdateRange: (
    itemId: string,
    baseTitle: string,
    start: { h: string; m: string; p: '오전' | '오후' },
    end: { h: string; m: string; p: '오전' | '오후' }
  ) => void;
  onDelete: (item: { id: string; title: string }) => void;
  isPast: boolean;
  isToday: boolean;
  isMobile: boolean;
  disabled?: boolean;
};

export function ScheduleItemCard({
  item,
  onUpdateRange,
  onDelete,
  isPast,
  isToday,
  isMobile,
  disabled = false,
}: ScheduleItemCardProps) {
  const [titlePart, timePart] = item.title.split(': ');

  const from24h = (value: string) => {
    if (!value || !value.includes(':')) return { hour: '09', minute: '00', period: '오전' as const };
    let [hour, minute] = value.split(':').map(Number);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return { hour: '09', minute: '00', period: '오전' as const };
    const period = hour >= 12 ? '오후' : '오전';
    hour = hour % 12 || 12;
    return {
      hour: hour.toString().padStart(2, '0'),
      minute: minute.toString().padStart(2, '0'),
      period,
    };
  };

  const parseRange = (rangeStr: string) => {
    const parts = rangeStr?.split(' ~ ') || [];
    return {
      start: from24h(parts[0]),
      end: from24h(parts[1] || parts[0]),
    };
  };

  const initialRange = parseRange(timePart);
  const [sHour, setSHour] = useState(initialRange.start.hour);
  const [sMin, setSMin] = useState(initialRange.start.minute);
  const [sPer, setSPer] = useState(initialRange.start.period);
  const [eHour, setEHour] = useState(initialRange.end.hour);
  const [eMin, setEMin] = useState(initialRange.end.minute);
  const [ePer, setEPer] = useState(initialRange.end.period);

  useEffect(() => {
    const remote = parseRange(timePart);
    setSHour(remote.start.hour);
    setSMin(remote.start.minute);
    setSPer(remote.start.period);
    setEHour(remote.end.hour);
    setEMin(remote.end.minute);
    setEPer(remote.end.period);
  }, [timePart]);

  const handleValueChange = (type: 's' | 'e', field: 'h' | 'm' | 'p', value: string) => {
    if (disabled || isPast) return;

    let nextSH = sHour;
    let nextSM = sMin;
    let nextSP = sPer;
    let nextEH = eHour;
    let nextEM = eMin;
    let nextEP = ePer;

    if (type === 's') {
      if (field === 'h') { nextSH = value; setSHour(value); }
      if (field === 'm') { nextSM = value; setSMin(value); }
      if (field === 'p') { nextSP = value as '오전' | '오후'; setSPer(value as '오전' | '오후'); }
    } else {
      if (field === 'h') { nextEH = value; setEHour(value); }
      if (field === 'm') { nextEM = value; setEMin(value); }
      if (field === 'p') { nextEP = value as '오전' | '오후'; setEPer(value as '오전' | '오후'); }
    }

    onUpdateRange(item.id, titlePart, { h: nextSH, m: nextSM, p: nextSP }, { h: nextEH, m: nextEM, p: nextEP });
  };

  const getIcon = (title: string) => {
    if (title.includes('등원')) return MapPin;
    if (title.includes('하원')) return School;
    if (title.includes('점심') || title.includes('저녁') || title.includes('식사')) return Coffee;
    return Clock;
  };

  const Icon = getIcon(titlePart);

  const TimePicker = ({ type, h, m, p }: { type: 's' | 'e'; h: string; m: string; p: '오전' | '오후' }) => (
    <div className={cn(
      "flex items-center rounded-xl border border-slate-200 bg-slate-50/90 p-0.5",
      (disabled || isPast) && "pointer-events-none opacity-60"
    )}>
      <Select value={p} onValueChange={(value) => handleValueChange(type, 'p', value)} disabled={disabled || isPast}>
        <SelectTrigger className={cn("h-7 border-none bg-transparent px-1 font-black shadow-none focus:ring-0", isMobile ? "w-[48px] text-[10px]" : "w-[56px] text-xs")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-none shadow-2xl">
          <SelectItem value="오전">오전</SelectItem>
          <SelectItem value="오후">오후</SelectItem>
        </SelectContent>
      </Select>
      <div className="mx-0.5 h-2 w-px bg-slate-300" />
      <Select value={h} onValueChange={(value) => handleValueChange(type, 'h', value)} disabled={disabled || isPast}>
        <SelectTrigger className={cn("h-7 border-none bg-transparent px-1 font-mono font-black shadow-none focus:ring-0", isMobile ? "w-[36px] text-[11px]" : "w-[44px] text-sm")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[200px]">
          {HOURS.map((hour) => <SelectItem key={hour} value={hour}>{hour}</SelectItem>)}
        </SelectContent>
      </Select>
      <span className="px-0.5 text-[9px] font-black opacity-30">:</span>
      <Select value={m} onValueChange={(value) => handleValueChange(type, 'm', value)} disabled={disabled || isPast}>
        <SelectTrigger className={cn("h-7 border-none bg-transparent px-1 font-mono font-black shadow-none focus:ring-0", isMobile ? "w-[36px] text-[11px]" : "w-[44px] text-sm")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[200px]">
          {MINUTES.map((minute) => <SelectItem key={minute} value={minute}>{minute}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className={cn(
      "group relative flex flex-col rounded-[1.45rem] border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md",
      isMobile ? "p-4" : "p-5"
    )}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className={cn("flex shrink-0 items-center justify-center rounded-xl bg-primary/7 text-primary", isMobile ? "p-2" : "p-2.5")}>
            <Icon className={isMobile ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </div>
          <div className="min-w-0">
            <Label className={cn("block truncate font-black tracking-tight text-slate-900", isMobile ? "text-sm" : "text-sm")}>
              {titlePart}
            </Label>
            {isToday ? (
              <p className="mt-0.5 text-[10px] font-bold text-amber-600">오늘 수정 시 벌점 규칙 적용</p>
            ) : null}
          </div>
        </div>
        {!isPast && !disabled ? (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full text-slate-400 transition-all hover:text-destructive",
              isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
            onClick={() => onDelete(item)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <TimePicker type="s" h={sHour} m={sMin} p={sPer} />
        <span className="mx-1 text-center text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">to</span>
        <TimePicker type="e" h={eHour} m={eMin} p={ePer} />
      </div>
    </div>
  );
}
