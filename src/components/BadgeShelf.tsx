'use client';

import { useEffect, useState } from 'react';
import { Card, ErrorState, Progress, SectionTitle } from '@/components/ui';
import { TIER_STYLE, type BadgeTier } from '@/lib/gamification';

interface BadgeView {
  code: string;
  title_fa: string;
  description_fa: string;
  icon: string;
  tier: BadgeTier;
  earned: boolean;
  earned_at: string | null;
  seen: boolean;
  progress: number;
  threshold: number;
}

interface Payload {
  badges: BadgeView[];
  earned_count: number;
  total_count: number;
}

export default function BadgeShelf({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<'all' | 'earned' | 'locked'>('all');

  useEffect(() => {
    let alive = true;
    fetch('/api/badges')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d?.error) setFailed(true);
        else setData(d);
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [attempt]);

  function retry() {
    setLoading(true);
    setFailed(false);
    setAttempt((a) => a + 1);
  }

  if (loading) {
    // shaped like the real shelf: title, progress bar, grid of badge tiles
    return (
      <Card aria-busy="true" aria-label="در حال بارگذاری نشان‌ها">
        <div className="skeleton mb-2 h-5 w-44" />
        <div className="skeleton mb-4 h-3 w-32" />
        <div className="skeleton mb-4 h-2 w-full rounded-full" />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
      </Card>
    );
  }

  if (failed && !data) {
    return (
      <ErrorState
        title="نشان‌ها بارگذاری نشد"
        description="اتصال اینترنت را بررسی کن و دوباره تلاش کن."
        onRetry={retry}
      />
    );
  }

  if (!data?.badges?.length) return null;

  const shown = data.badges.filter((b) =>
    filter === 'earned' ? b.earned : filter === 'locked' ? !b.earned : true
  );

  const visible = compact
    ? shown.filter((b) => b.earned).slice(0, 8)
    : shown;

  const pct = data.total_count
    ? Math.round((data.earned_count / data.total_count) * 100)
    : 0;

  return (
    <Card>
      <SectionTitle
        title="🏅 نشان‌های دستاورد"
        subtitle={`${data.earned_count} از ${data.total_count} نشان کسب شده`}
        action={
          !compact ? (
            <div className="flex gap-1">
              {([
                ['all', 'همه'],
                ['earned', 'کسب‌شده'],
                ['locked', 'قفل'],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className="rounded-lg px-2.5 py-1 text-xs transition-colors"
                  style={
                    filter === k
                      ? { background: 'var(--color-primary-50)', color: 'var(--color-primary-700)', fontWeight: 500 }
                      : { color: 'var(--muted)' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null
        }
      />

      <div className="mb-4">
        <Progress value={pct} color="var(--color-accent-700)" />
      </div>

      {visible.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {filter === 'earned'
            ? 'هنوز نشانی کسب نکرده‌اید — با تمرین روزانه شروع کنید!'
            : 'همه نشان‌ها را کسب کرده‌اید! 🎉'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((b) => {
            const style = TIER_STYLE[b.tier];
            return (
              <div
                key={b.code}
                title={b.description_fa}
                className={`relative overflow-hidden rounded-xl border p-3 text-center transition-transform hover:-translate-y-0.5 ${
                  b.earned ? '' : 'badge-locked'
                }`}
                style={{
                  borderColor: b.earned ? style.fg : 'var(--border)',
                  background: b.earned ? style.bg : 'transparent',
                }}
              >
                {b.earned && !b.seen && (
                  <span className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full" style={{ background: 'var(--color-error-600)' }} />
                )}

                <div className={`text-3xl ${b.earned ? 'badge-pop' : ''}`}>{b.icon}</div>

                <div className="mt-1.5 truncate text-sm font-bold">{b.title_fa}</div>

                <div className="mt-0.5 text-[10px]" style={{ color: b.earned ? style.fg : 'var(--muted)' }}>
                  {style.label}
                </div>

                {!b.earned && b.progress > 0 && (
                  <div className="mt-2">
                    <Progress value={b.progress * 100} height={4} />
                    <div className="num mt-1 text-[10px]" style={{ color: 'var(--muted)' }}>
                      {Math.round(b.progress * 100)}٪
                    </div>
                  </div>
                )}

                {b.earned && b.earned_at && (
                  <div className="mt-1 text-[10px]" style={{ color: 'var(--muted)' }}>
                    {new Date(b.earned_at).toLocaleDateString('fa-IR')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!compact && (
        <p className="mt-3 text-xs leading-6" style={{ color: 'var(--muted)' }}>
          نشان‌ها به‌طور خودکار پس از هر فعالیت یادگیری بررسی و اعطا می‌شوند.
        </p>
      )}
    </Card>
  );
}
