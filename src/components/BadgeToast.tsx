'use client';

import { useCallback, useEffect, useState } from 'react';
import { TIER_STYLE, type BadgeTier } from '@/lib/gamification';

export interface AwardedBadge {
  code: string;
  title_fa: string;
  icon: string;
  tier: BadgeTier;
}

/**
 * Celebration toast for newly earned badges.
 *
 * Any API route can announce an award by dispatching:
 *   window.dispatchEvent(new CustomEvent('zabanyar:badges', { detail: [...] }))
 *
 * Once shown, the badges are marked seen server-side so they do not
 * celebrate again on the next page load.
 */
export default function BadgeToast() {
  const [queue, setQueue] = useState<AwardedBadge[]>([]);
  const current = queue[0] ?? null;

  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);

  useEffect(() => {
    const onAward = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!Array.isArray(detail) || !detail.length) return;
      setQueue((q) => {
        const seen = new Set(q.map((b) => b.code));
        return [...q, ...detail.filter((b: AwardedBadge) => b?.code && !seen.has(b.code))];
      });
    };
    window.addEventListener('zabanyar:badges', onAward);
    return () => window.removeEventListener('zabanyar:badges', onAward);
  }, []);

  // Auto-dismiss and mark seen.
  useEffect(() => {
    if (!current) return;
    const timer = window.setTimeout(dismiss, 5200);

    fetch('/api/badges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes: [current.code] }),
    }).catch(() => {});

    return () => window.clearTimeout(timer);
  }, [current, dismiss]);

  if (!current) return null;

  const style = TIER_STYLE[current.tier] ?? TIER_STYLE.bronze;
  const colours = ['#f59e0b', '#10b981', '#337dff', '#f43f5e', '#8b5cf6'];

  return (
    <div
      role="status"
      aria-live="polite"
      className="toast-in fixed inset-x-3 bottom-20 z-[70] mx-auto max-w-sm sm:inset-x-auto sm:bottom-6 sm:left-6 sm:right-auto"
    >
      <div
        className="card relative overflow-hidden p-4 shadow-lg"
        style={{ borderColor: style.fg }}
      >
        {/* confetti */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="confetti-bit"
              style={{
                left: `${8 + i * 7.5}%`,
                background: colours[i % colours.length],
                animationDelay: `${i * 0.06}s`,
              }}
            />
          ))}
        </div>

        <div className="relative flex items-center gap-3">
          <div
            className="badge-pop flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl"
            style={{ background: style.bg }}
          >
            {current.icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold" style={{ color: style.fg }}>
              🎉 نشان جدید کسب کردید!
            </div>
            <div className="mt-0.5 truncate text-lg font-bold">{current.title_fa}</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              سطح {style.label}
              {queue.length > 1 && <> · {queue.length - 1} نشان دیگر</>}
            </div>
          </div>

          <button
            onClick={dismiss}
            aria-label="بستن"
            className="shrink-0 rounded-lg px-1.5 text-lg leading-none"
            style={{ color: 'var(--muted)' }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
