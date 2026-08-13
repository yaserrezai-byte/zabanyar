'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BridgeRing, ErrorState } from '@/components/ui';
import { LANGUAGES, LEARNING_LANGUAGES, type LearningLanguage } from '@/lib/languages';

interface Track {
  language: LearningLanguage;
  current_level: string | null;
  placement_done: boolean;
  streak_days: number;
}

/**
 * First screen of the two-track experience: choose which language to
 * study. Also reachable later from the nav to switch tracks.
 */
export default function LanguagePicker({
  active,
  tracks,
  mode = 'choose',
}: {
  active: LearningLanguage;
  tracks: Track[];
  mode?: 'choose' | 'switch';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<LearningLanguage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trackOf = (code: LearningLanguage) => tracks.find((t) => t.language === code);

  async function pick(code: LearningLanguage) {
    if (busy) return;
    setBusy(code);
    setError(null);
    try {
      const res = await fetch('/api/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'switch failed');

      // A language with no placement yet starts at the placement test.
      router.push(data.placement_done ? '/dashboard' : '/placement');
      router.refresh();
    } catch (e) {
      console.error(e);
      setError('تغییر زبان انجام نشد. اتصال اینترنت را بررسی کن و دوباره تلاش کن.');
      setBusy(null);
    }
  }

  return (
    <div className="fade-in mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <h1 className="t-h1">
          {mode === 'choose' ? 'کدام زبان را می‌خواهی یاد بگیری؟' : 'تغییر زبان'}
        </h1>
        <p className="mt-2 text-sm leading-7" style={{ color: 'var(--muted)' }}>
          {mode === 'choose'
            ? 'هر زبان مسیر، سطح و پیشرفت جداگانه خودش را دارد. هر وقت خواستی می‌توانی عوض کنی یا هر دو را با هم پیش ببری.'
            : 'پیشرفت زبان فعلی حفظ می‌شود. هر زبان سطح و لغات مستقل خودش را دارد.'}
        </p>
      </div>

      {error && <ErrorState description={error} onRetry={() => setError(null)} />}

      <div className="grid gap-4 sm:grid-cols-2">
        {LEARNING_LANGUAGES.map((code) => {
          const cfg = LANGUAGES[code];
          const track = trackOf(code);
          const started = Boolean(track);
          const isActive = code === active;
          const loading = busy === code;

          return (
            <button
              key={code}
              onClick={() => pick(code)}
              disabled={Boolean(busy)}
              aria-current={isActive ? 'true' : undefined}
              className="card flex flex-col items-start gap-3 p-5 text-start transition-all hover:-translate-y-0.5 disabled:opacity-60"
              style={{
                borderColor: isActive ? cfg.color : 'var(--border)',
                borderWidth: isActive ? 2 : 1,
              }}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-4xl" aria-hidden="true">
                  {cfg.flag}
                </span>
                {isActive && (
                  <span
                    className="badge"
                    style={{ background: 'var(--color-primary-50)', color: 'var(--color-primary-800)' }}
                  >
                    زبان فعلی
                  </span>
                )}
              </div>

              <div>
                <div className="t-h2">{cfg.nameFa}</div>
                <div className="ltr text-sm" dir="ltr" style={{ color: 'var(--muted)' }}>
                  {cfg.nameNative}
                </div>
              </div>

              <p className="text-sm leading-7" style={{ color: 'var(--muted)' }}>
                {cfg.taglineFa}
              </p>

              <div className="mt-1 flex w-full items-center justify-between gap-3">
                {started && track?.current_level ? (
                  <div className="flex items-center gap-2">
                    <BridgeRing
                      value={1}
                      max={1}
                      size={40}
                      stroke={5}
                      color={cfg.color}
                      ariaLabel={`سطح ${track.current_level}`}
                    >
                      <span className="num text-[.6rem] font-bold">{track.current_level}</span>
                    </BridgeRing>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      {track.streak_days > 0 ? (
                        <>
                          <span aria-hidden="true">🔥</span>{' '}
                          <span className="num">{track.streak_days}</span> روز
                        </>
                      ) : (
                        'ادامه بده'
                      )}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    {started ? 'آزمون تعیین سطح انجام نشده' : 'شروع تازه'}
                  </span>
                )}

                <span
                  className="text-sm font-medium"
                  style={{ color: loading ? 'var(--muted)' : cfg.color }}
                >
                  {loading ? 'در حال تغییر…' : started ? 'ادامه' : 'شروع'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs leading-7" style={{ color: 'var(--muted)' }}>
        سطح، لغات، اشتباهات و پیشرفت هر زبان کاملاً جدا نگه داشته می‌شود.
      </p>
    </div>
  );
}
