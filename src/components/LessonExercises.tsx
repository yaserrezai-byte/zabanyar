'use client';

import { useState } from 'react';
import type { LearningLanguage } from '@/lib/languages';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Alert, BridgeRing, Card, ErrorState } from '@/components/ui';
import type { Exercise } from '@/types/db';
import Speak from '@/components/Speak';

export default function LessonExercises({
  exercises,
  lessonId,
  language = 'en',
}: {
  exercises: Exercise[];
  lessonId: string;
  language?: LearningLanguage;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const correctCount = exercises.filter(
    (ex) => answers[ex.id] === Number(ex.correct_answer)
  ).length;
  const allAnswered = exercises.every((ex) => answers[ex.id] !== undefined);
  const score = Math.round((correctCount / exercises.length) * 100);

  async function check() {
    setChecked(true);
    setSaving(true);
    setSaveError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const rows = exercises.map((ex) => ({
        exercise_id: ex.id,
        user_id: user.id,
        answer: { chosen: answers[ex.id] },
        is_correct: answers[ex.id] === Number(ex.correct_answer),
        score: answers[ex.id] === Number(ex.correct_answer) ? 100 : 0,
        graded_at: new Date().toISOString(),
      }));

      await Promise.all([
        supabase.from('submissions').insert(rows),
        supabase.from('learning_history').insert({
          user_id: user.id,
          event_type: 'lesson_completed',
          skill: exercises[0]?.skill ?? 'grammar',
          lesson_id: lessonId,
          duration_sec: exercises.length * 45,
          xp: correctCount * 5,
          accuracy: score,
        }),
      ]);
    } catch (e) {
      console.error(e);
      // The answers are already shown; only the server record failed.
      setSaveError(
        'نتیجه این تمرین روی حساب شما ثبت نشد. پاسخ‌ها درست نمایش داده شده‌اند، اما امتیاز ثبت نشده است — اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.'
      );
    } finally {
      setSaving(false);
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-bold">✏️ تمرین‌ها</h2>
      <p className="mb-5 text-sm" style={{ color: 'var(--muted)' }}>
        {exercises.length} تمرین — بعد از پاسخ به همه، روی «بررسی پاسخ‌ها» بزنید.
      </p>

      <div className="space-y-6">
        {exercises.map((ex, idx) => {
          const chosen = answers[ex.id];
          const correct = Number(ex.correct_answer);
          return (
            <div key={ex.id} className="border-b pb-5 last:border-0" style={{ borderColor: 'var(--border)' }}>
              <div className="mb-3">
                <span className="num me-2 font-bold" style={{ color: 'var(--color-primary-700)' }}>
                  {idx + 1}.
                </span>
                <span className="ltr inline font-medium" dir="ltr">{ex.prompt}</span>
                <Speak text={ex.prompt} size="xs" className="ms-1" language={language} />
                {ex.prompt_fa && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{ex.prompt_fa}</p>
                )}
              </div>

              <div className="space-y-2" role="group" aria-label={`گزینه‌های تمرین ${idx + 1}`}>
                {(ex.options ?? []).map((opt, i) => {
                  // Feedback is never colour-only: each state carries an icon
                  // and a screen-reader label as well (WCAG 1.4.1).
                  let borderColor = 'var(--border-strong)';
                  let background = 'transparent';
                  let mark: string | null = null;
                  let markLabel = '';
                  let markColor = '';
                  let anim = '';

                  if (checked) {
                    if (i === correct) {
                      borderColor = 'var(--color-success-700)';
                      background = 'var(--color-success-50)';
                      mark = '✓';
                      markLabel = 'پاسخ درست';
                      markColor = 'var(--color-success-800)';
                      anim = i === chosen ? 'answer-correct' : '';
                    } else if (i === chosen) {
                      borderColor = 'var(--color-error-600)';
                      background = 'var(--color-error-50)';
                      mark = '✗';
                      markLabel = 'پاسخ شما — نادرست';
                      markColor = 'var(--color-error-700)';
                      anim = 'answer-wrong';
                    }
                  } else if (chosen === i) {
                    borderColor = 'var(--color-primary-600)';
                    background = 'var(--color-primary-50)';
                    mark = '●';
                    markLabel = 'انتخاب شما';
                    markColor = 'var(--color-primary-700)';
                  }

                  return (
                    <button
                      key={i}
                      disabled={checked}
                      onClick={() => setAnswers((a) => ({ ...a, [ex.id]: i }))}
                      aria-pressed={!checked && chosen === i}
                      className={`ltr flex w-full items-center gap-2 rounded-xl border-2 p-3 text-left text-sm transition-all disabled:cursor-default ${anim}`}
                      style={{ borderColor, background }}
                      dir="ltr"
                    >
                      <span className="num shrink-0 font-bold opacity-60">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      <span className="flex-1">{opt}</span>
                      {mark && (
                        <span
                          className="shrink-0 text-base font-bold"
                          style={{ color: markColor }}
                        >
                          <span aria-hidden="true">{mark}</span>
                          <span className="sr-only">{markLabel}</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {checked && ex.explanation_fa && (
                <div className="mt-3">
                  <Alert kind={chosen === correct ? 'success' : 'info'}>{ex.explanation_fa}</Alert>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!checked ? (
        <button
          onClick={check}
          disabled={!allAnswered || saving}
          className="btn btn-primary mt-6 w-full py-3"
        >
          {allAnswered ? 'بررسی پاسخ‌ها' : `${exercises.length - Object.keys(answers).length} تمرین باقی مانده`}
        </button>
      ) : (
        <div
          className="fade-in mt-6 rounded-2xl p-5 text-center"
          style={{ background: 'var(--bg)' }}
          role="status"
        >
          <div className="text-3xl" aria-hidden="true">
            {score >= 80 ? '🎉' : score >= 50 ? '👍' : '💪'}
          </div>
          <div className="mt-2 flex justify-center">
            <BridgeRing
              value={correctCount}
              max={exercises.length}
              size={104}
              stroke={9}
              color={score >= 70 ? 'var(--color-success-700)' : 'var(--color-primary-600)'}
              ariaLabel={`${correctCount} پاسخ درست از ${exercises.length} تمرین`}
            >
              <span className="num text-2xl font-bold">{score}٪</span>
            </BridgeRing>
          </div>
          <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
            <span className="num">{correctCount}</span> پاسخ درست از{' '}
            <span className="num">{exercises.length}</span> تمرین
          </p>

          {saveError && (
            <div className="mt-4 text-start">
              <ErrorState
                compact
                title="ثبت نتیجه انجام نشد"
                description={saveError}
                onRetry={check}
              />
            </div>
          )}

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/lessons" className="btn btn-ghost">درس‌های دیگر</Link>
            <Link href="/vocabulary" className="btn btn-primary">مرور لغات این درس</Link>
          </div>
        </div>
      )}
    </Card>
  );
}
