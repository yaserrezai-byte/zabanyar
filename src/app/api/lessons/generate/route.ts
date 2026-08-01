import { z } from 'zod';
import { getAuth, unauthorized, badRequest, serverError } from '@/lib/auth';
import { buildLearnerContext, generateLesson } from '@/lib/ai/service';
import type { CefrLevel, SkillKind } from '@/types/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const Body = z.object({
  skill: z
    .enum(['grammar', 'vocabulary', 'listening', 'speaking', 'reading', 'writing'])
    .optional(),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  topic: z.string().max(120).optional(),
  from_weakness: z.boolean().optional(),
});

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return unauthorized();
  const { supabase, user } = auth;

  let body: z.infer<typeof Body> = {};
  try {
    body = Body.parse(await req.json().catch(() => ({})));
  } catch {
    return badRequest('پارامترهای نامعتبر.');
  }

  try {
    const ctx = await buildLearnerContext(supabase, user.id);

    const level: CefrLevel = body.level ?? ctx.level ?? 'A2';
    let skill: SkillKind = body.skill ?? ctx.weakestSkill ?? 'grammar';
    let topic = body.topic;

    // AI Error Intelligence: build the lesson around the top weakness
    if (!topic && (body.from_weakness ?? true) && ctx.weaknesses?.length) {
      const top = ctx.weaknesses[0];
      topic = top.tag;
      const { data: mistake } = await supabase
        .from('mistakes_memory')
        .select('skill')
        .eq('user_id', user.id)
        .eq('error_tag', top.tag)
        .maybeSingle();
      if (mistake?.skill) skill = mistake.skill as SkillKind;
    }
    topic ??= 'daily_conversation';

    const generated = await generateLesson(skill, level, topic, ctx);

    const { data: lesson, error } = await supabase
      .from('lessons')
      .insert({
        user_id: user.id,
        title: generated.title,
        title_fa: generated.title_fa,
        slug: slugify(generated.title),
        skill,
        level,
        topic,
        summary_fa: generated.summary_fa,
        content: {
          sections: generated.sections ?? [],
          vocabulary: generated.vocabulary ?? [],
        },
        est_minutes: generated.est_minutes ?? 12,
        status: 'published',
        ai_generated: true,
        generated_from: {
          source: generated.source,
          weakness: topic,
          weaknesses: ctx.weaknesses?.slice(0, 3) ?? [],
        },
      })
      .select('id')
      .single();

    if (error) throw error;

    // exercises
    if (generated.exercises?.length) {
      await supabase.from('exercises').insert(
        generated.exercises.slice(0, 12).map((ex, i) => ({
          lesson_id: lesson.id,
          user_id: user.id,
          kind: ['mcq', 'fill_blank'].includes(ex.kind) ? ex.kind : 'mcq',
          skill,
          level,
          prompt: ex.prompt,
          prompt_fa: ex.prompt_fa ?? null,
          options: ex.options ?? [],
          correct_answer: ex.correct_answer ?? 0,
          explanation_fa: ex.explanation_fa ?? null,
          points: 10,
          order_index: i,
        }))
      );
    }

    // seed vocabulary
    if (generated.vocabulary?.length) {
      await supabase.from('vocabulary_memory').upsert(
        generated.vocabulary.slice(0, 15).map((w) => ({
          user_id: user.id,
          word: w.word,
          meaning_fa: w.meaning_fa,
          part_of_speech: w.part_of_speech ?? null,
          example_en: w.example_en ?? null,
          example_fa: w.example_fa ?? null,
          level,
          source: 'lesson',
        })),
        { onConflict: 'user_id,word', ignoreDuplicates: true }
      );
    }

    await supabase.from('learning_history').insert({
      user_id: user.id,
      event_type: 'lesson_generated',
      skill,
      lesson_id: lesson.id,
      xp: 10,
      meta: { topic, source: generated.source },
    });

    return Response.json({ lesson_id: lesson.id, source: generated.source, topic, skill, level });
  } catch (e) {
    console.error('[lessons/generate]', e);
    return serverError();
  }
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}
