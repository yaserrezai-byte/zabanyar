'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BridgeRing, Card, ErrorState, LevelBadge, Progress, Spinner, Stat } from '@/components/ui';
import type { VocabularyMemory } from '@/types/db';
import { announceBadges } from '@/lib/badge-events';
import Speak from '@/components/Speak';

const QUALITY = [
  { q: 0, label: 'بلد نبودم', emoji: '😰', color: 'var(--color-error-600)' },
  { q: 3, label: 'سخت بود', emoji: '😅', color: 'var(--color-warning-700)' },
  { q: 4, label: 'خوب بود', emoji: '🙂', color: 'var(--color-info-700)' },
  { q: 5, label: 'خیلی راحت', emoji: '😎', color: 'var(--color-success-700)' },
];

export default function VocabReview({
  words,
  total,
  mastered,
}: {
  words: VocabularyMemory[];
  total: number;
  mastered: number;
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(0);
  const [rateError, setRateError] = useState<string | null>(null);
  const [pendingQuality, setPendingQuality] = useState<number | null>(null);

  const current = words[idx];

  async function rate(quality: number) {
    if (!current || saving) return;
    setSaving(true);
    setRateError(null);
    try {
      const res = await fetch('/api/vocabulary/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word_id: current.id, quality }),
      });
      if (!res.ok) throw new Error('review failed');
      const payload = await res.json().catch(() => null);
      announceBadges(payload?.new_badges);
    } catch (e) {
      // Stay on the same card: advancing would silently lose the rating.
      console.error(e);
      setRateError(
        'این مرور ثبت نشد و زمان‌بندی لغت به‌روز نشده است. اتصال اینترنت را بررسی کن و دوباره تلاش کن.'
      );
      setPendingQuality(quality);
      setSaving(false);
      return;
    }
    setPendingQuality(null);
    setDone((d) => d + 1);
    setRevealed(false);
    setSaving(false);

    if (idx + 1 >= words.length) {
      router.refresh();
      setIdx(words.length);
    } else {
      setIdx((i) => i + 1);
    }
  }

  // ---------------- all done ----------------
  if (!words.length || idx >= words.length) {
    return (
      <div className="mx-auto max-w-xl space-y-5 fade-in">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="کل لغات" value={total} icon="📖" />
          <Stat label="تسلط یافته" value={mastered} icon="🏆" />
          <Stat label="مرور امروز" value={done} icon="✅" />
        </div>
        <Card className="p-10 text-center">
          <div className="flex justify-center">
            <BridgeRing
              value={done}
              max={Math.max(done, 1)}
              size={96}
              stroke={9}
              color="var(--color-success-700)"
              ariaLabel={`${done} لغت مرور شد`}
            >
              <span className="text-3xl" aria-hidden="true">🎉</span>
            </BridgeRing>
          </div>
          <h2 className="mt-3 text-xl font-bold">
            {done > 0 ? 'مرور امروز تمام شد!' : 'همه لغات به‌روز هستند'}
          </h2>
          <p className="mt-2 text-sm leading-8" style={{ color: 'var(--muted)' }}>
            {done > 0
              ? `${done} لغت را مرور کردید. لغت‌های بعدی طبق الگوریتم تکرار فاصله‌دار در روزهای آینده نمایش داده می‌شوند.`
              : 'در حال حاضر هیچ لغتی برای مرور سررسید نشده است. با ساخت درس یا گفت‌وگو لغات جدید اضافه کنید.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/dashboard" className="btn btn-ghost">داشبورد</Link>
            <Link href="/lessons" className="btn btn-primary">ساخت درس جدید</Link>
          </div>
        </Card>
      </div>
    );
  }

  // ---------------- card ----------------
  return (
    <div className="mx-auto max-w-xl space-y-5 fade-in">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="کل لغات" value={total} icon="📖" />
        <Stat label="تسلط یافته" value={mastered} icon="🏆" />
        <Stat label="باقی‌مانده امروز" value={words.length - idx} icon="🔁" />
      </div>

      <div>
        <div className="mb-2 flex justify-between text-sm">
          <span style={{ color: 'var(--muted)' }}>پیشرفت مرور</span>
          <span className="num" style={{ color: 'var(--muted)' }}>
            {idx} / {words.length}
          </span>
        </div>
        <Progress value={idx} max={words.length} label={`${idx} از ${words.length} لغت مرور شد`} />
      </div>

      <Card className="min-h-[19rem] p-8 text-center">
        <div className="mb-3 flex items-center justify-center gap-2">
          <LevelBadge level={current.level} showFa={false} />
          {current.part_of_speech && (
            <span className="ltr badge bg-primary-50 text-primary-800" dir="ltr">
              {current.part_of_speech}
            </span>
          )}
          <span className="badge bg-primary-50 text-primary-800">
            تسلط: <b className="num">{Math.round(current.mastery * 100)}٪</b>
          </span>
        </div>

        <div className="flex items-center justify-center gap-2">
          <h2 className="ltr text-3xl font-bold" dir="ltr">{current.word}</h2>
          <Speak text={current.word} size="md" />
        </div>
        {current.phonetic && (
          <p className="ltr mt-1 text-sm" style={{ color: 'var(--muted)' }} dir="ltr">
            {current.phonetic}
          </p>
        )}

        {!revealed ? (
          <>
            <p className="mt-8 text-sm" style={{ color: 'var(--muted)' }}>
              معنی این کلمه را به یاد دارید؟
            </p>
            <button onClick={() => setRevealed(true)} className="btn btn-primary mt-4 px-8 py-3">
              نمایش معنی
            </button>
          </>
        ) : (
          <div className="fade-in">
            <div className="mt-5 rounded-xl p-4" style={{ background: 'var(--bg)' }}>
              <p className="text-lg font-medium">{current.meaning_fa}</p>
              {current.example_en && (
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  <p className="ltr text-sm" dir="ltr">{current.example_en}</p>
                  <Speak text={current.example_en} />
                </div>
              )}
              {current.example_fa && (
                <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{current.example_fa}</p>
              )}
            </div>

            <p className="mt-5 text-sm" style={{ color: 'var(--muted)' }}>
              چقدر خوب یادتان بود؟
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {QUALITY.map((q) => (
                <button
                  key={q.q}
                  onClick={() => rate(q.q)}
                  disabled={saving}
                  className="rounded-xl border-2 p-3 text-sm transition-all hover:-translate-y-0.5 disabled:opacity-50"
                  style={{ borderColor: q.color, color: q.color }}
                >
                  <div className="text-xl">{q.emoji}</div>
                  <div className="mt-1 text-xs font-medium">{q.label}</div>
                </button>
              ))}
            </div>
            {saving && (
              <div className="mt-3">
                <Spinner />
              </div>
            )}

            {rateError && (
              <div className="mt-4 text-start">
                <ErrorState
                  compact
                  title="ثبت مرور انجام نشد"
                  description={rateError}
                  onRetry={() => pendingQuality !== null && rate(pendingQuality)}
                />
              </div>
            )}
          </div>
        )}
      </Card>

      <p className="text-center text-xs" style={{ color: 'var(--muted)' }}>
        زمان‌بندی مرور با الگوریتم SM-2 محاسبه می‌شود — هر چه راحت‌تر یادتان بیاید،
        فاصله مرور بعدی بیشتر می‌شود.
      </p>
    </div>
  );
}
