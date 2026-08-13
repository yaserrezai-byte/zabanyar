import { z } from 'zod';
import { getAuth, unauthorized, badRequest, serverError } from '@/lib/auth';
import { buildLearnerContext, gradeAnswer, recordMistakes } from '@/lib/ai/service';
import { getActiveLanguage } from '@/lib/active-language';
import { checkBadges } from '@/lib/gamification';
import type { SkillKind } from '@/types/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({
  text: z.string().min(1).max(6000),
  skill: z.enum(['grammar','vocabulary','listening','speaking','reading','writing']).default('writing'),
  assignment_id: z.string().uuid().optional(),
  exercise_id: z.string().uuid().optional(),
  question: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return unauthorized();
  const { supabase, user } = auth;

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch { return badRequest('داده ارسالی نامعتبر است.'); }

  try {
    const language = await getActiveLanguage(supabase, user.id);
    const ctx = await buildLearnerContext(supabase, user.id, language);
    const result = await gradeAnswer(body.text, body.skill as SkillKind, ctx, body.question);

    const { data: submission } = await supabase
      .from('submissions')
      .insert({
        assignment_id: body.assignment_id ?? null,
        exercise_id: body.exercise_id ?? null,
        user_id: user.id,
        answer_text: body.text,
        answer: { text: body.text },
        is_correct: result.is_correct,
        score: result.score,
        ai_feedback: {
          strengths: result.strengths_fa,
          improvements: result.improvements_fa,
          corrected_text: result.corrected_text,
          errors: result.errors,
          source: result.source,
        },
        feedback_fa: result.feedback_fa,
        graded_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    await Promise.all([
      recordMistakes(supabase, user.id, result.errors, language),
      body.assignment_id
        ? supabase.from('assignments').update({ status: 'graded' }).eq('id', body.assignment_id).eq('user_id', user.id)
        : Promise.resolve(),
      supabase.from('learning_history').insert({
        user_id: user.id,
        language,
        event_type: 'submission_graded',
        skill: body.skill,
        xp: Math.round(result.score / 5),
        accuracy: result.score,
        duration_sec: 180,
        meta: { errors: result.errors.length, source: result.source },
      }),
    ]);

    // Gamification runs after the learning event is recorded and never
    // blocks the response contract — checkBadges() swallows its errors.
    const newBadges = await checkBadges(supabase, user.id);

    return Response.json({ submission_id: submission?.id, ...result, new_badges: newBadges });
  } catch (e) {
    console.error('[grade]', e);
    return serverError();
  }
}
