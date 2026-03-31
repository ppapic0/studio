import { cn } from '@/lib/utils';

// ─── Type system ──────────────────────────────────────────────────────────────

type MetricVariant = 'hero' | 'primary' | 'secondary' | 'inline';
type MetricTone = 'default' | 'positive' | 'negative' | 'muted' | 'orange' | 'navy';

// ─── Style maps ───────────────────────────────────────────────────────────────

const valueStyles: Record<MetricVariant, string> = {
  hero:      'metric-hero      text-4xl sm:text-5xl',
  primary:   'metric-primary   text-2xl sm:text-3xl',
  secondary: 'metric-secondary text-xl  sm:text-2xl',
  inline:    'metric-inline    text-base',
};

const unitStyles: Record<MetricVariant, string> = {
  hero:      'metric-unit text-lg  sm:text-xl  mb-0.5',
  primary:   'metric-unit text-base sm:text-lg  mb-0.5',
  secondary: 'metric-unit text-sm  mb-0.5',
  inline:    'metric-unit text-xs  mb-px',
};

const toneStyles: Record<MetricTone, string> = {
  default:  '',
  positive: 'metric-positive',
  negative: 'metric-negative',
  muted:    'metric-muted',
  orange:   'text-[var(--accent-orange)]',
  navy:     'text-[var(--text-primary)]',
};

// ─── MetricValue ──────────────────────────────────────────────────────────────
// Primary building block: a number + optional unit with correct hierarchy.
//
// Usage:
//   <MetricValue value="92" unit="%" variant="primary" />
//   <MetricValue value="14시간 23분" variant="hero" tone="navy" />
//   <MetricValue value="+12" variant="secondary" tone="positive" />

type MetricValueProps = {
  value: string | number;
  unit?: string;
  variant?: MetricVariant;
  tone?: MetricTone;
  className?: string;
};

export function MetricValue({
  value,
  unit,
  variant = 'primary',
  tone = 'default',
  className,
}: MetricValueProps) {
  return (
    <div className={cn('flex items-end gap-1 leading-none', className)}>
      <span className={cn(valueStyles[variant], toneStyles[tone])}>
        {value}
      </span>
      {unit ? (
        <span className={cn(unitStyles[variant], toneStyles[tone])}>
          {unit}
        </span>
      ) : null}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
// A labelled KPI tile: label on top, value below, optional sub-label.
//
// Usage:
//   <StatCard label="출결률" value="98" unit="%" />
//   <StatCard label="공부시간" value="14" unit="시간" sub="이번 주" variant="hero" />

type StatCardProps = {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  variant?: MetricVariant;
  tone?: MetricTone;
  className?: string;
};

export function StatCard({
  label,
  value,
  unit,
  sub,
  variant = 'primary',
  tone = 'default',
  className,
}: StatCardProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <MetricValue value={value} unit={unit} variant={variant} tone={tone} />
      {sub ? (
        <p className="text-[11.5px] font-semibold text-muted-foreground">{sub}</p>
      ) : null}
    </div>
  );
}

// ─── DeltaValue ───────────────────────────────────────────────────────────────
// A signed change indicator: "+12", "–3", "0".
//
// Usage:
//   <DeltaValue value="+12" unit="점" />
//   <DeltaValue value="-4" unit="%" />

type DeltaValueProps = {
  value: string | number;
  unit?: string;
  variant?: 'secondary' | 'inline';
  className?: string;
};

export function DeltaValue({ value, unit, variant = 'inline', className }: DeltaValueProps) {
  const str = String(value);
  const tone: MetricTone = str.startsWith('+')
    ? 'positive'
    : str.startsWith('-')
    ? 'negative'
    : 'muted';

  return (
    <MetricValue
      value={value}
      unit={unit}
      variant={variant}
      tone={tone}
      className={className}
    />
  );
}
