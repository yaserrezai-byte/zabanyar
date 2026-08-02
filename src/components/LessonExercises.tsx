'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Alert, Card, Progress } from '@/components/ui';
import type { Exercise } from '@/types/db';
import Speak from '@/components/Speak';

export default function LessonExercises({
  exercises,
  lessonId,
}: {
  exercises: Exercise[];
  lessonId: string;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const correctCount = exercises.filter(
    (ex) => answers[ex.id] === Number(ex.correct_answer)
  ).length;
  const allAnswered = exercises.every((ex) => answers[ex.id] !== undefined);
  const score = Math.round((correctCount / exercises.length) * 100);

  async function check() {
    setChecked(true);
    setSaving(true);
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
                <span className="num ml-2 font-bold" style={{ color: 'var(--color-brand-600)' }}>
                  {idx + 1}.
                </span>
                <span className="ltr inline font-medium" dir="ltr">{ex.prompt}</span>
                <Speak text={ex.prompt} size="xs" className="mr-1" />
                {ex.prompt_fa && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{ex.prompt_fa}</p>
                )}
              </div>

              <div className="space-y-2">
                {(ex.options ?? []).map((opt, i) => {
                  let borderColor = 'var(--border)';
                  let background = 'transparent';

                  if (checked) {
                    if (i === correct) {
                      borderColor = '#10b981';
                      background = 'rgb(16 185 129 / .08)';
                    } else if (i === chosen) {
                      borderColor = '#f43f5e';
                      background = 'rgb(244 63 94 / .08)';
                    }
                  } else if (chosen === i) {
                    borderColor = 'var(--color-brand-600)';
                    background = 'var(--color-brand-50)';
                  }

                  return (
                    <button
                      key={i}
                      disabled={checked}
                      onClick={() => setAnswers((a) => ({ ...a, [ex.id]: i }))}
                      className="ltr w-full rounded-xl border-2 p-3 text-left text-sm transition-all disabled:cursor-default"
                      style={{ borderColor, background }}
                      dir="ltr"
                    >
                      <span className="num mr-2 font-bold opacity-50">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      {opt}
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
        <div className="mt-6 rounded-2xl p-5 text-center" style={{ background: 'var(--bg)' }}>
          <div className="text-3xl">{score >= 80 ? '🎉' : score >= 50 ? '👍' : '💪'}</div>
          <div className="num mt-2 text-2xl font-bold">{score}٪</div>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            {correctCount} پاسخ درست از {exercises.length} تمرین
          </p>
          <div className="mx-auto mt-3 max-w-xs">
            <Progress value={score} color={score >= 70 ? 'var(--color-accent-500)' : 'var(--color-brand-600)'} />
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/lessons" className="btn btn-ghost">درس‌های دیگر</Link>
            <Link href="/vocabulary" className="btn btn-primary">مرور لغات این درس</Link>
          </div>
        </div>
      )}
    </Card>
  );
}
