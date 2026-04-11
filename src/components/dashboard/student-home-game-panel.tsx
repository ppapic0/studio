"use client";

import { useId, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Crown,
  Flame,
  Gift,
  History,
  Lock,
  Play,
  Swords,
  Target,
  Timer,
  TrendingUp,
} from "lucide-react";

import {
  RewardHeroBox,
  type RewardBoxRarity as BoxRarity,
  type RewardBoxStage as BoxStage,
  type RewardBoxState as BoxState,
} from "@/components/dashboard/reward-box-visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { GrowthProgress } from "@/lib/types";
import { cn } from "@/lib/utils";

type RankRange = "daily" | "weekly" | "monthly";

const HOME_RANK_CARD_BASE =
  "student-utility-card relative w-full overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(89,133,223,0.34),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,188,102,0.14),transparent_40%),linear-gradient(180deg,rgba(7,17,35,0.98)_0%,rgba(12,28,58,0.98)_52%,rgba(20,41,95,0.98)_100%)] text-left shadow-[0_30px_56px_-30px_rgba(0,0,0,0.72)]";
const HOME_RANK_CARD_INSET =
  "rounded-[1.18rem] border border-white/10 bg-[rgba(255,255,255,0.06)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_32px_-28px_rgba(0,0,0,0.62)]";
const HOME_RANK_CARD_BADGE =
  "inline-flex items-center gap-2 rounded-full border border-[#F5C97B]/30 bg-[rgba(255,198,112,0.08)] text-[#FFD99D]";
const HOME_RANK_CARD_LIVE_BADGE =
  "inline-flex items-center gap-1.5 rounded-full border border-[#FFB66E]/28 bg-[rgba(255,182,110,0.12)] text-[#FFCB95]";

export type StudentHomeQuest = {
  id: string;
  title: string;
  reward?: number;
  done: boolean;
  subjectLabel?: string;
  timeLabel?: string;
};

export type StudentHomeRewardBox = {
  id: string;
  hour: number;
  state: BoxState;
  rarity: BoxRarity;
  reward?: number;
};

export type StudentHomeRankPreviewEntry = {
  rank: number;
  studentId: string | null;
  name: string;
  schoolName: string | null;
  minutes: number;
  baseMinutes: number;
  displaySeconds?: number;
  isLive?: boolean;
};

export type StudentHomeRankState = {
  title: string;
  rank: number;
  minutes: number;
  badge: string;
  caption: string;
  description?: string;
  preview: StudentHomeRankPreviewEntry[];
  isLoading: boolean;
  isLive?: boolean;
  liveBadge?: string | null;
};

function formatRankPreviewSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const mins = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  if (hours === 0 && mins === 0 && secs === 0) return "0h 0m 0s";
  if (hours > 0) return `${hours}h ${mins}m ${secs.toString().padStart(2, "0")}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function getRankPreviewSeconds(entry: StudentHomeRankPreviewEntry) {
  if (typeof entry.displaySeconds === "number" && Number.isFinite(entry.displaySeconds)) {
    return Math.max(0, Math.floor(entry.displaySeconds));
  }
  return Math.max(0, Math.round((entry.baseMinutes ?? entry.minutes) * 60));
}

function RankPreviewTimeBadge({
  entry,
  compact = false,
  className,
}: {
  entry: StudentHomeRankPreviewEntry;
  compact?: boolean;
  className?: string;
}) {
  const label = formatRankPreviewSeconds(getRankPreviewSeconds(entry));

  return (
    <div className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className, entry.isLive && "leaderboard-live-chip")}>
      {entry.isLive ? (
        <span
          className={cn(
            "rounded-full bg-[#FF7A16] shadow-[0_0_0_3px_rgba(255,122,22,0.12)] leaderboard-live-dot",
            compact ? "h-1.5 w-1.5" : "h-2 w-2"
          )}
        />
      ) : null}
      <span
        key={`${entry.rank}-${label}`}
        className={cn(
          "inline-flex items-center whitespace-nowrap",
          entry.isLive && "leaderboard-live-time leaderboard-ticker-item"
        )}
      >
        {label}
      </span>
    </div>
  );
}

function formatRankStudentName(name?: string | null) {
  const source = typeof name === "string" ? name.trim() : "";
  return source || "학생";
}

function getRankRangeLabel(range: RankRange) {
  return range === "daily" ? "일간" : range === "weekly" ? "주간" : "월간";
}

function getRankEntryStatusLabel(entry: StudentHomeRankPreviewEntry) {
  const previewSeconds = getRankPreviewSeconds(entry);
  const baseSeconds = Math.max(0, Math.round((entry.baseMinutes ?? entry.minutes) * 60));
  if (entry.isLive || previewSeconds > baseSeconds) return "공부중";
  if (previewSeconds > 0) return "휴식중";
  return "대기중";
}

function QuestRow({
  quest,
  onToggle,
  gainKey,
  disabled = false,
}: {
  quest: StudentHomeQuest;
  onToggle: (id: string) => void;
  gainKey?: number | null;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(quest.id)}
      disabled={disabled}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-[1.25rem] px-4 py-3 text-left transition-all duration-200",
        disabled && "cursor-wait opacity-70",
        quest.done
          ? "border border-emerald-300/32 bg-[linear-gradient(180deg,rgba(47,170,125,0.2),rgba(13,28,69,0.92))]"
          : "surface-card surface-card--secondary on-dark hover:-translate-y-0.5 hover:border-[rgba(255,138,31,0.3)]",
      )}
    >
      {gainKey ? (
        <span
          key={gainKey}
          className="pointer-events-none absolute right-3 top-2 rounded-full border border-[rgba(255,138,31,0.26)] bg-[rgba(255,138,31,0.16)] px-2 py-1 text-[11px] font-black text-[var(--accent-orange-soft)]"
          style={{ animation: "planner-fade-rise 900ms ease-out both" }}
        >
          완료!
        </span>
      ) : null}
      <span
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all",
          quest.done
            ? "border-emerald-300/40 bg-emerald-300/18 text-emerald-100"
            : "border-white/14 bg-white/12 text-[var(--text-on-dark)]",
        )}
      >
        {quest.done ? <Check className="h-4 w-4" /> : <Target className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {quest.subjectLabel ? (
            <span className="surface-chip surface-chip--dark px-2 py-1 text-[10px] uppercase tracking-[0.16em]">
              {quest.subjectLabel}
            </span>
          ) : null}
          {quest.timeLabel ? (
            <span className="text-[11px] font-black text-[var(--accent-orange-soft)]">{quest.timeLabel}</span>
          ) : null}
        </div>
        <div
          className={cn(
            "mt-1 text-sm font-black tracking-tight",
            quest.done ? "text-[var(--text-on-dark-soft)] line-through decoration-white/35" : "text-[var(--text-on-dark)]",
          )}
        >
          {quest.title}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]">status</div>
        <div className="mt-1 text-sm font-black text-[var(--accent-orange-soft)]">{quest.done ? "완료" : "진행"}</div>
      </div>
    </button>
  );
}

const HOME_GROWTH_TRACK_POINTS = [
  { progress: 0, x: 18, y: 72 },
  { progress: 18, x: 58, y: 71 },
  { progress: 40, x: 100, y: 59 },
  { progress: 62, x: 144, y: 36 },
  { progress: 82, x: 192, y: 43 },
  { progress: 100, x: 224, y: 48 },
] as const;

function interpolateHomeGrowthTrack(progress: number) {
  const clamped = Math.max(0, Math.min(100, progress));

  for (let index = 0; index < HOME_GROWTH_TRACK_POINTS.length - 1; index += 1) {
    const start = HOME_GROWTH_TRACK_POINTS[index];
    const end = HOME_GROWTH_TRACK_POINTS[index + 1];

    if (clamped >= start.progress && clamped <= end.progress) {
      const range = end.progress - start.progress || 1;
      const t = (clamped - start.progress) / range;
      return {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      };
    }
  }

  const fallback = HOME_GROWTH_TRACK_POINTS[HOME_GROWTH_TRACK_POINTS.length - 1];
  return { x: fallback.x, y: fallback.y };
}

function HomeGrowthTrack({
  isMobile,
  growthPercent,
  sessionTimerLabel,
}: {
  isMobile: boolean;
  growthPercent: number;
  sessionTimerLabel: string | null;
}) {
  const isStudying = Boolean(sessionTimerLabel);
  const clampedProgress = Math.max(0, Math.min(100, growthPercent));
  const runnerPoint = interpolateHomeGrowthTrack(clampedProgress);
  const gradientId = useId().replace(/:/g, "");
  const laneGradientId = `${gradientId}-lane`;
  const runnerLeft = `${(runnerPoint.x / 240) * 100}%`;
  const runnerTop = `${(runnerPoint.y / 96) * 100}%`;

  return (
    <div
      className={cn(
        "student-home-track-progress",
        isStudying ? "student-home-track-progress--live" : "student-home-track-progress--idle",
        clampedProgress >= 100 && "student-home-track-progress--complete",
      )}
    >
      <div className="student-home-track-progress__surface" />
      <svg
        viewBox="0 0 240 96"
        className={cn("student-home-track-progress__svg", isMobile ? "h-[92px]" : "h-[104px]")}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={laneGradientId} x1="18" y1="72" x2="224" y2="48" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(255,255,255,0.26)" />
            <stop offset="0.48" stopColor="rgba(255,255,255,0.82)" />
            <stop offset="1" stopColor="rgba(255,210,108,0.96)" />
          </linearGradient>
        </defs>
        <path
          d="M18 72C48 72 72 70 98 58C124 46 144 28 170 32C194 36 210 48 224 48"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M18 72C48 72 72 70 98 58C124 46 144 28 170 32C194 36 210 48 224 48"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="2.8"
          strokeLinecap="round"
          className="track-pace-lane"
        />
        <path
          d="M18 72C48 72 72 70 98 58C124 46 144 28 170 32C194 36 210 48 224 48"
          stroke={`url(#${laneGradientId})`}
          strokeWidth="3.6"
          strokeLinecap="round"
          className={cn(isStudying && "track-pace-dash")}
        />
        <circle cx="18" cy="72" r="5.5" fill="#F8FBFF" opacity="0.84" />
        <circle cx="84" cy="63" r="3.5" fill="#F8FBFF" opacity="0.32" />
        <circle cx="152" cy="31" r="3.5" fill="#F8FBFF" opacity="0.32" />
        <circle cx="224" cy="48" r="5.8" fill="#FFD26C" />
        <circle
          cx="224"
          cy="48"
          r="12"
          fill="#FFD26C"
          opacity={clampedProgress >= 100 ? "0.28" : "0.18"}
          className={cn(clampedProgress >= 100 && "track-pace-node-glow")}
        />
      </svg>

      <div
        className={cn(
          "student-home-track-progress__runner",
          isStudying ? "student-home-track-progress__runner--live" : "student-home-track-progress__runner--idle",
        )}
        style={{ left: runnerLeft, top: runnerTop }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 64 64" className="student-home-track-progress__runner-svg" fill="none">
          {isStudying ? (
            <g className="track-pace-vehicle track-pace-vehicle--run" transform="translate(10 2)">
              <ellipse className="track-pace-runner-shadow" cx="23" cy="59" rx="15.5" ry="4.4" fill="rgba(255,236,211,0.18)" />
              <path className="track-pace-runner-streak" d="M-8 38H8" stroke="rgba(255,255,255,0.22)" strokeWidth="3" strokeLinecap="round" />
              <path className="track-pace-runner-streak" d="M-2 31H11" stroke="rgba(255,255,255,0.14)" strokeWidth="2.2" strokeLinecap="round" />
              <circle className="track-pace-runner-head" cx="18" cy="10" r="6.9" fill="#FFE0BC" />
              <path
                className="track-pace-runner-torso"
                d="M15 19L26 30L21 41"
                stroke="#FFF9F3"
                strokeWidth="5.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M23 27L31 22" stroke="#FFF4E8" strokeWidth="4.6" strokeLinecap="round" />
              <path
                className="track-pace-runner-arm-front"
                d="M25 29L38 23L45 29"
                stroke="#FFE2C0"
                strokeWidth="4.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                className="track-pace-runner-arm-back"
                d="M20 25L8 31"
                stroke="#FFD9AF"
                strokeWidth="4.7"
                strokeLinecap="round"
              />
              <path
                className="track-pace-runner-leg-front"
                d="M21 41L35 50L45 47"
                stroke="#FFBF77"
                strokeWidth="5.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                className="track-pace-runner-leg-back"
                d="M21 41L13 54L5 50"
                stroke="#FFCF8C"
                strokeWidth="5.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ) : (
            <g className="track-pace-vehicle track-pace-vehicle--idle" transform="translate(11 6)">
              <ellipse className="track-pace-idle-shadow" cx="21" cy="56" rx="14" ry="4.2" fill="rgba(255,236,211,0.16)" />
              <circle cx="21" cy="10" r="6.8" fill="#FFE0BC" />
              <path
                d="M21 19L21 33L21 43"
                stroke="#FFF9F3"
                strokeWidth="5.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M21 25L30 29" stroke="#FFE4C7" strokeWidth="4.4" strokeLinecap="round" />
              <path d="M21 25L12 29" stroke="#FFDAB0" strokeWidth="4.4" strokeLinecap="round" />
              <path d="M21 43L28 55" stroke="#FFBF77" strokeWidth="5.1" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 43L14 55" stroke="#FFCF8C" strokeWidth="5.1" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}
        </svg>
      </div>

      <div className="student-home-track-progress__legend" aria-hidden="true">
        <span>START</span>
        <span>{isStudying ? "RUN" : "IDLE"}</span>
        <span>GOAL</span>
      </div>
    </div>
  );
}

function RewardModal({
  open,
  onOpenChange,
  selectedBox,
  boxContextLabel,
  boxStage,
  onReveal,
  revealedReward,
  onNextBox,
  todayOpenedBoxCount,
  nextCountdownLabel,
  hasMoreBoxes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBox: StudentHomeRewardBox | null;
  boxContextLabel?: string | null;
  boxStage: BoxStage;
  onReveal: () => void;
  revealedReward: number | null;
  onNextBox: () => void;
  todayOpenedBoxCount: number;
  nextCountdownLabel: string;
  hasMoreBoxes: boolean;
}) {
  const canRevealSelectedBox =
    revealedReward === null && Boolean(selectedBox && (selectedBox.state === "ready" || selectedBox.state === "opened"));
  const revealHeadline =
    selectedBox?.state === "opened" ? "다시 확인하기" : "터치해서 열기";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "point-track-modal-shell w-[min(92vw,26rem)] overflow-hidden rounded-[2rem] border-none bg-transparent p-0 text-white shadow-none",
          selectedBox?.rarity === "rare" && "point-track-modal-shell--rare",
          selectedBox?.rarity === "epic" && "point-track-modal-shell--epic",
        )}
      >
        <div className="p-5">
          <DialogHeader>
            <DialogTitle className="text-left text-xl font-black tracking-tight">
              {revealedReward !== null ? "보상 획득" : "상자 열기"}
            </DialogTitle>
            {boxContextLabel ? (
              <DialogDescription className="mt-1 text-left text-[12px] font-semibold text-white/72">
                {boxContextLabel}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <div
            className={cn(
              "point-track-modal-stage mt-4 text-center",
              selectedBox?.rarity === "rare" && "point-track-modal-stage--rare",
              selectedBox?.rarity === "epic" && "point-track-modal-stage--epic",
            )}
          >
            <div className="point-track-modal-particles">
              {Array.from({ length: 7 }).map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    "point-track-modal-particle",
                    boxStage === "burst" || boxStage === "revealed"
                      ? "point-track-modal-particle--visible"
                      : "",
                  )}
                />
              ))}
            </div>
            <RewardHeroBox
              state="ready"
              intense={boxStage === "shake" || boxStage === "burst" || boxStage === "revealed"}
              stage={boxStage}
              rarity={selectedBox?.rarity ?? null}
              label={`${selectedBox?.hour || 0}시간 상자`}
              onClick={canRevealSelectedBox ? onReveal : undefined}
            />
            {revealedReward === null ? (
              <div className="mt-4">
                <div className="text-sm font-black text-[var(--accent-orange-soft)]">
                  {selectedBox ? `${selectedBox.hour}시간 상자` : "보상 상자"}
                </div>
                {boxContextLabel ? (
                  <div className="mt-1 text-[11px] font-semibold text-white/70">{boxContextLabel}</div>
                ) : null}
                <div className="mt-2 text-xl font-black tracking-tight text-white">{revealHeadline}</div>
              </div>
            ) : (
              <div className="point-track-reward-burst surface-card surface-card--highlight mt-5 rounded-[1.35rem] px-4 py-5">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--text-on-accent)]">reward</div>
                <div className="mt-2 text-[2rem] font-black tracking-tight text-[var(--text-on-accent)]">
                  +{revealedReward.toLocaleString()}P
                </div>
                <div className="mt-2 text-sm font-semibold text-[rgba(14,28,56,0.76)]">
                  이번 상자 보상이에요.
                </div>
                <div className="mt-3 rounded-full border border-[rgba(14,28,56,0.12)] bg-[rgba(255,255,255,0.56)] px-3 py-2 text-[11px] font-black text-[rgba(14,28,56,0.72)]">
                  오늘 연 상자 {todayOpenedBoxCount}개
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <Button
              type="button"
              variant="dark"
              className="h-12 flex-1 rounded-[1rem]"
              onClick={() => onOpenChange(false)}
            >
              닫기
            </Button>
            {revealedReward !== null ? (
              <Button
                type="button"
                variant="secondary"
                className="point-track-hero-cta h-12 flex-1 rounded-[1rem]"
                onClick={hasMoreBoxes ? onNextBox : () => onOpenChange(false)}
              >
                {hasMoreBoxes ? "다음 상자" : "확인"}
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatPointHistoryDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  if ([year, month, day].every((value) => Number.isFinite(value) && value > 0)) {
    return `${month}/${day}`;
  }
  return dateKey;
}

function getActivityHistorySummary(options: {
  studyBoxes: number;
  hasAttendance: boolean;
  hasPlan: boolean;
  hasRoutine: boolean;
  dailyRankRewardRank: number;
  weeklyRankRewardRank: number;
  monthlyRankRewardRank: number;
}) {
  const {
    studyBoxes,
    hasAttendance,
    hasPlan,
    hasRoutine,
    dailyRankRewardRank,
    weeklyRankRewardRank,
    monthlyRankRewardRank,
  } = options;

  if (monthlyRankRewardRank > 0) return `월간 ${monthlyRankRewardRank}위`;
  if (weeklyRankRewardRank > 0) return `주간 ${weeklyRankRewardRank}위`;
  if (dailyRankRewardRank > 0) return `일간 ${dailyRankRewardRank}위`;
  if (studyBoxes > 0) return `상자 ${studyBoxes}개`;
  if (hasPlan) return "계획 완료";
  if (hasAttendance) return "출석 기록";
  if (hasRoutine) return "루틴 기록";
  return "활동 기록";
}

function PointHistoryModal({
  open,
  onOpenChange,
  dailyPointStatus,
  isMobile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dailyPointStatus?: GrowthProgress["dailyPointStatus"];
  isMobile: boolean;
}) {
  const sortedDates = useMemo(() => {
    if (!dailyPointStatus) return [];
    return Object.entries(dailyPointStatus)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 30);
  }, [dailyPointStatus]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-[26rem] overflow-hidden rounded-[2rem] border-[#DCE5F8] bg-[radial-gradient(circle_at_top_right,rgba(255,179,71,0.18),transparent_26%),linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] p-0 text-[#17326B] shadow-[0_28px_60px_-30px_rgba(19,50,107,0.24)]", isMobile ? "w-[min(94vw,26rem)]" : "")}>
        <div className={cn("border-b border-[#E4ECFA] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,250,255,0.96))]", isMobile ? "px-5 py-5" : "px-6 py-6")}>
          <DialogHeader className="text-left">
            <DialogTitle className="text-[1.35rem] font-black tracking-tight text-[#17326B]">일자별 활동 기록</DialogTitle>
          </DialogHeader>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-[#5F739F]">최근 30일 동안 출석, 계획, 상자, 랭킹 보상 기록을 한눈에 확인할 수 있어요.</p>
        </div>

        <div className={cn("max-h-[26rem] space-y-2 overflow-y-auto bg-[#F7FAFF] custom-scrollbar", isMobile ? "px-4 py-4" : "px-5 py-5")}>
          {sortedDates.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-[#D8E4F8] bg-white/85 px-4 py-10 text-center">
              <div className="text-sm font-black text-[#17326B]">아직 활동 기록이 없어요.</div>
              <div className="mt-1 text-[11px] font-semibold text-[#6B7EA8]">공부를 시작하거나 계획을 체크하면 여기에 일자별 내역이 쌓입니다.</div>
            </div>
          ) : (
            sortedDates.map(([date, data]) => {
              const studyBoxes = Array.isArray(data?.claimedStudyBoxes) ? data.claimedStudyBoxes.length : 0;
              const dailyRankRewardAmount = Math.max(0, Number(data?.dailyRankRewardAmount || data?.dailyTopRewardAmount || 0));
              const dailyRankRewardRank = Math.max(0, Number(data?.dailyRankRewardRank || (dailyRankRewardAmount > 0 ? 1 : 0)));
              const weeklyRankRewardAmount = Math.max(0, Number(data?.weeklyRankRewardAmount || 0));
              const weeklyRankRewardRank = Math.max(0, Number(data?.weeklyRankRewardRank || 0));
              const monthlyRankRewardAmount = Math.max(0, Number(data?.monthlyRankRewardAmount || 0));
              const monthlyRankRewardRank = Math.max(0, Number(data?.monthlyRankRewardRank || 0));
              const summaryLabel = getActivityHistorySummary({
                studyBoxes,
                hasAttendance: Boolean(data?.attendance),
                hasPlan: Boolean(data?.plan || data?.planTrackCompleted),
                hasRoutine: Boolean(data?.routine),
                dailyRankRewardRank,
                weeklyRankRewardRank,
                monthlyRankRewardRank,
              });

              return (
                <div key={date} className="rounded-[1.3rem] border border-[#E1EAF8] bg-white/90 px-4 py-3 shadow-[0_18px_34px_-26px_rgba(19,50,107,0.18)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6B7EA8]">
                        {formatPointHistoryDateLabel(date)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {data?.attendance ? <Badge variant="outline" className="border-none bg-[#4F8CFF] px-2 py-1 text-[9px] font-black text-white">출석</Badge> : null}
                        {(data?.plan || data?.planTrackCompleted) ? <Badge variant="outline" className="border-none bg-[#11A868] px-2 py-1 text-[9px] font-black text-white">계획</Badge> : null}
                        {data?.routine ? <Badge variant="outline" className="border-none bg-[#FF9B24] px-2 py-1 text-[9px] font-black text-white">루틴</Badge> : null}
                        {studyBoxes > 0 ? <Badge variant="outline" className="border-none bg-[#14295F] px-2 py-1 text-[9px] font-black text-white">상자 {studyBoxes}</Badge> : null}
                        {dailyRankRewardAmount > 0 ? <Badge variant="outline" className="border-none bg-violet-600 px-2 py-1 text-[9px] font-black text-white">일간 {dailyRankRewardRank || 1}위</Badge> : null}
                        {weeklyRankRewardAmount > 0 ? <Badge variant="outline" className="border-none bg-fuchsia-600 px-2 py-1 text-[9px] font-black text-white">주간 {weeklyRankRewardRank}위</Badge> : null}
                        {monthlyRankRewardAmount > 0 ? <Badge variant="outline" className="border-none bg-rose-600 px-2 py-1 text-[9px] font-black text-white">월간 {monthlyRankRewardRank}위</Badge> : null}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-black tracking-tight text-[#17326B]">{summaryLabel}</div>
                      <div className="mt-1 text-[10px] font-semibold text-[#6B7EA8]">대표 기록</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-[#E4ECFA] bg-white px-4 py-4">
          <Button type="button" variant="outline" className="h-11 w-full rounded-[1rem] border-[#D8E4F8] font-black text-[#17326B]" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StudentHomeGamePanel({
  isMobile,
  dateLabel,
  heroMessage,
  totalMinutesLabel,
  growthLabel,
  growthPercent,
  growthDeltaLabel,
  primaryActionLabel,
  onPrimaryAction,
  primaryActionActive,
  sessionTimerLabel,
  totalAvailableBoxes,
  boxStatusLabel,
  boxSubLabel,
  boxPreviewRarity,
  onOpenMainBox,
  nextBoxCounter,
  nextBoxCaption,
  isNearNextBox,
  arrivalCount,
  todayStudyLabel,
  growthDeltaPercent,
  todayOpenedBoxCount,
  homeFocusSummaryLabel,
  onOpenFocusEditor,
  dailyPointStatus,
  quests,
  questGain,
  pendingQuestIds = [],
  onToggleQuest,
  onOpenPlan,
  weeklyTrend,
  bestDayLabel,
  selectedRankRange,
  onSelectRankRange,
  selectedHomeRank,
  onOpenLeaderboard,
  isVaultOpen,
  onVaultChange,
  selectedBox,
  vaultReadyBoxCount,
  boxContextLabel,
  boxStage,
  onRevealBox,
  revealedReward,
  onNextBox,
  nextCountdownLabel,
}: {
  isMobile: boolean;
  dateLabel: string;
  heroMessage: string | null;
  totalMinutesLabel: string;
  growthLabel: string;
  growthPercent: number;
  growthDeltaLabel: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  primaryActionActive: boolean;
  sessionTimerLabel: string | null;
  totalAvailableBoxes: number;
  boxStatusLabel: string;
  boxSubLabel: string;
  boxPreviewRarity?: BoxRarity | null;
  onOpenMainBox: (hour?: number) => void;
  nextBoxCounter: string;
  nextBoxCaption: string;
  isNearNextBox: boolean;
  arrivalCount: number;
  todayStudyLabel: string;
  growthDeltaPercent: number;
  todayOpenedBoxCount: number;
  homeFocusSummaryLabel: string;
  onOpenFocusEditor: () => void;
  dailyPointStatus?: GrowthProgress["dailyPointStatus"];
  quests: StudentHomeQuest[];
  questGain: { id: string; key: number; amount: number } | null;
  pendingQuestIds?: string[];
  onToggleQuest: (id: string) => void;
  onOpenPlan: () => void;
  weeklyTrend: Array<{ date: string; minutes: number }>;
  bestDayLabel: string;
  selectedRankRange: RankRange;
  onSelectRankRange: (range: RankRange) => void;
  selectedHomeRank: StudentHomeRankState;
  onOpenLeaderboard: () => void;
  isVaultOpen: boolean;
  onVaultChange: (open: boolean) => void;
  selectedBox: StudentHomeRewardBox | null;
  vaultReadyBoxCount?: number;
  boxContextLabel?: string | null;
  boxStage: BoxStage;
  onRevealBox: () => void;
  revealedReward: number | null;
  onNextBox: () => void;
  nextCountdownLabel: string;
  }) {
  const maxTrend = weeklyTrend.reduce((max, item) => Math.max(max, item.minutes), 1);
  const trendAxisMarks = [1, 0.75, 0.5, 0.25].map((ratio, index) => {
    const minutes = Math.max(1, Math.round(maxTrend * ratio));
    const label = minutes >= 60 ? `${Math.max(1, Math.round(minutes / 60))}h` : `${minutes}m`;
    return { id: `trend-mark-${index}`, label };
  });
  const hasMoreReadyBoxes = (vaultReadyBoxCount ?? totalAvailableBoxes) > 0;
  const [isPointHistoryOpen, setIsPointHistoryOpen] = useState(false);
  const rankPreview = selectedHomeRank.preview.slice(0, 3);
  const rankLiveBadge = selectedHomeRank.isLive ? selectedHomeRank.liveBadge || "LIVE" : null;
  const selectedRangeLabel = getRankRangeLabel(selectedRankRange);
  const rankSummaryTitle = selectedHomeRank.isLoading
    ? `${selectedRangeLabel} 집계중`
    : rankPreview.length > 0
      ? `${selectedRangeLabel} TOP 3`
      : `${selectedRangeLabel} 대기`;
  const rankSummaryDescription = selectedHomeRank.isLoading
    ? "실시간 순위를 불러오고 있습니다."
    : selectedHomeRank.description?.trim()
      ? selectedHomeRank.description.trim()
      : rankPreview.length > 0
        ? "상위 3명만 빠르게 보여줍니다."
        : "공부를 시작하면 순위가 바로 반영됩니다.";
  const recentActivityDays = useMemo(() => {
    if (!dailyPointStatus) return 0;
    return Object.keys(dailyPointStatus).sort((a, b) => b.localeCompare(a)).slice(0, 30).length;
  }, [dailyPointStatus]);

  return (
    <>
      <div className={cn("student-night-page", isMobile ? "space-y-3" : "space-y-4")}>
      <section
        className={cn(
          "point-track-hero-stage relative overflow-hidden",
          arrivalCount > 0 && "point-track-hero-stage--arrival",
        )}
      >
        {arrivalCount > 0 ? (
          <div key={arrivalCount} className="point-track-arrival-banner">
            +{arrivalCount} BOX
          </div>
        ) : null}
        <div className={cn("relative z-10", isMobile ? "space-y-4" : "space-y-5")}>
          <div className={cn("flex items-start justify-between gap-3", isMobile ? "flex-col" : "items-center")}>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="dark" className="px-3 py-1 text-[10px] uppercase tracking-[0.22em]">
                  Home Lobby
                </Badge>
                <span className="text-[11px] font-black text-white">{dateLabel}</span>
              </div>
              <h2 className={cn("font-aggro-display break-keep font-black tracking-tight text-white", isMobile ? "text-[1.9rem] leading-9" : "text-[2.6rem] leading-[1.05]")}>
                오늘도 성장한 하루
              </h2>
              {heroMessage ? <p className="surface-caption text-sm font-semibold">{heroMessage}</p> : null}
            </div>

            <button
              type="button"
              onClick={onOpenFocusEditor}
              title={homeFocusSummaryLabel}
              className={cn(
                "surface-chip surface-chip--dark inline-flex max-w-full items-center gap-2 px-3 py-2 text-left shadow-[0_18px_34px_-26px_rgba(0,0,0,0.45)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/28",
                isMobile ? "max-w-[14.5rem] self-start" : "min-w-[12rem] max-w-[16rem]"
              )}
            >
              <span className={cn("truncate font-black text-white", isMobile ? "text-[11px]" : "text-[12px]")}>
                {homeFocusSummaryLabel}
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/72" />
              <span className="sr-only">{homeFocusSummaryLabel}</span>
            </button>
          </div>

          <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-[1.35fr_0.95fr]")}>
            <div className="surface-card surface-card--primary on-dark rounded-[1.5rem] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="surface-kicker text-[10px] text-white">growth</div>
                  {sessionTimerLabel ? (
                    <div className="mt-2">
                      <div className="text-[1.1rem] font-black tracking-tight text-white">집중 중</div>
                    </div>
                  ) : (
                    <div className={cn("mt-2 font-black tracking-tight text-white", isMobile ? "text-[2.4rem]" : "text-[3rem]")}>
                      {totalMinutesLabel}
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="surface-chip surface-chip--dark px-2.5 py-1 text-[10px]">
                      {growthLabel}
                    </span>
                    <span className="surface-chip surface-chip--accent px-2.5 py-1 text-[10px]">
                      {growthDeltaLabel}
                    </span>
                  </div>
                </div>
                {sessionTimerLabel ? (
                  <div className={cn(
                    "surface-card surface-card--ghost on-dark rounded-[1.1rem] px-3 py-2 text-right shrink-0",
                    isMobile ? "min-w-[6.2rem]" : "min-w-[6.8rem]"
                  )}>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-on-dark-muted)]">live</div>
                    <div className="mt-1 whitespace-nowrap leading-none font-black tabular-nums text-white text-[clamp(0.95rem,4vw,1.125rem)]">
                      {sessionTimerLabel}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="surface-card surface-card--ghost on-dark mt-4 rounded-[1.25rem] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-white">
                    <Flame className="h-3.5 w-3.5 text-[var(--accent-orange-soft)]" />
                    성장 게이지
                  </span>
                  <span className="text-[11px] font-black text-white">{growthLabel}</span>
                </div>
                <HomeGrowthTrack
                  isMobile={isMobile}
                  growthPercent={growthPercent}
                  sessionTimerLabel={sessionTimerLabel}
                />
              </div>

              <Button
                type="button"
                onClick={onPrimaryAction}
                variant={primaryActionActive ? "secondary" : "dark"}
                className={cn(
                  "point-track-hero-cta mt-4 h-12 w-full rounded-[1.1rem] text-base font-black",
                  !primaryActionActive && "border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.94)] text-[var(--text-on-light)]",
                )}
              >
                {primaryActionActive ? <Timer className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4 fill-current" />}
                {primaryActionLabel}
              </Button>
            </div>

            <div className="surface-card surface-card--secondary on-dark rounded-[1.5rem] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="surface-kicker text-[10px]">reward</div>
                  <div className="font-aggro-display mt-2 text-[1.65rem] font-black tracking-tight text-white">
                    {totalAvailableBoxes > 0 ? `${totalAvailableBoxes}개 대기` : "상자 생성중"}
                  </div>
                  <div className="surface-caption mt-1 text-sm font-semibold">{boxSubLabel}</div>
                </div>
                <div className="surface-chip surface-chip--light px-2.5 py-1 text-[10px] uppercase tracking-[0.2em]">
                  {boxStatusLabel}
                </div>
              </div>

                <div className="mt-3 flex justify-center">
                  <RewardHeroBox
                    state={totalAvailableBoxes > 0 ? "ready" : "charging"}
                    intense={totalAvailableBoxes > 0 || isNearNextBox}
                    rarity={boxPreviewRarity ?? "common"}
                    label={boxStatusLabel}
                    onClick={onOpenMainBox}
                  />
                </div>

              <div className="mt-2 text-center">
                <div className="text-sm font-black text-white">{totalAvailableBoxes > 0 ? "지금 열기" : nextBoxCounter}</div>
                <div className="surface-caption mt-1 text-[11px] font-semibold">{nextBoxCaption}</div>
              </div>

              <Button
                type="button"
                onClick={() => onOpenMainBox()}
                disabled={totalAvailableBoxes <= 0}
                variant="secondary"
                className="point-track-hero-cta mt-4 h-11 w-full rounded-[1.1rem] disabled:cursor-default disabled:opacity-55"
              >
                <Gift className="mr-2 h-4 w-4" />
                {totalAvailableBoxes > 0 ? `${totalAvailableBoxes}개 열기` : "곧 도착"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className={cn("mt-3 grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-[1.2fr_0.8fr]")}>
        <div className="surface-card surface-card--primary on-dark rounded-[1.65rem] p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="surface-kicker text-[10px]">quest board</div>
              <h3 className="mt-1 text-[1.35rem] font-black tracking-tight">오늘의 퀘스트</h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-9 rounded-full px-3 text-[11px] font-black text-[var(--text-on-dark-soft)] hover:bg-white/8 hover:text-white"
              onClick={onOpenPlan}
            >
              더보기 <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {quests.length > 0 ? (
              quests.map((quest) => (
                <QuestRow
                  key={quest.id}
                  quest={quest}
                  onToggle={onToggleQuest}
                  gainKey={questGain?.id === quest.id ? questGain.key : null}
                  disabled={pendingQuestIds.includes(quest.id)}
                />
              ))
            ) : (
              <div className="surface-card surface-card--ghost on-dark rounded-[1.25rem] border-dashed px-4 py-6 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(255,138,31,0.2)] bg-[rgba(255,138,31,0.12)] text-[var(--accent-orange-soft)]">
                  <Swords className="h-5 w-5" />
                </div>
                <div className="mt-3 text-base font-black text-white">아직 오늘 퀘스트가 없어요</div>
                <div className="surface-caption mt-1 text-sm font-semibold">계획트랙에서 오늘 할 일을 추가해 보세요.</div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="surface-card surface-card--secondary on-dark rounded-[1.65rem] p-4 text-white">
            <div className="grid grid-cols-2 gap-3">
              <div className="surface-card surface-card--light rounded-[1.15rem] px-3 py-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                  <TrendingUp className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
                  성장률
                </div>
                <div className={cn(
                  "font-aggro-display mt-2 text-xl font-black tracking-tight",
                  growthDeltaPercent >= 0 ? "text-emerald-600" : "text-rose-500"
                )}>
                  {growthDeltaPercent >= 0 ? "+" : ""}
                  {growthDeltaPercent}%
                </div>
                <div className="mt-1 text-[11px] font-black text-[var(--text-secondary)]">어제 대비 · 오늘 {todayStudyLabel}</div>
              </div>
              <button
                type="button"
                onClick={() => setIsPointHistoryOpen(true)}
                className="surface-card surface-card--ivory rounded-[1.15rem] px-3 py-3 text-left transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,122,22,0.28)]"
              >
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                  <History className="h-3.5 w-3.5 text-[var(--accent-orange)]" />
                  활동 기록
                </div>
                <div className="font-aggro-display mt-2 text-xl font-black text-[var(--text-primary)]">{recentActivityDays}일</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="text-[11px] font-black text-[var(--accent-orange)]">오늘 연 상자 {todayOpenedBoxCount}개</div>
                  <ChevronRight className="h-4 w-4 text-[var(--accent-orange)]" />
                </div>
              </button>
            </div>
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="surface-kicker text-[10px]">growth log</div>
                  <div className="text-[11px] font-black text-[var(--accent-orange-soft)]">최고 {bestDayLabel}</div>
                </div>
                <div className="mt-4 grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                  <div className="flex h-24 flex-col justify-between pt-1">
                    {trendAxisMarks.map((mark) => (
                      <div key={mark.id} className="text-right text-[10px] font-black text-[var(--text-on-dark-soft)]">
                        {mark.label}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="relative h-24">
                      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                        {trendAxisMarks.map((mark) => (
                          <div key={`${mark.id}-line`} className="border-t border-dashed border-white/12" />
                        ))}
                      </div>
                      <div className="relative flex h-24 items-end gap-2">
                        {weeklyTrend.map((item) => {
                          const height = Math.max(0.5, item.minutes / maxTrend);
                          return (
                            <div key={item.date} className="flex min-w-0 flex-1 items-end">
                              <div className="flex h-24 w-full items-end rounded-full bg-[rgba(5,16,43,0.44)] px-1.5 py-1.5 ring-1 ring-white/8">
                                <div
                                  className={cn(
                                    "w-full rounded-full bg-[linear-gradient(180deg,#FFB347_0%,#FF8A1F_100%)] shadow-[0_10px_20px_-14px_rgba(255,138,31,0.7)]",
                                    item.date === bestDayLabel && "bg-[linear-gradient(180deg,#FFE6AB_0%,#FFB347_32%,#FF8A1F_100%)]",
                                  )}
                                  style={{ height: `${height * 100}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {weeklyTrend.map((item) => (
                        <div key={`${item.date}-label`} className="min-w-0 flex-1 text-center text-[10px] font-black text-[var(--text-on-dark-soft)]">
                          {item.date}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          {isMobile ? (
            <div
              role="button"
              tabIndex={0}
              onClick={onOpenLeaderboard}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenLeaderboard();
                }
              }}
              className={cn(
                HOME_RANK_CARD_BASE,
                "rounded-[1.78rem] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,217,157,0.32)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              )}
              style={{ animation: "leaderboard-card-breathe 5.8s ease-in-out infinite" }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,transparent,rgba(255,196,112,0.92),rgba(121,162,255,0.78),transparent)]" />
              <div className="pointer-events-none absolute -left-20 top-0 h-full w-16 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.44),transparent)] opacity-80 animate-[leaderboard-bar-shimmer_4.1s_linear_infinite]" />
              <div className="pointer-events-none absolute right-2 top-2 h-20 w-20 rounded-full bg-[rgba(113,154,255,0.18)] blur-3xl animate-[hero-orb-drift_8s_ease-in-out_infinite]" />
              <div className="pointer-events-none absolute left-4 top-28 h-16 w-16 rounded-full bg-[rgba(255,189,104,0.14)] blur-2xl animate-[hero-orb-drift_9.4s_ease-in-out_infinite]" style={{ animationDelay: "1.2s" }} />
              <div className="pointer-events-none absolute inset-x-4 top-[5.4rem] h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)]" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className={cn(HOME_RANK_CARD_BADGE, "px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_14px_28px_-22px_rgba(0,0,0,0.42)]")}>
                        <Swords className="h-3.5 w-3.5 text-[#FFCB78]" />
                        Ranking Track
                      </div>
                      {rankLiveBadge ? (
                        <div className={cn(HOME_RANK_CARD_LIVE_BADGE, "px-2.5 py-1.5 text-[10px] font-black shadow-[0_10px_22px_-18px_rgba(255,122,22,0.22)]")}>
                          <span className="h-2 w-2 rounded-full bg-[#FF7A16] animate-[leaderboard-live-dot-pulse_1.15s_ease-in-out_infinite]" />
                          {rankLiveBadge}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3">
                      <div className="font-aggro-display text-[1.32rem] font-black tracking-tight text-white">
                        {rankSummaryTitle}
                      </div>
                      <div className="mt-1 text-[11px] font-semibold leading-5 text-[#B7C7E8]">
                        {rankSummaryDescription}
                      </div>
                    </div>
                  </div>

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[rgba(255,255,255,0.08)] shadow-[0_16px_30px_-22px_rgba(0,0,0,0.42)]">
                    <ChevronRight className="h-4 w-4 text-[#D5E1F7]" />
                  </div>
                </div>

                <div className={cn(HOME_RANK_CARD_INSET, "mt-4 p-1")}>
                  <div className="grid grid-cols-3 gap-1">
                    {(["daily", "weekly", "monthly"] as RankRange[]).map((range) => (
                      <button
                        key={range}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectRankRange(range);
                        }}
                        className={cn(
                          "rounded-[0.95rem] px-3 py-2 text-[10px] font-black transition-all",
                          selectedRankRange === range
                            ? "bg-[linear-gradient(135deg,#FFE09D_0%,#FFBE67_42%,#FF9D42_100%)] text-[#332005] shadow-[0_14px_24px_-18px_rgba(255,170,79,0.5)]"
                            : "text-[#B7C7E8] hover:bg-[rgba(255,255,255,0.08)] hover:text-white",
                        )}
                      >
                        {range === "daily" ? "일간" : range === "weekly" ? "주간" : "월간"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  {rankPreview.length > 0 ? (
                    rankPreview.map((entry) => (
                      <div
                        key={`${selectedRankRange}-${entry.rank}-${entry.name}`}
                        className={cn(
                          "rounded-[1.18rem] border px-3.5 py-3 shadow-[0_14px_26px_-22px_rgba(0,0,0,0.42)]",
                          entry.rank === 1
                            ? "border-[#F5C97B]/28 bg-[linear-gradient(135deg,rgba(255,209,132,0.18)_0%,rgba(255,255,255,0.08)_24%,rgba(255,255,255,0.04)_100%)] text-white"
                            : "border-white/10 bg-[rgba(255,255,255,0.06)] text-white"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex items-center gap-2.5">
                            <span
                              className={cn(
                                "inline-flex min-w-[3rem] items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-black",
                                entry.rank === 1
                                  ? "bg-[rgba(255,224,157,0.12)] text-[#FFE09E]"
                                  : "bg-[rgba(255,255,255,0.08)] text-[#B7C7E8]"
                              )}
                            >
                              {entry.rank}등
                            </span>
                            <div className="min-w-0">
                              <div className={cn(
                                "truncate text-[14px] font-black tracking-tight",
                                "text-white"
                              )}>
                                {formatRankStudentName(entry.name)}
                              </div>
                              <div className={cn(
                                "mt-0.5 text-[11px] font-bold",
                                entry.rank === 1
                                  ? entry.isLive
                                    ? "text-[#FFE09E]"
                                    : "text-white/70"
                                  : entry.isLive
                                    ? "text-[#FFC98F]"
                                    : "text-[#8FA4CC]"
                              )}>
                                {getRankEntryStatusLabel(entry)}
                              </div>
                            </div>
                          </div>
                          <RankPreviewTimeBadge
                            entry={entry}
                            compact
                            className={cn(
                              "shrink-0 rounded-full border px-2.5 py-1.5 text-[10px] font-black shadow-[0_10px_20px_-18px_rgba(0,0,0,0.38)]",
                              entry.rank === 1
                                ? "border-[#F5C97B]/24 bg-[rgba(255,224,157,0.08)] text-[#FFE09E]"
                                : "border-white/10 bg-[rgba(255,255,255,0.06)] text-[#B7C7E8]"
                            )}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.2rem] border border-dashed border-white/14 bg-[rgba(255,255,255,0.05)] px-4 py-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                      <div className="text-sm font-black text-white">아직 표시할 랭킹이 없어요.</div>
                      <div className="mt-1 text-[11px] font-semibold leading-5 text-[#B7C7E8]">
                        공부를 시작하면 상위 3명이 여기 표시됩니다.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={onOpenLeaderboard}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenLeaderboard();
                }
              }}
              className={cn(
                HOME_RANK_CARD_BASE,
                "rounded-[1.65rem] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,217,157,0.32)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              )}
              style={{ animation: "leaderboard-card-breathe 5s ease-in-out infinite" }}
            >
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-24 top-0 h-full w-20 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.26),transparent)] opacity-70 animate-[leaderboard-bar-shimmer_4.8s_linear_infinite]" />
                <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[rgba(113,154,255,0.18)] blur-2xl animate-[hero-orb-drift_8.8s_ease-in-out_infinite]" />
                <div className="absolute -left-8 bottom-2 h-24 w-24 rounded-full bg-[rgba(255,189,104,0.12)] blur-2xl animate-[hero-orb-drift_10.2s_ease-in-out_infinite]" style={{ animationDelay: "1.4s" }} />
              </div>
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className={cn(HOME_RANK_CARD_BADGE, "px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]")}>
                        <Swords className="h-3.5 w-3.5 text-[#FFCB78]" />
                        Ranking Track
                      </div>
                      {rankLiveBadge ? (
                        <div className={cn(HOME_RANK_CARD_LIVE_BADGE, "px-2.5 py-1 text-[10px] font-black shadow-[0_10px_24px_-18px_rgba(255,122,22,0.22)]")}>
                          <span className="h-2 w-2 rounded-full bg-[#FF7A16] animate-[leaderboard-live-dot-pulse_1.15s_ease-in-out_infinite]" />
                          {rankLiveBadge}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3">
                      <div className="font-aggro-display text-[1.32rem] font-black tracking-tight text-white">
                        {rankSummaryTitle}
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-[#B7C7E8]">
                        {rankSummaryDescription}
                      </div>
                    </div>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[rgba(255,255,255,0.08)] shadow-[0_14px_28px_-20px_rgba(0,0,0,0.42)]">
                    <ChevronRight className="h-4 w-4 text-[#D5E1F7]" />
                  </div>
                </div>
                <div className={cn(HOME_RANK_CARD_INSET, "relative mt-4 p-1.5")}>
                  <div className="flex flex-wrap gap-1.5">
                    {(["daily", "weekly", "monthly"] as RankRange[]).map((range) => (
                      <button
                        key={range}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectRankRange(range);
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[10px] font-black transition-all",
                          selectedRankRange === range
                            ? "border-transparent bg-[linear-gradient(135deg,#FFE09D_0%,#FFBE67_42%,#FF9D42_100%)] text-[#332005] shadow-[0_16px_28px_-18px_rgba(255,170,79,0.58)]"
                            : "border-white/10 bg-[rgba(255,255,255,0.04)] text-[#B7C7E8] hover:bg-[rgba(255,255,255,0.08)] hover:text-white",
                        )}
                      >
                        {getRankRangeLabel(range)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 space-y-2.5">
                  {rankPreview.length > 0 ? (
                    rankPreview.map((entry) => (
                      <div
                        key={`${selectedRankRange}-${entry.rank}-${entry.name}`}
                        className={cn(
                          "rounded-[1.18rem] border px-3.5 py-3 shadow-[0_14px_26px_-22px_rgba(0,0,0,0.42)]",
                          entry.rank === 1
                            ? "border-[#F5C97B]/28 bg-[linear-gradient(135deg,rgba(255,209,132,0.18)_0%,rgba(255,255,255,0.08)_24%,rgba(255,255,255,0.04)_100%)] text-white"
                            : "border-white/10 bg-[rgba(255,255,255,0.06)] text-white"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex items-center gap-2.5">
                            <span
                              className={cn(
                                "inline-flex min-w-[3rem] items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-black",
                                entry.rank === 1
                                  ? "bg-[rgba(255,224,157,0.12)] text-[#FFE09E]"
                                  : "bg-[rgba(255,255,255,0.08)] text-[#B7C7E8]"
                              )}
                            >
                              {entry.rank}등
                            </span>
                            <div className="min-w-0">
                              <div className={cn(
                                "truncate text-[14px] font-black tracking-tight",
                                "text-white"
                              )}>
                                {formatRankStudentName(entry.name)}
                              </div>
                              <div className={cn(
                                "mt-0.5 text-[11px] font-bold",
                                entry.rank === 1
                                  ? entry.isLive
                                    ? "text-[#FFE09E]"
                                    : "text-white/70"
                                  : entry.isLive
                                    ? "text-[#FFC98F]"
                                    : "text-[#8FA4CC]"
                              )}>
                                {getRankEntryStatusLabel(entry)}
                              </div>
                            </div>
                          </div>
                          <RankPreviewTimeBadge
                            entry={entry}
                            className={cn(
                              "shrink-0 rounded-full border px-2.5 py-1.5 text-[10px] font-black shadow-[0_10px_24px_-20px_rgba(0,0,0,0.42)]",
                              entry.rank === 1
                                ? "border-[#F5C97B]/24 bg-[rgba(255,224,157,0.08)] text-[#FFE09E]"
                                : "border-white/10 bg-[rgba(255,255,255,0.06)] text-[#B7C7E8]"
                            )}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.2rem] border border-dashed border-white/14 bg-[rgba(255,255,255,0.05)] px-4 py-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                      <div className="text-sm font-black text-white">아직 표시할 랭킹이 없어요.</div>
                      <div className="mt-1 text-[11px] font-semibold leading-5 text-[#B7C7E8]">
                        공부를 시작하면 상위 3명이 여기 표시됩니다.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      </div>

      <PointHistoryModal
        open={isPointHistoryOpen}
        onOpenChange={setIsPointHistoryOpen}
        dailyPointStatus={dailyPointStatus}
        isMobile={isMobile}
      />

      <RewardModal
        open={isVaultOpen}
        onOpenChange={onVaultChange}
        selectedBox={selectedBox}
        boxContextLabel={boxContextLabel}
        boxStage={boxStage}
        onReveal={onRevealBox}
        revealedReward={revealedReward}
        onNextBox={onNextBox}
        todayOpenedBoxCount={todayOpenedBoxCount}
        nextCountdownLabel={nextCountdownLabel}
        hasMoreBoxes={hasMoreReadyBoxes}
      />
    </>
  );
}
