'use client';

import Link from 'next/link';
import type { CefrLevel, SkillKind } from '@/types/db';
import { LEVEL_FA, SKILL_FA, SKILL_ICON } from '@/types/db';
import BridgeRing from './BridgeRing';

export { BridgeRing };

// ---------------- Card ----------------
export function Card({
  children,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card p-5 ${className}`} {...rest}>
      {children}
    </div>
  );
}

// ---------------- Button ----------------
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'destructive';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  accent: 'btn-accent',
  destructive: 'btn-destructive',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel = 'در حال انجام…',
  block = false,
  className = '',
  children,
  disabled,
  ...rest
}: {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  loadingLabel?: string;
  block?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
  return (
    <button
      className={`btn ${VARIANT_CLASS[variant]} ${sizeClass} ${block ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner size={16} />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Link styled as a button. Same visual language, correct semantics. */
export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  block = false,
  className = '',
  children,
  ...rest
}: {
  href: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, 'href' | 'className'>) {
  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
  return (
    <Link
      href={href}
      className={`btn ${VARIANT_CLASS[variant]} ${sizeClass} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </Link>
  );
}

// ---------------- Section title ----------------
export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="t-h2">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

// ---------------- Level badge ----------------
const LEVEL_COLORS: Record<CefrLevel, string> = {
  A1: 'bg-primary-50 text-primary-800',
  A2: 'bg-primary-100 text-primary-800',
  B1: 'bg-success-50 text-success-800',
  B2: 'bg-accent-50 text-accent-800',
  C1: 'bg-accent-100 text-accent-800',
  C2: 'bg-info-100 text-info-800',
};

export function LevelBadge({ level, showFa = true }: { level: CefrLevel; showFa?: boolean }) {
  return (
    <span className={`badge ${LEVEL_COLORS[level]}`}>
      <b className="num">{level}</b>
      {showFa && <span>{LEVEL_FA[level]}</span>}
    </span>
  );
}

// ---------------- Skill badge ----------------
export function SkillBadge({ skill }: { skill: SkillKind }) {
  return (
    <span className="badge bg-primary-50 text-primary-800">
      <span aria-hidden="true">{SKILL_ICON[skill]}</span>
      {SKILL_FA[skill]}
    </span>
  );
}

// ---------------- Progress bar ----------------
export function Progress({
  value,
  max = 100,
  color = 'var(--color-primary-600)',
  height = 8,
  label,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ background: 'var(--border)', height }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

// ---------------- Stat card ----------------
export function Stat({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon?: string;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          {label}
        </span>
        {icon && (
          <span className="text-xl" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <div className="num mt-2 text-2xl font-bold">{value}</div>
      {hint && (
        <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          {hint}
        </div>
      )}
    </div>
  );
}

// ---------------- Empty state ----------------
export function Empty({
  icon = '🌱',
  title,
  description,
  action,
  secondaryAction,
  children,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center sm:p-10">
      <div className="text-4xl" aria-hidden="true">
        {icon}
      </div>
      <h3 className="t-h2">{title}</h3>
      {description && (
        <p className="max-w-md text-sm leading-7" style={{ color: 'var(--muted)' }}>
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {action && (
            <ButtonLink href={action.href} variant="primary">
              {action.label}
            </ButtonLink>
          )}
          {secondaryAction && (
            <ButtonLink href={secondaryAction.href} variant="ghost">
              {secondaryAction.label}
            </ButtonLink>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

// ---------------- Error state ----------------
/**
 * System-voice error. Says what happened and what the user can do —
 * never "مشکلی پیش آمد" and never an apology.
 */
export function ErrorState({
  title = 'بارگذاری اطلاعات انجام نشد',
  description = 'اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.',
  onRetry,
  retryLabel = 'تلاش دوباره',
  compact = false,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-start gap-2 rounded-xl border ${compact ? 'p-3' : 'p-5'}`}
      style={{
        borderColor: 'var(--color-error-100)',
        background: 'var(--color-error-50)',
        color: 'var(--color-error-700)',
      }}
    >
      <div className="flex items-start gap-2">
        <span aria-hidden="true">⚠️</span>
        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="mt-1 text-sm leading-7">{description}</p>
        </div>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-sm btn-ghost mt-1 bg-white">
          🔄 {retryLabel}
        </button>
      )}
    </div>
  );
}

// ---------------- Spinner ----------------
export function Spinner({ size = 18 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{ width: size, height: size }}
      role="status"
      aria-label="در حال بارگذاری"
    />
  );
}

// ---------------- Skeletons shaped like real content ----------------
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-3.5"
          style={{ width: i === lines - 1 ? '62%' : '100%' }}
        />
      ))}
    </div>
  );
}

/** Placeholder shaped like a list of rows (lesson list, assignment list…). */
export function SkeletonList({ rows = 3, avatar = false }: { rows?: number; avatar?: boolean }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="در حال بارگذاری فهرست">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border p-3"
          style={{ borderColor: 'var(--border)' }}
        >
          {avatar && <div className="skeleton h-9 w-9 shrink-0 rounded-full" />}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-3.5 w-1/2" />
            <div className="skeleton h-3 w-1/3" />
          </div>
          <div className="skeleton h-3 w-10 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Placeholder shaped like a card with a title and body. */
export function SkeletonCard({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`card p-5 ${className}`} aria-busy="true" aria-label="در حال بارگذاری">
      <div className="skeleton mb-4 h-5 w-40" />
      <SkeletonText lines={lines} />
    </div>
  );
}

/** Placeholder shaped like a chat transcript. */
export function SkeletonChat({ bubbles = 3 }: { bubbles?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="در حال بارگذاری گفت‌وگو">
      {Array.from({ length: bubbles }).map((_, i) => (
        <div key={i} className={`flex ${i % 2 ? 'justify-start' : 'justify-end'}`}>
          <div
            className="skeleton h-14"
            style={{ width: i % 2 ? '62%' : '48%', borderRadius: 'var(--radius-lg)' }}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------- Alert ----------------
export function Alert({
  kind = 'info',
  title,
  children,
}: {
  kind?: 'info' | 'success' | 'error' | 'warning';
  title?: string;
  children: React.ReactNode;
}) {
  const styles = {
    info: 'bg-info-50 text-info-800 border-info-100',
    success: 'bg-success-50 text-success-800 border-success-100',
    error: 'bg-error-50 text-error-700 border-error-100',
    warning: 'bg-warning-50 text-warning-800 border-warning-100',
  }[kind];
  const icon = { info: 'ℹ️', success: '✅', error: '⚠️', warning: '⚡' }[kind];
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border p-3 text-sm leading-7 ${styles}`}
      role={kind === 'error' ? 'alert' : undefined}
    >
      <span aria-hidden="true">{icon}</span>
      <div className="flex-1">
        {title && <p className="font-bold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
