import { z } from 'zod';
import { getAuth, unauthorized, badRequest, serverError } from '@/lib/auth';
import { buildLearnerContext, generateLesson } from '@/lib/ai/service';
import { templateForTag } from '@/lib/ai/local-engine';
import { templateForTagEs } from '@/lib/ai/local-engine-es';
import { shuffleExercise } from '@/lib/ai/shuffle';
import { getActiveLanguage } from '@/lib/active-language';
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
    const language = await getActiveLanguage(supabase, user.id);
    const ctx = await buildLearnerContext(supabase, user.id, language);

    const level: CefrLevel = body.level ?? ctx.level ?? 'A2';
    let skill: SkillKind = body.skill ?? ctx.weakestSkill ?? 'grammar';
    let topic = body.topic;

    // Resolve error tags to lesson templates in the learner's language.
    const resolveTemplate = (tag: string) =>
      language === 'es' ? templateForTagEs(tag) : templateForTag(tag);

    // What the learner already has, in THIS language. Previously this was
    // never consulted, so every generation could return the same lesson.
    const { data: existing } = await supabase
      .from('lessons')
      .select('topic')
      .eq('user_id', user.id)
      .eq('language', language)
      .order('created_at', { ascending: false })
      .limit(20);

    const recentTopics = (existing ?? [])
      .map((l) => l.topic)
      .filter((t): t is string => Boolean(t));

    // Map each stored topic onto the template it actually resolves to,
    // so "nuance" and "tone" are recognised as the same lesson.
    const usedTemplates = Array.from(
      new Set(recentTopics.map((t) => resolveTemplate(t)).filter((t): t is string => Boolean(t)))
    );

    // AI Error Intelligence: build the lesson around a weakness — but
    // rotate through them instead of always taking the most frequent
    // one, which is what made the same lesson come back every time.
    if (!topic && (body.from_weakness ?? true) && ctx.weaknesses?.length) {
      const unaddressed = ctx.weaknesses.filter((w) => {
        const tpl = resolveTemplate(w.tag);
        return tpl && !usedTemplates.includes(tpl);
      });

      const chosen = unaddressed.length
        ? unaddressed[0]
        : ctx.weaknesses[Math.floor(Math.random() * ctx.weaknesses.length)];

      topic = chosen.tag;

      const { data: mistake } = await supabase
        .from('mistakes_memory')
        .select('skill')
        .eq('user_id', user.id)
        .eq('language', language)
        .eq('error_tag', chosen.tag)
        .maybeSingle();
      if (mistake?.skill) skill = mistake.skill as SkillKind;
    }

    // No weakness to work from: let the engine choose something the
    // learner has not seen, rather than defaulting to one fixed topic.
    const generated = await generateLesson(
      skill,
      level,
      topic ?? '',
      ctx,
      usedTemplates
    );

    // Record the template that was actually produced, not the raw error
    // tag, so future de-duplication compares like with like.
    topic = generated.topic ?? topic ?? (language === 'es' ? 'daily_conversation_es' : 'daily_conversation');

    const { data: lesson, error } = await supabase
      .from('lessons')
      .insert({
        user_id: user.id,
        title: generated.title,
        title_fa: generated.title_fa,
        language,
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
        generated.exercises.slice(0, 12).map((ex, i) => {
          // Randomise option order so the answer is not predictable by
          // position (the hand-written bank is heavily biased to B).
          const shuffled = shuffleExercise({
            options: ex.options ?? [],
            correct_answer: ex.correct_answer ?? 0,
          });
          return {
            lesson_id: lesson.id,
            user_id: user.id,
            language,
            kind: ['mcq', 'fill_blank'].includes(ex.kind) ? ex.kind : 'mcq',
            skill,
            level,
            prompt: ex.prompt,
            prompt_fa: ex.prompt_fa ?? null,
            options: shuffled.options,
            correct_answer: shuffled.correct_answer,
            explanation_fa: ex.explanation_fa ?? null,
            points: 10,
            order_index: i,
          };
        })
      );
    }

    // seed vocabulary
    if (generated.vocabulary?.length) {
      await supabase.from('vocabulary_memory').upsert(
        generated.vocabulary.slice(0, 15).map((w) => ({
          user_id: user.id,
          language,
          word: w.word,
          meaning_fa: w.meaning_fa,
          part_of_speech: w.part_of_speech ?? null,
          example_en: w.example_en ?? null,
          example_fa: w.example_fa ?? null,
          level,
          source: 'lesson',
        })),
        { onConflict: 'user_id,language,word', ignoreDuplicates: true }
      );
    }

    await supabase.from('learning_history').insert({
      user_id: user.id,
      language,
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
