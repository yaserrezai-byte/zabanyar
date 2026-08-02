'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, LevelBadge, Progress } from '@/components/ui';
import { CEFR_LEVELS, LEVEL_FA, type CefrLevel } from '@/types/db';
import type { StudentSummary } from '@/lib/teacher';

type ActivityFilter = 'all' | 'active' | 'idle' | 'never';
type SortKey = 'name' | 'activity' | 'accuracy' | 'level';

const ACTIVITY_TABS: { key: ActivityFilter; label: string }[] = [
  { key: 'all', label: 'همه' },
  { key: 'active', label: 'فعال (۷ روز)' },
  { key: 'idle', label: 'غیرفعال' },
  { key: 'never', label: 'بدون تعیین سطح' },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'نام' },
  { key: 'activity', label: 'فعالیت' },
  { key: 'accuracy', label: 'دقت' },
  { key: 'level', label: 'سطح' },
];

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return Number.isFinite(d) ? Math.max(0, d) : null;
}

function lastSeenLabel(s: StudentSummary): string {
  const d = daysSince(s.lastEventAt ?? s.last_active_on);
  if (d === null) return 'بدون فعالیت ثبت‌شده';
  if (d === 0) return 'امروز فعال بوده';
  if (d === 1) return 'دیروز فعال بوده';
  return `${d} روز پیش`;
}

export default function StudentList({ students }: { students: StudentSummary[] }) {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<CefrLevel | 'all'>('all');
  const [activity, setActivity] = useState<ActivityFilter>('all');
  const [sort, setSort] = useState<SortKey>('name');

  const filtered = useMemo(() => {
    const order = CEFR_LEVELS as readonly string[];
    const q = query.trim().toLowerCase();

    const rows = students.filter((s) => {
      if (level !== 'all' && s.current_level !== level) return false;

      if (activity === 'active' && s.activeDays7 === 0) return false;
      if (activity === 'idle' && s.activeDays7 > 0) return false;
      if (activity === 'never' && s.placement_done) return false;

      if (q) {
        const hay = `${s.full_name ?? ''} ${s.email ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return rows.sort((a, b) => {
      switch (sort) {
        case 'activity':
          return b.xp7 - a.xp7 || b.minutes7 - a.minutes7;
        case 'accuracy':
          return (b.avgAccuracy ?? -1) - (a.avgAccuracy ?? -1);
        case 'level':
          return (
            order.indexOf(b.current_level ?? '') - order.indexOf(a.current_level ?? '')
          );
        default:
          return (a.full_name ?? '').localeCompare(b.full_name ?? '', 'fa');
      }
    });
  }, [students, query, level, activity, sort]);

  return (
    <div className="space-y-5 fade-in">
      {/* ---------- filters ---------- */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
              جست‌وجو
            </label>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="نام یا ایمیل دانش‌آموز…"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
              سطح CEFR
            </label>
            <select
              className="input"
              value={level}
              onChange={(e) => setLevel(e.target.value as CefrLevel | 'all')}
            >
              <option value="all">همه سطح‌ها</option>
              {CEFR_LEVELS.map((l) => (
                <option key={l} value={l}>{l} — {LEVEL_FA[l]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>
              مرتب‌سازی
            </label>
            <select
              className="input"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {ACTIVITY_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActivity(t.key)}
              className="rounded-full border px-3 py-1.5 text-xs transition-all"
              style={{
                borderColor: activity === t.key ? 'var(--color-brand-600)' : 'var(--border)',
                background: activity === t.key ? 'var(--color-brand-600)' : 'transparent',
                color: activity === t.key ? '#fff' : 'var(--fg)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
          <span className="num">{filtered.length}</span> از{' '}
          <span className="num">{students.length}</span> دانش‌آموز نمایش داده می‌شود
        </p>
      </Card>

      {/* ---------- list ---------- */}
      {filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-3xl">🔍</div>
          <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
            هیچ دانش‌آموزی با این فیلترها پیدا نشد.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <Link key={s.id} href={`/teacher/students/${s.id}`}>
              <Card className="h-full p-4 transition-transform hover:-translate-y-1">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ background: 'var(--color-brand-600)' }}
                  >
                    {(s.full_name || s.email || '؟').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{s.full_name || 'بدون نام'}</div>
                    <div className="ltr truncate text-xs" style={{ color: 'var(--muted)' }} dir="ltr">
                      {s.email}
                    </div>
                  </div>
                  {s.current_level && <LevelBadge level={s.current_level} showFa={false} />}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg p-2" style={{ background: 'var(--bg)' }}>
                    <div className="num font-bold">{s.xp7}</div>
                    <div style={{ color: 'var(--muted)' }}>XP هفته</div>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: 'var(--bg)' }}>
                    <div className="num font-bold">{s.minutes7}</div>
                    <div style={{ color: 'var(--muted)' }}>دقیقه</div>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: 'var(--bg)' }}>
                    <div className="num font-bold">
                      {s.avgAccuracy != null ? `${s.avgAccuracy}٪` : '—'}
                    </div>
                    <div style={{ color: 'var(--muted)' }}>دقت</div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px]" style={{ color: 'var(--muted)' }}>
                    <span>فعالیت هفته</span>
                    <span className="num">{s.activeDays7}/۷ روز</span>
                  </div>
                  <Progress
                    value={s.activeDays7}
                    max={7}
                    height={5}
                    color={s.activeDays7 >= 4 ? 'var(--color-accent-500)' : 'var(--color-brand-600)'}
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span style={{ color: 'var(--muted)' }}>{lastSeenLabel(s)}</span>
                  {!s.placement_done && (
                    <span className="badge bg-amber-100 text-amber-700">تعیین سطح نشده</span>
                  )}
                  {s.pendingReview > 0 && (
                    <span className="badge num bg-sky-100 text-sky-700">
                      {s.pendingReview} بازبینی
                    </span>
                  )}
                  {s.openMistakes > 0 && (
                    <span className="badge num bg-rose-100 text-rose-700">
                      {s.openMistakes} خطای باز
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
