'use client';

import { useEffect, useState } from 'react';

import type { MarketingLaunchNotice } from '@/lib/marketing-content';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

const HIDE_UNTIL_STORAGE_KEY = 'track_marketing_launch_notice_hide_until';

function getNextLocalMidnightTimestamp(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
}

type MarketingLaunchNoticeModalProps = {
  notice: MarketingLaunchNotice;
};

export function MarketingLaunchNoticeModal({ notice }: MarketingLaunchNoticeModalProps) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!notice.enabled) {
      setReady(true);
      return;
    }

    let shouldOpen = true;

    try {
      const rawValue = window.localStorage.getItem(HIDE_UNTIL_STORAGE_KEY);
      const hideUntil = rawValue ? Number(rawValue) : 0;

      if (Number.isFinite(hideUntil) && hideUntil > Date.now()) {
        shouldOpen = false;
      } else if (rawValue) {
        window.localStorage.removeItem(HIDE_UNTIL_STORAGE_KEY);
      }
    } catch {
      shouldOpen = true;
    }

    setOpen(shouldOpen);
    setReady(true);
  }, [notice.enabled]);

  function handleHideForToday() {
    try {
      window.localStorage.setItem(HIDE_UNTIL_STORAGE_KEY, String(getNextLocalMidnightTimestamp()));
    } catch {
      // Ignore storage failures and still close the modal for the current view.
    }

    setOpen(false);
  }

  if (!notice.enabled || !ready) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="w-[calc(100vw-1.5rem)] max-w-[31rem] overflow-hidden rounded-[1.9rem] border border-[#14295F]/12 bg-[linear-gradient(180deg,#FFF9F3_0%,#FFFFFF_100%)] p-0 shadow-[0_28px_64px_rgba(20,41,95,0.24)]"
        aria-describedby="marketing-launch-notice-description"
      >
        <div className="relative overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,122,22,0.16),transparent_30%),radial-gradient(circle_at_left_top,rgba(20,41,95,0.06),transparent_24%)]" />
          <div className="pointer-events-none absolute -right-8 top-0 h-28 w-28 rounded-full bg-[#FFB878]/22 blur-3xl" />
          <div className="pointer-events-none absolute left-3 top-20 h-16 w-16 rounded-full bg-[#8CB7FF]/16 blur-2xl" />

          <div className="relative">
            <span className="inline-flex rounded-full border border-[#FF7A16]/18 bg-white/90 px-3 py-1 text-[10px] font-black tracking-[0.18em] text-[#FF7A16]">
              {notice.eyebrow}
            </span>

            <DialogTitle className="mt-4 break-keep font-aggro-display text-[clamp(1.5rem,4vw,2rem)] font-black leading-[1.16] text-[#14295F]">
              {notice.title}
            </DialogTitle>

            <DialogDescription
              id="marketing-launch-notice-description"
              className="mt-4 break-keep text-[14px] font-semibold leading-[1.85] text-[#415872]"
            >
              {notice.description}
            </DialogDescription>

            <div className="mt-5 rounded-[1.2rem] border border-[#14295F]/10 bg-white/82 px-4 py-3 backdrop-blur">
              <p className="break-keep text-[12px] font-semibold leading-[1.7] text-[#556A82]">{notice.note}</p>
            </div>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleHideForToday}
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#14295F]/12 bg-white px-5 text-[13px] font-black text-[#14295F] transition-colors hover:border-[#14295F]/24 hover:bg-[#F8FBFF]"
              >
                {notice.secondaryLabel}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[#FF7A16] px-5 text-[13px] font-black text-white shadow-[0_12px_24px_rgba(255,122,22,0.22)] transition-transform hover:-translate-y-0.5"
              >
                {notice.primaryLabel}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
