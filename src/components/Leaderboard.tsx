'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Empty, SectionTitle, Spinner, Stat } from '@/components/ui';
import { LEVEL_FA, type CefrLevel } from '@/types/db';

interface Row {
  rank: number;
  is_me: boolean;
  name: string;
  current_level: CefrLevel | null;
  streak_days: number;
  xp: number;
  active_days_7: number;
  badge_count: number;
}

interface Payload {
  period: 'weekly' | 'all';
  page: number;
  total: number;
  rows: Row[];
  opted_in: boolean;
  display_name: string | null;
  me: { rank: number | null; xp: number; streak_days: number; badge_count: number } | null;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const [period, setPeriod] = useState<'weekly' | 'all'>('weekly');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  // opt-in panel
  const [optIn, setOptIn] = useState(false);
  const [alias, setAlias] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Bumping this refetches without duplicating the request logic.
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    fetch(`/api/leaderboard?period=${period}&page=${page}`, { signal: controller.signal })
      .then((res) => res.json().then((d) => ({ ok: res.ok, d })))
      .then(({ ok: fine, d }) => {
        if (!alive) return;
        if (!fine) throw new Error(d.error);
        setData(d);
        setOptIn(Boolean(d.opted_in));
        setAlias(d.display_name ?? '');
      })
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
      controller.abort();
    };
  }, [period, page, reloadKey]);

  async function savePrefs(next: boolean) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/profile/leaderboard-optin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          show_on_leaderboard: next,
          display_name: alias.trim() || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'ذخیره ناموفق بود');
      setOptIn(d.show_on_leaderboard);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای نامشخص');
    } finally {
      setSaving(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold">🏆 جدول امتیاز</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          رقابت دوستانه بین زبان‌آموزانی که مایل به نمایش عمومی هستند
        </p>
      </div>

      {/* ---------- privacy / opt-in ---------- */}
      <Card>
        <SectionTitle
          title="🔒 نمایش عمومی"
          subtitle="حضور شما در این جدول کاملاً اختیاری است"
        />

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={optIn}
            disabled={saving}
            onChange={(e) => {
              setOptIn(e.target.checked);
              void savePrefs(e.target.checked);
            }}
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-brand-600)]"
          />
          <span className="text-sm leading-7">
            نام و امتیاز من در جدول عمومی نمایش داده شود.
            <span className="block text-xs" style={{ color: 'var(--muted)' }}>
              ایمیل، درس‌ها، اشتباهات و هیچ داده شخصی دیگری هرگز نمایش داده نمی‌شود —
              فقط نام نمایشی، سطح، امتیاز و تعداد نشان‌ها.
            </span>
          </span>
        </label>

        {optIn && (
          <div className="mt-4 fade-in">
            <label className="mb-1.5 block text-sm font-medium">
              نام نمایشی (اختیاری)
            </label>
            <div className="flex gap-2">
              <input
                className="input"
                value={alias}
                maxLength={40}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="مثلاً: یاسر ر."
              />
              <button
                onClick={() => void savePrefs(true)}
                disabled={saving}
                className="btn btn-primary shrink-0"
              >
                {saving ? <Spinner size={15} /> : 'ذخیره'}
              </button>
            </div>
            <p className="mt-1.5 text-xs" style={{ color: 'var(--muted)' }}>
              اگر خالی بگذارید، نام پروفایل شما استفاده می‌شود.
            </p>
          </div>
        )}

        {error && <div className="mt-3"><Alert kind="error">{error}</Alert></div>}
        {saved && <div className="mt-3"><Alert kind="success">تنظیمات ذخیره شد.</Alert></div>}
      </Card>

      {/* ---------- my standing ---------- */}
      {data?.me && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="رتبه شما" value={data.me.rank ?? '—'} icon="📍" />
          <Stat label={period === 'weekly' ? 'امتیاز هفته' : 'امتیاز کل'} value={data.me.xp} icon="⭐" />
          <Stat label="نشان‌ها" value={data.me.badge_count} icon="🏅" />
        </div>
      )}

      {/* ---------- table ---------- */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1">
            {([
              ['weekly', 'این هفته'],
              ['all', 'کل زمان'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => {
                  setLoading(true);
                  setPeriod(k);
                  setPage(0);
                }}
                className="rounded-lg px-3 py-1.5 text-sm transition-colors"
                style={
                  period === k
                    ? { background: 'var(--color-brand-50)', color: 'var(--color-brand-700)', fontWeight: 500 }
                    : { color: 'var(--muted)' }
                }
              >
                {label}
              </button>
            ))}
          </div>
          {data && (
            <span className="num text-xs" style={{ color: 'var(--muted)' }}>
              {data.total} شرکت‌کننده
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-14 w-full" />
            ))}
          </div>
        ) : !data?.rows.length ? (
          <Empty
            icon="🏆"
            title="هنوز کسی در جدول نیست"
            description={
              optIn
                ? 'شما اولین نفر هستید! با تمرین امتیاز جمع کنید تا اینجا دیده شوید.'
                : 'برای دیدن و حضور در جدول، گزینه «نمایش عمومی» را فعال کنید.'
            }
          />
        ) : (
          <>
            <div className="space-y-2">
              {data.rows.map((r) => (
                <div
                  key={`${r.rank}-${r.name}`}
                  className="flex items-center gap-3 rounded-xl border p-3 transition-colors"
                  style={{
                    borderColor: r.is_me ? 'var(--color-brand-600)' : 'var(--border)',
                    background: r.is_me ? 'var(--color-brand-50)' : 'transparent',
                  }}
                >
                  <div className="w-9 shrink-0 text-center">
                    {r.rank <= 3 ? (
                      <span className="text-xl">{MEDALS[r.rank - 1]}</span>
                    ) : (
                      <span className="num text-sm font-bold" style={{ color: 'var(--muted)' }}>
                        {r.rank}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{r.name}</span>
                      {r.is_me && (
                        <span className="badge shrink-0 bg-brand-100 text-brand-700">شما</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                      {r.current_level && (
                        <span className="num">{r.current_level} · {LEVEL_FA[r.current_level]}</span>
                      )}
                      {r.streak_days > 0 && <span className="num">🔥 {r.streak_days}</span>}
                      {r.badge_count > 0 && <span className="num">🏅 {r.badge_count}</span>}
                    </div>
                  </div>

                  <div className="shrink-0 text-left">
                    <div className="num text-lg font-bold" style={{ color: 'var(--color-brand-600)' }}>
                      {r.xp}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--muted)' }}>XP</div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => { setLoading(true); setPage((p) => Math.max(0, p - 1)); }}
                  disabled={page === 0}
                  className="btn btn-ghost py-1.5 text-sm"
                >
                  → قبلی
                </button>
                <span className="num text-sm" style={{ color: 'var(--muted)' }}>
                  {page + 1} از {totalPages}
                </span>
                <button
                  onClick={() => { setLoading(true); setPage((p) => p + 1); }}
                  disabled={page + 1 >= totalPages}
                  className="btn btn-ghost py-1.5 text-sm"
                >
                  بعدی ←
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
