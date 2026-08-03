'use client';

import { useState } from 'react';
import { Card, Empty, LevelBadge, SectionTitle, Stat } from '@/components/ui';
import PronunciationPractice from '@/components/PronunciationPractice';
import type { TargetSentence } from '@/lib/ai/pronunciation-engine';
import type { CefrLevel } from '@/types/db';
import Speak from '@/components/Speak';

interface RecentAttempt {
  id: string;
  target_text: string;
  accuracy_score: number;
  created_at: string;
  source: 'service' | 'browser' | 'heuristic';
  used_fallback: boolean;
}

export default function PronunciationWorkshop({
  level,
  sentences,
  recent,
}: {
  level: CefrLevel | null;
  sentences: TargetSentence[];
  recent: RecentAttempt[];
}) {
  const [selected, setSelected] = useState<TargetSentence>(sentences[0]);
  const [session, setSession] = useState<number[]>([]);

  const scored = recent.filter((r) => r.source !== 'heuristic');
  const best = scored.length ? Math.max(...scored.map((r) => Number(r.accuracy_score))) : 0;
  const avg = scored.length
    ? Math.round(scored.reduce((s, r) => s + Number(r.accuracy_score), 0) / scored.length)
    : 0;

  const scoreColor = (s: number) =>
    s >= 80
      ? 'var(--color-success-700)'
      : s >= 55
        ? 'var(--color-warning-700)'
        : 'var(--color-error-600)';

  if (!sentences.length) {
    return (
      <Empty
        icon="🎤"
        title="هنوز جمله‌ای برای تمرین تلفظ آماده نیست"
        description="جمله‌های تمرین از درس‌های شما ساخته می‌شوند. یک درس بسازید تا جمله‌های متناسب با سطحتان اینجا ظاهر شود."
        action={{ label: 'ساخت درس جدید', href: '/lessons' }}
        secondaryAction={{ label: 'گفت‌وگو با مربی', href: '/tutor' }}
      />
    );
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="t-h1">🎤 تمرین تلفظ</h1>
          <p className="mt-1 flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
            جمله را با صدای بلند بخوانید تا تلفظتان تحلیل شود
            {level && <>· سطح شما: <LevelBadge level={level} /></>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="تمرین‌های امروز" value={session.length} icon="🎯" />
        <Stat label="بهترین امتیاز" value={best ? Math.round(best) : '—'} icon="🏆" />
        <Stat label="میانگین اخیر" value={avg ? `${avg}٪` : '—'} icon="📊" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* ---------- sentence picker ---------- */}
        <aside className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 text-sm font-bold">جمله‌های پیشنهادی</div>
            <div className="space-y-2">
              {sentences.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  aria-pressed={selected.id === s.id}
                  className="w-full rounded-xl border-2 p-3 text-start transition-all"
                  style={{
                    borderColor:
                      selected.id === s.id ? 'var(--color-primary-600)' : 'var(--border-strong)',
                    background: selected.id === s.id ? 'var(--color-primary-50)' : 'transparent',
                  }}
                >
                  <div className="flex items-start gap-1">
                    <div className="ltr text-sm font-medium leading-6" dir="ltr">{s.text}</div>
                    <Speak text={s.text} size="xs" />
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{s.focus_fa}</span>
                    <span className="num text-[11px]" style={{ color: 'var(--muted)' }}>{s.level}</span>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="mb-2 text-sm font-bold">💡 راهنما</div>
            <ul className="space-y-1.5 text-xs leading-6" style={{ color: 'var(--muted)' }}>
              <li>• اول روی «شنیدن تلفظ درست» بزنید.</li>
              <li>• در محیط ساکت و شمرده صحبت کنید.</li>
              <li>• میکروفون را خیلی نزدیک دهان نگیرید.</li>
              <li>• صدای شما خصوصی است و فقط خودتان به آن دسترسی دارید.</li>
            </ul>
          </Card>
        </aside>

        {/* ---------- practice ---------- */}
        <div className="space-y-6">
          <PronunciationPractice
            sentence={selected}
            level={level}
            onScored={(s) => setSession((prev) => [...prev, s])}
          />

          {recent.length > 0 && (
            <Card>
              <SectionTitle title="تلاش‌های اخیر شما" />
              <div className="space-y-2">
                {recent.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-xl border p-3"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="min-w-0">
                      <div className="ltr truncate text-sm" dir="ltr">{r.target_text}</div>
                      <div className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                        {new Date(r.created_at).toLocaleDateString('fa-IR')}
                        {r.source === 'heuristic' && ' · بدون نمره دقیق'}
                      </div>
                    </div>
                    {r.source !== 'heuristic' ? (
                      <span
                        className="num badge shrink-0 text-white"
                        style={{ background: scoreColor(Number(r.accuracy_score)) }}
                      >
                        {Math.round(Number(r.accuracy_score))}
                      </span>
                    ) : (
                      <span className="badge shrink-0 bg-primary-50 text-primary-800">—</span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
