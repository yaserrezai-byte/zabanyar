'use client';

import Link from 'next/link';
import type { CefrLevel, SkillKind } from '@/types/db';
import { LEVEL_FA, SKILL_FA, SKILL_ICON } from '@/types/db';

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
        <h2 className="text-lg font-bold">{title}</h2>
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
  A1: 'bg-slate-100 text-slate-700',
  A2: 'bg-sky-100 text-sky-700',
  B1: 'bg-emerald-100 text-emerald-700',
  B2: 'bg-amber-100 text-amber-700',
  C1: 'bg-orange-100 text-orange-700',
  C2: 'bg-purple-100 text-purple-700',
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
    <span className="badge bg-brand-50 text-brand-700">
      <span>{SKILL_ICON[skill]}</span>
      {SKILL_FA[skill]}
    </span>
  );
}

// ---------------- Progress bar ----------------
export function Progress({
  value,
  max = 100,
  color = 'var(--color-brand-600)',
  height = 8,
}: {
  value: number;
  max?: number;
  color?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ background: 'var(--border)', height }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
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
      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          {label}
        </span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-bold num">{value}</div>
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
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <div className="text-4xl">{icon}</div>
      <h3 className="font-bold">{title}</h3>
      {description && (
        <p className="max-w-md text-sm" style={{ color: 'var(--muted)' }}>
          {description}
        </p>
      )}
      {action && (
        <Link href={action.href} className="btn btn-primary mt-2">
          {action.label}
        </Link>
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
      aria-label="در حال بارگذاری"
    />
  );
}

// ---------------- Alert ----------------
export function Alert({
  kind = 'info',
  children,
}: {
  kind?: 'info' | 'success' | 'error' | 'warning';
  children: React.ReactNode;
}) {
  const styles = {
    info: 'bg-sky-50 text-sky-800 border-sky-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    error: 'bg-rose-50 text-rose-800 border-rose-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
  }[kind];
  const icon = { info: 'ℹ️', success: '✅', error: '⚠️', warning: '⚡' }[kind];
  return (
    <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${styles}`}>
      <span>{icon}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
