import { z } from 'zod';
import { getAuth, unauthorized, badRequest, serverError } from '@/lib/auth';
import { sm2 } from '@/lib/ai/local-engine';

export const dynamic = 'force-dynamic';

const Body = z.object({
  word_id: z.string().uuid(),
  quality: z.number().int().min(0).max(5),
});

export async function POST(req: Request) {
  const auth = await getAuth();
  if (!auth) return unauthorized();
  const { supabase, user } = auth;

  let body: z.infer<typeof Body>;
  try { body = Body.parse(await req.json()); }
  catch { return badRequest('داده نامعتبر است.'); }

  try {
    const { data: word, error } = await supabase
      .from('vocabulary_memory')
      .select('*')
      .eq('id', body.word_id)
      .eq('user_id', user.id)
      .single();

    if (error || !word) return badRequest('لغت یافت نشد.');

    const next = sm2(
      {
        ease_factor: Number(word.ease_factor),
        interval_days: word.interval_days,
        repetitions: word.repetitions,
        lapses: word.lapses,
      },
      body.quality
    );

    await Promise.all([
      supabase.from('vocabulary_memory').update({
        ...next,
        last_review_at: new Date().toISOString(),
      }).eq('id', word.id),
      supabase.from('learning_history').insert({
        user_id: user.id,
        event_type: 'vocab_reviewed',
        skill: 'vocabulary',
        xp: body.quality >= 3 ? 3 : 1,
        duration_sec: 20,
        meta: { word: word.word, quality: body.quality },
      }),
    ]);

    return Response.json({ ok: true, ...next });
  } catch (e) {
    console.error('[vocabulary/review]', e);
    return serverError();
  }
}
