'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Progress, Spinner } from '@/components/ui';
import Speak from '@/components/Speak';

export interface ReviewableSubmission {
  id: string;
  answer_text: string | null;
  score: number | null;
  is_correct?: boolean | null;
  feedback_fa: string | null;
  teacher_feedback: string | null;
  teacher_score: number | null;
  teacher_feedback_at: string | null;
  created_at: string;
}

const QUICK_NOTES = [
  'نگارش روان و قابل فهم بود، آفرین!',
  'به زمان افعال بیشتر دقت کن.',
  'جمله‌ها را کوتاه‌تر بنویس تا واضح‌تر شوند.',
  'از کلمات ربط بیشتری استفاده کن.',
  'املای چند کلمه نیاز به مرور دارد.',
];

export default function SubmissionReview({
  submission,
  studentName,
  showStudent = false,
}: {
  submission: ReviewableSubmission;
  studentName?: string | null;
  showStudent?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState(submission.teacher_feedback ?? '');
  const [score, setScore] = useState<string>(
    submission.teacher_score != null ? String(Math.round(submission.teacher_score)) : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const aiScore = submission.score != null ? Math.round(Number(submission.score)) : null;
  const hasFeedback = Boolean(submission.teacher_feedback);

  const colour = (s: number) => (s >= 80 ? '#10b981' : s >= 55 ? '#f59e0b' : '#f43f5e');

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/teacher/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submission.id,
          teacher_feedback: feedback.trim() || null,
          teacher_score: score === '' ? null : Number(score),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ثبت بازخورد ناموفق بود');
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطای نامشخص');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {showStudent && studentName && (
            <div className="mb-1 text-xs font-medium" style={{ color: 'var(--color-brand-600)' }}>
              👤 {studentName}
            </div>
          )}
          <div className="flex items-start gap-1.5">
            <p className="ltr line-clamp-2 text-sm leading-7" dir="ltr">
              {submission.answer_text}
            </p>
            <Speak text={submission.answer_text ?? ''} size="xs" />
          </div>
          <div className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            {new Date(submission.created_at).toLocaleDateString('fa-IR')}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {aiScore != null && (
            <span
              className="num badge text-white"
              style={{ background: colour(aiScore) }}
              title="امتیاز خودکار هوش مصنوعی"
            >
              AI {aiScore}
            </span>
          )}
          {submission.teacher_score != null && (
            <span
              className="num badge text-white"
              style={{ background: 'var(--color-brand-600)' }}
              title="امتیاز مدرس"
            >
              مدرس {Math.round(submission.teacher_score)}
            </span>
          )}
          {hasFeedback && !submission.teacher_score && (
            <span className="badge bg-emerald-100 text-emerald-700">بازبینی شد</span>
          )}
        </div>
      </div>

      {submission.feedback_fa && (
        <p className="mt-2 rounded-lg p-2 text-xs leading-6" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
          <b>بازخورد خودکار:</b> {submission.feedback_fa}
        </p>
      )}

      {submission.teacher_feedback && !open && (
        <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50 p-2.5 text-sm leading-7">
          <b className="text-brand-700">بازخورد شما:</b> {submission.teacher_feedback}
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost mt-2 w-full py-1.5 text-xs"
      >
        {open ? 'بستن' : hasFeedback ? '✏️ ویرایش بازخورد' : '✍️ نوشتن بازخورد شخصی'}
      </button>

      {open && (
        <div className="mt-3 space-y-3 fade-in">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_NOTES.map((n) => (
              <button
                key={n}
                onClick={() => setFeedback((f) => (f ? `${f} ${n}` : n))}
                className="rounded-full border px-2.5 py-1 text-[11px] transition-colors hover:bg-brand-50"
                style={{ borderColor: 'var(--border)' }}
              >
                + {n}
              </button>
            ))}
          </div>

          <textarea
            className="input min-h-24 resize-y leading-7"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="بازخورد خود را به فارسی بنویسید…"
          />

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32">
              <label className="mb-1 block text-xs" style={{ color: 'var(--muted)' }}>
                نمره مدرس (اختیاری)
              </label>
              <input
                className="input num"
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="۰ تا ۱۰۰"
              />
            </div>
            <button onClick={save} disabled={saving} className="btn btn-primary flex-1">
              {saving ? <Spinner size={15} /> : '💾 ذخیره بازخورد'}
            </button>
          </div>

          {score !== '' && Number(score) >= 0 && Number(score) <= 100 && (
            <Progress value={Number(score)} color={colour(Number(score))} height={6} />
          )}

          {error && <Alert kind="error">{error}</Alert>}
          {saved && <Alert kind="success">بازخورد ذخیره شد و برای دانش‌آموز قابل مشاهده است.</Alert>}
        </div>
      )}
    </div>
  );
}
