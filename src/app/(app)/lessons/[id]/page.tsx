import Link from 'next/link';
import { toLanguage } from '@/lib/languages';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, LevelBadge } from '@/components/ui';
import LessonExercises from '@/components/LessonExercises';
import type { Exercise, Lesson, SkillKind } from '@/types/db';
import { SKILL_FA, SKILL_ICON } from '@/types/db';
import Speak from '@/components/Speak';

export const dynamic = 'force-dynamic';

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: lesson }, { data: exercises }] = await Promise.all([
    supabase.from('lessons').select('*').eq('id', id).maybeSingle(),
    supabase.from('exercises').select('*').eq('lesson_id', id).order('order_index'),
  ]);

  if (!lesson) notFound();

  const l = lesson as Lesson;
  const sections = l.content?.sections ?? [];
  const vocabulary = l.content?.vocabulary ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 fade-in">
      <Link href="/lessons" className="text-sm hover:underline" style={{ color: 'var(--color-primary-600)' }}>
        → بازگشت به درس‌ها
      </Link>

      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="badge bg-primary-50 text-primary-800">
            {SKILL_ICON[l.skill as SkillKind]} {SKILL_FA[l.skill as SkillKind]}
          </span>
          <LevelBadge level={l.level} />
          <span className="badge bg-primary-50 text-primary-800">⏱ {l.est_minutes} دقیقه</span>
        </div>
        <h1 className="text-2xl font-bold leading-9">{l.title_fa || l.title}</h1>
        <p className="ltr mt-1 flex items-center gap-1.5 text-sm" style={{ color: 'var(--muted)' }} dir="ltr">
          {l.title}
          <Speak language={toLanguage(l.language)} text={l.title} size="xs" />
        </p>
        {l.summary_fa && <p className="mt-3 leading-8">{l.summary_fa}</p>}
      </Card>

      {sections.map((s, i) => (
        <Card key={i}>
          <h2 className="mb-3 text-lg font-bold">
            <span className="num me-2" style={{ color: 'var(--color-primary-600)' }}>{i + 1}.</span>
            {s.heading_fa}
          </h2>
          {s.body_fa && <p className="leading-9">{s.body_fa}</p>}

          {s.examples && s.examples.length > 0 && (
            <div className="mt-4 space-y-2">
              {s.examples.map((ex, j) => (
                <div key={j} className="rounded-xl p-3" style={{ background: 'var(--bg)' }}>
                  <div className="flex items-start gap-1.5">
                    <p className="ltr font-medium" dir="ltr">{ex.en}</p>
                    <Speak language={toLanguage(l.language)} text={ex.en} />
                  </div>
                  <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{ex.fa}</p>
                </div>
              ))}
            </div>
          )}

          {s.tip_fa && (
            <div className="mt-4 rounded-xl border-r-4 bg-accent-50 p-3 text-sm leading-7 text-accent-800" style={{ borderColor: 'var(--color-warning-700)' }}>
              💡 <b>نکته:</b> {s.tip_fa}
            </div>
          )}
        </Card>
      ))}

      {vocabulary.length > 0 && (
        <Card>
          <h2 className="mb-4 text-lg font-bold">📖 واژگان کلیدی</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {vocabulary.map((w, i) => (
              <div key={i} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1">
                    <span className="ltr font-bold" dir="ltr">{w.word}</span>
                    <Speak language={toLanguage(l.language)} text={w.word} size="xs" />
                  </span>
                  {w.part_of_speech && (
                    <span className="ltr text-xs" style={{ color: 'var(--muted)' }} dir="ltr">
                      {w.part_of_speech}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm">{w.meaning_fa}</div>
                {w.example_en && (
                  <div className="mt-2 flex items-start gap-1">
                    <span className="ltr text-xs" style={{ color: 'var(--muted)' }} dir="ltr">
                      {w.example_en}
                    </span>
                    <Speak language={toLanguage(l.language)} text={w.example_en} size="xs" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
            این لغات به‌طور خودکار به لیست مرور هوشمند شما اضافه شدند.
          </p>
        </Card>
      )}

      {exercises && exercises.length > 0 && (
        <LessonExercises
          exercises={exercises as Exercise[]}
          lessonId={l.id}
          language={toLanguage(l.language)}
        />
      )}
    </div>
  );
}
