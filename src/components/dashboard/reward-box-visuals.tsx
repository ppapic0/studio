'use client';

import { Lock, Star } from 'lucide-react';

import { cn } from '@/lib/utils';

export type RewardBoxState = 'locked' | 'charging' | 'ready' | 'opened';
export type RewardBoxRarity = 'common' | 'rare' | 'epic';
export type RewardBoxStage = 'idle' | 'shake' | 'burst' | 'revealed';

export type RewardVaultBox = {
  id: string;
  hour: number;
  state: RewardBoxState;
  rarity: RewardBoxRarity;
  reward?: number;
};

const DEFAULT_RARITY_LABELS: Record<RewardBoxRarity, string> = {
  common: '커먼',
  rare: '레어',
  epic: '에픽',
};

function RewardBoxFigure({
  variant,
  rarity,
  state,
}: {
  variant: 'hero' | 'slot';
  rarity: RewardBoxRarity;
  state?: RewardBoxState;
}) {
  const isMystery = state === 'locked' || state === 'charging';

  return (
    <div
      className={cn(
        'point-track-box-figure',
        variant === 'hero' ? 'point-track-box-figure--hero' : 'point-track-box-figure--slot',
        isMystery ? 'point-track-box-figure--mystery' : `point-track-box-figure--${rarity}`,
        isMystery && 'point-track-box-figure--locked'
      )}
    >
      <div className="point-track-box-figure__glow" />
      {variant === 'hero' ? <div className="point-track-box-figure__shadow" /> : null}
      {isMystery ? (
        <div className="point-track-box-figure__mystery">
          <span className="point-track-box-figure__mystery-mark">?</span>
        </div>
      ) : (
        <div className="point-track-box-figure__shell">
          <div className="point-track-box-figure__lid" />
          <div className="point-track-box-figure__band" />
          <div className="point-track-box-figure__trim point-track-box-figure__trim--left" />
          <div className="point-track-box-figure__trim point-track-box-figure__trim--right" />
          <div className="point-track-box-figure__crest" />
          <div className="point-track-box-figure__lock" />
          <div className="point-track-box-figure__shine" />
          <div className="point-track-box-figure__spark point-track-box-figure__spark--left" />
          <div className="point-track-box-figure__spark point-track-box-figure__spark--right" />
        </div>
      )}
    </div>
  );
}

export function RewardHeroBox({
  state,
  stage,
  intense = false,
  rarity,
  label,
  onClick,
}: {
  state: 'ready' | 'charging';
  stage?: RewardBoxStage;
  intense?: boolean;
  rarity?: RewardBoxRarity | null;
  label: string;
  onClick?: () => void;
}) {
  const resolvedRarity = rarity ?? 'common';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'point-track-hero-box',
        `point-track-hero-box--${resolvedRarity}`,
        state === 'ready' ? 'point-track-hero-box--ready' : 'point-track-hero-box--charging',
        intense && 'point-track-hero-box--intense',
        stage === 'shake' && 'point-track-hero-box--shake',
        stage === 'burst' && 'point-track-hero-box--burst',
        stage === 'revealed' && 'point-track-hero-box--revealed'
      )}
    >
      <RewardBoxFigure variant="hero" rarity={resolvedRarity} state={state} />
      <span className="sr-only">{label}</span>
    </button>
  );
}

export function RewardVaultSlot({
  box,
  onSelect,
  chargingLabel,
  chargingPercent,
  isFresh,
  rarityLabels = DEFAULT_RARITY_LABELS,
}: {
  box: RewardVaultBox;
  onSelect: (hour: number) => void;
  chargingLabel?: string;
  chargingPercent?: number;
  isFresh?: boolean;
  rarityLabels?: Record<RewardBoxRarity, string>;
}) {
  const isMysterySlot = box.state === 'locked' || box.state === 'charging';

  return (
    <button
      type="button"
      disabled={box.state !== 'ready'}
      onClick={() => onSelect(box.hour)}
      className={cn(
        'point-track-slot',
        isMysterySlot ? 'point-track-slot--mystery' : `point-track-slot--${box.rarity}`,
        box.state === 'ready' && 'point-track-slot--ready',
        box.state === 'charging' && 'point-track-slot--charging',
        box.state === 'opened' && 'point-track-slot--opened',
        box.state === 'locked' && 'point-track-slot--locked',
        isFresh && 'point-track-slot--fresh'
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            'rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em]',
            isMysterySlot
              ? 'border-white/18 bg-white/8 text-white/85'
              : box.rarity === 'epic'
                ? 'border-violet-300/30 bg-violet-300/18 text-violet-100'
                : box.rarity === 'rare'
                  ? 'border-orange-300/30 bg-orange-300/18 text-orange-100'
                  : 'border-sky-200/24 bg-sky-200/14 text-sky-100'
          )}
        >
          {isMysterySlot ? '?' : rarityLabels[box.rarity]}
        </span>
        {box.state === 'ready' ? (
          <Star
            className={cn(
              'h-3.5 w-3.5',
              box.rarity === 'epic'
                ? 'text-violet-100'
                : box.rarity === 'rare'
                  ? 'text-orange-100'
                  : 'text-sky-100'
            )}
          />
        ) : box.state === 'locked' ? (
          <Lock className="h-3.5 w-3.5 text-[var(--text-on-dark-soft)]" />
        ) : null}
      </div>

      <RewardBoxFigure variant="slot" rarity={box.rarity} state={box.state} />

      <div className="mt-3">
        <div className="text-[11px] font-black tracking-tight text-white">{box.hour}시간 상자</div>
        {box.state === 'charging' ? (
          <>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="point-track-slot__meter-fill"
                style={{ width: `${Math.max(4, Math.min(100, chargingPercent || 0))}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] font-black text-[var(--text-on-dark-soft)]">{chargingLabel}</div>
          </>
        ) : (
          <div className="mt-1 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-on-dark-soft)]">
            <span>
              {box.state === 'opened'
                ? '확인완료'
                : box.state === 'ready'
                  ? 'READY'
                  : 'LOCK'}
            </span>
            <span>{box.state === 'opened' ? '완료' : box.state === 'ready' ? '열기' : '잠김'}</span>
          </div>
        )}
      </div>
    </button>
  );
}
