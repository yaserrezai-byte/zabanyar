import { z } from 'zod';
import { getAuth, unauthorized, badRequest, serverError } from '@/lib/auth';
import { pickNextQuestion, PLACEMENT_LENGTH } from '@/lib/ai/placement-bank';
import { computePlacement, scoreToLevel } from '@/lib/ai/local-engine';
import { recordMistakes } from '@/lib/ai/service';
import type { CefrLevel, PlacementQuestion, SkillKind } from '@/types/db';
import { LEVEL_FA, SKILLS } from '@/types/db';

export const dynamic = 'force-dynamic';

const Body = z.object({
  test_id: z.string().uuid(),
  chosen_index: z.number().int().min(0).max(5),
  time_spent_sec: z.number().int().min(0).max(3600).optional(),
});

export async function POST(req: Request) {
  const ctx = await getAuth();
  if (!ctx) return unauthorized();
  const { supabase, user } = ctx;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return badRequest('داده ارسالی نامعتبر است.');
  }

  try {
    const { data: test, error } = await supabase
      .from('placement_tests')
      .select('*')
      .eq('id', body.test_id)
      .eq('user_id', user.id)
      .single();

    if (error || !test) return badRequest('آزمون یافت نشد.');
    if (test.status !== 'in_progress') return badRequest('این آزمون قبلاً پایان یافته است.');

    const questions = (test.questions ?? []) as PlacementQuestion[];
    const answers = (test.answers ?? []) as {
      question_id: string; chosen_index: number; correct: boolean;
      skill: SkillKind; level: CefrLevel; error_tag?: string;
    }[];

    const current = questions[answers.length];
    if (!current) return badRequest('سؤال جاری یافت نشد.');

    const correct = body.chosen_index === current.correct_index;
    answers.push({
      question_id: current.id,
      chosen_index: body.chosen_index,
      correct,
      skill: current.skill,
      level: current.level,
      error_tag: current.error_tag,
    });

    const done = answers.length >= PLACEMENT_LENGTH;

    // ---------------- finish ----------------
    if (done) {
      const { score, level, breakdown } = computePlacement(answers);

      // per-skill levels
      const skillRows = SKILLS.map((s) => {
        const skillScore = breakdown[s];
        const finalScore = skillScore ?? Math.max(0, score - 8);
        return {
          user_id: user.id,
          skill: s,
          level: scoreToLevel(finalScore),
          score: Number(finalScore.toFixed(2)),
          confidence: skillScore !== undefined ? 0.8 : 0.35,
          assessed_at: new Date().toISOString(),
        };
      });

      const summary =
        `سطح کلی شما ${level} (${LEVEL_FA[level]}) تشخیص داده شد. ` +
        `از ${answers.length} سؤال، ${answers.filter((a) => a.correct).length} پاسخ درست دادید. ` +
        `قوی‌ترین مهارت: ${bestSkill(breakdown)} — ضعیف‌ترین مهارت: ${worstSkill(breakdown)}.`;

      await Promise.all([
        supabase
          .from('placement_tests')
          .update({
            status: 'completed',
            answers,
            current_index: answers.length,
            raw_score: score,
            result_level: level,
            skill_breakdown: breakdown,
            ai_summary: summary,
            completed_at: new Date().toISOString(),
          })
          .eq('id', test.id),
        supabase.from('skill_levels').upsert(skillRows, { onConflict: 'user_id,skill' }),
        supabase
          .from('profiles')
          .update({ current_level: level, placement_done: true })
          .eq('id', user.id),
        supabase.from('learning_history').insert({
          user_id: user.id,
          event_type: 'placement_completed',
          xp: 100,
          accuracy: score,
          meta: { level, breakdown },
        }),
        recordMistakes(
          supabase,
          user.id,
          answers
            .filter((a) => !a.correct && a.error_tag)
            .map((a) => ({ error_tag: a.error_tag, skill: a.skill, note_fa: 'در آزمون تعیین سطح اشتباه شد.' }))
        ),
      ]);

      return Response.json({
        done: true,
        correct,
        explanation_fa: current.explanation_fa,
        correct_index: current.correct_index,
        result: { score, level, level_fa: LEVEL_FA[level], breakdown, summary },
      });
    }

    // ---------------- next question ----------------
    const next = pickNextQuestion(
      answers.map((a) => ({ level: a.level, correct: a.correct })),
      questions.map((q) => q.id)
    );

    if (next) questions.push(next);

    await supabase
      .from('placement_tests')
      .update({ answers, questions, current_index: answers.length })
      .eq('id', test.id);

    return Response.json({
      done: false,
      correct,
      explanation_fa: current.explanation_fa,
      correct_index: current.correct_index,
      index: answers.length,
      total: PLACEMENT_LENGTH,
      question: next ? sanitize(next) : null,
    });
  } catch (e) {
    console.error('[placement/answer]', e);
    return serverError();
  }
}

function sanitize(q: PlacementQuestion) {
  const { correct_index: _c, explanation_fa: _e, error_tag: _t, ...safe } = q;
  return safe;
}

const FA: Record<string, string> = {
  grammar: 'گرامر', vocabulary: 'واژگان', listening: 'شنیداری',
  speaking: 'گفتاری', reading: 'خواندن', writing: 'نوشتن',
};

function bestSkill(b: Record<string, number>) {
  const e = Object.entries(b);
  if (!e.length) return '—';
  return FA[e.sort((a, c) => c[1] - a[1])[0][0]] ?? '—';
}

function worstSkill(b: Record<string, number>) {
  const e = Object.entries(b);
  if (!e.length) return '—';
  return FA[e.sort((a, c) => a[1] - c[1])[0][0]] ?? '—';
}
